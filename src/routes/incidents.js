'use strict';

const express = require('express');
const venue = require('../venueState');
const { writeLimiter } = require('../middleware/rateLimiters');
const { requireApiKey } = require('../auth');
const { validIdParam, isValidIncident } = require('../middleware/validate');

const router = express.Router();

/** POST /api/incidents — report a new incident. */
router.post('/', writeLimiter, requireApiKey, (req, res) => {
  if (!isValidIncident(req.body)) {
    return res.status(400).json({ error: 'Invalid incident payload' });
  }
  const incident = venue.addIncident(req.body);
  return res.status(201).json(incident);
});

/** POST /api/incidents/:id/resolve — mark an incident resolved. */
router.post(
  '/:id/resolve',
  writeLimiter,
  requireApiKey,
  validIdParam('id'),
  (req, res) => {
    const incident = venue.resolveIncident(req.params.id);
    if (!incident) return res.status(404).json({ error: 'Incident not found' });
    return res.json(incident);
  }
);

module.exports = router;
