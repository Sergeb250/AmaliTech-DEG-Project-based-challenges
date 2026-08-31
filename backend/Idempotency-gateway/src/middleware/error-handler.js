const STATUS_NAMES = {
  400: "Bad Request",
  404: "Not Found",
  409: "Conflict",
  413: "Payload Too Large",
  429: "Too Many Requests",
  500: "Internal Server Error",
  503: "Service Unavailable"
};

function notFound(req, _res, next) {
  const error = new Error(`Route ${req.method} ${req.originalUrl} was not found.`);
  error.statusCode = 404;
  next(error);
}

function errorHandler(error, req, res, _next) {
  const isInvalidJson = error instanceof SyntaxError && error.status === 400;
  const statusCode = isInvalidJson ? 400 : error.statusCode || error.status || 500;
  const safeMessage =
    statusCode >= 500 && !error.statusCode
      ? "An unexpected server error occurred."
      : isInvalidJson
        ? "Request body must contain valid JSON."
        : error.message;

  if (statusCode >= 500) {
    console.error(`[${req.requestId}]`, error);
  }

  if (error.idempotencyStatus) {
    res.set("X-Idempotency-Status", error.idempotencyStatus);
  }

  res.status(statusCode).json({
    status: statusCode,
    error: STATUS_NAMES[statusCode] || "Error",
    message: safeMessage,
    requestId: req.requestId
  });
}

module.exports = { notFound, errorHandler };
