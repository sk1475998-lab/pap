/**
 * Per-site login credentials — stored locally in chrome.storage.
 * Passwords are never written to diagnostics logs.
 */
import { encryptText, decryptText, normalizeHostname, type EncryptedPayload } from "@superjob/core";
import { isChromeRuntimeValid } from "./runtime-guard.js";

export interface SiteCredential {
  id: string;
  hostname: string;
  email: string;
  /** Legacy/plaintext password. New saves require encryption and keep this empty. */
  password: string;
  passwordEnc?: EncryptedPayload;
  label?: string;
  updatedAt: number;
  encryptionRequired?: boolean;
}

const STORAGE_KEY = "siteCredentials";
let vaultPassphrase: string | null = null;

export function setCredentialPassphrase(passphrase: string | null): void {
  vaultPassphrase = passphrase?.trim() || null;
  if (isChromeRuntimeValid() && chrome.storage?.session) {
    if (vaultPassphrase) {
      void chrome.storage.session.set({ vaultPassphrase });
    } else {
      void chrome.storage.session.remove("vaultPassphrase");
    }
  }
}

export async function getCredentialPassphrase(): Promise<string | null> {
  if (vaultPassphrase) return vaultPassphrase;
  if (isChromeRuntimeValid() && chrome.storage?.session) {
    try {
      const res = await chrome.storage.session.get("vaultPassphrase");
      return (res.vaultPassphrase as string) || null;
    } catch {
      return null;
    }
  }
  return null;
}

async function revealPassword(c: SiteCredential): Promise<string> {
  const passphrase = await getCredentialPassphrase();
  if (c.passwordEnc && passphrase) {
    try {
      return await decryptText(c.passwordEnc, passphrase);
    } catch {
      return "";
    }
  }
  // Refuse to reveal legacy plaintext unless the user intentionally re-saves it
  // through the vault. This prevents silent auto-login with unencrypted secrets.
  return c.encryptionRequired ? "" : c.password;
}

async function readAll(): Promise<SiteCredential[]> {
  if (!isChromeRuntimeValid()) return [];
  try {
    const raw = await chrome.storage.local.get(STORAGE_KEY);
    return Array.isArray(raw[STORAGE_KEY]) ? (raw[STORAGE_KEY] as SiteCredential[]) : [];
  } catch {
    return [];
  }
}

async function writeAll(list: SiteCredential[]): Promise<void> {
  if (!isChromeRuntimeValid()) return;
  try {
    await chrome.storage.local.set({ [STORAGE_KEY]: list });
  } catch {
    /* quota */
  }
}

export async function listCredentials(): Promise<SiteCredential[]> {
  return readAll();
}

/** List credentials with decrypted passwords (requires passphrase if encrypted). */
export async function listCredentialsDecrypted(): Promise<SiteCredential[]> {
  const list = await readAll();
  const out: SiteCredential[] = [];
  for (const c of list) {
    out.push({ ...c, password: await revealPassword(c) });
  }
  return out;
}

export async function getCredentialForHost(hostname: string): Promise<SiteCredential | undefined> {
  const host = normalizeHostname(hostname);
  const list = await readAll();
  const found =
    list.find((c) => normalizeHostname(c.hostname) === host) ??
    list.find(
      (c) => host.endsWith(normalizeHostname(c.hostname)) || normalizeHostname(c.hostname).endsWith(host)
    );
  if (!found) return undefined;
  return { ...found, password: await revealPassword(found) };
}

export async function saveCredential(
  cred: Omit<SiteCredential, "id" | "updatedAt"> & { id?: string }
): Promise<SiteCredential> {
  const list = await readAll();
  const host = normalizeHostname(cred.hostname);
  const entry: SiteCredential = {
    id: cred.id ?? `cred_${Date.now()}`,
    hostname: host,
    email: cred.email.trim(),
    password: "",
    label: cred.label?.trim(),
    updatedAt: Date.now(),
  };
  const passphrase = await getCredentialPassphrase();
  if (!passphrase) {
    throw new Error("Vault passphrase is required to save site credentials.");
  }
  if (cred.password) {
    entry.passwordEnc = await encryptText(cred.password, passphrase);
  }
  entry.encryptionRequired = true;
  const idx = list.findIndex((c) => normalizeHostname(c.hostname) === host);
  if (idx >= 0) list[idx] = { ...list[idx], ...entry, id: list[idx].id };
  else list.push(entry);
  await writeAll(list);
  return entry;
}

export async function deleteCredential(id: string): Promise<void> {
  const list = await readAll();
  await writeAll(list.filter((c) => c.id !== id));
}
