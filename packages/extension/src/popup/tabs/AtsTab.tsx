import { useEffect, useState } from "react";
import type { AtsAnalysis } from "@superjob/core";
import { getAtsAnalysisForActiveJob } from "@/popup/api.js";

function scoreColor(n: number) {
  return n >= 82 ? "#34D399" : n >= 65 ? "#FBBF24" : "#FB7185";
}
function scoreBarColor(n: number) {
  return n >= 82 ? "rgba(52,211,153,0.70)" : n >= 65 ? "rgba(251,191,36,0.70)" : "rgba(244,63,94,0.70)";
}

export function AtsTab() {
  const [ats, setAts] = useState<AtsAnalysis | null>(null);
  const [loading, setLoading] = useState(true);
  const loadAnalysis = () => {
    setLoading(true);
    getAtsAnalysisForActiveJob()
      .then((x) => setAts(x))
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadAnalysis(); }, []);

  if (loading) return (
    <div style={{ textAlign: "center", padding: "40px 0", color: "var(--text-faint)", fontSize: "11px" }}>
      <div style={{ marginBottom: "8px", fontSize: "18px" }}>⚡</div>
      Analyzing ATS signals against active job description…
    </div>
  );
  if (!ats) return (
    <div style={{ textAlign: "center", padding: "32px 16px", color: "var(--text-faint)", fontSize: "11px", display: "flex", flexDirection: "column", alignItems: "center", gap: "10px" }}>
      <span style={{ fontSize: "24px" }}>🎯</span>
      <div style={{ fontWeight: 600, color: "#cbd5e1" }}>No ATS Data Available</div>
      <div style={{ maxWidth: "260px", lineHeight: 1.4, color: "#94a3b8", fontSize: "10.5px" }}>
        Navigate to a job posting (LinkedIn, Greenhouse, Lever, Workday) and ensure your dashboard profile has synced skills or a resume.
      </div>
      <button
        type="button"
        onClick={loadAnalysis}
        style={{
          background: "rgba(99,102,241,0.2)",
          border: "1px solid rgba(99,102,241,0.4)",
          color: "#a5b4fc",
          borderRadius: "8px",
          padding: "6px 14px",
          fontSize: "10.5px",
          fontWeight: 600,
          cursor: "pointer",
          marginTop: "4px"
        }}
      >
        ↻ Rescan Active Tab
      </button>
    </div>
  );

  const metrics = [
    ["Required", ats.requiredScore],
    ["Parse", ats.parseScore],
    ["Sections", ats.sectionScore],
    ["Format", ats.formatScore],
  ] as const;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>

      {/* Info banner */}
      <div style={{
        background: "rgba(99,102,241,0.08)", border: "1px solid rgba(99,102,241,0.20)",
        borderRadius: "10px", padding: "10px 12px",
        display: "flex", alignItems: "flex-start", gap: "10px",
      }}>
        <span style={{ fontSize: "16px", lineHeight: 1, marginTop: "1px" }}>🎯</span>
        <div>
          <div style={{ fontSize: "11px", fontWeight: 700, color: "#818CF8" }}>ATS Readiness Scan</div>
          <div style={{ fontSize: "10px", color: "var(--text-muted)", lineHeight: 1.5, marginTop: "2px" }}>
            Compares your resume against this job's description — the same signals Greenhouse, Workday, and Lever use to rank applicants.
          </div>
        </div>
      </div>

      {/* Hero score card */}
      <div style={{
        background: "linear-gradient(135deg, rgba(99,102,241,0.22), rgba(139,92,246,0.18))",
        border: "1px solid rgba(99,102,241,0.30)",
        borderRadius: "14px", padding: "14px 16px",
        position: "relative", overflow: "hidden",
      }}>
        <div aria-hidden style={{
          position: "absolute", top: -20, right: -20, width: 100, height: 100,
          borderRadius: "50%", background: "radial-gradient(circle, rgba(139,92,246,0.22) 0%, transparent 70%)",
          pointerEvents: "none",
        }} />
        <div style={{ fontSize: "9px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.10em", color: "rgba(255,255,255,0.55)", marginBottom: "4px" }}>
          Overall ATS Readiness
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
          <div>
            <div style={{ fontSize: "12px", fontWeight: 700, color: "#fff", lineHeight: 1 }}>Parse + ranking simulation</div>
            <div style={{ fontSize: "10px", color: "rgba(255,255,255,0.60)", marginTop: "3px" }}>
              Estimated likelihood your resume clears automated screening
            </div>
          </div>
          <div style={{ textAlign: "right", flexShrink: 0 }}>
            <div style={{ fontSize: "30px", fontWeight: 900, color: "#fff", lineHeight: 1, fontFamily: "monospace" }}>{ats.passProbability}%</div>
            <div style={{
              fontSize: "8px", textTransform: "uppercase", fontWeight: 700, letterSpacing: "0.08em",
              background: "rgba(255,255,255,0.12)", color: "rgba(255,255,255,0.80)",
              padding: "2px 6px", borderRadius: "4px", marginTop: "4px", display: "inline-block",
            }}>
              {ats.workday.status}
            </div>
          </div>
        </div>
      </div>

      {/* Metric mini-cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: "6px" }}>
        {metrics.map(([label, score]) => (
          <div key={label} style={{
            background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)",
            borderRadius: "10px", padding: "10px 8px", textAlign: "center",
          }}>
            <div style={{ fontSize: "15px", fontWeight: 800, color: scoreColor(score), lineHeight: 1 }}>{score}</div>
            <div style={{ fontSize: "8px", textTransform: "uppercase", color: "var(--text-faint)", fontWeight: 600, letterSpacing: "0.06em", marginTop: "3px" }}>{label}</div>
          </div>
        ))}
      </div>

      {/* ATS Checks */}
      <div style={{
        background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)",
        borderRadius: "12px", padding: "12px 14px",
      }}>
        <div style={{ fontSize: "9px", textTransform: "uppercase", color: "var(--text-faint)", fontWeight: 700, letterSpacing: "0.10em", marginBottom: "10px" }}>
          ATS Checks
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          {ats.checks.map((c) => {
            const statusColor = c.status === "pass" ? "#34D399" : c.status === "warn" ? "#FBBF24" : "#FB7185";
            const barW = c.status === "pass" ? 90 : c.status === "warn" ? 62 : 32;
            return (
              <div key={c.code}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
                  <span style={{ fontSize: "11px", fontWeight: 600, color: "var(--text-secondary)" }}>{c.label}</span>
                  <span style={{ fontSize: "10px", fontWeight: 700, color: statusColor }}>{c.status}</span>
                </div>
                <div style={{ height: "4px", background: "rgba(255,255,255,0.08)", borderRadius: "99px", overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${barW}%`, background: scoreBarColor(barW), borderRadius: "99px", transition: "width 0.5s ease" }} />
                </div>
                <div style={{ fontSize: "9.5px", color: "var(--text-faint)", marginTop: "3px" }}>{c.message}</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Missing Keywords */}
      {ats.missingRequired.length > 0 && (
        <div style={{
          background: "rgba(244,63,94,0.06)", border: "1px solid rgba(244,63,94,0.20)",
          borderRadius: "12px", padding: "12px 14px",
        }}>
          <div style={{ fontSize: "9px", textTransform: "uppercase", color: "#FB7185", fontWeight: 700, letterSpacing: "0.10em", marginBottom: "8px" }}>
            Missing required keywords in your synced profile
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "5px" }}>
            {ats.missingRequired.slice(0, 16).map((k) => (
              <span
                key={k}
                style={{
                  fontSize: "9.5px", fontWeight: 600,
                  background: "rgba(255,255,255,0.05)",
                  border: "1px solid rgba(244,63,94,0.30)",
                  color: "#FB7185",
                  borderRadius: "99px", padding: "2px 8px",
                }}
              >
                {k}
              </span>
            ))}
          </div>
          <div style={{ fontSize: "9px", color: "var(--text-faint)", marginTop: "7px" }}>
            Add a skill on the dashboard only if it accurately reflects your experience.
          </div>
        </div>
      )}

      {/* Recommendations */}
      <div style={{
        background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)",
        borderRadius: "12px", padding: "12px 14px",
      }}>
        <div style={{ fontSize: "9px", textTransform: "uppercase", color: "var(--text-faint)", fontWeight: 700, letterSpacing: "0.10em", marginBottom: "8px" }}>
          Recommendations
        </div>
        <ul style={{ display: "flex", flexDirection: "column", gap: "5px", listStyle: "none", padding: 0 }}>
          {ats.workday.recommendations.slice(0, 8).map((r, i) => (
            <li key={i} style={{ fontSize: "10px", color: "var(--text-muted)", display: "flex", alignItems: "flex-start", gap: "6px" }}>
              <span style={{ color: "#818CF8", flexShrink: 0 }}>✦</span>
              {r}
            </li>
          ))}
        </ul>
      </div>

      {/* Section parse */}
      <div style={{
        background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)",
        borderRadius: "12px", padding: "12px 14px",
      }}>
        <div style={{ fontSize: "9px", textTransform: "uppercase", color: "var(--text-faint)", fontWeight: 700, letterSpacing: "0.10em", marginBottom: "8px" }}>
          Section Parse
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px" }}>
          {ats.sectionScores.map((s) => (
            <div key={s.section} style={{
              background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.07)",
              borderRadius: "8px", padding: "8px 10px",
              display: "flex", justifyContent: "space-between", alignItems: "center",
            }}>
              <span style={{ fontSize: "10px", textTransform: "capitalize", color: "var(--text-muted)" }}>{s.section}</span>
              <span style={{ fontSize: "11px", fontWeight: 700, color: scoreColor(s.score) }}>{s.score}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
