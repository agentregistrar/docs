# Agent Registrar Docs

The public documentation site for Agent Registrar and `agent-identity-v1`. It is
built with [Cloudflare Nimbus](https://nimbus-docs.com) on Astro and deploys as
static output.

- Live site: <https://docs.agentregistrar.dev>
- Product site: <https://agentregistrar.dev>
- Specification repository: <https://github.com/agentregistrar/spec>

The site ships the functional shell, the home and section landing pages, and the
`agent-identity-v1` protocol section. The provider, agent, portal and reference
content is being added section by section.

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
pnpm check:links # postbuild gate: internal links and anchors in dist/
```

`pnpm build` also runs `postbuild`, so a dead internal link in a hand-authored
or generated page fails the build.

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
- `/agent-identity/v1/` - protocol landing, with hand-authored reference pages
  for discovery fields, assertion claims, receipt and context, security,
  conformance and versioning
- `/agent-identity/v1/specification/`, `/scope-boundaries/`,
  `/implementation-guide/`, `/validator/`, `/changelog/` - generated from the
  pinned spec revision; never edit these by hand
- `/agent-identity/v1/agent-signup.schema.json` - the JSON Schema served at its
  canonical `$id`
- `/404.html` - not-found page

Redirects are declared in `astro.config.ts` and emitted to `dist/_redirects` at
build time. Only redirects whose destination page exists are active. `/spec`,
`/specification` and `/agent-identity/v1/agent-signup` are active with the
protocol pages.

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
  and has no theme toggle. Generated protocol pages are the documented exception:
  they preserve canonical spec punctuation (see `AGENT.md` section 12).
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

The normative protocol pages are generated from a pinned revision of
`agentregistrar/spec`. The normal pin is a release tag; a docs-only refresh that
landed after the tag can be pinned by commit instead, so the rendered pages and
the source bytes agree. `spec.lock.json` records the protocol `tag`, the `ref`
and `commit` of a commit pin, an optional `note`, the source file hashes, the
generated output hashes and `generated_at`.

```bash
pnpm sync:spec          # fetch the lock's pin, verify it, write pages and lock
pnpm sync:spec:check    # offline drift check; runs before pnpm build
node scripts/sync-spec.mjs --tag v1.2.0          # preview a tag, writes nothing
node scripts/sync-spec.mjs --commit <sha> --ref main  # preview a commit pin
```

`pnpm build` runs `prebuild`, which runs the offline check, and `postbuild`,
which checks every internal link and anchor in `dist/`. A hand edit to a
generated page fails the build. The explicit sync is the only step that uses the
network; it verifies the pinned commit and every source hash before writing.

Generated files:

- `src/content/docs/agent-identity/v1/specification.md`
- `src/content/docs/agent-identity/v1/scope-boundaries.md`
- `src/content/docs/agent-identity/v1/implementation-guide.md`
- `src/content/docs/agent-identity/v1/validator.md`
- `src/content/docs/agent-identity/v1/changelog.md`
- `public/agent-identity/v1/agent-signup.schema.json`

Allowed transforms are frontmatter, relative-to-absolute link rewriting, and the
generated banner. Nothing else. To bump the spec version, edit `tag` in
`spec.lock.json`, run `pnpm sync:spec`, review the normative diff, update the
hand-authored pages and cross-links, and commit the lock with the generated
pages. For a commit pin, run
`node scripts/sync-spec.mjs --write --commit <sha> --ref main --tag <tag>`.
The full runbook is in [`AGENT.md`](./AGENT.md) section 11.

## Deployment

The site is live at `https://docs.agentregistrar.dev`, served by the Cloudflare
Worker `agentregistrar-docs` as static assets (no Worker script). The build is
static and `wrangler.jsonc` points `assets.directory` at `dist`, serves the
Nimbus 404 page for unknown paths, keeps trailing slashes canonical and attaches
the custom domain `docs.agentregistrar.dev`.

Workers Builds is the deploy path: it is connected to this repository
(production branch `main`) and runs `pnpm build` then `pnpm exec wrangler deploy`
on push to `main`; non-main branches build Previews with
`pnpm exec wrangler versions upload`. The connection was created after the Issue
04 cutover and immediately produced a first production build from `main`
(`d519e753-1033-4bc2-8006-fedacfa4af2e`, commit `57974ba`, outcome `success`),
which deployed the pre-cutover `main` config. The cutover itself was deployed
manually from the Issue 04 branch (version `9656afd3-b5f6-4c14-8876-8fd1513c661d`),
and the first push to `main` after the merge rebuilds and deploys the merged
config. There is no GitHub Actions deploy workflow by design.

Manual deploy (the fallback, and what the cutover used):

```bash
pnpm install --frozen-lockfile
pnpm build
pnpm deploy     # wrangler deploy; needs CLOUDFLARE_API_TOKEN or cf OAuth
```

The Worker hostname `https://agentregistrar-docs.sdairs.workers.dev` is enabled
for verification. `_headers` in `public/` is copied to `dist/_headers` and
applied by Workers static assets: it sets the Markdown/llms/discovery content
types, cache policy, CORS for agent artifacts and baseline security headers. The
published JSON Schema is served at
`/agent-identity/v1/agent-signup.schema.json` as
`application/schema+json; charset=utf-8` with `Access-Control-Allow-Origin: *`
and a one-hour cache. The rule names the exact path, not `/*.schema.json`, so an
unknown schema path still returns the normal HTML 404.

The former Cloudflare Pages project `agentregistrar-docs` is a frozen rollback
snapshot: no custom domain and, since 2026-10-21, no Git source, so pushes no
longer rebuild it. Its last build (deployment `0fdbc143`, commit `57974ba`)
still serves at `https://agentregistrar-docs.pages.dev`; it is deleted only
after the release verification and operator approval. Rollback order (detach the
Worker domain before reattaching Pages) and the recorded domain/DNS IDs are in
the monorepo's `docs/deployment.md` §8.

## License

Apache-2.0. See [LICENSE](./LICENSE).
