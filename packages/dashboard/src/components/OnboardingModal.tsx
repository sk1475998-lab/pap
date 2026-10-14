import React, { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { saveProfile } from "../lib/api";
import { Check, Upload, ArrowRight, ArrowLeft, Sparkles, X } from "lucide-react";

export function OnboardingModal() {
  const { onboardingOpen, setOnboardingOpen, register, user } = useAuth();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [formData, setFormData] = useState({
    name: user?.name || "Jane Doe",
    email: user?.email || "",
    phone: "+1 555 019 2834",
    linkedin: "linkedin.com/in/janedoe",
    password: "",
    roles: "Senior Software Engineer, Full Stack Lead",
    experienceYears: "5",
    skills: ["React", "TypeScript", "Node.js", "Python", "PostgreSQL", "AWS"],
    location: "San Francisco, CA / Remote",
    noticePeriod: "30 days",
    blacklist: "Meta, Amazon",
    coverTone: "Professional",
    resumeName: "",
  });

  const availableSkills = [
    "React",
    "Node.js",
    "TypeScript",
    "Python",
    "Java",
    "AWS",
    "PostgreSQL",
    "GraphQL",
    "Docker",
    "Go",
    "Next.js",
    "Kubernetes",
  ];

  if (!onboardingOpen) return null;

  const toggleSkill = (skill: string) => {
    setFormData((prev) => ({
      ...prev,
      skills: prev.skills.includes(skill)
        ? prev.skills.filter((s) => s !== skill)
        : [...prev.skills, skill],
    }));
  };

  const handleNext = async () => {
    setError("");
    if (step === 1 && !user && formData.password) {
      try {
        setLoading(true);
        await register(formData.email, formData.password, formData.name);
      } catch (err: any) {
        setError(err.message || "Failed to create account");
        setLoading(false);
        return;
      } finally {
        setLoading(false);
      }
    }
    if (step < 5) {
      setStep(step + 1);
    } else {
      // Final submit
      try {
        setLoading(true);
        await saveProfile({
          personal: {
            name: formData.name,
            email: formData.email,
            phone: formData.phone,
            linkedin: formData.linkedin,
          },
          preferences: {
            targetRoles: formData.roles.split(",").map((r) => r.trim()),
            experienceYears: Number(formData.experienceYears) || 0,
            skills: formData.skills,
            locations: formData.location.split(",").map((l) => l.trim()),
            noticePeriod: formData.noticePeriod,
            blacklistedCompanies: formData.blacklist.split(",").map((b) => b.trim()),
            coverLetterTone: formData.coverTone,
          },
        });
        setOnboardingOpen(false);
      } catch (err: any) {
        setError(err.message || "Failed to save profile");
      } finally {
        setLoading(false);
      }
    }
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9998,
        background: "rgba(6,10,18,0.92)",
        backdropFilter: "blur(24px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "20px",
      }}
    >
      <div
        className="card"
        style={{
          width: "100%",
          maxWidth: "580px",
          position: "relative",
          padding: "36px",
          background: "var(--bg2)",
          border: "1px solid var(--b1)",
        }}
      >
        <button
          onClick={() => setOnboardingOpen(false)}
          style={{
            position: "absolute",
            top: "20px",
            right: "20px",
            background: "transparent",
            color: "var(--t4)",
          }}
        >
          <X size={20} />
        </button>

        {/* Progress Bar */}
        <div style={{ display: "flex", gap: "6px", marginBottom: "28px" }}>
          {[1, 2, 3, 4, 5].map((s) => (
            <div
              key={s}
              style={{
                flex: 1,
                height: "3px",
                borderRadius: "2px",
                background: s <= step ? "var(--grd-ind)" : "var(--b0)",
                transition: "background 0.3s ease",
              }}
            />
          ))}
        </div>

        {error && (
          <div
            style={{
              padding: "10px 14px",
              background: "rgba(244,63,94,0.15)",
              border: "1px solid rgba(244,63,94,0.3)",
              borderRadius: "var(--r8)",
              color: "var(--rose)",
              fontSize: "12.5px",
              marginBottom: "16px",
            }}
          >
            {error}
          </div>
        )}

        {/* Step 1: Personal */}
        {step === 1 && (
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "12px" }}>
              <div
                style={{
                  width: "32px",
                  height: "32px",
                  borderRadius: "8px",
                  background: "var(--grd-ind)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Sparkles size={18} color="#fff" />
              </div>
              <h2 style={{ fontFamily: "var(--font2)", fontSize: "20px", fontWeight: 800 }}>Welcome to SuperJobAgent</h2>
            </div>
            <p style={{ color: "var(--t3)", fontSize: "13px", marginBottom: "22px" }}>
              Let's set up your profile to discover matching jobs and auto-fill applications.
            </p>

            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              <div>
                <label className="label-xs">Full Name</label>
                <input
                  className="input-field"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Jane Doe"
                />
              </div>
              <div>
                <label className="label-xs">Email Address</label>
                <input
                  className="input-field"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="you@domain.com"
                />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                <div>
                  <label className="label-xs">Phone</label>
                  <input
                    className="input-field"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="+1 555 019 2834"
                  />
                </div>
                <div>
                  <label className="label-xs">LinkedIn Handle</label>
                  <input
                    className="input-field"
                    value={formData.linkedin}
                    onChange={(e) => setFormData({ ...formData, linkedin: e.target.value })}
                    placeholder="linkedin.com/in/username"
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Step 2: Roles & Skills */}
        {step === 2 && (
          <div>
            <h2 style={{ fontFamily: "var(--font2)", fontSize: "20px", fontWeight: 800, marginBottom: "8px" }}>
              Target Roles & Core Skills 💼
            </h2>
            <p style={{ color: "var(--t3)", fontSize: "13px", marginBottom: "20px" }}>
              Tell the AI scorer which titles and technologies you excel at.
            </p>

            <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
              <div>
                <label className="label-xs">Target Titles</label>
                <input
                  className="input-field"
                  value={formData.roles}
                  onChange={(e) => setFormData({ ...formData, roles: e.target.value })}
                  placeholder="Senior Software Engineer, Tech Lead"
                />
              </div>
              <div>
                <label className="label-xs">Years of Experience</label>
                <input
                  className="input-field"
                  type="number"
                  value={formData.experienceYears}
                  onChange={(e) => setFormData({ ...formData, experienceYears: e.target.value })}
                />
              </div>
              <div>
                <label className="label-xs" style={{ marginBottom: "8px", display: "block" }}>
                  Core Tech Stack
                </label>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                  {availableSkills.map((sk) => {
                    const isSelected = formData.skills.includes(sk);
                    return (
                      <button
                        key={sk}
                        type="button"
                        onClick={() => toggleSkill(sk)}
                        style={{
                          padding: "6px 14px",
                          borderRadius: "20px",
                          fontSize: "12px",
                          fontWeight: 600,
                          border: `1px solid ${isSelected ? "var(--ind)" : "var(--b1)"}`,
                          background: isSelected ? "rgba(99,102,241,0.18)" : "var(--bg1)",
                          color: isSelected ? "#818CF8" : "var(--t3)",
                          cursor: "pointer",
                          transition: "all 0.15s ease",
                        }}
                      >
                        {isSelected ? `✓ ${sk}` : `+ ${sk}`}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Step 3: Location & Preferences */}
        {step === 3 && (
          <div>
            <h2 style={{ fontFamily: "var(--font2)", fontSize: "20px", fontWeight: 800, marginBottom: "8px" }}>
              Work Preferences & Boundaries 🌍
            </h2>
            <p style={{ color: "var(--t3)", fontSize: "13px", marginBottom: "20px" }}>
              Filter postings automatically and prevent applying to companies on your blacklist.
            </p>

            <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
              <div>
                <label className="label-xs">Preferred Locations (comma separated)</label>
                <input
                  className="input-field"
                  value={formData.location}
                  onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                  placeholder="San Francisco, New York, Remote"
                />
              </div>
              <div>
                <label className="label-xs">Notice Period</label>
                <select
                  className="input-field"
                  value={formData.noticePeriod}
                  onChange={(e) => setFormData({ ...formData, noticePeriod: e.target.value })}
                >
                  <option value="Immediate">Immediate</option>
                  <option value="15 days">15 days</option>
                  <option value="30 days">30 days</option>
                  <option value="60 days">60 days</option>
                  <option value="90 days">90 days</option>
                </select>
              </div>
              <div>
                <label className="label-xs">Blacklisted Companies (Never apply to these)</label>
                <input
                  className="input-field"
                  value={formData.blacklist}
                  onChange={(e) => setFormData({ ...formData, blacklist: e.target.value })}
                  placeholder="Company A, Company B"
                />
              </div>
            </div>
          </div>
        )}

        {/* Step 4: AI & Privacy */}
        {step === 4 && (
          <div>
            <h2 style={{ fontFamily: "var(--font2)", fontSize: "20px", fontWeight: 800, marginBottom: "8px" }}>
              AI Autopilot & Privacy Guarantee 🛡️
            </h2>
            <p style={{ color: "var(--t3)", fontSize: "13px", marginBottom: "20px" }}>
              You maintain total control. Every prepared submission is logged and inspectable.
            </p>

            <div
              style={{
                background: "var(--bg1)",
                border: "1px solid var(--b0)",
                borderRadius: "var(--r12)",
                padding: "20px",
                display: "flex",
                flexDirection: "column",
                gap: "14px",
              }}
            >
              <div style={{ display: "flex", gap: "10px", alignItems: "flex-start" }}>
                <Check size={18} color="var(--em)" style={{ marginTop: "2px" }} />
                <div style={{ fontSize: "12.5px", color: "var(--t2)" }}>
                  <strong>Human-in-the-Loop Review:</strong> AI generates tailored resumes and answers, but final
                  submission can be queued for your manual review.
                </div>
              </div>
              <div style={{ display: "flex", gap: "10px", alignItems: "flex-start" }}>
                <Check size={18} color="var(--em)" style={{ marginTop: "2px" }} />
                <div style={{ fontSize: "12.5px", color: "var(--t2)" }}>
                  <strong>Zero Data Selling:</strong> Your resume, contact details, and screening responses are never used
                  for public model training or third-party syndication.
                </div>
              </div>
              <div style={{ display: "flex", gap: "10px", alignItems: "flex-start" }}>
                <Check size={18} color="var(--em)" style={{ marginTop: "2px" }} />
                <div style={{ fontSize: "12.5px", color: "var(--t2)" }}>
                  <strong>GDPR & CCPA Compliant:</strong> One-click export and complete data purge supported in the
                  Privacy Vault.
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Step 5: Resume Upload */}
        {step === 5 && (
          <div>
            <h2 style={{ fontFamily: "var(--font2)", fontSize: "20px", fontWeight: 800, marginBottom: "8px" }}>
              Upload Your Master Resume 📄
            </h2>
            <p style={{ color: "var(--t3)", fontSize: "13px", marginBottom: "20px" }}>
              Used as the source document for keyword matching and per-job customization.
            </p>

            <div
              style={{
                border: "2px dashed var(--b1)",
                borderRadius: "var(--r16)",
                padding: "36px 20px",
                textAlign: "center",
                background: "var(--bg1)",
                cursor: "pointer",
                marginBottom: "16px",
              }}
              onClick={() => {
                setFormData((p) => ({ ...p, resumeName: "Senior_FullStack_Engineer_Resume.pdf" }));
              }}
            >
              <Upload size={32} color="var(--ind)" style={{ margin: "0 auto 10px" }} />
              <div style={{ fontSize: "14px", fontWeight: 700, color: "var(--t1)", marginBottom: "4px" }}>
                {formData.resumeName || "Drop your resume or click to browse"}
              </div>
              <div style={{ fontSize: "12px", color: "var(--t4)" }}>PDF, DOCX, TXT up to 10MB</div>
            </div>

            <div>
              <label className="label-xs">Default Cover Letter Tone</label>
              <select
                className="input-field"
                value={formData.coverTone}
                onChange={(e) => setFormData({ ...formData, coverTone: e.target.value })}
              >
                <option value="Professional">Professional & Direct</option>
                <option value="Confident">Confident & Results-Oriented</option>
                <option value="Concise">Concise Bullet Points</option>
                <option value="Storytelling">Engaging Storytelling</option>
              </select>
            </div>
          </div>
        )}

        {/* Actions bar */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "32px" }}>
          {step > 1 ? (
            <button className="btn-secondary" onClick={() => setStep(step - 1)} disabled={loading}>
              <ArrowLeft size={14} style={{ marginRight: "6px" }} /> Back
            </button>
          ) : (
            <div />
          )}

          <button className="btn-primary" onClick={handleNext} disabled={loading}>
            {loading ? "Saving..." : step === 5 ? "Launch Workspace 🚀" : "Continue"}
            {step < 5 && <ArrowRight size={14} style={{ marginLeft: "6px" }} />}
          </button>
        </div>
      </div>
    </div>
  );
}
