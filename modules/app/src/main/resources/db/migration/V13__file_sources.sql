-- V13: Trusted file storage sources — где искать файлы документов в лучшем формате

CREATE TABLE IF NOT EXISTS ai.file_sources (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    domain TEXT NOT NULL,
    priority INTEGER DEFAULT 100,
    active BOOLEAN DEFAULT TRUE,
    comment TEXT,
    created_at BIGINT NOT NULL DEFAULT 0
);
COMMENT ON TABLE ai.file_sources IS
    'Доверенные источники файлов (хранилища): домены, где искать документ в лучшем формате (docx > odt > rtf > doc > pdf). Отдельно от каталога (ai.sources).';
COMMENT ON COLUMN ai.file_sources.domain IS 'домен (например, pravo.gov.ru)';
COMMENT ON COLUMN ai.file_sources.priority IS 'приоритет доверия: меньше = выше (сначала проверяем более доверенные)';

CREATE INDEX IF NOT EXISTS idx_file_sources_active ON ai.file_sources (active);

-- Unique domain to avoid duplicates on re-run
CREATE UNIQUE INDEX IF NOT EXISTS idx_file_sources_domain ON ai.file_sources (domain);

-- Стартовый список официальных бесплатных хранилищ (по решению владельца состава)
INSERT INTO ai.file_sources (domain, priority, comment, created_at) VALUES
    ('pravo.gov.ru',     10, 'Официальное опубликование правовых актов', EXTRACT(EPOCH FROM NOW())*1000),
    ('government.ru',    20, 'Правительство РФ — постановления и распоряжения', EXTRACT(EPOCH FROM NOW())*1000),
    ('kremlin.ru',       30, 'Президент РФ — указы и законы', EXTRACT(EPOCH FROM NOW())*1000),
    ('minenergo.gov.ru', 40, 'Минэнерго РФ — приказы', EXTRACT(EPOCH FROM NOW())*1000),
    ('fas.gov.ru',       50, 'ФАС РФ — приказы и разъяснения', EXTRACT(EPOCH FROM NOW())*1000),
    ('regulation.gov.ru', 60, 'Регуляторная гильотина — проекты актов', EXTRACT(EPOCH FROM NOW())*1000)
ON CONFLICT DO NOTHING;
