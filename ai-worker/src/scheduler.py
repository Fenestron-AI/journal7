"""Independent scheduler: periodically syncs sources due by their interval.

Runs as a separate process (NOT inside uvicorn) so it survives worker restarts.
Loop every 60s; a source is due when (now - last_synced) >= interval.

Usage:
    PYTHONPATH=src ./venv/bin/python3 -m scheduler
"""

import json
import logging
import sys
import time

from config import settings
from db import _connect
from sync_llm import sync_single

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(name)s %(message)s")
logger = logging.getLogger("scheduler")

CHECK_INTERVAL = 60          # seconds between scans
INTERVAL_SECONDS = {
    "daily": 86400,
    "weekly": 604800,
    "monthly": 2592000,
}


def due_sources() -> list[tuple]:
    conn = _connect()
    cur = conn.cursor()
    now_s = int(time.time())
    cur.execute(
        "SELECT id, name, sync_interval, last_synced_at FROM ai.sources "
        "WHERE active = TRUE AND sync_strategy = 'html_parse_llm'"
    )
    due = []
    for src_id, name, interval, last_synced in cur.fetchall():
        last_s = (last_synced or 0) // 1000
        threshold = INTERVAL_SECONDS.get(interval, INTERVAL_SECONDS["monthly"])
        if (now_s - last_s) >= threshold:
            due.append((src_id, name))
    cur.close()
    conn.close()
    return due


def run_cycle():
    due = due_sources()
    if not due:
        return
    logger.info("Due sources: %s", ", ".join(name for _, name in due))
    for src_id, name in due:
        logger.info("=== Scheduler sync: %s ===", name)
        try:
            result = sync_single(src_id)
            logger.info("Scheduler sync %s done: %s", name, json.dumps(result, ensure_ascii=False)[:300])
        except Exception as e:
            logger.error("Scheduler sync %s failed: %s", name, e, exc_info=True)


def main():
    if not settings.enable_scheduler:
        logger.info("Scheduler disabled (ENABLE_SCHEDULER=false). Exiting.")
        sys.exit(0)
    logger.info("Scheduler started (check every %ds)", CHECK_INTERVAL)
    while True:
        try:
            run_cycle()
        except Exception as e:
            logger.error("Scheduler cycle failed: %s", e, exc_info=True)
        time.sleep(CHECK_INTERVAL)


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        logger.info("Scheduler stopped")
        sys.exit(0)
