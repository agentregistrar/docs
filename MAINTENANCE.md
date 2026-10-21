# Maintaining the Agent Registrar docs

This is the runbook for keeping <https://docs.agentregistrar.dev> true after a
change. It covers spec releases, broker and portal changes, harness updates,
renames and redirects, freshness audits, incidents, rollback and theme changes.

Read [`CONTRIBUTING.md`](./CONTRIBUTING.md) for the page rules and the review
checklist, [`AGENT.md`](./AGENT.md) for the operating details and the audit
recipe, and [`THEME.md`](./THEME.md) for the visual system. This file does not
repeat them.

- **Site:** Cloudflare Worker `agentregistrar-docs`, static assets from
  `agentregistrar/docs` `main`. Workers Builds deploys on push; the manual
  fallback is `pnpm run deploy`.
- **Security contact:** `security@agentregistrar.dev`.
- **Operator runbooks:** the deployment, DNS and rollback detail lives in the
  operator's private deployment runbook (section 8, public surfaces). Do not
  copy private hostnames or account ids into a public page.

## 1. Before any maintenance change

1. Name the source you are changing against: a spec tag, a broker commit, a
   Nimbus release, or a dated live check.
2. Make the smallest change that removes the drift. Do not rewrite historical
   records or unrelated pages.
3. Run the checks in section 11 before you open the pull request.
4. Record the evidence in the pull request: the command, the result, the date
   and the version or commit. "Updated docs" is not evidence.

## 2. Runbook A - spec release sync

Use this for every `agentregistrar/spec` release. The normative pages are
generated and never hand-edited.

1. Read the new release notes and the diff against the previous tag. List the
   normative changes: fields, errors, claims, context, compatibility.
2. Update `tag` in `spec.lock.json`. Leave `commit`, `files` and `outputs` for
   the sync. For a docs-only refresh after the tag, pin the commit instead:
   `node scripts/sync-spec.mjs --write --commit <sha> --ref main --tag <tag>`.
3. Run `pnpm sync:spec`. Review the generated diff, including the changelog and
   the schema asset. Reject any transform outside frontmatter, link rewriting
   and the generated banner.
4. Update the hand-authored pages where fields, errors, claims or examples
   changed. Update current-version strings and cross-links.
5. Update `verifiedAgainst` and `lastReviewed` on the pages a human re-checked.
   Do not invent a date.
6. Update the spec repository "Read online" links if a rendered path changed.
7. Run the full gate set in section 11 and confirm the schema `$id`.
8. Open one pull request with the lock, the generated pages and the
   hand-authored changes. State the old and new tag and the normative diff.

A first dry run of a tag bump should be done on a scratch branch and never
merged until the commands and failure messages are confirmed.

## 3. Runbook B - MCP tool or portal behavior change

1. Identify the changed tool, flow or page in the code change.
2. Update the matching reference, quickstart or portal page in the same change
   set. Do not duplicate the tool schema; link the reference page.
3. Re-run the example against the live service and record the result.
4. Bump `verifiedAgainst` to the broker commit and date, and `lastReviewed` when
   a human has reviewed it.
5. Recapture any screenshot that no longer matches the UI.
6. Add a changelog note when the behavior a reader sees has changed.
7. If the change alters an error code, update the reference table and the
   error-recovery explanation together.

## 4. Runbook C - page rename, move or removal

Every rename ships a redirect. A previously public URL must never 404.

1. Move the file and add a permanent redirect in `astro.config.ts` (a versioned
   collection may use `previousSlug`). Point it only at a route in the same
   build.
2. Update internal links, the section landing page and any agent skill that
   names the old path. `nimbus/redirected-link` must stay at zero errors.
3. Build, then verify the old URL returns one permanent hop to the new one:
   `curl -sI http://127.0.0.1:8787/old-path/`.
4. Remove a page only when nothing public depends on it. If the spec or registry
   links it, update those links first.
5. Deprecate rather than delete when the content is still true: add a banner,
   point to the replacement, and keep the redirect until the next major review.
6. Record the old path, the new path and the redirect status in the pull
   request.

## 5. Runbook D - harness or client update

1. Re-check the client version, transport, configuration and auth flow.
2. Update the install page, its tier and its date. Record the evidence.
3. If a tier 1 flow breaks, demote it and state the regression. Never leave the
   old claim in place.
4. Update the support matrix and any page that cites the tier.
5. Re-verify the affected quickstart step and the OAuth troubleshooting page.

Tiers are defined in the plan and in `AGENT.md`: 1 is a recorded end-to-end
transcript, 2 is configuration verified, 3 is generic protocol instructions.
"Supported" without a tier and a date is a docs bug.

## 6. Runbook E - freshness audit

Run quarterly and before a launch or a large content change. Record the date and
the findings in the pull request or the audit record.

- `pnpm sync:spec:check` passes and the pin is the intended release.
- Every behavior page has a `verifiedAgainst` that matches the current broker,
  spec tag or Nimbus version.
- Every reviewed page has a `lastReviewed` inside the policy window. Pages that
  are still `aiGenerated: true` are listed, not silently cleared.
- Harness versions and tiers are current.
- Screenshots match the live UI.
- Internal links and redirects resolve; `pnpm check:links` and
  `nimbus-docs lint` report zero errors.
- The agent surface still serves: `/llms.txt`, `/llms-full.txt`,
  `/<slug>/index.md`, the discovery files, the skills index and `robots.txt`,
  with the expected content types.
- No unreviewed `aiGenerated: true` page sits on a primary path.
- The fixture and validator commands on provider pages still run.

## 7. Runbook F - security or incident update

This is a fast path. Do not wait for the quarterly audit.

1. Correct the affected page immediately. Add a `banner` when the information is
   incomplete or changing.
2. Do not publish exploit details, live credentials, JWTs or real user data.
3. Link the security contact (`security@agentregistrar.dev`) and record what
   changed and when.
4. Re-run the affected examples and the link checks.
5. If the incident invalidates a claim, remove the claim or state the new limit.
   Do not leave a stale reassurance.
6. Tell the operator before the page goes live when the incident is active.

## 8. Runbook G - rollback

- **Site deploy:** promote the previous Worker version in the Cloudflare
  dashboard, or redeploy the previous `dist/`. Workers Builds deploys `main`, so
  a bad merge is reverted on `main` first.
- **Content:** revert the pull request. Keep the redirects; removing a redirect
  turns an old URL into a 404.
- **Spec sync:** revert the lock and the generated pages together. Never leave a
  half-synced tree; `pnpm sync:spec:check` fails the build if the hashes drift.
- **Schema asset:** restore the previous `public/agent-identity/v1/agent-signup.schema.json`
  with its lock entry, so the served bytes and the hash agree.
- **DNS or custom domain:** do not change DNS from a content pull request. The
  operator runbook owns domain detach and reattach order.

## 9. Dry run the contribution workflow

Do this on a scratch branch before declaring a contribution guide change done.

1. Add a small real page from the template in `CONTRIBUTING.md`.
2. Set `aiGenerated: true` and confirm the "awaiting review" label in the page
   actions row.
3. Review it against the source, clear `aiGenerated`, set `lastReviewed`, and
   record the reviewer and date in the pull request.
4. Run the checks in section 11 and review the page against the checklist.
5. Rename the page, add `previousSlug` or a redirect, build, and `curl` the old
   URL to confirm one permanent hop.
6. Revert the rename, or keep it if it is real. Confirm no link is broken.
7. Keep the page only if it is useful. Otherwise remove it and record that the
   workflow was exercised. Record the result in the change record, not on a
   public page.

## 10. Runbook H - brand or theme change

1. Change the token or brand value in the canonical visual-identity source
   first, then apply it in `src/styles/globals.css` and the affected components.
   Do not add a docs-only color, font or component style.
2. Update `THEME.md` and the asset provenance, OG and favicon files.
3. Review side by side against <https://agentregistrar.dev> and record the
   evidence.
4. Run `pnpm check:theme`, the contrast and breakpoint checks, and the gates in
   section 11; update `lastReviewed`.
5. When the public site changes first, update the docs in the same window so the
   surfaces do not drift. Theme rules are owned by `THEME.md`; do not duplicate
   them in content pages.

## 11. Gate set

Run in this order before handing work back. Lint needs a prior build.

```bash
pnpm install --frozen-lockfile
pnpm sync:spec:check
pnpm build
pnpm check
pnpm lint
pnpm typecheck
pnpm check:theme
pnpm check:links
git diff --check
```

All must pass. Warnings are reviewed and explained in the pull request; they are
not ignored and not silenced by disabling a rule. There are no tests. Manual
verification plus this gate set is the contract.

Response headers and content types are verified with `wrangler dev`, not
`pnpm preview`; see `AGENT.md` section 12.

## 12. Release checklist

- [ ] The intended spec tag or commit is in `spec.lock.json`.
- [ ] `pnpm sync:spec:check` passes and the generated diff was reviewed.
- [ ] Hand-authored pages and cross-links match the new contract.
- [ ] The changelog and any current-version strings are current.
- [ ] The gate set in section 11 passes.
- [ ] Renames have redirects and the old URL returns one permanent hop.
- [ ] The pull request records the evidence, reviewer and date.
- [ ] The live site was checked after deploy: the changed page, its section
  `/llms.txt`, `/<slug>/index.md` and the schema path.
- [ ] Any deferred page or check has an owner and a reason.
