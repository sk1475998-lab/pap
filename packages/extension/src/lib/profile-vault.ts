/**
 * Encrypts the high-risk profile slice at rest using the existing user vault
 * passphrase. General job-search data stays in the ordinary profile record.
 */
import { decryptText, encryptText, type EncryptedPayload, type Profile } from "@superjob/core";
import { getCredentialPassphrase } from "./credential-store.js";
import { isChromeRuntimeValid } from "./runtime-guard.js";

const PROFILE_VAULT_KEY = "sja-profile-sensitive-vault";
const VAULT_KEYS = [
  "pan",
  "aadhaar",
  "ssn",
  "passportNumber",
  "drivingLicenseNumber",
  "defaultLoginPassword",
  "imapConfig",
  "smtpConfig",
] as const;

type VaultKey = (typeof VAULT_KEYS)[number];
type SensitiveProfileSlice = Partial<Pick<Profile, VaultKey>>;

function splitProfile(profile: Profile): { publicProfile: Profile; sensitive: SensitiveProfileSlice } {
  const publicProfile = { ...profile } as Profile;
  const sensitive: SensitiveProfileSlice = {};
  for (const key of VAULT_KEYS) {
    const value = profile[key];
    if (value !== undefined && value !== "") sensitive[key] = value as never;
    if (key === "imapConfig" || key === "smtpConfig") delete (publicProfile as Record<string, unknown>)[key];
    else (publicProfile as Record<string, unknown>)[key] = "";
  }
  return { publicProfile, sensitive };
}

export async function protectProfileForStorage(profile: Profile): Promise<Profile> {
  if (!isChromeRuntimeValid()) return profile;
  const { publicProfile, sensitive } = splitProfile(profile);
  const hasSensitive = Object.keys(sensitive).length > 0;
  const existing = await chrome.storage.local.get(PROFILE_VAULT_KEY) as Record<string, unknown>;
  const passphrase = await getCredentialPassphrase();

  if (hasSensitive) {
    if (!passphrase) {
      throw new Error("Set a vault passphrase in Settings before saving profile credentials or identity fields.");
    }
    const payload = await encryptText(JSON.stringify(sensitive), passphrase);
    await chrome.storage.local.set({ [PROFILE_VAULT_KEY]: payload });
  } else if (existing[PROFILE_VAULT_KEY]) {
    await chrome.storage.local.remove(PROFILE_VAULT_KEY);
  }

  return publicProfile;
}

export async function hydrateProfileFromVault(profile: Profile | undefined): Promise<Profile | undefined> {
  if (!profile || !isChromeRuntimeValid()) return profile;
  const raw = await chrome.storage.local.get(PROFILE_VAULT_KEY) as Record<string, unknown>;
  const payload = raw[PROFILE_VAULT_KEY] as EncryptedPayload | undefined;
  if (!payload) return profile; // legacy/plain profile remains visible until explicitly migrated.

  const passphrase = await getCredentialPassphrase();
  if (!passphrase) return profile; // locked vault: never reveal encrypted fields.
  try {
    const sensitive = JSON.parse(await decryptText(payload, passphrase)) as SensitiveProfileSlice;
    return { ...profile, ...sensitive };
  } catch {
    return profile; // wrong passphrase or damaged vault; public profile stays available.
  }
}

export async function hasEncryptedProfileVault(): Promise<boolean> {
  if (!isChromeRuntimeValid()) return false;
  const raw = await chrome.storage.local.get(PROFILE_VAULT_KEY) as Record<string, unknown>;
  return Boolean(raw[PROFILE_VAULT_KEY]);
}
