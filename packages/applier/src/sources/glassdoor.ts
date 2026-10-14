/**
 * Glassdoor source adapter.
 *
 * Navigates Glassdoor's job search, collects job cards, and opens application flows.
 * Ported from first2apply's SiteProvider.glassdoor concept.
 */
import type { Page } from "playwright";
import type { Job } from "@superjob/core";
import type { JobCard, SourceAdapter } from "./types.js";
import type { SearchParams } from "../types.js";

const BASE = "https://www.glassdoor.com";
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export const GlassdoorAdapter: SourceAdapter = {
  id: "glassdoor",

  async ensureLogin(page: Page): Promise<boolean> {
    await page.goto(`${BASE}/`, { waitUntil: "domcontentloaded" });
    await sleep(1500);
    const loggedIn = await page
      .locator('[data-test="header-profile"], .HeaderMenu_profile, #ProfileMenuButton')
      .first()
      .isVisible({ timeout: 4000 })
      .catch(() => false);
    if (loggedIn) return true;

    await page.goto(`${BASE}/profile/login_input.htm`, { waitUntil: "domcontentloaded" });
    console.log("\n⚠️  Please log in to Glassdoor in the browser window.\n");
    try {
      await page.waitForURL("**/member/**", { timeout: 180000 });
      return true;
    } catch {
      return false;
    }
  },

  async search(page: Page, params: SearchParams): Promise<void> {
    const keyword = encodeURIComponent(params.keywords);
    const location = encodeURIComponent(params.location);
    const url = `${BASE}/Job/jobs.htm?sc.keyword=${keyword}&locT=C&locKeyword=${location}`;
    await page.goto(url, { waitUntil: "domcontentloaded" });
    await sleep(params.delayMs || 1500);
  },

  async collectCards(page: Page, params: SearchParams): Promise<JobCard[]> {
    const cards: JobCard[] = [];
    const listItems = page.locator(
      '.react-job-listing, [data-test="jobListing"], li[data-id]'
    );
    const count = Math.min(await listItems.count(), params.limit);

    for (let i = 0; i < count; i++) {
      const card = listItems.nth(i);
      try {
        const title = (await card.locator("a.jobLink, [data-test='job-link'], .job-title").first().textContent({ timeout: 2000 }))?.trim() ?? "";
        const company = (await card.locator(".job-search-key-l2q5uo, [data-test='emp-name'], .employer-name").first().textContent({ timeout: 2000 }))?.trim() ?? "";
        const location = (await card.locator("[data-test='emp-location'], .location").first().textContent({ timeout: 2000 }))?.trim() ?? "";

        if (!title) continue;

        const job: Job = {
          id: `glassdoor_${i}_${Date.now()}`,
          url: page.url(),
          title: title.slice(0, 200),
          company: company.slice(0, 200),
          location: location.slice(0, 200),
          description: "",
          salary: "",
          remote: /remote/i.test(location),
          source: "glassdoor",
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
    const applyBtn = page.locator(
      'button:has-text("Easy Apply"), button:has-text("Apply"), [data-test="applyButton"]'
    );
    const visible = await applyBtn.first().isVisible({ timeout: 4000 }).catch(() => false);
    if (!visible) return false;

    card.job.description =
      (await page.locator(".jobDescriptionContent, [data-test='jobDescriptionContent'], #JobDescriptionContainer").first().textContent({ timeout: 3000 }).catch(() => ""))?.trim() ?? "";

    await applyBtn.first().click({ timeout: 5000 });
    await sleep(1000);
    return true;
  },

  async advanceForm(page: Page) {
    await sleep(400);
    const next = page.locator('button:has-text("Next"), button:has-text("Continue")');
    if (await next.first().isVisible({ timeout: 1000 }).catch(() => false)) {
      await next.first().click({ timeout: 3000 }).catch(() => {});
      return "next";
    }
    const submit = page.locator('button:has-text("Submit"), button[type="submit"]');
    if (await submit.first().isVisible({ timeout: 1000 }).catch(() => false)) {
      return "submit";
    }
    return "done";
  },
};
