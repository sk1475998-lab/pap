/**
 * @superjob/applier — headless autonomous job-application engine.
 *
 * Uses Playwright to drive a real browser, reusing @superjob/core's engine
 * (matcher, resolver, LLM) so the extension and the headless applier share
 * one brain. Supports LinkedIn Easy Apply and any generic ATS page.
 */
export * from "./types.js";
export * from "./browser.js";
export * from "./page-scan.js";
export * from "./page-fill.js";
export * from "./pipeline.js";
export { LinkedInAdapter } from "./sources/linkedin.js";
export { IndeedAdapter } from "./sources/indeed.js";
export { GlassdoorAdapter } from "./sources/glassdoor.js";
export { NaukriAdapter } from "./sources/naukri.js";
export { createGenericAdapter } from "./sources/generic.js";
export { SOURCE_RATE_POLICIES } from "./sources/rate-policies.js";
export type { SourceRatePolicy } from "./sources/rate-policies.js";
export type { SourceAdapter, JobCard } from "./sources/types.js";

