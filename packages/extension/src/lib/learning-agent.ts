/**
 * Learning Agent — watches manual form fills and updates profile brain.
 * Runs in content script on application pages.
 */
import { applyLearnedValue, shouldNeverCacheQuestion, type Profile } from "@superjob/core";
import { detectFields } from "./detector.js";
import { diagLog } from "./diagnostics.js";
import { detectPlatform } from "./platforms.js";
import { idbPut } from "./idb-store.js";
import { getProfile, saveProfile } from "./store.js";
import { getElementByXPath } from "./ats-adapter.js";
import { isProgrammaticAutofillEvent } from "./programmatic-interaction.js";

type FieldSnapshot = Map<string, string>;

let watching = false;
let snapshot: FieldSnapshot = new Map();
let debounceTimer: ReturnType<typeof setTimeout> | null = null;
let boundRoot: ParentNode | null = null;

function fieldId(el: Element): string {
  return el.getAttribute("name") ?? el.id ?? el.getAttribute("aria-label") ?? "";
}

function readValue(el: Element): string {
  if (el instanceof HTMLInputElement) {
    if (el.type === "checkbox") return el.checked ? "true" : "false";
    if (el.type === "radio") return el.checked ? el.value : "";
    if (el.type === "file") return el.files?.[0]?.name ?? "";
    return el.value?.trim() ?? "";
  }
  if (el instanceof HTMLTextAreaElement) return el.value?.trim() ?? "";
  if (el instanceof HTMLSelectElement) return el.value?.trim() ?? "";
  return "";
}

function buildSnapshot(root: ParentNode): FieldSnapshot {
  const map = new Map<string, string>();
  for (const f of detectFields(root)) {
    try {
      const el = document.querySelector(f.selector);
      if (!el) continue;
      const val = readValue(el);
      if (val) map.set(f.label || f.selector, val);
    } catch {
      /* skip */
    }
  }
  return map;
}

async function persistLearned(label: string, value: string) {
  if (shouldNeverCacheQuestion(label)) return;
  const profile = await getProfile();
  if (!profile) return;

  const result = applyLearnedValue(profile, label, value, location.hostname, "manual");
  if (!result.changed) return;

  await saveProfile(result.profile);
  try {
    const { getFillHistory, saveFillHistory } = await import("./store.js");
    const { extractJobFromPage } = await import("./job-extract.js");
    const job = extractJobFromPage();
    const history = await getFillHistory();
    history.push({
      id: `fh_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      timestamp: Date.now(),
      url: location.href,
      company: job.company || "Web",
      jobTitle: job.title || "Job Form",
      label,
      value,
      filledBy: "User",
    });
    await saveFillHistory(history.slice(-300));
  } catch (e) {
    console.error("Failed to log manual fill history", e);
  }
  void idbPut("learning", {
    id: `learn_${Date.now()}_${Math.random().toString(36).slice(2)}`,
    updatedAt: Date.now(),
    hostname: location.hostname,
    label,
    value: value.slice(0, 500),
    fieldKey: result.fieldKey,
    action: result.action,
  });
  void diagLog("profile", "brain-learned", {
    message: `Learned: ${label.slice(0, 40)}`,
    data: { fieldKey: result.fieldKey, action: result.action, value: value.slice(0, 60) },
  });
}

function onFieldChange(ev: Event) {
  const el = ev.target as Element;
  if (!el || !(el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement)) {
    return;
  }
  if (isProgrammaticAutofillEvent(el)) return;
  const value = readValue(el);
  if (!value) return;

  const label =
    el.getAttribute("aria-label") ??
    (el.id ? document.querySelector(`label[for="${el.id}"]`)?.textContent?.trim() : "") ??
    el.getAttribute("name") ??
    el.getAttribute("placeholder") ??
    fieldId(el);

  if (!label || label.length < 2) return;

  const prev = snapshot.get(label);
  if (prev === value) return;

  snapshot.set(label, value);

  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => void persistLearned(label, value), 600);
}

function getFormRoot(): ParentNode {
  const platform = detectPlatform(location.href);
  if (platform?.rootSelector) {
    if (platform.rootSelector.startsWith("//") || platform.rootSelector.startsWith(".//")) {
      return getElementByXPath(platform.rootSelector) ?? document;
    }
    try {
      return document.querySelector(platform.rootSelector) ?? document;
    } catch {
      return document;
    }
  }
  return document.querySelector("form") ?? document;
}

/** Start watching for manual edits after autofill. */
export function startLearningAgent() {
  if (watching) {
    snapshot = buildSnapshot(boundRoot ?? document);
    return;
  }
  watching = true;
  boundRoot = getFormRoot();
  snapshot = buildSnapshot(boundRoot);

  document.addEventListener("change", onFieldChange, true);
  document.addEventListener("blur", onFieldChange, true);

  void diagLog("profile", "brain-active", {
    message: "Learning agent watching manual fills",
    data: { hostname: location.hostname, fields: snapshot.size },
  });
}

export function stopLearningAgent() {
  watching = false;
  document.removeEventListener("change", onFieldChange, true);
  document.removeEventListener("blur", onFieldChange, true);
}

/** Snapshot before autofill so we only learn user changes. */
export function snapshotBeforeFill() {
  boundRoot = getFormRoot();
  snapshot = buildSnapshot(boundRoot);
}

/** Report gaps the brain identified. */
export async function logBrainGaps() {
  const profile = await getProfile();
  if (!profile) return;
  const { brainGaps } = await import("@superjob/core");
  const gaps = brainGaps(profile);
  if (gaps.length) {
    void diagLog("profile", "brain-gaps", {
      level: "warn",
      message: `Profile gaps: ${gaps.join(", ")}`,
      data: { gaps },
    });
  }
}
