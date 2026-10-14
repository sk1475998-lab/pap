import test from "node:test";
import assert from "node:assert/strict";
import { recommendJob, recommendJobs, type Job, type Profile } from "@superjob/core";

const profile: Profile = {
  id: "p-rec",
  firstName: "Shashi",
  lastName: "Kumar",
  email: "shashi@example.com",
  phone: "9876543210",
  location: "Bengaluru, India",
  city: "Bengaluru",
  state: "Karnataka",
  pincode: "560001",
  country: "India",
  phoneCountryCode: "+91",
  linkedin: "https://linkedin.com/in/shashi",
  github: "https://github.com/shashi",
  website: "",
  resumeUrl: "",
  locale: "IN",
  workAuthorization: "Authorized to work in India",
  requiresSponsorship: "No",
  willingToRelocate: "Yes",
  immediateJoiner: "No",
  yearsOfExperience: "4",
  currentCTC: "14 LPA",
  expectedCTC: "22 LPA",
  ctcCurrency: "INR",
  salaryExpectation: "22 LPA",
  noticePeriod: "30 days",
  lastWorkingDay: "",
  pan: "",
  aadhaar: "",
  pronouns: "",
  middleName: "",
  gender: "",
  dateOfBirth: "",
  resumeFileName: "",
  resumeMimeType: "",
  resumeUploadedAt: 0,
  learnedLog: [],
  customAnswers: {},
  summary: "Frontend Engineer with React TypeScript GraphQL AWS performance accessibility experience",
  skills: ["React", "TypeScript", "GraphQL", "AWS", "Jest", "Cypress", "Node.js"],
  experience: [],
  education: [],
  projects: [],
  certifications: [],
  languages: ["English", "Hindi", "Telugu"],
  awards: [],
  publications: [],
  socialLinks: [],
  workAuthorizations: [],
  jobPreferences: { roleTitles: ["Frontend Engineer"], locations: ["Bengaluru", "Hyderabad"], remotePreference: "Hybrid", minSalary: "22", currency: "INR", excludedCompanies: [] },
  ethnicity: "",
  veteranStatus: "",
  disabilityStatus: "",
  defaultLoginEmail: "",
  defaultLoginPassword: "",
  masterResumeText: `SHASHI KUMAR
shashi@example.com | +91 9876543210 | Bengaluru | linkedin.com/in/shashi | github.com/shashi
SUMMARY
Frontend Engineer with React TypeScript GraphQL AWS performance accessibility experience.
SKILLS
React, TypeScript, JavaScript, GraphQL, AWS, Jest, Cypress, Node.js, REST API
WORK EXPERIENCE
Frontend Engineer at Acme
- Built React TypeScript dashboards with GraphQL and REST APIs.
- Improved performance and accessibility.
EDUCATION
B.Tech Computer Science`,
  updatedAt: Date.now(),
};

const goodJob: Job = {
  id: "good",
  url: "https://company.example/jobs/frontend",
  title: "Senior Frontend Engineer",
  company: "Razorpay",
  location: "Bengaluru",
  description: "Required qualifications: React TypeScript GraphQL REST API performance accessibility Jest Cypress AWS. Budget 22-35 LPA. Join within 45 days.",
  salary: "22-35 LPA",
  remote: false,
  source: "company",
  postedAt: new Date().toISOString(),
  savedAt: Date.now(),
};

const riskyJob: Job = {
  id: "risky",
  url: "https://fake.example/job",
  title: "Easy money React job",
  company: "Unknown HR",
  location: "Remote India",
  description: "Pay registration fee security deposit and send Aadhaar PAN bank statement before interview. No interview easy money.",
  salary: "",
  remote: true,
  source: "unknown",
  savedAt: Date.now(),
};

test("job recommendation ranks high-fit trusted India job as apply now", () => {
  const rec = recommendJob(profile, goodJob);
  assert.ok(rec.score >= 70, `score=${rec.score}`);
  assert.notEqual(rec.decision, "skip");
  assert.ok(rec.reasons.some((r) => r.kind === "positive"));
  assert.ok(rec.actions.length > 0);
});

test("job recommendation penalizes risky duplicate/scam jobs", () => {
  const rec = recommendJob(profile, riskyJob);
  assert.equal(rec.decision, "skip");
  assert.ok(rec.india.trust.warnings.length >= 1);
  assert.ok(rec.score < 50, `score=${rec.score}`);
});

test("recommendJobs sorts best opportunities first", () => {
  const batch = recommendJobs(profile, [riskyJob, goodJob], { includeSkipped: true, minScore: 0 });
  assert.equal(batch.total, 2);
  assert.equal(batch.top[0]?.job.id, "good");
  assert.ok(batch.summary.includes("Best recommendation"));
});
