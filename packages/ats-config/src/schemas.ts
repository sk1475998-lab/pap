/**
 * Zod schemas for ATS platform configurations.
 * These schemas define the structure for field mappings, selectors, and validation rules.
 */
import { z } from "zod";

/** Field type enum matching HTML form field types */
export const FieldTypeEnum = z.enum([
  "text",
  "email",
  "tel",
  "url",
  "number",
  "select",
  "radio",
  "checkbox",
  "textarea",
  "file",
  "date",
  "hidden",
]);
export type FieldType = z.infer<typeof FieldTypeEnum>;

/** Selector strategy for finding elements.
 *
 * Order roughly matches specificity/resilience:
 *   id > name > data-attr > aria > label > placeholder > testid > css > xpath
 * CSS class selectors should be last resort (hash-classes rot quickly).
 */
export const SelectorStrategySchema = z.object({
  type: z.enum(["css", "xpath", "name", "id", "label", "placeholder", "aria", "data", "testid"]),
  value: z.string().min(1),
  priority: z.number().int().min(1).max(10).default(5),
});
export type SelectorStrategy = z.infer<typeof SelectorStrategySchema>;

/**
 * Build a resilient fallback chain of selector strategies from a canonical
 * field key and its human label. Order matches resilience, so the first
 * match wins. Callers can prepend site-specific selectors for ATS configs.
 *
 * Exported as a helper for adapter authors and the generic fallback layer.
 */
export function buildResilientSelectors(
  label: string,
  opts: { canonicalKey?: string; aliases?: string[] } = {},
): SelectorStrategy[] {
  const names = new Set<string>();
  const add = (v: string) => {
    const t = v.trim().toLowerCase();
    if (t.length > 1) names.add(t);
  };
  add(label);
  for (const a of opts.aliases ?? []) add(a);
  if (opts.canonicalKey) add(opts.canonicalKey);
  // Common field aliases
  const aliasMap: Record<string, string[]> = {
    firstname: ["first", "given", "fname", "givenName"],
    lastname: ["last", "family", "lname", "surname", "familyName"],
    email: ["e-mail", "email_address"],
    phone: ["tel", "mobile", "cell", "telephone", "phonenumber"],
    city: ["town", "locality"],
    state: ["province", "region", "territory"],
    zip: ["zipcode", "postal", "pincode", "postalcode"],
    country: ["nation"],
    linkedin: ["linked-in", "li-profile", "linkedinurl", "publicprofileurl"],
    github: ["gh-profile", "git-url", "githuburl"],
    website: ["portfolio", "homepage", "url"],
    resume: ["cv", "resume-upload", "cv-upload"],
  };
  if (opts.canonicalKey && aliasMap[opts.canonicalKey.toLowerCase()]) {
    for (const a of aliasMap[opts.canonicalKey.toLowerCase()]) add(a);
  }
  const toVal = (s: string) => s.replace(/\s+/g, " ").trim();
  const out: SelectorStrategy[] = [];
  for (const n of names) {
    const v = toVal(n);
    if (!v) continue;
    // 1. id match (if name looks like an id candidate)
    out.push({ type: "id", value: v, priority: 10 });
    // 2. name attr (most common in forms)
    out.push({ type: "name", value: v, priority: 9 });
    // 3. data-testid / data-qa / data-automation-id (modern resilient attrs)
    out.push({ type: "testid", value: v, priority: 8 });
    // 4. aria-label
    out.push({ type: "aria", value: v, priority: 7 });
    // 5. data-* attributes (data-field, data-name, data-key)
    out.push({ type: "data", value: v, priority: 7 });
    // 6. label
    out.push({ type: "label", value: v, priority: 6 });
    // 7. placeholder
    out.push({ type: "placeholder", value: v, priority: 5 });
  }
  return out;
}

/** Field mapping configuration */
export const FieldMappingSchema = z.object({
  /** Canonical field name (e.g., "firstName", "phone") */
  canonicalName: z.string(),
  /** Human-readable label */
  label: z.string(),
  /** HTML field type */
  fieldType: FieldTypeEnum.default("text"),
  /** Selector strategies to find this field */
  selectors: z.array(SelectorStrategySchema).min(1),
  /** Whether this field is required */
  required: z.boolean().default(false),
  /** Default value if user hasn't provided one */
  defaultValue: z.string().optional(),
  /** Validation regex pattern */
  validationPattern: z.string().optional(),
  /** Validation error message */
  validationMessage: z.string().optional(),
  /** Transform function name (e.g., "formatPhone", "uppercase") */
  transform: z.string().optional(),
  /** Whether to skip this field during autofill */
  skip: z.boolean().optional(),
  /** Priority for fill order (lower = first) */
  fillOrder: z.number().int().optional(),
  /** Conditional logic: only fill if condition is met */
  condition: z
    .object({
      field: z.string(),
      operator: z.enum(["equals", "notEquals", "contains", "exists"]),
      value: z.string().optional(),
    })
    .optional(),
});
export type FieldMapping = z.infer<typeof FieldMappingSchema>;

/** ATS platform configuration */
export const ATSConfigSchema = z.object({
  /** Unique platform identifier */
  platformId: z.string(),
  /** Human-readable platform name */
  platformName: z.string(),
  /** URL patterns that identify this ATS */
  urlPatterns: z.array(z.string()).min(1),
  /** Detection selectors to confirm platform */
  detectionSelectors: z.array(SelectorStrategySchema).optional(),
  /** Detection keywords in page content */
  detectionKeywords: z.array(z.string()).optional(),
  /** Field mappings for this platform */
  fieldMappings: z.array(FieldMappingSchema),
  /** Custom submit button selector */
  submitButtonSelector: z.string().optional(),
  /** Custom next/review button selector */
  nextButtonSelector: z.string().optional(),
  /** Whether this platform uses multi-step forms */
  isMultiStep: z.boolean().default(false),
  /** Selectors that indicate form step completion */
  stepCompletionSelectors: z.array(z.string()).optional(),
  /** Known issues or quirks with this platform */
  knownIssues: z.array(z.string()).optional(),
  /** Config version for cache invalidation */
  version: z.number().int().default(1),
  /** Last updated timestamp */
  lastUpdated: z.number().optional(),
  /** Whether this config is active */
  active: z.boolean().default(true),
});
export type ATSConfig = z.infer<typeof ATSConfigSchema>;

/**
 * Legacy ATS **flow-config** model (aka the "orchestrator" / entity-processor
 * model). This is the schema behind the 18 per-site JSON chunks in
 * `packages/extension/src/public/ats-config-chunks/*.json` (and the
 * bundled `ATS_CONFIGS` mirror).
 *
 * It is a *different* model from `ATSConfigSchema`:
 * - `ATSConfigSchema`       = modern field-mapping config (canonical fields →
 *   selector strategies) consumed by `AutofillEngine`/`builtin-configs`.
 * - `AtsFlowConfigSchema`   = XPath/entity *automation* config consumed by the
 *   orchestrator adapter, entity processor, and form-error recovery. It drives
 *   "how to click next/submit, where errors appear, how custom questions are
 *   structured" rather than "which canonical field maps to which DOM element".
 *
 * Because both models legitimately coexist, validating a flow chunk against
 * `ATSConfigSchema` (or vice versa) is a category error. Each model has its
 * own schema; loaders must pick the schema matching the consumer.
 */
export const AtsFlowConfigSchema = z
  .object({
    atsName: z.string().min(1),
    urls: z.array(z.string()).min(1),
  urlsExclude: z.array(z.string()).optional(),
  submitButtonPaths: z.array(z.string()).optional(),
  nextStepButtonPaths: z.array(z.string()).optional(),
  nextStepButtonFallbackToParentFrame: z.boolean().optional(),
  nextStepDynamicLoad: z.boolean().optional(),
  backStepButtonPaths: z.array(z.string()).optional(),
  backStepDiscardButtonPaths: z.array(z.string()).optional(),
  validationErrorXPaths: z.array(z.string()).optional(),
  validationErrorPersistent: z.boolean().optional(),
  validationCheckFormValidity: z.boolean().optional(),
  errorBannerXPaths: z.array(z.string()).optional(),
  questionValidationErrorSelectors: z.array(z.string()).optional(),
  validateUsingQuestionErrorSelectors: z.boolean().optional(),
  targetNodeXPath: z.array(z.string()).optional(),
  targetFrameNodeXPath: z.array(z.string()).optional(),
  formLoadingXPaths: z.array(z.string()).optional(),
  formLoadingAfterNextStepClick: z.boolean().optional(),
  formLoadingAfterSubmitClick: z.boolean().optional(),
  loadingSpinnerXPath: z.array(z.string()).optional(),
  textContentFallbacks: z.array(z.string()).optional(),
  pageFailureKeywords: z.array(z.string()).optional(),
  exitModalWindow: z.array(z.string()).optional(),
  attachedContainer: z.array(z.string()).optional(),
  captchaXpath: z.array(z.string()).optional(),
  verificationButtonXpaths: z.array(z.string()).optional(),
  hiddenElementSelectors: z.string().optional(),
  formatElements: z.string().optional(),

  detectPageQuestions: z.boolean().optional(),
  addQuestionLabelId: z.boolean().optional(),
  questionsInSubmitPage: z.boolean().optional(),
  ignoreInitAnswersNeeded: z.boolean().optional(),
  monitorSubmitFlow: z.boolean().optional(),
  waitForSubmitOutcome: z.boolean().optional(),
  checkForAlreadyAppliedAfterSubmit: z.boolean().optional(),
  checkForErrorsBeforeNext: z.boolean().optional(),
  checkErrorsAfterSubmit: z.boolean().optional(),
  checkVerificationAfterSubmit: z.boolean().optional(),
  verificationAfterSubmit: z.boolean().optional(),
  tabWillNotUpdateAfterSubmit: z.boolean().optional(),
  clickErrorBannerAfterFailedSubmit: z.boolean().optional(),
  forceNewJobSearch: z.boolean().optional(),
  alwaysSyncWindowId: z.boolean().optional(),
  disableBeforeUnloadEvent: z.boolean().optional(),
  stopWaitingUserInteractionsInPreApply: z.boolean().optional(),

  /** Opaque nested automation structures — validated as records, kept as-is. */
  customQuestions: z.record(z.string(), z.unknown()).optional(),
  canJobBeAppliedXPaths: z.record(z.string(), z.unknown()).optional(),
  preApply: z.record(z.string(), z.unknown()).optional(),
  signIn: z.record(z.string(), z.unknown()).optional(),
  signUp: z.record(z.string(), z.unknown()).optional(),
  confirmSubmittedForm: z.record(z.string(), z.unknown()).optional(),
  networkOptions: z.record(z.string(), z.unknown()).optional(),
  globalOptions: z.record(z.string(), z.unknown()).optional(),
  jobXPaths: z.record(z.string(), z.unknown()).optional(),
  contextData: z.record(z.string(), z.unknown()).optional(),
  verification: z.record(z.string(), z.unknown()).optional(),
  verificationRequired: z.record(z.string(), z.unknown()).optional(),
  autoFillOptions: z.record(z.string(), z.unknown()).optional(),
  screenshot: z.record(z.string(), z.unknown()).optional(),
  sections: z.record(z.string(), z.unknown()).optional(),
  stepsNavigation: z.record(z.string(), z.unknown()).optional(),
  expiredJob: z
    .union([
      z.record(z.string(), z.unknown()),
      z.array(z.record(z.string(), z.unknown())),
    ])
    .optional(),

  /** [fieldName, xpathsOrActions, metadata?][] tuples, opaque to this schema. */
  entities: z.array(z.array(z.unknown())).optional(),
  entitiesAfterLLM: z.array(z.array(z.unknown())).optional(),
  jobIdExtractPatterns: z.array(z.string()).optional(),
  highPriority: z.array(z.string()).optional(),
  lowPriorityEntities: z.array(z.string()).optional(),
}).passthrough();
export type AtsFlowConfig = z.infer<typeof AtsFlowConfigSchema>;

/** Helper: parse + validate a legacy flow config object. */
export function parseAtsFlowConfig(value: unknown): AtsFlowConfig | null {
  const result = AtsFlowConfigSchema.safeParse(value);
  return result.success ? result.data : null;
}

/** Remote config response with signature */
export const RemoteConfigResponseSchema = z.object({
  configs: z.array(ATSConfigSchema),
  signature: z.string(),
  timestamp: z.number(),
  ttl: z.number(), // seconds until config expires
});
export type RemoteConfigResponse = z.infer<typeof RemoteConfigResponseSchema>;

/** Detection result */
export const DetectionResultSchema = z.object({
  platform: z.string().nullable(),
  confidence: z.number().min(0).max(1),
  config: ATSConfigSchema.nullable(),
  matchedUrl: z.string().optional(),
  matchedSelectors: z.array(z.string()).optional(),
});
export type DetectionResult = z.infer<typeof DetectionResultSchema>;
