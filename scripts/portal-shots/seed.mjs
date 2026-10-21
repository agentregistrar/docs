// Synthetic seed for the /portal/** screenshots.
//
// Creates one synthetic human, two agents, two inbox messages, one ToS
// acceptance, one signup receipt and one abuse report, then writes the ids to a
// JSON file the capture driver reads. Every value is synthetic.
//
// This script mutates the project behind NEXT_PUBLIC_SUPABASE_URL with the
// service-role key. It refuses to run unless PORTAL_SHOTS_ALLOW_SEED=yes and the
// account email is on example.com. Run cleanup (README) immediately afterwards.
import { readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";

const MONOREPO = process.env.PORTAL_MONOREPO_ROOT ?? `${homedir()}/agent-identity`;
const OUT_IDS = process.env.PORTAL_SHOTS_SEED ?? "/tmp/portal-seed.json";
const EMAIL = "portal-demo@example.com";

if (process.env.PORTAL_SHOTS_ALLOW_SEED !== "yes") {
  throw new Error(
    "Refusing to seed: set PORTAL_SHOTS_ALLOW_SEED=yes to write synthetic rows.",
  );
}
if (!EMAIL.endsWith("@example.com")) {
  throw new Error("Refusing to seed: the demo account must stay on example.com.");
}

const env = {};
for (const line of readFileSync(`${MONOREPO}/.env`, "utf8").split("\n")) {
  if (!line || line.startsWith("#")) continue;
  const i = line.indexOf("=");
  if (i < 0) continue;
  env[line.slice(0, i)] = line.slice(i + 1).replace(/^"|"$/g, "");
}
const url = env.NEXT_PUBLIC_SUPABASE_URL;
const key = env.sb_admin;
const headers = {
  apikey: key,
  Authorization: `Bearer ${key}`,
  "Content-Type": "application/json",
  Prefer: "return=representation",
};

const PASSWORD = "synthetic-demo-password-not-a-secret";
const MASTER_HASH =
  "sha256:4d3c2b1a0f9e8d7c6b5a4938271605f4e3d2c1b0a9f8e7d6c5b4a39281706f5e4";
const TOS_HASH =
  "sha256:8a7b6c5d4e3f2a1b0c9d8e7f6a5b4c3d2e1f0a9b8c7d6e5f4a3b2c1d0e9f8a7b";
const CONTEXT_HASH =
  "sha256:1f2e3d4c5b6a798807162534435261708f9e8d7c6b5a4938271605f4e3d2c1b0";

async function api(path, options = {}) {
  const res = await fetch(`${url}${path}`, { headers, ...options });
  const text = await res.text();
  if (!res.ok) throw new Error(`${path} ${res.status}: ${text.slice(0, 400)}`);
  return text ? JSON.parse(text) : null;
}

// Idempotency: remove a previous synthetic run (cascades the profile rows).
const existing = await api(
  `/rest/v1/human_profiles?select=id&email=eq.${encodeURIComponent(EMAIL)}`,
);
for (const row of existing ?? []) {
  await api(`/auth/v1/admin/users/${row.id}`, { method: "DELETE" });
  console.log("removed previous synthetic human", row.id);
}

const created = await api("/auth/v1/admin/users", {
  method: "POST",
  body: JSON.stringify({
    email: EMAIL,
    password: PASSWORD,
    email_confirm: true,
    user_metadata: {
      full_name: "Demo Owner",
      name: "Demo Owner",
      user_name: "demo-owner",
    },
  }),
});
const humanId = created.id;
console.log("human", humanId);

await api(`/rest/v1/human_profiles?id=eq.${humanId}`, {
  method: "PATCH",
  body: JSON.stringify({
    full_name: "Demo Owner",
    email: EMAIL,
    github_handle: "demo-owner",
    email_verified_at: "2026-10-20T09:12:00.000Z",
    master_tos_signed_at: "2026-10-20T09:13:00.000Z",
    master_tos_version: "2026-10-01",
    master_tos_hash: MASTER_HASH,
    status: "active",
  }),
});

const activeAgent = {
  id: "agt_01J9DEMO0000000000000001",
  human_id: humanId,
  name: "research-scout",
  slug: "research-scout-demo01",
  harness: "opencode-v2",
  email_address: "research-scout-demo01@agents.agentregistrar.dev",
  scopes: ["tos:accept", "signup:free_tier", "inbox:read", "inbox:send"],
  status: "active",
  created_at: "2026-10-20T09:20:00.000Z",
};
const revokedAgent = {
  id: "agt_01J9DEMO0000000000000002",
  human_id: humanId,
  name: "release-notes-bot",
  slug: "release-notes-bot-demo02",
  harness: "claude-cli",
  email_address: "release-notes-bot-demo02@agents.agentregistrar.dev",
  scopes: ["tos:accept", "signup:free_tier", "inbox:read", "inbox:send"],
  status: "revoked",
  revoked_reason: "Revoked by human owner in Broker Portal",
  revoked_at: "2026-10-20T14:05:00.000Z",
  created_at: "2026-10-20T09:30:00.000Z",
};
await api("/rest/v1/agents", {
  method: "POST",
  body: JSON.stringify(activeAgent),
});
await api("/rest/v1/agents", {
  method: "POST",
  body: JSON.stringify(revokedAgent),
});

const signupToken = [
  "eyJhbGciOiJFZERTQSIsImtpZCI6ImRlbW8ta2V5IiwidHlwIjoiSldUIn0",
  "eyJzdWIiOiJhZ3RfMDFKOURFTU8wMDAwMDAwMDAwMDAwMDAwMDEiLCJhdWQiOiJodHRwczovL3ZhcG9yY2xvdWQuZGV2Iiwic2NvcGVzIjpbInNpZ251cDpmcmVlX3RpZXIiXSwiaWF0IjoxNzYwOTUwMDAwfQ",
  "ZGVtby1zaWduYXR1cmUtbm90LWEtcmVhbC1rZXk",
].join(".");

await api("/rest/v1/inbox_messages", {
  method: "POST",
  body: JSON.stringify([
    {
      agent_id: activeAgent.id,
      direction: "inbound",
      from_address: "no-reply@vaporcloud.dev",
      to_address: activeAgent.email_address,
      subject: "[VaporCloud] Your verification code: 482910",
      text_body:
        "Your VaporCloud verification code is: 482910.\n\nEnter this 6-digit code to finish creating the demo instance. This message was sent to the agent inbox.\n\n-- VaporCloud",
      html_body:
        "<p>Your VaporCloud verification code is: 482910.</p><p>Enter this 6-digit code to finish creating the demo instance.</p>",
      headers: { "x-demo-message": "synthetic", "x-agent-id": activeAgent.id },
      is_legal_or_tos: false,
      received_at: "2026-10-20T10:02:00.000Z",
    },
    {
      agent_id: activeAgent.id,
      direction: "inbound",
      from_address: "notices@vaporcloud.dev",
      to_address: activeAgent.email_address,
      subject: "[VaporCloud] Terms of Service update notice",
      text_body:
        "This is a synthetic demo notice. VaporCloud updated its free-tier Terms of Service. The new version is recorded in your ToS liability ledger and forwarded to the verified human owner.\n\n-- VaporCloud",
      html_body:
        "<p>This is a synthetic demo notice. VaporCloud updated its free-tier Terms of Service.</p>",
      headers: { "x-demo-message": "synthetic", "x-agent-id": activeAgent.id },
      is_legal_or_tos: true,
      received_at: "2026-10-20T11:40:00.000Z",
    },
  ]),
});

await api("/rest/v1/tos_acceptances", {
  method: "POST",
  body: JSON.stringify({
    agent_id: activeAgent.id,
    human_id: humanId,
    service_audience: "https://vaporcloud.dev",
    service_tos_url: "https://vaporcloud.dev/terms",
    service_tos_hash: TOS_HASH,
    master_tos_version: "2026-10-01",
    jwt_jti: "jti_01J9DEMOACCEPT00000000001",
    accepted_at: "2026-10-20T10:05:00.000Z",
    forwarded_to_human_at: "2026-10-20T10:05:30.000Z",
  }),
});

await api("/rest/v1/service_signups", {
  method: "POST",
  body: JSON.stringify({
    agent_id: activeAgent.id,
    human_id: humanId,
    assertion_jti: "jti_01J9DEMOASSERT00000000001",
    service_audience: "https://vaporcloud.dev",
    provider_name: "VaporCloud",
    provider_url: "https://vaporcloud.dev",
    provider_account_id: "acct_demo_7k2m9p",
    agent_email_used: activeAgent.email_address,
    human_email_shared: EMAIL,
    accepted_tos_url: "https://vaporcloud.dev/terms",
    accepted_tos_hash: TOS_HASH,
    signup_token: signupToken,
    signup_token_jti: "jti_01J9DEMORECEIPT0000000001",
    status: "active",
    context_url: "https://vaporcloud.dev/docs/SKILL.md",
    context_sha256: CONTEXT_HASH,
    signed_up_at: "2026-10-20T10:06:00.000Z",
  }),
});

await api("/rest/v1/abuse_reports", {
  method: "POST",
  body: JSON.stringify({
    agent_id: revokedAgent.id,
    reporter_service: "vaporcloud.dev",
    reason:
      "Synthetic demo report: the delegated agent attempted automated requests against a non-public endpoint.",
    evidence_jti: "jti_01J9DEMOABUSE000000000001",
    created_at: "2026-10-20T14:04:00.000Z",
  }),
});

writeFileSync(
  OUT_IDS,
  JSON.stringify(
    {
      humanId,
      email: EMAIL,
      activeAgentId: activeAgent.id,
      revokedAgentId: revokedAgent.id,
    },
    null,
    2,
  ),
);
console.log("seed complete; ids in", OUT_IDS);
