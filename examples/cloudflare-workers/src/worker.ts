import { verifyAssertion } from "./verify-assertion";

interface Env {
  PROVIDER_ORIGIN?: string;
  PROVIDER_AUDIENCE?: string;
  PROVIDER_CONTACT?: string;
  ISSUER_ALLOWLIST?: string;
  TERMS_VERSION?: string;
  TERMS_URL?: string;
  TERMS_SHA256?: string;
  JWKS_URL_OVERRIDE?: string;
  ATTESTATION_URI?: string;
}

const PORT = 3006;
const NO_STORE = { "cache-control": "no-store" };

const TERMS_TEXT = `Example provider terms for local development. Version 2026.1.

This text is served at /terms for the local demo. Replace it with your real
agreement before deploying.
`;

// Local demo only. Replace these Maps with durable storage that has unique
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

function providerOrigin(env: Env) {
  return env.PROVIDER_ORIGIN ?? `http://127.0.0.1:${PORT}`;
}

function providerAudience(env: Env) {
  return env.PROVIDER_AUDIENCE ?? "cloudflare-workers-example";
}

function issuerAllowlist(env: Env) {
  const configured = (env.ISSUER_ALLOWLIST ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter((value) => value.length > 0);
  return configured.length > 0 ? configured : ["https://agentregistrar.dev"];
}

function discoveryDocument(env: Env) {
  const origin = providerOrigin(env);
  const attestationUri = env.ATTESTATION_URI;

  return {
    protocol: "agent-identity-protocol",
    protocol_version: "2.0",
    audience: providerAudience(env),
    provider_name: "Cloudflare Workers example",
    provider_url: origin,
    contact: env.PROVIDER_CONTACT ?? "security@example.com",
    issuer_allowlist: issuerAllowlist(env),
    required_scopes: ["tos:accept"],
    terms: {
      version: env.TERMS_VERSION ?? "2026.1",
      url: env.TERMS_URL ?? `${origin}/terms`,
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

function json(
  body: unknown,
  status: number,
  headers: Record<string, string> = {},
) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", ...headers },
  });
}

function errorResponse(status: number, error: string, description: string) {
  return json(
    { error, error_description: description, retryable: false },
    status,
    NO_STORE,
  );
}

async function handleSignup(request: Request, env: Env) {
  const origin = providerOrigin(env);
  const result = await verifyAssertion(request.headers.get("authorization"), {
    issuerAllowlist: issuerAllowlist(env),
    audience: providerAudience(env),
    requiredScopes: ["tos:accept"],
    termsUrl: env.TERMS_URL ?? `${origin}/terms`,
    termsSha256: env.TERMS_SHA256,
    expectedPurpose: "signup",
    jwksUrlOverride: env.JWKS_URL_OVERRIDE,
  });

  if (!result.ok) {
    return errorResponse(result.status, result.error, result.error_description);
  }

  const claims = result.claims;
  const accountKey = `${claims.iss}:${claims.human.id}`;
  const previousAccount = seenSignupJti.get(claims.jti);

  if (previousAccount !== undefined && previousAccount !== accountKey) {
    return errorResponse(
      409,
      "assertion_replayed",
      "Assertion id used in a conflicting context",
    );
  }
  seenSignupJti.set(claims.jti, accountKey);

  const agentId = claims.sub ?? claims.agent?.id ?? claims.human.id;
  const existing = accounts.get(accountKey);
  if (existing) {
    existing.agentIds.add(agentId);
    return json(
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

  return json(
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
}

async function handleLogin(request: Request, env: Env) {
  const origin = providerOrigin(env);
  const termsUrl = env.TERMS_URL ?? `${origin}/terms`;
  const termsVersion = env.TERMS_VERSION ?? "2026.1";

  const result = await verifyAssertion(request.headers.get("authorization"), {
    issuerAllowlist: issuerAllowlist(env),
    audience: providerAudience(env),
    requiredScopes: ["tos:accept"],
    termsUrl,
    termsSha256: env.TERMS_SHA256,
    expectedPurpose: "login",
    jwksUrlOverride: env.JWKS_URL_OVERRIDE,
  });

  if (!result.ok) {
    return errorResponse(result.status, result.error, result.error_description);
  }

  const claims = result.claims;
  if (seenLoginJti.has(claims.jti)) {
    return errorResponse(
      409,
      "assertion_replayed",
      "Login assertion jti already consumed; mint a fresh login assertion",
    );
  }
  seenLoginJti.add(claims.jti);

  // Production must check (iss, sub) first, then broker-created accounts by
  // (iss, human.id), and NEVER auto-link pre-existing human-registered accounts
  // by human.email alone (return 403 human_action_required instead).
  const accountKey = `${claims.iss}:${claims.human.id}`;
  const existing = accounts.get(accountKey);
  if (!existing) {
    return errorResponse(
      404,
      "account_not_found",
      "No account exists for this agent or human identity. Run signup first.",
    );
  }

  if (claims.delegation.accepted_rp_tos_version !== termsVersion) {
    return json(
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

  return json(
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
}

function handleAgentPostEndpoint(
  request: Request,
  handler: () => Promise<Response>,
) {
  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "access-control-allow-origin": "*",
        "access-control-allow-methods": "POST, OPTIONS",
        "access-control-allow-headers": "Authorization, Content-Type",
        ...NO_STORE,
      },
    });
  }
  if (request.method !== "POST") {
    return new Response(null, {
      status: 405,
      headers: { allow: "POST", ...NO_STORE },
    });
  }
  return handler();
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/.well-known/agent-signup.json") {
      if (request.method === "OPTIONS") {
        return new Response(null, {
          status: 204,
          headers: {
            "access-control-allow-origin": "*",
            "access-control-allow-methods": "GET, OPTIONS",
            "access-control-allow-headers": "Content-Type",
          },
        });
      }
      if (request.method === "GET" || request.method === "HEAD") {
        return json(discoveryDocument(env), 200, {
          "cache-control": "public, max-age=60",
          "access-control-allow-origin": "*",
        });
      }
      return new Response(null, {
        status: 405,
        headers: { allow: "GET, OPTIONS" },
      });
    }

    if (url.pathname === "/terms") {
      if (request.method === "GET" || request.method === "HEAD") {
        return new Response(TERMS_TEXT, {
          status: 200,
          headers: {
            "content-type": "text/plain; charset=utf-8",
            "cache-control": "public, max-age=60",
          },
        });
      }
      return new Response(null, {
        status: 405,
        headers: { allow: "GET" },
      });
    }

    if (url.pathname === "/api/signup/agent") {
      return handleAgentPostEndpoint(request, () => handleSignup(request, env));
    }

    if (url.pathname === "/api/login/agent") {
      return handleAgentPostEndpoint(request, () => handleLogin(request, env));
    }

    return json(
      {
        error: "not_found",
        error_description: "No such endpoint",
        retryable: false,
      },
      404,
      NO_STORE,
    );
  },
};
