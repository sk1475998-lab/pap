/**
 * @superjob/ats-config
 * Standalone ATS platform detection and configuration package.
 * 
 * This package provides:
 * - ATS platform detection from URL/DOM analysis
 * - Field mapping schemas with Zod validation
 * - Autofill engine for form completion
 * - Remote config management with HMAC validation
 * - Local caching with TTL expiration
 */

// Schemas
export {
  FieldTypeEnum,
  SelectorStrategySchema,
  FieldMappingSchema,
  ATSConfigSchema,
  AtsFlowConfigSchema,
  parseAtsFlowConfig,
  RemoteConfigResponseSchema,
  DetectionResultSchema,
  type FieldType,
  type SelectorStrategy,
  type FieldMapping,
  type ATSConfig,
  type AtsFlowConfig,
  type RemoteConfigResponse,
  type DetectionResult,
} from "./schemas.js";

// Detector
export {
  detectPlatform,
  selectorExists,
  findElement,
  type DetectorOptions,
  type DetectionContext,
} from "./detector.js";

// Autofill Engine
export {
  AutofillEngine,
  TaskQueue,
  ProgressTracker,
  FillError,
  ValueError,
  CancelledError,
  SkippedError,
  isMatched,
  triggerFullEventSequence,
  setNativeValue,
  type FillResult,
  type AutofillOptions,
  type AutofillSummary,
  type FillProgress,
  type FieldRequiredStatus,
  type TaskQueueStatus,
} from "./autofill-engine.js";

// Remote Config
export {
  RemoteConfigManager,
  MemoryStorage,
  ChromeStorage,
  type RemoteConfigOptions,
  type ConfigStorage,
} from "./remote-config.js";
export {
  verifySignedConfig,
  isSignedConfigEnvelope,
  canonicalJson,
  type SignedConfigEnvelope,
  type SignedConfigVerificationOptions,
} from "./config-signing.js";

// Built-in configs (bundled as fallback)
export { BUILTIN_CONFIGS } from "./builtin-configs.js";

// Extension platform overrides not yet represented by full selector chunks.
export { PLATFORM_OVERRIDES, type PlatformOverrideConfig } from "./platform-overrides.js";

// Site Registry (50+ ATS platforms)
export {
  SITE_REGISTRY,
  getAllSupportDomains,
  getAllIframeDomains,
  getAllQueryParams,
  getPageSourceEntries,
  isDomainMatch,
  matchesAnyDomain,
  type SiteRegistryEntry,
} from "./site-registry.js";

// Form Scanner (Comprehensive DOM scanning)
export {
  scanFormFields,
  scanAllForms,
  groupFieldsByName,
  type ScannedField,
  type LabelStrategy,
  type FormScannerOptions,
} from "./form-scanner.js";

// Iframe Autofill Manager (Cross-origin postMessage protocol)
export {
  IframeAutofillManager,
  type IframeAutofillOptions,
  type FillRequestPayload,
  type FillResultPayload,
  type ScanResultPayload,
  type IframeMessageType,
} from "./iframe-manager.js";

// Apply Button Detector (Autonomous click-dispatch engine)
export {
  ApplyButtonDetector,
  replayClick,
  clickFirstApplyButton,
  type ApplyButtonInfo,
  type ButtonDetectionStrategy,
  type ApplyButtonDetectorOptions,
} from "./apply-detector.js";

// Generic semantic detector (JSON-LD / OpenGraph / heuristic fallback)
export {
  detectGenericJob,
  type GenericJobDetection,
} from "./generic-detector.js";
