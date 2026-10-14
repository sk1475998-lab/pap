/**
 * Applier Agent — submits applications.
 *
 * This agent is the bridge to the execution layer. In full-browser mode it
 * delegates to @superjob/applier's Playwright pipeline. In "preview" mode
 * (default, no browser) it logs the prepared applications without submitting
 * — useful for review and for headless/Docker runs where a browser may not
 * be available.
 *
 * Either way it writes results to the shared tracker via the core store.
 */
import type { Agent, AgentContext, ApplyLogEntry } from "../framework.js";
import { getStore, type Application } from "@superjob/core";

export interface ApplierOptions {
  /** when provided, this function is called to actually submit (browser). */
  submitFn?: (jobUrl: string, coverLetter: string, ctx: AgentContext) => Promise<{ outcome: string; filledFields: number; error?: string }>;
}

export function createApplier(opts: ApplierOptions = {}): Agent {
  return {
    name: "Applier",
    role: "Application Submitter",
    goal: "Submit the tailored applications and record the results",
    backstory:
      "A detail-oriented operator who fills every field correctly, double-checks " +
      "before hitting submit, and keeps a meticulous record of every application.",
    async execute(ctx: AgentContext): Promise<string> {
      const { tailored, searchParams } = ctx.blackboard;
      const toApply = tailored
        .filter((t) => t.job.url)
        .slice(0, searchParams.maxApplications);

      if (toApply.length === 0) {
        ctx.log("No applications to submit.", "warn");
        return "Nothing to apply to";
      }

      const mode = searchParams.dryRun ? "DRY-RUN (preview only)" : "LIVE";
      ctx.log(`Submitting ${toApply.length} applications — ${mode}`);

      for (const item of toApply) {
        try {
          if (opts.submitFn && !searchParams.dryRun) {
            // delegate to the real browser applier
            const res = await opts.submitFn(item.job.url, item.coverLetter, ctx);
            ctx.log(`${res.outcome}: ${item.job.title || item.job.url} [${item.score}]`);
            ctx.blackboard.applied.push({
              job: item.job,
              score: item.score,
              outcome: res.outcome,
              filledFields: res.filledFields,
              error: res.error,
              timestamp: Date.now(),
            });
          } else {
            // preview mode: record without submitting
            const outcome = searchParams.dryRun ? "dry-run-preview" : "queued";
            ctx.log(`${outcome}: ${item.job.title || item.job.url} [${item.score}]`);
            ctx.blackboard.applied.push({
              job: item.job,
              score: item.score,
              outcome,
              filledFields: 0,
              timestamp: Date.now(),
            });
          }
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          ctx.log(`Failed: ${item.job.url} — ${msg}`, "error");
          ctx.blackboard.applied.push({
            job: item.job,
            score: item.score,
            outcome: "failed",
            filledFields: 0,
            error: msg,
            timestamp: Date.now(),
          });
        }
      }

      // persist to the shared tracker
      await persist(ctx.blackboard.applied);

      const applied = ctx.blackboard.applied.filter((a) => a.outcome !== "failed").length;
      return `Processed ${ctx.blackboard.applied.length} applications (${applied} successful)`;
    },
  };
}

async function persist(entries: ApplyLogEntry[]): Promise<void> {
  const store = getStore();
  const existing = ((await store.get<Application[]>("applications")) ?? []) as Application[];
  for (const e of entries) {
    const app: Application = {
      id: `crew_${e.job.id}`,
      jobId: e.job.id,
      url: e.job.url,
      title: e.job.title,
      company: e.job.company,
      stage: e.outcome === "dry-run-preview" ? "saved" : "applied",
      notes: e.outcome === "dry-run-preview" ? "crew dry-run" : "crew auto-applied",
      appliedAt: e.timestamp,
      updatedAt: Date.now(),
      matchScore: e.score,
    } as Application;
    const idx = existing.findIndex((a) => a.url === app.url);
    if (idx >= 0) existing[idx] = app;
    else existing.unshift(app);
  }
  await store.set("applications", existing);
}
