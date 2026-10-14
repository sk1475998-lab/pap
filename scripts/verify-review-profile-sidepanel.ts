import { chromium } from "playwright";
import * as path from "path";

const ARTIFACTS = "C:/Users/shash/.gemini/antigravity-ide/brain/9d921237-12d0-4991-aaa5-c99219371128";
const EXT_PATH = path.resolve("packages/extension/.output/chrome-mv3");

async function main() {
  const context = await chromium.launchPersistentContext("", {
    headless: false,
    args: [
      `--disable-extensions-except=${EXT_PATH}`,
      `--load-extension=${EXT_PATH}`,
      "--no-sandbox",
    ],
    viewport: { width: 1440, height: 900 },
  });

  const page = await context.newPage();
  await page.goto("http://localhost:3001", { waitUntil: "networkidle" });
  await page.waitForTimeout(2000);

  // Dismiss onboarding overlay
  await page.evaluate(() => {
    document.getElementById("ob-overlay")?.remove();
    document.getElementById("ob-modal")?.remove();
  });

  // 1. Capture Review Queue Tab
  console.log("Navigating to Review Queue tab in dashboard...");
  await page.evaluate(() => {
    (window as any).go("review", document.querySelector(".nav-it[onclick*='review']"));
  });
  await page.waitForTimeout(2500);
  await page.screenshot({ path: path.join(ARTIFACTS, "live_review_queue_verified.png") });
  console.log("✓ Saved live_review_queue_verified.png");

  // 2. Capture My Profile Tab
  console.log("Navigating to My Profile tab in dashboard...");
  await page.evaluate(() => {
    (window as any).go("profile", document.querySelector(".nav-it[onclick*='profile']"));
  });
  await page.waitForTimeout(2500);
  await page.screenshot({ path: path.join(ARTIFACTS, "live_my_profile_verified.png") });
  console.log("✓ Saved live_my_profile_verified.png");

  // 3. Capture Extension Sidepanel with Review Tab active
  let extensionId = "";
  for (const sw of context.serviceWorkers()) {
    const match = sw.url().match(/chrome-extension:\/\/([a-z0-9]+)\//);
    if (match) { extensionId = match[1]; break; }
  }
  if (!extensionId) {
    for (const p of context.pages()) {
      const match = p.url().match(/chrome-extension:\/\/([a-z0-9]+)\//);
      if (match) { extensionId = match[1]; break; }
    }
  }

  if (extensionId) {
    const sidepanelPage = await context.newPage();
    await sidepanelPage.goto(`chrome-extension://${extensionId}/sidepanel.html`, { waitUntil: "networkidle" });
    await sidepanelPage.waitForTimeout(1500);

    // Click on "Review" tab in the sidepanel
    console.log("Clicking Review tab in Extension Sidepanel...");
    await sidepanelPage.evaluate(() => {
      const btn = Array.from(document.querySelectorAll("button")).find(b => b.textContent?.includes("Review"));
      if (btn) (btn as HTMLElement).click();
    });
    await sidepanelPage.waitForTimeout(2000);
    await sidepanelPage.screenshot({ path: path.join(ARTIFACTS, "live_extension_sidepanel_review_queue.png") });
    console.log("✓ Saved live_extension_sidepanel_review_queue.png");

    // Click on "Fleet" tab in the sidepanel
    console.log("Clicking Fleet tab in Extension Sidepanel...");
    await sidepanelPage.evaluate(() => {
      const btn = Array.from(document.querySelectorAll("button")).find(b => b.textContent?.includes("Fleet"));
      if (btn) (btn as HTMLElement).click();
    });
    await sidepanelPage.waitForTimeout(2000);
    await sidepanelPage.screenshot({ path: path.join(ARTIFACTS, "live_extension_sidepanel_fleet.png") });
    console.log("✓ Saved live_extension_sidepanel_fleet.png");
  }

  await context.close();
  console.log("=== ALL TARGET VIEWS CAPTURED SUCCESSFULLY ===");
}

main().catch(console.error);
