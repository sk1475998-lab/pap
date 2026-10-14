import test from "node:test";
import assert from "node:assert/strict";
import {
  parseModelJson,
  snapAnswerToOptions,
  normalizeSkillBuckets,
  extractSkillsStructured,
  estimateCallCostUsd,
  SKILL_EXTRACTION_SYSTEM,
  buildSkillExtractionUserMessage,
} from "./robust.js";

test("parseModelJson strips ```json fences", () => {
  const out = parseModelJson('```json\n{"skills": ["python", "react"]}\n```');
  assert.deepEqual(out, { skills: ["python", "react"] });
});

test("parseModelJson handles bare fences and surrounding prose", () => {
  assert.deepEqual(parseModelJson('Here you go:\n```\n{"a": 1}\n```\nThanks!'), { a: 1 });
  assert.deepEqual(parseModelJson('prefix {"a": 1, "b": [1,2]} suffix'), { a: 1, b: [1, 2] });
});

test("parseModelJson recovers first top-level array amid prose", () => {
  assert.deepEqual(parseModelJson('result = ["x", "y"] done'), ["x", "y"]);
});

test("parseModelJson returns undefined for non-JSON", () => {
  assert.equal(parseModelJson("definitely not json"), undefined);
  assert.equal(parseModelJson("{ unclosed"), undefined);
  assert.equal(parseModelJson(""), undefined);
});

test("parseModelJson falls back to bare scalar parse", () => {
  assert.equal(parseModelJson("42"), 42);
  assert.equal(parseModelJson("true"), true);
});

test("snapAnswerToOptions: exact and case-insensitive matches", () => {
  const opts = [
    { value: "yes", label: "Yes" },
    { value: "no", label: "No" },
    { value: "us_citizen", label: "U.S. Citizen / Permanent Resident" },
  ];
  assert.equal(snapAnswerToOptions("Yes", opts), "Yes");
  assert.equal(snapAnswerToOptions("no", opts), "no"); // raw equals value
  assert.equal(snapAnswerToOptions("US_CITIZEN", opts), "us_citizen"); // case-insensitive → canonical value
  // case-insensitive long phrase → canonical label via fuzzy tier
  assert.equal(snapAnswerToOptions("us citizen / permanent resident", opts), "U.S. Citizen / Permanent Resident");
});

test("snapAnswerToOptions: substring in either direction", () => {
  const opts = [
    { value: "sponsor_no", label: "No, I do not require sponsorship" },
    { value: "veteran_no", label: "No" },
  ];
  // "No, I do not require sponsorship" is a substring of nothing, but the label
  // of the answer appears within label? Use the reverse: label contains short query.
  assert.equal(snapAnswerToOptions("No", opts), "No");
});

test("snapAnswerToOptions: fuzzy tier catches typos", () => {
  const opts = [{ value: "us_citizen", label: "United States Citizen" }];
  // Typo'd label matches via blended similarity above default 0.82? check it snaps
  const snapped = snapAnswerToOptions("United States Citzen", opts);
  assert.equal(snapped, "United States Citizen");
});

test("snapAnswerToOptions: returns raw when nothing is close (never invents)", () => {
  const opts = [{ value: "yes", label: "Yes" }, { value: "no", label: "No" }];
  assert.equal(snapAnswerToOptions("I prefer purple", opts), "I prefer purple");
  assert.equal(snapAnswerToOptions("", opts), "");
  assert.equal(snapAnswerToOptions("yes", []), "yes");
});

test("normalizeSkillBuckets parses camelCase and snake_case variants", () => {
  const b = normalizeSkillBuckets({
    techStack: ["Python", "React"],
    technical_skills: "System Design, Data Engineering",
    otherSkills: ["Communication"],
    requiredSkills: [],
    niceToHave: [],
  });
  assert.deepEqual(b?.techStack, ["Python", "React"]);
  assert.deepEqual(b?.technicalSkills, ["System Design", "Data Engineering"]);
  assert.deepEqual(b?.otherSkills, ["Communication"]);
});

test("normalizeSkillBuckets rejects empty/non-object", () => {
  assert.equal(normalizeSkillBuckets(null), undefined);
  assert.equal(normalizeSkillBuckets("nope"), undefined);
  assert.equal(normalizeSkillBuckets({ a: 1 }), undefined); // no bucket keys
});

test("skill extraction prompts carry the taxonomy and the JD", () => {
  assert.ok(SKILL_EXTRACTION_SYSTEM.includes("techStack"));
  assert.ok(SKILL_EXTRACTION_SYSTEM.includes("niceToHave"));
  const user = buildSkillExtractionUserMessage("We need a Python engineer with React.");
  assert.ok(user.includes("Python engineer with React"));
  assert.ok(user.includes("JOB DESCRIPTION"));
});

test("extractSkillsStructured parses a fenced JSON reply into buckets", async () => {
  const stub = {
    isAvailable: () => true,
    complete: async () =>
      '```json\n{"techStack":["python","react"],"technicalSkills":[],"otherSkills":["communication"],"requiredSkills":["python"],"niceToHave":["docker"]}\n```',
  };
  const res = await extractSkillsStructured(stub, "We need python + react engineers.");
  assert.equal(res.ok, true);
  if (res.ok) {
    assert.deepEqual(res.buckets.techStack, ["python", "react"]);
    assert.deepEqual(res.buckets.niceToHave, ["docker"]);
  }
});

test("extractSkillsStructured handles unavailable LLM and garbage replies", async () => {
  const unavailable = { isAvailable: () => false, complete: async () => "" };
  const res1 = await extractSkillsStructured(unavailable, "job");
  assert.equal(res1.ok, false);
  const garbage = { isAvailable: () => true, complete: async () => "I cannot do that." };
  const res2 = await extractSkillsStructured(garbage, "job");
  assert.equal(res2.ok, false);
  const res3 = await extractSkillsStructured(garbage, "   ");
  assert.equal(res3.ok, false); // empty JD
});

test("extractSkillsStructured surfaces thrown errors", async () => {
  const boom = {
    isAvailable: () => true,
    complete: async () => {
      throw new Error("rate limited");
    },
  };
  const res = await extractSkillsStructured(boom, "job description");
  assert.equal(res.ok, false);
  if (!res.ok) assert.ok(res.error.includes("rate limited"));
});

test("estimateCallCostUsd prefers reported cost and falls back to list price", () => {
  assert.deepEqual(estimateCallCostUsd({ reportedCostUsd: 0.012, inputTokens: 10, outputTokens: 5 }), {
    costUsd: 0.012,
    source: "reported",
  });
  const est = estimateCallCostUsd({
    inputTokens: 1_000_000,
    outputTokens: 0,
    inputPerMillionUsd: 0.09,
    outputPerMillionUsd: 0.18,
  });
  assert.equal(est.costUsd, 0.09);
  assert.equal(est.source, "estimated");
  const zero = estimateCallCostUsd({ inputTokens: 0, outputTokens: 0 });
  assert.deepEqual(zero, { costUsd: 0, source: "zero" });
});
