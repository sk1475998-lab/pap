/**
 * PanelSubmitCountdown — approval/review dialog for final submission.
 *
 * Shown when `autoSubmit` is enabled and the autopilot reaches the final step.
 * Shows a 30-second countdown before submitting automatically, allowing
 * the user to submit immediately or pause auto-submit.
 */
import React from "react";
import { usePanelStore } from "./panel-store.js";

export interface PanelSubmitCountdownProps {
  onSubmitNow?: () => void;
  onCancelCountdown?: () => void;
}

export const PanelSubmitCountdown: React.FC<PanelSubmitCountdownProps> = ({
  onSubmitNow,
  onCancelCountdown,
}) => {
  const { submitCountdownActive, submitCountdown } = usePanelStore();

  if (!submitCountdownActive) return null;

  // Calculate percentage (30 down to 0)
  const pct = Math.max(0, Math.min(100, Math.round((submitCountdown / 30) * 100)));

  return (
    <div className="sja-prompt sja-prompt-countdown" role="alertdialog"
      aria-label="Auto-submit countdown">
      <div className="sja-countdown-header">
        <span className="sja-countdown-icon" aria-hidden="true">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 15c-1 1-2 4-2 4s3-1 4-2"/><path d="M14 5 19 10c-3 2-6 5-9 7l-2-2c2-3 5-6 7-9"/><circle cx="15" cy="9" r="1.5" fill="currentColor"/><path d="M9 15 5 19"/></svg>
        </span>
        <div className="sja-countdown-title">Submitting Automatically</div>
      </div>
      <div className="sja-countdown-desc">
        Review the form above. Auto-submitting in <strong>{submitCountdown}</strong> second{submitCountdown !== 1 ? "s" : ""}...
      </div>
      <div className="sja-countdown-progress-container">
        <div className="sja-countdown-progress-bar" style={{ width: `${pct}%` }} />
      </div>
      <div className="sja-countdown-actions">
        <button className="sja-btn sja-btn-submit-now sja-btn-with-icon" onClick={onSubmitNow}
          aria-label="Submit application immediately">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m5 12 5 5L20 7"/></svg>
          Submit Now
        </button>
        <button className="sja-btn sja-btn-cancel-countdown" onClick={onCancelCountdown}
          aria-label="Pause auto-submit and review manually">
          Pause Auto-Submit
        </button>
      </div>
    </div>
  );
};
