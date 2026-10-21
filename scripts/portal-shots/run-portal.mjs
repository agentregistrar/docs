// Run the broker portal locally with the synthetic demo human for screenshots.
//
// Reads the monorepo .env, overrides the demo identity, and runs
// `next build` or `next start -p 3100`. The demo login key comes from the
// environment; no credential is stored in this repository.
import { spawn } from "node:child_process";
import { readFileSync } from "node:fs";
import { homedir } from "node:os";

const MONOREPO =
  process.env.PORTAL_MONOREPO_ROOT ?? `${homedir()}/agent-identity`;
const env = { ...process.env };
for (const line of readFileSync(`${MONOREPO}/.env`, "utf8").split("\n")) {
  if (!line || line.startsWith("#")) continue;
  const i = line.indexOf("=");
  if (i < 0) continue;
  env[line.slice(0, i)] = line.slice(i + 1).replace(/^"|"$/g, "");
}

Object.assign(env, {
  BROKER_DEMO_HUMAN_EMAIL: "portal-demo@example.com",
  BROKER_DEMO_HUMAN_NAME: "Demo Owner",
  BROKER_DEMO_HUMAN_GITHUB: "demo-owner",
  BROKER_DEMO_HUMAN_PASSWORD: "synthetic-demo-password-not-a-secret",
  BROKER_DEMO_LOGIN_KEY: process.env.BROKER_DEMO_LOGIN_KEY ?? env.sb_demo_key,
  BROKER_BASE_URL: "https://agentregistrar.dev",
  NEXT_PUBLIC_BROKER_BASE_URL: "https://agentregistrar.dev",
  RESEND_AGENT_DOMAIN: "agents.agentregistrar.dev",
  NODE_ENV: "production",
});

const cmd = process.argv[2] === "build" ? "build" : "start";
const args =
  cmd === "build"
    ? ["exec", "next", "build"]
    : ["exec", "next", "start", "-p", "3100"];

const child = spawn("pnpm", args, {
  cwd: `${MONOREPO}/apps/broker-portal`,
  env,
  stdio: "inherit",
});
child.on("exit", (code) => process.exit(code ?? 1));
