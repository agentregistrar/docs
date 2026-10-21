// Exercise the kill switch against the synthetic active agent and print the
// before/after portal state. Read-only apart from the revocation itself; run it
// after the capture set is complete, then delete the synthetic account.
import { readFileSync } from "node:fs";

const SEED_FILE = process.env.PORTAL_SHOTS_SEED ?? "/tmp/portal-seed.json";
const DEMO_KEY = process.env.BROKER_DEMO_LOGIN_KEY;
const PORT = Number(process.env.PORTAL_CDP_PORT ?? 9333);
const BASE = process.env.PORTAL_SHOTS_BASE ?? "http://127.0.0.1:3100";

if (!DEMO_KEY) throw new Error("Set BROKER_DEMO_LOGIN_KEY for the demo login.");
const seed = JSON.parse(readFileSync(SEED_FILE, "utf8"));

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

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function evaluate(expression) {
  const result = await send("Runtime.evaluate", {
    expression,
    awaitPromise: true,
    returnByValue: true,
  });
  if (result.exceptionDetails) {
    throw new Error(JSON.stringify(result.exceptionDetails));
  }
  return result.result.value;
}

async function waitFor(expression, timeout = 20000) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    if (await evaluate(expression)) return;
    await sleep(200);
  }
  throw new Error(`timeout ${expression}`);
}

await send("Page.enable");
await send("Runtime.enable");
await send("Network.clearBrowserCookies");
await send("Page.navigate", {
  url: `${BASE}/login?demo=${encodeURIComponent(DEMO_KEY)}`,
});
await waitFor(`document.readyState === "complete"`);
await sleep(800);
await evaluate(`(() => {
  const b=[...document.querySelectorAll("button")].find(b=>b.textContent.includes("Quick demo login"));
  if(!b) return false; b.click(); return true;
})()`);
await waitFor(`location.pathname === "/dashboard"`);
await sleep(1000);
await send("Page.navigate", { url: `${BASE}/agents/${seed.activeAgentId}` });
await waitFor(`document.readyState === "complete"`);
await sleep(800);
console.log(
  "before:",
  await evaluate(`JSON.stringify({
    status: [...document.querySelectorAll("span")].map(e=>e.textContent.trim()).find(t=>t==="ACTIVE")||null,
    button: [...document.querySelectorAll("button")].map(e=>e.textContent.trim()).find(t=>/Revoke agent/.test(t))||null,
  })`),
);
await evaluate(`(() => {
  const b=[...document.querySelectorAll("button")].find(b=>b.textContent.trim()==="Revoke agent");
  if(!b) return false; b.click(); return true;
})()`);
await sleep(2500);
console.log(
  "after:",
  await evaluate(`JSON.stringify({
    status: [...document.querySelectorAll("span")].map(e=>e.textContent.trim()).find(t=>t==="REVOKED")||null,
    button: [...document.querySelectorAll("button")].map(e=>e.textContent.trim()).find(t=>/Reactivate agent/.test(t))||null,
    callout: (document.querySelector('[role="alert"], .text-danger')||{}).textContent?.trim()||null,
    bodyHasReason: document.body.innerText.includes("Revoked by human owner in Broker Portal"),
  })`),
);
await send("Network.clearBrowserCookies");
ws.close();
