import type { DetectResponse, MatchResponse, AutofillResponse } from "@/lib/messaging.js";
import { useEffect, useState } from "react";
import { getAgentSettings, saveAgentSettings, api } from "@/popup/api.js";
import { IconBolt, IconSparkles, IconRocket, IconSearch } from "@/lib/icons.jsx";

/* ─── Helpers ─────────────────────────────────────────────────────── */

function ScoreRing({ score }: { score: number }) {
  const r = 22;
  const circ = 2 * Math.PI * r;
  const color = score >= 80 ? "#34D399" : score >= 60 ? "#FBBF24" : "#FB7185";
  const trackColor = score >= 80 ? "rgba(52,211,153,0.12)" : score >= 60 ? "rgba(251,191,36,0.12)" : "rgba(251,113,133,0.12)";
  return (
    <div style={{ position:"relative", flexShrink:0, display:"flex", alignItems:"center", justifyContent:"center" }}>
      <svg width="52" height="52" viewBox="0 0 52 52" style={{ transform:"rotate(-90deg)", flexShrink:0 }}>
        <circle cx="26" cy="26" r={r} fill="none" stroke={trackColor} strokeWidth="4.5" />
        <circle
          cx="26" cy="26" r={r} fill="none"
          stroke={color} strokeWidth="4.5" strokeLinecap="round"
          strokeDasharray={circ}
          strokeDashoffset={circ * (1 - score / 100)}
          style={{ transition:"stroke-dashoffset 0.7s cubic-bezier(0.22,1,0.36,1)", filter:`drop-shadow(0 0 4px ${color})` }}
        />
      </svg>
      <span style={{ position:"absolute", fontWeight:800, fontSize:"12px", fontFamily:"monospace", color, letterSpacing:"-0.04em" }}>{score}</span>
    </div>
  );
}

function Toggle({ checked, onChange, disabled }: { checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <label className="ent-toggle" style={{ opacity: disabled ? 0.4 : 1, pointerEvents: disabled ? "none" : "auto" }}>
      <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} />
      <div className="ent-toggle-track" />
      <div className="ent-toggle-thumb" />
    </label>
  );
}

/* ─── Main Component ──────────────────────────────────────────────── */

export function ApplyTab({
  detect, match, fillResult, busy, autoApplyBusy, profileReady,
  onAutofill, onRefresh, onAutoApply, onGoSetup,
}: {
  detect: DetectResponse | null;
  match: MatchResponse | null;
  fillResult: AutofillResponse | null;
  busy: boolean;
  autoApplyBusy?: boolean;
  profileReady?: boolean;
  onAutofill: () => void;
  onRefresh: () => void;
  onAutoApply: () => void;
  onGoSetup?: () => void;
}) {
  const platform = detect?.platform
    ? detect.platform.charAt(0).toUpperCase() + detect.platform.slice(1)
    : "Web form";
  const fieldCount = detect?.fields.length ?? 0;
  const hint = detect?.hint;
  const onLinkedIn = /linkedin\.com\/jobs/i.test(detect?.job?.url || (typeof location !== "undefined" ? location.href : ""));

  const [autonomous, setAutonomous] = useState(false);
  const [autoSubmit, setAutoSubmit] = useState(false);
  const [verifyEachStep, setVerifyEachStep] = useState(false);

  useEffect(() => {
    void getAgentSettings().then((s) => {
      setAutonomous(s.autonomousMode);
      setAutoSubmit(s.autoSubmit);
      setVerifyEachStep(s.verifyBeforeAdvance ?? false);
    });
  }, []);

  const toggleSetting = async (patch: Partial<{autonomousMode: boolean; autoSubmit: boolean; verifyBeforeAdvance: boolean}>) => {
    const s = await getAgentSettings();
    const next = { ...s, ...patch };
    await saveAgentSettings(next);
    setAutonomous(next.autonomousMode);
    setAutoSubmit(next.autoSubmit);
    setVerifyEachStep(next.verifyBeforeAdvance ?? false);
  };

  const fieldLabel = fieldCount > 0
    ? `${fieldCount} field${fieldCount === 1 ? "" : "s"} detected`
    : "No job form detected";

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:"10px" }}>

      {/* Hint banner */}
      {hint && fieldCount === 0 && (
        <div style={{ padding:"10px 12px", background:"rgba(245,158,11,0.08)", border:"1px solid rgba(245,158,11,0.20)", borderRadius:"10px", fontSize:"11px", color:"rgba(252,211,77,0.85)", lineHeight:1.5 }}>
          {hint}
        </div>
      )}

      {/* ── Autonomous mode card ── */}
      <div style={{ background:"rgba(99,102,241,0.06)", border:"1px solid rgba(99,102,241,0.18)", borderRadius:"12px", padding:"12px 14px" }}>
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:"10px" }}>
          <div style={{ display:"flex", alignItems:"center", gap:"8px" }}>
            <div style={{ width:26, height:26, borderRadius:"7px", background:"rgba(99,102,241,0.18)", border:"1px solid rgba(99,102,241,0.30)", display:"flex", alignItems:"center", justifyContent:"center" }}>
              <IconSparkles size={13} style={{ color:"#818CF8" }} />
            </div>
            <div>
              <div style={{ fontSize:"12px", fontWeight:700, color:"#fff" }}>Autonomous Mode</div>
              <div style={{ fontSize:"9px", color:"var(--text-faint)", marginTop:"1px" }}>Hands-free end-to-end navigation</div>
            </div>
          </div>
          <Toggle checked={autonomous} onChange={v => void toggleSetting({ autonomousMode: v })} />
        </div>

        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"8px" }}>
          {[
            { label:"Auto-submit final step", sub:"Clicks Submit after last page", checked:autoSubmit, key:"autoSubmit" as const, danger:true },
            { label:"Verify each step", sub:"Preview before advancing", checked:verifyEachStep, key:"verifyBeforeAdvance" as const },
          ].map(item => (
            <div key={item.key} style={{ display:"flex", alignItems:"flex-start", gap:"8px", padding:"8px", background:"rgba(255,255,255,0.03)", border:"1px solid rgba(255,255,255,0.07)", borderRadius:"8px" }}>
              <Toggle checked={item.checked} onChange={v => void toggleSetting({ [item.key]: v })} disabled={!autonomous} />
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontSize:"10px", fontWeight:600, color: item.danger ? "#FB7185" : "var(--text-secondary)", lineHeight:1.2 }}>{item.label}</div>
                <div style={{ fontSize:"9px", color:"var(--text-faint)", marginTop:"2px" }}>{item.sub}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Auto-apply CTA */}
        <button
          onClick={profileReady ? onAutoApply : (onGoSetup ?? onAutoApply)}
          disabled={!!autoApplyBusy}
          style={{
            marginTop:"10px", width:"100%",
            background: autoApplyBusy ? "rgba(99,102,241,0.30)" : "linear-gradient(135deg, #4F46E5, #8B5CF6)",
            color:"#fff", border:"none", borderRadius:"10px",
            padding:"9px 14px", fontSize:"12px", fontWeight:700,
            display:"flex", alignItems:"center", justifyContent:"center", gap:"7px",
            cursor: autoApplyBusy ? "not-allowed" : "pointer",
            boxShadow: autoApplyBusy ? "none" : "0 4px 16px rgba(99,102,241,0.35)",
            transition:"all 0.2s",
            opacity: autoApplyBusy ? 0.75 : 1,
          }}
        >
          {autoApplyBusy ? (
            <>
              <div style={{ width:13, height:13, borderRadius:"50%", border:"2px solid rgba(255,255,255,0.35)", borderTopColor:"#fff" }} className="animate-spin" />
              Autonomous agent running…
            </>
          ) : !profileReady ? (
            <><IconBolt size={13} /> Manage profile on dashboard</>
          ) : onLinkedIn ? (
            <><IconSparkles size={13} /> Auto-apply this LinkedIn job</>
          ) : (
            <><IconSparkles size={13} /> Start autonomous apply</>
          )}
        </button>
        <div style={{ fontSize:"9px", color:"var(--text-faint)", marginTop:"6px", lineHeight:1.5 }}>
          Opens Easy Apply, fills each field, advances steps, and (if enabled) submits with a 3-second countdown.
        </div>
      </div>

      {/* ── Fleet: Apply to 10 jobs at once ── */}
      <button
        type="button"
        onClick={() => { void api.openSidePanel("fleet"); }}
        style={{
          width:"100%", display:"flex", alignItems:"center", gap:"12px",
          background:"rgba(139,92,246,0.07)", border:"1px solid rgba(139,92,246,0.22)",
          borderRadius:"12px", padding:"10px 14px", textAlign:"left",
          cursor:"pointer", transition:"all 0.2s",
        }}
        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "rgba(139,92,246,0.12)"; }}
        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "rgba(139,92,246,0.07)"; }}
      >
        <div style={{ width:36, height:36, borderRadius:"10px", background:"linear-gradient(135deg, rgba(139,92,246,0.30), rgba(99,102,241,0.30))", border:"1px solid rgba(139,92,246,0.35)", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
          <IconRocket size={16} style={{ color:"#A78BFA" }} />
        </div>
        <div style={{ flex:1 }}>
          <div style={{ fontSize:"12px", fontWeight:700, color:"#C4B5FD" }}>Apply to 10 jobs at once →</div>
          <div style={{ fontSize:"10px", color:"rgba(196,181,253,0.60)", marginTop:"2px", lineHeight:1.4 }}>Fleet finds roles, tailors a fresh resume per job in parallel. Master resume untouched.</div>
        </div>
        <span className="badge badge-ind" style={{ fontSize:"9px", flexShrink:0 }}>Fleet</span>
      </button>

      {/* ── Active page card ── */}
      <div style={{ background:"rgba(255,255,255,0.03)", border:"1px solid rgba(255,255,255,0.08)", borderRadius:"12px", padding:"12px 14px" }}>
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:"8px" }}>
          <div style={{ display:"flex", alignItems:"center", gap:"6px" }}>
            <div className="live-dot" style={{ width:6, height:6, background: fieldCount > 0 ? "var(--em-400)" : "rgba(255,255,255,0.25)" }} />
            <span style={{ fontSize:"10px", fontWeight:700, color:"var(--text-muted)", textTransform:"uppercase", letterSpacing:"0.06em" }}>{platform}</span>
          </div>
          <button onClick={onRefresh} style={{ fontSize:"10px", color:"var(--text-faint)", cursor:"pointer", background:"none", border:"none", display:"flex", alignItems:"center", gap:"4px" }}>
            <IconSearch size={10} /> refresh
          </button>
        </div>
        <div style={{ fontSize:"13px", fontWeight:700, color:"var(--text-primary)", whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>
          {detect?.job?.title || "Open a job application page"}
        </div>
        <div style={{ fontSize:"11px", color:"var(--text-muted)", marginTop:"2px", whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>
          {detect?.job?.company || "Navigate to LinkedIn, Greenhouse, Workday…"}
        </div>
        <div style={{ marginTop:"8px", display:"flex", alignItems:"center", gap:"8px" }}>
          <span className={`badge ${fieldCount > 0 ? "badge-em" : "badge-slate"}`}>
            {fieldLabel}
          </span>
          {detect?.job?.url && (
            <a href={detect.job.url} target="_blank" rel="noreferrer" style={{ fontSize:"9px", color:"var(--text-faint)", textDecoration:"underline" }}>Open</a>
          )}
        </div>
      </div>

      {/* ── Match score ring ── */}
      {match && match.score > 0 && (
        <div style={{ background:"rgba(255,255,255,0.03)", border:"1px solid rgba(255,255,255,0.08)", borderRadius:"12px", padding:"12px 14px" }} className="animate-rise">
          <div style={{ display:"flex", alignItems:"center", gap:"12px" }}>
            <ScoreRing score={match.score} />
            <div style={{ flex:1 }}>
              <div style={{ fontSize:"12px", fontWeight:700, color:"var(--text-primary)", marginBottom:"4px" }}>Resume match score</div>
              <div style={{ fontSize:"11px", display:"flex", gap:"8px" }}>
                <span style={{ color:"#34D399", fontWeight:600 }}>↑ {match.matched.length} matched</span>
                <span style={{ color:"var(--text-faint)" }}>·</span>
                <span style={{ color:"#FB7185", fontWeight:600 }}>↓ {match.missing.length} missing</span>
              </div>
            </div>
          </div>
          {match.missing.length > 0 && (
            <div style={{ marginTop:"10px", display:"flex", flexWrap:"wrap", gap:"4px" }}>
              {match.missing.slice(0, 10).map(m => (
                <span key={m} className="badge badge-rose" style={{ fontSize:"9px" }}>{m}</span>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Autofill + side panel ── */}
      <div style={{ display:"grid", gridTemplateColumns:"1fr auto", gap:"8px" }}>
        <button
          onClick={onAutofill}
          disabled={busy}
          className="btn-primary"
          style={{ justifyContent:"center", padding:"9px 14px", fontSize:"12px" }}
        >
          {busy ? (
            <>
              <div style={{ width:13, height:13, borderRadius:"50%", border:"2px solid rgba(255,255,255,0.35)", borderTopColor:"#fff" }} className="animate-spin" />
              Auto-filling fields…
            </>
          ) : (
            <>
              <IconBolt size={13} />
              Auto-fill{fieldCount ? ` ${fieldCount} field${fieldCount === 1 ? "" : "s"}` : " page"}
            </>
          )}
        </button>
        <button
          onClick={() => import("@/popup/api.js").then(({ api: a }) => a.openSidePanel()).catch(() => {})}
          title="Open persistent side panel (Alt+Shift+A)"
          className="btn-secondary"
          style={{ padding:"9px 12px", whiteSpace:"nowrap" }}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="2" /><path d="M15 3v18" /></svg>
          Side panel
        </button>
      </div>

      {/* ── Fill result ── */}
      {fillResult && (
        <div style={{ background:"rgba(16,185,129,0.06)", border:"1px solid rgba(16,185,129,0.18)", borderRadius:"12px", padding:"12px 14px" }} className="animate-rise">
          <div style={{ display:"flex", gap:"10px", alignItems:"center", marginBottom:"8px" }}>
            <div style={{ display:"flex", alignItems:"center", gap:"6px" }}>
              <span className="badge badge-em" style={{ fontSize:"10px" }}>✓ {fillResult.filled} filled</span>
            </div>
            {fillResult.skipped > 0 && <span style={{ fontSize:"10px", color:"var(--text-faint)" }}>{fillResult.skipped} skipped</span>}
            {fillResult.aiAnswered > 0 && <span className="badge badge-ind" style={{ fontSize:"10px" }}>✦ {fillResult.aiAnswered} AI answers</span>}
          </div>
          <div style={{ display:"flex", flexDirection:"column", gap:"2px", maxHeight:"120px", overflowY:"auto" }}>
            {(fillResult.details ?? []).map((d, i) => (
              <div key={i} style={{ display:"flex", alignItems:"center", gap:"8px", padding:"4px 0", borderBottom:"1px solid rgba(255,255,255,0.04)" }}>
                <span style={{ fontSize:"10px", fontWeight:700, color: d.ok ? "#34D399" : "rgba(255,255,255,0.20)", flexShrink:0 }}>{d.ok ? "✓" : "·"}</span>
                <span style={{ fontSize:"10px", color:"var(--text-secondary)", fontWeight:500, flex:1, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{d.label || "(unlabeled)"}</span>
                <span style={{ fontSize:"9px", color:"var(--text-faint)", fontFamily:"monospace", whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis", maxWidth:"80px" }}>{d.value}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
