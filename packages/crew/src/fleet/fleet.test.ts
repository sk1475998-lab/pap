import { test } from "node:test";
import assert from "node:assert/strict";
import { createProfile, type Job, type Profile, type LLMConfig } from "@superjob/core";
import { ApplyFleet } from "./fleet-orchestrator.js";
import { enhanceResumeForJob } from "./resume-enhancer.js";
import { buildLLM } from "./apply-worker.js";
import type { SubmitFn } from "./types.js";

/* ------------------------------------------------------------------ */
/* Fixtures                                                            */
/* ------------------------------------------------------------------ */

function makeProfile(): Profile {
  return createProfile({
    firstName: "Asha",
    lastName: "Rao",
    email: "asha@example.com",
    phone: "9990001111",
    city: "Bengaluru",
    yearsOfExperience: "4",
    skills: ["JavaScript", "React", "Node.js", "SQL"],
    summary: "Frontend engineer with 4 years building React apps.",
    masterResumeText:
      "Asha Rao. Frontend engineer. Built React single-page apps, Node.js APIs, " +
      "and SQL-backed dashboards. Led a team of 3. Improved load time by 40%.",
    experience: [
      {
        id: "e1",
        title: "Frontend Engineer",
        company: "Acme",
        current: true,
        bullets: [
          "Built responsive React dashboards used by 10k users.",
          "Optimized bundle size and improved load time by 40%.",
        ],
        skills: ["React", "JavaScript"],
      },
    ],
    education: [
      {
        id: "ed1",
        school: "IIT Bombay",
        degree: "B.Tech",
        field: "Computer Science",
        endDate: "2021",
      },
    ],
  });
}

function makeJobs(n: number): Job[] {
  return Array.from({ length: n }, (_, i) => ({
    id: `job_${i}`,
    url: `https://boards.example.com/job/${i}`,
    title: "Senior Frontend Engineer",
    company: `Company ${i}`,
    location: "Remote",
    description:
      "We need a Senior Frontend Engineer strong in React, TypeScript, GraphQL, " +
      "and AWS. Experience with Node.js and SQL required. Kubernetes a plus.",
    salary: "",
    remote: true,
    source: "test",
    savedAt: 0,
  }));
}

const NO_LLM: LLMConfig = { provider: "none" } as unknown as LLMConfig;

/* ------------------------------------------------------------------ */
/* Resume immutability                                                 */
/* ------------------------------------------------------------------ */

test("enhanceResumeForJob never mutates the original profile", async () => {
  const profile = makeProfile();
  const snapshot = JSON.stringify(profile);
  const llm = buildLLM(NO_LLM);

  const result = await enhanceResumeForJob(
    profile,
    makeJobs(1)[0]!.description,
    llm,
  );

  // Original object is byte-for-byte unchanged.
  assert.equal(JSON.stringify(profile), snapshot);
  // Original resume text preserved verbatim in the result.
  assert.equal(result.originalResumeText, profile.masterResumeText);
  // Enhanced text is a real string and the ATS analysis ran.
  assert.ok(result.enhancedResumeText.length > 0);
  assert.ok(result.atsScoreAfter >= 0 && result.atsScoreAfter <= 100);
  // It identified real keyword gaps from the JD (graphql/typescript/aws/etc.).
  assert.ok(result.targetedKeywords.length > 0);
});

test("original profile is frozen after enhancement (write throws)", async () => {
  const profile = makeProfile();
  const llm = buildLLM(NO_LLM);
  await enhanceResumeForJob(profile, makeJobs(1)[0]!.description, llm);

  assert.throws(() => {
    // Frozen in strict mode → assigning a valid field still throws at runtime.
    (profile as { firstName: string }).firstName = "Hacked";
  });
});

/* ------------------------------------------------------------------ */
/* Bounded parallelism                                                 */
/* ------------------------------------------------------------------ */

test("fleet honors concurrency cap while running genuinely in parallel", async () => {
  const profile = makeProfile();
  let inFlight = 0;
  let peak = 0;

  // A submitter that holds each slot for a beat so overlap is observable.
  const submitFn: SubmitFn = async () => {
    inFlight++;
    peak = Math.max(peak, inFlight);
    await new Promise((r) => setTimeout(r, 30));
    inFlight--;
    return { outcome: "submitted", filledFields: 12 };
  };

  const fleet = new ApplyFleet(
    {
      profile,
      llmConfig: NO_LLM,
      jobs: makeJobs(10),
      concurrency: 4,
      dryRun: false,
      submitFn,
      launchJitterMs: 0,
      minScore: 1, // ensure all pass the gate in this test
    },
  );

  const report = await fleet.run();

  // Real parallelism happened (more than one worker overlapped)...
  assert.ok(report.peakConcurrency > 1, `expected overlap, got ${report.peakConcurrency}`);
  // ...but never exceeded the cap.
  assert.ok(report.peakConcurrency <= 4, `cap exceeded: ${report.peakConcurrency}`);
  assert.equal(report.total, 10);
  assert.equal(report.applied, 10);
});

test("fleet deduplicates jobs by URL", async () => {
  const profile = makeProfile();
  const jobs = makeJobs(3);
  const dupes = [...jobs, { ...jobs[0]! }]; // 4 entries, one duplicate URL

  const submitFn: SubmitFn = async () => ({ outcome: "submitted", filledFields: 1 });
  const report = await new ApplyFleet({
    profile,
    llmConfig: NO_LLM,
    jobs: dupes,
    concurrency: 5,
    dryRun: false,
    submitFn,
    launchJitterMs: 0,
    minScore: 1,
  }).run();

  assert.equal(report.total, 3, "duplicate URL should be dropped");
});

test("dry-run prepares applications without calling submitFn", async () => {
  const profile = makeProfile();
  let submitCalls = 0;
  const submitFn: SubmitFn = async () => {
    submitCalls++;
    return { outcome: "submitted", filledFields: 1 };
  };

  const report = await new ApplyFleet({
    profile,
    llmConfig: NO_LLM,
    jobs: makeJobs(5),
    concurrency: 5,
    dryRun: true, // safe default
    submitFn,
    launchJitterMs: 0,
    minScore: 1,
  }).run();

  assert.equal(submitCalls, 0, "dry-run must not submit");
  assert.equal(report.preview, 5);
  assert.equal(report.applied, 0);
});

test("abort marks unstarted jobs as skipped", async () => {
  const profile = makeProfile();
  const controller = new AbortController();
  const submitFn: SubmitFn = async () => {
    await new Promise((r) => setTimeout(r, 20));
    return { outcome: "submitted", filledFields: 1 };
  };

  const fleet = new ApplyFleet({
    profile,
    llmConfig: NO_LLM,
    jobs: makeJobs(8),
    concurrency: 2,
    dryRun: false,
    submitFn,
    launchJitterMs: 0,
    minScore: 1,
  });

  const p = fleet.run(controller.signal);
  setTimeout(() => controller.abort(), 25);
  const report = await p;

  assert.ok(report.skipped > 0, "some jobs should be skipped after abort");
  assert.equal(
    report.applied + report.skipped + report.failed + report.preview + report.gated,
    report.total,
  );
});
