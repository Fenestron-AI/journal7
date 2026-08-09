-- Journal7 v0.1.0 → V3: AI legal knowledge base
-- Schema: ai (documents, chunks)

CREATE EXTENSION IF NOT EXISTS vector;

CREATE SCHEMA IF NOT EXISTS ai;

-- ============================================================
-- Documents (нормативно-правовая база)
-- ============================================================
CREATE TABLE ai.documents (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title       TEXT NOT NULL,
    doc_number  TEXT,
    doc_date    TEXT,
    revision    TEXT,
    doc_type    TEXT NOT NULL DEFAULT 'НПА',
    status      TEXT NOT NULL DEFAULT 'active',
    file_path   TEXT,
    file_hash   TEXT,
    chunk_count INTEGER NOT NULL DEFAULT 0,
    metadata    TEXT NOT NULL DEFAULT '{}',
    created_at  BIGINT NOT NULL DEFAULT 0,
    updated_at  BIGINT NOT NULL DEFAULT 0
);

CREATE INDEX idx_ai_documents_status ON ai.documents(status);
CREATE INDEX idx_ai_documents_number ON ai.documents(doc_number);

-- ============================================================
-- Chunks (чанки с эмбеддингами)
-- ============================================================
CREATE TABLE ai.chunks (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID NOT NULL REFERENCES ai.documents(id) ON DELETE CASCADE,
    chunk_index INTEGER NOT NULL,
    content     TEXT NOT NULL,
    embedding   vector,
    metadata    TEXT NOT NULL DEFAULT '{}',
    UNIQUE (document_id, chunk_index)
);

-- HNSW index will be created in V4 after seed data
-- CREATE INDEX idx_ai_chunks_embedding ON ai.chunks ...

-- ============================================================
-- Notifications (уведомления о новых редакциях)
-- ============================================================
CREATE TABLE ai.notifications (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    doc_number  TEXT NOT NULL,
    title       TEXT NOT NULL,
    message     TEXT NOT NULL,
    read        BOOLEAN NOT NULL DEFAULT FALSE,
    created_at  BIGINT NOT NULL DEFAULT 0
);

CREATE INDEX idx_ai_notifications_read ON ai.notifications(read);
