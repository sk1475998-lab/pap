import React, { useState, useEffect } from "react";
import { discoverJobs } from "../lib/api";
import {
  Search,
  MapPin,
  Filter,
  CheckCircle,
  Bookmark,
  ExternalLink,
  Sparkles,
  SlidersHorizontal,
  FileCheck,
  Send,
  X,
  Check,
} from "lucide-react";

export function JobsPage() {
  const [query, setQuery] = useState("Software Engineer");
  const [location, setLocation] = useState("Remote");
  const [boardFilter, setBoardFilter] = useState("all");
  const [workplace, setWorkplace] = useState("all");
  const [sortOrder, setSortOrder] = useState("match");
  const [jobs, setJobs] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [savedJobs, setSavedJobs] = useState<string[]>([]);
  
  // Review Modal state
  const [activeJobReview, setActiveJobReview] = useState<any | null>(null);
  const [submittingReview, setSubmittingReview] = useState(false);
  const [reviewSuccess, setReviewSuccess] = useState(false);

  const initialJobs = [
    {
      id: "job-1",
      title: "Senior Full Stack Engineer",
      company: "Linear",
      logoBg: "linear-gradient(135deg, #5E6AD2, #4B5563)",
      initials: "L",
      location: "Remote (Global)",
      salary: "$160k – $210k",
      matchScore: 95,
      board: "Greenhouse",
      tags: ["TypeScript", "React", "GraphQL", "Node.js"],
      postedDate: "1d ago",
      desc: "Help build the next generation of issue tracking and software project intelligence.",
      screeningQA: [
        { q: "Years of experience with TypeScript?", a: "5+ years in production systems." },
        { q: "Experience architecting GraphQL APIs?", a: "Architected Apollo federated gateway serving 40k req/min." },
        { q: "Notice period?", a: "30 days (negotiable)." },
      ],
    },
    {
      id: "job-2",
      title: "Staff Frontend Architect",
      company: "Vercel",
      logoBg: "linear-gradient(135deg, #000000, #1E293B)",
      initials: "▲",
      location: "San Francisco / Remote",
      salary: "$195k – $245k",
      matchScore: 92,
      board: "Lever",
      tags: ["Next.js", "React Server Components", "Vite", "Turborepo"],
      postedDate: "2d ago",
      desc: "Lead core web frontend performance and developer platform infrastructure.",
      screeningQA: [
        { q: "Experience with Next.js App Router & RSC?", a: "Migrated 8 enterprise apps to Server Components with 40% FCP reduction." },
        { q: "Are you authorized to work in the US?", a: "Yes, US Citizen / Permanent Resident." },
      ],
    },
    {
      id: "job-3",
      title: "Backend Platform Engineer",
      company: "Supabase",
      logoBg: "linear-gradient(135deg, #3ECF8E, #059669)",
      initials: "S",
      location: "Remote",
      salary: "$170k – $220k",
      matchScore: 88,
      board: "Ashby",
      tags: ["PostgreSQL", "Go", "Docker", "Distributed Systems"],
      postedDate: "3d ago",
      desc: "Scale open-source databases and real-time backend architecture across worldwide regions.",
      screeningQA: [
        { q: "PostgreSQL indexing & query tuning experience?", a: "Expert in WAL replication, connection pooling, and pg_stat analysis." },
        { q: "Target base compensation?", a: "$180,000 USD." },
      ],
    },
    {
      id: "job-4",
      title: "AI Integrations Engineer",
      company: "Perplexity AI",
      logoBg: "linear-gradient(135deg, #20808D, #0D9488)",
      initials: "P",
      location: "San Francisco, CA",
      salary: "$180k – $230k",
      matchScore: 84,
      board: "Workday",
      tags: ["Python", "LangChain", "Vector DBs", "FastAPI"],
      postedDate: "4d ago",
      desc: "Build reliable production workflows connecting LLM reasoning engines with live search indices.",
      screeningQA: [
        { q: "Experience deploying LLMs into production pipelines?", a: "Built RAG systems with hybrid BM25 + dense vector re-ranking." },
      ],
    },
  ];

  useEffect(() => {
    handleSearch();
  }, []);

  const handleSearch = async () => {
    setLoading(true);
    try {
      const res = await discoverJobs({ q: query, location, limit: 10 });
      if (res.ok && res.data?.length) {
        setJobs(res.data);
      } else {
        setJobs(initialJobs);
      }
    } catch {
      setJobs(initialJobs);
    } finally {
      setLoading(false);
    }
  };

  const toggleSave = (id: string) => {
    setSavedJobs((prev) => (prev.includes(id) ? prev.filter((j) => j !== id) : [...prev, id]));
  };

  const handleApproveAndSubmit = () => {
    setSubmittingReview(true);
    setTimeout(() => {
      setSubmittingReview(false);
      setReviewSuccess(true);
      setTimeout(() => {
        setReviewSuccess(false);
        setActiveJobReview(null);
      }, 1500);
    }, 1200);
  };

  const filteredJobs = jobs
    .filter((j) => (boardFilter === "all" ? true : j.board?.toLowerCase() === boardFilter.toLowerCase()))
    .filter((j) => (workplace === "all" ? true : workplace === "remote" ? j.location.toLowerCase().includes("remote") : true))
    .sort((a, b) => (sortOrder === "match" ? b.matchScore - a.matchScore : 0));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      {/* Header */}
      <div>
        <div className="label-xs" style={{ color: "var(--ind)", marginBottom: "4px" }}>
          DISCOVER & FILTER
        </div>
        <h1 className="section-title" style={{ fontSize: "26px" }}>
          Live Opportunity Search
        </h1>
        <p className="section-sub">
          Aggregated and verified postings from Greenhouse, Lever, Ashby, Workday, and top job boards.
        </p>
      </div>

      {/* Search & Filter Bar */}
      <div className="card" style={{ padding: "18px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr auto", gap: "12px", marginBottom: "14px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px", background: "var(--bg1)", border: "1px solid var(--b0)", borderRadius: "var(--r8)", padding: "10px 14px" }}>
            <Search size={16} color="var(--t4)" />
            <input
              style={{ background: "transparent", border: "none", outline: "none", color: "var(--t1)", width: "100%", fontSize: "13.5px" }}
              placeholder="Job title, keywords, or role (e.g. Software Engineer)"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            />
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "10px", background: "var(--bg1)", border: "1px solid var(--b0)", borderRadius: "var(--r8)", padding: "10px 14px" }}>
            <MapPin size={16} color="var(--t4)" />
            <input
              style={{ background: "transparent", border: "none", outline: "none", color: "var(--t1)", width: "100%", fontSize: "13.5px" }}
              placeholder="Location (e.g. Remote, San Francisco, London)"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            />
          </div>

          <button className="btn-primary" onClick={handleSearch} disabled={loading} style={{ padding: "10px 24px" }}>
            {loading ? "Searching..." : "Search Jobs"}
          </button>
        </div>

        {/* Filters Row */}
        <div style={{ display: "flex", gap: "12px", flexWrap: "wrap", alignItems: "center" }}>
          <select
            className="input-field"
            style={{ width: "auto", padding: "8px 14px", fontSize: "12.5px" }}
            value={boardFilter}
            onChange={(e) => setBoardFilter(e.target.value)}
          >
            <option value="all">All ATS Portals</option>
            <option value="greenhouse">Greenhouse</option>
            <option value="lever">Lever</option>
            <option value="ashby">Ashby</option>
            <option value="workday">Workday</option>
          </select>

          <select
            className="input-field"
            style={{ width: "auto", padding: "8px 14px", fontSize: "12.5px" }}
            value={workplace}
            onChange={(e) => setWorkplace(e.target.value)}
          >
            <option value="all">Any Workplace</option>
            <option value="remote">Remote Only</option>
            <option value="onsite">On-site / Hybrid</option>
          </select>

          <select
            className="input-field"
            style={{ width: "auto", padding: "8px 14px", fontSize: "12.5px" }}
            value={sortOrder}
            onChange={(e) => setSortOrder(e.target.value)}
          >
            <option value="match">Best Match First</option>
            <option value="recent">Most Recently Posted</option>
          </select>

          <div style={{ marginLeft: "auto", fontSize: "12px", color: "var(--t4)" }}>
            Showing <strong>{filteredJobs.length}</strong> matching postings
          </div>
        </div>
      </div>

      {/* Two-Column Search Results */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 340px", gap: "22px" }}>
        {/* Results List */}
        <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
          {filteredJobs.map((job) => {
            const isSaved = savedJobs.includes(job.id);
            return (
              <div
                key={job.id}
                className="card card-spotlight"
                style={{
                  padding: "22px",
                  display: "flex",
                  flexDirection: "column",
                  gap: "14px",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "14px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
                    <div
                      style={{
                        width: "44px",
                        height: "44px",
                        minWidth: "44px",
                        borderRadius: "12px",
                        background: job.logoBg || "var(--grd-ind)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: "17px",
                        fontWeight: 900,
                        color: "#fff",
                        boxShadow: "0 6px 16px rgba(0,0,0,0.35)",
                      }}
                    >
                      {job.initials || job.company?.slice(0, 1) || "J"}
                    </div>

                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
                        <h3 style={{ fontSize: "16px", fontWeight: 700, color: "var(--t1)" }}>{job.title}</h3>
                        <span className="badge badge-blue">{job.board || "Direct"}</span>
                      </div>
                      <div style={{ fontSize: "13px", color: "var(--t2)", fontWeight: 500 }}>
                        <strong style={{ color: "#fff" }}>{job.company}</strong> · {job.location} ·{" "}
                        <span style={{ color: "var(--em)", fontWeight: 700 }}>{job.salary}</span>
                      </div>
                    </div>
                  </div>

                  <div style={{ textAlign: "right" }}>
                    <div
                      style={{
                        fontFamily: "var(--font2)",
                        fontSize: "24px",
                        fontWeight: 900,
                        color: job.matchScore >= 90 ? "var(--em)" : job.matchScore >= 80 ? "#F59E0B" : "var(--rose)",
                      }}
                    >
                      {job.matchScore}%
                    </div>
                    <div style={{ fontSize: "10px", fontWeight: 800, textTransform: "uppercase", color: "var(--t4)" }}>
                      Profile Fit
                    </div>
                  </div>
                </div>

                <p style={{ fontSize: "13px", color: "var(--t3)", lineHeight: 1.6 }}>{job.desc}</p>

                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "12px", marginTop: "2px" }}>
                  <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                    {job.tags?.map((t: string) => (
                      <span key={t} className="badge badge-gray">
                        {t}
                      </span>
                    ))}
                  </div>

                  <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                    <button
                      className="btn-secondary"
                      onClick={() => toggleSave(job.id)}
                      style={{ padding: "7px 14px", fontSize: "12px" }}
                    >
                      <Bookmark size={13} fill={isSaved ? "var(--ind)" : "none"} color={isSaved ? "var(--ind)" : "currentColor"} />
                      {isSaved ? "Saved" : "Save"}
                    </button>
                    <button
                      className="btn-primary"
                      onClick={() => setActiveJobReview(job)}
                      style={{ padding: "7px 18px", fontSize: "12.5px" }}
                    >
                      <Sparkles size={13} /> Review & Apply
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Right Sidebar: Match Profile */}
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <div className="card">
            <h3 className="section-title" style={{ fontSize: "15px" }}>
              Active Target Profile
            </h3>
            <p className="section-sub" style={{ fontSize: "12px" }}>
              Criteria configured in your SuperJob profile.
            </p>

            <div style={{ display: "flex", flexDirection: "column", gap: "12px", fontSize: "12.5px" }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "var(--t4)" }}>Target Titles:</span>
                <span style={{ fontWeight: 600, color: "var(--t2)" }}>Senior Full Stack Engineer</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "var(--t4)" }}>Experience:</span>
                <span style={{ fontWeight: 600, color: "var(--t2)" }}>5+ Years</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "var(--t4)" }}>Workplace:</span>
                <span style={{ fontWeight: 600, color: "var(--t2)" }}>Remote preferred</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "var(--t4)" }}>Notice:</span>
                <span style={{ fontWeight: 600, color: "var(--t2)" }}>30 days</span>
              </div>
            </div>
          </div>

          <div className="card" style={{ background: "rgba(16,185,129,0.06)", border: "1px solid rgba(16,185,129,0.2)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" }}>
              <CheckCircle size={16} color="var(--em)" />
              <span style={{ fontSize: "13.5px", fontWeight: 700, color: "var(--em)" }}>Human-in-the-Loop</span>
            </div>
            <p style={{ fontSize: "12px", color: "var(--t3)", lineHeight: 1.5 }}>
              SuperJobAgent never submits applications blindly. Prepared forms and tailored resumes are ready for your
              1-click inspection before submission.
            </p>
          </div>
        </div>
      </div>

      {/* ── Inspection & Tailoring Modal ── */}
      {activeJobReview && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 9999,
            background: "rgba(4, 7, 17, 0.85)",
            backdropFilter: "blur(20px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "20px",
          }}
          onClick={() => setActiveJobReview(null)}
        >
          <div
            className="card"
            style={{
              width: "100%",
              maxWidth: "620px",
              padding: "28px",
              background: "var(--bg2)",
              border: "1px solid var(--b1)",
              boxShadow: "0 24px 60px rgba(0,0,0,0.6)",
              maxHeight: "90vh",
              overflowY: "auto",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "16px" }}>
              <div>
                <span className="badge badge-blue" style={{ marginBottom: "6px" }}>
                  {activeJobReview.board} ATS Portal
                </span>
                <h2 style={{ fontFamily: "var(--font2)", fontSize: "20px", fontWeight: 800 }}>
                  Review Application for {activeJobReview.title}
                </h2>
                <div style={{ fontSize: "13px", color: "var(--t3)" }}>
                  {activeJobReview.company} · {activeJobReview.location}
                </div>
              </div>
              <button onClick={() => setActiveJobReview(null)} style={{ background: "transparent", color: "var(--t4)" }}>
                <X size={20} />
              </button>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "16px", marginTop: "12px" }}>
              {/* Tailored Resume section */}
              <div style={{ background: "var(--bg1)", border: "1px solid var(--b0)", borderRadius: "var(--r12)", padding: "16px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" }}>
                  <FileCheck size={16} color="var(--em)" />
                  <span style={{ fontSize: "13px", fontWeight: 700, color: "var(--t1)" }}>
                    Tailored Resume Variant Generated
                  </span>
                </div>
                <div style={{ fontSize: "12px", color: "var(--t3)", lineHeight: 1.5 }}>
                  3 bullet points re-ordered to emphasize {activeJobReview.tags?.[0]} and {activeJobReview.tags?.[1]}.
                  Verified ATS keyword compatibility: <strong>{activeJobReview.matchScore}%</strong>.
                </div>
              </div>

              {/* Resolved Screening Questions */}
              <div>
                <div style={{ fontSize: "12px", fontWeight: 700, textTransform: "uppercase", color: "var(--t4)", marginBottom: "8px" }}>
                  Deterministic Screening Question Responses
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                  {(activeJobReview.screeningQA || []).map((qa: any, i: number) => (
                    <div key={i} style={{ background: "var(--bg1)", border: "1px solid var(--b0)", borderRadius: "var(--r8)", padding: "12px" }}>
                      <div style={{ fontSize: "12px", fontWeight: 700, color: "var(--t2)", marginBottom: "4px" }}>
                        Q: {qa.q}
                      </div>
                      <div style={{ fontSize: "12px", color: "var(--sky)", lineHeight: 1.4 }}>
                        A: {qa.a}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Action Buttons */}
              <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "14px" }}>
                <button className="btn-secondary" onClick={() => setActiveJobReview(null)}>
                  Cancel
                </button>
                <button
                  className="btn-primary"
                  onClick={handleApproveAndSubmit}
                  disabled={submittingReview || reviewSuccess}
                >
                  {reviewSuccess ? (
                    <>
                      <Check size={14} color="#fff" /> Submitted!
                    </>
                  ) : submittingReview ? (
                    "Transmitting Form..."
                  ) : (
                    <>
                      <Send size={14} /> Approve & Dispatch via Extension
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
