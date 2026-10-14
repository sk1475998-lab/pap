/**
 * Email alias manager.
 *
 * Rotates email aliases when an ATS rejects credentials.
 * Tracks alias attempts per ATS to avoid infinite loops.
 */
import { generateEmailAlias, getCredentialForAts, storeCredential } from "./credential-generator.js";

const MAX_ALIAS_ATTEMPTS = 5;

/** Attempt counters per ATS name. */
const attempts = new Map<string, number>();

export function getAliasAttemptCount(atsName: string): number {
  return attempts.get(atsName) ?? 0;
}

export function canRotateAlias(atsName: string): boolean {
  return getAliasAttemptCount(atsName) < MAX_ALIAS_ATTEMPTS;
}

/**
 * Generate the next alias for an ATS.
 * Returns the new alias email, or null if max attempts exceeded.
 */
export function rotateAlias(baseEmail: string, atsName: string): string | null {
  const current = getAliasAttemptCount(atsName);
  if (current >= MAX_ALIAS_ATTEMPTS) return null;
  const next = current + 1;
  attempts.set(atsName, next);
  return generateEmailAlias(baseEmail, atsName, next);
}

export function resetAliasAttempts(atsName: string): void {
  attempts.delete(atsName);
}