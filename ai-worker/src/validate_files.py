"""
Sync DB document status with actual files on disk.
Marks DOWNLOADED docs as MISSING if their file_path doesn't exist.
"""
import json
from pathlib import Path
from config import settings
from db import _connect

def validate():
    conn = _connect()
    cur = conn.cursor()
    outdir = Path(settings.watch_dir)

    cur.execute("SELECT id, doc_number, metadata, file_path FROM ai.documents WHERE canonical = TRUE AND status = 'DOWNLOADED'")
    missing = 0
    ok = 0
    for doc_id, doc_num, meta_str, file_path in cur.fetchall():
        exists = False
        if file_path:
            if Path(file_path).exists():
                exists = True

        if not exists:
            # also try filename from metadata URL
            try:
                meta = json.loads(meta_str) if isinstance(meta_str, str) else (meta_str or {})
                url = meta.get("url", "")
                fname = url.rsplit('/', 1)[-1] if url else ""
                if fname and (outdir / fname).exists():
                    exists = True
            except Exception:
                pass

        if not exists:
            c2 = conn.cursor()
            c2.execute("UPDATE ai.documents SET status = 'MISSING' WHERE id = %s", (doc_id,))
            c2.close()
            missing += 1
        else:
            ok += 1

    conn.commit()
    cur.close()
    conn.close()
    print(f"DOWNLOAED → VALIDATED: {ok} files exist, {missing} missing → marked MISSING")

if __name__ == '__main__':
    validate()
