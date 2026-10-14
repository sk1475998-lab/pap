/**
 * Campaign Agent — autonomous background job discovery and apply scheduler.
 *
 * Enhanced with:
 * - Smart scheduling: respects business hours (9am-6pm local time)
 * - Rate limiting: exponential backoff on failures
 * - Daily/weekly limits with rollover tracking
 * - Priority-based campaign ordering (higher minScore = higher priority)
 * - Cooldown between runs to prevent API throttling
 */
import { isChromeRuntimeValid } from "./runtime-guard.js";
import { diagLog } from "./diagnostics.js";

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

export interface CampaignConfig {
  id: string;
  /** Job title / keyword query (e.g. "Senior React Developer") */
  titleQuery: string;
  /** Location filter (e.g. "Remote", "Bangalore", "New York") */
  location: string;
  /** Minimum match score to auto-apply (0-100) */
  minScore: number;
  /** Maximum applications per day for this campaign */
  maxApplicationsPerDay: number;
  /** Whether this campaign is active */
  isActive: boolean;
  /** Last time this campaign was executed (epoch ms) */
  lastRunTime?: number;
  /** Number of applications submitted today */
  todayCount?: number;
  /** Date string (YYYY-MM-DD) of the todayCount */
  todayDate?: string;
  /** Created timestamp */
  createdAt: number;
}

export interface CampaignRunResult {
  campaignId: string;
  discovered: number;
  matched: number;
  applied: number;
  skipped: number;
  errors: string[];
}

const STORAGE_KEY = "sja_campaigns";
const RESULTS_KEY = "sja_campaign_results";
const GLOBAL_STATE_KEY = "sja_campaign_global";

/** Global campaign state for cross-campaign coordination */
interface CampaignGlobalState {
  lastRunTimestamp: number;
  consecutiveFailures: number;
  totalAppliedToday: number;
  totalAppliedDate: string;
  /** Cooldown until timestamp (exponential backoff after failures) */
  cooldownUntil: number;
}

const DEFAULT_GLOBAL_STATE: CampaignGlobalState = {
  lastRunTimestamp: 0,
  consecutiveFailures: 0,
  totalAppliedToday: 0,
  totalAppliedDate: "",
  cooldownUntil: 0,
};

/** Minimum interval between campaign runs (5 minutes when run manually, 30 via alarm). */
const MIN_RUN_INTERVAL_MS = 5 * 60 * 1000;
/** Global daily application cap (safety net) */
const GLOBAL_DAILY_CAP = 100;
/**
 * Business hours guard removed: users run campaigns on their own schedule and
 * LinkedIn/ATS portals work 24/7. Previously 9am-6pm caused mysterious "nothing
 * happening" reports for night owls and IST users.
 */
const BUSINESS_HOURS_START = 0;
const BUSINESS_HOURS_END = 24;

/* ------------------------------------------------------------------ */
/* Storage helpers                                                     */
/* ------------------------------------------------------------------ */

export async function getCampaigns(): Promise<CampaignConfig[]> {
  if (!isChromeRuntimeValid()) return [];
  try {
    const res = await chrome.storage.local.get(STORAGE_KEY);
    return Array.isArray(res[STORAGE_KEY]) ? res[STORAGE_KEY] : [];
  } catch {
    return [];
  }
}

export async function saveCampaigns(campaigns: CampaignConfig[]): Promise<void> {
  if (!isChromeRuntimeValid()) return;
  await chrome.storage.local.set({ [STORAGE_KEY]: campaigns });
}

export async function saveCampaign(campaign: CampaignConfig): Promise<void> {
  const list = await getCampaigns();
  const idx = list.findIndex((c) => c.id === campaign.id);
  if (idx >= 0) list[idx] = campaign;
  else list.push(campaign);
  await saveCampaigns(list);
}

export async function deleteCampaign(id: string): Promise<void> {
  const list = await getCampaigns();
  await saveCampaigns(list.filter((c) => c.id !== id));
}

export async function toggleCampaign(id: string, isActive: boolean): Promise<void> {
  const list = await getCampaigns();
  const campaign = list.find((c) => c.id === id);
  if (campaign) {
    campaign.isActive = isActive;
    await saveCampaigns(list);
  }
}

export async function getCampaignResults(): Promise<CampaignRunResult[]> {
  if (!isChromeRuntimeValid()) return [];
  try {
    const res = await chrome.storage.local.get(RESULTS_KEY);
    return Array.isArray(res[RESULTS_KEY]) ? res[RESULTS_KEY] : [];
  } catch {
    return [];
  }
}

async function saveResult(result: CampaignRunResult): Promise<void> {
  if (!isChromeRuntimeValid()) return;
  const results = await getCampaignResults();
  results.unshift(result);
  // Keep last 50 results
  await chrome.storage.local.set({ [RESULTS_KEY]: results.slice(0, 50) });
}

/* ------------------------------------------------------------------ */
/* Campaign runner                                                     */
/* ------------------------------------------------------------------ */

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

async function getGlobalState(): Promise<CampaignGlobalState> {
  try {
    const res = await chrome.storage.local.get(GLOBAL_STATE_KEY) as Record<string, unknown>;
    return (res[GLOBAL_STATE_KEY] as CampaignGlobalState | undefined) ?? { ...DEFAULT_GLOBAL_STATE };
  } catch {
    return { ...DEFAULT_GLOBAL_STATE };
  }
}

async function saveGlobalState(state: CampaignGlobalState): Promise<void> {
  await chrome.storage.local.set({ [GLOBAL_STATE_KEY]: state });
}

/**
 * Run all active campaigns. Called from the background service worker
 * on an alarm trigger (every 30 minutes by default).
 * 
 * Enhanced with:
 * - Business hours awareness
 * - Exponential backoff on failures
 * - Global daily cap
 * - Priority-based ordering
 * - Rate limiting between runs
 */
export async function runAutonomousCampaigns(): Promise<void> {
  if (!isChromeRuntimeValid()) return;

  const now = Date.now();
  const globalState = await getGlobalState();
  
  // Reset daily counter if new day
  const today = todayStr();
  if (globalState.totalAppliedDate !== today) {
    globalState.totalAppliedToday = 0;
    globalState.totalAppliedDate = today;
  }
  
  // Check global daily cap
  if (globalState.totalAppliedToday >= GLOBAL_DAILY_CAP) {
    void diagLog("background", "campaign-global-daily-cap", {
      message: `Global daily cap reached (${GLOBAL_DAILY_CAP})`,
    });
    return;
  }
  
  // Check cooldown (exponential backoff after failures)
  if (now < globalState.cooldownUntil) {
    const remainingMin = Math.ceil((globalState.cooldownUntil - now) / 60000);
    void diagLog("background", "campaign-cooldown", {
      message: `Campaign cooldown active, ${remainingMin}min remaining`,
    });
    return;
  }
  
  // Check minimum interval between runs
  if (now - globalState.lastRunTimestamp < MIN_RUN_INTERVAL_MS) {
    return;
  }

  const campaigns = await getCampaigns();
  // Sort by priority: higher minScore = more selective = higher priority
  const active = campaigns
    .filter((c) => c.isActive)
    .sort((a, b) => b.minScore - a.minScore);
  if (!active.length) return;

  void diagLog("background", "campaign-run-start", {
    message: `Running ${active.length} active campaign(s)`,
  });

  // Load profile
  let profile: any;
  try {
    const { readProfile } = await import("@superjob/core");
    profile = await readProfile();
  } catch {
    void diagLog("background", "campaign-no-profile", {
      level: "warn",
      message: "No profile available for campaigns",
    });
    return;
  }

  if (!profile?.masterResumeText?.trim()) {
    void diagLog("background", "campaign-no-resume", {
      level: "warn",
      message: "No resume text — campaigns need a resume to score matches",
    });
    return;
  }

  const { scoreMatch, readApplications, writeApplications, canonicalJobKey } = await import("@superjob/core");

  let runHadErrors = false;

  for (const camp of active) {
    const result: CampaignRunResult = {
      campaignId: camp.id,
      discovered: 0,
      matched: 0,
      applied: 0,
      skipped: 0,
      errors: [],
    };

    try {
      // Reset daily counter if new day
      const today = todayStr();
      if (camp.todayDate !== today) {
        camp.todayCount = 0;
        camp.todayDate = today;
      }

      // Check daily limit
      if ((camp.todayCount ?? 0) >= camp.maxApplicationsPerDay) {
        void diagLog("background", "campaign-daily-limit", {
          message: `Campaign "${camp.titleQuery}" hit daily limit (${camp.maxApplicationsPerDay})`,
        });
        continue;
      }

      const remaining = camp.maxApplicationsPerDay - (camp.todayCount ?? 0);

      // Discover jobs using scraper aggregator
      let jobs: any[] = [];
      try {
        const { createDefaultAggregator } = await import("@superjob/scraper");
        const agg = createDefaultAggregator();
        jobs = await agg.discover(camp.titleQuery, camp.location, Math.min(remaining * 3, 30));
      } catch (e) {
        result.errors.push(`Scraper error: ${e instanceof Error ? e.message : String(e)}`);
        void diagLog("background", "campaign-scraper-error", {
          level: "warn",
          message: `Scraper failed for "${camp.titleQuery}": ${e instanceof Error ? e.message : String(e)}`,
        });
      }

      result.discovered = jobs.length;

      // Load existing applications for dedup
      const existingApps = (await readApplications<any>()) ?? [];
      const existingKeys = new Set(existingApps.map((a: any) => a.jobId || a.url));

      for (const job of jobs) {
        if ((camp.todayCount ?? 0) >= camp.maxApplicationsPerDay) break;

        // Dedup
        const key = canonicalJobKey(job.url, job.title ?? "", job.company ?? "");
        if (existingKeys.has(key) || existingKeys.has(job.url)) {
          result.skipped++;
          continue;
        }

        // Score
        const match = scoreMatch({
          resumeText: profile.masterResumeText,
          jobDescription: job.description ?? "",
          profileSkills: profile.skills ?? [],
        });

        if (match.score < camp.minScore) {
          result.skipped++;
          continue;
        }

        result.matched++;

        // Try to trigger headless apply via Docker API first; if it's offline,
        // fall back to opening the job URL in a new tab so the content-script
        // autopilot can take over (user sees the job and can review if verify
        // is enabled).
        let applied = false;
        let openedTab = false;
        try {
          const res = await fetch("http://localhost:3000/api/run", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ job, profile, dryRun: false }),
          });
          applied = res.ok;
          if (!applied) {
            const errorText = await res.text().catch(() => "");
            void diagLog("background", "campaign-docker-error", {
              level: "warn",
              message: `Docker API returned ${res.status}: ${errorText}`,
            });
          }
        } catch (e) {
          void diagLog("background", "campaign-docker-offline", {
            message: `Docker API unreachable — opening job in a new tab for in-browser autopilot: ${e instanceof Error ? e.message : String(e)}`,
          });
        }

        // Fallback: open the job URL in a new tab so the user's extension can
        // drive the apply flow inside the tab.
        if (!applied && job.url && /^https?:/.test(job.url)) {
          try {
            await chrome.tabs.create({ url: job.url, active: false });
            openedTab = true;
          } catch (e) {
            void diagLog("background", "campaign-tab-open-failed", {
              level: "warn",
              message: `Failed to open tab: ${e instanceof Error ? e.message : String(e)}`,
            });
          }
        }

        // Record application
        const appRecord = {
          id: `camp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
          jobId: key,
          url: job.url,
          title: job.title ?? "",
          company: job.company ?? "",
          stage: applied ? "applied" : openedTab ? "opened" : "saved",
          notes: `Auto-discovered by campaign: "${camp.titleQuery}"${applied ? "" : openedTab ? " (opened in new tab for in-browser autopilot)" : " (Docker offline, saved for review)"}`,
          appliedAt: applied ? Date.now() : undefined,
          updatedAt: Date.now(),
          matchScore: match.score,
        };

        existingApps.unshift(appRecord);
        existingKeys.add(key);

        if (applied) {
          result.applied++;
          camp.todayCount = (camp.todayCount ?? 0) + 1;
          globalState.totalAppliedToday++;
        } else if (openedTab) {
          result.skipped++;
        } else {
          result.skipped++;
        }
      }

      // Persist updated applications
      await writeApplications(existingApps);

      // Update campaign state
      camp.lastRunTime = Date.now();
      await saveCampaign(camp);

      void diagLog("background", "campaign-run-complete", {
        message: `Campaign "${camp.titleQuery}": discovered=${result.discovered}, matched=${result.matched}, applied=${result.applied}`,
      });
    } catch (e) {
      result.errors.push(e instanceof Error ? e.message : String(e));
      void diagLog("background", "campaign-error", {
        level: "error",
        message: `Campaign "${camp.titleQuery}" failed: ${e instanceof Error ? e.message : String(e)}`,
      });
    }

    await saveResult(result);
    
    if (result.errors.length > 0) {
      runHadErrors = true;
    }
  }
  
  // Update global state
  globalState.lastRunTimestamp = Date.now();
  if (runHadErrors) {
    globalState.consecutiveFailures++;
    // Exponential backoff: 15min, 30min, 1h, 2h, max 4h
    const backoffMs = Math.min(
      MIN_RUN_INTERVAL_MS * Math.pow(2, globalState.consecutiveFailures - 1),
      4 * 60 * 60 * 1000
    );
    globalState.cooldownUntil = Date.now() + backoffMs;
  } else {
    globalState.consecutiveFailures = 0;
    globalState.cooldownUntil = 0;
  }
  await saveGlobalState(globalState);
}

/**
 * Bypass interval/cooldown guards and run campaigns immediately (e.g. when the
 * user clicks "Run now" in the popup). Resets cooldown state first.
 */
export async function forceRunCampaigns(): Promise<void> {
  try {
    const g = await getGlobalState();
    g.cooldownUntil = 0;
    g.lastRunTimestamp = 0;
    await saveGlobalState(g);
  } catch {}
  await runAutonomousCampaigns();
}
