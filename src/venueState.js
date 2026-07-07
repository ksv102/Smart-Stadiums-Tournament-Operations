'use strict';

/**
 * In-memory venue state + a simple simulation tick.
 * Stands in for real turnstile/CCTV/IoT feeds for demo purposes.
 */

let state = null;

/**
 * (Re)seeds the venue to its initial demo state: four gates and six staff
 * members, no open incidents.
 * @returns {object} the freshly seeded state.
 */
function seed() {
  state = {
    gates: [
      { id: 'gate-a', name: 'Gate A (North)', capacity: 4000, currentOccupancy: 1200 },
      { id: 'gate-b', name: 'Gate B (East)', capacity: 3000, currentOccupancy: 2650 },
      { id: 'gate-c', name: 'Gate C (South)', capacity: 3500, currentOccupancy: 900 },
      { id: 'gate-d', name: 'Gate D (West)', capacity: 2500, currentOccupancy: 2450 },
    ],
    staff: [
      {
        id: 'stf-1',
        name: 'A. Reyes',
        role: 'medical',
        status: 'available',
        location: { x: 10, y: 5 },
      },
      {
        id: 'stf-2',
        name: 'J. Okafor',
        role: 'security',
        status: 'available',
        location: { x: 40, y: 20 },
      },
      {
        id: 'stf-3',
        name: 'M. Singh',
        role: 'steward',
        status: 'available',
        location: { x: 25, y: 15 },
      },
      {
        id: 'stf-4',
        name: 'L. Fischer',
        role: 'security',
        status: 'busy',
        location: { x: 5, y: 30 },
      },
      {
        id: 'stf-5',
        name: 'R. Costa',
        role: 'steward',
        status: 'available',
        location: { x: 45, y: 5 },
      },
      {
        id: 'stf-6',
        name: 'P. Novak',
        role: 'medical',
        status: 'busy',
        location: { x: 30, y: 35 },
      },
    ],
    incidents: [],
    incidentSeq: 1,
  };
  return state;
}

/**
 * @returns {object} the current venue state, seeding it on first call.
 */
function getState() {
  if (!state) seed();
  return state;
}

/**
 * @returns {object} the venue reset back to its seeded initial state.
 */
function reset() {
  return seed();
}

/**
 * Advance the simulation by one tick: nudge occupancy randomly to mimic
 * a live match crowd flow (arrivals build up pre-match, then plateau).
 */
function tick() {
  const s = getState();
  s.gates.forEach((g) => {
    const drift = Math.round((Math.random() - 0.35) * 150);
    g.currentOccupancy = Math.max(0, Math.min(g.capacity, g.currentOccupancy + drift));
  });
  return s;
}

/**
 * Records a newly-reported incident and adds it to the venue's open list.
 * @param {{type: string, severity: string, locationLabel: string, x?: number, y?: number}} params
 * @returns {object} the created incident.
 */
function addIncident({ type, severity, locationLabel, x, y }) {
  const s = getState();
  const incident = {
    id: `inc-${s.incidentSeq++}`,
    type,
    severity,
    status: 'open',
    location: {
      label: locationLabel,
      x: x ?? Math.random() * 50,
      y: y ?? Math.random() * 40,
    },
    reportedAt: new Date().toISOString(),
  };
  s.incidents.push(incident);
  return incident;
}

/**
 * Marks an incident resolved by id.
 * @param {string} id
 * @returns {object | null} the updated incident, or null if not found.
 */
function resolveIncident(id) {
  const s = getState();
  const incident = s.incidents.find((i) => i.id === id);
  if (!incident) return null;
  incident.status = 'resolved';
  incident.resolvedAt = new Date().toISOString();
  return incident;
}

/**
 * Updates a staff member's availability.
 * @param {string} id
 * @param {'available' | 'busy'} status
 * @returns {object | null} the updated staff member, or null if not found.
 */
function setStaffStatus(id, status) {
  const s = getState();
  const staff = s.staff.find((st) => st.id === id);
  if (!staff) return null;
  staff.status = status;
  return staff;
}

module.exports = {
  getState,
  reset,
  tick,
  addIncident,
  resolveIncident,
  setStaffStatus,
};
