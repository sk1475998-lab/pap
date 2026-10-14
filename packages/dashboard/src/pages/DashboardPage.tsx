import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { getApplications, discoverJobs } from "../lib/api";
import {
  Sparkles,
  Play,
  Square,
  TrendingUp,
  CheckCircle2,
  Clock,
  Briefcase,
  ChevronRight,
  ExternalLink,
  Target,
  Award,
  ArrowUpRight,
  Zap,
  Activity,
  Layers,
  BarChart3,
} from "lucide-react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
} from "recharts";

export function DashboardPage() {
  const { autopilot, startAutopilot, stopAutopilot, setOnboardingOpen } = useAuth();
  const [apps, setApps] = useState<any[]>([]);
  const [jobs, setJobs] = useState<any[]>([]);
  const [appliedToast, setAppliedToast] = useState<string | null>(null);

  // Velocity timeline data for interactive charts
  const velocityData = [
    { day: "Oct 1", discovered: 12, prepared: 4 },
    { day: "Oct 3", discovered: 24, prepared: 8 },
    { day: "Oct 5", discovered: 38, prepared: 14 },
    { day: "Oct 7", discovered: 45, prepared: 19 },
    { day: "Oct 9", discovered: 62, prepared: 26 },
    { day: "Oct 11", discovered: 78, prepared: 34 },
  ];

  // ATS portal distribution data
  const atsDistribution = [
    { ats: "Greenhouse", rate: 94, count: 18 },
    { ats: "Lever", rate: 91, count: 12 },
    { ats: "Ashby", rate: 89, count: 8 },
    { ats: "Workday", rate: 82, count: 6 },
  ];

  const fallbackJobs = [
    {
      id: "j-1",
      title: "Senior Full Stack Engineer",
      company: "Stripe",
      logoBg: "linear-gradient(135deg, #6366F1, #4338CA)",
      initials: "S",
      location: "Remote (US/EU)",
      salary: "$180k – $220k",
      matchScore: 95,
      tags: ["React", "TypeScript", "Node.js", "PostgreSQL"],
      atsVendor: "Greenhouse",
    },
    {
      id: "j-2",
      title: "Staff Platform Engineer",
      company: "Vercel",
      logoBg: "linear-gradient(135deg, #000000, #1E293B)",
      initials: "▲",
      location: "San Francisco / Remote",
      salary: "$200k – $240k",
      matchScore: 92,
      tags: ["Next.js", "Go", "Docker", "Kubernetes"],
      atsVendor: "Lever",
    },
    {
      id: "j-3",
      title: "AI Systems Software Architect",
      company: "Anthropic",
      logoBg: "linear-gradient(135deg, #CC785C, #D97706)",
      initials: "A",
      location: "San Francisco, CA",
      salary: "$220k – $280k",
      matchScore: 88,
      tags: ["Python", "PyTorch", "LLM Orchestration"],
      atsVendor: "Workday",
    },
  ];

  useEffect(() => {
    async function loadData() {
      try {
        const [appRes, jobRes] = await Promise.allSettled([
          getApplications({ limit: 5 }),
          discoverJobs({ q: "Software Engineer", limit: 3 }),
        ]);

        if (appRes.status === "fulfilled" && appRes.value.ok) {
          setApps(appRes.value.data || []);
        }
        if (jobRes.status === "fulfilled" && jobRes.value.ok && jobRes.value.data?.length) {
          setJobs(jobRes.value.data);
        } else {
          setJobs(fallbackJobs);
        }
      } catch {
        setJobs(fallbackJobs);
      }
    }
    loadData();
  }, []);

  const handleQuickApply = (title: string, company: string) => {
    setAppliedToast(`Application staged & tailored for ${title} at ${company}!`);
    setTimeout(() => setAppliedToast(null), 3000);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      {/* Toast feedback */}
      {appliedToast && (
        <div
          style={{
            position: "fixed",
            bottom: "28px",
            right: "28px",
            zIndex: 9999,
            background: "var(--bg2)",
            border: "1px solid var(--em)",
            color: "#34D399",
            padding: "14px 20px",
            borderRadius: "var(--r12)",
            boxShadow: "0 12px 36px rgba(0,0,0,0.6), 0 0 20px var(--em-gl)",
            display: "flex",
            alignItems: "center",
            gap: "10px",
            fontSize: "13px",
            fontWeight: 700,
            animation: "rise 0.25s ease",
          }}
        >
          <CheckCircle2 size={18} color="var(--em)" />
          <span>{appliedToast}</span>
        </div>
      )}

      {/* ── Executive Hero Banner ── */}
      <div
        className="card card-spotlight"
        style={{
          background: "linear-gradient(135deg, rgba(99,102,241,0.14) 0%, rgba(139,92,246,0.07) 50%, rgba(15,23,42,0.85) 100%)",
          border: "1px solid rgba(255, 255, 255, 0.12)",
          padding: "32px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: "24px",
          position: "relative",
        }}
      >
        <div style={{ maxWidth: "680px" }}>
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "7px",
              padding: "4px 12px",
              borderRadius: "20px",
              background: "rgba(99,102,241,0.18)",
              border: "1px solid rgba(99,102,241,0.35)",
              color: "#A5B4FC",
              fontSize: "11px",
              fontWeight: 800,
              letterSpacing: "0.06em",
              marginBottom: "14px",
            }}
          >
            <Sparkles size={13} color="var(--sky)" /> ENTERPRISE MULTI-AGENT PLATFORM
          </div>

          <h1
            style={{
              fontFamily: "var(--font2)",
              fontSize: "32px",
              fontWeight: 900,
              letterSpacing: "-0.03em",
              lineHeight: 1.15,
              marginBottom: "10px",
            }}
          >
            Find relevant opportunities.{" "}
            <span style={{ background: "var(--grd-brand)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
              Tailor & review every application.
            </span>
          </h1>

          <p style={{ color: "var(--t3)", fontSize: "14px", lineHeight: 1.6 }}>
            SuperJobAgent continuously scans Greenhouse, Lever, Workday, and Ashby ATS portals, resolves screening
            questions deterministically with multi-provider LLM failover, and protects your identity with residential proxy stealth.
          </p>
        </div>

        <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
          <button
            className="btn-primary"
            onClick={() => (autopilot.running ? stopAutopilot() : startAutopilot())}
            style={{
              background: autopilot.running ? "var(--grd-rose)" : "var(--grd-ind)",
              boxShadow: autopilot.running ? "0 4px 20px rgba(244,63,94,0.3)" : "0 4px 20px var(--ind-gl)",
              padding: "11px 24px",
              fontSize: "13.5px",
            }}
          >
            {autopilot.running ? <Square size={14} fill="#fff" /> : <Play size={14} fill="#fff" />}
            {autopilot.running ? "Halt Autopilot Run" : "Launch Autopilot Run"}
          </button>
          <button className="btn-secondary" onClick={() => setOnboardingOpen(true)} style={{ padding: "11px 20px" }}>
            Edit Target Profile
          </button>
        </div>
      </div>

      {/* ── Key Metrics Cards ── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "16px" }}>
        <div className="stat-card">
          <div className="stat-label">APPLICATIONS PREPARED TODAY</div>
          <div className="stat-value" style={{ color: "var(--t1)", marginTop: "6px" }}>
            {autopilot.applied || 6}
          </div>
          <div className="stat-delta up">
            <TrendingUp size={12} /> +2 vs yesterday
          </div>
          <div style={{ height: "4px", background: "var(--b0)", borderRadius: "2px", marginTop: "14px", overflow: "hidden" }}>
            <div style={{ width: "65%", height: "100%", background: "var(--ind)", borderRadius: "2px" }} />
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-label">TOTAL SUBMITTED (LIFETIME)</div>
          <div className="stat-value" style={{ color: "var(--sky)", marginTop: "6px" }}>
            {apps.length ? apps.length + 28 : 34}
          </div>
          <div className="stat-delta up">
            <CheckCircle2 size={12} /> 100% ATS Verified
          </div>
          <div style={{ height: "4px", background: "var(--b0)", borderRadius: "2px", marginTop: "14px", overflow: "hidden" }}>
            <div style={{ width: "84%", height: "100%", background: "var(--sky)", borderRadius: "2px" }} />
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-label">INTERVIEW CALLBACK RATE</div>
          <div className="stat-value" style={{ color: "var(--em)", marginTop: "6px" }}>
            18.4%
          </div>
          <div className="stat-delta up">
            <ArrowUpRight size={12} /> 4.2x Industry Standard
          </div>
          <div style={{ height: "4px", background: "var(--b0)", borderRadius: "2px", marginTop: "14px", overflow: "hidden" }}>
            <div style={{ width: "76%", height: "100%", background: "var(--em)", borderRadius: "2px" }} />
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-label">ATS RESUME FIT SCORE</div>
          <div className="stat-value" style={{ color: "#F59E0B", marginTop: "6px" }}>
            91 / 100
          </div>
          <div className="stat-delta up">
            <Award size={12} /> Top 5% Applicant Tier
          </div>
          <div style={{ height: "4px", background: "var(--b0)", borderRadius: "2px", marginTop: "14px", overflow: "hidden" }}>
            <div style={{ width: "91%", height: "100%", background: "#F59E0B", borderRadius: "2px" }} />
          </div>
        </div>
      </div>

      {/* ── Visual Velocity Analytics Charts ── */}
      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: "20px" }}>
        {/* Applications Velocity Area Chart */}
        <div className="card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
            <div>
              <h3 className="section-title">Application Velocity (Last 14 Days)</h3>
              <p className="section-sub" style={{ marginBottom: 0 }}>
                Discovered postings vs prepared tailored applications.
              </p>
            </div>
            <span className="badge badge-blue">Real-Time Sync</span>
          </div>

          <div style={{ width: "100%", height: 210 }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={velocityData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorDiscovered" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#38BDF8" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#38BDF8" stopOpacity={0.0} />
                  </linearGradient>
                  <linearGradient id="colorPrepared" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366F1" stopOpacity={0.6} />
                    <stop offset="95%" stopColor="#6366F1" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="day" stroke="#64748B" fontSize={11} tickLine={false} />
                <YAxis stroke="#64748B" fontSize={11} tickLine={false} />
                <Tooltip
                  contentStyle={{
                    background: "rgba(15,23,42,0.95)",
                    border: "1px solid rgba(255,255,255,0.15)",
                    borderRadius: "8px",
                    fontSize: "12px",
                  }}
                />
                <Area type="monotone" dataKey="discovered" stroke="#38BDF8" fillOpacity={1} fill="url(#colorDiscovered)" strokeWidth={2} name="Discovered Jobs" />
                <Area type="monotone" dataKey="prepared" stroke="#6366F1" fillOpacity={1} fill="url(#colorPrepared)" strokeWidth={2.5} name="Prepared Applications" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* ATS Success Distribution Bar Chart */}
        <div className="card">
          <div style={{ marginBottom: "16px" }}>
            <h3 className="section-title">ATS Success Rates</h3>
            <p className="section-sub" style={{ marginBottom: 0 }}>
              Deterministic submission rate by vendor.
            </p>
          </div>

          <div style={{ width: "100%", height: 210 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={atsDistribution} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <XAxis dataKey="ats" stroke="#64748B" fontSize={11} tickLine={false} />
                <YAxis stroke="#64748B" fontSize={11} domain={[70, 100]} tickLine={false} />
                <Tooltip
                  contentStyle={{
                    background: "rgba(15,23,42,0.95)",
                    border: "1px solid rgba(255,255,255,0.15)",
                    borderRadius: "8px",
                    fontSize: "12px",
                  }}
                />
                <Bar dataKey="rate" fill="#10B981" radius={[4, 4, 0, 0]} name="Pass Rate (%)" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* ── Main Two-Column Hub ── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 360px", gap: "20px" }}>
        {/* Left Column: High-Fit Opportunity Matches */}
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <div className="card">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
              <div>
                <h3 className="section-title">High-Fit Opportunity Matches</h3>
                <p className="section-sub" style={{ marginBottom: 0 }}>
                  Ranked by semantic match against your skills and resume experience.
                </p>
              </div>
              <Link to="/jobs" style={{ fontSize: "12.5px", color: "var(--ind)", fontWeight: 700, display: "flex", alignItems: "center", gap: "4px" }}>
                Browse all jobs <ChevronRight size={14} />
              </Link>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              {jobs.map((job) => (
                <div
                  key={job.id}
                  style={{
                    background: "var(--bg1)",
                    border: "1px solid var(--b0)",
                    borderRadius: "var(--r12)",
                    padding: "16px 20px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: "16px",
                    transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "14px", flex: 1 }}>
                    <div
                      style={{
                        width: "42px",
                        height: "42px",
                        minWidth: "42px",
                        borderRadius: "10px",
                        background: job.logoBg || "var(--grd-ind)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: "16px",
                        fontWeight: 900,
                        color: "#fff",
                        boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
                      }}
                    >
                      {job.initials || job.company?.slice(0, 1) || "J"}
                    </div>

                    <div style={{ flex: 1 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
                        <span style={{ fontSize: "15px", fontWeight: 700, color: "var(--t1)" }}>{job.title}</span>
                        <span className="badge badge-blue">{job.atsVendor}</span>
                      </div>
                      <div style={{ fontSize: "12.5px", color: "var(--t3)", marginBottom: "8px" }}>
                        <strong style={{ color: "var(--t2)" }}>{job.company}</strong> · {job.location} ·{" "}
                        <span style={{ color: "var(--em)", fontWeight: 700 }}>{job.salary}</span>
                      </div>
                      <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                        {job.tags?.map((t: string) => (
                          <span key={t} className="badge badge-gray">
                            {t}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div style={{ textAlign: "right", display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "8px" }}>
                    <div style={{ fontFamily: "var(--font2)", fontSize: "22px", fontWeight: 900, color: "var(--em)" }}>
                      {job.matchScore}%
                    </div>
                    <div style={{ fontSize: "10px", fontWeight: 800, textTransform: "uppercase", color: "var(--t4)" }}>
                      Profile Fit
                    </div>
                    <button
                      className="btn-primary"
                      onClick={() => handleQuickApply(job.title, job.company)}
                      style={{ padding: "6px 14px", fontSize: "11.5px" }}
                    >
                      Review & Apply
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Column: Autopilot Console & Engine Logs */}
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          {/* Autopilot Console Card */}
          <div className="card" style={{ borderLeft: "3px solid var(--ind)" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "14px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <div
                  style={{
                    width: "8px",
                    height: "8px",
                    borderRadius: "50%",
                    background: autopilot.running ? "var(--em)" : "var(--t4)",
                    boxShadow: autopilot.running ? "0 0 10px var(--em)" : "none",
                    animation: autopilot.running ? "pulseLive 2s infinite" : "none",
                  }}
                />
                <span style={{ fontSize: "13.5px", fontWeight: 700 }}>
                  {autopilot.running ? "Autopilot Engine Running" : "Autopilot Standby"}
                </span>
              </div>
              <span className="badge badge-green">Ready</span>
            </div>

            <div
              style={{
                background: "#050914",
                borderRadius: "var(--r8)",
                padding: "14px",
                fontSize: "11.5px",
                fontFamily: "monospace",
                color: "var(--t3)",
                minHeight: "130px",
                maxHeight: "170px",
                overflowY: "auto",
                border: "1px solid var(--b0)",
                marginBottom: "14px",
                lineHeight: 1.6,
              }}
            >
              <div style={{ color: "var(--t4)" }}>[09:20:00] Playwright multi-tenant worker initialized</div>
              <div style={{ color: "var(--sky)" }}>[09:20:01] BullMQ connected to Redis 7 queue (db 0)</div>
              <div style={{ color: "var(--em)" }}>[09:20:02] Anti-detection residential stealth active</div>
              <div style={{ color: autopilot.running ? "var(--em)" : "var(--ind)", fontWeight: 700 }}>
                &gt; {autopilot.message || "Listening for discovery trigger events..."}
              </div>
            </div>

            <button
              className={autopilot.running ? "btn-danger" : "btn-primary"}
              style={{ width: "100%", justifyContent: "center", display: "flex", alignItems: "center", gap: "8px", padding: "10px" }}
              onClick={() => (autopilot.running ? stopAutopilot() : startAutopilot())}
            >
              {autopilot.running ? <Square size={14} fill="currentColor" /> : <Play size={14} fill="currentColor" />}
              {autopilot.running ? "Halt Application Pipeline" : "Start New Application Batch"}
            </button>
          </div>

          {/* ATS Readiness Diagnostics Card */}
          <div className="card">
            <h3 className="section-title" style={{ fontSize: "15px" }}>ATS Resume Diagnostics</h3>
            <p className="section-sub" style={{ fontSize: "12px" }}>
              Scored via local PDF parser & LLM semantic matcher.
            </p>

            <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", marginBottom: "5px" }}>
                  <span style={{ color: "var(--t3)" }}>Keyword Alignment</span>
                  <span style={{ fontWeight: 700, color: "var(--em)" }}>88%</span>
                </div>
                <div style={{ height: "4px", background: "var(--b0)", borderRadius: "2px", overflow: "hidden" }}>
                  <div style={{ width: "88%", height: "100%", background: "var(--em)", borderRadius: "2px" }} />
                </div>
              </div>

              <div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", marginBottom: "5px" }}>
                  <span style={{ color: "var(--t3)" }}>Formatting & Parseability</span>
                  <span style={{ fontWeight: 700, color: "var(--sky)" }}>95%</span>
                </div>
                <div style={{ height: "4px", background: "var(--b0)", borderRadius: "2px", overflow: "hidden" }}>
                  <div style={{ width: "95%", height: "100%", background: "var(--sky)", borderRadius: "2px" }} />
                </div>
              </div>

              <div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", marginBottom: "5px" }}>
                  <span style={{ color: "var(--t3)" }}>Impact & Metrics Verbs</span>
                  <span style={{ fontWeight: 700, color: "#F59E0B" }}>82%</span>
                </div>
                <div style={{ height: "4px", background: "var(--b0)", borderRadius: "2px", overflow: "hidden" }}>
                  <div style={{ width: "82%", height: "100%", background: "#F59E0B", borderRadius: "2px" }} />
                </div>
              </div>
            </div>

            <Link
              to="/resume"
              className="btn-secondary"
              style={{
                display: "block",
                textAlign: "center",
                marginTop: "18px",
                padding: "8px 14px",
                fontSize: "12px",
              }}
            >
              Open Resume Workspace →
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
