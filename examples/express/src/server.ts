import express from "express";
import { verifyAssertion } from "./verify-assertion";

const PORT = 3005;
const NO_STORE = { "cache-control": "no-store" };

const TERMS_TEXT = `Example provider terms for local development. Version 2026.1.

This text is served at /terms for the local demo. Replace it with your real
agreement before deploying.
`;

// Local demo only. Replace these Maps with a database that has unique
// constraints on (iss, human.id), agent_id, and jti before taking live traffic.
interface DemoAccount {
  accountId: string;
  apiKey: string;
  agentIds: Set<string>;
  sessions: Set<string>;
}

const accounts = new Map<string, DemoAccount>();
const seenSignupJti = new Map<string, string>();
const seenLoginJti = new Set<string>();

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
      agent_login: `${origin}/api/login/agent`,
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
    expectedPurpose: "signup",
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
  const previousAccount = seenSignupJti.get(claims.jti);

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
  seenSignupJti.set(claims.jti, accountKey);

  const agentId = claims.sub ?? claims.agent?.id ?? claims.human.id;
  const existing = accounts.get(accountKey);
  if (existing) {
    existing.agentIds.add(agentId);
    res
      .set(NO_STORE)
      .status(200)
      .json({ resolution: "resolved", account_id: existing.accountId });
    return;
  }

  const created = {
    accountId: `acct_${crypto.randomUUID()}`,
    apiKey: `key_${crypto.randomUUID()}`,
    agentIds: new Set([agentId]),
    sessions: new Set<string>(),
  };
  accounts.set(accountKey, created);

  res
    .set(NO_STORE)
    .status(201)
    .json({
      resolution: "created",
      account_id: created.accountId,
      api_key: created.apiKey,
      handoff: {
        session: {
          credential_type: "api_key",
          access_token: created.apiKey,
          token_type: "Bearer",
        },
        human_urls: {
          dashboard_url: `${origin}/dashboard`,
        },
      },
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

app.post("/api/login/agent", async (req, res) => {
  const origin = providerOrigin();
  const termsUrl = process.env.TERMS_URL ?? `${origin}/terms`;
  const termsVersion = process.env.TERMS_VERSION ?? "2026.1";

  const result = await verifyAssertion(req.header("authorization"), {
    issuerAllowlist: issuerAllowlist(),
    audience: providerAudience(),
    requiredScopes: ["tos:accept"],
    termsUrl,
    termsSha256: process.env.TERMS_SHA256,
    expectedPurpose: "login",
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
  if (seenLoginJti.has(claims.jti)) {
    res
      .set(NO_STORE)
      .status(409)
      .json({
        error: "assertion_replayed",
        error_description:
          "Login assertion jti already consumed; mint a fresh login assertion",
        retryable: false,
      });
    return;
  }
  seenLoginJti.add(claims.jti);

  // Production must check (iss, sub) first, then broker-created accounts by
  // (iss, human.id), and NEVER auto-link pre-existing human-registered accounts
  // by human.email alone (return 403 human_action_required instead).
  const accountKey = `${claims.iss}:${claims.human.id}`;
  const existing = accounts.get(accountKey);
  if (!existing) {
    res
      .set(NO_STORE)
      .status(404)
      .json({
        error: "account_not_found",
        error_description:
          "No account exists for this agent or human identity. Run signup first.",
        retryable: false,
      });
    return;
  }

  if (claims.delegation.accepted_rp_tos_version !== termsVersion) {
    res
      .set(NO_STORE)
      .status(409)
      .json({
        error: "terms_reacceptance_required",
        expected_terms_version: termsVersion,
        terms_url: termsUrl,
        error_description: `Terms of Service version (${claims.delegation.accepted_rp_tos_version ?? "missing"}) is stale; expected ${termsVersion}.`,
        retryable: false,
      });
    return;
  }

  const agentId = claims.sub ?? claims.agent?.id ?? claims.human.id;
  const resolution = existing.agentIds.has(agentId)
    ? "logged_in"
    : "agent_attached";
  existing.agentIds.add(agentId);

  const sessionId = `sess_${crypto.randomUUID()}`;
  const sessionToken = `tok_${crypto.randomUUID()}`;
  existing.sessions.add(sessionId);

  res
    .set(NO_STORE)
    .status(200)
    .json({
      resolution,
      account_id: existing.accountId,
      terms_version: termsVersion,
      handoff: {
        session: {
          credential_type: "bearer_token",
          access_token: sessionToken,
          token_type: "Bearer",
          expires_in: 3600,
          session_id: sessionId,
        },
        human_urls: {
          dashboard_url: `${origin}/dashboard`,
        },
      },
    });
});

app.options("/api/login/agent", (_req, res) => {
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

app.all("/api/login/agent", (_req, res) => {
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
