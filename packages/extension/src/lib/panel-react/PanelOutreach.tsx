import React, { useState } from "react";
import { usePanelStore } from "./panel-store.js";
import { sendToBackgroundData } from "../message-router.js";

export const PanelOutreach: React.FC = () => {
  const { pageContext } = usePanelStore();
  const [recruiterName, setRecruiterName] = useState("");
  const [recruiterBio, setRecruiterBio] = useState("");
  const [result, setResult] = useState<{ message: string; success: boolean; error?: string } | null>(null);
  const [loading, setLoading] = useState(false);

  const handleGenerate = async (platform: "linkedin" | "email") => {
    setLoading(true);
    setResult(null);
    try {
      const response = await sendToBackgroundData<{ message?: string; success?: boolean; error?: string }>("SJA:GENERATE_OUTREACH", {
        recruiterName,
        recruiterBio,
        companyName: pageContext?.company || "the company",
        jobTitle: pageContext?.jobTitle || "the open role",
        platform
      });
      if (response.error || !response.success) {
        const message = response.error || "Generation failed.";
        setResult({ success: false, message, error: message });
      } else {
        setResult({ success: true, message: response.message || "" });
      }
    } catch (e) {
      setResult({ success: false, message: "Generation failed.", error: String(e) });
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = () => {
    if (result?.message) {
      navigator.clipboard.writeText(result.message);
      alert("Copied to clipboard! 🎉"); // simple toast fallback
    }
  };

  return (
    <div className="sja-card sja-outreach-card">
      <div className="sja-card-title" style={{ borderBottom: "1px solid var(--sja-border)", paddingBottom: "6px" }}>
        <span className="sja-card-icon">🚀</span> AI Recruiter Outreach
      </div>
      
      <div className="sja-form-section" style={{ marginTop: "8px" }}>
        <div className="sja-form-group">
          <label>Recruiter Name (Optional)</label>
          <input 
            type="text" 
            placeholder="e.g. Sarah Smith" 
            value={recruiterName}
            onChange={(e) => setRecruiterName(e.target.value)}
          />
        </div>
        <div className="sja-form-group">
          <label>Recruiter Focus / Bio (Optional)</label>
          <input 
            type="text" 
            placeholder="e.g. Technical Hiring at Scale" 
            value={recruiterBio}
            onChange={(e) => setRecruiterBio(e.target.value)}
          />
        </div>

        <div className="sja-row" style={{ display: "flex", gap: "8px", marginTop: "12px" }}>
          <button 
            className="sja-btn sja-btn-primary" 
            style={{ flex: 1, backgroundColor: "#0a66c2", color: "white" }}
            onClick={() => handleGenerate("linkedin")}
            disabled={loading}
          >
            {loading ? "..." : "in LinkedIn Note"}
          </button>
          <button 
            className="sja-btn sja-btn-primary" 
            style={{ flex: 1 }}
            onClick={() => handleGenerate("email")}
            disabled={loading}
          >
            {loading ? "..." : "✉️ Cold Email"}
          </button>
        </div>

        {result && (
          <div style={{ marginTop: "12px", padding: "8px", background: result.success ? "#f0fdf4" : "#fef2f2", borderRadius: "6px", fontSize: "12px" }}>
            {result.error && <strong style={{color:"#ef4444"}}>{result.error}</strong>}
            {result.success && (
              <>
                <p style={{ whiteSpace: "pre-wrap", color: "#1f2937", margin: "0 0 8px 0" }}>{result.message}</p>
                <button className="sja-btn sja-btn-secondary sja-btn-small" onClick={handleCopy}>📋 Copy</button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
