import React, { useState } from "react";
import {
  Kanban as KanbanIcon,
  Plus,
  RefreshCw,
  Building,
  Calendar,
  ChevronRight,
  ChevronLeft,
  Trash2,
  ExternalLink,
} from "lucide-react";

interface ApplicationCard {
  id: string;
  role: string;
  company: string;
  stage: "saved" | "applied" | "screening" | "interview" | "offer" | "rejected";
  date: string;
  salary?: string;
  notes?: string;
}

export function TrackerPage() {
  const [cards, setCards] = useState<ApplicationCard[]>([
    {
      id: "app-1",
      role: "Senior Full Stack Engineer",
      company: "Vercel",
      stage: "interview",
      date: "Oct 10, 2026",
      salary: "$190,000",
      notes: "System design round scheduled with Staff Engineer.",
    },
    {
      id: "app-2",
      role: "Staff Infrastructure Engineer",
      company: "Stripe",
      stage: "screening",
      date: "Oct 09, 2026",
      salary: "$210,000",
      notes: "Recruiter phone screen passed, waiting on hiring manager callback.",
    },
    {
      id: "app-3",
      role: "Lead Platform Architect",
      company: "Linear",
      stage: "offer",
      date: "Oct 05, 2026",
      salary: "$225,000",
      notes: "Written offer received! Negotiating equity compensation.",
    },
    {
      id: "app-4",
      role: "Backend Systems Engineer",
      company: "Supabase",
      stage: "applied",
      date: "Oct 08, 2026",
      salary: "$175,000",
      notes: "Tailored resume submitted via Greenhouse.",
    },
    {
      id: "app-5",
      role: "AI Workflow Engineer",
      company: "Anthropic",
      stage: "saved",
      date: "Oct 11, 2026",
      salary: "$230,000",
      notes: "Need to highlight vector search optimization in cover letter.",
    },
  ]);

  const stages: { key: ApplicationCard["stage"]; label: string; color: string }[] = [
    { key: "saved", label: "Wishlist", color: "var(--t3)" },
    { key: "applied", label: "Applied", color: "var(--sky)" },
    { key: "screening", label: "Screening", color: "var(--ind)" },
    { key: "interview", label: "Interviewing", color: "#F59E0B" },
    { key: "offer", label: "Offer Received", color: "var(--em)" },
    { key: "rejected", label: "Archived", color: "var(--rose)" },
  ];

  const moveCard = (id: string, direction: "prev" | "next") => {
    const stageKeys = stages.map((s) => s.key);
    setCards((prev) =>
      prev.map((c) => {
        if (c.id !== id) return c;
        const currentIdx = stageKeys.indexOf(c.stage);
        const newIdx = direction === "next" ? Math.min(currentIdx + 1, stageKeys.length - 1) : Math.max(currentIdx - 1, 0);
        return { ...c, stage: stageKeys[newIdx] };
      })
    );
  };

  const deleteCard = (id: string) => {
    setCards((prev) => prev.filter((c) => c.id !== id));
  };

  const addQuickCard = () => {
    const role = prompt("Enter Job Title:", "Senior Software Engineer");
    const company = prompt("Enter Company:", "OpenAI");
    if (!role || !company) return;
    const newCard: ApplicationCard = {
      id: `app-${Date.now()}`,
      role,
      company,
      stage: "saved",
      date: "Today",
      notes: "Manually added to pipeline",
    };
    setCards((prev) => [newCard, ...prev]);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
      {/* Page Heading */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px" }}>
        <div>
          <div className="label-xs" style={{ color: "var(--ind)", marginBottom: "4px" }}>
            PIPELINE MANAGEMENT
          </div>
          <h1 className="section-title" style={{ fontSize: "24px" }}>
            Application Pipeline Kanban
          </h1>
          <p className="section-sub" style={{ marginBottom: 0 }}>
            Visual pipeline tracker. Move applications between stages as you advance through interviews.
          </p>
        </div>

        <div style={{ display: "flex", gap: "10px" }}>
          <button className="btn-secondary" onClick={() => window.location.reload()} style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <RefreshCw size={14} /> Refresh
          </button>
          <button className="btn-primary" onClick={addQuickCard} style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <Plus size={14} /> Add Application
          </button>
        </div>
      </div>

      {/* Kanban Board Columns */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
          gap: "14px",
          alignItems: "start",
          overflowX: "auto",
        }}
      >
        {stages.map((stg) => {
          const colCards = cards.filter((c) => c.stage === stg.key);
          return (
            <div
              key={stg.key}
              style={{
                background: "var(--bg1)",
                border: "1px solid var(--b0)",
                borderRadius: "var(--r16)",
                padding: "14px",
                display: "flex",
                flexDirection: "column",
                gap: "10px",
                minHeight: "480px",
              }}
            >
              {/* Column Header */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  paddingBottom: "10px",
                  borderBottom: `2px solid ${stg.color}`,
                }}
              >
                <span style={{ fontSize: "13px", fontWeight: 700, color: "var(--t1)" }}>{stg.label}</span>
                <span
                  style={{
                    fontSize: "11px",
                    fontWeight: 800,
                    padding: "2px 8px",
                    borderRadius: "10px",
                    background: "var(--bg2)",
                    color: stg.color,
                  }}
                >
                  {colCards.length}
                </span>
              </div>

              {/* Cards in this column */}
              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                {colCards.map((card) => (
                  <div
                    key={card.id}
                    className="card"
                    style={{
                      padding: "14px",
                      background: "var(--bg2)",
                      border: "1px solid var(--b0)",
                      borderRadius: "var(--r12)",
                      display: "flex",
                      flexDirection: "column",
                      gap: "8px",
                      boxShadow: "0 4px 12px rgba(0,0,0,0.2)",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                      <div>
                        <div style={{ fontSize: "13.5px", fontWeight: 700, color: "var(--t1)" }}>{card.role}</div>
                        <div style={{ fontSize: "12px", color: "var(--t3)", display: "flex", alignItems: "center", gap: "4px", marginTop: "2px" }}>
                          <Building size={12} /> {card.company}
                        </div>
                      </div>
                      <button
                        onClick={() => deleteCard(card.id)}
                        style={{ background: "transparent", color: "var(--t4)", padding: "2px" }}
                        title="Remove"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>

                    {card.salary && (
                      <div style={{ fontSize: "11px", color: "var(--em)", fontWeight: 700 }}>{card.salary}</div>
                    )}

                    {card.notes && (
                      <div style={{ fontSize: "11.5px", color: "var(--t3)", background: "var(--bg1)", padding: "6px 8px", borderRadius: "6px" }}>
                        {card.notes}
                      </div>
                    )}

                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: "4px", paddingTop: "8px", borderTop: "1px solid var(--b0)" }}>
                      <span style={{ fontSize: "10px", color: "var(--t4)", display: "flex", alignItems: "center", gap: "3px" }}>
                        <Calendar size={11} /> {card.date}
                      </span>

                      <div style={{ display: "flex", gap: "4px" }}>
                        <button
                          onClick={() => moveCard(card.id, "prev")}
                          disabled={stg.key === "saved"}
                          style={{
                            background: "var(--bg3)",
                            color: "var(--t2)",
                            borderRadius: "4px",
                            padding: "3px 6px",
                            opacity: stg.key === "saved" ? 0.3 : 1,
                          }}
                          title="Move Previous"
                        >
                          <ChevronLeft size={12} />
                        </button>
                        <button
                          onClick={() => moveCard(card.id, "next")}
                          disabled={stg.key === "rejected"}
                          style={{
                            background: "var(--bg3)",
                            color: "var(--t2)",
                            borderRadius: "4px",
                            padding: "3px 6px",
                            opacity: stg.key === "rejected" ? 0.3 : 1,
                          }}
                          title="Move Next"
                        >
                          <ChevronRight size={12} />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}

                {colCards.length === 0 && (
                  <div
                    style={{
                      padding: "28px 12px",
                      textAlign: "center",
                      color: "var(--t4)",
                      fontSize: "12px",
                      border: "1px dashed var(--b0)",
                      borderRadius: "var(--r8)",
                    }}
                  >
                    No applications here
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
