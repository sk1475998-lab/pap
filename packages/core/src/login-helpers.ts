/** Pure helpers for login / OTP field detection (testable without DOM). */

export const LOGIN_URL_RE = /\/(login|signin|sign-in|auth|account\/login|user\/login)/i;

export const OTP_LABEL_RE =
  /\b(otp|one.?time|verification.?code|verify.?code|2fa|mfa|authenticator|security.?code)\b/i;

export function isLoginUrl(url: string): boolean {
  return LOGIN_URL_RE.test(url);
}

export function looksLikeOtpField(meta: {
  label?: string;
  name?: string;
  id?: string;
  placeholder?: string;
  autocomplete?: string;
  ariaLabel?: string;
  maxLength?: number;
  inputType?: string;
}): boolean {
  if (meta.inputType === "password" || meta.inputType === "file" || meta.inputType === "hidden") {
    return false;
  }
  const ac = (meta.autocomplete ?? "").toLowerCase();
  if (ac.includes("one-time-code") || ac === "otp") return true;
  const blob = `${meta.label ?? ""} ${meta.name ?? ""} ${meta.id ?? ""} ${meta.placeholder ?? ""} ${meta.ariaLabel ?? ""}`.toLowerCase();
  if (OTP_LABEL_RE.test(blob)) return true;
  return (
    (meta.maxLength ?? 0) > 0 &&
    (meta.maxLength ?? 0) <= 8 &&
    /code|otp|pin/i.test(blob)
  );
}

export function normalizeHostname(hostname: string): string {
  return hostname.replace(/^www\./i, "").toLowerCase();
}
