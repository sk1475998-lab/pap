/**
 * PanelHeader — score ring, platform, step, and window controls.
 */
import React, { useCallback, useEffect, useRef } from "react";
import { usePanelSelector, panelStore } from "./panel-store.js";
import { IconBolt } from "../icons.jsx";

const CIRCUMFERENCE = 119.4; // 2 * π * 19

const BoltLogo: React.FC = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M13 2 4 14h7l-1 8 9-12h-7l1-8Z" />
  </svg>
);

const DockIcon: React.FC = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M8 3H5a2 2 0 0 0-2 2v3M21 8V5a2 2 0 0 0-2-2h-3M3 16v3a2 2 0 0 0 2 2h3M16 21h3a2 2 0 0 0 2-2v-3" />
  </svg>
);

const MinIcon: React.FC = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
    <path d="M5 12h14" />
  </svg>
);

export const PanelHeader: React.FC = () => {
  const score = usePanelSelector((s) => s.score);
  const matched = usePanelSelector((s) => s.matchedKeywords);
  const total = usePanelSelector((s) => s.totalKeywords);
  const platform = usePanelSelector((s) => s.platform);
  const step = usePanelSelector((s) => s.step);
  const minimized = usePanelSelector((s) => s.minimized);
  const docked = usePanelSelector((s) => s.docked);
  const ringRef = useRef<SVGCircleElement>(null);
  const prevScore = useRef(score);

  // Pulse animation on score change
  useEffect(() => {
    if (score !== prevScore.current && ringRef.current) {
      const ring = ringRef.current.closest(".sja-ring") as HTMLElement | null;
      if (ring) {
        ring.classList.remove("sja-ring-pulse");
        void ring.offsetWidth; // force reflow
        ring.classList.add("sja-ring-pulse");
      }
      prevScore.current = score;
    }
  }, [score]);

  const scoreColor = score >= 80 ? "#22c55e" : score >= 60 ? "#eab308" : "#ef4444";
  const dashOffset = CIRCUMFERENCE * (1 - score / 100);

  const toggleMinimize = useCallback(() => {
    panelStore.setMinimized(!minimized);
  }, [minimized]);

  const toggleDock = useCallback(() => {
    panelStore.setDocked(!docked);
  }, [docked]);

  if (minimized) {
    return (
      <div className="sja-min-bar" onClick={toggleMinimize} role="button" tabIndex={0}
        aria-label="Expand Super Job Agent panel"
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") toggleMinimize(); }}
        style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
        <IconBolt size={12} /> SJA
      </div>
    );
  }

  return (
    <>
      <div className="sja-head" role="banner">
        <span className="sja-logo" style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
          <span className="sja-logo-icon" aria-hidden="true"><BoltLogo /></span>
          Super Job Agent
        </span>
        <button className="sja-icon-btn" onClick={toggleDock}
          title={docked ? "Float" : "Dock"} aria-label={docked ? "Float panel" : "Dock panel"}>
          <DockIcon />
        </button>
        <button className="sja-icon-btn" onClick={toggleMinimize}
          title="Minimize" aria-label="Minimize panel">
          <MinIcon />
        </button>
      </div>

      <div className="sja-body" role="main">
        {platform && <div className="sja-platform" style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <rect x="8" y="2" width="8" height="4" rx="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><path d="M9 14l2 2 4-4"/>
          </svg>
          {platform}
        </div>}
        {step && <div className="sja-step">Step: {step}</div>}

        <div className="sja-score-row">
          <div className="sja-ring" aria-label={`Match score: ${score} percent`}>
            <svg width="48" height="48" viewBox="0 0 48 48">
              <circle className="sja-track" cx="24" cy="24" r="19"
                fill="none" strokeWidth="4" />
              <circle ref={ringRef} className="sja-bar" cx="24" cy="24" r="19"
                fill="none" strokeWidth="4" stroke={scoreColor}
                strokeDasharray={CIRCUMFERENCE}
                strokeDashoffset={dashOffset} />
            </svg>
            <div className="sja-ring-num">{score || "--"}</div>
          </div>
          <div className="sja-kw-info">
            <span className="sja-kw-count">{matched}/{total}</span> keywords
          </div>
        </div>
      </div>
    </>
  );
};
