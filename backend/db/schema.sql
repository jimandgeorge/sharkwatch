CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS vector;

-- Raw ingested transactions
CREATE TABLE transactions (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    external_id     TEXT NOT NULL,
    source          TEXT NOT NULL,
    amount_pence    BIGINT NOT NULL,
    currency        TEXT NOT NULL DEFAULT 'GBP',
    customer_id     TEXT NOT NULL,
    customer_email  TEXT,
    merchant_name   TEXT,
    beneficiary_account TEXT,
    beneficiary_name    TEXT,
    transfer_type   TEXT,
    ip_address      TEXT,
    device_fingerprint TEXT,
    geolocation     TEXT,
    fraud_signals   JSONB,
    triggered_rules JSONB,
    raw_payload     JSONB,
    occurred_at     TIMESTAMPTZ NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (source, external_id)
);

-- Investigation results
CREATE TABLE investigations (
    id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    transaction_id          UUID NOT NULL REFERENCES transactions(id),
    risk_score              INT NOT NULL,
    risk_level              TEXT NOT NULL,
    fraud_type              TEXT,
    confidence              TEXT NOT NULL,
    summary                 TEXT NOT NULL,
    recommended_action      TEXT NOT NULL,
    risk_factors            JSONB NOT NULL DEFAULT '[]',
    retrieved_case_ids      JSONB NOT NULL DEFAULT '[]',
    policy_rules_triggered  JSONB NOT NULL DEFAULT '[]',
    llm_provider            TEXT NOT NULL,
    llm_model               TEXT NOT NULL,
    status                  TEXT NOT NULL DEFAULT 'pending',  -- pending | decided
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Analyst decisions (audit trail)
CREATE TABLE decisions (
    id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    transaction_id          UUID NOT NULL REFERENCES transactions(id),
    investigation_id        UUID NOT NULL REFERENCES investigations(id),
    action                  TEXT NOT NULL,
    analyst_id              TEXT NOT NULL,
    analyst_notes           TEXT,
    ai_recommended_action   TEXT NOT NULL,
    override_reason         TEXT,
    risk_score              INT NOT NULL,
    decided_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Prior fraud cases for RAG retrieval
CREATE TABLE fraud_cases (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    case_ref    TEXT UNIQUE NOT NULL,
    fraud_type  TEXT NOT NULL,
    summary     TEXT NOT NULL,
    outcome     TEXT NOT NULL,
    signals     JSONB NOT NULL DEFAULT '[]',
    embedding   vector(1536),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Policy documents for RAG retrieval
CREATE TABLE policy_docs (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title       TEXT NOT NULL,
    content     TEXT NOT NULL,
    embedding   vector(1536),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX ON transactions (customer_id);
CREATE INDEX ON transactions (device_fingerprint);
CREATE INDEX ON transactions (created_at DESC);
CREATE INDEX ON investigations (transaction_id);
CREATE INDEX ON investigations (status, risk_score DESC);
CREATE INDEX ON decisions (transaction_id);
CREATE INDEX ON fraud_cases USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
CREATE INDEX ON policy_docs USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
