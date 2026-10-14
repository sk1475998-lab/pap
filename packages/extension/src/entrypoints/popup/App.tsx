import { useCallback, useEffect, useState } from "react";
import { api } from "@/popup/api.js";
import type { DetectResponse, AutofillResponse, MatchResponse } from "@/lib/messaging.js";
import type { Profile } from "@superjob/core";
import { createProfile, validateProfile } from "@superjob/core";
import { ApplyTab } from "@/popup/tabs/ApplyTab.js";
import { ProfileTab } from "@/popup/tabs/ProfileTab.js";
import { SettingsTab } from "@/popup/tabs/SettingsTab.js";
import { TrackerTab } from "@/popup/tabs/TrackerTab.js";
import { CampaignsTab } from "@/popup/tabs/CampaignsTab.js";
import { IntelligenceTab } from "@/popup/tabs/IntelligenceTab.js";
import { AtsTab } from "@/popup/tabs/AtsTab.js";
import { RecommendedTab } from "@/popup/tabs/RecommendedTab.js";
import { getProfileFromStore, getLlmStatus, type LlmStatus } from "@/popup/api.js";
import {
  IconBolt, IconTarget, IconUser, IconList, IconBuilding,
  IconBrain, IconRocket, IconSettings, IconRefresh, IconBrandLogo,
  IconSparkles,
} from "@/lib/icons.jsx";
import type { ComponentType } from "react";

type TabId = "apply" | "profile" | "recommended" | "ats" | "intelligence" | "settings" | "tracker" | "campaigns";

const TABS: { id: TabId; label: string; icon: ComponentType<{size?:number}>; tooltip: string }[] = [
  { id: "apply",        label: "Apply",     icon: IconBolt,     tooltip: "Active Form Autofill" },
  { id: "recommended",  label: "Jobs",       icon: IconTarget,   tooltip: "AI Job Discovery" },
  { id: "profile",      label: "Profile",    icon: IconUser,     tooltip: "Career Identity" },
  { id: "tracker",      label: "Tracker",    icon: IconList,     tooltip: "Application Pipeline" },
  { id: "ats",          label: "ATS Score",  icon: IconBuilding, tooltip: "Resume ATS Analysis" },
  { id: "intelligence", label: "Intel",      icon: IconBrain,    tooltip: "Career Intelligence" },
  { id: "campaigns",    label: "Campaigns",  icon: IconRocket,   tooltip: "Multi-Portal Campaigns" },
  { id: "settings",     label: "Settings",   icon: IconSettings, tooltip: "Configuration" },
];

function ScorePill({ score }: { score: number }) {
  const em = "rgba(52,211,153,0.08)", amb = "rgba(251,191,36,0.08)", rose = "rgba(251,113,133,0.08)";
  const bg = score >= 80 ? em : score >= 60 ? amb : rose;
  const col = score >= 80 ? "#34D399" : score >= 60 ? "#FBBF24" : "#FB7185";
  const bdr = score >= 80 ? "rgba(52,211,153,0.28)" : score >= 60 ? "rgba(251,191,36,0.28)" : "rgba(251,113,133,0.28)";
  return (
    <div style={{ display:"flex", alignItems:"center", gap:"5px", background: bg, border: `1px solid ${bdr}`, borderRadius:"8px", padding:"3px 8px" }}>
      <span style={{ fontSize:"9px", fontWeight:700, textTransform:"uppercase", letterSpacing:"0.06em", color: col, opacity: 0.7 }}>Match</span>
      <span style={{ fontSize:"14px", fontWeight:900, fontFamily:"monospace", color: col, lineHeight:1 }}>{score}<span style={{ fontSize:"9px", opacity:0.6 }}>%</span></span>
    </div>
  );
}

function AgentStatusOrb({ llmStatus, profileReady, busy }: { llmStatus: LlmStatus | null; profileReady: boolean; busy: boolean }) {
  if (busy) return (
    <div style={{ display:"flex", alignItems:"center", gap:"6px" }}>
      <div style={{ width:7, height:7, borderRadius:"50%", background:"#A78BFA" }} className="animate-blink" />
      <span style={{ fontSize:"10px", color:"#A78BFA", fontWeight:600 }}>Agent active</span>
    </div>
  );
  if (llmStatus?.configured && profileReady) return (
    <div style={{ display:"flex", alignItems:"center", gap:"6px" }}>
      <div className="live-dot" />
      <span style={{ fontSize:"10px", color:"#34D399", fontWeight:600 }}>AI ready</span>
    </div>
  );
  if (!llmStatus?.configured) return (
    <div style={{ display:"flex", alignItems:"center", gap:"6px" }}>
      <div style={{ width:7, height:7, borderRadius:"50%", background:"#FCD34D", opacity:0.8 }} />
      <span style={{ fontSize:"10px", color:"#FCD34D", fontWeight:600 }}>AI offline</span>
    </div>
  );
  return null;
}

export default function App() {
  const [tab, setTab] = useState<TabId>("apply");
  const [detect, setDetect] = useState<DetectResponse | null>(null);
  const [match, setMatch] = useState<MatchResponse | null>(null);
  const [fillResult, setFillResult] = useState<AutofillResponse | null>(null);
  const [busy, setBusy] = useState(false);
  const [autoApplyBusy, setAutoApplyBusy] = useState(false);
  const [error, setError] = useState("");
  const [profileReady, setProfileReady] = useState(false);
  const [llmStatus, setLlmStatus] = useState<LlmStatus | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const checkProfile = async () => {
    try {
      const raw = await getProfileFromStore<Profile>();
      if (!raw) { setProfileReady(false); return; }
      const p = createProfile(raw);
      setProfileReady(validateProfile(p).complete);
    } catch { setProfileReady(false); }
  };

  const checkLlm = useCallback(async () => {
    try { setLlmStatus(await getLlmStatus()); } catch { /* keep prior */ }
  }, []);

  const refresh = useCallback(async () => {
    try {
      setError(""); setRefreshing(true);
      const [d, m] = await Promise.all([api.detect().catch(() => null), api.match().catch(() => null)]);
      setDetect(d); setMatch(m);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally { setTimeout(() => setRefreshing(false), 400); }
  }, []);

  useEffect(() => { void checkProfile(); void refresh(); void checkLlm(); }, [checkLlm]);
  useEffect(() => { if (tab === "apply") void refresh(); void checkLlm(); }, [tab, refresh, checkLlm]);

  const doAutofill = async () => {
    if (!profileReady) { setError("Complete your profile first."); setTab("profile"); return; }
    setBusy(true); setError("");
    try { const res = await api.autofill(); setFillResult(res); await refresh(); }
    catch (e) { setError(e instanceof Error ? e.message : "Could not reach the page. Open a job application and retry."); }
    finally { setBusy(false); }
  };

  const doAutoApply = async () => {
    if (!profileReady) { setError("Complete your profile first."); setTab("profile"); return; }
    setAutoApplyBusy(true); setError("");
    try {
      const { getAgentSettings: ga, saveAgentSettings: sa } = await import("@/popup/api.js");
      const cur = await ga();
      await sa({ ...cur, autonomousMode: true, autoClickEasyApply: true, autoFillSteps: true, autoAdvanceSteps: true });
      await api.startAutoApply();
      setTimeout(() => void refresh(), 1200);
      setTimeout(() => { setAutoApplyBusy(false); }, 2500);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not start auto-apply.");
      setAutoApplyBusy(false);
    }
  };

  const isBusy = busy || autoApplyBusy;

  // ─── Sidebar nav sections ─────────────────────────────────────────
  const renderNav = (ids: TabId[]) => (
    <div style={{ display:"flex", flexDirection:"column", gap:"1px" }}>
      {ids.map((id) => {
        const t = TABS.find(x => x.id === id)!;
        const active = tab === t.id;
        const Icon = t.icon;
        return (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            data-tooltip={t.tooltip}
            className={`nav-item${active ? " active" : ""}`}
          >
            <Icon size={14} />
            <span>{t.label}</span>
            {t.id === "apply" && detect?.fields && detect.fields.length > 0 && (
              <span style={{ marginLeft:"auto", fontSize:"9px", fontWeight:700, color:"#818CF8", background:"rgba(99,102,241,0.15)", borderRadius:"4px", padding:"1px 5px" }}>
                {detect.fields.length}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );

  return (
    <div style={{ display:"flex", height:"580px", width:"780px", background:"var(--bg-base)", color:"var(--text-primary)", overflow:"hidden", fontFamily:"var(--font-sans)", position:"relative" }}>

      {/* ── Ambient orbs ── */}
      <div aria-hidden style={{ position:"absolute", top:-60, left:-40, width:240, height:240, borderRadius:"50%", background:"radial-gradient(circle, rgba(99,102,241,0.07) 0%, transparent 70%)", pointerEvents:"none", zIndex:0 }} />
      <div aria-hidden style={{ position:"absolute", bottom:-80, right:60, width:200, height:200, borderRadius:"50%", background:"radial-gradient(circle, rgba(139,92,246,0.06) 0%, transparent 70%)", pointerEvents:"none", zIndex:0 }} />

      {/* ═══ SIDEBAR ═══ */}
      <aside style={{ width:"172px", background:"rgba(5,8,16,0.96)", borderRight:"1px solid rgba(255,255,255,0.07)", display:"flex", flexDirection:"column", flexShrink:0, zIndex:1, position:"relative" }}>

        {/* Brand */}
        <div style={{ padding:"14px 12px 12px", borderBottom:"1px solid rgba(255,255,255,0.07)", position:"relative", overflow:"hidden" }}>
          <div aria-hidden style={{ position:"absolute", top:-16, right:-16, width:80, height:80, borderRadius:"50%", background:"radial-gradient(circle, rgba(99,102,241,0.32) 0%, transparent 70%)", pointerEvents:"none" }} />
          <div style={{ display:"flex", alignItems:"center", gap:"10px", position:"relative" }}>
            <div style={{ flexShrink:0, filter:"drop-shadow(0 0 8px rgba(99,102,241,0.55))" }}>
              <IconBrandLogo size={30} />
            </div>
            <div>
              <div style={{ display:"flex", alignItems:"center", gap:"5px" }}>
                <span style={{ fontSize:"13px", fontWeight:800, letterSpacing:"-0.02em", color:"#fff", lineHeight:1 }}>SuperJob</span>
                <span style={{ fontSize:"8px", fontWeight:800, color:"#A78BFA", background:"rgba(167,139,250,0.14)", border:"1px solid rgba(167,139,250,0.28)", padding:"1px 5px", borderRadius:"4px", letterSpacing:"0.04em" }}>AI</span>
              </div>
              <div style={{ fontSize:"9px", color:"rgba(148,163,184,0.55)", marginTop:"2px", letterSpacing:"0.02em" }}>Autonomous Copilot</div>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav style={{ flex:1, padding:"8px", overflowY:"auto" }}>
          <div className="section-label" style={{ marginTop:"4px" }}>Workspace</div>
          {renderNav(["apply", "recommended", "profile", "tracker"])}
          <div className="section-label">Analytics</div>
          {renderNav(["ats", "intelligence", "campaigns"])}
          <div className="section-label">System</div>
          {renderNav(["settings"])}
        </nav>

        {/* Sidebar footer */}
        <div style={{ padding:"10px 10px 12px", borderTop:"1px solid rgba(255,255,255,0.07)", display:"flex", flexDirection:"column", gap:"8px" }}>
          <div>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"4px" }}>
              <span style={{ fontSize:"9px", color:"var(--text-faint)", fontWeight:600, letterSpacing:"0.06em", textTransform:"uppercase" }}>Profile</span>
              <span style={{ fontSize:"9px", fontWeight:700, color: profileReady ? "#34D399" : "#FCD34D" }}>
                {profileReady ? "● Ready" : "◐ Setup needed"}
              </span>
            </div>
            <div className="ent-progress">
              <div className="ent-progress-fill" style={{ width: profileReady ? "100%" : "30%", background: profileReady ? "linear-gradient(90deg,#10B981,#34D399)" : "linear-gradient(90deg,#F59E0B,#FCD34D)" }} />
            </div>
          </div>
          <AgentStatusOrb llmStatus={llmStatus} profileReady={profileReady} busy={isBusy} />
        </div>
      </aside>

      {/* ═══ MAIN PANEL ═══ */}
      <section style={{ flex:1, display:"flex", flexDirection:"column", minWidth:0, background:"var(--bg-surface)", position:"relative", zIndex:1 }}>

        {/* Top bar */}
        <header style={{ height:"44px", borderBottom:"1px solid rgba(255,255,255,0.07)", padding:"0 16px", display:"flex", alignItems:"center", justifyContent:"space-between", flexShrink:0, background:"rgba(5,8,16,0.72)", backdropFilter:"blur(12px)", WebkitBackdropFilter:"blur(12px)" }}>
          {/* Breadcrumb */}
          <div style={{ display:"flex", alignItems:"center", gap:"6px" }}>
            <span style={{ fontSize:"10px", color:"var(--text-faint)", fontWeight:500 }}>SuperJobAgent</span>
            <span style={{ fontSize:"10px", color:"rgba(255,255,255,0.18)" }}>/</span>
            <span style={{ fontSize:"11px", color:"var(--text-secondary)", fontWeight:600, textTransform:"capitalize" }}>
              {TABS.find(t => t.id === tab)?.label ?? tab}
            </span>
            {detect?.platform && (
              <>
                <span style={{ fontSize:"10px", color:"rgba(255,255,255,0.18)" }}>/</span>
                <span className="badge badge-ind" style={{ fontSize:"9px", textTransform:"capitalize" }}>{detect.platform}</span>
              </>
            )}
          </div>
          {/* Right controls */}
          <div style={{ display:"flex", alignItems:"center", gap:"8px" }}>
            {match && profileReady && <ScorePill score={match.score} />}
            <button
              onClick={() => chrome.tabs.create({ url: "http://localhost:5173" }).catch(() => {})}
              className="btn-primary"
              style={{ padding:"4px 10px", fontSize:"10px", display:"flex", alignItems:"center", gap:"4px" }}
              title="Open full React Web Dashboard"
            >
              Dashboard ↗
            </button>
            <button onClick={refresh} disabled={refreshing} className="btn-ghost" style={{ padding:"4px 8px", fontSize:"10px" }}>
              <IconRefresh size={11} className={refreshing ? "animate-spin" : ""} />
              {refreshing ? "Syncing…" : "Refresh"}
            </button>
          </div>
        </header>

        {/* Content canvas */}
        <main style={{ flex:1, overflowY:"auto", padding:"14px", position:"relative" }}>

          {/* Agent running banner */}
          {isBusy && (
            <div className="animate-rise" style={{ marginBottom:"12px", borderRadius:"12px", border:"1px solid rgba(139,92,246,0.28)", background:"linear-gradient(135deg, rgba(9,6,27,0.98), rgba(15,10,42,0.98))", padding:"12px 14px", position:"relative", overflow:"hidden" }}>
              <div aria-hidden style={{ position:"absolute", inset:0, background:"repeating-linear-gradient(90deg, transparent 0, transparent 6px, rgba(99,102,241,0.025) 6px, rgba(99,102,241,0.025) 7px)", pointerEvents:"none" }} />
              <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:"8px" }}>
                <div style={{ display:"flex", alignItems:"center", gap:"8px" }}>
                  <div style={{ width:24, height:24, borderRadius:"6px", background:"rgba(139,92,246,0.20)", border:"1px solid rgba(139,92,246,0.32)", display:"flex", alignItems:"center", justifyContent:"center" }}>
                    <IconSparkles size={12} style={{ color:"#A78BFA" }} />
                  </div>
                  <div>
                    <div style={{ fontSize:"12px", fontWeight:700, color:"#fff", lineHeight:1 }}>Autonomous Agent Running</div>
                    <div style={{ fontSize:"10px", color:"rgba(167,139,250,0.68)", marginTop:"2px" }}>Navigating ATS fields · resolving shadow DOM · validating constraints</div>
                  </div>
                </div>
                <span className="badge badge-em" style={{ fontSize:"9px" }}>~45s</span>
              </div>
              <div className="ent-progress">
                <div className="ent-progress-fill shimmer-bar" style={{ width:"82%" }} />
              </div>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="animate-rise" style={{ marginBottom:"10px", display:"flex", alignItems:"flex-start", gap:"10px", background:"rgba(244,63,94,0.08)", border:"1px solid rgba(244,63,94,0.20)", borderRadius:"10px", padding:"10px 12px" }}>
              <div style={{ width:18, height:18, borderRadius:"50%", background:"rgba(244,63,94,0.22)", border:"1px solid rgba(244,63,94,0.38)", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0, marginTop:"1px", fontSize:"10px", fontWeight:900, color:"#FB7185" }}>!</div>
              <span style={{ fontSize:"11px", color:"#FCA5A5", lineHeight:1.5 }}>{error}</span>
            </div>
          )}

          {/* AI offline */}
          {llmStatus && !llmStatus.configured && tab !== "settings" && !isBusy && (
            <div className="animate-rise" style={{ marginBottom:"10px", display:"flex", alignItems:"flex-start", gap:"10px", background:"rgba(245,158,11,0.07)", border:"1px solid rgba(245,158,11,0.18)", borderRadius:"10px", padding:"10px 12px" }}>
              <div style={{ width:20, height:20, borderRadius:"6px", background:"rgba(245,158,11,0.18)", border:"1px solid rgba(245,158,11,0.28)", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0, fontSize:"9px", fontWeight:900, color:"#FCD34D" }}>AI</div>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontSize:"11px", fontWeight:700, color:"#FCD34D", marginBottom:"2px" }}>AI brain offline</div>
                <p style={{ fontSize:"10px", color:"rgba(252,211,77,0.68)", lineHeight:1.5 }}>{llmStatus.reason}</p>
              </div>
              <button onClick={() => chrome.tabs.create({ url: "http://localhost:5173/settings" }).catch(() => setTab("settings"))} style={{ flexShrink:0, alignSelf:"center", padding:"5px 10px", borderRadius:"6px", background:"rgba(245,158,11,0.16)", border:"1px solid rgba(245,158,11,0.28)", color:"#FCD34D", fontSize:"10px", fontWeight:700, cursor:"pointer" }}>
                Configure in Dashboard →
              </button>
            </div>
          )}

          {/* Profile nudge */}
          {tab === "apply" && !profileReady && !isBusy && (
            <div className="animate-rise" style={{ marginBottom:"10px", borderRadius:"12px", border:"1px solid rgba(99,102,241,0.22)", background:"linear-gradient(135deg, rgba(10,15,30,0.95), rgba(15,10,42,0.95))", padding:"12px 14px", position:"relative", overflow:"hidden" }}>
              <div aria-hidden style={{ position:"absolute", top:0, right:0, width:100, height:100, borderRadius:"50%", background:"radial-gradient(circle, rgba(99,102,241,0.14) 0%, transparent 70%)", pointerEvents:"none" }} />
              <div style={{ display:"flex", alignItems:"flex-start", gap:"10px" }}>
                <div style={{ width:32, height:32, borderRadius:"10px", background:"rgba(99,102,241,0.18)", border:"1px solid rgba(99,102,241,0.32)", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
                  <IconBolt size={15} style={{ color:"#818CF8" }} />
                </div>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:"12px", fontWeight:700, color:"#fff", marginBottom:"4px" }}>Launch Autonomous Copilot</div>
                  <p style={{ fontSize:"10px", color:"rgba(148,163,184,0.78)", lineHeight:1.6, marginBottom:"10px" }}>
                    Manage your profile and master resume on the web dashboard. The extension uses the synced profile for ATS autofill and application workflows.
                  </p>
                  <div style={{ display:"flex", gap:"8px" }}>
                    <button className="btn-primary" style={{ fontSize:"11px", padding:"6px 12px" }} onClick={() => chrome.tabs.create({ url: "http://localhost:5173/resume" }).catch(() => setTab("profile"))}>
                      <IconUser size={11} /> Open Resume Workspace ↗
                    </button>
                    <button className="btn-secondary" style={{ fontSize:"11px", padding:"6px 12px" }} onClick={() => chrome.tabs.create({ url: chrome.runtime.getURL("demo-job.html") }).catch(() => {})}>
                      Try Sandbox
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── Tab content ── */}
          <div key={tab} className="tab-content">
            {tab === "apply" && (
              <ApplyTab
                detect={detect} match={match} fillResult={fillResult}
                busy={busy} autoApplyBusy={autoApplyBusy} profileReady={profileReady}
                onAutofill={doAutofill} onRefresh={refresh} onAutoApply={doAutoApply}
                onGoSetup={() => setTab("profile")}
              />
            )}
            {tab === "profile" && (
              <ProfileTab />
            )}
            {tab === "settings"     && <SettingsTab />}
            {tab === "tracker"      && <TrackerTab />}
            {tab === "campaigns"    && <CampaignsTab />}
            {tab === "intelligence" && <IntelligenceTab />}
            {tab === "ats"          && <AtsTab />}
            {tab === "recommended"  && <RecommendedTab />}
          </div>
        </main>
      </section>
    </div>
  );
}
