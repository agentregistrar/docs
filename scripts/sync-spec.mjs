#!/usr/bin/env node
/**
 * Sync the pinned `agentregistrar/spec` tag into the docs content tree.
 *
 * The spec repository is canonical. This script downloads the tag tarball,
 * resolves the tag's peeled commit through the GitHub API, verifies every
 * source file against `spec.lock.json`, and writes the generated pages.
 *
 * Commands:
 *
 *   pnpm sync:spec                 # same as `node scripts/sync-spec.mjs --write`
 *   pnpm sync:spec:check           # offline drift check (runs before the build)
 *   node scripts/sync-spec.mjs --tag v1.2.0
 *                                  # preview a tag in memory; writes nothing
 *   node scripts/sync-spec.mjs --write --tag v1.2.0
 *                                  # sync and update the lock to the new tag
 *
 * `--check` never uses the network. It verifies the committed output hashes in
 * `spec.lock.json` against the generated files on disk. The tag, commit and
 * source hashes are verified by the explicit sync (`--write`), not by the build.
 *
 * Allowed transforms, and nothing else:
 *   1. prepend frontmatter;
 *   2. rewrite relative spec-repo links to absolute GitHub or docs URLs;
 *   3. add the generated-content banner and source link.
 * The changelog combines the two release-notes files newest-first; its headings
 * are demoted one level so the page has a single title from frontmatter.
 */

import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, posix } from "node:path";
import { gunzipSync } from "node:zlib";

const ROOT = new URL("..", import.meta.url).pathname;
const LOCK_PATH = join(ROOT, "spec.lock.json");
const SPEC_REPO = "agentregistrar/spec";
const SPEC_ORIGIN = `https://github.com/${SPEC_REPO}`;
const DOCS_ORIGIN = "https://docs.agentregistrar.dev";
const CANONICAL_SCHEMA_ID = `${DOCS_ORIGIN}/agent-identity/v1/agent-signup.schema.json`;
const API_ROOT = `https://api.github.com/repos/${SPEC_REPO}`;
const USER_AGENT = "agentregistrar-docs-sync";

/** Files the lock pins. Order is stable so the lock diff is readable. */
const SOURCE_FILES = [
  "agent-identity-v1.md",
  "scope-boundaries.md",
  "implementing-agent-identity-v1.md",
  "validator.md",
  "release-notes-v1.0.0.md",
  "release-notes-v1.1.0.md",
  "agent-signup.schema.json",
];

/**
 * Generated pages. `source` is the spec file the page is generated from;
 * `output` is relative to the docs repo root.
 */
const PAGES = [
  {
    source: "agent-identity-v1.md",
    output: "src/content/docs/agent-identity/v1/specification.md",
    title: "agent-identity-v1 specification",
    description:
      "The normative definition of the agent-identity-v1 discovery document and brokered signup handshake.",
  },
  {
    source: "scope-boundaries.md",
    output: "src/content/docs/agent-identity/v1/scope-boundaries.md",
    title: "Scope boundaries",
    description:
      "What the identity protocol owns, what the vendor owns, and the checklist for future protocol changes.",
  },
  {
    source: "implementing-agent-identity-v1.md",
    output: "src/content/docs/agent-identity/v1/implementation-guide.md",
    title: "Implementation guide",
    description:
      "A relying-party checklist for publishing discovery, verifying assertions and returning a receipt.",
  },
  {
    source: "validator.md",
    output: "src/content/docs/agent-identity/v1/validator.md",
    title: "Conformance validator",
    description:
      "How to run the discovery conformance validator, read its exit codes and parse its JSON output.",
  },
];

const CHANGELOG = {
  sources: ["release-notes-v1.1.0.md", "release-notes-v1.0.0.md"],
  output: "src/content/docs/agent-identity/v1/changelog.md",
  title: "Release notes and changelog",
  description:
    "Release notes for agent-identity-v1 v1.1.0 and v1.0.0, newest first.",
};

const SCHEMA_OUTPUT = "public/agent-identity/v1/agent-signup.schema.json";

/** Generated docs pages that correspond to a spec file. */
const DOCS_PAGE_BY_SOURCE = {
  "agent-identity-v1.md": "/agent-identity/v1/specification/",
  "scope-boundaries.md": "/agent-identity/v1/scope-boundaries/",
  "implementing-agent-identity-v1.md":
    "/agent-identity/v1/implementation-guide/",
  "validator.md": "/agent-identity/v1/validator/",
};

function sha256(bytes) {
  return `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
}

function readLock() {
  if (!existsSync(LOCK_PATH)) {
    throw new Error(
      "spec.lock.json is missing. Run `pnpm sync:spec` to create it.",
    );
  }
  return JSON.parse(readFileSync(LOCK_PATH, "utf8"));
}

function writeLock(lock) {
  writeFileSync(LOCK_PATH, `${JSON.stringify(lock, null, 2)}\n`);
}

function parseArgs(argv) {
  // `auto` means: check when no tag is given, preview when `--tag` is given.
  const options = { mode: "auto", tag: null, write: false };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--check") options.mode = "check";
    else if (arg === "--write") {
      options.mode = "write";
      options.write = true;
    } else if (arg === "--tag") {
      const tag = argv[i + 1];
      if (!tag || tag.startsWith("--")) {
        throw new Error("--tag needs a value, for example --tag v1.1.0");
      }
      options.tag = tag;
      i += 1;
    } else if (arg === "--help" || arg === "-h") {
      options.mode = "help";
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }
  return options;
}

function usage() {
  console.log(`Sync the pinned agentregistrar/spec tag into the docs tree.

  node scripts/sync-spec.mjs                 offline check (default)
  node scripts/sync-spec.mjs --check         offline check
  node scripts/sync-spec.mjs --write         fetch, verify, write pages and lock
  node scripts/sync-spec.mjs --tag <tag>     preview a tag; writes nothing
  node scripts/sync-spec.mjs --write --tag <tag>
                                             sync and update the lock to <tag>
`);
}

async function getJson(url) {
  const headers = {
    Accept: "application/vnd.github+json",
    "User-Agent": USER_AGENT,
  };
  if (process.env.GITHUB_TOKEN) {
    headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  }
  const response = await fetch(url, { headers });
  if (!response.ok) {
    throw new Error(`GitHub API ${response.status} for ${url}`);
  }
  return response.json();
}

/**
 * Resolve a tag to its peeled commit. An annotated tag points at a tag object,
 * which points at the commit; a lightweight tag points straight at the commit.
 */
async function resolveTagCommit(tag) {
  const ref = await getJson(
    `${API_ROOT}/git/ref/tags/${encodeURIComponent(tag)}`,
  );
  let object = ref.object;
  if (!object?.type) throw new Error(`Tag ${tag} has no object type`);
  if (object.type === "tag") {
    const annotated = await getJson(`${API_ROOT}/git/tags/${object.sha}`);
    object = annotated.object;
  }
  if (object?.type !== "commit") {
    throw new Error(`Tag ${tag} does not resolve to a commit`);
  }
  return object.sha;
}

async function fetchTarball(tag) {
  const url = `https://codeload.github.com/${SPEC_REPO}/tar.gz/refs/tags/${encodeURIComponent(tag)}`;
  const response = await fetch(url, {
    headers: { "User-Agent": USER_AGENT },
  });
  if (!response.ok) {
    throw new Error(`Tarball download failed: ${response.status} for ${url}`);
  }
  return Buffer.from(await response.arrayBuffer());
}

function readString(buffer, offset, length) {
  const slice = buffer.subarray(offset, offset + length);
  const end = slice.indexOf(0);
  return slice.subarray(0, end === -1 ? slice.length : end).toString("utf8");
}

function parsePax(data) {
  const entries = {};
  let offset = 0;
  while (offset < data.length) {
    const space = data.indexOf(0x20, offset);
    if (space === -1) break;
    const length = Number.parseInt(data.subarray(offset, space).toString(), 10);
    if (!Number.isFinite(length) || length <= 0) break;
    const record = data
      .subarray(space + 1, offset + length - 1)
      .toString("utf8");
    const equals = record.indexOf("=");
    if (equals !== -1) {
      entries[record.slice(0, equals)] = record.slice(equals + 1);
    }
    offset += length;
  }
  return entries;
}

/**
 * Minimal ustar reader for the tag tarball. The files this script needs are
 * top-level, but pax/gnu long-name records are handled so a future release
 * with a longer path still extracts.
 */
function extractTarGz(buffer) {
  const tar = gunzipSync(buffer);
  const files = new Map();
  let offset = 0;
  let pendingName = null;
  let pendingPax = null;

  while (offset + 512 <= tar.length) {
    const header = tar.subarray(offset, offset + 512);
    if (header.every((byte) => byte === 0)) break;

    const name = readString(header, 0, 100);
    const prefix = readString(header, 345, 155);
    const size = Number.parseInt(readString(header, 124, 12).trim() || "0", 8);
    const type = String.fromCharCode(header[156] || 48);
    const dataStart = offset + 512;
    const data = tar.subarray(dataStart, dataStart + size);
    const nextOffset = dataStart + Math.ceil(size / 512) * 512;

    if (type === "x" || type === "X") {
      pendingPax = parsePax(data);
    } else if (type === "g") {
      // Global pax header: no path applies to this repository's tarball.
    } else if (type === "L") {
      pendingName = readString(data, 0, data.length).replace(/\0+$/, "");
    } else if (type === "0" || type === "\0") {
      const paxPath = pendingPax?.path;
      const resolvedName =
        paxPath || pendingName || (prefix ? `${prefix}/${name}` : name);
      files.set(resolvedName, Buffer.from(data));
      pendingName = null;
      pendingPax = null;
    }

    offset = nextOffset;
  }

  return files;
}

function archiveRoot(files) {
  const first = files.keys().next().value;
  if (!first) throw new Error("Tarball is empty");
  const root = first.split("/")[0];
  if (!root) throw new Error("Tarball has no root directory");
  return root;
}

function readSources(files, tag) {
  const root = archiveRoot(files);
  const sources = new Map();
  for (const path of SOURCE_FILES) {
    const bytes = files.get(`${root}/${path}`);
    if (!bytes) {
      throw new Error(`Tag ${tag} is missing ${path}`);
    }
    sources.set(path, bytes);
  }
  return sources;
}

function sourceHashes(sources) {
  return SOURCE_FILES.map((path) => ({
    path,
    sha256: sha256(sources.get(path)),
  }));
}

function docsUrl(path, anchor) {
  return `${DOCS_ORIGIN}${path}${anchor ? `#${anchor}` : ""}`;
}

function githubUrl(tag, path, anchor, kind = "blob") {
  return `${SPEC_ORIGIN}/${kind}/${tag}/${path}${anchor ? `#${anchor}` : ""}`;
}

/**
 * Rewrite one markdown link destination. Absolute URLs, protocol-relative URLs
 * and pure anchors are left alone. Everything else is resolved against the
 * source file's directory and mapped to a docs page or a GitHub tag URL.
 */
function rewriteDestination(destination, sourcePath, tag) {
  if (
    !destination ||
    destination.startsWith("#") ||
    destination.startsWith("/") ||
    destination.startsWith("//") ||
    /^[a-z][a-z0-9+.-]*:/i.test(destination)
  ) {
    return destination;
  }

  const hashIndex = destination.indexOf("#");
  const pathPart =
    hashIndex === -1 ? destination : destination.slice(0, hashIndex);
  const anchor = hashIndex === -1 ? "" : destination.slice(hashIndex + 1);
  if (!pathPart) return destination;

  const resolved = posix.normalize(
    posix.join(posix.dirname(sourcePath), pathPart),
  );
  const clean = resolved.replace(/^\.\//, "");

  if (clean in DOCS_PAGE_BY_SOURCE) {
    return docsUrl(DOCS_PAGE_BY_SOURCE[clean], anchor);
  }
  if (clean === "agent-signup.schema.json") {
    return `${CANONICAL_SCHEMA_ID}${anchor ? `#${anchor}` : ""}`;
  }

  const isDirectory =
    pathPart.endsWith("/") ||
    !posix.basename(clean).includes(".");
  return githubUrl(tag, clean, anchor, isDirectory ? "tree" : "blob");
}

function transformLinks(text, sourcePath, tag) {
  const lines = text.split("\n");
  const output = [];
  let fence = null;

  for (const line of lines) {
    const fenceMatch = line.match(/^\s*(`{3,}|~{3,})/);
    if (fenceMatch) {
      if (!fence) fence = fenceMatch[1][0];
      else if (fenceMatch[1][0] === fence) fence = null;
      output.push(line);
      continue;
    }
    if (fence) {
      output.push(line);
      continue;
    }
    output.push(
      line.replace(
        /\]\(([^)\s]+)([^)]*)\)/g,
        (_match, destination, suffix) =>
          `](${rewriteDestination(destination, sourcePath, tag)}${suffix})`,
      ),
    );
  }

  return output.join("\n");
}

/** Demote every heading one level, outside code fences. */
function demoteHeadings(text) {
  const lines = text.split("\n");
  const output = [];
  let fence = null;

  for (const line of lines) {
    const fenceMatch = line.match(/^\s*(`{3,}|~{3,})/);
    if (fenceMatch) {
      if (!fence) fence = fenceMatch[1][0];
      else if (fenceMatch[1][0] === fence) fence = null;
      output.push(line);
      continue;
    }
    if (!fence) {
      const heading = line.match(/^(#{1,5})(\s+)(.*)$/);
      if (heading) {
        output.push(`${heading[1]}#${heading[2]}${heading[3]}`);
        continue;
      }
    }
    output.push(line);
  }

  return output.join("\n");
}

function releaseDate(sources, tag) {
  const newest = sources.get("release-notes-v1.1.0.md").toString("utf8");
  const match = newest.match(/\*\*Release date:\*\*\s*(\d{4}-\d{2}-\d{2})/);
  if (match) return match[1];
  // The tag tarball has no git metadata; fall back to the sync date only if
  // the release notes stop carrying a date. `--write` prints a warning.
  console.warn(
    `warning: no release date in release-notes-v1.1.0.md for ${tag}; using the sync date for lastReviewed`,
  );
  return new Date().toISOString().slice(0, 10);
}

function frontmatter(page, tag, lastReviewed, extra = {}) {
  const fields = [
    "---",
    `title: ${JSON.stringify(page.title)}`,
    `description: ${JSON.stringify(page.description)}`,
    "audience: both",
    `source: ${JSON.stringify(page.source)}`,
    `specTag: ${JSON.stringify(tag)}`,
    "generated: true",
    `lastReviewed: ${lastReviewed}`,
    ...Object.entries(extra).map(([key, value]) => `${key}: ${value}`),
    "---",
    "",
    "",
  ];
  return fields.join("\n");
}

function banner(tag, sourceUrl) {
  return [
    `> Generated from [\`agentregistrar/spec\`](${sourceUrl}) at \`${tag}\`.`,
    "> Do not edit this page; edit the spec and re-run `pnpm sync:spec`.",
    "",
    "",
  ].join("\n");
}

function buildPage(page, sources, tag, lastReviewed) {
  const sourceBytes = sources.get(page.source);
  const body = transformLinks(sourceBytes.toString("utf8"), page.source, tag);
  const sourceUrl = githubUrl(tag, page.source, "");
  const pageForFrontmatter = {
    ...page,
    source: `spec:${tag}#${page.source}`,
  };
  return [
    frontmatter(pageForFrontmatter, tag, lastReviewed),
    banner(tag, sourceUrl),
    body,
  ].join("");
}

function buildChangelog(sources, tag, lastReviewed) {
  const body = CHANGELOG.sources
    .map((source) => {
      const text = sources.get(source).toString("utf8");
      return demoteHeadings(transformLinks(text, source, tag)).trimEnd();
    })
    .join("\n\n");

  const page = {
    ...CHANGELOG,
    source: `spec:${tag}#release-notes`,
  };
  const sourceUrl = `${SPEC_ORIGIN}/tree/${tag}`;
  return [
    frontmatter(page, tag, lastReviewed, {
      // The two canonical release notes share section titles. The combined
      // changelog keeps their text verbatim, so the duplicate-anchor rule is
      // disabled for this generated page only.
      nimbusDisableRules: '["nimbus/duplicate-heading-text"]',
    }),
    banner(tag, sourceUrl),
    `${body}\n`,
  ].join("");
}

function buildOutputs(sources, tag) {
  const lastReviewed = releaseDate(sources, tag);
  const outputs = PAGES.map((page) => ({
    path: page.output,
    content: buildPage(page, sources, tag, lastReviewed),
  }));
  outputs.push({
    path: CHANGELOG.output,
    content: buildChangelog(sources, tag, lastReviewed),
  });
  outputs.push({
    path: SCHEMA_OUTPUT,
    content: sources.get("agent-signup.schema.json").toString("utf8"),
  });
  return outputs.map((output) => ({
    ...output,
    sha256: sha256(Buffer.from(output.content, "utf8")),
  }));
}

function verifySchema(schemaText) {
  let schema;
  try {
    schema = JSON.parse(schemaText);
  } catch (error) {
    throw new Error(`agent-signup.schema.json is not valid JSON: ${error.message}`);
  }
  if (schema.$id !== CANONICAL_SCHEMA_ID) {
    throw new Error(
      `Schema $id is ${JSON.stringify(schema.$id)}, expected ${CANONICAL_SCHEMA_ID}`,
    );
  }
}

function assertLockMatches(lock, tag, commit, hashes) {
  const problems = [];
  if (lock.tag !== tag) {
    problems.push(`tag: lock ${lock.tag} != fetched ${tag}`);
  }
  if (lock.commit !== commit) {
    problems.push(`commit: lock ${lock.commit} != fetched ${commit}`);
  }
  if (lock.source !== SPEC_ORIGIN) {
    problems.push(`source: lock ${lock.source} != ${SPEC_ORIGIN}`);
  }
  for (const expected of lock.files ?? []) {
    const actual = hashes.find((entry) => entry.path === expected.path);
    if (!actual) {
      problems.push(`${expected.path}: missing from the tarball`);
    } else if (actual.sha256 !== expected.sha256) {
      problems.push(
        `${expected.path}: expected ${expected.sha256}, actual ${actual.sha256}`,
      );
    }
  }
  const lockedPaths = new Set((lock.files ?? []).map((entry) => entry.path));
  for (const actual of hashes) {
    if (!lockedPaths.has(actual.path)) {
      problems.push(`${actual.path}: not in the lock`);
    }
  }
  if (problems.length > 0) {
    throw new Error(
      `The fetched tag does not match spec.lock.json:\n  ${problems.join("\n  ")}\n` +
        "If the tag moved, investigate before changing the lock. A new tag needs `--write --tag <tag>`.",
    );
  }
}

function writeOutputs(outputs) {
  for (const output of outputs) {
    const absolute = join(ROOT, output.path);
    mkdirSync(dirname(absolute), { recursive: true });
    writeFileSync(absolute, output.content);
  }
}

function checkOutputs(lock) {
  if (!Array.isArray(lock.outputs) || lock.outputs.length === 0) {
    throw new Error(
      "spec.lock.json has no generated output hashes. Run `pnpm sync:spec` to create them.",
    );
  }

  const drift = [];
  for (const expected of lock.outputs) {
    const absolute = join(ROOT, expected.path);
    if (!existsSync(absolute)) {
      drift.push(`${expected.path}: missing (expected ${expected.sha256})`);
      continue;
    }
    const actual = sha256(readFileSync(absolute));
    if (actual !== expected.sha256) {
      drift.push(
        `${expected.path}:\n    expected ${expected.sha256}\n    actual   ${actual}`,
      );
    }
  }

  if (drift.length > 0) {
    throw new Error(
      `Generated protocol pages have drifted from spec.lock.json:\n  ${drift.join(
        "\n  ",
      )}\n\nRun \`pnpm sync:spec\` to regenerate them, then review the diff. ` +
        "Never edit a generated page by hand.",
    );
  }

  const schemaPath = join(ROOT, SCHEMA_OUTPUT);
  verifySchema(readFileSync(schemaPath, "utf8"));
}

function printSummary(tag, commit, outputs, generatedAt) {
  console.log(`spec sync: ${tag} @ ${commit}`);
  console.log(`  source: ${SPEC_ORIGIN}`);
  console.log(`  generated_at: ${generatedAt}`);
  for (const output of outputs) {
    console.log(`  ${output.path}  ${output.sha256}`);
  }
}

async function sync({ tag, write }) {
  const lock = existsSync(LOCK_PATH) ? readLock() : null;
  const previousTag = lock?.tag ?? null;

  console.log(`Fetching ${SPEC_REPO} at ${tag} ...`);
  const [commit, tarball] = await Promise.all([
    resolveTagCommit(tag),
    fetchTarball(tag),
  ]);
  const files = extractTarGz(tarball);
  const sources = readSources(files, tag);
  const hashes = sourceHashes(sources);

  verifySchema(sources.get("agent-signup.schema.json").toString("utf8"));

  if (lock && tag === lock.tag) {
    assertLockMatches(lock, tag, commit, hashes);
  }

  const outputs = buildOutputs(sources, tag);
  const generatedAt = new Date().toISOString().replace(/\.\d{3}Z$/, "Z");

  if (!write) {
    console.log(
      `Preview only: ${tag} @ ${commit}. Nothing was written and the lock was not changed.`,
    );
    printSummary(tag, commit, outputs, generatedAt);
    if (previousTag && previousTag !== tag) {
      console.log(`  lock tag would change: ${previousTag} -> ${tag}`);
    }
    return;
  }

  writeOutputs(outputs);
  const nextLock = {
    tag,
    commit,
    source: SPEC_ORIGIN,
    generated_at: generatedAt,
    files: hashes,
    outputs: outputs.map(({ path, sha256 }) => ({ path, sha256 })),
  };
  writeLock(nextLock);

  if (previousTag && previousTag !== tag) {
    console.log(`Lock tag changed: ${previousTag} -> ${tag}`);
  }
  printSummary(tag, commit, outputs, generatedAt);
  console.log("Wrote generated pages and spec.lock.json.");
}

async function main() {
  const options = parseArgs(process.argv.slice(2));

  if (options.mode === "help") {
    usage();
    return;
  }

  if (options.mode === "check") {
    if (options.tag) {
      throw new Error(
        "--check uses the committed lock and cannot preview another tag. Use --tag <tag> without --check.",
      );
    }
    const lock = readLock();
    checkOutputs(lock);
    console.log(
      `spec sync check: ok (${lock.tag} @ ${lock.commit}, ${lock.outputs.length} generated files)`,
    );
    return;
  }

  if (options.mode === "auto" && !options.tag) {
    const lock = readLock();
    checkOutputs(lock);
    console.log(
      `spec sync check: ok (${lock.tag} @ ${lock.commit}, ${lock.outputs.length} generated files)`,
    );
    return;
  }

  const lock = existsSync(LOCK_PATH) ? readLock() : null;
  const tag = options.tag ?? lock?.tag;
  if (!tag) {
    throw new Error(
      "No tag given and spec.lock.json has no tag. Use --write --tag <tag>.",
    );
  }
  await sync({ tag, write: options.write });
}

main().catch((error) => {
  console.error(`spec sync failed: ${error.message}`);
  process.exit(1);
});
