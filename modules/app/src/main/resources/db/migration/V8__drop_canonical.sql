-- V8: Remove canonical flag — all synced documents are equal
ALTER TABLE ai.documents DROP COLUMN IF EXISTS canonical;
