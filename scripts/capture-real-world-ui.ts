/**
 * Capture screenshots of newly added enterprise features:
 * 1. Topbar with Google SSO / session status
 * 2. Resume AI page with Shashi's real parsed resume & ATS score
 * 3. Outreach page with Recruiter & HR finder results
 */
import { chromium } from "playwright";
import * as path from "path";
import * as fs from "fs";

const ARTIFACTS = "C:/Users/shash/.gemini/antigravity-ide/brain/a1e24416-f753-4314-8954-9c3e0c1cbf87";

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

  console.log("Navigating to dashboard...");
  await page.goto("http://localhost:3001");
  await page.waitForTimeout(2000);

  // Remove onboarding overlay completely
  await page.evaluate(() => {
    document.getElementById("ob-overlay")?.remove();
    document.getElementById("ob-modal")?.remove();
  });
  await page.waitForTimeout(1000);

  // 1. Dashboard with Google SSO Pill
  console.log("Capturing Dashboard topbar with Google SSO...");
  await page.screenshot({ path: path.join(ARTIFACTS, "18_dashboard_google_sso.png") });

  // 2. Resume AI page
  console.log("Navigating to Resume AI page...");
  await page.click(".nav-it:has-text('Resume AI')");
  await page.waitForTimeout(1500);
  await page.screenshot({ path: path.join(ARTIFACTS, "19_resume_real_parsed.png") });

  // 3. Outreach page with Recruiter Finder
  console.log("Navigating to Outreach page & finding recruiters...");
  await page.evaluate(() => {
    (document.querySelector(".nav-it[onclick*='outreach']") as HTMLElement)?.click();
  });
  await page.waitForTimeout(1000);
  await page.fill("#rec-co", "Flipkart");
  await page.click("button:has-text('Find HR Contacts')");
  await page.waitForTimeout(3000);
  await page.screenshot({ path: path.join(ARTIFACTS, "20_outreach_recruiter_finder.png") });




  console.log("All enterprise screenshots captured successfully!");
  await browser.close();
}

main().catch(err => {
  console.error("Screenshot capture error:", err);
  process.exit(1);
});
