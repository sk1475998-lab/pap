/**
 * `/api/sync` — the single endpoint that makes cloud and extension one product.
 *
 * The contract is intentionally symmetrical and tiny:
 *
 *   GET  /api/sync          pull the cloud's state as an envelope
 *   POST /api/sync          push a device envelope, merge, return the merged result
 *   GET  /api/sync/status   cheap "is there anything new?" poll
 *
 * NOTHING IS REIMPLEMENTED HERE. The merge, the envelope format, the redaction
 * rules and the application-identity logic all live in `@superjob/core`, and the
 * extension calls the exact same functions. That is the structural reason the
 * two sides cannot drift into "two separate fillings": there is one merge
 * implementation in the repo, and both callers import it.
 *
 * Tenant scoping is ambient — `requireAuth` has already put this request inside
 * the user's namespace, so `buildSyncEnvelope()` and `applySyncEnvelope()` read
 * and write that user's data without knowing tenancy exists.
 */
import { Router } from "express";
import {
  applySyncEnvelope,
  buildSyncEnvelope,
  parseSyncEnvelope,
  readLocalSyncState,
  applicationIdentity,
  isApplicationStage,
  mergeApplicationLists,
  SYNCED_KEYS,
  SYNC_SCHEMA_VERSION,
  writeLocalSyncState,
  type SyncEnvelope,
} from "@superjob/core";
import { asyncRoute, requireAuth, optionalAuth, type AuthedRequest } from "../lib/tenant.js";
import { SYNC_RULE, consume } from "../lib/rate-limit.js";
import { withApplicationQuota } from "../lib/application-quota.js";
import { ensureMonthlyQuotaFresh, TIER_LIMITS } from "./billing.js";

export const syncRouter = Router();

/** The cloud presents itself with a fixed deviceId so a device knows its echo. */
const CLOUD_DEVICE_ID = "cloud";

// GAP-SYNC-01 FIX: Public status & health endpoint
// Allows extension settings / testCloudConnection to verify connectivity without 401.
syncRouter.get(
  "/health",
  asyncRoute(async (_req, res) => {
    res.json({ ok: true, status: "healthy", schema: SYNC_SCHEMA_VERSION, version: "0.1.5", timestamp: Date.now() });
  }),
);

// Optional auth for status check: returns basic health if anonymous, full sync clocks if authenticated
syncRouter.get(
  "/status",
  optionalAuth,
  asyncRoute(async (req, res) => {
    const authedUser = (req as AuthedRequest).user;
    if (!authedUser) {
      return res.json({
        ok: true,
        status: "alive",
        authenticated: false,
        schema: SYNC_SCHEMA_VERSION,
        version: "0.1.5",
        message: "SuperJobAgent Cloud Sync Online — Authentication required for tenant sync data",
      });
    }

    const state = await readLocalSyncState();
    const keys: Record<string, number> = {};
    for (const key of SYNCED_KEYS) {
      const at = state.meta?.[key]?.updatedAt;
      if (at) keys[key] = at;
    }
    res.json({
      ok: true,
      authenticated: true,
      schema: SYNC_SCHEMA_VERSION,
      version: "0.1.5",
      revision: state.revision,
      lastPushedAt: state.lastPushedAt,
      lastPulledAt: state.lastPulledAt,
      keys,
    });
  }),
);

// All mutation and full envelope endpoints require authentication
syncRouter.use(requireAuth);

/** Per-user throttle. Applied after auth so one user cannot starve another. */
syncRouter.use((req: AuthedRequest, res, next) => {
  const verdict = consume(`sync:${req.user?.userId ?? "anon"}`, SYNC_RULE);
  if (!verdict.allowed) {
    res.setHeader("Retry-After", Math.ceil(verdict.retryAfterMs / 1000));
    return res.status(429).json({
      ok: false,
      error: "Syncing too often. Try again shortly.",
      code: "RATE_LIMITED",
      retryAfterMs: verdict.retryAfterMs,
    });
  }
  next();
});

/**
 * Build the envelope the cloud sends to a device.
 *
 * `includeSensitive` is true because the cloud is not the redaction boundary —
 * the DEVICE is. A device only ever uploads government IDs and mail credentials
 * when the user explicitly opts in, so if the cloud holds them at all, this
 * user asked for them to be there and their other device should receive them.
 * Note `buildSyncEnvelope` still drops `llmConfig.apiKey` unconditionally.
 */
async function cloudEnvelope(): Promise<SyncEnvelope> {
  const envelope = await buildSyncEnvelope({ includeSensitive: true });
  const state = await readLocalSyncState();
  return { ...envelope, deviceId: CLOUD_DEVICE_ID, revision: state.revision };
}

/** Bump the authoritative revision. The cloud owns this counter, not devices. */
async function bumpRevision(): Promise<number> {
  const state = await readLocalSyncState();
  const revision = (Number(state.revision) || 0) + 1;
  await writeLocalSyncState({ ...state, revision, lastPushedAt: Date.now() });
  return revision;
}

/* ------------------------------- pull ------------------------------- */

syncRouter.get(
  "/",
  asyncRoute(async (_req, res) => {
    const envelope = await cloudEnvelope();
    res.json({ ok: true, envelope, revision: envelope.revision, schema: SYNC_SCHEMA_VERSION });
  }),
);

/* ------------------------------- push ------------------------------- */

syncRouter.post(
  "/",
  asyncRoute(async (req, res) => {
    const parsed = parseSyncEnvelope(req.body);
    if (!parsed.ok) {
      return res.status(400).json({ ok: false, error: parsed.error, code: "BAD_ENVELOPE" });
    }

    const incoming = parsed.envelope;
    const user = (req as AuthedRequest).user;
    const remoteApplications = incoming.data.applications;
    let quotaNote: string | undefined;

    if (user && Array.isArray(remoteApplications) && remoteApplications.length > 0) {
      const current = await cloudEnvelope();
      const existing = Array.isArray(current.data.applications)
        ? current.data.applications as Record<string, unknown>[]
        : [];
      const merged = mergeApplicationLists(existing, remoteApplications) as Record<string, unknown>[];
      const existingByIdentity = new Map(existing.map((app) => [applicationIdentity(app), app]));
      const isSubmitted = (app: Record<string, unknown>) => {
        const stage = String(app.stage ?? app.status ?? "");
        return Number(app.appliedAt) > 0 ||
          (isApplicationStage(stage) && stage !== "saved");
      };
      const candidates = merged.filter((app) => {
        const previous = existingByIdentity.get(applicationIdentity(app));
        return isSubmitted(app) && (!previous || !isSubmitted(previous));
      });

      if (candidates.length > 0) {
        const refreshed = ensureMonthlyQuotaFresh(user).user;
        const limit = TIER_LIMITS[refreshed.tier ?? "free"].monthlyLimit;
        const used = refreshed.monthlyApplicationsUsed ?? 0;
        const acceptedCount = limit === null
          ? candidates.length
          : Math.max(0, Math.min(candidates.length, limit - used));
        const candidateIdentities = new Set(candidates.map(applicationIdentity));
        const acceptedIdentities = new Set(candidates.slice(0, acceptedCount).map(applicationIdentity));
        const applicationsToSync = remoteApplications.filter((app) => {
          const identity = applicationIdentity(app);
          return !candidateIdentities.has(identity) || acceptedIdentities.has(identity);
        });
        const syncData = { ...incoming.data, applications: applicationsToSync };
        const limitedIncoming: SyncEnvelope = { ...incoming, data: syncData };

        if (acceptedCount > 0) {
          const quota = await withApplicationQuota(
            user,
            () => applySyncEnvelope(limitedIncoming),
            acceptedCount,
          );
          if (quota.allowed) {
            const outcome = quota.result!;
            const revision = outcome.changed.length ? await bumpRevision() : outcome.revision;
            const envelope = await cloudEnvelope();
            const skipped = candidates.length - acceptedCount;
            return res.json({
              ok: true,
              schema: SYNC_SCHEMA_VERSION,
              revision,
              applied: outcome.changed,
              notes: [
                ...outcome.notes,
                ...parsed.warnings,
                ...(skipped ? [`${skipped} submitted application record(s) remain on this device because they exceed the 30-day allowance.`] : []),
              ],
              envelope: { ...envelope, revision },
              device: incoming.deviceId,
            });
          }
        }

        // Keep profile/settings sync working even when application rows exceed
        // the account limit. Unaccepted submissions remain local to the device.
        const syncableApplications = remoteApplications.filter(
          (app) => !candidateIdentities.has(applicationIdentity(app)),
        );
        const safeIncoming: SyncEnvelope = {
          ...incoming,
          data: { ...incoming.data, applications: syncableApplications },
        };
        quotaNote = `${candidates.length} submitted application record(s) remain on this device because the 30-day allowance is reached.`;
        const outcome = await applySyncEnvelope(safeIncoming);
        const revision = outcome.changed.length ? await bumpRevision() : outcome.revision;
        const envelope = await cloudEnvelope();
        return res.json({
          ok: true,
          schema: SYNC_SCHEMA_VERSION,
          revision,
          applied: outcome.changed,
          notes: [...outcome.notes, ...parsed.warnings, quotaNote],
          envelope: { ...envelope, revision },
          device: incoming.deviceId,
        });
      }
    }

    // Merge the device's envelope into the cloud's own state. Same function the
    // device runs on the response, which is what makes the round trip converge.
    const outcome = await applySyncEnvelope(incoming);

    // A push that changed nothing must not advance the revision, or every idle
    // device would see a "new revision" forever and re-sync in a loop.
    const revision = outcome.changed.length ? await bumpRevision() : outcome.revision;

    const envelope = await cloudEnvelope();

    res.json({
      ok: true,
      schema: SYNC_SCHEMA_VERSION,
      revision,
      /** Keys the CLOUD adopted from this device. */
      applied: outcome.changed,
      notes: [...outcome.notes, ...parsed.warnings, ...(quotaNote ? [quotaNote] : [])],
      /** The cloud's post-merge state, for the device to apply back. */
      envelope: { ...envelope, revision },
      device: incoming.deviceId,
    });
  }),
);
