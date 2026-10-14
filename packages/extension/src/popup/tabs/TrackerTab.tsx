import { useEffect, useState, useCallback } from "react";
import type { Application, ApplicationStage } from "@superjob/core";
import { getApplications } from "@/popup/api.js";

/* ─── Stage config ─── */

const STAGES: {
  id: ApplicationStage;
  label: string;
  emoji: string;
  ind: string;
  bg: string;
}[] = [
  { id: "saved",     label: "Saved",     emoji: "📌", ind: "#94A3B8", bg: "rgba(148,163,184,0.08)" },
  { id: "applied",   label: "Applied",   emoji: "📤", ind: "#818CF8", bg: "rgba(99,102,241,0.10)"  },
  { id: "screening", label: "Screen",    emoji: "🔍", ind: "#38BDF8", bg: "rgba(56,189,248,0.10)"  },
  { id: "interview", label: "Interview", emoji: "🎙️", ind: "#FBBF24", bg: "rgba(251,191,36,0.10)"  },
  { id: "offer",     label: "Offer",     emoji: "🎉", ind: "#34D399", bg: "rgba(52,211,153,0.10)"  },
  { id: "rejected",  label: "Closed",    emoji: "✕",  ind: "#FB7185", bg: "rgba(244,63,94,0.10)"   },
];

/* ─── Stage badge bg map ─── */
const stageBgMap: Record<ApplicationStage, string> = {
  saved:     "rgba(148,163,184,0.08)",
  applied:   "rgba(99,102,241,0.10)",
  screening: "rgba(56,189,248,0.10)",
  interview: "rgba(251,191,36,0.10)",
  offer:     "rgba(52,211,153,0.10)",
  rejected:  "rgba(244,63,94,0.10)",
};

export function TrackerTab() {
  const [apps, setApps] = useState<Application[]>([]);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dragOverStage, setDragOverStage] = useState<ApplicationStage | null>(null);
  const [view, setView] = useState<"kanban" | "list">("kanban");

  const load = useCallback(() => {
    void getApplications<Application>().then(setApps);
  }, []);

  useEffect(load, [load]);

  const persistApps = async (updated: Application[]) => {
    const { writeApplications } = await import("@superjob/core");
    await writeApplications(updated);
  };

  const moveToStage = async (appId: string, newStage: ApplicationStage) => {
    const updated = apps.map((a) => {
      if (a.id !== appId) return a;
      return {
        ...a,
        stage: newStage,
        updatedAt: Date.now(),
        ...(newStage === "applied" && !a.appliedAt ? { appliedAt: Date.now() } : {}),
      };
    });
    setApps(updated);
    await persistApps(updated);
  };

  const deleteApp = async (appId: string) => {
    const updated = apps.filter((a) => a.id !== appId);
    setApps(updated);
    await persistApps(updated);
  };

  const handleDragStart = (e: React.DragEvent, id: string) => {
    setDraggedId(id);
    e.dataTransfer.effectAllowed = "move";
    const el = e.currentTarget as HTMLElement;
    setTimeout(() => (el.style.opacity = "0.35"), 0);
  };

  const handleDragEnd = (e: React.DragEvent) => {
    (e.currentTarget as HTMLElement).style.opacity = "1";
    setDraggedId(null);
    setDragOverStage(null);
  };

  const handleDragOver = (e: React.DragEvent, stage: ApplicationStage) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOverStage(stage);
  };

  const handleDragLeave = () => setDragOverStage(null);

  const handleDrop = (e: React.DragEvent, stage: ApplicationStage) => {
    e.preventDefault();
    setDragOverStage(null);
    if (draggedId) void moveToStage(draggedId, stage);
  };

  const totalApps = apps.length;
  const stageStats = STAGES.map((s) => ({ ...s, count: apps.filter((a) => a.stage === s.id).length }));

  const scoreColor = (s: number) => s >= 80 ? "#34D399" : s >= 60 ? "#FBBF24" : "#FB7185";
  const scoreBorder = (s: number) => s >= 80 ? "rgba(52,211,153,0.30)" : s >= 60 ? "rgba(251,191,36,0.30)" : "rgba(244,63,94,0.30)";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <div style={{ fontSize: "13px", fontWeight: 700, color: "var(--text-primary)" }}>Application Tracker</div>
          <div style={{ fontSize: "10px", color: "var(--text-faint)", marginTop: "1px" }}>
            {totalApps} application{totalApps === 1 ? "" : "s"} · drag cards to update stage
          </div>
        </div>
        <div style={{ display: "flex", gap: "4px" }}>
          {(["kanban", "list"] as const).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setView(v)}
              style={{
                padding: "4px 10px", fontSize: "10px", fontWeight: 600, borderRadius: "6px",
                border: "1px solid", cursor: "pointer", transition: "all 0.15s",
                background: view === v ? "rgba(99,102,241,0.18)" : "rgba(255,255,255,0.04)",
                borderColor: view === v ? "rgba(99,102,241,0.45)" : "rgba(255,255,255,0.10)",
                color: view === v ? "#818CF8" : "var(--text-muted)",
              }}
            >
              {v === "kanban" ? "Board" : "List"}
            </button>
          ))}
        </div>
      </div>

      {/* Pipeline mini-summary */}
      <div style={{
        display: "grid", gridTemplateColumns: "repeat(6,1fr)", gap: "4px",
        background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.07)",
        borderRadius: "10px", padding: "10px 8px",
      }}>
        {stageStats.map(({ id, emoji, label, count, ind }) => (
          <div key={id} style={{ textAlign: "center" }}>
            <div style={{ fontSize: "13px", marginBottom: "2px" }}>{emoji}</div>
            <div style={{ fontSize: "13px", fontWeight: 800, color: count > 0 ? ind : "var(--text-faint)", lineHeight: 1 }}>{count}</div>
            <div style={{ fontSize: "7px", textTransform: "uppercase", color: "var(--text-faint)", letterSpacing: "0.05em", marginTop: "2px" }}>{label}</div>
          </div>
        ))}
      </div>

      {/* Empty state */}
      {totalApps === 0 && (
        <div style={{ textAlign: "center", padding: "40px 16px" }}>
          <div style={{ fontSize: "28px", marginBottom: "8px" }}>📋</div>
          <div style={{ fontSize: "12px", fontWeight: 600, color: "var(--text-muted)", marginBottom: "4px" }}>No applications yet</div>
          <div style={{ fontSize: "10px", color: "var(--text-faint)" }}>Autofill a job form to start tracking your pipeline.</div>
        </div>
      )}

      {/* KANBAN VIEW */}
      {view === "kanban" && totalApps > 0 && (
        <div style={{ display: "flex", gap: "6px", overflowX: "auto", paddingBottom: "6px", minHeight: "260px" }}>
          {STAGES.map((stage) => {
            const stageApps = apps.filter((a) => a.stage === stage.id);
            const isOver = dragOverStage === stage.id;
            return (
              <div
                key={stage.id}
                onDragOver={(e) => handleDragOver(e, stage.id)}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(e, stage.id)}
                style={{
                  display: "flex", flexDirection: "column", minWidth: "92px", flex: 1,
                  borderRadius: "10px",
                  border: `1px solid ${isOver ? stage.ind + "66" : "rgba(255,255,255,0.07)"}`,
                  background: isOver ? stage.bg : "rgba(255,255,255,0.025)",
                  padding: "8px 6px", transition: "all 0.15s",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "8px", padding: "0 2px" }}>
                  <span style={{ fontSize: "8px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: stage.ind }}>
                    {stage.emoji} {stage.label}
                  </span>
                  <span style={{
                    fontSize: "8px", fontWeight: 700, background: stageBgMap[stage.id],
                    border: `1px solid ${stage.ind}33`, color: stage.ind, borderRadius: "99px", padding: "1px 5px",
                  }}>
                    {stageApps.length}
                  </span>
                </div>
                <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "5px", overflowY: "auto", maxHeight: "220px" }}>
                  {stageApps.map((app) => (
                    <div
                      key={app.id}
                      draggable
                      onDragStart={(e) => handleDragStart(e, app.id)}
                      onDragEnd={handleDragEnd}
                      style={{
                        background: "rgba(255,255,255,0.04)",
                        border: `1px solid ${draggedId === app.id ? "rgba(99,102,241,0.35)" : "rgba(255,255,255,0.08)"}`,
                        borderRadius: "7px", padding: "7px 8px",
                        cursor: "grab", transition: "all 0.12s",
                        opacity: draggedId === app.id ? 0.4 : 1,
                      }}
                    >
                      <div style={{ fontSize: "9px", fontWeight: 700, color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", lineHeight: 1.2 }}>
                        {app.title || "(untitled)"}
                      </div>
                      <div style={{ fontSize: "8px", color: "var(--text-faint)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginTop: "2px" }}>
                        {app.company}
                      </div>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: "5px" }}>
                        {app.matchScore > 0 && (
                          <span style={{
                            fontSize: "8px", fontWeight: 800, color: scoreColor(app.matchScore),
                            border: `1px solid ${scoreBorder(app.matchScore)}`, borderRadius: "4px", padding: "0 4px", lineHeight: "14px",
                          }}>
                            {app.matchScore}%
                          </span>
                        )}
                        {app.url && (
                          <a href={app.url} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}
                            style={{ fontSize: "7px", color: "#818CF8", textDecoration: "none", marginLeft: "auto" }}>
                            Open ↗
                          </a>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* LIST VIEW */}
      {view === "list" && totalApps > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
          {apps.map((a) => {
            const stg = STAGES.find((s) => s.id === a.stage)!;
            return (
              <div
                key={a.id}
                style={{
                  background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)",
                  borderRadius: "10px", padding: "10px 12px", transition: "border-color 0.15s",
                }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,0.12)"; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,0.07)"; }}
              >
                <div style={{ display: "flex", alignItems: "flex-start", gap: "8px" }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: "11px", fontWeight: 700, color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {a.title || "(untitled)"}
                    </div>
                    <div style={{ fontSize: "10px", color: "var(--text-faint)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginTop: "1px" }}>
                      {a.company}
                    </div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "6px", flexShrink: 0 }}>
                    {a.matchScore > 0 && (
                      <span style={{ fontSize: "10px", fontWeight: 800, color: scoreColor(a.matchScore) }}>{a.matchScore}%</span>
                    )}
                    <button
                      type="button"
                      onClick={() => void deleteApp(a.id)}
                      title="Remove"
                      style={{ fontSize: "9px", color: "var(--text-faint)", background: "none", border: "none", cursor: "pointer", padding: "2px", lineHeight: 1, transition: "color 0.15s" }}
                      onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = "#FB7185"; }}
                      onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = "var(--text-faint)"; }}
                    >✕</button>
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", marginTop: "7px" }}>
                  <select
                    value={a.stage}
                    onChange={(e) => void moveToStage(a.id, e.target.value as ApplicationStage)}
                    style={{
                      fontSize: "9px", fontWeight: 600, padding: "2px 6px",
                      borderRadius: "6px", border: `1px solid ${stg.ind}44`,
                      background: stageBgMap[a.stage], color: stg.ind,
                      cursor: "pointer", outline: "none", fontFamily: "var(--font-sans)",
                    }}
                  >
                    {STAGES.map((s) => (
                      <option key={s.id} value={s.id} style={{ background: "var(--bg-card)", color: "var(--text-primary)" }}>
                        {s.emoji} {s.label}
                      </option>
                    ))}
                  </select>
                  {a.url && (
                    <a href={a.url} target="_blank" rel="noreferrer" style={{ fontSize: "9px", color: "#818CF8", textDecoration: "none" }}>
                      Open ↗
                    </a>
                  )}
                  {a.appliedAt && (
                    <span style={{ fontSize: "8px", color: "var(--text-faint)", marginLeft: "auto" }}>
                      {new Date(a.appliedAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
