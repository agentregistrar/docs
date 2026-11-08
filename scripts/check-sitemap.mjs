#!/usr/bin/env node
/**
 * Sitemap gate for the built site (manual; no test framework).
 *
 * Checks that the sitemap index and its child maps exist, that every listed URL
 * maps to a built HTML page, that every URL carries a valid `lastmod`, and that
 * robots.txt advertises the index. A shallow build drops `lastmod`, so this
 * gate fails loudly instead of publishing a map search engines cannot date.
 *
 * Run with:
 *
 *   pnpm check:sitemap
 *
 * Exit code 0 = clean, 1 = errors. This is a review gate, not a test.
 */

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = new URL("..", import.meta.url).pathname;
const DIST = join(ROOT, "dist");
const SITE_ORIGIN = "https://docs.agentregistrar.dev";
const SITEMAP_INDEX = join(DIST, "sitemap-index.xml");
const SITEMAP_ALIAS = join(DIST, "sitemap.xml");
const ROBOTS = join(DIST, "robots.txt");

const LAST_MOD = /^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z)?$/;

const problems = [];

function read(path, label) {
  if (!existsSync(path)) {
    problems.push(`${label} is missing`);
    return null;
  }
  return readFileSync(path, "utf8");
}

function locations(xml) {
  return [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1]);
}

function localFileFor(url) {
  const pathname = new URL(url).pathname;
  const clean = pathname.replace(/\/+$/, "") || "/";
  return clean === "/"
    ? join(DIST, "index.html")
    : join(DIST, clean, "index.html");
}

const indexXml = read(SITEMAP_INDEX, "sitemap-index.xml");
const aliasXml = read(SITEMAP_ALIAS, "sitemap.xml");
const robots = read(ROBOTS, "robots.txt");

if (indexXml) {
  const childMaps = locations(indexXml);
  if (childMaps.length === 0) problems.push("sitemap-index.xml lists no child sitemap");

  for (const childUrl of childMaps) {
    const childPath = join(DIST, new URL(childUrl).pathname.replace(/^\//, ""));
    const childXml = read(childPath, `sitemap child ${childUrl}`);
    if (!childXml) continue;

    const urls = [...childXml.matchAll(/<url>([\s\S]*?)<\/url>/g)];
    if (urls.length === 0) problems.push(`${childUrl} lists no URLs`);

    for (const [, entry] of urls) {
      const loc = entry.match(/<loc>([^<]+)<\/loc>/)?.[1];
      const lastmod = entry.match(/<lastmod>([^<]+)<\/lastmod>/)?.[1];

      if (!loc) {
        problems.push(`${childUrl} has a URL entry without loc`);
        continue;
      }
      if (!loc.startsWith(SITE_ORIGIN)) {
        problems.push(`${loc} is outside ${SITE_ORIGIN}`);
      }
      if (!lastmod) {
        problems.push(`${loc} has no lastmod; run the build with full git history`);
      } else if (!LAST_MOD.test(lastmod) || Number.isNaN(Date.parse(lastmod))) {
        problems.push(`${loc} has an invalid lastmod: ${lastmod}`);
      }
      if (!existsSync(localFileFor(loc))) {
        problems.push(`${loc} does not map to a built index.html`);
      }
    }
  }
}

if (aliasXml && indexXml && !aliasXml.includes("sitemap-0.xml")) {
  problems.push("sitemap.xml does not alias the generated sitemap index");
}

if (robots) {
  const sitemapLine = robots
    .split("\n")
    .find((line) => /^Sitemap:\s*/i.test(line));
  if (!sitemapLine) {
    problems.push("robots.txt has no Sitemap line");
  } else if (!/sitemap-(?:index|0)\.xml/.test(sitemapLine)) {
    problems.push(`robots.txt names an unexpected sitemap: ${sitemapLine}`);
  }
}

if (problems.length > 0) {
  for (const problem of problems) console.error(`- [error] ${problem}`);
  console.error(`check:sitemap: ${problems.length} error(s).`);
  process.exit(1);
}

console.log("check:sitemap: ok (index, child maps, URLs, lastmod and robots.txt)");
