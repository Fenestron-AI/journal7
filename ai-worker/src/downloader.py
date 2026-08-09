"""Background downloader: downloads PDFs from so-ups.ru one-by-one,
updates document status, then triggers ingestion."""

import json
import logging
import time
from pathlib import Path

import httpx

from config import settings
from db import get_document, set_document_status, _connect

logger = logging.getLogger("downloader")


def download_all():
    """Download all MISSING documents with URLs, one by one."""
    conn = _connect()
    cur = conn.cursor()
    cur.execute(
        "SELECT id, doc_number, metadata FROM ai.documents "
        "WHERE canonical = TRUE AND status = 'MISSING' AND metadata::jsonb->>'url' IS NOT NULL "
        "ORDER BY doc_date"
    )
    rows = cur.fetchall()
    cur.close()
    conn.close()

    logger.info("Found %d documents to download", len(rows))
    outdir = Path(settings.watch_dir)
    outdir.mkdir(parents=True, exist_ok=True)

    total = len(rows)
    downloaded = 0
    for i, (doc_id, doc_num, meta_str) in enumerate(rows):
        try:
            meta = json.loads(meta_str)
        except Exception:
            meta = {}
        url = meta.get("url", "")
        if not url:
            set_document_status(doc_id, "MISSING")
            continue

        filename = f"{doc_num.replace('/','_').replace(' ','_')}.pdf"
        dest = outdir / filename

        # Already downloaded?
        if dest.exists() and dest.stat().st_size > 1000:
            set_document_status(doc_id, "DOWNLOADED", 0)
            downloaded += 1
            continue

        # Start download
        set_document_status(doc_id, "DOWNLOADING")
        logger.info("[%d/%d] Downloading %s: %s", i + 1, total, doc_num, url)

        try:
            resp = httpx.get(url, timeout=300, follow_redirects=True)
            resp.raise_for_status()
            dest.write_bytes(resp.content)
            size_kb = len(resp.content) // 1024
            set_document_status(doc_id, "DOWNLOADED", 0)
            logger.info("[%d/%d] OK %s (%dKB)", i + 1, total, filename, size_kb)

            # Update file_path in DB so watcher/UI can pick it up
            conn2 = _connect()
            cur2 = conn2.cursor()
            cur2.execute(
                "UPDATE ai.documents SET file_path = %s WHERE id = %s",
                (str(dest), doc_id),
            )
            conn2.commit()
            cur2.close()
            conn2.close()

            downloaded += 1
            time.sleep(1.5)  # rate limit
        except Exception as e:
            logger.error("[%d/%d] FAILED %s: %s", i + 1, total, doc_num, e)
            set_document_status(doc_id, "ERROR", 0)
    logger.info("Done: %d/%d downloaded", downloaded, total)
    return {"total": total, "downloaded": downloaded}
