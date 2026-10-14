/**
 * The apply pipeline: discover → score → fill → advance → submit → log.
 *
 * This is the headless twin of the browser extension's autofill. It reuses
 * the SAME core engine (scoreMatch, classifyLabel, resolveValue, LLM
 * answerQuestion) so scoring and field-filling behave identically across
 * the extension and the headless applier.
 *
 * v2.0 Enhancements:
 * - Cloud-first LLM routing via CostRouter (no Ollama dependency)
 * - Per-field retry with exponential backoff
 * - Screenshot debugging on failure
 * - Job deduplication across sources
 * - Persistent progress tracking + session resume
 * - Auto cover letter generation
 * - Smart fill ordering (dependencies first)
 * - Pre-submit validation
 */
import type { BrowserContext, Page } from "playwright";
import * as fs from "node:fs";
import * as path from "node:path";
import {
  adjustedMatchScore,
  assessJobRisk,
  checkJobFreshness,
  createLLM,
  createCostRouter,
  createStallWatchdog,
  detectLimitWall,
  evaluateJobGates,
  generateCoverLetter,
  profileToLookup,
  readProfile,
  scoreMatch,
  type Application,
  type Profile,
  type ProfileLookup,
  type LLMConfig,
} from "@superjob/core";
import { fillForm, uploadResume } from "./page-fill.js";
import { scanPage } from "./page-scan.js";
import type { SourceAdapter } from "./sources/types.js";
import type { ApplyOutcome, ApplyResult, PipelineReport, SearchParams } from "./types.js";
import { rateGovernor } from "./rate-governor.js";
import { OTPInterceptor } from "./otp-interceptor.js";
import { VisionFallback } from "./vision-fallback.js";
import { mousePath } from "./mouse-path.js";


const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Sample the current page's visible text and check for a provider apply-limit
 * wall. Wall copy is provider-specific; LinkedIn's daily Easy Apply wall is
 * the surface with published copy, so other providers are skipped for now.
 * (Adaptation 4 — session guardrails from @superjob/core.)
 */
async function detectLimitWallOnPage(
  page: Page,
  providerId: string
): Promise<{ hit: true; matchedPhrase: string } | null> {
  if (providerId !== "linkedin") return null;
  const bodyText = await page
    .locator("body")
    .innerText({ timeout: 2000 })
    .catch(() => "");
  if (!bodyText) return null;
  const d = detectLimitWall(bodyText);
  return d.hit && d.matchedPhrase ? { hit: true, matchedPhrase: d.matchedPhrase } : null;
}

/** Progress checkpoint for session resume */
interface PipelineCheckpoint {
  runId: string;
  adapterId: string;
  params: SearchParams;
  processedJobKeys: string[];
  results: ApplyResult[];
  lastUpdated: number;
}

const CHECKPOINT_DIR = path.join(process.cwd(), ".pipeline-checkpoints");

export interface PipelineHooks {
  onDiscover?: (n: number) => void;
  onScore?: (title: string, score: number) => void;
  onApplyStart?: (title: string) => void;
  onFill?: (filled: number, skipped: number) => void;
  onOutcome?: (result: ApplyResult) => void;
  onPage?: (page: Page) => void;
  onRetry?: (field: string, attempt: number, error: string) => void;
  onScreenshot?: (path: string, context: string) => void;
  onCoverLetter?: (title: string, generated: boolean) => void;
  onDedup?: (skipped: number, total: number) => void;
}

export async function runPipeline(
  ctx: BrowserContext,
  adapter: SourceAdapter,
  params: SearchParams,
  hooks: PipelineHooks = {}
): Promise<PipelineReport> {
  const started = Date.now();
  const page = await ctx.newPage();
  hooks.onPage?.(page);

  // load profile + build lookup + cloud-first LLM
  const profile = await readProfile<Profile>();
  if (!profile?.masterResumeText) {
    throw new Error(
      "No profile found. Run the extension and add your resume first, " +
        "or create one via the core store."
    );
  }
  const lookup: ProfileLookup = profileToLookup(profile);

  // Cloud-first LLM: use CostRouter for optimal provider selection
  const llmConfig = await loadLLMConfig();
  let llm;
  if (llmConfig?.apiKey) {
    // Use cost router for intelligent provider selection
    const router = createCostRouter(
      { [llmConfig.provider || "gemini"]: llmConfig.apiKey },
      { defaultTier: "MODERATE", enableCaching: true }
    );
    llm = await router.getClientForTier("MODERATE");
  } else {
    // Fallback: try Gemini free tier first, then OpenAI
    const fallbackConfig: LLMConfig = { provider: "gemini", model: "gemini-2.0-flash", apiKey: "" };
    llm = createLLM(fallbackConfig);
    console.warn("No LLM config found. Using Gemini free tier. Set API key for better results.");
  }

  // 1) ensure login
  let loggedIn = await adapter.ensureLogin(page);
  if (!loggedIn) {
    if (profile.imapConfig) {
      try {
        console.log("Session expired or authentication needed. Triggering OTP interceptor watch...");
        const interceptor = new OTPInterceptor(profile.imapConfig as any);
        const { code } = await interceptor.waitForOTP(adapter.id);
        
        const otpInput = page.locator("input[name*='otp'], input[id*='otp'], input[placeholder*='code']").first();
        if (await otpInput.isVisible()) {
          await otpInput.fill(code);
          await page.click("button[type='submit'], button:has-text('Verify'), button:has-text('Verify code')").catch(() => {});
          await page.waitForTimeout(3000);
          loggedIn = await adapter.ensureLogin(page);
        }
      } catch (err) {
        console.error("Auto OTP login attempt failed:", err);
      }
    }
    if (!loggedIn) {
      throw new Error("Login is required. Complete it in the browser window and re-run.");
    }
  }

  // 2) search
  await adapter.search(page, params);

  // 3) collect cards
  const cards = await adapter.collectCards(page, params);
  hooks.onDiscover?.(cards.length);

  // 3.5) Deduplicate jobs across sources
  const uniqueCards = deduplicateCards(cards);
  const dedupSkipped = cards.length - uniqueCards.length;
  if (dedupSkipped > 0) {
    hooks.onDedup?.(dedupSkipped, cards.length);
    console.log(`Deduplicated ${dedupSkipped}/${cards.length} jobs across sources`);
  }

  // 3.6) Resume from checkpoint if available
  const checkpoint = await loadCheckpoint(adapter.id, params);
  const processedKeys = new Set(checkpoint?.processedJobKeys ?? []);
  const results: ApplyResult[] = [...(checkpoint?.results ?? [])];
  let applied = results.filter(r => r.outcome === "applied").length;
  let dryRun = results.filter(r => r.outcome === "dry-run").length;
  let skipped = results.filter(r => r.outcome.startsWith("skipped")).length;
  let failed = results.filter(r => r.outcome === "failed").length;
  let scored = results.length;

  // Session guardrails (Adaptation 4): once a provider apply-limit wall is
  // detected the remaining job queue is blocked too, so we halt the run.
  let sessionHalted = false;
  let haltReason: string | undefined;

  if (checkpoint) {
    console.log(`Resuming from checkpoint: ${results.length} jobs already processed`);
  }

  for (const card of uniqueCards) {
    // Session guardrail (Adaptation 4): a daily-limit wall halts the run for
    // the whole remaining queue — later jobs are blocked the same way.
    if (sessionHalted) break;
    const jobKey = `${card.job.id}_${adapter.id}`;
    // Skip already-processed jobs (checkpoint resume)
    if (processedKeys.has(jobKey)) continue;
    if (applied + dryRun >= params.maxApplications) break;

    const rateCheck = await rateGovernor.canApply(adapter.id);
    if (!rateCheck.allowed) {
      console.log(`Skipped application on ${adapter.id}: ${rateCheck.reason}`);
      continue;
    }

    try {
      // Session guardrail (Adaptation 4): if the provider is already showing
      // its apply-limit wall, don't attempt this job — stop the session.
      const wallAtStart = await detectLimitWallOnPage(page, adapter.id);
      if (wallAtStart) {
        const r: ApplyResult = {
          job: card.job,
          outcome: "daily-limit",
          matchScore: 0,
          filledFields: 0,
          error: `Provider apply-limit wall active: "${wallAtStart.matchedPhrase}"`,
          appliedAt: Date.now(),
        };
        results.push(r);
        hooks.onOutcome?.(r);
        sessionHalted = true;
        haltReason = `Stopped at job "${card.job.title}": ${wallAtStart.matchedPhrase}`;
        continue;
      }
      const preRisk = assessJobRisk(card.job, profile);
      const freshness = await checkJobFreshness(card.job).catch(() => ({ checked: false, live: true, reason: "freshness check failed" }));
      if (!freshness.live) {
        const r: ApplyResult = {
          job: card.job,
          outcome: "skipped-risk",
          matchScore: 0,
          filledFields: 0,
          error: `Job not live: ${freshness.reason}`,
          appliedAt: Date.now(),
        };
        results.push(r);
        hooks.onOutcome?.(r);
        skipped++;
        continue;
      }
      if (!preRisk.shouldApply) {
        const r: ApplyResult = {
          job: card.job,
          outcome: "skipped-risk",
          matchScore: 0,
          filledFields: 0,
          error: preRisk.signals.map((s) => s.message).join("; "),
          appliedAt: Date.now(),
        };
        results.push(r);
        hooks.onOutcome?.(r);
        skipped++;
        continue;
      }

      // open the job
      await card.open(page);
      await sleep(params.delayMs);

      // open Easy Apply
      const opened = await adapter.openEasyApply(page, card);
      if (!opened) {
        const outcome = await detectSkipReason(page);
        const r: ApplyResult = { job: card.job, outcome, matchScore: 0, filledFields: 0, appliedAt: Date.now() };
        results.push(r);
        hooks.onOutcome?.(r);
        skipped++;
        continue;
      }

      // score
      const match = scoreMatch({
        resumeText: profile.masterResumeText,
        jobDescription: card.job.description,
        profileSkills: profile.skills,
      });
      const risk = assessJobRisk(card.job, profile);
      const effectiveScore = adjustedMatchScore(match.score, risk);
      scored++;
      hooks.onScore?.(card.job.title, effectiveScore);

      if (!risk.shouldApply) {
        const r: ApplyResult = { job: card.job, outcome: "skipped-risk", matchScore: effectiveScore, filledFields: 0, error: risk.signals.map((s) => s.message).join("; "), appliedAt: Date.now() };
        results.push(r);
        hooks.onOutcome?.(r);
        skipped++;
        await dismissModal(page);
        continue;
      }

      if (effectiveScore < params.minScore) {
        const r: ApplyResult = { job: card.job, outcome: "skipped-low-score", matchScore: effectiveScore, filledFields: 0, appliedAt: Date.now() };
        results.push(r);
        hooks.onOutcome?.(r);
        skipped++;
        await dismissModal(page);
        continue;
      }

      // Optional user gates: blacklist + max-years. Evaluated once the job
      // description is available (after the card opened). Description may be
      // empty for some sources — gating still honors title/company blacklist.
      if (params.gates) {
        const gate = evaluateJobGates(
          {
            title: card.job.title,
            company: card.job.company,
            description: card.job.description,
          },
          {
            blacklistKeywords: params.gates.blacklistKeywords,
            maxYearsRequired: params.gates.maxYearsRequired,
          },
        );
        if (gate.skip) {
          const r: ApplyResult = {
            job: card.job,
            outcome: "skipped-gate",
            matchScore: effectiveScore,
            filledFields: 0,
            error: gate.reason === "blacklist"
              ? `Company blacklist keyword: ${gate.keyword}`
              : `JD requires ${gate.yearsRequired}+ years (max ${gate.maxYears})`,
            appliedAt: Date.now(),
          };
          results.push(r);
          hooks.onOutcome?.(r);
          skipped++;
          await dismissModal(page);
          continue;
        }
      }

      hooks.onApplyStart?.(card.job.title);

      // fill the (possibly multi-page) form with retry logic
      let totalFilled = 0;
      let totalSkipped = 0;
      let steps = 0;
      let stagnantSteps = 0;
      let lastStepSignature = "";
      let outcome: ApplyOutcome = "applied";
      const seenActions = new Map<string, number>();
      const MAX_RETRIES = 3;
      let coverLetterGenerated = false;

      // Per-job time guard (Adaptation 4 — session guardrails): if no
      // observable progress happens for the stall budget, bail to review
      // instead of hanging on a stuck page.
      const stallWatchdog = createStallWatchdog({ stallMs: 90_000 });

      while (steps < 12) {
        steps++;
        await sleep(params.delayMs);

        // Session guardrail (Adaptation 4): LinkedIn's daily Easy Apply wall
        // can appear mid-form; once it does the whole session is blocked.
        const wallMidForm = await detectLimitWallOnPage(page, adapter.id);
        if (wallMidForm) {
          outcome = "daily-limit";
          sessionHalted = true;
          haltReason = `LinkedIn daily Easy Apply wall: "${wallMidForm.matchedPhrase}"`;
          break;
        }

        if (stallWatchdog.isStalled()) {
          outcome = "requires-review";
          skipped++;
          break;
        }

        const fields = await scanPage(page);
        if (fields.length > 0) stallWatchdog.tick();

        // Auto-generate cover letter if cover letter field detected
        if (!coverLetterGenerated && fields.some(f => /cover.?letter|motivation.?letter/i.test(f.label))) {
          try {
            const { text } = await generateCoverLetter(
              { title: card.job.title, company: card.job.company, description: card.job.description },
              profile,
              llm
            );
            // Inject cover letter into profile lookup for field resolution
            (lookup as any).coverLetter = text;
            coverLetterGenerated = true;
            hooks.onCoverLetter?.(card.job.title, true);
          } catch {
            hooks.onCoverLetter?.(card.job.title, false);
          }
        }
        if (fields.length > 0) {
          // Retry fill with exponential backoff
          let fillSuccess = false;
          for (let retry = 0; retry < MAX_RETRIES && !fillSuccess; retry++) {
            try {
              const result = await fillForm(page, fields, lookup, profile, llm, params.delayMs);
              totalFilled += result.filled;
              totalSkipped += result.skipped;
              fillSuccess = true;
              hooks.onFill?.(totalFilled, totalSkipped);
            } catch (err) {
              const errMsg = err instanceof Error ? err.message : String(err);
              hooks.onRetry?.(fields.map(f => f.label).join(", "), retry + 1, errMsg);
              if (retry < MAX_RETRIES - 1) {
                await sleep(params.delayMs * Math.pow(2, retry));
              }
            }
          }
        }

        // Pre-submit validation: check for empty required fields
        if (fields.length > 0) {
          const emptyRequired = await page.locator(
            "input[required]:not([type=hidden]):not([type=file]):not(:disabled), select[required]:not(:disabled), textarea[required]:not(:disabled)"
          ).all();
          let emptyCount = 0;
          for (const el of emptyRequired) {
            const val = await el.inputValue().catch(() => "");
            if (!val.trim()) emptyCount++;
          }
          if (emptyCount > 2) {
            console.warn(`Pre-submit: ${emptyCount} required fields still empty. Attempting one more fill pass.`);
            try {
              const retryResult = await fillForm(page, fields, lookup, profile, llm, params.delayMs);
              totalFilled += retryResult.filled;
              totalSkipped += retryResult.skipped;
            } catch { /* best effort */ }
          }
        }

        const stepSignature = fields.map((f) => `${f.type}:${f.label}`).join("|").slice(0, 500);
        if (stepSignature && stepSignature === lastStepSignature) stagnantSteps++;
        else stagnantSteps = 0;
        lastStepSignature = stepSignature;
        if (stagnantSteps >= 2 && totalFilled === 0) {
          outcome = "requires-review";
          skipped++;
          break;
        }

        // try to upload resume if there's a file field waiting
        if (profile.resumeUrl) {
          await uploadResume(page, profile.resumeUrl).catch(() => {});
        }

        const action = await adapter.advanceForm(page);

        const actionKey = `${stepSignature}::${action}`;
        const actionCount = (seenActions.get(actionKey) ?? 0) + 1;
        seenActions.set(actionKey, actionCount);
        if (actionCount > 2) {
          outcome = "requires-review";
          skipped++;
          console.warn(`Stuck loop detected: action "${action}" repeated on same page state. Breaking.`);
          break;
        }

        if (action === "submit") {
          if (params.dryRun) {
            outcome = "dry-run";
            dryRun++;
          } else {
            // Screenshot before submit for audit trail
            await captureScreenshot(page, `pre-submit-${card.job.company}-${Date.now()}`, hooks);
            await clickSubmit(page);
            await sleep(1500);

            // Session guardrail (Adaptation 4): confirm the provider accepted
            // the submission. If its daily Easy Apply wall appeared instead,
            // count nothing and halt — the rest of the queue is blocked too.
            const wallAfterSubmit = await detectLimitWallOnPage(page, adapter.id);
            if (wallAfterSubmit) {
              outcome = "daily-limit";
              sessionHalted = true;
              haltReason = `LinkedIn daily Easy Apply wall: "${wallAfterSubmit.matchedPhrase}"`;
              break;
            }
            applied++;
            outcome = "applied";
            await rateGovernor.recordSuccess(adapter.id);
          }
          break;
        }
        if (action === "done" || action === "unknown") {
          if (totalFilled > 0) {
            outcome = params.dryRun ? "dry-run" : "requires-review";
            if (params.dryRun) dryRun++;
            else skipped++;
          } else {
            outcome = "failed";
            failed++;
          }
          break;
        }
        // 'next' or 'review' → loop to fill the next page
      }

      const r: ApplyResult = {
        job: card.job,
        outcome,
        matchScore: effectiveScore,
        filledFields: totalFilled,
        appliedAt: Date.now(),
      };
      results.push(r);
      processedKeys.add(jobKey);
      hooks.onOutcome?.(r);

      // Save checkpoint for session resume
      await saveCheckpoint(adapter.id, params, Array.from(processedKeys), results);

      await dismissModal(page);
      await sleep(params.delayMs);
    } catch (e) {
      failed++;
      // Capture screenshot on failure for debugging
      await captureScreenshot(page, `error-${card.job.company}-${Date.now()}`, hooks).catch(() => {});
      const r: ApplyResult = {
        job: card.job,
        outcome: "failed",
        matchScore: 0,
        filledFields: 0,
        error: e instanceof Error ? e.message : String(e),
        appliedAt: Date.now(),
      };
      results.push(r);
      processedKeys.add(jobKey);
      hooks.onOutcome?.(r);
    }
  }

  // persist results into the application tracker (shared with the extension)
  await persistResults(results);

  // Clean up checkpoint on successful completion
  await clearCheckpoint(adapter.id);

  await page.close();

  return {
    discovered: uniqueCards.length,
    scored,
    applied,
    dryRun,
    skipped,
    failed,
    results,
    durationMs: Date.now() - started,
    haltReason,
  };
}

/* ----------------------- helpers ---------------------------- */

/** Deduplicate cards by normalized job identity (title+company+location) */
function deduplicateCards<T extends { job: { id: string; title: string; company: string; url?: string } }>(cards: T[]): T[] {
  const seen = new Map<string, T>();
  for (const card of cards) {
    const normTitle = card.job.title.toLowerCase().replace(/[^a-z0-9]/g, "").trim();
    const normCompany = card.job.company.toLowerCase().replace(/[^a-z0-9]/g, "").trim();
    const key = `${normTitle}::${normCompany}`;
    if (!seen.has(key)) {
      seen.set(key, card);
    }
    // Keep the first occurrence (usually from the primary source)
  }
  return Array.from(seen.values());
}

/** Capture screenshot for debugging/audit */
async function captureScreenshot(page: Page, context: string, hooks: PipelineHooks): Promise<void> {
  try {
    const debugDir = path.join(process.cwd(), ".debug-screenshots");
    if (!fs.existsSync(debugDir)) fs.mkdirSync(debugDir, { recursive: true });
    const filePath = path.join(debugDir, `${context}.png`);
    await page.screenshot({ path: filePath, fullPage: false });
    hooks.onScreenshot?.(filePath, context);
  } catch {
    // Screenshot is best-effort, don't fail the pipeline
  }
}

/** Save pipeline checkpoint for session resume */
async function saveCheckpoint(adapterId: string, params: SearchParams, processedKeys: string[], results: ApplyResult[]): Promise<void> {
  try {
    if (!fs.existsSync(CHECKPOINT_DIR)) fs.mkdirSync(CHECKPOINT_DIR, { recursive: true });
    const checkpoint: PipelineCheckpoint = {
      runId: `run_${Date.now()}`,
      adapterId,
      params,
      processedJobKeys: processedKeys,
      results,
      lastUpdated: Date.now(),
    };
    const filePath = path.join(CHECKPOINT_DIR, `${adapterId}.json`);
    fs.writeFileSync(filePath, JSON.stringify(checkpoint, null, 2));
  } catch {
    // Checkpoint is best-effort
  }
}

/** Load checkpoint for session resume */
async function loadCheckpoint(adapterId: string, params: SearchParams): Promise<PipelineCheckpoint | null> {
  try {
    const filePath = path.join(CHECKPOINT_DIR, `${adapterId}.json`);
    if (!fs.existsSync(filePath)) return null;
    const data = JSON.parse(fs.readFileSync(filePath, "utf-8")) as PipelineCheckpoint;
    // Only resume if params match and checkpoint is less than 24h old
    if (Date.now() - data.lastUpdated > 24 * 60 * 60 * 1000) return null;
    if (data.params.keywords !== params.keywords || data.params.location !== params.location) return null;
    return data;
  } catch {
    return null;
  }
}

/** Clear checkpoint after successful completion */
async function clearCheckpoint(adapterId: string): Promise<void> {
  try {
    const filePath = path.join(CHECKPOINT_DIR, `${adapterId}.json`);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  } catch {
    // Best effort
  }
}

async function detectSkipReason(page: import("playwright").Page): Promise<ApplyOutcome> {
  const applied = await page.locator('button:has-text("Applied"), .post-apply-timestamp').first().isVisible({ timeout: 1000 }).catch(() => false);
  if (applied) return "skipped-already-applied";

  // Check inline feedback message (from autoApplylinkedin reference)
  const feedbackMsg = await page.locator('.artdeco-inline-feedback__message').first().textContent({ timeout: 1000 }).catch(() => null);
  if (feedbackMsg) {
    const textContent = feedbackMsg.toLowerCase();
    if (textContent.includes("applied") && (textContent.includes("ago") || textContent.includes("minutes") || textContent.includes("hours") || textContent.includes("days"))) {
      return "skipped-already-applied";
    }
  }

  return "skipped-no-easy-apply";
}

async function clickSubmit(page: import("playwright").Page): Promise<void> {
  const selectors = [
    'button:has-text("Submit application")',
    'button[type="submit"]:has-text("Submit")',
    'footer button[type="submit"]',
    'button[aria-label*="Submit"]',
    'button:has-text("Apply")',
    'button:has-text("Submit Resume")',
    'button:has-text("Send Application")',
    'button:has-text("Confirm Application")',
    'button[aria-label*="Apply"]',
    'button[aria-label*="Send"]',
  ];
  for (const sel of selectors) {
    try {
      const btn = page.locator(sel).first();
      if (await btn.isVisible({ timeout: 1500 }).catch(() => false)) {
        await mousePath.humanClick(page, sel);
        return;
      }
    } catch {
      continue;
    }
  }

  // Fallback: Try to find any submit button on the page
  try {
    const allSubmit = await page.locator('button[type="submit"]').all();
    for (const btn of allSubmit) {
      if (await btn.isVisible({ timeout: 1000 }).catch(() => false)) {
        await mousePath.humanClick(page, `button[type="submit"]:nth-of-type(${allSubmit.indexOf(btn) + 1})`);
        return;
      }
    }
  } catch {
    // Ignore
  }

  // Last resort: try LLM Vision Fallback if available
  const cfg = await loadLLMConfig();
  if (cfg && cfg.apiKey) {
    try {
      console.log("Submit button not found with standard selectors. Attempting Vision Fallback...");
      const vision = new VisionFallback(cfg);
      const clicked = await vision.clickElementByCoordinates(page, "Submit application button");
      if (clicked) {
        console.log("Vision Fallback: Successfully targeted and clicked submit button by coordinates.");
        return;
      }
      const sel = await vision.findElementSelector(page, "Submit application button");
      if (sel) {
        await mousePath.humanClick(page, sel);
        return;
      }
    } catch (err) {
      console.error("Vision fallback for submit button failed:", err);
    }
  }

  // Final fallback: click the last submit button
  try {
    await page.locator('button[type="submit"]').last().click({ timeout: 3000 });
    return;
  } catch (err) {
    // If all fails, throw with context
    throw new Error("Could not find submit button. Please check the page manually.");
  }
}

async function dismissModal(page: import("playwright").Page): Promise<void> {
  const closeSel = 'button[aria-label*="Dismiss"], button[aria-label*="Close"], .artwork-card button:last-child';
  const close = page.locator(closeSel).first();
  if (await close.isVisible({ timeout: 1500 }).catch(() => false)) {
    await mousePath.humanClick(page, closeSel).catch(() => {});
  }
  await sleep(500);
}

async function loadLLMConfig(): Promise<any> {
  const { getStore } = await import("@superjob/core");
  return getStore().get("llmConfig");
}

async function persistResults(results: ApplyResult[]): Promise<void> {
  const { getStore } = await import("@superjob/core");
  const existing = ((await getStore().get<Application[]>("applications")) ?? []) as Application[];
  for (const r of results) {
    if (r.outcome !== "applied" && r.outcome !== "dry-run") continue;
    const app: Application = {
      id: `app_${r.job.id}`,
      jobId: r.job.id,
      url: r.job.url,
      title: r.job.title,
      company: r.job.company,
      stage: r.outcome === "dry-run" ? "saved" : "applied",
      notes: r.outcome === "dry-run"
        ? "Dry run — form filled, not submitted."
        : `Applied via ${r.job.source}`,
      appliedAt: r.outcome === "dry-run" ? undefined : r.appliedAt,
      updatedAt: Date.now(),
      matchScore: r.matchScore,
    } as Application;
    const idx = existing.findIndex((a) => a.url === app.url);
    if (idx >= 0) existing[idx] = app;
    else existing.unshift(app);
  }
  await getStore().set("applications", existing);
}
