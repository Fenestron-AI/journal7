"""FastAPI entrypoint for journal7 AI worker."""

import asyncio
import json
import logging
import time
import uuid
from contextlib import asynccontextmanager

import psycopg2
from fastapi import FastAPI, HTTPException, UploadFile, File, Form
from pydantic import BaseModel

from config import settings
from db import delete_chunks, get_document, insert_chunks, set_document_status, store_embedding
from downloader import download_all, pause, resume, is_paused
from sync_llm import sync_all, sync_single
from ingestion import chunk_text, extract_text
from qa import ask
from yandex import embed

yandex_available = bool(settings.yandex_folder_id and (settings.yandex_api_key or settings.yandex_iam_token))

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("ai-worker")


class IngestRequest(BaseModel):
    document_id: str
    file_path: str


class AskRequest(BaseModel):
    question: str
    history: list[dict] = []


class HealthResponse(BaseModel):
    status: str
    yandex_configured: bool


def _ingest(document_id: str, file_path: str) -> dict:
    doc = get_document(document_id)
    if not doc:
        return {"taskId": None, "status": "error", "chunks": 0, "error": "document not found"}

    logger.info("Ingesting %s (%s)", doc["title"], file_path)
    set_document_status(document_id, "TRACKED", processing_state="processing")

    # 1. Parse
    text = extract_text(file_path)
    if not text.strip():
        set_document_status(document_id, "TRACKED", processing_state="error")
        return {"taskId": None, "status": "error", "chunks": 0, "error": "empty text extracted"}

    # 2. Chunk
    chunks = chunk_text(text, settings.chunk_size, settings.chunk_overlap)

    # 3. Clear old chunks and insert new
    delete_chunks(document_id)
    import json as json_mod
    from ingestion import chunk_has_formula
    chunks_with_meta = []
    for i, c in enumerate(chunks):
        meta = json_mod.dumps({
            "doc_number": doc.get("doc_number"),
            "revision": doc.get("revision"),
            "contains_formula": chunk_has_formula(c),
        })
        chunks_with_meta.append((c, meta))
    insert_chunks(document_id, chunks_with_meta)

    # 4. Embed each chunk (skip if Yandex not configured)
    if yandex_available:
        for i, c in enumerate(chunks):
            emb = embed(c)
            store_embedding(document_id, i, emb)
            if i % 10 == 0:
                logger.info("  embedded %d/%d chunks", i + 1, len(chunks))
    else:
        logger.info("  Yandex not configured, skipping embeddings for %d chunks", len(chunks))

    set_document_status(document_id, "INGESTED", len(chunks), processing_state="done")
    logger.info("Done: %d chunks for %s", len(chunks), doc["title"])
    return {"taskId": str(uuid.uuid4()), "status": "done", "chunks": len(chunks)}


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("AI worker started. Yandex configured: %s", bool(settings.yandex_api_key or settings.yandex_iam_token))
    yield
    logger.info("AI worker stopped")


app = FastAPI(title="journal7 AI Worker", version="0.1.0", lifespan=lifespan)


@app.get("/health", response_model=HealthResponse)
async def health():
    return HealthResponse(
        status="ok",
        yandex_configured=bool((settings.yandex_api_key or settings.yandex_iam_token) and settings.yandex_folder_id),
    )


@app.post("/ingest")
async def ingest(req: IngestRequest):
    loop = asyncio.get_event_loop()
    try:
        return await loop.run_in_executor(None, _ingest, req.document_id, req.file_path)
    except Exception as e:
        logger.exception("Ingest failed")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/download")
async def download_docs():
    """Start download of all MISSING documents in background."""
    import threading
    threading.Thread(target=download_all, daemon=True).start()
    return {"started": True}


@app.get("/download/progress")
async def download_progress():
    """Get download/processing progress."""
    import psycopg2
    from config import settings
    conn = psycopg2.connect(settings.database_url)
    conn.autocommit = True
    cur = conn.cursor()
    cur.execute(
        "SELECT status, count(*) FROM ai.documents GROUP BY status ORDER BY status"
    )
    statuses = {r[0]: r[1] for r in cur.fetchall()}
    cur.close()
    conn.close()
    return {"total": 74, "statuses": statuses, "paused": is_paused()}


@app.post("/download/pause")
async def pause_download():
    pause()
    return {"status": "paused"}


@app.post("/download/resume")
async def resume_download():
    resume()
    return {"status": "resumed"}


@app.get("/download/status")
async def download_status():
    return {"paused": is_paused()}


# ============================================================
# Activity (badge + deltas)
# ============================================================

@app.get("/activity")
async def get_activity():
    conn = psycopg2.connect(settings.database_url)
    conn.autocommit = True
    cur = conn.cursor()
    cur.execute("SELECT COALESCE(SUM(new_count), 0) + COALESCE(SUM(archived_count), 0) FROM ai.activity")
    changes = cur.fetchone()[0]
    cur.execute("SELECT COALESCE(SUM(new_count), 0), COALESCE(SUM(archived_count), 0) FROM ai.activity")
    new, archived = cur.fetchone()
    cur.close()
    conn.close()
    return {"changes": changes, "new": new, "archived": archived}


@app.post("/activity/clear")
async def clear_activity():
    conn = psycopg2.connect(settings.database_url)
    conn.autocommit = True
    cur = conn.cursor()
    cur.execute("DELETE FROM ai.activity")
    cur.close()
    conn.close()
    return {"cleared": True}


@app.post("/ask")
async def ask_question(req: AskRequest):
    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(None, ask, req.question, req.history)


@app.post("/upload")
async def upload_file(
    file: UploadFile = File(...),
    doc_id: str = Form(None),
    title: str = Form(None),
    doc_number: str = Form(None),
    description: str = Form(None),
):
    """Upload a custom file for a document. Replaces existing file if doc_id given."""
    from pathlib import Path
    import shutil
    root = Path(settings.watch_dir)

    if doc_id:
        doc = get_document(doc_id)
        if not doc:
            raise HTTPException(status_code=404, detail="Document not found")
        source = doc.get("source", "local")
    else:
        source = "local"

    outdir = root / source
    outdir.mkdir(parents=True, exist_ok=True)
    dest = outdir / (file.filename or "uploaded_file")

    with open(dest, "wb") as f:
        shutil.copyfileobj(file.file, f)

    conn = psycopg2.connect(settings.database_url)
    conn.autocommit = True
    cur = conn.cursor()
    now_ms = int(time.time() * 1000)

    if doc_id:
        cur.execute(
            """UPDATE ai.documents SET file_path = %s, original_filename = %s,
               file_size = %s, download_state = 'downloaded', pinned = TRUE,
               title = COALESCE(%s, title), doc_number = COALESCE(%s, doc_number),
               updated_at = %s
            WHERE id = %s""",
            (str(dest), file.filename, dest.stat().st_size,
             title or doc["title"], doc_number or doc["doc_number"],
             now_ms, doc_id)
        )
        cur.close()
        conn.close()
        return {"status": "updated", "document_id": doc_id, "file_path": str(dest)}
    else:
        cur.execute(
            """INSERT INTO ai.documents
            (id, title, doc_number, doc_type, doc_category, status, source,
             file_path, original_filename, file_size, download_state, pinned, priority,
             metadata, created_at, updated_at)
            VALUES (gen_random_uuid(), %s, %s, 'НПА', 'other', 'TRACKED', 'local',
             %s, %s, %s, 'downloaded', TRUE, 'normal',
             %s, %s, %s)""",
            (title or file.filename, doc_number,
             str(dest), file.filename, dest.stat().st_size,
             json.dumps({"description": description} if description else {}, ensure_ascii=False),
             now_ms, now_ms)
        )
        cur.close()
        conn.close()
        return {"status": "created", "file_path": str(dest)}


class BatchDeleteRequest(BaseModel):
    ids: list[str]


@app.post("/documents/batch-delete")
async def batch_delete(req: BatchDeleteRequest):
    """Delete multiple documents by IDs."""
    conn = psycopg2.connect(settings.database_url)
    conn.autocommit = True
    cur = conn.cursor()
    cur.execute(
        "DELETE FROM ai.chunks WHERE document_id = ANY(%s::uuid[])",
        (req.ids,)
    )
    cur.execute(
        "DELETE FROM ai.documents WHERE id = ANY(%s::uuid[])",
        (req.ids,)
    )
    deleted = cur.rowcount
    cur.close()
    conn.close()
    return {"deleted": deleted}


class ForgetRequest(BaseModel):
    ids: list[str]


@app.post("/documents/forget")
async def forget_documents(req: ForgetRequest):
    """User-forget documents: excluded from list and never re-created by sync."""
    conn = psycopg2.connect(settings.database_url)
    conn.autocommit = True
    cur = conn.cursor()
    cur.execute(
        "UPDATE ai.documents SET forgotten = TRUE, status = 'ARCHIVED' WHERE id = ANY(%s::uuid[])",
        (req.ids,)
    )
    updated = cur.rowcount
    cur.close()
    conn.close()
    return {"forgotten": updated}


@app.post("/documents/unforget")
async def unforget_documents(req: ForgetRequest):
    """Restore forgotten documents."""
    conn = psycopg2.connect(settings.database_url)
    conn.autocommit = True
    cur = conn.cursor()
    cur.execute(
        "UPDATE ai.documents SET forgotten = FALSE WHERE id = ANY(%s::uuid[])",
        (req.ids,)
    )
    updated = cur.rowcount
    cur.close()
    conn.close()
    return {"unforgotten": updated}


class CategoryRequest(BaseModel):
    ids: list[str]
    category: str


@app.post("/documents/category")
async def set_document_category(req: CategoryRequest):
    """Manually override category (doc_group) for one or many documents."""
    conn = psycopg2.connect(settings.database_url)
    conn.autocommit = True
    cur = conn.cursor()
    interval = {
        "laws": "weekly", "regulations": "weekly",
        "standards": "monthly", "charters": "monthly",
        "other": "monthly", "tariffs": "monthly",
    }.get(req.category, "monthly")
    cur.execute(
        "UPDATE ai.documents SET doc_category = %s, sync_interval = %s, updated_at = %s "
        "WHERE id = ANY(%s::uuid[])",
        (req.category, interval, int(time.time() * 1000), req.ids)
    )
    updated = cur.rowcount
    cur.close()
    conn.close()
    return {"updated": updated}


# ============================================================
# Diff (one-time summary, user acknowledges)
# ============================================================

@app.get("/diffs")
async def list_diffs():
    """List unacknowledged sync diffs."""
    conn = psycopg2.connect(settings.database_url)
    conn.autocommit = True
    cur = conn.cursor()
    cur.execute(
        "SELECT id, source_name, new_docs, archived_docs, created_at FROM ai.sync_diffs "
        "WHERE acknowledged_at IS NULL ORDER BY created_at DESC"
    )
    rows = cur.fetchall()
    cur.close()
    conn.close()
    return [
        {
            "id": str(r[0]), "sourceName": r[1],
            "newDocs": r[2] if isinstance(r[2], list) else (r[2] or []),
            "archivedDocs": r[3] if isinstance(r[3], list) else (r[3] or []),
            "createdAt": r[4],
        }
        for r in rows
    ]


class AckRequest(BaseModel):
    ids: list[str] = []


@app.post("/diffs/acknowledge")
async def acknowledge_diffs(req: AckRequest):
    """Acknowledge diffs (all if ids empty). Clears warnings in UI."""
    conn = psycopg2.connect(settings.database_url)
    conn.autocommit = True
    cur = conn.cursor()
    now = int(time.time() * 1000)
    if req.ids:
        cur.execute(
            "UPDATE ai.sync_diffs SET acknowledged_at = %s WHERE id = ANY(%s::uuid[]) AND acknowledged_at IS NULL",
            (now, req.ids)
        )
    else:
        cur.execute(
            "UPDATE ai.sync_diffs SET acknowledged_at = %s WHERE acknowledged_at IS NULL",
            (now,)
        )
    updated = cur.rowcount
    cur.close()
    conn.close()
    return {"acknowledged": updated}


@app.post("/documents/{doc_id}/pin")
async def pin_document(doc_id: str):
    """Pin document: lock status, prevent LLM sync from changing it."""
    conn = psycopg2.connect(settings.database_url)
    conn.autocommit = True
    cur = conn.cursor()
    cur.execute("UPDATE ai.documents SET pinned = TRUE WHERE id = %s", (doc_id,))
    cur.close()
    conn.close()
    return {"pinned": True}


class SetUrlRequest(BaseModel):
    url: str


@app.post("/documents/{doc_id}/set-url")
async def set_document_url(doc_id: str, req: SetUrlRequest):
    """Manually set a file URL for a document (for docs not found on the 5 catalog sources,
    e.g. 354-ПП from pravo.gov.ru). The file is downloaded immediately."""
    url = req.url.strip()
    if not url.startswith(("http://", "https://")):
        raise HTTPException(status_code=400, detail="invalid URL")

    conn = psycopg2.connect(settings.database_url)
    conn.autocommit = True
    cur = conn.cursor()
    cur.execute(
        "SELECT id, title, source_url FROM ai.documents WHERE id = %s", (doc_id,)
    )
    row = cur.fetchone()
    if not row:
        cur.close(); conn.close()
        raise HTTPException(status_code=404, detail="document not found")

    filename = url.rsplit("/", 1)[-1].split("?")[0] or "document.pdf"
    source_domain = url.split("/")[2].replace("www.", "")
    cur.execute(
        """UPDATE ai.documents SET
           source_url = %s, metadata = jsonb_set(COALESCE(metadata::jsonb, '{}'::jsonb), '{formats,pdf}', %s::jsonb),
           download_state = NULL, updated_at = %s
           WHERE id = %s""",
        (url, json.dumps(url), int(time.time() * 1000), doc_id)
    )
    conn.commit()
    cur.close()
    conn.close()

    # Download immediately in background (reuse downloader machinery)
    import threading
    threading.Thread(target=_download_manual, args=(doc_id, url, source_domain, filename), daemon=True).start()
    return {"status": "downloading", "url": url}


def _download_manual(doc_id: str, url: str, source: str, filename: str):
    """Download a single manually-specified file."""
    from downloader import _download_one
    from pathlib import Path
    root = Path(settings.watch_dir) / source
    root.mkdir(parents=True, exist_ok=True)
    dest = root / filename
    _download_one(doc_id, doc_id[:8], url, filename, dest, source)
async def embed_test(text: str = "тест"):
    emb = embed(text)
    return {"dimensions": len(emb), "sample": emb[:5]}


# ============================================================
# Sync (LLM-powered catalog)
# ============================================================

class SyncRequest(BaseModel):
    source_id: str | None = None


_sync_task: asyncio.Future | None = None


def _run_sync(req: SyncRequest | None):
    """Blocking sync runner (executed in thread pool)."""
    from sync_llm import sync_all, sync_single
    if req and req.source_id:
        return sync_single(req.source_id)
    return sync_all()


@app.post("/sync")
async def sync_catalog(req: SyncRequest | None = None):
    """Start sync catalog in background. Non-blocking."""
    global _sync_task
    from sync_llm import get_sync_state
    if _sync_task is not None and not _sync_task.done():
        return {"started": False, "already_running": True, **get_sync_state()}
    loop = asyncio.get_event_loop()
    _sync_task = asyncio.ensure_future(loop.run_in_executor(None, _run_sync, req))
    return {"started": True}


@app.get("/sync/state")
async def sync_state():
    """Current sync progress: running, current source, done/total."""
    from sync_llm import get_sync_state
    return get_sync_state()


@app.post("/sync/cancel")
async def sync_cancel():
    """Request cancellation of the running sync."""
    from sync_llm import request_cancel
    request_cancel()
    return {"cancelled": True}


# ============================================================
# Scheduler toggle (ENABLE_SCHEDULER in .env)
# ============================================================

import os

_ENV_PATH = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), ".env")


def _read_scheduler_flag() -> bool:
    try:
        with open(_ENV_PATH) as f:
            for line in f:
                if line.startswith("ENABLE_SCHEDULER="):
                    return line.strip().split("=", 1)[1].lower() == "true"
    except Exception:
        pass
    return bool(settings.enable_scheduler)


def _write_scheduler_flag(enabled: bool) -> None:
    try:
        with open(_ENV_PATH) as f:
            lines = f.readlines()
        found = False
        for i, line in enumerate(lines):
            if line.startswith("ENABLE_SCHEDULER="):
                lines[i] = f"ENABLE_SCHEDULER={'true' if enabled else 'false'}\n"
                found = True
                break
        if not found:
            lines.append(f"\nENABLE_SCHEDULER={'true' if enabled else 'false'}\n")
        with open(_ENV_PATH, "w") as f:
            f.writelines(lines)
        settings.enable_scheduler = enabled
    except Exception as e:
        logger.error("Failed to write ENABLE_SCHEDULER: %s", e)


class SchedulerToggle(BaseModel):
    enabled: bool


@app.get("/scheduler")
async def get_scheduler():
    return {"enabled": _read_scheduler_flag()}


@app.post("/scheduler")
async def set_scheduler(req: SchedulerToggle):
    _write_scheduler_flag(req.enabled)
    return {"enabled": req.enabled}


# ============================================================
# Sources CRUD
# ============================================================

class SourceCreate(BaseModel):
    name: str
    url: str
    doc_group: str = "laws"
    sync_interval: str = "weekly"
    crawl_depth: int = 1
    url_filter: list[str] = []


class SourceUpdate(BaseModel):
    name: str | None = None
    url: str | None = None
    doc_group: str | None = None
    sync_interval: str | None = None
    active: bool | None = None
    crawl_depth: int | None = None
    url_filter: list[str] | None = None


@app.get("/sources")
async def list_sources():
    """List all sources."""
    conn = psycopg2.connect(settings.database_url)
    conn.autocommit = True
    cur = conn.cursor()
    cur.execute(
        "SELECT id, name, url, sync_strategy, doc_group, sync_interval, active, status, last_synced_at, "
        "COALESCE(crawl_depth, 1), COALESCE(url_filter, '[]') "
        "FROM ai.sources ORDER BY name"
    )
    rows = cur.fetchall()
    cur.close()
    conn.close()
    return [
        {
            "id": r[0], "name": r[1], "url": r[2], "sync_strategy": r[3],
            "doc_group": r[4], "sync_interval": r[5], "active": r[6],
            "status": r[7], "last_synced_at": r[8], "crawl_depth": r[9],
            "url_filter": r[10],
        }
        for r in rows
    ]


@app.post("/sources")
async def create_source(req: SourceCreate):
    conn = psycopg2.connect(settings.database_url)
    conn.autocommit = True
    cur = conn.cursor()
    cur.execute(
        """INSERT INTO ai.sources (id, name, url, sync_strategy, doc_group, sync_interval, active, status, last_synced_at, crawl_depth, url_filter)
           VALUES (gen_random_uuid(), %s, %s, 'html_parse_llm', %s, %s, TRUE, 'IDLE', 0, %s, %s)""",
        (req.name, req.url, req.doc_group, req.sync_interval, req.crawl_depth,
         json.dumps(req.url_filter, ensure_ascii=False))
    )
    conn.commit()
    cur.close()
    conn.close()
    return {"created": True}


@app.put("/sources/{source_id}")
async def update_source(source_id: str, req: SourceUpdate):
    conn = psycopg2.connect(settings.database_url)
    conn.autocommit = True
    cur = conn.cursor()
    sets = []
    params = []
    if req.name is not None:
        sets.append("name = %s"); params.append(req.name)
    if req.url is not None:
        sets.append("url = %s"); params.append(req.url)
    if req.doc_group is not None:
        sets.append("doc_group = %s"); params.append(req.doc_group)
    if req.sync_interval is not None:
        sets.append("sync_interval = %s"); params.append(req.sync_interval)
    if req.active is not None:
        sets.append("active = %s"); params.append(req.active)
    if req.crawl_depth is not None:
        sets.append("crawl_depth = %s"); params.append(req.crawl_depth)
    if req.url_filter is not None:
        sets.append("url_filter = %s"); params.append(json.dumps(req.url_filter, ensure_ascii=False))
    if sets:
        params.append(source_id)
        cur.execute(f"UPDATE ai.sources SET {', '.join(sets)} WHERE id = %s", params)
        conn.commit()
    cur.close()
    conn.close()
    return {"updated": True}


@app.delete("/sources/{source_id}")
async def delete_source(source_id: str):
    conn = psycopg2.connect(settings.database_url)
    conn.autocommit = True
    cur = conn.cursor()
    cur.execute("DELETE FROM ai.sources WHERE id = %s", (source_id,))
    conn.commit()
    cur.close()
    conn.close()
    return {"deleted": True}


# ============================================================
# Catalog rules (состав НПБ — свободное редактирование)
# ============================================================

class CatalogRuleCreate(BaseModel):
    action: str  # include | exclude
    priority: int = 0
    source: str | None = None
    category: str | None = None
    doc_type: str | None = None
    doc_number: str | None = None
    title_mask: str | None = None
    comment: str | None = None


class CatalogRuleUpdate(BaseModel):
    action: str | None = None
    priority: int | None = None
    source: str | None = None
    category: str | None = None
    doc_type: str | None = None
    doc_number: str | None = None
    title_mask: str | None = None
    comment: str | None = None
    active: bool | None = None


@app.get("/catalog-rules")
async def list_catalog_rules():
    conn = psycopg2.connect(settings.database_url)
    conn.autocommit = True
    cur = conn.cursor()
    cur.execute(
        "SELECT id, action, priority, source, category, doc_type, doc_number, "
        "title_mask, comment, active, created_at FROM ai.catalog_rules ORDER BY priority DESC, created_at"
    )
    rows = cur.fetchall()
    cur.close()
    conn.close()
    return [
        {
            "id": str(r[0]), "action": r[1], "priority": r[2] or 0,
            "source": r[3], "category": r[4], "doc_type": r[5],
            "doc_number": r[6], "title_mask": r[7], "comment": r[8],
            "active": r[9], "createdAt": r[10],
        }
        for r in rows
    ]


@app.post("/catalog-rules")
async def create_catalog_rule(req: CatalogRuleCreate):
    if req.action not in ("include", "exclude"):
        raise HTTPException(status_code=400, detail="action must be include|exclude")
    conn = psycopg2.connect(settings.database_url)
    conn.autocommit = True
    cur = conn.cursor()
    cur.execute(
        """INSERT INTO ai.catalog_rules
           (id, action, priority, source, category, doc_type, doc_number, title_mask, comment, active, created_at)
           VALUES (gen_random_uuid(), %s, %s, %s, %s, %s, %s, %s, %s, TRUE, %s)""",
        (req.action, req.priority, req.source, req.category, req.doc_type,
         req.doc_number, req.title_mask, req.comment, int(time.time() * 1000))
    )
    conn.commit()
    cur.close()
    conn.close()
    return {"created": True}


@app.put("/catalog-rules/{rule_id}")
async def update_catalog_rule(rule_id: str, req: CatalogRuleUpdate):
    conn = psycopg2.connect(settings.database_url)
    conn.autocommit = True
    cur = conn.cursor()
    sets = []
    params = []
    if req.action is not None:
        if req.action not in ("include", "exclude"):
            cur.close(); conn.close()
            raise HTTPException(status_code=400, detail="action must be include|exclude")
        sets.append("action = %s"); params.append(req.action)
    if req.priority is not None:
        sets.append("priority = %s"); params.append(req.priority)
    if req.source is not None:
        sets.append("source = %s"); params.append(req.source)
    if req.category is not None:
        sets.append("category = %s"); params.append(req.category)
    if req.doc_type is not None:
        sets.append("doc_type = %s"); params.append(req.doc_type)
    if req.doc_number is not None:
        sets.append("doc_number = %s"); params.append(req.doc_number)
    if req.title_mask is not None:
        sets.append("title_mask = %s"); params.append(req.title_mask)
    if req.comment is not None:
        sets.append("comment = %s"); params.append(req.comment)
    if req.active is not None:
        sets.append("active = %s"); params.append(req.active)
    if sets:
        params.append(rule_id)
        cur.execute(f"UPDATE ai.catalog_rules SET {', '.join(sets)} WHERE id = %s", params)
        conn.commit()
    cur.close()
    conn.close()
    return {"updated": True}


@app.delete("/catalog-rules/{rule_id}")
async def delete_catalog_rule(rule_id: str):
    conn = psycopg2.connect(settings.database_url)
    conn.autocommit = True
    cur = conn.cursor()
    cur.execute("DELETE FROM ai.catalog_rules WHERE id = %s", (rule_id,))
    conn.commit()
    deleted = cur.rowcount
    cur.close()
    conn.close()
    return {"deleted": deleted}


# ============================================================
# File sources (доверенные хранилища файлов)
# ============================================================

class FileSourceCreate(BaseModel):
    domain: str
    priority: int = 100
    comment: str | None = None


class FileSourceUpdate(BaseModel):
    domain: str | None = None
    priority: int | None = None
    active: bool | None = None
    comment: str | None = None


@app.get("/file-sources")
async def list_file_sources():
    conn = psycopg2.connect(settings.database_url)
    conn.autocommit = True
    cur = conn.cursor()
    cur.execute(
        "SELECT id, domain, priority, active, comment, created_at FROM ai.file_sources "
        "ORDER BY priority ASC, domain"
    )
    rows = cur.fetchall()
    cur.close()
    conn.close()
    return [
        {
            "id": str(r[0]), "domain": r[1], "priority": r[2],
            "active": r[3], "comment": r[4], "createdAt": r[5],
        }
        for r in rows
    ]


@app.post("/file-sources")
async def create_file_source(req: FileSourceCreate):
    if not req.domain or "." not in req.domain:
        raise HTTPException(status_code=400, detail="invalid domain")
    conn = psycopg2.connect(settings.database_url)
    conn.autocommit = True
    cur = conn.cursor()
    cur.execute(
        """INSERT INTO ai.file_sources (id, domain, priority, active, comment, created_at)
           VALUES (gen_random_uuid(), %s, %s, TRUE, %s, %s)""",
        (req.domain.lower().strip(), req.priority, req.comment, int(time.time() * 1000))
    )
    conn.commit()
    cur.close()
    conn.close()
    return {"created": True}


@app.put("/file-sources/{source_id}")
async def update_file_source(source_id: str, req: FileSourceUpdate):
    conn = psycopg2.connect(settings.database_url)
    conn.autocommit = True
    cur = conn.cursor()
    sets = []
    params = []
    if req.domain is not None:
        sets.append("domain = %s"); params.append(req.domain.lower().strip())
    if req.priority is not None:
        sets.append("priority = %s"); params.append(req.priority)
    if req.active is not None:
        sets.append("active = %s"); params.append(req.active)
    if req.comment is not None:
        sets.append("comment = %s"); params.append(req.comment)
    if sets:
        params.append(source_id)
        cur.execute(f"UPDATE ai.file_sources SET {', '.join(sets)} WHERE id = %s", params)
        conn.commit()
    cur.close()
    conn.close()
    return {"updated": True}


@app.delete("/file-sources/{source_id}")
async def delete_file_source(source_id: str):
    conn = psycopg2.connect(settings.database_url)
    conn.autocommit = True
    cur = conn.cursor()
    cur.execute("DELETE FROM ai.file_sources WHERE id = %s", (source_id,))
    conn.commit()
    deleted = cur.rowcount
    cur.close()
    conn.close()
    return {"deleted": deleted}
