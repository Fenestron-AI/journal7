-- Journal7 v0.1.0 — Initial schema
-- Schemas: directory, document, settings, constants

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- Schema: settings (Настройки)
-- ============================================================
CREATE SCHEMA IF NOT EXISTS settings;

CREATE TABLE settings.users (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username    VARCHAR(128) NOT NULL UNIQUE,
    password    VARCHAR(256) NOT NULL,
    full_name   VARCHAR(256) NOT NULL,
    email       VARCHAR(256),
    role        VARCHAR(32) NOT NULL DEFAULT 'viewer',
    deleted     BOOLEAN NOT NULL DEFAULT FALSE,
    deleted_at  TIMESTAMPTZ,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE settings.user_profiles (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID NOT NULL REFERENCES settings.users(id),
    theme       VARCHAR(64) DEFAULT 'light',
    reports_path VARCHAR(512),
    bills_path  VARCHAR(512),
    xlsx_viewer VARCHAR(512),
    docx_viewer VARCHAR(512),
    pdf_viewer  VARCHAR(512),
    email_host  VARCHAR(256),
    email_port  INT,
    email_user  VARCHAR(256),
    email_password VARCHAR(256),
    email_ssl   BOOLEAN DEFAULT TRUE,
    is_default  BOOLEAN DEFAULT FALSE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE settings.firm_profiles (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name            VARCHAR(512) NOT NULL,
    inn             VARCHAR(12),
    kpp             VARCHAR(9),
    director        VARCHAR(256),
    accountant      VARCHAR(256),
    legal_address   TEXT,
    postal_address  TEXT,
    phone           VARCHAR(32),
    email           VARCHAR(256),
    stamp_path      VARCHAR(512),
    signature_path  VARCHAR(512),
    logo_path       VARCHAR(512),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- Schema: directory (Справочник)
-- ============================================================
CREATE SCHEMA IF NOT EXISTS directory;

CREATE TABLE directory.counterparties (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code            VARCHAR(64) NOT NULL UNIQUE,
    name            VARCHAR(512) NOT NULL,
    full_name       VARCHAR(1024),
    inn             VARCHAR(12),
    kpp             VARCHAR(9),
    ogrn            VARCHAR(15),
    legal_address   TEXT,
    postal_address  TEXT,
    phone           VARCHAR(32),
    email           VARCHAR(256),
    bank_name       VARCHAR(512),
    bank_bik        VARCHAR(9),
    bank_ks         VARCHAR(20),
    bank_rs         VARCHAR(20),
    type            VARCHAR(32) NOT NULL DEFAULT 'sale',
    deleted         BOOLEAN NOT NULL DEFAULT FALSE,
    deleted_at      TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE directory.regions (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code        VARCHAR(16) NOT NULL UNIQUE,
    name        VARCHAR(256) NOT NULL,
    timezone    VARCHAR(64),
    tariffs     JSONB DEFAULT '[]',
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE directory.guaranteeing_suppliers (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code        VARCHAR(16) NOT NULL UNIQUE,
    name        VARCHAR(512) NOT NULL,
    region_id   UUID REFERENCES directory.regions(id),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE directory.calculation_groups (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name        VARCHAR(256) NOT NULL,
    description TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE directory.tariff_zones (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name        VARCHAR(256) NOT NULL,
    code        VARCHAR(32) NOT NULL,
    description TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE directory.power_profiles (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code        VARCHAR(64) NOT NULL UNIQUE,
    name        VARCHAR(512) NOT NULL,
    type        VARCHAR(32) NOT NULL DEFAULT 'consumption',
    region_id   UUID REFERENCES directory.regions(id),
    data        JSONB DEFAULT '[]',
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE directory.responsible_persons (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name        VARCHAR(256) NOT NULL,
    position    VARCHAR(256),
    phone       VARCHAR(32),
    email       VARCHAR(256),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE directory.discount_formulas (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name        VARCHAR(256) NOT NULL,
    formula     TEXT NOT NULL,
    description TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- Schema: document (Документ)
-- ============================================================
CREATE SCHEMA IF NOT EXISTS document;

CREATE TABLE document.sale_contracts (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    number              VARCHAR(128) NOT NULL,
    counterparty_id     UUID NOT NULL REFERENCES directory.counterparties(id),
    date_from           DATE NOT NULL,
    date_to             DATE,
    type                VARCHAR(32) NOT NULL DEFAULT 'energy_sale',
    price_category      VARCHAR(16) NOT NULL DEFAULT 'CK1',
    calculation_group_id UUID REFERENCES directory.calculation_groups(id),
    confirmed_by        UUID REFERENCES settings.users(id),
    confirmed           BOOLEAN NOT NULL DEFAULT FALSE,
    confirmed_at        TIMESTAMPTZ,
    metadata            JSONB DEFAULT '{}',
    deleted             BOOLEAN NOT NULL DEFAULT FALSE,
    deleted_at          TIMESTAMPTZ,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE document.accounting_objects (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    contract_id     UUID NOT NULL REFERENCES document.sale_contracts(id),
    name            VARCHAR(512) NOT NULL,
    code            VARCHAR(128),
    deleted         BOOLEAN NOT NULL DEFAULT FALSE,
    deleted_at      TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE document.delivery_points (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    object_id       UUID NOT NULL REFERENCES document.accounting_objects(id),
    contract_id     UUID NOT NULL REFERENCES document.sale_contracts(id),
    name            VARCHAR(512) NOT NULL,
    code            VARCHAR(128),
    metering_points JSONB DEFAULT '[]',
    deleted         BOOLEAN NOT NULL DEFAULT FALSE,
    deleted_at      TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE document.sale_calculations (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    contract_id     UUID NOT NULL REFERENCES document.sale_contracts(id),
    period_from     DATE NOT NULL,
    period_to       DATE NOT NULL,
    price_category  VARCHAR(16) NOT NULL,
    status          VARCHAR(32) NOT NULL DEFAULT 'draft',
    total_volume    NUMERIC(18, 6) DEFAULT 0,
    total_cost      NUMERIC(18, 2) DEFAULT 0,
    result_data     JSONB DEFAULT '{}',
    created_by      UUID REFERENCES settings.users(id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE document.sale_invoices (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    contract_id     UUID NOT NULL REFERENCES document.sale_contracts(id),
    calculation_id  UUID REFERENCES document.sale_calculations(id),
    number          VARCHAR(128) NOT NULL,
    date            DATE NOT NULL,
    type            VARCHAR(32) NOT NULL DEFAULT 'realization',
    items           JSONB DEFAULT '[]',
    total_amount    NUMERIC(18, 2) DEFAULT 0,
    total_vat       NUMERIC(18, 2) DEFAULT 0,
    total_with_vat  NUMERIC(18, 2) DEFAULT 0,
    status          VARCHAR(32) NOT NULL DEFAULT 'draft',
    created_by      UUID REFERENCES settings.users(id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE document.acceptance_acts (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    contract_id     UUID NOT NULL REFERENCES document.sale_contracts(id),
    calculation_id  UUID REFERENCES document.sale_calculations(id),
    number          VARCHAR(128) NOT NULL,
    date            DATE NOT NULL,
    period_from     DATE NOT NULL,
    period_to       DATE NOT NULL,
    volume          NUMERIC(18, 6) DEFAULT 0,
    cost            NUMERIC(18, 2) DEFAULT 0,
    status          VARCHAR(32) NOT NULL DEFAULT 'draft',
    created_by      UUID REFERENCES settings.users(id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE document.sales_markups (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    region_id   UUID REFERENCES directory.regions(id),
    date_from   DATE NOT NULL,
    date_to     DATE,
    rate        NUMERIC(18, 6) NOT NULL,
    unit        VARCHAR(16) NOT NULL DEFAULT 'rub_mwh',
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE document.nonreg_energy_prices (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    region_id   UUID REFERENCES directory.regions(id),
    date_from   DATE NOT NULL,
    date_to     DATE,
    price       NUMERIC(18, 6) NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE document.nonreg_power_prices (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    region_id   UUID REFERENCES directory.regions(id),
    date_from   DATE NOT NULL,
    date_to     DATE,
    price       NUMERIC(18, 6) NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE document.om_coefficients (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    region_id   UUID REFERENCES directory.regions(id),
    date_from   DATE NOT NULL,
    date_to     DATE,
    om_value    NUMERIC(18, 6) NOT NULL,
    infr_value  NUMERIC(18, 6),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE document.closed_periods (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    contract_id UUID NOT NULL REFERENCES document.sale_contracts(id),
    period_from DATE NOT NULL,
    period_to   DATE NOT NULL,
    locked_by   UUID REFERENCES settings.users(id),
    locked_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(contract_id, period_from, period_to)
);

CREATE TABLE document.consumer_premiums (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    contract_id     UUID NOT NULL REFERENCES document.sale_contracts(id),
    period_from     DATE NOT NULL,
    period_to       DATE NOT NULL,
    premium_type    VARCHAR(32) NOT NULL,
    amount          NUMERIC(18, 2) NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE document.agent_commissions (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    contract_id     UUID NOT NULL REFERENCES document.sale_contracts(id),
    period_from     DATE NOT NULL,
    period_to       DATE NOT NULL,
    rate            NUMERIC(18, 6) NOT NULL,
    amount          NUMERIC(18, 2) NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE document.delivery_point_discounts (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    delivery_point_id   UUID NOT NULL REFERENCES document.delivery_points(id),
    date_from           DATE NOT NULL,
    date_to             DATE,
    discount_type       VARCHAR(32) NOT NULL,
    value               NUMERIC(18, 6) NOT NULL,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- Schema: constants (Константа)
-- ============================================================
CREATE SCHEMA IF NOT EXISTS constants;

CREATE TABLE constants.software_version (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    version         VARCHAR(32) NOT NULL,
    download_url    VARCHAR(1024),
    published_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    release_notes   TEXT
);

-- ============================================================
-- Indexes
-- ============================================================
CREATE INDEX idx_counterparties_deleted ON directory.counterparties(deleted) WHERE deleted = FALSE;
CREATE INDEX idx_counterparties_type ON directory.counterparties(type);
CREATE INDEX idx_counterparties_inn ON directory.counterparties(inn);

CREATE INDEX idx_sale_contracts_counterparty ON document.sale_contracts(counterparty_id);
CREATE INDEX idx_sale_contracts_deleted ON document.sale_contracts(deleted) WHERE deleted = FALSE;
CREATE INDEX idx_sale_contracts_number ON document.sale_contracts(number);

CREATE INDEX idx_accounting_objects_contract ON document.accounting_objects(contract_id);
CREATE INDEX idx_delivery_points_object ON document.delivery_points(object_id);
CREATE INDEX idx_delivery_points_contract ON document.delivery_points(contract_id);

CREATE INDEX idx_sale_calculations_contract ON document.sale_calculations(contract_id);
CREATE INDEX idx_sale_calculations_period ON document.sale_calculations(period_from, period_to);

CREATE INDEX idx_sale_invoices_contract ON document.sale_invoices(contract_id);
CREATE INDEX idx_sale_invoices_date ON document.sale_invoices(date);

CREATE INDEX idx_closed_periods_contract ON document.closed_periods(contract_id);

-- ============================================================
-- Seed data
-- ============================================================
INSERT INTO constants.software_version (version, download_url, release_notes)
VALUES ('0.1.0', 'https://journal7.ru/releases/0.1.0', 'Initial release');

-- Default admin user (password: admin123, bcrypt hash)
INSERT INTO settings.users (username, password, full_name, role)
VALUES ('admin', '$2a$10$dummy_hash_replace_in_production', 'Administrator', 'admin');
