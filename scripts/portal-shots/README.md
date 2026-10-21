# Portal screenshot tooling

Reproducible drivers for the synthetic screenshots under
`public/screenshots/portal/`, used by the `/portal/**` guides. All values are
synthetic; no real account, token, hash or provider credential is involved.

The scripts live here so a maintainer can recapture the set from the repository
alone. They are not part of the docs build and are not run in CI.

## What the set contains

| File | Page state |
| :--- | :--- |
| `portal-sign-in.png` | Public login page, demo entry hidden |
| `portal-verify-email.png` | Six-digit code screen for an unverified profile |
| `portal-master-agreement.png` | Signing page with the agreement text and digest replaced by placeholders |
| `portal-oauth-consent.png` | Harness consent screen for the three delegation scopes |
| `portal-dashboard.png` | Account panel plus two agents and one recorded signup |
| `portal-agent-detail.png` | Active agent identity panel and tabs |
| `portal-inbox.png` | Inbox with one synthetic message open |
| `portal-ledger.png` | ToS liability ledger tab |
| `portal-signups.png` | Service signups and proof tab |
| `portal-revoked-agent.png` | Revoked agent header and empty tab states |
| `portal-abuse-reports.png` | Abuse reports tab with one synthetic report |

`portal-dashboard-mobile.png` is captured for review only and is not shipped:
the ledger table clips at 390 px.

## Prerequisites

- The monorepo checkout with `.env` (Supabase URL and service-role key) and
  `apps/broker-portal`.
- Node 22 and pnpm.
- A headless Chromium reachable on CDP port 9333

```sh
chromium --headless=new --remote-debugging-port=9333 \
  --user-data-dir=/tmp/portal-cdp about:blank
```

Set `PORTAL_MONOREPO_ROOT` if the monorepo is not at `~/agent-identity`.

## Procedure

Run from this docs repository.

1. Seed the synthetic account and rows. This mutates the database behind
   `NEXT_PUBLIC_SUPABASE_URL`; it refuses to run without an explicit opt-in:

   ```sh
   PORTAL_SHOTS_ALLOW_SEED=yes node scripts/portal-shots/seed.mjs
   ```

   It prints the human id and writes `humanId`, `email`, `activeAgentId` and
   `revokedAgentId` to `/tmp/portal-seed.json` (override with
   `PORTAL_SHOTS_SEED`).

2. Build and start the portal with the demo identity:

   ```sh
   node scripts/portal-shots/run-portal.mjs build
   node scripts/portal-shots/run-portal.mjs
   ```

   `BROKER_DEMO_LOGIN_KEY` is read from the environment (or `sb_demo_key` in
   `.env`). No credential is stored in this repository.

3. Capture:

   ```sh
   BROKER_DEMO_LOGIN_KEY=<demo key> node scripts/portal-shots/capture.mjs
   ```

   The driver sets a 1280 px viewport, grows it to the document height, and
   writes PNGs to `public/screenshots/portal/`. Override the output directory
   with `PORTAL_SHOTS_OUT`.

4. Exercise the kill switch on the synthetic active agent and compare the
   printed before/after state with the kill-switch page wording:

   ```sh
   BROKER_DEMO_LOGIN_KEY=<demo key> node scripts/portal-shots/revoke-check.mjs
   ```

5. Delete the synthetic account. Deleting the auth user cascades the profile,
   agents, inbox messages, acceptances, signups and abuse reports:

   ```sh
   curl -sS -X DELETE \
     "$NEXT_PUBLIC_SUPABASE_URL/auth/v1/admin/users/$HUMAN_ID" \
     -H "apikey: $SB_ADMIN" -H "Authorization: Bearer $SB_ADMIN"
   ```

   Confirm with a read-only query that `human_profiles` has no row for
   `portal-demo@example.com` and `agents` has no row for `research-scout` or
   `release-notes-bot`.

## Capture invariants

- **Master Agreement:** step 11 replaces the `<pre>` text with
  `[agreement text removed in this screenshot - read the current text in the portal]`
  and every `sha256:` value with
  `sha256:demo-digest-removed-in-this-screenshot` before the screenshot. The
  agreement text must never be reproduced in an image.
- **Revoked agent:** the seeded revoked agent has no history rows, so its tabs
  show empty states. Do not describe the image as showing retained history; the
  retention claim belongs in the page text, not the alt text.
- **No real data:** the demo address is `portal-demo@example.com`, the senders
  are `vaporcloud.dev` demo addresses, and the ids, JTIs and hashes are
  synthetic. Do not capture a real human's dashboard or inbox.
- **Metadata:** capture PNGs carry only `IHDR`/`IDAT`/`IEND`; verify with
  `pngcheck -v` or a chunk scan before committing.
- **Staleness:** if the portal UI changes, recapture the affected images and
  update `lastReviewed` and `verifiedAgainst` in the same change.

## Validation

```sh
file public/screenshots/portal/*.png            # 1280 px wide, 8-bit RGB
rg -o '!\[[^]]*\]\(/screenshots/portal/[^)]+\)' src/content/docs/portal
```

Every image reference must resolve to a file and every image must have task and
state alt text.
