import test from "node:test";
import assert from "node:assert/strict";
import { buildIntelligenceDashboard, careerMemoryFromApplications, rankOpportunities, type Application, type Job, type Profile } from "@superjob/core";

const profile: Profile = {
  id: "p1",
  firstName: "Asha",
  lastName: "Rao",
  email: "asha@example.com",
  phone: "",
  location: "Bengaluru",
  city: "Bengaluru",
  state: "KA",
  pincode: "",
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
  yearsOfExperience: "4",
  currentCTC: "18",
  expectedCTC: "25",
  ctcCurrency: "INR",
  salaryExpectation: "25 LPA",
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
  summary: "Frontend engineer building React TypeScript dashboards",
  skills: ["React", "TypeScript", "Node.js", "GraphQL", "AWS"],
  experience: [],
  education: [],
  projects: [],
  certifications: [],
  languages: [],
  awards: [],
  publications: [],
  socialLinks: [],
  workAuthorizations: [],
  jobPreferences: { roleTitles: ["Frontend Engineer"], locations: ["Bengaluru"], remotePreference: "Hybrid", minSalary: "25", currency: "INR", excludedCompanies: [] },
  ethnicity: "",
  veteranStatus: "",
  disabilityStatus: "",
  defaultLoginEmail: "",
  defaultLoginPassword: "",
  masterResumeText: "React TypeScript GraphQL AWS Node.js performance accessibility dashboards",
  updatedAt: Date.now(),
};

const jobs: Job[] = [
  { id: "j1", url: "https://example.com/a", title: "Frontend Engineer", company: "Acme", location: "Bengaluru", description: "React TypeScript GraphQL AWS accessibility performance. 24-35 LPA", salary: "24-35 LPA", remote: false, source: "fixture", postedAt: new Date().toISOString(), savedAt: Date.now() },
  { id: "j2", url: "https://example.com/b", title: "Commission only sales", company: "Risky", location: "Remote", description: "Easy money commission only whatsapp bank account", salary: "", remote: true, source: "fixture", postedAt: "2020-01-01", savedAt: Date.now() },
];

test("career intelligence ranks safe high-match jobs above risky stale jobs", () => {
  const ranks = rankOpportunities(profile, jobs, { applications: [] });
  assert.equal(ranks[0]?.job.id, "j1");
  assert.equal(ranks[1]?.priority, "skip");
  assert.equal(ranks[0]?.prediction.atsPassProbability, null);
  assert.ok((ranks[1]?.signals ?? []).some((s) => s.kind === "risk"));
});

test("dashboard computes funnel and recommendations from tracked applications", () => {
  const apps: Application[] = [
    { id: "a1", jobId: "j1", url: jobs[0]!.url, title: jobs[0]!.title, company: jobs[0]!.company, stage: "applied", notes: "", appliedAt: Date.now(), updatedAt: Date.now(), matchScore: 88 },
    { id: "a2", jobId: "j3", url: "https://example.com/c", title: "Frontend", company: "Beta", stage: "interview", notes: "", appliedAt: Date.now(), updatedAt: Date.now(), matchScore: 78 },
  ];
  const dashboard = buildIntelligenceDashboard(apps, { memory: careerMemoryFromApplications(apps) });
  assert.equal(dashboard.totals.total, 2);
  assert.equal(dashboard.totals.interview, 1);
  assert.ok(dashboard.recommendations.length >= 1);
});
