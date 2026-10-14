/**
 * Advanced ATS utilities integrated from @superjob/ats-config package.
 *
 * This module provides enhanced functionality beyond the core extension implementations:
 * - Cross-origin iframe autofill via postMessage protocol
 * - Comprehensive form scanning with shadow DOM support
 * - Apply button detection with click interception
 * - 8-phase cascading ATS detection
 *
 * These complement the existing extension implementations in:
 * - ./autofill.ts (orchestration)
 * - ./detector.ts (field detection)
 * - ./ats-detector.ts (platform detection)
 */

// Re-export core types and functions from @superjob/ats-config
export {
  // Schemas and types
  type ATSConfig,
  type FieldMapping,
  type FieldType,
  type SelectorStrategy,
  type DetectionResult,
  FieldTypeEnum,

  // Detector
  detectPlatform,
  selectorExists,
  findElement,
  type DetectorOptions,

  // Autofill Engine
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

  // Remote Config
  RemoteConfigManager,
  MemoryStorage,
  ChromeStorage,
  type RemoteConfigOptions,
  type ConfigStorage,

  // Built-in configs
  BUILTIN_CONFIGS,

  // Site Registry
  SITE_REGISTRY,
  getAllSupportDomains,
  getAllIframeDomains,
  isDomainMatch,
  matchesAnyDomain,
} from "@superjob/ats-config";

// Import new modules for enhanced functionality
export {
  // Form Scanner - comprehensive DOM scanning with shadow DOM support
  scanFormFields,
  scanAllForms,
  groupFieldsByName,
  type ScannedField,
  type FormScannerOptions,

  // Iframe Manager - cross-origin postMessage protocol
  IframeAutofillManager,
  type IframeAutofillOptions,
  type FillRequestPayload,
  type FillResultPayload,
  type ScanResultPayload,

  // Apply Button Detector - click interception pattern
  ApplyButtonDetector,
  replayClick,
  clickFirstApplyButton,
  type ApplyButtonInfo,
  type ButtonDetectionStrategy,
} from "@superjob/ats-config";
