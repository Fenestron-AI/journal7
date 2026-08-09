-- Journal7 v0.1.0 → V2 power profile values (normalized for analytics)

-- ============================================================
-- Drop old JSONB-based power profile data
-- ============================================================
ALTER TABLE directory.power_profiles DROP COLUMN IF EXISTS data;

-- ============================================================
-- Normalized power profile values (time-series)
-- For a monthly profile: 720-744 rows per profile
-- BRIN index for efficient range scans
-- ============================================================
CREATE TABLE directory.power_profile_values (
    id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    profile_id  UUID NOT NULL REFERENCES directory.power_profiles(id) ON DELETE CASCADE,
    period_date VARCHAR(10) NOT NULL,
    hour        SMALLINT NOT NULL CHECK (hour >= 0 AND hour <= 23),
    value       NUMERIC(18, 6),

    UNIQUE (profile_id, period_date, hour)
);

-- BRIN index: ideal for naturally ordered time-series data
-- Much smaller than B-tree, excellent for range scans
CREATE INDEX idx_ppv_profile_date ON directory.power_profile_values
    USING BRIN (profile_id, period_date);

-- Partial index for fast hour-level lookups per profile
CREATE INDEX idx_ppv_profile_hour ON directory.power_profile_values
    (profile_id, hour, period_date);

-- ============================================================
-- Additional power profile metadata columns
-- ============================================================
ALTER TABLE directory.power_profiles
    ADD COLUMN IF NOT EXISTS unit VARCHAR(16) DEFAULT 'MW',
    ADD COLUMN IF NOT EXISTS min_value NUMERIC(18, 6),
    ADD COLUMN IF NOT EXISTS max_value NUMERIC(18, 6),
    ADD COLUMN IF NOT EXISTS avg_value NUMERIC(18, 6),
    ADD COLUMN IF NOT EXISTS value_count INT DEFAULT 0;
