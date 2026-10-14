/**
 * ATS-specific credential generator.
 *
 * Generates email aliases and passwords for automated account creation.
 * Credentials are stored only in chrome.storage.session (never synced).
 */

export interface GeneratedCredential {
  email: string;
  password: string;
  alias: string;
  atsName: string;
  createdAt: number;
}

/** Base email patterns — filled from user profile. */
export function generateEmailAlias(baseEmail: string, atsName: string, attempt = 0): string {
  const [local, domain] = baseEmail.split("@");
  if (!local || !domain) throw new Error("Invalid base email");
  const slug = atsName.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 8);
  const suffix = attempt === 0 ? slug : `${slug}${attempt}`;
  // Use + alias (supported by Gmail, Outlook, ProtonMail)
  return `${local}+sja${suffix}@${domain}`;
}

/**
 * Generate a strong password suitable for ATS accounts.
 * Meets most complexity requirements: upper + lower + number + symbol.
 */
export function generatePassword(atsName: string): string {
  const upper = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const lower = "abcdefghjkmnpqrstuvwxyz";
  const digits = "23456789";
  const symbols = "!@#$%&*";
  const slug = atsName.slice(0, 4).padEnd(4, "x").charAt(0).toUpperCase() + atsName.slice(0, 3);
  const rand = (set: string) => {
    const limit = Math.floor(256 / set.length) * set.length;
    const bytes = new Uint8Array(1);
    do {
      crypto.getRandomValues(bytes);
    } while (bytes[0] >= limit);
    return set[bytes[0] % set.length];
  };
  return `${slug}${rand(upper)}${rand(digits)}${rand(lower)}${rand(lower)}${rand(symbols)}${rand(digits)}${rand(upper)}`;
}

const SESSION_KEY = "sja-ats-credentials";

/** Retrieve all stored ATS credentials from session storage. */
export async function getStoredCredentials(): Promise<Record<string, GeneratedCredential>> {
  try {
    const result = await chrome.storage.session.get(SESSION_KEY);
    return (result[SESSION_KEY] as Record<string, GeneratedCredential>) ?? {};
  } catch {
    return {};
  }
}

/** Store a credential for an ATS (keyed by atsName). */
export async function storeCredential(cred: GeneratedCredential): Promise<void> {
  const existing = await getStoredCredentials();
  existing[cred.atsName] = cred;
  await chrome.storage.session.set({ [SESSION_KEY]: existing });
}

/** Retrieve stored credential for a specific ATS. */
export async function getCredentialForAts(atsName: string): Promise<GeneratedCredential | null> {
  const all = await getStoredCredentials();
  return all[atsName] ?? null;
}