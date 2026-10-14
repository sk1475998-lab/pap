import test from "node:test";
import assert from "node:assert/strict";
import {
  normalizeQuestionText,
  detectScreeningIntent,
  resolveScreeningAnswer,
  salaryInLakhs,
  salaryMonthly,
  noticePeriodForUnit,
  booleanAnswerText,
  booleanOptionCandidates,
} from "./screening-answers.js";
import { smartDefaultForQuestion } from "./resolver.js";

const CFG = {
  yearsOfExperience: "5",
  requireVisa: false,
  citizenship: "U.S. Citizen/Permanent Resident",
  desiredAnnualCompensation: 1_200_000,
  currentAnnualCompensation: 800_000,
  noticePeriodDays: 66,
  fullName: "Ada Lovelace",
  firstName: "Ada",
  lastName: "Lovelace",
  phoneNumber: "+91 98765 43210",
  linkedInUrl: "https://linkedin.com/in/ada",
  githubUrl: "https://github.com/ada",
  portfolioUrl: "https://ada.dev",
  websiteUrl: "https://blog.ada.dev",
  headline: "Full Stack Developer",
  summary: "Engineer with 5+ years.",
  coverLetter: "Dear hiring team…",
  confidenceLevel: "8",
  recentEmployer: "Analytical Engines Ltd",
};

test("normalizeQuestionText lowercases and strips punctuation", () => {
  assert.equal(
    normalizeQuestionText("What is your Expected CTC (in lakhs)?"),
    "what is your expected ctc in lakhs"
  );
  assert.equal(normalizeQuestionText("Do you need visa sponsorship? Yes/No"), "do you need visa sponsorship yes no");
  assert.equal(normalizeQuestionText(""), "");
});

test("salary lakhs conversion matches the reference examples", () => {
  assert.equal(salaryInLakhs(2_400_000), "24.00");
  assert.equal(salaryInLakhs(850_000), "8.50");
  assert.equal(salaryInLakhs(1_200_000), "12.00");
});

test("salary monthly conversion matches the reference examples", () => {
  assert.equal(salaryMonthly(2_400_000), "200000");
  assert.equal(salaryMonthly(850_000), "70833");
});

test("notice-period unit conversions match the reference examples", () => {
  assert.equal(noticePeriodForUnit(66, "months"), "3");
  assert.equal(noticePeriodForUnit(66, "weeks"), "10");
  assert.equal(noticePeriodForUnit(66, "days"), "66");
  assert.equal(noticePeriodForUnit(15, "months"), "1");
  assert.equal(noticePeriodForUnit(15, "weeks"), "3");
  assert.equal(noticePeriodForUnit(0, "days"), "0");
});

test("detectScreeningIntent classifies visa/sponsorship", () => {
  assert.equal(detectScreeningIntent("Will you now or in the future require sponsorship?").intent, "sponsorship");
  assert.equal(detectScreeningIntent("Do you require visa sponsorship?").intent, "sponsorship");
});

test("salary detection picks kind + unit (desired annual, current lakhs, desired monthly)", () => {
  assert.deepEqual(detectScreeningIntent("What is your desired salary?"), {
    intent: "salary", salaryKind: "desired", unit: "annual",
  });
  assert.deepEqual(detectScreeningIntent("What is your current CTC in lakhs?"), {
    intent: "salary", salaryKind: "current", unit: "lakhs",
  });
  assert.deepEqual(detectScreeningIntent("Expected monthly compensation?"), {
    intent: "salary", salaryKind: "desired", unit: "monthly",
  });
});

test("resolveScreeningAnswer: salary respects desired/current + unit", () => {
  const desired = resolveScreeningAnswer("What is your expected CTC (in lakhs)?", CFG);
  assert.equal(desired.intent, "desiredSalary");
  assert.equal(desired.answer, "12.00");
  assert.equal(desired.matched, true);

  const currentMonthly = resolveScreeningAnswer("What is your current monthly salary?", CFG);
  assert.equal(currentMonthly.intent, "currentSalary");
  assert.equal(currentMonthly.answer, "66667");
  assert.equal(currentMonthly.matched, true);

  const annual = resolveScreeningAnswer("Annual salary expectation?", CFG);
  assert.equal(annual.answer, "1200000");
});

test("resolveScreeningAnswer: notice period honors asked unit", () => {
  assert.equal(resolveScreeningAnswer("What is your notice period in months?", CFG).answer, "3");
  assert.equal(resolveScreeningAnswer("Notice period in weeks?", CFG).answer, "10");
  assert.equal(resolveScreeningAnswer("Notice period?", CFG).answer, "66");
});

test("resolveScreeningAnswer: boolean + free-text questions", () => {
  assert.equal(resolveScreeningAnswer("Will you require visa sponsorship?", CFG).answer, "No");
  assert.equal(resolveScreeningAnswer("What is your citizenship status?", CFG).answer, "U.S. Citizen/Permanent Resident");
  assert.equal(resolveScreeningAnswer("How many years of experience do you have?", CFG).answer, "5");
});

test("resolveScreeningAnswer: name part precedence first/middle/last/full", () => {
  assert.equal(resolveScreeningAnswer("First name", CFG).answer, "Ada");
  assert.equal(resolveScreeningAnswer("Last name", CFG).answer, "Lovelace");
  assert.equal(resolveScreeningAnswer("Full legal name", CFG).answer, "Ada Lovelace");
  assert.equal(resolveScreeningAnswer("Type your name here", CFG).answer, "Ada Lovelace");
});

test("does not derive individual legal-name fields from a full name", () => {
  assert.equal(resolveScreeningAnswer("First name", { fullName: "Ada Lovelace" }).matched, false);
  assert.equal(resolveScreeningAnswer("Last name", { fullName: "Ada Lovelace" }).matched, false);
});

test("does not derive individual legal-name fields from a full name", () => {
  assert.equal(resolveScreeningAnswer("First name", { fullName: "Ada Lovelace" }).matched, false);
  assert.equal(resolveScreeningAnswer("Last name", { fullName: "Ada Lovelace" }).matched, false);
});

test("candidate authorization, relocation, education and consent need explicit answers", () => {
  for (const question of [
    "Are you authorized to work here?",
    "Will you require visa sponsorship?",
    "Are you willing to relocate?",
    "Have you completed your degree?",
    "Do you consent to a background check?",
  ]) {
    assert.equal(smartDefaultForQuestion(question), undefined, question);
  }
});

test("resolveScreeningAnswer: links disambiguate linkedin/github/portfolio/website", () => {
  assert.equal(resolveScreeningAnswer("LinkedIn profile URL", CFG).answer, "https://linkedin.com/in/ada");
  assert.equal(resolveScreeningAnswer("Link to your GitHub", CFG).answer, "https://github.com/ada");
  assert.equal(resolveScreeningAnswer("Portfolio website link", CFG).answer, "https://ada.dev");
  assert.equal(resolveScreeningAnswer("Personal website or blog", CFG).answer, "https://blog.ada.dev");
});

test("resolveScreeningAnswer returns matched:false instead of guessing (never random)", () => {
  const r = resolveScreeningAnswer("How did you hear about this job?", CFG);
  assert.equal(r.matched, false); // how-heard is intentionally never auto-answered
  assert.equal(resolveScreeningAnswer("Describe your experience with React", CFG).matched, false); // essay != years
  assert.equal(resolveScreeningAnswer("What is your expected salary?", {}).matched, false); // no config
});

test("resolveScreeningAnswer honors explicit per-question overrides", () => {
  const cfg = { ...CFG, overrides: { "what is your work location preference": "Remote" } };
  const r = resolveScreeningAnswer("What is your work location preference?", cfg);
  assert.equal(r.answer, "Remote");
  assert.equal(r.matched, true);
});

test("booleanOptionCandidates provides select/radio option phrases", () => {
  assert.ok(booleanOptionCandidates(true).some((s) => s.toLowerCase().includes("yes")));
  assert.ok(booleanOptionCandidates(false).some((s) => s.toLowerCase().includes("no")));
  assert.equal(booleanAnswerText(true), "Yes");
  assert.equal(booleanAnswerText(false), "No");
});
