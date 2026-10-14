import assert from "node:assert/strict";
import test from "node:test";
import {
  hasAlreadyApplied,
  jobKey,
  setApplicationPhase,
} from "../packages/extension/src/lib/app-state.ts";

test("external-autopilot duplicate dependency blocks a submitted application", () => {
  const url = "https://jobs.example.test/apply/role-123?source=search";
  const key = jobKey(url, "Software Engineer", "Acme");
  setApplicationPhase(key, "SUBMITTED", {
    url,
    title: "Software Engineer",
    company: "Acme",
  });

  assert.equal(hasAlreadyApplied(url, "Software Engineer", "Acme"), true);
  assert.equal(hasAlreadyApplied("https://jobs.example.test/apply/other-role", "Software Engineer", "Acme"), false);
});
