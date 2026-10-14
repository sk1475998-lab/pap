/**
 * Docker structure validator — runs without Docker CLI to verify that
 * all files referenced by the Dockerfile/compose exist and the API
 * server compiles. Useful in CI or when Docker isn't installed.
 */
import { existsSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

let pass = 0;
let fail = 0;
function check(name: string, cond: boolean, extra = "") {
  if (cond) { pass++; console.log(`  ✓ ${name}`); }
  else { fail++; console.error(`  ✗ ${name} ${extra}`); }
}

console.log("Validating Docker deployment structure...\n");

// Dockerfile references
const dockerfile = readFileSync(join(root, "docker/Dockerfile"), "utf-8");
check("Dockerfile exists", dockerfile.length > 0);

const requiredPaths = [
  "package.json",
  "tsconfig.base.json",
  "packages/core/package.json",
  "packages/core/src",
  "packages/applier/package.json",
  "packages/applier/src",
  "packages/crew/package.json",
  "packages/crew/src",
  "packages/scraper/package.json",
  "packages/scraper/src",
  "packages/email-monitor/package.json",
  "packages/email-monitor/src",
  "docker/entrypoint.sh",
  "docker/api-server.ts",
  "docker/compose.yml",
  "docker/.dockerignore",
];
for (const p of requiredPaths) {
  check(`exists: ${p}`, existsSync(join(root, p)));
}

// compose.yml references Dockerfile
const compose = readFileSync(join(root, "docker/compose.yml"), "utf-8");
check("compose references Dockerfile", compose.includes("Dockerfile"));
check("compose defines volume", compose.includes("superjob-data"));
check("compose exposes 3000", compose.includes("3000"));
check("compose has restart policy", compose.includes("restart"));

// entrypoint is executable (has shebang)
const entry = readFileSync(join(root, "docker/entrypoint.sh"), "utf-8");
check("entrypoint has shebang", entry.startsWith("#!/bin/bash"));
check("entrypoint supports schedule mode", entry.includes("schedule"));
check("entrypoint supports serve mode", entry.includes("serve"));
check("entrypoint supports both mode", entry.includes("both"));
check("entrypoint has graceful shutdown", entry.includes("SIGTERM"));
check("entrypoint passes --scrape", entry.includes("--scrape"));
check("entrypoint starts email monitor", entry.includes("email-monitor"));

// API server has endpoints
const api = readFileSync(join(root, "docker/api-server.ts"), "utf-8");
check("API has health endpoint", api.includes("/api/health"));
check("API has applications endpoint", api.includes("/api/applications"));
check("API has profile endpoint", api.includes("/api/profile"));
check("API has profile import", api.includes('req.method === "POST"'));
check("API has run trigger", api.includes("/api/run"));
check("API uses scraper source", api.includes("createJobSourceFromEnv"));
check(
  "API serves dashboard",
  api.includes("const pathname = url.pathname") && api.includes('pathname === "/"'),
);
check("API uses no external deps (http module)", api.includes('node:http'));

check("env-config exists", existsSync(join(root, "docker/env-config.ts")));

console.log(`\nDocker validation: ${pass} passed, ${fail} failed.`);
if (fail > 0) process.exitCode = 1;
