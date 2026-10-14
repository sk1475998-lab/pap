/**
 * Sign-in form detector and filler.
 *
 * Detects standard sign-in forms (email + password fields) and fills them
 * with stored credentials.  Returns the result of the fill attempt.
 */
import { diagLog } from "@/lib/diagnostics.js";
import { mimicInput, mimicClick } from "@/lib/mimic-user.js";
import { isSignUpPage } from "./sign-up-handler.js";

export interface SignInResult {
  found: boolean;
  filled: boolean;
  submitted: boolean;
  reason?: string;
}

/** Common sign-in form email field selectors. */
const EMAIL_SELECTORS = [
  "input[type='email']",
  "input[name='email']",
  "input[name='username']",
  "input[autocomplete='email']",
  "input[autocomplete='username']",
  "input[placeholder*='email' i]",
  "input[placeholder*='username' i]",
];

/** Common sign-in form password field selectors. */
const PASSWORD_SELECTORS = [
  "input[type='password']",
  "input[name='password']",
  "input[autocomplete='current-password']",
];

/** Common sign-in submit button selectors. */
const SUBMIT_SELECTORS = [
  "button[type='submit']",
  "input[type='submit']",
  "button[data-test*='signin']",
  "button[data-test*='login']",
  "button[class*='signin']",
  "button[class*='login']",
];

function findVisible<T extends Element>(selectors: string[], root: ParentNode = document): T | null {
  for (const sel of selectors) {
    const el = root.querySelector<T>(sel);
    if (el) {
      const rect = el.getBoundingClientRect();
      if (rect.width > 0 || rect.height > 0) return el;
    }
  }
  return null;
}

/**
 * Detect whether the current page has a sign-in form.
 */
export function isSignInPage(): boolean {
  if (isSignUpPage()) return false;
  return Boolean(
    findVisible(EMAIL_SELECTORS) && findVisible(PASSWORD_SELECTORS)
  );
}

/**
 * Fill the sign-in form with the provided credentials.
 * Optionally submits after filling.
 */
export async function fillSignInForm(
  email: string,
  password: string,
  options?: { autoSubmit?: boolean }
): Promise<SignInResult> {
  const emailField = findVisible<HTMLInputElement>(EMAIL_SELECTORS);
  const passwordField = findVisible<HTMLInputElement>(PASSWORD_SELECTORS);

  if (!emailField || !passwordField) {
    return { found: false, filled: false, submitted: false, reason: "Fields not found" };
  }

  try {
    await mimicInput(emailField, email);
    await mimicInput(passwordField, password);

    void diagLog("auth", "sign-in-filled", { message: "Sign-in form filled" });

    let submitted = false;
    if (options?.autoSubmit) {
      const form = emailField.closest("form");
      const submitBtn = form && passwordField.closest("form") === form
        ? findVisible<HTMLElement>(SUBMIT_SELECTORS, form)
        : null;
      if (submitBtn) {
        await mimicClick(submitBtn);
        await new Promise((resolve) => setTimeout(resolve, 1500));
        submitted = !findVisible(EMAIL_SELECTORS) && !findVisible(PASSWORD_SELECTORS) && !hasWrongCredentialsError();
      }
    }
    return {
      found: true,
      filled: true,
      submitted,
      ...(!submitted && options?.autoSubmit ? { reason: "Login completion was not confirmed; review the page and finish manually." } : {}),
    };
  } catch (e) {
    return { found: true, filled: false, submitted: false, reason: e instanceof Error ? e.message : String(e) };
  }
}

/**
 * Check for wrong-credentials error indicators after a sign-in attempt.
 */
export function hasWrongCredentialsError(): boolean {
  const patterns = [
    /invalid (email|password|credentials)/i,
    /incorrect (email|password|credentials)/i,
    /wrong (email|password|credentials)/i,
    /login failed/i,
    /sign in failed/i,
    /authentication failed/i,
  ];
  const errorEls = document.querySelectorAll("[class*='error'], [class*='alert'], [role='alert']");
  for (const el of errorEls) {
    const text = (el as HTMLElement).innerText?.trim() || "";
    if (patterns.some((p) => p.test(text))) return true;
  }
  return false;
}