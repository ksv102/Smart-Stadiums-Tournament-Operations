'use strict';

/**
 * Optional API-key gate for mutating routes (POST/incident/staff actions).
 *
 * If ORION_API_KEY is set in the environment, all mutating requests must
 * include a matching `x-api-key` header. If it's unset, the server runs in
 * open demo mode and logs a warning at boot — this keeps the public demo
 * usable for reviewers out of the box, while giving any real deployment a
 * one-line way to lock it down.
 */

function requireApiKey(req, res, next) {
  const expected = process.env.ORION_API_KEY;
  if (!expected) return next(); // open demo mode

  const provided = req.get('x-api-key');
  if (provided && timingSafeEqual(provided, expected)) return next();

  return res.status(401).json({ error: 'Missing or invalid API key' });
}

// Avoid leaking key length/content via timing differences.
function timingSafeEqual(a, b) {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

module.exports = { requireApiKey };
