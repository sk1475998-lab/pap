import assert from "node:assert/strict";
import test from "node:test";
import {
  JOB_KEY_EXTRACTORS,
  canonicalJobKey,
  extractProviderJobKey,
  type JobKeyExtractor,
} from "../packages/core/src/index.ts";

test("job-key registry preserves provider keys and keeps generic fallback separate", () => {
  assert.equal(canonicalJobKey("https://www.linkedin.com/jobs/view/123456?ref=abc"), "linkedin:123456");
  assert.equal(canonicalJobKey("https://boards.greenhouse.io/acme/jobs/78901"), "greenhouse:78901");
  assert.equal(canonicalJobKey("https://example.test/careers/apply?id=42", "Staff Engineer", "Acme"), "page:https://example.test/careers/apply:staff-engineer:acme");
  assert.ok(JOB_KEY_EXTRACTORS.length >= 10);
});

test("job-key extractor registry accepts a new provider without changing fallback logic", () => {
  const fixture: JobKeyExtractor = { id: "fixture", extract: (url) => url.includes("fixture.test/job/") ? "abc" : null };
  assert.equal(extractProviderJobKey("https://fixture.test/job/abc", [fixture]), "fixture:abc");
  assert.equal(extractProviderJobKey("https://example.test/no-match", [fixture]), null);
});
