# Security

This is a hackathon/challenge submission, not a production system handling
real venues or real people — but it's built the way a real ops tool should
be, since that's the point of the challenge.

## Implemented protections

- **Deterministic decision layer**: safety-critical actions (gate escalation,
  staff dispatch) are decided by explicit, unit-tested rules
  (`src/rulesEngine.js`), never by the LLM. This removes hallucination risk
  from the safety path entirely — see the README for the full rationale.
- **HTTP security headers** via `helmet`: a restrictive Content-Security-Policy,
  HSTS, `X-Content-Type-Options: nosniff`, `X-Frame-Options`, and a
  `no-referrer` policy.
- **Rate limiting** on all API traffic, with a stricter limit on write
  endpoints, correctly scoped per real client IP (`trust proxy` is set for
  deployment behind a reverse proxy such as Render).
- **Optional API-key authentication** on every mutating endpoint
  (`ORION_API_KEY`), checked with a constant-time comparison to avoid timing
  side-channels. Documented in `.env.example` and the README.
- **Input validation everywhere data enters the system**: incident payloads
  are checked against a fixed allow-list of types/severities server-side;
  path-parameter IDs are validated against a safe character pattern before
  any lookup; staff status updates are checked against a fixed enum.
- **Request size limits** (100kb) to reduce abuse surface.
- **No secrets in source control**: `.env` is gitignored, `.env.example`
  documents required variables without values, and neither
  `ANTHROPIC_API_KEY` nor `ORION_API_KEY` is ever sent to the client.
- **No stack traces leaked to clients**: a central error handler returns a
  generic 500 and logs the real error server-side only.
- **CI-enforced dependency auditing**: every push runs `npm audit
--audit-level=high` (see `.github/workflows/ci.yml`), so known-vulnerable
  dependencies fail the build rather than going unnoticed.
- **Automated dependency updates** via Dependabot (`.github/dependabot.yml`),
  checking for new npm advisories weekly.
- **Explicit CORS policy**: cross-origin requests are denied outright
  (`origin: false`) rather than left to Express's implicit default — this is
  a same-origin, single-tenant dashboard and states that as policy, not
  omission.
- **Explicit Permissions-Policy header** disabling browser features this app
  never uses (camera, microphone, geolocation, payment, USB), rather than
  leaving them unspecified.
- **Fail-fast startup validation** (`src/envCheck.js`): the server refuses to
  start if `PORT` is out of range, `ORION_API_KEY` is set but too weak to be
  meaningful, `ANTHROPIC_API_KEY` doesn't look like a real key, or `NODE_ENV`
  is unrecognized — misconfiguration is loud, not silent.
- **RFC 9116 `security.txt`** at `/.well-known/security.txt` with a
  standard contact path and link to this document.

## Known, accepted limitations

- The in-memory venue store is intentionally not a real database — there's
  no persistence, and every process restart resets state. Not a
  vulnerability, just a scope boundary for a demo.
- `ORION_API_KEY` defaults to unset (open demo mode) so the public deployed
  demo stays reviewable without extra setup. A real deployment should set it.
- There's no per-user identity or audit log of who performed which action —
  out of scope for a single-coordinator demo, but the first thing a
  production version would need to add.

## Reporting

This is a challenge submission repository, not a maintained project — if
you're reviewing it as a security exercise and spot something not covered
above, feel free to open an issue.
