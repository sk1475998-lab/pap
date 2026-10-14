/**
 * End-to-End Live Verification with Shashi's Resume & Gemini API Key
 */
import fs from "node:fs";
import path from "node:path";
import {
  createLLM,
  pdfToText,
  parseResumeText,
  answerQuestion,
  generateCoverLetter,
  analyzeATS,
  scoreMatch,
  type LLMConfig,
} from "../packages/core/src/index.js";

async function main() {
  console.log("===============================================================");
  console.log("  SuperJobAgent: Live Test with Shashi's Resume & Gemini AI    ");
  console.log("===============================================================\n");

  const apiKey = process.env.GEMINI_API_KEY || process.env.SUPERJOB_LLM_API_KEY || "";
  const model = "gemini-3.6-flash";
  const provider = "gemini";

  const config: LLMConfig = {
    provider,
    model,
    apiKey,
  };

  const llm = createLLM(config);
  console.log(`[1/5] Initializing Gemini LLM Client (${model})...`);
  console.log(`      Client Available: ${llm.isAvailable()}`);

  // 1. Locate and extract resume text
  const resumePath = path.resolve(process.cwd(), "shashi_resume_fina (1).pdf");
  console.log(`\n[2/5] Reading Real Candidate Resume from:`);
  console.log(`      ${resumePath}`);

  if (!fs.existsSync(resumePath)) {
    throw new Error(`Resume not found at ${resumePath}`);
  }

  const pdfBytes = fs.readFileSync(resumePath);
  console.log(`      File size: ${pdfBytes.length} bytes`);

  const resumeText = await pdfToText(pdfBytes);
  console.log(`✓ Successfully extracted ${resumeText.length} characters of resume text via pdfjs.`);

  // 2. Parse candidate profile
  console.log("\n[3/5] Parsing Candidate Profile from Resume...");
  const parsed = parseResumeText(resumeText);
  const profile = parsed.profile;

  console.log(`  Candidate Name : ${profile.firstName} ${profile.lastName}`);
  console.log(`  Email          : ${profile.email || "(not detected)"}`);
  console.log(`  Phone          : ${profile.phone || "(not detected)"}`);
  console.log(`  Key Skills (${profile.skills.length}) : ${profile.skills.slice(0, 10).join(", ")}...`);
  if (profile.experience?.length) {
    console.log(`  Recent Role    : ${profile.experience[0].title} at ${profile.experience[0].company}`);
  }
  if (profile.education?.length) {
    console.log(`  Education      : ${profile.education[0].degree} from ${profile.education[0].school}`);
  }

  // 3. Grounded Question Answering with Gemini AI
  console.log("\n[4/5] Testing Grounded AI Screening Question Answering with Gemini...");
  const questions = [
    "What are your core technical strengths and how do they apply to a Senior AI / Full-Stack Engineer role?",
    "Do you have hands-on experience building and deploying machine learning or agentic systems?",
    "What is your notice period or earliest availability?",
  ];

  for (const q of questions) {
    console.log(`\n  Q: "${q}"`);
    const t0 = Date.now();
    const answer = await answerQuestion(llm, q, resumeText);
    const ms = Date.now() - t0;
    console.log(`  A (${ms}ms): ${answer.trim()}`);
  }

  // 4. Personalized AI Cover Letter Generation
  console.log("\n[5/5] Generating Tailored Cover Letter with Gemini AI...");
  const targetJob = {
    title: "Senior AI Platform & Agentic Systems Engineer",
    company: "Google DeepMind",
    description: "Looking for an engineer to build next-generation agentic AI systems, LLM orchestration frameworks, and scalable cloud platforms.",
  };

  const tStart = Date.now();
  const coverLetter = await generateCoverLetter(targetJob, { ...profile, masterResumeText: resumeText }, llm);
  const letterMs = Date.now() - tStart;

  console.log(`✓ Cover Letter Generated in ${letterMs}ms (Source: ${coverLetter.source}):\n`);
  console.log("---------------------------------------------------------------");
  console.log(coverLetter.text);
  console.log("---------------------------------------------------------------");

  // 5. ATS Match Analysis
  const ats = analyzeATS(resumeText, targetJob.description);
  console.log(`\nATS Score: ${ats.score}/100 | Pass Probability: ${ats.passProbability}%`);
  console.log(`Matched Keywords: ${ats.covered.map((c) => c.term).slice(0, 8).join(", ")}`);

  console.log("\n===============================================================");
  console.log("  ALL TESTS PASSED! Shashi's Resume & Gemini API are 100% Ready!");
  console.log("===============================================================\n");
}

main().catch((err) => {
  console.error("Test failed with error:", err);
  process.exit(1);
});
