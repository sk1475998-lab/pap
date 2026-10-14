/** Applier-specific types. */
import type { Job, Profile, Application } from "@superjob/core";

export interface SearchParams {
  keywords: string;
  location: string;
  /** max results to process */
  limit: number;
  /** easy-apply only? */
  easyApplyOnly: boolean;
  /** remote only? */
  remoteOnly: boolean;
  /** skip jobs scoring below this (0–100) */
  minScore: number;
  /** dry-run: fill forms but never click Submit */
  dryRun: boolean;
  /** ms to wait between actions (human-like) */
  delayMs: number;
  /** abort after this many applications */
  maxApplications: number;

  // ─── Advanced LinkedIn Filters (ported from Auto_job_applier_linkedIn) ───

  /** Sort order: "Most relevant" | "Most recent" */
  sortBy?: "Most relevant" | "Most recent";
  /** Date posted filter: "Past 24 hours" | "Past week" | "Past month" | "Any time" */
  datePosted?: "Past 24 hours" | "Past week" | "Past month" | "Any time";
  /** Experience level: "Internship" | "Entry level" | "Associate" | "Mid-Senior level" | "Director" | "Executive" */
  experienceLevel?: string[];
  /** Job type: "Full-time" | "Part-time" | "Contract" | "Temporary" | "Internship" | "Volunteer" | "Other" */
  jobType?: string[];
  /** On-site/remote filter: "On-site" | "Remote" | "Hybrid" */
  onSite?: string[];
  /** Salary range filter */
  salary?: string;
  /** Filter by specific companies */
  companies?: string[];
  /** Filter by industries */
  industry?: string[];
  /** Filter by job functions */
  jobFunction?: string[];
  /** Filter by specific job titles */
  jobTitles?: string[];
  /** Show only jobs with under 10 applicants */
  under10Applicants?: boolean;
  /** Show only jobs from your network connections */
  inYourNetwork?: boolean;
  /** Show only Fair Chance Employer jobs */
  fairChanceEmployer?: boolean;
  /** Benefits filter */
  benefits?: string[];
  /** Commitments filter (e.g., diversity, sustainability) */
  commitments?: string[];

  // ─── Job Gating (from AutoApplyMax/autoApplylinkedin) ───

  /**
   * Optional job-gating rules (company blacklist keywords, max years the user
   * is willing to meet). When set, jobs failing the gates are skipped before
   * any form-filling work. (Added from the AutoApplyMax / autoApplylinkedin
   * filter concepts; implemented independently in @superjob/core job-gating.)
   */
  gates?: {
    blacklistKeywords?: string[];
    maxYearsRequired?: number;
  };
}

export const DEFAULT_SEARCH: SearchParams = {
  keywords: "software engineer",
  location: "Remote",
  limit: 25,
  easyApplyOnly: true,
  remoteOnly: false,
  minScore: 0,
  dryRun: false,
  delayMs: 900,
  maxApplications: 10,
};

export type ApplyOutcome =
  | "applied"
  | "dry-run"
  | "skipped-low-score"
  | "skipped-gate"
  | "skipped-already-applied"
  | "skipped-no-easy-apply"
  | "skipped-risk"
  | "daily-limit"
  | "failed"
  | "requires-review";

export interface ApplyResult {
  job: Job;
  outcome: ApplyOutcome;
  matchScore: number;
  filledFields: number;
  error?: string;
  appliedAt: number;
}

export interface PipelineReport {
  discovered: number;
  scored: number;
  applied: number;
  dryRun: number;
  skipped: number;
  failed: number;
  results: ApplyResult[];
  durationMs: number;
  /**
   * Set when the whole run was stopped early by a session guardrail rather
   * than finishing the job queue — e.g. the provider's own daily application
   * wall appeared ("daily-limit") or a run-wide progress stall.
   */
  haltReason?: string;
}

export interface ProxyConfig {
  /** Proxy server URL e.g. http://myproxy:8080 or socks5://127.0.0.1:1080 */
  server: string;
  /** Optional comma-separated list of hosts to bypass */
  bypass?: string;
  /** Optional username for proxy authentication */
  username?: string;
  /** Optional password for proxy authentication */
  password?: string;
}

export interface BrowserOptions {
  /** persistent session directory — reuse cookies so you log in once */
  userDataDir?: string;
  headless?: boolean;
  /** slow down actions for anti-bot realism */
  slowMo?: number;
  /** extra chrome flags */
  extraArgs?: string[];
  /** Optional proxy server configuration for stealth routing & bot mitigation */
  proxy?: ProxyConfig;
}

export const DEFAULT_BROWSER: BrowserOptions = {
  userDataDir: undefined, // set per-run
  headless: false, // visible by default — you should watch it
  slowMo: 50,
};

