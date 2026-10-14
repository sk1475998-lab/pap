#!/usr/bin/env node
/**
 * Lightweight secret-pattern gate for project-owned text files.
 * It deliberately redacts matches in output and never prints secret values.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = process.cwd();
const EXCLUDED_DIRS = new Set([
  ".git",
  "node_modules",
  "dist",
  ".output",
  ".wxt",
  "crrrrrrx",
]);
const EXCLUDED_FILES = new Set(["package-lock.json"]);
const TEXT_EXTENSIONS = new Set([
  ".ts", ".tsx", ".js", ".mjs", ".cjs", ".mts", ".cts", ".json", ".jsonl",
  ".md", ".txt", ".yml", ".yaml", ".env", ".example", ".onerc", ".sh", ".ps1", ".cmd",
]);
const PATTERNS = [
  ["OpenAI/OpenRouter-style key", /\bsk-(?:or-v1-)?[A-Za-z0-9_-]{16,}\b/g],
  ["GitHub token", /\bgh[pousr]_[A-Za-z0-9_]{20,}\b/g],
  ["Google API key", /\bAIza[0-9A-Za-z_-]{20,}\b/g],
  ["AWS access key", /\bAKIA[0-9A-Z]{16}\b/g],
  ["private-key block", /-----BEGIN (?:[A-Z ]+ )?PRIVATE KEY-----/g],
];

function isTextFile(path) {
  const name = path.split("/").pop() ?? "";
  if ([".gitignore", ".onerc", "Dockerfile", "Makefile"].includes(name)) return true;
  const dot = name.lastIndexOf(".");
  return dot >= 0 && TEXT_EXTENSIONS.has(name.slice(dot));
}

function walk(dir) {
  const files = [];
  for (const entry of readdirSync(dir)) {
    if (EXCLUDED_DIRS.has(entry)) continue;
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) files.push(...walk(full));
    else if (stat.isFile() && isTextFile(full)) files.push(full);
  }
  return files;
}

export function scanText(text) {
  const matches = [];
  for (const [kind, pattern] of PATTERNS) {
    pattern.lastIndex = 0;
    for (const match of text.matchAll(pattern)) {
      const line = text.slice(0, match.index).split("\n").length;
      matches.push({ kind, line });
    }
  }
  return matches;
}

function main() {
  if (process.argv.includes("--self-test")) {
    const synthetic = `ONE_SECRET=${["sk", "or-v1", "abcdefghijklmnopqrstuvwxyz123456"].join("-")}`;
    const matches = scanText(synthetic);
    if (matches.length !== 1 || matches[0].kind !== "OpenAI/OpenRouter-style key") {
      throw new Error("Secret scanner self-test failed.");
    }
    console.log("Secret scanner self-test passed; synthetic secret was not printed.");
    return;
  }

  const findings = [];
  for (const file of walk(ROOT)) {
    const rel = relative(ROOT, file);
    if (EXCLUDED_FILES.has(rel)) continue;
    let text;
    try {
      text = readFileSync(file, "utf8");
    } catch {
      continue;
    }
    for (const finding of scanText(text)) findings.push({ file: rel, ...finding });
  }

  if (findings.length) {
    console.error(`Secret scan failed: ${findings.length} possible credential pattern(s).`);
    for (const finding of findings) {
      console.error(`- ${finding.file}:${finding.line} — ${finding.kind} [REDACTED]`);
    }
    process.exitCode = 1;
    return;
  }
  console.log("Secret scan passed: no configured credential patterns found in project-owned text files.");
}

main();
