const { randomUUID } = require("crypto");

function requestId(req, res, next) {
  const id = req.get("X-Request-Id") || randomUUID();
  req.requestId = id;
  res.set("X-Request-Id", id);
  next();
}

module.exports = requestId;
