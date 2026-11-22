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
    // The content tree is the sidebar. Manual groups fix the top-level order.
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
        label: "Agents & developers",
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

/** Helper to register both slashless and trailing-slash permanent (308) redirects. */
function permanentRedirectPairs(
  map: Record<string, string>,
): Record<string, { status: 308; destination: string }> {
  const entries: Record<string, { status: 308; destination: string }> = {};
  for (const [source, destination] of Object.entries(map)) {
    const clean = source.replace(/\/+$/, "");
    entries[clean] = { status: 308, destination };
    entries[`${clean}/`] = { status: 308, destination };
  }
  return entries;
}

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
      // Authoring lint rules. Errors block merge, warnings are reviewed in the PR.
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
        // Advisory: readable prose, not correctness.
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
  // Permanent (308) single-hop redirects. Both slashless and trailing-slash
  // forms are registered so Workers static assets match `_redirects` directly.
  // Every destination must exist in this build (never chain redirects or 404).
  redirects: permanentRedirectPairs({
    // Top-level shortcuts.
    "/docs": "/",
    "/spec": "/protocol/specification/",
    "/specification": "/protocol/specification/",
    "/protocol/agent-signup": "/protocol/",
    "/implement": "/providers/quickstart/",
    "/quickstart": "/agents/quickstart/",
    "/mcp": "/reference/mcp-tools/",
    "/registry": "/providers/guides/validate-and-register/",
    "/checker": "/providers/guides/validate-and-register/",

    // Former /agent-identity/v1/ protocol paths (single-hop to final destinations).
    "/agent-identity/v1": "/protocol/",
    "/agent-identity/v1/agent-signup": "/protocol/",
    "/agent-identity/v1/specification": "/protocol/specification/",
    "/agent-identity/v1/scope-boundaries": "/protocol/scope-boundaries/",
    "/agent-identity/v1/implementation-guide": "/protocol/implementation-guide/",
    "/agent-identity/v1/validator": "/protocol/validator/",
    "/agent-identity/v1/discovery-fields": "/protocol/discovery-fields/",
    "/agent-identity/v1/assertion-claims": "/protocol/assertion-claims/",
    "/agent-identity/v1/receipt-and-context": "/protocol/receipt-and-context/",
    "/agent-identity/v1/security": "/protocol/security/",
    "/agent-identity/v1/conformance": "/protocol/validator/",
    "/agent-identity/v1/versioning": "/protocol/changelog/",
    "/agent-identity/v1/changelog": "/protocol/changelog/",

    // Consolidated Start pages.
    "/start/concepts": "/reference/glossary/",
    "/start/quickstart-agent": "/agents/quickstart/",
    "/start/quickstart-provider": "/providers/quickstart/",

    // Consolidated Agents & install pages.
    "/agents/first-signup": "/agents/quickstart/",
    "/agents/identity-lifecycle": "/agents/portal/",
    "/agents/terms-and-ledger": "/agents/portal/",
    "/agents/install/antigravity": "/agents/install/",
    "/agents/install/claude-code": "/agents/install/",
    "/agents/install/claude-desktop": "/agents/install/",
    "/agents/install/codex-cli": "/agents/install/",
    "/agents/install/cursor": "/agents/install/",
    "/agents/install/generic-mcp": "/agents/install/",
    "/agents/install/opencode": "/agents/install/",
    "/agents/install/vscode": "/agents/install/",
    "/agents/install/oauth-troubleshooting": "/agents/troubleshooting/",

    // Retired /portal/* section folded into /agents/portal/ and related guides.
    "/portal": "/agents/portal/",
    "/portal/sign-in-and-verification": "/agents/portal/",
    "/portal/master-agreement": "/agents/portal/",
    "/portal/dashboard": "/agents/portal/",
    "/portal/agent-detail": "/agents/portal/",
    "/portal/ledger": "/agents/portal/",
    "/portal/kill-switch-and-revocation": "/agents/portal/",
    "/portal/inbox": "/agents/inbox-and-verification/",
    "/portal/abuse-reports": "/providers/guides/abuse-reporting/",

    // Consolidated Providers pages.
    "/providers/concepts/brokered-signup": "/start/how-it-works/",
    "/providers/concepts/identity-only-discovery": "/providers/guides/publish-discovery/",
    "/providers/concepts/liability-and-terms": "/start/trust-and-limits/",
    "/providers/guides/serve-terms": "/providers/guides/publish-discovery/",
    "/providers/guides/error-codes": "/reference/error-codes/",
    "/providers/guides/publish-context-guide": "/providers/guides/issue-signup-receipt/",
    "/providers/guides/production-checklist": "/providers/troubleshooting/",
    "/providers/hosting/nextjs": "/providers/hosting/",
    "/providers/hosting/cloudflare-worker": "/providers/hosting/",
    "/providers/hosting/generic-http": "/providers/hosting/",
    "/providers/reference-vaporcloud": "/demo/",

    // Consolidated Protocol & Contribute pages.
    "/protocol/conformance": "/protocol/validator/",
    "/protocol/versioning": "/protocol/changelog/",
    "/contribute/docs": "/contribute/",
    "/contribute/local-development": "/contribute/",
    "/contribute/spec": "/contribute/",
  }),
});
