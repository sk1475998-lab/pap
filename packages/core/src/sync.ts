/**
 * Cloud ⇄ device sync contract.
 *
 * ONE definition, shared by the extension, the cloud API, and the CLI. There is
 * no second profile schema, no second settings shape, and no second merge
 * implementation anywhere in this repo — everything imports from here so that
 * "fill it once" is structurally true rather than a promise.
 *
 * Design rules (each one exists because violating it loses user data):
 *
 *  1. LAST-WRITE-WINS PER FIELD, not per document. Two devices editing
 *     different fields of the same profile both keep their edit. Whole-document
 *     LWW would silently discard the loser's work.
 *
 *  2. ABSENT NEVER CLOBBERS PRESENT. `exportSnapshot()` deliberately strips
 *     government IDs and API keys before data leaves the device. A naive
 *     round-trip (export → cloud → import) would therefore DELETE the user's
 *     PAN/Aadhaar/passport locally. Merging treats a missing or redacted remote
 *     field as "no opinion", so the local value survives.
 *
 *  3. TIMESTAMPS TRAVEL WITH THE DATA. `profile.updatedAt` and
 *     `application.updatedAt` already exist; keys that have no natural
 *     timestamp (settings, savedAnswers, llmConfig) carry one in the envelope's
 *     `meta` block. Nothing relies on server clock vs client clock agreement
 *     beyond ordering the same key's own writes.
 *
 *  4. APPLICATIONS MERGE BY IDENTITY, NOT INDEX. Two devices applying to
 *     different jobs must end with the union, deduplicated by canonical job key
 *     (the same key `importSnapshot` and the job tracker already use).
 */
import { canonicalJobKey } from "./job-key.js";
import {
  getStore,
  redactProfileForTransfer,
  type StoreSnapshot,
  type StoreSnapshotKey,
} from "./storage.js";

/** Value `exportSnapshot()` substitutes for a secret it refuses to transmit. */
export const REDACTION_SENTINEL = "__REDACTED__";

/** Envelope format version. Bump only for breaking wire changes. */
export const SYNC_SCHEMA_VERSION = 1;

/**
 * Keys that participate in cloud sync, in merge order.
 *
 * `intelligenceDashboard` is deliberately EXCLUDED: it is a pure derivation of
 * `applications` (see `buildIntelligenceDashboard`), so syncing it would ship
 * redundant bytes and risk a stale cache overwriting a fresh local rebuild.
 */
export const SYNCED_KEYS = [
  "profile",
  "applications",
  "settings",
  "llmConfig",
  "savedAnswers",
  "careerMemory",
  "fillHistory",
  "resumeVersions",
] as const satisfies readonly StoreSnapshotKey[];

export type SyncedKey = (typeof SYNCED_KEYS)[number];

/** Per-key write clock. `updatedAt` is epoch ms from whichever device wrote it. */
export interface SyncKeyMeta {
  updatedAt: number;
}

/** The wire format. Symmetrical: devices and the cloud send the same shape. */
export interface SyncEnvelope {
  schema: typeof SYNC_SCHEMA_VERSION;
  /** Stable per-install id, so a device can recognise its own echo. */
  deviceId: string;
  /** When this envelope was assembled (epoch ms). */
  producedAt: number;
  /** Monotonic server-assigned revision; 0 for a device that never synced. */
  revision: number;
  data: Partial<Record<SyncedKey, unknown>>;
  meta: Partial<Record<SyncedKey, SyncKeyMeta>>;
}

export interface SyncMergeOutcome {
  data: Partial<Record<SyncedKey, unknown>>;
  meta: Partial<Record<SyncedKey, SyncKeyMeta>>;
  /** Keys whose merged value differs from the local input. */
  changed: SyncedKey[];
  /** Human-readable notes, surfaced in the UI's sync log. */
  notes: string[];
}

/* ------------------------------------------------------------------ */
/* Primitives                                                          */
/* ------------------------------------------------------------------ */

/**
 * True when a value carries no information and must never overwrite anything,
 * no matter how new its clock is.
 *
 * Deliberately NARROW. An empty string or empty array is a legitimate edit —
 * the user cleared the field — so those are allowed to win on a strictly newer
 * timestamp. Only genuinely absent values and redaction sentinels abstain,
 * which is exactly what `redactProfileForTransfer` (deletes keys) and
 * `exportSnapshot` (substitutes the sentinel for `llmConfig.apiKey`) produce.
 */
export function isNoOpinion(value: unknown): boolean {
  return value === undefined || value === null || value === REDACTION_SENTINEL;
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/**
 * Field-level last-write-wins merge of two flat-ish records.
 *
 * Rule table (this is the whole safety story):
 *
 *   remote field absent / redacted  → keep local, always
 *   local field absent              → take remote
 *   remote strictly newer           → take remote (including an explicit clear)
 *   otherwise                       → keep local (ties favour the device)
 *
 * Nested plain objects recurse, so `imapConfig: { host }` merges per-key rather
 * than being replaced wholesale. Arrays are atomic: a resume's skill list is
 * one edit, not N independent ones.
 */
export function mergeRecordLWW(
  local: Record<string, unknown> | undefined,
  remote: Record<string, unknown> | undefined,
  localUpdatedAt: number,
  remoteUpdatedAt: number,
): Record<string, unknown> {
  if (!remote) return { ...(local ?? {}) };
  if (!local) {
    // Nothing local to protect, but still drop sentinels so the literal string
    // "__REDACTED__" never lands in a real field.
    const seeded: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(remote)) if (!isNoOpinion(v)) seeded[k] = v;
    return seeded;
  }

  const out: Record<string, unknown> = { ...local };
  const remoteWins = remoteUpdatedAt > localUpdatedAt;

  for (const [key, remoteVal] of Object.entries(remote)) {
    if (isNoOpinion(remoteVal)) continue; // rule 1 — abstain
    const localVal = out[key];
    if (isNoOpinion(localVal)) {
      out[key] = remoteVal; // rule 2 — fill a gap regardless of clock
      continue;
    }
    if (isPlainObject(localVal) && isPlainObject(remoteVal)) {
      out[key] = mergeRecordLWW(localVal, remoteVal, localUpdatedAt, remoteUpdatedAt);
      continue;
    }
    if (remoteWins) out[key] = remoteVal; // rule 3
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* Applications — identity merge                                       */
/* ------------------------------------------------------------------ */

interface AppLike {
  id?: string;
  url?: string;
  title?: string;
  company?: string;
  updatedAt?: number;
  appliedAt?: number;
  [k: string]: unknown;
}

/** Identity of an application row. Same helper the tracker and importSnapshot use. */
export function applicationIdentity(a: AppLike): string {
  const url = String(a?.url ?? "").trim();
  const title = String(a?.title ?? "").trim();
  const company = String(a?.company ?? "").trim();
  // With none of the three, `canonicalJobKey` yields the constant "empty::", so
  // every such row would collapse onto one. Fall back to the row's own id.
  if (!url && !title && !company) return `id:${String(a?.id ?? "")}`;
  return canonicalJobKey(url, title, company);
}

/**
 * Union two application lists by identity, resolving each collision field-wise.
 *
 * The union is the point: device A applying to job 1 and device B applying to
 * job 2 must end with both, which is why this cannot be a whole-array LWW.
 * Result order is newest-activity-first so the tracker reads naturally.
 */
export function mergeApplicationLists(local: AppLike[], remote: AppLike[]): AppLike[] {
  const byKey = new Map<string, AppLike>();
  const stampOf = (a: AppLike) => Number(a?.updatedAt ?? a?.appliedAt ?? 0) || 0;

  for (const a of Array.isArray(local) ? local : []) byKey.set(applicationIdentity(a), a);

  for (const r of Array.isArray(remote) ? remote : []) {
    const key = applicationIdentity(r);
    const mine = byKey.get(key);
    if (!mine) {
      byKey.set(key, r);
      continue;
    }
    const merged = mergeRecordLWW(mine, r, stampOf(mine), stampOf(r)) as AppLike;
    merged.updatedAt = Math.max(stampOf(mine), stampOf(r));
    byKey.set(key, merged);
  }

  return [...byKey.values()].sort((a, b) => stampOf(b) - stampOf(a));
}

/* ------------------------------------------------------------------ */
/* Envelope merge                                                      */
/* ------------------------------------------------------------------ */

/** Timestamp for a key: prefer the value's own clock, fall back to envelope meta. */
function stampFor(key: SyncedKey, value: unknown, meta: Partial<Record<SyncedKey, SyncKeyMeta>>): number {
  if (key === "profile" && isPlainObject(value) && typeof value.updatedAt === "number") {
    return value.updatedAt;
  }
  return Number(meta?.[key]?.updatedAt ?? 0) || 0;
}

/**
 * Merge a remote envelope into local state. Pure — no storage access — so both
 * the extension and the cloud API call the identical function and cannot drift.
 *
 * Symmetry matters: the server merges the device's push with what it holds, and
 * the device merges the server's response with what it holds. Because the
 * operation is commutative per field and idempotent, either order converges.
 */
export function mergeSyncState(
  localData: Partial<Record<SyncedKey, unknown>>,
  localMeta: Partial<Record<SyncedKey, SyncKeyMeta>>,
  remote: Pick<SyncEnvelope, "data" | "meta">,
): SyncMergeOutcome {
  const data: Partial<Record<SyncedKey, unknown>> = { ...localData };
  const meta: Partial<Record<SyncedKey, SyncKeyMeta>> = { ...localMeta };
  const changed: SyncedKey[] = [];
  const notes: string[] = [];

  for (const key of SYNCED_KEYS) {
    const localVal = localData[key];
    const remoteVal = remote.data?.[key];
    if (isNoOpinion(remoteVal)) continue;

    const localAt = stampFor(key, localVal, localMeta);
    const remoteAt = stampFor(key, remoteVal, remote.meta ?? {});
    const before = JSON.stringify(localVal ?? null);

    if (key === "applications") {
      const mergedApps = mergeApplicationLists(
        (Array.isArray(localVal) ? localVal : []) as AppLike[],
        (Array.isArray(remoteVal) ? remoteVal : []) as AppLike[],
      );
      data[key] = mergedApps;
      const localCount = Array.isArray(localVal) ? localVal.length : 0;
      const gained = mergedApps.length - localCount;
      if (gained > 0) notes.push(`applications: +${gained} from cloud`);
    } else if (isPlainObject(localVal) && isPlainObject(remoteVal)) {
      data[key] = mergeRecordLWW(localVal, remoteVal, localAt, remoteAt);
    } else if (isNoOpinion(localVal) || remoteAt > localAt) {
      data[key] = remoteVal;
    }

    if (JSON.stringify(data[key] ?? null) !== before) {
      changed.push(key);
      meta[key] = { updatedAt: Math.max(localAt, remoteAt) || Date.now() };
    }
  }

  return { data, meta, changed, notes };
}

/* ------------------------------------------------------------------ */
/* Wire validation                                                     */
/* ------------------------------------------------------------------ */

/**
 * Upper bound on application rows accepted in one envelope.
 *
 * A sync endpoint takes a body from an untrusted client. Without a cap, one
 * request can pin the server's CPU in `mergeApplicationLists` and fill a
 * free-tier disk. 5000 is far beyond any real job search.
 */
export const MAX_SYNCED_APPLICATIONS = 5000;

/** Longest accepted deviceId. Keeps log lines and store keys bounded. */
const MAX_DEVICE_ID_LEN = 64;

export type ParsedEnvelope =
  | { ok: true; envelope: SyncEnvelope; warnings: string[] }
  | { ok: false; error: string };

/**
 * Validate and normalise an envelope received over the wire.
 *
 * Shared by the cloud API and the extension deliberately: both sides receive
 * envelopes from something they do not control, so both need the identical
 * checks. The important one is the key allow-list — `applySyncEnvelope` writes
 * `data` straight into the store, so without filtering, a caller could set
 * arbitrary keys (say `authSecret`) by naming them in `data`.
 */
export function parseSyncEnvelope(input: unknown): ParsedEnvelope {
  if (!isPlainObject(input)) return { ok: false, error: "Sync payload must be an object." };

  const schema = Number(input.schema ?? SYNC_SCHEMA_VERSION);
  if (!Number.isFinite(schema)) return { ok: false, error: "Sync payload has an invalid schema version." };
  if (schema > SYNC_SCHEMA_VERSION) {
    return { ok: false, error: `Sync schema ${schema} is newer than this build supports (${SYNC_SCHEMA_VERSION}). Update and retry.` };
  }
  if (schema < SYNC_SCHEMA_VERSION) {
    return { ok: false, error: `Sync schema ${schema} is no longer supported (expected ${SYNC_SCHEMA_VERSION}).` };
  }

  const warnings: string[] = [];
  const rawDevice = String(input.deviceId ?? "").trim();
  const deviceId = /^[A-Za-z0-9._-]{1,64}$/.test(rawDevice)
    ? rawDevice
    : (rawDevice ? rawDevice.replace(/[^A-Za-z0-9._-]/g, "").slice(0, MAX_DEVICE_ID_LEN) : "") || "unknown";

  const inData = isPlainObject(input.data) ? input.data : {};
  const inMeta = isPlainObject(input.meta) ? input.meta : {};

  const data: Partial<Record<SyncedKey, unknown>> = {};
  const meta: Partial<Record<SyncedKey, SyncKeyMeta>> = {};

  for (const key of SYNCED_KEYS) {
    if (key in inData) {
      let value = inData[key];
      if (key === "applications") {
        if (!Array.isArray(value)) {
          warnings.push("applications was not a list and has been ignored");
          value = undefined;
        } else if (value.length > MAX_SYNCED_APPLICATIONS) {
          warnings.push(`applications truncated to ${MAX_SYNCED_APPLICATIONS} rows`);
          value = value.slice(0, MAX_SYNCED_APPLICATIONS);
        }
      }
      if (value !== undefined) data[key] = value;
    }
    const m = (inMeta as Record<string, unknown>)[key];
    if (isPlainObject(m)) {
      // Accept a number, or a numeric string (some JSON producers stringify
      // large integers). Coerce it, because comparing "9" > "10" as strings
      // would silently invert the merge order. Anything else is not a clock.
      const raw = m.updatedAt;
      const isClockish =
        typeof raw === "number" || (typeof raw === "string" && raw.trim() !== "");
      const at = isClockish ? Number(raw) : Number.NaN;
      if (Number.isFinite(at) && at >= 0) meta[key] = { updatedAt: at };
    }
  }

  const unknownKeys = Object.keys(inData).filter((k) => !(SYNCED_KEYS as readonly string[]).includes(k));
  if (unknownKeys.length) warnings.push(`ignored unsupported keys: ${unknownKeys.slice(0, 5).join(", ")}`);

  return {
    ok: true,
    warnings,
    envelope: {
      schema: SYNC_SCHEMA_VERSION,
      deviceId,
      producedAt: Number(input.producedAt) || Date.now(),
      revision: Math.max(0, Number(input.revision) || 0),
      data,
      meta,
    },
  };
}

/* ------------------------------------------------------------------ */
/* Store-facing helpers (shared by extension, cloud API and CLI)       */
/* ------------------------------------------------------------------ */

/** Where per-key sync clocks and the last server revision live. */
export const SYNC_STATE_KEY = "syncState";

export interface LocalSyncState {
  deviceId: string;
  revision: number;
  lastPulledAt: number;
  lastPushedAt: number;
  meta: Partial<Record<SyncedKey, SyncKeyMeta>>;
}

function randomId(prefix: string): string {
  const g: any = globalThis as any;
  if (g?.crypto?.randomUUID) return `${prefix}_${g.crypto.randomUUID().replace(/-/g, "").slice(0, 20)}`;
  return `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
}

export async function readLocalSyncState(): Promise<LocalSyncState> {
  const stored = await getStore().get<Partial<LocalSyncState>>(SYNC_STATE_KEY);
  const state: LocalSyncState = {
    deviceId: stored?.deviceId || randomId("dev"),
    revision: Number(stored?.revision ?? 0) || 0,
    lastPulledAt: Number(stored?.lastPulledAt ?? 0) || 0,
    lastPushedAt: Number(stored?.lastPushedAt ?? 0) || 0,
    meta: stored?.meta ?? {},
  };
  // Persist a freshly minted deviceId so it is stable across sessions.
  if (!stored?.deviceId) await getStore().set(SYNC_STATE_KEY, state);
  return state;
}

export async function writeLocalSyncState(state: LocalSyncState): Promise<void> {
  await getStore().set(SYNC_STATE_KEY, state);
}

export interface BuildEnvelopeOptions {
  /**
   * Transmit government IDs, stored passwords and mail credentials.
   *
   * Default FALSE, which preserves the existing device-only guarantee for those
   * fields (see `redactProfileForTransfer`). Sync still works for everything a
   * job form actually needs; `mergeRecordLWW` rule 1 guarantees the withheld
   * fields are never blanked by the round trip.
   */
  includeSensitive?: boolean;
}

/** Read local state and package it for transmission. */
export async function buildSyncEnvelope(opts: BuildEnvelopeOptions = {}): Promise<SyncEnvelope> {
  const store = getStore();
  const state = await readLocalSyncState();
  const data: Partial<Record<SyncedKey, unknown>> = {};
  const meta: Partial<Record<SyncedKey, SyncKeyMeta>> = {};

  for (const key of SYNCED_KEYS) {
    const raw = await store.get(key);
    if (raw === undefined) continue;

    let value = raw;
    if (key === "profile" && isPlainObject(raw) && !opts.includeSensitive) {
      value = redactProfileForTransfer(raw);
    }
    if (key === "llmConfig" && isPlainObject(raw)) {
      // The provider choice and model are worth syncing; the key is not — a
      // cloud copy of a user's API key is a liability with no upside.
      const { apiKey: _drop, ...rest } = raw as Record<string, unknown>;
      value = rest;
    }
    data[key] = value;
    meta[key] = { updatedAt: stampFor(key, raw, state.meta) || state.meta[key]?.updatedAt || 0 };
  }

  return {
    schema: SYNC_SCHEMA_VERSION,
    deviceId: state.deviceId,
    producedAt: Date.now(),
    revision: state.revision,
    data,
    meta,
  };
}

export interface ApplyEnvelopeResult extends SyncMergeOutcome {
  revision: number;
}

/**
 * Merge a remote envelope into the local store and persist the result.
 *
 * Only keys that actually changed are written, so a no-op sync does not fire
 * `chrome.storage.onChanged` and does not cause the UI to flicker or the
 * extension to echo its own write back to the cloud in a loop.
 */
export async function applySyncEnvelope(remote: SyncEnvelope): Promise<ApplyEnvelopeResult> {
  const store = getStore();
  const state = await readLocalSyncState();

  const localData: Partial<Record<SyncedKey, unknown>> = {};
  for (const key of SYNCED_KEYS) {
    const v = await store.get(key);
    if (v !== undefined) localData[key] = v;
  }

  const outcome = mergeSyncState(localData, state.meta, remote);

  for (const key of outcome.changed) {
    await store.set(key, outcome.data[key]);
  }

  // Applications changed ⇒ the cached dashboard is stale. Drop it so the next
  // read rebuilds from truth instead of serving a pre-merge snapshot.
  if (outcome.changed.includes("applications")) {
    await store.delete("intelligenceDashboard");
  }

  const revision = Math.max(state.revision, Number(remote.revision ?? 0) || 0);
  await writeLocalSyncState({
    ...state,
    revision,
    lastPulledAt: Date.now(),
    meta: outcome.meta,
  });

  return { ...outcome, revision };
}

/** Stamp a key as locally modified now, so the next push wins against the cloud. */
export async function touchSyncKey(key: SyncedKey, at = Date.now()): Promise<void> {
  const state = await readLocalSyncState();
  await writeLocalSyncState({ ...state, meta: { ...state.meta, [key]: { updatedAt: at } } });
}
