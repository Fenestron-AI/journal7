-- V6: Universal sync model — LLM-powered catalog with classification
-- Adds sync intervals, document groups, and seeds new sources

-- ============================================================
-- ai.documents: sync_interval + doc_category
-- ============================================================
ALTER TABLE ai.documents ADD COLUMN IF NOT EXISTS sync_interval TEXT DEFAULT 'monthly';
ALTER TABLE ai.documents ADD COLUMN IF NOT EXISTS doc_category TEXT DEFAULT 'other';

-- ============================================================
-- ai.sources: doc_group + sync_interval
-- ============================================================
ALTER TABLE ai.sources ADD COLUMN IF NOT EXISTS doc_group TEXT DEFAULT 'laws';
ALTER TABLE ai.sources ADD COLUMN IF NOT EXISTS sync_interval TEXT DEFAULT 'weekly';
ALTER TABLE ai.sources ADD COLUMN IF NOT EXISTS active BOOLEAN DEFAULT TRUE;

-- ============================================================
-- Seed: all 10 sources from normative base
-- ============================================================
INSERT INTO ai.sources (id, name, url, sync_strategy, doc_group, sync_interval)
VALUES
  -- СО ЕЭС (existing — update if duplicate, else insert)
  (gen_random_uuid(), 'СО ЕЭС — Законы и постановления', 'https://www.so-ups.ru/functioning/laws/', 'html_parse_llm', 'laws', 'weekly'),
  (gen_random_uuid(), 'СО ЕЭС — Регламентирующие документы', 'https://www.so-ups.ru/functioning/markets/markets-regulations/', 'html_parse_llm', 'regulations', 'weekly'),
  (gen_random_uuid(), 'СО ЕЭС — Стандарты и правила', 'https://www.so-ups.ru/functioning/tech-base/tech-standards/', 'html_parse_llm', 'standards', 'monthly'),

  -- НП Совет рынка
  (gen_random_uuid(), 'НП Совет рынка — Регламенты ОРЭМ', 'https://www.np-sr.ru/ru/regulation/joining/reglaments/index.htm', 'html_parse_llm', 'regulations', 'weekly'),
  (gen_random_uuid(), 'НП Совет рынка — ДОП', 'https://www.np-sr.ru/ru/regulation/joining/stdd/index.htm', 'html_parse_llm', 'regulations', 'weekly'),

  -- АО АТС
  (gen_random_uuid(), 'АО АТС — Документы общества', 'https://www.atsenergo.ru/ats/docs', 'html_parse_llm', 'charters', 'monthly'),
  (gen_random_uuid(), 'АО АТС — Электронная подпись', 'https://www.atsenergo.ru/dts/certify', 'html_parse_llm', 'standards', 'monthly'),

  -- АО ЦФР
  (gen_random_uuid(), 'АО ЦФР — Нормативно-методическое обеспечение', 'https://cfrenergo.ru/strategy/security/', 'html_parse_llm', 'regulations', 'weekly'),
  (gen_random_uuid(), 'АО ЦФР — Документы общества', 'https://cfrenergo.ru/company/society_documents/', 'html_parse_llm', 'charters', 'monthly'),

  -- Россети
  (gen_random_uuid(), 'Россети — Нормативно-правовая база', 'https://www.rosseti.ru/consumers/consumers-of-subsidiaries-and-affiliates/regulatory-framework/', 'html_parse_llm', 'laws', 'monthly'),
  (gen_random_uuid(), 'Россети — Стандарты организации', 'https://www.rosseti.ru/suppliers/technical-policy/organization-standards/', 'html_parse_llm', 'standards', 'monthly'),
  (gen_random_uuid(), 'Россети — Раскрытие информации', 'https://www.rosseti.ru/shareholders-and-investors/disclosure-of-information/', 'html_parse_llm', 'other', 'monthly')
ON CONFLICT DO NOTHING;

-- Mark old so-ups source as inactive (replaced by new entries above)
UPDATE ai.sources SET active = FALSE WHERE sync_strategy = 'html_parse_so_ups';

-- Update existing documents to have default sync_interval based on doc_type
UPDATE ai.documents SET sync_interval = 'monthly', doc_category = 'laws'
  WHERE doc_type IN ('ФЗ', 'federal_law');

UPDATE ai.documents SET sync_interval = 'weekly', doc_category = 'gov_decrees'
  WHERE doc_type IN ('ПП РФ', 'gov_decree');

UPDATE ai.documents SET sync_interval = 'weekly', doc_category = 'ministry_orders'
  WHERE doc_type IN ('Приказ Минэнерго', 'ministry_order');

UPDATE ai.documents SET sync_interval = 'daily', doc_category = 'fas_orders'
  WHERE doc_type IN ('Приказ ФАС/ФСТ', 'fas_order');
