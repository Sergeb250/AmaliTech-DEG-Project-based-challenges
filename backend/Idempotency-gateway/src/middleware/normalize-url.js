function normalizeUrl(req, _res, next) {
  const queryIndex = req.url.indexOf("?");
  const pathname = queryIndex === -1 ? req.url : req.url.slice(0, queryIndex);
  const query = queryIndex === -1 ? "" : req.url.slice(queryIndex);
  const normalizedPath = pathname.replace(
    /(?:(?:%0A|%0D|%09|%20))+(\/?)$/gi,
    "$1"
  );

  if (normalizedPath !== pathname) {
    req.url = normalizedPath + query;
  }

  next();
}

module.exports = normalizeUrl;
