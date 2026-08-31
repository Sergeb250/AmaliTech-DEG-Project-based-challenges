const rateLimitRepository = require("../repositories/rate-limit.repository");
const { environment } = require("../config/environment");

function createRateLimiter({
  repository = rateLimitRepository,
  maxRequests = environment.rateLimitMax
} = {}) {
  return async function rateLimiter(req, res, next) {
    try {
      const clientKey = req.ip || req.socket.remoteAddress || "unknown";
      const result = await repository.increment(clientKey);
      const remaining = Math.max(0, maxRequests - result.count);

      res.set("RateLimit-Limit", String(maxRequests));
      res.set("RateLimit-Remaining", String(remaining));
      res.set("RateLimit-Reset", String(result.retryAfter));

      if (result.count > maxRequests) {
        res.set("Retry-After", String(result.retryAfter));
        return res.status(429).json({
          status: 429,
          error: "Too Many Requests",
          message: "Rate limit exceeded. Please retry later.",
          requestId: req.requestId
        });
      }

      return next();
    } catch (error) {
      return next(error);
    }
  };
}

module.exports = { createRateLimiter };
