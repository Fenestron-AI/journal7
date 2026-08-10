-- V7: Simplified document status model
-- status: TRACKED | INGESTED | ARCHIVED
-- download_state: null | downloading | downloaded | error
-- processing_state: null | processing | done | error

-- Add new columns
ALTER TABLE ai.documents ADD COLUMN IF NOT EXISTS download_state TEXT;
ALTER TABLE ai.documents ADD COLUMN IF NOT EXISTS processing_state TEXT;

-- Migrate old statuses to new model
-- MISSING → TRACKED
UPDATE ai.documents SET download_state = NULL, processing_state = NULL, status = 'TRACKED'
WHERE status IN ('MISSING', 'OUTDATED');

-- DOWNLOADING → TRACKED + download_state='downloading'
UPDATE ai.documents SET download_state = 'downloading', processing_state = NULL, status = 'TRACKED'
WHERE status = 'DOWNLOADING';

-- DOWNLOADED → TRACKED + download_state='downloaded'
UPDATE ai.documents SET download_state = 'downloaded', processing_state = NULL, status = 'TRACKED'
WHERE status = 'DOWNLOADED';

-- PROCESSING → TRACKED + download_state='downloaded' + processing_state='processing'
UPDATE ai.documents SET download_state = 'downloaded', processing_state = 'processing', status = 'TRACKED'
WHERE status = 'PROCESSING';

-- ACTIVE → INGESTED
UPDATE ai.documents SET download_state = 'downloaded', processing_state = 'done', status = 'INGESTED'
WHERE status = 'ACTIVE';

-- ERROR → TRACKED + download_state='error'
UPDATE ai.documents SET download_state = 'error', processing_state = NULL, status = 'TRACKED'
WHERE status = 'ERROR';

-- ARCHIVED stays ARCHIVED
UPDATE ai.documents SET download_state = NULL, processing_state = NULL
WHERE status = 'ARCHIVED';

-- Add index for new states
CREATE INDEX IF NOT EXISTS idx_ai_documents_download_state ON ai.documents(download_state);
CREATE INDEX IF NOT EXISTS idx_ai_documents_processing_state ON ai.documents(processing_state);

-- Update sync_so_ups.py references (legacy code still checks for 'DOWNLOADING')
-- Already fixed by migration above: DOWNLOADING → TRACKED + download_state='downloading'
