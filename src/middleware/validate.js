'use strict';

/**
 * Shared request-validation helpers. Kept in one place so every route
 * validates identifiers and payloads the same way, rather than each route
 * file inventing its own rules.
 */

const ID_PATTERN = /^[a-zA-Z0-9_-]{1,64}$/;

/**
 * Express middleware factory: rejects requests whose named route param
 * doesn't match a safe identifier shape, before it ever reaches a data
 * lookup. Defense-in-depth — the in-memory store only ever does equality
 * checks, so this isn't closing an injection hole, but it stops malformed
 * or oversized input from reaching application logic at all.
 *
 * @param {string} paramName
 */
function validIdParam(paramName) {
  return function (req, res, next) {
    const value = req.params[paramName];
    if (typeof value !== 'string' || !ID_PATTERN.test(value)) {
      return res.status(400).json({ error: `Invalid ${paramName}` });
    }
    return next();
  };
}

const VALID_INCIDENT_TYPES = [
  'medical',
  'fire',
  'security_threat',
  'crowd_crush',
  'lost_person',
  'facilities',
];
const VALID_SEVERITIES = ['minor', 'moderate', 'severe', 'critical'];

/**
 * @param {unknown} body
 * @returns {boolean}
 */
function isValidIncident(body) {
  return (
    !!body &&
    typeof body === 'object' &&
    typeof body.locationLabel === 'string' &&
    body.locationLabel.trim().length > 0 &&
    body.locationLabel.length < 100 &&
    VALID_INCIDENT_TYPES.includes(body.type) &&
    VALID_SEVERITIES.includes(body.severity)
  );
}

module.exports = {
  validIdParam,
  isValidIncident,
  VALID_INCIDENT_TYPES,
  VALID_SEVERITIES,
};
