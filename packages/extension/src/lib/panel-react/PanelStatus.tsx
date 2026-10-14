/**
 * PanelStatus — renders current autopilot status with animated indicators.
 */
import React from "react";
import { usePanelSelector } from "./panel-store.js";

/** Map status keywords to dot variants. */
function getDotVariant(status: string): string {
  const s = status.toLowerCase();
  if (s.includes("error") || s.includes("fail") || s.includes("blocked")) return "error";
  if (s.includes("warning") || s.includes("attention") || s.includes("review")) return "warning";
  if (s.includes("filling") || s.includes("detecting") || s.includes("processing") || s.includes("running")) return "active";
  return ""; // default breathing dot
}

/** Determine if we should show a progress bar and how much. */
function getProgress(status: string): { show: boolean; indeterminate: boolean; value: number } {
  const s = status.toLowerCase();
  if (s.includes("detecting") || s.includes("scanning")) {
    return { show: true, indeterminate: true, value: 0 };
  }
  if (s.includes("filling")) {
    return { show: true, indeterminate: true, value: 0 };
  }
  // Extract "X/Y" pattern like "5/12 fields filled"
  const match = s.match(/(\d+)\s*\/\s*(\d+)/);
  if (match) {
    const [, filled, total] = match;
    const pct = Math.round((parseInt(filled) / Math.max(1, parseInt(total))) * 100);
    return { show: true, indeterminate: false, value: pct };
  }
  return { show: false, indeterminate: false, value: 0 };
}

export const PanelStatus: React.FC = () => {
  const status = usePanelSelector((s) => s.status);
  const needsUser = usePanelSelector((s) => s.needsUser);
  const awaitingOtp = usePanelSelector((s) => s.awaitingOtp);
  const otpFieldCount = usePanelSelector((s) => s.otpFieldCount);

  const dotVariant = getDotVariant(status);
  const progress = getProgress(status);

  return (
    <>
      <div className="sja-status" role="status" aria-live="polite">
        <span className={`sja-status-dot ${dotVariant}`} />
        <span>{status}</span>
      </div>

      {progress.show && (
        <div className="sja-progress" role="progressbar"
          aria-valuenow={progress.indeterminate ? undefined : progress.value}
          aria-valuemin={0} aria-valuemax={100}>
          <div
            className={`sja-progress-bar ${progress.indeterminate ? "sja-indeterminate" : ""}`}
            style={progress.indeterminate ? undefined : { width: `${progress.value}%` }}
          />
        </div>
      )}

      {needsUser && (
        <div className="sja-prompt sja-prompt-user" role="alert">
          Fill highlighted fields manually, then tap <strong>Continue</strong>.
        </div>
      )}

      {awaitingOtp && (
        <div className="sja-prompt sja-prompt-otp" role="alert">
          Enter the OTP{otpFieldCount > 0 ? ` in ${otpFieldCount} field(s)` : ""} on the page,
          then tap <strong>Resume after OTP</strong>.
        </div>
      )}
    </>
  );
};
