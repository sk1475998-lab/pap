import test from "node:test";
import assert from "node:assert/strict";
import { analyzeIndiaOpportunity, detectIndiaBoard, parseIndianLpa, parseNoticeDays, type Job, type Profile } from "@superjob/core";

const profile = {
  id: "p-india",
  firstName: "Shashi",
  lastName: "Kumar",
  email: "shashi@example.com",
  phone: "9999999999",
  location: "Hyderabad, Telangana",
  city: "Hyderabad",
  state: "Telangana",
  pincode: "500081",
  country: "India",
  phoneCountryCode: "+91",
  linkedin: "",
  github: "",
  website: "",
  resumeUrl: "",
  locale: "IN",
  workAuthorization: "Authorized to work in India",
  requiresSponsorship: "No",
  willingToRelocate: "Yes",
  immediateJoiner: "No",
  yearsOfExperience: "3",
  currentCTC: "12 LPA",
  expectedCTC: "18 LPA",
  ctcCurrency: "INR",
  salaryExpectation: "18 LPA",
  noticePeriod: "30 days",
  lastWorkingDay: "",
  pan: "",
  aadhaar: "",
  pronouns: "",
  middleName: "",
  gender: "Male",
  dateOfBirth: "",
  resumeFileName: "",
  resumeMimeType: "",
  resumeUploadedAt: 0,
  learnedLog: [],
  customAnswers: {},
  summary: "React TypeScript engineer",
  skills: ["React", "TypeScript", "Node.js"],
  experience: [],
  education: [],
  projects: [],
  certifications: [],
  languages: [],
  awards: [],
  publications: [],
  socialLinks: [],
  workAuthorizations: [],
  jobPreferences: { roleTitles: ["Frontend Engineer"], locations: ["Hyderabad", "Bengaluru"], remotePreference: "Hybrid", minSalary: "18", currency: "INR", excludedCompanies: [] },
  ethnicity: "",
  veteranStatus: "",
  disabilityStatus: "",
  defaultLoginEmail: "",
  defaultLoginPassword: "",
  masterResumeText: "React TypeScript Node.js",
  updatedAt: Date.now(),
} satisfies Profile;

test("India parsers understand LPA and notice period formats", () => {
  assert.equal(parseIndianLpa("₹18,00,000"), 18);
  assert.equal(parseIndianLpa("22 LPA"), 22);
  assert.equal(parseNoticeDays("immediate joiner"), 0);
  assert.equal(parseNoticeDays("2 months"), 60);
  assert.equal(detectIndiaBoard("https://www.naukri.com/job-listings-x"), "naukri");
});

test("India opportunity insight scores CTC, notice, trust, board strategy", () => {
  const job: Job = {
    id: "j-india",
    url: "https://www.linkedin.com/jobs/view/123",
    title: "Frontend Engineer",
    company: "Acme India",
    location: "Bengaluru",
    description: "React TypeScript role. Budget 18-28 LPA. Join within 45 days.",
    salary: "18-28 LPA",
    remote: false,
    source: "linkedin",
    savedAt: Date.now(),
  };
  const insight = analyzeIndiaOpportunity(profile, job);
  assert.equal(insight.board.detected, "linkedin");
  assert.equal(insight.ctc.fit, "above_expectation");
  assert.equal(insight.notice.fit, "excellent");
  assert.ok(insight.indiaScore >= 80);
  assert.ok(insight.followUp.message.includes("Expected CTC"));
});

test("India fraud shield flags deposits and sensitive KYC requests", () => {
  const job: Job = {
    id: "j-risk",
    url: "https://fake.example/job",
    title: "Work from home easy money",
    company: "Unknown HR",
    location: "Remote India",
    description: "Pay training fee and send Aadhaar PAN bank statement before interview. Security deposit required.",
    salary: "",
    remote: true,
    source: "unknown",
    savedAt: Date.now(),
  };
  const insight = analyzeIndiaOpportunity(profile, job);
  assert.ok(insight.trust.score < 60);
  assert.ok(insight.trust.warnings.length >= 2);
});
