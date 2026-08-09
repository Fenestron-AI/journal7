#!/usr/bin/env python3
"""Download regulatory PDFs from so-ups.ru into data/legal-docs/current/

Reads ai.documents with canonical=true and downloads PDFs for MISSING entries.
Run: cd ai-worker && PYTHONPATH=src ./venv/bin/python3 ../download_docs.py
"""

import json
import os
import sys
import time
from pathlib import Path

import httpx
from config import settings
from db import _connect

BASE = "https://www.so-ups.ru"
OUTDIR = Path(settings.watch_dir)


def main():
    conn = _connect()
    cur = conn.cursor()
    cur.execute(
        "SELECT id, doc_number, title, metadata FROM ai.documents "
        "WHERE canonical = TRUE AND status = 'MISSING' "
        "ORDER BY metadata->>'group', doc_date"
    )
    docs = cur.fetchall()
    cur.close()
    conn.close()

    print(f"Found {len(docs)} documents to download")
    if not docs:
        return

    OUTDIR.mkdir(parents=True, exist_ok=True)

    downloaded = 0
    for doc_id, doc_num, title, meta_str in docs:
        try:
            meta = json.loads(meta_str)
        except Exception:
            meta = {}
        url = meta.get("url", "")
        if not url:
            print(f"  SKIP {doc_num}: no URL")
            continue

        full_url = BASE + "/" + url.lstrip("/")
        filename = f"{doc_num.replace('/','_').replace(' ','_')}.pdf"
        dest = OUTDIR / filename

        if dest.exists():
            print(f"  SKIP {doc_num}: already exists ({dest.name})")
            continue

        print(f"  DOWNLOAD {doc_num}: {full_url}")
        try:
            resp = httpx.get(full_url, timeout=120)
            resp.raise_for_status()
            dest.write_bytes(resp.content)
            print(f"    -> {dest.name} ({len(resp.content)//1024}KB)")
            downloaded += 1
            time.sleep(1)  # be polite
        except Exception as e:
            print(f"    FAILED: {e}")

    print(f"\nDone: {downloaded} downloaded, {len(docs) - downloaded} skipped")


if __name__ == "__main__":
    main()
