/**
 * Auth automation service.
 *
 * Orchestrates sign-in, sign-up, email alias rotation, and CAPTCHA/OTP
 * detection for enterprise ATS platforms.
 *
 * Storage: Credentials stored only in chrome.storage.session (never synced).
 */
import { diagLog } from "@/lib/diagnostics.js";
import { detectCaptcha } from "./recaptcha-detector.js";
import { isSignInPage, fillSignInForm, hasWrongCredentialsError } from "./sign-in-handler.js";
import { isSignUpPage, fillSignUpForm } from "./sign-up-handler.js";
import { detectVerificationState } from "./verification-handler.js";
import {
  generateEmailAlias,
  generatePassword,
  getCredentialForAts,
  storeCredential,
} from "./credential-generator.js";
import { rotateAlias, canRotateAlias } from "./email-alias-manager.js";
import type { Profile } from "@superjob/core";

export type AuthMode = "sign-in" | "sign-up" | "verify" | "captcha" | "none";

export interface AuthResult {
  /** Whether the auth flow succeeded or was handled. */
  success: boolean;
  /** What auth mode was detected. */
  mode: AuthMode;
  /** True if the autopilot should pause for user action. */
  needsUserAction: boolean;
  message?: string;
}

export interface AuthServiceOptions {
  atsName: string;
  autoSubmit?: boolean;
}

export class AuthService {
  /**
   * Process the current page for auth requirements.
   * Should be called before entity processing in the autopilot loop.
   */
  async process(profile: Profile, options: AuthServiceOptions): Promise<AuthResult> {
    const { atsName, autoSubmit = true } = options;

    // 1. CAPTCHA — always check first
    const captcha = detectCaptcha();
    if (captcha.detected) {
      void diagLog("auth", "captcha-detected", { data: { type: captcha.type, ats: atsName } });
      return { success: false, mode: "captcha", needsUserAction: true, message: `CAPTCHA detected (${captcha.type})` };
    }

    // 2. Verification / OTP
    const verification = detectVerificationState();
    if (verification.detected) {
      void diagLog("auth", "verification-detected", { data: { ats: atsName } });
      return { success: false, mode: "verify", needsUserAction: true, message: verification.message };
    }

    // 3. Sign-in
    if (isSignInPage()) {
      return this.handleSignIn(profile, atsName, autoSubmit);
    }

    // 4. Sign-up
    if (isSignUpPage()) {
      return this.handleSignUp(profile, atsName, autoSubmit);
    }

    return { success: true, mode: "none", needsUserAction: false };
  }

  private async handleSignIn(profile: Profile, atsName: string, autoSubmit: boolean): Promise<AuthResult> {
    // Check for stored credentials for this ATS
    let cred = await getCredentialForAts(atsName);

    // Fall back to profile defaults
    if (!cred && profile.defaultLoginEmail && profile.defaultLoginPassword) {
      cred = {
        email: profile.defaultLoginEmail,
        password: profile.defaultLoginPassword,
        alias: profile.defaultLoginEmail,
        atsName,
        createdAt: Date.now(),
      };
    }

    if (!cred) {
      void diagLog("auth", "no-credentials", { data: { ats: atsName } });
      return { success: false, mode: "sign-in", needsUserAction: true, message: "No credentials found for this ATS" };
    }

    const result = await fillSignInForm(cred.email, cred.password, { autoSubmit });
    void diagLog("auth", "sign-in-attempted", { data: { ats: atsName, filled: result.filled } });

    if (result.filled) {
      // Check for wrong credentials after a brief wait
      await new Promise((r) => setTimeout(r, 1500));
      if (hasWrongCredentialsError() && canRotateAlias(atsName) && profile.defaultLoginEmail) {
        const newAlias = rotateAlias(profile.defaultLoginEmail, atsName);
        if (newAlias) {
          void diagLog("auth", "rotating-alias", { data: { ats: atsName, newAlias } });
          const retryResult = await fillSignInForm(newAlias, cred.password, { autoSubmit });
          return { success: retryResult.submitted, mode: "sign-in", needsUserAction: !retryResult.submitted, message: retryResult.reason };
        }
      }
    }

    return { success: result.submitted, mode: "sign-in", needsUserAction: !result.submitted, message: result.reason };
  }

  private async handleSignUp(profile: Profile, atsName: string, autoSubmit: boolean): Promise<AuthResult> {
    // Check if we already have credentials for this ATS
    let cred = await getCredentialForAts(atsName);

    if (!cred) {
      if (profile.defaultLoginEmail && profile.defaultLoginPassword) {
        cred = {
          email: profile.defaultLoginEmail,
          password: profile.defaultLoginPassword,
          alias: profile.defaultLoginEmail,
          atsName,
          createdAt: Date.now(),
        };
      } else {
        // Generate fresh credentials
        const baseEmail = profile.email || "";
        if (!baseEmail) {
          return { success: false, mode: "sign-up", needsUserAction: true, message: "No base email in profile" };
        }
        const email = generateEmailAlias(baseEmail, atsName);
        const password = generatePassword(atsName);
        cred = { email, password, alias: email, atsName, createdAt: Date.now() };
        await storeCredential(cred);
      }
    }

    const result = await fillSignUpForm(profile, cred.email, cred.password, { autoSubmit });
    void diagLog("auth", "sign-up-attempted", { data: { ats: atsName, filled: result.filled } });
    return { success: result.submitted, mode: "sign-up", needsUserAction: !result.submitted, message: result.reason };
  }
}

/** Singleton auth service. */
export const authService = new AuthService();