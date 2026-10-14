// Auto-generated lightweight ATS config index. Full configs are public JSON
// assets loaded on demand from /ats-config-chunks/*.json.
import ATS_INDEX from "./ats-config-chunks/index.json";
import { AtsFlowConfigSchema } from "@superjob/ats-config";
import type { AtsConfig } from "./ats-configs-data.js";

export interface AtsConfigIndexEntry {
  atsName: string;
  urls: string[];
  urlsExclude?: string[];
  preApplyUrls?: string[];
  deepScan?: boolean;
  targetNodeXPath?: string[];
  submitButtonPaths?: string[];
  nextStepButtonPaths?: string[];
  backStepButtonPaths?: string[];
  validationErrorXPaths?: string[];
  errorBannerXPaths?: string[];
  loadingSpinnerXPath?: string[];
  formLoadingXPaths?: string[];
  formLoadingAfterNextStepClick?: boolean;
}

export const ATS_CONFIG_INDEX = ATS_INDEX as Record<string, AtsConfigIndexEntry>;
export type AtsConfigKey = keyof typeof ATS_CONFIG_INDEX | string;

const cache = new Map<string, Promise<AtsConfig | null>>();

export function getAtsConfigIndexEntries(): Array<[string, AtsConfigIndexEntry]> {
  return Object.entries(ATS_CONFIG_INDEX);
}

function assertKnownKey(key: string): boolean {
  return Object.prototype.hasOwnProperty.call(ATS_CONFIG_INDEX, key) && /^[a-z0-9_-]+$/i.test(key);
}

export function loadAtsConfigChunk(key: string): Promise<AtsConfig | null> {
  if (!assertKnownKey(key)) return Promise.resolve(null);
  if (!cache.has(key)) {
    cache.set(key, (async () => {
      const url = chrome.runtime.getURL(`ats-config-chunks/${key}.json`);
      const response = await fetch(url, { credentials: "omit", cache: "force-cache" });
      if (!response.ok) throw new Error(`Failed to load ATS config ${key}: ${response.status}`);
      const raw = (await response.json()) as unknown;
      // Runtime schema gate: the shipped chunks are *flow-configs*
      // (AtsFlowConfigSchema), not modern field-mapping configs. Validating
      // here catches malformed/regressed chunks before they reach the entity
      // processor / submit-flow logic. `.passthrough()` preserves any extra
      // keys the schema does not enumerate.
      const parsed = AtsFlowConfigSchema.safeParse(raw);
      if (!parsed.success) {
        console.warn("[SJA] ATS config chunk failed flow-schema validation", key, parsed.error.issues);
        return null;
      }
      return parsed.data as unknown as AtsConfig;
    })().catch((err) => {
      console.warn("[SJA] ATS config chunk load failed", key, err);
      return null;
    }));
  }
  return cache.get(key)!;
}

export function clearAtsConfigChunkCache(): void {
  cache.clear();
}
