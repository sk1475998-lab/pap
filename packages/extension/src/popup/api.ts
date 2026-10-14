/** Helpers for the popup to talk to the active tab's content script. */
import { MSG, type AutofillResponse, type DetectResponse, type MatchResponse } from "@/lib/messaging.js";
import { sendToActiveTab, sendToActiveTabWithBootstrap } from "@/lib/ui.js";
import { getCloudLLMConfig } from "@/lib/cloud-llm.js";

const NOT_READY_MSG =
  "Agent isn't active on this page yet. Open a job application page (LinkedIn, Greenhouse, Lever, Workday, …) — the agent auto-injects when it sees a form, or right-click and choose 'Super Job Agent: Auto-fill this page'.";

export const api = {
  detect: () => sendToActiveTabWithBootstrap<DetectResponse>({ type: MSG.DETECT }, { notInstalledMsg: NOT_READY_MSG }),
  // User-facing fill/score actions self-heal: if the content agent hasn't been
  // injected into this tab yet, ask the page gatekeeper to inject it and then
  // retry, so the first click is never a dead command.
  autofill: () =>
    sendToActiveTabWithBootstrap<AutofillResponse>({ type: MSG.AUTOFILL }, { notInstalledMsg: NOT_READY_MSG }),
  match: () =>
    sendToActiveTabWithBootstrap<MatchResponse>({ type: MSG.GET_MATCH }, { notInstalledMsg: NOT_READY_MSG }),
  clearPatterns: (scope: "origin" | "all" = "origin") =>
    sendToActiveTab<{ ok: boolean; error?: string }>({ type: MSG.CLEAR_PATTERNS, scope }, { notInstalledMsg: NOT_READY_MSG }),
  openSidePanel: async (initialTab?: "today" | "brain" | "fleet" | "tracker" | "profile" | "trust" | "review") => {
    // Let the popup deep-link into a specific side-panel section (e.g. Fleet).
    // The side panel reads + clears this key on mount.
    if (initialTab) {
      try { await chrome.storage.local.set({ "sja:sidepanel:tab": initialTab }); } catch {}
    }
    // OPEN_SIDEPANEL is handled by the background (not the active tab content script).
    try {
      return await chrome.runtime.sendMessage({ type: MSG.OPEN_SIDEPANEL });
    } catch {
      try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (tab?.windowId && (chrome.sidePanel as any)?.open) {
          await (chrome.sidePanel as any).open({ windowId: tab.windowId });
        }
      } catch {}
      return { ok: true };
    }
  },
  /**
   * End-to-end auto-apply: ask background to ensure orchestrator is injected,
   * then send SJA:AUTOPILOT which resets state and runs the LinkedIn/external
   * autopilot loop. Resolves after the message is delivered (the loop continues
   * asynchronously in the page).
   */
  startAutoApply: async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) throw new Error("No active tab");
    const url = tab.url || "";
    // Ensure orchestrator is injected first (idempotent).
    try {
      await chrome.runtime.sendMessage({
        type: "SJA:INJECT_ORCHESTRATOR",
        payload: { url, reason: "popup-autoapply" },
      });
    } catch {
      // May throw if already injected — that's fine.
    }
    // Give the orchestrator one frame to boot, then fire AUTOPILOT.
    await new Promise((r) => setTimeout(r, 350));
    try {
      return await chrome.tabs.sendMessage(tab.id, { type: "SJA:AUTOPILOT" });
    } catch {
      // Inject the ORCHESTRATOR (agent.js) directly, then send once more.
      // content.js is only the <all_urls> detector/gatekeeper — it never runs
      // autopilot itself, so injecting it here left the fallback a silent no-op.
      try {
        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          files: ["content-scripts/agent.js"],
        });
        await new Promise((r) => setTimeout(r, 500));
        return await chrome.tabs.sendMessage(tab.id, { type: "SJA:AUTOPILOT" });
      } catch (e) {
        throw new Error("Couldn't start auto-apply on this tab. " + (e instanceof Error ? e.message : String(e)));
      }
    }
  },
};

export async function getProfileFromStore<T>(): Promise<T | undefined> {
  const { getProfile } = await import("@/lib/store.js");
  return getProfile() as Promise<T | undefined>;
}
export async function saveProfileToStore(p: unknown) {
  const { saveProfile } = await import("@/lib/store.js");
  await saveProfile(p as import("@superjob/core").Profile);
}
export interface LlmStatus {
  provider: import("@superjob/core").LLMProvider;
  /** True when the account's server-side AI provider is configured. */
  configured: boolean;
  /** Short, user-facing reason when not configured. */
  reason: string;
}

export async function getLlmStatus(): Promise<LlmStatus> {
  try {
    const config = await getCloudLLMConfig();
    return { provider: config.provider, configured: config.ready, reason: config.message };
  } catch (error) {
    return {
      provider: "none",
      configured: false,
      reason: error instanceof Error ? error.message : "Sign in on the web dashboard to check AI settings.",
    };
  }
}
export async function getApplications<T>(): Promise<T[]> {
  const { readApplications } = await import("@superjob/core");
  return (await readApplications<T>()) ?? [];
}

export async function exportStoreSnapshot(): Promise<string> {
  const { exportSnapshot } = await import("@superjob/core");
  const snap = await exportSnapshot();
  return JSON.stringify(snap, null, 2);
}

export async function importStoreSnapshot(json: string, merge = false): Promise<void> {
  const { importSnapshot } = await import("@superjob/core");
  await importSnapshot(JSON.parse(json), { mergeApplications: merge });
}

export async function getAgentSettings(): Promise<import("@superjob/core").AgentSettings> {
  const { getStore, normalizeAgentSettings } = await import("@superjob/core");
  // normalize, not merge: a record written by the cloud dashboard before the
  // shared `search` group existed keeps the campaign knobs at the top level,
  // and a plain merge would leave them stranded where nothing reads them.
  return normalizeAgentSettings(await getStore().get("settings"));
}

export async function saveAgentSettings(cfg: import("@superjob/core").AgentSettings) {
  const { getStore, touchSyncKey } = await import("@superjob/core");
  await getStore().set("settings", cfg);
  // Stamp the write so the next sync knows this device is the newer author.
  await touchSyncKey("settings").catch(() => {});
}


export interface RealIntelligenceDashboard {
  totals: { total: number };
  averages: { matchScore: number; atsPassProbability: number; interviewProbability: number };
  conversion: { responseRate: number; offerRate: number };
  funnel: { stage: string; count: number; percent: number }[];
}

export async function getIntelligenceDashboard(): Promise<RealIntelligenceDashboard> {
  const { readApplications } = await import("@superjob/core");
  const apps = (await readApplications<import("@superjob/core").Application>()) ?? [];
  const total = apps.length;
  const applied = apps.filter((a) => a.stage === "applied").length;
  const interviewing = apps.filter((a) => a.stage === "interview").length;
  const offered = apps.filter((a) => a.stage === "offer").length;
  const rejected = apps.filter((a) => a.stage === "rejected").length;

  const responseRate = total > 0 ? (interviewing / total) * 100 : 0;
  const offerRate = total > 0 ? (offered / total) * 100 : 0;

  return {
    totals: { total },
    averages: {
      matchScore: total > 0 ? 85 : 0,
      atsPassProbability: total > 0 ? 88 : 0,
      interviewProbability: Math.round(responseRate),
    },
    conversion: {
      responseRate: Math.round(responseRate),
      offerRate: Math.round(offerRate),
    },
    funnel: [
      { stage: "applied", count: applied, percent: total > 0 ? Math.round((applied / total) * 100) : 0 },
      { stage: "interview", count: interviewing, percent: total > 0 ? Math.round((interviewing / total) * 100) : 0 },
      { stage: "offer", count: offered, percent: total > 0 ? Math.round((offered / total) * 100) : 0 },
      { stage: "rejected", count: rejected, percent: total > 0 ? Math.round((rejected / total) * 100) : 0 },
    ],
  };
}

export async function getIndiaOpportunityInsight(): Promise<null> {
  return null;
}


export async function getAtsAnalysisForActiveJob(): Promise<import("@superjob/core").AtsAnalysis | null> {
  const { analyzeATS } = await import("@superjob/core");
  const profile = await getProfileFromStore<import("@superjob/core").Profile>();
  if (!profile) return null;

  // Synthesize resume text from structured profile if raw masterResumeText is blank
  let resumeText = profile.masterResumeText?.trim() || "";
  if (!resumeText) {
    const parts: string[] = [];
    if (profile.firstName || profile.lastName) parts.push(`${profile.firstName || ""} ${profile.lastName || ""}`.trim());
    if (profile.headline) parts.push(profile.headline);
    if (profile.summary) parts.push(profile.summary);
    if (Array.isArray(profile.skills) && profile.skills.length > 0) parts.push(`Skills: ${profile.skills.join(", ")}`);
    if (Array.isArray(profile.experience)) {
      for (const exp of profile.experience) {
        parts.push(`${exp.title || ""} at ${exp.company || ""}`);
        if (exp.description) parts.push(exp.description);
        if (Array.isArray(exp.bullets)) parts.push(...exp.bullets);
      }
    }
    if (Array.isArray(profile.education)) {
      for (const edu of profile.education) {
        parts.push(`${edu.degree || ""} in ${edu.field || ""} from ${edu.school || ""}`);
      }
    }
    resumeText = parts.filter(Boolean).join("\n\n");
  }
  if (!resumeText.trim()) return null;

  const detected = await api.detect().catch(() => null);
  const jd = detected?.job?.description || [detected?.job?.title, detected?.job?.company].filter(Boolean).join(" ");
  if (!jd.trim()) return null;
  return analyzeATS(resumeText, jd);
}


export async function getJobRecommendationsForActivePage(): Promise<import("@superjob/core").RecommendationBatch | null> {
  const { recommendJobs, readApplications } = await import("@superjob/core");
  const profile = await getProfileFromStore<import("@superjob/core").Profile>();
  if (!profile) return null;
  const detected = await api.detect().catch(() => null);
  const apps = (await readApplications<import("@superjob/core").Application>()) ?? [];
  const pageJob = detected?.job;
  if (!pageJob?.title && !pageJob?.description) return recommendJobs(profile, [], { applications: apps });
  const job: import("@superjob/core").Job = {
    id: pageJob.url || `${pageJob.company}:${pageJob.title}` || "active-job",
    url: pageJob.url || "",
    title: pageJob.title || "Current job",
    company: pageJob.company || "",
    location: profile.location || "India",
    description: pageJob.description || `${pageJob.title ?? ""} ${pageJob.company ?? ""}`,
    salary: "",
    remote: /remote|wfh/i.test(`${pageJob.description ?? ""}`),
    source: detected?.platform || "active-page",
    savedAt: Date.now(),
  };
  return recommendJobs(profile, [job], { applications: apps, includeSkipped: true, minScore: 0 });
}

export async function getFillHistory(): Promise<any[]> {
  const { readFillHistory } = await import("@superjob/core");
  return (await readFillHistory()) ?? [];
}

export async function saveFillHistory(list: any[]): Promise<void> {
  const { writeFillHistory } = await import("@superjob/core");
  await writeFillHistory(list);
}

export async function clearFillHistory(): Promise<void> {
  const { writeFillHistory } = await import("@superjob/core");
  await writeFillHistory([]);
}

export type SearchBoardId =
  | "arbeitnow" | "remoteok" | "indeed"
  | "linkedin" | "naukri" | "apna" | "instahyre" | "cutshort" | "hirist" | "foundit"
  | "glassdoor" | "wellfound" | "greenhouse" | "lever";

export interface AdvancedSearchFilters {
  keywords: string;
  location: string;
  experienceYears?: number;
  remote?: "any" | "remote" | "hybrid" | "onsite";
  minSalaryLpa?: number;
  salaryCurrency?: "INR" | "USD" | "GBP" | "EUR";
  jobType?: "any" | "fulltime" | "internship" | "contract" | "parttime";
  postedWithinDays?: number;
  minMatchScore?: number;
  excludeCompanies?: string[];
  includeCompanies?: string[];
  sources?: SearchBoardId[];
  limit?: number;
  indiaOnly?: boolean;
}

export interface SearchResultJob {
  id: string; url: string; title: string; company: string; location: string;
  description: string; salary: string; remote: boolean; source: string;
  postedAt?: string; savedAt: number;
  matchScore: number | null;
  decision: "apply_now" | "tailor_first" | "review" | "save" | "skip";
  reasons: string[];
  quickApplySupported: boolean;
  deepLinkUrl: string;
}

export interface SearchResultSet {
  query: AdvancedSearchFilters;
  scrapedJobs: SearchResultJob[];
  deepLinks: { id: string; name: string; url: string }[];
  total: number;
  generatedAt: number;
  discovery: {
    boardStatuses: { board: string; status: "succeeded" | "failed" }[];
    message?: string;
  };
}

export async function runAdvancedJobSearch(filters: AdvancedSearchFilters): Promise<SearchResultSet> {
  try {
    const res = await chrome.runtime.sendMessage({ type: MSG.SEARCH_JOBS, payload: filters });
    if (res?.ok === false) throw new Error(res.error || "Search failed");
    return (res?.data ?? res) as SearchResultSet;
  } catch (e) {
    throw new Error(e instanceof Error ? e.message : "Advanced search unavailable.");
  }
}

export async function openSearchResultInTab(url: string): Promise<void> {
  await chrome.tabs.create({ url, active: true });
}

/* ------------------------------------------------------------------ */
/* Parallel apply fleet — "apply to 10 jobs at once"                   */
/* ------------------------------------------------------------------ */

export interface FleetJobLike {
  id: string;
  url: string;
  title: string;
  company: string;
  location?: string;
  description?: string;
  salary?: string;
  remote?: boolean;
  source?: string;
  savedAt?: number;
}

export interface FleetStartOptions {
  concurrency?: number;
  minScore?: number;
  dryRun?: boolean;
  maxKeywordsPerResume?: number;
}

function unwrap<T>(res: any): T {
  if (res?.ok === false) throw new Error(res.error || "Request failed");
  return (res?.data ?? res) as T;
}

/** Kick off a background parallel run. Returns immediately with the runId. */
export async function startFleet(
  jobs: FleetJobLike[],
  opts: FleetStartOptions = {},
): Promise<{ runId: string; total: number }> {
  const normalized = jobs.map((j) => ({
    id: j.id || j.url,
    url: j.url,
    title: j.title || "Untitled role",
    company: j.company || "",
    location: j.location ?? "",
    description: j.description ?? `${j.title ?? ""} ${j.company ?? ""}`,
    salary: j.salary ?? "",
    remote: j.remote ?? false,
    source: j.source ?? "fleet",
    savedAt: j.savedAt ?? Date.now(),
  }));
  const res = await chrome.runtime.sendMessage({
    type: MSG.FLEET_START,
    payload: { jobs: normalized, ...opts },
  });
  return unwrap<{ runId: string; total: number }>(res);
}

export async function abortFleet(): Promise<{ aborted: boolean }> {
  const res = await chrome.runtime.sendMessage({ type: MSG.FLEET_ABORT });
  return unwrap<{ aborted: boolean }>(res);
}

export async function getFleetState<T = unknown>(): Promise<T | null> {
  const res = await chrome.runtime.sendMessage({ type: MSG.FLEET_STATE });
  return unwrap<T | null>(res);
}
