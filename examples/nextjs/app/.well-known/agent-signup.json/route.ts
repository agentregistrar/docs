const PORT = 3003;

function providerOrigin() {
  return process.env.PROVIDER_ORIGIN ?? `http://127.0.0.1:${PORT}`;
}

function providerAudience() {
  return process.env.PROVIDER_AUDIENCE ?? "nextjs-example";
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
    provider_name: "Next.js App Router example",
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

export function GET() {
  return Response.json(discoveryDocument(), {
    headers: {
      "cache-control": "public, max-age=60",
      "access-control-allow-origin": "*",
    },
  });
}

export function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      "access-control-allow-origin": "*",
      "access-control-allow-methods": "GET, OPTIONS",
      "access-control-allow-headers": "Content-Type",
    },
  });
}
