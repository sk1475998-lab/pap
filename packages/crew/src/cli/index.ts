#!/usr/bin/env node
/**
 * Super Job Agent — Crew CLI.
 *
 * Run the multi-agent pipeline once or on a schedule.
 *
 *   superjob run --keywords "backend engineer" --dry-run
 *   superjob schedule --keywords "python developer" --interval 360
 *
 * Reads your profile from the shared core store (set it in the extension first).
 */
import { parseArgs } from "node:util";
import { readFileSync, existsSync } from "node:fs";
import {
  createJobSearchCrew,
  createScheduler,
  UrlListSource,
  type SearchRequest,
  type LogEntry,
  type CrewHooks,
} from "../index.js";
import {
  readProfile,
  DEFAULT_LLM_CONFIG,
  parseEnvBool,
  type Profile,
  type LLMConfig,
} from "@superjob/core";

const { values, positionals } = parseArgs({
  options: {
    keywords: { type: "string" },
    location: { type: "string" },
    "min-score": { type: "string" },
    max: { type: "string" },
    limit: { type: "string" },
    "dry-run": { type: "boolean", default: true },
    interval: { type: "string" },
    runs: { type: "string" },
    urls: { type: "string" },
    provider: { type: "string" },
    scrape: { type: "boolean", default: false },
    boards: { type: "string" },
    "company-boards": { type: "string" },
  },
  allowPositionals: true,
  strict: false,
});

async function main() {
  const cmd = positionals[0] ?? "help";

  const profile = await readProfile<Profile>();
  if (!profile) {
    console.error("No profile found. Add your resume via the extension first.");
    process.exit(1);
  }

  const { getStore } = await import("@superjob/core");
  const llmConfig: LLMConfig = {
    ...DEFAULT_LLM_CONFIG,
    ...((await getStore().get<Partial<LLMConfig>>("llmConfig")) ?? {}),
  };
  if (values.provider) llmConfig.provider = values.provider as LLMConfig["provider"];

  const urlsFile = typeof values.urls === "string" ? values.urls : undefined;
  const urls = urlsFile && existsSync(urlsFile)
    ? readFileSync(urlsFile, "utf-8").split("\n").map((l) => l.trim()).filter((l) => l && !l.startsWith("#"))
    : [];

  const search: SearchRequest = {
    keywords: String(values.keywords ?? "software engineer"),
    location: String(values.location ?? "Remote"),
    limit: Number(values.limit ?? 25),
    minScore: Number(values["min-score"] ?? 50),
    dryRun: values["dry-run"] !== undefined
      ? parseEnvBool(values["dry-run"], true)
      : parseEnvBool(process.env.DRY_RUN, true),
    maxApplications: Number(values.max ?? 5),
    urls: urls.length ? urls : undefined,
  };

  // Build the job source:
  //   --scrape     → live scraping from job boards (RemoteOK, Arbeitnow, Indeed...)
  //   --urls file  → curated URL list
  //   neither      → empty (for manual review mode)
  let source;
  if (values.scrape) {
    const { createScraperSource } = await import("@superjob/scraper");
    const boards = typeof values.boards === "string"
      ? values.boards.split(",").map((b) => b.trim()).filter(Boolean)
      : ["arbeitnow", "remoteok"];
    const companyBoards = typeof values["company-boards"] === "string"
      ? values["company-boards"].split(",").map((b) => b.trim()).filter(Boolean)
      : undefined;
    source = createScraperSource({ boards, companyBoards, delayMs: 400 });
    console.log(`🔍 Scraper enabled: ${boards.join(", ")}${companyBoards ? ` + ${companyBoards.join(", ")} company boards` : ""}`);
  } else if (urls.length) {
    source = new UrlListSource(urls);
  } else {
    source = new UrlListSource([]);
  }
  const crew = createJobSearchCrew(source);

  const printLog = (entry: LogEntry) => {
    const icon = entry.level === "error" ? "❌" : entry.level === "warn" ? "⚠️ " : "  ";
    console.log(`${icon} ${entry.message}`);
  };

  const hooks: CrewHooks = {
    onAgentStart: (a: string) => console.log(`\n▶  ${a}`),
    onAgentDone: (a: string, s: string) => console.log(`   ✔ ${s}`),
    onLog: printLog,
  };

  if (cmd === "run") {
    console.log(`\n🚀 Running crew "${crew.name}" ${search.dryRun ? "(DRY-RUN)" : "(LIVE)"}\n`);
    const result = await crew.kickoff({ profile, llmConfig, searchParams: search }, hooks);
    console.log(`\n${"═".repeat(50)}`);
    console.log(`  ${result.summary}`);
    console.log(`${"═".repeat(50)}\n`);
    return;
  }

  if (cmd === "schedule") {
    const intervalMs = Number(values.interval ?? 360) * 60 * 1000; // minutes → ms
    const maxRuns = Number(values.runs ?? 0);

    console.log(`\n⏰ Scheduling crew every ${Number(values.interval ?? 360)} min`);
    console.log(`   ${maxRuns ? `${maxRuns} runs` : "infinite"} — Ctrl+C to stop\n`);

    const scheduler = createScheduler(crew, {
      intervalMs,
      search,
      profile,
      llmConfig,
      maxRuns,
      onRunStart: (n) => console.log(`\n${"═".repeat(50)}\n  RUN #${n}\n${"═".repeat(50)}`),
      onRunComplete: (s) => console.log(`\n✅ ${s}`),
      onLog: printLog,
    });
    scheduler.start();

    // keep alive
    return new Promise(() => {});
  }

  // help
  console.log(`Super Job Agent — Crew CLI

Run the multi-agent pipeline (Researcher → Scorer → Tailor → Applier).

USAGE:
  superjob run       run the crew once
  superjob schedule  run the crew on a recurring interval

DISCOVERY MODES:
  --scrape              live scraping from job boards (RemoteOK, Arbeitnow, Indeed)
  --urls <file>         curated job URLs (one per line)
  (neither)             empty — for manual review mode

OPTIONS:
  --keywords <str>      search keywords          (default: "software engineer")
  --location <str>      search location          (default: "Remote")
  --min-score <n>       minimum match score      (default: 50)
  --max <n>             max applications         (default: 5)
  --limit <n>           max jobs to discover     (default: 25)
  --dry-run             preview without applying (default: true)
  --provider <str>      LLM provider override

SCRAPE OPTIONS:
  --boards <a,b,c>      which boards: arbeitnow,remoteok,indeed,greenhouse,lever
  --company-boards <a,b> company slugs for greenhouse/lever (e.g. airbnb,stripe)

SCHEDULE OPTIONS:
  --interval <min>      minutes between runs     (default: 360 = 6 hours)
  --runs <n>            stop after N runs        (default: 0 = infinite)

EXAMPLES:
  superjob run --scrape --keywords "react developer" --min-score 70
  superjob run --urls jobs.txt --max 10
  superjob run --scrape --boards greenhouse --company-boards airbnb,stripe
  superjob schedule --scrape --keywords "python" --interval 180 --runs 4`);
}

main().catch((e) => {
  console.error("Error:", e instanceof Error ? e.message : e);
  process.exit(1);
});
