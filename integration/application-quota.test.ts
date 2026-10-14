import assert from "node:assert/strict";
import test from "node:test";
import express from "express";
import { readApplications, setStore, SYNC_SCHEMA_VERSION } from "@superjob/core";
import { issueToken, findUserById, putUser, type UserRecord } from "../packages/server/src/lib/identity.js";
import { runAsUser } from "../packages/server/src/lib/tenant.js";
import { withApplicationQuota } from "../packages/server/src/lib/application-quota.js";
import { billingRouter, ensureMonthlyQuotaFresh } from "../packages/server/src/routes/billing.js";
import { syncRouter } from "../packages/server/src/routes/sync.js";

const rows = new Map<string, unknown>();
setStore({
  async get<T>(key: string) { return rows.get(key) as T | undefined; },
  async set<T>(key: string, value: T) { rows.set(key, value); },
  async delete(key: string) { rows.delete(key); },
  async keys() { return [...rows.keys()]; },
});

const user: UserRecord = {
  userId: "quota-test-user",
  email: "quota-test@example.test",
  name: "Quota Test",
  provider: "local",
  createdAt: Date.now(),
  lastLoginAt: Date.now(),
  tier: "free",
  monthlyApplicationsUsed: 149,
  monthlyApplicationsResetAt: Date.now() + 60_000,
};

test("monthly application quota serializes concurrent submissions and counts persisted transitions", async () => {
  rows.clear();
  await putUser({ ...user, monthlyApplicationsUsed: 149 });
  let saves = 0;
  const submissions = await Promise.all([
    withApplicationQuota(user, async () => { saves++; }),
    withApplicationQuota(user, async () => { saves++; }),
  ]);
  assert.equal(submissions.filter((result) => result.allowed).length, 1);
  assert.equal(saves, 1);

  const saved = await withApplicationQuota(user, async () => { saves++; });
  assert.equal(saved.allowed, false);
  assert.equal(saves, 1);
});

test("failed application persistence releases the reserved monthly slot", async () => {
  rows.clear();
  await putUser({ ...user, monthlyApplicationsUsed: 2 });
  await assert.rejects(
    withApplicationQuota(user, async () => { throw new Error("application write failed"); }),
    /application write failed/,
  );
  const retried = await withApplicationQuota(user, async () => "saved");
  assert.equal(retried.allowed, true);
  assert.equal(retried.used, 3);
});

test("expired free quota advances to the next 30-day window and resets usage", () => {
  const originalNow = Date.now;
  const now = 10_000_000_000;
  Date.now = () => now;
  try {
    const { user: refreshed, reset } = ensureMonthlyQuotaFresh({
      ...user,
      monthlyApplicationsUsed: 150,
      monthlyApplicationsResetAt: now - 65 * 24 * 60 * 60 * 1000,
    });
    assert.equal(reset, true);
    assert.equal(refreshed.monthlyApplicationsUsed, 0);
    assert.equal(refreshed.monthlyApplicationsResetAt, now + 25 * 24 * 60 * 60 * 1000);
  } finally {
    Date.now = originalNow;
  }
});

test("legacy accounts receive one fresh 30-day quota window", () => {
  const originalNow = Date.now;
  const now = 20_000_000_000;
  Date.now = () => now;
  try {
    const legacy = { ...user, monthlyApplicationsUsed: undefined, monthlyApplicationsResetAt: undefined };
    const { user: refreshed, reset } = ensureMonthlyQuotaFresh(legacy);
    assert.equal(reset, true);
    assert.equal(refreshed.monthlyApplicationsUsed, 0);
    assert.equal(refreshed.monthlyApplicationsResetAt, now + 30 * 24 * 60 * 60 * 1000);
  } finally {
    Date.now = originalNow;
  }
});

test("paid tiers remain unlimited after the monthly counter passes the free allowance", async () => {
  rows.clear();
  const pro = { ...user, tier: "pro" as const, monthlyApplicationsUsed: 150 };
  await putUser(pro);
  const result = await withApplicationQuota(pro, async () => "saved");
  assert.equal(result.allowed, true);
  assert.equal(result.limit, null);
  assert.equal(result.used, 151);
});

test("batch quota reservations reject batches that exceed the remaining monthly allowance", async () => {
  rows.clear();
  await putUser({ ...user, monthlyApplicationsUsed: 149 });
  let saves = 0;
  const tooMany = await withApplicationQuota(user, async () => { saves++; }, 2);
  assert.equal(tooMany.allowed, false);
  assert.equal(tooMany.used, 149);
  const lastSlot = await withApplicationQuota(user, async () => { saves++; }, 1);
  assert.equal(lastSlot.allowed, true);
  assert.equal(lastSlot.used, 150);
  assert.equal(saves, 1);
});

async function pushSyncEnvelope(
  account: UserRecord,
  data: Record<string, unknown>,
  updatedAt = Date.now(),
) {
  await putUser(account);
  const token = await issueToken(account);
  const app = express();
  app.use(express.json());
  app.use("/api/sync", syncRouter);
  const server = app.listen(0);
  const port = (server.address() as { port: number } | null)?.port;
  assert.ok(port);
  try {
    const response = await fetch(`http://127.0.0.1:${port}/api/sync`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        schema: SYNC_SCHEMA_VERSION,
        deviceId: "quota-sync-test",
        producedAt: updatedAt,
        revision: 0,
        data,
        meta: { applications: { updatedAt } },
      }),
    });
    return { response, body: await response.json() as Record<string, any> };
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => error ? reject(error) : resolve());
    });
  }
}

test("sync imports submitted application rows only up to the remaining monthly quota", async () => {
  rows.clear();
  const syncUser = {
    ...user,
    userId: "quota-sync-partial-user",
    email: "quota-sync-partial@example.test",
    monthlyApplicationsUsed: 149,
    monthlyApplicationsResetAt: Date.now() + 60_000,
  };
  const first = {
    id: "application-one",
    url: "https://jobs.example.test/one",
    title: "Engineer One",
    company: "Example",
    stage: "applied",
    appliedAt: Date.now(),
    updatedAt: Date.now(),
  };
  const second = {
    id: "application-two",
    url: "https://jobs.example.test/two",
    title: "Engineer Two",
    company: "Example",
    stage: "applied",
    appliedAt: Date.now() + 1,
    updatedAt: Date.now() + 1,
  };
  const { response, body } = await pushSyncEnvelope(syncUser, {
    applications: [first, second],
    profile: { firstName: "Quota Sync Test" },
  });
  assert.equal(response.status, 200);
  assert.equal(body.ok, true);
  assert.equal(body.envelope.data.applications.length, 1);
  assert.ok(body.notes.some((note: string) => note.includes("remain on this device")));
  assert.equal(body.envelope.data.profile.firstName, "Quota Sync Test");
  assert.equal((await findUserById(syncUser.userId))?.monthlyApplicationsUsed, 150);
  const storedApps = await runAsUser(syncUser, () => readApplications());
  assert.equal(storedApps.length, 1);
});

test("sync at the monthly limit keeps other profile data syncing but rejects new submissions", async () => {
  rows.clear();
  const syncUser = {
    ...user,
    userId: "quota-sync-full-user",
    email: "quota-sync-full@example.test",
    monthlyApplicationsUsed: 150,
    monthlyApplicationsResetAt: Date.now() + 60_000,
  };
  const { response, body } = await pushSyncEnvelope(syncUser, {
    applications: [{
      id: "application-at-limit",
      url: "https://jobs.example.test/at-limit",
      title: "Engineer",
      company: "Example",
      stage: "applied",
      appliedAt: Date.now(),
      updatedAt: Date.now(),
    }],
    profile: { firstName: "Still Syncs" },
  });
  assert.equal(response.status, 200);
  assert.equal(body.envelope.data.applications.length, 0);
  assert.equal(body.envelope.data.profile.firstName, "Still Syncs");
  assert.ok(body.notes.some((note: string) => note.includes("allowance is reached")));
  assert.equal((await findUserById(syncUser.userId))?.monthlyApplicationsUsed, 150);
});

test("billing status returns monthly quota facts and unconfigured Stripe routes fail honestly", async () => {
  rows.clear();
  const billingUser = {
    ...user,
    userId: "quota-billing-status-user",
    email: "quota-billing-status@example.test",
    monthlyApplicationsUsed: 43,
    monthlyApplicationsResetAt: Date.now() + 7 * 24 * 60 * 60 * 1000,
  };
  await putUser(billingUser);
  const token = await issueToken(billingUser);
  const app = express();
  app.use(express.json());
  app.use("/api/billing", billingRouter);
  const server = app.listen(0);
  const port = (server.address() as { port: number } | null)?.port;
  assert.ok(port);
  const priorStripeKey = process.env.STRIPE_SECRET_KEY;
  delete process.env.STRIPE_SECRET_KEY;
  try {
    const statusResponse = await fetch(`http://127.0.0.1:${port}/api/billing/status`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const status = await statusResponse.json() as Record<string, any>;
    assert.equal(status.quota.monthlyLimit, 150);
    assert.equal(status.quota.usedThisPeriod, 43);
    assert.equal(status.quota.remaining, 107);
    assert.equal(status.quota.periodDays, 30);
    assert.equal(status.quota.dailyLimit, 150);
    assert.equal(status.canManageSubscription, false);

    for (const path of ["create-checkout", "portal-session"]) {
      const response = await fetch(`http://127.0.0.1:${port}/api/billing/${path}`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ plan: "pro_monthly" }),
      });
      assert.equal(response.status, 503);
      const result = await response.json() as Record<string, unknown>;
      assert.equal(result.ok, false);
      assert.equal(result.code, "BILLING_NOT_CONFIGURED");
      assert.equal("testCheckoutUrl" in result, false);
    }
  } finally {
    if (priorStripeKey === undefined) delete process.env.STRIPE_SECRET_KEY;
    else process.env.STRIPE_SECRET_KEY = priorStripeKey;
    await new Promise<void>((resolve, reject) => {
      server.close((error) => error ? reject(error) : resolve());
    });
  }
});
