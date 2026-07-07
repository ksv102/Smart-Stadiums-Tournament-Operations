# ORION — Stadium Operations & Crowd Safety Assistant

Built for **Challenge 04: Smart Stadiums & Tournament Operations** (FIFA World
Cup 2026).

## Chosen vertical

**Stadium operations: crowd flow, safety, and staff coordination.**

ORION is built for a stadium operations coordinator sitting in the control
room during a live match. Their job is to watch gate crowd density, respond
to incidents (medical, security, facilities), and get the right staff member
to the right place fast — while under time pressure, with imperfect
information, and with zero tolerance for a wrong call on anything safety
related.

## Approach and logic

The core design decision: **an LLM never decides a safety-critical action.**

Stadiums are exactly the kind of environment where an assistant that
occasionally hallucinates a plausible-sounding but wrong recommendation
("open all gates") is worse than useless. So the system is split into two
layers:

1. **`src/rulesEngine.js` — the decision layer.** A deterministic, unit-tested
   set of thresholds and rules decides everything that matters:
   - Gate occupancy is classified into `LOW / MODERATE / HIGH / CRITICAL`
     bands. `HIGH` recommends opening an auxiliary lane; `CRITICAL` escalates
     to a crowd-control protocol (crush risk).
   - Each incident type maps to the staff role required to respond
     (medical → medical, fire/security threat/crowd crush → security,
     lost person/facilities → steward), and severity maps to a priority
     weight.
   - Staff assignment picks the nearest **available** staff member of the
     required role (Euclidean distance over venue coordinates), and asks for
     mutual aid if nobody suitable is free rather than silently doing
     nothing.
   - All resulting actions are merged and sorted by priority into one plan.

2. **`src/claudeReasoning.js` — the narration layer.** This takes the plan the
   rules engine already produced and asks Claude to summarize it in plain,
   staff-facing language ("what should I do in the next 60 seconds").
   Claude is explicitly instructed not to add, remove, or change any action —
   only to phrase the existing ones. If no `ANTHROPIC_API_KEY` is set, or the
   API call fails for any reason, it falls back to a deterministic template
   briefing so the tool **never stops working** because of a network issue —
   important for something operators depend on mid-match.

This split is also why the code is easy to test: the decision logic is pure
functions with no network calls, so `tests/rulesEngine.test.js` covers the
actual safety logic directly, and `tests/claudeReasoning.test.js` covers the
fallback behavior without needing a live API key.

## How the solution works

- **Backend** (`server.js` + `src/`): a small Express API over an in-memory
  venue state (`src/venueState.js`) that simulates four stadium gates and six
  staff members. Endpoints let you inspect state, advance the simulation,
  report/resolve incidents, change staff availability, and fetch the current
  action plan and briefing.
- **Frontend** (`public/`): a single-page control-room dashboard (no
  framework, no build step) showing live gate occupancy, the prioritized
  action list, an incident report form, and the staff roster. It polls the
  API after every action so the operator always sees current state.
- **Simulation**: "Advance simulation" nudges gate occupancy to mimic crowd
  build-up before kickoff, so you can watch a gate cross into `HIGH` /
  `CRITICAL` and see ORION recommend the auxiliary lane and escalation in
  real time. "Report incident" lets you inject a medical/security/etc. event
  and watch ORION dispatch the nearest available matching staff member.

### Running it

```bash
npm install
cp .env.example .env   # optional — add ANTHROPIC_API_KEY to enable live narration
npm start               # http://localhost:3000
npm test                 # runs the rules-engine and narration test suites
```

## Assumptions

- Gate and staff data are simulated in memory (`src/venueState.js`) standing
  in for real turnstile/CCTV/IoT feeds and a real staff-location system,
  since no live stadium data source is available for this challenge.
- "Nearest staff" uses simple 2D coordinates as a stand-in for a real venue
  map/wayfinding system.
- The assistant is scoped to one venue during one live event, not
  multi-venue tournament-wide coordination.
- Claude's narration is an enhancement, not a dependency — the assistant is
  designed to keep functioning fully (minus nicer phrasing) if the API key is
  missing or the request fails, which matters more for an operations tool
  than for a typical chat feature.

## Accessibility notes

- Keyboard-navigable throughout, with visible focus outlines and a skip link.
- Status changes (new briefing, incident reported/resolved) are announced to
  screen readers via an `aria-live` region.
- Color is never the only signal — gate levels and incident/staff statuses
  are also labeled in text, not just color-coded.
- Respects `prefers-reduced-motion`.

## Security notes

- Incident payloads are validated against a fixed allow-list of types and
  severities server-side before touching state.
- Request bodies are size-limited (100kb) to reduce abuse surface on a
  publicly reachable demo.
- No API key is ever sent to the client; the Anthropic key lives in
  server-side environment variables only and `.env` is gitignored.
- A central error handler prevents stack traces from leaking to clients.
