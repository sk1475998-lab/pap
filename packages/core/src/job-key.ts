/**
 * Shared canonical job key orchestrator.
 * Provider-specific URL grammar lives in job-key-adapters.ts; this module owns
 * only extractor orchestration and the provider-neutral fallback key.
 */
import { extractProviderJobKey } from "./job-key-adapters.js";

export function canonicalJobKey(url: string, title = "", company = ""): string {
  if (!url) return `empty:${title.slice(0, 40)}:${company.slice(0, 30)}`;

  try {
    const providerKey = extractProviderJobKey(url);
    if (providerKey) return providerKey;

    const urlObj = new URL(url);
    const cleanPath = urlObj.origin + urlObj.pathname.replace(/\/+$/, "");
    const titleSlug = title.slice(0, 40).toLowerCase().replace(/\s+/g, "-");
    const companySlug = company.slice(0, 30).toLowerCase().replace(/\s+/g, "-");
    return `page:${cleanPath}:${titleSlug}:${companySlug}`;
  } catch {
    return `raw:${url.split("?")[0]}:${title.slice(0, 40)}:${company.slice(0, 30)}`;
  }
}
