'use strict';

/**
 * Express middleware that captures the raw request body as a string
 * and attaches it to req.rawBody.
 *
 * Must be registered BEFORE express.json() for the webhook route.
 */
function rawBodyMiddleware(req, res, next) {
  let data = '';
  req.setEncoding('utf8');
  req.on('data', (chunk) => { data += chunk; });
  req.on('end', () => {
    req.rawBody = data;
    next();
  });
}

module.exports = rawBodyMiddleware;
