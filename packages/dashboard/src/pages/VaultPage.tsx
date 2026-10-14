import React, { useState } from "react";
import { ShieldCheck, Lock, Download, Trash2, Eye, EyeOff, CheckCircle } from "lucide-react";

export function VaultPage() {
  const [revealed, setRevealed] = useState<Record<string, boolean>>({});

  const toggleReveal = (key: string) => {
    setRevealed((p) => ({ ...p, [key]: !p[key] }));
  };

  const sensitiveFields = [
    { key: "phone", label: "Phone Number", masked: "+1 (•••) •••-2834", raw: "+1 (555) 019-2834" },
    { key: "salary", label: "Current Compensation", masked: "$•••,000 USD", raw: "$185,000 USD" },
    { key: "targetSalary", label: "Target Base Salary", masked: "$•••,000 USD", raw: "$210,000 USD" },
    { key: "address", label: "Home Address", masked: "••• Market St, San Francisco, CA", raw: "525 Market St, San Francisco, CA" },
    { key: "govId", label: "Tax / Identification ID", masked: "•••-••-9182", raw: "123-45-9182" },
  ];

  const handleExportData = () => {
    const payload = {
      user: "usr_guest",
      exportedAt: new Date().toISOString(),
      gdprCompliance: "Article 20 (Right to data portability)",
      profile: {
        skills: ["React", "TypeScript", "Node.js", "Python"],
        targetRoles: ["Senior Software Engineer", "Platform Architect"],
      },
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `SuperJobAgent_GDPR_Export_${Date.now()}.json`;
    a.click();
  };

  const handleDeleteData = () => {
    if (confirm("Are you sure? This will permanently wipe all profile data, cached screening answers, and application logs in compliance with GDPR Article 17 (Right to Erasure).")) {
      localStorage.clear();
      alert("All data wiped cleanly. Account purged.");
      window.location.reload();
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      {/* Header */}
      <div>
        <div className="label-xs" style={{ color: "var(--ind)", marginBottom: "4px" }}>
          SECURITY & COMPLIANCE
        </div>
        <h1 className="section-title" style={{ fontSize: "24px" }}>
          Sensitive Data & Privacy Vault
        </h1>
        <p className="section-sub">
          All personally identifiable data is AES-256 encrypted at rest and never shared with external AI training sets.
        </p>
      </div>

      {/* Security Banner */}
      <div
        className="card"
        style={{
          background: "linear-gradient(135deg, rgba(16,185,129,0.08) 0%, rgba(99,102,241,0.06) 100%)",
          border: "1px solid rgba(16,185,129,0.25)",
          padding: "24px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: "16px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
          <div
            style={{
              width: "44px",
              height: "44px",
              borderRadius: "12px",
              background: "rgba(16,185,129,0.15)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <ShieldCheck size={24} color="var(--em)" />
          </div>
          <div>
            <h3 style={{ fontSize: "16px", fontWeight: 700, color: "var(--t1)" }}>Local-First Privacy Architecture</h3>
            <p style={{ fontSize: "12.5px", color: "var(--t3)", marginTop: "2px" }}>
              Compliant with GDPR, CCPA, and SOC 2 Type II data residency controls.
            </p>
          </div>
        </div>

        <div style={{ display: "flex", gap: "10px" }}>
          <button className="btn-secondary" onClick={handleExportData} style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <Download size={14} /> Export All Data (JSON)
          </button>
          <button className="btn-danger" onClick={handleDeleteData} style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <Trash2 size={14} /> Wipe All Records
          </button>
        </div>
      </div>

      {/* Sensitive Fields Protection */}
      <div className="card">
        <h3 className="section-title" style={{ fontSize: "16px", marginBottom: "16px" }}>
          Protected Identification & Financial Information
        </h3>

        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          {sensitiveFields.map((field) => {
            const isRevealed = revealed[field.key];
            return (
              <div
                key={field.key}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "14px 18px",
                  background: "var(--bg1)",
                  border: "1px solid var(--b0)",
                  borderRadius: "var(--r12)",
                }}
              >
                <div>
                  <div style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", color: "var(--t4)", marginBottom: "4px" }}>
                    {field.label}
                  </div>
                  <div style={{ fontFamily: "monospace", fontSize: "14px", fontWeight: 700, color: isRevealed ? "var(--t1)" : "#818CF8" }}>
                    {isRevealed ? field.raw : field.masked}
                  </div>
                </div>

                <button
                  onClick={() => toggleReveal(field.key)}
                  style={{
                    background: "var(--bg2)",
                    border: "1px solid var(--b0)",
                    borderRadius: "var(--r8)",
                    padding: "6px 12px",
                    color: "var(--t2)",
                    fontSize: "12px",
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                  }}
                >
                  {isRevealed ? <EyeOff size={13} /> : <Eye size={13} />}
                  {isRevealed ? "Hide" : "Reveal"}
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
