# Next.js App Router provider example

A minimal Next.js App Router service that publishes brokered agent signup
discovery and accepts a signed Agent Identity assertion.

## Routes

| Route | Method | Purpose |
| :--- | :--- | :--- |
| `/.well-known/agent-signup.json` | `GET`, `OPTIONS` | Discovery document with CORS and a 60 second cache. |
| `/terms` | `GET` | Local plain-text terms for the demo. |
| `/api/signup/agent` | `POST` | Verifies the `signup` assertion, resolves or creates an account, and returns `handoff` on creation. |
| `/api/signup/agent` | `OPTIONS` | CORS preflight for the signup route. |
| `/api/login/agent` | `POST` | Verifies the `login` assertion, checks `jti` + terms version (`409`/`404`), and mints a fresh session + `handoff`. |
| `/api/login/agent` | `OPTIONS` | CORS preflight for the login route. |

## Run

```bash
npm install
npm run dev
```

The server listens on `http://127.0.0.1:3003`.

## Validate

```bash
npx @agentregistrar/discovery@2.3.0 validate http://127.0.0.1:3003/.well-known/agent-signup.json --probe-endpoints --json
```

Expected: exit code `0`, `"valid": true`, and zero errors.

Check the unsigned request path:

```bash
curl -sS -i -X POST http://127.0.0.1:3003/api/signup/agent
curl -sS -i -X POST http://127.0.0.1:3003/api/login/agent
curl -sS -o /dev/null -w '%{http_code}\n' http://127.0.0.1:3003/api/signup/agent
```

Expected: `400` with `"error":"invalid_request"` and `cache-control: no-store`
for the unsigned POST, and `405` for the GET.

## Files

| File | Purpose |
| :--- | :--- |
| `lib/verify-assertion.ts` | Self-contained hardened `jose` verifier (`expectedPurpose`: `"signup"` or `"login"`). |
| `lib/store.ts` | In-memory demo stores for accounts and `jti` replay tracking. |
| `app/.well-known/agent-signup.json/route.ts` | Discovery document (`agent_signup` and `agent_login`) and CORS preflight. |
| `app/api/signup/agent/route.ts` | Signup handler, `handoff`, and method guard. |
| `app/api/login/agent/route.ts` | Day-2 login handler, terms freshness check, and per-session `handoff`. |
| `app/terms/route.ts` | Local terms text served at `/terms`. |
| `next.config.ts` | Minimal Next.js configuration. |

## Configuration

| Variable | Default | Purpose |
| :--- | :--- | :--- |
| `PROVIDER_ORIGIN` | `http://127.0.0.1:3003` | Public origin used in discovery URLs. |
| `PROVIDER_AUDIENCE` | `nextjs-example` | Exact `audience` value. |
| `PROVIDER_CONTACT` | `security@example.com` | Contact field in discovery. |
| `ISSUER_ALLOWLIST` | `https://agentregistrar.dev` | Comma-separated broker origins accepted before any JWKS call. |
| `TERMS_VERSION` | `2026.1` | Terms version in discovery. |
| `TERMS_URL` | `http://127.0.0.1:3003/terms` | Terms URL served by the example. |
| `TERMS_SHA256` | unset | Optional exact terms hash. |
| `JWKS_URL_OVERRIDE` | unset | Local test override for the JWKS URL. Leave unset in production. |
| `ATTESTATION_URI` | unset | Optional broker attestation URI. |

## Demo store

The signup route uses in-memory `Map` stores for accounts and `jti` values. This
is for local demonstration only. Production must use a database with unique
constraints on `(iss, human.id)` and `jti` so concurrent requests and restarts
stay idempotent.

Before deploying, set `PROVIDER_ORIGIN` to the public HTTPS origin, publish your
real terms at `TERMS_URL`, and remove any test overrides.
