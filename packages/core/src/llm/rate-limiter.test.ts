import test from "node:test";
import assert from "node:assert/strict";
import { LLMRateLimiter } from "./rate-limiter.js";

test("LLMRateLimiter starts with initial max tokens", async () => {
  const limiter = new LLMRateLimiter(3, 60);
  assert.equal(limiter.available, 3);
  assert.equal(await limiter.acquire(), true);
  assert.equal(limiter.available, 2);
  assert.equal(await limiter.acquire(), true);
  assert.equal(limiter.available, 1);
  assert.equal(await limiter.acquire(), true);
  assert.equal(limiter.available, 0);
  assert.equal(await limiter.acquire(), false);
});

test("LLMRateLimiter acquireWait succeeds immediately when tokens available", async () => {
  const limiter = new LLMRateLimiter(2, 60);
  const acquired = await limiter.acquireWait(500);
  assert.equal(acquired, true);
  assert.equal(limiter.available, 1);
});

test("LLMRateLimiter acquireWait queues and resolves when token refills", async () => {
  // 1 token max, refills 600 per minute (10 per second => 1 every 100ms)
  const limiter = new LLMRateLimiter(1, 600);
  assert.equal(await limiter.acquire(), true);
  assert.equal(limiter.available, 0);

  const t0 = Date.now();
  const acquired = await limiter.acquireWait(2000);
  const elapsed = Date.now() - t0;

  assert.equal(acquired, true);
  assert.ok(elapsed >= 80, `Expected refill delay, took ${elapsed}ms`);
});

test("LLMRateLimiter acquireWait times out when no tokens refill in budget", async () => {
  // 1 token max, refills 0 per minute
  const limiter = new LLMRateLimiter(1, 0);
  assert.equal(await limiter.acquire(), true);

  const acquired = await limiter.acquireWait(100);
  assert.equal(acquired, false);
});
