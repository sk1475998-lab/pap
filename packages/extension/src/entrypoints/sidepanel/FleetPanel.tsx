import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  runAdvancedJobSearch,
  startFleet,
  abortFleet,
  getFleetState,
  type SearchResultJob,
  type FleetJobLike,
} from "@/popup/api.js";
import { showToast } from "@/lib/ui.js";
import { FLEET_STATE_KEY, type FleetRunState } from "@/lib/fleet-runner.js";
import type { FleetJobStatus } from "@superjob/crew/fleet";
import { IconRocket, IconBolt, IconTarget, IconSparkles, IconX, IconCheck, IconSearch } from "@/lib/icons.jsx";

/* Phase → visual accent + label. Keeps the raw phase in the DOM for a11y. */
const PHASE_META: Record<string, { label: string; cls: string; dot: string }> = {
  queued: { label: "Queued", cls: "text-slate-300 bg-white/[0.05] ring-white/10", dot: "bg-slate-400" },
  scoring: { label: "Scoring", cls: "text-sky-300 bg-sky-400/10 ring-sky-400/20", dot: "bg-sky-400 animate-pulse" },
  enhancing: { label: "Tailoring resume", cls: "text-indigo-300 bg-indigo-400/10 ring-indigo-400/20", dot: "bg-indigo-400 animate-pulse" },
  submitting: { label: "Submitting", cls: "text-violet-300 bg-violet-400/10 ring-violet-400/20", dot: "bg-violet-400 animate-pulse" },
  applied: { label: "Applied", cls: "text-emerald-300 bg-emerald-400/10 ring-emerald-400/20", dot: "bg-emerald-400" },
  preview: { label: "Prepared", cls: "text-emerald-300 bg-emerald-400/10 ring-emerald-400/20", dot: "bg-emerald-400" },
  gated: { label: "Skipped (gate)", cls: "text-amber-300 bg-amber-400/10 ring-amber-400/20", dot: "bg-amber-400" },
  skipped: { label: "Skipped", cls: "text-slate-400 bg-white/[0.04] ring-white/10", dot: "bg-slate-500" },
  failed: { label: "Failed", cls: "text-rose-300 bg-rose-400/10 ring-rose-400/20", dot: "bg-rose-400" },
};

function phaseMeta(phase: string) {
  return PHASE_META[phase] ?? PHASE_META.queued!;
}

const TERMINAL = new Set(["applied", "preview", "gated", "skipped", "failed"]);

export function FleetPanel({ hasProfile }: { hasProfile: boolean }) {
  const [keywords, setKeywords] = useState("");
  const [location, setLocation] = useState("");
  const [candidates, setCandidates] = useState<SearchResultJob[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [searching, setSearching] = useState(false);
  const [dryRun, setDryRun] = useState(true);
  const [concurrency, setConcurrency] = useState(10);
  const [run, setRun] = useState<FleetRunState | null>(null);
  const [launching, setLaunching] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const isRunning = run?.status === "running";

  /* Load any in-flight run on mount + subscribe to live storage updates. */
  useEffect(() => {
    void getFleetState<FleetRunState>().then((s) => s && setRun(s)).catch(() => {});

    const onChanged = (
      changes: Record<string, chrome.storage.StorageChange>,
      area: string,
    ) => {
      if (area !== "local") return;
      const next = changes[FLEET_STATE_KEY]?.newValue as FleetRunState | undefined;
      if (next) setRun(next);
    };
    if (typeof chrome !== "undefined" && chrome.storage?.onChanged) {
      chrome.storage.onChanged.addListener(onChanged);
    }
    return () => {
      if (typeof chrome !== "undefined" && chrome.storage?.onChanged) {
        chrome.storage.onChanged.removeListener(onChanged);
      }
    };
  }, []);

  /* Safety-net poll while running (covers any missed storage event). */
  useEffect(() => {
    if (isRunning && !pollRef.current) {
      pollRef.current = setInterval(() => {
        void getFleetState<FleetRunState>().then((s) => s && setRun(s)).catch(() => {});
      }, 1500);
    }
    if (!isRunning && pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
    return () => {
      if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
    };
  }, [isRunning]);

  const doSearch = useCallback(async () => {
    if (!keywords.trim()) {
      showToast("Enter a role or keywords to search.", "warn");
      return;
    }
    setSearching(true);
    try {
      const res = await runAdvancedJobSearch({
        keywords: keywords.trim(),
        location: location.trim() || "Remote",
        limit: 25,
        sources: ["arbeitnow", "remoteok"],
      });
      const jobs = res.scrapedJobs ?? [];
      setCandidates(jobs);
      // Preselect the top 10 by match score — the "apply to 10" default.
      const top = jobs.slice(0, 10).map((j) => j.id);
      setSelected(new Set(top));
      if (!jobs.length) {
        showToast("No jobs found. Try broader keywords or a different location.", "info", 3600);
      }
    } catch (e) {
      showToast(e instanceof Error ? e.message : String(e), "error", 4200);
    } finally {
      setSearching(false);
    }
  }, [keywords, location]);

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectedJobs = useMemo(
    () => candidates.filter((c) => selected.has(c.id)),
    [candidates, selected],
  );

  const launch = useCallback(async () => {
    if (!hasProfile) {
      showToast("Sync your dashboard profile first — the fleet tailors it per job.", "warn", 4200);
      return;
    }
    if (!selectedJobs.length) {
      showToast("Select at least one job.", "warn");
      return;
    }
    setLaunching(true);
    try {
      const jobs: FleetJobLike[] = selectedJobs.map((j) => ({
        id: j.id,
        url: j.url || j.deepLinkUrl,
        title: j.title,
        company: j.company,
        location: j.location,
        description: j.description,
        salary: j.salary,
        remote: j.remote,
        source: j.source,
      }));
      const { total } = await startFleet(jobs, { concurrency, dryRun, minScore: 50 });
      showToast(
        dryRun
          ? `Preparing ${total} tailored applications in parallel…`
          : `Opening ${total} jobs & running autopilot (a few at a time)…`,
        "success",
        3600,
      );
    } catch (e) {
      showToast(e instanceof Error ? e.message : String(e), "error", 4600);
    } finally {
      setLaunching(false);
    }
  }, [hasProfile, selectedJobs, concurrency, dryRun]);

  const stop = useCallback(async () => {
    try {
      await abortFleet();
      showToast("Stopping the run…", "info");
    } catch (e) {
      showToast(e instanceof Error ? e.message : String(e), "error");
    }
  }, []);

  const counts = useMemo(() => {
    const jobs = run?.jobs ?? [];
    const tally = (p: string) => jobs.filter((j) => j.phase === p).length;
    const doneN = jobs.filter((j) => TERMINAL.has(j.phase)).length;
    return {
      applied: tally("applied"),
      prepared: tally("preview"),
      gated: tally("gated"),
      failed: tally("failed"),
      done: doneN,
      total: run?.total ?? jobs.length,
    };
  }, [run]);

  return (
    <div className="space-y-4">
      {/* Hero / pitch */}
      <div className="overflow-hidden rounded-2xl border border-indigo-400/15 bg-gradient-to-br from-indigo-500/[0.10] via-violet-500/[0.06] to-transparent p-4">
        <div className="flex items-center gap-2 text-[13px] font-semibold text-white">
          <span className="grid h-7 w-7 place-items-center rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 text-white ring-1 ring-white/10">
            <IconRocket size={15} />
          </span>
          Multi-job application preparation
        </div>
        <p className="mt-1.5 text-[11.5px] leading-relaxed text-slate-300">
          Search supported job sources, select postings, and prepare job-specific resume and cover-letter drafts for review.
          <span className="text-white"> Your saved source resume is not overwritten.</span> Preview mode prepares drafts without opening application tabs.
          Assisted apply opens up to three tabs at a time; you review and submit each application yourself.
        </p>
      </div>

      {/* Live run panel (shown while/after a run) */}
      {run && run.total > 0 && (
        <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-3.5">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                {run.dryRun ? "Preview run" : "Live apply run"}
              </span>
              {isRunning && (
                <span className="inline-flex items-center gap-1 rounded-full bg-indigo-400/10 px-2 py-0.5 text-[9px] font-medium text-indigo-300 ring-1 ring-indigo-400/20">
                  <span className="h-1.5 w-1.5 rounded-full bg-indigo-400 animate-pulse" />
                  {run.peakConcurrency || concurrency}× parallel
                </span>
              )}
            </div>
            {isRunning ? (
              <button
                type="button"
                onClick={() => void stop()}
                className="inline-flex items-center gap-1 rounded-lg border border-rose-400/20 bg-rose-400/10 px-2 py-1 text-[10px] font-medium text-rose-300 transition-colors hover:bg-rose-400/20"
              >
                <IconX size={11} /> Stop
              </button>
            ) : (
              <span className="text-[10px] font-medium text-slate-400">
                {run.status === "done" ? "Complete" : run.status === "aborted" ? "Stopped" : run.status === "error" ? "Error" : ""}
              </span>
            )}
          </div>

          {/* Progress bar */}
          <div className="mt-2.5 h-1.5 w-full overflow-hidden rounded-full bg-white/[0.06]">
            <div
              className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-violet-500 transition-all duration-300"
              style={{ width: `${counts.total ? Math.round((counts.done / counts.total) * 100) : 0}%` }}
            />
          </div>
          <div className="mt-1.5 flex items-center justify-between text-[10px] text-slate-400">
            <span>{counts.done} / {counts.total} done</span>
            <span className="flex gap-2">
              {counts.prepared > 0 && <span className="text-emerald-300">{counts.prepared} prepared</span>}
              {counts.applied > 0 && <span className="text-emerald-300">{counts.applied} applied</span>}
              {counts.gated > 0 && <span className="text-amber-300">{counts.gated} gated</span>}
              {counts.failed > 0 && <span className="text-rose-300">{counts.failed} failed</span>}
            </span>
          </div>

          {run.error && (
            <div className="mt-2 rounded-lg border border-rose-400/20 bg-rose-400/10 px-2.5 py-1.5 text-[10.5px] text-rose-200">
              {run.error}
            </div>
          )}

          {/* Per-job live cards */}
          <ul className="mt-3 space-y-1.5">
            {(run.jobs ?? []).map((j) => (
              <FleetJobRow key={j.jobId} job={j} />
            ))}
          </ul>
        </div>
      )}

      {/* Discovery + launch controls (hidden while a run is active to reduce noise) */}
      {!isRunning && (
        <div className="space-y-3">
          <div className="rounded-2xl border border-white/[0.07] bg-white/[0.03] p-3.5">
            <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">
              1 · Find jobs
            </div>
            <div className="space-y-2">
              <input
                value={keywords}
                onChange={(e) => setKeywords(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && void doSearch()}
                placeholder="Role or keywords (e.g. React engineer)"
                className="w-full rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-[12px] text-slate-100 placeholder:text-slate-500 focus:border-indigo-400/40 focus:outline-none focus:ring-1 focus:ring-indigo-400/40"
              />
              <div className="flex gap-2">
                <input
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && void doSearch()}
                  placeholder="Location (or Remote)"
                  className="min-w-0 flex-1 rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-[12px] text-slate-100 placeholder:text-slate-500 focus:border-indigo-400/40 focus:outline-none focus:ring-1 focus:ring-indigo-400/40"
                />
                <button
                  type="button"
                  onClick={() => void doSearch()}
                  disabled={searching}
                  className="inline-flex flex-shrink-0 items-center gap-1.5 rounded-lg bg-white/[0.08] px-3 py-2 text-[11px] font-medium text-slate-100 ring-1 ring-white/10 transition-colors hover:bg-white/[0.14] disabled:opacity-60"
                >
                  <IconSearch size={13} />
                  {searching ? "Searching…" : "Search"}
                </button>
              </div>
            </div>

            {candidates.length > 0 && (
              <>
                <div className="mt-3 mb-1.5 flex items-center justify-between">
                  <span className="text-[10px] font-medium text-slate-400">
                    {selected.size} of {candidates.length} selected
                  </span>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setSelected(new Set(candidates.slice(0, 10).map((c) => c.id)))}
                      className="text-[10px] font-medium text-indigo-300 hover:text-indigo-200"
                    >
                      Top 10
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelected(new Set())}
                      className="text-[10px] font-medium text-slate-400 hover:text-slate-200"
                    >
                      Clear
                    </button>
                  </div>
                </div>
                <ul className="max-h-52 space-y-1.5 overflow-y-auto pr-1">
                  {candidates.map((c) => {
                    const on = selected.has(c.id);
                    const score = c.matchScore;
                    return (
                      <li key={c.id}>
                        <button
                          type="button"
                          onClick={() => toggle(c.id)}
                          className={`flex w-full items-start gap-2.5 rounded-xl border px-3 py-2 text-left transition-colors ${
                            on
                              ? "border-indigo-400/30 bg-indigo-400/[0.08]"
                              : "border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.05]"
                          }`}
                        >
                          <span className={`mt-0.5 grid h-4 w-4 flex-shrink-0 place-items-center rounded border ${on ? "border-indigo-400 bg-indigo-500 text-white" : "border-white/20 bg-transparent"}`}>
                            {on && <IconCheck size={10} />}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-[12px] font-medium text-slate-100">{c.title}</span>
                            <span className="block truncate text-[10.5px] text-slate-400">{c.company || "—"}{c.location ? ` · ${c.location}` : ""}</span>
                          </span>
                          {score !== null && score > 0 && (
                            <span className={`flex-shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-semibold ${score >= 70 ? "bg-emerald-400/10 text-emerald-300" : "bg-white/[0.06] text-slate-300"}`}>
                              {score}%
                            </span>
                          )}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </>
            )}
          </div>

          {/* Launch controls */}
          <div className="rounded-2xl border border-white/[0.07] bg-white/[0.03] p-3.5">
            <div className="mb-2.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">
              2 · Launch
            </div>
            <div className="space-y-2.5">
              <label className="flex items-center justify-between text-[11.5px] text-slate-300">
                <span className="flex items-center gap-1.5">
                  <IconSparkles size={13} className="text-indigo-300" />
                  Concurrent preparation
                </span>
                <span className="flex items-center gap-2">
                  <input
                    type="range" min={1} max={15} value={concurrency}
                    onChange={(e) => setConcurrency(Number(e.target.value))}
                    className="w-24 accent-indigo-500"
                  />
                  <span className="w-5 text-right font-mono text-slate-100">{dryRun ? concurrency : Math.min(concurrency, 3)}</span>
                </span>
              </label>
              {!dryRun && concurrency > 3 && (
                <p className="-mt-1 text-[10px] leading-relaxed text-slate-500">
                  Assisted apply opens real tabs, so it runs 3 at a time for stability — tailoring still uses all {concurrency}.
                </p>
              )}

              <label className="flex cursor-pointer items-center justify-between rounded-lg border border-white/[0.06] bg-white/[0.03] px-3 py-2 text-[11.5px]">
                <span className="min-w-0">
                  <span className="block font-medium text-slate-200">
                    {dryRun ? "Preview mode (safe)" : "Assisted apply"}
                  </span>
                  <span className="block text-[10px] text-slate-500">
                    {dryRun
                      ? "Tailor + score only, no tabs opened"
                      : "Opens each job & runs autopilot; respects your submit settings"}
                  </span>
                </span>
                <span
                  role="switch"
                  aria-checked={!dryRun}
                  onClick={(e) => { e.preventDefault(); setDryRun((v) => !v); }}
                  className={`relative ml-3 inline-flex h-5 w-9 flex-shrink-0 items-center rounded-full transition-colors ${dryRun ? "bg-white/15" : "bg-emerald-500"}`}
                >
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${dryRun ? "translate-x-0.5" : "translate-x-4"}`} />
                </span>
              </label>

              <button
                type="button"
                onClick={() => void launch()}
                disabled={launching || !selectedJobs.length}
                className="group inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo-500 to-violet-500 px-3 py-2.5 text-xs font-semibold text-white shadow-lg shadow-indigo-950/40 ring-1 ring-white/10 transition-all hover:from-indigo-400 hover:to-violet-400 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <IconBolt size={14} className="transition-transform group-hover:scale-110" />
                {launching
                  ? "Launching…"
                  : selectedJobs.length
                    ? `${dryRun ? "Prepare" : "Apply to"} ${selectedJobs.length} job${selectedJobs.length === 1 ? "" : "s"} in parallel`
                    : "Select jobs to launch"}
              </button>
              {!hasProfile && (
                <p className="text-[10px] leading-relaxed text-amber-300/90">
                  Sync your dashboard profile first — the fleet tailors it per job.
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function FleetJobRow({ job }: { job: FleetJobStatus }) {
  const meta = phaseMeta(job.phase);
  const lift = job.atsBefore != null && job.atsAfter != null ? job.atsAfter - job.atsBefore : null;
  const isActive = !TERMINAL.has(job.phase);

  // Elapsed time counter — ticks every second while active
  const [elapsed, setElapsed] = useState<number | null>(null);
  const startRef = useRef<number>(Date.now());

  useEffect(() => {
    if (!isActive) { setElapsed(null); return; }
    startRef.current = Date.now();
    const id = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startRef.current) / 1000));
    }, 1000);
    return () => clearInterval(id);
  }, [isActive, job.phase]);

  // Phase pipeline for timeline bar
  const PIPELINE = ["queued", "scoring", "enhancing", "submitting"] as const;
  const pipelineIdx = PIPELINE.indexOf(job.phase as typeof PIPELINE[number]);
  const isDone   = job.phase === "applied" || job.phase === "preview";
  const isFailed = job.phase === "failed" || job.phase === "gated" || job.phase === "skipped";

  return (
    <li className={`rounded-xl border bg-white/[0.02] px-3 py-2.5 transition-all ${
      isActive ? "border-indigo-400/20 shadow-sm shadow-indigo-900/20" : "border-white/[0.05]"
    }`}>
      {/* Header row */}
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="truncate text-[11.5px] font-medium text-slate-100">{job.title}</div>
          <div className="truncate text-[10px] text-slate-500">{job.company || "—"}</div>
        </div>
        <div className="flex flex-shrink-0 items-center gap-1.5">
          {/* Elapsed timer while active */}
          {isActive && elapsed !== null && (
            <span className="font-mono text-[9px] text-slate-600">
              {elapsed < 60 ? `${elapsed}s` : `${Math.floor(elapsed / 60)}m${elapsed % 60}s`}
            </span>
          )}
          <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide ring-1 ${meta.cls}`}>
            <span className={`h-1.5 w-1.5 rounded-full ${meta.dot}`} />
            {meta.label}
          </span>
        </div>
      </div>

      {/* Phase timeline bar (shown while in-flight) */}
      {!isDone && !isFailed && (
        <div className="mt-2 flex items-center gap-0.5">
          {PIPELINE.map((p, i) => {
            const passed  = pipelineIdx > i;
            const current = pipelineIdx === i;
            return (
              <div
                key={p}
                className={`h-0.5 flex-1 rounded-full transition-all duration-500 ${
                  passed
                    ? "bg-indigo-400"
                    : current
                    ? "animate-pulse bg-violet-400"
                    : "bg-white/[0.08]"
                }`}
              />
            );
          })}
        </div>
      )}
      {isDone && (
        <div className="mt-2 h-0.5 w-full rounded-full bg-emerald-500/50" />
      )}
      {isFailed && (
        <div className="mt-2 h-0.5 w-full rounded-full bg-rose-500/40" />
      )}

      {/* Stats row */}
      {(job.score != null || lift != null || job.message) && (
        <div className="mt-1.5 flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-[9.5px] text-slate-400">
          {job.score != null && <span>Match {job.score}%</span>}
          {job.atsBefore != null && job.atsAfter != null && (
            <span>
              ATS {job.atsBefore}→<span className="text-emerald-300">{job.atsAfter}</span>
              {lift != null && lift !== 0 && (
                <span className={lift > 0 ? "text-emerald-400" : "text-rose-400"}> ({lift > 0 ? "+" : ""}{lift})</span>
              )}
            </span>
          )}
          {job.filledFields != null && job.filledFields > 0 && <span>{job.filledFields} fields</span>}
          {job.message && <span className="truncate text-slate-500">{job.message}</span>}
        </div>
      )}
    </li>
  );
}
