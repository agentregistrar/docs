# Cloudflare Workers provider example

A minimal Cloudflare Workers service using native `fetch` and Web Crypto. It
publishes brokered agent signup discovery and accepts a signed Agent Identity
assertion. `jose` runs on Workers without Node compatibility flags.

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

Wrangler listens on `http://127.0.0.1:3006`.

## Validate

```bash
npx @agentregistrar/discovery@2.1.1 validate http://127.0.0.1:3006/.well-known/agent-signup.json --probe-endpoints --json
```

Expected: exit code `0`, `"valid": true`, and zero errors.

Check the unsigned request path:

```bash
curl -sS -i -X POST http://127.0.0.1:3006/api/signup/agent
curl -sS -o /dev/null -w '%{http_code}\n' http://127.0.0.1:3006/api/signup/agent
```

Expected: `400` with `"error":"invalid_request"` and `cache-control: no-store`
for the unsigned POST, and `405` for the GET.

## Files

| File | Purpose |
| :--- | :--- |
| `src/verify-assertion.ts` | Self-contained hardened `jose` verifier. |
| `src/worker.ts` | Worker entry point, discovery, terms, signup, and method guard. |
| `wrangler.jsonc` | Local and deployment configuration for the Worker. |

## Configuration

The Worker reads configuration from its `env` bindings. Set these under `vars`
in `wrangler.jsonc`, or in `.dev.vars` for local runs.

| Variable | Default | Purpose |
| :--- | :--- | :--- |
| `PROVIDER_ORIGIN` | `http://127.0.0.1:3006` | Public origin used in discovery URLs. |
| `PROVIDER_AUDIENCE` | `cloudflare-workers-example` | Exact `audience` value. |
| `PROVIDER_CONTACT` | `security@example.com` | Contact field in discovery. |
| `ISSUER_ALLOWLIST` | `https://agentregistrar.dev` | Comma-separated broker origins accepted before any JWKS call. |
| `TERMS_VERSION` | `2026.1` | Terms version in discovery. |
| `TERMS_URL` | `http://127.0.0.1:3006/terms` | Terms URL served by the example. |
| `TERMS_SHA256` | unset | Optional exact terms hash. |
| `JWKS_URL_OVERRIDE` | unset | Local test override for the JWKS URL. Leave unset in production. |
| `ATTESTATION_URI` | unset | Optional broker attestation URI. |

## Demo store

`src/worker.ts` uses in-memory `Map` stores for accounts and `jti` values. This
is for local demonstration only. On Workers, use D1, Durable Objects, or KV with
unique constraints on `(iss, human.id)` and `jti` so concurrent requests and
restarts stay idempotent.

Before deploying, set `PROVIDER_ORIGIN` to the public HTTPS origin, publish your
real terms at `TERMS_URL`, and remove any test overrides.
