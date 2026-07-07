'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  crowdLevel,
  evaluateGate,
  evaluateIncident,
  selectStaff,
  buildActionPlan,
} = require('../src/rulesEngine');

test('crowdLevel classifies occupancy ratios correctly', () => {
  assert.equal(crowdLevel(0.1), 'LOW');
  assert.equal(crowdLevel(0.5), 'MODERATE');
  assert.equal(crowdLevel(0.8), 'HIGH');
  assert.equal(crowdLevel(0.95), 'CRITICAL');
});

test('evaluateGate recommends auxiliary lane at HIGH occupancy', () => {
  const gate = { id: 'g1', name: 'Gate 1', capacity: 100, currentOccupancy: 80 };
  const result = evaluateGate(gate);
  assert.equal(result.level, 'HIGH');
  assert.ok(result.actions.some((a) => a.type === 'OPEN_AUXILIARY_LANE'));
});

test('evaluateGate escalates crowd control at CRITICAL occupancy', () => {
  const gate = { id: 'g1', name: 'Gate 1', capacity: 100, currentOccupancy: 95 };
  const result = evaluateGate(gate);
  assert.equal(result.level, 'CRITICAL');
  assert.ok(result.actions.some((a) => a.type === 'ESCALATE_CROWD_CONTROL'));
});

test('evaluateGate takes no action at LOW occupancy', () => {
  const gate = { id: 'g1', name: 'Gate 1', capacity: 100, currentOccupancy: 20 };
  const result = evaluateGate(gate);
  assert.equal(result.level, 'LOW');
  assert.equal(result.actions.length, 0);
});

test('evaluateIncident maps medical type to medical role', () => {
  const result = evaluateIncident({ type: 'medical', severity: 'moderate' });
  assert.equal(result.requiredRole, 'medical');
  assert.equal(result.escalate, false);
});

test('evaluateIncident escalates severe and critical incidents', () => {
  assert.equal(evaluateIncident({ type: 'fire', severity: 'severe' }).escalate, true);
  assert.equal(evaluateIncident({ type: 'fire', severity: 'critical' }).escalate, true);
  assert.equal(evaluateIncident({ type: 'fire', severity: 'minor' }).escalate, false);
});

test('selectStaff picks the nearest available staff of the required role', () => {
  const staff = [
    { id: 's1', role: 'medical', status: 'available', location: { x: 0, y: 0 } },
    { id: 's2', role: 'medical', status: 'available', location: { x: 10, y: 10 } },
    { id: 's3', role: 'medical', status: 'busy', location: { x: 0.1, y: 0.1 } },
  ];
  const chosen = selectStaff(staff, 'medical', { x: 0, y: 0 });
  assert.equal(chosen.id, 's1');
});

test('selectStaff returns null when nobody suitable is available', () => {
  const staff = [{ id: 's1', role: 'medical', status: 'busy', location: { x: 0, y: 0 } }];
  const chosen = selectStaff(staff, 'medical', { x: 0, y: 0 });
  assert.equal(chosen, null);
});

test('buildActionPlan sorts actions by descending priority', () => {
  const state = {
    gates: [
      { id: 'g1', name: 'Gate 1', capacity: 100, currentOccupancy: 95 }, // CRITICAL, priority 4
      { id: 'g2', name: 'Gate 2', capacity: 100, currentOccupancy: 75 }, // HIGH, priority 2
    ],
    incidents: [],
    staff: [],
  };
  const plan = buildActionPlan(state);
  const priorities = plan.actions.map((a) => a.priority);
  const sorted = [...priorities].sort((a, b) => b - a);
  assert.deepEqual(priorities, sorted);
});

test('buildActionPlan requests mutual aid when no matching staff is free', () => {
  const state = {
    gates: [],
    incidents: [
      {
        id: 'inc-1',
        type: 'medical',
        severity: 'severe',
        status: 'open',
        location: { label: 'Section 100', x: 0, y: 0 },
      },
    ],
    staff: [{ id: 's1', role: 'medical', status: 'busy', location: { x: 0, y: 0 } }],
  };
  const plan = buildActionPlan(state);
  assert.equal(plan.actions[0].type, 'REQUEST_MUTUAL_AID');
});
