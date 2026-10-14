import { useState, useCallback, useEffect, useRef } from "react";
import type { Profile } from "@superjob/core";
import { showToast } from "@/lib/ui.js";

interface BrainPanelProps {
  profile?: Profile;
  activeUrl: string;
}

function jobUrlIdentity(value: string): string {
  try {
    const url = new URL(value);
    return `${url.origin}${url.pathname.replace(/\/+$/, "")}`;
  } catch {
    return value.trim();
  }
}

async function saveActiveJobContext(job: {
  title?: string;
  company?: string;
  description: string;
  url: string;
}): Promise<void> {
  const url = job.url.trim();
  if (new URL(url).protocol !== "https:") throw new Error("Only HTTPS job postings can be stored.");
  const { authenticatedCloudFetch } = await import("@/lib/sync/sync-client.js");
  const response = await authenticatedCloudFetch("/resume/active-job", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jobUrl: url,
      jobTitle: job.title?.trim() || "",
      company: job.company?.trim() || "",
      jobDescription: job.description,
    }),
  });
  const result = await response.json() as { ok?: boolean; error?: string };
  if (!response.ok || !result.ok) {
    throw new Error(result.error || `Could not save the active job (HTTP ${response.status}).`);
  }
}

async function clearActiveJobContext(jobUrl: string): Promise<void> {
  let url: URL;
  try {
    url = new URL(jobUrl);
  } catch {
    return;
  }
  if (url.protocol !== "https:") return;
  const { authenticatedCloudFetch } = await import("@/lib/sync/sync-client.js");
  const response = await authenticatedCloudFetch(`/resume/active-job?jobUrl=${encodeURIComponent(url.href)}`, {
    method: "DELETE",
  });
  const result = await response.json() as { ok?: boolean; error?: string };
  if (response.status === 409) return;
  if (!response.ok || !result.ok) {
    throw new Error(result.error || `Could not clear the previous active job (HTTP ${response.status}).`);
  }
}

export function BrainPanel({ profile, activeUrl }: BrainPanelProps) {
  const [jobTitle, setJobTitle] = useState("");
  const [company, setCompany] = useState("");
  const [jobDescription, setJobDescription] = useState("");
  const [jobUrl, setJobUrl] = useState(activeUrl);
  const [jobDetectionStatus, setJobDetectionStatus] = useState("");
  const [detectingJob, setDetectingJob] = useState(false);
  const [loading, setLoading] = useState(false);
  const [tailoredResult, setTailoredResult] = useState<any>(null);
  const previousActiveUrl = useRef(activeUrl);
  const savedJobUrl = useRef("");

  const applyDetectedJob = useCallback(async (job: { title?: string; company?: string; description?: string; url?: string } | undefined) => {
    if (!job) {
      setJobDetectionStatus("No job context was detected on this page. Paste a job URL or enter the description.");
      return;
    }
    if (job.title) setJobTitle(job.title);
    if (job.company) setCompany(job.company);
    if (job.url) setJobUrl(job.url);
    if (job.description) setJobDescription(job.description);
    if (!job.description || job.description.length < 80) {
      setJobDetectionStatus("Job found, but its description is missing or too short. Paste the full description before tailoring.");
      return;
    }
    try {
      await saveActiveJobContext({
        title: job.title,
        company: job.company,
        description: job.description,
        url: job.url || activeUrl,
      });
      savedJobUrl.current = job.url || activeUrl;
      setJobDetectionStatus(
        `Preview ready · ${job.description.length.toLocaleString()} characters · saved privately for this active job`
      );
    } catch (error) {
      setJobDetectionStatus(
        `Preview ready · ${job.description.length.toLocaleString()} characters, but private storage failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }, [activeUrl]);

  const refreshJobContext = useCallback(async () => {
    setDetectingJob(true);
    setJobDetectionStatus("Reading the active job page…");
    try {
      const { api } = await import("@/popup/api.js");
      const detected = await api.detect();
      await applyDetectedJob(detected?.job);
    } catch (error) {
      setJobDetectionStatus(error instanceof Error ? error.message : "Could not read the active job page.");
    } finally {
      setDetectingJob(false);
    }
  }, [applyDetectedJob]);

  useEffect(() => {
    const previousUrl = previousActiveUrl.current;
    previousActiveUrl.current = activeUrl;
    setJobUrl(activeUrl);
    if (previousUrl && jobUrlIdentity(previousUrl) !== jobUrlIdentity(activeUrl)) {
      setJobTitle("");
      setCompany("");
      setJobDescription("");
      setTailoredResult(null);
      savedJobUrl.current = "";
      void clearActiveJobContext(previousUrl)
        .catch((error) => setJobDetectionStatus(`Previous job data could not be cleared: ${error instanceof Error ? error.message : String(error)}`))
        .finally(() => void refreshJobContext());
      return;
    }
    void refreshJobContext();
  }, [activeUrl, refreshJobContext]);

  const openAndAnalyzeJobUrl = useCallback(async () => {
    let parsed: URL;
    try {
      parsed = new URL(jobUrl.trim());
    } catch {
      setJobDetectionStatus("Enter a valid HTTPS job-posting URL.");
      return;
    }
    if (parsed.protocol !== "https:" || parsed.username || parsed.password) {
      setJobDetectionStatus("For safety, job links must use HTTPS and cannot include URL credentials.");
      return;
    }

    setDetectingJob(true);
    setJobDetectionStatus("Opening the posting and waiting for its job details…");
    setJobTitle("");
    setCompany("");
    setJobDescription("");
    setTailoredResult(null);
    try {
      const previousJobUrl = savedJobUrl.current || activeUrl;
      if (previousJobUrl && jobUrlIdentity(previousJobUrl) !== jobUrlIdentity(parsed.href)) {
        await clearActiveJobContext(previousJobUrl);
        savedJobUrl.current = "";
      }
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab?.id) throw new Error("No active browser tab is available.");
      if (tab.url !== parsed.href) await chrome.tabs.update(tab.id, { url: parsed.href });

      const { api } = await import("@/popup/api.js");
      for (let attempt = 0; attempt < 20; attempt++) {
        await new Promise((resolve) => setTimeout(resolve, attempt === 0 ? 900 : 500));
        const detected = await api.detect().catch(() => null);
        if (detected?.job?.description?.length && detected.job.description.length >= 80) {
          await applyDetectedJob(detected.job);
          return;
        }
      }
      setJobDetectionStatus("The posting opened, but its description was not extractable. Sign in if needed or paste the full description below.");
    } catch (error) {
      setJobDetectionStatus(error instanceof Error ? error.message : "Could not open or analyze that job link.");
    } finally {
      setDetectingJob(false);
    }
  }, [activeUrl, applyDetectedJob, jobUrl]);

  const persistEditedDescription = useCallback(async () => {
    if (jobDescription.trim().length < 80) return;
    try {
      await saveActiveJobContext({
        title: jobTitle,
        company,
        description: jobDescription,
        url: jobUrl.trim() || activeUrl,
      });
      savedJobUrl.current = jobUrl.trim() || activeUrl;
      setJobDetectionStatus(`Full description saved privately · ${jobDescription.length.toLocaleString()} characters`);
    } catch (error) {
      setJobDetectionStatus(`Description is not saved privately: ${error instanceof Error ? error.message : String(error)}`);
    }
  }, [activeUrl, company, jobDescription, jobTitle, jobUrl]);

  const runGroundedTailor = useCallback(async () => {
    if (!jobTitle.trim() && !jobDescription.trim()) {
      showToast("Please provide a target job title or description", "error");
      return;
    }

    setLoading(true);
    showToast("Tailoring resume…", "info");

    try {
      if (!profile?.masterResumeText?.trim()) {
        throw new Error("No synced resume is available. Upload it on the dashboard, then sync the extension.");
      }
      if (jobDescription.trim().length < 80) {
        throw new Error("A full job description is required for grounded tailoring. Refresh the job preview or paste the description.");
      }

      const { authenticatedCloudFetch } = await import("@/lib/sync/sync-client.js");
      const res = await authenticatedCloudFetch("/resume/grounded-tailor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jobTitle: jobTitle.trim() || "Target Role",
          company: company.trim() || undefined,
          jobDescription: jobDescription.trim(),
          jobUrl: jobUrl.trim() || activeUrl,
        }),
      });
      const response = await res.json() as { ok?: boolean; error?: string; data?: any; note?: string; isAI?: boolean };
      if (!res.ok || !response.ok) {
        throw new Error(response.error || `Cloud tailoring failed (HTTP ${res.status}).`);
      }
      const data = response.data;
      if (data) data.isAI = response.isAI;
      if (data && !response.isAI && response.note) data.modelNote = response.note;

      const tailoredText = data?.fullTailoredText;
      if (
        typeof tailoredText !== "string" ||
        typeof data.tailoredScore !== "number" ||
        !Number.isFinite(data.tailoredScore) ||
        data.tailoredScore < 0 ||
        data.tailoredScore > 100
      ) {
        throw new Error("Tailoring returned incomplete results; please try again.");
      }
      setTailoredResult(data);
      let saved = false;
      try {
        const { saveResumeVersion } = await import("@/lib/resume-version-store.js");
        const { jobKey } = await import("@/lib/app-state.js");
        const k = jobKey(jobUrl.trim() || activeUrl, jobTitle, company);
        const score = Math.round(data.tailoredScore);
        await saveResumeVersion({
          jobKey: k,
          title: jobTitle,
          company,
          score,
          atsScore: score,
          suggestedAdditions: data.suggestedAdditions || [],
          keywordGaps: data.addedKeywords || [],
          createdAt: Date.now(),
          tailoredText,
        });
        saved = true;
      } catch (saveErr) {
        console.error("[BrainPanel] saveResumeVersion failed:", saveErr);
        showToast("Tailoring completed, but the resume version could not be saved.", "error");
      }
      if (saved) {
        showToast("Resume tailoring finished and saved. Review every suggested change before using it.", "success");
      }
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Tailoring failed", "error");
    } finally {
      setLoading(false);
    }
  }, [activeUrl, jobTitle, company, jobDescription, jobUrl, profile]);

  return (
    <div className="space-y-4 text-slate-200">
      {/* Research Brain Banner */}
      <div className="rounded-2xl border border-indigo-500/30 bg-gradient-to-br from-indigo-950/50 to-slate-900/60 p-4 shadow-xl">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xl">🧠</span>
            <div>
              <h2 className="text-xs font-bold uppercase tracking-wider text-indigo-300">
                Resume Tailoring
              </h2>
              <p className="text-[11px] text-slate-400">Review all generated changes before using them</p>
            </div>
          </div>
          <span className="rounded-full border border-indigo-400/30 bg-indigo-400/10 px-2 py-0.5 text-[10px] font-semibold text-indigo-300">
            Review required
          </span>
        </div>

        <div className="mt-3 grid grid-cols-3 gap-2 text-center text-[10.5px]">
          <div className="rounded-xl border border-white/5 bg-slate-950/50 p-2">
            <div className="font-semibold text-slate-400">Input</div>
            <div className="mt-0.5 text-xs font-bold text-sky-400">Job + profile</div>
          </div>
          <div className="rounded-xl border border-white/5 bg-slate-950/50 p-2">
            <div className="font-semibold text-slate-400">Grounding</div>
            <div className="mt-0.5 text-xs font-bold text-emerald-400">Candidate data</div>
          </div>
          <div className="rounded-xl border border-white/5 bg-slate-950/50 p-2">
            <div className="font-semibold text-slate-400">Output</div>
            <div className="mt-0.5 text-xs font-bold text-violet-400">Review changes</div>
          </div>
        </div>
      </div>

      {/* Grounded Tailoring & Visual Green Diff Card */}
      <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-4 shadow-xl">
        <div className="flex items-center justify-between border-b border-white/[0.06] pb-2.5">
          <div className="flex items-center gap-2">
            <span className="text-base">🌿</span>
            <h3 className="text-xs font-semibold text-white">Grounded Tailor & Green Diff</h3>
          </div>
          <span className="rounded-full bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 text-[10px] font-medium text-emerald-300">
            Myers O(ND) Algorithm
          </span>
        </div>

        <div className="mt-3 space-y-2.5">
          <div>
            <label className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
              Job posting URL
            </label>
            <div className="mt-1 flex gap-2">
              <input
                type="url"
                placeholder="https://…"
                value={jobUrl}
                onChange={(e) => {
                  const nextUrl = e.target.value;
                  if (jobUrl && nextUrl && jobUrlIdentity(jobUrl) !== jobUrlIdentity(nextUrl)) {
                    setJobDescription("");
                    setJobTitle("");
                    setCompany("");
                    setTailoredResult(null);
                  }
                  setJobUrl(nextUrl);
                }}
                className="min-w-0 flex-1 rounded-lg border border-white/10 bg-slate-900/80 px-2.5 py-2 text-xs text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none"
              />
              <button
                type="button"
                disabled={detectingJob}
                onClick={() => void openAndAnalyzeJobUrl()}
                className="rounded-lg border border-indigo-400/30 bg-indigo-500/10 px-3 py-2 text-xs font-semibold text-indigo-200 hover:bg-indigo-500/20 disabled:opacity-60"
              >
                {detectingJob ? "Reading…" : "Open & preview"}
              </button>
            </div>
            <button
              type="button"
              disabled={detectingJob}
              onClick={() => void refreshJobContext()}
              className="mt-2 text-xs font-medium text-sky-300 hover:text-sky-200 disabled:opacity-60"
            >
              {detectingJob ? "Checking posting…" : "Refresh from current page"}
            </button>
            {jobDetectionStatus && (
              <p className="mt-1 text-xs leading-5 text-slate-400" role="status" aria-live="polite">
                {jobDetectionStatus}
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                Target Title
              </label>
              <input
                type="text"
                placeholder="Senior Full Stack..."
                value={jobTitle}
                onChange={(e) => setJobTitle(e.target.value)}
                className="mt-1 w-full rounded-lg border border-white/10 bg-slate-900/80 px-2.5 py-1.5 text-xs text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                Company
              </label>
              <input
                type="text"
                placeholder="Google / Stripe..."
                value={company}
                onChange={(e) => setCompany(e.target.value)}
                className="mt-1 w-full rounded-lg border border-white/10 bg-slate-900/80 px-2.5 py-1.5 text-xs text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
              Job Description (Keywords & Requirements)
            </label>
            <textarea
              placeholder="Review the extracted posting here. Paste or correct the complete job description before tailoring."
              rows={7}
              value={jobDescription}
              onChange={(e) => setJobDescription(e.target.value)}
              onBlur={() => void persistEditedDescription()}
              className="mt-1 w-full resize-y rounded-lg border border-white/10 bg-slate-900/80 px-2.5 py-2 text-xs leading-5 text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none"
            />
            <div className="mt-1 text-right text-[10px] text-slate-500">
              {jobDescription.length.toLocaleString()} characters · full text sent to the secure tailoring API
            </div>
          </div>

          <button
            type="button"
            disabled={loading || detectingJob || jobDescription.trim().length < 80}
            onClick={() => void runGroundedTailor()}
            className="w-full rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 px-3 py-2 text-xs font-semibold text-white shadow-lg shadow-emerald-950/40 transition hover:from-emerald-500 hover:to-teal-500 disabled:opacity-60"
          >
            {loading ? "Tailoring resume…" : "⚡ Tailor Resume & Render Diff"}
          </button>
        </div>

        {/* Tailored Green Diff Result Preview */}
        {tailoredResult && (
          <div className="mt-4 space-y-3 border-t border-white/[0.06] pt-3">
            {/* ATS Delta Progress Bar */}
            {Number.isFinite(tailoredResult.originalScore) && Number.isFinite(tailoredResult.tailoredScore) && (
            <div className="flex items-center justify-between rounded-xl bg-slate-950/60 p-2.5 border border-white/5">
              <div>
                <span className="text-[10px] text-slate-400 uppercase font-semibold">Heuristic ATS score</span>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-sm font-bold text-slate-300">
                    {tailoredResult.originalScore}%
                  </span>
                  <span className="text-emerald-400 font-bold">→</span>
                  <span className="text-base font-extrabold text-emerald-400">
                    {tailoredResult.tailoredScore}%
                  </span>
                </div>
              </div>
              <span className="rounded-full bg-emerald-400/10 border border-emerald-400/30 px-2.5 py-1 text-[11px] font-bold text-emerald-300 shadow-sm">
                {tailoredResult.atsImprovement >= 0 ? "+" : ""}{tailoredResult.atsImprovement}% change
              </span>
            </div>
            )}

            {/* Live Green Semantic Diff Output */}
            <div className="rounded-xl border border-white/10 bg-slate-950/80 p-3 max-h-60 overflow-y-auto font-mono text-[11px] leading-relaxed text-slate-300">
              <div className="mb-2 text-[10px] font-sans font-bold uppercase tracking-wider text-emerald-400 flex items-center justify-between">
                <span>Semantic Green Diff</span>
                <span>{tailoredResult.fullResumeDiff?.stats?.addedWords ?? 0} Additions</span>
              </div>
              <div
                dangerouslySetInnerHTML={{ __html: tailoredResult.fullResumeDiff?.html ?? "" }}
                className="[&_mark.diff-added]:bg-emerald-500/20 [&_mark.diff-added]:text-emerald-300 [&_mark.diff-added]:font-semibold [&_mark.diff-added]:px-1 [&_mark.diff-added]:rounded"
              />
            </div>

            <div className="space-y-1.5">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                Suggested additions — verify before using
              </span>
              <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
                {tailoredResult.suggestedAdditions?.slice(0, 8).map((suggestion: string, i: number) => (
                  <span
                    key={i}
                    className="inline-flex items-center gap-1 rounded-full border border-amber-500/25 bg-amber-500/10 px-2 py-0.5 text-[10px] text-amber-300"
                  >
                    {suggestion}
                  </span>
                ))}
              </div>
            </div>

            <a
              href="http://localhost:5173/resume"
              target="_blank"
              rel="noreferrer"
              className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-medium text-slate-300 hover:bg-white/10 hover:text-white transition"
            >
              <span>🖥️</span> Open Dual-Pane Diff on Cloud Dashboard
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
