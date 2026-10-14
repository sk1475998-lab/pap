import React, { useState } from "react";
import { Download, Plus, Search, Filter, Building, Calendar, ExternalLink } from "lucide-react";

export function ApplicationsPage() {
  const [filterStatus, setFilterStatus] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");

  const [applications, setApplications] = useState([
    {
      id: "a-1",
      role: "Senior Full Stack Engineer",
      company: "Vercel",
      ats: "Lever",
      status: "interview",
      dateApplied: "2026-10-10",
      salary: "$190k",
      matchScore: 94,
      link: "https://jobs.lever.co/vercel/example",
    },
    {
      id: "a-2",
      role: "Staff Infrastructure Engineer",
      company: "Stripe",
      ats: "Workday",
      status: "screening",
      dateApplied: "2026-10-09",
      salary: "$210k",
      matchScore: 91,
      link: "https://stripe.com/jobs/example",
    },
    {
      id: "a-3",
      role: "Lead Platform Architect",
      company: "Linear",
      ats: "Greenhouse",
      status: "offer",
      dateApplied: "2026-10-05",
      salary: "$225k",
      matchScore: 96,
      link: "https://boards.greenhouse.io/linear/example",
    },
    {
      id: "a-4",
      role: "Backend Systems Engineer",
      company: "Supabase",
      ats: "Ashby",
      status: "applied",
      dateApplied: "2026-10-08",
      salary: "$175k",
      matchScore: 88,
      link: "https://jobs.ashbyhq.com/supabase/example",
    },
    {
      id: "a-5",
      role: "Senior AI Platform Engineer",
      company: "Cursor (Anysphere)",
      ats: "Greenhouse",
      status: "applied",
      dateApplied: "2026-10-07",
      salary: "$200k",
      matchScore: 93,
      link: "https://boards.greenhouse.io/anysphere/example",
    },
  ]);

  const filtered = applications.filter((app) => {
    const matchesStatus = filterStatus === "all" ? true : app.status === filterStatus;
    const matchesQuery =
      app.role.toLowerCase().includes(searchQuery.toLowerCase()) ||
      app.company.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesStatus && matchesQuery;
  });

  const exportCSV = () => {
    const headers = "Role,Company,ATS,Status,DateApplied,Salary,MatchScore,Link\n";
    const rows = filtered
      .map(
        (a) =>
          `"${a.role}","${a.company}","${a.ats}","${a.status}","${a.dateApplied}","${a.salary}","${a.matchScore}%","${a.link}"`
      )
      .join("\n");
    const blob = new Blob([headers + rows], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `SuperJobAgent_Applications_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "offer":
        return <span className="badge badge-green">Offer Received</span>;
      case "interview":
        return <span className="badge badge-amber">Interviewing</span>;
      case "screening":
        return <span className="badge badge-blue">Screening</span>;
      case "applied":
        return <span className="badge badge-blue">Applied</span>;
      case "rejected":
        return <span className="badge badge-rose">Rejected</span>;
      default:
        return <span className="badge badge-gray">{status}</span>;
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px" }}>
        <div>
          <div className="label-xs" style={{ color: "var(--ind)", marginBottom: "4px" }}>
            RECORDS & EXPORT
          </div>
          <h1 className="section-title" style={{ fontSize: "24px" }}>
            My Applications Ledger
          </h1>
          <p className="section-sub" style={{ marginBottom: 0 }}>
            Complete historical audit trail of all applications submitted or tracked by SuperJobAgent.
          </p>
        </div>

        <button className="btn-secondary" onClick={exportCSV} style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <Download size={14} /> Export CSV
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="card" style={{ padding: "16px", display: "flex", gap: "12px", alignItems: "center", flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px", background: "var(--bg1)", border: "1px solid var(--b0)", borderRadius: "var(--r8)", padding: "8px 12px", flex: 1, minWidth: "240px" }}>
          <Search size={16} color="var(--t4)" />
          <input
            style={{ background: "transparent", border: "none", outline: "none", color: "var(--t1)", width: "100%", fontSize: "13px" }}
            placeholder="Search by company or role..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <select
          className="input-field"
          style={{ width: "auto", padding: "8px 14px", fontSize: "12.5px" }}
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
        >
          <option value="all">All Statuses ({applications.length})</option>
          <option value="applied">Applied</option>
          <option value="screening">Screening</option>
          <option value="interview">Interviewing</option>
          <option value="offer">Offers</option>
        </select>
      </div>

      {/* Applications Table */}
      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
            <thead>
              <tr style={{ background: "var(--bg1)", borderBottom: "1px solid var(--b0)", color: "var(--t4)", textAlign: "left" }}>
                <th style={{ padding: "12px 16px", fontSize: "10px", fontWeight: 800, textTransform: "uppercase" }}>ROLE & COMPANY</th>
                <th style={{ padding: "12px 16px", fontSize: "10px", fontWeight: 800, textTransform: "uppercase" }}>PORTAL / ATS</th>
                <th style={{ padding: "12px 16px", fontSize: "10px", fontWeight: 800, textTransform: "uppercase" }}>STATUS</th>
                <th style={{ padding: "12px 16px", fontSize: "10px", fontWeight: 800, textTransform: "uppercase" }}>FIT SCORE</th>
                <th style={{ padding: "12px 16px", fontSize: "10px", fontWeight: 800, textTransform: "uppercase" }}>DATE APPLIED</th>
                <th style={{ padding: "12px 16px", fontSize: "10px", fontWeight: 800, textTransform: "uppercase" }}>LINK</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((app) => (
                <tr key={app.id} style={{ borderBottom: "1px solid var(--b0)" }}>
                  <td style={{ padding: "14px 16px" }}>
                    <div style={{ fontWeight: 700, color: "var(--t1)" }}>{app.role}</div>
                    <div style={{ fontSize: "12px", color: "var(--t3)", display: "flex", alignItems: "center", gap: "4px" }}>
                      <Building size={11} /> {app.company} · {app.salary}
                    </div>
                  </td>
                  <td style={{ padding: "14px 16px", color: "var(--t3)" }}>{app.ats}</td>
                  <td style={{ padding: "14px 16px" }}>{getStatusBadge(app.status)}</td>
                  <td style={{ padding: "14px 16px" }}>
                    <span style={{ fontWeight: 800, color: app.matchScore >= 90 ? "var(--em)" : "#F59E0B" }}>
                      {app.matchScore}%
                    </span>
                  </td>
                  <td style={{ padding: "14px 16px", color: "var(--t4)", fontSize: "12px" }}>{app.dateApplied}</td>
                  <td style={{ padding: "14px 16px" }}>
                    <a
                      href={app.link}
                      target="_blank"
                      rel="noreferrer"
                      style={{ color: "var(--ind)", display: "inline-flex", alignItems: "center", gap: "3px", fontSize: "12px" }}
                    >
                      View <ExternalLink size={11} />
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
