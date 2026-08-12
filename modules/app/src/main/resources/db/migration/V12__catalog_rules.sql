-- V12: Catalog composition rules — free-form editing of НПБ composition (3-level model, owner level)

CREATE TABLE IF NOT EXISTS ai.catalog_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    action TEXT NOT NULL CHECK (action IN ('include', 'exclude')),
    priority INTEGER DEFAULT 0,
    source TEXT,
    category TEXT,
    doc_type TEXT,
    doc_number TEXT,
    title_mask TEXT,
    comment TEXT,
    active BOOLEAN DEFAULT TRUE,
    created_at BIGINT NOT NULL DEFAULT 0
);
COMMENT ON TABLE ai.catalog_rules IS
    'Состав НПБ: правила включения/исключения документов. Пустое поле = любое значение. Exclude побеждает include при равном priority.';
COMMENT ON COLUMN ai.catalog_rules.action IS 'include — включить, exclude — исключить';
COMMENT ON COLUMN ai.catalog_rules.source IS 'источник (имя или домен) или NULL = любой';
COMMENT ON COLUMN ai.catalog_rules.category IS 'laws/regulations/standards/charters/other/tariffs или NULL = любая';
COMMENT ON COLUMN ai.catalog_rules.doc_type IS 'federal_law/gov_decree/ministry_order/... или NULL = любой';
COMMENT ON COLUMN ai.catalog_rules.doc_number IS 'номер документа (442, 35-ФЗ) или NULL = любой';
COMMENT ON COLUMN ai.catalog_rules.title_mask IS 'маска названия (LIKE: Прогноз%, %Обзор тарифов%) или NULL = любая';

CREATE INDEX IF NOT EXISTS idx_catalog_rules_active ON ai.catalog_rules (active);
