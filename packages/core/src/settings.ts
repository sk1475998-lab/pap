/** Extension / agent behavior settings (stored under settings key). */
export interface AgentSettings {
  /** Master switch for hands-free LinkedIn apply flow */
  autonomousMode: boolean;
  /** Click Easy Apply when viewing a job */
  autoClickEasyApply: boolean;
  /** Fill fields on each wizard step */
  autoFillSteps: boolean;
  /** Click Next / Continue after filling */
  autoAdvanceSteps: boolean;
  /** Click Submit on final step (off = review before submit) */
  autoSubmit: boolean;
  /** Autofill saved credentials on login pages */
  autoLogin: boolean;
  /** Click submit after filling login form */
  autoSubmitLogin: boolean;
  /** Pause agent when OTP / verification code field appears */
  pauseOnOtp: boolean;
  /** Max LLM calls per autofill run (saves API quota) */
  maxLlmCallsPerRun: number;
  /** Cache identical LLM prompts across sessions */
  llmCacheEnabled: boolean;
  /** Reserve LLM usage for resume tailoring; screening questions use saved/profile answers only. */
  llmTailoringOnly: boolean;
  /** Allow resume tailoring before upload when an existing tailored version is absent. */
  autoTailorResume: boolean;
  /** Send diagnostics/audits to a separately configured local API server */
  localApiStreamingEnabled: boolean;
  /** Pause and wait for manual verification before clicking Next/Submit */
  verifyBeforeAdvance: boolean;
  /**
   * For external-ATS jobs on LinkedIn (Apply button that opens company
   * website), automatically open the external ATS in a background tab and
   * start autopilot on it. When false (default), SJA surfaces an
   * "Apply on company website" button in the FAB/side panel and waits for
   * the user to click it.
   */
  autoApplyExternals: boolean;
  /** Intercept final submit button with in-DOM preview and safety confirmation modal (default: false) */
  enableSubmitGuard: boolean;
  /** Campaign knobs shared by the extension, the cloud dashboard and the CLI. */
  search: SearchSettings;
}

/**
 * Search / campaign configuration.
 *
 * This lives in core, not in the server, because it is written by whichever
 * surface the user happens to be looking at and read by all of them. It used to
 * be a private object literal inside `packages/server` (`getDefaultSettings()`),
 * which meant the dashboard and the extension were editing two different
 * `settings` shapes under the same store key — the cloud saved `dailyLimit`, the
 * extension never saw it, and the extension's own keys looked like garbage to
 * the server. One definition here is what makes the two surfaces one product.
 *
 * `@superjob/applier`'s `SearchParams` stays separate on purpose: that is the
 * per-run argument object (keywords, location, computed gates), derived from
 * these persisted preferences rather than duplicating them.
 */
export interface SearchSettings {
  /** Board to run against: linkedin | indeed | glassdoor | naukri. */
  source: string;
  /** Applications per day, across all surfaces. */
  dailyLimit: number;
  /**
   * Skip jobs scoring below this (0–100), measured as real keyword overlap.
   *
   * The default is 55, not 70. `scoreMatch` used to add a fixed +35 floor before
   * reporting, so the old default of 70 actually admitted anything above ~54%
   * genuine overlap. The floor is gone; 55 keeps the same jobs flowing to
   * autopilot as before, and the number now means what it says.
   */
  minMatchScore: number;
  /** Fill forms but never click the final Submit. */
  dryRun: boolean;
  /** Restrict to one-click / Easy Apply postings. */
  easyApplyOnly: boolean;
  /** Prefer postings with fewer than ten applicants. */
  under10Applicants: boolean;
  /** LinkedIn "Date posted" facet. */
  datePosted: "Past 24 hours" | "Past week" | "Past month" | "Any time";
  /** Company-name keywords to refuse, one per entry. */
  blacklistedCompanies: string[];
  /** Run the server-side Playwright browser without a window. */
  headless: boolean;
  /** Email the user when an application outcome is detected. */
  emailNotifications: boolean;
  /** Target job title keywords (whitelist) - if non-empty, only apply to jobs whose title matches at least one keyword. */
  titleKeywords: string[];
  /** Title keywords to exclude (blacklist) - skip jobs whose title contains any of these (e.g. Senior, Lead, Director, Clearance, Intern). */
  titleBlacklist: string[];
  /** Maximum years of experience required (ceiling) - skip jobs explicitly requiring more than this many years. (0 = disabled) */
  maxExperienceYears: number;
  /** Prioritize early postings (lower listed applicant volume or posted within ~24h). */
  prioritizeEarlyApplicants: boolean;
}

export const DEFAULT_SEARCH_SETTINGS: SearchSettings = {
  source: "linkedin",
  dailyLimit: 12,
  minMatchScore: 55,
  // Dry-run ON by default, matching the review-first contract above: the
  // product must never submit an application the user has not seen.
  dryRun: true,
  easyApplyOnly: true,
  under10Applicants: false,
  datePosted: "Past week",
  blacklistedCompanies: [],
  headless: false,
  emailNotifications: true,
  titleKeywords: [],
  titleBlacklist: [],
  maxExperienceYears: 0,
  prioritizeEarlyApplicants: true,
};

export const DEFAULT_AGENT_SETTINGS: AgentSettings = {
  // Review-first defaults: automation requires a deliberate user opt-in.
  autonomousMode: false,
  autoClickEasyApply: false,
  autoFillSteps: false,
  autoAdvanceSteps: false,
  autoSubmit: false,
  autoLogin: false,
  autoSubmitLogin: false,
  pauseOnOtp: true,
  maxLlmCallsPerRun: 3,
  llmCacheEnabled: true,
  llmTailoringOnly: true,
  autoTailorResume: false,
  localApiStreamingEnabled: false,
  // Review-first: even when autonomous mode is enabled, SJA pauses before each
  // Next/Submit unless the user explicitly disables step verification. This is
  // the safety contract asserted by integration/agent-settings-defaults.test.ts
  // and is what the Settings UI and both autopilot engines assume.
  verifyBeforeAdvance: true,
  // Default OFF: don't automatically leave LinkedIn for external ATS pages —
  // show a button instead so the user is in control.
  autoApplyExternals: false,
  // Default OFF: do not block or hijack user submit button with an intrusive modal.
  enableSubmitGuard: false,
  search: DEFAULT_SEARCH_SETTINGS,
};

/**
 * Fill in defaults for anything the caller omitted.
 *
 * `search` is merged one level deep on purpose: a UI that saves a single knob
 * sends `{ search: { dailyLimit: 5 } }`, and a shallow spread would silently
 * reset every other campaign preference to its default.
 */
export function mergeAgentSettings(partial?: Partial<AgentSettings>): AgentSettings {
  const incomingSearch = (partial?.search ?? {}) as Partial<SearchSettings>;
  return {
    ...DEFAULT_AGENT_SETTINGS,
    ...(partial ?? {}),
    search: { ...DEFAULT_SEARCH_SETTINGS, ...incomingSearch },
  };
}

/**
 * Accept the loose shapes a UI or an older stored record can produce.
 *
 * Two real cases:
 *  1. Records written before `search` existed keep the campaign knobs at the top
 *     level (`{ dailyLimit: 12 }`), because that is the shape the old cloud
 *     dashboard saved. Those must be lifted, not dropped.
 *  2. `blacklistedCompanies` arrives from a textarea as one comma-separated
 *     string. Storing that as a string is what made the server split it on every
 *     read; normalise once, here.
 */
export function normalizeAgentSettings(raw: unknown): AgentSettings {
  const input = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const nested = (input.search && typeof input.search === "object" ? input.search : {}) as Record<string, unknown>;

  const pick = (key: keyof SearchSettings): unknown =>
    nested[key] !== undefined ? nested[key] : input[key];

  const list = (v: unknown): string[] | undefined => {
    if (Array.isArray(v)) return v.map((x) => String(x).trim()).filter(Boolean);
    if (typeof v === "string") return v.split(",").map((s) => s.trim()).filter(Boolean);
    return undefined;
  };

  const num = (v: unknown): number | undefined => {
    const n = Number(v);
    return Number.isFinite(n) ? n : undefined;
  };

  const bool = (v: unknown): boolean | undefined => (typeof v === "boolean" ? v : undefined);

  const search: Partial<SearchSettings> = {};
  const source = pick("source");
  if (typeof source === "string" && source.trim()) search.source = source.trim().toLowerCase();
  const dailyLimit = num(pick("dailyLimit"));
  if (dailyLimit !== undefined) search.dailyLimit = Math.max(1, Math.min(200, Math.round(dailyLimit)));
  const minMatchScore = num(pick("minMatchScore"));
  if (minMatchScore !== undefined) search.minMatchScore = Math.max(0, Math.min(100, Math.round(minMatchScore)));
  for (const key of ["dryRun", "easyApplyOnly", "under10Applicants", "headless", "emailNotifications"] as const) {
    const v = bool(pick(key));
    if (v !== undefined) search[key] = v;
  }
  const datePosted = pick("datePosted");
  if (typeof datePosted === "string" && ["Past 24 hours", "Past week", "Past month", "Any time"].includes(datePosted)) {
    search.datePosted = datePosted as SearchSettings["datePosted"];
  }
  const blacklist = list(pick("blacklistedCompanies"));
  if (blacklist) search.blacklistedCompanies = blacklist;
  const titleKeywords = list(pick("titleKeywords"));
  if (titleKeywords) search.titleKeywords = titleKeywords;
  const titleBlacklist = list(pick("titleBlacklist"));
  if (titleBlacklist) search.titleBlacklist = titleBlacklist;
  const maxExp = num(pick("maxExperienceYears"));
  if (maxExp !== undefined) search.maxExperienceYears = Math.max(0, Math.min(50, Math.round(maxExp)));

  // Only real AgentSettings booleans survive from the top level, so a stray
  // `aiApiKey` from the old cloud shape cannot ride along into storage.
  const top: Partial<AgentSettings> = {};
  for (const key of Object.keys(DEFAULT_AGENT_SETTINGS) as (keyof AgentSettings)[]) {
    if (key === "search") continue;
    const v = input[key];
    if (v === undefined) continue;
    if (typeof DEFAULT_AGENT_SETTINGS[key] === "number") {
      const n = num(v);
      if (n !== undefined) (top as Record<string, unknown>)[key] = n;
    } else if (typeof DEFAULT_AGENT_SETTINGS[key] === "boolean") {
      const b = bool(v);
      if (b !== undefined) (top as Record<string, unknown>)[key] = b;
    }
  }

  return mergeAgentSettings({ ...top, search: search as SearchSettings });
}

/* ------------------------------------------------------------------ */
/* Search intent                                                       */
/* ------------------------------------------------------------------ */

/** What to actually search for, and where the answer came from. */
export interface SearchIntent {
  keywords: string;
  location: string;
  /** "profile" when derived from the user's own data, "default" when guessed. */
  keywordsFrom: "roles" | "skills" | "default";
  locationFrom: "preference" | "profile" | "default";
}

const asList = (v: unknown): string[] =>
  (Array.isArray(v) ? v : []).map((x) => String(x ?? "").trim()).filter(Boolean);

const asText = (v: unknown): string => String(v ?? "").trim();

/**
 * Derive the search keywords and location from a profile — once, for everybody.
 *
 * Three surfaces had their own version of this, and they disagreed:
 *
 *   - `server/src/routes/jobs.ts keywordsFrom()` read `p.preferences.roleTitles`
 *   - `server/src/pipeline-runner.ts` read `p.preferences?.roleTitles`
 *   - `server/src/routes/alerts.ts` did neither and hardcoded a query
 *
 * `preferences` is not a field on `ProfileSchema` — the real one is
 * `jobPreferences`. So both fallbacks were dead: the job feed and the apply engine
 * fell through to the literal "software engineer" for any user who had filled in
 * their roles through the extension's onboarding (which writes
 * `jobPreferences.roleTitles`) rather than the cloud form (which wrote a top-level
 * `targetRoles` the schema does not define). Same product, same profile, two
 * different searches.
 *
 * This reads `jobPreferences` first, accepts the legacy top-level names, and
 * reports which branch produced the answer so a UI can say "showing results for X
 * because your profile lists no target roles".
 */
export function deriveSearchIntent(profile: unknown): SearchIntent {
  const p = (profile && typeof profile === "object" ? profile : {}) as Record<string, unknown>;
  const prefs = (p.jobPreferences && typeof p.jobPreferences === "object"
    ? p.jobPreferences
    : {}) as Record<string, unknown>;
  // `preferences` is accepted only because two server files wrote it; it is not a
  // schema field and nothing new should produce it.
  const legacy = (p.preferences && typeof p.preferences === "object"
    ? p.preferences
    : {}) as Record<string, unknown>;

  const roles = [
    ...asList(prefs.roleTitles),
    ...asList(p.targetRoles),
    ...asList(legacy.roleTitles),
  ];
  const skills = asList(p.skills);

  let keywords: string;
  let keywordsFrom: SearchIntent["keywordsFrom"];
  if (roles.length) {
    keywords = roles.slice(0, 3).join(" ");
    keywordsFrom = "roles";
  } else if (skills.length) {
    keywords = skills.slice(0, 3).join(" ");
    keywordsFrom = "skills";
  } else {
    keywords = "software engineer";
    keywordsFrom = "default";
  }

  const prefLocations = [...asList(prefs.locations), ...asList(legacy.locations)];
  const remote = asText(prefs.remotePreference);
  let location: string;
  let locationFrom: SearchIntent["locationFrom"];
  if (prefLocations.length) {
    location = prefLocations[0];
    locationFrom = "preference";
  } else if (/remote/i.test(remote)) {
    location = "Remote";
    locationFrom = "preference";
  } else {
    // `preferredLocation` is not a schema field either, but the cloud profile form
    // wrote it for a long time, so an existing user's value must still count.
    const own =
      asText(p.preferredLocation) || asText(p.city) || asText(p.location) || asText(p.state);
    if (own) {
      location = own;
      locationFrom = "profile";
    } else {
      location = "Remote";
      locationFrom = "default";
    }
  }

  return { keywords, location, keywordsFrom, locationFrom };
}

/**
 * Company-name keywords the user refuses, from wherever they were entered.
 *
 * `jobPreferences.excludedCompanies` is what `assessJobRisk` and
 * `assessApplicationReadiness` gate on; `settings.search.blacklistedCompanies` is
 * what the campaign form writes. Both are real user intent and neither surface
 * showed the other's, so a company excluded in the extension still came back
 * through the cloud job feed. Callers get the union.
 */
export function mergedExclusions(profile: unknown, settings?: AgentSettings): string[] {
  const p = (profile && typeof profile === "object" ? profile : {}) as Record<string, unknown>;
  const prefs = (p.jobPreferences && typeof p.jobPreferences === "object"
    ? p.jobPreferences
    : {}) as Record<string, unknown>;
  const out = new Set<string>();
  for (const c of asList(prefs.excludedCompanies)) out.add(c);
  // Accepted because the old cloud profile form wrote a comma-separated string here.
  const legacy = p.blacklistedCompanies;
  if (typeof legacy === "string") {
    for (const c of legacy.split(",").map((s) => s.trim()).filter(Boolean)) out.add(c);
  } else {
    for (const c of asList(legacy)) out.add(c);
  }
  for (const c of settings?.search.blacklistedCompanies ?? []) out.add(c);
  return [...out];
}
