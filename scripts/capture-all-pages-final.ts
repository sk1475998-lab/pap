import { chromium } from "playwright";
import * as path from "path";

const ARTIFACTS = "C:/Users/shash/.gemini/antigravity-ide/brain/a1e24416-f753-4314-8954-9c3e0c1cbf87";

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

  console.log("Loading dashboard...");
  await page.goto("http://localhost:3001");
  await page.waitForTimeout(3000);

  // Remove onboarding overlay completely
  await page.evaluate(() => {
    document.getElementById("ob-overlay")?.remove();
    document.getElementById("ob-modal")?.remove();
  });
  await page.waitForTimeout(1000);

  // 1. Dashboard with Google SSO and loaded profile
  console.log("Capturing 18_dashboard_google_sso.png...");
  await page.screenshot({ path: path.join(ARTIFACTS, "18_dashboard_google_sso.png") });

  // 2. Resume AI
  console.log("Capturing 19_resume_real_parsed.png...");
  await page.evaluate(() => {
    (window as any).go("resume", document.querySelector(".nav-it[onclick*='resume']"));
  });
  await page.waitForTimeout(2000);
  await page.screenshot({ path: path.join(ARTIFACTS, "19_resume_real_parsed.png") });

  // 3. Outreach & Recruiter Finder
  console.log("Capturing 20_outreach_recruiter_finder.png...");
  await page.evaluate(() => {
    (window as any).go("outreach", document.querySelector(".nav-it[onclick*='outreach']"));
    const inp = document.getElementById("rec-co") as HTMLInputElement;
    if (inp) inp.value = "Flipkart";
    (window as any).findRecruitersUI();
  });
  await page.waitForTimeout(3000);
  await page.screenshot({ path: path.join(ARTIFACTS, "20_outreach_recruiter_finder.png") });

  console.log("All screenshots captured successfully!");
  await browser.close();
}

main().catch(console.error);
