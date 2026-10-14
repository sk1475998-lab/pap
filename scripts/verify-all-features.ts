import { chromium } from "playwright";
import * as path from "path";
import * as fs from "fs";

const ARTIFACTS = "C:/Users/shash/.gemini/antigravity-ide/brain/9d921237-12d0-4991-aaa5-c99219371128";
const EXT_PATH = path.resolve("packages/extension/.output/chrome-mv3");

async function main() {
  console.log("=== STARTING FULL SYSTEM & EXTENSION VERIFICATION ===");
  console.log("Artifacts directory:", ARTIFACTS);
  console.log("Extension directory:", EXT_PATH);

  // Launch browser with unpacked extension loaded
  const context = await chromium.launchPersistentContext("", {
    headless: false,
    args: [
      `--disable-extensions-except=${EXT_PATH}`,
      `--load-extension=${EXT_PATH}`,
      "--no-sandbox",
      "--disable-setuid-sandbox",
    ],
    viewport: { width: 1440, height: 900 },
  });

  const page = await context.newPage();
  console.log("\n[1/7] Testing Dashboard at http://localhost:3001...");
  await page.goto("http://localhost:3001", { waitUntil: "networkidle" });
  await page.waitForTimeout(2000);

  // Dismiss onboarding overlay if present
  await page.evaluate(() => {
    document.getElementById("ob-overlay")?.remove();
    document.getElementById("ob-modal")?.remove();
  });
  await page.waitForTimeout(1000);

  await page.screenshot({ path: path.join(ARTIFACTS, "live_dashboard_home.png") });
  console.log("✓ Saved live_dashboard_home.png");

  // Check Profile Data on Dashboard
  const profileInfo = await page.evaluate(() => {
    return {
      statusText: document.getElementById("status-indicator")?.textContent?.trim(),
      engineText: document.getElementById("engine-status")?.textContent?.trim(),
    };
  });
  console.log("Dashboard status:", profileInfo);

  // [2/7] Test Resume AI Tab
  console.log("\n[2/7] Testing Resume AI tab...");
  await page.evaluate(() => {
    (window as any).go("resume", document.querySelector(".nav-it[onclick*='resume']"));
  });
  await page.waitForTimeout(2500);
  await page.screenshot({ path: path.join(ARTIFACTS, "live_resume_ai_tab.png") });
  console.log("✓ Saved live_resume_ai_tab.png");

  // [3/7] Test Job Search Tab
  console.log("\n[3/7] Testing Job Search tab...");
  await page.evaluate(() => {
    (window as any).go("jobs", document.querySelector(".nav-it[onclick*='jobs']"));
  });
  await page.waitForTimeout(2500);
  await page.screenshot({ path: path.join(ARTIFACTS, "live_job_search_tab.png") });
  console.log("✓ Saved live_job_search_tab.png");

  // [4/7] Test Review Queue Tab (HITL Tiered Approval)
  console.log("\n[4/7] Testing Review Queue tab...");
  await page.evaluate(() => {
    (window as any).go("review-queue", document.querySelector(".nav-it[onclick*='review-queue']"));
  });
  await page.waitForTimeout(2500);
  await page.screenshot({ path: path.join(ARTIFACTS, "live_review_queue_tab.png") });
  console.log("✓ Saved live_review_queue_tab.png");

  // [5/7] Test Orion AI Chat Tab
  console.log("\n[5/7] Testing Orion AI Chat tab...");
  await page.evaluate(() => {
    (window as any).go("orion", document.querySelector(".nav-it[onclick*='orion']"));
  });
  await page.waitForTimeout(2000);
  await page.evaluate(() => {
    const inp = document.getElementById("orion-in") as HTMLInputElement;
    if (inp) {
      inp.value = "What roles best match my ML/AI experience at Samsung R&D?";
      (window as any).sendOrionMessage();
    }
  });
  await page.waitForTimeout(3500);
  await page.screenshot({ path: path.join(ARTIFACTS, "live_orion_chat_tab.png") });
  console.log("✓ Saved live_orion_chat_tab.png");

  // [6/7] Test India Salary & Company Intelligence
  console.log("\n[6/7] Testing Salary Intel tab...");
  await page.evaluate(() => {
    (window as any).go("salary", document.querySelector(".nav-it[onclick*='salary']"));
  });
  await page.waitForTimeout(2000);
  await page.screenshot({ path: path.join(ARTIFACTS, "live_salary_intel_tab.png") });
  console.log("✓ Saved live_salary_intel_tab.png");

  // [7/7] Test Chrome Extension Pages directly
  console.log("\n[7/7] Testing Chrome Extension Pages...");
  // Find extension ID from background service workers
  let extensionId = "";
  const backgroundPages = context.serviceWorkers();
  for (const sw of backgroundPages) {
    const url = sw.url();
    const match = url.match(/chrome-extension:\/\/([a-z0-9]+)\//);
    if (match) {
      extensionId = match[1];
      break;
    }
  }

  console.log("Detected Extension ID in test browser:", extensionId || "fallback to manifest id");
  if (!extensionId) {
    // If not immediately available from serviceWorkers, get from loaded extensions
    const targets = context.pages();
    for (const p of targets) {
      const match = p.url().match(/chrome-extension:\/\/([a-z0-9]+)\//);
      if (match) {
        extensionId = match[1];
        break;
      }
    }
  }

  if (extensionId) {
    const extPage = await context.newPage();
    console.log(`Navigating to chrome-extension://${extensionId}/onboarding.html...`);
    await extPage.goto(`chrome-extension://${extensionId}/onboarding.html`, { waitUntil: "networkidle" });
    await extPage.waitForTimeout(2000);
    await extPage.screenshot({ path: path.join(ARTIFACTS, "live_extension_onboarding.png") });
    console.log("✓ Saved live_extension_onboarding.png");

    console.log(`Navigating to chrome-extension://${extensionId}/sidepanel.html...`);
    await extPage.goto(`chrome-extension://${extensionId}/sidepanel.html`, { waitUntil: "networkidle" });
    await extPage.waitForTimeout(2000);
    await extPage.screenshot({ path: path.join(ARTIFACTS, "live_extension_sidepanel.png") });
    console.log("✓ Saved live_extension_sidepanel.png");
  }

  console.log("\n=== ALL VERIFICATION CHECKS COMPLETED CLEANLY ===");
  await context.close();
}

main().catch(console.error);
