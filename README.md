# Agent Registrar Docs

The public documentation site for Agent Registrar and `agent-identity-v1`. It is
built with [Cloudflare Nimbus](https://nimbus-docs.com) on Astro and deploys as
static output.

- Live site: <https://docs.agentregistrar.dev>
- Product site: <https://agentregistrar.dev>
- Specification repository: <https://github.com/agentregistrar/spec>

The site currently ships the functional shell and the home and section landing
pages. The protocol, provider, agent, portal and reference content is being
added section by section.

## Local development

Requirements:

- Node `22.12` or newer (the repository is developed on Node 24).
- pnpm `9.15.4` (pinned in `package.json`).

```bash
pnpm install
pnpm dev        # Astro dev server at http://localhost:4321
pnpm build      # static output in dist/
pnpm preview    # serve the built output
```

Authoring checks:

```bash
pnpm build      # must run before lint: the link rules read .nimbus/routes.json
pnpm check      # nimbus-docs check: environment, structure, authoring, types
pnpm lint       # nimbus-docs lint: content rules
pnpm typecheck  # astro check (TypeScript and .astro files)
pnpm check:theme # Terminal theme QA gate (radius/shadow/gradient/icons/non-ASCII)
```

The site rules for coding agents - provenance, lint, spec sync, verification,
what not to change - are in [`AGENT.md`](./AGENT.md). Read it before editing a
page. There are no tests; the gates above are the verification.

The visual system, token map, component recipes, deviations and the review
record are in [`THEME.md`](./THEME.md). Read it before adding a component or a
color.

Do not run the build and the dev server against the same `.nimbus/` cache at the
same time.

## Project structure

Nimbus owns the framework package; everything under `src/` is owned by this
repository. The important files:

```text
astro.config.ts          Nimbus config, integration options and redirects
nimbus.json              framework provenance (pinned Nimbus release)
wrangler.jsonc           Cloudflare Workers static-assets target
src/
  components.ts          components available in every MDX file
  components/            Header, Footer and the Nimbus UI components
  content/
    docs/                the page tree: routes and sidebar
    partials/            shared MDX partials
  content.config.ts      docs/partials collections and provenance fields
  layouts/               BaseLayout and DocsLayout
  pages/                 routes, 404, Markdown/llms/robots/OG endpoints
  styles/                Tailwind entry, dark-only tokens and prose styles
```

The content tree is the IA: a page's path under `src/content/docs/` is its URL,
and the sidebar is generated from the same tree. Top-level order and the
Protocol group are pinned in `astro.config.ts`.

Current pages:

- `/` - docs home
- `/start/`, `/agents/`, `/providers/`, `/protocol/`, `/portal/`, `/reference/`,
  `/contribute/` - section landings
- `/404.html` - not-found page

Redirects are declared in `astro.config.ts` and emitted to `dist/_redirects` at
build time. Only redirects whose destination page exists are active.

## Authoring

- A page is a `.md` or `.mdx` file under `src/content/docs/`. Frontmatter
  requires `title` and `description`. The provenance fields follow the policy in
  [`AGENT.md`](./AGENT.md) section 5: `audience` defaults to `both`;
  `aiGenerated: true` marks an agent draft and stays visible as "awaiting
  review" until a human clears it; `verifiedAgainst`, `lastReviewed` and
  `source` are set only when that evidence exists for the page.
- Use the Nimbus components registered in `src/components.ts` (`Aside`, `Card`,
  `CardGrid`, `Steps`, `Tabs`, and the rest) rather than new one-off widgets.
- Rendered text is ASCII, sentence case and free of icons. The site is dark-only
  and has no theme toggle.
- The contribution guide (`CONTRIBUTING.md`) is not published yet. Until then,
  use the page templates and voice rules in [`AGENT.md`](./AGENT.md) sections 6
  and 7.

## Docs for agents

Every discoverable page is emitted twice at build time: HTML for readers and
Markdown for agents. The surface is:

- `/llms.txt` and `/llms-full.txt` - the index and the whole site in one
  document.
- `/<section>/llms.txt` - per-section index, emitted once a section has more
  than one page; every section is a single landing today, so only the root
  `/llms.txt` exists.
- `/<slug>/index.md` - the page as clean Markdown; `/<slug>/index.mdx` - the
  authored source.
- `/.well-known/ard.json` and `/.well-known/ai-catalog.json` - discovery
  manifests.
- `/.well-known/agent-skills/index.json` plus one artifact per skill under
  `skills/<name>/SKILL.md`.
- JSON-LD in each page head, `sitemap.xml`, and `robots.txt` with
  `Content-Signal: ai-train=yes, search=yes, ai-input=yes`.

Published skills:

- `install-agent-identity` - connect a harness, register an agent, complete a
  first brokered signup.
- `implement-agent-identity` - publish identity-only discovery, verify
  assertions, return stable errors, issue a receipt.
- `verify-agent-signup` - audit a discovery document and report pass or fail
  with evidence.

Content types and cache policy for these paths are in `public/_headers`.

## Spec sync

The normative protocol pages will be generated from a pinned tag of
`agentregistrar/spec` by `scripts/sync-spec.mjs`, with `spec.lock.json` recording
the tag, commit and file hashes. The sync is not implemented yet; `pnpm
sync:spec` is a placeholder today.

## Deployment

The site is live at `https://docs.agentregistrar.dev`, served by the existing
Cloudflare Pages project `agentregistrar-docs`, which is Git-connected to this
repository and builds the production branch `main` on push.

The Workers cutover is still pending (Issue 04). The build is static and
`wrangler.jsonc` targets Cloudflare Workers static assets; the Worker, the
redirects and headers policy, the host-header policy, the DNS change and the
final topology are unprovisioned from this repository today.

```bash
pnpm build
pnpm deploy     # wrangler deploy, once the Workers cutover lands
```

## License

Apache-2.0. See [LICENSE](./LICENSE).
