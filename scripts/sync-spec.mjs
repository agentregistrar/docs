#!/usr/bin/env node
/**
 * Sync the pinned `agentregistrar/spec` revision into the docs content tree.
 *
 * The spec repository is canonical. This script downloads a tag or commit
 * tarball, verifies the commit through the GitHub API, verifies every source
 * file against `spec.lock.json`, and writes the generated pages.
 *
 * Commands:
 *
 *   pnpm sync:spec                 # re-sync the lock's pin and write
 *   pnpm sync:spec:check           # offline drift check (runs before the build)
 *   node scripts/sync-spec.mjs --tag v1.2.0
 *                                  # preview a tag in memory; writes nothing
 *   node scripts/sync-spec.mjs --write --tag v1.2.0
 *                                  # sync and update the lock to the new tag
 *   node scripts/sync-spec.mjs --commit <sha> [--ref main] [--tag v1.1.0]
 *                                  # preview an immutable commit pin
 *   node scripts/sync-spec.mjs --write --commit <sha> --ref main
 *                                  # pin the lock to that commit
 *
 * A tag pin is the normal release pin. A commit pin is for a docs-only refresh
 * on a branch that is not published as its own tag: the lock keeps the protocol
 * release identity in `tag`, records `ref`, `commit` and a `note`, and every
 * generated page names the exact source commit. The archive is fetched by
 * commit SHA in that mode, so a moving branch cannot change the bytes.
 *
 * `--check` never uses the network. It verifies the committed output hashes in
 * `spec.lock.json` against the generated files on disk. The tag/commit and
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
  // `auto` means: check when no pin is given, preview when one is given.
  const options = {
    mode: "auto",
    tag: null,
    commit: null,
    ref: null,
    note: null,
    write: false,
  };
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
    } else if (arg === "--commit") {
      const commit = argv[i + 1];
      if (!commit || commit.startsWith("--")) {
        throw new Error("--commit needs a full 40-character commit SHA");
      }
      options.commit = commit;
      i += 1;
    } else if (arg === "--ref") {
      const ref = argv[i + 1];
      if (!ref || ref.startsWith("--")) {
        throw new Error("--ref needs a value, for example --ref main");
      }
      options.ref = ref;
      i += 1;
    } else if (arg === "--note") {
      const note = argv[i + 1];
      if (!note || note.startsWith("--")) {
        throw new Error("--note needs a value");
      }
      options.note = note;
      i += 1;
    } else if (arg === "--help" || arg === "-h") {
      options.mode = "help";
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }
  if (options.commit && !/^[0-9a-f]{40}$/i.test(options.commit)) {
    throw new Error("--commit needs a full 40-character commit SHA");
  }
  return options;
}

function usage() {
  console.log(`Sync the pinned agentregistrar/spec revision into the docs tree.

  node scripts/sync-spec.mjs                 offline check (default)
  node scripts/sync-spec.mjs --check         offline check
  node scripts/sync-spec.mjs --write         fetch, verify, write pages and lock
  node scripts/sync-spec.mjs --tag <tag>     preview a tag; writes nothing
  node scripts/sync-spec.mjs --write --tag <tag>
                                             sync and update the lock to <tag>
  node scripts/sync-spec.mjs --commit <sha>  preview a commit pin
  node scripts/sync-spec.mjs --write --commit <sha> [--ref <ref>] [--tag <tag>]
                                             pin the lock to that commit
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

async function fetchTarball(pin) {
  const url =
    pin.kind === "commit"
      ? `https://codeload.github.com/${SPEC_REPO}/tar.gz/${pin.commit}`
      : `https://codeload.github.com/${SPEC_REPO}/tar.gz/refs/tags/${encodeURIComponent(pin.tag)}`;
  const response = await fetch(url, {
    headers: { "User-Agent": USER_AGENT },
  });
  if (!response.ok) {
    throw new Error(`Tarball download failed: ${response.status} for ${url}`);
  }
  return Buffer.from(await response.arrayBuffer());
}

/**
 * Verify a commit pin through the GitHub API. A tag pin is resolved from the
 * tag ref; a commit pin is immutable, so the API must echo the same SHA.
 */
async function resolveCommit(pin) {
  if (pin.kind === "commit") {
    const commit = await getJson(`${API_ROOT}/commits/${pin.commit}`);
    if (commit?.sha !== pin.commit) {
      throw new Error(
        `Commit ${pin.commit} resolved to ${commit?.sha ?? "nothing"}`,
      );
    }
    return pin.commit;
  }
  return resolveTagCommit(pin.tag);
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

function readSources(files, label) {
  const root = archiveRoot(files);
  const sources = new Map();
  for (const path of SOURCE_FILES) {
    const bytes = files.get(`${root}/${path}`);
    if (!bytes) {
      throw new Error(`${label} is missing ${path}`);
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

/**
 * Immutable GitHub URL for a spec file. Links point at the pinned commit, not a
 * tag name, so the rendered page and the source bytes always agree.
 */
function githubUrl(commit, path, anchor, kind = "blob") {
  return `${SPEC_ORIGIN}/${kind}/${commit}/${path}${anchor ? `#${anchor}` : ""}`;
}

/**
 * Rewrite one markdown link destination. Absolute URLs, protocol-relative URLs
 * and pure anchors are left alone. Everything else is resolved against the
 * source file's directory and mapped to a docs page or a GitHub tag URL.
 */
function rewriteDestination(destination, sourcePath, commit) {
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
  return githubUrl(commit, clean, anchor, isDirectory ? "tree" : "blob");
}

function transformLinks(text, sourcePath, commit) {
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
          `](${rewriteDestination(destination, sourcePath, commit)}${suffix})`,
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

function frontmatter(page, pin, lastReviewed, extra = {}) {
  const fields = [
    "---",
    `title: ${JSON.stringify(page.title)}`,
    `description: ${JSON.stringify(page.description)}`,
    "audience: both",
    `source: ${JSON.stringify(page.source)}`,
    `specTag: ${JSON.stringify(pin.tag)}`,
    ...(pin.ref ? [`sourceRef: ${JSON.stringify(pin.ref)}`] : []),
    ...(pin.note ? [`sourceNote: ${JSON.stringify(pin.note)}`] : []),
    "generated: true",
    `lastReviewed: ${lastReviewed}`,
    ...Object.entries(extra).map(([key, value]) => `${key}: ${value}`),
    "---",
    "",
    "",
  ];
  return fields.join("\n");
}

function banner(pin, sourceUrl) {
  const location =
    pin.kind === "commit"
      ? `commit \`${pin.commit}\`${pin.ref ? ` on \`${pin.ref}\`` : ""}`
      : `\`${pin.tag}\``;
  const identity =
    pin.kind === "commit" ? `protocol release \`${pin.tag}\`` : `tag \`${pin.tag}\``;
  return [
    `> Generated from [\`agentregistrar/spec\`](${sourceUrl}) at ${location} (${identity}).`,
    ...(pin.note ? [`> Source note: ${pin.note}`] : []),
    "> Do not edit this page; edit the spec and re-run `pnpm sync:spec`.",
    "",
    "",
  ].join("\n");
}

function buildPage(page, sources, pin, lastReviewed) {
  const sourceBytes = sources.get(page.source);
  const body = transformLinks(
    sourceBytes.toString("utf8"),
    page.source,
    pin.commit,
  );
  const sourceUrl = githubUrl(pin.commit, page.source, "");
  const pageForFrontmatter = {
    ...page,
    source: `spec:${pin.tag}#${page.source}`,
  };
  return [
    frontmatter(pageForFrontmatter, pin, lastReviewed),
    banner(pin, sourceUrl),
    body,
  ].join("");
}

function buildChangelog(sources, pin, lastReviewed) {
  const body = CHANGELOG.sources
    .map((source) => {
      const text = sources.get(source).toString("utf8");
      return demoteHeadings(transformLinks(text, source, pin.commit)).trimEnd();
    })
    .join("\n\n");

  const page = {
    ...CHANGELOG,
    source: `spec:${pin.tag}#release-notes`,
  };
  const sourceUrl = `${SPEC_ORIGIN}/tree/${pin.commit}`;
  return [
    frontmatter(page, pin, lastReviewed, {
      // The two canonical release notes share section titles. The combined
      // changelog keeps their text verbatim, so the duplicate-anchor rule is
      // disabled for this generated page only.
      nimbusDisableRules: '["nimbus/duplicate-heading-text"]',
    }),
    banner(pin, sourceUrl),
    `${body}\n`,
  ].join("");
}

function buildOutputs(sources, pin) {
  const lastReviewed = releaseDate(sources, pin.tag);
  const outputs = PAGES.map((page) => ({
    path: page.output,
    content: buildPage(page, sources, pin, lastReviewed),
  }));
  outputs.push({
    path: CHANGELOG.output,
    content: buildChangelog(sources, pin, lastReviewed),
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

function assertLockMatches(lock, pin, hashes) {
  const problems = [];
  if (lock.tag !== pin.tag) {
    problems.push(`tag: lock ${lock.tag} != fetched ${pin.tag}`);
  }
  if (lock.commit !== pin.commit) {
    problems.push(`commit: lock ${lock.commit} != fetched ${pin.commit}`);
  }
  if (pin.ref && lock.ref !== pin.ref) {
    problems.push(`ref: lock ${lock.ref ?? "(none)"} != fetched ${pin.ref}`);
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
      `The fetched revision does not match spec.lock.json:\n  ${problems.join("\n  ")}\n` +
        "If the source changed, investigate before changing the lock. A new tag needs `--write --tag <tag>`; a commit pin needs `--write --commit <sha>`.",
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

function printSummary(pin, outputs, generatedAt) {
  const pinLabel =
    pin.kind === "commit"
      ? `${pin.ref ?? "commit"}:${pin.commit}`
      : pin.commit;
  console.log(`spec sync: ${pin.tag} @ ${pinLabel}`);
  console.log(`  source: ${SPEC_ORIGIN}`);
  if (pin.note) console.log(`  note: ${pin.note}`);
  console.log(`  generated_at: ${generatedAt}`);
  for (const output of outputs) {
    console.log(`  ${output.path}  ${output.sha256}`);
  }
}

async function sync(inputPin, write) {
  const lock = existsSync(LOCK_PATH) ? readLock() : null;
  const previousPin = lock ? `${lock.tag}@${lock.commit}` : null;

  if (inputPin.kind === "commit" && !inputPin.tag) {
    throw new Error(
      "A commit pin needs a protocol tag for the lock. Pass `--tag <tag>` or keep a lock with `tag`.",
    );
  }

  const label =
    inputPin.kind === "commit"
      ? `commit ${inputPin.commit}`
      : `tag ${inputPin.tag}`;
  console.log(`Fetching ${SPEC_REPO} at ${label} ...`);
  const [commit, tarball] = await Promise.all([
    resolveCommit(inputPin),
    fetchTarball(inputPin),
  ]);
  const pin = { ...inputPin, commit };
  const files = extractTarGz(tarball);
  const sources = readSources(files, label);
  const hashes = sourceHashes(sources);

  verifySchema(sources.get("agent-signup.schema.json").toString("utf8"));

  const samePin = lock
    ? pin.kind === "commit"
      ? lock.commit === pin.commit
      : lock.tag === pin.tag && !lock.ref
    : false;
  if (samePin) {
    assertLockMatches(lock, pin, hashes);
  }

  const outputs = buildOutputs(sources, pin);
  const generatedAt = new Date().toISOString().replace(/\.\d{3}Z$/, "Z");

  if (!write) {
    console.log(
      `Preview only: ${pin.tag} @ ${commit}. Nothing was written and the lock was not changed.`,
    );
    printSummary(pin, outputs, generatedAt);
    if (previousPin && previousPin !== `${pin.tag}@${commit}`) {
      console.log(
        `  lock pin would change: ${previousPin} -> ${pin.tag}@${commit}`,
      );
    }
    return;
  }

  writeOutputs(outputs);
  const nextLock = {
    tag: pin.tag,
    ...(pin.ref ? { ref: pin.ref } : {}),
    commit,
    ...(pin.note ? { note: pin.note } : {}),
    source: SPEC_ORIGIN,
    generated_at: generatedAt,
    files: hashes,
    outputs: outputs.map(({ path, sha256 }) => ({ path, sha256 })),
  };
  writeLock(nextLock);

  if (previousPin && previousPin !== `${pin.tag}@${commit}`) {
    console.log(`Lock pin changed: ${previousPin} -> ${pin.tag}@${commit}`);
  }
  printSummary(pin, outputs, generatedAt);
  console.log("Wrote generated pages and spec.lock.json.");
}

function pinFromOptions(options, lock) {
  if (options.commit) {
    return {
      kind: "commit",
      commit: options.commit,
      tag: options.tag ?? lock?.tag ?? null,
      ref: options.ref ?? lock?.ref ?? null,
      note: options.note ?? lock?.note ?? null,
    };
  }
  if (options.tag) return { kind: "tag", tag: options.tag };
  if (lock?.ref) {
    return {
      kind: "commit",
      commit: lock.commit,
      tag: lock.tag,
      ref: lock.ref,
      note: lock.note ?? null,
    };
  }
  if (lock?.tag) return { kind: "tag", tag: lock.tag };
  throw new Error(
    "No tag or commit and spec.lock.json is missing. Use `--write --tag <tag>` or `--write --commit <sha> --tag <tag>`.",
  );
}

async function main() {
  const options = parseArgs(process.argv.slice(2));

  if (options.mode === "help") {
    usage();
    return;
  }

  if (options.mode === "check") {
    if (options.tag || options.commit || options.ref || options.note) {
      throw new Error(
        "--check uses the committed lock and cannot preview another revision. Omit --check to preview.",
      );
    }
    const lock = readLock();
    checkOutputs(lock);
    const pinLabel = lock.ref ?? "tag";
    console.log(
      `spec sync check: ok (${lock.tag} @ ${pinLabel}:${lock.commit}, ${lock.outputs.length} generated files)`,
    );
    return;
  }

  if (options.mode === "auto" && !options.tag && !options.commit) {
    const lock = readLock();
    checkOutputs(lock);
    const pinLabel = lock.ref ?? "tag";
    console.log(
      `spec sync check: ok (${lock.tag} @ ${pinLabel}:${lock.commit}, ${lock.outputs.length} generated files)`,
    );
    return;
  }

  const lock = existsSync(LOCK_PATH) ? readLock() : null;
  await sync(pinFromOptions(options, lock), options.write);
}

main().catch((error) => {
  console.error(`spec sync failed: ${error.message}`);
  process.exit(1);
});
