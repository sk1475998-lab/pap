/**
 * Per-user namespacing for the shared `KVStore`.
 *
 * WHY THIS EXISTS: `getStore()` resolves to a single global store — chrome.storage
 * in the extension, one JSON file in Node. That is correct for a device, and
 * catastrophic for a server: every request would read and write the SAME
 * `profile` key, so the first two users to sign up would see each other's data.
 *
 * Wrapping the same `KVStore` interface (rather than inventing a second storage
 * layer) means every existing helper — `readProfile`, `writeApplications`,
 * `buildSyncEnvelope`, `applySyncEnvelope` — works unchanged against a single
 * user's slice. The cloud API runs the identical merge code as the extension.
 */
import type { KVStore } from "./storage.js";

/** Namespace separator. Chosen so a raw key can never collide with a prefix. */
const NS = "::";

/** Characters allowed in a namespace segment, to keep keys unambiguous. */
const SAFE_SEGMENT = /^[A-Za-z0-9._@-]+$/;

export function assertSafeNamespace(namespace: string): string {
  const ns = String(namespace ?? "").trim();
  if (!ns) throw new Error("namespace must be a non-empty string");
  if (!SAFE_SEGMENT.test(ns)) {
    throw new Error(`namespace contains unsupported characters: ${JSON.stringify(ns)}`);
  }
  return ns;
}

/**
 * View a store through a per-user prefix.
 *
 * `keys()` returns UNPREFIXED keys so callers see a normal single-user store;
 * anything outside the namespace is invisible, which is the isolation guarantee.
 */
export function namespacedStore(base: KVStore, namespace: string): KVStore {
  const ns = assertSafeNamespace(namespace);
  const prefix = `u${NS}${ns}${NS}`;
  const wrap = (key: string) => `${prefix}${key}`;

  return {
    get: <T,>(key: string) => base.get<T>(wrap(key)),
    set: <T,>(key: string, value: T) => base.set<T>(wrap(key), value),
    delete: (key: string) => base.delete(wrap(key)),
    async keys() {
      const all = await base.keys();
      return all.filter((k) => k.startsWith(prefix)).map((k) => k.slice(prefix.length));
    },
  };
}
