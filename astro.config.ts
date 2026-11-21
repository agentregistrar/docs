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
    "Documentation for the Agent Identity Protocol, the Agent Registrar broker, and the harnesses that use them.",
  locale: "en",
  github: "https://github.com/agentregistrar/docs",
  editPattern: "https://github.com/agentregistrar/docs/edit/main/{path}",
  socialImage: "/og/docs-default.png",
  socialImageAlt: "agentregistrar_ docs - agent identity, brokered.",
  head: [
    { tag: "link", attrs: { rel: "apple-touch-icon", href: "/apple-touch-icon.png" } },
    { tag: "link", attrs: { rel: "manifest", href: "/site.webmanifest" } },
    // Ahrefs Site Analytics. The key is public: it ships in the page HTML.
    {
      tag: "script",
      attrs: {
        src: "https://analytics.ahrefs.com/analytics.js",
        "data-key": "F7LIwjfeuMkxUyAWl+3QQQ",
        async: "true",
      },
    },
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
        label: "Demo network",
        autogenerate: { directory: "demo" },
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
        autogenerate: { directory: "protocol" },
        collapsed: false,
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
    "/spec": { status: 308, destination: "/protocol/specification/" },
    "/spec/": { status: 308, destination: "/protocol/specification/" },
    "/specification": {
      status: 308,
      destination: "/protocol/specification/",
    },
    "/specification/": {
      status: 308,
      destination: "/protocol/specification/",
    },
    "/protocol/agent-signup": {
      status: 308,
      destination: "/protocol/",
    },
    "/protocol/agent-signup/": {
      status: 308,
      destination: "/protocol/",
    },
    // Permanent redirects from the former /agent-identity/v1/ paths.
    "/agent-identity/v1": { status: 308, destination: "/protocol/" },
    "/agent-identity/v1/": { status: 308, destination: "/protocol/" },
    "/agent-identity/v1/agent-signup": { status: 308, destination: "/protocol/" },
    "/agent-identity/v1/agent-signup/": { status: 308, destination: "/protocol/" },
    "/agent-identity/v1/specification": { status: 308, destination: "/protocol/specification/" },
    "/agent-identity/v1/specification/": { status: 308, destination: "/protocol/specification/" },
    "/agent-identity/v1/scope-boundaries": { status: 308, destination: "/protocol/scope-boundaries/" },
    "/agent-identity/v1/scope-boundaries/": { status: 308, destination: "/protocol/scope-boundaries/" },
    "/agent-identity/v1/implementation-guide": { status: 308, destination: "/protocol/implementation-guide/" },
    "/agent-identity/v1/implementation-guide/": { status: 308, destination: "/protocol/implementation-guide/" },
    "/agent-identity/v1/validator": { status: 308, destination: "/protocol/validator/" },
    "/agent-identity/v1/validator/": { status: 308, destination: "/protocol/validator/" },
    "/agent-identity/v1/discovery-fields": { status: 308, destination: "/protocol/discovery-fields/" },
    "/agent-identity/v1/discovery-fields/": { status: 308, destination: "/protocol/discovery-fields/" },
    "/agent-identity/v1/assertion-claims": { status: 308, destination: "/protocol/assertion-claims/" },
    "/agent-identity/v1/assertion-claims/": { status: 308, destination: "/protocol/assertion-claims/" },
    "/agent-identity/v1/receipt-and-context": { status: 308, destination: "/protocol/receipt-and-context/" },
    "/agent-identity/v1/receipt-and-context/": { status: 308, destination: "/protocol/receipt-and-context/" },
    "/agent-identity/v1/security": { status: 308, destination: "/protocol/security/" },
    "/agent-identity/v1/security/": { status: 308, destination: "/protocol/security/" },
    "/agent-identity/v1/conformance": { status: 308, destination: "/protocol/conformance/" },
    "/agent-identity/v1/conformance/": { status: 308, destination: "/protocol/conformance/" },
    "/agent-identity/v1/versioning": { status: 308, destination: "/protocol/versioning/" },
    "/agent-identity/v1/versioning/": { status: 308, destination: "/protocol/versioning/" },
    "/agent-identity/v1/changelog": { status: 308, destination: "/protocol/changelog/" },
    "/agent-identity/v1/changelog/": { status: 308, destination: "/protocol/changelog/" },
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
