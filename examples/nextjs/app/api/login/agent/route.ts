import { accounts, seenLoginJti } from "@/lib/store";
import { verifyAssertion } from "@/lib/verify-assertion";

const PORT = 3003;
const NO_STORE = { "cache-control": "no-store" };

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
  const termsUrl = process.env.TERMS_URL ?? `${origin}/terms`;
  const termsVersion = process.env.TERMS_VERSION ?? "2026.1";

  const result = await verifyAssertion(request.headers.get("authorization"), {
    issuerAllowlist: issuerAllowlist(),
    audience: process.env.PROVIDER_AUDIENCE ?? "nextjs-example",
    requiredScopes: ["tos:accept"],
    termsUrl,
    termsSha256: process.env.TERMS_SHA256,
    expectedPurpose: "login",
    jwksUrlOverride: process.env.JWKS_URL_OVERRIDE,
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
