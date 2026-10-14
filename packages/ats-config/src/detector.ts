/**
 * ATS Platform Detector
 * Detects which ATS platform a job application page uses based on URL patterns,
 * DOM selectors, page content analysis, and site registry matching.
 *
 * Detection strategy (cascading, highest confidence wins):
 * 1. Site registry domain match (fastest — O(1) hostname lookup)
 * 2. Site registry URL path regex match
 * 3. Site registry query parameter detection
 * 4. Site registry page source keyword detection
 * 5. ATSConfig URL pattern matching (wildcard patterns)
 * 6. ATSConfig keyword analysis (fallback)
 * 7. Iframe domain matching (for embedded forms)
 */
import type { ATSConfig, DetectionResult, SelectorStrategy } from "./schemas.js";
import {
  SITE_REGISTRY,
  isDomainMatch,
  matchesAnyDomain,
  type SiteRegistryEntry,
} from "./site-registry.js";

/** Detector configuration */
export interface DetectorOptions {
  /** All loaded ATS configs */
  configs: ATSConfig[];
  /** Timeout for selector detection (ms) */
  selectorTimeout?: number;
  /** Whether to use keyword detection */
  enableKeywordDetection?: boolean;
}

/** Detection context passed from content script */
export interface DetectionContext {
  url: string;
  title?: string;
  bodyText?: string;
  html?: string;
}

/**
 * Detect which ATS platform the current page uses.
 * Uses a cascading detection strategy combining site registry and config-based detection.
 */
export function detectPlatform(
  context: DetectionContext,
  configs: ATSConfig[]
): DetectionResult {
  const activeConfigs = configs.filter((c) => c.active);
  let hostname: string;
  try {
    hostname = new URL(context.url).hostname;
  } catch {
    hostname = "";
  }

  // ── Phase 1: Site registry domain match (fastest, highest confidence) ──
  const registryDomainMatch = matchRegistryDomain(hostname, context.url);
  if (registryDomainMatch) {
    // Try to find a matching ATSConfig for this registry entry
    const config = findConfigForPlatform(registryDomainMatch.key, activeConfigs);
    return {
      platform: registryDomainMatch.key,
      confidence: 0.95,
      config,
      matchedUrl: context.url,
    };
  }

  // ── Phase 2: Site registry URL path regex match ──
  const registryUrlMatch = matchRegistryUrlRegex(context.url);
  if (registryUrlMatch) {
    const config = findConfigForPlatform(registryUrlMatch.key, activeConfigs);
    return {
      platform: registryUrlMatch.key,
      confidence: 0.9,
      config,
      matchedUrl: context.url,
    };
  }

  // ── Phase 3: Site registry query parameter detection ──
  const registryQueryParamMatch = matchRegistryQueryParams(context.url);
  if (registryQueryParamMatch) {
    const config = findConfigForPlatform(registryQueryParamMatch.key, activeConfigs);
    return {
      platform: registryQueryParamMatch.key,
      confidence: 0.85,
      config,
      matchedUrl: context.url,
    };
  }

  // ── Phase 4: Site registry page source keyword detection ──
  if (context.html) {
    const registrySourceMatch = matchRegistryPageSource(context.html);
    if (registrySourceMatch) {
      const config = findConfigForPlatform(registrySourceMatch.key, activeConfigs);
      return {
        platform: registrySourceMatch.key,
        confidence: 0.8,
        config,
        matchedUrl: context.url,
      };
    }
  }

  // ── Phase 5: ATSConfig URL pattern matching (wildcard patterns) ──
  const urlMatch = matchUrlPatterns(context.url, activeConfigs);
  if (urlMatch.confidence >= 0.7) {
    return {
      platform: urlMatch.config!.platformId,
      confidence: urlMatch.confidence,
      config: urlMatch.config,
      matchedUrl: urlMatch.matchedPattern,
    };
  }

  // ── Phase 6: Iframe domain matching ──
  const iframeMatch = matchRegistryIframeDomain(hostname);
  if (iframeMatch) {
    const config = findConfigForPlatform(iframeMatch.key, activeConfigs);
    return {
      platform: iframeMatch.key,
      confidence: 0.75,
      config,
      matchedUrl: context.url,
    };
  }

  // ── Phase 7: ATSConfig keyword detection (fallback) ──
  if (context.bodyText) {
    const keywordMatch = matchKeywords(context.bodyText, activeConfigs);
    if (keywordMatch.confidence > 0.5) {
      return keywordMatch;
    }
  }

  // ── Phase 8: Return best URL match if any ──
  if (urlMatch.confidence > 0) {
    return {
      platform: urlMatch.config!.platformId,
      confidence: urlMatch.confidence,
      config: urlMatch.config,
      matchedUrl: urlMatch.matchedPattern,
    };
  }

  // No platform detected
  return {
    platform: null,
    confidence: 0,
    config: null,
  };
}

/**
 * Match hostname against site registry domain entries.
 */
function matchRegistryDomain(
  hostname: string,
  _fullUrl: string
): { key: string; entry: SiteRegistryEntry } | null {
  if (!hostname) return null;
  for (const [key, entry] of Object.entries(SITE_REGISTRY)) {
    if (entry.domains?.some((d) => isDomainMatch(hostname, d))) {
      return { key, entry };
    }
  }
  return null;
}

/**
 * Match URL against site registry urlRegex patterns.
 */
function matchRegistryUrlRegex(
  url: string
): { key: string; entry: SiteRegistryEntry } | null {
  for (const [key, entry] of Object.entries(SITE_REGISTRY)) {
    if (entry.urlRegex) {
      try {
        if (new RegExp(entry.urlRegex, "i").test(url)) {
          return { key, entry };
        }
      } catch {
        // Invalid regex, skip
      }
    }
    if (entry.pathRegex) {
      try {
        const pathname = new URL(url).pathname;
        if (new RegExp(entry.pathRegex, "i").test(pathname)) {
          return { key, entry };
        }
      } catch {
        // Invalid URL or regex, skip
      }
    }
  }
  return null;
}

/**
 * Match URL query parameters against site registry queryParams.
 */
function matchRegistryQueryParams(
  url: string
): { key: string; entry: SiteRegistryEntry } | null {
  try {
    const params = new URL(url).searchParams;
    for (const [key, entry] of Object.entries(SITE_REGISTRY)) {
      if (entry.queryParams?.length) {
        for (const qp of entry.queryParams) {
          if (params.has(qp)) {
            return { key, entry };
          }
        }
      }
    }
  } catch {
    // Invalid URL
  }
  return null;
}

/**
 * Match page HTML source against site registry pageSourceKeyword entries.
 */
function matchRegistryPageSource(
  html: string
): { key: string; entry: SiteRegistryEntry } | null {
  const lowerHtml = html.toLowerCase();
  for (const [key, entry] of Object.entries(SITE_REGISTRY)) {
    if (entry.pageSourceKeyword) {
      if (lowerHtml.includes(entry.pageSourceKeyword.toLowerCase())) {
        return { key, entry };
      }
    }
  }
  return null;
}

/**
 * Match hostname against site registry iframeDomains.
 */
function matchRegistryIframeDomain(
  hostname: string
): { key: string; entry: SiteRegistryEntry } | null {
  if (!hostname) return null;
  for (const [key, entry] of Object.entries(SITE_REGISTRY)) {
    if (entry.iframeDomains?.some((d) => isDomainMatch(hostname, d))) {
      return { key, entry };
    }
  }
  return null;
}

/**
 * Find an ATSConfig that matches a registry platform key.
 * Matches by platformId or by checking if the key appears in urlPatterns.
 */
function findConfigForPlatform(
  platformKey: string,
  configs: ATSConfig[]
): ATSConfig | null {
  // Direct platformId match
  const direct = configs.find(
    (c) => c.platformId === platformKey || c.platformId === platformKey.toLowerCase()
  );
  if (direct) return direct;

  // Fuzzy match: check if platformKey is contained in platformId
  // Use stricter matching: require at least 4 chars and significant overlap
  const fuzzy = configs.find((c) => {
    const keyLower = platformKey.toLowerCase();
    const idLower = c.platformId.toLowerCase();
    // Require minimum length to avoid false positives (e.g., "work" matching "workday")
    if (keyLower.length < 4 || idLower.length < 4) return false;
    // Require the shorter string to be at least 50% of the longer string
    const shorter = Math.min(keyLower.length, idLower.length);
    const longer = Math.max(keyLower.length, idLower.length);
    if (shorter / longer < 0.5) return false;
    return idLower.includes(keyLower) || keyLower.includes(idLower);
  });
  return fuzzy ?? null;
}

/**
 * Match URL against all config URL patterns.
 */
function matchUrlPatterns(
  url: string,
  configs: ATSConfig[]
): { config: ATSConfig | null; confidence: number; matchedPattern?: string } {
  let bestMatch: ATSConfig | null = null;
  let bestConfidence = 0;
  let bestPattern: string | undefined;

  for (const config of configs) {
    for (const pattern of config.urlPatterns) {
      const confidence = matchUrlPattern(url, pattern);
      if (confidence > bestConfidence) {
        bestMatch = config;
        bestConfidence = confidence;
        bestPattern = pattern;
      }
    }
  }

  return {
    config: bestMatch,
    confidence: bestConfidence,
    matchedPattern: bestPattern,
  };
}

/**
 * Match a single URL against a pattern.
 * Supports wildcards: * (any chars), ? (single char)
 * Returns confidence score 0-1.
 */
function matchUrlPattern(url: string, pattern: string): number {
  // Exact match
  if (url === pattern) return 1;

  // Convert pattern to regex
  const regexStr = pattern
    .replace(/[.+^${}()|[\]\\]/g, "\\$&") // Escape special regex chars
    .replace(/\*/g, ".*") // * -> .*
    .replace(/\?/g, "."); // ? -> .

  try {
    const regex = new RegExp(`^${regexStr}$`, "i");
    if (regex.test(url)) {
      // Higher confidence for more specific patterns (longer patterns)
      const specificity = Math.min(1, pattern.length / 50);
      return 0.7 + specificity * 0.3;
    }
  } catch {
    // Invalid pattern, skip
  }

  return 0;
}

/**
 * Match page content against detection keywords.
 */
function matchKeywords(
  bodyText: string,
  configs: ATSConfig[]
): DetectionResult {
  let bestMatch: ATSConfig | null = null;
  let bestScore = 0;

  const lowerText = bodyText.toLowerCase();

  for (const config of configs) {
    if (!config.detectionKeywords?.length) continue;

    let matches = 0;
    for (const keyword of config.detectionKeywords) {
      if (lowerText.includes(keyword.toLowerCase())) {
        matches++;
      }
    }

    const score = matches / config.detectionKeywords.length;
    if (score > bestScore) {
      bestScore = score;
      bestMatch = config;
    }
  }

  return {
    platform: bestMatch?.platformId ?? null,
    confidence: bestScore,
    config: bestMatch,
  };
}

/**
 * Check if a selector exists in the DOM.
 * This is a helper for browser environments.
 */
export function selectorExists(selector: SelectorStrategy): boolean {
  if (typeof document === "undefined") return false;

  switch (selector.type) {
    case "css":
      return document.querySelector(selector.value) !== null;
    case "id":
      return document.getElementById(selector.value) !== null;
    case "name":
      return document.querySelector(`[name="${CSS.escape(selector.value)}"]`) !== null;
    case "placeholder":
      return (
        document.querySelector(`[placeholder*="${CSS.escape(selector.value)}"]`) !== null
      );
    case "aria":
      return (
        document.querySelector(`[aria-label*="${CSS.escape(selector.value)}"]`) !== null
        || document.querySelector(`[aria-labelledby*="${CSS.escape(selector.value)}"]`) !== null
      );
    case "data":
      // Match common data-* attributes used by modern frontends
      return document.querySelector(
        `[data-name*="${CSS.escape(selector.value)}"], ` +
        `[data-field*="${CSS.escape(selector.value)}"], ` +
        `[data-key*="${CSS.escape(selector.value)}"], ` +
        `[data-automation-id*="${CSS.escape(selector.value)}"], ` +
        `[data-automation*="${CSS.escape(selector.value)}"], ` +
        `[data-qe*="${CSS.escape(selector.value)}"]`
      ) !== null;
    case "testid":
      return (
        document.querySelector(`[data-testid*="${CSS.escape(selector.value)}"]`) !== null
        || document.querySelector(`[data-test*="${CSS.escape(selector.value)}"]`) !== null
        || document.querySelector(`[data-qa*="${CSS.escape(selector.value)}"]`) !== null
        || document.querySelector(`[data-cy*="${CSS.escape(selector.value)}"]`) !== null
      );
    case "xpath":
      try {
        const result = document.evaluate(
          selector.value,
          document,
          null,
          XPathResult.FIRST_ORDERED_NODE_TYPE,
          null
        );
        return result.singleNodeValue !== null;
      } catch {
        return false;
      }
    case "label":
      // Find label containing text, then check if associated input exists
      const labels = document.querySelectorAll("label");
      for (const label of labels) {
        if (label.textContent?.toLowerCase().includes(selector.value.toLowerCase())) {
          const forId = label.getAttribute("for");
          if (forId && document.getElementById(forId)) return true;
          if (label.querySelector("input, select, textarea")) return true;
        }
      }
      return false;
    default:
      return false;
  }
}

/**
 * Find element using multiple selector strategies.
 * Returns the element and which strategy found it.
 */
export function findElement(
  selectors: SelectorStrategy[]
): { element: Element; strategy: SelectorStrategy } | null {
  // Sort by priority (higher priority first)
  const sorted = [...selectors].sort((a, b) => b.priority - a.priority);

  for (const strategy of sorted) {
    const element = findElementByStrategy(strategy);
    if (element) {
      return { element, strategy };
    }
  }

  return null;
}

function findElementByStrategy(strategy: SelectorStrategy): Element | null {
  if (typeof document === "undefined") return null;

  switch (strategy.type) {
    case "css":
      return document.querySelector(strategy.value);
    case "id":
      return document.getElementById(strategy.value);
    case "name":
      return document.querySelector(`[name="${CSS.escape(strategy.value)}"]`);
    case "placeholder":
      return document.querySelector(`[placeholder*="${CSS.escape(strategy.value)}"]`);
    case "aria":
      return (
        document.querySelector(`[aria-label*="${CSS.escape(strategy.value)}"]`)
        || document.querySelector(`[aria-labelledby*="${CSS.escape(strategy.value)}"]`)
      );
    case "data":
      return document.querySelector(
        `[data-name*="${CSS.escape(strategy.value)}"], ` +
        `[data-field*="${CSS.escape(strategy.value)}"], ` +
        `[data-key*="${CSS.escape(strategy.value)}"], ` +
        `[data-automation-id*="${CSS.escape(strategy.value)}"], ` +
        `[data-automation*="${CSS.escape(strategy.value)}"], ` +
        `[data-qe*="${CSS.escape(strategy.value)}"]`
      );
    case "testid":
      return (
        document.querySelector(`[data-testid*="${CSS.escape(strategy.value)}"]`)
        || document.querySelector(`[data-test*="${CSS.escape(strategy.value)}"]`)
        || document.querySelector(`[data-qa*="${CSS.escape(strategy.value)}"]`)
        || document.querySelector(`[data-cy*="${CSS.escape(strategy.value)}"]`)
      );
    case "xpath":
      try {
        const result = document.evaluate(
          strategy.value,
          document,
          null,
          XPathResult.FIRST_ORDERED_NODE_TYPE,
          null
        );
        return result.singleNodeValue as Element | null;
      } catch {
        return null;
      }
    case "label":
      const labels = document.querySelectorAll("label");
      for (const label of labels) {
        if (label.textContent?.toLowerCase().includes(strategy.value.toLowerCase())) {
          const forId = label.getAttribute("for");
          if (forId) {
            const input = document.getElementById(forId);
            if (input) return input;
          }
          const nested = label.querySelector("input, select, textarea");
          if (nested) return nested;
        }
      }
      return null;
    default:
      return null;
  }
}
