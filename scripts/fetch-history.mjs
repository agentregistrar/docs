#!/usr/bin/env node
/**
 * Ensure the build has full git history.
 *
 * Nimbus reads each page's last commit date for the sitemap `lastmod` and the
 * "last updated" line. A shallow checkout silently drops both. This gate runs
 * in `prebuild`: if the checkout is shallow, it fetches the full history; if it
 * cannot, the build fails instead of shipping a sitemap without dates.
 */

import { execFileSync } from "node:child_process";

function git(args) {
  return execFileSync("git", args, { encoding: "utf8" }).trim();
}

let shallow;

try {
  shallow = git(["rev-parse", "--is-shallow-repository"]);
} catch {
  console.log("fetch-history: git is unavailable; leaving the checkout unchanged.");
  process.exit(0);
}

if (shallow !== "true") {
  console.log("fetch-history: full git history is present.");
  process.exit(0);
}

console.log("fetch-history: shallow checkout; fetching full history for sitemap dates.");

try {
  execFileSync("git", ["fetch", "--unshallow", "--quiet"], {
    stdio: "inherit",
  });
} catch {
  console.error(
    "fetch-history: could not unshallow the checkout. Run `git fetch --unshallow` or configure the build to fetch full history; the sitemap would otherwise ship without lastmod.",
  );
  process.exit(1);
}

console.log("fetch-history: full git history is ready.");
