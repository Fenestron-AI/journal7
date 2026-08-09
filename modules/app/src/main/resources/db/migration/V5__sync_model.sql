-- V5: Sync model — sources, original filenames, file size, archivability

-- New columns
ALTER TABLE ai.documents ADD COLUMN IF NOT EXISTS original_filename TEXT;
ALTER TABLE ai.documents ADD COLUMN IF NOT EXISTS file_size BIGINT DEFAULT 0;
ALTER TABLE ai.documents ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'so-ups.ru';
ALTER TABLE ai.documents ADD COLUMN IF NOT EXISTS source_url TEXT;
ALTER TABLE ai.documents ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0;
ALTER TABLE ai.documents ADD COLUMN IF NOT EXISTS last_checked_at BIGINT DEFAULT 0;

-- so_ups_url renamed to source_url (via ADD COLUMN above — column already named source_url)

-- Sources table
CREATE TABLE ai.sources (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name        TEXT NOT NULL,
    url         TEXT,
    sync_strategy TEXT NOT NULL DEFAULT 'manual',
    last_synced_at BIGINT DEFAULT 0,
    status      TEXT DEFAULT 'IDLE',
    config      TEXT DEFAULT '{}'
);

-- Seed: so-ups.ru source
INSERT INTO ai.sources (id, name, url, sync_strategy)
VALUES (gen_random_uuid(), 'СО ЕЭС', 'https://www.so-ups.ru/functioning/laws/', 'html_parse_so_ups');

-- Existing documents are updated by sync_so_ups.py on first run
