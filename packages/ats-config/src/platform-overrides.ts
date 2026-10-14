/**
 * Extension platform overrides that are not yet represented by a full ATS
 * selector chunk. Keep site-specific URL matching and root metadata here so
 * the extension runtime stays a generic config loader.
 */
export interface PlatformOverrideConfig {
  id: string;
  name: string;
  /** Regex source strings, compiled by the extension's generic platform loader. */
  urlPatterns: string[];
  rootSelector?: string;
  deepScan?: boolean;
}

export const PLATFORM_OVERRIDES: readonly PlatformOverrideConfig[] = [
  { id: "linkedin", name: "LinkedIn Easy Apply", urlPatterns: ["linkedin\\.com\\/(jobs|comm\\/hiring|talent)"], rootSelector: ".jobs-easy-apply-modal, [data-test-modal-id='easy-apply-modal']" },
  { id: "smartrecruiters", name: "SmartRecruiters", urlPatterns: ["smartrecruiters\\.com"], rootSelector: "form" },
  { id: "infosys", name: "Infosys Careers", urlPatterns: ["career\\.infosys\\.com", "infosys\\.com\\/careers"], rootSelector: "form, .application-form, #application, [class*='jobapply'], main" },
  { id: "successfactors", name: "SAP SuccessFactors", urlPatterns: ["successfactors\\.com", "successfactors\\.eu", "performancemanager"], deepScan: true },
  { id: "ripplehire", name: "RippleHire", urlPatterns: ["ripplehire\\.com"], rootSelector: "form, #applicationForm, .application-form, .candidate-form" },
  { id: "wellfound", name: "Wellfound (AngelList)", urlPatterns: ["wellfound\\.com", "angel\\.co"], rootSelector: "form" },
  { id: "ycombinator", name: "YCombinator Jobs", urlPatterns: ["workatastartup\\.com", "ycombinator\\.com\\/jobs"], rootSelector: "form" },
  { id: "ukg", name: "UKG (UltiPro)", urlPatterns: ["ultipro\\.com", "ukg\\.com", "ukg\\.net"], deepScan: true },
  { id: "avature", name: "Avature", urlPatterns: ["avature\\.net", "\\.avature\\."], rootSelector: "form" },
  { id: "rippling", name: "Rippling", urlPatterns: ["rippling\\.com"], rootSelector: "form" },
  { id: "naukri", name: "Naukri.com", urlPatterns: ["naukri\\.com"], rootSelector: "form, .apply-form, #applyForm" },
  { id: "freshteam", name: "Freshteam", urlPatterns: ["freshteam\\.com", "freshworks\\.com"], rootSelector: "form" },
  { id: "teamtailor", name: "Teamtailor", urlPatterns: ["teamtailor\\.com"], rootSelector: "form, [data-controller*='jobs']" },
  { id: "recruitee", name: "Recruitee", urlPatterns: ["recruitee\\.com"], rootSelector: "form" },
  { id: "personio", name: "Personio", urlPatterns: ["personio\\.(de|com)", "jobs\\.personio"], rootSelector: "form" },
  { id: "pinpoint", name: "Pinpoint", urlPatterns: ["pinpointhq\\.com"], rootSelector: "form" },
  { id: "eightfold", name: "Eightfold", urlPatterns: ["eightfold\\.ai", "eightfold"], deepScan: true },
  { id: "phenom", name: "Phenom", urlPatterns: ["phenompeople\\.com", "phenom\\.com"], deepScan: true },
];
