import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import {
  Search,
  LayoutDashboard,
  Briefcase,
  Kanban,
  FileText,
  Cpu,
  ShieldCheck,
  CreditCard,
  Settings,
  Play,
  Square,
  Sparkles,
  ExternalLink,
} from "lucide-react";

export function CommandPalette() {
  const { cmdPaletteOpen, setCmdPaletteOpen, autopilot, startAutopilot, stopAutopilot } = useAuth();
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);

  const actions = [
    {
      category: "Navigation",
      items: [
        { label: "Dashboard", path: "/", icon: LayoutDashboard, desc: "Overview & executive metrics" },
        { label: "Job Search", path: "/jobs", icon: Briefcase, desc: "Find live postings across boards" },
        { label: "Application Tracker", path: "/tracker", icon: Kanban, desc: "Kanban pipeline view" },
        { label: "Applications List", path: "/applications", icon: FileText, desc: "Filter and export applications" },
        { label: "Resume Workspace", path: "/resume", icon: FileText, desc: "ATS readiness & tailoring" },
        { label: "Browser Fleet", path: "/fleet", icon: Cpu, desc: "BullMQ queue & worker fleet" },
        { label: "STAR Answer Planner", path: "/copilot", icon: Sparkles, desc: "AI screening answers" },
        { label: "Privacy Vault", path: "/vault", icon: ShieldCheck, desc: "Data protection & GDPR export" },
        { label: "Plan & Billing", path: "/billing", icon: CreditCard, desc: "Subscriptions & quotas" },
        { label: "Settings", path: "/settings", icon: Settings, desc: "LLM providers & proxy" },
      ],
    },
    {
      category: "Actions",
      items: [
        autopilot.running
          ? {
              label: "Stop Autopilot",
              action: async () => {
                await stopAutopilot();
              },
              icon: Square,
              desc: "Halt currently running preparation tasks",
            }
          : {
              label: "Start Autopilot",
              action: async () => {
                await startAutopilot();
              },
              icon: Play,
              desc: "Run automated preparation loop",
            },
        {
          label: "Search Jobs for 'Software Engineer'",
          path: "/jobs?q=Software+Engineer",
          icon: Search,
          desc: "Instant search for SWE roles",
        },
      ],
    },
  ];

  const allFiltered = actions.flatMap((grp) =>
    grp.items.filter(
      (item) =>
        item.label.toLowerCase().includes(query.toLowerCase()) ||
        (item.desc && item.desc.toLowerCase().includes(query.toLowerCase()))
    )
  );

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  const handleSelect = (item: any) => {
    setCmdPaletteOpen(false);
    setQuery("");
    if (item.action) {
      item.action();
    } else if (item.path) {
      navigate(item.path);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % (allFiltered.length || 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev - 1 + allFiltered.length) % (allFiltered.length || 1));
    } else if (e.key === "Enter" && allFiltered[selectedIndex]) {
      e.preventDefault();
      handleSelect(allFiltered[selectedIndex]);
    } else if (e.key === "Escape") {
      setCmdPaletteOpen(false);
    }
  };

  if (!cmdPaletteOpen) return null;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        background: "rgba(6, 10, 18, 0.8)",
        backdropFilter: "blur(16px)",
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "center",
        paddingTop: "14vh",
      }}
      onClick={() => setCmdPaletteOpen(false)}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "600px",
          background: "var(--bg2)",
          border: "1px solid var(--b1)",
          borderRadius: "var(--r16)",
          boxShadow: "0 24px 60px rgba(0,0,0,0.6), 0 0 40px rgba(99,102,241,0.15)",
          overflow: "hidden",
        }}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        {/* Search Input Bar */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "12px",
            padding: "16px 20px",
            borderBottom: "1px solid var(--b0)",
          }}
        >
          <Search size={18} color="var(--ind)" />
          <input
            autoFocus
            type="text"
            placeholder="Type a command or search... (Esc to close)"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            style={{
              flex: 1,
              background: "transparent",
              border: "none",
              outline: "none",
              color: "var(--t1)",
              fontSize: "15px",
              fontWeight: 500,
            }}
          />
          <span
            style={{
              fontSize: "10px",
              fontWeight: 700,
              color: "var(--t4)",
              background: "var(--bg3)",
              border: "1px solid var(--b0)",
              borderRadius: "4px",
              padding: "2px 6px",
            }}
          >
            ESC
          </span>
        </div>

        {/* Results List */}
        <div style={{ maxHeight: "360px", overflowY: "auto", padding: "8px" }}>
          {allFiltered.length === 0 ? (
            <div style={{ padding: "32px", textAlign: "center", color: "var(--t4)", fontSize: "13px" }}>
              No commands or pages matching "{query}"
            </div>
          ) : (
            allFiltered.map((item, idx) => {
              const Icon = item.icon || ExternalLink;
              const isSelected = idx === selectedIndex;
              return (
                <div
                  key={item.label}
                  onClick={() => handleSelect(item)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "12px",
                    padding: "10px 14px",
                    borderRadius: "var(--r8)",
                    cursor: "pointer",
                    background: isSelected ? "rgba(99, 102, 241, 0.16)" : "transparent",
                    color: isSelected ? "#fff" : "var(--t2)",
                    transition: "all 0.12s ease",
                  }}
                  onMouseEnter={() => setSelectedIndex(idx)}
                >
                  <Icon size={16} color={isSelected ? "var(--sky)" : "var(--t4)"} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: "13px", fontWeight: isSelected ? 700 : 500 }}>{item.label}</div>
                    {item.desc && <div style={{ fontSize: "11px", color: "var(--t4)" }}>{item.desc}</div>}
                  </div>
                  {isSelected && (
                    <span style={{ fontSize: "11px", color: "var(--ind)", fontWeight: 600 }}>↵ Select</span>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "10px 18px",
            borderTop: "1px solid var(--b0)",
            background: "var(--bg1)",
            fontSize: "11px",
            color: "var(--t4)",
          }}
        >
          <div>Navigate: ↑ ↓ · Select: ↵ · Close: ESC</div>
          <div style={{ color: "var(--ind)" }}>SuperJobAgent Command Hub</div>
        </div>
      </div>
    </div>
  );
}
