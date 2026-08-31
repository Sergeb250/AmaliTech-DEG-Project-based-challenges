const express = require("express");
const normalizeUrl = require("./middleware/normalize-url");
const requestId = require("./middleware/request-id");
const { createRateLimiter } = require("./middleware/rate-limiter");
const { notFound, errorHandler } = require("./middleware/error-handler");
const { createPaymentRouter } = require("./routes/payment.routes");

function createApp({ service, rateLimitRepository, rateLimitMax } = {}) {
  const app = express();
  app.disable("x-powered-by");

  app.use(normalizeUrl);
  app.use(express.json({ limit: "10kb" }));
  app.use(requestId);
  app.get("/health", (_req, res) => {
    res.status(200).json({ status: "ok" });
  });
  app.use(
    "/process-payment",
    createRateLimiter({
      repository: rateLimitRepository,
      maxRequests: rateLimitMax
    }),
    createPaymentRouter(service)
  );

  app.use(notFound);
  app.use(errorHandler);
  return app;
}

module.exports = { createApp };
