"""Resumable parallel downloader for so-ups.ru regulatory documents.

Features:
- Resume: restart stuck DOWNLOADING → MISSING on startup
- 2 parallel threads with work queue
- Exponential retry (3 attempts: 5s, 15s, 45s)
- Streaming download (Content-Length for progress)
- 120s per-file timeout, 3s inter-request delay
- Thread-safe DB via separate connections
"""

import json
import logging
import os
import queue
import threading
import time
from pathlib import Path

import httpx

from config import settings
from db import set_document_status, _connect

logger = logging.getLogger("downloader")

MAX_RETRIES = 3
RETRY_DELAYS = [5, 15, 45]
TIMEOUT = 120
WORKERS = 2
DELAY_BETWEEN = 3.0

_request_lock = threading.Lock()
_next_request = 0.0
_paused = threading.Event()
_paused.set()  # not paused by default


def _rate_limit():
    global _next_request
    with _request_lock:
        now = time.time()
        wait = _next_request - now
        if wait > 0:
            time.sleep(min(wait, 1.0))  # check pause every 1s
        _next_request = time.time() + DELAY_BETWEEN


def pause():
    _paused.clear()


def resume():
    _paused.set()


def is_paused():
    return not _paused.is_set()


def _reset_stuck():
    conn = _connect()
    cur = conn.cursor()
    cur.execute("UPDATE ai.documents SET download_state = NULL WHERE download_state = 'downloading'")
    count = cur.rowcount
    conn.commit()
    cur.close()
    conn.close()
    if count:
        logger.info("Reset %d stuck downloading", count)


def _mark_downloaded(doc_id: str, filepath: str, source: str):
    conn = _connect()
    cur = conn.cursor()
    cur.execute("UPDATE ai.documents SET status = 'TRACKED', download_state = 'downloaded', file_path = %s, source = %s WHERE id = %s", (filepath, source, doc_id))
    conn.commit()
    cur.close()
    conn.close()


def _download_one(doc_id: str, doc_num: str, url: str, filename: str, dest: Path, source: str) -> bool:
    for attempt in range(MAX_RETRIES):
        try:
            _rate_limit()
            logger.info("[%s] Download (attempt %d/%d)...", doc_num, attempt + 1, MAX_RETRIES)
            with httpx.stream("GET", url, timeout=TIMEOUT, follow_redirects=True) as resp:
                resp.raise_for_status()
                downloaded = 0
                with open(dest, "wb") as f:
                    for chunk in resp.iter_bytes(chunk_size=65536):
                        f.write(chunk)
                        downloaded += len(chunk)
                logger.info("[%s] OK: %dKB", doc_num, downloaded // 1024)
            _mark_downloaded(doc_id, str(dest), source)
            return True
        except httpx.HTTPStatusError as e:
            if e.response.status_code == 404:
                logger.warning("[%s] 404 Not Found (skip)", doc_num)
                set_document_status(doc_id, "TRACKED", download_state="error")
                return False
            logger.warning("[%s] HTTP %d (att %d)", doc_num, e.response.status_code, attempt + 1)
        except Exception as e:
            logger.warning("[%s] %s (att %d)", doc_num, type(e).__name__, attempt + 1)
        if dest.exists():
            os.remove(dest)
        if attempt < MAX_RETRIES - 1:
            delay = RETRY_DELAYS[attempt]
            logger.info("[%s] Retry in %ds...", doc_num, delay)
            time.sleep(delay)
            _paused.wait()
    set_document_status(doc_id, "TRACKED", download_state="error")
    return False


def validate_files():
    """Check all docs with download_state='downloaded', mark missing files."""
    conn = _connect()
    root = Path(settings.watch_dir)
    cur = conn.cursor()
    try:
        cur.execute("SELECT id, doc_number, file_path, metadata, source FROM ai.documents WHERE download_state = 'downloaded'")
        for doc_id, doc_num, file_path, meta_str, db_source in cur.fetchall():
            exists = False
            if file_path and Path(file_path).exists():
                exists = True
            if not exists and meta_str:
                try:
                    meta = json.loads(meta_str) if isinstance(meta_str, str) else (meta_str or {})
                    src = meta.get("source") or db_source or "so-ups"
                    preferred = meta.get("preferred_url") or meta.get("url", "")
                    fname = preferred.rsplit('/', 1)[-1] if preferred else ""
                    if fname:
                        for fmt_url in meta.get("formats", {}).values():
                            fn = fmt_url.rsplit('/', 1)[-1] if isinstance(fmt_url, str) else ""
                            if fn and (root / src / fn).exists():
                                exists = True
                                break
                        if not exists and (root / src / fname).exists():
                            exists = True
                except Exception:
                    pass
            if not exists:
                c2 = conn.cursor()
                c2.execute("UPDATE ai.documents SET download_state = NULL WHERE id = %s", (doc_id,))
                c2.close()
        conn.commit()
    finally:
        cur.close()
        conn.close()


def download_all():
    _reset_stuck()

    root = Path(settings.watch_dir)
    root.mkdir(parents=True, exist_ok=True)
    conn = _connect()
    cur = conn.cursor()

    # Validate: mark TRACKED+downloaded docs as no-download-state if file doesn't exist
    cur.execute("SELECT id, doc_number, metadata, file_path FROM ai.documents WHERE download_state = 'downloaded'")
    for doc_id, doc_num, meta_str, file_path in cur.fetchall():
        if file_path:
            dest = Path(file_path)
        else:
            try:
                meta = json.loads(meta_str) if isinstance(meta_str, str) else meta_str or {}
                url = meta.get("preferred_url") or meta.get("url", "")
                src = meta.get("source") or "so-ups"
                fname = url.rsplit('/', 1)[-1] if url else f"{doc_num.replace('/','_').replace(' ','_')}.pdf"
            except Exception:
                fname = f"{doc_num.replace('/','_').replace(' ','_')}.pdf"
                src = "so-ups"
            dest = root / src / fname
        if not dest.exists() or dest.stat().st_size < 1000:
            cur2 = conn.cursor()
            cur2.execute("UPDATE ai.documents SET download_state = NULL WHERE id = %s", (doc_id,))
            cur2.close()
    conn.commit()

    # Get TRACKED docs with no download_state to download
    cur.execute(
        "SELECT d.id, d.doc_number, d.metadata, d.source FROM ai.documents d "
        "WHERE d.status = 'TRACKED' AND (d.download_state IS NULL OR d.download_state = 'error') "
        "AND (d.metadata::jsonb->>'preferred_url' IS NOT NULL OR d.source_url IS NOT NULL) "
        "ORDER BY d.metadata::jsonb->>'priority' DESC, d.doc_date"
    )
    rows = cur.fetchall()
    cur.close()
    conn.close()

    if not rows:
        logger.info("No documents to download")
        return {"total": 0, "downloaded": 0, "failed": 0}

    logger.info("Download %d documents (%d workers)", len(rows), WORKERS)

    q: queue.Queue = queue.Queue()
    for doc_id, doc_num, meta_str, db_source in rows:
        try:
            meta = json.loads(meta_str)
        except Exception:
            meta = {}
        url = meta.get("preferred_url") or meta.get("url") or ""
        if not url:
            continue
        source = meta.get("source") or db_source or "so-ups"
        outdir = root / source
        outdir.mkdir(parents=True, exist_ok=True)
        filename = url.rsplit('/', 1)[-1] if '/' in url else f"{doc_num}.pdf"
        dest = outdir / filename
        set_document_status(doc_id, "TRACKED", download_state="downloading")
        q.put((doc_id, doc_num, url, filename, dest, source))

    success = 0
    failed = 0
    lock = threading.Lock()

    def worker():
        nonlocal success, failed
        while not q.empty():
            _paused.wait()
            try:
                task = q.get_nowait()
            except queue.Empty:
                break
            doc_id, doc_num, url, filename, dest, source = task
            if _download_one(doc_id, doc_num, url, filename, dest, source):
                with lock:
                    success += 1
            else:
                with lock:
                    failed += 1
            q.task_done()

    threads = []
    for _ in range(WORKERS):
        t = threading.Thread(target=worker, daemon=True)
        t.start()
        threads.append(t)

    # Background validation thread (runs regardless of pause)
    stop_validate = threading.Event()
    def validator():
        while not stop_validate.wait(10):  # every 10 seconds
            try:
                validate_files()
            except Exception:
                pass
    vt = threading.Thread(target=validator, daemon=True)
    vt.start()

    for t in threads:
        t.join()

    stop_validate.set()
    validate_files()  # final pass

    logger.info("Done: %d OK, %d failed", success, failed)
    return {"total": len(rows), "downloaded": success, "failed": failed}

