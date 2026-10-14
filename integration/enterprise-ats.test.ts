import test from "node:test";
import assert from "node:assert/strict";
import { analyzeATS, suggestInsertions } from "@superjob/core";

const strongResume = `
SHASHI KUMAR BANOTH
shashi@example.com | +91 9876543210 | Hyderabad, India | https://linkedin.com/in/shashi | https://github.com/shashi

SUMMARY
Frontend Engineer with 4 years building React, TypeScript, Node.js, GraphQL and AWS applications with performance optimization and accessibility.

SKILLS
React, TypeScript, JavaScript, Node.js, GraphQL, REST API, AWS, Jest, Cypress, HTML, CSS, accessibility, performance optimization

WORK EXPERIENCE
Frontend Engineer | Acme India | 2021 - Present
- Built React and TypeScript dashboard modules integrated with GraphQL and REST APIs for enterprise workflows.
- Improved page performance by 35% using code splitting, memoization, and bundle optimization.
- Added Jest and Cypress automated tests and improved accessibility compliance.

PROJECTS
Hiring Analytics Platform
- Developed AWS-hosted React analytics UI with Node.js APIs and GraphQL queries.

EDUCATION
B.Tech Computer Science
`;

const weakResume = `
Shashi
I worked on websites.
`;

const jd = `
Senior Frontend Engineer
Required qualifications:
- React, TypeScript, JavaScript, GraphQL, REST API
- Performance optimization and accessibility
- Jest or Cypress testing
- AWS or cloud deployment experience
Preferred qualifications:
- Node.js backend experience
- Enterprise dashboard experience
`;

test("enterprise ATS gives high Workday-style readiness for structured keyword-aligned resume", () => {
  const ats = analyzeATS(strongResume, jd);
  assert.equal(ats.provider, "workday-like");
  assert.ok(ats.score >= 75, `score=${ats.score}`);
  assert.ok(ats.passProbability >= 75, `pass=${ats.passProbability}`);
  assert.ok(ats.requiredScore >= 70, `required=${ats.requiredScore}`);
  assert.ok(ats.parseScore >= 75, `parse=${ats.parseScore}`);
  assert.ok(ats.sectionScores.some((s) => s.section === "experience" && s.found));
  assert.ok(ats.checks.length >= 5);
});

test("enterprise ATS identifies parse and required keyword blockers", () => {
  const ats = analyzeATS(weakResume, jd);
  assert.ok(ats.score < 65, `score=${ats.score}`);
  assert.ok(ats.workday.status === "needs_work" || ats.workday.status === "risky");
  assert.ok(ats.missingRequired.includes("react") || ats.missingRequired.includes("typescript"));
  assert.ok(ats.checks.some((c) => c.status === "fail"));
  assert.ok(suggestInsertions(ats).length > 0);
});
