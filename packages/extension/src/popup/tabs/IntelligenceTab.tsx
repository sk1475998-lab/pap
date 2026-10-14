import { useEffect, useState } from "react";
import { getIntelligenceDashboard, getFillHistory, clearFillHistory, type RealIntelligenceDashboard as IntelligenceDashboard } from "@/popup/api.js";

function pct(n: number) { return `${Math.round(n)}%`; }
function metricColor(n: number) { return n >= 70 ? "#34D399" : n >= 45 ? "#FBBF24" : "#FB7185"; }

export function IntelligenceTab() {
  const [dashboard, setDashboard] = useState<IntelligenceDashboard | null>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = () => {
    setLoading(true);
    Promise.all([getIntelligenceDashboard(), getFillHistory()])
      .then(([d, h]) => { setDashboard(d); setHistory(h.reverse()); })
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadData(); }, []);

  const handleClear = async () => {
    if (confirm("Are you sure you want to clear your field fill history?")) {
      await clearFillHistory();
      loadData();
    }
  };

  if (loading) return (
    <div style={{ textAlign: "center", padding: "40px 0", color: "var(--text-faint)", fontSize: "11px" }}>
      Building intelligence dashboard…
    </div>
  );
  if (!dashboard) return (
    <div style={{ textAlign: "center", padding: "40px 0", color: "var(--text-faint)", fontSize: "11px" }}>
      No intelligence data yet.
    </div>
  );

  const metrics = [
    ["ATS", dashboard.averages.atsPassProbability],
    ["Interview", dashboard.averages.interviewProbability],
    ["Response", dashboard.conversion.responseRate],
    ["Offer", dashboard.conversion.offerRate],
  ] as const;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>

      {/* Header card */}
      <div style={{
        background: "linear-gradient(135deg, rgba(30,30,60,0.90), rgba(20,20,45,0.95))",
        border: "1px solid rgba(99,102,241,0.25)",
        borderRadius: "14px", padding: "14px 16px",
      }}>
        <div style={{ fontSize: "9px", textTransform: "uppercase", letterSpacing: "0.10em", color: "rgba(255,255,255,0.45)", fontWeight: 700, marginBottom: "4px" }}>
          Career Intelligence
        </div>
        <div style={{ fontSize: "13px", fontWeight: 800, color: "#fff" }}>Autonomous opportunity cockpit</div>
        <div style={{ fontSize: "10px", color: "rgba(255,255,255,0.55)", marginTop: "4px" }}>
          {dashboard.totals.total} tracked · avg match {dashboard.averages.matchScore}/100
        </div>
      </div>

      {/* Metric mini-cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: "6px" }}>
        {metrics.map(([label, value]) => (
          <div key={label} style={{
            background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)",
            borderRadius: "10px", padding: "10px 8px", textAlign: "center",
          }}>
            <div style={{ fontSize: "14px", fontWeight: 800, color: metricColor(value), lineHeight: 1 }}>{pct(value)}</div>
            <div style={{ fontSize: "8px", textTransform: "uppercase", color: "var(--text-faint)", fontWeight: 600, letterSpacing: "0.06em", marginTop: "3px" }}>{label}</div>
          </div>
        ))}
      </div>

      {/* Funnel health */}
      <div style={{
        background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)",
        borderRadius: "12px", padding: "12px 14px",
      }}>
        <div style={{ fontSize: "9px", textTransform: "uppercase", color: "var(--text-faint)", fontWeight: 700, letterSpacing: "0.10em", marginBottom: "10px" }}>
          Funnel Health
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          {dashboard.funnel.map((f: { stage: string; count: number; percent: number }) => (
            <div key={f.stage}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
                <span style={{ fontSize: "10px", fontWeight: 600, color: "var(--text-secondary)", textTransform: "capitalize" }}>{f.stage}</span>
                <span style={{ fontSize: "10px", color: "var(--text-faint)" }}>{f.count} · {pct(f.percent)}</span>
              </div>
              <div style={{ height: "4px", background: "rgba(255,255,255,0.08)", borderRadius: "99px", overflow: "hidden" }}>
                <div style={{
                  height: "100%", width: `${Math.max(4, f.percent)}%`,
                  background: "rgba(99,102,241,0.70)", borderRadius: "99px", transition: "width 0.5s ease",
                }} />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Field Fill Log */}
      <div style={{
        background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)",
        borderRadius: "12px", padding: "12px 14px",
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
          <div style={{ fontSize: "9px", textTransform: "uppercase", color: "var(--text-faint)", fontWeight: 700, letterSpacing: "0.10em" }}>
            📋 Field Fill Log
          </div>
          {history.length > 0 && (
            <button
              onClick={handleClear}
              style={{
                fontSize: "8.5px", fontWeight: 700, color: "#FB7185",
                background: "rgba(244,63,94,0.08)", border: "1px solid rgba(244,63,94,0.25)",
                borderRadius: "6px", padding: "2px 8px", cursor: "pointer", transition: "all 0.15s",
              }}
            >
              Clear Log
            </button>
          )}
        </div>

        {history.length === 0 ? (
          <div style={{ fontSize: "10px", color: "var(--text-faint)", textAlign: "center", padding: "16px 0", fontStyle: "italic" }}>
            No field fills recorded yet. Apply to a job to see logs.
          </div>
        ) : (
          <div style={{ maxHeight: "220px", overflowY: "auto", borderRadius: "8px", border: "1px solid rgba(255,255,255,0.07)" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "rgba(255,255,255,0.04)", borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
                  {["Field / Label", "Value", "Source", "Company"].map((h) => (
                    <th key={h} style={{ padding: "6px 8px", fontSize: "7.5px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--text-faint)", textAlign: "left" }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {history.map((row) => (
                  <tr
                    key={row.id}
                    style={{ borderBottom: "1px solid rgba(255,255,255,0.04)", transition: "background 0.10s" }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.025)"; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = ""; }}
                  >
                    <td style={{ padding: "6px 8px", fontSize: "9px", fontWeight: 700, color: "var(--text-secondary)", maxWidth: "110px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{row.label}</td>
                    <td style={{ padding: "6px 8px", fontSize: "8.5px", fontFamily: "monospace", color: "var(--text-faint)", maxWidth: "120px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>"{row.value}"</td>
                    <td style={{ padding: "6px 8px" }}>
                      <span style={{
                        fontSize: "8px", fontWeight: 700, padding: "1px 6px", borderRadius: "99px",
                        background: row.filledBy === "User" ? "rgba(251,191,36,0.12)" : "rgba(52,211,153,0.12)",
                        color: row.filledBy === "User" ? "#FBBF24" : "#34D399",
                        border: `1px solid ${row.filledBy === "User" ? "rgba(251,191,36,0.25)" : "rgba(52,211,153,0.25)"}`,
                      }}>
                        {row.filledBy === "User" ? "👤 User" : "🤖 AI"}
                      </span>
                    </td>
                    <td style={{ padding: "6px 8px", fontSize: "8.5px", color: "var(--text-faint)", maxWidth: "80px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{row.company}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}


