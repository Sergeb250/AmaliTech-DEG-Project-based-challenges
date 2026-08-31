# FinSafe Idempotency Gateway

## Project Purpose

FinSafe is a Node.js, Express, and PostgreSQL payment API that protects customers
from duplicate charges. When a store retries a payment after a network timeout,
the API uses an `Idempotency-Key` to make sure the payment is processed only once.

PostgreSQL is the main database. If PostgreSQL is unavailable, the application
starts with SQLite automatically so reviewers can still run and test the complete
project.

## Architecture Diagram

![FinSafe payment idempotency sequence diagram](docs/images/sequencediagran.png)



## Getting Started

Node.js 22 or newer is required. PostgreSQL is recommended but optional because
SQLite is available as an automatic fallback.

```bash
git clone https://github.com/SergeB250/AmaliTech-DEG-Project-based-challenges.git
cd AmaliTech-DEG-Project-based-challenges/backend/Idempotency-gateway
npm ci
```

Copy `.env.example` to `.env` and update the PostgreSQL password when PostgreSQL
will be used.

```env
PORT=3000
DATABASE_URL=postgresql://postgres:YOUR_PASSWORD@localhost:5000/finsafe
SQLITE_PATH=./data/finsafe.sqlite
IDEMPOTENCY_TTL_HOURS=24
RATE_LIMIT_MAX=20
PROCESSING_DELAY_MS=2000
IN_FLIGHT_TIMEOUT_MS=10000
IN_FLIGHT_POLL_MS=100
```

Start the server and run the code checks.

```bash
npm start
npm run lint
```

The API runs at `http://localhost:3000`. Confirm that it is available before
testing payments.

```http
GET http://localhost:3000/health
```

```json
{
  "status": "ok"
}
```

The database tables are created automatically during startup.

## Manual Endpoint Testing

The following requests can be sent manually from Postman or another HTTP client.

The response body stays exactly the same for a duplicate because that is an
acceptance requirement. The response headers explain what happened. A new
payment returns `X-Idempotency-Status: created`. An immediate duplicate returns
`X-Idempotency-Status: replayed`. A duplicate that waited for an active request
returns `X-Idempotency-Status: replayed-after-wait`. A changed payment returns
`X-Idempotency-Status: conflict`.

## User Story 1: The First Transaction

The client sends a new payment to this endpoint.

```http
POST http://localhost:3000/process-payment
```

Make sure the URL ends directly after `process-payment`. An accidental line break
appears as `%0A`. The API now removes trailing encoded whitespace safely, but the
clean URL above should still be used in Postman.

The request contains these headers.

```http
Content-Type: application/json
Idempotency-Key: payment-1001
```

The Postman body is raw JSON.

```json
{
  "amount": 100,
  "currency": "GHS"
}
```

The server processes the payment for about two seconds and returns
`201 Created`.

```http
X-Cache-Hit: false
X-Idempotency-Status: created
```

```json
{
  "status": "Charged 100 GHS"
}
```

This confirms that the endpoint accepts the required header and payment body,
processes the first transaction, and returns the required message.

![Successful first payment returning 201 Created](docs/images/FirstTransaction.png)

## User Story 2: The Duplicate Attempt

Send the same endpoint, `Idempotency-Key`, and JSON body again. The server does
not run the payment logic for another two seconds. It returns the exact status
code and body saved by the first request.

```http
X-Cache-Hit: true
X-Idempotency-Status: replayed
```

This confirms that a client can safely retry a payment without charging the
customer again.

## User Story 3: A Different Request Using the Same Key

Keep `Idempotency-Key: payment-1001` and change the Postman body.

```json
{
  "amount": 500,
  "currency": "GHS"
}
```

The server returns `409 Conflict` with this required message.

```http
X-Idempotency-Status: conflict
```

```json
{
  "message": "Idempotency key already used for a different request body."
}
```

This protects FinSafe from accidental or dishonest changes to an existing
payment request.

![Same idempotency key with a different payment returning 409 Conflict](docs/images/SameKey.png)

## Bonus User Story: The In Flight Check

Open the same new payment request in two Postman tabs. Give both requests the
same unused key and the same body. Send both requests within the two second
processing period.

The first request processes the payment. The second request waits for the first
request, does not return a conflict, and then returns the saved response with
`X-Cache-Hit: true` and `X-Idempotency-Status: replayed-after-wait`. Only one
payment record is created.

## The Developer's Choice Challenge

### API Rate Limiting

I added API rate limiting to protect FinSafe from abuse, accidental retry storms,
and incorrectly configured client applications. Each client can send twenty
requests per minute by default. When the limit is exceeded, the API returns
`429 Too Many Requests` with a `Retry-After` header. This keeps the payment API
responsive when traffic becomes unusually high.

To test this in Postman, temporarily set `RATE_LIMIT_MAX=3` and restart the
server. Send four payment requests from the same computer using a different
idempotency key for each request. The fourth request returns `429 Too Many
Requests`. All four requests must be sent inside the same clock minute because
the counter resets when the next minute begins. The response headers
`RateLimit-Limit` and `RateLimit-Remaining` show the active limit and remaining
requests. A blocked request also returns `Retry-After`. Restore the value to
twenty and restart the server after the test.

![Rate limit exceeded response returning 429](docs/images/ratelimit.png)

### Idempotency Record Expiration

I added idempotency record expiration so completed and failed records do not stay
in the database forever. Records expire after twenty four hours by default.
Active payments with a `PROCESSING` state are never removed. This reduces storage
growth while allowing an old key to be reused after the retention period.

The retention period is controlled by `IDEMPOTENCY_TTL_HOURS`. For a quick
PostgreSQL demonstration, set the value to one, complete a payment, and change
its saved time to more than one hour ago.

```sql
UPDATE idempotency_records
SET updated_at = NOW() - INTERVAL '2 hours'
WHERE idempotency_key = 'payment-1001';
```

Send another Postman request. Before processing it, the service removes the old
completed idempotency record and its related payment. A record that is still
processing remains protected.





## Conclusion

FinSafe demonstrates a practical pay once payment protocol. It safely processes
the first payment, replays duplicate responses, rejects changed requests, waits
for in flight transactions, limits abusive traffic, and removes expired records.
These controls keep payment retries safe while keeping the project simple to run
and review.
