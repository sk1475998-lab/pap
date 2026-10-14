/**
 * Panel reactive store.
 *
 * A lightweight external store that allows the imperative orchestrator
 * to push state updates while React components subscribe reactively
 * via `useSyncExternalStore`.
 *
 * Zero dependencies beyond React 18.
 */
import { useSyncExternalStore } from "react";
import type { EarlyAdvantageInfo, HiringTeamInfo } from "../job-extract.js";

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

export interface FillLogEntry {
  id: string;
  label: string;
  value: string;
  source: "profile" | "ai" | "learned" | "default" | "manual";
  ok: boolean;
  timeMs: number;
  ts: number;
}

export interface MissingField {
  fieldKey: string;
  label: string;
  type: "text" | "textarea" | "select" | "checkbox" | "radio";
  options?: Array<{ value: string; label: string }>;
  required?: boolean;
}

export interface JdAnalysis {
  matched: string[];
  missing: string[];
  inferred: Array<{ job: string; via: string }>;
}

export interface CareerInsights {
  visa?: {
    rating: "High" | "Medium" | "Low" | "Unknown";
    eVerify: boolean;
    reason: string;
  };
  outreach?: { linkedin: string; email: string };
}

export interface RecruiterLink {
  roleQuery: string;
  linkedinSearchUrl: string;
}

export interface PageContext {
  title: string;
  jobTitle?: string;
  company: string;
  url: string;
}

export interface VerifyPromptData {
  show: boolean;
  filledCount?: number;
  stepLabel?: string;
}

export interface PanelState {
  /* Score & match */
  score: number;
  matchedKeywords: number;
  totalKeywords: number;

  /* Context */
  platform: string;
  step: string;
  status: string;

  /* Flags */
  needsUser: boolean;
  awaitingOtp: boolean;
  otpFieldCount: number;

  /* Data sections */
  missingFields: MissingField[];
  fillLog: FillLogEntry[];
  jdAnalysis: JdAnalysis | null;
  careerInsights: CareerInsights | null;
  tailoredResume: string | null;
  recruiterLinks: RecruiterLink[];
  verifyPrompt: VerifyPromptData;

  /* Standout Agentic AI Features */
  earlyAdvantage: EarlyAdvantageInfo | null;
  hiringTeam: HiringTeamInfo | null;

  /* Panel chrome */
  minimized: boolean;
  docked: boolean;
  width: number;

  /* Submission countdown */
  submitCountdown: number;
  submitCountdownActive: boolean;

  /* Current page context */
  pageContext: PageContext | null;
}

/* ------------------------------------------------------------------ */
/* Default state                                                       */
/* ------------------------------------------------------------------ */

const STORAGE_KEY = "sja-panel-width";

function loadWidth(): number {
  try {
    const w = parseInt(localStorage.getItem(STORAGE_KEY) ?? "360", 10);
    return Math.min(480, Math.max(320, w));
  } catch {
    return 360;
  }
}

function createDefaultState(): PanelState {
  return {
    score: 0,
    matchedKeywords: 0,
    totalKeywords: 0,
    platform: "",
    step: "",
    status: "Ready — detecting page…",
    needsUser: false,
    awaitingOtp: false,
    otpFieldCount: 0,
    missingFields: [],
    fillLog: [],
    jdAnalysis: null,
    careerInsights: null,
    tailoredResume: null,
    recruiterLinks: [],
    verifyPrompt: { show: false },
    earlyAdvantage: null,
    hiringTeam: null,
    minimized: false,
    docked: true,
    width: loadWidth(),
    submitCountdown: 30,
    submitCountdownActive: false,
    pageContext: null,
  };
}

/* ------------------------------------------------------------------ */
/* Store class                                                         */
/* ------------------------------------------------------------------ */

type Listener = () => void;

class PanelStore {
  private state: PanelState = createDefaultState();
  private listeners = new Set<Listener>();

  /* ── Subscribe / snapshot (for useSyncExternalStore) ────── */

  subscribe = (listener: Listener): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  getSnapshot = (): PanelState => this.state;

  /* ── Mutators (called by orchestrator) ─────────────────── */

  private emit(): void {
    // Create new object reference so React detects the change
    this.state = { ...this.state };
    for (const l of this.listeners) l();
  }

  updateScore(score: number, matched: number, total: number): void {
    this.state.score = score;
    this.state.matchedKeywords = matched;
    this.state.totalKeywords = total;
    this.emit();
  }

  setStatus(text: string): void {
    this.state.status = text;
    this.emit();
  }

  setStep(step: string): void {
    this.state.step = step;
    this.emit();
  }

  setPlatform(name: string): void {
    this.state.platform = name;
    this.emit();
  }

  setMissingFields(fields: MissingField[]): void {
    this.state.missingFields = fields;
    this.emit();
  }

  setNeedsUser(needs: boolean): void {
    this.state.needsUser = needs;
    this.emit();
  }

  setAwaitingOtp(waiting: boolean, fieldCount = 0): void {
    this.state.awaitingOtp = waiting;
    this.state.otpFieldCount = fieldCount;
    this.emit();
  }

  setJdAnalysis(data: JdAnalysis): void {
    this.state.jdAnalysis = data;
    this.emit();
  }

  setCareerInsights(data: CareerInsights): void {
    this.state.careerInsights = data;
    this.emit();
  }

  setTailoredResume(text: string | null): void {
    this.state.tailoredResume = text;
    this.emit();
  }

  setRecruiterLinks(links: RecruiterLink[]): void {
    this.state.recruiterLinks = links;
    this.emit();
  }

  setPageContext(data: PageContext | null): void {
    this.state.pageContext = data;
    this.emit();
  }

  setEarlyAdvantage(data: EarlyAdvantageInfo | null): void {
    this.state.earlyAdvantage = data;
    this.emit();
  }

  setHiringTeam(data: HiringTeamInfo | null): void {
    this.state.hiringTeam = data;
    this.emit();
  }

  setVerifyPrompt(show: boolean, filledCount?: number, stepLabel?: string): void {
    this.state.verifyPrompt = { show, filledCount, stepLabel };
    this.emit();
  }

  setSubmitCountdown(seconds: number): void {
    this.state.submitCountdown = seconds;
    this.emit();
  }

  setSubmitCountdownActive(active: boolean): void {
    this.state.submitCountdownActive = active;
    this.emit();
  }

  addFillLogEntry(entry: Omit<FillLogEntry, "id" | "ts">): void {
    const id = `fl-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    this.state.fillLog = [
      ...this.state.fillLog,
      { ...entry, id, ts: Date.now() },
    ];
    this.emit();
  }

  clearFillLog(): void {
    this.state.fillLog = [];
    this.emit();
  }

  /* ── Panel chrome ──────────────────────────────────────── */

  setMinimized(minimized: boolean): void {
    this.state.minimized = minimized;
    this.emit();
  }

  setDocked(docked: boolean): void {
    this.state.docked = docked;
    this.emit();
  }

  setWidth(width: number): void {
    const clamped = Math.min(480, Math.max(320, width));
    this.state.width = clamped;
    try { localStorage.setItem(STORAGE_KEY, String(clamped)); } catch { /* private mode */ }
    this.emit();
  }
}

/* ------------------------------------------------------------------ */
/* Singleton + hook                                                    */
/* ------------------------------------------------------------------ */

export const panelStore = new PanelStore();

/** React hook — re-renders on any store change. */
export function usePanelStore(): PanelState {
  return useSyncExternalStore(panelStore.subscribe, panelStore.getSnapshot);
}

/** React hook — re-renders only when selector output changes. */
export function usePanelSelector<T>(selector: (s: PanelState) => T): T {
  return useSyncExternalStore(
    panelStore.subscribe,
    () => selector(panelStore.getSnapshot()),
  );
}
