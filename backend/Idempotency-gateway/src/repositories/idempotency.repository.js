const database = require("../config/database");

function mapRecord(row) {
  if (!row) {
    return null;
  }

  let responseBody = row.response_body;
  if (typeof responseBody === "string") {
    responseBody = JSON.parse(responseBody);
  }

  return {
    id: row.id,
    idempotencyKey: row.idempotency_key,
    amount: row.amount,
    currency: row.currency.trim(),
    processingStatus: row.processing_status,
    responseStatus: row.response_status,
    responseBody,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

async function createProcessing({ idempotencyKey, amount, currency }) {
  if (database.getDialect() === "sqlite") {
    const row = database.sqliteGet(
      `INSERT INTO idempotency_records
        (idempotency_key, amount, currency, processing_status)
       VALUES (?, ?, ?, 'PROCESSING')
       ON CONFLICT (idempotency_key) DO NOTHING
       RETURNING *`,
      [idempotencyKey, amount, currency]
    );
    return mapRecord(row);
  }

  const result = await database.query(
    `INSERT INTO idempotency_records
      (idempotency_key, amount, currency, processing_status)
     VALUES ($1, $2, $3, 'PROCESSING')
     ON CONFLICT (idempotency_key) DO NOTHING
     RETURNING *`,
    [idempotencyKey, amount, currency]
  );

  return mapRecord(result.rows[0]);
}

async function findByKey(idempotencyKey) {
  if (database.getDialect() === "sqlite") {
    return mapRecord(
      database.sqliteGet(
        "SELECT * FROM idempotency_records WHERE idempotency_key = ?",
        [idempotencyKey]
      )
    );
  }

  const result = await database.query(
    "SELECT * FROM idempotency_records WHERE idempotency_key = $1",
    [idempotencyKey]
  );

  return mapRecord(result.rows[0]);
}

async function markCompleted(id, responseStatus, responseBody, client = database) {
  if (client.dialect === "sqlite") {
    return mapRecord(
      client.get(
        `UPDATE idempotency_records
         SET processing_status = 'COMPLETED',
             response_status = ?,
             response_body = ?,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = ?
         RETURNING *`,
        [responseStatus, JSON.stringify(responseBody), id]
      )
    );
  }

  const result = await client.query(
    `UPDATE idempotency_records
     SET processing_status = 'COMPLETED',
         response_status = $2,
         response_body = $3::jsonb,
         updated_at = NOW()
     WHERE id = $1
     RETURNING *`,
    [id, responseStatus, JSON.stringify(responseBody)]
  );

  return mapRecord(result.rows[0]);
}

async function markFailed(id, responseStatus, responseBody) {
  if (database.getDialect() === "sqlite") {
    return mapRecord(
      database.sqliteGet(
        `UPDATE idempotency_records
         SET processing_status = 'FAILED',
             response_status = ?,
             response_body = ?,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = ?
         RETURNING *`,
        [responseStatus, JSON.stringify(responseBody), id]
      )
    );
  }

  const result = await database.query(
    `UPDATE idempotency_records
     SET processing_status = 'FAILED',
         response_status = $2,
         response_body = $3::jsonb,
         updated_at = NOW()
     WHERE id = $1
     RETURNING *`,
    [id, responseStatus, JSON.stringify(responseBody)]
  );

  return mapRecord(result.rows[0]);
}

async function deleteExpired(ttlHours) {
  await database.transaction(async (client) => {
    if (client.dialect === "sqlite") {
      const expiredIds = `SELECT id FROM idempotency_records
        WHERE processing_status != 'PROCESSING'
          AND updated_at < datetime('now', '-' || ? || ' hours')`;
      client.run(
        `DELETE FROM payments
         WHERE idempotency_record_id IN (${expiredIds})`,
        [ttlHours]
      );
      client.run(
        `DELETE FROM idempotency_records
         WHERE processing_status != 'PROCESSING'
           AND updated_at < datetime('now', '-' || ? || ' hours')`,
        [ttlHours]
      );
      return;
    }

    await client.query(
      `DELETE FROM payments
       WHERE idempotency_record_id IN (
         SELECT id FROM idempotency_records
         WHERE processing_status != 'PROCESSING'
           AND updated_at < NOW() - make_interval(hours => $1::integer)
       )`,
      [ttlHours]
    );
    await client.query(
      `DELETE FROM idempotency_records
       WHERE processing_status != 'PROCESSING'
         AND updated_at < NOW() - make_interval(hours => $1::integer)`,
      [ttlHours]
    );
  });
}

module.exports = {
  createProcessing,
  findByKey,
  markCompleted,
  markFailed,
  deleteExpired
};
