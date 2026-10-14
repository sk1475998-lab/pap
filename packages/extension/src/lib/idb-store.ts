/** Tiny IndexedDB helper for larger local-first datasets. */
const DB_NAME = "super-job-agent";
const DB_VERSION = 1;
const STORES = ["audits", "learning", "applications", "events"] as const;
type StoreName = (typeof STORES)[number];

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      for (const s of STORES) {
        if (!db.objectStoreNames.contains(s)) {
          const store = db.createObjectStore(s, { keyPath: "id" });
          store.createIndex("updatedAt", "updatedAt");
        }
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function idbPut<T extends { id: string; updatedAt?: number }>(storeName: StoreName, value: T): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(storeName, "readwrite");
    tx.objectStore(storeName).put({ ...value, updatedAt: value.updatedAt ?? Date.now() });
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  }).finally(() => db.close());
}

export async function idbList<T>(storeName: StoreName, limit = 50): Promise<T[]> {
  const db = await openDb();
  return new Promise<T[]>((resolve, reject) => {
    const tx = db.transaction(storeName, "readonly");
    const idx = tx.objectStore(storeName).index("updatedAt");
    const out: T[] = [];
    const req = idx.openCursor(null, "prev");
    req.onsuccess = () => {
      const cursor = req.result;
      if (!cursor || out.length >= limit) return resolve(out);
      out.push(cursor.value as T);
      cursor.continue();
    };
    req.onerror = () => reject(req.error);
  }).finally(() => db.close());
}

export async function idbDeleteOld(storeName: StoreName, keep = 200): Promise<void> {
  const all = await idbList<{ id: string }>(storeName, 10_000);
  const stale = all.slice(keep);
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(storeName, "readwrite");
    const os = tx.objectStore(storeName);
    for (const item of stale) os.delete(item.id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  }).finally(() => db.close());
}
