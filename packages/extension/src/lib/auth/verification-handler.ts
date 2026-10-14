/**
 * Email verification / OTP handler.
 *
 * Detects verification code inputs on ATS platforms and signals the
 * orchestrator to pause for manual OTP entry.
 */

export interface VerificationState {
  detected: boolean;
  fieldCount: number;
  message: string;
}

const VERIFICATION_SELECTORS = [
  "input[name*='otp' i]",
  "input[name*='verification' i]",
  "input[name*='code' i]",
  "input[placeholder*='verification' i]",
  "input[placeholder*='enter code' i]",
  "input[autocomplete='one-time-code']",
  "input[inputmode='numeric'][maxlength='6']",
  "input[inputmode='numeric'][maxlength='4']",
  // Segmented OTP inputs (common in newer ATS)
  ".otp-input",
  "[class*='otp'] input",
  "[class*='verification'] input",
];

const VERIFICATION_PAGE_PATTERNS = [
  /verify.{0,20}(email|account|address)/i,
  /confirmation.{0,20}(code|email)/i,
  /check.{0,20}email/i,
  /enter.{0,20}(code|otp)/i,
  /we.{0,10}sent.{0,20}(code|email)/i,
];

export function detectVerificationState(): VerificationState {
  let fieldCount = 0;
  for (const sel of VERIFICATION_SELECTORS) {
    try {
      const els = document.querySelectorAll<HTMLInputElement>(sel);
      for (const el of els) {
        const rect = el.getBoundingClientRect();
        if (rect.width > 0 || rect.height > 0) fieldCount++;
      }
    } catch {}
  }
  if (fieldCount > 0) {
    return { detected: true, fieldCount, message: `Enter verification code (${fieldCount} field${fieldCount > 1 ? "s" : ""})` };
  }

  // Check page text
  const pageText = document.body.textContent ?? "";
  for (const pattern of VERIFICATION_PAGE_PATTERNS) {
    if (pattern.test(pageText)) {
      return { detected: true, fieldCount: 0, message: "Verification required — check your email" };
    }
  }

  return { detected: false, fieldCount: 0, message: "" };
}