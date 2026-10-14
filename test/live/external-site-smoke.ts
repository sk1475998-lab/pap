/****
 * Read-only live smoke tester for external job pages.
 * It never logs in, never clicks Apply/Submit, and never fills forms.
 * Usage:
 *   npx tsx test/live/external-site-smoke.ts https://www.linkedin.com/jobs/search/?keywords=frontend%20engineer https://www.naukri.com/react-jobs
 */
import { chromium } from "playwright";
import { detectPlatform } from "../../packages/extension/src/lib/platforms.ts";

const urls = process.argv.slice(2);
if (!urls.length) {
  console.log("No URLs supplied. Provide public job/search URLs to smoke-test read-only extraction.");
  process.exit(0);
}

const BLOCKED_CLICK_RE = /apply|submit|easy apply|sign in|login|save|register/i;

async function main() {
  const browser = await chromium.launch({ headless: true });
  const results: unknown[] = [];
  for (const url of urls) {
    const page = await browser.newPage();
    await page.route("**/*", async (route) => {
      const req = route.request();
      if (!["document", "script", "xhr", "fetch"].includes(req.resourceType())) return route.abort().catch(() => undefined);
      return route.continue().catch(() => undefined);
    });
    try {
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
      await page.waitForTimeout(2500);
      const title = await page.title().catch(() => "");
      const bodyText = ((await page.locator("body").innerText({ timeout: 5000 }).catch(() => "")) || "").slice(0, 5000);
      const dangerousButtons = await page.locator("button,a,input[type=submit]").evaluateAll((els, reSource) => {
        const re = new RegExp(String(reSource), "i");
        return els
          .map((el) => ({ text: (el.textContent || (el as HTMLInputElement).value || "").trim().slice(0, 80), href: (el as HTMLAnchorElement).href || "" }))
          .filter((x) => re.test(`${x.text} ${x.href}`))
          .slice(0, 10);
      }, BLOCKED_CLICK_RE.source);
      const platform = detectPlatform(url);
      results.push({ url, ok: true, title, platform: platform?.id ?? null, textLength: bodyText.length, possibleApplyControls: dangerousButtons, sample: bodyText.slice(0, 500) });
    } catch (e) {
      results.push({ url, ok: false, error: e instanceof Error ? e.message : String(e) });
    } finally {
      await page.close().catch(() => undefined);
    }
  }
  await browser.close();
  console.log(JSON.stringify({ generatedAt: new Date().toISOString(), mode: "read-only-no-login-no-submit", results }, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
