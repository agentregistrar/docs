import express from "express";
import { verifyAssertion } from "./verify-assertion";

const PORT = 3005;
const NO_STORE = { "cache-control": "no-store" };

const TERMS_TEXT = `Example provider terms for local development. Version 2026.1.

This text is served at /terms for the local demo. Replace it with your real
agreement before deploying.
`;

// Local demo only. Replace both maps with a database that has unique
// constraints on (iss, human.id) and jti before taking live traffic.
const accounts = new Map<string, { accountId: string; apiKey: string }>();
const seenJti = new Map<string, string>();

function providerOrigin() {
  return process.env.PROVIDER_ORIGIN ?? `http://127.0.0.1:${PORT}`;
}

function providerAudience() {
  return process.env.PROVIDER_AUDIENCE ?? "express-example";
}

function issuerAllowlist() {
  const configured = (process.env.ISSUER_ALLOWLIST ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter((value) => value.length > 0);
  return configured.length > 0 ? configured : ["https://agentregistrar.dev"];
}

function discoveryDocument() {
  const origin = providerOrigin();
  const attestationUri = process.env.ATTESTATION_URI;

  return {
    protocol: "agent-identity-protocol",
    protocol_version: "2.0",
    audience: providerAudience(),
    provider_name: "Express example",
    provider_url: origin,
    contact: process.env.PROVIDER_CONTACT ?? "security@example.com",
    issuer_allowlist: issuerAllowlist(),
    required_scopes: ["tos:accept"],
    terms: {
      version: process.env.TERMS_VERSION ?? "2026.1",
      url: process.env.TERMS_URL ?? `${origin}/terms`,
    },
    endpoints: {
      agent_signup: `${origin}/api/signup/agent`,
    },
    ...(attestationUri
      ? { attestation: { mode: "broker" as const, uri: attestationUri } }
      : {}),
  };
}

const app = express();
app.disable("x-powered-by");

app.get("/.well-known/agent-signup.json", (_req, res) => {
  res
    .set({
      "cache-control": "public, max-age=60",
      "access-control-allow-origin": "*",
    })
    .status(200)
    .json(discoveryDocument());
});

app.options("/.well-known/agent-signup.json", (_req, res) => {
  res
    .set({
      "access-control-allow-origin": "*",
      "access-control-allow-methods": "GET, OPTIONS",
      "access-control-allow-headers": "Content-Type",
    })
    .status(204)
    .end();
});

app.get("/terms", (_req, res) => {
  res
    .set({
      "content-type": "text/plain; charset=utf-8",
      "cache-control": "public, max-age=60",
    })
    .status(200)
    .send(TERMS_TEXT);
});

app.post("/api/signup/agent", async (req, res) => {
  const origin = providerOrigin();
  const result = await verifyAssertion(req.header("authorization"), {
    issuerAllowlist: issuerAllowlist(),
    audience: providerAudience(),
    requiredScopes: ["tos:accept"],
    termsUrl: process.env.TERMS_URL ?? `${origin}/terms`,
    termsSha256: process.env.TERMS_SHA256,
    jwksUrlOverride: process.env.JWKS_URL_OVERRIDE,
  });

  if (!result.ok) {
    res
      .set(NO_STORE)
      .status(result.status)
      .json({
        error: result.error,
        error_description: result.error_description,
        retryable: false,
      });
    return;
  }

  const claims = result.claims;
  const accountKey = `${claims.iss}:${claims.human.id}`;
  const previousAccount = seenJti.get(claims.jti);

  if (previousAccount !== undefined && previousAccount !== accountKey) {
    res
      .set(NO_STORE)
      .status(409)
      .json({
        error: "assertion_replayed",
        error_description: "Assertion id used in a conflicting context",
        retryable: false,
      });
    return;
  }
  seenJti.set(claims.jti, accountKey);

  const existing = accounts.get(accountKey);
  if (existing) {
    res
      .set(NO_STORE)
      .status(200)
      .json({ resolution: "resolved", account_id: existing.accountId });
    return;
  }

  const created = {
    accountId: `acct_${crypto.randomUUID()}`,
    apiKey: `key_${crypto.randomUUID()}`,
  };
  accounts.set(accountKey, created);

  res
    .set(NO_STORE)
    .status(201)
    .json({
      resolution: "created",
      account_id: created.accountId,
      api_key: created.apiKey,
    });
});

app.options("/api/signup/agent", (_req, res) => {
  res
    .set({
      "access-control-allow-origin": "*",
      "access-control-allow-methods": "POST, OPTIONS",
      "access-control-allow-headers": "Authorization, Content-Type",
      ...NO_STORE,
    })
    .status(204)
    .end();
});

app.all("/api/signup/agent", (_req, res) => {
  res.set({ allow: "POST", ...NO_STORE }).status(405).end();
});

app.use((_req, res) => {
  res
    .set(NO_STORE)
    .status(404)
    .json({
      error: "not_found",
      error_description: "No such endpoint",
      retryable: false,
    });
});

app.listen(PORT, "127.0.0.1", () => {
  console.log(`Express example listening on http://127.0.0.1:${PORT}`);
});
