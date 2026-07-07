'use strict';

const rateLimit = require('express-rate-limit');

/** Applies to all /api traffic. */
const generalLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 120,
  standardHeaders: true,
  legacyHeaders: false,
});

/** Applies additionally to mutating (write) routes only. */
const writeLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many write requests, please slow down.' },
});

module.exports = { generalLimiter, writeLimiter };
