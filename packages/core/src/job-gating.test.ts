import { test } from "node:test";
import assert from "node:assert/strict";
import {
  extractYearsRequiredMultilingual,
  parseBlacklist,
  evaluateJobGates,
} from "./job-gating.js";

test("extractYearsRequiredMultilingual handles english forms", () => {
  assert.equal(extractYearsRequiredMultilingual("5+ years experience required"), 5);
  assert.equal(extractYearsRequiredMultilingual("Requires 5-8 years of experience"), 8);
  assert.equal(extractYearsRequiredMultilingual("minimum of 3 years in backend"), 3);
  assert.equal(extractYearsRequiredMultilingual("at least 2 yrs"), 2);
  assert.equal(extractYearsRequiredMultilingual("7 years of experience"), 7);
});

test("extractYearsRequiredMultilingual handles other languages", () => {
  assert.equal(extractYearsRequiredMultilingual("5 ans d'expérience"), 5);
  assert.equal(extractYearsRequiredMultilingual("mínimo 3 años"), 3);
  assert.equal(extractYearsRequiredMultilingual("mindestens 4 Jahre Erfahrung"), 4);
  assert.equal(extractYearsRequiredMultilingual("5 anni di esperienza"), 5);
  assert.equal(extractYearsRequiredMultilingual("con 5+ años de experiencia"), 5);
});

test("extractYearsRequiredMultilingual returns 0 when no requirement", () => {
  assert.equal(extractYearsRequiredMultilingual("Join our team today"), 0);
  assert.equal(extractYearsRequiredMultilingual(""), 0);
  assert.equal(extractYearsRequiredMultilingual("experienced team preferred"), 0);
});

test("parseBlacklist normalizes comma strings and arrays", () => {
  assert.deepEqual(parseBlacklist("Acme, Beta Corp , gamma"), ["acme", "beta corp", "gamma"]);
  assert.deepEqual(parseBlacklist(["Foo", " bar "]), ["foo", "bar"]);
  assert.deepEqual(parseBlacklist(undefined), []);
});

test("evaluateJobGates skips on company blacklist hit", () => {
  const r = evaluateJobGates(
    { title: "Engineer", company: "Acme Corp", description: "no terms" },
    { blacklistKeywords: "acme" },
  );
  assert.deepEqual(r, { skip: true, reason: "blacklist", keyword: "acme" });
});

test("evaluateJobGates skips when JD demands more experience than max", () => {
  const r = evaluateJobGates(
    { title: "Sr Engineer", company: "GoodCo", description: "Need 8+ years of experience" },
    { maxYearsRequired: 5 },
  );
  assert.deepEqual(r, { skip: true, reason: "experience", yearsRequired: 8, maxYears: 5 });
});

test("evaluateJobGates passes qualifying jobs and reports years", () => {
  const r = evaluateJobGates(
    { title: "Engineer", company: "GoodCo", description: "Need 2+ years" },
    { maxYearsRequired: 10, blacklistKeywords: "acme, evil inc" },
  );
  assert.deepEqual(r, { skip: false, yearsRequired: 2 });
});
