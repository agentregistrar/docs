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
      // Authoring lint rules. The policy and the pass/fail workflow live in
      // AGENT.md ("Lint and the review gates"); this block is the single
      // configuration. Errors block merge, warnings are reviewed in the PR.
      // `astro build` (or `astro sync`) materializes these into
      // `.nimbus/lint.json`, which `nimbus-docs lint` reads.
      rules: {
        // Structural: a page that fails these is broken for a reader.
        "nimbus/frontmatter-shape": "error",
        "nimbus/description-required": "error",
        "nimbus/single-h1": "error",
        "nimbus/heading-hierarchy": "error",
        "nimbus/duplicate-heading-text": "error",
        "nimbus/code-block-lang": "error",
        // Links: these read `.nimbus/routes.json`, so run the build first.
        "nimbus/internal-link": "error",
        "nimbus/redirected-link": "error",
        "nimbus/image-ref": "error",
        // Advisory: readable prose, not correctness. Review the count, do not
        // gate on it. `bare-url` is the release's replacement for the
        // "descriptive link text" rule in the plan (recorded in AGENT.md).
        "nimbus/bare-url": "warn",
        "nimbus/no-self-host-url": "warn",
        "nimbus/code-block-prompt-prefix": "warn",
        "nimbus/heading-punctuation": "warn",
        "nimbus/emphasis-style": "warn",
        "nimbus/list-marker-style": "warn",
      },
      collections: {
        // Partials are fragments: no H1, no description of their own.
        partials: {
          rules: {
            "nimbus/single-h1": "off",
            "nimbus/description-required": "off",
            "nimbus/heading-hierarchy": "off",
          },
        },
      },
      markdown: {
        hastPlugins: [tableScroll()],
        features: { headingAttributes: true },
      },
    }),
  ],
  // Redirect map from the information architecture decisions. Permanent (308)
  // single hops. Every source is registered twice, with and without the
  // trailing slash: Workers static assets matches `_redirects` entries
  // exactly, so the trailing-slash form needs its own rule or the built
  // `<path>/index.html` meta-refresh stub is served with a 200 instead. Only
  // entries whose destination route is in this build are active: a redirect
  // may never point at a 404. The staged shortcuts are activated by the issue
  // that lands their target page, and every entry is re-verified against the
  // deployed host by the release verification issue.
  redirects: {
    "/docs": { status: 308, destination: "/" },
    "/docs/": { status: 308, destination: "/" },
    "/spec": { status: 308, destination: "/agent-identity/v1/specification/" },
    "/spec/": { status: 308, destination: "/agent-identity/v1/specification/" },
    "/specification": {
      status: 308,
      destination: "/agent-identity/v1/specification/",
    },
    "/specification/": {
      status: 308,
      destination: "/agent-identity/v1/specification/",
    },
    // The optional `spec` field's placeholder path. It now resolves to the v1
    // landing instead of a 404.
    "/agent-identity/v1/agent-signup": {
      status: 308,
      destination: "/agent-identity/v1/",
    },
    "/agent-identity/v1/agent-signup/": {
      status: 308,
      destination: "/agent-identity/v1/",
    },
    // The provider, agent, reference and registry shortcuts. Their target pages
    // landed in Issues 07, 08 and 10; the release verification issue activates
    // the shortcuts and re-checks every entry against the deployed host.
    "/implement": { status: 308, destination: "/providers/quickstart/" },
    "/implement/": { status: 308, destination: "/providers/quickstart/" },
    "/quickstart": { status: 308, destination: "/start/quickstart-agent/" },
    "/quickstart/": { status: 308, destination: "/start/quickstart-agent/" },
    "/mcp": { status: 308, destination: "/reference/mcp-tools/" },
    "/mcp/": { status: 308, destination: "/reference/mcp-tools/" },
    "/registry": {
      status: 308,
      destination: "/providers/guides/validate-and-register/",
    },
    "/registry/": {
      status: 308,
      destination: "/providers/guides/validate-and-register/",
    },
  },
});
