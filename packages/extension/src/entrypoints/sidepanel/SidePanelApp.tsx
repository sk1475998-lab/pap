import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { getApplications, getProfile } from "@/lib/store.js";
import { createProfile } from "@superjob/core";
import type { Application, Profile } from "@superjob/core";
import { mountToastHost, sendToActiveTabWithBootstrap, showToast } from "@/lib/ui.js";
import { MSG } from "@/lib/messaging.js";
import { IconBolt, IconTarget, IconUser, IconShield, IconCalendar, IconBriefcase, IconRocket, IconBrandLogo } from "@/lib/icons.jsx";
import { FleetPanel } from "./FleetPanel.js";
import { ReviewQueuePanel } from "./ReviewQueuePanel.js";
import { BrainPanel } from "./BrainPanel.js";
import { getLlmStatus, type LlmStatus } from "@/popup/api.js";

type Tab = "today" | "brain" | "fleet" | "tracker" | "profile" | "trust" | "review";


/** Enterprise stage → accent mapping for pipeline chips (kept intentionally
 *  semantic so the raw stage string still appears in the DOM verbatim). */
function stageAccent(stage: string): string {
  if (/interview|offer/i.test(stage)) return "text-violet-300 bg-violet-400/10 ring-violet-400/20";
  if (/applied|submitted|complete/i.test(stage)) return "text-emerald-300 bg-emerald-400/10 ring-emerald-400/20";
  if (/rejected|closed|error/i.test(stage)) return "text-rose-300 bg-rose-400/10 ring-rose-400/20";
  if (/saved|draft|open/i.test(stage)) return "text-amber-300 bg-amber-400/10 ring-amber-400/20";
  return "text-sky-300 bg-sky-400/10 ring-sky-400/20";
}

export function SidePanelApp() {
  const [tab, setTab] = useState<Tab>("today");
  const [profile, setProfile] = useState<Profile | undefined>();
  const [apps, setApps] = useState<Application[]>([]);
  const [activeUrl, setActiveUrl] = useState<string>("");
  const [busy, setBusy] = useState<"autofill" | "match" | "autoapply" | null>(null);
  const [llmStatus, setLlmStatus] = useState<LlmStatus | null>(null);
  const [reviewPendingCount, setReviewPendingCount] = useState(0);

  const loadSnapshot = useCallback(async () => {
    try {
      const [p, a] = await Promise.all([getProfile(), getApplications()]);
      // Defensive merge in case storage has a pre-array-fields profile shape.
      setProfile(p ? createProfile(p) : undefined);
      setApps(Array.isArray(a) ? a : []);
    } catch {
      /* transient storage error — keep the previous snapshot */
    }
    try { setLlmStatus(await getLlmStatus()); } catch { /* keep prior */ }
  }, []);

  const refreshActiveTab = useCallback(() => {
    if (typeof chrome !== "undefined" && chrome.tabs?.query) {
      chrome.tabs
        .query({ active: true, currentWindow: true })
        .then((tabs) => {
          const tab = Array.isArray(tabs) ? tabs[0] : null;
          setActiveUrl(tab?.url ?? "");
        })
        .catch(() => {});
    }
  }, []);

  useEffect(() => {
    mountToastHost();
    void loadSnapshot();
    refreshActiveTab();

    let badgeInterval: ReturnType<typeof setInterval> | null = null;
    if (typeof chrome !== "undefined" && chrome.storage?.local) {
      chrome.storage.local.get("sja:sidepanel:tab").then((r) => {
        const want = r?.["sja:sidepanel:tab"] as Tab | undefined;
        if (want && ["today", "brain", "fleet", "tracker", "profile", "trust", "review"].includes(want)) {
          setTab(want);
          void chrome.storage.local.remove("sja:sidepanel:tab");
        }
      }).catch(() => {});

      // Poll review queue pending count for badge
      const countPending = () => {
        chrome.storage.local.get("sja_review_queue").then((r) => {
          const arr: any[] = (r?.["sja_review_queue"] as any[]) ?? [];
          const now = Date.now();
          setReviewPendingCount(arr.filter((p) => p.ttl > now && p.decision === "pending").length);
        }).catch(() => {});
      };
      countPending();
      badgeInterval = setInterval(countPending, 30_000);
    }

    // Live sink: while the content agent fills pages it writes application,
    // profile, and fill-history records to chrome.storage.local. Listen for
    // those writes so an already-open side panel stays in sync instead of
    // showing a stale snapshot until the user closes/reopens it. Reloads are
    // trailing-debounced because one fill run can write several keys at once.
    let reloadTimer: ReturnType<typeof setTimeout> | null = null;
    const onStorageChanged = (
      _changes: Record<string, chrome.storage.StorageChange>,
      areaName: string,
    ) => {
      if (areaName !== "local") return;
      if (reloadTimer) clearTimeout(reloadTimer);
      reloadTimer = setTimeout(() => {
        reloadTimer = null;
        void loadSnapshot();
        refreshActiveTab();
      }, 150);
    };
    if (typeof chrome !== "undefined" && chrome.storage?.onChanged) {
      chrome.storage.onChanged.addListener(onStorageChanged);
    }
    const onFocus = () => refreshActiveTab();
    window.addEventListener("focus", onFocus);
    return () => {
      if (badgeInterval) clearInterval(badgeInterval);
      if (reloadTimer) clearTimeout(reloadTimer);
      if (typeof chrome !== "undefined" && chrome.storage?.onChanged) {
        chrome.storage.onChanged.removeListener(onStorageChanged);
      }
      window.removeEventListener("focus", onFocus);
    };
  }, [loadSnapshot, refreshActiveTab]);

  const stats = useMemo(() => {
    const now = Date.now();
    const day = 24 * 60 * 60 * 1000;
    // Canonical field is `stage` (ApplicationSchema); keep status/phase as a
    // defensive fallback for any legacy records. "Applied" = an application
    // actually went out, i.e. any stage past "saved".
    const stageOf = (a: any): string => String(a.stage ?? a.status ?? a.phase ?? "saved").toLowerCase();
    return {
      total: apps.length,
      today: apps.filter((a: any) => now - (a.appliedAt ?? a.updatedAt ?? a.createdAt ?? 0) < day).length,
      applied: apps.filter((a) => stageOf(a) !== "saved").length,
      interviews: apps.filter((a) => /interview|offer/.test(stageOf(a))).length,
    };
  }, [apps]);

  // Activation checklist reflects the user's real state, not a static list.
  const checklistSteps = useMemo(() => {
    const stageOf = (a: any): string => String(a.stage ?? a.status ?? a.phase ?? "saved").toLowerCase();
    return [
      { label: "Complete profile", done: !!(profile?.firstName && profile?.email) },
      { label: "Resume synced from dashboard", done: !!profile?.masterResumeText?.trim() },
      { label: "Open a job page", done: !!activeUrl },
      { label: "Autofill a job", done: apps.length > 0 },
      { label: "Track an outcome", done: apps.some((a) => stageOf(a) !== "saved") },
    ];
  }, [profile, apps, activeUrl]);

  const runAction = async (kind: "autofill" | "match" | "autoapply") => {
    setBusy(kind);
    try {
      if (kind === "autoapply") {
        // Turn on autonomous mode and fire SJA:AUTOPILOT (same path as popup's
        // Auto-apply button) so the content-script engine drives the whole loop.
        const { getAgentSettings, saveAgentSettings } = await import("@/popup/api.js");
        const cur = await getAgentSettings();
        await saveAgentSettings({
          ...cur,
          autonomousMode: true,
          autoClickEasyApply: true,
          autoFillSteps: true,
          autoAdvanceSteps: true,
        });
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (tab?.id) {
          try {
            await chrome.runtime.sendMessage({
              type: "SJA:INJECT_ORCHESTRATOR",
              payload: { url: tab.url || "", reason: "sidepanel-autoapply" },
            });
          } catch {}
          await new Promise((r) => setTimeout(r, 400));
          try {
            await chrome.tabs.sendMessage(tab.id, { type: "SJA:AUTOPILOT" });
          } catch {
            // Inject the ORCHESTRATOR (agent.js) — content.js is only the
            // <all_urls> gatekeeper and never runs autopilot, so injecting it
            // here left the fallback a silent no-op.
            await chrome.scripting.executeScript({
              target: { tabId: tab.id },
              files: ["content-scripts/agent.js"],
            }).catch(() => {});
            await new Promise((r) => setTimeout(r, 500));
            await chrome.tabs.sendMessage(tab.id, { type: "SJA:AUTOPILOT" }).catch(() => {});
          }
        }
        showToast("🤖 Auto-apply started — the agent will click Easy Apply, fill, advance, and (if enabled) submit.", "success", 3500);
        return;
      }
      const type = kind === "autofill" ? MSG.AUTOFILL : MSG.GET_MATCH;
      const res = await sendToActiveTabWithBootstrap<{ filled?: number; skipped?: number; score?: number; error?: string }>(
        { type },
        {
          notInstalledMsg:
            "No job page detected. Open a LinkedIn / Greenhouse / Lever / Workday job, or right-click the page and choose 'Super Job Agent: Auto-fill this page'.",
        },
      );
      if (kind === "autofill") {
        showToast(
          res?.filled != null
            ? `Autofilled ${res.filled} field${res.filled === 1 ? "" : "s"}${res.skipped ? `, skipped ${res.skipped}` : ""}`
            : "Autofill started.",
          "success",
        );
      } else {
        showToast(
          res?.score != null ? `Match score: ${res.score}%` : "Match computed.",
          res?.score != null && res.score >= 70 ? "success" : "info",
        );
      }
    } catch (err) {
      showToast(err instanceof Error ? err.message : String(err), "error", 4200);
    } finally {
      setBusy(null);
    }
  };

  const brandInitials = useMemo(() => {
    const name = `${profile?.firstName ?? ""} ${profile?.lastName ?? ""}`.trim();
    return name
      ? name.split(/\s+/).slice(0, 2).map((s) => s[0]?.toUpperCase()).join("")
      : "SJ";
  }, [profile]);

  const navItems: Array<{ id: Tab; label: string; icon: ReactNode; hint: string; badge?: number }> = [
    { id: "today", label: "Today", icon: <IconCalendar size={14} />, hint: "Active page, actions & pipeline summary" },
    { id: "brain", label: "Brain AI", icon: <span className="text-xs">🧠</span>, hint: "Autonomous decision stream, MCTS & Grounded Green Diff" },
    { id: "fleet", label: "Fleet", icon: <IconRocket size={14} />, hint: "Apply to 10 jobs in parallel, resume tailored per job" },
    { id: "tracker", label: "Tracker", icon: <IconBriefcase size={14} />, hint: "Saved and tracked applications" },
    { id: "review", label: "Review", icon: (
        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
        </svg>
      ), hint: "Human review queue — approve or reject AI-prepared applications", badge: reviewPendingCount },
    { id: "profile", label: "Profile", icon: <IconUser size={14} />, hint: "Your source profile for filling" },
    { id: "trust", label: "Trust", icon: <IconShield size={14} />, hint: "Privacy and safety guarantees" },
  ];

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 antialiased">
      {/* Ambient top glow for depth on the dark canvas */}
      <div aria-hidden className="pointer-events-none fixed inset-x-0 top-0 z-0 h-44 bg-[radial-gradient(70%_100%_at_50%_0%,rgba(99,102,241,0.16),rgba(139,92,246,0.06)_55%,transparent)]" />

      <header className="sticky top-0 z-20 border-b border-white/[0.06] bg-slate-950/85 px-4 pb-3 pt-4 backdrop-blur-xl">
        <div className="relative flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="grid h-8 w-8 flex-shrink-0 place-items-center rounded-[10px] bg-gradient-to-br from-indigo-500 via-indigo-500 to-violet-600 text-white shadow-lg shadow-indigo-950/50 ring-1 ring-white/10 transition-transform hover:scale-105">
              <IconBrandLogo size={22} />
            </span>
            <div className="min-w-0">
              <h1 className="truncate text-[15px] font-semibold leading-tight tracking-tight text-white">Super Job Agent</h1>
              <p className="truncate text-[11px] leading-tight text-slate-400">Private AI job application workspace</p>
            </div>
          </div>
          <span className="inline-flex flex-shrink-0 items-center gap-1.5 rounded-full border border-emerald-400/20 bg-emerald-400/10 px-2 py-1 text-[10px] font-medium text-emerald-300">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.9)]" aria-hidden />
            Local-first
          </span>
        </div>

        {/* Segmented workspace navigation (7 tabs across all domains) */}
        <nav className="relative mt-3.5 grid grid-cols-7 gap-1 rounded-xl bg-white/[0.04] p-1 ring-1 ring-white/[0.06]" aria-label="Side panel sections">
          {navItems.map(({ id, label, icon, hint, badge }) => {
            const active = tab === id;
            return (
              <button
                key={id}
                type="button"
                title={hint}
                aria-label={`${label} — ${hint}`}
                aria-current={active ? "page" : undefined}
                onClick={() => setTab(id)}
                className={`relative flex flex-col items-center gap-0.5 rounded-lg px-1 py-1.5 text-[10px] font-medium transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/60 ${
                  active
                    ? "bg-white/[0.09] text-white shadow-sm ring-1 ring-white/10"
                    : "text-slate-400 hover:bg-white/[0.05] hover:text-slate-200"
                }`}
              >
                {icon}
                <span>{label}</span>
                {!!badge && badge > 0 && (
                  <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-amber-400 text-[8px] font-bold text-amber-950 shadow-lg shadow-amber-950/50">
                    {badge > 9 ? "9+" : badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </header>

      <section className="relative z-10 space-y-4 px-4 py-4">
        {busy && (
          <div className="rounded-2xl border border-indigo-500/40 bg-gradient-to-br from-indigo-950/90 via-slate-900/95 to-purple-950/90 p-4 text-[11px] text-white shadow-2xl shadow-indigo-950/60 relative overflow-hidden">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2 font-bold text-xs">
                <span className="animate-spin text-indigo-400">⚡</span>
                <span className="bg-gradient-to-r from-white via-indigo-200 to-sky-200 bg-clip-text text-transparent">
                  Autonomous Form Solver Active
                </span>
              </div>
              <span className="text-[9.5px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-semibold border border-emerald-400/30 animate-pulse">
                ~45s remaining
              </span>
            </div>
            <p className="text-[10.5px] text-indigo-200/90 leading-relaxed mb-2.5">
              {busy === "autoapply"
                ? "The agent is navigating multi-step ATS fields, piercing shadow roots, and validating constraints. Please wait ~1 minute."
                : "Resolving DOM input nodes and injecting zero-hallucination profile data..."}
            </p>
            <div className="h-2 w-full bg-white/10 rounded-full overflow-hidden relative">
              <div className="h-full bg-gradient-to-r from-indigo-500 via-sky-400 to-emerald-400 rounded-full transition-all duration-500 animate-pulse" style={{ width: "80%" }} />
            </div>
          </div>
        )}

        {llmStatus && !llmStatus.configured && (
          <div className="flex items-start gap-2.5 rounded-2xl border border-amber-400/25 bg-amber-400/[0.08] px-4 py-3 text-[11px] text-amber-100">
            <span aria-hidden className="mt-px grid h-4 w-4 flex-shrink-0 place-items-center rounded-full bg-amber-400/90 text-[9px] font-bold text-amber-950">AI</span>
            <div className="min-w-0 flex-1">
              <div className="font-semibold text-amber-200">AI features are off</div>
              <p className="mt-0.5 leading-snug text-amber-100/80">{llmStatus.reason}</p>
              <p className="mt-1 text-[10px] text-amber-100/60">Configure AI on the web dashboard. Provider credentials stay server-side; the extension never stores an AI key.</p>
            </div>
          </div>
        )}
        {tab === "today" && (
          <>
            {/* Active page + agent controls */}
            <div className="overflow-hidden rounded-2xl border border-white/[0.07] bg-white/[0.03] shadow-xl shadow-black/10">
              <div className="border-b border-white/[0.05] px-4 py-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">Active page</span>
                  <span className="h-1.5 w-1.5 rounded-full bg-sky-400/80" aria-hidden />
                </div>
                <div className="mt-1.5 break-all font-mono text-[11.5px] leading-relaxed text-slate-200">
                  {activeUrl || "No active tab detected"}
                </div>
              </div>
              <div className="space-y-2 px-4 py-3.5">
                <button
                  type="button"
                  disabled={busy != null}
                  className="group inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo-500 to-violet-500 px-3 py-2.5 text-xs font-semibold text-white shadow-lg shadow-indigo-950/40 ring-1 ring-white/10 transition-all hover:from-indigo-400 hover:to-violet-400 hover:shadow-indigo-900/40 disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
                  onClick={() => void runAction("autoapply")}
                >
                  <IconBolt size={14} className="transition-transform group-hover:scale-110" />
                  {busy === "autoapply" ? "Starting agent…" : "🤖 Auto-apply this job (end-to-end)"}
                </button>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    disabled={busy != null}
                    className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-white/[0.08] bg-white/[0.06] px-3 py-2 text-[11px] font-medium text-slate-200 transition-colors hover:bg-white/[0.12] hover:text-white disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/60"
                    onClick={() => void runAction("autofill")}
                  >
                    <IconBolt size={13} />
                    {busy === "autofill" ? "Filling…" : "Autofill page"}
                  </button>
                  <button
                    type="button"
                    disabled={busy != null}
                    className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-white/[0.08] bg-white/[0.06] px-3 py-2 text-[11px] font-medium text-slate-200 transition-colors hover:bg-white/[0.12] hover:text-white disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/60"
                    onClick={() => void runAction("match")}
                  >
                    <IconTarget size={13} />
                    {busy === "match" ? "Scoring…" : "Check match"}
                  </button>
                </div>
                <p className="pt-0.5 text-[10px] leading-relaxed text-slate-500">
                  Shortcut: press{" "}
                  <kbd className="rounded border border-white/10 bg-white/[0.06] px-1 py-0.5 font-mono text-slate-300">Alt</kbd>+<kbd className="rounded border border-white/10 bg-white/[0.06] px-1 py-0.5 font-mono text-slate-300">Shift</kbd>+<kbd className="rounded border border-white/10 bg-white/[0.06] px-1 py-0.5 font-mono text-slate-300">F</kbd>{" "}
                  on any job page to autofill instantly.
                </p>
              </div>
            </div>

            {/* Pipeline snapshot */}
            <div>
              <div className="mb-2 flex items-center justify-between">
                <h2 className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">Pipeline snapshot</h2>
                {apps.length > 0 && (
                  <button type="button" onClick={() => setTab("tracker")} className="text-[10px] font-medium text-indigo-300 transition-colors hover:text-indigo-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/60 rounded">
                    View tracker →
                  </button>
                )}
              </div>
              <div className="grid grid-cols-2 gap-2.5">
                <Stat label="Applications" value={stats.total} tone={stats.total > 0 ? "text-white" : "text-slate-500"} />
                <Stat label="Today" value={stats.today} tone="text-white" />
                <Stat label="Applied" value={stats.applied} tone="text-emerald-300" />
                <Stat label="Interviews" value={stats.interviews} tone="text-violet-300" />
              </div>
            </div>

            <Checklist steps={checklistSteps} />
          </>
        )}

        {tab === "brain" && <BrainPanel profile={profile} activeUrl={activeUrl} />}

        {tab === "fleet" && <FleetPanel hasProfile={!!profile?.masterResumeText?.trim()} />}

        {tab === "review" && <ReviewQueuePanel />}

        {tab === "tracker" && (
          <div>
            <div className="mb-2.5 flex items-center justify-between">
              <h2 className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">Pipeline</h2>
              <span className="rounded-full bg-white/[0.06] px-2 py-0.5 text-[10px] font-medium text-slate-300 ring-1 ring-white/[0.08]">
                {apps.length} tracked
              </span>
            </div>
            {apps.length === 0 ? (
              <Empty title="No applications yet" body="Save or autofill a job to start your pipeline." />
            ) : (
              <ul className="space-y-2">
                {apps.slice(0, 30).map((app: any, i) => {
                  const stage = app.stage ?? (app as any).status ?? (app as any).phase ?? "saved";
                  return (
                    <li key={app.id ?? app.url ?? i}>
                      <article className="rounded-2xl border border-white/[0.07] bg-white/[0.03] p-3.5 transition-colors hover:border-white/[0.12] hover:bg-white/[0.05]">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="truncate text-[13px] font-semibold text-slate-100">{app.title ?? app.jobTitle ?? "Untitled role"}</div>
                            <div className="mt-0.5 truncate text-[11px] text-slate-400">{app.company ?? "Unknown company"}</div>
                          </div>
                          <span className={`inline-flex flex-shrink-0 items-center rounded-full px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide ring-1 ${stageAccent(stage)}`}>
                            {stage}
                          </span>
                        </div>
                        {(app.updatedAt || app.createdAt) && (
                          <div className="mt-2 text-[9.5px] text-slate-500">
                            {new Date(app.updatedAt ?? app.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                          </div>
                        )}
                      </article>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        )}

        {tab === "profile" && (
          <div className="overflow-hidden rounded-2xl border border-white/[0.07] bg-white/[0.03]">
            <div className="flex items-center gap-3 border-b border-white/[0.05] bg-gradient-to-r from-indigo-500/[0.08] to-transparent px-4 py-3.5">
              <span className="grid h-10 w-10 flex-shrink-0 place-items-center rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 text-xs font-bold text-white ring-2 ring-white/10">
                {brandInitials}
              </span>
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold text-slate-100">
                  {profile ? `${profile.firstName} ${profile.lastName}`.trim() || "Profile ready" : "Profile not configured"}
                </div>
                <div className="truncate text-[11px] text-slate-400">
                  {profile?.email || "Manage your profile on the web dashboard."}
                </div>
              </div>
            </div>
            <div className="space-y-3 px-4 py-3.5 text-xs text-slate-300">
              <div>
                <div className="mb-1 text-[9.5px] font-semibold uppercase tracking-[0.12em] text-slate-500">Skills</div>
                {profile?.skills?.length ? (
                  <div className="flex flex-wrap gap-1.5">
                    {profile.skills.slice(0, 8).map((s: string) => (
                      <span key={s} className="rounded-md border border-indigo-400/20 bg-indigo-400/10 px-1.5 py-0.5 text-[10px] text-indigo-200">
                        {s}
                      </span>
                    ))}
                  </div>
                ) : (
                  <span className="text-slate-500">Not added</span>
                )}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="text-[9.5px] font-semibold uppercase tracking-[0.12em] text-slate-500">Resume</div>
                  <div className="mt-0.5 text-slate-200">
                    {profile?.masterResumeText ? `${profile.masterResumeText.length.toLocaleString()} chars` : "Missing"}
                  </div>
                </div>
                <div>
                  <div className="text-[9.5px] font-semibold uppercase tracking-[0.12em] text-slate-500">Phone</div>
                  <div className="mt-0.5 truncate text-slate-200">{profile?.phone || "—"}</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {tab === "trust" && (
          <div>
            <h2 className="mb-2.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">Built to be trustworthy by default</h2>
            <div className="space-y-2.5">
              <TrustCard title="No surprise submit" body="Autopilot and final submit are disabled by default. You stay in control." />
              <TrustCard title="Sensitive fields protected" body="PAN, Aadhaar, SSN, passport, license, and passwords are redacted from normal lookup/AI paths." />
              <TrustCard title="Least privilege" body="The extension targets job domains first and asks for optional host access only when needed." />
              <TrustCard title="Encrypted credentials" body="Site passwords require a vault passphrase and are encrypted locally." />
            </div>
          </div>
        )}
      </section>
    </main>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div className="rounded-2xl border border-white/[0.07] bg-gradient-to-b from-white/[0.05] to-transparent px-3.5 py-3">
      <div className={`text-xl font-semibold tabular-nums leading-tight ${tone}`}>{value}</div>
      <div className="mt-0.5 text-[10px] font-medium text-slate-500">{label}</div>
    </div>
  );
}

function Checklist({ steps }: { steps: { label: string; done: boolean }[] }) {
  const doneCount = steps.filter((s) => s.done).length;
  return (
    <div className="rounded-2xl border border-white/[0.07] bg-white/[0.03] px-4 py-3.5">
      <div className="flex items-center gap-2">
        <span className="text-[13px] font-semibold text-slate-100">Activation checklist</span>
        <span className="ml-auto text-[10px] font-medium tabular-nums text-slate-400">{doneCount}/{steps.length}</span>
      </div>
      <ol className="mt-3 space-y-2">
        {steps.map((step, index) => (
          <li key={step.label} className={`flex items-center gap-2.5 text-xs ${step.done ? "text-slate-500" : "text-slate-300"}`}>
            <span
              className={`grid h-[18px] w-[18px] flex-shrink-0 place-items-center rounded-md border text-[9.5px] font-semibold ${
                step.done
                  ? "border-emerald-400/30 bg-emerald-400/15 text-emerald-300"
                  : "border-white/10 bg-white/[0.05] text-indigo-300"
              }`}
            >
              {step.done ? "✓" : index + 1}
            </span>
            <span className={step.done ? "line-through decoration-slate-600" : ""}>{step.label}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}

function TrustCard({ title, body }: { title: string; body: string }) {
  return (
    <article className="rounded-2xl border border-white/[0.07] bg-white/[0.03] px-4 py-3.5 transition-colors hover:border-emerald-400/15 hover:bg-white/[0.045]">
      <div className="flex items-center gap-2 text-[13px] font-semibold text-emerald-300">
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-400/80 shadow-[0_0_6px_rgba(52,211,153,0.6)]" aria-hidden />
        {title}
      </div>
      <p className="mt-1.5 text-xs leading-5 text-slate-400">{body}</p>
    </article>
  );
}

function Empty({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-white/[0.12] bg-white/[0.02] px-6 py-10 text-center">
      <div className="mx-auto mb-3 grid h-10 w-10 place-items-center rounded-full border border-white/10 bg-white/[0.04]">
        <IconBriefcase size={16} className="text-slate-500" />
      </div>
      <div className="text-[13px] font-semibold text-slate-200">{title}</div>
      <p className="mt-1 text-[11px] text-slate-500">{body}</p>
    </div>
  );
}
