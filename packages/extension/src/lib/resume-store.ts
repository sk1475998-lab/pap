/**
 * Resume blob storage — IndexedDB primary, chrome.storage chunked backup for reload survival.
 */
import { isChromeRuntimeValid } from "./runtime-guard.js";

const DB_NAME = "superjob-resume";
const STORE = "files";
const KEY = "master";
const META_KEY = "resumeBackupMeta";
const CHUNK_PREFIX = "resumeBackupChunk_";
/** Raw bytes per chunk — base64 stays well under chrome.storage item limits */
const CHUNK_BYTES = 512 * 1024;

export interface StoredResume {
  fileName: string;
  mimeType: string;
  data: ArrayBuffer;
  uploadedAt: number;
}

interface ResumeBackupMeta {
  fileName: string;
  mimeType: string;
  uploadedAt: number;
  chunkCount: number;
  totalBytes: number;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onerror = () => reject(req.error);
    req.onsuccess = () => resolve(req.result);
    req.onupgradeneeded = () => {
      req.result.createObjectStore(STORE);
    };
  });
}

function uint8ToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]!);
  return btoa(binary);
}

function base64ToUint8(b64: string): Uint8Array {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function backupToChromeStorage(stored: StoredResume): Promise<void> {
  if (!isChromeRuntimeValid()) return;
  try {
    const bytes = new Uint8Array(stored.data);
    const chunkCount = Math.ceil(bytes.length / CHUNK_BYTES) || 1;
    const meta: ResumeBackupMeta = {
      fileName: stored.fileName,
      mimeType: stored.mimeType,
      uploadedAt: stored.uploadedAt,
      chunkCount,
      totalBytes: bytes.length,
    };
    const payload: Record<string, string | ResumeBackupMeta> = { [META_KEY]: meta };
    for (let i = 0; i < chunkCount; i++) {
      const slice = bytes.subarray(i * CHUNK_BYTES, (i + 1) * CHUNK_BYTES);
      payload[`${CHUNK_PREFIX}${i}`] = uint8ToBase64(slice);
    }
    const old = await chrome.storage.local.get(null);
    const removeKeys = Object.keys(old).filter((k) => k === META_KEY || k.startsWith(CHUNK_PREFIX));
    if (removeKeys.length) await chrome.storage.local.remove(removeKeys);
    await chrome.storage.local.set(payload);
  } catch {
    /* quota or context invalidated */
  }
}

async function restoreFromChromeBackup(): Promise<StoredResume | null> {
  if (!isChromeRuntimeValid()) return null;
  try {
    const raw = await chrome.storage.local.get(META_KEY);
    const meta = raw[META_KEY] as ResumeBackupMeta | undefined;
    if (!meta?.chunkCount) return null;

    const chunkKeys = Array.from({ length: meta.chunkCount }, (_, i) => `${CHUNK_PREFIX}${i}`);
    const chunks = await chrome.storage.local.get(chunkKeys);
    const parts: Uint8Array[] = [];
    for (let i = 0; i < meta.chunkCount; i++) {
      const b64 = chunks[`${CHUNK_PREFIX}${i}`] as string | undefined;
      if (!b64) return null;
      parts.push(base64ToUint8(b64));
    }
    const merged = new Uint8Array(meta.totalBytes);
    let offset = 0;
    for (const part of parts) {
      merged.set(part, offset);
      offset += part.length;
    }
    return {
      fileName: meta.fileName,
      mimeType: meta.mimeType,
      uploadedAt: meta.uploadedAt,
      data: merged.buffer,
    };
  } catch {
    return null;
  }
}

async function putInIdb(stored: StoredResume): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(stored, KEY);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function saveResumeBlob(file: File | Blob, fileName: string, mimeType: string): Promise<void> {
  const data = await file.arrayBuffer();
  const stored: StoredResume = { fileName, mimeType, data, uploadedAt: Date.now() };
  await putInIdb(stored);
  await backupToChromeStorage(stored);
}

export async function getResumeBlob(): Promise<StoredResume | null> {
  try {
    const db = await openDb();
    const fromIdb = await new Promise<StoredResume | null>((resolve, reject) => {
      const tx = db.transaction(STORE, "readonly");
      const req = tx.objectStore(STORE).get(KEY);
      req.onsuccess = () => resolve((req.result as StoredResume) ?? null);
      req.onerror = () => reject(req.error);
    });
    if (fromIdb) return fromIdb;

    const restored = await restoreFromChromeBackup();
    if (restored) {
      await putInIdb(restored);
      return restored;
    }
    return null;
  } catch {
    const restored = await restoreFromChromeBackup();
    if (restored) {
      try {
        await putInIdb(restored);
      } catch {
        /* IDB unavailable — return backup in memory */
      }
      return restored;
    }
    return null;
  }
}

/** Call on content-script startup — restores PDF from chrome.storage if IndexedDB was cleared. */
export async function ensureResumeAvailable(): Promise<boolean> {
  const blob = await getResumeBlob();
  return blob !== null;
}

export async function hasResumeBlob(): Promise<boolean> {
  return (await getResumeBlob()) !== null;
}

export function resumeBlobToFile(stored: StoredResume): File {
  return new File([stored.data], stored.fileName, { type: stored.mimeType });
}
