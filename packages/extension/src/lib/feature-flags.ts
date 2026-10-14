/**
 * Feature flag system.
 *
 * Reads flag overrides from chrome.storage.local so that individual
 * features can be toggled without a code deploy.  Falls back to
 * compile-time defaults.
 */

export interface FeatureFlags {
  /** Enable auth automation (sign-in/sign-up). */
  authAutomation: boolean;
  /** Enable form error recovery loop. */
  formErrorRecovery: boolean;
  /** Enable React-based side panel (vs legacy HTML panel). */
  reactPanel: boolean;
  /** Enable onboarding flow for new users. */
  onboarding: boolean;
  /** Enable telemetry event batching. */
  telemetry: boolean;
  /** Enable campaign mode (batch apply). */
  campaignMode: boolean;
  /** Enable ATS-config lazy loading (tree-shake per platform). */
  lazyAtsConfig: boolean;
}

const DEFAULTS: FeatureFlags = {
  authAutomation: true,
  formErrorRecovery: true,
  reactPanel: true,       // Phase 4 — enabled by default
  onboarding: true,
  telemetry: true,
  campaignMode: true,
  lazyAtsConfig: false,
};

const STORAGE_KEY = "sja-feature-flags";

let _cache: FeatureFlags | null = null;

/** Load feature flags (with defaults for any missing). */
export async function getFeatureFlags(): Promise<FeatureFlags> {
  if (_cache) return _cache;
  try {
    const stored = await chrome.storage.local.get(STORAGE_KEY);
    const overrides = (stored[STORAGE_KEY] as Partial<FeatureFlags>) ?? {};
    _cache = { ...DEFAULTS, ...overrides };
    return _cache;
  } catch {
    return { ...DEFAULTS };
  }
}

/** Check a single flag. Synchronous — returns cached value or default. */
export function isEnabled(flag: keyof FeatureFlags): boolean {
  return _cache ? _cache[flag] : DEFAULTS[flag];
}

/** Override flags (for testing or remote config). */
export async function setFeatureFlags(overrides: Partial<FeatureFlags>): Promise<void> {
  const current = await getFeatureFlags();
  _cache = { ...current, ...overrides };
  await chrome.storage.local.set({ [STORAGE_KEY]: _cache });
}

/** Clear the in-memory cache (forces re-read on next access). */
export function clearFlagsCache(): void {
  _cache = null;
}