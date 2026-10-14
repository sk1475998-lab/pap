/**
 * Onboarding state machine + chrome.storage persistence.
 *
 * Tracks user progression through the onboarding wizard:
 *   WELCOME → RESUME_UPLOAD → READY_TO_APPLY → COMPLETED
 */

export type OnboardingStep =
  | "WELCOME"
  | "RESUME_UPLOAD"
  | "READY_TO_APPLY"
  | "COMPLETED";

export interface OnboardingState {
  step: OnboardingStep;
  completedAt: number | null;
}

const STORAGE_KEY = "sja-onboarding-state";

const DEFAULT_STATE: OnboardingState = {
  step: "WELCOME",
  completedAt: null,
};

/**
 * Load onboarding state from chrome.storage.local.
 * Returns default state if not found or on error.
 */
export async function loadOnboardingState(): Promise<OnboardingState> {
  try {
    const result = await chrome.storage.local.get(STORAGE_KEY);
    const stored = result[STORAGE_KEY];
    if (stored && typeof stored === "object" && !Array.isArray(stored)) {
      const legacy = stored as Record<string, unknown>;
      const validSteps: OnboardingStep[] = ["WELCOME", "RESUME_UPLOAD", "READY_TO_APPLY", "COMPLETED"];
      const state: OnboardingState = {
        step: validSteps.find((step) => step === legacy.step) ?? DEFAULT_STATE.step,
        completedAt: typeof legacy.completedAt === "number" && Number.isFinite(legacy.completedAt)
          ? legacy.completedAt
          : null,
      };
      if (["name", "email", "phone", "resumeText"].some((key) => Boolean(legacy[key]))) {
        await chrome.storage.local.set({ [STORAGE_KEY]: state });
      }
      return state;
    }
  } catch {
    /* Extension context may not be available */
  }
  return { ...DEFAULT_STATE };
}

/**
 * Save onboarding state to chrome.storage.local.
 */
export async function saveOnboardingState(state: OnboardingState): Promise<void> {
  try {
    await chrome.storage.local.set({ [STORAGE_KEY]: state });
  } catch {
    /* Graceful degradation */
  }
}

/**
 * Check if onboarding is completed.
 */
export async function isOnboardingComplete(): Promise<boolean> {
  const state = await loadOnboardingState();
  try {
    const { getProfile } = await import("../store.js");
    const p = await getProfile();
    const profileReady = Boolean(
      p?.masterResumeText?.trim() ||
      (p?.firstName?.trim() && p?.lastName?.trim() && p?.email?.trim())
    );
    if (state.step === "COMPLETED" && profileReady) return true;
    if (profileReady) {
      await saveOnboardingState({ ...state, step: "COMPLETED", completedAt: Date.now() });
      return true;
    }
  } catch (error) {
    console.error("[onboarding] Could not verify completion:", error);
  }
  return false;
}

/**
 * Advance to the next onboarding step.
 */
export function nextStep(current: OnboardingStep): OnboardingStep {
  switch (current) {
    case "WELCOME":
      return "RESUME_UPLOAD";
    case "RESUME_UPLOAD":
      return "READY_TO_APPLY";
    case "READY_TO_APPLY":
      return "COMPLETED";
    case "COMPLETED":
      return "COMPLETED";
  }
}

/**
 * Go back to the previous onboarding step.
 */
export function prevStep(current: OnboardingStep): OnboardingStep {
  switch (current) {
    case "RESUME_UPLOAD":
      return "WELCOME";
    case "READY_TO_APPLY":
      return "RESUME_UPLOAD";
    default:
      return current;
  }
}

/**
 * Reset onboarding state completely.
 */
export async function resetOnboarding(): Promise<void> {
  await saveOnboardingState({ ...DEFAULT_STATE });
}

/**
 * Mark onboarding as complete.
 */
export async function completeOnboarding(): Promise<OnboardingState> {
  const completed: OnboardingState = {
    step: "COMPLETED",
    completedAt: Date.now(),
  };
  await saveOnboardingState(completed);
  return completed;
}
