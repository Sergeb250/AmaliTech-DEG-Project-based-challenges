const path = require("path");
const dotenv = require("dotenv");

dotenv.config({ path: path.resolve(process.cwd(), ".env"), quiet: true });

function positiveInteger(value, fallback, name) {
  if (value === undefined || value === "") {
    return fallback;
  }

  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${name} must be a positive integer.`);
  }

  return parsed;
}

const environment = {
  nodeEnv: process.env.NODE_ENV || "development",
  port: positiveInteger(process.env.PORT, 3000, "PORT"),
  databaseUrl: process.env.DATABASE_URL || "",
  sqlitePath: process.env.SQLITE_PATH || "./data/finsafe.sqlite",
  idempotencyTtlHours: positiveInteger(
    process.env.IDEMPOTENCY_TTL_HOURS,
    24,
    "IDEMPOTENCY_TTL_HOURS"
  ),
  rateLimitMax: positiveInteger(process.env.RATE_LIMIT_MAX, 20, "RATE_LIMIT_MAX"),
  processingDelayMs: positiveInteger(
    process.env.PROCESSING_DELAY_MS,
    2000,
    "PROCESSING_DELAY_MS"
  ),
  inFlightTimeoutMs: positiveInteger(
    process.env.IN_FLIGHT_TIMEOUT_MS,
    10000,
    "IN_FLIGHT_TIMEOUT_MS"
  ),
  inFlightPollMs: positiveInteger(
    process.env.IN_FLIGHT_POLL_MS,
    100,
    "IN_FLIGHT_POLL_MS"
  )
};

function validateEnvironment() {
  return environment;
}

module.exports = { environment, validateEnvironment };
