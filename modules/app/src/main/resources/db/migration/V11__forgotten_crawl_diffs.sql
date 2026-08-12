-- V11: Forgotten docs, crawl config, sync diffs — full catalog + user control

-- User can forget a document: it won't be shown or re-created by sync
ALTER TABLE ai.documents ADD COLUMN IF NOT EXISTS forgotten BOOLEAN DEFAULT FALSE;
COMMENT ON COLUMN ai.documents.forgotten IS 'TRUE = user chose to forget; sync skips and never re-creates';

-- Source ownership: archive detection must be per-source, not per-domain
ALTER TABLE ai.documents ADD COLUMN IF NOT EXISTS source_id UUID;
COMMENT ON COLUMN ai.documents.source_id IS 'ai.sources.id that owns this document (for archive detection)';

-- Crawl configuration for sources (tree pages like rosseti/np-sr)
ALTER TABLE ai.sources ADD COLUMN IF NOT EXISTS crawl_depth INTEGER DEFAULT 1;
ALTER TABLE ai.sources ADD COLUMN IF NOT EXISTS url_filter TEXT DEFAULT '{}';
COMMENT ON COLUMN ai.sources.crawl_depth IS 'BFS depth for sub-page crawling (1 = root only, 2 = one level, 0 = unlimited)';
COMMENT ON COLUMN ai.sources.url_filter IS 'JSON array of keywords; sub-pages are crawled only if URL/title matches';

-- One-time diff summary per sync run; user acknowledges to clear warnings
CREATE TABLE IF NOT EXISTS ai.sync_diffs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_id UUID,
    source_name TEXT,
    new_docs JSONB DEFAULT '[]',
    archived_docs JSONB DEFAULT '[]',
    created_at BIGINT NOT NULL DEFAULT 0,
    acknowledged_at BIGINT
);
CREATE INDEX IF NOT EXISTS idx_sync_diffs_ack ON ai.sync_diffs (acknowledged_at);

