#!/usr/bin/env node
/**
 * Super Job Agent — Scraper CLI.
 *
 * Discover real jobs from multiple boards. No auth required for the free APIs.
 *
 *   superjob search --keywords "python developer" --limit 20
 *   superjob search --keywords "react" --boards arbeitnow,remoteok --json
 *   superjob search --company-boards airbnb,stripe --boards greenhouse,lever
 */
import { parseArgs } from "node:util";
import { createScraperSource } from "../index.js";
import type { Job } from "@superjob/core";

const { values } = parseArgs({
  options: {
    keywords: { type: "string", default: "software engineer" },
    location: { type: "string", default: "Remote" },
    limit: { type: "string", default: "20" },
    boards: { type: "string", default: "arbeitnow,remoteok" },
    "company-boards": { type: "string" },
    json: { type: "boolean", default: false },
    delay: { type: "string", default: "500" },
  },
  allowPositionals: true,
  strict: false,
});

async function main() {
  const keywords = String(values.keywords);
  const location = String(values.location);
  const limit = Number(values.limit);
  const boards = String(values.boards).split(",").map((b) => b.trim()).filter(Boolean);
  const companyBoards = values["company-boards"]
    ? String(values["company-boards"]).split(",").map((b) => b.trim()).filter(Boolean)
    : undefined;
  const delayMs = Number(values.delay);

  console.error(`🔍 Searching ${boards.join(", ")} for "${keywords}" in ${location}…\n`);

  const source = createScraperSource({ boards, companyBoards, delayMs });
  const jobs = await source.discover(keywords, location, limit);

  if (jobs.length === 0) {
    console.error("No jobs found. Try different keywords or add more boards.");
    process.exit(0);
  }

  if (values.json) {
    console.log(JSON.stringify(jobs, null, 2));
  } else {
    console.log(`Found ${jobs.length} jobs:\n`);
    console.log("─".repeat(90));
    for (const job of jobs) {
      console.log(`  ${job.title.slice(0, 45).padEnd(45)} │ ${job.company.slice(0, 20).padEnd(20)} │ ${job.source}`);
      console.log(`  ${" ".repeat(45)} │ ${job.location.slice(0, 20).padEnd(20)} │ ${job.url.slice(0, 60)}`);
      console.log("─".repeat(90));
    }
    console.log(`\n${jobs.length} jobs from ${new Set(jobs.map((j) => j.source)).size} source(s).`);
  }
}

main().catch((e) => {
  console.error("Error:", e instanceof Error ? e.message : e);
  process.exit(1);
});
