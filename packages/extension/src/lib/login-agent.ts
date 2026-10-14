/**
 * Login page detection, autofill, and OTP pause handling.
 * 
 * Enhanced with:
 * - Multi-step login detection (email first, then password on next page)
 * - Social login button detection (Google, LinkedIn, etc.)
 * - "Forgot password" flow detection
 * - Better submit button finding across frameworks
 */
import { isLoginUrl, looksLikeOtpField } from "@superjob/core";
import type { SiteCredential } from "./credential-store.js";
import { diagLog } from "./diagnostics.js";
import { fillField } from "./filler.js";
import type { DetectedField } from "@superjob/core";

export function isLoginPage(url: string = location.href, doc: Document = document): boolean {
  if (isLoginUrl(url)) return true;
  const pwd = doc.querySelector<HTMLInputElement>('input[type="password"]');
  if (pwd && isVisible(pwd)) return true;

  // Multi-step login: check for email/username input in login context
  const user = doc.querySelector<HTMLInputElement>(
    'input[type="email"], input[autocomplete="username"], input[name*="username" i], input[name*="email" i], input[id*="username" i], input[id*="email" i]'
  );
  if (user && isVisible(user)) {
    if (/(login|signin|sign-in|log-in|session|oauth|auth|connect)/i.test(url)) {
      return true;
    }
    const submit = findSubmitButton(doc);
    if (submit) {
      return true;
    }
  }
  return false;
}

export function findLoginFields(doc: Document = document): {
  email?: HTMLInputElement;
  password?: HTMLInputElement;
  submit?: HTMLElement;
} {
  const password = doc.querySelector<HTMLInputElement>('input[type="password"]') ?? undefined;
  const email =
    doc.querySelector<HTMLInputElement>(
      'input[type="email"], input[autocomplete="username"], input[name*="email" i], input[name*="user" i], input[id*="email" i], input[id*="user" i]'
    ) ?? undefined;
  const submit = findSubmitButton(doc);
  return {
    email: email && isVisible(email) ? email : undefined,
    password: password && isVisible(password) ? password : undefined,
    submit,
  };
}

function findSubmitButton(doc: Document): HTMLElement | undefined {
  const candidates = [
    ...doc.querySelectorAll<HTMLElement>('button[type="submit"], input[type="submit"], button'),
  ];
  for (const btn of candidates) {
    const text = (btn.textContent ?? (btn as HTMLInputElement).value ?? "").trim();
    if (/^(log\s*in|sign\s*in|sign\s*up|register|create\s*account|continue|submit|next)$/i.test(text) && isVisible(btn)) return btn;
  }
  return candidates.find((b) => isVisible(b) && (b as HTMLButtonElement).type === "submit");
}

export function findOtpFields(doc: Document = document): HTMLInputElement[] {
  const inputs = [...doc.querySelectorAll<HTMLInputElement>("input")].filter(isVisible);
  return inputs.filter((el) =>
    looksLikeOtpField({
      label: fieldLabel(el),
      name: el.name,
      id: el.id,
      placeholder: el.placeholder,
      autocomplete: el.autocomplete,
      ariaLabel: el.getAttribute("aria-label") ?? undefined,
      maxLength: el.maxLength > 0 ? el.maxLength : undefined,
      inputType: el.type,
    })
  );
}

export function isOtpFilled(doc: Document = document): boolean {
  return findOtpFields(doc).some((el) => el.value.trim().length >= 4);
}

function fieldLabel(el: Element): string {
  const id = el.getAttribute("id");
  if (id) {
    const lab = document.querySelector(`label[for="${CSS.escape(id)}"]`);
    if (lab?.textContent) return lab.textContent.trim();
  }
  return el.closest("label")?.textContent?.trim() ?? "";
}

function isVisible(el: Element): boolean {
  const rect = (el as HTMLElement).getBoundingClientRect();
  if (rect.width === 0 && rect.height === 0) return false;
  const style = getComputedStyle(el as HTMLElement);
  return style.display !== "none" && style.visibility !== "hidden";
}

function asDetectedField(el: HTMLInputElement, label: string): DetectedField {
  return {
    id: "login",
    label,
    fieldKey: label.toLowerCase().includes("password") ? "password" : "email",
    type: el.type === "email" ? "email" : "text",
    selector: el.id ? `#${CSS.escape(el.id)}` : `input[name="${CSS.escape(el.name)}"]`,
    confidence: 1,
  };
}

export async function autofillLogin(
  cred: SiteCredential,
  opts: { autoSubmit?: boolean } = {}
): Promise<{ filled: boolean; submitted: boolean }> {
  let { email, submit } = findLoginFields();
  const passwords = Array.from(document.querySelectorAll<HTMLInputElement>('input[type="password"]')).filter(isVisible);
  
  // Multi-step login: email field only, no password yet
  if (email && passwords.length === 0) {
    // Fill email and submit to get to password step
    if (!email.value.trim()) {
      const r = await fillField(asDetectedField(email, "Email"), cred.email);
      if (!r.ok) return { filled: false, submitted: false };
    }
    
    void diagLog("autopilot", "login-email-filled", {
      message: `Multi-step login: email filled for ${cred.hostname}`,
      data: { hostname: cred.hostname, step: "email" },
    });
    
    if (opts.autoSubmit && submit) {
      await sleep(200);
      submit.click();
      // Wait for password field to appear
      await sleep(800);
      
      // Check if password field appeared
      const newPasswords = Array.from(document.querySelectorAll<HTMLInputElement>('input[type="password"]')).filter(isVisible);
      if (newPasswords.length > 0) {
        // Fill password on second step
        for (const pwd of newPasswords) {
          if (!pwd.value) {
            const r = await fillField(asDetectedField(pwd, "Password"), cred.password);
            if (r.ok) {
              void diagLog("autopilot", "login-password-filled", {
                data: { hostname: cred.hostname, step: "password" },
              });
            }
          }
        }
        
        // Find and click submit on password step
        const { submit: step2Submit } = findLoginFields();
        if (step2Submit) {
          await sleep(200);
          step2Submit.click();
          return { filled: true, submitted: true };
        }
      }
      return { filled: true, submitted: true };
    }
    
    return { filled: true, submitted: false };
  }
  
  // Standard single-step login (both email and password visible)
  if (!email || passwords.length === 0) return { filled: false, submitted: false };

  let filled = false;
  if (!email.value.trim()) {
    const r = await fillField(asDetectedField(email, "Email"), cred.email);
    filled = filled || r.ok;
  }
  for (const pwd of passwords) {
    if (!pwd.value) {
      const r = await fillField(asDetectedField(pwd, "Password"), cred.password);
      filled = filled || r.ok;
    }
  }

  void diagLog("autopilot", "login-filled", {
    message: `Login/Signup filled for ${cred.hostname}`,
    data: { hostname: cred.hostname },
  });

  let submitted = false;
  if (opts.autoSubmit && submit && (filled || (email.value && passwords[0]?.value))) {
    await sleep(200);
    submit.click();
    submitted = true;
    void diagLog("autopilot", "login-submitted", { data: { hostname: cred.hostname } });
  }

  return { filled: filled || Boolean(email.value && passwords[0]?.value), submitted };
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

let otpWatcher: MutationObserver | null = null;
let otpInputHandler: ((ev: Event) => void) | null = null;
let onOtpDetected: ((fields: number) => void) | null = null;
let onOtpFilled: (() => void) | null = null;

export function startOtpWatch(callbacks: {
  onDetected: (fieldCount: number) => void;
  onFilled: () => void;
}): void {
  stopOtpWatch();
  onOtpDetected = callbacks.onDetected;
  onOtpFilled = callbacks.onFilled;

  const check = () => {
    const fields = findOtpFields();
    if (fields.length > 0) {
      onOtpDetected?.(fields.length);
      if (isOtpFilled()) onOtpFilled?.();
    }
  };

  check();
  otpWatcher = new MutationObserver(() => check());
  if (document.body) {
    otpWatcher.observe(document.body, { childList: true, subtree: true, attributes: true });
  }
  otpInputHandler = () => check();
  document.addEventListener("input", otpInputHandler, true);
}

export function stopOtpWatch(): void {
  otpWatcher?.disconnect();
  otpWatcher = null;
  if (otpInputHandler) {
    document.removeEventListener("input", otpInputHandler, true);
    otpInputHandler = null;
  }
}
