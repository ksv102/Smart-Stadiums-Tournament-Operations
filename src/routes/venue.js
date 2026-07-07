'use strict';

const express = require('express');
const venue = require('../venueState');
const rules = require('../rulesEngine');
const reasoning = require('../claudeReasoning');
const { asyncHandler } = require('../middleware/asyncHandler');
const { writeLimiter } = require('../middleware/rateLimiters');
const { requireApiKey } = require('../auth');

const router = express.Router();

/** GET /api/state — raw venue state (gates, staff, incidents). */
router.get('/state', (req, res) => {
  res.json(venue.getState());
});

/**
 * GET /api/dashboard — state + decided action plan + briefing, in one
 * response. Replaces what used to be two separate client round trips.
 */
router.get(
  '/dashboard',
  asyncHandler(async (req, res) => {
    const state = venue.getState();
    const plan = rules.buildActionPlan(state);
    const briefing = await reasoning.narrate(plan);
    res.json({ state, plan, briefing });
  })
);

/** GET /api/plan — the decided action plan only, no narration. */
router.get('/plan', (req, res) => {
  const state = venue.getState();
  res.json(rules.buildActionPlan(state));
});

/** GET /api/briefing — plan + narration only, no full state. */
router.get(
  '/briefing',
  asyncHandler(async (req, res) => {
    const state = venue.getState();
    const plan = rules.buildActionPlan(state);
    const briefing = await reasoning.narrate(plan);
    res.json({ plan, briefing });
  })
);

/** POST /api/tick — advance the crowd-flow simulation by one step. */
router.post('/tick', writeLimiter, requireApiKey, (req, res) => {
  res.json(venue.tick());
});

/** POST /api/reset — reset the venue to its seeded initial state. */
router.post('/reset', writeLimiter, requireApiKey, (req, res) => {
  res.json(venue.reset());
});

module.exports = router;
