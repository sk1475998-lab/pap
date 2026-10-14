import { chromium } from "playwright";
import * as path from "path";

const ARTIFACTS = "C:/Users/shash/.gemini/antigravity-ide/brain/a1e24416-f753-4314-8954-9c3e0c1cbf87";

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

  await page.goto("http://localhost:3001");
  await page.waitForTimeout(1500);

  // Remove overlay
  await page.evaluate(() => {
    document.getElementById("ob-overlay")?.remove();
    document.getElementById("ob-modal")?.remove();
  });

  // Switch to outreach
  await page.evaluate(() => {
    (document.querySelector(".nav-it[onclick*='outreach']") as HTMLElement)?.click();
  });
  await page.waitForTimeout(1000);

  // Trigger find recruiters
  await page.evaluate(() => {
    const inp = document.getElementById("rec-co") as HTMLInputElement;
    if (inp) inp.value = "Flipkart";
    const btn = document.querySelector("button[onclick*='findRecruitersUI']") as HTMLElement;
    if (btn) btn.click();
  });
  await page.waitForTimeout(2000);

  await page.screenshot({ path: path.join(ARTIFACTS, "20_outreach_recruiter_finder.png") });
  console.log("Captured 20_outreach_recruiter_finder.png successfully!");
  await browser.close();
}

main().catch(console.error);
