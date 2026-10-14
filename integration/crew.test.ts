/**
 * Multi-agent crew integration test.
 *
 * Proves the full pipeline: Researcher → Scorer → Tailor → Applier
 * collaborate through a shared blackboard, reusing @superjob/core's engine.
 *
 * Uses a StaticJobSource with realistic jobs and a no-LLM config so it
 * runs deterministically with zero external dependencies.
 */
import {
  createJobSearchCrew,
  StaticJobSource,
  type LogEntry,
} from "../packages/crew/src/index.js";
import { createProfile, type Profile, type LLMConfig, type Job } from "@superjob/core";
import { setStore } from "@superjob/core";

// in-memory store so we don't touch the filesystem
const memStore: Record<string, unknown> = {};
setStore({
  async get<T>(key: string) { return memStore[key] as T | undefined; },
  async set<T>(key: string, value: T) { memStore[key] = value; },
  async delete(key: string) { delete memStore[key]; },
  async keys() { return Object.keys(memStore); },
});

let pass = 0;
let fail = 0;
function check(name: string, cond: boolean, extra = "") {
  if (cond) { pass++; } else { fail++; console.error(`  ✗ ${name} ${extra}`); }
}

const PROFILE: Profile = createProfile({
  firstName: "Jane",
  lastName: "Doe",
  email: "jane@example.com",
  skills: ["python", "react", "typescript", "postgresql", "aws", "docker", "kubernetes"],
  masterResumeText: `
    Jane Doe — Senior Software Engineer
    8 years building scalable backend systems with Python, PostgreSQL, AWS, Docker, Kubernetes.
    Built React + TypeScript frontends. Led teams. Strong in distributed systems and microservices.
  `,
});

const LLM: LLMConfig = { provider: "none", model: "none" };

// three jobs with varying overlap
const JOBS: Job[] = [
  {
    id: "job_1",
    url: "https://example.com/jobs/1",
    title: "Senior Backend Engineer",
    company: "Acme Corp",
    location: "Remote",
    description: "We need an engineer with Python, PostgreSQL, AWS, Docker, and Kubernetes experience. Microservices and distributed systems required. Terraform is a plus.",
    salary: "",
    remote: true,
    source: "test",
    savedAt: Date.now(),
  },
  {
    id: "job_2",
    url: "https://example.com/jobs/2",
    title: "Frontend Developer",
    company: "DesignHub",
    location: "New York, NY",
    description: "Looking for a React and TypeScript developer. Figma, CSS, animation, accessibility experience needed. No backend work.",
    salary: "",
    remote: false,
    source: "test",
    savedAt: Date.now(),
  },
  {
    id: "job_3",
    url: "https://example.com/jobs/3",
    title: "DevOps Engineer",
    company: "CloudOps",
    location: "Remote",
    description: "Infrastructure engineer with deep Kubernetes, Terraform, Ansible, AWS, GCP experience. CI/CD pipelines, monitoring, and on-call rotation.",
    salary: "",
    remote: true,
    source: "test",
    savedAt: Date.now(),
  },
];

async function main() {
  const crew = createJobSearchCrew(new StaticJobSource(JOBS));

  const log: LogEntry[] = [];
  const result = await crew.kickoff(
    {
      profile: PROFILE,
      llmConfig: LLM,
      searchParams: {
        keywords: "engineer",
        location: "Remote",
        limit: 10,
        minScore: 50,
        dryRun: true,
        maxApplications: 10,
      },
    },
    { onLog: (e) => log.push(e) }
  );

  // --- assertions ---
  console.log("\n=== CREW RUN LOG ===");
  for (const e of log) console.log(`  ${e.level === "error" ? "❌" : "  "} ${e.message}`);

  check("crew completed", result.summary.includes("completed"));
  check("3 jobs discovered", result.discovered === 3, `(got ${result.discovered})`);
  check("3 jobs scored", result.scored === 3, `(got ${result.scored})`);

  const bb = result.blackboard;

  // scorer: the backend job (job_1) should score highest
  const sorted = [...bb.scored].sort((a, z) => z.score - a.score);
  check("backend job scored highest", sorted[0].job.title.includes("Backend"), `(${sorted[0].job.title} = ${sorted[0].score})`);
  check("backend job recommended apply/review", sorted[0].recommendation !== "skip");

  // frontend job should score lower (less overlap)
  const frontend = bb.scored.find((s) => s.job.title.includes("Frontend"))!;
  check("frontend job found", !!frontend);
  check("frontend scores lower than backend", frontend.score < sorted[0].score, `(fe=${frontend.score}, be=${sorted[0].score})`);

  // tailor: cover letters generated for recommended jobs
  const tailoredTitles = bb.tailored.map((t) => t.job.title);
  console.log("\n=== TAILORED OUTPUTS ===");
  for (const t of bb.tailored) {
    console.log(`  ${t.job.title.padEnd(25)} score=${t.score} letter=${t.coverLetter.slice(0, 50)}...`);
  }
  check("cover letters generated", bb.tailored.length > 0);
  check("cover letter mentions company", bb.tailored[0].coverLetter.includes(bb.tailored[0].job.company));

  // applier: dry-run entries logged
  console.log("\n=== APPLIED LOG ===");
  for (const a of bb.applied) {
    console.log(`  ${a.job.title.padEnd(25)} ${a.outcome} [${a.score}]`);
  }
  check("applications processed", bb.applied.length > 0);
  check("dry-run outcome recorded", bb.applied.every((a) => a.outcome === "dry-run-preview" || a.outcome === "queued"));

  // shared store: tracker persisted
  const stored = memStore["applications"] as any[];
  check("tracker persisted", Array.isArray(stored) && stored.length > 0);

  // log: all 4 agents ran
  const agentsRan = new Set(log.filter((e) => e.message.includes("starting")).map((e) => e.message.split(" ")[1]));
  check("researcher ran", agentsRan.has("Researcher"));
  check("scorer ran", agentsRan.has("Scorer"));
  check("tailor ran", agentsRan.has("Tailor"));
  check("applier ran", agentsRan.has("Applier"));

  console.log(`\nCrew integration: ${pass} passed, ${fail} failed.`);
  if (fail > 0) { process.exitCode = 1; throw new Error(`${fail} crew assertions failed`); }
}

main().catch((e) => { console.error(e); process.exit(1); });
