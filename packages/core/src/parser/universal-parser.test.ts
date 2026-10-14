import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { parseResumeUniversal, StructuredResumeSchema } from "./universal-parser.js";
import type { LLMClient } from "../llm/types.js";

describe("Universal Resume Parser (SmartResume & Federetyk Architecture)", () => {
  const mockLatexResume = `
JAKE DOE
jake@example.com | (555) 123-4567 | San Francisco, CA
linkedin.com/in/jakedoe | github.com/jakedoe

EDUCATION
------------------------------------------------------------------------
University of California, Berkeley                      Berkeley, CA
Bachelor of Science in Computer Science                  Aug 2018 - May 2022
GPA: 3.85 / 4.0

EXPERIENCE
------------------------------------------------------------------------
Acme Software Inc.                                      San Francisco, CA
Software Engineer                                        June 2022 - Present
- Designed and maintained RESTful APIs using Node.js and TypeScript, serving 5M daily requests.
- Optimized PostgreSQL database queries, reducing latency by 35%.
- Implemented Docker CI/CD pipelines in GitHub Actions.

Beta Tech Solutions                                     San Jose, CA
Full Stack Intern                                       May 2021 - Aug 2021
- Developed responsive web interfaces using React, Redux, and TailwindCSS.
- Integrated payment gateways with Stripe API.

PROJECTS
------------------------------------------------------------------------
Distributed Task Queue | Python, Redis, FastAPI
- Built a fault-tolerant job scheduler capable of handling 10k tasks/sec.

TECHNICAL SKILLS
------------------------------------------------------------------------
Languages: JavaScript, TypeScript, Python, SQL, HTML/CSS
Frameworks & Libraries: React, Node.js, Express, FastAPI, Redux
Developer Tools: Git, Docker, AWS, PostgreSQL, Redis
`;

  it("validates structured schema with Zod correctly", () => {
    const validSample = {
      contact: {
        firstName: "Jake",
        lastName: "Doe",
        email: "jake@example.com",
        phone: "5551234567",
        phoneCountryCode: "+1",
        city: "San Francisco",
        state: "CA",
        country: "USA",
        linkedin: "https://linkedin.com/in/jakedoe",
        github: "https://github.com/jakedoe",
        website: "",
      },
      summary: "Software engineer specializing in high-throughput backend systems.",
      skills: ["TypeScript", "Node.js", "Python", "Docker", "PostgreSQL"],
      experience: [
        {
          company: "Acme Software Inc.",
          title: "Software Engineer",
          location: "San Francisco, CA",
          startDate: "2022-06",
          endDate: "Present",
          current: true,
          bullets: ["Designed RESTful APIs using Node.js and TypeScript."],
        },
      ],
      education: [
        {
          school: "UC Berkeley",
          degree: "Bachelor of Science",
          fieldOfStudy: "Computer Science",
          graduationYear: "2022",
          gpa: "3.85",
        },
      ],
      projects: [],
      certifications: [],
    };

    const parsed = StructuredResumeSchema.safeParse(validSample);
    assert.equal(parsed.success, true);
  });

  it("parses complex resume text cleanly in heuristic mode when LLM is offline", async () => {
    const result = await parseResumeUniversal(mockLatexResume);
    assert.ok(result.profile);
    assert.equal(result.profile.email, "jake@example.com");
    assert.ok(result.profile.phone.includes("1234567"));
    assert.ok(result.profile.skills.some((s) => /typescript|react|python|docker/i.test(s)));
    assert.ok(result.profile.experience.length >= 1);
    assert.ok(result.profile.education.length >= 1);
    assert.equal(result.confidence >= 0.8, true);
  });

  it("performs neural structured extraction when LLM is provided", async () => {
    const mockLlm: LLMClient = {
      config: { provider: "gemini", model: "gemini-3.6-flash" },
      isAvailable: () => true,
      complete: async () => JSON.stringify({
        contact: {
          firstName: "Jake",
          lastName: "Doe",
          email: "jake@example.com",
          phone: "5551234567",
          phoneCountryCode: "+1",
          city: "San Francisco",
          state: "CA",
          country: "USA",
          linkedin: "https://linkedin.com/in/jakedoe",
          github: "https://github.com/jakedoe",
          website: "",
        },
        summary: "Software Engineer with expertise in building scalable APIs.",
        skills: ["TypeScript", "Node.js", "React", "Python", "Docker", "PostgreSQL", "FastAPI"],
        experience: [
          {
            company: "Acme Software Inc.",
            title: "Software Engineer",
            startDate: "June 2022",
            endDate: "Present",
            current: true,
            bullets: [
              "Designed and maintained RESTful APIs using Node.js and TypeScript.",
              "Optimized PostgreSQL database queries.",
            ],
          },
        ],
        education: [
          {
            school: "University of California, Berkeley",
            degree: "Bachelor of Science in Computer Science",
            graduationYear: "2022",
            gpa: "3.85",
          },
        ],
        projects: [
          {
            name: "Distributed Task Queue",
            description: "Built a fault-tolerant job scheduler",
            technologies: ["Python", "Redis", "FastAPI"],
            link: "",
          },
        ],
        certifications: [],
        yearsOfExperience: 3,
      }),
    };

    const result = await parseResumeUniversal(mockLatexResume, mockLlm);
    assert.equal(result.source, "llm-structured");
    assert.equal(result.confidence, 0.98);
    assert.equal(result.profile.firstName, "Jake");
    assert.equal(result.profile.lastName, "Doe");
    assert.equal(result.profile.email, "jake@example.com");
    assert.equal(result.profile.experience[0]?.company, "Acme Software Inc.");
    assert.equal(result.profile.education[0]?.school, "University of California, Berkeley");
    assert.ok(result.profile.projects?.length! >= 1);
  });

  it("handles nulls, numeric graduation years, and string experience without errors", () => {
    const rawFromLLMWithNullsAndNumbers = {
      contact: {
        firstName: "Sarah",
        middleName: null,
        lastName: "Connor",
        email: "sarah.connor@sky.net",
        phone: "+1 555 999 1111",
        city: "Los Angeles",
        state: null,
        country: null,
        linkedin: null,
        github: null,
        website: null,
      },
      summary: "Security Specialist",
      skills: ["Cybersecurity", "Firewalls", "Python"],
      experience: [
        {
          company: "Cyberdyne Systems",
          title: "Security Engineer",
          location: null,
          startDate: "2020-01",
          endDate: "Present",
          current: true,
          bullets: ["Defended critical infrastructure."],
        },
      ],
      education: [
        {
          school: "MIT",
          degree: "B.S. Cyber Security",
          fieldOfStudy: null,
          graduationYear: 2024, // Numeric year from LLM
          gpa: 3.95, // Numeric GPA from LLM
        },
      ],
      projects: [],
      certifications: [
        {
          name: "CISSP",
          issuer: null,
          year: 2023, // Numeric year
        },
      ],
      yearsOfExperience: "4.5 years", // String with text
    };

    const parsed = StructuredResumeSchema.safeParse(rawFromLLMWithNullsAndNumbers);
    assert.equal(parsed.success, true);
    if (parsed.success) {
      assert.equal(parsed.data.contact.middleName, undefined);
      assert.equal(parsed.data.education[0].graduationYear, "2024");
      assert.equal(parsed.data.education[0].gpa, "3.95");
      assert.equal(parsed.data.yearsOfExperience, 4.5);
    }
  });

  it("mergeProfileFromParse prefers parsed resume data and combines skills", async () => {
    const { mergeProfileFromParse, suggestSetupStep } = await import("../profile-complete.js");
    const { createProfile } = await import("../profile.js");

    const existing = createProfile({
      firstName: "OldName",
      lastName: "OldLast",
      email: "old@example.com",
      skills: ["Java", "SQL"],
    });

    const parsed = createProfile({
      firstName: "NewName",
      lastName: "NewLast",
      email: "new@example.com",
      phone: "9876543210",
      skills: ["TypeScript", "React", "SQL"],
      experience: [
        {
          id: "e1",
          title: "Senior AI Engineer",
          company: "OpenAI",
          startDate: "2022",
          endDate: "Present",
          current: true,
          bullets: ["Engineered LLM pipelines."],
          skills: [],
        },
      ],
      education: [
        {
          id: "ed1",
          school: "Stanford",
          degree: "M.S. CS",
          endDate: "2022",
        },
      ],
      masterResumeText: "Resume text content here",
    });

    const merged = mergeProfileFromParse(existing, parsed);
    assert.equal(merged.firstName, "NewName");
    assert.equal(merged.lastName, "NewLast");
    assert.equal(merged.email, "new@example.com");
    assert.equal(merged.phone, "9876543210");
    // Skills must contain both without duplicates
    assert.ok(merged.skills.includes("TypeScript"));
    assert.ok(merged.skills.includes("React"));
    assert.ok(merged.skills.includes("Java"));
    assert.ok(merged.skills.includes("SQL"));
    assert.equal(merged.skills.filter((s) => s.toLowerCase() === "sql").length, 1);
  });

  it("suggestSetupStep returns ready when required fields are satisfied", async () => {
    const { suggestSetupStep } = await import("../profile-complete.js");
    const { createProfile } = await import("../profile.js");

    const completeProfile = createProfile({
      firstName: "Alice",
      lastName: "Smith",
      email: "alice@example.com",
      phone: "9876543210",
      city: "Bangalore",
      state: "Karnataka",
      country: "India",
      pincode: "560001",
      yearsOfExperience: "5",
      expectedCTC: "30",
      noticePeriod: "Immediate",
      experience: [
        {
          id: "e1",
          title: "Staff Engineer",
          company: "Google",
          startDate: "2020",
          endDate: "Present",
          current: true,
          bullets: ["Built platforms."],
          skills: [],
        },
      ],
      education: [
        {
          id: "ed1",
          school: "IIT",
          degree: "B.Tech",
          endDate: "2019",
        },
      ],
      skills: ["Go", "Distributed Systems"],
      masterResumeText: "Resume text content",
    });

    const step = suggestSetupStep(completeProfile);
    assert.equal(step, "ready");
  });
});
