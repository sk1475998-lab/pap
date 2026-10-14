/**
 * Cross-origin iframe autofill integration.
 *
 * Uses IframeAutofillManager from @superjob/ats-config to handle autofill in
 * cross-origin iframes (common in Workday, Oracle, iCIMS embedded forms).
 *
 * This complements the main autofill.ts which handles same-origin forms.
 */

import {
  IframeAutofillManager,
  type FillResultPayload,
} from "./ats-advanced.js";
import { diagLog } from "./diagnostics.js";
import type { Profile } from "@superjob/core";

/**
 * Result of iframe autofill attempt
 */
export interface IframeAutofillResult {
  iframeSrc: string;
  iframeOrigin: string;
  connected: boolean;
  fieldsFilled: string[];
  failedFields: string[];
  errors: Array<{ field: string; error: string }>;
}

/**
 * Manager instance (lazy-initialized)
 */
let iframeManager: IframeAutofillManager | null = null;

/**
 * Get or create the iframe autofill manager
 */
function getManager(): IframeAutofillManager {
  if (!iframeManager) {
    iframeManager = new IframeAutofillManager({
      handshakeTimeout: 3000,
      fillTimeout: 10000,
    });
    iframeManager.start();
  }
  return iframeManager;
}

/**
 * Build field values from profile
 */
function buildFieldValues(profile: Profile): Record<string, string> {
  const fieldValues: Record<string, string> = {};

  // Map profile fields to common form field names
  if (profile.firstName) {
    fieldValues["first_name"] = profile.firstName;
    fieldValues["firstName"] = profile.firstName;
  }
  if (profile.lastName) {
    fieldValues["last_name"] = profile.lastName;
    fieldValues["lastName"] = profile.lastName;
  }
  if (profile.email) fieldValues["email"] = profile.email;
  if (profile.phone) fieldValues["phone"] = profile.phone;
  if (profile.linkedin) {
    fieldValues["linkedin"] = profile.linkedin;
    fieldValues["linkedin_url"] = profile.linkedin;
  }
  if (profile.github) fieldValues["github"] = profile.github;
  if (profile.website) fieldValues["website"] = profile.website;
  if (profile.location) {
    fieldValues["location"] = profile.location;
  }
  if (profile.city) fieldValues["city"] = profile.city;
  if (profile.state) fieldValues["state"] = profile.state;
  if (profile.country) fieldValues["country"] = profile.country;
  if (profile.address) fieldValues["address"] = profile.address;
  if (profile.addressLine2) fieldValues["address_line_2"] = profile.addressLine2;
  if (profile.pincode) {
    fieldValues["postal_code"] = profile.pincode;
    fieldValues["zip"] = profile.pincode;
  }
  if (profile.workAuthorization) {
    fieldValues["work_authorization"] = profile.workAuthorization;
  }
  if (profile.referralSource) {
    fieldValues["how_did_you_hear"] = profile.referralSource;
    fieldValues["referral_source"] = profile.referralSource;
  }
  for (const [question, answer] of Object.entries(profile.customAnswers)) {
    if (answer.trim()) fieldValues[question] = answer;
  }

  return fieldValues;
}

/**
 * Get the origin of an iframe
 */
function getIframeOrigin(iframe: HTMLIFrameElement): string {
  try {
    const src = new URL(iframe.src, window.location.href);
    return src.origin;
  } catch {
    return "(unknown)";
  }
}

/**
 * Find all iframes on the page and start tracking them
 */
export function trackAllIframes(): HTMLIFrameElement[] {
  const mgr = getManager();
  const iframes = document.querySelectorAll<HTMLIFrameElement>("iframe");
  const tracked: HTMLIFrameElement[] = [];

  for (const iframe of iframes) {
    // Skip iframes without src (about:blank) or with blocked origins
    if (!iframe.src || iframe.src === "about:blank") continue;
    
    mgr.trackIframe(iframe);
    tracked.push(iframe);
  }

  void diagLog("autofill", "iframe-tracking", { message: `Tracking ${tracked.length} iframe(s)` });
  return tracked;
}

/**
 * Attempt to autofill all ready iframes on the page
 */
export async function autofillIframes(profile: Profile): Promise<IframeAutofillResult[]> {
  const results: IframeAutofillResult[] = [];
  const mgr = getManager();
  const fieldValues = buildFieldValues(profile);

  // Track all iframes first
  trackAllIframes();

  // Wait a bit for handshakes to complete
  await new Promise(resolve => setTimeout(resolve, 1000));

  // Get iframes that are ready (handshake completed)
  const readyIframes = mgr.getReadyIframes();
  void diagLog("autofill", "iframe-ready", { message: `${readyIframes.length} iframe(s) ready for autofill` });

  if (readyIframes.length === 0) {
    // Return results for all tracked iframes (none connected)
    const tracked = mgr.getTrackedIframes();
    for (const iframe of tracked) {
      results.push({
        iframeSrc: iframe.src || "(no src)",
        iframeOrigin: getIframeOrigin(iframe),
        connected: false,
        fieldsFilled: [],
        failedFields: [],
        errors: [{ field: "*", error: "Handshake not completed" }],
      });
    }
    return results;
  }

  // Fill each ready iframe
  for (const iframe of readyIframes) {
    const result: IframeAutofillResult = {
      iframeSrc: iframe.src || "(no src)",
      iframeOrigin: getIframeOrigin(iframe),
      connected: true,
      fieldsFilled: [],
      failedFields: [],
      errors: [],
    };

    try {
      const fillResult: FillResultPayload = await mgr.fillIframe(iframe, fieldValues, {
        timeout: 10000,
        autoSubmit: false,
      });
      
      result.fieldsFilled = fillResult.filledFields;
      result.failedFields = fillResult.failedFields;
      result.errors = fillResult.errors;
      
      void diagLog("autofill", "iframe-fill-success", { message: `Filled ${fillResult.filledFields.length} fields in ${result.iframeSrc}` });
    } catch (err) {
      result.errors.push({
        field: "*",
        error: `Fill failed: ${err instanceof Error ? err.message : String(err)}`,
      });
      void diagLog("autofill", "iframe-fill-failed", { level: "warn", message: `Fill failed for ${result.iframeSrc}: ${err}` });
    }

    results.push(result);
  }

  return results;
}

/**
 * Check if there are any tracked iframes on the page
 */
export function hasTrackedIframes(): boolean {
  const mgr = getManager();
  return mgr.getTrackedIframes().length > 0;
}

/**
 * Get count of tracked iframes
 */
export function getTrackedIframeCount(): number {
  const mgr = getManager();
  return mgr.getTrackedIframes().length;
}

/**
 * Get count of ready (handshake completed) iframes
 */
export function getReadyIframeCount(): number {
  const mgr = getManager();
  return mgr.getReadyIframes().length;
}

/**
 * Clean up the manager
 */
export function destroyIframeAutofill(): void {
  if (iframeManager) {
    iframeManager.stop();
    iframeManager = null;
  }
}
