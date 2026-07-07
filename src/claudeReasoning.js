'use strict';

/**
 * Narration layer. Takes an ALREADY-DECIDED action plan from rulesEngine.js
 * and produces a short, staff-facing briefing in plain language.
 *
 * This module never chooses actions — it only explains actions it's given.
 * If no API key is configured, or the API call fails for any reason, it
 * falls back to a deterministic template so the assistant keeps working
 * (operations tooling should never hard-fail because a network call did).
 */

let Anthropic = null;
try {
  // Lazy require so the app still boots if the package isn't installed yet.
  Anthropic = require('@anthropic-ai/sdk');
} catch {
  Anthropic = null;
}

// Cache the last narration by a fingerprint of the plan's actions, so a UI
// that polls frequently doesn't trigger a fresh (and, with an API key, a
// billed) Claude call when nothing about the situation has changed.
const CACHE_TTL_MS = 15_000;
let lastCache = { fingerprint: null, result: null, expiresAt: 0 };

function fingerprintPlan(plan) {
  return JSON.stringify(
    plan.actions.map((a) => [a.type, a.target, a.priority, a.assignedStaffId ?? null])
  );
}

function templateBriefing(plan) {
  if (plan.actions.length === 0) {
    return 'All gates and incidents are within normal parameters. No action required.';
  }
  const lines = plan.actions
    .slice(0, 5)
    .map((a, i) => `${i + 1}. [${a.type}] ${a.reason}`);
  return `Priority actions:\n${lines.join('\n')}`;
}

async function narrate(plan) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey || !Anthropic) {
    return { text: templateBriefing(plan), source: 'template' };
  }

  const fingerprint = fingerprintPlan(plan);
  const now = Date.now();
  if (lastCache.fingerprint === fingerprint && now < lastCache.expiresAt) {
    return { ...lastCache.result, cached: true };
  }

  try {
    const client = new Anthropic({ apiKey });
    const prompt = [
      'You are briefing a stadium operations coordinator during a live match.',
      'The action plan below was already decided by a rules engine — do not',
      'change, add, or remove any action. Just summarize it clearly in under',
      '80 words, in priority order, for a coordinator who has seconds to read it.',
      '',
      JSON.stringify(plan, null, 2),
    ].join('\n');

    const response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 300,
      messages: [{ role: 'user', content: prompt }],
    });

    const text = response.content
      .filter((block) => block.type === 'text')
      .map((block) => block.text)
      .join('\n')
      .trim();

    const result = { text: text || templateBriefing(plan), source: 'claude' };
    lastCache = { fingerprint, result, expiresAt: now + CACHE_TTL_MS };
    return result;
  } catch (err) {
    // Never let a narration failure break the operational tool.
    return { text: templateBriefing(plan), source: 'template-fallback', error: err.message };
  }
}

module.exports = { narrate, templateBriefing };
