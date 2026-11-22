import { verifyAssertion } from "@/lib/verify-assertion";

const PORT = 3003;
const NO_STORE = { "cache-control": "no-store" };

// Local demo only. Replace both maps with a database that has unique
// constraints on (iss, human.id) and jti before taking live traffic.
const accounts = new Map<string, { accountId: string; apiKey: string }>();
const seenJti = new Map<string, string>();

function providerOrigin() {
  return process.env.PROVIDER_ORIGIN ?? `http://127.0.0.1:${PORT}`;
}

function issuerAllowlist() {
  const configured = (process.env.ISSUER_ALLOWLIST ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter((value) => value.length > 0);
  return configured.length > 0 ? configured : ["https://agentregistrar.dev"];
}

function json(body: unknown, status: number) {
  return Response.json(body, { status, headers: NO_STORE });
}

function errorResponse(status: number, error: string, description: string) {
  return json(
    { error, error_description: description, retryable: false },
    status,
  );
}

export async function POST(request: Request) {
  const origin = providerOrigin();
  const result = await verifyAssertion(request.headers.get("authorization"), {
    issuerAllowlist: issuerAllowlist(),
    audience: process.env.PROVIDER_AUDIENCE ?? "nextjs-example",
    requiredScopes: ["tos:accept"],
    termsUrl: process.env.TERMS_URL ?? `${origin}/terms`,
    termsSha256: process.env.TERMS_SHA256,
    jwksUrlOverride: process.env.JWKS_URL_OVERRIDE,
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
  );
}

export function OPTIONS() {
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

function methodNotAllowed() {
  return new Response(null, {
    status: 405,
    headers: { allow: "POST", ...NO_STORE },
  });
}

export const GET = methodNotAllowed;
export const HEAD = methodNotAllowed;
export const PUT = methodNotAllowed;
export const PATCH = methodNotAllowed;
export const DELETE = methodNotAllowed;
