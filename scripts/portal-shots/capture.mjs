// Capture the /portal/** screenshots over the Chrome DevTools Protocol.
//
// Prerequisites: `run-portal.mjs build`, `run-portal.mjs`, `seed.mjs` and a
// headless Chromium started with --remote-debugging-port=9333. Writes 1280 px
// PNGs to public/screenshots/portal/, plus an unshipped 390 px mobile dashboard.
// The Master Agreement text is replaced client-side with a placeholder before
// capture; the full agreement is never stored in an image or in this repo.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";

const MONOREPO =
  process.env.PORTAL_MONOREPO_ROOT ?? `${homedir()}/agent-identity`;
const SEED_FILE = process.env.PORTAL_SHOTS_SEED ?? "/tmp/portal-seed.json";
const OUT = process.env.PORTAL_SHOTS_OUT ?? "public/screenshots/portal";
const DEMO_KEY = process.env.BROKER_DEMO_LOGIN_KEY;
const PORT = Number(process.env.PORTAL_CDP_PORT ?? 9333);
const BASE = process.env.PORTAL_SHOTS_BASE ?? "http://127.0.0.1:3100";

if (!DEMO_KEY) throw new Error("Set BROKER_DEMO_LOGIN_KEY for the demo login.");
mkdirSync(OUT, { recursive: true });

const env = {};
for (const line of readFileSync(`${MONOREPO}/.env`, "utf8").split("\n")) {
  if (!line || line.startsWith("#")) continue;
  const i = line.indexOf("=");
  if (i < 0) continue;
  env[line.slice(0, i)] = line.slice(i + 1).replace(/^"|"$/g, "");
}
const seed = JSON.parse(readFileSync(SEED_FILE, "utf8"));
const dbHeaders = {
  apikey: env.sb_admin,
  Authorization: `Bearer ${env.sb_admin}`,
  "Content-Type": "application/json",
  Prefer: "return=minimal",
};

async function patchProfile(body) {
  const res = await fetch(
    `${env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/human_profiles?id=eq.${seed.humanId}`,
    { method: "PATCH", headers: dbHeaders, body: JSON.stringify(body) },
  );
  if (!res.ok) {
    throw new Error(`profile patch ${res.status}: ${await res.text()}`);
  }
}

async function insertChallenge() {
  const res = await fetch(
    `${env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/human_email_verifications`,
    {
      method: "POST",
      headers: dbHeaders,
      body: JSON.stringify({
        human_id: seed.humanId,
        email: seed.email,
        otp_code: "482910",
        expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
      }),
    },
  );
  if (!res.ok) {
    throw new Error(`challenge insert ${res.status}: ${await res.text()}`);
  }
}

const list = await (await fetch(`http://127.0.0.1:${PORT}/json`)).json();
const page = list.find((t) => t.type === "page");
const ws = new WebSocket(page.webSocketDebuggerUrl);
let seq = 0;
const pending = new Map();

ws.addEventListener("message", (event) => {
  const msg = JSON.parse(event.data);
  if (msg.id && pending.has(msg.id)) {
    const { resolve, reject } = pending.get(msg.id);
    pending.delete(msg.id);
    if (msg.error) reject(new Error(JSON.stringify(msg.error)));
    else resolve(msg.result);
  }
});

await new Promise((resolve, reject) => {
  ws.addEventListener("open", resolve);
  ws.addEventListener("error", reject);
});

function send(method, params = {}) {
  const id = ++seq;
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });
    ws.send(JSON.stringify({ id, method, params }));
  });
}

async function evaluate(expression, awaitPromise = true) {
  const result = await send("Runtime.evaluate", {
    expression,
    awaitPromise,
    returnByValue: true,
  });
  if (result.exceptionDetails) {
    throw new Error(
      result.exceptionDetails.exception?.description ??
        JSON.stringify(result.exceptionDetails),
    );
  }
  return result.result.value;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function waitFor(expression, timeout = 15000) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    if (await evaluate(expression)) return true;
    await sleep(150);
  }
  throw new Error(`timeout: ${expression}`);
}

async function viewport(width, height = 900, mobile = width < 768) {
  await send("Emulation.setDeviceMetricsOverride", {
    width,
    height,
    deviceScaleFactor: 1,
    mobile,
  });
}

async function goto(path, settle = 900) {
  await send("Page.navigate", { url: `${BASE}${path}` });
  await waitFor(`document.readyState === "complete"`);
  await sleep(settle);
}

async function fullShot(name) {
  await send("Emulation.setDeviceMetricsOverride", {
    width: 1280,
    height: 900,
    deviceScaleFactor: 1,
    mobile: false,
  });
  await sleep(250);
  const height = Math.min(
    Math.ceil(
      await evaluate(
        `Math.max(document.documentElement.scrollHeight, document.body.scrollHeight)`,
      ),
    ),
    2600,
  );
  await send("Emulation.setDeviceMetricsOverride", {
    width: 1280,
    height,
    deviceScaleFactor: 1,
    mobile: false,
  });
  await sleep(400);
  const { data } = await send("Page.captureScreenshot", {
    format: "png",
    captureBeyondViewport: false,
  });
  writeFileSync(`${OUT}/${name}.png`, Buffer.from(data, "base64"));
  console.log("shot", name, `1280x${height}`);
}

async function clickByText(text) {
  const ok = await evaluate(`(() => {
    const el = [...document.querySelectorAll("button")].find(
      (b) => (b.textContent || "").trim().includes(${JSON.stringify(text)}),
    );
    if (!el) return false;
    el.click();
    return true;
  })()`);
  if (!ok) throw new Error(`button not found: ${text}`);
}

async function tab(text, settle = 600) {
  await clickByText(text);
  await sleep(settle);
}

await send("Page.enable");
await send("Runtime.enable");

// 1. Login page, public state: the demo button is hidden.
await send("Network.clearBrowserCookies");
await viewport(1280);
await goto("/login");
await fullShot("portal-sign-in");

// 2. Demo login.
await goto(`/login?demo=${encodeURIComponent(DEMO_KEY)}`);
await clickByText("Quick demo login");
await waitFor(`location.pathname === "/dashboard"`, 20000);
await sleep(1200);
await fullShot("portal-dashboard");

// 3. Agent detail, active agent.
await goto(`/agents/${seed.activeAgentId}`);
await fullShot("portal-agent-detail");

// 4. Inbox tab with one message open.
await goto(`/agents/${seed.activeAgentId}`);
await evaluate(`(() => {
  const el = [...document.querySelectorAll("button")].find(
    (b) => (b.textContent || "").includes("verification code"),
  );
  if (el) el.click();
  return Boolean(el);
})()`);
await sleep(500);
await fullShot("portal-inbox");

// 5. ToS liability ledger tab.
await tab("ToS liability ledger");
await fullShot("portal-ledger");

// 6. Service signups tab.
await tab("Service signups");
await fullShot("portal-signups");

// 7. Revoked agent detail and the abuse tab.
await goto(`/agents/${seed.revokedAgentId}`);
await fullShot("portal-revoked-agent");
await tab("Abuse reports");
await fullShot("portal-abuse-reports");

// 8. Mobile dashboard: captured for review, not shipped (the ledger clips).
await viewport(390, 1200, true);
await goto("/dashboard");
{
  const { data } = await send("Page.captureScreenshot", {
    format: "png",
    captureBeyondViewport: false,
  });
  writeFileSync(
    `${OUT}/portal-dashboard-mobile.png`,
    Buffer.from(data, "base64"),
  );
  console.log("shot portal-dashboard-mobile", "390x1200");
}
await viewport(1280);

// 9. OAuth consent screen.
const authorize =
  "/oauth/authorize?client_id=cli_opencode_default" +
  "&redirect_uri=" +
  encodeURIComponent("http://127.0.0.1:3333/callback") +
  "&response_type=code" +
  "&code_challenge=abcdefghijklmnopqrstuvwxyz0123456789ABCDEFG" +
  "&code_challenge_method=S256" +
  "&scope=" +
  encodeURIComponent("mcp:tools tos:accept signup:free_tier") +
  "&state=demo-state";
await goto(authorize);
await fullShot("portal-oauth-consent");

// 10. Verify-email screen: profile temporarily unverified.
await patchProfile({
  email_verified_at: null,
  master_tos_signed_at: null,
});
await insertChallenge();
await goto("/onboarding/verify-email");
await fullShot("portal-verify-email");

// 11. Master Agreement with the text replaced by a placeholder client-side.
await patchProfile({ email_verified_at: "2026-10-20T09:12:00.000Z" });
await goto("/onboarding/tos");
await evaluate(`(() => {
  const pre = document.querySelector("pre");
  if (pre) pre.textContent = "[agreement text removed in this screenshot - read the current text in the portal]";
  for (const el of document.querySelectorAll("span, p")) {
    if ((el.textContent || "").startsWith("sha256:")) {
      el.textContent = "sha256:demo-digest-removed-in-this-screenshot";
    }
  }
  return true;
})()`);
await sleep(300);
await fullShot("portal-master-agreement");

// Restore the synthetic profile to its seeded signed state.
await patchProfile({
  master_tos_signed_at: "2026-10-20T09:13:00.000Z",
});

console.log("done");
ws.close();
