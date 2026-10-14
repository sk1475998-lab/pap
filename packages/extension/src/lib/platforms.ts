/**
 * Platform detection + per-ATS hooks.
 * Uses a lightweight generated index so hot paths do not import the full ATS
 * selector corpus.
 */
import { PLATFORM_OVERRIDES } from "@superjob/ats-config";
import { getAtsConfigIndexEntries } from "./ats-config-index.js";
import { globToRegex } from "./ats-adapter.js";

export interface Platform {
  id: string;
  name: string;
  match: (url: string, doc: Document) => boolean;
  rootSelector?: string;
  deepScan?: boolean;
}

const DYNAMIC_PLATFORMS: Platform[] = getAtsConfigIndexEntries().map(([key, config]) => {
  return {
    id: key,
    name: config.atsName ? (config.atsName.charAt(0).toUpperCase() + config.atsName.slice(1)) : key,
    match: (url: string) => {
      const cleanUrl = url.split('#')[0].split('?')[0];
      if (config.urlsExclude?.some(pattern => globToRegex(pattern).test(cleanUrl))) {
        return false;
      }
      const allUrls = [...config.urls, ...(config.preApplyUrls ?? [])];
      return allUrls.some(pattern => globToRegex(pattern).test(cleanUrl) || globToRegex(pattern).test(url));
    },
    rootSelector: config.targetNodeXPath?.[0] ?? "form",
    deepScan: Boolean(config.deepScan),
  };
});

const CUSTOM_PLATFORMS: Platform[] = PLATFORM_OVERRIDES.map((config) => ({
  id: config.id,
  name: config.name,
  match: (url) => config.urlPatterns.some((pattern) => new RegExp(pattern, "i").test(url)),
  rootSelector: config.rootSelector,
  deepScan: config.deepScan,
}));

const uniqueCustom = CUSTOM_PLATFORMS.filter(
  (cp) => !DYNAMIC_PLATFORMS.some((zp) => zp.id === cp.id)
);

export const PLATFORMS: Platform[] = [...DYNAMIC_PLATFORMS, ...uniqueCustom];

export function detectPlatform(url: string, doc: Document = document): Platform | null {
  return PLATFORMS.find((p) => p.match(url, doc)) ?? null;
}

export const GENERIC: Platform = {
  id: "generic",
  name: "Web form",
  match: () => true,
  rootSelector: "form, main, body",
};
