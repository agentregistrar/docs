# Docs Theme - Terminal

- **Status:** applied (2026-10-21). Issue 03 of `12-docs-push`.
- **Identity:** Deliverable 8 (Wave 5), codename Terminal. Canonical values live in
  `docs/08-visual-identity/design-tokens.md`; this document maps them to the docs
  site and records docs-specific extensions.
- **Public reference:** Deliverable 11 (`agentregistrar.dev`) - the closest
  visual match for docs chrome.
- **Scope:** visual and brand application only. Information architecture,
  routes, page copy, deployment, provenance and search behavior are owned by
  other issues.

Do not add a token, font, color, icon or radius here without changing
Deliverable 8 first. The docs site consumes the brand; it does not fork it.

---

## 1. Token map

The values are copied verbatim from `docs/08-visual-identity/design-tokens.md`
section 1. They are declared once, in `src/styles/globals.css`.

| Token | Value | Docs usage |
| :--- | :--- | :--- |
| `background` | `#0a0a0a` | page, sticky header, mobile drawer, footer |
| `surface` | `#111111` | cards, callouts, banners, code header, table container, search panel |
| `well` | `#050505` | code body, inline code, inputs, file tree, dialog backdrop |
| `hover` | `#161616` | sidebar/row/search hover |
| `line` | `#242424` | structural borders, table rules, 1px grid |
| `line-strong` | `#616161` | interactive boundaries, input borders, copy button |
| `foreground` | `#e8e8e8` | prose, headings, active nav |
| `foreground-strong` | `#ffffff` | inverse primary button hover only |
| `muted` | `#9a9a9a` | secondary prose, nav, descriptions, links at rest |
| `faint` | `#7c7c7c` | breadcrumbs, meta, TOC labels, table headers |
| `ghost` | `#555555` | placeholder/disabled only; never prose |
| `accent` | `#3fb950` | links, focus, active rails, verified/success |
| `warn` | `#d29922` | caution |
| `danger` | `#f85149` | errors/destructive |

Layout aliases (not brand values):

| Alias | Value | Use |
| :--- | :--- | :--- |
| `--width-docs` | `80rem` | outer shell |
| `--width-docs-article` | `44rem` | prose column (includes gutters) |
| `--width-docs-sidebar` | `15rem` | sidebar |
| `--width-docs-toc` | `12rem` | on-this-page rail |

Nimbus reads a `--nb-*` layer. It is mapped to the same values in
`globals.css`: `--nb-background`, `--nb-foreground`, `--nb-card` (surface),
`--nb-muted-foreground` (muted), `--nb-border` (line), `--nb-primary` (accent),
`--nb-ring` (accent), and the status aliases
(`--nb-info` = muted, `--nb-success` = accent, `--nb-warning` = warn,
`--nb-danger` = danger). There is no independent Nimbus palette.

Enforcement, verbatim from D8:

```css
@theme {
  --radius-*: initial;
  --shadow-*: initial;
}
:root { color-scheme: dark; }
:focus-visible { outline: 1px solid var(--color-accent); outline-offset: 2px; }
```

`border-radius: 0` is set on form controls; no other radius exists. There is no
`dark:` variant and no `prefers-color-scheme` branch.

---

## 2. Typography

- **Family:** IBM Plex Mono only, weights 400/500/600/700, self-hosted through
  `@fontsource/ibm-plex-mono` (woff2, no CDN, no runtime font script). The same
  family and weights are used by the public site (`next/font/google`). No
  italics. `font-sans` is an alias to the mono stack, as a safety net only.
- **Scale:** D8 sizes exactly - `text-xs` 11/16, `text-sm` 12/18,
  `text-base` 13/20, `text-md` 14/22, `text-lg` 16/24, `text-xl` 20/28,
  `text-2xl` 26/32, `text-3xl` 34/40. `text-base` is 13px by design.
- **Docs headings:** `h1` 26/32 weight 600, `h2` 20/28 600, `h3` 16/24 600,
  `h4` 14/22 600; sentence case, no letter-spacing. `text-3xl` remains reserved
  for the public landing hero.
- **Prose measure:** `.docs-content` is 14/22 inside the 44rem column with
  `px-6` at `md+`, so at >=1280px the rendered line box is 656px. IBM Plex
  Mono advance is 0.6em (8.4px at 14px): **78 characters per full line**,
  inside the 70-82 target. Between 1024 and 1279 the TOC rail shares the
  width and the line box narrows to as little as 529px (63 characters); the
  article column is the container, and prose never runs full width.
- **UI text:** sidebar 13/20, TOC 12/18, breadcrumbs 11/16, table headers
  11/16 uppercase with 0.08em tracking, table cells 13/20, code 12/18.
- **Eyebrows/table headers:** uppercase, `text-xs`, `tracking-wider`, `text-faint`.
- **Links:** accent, no underline at rest, underline on hover/focus; never
  color-only (hover and focus add the shape cue).
- **Inline code:** `bg-well`, 1px `line`, 12px, no radius.
- **Code blocks:** `bg-well`, 1px `line`, a header row with an uppercase language
  label and a text `Copy` button, body 12/18 with `overflow-x: auto`. No line
  numbers. Shiki uses one neutral theme (`src/styles/shiki-terminal.ts`):
  foreground text, faint comments, muted strings, danger errors; no rainbow
  palette. Green is not used for syntax.
- **ASCII only:** `->`, `<-`, `...`, `|`, `+`/`-`, `#`, `x`. No emoji, icon
  fonts or decorative Unicode.

---

## 3. Layout

### Desktop (>= 1024px)

```text
+------------------------------------------------------------------------------+
| agentregistrar_ / docs      start providers agents protocol reference  search | 48px + 1px border-b
+------------------------------------------------------------------------------+
| docs / section / page                                                        |
| +----------------+-----------------------------------+---------------------+ |
| | filter...      | article                           | on this page        | |
| | 15rem          | 44rem max, 78-char measure        | 12rem               | |
| | border-r line  | h1 / description / actions        | border-l line       | |
| |                | prose / code / tables / callouts   |                     | |
| +----------------+-----------------------------------+---------------------+ |
| footer                                                                       |
+------------------------------------------------------------------------------+
```

- Outer shell `mx-auto w-full max-w-(--width-docs) px-4 lg:px-6`.
- Header 48px content height, sticky, opaque `bg-background`, 1px
  `border-b border-line`.
- Sidebar 15rem, `border-r border-line`, 13px. Current page:
  `text-foreground`, weight 500, 2px `border-left` accent. Group rows are native
  `details/summary` with ASCII `+`/`-` markers. Hover is `bg-hover`; no icons.
- Article column 44rem, centered in the remaining track; breadcrumbs sit above
  the grid, `docs / section / page` in 11px `text-faint`.
- TOC 12rem, `border-l border-line`, 12px, `on this page`. The active heading
  gets a 2px accent left rail and foreground text. Hidden when empty. The rail
  is visible from 1024px; between 1024 and 1279 it shares the width with the
  article (the line box narrows to 529px / 63 characters at the 1024 floor)
  instead of dropping the on-page map.
- Footer: 1px top border, one wrapping link row (`spec`, `registry`, `validator`,
  `security`, `license`, `agentregistrar.dev`), copyright
  `(c) 2026 Agent Registrar`.
- Every container is a 1px rectangle. No cards float on shadows.

### Tablet (768-1023px)

Sidebar collapses; the header exposes a text `sections` disclosure. Below
1024px the TOC column is hidden and replaced by the `on this page` select under
the page title; from 1024px the rail returns beside the article. Header stays
48px. No horizontal page scroll.

### Mobile (<= 767px)

- Header: wordmark + muted `/ docs`, `search`, `sections`. No hamburger icon.
- `sections` opens a native `<dialog>` drawer with the full tree, a `filter...`
  input, a `close` label, Escape support, a focus trap and focus return to the
  trigger. The backdrop is opaque `background` (no translucency).
- Article full width with `px-4`; prose 14/22. Code and tables scroll inside
  their own containers only.
- Tap targets: 44px minimum for every interactive control at 375px - measured
  sidebar rows 44px, filter input 44px, `on this page` select 44px,
  page-action buttons 44px, edit/report links 44px, pagination 44px, header
  wordmark/nav/actions 44px, footer links 44px, search input/results/`esc`
  44px. Pointer-only desktop chrome stays compact at the WCAG 2.5.8 floor
  (page actions and footer links 24px, breadcrumbs 24px, TOC rows 30px).
- No horizontal page scroll at 375px (verified: `body.scrollWidth === 375`).

---

## 4. Components

Recipes are implemented in `src/components/**`; Nimbus behavior is kept.

| Component | Implementation |
| :--- | :--- |
| Header | `Header.astro`: 48px, wordmark + `/ docs`, lowercase section nav, search, `github`, `agentregistrar.dev`, mobile `sections` |
| Footer | `Footer.astro`: 1px top rule, lowercase resource links, `(c) 2026 Agent Registrar \| documentation is Apache-2.0` |
| Wordmark | `Wordmark.astro`: `agentregistrar` 600 + accent `_`, static (no blink) |
| Sidebar | `ui/sidebar/**`: 13px rows, accent current rail, ASCII +/- group markers, `bg-hover` hover, Nimbus session state intact |
| TOC | `ui/toc/**`: 12px, `on this page`, accent active rail, scroll-spy and `aria-current` intact; Nimbus's animated SVG rail is in the DOM but not painted |
| Search | `ui/search/**`: Pagefind modal, square input on `bg-well`, results grouped by top-level section (lowercase text, uppercase eyebrow), `esc`, `up/down navigate`, `no results.`, keyboard behavior unchanged. Pagefind `<mark>` highlights use `bg-well` + `text-foreground` + a 1px accent underline inside and outside `.docs-content`; no browser-default yellow. |
| Breadcrumbs | `ui/breadcrumbs/**`: 11px faint, `/` separators, ASCII `...` collapse |
| Pagination | `ui/pagination/**`: `<- previous` / `next ->`, 1px top rule |
| Prose | `src/styles/prose.css`: 14/22, 78-char measure at >=1280 (63-72 chars in the 1024-1279 TOC band), ASCII list dashes, accent links, 1px tables, square figures |
| Code | Shiki + `.nb-code-figure`: well, 1px line, header row with language and text `Copy`; `Copy` -> `Copied` for 1500ms; clipboard failure leaves `Copy` |
| Callouts | `ui/aside/Aside.astro`: 1px line + 2px signal left bar, `[NOTE]` muted, `[OK]` accent, `[CAUTION]` warn, `[ERROR]` danger; no tint |
| Banner | `ui/banner/Banner.astro`: same signal bar, text `x` dismiss, persistence unchanged |
| Steps | `ui/steps/Steps.astro`: `1.`/`2.` in accent, no circles or connectors |
| Tabs | `ui/tabs/**`: text triggers, 2px accent underline, horizontal scroll, roving focus |
| Cards | `ui/card`, `ui/card-grid`, `ui/link-card`: 1px line, `bg-surface`, hover `line-strong`, title 14/500, description 13/muted, ASCII `->` |
| File tree | `ui/file-tree/**`: `bg-well`, 1px line, ASCII `+`/`-`, no icons; Nimbus disclosure behavior intact |
| Code groups | `ui/code-group/**`: text tabs + accent underline, per-panel text `copy`; copy behavior preserved |
| Tables | `prose.css`: 1px container, uppercase 11px faint headers, 13px cells, row `border-b line`, `bg-hover` hover, `.nb-table-scroll` horizontal scroll, no zebra |
| Badges | `ui/badge/Badge.astro`: outline only, uppercase 11px, signal border/text |
| Page actions | `ui/page-actions/PageActions.astro`: `updated`, `copy markdown`, `view markdown ->` at 12px muted; the `awaiting review` label renders in the same row (`data-nb-review-status`) while `aiGenerated: true` |
| Edit/report | `DocsLayout`: `edit page -> github`, `report issue` |
| 404 | `src/pages/404.astro`: shell, `not found.`, one line, home/quickstarts/reference links |
| Diagram frame | `prose.css` figure: 1px line, `bg-surface`, faint caption; SVGs are hand-authored, no shadows/gradients |
| Dialog | `ui/dialog/**`: 1px line, `bg-surface`, opaque backdrop, square |
| Image zoom | `ui/image-zoom/**`: square, opaque backdrop, no blur or scale animation |

The MDX registry (`src/components.ts`) exposes `Aside`, `Badge`, `Banner`,
`Card`, `CardGrid`, `Code`, `CodeGroup`, `FileTree`, `LinkCard`,
`PackageManagers`, `Render`, `Step`, `Steps`, `TabItem` and `Tabs`. Content
issues must use these names and tokens.

---

## 5. Docs-specific deviations

Each is intentional. None changes a D8 value.

1. **Three-column docs layout** (sidebar/article/TOC) instead of the broker's
   single column. Reason: a docs tree needs persistent navigation and an
   on-page map; the broker's model is a task console.
2. **Mobile `sections` text disclosure** instead of the broker's wrapping link
   rows. Reason: the documentation tree is too large for a wrapping header row.
   It is a native dialog: Escape, focus trap and focus return are preserved.
3. **Long-form prose at 14/22** (D8 UI body is 13/20) in a 44rem column.
   Reason: reading comfort over long normative pages. Both sizes are in the D8
   scale; no new size was added. Measured line: 78 characters.
4. **Search modal and Pagefind results.** Reason: the broker has no search; docs
   need full-text search (D7). Styled with the same rectangles and tokens.
5. **Per-page OG generation** (the broker's OG is deferred; D11 owns the public
   default). Reason: every docs page needs a title card. Nimbus's OG page type
   does not expose the sidebar section, so cards use the page title plus
   `docs.agentregistrar.dev`; recorded as a known limitation, not a new design.
6. **`awaiting review` provenance label.** The surface is the `PageActions`
   row (`data-nb-review-status`), text only, using the page-action tokens. It is
   visible while `aiGenerated: true` and clears only when a human reviewer sets
   `aiGenerated: false` and records `lastReviewed`.
7. **Docs `h1` is 26/32** rather than the public landing's 34/40 bold hero.
   Reason: D8 reserves `text-3xl` for landing only; docs pages are working
   surfaces, not marketing pages.
8. **Docs footer resources** (`spec`, `registry`, `validator`, `security`,
   `license`, `agentregistrar.dev`) rather than the public footer's
   `tos`/`dpa`/`blog`/`docs`/`login`. Reason: D12 section 4.4 locks the docs
   footer to the documentation resources; legal pages stay on the public site.
9. **Docs header adds section nav and `github`**; the public header has
   `docs`/`login`. Reason: docs navigation is task navigation; login stays on
   the product site.
10. **Nav and chrome labels are lowercase** (`start`, `providers`, `search`,
    `sections`, `copy markdown`, `edit page`). Reason: D8 system/UI voice.
    Content headings remain owned by the content issues.
11. **Docs OG has no illustration.** Reason: D8/D12 forbid new brand
    illustration; the public OG's handshake diagram is D11-owned and stays on
    the public site. The docs card is wordmark + `docs` + tagline + host.
12. **Sidebar group markers and TOC are ASCII/CSS, not Nimbus chevrons or the
    animated SVG rail.** Reason: no icons and no motion beyond color. The
    scroll-spy client contract is unchanged.
13. **Section-landing eyebrows and card lists are deferred to Issues 06-11.**
    The docs home ships the section 4.5 path cards and the static terminal MCP
    snippet; each section landing renders H1 + description + ASCII child list +
    one next step through the same shell. Reason: landing copy and child-page
    IA are owned by the content issues; the theme must not pre-empt them.

Conflict record: D8 values and D11 treatment agree. D11's header has no `/ docs`
label; D12 section 4.4 requires the docs lockup, and D8's wordmark rules allow a
muted label beside the wordmark. D8 values win; no other conflict was found.

---

## 6. Asset provenance

| Asset | Source and method |
| :--- | :--- |
| Wordmark | Text-rendered `agentregistrar_` in IBM Plex Mono 600, trailing `_` accent. `src/components/Wordmark.astro` for the shell; `public/brand/wordmark.svg` is a text export for third parties. No image wordmark is used in the UI. |
| Favicon / app icon | D8 section 2.2 geometry: `#0a0a0a` 32x32, `#3fb950` bar `x=8 y=19 w=16 h=3`. `public/brand/favicon.svg` is the source; `public/favicon.svg` is the served copy. |
| PWA / touch icons | Generated from the same rectangles with Pillow: `favicon.ico` (16/32), `apple-touch-icon.png` (180), `icon-192.png`, `icon-512.png`. `public/site.webmanifest` references them. |
| OG default | `public/og/docs-default.svg` (source), rendered 1:1 at 1200x630 to `public/og/docs-default.png` with the installed headless Chromium. Solid `#0a0a0a`, 1px `#242424` side rules, `agentregistrar_`, `/ docs`, `agent identity, brokered.`, `docs.agentregistrar.dev`. No gradient, shadow or illustration. |
| Per-page OG | Nimbus route `src/pages/og/[...slug].ts` + `_og-card-config.ts`, one solid-color card per page, IBM Plex Mono. Fallback `src/pages/og.png.ts`. |
| Fonts | IBM Plex Mono 400/500/600/700. Site: `@fontsource/ibm-plex-mono` 5.3.0 (woff2, self-hosted). OG/canvas: TTF from the IBM Plex repository (`packages/plex-mono/fonts/complete/ttf`), stored in `public/fonts/`. OFL-1.1. No other family is installed. |
| Social metadata | `astro.config.ts`: `socialImage: /og/docs-default.png`, `socialImageAlt`; NimbusHead emits `og:type`, title, description, image, dimensions and `twitter:card`; canonical URL comes from `site`. No tracking pixels. |

The previous scaffold fonts (Inter, JetBrains Mono) and the Inter OG font were
removed with their packages. The current `favicon.ico` was replaced; no Astro
default icon remains.

---

## 7. QA gates

### Automated (manual invocation; no test framework)

```bash
pnpm check:theme   # scripts/check-theme.mjs
pnpm typecheck
pnpm check
pnpm lint
pnpm build
git diff --check
```

`check-theme.mjs` scans `src/` and `public/` and fails on:

- `rounded`/`rounded-*` (bare forms included), `border-radius` (other than
  `0`), radius tokens;
- `shadow`/`shadow-*` (bare forms included), `box-shadow`, `drop-shadow`,
  `text-shadow`;
- gradients, gradient-stop utilities (`from-*`, `via-*`, `to-*`,
  `bg-linear-*`, `bg-radial-*`, `bg-conic-*`), `blur`/`blur-*` (bare forms
  included), `backdrop-blur-*`, `backdrop-filter`;
- translucent surface utilities (including `divide`, `outline`, `fill`,
  `stroke` and gradient stops with `/50` or `/[0.5]`), `rgba()`, `hsla()`;
- motion utilities (`animate-*`, except `animate-none`);
- light-theme branches, `dark:` variants, theme toggles, `data-mode`;
- icon libraries/components (`lucide`, `@iconify`, `astro-icon`, `ph:*`);
- off-palette Tailwind colors and `bg-white`/`text-black`;
- a second font utility, italics;
- non-ASCII bytes anywhere in the scanned source;
- hex values outside the D8 token table.

Block and whole-line `//` comments are masked before matching, so a comment
that documents a ban ("no shadow, no radius") is not a violation. The gate is
intentionally static: it does not measure contrast or runtime DOM. The Pagefind
`<mark>` rule is runtime DOM, so it is checked by the manual search pass below
(it was the one surface the first gate run could not see).

### Manual review checklist

1. **Contrast:** measured pairs in section 8; body text never `ghost`; `faint`
   only for meta.
2. **Focus:** 1px accent outline at 2px offset on header nav, sidebar, search,
   TOC, copy, pagination, mobile sections and dialog close.
3. **Keyboard:** skip link first; search open (`Ctrl/Cmd+K`), arrow keys, Enter,
   Escape; sidebar filter `/`; mobile dialog Escape/close/focus return; tabs
   arrow keys; copy button announces `Copied`.
4. **Breakpoints:** 375 / 768 / 1280; no horizontal page scroll; code and tables
   scroll internally; prose measure readable.
5. **Semantics:** one H1; heading order; landmarks; `aria-current`; real table
   headers; alt text; status never color-only.
6. **Assets:** favicon renders; default OG is 1200x630 and legible; page OG uses
   the page title; `og:image` is absolute and points at
   `/og/docs-default.png` or the page card.
7. **No drift:** `git diff` only touches theme/assets/components; no IA, route
   or copy changes. Do not copy a token into a component.
8. **Search surface:** build the Pagefind index, query `agent`, and confirm
   results are grouped by section, labels are lowercase, and every `<mark>`
   computes `background-color` `#050505` / `color` `#e8e8e8` with a 1px accent
   underline - never the UA yellow. Repeat at 375 and 1280.

### Measured contrast (WCAG 2.1, D8 values)

| Pair | Ratio | Verdict |
| :--- | ---: | :--- |
| foreground / background | 16.16 | AAA |
| foreground / surface | 15.41 | AAA |
| foreground / well | 16.63 | AAA |
| muted / background | 7.04 | AAA |
| muted / surface | 6.71 | AAA |
| muted / well | 7.24 | AAA |
| faint / background | 4.74 | AA |
| faint / surface | 4.52 | AA |
| accent / background | 7.79 | AAA |
| accent / surface | 7.43 | AAA |
| accent / well | 8.02 | AAA |
| warn / background | 7.84 | AAA |
| danger / background | 5.91 | AA |
| line-strong / background (control boundary) | 3.20 | passes 1.4.11 |
| line / background (structural rule) | 1.28 | decorative only |

---

## 8. Side-by-side review record (2026-10-21)

**Method.** Headless Chromium 1243 (`chrome-headless-shell` from
`/home/al/.cache/ms-playwright/chromium-1243/`), `--headless --screenshot`, one
fresh process per capture, viewport height 900. Docs were served from
`astro preview` (the production build at `localhost:4321`); the public site was
the live `https://agentregistrar.dev`. Screenshots are stored under
`/tmp/opencode/theme-review-03/` and are not committed (they are review
evidence, not site assets).

Pixel-diff was not attempted. The two surfaces do not share content, DOM or
layout (docs adds a sidebar/TOC/search; the public page is a marketing hero), so
a numeric diff would measure content differences, not brand differences. The
comparison below is a visual and token-level review: wordmark lockup, family,
scale, palette, border weight, spacing and voice, viewport by viewport. The
`.docs-content` prose measure was measured from computed layout
(`44rem` column, `656px` line box, 78 characters at 8.4px/char).

**Captures.**

| Viewport | Docs | Public | Notes |
| :--- | :--- | :--- | :--- |
| 1280x900 | `docs-home-1280.png`, `docs-protocol-1280.png`, `docs-reference-1280.png`, `docs-start-1280.png`, `docs-404-1280.png` | `public-home-1280.png` | header/footer, wordmark, type, borders, panels |
| 768x900 | `docs-home-768.png` | `public-home-768.png` | sidebar collapse, header density, wrapping |
| 375x900 | `docs-home-375.png`, `docs-mobile-sections-375.png`, `docs-probe-375.png` | `public-home-375.png` | header, touch targets, no horizontal scroll |
| 1280/375 | `docs-probe-1280.png`, `docs-probe-375.png` | - | temporary component fixture (callouts, steps, tabs, cards, code, file tree, table); page removed before commit |

**What was compared.**

- **Wordmark:** identical lowercase `agentregistrar` IBM Plex Mono 600 with an
  accent `_`; public is 12px in the header, docs is 12px plus a muted `/ docs`.
  Docs is static; the public landing hero uses the same underscore, and only
  the hero may blink (D8).
- **Type:** same family, weights and terminal scale. Public hero is 34/40 bold;
  docs page titles are 26/32 semibold, as section 2 records. Body prose is
  14/22 in docs and 13/20 in public UI panels; both are D8 sizes.
- **Color:** sampled surfaces match `#0a0a0a` / `#111111` / `#050505`;
  borders are `#242424`; signals are the same green/amber/red. No tinted
  surfaces on either.
- **Borders and spacing:** 1px rules, 48px header, 4px spacing base, no radius,
  shadow, gradient, blur or translucent panel on either surface. Public buttons
  and docs actions are square.
- **Voice:** lowercase chrome labels and terse copy on both; docs adds the
  docs-specific resource footer and `copy markdown` actions.
- **Chrome differences (intentional):** docs header has `/ docs`, section nav,
  `search` and `sections`; public header has `docs`/`login`. Docs has the
  three-column shell and TOC; public has the hero, diagram and panels. Footer
  link sets differ for the reason in section 5. These are the documented
  deviations, not drift.

**Component fixture.** The production content at this issue is the home and
seven section landings, so a temporary `/theme-probe/` page exercised the
callouts, steps, tabs, cards, code blocks (titled and untitled), code group,
file tree and a table at 1280 and 375. It was removed before the commit; the
captures remain in `/tmp`. Long protocol pages, quickstarts and the reference
table are owned by Issues 06-11; Issue 13 must repeat the breakpoint review on
the real pages.

**Behavior checks.** At 375px, `sections` opened the native dialog with focus on
`close`, `aria-expanded="true"`; Escape closed it and returned focus to the
trigger, with `aria-expanded="false"`. `body.scrollWidth` was 375 (no page
overflow); a code block measured 341px wide with 396px of content and scrolled
inside its figure. The active TOC link carried `aria-current="true"` and the
accent rail. Search and copy behavior are Nimbus's and were not forked.

**Known limitations.**

- The protocol spec, provider/agent quickstarts and reference tables are not in
  this build yet, so the screenshot set uses landings and a fixture. Issue 13
  repeats this review on the real page set.
- Per-page OG cards show the page title and the docs host, not the sidebar
  section (Nimbus's OG page type does not expose it). Default OG is the
  documented 1200x630 asset.
- The docs home title string is `Agent Registrar Docs` (content-owned, Issue 06).
  The D12 sketch allows `docs` or `Agent Registrar docs`; the theme does not
  change copy.

---

## 9. Maintenance rules

- Change a token in `docs/08-visual-identity/design-tokens.md` first, then
  `src/styles/globals.css`, then the public site in the same change. Never add a
  docs-only hex, family or hue.
- If the public header/footer/wordmark treatment changes, update this file and
  the docs shell together; do not let the surfaces drift.
- Components are restyled in place. If Nimbus behavior would have to change, use
  a thin wrapper and record it here.
- New content components must be registered in `src/components.ts`; they may not
  import icons or hand-roll radius/shadow/gradient utilities.
- Run `pnpm check:theme` before review. It is the mechanical part of identity
  compliance; the manual checklist in section 7 is the rest.
- Do not commit review screenshots or generated `dist/` output.

## 10. Do not

- Do not add a light theme, theme toggle, `prefers-color-scheme` branch or
  `dark:` variant.
- Do not add a second font, italics, icon font, SVG icon or emoji.
- Do not add radius, shadow, gradient, blur, translucency or elevation.
- Do not use `ghost` for body text; do not use `faint` for prose.
- Do not color status without a word; do not use accent for decoration.
- Do not add marketing sections, pricing, testimonials, logos, a cookie banner
  or a newsletter to docs.
