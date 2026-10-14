import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { enqueueReviewItem, loadReviewQueue, approveReviewItem, rejectReviewItem, summarizeReviewQueue } from "./reviewer.js";
import { getStore } from "@superjob/core";
import type { EvidencePack } from "../sop.js";

describe("Reviewer Agent & HITL Review Queue", () => {
  beforeEach(async () => {
    const store = getStore();
    await store.set("sja_review_queue", []);
  });

  it("enqueues and loads interactive OTP and CAPTCHA evidence packs", async () => {
    const otpPack: EvidencePack = {
      jobId: "job_workday_123",
      jobTitle: "Senior AI Engineer",
      company: "Workday Org",
      matchScore: 92,
      confidence: 95,
      tier: "HUMAN_REVIEW",
      reviewType: "otp",
      otpLength: 6,
      tabId: 101,
      jobUrl: "https://workday.com/apply/123",
      filledFields: 5,
      totalFields: 6,
      lowConfidenceFields: ["OTP"],
      tailoredResume: "",
      coverLetter: "",
      reasoning: [],
      createdAt: Date.now(),
      ttl: Date.now() + 60000,
      idempotencyKey: "idem_otp_1",
      decision: "pending",
    };

    const captchaPack: EvidencePack = {
      jobId: "job_naukri_456",
      jobTitle: "Staff ML Engineer",
      company: "Innovate AI",
      matchScore: 88,
      confidence: 90,
      tier: "HUMAN_REVIEW",
      reviewType: "captcha",
      captchaType: "cloudflare",
      tabId: 102,
      jobUrl: "https://naukri.com/apply/456",
      filledFields: 4,
      totalFields: 5,
      lowConfidenceFields: ["CAPTCHA"],
      tailoredResume: "",
      coverLetter: "",
      reasoning: [],
      createdAt: Date.now(),
      ttl: Date.now() + 60000,
      idempotencyKey: "idem_captcha_1",
      decision: "pending",
    };

    await enqueueReviewItem(otpPack);
    await enqueueReviewItem(captchaPack);

    const queue = await loadReviewQueue();
    assert.equal(queue.length, 2);
    assert.equal(queue[0].jobId, "job_naukri_456");
    assert.equal(queue[0].reviewType, "captcha");
    assert.equal(queue[1].jobId, "job_workday_123");
    assert.equal(queue[1].reviewType, "otp");
    assert.equal(queue[1].otpLength, 6);

    const summary = summarizeReviewQueue(queue);
    assert.equal(summary.total, 2);
    assert.equal(summary.pending, 2);
  });

  it("approves and updates decision on review items without requiring cover letters", async () => {
    const pack: EvidencePack = {
      jobId: "direct_portal_apply",
      jobTitle: "Fullstack Engineer",
      company: "Stripe",
      matchScore: 90,
      confidence: 85,
      tier: "HUMAN_REVIEW",
      filledFields: 10,
      totalFields: 10,
      lowConfidenceFields: [],
      tailoredResume: "Tailored text",
      coverLetter: "", // No cover letter required
      reasoning: [],
      createdAt: Date.now(),
      ttl: Date.now() + 60000,
      idempotencyKey: "idem_direct_1",
      decision: "pending",
    };

    await enqueueReviewItem(pack);
    await approveReviewItem("direct_portal_apply");

    const store = getStore();
    const raw = await store.get<EvidencePack[]>("sja_review_queue") ?? [];
    const updated = raw.find((p) => p.jobId === "direct_portal_apply");
    assert.equal(updated?.decision, "approved");
    assert.ok(typeof updated?.decidedAt === "number");
  });
});
