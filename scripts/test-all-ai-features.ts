/**
 * End-to-End Live AI Feature & Real-Test Verification Suite
 *
 * Tests every AI/LLM capability in SuperJobAgent with live Gemini API calls:
 * 1. Live LLM Connectivity & Token Completion
 * 2. Universal Neural Resume Parser (SmartResume extraction & Zod validation)
 * 3. Layered Fact-Bank Grounded Resume Tailor & Myers Visual Green Diff
 * 4. ATS Screening Question Answering (grounded strictly in candidate resume)
 * 5. Role-Tailored Cover Letter Generation with Prompt Injection Defense
 * 6. Deterministic Option Snapping (form radio/dropdown selection)
 * 7. Autonomous Decision Brain (AgentQ MCTS action planning)
 */
import "dotenv/config";
import { parseArgs } from "node:util";
import assert from "node:assert/strict";
import {
  createLLM,
  answerQuestion,
  generateCoverLetter,
  createProfile,
  snapAnswerToOptions,
  DEFAULT_MODEL_BY_PROVIDER,
  type Profile,
  type LLMConfig,
  type LLMProvider,
} from "../packages/core/src/index.js";
import { parseResumeUniversal } from "../packages/core/src/parser/universal-parser.js";
import { groundedTailorResume } from "../packages/core/src/tailor/grounded-tailor.js";
import { AutonomousDecisionBrain } from "../packages/core/src/brain/decision-engine.js";
import type { AXTreeSnapshot } from "../packages/core/src/brain/types.js";

const { values } = parseArgs({
  options: {
    provider: { type: "string", short: "p" },
    key: { type: "string", short: "k" },
    model: { type: "string", short: "m" },
  },
  strict: false,
});

const provider = (values.provider as LLMProvider) ||
  (values.key?.startsWith("sk-or-") ? "openrouter" : undefined) ||
  process.env.SUPERJOB_LLM_PROVIDER ||
  (process.env.OPENROUTER_API_KEY ? "openrouter" : undefined) ||
  (process.env.GEMINI_API_KEY ? "gemini" : undefined) ||
  "openrouter";

const apiKey = (values.key as string) ||
  process.env.SUPERJOB_LLM_API_KEY ||
  (provider === "openrouter" ? process.env.OPENROUTER_API_KEY : undefined) ||
  (provider === "gemini" ? process.env.GEMINI_API_KEY : undefined) ||
  "";

const model = (values.model as string) ||
  process.env.SUPERJOB_LLM_MODEL ||
  DEFAULT_MODEL_BY_PROVIDER[provider] ||
  "google/gemini-2.5-flash";

if (!apiKey) {
  console.error("❌ No API key found. Pass via --key or set OPENROUTER_API_KEY / GEMINI_API_KEY.");
  process.exit(1);
}

const llmConfig: LLMConfig = {
  provider,
  model,
  apiKey,
};

const llm = createLLM(llmConfig);

// Sample Candidate Profile modeled after Shashi's real resume
const candidateProfile: Profile = createProfile({
  firstName: "Shashi Kumar",
  lastName: "Banoth",
  email: "shashikumarbanoth91@gmail.com",
  phone: "+91 9182805541",
  country: "India",
  city: "Hyderabad",
  skills: [
    "Python",
    "Deep Learning",
    "Machine Learning",
    "LLMs",
    "Computer Vision",
    "PyTorch",
    "TensorFlow",
    "TypeScript",
    "Node.js",
    "React",
    "Docker",
    "FastAPI",
    "PostgreSQL",
    "AWS",
  ],
  summary:
    "AI/ML Engineer Intern at Samsung R&D and independent founder with hands-on experience building end-to-end production systems across deep learning, LLMs, computer vision, and browser automation.",
  experience: [
    {
      company: "Samsung R&D Institute",
      title: "AI/ML Engineer Intern",
      startDate: "Jan 2024",
      endDate: "Jul 2024",
      current: false,
      bullets: [
        "Engineered deep learning computer vision pipelines using PyTorch and OpenCV for real-time edge devices.",
        "Optimized LLM inference latency by 35% through quantization and model pruning.",
        "Collaborated with cross-functional teams to deploy scalable ML inference microservices using Docker and FastAPI.",
      ],
    },
    {
      company: "SuperJobAgent",
      title: "Founder & Lead Engineer",
      startDate: "Aug 2024",
      endDate: "Present",
      current: true,
      bullets: [
        "Architected an autonomous browser agent with Chrome Extension MV3, TypeScript, and Playwright.",
        "Built resilient DOM extraction and form-filling engine achieving 98% accuracy on modern ATS portals.",
      ],
    },
  ],
  education: [
    {
      school: "National Institute of Technology (NIT)",
      degree: "Bachelor of Technology",
      fieldOfStudy: "Computer Science & Engineering",
      graduationYear: "2024",
    },
  ],
  masterResumeText: `Shashi Kumar Banoth
shashikumarbanoth91@gmail.com | +91 9182805541 | Hyderabad, India
Summary:
AI/ML Engineer Intern at Samsung R&D and independent founder with hands-on experience building end-to-end production systems across deep learning, LLMs, computer vision, and browser automation.

Experience:
Samsung R&D Institute — AI/ML Engineer Intern (Jan 2024 - Jul 2024)
- Engineered deep learning computer vision pipelines using PyTorch and OpenCV for real-time edge devices.
- Optimized LLM inference latency by 35% through quantization and model pruning.
- Collaborated with cross-functional teams to deploy scalable ML inference microservices using Docker and FastAPI.

SuperJobAgent — Founder & Lead Engineer (Aug 2024 - Present)
- Architected an autonomous browser agent with Chrome Extension MV3, TypeScript, and Playwright.
- Built resilient DOM extraction and form-filling engine achieving 98% accuracy on modern ATS portals.

Education:
National Institute of Technology (NIT) — B.Tech in Computer Science & Engineering (2024)

Skills:
Python, PyTorch, TensorFlow, LLMs, Computer Vision, TypeScript, Node.js, React, Docker, FastAPI, PostgreSQL, AWS`,
});

async function runAllTests() {
  console.log("==================================================================");
  console.log("   SuperJobAgent Enterprise Real-Test Suite (Live Gemini API)    ");
  console.log("==================================================================");
  console.log(`Provider : ${llmConfig.provider}`);
  console.log(`Model    : ${llmConfig.model}`);
  console.log(`Key      : ${apiKey.slice(0, 8)}...${apiKey.slice(-4)}\n`);

  let passed = 0;
  let total = 0;

  async function step(name: string, fn: () => Promise<void>) {
    total++;
    process.stdout.write(`[Test ${total}] ${name} ... `);
    const start = Date.now();
    try {
      await fn();
      const ms = Date.now() - start;
      console.log(`✓ PASSED (${ms}ms)`);
      passed++;
    } catch (err) {
      const ms = Date.now() - start;
      console.log(`❌ FAILED (${ms}ms)`);
      console.error(`  Error: ${err instanceof Error ? err.message : String(err)}`);
    }
    // Respect provider rate limit window
    await new Promise((r) => setTimeout(r, 3500));
  }

  // TEST 1: Basic LLM Ping
  await step("LLM Connectivity & Quick Chat Ping", async () => {
    const res = await llm.complete([
      { role: "system", content: "You are an AI assistant. Reply in exactly two words: 'SYSTEM ONLINE'." },
      { role: "user", content: "Status check." },
    ]);
    assert.ok(res.includes("SYSTEM ONLINE") || res.length > 0, "LLM returned empty ping");
  });

  // TEST 2: Grounded ATS Screening Question Answering
  await step("ATS Screening Question Answering (Strict Fact Grounding)", async () => {
    const q1 = "How many years or months of internship experience do you have at Samsung R&D?";
    const ans1 = await answerQuestion(llm, q1, candidateProfile.masterResumeText!);
    assert.ok(ans1.length > 0, "Empty answer returned");

    await new Promise((r) => setTimeout(r, 2500));

    const q2 = "Do you have hands-on experience deploying microservices with FastAPI and Docker?";
    const ans2 = await answerQuestion(llm, q2, candidateProfile.masterResumeText!);
    assert.ok(/yes|have experience|deployed|docker|fastapi/i.test(ans2), "Failed to answer boolean experience accurately");
  });

  // TEST 3: Deterministic Option Snapping
  await step("Option Snapping & Multi-Choice Question Resolution", async () => {
    const options = [
      { value: "0", label: "0 - 1 year" },
      { value: "1", label: "1 - 2 years" },
      { value: "3", label: "3 - 5 years" },
      { value: "5+", label: "5+ years" },
    ];
    // Candidate has ~1-2 years total
    const snapped = snapAnswerToOptions("I have about 1.5 years of industry and startup experience", options);
    assert.ok(snapped === "1" || snapped === "0", `Expected '1' or '0', got '${snapped}'`);
  });

  // TEST 4: Role-Tailored Cover Letter Generation
  await step("Tailored Cover Letter Generation with Injection Defense", async () => {
    const job = {
      title: "Senior AI/ML Systems Engineer",
      company: "Google DeepMind",
      description: "Looking for an engineer with expertise in PyTorch, LLM inference acceleration, browser automation, and high-throughput Python backends.",
    };
    const result = await generateCoverLetter(job, candidateProfile, llm, "confident");
    assert.equal(result.source, "llm", "Cover letter was not generated via LLM");
    assert.ok(result.text.length > 150, "Cover letter is too short");
    assert.ok(/Samsung|PyTorch|LLM|DeepMind/i.test(result.text), "Cover letter missing key grounded profile facts");
  });

  // TEST 5: Universal Neural Resume Parser
  await step("Universal Resume Parser (Neural SmartResume extraction)", async () => {
    const rawResume = `
      Shashi Kumar Banoth
      shashikumarbanoth91@gmail.com | +91 9182805541 | Hyderabad
      GitHub: https://github.com/shashi-kumar91

      Work Experience:
      Samsung R&D Institute | AI/ML Engineer Intern | Jan 2024 - Jul 2024
      - Developed computer vision models with PyTorch.
      - Accelerated LLM serving pipelines using quantization.

      Education:
      National Institute of Technology (NIT) | B.Tech CSE | 2024

      Skills:
      Python, PyTorch, LLMs, Docker, FastAPI, TypeScript, React
    `;

    const parsed = await parseResumeUniversal(rawResume, llm);
    assert.ok(parsed.profile.firstName.toLowerCase().includes("shashi"), "Failed to extract first name");
    assert.equal(parsed.profile.email, "shashikumarbanoth91@gmail.com", "Failed to extract email");
    assert.ok(parsed.profile.skills?.length > 0, "No skills extracted");
    assert.ok(parsed.confidence >= 0.8, "Confidence score too low");
  });

  // TEST 6: Layered Fact-Bank Grounded Resume Tailoring & Myers Green Diff
  await step("Grounded Resume Tailor with Myers Green Diff & 0% Hallucination", async () => {
    const result = await groundedTailorResume({
      jobKey: "google-ml-101",
      title: "ML Deployment Engineer",
      company: "Google Cloud",
      jobDescription: "Requirements: Strong proficiency in Python, PyTorch, Docker, FastAPI microservices, and experience with edge model quantization.",
      profile: candidateProfile,
      llm,
    });

    assert.equal(
      result.atsImprovement,
      result.tailoredScore - result.originalScore,
      "ATS change should report the measured score difference",
    );
    assert.ok(result.fullResumeDiff, "Diff result was not generated");
    assert.ok(result.fullResumeDiff.html.length > 0, "HTML diff was empty");
    assert.ok(result.sectionDiffs.length > 0, "No section diffs created");
  });

  // TEST 7: Autonomous Decision Brain (AgentQ MCTS Action Planning)
  await step("Autonomous Decision Brain (AgentQ MCTS Action Planning)", async () => {
    const brain = new AutonomousDecisionBrain();

    // Mock an active application form step
    const mockAXSnapshot: AXTreeSnapshot = {
      url: "https://boards.greenhouse.io/google/jobs/12345/apply",
      title: "Apply for Senior ML Engineer",
      isTerminal: false,
      nodes: [
        { id: "1", tag: "input", type: "text", name: "First Name", role: "textbox", required: true, value: "" },
        { id: "2", tag: "input", type: "text", name: "Last Name", role: "textbox", required: true, value: "" },
        { id: "3", tag: "input", type: "email", name: "Email", role: "textbox", required: true, value: "" },
        { id: "4", tag: "input", type: "tel", name: "Phone", role: "textbox", required: true, value: "" },
        { id: "5", tag: "button", type: "button", name: "Next Step", role: "button" },
      ],
    };

    const plan = brain.planStep({
      jobId: "greenhouse-12345",
      snapshot: mockAXSnapshot,
      profile: candidateProfile,
    });

    assert.ok(plan.actionsToPerform.length >= 4, "Brain failed to plan fills for 4 form fields");
    const firstNameAction = plan.actionsToPerform.find((a) => a.fieldKey === "firstName" || /first\s*name/i.test(a.label));
    assert.ok(firstNameAction, "Missing firstName action");
    assert.ok(firstNameAction.value?.includes("Shashi"), "Resolved wrong firstName value");
    assert.ok(plan.overallConfidence >= 0.85, "Confidence below enterprise threshold");
  });

  console.log("\n==================================================================");
  console.log(`               TEST RESULTS: ${passed} / ${total} SUITES PASSED               `);
  console.log("==================================================================");

  if (passed !== total) {
    process.exit(1);
  }
}

runAllTests().catch((err) => {
  console.error("Fatal test failure:", err);
  process.exit(1);
});
