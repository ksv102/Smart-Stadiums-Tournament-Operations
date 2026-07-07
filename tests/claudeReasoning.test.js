'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { narrate, templateBriefing } = require('../src/claudeReasoning');

test('templateBriefing reports "no action" when plan is empty', () => {
  const text = templateBriefing({ actions: [] });
  assert.match(text, /no action required/i);
});

test('templateBriefing lists actions in priority order given', () => {
  const plan = {
    actions: [
      { type: 'ESCALATE_CROWD_CONTROL', reason: 'Gate B critical' },
      { type: 'OPEN_AUXILIARY_LANE', reason: 'Gate D high' },
    ],
  };
  const text = templateBriefing(plan);
  assert.match(text, /ESCALATE_CROWD_CONTROL/);
  assert.match(text, /Gate B critical/);
});

test('narrate falls back to template when no API key is configured', async () => {
  const originalKey = process.env.ANTHROPIC_API_KEY;
  delete process.env.ANTHROPIC_API_KEY;

  const plan = { actions: [] };
  const result = await narrate(plan);

  assert.equal(result.source, 'template');
  assert.match(result.text, /no action required/i);

  if (originalKey) process.env.ANTHROPIC_API_KEY = originalKey;
});
