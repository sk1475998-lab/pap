import React, { useState } from "react";
import { Sparkles, Copy, Check, MessageSquare, Bot } from "lucide-react";

export function CopilotPage() {
  const [tone, setTone] = useState("Professional");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [customQuestion, setCustomQuestion] = useState("");
  const [generating, setGenerating] = useState(false);

  const starAnswers = [
    {
      id: "q-1",
      question: "Tell me about a time you resolved a critical production outage.",
      situation: "A high-frequency database deadlock brought down our order ingestion pipeline during peak traffic.",
      task: "I needed to identify the offending queries, restore database health, and prevent recurring locks without dropping messages.",
      action: "I isolated the lock using pg_stat_activity, implemented exponential backoff on transaction retries, and added an asynchronous Redis queue buffer.",
      result: "Restored full throughput in 8 minutes with 0% message loss and decreased query latency by 35% overall.",
    },
    {
      id: "q-2",
      question: "How do you balance technical debt with urgent product delivery?",
      situation: "Our team needed to ship a major enterprise feature in 3 weeks while refactoring legacy authentication.",
      task: "Deliver the business milestone while ensuring architectural reliability and zero security vulnerabilities.",
      action: "I designed a facade adapter pattern around the legacy service, allowing the new feature to consume modern interfaces while deferring internal cleanup to an isolated sprint.",
      result: "Shipped the enterprise feature on schedule, unlocking $500k ARR, and completed the backend migration in the subsequent sprint without downtime.",
    },
  ];

  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleGenerate = () => {
    if (!customQuestion.trim()) return;
    setGenerating(true);
    setTimeout(() => {
      setGenerating(false);
      alert(`Generated STAR response for: "${customQuestion}" in ${tone} tone!`);
      setCustomQuestion("");
    }, 1200);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      {/* Header */}
      <div>
        <div className="label-xs" style={{ color: "var(--ind)", marginBottom: "4px" }}>
          BEHAVIORAL & SCREENING COPILOT
        </div>
        <h1 className="section-title" style={{ fontSize: "24px" }}>
          STAR Answer Planner
        </h1>
        <p className="section-sub">
          Generate structured, high-impact answers for job screening questions using the Situation-Task-Action-Result methodology.
        </p>
      </div>

      {/* Tone Selection Bar */}
      <div className="card" style={{ padding: "16px", display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
        <span style={{ fontSize: "12.5px", fontWeight: 700, color: "var(--t2)" }}>Response Tone:</span>
        <div style={{ display: "flex", gap: "6px" }}>
          {["Professional", "Confident", "Concise", "Storytelling"].map((t) => (
            <button
              key={t}
              onClick={() => setTone(t)}
              style={{
                padding: "6px 14px",
                borderRadius: "var(--r8)",
                fontSize: "12px",
                fontWeight: 600,
                background: tone === t ? "var(--ind)" : "var(--bg1)",
                color: tone === t ? "#fff" : "var(--t3)",
                border: "1px solid var(--b0)",
                transition: "all 0.15s ease",
              }}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* Custom Question Generator Input */}
      <div className="card">
        <h3 className="section-title" style={{ fontSize: "15px", marginBottom: "8px" }}>
          Ask AI for Screening Answers
        </h3>
        <div style={{ display: "flex", gap: "10px" }}>
          <input
            className="input-field"
            placeholder="Paste any application screening question here (e.g. Why are you interested in our company?)"
            value={customQuestion}
            onChange={(e) => setCustomQuestion(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleGenerate()}
          />
          <button
            className="btn-primary"
            onClick={handleGenerate}
            disabled={generating}
            style={{ display: "flex", alignItems: "center", gap: "6px", whiteSpace: "nowrap" }}
          >
            <Sparkles size={14} />
            {generating ? "Drafting..." : "Generate Answer"}
          </button>
        </div>
      </div>

      {/* STAR Question Cards */}
      <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
        {starAnswers.map((item) => {
          const fullText = `Situation: ${item.situation}\nTask: ${item.task}\nAction: ${item.action}\nResult: ${item.result}`;
          const isCopied = copiedId === item.id;
          return (
            <div key={item.id} className="card" style={{ padding: "20px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "12px", marginBottom: "16px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <MessageSquare size={16} color="var(--sky)" />
                  <h3 style={{ fontSize: "15px", fontWeight: 700, color: "var(--t1)" }}>{item.question}</h3>
                </div>

                <button
                  className="btn-secondary"
                  onClick={() => handleCopy(item.id, fullText)}
                  style={{ padding: "6px 12px", fontSize: "11.5px", display: "flex", alignItems: "center", gap: "5px" }}
                >
                  {isCopied ? <Check size={12} color="var(--em)" /> : <Copy size={12} />}
                  {isCopied ? "Copied!" : "Copy Answer"}
                </button>
              </div>

              {/* STAR Blocks */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "12px" }}>
                <div style={{ background: "var(--bg1)", border: "1px solid var(--b0)", borderLeft: "3px solid #38BDF8", borderRadius: "var(--r8)", padding: "12px" }}>
                  <div style={{ fontSize: "10px", fontWeight: 800, textTransform: "uppercase", color: "#38BDF8", marginBottom: "4px" }}>
                    Situation
                  </div>
                  <div style={{ fontSize: "12px", color: "var(--t2)", lineHeight: 1.5 }}>{item.situation}</div>
                </div>

                <div style={{ background: "var(--bg1)", border: "1px solid var(--b0)", borderLeft: "3px solid #818CF8", borderRadius: "var(--r8)", padding: "12px" }}>
                  <div style={{ fontSize: "10px", fontWeight: 800, textTransform: "uppercase", color: "#818CF8", marginBottom: "4px" }}>
                    Task
                  </div>
                  <div style={{ fontSize: "12px", color: "var(--t2)", lineHeight: 1.5 }}>{item.task}</div>
                </div>

                <div style={{ background: "var(--bg1)", border: "1px solid var(--b0)", borderLeft: "3px solid #10B981", borderRadius: "var(--r8)", padding: "12px" }}>
                  <div style={{ fontSize: "10px", fontWeight: 800, textTransform: "uppercase", color: "#10B981", marginBottom: "4px" }}>
                    Action
                  </div>
                  <div style={{ fontSize: "12px", color: "var(--t2)", lineHeight: 1.5 }}>{item.action}</div>
                </div>

                <div style={{ background: "var(--bg1)", border: "1px solid var(--b0)", borderLeft: "3px solid #F59E0B", borderRadius: "var(--r8)", padding: "12px" }}>
                  <div style={{ fontSize: "10px", fontWeight: 800, textTransform: "uppercase", color: "#F59E0B", marginBottom: "4px" }}>
                    Result
                  </div>
                  <div style={{ fontSize: "12px", color: "var(--t2)", lineHeight: 1.5 }}>{item.result}</div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
