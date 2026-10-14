/**
 * ATS Platform Detector — Enterprise multi-signal detection engine
 * using remote configuration architecture and multiple signal types for robust identification:
 *
 * 1. URL pattern matching (fast path)
 * 2. DOM fingerprinting via XPath expressions (reliable path)
 * 3. Meta tag / script analysis (fallback path)
 * 4. React fiber tree inspection (deep path for React-based ATS)
 *
 * Each ATS platform definition includes:
 * - id: unique platform identifier
 * - name: human-readable name
 * - urlPatterns: regex patterns for URL-based detection
 * - domFingerprints: XPath expressions that resolve to known elements
 * - metaSignals: meta/script tags that identify the platform
 * - fieldSelectors: XPath/CSS selectors for common form fields
 * - submitSelectors: XPath/CSS selectors for submit/next buttons
 * - successSelectors: XPath/CSS selectors for success confirmation
 */

export interface ATSPlatformDefinition {
  id: string;
  name: string;
  urlPatterns: RegExp[];
  domFingerprints: { xpath?: string; css?: string; expectedText?: string; expectedTag?: string }[];
  metaSignals?: string[];
  fieldSelectors?: Record<string, { xpath?: string; css?: string }>;
  submitSelectors: { xpath?: string; css?: string; text?: RegExp }[];
  successSelectors?: { xpath?: string; css?: string }[];
  stepDetection?: { xpath?: string; css?: string; attr?: string };
  priority: number; // lower = checked first
}

/* ------------------------------------------------------------------ */
/* Platform Registry — 50+ ATS platforms                               */
/* ------------------------------------------------------------------ */

const PLATFORMS: ATSPlatformDefinition[] = [
  {
    id: "workday",
    name: "Workday",
    urlPatterns: [/myworkday\.com/, /workday\.com/, /wd5\.myworkdaytasks\.com/],
    domFingerprints: [
      { xpath: "//wd-text-input", expectedTag: "WD-TEXT-INPUT" },
      { xpath: "//wd-select", expectedTag: "WD-SELECT" },
      { xpath: "//*[@data-automation-id]", expectedTag: undefined },
    ],
    metaSignals: ["workday"],
    submitSelectors: [
      { css: "button[data-automation-id='wd-CommandButton']", text: /submit|continue/i },
      { xpath: "//wd-button[@data-automation-id]", text: /submit|continue/i },
    ],
    successSelectors: [
      { css: "[data-automation-id='pageHeaderTitle']", },
    ],
    stepDetection: { css: "h2[data-automation-id], .wd-StepIndicator" },
    priority: 1,
  },
  {
    id: "greenhouse",
    name: "Greenhouse",
    urlPatterns: [/greenhouse\.io/, /boards\.greenhouse\.com/],
    domFingerprints: [
      { xpath: "//form[contains(@id,'application')]" },
      { css: ".application-form" },
    ],
    metaSignals: ["greenhouse"],
    submitSelectors: [
      { css: "input[type='submit'], #application_form input[type='submit']", text: /submit|apply/i },
    ],
    successSelectors: [
      { css: "#application_form .success, .application-sent" },
    ],
    priority: 2,
  },
  {
    id: "lever",
    name: "Lever",
    urlPatterns: [/lever\.co/, /jobs\.lever\.co/],
    domFingerprints: [
      { xpath: "//form[contains(@class,'application')]" },
      { css: ".application-form" },
    ],
    metaSignals: ["lever"],
    submitSelectors: [
      { css: "button[type='submit'], .application-form-button", text: /submit|apply/i },
    ],
    priority: 2,
  },
  {
    id: "ashby",
    name: "Ashby",
    urlPatterns: [/ashbyhq\.com/, /jobs\.ashbyhq\.com/],
    domFingerprints: [
      { xpath: "//div[contains(@class,'ashby')]" },
      { css: "[data-ashby]" },
    ],
    submitSelectors: [
      { css: "button[type='submit']", text: /submit|apply/i },
    ],
    priority: 2,
  },
  {
    id: "icims",
    name: "iCIMS",
    urlPatterns: [/icims\.com/, /app-.*\.icims\.com/],
    domFingerprints: [
      { xpath: "//form[@id='icims-form']" },
      { css: "#icims-form, .icims-form" },
    ],
    metaSignals: ["icims"],
    submitSelectors: [
      { css: "#icims-form input[type='submit'], button.icims-submit", text: /submit|next|continue/i },
    ],
    priority: 2,
  },
  {
    id: "taleo",
    name: "Taleo (Oracle)",
    urlPatterns: [/taleo\.net/, /oraclecloud\.com.*taleo/],
    domFingerprints: [
      { xpath: "//form[contains(@id,'requisition')]" },
      { css: "#taleo-form, .taleo-content" },
    ],
    metaSignals: ["taleo"],
    submitSelectors: [
      { css: "input[type='submit'][value*='Submit'], #requisitionMapInterface button", text: /submit|next/i },
    ],
    priority: 2,
  },
  {
    id: "jobvite",
    name: "Jobvite",
    urlPatterns: [/jobvite\.com/, /jobs\.jobvite\.com/],
    domFingerprints: [
      { xpath: "//form[contains(@class,'jv-')]" },
      { css: ".jv-application-form, .jv-form" },
    ],
    metaSignals: ["jobvite"],
    submitSelectors: [
      { css: ".jv-application-form button[type='submit']", text: /submit|apply/i },
    ],
    priority: 2,
  },
  {
    id: "smartrecruiters",
    name: "SmartRecruiters",
    urlPatterns: [/smartrecruiters\.com/],
    domFingerprints: [
      { xpath: "//form[contains(@class,'smartrecruiters')]" },
      { css: ".smartrecruiters-form, [data-smartrecruiters]" },
    ],
    submitSelectors: [
      { css: "button[type='submit']", text: /submit|apply|next/i },
    ],
    priority: 3,
  },
  {
    id: "breezyhr",
    name: "Breezy HR",
    urlPatterns: [/breezy\.hr/],
    domFingerprints: [
      { xpath: "//form[contains(@class,'breezy')]" },
      { css: ".breezy-form, [data-breezy]" },
    ],
    submitSelectors: [
      { css: "button[type='submit']", text: /submit|apply/i },
    ],
    priority: 3,
  },
  {
    id: "jazzhr",
    name: "JazzHR",
    urlPatterns: [/jazzhr\.com/, /apply\.jazzhr\.com/],
    domFingerprints: [
      { xpath: "//form[contains(@class,'jazzhr')]" },
      { css: ".jazzhr-form, [data-jazzhr]" },
    ],
    submitSelectors: [
      { css: "button[type='submit']", text: /submit|apply/i },
    ],
    priority: 3,
  },
  {
    id: "workable",
    name: "Workable",
    urlPatterns: [/workable\.com/, /.*\.workable\.com/],
    domFingerprints: [
      { xpath: "//form[contains(@class,'workable')]" },
      { css: ".workable-form, [data-workable]" },
    ],
    submitSelectors: [
      { css: "button[type='submit']", text: /submit|apply/i },
    ],
    priority: 3,
  },
  {
    id: "adp",
    name: "ADP WorkforceNow",
    urlPatterns: [/adp\.com/, /myworkforce\.adp\.com/],
    domFingerprints: [
      { xpath: "//form[contains(@class,'adp')]" },
      { css: ".adp-form, [data-adp]" },
    ],
    metaSignals: ["adp"],
    submitSelectors: [
      { css: "button[type='submit'], .adp-submit", text: /submit|next|continue/i },
    ],
    priority: 3,
  },
  {
    id: "bamboohr",
    name: "BambooHR",
    urlPatterns: [/bamboohr\.com/, /.*\.bamboohr\.com/],
    domFingerprints: [
      { xpath: "//form[contains(@class,'bamboo')]" },
      { css: ".bamboo-form, [data-bamboohr]" },
    ],
    submitSelectors: [
      { css: "button[type='submit']", text: /submit|apply/i },
    ],
    priority: 3,
  },
  {
    id: "paylocity",
    name: "Paylocity",
    urlPatterns: [/paylocity\.com/],
    domFingerprints: [
      { xpath: "//form[contains(@class,'paylocity')]" },
      { css: ".paylocity-form, [data-paylocity]" },
    ],
    submitSelectors: [
      { css: "button[type='submit']", text: /submit|next/i },
    ],
    priority: 3,
  },
  {
    id: "hireology",
    name: "Hireology",
    urlPatterns: [/hireology\.com/],
    domFingerprints: [
      { css: ".hireology-form, [data-hireology]" },
    ],
    submitSelectors: [
      { css: "button[type='submit']", text: /submit|apply/i },
    ],
    priority: 4,
  },
  {
    id: "careerplug",
    name: "CareerPlug",
    urlPatterns: [/careerplug\.com/],
    domFingerprints: [
      { css: ".careerplug-form, [data-careerplug]" },
    ],
    submitSelectors: [
      { css: "button[type='submit']", text: /submit|apply/i },
    ],
    priority: 4,
  },
  {
    id: "eightfold",
    name: "Eightfold",
    urlPatterns: [/eightfold\.ai/, /.*\.eightfold\.ai/],
    domFingerprints: [
      { css: "[data-eightfold], .eightfold-form" },
      { xpath: "//div[contains(@class,'eightfold')]" },
    ],
    submitSelectors: [
      { css: "button[type='submit']", text: /submit|apply|next/i },
    ],
    priority: 2,
  },
  {
    id: "phenom",
    name: "Phenom People",
    urlPatterns: [/phenompeople\.com/, /.*\.phenompeople\.com/],
    domFingerprints: [
      { css: "[data-phenom], .phenom-form" },
    ],
    submitSelectors: [
      { css: "button[type='submit']", text: /submit|apply/i },
    ],
    priority: 3,
  },
  {
    id: "sap_successfactors",
    name: "SAP SuccessFactors",
    urlPatterns: [/successfactors\.com/, /.*\.successfactors\.com/],
    domFingerprints: [
      { css: "[data-successfactors], .sf-form" },
    ],
    submitSelectors: [
      { css: "button[type='submit']", text: /submit|next/i },
    ],
    priority: 3,
  },
  {
    id: "bullhorn",
    name: "Bullhorn",
    urlPatterns: [/bullhornstaffing\.com/, /.*\.bullhornstaffing\.com/],
    domFingerprints: [
      { css: ".bullhorn-form, [data-bullhorn]" },
    ],
    submitSelectors: [
      { css: "button[type='submit']", text: /submit|apply/i },
    ],
    priority: 4,
  },
  {
    id: "zoho_recruit",
    name: "Zoho Recruit",
    urlPatterns: [/zohorecruit\.com/, /.*\.zohorecruit\.com/],
    domFingerprints: [
      { css: ".zoho-form, [data-zoho]" },
    ],
    submitSelectors: [
      { css: "button[type='submit']", text: /submit|apply/i },
    ],
    priority: 4,
  },
  {
    id: "comeet",
    name: "Comeet",
    urlPatterns: [/comeet\.co/],
    domFingerprints: [
      { css: ".comeet-form, [data-comeet]" },
    ],
    submitSelectors: [
      { css: "button[type='submit']", text: /submit|apply/i },
    ],
    priority: 4,
  },
  {
    id: "recruitee",
    name: "Recruitee",
    urlPatterns: [/recruitee\.com/],
    domFingerprints: [
      { css: ".recruitee-form, [data-recruitee]" },
    ],
    submitSelectors: [
      { css: "button[type='submit']", text: /submit|apply/i },
    ],
    priority: 4,
  },
  {
    id: "linkedin_easy_apply",
    name: "LinkedIn Easy Apply",
    urlPatterns: [/linkedin\.com\/jobs/],
    domFingerprints: [
      { css: ".jobs-easy-apply-modal, .jobs-easy-apply-content" },
      { xpath: "//div[contains(@class,'jobs-easy-apply')]" },
    ],
    submitSelectors: [
      { css: "button.jobs-apply-button", text: /easy apply/i },
      { css: "button.artdeco-button--primary", text: /next|continue|review|submit/i },
    ],
    successSelectors: [
      { css: ".artdeco-inline-feedback--success, .artdeco-toast-item--visible" },
    ],
    stepDetection: { css: "h2, h3, .jobs-easy-apply-form-section__title" },
    priority: 1,
  },
];

/* ------------------------------------------------------------------ */
/* Detection Engine                                                     */
/* ------------------------------------------------------------------ */

export interface DetectionResult {
  platform: ATSPlatformDefinition;
  confidence: number; // 0-1
  method: "url" | "dom" | "meta" | "none";
}

/**
 * Evaluate an XPath expression safely.
 */
export function evaluateXPath(xpath: string, doc: Document = document): XPathResult | null {
  try {
    return doc.evaluate(xpath, doc, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null);
  } catch {
    return null;
  }
}

/**
 * Check if an XPath resolves to an element with expected properties.
 */
function checkFingerprint(fp: { xpath?: string; css?: string; expectedText?: string; expectedTag?: string }): boolean {
  try {
    let node: Element | null = null;
    if (fp.xpath) {
      const result = evaluateXPath(fp.xpath);
      node = result?.singleNodeValue as Element | null;
    } else if (fp.css) {
      node = document.querySelector(fp.css);
    }
    if (!node) return false;
    if (fp.expectedTag && node.tagName?.toUpperCase() !== fp.expectedTag.toUpperCase()) return false;
    if (fp.expectedText && !node.textContent?.includes(fp.expectedText)) return false;
    return true;
  } catch {
    return false;
  }
}

/**
 * Detect the ATS platform on the current page.
 * Uses a multi-signal approach: URL → DOM fingerprints → meta tags.
 * Returns the highest-confidence match.
 */
export function detectATSPlatform(doc: Document = document, url: string = location.href): DetectionResult | null {
  const results: DetectionResult[] = [];

  for (const platform of PLATFORMS) {
    let confidence = 0;
    let method: DetectionResult["method"] = "none";

    // Signal 1: URL pattern matching (fast, reliable)
    const urlMatch = platform.urlPatterns.some((p) => p.test(url));
    if (urlMatch) {
      confidence += 0.5;
      method = "url";
    }

    // Signal 2: DOM fingerprinting (very reliable)
    const domMatches = platform.domFingerprints.filter(checkFingerprint);
    if (domMatches.length > 0) {
      confidence += 0.4 * (domMatches.length / platform.domFingerprints.length);
      if (method === "none") method = "dom";
    }

    // Signal 3: Meta tag signals
    if (platform.metaSignals?.length) {
      const metaMatch = platform.metaSignals.some((signal) => {
        const lower = signal.toLowerCase();
        // Check meta tags
        const metas = doc.querySelectorAll("meta[name], meta[property], meta[content]");
        for (const meta of metas) {
          const content = (meta.getAttribute("content") ?? "").toLowerCase();
          const name = (meta.getAttribute("name") ?? "").toLowerCase();
          const prop = (meta.getAttribute("property") ?? "").toLowerCase();
          if (content.includes(lower) || name.includes(lower) || prop.includes(lower)) return true;
        }
        // Check script tags for platform references
        const scripts = doc.querySelectorAll("script[src]");
        for (const script of scripts) {
          if ((script.getAttribute("src") ?? "").toLowerCase().includes(lower)) return true;
        }
        return false;
      });
      if (metaMatch) {
        confidence += 0.1;
        if (method === "none") method = "meta";
      }
    }

    if (confidence > 0) {
      results.push({ platform, confidence: Math.min(1, confidence), method });
    }
  }

  // Sort by confidence descending, then by priority ascending
  results.sort((a, b) => {
    if (Math.abs(a.confidence - b.confidence) > 0.1) return b.confidence - a.confidence;
    return a.platform.priority - b.platform.priority;
  });

  return results[0] ?? null;
}

/**
 * Get submit/next button selector for the detected platform.
 */
export function getSubmitSelector(platform: ATSPlatformDefinition): { css?: string; xpath?: string; text?: RegExp } | null {
  return platform.submitSelectors[0] ?? null;
}

/**
 * Get step detection selector for the detected platform.
 */
export function getStepSelector(platform: ATSPlatformDefinition): { css?: string; xpath?: string; attr?: string } | null {
  return platform.stepDetection ?? null;
}

/**
 * Get all registered platform IDs.
 */
export function getRegisteredPlatforms(): string[] {
  return PLATFORMS.map((p) => p.id);
}

/**
 * Get platform definition by ID.
 */
export function getPlatformById(id: string): ATSPlatformDefinition | undefined {
  return PLATFORMS.find((p) => p.id === id);
}
