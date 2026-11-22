# Express provider example

A minimal Express 5 service that publishes brokered agent signup discovery and
accepts a signed Agent Identity assertion.

## Routes

| Route | Method | Purpose |
| :--- | :--- | :--- |
| `/.well-known/agent-signup.json` | `GET`, `OPTIONS` | Discovery document with CORS and a 60 second cache. |
| `/terms` | `GET` | Local plain-text terms for the demo. |
| `/api/signup/agent` | `POST` | Verifies the assertion and resolves or creates an account. |
| `/api/signup/agent` | `OPTIONS` | CORS preflight for the signup route. |

## Run

```bash
npm install
npm run dev
```

The server listens on `http://127.0.0.1:3005`.

## Validate

```bash
npx @agentregistrar/discovery@2.1.1 validate http://127.0.0.1:3005/.well-known/agent-signup.json --probe-endpoints --json
```

Expected: exit code `0`, `"valid": true`, and zero errors.

Check the unsigned request path:

```bash
curl -sS -i -X POST http://127.0.0.1:3005/api/signup/agent
curl -sS -o /dev/null -w '%{http_code}\n' http://127.0.0.1:3005/api/signup/agent
```

Expected: `400` with `"error":"invalid_request"` and `cache-control: no-store`
for the unsigned POST, and `405` for the GET.

## Files

| File | Purpose |
| :--- | :--- |
| `src/verify-assertion.ts` | Self-contained hardened `jose` verifier. |
| `src/server.ts` | Express app, discovery, terms, signup, and method guard. |

## Configuration

| Variable | Default | Purpose |
| :--- | :--- | :--- |
| `PROVIDER_ORIGIN` | `http://127.0.0.1:3005` | Public origin used in discovery URLs. |
| `PROVIDER_AUDIENCE` | `express-example` | Exact `audience` value. |
| `PROVIDER_CONTACT` | `security@example.com` | Contact field in discovery. |
| `ISSUER_ALLOWLIST` | `https://agentregistrar.dev` | Comma-separated broker origins accepted before any JWKS call. |
| `TERMS_VERSION` | `2026.1` | Terms version in discovery. |
| `TERMS_URL` | `http://127.0.0.1:3005/terms` | Terms URL served by the example. |
| `TERMS_SHA256` | unset | Optional exact terms hash. |
| `JWKS_URL_OVERRIDE` | unset | Local test override for the JWKS URL. Leave unset in production. |
| `ATTESTATION_URI` | unset | Optional broker attestation URI. |

## Demo store

`src/server.ts` uses in-memory `Map` stores for accounts and `jti` values. This
is for local demonstration only. Production must use a database with unique
constraints on `(iss, human.id)` and `jti` so concurrent requests and restarts
stay idempotent.

Before deploying, set `PROVIDER_ORIGIN` to the public HTTPS origin, publish your
real terms at `TERMS_URL`, and remove any test overrides.
