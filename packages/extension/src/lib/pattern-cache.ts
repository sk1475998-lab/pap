/**
 * Pattern/selector cache (Adaptive learning engine).
 * Stores winning selectors per ATS/host in IndexedDB to avoid full-DOM re-scans.
 *
 * Caches the mapping from a normalized field key (e.g. "firstName", "email")
 * to the CSS selector that resolved successfully on a given host, keyed by
 * (origin + form signature hash). Subsequent runs on the same site skip
 * expensive DOM scanning for cached fields.
 *
 * Stored in IndexedDB so it persists across sessions. TTL is 14 days;
 * entries are invalidated if the cached selector no longer returns an
 * element OR the form structure changes significantly.
 */

const DB_NAME = "sja-pattern-cache";
const DB_VERSION = 1;
const STORE = "patterns";
const TTL_MS = 14 * 24 * 60 * 60 * 1000; // 14 days
/**
 * Upper bound suffix for origin-prefix IndexedDB range scans. Built at runtime
 * (never authored as a literal "\uffff" escape) because Vite/esbuild's UTF-8
 * charset emits that escape as the real U+FFFF noncharacter byte sequence, and
 * Chrome's strict script loader then rejects the whole bundle with
 * "Could not load file ... It isn't UTF-8 encoded".
 */
const PREFIX_MAX_SUFFIX = String.fromCharCode(0xffff);


export interface PatternCacheEntry {
  key: string; // composite: origin + "::" + formSig + "::" + fieldKey
  fieldKey: string;
  selector: string; // CSS selector that resolved
  origin: string;
  formSig: string; // hash of form's first <form> class/action for invalidation
  usedCount: number;
  lastUsedAt: number;
  createdAt: number;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB unavailable")); return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        const s = db.createObjectStore(STORE, { keyPath: "key" });
        s.createIndex("origin", "origin", { unique: false });
        s.createIndex("fieldKey", "fieldKey", { unique: false });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function tx(db: IDBDatabase, mode: IDBTransactionMode): IDBObjectStore {
  return db.transaction(STORE, mode).objectStore(STORE);
}

function awaitReq<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/** Hash a string quickly (djb2) for form signature. */
function hash(s: string): string {
  let h = 5381;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) + h) ^ s.charCodeAt(i);
  }
  return (h >>> 0).toString(36);
}

/** Compute a stable signature for the currently visible forms. */
export function computeFormSig(doc: Document = document): string {
  const forms = Array.from(doc.querySelectorAll("form"));
  if (forms.length === 0) {
    // Use body's first 3 input names as signature if there's no <form>
    const inputs = Array.from(doc.querySelectorAll("input,select,textarea")).slice(0, 8);
    return "noform:" + hash(inputs.map((i) => (i as HTMLElement).getAttribute("name") || (i as HTMLElement).getAttribute("id") || (i as HTMLElement).tagName).join("|"));
  }
  return forms
    .slice(0, 3)
    .map((f) => {
      const sig = [f.getAttribute("action"), f.getAttribute("id"), f.getAttribute("class"), f.querySelectorAll("input,select,textarea").length].join("|");
      return hash(sig);
    })
    .join("_");
}

function compositeKey(origin: string, formSig: string, fieldKey: string) {
  return `${origin}::${formSig}::${fieldKey}`;
}

let _dbPromise: Promise<IDBDatabase> | null = null;
function db() {
  if (!_dbPromise) _dbPromise = openDb().catch(() => null as unknown as IDBDatabase);
  return _dbPromise;
}

/** Look up a previously cached selector for (origin, formSig, fieldKey). */
export async function getCachedSelector(
  origin: string,
  formSig: string,
  fieldKey: string,
): Promise<string | null> {
  try {
    const d = await db();
    if (!d) return null;
    const entry = await awaitReq<PatternCacheEntry | undefined>(
      tx(d, "readonly").get(compositeKey(origin, formSig, fieldKey)) as IDBRequest<PatternCacheEntry | undefined>,
    );
    if (!entry) return null;
    // Expired?
    if (Date.now() - entry.lastUsedAt > TTL_MS) return null;
    // Validate selector still resolves an element in this document
    try {
      const el = document.querySelector(entry.selector);
      if (!el) return null;
      // Check the field is still interactable (visible)
      const html = el as HTMLElement;
      if (html.closest("[hidden]") || html.getAttribute("aria-hidden") === "true") return null;
    } catch {
      return null;
    }
    // Touch lastUsedAt / usedCount
    entry.lastUsedAt = Date.now();
    entry.usedCount++;
    await awaitReq(tx(d, "readwrite").put(entry));
    return entry.selector;
  } catch {
    return null;
  }
}

/** Remember that (selector) successfully resolved for (origin, formSig, fieldKey). */
export async function rememberSelector(
  origin: string,
  formSig: string,
  fieldKey: string,
  selector: string,
): Promise<void> {
  try {
    const d = await db();
    if (!d) return;
    const key = compositeKey(origin, formSig, fieldKey);
    const existing = await awaitReq<PatternCacheEntry | undefined>(
      tx(d, "readonly").get(key) as IDBRequest<PatternCacheEntry | undefined>,
    );
    const entry: PatternCacheEntry = existing
      ? { ...existing, selector, lastUsedAt: Date.now(), usedCount: existing.usedCount + 1 }
      : {
          key,
          fieldKey,
          selector,
          origin,
          formSig,
          usedCount: 1,
          lastUsedAt: Date.now(),
          createdAt: Date.now(),
        };
    await awaitReq(tx(d, "readwrite").put(entry));
  } catch {
    /* ignore cache errors */
  }
}

/** Bulk fetch all cached selectors for a given origin+formSig, as a map fieldKey→selector. */
export async function getCachedSelectors(
  origin: string,
  formSig: string,
): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  try {
    const d = await db();
    if (!d) return out;
    const idx = tx(d, "readonly").index("origin");
    const prefix = IDBKeyRange.bound(origin, origin + PREFIX_MAX_SUFFIX);
    await new Promise<void>((resolve) => {
      const cursorReq = idx.openCursor(prefix);
      cursorReq.onsuccess = () => {
        const cursor = cursorReq.result;
        if (!cursor) { resolve(); return; }
        const e = cursor.value as PatternCacheEntry;
        if (e.formSig === formSig) {
          try {
            if (document.querySelector(e.selector)) out.set(e.fieldKey, e.selector);
          } catch { /* ignore bad selector */ }
        }
        cursor.continue();
      };
      cursorReq.onerror = () => resolve();
    });
  } catch { /* ignore */ }
  return out;
}

/** Clear all entries for an origin (e.g., after logout / "clear cache" setting). */
export async function clearPatternsForOrigin(origin: string): Promise<void> {
  try {
    const d = await db();
    if (!d) return;
    const idx = tx(d, "readwrite").index("origin");
    const prefix = IDBKeyRange.bound(origin, origin + PREFIX_MAX_SUFFIX);
    await new Promise<void>((resolve) => {
      const req = idx.openCursor(prefix);
      req.onsuccess = () => {
        const c = req.result;
        if (!c) { resolve(); return; }
        c.delete();
        c.continue();
      };
      req.onerror = () => resolve();
    });
  } catch { /* ignore */ }
}

/** Delete every cached entry (use from Settings "Clear cache" button). */
export async function clearAllPatterns(): Promise<void> {
  try {
    const d = await db();
    if (!d) return;
    await awaitReq(tx(d, "readwrite").clear());
  } catch { /* ignore */ }
}

/** Purge expired entries. Called lazily on startup. */
export async function purgeExpired(): Promise<void> {
  try {
    const d = await db();
    if (!d) return;
    const store = tx(d, "readwrite");
    const now = Date.now();
    await new Promise<void>((resolve) => {
      const req = store.openCursor();
      req.onsuccess = () => {
        const c = req.result;
        if (!c) { resolve(); return; }
        const e = c.value as PatternCacheEntry;
        if (now - e.lastUsedAt > TTL_MS) c.delete();
        c.continue();
      };
      req.onerror = () => resolve();
    });
  } catch { /* ignore */ }
}
