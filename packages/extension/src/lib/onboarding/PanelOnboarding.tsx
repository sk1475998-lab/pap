/**
 * Panel onboarding points users to the dashboard for profile and resume setup.
 * The extension only consumes the profile after it has synced.
 */
import React, { useCallback, useEffect, useState } from "react";
import {
  type OnboardingState,
  type OnboardingStep,
  loadOnboardingState,
  saveOnboardingState,
  nextStep,
  prevStep,
} from "../onboarding/onboarding-store.js";
import { getProfile } from "../store.js";
import { getCloudApiUrl } from "../sync/sync-client.js";

export interface PanelOnboardingProps {
  onComplete: (state: OnboardingState) => void;
}

const STEPS: OnboardingStep[] = ["WELCOME", "RESUME_UPLOAD", "READY_TO_APPLY"];

function dashboardUrl(apiUrl: string): string {
  const base = apiUrl.replace(/\/api\/?$/, "").replace(/\/+$/, "");
  return base.includes("3001") ? "http://localhost:5173" : base || "http://localhost:5173";
}

export const PanelOnboarding: React.FC<PanelOnboardingProps> = ({ onComplete }) => {
  const [state, setState] = useState<OnboardingState | null>(null);
  const [dashboard, setDashboard] = useState("http://localhost:5173");
  const [profileAvailable, setProfileAvailable] = useState(false);


  useEffect(() => {
    let active = true;
    void Promise.all([loadOnboardingState(), getCloudApiUrl(), getProfile()])
      .then(([storedState, apiUrl, profile]) => {
        if (!active) return;
        setState(storedState);
        setDashboard(dashboardUrl(apiUrl) || "http://localhost:3001");
        setProfileAvailable(Boolean(profile && (
          profile.firstName || profile.email || profile.masterResumeText || profile.skills?.length
        )));
      })
      .catch(() => {
        if (active) setState({
          step: "WELCOME",
          completedAt: null,
        });
      });

    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (state && state.step !== "COMPLETED") void saveOnboardingState(state);
  }, [state]);

  const handleNext = useCallback(() => {
    if (!state) return;
    const next = nextStep(state.step);
    if (next === "COMPLETED") {
      const completed: OnboardingState = {
        ...state,
        step: "COMPLETED",
        completedAt: Date.now(),
      };
      void saveOnboardingState(completed);
      onComplete(completed);
    } else {
      setState({ ...state, step: next });
    }
  }, [state, onComplete]);

  const handleBack = useCallback(() => {
    if (state) setState({ ...state, step: prevStep(state.step) });
  }, [state]);

  if (!state) return null;

  const stepIndex = STEPS.indexOf(state.step);

  return (
    <div className="sja-onboarding" role="region" aria-label="Onboarding wizard">
      <div className="sja-onboarding-step-dots" role="navigation" aria-label="Onboarding progress">
        {STEPS.map((step, index) => (
          <div
            key={step}
            className={`sja-step-dot ${index === stepIndex ? "active" : ""} ${index < stepIndex ? "completed" : ""}`}
            aria-label={`Step ${index + 1}${index === stepIndex ? " (current)" : index < stepIndex ? " (completed)" : ""}`}
          />
        ))}
      </div>

      {state.step === "WELCOME" && <WelcomeStep onNext={handleNext} />}
      {state.step === "RESUME_UPLOAD" && (
        <DashboardProfileStep
          dashboard={dashboard}
          profileAvailable={profileAvailable}
          onNext={handleNext}
          onBack={handleBack}
        />
      )}
      {state.step === "READY_TO_APPLY" && (
        <ReadyStep
          dashboard={dashboard}
          profileAvailable={profileAvailable}
          onNext={handleNext}
          onBack={handleBack}
        />
      )}
    </div>
  );
};

const WelcomeStep: React.FC<{ onNext: () => void }> = ({ onNext }) => (
  <>
    <div style={{ fontSize: "32px", marginBottom: "4px" }}>⚡</div>
    <div className="sja-onboarding-title">Welcome to Super Job Agent</div>
    <div className="sja-onboarding-subtitle">
      Use the web dashboard to manage your profile and resume. The extension reads the synced details to fill application forms.
    </div>
    <div style={{ display: "flex", flexDirection: "column", gap: "8px", width: "100%", marginTop: "8px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "11px", color: "#94a3b8" }}>
        <span aria-hidden="true">🎯</span><span>Smart match scoring against job descriptions</span>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "11px", color: "#94a3b8" }}>
        <span aria-hidden="true">🤖</span><span>AI answers to custom application questions</span>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "11px", color: "#94a3b8" }}>
        <span aria-hidden="true">🔒</span><span>Profile data stays under your dashboard account</span>
      </div>
    </div>
    <button className="sja-btn sja-btn-primary" onClick={onNext}
      style={{ marginTop: "12px" }} aria-label="Continue to profile dashboard">
      🚀 Continue
    </button>
  </>
);

const DashboardProfileStep: React.FC<{
  dashboard: string;
  profileAvailable: boolean;
  onNext: () => void;
  onBack: () => void;
}> = ({ dashboard, profileAvailable, onNext, onBack }) => (
  <>
    <div className="sja-onboarding-title">Manage Your Profile on the Dashboard</div>
    <div className="sja-onboarding-subtitle">
      Add or update your contact details, settings, and resume there. Once synced, the extension will use that profile automatically—no re-entry or pasted resume text needed here.
    </div>
    <div className="sja-card" role="status" style={{ width: "100%", marginTop: "8px" }}>
      <div className="sja-card-title">
        <span className="sja-card-icon" aria-hidden="true">☁️</span> Synced profile status
      </div>
      <div style={{ fontSize: "11px", color: "#94a3b8", marginTop: "4px" }}>
        {profileAvailable
          ? "Profile data is available in extension storage."
          : "No synced profile found yet. Create or update it on the dashboard, then sync."}
      </div>
    </div>
    <a href={dashboard} target="_blank" rel="noreferrer" className="sja-btn sja-btn-primary"
      style={{ display: "block", width: "100%", marginTop: "8px", textAlign: "center", textDecoration: "none" }}>
      Open Dashboard ↗
    </a>
    <div className="sja-onboarding-actions" style={{ width: "100%", marginTop: "4px" }}>
      <button className="sja-btn sja-btn-secondary" onClick={onBack} style={{ flex: 1 }}>← Back</button>
      <button className="sja-btn sja-btn-primary" onClick={onNext} style={{ flex: 2 }}>Continue →</button>
    </div>
  </>
);

const ReadyStep: React.FC<{
  dashboard: string;
  profileAvailable: boolean;
  onNext: () => void;
  onBack: () => void;
}> = ({ dashboard, profileAvailable, onNext, onBack }) => (
  <>
    <div style={{ fontSize: "32px", marginBottom: "4px" }}>🎉</div>
    <div className="sja-onboarding-title">You're All Set</div>
    <div className="sja-onboarding-subtitle">
      The extension will use profile data synced from your dashboard when you visit supported job application pages.
    </div>
    <div className="sja-card" role="status" style={{ width: "100%", textAlign: "left" }}>
      <div className="sja-card-title"><span className="sja-card-icon" aria-hidden="true">👤</span> Profile</div>
      <div style={{ fontSize: "10px", color: "#94a3b8", marginTop: "4px" }}>
        {profileAvailable ? "Synced profile available" : "Not synced yet"}
      </div>
      <a href={dashboard} target="_blank" rel="noreferrer" style={{ display: "inline-block", marginTop: "8px", fontSize: "11px" }}>
        Manage profile on Dashboard ↗
      </a>
    </div>
    <div className="sja-onboarding-actions" style={{ width: "100%", marginTop: "4px" }}>
      <button className="sja-btn sja-btn-secondary" onClick={onBack} style={{ flex: 1 }}>← Back</button>
      <button className="sja-btn sja-btn-primary" onClick={onNext} style={{ flex: 2 }}>⚡ Start Applying</button>
    </div>
  </>
);
