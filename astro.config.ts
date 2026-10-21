import { defineConfig } from "astro/config";
import tailwindcss from "@tailwindcss/vite";
import nimbus, {
  defineConfig as defineNimbusConfig,
} from "@cloudflare/nimbus-docs";
import { tableScroll } from "@cloudflare/nimbus-docs/markdown";
import { terminalShikiTheme } from "./src/styles/shiki-terminal";

const nimbusConfig = defineNimbusConfig({
  site: "https://docs.agentregistrar.dev",
  title: "Agent Registrar Docs",
  description:
    "Documentation for agent-identity-v1, the Agent Registrar broker, and the harnesses that use them.",
  locale: "en",
  github: "https://github.com/agentregistrar/docs",
  editPattern: "https://github.com/agentregistrar/docs/edit/main/{path}",
  socialImage: "/og/docs-default.png",
  socialImageAlt: "agentregistrar_ docs - agent identity, brokered.",
  head: [
    { tag: "link", attrs: { rel: "apple-touch-icon", href: "/apple-touch-icon.png" } },
    { tag: "link", attrs: { rel: "manifest", href: "/site.webmanifest" } },
  ],
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
  // One neutral syntax theme: D8 tokens only, no rainbow highlighting.
  markdown: {
    smartypants: false,
    shikiConfig: { theme: terminalShikiTheme },
  },
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
  // Redirect map from the information architecture decisions. Permanent (308)
  // single hops. Only entries whose destination route is in this build are
  // active: a redirect may never point at a 404. The staged shortcuts are
  // activated by the issue that lands their target page, and every entry is
  // re-verified against the deployed host by the release verification issue.
  redirects: {
    "/docs": { status: 308, destination: "/" },
  },
  // Staged redirects (target page not in this build yet; do not activate early):
  //   /spec -> /agent-identity/v1/specification/
  //   /specification -> /agent-identity/v1/specification/
  //   /agent-identity/v1/agent-signup -> /agent-identity/v1/
  //     activated with the protocol pages
  //   /implement -> /providers/quickstart/
  //   /registry -> /providers/guides/validate-and-register/
  //     activated with the provider pages
  //   /quickstart -> /start/quickstart-agent/
  //     activated with the start pages
  //   /mcp -> /reference/mcp-tools/
  //     activated with the reference pages
});
