#!/usr/bin/env node
// scripts/check-no-external-deps.mjs — post-build guard.
//
// Fails the build if `dist/index.html` references any cross-origin resource
// (i.e. a URL whose scheme is `http:` or `https:`) without an `integrity=`
// attribute. VoidHop intentionally ships zero cross-origin dependencies so
// that a compromised CDN cannot inject exfiltration code; this guard catches
// an accidental third-party include before it reaches users.
//
// Scope: only inspects `index.html`. Bundle chunks under `dist/assets/` are
// fingerprinted, served from our own origin, and bound by `script-src 'self'`
// in `public/_headers`, so they do not need additional integrity attributes.

import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const INDEX_PATH = resolve(process.cwd(), "dist", "index.html");

if (!existsSync(INDEX_PATH)) {
  console.error(
    `[check-no-external-deps] ${INDEX_PATH} does not exist — did you forget to run \`vite build\`?`,
  );
  process.exit(2);
}

const html = readFileSync(INDEX_PATH, "utf8");

// Match any of: <script src="...">, <link href="...">, <img src="...">.
// We deliberately keep the regex simple; the output of vite is regular enough
// that full HTML parsing is overkill.
const TAG_RE = /<(script|link|img)\b[^>]*>/gi;
const URL_ATTR_RE = /\b(src|href)\s*=\s*"([^"]+)"/i;
const INTEGRITY_RE = /\bintegrity\s*=\s*"[^"]+"/i;

const problems = [];
for (const match of html.matchAll(TAG_RE)) {
  const tag = match[0];
  const urlAttr = URL_ATTR_RE.exec(tag);
  if (!urlAttr) continue;
  const url = urlAttr[2];
  if (!/^https?:/i.test(url)) continue; // relative / data: / protocol-relative handled elsewhere
  if (INTEGRITY_RE.test(tag)) continue;
  problems.push({ tag, url });
}

if (problems.length > 0) {
  console.error(
    "[check-no-external-deps] FAIL: dist/index.html contains cross-origin " +
      "resources without an integrity= attribute. VoidHop's privacy model " +
      "requires every HTML resource reference to be self-hosted or pinned " +
      "with SRI. Offending tags:",
  );
  for (const { url, tag } of problems) {
    console.error(`  - ${url}`);
    console.error(`      ${tag}`);
  }
  process.exit(1);
}

console.log(
  "[check-no-external-deps] OK — no external resources without integrity=",
);
