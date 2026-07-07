'use strict';

const path = require('path');
const express = require('express');
const venue = require('./src/venueState');
const rules = require('./src/rulesEngine');
const reasoning = require('./src/claudeReasoning');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: '100kb' })); // small limit: this API never needs large payloads
app.use(express.static(path.join(__dirname, 'public')));

// Basic request validation helpers -----------------------------------------

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

// Routes ---------------------------------------------------------------

app.get('/api/state', (req, res) => {
  res.json(venue.getState());
});

app.post('/api/tick', (req, res) => {
  res.json(venue.tick());
});

app.post('/api/incidents', (req, res) => {
  if (!isValidIncident(req.body)) {
    return res.status(400).json({ error: 'Invalid incident payload' });
  }
  const incident = venue.addIncident(req.body);
  res.status(201).json(incident);
});

app.post('/api/incidents/:id/resolve', (req, res) => {
  const incident = venue.resolveIncident(req.params.id);
  if (!incident) return res.status(404).json({ error: 'Incident not found' });
  res.json(incident);
});

app.post('/api/staff/:id/status', (req, res) => {
  const { status } = req.body || {};
  if (!['available', 'busy'].includes(status)) {
    return res.status(400).json({ error: 'status must be "available" or "busy"' });
  }
  const staff = venue.setStaffStatus(req.params.id, status);
  if (!staff) return res.status(404).json({ error: 'Staff not found' });
  res.json(staff);
});

app.get('/api/plan', (req, res) => {
  const state = venue.getState();
  const plan = rules.buildActionPlan(state);
  res.json(plan);
});

app.get('/api/briefing', async (req, res) => {
  const state = venue.getState();
  const plan = rules.buildActionPlan(state);
  const briefing = await reasoning.narrate(plan);
  res.json({ plan, briefing });
});

app.post('/api/reset', (req, res) => {
  res.json(venue.reset());
});

// Central error handler so a bad request never leaks a stack trace
app.use((err, req, res, next) => {
  console.error(err); // eslint-disable-line no-console
  res.status(500).json({ error: 'Internal server error' });
});

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`ORION stadium ops assistant running on http://localhost:${PORT}`); // eslint-disable-line no-console
  });
}

module.exports = app;
