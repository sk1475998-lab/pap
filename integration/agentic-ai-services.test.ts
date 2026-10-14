import test from "node:test";
import assert from "node:assert/strict";
import {
  extractEarlyAdvantage,
  extractHiringTeam,
} from "../packages/extension/src/lib/job-extract.js";
import {
  generateOutreach,
  generateCoverLetter,
  createProfile,
  createLLM,
  type Job,
  type Profile,
} from "@superjob/core";

test("Early Advantage: parses various applicant volume and recency strings", () => {
  // Under 25 applicants (high advantage)
  const r1 = extractEarlyAdvantage("Be among the first 25 applicants · 2 hours ago");
  assert.ok(r1);
  assert.equal(r1.isEarlyBird, true);
  assert.ok(r1.advantageScore >= 90);
  assert.equal(r1.salienceTier ?? r1.callbackMultiplier, "early");

  // Exact number under 25
  const r2 = extractEarlyAdvantage("12 applicants · Reposted 1 hour ago");
  assert.ok(r2);
  assert.equal(r2.isEarlyBird, true);
  assert.equal(r2.applicantCount, 12);
  assert.equal(r2.salienceTier ?? r2.callbackMultiplier, "early");

  // High competition (>200 applicants)
  const r3 = extractEarlyAdvantage("Over 200 applicants · 3 weeks ago");
  assert.ok(r3);
  assert.equal(r3.isEarlyBird, false);
  assert.ok(r3.advantageScore <= 50);
  assert.equal(r3.salienceTier ?? r3.callbackMultiplier, "competitive");

  // Edge cases: null, empty string, non-matching text
  assert.equal(extractEarlyAdvantage(""), null);
  assert.equal(extractEarlyAdvantage(undefined as any), null);
  assert.equal(extractEarlyAdvantage("Full-time · Entry level"), null);
});

test("Hiring Team: extracts recruiter name, title and link with robustness", () => {
  // Standard LinkedIn format
  const text1 = "Hiring team: Sarah Connor · Senior Technical Recruiter at Cyberdyne Systems";
  const h1 = extractHiringTeam(text1);
  assert.ok(h1);
  assert.equal(h1.name, "Sarah Connor");
  assert.ok(h1.title?.includes("Recruiter"));

  // Format with Meet the hiring team
  const text2 = "Meet the hiring team\nJohn Smith\nEngineering Director at TechCorp";
  const h2 = extractHiringTeam(text2);
  assert.ok(h2);
  assert.equal(h2.name, "John Smith");
  assert.ok(h2.title?.includes("Engineering Director"));

  // Edge cases
  assert.equal(extractHiringTeam(""), null);
  assert.equal(extractHiringTeam(undefined as any), null);
  assert.equal(extractHiringTeam("No team info here"), null);
});

test("Outreach Generator: creates LinkedIn invites under 300 chars with recruiter personalization", () => {
  const profileName = "Alex Vance";
  const skills = ["React", "TypeScript", "Node.js"];
  const jobTitle = "Senior Full-Stack Engineer";
  const company = "Acme Corp";
  const recruiterName = "Sarah Connor";

  const outreach = generateOutreach(profileName, skills, jobTitle, company, recruiterName);

  assert.ok(outreach);
  assert.ok(outreach.linkedin);
  // LinkedIn connection invite character limit is 300 characters
  assert.ok(outreach.linkedin.length <= 300, `Connection invite length ${outreach.linkedin.length} exceeds 300`);
  assert.ok(outreach.linkedin.includes("Sarah Connor"), "Connection invite should address recruiter by name");

  // Email Pitch
  assert.ok(outreach.email);
  assert.ok(outreach.email.includes("Sarah Connor") && outreach.email.includes("Acme Corp"));

  // Follow-up
  assert.ok(outreach.followUp);
  assert.ok(outreach.followUp.includes("Acme Corp"));
  assert.ok(outreach.followUp.length <= 300);

  // Defensive check: undefined skills or empty strings do not crash
  const emptyOutreach = generateOutreach("", undefined as any, "", "");
  assert.ok(emptyOutreach.linkedin);
  assert.ok(emptyOutreach.email);
});

test("Cover Letter Generator: generates structured high-signal pitch without LLM", async () => {
  const profile = createProfile({
    firstName: "Alex",
    lastName: "Vance",
    email: "alex@example.com",
    masterResumeText: "Lead backend engineer with 8 years building distributed microservices in Go and Python on AWS.",
    skills: ["Go", "Python", "AWS", "Microservices"],
  });

  const job: Pick<Job, "title" | "company" | "description"> = {
    title: "Principal Distributed Systems Engineer",
    company: "CloudScale Inc",
    description: "Architect high-throughput services using Go, Python, and AWS.",
  };

  const llm = createLLM({ provider: "none" });

  const result = await generateCoverLetter(job, profile, llm, "professional");

  assert.ok(result);
  assert.ok(result.text.length > 100);
  assert.ok(result.text.includes("CloudScale Inc"));
  assert.ok(result.text.includes("Principal Distributed Systems Engineer"));
});
