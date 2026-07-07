'use strict';

const path = require('path');
const express = require('express');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const venue = require('./src/venueState');
const rules = require('./src/rulesEngine');
const reasoning = require('./src/claudeReasoning');
const { requireApiKey } = require('./src/auth');

const app = express();
const PORT = process.env.PORT || 3000;

// --- Security & performance middleware -------------------------------

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'"],
      connectSrc: ["'self'"],
    },
  },
}));
app.use(compression());
app.use(express.json({ limit: '100kb' })); // small limit: this API never needs large payloads

// General limiter for all API traffic; a tighter limiter guards writes below.
const generalLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 120,
  standardHeaders: true,
  legacyHeaders: false,
});
const writeLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many write requests, please slow down.' },
});

app.use('/api', generalLimiter);
app.use(express.static(path.join(__dirname, 'public')));

if (!process.env.ORION_API_KEY) {
   
  console.warn(
    'ORION_API_KEY is not set — write endpoints are running in open demo mode. ' +
      'Set ORION_API_KEY to require an x-api-key header on mutating requests.'
  );
}

// --- Request validation helpers ---------------------------------------

const VALID_INCIDENT_TYPES = [
  'medical',
  'fire',
  'security_threat',
  'crowd_crush',
  'lost_person',
  'facilities',
];
const VALID_SEVERITIES = ['minor', 'moderate', 'severe', 'critical'];

function isValidIncident(body) {
  return (
    body &&
    typeof body.locationLabel === 'string' &&
    body.locationLabel.trim().length > 0 &&
    body.locationLabel.length < 100 &&
    VALID_INCIDENT_TYPES.includes(body.type) &&
    VALID_SEVERITIES.includes(body.severity)
  );
}

// --- Routes -------------------------------------------------------------

app.get('/api/state', (req, res) => {
  res.json(venue.getState());
});

/**
 * Consolidated read endpoint: state + plan + briefing in a single response.
 * The dashboard previously issued two separate requests (state, briefing)
 * on every refresh; this halves the round trips and lets the narration
 * layer's internal cache (see src/claudeReasoning.js) avoid recomputing
 * or re-calling Claude when nothing about the plan has changed.
 */
app.get('/api/dashboard', async (req, res) => {
  const state = venue.getState();
  const plan = rules.buildActionPlan(state);
  const briefing = await reasoning.narrate(plan);
  res.json({ state, plan, briefing });
});

app.get('/api/plan', (req, res) => {
  const state = venue.getState();
  res.json(rules.buildActionPlan(state));
});

app.get('/api/briefing', async (req, res) => {
  const state = venue.getState();
  const plan = rules.buildActionPlan(state);
  const briefing = await reasoning.narrate(plan);
  res.json({ plan, briefing });
});

app.post('/api/tick', writeLimiter, requireApiKey, (req, res) => {
  res.json(venue.tick());
});

app.post('/api/incidents', writeLimiter, requireApiKey, (req, res) => {
  if (!isValidIncident(req.body)) {
    return res.status(400).json({ error: 'Invalid incident payload' });
  }
  const incident = venue.addIncident(req.body);
  res.status(201).json(incident);
});

app.post('/api/incidents/:id/resolve', writeLimiter, requireApiKey, (req, res) => {
  const incident = venue.resolveIncident(req.params.id);
  if (!incident) return res.status(404).json({ error: 'Incident not found' });
  res.json(incident);
});

app.post('/api/staff/:id/status', writeLimiter, requireApiKey, (req, res) => {
  const { status } = req.body || {};
  if (!['available', 'busy'].includes(status)) {
    return res.status(400).json({ error: 'status must be "available" or "busy"' });
  }
  const staff = venue.setStaffStatus(req.params.id, status);
  if (!staff) return res.status(404).json({ error: 'Staff not found' });
  res.json(staff);
});

app.post('/api/reset', writeLimiter, requireApiKey, (req, res) => {
  res.json(venue.reset());
});

// Central error handler so a bad request never leaks a stack trace
app.use((err, req, res, next) => { // eslint-disable-line no-unused-vars
  console.error(err);  
  res.status(500).json({ error: 'Internal server error' });
});

if (require.main === module) {
  app.listen(PORT, () => {
     
    console.log(`ORION stadium ops assistant running on http://localhost:${PORT}`);
  });
}

module.exports = app;
