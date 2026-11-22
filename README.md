# Agent Registrar Docs

The public documentation site for Agent Registrar and the Agent Identity
Protocol (`agent-identity-protocol`). It is built with
[Cloudflare Nimbus](https://nimbus-docs.com) on Astro and deploys as static
output.

- Live site: <https://docs.agentregistrar.dev>
- Product site: <https://agentregistrar.dev>
- Specification repository: <https://github.com/agentregistrar/spec>

The site ships the Start Here overview, the live Demo walkthrough, the Agents
and Providers guides, the Protocol specification and lookup pages, the Reference
catalog (4 MCP tools, HTTP/OAuth, error codes, glossary), and the Contribute
guide. The content source is `src/content/docs/`; the five normative protocol
pages are generated from a pinned spec release.

## Contributing

Read [`CONTRIBUTING.md`](./CONTRIBUTING.md) for page templates, provenance,
the review checklist, and pull request rules. Read
[`MAINTENANCE.md`](./MAINTENANCE.md) for the spec-sync, redirect, release,
freshness, and incident runbooks. There are no tests; the build and the
authoring gates below are the verification.

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
pnpm sync:spec:check  # offline spec drift check
pnpm check:seo        # title, description and heading metadata gate
pnpm build            # must run before lint: link rules read .nimbus/routes.json
pnpm check            # nimbus-docs check: environment, structure, authoring, types
pnpm lint             # nimbus-docs lint: content rules
pnpm typecheck        # astro check (TypeScript and .astro files)
pnpm check:theme      # Terminal theme QA gate (radius/shadow/gradient/icons/non-ASCII)
pnpm check:links      # postbuild gate: internal links and anchors in dist/
pnpm check:sitemap    # postbuild gate: sitemap index, URLs and lastmod
```

`pnpm build` also runs `postbuild`, so a dead internal link in a hand-authored
or generated page fails the build.

The site rules for coding agents - personas, voice tiers, provenance, lint,
spec sync, verification, and what not to change - are in [`AGENT.md`](./AGENT.md).
Read it before editing a page. There are no tests; the gates above are the
verification.

The visual system, token map, component recipes, deviations, and the review
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

Current sections:

- `/` - docs home
- `/start/` - overview, how it works, trust and limits
- `/demo/` - interactive VaporCloud demo walkthrough
- `/agents/` - agent quickstart, harness install, Developer Portal, inbox and
  verification, credentials and recovery, troubleshooting
- `/providers/` - provider quickstart, Provider Portal, hosting recipes,
  implementation guides, troubleshooting
- `/protocol/` - protocol landing, hand-authored lookup pages (`discovery-fields`,
  `assertion-claims`, `receipt-and-context`, `security`), and five generated
  normative pages (`specification`, `scope-boundaries`, `implementation-guide`,
  `validator`, `changelog`)
- `/protocol/agent-signup.schema.json` - the JSON Schema served at its
  canonical `$id`
- `/reference/` - four MCP tools, broker HTTP and OAuth, canonical error codes,
  and glossary
- `/contribute/` - contributor guide for docs, spec, registry, and local gates
- `/404.html` - not-found page

Redirects are declared in `astro.config.ts` and emitted to `dist/_redirects` at
build time, registering both slashless and trailing-slash keys for shortcuts
and retired paths.

## Authoring

- A page is a `.md` or `.mdx` file under `src/content/docs/`. Frontmatter
  requires `title` and `description`. The provenance fields follow the policy in
  [`AGENT.md`](./AGENT.md) section 5: `audience` defaults to `both`;
  `verifiedAgainst`, `lastReviewed`, and `source` are set only when that
  evidence exists for the page.
- Use the Nimbus components registered in `src/components.ts` (`Aside`, `Card`,
  `CardGrid`, `Steps`, `Tabs`, and the rest) rather than new one-off widgets.
- Rendered text is ASCII, sentence case, and free of icons. The site is
  dark-only and has no theme toggle. Generated protocol pages are the
  documented exception: they preserve canonical spec punctuation (see
  `AGENT.md` section 14).
- The contribution rules are in [`CONTRIBUTING.md`](./CONTRIBUTING.md)
  (templates, provenance, and the review checklist) and the maintainer runbooks
  are in [`MAINTENANCE.md`](./MAINTENANCE.md). The agent-specific detail remains
  in [`AGENT.md`](./AGENT.md) sections 5 to 13.

## Docs for agents

Every discoverable page is emitted twice at build time: HTML for readers and
Markdown for agents. The surface is:

- `/llms.txt` and `/llms-full.txt` - the index and the whole site in one
  document.
- `/<section>/llms.txt` - per-section index; each multi-page section
  (`/agents/`, `/protocol/`, `/providers/`, `/reference/`, `/start/`) emits one
  alongside the root `/llms.txt`. Single-page sections (`/demo/`,
  `/contribute/`) do not emit a per-section index.
- `/<slug>/index.md` - the page as clean Markdown; `/<slug>/index.mdx` - the
  authored source.
- `/.well-known/ard.json` and `/.well-known/ai-catalog.json` - discovery
  manifests.
- `/.well-known/agent-skills/index.json` plus one artifact per skill under
  `skills/<name>/SKILL.md`.
- JSON-LD in each page head, `sitemap.xml`, and `robots.txt` with
  `Content-Signal: ai-train=yes, search=yes, ai-input=yes`.

Published skills:

- `install-agent-identity` - connect a harness via OAuth 2.1, bind an agent
  sub-identity during consent, complete a brokered signup, and read the inbox.
- `implement-agent-identity` - publish identity-only discovery with optional
  attestation, verify assertions, return stable errors, and issue a Contract E
  receipt.
- `verify-agent-signup` - audit a discovery document and optional attestation
  source and report pass or fail with evidence.

Content types and cache policy for these paths are in `public/_headers`.

## Spec sync

The normative protocol pages are generated from a pinned revision of
`agentregistrar/spec`. The normal pin is a release tag; a docs-only refresh that
landed after the tag can be pinned by commit instead, so the rendered pages and
the source bytes agree. `spec.lock.json` records the protocol `tag`, the `ref`
and `commit` of a commit pin, an optional `note`, the source file hashes, the
generated output hashes, and `generated_at`.

```bash
pnpm sync:spec          # fetch the lock's pin, verify it, write pages and lock
pnpm sync:spec:check    # offline drift check; runs before pnpm build
node scripts/sync-spec.mjs --tag <tag>           # preview a tag, writes nothing
node scripts/sync-spec.mjs --commit <sha> --ref main  # preview a commit pin
```

`pnpm build` runs `prebuild`, which runs the offline check, and `postbuild`,
which checks every internal link and anchor in `dist/`. A hand edit to a
generated page fails the build. The explicit sync is the only step that uses the
network; it verifies the pinned commit and every source hash before writing.

Generated files:

- `src/content/docs/protocol/specification.md`
- `src/content/docs/protocol/scope-boundaries.md`
- `src/content/docs/protocol/implementation-guide.md`
- `src/content/docs/protocol/validator.md`
- `src/content/docs/protocol/changelog.md`
- `public/protocol/agent-signup.schema.json`

Allowed transforms are frontmatter, relative-to-absolute link rewriting, and the
generated banner. Nothing else. To bump the spec version, run
`node scripts/sync-spec.mjs --write --tag <tag>`; never edit `tag` in
`spec.lock.json` and run `pnpm sync:spec`, because the lock still carries the old
`ref`/`commit` and the sync would only relabel it. Review the normative diff,
update the hand-authored pages and cross-links, and commit the lock with the
generated pages. For a docs-only refresh after the tag (a branch that is not
itself tagged), pin the commit with
`node scripts/sync-spec.mjs --write --commit <sha> --ref main --tag <tag>`.
The full runbook is in [`MAINTENANCE.md`](./MAINTENANCE.md) section 2 and
[`AGENT.md`](./AGENT.md) section 11.

## Deployment

The site is live at `https://docs.agentregistrar.dev`, served by the Cloudflare
Worker `agentregistrar-docs` as static assets (no Worker script). The build is
static and `wrangler.jsonc` points `assets.directory` at `dist`, serves the
Nimbus 404 page for unknown paths, keeps trailing slashes canonical, and
attaches the custom domain `docs.agentregistrar.dev`.

Workers Builds is the deploy path: it is connected to this repository
(production branch `main`) and runs `pnpm build` then `pnpm exec wrangler deploy`
on push to `main`; non-main branches build Previews with
`pnpm exec wrangler versions upload`. There is no GitHub Actions deploy
workflow by design.

Manual deploy (fallback):

```bash
pnpm install --frozen-lockfile
pnpm build
pnpm run deploy  # wrangler deploy; needs CLOUDFLARE_API_TOKEN or cf OAuth
```

`_headers` in `public/` is copied to `dist/_headers` and applied by Workers
static assets: it sets the Markdown/llms/discovery content types, cache policy,
CORS for agent artifacts, and baseline security headers. The published JSON
Schema is served at `/protocol/agent-signup.schema.json` as
`application/schema+json; charset=utf-8` with `Access-Control-Allow-Origin: *`
and a one-hour cache.

## License

Apache-2.0. See [LICENSE](./LICENSE).
