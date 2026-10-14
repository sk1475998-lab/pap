/**
 * Sign-up / account creation form detector and filler.
 *
 * Detects standard registration forms and fills them with generated
 * credentials (name, email, password, confirmPassword).
 */
import { diagLog } from "@/lib/diagnostics.js";
import { mimicInput, mimicClick } from "@/lib/mimic-user.js";
import type { Profile } from "@superjob/core";

export interface SignUpResult {
  found: boolean;
  filled: boolean;
  submitted: boolean;
  email?: string;
  reason?: string;
}

const FIRST_NAME_SELECTORS = [
  "input[name*='first' i]", "input[placeholder*='first name' i]",
  "input[autocomplete='given-name']", "input[id*='first' i]",
];
const LAST_NAME_SELECTORS = [
  "input[name*='last' i]", "input[placeholder*='last name' i]",
  "input[autocomplete='family-name']", "input[id*='last' i]",
];
const EMAIL_SELECTORS = [
  "input[type='email']", "input[name='email']",
  "input[autocomplete='email']", "input[placeholder*='email' i]",
];
const PASSWORD_SELECTORS = [
  "input[type='password'][name*='pass' i]",
  "input[type='password'][autocomplete='new-password']",
  "input[type='password']:first-of-type",
];
const CONFIRM_PASSWORD_SELECTORS = [
  "input[name*='confirm' i][type='password']",
  "input[name*='verify' i][type='password']",
  "input[autocomplete='new-password'] ~ input[type='password']",
  "input[type='password']:last-of-type",
];

function findVisible<T extends Element>(selectors: string[], root: ParentNode = document): T | null {
  for (const sel of selectors) {
    try {
      const el = root.querySelector<T>(sel);
      if (el) {
        const rect = el.getBoundingClientRect();
        if (rect.width > 0 || rect.height > 0) return el;
      }
    } catch {}
  }
  return null;
}

export function isSignUpPage(): boolean {
  // 1. Two or more visible password fields (password + confirm password)
  const passwordFields = document.querySelectorAll<HTMLInputElement>("input[type='password']");
  const visiblePasswordFields = Array.from(passwordFields).filter(el => {
    const rect = el.getBoundingClientRect();
    return rect.width > 0 || rect.height > 0;
  });
  if (visiblePasswordFields.length >= 2) return true;

  // 2. Visible first name or last name fields (signature of sign-up vs sign-in)
  const hasNameFields = Boolean(
    findVisible(FIRST_NAME_SELECTORS) || findVisible(LAST_NAME_SELECTORS)
  );
  if (hasNameFields) return true;

  // 3. URL check
  const url = location.href.toLowerCase();
  if (url.includes("signup") || url.includes("register") || url.includes("createaccount") || url.includes("create-account")) {
    return true;
  }

  // 4. Submit button text check (e.g. "Create Account", "Sign Up", "Register")
  const submitBtn = document.querySelector<HTMLElement>("button[type='submit'], input[type='submit'], button[class*='signup' i], button[class*='register' i]");
  if (submitBtn) {
    const text = submitBtn.textContent?.toLowerCase() || (submitBtn as HTMLInputElement).value?.toLowerCase() || "";
    if (/create.{0,20}account|sign.?up|register|join/i.test(text)) {
      return true;
    }
  }

  return false;
}

export async function fillSignUpForm(
  profile: Profile,
  email: string,
  password: string,
  options?: { autoSubmit?: boolean }
): Promise<SignUpResult> {
  try {
    const firstField = findVisible<HTMLInputElement>(FIRST_NAME_SELECTORS);
    const lastField = findVisible<HTMLInputElement>(LAST_NAME_SELECTORS);
    const emailField = findVisible<HTMLInputElement>(EMAIL_SELECTORS);
    const passField = findVisible<HTMLInputElement>(PASSWORD_SELECTORS);

    if (!emailField || !passField) {
      return { found: false, filled: false, submitted: false, reason: "Required fields not found" };
    }

    if (firstField && profile.firstName) await mimicInput(firstField, profile.firstName);
    if (lastField && profile.lastName) await mimicInput(lastField, profile.lastName);
    await mimicInput(emailField, email);
    await mimicInput(passField, password);

    // Confirm password
    const confirmField = findVisible<HTMLInputElement>(CONFIRM_PASSWORD_SELECTORS);
    if (confirmField && confirmField !== passField) await mimicInput(confirmField, password);

    void diagLog("auth", "sign-up-filled", { message: "Sign-up form filled" });

    let submitted = false;
    if (options?.autoSubmit) {
      const form = emailField.form;
      const sameForm = form && passField.form === form && (!firstField?.form || firstField.form === form) && (!lastField?.form || lastField.form === form);
      const submitBtn = sameForm
        ? findVisible<HTMLElement>(["button[type='submit']", "input[type='submit']"], form)
        : null;
      const buttonText = (submitBtn?.textContent || (submitBtn as HTMLInputElement | null)?.value || "").trim();
      if (submitBtn && /create|sign.?up|register|join/i.test(buttonText)) {
        await mimicClick(submitBtn);
        await new Promise((resolve) => setTimeout(resolve, 1500));
        submitted = !findVisible(FIRST_NAME_SELECTORS) && !findVisible(LAST_NAME_SELECTORS) && !findVisible(PASSWORD_SELECTORS);
      }
    }
    return { found: true, filled: true, submitted, email, ...(!submitted && options?.autoSubmit ? { reason: "Sign-up completion was not confirmed; review the page and finish manually." } : {}) };
  } catch (e) {
    return { found: true, filled: false, submitted: false, reason: e instanceof Error ? e.message : String(e) };
  }
}