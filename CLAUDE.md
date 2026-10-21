# CLAUDE.md

Read and follow [AGENT.md](./AGENT.md). It is the canonical guide for this
repository: the provenance fields, lint gates, spec sync, agent surface,
verification commands, and the rules for what not to change.

The human contribution contract is [CONTRIBUTING.md](./CONTRIBUTING.md) and the
release and incident runbooks are [MAINTENANCE.md](./MAINTENANCE.md). Use the
audit recipe in `AGENT.md` section 13 for any sweep; the recurring freshness
audit is `MAINTENANCE.md` section 6.

Claude-specific notes:

- Do not create tests. Verification is `pnpm build`, `pnpm check`, `pnpm lint`,
  `pnpm typecheck`, `pnpm check:theme`, and the curl checks in `AGENT.md`
  section 12.
- Do not clear `aiGenerated` or add `lastReviewed` on your own; a human
  reviewer does that.
- Keep rendered text ASCII and the Terminal voice described in `AGENT.md`
  section 7.
