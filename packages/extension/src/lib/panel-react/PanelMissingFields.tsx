/**
 * PanelMissingFields — interactive field resolver.
 *
 * Renders missing fields in-panel so users can provide values
 * without scrolling the host page.
 */
import React, { useCallback, useRef, useState } from "react";
import { usePanelSelector } from "./panel-store.js";
import type { MissingField } from "./panel-store.js";

interface MissingFieldItemProps {
  field: MissingField;
  onAnswer: (field: MissingField, value: string) => void;
}

const MissingFieldItem: React.FC<MissingFieldItemProps> = React.memo(({ field, onAnswer }) => {
  const [filled, setFilled] = useState(false);
  const inputRef = useRef<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>(null);

  const handleFill = useCallback(() => {
    const el = inputRef.current;
    if (!el) return;
    const val = el.type === "checkbox"
      ? ((el as HTMLInputElement).checked ? "yes" : "no")
      : el.value.trim();
    if (el.type !== "checkbox" && !val) return;
    onAnswer(field, val);
    setFilled(true);
  }, [field, onAnswer]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleFill();
  }, [handleFill]);

  return (
    <li className={`sja-missing-item ${filled ? "sja-filled" : ""}`}>
      <span className="sja-missing-label">{field.label || field.fieldKey}</span>
      <div className="sja-missing-input-row">
        {field.options && field.options.length > 0 ? (
          <select ref={inputRef as React.RefObject<HTMLSelectElement>}
            className="sja-input sja-select" disabled={filled}
            aria-label={field.label || field.fieldKey}>
            <option value="">Select...</option>
            {field.options.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label || opt.value}
              </option>
            ))}
          </select>
        ) : field.type === "checkbox" ? (
          <label className="sja-checkbox-label">
            <input ref={inputRef as React.RefObject<HTMLInputElement>}
              type="checkbox" disabled={filled}
              aria-label={field.label || field.fieldKey} />
            Check if yes
          </label>
        ) : field.type === "textarea" ? (
          <textarea ref={inputRef as React.RefObject<HTMLTextAreaElement>}
            className="sja-input sja-textarea" placeholder="Your answer..."
            disabled={filled} onKeyDown={handleKeyDown}
            aria-label={field.label || field.fieldKey} />
        ) : (
          <input ref={inputRef as React.RefObject<HTMLInputElement>}
            type="text" className="sja-input" placeholder="Your answer..."
            disabled={filled} onKeyDown={handleKeyDown}
            aria-label={field.label || field.fieldKey} />
        )}

        <button className="sja-btn sja-btn-secondary sja-btn-small"
          onClick={handleFill} disabled={filled}
          style={filled ? { display: "inline-flex", alignItems: "center", gap: 4 } : {}}>
          {filled ? (<><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m5 12 5 5L20 7"/></svg> Filled</>) : "Fill"}
        </button>
      </div>
    </li>
  );
});

MissingFieldItem.displayName = "MissingFieldItem";

export interface PanelMissingFieldsProps {
  onAnswerMissingField?: (field: MissingField, value: string) => void;
}

export const PanelMissingFields: React.FC<PanelMissingFieldsProps> = ({ onAnswerMissingField }) => {
  const missingFields = usePanelSelector((s) => s.missingFields);

  const handleAnswer = useCallback((field: MissingField, value: string) => {
    onAnswerMissingField?.(field, value);
  }, [onAnswerMissingField]);

  if (missingFields.length === 0) return null;

  return (
    <div className="sja-card" role="region" aria-label="Missing fields">
      <div className="sja-missing-title" style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 9v4M12 17h.01"/><path d="M10.3 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z"/></svg>
        Needs attention ({missingFields.length})
      </div>
      <ul className="sja-missing-list" role="list">
        {missingFields.map((field) => (
          <MissingFieldItem
            key={field.fieldKey}
            field={field}
            onAnswer={handleAnswer}
          />
        ))}
      </ul>
    </div>
  );
};
