"""FastAPI entrypoint for journal7 AI worker."""

import asyncio
import json
import logging
import uuid
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

from config import settings
from db import delete_chunks, get_document, insert_chunks, set_document_status, store_embedding
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
    set_document_status(document_id, "PROCESSING")

    # 1. Parse
    text = extract_text(file_path)
    if not text.strip():
        set_document_status(document_id, "ERROR")
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

    set_document_status(document_id, "ACTIVE", len(chunks))
    logger.info("Done: %d chunks for %s", len(chunks), doc["title"])
    return {"taskId": str(uuid.uuid4()), "status": "done", "chunks": len(chunks)}


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("AI worker started. Yandex configured: %s", bool(settings.yandex_api_key))
    yield
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


@app.post("/ask")
async def ask_question(req: AskRequest):
    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(None, ask, req.question, req.history)


@app.post("/embed-test")
async def embed_test(text: str = "тест"):
    emb = embed(text)
    return {"dimensions": len(emb), "sample": emb[:5]}
