/**
 * LinkedIn Easy Apply source adapter.
 *
 * Flow:
 *   ensureLogin → search → collectCards → openEasyApply → fillForm → advanceForm
 *
 * The form-filling itself delegates to page-fill.ts (which reuses the core
 * engine), so this file is purely about LinkedIn's page structure.
 *
 * NOTE: Interacting with LinkedIn in an automated way may violate their ToS.
 * The tool is designed for human-in-the-loop use (visible browser, dry-run
 * mode) and you remain responsible for compliance.
 */
import type { Page } from "playwright";
import {
  linkedInEasyApplySelectors,
  LINKEDIN_NO_RESULTS_SELECTORS,
  LINKEDIN_RESULTS_STRATEGIES,
  linkedInResultsContainerSelectors,
} from "@superjob/core";
import type { Job } from "@superjob/core";
import type { JobCard, SourceAdapter } from "./types.js";
import type { SearchParams } from "../types.js";

const BASE = "https://www.linkedin.com";
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export const LinkedInAdapter: SourceAdapter = {
  id: "linkedin",

  async ensureLogin(page: Page): Promise<boolean> {
    await page.goto(`${BASE}/`, { waitUntil: "domcontentloaded" });
    await sleep(1500);
    // if we see the feed's nav or the session cookie is valid, we're in
    const loggedIn = await page
      .locator('[data-test-id="global-nav"], .global-nav, input[role="search"]')
      .first()
      .isVisible({ timeout: 4000 })
      .catch(() => false);
    if (loggedIn) return true;

    // not logged in — go to login and wait for the human
    await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
    console.log(
      "\n⚠️  Please log in to LinkedIn in the browser window.\n" +
        "   The session will be saved and reused next time.\n" +
        "   Waiting for login to complete..."
    );
    // wait up to 3 minutes for the user to log in (feed appears)
    try {
      await page.waitForURL("**/feed/**", { timeout: 180000 });
      await sleep(2000);
      return true;
    } catch {
      // some accounts land on /mynetwork or /jobs instead
      const navVisible = await page
        .locator(".global-nav, [data-test-id='global-nav']")
        .first()
        .isVisible({ timeout: 5000 })
        .catch(() => false);
      return navVisible;
    }
  },

  async search(page: Page, params: SearchParams): Promise<void> {
    // Build the initial URL with basic query params
    const urlParams: Record<string, string> = {
      keywords: params.keywords,
      location: params.location,
      f_AL: params.easyApplyOnly ? "true" : "false",
    };
    // Remote filter via URL param
    if (params.remoteOnly || params.onSite?.includes("Remote")) urlParams.f_WT = "2";
    else if (params.onSite?.includes("Hybrid")) urlParams.f_WT = "3";
    else if (params.onSite?.includes("On-site")) urlParams.f_WT = "1";

    const url = `${BASE}/jobs/search/?` + new URLSearchParams(urlParams).toString();
    await page.goto(url, { waitUntil: "domcontentloaded" });
    await sleep(params.delayMs);

    // Apply advanced filters if any are set (ported from Auto_job_applier_linkedIn apply_filters)
    const hasAdvancedFilters = params.sortBy || params.datePosted || params.experienceLevel?.length ||
      params.jobType?.length || params.salary || params.companies?.length || params.industry?.length ||
      params.jobFunction?.length || params.jobTitles?.length || params.under10Applicants ||
      params.inYourNetwork || params.fairChanceEmployer || params.benefits?.length || params.commitments?.length;

    if (hasAdvancedFilters) {
      await applyAdvancedFilters(page, params);
    }
  },

  async collectCards(page: Page, params: SearchParams): Promise<JobCard[]> {
    // Fast exit: if LinkedIn is showing a "no results" empty state, don't wait
    // for a list that will never render (Adaptation 9 — first2apply MIT).
    for (const sel of LINKEDIN_NO_RESULTS_SELECTORS) {
      if (await page.locator(sel).first().isVisible({ timeout: 800 }).catch(() => false)) {
        return [];
      }
    }

    // wait for any known results container to render (versioned strategy)
    const containerSelectors = linkedInResultsContainerSelectors();
    const strategyContainers = LINKEDIN_RESULTS_STRATEGIES.map((s) => s.container);
    await page
      .waitForSelector([...containerSelectors, ...strategyContainers].join(", "), { timeout: 8000 })
      .catch(() => {});

    const cards = page.locator(
      '.jobs-search-results__list-item, .scaffold-layout__list-item li, [data-occludable-job-id]'
    );
    const count = Math.min(await cards.count(), params.limit);
    const results: JobCard[] = [];

    for (let i = 0; i < count; i++) {
      const card = cards.nth(i);
      try {
        const title = (await card.locator("h3, .job-card-list__title, [class*=title]").first().textContent({ timeout: 2000 }))?.trim() ?? "";
        const company = (await card.locator(".job-card-container__company-name, [class*=company-name], h4").first().textContent({ timeout: 2000 }))?.trim() ?? "";
        const location = (await card.locator(".job-card-container__metadata-item, [class*=location]").first().textContent({ timeout: 2000 }))?.trim() ?? "";

        if (!title) continue;

        const job: Job = {
          id: `li_${i}_${Date.now()}`,
          url: page.url(),
          title: clean(title),
          company: clean(company),
          location: clean(location),
          description: "", // filled when the card is opened
          salary: "",
          remote: /remote/i.test(location),
          source: "linkedin",
          savedAt: Date.now(),
        };

        results.push({
          job,
          open: async (p: Page) => {
            await card.click({ timeout: 5000 }).catch(() => {});
            await sleep(800);
          },
        });
      } catch {
        continue;
      }
    }
    return results;
  },

  async openEasyApply(page: Page, card: JobCard): Promise<boolean> {
    // Look for the Easy Apply control. LinkedIn ships several UIs (legacy job
    // page vs the newer SDUI apply flow), so we probe the resilient selector
    // set from @superjob/core (aria-label prefix, SDUI apply-flow link, legacy
    // jobs-apply-button class) before falling back to text/class matching.
    const easyApplyBtn = page.locator(
      [
        ...linkedInEasyApplySelectors(),
        'button.jobs-apply-button:has-text("Easy Apply")',
        'button[aria-label*="Easy Apply"]',
        '.jobs-apply-button--top-card .jobs-apply-button',
      ].join(", ")
    );

    const visible = await easyApplyBtn.first().isVisible({ timeout: 4000 }).catch(() => false);
    if (!visible) {
      // check if already applied
      const applied = await page
        .locator('button:has-text("Applied"), .post-apply-timestamp')
        .first()
        .isVisible({ timeout: 1000 })
        .catch(() => false);
      if (applied) return false; // already applied — signal skip
      return false;
    }

    await easyApplyBtn.first().click({ timeout: 5000 });
    // wait for the Easy Apply modal to appear
    await page
      .waitForSelector('.jobs-easy-apply-modal, [data-test-modal], .modal__content', { timeout: 6000 })
      .catch(() => {});
    await sleep(500);

    // capture the job description now that the detail pane is loaded
    card.job.description =
      (await page.locator(".jobs-description__content, .description__text, [class*=jobs-description]").first().textContent({ timeout: 3000 }).catch(() => ""))?.trim() ?? "";

    return true;
  },

  async advanceForm(page: Page) {
    await sleep(400);

    // priority: Review (last step) > Next > Submit
    const review = page.locator('button:has-text("Review"), button[aria-label*="Review"]');
    if (await review.first().isVisible({ timeout: 1000 }).catch(() => false)) {
      await review.first().click({ timeout: 3000 }).catch(() => {});
      return "review";
    }

    const next = page.locator('button:has-text("Next"), button[aria-label*="Next"], button[aria-label="Continue to next step"]');
    if (await next.first().isVisible({ timeout: 1000 }).catch(() => false)) {
      await next.first().click({ timeout: 3000 }).catch(() => {});
      return "next";
    }

    const submit = page.locator('button:has-text("Submit application"), button[type="submit"]:has-text("Submit")');
    if (await submit.first().isVisible({ timeout: 1000 }).catch(() => false) || await submit.count() > 0) {
      // don't auto-click submit in dry-run; the pipeline handles that
      return "submit";
    }

    // modal closed = done
    const modalOpen = await page.locator('.jobs-easy-apply-modal, [data-test-modal]').first().isVisible({ timeout: 1000 }).catch(() => false);
    return modalOpen ? "unknown" : "done";
  },
};

function clean(s: string): string {
  return s.replace(/\s+/g, " ").trim().slice(0, 200);
}

/**
 * Apply advanced LinkedIn search filters via the "All filters" modal.
 * Ported from Auto_job_applier_linkedIn/runAiBot.py apply_filters().
 */
async function applyAdvancedFilters(page: Page, params: SearchParams): Promise<void> {
  // Open "All filters" modal
  try {
    const allFiltersBtn = page.locator('button:has-text("All filters")');
    if (await allFiltersBtn.first().isVisible({ timeout: 3000 }).catch(() => false)) {
      await allFiltersBtn.first().click({ timeout: 3000 });
      await sleep(800);
    } else {
      return; // filters button not found, skip
    }
  } catch {
    return;
  }

  // Helper: click a span with matching text inside the filter modal
  const clickSpan = async (text: string) => {
    if (!text) return;
    try {
      const span = page.locator(`span:text-is("${text}")`).first();
      if (await span.isVisible({ timeout: 1500 }).catch(() => false)) {
        await span.scrollIntoViewIfNeeded({ timeout: 2000 }).catch(() => {});
        await span.click({ timeout: 2000 });
        await sleep(300);
      }
    } catch { /* filter option not found, skip */ }
  };

  // Helper: click a boolean toggle switch
  const clickToggle = async (label: string) => {
    try {
      const fieldset = page.locator(`h3:text-is("${label}")`).locator("xpath=ancestor::fieldset");
      const toggle = fieldset.locator('input[role="switch"]');
      if (await toggle.first().isVisible({ timeout: 1500 }).catch(() => false)) {
        await toggle.first().click({ timeout: 2000 });
        await sleep(300);
      }
    } catch { /* toggle not found, skip */ }
  };

  // Helper: click multiple span options
  const clickMultiple = async (texts: string[]) => {
    for (const t of texts) await clickSpan(t);
  };

  // Apply each filter category (order matches LinkedIn's modal layout)
  if (params.sortBy) await clickSpan(params.sortBy);
  if (params.datePosted) await clickSpan(params.datePosted);
  if (params.experienceLevel?.length) await clickMultiple(params.experienceLevel);
  if (params.companies?.length) {
    // Companies require search-and-add
    for (const company of params.companies) {
      try {
        await clickSpan("Add a company");
        const searchInput = page.locator("input[placeholder='Add a company']").first();
        if (await searchInput.isVisible({ timeout: 2000 }).catch(() => false)) {
          await searchInput.fill(company);
          await sleep(1500);
          await page.keyboard.press("ArrowDown");
          await page.keyboard.press("Enter");
          await sleep(500);
        }
      } catch { /* company filter failed */ }
    }
  }
  if (params.jobType?.length) await clickMultiple(params.jobType);
  if (params.onSite?.length) await clickMultiple(params.onSite);
  if (params.easyApplyOnly) await clickToggle("Easy Apply");
  if (params.industry?.length) await clickMultiple(params.industry);
  if (params.jobFunction?.length) await clickMultiple(params.jobFunction);
  if (params.jobTitles?.length) await clickMultiple(params.jobTitles);
  if (params.under10Applicants) await clickToggle("Under 10 applicants");
  if (params.inYourNetwork) await clickToggle("In your network");
  if (params.fairChanceEmployer) await clickToggle("Fair Chance Employer");
  if (params.salary) await clickSpan(params.salary);
  if (params.benefits?.length) await clickMultiple(params.benefits);
  if (params.commitments?.length) await clickMultiple(params.commitments);

  // Click "Show results" button to apply all filters
  try {
    const showResults = page.locator('button[aria-label*="apply current filters"], button[aria-label*="Apply current filters"], button:has-text("Show results")');
    if (await showResults.first().isVisible({ timeout: 3000 }).catch(() => false)) {
      await showResults.first().click({ timeout: 3000 });
      await sleep(1500);
    }
  } catch { /* show results button not found */ }
}
