#!/usr/bin/env node
/**
 * Terminal theme QA gate (manual; no test framework).
 *
 * Scans src/ and public/ for the default Nimbus look and for values that are
 * not in the Deliverable 8 token table. Run with:
 *
 *   pnpm check:theme
 *
 * Exit code 0 = clean, 1 = violations. This is a review gate, not a test.
 */

import { readdirSync, readFileSync, statSync } from "node:fs";
import { extname, join, relative } from "node:path";

const ROOT = new URL("..", import.meta.url).pathname;
const SCAN_ROOTS = ["src", "public"];
const TEXT_EXT = new Set([
  ".astro",
  ".ts",
  ".tsx",
  ".js",
  ".mjs",
  ".css",
  ".md",
  ".mdx",
  ".json",
  ".webmanifest",
  ".svg",
  ".txt",
  ".html",
]);

// D8 design-tokens.md section 1, verbatim.
const TOKEN_HEX = new Set([
  "0a0a0a",
  "111111",
  "050505",
  "161616",
  "242424",
  "616161",
  "e8e8e8",
  "ffffff",
  "9a9a9a",
  "7c7c7c",
  "555555",
  "3fb950",
  "d29922",
  "f85149",
]);

const RULES = [
  {
    id: "radius",
    re: /\brounded(?:-[a-z0-9[\]/.%]+)?(?![\w-])|border-radius\s*:|--radius-(?!\*:\s*initial)/g,
    message: "radius is removed by D8 (square geometry)",
    allow: (line) =>
      /--radius-\*:\s*initial/.test(line) || /border-radius:\s*0/.test(line),
  },
  {
    id: "shadow",
    re: /\bshadow(?:-[a-z0-9[\]/.%]+)?(?![\w-])|box-shadow\s*:|drop-shadow\s*\(|text-shadow\s*:/g,
    message: "shadows are removed by D8 (1px borders only)",
    allow: (line) => /--shadow-\*:\s*initial/.test(line),
  },
  {
    id: "gradient",
    re: /gradient\s*\(|\bbg-(?:gradient|linear|radial|conic)(?:-[a-z0-9[\]/.%-]+)?|\b(?:from|via|to)-(?:transparent|current|black|white|\[[^\]]+\]|(?:background|surface|well|hover|line|line-strong|foreground|foreground-strong|muted|faint|ghost|accent|warn|danger)(?:\/\d{1,3})?|[a-z]+-\d{2,3})(?![\w-])/gi,
    message: "gradients and gradient-stop utilities are forbidden",
  },
  {
    id: "blur",
    re: /\b(?:backdrop-)?blur(?:-[a-z0-9[\]/.%]+)?(?![\w-])|blur\(\s*\d|backdrop-filter/g,
    message: "blur/backdrop-filter is forbidden",
    // DOM `.blur()` (focus release) is not a visual filter.
    allow: (line) => /\.blur\(\)/.test(line),
  },
  {
    id: "translucency",
    re: /\b(?:bg|border|text|ring|divide|outline|fill|stroke|from|via|to|shadow|caret|decoration|placeholder)-[a-z0-9-]+(?:\/\[[^\]]+\]|\/\d{1,3})(?![\w-])|\brgba?\(|\bhsla?\(/g,
    message: "translucent surfaces are forbidden (opaque tokens only)",
  },
  {
    id: "motion",
    re: /\banimate-(?!none\b)[a-z0-9[\]-]+/g,
    message: "no motion beyond color (D8)",
  },
  {
    id: "light-theme",
    re: /prefers-color-scheme|theme-toggle|ThemeToggle|data-mode|color-scheme:\s*light|\bdark:/g,
    message: "dark only: no light branch, theme toggle or dark: variant",
  },
  {
    id: "icons",
    re: /lucide|@iconify|astro-icon|\bIcon\.astro\b|\bph:[a-z0-9-]+/g,
    message: "no icon libraries or icon components",
  },
  {
    id: "off-palette",
    re: /\b(?:bg|text|border|ring|outline|from|to|via)-(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-\d{2,3}\b|\b(?:bg-white|text-black)\b/g,
    message: "off-token color utility (D8 palette only)",
  },
  {
    id: "second-family",
    re: /\bfont-(?:sans|serif)\b/g,
    message: "IBM Plex Mono only (the sans utility is an alias, not a style)",
    allow: (line) => /--font-sans/.test(line) || /--nb-font-sans/.test(line),
  },
  {
    id: "italics",
    re: /\bitalic\b|font-style:\s*italic/g,
    message: "no italics",
  },
  {
    id: "non-ascii",
    re: /[^\x09\x0A\x0D\x20-\x7E]/g,
    message: "rendered text and source must be ASCII",
  },
  {
    id: "off-token-hex",
    re: /#[0-9a-fA-F]{3,8}\b/g,
    message: "hex value is not in the D8 token table",
    allow: (_line, match) => {
      const hex = match.slice(1).toLowerCase();
      if (TOKEN_HEX.has(hex)) return true;
      // Three-digit shorthand must expand to a token.
      if (hex.length === 3) {
        const full = hex.split("").map((c) => c + c).join("");
        return TOKEN_HEX.has(full);
      }
      return false;
    },
  },
];

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    const stat = statSync(path);
    if (stat.isDirectory()) walk(path, out);
    else if (TEXT_EXT.has(extname(name))) out.push(path);
  }
  return out;
}

/**
 * Blank out block comments and whole-line `//` comments before matching.
 * Comments document the bans ("no shadow, no radius"), so matching raw text
 * would flag the documentation instead of the code. Line numbers are kept.
 */
function maskComments(lines) {
  let inBlock = false;
  let inHtml = false;
  return lines.map((line) => {
    let out = "";
    for (let i = 0; i < line.length; i += 1) {
      if (!inBlock && !inHtml && line.startsWith("/*", i)) {
        inBlock = true;
        i += 1;
        continue;
      }
      if (inBlock && line.startsWith("*/", i)) {
        inBlock = false;
        i += 1;
        continue;
      }
      if (!inBlock && !inHtml && line.startsWith("<!--", i)) {
        inHtml = true;
        i += 3;
        continue;
      }
      if (inHtml && line.startsWith("-->", i)) {
        inHtml = false;
        i += 2;
        continue;
      }
      if (!inBlock && !inHtml) out += line[i];
    }
    return out.trimStart().startsWith("//") ? "" : out;
  });
}

const violations = [];

for (const scanRoot of SCAN_ROOTS) {
  const abs = join(ROOT, scanRoot);
  for (const file of walk(abs)) {
    const text = readFileSync(file, "utf8");
    const lines = text.split("\n");
    // Generated normative pages are verbatim spec text. The spec is canonical
    // and contains typographic punctuation (em dashes, curly quotes); the
    // ASCII rule applies to hand-authored text only. The page is identified by
    // the generated frontmatter the sync script writes, not by a path list.
    const frontmatter = text.match(/^---\r?\n([\s\S]*?)\r?\n---/)?.[1] ?? "";
    const generatedPage = /^generated:\s*true\s*$/m.test(frontmatter);
    const masked = maskComments(lines);
    for (const [index, line] of lines.entries()) {
      const target = masked[index];
      for (const rule of RULES) {
        if (generatedPage && rule.id === "non-ascii") continue;
        rule.re.lastIndex = 0;
        for (const match of target.matchAll(rule.re)) {
          if (rule.allow?.(line, match[0])) continue;
          violations.push({
            file: relative(ROOT, file),
            line: index + 1,
            rule: rule.id,
            message: rule.message,
            value: match[0],
          });
        }
      }
    }
  }
}

if (violations.length > 0) {
  for (const v of violations) {
    console.error(`${v.file}:${v.line}: [${v.rule}] ${v.value} - ${v.message}`);
  }
  console.error(`\n${violations.length} theme violation(s).`);
  process.exit(1);
}

console.log("theme qa: clean - no radius, shadow, gradient, blur, motion,");
console.log("translucency, light-theme, icon, non-ASCII or off-token value");
console.log("in src/ or public/.");
