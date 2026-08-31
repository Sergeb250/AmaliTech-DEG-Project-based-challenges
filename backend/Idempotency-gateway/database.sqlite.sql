CREATE TABLE IF NOT EXISTS idempotency_records (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    idempotency_key TEXT UNIQUE NOT NULL,
    amount NUMERIC NOT NULL CHECK (amount > 0),
    currency TEXT NOT NULL CHECK (length(currency) = 3),
    processing_status TEXT NOT NULL
        CHECK (processing_status IN ('PROCESSING', 'COMPLETED', 'FAILED')),
    response_status INTEGER,
    response_body TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS payments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    idempotency_record_id INTEGER UNIQUE NOT NULL
        REFERENCES idempotency_records(id),
    amount NUMERIC NOT NULL CHECK (amount > 0),
    currency TEXT NOT NULL CHECK (length(currency) = 3),
    payment_status TEXT NOT NULL DEFAULT 'CHARGED',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS rate_limit_windows (
    client_key TEXT NOT NULL,
    window_start INTEGER NOT NULL,
    request_count INTEGER NOT NULL CHECK (request_count > 0),
    PRIMARY KEY (client_key, window_start)
);

CREATE INDEX IF NOT EXISTS idx_idempotency_processing_status
    ON idempotency_records(processing_status);

CREATE INDEX IF NOT EXISTS idx_rate_limit_window_start
    ON rate_limit_windows(window_start);
