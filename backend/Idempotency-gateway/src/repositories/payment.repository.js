async function createPayment(
  { idempotencyRecordId, amount, currency },
  client
) {
  if (client.dialect === "sqlite") {
    return client.get(
      `INSERT INTO payments
        (idempotency_record_id, amount, currency, payment_status)
       VALUES (?, ?, ?, 'CHARGED')
       RETURNING *`,
      [idempotencyRecordId, amount, currency]
    );
  }

  const result = await client.query(
    `INSERT INTO payments
      (idempotency_record_id, amount, currency, payment_status)
     VALUES ($1, $2, $3, 'CHARGED')
     RETURNING *`,
    [idempotencyRecordId, amount, currency]
  );

  return result.rows[0];
}

module.exports = { createPayment };
