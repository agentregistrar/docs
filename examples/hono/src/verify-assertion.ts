import {
  createRemoteJWKSet,
  decodeJwt,
  decodeProtectedHeader,
  errors,
  jwtVerify,
  type JWTPayload,
} from "jose";

export interface VerifierConfig {
  issuerAllowlist: string[];
  audience: string;
  requiredScopes: string[];
  termsUrl: string;
  termsSha256?: string;
  jwksUrlOverride?: string;
}

export interface AssertionClaims {
  iss: string;
  aud: string;
  jti: string;
  iat: number;
  exp: number;
  human: { id: string; verified: true } & Record<string, unknown>;
  delegation: {
    scopes: string[];
    accepted_rp_tos_url: string;
    accepted_rp_tos_hash?: string;
  } & Record<string, unknown>;
  [claim: string]: unknown;
}

export type VerifyResult =
  | { ok: true; claims: AssertionClaims }
  | {
      ok: false;
      status: 400 | 401 | 403 | 409;
      error: string;
      error_description: string;
    };

const keySets = new Map<string, ReturnType<typeof createRemoteJWKSet>>();

function jwksFor(url: string) {
  let jwks = keySets.get(url);
  if (!jwks) {
    jwks = createRemoteJWKSet(new URL(url), {
      timeoutDuration: 5000,
      cooldownDuration: 30000,
    });
    keySets.set(url, jwks);
  }
  return jwks;
}

function fail(
  status: 400 | 401 | 403 | 409,
  error: string,
  error_description: string,
): VerifyResult {
  return { ok: false, status, error, error_description };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeUrl(value: string) {
  return value.replace(/\/+$/, "");
}

function readBearerToken(header: string | null | undefined): string | null {
  if (typeof header !== "string") return null;
  const match = /^Bearer\s+(\S+)$/i.exec(header.trim());
  return match ? match[1] : null;
}

/**
 * Verify an Agent Identity assertion.
 *
 * The result is a discriminated union: expected failures return
 * `{ ok: false, status, error, error_description }` and never throw.
 *
 * The issuer is read from the unverified payload only to check the configured
 * allowlist before any network call. Signature and claim checks run after the
 * per-issuer JWKS is resolved from the allowlisted issuer, never from `jku` or
 * `x5u`. After verification, the signed issuer must equal the issuer used to
 * select the JWKS, so the token cannot mix one allowlisted key source with a
 * different allowlisted `iss` claim.
 */
export async function verifyAssertion(
  authorization: string | null | undefined,
  cfg: VerifierConfig,
): Promise<VerifyResult> {
  const token = readBearerToken(authorization);
  if (!token) {
    return fail(
      400,
      "invalid_request",
      "Authorization header must be Bearer <jwt>",
    );
  }

  let header: ReturnType<typeof decodeProtectedHeader>;
  try {
    header = decodeProtectedHeader(token);
  } catch {
    return fail(401, "invalid_assertion", "Malformed JOSE header");
  }
  if ("jku" in header || "x5u" in header) {
    return fail(
      401,
      "invalid_assertion",
      "Remote key headers jku and x5u are not allowed",
    );
  }

  let unverified: JWTPayload;
  try {
    unverified = decodeJwt(token);
  } catch {
    return fail(401, "invalid_assertion", "Malformed JWT payload");
  }

  const issuer = unverified.iss;
  if (typeof issuer !== "string" || !cfg.issuerAllowlist.includes(issuer)) {
    return fail(403, "issuer_not_allowed", "Issuer is not in issuer_allowlist");
  }

  const jwksUrl = cfg.jwksUrlOverride ?? `${issuer}/.well-known/jwks.json`;

  let payload: JWTPayload;
  try {
    const result = await jwtVerify(token, jwksFor(jwksUrl), {
      algorithms: ["EdDSA"],
      typ: "agent-id+jwt",
      clockTolerance: 60,
    });
    payload = result.payload;
  } catch (error) {
    const code = (error as { code?: string }).code;
    if (error instanceof errors.JWTExpired || code === "ERR_JWT_EXPIRED") {
      return fail(401, "assertion_expired", "Assertion has expired");
    }
    return fail(
      401,
      "invalid_assertion",
      "Signature or JOSE header verification failed",
    );
  }

  if (typeof payload.iss !== "string" || payload.iss !== issuer) {
    return fail(
      403,
      "issuer_not_allowed",
      "Verified issuer does not match the issuer used to resolve keys",
    );
  }
  if (payload.aud !== cfg.audience) {
    return fail(403, "audience_mismatch", "Assertion audience does not match");
  }

  const iat = payload.iat;
  const exp = payload.exp;
  const now = Math.floor(Date.now() / 1000);
  if (
    typeof iat !== "number" ||
    typeof exp !== "number" ||
    exp <= iat ||
    iat > now + 60 ||
    exp - iat > 300
  ) {
    return fail(
      401,
      "invalid_assertion",
      "Assertion must carry numeric iat and exp with a positive lifetime of at most 300 seconds, and iat no more than 60 seconds in the future",
    );
  }

  const delegation = isRecord(payload.delegation)
    ? payload.delegation
    : undefined;
  const rawScopes = delegation?.scopes;
  const scopes: string[] = Array.isArray(rawScopes)
    ? rawScopes.filter((scope): scope is string => typeof scope === "string")
    : [];
  if (!cfg.requiredScopes.every((scope) => scopes.includes(scope))) {
    return fail(
      403,
      "insufficient_scope",
      "Delegated scopes do not cover required_scopes",
    );
  }

  const human = isRecord(payload.human) ? payload.human : undefined;
  if (
    !human ||
    human.verified !== true ||
    typeof human.id !== "string" ||
    human.id.length === 0
  ) {
    return fail(403, "human_unverified", "The human owner is not verified");
  }

  const acceptedUrl = delegation?.accepted_rp_tos_url;
  if (
    typeof acceptedUrl !== "string" ||
    normalizeUrl(acceptedUrl) !== normalizeUrl(cfg.termsUrl)
  ) {
    return fail(
      409,
      "tos_hash_mismatch",
      "Accepted terms URL does not match the published terms URL",
    );
  }
  if (
    cfg.termsSha256 !== undefined &&
    delegation?.accepted_rp_tos_hash !== cfg.termsSha256
  ) {
    return fail(
      409,
      "tos_hash_mismatch",
      "Accepted terms hash does not match the served terms bytes",
    );
  }

  const jti = payload.jti;
  if (typeof jti !== "string" || jti.length === 0) {
    return fail(401, "invalid_assertion", "Assertion must carry a non-empty jti");
  }

  return {
    ok: true,
    claims: {
      ...payload,
      iss: payload.iss,
      aud: cfg.audience,
      jti,
      iat,
      exp,
      human: { ...human, id: human.id, verified: true },
      delegation: {
        ...(delegation ?? {}),
        scopes,
        accepted_rp_tos_url: acceptedUrl,
        ...(typeof delegation?.accepted_rp_tos_hash === "string"
          ? { accepted_rp_tos_hash: delegation.accepted_rp_tos_hash }
          : {}),
      },
    },
  };
}
