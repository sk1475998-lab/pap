/** Message protocol between the popup, the background service worker,
 *  and the content script. */

export const MSG = {
  DETECT: "SJA:DETECT", // popup -> content: scan the page, return detected fields
  AUTOFILL: "SJA:AUTOFILL", // popup -> content: fill everything we can
  FILL_ONE: "SJA:FILL_ONE", // popup -> content: fill one field by id (with a value)
  GET_MATCH: "SJA:GET_MATCH", // popup -> content: compute match score for this page
  PAGE_INFO: "SJA:PAGE_INFO", // content -> popup: title/company/url extracted
  CLEAR_PATTERNS: "SJA:CLEAR_PATTERNS", // popup -> content: clear learned autofill patterns
  OPEN_SIDEPANEL: "SJA:OPEN_SIDEPANEL", // popup -> background: open the browser side panel
  SEARCH_JOBS: "SJA:SEARCH_JOBS", // popup -> background: run autonomous advanced job search
  LIST_BOARDS: "SJA:LIST_BOARDS", // popup -> background: list job boards / deep links
  FLEET_START: "SJA:FLEET_START", // ui -> background: start a parallel apply/enhance run
  FLEET_ABORT: "SJA:FLEET_ABORT", // ui -> background: cancel the active fleet run
  FLEET_STATE: "SJA:FLEET_STATE", // ui -> background: read the current fleet run state
} as const;

export interface DetectResponse {
  platform: string | null;
  fields: import("@superjob/core").DetectedField[];
  job: { title: string; company: string; description: string; url?: string };
  hint?: string | null;
  linkedInEasyApplyOpen?: boolean;
}

export interface AutofillResponse {
  filled: number;
  skipped: number;
  details: { label: string; ok: boolean; value: string }[];
  aiAnswered: number;
  /** Fields intentionally held for explicit user review/answer before advancing. */
  missingFields?: import("@superjob/core").DetectedField[];
}

export interface MatchResponse {
  score: number;
  matched: string[];
  missing: string[];
  reasons: string[];
}
