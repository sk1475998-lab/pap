import assert from "node:assert/strict";
import test from "node:test";
import type { Job } from "@superjob/core";
import { JobAggregator } from "./aggregator.js";
import { fetchJson, makeJob, matchesSearchKeywords, type JobBoardScraper } from "./framework.js";

test("search keyword matching requires every meaningful query term", () => {
  assert.equal(matchesSearchKeywords("software engineer", "Senior Software Engineer"), true);
  assert.equal(matchesSearchKeywords("software engineer", "Business Development Director"), false);
  assert.equal(matchesSearchKeywords("software and engineer", "Software Engineer"), true);
  assert.equal(matchesSearchKeywords("", "Any posting"), true);
});

test("JobAggregator registers scrapers and lists enabled boards", () => {
  const agg = new JobAggregator();
  const mockScraper: JobBoardScraper = {
    id: "board1",
    name: "Board One",
    discover: async () => [],
  };
  agg.use(mockScraper);
  assert.deepEqual(agg.enabledBoards, ["board1"]);
});

test("JobAggregator aggregates and deduplicates jobs across multiple boards", async () => {
  const agg = new JobAggregator();

  const boardA: JobBoardScraper = {
    id: "boardA",
    name: "Board A",
    discover: async () => [
      makeJob({
        title: "Staff Engineer",
        company: "Stripe",
        location: "Remote",
        url: "https://stripe.com/jobs/1",
      }),
      makeJob({
        title: "Frontend Developer",
        company: "Airbnb",
        location: "Remote",
        url: "https://airbnb.com/jobs/2",
      }),
    ],
  };

  const boardB: JobBoardScraper = {
    id: "boardB",
    name: "Board B",
    discover: async () => [
      // Duplicate by title + company
      makeJob({
        title: "Staff Engineer",
        company: "Stripe",
        location: "Remote - US",
        url: "https://boardb.com/stripe-staff",
      }),
      makeJob({
        title: "DevOps Engineer",
        company: "Netflix",
        location: "Los Gatos",
        url: "https://netflix.com/jobs/3",
      }),
    ],
  };

  agg.use(boardA).use(boardB);

  const results = await agg.discover("engineer", "Remote", 10);
  assert.equal(results.length, 3); // 4 total, 1 duplicate removed -> 3 unique
  const titles = results.map((j) => j.title).sort();
  assert.deepEqual(titles, ["DevOps Engineer", "Frontend Developer", "Staff Engineer"]);
});

test("JobAggregator isolates scraper failures and continues with healthy boards", async () => {
  const agg = new JobAggregator();

  const failingBoard: JobBoardScraper = {
    id: "failing",
    name: "Failing Board",
    discover: async () => {
      throw new Error("HTTP 429 Rate Limit Exceeded");
    },
  };

  const healthyBoard: JobBoardScraper = {
    id: "healthy",
    name: "Healthy Board",
    discover: async () => [
      makeJob({
        title: "Backend Architect",
        company: "Vercel",
        location: "Remote",
        url: "https://vercel.com/jobs/10",
      }),
    ],
  };

  agg.use(failingBoard).use(healthyBoard);

  const result = await agg.discoverWithStatus("architect", "Remote", 5);
  assert.equal(result.jobs.length, 1);
  assert.equal(result.jobs[0].title, "Backend Architect");
  assert.equal(result.jobs[0].company, "Vercel");
  assert.deepEqual(result.boardStatuses, [
    { board: "failing", status: "failed" },
    { board: "healthy", status: "succeeded" },
  ]);
});

test("JobAggregator preserves an all-board outage as failures, not an empty success", async () => {
  const agg = new JobAggregator();
  agg.use({
    id: "down-a",
    name: "Down A",
    discover: async () => { throw new Error("provider unavailable"); },
  }).use({
    id: "down-b",
    name: "Down B",
    discover: async () => { throw new Error("provider unavailable"); },
  });

  const result = await agg.discoverWithStatus("engineer", "Remote", 5);
  assert.deepEqual(result.jobs, []);
  assert.deepEqual(result.boardStatuses, [
    { board: "down-a", status: "failed" },
    { board: "down-b", status: "failed" },
  ]);
});

test("JobAggregator propagates provider fetch failures while retaining healthy-board results", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => {
    throw new TypeError("network unavailable");
  };

  const agg = new JobAggregator()
    .use({
      id: "provider",
      name: "Provider API",
      discover: async () => {
        await fetchJson<unknown[]>("https://provider.example/jobs", {
          delayMs: 0,
          maxRetries: 0,
        });
        return [];
      },
    })
    .use({
      id: "healthy",
      name: "Healthy Board",
      discover: async () => [
        makeJob({
          title: "Backend Engineer",
          company: "Example",
          location: "Remote",
          url: "https://example.com/jobs/backend",
        }),
      ],
    });

  try {
    const result = await agg.discoverWithStatus("backend", "Remote", 5);
    assert.equal(result.jobs.length, 1);
    assert.deepEqual(result.boardStatuses, [
      { board: "provider", status: "failed" },
      { board: "healthy", status: "succeeded" },
    ]);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("JobAggregator times out a stalled board and continues with healthy sources", async () => {
  const agg = new JobAggregator()
    .use({
      id: "stalled",
      name: "Stalled source",
      discover: async (_keywords, _location, _limit, params) =>
        new Promise<Job[]>((_resolve, reject) => {
          params?.signal?.addEventListener(
            "abort",
            () => reject(new Error("aborted")),
            { once: true },
          );
        }),
    })
    .use({
      id: "healthy",
      name: "Healthy source",
      discover: async () => [
        makeJob({
          title: "Software Engineer",
          company: "Example",
          url: "https://example.com/jobs/engineer",
        }),
      ],
    });

  const result = await agg.discoverWithStatus("engineer", "Remote", 5, {
    sourceTimeoutMs: 10,
  });

  assert.equal(result.jobs.length, 1);
  assert.deepEqual(result.boardStatuses, [
    { board: "stalled", status: "failed" },
    { board: "healthy", status: "succeeded" },
  ]);
});

test("JobAggregator slices output to requested limit", async () => {
  const agg = new JobAggregator();
  const prolificBoard: JobBoardScraper = {
    id: "prolific",
    name: "Prolific Board",
    discover: async () => [
      makeJob({ title: "Job 1", company: "Co 1", location: "Remote", url: "https://job1.com" }),
      makeJob({ title: "Job 2", company: "Co 2", location: "Remote", url: "https://job2.com" }),
      makeJob({ title: "Job 3", company: "Co 3", location: "Remote", url: "https://job3.com" }),
      makeJob({ title: "Job 4", company: "Co 4", location: "Remote", url: "https://job4.com" }),
    ],
  };
  agg.use(prolificBoard);

  const results = await agg.discover("engineer", "Remote", 2);
  assert.equal(results.length, 2);
});
