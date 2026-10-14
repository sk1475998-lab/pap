import assert from "node:assert/strict";
import express from "express";
import { once } from "node:events";
import type { AddressInfo } from "node:net";
import test from "node:test";
import { defaultAggregator, makeJob } from "@superjob/scraper";
import { jobsRouter } from "../routes/jobs.js";
import { discover } from "./discovery.js";

test("an all-board outage is not cached as a successful empty search", async () => {
  const originalDiscover = defaultAggregator.discoverWithStatus.bind(defaultAggregator);
  const boardStatuses = defaultAggregator.enabledBoards.map((board) => ({
    board,
    status: "failed" as const,
  }));
  const query = `outage-cache-test-${Date.now()}`;
  let calls = 0;

  defaultAggregator.discoverWithStatus = async () => {
    calls += 1;
    return calls === 1
      ? { jobs: [], boardStatuses }
      : {
          jobs: [],
          boardStatuses: boardStatuses.map(({ board }) => ({ board, status: "succeeded" as const })),
        };
  };

  try {
    const outage = await discover(query, "Remote", 7);
    assert.equal(outage.boardsFailed, true);
    assert.equal(outage.cached, false);
    assert.deepEqual(outage.boardStatuses, boardStatuses);

    const recoveredEmptySearch = await discover(query, "Remote", 7);
    assert.equal(recoveredEmptySearch.boardsFailed, false);
    assert.equal(recoveredEmptySearch.cached, false);
    assert.deepEqual(recoveredEmptySearch.jobs, []);

    const cachedEmptySearch = await discover(query, "Remote", 7);
    assert.equal(cachedEmptySearch.cached, true);
    assert.equal(calls, 2);
  } finally {
    defaultAggregator.discoverWithStatus = originalDiscover;
  }
});

test("discovery keeps and reports successful results when one board fails", async () => {
  const originalDiscover = defaultAggregator.discoverWithStatus.bind(defaultAggregator);
  const job = makeJob({
    title: "Backend Engineer",
    company: "Example",
    location: "Remote",
    url: "https://example.com/jobs/backend",
  });
  const boardStatuses = [
    { board: "healthy", status: "succeeded" as const },
    { board: "unavailable", status: "failed" as const },
  ];
  const query = `partial-cache-test-${Date.now()}`;
  let calls = 0;
  defaultAggregator.discoverWithStatus = async () => {
    calls += 1;
    return { jobs: [job], boardStatuses };
  };

  try {
    const partial = await discover(query, "Remote", 7);
    assert.equal(partial.partialFailure, true);
    assert.equal(partial.boardsFailed, false);
    assert.equal(partial.jobs[0]?.title, "Backend Engineer");
    assert.deepEqual(partial.boardStatuses, boardStatuses);

    const cachedPartial = await discover(query, "Remote", 7);
    assert.equal(cachedPartial.cached, true);
    assert.equal(cachedPartial.jobs[0]?.title, "Backend Engineer");
    assert.equal(cachedPartial.partialFailure, true);
    assert.equal(calls, 1);
  } finally {
    defaultAggregator.discoverWithStatus = originalDiscover;
  }
});

test("job search returns an outage response instead of a successful empty feed", async () => {
  const originalDiscover = defaultAggregator.discoverWithStatus.bind(defaultAggregator);
  const boardStatuses = defaultAggregator.enabledBoards.map((board) => ({
    board,
    status: "failed" as const,
  }));
  defaultAggregator.discoverWithStatus = async () => ({ jobs: [], boardStatuses });

  const app = express();
  app.use("/api/jobs", jobsRouter);
  const server = app.listen(0);
  await once(server, "listening");

  try {
    const { port } = server.address() as AddressInfo;
    const response = await fetch(`http://127.0.0.1:${port}/api/jobs/search?q=route-outage-${Date.now()}`);
    const body = await response.json() as {
      ok: boolean;
      data: unknown[];
      discovery: { boardsFailed: boolean; boardStatuses: typeof boardStatuses; message: string };
    };

    assert.equal(response.status, 503);
    assert.equal(body.ok, true);
    assert.deepEqual(body.data, []);
    assert.equal(body.discovery.boardsFailed, true);
    assert.deepEqual(body.discovery.boardStatuses, boardStatuses);
    assert.match(body.discovery.message, /discovery outage/);
    assert.doesNotMatch(body.discovery.message, /No live postings matched/);
  } finally {
    defaultAggregator.discoverWithStatus = originalDiscover;
    server.close();
    await once(server, "close");
  }
});
