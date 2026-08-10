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
    chunks_with_meta = []
    for i, c in enumerate(chunks):
        meta = json_mod.dumps({"doc_number": doc.get("doc_number"), "revision": doc.get("revision")})
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
    logger.info("AI worker started. Yandex configured: %s", bool(settings.yandex_api_key))
    import threading
    def _safe_download():
        try:
            download_all()
        except Exception as e:
            logger.error("download_all crashed: %s", e, exc_info=True)
    threading.Thread(target=_safe_download, daemon=True).start()

    # Continuous file validator (5s active, 30s idle)
    from downloader import validate_files
    stop_validator = threading.Event()
    def _validator_loop():
        while not stop_validator.is_set():
            try:
                validate_files()
            except Exception:
                pass
            import psycopg2
            try:
                conn = psycopg2.connect(settings.database_url)
                cur = conn.cursor()
                cur.execute("SELECT count(*) FROM ai.documents WHERE status IN ('DOWNLOADING','MISSING')")
                active = cur.fetchone()[0] > 0
                cur.close()
                conn.close()
            except Exception:
                active = False
            stop_validator.wait(5 if active else 30)
    threading.Thread(target=_validator_loop, daemon=True).start()

    yield
    stop_validator.set()
    logger.info("AI worker stopped")


app = FastAPI(title="journal7 AI Worker", version="0.1.0", lifespan=lifespan)


@app.get("/health", response_model=HealthResponse)
async def health():
    return HealthResponse(
        status="ok",
        yandex_configured=bool(settings.yandex_api_key and settings.yandex_folder_id),
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
        "DELETE FROM ai.chunks WHERE document_id = ANY(%s)",
        (req.ids,)
    )
    cur.execute(
        "DELETE FROM ai.documents WHERE id = ANY(%s)",
        (req.ids,)
    )
    deleted = cur.rowcount
    cur.close()
    conn.close()
    return {"deleted": deleted}


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
async def embed_test(text: str = "тест"):
    emb = embed(text)
    return {"dimensions": len(emb), "sample": emb[:5]}


# ============================================================
# Sync (LLM-powered catalog)
# ============================================================

class SyncRequest(BaseModel):
    source_id: str | None = None


@app.post("/sync")
async def sync_catalog(req: SyncRequest | None = None):
    """Sync catalog: all sources or a single one."""
    loop = asyncio.get_event_loop()
    try:
        if req and req.source_id:
            return await loop.run_in_executor(None, sync_single, req.source_id)
        return await loop.run_in_executor(None, sync_all)
    except Exception as e:
        logger.exception("Sync failed")
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================
# Sources CRUD
# ============================================================

class SourceCreate(BaseModel):
    name: str
    url: str
    doc_group: str = "laws"
    sync_interval: str = "weekly"


class SourceUpdate(BaseModel):
    name: str | None = None
    url: str | None = None
    doc_group: str | None = None
    sync_interval: str | None = None
    active: bool | None = None


@app.get("/sources")
async def list_sources():
    """List all sources."""
    conn = psycopg2.connect(settings.database_url)
    conn.autocommit = True
    cur = conn.cursor()
    cur.execute(
        "SELECT id, name, url, sync_strategy, doc_group, sync_interval, active, status, last_synced_at "
        "FROM ai.sources ORDER BY name"
    )
    rows = cur.fetchall()
    cur.close()
    conn.close()
    return [
        {
            "id": r[0], "name": r[1], "url": r[2], "sync_strategy": r[3],
            "doc_group": r[4], "sync_interval": r[5], "active": r[6],
            "status": r[7], "last_synced_at": r[8],
        }
        for r in rows
    ]


@app.post("/sources")
async def create_source(req: SourceCreate):
    conn = psycopg2.connect(settings.database_url)
    conn.autocommit = True
    cur = conn.cursor()
    cur.execute(
        """INSERT INTO ai.sources (id, name, url, sync_strategy, doc_group, sync_interval, active, status, last_synced_at)
           VALUES (gen_random_uuid(), %s, %s, 'html_parse_llm', %s, %s, TRUE, 'IDLE', 0)""",
        (req.name, req.url, req.doc_group, req.sync_interval)
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
