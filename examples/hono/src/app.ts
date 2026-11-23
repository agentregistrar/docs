import { Hono } from "hono";
import { verifyAssertion } from "./verify-assertion";

const PORT = 3004;
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
  return process.env.PROVIDER_AUDIENCE ?? "hono-example";
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
    provider_name: "Hono example",
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

export const app = new Hono();

app.get("/.well-known/agent-signup.json", (c) =>
  c.json(discoveryDocument(), 200, {
    "cache-control": "public, max-age=60",
    "access-control-allow-origin": "*",
  }),
);

app.options("/.well-known/agent-signup.json", (c) =>
  c.body(null, 204, {
    "access-control-allow-origin": "*",
    "access-control-allow-methods": "GET, OPTIONS",
    "access-control-allow-headers": "Content-Type",
  }),
);

app.get("/terms", (c) =>
  c.text(TERMS_TEXT, 200, {
    "cache-control": "public, max-age=60",
  }),
);

app.post("/api/signup/agent", async (c) => {
  const origin = providerOrigin();
  const result = await verifyAssertion(c.req.header("authorization"), {
    issuerAllowlist: issuerAllowlist(),
    audience: providerAudience(),
    requiredScopes: ["tos:accept"],
    termsUrl: process.env.TERMS_URL ?? `${origin}/terms`,
    termsSha256: process.env.TERMS_SHA256,
    expectedPurpose: "signup",
    jwksUrlOverride: process.env.JWKS_URL_OVERRIDE,
  });

  if (!result.ok) {
    return c.json(
      {
        error: result.error,
        error_description: result.error_description,
        retryable: false,
      },
      result.status,
      NO_STORE,
    );
  }

  const claims = result.claims;
  const accountKey = `${claims.iss}:${claims.human.id}`;
  const previousAccount = seenSignupJti.get(claims.jti);

  if (previousAccount !== undefined && previousAccount !== accountKey) {
    return c.json(
      {
        error: "assertion_replayed",
        error_description: "Assertion id used in a conflicting context",
        retryable: false,
      },
      409,
      NO_STORE,
    );
  }
  seenSignupJti.set(claims.jti, accountKey);

  const agentId = claims.sub ?? claims.agent?.id ?? claims.human.id;
  const existing = accounts.get(accountKey);
  if (existing) {
    existing.agentIds.add(agentId);
    return c.json(
      { resolution: "resolved", account_id: existing.accountId },
      200,
      NO_STORE,
    );
  }

  const created = {
    accountId: `acct_${crypto.randomUUID()}`,
    apiKey: `key_${crypto.randomUUID()}`,
    agentIds: new Set([agentId]),
    sessions: new Set<string>(),
  };
  accounts.set(accountKey, created);

  return c.json(
    {
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
    },
    201,
    NO_STORE,
  );
});

app.options("/api/signup/agent", (c) =>
  c.body(null, 204, {
    "access-control-allow-origin": "*",
    "access-control-allow-methods": "POST, OPTIONS",
    "access-control-allow-headers": "Authorization, Content-Type",
    ...NO_STORE,
  }),
);

app.all("/api/signup/agent", (c) =>
  c.body(null, 405, { allow: "POST", ...NO_STORE }),
);

app.post("/api/login/agent", async (c) => {
  const origin = providerOrigin();
  const termsUrl = process.env.TERMS_URL ?? `${origin}/terms`;
  const termsVersion = process.env.TERMS_VERSION ?? "2026.1";

  const result = await verifyAssertion(c.req.header("authorization"), {
    issuerAllowlist: issuerAllowlist(),
    audience: providerAudience(),
    requiredScopes: ["tos:accept"],
    termsUrl,
    termsSha256: process.env.TERMS_SHA256,
    expectedPurpose: "login",
    jwksUrlOverride: process.env.JWKS_URL_OVERRIDE,
  });

  if (!result.ok) {
    return c.json(
      {
        error: result.error,
        error_description: result.error_description,
        retryable: false,
      },
      result.status,
      NO_STORE,
    );
  }

  const claims = result.claims;
  if (seenLoginJti.has(claims.jti)) {
    return c.json(
      {
        error: "assertion_replayed",
        error_description:
          "Login assertion jti already consumed; mint a fresh login assertion",
        retryable: false,
      },
      409,
      NO_STORE,
    );
  }
  seenLoginJti.add(claims.jti);

  // Production must check (iss, sub) first, then broker-created accounts by
  // (iss, human.id), and NEVER auto-link pre-existing human-registered accounts
  // by human.email alone (return 403 human_action_required instead).
  const accountKey = `${claims.iss}:${claims.human.id}`;
  const existing = accounts.get(accountKey);
  if (!existing) {
    return c.json(
      {
        error: "account_not_found",
        error_description:
          "No account exists for this agent or human identity. Run signup first.",
        retryable: false,
      },
      404,
      NO_STORE,
    );
  }

  if (claims.delegation.accepted_rp_tos_version !== termsVersion) {
    return c.json(
      {
        error: "terms_reacceptance_required",
        expected_terms_version: termsVersion,
        terms_url: termsUrl,
        error_description: `Terms of Service version (${claims.delegation.accepted_rp_tos_version ?? "missing"}) is stale; expected ${termsVersion}.`,
        retryable: false,
      },
      409,
      NO_STORE,
    );
  }

  const agentId = claims.sub ?? claims.agent?.id ?? claims.human.id;
  const resolution = existing.agentIds.has(agentId)
    ? "logged_in"
    : "agent_attached";
  existing.agentIds.add(agentId);

  const sessionId = `sess_${crypto.randomUUID()}`;
  const sessionToken = `tok_${crypto.randomUUID()}`;
  existing.sessions.add(sessionId);

  return c.json(
    {
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
    },
    200,
    NO_STORE,
  );
});

app.options("/api/login/agent", (c) =>
  c.body(null, 204, {
    "access-control-allow-origin": "*",
    "access-control-allow-methods": "POST, OPTIONS",
    "access-control-allow-headers": "Authorization, Content-Type",
    ...NO_STORE,
  }),
);

app.all("/api/login/agent", (c) =>
  c.body(null, 405, { allow: "POST", ...NO_STORE }),
);

app.notFound((c) =>
  c.json(
    {
      error: "not_found",
      error_description: "No such endpoint",
      retryable: false,
    },
    404,
    NO_STORE,
  ),
);
