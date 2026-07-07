'use strict';

/**
 * Deterministic decision logic for stadium operations.
 *
 * DESIGN PRINCIPLE: safety-critical decisions (opening gates, escalating
 * incidents, dispatching staff) are made ONLY by these explicit rules.
 * The LLM layer (see claudeReasoning.js) is never asked to decide an
 * action — only to phrase/explain decisions this module already made.
 * This keeps the system auditable and removes hallucination risk from
 * the safety path.
 */

const CROWD_THRESHOLDS = {
  LOW: 0.4,
  MODERATE: 0.7,
  HIGH: 0.9,
};

const INCIDENT_WEIGHT = {
  minor: 1,
  moderate: 2,
  severe: 3,
  critical: 4,
};

const ROLE_FOR_INCIDENT = {
  medical: 'medical',
  fire: 'security', // security coordinates evacuation until fire crew arrives
  security_threat: 'security',
  crowd_crush: 'security',
  lost_person: 'steward',
  facilities: 'steward',
};

function crowdLevel(occupancyRatio) {
  if (occupancyRatio >= CROWD_THRESHOLDS.HIGH) return 'CRITICAL';
  if (occupancyRatio >= CROWD_THRESHOLDS.MODERATE) return 'HIGH';
  if (occupancyRatio >= CROWD_THRESHOLDS.LOW) return 'MODERATE';
  return 'LOW';
}

/**
 * Evaluate a single gate and return zero or more recommended actions.
 */
function evaluateGate(gate) {
  const ratio = gate.currentOccupancy / gate.capacity;
  const level = crowdLevel(ratio);
  const actions = [];

  if (level === 'HIGH') {
    actions.push({
      type: 'OPEN_AUXILIARY_LANE',
      target: gate.id,
      priority: 2,
      reason: `${gate.name} at ${(ratio * 100).toFixed(0)}% capacity`,
    });
  }

  if (level === 'CRITICAL') {
    actions.push({
      type: 'ESCALATE_CROWD_CONTROL',
      target: gate.id,
      priority: 4,
      reason: `${gate.name} at ${(ratio * 100).toFixed(0)}% capacity — crush risk`,
    });
  }

  return { level, ratio, actions };
}

/**
 * Evaluate an incident and determine the required response role and priority.
 */
function evaluateIncident(incident) {
  const weight = INCIDENT_WEIGHT[incident.severity] ?? 1;
  const requiredRole = ROLE_FOR_INCIDENT[incident.type] ?? 'steward';

  return {
    requiredRole,
    priority: weight,
    escalate: weight >= INCIDENT_WEIGHT.severe,
  };
}

/**
 * Given available staff and a required role, pick the best candidate:
 * available, matching role, closest to the incident location.
 * Returns null if nobody suitable is free.
 */
function selectStaff(staffRoster, requiredRole, location) {
  const candidates = staffRoster.filter(
    (s) => s.role === requiredRole && s.status === 'available'
  );
  if (candidates.length === 0) return null;

  candidates.sort((a, b) => {
    const da = distance(a.location, location);
    const db = distance(b.location, location);
    return da - db;
  });

  return candidates[0];
}

function distance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/**
 * Top-level: build a prioritized action plan from full venue state.
 */
function buildActionPlan(state) {
  const gateResults = state.gates.map((g) => ({ gate: g, ...evaluateGate(g) }));
  const gateActions = gateResults.flatMap((r) => r.actions);

  const incidentActions = state.incidents
    .filter((i) => i.status === 'open')
    .map((incident) => {
      const evalResult = evaluateIncident(incident);
      const staff = selectStaff(
        state.staff,
        evalResult.requiredRole,
        incident.location
      );
      return {
        type: staff ? 'DISPATCH_STAFF' : 'REQUEST_MUTUAL_AID',
        target: incident.id,
        priority: evalResult.priority + (evalResult.escalate ? 1 : 0),
        assignedStaffId: staff ? staff.id : null,
        requiredRole: evalResult.requiredRole,
        reason: staff
          ? `${incident.type} (${incident.severity}) at ${incident.location.label} — nearest ${evalResult.requiredRole} available`
          : `${incident.type} (${incident.severity}) at ${incident.location.label} — no ${evalResult.requiredRole} free, requesting mutual aid`,
      };
    });

  const allActions = [...gateActions, ...incidentActions].sort(
    (a, b) => b.priority - a.priority
  );

  return {
    generatedAt: new Date().toISOString(),
    gateStatus: gateResults.map((r) => ({
      id: r.gate.id,
      name: r.gate.name,
      level: r.level,
      occupancyPct: Math.round(r.ratio * 100),
    })),
    actions: allActions,
  };
}

module.exports = {
  crowdLevel,
  evaluateGate,
  evaluateIncident,
  selectStaff,
  buildActionPlan,
  CROWD_THRESHOLDS,
  INCIDENT_WEIGHT,
  ROLE_FOR_INCIDENT,
};
