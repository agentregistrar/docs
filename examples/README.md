# Provider examples

These examples show the two HTTP routes a provider hosts for brokered agent
signup:

1. `GET /.well-known/agent-signup.json` serves the identity-only discovery
   document.
2. `POST /api/signup/agent` verifies the broker assertion and resolves or
   creates a local account.

| Example | Runtime | Port | Folder |
| :--- | :--- | :--- | :--- |
| Next.js App Router | Next.js 16 | 3003 | [nextjs](./nextjs/) |
| Hono | Hono 4 with `@hono/node-server` | 3004 | [hono](./hono/) |
| Express | Express 5 on Node | 3005 | [express](./express/) |
| Cloudflare Workers | Workers native `fetch` | 3006 | [cloudflare-workers](./cloudflare-workers/) |

Every folder is standalone. It has its own `package.json`, `tsconfig.json`, and
a self-contained copy of the hardened `jose` verifier at
`lib/verify-assertion.ts` or `src/verify-assertion.ts`. The verifier logic is
identical in all four examples; only the runtime wiring differs.

## Run and validate

Install and start one example:

```bash
cd examples/nextjs
npm install
npm run dev
```

In another terminal, run the conformance validator:

```bash
npx @agentregistrar/discovery@2.1.1 validate http://127.0.0.1:3003/.well-known/agent-signup.json --probe-endpoints --json
```

Expected: exit code `0`, `"valid": true`, and zero errors.

Check the unsigned request path and the method guard:

```bash
curl -sS -i -X POST http://127.0.0.1:3003/api/signup/agent
curl -sS -o /dev/null -w '%{http_code}\n' http://127.0.0.1:3003/api/signup/agent
```

Expected: `400` with `"error":"invalid_request"` and `cache-control: no-store`
for the unsigned POST, and `405` for the GET.

Use the same commands with the other ports:

| Example | Validation URL |
| :--- | :--- |
| Next.js | `http://127.0.0.1:3003/.well-known/agent-signup.json` |
| Hono | `http://127.0.0.1:3004/.well-known/agent-signup.json` |
| Express | `http://127.0.0.1:3005/.well-known/agent-signup.json` |
| Cloudflare Workers | `http://127.0.0.1:3006/.well-known/agent-signup.json` |

## Shared verifier

Each copy of `verifyAssertion` does the same work and returns a discriminated
result instead of throwing for expected failures:

- Requires `Authorization: Bearer <jwt>`, otherwise `400 invalid_request`.
- Rejects a malformed JOSE header and any `jku` or `x5u` header with
  `401 invalid_assertion`.
- Reads `iss` from the unverified payload only to check `issuer_allowlist`
  before any network call. This supports multi-broker allowlists and prevents
  SSRF to untrusted issuers.
- Resolves and caches one remote JWKS per issuer URL, then verifies with
  `EdDSA`, `typ: "agent-id+jwt"`, and 60 seconds of clock tolerance.
- Maps expired assertions to `401 assertion_expired` and every other JOSE
  failure to `401 invalid_assertion`.
- Checks issuer, audience, `iat` and `exp` lifetime, delegated scopes, verified
  human, terms URL and optional terms hash, and a non-empty `jti`.

## Demo stores

All examples use in-memory `Map` stores for accounts and `jti` values. This is
for local demonstration only. Production must use a database with unique
constraints on `(iss, human.id)` and `jti` so concurrent requests and restarts
stay idempotent.

The first signup for an account returns `201` with `resolution: "created"`,
`account_id`, and a show-once `api_key`. A repeat signup for the same account
returns `200` with `resolution: "resolved"` and no credential. Every signup
response uses `Cache-Control: no-store`.

## Configuration

| Variable | Default | Purpose |
| :--- | :--- | :--- |
| `PROVIDER_ORIGIN` | `http://127.0.0.1:<port>` | Origin used in `provider_url` and `endpoints.agent_signup`. |
| `PROVIDER_AUDIENCE` | `<framework>-example` | Exact `audience` value. |
| `PROVIDER_CONTACT` | `security@example.com` | Contact field in discovery. |
| `ISSUER_ALLOWLIST` | `https://agentregistrar.dev` | Comma-separated broker origins accepted before any JWKS call. |
| `TERMS_VERSION` | `2026.1` | Terms version in discovery. |
| `TERMS_URL` | `<origin>/terms` | Terms URL served by the example. |
| `TERMS_SHA256` | unset | Optional exact `sha256:...` hash for terms binding. |
| `JWKS_URL_OVERRIDE` | unset | Local test override for the JWKS URL. Leave unset in production. |
| `ATTESTATION_URI` | unset | Optional broker attestation URI. Omit for unverified local development. |

The Node examples read these from `process.env`. The Cloudflare Workers example
reads them from `env`; set them under `vars` in `wrangler.jsonc` or in
`.dev.vars`. Leave `JWKS_URL_OVERRIDE` and `ATTESTATION_URI` unset unless you
are testing that path.

## Documentation

- [Hosting and framework examples](https://docs.agentregistrar.dev/providers/hosting/)
- [Provider prompt kit](https://docs.agentregistrar.dev/providers/prompt-kit/)
