import { defineConfig } from "astro/config";
import tailwindcss from "@tailwindcss/vite";
import nimbus, {
  defineConfig as defineNimbusConfig,
} from "@cloudflare/nimbus-docs";
import { tableScroll } from "@cloudflare/nimbus-docs/markdown";

const nimbusConfig = defineNimbusConfig({
  site: "https://docs.agentregistrar.dev",
  title: "Agent Registrar Docs",
  description:
    "Documentation for agent-identity-v1, the Agent Registrar broker, and the harnesses that use them.",
  locale: "en",
  github: "https://github.com/agentregistrar/docs",
  editPattern: "https://github.com/agentregistrar/docs/edit/main/{path}",
  features: {
    sidebar: true,
    tableOfContents: true,
  },
  sidebar: {
    indexDisplay: "header-link",
    overviewLabel: true,
    // The content tree is the sidebar. Manual groups only fix the top-level
    // order from docs/12-docs-push/01-docs-ia-audit-and-decisions.md section 5.4
    // and keep the versioned protocol family inside the Protocol group.
    items: [
      { label: "Home", link: "/" },
      {
        label: "Start here",
        autogenerate: { directory: "start" },
        collapsed: false,
      },
      {
        label: "Agents & harnesses",
        autogenerate: { directory: "agents" },
        collapsed: false,
      },
      {
        label: "Providers",
        autogenerate: { directory: "providers" },
        collapsed: false,
      },
      {
        label: "Protocol",
        items: [
          { autogenerate: { directory: "protocol" } },
          { autogenerate: { directory: "agent-identity" } },
        ],
      },
      {
        label: "Portal",
        autogenerate: { directory: "portal" },
        collapsed: false,
      },
      {
        label: "Reference",
        autogenerate: { directory: "reference" },
        collapsed: false,
      },
      {
        label: "Contribute",
        autogenerate: { directory: "contribute" },
        collapsed: false,
      },
    ],
  },
  search: {},
});

export default defineConfig({
  output: "static",
  // The Terminal voice is ASCII-only; keep straight quotes in rendered text.
  markdown: { smartypants: false },
  vite: {
    plugins: [tailwindcss()],
  },
  prefetch: {
    prefetchAll: true,
    defaultStrategy: "hover",
  },
  integrations: [
    nimbus(nimbusConfig, {
      icons: false,
      validateMdx: true,
      rules: {
        // Issue 05 owns the final rule set; enable the basics now.
        "nimbus/single-h1": "error",
        "nimbus/bare-url": "warn",
      },
      markdown: {
        hastPlugins: [tableScroll()],
        features: { headingAttributes: true },
      },
    }),
  ],
  // Issue 01 section 5.3 redirect map. Permanent (301) single hops. Targets
  // for pages scheduled in Issues 06, 07 and 10 are configured now but resolve
  // only once those pages land; nothing deploys until Issue 04.
  redirects: {
    "/docs": { status: 308, destination: "/" },
    "/spec": { status: 308, destination: "/agent-identity/v1/specification/" },
    "/specification": { status: 308, destination: "/agent-identity/v1/specification/" },
    "/implement": { status: 308, destination: "/providers/quickstart/" },
    "/quickstart": { status: 308, destination: "/start/quickstart-agent/" },
    "/mcp": { status: 308, destination: "/reference/mcp-tools/" },
    "/registry": { status: 308, destination: "/providers/guides/validate-and-register/" },
    "/agent-identity/v1/agent-signup": { status: 308, destination: "/agent-identity/v1/" },
  },
});
