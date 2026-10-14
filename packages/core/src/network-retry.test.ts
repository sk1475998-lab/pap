import test from "node:test";
import assert from "node:assert/strict";
import { retryBackoffDelayMs } from "./network-retry.js";

const base = { baseDelayMs: 1000, factor: 2, maxDelayMs: 10_000 };

test("retryBackoffDelayMs: exponential shape with no jitter", () => {
  assert.equal(retryBackoffDelayMs(1, { ...base, jitter: false }), 1000);
  assert.equal(retryBackoffDelayMs(2, { ...base, jitter: false }), 2000);
  assert.equal(retryBackoffDelayMs(3, { ...base, jitter: false }), 4000);
});

test("retryBackoffDelayMs: capped at maxDelayMs", () => {
  assert.equal(retryBackoffDelayMs(10, { ...base, jitter: false }), 10_000);
  assert.equal(retryBackoffDelayMs(99, { baseDelayMs: 1, factor: 10, maxDelayMs: 500, jitter: false }), 500);
});

test("retryBackoffDelayMs: classic jitter stays within the ±20% band", () => {
  const d = retryBackoffDelayMs(2, { ...base, jitter: true, rnd: () => 0 });
  assert.equal(d, 1600); // 2000 * 0.8
  const hi = retryBackoffDelayMs(2, { ...base, jitter: true, rnd: () => 0.999999 });
  assert.ok(hi > 1600 && hi < 2400);
  assert.ok(hi <= 2400.01); // 2000*1.2
});

test("retryBackoffDelayMs: equal jitter is uniform in [delay/2, delay]", () => {
  const half = retryBackoffDelayMs(2, { ...base, jitter: "equal", rnd: () => 0 });
  assert.equal(half, 1000); // 2000/2
  const hi = retryBackoffDelayMs(2, { ...base, jitter: "equal", rnd: () => 0.999999 });
  assert.ok(hi > 1000 && hi <= 2000);
  const mid = retryBackoffDelayMs(2, { ...base, jitter: "equal", rnd: () => 0.5 });
  assert.ok(mid >= 1000 && mid <= 2000);
});

test("retryBackoffDelayMs: attempt clamps to >= 1", () => {
  assert.equal(retryBackoffDelayMs(0, { ...base, jitter: false }), 1000);
  assert.equal(retryBackoffDelayMs(-3, { ...base, jitter: false }), 1000);
});

test("retryBackoffDelayMs: default options equal the previous runtime behavior", () => {
  // jitter:true default → ±20% band of base for attempt 1
  const v = retryBackoffDelayMs(1, { rnd: () => 0.5 });
  assert.ok(v >= 800 && v <= 1200);
});
