#!/usr/bin/env node
/**
 * SEO metadata gate for the docs content (manual; no test framework).
 *
 * The Nimbus lint rules cover structure and links, but they do not enforce the
 * length, uniqueness or shape of the two fields that become the page title and
 * meta description. This gate reads the source tree before the build so a page
 * with a missing, duplicated or overlong title cannot ship unnoticed.
 *
 * Run with:
 *
 *   pnpm check:seo
 *
 * Exit code 0 = clean, 1 = errors. This is a review gate, not a test.
 */

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = new URL("..", import.meta.url).pathname;
const CONTENT = join(ROOT, "src/content/docs");

const TITLE_MAX = 40;
const DESCRIPTION_MIN = 70;
const DESCRIPTION_MAX = 160;

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) walk(path, out);
    else out.push(path);
  }
  return out;
}

function parseFrontmatter(source) {
  const match = source.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return null;

  const fields = {};
  for (const line of match[1].split("\n")) {
    const field = line.match(/^([A-Za-z][A-Za-z0-9]*):\s*(.*)$/);
    if (!field) continue;
    let value = field[2].trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    fields[field[1]] = value;
  }
  return fields;
}

function stripFencedCode(source) {
  return source.replace(/^```[\s\S]*?^```/gm, "").replace(/^~~~[\s\S]*?^~~~/gm, "");
}

function headings(source) {
  return [...source.matchAll(/^(#{1,6})\s+(.+)$/gm)].map((match) => ({
    level: match[1].length,
    text: match[2].trim(),
  }));
}

const problems = [];
const titles = new Map();
const descriptions = new Map();

function report(file, message) {
  problems.push(`${relative(ROOT, file)}: ${message}`);
}

for (const file of walk(CONTENT).filter((path) => /\.(md|mdx)$/.test(path))) {
  const source = readFileSync(file, "utf8");
  const fields = parseFrontmatter(source);

  if (!fields) {
    report(file, "missing frontmatter block");
    continue;
  }

  const frontmatter = source.match(/^---\n([\s\S]*?)\n---/)?.[1] ?? "";
  for (const line of frontmatter.split("\n")) {
    const field = line.match(/^(title|description):\s*(.*)$/);
    if (field && !/^["']/.test(field[2]) && field[2].includes(": ")) {
      report(file, `${field[1]} contains ": " and must be quoted for YAML`);
    }
  }

  const title = fields.title ?? "";
  const description = fields.description ?? "";
  const generated = fields.generated === "true";

  if (!title) report(file, "missing title");
  if (!description) report(file, "missing description");

  if (title) {
    if (title.length > TITLE_MAX) {
      report(
        file,
        `title is ${title.length} characters; keep it at or below ${TITLE_MAX} so the rendered title stays readable`,
      );
    }
    if (title.includes(" | ")) {
      report(file, "title must not include a site suffix; the layout adds one");
    }
    if (titles.has(title)) {
      report(file, `duplicate title; also used by ${relative(ROOT, titles.get(title))}`);
    } else {
      titles.set(title, file);
    }
  }

  if (description) {
    if (description.length < DESCRIPTION_MIN || description.length > DESCRIPTION_MAX) {
      report(
        file,
        `description is ${description.length} characters; keep it between ${DESCRIPTION_MIN} and ${DESCRIPTION_MAX}`,
      );
    }
    if (!/^[A-Z]/.test(description)) {
      report(file, "description must start with a capital letter");
    }
    if (!description.endsWith(".")) {
      report(file, "description must end with a period");
    }
    if (descriptions.has(description)) {
      report(
        file,
        `duplicate description; also used by ${relative(ROOT, descriptions.get(description))}`,
      );
    } else {
      descriptions.set(description, file);
    }
  }

  const body = stripFencedCode(
    source.replace(/^---\n[\s\S]*?\n---\n/, ""),
  );
  const pageHeadings = headings(body);
  const bodyH1 = pageHeadings.filter((heading) => heading.level === 1);

  if (generated) {
    if (bodyH1.length > 1) {
      report(file, `generated page has ${bodyH1.length} body H1 headings; keep at most one`);
    }
  } else if (bodyH1.length > 0) {
    report(file, "body starts an H1; the layout renders the frontmatter title as the only H1");
  }

  let previous = 1;
  for (const heading of pageHeadings) {
    if (heading.level > previous + 1) {
      report(
        file,
        `heading hierarchy jumps from H${previous} to H${heading.level} at "${heading.text}"`,
      );
    }
    previous = heading.level;
  }
}

if (problems.length > 0) {
  for (const problem of problems) console.error(`- [error] ${problem}`);
  console.error(`check:seo: ${problems.length} error(s).`);
  process.exit(1);
}

console.log(
  `check:seo: ok (${titles.size} titles, ${descriptions.size} descriptions, ${walk(CONTENT).length} content files)`,
);
