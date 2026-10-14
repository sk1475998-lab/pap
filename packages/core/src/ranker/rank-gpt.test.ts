import { test } from "node:test";
import assert from "node:assert";
import {
  RankGPTJobReranker,
  extractSeniorityLevel,
  extractRequiredYears,
  calculateCandidateExperienceYears,
  evaluateJobEligibility,
} from "./rank-gpt.js";
import type { Job, Profile } from "../types.js";
import { DEFAULT_LLM_CONFIG, type LLMClient } from "../llm/types.js";

test("extractSeniorityLevel correctly extracts seniority classes", () => {
  assert.strictEqual(extractSeniorityLevel("Senior Software Engineer"), "senior");
  assert.strictEqual(extractSeniorityLevel("Staff Backend Architect"), "principal");
  assert.strictEqual(extractSeniorityLevel("Engineering Tech Lead"), "lead");
  assert.strictEqual(extractSeniorityLevel("Junior Web Developer"), "entry");
  assert.strictEqual(extractSeniorityLevel("Software Engineering Intern"), "intern");
  assert.strictEqual(extractSeniorityLevel("Full Stack Developer"), "mid");
});

test("extractRequiredYears extracts numeric experience constraints", () => {
  assert.strictEqual(extractRequiredYears("Must have 5+ years of relevant experience"), 5);
  assert.strictEqual(extractRequiredYears("Requires 3 to 5 yrs of experience in React"), 3);
  assert.strictEqual(extractRequiredYears("Fresh graduates welcome"), null);
});

test("calculateCandidateExperienceYears calculates from experience dates", () => {
  const mockProfile: Profile = {
    firstName: "Alex",
    lastName: "Dev",
    email: "alex@example.com",
    yearsOfExperience: "4.5",
    skills: ["TypeScript", "Node.js", "React"],
  } as any;

  assert.strictEqual(calculateCandidateExperienceYears(mockProfile), 4.5);
});

test("evaluateJobEligibility identifies eligible vs under-qualified positions", () => {
  const profile: Profile = {
    firstName: "Sam",
    lastName: "Coder",
    email: "sam@example.com",
    yearsOfExperience: "5",
    skills: ["Python", "FastAPI", "Docker", "PostgreSQL"],
    willingToRelocate: "Yes",
    experience: [],
  } as any;

  const suitableJob: Job = {
    id: "job-1",
    url: "https://example.com/job1",
    title: "Python Backend Developer",
    company: "Acme",
    location: "Remote",
    description: "Looking for a Python developer with 3+ years experience and FastAPI knowledge.",
    remote: true,
    salary: "$120k",
    source: "test",
    savedAt: Date.now(),
  };

  const seniorDirectorJob: Job = {
    id: "job-2",
    url: "https://example.com/job2",
    title: "Director of Engineering",
    company: "MegaCorp",
    location: "New York",
    description: "Requires 12+ years of relevant experience managing 50+ engineers.",
    remote: false,
    salary: "$250k",
    source: "test",
    savedAt: Date.now(),
  };

  const res1 = evaluateJobEligibility(suitableJob, profile);
  assert.strictEqual(res1.isEligible, true);
  assert.strictEqual(res1.seniorityMatch, "optimal");

  const res2 = evaluateJobEligibility(seniorDirectorJob, profile);
  assert.strictEqual(res2.isEligible, false);
  assert.strictEqual(res2.seniorityMatch, "under-qualified");
});

test("RankGPTJobReranker re-ranks feed and respects eligibility order", async () => {
  const reranker = new RankGPTJobReranker();

  const profile: Profile = {
    firstName: "Taylor",
    lastName: "Smith",
    email: "taylor@example.com",
    yearsOfExperience: "3",
    skills: ["React", "TypeScript", "Next.js"],
    experience: [],
  } as any;

  const jobs: Job[] = [
    {
      id: "j-unrelated",
      url: "https://example.com/j1",
      title: "Senior Java Spring Architect",
      company: "Bank Corp",
      location: "Onsite",
      description: "Requires 10+ years of Java Spring Boot, Kafka, Oracle DB.",
      remote: false,
      salary: "$180k",
      source: "test",
      savedAt: Date.now(),
    },
    {
      id: "j-perfect",
      url: "https://example.com/j2",
      title: "Frontend Engineer (React / TypeScript)",
      company: "Modern SaaS",
      location: "Remote",
      description: "Seeking a Frontend engineer with 2-4 years of experience building modern React and TypeScript web apps.",
      remote: true,
      salary: "$130k",
      source: "test",
      savedAt: Date.now(),
    },
  ];

  const results = await reranker.rankJobs(jobs, profile);
  assert.strictEqual(results.length, 2);
  // Perfect match should rank first
  assert.strictEqual(results[0].job.id, "j-perfect");
  assert.strictEqual(results[0].rank, 1);
  assert.strictEqual(results[0].eligibility.isEligible, true);

  // Unrelated/over-qualified should rank second
  assert.strictEqual(results[1].job.id, "j-unrelated");
  assert.strictEqual(results[1].rank, 2);
});

test("LLM reranking cannot move an ineligible job above eligible jobs", async () => {
  const llm: LLMClient = {
    config: DEFAULT_LLM_CONFIG,
    isAvailable: () => true,
    complete: async () => "[3] > [2] > [1]",
  };
  const reranker = new RankGPTJobReranker({ llm });
  const profile: Profile = {
    firstName: "Taylor",
    lastName: "Smith",
    email: "taylor@example.com",
    yearsOfExperience: "3",
    skills: ["React", "TypeScript"],
    experience: [],
  } as any;
  const suitableJob: Job = {
    id: "eligible",
    url: "https://example.com/eligible",
    title: "Frontend Engineer",
    company: "Acme",
    location: "Remote",
    description: "React and TypeScript engineer, 2-4 years experience.",
    remote: true,
    salary: "",
    source: "test",
    savedAt: Date.now(),
  };
  const ineligibleJob: Job = {
    ...suitableJob,
    id: "ineligible",
    url: "https://example.com/ineligible",
    title: "Director of Engineering",
    description: "Requires 12+ years experience managing 50+ engineers.",
    remote: false,
  };

  const result = await reranker.rankJobs(
    [suitableJob, { ...suitableJob, id: "eligible-2", url: "https://example.com/eligible-2" }, ineligibleJob],
    profile,
  );

  assert.equal(result.filter((item) => item.eligibility.isEligible).length, 2);
  assert.equal(result[0]?.eligibility.isEligible, true);
  assert.equal(result[1]?.eligibility.isEligible, true);
  assert.equal(result[2]?.eligibility.isEligible, false);
});
