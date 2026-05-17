#!/usr/bin/env node
// scripts/analyze-css.mjs — Project Wallace CSS audit.
//
// Concatenates every .css file under the given path (a directory or a single
// file), feeds the combined string to @projectwallace/css-analyzer, writes the
// full JSON report to `.wallace-report.json`, and prints a headline summary.
//
// Usage:
//   node scripts/analyze-css.mjs dist/assets    # canonical: the shipped bundle
//   node scripts/analyze-css.mjs src            # source-only audit
//   node scripts/analyze-css.mjs path/to/x.css  # a single file
//
// Exit 0 unconditionally — this is a reporter, not a gate. See
// `npm run verify` (fallow) for the JS/TS-side quality gate.

import { readFileSync, readdirSync, statSync, writeFileSync, existsSync } from "node:fs";
import { resolve, join, relative } from "node:path";
import { analyze } from "@projectwallace/css-analyzer";

const REPORT_PATH = resolve(process.cwd(), ".wallace-report.json");

const inputArg = process.argv[2];
if (!inputArg) {
  console.error(
    "[analyze-css] Usage: node scripts/analyze-css.mjs <dir-or-file>\n" +
      "  e.g. node scripts/analyze-css.mjs dist/assets",
  );
  process.exit(2);
}

const inputPath = resolve(process.cwd(), inputArg);
if (!existsSync(inputPath)) {
  console.error(`[analyze-css] Path does not exist: ${inputPath}`);
  if (inputArg.startsWith("dist")) {
    console.error("[analyze-css] Hint: run `npm run build` first to produce the bundle.");
  }
  process.exit(2);
}

/** Collect every .css file under `p` (recursively if a directory). */
function collectCss(p) {
  if (statSync(p).isFile()) return p.endsWith(".css") ? [p] : [];
  return readdirSync(p, { recursive: true, withFileTypes: true })
    .filter((e) => e.isFile() && e.name.endsWith(".css"))
    .map((e) => join(e.parentPath ?? e.path, e.name));
}

const cssFiles = collectCss(inputPath).sort();
if (cssFiles.length === 0) {
  console.error(`[analyze-css] No .css files found under ${inputPath}`);
  process.exit(2);
}

// Concatenate with a `/* === <relative path> === */` separator so the raw
// input we feed the analyzer is still human-readable if we ever need to look.
const combined = cssFiles
  .map((file) => {
    const rel = relative(process.cwd(), file);
    return `/* === ${rel} === */\n${readFileSync(file, "utf8")}`;
  })
  .join("\n\n");

const report = analyze(combined);
writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2));

// ─── Headline summary ─────────────────────────────────────────────────────────

const totalBytes = cssFiles.reduce((sum, f) => sum + statSync(f).size, 0);
const kb = (totalBytes / 1024).toFixed(1);

const ss = report.stylesheet;
const rules = report.rules;
const sel = report.selectors;
const decl = report.declarations;
const props = report.properties;
const vals = report.values;
const at = report.atrules;

console.log(`[analyze-css] Wrote ${relative(process.cwd(), REPORT_PATH)}`);
console.log(`[analyze-css] Input: ${cssFiles.length} file(s), ${kb} KB on disk`);
console.log("");
console.log("Stylesheet");
console.log(`  Source LoC          ${ss.sourceLinesOfCode ?? "?"}`);
console.log(`  Built LoC           ${ss.linesOfCode ?? "?"}`);
console.log(`  Size (bytes)        ${ss.size ?? "?"}`);
console.log(`  Comments            ${ss.comments?.total ?? 0}`);
console.log("Rules / Selectors");
console.log(`  Total rules         ${rules.total ?? "?"}`);
console.log(`  Empty rules         ${rules.empty?.total ?? 0}`);
console.log(`  Total selectors     ${sel.total ?? "?"}`);
console.log(`  Unique selectors    ${sel.totalUnique ?? "?"}`);
console.log(`  Max specificity     ${JSON.stringify(sel.specificity?.max ?? "?")}`);
console.log(`  Max complexity      ${sel.complexity?.max ?? "?"}`);
console.log(`  ID selectors        ${sel.id?.total ?? 0}`);
console.log("Declarations / Properties");
console.log(`  Total declarations  ${decl.total ?? "?"}`);
console.log(`  !important total    ${decl.importants?.total ?? 0}`);
console.log(`  Unique properties   ${props.totalUnique ?? "?"}`);
console.log(`  Prefixed properties ${props.prefixed?.total ?? 0}`);
console.log(`  Custom (--vars) tot ${props.custom?.total ?? 0}`);
console.log("Values");
console.log(`  Colors  (total/uniq) ${vals.colors?.total ?? "?"} / ${vals.colors?.totalUnique ?? "?"}`);
console.log(`  Fonts   (total/uniq) ${vals.fontFamilies?.total ?? "?"} / ${vals.fontFamilies?.totalUnique ?? "?"}`);
console.log(`  Font sizes (uniq)    ${vals.fontSizes?.totalUnique ?? "?"}`);
console.log(`  Animations           ${vals.animations?.durations?.total ?? 0} durations, ${vals.animations?.timingFunctions?.total ?? 0} timings`);
console.log(`  z-indexes (uniq)     ${vals.zindexes?.totalUnique ?? "?"}`);
console.log(`  Prefixed values      ${vals.prefixes?.total ?? 0}`);
console.log("At-rules");
console.log(`  @media     total/uniq ${at.media?.total ?? "?"} / ${at.media?.totalUnique ?? "?"}`);
console.log(`  @keyframes total/uniq ${at.keyframes?.total ?? "?"} / ${at.keyframes?.totalUnique ?? "?"}`);
console.log(`  @font-face total      ${at.fontface?.total ?? 0}`);
console.log(`  @supports  total      ${at.supports?.total ?? 0}`);
console.log(`  @layer     total      ${at.layer?.total ?? 0}`);
console.log(`  @container total      ${at.container?.total ?? 0}`);

// Duplicate-keyframe check (wallace reports each unique name's occurrence
// count under atrules.keyframes.unique).
const kfUnique = at.keyframes?.unique ?? {};
const dupKeyframes = Object.entries(kfUnique).filter(([, n]) => n > 1);
if (dupKeyframes.length > 0) {
  console.log("");
  console.log(`  ⚠ Duplicate keyframe names: ${dupKeyframes.map(([k, n]) => `${k} (${n})`).join(", ")}`);
}

console.log("");
console.log("Full report → .wallace-report.json");
