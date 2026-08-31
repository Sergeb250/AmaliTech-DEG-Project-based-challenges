const database = require("../config/database");

async function increment(clientKey) {
  if (database.getDialect() === "sqlite") {
    const now = Date.now();
    const windowStart = Math.floor(now / 60000);
    const row = database.sqliteGet(
      `INSERT INTO rate_limit_windows
        (client_key, window_start, request_count)
       VALUES (?, ?, 1)
       ON CONFLICT (client_key, window_start)
       DO UPDATE SET request_count = rate_limit_windows.request_count + 1
       RETURNING request_count`,
      [clientKey, windowStart]
    );

    return {
      count: row.request_count,
      retryAfter: Math.max(1, 60 - Math.floor((now % 60000) / 1000))
    };
  }

  const result = await database.query(
    `INSERT INTO rate_limit_windows
      (client_key, window_start, request_count)
     VALUES ($1, date_trunc('minute', NOW()), 1)
     ON CONFLICT (client_key, window_start)
     DO UPDATE SET request_count = rate_limit_windows.request_count + 1
     RETURNING request_count,
       GREATEST(
         1,
         CEIL(EXTRACT(EPOCH FROM (window_start + INTERVAL '1 minute' - NOW())))
       )::integer AS retry_after`,
    [clientKey]
  );

  return {
    count: result.rows[0].request_count,
    retryAfter: result.rows[0].retry_after
  };
}

async function deleteExpired() {
  if (database.getDialect() === "sqlite") {
    const currentWindow = Math.floor(Date.now() / 60000);
    database.sqliteRun(
      "DELETE FROM rate_limit_windows WHERE window_start < ?",
      [currentWindow - 1440]
    );
    return;
  }

  await database.query(
    "DELETE FROM rate_limit_windows WHERE window_start < NOW() - INTERVAL '1 day'"
  );
}

module.exports = { increment, deleteExpired };
