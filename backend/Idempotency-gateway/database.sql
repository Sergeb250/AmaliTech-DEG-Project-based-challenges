CREATE TABLE IF NOT EXISTS idempotency_records (
    id BIGSERIAL PRIMARY KEY,
    idempotency_key VARCHAR(255) UNIQUE NOT NULL,
    amount NUMERIC(19, 2) NOT NULL CHECK (amount > 0),
    currency CHAR(3) NOT NULL,
    processing_status VARCHAR(20) NOT NULL
        CHECK (processing_status IN ('PROCESSING', 'COMPLETED', 'FAILED')),
    response_status INTEGER,
    response_body JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS payments (
    id BIGSERIAL PRIMARY KEY,
    idempotency_record_id BIGINT UNIQUE NOT NULL
        REFERENCES idempotency_records(id),
    amount NUMERIC(19, 2) NOT NULL CHECK (amount > 0),
    currency CHAR(3) NOT NULL,
    payment_status VARCHAR(20) NOT NULL DEFAULT 'CHARGED',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS rate_limit_windows (
    client_key VARCHAR(255) NOT NULL,
    window_start TIMESTAMPTZ NOT NULL,
    request_count INTEGER NOT NULL CHECK (request_count > 0),
    PRIMARY KEY (client_key, window_start)
);

CREATE INDEX IF NOT EXISTS idx_idempotency_processing_status
    ON idempotency_records(processing_status);

CREATE INDEX IF NOT EXISTS idx_rate_limit_window_start
    ON rate_limit_windows(window_start);
