/**
 * CAPTCHA / reCAPTCHA / hCaptcha detector.
 * Returns the type of CAPTCHA detected, or null if none.
 */

export type CaptchaType = "recaptcha" | "hcaptcha" | "cloudflare" | "arkose" | "unknown";

export interface CaptchaDetection {
  detected: boolean;
  type?: CaptchaType;
  element?: Element;
}

const CAPTCHA_CHECKS: Array<{ selector: string; type: CaptchaType }> = [
  { selector: ".g-recaptcha", type: "recaptcha" },
  { selector: "iframe[src*='recaptcha']", type: "recaptcha" },
  { selector: "iframe[title*='reCAPTCHA']", type: "recaptcha" },
  { selector: ".h-captcha", type: "hcaptcha" },
  { selector: "iframe[src*='hcaptcha.com']", type: "hcaptcha" },
  { selector: "[id*='cf-turnstile']", type: "cloudflare" },
  { selector: "[class*='cf-turnstile']", type: "cloudflare" },
  { selector: "iframe[src*='challenges.cloudflare.com']", type: "cloudflare" },
  { selector: "iframe[src*='arkoselabs.com']", type: "arkose" },
  { selector: "iframe[src*='funcaptcha']", type: "arkose" },
];

export function detectCaptcha(): CaptchaDetection {
  for (const { selector, type } of CAPTCHA_CHECKS) {
    try {
      const el = document.querySelector(selector);
      if (el) {
        const rect = el.getBoundingClientRect();
        if (rect.width > 0 || rect.height > 0) return { detected: true, type, element: el };
      }
    } catch {}
  }
  return { detected: false };
}