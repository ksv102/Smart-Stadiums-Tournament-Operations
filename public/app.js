'use strict';

const $ = (sel) => document.querySelector(sel);
const srStatus = $('#sr-status');

function announce(msg) {
  srStatus.textContent = msg;
}

function updateClock() {
  $('#clock').textContent = new Date().toLocaleTimeString();
}
updateClock();
setInterval(updateClock, 1000);

async function api(path, options) {
  const res = await fetch(path, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Request failed: ${res.status}`);
  }
  return res.json();
}

function renderGates(gateStatus) {
  const grid = $('#gates-grid');
  grid.innerHTML = '';
  gateStatus.forEach((g) => {
    const card = document.createElement('div');
    card.className = `gate-card level-${g.level}`;
    card.setAttribute('role', 'listitem');
    card.innerHTML = `
      <div class="gate-name">${g.name}</div>
      <div class="gate-pct">${g.occupancyPct}%</div>
      <div class="gate-bar"><div class="gate-bar-fill" style="width:${g.occupancyPct}%"></div></div>
    `;
    grid.appendChild(card);
  });
}

function renderActions(actions) {
  const list = $('#actions-list');
  list.innerHTML = '';
  if (actions.length === 0) {
    list.innerHTML = '<li class="empty">No actions needed — all systems nominal.</li>';
    return;
  }
  actions.forEach((a) => {
    const li = document.createElement('li');
    li.className = `p${a.priority}`;
    li.innerHTML = `<span class="action-type">${a.type}</span>${a.reason}`;
    list.appendChild(li);
  });
}

function renderIncidents(incidents) {
  const list = $('#incidents-list');
  list.innerHTML = '';
  if (incidents.length === 0) {
    list.innerHTML = '<li class="empty">No incidents reported.</li>';
    return;
  }
  [...incidents].reverse().forEach((inc) => {
    const li = document.createElement('li');
    const badgeClass = inc.status === 'open' ? 'badge-open' : 'badge-resolved';
    li.innerHTML = `
      <span>${inc.type.replace('_', ' ')} · ${inc.severity} · ${inc.location.label}</span>
      <span style="display:flex; gap:8px; align-items:center;">
        <span class="badge ${badgeClass}">${inc.status}</span>
        ${inc.status === 'open' ? `<button class="btn btn-ghost" data-resolve="${inc.id}" type="button">Resolve</button>` : ''}
      </span>
    `;
    list.appendChild(li);
  });

  list.querySelectorAll('[data-resolve]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      await api(`/api/incidents/${btn.dataset.resolve}/resolve`, { method: 'POST' });
      announce('Incident resolved.');
      await refreshAll();
    });
  });
}

function renderStaff(staff) {
  const list = $('#staff-list');
  list.innerHTML = '';
  staff.forEach((s) => {
    const li = document.createElement('li');
    const badgeClass = s.status === 'available' ? 'badge-available' : 'badge-busy';
    li.innerHTML = `
      <span>${s.name} · ${s.role}</span>
      <span class="badge ${badgeClass}">${s.status}</span>
    `;
    list.appendChild(li);
  });
}

async function refreshAll() {
  // Single round trip instead of two: state, plan, and briefing all come
  // back together, and the briefing itself is cached server-side when
  // nothing about the plan has changed since the last poll.
  const { state, plan, briefing } = await api('/api/dashboard');

  renderGates(plan.gateStatus);
  renderActions(plan.actions);
  renderIncidents(state.incidents);
  renderStaff(state.staff);
  $('#briefing').textContent = briefing.text;
}

$('#tick-btn').addEventListener('click', async () => {
  await api('/api/tick', { method: 'POST' });
  announce('Simulation advanced.');
  await refreshAll();
});

$('#reset-btn').addEventListener('click', async () => {
  await api('/api/reset', { method: 'POST' });
  announce('Venue reset.');
  await refreshAll();
});

$('#incident-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const type = $('#inc-type').value;
  const severity = $('#inc-severity').value;
  const locationLabel = $('#inc-location').value.trim();
  if (!locationLabel) return;

  await api('/api/incidents', {
    method: 'POST',
    body: JSON.stringify({ type, severity, locationLabel }),
  });
  $('#inc-location').value = '';
  announce('Incident reported.');
  await refreshAll();
});

refreshAll().catch((err) => {
  announce('Failed to load venue state.');
  console.error(err); // eslint-disable-line no-console
});
