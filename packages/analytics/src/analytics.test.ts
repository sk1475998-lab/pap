import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import * as os from "node:os";
import * as path from "node:path";
import * as fs from "node:fs";
import {
  EventBus,
  MemoryEventStorage,
  MetricsRegistry,
  registerDefaultMetrics,
  AnalyticsTracker,
} from "./index.js";

describe("Privacy-Preserving Analytics", () => {
  describe("EventBus & PII Stripping", () => {
    it("buffers events and notifies subscribers", async () => {
      const storage = new MemoryEventStorage();
      const bus = new EventBus({ enabled: true, storage, maxBufferSize: 10 });

      const received: any[] = [];
      bus.on("autofill_complete", (evt) => {
        received.push(evt);
      });

      await bus.track("autofill_complete", {
        jobId: "job_123",
        durationMs: 450,
      });

      assert.strictEqual(received.length, 1);
      assert.strictEqual(received[0].name, "autofill_complete");
      assert.strictEqual(received[0].category, "user_action");
      assert.strictEqual(received[0].properties?.jobId, "job_123");
      assert.strictEqual(received[0].properties?.durationMs, 450);

      bus.destroy();
    });

    it("strips PII keys and sanitizes sensitive values from properties", async () => {
      const bus = new EventBus({ enabled: true });
      let captured: any = null;

      bus.on("user_profile_updated", (evt) => {
        captured = evt;
      });

      await bus.track("user_profile_updated", {
        email: "alice@example.com",
        phone: "+1-555-0199",
        password: "supersecretpassword",
        user_name: "Alice Smith",
        safeNote: "Contact me at bob@testcorp.org or (555) 123-4567 for details",
        role: "Software Engineer",
      });

      assert.ok(captured, "Event must be received");
      // PII keys should be completely excluded
      assert.strictEqual(captured.properties.email, undefined);
      assert.strictEqual(captured.properties.phone, undefined);
      assert.strictEqual(captured.properties.password, undefined);
      assert.strictEqual(captured.properties.user_name, undefined);

      // Safe note should have inline emails/phones masked
      assert.ok(captured.properties.safeNote.includes("[EMAIL]"));
      assert.ok(captured.properties.safeNote.includes("[PHONE]"));
      assert.strictEqual(captured.properties.role, "Software Engineer");

      bus.destroy();
    });

    it("categorizes event names correctly", async () => {
      const bus = new EventBus({ enabled: true });
      let errEvt: any = null;
      let perfEvt: any = null;

      bus.on("error_submission", (evt) => { errEvt = evt; });
      bus.on("perf_render", (evt) => { perfEvt = evt; });

      await bus.track("error_submission", { code: 500 });
      await bus.track("perf_render", { duration: 120 });

      assert.strictEqual(errEvt?.category, "error");
      assert.strictEqual(perfEvt?.category, "performance");

      bus.destroy();
    });
  });

  describe("MetricsRegistry", () => {
    let registry: MetricsRegistry;

    beforeEach(() => {
      registry = new MetricsRegistry();
    });

    it("records and increments counter metrics", () => {
      registry.register({
        name: "applications_submitted",
        type: "counter",
        description: "Total job applications successfully submitted",
      });

      registry.increment("applications_submitted", { source: "greenhouse" }, 1);
      registry.increment("applications_submitted", { source: "greenhouse" }, 2);

      const vals = registry.getMetricValues("applications_submitted");
      assert.strictEqual(vals.length, 1);
      assert.strictEqual(vals[0].value, 3);
    });

    it("sets gauge metrics", () => {
      registry.register({
        name: "active_sessions",
        type: "gauge",
      });

      registry.setGauge("active_sessions", 5);
      registry.setGauge("active_sessions", 3);

      const vals = registry.getMetricValues("active_sessions");
      assert.strictEqual(vals.length, 1);
      assert.strictEqual(vals[0].value, 3);
    });

    it("observes histogram and measures execution duration via timer", () => {
      registry.register({
        name: "form_fill_duration_ms",
        type: "histogram",
      });

      const timer = registry.startTimer("form_fill_duration_ms", { portal: "lever" });
      const duration = timer.stop();

      assert.ok(duration >= 0);
      const vals = registry.getMetricValues("form_fill_duration_ms");
      assert.strictEqual(vals.length, 1);
      assert.strictEqual(vals[0].type, "histogram");
    });

    it("registers default application metrics", () => {
      registerDefaultMetrics(registry);
      const all = registry.getValues();
      assert.ok(Array.isArray(all));
    });
  });

  describe("AnalyticsTracker", () => {
    it("initializes storage and records daily application statistics", () => {
      const tmpDir = path.join(os.tmpdir(), `superjob-analytics-${Date.now()}`);
      try {
        const tracker = new AnalyticsTracker(tmpDir);

        tracker.trackApplicationSuccess(1200);
        tracker.trackApplicationFailure(800);
        tracker.trackApplicationSuccess(1500);
        tracker.trackApplicationSkipped();

        const summary = tracker.getDailyStats();
        assert.strictEqual(summary.totalApplied, 2);
        assert.strictEqual(summary.totalFailed, 1);
        assert.strictEqual(summary.totalSkipped, 1);
        assert.strictEqual(summary.timeSpentMs, 3500);

        const overall = tracker.getOverallStats();
        assert.strictEqual(overall.totalApplied, 2);
        assert.ok(Math.abs(overall.successRate - 66.66) < 0.1);
      } finally {
        if (fs.existsSync(tmpDir)) {
          fs.rmSync(tmpDir, { recursive: true, force: true });
        }
      }
    });
  });
});
