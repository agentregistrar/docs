/**
 * Shared visual config for build-time OG cards.
 *
 * Terminal only: solid #0a0a0a, 1px #242424 inline-start rule, IBM Plex Mono,
 * no gradient, no shadow, no illustration. Both the per-page endpoint
 * (`og/[...slug].ts`) and the homepage fallback (`og.png.ts`) use this.
 *
 * Leading underscore tells Astro to skip routing for this file.
 */

import type { OGImageOptions } from "astro-og-canvas";

export const ogCardConfig = {
  bgGradient: [[10, 10, 10]],
  border: { color: [36, 36, 36], width: 1, side: "inline-start" },
  padding: 72,
  fonts: [
    "./public/fonts/IBMPlexMono-Regular.ttf",
    "./public/fonts/IBMPlexMono-SemiBold.ttf",
  ],
  font: {
    title: {
      color: [232, 232, 232],
      size: 52,
      weight: "SemiBold",
      families: ["IBM Plex Mono"],
      lineHeight: 1.2,
    },
    description: {
      color: [154, 154, 154],
      size: 24,
      weight: "Normal",
      families: ["IBM Plex Mono"],
      lineHeight: 1.4,
    },
  },
  format: "PNG",
} satisfies Partial<OGImageOptions>;
