# Agent Registrar Docs

The public documentation site for Agent Registrar and `agent-identity-v1`. It is
built with [Cloudflare Nimbus](https://nimbus-docs.com) on Astro and deploys as
static output.

- Live site: <https://docs.agentregistrar.dev>
- Product site: <https://agentregistrar.dev>
- Specification repository: <https://github.com/agentregistrar/spec>

The site currently ships the functional shell and the home and section landing
pages. The protocol, provider, agent, portal and reference content lands in
Issues 06-11 of `docs/12-docs-push`.

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
pnpm check      # nimbus-docs check: environment, structure, authoring, types
pnpm lint       # nimbus-docs lint: content rules
pnpm typecheck  # astro check (TypeScript and .astro files)
```

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

Redirects from the Issue 01 URL map are declared in `astro.config.ts` and emitted
to `dist/_redirects` at build time.

## Authoring

- A page is a `.md` or `.mdx` file under `src/content/docs/`. Frontmatter
  requires `title`; `description`, `sidebar.order` and the provenance fields
  (`audience`, `verifiedAgainst`, `lastReviewed`, `aiGenerated`, `source`) are
  optional today and become policy in Issue 05.
- Use the Nimbus components registered in `src/components.ts` (`Aside`, `Card`,
  `CardGrid`, `Steps`, `Tabs`, and the rest) rather than new one-off widgets.
- Rendered text is ASCII, sentence case and free of icons. The site is dark-only
  and has no theme toggle.
- The contribution guide (`CONTRIBUTING.md`) lands in Issue 12. Until then, use
  the page templates and voice rules in
  `docs/12-docs-push/01-docs-ia-audit-and-decisions.md`.

## Spec sync

The normative protocol pages will be generated from a pinned tag of
`agentregistrar/spec` by `scripts/sync-spec.mjs`, with `spec.lock.json` recording
the tag, commit and file hashes. Issue 06 implements the sync. `pnpm sync:spec`
is a placeholder today.

## Deployment

The build is static and targets Cloudflare Workers static assets
(`wrangler.jsonc`). Issue 04 creates the Worker, verifies the redirects and
headers, and attaches `docs.agentregistrar.dev`; this repository does not deploy
from Issue 02.

```bash
pnpm build
pnpm deploy     # wrangler deploy, once Issue 04 has provisioned the Worker
```

## License

Apache-2.0. See [LICENSE](./LICENSE).
