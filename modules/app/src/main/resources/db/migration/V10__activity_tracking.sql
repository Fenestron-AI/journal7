-- V10: Activity tracking — delta counts for badge in menu
CREATE TABLE ai.activity (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    new_count INTEGER DEFAULT 0,
    archived_count INTEGER DEFAULT 0,
    created_at BIGINT NOT NULL DEFAULT 0
);
