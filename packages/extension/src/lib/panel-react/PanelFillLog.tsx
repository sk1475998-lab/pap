/**
 * PanelFillLog — collapsible, real-time log of filled fields.
 */
import React, { useCallback, useRef, useEffect, useState } from "react";
import { usePanelSelector } from "./panel-store.js";
import type { FillLogEntry } from "./panel-store.js";

function formatTime(ms: number): string {
  return ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(1)}s`;
}

function SourceBadge({ source }: { source: FillLogEntry["source"] }) {
  if (source === "profile") return null;
  const label = source === "ai" ? "AI" : source === "learned" ? "Learned" : source === "manual" ? "Manual" : source;
  return (
    <span
      style={{
        marginLeft: 4,
        padding: "0 4px",
        fontSize: 8,
        borderRadius: 4,
        background: "rgba(99,102,241,0.15)",
        color: "#a5b4fc",
        textTransform: "uppercase",
        letterSpacing: 0.3,
        fontWeight: 700,
      }}
    >
      {label}
    </span>
  );
}

function truncate(s: string, max = 25): string {
  return s.length > max ? s.slice(0, max) + "…" : (s || "—");
}

const CheckMark = () => (
  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="m5 12 5 5L20 7" />
  </svg>
);
const WarnMark = () => (
  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#fbbf24" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M12 9v4M12 17h.01"/><path d="M10.3 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z"/>
  </svg>
);

const FillEntryRow: React.FC<{ entry: FillLogEntry }> = React.memo(({ entry }) => {
  return (
    <div className="sja-fill-entry" role="listitem">
      <span className="sja-fl-icon" style={{ display: "inline-flex", alignItems: "center" }}>
        {entry.ok ? <CheckMark /> : <WarnMark />}
      </span>
      <span className="sja-fl-label" title={entry.label}>{entry.label}</span>
      <span className="sja-fl-arrow" aria-hidden="true">
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 5l7 7-7 7"/></svg>
      </span>
      <span className="sja-fl-value">"{truncate(entry.value)}"<SourceBadge source={entry.source} /></span>
      <span className="sja-fl-time">{formatTime(entry.timeMs)}</span>
    </div>
  );
});

FillEntryRow.displayName = "FillEntryRow";

export const PanelFillLog: React.FC = () => {
  const fillLog = usePanelSelector((s) => s.fillLog);
  const [collapsed, setCollapsed] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom on new entries
  useEffect(() => {
    if (scrollRef.current && !collapsed) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [fillLog.length, collapsed]);

  const toggleCollapse = useCallback(() => {
    setCollapsed((c) => !c);
  }, []);

  if (fillLog.length === 0) return null;

  return (
    <div className="sja-card" role="log" aria-label="Fill log">
      <div className="sja-card-title" onClick={toggleCollapse}
        style={{ cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6, width: "100%" }} role="button" tabIndex={0}
        aria-expanded={!collapsed}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") toggleCollapse(); }}>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6Z"/><path d="M14 2v6h6M16 13H8M16 17H8M10 9H8"/></svg>
        Fill Log ({fillLog.length})
        <span style={{ marginLeft: "auto", fontSize: "10px", transform: collapsed ? "rotate(-90deg)" : "none", transition: "transform 150ms", display: "inline-block" }}>
          ▾
        </span>
      </div>
      {!collapsed && (
        <div className="sja-fill-log" ref={scrollRef} role="list">
          {fillLog.map((entry) => (
            <FillEntryRow key={entry.id} entry={entry} />
          ))}
        </div>
      )}
    </div>
  );
};
