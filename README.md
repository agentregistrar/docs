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
pnpm check      # nimbus-docs check: environment, structure, authoring, types
pnpm lint       # nimbus-docs lint: content rules
pnpm typecheck  # astro check (TypeScript and .astro files)
pnpm check:theme # Terminal theme QA gate (radius/shadow/gradient/icons/non-ASCII)
```

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
  requires `title`; `description`, `sidebar.order` and the provenance fields
  (`audience`, `verifiedAgainst`, `lastReviewed`, `aiGenerated`, `source`) are
  optional today and become policy as the provenance rules land.
- Use the Nimbus components registered in `src/components.ts` (`Aside`, `Card`,
  `CardGrid`, `Steps`, `Tabs`, and the rest) rather than new one-off widgets.
- Rendered text is ASCII, sentence case and free of icons. The site is dark-only
  and has no theme toggle.
- The contribution guide (`CONTRIBUTING.md`) is not published yet. Until then,
  use the page templates and voice rules in the information architecture
  decisions.

## Spec sync

The normative protocol pages will be generated from a pinned tag of
`agentregistrar/spec` by `scripts/sync-spec.mjs`, with `spec.lock.json` recording
the tag, commit and file hashes. The sync is not implemented yet; `pnpm
sync:spec` is a placeholder today.

## Deployment

The build is static and targets Cloudflare Workers static assets
(`wrangler.jsonc`). The Worker, the redirects, the headers and the
`docs.agentregistrar.dev` domain are not provisioned from this repository yet.

```bash
pnpm build
pnpm deploy     # wrangler deploy, after the Worker is provisioned
```

## License

Apache-2.0. See [LICENSE](./LICENSE).
