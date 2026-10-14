/**
 * Indeed source adapter.
 *
 * Navigates Indeed's job search, collects job cards, and attempts to apply
 * via Indeed's "Apply now" flow when available.
 *
 * Ported from first2apply's SiteProvider.indeed concept,
 * implemented independently with Playwright for our headless engine.
 */
import type { Page } from "playwright";
import type { Job } from "@superjob/core";
import type { JobCard, SourceAdapter } from "./types.js";
import type { SearchParams } from "../types.js";

const BASE = "https://www.indeed.com";
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export const IndeedAdapter: SourceAdapter = {
  id: "indeed",

  async ensureLogin(page: Page): Promise<boolean> {
    await page.goto(`${BASE}/`, { waitUntil: "domcontentloaded" });
    await sleep(1500);
    // Indeed doesn't strictly require login for searching, but logged-in users
    // get "Apply now" buttons. Check for account menu.
    const loggedIn = await page
      .locator('[data-gnav-element-name="Account"], #userOptionsLabel, [data-testid="gnav-header-userinfo"]')
      .first()
      .isVisible({ timeout: 4000 })
      .catch(() => false);
    if (loggedIn) return true;

    // Navigate to sign in
    await page.goto(`${BASE}/account/login`, { waitUntil: "domcontentloaded" });
    console.log(
      "\n⚠️  Please log in to Indeed in the browser window.\n" +
        "   Waiting for login to complete..."
    );
    try {
      await page.waitForURL("**/", { timeout: 180000 });
      await sleep(2000);
      return true;
    } catch {
      return false;
    }
  },

  async search(page: Page, params: SearchParams): Promise<void> {
    const url =
      `${BASE}/jobs?` +
      new URLSearchParams({
        q: params.keywords,
        l: params.location,
        ...(params.remoteOnly ? { remotejob: "032b3046-06a3-4876-8dfd-474eb5e7ed11" } : {}),
        ...(params.datePosted === "Past 24 hours" ? { fromage: "1" } : {}),
        ...(params.datePosted === "Past week" ? { fromage: "7" } : {}),
        ...(params.datePosted === "Past month" ? { fromage: "30" } : {}),
        ...(params.salary ? { salary: params.salary } : {}),
      }).toString();
    await page.goto(url, { waitUntil: "domcontentloaded" });
    await sleep(params.delayMs || 1500);
  },

  async collectCards(page: Page, params: SearchParams): Promise<JobCard[]> {
    const cards: JobCard[] = [];

    // Indeed uses various selectors for job cards across A/B tests
    const listItems = page.locator(
      '.jobsearch-ResultsList .job_seen_beacon, .jobsearch-SerpJobCard, [data-testid="slider_item"], .resultContent'
    );
    const count = Math.min(await listItems.count(), params.limit);

    for (let i = 0; i < count; i++) {
      const card = listItems.nth(i);
      try {
        const title = (await card.locator("h2.jobTitle a, h2 a, .jcs-JobTitle").first().textContent({ timeout: 2000 }))?.trim() ?? "";
        const company = (await card.locator(".companyName, [data-testid='company-name'], .company").first().textContent({ timeout: 2000 }))?.trim() ?? "";
        const location = (await card.locator(".companyLocation, [data-testid='text-location']").first().textContent({ timeout: 2000 }))?.trim() ?? "";

        if (!title) continue;

        const job: Job = {
          id: `indeed_${i}_${Date.now()}`,
          url: page.url(),
          title: title.slice(0, 200),
          company: company.slice(0, 200),
          location: location.slice(0, 200),
          description: "",
          salary: "",
          remote: /remote/i.test(location),
          source: "indeed",
          savedAt: Date.now(),
        };

        cards.push({
          job,
          open: async (p: Page) => {
            await card.click({ timeout: 5000 }).catch(() => {});
            await sleep(1000);
          },
        });
      } catch {
        continue;
      }
    }
    return cards;
  },

  async openEasyApply(page: Page, card: JobCard): Promise<boolean> {
    // Indeed shows "Apply now" button in the detail pane
    const applyBtn = page.locator(
      'button:has-text("Apply now"), a:has-text("Apply now"), [data-testid="indeedApply-button"], #indeedApplyButton'
    );
    const visible = await applyBtn.first().isVisible({ timeout: 4000 }).catch(() => false);
    if (!visible) return false;

    // Capture description
    card.job.description =
      (await page.locator("#jobDescriptionText, .jobsearch-jobDescriptionText, [id*=jobDescription]").first().textContent({ timeout: 3000 }).catch(() => ""))?.trim() ?? "";

    await applyBtn.first().click({ timeout: 5000 });
    await sleep(1000);
    return true;
  },

  async advanceForm(page: Page) {
    await sleep(400);

    const continueBtn = page.locator('button:has-text("Continue"), button[data-testid="continueButton"]');
    if (await continueBtn.first().isVisible({ timeout: 1000 }).catch(() => false)) {
      await continueBtn.first().click({ timeout: 3000 }).catch(() => {});
      return "next";
    }

    const reviewBtn = page.locator('button:has-text("Review"), button[data-testid="reviewButton"]');
    if (await reviewBtn.first().isVisible({ timeout: 1000 }).catch(() => false)) {
      await reviewBtn.first().click({ timeout: 3000 }).catch(() => {});
      return "review";
    }

    const submitBtn = page.locator('button:has-text("Submit"), button[data-testid="submitButton"]');
    if (await submitBtn.first().isVisible({ timeout: 1000 }).catch(() => false)) {
      return "submit";
    }

    return "done";
  },
};
