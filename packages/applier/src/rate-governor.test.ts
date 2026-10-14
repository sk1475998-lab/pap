import assert from "node:assert/strict";
import test from "node:test";
import { setStore, type KVStore } from "@superjob/core";
import { RateGovernor } from "./rate-governor.js";

class MemoryStore implements KVStore {
  private values = new Map<string, unknown>();
  async get<T>(key: string): Promise<T | undefined> {
    return this.values.get(key) as T | undefined;
  }
  async set<T>(key: string, value: T): Promise<void> {
    this.values.set(key, value);
  }
  async delete(key: string): Promise<void> {
    this.values.delete(key);
  }
  async keys(): Promise<string[]> {
    return [...this.values.keys()];
  }
}

test("RateGovernor allows 24/7 applying when operating hours are not enforced", async () => {
  setStore(new MemoryStore());
  // 3 AM UTC
  const governor = new RateGovernor({
    policies: { testplatform: { dailyLimit: 10, minIntervalMinutes: 0 } },
    globalDailyLimit: 20,
    enforceOperatingHours: false,
    now: () => new Date("2026-06-15T03:00:00.000Z"),
  });

  const check = await governor.canApply("testplatform");
  assert.equal(check.allowed, true);
});

test("RateGovernor enforces custom timezone offset operating hours", async () => {
  setStore(new MemoryStore());
  // 13:00 UTC with timezoneOffset -5 (EST -> 08:00 EST)
  const governorEST = new RateGovernor({
    policies: { testplatform: { dailyLimit: 10, minIntervalMinutes: 0 } },
    globalDailyLimit: 20,
    enforceOperatingHours: true,
    startHour: 9,
    endHour: 17,
    timezoneOffsetHours: -5,
    now: () => new Date("2026-06-15T13:00:00.000Z"), // 08:00 EST (before 09:00)
  });

  const blocked = await governorEST.canApply("testplatform");
  assert.equal(blocked.allowed, false);
  assert.match(blocked.reason ?? "", /Outside permitted hours/);

  // 15:00 UTC with timezoneOffset -5 (EST -> 10:00 EST, within 9-17)
  const governorActive = new RateGovernor({
    policies: { testplatform: { dailyLimit: 10, minIntervalMinutes: 0 } },
    globalDailyLimit: 20,
    enforceOperatingHours: true,
    startHour: 9,
    endHour: 17,
    timezoneOffsetHours: -5,
    now: () => new Date("2026-06-15T15:00:00.000Z"),
  });

  const allowed = await governorActive.canApply("testplatform");
  assert.equal(allowed.allowed, true);
});

test("RateGovernor maintains backward compatibility with legacy startHourIST and endHourIST", async () => {
  setStore(new MemoryStore());
  // 00:00 UTC = 05:30 IST (outside 7-22 IST)
  const governor = new RateGovernor({
    policies: { testplatform: { dailyLimit: 10, minIntervalMinutes: 0 } },
    globalDailyLimit: 20,
    startHourIST: 7,
    endHourIST: 22,
    now: () => new Date("2026-06-15T00:00:00.000Z"),
  });

  const check = await governor.canApply("testplatform");
  assert.equal(check.allowed, false);
  assert.match(check.reason ?? "", /IST/);
});

test("RateGovernor resetDailyLimits aligns with loadState date format and resets state", async () => {
  const store = new MemoryStore();
  setStore(store);

  const governor = new RateGovernor({
    policies: { testplatform: { dailyLimit: 2, minIntervalMinutes: 0 } },
    globalDailyLimit: 5,
    enforceOperatingHours: false,
    now: () => new Date("2026-06-15T12:00:00.000Z"),
  });

  assert.equal((await governor.canApply("testplatform")).allowed, true);
  await governor.recordSuccess("testplatform");
  await governor.recordSuccess("testplatform");

  // Daily limit reached
  const blocked = await governor.canApply("testplatform");
  assert.equal(blocked.allowed, false);
  assert.match(blocked.reason ?? "", /daily limits/);

  // Reset daily limits
  await governor.resetDailyLimits();

  // Next check immediately allowed without date mismatch corruption
  const afterReset = await governor.canApply("testplatform");
  assert.equal(afterReset.allowed, true);
});
