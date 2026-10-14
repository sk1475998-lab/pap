/**
 * Autofill orchestration: detect fields → resolve values → fill.
 *
 * Enhanced with:
 * - Mutex to prevent concurrent autofill runs
 * - Improved fieldAlreadyFilled for React Select, checkboxes, radios
 * - Post-fill verification pass
 * - Locale-aware smartDefaultForQuestion
 * - Better error boundaries
 */
import {
  answerQuestion,
  applyLearnedValue,
  classifyLabel,
  isSensitiveQuestion,
  normalizeQuestion,
  resolveAll,
  resolveValue,
  smartDefaultForQuestion,
  decideFieldPolicy,
  shouldNeverCacheQuestion,
  type DetectedField,
  buildRunAudit,
  repairProfile,
  type Profile,
  type ProfileLookup,
  defaultReflexionEngine,
} from "@superjob/core";
import type { LLMClient } from "@superjob/core";
import { detectFields } from "./detector.js";
import { isElementVisible } from "./ats-adapter.js";
import { diagLog } from "./diagnostics.js";
import { saveRunAudit } from "./audit-store.js";
import { fillField, fillFile, isResumeField } from "./filler.js";
import { getLinkedInScanRoot, isLinkedInEasyApplyOpen, isLinkedInJobsUrl, linkedInPageHint } from "./linkedin.js";
import { logBrainGaps, snapshotBeforeFill, startLearningAgent } from "./learning-agent.js";
import { detectPlatform } from "./platforms.js";
import { getMatchingAtsConfig, getElementByXPath, queryNode, queryAllNodes, isXPath } from "./ats-adapter.js";
import { getResumeBlob, resumeBlobToFile } from "./resume-store.js";
import { fillPhoneCountryCode } from "./dropdown-handler.js";
import { collectDeepRoots, dedupeFields } from "./dom-deep-scan.js";
import { planAutofillStep } from "./agents/orchestrator.js";
import { recordTimelineEvent } from "./observability-timeline.js";
import { getAgentSettings } from "./store.js";
import { detectDropdownStrategy } from "./dropdown-strategies.js";
import { extractJobFromPage } from "./job-extract.js";
import { jobKey } from "./app-state.js";
import { getResumeVersion, saveResumeVersion } from "./resume-version-store.js";
import { initCursorAgent, cursorFillSequence, hideCursor, destroyCursorAgent } from "./cursor-agent.js";
import { getCachedSelectors, rememberSelector, computeFormSig } from "./pattern-cache.js";
import { highlightField, clearFieldHighlights, attachSensitiveShieldBadge } from "./field-highlighter.js";
import { mountBrainHUD } from "./brain-hud.js";
import { waitForStepTransition } from "./navigation.js";
import { findSemanticAnswer } from "./answer-memory.js";
import { attemptAutoRecovery, preSubmitValidation } from "./form-error-recovery.js";
import { batchAnswerQuestions } from "./custom-question-handler.js";

/* ------------------------------------------------------------------ */
/* Mutex — prevent concurrent autofill runs                            */
/* ------------------------------------------------------------------ */

let autofillRunning = false;
let autofillStartTime = 0;
const AUTOFILL_TIMEOUT_MS = 90000; // 90 seconds - force release if stuck

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export function isAutofillRunning(): boolean {
  return autofillRunning;
}

/* ------------------------------------------------------------------ */
/* Page scan                                                           */
/* ------------------------------------------------------------------ */

export function scanPage() {
  const platform = detectPlatform(location.href);
  const atsConfig = getMatchingAtsConfig(location.href);
  let fields: ReturnType<typeof detectFields> = [];

  // Universal Deep Scan: Traverse all same-origin iframes, open/closed shadow roots,
  // and distributed slotted elements across all websites (Workday, Greenhouse, IBM, Apple, Amazon, etc.)
  const roots = collectDeepRoots();
  for (const root of roots) {
    try {
      fields.push(...detectFields(root));
    } catch { /* skip failing sub-roots */ }
  }

  // Also include specialized target roots if specified
  if (isLinkedInJobsUrl()) {
    try {
      const liRoot = getLinkedInScanRoot();
      if (liRoot && !roots.includes(liRoot)) {
        fields.push(...detectFields(liRoot));
      }
    } catch {}
  } else if (atsConfig?.targetNodeXPath) {
    for (const xpath of atsConfig.targetNodeXPath) {
      const node = getElementByXPath(xpath);
      if (node && !roots.includes(node)) {
        fields.push(...detectFields(node));
        break;
      }
    }
  }

  fields = dedupeFields(fields);

  const hint = linkedInPageHint();
  return {
    platform,
    fields,
    hint,
    linkedInEasyApplyOpen: isLinkedInEasyApplyOpen(),
    formSig: computeFormSig(),
  };
}

/**
 * Apply cached selector overrides from IndexedDB pattern-cache (Adaptive caching).
 * Mutates `fields[i].selector` for fields whose cached selector still resolves.
 * Returns number of overrides applied.
 */
async function applyCachedSelectors(
  fields: DetectedField[],
  origin: string,
  formSig: string,
): Promise<number> {
  if (!origin || !formSig) return 0;
  let applied = 0;
  try {
    const cached = await getCachedSelectors(origin, formSig);
    if (cached.size === 0) return 0;
    for (const f of fields) {
      if (!f.fieldKey) continue;
      const cachedSel = cached.get(f.fieldKey);
      if (!cachedSel) continue;
      try {
        const el = document.querySelector(cachedSel);
        if (el instanceof HTMLElement && isElementVisible(el) && !(el as HTMLInputElement).disabled && !(el as HTMLInputElement).readOnly) {
          f.selector = cachedSel;
          applied++;
        }
      } catch { /* bad cached selector */ }
    }
  } catch { /* ignore cache errors */ }
  return applied;
}

/* ------------------------------------------------------------------ */
/* Autofill options                                                    */
/* ------------------------------------------------------------------ */

export interface FillLogEntry {
  label: string;
  value: string;
  source: "profile" | "ai" | "learned" | "default";
  ok: boolean;
  timeMs: number;
}

export interface AutofillOptions {
  onProgress?: (msg: string) => void;
  onFieldFilled?: (entry: FillLogEntry) => void;
  signal?: AbortSignal;
  /** If true, animate a fake cursor to each field during fill */
  showCursor?: boolean;
}

/* ------------------------------------------------------------------ */
/* Main autofill function                                              */
/* ------------------------------------------------------------------ */

export async function autofill(
  lookup: ProfileLookup,
  profile: Profile,
  llm: LLMClient,
  opts: AutofillOptions = {}
) {
  // Mutex check with timeout — prevent concurrent runs but auto-release if stuck
  const now = Date.now();
  if (autofillRunning && (now - autofillStartTime) < AUTOFILL_TIMEOUT_MS) {
    opts.onProgress?.("Autofill already running — skipping.");
    void diagLog("autofill", "concurrent-blocked", { 
      message: "Autofill in progress", 
      data: { elapsed: now - autofillStartTime }
    });
    return {
      platform: null,
      filled: 0,
      skipped: 0,
      details: [],
      aiAnswered: 0,
      fields: [] as DetectedField[],
      audit: null as any,
      repairs: [],
      missingForUser: [],
      missingFields: [] as DetectedField[],
    };
  }

  // FIX: Force release mutex if timeout exceeded (prevents permanent lock)
  if (autofillRunning && (now - autofillStartTime) >= AUTOFILL_TIMEOUT_MS) {
    void diagLog("autofill", "mutex-timeout-release", { 
      level: "warn", 
      message: "Autofill mutex forcibly released after timeout",
      data: { elapsed: now - autofillStartTime }
    });
  }

  autofillRunning = true;
  autofillStartTime = now;
  try {
    return await autofillInner(lookup, profile, llm, opts);
  } catch (e) {
    void diagLog("autofill", "error", {
      level: "error",
      message: `Autofill failed: ${e instanceof Error ? e.message : String(e)}`,
      data: { stack: e instanceof Error ? e.stack : undefined },
    });
    void recordTimelineEvent("autofill-error", `Error: ${e instanceof Error ? e.message : String(e)}`);
    throw e;
  } finally {
    autofillRunning = false;
  }
}

async function autofillInner(
  lookup: ProfileLookup,
  profile: Profile,
  llm: LLMClient,
  opts: AutofillOptions
) {
  const { profile: repaired, repairs } = repairProfile(profile);
  Object.assign(profile, repaired);

  if (repairs.length) {
    void diagLog("profile", "auto-repair", {
      message: `Fixed ${repairs.length} profile issue(s)`,
      data: { repairs: repairs.map((r) => ({ field: r.field, action: r.action })) },
    });
  }

  const { platform, fields, formSig } = scanPage();
  // Apply cached selectors from previous runs on this site/form
  const origin = (() => { try { return location.origin; } catch { return ""; } })();
  const cacheHits = await applyCachedSelectors(fields, origin, formSig);
  if (cacheHits > 0) {
    void diagLog("autofill", "pattern-cache-hits", { message: `Reused ${cacheHits} cached selector(s) for ${origin}`, data: { hits: cacheHits } });
  }
  opts.onProgress?.(`Detected ${fields.length} fields on ${platform?.name ?? "this page"}${cacheHits ? ` (${cacheHits} cached)` : ""}.`);
  void recordTimelineEvent("autofill-start", `Scan: ${fields.length} fields`, {
    platform: platform?.id,
    cacheHits,
  });
  snapshotBeforeFill();
  void logBrainGaps();

  // Load settings before any behavior depends on them.
  const settings = await getAgentSettings();

  // Disable cursor animation in autonomous mode for faster fills.
  const useCursor = opts.showCursor !== false && !settings.autonomousMode;
  if (useCursor) initCursorAgent();
  const fillStartTime = Date.now();
  const locale = (profile as any).locale ?? "IN";
  const plan = planAutofillStep({
    fieldCount: fields.length,
    platformId: platform?.id,
    maxLlmCallsPerRun: settings.autonomousMode ? 12 : settings.maxLlmCallsPerRun,
    autopilot: settings.autonomousMode,
  });
  const llmBudget = plan.maxLlmCalls;

  for (const f of fields) {
    if (!f.fieldKey) f.fieldKey = classifyLabel(f.label);
  }
  const resolved = resolveAll(fields, lookup);

  // Smart fill ordering: dependencies first, required before optional
  const ordered = smartFillOrder(resolved);

  let filled = 0;
  let skipped = 0;
  let aiAnswered = 0;
  const details: { label: string; ok: boolean; value: string }[] = [];

  const missingForUser: string[] = [];
  const missingFields: DetectedField[] = [];

  clearFieldHighlights();
  const hud = mountBrainHUD(platform?.name ? `SuperJob Brain: ${platform.name}` : "SuperJob Decision Brain");
  hud.updateThought(`Perceived ${ordered.length} form controls. Beginning AgentQ guided fill...`, 0.95);

  // ──────────────────────────────────────────────────────────────────
  // PRE-BATCH QUESTION RESOLUTION: Resolve all custom/screening questions in 1 shot
  // ──────────────────────────────────────────────────────────────────
  const unmappedFields = ordered.filter(
    (f) =>
      f.type !== "file" &&
      !isResumeField(f) &&
      resolveValue(f, lookup) === undefined &&
      !lookup[`custom:${normalizeQuestion(f.label)}`] &&
      !isSensitiveQuestion(f.label) &&
      f.label && f.label.trim().length >= 3
  );

  if (unmappedFields.length > 0) {
    const toBatch: typeof unmappedFields = [];
    for (const uf of unmappedFields) {
      const qKey = normalizeQuestion(uf.label);
      try {
        const mem = await findSemanticAnswer(uf.label, 0.65);
        if (mem?.answer?.answer) {
          lookup[`custom:${qKey}`] = mem.answer.answer;
          profile.customAnswers[qKey] = mem.answer.answer;
          continue;
        }
      } catch {}
      toBatch.push(uf);
    }

    if (toBatch.length > 0 && !settings.llmTailoringOnly && llm.isAvailable() && plan.allowLlm) {
      opts.onProgress?.(`AI answering ${toBatch.length} screening questions in parallel…`);
      try {
        const batchInputs = toBatch.map((f) => ({
          label: f.label,
          type: f.type,
          options: (f.options ?? []).map((o) => ({ text: o.label || o.value || "" })),
        }));
        const answers = await batchAnswerQuestions(batchInputs, profile, llm);
        for (let i = 0; i < toBatch.length; i++) {
          const ans = answers[i]?.trim();
          if (ans) {
            const f = toBatch[i];
            const qKey = normalizeQuestion(f.label);
            lookup[`custom:${qKey}`] = ans;
            profile.customAnswers[qKey] = ans;
            if (!shouldNeverCacheQuestion(f.label)) {
              applyLearnedValue(profile, f.label, ans, location.hostname, "ai");
              try {
                const { saveAnswer } = await import("./answer-memory.js");
                await saveAnswer({ question: f.label, answer: ans });
              } catch {}
            }
            aiAnswered++;
          }
        }
      } catch (err) {
        console.warn("[autofill] Batch answer failed, will fallback to per-field:", err);
      }
    }
  }

  for (const field of ordered) {
    if (opts.signal?.aborted) {
      hud.flashError("Autofill aborted by user.");
      break;
    }

    try {
      // Resume file upload on external sites vs LinkedIn saved resume cards
      if (isResumeField(field)) {
        if (isLinkedInJobsUrl()) {
          try {
            const { selectLinkedInResumeIfNeeded } = await import("./linkedin-autopilot.js");
            const selected = await selectLinkedInResumeIfNeeded();
            if (selected) {
              filled++;
              details.push({ label: field.label, ok: true, value: "(selected resume card)" });
            }
          } catch {}
          continue;
        }
        const job = extractJobFromPage();
        const key = jobKey(job.url, job.title, job.company);
        let version = await getResumeVersion(key);

        if (!version?.tailoredText && settings.autoTailorResume && profile.masterResumeText) {
          try {
            const { groundedTailorResume } = await import("@superjob/core");
            if (llm.isAvailable()) {
              opts.onProgress?.("Tailoring resume with Grounded Myers-diff algorithm...");
              const tailored = await groundedTailorResume({
                jobKey: key,
                title: job.title || "Target Role",
                company: job.company || "",
                jobDescription: job.description || job.title,
                profile,
                llm,
              });
              const tailoredText = tailored?.fullTailoredText || (tailored as any)?.tailoredText;
              if (tailoredText) {
                const score = typeof tailored.tailoredScore === "number"
                  ? tailored.tailoredScore
                  : typeof (tailored as any).finalScore === "number"
                    ? Math.round((tailored as any).finalScore * 100)
                    : null;
                if (score === null) {
                  void diagLog("brain", "tailoring-score-unavailable", { level: "warn", message: "Tailored resume has no measured score; it was not labeled with a synthetic score." });
                  continue;
                }
                version = {
                  jobKey: key,
                  title: job.title || "",
                  company: job.company || "",
                  score,
                  atsScore: score,
                  suggestedAdditions: tailored.suggestedAdditions || [],
                  keywordGaps: tailored.addedKeywords || (tailored as any).keywordGaps || [],
                  createdAt: Date.now(),
                  tailoredText,
                };
                await saveResumeVersion(version);
              }
            }
          } catch (tailorErr) {
            console.warn("[autofill] Grounded tailoring fallback:", tailorErr);
          }
        }

        let fileToUpload: File | undefined = undefined;

        if (version?.tailoredText) {
          const { textToPdf } = await import("@superjob/core");
          const pdfBytes = textToPdf(version.tailoredText);
          const uploadBytes = new Uint8Array(pdfBytes.byteLength);
          uploadBytes.set(pdfBytes);
          const fileName = `${profile.firstName || ""}_${profile.lastName || ""}_Resume_Tailored.pdf`
            .replace(/^_+|_+$/g, "").replace(/\s+/g, "_") || "Resume_Tailored.pdf";
          fileToUpload = new File(
            [uploadBytes],
            fileName,
            { type: "application/pdf" }
          );
          void diagLog("autofill", "resume-tailored-pdf-upload", {
            message: "Uploading auto-tailored binary PDF resume",
            data: { fileName: fileToUpload.name }
          });
        } else {
          const stored = await getResumeBlob();
          if (stored) {
            fileToUpload = resumeBlobToFile(stored);
          } else if (profile.masterResumeText) {
            const { textToPdf } = await import("@superjob/core");
            const pdfBytes = textToPdf(profile.masterResumeText);
            const uploadBytes = new Uint8Array(pdfBytes.byteLength);
            uploadBytes.set(pdfBytes);
            const firstName = profile.firstName || "";
            const lastName = profile.lastName || "";
            const fileName = `${firstName}_${lastName}_Resume.pdf`.replace(/^_+|_+$/g, "").replace(/\s+/g, "_") || "Resume.pdf";
            fileToUpload = new File([uploadBytes], fileName, { type: "application/pdf" });
            void diagLog("autofill", "resume-auto-rebuild-pdf", {
              message: "Auto-compiled binary PDF resume from master text",
              data: { fileName }
            });
          } else {
            void diagLog("autofill", "resume-rebuild-hint", {
              level: "warn",
              message: "Resume PDF missing from storage and no master text available — re-upload in Profile tab",
            });
            missingForUser.push("Resume PDF — open extension → Profile → re-upload");
          }
        }

        if (fileToUpload) {
          const res = fillFile(field, fileToUpload);
          if (res.ok) {
            filled++;
            highlightField(field.selector, "success", "✓ Resume Uploaded");
            details.push({ label: field.label, ok: true, value: fileToUpload.name });
            void diagLog("autofill", "resume-uploaded", { data: { fileName: fileToUpload.name, platform: platform?.id } });
          } else {
            skipped++;
            highlightField(field.selector, "missing", "⚠ Resume upload failed");
            details.push({ label: field.label, ok: false, value: res.filledWith });
            void diagLog("autofill", "resume-upload-failed", { level: "warn", data: { reason: res.filledWith } });
          }
          continue;
        }
        skipped++;
        details.push({ label: field.label, ok: false, value: "no resume file stored" });
        missingForUser.push(`Resume upload: ${field.label}`);
        void diagLog("autofill", "resume-missing", { level: "warn", message: "Sync a resume from the web dashboard first" });
        continue;
      }

      if (field.fieldKey === "phone" && lookup.phoneCountryCode) {
        await fillPhoneCountryCode(String(lookup.phoneCountryCode));
      }

      if (fieldAlreadyFilled(field, lookup)) {
        details.push({ label: field.label, ok: true, value: "(already filled)" });
        continue;
      }

      const policy = decideFieldPolicy(field, lookup, {
        allowSensitiveDefaults: settings.autonomousMode && !settings.llmTailoringOnly,
        allowEeoAutofill: settings.autonomousMode && !settings.llmTailoringOnly,
        allowSalaryAutofill: settings.autonomousMode && !settings.llmTailoringOnly,
        allowAutonomousFallback: true,
      });
      if (policy.action === "skip") {
        skipped++;
        details.push({ label: field.label, ok: false, value: `skipped — ${policy.reason}` });
        void diagLog("autofill", "policy-skip", { level: "info", data: { label: field.label, risk: policy.risk, reason: policy.reason } });
        continue;
      }
      if (policy.action === "needs-user") {
        const smartDef = smartDefaultForQuestion(field.label, profile.locale);
        if (smartDef && !fieldAlreadyFilled(field, lookup)) {
          const filledSmart = await fillField(field, smartDef);
          if (filledSmart.ok) {
            filled++;
            details.push({ label: field.label, ok: true, value: smartDef });
            continue;
          }
        }
        skipped++;
        const msg = `${field.label} — ${policy.reason}`;
        missingForUser.push(msg);
        if (!isResumeField(field)) missingFields.push(field);
        details.push({ label: field.label, ok: false, value: "needs user confirmation" });
        void diagLog("autofill", "policy-needs-user", { level: "info", data: { label: field.label, risk: policy.risk, reason: policy.reason } });
        continue;
      }

      let value = resolveValue(field, lookup);

      // Cover letter / personal pitch note auto-tailoring
      const isCoverLetterField =
        field.fieldKey === "coverLetter" ||
        /(?:cover\s*letter|personal\s*note|note\s*to\s*(?:the\s*)?hiring|why\s*(?:do\s*you\s*want\s*to\s*work|are\s*you\s*interested|work\s*at|join))/i.test(field.label);

      if (isCoverLetterField && (!value || (typeof value === "string" && !value.trim()))) {
        const job = extractJobFromPage();
        if (job.title || job.company) {
          try {
            const { generateCoverLetter } = await import("@superjob/core");
            const letterRes = await generateCoverLetter(job, profile, llm);
            if (letterRes?.text) {
              value = letterRes.text;
              aiAnswered++;
              void diagLog("autofill", "cover-letter-tailored", {
                data: { title: job.title, company: job.company, source: letterRes.source }
              });
            }
          } catch {
            /* fallback to standard resolution */
          }
        }
      }

      if (value === undefined && field.type !== "file") {
        const key = normalizeQuestion(field.label);
        const raw = lookup[`custom:${key}`];
        let cached: string | undefined = Array.isArray(raw) ? raw.join(", ") : raw;

        if (!cached && isSensitiveQuestion(field.label) && !lookup[field.fieldKey]) {
          skipped++;
          attachSensitiveShieldBadge(field.selector, field.label, () => {
            void fillField(field, (lookup[field.fieldKey] ?? "") as any);
          });
          details.push({ label: field.label, ok: false, value: "sensitive — shield attached" });
          if (!isResumeField(field)) missingFields.push(field);
          continue;
        }

        // Determine smart local default (used as fallback or when LLM is offline/budgeted)
        const localDefault = smartDefaultForQuestion(field.label, locale);

        // Try semantic answer memory first (0ms latency, avoids LLM call)
        if (!cached) {
          try {
            const semantic = await findSemanticAnswer(field.label, 0.65);
            if (semantic?.answer?.answer) {
              cached = semantic.answer.answer;
              void diagLog("autofill", "semantic-memory-hit", { data: { label: field.label, value: cached } });
            }
          } catch { /* ignore memory errors */ }
        }

        // When LLM is active and allowed, ask AI to answer using the candidate's resume context
        // (passing localDefault as fallback answer).
        // H1 FIX: Guard against answering sensitive identity/credential questions with generic LLM
        if (!cached && !settings.llmTailoringOnly && llm.isAvailable() && plan.allowLlm && aiAnswered < llmBudget && !isSensitiveQuestion(field.label)) {
          opts.onProgress?.(`Asking AI: "${field.label.slice(0, 40)}…"`);
          try {
            cached = await answerQuestion(
              llm,
              field.label,
              profile.masterResumeText,
              field.options,
              field.type,
              localDefault
            );
          } catch {
            cached = localDefault;
          }
          if (cached) {
            if (!shouldNeverCacheQuestion(field.label)) {
              lookup[`custom:${key}`] = cached;
              profile.customAnswers[key] = cached;
              const learned = applyLearnedValue(profile, field.label, cached, location.hostname, "ai");
              Object.assign(profile, learned.profile);
            }
            aiAnswered++;
          }
        } else if (!cached && localDefault !== undefined) {
          // LLM is offline, tailoring-only, or budget exhausted: use smart heuristic default
          cached = localDefault;
          if (!shouldNeverCacheQuestion(field.label)) {
            profile.customAnswers[key] = cached;
          }
        }

        if (cached) {
          value = cached;
          field.fieldKey = `custom:${key}`;
        }
      }

      if (value !== undefined && value !== "") {
        const repaired = defaultReflexionEngine.repairValueFromMemory(jobKey(location.href), field.label, String(value));
        if (repaired !== value) {
          void diagLog("autofill", "reflexion-repaired", {
            data: { label: field.label, before: value, after: repaired },
          });
          value = repaired;
        }
      }

      if (value === undefined || value === "") {
        skipped++;
        details.push({ label: field.label, ok: false, value: "no value" });
        missingForUser.push(field.label);
        if (!isResumeField(field)) {
          missingFields.push(field);
          highlightField(field.selector, "missing", "⚠ Field needs your input");
        }
        void diagLog("autofill", "skip-field", {
          level: "warn",
          data: { label: field.label, fieldKey: field.fieldKey },
        });
        continue;
      }

      // Track the actual source of the value for accurate attribution
      let valueSource: FillLogEntry["source"] = "profile";
      if (field.fieldKey?.startsWith("custom:")) {
        // If the cached key was set by AI in this run, mark as "ai"; if pre-learned, "learned"
        const wasAiThisRun = aiAnswered > 0 && !lookup[`custom:${normalizeQuestion(field.label)}`];
        valueSource = wasAiThisRun ? "ai" : "learned";
      } else if (isCoverLetterField) {
        valueSource = "ai";
      }

      // Animate cursor to field before filling
      const fieldStartMs = Date.now();
      if (useCursor) {
        try {
          const el = queryNode(field.selector);
          if (el) {
            await cursorFillSequence(el, field.label, String(value), valueSource);
          }
        } catch { /* cursor animation is non-critical */ }
      }

      const res = await fillField(field, value as any);
      // normalize value to string for logging/safety
      const fieldTimeMs = Date.now() - fieldStartMs;
      if (res.ok) {
        filled++;
        highlightField(
          field.selector,
          isCoverLetterField || field.fieldKey?.startsWith("custom:") ? "ai" : "success",
          isCoverLetterField ? "🤖 AI-Tailored Cover Letter / Pitch" : "✓ Autofilled from Profile"
        );
        hud.updateProgress(filled, ordered.length, field.label);
        hud.triggerFieldRipple(field.selector);
        hud.updateThought(`Filled "${field.label}"`, 0.96, "Fill");
      } else {
        skipped++;
        if (!isResumeField(field)) {
          missingFields.push(field);
          highlightField(field.selector, "missing", "⚠ Field could not be filled automatically");
        }
      }
      details.push({ label: field.label, ok: res.ok, value: res.filledWith });

      // Emit fill log entry with corrected source tracking
      opts.onFieldFilled?.({
        label: field.label,
        value: res.filledWith,
        source: valueSource,
        ok: res.ok,
        timeMs: fieldTimeMs,
      });
    } catch (fieldErr) {
      // Per-field error boundary — one field failing shouldn't kill the whole run
      skipped++;
      if (!isResumeField(field)) missingFields.push(field);
      details.push({
        label: field.label,
        ok: false,
        value: `error: ${fieldErr instanceof Error ? fieldErr.message : String(fieldErr)}`,
      });
      void diagLog("autofill", "field-error", {
        level: "error",
        data: {
          label: field.label,
          selector: field.selector,
          error: fieldErr instanceof Error ? fieldErr.message : String(fieldErr),
        },
      });
    }
  }

  // Remember successful selectors in pattern-cache for next run (Adaptive caching)
  try {
    let remembered = 0;
    for (const d of details) {
      if (!d.ok) continue;
      const field = ordered.find((f) => f.label === d.label);
      if (!field?.fieldKey) continue;
      // Only cache CSS selectors (id/name/attr) — XPaths are too page-specific
      if (field.selector.startsWith("/") || field.selector.startsWith("(")) continue;
      // Validate selector still resolves before caching
      try {
        if (document.querySelector(field.selector)) {
          void rememberSelector(origin, formSig, field.fieldKey, field.selector);
          remembered++;
        }
      } catch { /* bad selector */ }
    }
    if (remembered > 0) {
      void diagLog("autofill", "pattern-cache-remembered", { data: { remembered } });
    }
  } catch { /* ignore cache errors */ }

  // Clean up cursor agent
  if (useCursor) {
    hideCursor();
    setTimeout(destroyCursorAgent, 1000);
  }

  // FormFlow / Form-N-Fill Reactive Settling Cycle:
  // After filling previous fields, wait for DOM Quiescence and check if dynamic
  // conditional fields were revealed (e.g., selecting Yes for sponsorship revealed 2 new fields).
  try {
    await sleep(400); // Allow DOM animations / state mutations to settle
    const postScan = scanPage();
    const existingSelectors = new Set(ordered.map((f) => f.selector));
    const newRevealedFields = postScan.fields.filter(
      (f) => !existingSelectors.has(f.selector) && !fieldAlreadyFilled(f, lookup)
    );

    if (newRevealedFields.length > 0) {
      void diagLog("autofill", "conditional-disclosure-detected", {
        message: `Detected ${newRevealedFields.length} dynamically revealed conditional fields`,
        data: { fields: newRevealedFields.map((f) => f.label) }
      });
      opts.onProgress?.(`Detected ${newRevealedFields.length} newly revealed conditional fields, filling...`);

      for (const field of newRevealedFields) {
        try {
          // C2 FIX: Always apply field policy guardrail — conditional reveal must not bypass
          // sensitive-field protections (EEO, credentials, assessments, etc.)
          if (!field.fieldKey) field.fieldKey = classifyLabel(field.label);
          const revealedPolicy = decideFieldPolicy(field, lookup, {
            allowSensitiveDefaults: settings.autonomousMode && !settings.llmTailoringOnly,
            allowEeoAutofill: settings.autonomousMode && !settings.llmTailoringOnly,
            allowSalaryAutofill: settings.autonomousMode && !settings.llmTailoringOnly,
            allowAutonomousFallback: settings.autonomousMode && !settings.llmTailoringOnly,
          });
          if (revealedPolicy.action === "skip" || revealedPolicy.action === "needs-user") {
            skipped++;
            if (revealedPolicy.action === "needs-user") {
              missingForUser.push(`${field.label} — ${revealedPolicy.reason}`);
              missingFields.push(field);
            }
            void diagLog("autofill", "conditional-field-policy-blocked", {
              level: "warn",
              data: { label: field.label, action: revealedPolicy.action, risk: revealedPolicy.risk }
            });
            continue;
          }
          const value = resolveValue(field, lookup) ?? smartDefaultForQuestion(field.label, locale);
          if (value) {
            const res = await fillField(field, value as any);
            if (res.ok) {
              filled++;
              highlightField(field.selector, "success", "✓ Dynamically Revealed Field Filled");
              details.push({ label: field.label, ok: true, value: res.filledWith });
            } else {
              missingFields.push(field);
              highlightField(field.selector, "missing", "⚠ Conditional field could not be filled");
            }
          }
        } catch { /* best effort on conditional field */ }
      }
      await sleep(300);
    }
  } catch (settleErr) {
    /* ignore settling loop error */
  }

  // --- ENTERPRISE PIPELINE: LATS SELF-HEALING (ERROR RECOVERY) ---
  try {
    opts.onProgress?.("Checking for validation errors (LATS)...");
    const atsConfig = getMatchingAtsConfig(location.href);
    const recovery = await attemptAutoRecovery(atsConfig as any, async (fieldKey, fieldLabel) => {
      // Re-fill callback for clear-and-refill actions
      const field = ordered.find((f) => f.fieldKey === fieldKey);
      if (field) {
        let val = resolveValue(field, lookup) ?? smartDefaultForQuestion(fieldLabel, locale);
        if (val) {
          val = defaultReflexionEngine.repairValueFromMemory(jobKey(location.href), fieldLabel, String(val));
          const res = await fillField(field, val as any);
          return res.ok;
        }
      }
      return false;
    });
    if (recovery.recovered > 0) {
      filled += recovery.recovered;
      void diagLog("autofill", "lats-recovery-success", { message: `LATS Auto-recovered ${recovery.recovered} validation errors` });
      hud.flashSuccess(`LATS Auto-recovered ${recovery.recovered} validation errors!`);
    }

    // Record validation errors into ReflexionEngine episodic memory
    for (const fix of recovery.details) {
      void defaultReflexionEngine.recordFailureAndReflect({
        jobId: jobKey(location.href),
        stepName: "form-validation",
        failedAction: {
          actionType: "FILL_INPUT",
          fieldKey: fix.fieldKey,
          selector: "",
          label: fix.fieldLabel,
          value: "",
          confidence: 0.5,
          reasoning: fix.errorMessage,
        },
        observedError: fix.errorMessage,
        llm,
      });
    }
    
    // Pre-submit scan for missing required fields
    const preSubmit = preSubmitValidation(atsConfig as any);
    if (!preSubmit.isValid && preSubmit.emptyRequired.length > 0) {
      const missingLabels = preSubmit.emptyRequired.map((e) => e.label);
      missingForUser.push(...missingLabels);
      void diagLog("autofill", "presubmit-failed", { data: { missing: missingLabels } });
    }
  } catch (err) {
    void diagLog("autofill", "lats-recovery-error", { level: "warn", message: String(err) });
  }

  startLearningAgent();

  // Autopilot: If runNavigation is enabled and all required fields are satisfied, advance to next step
  if (plan.runNavigation && missingFields.length === 0 && filled > 0) {
    try {
      const buttons = Array.from(document.querySelectorAll("button, [role='button']"));
      const nextBtn = buttons.find((b) => {
        const txt = (b.textContent ?? "").trim().toLowerCase();
        return (
          /^(next|continue|review|review application|save and continue)$/i.test(txt) &&
          !(b as HTMLButtonElement).disabled &&
          (b as HTMLElement).offsetParent !== null
        );
      });

      if (nextBtn) {
        opts.onProgress?.(`Autopilot: Advancing to next step ("${nextBtn.textContent?.trim()}")...`);
        hud.updateThought(`Advancing step: "${nextBtn.textContent?.trim()}"`, 0.98, "Advance");
        void recordTimelineEvent("autopilot-advance", `Clicked ${nextBtn.textContent?.trim()}`);
        await sleep(600);
        (nextBtn as HTMLElement).click();
        const stepRes = await waitForStepTransition(6000);
        if (stepRes.transitioned) {
          hud.updateThought(`Step advanced: ${stepRes.currentStepLabel || "Next Step"}`, 0.95);
        } else if (stepRes.validationErrors.length > 0) {
          hud.flashError(`Form validation blocked: ${stepRes.validationErrors[0]}`);
        }
      }
    } catch { /* best-effort navigation */ }
  }

  opts.onProgress?.(`Done: ${filled} filled, ${skipped} skipped.`);
  hud.flashSuccess(`Autofill completed: ${filled} filled, ${skipped} skipped.`);

  const audit = buildRunAudit(profile, repairs, details, ordered, {
    url: location.href,
    platform: platform?.id,
  });
  await saveRunAudit(audit);
  void diagLog("audit", "session-complete", {
    message: `${filled} filled, ${skipped} skipped on ${platform?.name ?? "page"}`,
    data: {
      summary: audit.summary,
      recommendations: audit.recommendations.slice(0, 5),
      hostname: audit.hostname,
      aiAnswered,
      llmBudget,
    },
  });
  void recordTimelineEvent("autofill-complete", `${filled} filled, ${skipped} skipped`, {
    aiAnswered,
    llmBudget,
  });

  return {
    platform,
    filled,
    skipped,
    details,
    aiAnswered,
    fields: ordered as DetectedField[],
    audit,
    repairs,
    missingForUser,
    missingFields,
  };
}

/* ------------------------------------------------------------------ */
/* Smart fill ordering                                                  */
/* ------------------------------------------------------------------ */

/**
 * Reorder fields for optimal fill sequence.
 * 
 * Priority order:
 * 1. File uploads (resume) — take longest, do first
 * 2. Country/phone country code — dependencies for other fields
 * 3. State — depends on country
 * 4. City/location — depends on state
 * 5. Required fields — ensure form can submit
 * 6. Simple text inputs — fast, reliable
 * 7. Selects/dropdowns — may trigger page changes
 * 8. Checkboxes/radios — last, as they may toggle visibility
 */
function smartFillOrder(fields: ReturnType<typeof resolveAll>): typeof fields {
  const PRIORITY_MAP: Record<string, number> = {
    // Tier 1: File uploads
    resumeFile: 0,
    // Tier 2: Country-level (dependencies)
    country: 10,
    phoneCountryCode: 11,
    workAuthorization: 12,
    requiresSponsorship: 13,
    // Tier 3: State-level
    state: 20,
    // Tier 4: City/location
    city: 30,
    location: 31,
    preferredLocation: 32,
    experienceLocation: 33,
    // Tier 5: Core identity (required for most forms)
    firstName: 40,
    lastName: 41,
    middleName: 42,
    fullName: 43,
    email: 44,
    phone: 45,
    // Tier 6: Professional info
    jobTitle: 50,
    workExperienceCompany: 51,
    experienceYears: 52,
    experienceMonths: 53,
    yearsOfExperience: 54,
    // Tier 7: Education
    school: 60,
    degree: 61,
    major: 62,
    graduationYear: 63,
    graduationDate: 64,
    gpa: 65,
    // Tier 8: Links
    linkedin: 70,
    github: 71,
    website: 72,
    // Tier 9: Salary/notice (sensitive, may need user input)
    currentCTC: 80,
    expectedCTC: 81,
    noticePeriod: 82,
    noticePeriodDays: 83,
    lastWorkingDay: 84,
    immediateJoiner: 85,
    salaryExpectation: 86,
    // Tier 10: Everything else
  };

  return [...fields].sort((a, b) => {
    const pa = PRIORITY_MAP[a.fieldKey ?? ""] ?? 90;
    const pb = PRIORITY_MAP[b.fieldKey ?? ""] ?? 90;
    if (pa !== pb) return pa - pb;
    // Within same tier: required fields first, then by type complexity
    const aRequired = (a as any).required ? 0 : 1;
    const bRequired = (b as any).required ? 0 : 1;
    if (aRequired !== bRequired) return aRequired - bRequired;
    // Simple types before complex
    const typeComplexity: Record<string, number> = { text: 0, email: 0, tel: 0, number: 0, url: 0, textarea: 1, select: 2, radio: 3, checkbox: 4, file: 5 };
    return (typeComplexity[a.type] ?? 3) - (typeComplexity[b.type] ?? 3);
  });
}

/* ------------------------------------------------------------------ */
/* Field already filled detection (enhanced)                           */
/* ------------------------------------------------------------------ */

/**
 * Check if a field already has a value.
 * Handles:
 * - Native inputs/selects
 * - React Select (check visible text in control container)
 * - Radio groups (check if any option is selected)
 * - Checkboxes (check current state)
 * - contenteditable elements
 */
function fieldAlreadyFilled(field: DetectedField, lookup: ProfileLookup): boolean {
  try {
    if (field.type === "file") {
      const el = queryNode(field.selector) as HTMLInputElement | null;
      return Boolean(el?.files?.length);
    }

    // Radio: check if any option in the group is already selected
    if (field.type === "radio") {
      const radios = (isXPath(field.selector) ? queryAllNodes(field.selector) : Array.from(document.querySelectorAll(field.selector))) as HTMLInputElement[];
      return radios.some((r) => r.checked);
    }

    // FIX: Check if checkbox state matches desired value instead of always refilling
    if (field.type === "checkbox") {
      const el = queryNode(field.selector) as HTMLInputElement | null;
      if (!el) return false;
      
      // Check if value matches profile preference
      const profileValue = lookup[field.fieldKey];
      if (profileValue === undefined) return false; // No profile value, fill it
      
      const desiredState = String(profileValue).toLowerCase() === "true" || 
                           String(profileValue) === "1" || 
                           String(profileValue).toLowerCase() === "yes";
      return el.checked === desiredState;
    }

    const el = queryNode(field.selector);
    if (!el) return false;

    // Native select
    if (el instanceof HTMLSelectElement) {
      if ((field.fieldKey === "email" || /email/i.test(field.label)) && el.value?.includes("@")) {
        return true;
      }
      return Boolean(el.value && el.selectedIndex > 0);
    }

    // Standard input/textarea
    if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
      if ((field.fieldKey === "email" || /email/i.test(field.label)) && el.value?.includes("@")) {
        return true;
      }
      return Boolean(el.value?.trim());
    }

    // React Select / custom dropdown: check for visible selected value text
    const strategy = detectDropdownStrategy(el);
    if (strategy) {
      // Check for visible selected value in the control
      const control = el.closest("[class*='__control'], [class*='select'], [class*='Select']");
      if (control) {
        const singleValue = control.querySelector(
          "[class*='__single-value'], [class*='__multi-value'], " +
          "[class*='MuiSelect-select'], .ant-select-selection-item, " +
          "[class*='value']"
        );
        if (singleValue?.textContent?.trim()) return true;
      }
      // Check for placeholder-only state (not filled)
      const placeholder = el.querySelector("[class*='__placeholder']");
      if (placeholder) return false;
    }

    // contenteditable
    if (el.getAttribute("contenteditable") === "true" || el.getAttribute("role") === "textbox") {
      return Boolean((el as HTMLElement).textContent?.trim());
    }

    // Workday web components
    if (el.tagName.toLowerCase().startsWith("wd-")) {
      const inner = el.querySelector("input, textarea, select");
      if (inner instanceof HTMLInputElement) return Boolean(inner.value?.trim());
      if (inner instanceof HTMLSelectElement) return Boolean(inner.value && inner.selectedIndex > 0);
    }

    return false;
  } catch {
    return false;
  }
}
