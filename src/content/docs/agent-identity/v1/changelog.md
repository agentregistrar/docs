---
title: "Release notes and changelog"
description: "Release notes for agent-identity-v1 v1.2.0, v1.1.0 and v1.0.0, newest first."
audience: both
source: "spec:v1.2.0#release-notes"
specTag: "v1.2.0"
generated: true
lastReviewed: 2026-10-24
nimbusDisableRules: ["nimbus/duplicate-heading-text"]
---

> Generated from [`agentregistrar/spec`](https://github.com/agentregistrar/spec/tree/35659ce9febc13f78c7fcc69ee1908dca584805c) at `v1.2.0` (tag `v1.2.0`).
> Do not edit this page; edit the spec and re-run `pnpm sync:spec`.

## Release Notes — `agent-identity-v1` `v1.2.0`

- **Protocol identifier:** `agent-identity-v1` (unchanged)
- **Specification version:** `v1.2.0`
- **Release date:** 2026-10-24 (target; this branch is the reviewed artifact — see §6)
- **Normative specification:** [`agent-identity-v1.md`](https://docs.agentregistrar.dev/agent-identity/v1/specification/)
- **Change process:** [`release-notes-v1.0.0.md`](https://github.com/agentregistrar/spec/blob/35659ce9febc13f78c7fcc69ee1908dca584805c/release-notes-v1.0.0.md) §3
- **Previous release:** [`release-notes-v1.1.0.md`](https://github.com/agentregistrar/spec/blob/35659ce9febc13f78c7fcc69ee1908dca584805c/release-notes-v1.1.0.md)

`v1.2.0` is the **two-sided trust** release: it gives relying parties a portable, broker-issued
identity, lets agents verify that identity locally before signup, and makes receipts and abuse
reports authenticated. It adds two new contracts (G, H) and a metadata/status surface (I), updates
Contracts D.1, D.2, E, and F, and defines the trust model, assurance levels, verification rules, and
status/error taxonomy.

The wire protocol id stays `agent-identity-v1`. `rp_attestation` is **OPTIONAL**: a `v1.0.0` or
`v1.1.0` discovery document remains conformant and is simply **unverified**.

---

### 1. What `v1.2.0` adds

| Contract | Change | Where |
| :--- | :--- | :--- |
| **G — RP attestation** | New broker-signed JWT (`typ: agent-rp-attestation+jwt`) binding the RP's canonical origin, audience, provider identity, assurance level, and public keys. Published as the optional `rp_attestation` field. `exp - iat = 86400`, `aud: agent-identity-v1`, `keys[].purposes` exactly `["receipt","abuse"]`. | §14 |
| **H — Provider registration and status API** | Administrative provider API: account, origins, HTTPS/DNS challenges, key proof of possession (`agent-rp-key-pop+jwt`), key retire/revoke, attestation issue/renew, API keys. Never agent-facing; no public JSON Schema. | §15 |
| **I — Broker metadata and status** | `/.well-known/agent-broker.json` with `issuer`, `jwks_uri`, `attestation_status_uri`, `abuse_endpoint`, `protocol_versions`, `contact`; and a signed `agent-rp-attestation-status+jwt` response with a 300-second window and a 5-minute cache bound. | §16 |
| **D.1 — Discovery** | Optional `rp_attestation` (compact JWS, ≤16384 characters). `rp.origin` binds to the fetched document origin; `rp.audience` binds to `audience`. Absence is conformant and unverified. | §5.2, §5.4 |
| **D.2 — Abuse reporting** | RP report JWS (`agent-rp-abuse+jwt`, 300-second window) plus the RP attestation. Trusted-broker check before JWKS. Unknown/untrusted/unlinked reports are `unverified` cases; only a verified, receipt-linked report can request protective suspension. Unauthenticated legacy posts get `401 unauthenticated_report`. | §11.5 |
| **E — Signup receipt** | RP-signed, **no `exp`**. Adds `service.origin`, `service.attestation_jti`, `service.key_id`; `header.kid` must equal `service.key_id`; valid when `iat`/`signed_up_at` fall inside the named attestation's window. A legacy `exp` is ignored. | §11.1, §11.4 |
| **F — Receipt ingestion** | `{signup_token, rp_attestation}`, both required. Verifies the **exact** attestation named by `service.attestation_jti` in historical mode; never substitutes the current one. Preserves the existing response fields and adds `proof_source: "rp_callback"` and `deduplicated`. | §11.6 |
| **Trust model and policy** | Permissionless assertion verification; local attestation verification; trust is policy, not cryptography and not transitive. Assurance levels `domain` and `entity`. Normative resolution order and the `allow`/`warn`/`require`/`block` matrix. `require` rejects `agent_supplied_discovery`. | §17 |
| **Status and error taxonomy** | Frozen `RpVerificationStatus`, `RpPolicy`, `RpVerificationSource`, `AssuranceLevel`, `AttestationStatusValue`, and `ProofSource`. OAuth-style `{error, error_description, code}` on new routes. | §18 |
| **Verification rules** | Conformance and attestation verification are separate; conformance never calls Broker B. Exit `0`/`1`/`2`. Trust before fetch, per-issuer JWKS, historical vs current comparisons, SSRF bounds, algorithm/key-confusion rules, fail-closed gates. | §19 |
| **Registry** | Optional per-entry `verification` snapshot (`broker`, `level`, `attestation_jti`, `checked_at`, `status`). Conformance and verification stay separate; only `active` earns a badge. | `registry/README.md` |

### 2. Compatibility

- **Discovery documents:** `v1.0.0` and `v1.1.0` documents remain conformant. `rp_attestation` is
  OPTIONAL; absence means **unverified**, never invalid.
- **Assertion verification:** unchanged and still permissionless. No account, SDK, shared secret, or
  broker call is required to verify a Contract A assertion.
- **Receipts:** pre-v1.2 broker-signed receipts are historical artifacts and are recorded as
  `legacy_broker_signed`, not verified. A new verified proof requires an RP key bound to an
  attestation.
- **Contract F:** now requires `rp_attestation`. There is no broker-key fallback and no legacy path
  for a new verified proof.
- **Contract D.2:** unauthenticated posts are rejected with
  `401 {"error":"unauthorized","code":"unauthenticated_report"}`.
- **Validator:** `valid` is still the run result (`valid === (exitCode === 0)`). The new
  `conformance` and `attestation` objects are additive; `validatorVersion` is now `"1.2.0"`.
  `conformance.evaluated` distinguishes "not evaluated" (exit `2`, no document) from "invalid";
  unparseable JSON is a conformance error (exit `1`), and a malformed `rp_attestation` field is
  conformance-only (`attestation.status: not_checked`), never `invalid`.
- **Package:** `@agentregistrar/discovery` `1.2.0` exports the new schemas and parsers. No existing
  export was removed or renamed. There is still no `bin` entry.
- **Dependencies:** no new runtime dependency. JWS/Ed25519 verification uses Node's built-in
  `node:crypto`. No test framework was added.

### 3. Section renumbering

To keep every existing anchor stable, the new contracts were inserted after §13 and the former
sections moved down:

| Old | New |
| :--- | :--- |
| §14 Security Considerations | §20 |
| §15 Conformance Checklist & Minimal Conformant Example | §21 |
| §16 Open Questions | §22 |
| §17 Relationship to Other Contracts | §23 |

Contracts D.2 and F are **not** new top-level sections: they live beside Contract E in §11 as §11.5
and §11.6, so their existing references keep working.

### 4. New and changed artifacts

| Path | Action |
| :--- | :--- |
| `agent-identity-v1.md` | `v1.2.0` text: §1.1–§1.3, §2.1, §5.2, §5.4, §11; new §14–§19; §20–§23. |
| `agent-signup.schema.json` | Optional `rp_attestation`. |
| `rp-attestation.schema.json` | New (Contract G, producer mode). |
| `broker-metadata.schema.json` | New (Contract I). |
| `attestation-status.schema.json` | New (Contract I status JWS claims). |
| `signup-receipt.schema.json` | New (Contract E v1.2). |
| `abuse-report.schema.json` | New (Contract D.2). |
| `src/schema.ts`, `src/index.ts` | Zod for discovery, attestation, metadata, status; producer/verifier parsers for the attestation and the status JWS. |
| `src/validate-attestation.ts` | Contract G verifier (validator-internal; not exported from `src/index.ts`). |
| `src/validate-discovery.ts` | Five new flags, conformance/attestation split, exit mapping, output. |
| `src/validate-fixtures.ts`, `src/dev/sign-fixtures.ts`, `src/verify-artifacts.ts` | Manual fixture harness and deterministic fixture signer. |
| `src/validate-registry.ts` | Registry validator. |
| `fixtures/**` | Attestation/receipt/status/abuse/provider fixtures, per-issuer JWKS, frozen seed, `expected.json`, `README.md`. |
| `registry/implementations.schema.json` | New registry schema; entries unchanged. |
| `scope-boundaries.md`, `implementing-agent-identity-v1.md`, `validator.md`, `README.md` | v1.2.0 guidance. |
| `package.json` | `1.2.0`, schema files/exports, `validate:fixtures`, `validate:registry`, `sign:fixtures`. |

### 5. Validation evidence

Run on **2026-10-24** from a clean clone of this repository on Node `v24.21.0` and pnpm `9.15.4`,
with the frozen fixture clock `2026-10-24T00:00:00Z` and arena-only fixture keys. `jq` was not
installed in the verification environment, so the JSON projections below were produced with a
one-line Node equivalent of the documented `jq` pipelines; the validator output and exit codes are
unchanged.

```bash
pnpm install && pnpm typecheck                     # → 0 (tsc --noEmit)
V="pnpm --silent validate:discovery"
A="--verify-attestation --jwks fixtures/keys/fixture-jwks-broker-1.json --trusted-rp-broker https://rp-broker.example"
```

| Check | Command | Result |
| :--- | :--- | :--- |
| v1.0/v1.1 conformance unchanged | `$V fixtures/valid-minimal.json --json` | `valid true`, `exitCode 0`, `conformance.valid true`, `attestation.status "unverified"` |
| Valid attestation, offline | `$V fixtures/valid-attested-domain.json $A --require-attestation --at 2026-10-24T00:00:00Z --json` | `valid true`, `exitCode 0`, `verified`, level `domain` |
| Entity level | `$V fixtures/valid-attested-entity.json $A --require-attestation --at 2026-10-24T00:00:00Z --json` | `verified`, level `entity` |
| Expired (warning) | `$V fixtures/valid-attestation-expired.json $A --at 2026-11-30T00:00:00Z --json` | `valid true`, `exitCode 0`, `expired` |
| Expired (gate) | same `+ --require-attestation` | exit `1` |
| Malformed field | `$V fixtures/invalid-attestation-malformed.json --json` | exit `1`, `conformance.valid false`, `attestation.status "not_checked"`, no network |
| Unparseable JSON | `$V fixtures/invalid-json-body.json --json` | exit `1`, `conformance.valid false`, `conformance.evaluated true`, `fetchFailure null` |
| No document | `$V fixtures/does-not-exist.json --json` | exit `2`, `conformance.valid null`, `conformance.evaluated false`, `fetchFailure` set, `DOCUMENT: NOT CHECKED` |
| Absent attestation warning | `$V fixtures/valid-minimal.json --verify-attestation --json` | exit `0`, `unverified`, warning "rp_attestation is absent" |
| Wrong purposes tuple | `pnpm --silent validate:fixtures` row `attestations/wrong-purposes` | rejected by both `rp-attestation.schema.json` and strict Zod (`claims_invalid`) |
| Untrusted broker | `$V fixtures/valid-attested-domain.json --verify-attestation --jwks … --at … --json` (no trust flag) | `attested_untrusted_broker` |
| Untrusted broker (gate) | same `+ --require-attestation` | exit `1` |
| Broker unavailable (gate) | `$V fixtures/valid-attested-unavailable.json --require-attestation --trusted-rp-broker https://rp-broker.example --jwks fixtures/keys/missing.json --json` | exit `2` |
| Broker unavailable (network) | `$V … --require-attestation --trusted-rp-broker https://rp-broker.example --timeout 1` | exit `2`, `unavailable` |
| Fixture reproducibility | `pnpm sign:fixtures && git diff --exit-code fixtures/` | byte-identical, exit `0` |
| Fixture matrix | `pnpm --silent validate:fixtures fixtures/expected.json` | `56 passed, 0 failed` |
| Registry valid | `pnpm --silent validate:registry registry/implementations.json --json` | `{"valid":true,"exitCode":0,"errors":[],"warnings":[]}` |
| Registry violation | deliberate `level:"enhanced"` + `attestation_jti:"rpa_x"` | exit `1`, two schema errors plus a semantic error |
| Packaging | `npm pack --dry-run --json` | tarball contains all six root schemas, `registry/implementations.schema.json`, and `src/` |

The fixture matrix covers the §5.13 rows: discovery with/without an attestation, malformed and
oversize fields, unparseable JSON, an absent/missing document, expired/invalid/untrusted/unavailable
attestations, every listed attestation negative (including a reordered `purposes` tuple),
`unknown-additive-claim` in both producer and verifier mode, receipts including a legacy `exp` and a
rotated key, abuse reports, status responses (including an additive status claim), broker metadata,
and provider request/response examples.

### 6. Release mechanics

Per the repository `AGENTS.md`, the source-first package is published with **npm trusted publishing
(OIDC)** — never a local `npm publish` and never an npm token. Nothing in this branch claims that the
tag, npm publication, or GitHub release has already happened; this branch is the reviewed artifact and
`npm dist-tags.latest` remains `1.1.0` until step 3 completes:

1. merge the release PR to `main`;
2. tag the merge commit `v1.2.0` and push the tag;
3. dispatch `.github/workflows/publish.yml` from `main` (environment `npm-publish`, `id-token:
   write`);
4. verify `npm view @agentregistrar/discovery@1.2.0 version dist.integrity` and the provenance
   attestation;
5. create the GitHub release from this file with `--verify-tag`.

The tag and publish run are recorded in the GitHub release and the workflow log when the release is
dispatched; this branch is the reviewed artifact, not the publication.

### 7. Change process and scope

`v1.2.0` was reviewed against [`scope-boundaries.md`](https://docs.agentregistrar.dev/agent-identity/v1/scope-boundaries/) §6–§7. Every change is
identity-, delegation-, ToS-, traceability-, revocation-, or reachability-related:

- the attestation binds identity and keys only — no terms hash, scopes, endpoints, prices, or
  `provider_url`;
- no provider catalog, SKU, provisioning API, resource inventory, or credential custody entered the
  protocol, discovery, the receipt, or the registry;
- a provider account remains the RP's private relationship with its broker and is never an
  agent-facing discovery field;
- assertion verification remains permissionless; only the RP's own registration/issuance path needs an
  account.

A breaking change still requires a new `protocol` value and a new discovery path (§13).

### 8. Related artifacts

- Normative spec: [`agent-identity-v1.md`](https://docs.agentregistrar.dev/agent-identity/v1/specification/)
- Scope rulebook: [`scope-boundaries.md`](https://docs.agentregistrar.dev/agent-identity/v1/scope-boundaries/)
- Implementation guide: [`implementing-agent-identity-v1.md`](https://docs.agentregistrar.dev/agent-identity/v1/implementation-guide/)
- Validator guide: [`validator.md`](https://docs.agentregistrar.dev/agent-identity/v1/validator/)
- Fixture matrix: [`fixtures/README.md`](https://github.com/agentregistrar/spec/blob/35659ce9febc13f78c7fcc69ee1908dca584805c/fixtures/README.md)
- Registry: [`registry/README.md`](https://github.com/agentregistrar/spec/blob/35659ce9febc13f78c7fcc69ee1908dca584805c/registry/README.md),
  [`registry/implementations.json`](https://github.com/agentregistrar/spec/blob/35659ce9febc13f78c7fcc69ee1908dca584805c/registry/implementations.json)
- Previous release: [`release-notes-v1.1.0.md`](https://github.com/agentregistrar/spec/blob/35659ce9febc13f78c7fcc69ee1908dca584805c/release-notes-v1.1.0.md)

## Release Notes — `agent-identity-v1` `v1.1.0`

- **Protocol identifier:** `agent-identity-v1`
- **Specification version:** `v1.1.0`
- **Release date:** 2026-10-18
- **Normative specification:** [`agent-identity-v1.md`](https://docs.agentregistrar.dev/agent-identity/v1/specification/)
- **Change process:** [`release-notes-v1.0.0.md`](https://github.com/agentregistrar/spec/blob/35659ce9febc13f78c7fcc69ee1908dca584805c/release-notes-v1.0.0.md) §3

`v1.1.0` is an **additive, text-only** revision of the `agent-identity-v1` discovery contract. It adds
clarifications that were implicit in `v1.0.0`, plus one **optional** success-response field. It removes
and renames nothing, changes no schema, Zod, JSON Schema, or validator code, and keeps the wire
protocol id `agent-identity-v1`. **`v1.0.0` implementors remain conformant.**

---

### 1. What `v1.1.0` clarifies

| Area | Clarification | Where |
| :--- | :--- | :--- |
| Replay vs resolve | The `jti` check is an **account-creation guard**, not duplicate suppression. A repeated POST with an already-used `jti` for the **same** agent/account/service **MUST** resolve idempotently — a success, not `assertion_replayed`. `assertion_replayed` is reserved for a `jti` presented in a conflicting context. A Broker **MAY** return the identical previously issued unexpired assertion for an identical request; an RP **MUST NOT** treat a fresh assertion referencing an existing acceptance as a new consent. | §7.1, §7.2 |
| Optional `resolution` | The success response **MAY** carry `resolution: "created" \| "resolved"`. `resolved` **MUST NOT** be treated as failure; on `resolved` the RP **MAY** omit provider credentials (show-once) but **MUST** point the agent at its recovery path in the guide. | §7.1 step 4 |
| Acceptance lifetime | No protocol-mandated re-acceptance interval. An acceptance remains the recorded consent for its `terms.sha256` until the terms change or the human re-consents. A Broker **MAY** impose its own policy and **SHOULD** document it. | §7.3 (new) |
| Knowledge of text | Restated: the Broker **MUST** require the caller to demonstrate knowledge of `terms.text` and **MUST** reject a request that does not. | §7.1 step 1, §10 |
| Account identity keys | Recommended keys `(iss, human.id)` for human-scoped accounts and `(iss, agent.id)` for agent-scoped accounts; keying on emails is **NOT RECOMMENDED**; namespace by `iss` when more than one issuer is trusted; `human.verified` means verified email, not KYC. | §9.1 (new) |
| Credential handoff & recovery | Credentials are **show-once**; agents **MUST** persist them at the handoff moment and **MUST NOT** rely on the conversation as storage; the Broker **MUST NOT** store provider credentials; agents **MUST NOT** re-run signup as recovery; RPs **SHOULD** document a recovery/rotation path in the guide; a repeated signup resolves without re-issuing credentials or sending duplicate mail. | §12.5 (new) |
| Conformance checklist | Two **SHOULD** items added: idempotent-resolve signalling, and a guide-documented recovery path. | §15.1 |
| Open questions | The replay/resolve and credential-handoff questions are resolved; canonical hosting remains open. | §16 |
| Security considerations | The replay and credential-handoff entries were updated to match the clarifications above. | §14 |

#### Protocol surface at v1.1.0 (summary)

Unchanged from `v1.0.0` except for one **optional** success-response field:

- Discovery is still identity-only: `protocol`, `audience`, `provider_name`, `issuer_allowlist`,
  `required_scopes`, `terms`, and `endpoints.agent_signup`, plus the same optionals (`spec`,
  `provider_url`, `contact`, `updated_at`, non-capability `extensions`). No discovery field is added,
  removed, or renamed.
- `POST endpoints.agent_signup` success responses **MAY** include `resolution: "created" | "resolved"`.
  An absent `resolution` means `v1.0.0` behaviour and is conformant.
- The signed `signup_token` (Contract E), the optional `context` pointer, and every §7.2 error code are
  unchanged. `assertion_replayed` semantics are narrowed to conflicting reuse; it is not returned for
  an idempotent repeat by the same agent/account/service.
- Vendor capabilities (catalogs, provisioning, credentials, recovery endpoints, API usage) remain out
  of discovery and the receipt. Credential recovery is vendor capability documented only in the guide.

### 2. Canonical public spec URL decision

Hosting is still undecided (spec §16). The optional `spec` field **stays OPTIONAL** and implementers
may omit it. In this release the checked-in fixture now pins the **canonical repository document** at
its version tag:

```json
"spec": "https://github.com/agentregistrar/spec/blob/v1.1.0/agent-identity-v1.md"
```

### 3. Change process

Unchanged from [`release-notes-v1.0.0.md`](https://github.com/agentregistrar/spec/blob/35659ce9febc13f78c7fcc69ee1908dca584805c/release-notes-v1.0.0.md) §3. `v1.1.0` was reviewed against
the [scope-boundaries.md](https://docs.agentregistrar.dev/agent-identity/v1/scope-boundaries/) checklist: every change is identity-, delegation-,
ToS-, traceability-, or handoff-related; none advertises a catalog, SKU, pricing, resource endpoint,
credential, or vendor API usage; all changes are additive within v1. A breaking change **MUST** still
use a new `protocol` value and a new discovery path.

### 4. Validation evidence

The changes are text-only, so the validator and both schemas are byte-identical to `v1.0.0`; the runs
below confirm the fixtures still receive the same verdicts (no validator drift). Run on **2026-10-18**
from a clone of this repository:

```bash
pnpm validate:discovery fixtures/valid-full.json --json
# → valid: true, exitCode: 0, protocol: "agent-identity-v1", audience: "vaporcloud",
#   validatorVersion: "1.0.0",
#   counts: { passed: 17, failed: 0, warnings: 0, probes: 0 }
```

The only field changed in `fixtures/valid-full.json` is the `spec` URL (§2); the validator verdict is
unchanged from `v1.0.0` (17 passed, 0 failed, 0 warnings).

Invalid fixtures — unchanged verdicts, each `valid: false`, exit code `1`:

| Fixture | `counts` |
| :--- | :--- |
| `invalid-bad-tos-hash.json` | `{ passed: 12, failed: 2, warnings: 2, probes: 0 }` |
| `invalid-broker-receipt-endpoint.json` | `{ passed: 13, failed: 2, warnings: 1, probes: 0 }` |
| `invalid-empty-issuer-allowlist.json` | `{ passed: 13, failed: 2, warnings: 1, probes: 0 }` |
| `invalid-missing-agent-signup.json` | `{ passed: 13, failed: 2, warnings: 1, probes: 0 }` |
| `invalid-missing-terms-text.json` | `{ passed: 12, failed: 2, warnings: 1, probes: 0 }` |
| `invalid-unknown-protocol.json` | `{ passed: 13, failed: 2, warnings: 1, probes: 0 }` |
| `invalid-vendor-catalog.json` | `{ passed: 13, failed: 2, warnings: 1, probes: 0 }` |
| `invalid-vendor-endpoints.json` | `{ passed: 13, failed: 2, warnings: 1, probes: 0 }` |

Other valid fixtures are also unchanged: `valid-minimal.json` and `valid-localhost.json` each report
`valid: true`, exit code `0`, `{ passed: 16, failed: 0, warnings: 0, probes: 0 }`.

The **`v1.0.0` release evidence remains as history** (see
[`release-notes-v1.0.0.md`](https://github.com/agentregistrar/spec/blob/35659ce9febc13f78c7fcc69ee1908dca584805c/release-notes-v1.0.0.md) §4 and
[`registry/implementations.json`](https://github.com/agentregistrar/spec/blob/35659ce9febc13f78c7fcc69ee1908dca584805c/registry/implementations.json)); the runs above are the `v1.1.0`
counterparts. No live **production** origin was validated for this revision.

### 5. Release record

Per the repository `AGENTS.md`, the source-first package `@agentregistrar/discovery` was aligned to the
specification version — `package.json` `version` bumped `1.0.2` → `1.1.0` — and published to npm using
**trusted publishing (OIDC)** by dispatching `publish.yml` from `main`. No npm token is involved.

- Workflow: [`.github/workflows/publish.yml`](https://github.com/agentregistrar/spec/blob/35659ce9febc13f78c7fcc69ee1908dca584805c/.github/workflows/publish.yml) (`workflow_dispatch`) on
  repository `agentregistrar/spec`, environment `npm-publish`, `id-token: write`.
- Publish run: [`39168886677`](https://github.com/agentregistrar/spec/actions/runs/39168886677) —
  `Publish package` on `main`, conclusion **success**.
- Evidence: the run log records `+ @agentregistrar/discovery@1.1.0` with a signed provenance statement
  published to the transparency log; the registry reports `dist-tags.latest = 1.1.0` with version
  `1.1.0` present, and `npm view @agentregistrar/discovery@1.1.0 version` → `1.1.0` once upload
  processing completes.

This release is **text-only** — no schema/Zod/JSON-Schema and no validator change — so no npm publish
is required for conformance; the version alignment is an operator decision so the published package
version tracks the specification version.

### 6. Non-blocking follow-ups

- **Canonical hosting** of a rendered copy of the specification at a versioned public URL remains
  undecided (§2).
- IANA registration of the well-known URI, a future `agent-identity.json` alias, structured `issuers`
  metadata, discovery-document signing, and a Broker-side well-known discovery document all remain
  deferred (spec §16).

### 7. Related artifacts

- Rendered release notes and changelog: <https://docs.agentregistrar.dev/agent-identity/v1/changelog/>
- Normative spec: [`agent-identity-v1.md`](https://docs.agentregistrar.dev/agent-identity/v1/specification/)
- Scope rulebook: [`scope-boundaries.md`](https://docs.agentregistrar.dev/agent-identity/v1/scope-boundaries/)
- Implementation guide: [`implementing-agent-identity-v1.md`](https://docs.agentregistrar.dev/agent-identity/v1/implementation-guide/)
- Validator guide: [`validator.md`](https://docs.agentregistrar.dev/agent-identity/v1/validator/)
- Registry: [`registry/README.md`](https://github.com/agentregistrar/spec/blob/35659ce9febc13f78c7fcc69ee1908dca584805c/registry/README.md),
  [`registry/implementations.json`](https://github.com/agentregistrar/spec/blob/35659ce9febc13f78c7fcc69ee1908dca584805c/registry/implementations.json)
- Previous release: [`release-notes-v1.0.0.md`](https://github.com/agentregistrar/spec/blob/35659ce9febc13f78c7fcc69ee1908dca584805c/release-notes-v1.0.0.md)

## Release Notes — `agent-identity-v1` `v1.0.0`

- **Protocol identifier:** `agent-identity-v1`
- **Specification version:** `v1.0.0`
- **Release date:** 2026-10-17
- **Normative specification:** [`agent-identity-v1.md`](https://docs.agentregistrar.dev/agent-identity/v1/specification/)

This is the initial identity-only release of the Agent Identity Relying Party discovery contract
(`GET /.well-known/agent-signup.json`). It is released as `v1.0.0` after the identity-only schema, the
checked-in JSON Schema, the conformance validator, the VaporCloud reference implementation, and the
documentation were confirmed to agree.

---

### 1. What `v1.0.0` freezes

The release is recorded once the following artifacts agree on the same identity-only contract:

| Artifact | Location | Role |
| :--- | :--- | :--- |
| Normative specification | [`agent-identity-v1.md`](https://docs.agentregistrar.dev/agent-identity/v1/specification/) | The single source of truth for the contract. |
| Scope rulebook | [`scope-boundaries.md`](https://docs.agentregistrar.dev/agent-identity/v1/scope-boundaries/) | Identity-vs-vendor boundary and the change-review checklist. |
| Implementation source of truth | `src/schema.ts` (`AgentSignupDiscoverySchema`) | Runtime validation shared by the broker, validator, and reference implementation. |
| JSON Schema | [`agent-signup.schema.json`](https://docs.agentregistrar.dev/agent-identity/v1/agent-signup.schema.json) | Checked-in schema; the validator reports any divergence from Zod. |
| Conformance validator | `src/validate-discovery.ts` (`pnpm validate:discovery …`) | Objective conformance check; `validatorVersion` `1.0.0`. |
| Reference implementation | VaporCloud (reference Relying Party, maintained in the private repository) | Identity-only discovery document + post-signup `context` handoff. |
| Implementation registry | [`registry/implementations.json`](https://github.com/agentregistrar/spec/blob/35659ce9febc13f78c7fcc69ee1908dca584805c/registry/implementations.json) and [`registry/README.md`](https://github.com/agentregistrar/spec/blob/35659ce9febc13f78c7fcc69ee1908dca584805c/registry/README.md) | Adoption surface and conformance badge. |
| Public package | [`package.json`](https://github.com/agentregistrar/spec/blob/35659ce9febc13f78c7fcc69ee1908dca584805c/package.json) — `@agentregistrar/discovery` `1.0.0` | Self-contained, source-first distribution of the canonical schema (`src/schema.ts`) and the validator CLI (`src/validate-discovery.ts`); **Apache-2.0**. npm publishing is **pending** (scope reservation only); consume it via this repository or `github:agentregistrar/spec#v1.0.0` (no `bin` entry). |

#### Protocol surface at v1.0.0 (summary)

- Discovery advertises identity only: `protocol`, `audience`, `provider_name`, `issuer_allowlist`,
  `required_scopes`, `terms` (complete `text` + `url` + `version` + `sha256`), and
  `endpoints.agent_signup`. Optional: `spec`, `provider_url`, `contact`, `updated_at`, non-capability
  `extensions`. Vendor catalogs, provisioning/OTP endpoints, resource endpoints, credentials, SKUs,
  and pricing are **forbidden** in discovery at any depth (spec §5.3).
- Contract E (signed `signup_token`) records identity/attribution facts, an opaque
  `service.account_id`, and an optional hash-pinned `context` pointer to the vendor's post-signup
  guide. The vendor resource claims `service.instance_sku` and `service.endpoint_url` are removed
  (spec §11).
- Vendor capabilities are documented in the vendor's post-signup guide (for example `SKILL.md`),
  reached only through the signed `context` pointer.

### 2. Canonical public spec URL decision

- This repository ([`agent-identity-v1.md`](https://docs.agentregistrar.dev/agent-identity/v1/specification/)) is the **canonical location** of
  the specification. It is versioned in the repository and updated only through the change process in
  §3.
- The **final canonical hosting URL** for a rendered copy is undecided (spec §16). Until it exists,
  the protocol's optional `spec` discovery field stays **OPTIONAL** and implementers may omit it; the
  placeholder `https://<canonical-spec-host>/agent-identity/v1/agent-signup` is illustrative only.
- When hosting exists, the released `v1.0.0` document is published at a **versioned** URL so the
  optional `spec` field can point at the exact document. This is an additive, non-breaking change to
  the documentation, not to the protocol.

### 3. Change process

#### Additive v1 changes (minor/patch)

- Additive identity fields and clarifications are allowed within `v1` and do **not** change the
  `protocol` value or the discovery path. Consumers **MUST** ignore unknown fields.
- Each additive change is recorded in the changelog (spec §1.2) and passes the
  [scope-boundaries.md](https://docs.agentregistrar.dev/agent-identity/v1/scope-boundaries/) review checklist before it is added: a field that
  answers "what do we sell?" or "how do you call our API?" is vendor scope and does **not** belong in
  the protocol.
- Additive changes are validated by the conformance validator and by the fixtures before release; the
  JSON Schema and `AgentSignupDiscoverySchema` are updated together so they cannot drift.

#### Breaking changes

- A **breaking change MUST use a new `protocol` value and a new discovery path** (for example
  `agent-signup-v2.json`). The v1 path **MUST NOT** silently change semantics (spec §13).
- A new version **SHOULD** be dual-published during a migration window. The broker does not force
  migration; the registry lists implementations by the `protocol` value their discovery document
  advertises.
- Vendor catalogs, provisioning endpoints, resource metadata, and API-usage documentation are **not**
  additive protocol fields at any version; they always belong in the post-signup guide.

### 4. Release evidence

The release was recorded after the reference implementation passed the conformance validator with
**zero errors and zero warnings**:

```bash
# Reference implementation, started locally with placeholder environment variables only:
pnpm validate:discovery http://localhost:3001/.well-known/agent-signup.json --json
# → valid: true, exitCode: 0, protocol: "agent-identity-v1", audience: "vaporcloud",
#   counts: { passed: 22, failed: 0, warnings: 0, probes: 0 }

# Checked-in VaporCloud identity-only discovery fixture (file mode):
pnpm validate:discovery fixtures/valid-full.json --json
# → valid: true, exitCode: 0, protocol: "agent-identity-v1", audience: "vaporcloud",
#   counts: { passed: 17, failed: 0, warnings: 0, probes: 0 }
```

The same commands and results are recorded per entry in
[`registry/implementations.json`](https://github.com/agentregistrar/spec/blob/35659ce9febc13f78c7fcc69ee1908dca584805c/registry/implementations.json). No live **production** origin has
been validated; the registry records a local reference-implementation run only, and live validation of
a hosted implementation is an operational step performed by that implementer.

### 5. Non-blocking follow-ups

- **IANA registration** of the well-known URI (`agent-signup.json`) is **not** required for v1 and
  does **not** block this release. Evaluate it after v1 stabilizes (spec §16).
- **Canonical hosting** of a rendered copy of the specification at a versioned public URL remains
  undecided (§2).
- A future alias such as `agent-identity.json`, structured `issuers` metadata, discovery-document
  signing, and a Broker-side well-known discovery document are all deferred to later revisions
  (spec §16).

### 6. Related artifacts

- Adoption surface: [`registry/README.md`](https://github.com/agentregistrar/spec/blob/35659ce9febc13f78c7fcc69ee1908dca584805c/registry/README.md) and
  [`registry/implementations.json`](https://github.com/agentregistrar/spec/blob/35659ce9febc13f78c7fcc69ee1908dca584805c/registry/implementations.json).
- New-RP guide: [`implementing-agent-identity-v1.md`](https://docs.agentregistrar.dev/agent-identity/v1/implementation-guide/).
- Validator guide: [`validator.md`](https://docs.agentregistrar.dev/agent-identity/v1/validator/).
