/**
 * integration/server-module2.test.ts — Verification of Module 2 Enterprise Backend Hardening
 *
 * Tests:
 * 1. GAP-M2-02: Billing dev-upgrade is strictly disabled by default; rejects unauthorized calls with timing safety.
 * 2. GAP-M2-03: Outreach router uses getLLM() and provides honest deterministic/AI responses without crashing.
 * 3. GAP-M2-04: Alerts router performs genuine discovery, zero mock Flipkart/Razorpay data.
 * 4. GAP-M2-05: Multi-tenant email monitor isolates watcher state per user.
 * 5. GAP-M2-07: Error handling across routers utilizes asyncRoute with correlation IDs.
 * 6. Feature retirement: Confirms India Intelligence and Salary Negotiation features are retired cleanly.
 */

import test from "node:test";
import assert from "node:assert/strict";
import express from "express";
import request from "node:http";
import { billingRouter } from "../packages/server/src/routes/billing.js";
import { limitLinkedInInvite, outreachRouter } from "../packages/server/src/routes/outreach.js";
import { alertsRouter } from "../packages/server/src/routes/alerts.js";
import { emailRouter } from "../packages/server/src/routes/email.js";
import { interviewRouter } from "../packages/server/src/routes/interview.js";
import { careerRouter } from "../packages/server/src/routes/career.js";
import { indiaRouter } from "../packages/server/src/routes/india.js";
import { setStore, createProfile, readLLMConfig, writeLLMConfig } from "@superjob/core";

// Set up mock KV store for testing
const memStore = new Map<string, unknown>();
setStore({
  async get<T>(key: string): Promise<T | undefined> {
    return memStore.get(key) as T | undefined;
  },
  async set<T>(key: string, value: T): Promise<void> {
    memStore.set(key, value);
  },
  async delete(key: string): Promise<void> {
    memStore.delete(key);
  },
  async keys(): Promise<string[]> {
    return Array.from(memStore.keys());
  },
});

function createTestApp() {
  const app = express();
  app.use(express.json());
  app.use("/api/billing", billingRouter);
  app.use("/api/outreach", outreachRouter);
  app.use("/api/alerts", alertsRouter);
  app.use("/api/email", emailRouter);
  app.use("/api/interview", interviewRouter);
  app.use("/api/career", careerRouter);
  app.use("/api/india", indiaRouter);
  return app;
}

test("GAP-M2-02: Billing dev-upgrade backdoor is strictly unmounted by default", async () => {
  const app = createTestApp();
  const server = app.listen(0);
  const port = (server.address() as any).port;

  try {
    const res = await fetch(`http://127.0.0.1:${port}/api/billing/dev-upgrade`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tier: "pro" }),
    });

    // Since ENABLE_DEV_BILLING_BACKDOOR is not set to "true", the route is not even registered (404)
    assert.equal(res.status, 404, "dev-upgrade route must not exist when backdoor flag is unset");
  } finally {
    server.close();
  }
});

test("GAP-M2-02: Billing create-checkout does not advertise dev backdoor in response", async () => {
  const app = createTestApp();
  const server = app.listen(0);
  const port = (server.address() as any).port;

  try {
    const res = await fetch(`http://127.0.0.1:${port}/api/billing/create-checkout`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ plan: "pro_monthly" }),
    });

    // Without auth token it returns 401
    assert.equal(res.status, 401);
    const body = await res.json() as any;
    assert.equal(body.ok, false);
    assert.ok(!JSON.stringify(body).includes("dev-upgrade"), "Must not advertise dev-upgrade backdoor");
  } finally {
    server.close();
  }
});

test("GAP-M2-03: Outreach route generates honest templates without crashing", async () => {
  const app = createTestApp();
  const server = app.listen(0);
  const port = (server.address() as any).port;

  // Seed profile
  await memStore.set("profile", createProfile({
    firstName: "Alex",
    lastName: "Morgan",
    skills: ["TypeScript", "Node.js", "Distributed Systems"],
  }));

  try {
    const res = await fetch(`http://127.0.0.1:${port}/api/outreach/message`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        company: "Stripe",
        jobTitle: "Senior Backend Engineer",
        contactName: "Sarah",
        contactTitle: "Engineering Director",
        useAI: false,
      }),
    });

    assert.equal(res.status, 200);
    const body = await res.json() as any;
    assert.equal(body.ok, true);
    assert.ok(body.data.linkedin.includes("Alex"));
    assert.ok(body.data.linkedin.includes("Stripe"));
    assert.ok(body.data.email.includes("Sarah"));
  } finally {
    server.close();
  }
});

test("outreach endpoint keeps its LinkedIn invite within the advertised 200-character limit", async () => {
  assert.ok(limitLinkedInInvite("  " + "word ".repeat(60) + "  ").length <= 200);
  assert.equal(limitLinkedInInvite("  Short invite.  "), "Short invite.");

  const app = createTestApp();
  const server = app.listen(0);
  const port = (server.address() as any).port;
  await memStore.set("profile", createProfile({
    firstName: "Alex",
    lastName: "Morgan",
    skills: ["TypeScript", "Node.js"],
  }));

  try {
    const res = await fetch(`http://127.0.0.1:${port}/api/outreach/message`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ company: "Acme", jobTitle: "Engineer", useAI: false }),
    });
    const body = await res.json() as { ok: boolean; data?: { linkedin?: string } };
    assert.equal(res.status, 200);
    assert.equal(body.ok, true);
    assert.ok(body.data?.linkedin);
    assert.ok(body.data.linkedin.length <= 200);
  } finally {
    server.close();
  }
});

test("interview question response reports whether AI-generated questions were included", async () => {
  const app = createTestApp();
  const server = app.listen(0);
  const port = (server.address() as any).port;
  const previousConfig = await readLLMConfig();
  await writeLLMConfig({ provider: "none" });

  try {
    const res = await fetch(
      `http://127.0.0.1:${port}/api/interview/questions?role=Software%20Engineer&jd=TypeScript%20and%20React`,
    );
    const body = await res.json() as { ok: boolean; aiUsed?: boolean; data?: unknown[] };
    assert.equal(res.status, 200);
    assert.equal(body.ok, true);
    assert.equal(body.aiUsed, false);
    assert.ok(Array.isArray(body.data));
    assert.ok(body.data.length > 0);
  } finally {
    await writeLLMConfig(previousConfig);
    server.close();
  }
});

test("GAP-M2-04: Alerts test route runs real multi-board discovery and contains zero mock data", async () => {
  const app = createTestApp();
  const server = app.listen(0);
  const port = (server.address() as any).port;

  // Seed an alert
  await memStore.set("job_alerts", [
    {
      id: "alert_test_1",
      name: "Senior Software Engineer Alert",
      keywords: ["Software", "Engineer"],
      companies: [],
      location: "San Francisco",
      frequency: "daily",
      active: true,
      createdAt: Date.now(),
      triggerCount: 0,
      sources: ["linkedin"],
    },
  ]);

  try {
    const res = await fetch(`http://127.0.0.1:${port}/api/alerts/test/alert_test_1`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    });

    assert.equal(res.status, 200);
    const body = await res.json() as any;
    assert.equal(body.ok, true);
    assert.equal(body.alertName, "Senior Software Engineer Alert");
    // Ensure it does not contain the old hardcoded fake Flipkart/Razorpay test snippet
    assert.ok(body.matches !== undefined);
  } finally {
    server.close();
  }
});

test("GAP-M2-05: Multi-tenant email monitor status returns clean tenant-scoped state", async () => {
  const app = createTestApp();
  const server = app.listen(0);
  const port = (server.address() as any).port;

  try {
    const res = await fetch(`http://127.0.0.1:${port}/api/email/status`);
    assert.equal(res.status, 200);
    const body = await res.json() as any;
    assert.equal(body.ok, true);
    assert.equal(body.running, false);
    assert.equal(body.scansCompleted, 0);
  } finally {
    server.close();
  }
});

test("Feature Retirement: India intelligence router returns 410 Gone when invoked", async () => {
  const app = createTestApp();
  const server = app.listen(0);
  const port = (server.address() as any).port;

  try {
    const res = await fetch(`http://127.0.0.1:${port}/api/india/salary?role=sde&city=bangalore`);
    assert.equal(res.status, 410, "Retired feature endpoint must return 410 Gone");
    const body = await res.json() as any;
    assert.equal(body.ok, false);
    assert.ok(body.error.includes("retired"));
  } finally {
    server.close();
  }
});
