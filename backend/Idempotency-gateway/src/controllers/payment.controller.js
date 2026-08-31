const { idempotencyService } = require("../services/idempotency.service");

function validationError(message) {
  const error = new Error(message);
  error.statusCode = 400;
  return error;
}

function hasAtMostTwoDecimals(value) {
  return Math.abs(value * 100 - Math.round(value * 100)) < 1e-8;
}

function validateRequest(req) {
  const idempotencyKey = req.get("Idempotency-Key");
  if (!idempotencyKey || !idempotencyKey.trim()) {
    throw validationError("Idempotency-Key header is required.");
  }
  if (idempotencyKey.trim().length > 255) {
    throw validationError("Idempotency-Key must not exceed 255 characters.");
  }

  const body = req.body;
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw validationError("Request body must be a JSON object.");
  }

  const fields = Object.keys(body);
  if (
    fields.length !== 2 ||
    !fields.includes("amount") ||
    !fields.includes("currency")
  ) {
    throw validationError("Request body must contain only amount and currency.");
  }

  if (
    typeof body.amount !== "number" ||
    !Number.isFinite(body.amount) ||
    body.amount <= 0 ||
    !hasAtMostTwoDecimals(body.amount)
  ) {
    throw validationError("Amount must be a positive number with at most two decimals.");
  }

  if (typeof body.currency !== "string" || !/^[A-Za-z]{3}$/.test(body.currency)) {
    throw validationError("Currency must be a three-letter code.");
  }

  return {
    idempotencyKey: idempotencyKey.trim(),
    amount: body.amount,
    currency: body.currency.toUpperCase()
  };
}

function createPaymentController(service = idempotencyService) {
  return {
    async processPayment(req, res, next) {
      try {
        const request = validateRequest(req);
        const result = await service.handle(request);

        res.set("X-Cache-Hit", String(result.cacheHit));
        res.set("X-Idempotency-Status", result.idempotencyStatus);
        return res.status(result.statusCode).json(result.body);
      } catch (error) {
        return next(error);
      }
    }
  };
}

module.exports = { createPaymentController, validateRequest };
