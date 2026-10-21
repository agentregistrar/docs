import { defineCollection } from "astro:content";
// `z` re-exported from `astro:content` is deprecated; import it from
// `astro/zod` (the pattern nimbus-docs' own schema helpers document).
import { z } from "astro/zod";
import { docsCollection, partialsCollection } from "@cloudflare/nimbus-docs/content";

export const collections = {
  docs: defineCollection(
    docsCollection({
      schemaFields: {
        /**
         * Provenance contract. The policy is in AGENT.md ("Provenance and
         * review"); the fields are validated here so a page cannot ship a
         * half-set review claim.
         *
         * - `audience` - who the page is written for. The default is `both`
         *   because this site is agent-readable by default; `human` is the
         *   deliberate flag for a page written first for people (the page
         *   actions row then marks the break with "for humans").
         * - `aiGenerated` - `true` while a page was drafted by an agent and no
         *   human has reviewed it. The page actions row shows
         *   "awaiting review" until a human clears the field. Never clear it
         *   in the same change that drafts the page.
         * - `verifiedAgainst` - the exact artifact a behavior page was checked
         *   against, e.g. "broker e7b53b4, 2026-10-21" or "Nimbus 0.18.1".
         * - `lastReviewed` - the date a human last reviewed the page against
         *   its source. Set it when the review happens; never backfill or
         *   guess a date.
         * - `source` - the canonical source of a generated page, e.g.
         *   "spec:v1.1.0#agent-identity-v1.md". Hand-edited pages have no
         *   `source`.
         * - `specTag` - the pinned spec tag a generated page came from.
         * - `generated` - true only on pages written by `pnpm sync:spec`.
         *   Never set it by hand.
         */
        audience: z.enum(["human", "agent", "both"]).default("both"),
        aiGenerated: z.boolean().optional(),
        verifiedAgainst: z.string().min(1).optional(),
        lastReviewed: z.coerce.date().optional(),
        source: z.string().min(1).optional(),
        specTag: z.string().min(1).optional(),
        generated: z.boolean().optional(),
      },
    }),
  ),
  partials: defineCollection(partialsCollection()),
};
