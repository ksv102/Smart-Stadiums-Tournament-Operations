'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { createServer } = require('node:http');

/**
 * Boots the Express app on an ephemeral port for the duration of a test,
 * and tears it down afterward. Using node:test's t.after keeps this
 * self-contained per test rather than relying on global setup/teardown.
 */
function withServer(t, envOverrides = {}) {
  const previousEnv = { ...process.env };
  Object.assign(process.env, envOverrides);

  // Re-require fresh so env-dependent modules (auth) pick up overrides.
  delete require.cache[require.resolve('../server')];
  delete require.cache[require.resolve('../src/auth')];
  const app = require('../server');

  const server = createServer(app);
  server.listen(0);

  t.after(() => {
    server.close();
    process.env = previousEnv;
  });

  return new Promise((resolve) => {
    server.on('listening', () => {
      const { port } = server.address();
      resolve(`http://127.0.0.1:${port}`);
    });
  });
}

test('GET /api/state returns venue state without auth', async (t) => {
  const base = await withServer(t);
  const res = await fetch(`${base}/api/state`);
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.ok(Array.isArray(body.gates));
});

test('GET /api/dashboard returns state, plan, and briefing together', async (t) => {
  const base = await withServer(t);
  const res = await fetch(`${base}/api/dashboard`);
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.ok(body.state);
  assert.ok(body.plan);
  assert.ok(body.briefing);
});

test('POST /api/tick succeeds without a key when ORION_API_KEY is unset', async (t) => {
  const base = await withServer(t, { ORION_API_KEY: '' });
  const res = await fetch(`${base}/api/tick`, { method: 'POST' });
  assert.equal(res.status, 200);
});

test('POST /api/tick is rejected without a key when ORION_API_KEY is set', async (t) => {
  const base = await withServer(t, { ORION_API_KEY: 'secret123' });
  const res = await fetch(`${base}/api/tick`, { method: 'POST' });
  assert.equal(res.status, 401);
});

test('POST /api/tick succeeds with the correct key when ORION_API_KEY is set', async (t) => {
  const base = await withServer(t, { ORION_API_KEY: 'secret123' });
  const res = await fetch(`${base}/api/tick`, {
    method: 'POST',
    headers: { 'x-api-key': 'secret123' },
  });
  assert.equal(res.status, 200);
});

test('POST /api/incidents rejects an invalid payload with 400', async (t) => {
  const base = await withServer(t, { ORION_API_KEY: '' });
  const res = await fetch(`${base}/api/incidents`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ type: 'not-a-real-type', severity: 'severe', locationLabel: 'X' }),
  });
  assert.equal(res.status, 400);
});

test('POST /api/incidents accepts a valid payload and returns it', async (t) => {
  const base = await withServer(t, { ORION_API_KEY: '' });
  const res = await fetch(`${base}/api/incidents`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ type: 'medical', severity: 'severe', locationLabel: 'Section 114' }),
  });
  assert.equal(res.status, 201);
  const body = await res.json();
  assert.equal(body.type, 'medical');
  assert.equal(body.status, 'open');
});

test('POST /api/incidents/:id/resolve rejects a malformed id with 400', async (t) => {
  const base = await withServer(t, { ORION_API_KEY: '' });
  const res = await fetch(`${base}/api/incidents/${encodeURIComponent('../../etc/passwd')}/resolve`, {
    method: 'POST',
  });
  assert.equal(res.status, 400);
});

test('POST /api/staff/:id/status rejects an invalid status value', async (t) => {
  const base = await withServer(t, { ORION_API_KEY: '' });
  const res = await fetch(`${base}/api/staff/stf-1/status`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status: 'on-fire' }),
  });
  assert.equal(res.status, 400);
});

test('security headers are present on responses', async (t) => {
  const base = await withServer(t);
  const res = await fetch(`${base}/api/state`);
  assert.ok(res.headers.get('content-security-policy'));
  assert.equal(res.headers.get('x-content-type-options'), 'nosniff');
});

test('unknown API route returns 404, not a stack trace', async (t) => {
  const base = await withServer(t);
  const res = await fetch(`${base}/api/does-not-exist`);
  assert.equal(res.status, 404);
  const body = await res.json();
  assert.equal(body.error, 'Not found');
});
