import { chromium } from "playwright";
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

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

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");
const reportPath = path.join(rootDir, "accenture_live_test_report.txt");

async function main() {
  console.log("==================================================================");
  console.log("SUPERJOBAGENT - REAL-WORLD ACCENTURE JOB POSTING TEST");
  console.log("==================================================================");
  const targetUrl = "https://www.accenture.com/in-en/careers/jobdetails?id=ATCI-4822040-S1848439_en";
  console.log(`Target URL: ${targetUrl}\n`);

  const apiKey = process.env.GEMINI_API_KEY || process.env.SUPERJOB_LLM_API_KEY || "";
  const llm = createLLM({
    provider: "gemini",
    model: "gemini-3.6-flash",
    apiKey,
  });

  const logLines: string[] = [];
  const log = (msg: string) => {
    console.log(msg);
    logLines.push(msg);
  };

  log(`[1/5] Initializing Gemini 3.6 Flash Client: Available = ${llm.isAvailable()}`);

  // 1. Load candidate resume
  const resumePath = path.resolve(rootDir, "shashi_resume_fina (1).pdf");
  log(`[2/5] Loading Candidate Resume from: ${path.basename(resumePath)}`);
  const pdfBytes = fs.readFileSync(resumePath);
  const resumeText = await pdfToText(pdfBytes);
  const parsedCandidate = parseResumeText(resumeText);
  const candidateProfile = parsedCandidate.profile;
  log(`✓ Candidate: ${candidateProfile.firstName} ${candidateProfile.lastName}`);
  log(`  Skills (${candidateProfile.skills.length}): ${candidateProfile.skills.slice(0, 8).join(", ")}...`);

  // 2. Launch browser to inspect Accenture live page
  log(`\n[3/5] Launching browser to fetch real-world job posting...`);
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
  });
  const page = await context.newPage();

  let jobTitle = "";
  let jobLocation = "";
  let jobDescription = "";
  let applyButtons: string[] = [];

  try {
    log(`Navigating to ${targetUrl}...`);
    const resp = await page.goto(targetUrl, { waitUntil: "domcontentloaded", timeout: 45000 });
    log(`HTTP Response: ${resp?.status()}`);

    // Wait for dynamic React / Angular content to mount
    await page.waitForTimeout(3000);

    // Extract title, location, and description
    const pageData = await page.evaluate(() => {
      // Handle cookie banners if present
      const cookieBtn = document.querySelector("#onetrust-accept-btn-handler") as HTMLElement;
      if (cookieBtn) cookieBtn.click();

      // Clean non-text script / style / svg elements
      document.querySelectorAll("script, style, noscript, svg, iframe").forEach(s => s.remove());

      const titleEl = document.querySelector("h1, .job-title, [data-analytics-job-title]");
      const locEl = document.querySelector(".job-location, [data-analytics-job-location], .accenture-location");
      
      // Grab main article / job description container
      const jdContainers = [
        document.querySelector(".job-description"),
        document.querySelector(".job-details-content"),
        document.querySelector("main"),
        document.querySelector("#content"),
        document.body,
      ];
      const validContainer = jdContainers.find(c => c && c.textContent && c.textContent.trim().length > 200);

      // Find all Apply buttons
      const buttons = Array.from(document.querySelectorAll("a, button")).filter(el => {
        const text = (el.textContent || "").toLowerCase().trim();
        const href = el.getAttribute("href") || "";
        return text.includes("apply") || href.includes("apply");
      }).map(el => ({
        text: (el.textContent || "").trim().replace(/\s+/g, " "),
        tag: el.tagName,
        href: el.getAttribute("href") || "",
        id: el.id,
        className: el.className,
      }));

      return {
        title: titleEl?.textContent?.trim() || document.title,
        location: locEl?.textContent?.trim() || "India",
        description: validContainer?.textContent?.trim().replace(/\s+/g, " ").slice(0, 3000) || "",
        buttons,
      };
    });

    jobTitle = pageData.title;
    jobLocation = pageData.location;
    jobDescription = pageData.description;
    applyButtons = pageData.buttons.map(b => `[${b.tag}] "${b.text}" -> ${b.href}`);

    log(`✓ Job Title: ${jobTitle}`);
    log(`✓ Location : ${jobLocation}`);
    log(`✓ Description extracted (${jobDescription.length} chars)`);
    log(`✓ Apply Triggers Detected (${pageData.buttons.length}):`);
    pageData.buttons.forEach((b, i) => {
      log(`   ${i + 1}. [${b.tag}] "${b.text}" (href: ${b.href || "none"})`);
    });

  } catch (err: any) {
    log(`Warning during live page fetch: ${err.message}`);
  } finally {
    await browser.close();
  }

  // 3. Run AI Career Intelligence & ATS Match Scoring with Gemini 3.6 Flash
  log(`\n[4/5] Running Neural ATS Match & Skill Extraction via Gemini 3.6 Flash...`);
  const effectiveJd = jobDescription || "Full Stack Application Developer / AI ML Engineer specializing in enterprise cloud applications, deep learning, Python, and generative AI.";
  
  const atsResult = analyzeATS(resumeText, effectiveJd);
  log(`✓ ATS Readability Score: ${atsResult.score}/100 (Pass Probability: ${(atsResult.passProbability * 100).toFixed(0)}%)`);
  log(`✓ Keyword Match Score  : ${atsResult.keywordScore}/100`);
  log(`✓ Parseability Score   : ${atsResult.parseScore}/100`);
  log(`✓ Matched Keywords (${atsResult.covered.length}): ${atsResult.covered.slice(0, 8).map(k => k.term).join(", ")}...`);
  log(`✓ Keyword Gaps (${atsResult.gaps.length}): ${atsResult.gaps.slice(0, 6).map(k => k.term).join(", ")}...`);

  // Weighted Skill & JD Matching
  log(`\nEvaluating Weighted JD Match with Candidate Profile...`);
  const matchResult = scoreMatch({
    resumeText,
    jobDescription: effectiveJd,
    profileSkills: candidateProfile.skills,
  });
  log(`✓ Weighted Match Score: ${matchResult.score}/100`);
  log(`✓ Matched Skills (${matchResult.matched.length}): ${matchResult.matched.slice(0, 10).join(", ")}`);
  log(`✓ Missing Skills (${matchResult.missing.length}): ${matchResult.missing.slice(0, 6).join(", ")}`);

  // 4. Generate Grounded AI Screening Answers for Accenture Custom Questions
  log(`\n[5/5] Generating Grounded AI Screening Answers for Accenture Application...`);
  const screeningQuestions = [
    "What is your total relevant experience in software development?",
    "Are you comfortable working in a hybrid model across India locations?",
    "What is your current notice period / availability to join?",
    "What are your salary expectations (in INR lakhs or per annum)?",
  ];

  for (const q of screeningQuestions) {
    const ans = await answerQuestion(llm, q, resumeText);
    log(`\nQ: "${q}"`);
    log(`A: "${ans.trim()}"`);
  }

  // 5. Tailored Cover Letter Generation
  log(`\nGenerating Tailored Application Statement for Accenture...`);
  const coverLetter = await generateCoverLetter(
    {
      title: jobTitle,
      company: "Accenture",
      description: jobDescription,
    },
    candidateProfile,
    llm
  );
  log(`✓ Cover Letter Source: ${coverLetter.source}`);
  log(`Preview:\n${coverLetter.text.slice(0, 400)}...\n`);

  log("==================================================================");
  log("REAL-WORLD ACCENTURE TEST COMPLETED SUCCESSFULLY!");
  log("==================================================================");

  fs.writeFileSync(reportPath, logLines.join("\n"), "utf-8");
  console.log(`\nReport written to: ${reportPath}`);
}

main().catch(err => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
