import React, { useState } from "react";
import { Link, useLocation, Outlet } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { CommandPalette } from "./CommandPalette";
import { OnboardingModal } from "./OnboardingModal";
import { AuthModal } from "./AuthModal";
import {
  LayoutDashboard,
  Briefcase,
  Kanban,
  FileSpreadsheet,
  FileText,
  Cpu,
  Sparkles,
  ShieldCheck,
  CreditCard,
  Settings,
  Bell,
  Play,
  Square,
  Search,
  User,
  Zap,
  Radio,
  ExternalLink,
} from "lucide-react";

export function Layout() {
  const {
    user,
    wsConnected,
    autopilot,
    startAutopilot,
    stopAutopilot,
    notifications,
    unreadNotifsCount,
    markNotifsRead,
    setCmdPaletteOpen,
    setOnboardingOpen,
    logout,
    authModalOpen,
    setAuthModalOpen,
  } = useAuth();

  const location = useLocation();
  const [notifOpen, setNotifOpen] = useState(false);
  const [sidebarExpanded, setSidebarExpanded] = useState(false);

  const navSections = [
    {
      title: "OVERVIEW",
      items: [
        { label: "Dashboard", path: "/", icon: LayoutDashboard },
        { label: "Job Search", path: "/jobs", icon: Briefcase },
      ],
    },
    {
      title: "APPLICATION ASSISTANCE",
      items: [
        { label: "Browser Fleet", path: "/fleet", icon: Cpu },
        { label: "STAR Planner", path: "/copilot", icon: Sparkles },
        { label: "Privacy Vault", path: "/vault", icon: ShieldCheck },
      ],
    },
    {
      title: "TRACKING",
      items: [
        { label: "Pipeline Tracker", path: "/tracker", icon: Kanban },
        { label: "Applications", path: "/applications", icon: FileSpreadsheet },
      ],
    },
    {
      title: "INTELLIGENCE",
      items: [{ label: "Resume Workspace", path: "/resume", icon: FileText }],
    },
    {
      title: "BILLING & CONFIG",
      items: [
        { label: "Plan & Billing", path: "/billing", icon: CreditCard },
        { label: "Settings", path: "/settings", icon: Settings },
      ],
    },
  ];

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "var(--bg0)" }}>
      {/* ── Sidebar ── */}
      <aside
        className={`sb ${sidebarExpanded ? "exp" : ""}`}
        style={{
          width: sidebarExpanded ? "var(--sw2)" : "var(--sw)",
          minWidth: sidebarExpanded ? "var(--sw2)" : "var(--sw)",
          background: "var(--bg1)",
          borderRight: "1px solid var(--b0)",
          display: "flex",
          flexDirection: "column",
          position: "fixed",
          left: 0,
          top: 0,
          bottom: 0,
          zIndex: 100,
          transition: "width 0.22s cubic-bezier(0.4, 0, 0.2, 1), min-width 0.22s",
          overflow: "hidden",
        }}
        onMouseEnter={() => setSidebarExpanded(true)}
        onMouseLeave={() => setSidebarExpanded(false)}
      >
        {/* Logo */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "10px",
            padding: "16px 14px",
            borderBottom: "1px solid var(--b0)",
          }}
        >
          <div
            style={{
              width: "34px",
              height: "34px",
              minWidth: "34px",
              background: "var(--grd-ind)",
              borderRadius: "9px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: "0 4px 14px var(--ind-gl)",
            }}
          >
            <Zap size={18} color="#fff" />
          </div>
          <div
            style={{
              fontFamily: "var(--font2)",
              fontSize: "16px",
              fontWeight: 800,
              whiteSpace: "nowrap",
              opacity: sidebarExpanded ? 1 : 0,
              transition: "opacity 0.18s",
            }}
          >
            Super<span style={{ color: "#818CF8" }}>JobAgent</span>
          </div>
        </div>

        {/* Navigation items */}
        <div style={{ flex: 1, padding: "10px 8px", overflowY: "auto", display: "flex", flexDirection: "column", gap: "2px" }}>
          {navSections.map((sec) => (
            <div key={sec.title} style={{ marginBottom: "6px" }}>
              <div
                style={{
                  fontSize: "9.5px",
                  fontWeight: 700,
                  letterSpacing: "0.1em",
                  textTransform: "uppercase",
                  color: "var(--t4)",
                  padding: "6px 8px 3px",
                  whiteSpace: "nowrap",
                  opacity: sidebarExpanded ? 0.6 : 0,
                  transition: "opacity 0.18s",
                }}
              >
                {sec.title}
              </div>
              {sec.items.map((it) => {
                const Icon = it.icon;
                const isActive = location.pathname === it.path;
                return (
                  <Link
                    key={it.path}
                    to={it.path}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "11px",
                      padding: "9px 8px",
                      borderRadius: "var(--r8)",
                      color: isActive ? "#818CF8" : "var(--t4)",
                      background: isActive ? "rgba(99, 102, 241, 0.14)" : "transparent",
                      position: "relative",
                      transition: "all 0.18s",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {isActive && (
                      <div
                        style={{
                          position: "absolute",
                          left: 0,
                          top: "22%",
                          bottom: "22%",
                          width: "3px",
                          borderRadius: "0 2px 2px 0",
                          background: "var(--ind)",
                        }}
                      />
                    )}
                    <Icon size={17} style={{ minWidth: "17px" }} />
                    <span
                      style={{
                        fontSize: "12.5px",
                        fontWeight: isActive ? 700 : 500,
                        opacity: sidebarExpanded ? 1 : 0,
                        transition: "opacity 0.18s",
                      }}
                    >
                      {it.label}
                    </span>
                  </Link>
                );
              })}
            </div>
          ))}
        </div>

        {/* User footer */}
        <div style={{ padding: "10px 8px", borderTop: "1px solid var(--b0)" }}>
          <div
            onClick={() => setOnboardingOpen(true)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "10px",
              padding: "7px",
              borderRadius: "var(--r8)",
              cursor: "pointer",
              transition: "background 0.18s",
            }}
          >
            <div
              style={{
                width: "32px",
                height: "32px",
                minWidth: "32px",
                borderRadius: "50%",
                background: "var(--grd-ind)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "12px",
                fontWeight: 800,
              }}
            >
              {user?.name ? user.name.slice(0, 2).toUpperCase() : "SK"}
            </div>
            <div style={{ overflow: "hidden", opacity: sidebarExpanded ? 1 : 0, transition: "opacity 0.18s" }}>
              <div style={{ fontSize: "12px", fontWeight: 700, whiteSpace: "nowrap" }}>
                {user?.name || "Guest Engineer"}
              </div>
              <div style={{ fontSize: "10px", color: "var(--em)", fontWeight: 700, textTransform: "uppercase" }}>
                {user?.tier || "Pro Tier"}
              </div>
            </div>
          </div>
        </div>
      </aside>

      {/* ── Main content area ── */}
      <div
        className="main"
        style={{
          marginLeft: "var(--sw)",
          flex: 1,
          display: "flex",
          flexDirection: "column",
          minHeight: "100vh",
          overflowY: "auto",
        }}
      >
        {/* Topbar */}
        <header
          className="topbar"
          style={{
            position: "sticky",
            top: 0,
            zIndex: 80,
            background: "rgba(6, 10, 18, 0.92)",
            backdropFilter: "blur(18px)",
            borderBottom: "1px solid var(--b0)",
            padding: "12px 24px",
            display: "flex",
            alignItems: "center",
            gap: "14px",
          }}
        >
          <div
            style={{
              fontFamily: "var(--font2)",
              fontSize: "17px",
              fontWeight: 800,
              minWidth: "160px",
            }}
          >
            SuperJobAgent
          </div>

          {/* Cmd+K Quick Search trigger */}
          <div
            onClick={() => setCmdPaletteOpen(true)}
            style={{
              flex: 1,
              maxWidth: "380px",
              background: "var(--bg2)",
              border: "1px solid var(--b0)",
              borderRadius: "var(--r8)",
              display: "flex",
              alignItems: "center",
              gap: "8px",
              padding: "7px 12px",
              cursor: "pointer",
              transition: "border-color 0.2s",
            }}
          >
            <Search size={14} color="var(--t4)" />
            <span style={{ fontSize: "12.5px", color: "var(--t4)", flex: 1 }}>
              Search jobs, companies, skills...
            </span>
            <span
              style={{
                fontSize: "10px",
                fontWeight: 700,
                color: "var(--t4)",
                background: "var(--bg3)",
                border: "1px solid var(--b0)",
                borderRadius: "4px",
                padding: "2px 5px",
              }}
            >
              ⌘K
            </span>
          </div>

          {/* Right Controls */}
          <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: "10px" }}>
            {/* Cloud WS Live Indicator */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "6px",
                padding: "5px 12px",
                borderRadius: "20px",
                background: "var(--bg2)",
                border: "1px solid var(--b0)",
                fontSize: "11px",
                fontWeight: 600,
                color: wsConnected ? "var(--em)" : "var(--t4)",
              }}
              title="Ticket-based WebSocket bridge status"
            >
              <div
                style={{
                  width: "6px",
                  height: "6px",
                  borderRadius: "50%",
                  background: wsConnected ? "var(--em)" : "var(--t4)",
                  boxShadow: wsConnected ? "0 0 8px var(--em)" : "none",
                }}
              />
              <span>{wsConnected ? "Cloud Sync Live" : "Offline"}</span>
            </div>

            {/* Autopilot Start / Stop Button */}
            <button
              onClick={() => (autopilot.running ? stopAutopilot() : startAutopilot())}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "7px",
                background: autopilot.running ? "var(--grd-rose)" : "var(--grd-ind)",
                color: "#fff",
                borderRadius: "var(--r8)",
                padding: "7px 16px",
                fontSize: "12.5px",
                fontWeight: 700,
                boxShadow: autopilot.running
                  ? "0 3px 16px rgba(244,63,94,0.3)"
                  : "0 3px 16px var(--ind-gl)",
                transition: "all 0.2s",
              }}
            >
              {autopilot.running ? <Square size={13} fill="#fff" /> : <Play size={13} fill="#fff" />}
              <span>{autopilot.running ? "Stop Autopilot" : "Start Autopilot"}</span>
            </button>

            {/* Notification Bell */}
            <div style={{ position: "relative" }}>
              <button
                onClick={() => {
                  setNotifOpen(!notifOpen);
                  if (!notifOpen) markNotifsRead();
                }}
                style={{
                  width: "34px",
                  height: "34px",
                  background: "var(--bg2)",
                  border: "1px solid var(--b0)",
                  borderRadius: "var(--r8)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "var(--t2)",
                  position: "relative",
                }}
              >
                <Bell size={15} />
                {unreadNotifsCount > 0 && (
                  <div
                    style={{
                      position: "absolute",
                      top: "4px",
                      right: "4px",
                      width: "6px",
                      height: "6px",
                      borderRadius: "50%",
                      background: "var(--rose)",
                    }}
                  />
                )}
              </button>

              {/* Dropdown menu */}
              {notifOpen && (
                <div
                  style={{
                    position: "absolute",
                    top: "42px",
                    right: 0,
                    width: "320px",
                    background: "var(--bg2)",
                    border: "1px solid var(--b1)",
                    borderRadius: "var(--r12)",
                    boxShadow: "0 16px 40px rgba(0,0,0,0.6)",
                    zIndex: 99,
                    overflow: "hidden",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "12px 16px",
                      borderBottom: "1px solid var(--b0)",
                      fontSize: "12.5px",
                      fontWeight: 700,
                    }}
                  >
                    <span>Notifications</span>
                    <span style={{ fontSize: "11px", color: "var(--ind)", cursor: "pointer" }} onClick={markNotifsRead}>
                      Mark all read
                    </span>
                  </div>
                  <div style={{ maxHeight: "280px", overflowY: "auto" }}>
                    {notifications.length === 0 ? (
                      <div style={{ padding: "20px", textAlign: "center", color: "var(--t4)", fontSize: "12px" }}>
                        No notifications
                      </div>
                    ) : (
                      notifications.map((n) => (
                        <div
                          key={n.id}
                          style={{
                            padding: "12px 16px",
                            borderBottom: "1px solid var(--b0)",
                            background: n.read ? "transparent" : "rgba(99,102,241,0.05)",
                          }}
                        >
                          <div style={{ fontSize: "12px", fontWeight: 700, color: "var(--t1)", marginBottom: "2px" }}>
                            {n.title}
                          </div>
                          <div style={{ fontSize: "11px", color: "var(--t3)", lineHeight: 1.4 }}>{n.message}</div>
                          <div style={{ fontSize: "10px", color: "var(--t4)", marginTop: "4px" }}>{n.timestamp}</div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Ultra Plan VIP Badge & Auth Trigger */}
            <div
              onClick={() => setAuthModalOpen(true)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                padding: "6px 14px",
                borderRadius: "20px",
                background: "rgba(167, 139, 250, 0.12)",
                border: "1px solid rgba(167, 139, 250, 0.32)",
                cursor: "pointer",
                transition: "all 0.2s",
              }}
              title="Click to sign in or switch account"
            >
              <Sparkles size={13} color="#A78BFA" />
              <span style={{ fontSize: "11px", fontWeight: 700, color: "#C4B5FD" }}>
                {user?.name || "Ultra VIP Founder"}
              </span>
              <span
                style={{
                  fontSize: "9px",
                  fontWeight: 800,
                  textTransform: "uppercase",
                  padding: "1px 5px",
                  borderRadius: "4px",
                  background: "rgba(167, 139, 250, 0.24)",
                  color: "#fff",
                  letterSpacing: "0.04em",
                }}
              >
                ULTRA
              </span>
            </div>

            {/* Profile trigger */}
            <button
              onClick={() => setOnboardingOpen(true)}
              style={{
                width: "34px",
                height: "34px",
                background: "var(--bg2)",
                border: "1px solid var(--b0)",
                borderRadius: "var(--r8)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "var(--t2)",
              }}
              title="Edit Profile"
            >
              <User size={15} />
            </button>
          </div>
        </header>

        {/* Page View Body */}
        <main style={{ flex: 1, padding: "24px", minHeight: "calc(100vh - 60px)" }}>
          <Outlet />
        </main>
      </div>

      {/* Global Modals */}
      <CommandPalette />
      <OnboardingModal />
      <AuthModal isOpen={authModalOpen} onClose={() => setAuthModalOpen(false)} />
    </div>
  );
}
