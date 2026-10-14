/**
 * PanelRoot — top-level React component for the docked side panel.
 *
 * Composes all sub-components (header, status, fill log, missing fields,
 * verify prompt, JD analysis, career insights, outreach, recruiter links,
 * tailored resume) and conditionally renders the onboarding wizard.
 */
import React, { useCallback, useEffect, useState } from "react";
import { usePanelStore, panelStore, type MissingField } from "./panel-store.js";
import { PanelHeader } from "./PanelHeader.js";
import { PanelStatus } from "./PanelStatus.js";
import { PanelSubmitCountdown } from "./PanelSubmitCountdown.js";
import { PanelFillLog } from "./PanelFillLog.js";
import { PanelMissingFields } from "./PanelMissingFields.js";
import { PanelVerifyPrompt } from "./PanelVerifyPrompt.js";
import { PanelOnboarding } from "../onboarding/PanelOnboarding.js";
import { PanelProfileView } from "./PanelProfileView.js";
import { PanelOutreach } from "./PanelOutreach.js";
import { PanelTeamWorkspace } from "./PanelTeamWorkspace.js";
import {
  isOnboardingComplete,
  type OnboardingState,
} from "../onboarding/onboarding-store.js";
import { IconCheck, IconBolt, IconSparkles, IconFile, IconSearch, IconX, IconCopy, IconGlobe, IconUser } from "../icons.jsx";

/* ------------------------------------------------------------------ */
/* Types for action callbacks                                          */
/* ------------------------------------------------------------------ */

export interface PanelRootActions {
  onAutofill: () => void;
  onContinue: () => void;
  onNextStep: () => void;
  onResumeOtp?: () => void;
  onTailorResume?: () => void;
  onGenerateCoverLetter?: () => void;
  onAnswerMissingField?: (field: any, value: string) => void;
  onApproveStep?: () => void;
  onSkipJob?: () => void;
  onOnboardingComplete?: (state: OnboardingState) => void;
  onSubmitNow?: () => void;
  onCancelSubmitCountdown?: () => void;
}

export interface PanelRootProps {
  actions: PanelRootActions;
}

/* ------------------------------------------------------------------ */
/* Helper: escape HTML for safe text rendering                         */
/* ------------------------------------------------------------------ */

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/* ------------------------------------------------------------------ */
/* Sub-component: JD Analysis                                          */
/* ------------------------------------------------------------------ */

const JdAnalysisSection: React.FC = () => {
  const state = usePanelStore();
  const { jdAnalysis } = state;

  if (!jdAnalysis) return null;
  const hasData = jdAnalysis.matched.length > 0 || jdAnalysis.missing.length > 0 || jdAnalysis.inferred.length > 0;
  if (!hasData) return null;

  return (
    <div className="sja-card" role="region" aria-label="JD match analysis">
      <div className="sja-card-title">
        <span className="sja-card-icon" aria-hidden="true"><IconSparkles size={14} /></span> JD Match
      </div>

      {jdAnalysis.matched.length > 0 && (
        <>
          <div className="sja-section-title" style={{ marginTop: "4px" }}><IconCheck size={11} style={{ display: "inline", verticalAlign: "-1px" }} /> Matched</div>
          <div className="sja-chips">
            {jdAnalysis.matched.slice(0, 10).map((t) => (
              <span key={t} className="sja-chip sja-chip-ok">{t}</span>
            ))}
          </div>
        </>
      )}

      {jdAnalysis.missing.length > 0 && (
        <>
          <div className="sja-section-title" style={{ marginTop: "6px" }}>△ Missing from synced profile</div>
          <div className="sja-chips">
            {jdAnalysis.missing.slice(0, 10).map((t) => (
              <span key={t} className="sja-chip sja-chip-miss">{t}</span>
            ))}
          </div>
          <div className="sja-section-title">Only add skills to your dashboard profile when they reflect your actual experience.</div>
        </>
      )}

      {jdAnalysis.inferred.length > 0 && (
        <>
          <div className="sja-section-title" style={{ marginTop: "6px" }}>◎ Inferred</div>
          <div className="sja-chips">
            {jdAnalysis.inferred.slice(0, 6).map((i) => (
              <span key={`${i.job}-${i.via}`} className="sja-chip sja-chip-inf">
                {i.job} ← {i.via}
              </span>
            ))}
          </div>
        </>
      )}
    </div>
  );
};

/* ------------------------------------------------------------------ */
/* Sub-component: Career & Visa Insights                               */
/* ------------------------------------------------------------------ */

const CareerInsightsSection: React.FC = () => {
  const { careerInsights } = usePanelStore();
  if (!careerInsights?.visa) return null;

  const visa = careerInsights.visa;
  const visaClass = `sja-visa-badge sja-visa-${visa.rating.toLowerCase()}`;

  return (
    <div className="sja-card" role="region" aria-label="Career and visa insights">
      <div className="sja-card-title">
        <span className="sja-card-icon" aria-hidden="true"><IconGlobe /></span> Career & Visa Insights
      </div>
      <div className="sja-insights-row">
        <span style={{ color: "#94a3b8" }}>Sponsorship:</span>
        <span className={visaClass}>{visa.rating}</span>
      </div>
      <div className="sja-insights-row">
        <span style={{ color: "#94a3b8" }}>E-Verify:</span>
        <span style={{ fontWeight: "bold", color: visa.eVerify ? "#10b981" : "#ef4444" }}>
          {visa.eVerify ? "Yes (Verified)" : "No"}
        </span>
      </div>
      {visa.reason && (
        <div style={{ fontSize: "9px", color: "#94a3b8", marginTop: "2px", lineHeight: "1.3" }}>
          {visa.reason}
        </div>
      )}
    </div>
  );
};

/* ------------------------------------------------------------------ */
/* Sub-component: Outreach                                             */
/* ------------------------------------------------------------------ */

const CopyButton: React.FC<{ text: string; label: string; copiedLabel?: string }> = ({
  text,
  label,
  copiedLabel = "✓ Copied",
}) => {
  const [copied, setCopied] = useState(false);
  const timerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const handleClick = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // clipboard may be blocked on some iframes — fall back to text selection
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand("copy"); } catch { /* ignore */ }
      document.body.removeChild(ta);
    }
    setCopied(true);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setCopied(false), 1600);
  }, [text]);
  React.useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current); }, []);
  return (
    <button
      type="button"
      className={`sja-btn sja-btn-small ${copied ? "sja-btn-primary" : "sja-btn-secondary"}`}
      onClick={handleClick}
      style={{ marginTop: "2px" }}
      aria-live="polite"
    >
      {copied ? copiedLabel : label}
    </button>
  );
};

const OutreachSection: React.FC = () => {
  const { careerInsights } = usePanelStore();
  if (!careerInsights?.outreach) return null;
  const { linkedin, email } = careerInsights.outreach;

  return (
    <div className="sja-card" role="region" aria-label="Referral outreach">
      <div className="sja-card-title">
        <span className="sja-card-icon" aria-hidden="true"><IconCopy size={14} /></span> Referral Outreach
      </div>
      <div style={{ marginTop: "4px" }}>
        <span className="sja-outreach-label">LinkedIn Invite (&lt;300 chars):</span>
        <div className="sja-outreach-text">{linkedin}</div>
        <CopyButton text={linkedin} label="Copy Invite" />
      </div>
      <div style={{ marginTop: "6px" }}>
        <span className="sja-outreach-label">Cold Email Referral:</span>
        <div className="sja-outreach-text sja-outreach-email">{email}</div>
        <CopyButton text={email} label="Copy Email" />
      </div>
    </div>
  );
};

/* ------------------------------------------------------------------ */
/* Sub-component: Tailored Resume                                      */
/* ------------------------------------------------------------------ */

const TailoredResumeSection: React.FC = () => {
  const { tailoredResume } = usePanelStore();

  const handleCopy = useCallback(async () => {
    if (tailoredResume) {
      await navigator.clipboard.writeText(tailoredResume);
    }
  }, [tailoredResume]);

  const handleDownload = useCallback(() => {
    if (tailoredResume) {
      const blob = new Blob([tailoredResume], { type: "text/plain" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "tailored_resume.txt";
      a.click();
      URL.revokeObjectURL(url);
    }
  }, [tailoredResume]);

  if (!tailoredResume) return null;

  return (
    <div className="sja-card" role="region" aria-label="Tailored resume">
      <div className="sja-card-title">
        <span className="sja-card-icon" aria-hidden="true"><IconFile size={14} /></span> Tailored Resume (ATS Optimized)
      </div>
      <div className="sja-resume-text">{tailoredResume}</div>
      <div className="sja-resume-actions">
        <button className="sja-btn sja-btn-secondary sja-btn-small" onClick={handleCopy}>
          Copy Resume
        </button>
        <button className="sja-btn sja-btn-secondary sja-btn-small" onClick={handleDownload}>
          Download .txt
        </button>
      </div>
    </div>
  );
};

/* ------------------------------------------------------------------ */
/* Sub-component: Recruiter Links                                      */
/* ------------------------------------------------------------------ */

const RecruiterLinksSection: React.FC = () => {
  const { recruiterLinks } = usePanelStore();
  if (recruiterLinks.length === 0) return null;

  return (
    <div className="sja-card" role="region" aria-label="Find recruiters">
      <div className="sja-card-title">
        <span className="sja-card-icon" aria-hidden="true"><IconSearch size={14} /></span> Find Recruiters
      </div>
      {recruiterLinks.map((r, i) => (
        <a key={i} className="sja-recruiter-link" href={r.linkedinSearchUrl}
          target="_blank" rel="noreferrer">
          {r.roleQuery} at company ↗
        </a>
      ))}
    </div>
  );
};

/* ------------------------------------------------------------------ */
/* Sub-component: Early Applicant Advantage (first2apply insight)     */
/* ------------------------------------------------------------------ */

const EarlyAdvantageSection: React.FC = () => {
  const { earlyAdvantage } = usePanelStore();
  if (!earlyAdvantage) return null;

  const isHigh = earlyAdvantage.isEarlyBird;
  return (
    <div
      className="sja-card"
      role="region"
      aria-label="Applicant Velocity & Early Advantage"
      style={{
        borderLeft: isHigh ? "3px solid #10b981" : "3px solid #f59e0b",
        background: isHigh ? "rgba(16, 185, 129, 0.08)" : "rgba(245, 158, 11, 0.08)",
      }}
    >
      <div className="sja-card-title" style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <span className="sja-card-icon" aria-hidden="true">🔥</span>
          <strong>Applicant Velocity</strong>
        </span>
        <span
          className="sja-chip"
          style={{
            background: isHigh ? "#10b981" : "#f59e0b",
            color: "#ffffff",
            fontWeight: 600,
            fontSize: "11px",
            padding: "2px 7px",
            borderRadius: "10px",
          }}
        >
          {(earlyAdvantage.salienceTier ?? earlyAdvantage.callbackMultiplier).toString()} signal
        </span>
      </div>
      <div style={{ fontSize: "11px", marginTop: "4px", color: "var(--sja-text-secondary, #94a3b8)", lineHeight: "1.4" }}>
        {earlyAdvantage.badgeText}
      </div>
    </div>
  );
};

/* ------------------------------------------------------------------ */
/* Sub-component: Hiring Team & Recruiter Copilot                     */
/* ------------------------------------------------------------------ */

const HiringTeamSection: React.FC = () => {
  const { hiringTeam, careerInsights } = usePanelStore();
  const [copied, setCopied] = useState(false);

  if (!hiringTeam) return null;

  const outreach = careerInsights?.outreach;
  const handleCopyNote = () => {
    if (outreach?.linkedin) {
      void navigator.clipboard?.writeText(outreach.linkedin);
      setCopied(true);
      panelStore.setStatus(`✓ Copied customized LinkedIn note for ${hiringTeam.name}!`);
      setTimeout(() => setCopied(false), 3000);
    }
  };

  return (
    <div
      className="sja-card"
      role="region"
      aria-label="Hiring team copilot"
      style={{
        borderLeft: "3px solid #6366f1",
        background: "rgba(99, 102, 241, 0.06)",
      }}
    >
      <div className="sja-card-title" style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <span className="sja-card-icon" aria-hidden="true">🎯</span>
          <strong>Hiring Team Identified</strong>
        </span>
      </div>
      <div style={{ marginTop: "4px", fontSize: "12px" }}>
        <div style={{ fontWeight: 600, color: "var(--sja-text-primary, #f1f5f9)" }}>
          {hiringTeam.name}
        </div>
        {hiringTeam.title && (
          <div style={{ color: "var(--sja-text-secondary, #94a3b8)", fontSize: "11px", marginTop: "1px" }}>
            {hiringTeam.title}
          </div>
        )}
      </div>
      <div style={{ display: "flex", gap: "6px", marginTop: "8px" }}>
        <button
          type="button"
          className="sja-btn sja-btn-secondary"
          style={{ fontSize: "11px", padding: "4px 8px" }}
          onClick={handleCopyNote}
        >
          <IconCopy size={11} /> {copied ? "Copied Note!" : "Copy InMail Note"}
        </button>
        {hiringTeam.profileUrl && (
          <a
            href={hiringTeam.profileUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="sja-btn sja-btn-secondary"
            style={{ fontSize: "11px", padding: "4px 8px", textDecoration: "none", display: "inline-flex", alignItems: "center", gap: "4px" }}
          >
            <IconGlobe size={11} /> Profile
          </a>
        )}
      </div>
    </div>
  );
};

/* ------------------------------------------------------------------ */
/* Footer buttons                                                      */
/* ------------------------------------------------------------------ */

interface PanelFooterProps {
  actions: PanelRootActions;
}

const PanelFooter: React.FC<PanelFooterProps> = ({ actions }) => {
  const awaitingOtp = usePanelStore().awaitingOtp;
  const [filling, setFilling] = useState(false);
  const [tailoring, setTailoring] = useState(false);
  const [generatingLetter, setGeneratingLetter] = useState(false);

  const handleAutofill = useCallback(() => {
    setFilling(true);
    actions.onAutofill();
    setTimeout(() => setFilling(false), 4000);
  }, [actions]);

  const handleTailor = useCallback(() => {
    setTailoring(true);
    actions.onTailorResume?.();
    setTimeout(() => setTailoring(false), 6000);
  }, [actions]);

  const handleCoverLetter = useCallback(() => {
    setGeneratingLetter(true);
    actions.onGenerateCoverLetter?.();
    setTimeout(() => setGeneratingLetter(false), 5000);
  }, [actions]);

  return (
    <div className="sja-foot">
      <button className="sja-btn sja-btn-primary sja-btn-with-icon" onClick={handleAutofill}
        disabled={filling} aria-label="Auto-fill all form fields">
        <IconBolt size={14} /> {filling ? "Filling…" : "Auto-fill"}
      </button>
      <button className="sja-btn sja-btn-warn sja-btn-with-icon" onClick={actions.onContinue}
        aria-label="Continue after manual fill">
        <IconCheck size={14} /> Continue (I filled manually)
      </button>
      {awaitingOtp && (
        <button className="sja-btn sja-btn-primary sja-btn-with-icon" onClick={() => actions.onResumeOtp?.()}
          aria-label="Resume after entering OTP">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
          Resume after OTP
        </button>
      )}
      <button className="sja-btn sja-btn-secondary sja-btn-with-icon" onClick={actions.onNextStep}
        aria-label="Go to next page or step">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12h14M13 5l7 7-7 7"/></svg>
        Next / Continue page
      </button>
      <button className="sja-btn sja-btn-tailor sja-btn-with-icon" onClick={handleTailor}
        disabled={tailoring} aria-label="Generate tailored resume">
        <IconSparkles size={14} /> {tailoring ? "Tailoring…" : "Tailor Resume"}
      </button>
      <button className="sja-btn sja-btn-cover-letter sja-btn-with-icon" onClick={handleCoverLetter}
        disabled={generatingLetter} aria-label="Generate tailored AI cover letter">
        <IconFile size={14} /> {generatingLetter ? "Writing…" : "AI Cover Letter"}
      </button>
      <button className="sja-btn sja-btn-skip sja-btn-with-icon" onClick={() => actions.onSkipJob?.()}
        aria-label="Skip this job">
        <IconX size={14} /> Skip Job
      </button>
    </div>
  );
};

/* ------------------------------------------------------------------ */
/* PanelRoot                                                           */
/* ------------------------------------------------------------------ */

export const PanelRoot: React.FC<PanelRootProps> = ({ actions }) => {
  const state = usePanelStore();
  const [onboardingDone, setOnboardingDone] = useState<boolean>(true);
  const [activeTab, setActiveTab] = useState<"copilot" | "profile">("copilot");

  // ALL hooks MUST be called before any early returns (React rules of hooks)
  // Check onboarding status on mount
  useEffect(() => {
    isOnboardingComplete().then((done) => setOnboardingDone(Boolean(done)));
  }, []);

  const handleOnboardingComplete = useCallback((obState: OnboardingState) => {
    setOnboardingDone(true);
    actions.onOnboardingComplete?.(obState);
  }, [actions]);

  const handleAnswerMissingField = useCallback((field: MissingField, value: string) => {
    actions.onAnswerMissingField?.(field, value);
  }, [actions]);

  // Minimized — PanelHeader handles this
  if (state.minimized) {
    return (
      <div className={`sja-panel sja-minimized ${state.docked ? "" : "sja-float"}`}
        role="complementary" aria-label="Super Job Agent panel (minimized)">
        <PanelHeader />
      </div>
    );
  }

  // Build class list
  const panelClass = `sja-panel ${state.docked ? "" : "sja-float"}`;

  return (
    <div className={panelClass} style={{ width: `${state.width}px` }}
      role="complementary" aria-label="Super Job Agent panel">
      {/* Resize handle */}
      <ResizeHandle />

      {/* Header (with score, platform, step) */}
      <PanelHeader />

      {/* Main body — either onboarding or application UI */}
      <div className="sja-body" role="main">
        {!onboardingDone ? (
          <PanelOnboarding onComplete={handleOnboardingComplete} />
        ) : (
          <>
            {/* Status */}
            <PanelStatus />

            {/* Tab Navigation header */}
            <div className="sja-tabs" style={{ display: "flex", borderBottom: "1px solid var(--sja-border)", background: "rgba(0,0,0,0.1)" }}>
              <button
                type="button"
                className={`sja-tab-btn ${activeTab === "copilot" ? "active" : ""}`}
                onClick={() => setActiveTab("copilot")}
                style={{
                  flex: 1,
                  padding: "8px",
                  background: activeTab === "copilot" ? "var(--sja-bg-secondary)" : "transparent",
                  color: activeTab === "copilot" ? "var(--sja-text-accent)" : "var(--sja-text-secondary)",
                  border: "none",
                  cursor: "pointer",
                  fontSize: "var(--sja-font-md)",
                  fontWeight: activeTab === "copilot" ? "bold" : "normal",
                  outline: "none",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "6px",
                }}
              >
                <IconBolt size={14} /> Copilot
              </button>
              <button
                type="button"
                className={`sja-tab-btn ${activeTab === "profile" ? "active" : ""}`}
                onClick={() => setActiveTab("profile")}
                style={{
                  flex: 1,
                  padding: "8px",
                  background: activeTab === "profile" ? "var(--sja-bg-secondary)" : "transparent",
                  color: activeTab === "profile" ? "var(--sja-text-accent)" : "var(--sja-text-secondary)",
                  border: "none",
                  cursor: "pointer",
                  fontSize: "var(--sja-font-md)",
                  fontWeight: activeTab === "profile" ? "bold" : "normal",
                  outline: "none",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "6px",
                }}
              >
                <IconUser size={14} /> Profile
              </button>
            </div>

            {activeTab === "copilot" ? (
              <>
                {/* Submit countdown */}
                <PanelSubmitCountdown onSubmitNow={actions.onSubmitNow} onCancelCountdown={actions.onCancelSubmitCountdown} />

                {/* Verify prompt */}
                <PanelVerifyPrompt onApproveStep={actions.onApproveStep} />

                {/* Fill log */}
                <PanelFillLog />

                {/* Missing fields */}
                <PanelMissingFields onAnswerMissingField={handleAnswerMissingField} />

                {/* Standout Agentic AI Feature: Early Applicant Advantage & Callback Forecaster */}
                <EarlyAdvantageSection />

                {/* JD Analysis */}
                <JdAnalysisSection />

                {/* Career insights */}
                <CareerInsightsSection />

                {/* Standout Agentic AI Feature: Identified Hiring Team & Recruiter Copilot */}
                <HiringTeamSection />

                {/* Operation Zero-Defect: UI integrations for Recruiter Assistant and Team Workspace */}
                <PanelOutreach />
                <PanelTeamWorkspace />

                {/* Outreach */}
                <OutreachSection />

                {/* Tailored resume */}
                <TailoredResumeSection />

                {/* Recruiter links */}
                <RecruiterLinksSection />
              </>
            ) : (
              <PanelProfileView
                setStatus={(t) => panelStore.setStatus(t)}
              />
            )}
          </>
        )}
      </div>

      {/* Footer action buttons — only when onboarding is done and we are not on the Profile tab */}
      {onboardingDone && activeTab === "copilot" && <PanelFooter actions={actions} />}

      {/* Screen reader live region */}
      <div className="sja-sr-only" role="status" aria-live="polite" aria-atomic="true">
        {state.status}
      </div>
    </div>
  );
};

/* ------------------------------------------------------------------ */
/* Resize Handle                                                       */
/* ------------------------------------------------------------------ */

const ResizeHandle: React.FC = () => {
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    const onMove = (ev: MouseEvent) => {
      panelStore.setWidth(window.innerWidth - ev.clientX);
    };
    const onUp = () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }, []);

  return <div className="sja-resize" onMouseDown={handleMouseDown} title="Drag to resize" />;
};
