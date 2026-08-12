"""Database operations via psycopg2 (one connection per operation to avoid aborted-transaction state)."""

import json

import psycopg2

from config import settings


def _connect():
    conn = psycopg2.connect(settings.database_url)
    conn.autocommit = True
    return conn


def get_document(doc_id: str) -> dict | None:
    conn = _connect()
    try:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT id, title, doc_number, doc_date, revision, status, file_path FROM ai.documents WHERE id = %s",
                (doc_id,),
            )
            row = cur.fetchone()
            if not row:
                return None
            return {
                "id": row[0], "title": row[1], "doc_number": row[2],
                "doc_date": row[3], "revision": row[4], "status": row[5],
                "file_path": row[6],
            }
    finally:
        conn.close()


def set_document_status(doc_id: str, status: str, chunk_count: int = 0, download_state: str | None = None, processing_state: str | None = None):
    conn = _connect()
    try:
        with conn.cursor() as cur:
            if download_state is not None:
                cur.execute(
                    "UPDATE ai.documents SET status = %s, chunk_count = %s, download_state = %s WHERE id = %s",
                    (status, chunk_count, download_state, doc_id),
                )
            elif processing_state is not None:
                cur.execute(
                    "UPDATE ai.documents SET status = %s, chunk_count = %s, processing_state = %s WHERE id = %s",
                    (status, chunk_count, processing_state, doc_id),
                )
            else:
                cur.execute(
                    "UPDATE ai.documents SET status = %s, chunk_count = %s WHERE id = %s",
                    (status, chunk_count, doc_id),
                )
    finally:
        conn.close()


def delete_chunks(doc_id: str):
    conn = _connect()
    try:
        with conn.cursor() as cur:
            cur.execute("DELETE FROM ai.chunks WHERE document_id = %s", (doc_id,))
    finally:
        conn.close()


def insert_chunks(doc_id: str, chunks: list[tuple[str, str]]):
    """chunks: list of (content, metadata_json_string)"""
    conn = _connect()
    try:
        with conn.cursor() as cur:
            for idx, (content, meta_str) in enumerate(chunks):
                cur.execute(
                    "INSERT INTO ai.chunks (id, document_id, chunk_index, content, metadata) "
                    "VALUES (gen_random_uuid(), %s, %s, %s, %s)",
                    (doc_id, idx, content, meta_str),
                )
    finally:
        conn.close()


def store_embedding(doc_id: str, chunk_index: int, embedding: list[float]):
    vec = "[" + ",".join(f"{v:.8f}" for v in embedding) + "]"
    conn = _connect()
    try:
        with conn.cursor() as cur:
            cur.execute(
                "UPDATE ai.chunks SET embedding = %s::vector WHERE document_id = %s AND chunk_index = %s",
                (vec, doc_id, chunk_index),
            )
    finally:
        conn.close()


def search(query_embedding: list[float], limit: int) -> list[dict]:
    vec = "[" + ",".join(f"{v:.8f}" for v in query_embedding) + "]"
    conn = _connect()
    try:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT c.id, c.document_id, c.chunk_index, c.content,
                       1 - (c.embedding <=> %s::vector) AS score,
                       d.title, d.doc_number, c.metadata
                FROM ai.chunks c
                JOIN ai.documents d ON d.id = c.document_id
                WHERE c.embedding IS NOT NULL
                  AND d.status = 'INGESTED'
                ORDER BY c.embedding <=> %s::vector
                LIMIT %s
                """,
                (vec, vec, limit),
            )
            rows = cur.fetchall()
        return [
            {
                "chunk_id": r[0], "document_id": str(r[1]), "chunk_index": r[2],
                "content": r[3], "score": float(r[4]), "title": r[5], "doc_number": r[6],
                "metadata": json.loads(r[7]) if r[7] else {},
            }
            for r in rows
        ]
    finally:
        conn.close()
