/**
 * A tiny key-value storage abstraction that adapts to its host:
 *  - In a Chrome/Firefox MV3 extension it uses chrome.storage.local (async).
 *  - In Node/CLI it falls back to a JSON file on disk.
 *
 * Node-only modules (fs/path/os) are imported LAZILY so this same module
 * bundles cleanly into a browser extension where FileStore is never used.
 *
 * Everything is async-by-default so the same store API works everywhere.
 */
import { canonicalJobKey } from "./job-key.js";

export interface KVStore {
  get<T = unknown>(key: string): Promise<T | undefined>;
  set<T = unknown>(key: string, value: T): Promise<void>;
  delete(key: string): Promise<void>;
  keys(): Promise<string[]>;
}

/* ----------------------- Browser (chrome.storage) ------------------ */

function isExtensionContextValid(): boolean {
  try {
    return Boolean((globalThis as any).chrome?.runtime?.id);
  } catch {
    return false;
  }
}

class ChromeStorageStore implements KVStore {
  private cs(): any {
    return (globalThis as any).chrome?.storage?.local;
  }
  async get<T>(key: string) {
    if (!isExtensionContextValid()) return undefined;
    try {
      const res = await this.cs().get(key);
      return res[key] as T | undefined;
    } catch {
      return undefined;
    }
  }
  async set<T>(key: string, value: T) {
    if (!isExtensionContextValid()) return;
    try {
      await this.cs().set({ [key]: value });
    } catch {
      /* Extension context invalidated */
    }
  }
  async delete(key: string) {
    if (!isExtensionContextValid()) return;
    try {
      await this.cs().remove(key);
    } catch {
      /* Extension context invalidated */
    }
  }
  async keys() {
    if (!isExtensionContextValid()) return [];
    try {
      const all = await this.cs().get(null);
      return Object.keys(all);
    } catch {
      return [];
    }
  }
}

/* ----------------------- Web Browser Fallback Stores ------------------ */

class LocalStorageStore implements KVStore {
  async get<T>(key: string): Promise<T | undefined> {
    try {
      if (typeof localStorage === "undefined") return undefined;
      const res = localStorage.getItem(`sja_${key}`);
      return res ? (JSON.parse(res) as T) : undefined;
    } catch {
      return undefined;
    }
  }
  async set<T>(key: string, value: T): Promise<void> {
    try {
      if (typeof localStorage === "undefined") return;
      localStorage.setItem(`sja_${key}`, JSON.stringify(value));
    } catch {}
  }
  async delete(key: string): Promise<void> {
    try {
      if (typeof localStorage === "undefined") return;
      localStorage.removeItem(`sja_${key}`);
    } catch {}
  }
  async keys(): Promise<string[]> {
    try {
      if (typeof localStorage === "undefined") return [];
      const res: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k?.startsWith("sja_")) res.push(k.slice(4));
      }
      return res;
    } catch {
      return [];
    }
  }
}

class MemoryStore implements KVStore {
  private data = new Map<string, unknown>();
  async get<T>(key: string): Promise<T | undefined> {
    return this.data.get(key) as T | undefined;
  }
  async set<T>(key: string, value: T): Promise<void> {
    this.data.set(key, value);
  }
  async delete(key: string): Promise<void> {
    this.data.delete(key);
  }
  async keys(): Promise<string[]> {
    return Array.from(this.data.keys());
  }
}

/* ----------------------- Node (file JSON) -------------------------- */

type NodePath = typeof import("node:path");
type NodeOs = typeof import("node:os");
type NodeFs = typeof import("node:fs");

// Hide Node-only imports from browser bundlers. FileStore is never selected in
// an extension or browser context, and using vite-ignore keeps Vite/Rollup from
// trying to bundle node:* modules into the browser extension.
const nodeImport = <T = any>(specifier: string): Promise<T> => {
  if (typeof window !== "undefined" || (typeof process !== "undefined" && (process as any).browser)) {
    throw new Error(`Cannot import Node module ${specifier} in browser environment`);
  }
  return import(/* @vite-ignore */ specifier) as Promise<T>;
};

class FileStore implements KVStore {
  private file: string | null = null;
  private cache: Record<string, unknown> | null = null;
  /**
   * Serializes concurrent persist() calls.
   * Without this, two concurrent `set()` calls can both see the same cache state,
   * write concurrently, and the second write wins — silently discarding the first.
   * A Promise chain acts as a fair async mutex: each persist awaits the previous one.
   */
  private writeLock: Promise<void> = Promise.resolve();

  private async resolve(): Promise<string> {
    if (this.file) return this.file;
    const { join } = await nodeImport<NodePath>("node:path");
    const { homedir } = await nodeImport<NodeOs>("node:os");
    const configuredHome = process.env.SUPERJOB_HOME;
    // Docker configures SUPERJOB_HOME as a data directory (`/data`), while
    // CLI users may provide a concrete JSON file path. Support both forms.
    const file = configuredHome
      ? (configuredHome.endsWith(".json") ? configuredHome : join(configuredHome, "store.json"))
      : join(homedir(), ".super-job-agent", "store.json");
    this.file = file;
    return file;
  }

  private async load(): Promise<Record<string, unknown>> {
    if (this.cache) return this.cache;
    const file = await this.resolve();
    const { readFileSync, existsSync } = await nodeImport<NodeFs>("node:fs");
    if (!existsSync(file)) {
      this.cache = {};
      return this.cache;
    }
    const parsed: unknown = JSON.parse(readFileSync(file, "utf-8"));
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new Error("Stored data is not a JSON object; refusing to overwrite it");
    }
    this.cache = parsed as Record<string, unknown>;
    return this.cache!;
  }

  private async persist() {
    if (!this.cache) return;
    /**
     * Serialize writes through the lock chain.
     * Each call appends itself to the end of the chain so writes are ordered
     * and no two persist() bodies run concurrently.
     */
    this.writeLock = this.writeLock.then(() => this._doPersist()).catch(() => this._doPersist());
    return this.writeLock;
  }

  private async _doPersist() {
    if (!this.cache) return;
    const { writeFileSync, mkdirSync, chmodSync, renameSync, copyFileSync, unlinkSync } = await nodeImport<NodeFs>("node:fs");
    const { dirname } = await nodeImport<NodePath>("node:path");
    const file = await this.resolve();
    mkdirSync(dirname(file), { recursive: true, mode: 0o700 });
    // Atomic write: write to a uniquely-named temp file, then rename/replace.
    // Handles Windows EPERM / EBUSY rename locking cleanly.
    const tmp = `${file}.tmp.${Date.now()}.${Math.random().toString(36).slice(2, 6)}`;
    writeFileSync(tmp, JSON.stringify(this.cache, null, 2), { mode: 0o600 });
    try {
      renameSync(tmp, file);
    } catch (err: any) {
      if (err?.code === "EPERM" || err?.code === "EBUSY" || err?.code === "EEXIST") {
        copyFileSync(tmp, file);
        try { unlinkSync(tmp); } catch {}
      } else {
        try { unlinkSync(tmp); } catch {}
        throw err;
      }
    }
    // Existing stores may pre-date the explicit mode, so tighten them after every write.
    try {
      chmodSync(file, 0o600);
    } catch {
      /* Windows chmod no-op */
    }
  }

  async get<T>(key: string) {
    return (await this.load())[key] as T | undefined;
  }
  async set<T>(key: string, value: T) {
    (await this.load())[key] = value;
    await this.persist();
  }
  async delete(key: string) {
    delete (await this.load())[key];
    await this.persist();
  }
  async keys() {
    return Object.keys(await this.load());
  }
}


/* ──────────────────────────────────────────────────────────────────────────────
 * PostgreSQL KV Store (Gap 2.2 Fix)
 * ──────────────────────────────────────────────────────────────────────────────
 * Activated when DATABASE_URL environment variable is set.
 * Uses a single `kv_store` table as an adapter layer so the entire existing
 * KVStore API works identically — zero changes needed in profile.ts, sync.ts,
 * or any of the typed repo helpers below.
 *
 * Schema (auto-created on first use):
 *   CREATE TABLE IF NOT EXISTS kv_store (
 *     namespace TEXT NOT NULL,   -- userId (from AsyncLocalStorage tenant)
 *     key       TEXT NOT NULL,
 *     value     JSONB NOT NULL,
 *     PRIMARY KEY (namespace, key)
 *   );
 *
 * Namespace is passed in at construction time by the server's tenant resolver.
 * Migration path: run `npm run db:migrate` to apply the Prisma schema, then
 * set DATABASE_URL. The factory picks PostgresStore automatically.
 * ────────────────────────────────────────────────────────────────────────────── */

class PostgresStore implements KVStore {
  /**
   * @param namespace - userId (tenant namespace). Isolates rows per user via
   *   WHERE namespace = $1. Row Level Security in PostgreSQL provides a
   *   second enforcement layer when configured.
   */
  constructor(private readonly namespace: string) {}

  // Lazy Prisma client — avoids importing @prisma/client in browser bundles.
  // The import is only ever reached in Node when DATABASE_URL is set.
  private static _client: any = null;

  private static async client(): Promise<any> {
    if (PostgresStore._client) return PostgresStore._client;
    const { PrismaClient } = await nodeImport("@prisma/client");
    PostgresStore._client = new PrismaClient({
      log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
    });
    // Ensure the raw kv_store table exists (Prisma migration may not yet be run).
    await PostgresStore._client.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS kv_store (
        namespace TEXT NOT NULL,
        key       TEXT NOT NULL,
        value     JSONB NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        PRIMARY KEY (namespace, key)
      )
    `).catch(() => { /* Table may already exist — non-fatal */ });
    return PostgresStore._client;
  }

  async get<T>(key: string): Promise<T | undefined> {
    try {
      const db = await PostgresStore.client();
      const rows: any[] = await db.$queryRawUnsafe(
        "SELECT value FROM kv_store WHERE namespace = $1 AND key = $2",
        this.namespace,
        key,
      );
      if (!rows.length) return undefined;
      return rows[0].value as T;
    } catch (e) {
      console.error("[PostgresStore] get error:", e);
      return undefined;
    }
  }

  async set<T>(key: string, value: T): Promise<void> {
    try {
      const db = await PostgresStore.client();
      await db.$executeRawUnsafe(
        `INSERT INTO kv_store (namespace, key, value, updated_at)
         VALUES ($1, $2, $3::jsonb, NOW())
         ON CONFLICT (namespace, key)
         DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
        this.namespace,
        key,
        JSON.stringify(value),
      );
    } catch (e) {
      console.error("[PostgresStore] set error:", e);
    }
  }

  async delete(key: string): Promise<void> {
    try {
      const db = await PostgresStore.client();
      await db.$executeRawUnsafe(
        "DELETE FROM kv_store WHERE namespace = $1 AND key = $2",
        this.namespace,
        key,
      );
    } catch (e) {
      console.error("[PostgresStore] delete error:", e);
    }
  }

  async keys(): Promise<string[]> {
    try {
      const db = await PostgresStore.client();
      const rows: any[] = await db.$queryRawUnsafe(
        "SELECT key FROM kv_store WHERE namespace = $1",
        this.namespace,
      );
      return rows.map((r: any) => r.key as string);
    } catch (e) {
      console.error("[PostgresStore] keys error:", e);
      return [];
    }
  }
}

/**
 * Returns true when this process should use PostgreSQL.
 * Checks for DATABASE_URL and Node environment (never in browser).
 */
function isPostgresEnabled(): boolean {
  return (
    Boolean(process.env.DATABASE_URL) &&
    typeof process !== "undefined" &&
    Boolean(process.versions?.node) &&
    typeof window === "undefined"
  );
}

/**
 * Create a PostgresStore for a specific tenant namespace (userId).
 * Called by the server's tenant resolver — never by the extension.
 */
export function createPostgresStore(namespace: string): KVStore {
  return new PostgresStore(namespace);
}

/* ──────────────────────────────────────────────────────────────────────────── */

/* ----------------------- Factory ----------------------------------- */

let _store: KVStore | null = null;

/**
 * Optional hook that resolves the store for the CURRENT logical caller.
 *
 * A device has exactly one store, so this stays null in the extension and CLI.
 * A multi-tenant server does not: two concurrent requests belong to two
 * different users, and swapping a module-level singleton per request would
 * interleave and serve one user's profile to another. The server therefore
 * installs a resolver backed by `AsyncLocalStorage`, which is per-request by
 * construction. Keeping the hook here (instead of a second storage layer in the
 * server) means `readProfile`, `writeApplications` and the sync merge all keep
 * working unmodified for both hosts.
 */
export type StoreResolver = () => KVStore | undefined;
let _resolver: StoreResolver | null = null;

/** Install (or clear, with null) the per-caller store resolver. */
export function setStoreResolver(resolver: StoreResolver | null): void {
  _resolver = resolver;
}

function createDefaultStore(): KVStore {
  // 0. PostgreSQL — when DATABASE_URL is set in a Node environment (cloud server).
  //    Gap 2.2 Fix: This replaces store.json for multi-tenant cloud deployments.
  //    The resolver in tenant.ts calls createPostgresStore(userId) per-request;
  //    the BASE store (for user records, auth secrets) still uses this factory.
  if (isPostgresEnabled()) {
    // Base store uses "_base" namespace. Per-user stores are created by tenant.ts.
    return new PostgresStore("_base");
  }
  // 1. Chrome extension environment
  const hasChrome =
    typeof globalThis !== "undefined" &&
    Boolean((globalThis as any).chrome?.storage?.local);
  if (hasChrome) {
    return new ChromeStorageStore();
  }
  // 2. Node / CLI / Server environment (local dev without DATABASE_URL)
  const isNode =
    typeof process !== "undefined" &&
    Boolean(process.versions?.node) &&
    typeof window === "undefined";
  if (isNode) {
    return new FileStore();
  }
  // 3. Web browser / dev-server / preview environment
  if (typeof localStorage !== "undefined") {
    return new LocalStorageStore();
  }
  return new MemoryStore();
}

export function getStore(): KVStore {
  const scoped = _resolver?.();
  if (scoped) return scoped;
  if (_store) return _store;
  _store = createDefaultStore();
  return _store;
}

/** The host store, ignoring any per-caller resolver. Servers namespace from this. */
export function getBaseStore(): KVStore {
  if (!_store) {
    _store = createDefaultStore();
  }
  return _store;
}

/** Allow tests / explicit config to inject a store. */
export function setStore(s: KVStore) {
  _store = s;
}

/* ----------------------- Typed repo helpers ------------------------ */

const K = {
  profile: "profile",
  applications: "applications",
  savedAnswers: "savedAnswers",
  careerMemory: "careerMemory",
  intelligenceDashboard: "intelligenceDashboard",
  llmConfig: "llmConfig",
  settings: "settings",
  fillHistory: "fillHistory",
  resumeVersions: "resumeVersions",
};

export async function readProfile<T>(): Promise<T | undefined> {
  return getStore().get<T>(K.profile);
}
export async function writeProfile<T>(p: T): Promise<void> {
  await getStore().set(K.profile, p);
}
export async function readApplications<T>(): Promise<T[]> {
  return (await getStore().get<T[]>(K.applications)) ?? [];
}
export async function writeApplications<T>(list: T[]): Promise<void> {
  await getStore().set(K.applications, list);
}
export async function readFillHistory<T>(): Promise<T[]> {
  return (await getStore().get<T[]>(K.fillHistory)) ?? [];
}
export async function writeFillHistory<T>(list: T[]): Promise<void> {
  await getStore().set(K.fillHistory, list);
}

export async function readCareerMemory<T>(): Promise<T | undefined> {
  return getStore().get<T>(K.careerMemory);
}
export async function writeCareerMemory<T>(memory: T): Promise<void> {
  await getStore().set(K.careerMemory, memory);
}
export async function readIntelligenceDashboard<T>(): Promise<T | undefined> {
  return getStore().get<T>(K.intelligenceDashboard);
}
export async function writeIntelligenceDashboard<T>(dashboard: T): Promise<void> {
  await getStore().set(K.intelligenceDashboard, dashboard);
}

/* ----------------------- Snapshot export / import ------------------ */

export const STORE_KEYS = [
  K.profile,
  K.applications,
  K.llmConfig,
  K.settings,
  K.savedAnswers,
  K.careerMemory,
  K.intelligenceDashboard,
  K.fillHistory,
  K.resumeVersions,
] as const;

export type StoreSnapshotKey = (typeof STORE_KEYS)[number];
export type StoreSnapshot = Partial<Record<StoreSnapshotKey, unknown>>;

const PROFILE_TRANSFER_REDACTIONS = [
  "pan",
  "aadhaar",
  "ssn",
  "passportNumber",
  "drivingLicenseNumber",
  "defaultLoginPassword",
  "imapConfig",
  "smtpConfig",
] as const;

/** Remove credentials and government identity values from data leaving this device. */
export function redactProfileForTransfer<T extends Record<string, unknown>>(profile: T): T {
  const copy: Record<string, unknown> = { ...profile };
  for (const key of PROFILE_TRANSFER_REDACTIONS) delete copy[key];
  return copy as T;
}

/** Export persisted state for CLI ↔ extension sync without high-risk profile secrets. */
export async function exportSnapshot(): Promise<StoreSnapshot> {
  const store = getStore();
  const snap: StoreSnapshot = {};
  for (const key of STORE_KEYS) {
    const value = await store.get(key);
    if (value !== undefined) {
      if (key === K.llmConfig && typeof value === "object" && value !== null) {
        const cfg = { ...(value as Record<string, unknown>) };
        if (typeof cfg.apiKey === "string" && cfg.apiKey) cfg.apiKey = "__REDACTED__";
        snap[key] = cfg;
      } else if (key === K.profile && typeof value === "object" && value !== null) {
        snap[key] = redactProfileForTransfer(value as Record<string, unknown>);
      } else {
        snap[key] = value;
      }
    }
  }
  return snap;
}

/** Import a snapshot into the current store. */
export async function importSnapshot(
  snap: StoreSnapshot,
  opts: { mergeApplications?: boolean } = {}
): Promise<void> {
  const store = getStore();
  for (const key of STORE_KEYS) {
    if (snap[key] === undefined) continue;
    if (key === K.applications && opts.mergeApplications) {
      const existing = ((await store.get<unknown[]>(key)) ?? []) as unknown[];
      const incoming = (snap[key] ?? []) as unknown[];
      const seen = new Set(existing.map((a: any) => canonicalJobKey(a?.url ?? "", a?.title ?? "", a?.company ?? "")));
      const merged = [...existing];
      for (const app of incoming) {
        const identity = canonicalJobKey((app as any)?.url ?? "", (app as any)?.title ?? "", (app as any)?.company ?? "");
        if (seen.has(identity)) continue;
        seen.add(identity);
        merged.push(app);
      }
      await store.set(key, merged);
    } else {
      await store.set(key, snap[key]);
    }
  }
}
