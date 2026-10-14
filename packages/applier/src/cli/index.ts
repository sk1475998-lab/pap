#!/usr/bin/env node
/**
 * Super Job Agent — headless apply CLI.
 *
 * Examples:
 *
 *   # dry-run: fills forms but never submits (recommended first run)
 *   superjob apply --keywords "backend engineer" --location "Remote" --dry-run
 *
 *   # real run on LinkedIn Easy Apply, only jobs scoring 70+
 *   superjob apply --keywords "python developer" --location "New York" \
 *       --min-score 70 --max 5
 *
 *   # apply to a curated list of direct ATS URLs
 *   superjob apply --urls urls.txt --dry-run
 *
 *   # discover only (no applying) — prints jobs + scores
 *   superjob discover --keywords "full stack" --location "Remote"
 *
 *   # login to LinkedIn once (session is saved for reuse)
 *   superjob login
 *
 * Environment:
 *   Set SUPERJOB_LLM_PROVIDER / SUPERJOB_LLM_API_KEY in the extension or
 *   via the core store to enable AI answers for unknown questions.
 */
import { readFileSync, existsSync } from "node:fs";
import { parseArgs } from "node:util";
import { launchBrowser } from "../browser.js";
import { LinkedInAdapter } from "../sources/linkedin.js";
import { createGenericAdapter } from "../sources/generic.js";
import { runPipeline } from "../pipeline.js";
import { DEFAULT_SEARCH, type SearchParams, type BrowserOptions } from "../types.js";

const { values, positionals } = parseArgs({
  options: {
    keywords: { type: "string" },
    location: { type: "string" },
    "min-score": { type: "string" },
    max: { type: "string" },
    limit: { type: "string" },
    "dry-run": { type: "boolean", default: true },
    headless: { type: "boolean", default: false },
    "easy-apply-only": { type: "boolean", default: true },
    remote: { type: "boolean", default: false },
    delay: { type: "string" },
    urls: { type: "string" },
  },
  allowPositionals: true,
  strict: false,
});

function buildParams(): SearchParams {
  const minScore = values["min-score"] ? Number(values["min-score"]) : 0;
  const maxApps = values.max ? Number(values.max) : DEFAULT_SEARCH.maxApplications;
  const limit = values.limit ? Number(values.limit) : DEFAULT_SEARCH.limit;
  const delay = values.delay ? Number(values.delay) : DEFAULT_SEARCH.delayMs;
  return {
    ...DEFAULT_SEARCH,
    keywords: String(values.keywords ?? DEFAULT_SEARCH.keywords),
    location: String(values.location ?? DEFAULT_SEARCH.location),
    minScore,
    maxApplications: maxApps,
    limit,
    dryRun: Boolean(values["dry-run"]),
    easyApplyOnly: values["easy-apply-only"] !== false,
    remoteOnly: Boolean(values.remote),
    delayMs: delay,
  };
}

function buildBrowserOpts(): BrowserOptions {
  return {
    headless: Boolean(values.headless),
    slowMo: 50,
  };
}

async function main() {
  const cmd = positionals[0] ?? "help";

  if (cmd === "login") {
    const { browser, close } = await launchBrowser(buildBrowserOpts());
    const page = await browser.newPage();
    await LinkedInAdapter.ensureLogin(page);
    console.log("✓ Logged in. Session saved.");
    await close();
    return;
  }

  if (cmd === "discover" || cmd === "apply") {
    const params = buildParams();
    const opts = buildBrowserOpts();
    const { browser, close } = await launchBrowser(opts);

    const adapter = values.urls
      ? createGenericAdapter(readUrls(String(values.urls)))
      : LinkedInAdapter;

    if (cmd === "discover") {
      params.maxApplications = 0;
      params.dryRun = true;
    }

    if (params.dryRun) {
      console.log("⚠️  DRY RUN — forms will be filled but NOT submitted.\n");
    }

    const report = await runPipeline(browser, adapter, params, {
      onDiscover: (n) => console.log(`📦 Discovered ${n} jobs`),
      onScore: (title, score) => console.log(`   ${score >= 70 ? "✅" : "⛔"} [${score}] ${title.slice(0, 60)}`),
      onApplyStart: (title) => console.log(`\n📝 Applying: ${title.slice(0, 60)}`),
      onFill: (f, s) => process.stdout.write(`   filled ${f} (${s} skipped)... `),
      onOutcome: (r) => {
        const icon =
          r.outcome === "applied" ? "✅" :
          r.outcome === "dry-run" ? "🟡" :
          r.outcome === "skipped-low-score" ? "⛔" :
          r.outcome === "skipped-already-applied" ? "⏭️" :
          r.outcome === "failed" ? "❌" : "⚠️";
        console.log(`${icon} ${r.outcome} [${r.matchScore}]`);
      },
    });

    await close();

    console.log(`\n${"═".repeat(50)}`);
    console.log(`  PIPELINE COMPLETE (${(report.durationMs / 1000).toFixed(1)}s)`);
    console.log(`${"═".repeat(50)}`);
    console.log(`  Discovered : ${report.discovered}`);
    console.log(`  Scored     : ${report.scored}`);
    console.log(`  Applied    : ${report.applied}`);
    if (report.dryRun) console.log(`  Dry-run    : ${report.dryRun}`);
    console.log(`  Skipped    : ${report.skipped}`);
    console.log(`  Failed     : ${report.failed}`);
    console.log(`${"═".repeat(50)}`);

    return;
  }

  // help
  console.log(`Super Job Agent — Headless Apply CLI

USAGE:
  superjob login                                        log in to LinkedIn (once)
  superjob apply --keywords "..." --location "..."      auto-apply via LinkedIn Easy Apply
  superjob apply --urls urls.txt                        apply to a list of direct URLs
  superjob discover --keywords "..."                    discover + score only (no applying)

OPTIONS:
  --keywords <str>      job search keywords      (default: "software engineer")
  --location <str>      job search location      (default: "Remote")
  --min-score <n>       skip jobs below this %   (default: 0)
  --max <n>             max applications         (default: 10)
  --limit <n>           max jobs to scan         (default: 25)
  --dry-run             fill forms, don't submit
  --headless            run without a visible window
  --remote              remote jobs only
  --no-easy-apply       include non-Easy-Apply jobs
  --delay <ms>          delay between actions    (default: 900)

EXAMPLES:
  superjob apply --keywords "react developer" --location "San Francisco" --dry-run
  superjob apply --keywords "backend engineer" --min-score 75 --max 5
  superjob apply --urls ./job-urls.txt --dry-run

⚠️  Automated job applications may violate a site's Terms of Service.
    Use dry-run first. You are responsible for compliance.`);
}

function readUrls(file?: string): string[] {
  if (!file || !existsSync(file)) return [];
  return readFileSync(file, "utf-8")
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith("#"));
}

main().catch((e) => {
  console.error("Error:", e instanceof Error ? e.message : e);
  process.exit(1);
});
