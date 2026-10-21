import { defineCollection } from "astro:content";
// `z` re-exported from `astro:content` is deprecated; import it from
// `astro/zod` (the pattern nimbus-docs' own schema helpers document).
import { z } from "astro/zod";
import { docsCollection, partialsCollection } from "@cloudflare/nimbus-docs/content";

export const collections = {
  docs: defineCollection(
    docsCollection({
      schemaFields: {
        // Project provenance fields from docs/12-docs-push/PLAN.md section 7.3.
        // Issue 05 turns these into a policy; they are optional here so pages
        // can land incrementally and the schema does not block that issue.
        audience: z.enum(["human", "agent", "both"]).optional(),
        verifiedAgainst: z.string().optional(),
        lastReviewed: z.coerce.date().optional(),
        aiGenerated: z.boolean().optional(),
        source: z.string().optional(),
      },
    }),
  ),
  partials: defineCollection(partialsCollection()),
};
