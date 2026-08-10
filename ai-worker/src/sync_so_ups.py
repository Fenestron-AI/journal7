"""Sync with so-ups.ru: parse HTML, compare with DB, auto-download changes."""

import json
import logging
import os
import re
import shutil
import time
from pathlib import Path
from urllib.parse import urljoin

import httpx

from config import settings
from db import _connect

logger = logging.getLogger("sync-so-ups")

BASE = "https://www.so-ups.ru"
PAGE_URL = "https://www.so-ups.ru/functioning/laws/"
WATCH_DIR = Path(settings.watch_dir)


def sync_so_ups():
    """Full sync cycle: parse → compare → download → verify."""
    logger.info("=== Sync so-ups.ru started ===")

    conn = _connect()
    cur = conn.cursor()

    # Update source status
    cur.execute("UPDATE ai.sources SET status = 'SYNCING' WHERE sync_strategy = 'html_parse_so_ups'")
    conn.commit()

    # 1. Parse the page
    documents = _parse_page(cur)
    if not documents:
        cur.execute("UPDATE ai.sources SET status = 'ERROR', last_synced_at = %s WHERE sync_strategy = 'html_parse_so_ups'", (int(time.time() * 1000),))
        conn.commit()
        cur.close()
        conn.close()
        logger.error("Failed to parse page")
        return {"error": "parse_failed"}

    # 2. Compare with DB and update
    stats = _sync_documents(cur, documents)

    # 3. Detect files removed from source → ARCHIVED
    _archive_removed(cur, documents)

    # 4. Detect files in watch dir without DB entry → add as local
    _detect_local_files(cur)

    # 5. Verify existing files on disk
    _verify_files(cur)

    now_ms = int(time.time() * 1000)
    cur.execute("UPDATE ai.sources SET status = 'IDLE', last_synced_at = %s WHERE sync_strategy = 'html_parse_so_ups'", (now_ms,))
    conn.commit()
    cur.close()
    conn.close()

    logger.info("=== Sync done: %s ===", stats)
    return stats


def _parse_page(cur) -> list[dict]:
    """Fetch and parse so-ups.ru page. Returns list of {group, title, doc_number, doc_date,
    revision, doc_type, url, filename, size_kb, sort_order}."""
    try:
        resp = httpx.get(PAGE_URL, timeout=30, follow_redirects=True)
        resp.raise_for_status()
    except Exception as e:
        logger.error("Failed to fetch page: %s", e)
        return []

    html = resp.text
    docs = []
    sort_order = 0

    # Split by section headers: <h3 class="header">Section Name</h3>
    sections = re.split(r'<h3 class="header">(.*?)</h3>', html)
    current_group = None

    for section in sections:
        # This is alternating: section_name, section_html, section_name, ...
        if current_group is None:
            current_group = section.strip()
            if current_group == "Архив нормативно-правовой базы":
                current_group = None  # skip archive link
            continue

        group = current_group
        current_group = section.strip()  # next section name
        if not group:
            continue

        # Extract document links + descriptions from this section
        # Structure: <li class="download pdf"> <a href="...">label</a> <div class="info">description</div> <span>size</span> </li>
        for li_match in re.finditer(
            r'<li[^>]*class="download pdf[^"]*"[^>]*>(.*?)</li>',
            section if isinstance(section, str) else "",
            re.DOTALL
        ):
            li_html = li_match.group(1)
            
            # Extract <a> link
            a_match = re.search(r'<a[^>]*href="([^"]*\.pdf)"[^>]*>(.*?)</a>', li_html, re.DOTALL)
            if not a_match:
                continue
            
            url = urljoin(BASE, a_match.group(1))
            label = re.sub(r'<[^>]+>', '', a_match.group(2)).strip()
            filename = os.path.basename(a_match.group(1))
            
            # Extract <div class="info"> description
            info_match = re.search(r'<div class="info">(.*?)</div>', li_html, re.DOTALL)
            description = re.sub(r'<[^>]+>', '', info_match.group(1)).strip() if info_match else ""
            
            # Extract <span> size
            span_match = re.search(r'<span>(\d+\s*[кМ]Б)</span>', li_html)
            size_str = span_match.group(1) if span_match else ""
            
            # Build full title
            if label and description:
                title_clean = f"{label} — {description}"
            elif label:
                title_clean = label
            elif description:
                title_clean = description
            else:
                title_clean = filename
            
            # Parse size
            size_kb = 0
            sm = re.search(r'(\d+)\s*кБ', size_str)
            if sm:
                size_kb = int(sm.group(1))
            sm = re.search(r'(\d+)\s*МБ', size_str)
            if sm:
                size_kb = int(sm.group(1)) * 1024
            
            # Number
            doc_number = None
            nm = re.search(r'[N№]\s*(\d+(?:[-/]\S+)?)', label + ' ' + description, re.IGNORECASE)
            if nm:
                doc_number = nm.group(1)
            
            # Date from label: "от ДД.ММ.ГГГГ"
            doc_date = None
            dm = re.search(r'от\s+(\d{2}\.\d{2}\.\d{4})', label)
            if dm:
                doc_date = dm.group(1)
            
            # Revision: from description or label
            revision = None
            rm = re.search(r'ред[а-я]*[.:]\s*от\s+(\d{2}\.\d{2}\.\d{4})', description, re.IGNORECASE)
            if rm:
                revision = rm.group(1)
            if not revision and 'В редакции от' in description:
                rm2 = re.search(r'В\s+редакции\s+от\s+(\d{2}\.\d{2}\.\d{4})', description, re.IGNORECASE)
                if rm2:
                    revision = rm2.group(1)
            
            # Doc type from group name
            if "едераль" in group:
                doc_type = "ФЗ"
            elif "инэнерго" in group.lower():
                doc_type = "Приказ Минэнерго"
            elif "ФАС" in group or "ФСТ" in group:
                doc_type = "Приказ ФАС/ФСТ"
            else:
                doc_type = "ПП РФ"
            
            priority = bool(doc_number and doc_number in ["442", "1178", "861", "1172", "24", "35-ФЗ", "135-ФЗ"])
            
            sort_order += 1
            docs.append({
                "group": group.strip(),
                "title": title_clean,
                "doc_number": doc_number,
                "doc_date": doc_date,
                "revision": revision,
                "doc_type": doc_type,
                "url": url,
                "filename": filename,
                "size_kb": size_kb,
                "sort_order": sort_order,
                "priority": priority,
            })

    logger.info("Parsed %d documents from %s", len(docs), PAGE_URL)
    return docs


def _sync_documents(cur, documents: list[dict]) -> dict:
    """Compare parsed docs with DB. Insert new, update existing, detect changes."""
    new_count = 0
    updated_count = 0
    skipped_count = 0

    for doc in documents:
        # Find existing by doc_number AND source
        if doc["doc_number"]:
            cur.execute(
                "SELECT id, revision, status, file_path FROM ai.documents "
                "WHERE doc_number = %s AND source = 'so-ups.ru' AND status NOT IN ('ARCHIVED','OUTDATED')",
                (doc["doc_number"],)
            )
            existing = cur.fetchone()
        else:
            # Match by filename
            cur.execute(
                "SELECT id, revision, status, file_path FROM ai.documents "
                "WHERE original_filename = %s AND source = 'so-ups.ru'",
                (doc["filename"],)
            )
            existing = cur.fetchone()

        if existing:
            # Update metadata
            cur.execute(
                """UPDATE ai.documents SET
                    title = %s, revision = %s, doc_date = %s, doc_type = %s,
                    sort_order = %s, source_url = %s, original_filename = %s,
                    metadata = %s, last_checked_at = %s
                WHERE id = %s""",
                (doc["title"], doc["revision"], doc["doc_date"], doc["doc_type"],
                 doc["sort_order"], doc["url"], doc["filename"],
                 json.dumps({"group": doc["group"], "priority": "high" if doc["priority"] else "normal", "size_kb": doc["size_kb"]}, ensure_ascii=False),
                 int(time.time() * 1000),
                 existing[0]),
            )
            updated_count += 1
        else:
            # New document
            cur.execute(
                """INSERT INTO ai.documents
                (id, title, doc_number, doc_date, revision, doc_type, status,
                 source, source_url, original_filename, sort_order,
                 metadata, created_at, updated_at, last_checked_at)
                VALUES (gen_random_uuid(), %s, %s, %s, %s, %s, 'TRACKED',
                 'so-ups.ru', %s, %s, %s,
                 %s, %s, %s, %s)""",
                (doc["title"], doc["doc_number"], doc["doc_date"], doc["revision"],
                 doc["doc_type"], doc["url"], doc["filename"],
                 doc["sort_order"],
                 json.dumps({"group": doc["group"], "priority": "high" if doc["priority"] else "normal", "size_kb": doc["size_kb"]}, ensure_ascii=False),
                 int(time.time() * 1000), int(time.time() * 1000),
                 int(time.time() * 1000)),
            )
            new_count += 1

    conn = cur.connection
    conn.commit()
    return {"new": new_count, "updated": updated_count, "skipped": 0}


def _archive_removed(cur, documents: list[dict]):
    """Mark documents in DB that are NOT on the source page as ARCHIVED."""
    # Get all doc_numbers from so-ups.ru in DB
    cur.execute(
        "SELECT id, doc_number FROM ai.documents "
        "WHERE source = 'so-ups.ru' AND status NOT IN ('ARCHIVED')"
    )
    db_docs = {r[1]: r[0] for r in cur.fetchall() if r[1]}

    page_nums = {d["doc_number"] for d in documents if d["doc_number"]}

    archived = 0
    for doc_num, doc_id in db_docs.items():
        if doc_num not in page_nums:
            cur.execute(
                "UPDATE ai.documents SET status = 'ARCHIVED' WHERE id = %s",
                (doc_id,)
            )
            archived += 1
            logger.info("ARCHIVED: %s", doc_num)

    if archived:
        cur.connection.commit()
        logger.info("Archived %d removed documents", archived)


def _detect_local_files(cur):
    """Find files in watch dir not linked to any DB document."""
    WATCH_DIR.mkdir(parents=True, exist_ok=True)
    conn = cur.connection

    # Get all known file paths
    cur.execute("SELECT file_path FROM ai.documents WHERE file_path IS NOT NULL")
    known = {r[0] for r in cur.fetchall()}

    local_count = 0
    for filepath in WATCH_DIR.iterdir():
        if not filepath.is_file() or filepath.suffix.lower() not in ('.pdf', '.rtf', '.docx', '.txt'):
            continue
        abs_path = str(filepath)
        if abs_path in known:
            continue

        # Check if already has DB entry by filename
        cur.execute(
            "SELECT id FROM ai.documents WHERE original_filename = %s AND source = 'local'",
            (filepath.name,)
        )
        if cur.fetchone():
            continue

        # Create local entry
        cur.execute(
            """INSERT INTO ai.documents
            (id, title, doc_number, status, source, file_path, original_filename,
             file_size, canonical, metadata, created_at, updated_at)
            VALUES (gen_random_uuid(), %s, NULL, 'DOWNLOADED', 'local', %s, %s,
             %s, FALSE,
             %s, %s, %s)""",
            (filepath.stem.replace('_', ' '), abs_path, filepath.name,
             filepath.stat().st_size,
             json.dumps({"group": "Другие файлы"}, ensure_ascii=False),
             int(time.time() * 1000), int(time.time() * 1000)),
        )
        local_count += 1

    if local_count:
        conn.commit()
        logger.info("Added %d local files", local_count)


def _verify_files(cur):
    """Check that DOWNLOADED/ACTIVE documents have files on disk."""
    cur.execute(
        "SELECT id, file_path FROM ai.documents "
        "WHERE status IN ('DOWNLOADED', 'ACTIVE') AND file_path IS NOT NULL AND source != 'local'"
    )
    missing_count = 0
    for doc_id, file_path in cur.fetchall():
        if not file_path or not os.path.exists(file_path) or os.path.getsize(file_path) < 100:
            cur.execute("UPDATE ai.documents SET download_state = NULL WHERE id = %s", (doc_id,))
            missing_count += 1
            logger.info("File missing, reset download_state: %s", file_path)

    if missing_count:
        cur.connection.commit()
        logger.info("Reset %d documents download_state (file not found)", missing_count)
