const idempotencyRepository = require("../repositories/idempotency.repository");
const { paymentService } = require("./payment.service");
const { environment } = require("../config/environment");

function serviceError(statusCode, message, idempotencyStatus) {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.idempotencyStatus = idempotencyStatus;
  return error;
}

function samePayment(record, amount, currency) {
  return Number(record.amount) === Number(amount) && record.currency === currency;
}

function savedResult(record, idempotencyStatus = "replayed") {
  return {
    statusCode: record.responseStatus,
    body: record.responseBody,
    cacheHit: true,
    idempotencyStatus
  };
}

function createIdempotencyService({
  idempotencyRepo = idempotencyRepository,
  processor = paymentService,
  pollMs = environment.inFlightPollMs,
  timeoutMs = environment.inFlightTimeoutMs,
  ttlHours = environment.idempotencyTtlHours
} = {}) {
  async function waitForResult(idempotencyKey, amount, currency) {
    const deadline = Date.now() + timeoutMs;

    while (Date.now() < deadline) {
      await new Promise((resolve) => setTimeout(resolve, pollMs));
      const record = await idempotencyRepo.findByKey(idempotencyKey);

      if (!record) {
        throw serviceError(503, "Payment processing state is unavailable.");
      }

      if (!samePayment(record, amount, currency)) {
        throw serviceError(
          409,
          "Idempotency key already used for a different request body.",
          "conflict"
        );
      }

      if (record.processingStatus !== "PROCESSING") {
        return savedResult(record, "replayed-after-wait");
      }
    }

    throw serviceError(
      503,
      "The original payment request is still processing. Please retry later."
    );
  }

  return {
    async handle({ idempotencyKey, amount, currency }) {
      await idempotencyRepo.deleteExpired(ttlHours);
      const normalizedAmount = Number(amount).toFixed(2);
      const record = await idempotencyRepo.createProcessing({
        idempotencyKey,
        amount: normalizedAmount,
        currency
      });

      if (record) {
        try {
          const result = await processor.process(record);
          return {
            ...result,
            cacheHit: false,
            idempotencyStatus: "created"
          };
        } catch {
          const body = { message: "Payment processing failed." };
          await idempotencyRepo.markFailed(record.id, 500, body);
          return {
            statusCode: 500,
            body,
            cacheHit: false,
            idempotencyStatus: "failed"
          };
        }
      }

      const existing = await idempotencyRepo.findByKey(idempotencyKey);
      if (!existing) {
        throw serviceError(503, "Payment processing state is unavailable.");
      }

      if (!samePayment(existing, normalizedAmount, currency)) {
        throw serviceError(
          409,
          "Idempotency key already used for a different request body.",
          "conflict"
        );
      }

      if (existing.processingStatus === "PROCESSING") {
        return waitForResult(idempotencyKey, normalizedAmount, currency);
      }

      return savedResult(existing);
    }
  };
}

module.exports = {
  createIdempotencyService,
  idempotencyService: createIdempotencyService()
};
