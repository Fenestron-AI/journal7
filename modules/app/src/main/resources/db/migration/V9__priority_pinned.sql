-- V9: Priority and pinned — user control over document status
ALTER TABLE ai.documents ADD COLUMN IF NOT EXISTS priority TEXT DEFAULT 'normal';
ALTER TABLE ai.documents ADD COLUMN IF NOT EXISTS pinned BOOLEAN DEFAULT FALSE;

COMMENT ON COLUMN ai.documents.priority IS 'suggested (LLM recommends download) or normal';
COMMENT ON COLUMN ai.documents.pinned IS 'TRUE = user locked status, LLM sync skips this document';
