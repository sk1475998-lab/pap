/**
 * Generic source adapter — works on any single job-application page
 * (Greenhouse, Lever, Workday, Ashby, or a direct company career page).
 *
 * Instead of searching + collecting cards, you give it a list of URLs and
 * it fills each one. Useful for batch-applying to a curated list of jobs.
 */
import type { Page } from "playwright";
import type { Job } from "@superjob/core";
import type { JobCard, SourceAdapter } from "./types.js";
import type { SearchParams } from "../types.js";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Build a generic adapter that visits a fixed list of job URLs. */
export function createGenericAdapter(urls: string[]): SourceAdapter {
  let index = 0;
  const cards: JobCard[] = urls.map((url) => ({
    job: {
      id: `gen_${url.slice(-40)}`,
      url,
      title: "",
      company: "",
      description: "",
      source: "generic",
      savedAt: Date.now(),
    } as Job,
    open: async (page: Page) => {
      await page.goto(url, { waitUntil: "domcontentloaded" });
      await sleep(1500);
    },
  }));

  return {
    id: "generic",

    async ensureLogin(_page: Page) {
      return true; // no login needed for direct ATS pages
    },

    async search(_page: Page, params: SearchParams) {
      index = 0;
      void params;
    },

    async collectCards(_page: Page, params: SearchParams) {
      void params;
      return cards.slice(index, index + params.limit);
    },

    async openEasyApply(page: Page, card: JobCard) {
      // capture title + description from the page
      const title = await page.locator("h1, .job-title, [data-automation-id='jobPostingHeader']").first().textContent({ timeout: 3000 }).catch(() => "");
      const desc = await page.locator("main, article, [class*=description], [class*=posting-content]").first().textContent({ timeout: 3000 }).catch(() => "");
      card.job.title = (title ?? "").trim().slice(0, 200);
      card.job.description = (desc ?? "").trim().slice(0, 12000);
      // on generic pages the form is already on screen
      return true;
    },

    async advanceForm(page: Page) {
      await sleep(400);
      const submit = page.locator('button[type="submit"], button:has-text("Submit"), button:has-text("Send Application")');
      if ((await submit.count()) > 0) return "submit";
      const next = page.locator('button:has-text("Next"), button:has-text("Continue")');
      if (await next.first().isVisible({ timeout: 1000 }).catch(() => false)) {
        await next.first().click({ timeout: 3000 }).catch(() => {});
        return "next";
      }
      return "done";
    },
  };
}
