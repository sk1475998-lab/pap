import test from "node:test";
import assert from "node:assert/strict";
import {
  FIXTURE_FIELD_CATALOG,
  validateQaFixture,
  isQaFixtureValid,
  firstQaFixtureIssue,
} from "./qa-fixtures.js";

function validFixture(): unknown {
  return {
    schemaVersion: 1,
    id: "greenhouse-single-page-2026-09-v1",
    platformFamily: "greenhouse-single-page",
    captureMonth: "2026-09",
    compilerVersion: "1.0.0",
    provenance: {
      recorderVersion: "0.1.0",
      captureMonth: "2026-09",
      sourceRecordingSha256: "a".repeat(64),
    },
    oracle: { finalActionActivations: 0 },
    steps: [
      {
        id: "step-1",
        kind: "form",
        title: "Contact information",
        next: "step-2",
        controls: [
          { id: "contact.email", kind: "contact.email", role: "textbox", label: "Email address", required: true },
          { id: "contact.phone", kind: "contact.phone", role: "textbox", label: "Phone number", required: true },
        ],
      },
      {
        id: "step-2",
        kind: "review",
        title: "Review",
        finalAction: { id: "submit", label: "Submit Application", enabled: true, tripwire: true },
        controls: [],
      },
    ],
  };
}

test("field catalog exposes canonical role+label for common ids", () => {
  assert.deepEqual(FIXTURE_FIELD_CATALOG["contact.email"], ["textbox", "Email address"]);
  assert.deepEqual(FIXTURE_FIELD_CATALOG["authorization.sponsorship"][0], "radiogroup");
  assert.deepEqual(FIXTURE_FIELD_CATALOG["resume.file"][0], "file");
  assert.ok(Object.keys(FIXTURE_FIELD_CATALOG).length >= 20);
});

test("a well-formed fixture validates clean", () => {
  assert.equal(isQaFixtureValid(validFixture()), true);
  assert.equal(validateQaFixture(validFixture()).length, 0);
});

test("bad fixture id, capture month and sha256 are all caught", () => {
  const f = validFixture() as { id: string; captureMonth: string; provenance: { sourceRecordingSha256: string } };
  f.id = "bad id!";
  f.captureMonth = "09-2026";
  (f.provenance as { sourceRecordingSha256: string }).sourceRecordingSha256 = "xyz";
  const issues = validateQaFixture(f);
  assert.ok(issues.some((i) => i.path === "$.id"));
  assert.ok(issues.some((i) => i.path === "$.captureMonth"));
  assert.ok(issues.some((i) => i.path === "$.provenance.sourceRecordingSha256"));
});

test("wrong schemaVersion is rejected", () => {
  const f = validFixture() as { schemaVersion: number };
  f.schemaVersion = 2;
  assert.equal(isQaFixtureValid(f), false);
  assert.ok(firstQaFixtureIssue(f)?.includes("schemaVersion"));
});

test("unknown keys are reported (fixture, step, control)", () => {
  const f = validFixture() as Record<string, unknown>;
  f.extraTop = true;
  (f.steps as Array<Record<string, unknown>>)[0].surprise = 1;
  ((f.steps as Array<{ controls: Array<Record<string, unknown>> }>)[0].controls[0] as Record<string, unknown>).wat = 2;
  const issues = validateQaFixture(f);
  assert.ok(issues.some((i) => i.path === "$.extraTop"));
  assert.ok(issues.some((i) => i.path === "$.steps[0].surprise"));
  assert.ok(issues.some((i) => i.path === "$.steps[0].controls[0].wat"));
});

test("step kind and control label enforcement", () => {
  const f = validFixture() as { steps: Array<Record<string, unknown>> };
  f.steps[0].kind = "wizard";
  const issues = validateQaFixture(f);
  assert.ok(issues.some((i) => i.path === "$.steps[0].kind"));
});

test("missing provenance and oracle are reported", () => {
  const f = validFixture() as Record<string, unknown>;
  delete f.provenance;
  delete f.oracle;
  const issues = validateQaFixture(f);
  assert.ok(issues.some((i) => i.path === "$.provenance"));
  assert.ok(issues.some((i) => i.path === "$.oracle"));
});

test("non-object and non-array root guard", () => {
  assert.equal(firstQaFixtureIssue(null), "fixture must be an object");
  const issues = validateQaFixture({ ...(validFixture() as object), steps: "nope" });
  assert.ok(issues.some((i) => i.path === "$.steps"));
});
