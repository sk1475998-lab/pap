/** Interface every job source adapter implements. */
import type { Page } from "playwright";
import type { Job } from "@superjob/core";
import type { SearchParams } from "../types.js";

export interface JobCard {
  job: Job;
  /** selector or anchor for the Easy Apply button (if found) */
  easyApplySelector?: string;
  /** click the card to open it */
  open: (page: Page) => Promise<void>;
}

export interface SourceAdapter {
  id: string;
  /** ensure we're logged in; returns false if manual login is needed */
  ensureLogin(page: Page): Promise<boolean>;
  /** navigate to the search results */
  search(page: Page, params: SearchParams): Promise<void>;
  /** collect job cards from the current results page */
  collectCards(page: Page, params: SearchParams): Promise<JobCard[]>;
  /** click Easy Apply and return true if the modal/form opened */
  openEasyApply(page: Page, card: JobCard): Promise<boolean>;
  /** advance one step in a multi-page form; returns 'submit' | 'next' | 'done' */
  advanceForm(page: Page): Promise<"submit" | "next" | "review" | "done" | "unknown">;
}
