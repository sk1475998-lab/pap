/**
 * PanelVerifyPrompt — approval dialog for step verification.
 *
 * Shown when `verifyBeforeAdvance` is enabled and the autopilot
 * has filled a step. User reviews, then clicks Approve.
 */
import React from "react";
import { usePanelSelector } from "./panel-store.js";

export interface PanelVerifyPromptProps {
  onApproveStep?: () => void;
}

export const PanelVerifyPrompt: React.FC<PanelVerifyPromptProps> = ({ onApproveStep }) => {
  const verifyPrompt = usePanelSelector((s) => s.verifyPrompt);

  if (!verifyPrompt.show) return null;

  const title = `Filled ${verifyPrompt.filledCount ?? 0} field(s)${
    verifyPrompt.stepLabel ? ` on ${verifyPrompt.stepLabel}` : ""
  } — verify before continuing`;

  return (
    <div className="sja-prompt sja-prompt-verify" role="alertdialog"
      aria-label="Verify step before continuing">
      <div className="sja-vp-title" style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m5 12 5 5L20 7"/></svg>
        {title}
      </div>
      <div className="sja-vp-desc">
        Review the form above, correct anything wrong, then click Approve &amp; Continue.
      </div>
      <button className="sja-btn sja-btn-approve sja-btn-with-icon" onClick={onApproveStep}
        aria-label="Approve and continue to next step">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m5 12 5 5L20 7"/></svg>
        Approve &amp; Continue
      </button>
    </div>
  );
};
