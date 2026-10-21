# Contributing to the Agent Registrar docs

This repository is the public documentation site for Agent Registrar and the
`agent-identity-v1` protocol, live at <https://docs.agentregistrar.dev>. It is
Apache-2.0. Anyone can open a pull request.

The site owns explanation, onboarding and lookup. It never owns the protocol
contract. Normative text lives in [`agentregistrar/spec`](https://github.com/agentregistrar/spec)
and is rendered here from a pinned release tag.

Read this file before you write. For the operating rules that apply to agent
editors, read [`AGENT.md`](./AGENT.md). For the visual system and component
recipes, read [`THEME.md`](./THEME.md); this file does not repeat those rules.
For releases, sync, redirects and incidents, read [`MAINTENANCE.md`](./MAINTENANCE.md).

## 1. Before you write

1. Find the canonical source for the claim you want to make:
   - Protocol fields and rules: [`agentregistrar/spec`](https://github.com/agentregistrar/spec)
     at the pinned tag.
   - Broker behavior, MCP tools and portal behavior: the deployed service and
     the shared tool schemas.
   - Provider examples: the fixtures and the reference implementation.
2. Decide whether the change is docs or a contract. A docs PR must not change
   the protocol, product behavior or legal text. If the contract is wrong, fix
   it in the owning repository and let the docs sync follow.
3. Choose the page type (section 3) and check that a similar page does not
   already exist. Link the canonical page instead of restating it.
4. Check the public contribution pages for the shortened workflow:
   <https://docs.agentregistrar.dev/contribute/docs/>.

## 2. Repository shape

```text
src/content/docs/<section>/<page>.mdx   the page tree; the path is the URL
src/components.ts                       components available in MDX without import
src/content.config.ts                   collection and provenance schema
astro.config.ts                         top-level sidebar order and redirects
spec.lock.json                          pinned spec tag/commit and hashes
scripts/sync-spec.mjs                   spec sync and offline drift check
scripts/check-links.mjs                 post-build internal link gate
scripts/check-theme.mjs                 Terminal theme QA gate
public/                                 served assets and response headers
skills/<name>/SKILL.md                  published Agent Skills
```

A folder is a sidebar group. Its `index.mdx` is the landing page and its
`sidebar.group.label` names the group. The tree is the information
architecture; there is no second navigation file.

## 3. Page templates

Use one of these shapes. Do not invent an eighth.

| Type | Required shape |
| :--- | :--- |
| Concept | What it is, why it matters, a mental model or diagram, non-goals, next links. |
| Quickstart | Outcome, prerequisites, numbered steps, verify, next step. |
| How-to | Goal, before you start, steps, verify, troubleshooting. |
| Tutorial | End-to-end narrative with expected output at each step. |
| Reference | Fields and tables, types, defaults, examples, related pages. |
| Troubleshooting | Symptom, cause, fix, prevention. |
| Changelog | Version, date, changes, compatibility. |

Every page ends with a "Verify" or "Next" section. A page that cannot be
verified against something is a concept page, not a how-to.

## 4. Frontmatter and provenance

Required on every page:

```yaml
---
title: Page title
description: One sentence used for metadata, search and the agent indexes.
---
```

Provenance fields, validated by `src/content.config.ts`:

| Field | Type | Meaning |
| :--- | :--- | :--- |
| `audience` | `human` \| `agent` \| `both` | Who the page is written for. Default `both`. |
| `aiGenerated` | boolean | `true` while an agent drafted the page and no human has reviewed it. The page actions row shows "awaiting review". |
| `verifiedAgainst` | string | Behavior pages only: the exact artifact checked, for example `broker e7b53b4, 2026-10-21` or `Nimbus 0.18.1`. |
| `lastReviewed` | date | The date a human last checked the page against its source. Never guess or backfill. |
| `source` | string | Generated pages only: the pinned source, for example `spec:v1.1.0#agent-identity-v1.md`. |

Rules:

- A page you draft starts with `aiGenerated: true`. Do not clear it in the same
  change; clearing it is the reviewer's action.
- Only a human reviewer clears `aiGenerated` and sets `lastReviewed`. The
  reviewer checks the page against its canonical source, runs the verification
  steps the page contains, and records the review in the pull request.
- `verifiedAgainst` is evidence, not a promise. If you cannot name the commit,
  release or version you checked, leave it unset and say what is unverified in
  the pull request.
- Frontmatter is the only provenance mechanism. Do not add a second one in
  comments or a JSON file.
- Generated protocol pages carry `source`, `specTag`, `generated: true` and a
  generated-content banner. Never edit them by hand and never set `generated` by
  hand.

## 5. Voice and claims

- Rendered text is ASCII: no smart quotes, em dashes, arrows, icons or emoji.
  Use `-`, `->`, `...`. The lint and theme gates flag offenders.
- Sentence case, short declarative sentences, no marketing and no exclamation
  marks. Second person for instructions, third person for behavior.
- Every behavior claim links to the specification, a deployed endpoint, a
  fixture, or a dated verification record. State known gaps where they matter.
- Do not overclaim. Do not describe an SDK, hosted API, SLA, uptime, customer
  count or compliance certification that does not exist.
- Do not paraphrase legal text. Link the Master Agreement and the terms pages.
- Visual rules, tokens and component choices are in [`THEME.md`](./THEME.md).
  Do not restate them in content pages.

## 6. Code samples

- Every sample is copy-paste runnable against the deployed demo, `localhost`, or
  a public URL, with the expected output shown. Say when output is illustrative.
- Pin a version where a dependency matters. Keep samples synthetic: no secrets,
  tokens, real credentials or private URLs.
- Code fences declare a language. Shell blocks contain the command only, with no
  `$ ` prompt, so the reader can copy them; comments start with `#`.
- Provider samples must pass the conformance validator before they are
  published.
- Do not imply an SDK or hosted API that does not exist.

## 7. Links and URLs

- Internal links are root-relative, absolute paths in the served shape, with a
  trailing slash: `/providers/quickstart/`, not `../quickstart`.
- Link the destination, not a redirect. `nimbus/redirected-link` is an error.
- External links use descriptive text, not a bare URL. A bare URL is a warning
  from `nimbus/bare-url`.
- Do not link a private path, an internal issue tracker, a staging host or a
  customer detail.
- Moving or renaming a page changes a public URL. Add a permanent redirect in
  `astro.config.ts` in the same change, and only to a route that exists in the
  same build. A versioned collection may use `previousSlug` instead. The
  redirect and deprecation policy is in [`MAINTENANCE.md`](./MAINTENANCE.md)
  runbook C.

## 8. Adding a page

1. Create `src/content/docs/<section>/<page>.mdx` (use `.md` only for generated
   normative text).
2. Add `title`, `description` and the provenance fields.
3. Set `sidebar.order` to sort it inside its group; use `sidebar.label` to
   shorten the rail title.
4. Link the page from its section landing page and from any related page that
   should lead there.
5. Build and confirm the URL is `/<section>/<page>/`. Check that the page
   appears in its section's `/llms.txt` and the sitemap.
6. Add a redirect only when the page replaces an existing URL. Record it in the
   pull request.

A dry run of this workflow is in [`MAINTENANCE.md`](./MAINTENANCE.md) section 9,
including the rename-and-redirect check.

## 9. Review checklist

A reviewer ticks every item. The author may pre-fill it, but a human clears the
review state.

- [ ] The claim matches the canonical source at the named tag, commit or date.
- [ ] `verifiedAgainst` names a real artifact; `lastReviewed` is set only after
   the review, and `aiGenerated` is cleared by the reviewer.
- [ ] The page uses one template shape and its required sections.
- [ ] Rendered text is ASCII, sentence case and free of hype, emoji and
   exclamation marks.
- [ ] Every behavior claim links to the spec, a deployed endpoint, a fixture or a
   dated verification record.
- [ ] Known gaps and non-goals are stated.
- [ ] Samples are runnable, pinned where needed, synthetic and show expected
   output. No secrets or private paths.
- [ ] Internal links resolve and point at the destination, not a redirect.
- [ ] `pnpm build`, `pnpm check`, `pnpm lint`, `pnpm typecheck`,
   `pnpm check:theme`, `pnpm check:links` and `git diff --check` pass.
   Warnings are explained, not ignored.
- [ ] A rename ships a redirect, and the old URL returns one permanent hop.
- [ ] The page appears in its section `/llms.txt` and `/<slug>/index.md` when it is meant to
   be discoverable.
- [ ] No private path, issue number, secret or personal data appears in the
   page, a skill or an example.
- [ ] Theme or component changes follow `THEME.md` and were reviewed against the
   public site.

There are no tests. This checklist plus the commands in section 10 is the
verification, and the pull request records both.

## 10. Local checks

Run in this order. Lint needs a prior build because the link rules read
`.nimbus/routes.json`.

```bash
pnpm install --frozen-lockfile   # cold checkout only
pnpm build                       # dist/, routes, postbuild link gate
pnpm check                       # nimbus-docs check: env, structure, authoring, types
pnpm lint                        # nimbus-docs lint: authoring rules
pnpm typecheck                   # astro check
pnpm check:theme                 # Terminal QA gate
pnpm check:links                 # internal links and anchors in dist/
pnpm sync:spec:check             # offline spec drift check
git diff --check                 # whitespace errors
```

Pass/fail rules and the full audit recipe are in [`AGENT.md`](./AGENT.md)
sections 10 and 13. Known warnings are in section 14; do not silence a finding
by disabling a rule.

To check response headers and content types, serve the build with
`pnpm exec wrangler dev --port 8787` rather than `pnpm preview`, then `curl`
the agent endpoints as shown in `AGENT.md` section 12.

## 11. Pull request rules

- Branch from `main` and use a short, descriptive name such as
  `docs/publish-discovery-fix`. Do not push directly to `main`.
- One issue or one logical page group per pull request. Keep unrelated cleanups
  out.
- Do not include product code, protocol edits, legal text, analytics, a test
  suite, a deploy workflow or a new dependency unless the change is impossible
  without it. Record why in the description.
- Do not include secrets, private paths, internal issue numbers, customer data or
  internal hostnames.
- The description states what changed, the evidence, the commands run with their
  results, the live or preview URL if useful, and any remaining warning. Paste
  the review checklist result rather than saying "done".
- A spec-sync pull request contains the lock, the generated pages, the
  hand-authored changes and the evidence together. Do not split a half-synced
  state across pull requests.
- A rename contains the page move, the redirect and the updated links in one
  pull request.
- A page stays `aiGenerated: true` until a human reviews it; the reviewer may be
  the operator or a named reviewer in the description.

## 12. License

Contributions are Apache-2.0, the license in [`LICENSE`](./LICENSE). Do not copy
third-party text or code without a compatible license and attribution. Do not
paste content from a private repository.
