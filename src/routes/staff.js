'use strict';

const express = require('express');
const venue = require('../venueState');
const { writeLimiter } = require('../middleware/rateLimiters');
const { requireApiKey } = require('../auth');
const { validIdParam } = require('../middleware/validate');

const router = express.Router();

const VALID_STAFF_STATUSES = ['available', 'busy'];

/** POST /api/staff/:id/status — update a staff member's availability. */
router.post(
  '/:id/status',
  writeLimiter,
  requireApiKey,
  validIdParam('id'),
  (req, res) => {
    const { status } = req.body || {};
    if (!VALID_STAFF_STATUSES.includes(status)) {
      return res.status(400).json({ error: 'status must be "available" or "busy"' });
    }
    const staff = venue.setStaffStatus(req.params.id, status);
    if (!staff) return res.status(404).json({ error: 'Staff not found' });
    return res.json(staff);
  }
);

module.exports = router;
