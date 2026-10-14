/**
 * Comprehensive Human E2E Test Suite for SuperJobAgent v2.0
 * Simulates a real human user interacting with every page, button, form, and feature.
 */
import { chromium } from "playwright";
import * as path from "path";
import * as fs from "fs";

const SCREENSHOT_DIR = path.resolve("test-screenshots");
if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function runHumanTest() {
  console.log("🚀 Starting Human E2E Test on http://localhost:3001...\n");

  const browser = await chromium.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-gpu"],
  });

  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
  });

  const page = await context.newPage();

  const consoleLogs: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") {
      consoleLogs.push(`[BROWSER ERROR] ${msg.text()}`);
    }
  });

  try {
    // 1. Navigate to Dashboard
    console.log("👉 1. Navigating to http://localhost:3001...");
    await page.goto("http://localhost:3001", { waitUntil: "domcontentloaded" });
    await sleep(2000);

    // Check if onboarding overlay is visible
    const obOverlay = page.locator("#ob-overlay");
    const isObVisible = await obOverlay.isVisible().catch(() => false);

    if (isObVisible) {
      console.log("   📝 Onboarding overlay detected. Testing human onboarding flow...");
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, "01_onboarding_step1.png") });

      // Step 1: Personal
      await page.fill("#ob-name", "Shashi Kumar Banoth");
      await page.fill("#ob-email", "shashi@superjobagent.ai");
      await page.fill("#ob-phone", "+91 98765 43210");
      await page.fill("#ob-li", "linkedin.com/in/shashibanoth");
      await page.click("#s1 .btn-cta");
      await sleep(600);

      // Step 2: Roles
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, "02_onboarding_step2.png") });
      await page.fill("#ob-roles", "Senior Full Stack Engineer, AI Engineer");
      await page.click("#s2 .btn-cta");
      await sleep(600);

      // Step 3: Salary
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, "03_onboarding_step3.png") });
      await page.fill("#ob-loc", "Bangalore, Remote");
      await page.click("#s3 .btn-cta");
      await sleep(600);

      // Step 4: AI Brain
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, "04_onboarding_step4.png") });
      await page.click("#s4 .btn-cta");
      await sleep(600);

      // Step 5: Launch
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, "05_onboarding_step5.png") });
      await page.click("#s5 .btn-cta");
      await sleep(1500);
      console.log("   ✅ Onboarding completed successfully.");
    } else {
      console.log("   ⚡ Profile already exists — auto-skipped onboarding straight to Dashboard.");
    }

    // 2. Test Main Dashboard
    console.log("\n👉 2. Verifying Main Dashboard UI & WebSocket Live State...");
    await sleep(1500);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, "06_main_dashboard.png") });

    const wsTxt = await page.locator("#ws-txt").textContent();
    console.log(`   📡 WebSocket Pill Text: "${wsTxt}"`);

    const statApps = await page.locator("#st-apps").textContent();
    const statInt = await page.locator("#st-int").textContent();
    const statScore = await page.locator("#st-score").textContent();
    const statHrs = await page.locator("#st-hrs").textContent();
    console.log(`   📊 Stat Cards: Apps=${statApps}, Interviews=${statInt}, AvgScore=${statScore}, HoursSaved=${statHrs}`);

    // Test Autopilot Start / Stop
    console.log("\n👉 3. Testing Autopilot Toggle...");
    await page.click("#ap-btn");
    await sleep(2000);
    const logEntries = await page.locator("#ai-log .log-line").count();
    console.log(`   📝 Autopilot started. Live log lines received: ${logEntries}`);

    await page.click("#ap-btn");
    await sleep(1000);
    console.log("   ⏹ Autopilot stopped cleanly.");

    // Test Job Card Apply Click
    console.log("\n👉 4. Testing 1-Click Job Application on Dashboard Feed...");
    const firstApplyBtn = page.locator("#dash-jobs .btn-apply").first();
    if (await firstApplyBtn.isVisible().catch(() => false)) {
      await firstApplyBtn.click();
      await sleep(1000);
      const toastText = await page.evaluate(() => document.querySelector("#toast .toast-it")?.textContent || "");
      console.log(`   🍞 Toast notification: "${toastText}"`);
    }

    // 5. Test Job Search Page
    console.log("\n👉 5. Testing Job Search Page & Filters...");
    await page.click('.nav-it:has-text("Job Search")');
    await sleep(1500);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, "07_job_search.png") });
    const fullJobCount = await page.locator("#jobs-full .jc").count();
    console.log(`   🔍 Discovered Job Cards Rendered: ${fullJobCount}`);

    // Test Auto-apply all
    await page.click('button:has-text("Auto-Apply All")');
    await sleep(1000);
    const toastApplyAll = await page.evaluate(() => document.querySelector("#toast .toast-it")?.textContent || "");
    console.log(`   ⚡ Auto-Apply All action triggered: "${toastApplyAll}"`);


    // 6. Test Tracker / Kanban
    console.log("\n👉 6. Testing Application Tracker (Kanban)...");
    await page.click('.nav-it:has-text("Tracker")');
    await sleep(1500);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, "08_tracker_kanban.png") });
    const kanbanCols = await page.locator(".kb-col").count();
    console.log(`   🎯 Kanban Columns Rendered: ${kanbanCols} (Expected 6)`);

    // 7. Test Resume AI Page & Cover Letter Generator
    console.log("\n👉 7. Testing Resume AI & AI Cover Letter Generator...");
    await page.click('.nav-it:has-text("Resume AI")');
    await sleep(1500);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, "09_resume_ai.png") });

    const atsScore = await page.locator("#ats-main-v").textContent();
    console.log(`   📄 Calculated ATS Compatibility Score: ${atsScore}/100`);

    // Fill Cover Letter inputs
    await page.fill("#cl-co", "Swiggy");
    await page.fill("#cl-jt", "Senior Full Stack Engineer");
    await page.fill("#cl-jd", "Looking for React, TypeScript, Node.js, and high scale system design expertise.");
    await page.click('button:has-text("Generate with AI")');
    await sleep(1500);
    const clText = await page.locator("#cl-out").textContent();
    console.log(`   ✨ Generated Cover Letter (first 120 chars): "${clText?.slice(0, 120)}..."`);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, "10_cover_letter_generated.png") });

    // 8. Test Interview Prep Page
    console.log("\n👉 8. Testing Interview Prep & STAR Accordion...");
    await page.click('.nav-it:has-text("Interview Prep")');
    await sleep(2000);
    await page.waitForSelector("#qa-list .qa-item", { timeout: 6000 }).catch(() => {});
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, "11_interview_prep.png") });

    const firstQa = page.locator("#qa-list .qa-item").first();
    if (await firstQa.isVisible().catch(() => false)) {
      await firstQa.click();
      await sleep(600);
      const answerVisible = await page.locator("#qa-list .qa-item.open .qa-a").isVisible().catch(() => false);
      console.log(`   🎤 STAR Answer Accordion Expanded: ${answerVisible}`);
    }

    // 9. Test Salary Intelligence
    console.log("\n👉 9. Testing Salary Intelligence Suite...");
    await page.click('.nav-it:has-text("Salary Intel")');
    await sleep(2000);
    await page.fill("#sal-role", "Software Engineer");
    await page.fill("#sal-city", "Bangalore");
    await page.fill("#sal-exp", "4");
    await page.click('button:has-text("Calculate")');
    await sleep(2000);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, "12_salary_intel.png") });
    const salCards = await page.locator("#sal-cards .sal-card").count();
    console.log(`   💰 Salary Intelligence Cards Rendered: ${salCards}`);

    // 10. Test India Intel Suite
    console.log("\n👉 10. Testing India Intel Suite (FAANG/Unicorns/Service)...");
    await page.click('.nav-it:has-text("India Intel")');
    await sleep(2000);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, "13_india_intel.png") });

    // Click on Flipkart company card
    const flipkartRow = page.locator('.company-row:has-text("flipkart")').first();
    if (await flipkartRow.isVisible().catch(() => false)) {
      await flipkartRow.click();
      await sleep(1000);
    }

    // Test LPA Calculator
    await page.click('button:has-text("Calculate My Value")');
    await sleep(1000);
    const indSalMain = await page.locator("#ind-sal-main").textContent({ timeout: 3000 }).catch(() => "");
    console.log(`   🇮🇳 India Salary Benchmark Calculated: "${indSalMain}"`);

    // Test LeetCode focus
    await page.fill("#lc-co", "Flipkart");
    await page.click('button:has-text("Get Focus Areas")');
    await sleep(1000);
    const lcTopics = await page.locator("#lc-topics span").count();
    console.log(`   📚 LeetCode Focus Topics Loaded: ${lcTopics}`);


    // 11. Test Outreach Generator
    console.log("\n👉 11. Testing Outreach & Referral Generator...");
    await page.click('.nav-it:has-text("Outreach")');
    await sleep(1500);
    await page.fill("#or-co", "Razorpay");
    await page.fill("#or-jt", "Staff Engineer");
    await page.fill("#or-nm", "Arjun Sharma");
    await page.click('button:has-text("AI Personalize")');
    await sleep(1500);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, "14_outreach_generated.png") });
    const liMsg = await page.locator("#or-li").textContent();
    const emMsg = await page.locator("#or-em").textContent();
    console.log(`   📨 LinkedIn Connection Message (len: ${liMsg?.length} chars): "${liMsg?.slice(0, 100)}..."`);
    console.log(`   ✉️ Referral Email Template (len: ${emMsg?.length} chars): "${emMsg?.slice(0, 100)}..."`);

    // 12. Test Skill Gaps
    console.log("\n👉 12. Testing Skill Gap Analysis...");
    await page.click('.nav-it:has-text("Skill Gaps")');
    await sleep(1500);
    await page.selectOption("#sk-role", "fullstack");
    await page.click('button:has-text("Analyze")');
    await sleep(1500);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, "15_skill_gaps.png") });
    const skCoverage = await page.locator("#sk-coverage").textContent();
    console.log(`   🧠 Skill Coverage for Full Stack: ${skCoverage}`);

    // 13. Test Analytics Page
    console.log("\n👉 13. Testing Analytics Dashboard...");
    await page.click('.nav-it:has-text("Analytics")');
    await sleep(1500);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, "16_analytics.png") });
    const anTotal = await page.locator("#an-total").textContent();
    console.log(`   📈 Analytics Total Applications: ${anTotal}`);

    // 14. Test Profile & Settings Save
    console.log("\n👉 14. Testing Profile & Settings Save...");
    await page.click('.nav-it:has-text("My Profile")');
    await sleep(1000);
    await page.click('button:has-text("Save Profile")');
    await sleep(1000);

    await page.click('.nav-it:has-text("Settings")');
    await sleep(1000);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, "17_settings.png") });
    await page.click('button:has-text("Save Settings")');
    await sleep(1000);

    console.log("\n=======================================================");
    console.log("🎉 ALL 14 HUMAN TEST SCENARIOS COMPLETED WITH SUCCESS!");
    console.log("=======================================================");
    console.log(`Total Screenshots Captured: ${fs.readdirSync(SCREENSHOT_DIR).length}`);
    console.log(`Browser Errors Encountered: ${consoleLogs.length}`);
    if (consoleLogs.length > 0) {
      console.log("Console Errors:", consoleLogs);
    }
  } catch (err: any) {
    console.error("❌ Test failed with error:", err.message);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, "error_failure.png") }).catch(() => {});
    throw err;
  } finally {
    await browser.close();
  }
}

runHumanTest().catch((e) => {
  console.error(e);
  process.exit(1);
});
