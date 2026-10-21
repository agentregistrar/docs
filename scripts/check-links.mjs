#!/usr/bin/env node
/**
 * Link gate for the built site (manual; no test framework).
 *
 * The Nimbus lint rules read `.mdx` sources, so they never see the generated
 * protocol pages. This gate runs over `dist/` after `astro build`: every
 * internal href (including the absolute docs origin used by generated pages)
 * must resolve to a built file, and every fragment must name an element id on
 * the target page. A planted dead link in a generated page therefore fails
 * `pnpm build`.
 *
 * Run with:
 *
 *   pnpm check:links
 *
 * Exit code 0 = clean, 1 = broken links. This is a review gate, not a test.
 */

import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { extname, join, relative } from "node:path";

const ROOT = new URL("..", import.meta.url).pathname;
const DIST = join(ROOT, "dist");
const SITE_ORIGIN = "https://docs.agentregistrar.dev";
const SITE_HOST = new URL(SITE_ORIGIN).host;

if (!existsSync(DIST)) {
  console.error("check:links: dist/ is missing. Run `pnpm build` first.");
  process.exit(1);
}

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) walk(path, out);
    else out.push(path);
  }
  return out;
}

function decodeEntities(value) {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#(\d+);/g, (_match, code) =>
      String.fromCodePoint(Number.parseInt(code, 10)),
    )
    .replace(/&#x([0-9a-f]+);/gi, (_match, code) =>
      String.fromCodePoint(Number.parseInt(code, 16)),
    );
}

function decodePath(value) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

/** Redirect sources from the emitted Workers `_redirects` file. */
const redirects = new Map();
const redirectsFile = join(DIST, "_redirects");
if (existsSync(redirectsFile)) {
  for (const line of readFileSync(redirectsFile, "utf8").split("\n")) {
    const [from, to] = line.trim().split(/\s+/);
    if (from?.startsWith("/") && to?.startsWith("/")) {
      redirects.set(from.replace(/\/$/, "") || "/", to);
    }
  }
}

const htmlFiles = walk(DIST).filter((file) => extname(file) === ".html");
const anchorCache = new Map();

function anchorIds(file) {
  if (!anchorCache.has(file)) {
    const html = readFileSync(file, "utf8");
    const ids = new Set(
      [...html.matchAll(/\bid="([^"]*)"/g)].map((match) =>
        decodeEntities(match[1]),
      ),
    );
    anchorCache.set(file, ids);
  }
  return anchorCache.get(file);
}

function sitePath(file) {
  const rel = relative(DIST, file).split("\\").join("/");
  return `/${rel}`.replace(/\/index\.html$/, "/");
}

function candidatesFor(pathname) {
  const clean = pathname.replace(/\/+$/, "") || "/";
  if (clean === "/") return [join(DIST, "index.html")];
  const exact = join(DIST, clean);
  const list = [];
  if (existsSync(exact) && statSync(exact).isFile()) list.push(exact);
  list.push(join(DIST, clean, "index.html"));
  list.push(join(DIST, `${clean}.html`));
  const redirected = redirects.get(clean);
  if (redirected) list.unshift(...candidatesFor(redirected.split("#")[0]));
  return list;
}

/**
 * Resolve one href to a built file. Returns `null` when the link is external
 * or non-navigational, otherwise `{ file, fragment, href }`.
 */
function resolveHref(href, fromFile) {
  const raw = decodeEntities(href.trim());
  if (
    !raw ||
    raw.startsWith("#") ||
    raw.startsWith("//") ||
    /^(?:mailto|tel|javascript|data):/i.test(raw)
  ) {
    if (raw.startsWith("#")) {
      return { file: fromFile, fragment: raw.slice(1), href: raw };
    }
    return null;
  }

  let url;
  try {
    url = new URL(raw, `${SITE_ORIGIN}${sitePath(fromFile)}`);
  } catch {
    return { file: null, fragment: "", href: raw };
  }
  if (url.host !== SITE_HOST) return null;
  const pathname = decodePath(url.pathname);
  const resolved = candidatesFor(pathname);
  const file = resolved.find((candidate) => existsSync(candidate));
  return {
    file: file ?? null,
    fragment: url.hash ? decodePath(url.hash.slice(1)) : "",
    href: raw,
  };
}

const problems = [];
let checked = 0;

for (const file of htmlFiles) {
  const html = readFileSync(file, "utf8");
  const rel = relative(ROOT, file);
  for (const match of html.matchAll(/\bhref="([^"]*)"/g)) {
    const target = resolveHref(match[1], file);
    if (!target) continue;
    checked += 1;
    if (!target.file) {
      const line = html.slice(0, match.index).split("\n").length;
      problems.push(`${rel}:${line}: ${target.href} -> no built file`);
      continue;
    }
    if (
      target.fragment &&
      extname(target.file) === ".html" &&
      !anchorIds(target.file).has(target.fragment)
    ) {
      const line = html.slice(0, match.index).split("\n").length;
      problems.push(
        `${rel}:${line}: ${target.href} -> missing #${target.fragment} on ${relative(
          ROOT,
          target.file,
        )}`,
      );
    }
  }
}

if (problems.length > 0) {
  for (const problem of problems) console.error(problem);
  console.error(
    `check:links: ${problems.length} broken link(s) across ${checked} checked.`,
  );
  process.exit(1);
}

console.log(
  `check:links: ok (${checked} links across ${htmlFiles.length} HTML pages)`,
);
