#!/usr/bin/env node
/**
 * Build-integrity guard for the produced Chrome MV3 bundle.
 *
 * Verifies that every emitted JS entry in .output/chrome-mv3:
 *   1. decodes as strict UTF-8, and
 *   2. contains no Unicode noncharacters (U+FDD0..U+FDEF and U+xFFFE/U+xFFFF).
 *
 * Background: Chrome's content-script loader (chrome.scripting.executeScript)
 * rejects a file whose bytes contain a literal noncharacter with
 * "Could not load file '...'. It isn't UTF-8 encoded." — even though the file
 * is technically valid UTF-8. esbuild's default "utf8" charset constant-folds
 * authored escapes such as "\uffff" (and even String.fromCharCode(0xffff))
 * into the *literal* U+FFFF byte sequence, which silently breaks every dynamic
 * injection (this happened to content-scripts/agent.js). The fix lives in
 * wxt.config.ts (esbuild charset: "ascii"); this script is the regression net
 * that fails the build pipeline if it ever regresses.
 */
import { readdirSync, readFileSync, existsSync, statSync } from "node:fs";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const outDir = join(repoRoot, "packages/extension/.output/chrome-mv3");

const NONCHAR_RE = /[\u{FDD0}-\u{FDEF}\u{FFFE}\u{FFFF}]/u;

function walkJs(dir) {
  if (!existsSync(dir)) return [];
  const out = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) {
      out.push(...walkJs(p));
    } else if (/\.(js|mjs)$/.test(name)) {
      out.push(p);
    }
  }
  return out;
}

let failures = 0;
const files = walkJs(outDir).sort();
console.log(`Verifying ${files.length} built JS files under ${outDir}`);
for (const file of files) {
  const buf = readFileSync(file);
  let text;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(buf);
  } catch {
    console.error(`FAIL ${file}: not strict UTF-8`);
    failures++;
    continue;
  }
  const m = NONCHAR_RE.exec(text);
  if (m) {
    console.error(`FAIL ${file}: literal Unicode noncharacter U+${m[0].codePointAt(0).toString(16).toUpperCase()} present`);
    failures++;
  }
}

if (failures > 0) {
  console.error(`\n${failures} file(s) failed the build-integrity check.`);
  console.error("If you see a U+FFFF/U+FFFE failure, look for authored '\\uffff' escapes or");
  console.error("String.fromCharCode(0xffff) that esbuild folded to a literal noncharacter;");
  console.error("wxt.config.ts must keep esbuild.charset = 'ascii'.");
  process.exit(1);
}
console.log("Build-integrity check passed: no noncharacters, all files strict UTF-8.");
