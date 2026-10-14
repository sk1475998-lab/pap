import assert from "node:assert/strict";
import test from "node:test";
import { runAdvancedSearch } from "./job-search-service.js";

test("advanced search returns live feed status and keeps unscored jobs visible", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify([
    {
      company: "Example",
      position: "Senior Software Engineer",
      description: "Build software with TypeScript.",
      url: "https://example.com/jobs/software-engineer",
      tags: ["typescript"],
    },
  ]), {
    status: 200,
    headers: { "content-type": "application/json" },
  });

  try {
    const result = await runAdvancedSearch(null, {
      keywords: "software engineer",
      location: "Remote",
      sources: ["remoteok"],
      minMatchScore: 60,
      remote: "any",
    });

    assert.equal(result.total, 1);
    assert.equal(result.scrapedJobs[0]?.matchScore, null);
    assert.equal(result.scrapedJobs[0]?.decision, "review");
    assert.deepEqual(result.discovery.boardStatuses, [
      { board: "remoteok", status: "succeeded" },
    ]);
    assert.match(result.discovery.message ?? "", /currently unscored/i);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("advanced search distinguishes a live-source outage from an empty market", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response("unavailable", { status: 403 });

  try {
    const result = await runAdvancedSearch(null, {
      keywords: "software engineer",
      location: "Remote",
      sources: ["remoteok"],
    });

    assert.equal(result.total, 0);
    assert.deepEqual(result.discovery.boardStatuses, [
      { board: "remoteok", status: "failed" },
    ]);
    assert.match(result.discovery.message ?? "", /source outage/i);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
