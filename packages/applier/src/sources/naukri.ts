import type { Page } from "playwright";
import type { Job } from "@superjob/core";
import type { SourceAdapter, JobCard } from "./types.js";
import type { SearchParams } from "../types.js";

export class NaukriAdapter implements SourceAdapter {
  readonly id = "naukri";

  async ensureLogin(page: Page): Promise<boolean> {
    await page.goto("https://www.naukri.com/nlogin/login");
    await page.waitForLoadState("domcontentloaded");

    // Check if already logged in (redirected to dashboard)
    if (page.url().includes("/mnj/dashboard") || page.url().includes("/homepage")) {
      return true;
    }

    // Try finding the login elements (standard naukri usernames and inputs)
    const emailInput = page.locator("#usernameField");
    if (await emailInput.isVisible()) {
      // Return false to indicate user needs to authenticate manually or login agent needs credentials
      return false;
    }

    return true;
  }

  async search(page: Page, params: SearchParams): Promise<void> {
    const q = encodeURIComponent(params.keywords || "");
    const loc = encodeURIComponent(params.location || "India");
    // Standard Naukri search result query path
    await page.goto(`https://www.naukri.com/${q}-jobs-in-${loc}`);
    await page.waitForLoadState("networkidle");
  }

  async collectCards(page: Page, _params: SearchParams): Promise<JobCard[]> {
    const cards: JobCard[] = [];

    // Target the modern job item selectors on Naukri results page
    const listItems = page.locator("article.jobTuple, .srp-jobtuple, .cust-job-tuple, .srp-jobtuple-wrapper, [data-job-id]");
    const count = await listItems.count().catch(() => 0);

    for (let i = 0; i < count; i++) {
      const cardLocator = listItems.nth(i);
      
      const title = (await cardLocator.locator("a.title, [class*='title']").first().textContent().catch(() => ""))?.trim() ?? "";
      const company = (await cardLocator.locator("a.comp-name, .companyInfo a.comp-name, a[class*='comp-name']").first().textContent().catch(() => ""))?.trim() ?? "";
      const description = (await cardLocator.locator(".job-desc, .job-description, .job-desc-ni, [class*='job-desc']").first().textContent().catch(() => ""))?.trim() ?? "";
      const location = (await cardLocator.locator(".locWdth, [class*='loc'], span.location").first().textContent().catch(() => ""))?.trim() || "India";
      const salary = (await cardLocator.locator(".sal-wrap, [class*='sal'], span.salary").first().textContent().catch(() => ""))?.trim() || "";
      
      // Check if quick apply / apply button exists on card
      const hasQuickApply = await cardLocator.locator(".apply-button, .instant-apply, button:has-text('Apply'), [id*='apply']").first().isVisible().catch(() => false);

      const job: Job = {
        id: `naukri_${i}_${Date.now()}`,
        url: (await cardLocator.locator("a.title, [class*='title']").first().getAttribute("href").catch(() => null)) ?? page.url(),
        title: title || "Role at " + (company || "Company"),
        company: company || "Undisclosed",
        description,
        source: "naukri",
        postedAt: new Date().toISOString(),
        location,
        salary,
        remote: /remote|wfh|work\s*from\s*home/i.test(location + " " + description),
        savedAt: Date.now(),
      };

      cards.push({
        job,
        easyApplySelector: hasQuickApply ? `.cust-job-tuple:nth-of-type(${i + 1}) .apply-button, .srp-jobtuple:nth-of-type(${i + 1}) .apply-button` : undefined,
        open: async (_p: Page) => {
          await cardLocator.locator("a.title, [class*='title']").first().click().catch(() => null);
        },
      });
    }

    return cards;
  }

  async openEasyApply(page: Page, card: JobCard): Promise<boolean> {
    if (card.easyApplySelector) {
      await page.click(card.easyApplySelector).catch(() => null);
      await page.waitForTimeout(2000);
      return true;
    }
    return false;
  }

  async advanceForm(page: Page): Promise<"submit" | "next" | "review" | "done" | "unknown"> {
    // Quick apply submits immediately. Check for confirmation elements.
    const url = page.url();
    if (
      url.includes("/apply/success") ||
      (await page.locator(".apply-success, .success-message, .apply-message").isVisible().catch(() => false))
    ) {
      return "done";
    }

    // Try finding next/submit button
    const nextBtn = page.locator("button.apply-button, input[value='Submit'], button:has-text('Apply'), button:has-text('Submit'), button:has-text('Save and Continue')").first();
    if (await nextBtn.isVisible().catch(() => false)) {
      await nextBtn.click().catch(() => null);
      return "submit";
    }

    return "unknown";
  }
}
