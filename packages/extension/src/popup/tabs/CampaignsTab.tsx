import { useEffect, useState, useCallback, type ReactNode } from "react";
import {
  getCampaigns,
  saveCampaign,
  deleteCampaign,
  toggleCampaign,
  forceRunCampaigns,
  getCampaignResults,
  type CampaignConfig,
  type CampaignRunResult,
} from "@/lib/campaign-agent.js";

/* ─── shared style tokens ──────────────────────────────────────────── */
const card: React.CSSProperties = {
  background: "rgba(255,255,255,0.03)",
  border: "1px solid rgba(255,255,255,0.07)",
  borderRadius: "14px",
  padding: "14px 16px",
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  fontSize: "12px",
  padding: "7px 10px",
  background: "rgba(255,255,255,0.05)",
  border: "1px solid rgba(255,255,255,0.12)",
  borderRadius: "8px",
  color: "var(--text-primary)",
  outline: "none",
  boxSizing: "border-box",
};

const labelStyle: React.CSSProperties = {
  fontSize: "9px",
  fontWeight: 700,
  textTransform: "uppercase" as const,
  letterSpacing: "0.10em",
  color: "var(--text-faint)",
  marginBottom: "4px",
  display: "block",
};



function BtnPrimary({ children, onClick, disabled, style }: {
  children: ReactNode; onClick?: () => void; disabled?: boolean; style?: React.CSSProperties;
}) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} style={{
      fontSize: "11px", fontWeight: 700, cursor: disabled ? "not-allowed" : "pointer",
      padding: "7px 14px", borderRadius: "10px", border: "none",
      background: disabled ? "rgba(255,255,255,0.08)" : "linear-gradient(135deg,#6366F1,#8B5CF6)",
      color: disabled ? "rgba(255,255,255,0.30)" : "#fff",
      boxShadow: disabled ? "none" : "0 4px 16px rgba(99,102,241,0.35)",
      transition: "all 0.15s", ...style,
    }}>{children}</button>
  );
}

function BtnSuccess({ children, onClick, disabled }: {
  children: ReactNode; onClick?: () => void; disabled?: boolean;
}) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} style={{
      fontSize: "11px", fontWeight: 700, cursor: disabled ? "not-allowed" : "pointer",
      padding: "7px 14px", borderRadius: "10px",
      background: disabled ? "rgba(255,255,255,0.08)" : "rgba(52,211,153,0.15)",
      color: disabled ? "rgba(255,255,255,0.30)" : "#34D399",
      border: "1px solid rgba(52,211,153,0.25)",
      transition: "all 0.15s",
    }}>{children}</button>
  );
}

/* ─── component ────────────────────────────────────────────────────── */
export function CampaignsTab() {
  const [campaigns, setCampaigns] = useState<CampaignConfig[]>([]);
  const [results, setResults] = useState<CampaignRunResult[]>([]);
  const [running, setRunning] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [location, setLocation] = useState("");
  const [minScore, setMinScore] = useState(60);
  const [maxPerDay, setMaxPerDay] = useState(10);

  const load = useCallback(() => {
    void getCampaigns().then(setCampaigns);
    void getCampaignResults().then(setResults);
  }, []);

  useEffect(load, [load]);

  const runNow = async () => {
    setRunning(true);
    try { await forceRunCampaigns(); await new Promise((r) => setTimeout(r, 800)); }
    finally { setRunning(false); load(); }
  };

  const resetForm = () => {
    setTitle(""); setLocation(""); setMinScore(60); setMaxPerDay(10);
    setEditId(null); setShowForm(false);
  };

  const handleSave = async () => {
    if (!title.trim()) return;
    const campaign: CampaignConfig = {
      id: editId || `camp_${Date.now()}`,
      titleQuery: title.trim(), location: location.trim() || "Remote",
      minScore, maxApplicationsPerDay: maxPerDay, isActive: true, createdAt: Date.now(),
    };
    if (editId) {
      const existing = campaigns.find((c) => c.id === editId);
      if (existing) {
        campaign.lastRunTime = existing.lastRunTime; campaign.todayCount = existing.todayCount;
        campaign.todayDate = existing.todayDate; campaign.isActive = existing.isActive;
        campaign.createdAt = existing.createdAt;
      }
    }
    await saveCampaign(campaign); resetForm(); load();
  };

  const handleEdit = (c: CampaignConfig) => {
    setEditId(c.id); setTitle(c.titleQuery); setLocation(c.location);
    setMinScore(c.minScore); setMaxPerDay(c.maxApplicationsPerDay); setShowForm(true);
  };

  const activeCampaigns = campaigns.filter((c) => c.isActive).length;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <div style={{ fontSize: "13px", fontWeight: 800, color: "var(--text-primary)" }}>Auto-Apply Campaigns</div>
          <div style={{ fontSize: "10px", color: "var(--text-faint)", marginTop: "2px" }}>
            {activeCampaigns} active · scans ~every 30 min while Chrome is open
          </div>
        </div>
        <div style={{ display: "flex", gap: "8px" }}>
          <BtnSuccess onClick={() => void runNow()} disabled={running}>
            {running ? "Running…" : "▶ Run now"}
          </BtnSuccess>
          <BtnPrimary onClick={() => { resetForm(); setShowForm(true); }}>+ New</BtnPrimary>
        </div>
      </div>

      {/* Info banner */}
      <div style={{
        background: "rgba(99,102,241,0.08)", border: "1px solid rgba(99,102,241,0.20)",
        borderRadius: "12px", padding: "10px 14px", fontSize: "10px", color: "rgba(165,180,252,0.90)", lineHeight: 1.6,
      }}>
        💡 Campaigns search job boards on a schedule, score matches, and open the best ones in new tabs where the in-browser autopilot fills them.{" "}
        <b style={{ color: "#A5B4FC" }}>Advanced:</b> run the optional Docker runner{" "}
        (<code style={{ background: "rgba(99,102,241,0.15)", padding: "1px 5px", borderRadius: "4px", fontSize: "9px" }}>localhost:3000</code>)
        to apply headlessly. Click <b style={{ color: "#A5B4FC" }}>Run now</b> for an immediate pass.
      </div>

      {/* Last run summary */}
      {results.length > 0 && (
        <div style={{ ...card, padding: "10px 14px" }}>
          <div style={{ fontSize: "9px", textTransform: "uppercase", color: "var(--text-faint)", fontWeight: 700, letterSpacing: "0.10em", marginBottom: "6px" }}>Last run</div>
          {results.slice(0, 3).map((r, i) => (
            <div key={i} style={{ fontSize: "10px", color: "var(--text-secondary)", marginBottom: "3px" }}>
              <span style={{ fontWeight: 600 }}>{r.campaignId.slice(0, 36)}</span>: discovered{" "}
              <span style={{ color: "#A5B4FC" }}>{r.discovered}</span>, matched{" "}
              <span style={{ color: "#34D399" }}>{r.matched}</span>, applied{" "}
              <span style={{ color: "#34D399" }}>{r.applied}</span>
              {r.errors.length > 0 && <span style={{ color: "#FB7185" }}> · {r.errors.length} error(s)</span>}
            </div>
          ))}
        </div>
      )}

      {/* Create / Edit form */}
      {showForm && (
        <div style={{
          background: "rgba(99,102,241,0.06)", border: "1px solid rgba(99,102,241,0.25)",
          borderRadius: "14px", padding: "16px",
        }}>
          <div style={{ fontSize: "10px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.10em", color: "#A5B4FC", marginBottom: "14px" }}>
            {editId ? "✎ Edit Campaign" : "+ New Campaign"}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            <div>
              <label style={labelStyle}>Job Title / Keywords *</label>
              <input style={inputStyle} type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Senior React Developer" />
            </div>
            <div>
              <label style={labelStyle}>Location</label>
              <input style={inputStyle} type="text" value={location} onChange={(e) => setLocation(e.target.value)} placeholder="e.g. Remote, Bangalore, New York" />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
              <div>
                <label style={labelStyle}>Min Score (0–100)</label>
                <input style={inputStyle} type="number" min={0} max={100} value={minScore} onChange={(e) => setMinScore(Number(e.target.value))} />
              </div>
              <div>
                <label style={labelStyle}>Max / Day</label>
                <input style={inputStyle} type="number" min={1} max={100} value={maxPerDay} onChange={(e) => setMaxPerDay(Number(e.target.value))} />
              </div>
            </div>
            <div style={{ display: "flex", gap: "8px", paddingTop: "4px" }}>
              <BtnPrimary onClick={() => void handleSave()} disabled={!title.trim()} style={{ flex: 1 }}>
                {editId ? "Update Campaign" : "Create Campaign"}
              </BtnPrimary>
              <button type="button" onClick={resetForm} style={{
                fontSize: "11px", fontWeight: 600, padding: "7px 14px", borderRadius: "10px",
                background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.10)",
                color: "var(--text-secondary)", cursor: "pointer",
              }}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Empty state */}
      {campaigns.length === 0 && !showForm && (
        <div style={{ textAlign: "center", padding: "40px 0" }}>
          <div style={{ fontSize: "28px", marginBottom: "8px" }}>🚀</div>
          <div style={{ fontSize: "12px", fontWeight: 700, color: "var(--text-secondary)" }}>No campaigns yet</div>
          <div style={{ fontSize: "10px", color: "var(--text-faint)", marginTop: "4px" }}>
            Create a campaign to automatically find and apply to matching jobs.
          </div>
        </div>
      )}

      {/* Campaign list */}
      {campaigns.map((c) => (
        <div key={c.id} style={{
          ...card,
          borderColor: c.isActive ? "rgba(99,102,241,0.30)" : "rgba(255,255,255,0.06)",
          opacity: c.isActive ? 1 : 0.60, transition: "all 0.15s",
        }}>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "8px" }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
                <span style={{
                  width: "8px", height: "8px", borderRadius: "50%", flexShrink: 0,
                  background: c.isActive ? "#34D399" : "rgba(255,255,255,0.20)",
                  boxShadow: c.isActive ? "0 0 8px rgba(52,211,153,0.6)" : "none",
                }} />
                <div style={{ fontSize: "12px", fontWeight: 700, color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {c.titleQuery}
                </div>
              </div>
              <div style={{ fontSize: "10px", color: "var(--text-faint)" }}>
                📍 {c.location || "Remote"} · Min: {c.minScore}% · Max: {c.maxApplicationsPerDay}/day
              </div>
              <div style={{ display: "flex", gap: "12px", marginTop: "6px", fontSize: "9px", color: "var(--text-faint)" }}>
                {c.lastRunTime && <span>Last run: {new Date(c.lastRunTime).toLocaleString([], { hour: "2-digit", minute: "2-digit" })}</span>}
                {c.todayCount != null && c.todayCount > 0 && <span>Today: {c.todayCount}/{c.maxApplicationsPerDay}</span>}
                {!c.lastRunTime && <span>Not run yet</span>}
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "6px", flexShrink: 0 }}>
              <button type="button" onClick={() => handleEdit(c)} title="Edit" style={{
                fontSize: "13px", color: "var(--text-faint)", background: "none", border: "none", cursor: "pointer", padding: "2px 4px", lineHeight: 1,
              }}>✎</button>
              <button type="button" onClick={() => void toggleCampaign(c.id, !c.isActive).then(load)} style={{
                fontSize: "9px", fontWeight: 700, padding: "3px 9px", borderRadius: "99px", cursor: "pointer",
                background: c.isActive ? "rgba(52,211,153,0.12)" : "rgba(255,255,255,0.05)",
                color: c.isActive ? "#34D399" : "var(--text-faint)",
                border: `1px solid ${c.isActive ? "rgba(52,211,153,0.30)" : "rgba(255,255,255,0.10)"}`,
              }}>{c.isActive ? "Active" : "Paused"}</button>
              <button type="button" onClick={() => void deleteCampaign(c.id).then(load)} title="Delete"
                style={{ fontSize: "13px", color: "var(--text-faint)", background: "none", border: "none", cursor: "pointer", padding: "2px 4px", lineHeight: 1, transition: "color 0.15s" }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = "#FB7185"; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = "var(--text-faint)"; }}
              >✕</button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}