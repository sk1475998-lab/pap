import assert from "node:assert/strict";
import test from "node:test";
import { setStore, type KVStore } from "../packages/core/src/storage.ts";
import { RateGovernor } from "../packages/applier/src/rate-governor.ts";
import { SOURCE_RATE_POLICIES } from "../packages/applier/src/sources/rate-policies.ts";

class MemoryStore implements KVStore {
  private values = new Map<string, unknown>();
  async get<T>(key: string): Promise<T | undefined> { return this.values.get(key) as T | undefined; }
  async set<T>(key: string, value: T): Promise<void> { this.values.set(key, value); }
  async delete(key: string): Promise<void> { this.values.delete(key); }
  async keys(): Promise<string[]> { return [...this.values.keys()]; }
}

test("rate governor consumes injected adapter policy data without embedded site rules", async () => {
  assert.equal(SOURCE_RATE_POLICIES.linkedin.dailyLimit, 12);
  setStore(new MemoryStore());
  const governor = new RateGovernor({
    policies: { fixture: { dailyLimit: 2, minIntervalMinutes: 0 } },
    globalDailyLimit: 10,
    startHourIST: 0,
    endHourIST: 24,
    now: () => new Date("2026-01-01T10:00:00.000Z"),
  });

  assert.equal((await governor.canApply("fixture")).allowed, true);
  await governor.recordSuccess("fixture");
  await governor.recordSuccess("fixture");
  const blocked = await governor.canApply("fixture");
  assert.equal(blocked.allowed, false);
  assert.match(blocked.reason ?? "", /daily limits/i);
});
