import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  extractCanonicalSkillsFromText,
  computeSkillOverlap,
  projectCareerTrajectory,
  computeJobSalience,
  evaluateBilateralFit,
  rankAndFilterJobs,
  buildCandidateDiscoveryProfile,
  evaluateSingleJobDiscovery,
  type JobListingContext,
  type CandidateProfileContext,
} from "./index.js";


describe("SOTA Job Discovery Research Engine", () => {
  describe("WorkRB: Canonical Skill Normalization & Overlap", () => {
    it("normalizes varied aliases into canonical skills", () => {
      const text = "Looking for someone skilled in React.js, ts, py, k8s, and amazon web services.";
      const canonicals = extractCanonicalSkillsFromText(text);

      const skillIds = canonicals.map((s) => s.id);
      assert.ok(skillIds.includes("react"));
      assert.ok(skillIds.includes("typescript"));
      assert.ok(skillIds.includes("python"));
      assert.ok(skillIds.includes("kubernetes"));
      assert.ok(skillIds.includes("aws"));
    });

    it("accurately computes multi-view skill overlap", () => {
      const candidateSkills = extractCanonicalSkillsFromText("React, TypeScript, Node.js, PostgreSQL");
      const jobSkills = extractCanonicalSkillsFromText("TypeScript, React, Node.js, AWS, Docker");

      const overlap = computeSkillOverlap(candidateSkills, jobSkills);
      assert.strictEqual(overlap.matchedSkills.length, 3); // React, TS, Node
      assert.strictEqual(overlap.missingSkills.length, 2); // AWS, Docker
      assert.ok(overlap.overlapRatio >= 0.59 && overlap.overlapRatio <= 0.61);
    });
  });

  describe("STEP: Career Trajectory Projection", () => {
    it("identifies natural progression from Junior to Mid-level", () => {
      const profile = {
        yearsExperience: 2.5,
        recentTitles: ["Junior Software Engineer"],
      };

      const trajectory = projectCareerTrajectory(profile, "Software Engineer II", "Join our backend team");
      assert.strictEqual(trajectory.transitionType, "natural_promotion");
      assert.ok(trajectory.trajectoryFitScore >= 80);
    });


    it("flags significant underqualification when a 1-year junior applies for a Principal Architect role", () => {
      const profile = {
        yearsExperience: 1,
        recentTitles: ["Associate Software Engineer"],
      };

      const trajectory = projectCareerTrajectory(
        profile,
        "Principal Software Architect / Director",
        "Must have 10+ years of leading enterprise architecture"
      );
      assert.strictEqual(trajectory.transitionType, "underqualified");
      assert.ok(trajectory.trajectoryFitScore <= 20);
    });
  });

  describe("LiJAR: Salience Velocity & Early Bird Sweet Spot", () => {
    it("recognizes fresh postings with low applicants as Early Bird sweet spots", () => {
      const salience = computeJobSalience({
        postedAgoText: "3 hours ago",
        applicantCount: 12,
      });

      assert.strictEqual(salience.isEarlyBird, true);
      assert.strictEqual(salience.congestionLevel, "low");
      assert.ok(salience.salienceMultiplier >= 1.25);
      assert.ok(salience.callbackAdvantageLabel.includes("lower listed applicant volume"));
    });

    it("penalizes saturated listings with > 300 applicants", () => {
      const salience = computeJobSalience({
        postedAgoText: "10 days ago",
        applicantCount: 450,
      });

      assert.strictEqual(salience.isEarlyBird, false);
      assert.strictEqual(salience.congestionLevel, "saturated");
      assert.ok(salience.salienceMultiplier < 0.6);
      assert.ok(salience.callbackAdvantageLabel.includes("High listed applicant volume"));
    });
  });

  describe("CDPR: Constrained Dual-Perspective Reasoning & Knockouts", () => {
    const candidate: CandidateProfileContext = {
      fullName: "Alex Sharma",
      skills: extractCanonicalSkillsFromText("Python, FastApi, PostgreSQL, Docker"),
      yearsExperience: 3,
      recentTitles: ["Software Engineer"],
      preferredTitles: ["Backend Engineer", "Software Engineer"],
      workAuthorization: "requires_sponsorship",
    };

    it("triggers hard knockout when job explicitly rejects visa sponsorship", () => {
      const job: JobListingContext = {
        id: "job-1",
        title: "Backend Engineer",
        company: "Defense Corp",
        location: "Reston, VA",
        description: "Must be a US Citizen. No visa sponsorship provided under any circumstances.",
        url: "https://defensecorp.example/jobs/1",
      };

      const fit = evaluateBilateralFit(candidate, job);
      assert.strictEqual(fit.knockoutPassed, false);
      assert.strictEqual(fit.recommendation, "knockout_disqualified");
      assert.strictEqual(fit.visaStatus, "blocked_no_sponsorship");
      assert.ok(fit.knockoutReason?.includes("sponsorship"));
    });

    it("approves strong match when skills, visa, and trajectory align", () => {
      const job: JobListingContext = {
        id: "job-2",
        title: "Backend Software Engineer",
        company: "Tech Global Inc",
        location: "Remote",
        description: "Looking for Python, FastAPI, Docker, and PostgreSQL developers. Open to H1B and visa sponsorship available.",
        url: "https://techglobal.example/jobs/2",
      };

      const fit = evaluateBilateralFit(candidate, job);
      assert.strictEqual(fit.knockoutPassed, true);
      assert.strictEqual(fit.visaStatus, "sponsor_verified");
      assert.ok(fit.overallCompatibilityScore >= 75);
    });
  });

  describe("End-to-End Discovery Pipeline (rankAndFilterJobs)", () => {
    const candidate = buildCandidateDiscoveryProfile({
      fullName: "Priya Patel",
      rawSkills: ["TypeScript", "React", "Node.js", "GraphQL", "Tailwind CSS"],
      yearsExperience: 4,
      recentTitles: ["Frontend Engineer", "Full Stack Developer"],
      preferredTitles: ["Senior Frontend Engineer", "Frontend Engineer"],
      workAuthorization: "requires_sponsorship",
      preferredWorkModality: "remote",
    });

    const jobs: JobListingContext[] = [
      {
        id: "job-disqualified-visa",
        title: "Frontend Engineer",
        company: "GovSec Ltd",
        location: "Washington, DC",
        description: "React and TypeScript. US Citizenship required. Unable to sponsor visas.",
        url: "https://govsec.example/jobs/1",
        postedAgoText: "2 hours ago",
        applicantCount: 5,
      },
      {
        id: "job-early-bird",
        title: "Senior Frontend Engineer",
        company: "Stripe-like SaaS",
        location: "Remote",
        description: "Full remote. React, TypeScript, GraphQL. Will sponsor H1B visas.",
        url: "https://saas.example/jobs/2",
        postedAgoText: "4 hours ago",
        applicantCount: 15,
      },
      {
        id: "job-stale-saturated",
        title: "Frontend Developer",
        company: "MegaCorp",
        location: "New York, NY",
        description: "React, Node.js. 100+ open roles.",
        url: "https://megacorp.example/jobs/3",
        postedAgoText: "25 days ago",
        applicantCount: 520,
      },
    ];

    it("ranks early bird verified sponsor job first and filters out visa-blocked job", () => {
      const results = rankAndFilterJobs(candidate, jobs, {
        requireVisaSponsorship: true,
        excludeStaleJobs: true,
      });

      assert.strictEqual(results.length, 1);
      assert.strictEqual(results[0].job.id, "job-early-bird");
      assert.ok(results[0].compositeScore >= 80);
      assert.ok(results[0].badges.some((b) => b.includes("lower listed applicant volume")));
      assert.ok(results[0].badges.some((b) => b.includes("Sponsorship indicated") && b.includes("unverified")));
    });

    it("evaluates single job discovery with detailed breakdown", () => {
      const single = evaluateSingleJobDiscovery(candidate, jobs[1]);
      assert.strictEqual(single.job.id, "job-early-bird");
      assert.strictEqual(single.salience.isEarlyBird, true);
      assert.strictEqual(single.bilateralFit.knockoutPassed, true);
      assert.ok(single.compositeScore > 70);
    });
  });
});
