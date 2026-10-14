/**
 * ReviewQueuePanel — HITL Evidence Pack Review UI
 *
 * Renders the Human-in-the-Loop review queue produced by the ReviewAgent.
 * Each card shows the full Evidence Pack so a human can decide in <10 seconds:
 *   ✅ Approve → triggers real submit
 *   ❌ Reject  → removes from queue
 *   ✏️ Edit   → (future) opens cover letter editor
 *
 * Auto-refreshes every 30s and on chrome.storage changes.
 * Cards with TTL < 2h show an expiry warning.
 *
 * Design: Glassmorphism dark cards with confidence meter, field fill bar,
 * cover letter preview, and one-click approve/reject.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import type { EvidencePack } from "@superjob/crew";

/* ------------------------------------------------------------------ */
/* Storage helpers (direct chrome.storage reads — no round-trip to bg) */
/* ------------------------------------------------------------------ */

const REVIEW_QUEUE_KEY = "sja_review_queue";

async function loadQueue(): Promise<EvidencePack[]> {
  try {
    const raw = await chrome.storage.local.get(REVIEW_QUEUE_KEY);
    const arr: EvidencePack[] = (raw?.[REVIEW_QUEUE_KEY] as EvidencePack[]) ?? [];
    const now = Date.now();
    return arr.filter((p) => p.ttl > now && p.decision === "pending");
  } catch {
    return [];
  }
}

async function updateQueueItem(
  jobId: string,
  decision: "approved" | "rejected"
): Promise<void> {
  try {
    const raw = await chrome.storage.local.get(REVIEW_QUEUE_KEY);
    const arr: EvidencePack[] = (raw?.[REVIEW_QUEUE_KEY] as EvidencePack[]) ?? [];
    const updated = arr.map((p) =>
      p.jobId === jobId
        ? { ...p, decision, decidedAt: Date.now() }
        : p
    );
    await chrome.storage.local.set({ [REVIEW_QUEUE_KEY]: updated });
  } catch { /* non-fatal */ }
}

/* ------------------------------------------------------------------ */
/* Sub-components                                                        */
/* ------------------------------------------------------------------ */

function ConfidenceMeter({ value }: { value: number }) {
  const pct = Math.max(0, Math.min(100, value));
  const color =
    pct >= 90 ? "from-emerald-400 to-emerald-500" :
    pct >= 70 ? "from-sky-400 to-indigo-500" :
    pct >= 55 ? "from-amber-400 to-orange-500" :
    "from-rose-400 to-rose-600";

  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/10">
        <div
          className={`h-full rounded-full bg-gradient-to-r transition-all duration-500 ${color}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className={`min-w-[32px] text-right text-[11px] font-bold tabular-nums ${
        pct >= 90 ? "text-emerald-300" :
        pct >= 70 ? "text-sky-300" :
        pct >= 55 ? "text-amber-300" :
        "text-rose-300"
      }`}>
        {pct}%
      </span>
    </div>
  );
}

function FieldFillBar({ filled, total }: { filled: number; total: number }) {
  const pct = total > 0 ? Math.round((filled / total) * 100) : 0;
  return (
    <div className="flex items-center gap-2 text-[10px] text-slate-400">
      <div className="h-1 flex-1 overflow-hidden rounded-full bg-white/[0.08]">
        <div
          className="h-full rounded-full bg-gradient-to-r from-indigo-400 to-violet-500 transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="tabular-nums">{filled}/{total} fields</span>
    </div>
  );
}

function TierBadge({ tier }: { tier: EvidencePack["tier"] }) {
  if (tier === "AUTO_SUBMIT") return (
    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-400/10 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-emerald-300 ring-1 ring-emerald-400/20">
      <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
      Auto-submit eligible
    </span>
  );
  if (tier === "HUMAN_REVIEW") return (
    <span className="inline-flex items-center gap-1 rounded-full bg-amber-400/10 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-amber-300 ring-1 ring-amber-400/20">
      <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
      Needs review
    </span>
  );
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-rose-400/10 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-rose-300 ring-1 ring-rose-400/20">
      Rejected
    </span>
  );
}

function ExpiryWarning({ ttl }: { ttl: number }) {
  const remaining = ttl - Date.now();
  if (remaining > 2 * 60 * 60 * 1000) return null;
  const mins = Math.ceil(remaining / 60000);
  return (
    <div className="flex items-center gap-1.5 rounded-lg bg-amber-400/[0.08] px-2.5 py-1.5 text-[10px] text-amber-300 ring-1 ring-amber-400/20">
      <span aria-hidden>⏳</span>
      Expires in {mins < 60 ? `${mins}m` : `${Math.ceil(mins / 60)}h`} — approve or it auto-expires
    </div>
  );
}

function ReActTraceSection({ traces }: { traces: EvidencePack["reasoning"] }) {
  const [open, setOpen] = useState(false);
  if (!traces || traces.length === 0) return null;
  return (
    <div className="mt-2">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1 text-[10px] font-medium text-slate-500 transition-colors hover:text-slate-300"
      >
        <svg className={`h-3 w-3 transition-transform ${open ? "rotate-90" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
        </svg>
        {open ? "Hide" : "Show"} AI reasoning trace ({traces.length} steps)
      </button>
      {open && (
        <div className="mt-1.5 space-y-1.5 rounded-lg bg-white/[0.03] p-2.5 ring-1 ring-white/[0.06]">
          {traces.map((t, i) => (
            <div key={i} className="text-[9.5px] leading-relaxed text-slate-400">
              <span className="font-semibold text-indigo-400">[{t.step + 1}]</span>{" "}
              <span className="text-slate-300">{t.thought.slice(0, 80)}{t.thought.length > 80 ? "…" : ""}</span>
              {" → "}
              <span className="text-sky-400">{t.action.slice(0, 50)}{t.action.length > 50 ? "…" : ""}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Evidence Pack Card                                                    */
/* ------------------------------------------------------------------ */

interface EvidenceCardProps {
  pack: EvidencePack;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
  approving?: boolean;
  rejecting?: boolean;
}

function EvidenceCard({ pack, onApprove, onReject, approving, rejecting }: EvidenceCardProps) {
  const [expanded, setExpanded] = useState(false);
  const busy = approving || rejecting;

  return (
    <article
      id={`review-card-${pack.jobId}`}
      className="group rounded-2xl border border-white/[0.07] bg-gradient-to-b from-white/[0.04] to-white/[0.02] p-4 transition-all duration-200 hover:border-indigo-500/30 hover:from-indigo-500/[0.06] hover:to-white/[0.02]"
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="truncate text-[13px] font-semibold text-slate-100">{pack.jobTitle}</div>
          <div className="mt-0.5 truncate text-[11px] text-slate-400">{pack.company}</div>
        </div>
        <TierBadge tier={pack.tier} />
      </div>

      {/* Confidence + Fields */}
      <div className="mt-3 space-y-2">
        <div>
          <div className="mb-1 flex items-center justify-between text-[10px] text-slate-500">
            <span>AI Confidence</span>
            <span className="text-slate-400">Match Score: {pack.matchScore ?? "—"}</span>
          </div>
          <ConfidenceMeter value={pack.confidence} />
        </div>
        <FieldFillBar filled={pack.filledFields} total={pack.totalFields} />
      </div>

      {/* Low confidence field warnings */}
      {pack.lowConfidenceFields.length > 0 && (
        <div className="mt-2.5 rounded-lg bg-amber-400/[0.06] px-2.5 py-2 ring-1 ring-amber-400/[0.15]">
          <div className="mb-1 text-[10px] font-semibold text-amber-300">Low-confidence fields</div>
          <div className="flex flex-wrap gap-1">
            {pack.lowConfidenceFields.map((f) => (
              <span key={f} className="rounded-md bg-amber-400/10 px-1.5 py-0.5 text-[9px] text-amber-400 ring-1 ring-amber-400/20">
                {f}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Expiry warning */}
      <div className="mt-2.5">
        <ExpiryWarning ttl={pack.ttl} />
      </div>

      {/* Expandable: Cover Letter + Resume + Trace */}
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="mt-3 flex w-full items-center justify-between text-[10px] font-medium text-slate-500 transition-colors hover:text-slate-300"
      >
        <span>Evidence details</span>
        <svg className={`h-3 w-3 transition-transform ${expanded ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {expanded && (
        <div className="mt-3 space-y-3">
          {/* Screenshot */}
          {pack.screenshotBase64 && (
            <div className="overflow-hidden rounded-lg ring-1 ring-white/[0.08]">
              <img
                src={pack.screenshotBase64.startsWith("data:") ? pack.screenshotBase64 : `data:image/png;base64,${pack.screenshotBase64}`}
                alt="Form fill screenshot"
                className="w-full object-cover"
              />
            </div>
          )}

          {/* Cover Letter preview */}
          {pack.coverLetter && (
            <div>
              <div className="mb-1 text-[10px] font-semibold text-slate-500">Cover Letter</div>
              <div className="max-h-28 overflow-y-auto rounded-lg bg-white/[0.03] p-2.5 text-[10px] leading-relaxed text-slate-300 ring-1 ring-white/[0.06] scrollbar-thin scrollbar-track-transparent scrollbar-thumb-white/10">
                {pack.coverLetter}
              </div>
            </div>
          )}

          {/* Tailored resume snippet */}
          {pack.tailoredResume && (
            <div>
              <div className="mb-1 text-[10px] font-semibold text-slate-500">Tailored Resume (top)</div>
              <div className="max-h-20 overflow-y-auto rounded-lg bg-white/[0.03] p-2.5 text-[10px] leading-relaxed text-slate-400 ring-1 ring-white/[0.06] scrollbar-thin scrollbar-track-transparent scrollbar-thumb-white/10">
                {pack.tailoredResume.slice(0, 400)}{pack.tailoredResume.length > 400 ? "…" : ""}
              </div>
            </div>
          )}

          {/* ReAct trace */}
          <ReActTraceSection traces={pack.reasoning} />
        </div>
      )}

      {/* Action Buttons */}
      <div className="mt-4 flex gap-2">
        <button
          id={`approve-${pack.jobId}`}
          type="button"
          disabled={busy}
          onClick={() => onApprove(pack.jobId)}
          className="flex-1 rounded-xl bg-emerald-500/90 px-3 py-2 text-[12px] font-semibold text-white shadow-lg shadow-emerald-950/40 transition-all duration-150 hover:bg-emerald-400 hover:shadow-emerald-900/50 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/60"
        >
          {approving ? (
            <span className="flex items-center justify-center gap-1.5">
              <svg className="h-3 w-3 animate-spin" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Submitting…
            </span>
          ) : "✅ Approve & Submit"}
        </button>
        <button
          id={`reject-${pack.jobId}`}
          type="button"
          disabled={busy}
          onClick={() => onReject(pack.jobId)}
          className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-[12px] font-semibold text-rose-300 transition-all duration-150 hover:bg-rose-500/20 hover:text-rose-200 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400/60"
        >
          {rejecting ? "…" : "❌ Reject"}
        </button>
      </div>

      {/* Idempotency note */}
      <div className="mt-2 text-[9px] text-slate-600">
        ID: {pack.idempotencyKey} · Created {new Date(pack.createdAt).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}
      </div>
    </article>
  );
}

/* ------------------------------------------------------------------ */
/* OTP & CAPTCHA HITL Cards                                           */
/* ------------------------------------------------------------------ */

function OtpCard({
  pack,
  onSubmitOtp,
  onFocusTab,
  onDismiss,
  busy,
}: {
  pack: EvidencePack;
  onSubmitOtp: (id: string, code: string) => void;
  onFocusTab: (pack: EvidencePack) => void;
  onDismiss: (id: string) => void;
  busy?: boolean;
}) {
  const [code, setCode] = useState("");

  return (
    <article
      id={`review-otp-${pack.jobId}`}
      className="group rounded-2xl border border-amber-500/30 bg-gradient-to-b from-amber-500/[0.08] to-amber-950/[0.05] p-4 transition-all duration-200"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 text-[13px] font-semibold text-amber-200">
            <span>📱 Verification Code Required</span>
          </div>
          <div className="mt-0.5 truncate text-[11px] text-slate-300">{pack.company}</div>
        </div>
        <span className="inline-flex items-center gap-1 rounded-full bg-amber-400/10 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-amber-300 ring-1 ring-amber-400/30">
          Action Required
        </span>
      </div>

      <p className="mt-2 text-[11px] leading-relaxed text-slate-300">
        Enter the OTP / 2FA verification code sent to your mobile or email to proceed with this application.
      </p>

      <div className="mt-3 flex gap-2">
        <input
          type="text"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && code.trim()) onSubmitOtp(pack.jobId, code);
          }}
          placeholder="e.g. 6-digit OTP code"
          className="flex-1 rounded-xl border border-white/10 bg-white/[0.06] px-3 py-1.5 font-mono text-[13px] text-white placeholder-slate-500 outline-none focus:border-amber-400/60 focus:ring-1 focus:ring-amber-400/60"
        />
        <button
          type="button"
          disabled={busy || !code.trim()}
          onClick={() => onSubmitOtp(pack.jobId, code)}
          className="rounded-xl bg-amber-500 px-3 py-1.5 text-[11px] font-semibold text-slate-950 shadow-md transition hover:bg-amber-400 disabled:opacity-50"
        >
          Submit OTP
        </button>
      </div>

      <div className="mt-3 flex items-center justify-between pt-2 border-t border-white/[0.06] text-[10px]">
        <button
          type="button"
          onClick={() => onFocusTab(pack)}
          className="text-sky-300 hover:text-sky-200 transition"
        >
          ↗ Focus tab
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => onDismiss(pack.jobId)}
          className="text-slate-400 hover:text-rose-300 transition"
        >
          Dismiss
        </button>
      </div>
    </article>
  );
}

function CaptchaCard({
  pack,
  onResume,
  onFocusTab,
  onDismiss,
  busy,
}: {
  pack: EvidencePack;
  onResume: (id: string) => void;
  onFocusTab: (pack: EvidencePack) => void;
  onDismiss: (id: string) => void;
  busy?: boolean;
}) {
  return (
    <article
      id={`review-captcha-${pack.jobId}`}
      className="group rounded-2xl border border-sky-500/30 bg-gradient-to-b from-sky-500/[0.08] to-indigo-950/[0.05] p-4 transition-all duration-200"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 text-[13px] font-semibold text-sky-200">
            <span>🛡️ CAPTCHA Challenge Detected</span>
          </div>
          <div className="mt-0.5 truncate text-[11px] text-slate-300">{pack.company}</div>
        </div>
        <span className="inline-flex items-center gap-1 rounded-full bg-sky-400/10 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-sky-300 ring-1 ring-sky-400/30">
          Human Pause
        </span>
      </div>

      <p className="mt-2 text-[11px] leading-relaxed text-slate-300">
        A security challenge (Cloudflare / reCAPTCHA) was detected. Switch to the tab to complete it, then click Resume.
      </p>

      <div className="mt-3 flex gap-2">
        <button
          type="button"
          onClick={() => onFocusTab(pack)}
          className="flex-1 rounded-xl bg-sky-500/20 border border-sky-400/30 px-3 py-2 text-[11px] font-semibold text-sky-200 shadow-md transition hover:bg-sky-500/30"
        >
          ↗ Open / Focus Tab
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => onResume(pack.jobId)}
          className="flex-1 rounded-xl bg-emerald-500 px-3 py-2 text-[11px] font-semibold text-white shadow-md transition hover:bg-emerald-400 disabled:opacity-50"
        >
          ✅ I Solved It — Resume
        </button>
      </div>

      <div className="mt-2.5 flex justify-end text-[10px]">
        <button
          type="button"
          disabled={busy}
          onClick={() => onDismiss(pack.jobId)}
          className="text-slate-400 hover:text-rose-300 transition"
        >
          Dismiss
        </button>
      </div>
    </article>
  );
}

/* ------------------------------------------------------------------ */
/* ReviewQueuePanel                                                      */
/* ------------------------------------------------------------------ */

export function ReviewQueuePanel() {
  const [queue, setQueue] = useState<EvidencePack[]>([]);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState<Record<string, "approving" | "rejecting">>({});
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout>>();

  const showToast = (msg: string) => {
    setToastMsg(msg);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToastMsg(null), 3500);
  };

  const refresh = useCallback(async () => {
    setLoading(true);
    const q = await loadQueue();
    setQueue(q);
    setLoading(false);
  }, []);

  useEffect(() => {
    void refresh();

    // Subscribe to chrome.storage changes
    const handler = (changes: Record<string, chrome.storage.StorageChange>) => {
      if (REVIEW_QUEUE_KEY in changes) void refresh();
    };
    chrome.storage.onChanged.addListener(handler);

    // Also poll every 30s (in case another tab updated queue)
    const interval = setInterval(refresh, 30_000);
    return () => {
      chrome.storage.onChanged.removeListener(handler);
      clearInterval(interval);
    };
  }, [refresh]);

  const handleApprove = async (jobId: string) => {
    setActing((prev) => ({ ...prev, [jobId]: "approving" }));
    try {
      // Tell background to actually submit this application
      await chrome.runtime.sendMessage({
        type: "SJA:REVIEW_DECISION",
        payload: { jobId, decision: "approved" },
      }).then((response) => {
        if (response?.ok !== true) {
          throw new Error(response?.error || "The background did not confirm approval.");
        }
      });

      await updateQueueItem(jobId, "approved");
      showToast("✅ Application approved — submitting now");
      void refresh();
    } catch (e) {
      showToast(`Error: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setActing((prev) => {
        const next = { ...prev };
        delete next[jobId];
        return next;
      });
    }
  };

  const handleOtpSubmit = async (jobId: string, otpCode: string) => {
    if (!otpCode.trim()) {
      showToast("Please enter the verification code");
      return;
    }
    setActing((prev) => ({ ...prev, [jobId]: "approving" }));
    try {
      await chrome.runtime.sendMessage({
        type: "SJA:REVIEW_DECISION",
        payload: { jobId, decision: "submit_otp", otpCode: otpCode.trim() },
      }).then((response) => {
        if (response?.ok !== true) {
          throw new Error(response?.error || "The background did not confirm OTP delivery.");
        }
      });

      await updateQueueItem(jobId, "approved");
      showToast("📱 OTP forwarded to page");
      void refresh();
    } catch (e) {
      showToast(`Error: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setActing((prev) => {
        const next = { ...prev };
        delete next[jobId];
        return next;
      });
    }
  };

  const handleResume = async (jobId: string) => {
    setActing((prev) => ({ ...prev, [jobId]: "approving" }));
    try {
      await chrome.runtime.sendMessage({
        type: "SJA:REVIEW_DECISION",
        payload: { jobId, decision: "resume" },
      }).then((response) => {
        if (response?.ok !== true) {
          throw new Error(response?.error || "The background did not confirm the resume request.");
        }
      });

      await updateQueueItem(jobId, "approved");
      showToast("▶ Resumed application");
      void refresh();
    } catch (e) {
      showToast(`Error: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setActing((prev) => {
        const next = { ...prev };
        delete next[jobId];
        return next;
      });
    }
  };

  const handleFocusTab = async (pack: EvidencePack) => {
    if (pack.tabId) {
      try {
        await chrome.tabs.update(pack.tabId, { active: true });
        return;
      } catch {}
    }
    const url = pack.jobUrl;
    if (url && /^https?:/.test(url)) {
      await chrome.tabs.create({ url, active: true });
    }
  };

  const handleReject = async (jobId: string) => {
    setActing((prev) => ({ ...prev, [jobId]: "rejecting" }));
    try {
      await updateQueueItem(jobId, "rejected");
      showToast("❌ Application rejected");
      void refresh();
    } catch (e) {
      showToast(`Error: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setActing((prev) => {
        const next = { ...prev };
        delete next[jobId];
        return next;
      });
    }
  };

  // --- Empty state ---
  if (!loading && queue.length === 0) {
    return (
      <div className="flex min-h-[280px] flex-col items-center justify-center gap-4 text-center">
        {/* Animated checkmark icon */}
        <div className="relative grid h-16 w-16 place-items-center rounded-2xl bg-gradient-to-br from-emerald-500/20 to-violet-500/20 ring-1 ring-white/10">
          <svg className="h-8 w-8 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span className="absolute -right-1 -top-1 h-3 w-3 animate-ping rounded-full bg-emerald-400/60" />
        </div>
        <div>
          <div className="text-[14px] font-semibold text-slate-200">Review queue is clear</div>
          <p className="mt-1 max-w-[220px] text-[11px] leading-relaxed text-slate-500">
            Applications with ≥90% confidence are auto-submitted. Medium-confidence ones will appear here for your approval.
          </p>
        </div>
        <button
          type="button"
          onClick={refresh}
          className="rounded-lg border border-white/10 bg-white/[0.04] px-3 py-1.5 text-[11px] font-medium text-slate-400 transition hover:bg-white/[0.08] hover:text-slate-200"
        >
          Refresh
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">Review Queue</h2>
          {!loading && (
            <p className="mt-0.5 text-[11px] text-slate-400">
              {queue.length} application{queue.length !== 1 ? "s" : ""} awaiting your decision
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={refresh}
          disabled={loading}
          className="rounded-lg border border-white/[0.08] bg-white/[0.04] p-1.5 text-slate-400 transition hover:bg-white/[0.08] hover:text-slate-200 disabled:opacity-50"
          aria-label="Refresh review queue"
        >
          <svg className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
          </svg>
        </button>
      </div>

      {/* Explain the tiers */}
      <div className="grid grid-cols-3 gap-1.5 rounded-xl bg-white/[0.03] p-2.5 ring-1 ring-white/[0.06]">
        {[
          { color: "bg-emerald-400", label: "≥90%", desc: "Auto-submit" },
          { color: "bg-amber-400", label: "55-90%", desc: "Review" },
          { color: "bg-rose-400", label: "<55%", desc: "Rejected" },
        ].map(({ color, label, desc }) => (
          <div key={label} className="flex flex-col items-center gap-1 text-center">
            <div className={`h-1.5 w-8 rounded-full ${color}`} />
            <div className="text-[10px] font-semibold text-slate-300">{label}</div>
            <div className="text-[9px] text-slate-500">{desc}</div>
          </div>
        ))}
      </div>

      {/* Loading skeleton */}
      {loading && (
        <div className="space-y-3">
          {[1, 2].map((i) => (
            <div key={i} className="h-36 animate-pulse rounded-2xl bg-white/[0.04] ring-1 ring-white/[0.06]" />
          ))}
        </div>
      )}

      {/* Evidence Pack Cards */}
      {!loading && (
        <ul className="space-y-3" role="list">
          {queue.map((pack) => (
            <li key={pack.jobId}>
              {pack.reviewType === "otp" ? (
                <OtpCard
                  pack={pack}
                  onSubmitOtp={handleOtpSubmit}
                  onFocusTab={handleFocusTab}
                  onDismiss={handleReject}
                  busy={acting[pack.jobId] === "approving" || acting[pack.jobId] === "rejecting"}
                />
              ) : pack.reviewType === "captcha" ? (
                <CaptchaCard
                  pack={pack}
                  onResume={handleResume}
                  onFocusTab={handleFocusTab}
                  onDismiss={handleReject}
                  busy={acting[pack.jobId] === "approving" || acting[pack.jobId] === "rejecting"}
                />
              ) : (
                <EvidenceCard
                  pack={pack}
                  onApprove={handleApprove}
                  onReject={handleReject}
                  approving={acting[pack.jobId] === "approving"}
                  rejecting={acting[pack.jobId] === "rejecting"}
                />
              )}
            </li>
          ))}
        </ul>
      )}

      {/* Batch actions */}
      {!loading && queue.length > 1 && (
        <div className="flex gap-2 border-t border-white/[0.06] pt-3">
          <button
            type="button"
            onClick={() => queue.forEach((p) => void handleApprove(p.jobId))}
            className="flex-1 rounded-xl bg-emerald-500/10 px-3 py-2 text-[11px] font-semibold text-emerald-300 ring-1 ring-emerald-400/20 transition hover:bg-emerald-500/20"
          >
            ✅ Approve All ({queue.length})
          </button>
          <button
            type="button"
            onClick={() => queue.forEach((p) => void handleReject(p.jobId))}
            className="flex-1 rounded-xl bg-rose-500/10 px-3 py-2 text-[11px] font-semibold text-rose-300 ring-1 ring-rose-400/20 transition hover:bg-rose-500/20"
          >
            ❌ Reject All
          </button>
        </div>
      )}

      {/* Toast */}
      {toastMsg && (
        <div
          role="alert"
          className="fixed bottom-4 left-1/2 z-50 -translate-x-1/2 rounded-xl border border-white/10 bg-slate-800 px-4 py-2.5 text-[12px] font-medium text-slate-100 shadow-xl ring-1 ring-white/[0.08] animate-in fade-in slide-in-from-bottom-2"
        >
          {toastMsg}
        </div>
      )}
    </div>
  );
}
