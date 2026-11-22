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

// Local demo only. Replace both maps with durable storage that has unique
// constraints on (iss, human.id) and jti before taking live traffic.
const accounts = new Map<string, { accountId: string; apiKey: string }>();
const seenJti = new Map<string, string>();

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
    jwksUrlOverride: env.JWKS_URL_OVERRIDE,
  });

  if (!result.ok) {
    return errorResponse(result.status, result.error, result.error_description);
  }

  const claims = result.claims;
  const accountKey = `${claims.iss}:${claims.human.id}`;
  const previousAccount = seenJti.get(claims.jti);

  if (previousAccount !== undefined && previousAccount !== accountKey) {
    return errorResponse(
      409,
      "assertion_replayed",
      "Assertion id used in a conflicting context",
    );
  }
  seenJti.set(claims.jti, accountKey);

  const existing = accounts.get(accountKey);
  if (existing) {
    return json(
      { resolution: "resolved", account_id: existing.accountId },
      200,
      NO_STORE,
    );
  }

  const created = {
    accountId: `acct_${crypto.randomUUID()}`,
    apiKey: `key_${crypto.randomUUID()}`,
  };
  accounts.set(accountKey, created);

  return json(
    {
      resolution: "created",
      account_id: created.accountId,
      api_key: created.apiKey,
    },
    201,
    NO_STORE,
  );
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
      return handleSignup(request, env);
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
