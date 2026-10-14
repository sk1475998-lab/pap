import type { AtsConfig } from "./ats-configs-data.js";
import { getAtsConfigIndexEntries, loadAtsConfigChunk } from "./ats-config-index.js";

export type { AtsConfig } from "./ats-configs-data.js";

export function globToRegex(glob: string): RegExp {
  const esc = glob.replace(/[.+^${}()|[\]\\]/g, '\\$&');
  const regexStr = '^' + esc.replace(/\*/g, '.*').replace(/\?/g, '.') + '$';
  return new RegExp(regexStr, 'i');
}

export function getMatchingAtsConfigKey(url: string): string | null {
  const cleanUrl = url.split('#')[0].split('?')[0];
  for (const [key, config] of getAtsConfigIndexEntries()) {
    if (config.urlsExclude?.some(pattern => globToRegex(pattern).test(cleanUrl))) {
      continue;
    }
    const allUrls = [...config.urls, ...(config.preApplyUrls ?? [])];
    if (allUrls.some(pattern => globToRegex(pattern).test(cleanUrl) || globToRegex(pattern).test(url))) {
      return key;
    }
  }
  return null;
}

/**
 * Lightweight synchronous config shape for hot paths. It uses the generated
 * index and intentionally excludes heavy per-field selectors/entities.
 */
export function getMatchingAtsConfig(url: string): Partial<AtsConfig> | null {
  const key = getMatchingAtsConfigKey(url);
  if (!key) return null;
  const entry = Object.fromEntries(getAtsConfigIndexEntries())[key];
  if (!entry) return null;
  return {
    atsName: entry.atsName,
    urls: entry.urls,
    urlsExclude: entry.urlsExclude,
    targetNodeXPath: entry.targetNodeXPath,
    submitButtonPaths: entry.submitButtonPaths,
    nextStepButtonPaths: entry.nextStepButtonPaths,
    backStepButtonPaths: entry.backStepButtonPaths,
    validationErrorXPaths: entry.validationErrorXPaths,
    errorBannerXPaths: entry.errorBannerXPaths,
    loadingSpinnerXPath: entry.loadingSpinnerXPath,
    formLoadingXPaths: entry.formLoadingXPaths,
    formLoadingAfterNextStepClick: entry.formLoadingAfterNextStepClick,
  };
}

/** Load the full matching ATS config only when a feature needs heavy selectors. */
export async function getMatchingAtsConfigFull(url: string): Promise<AtsConfig | null> {
  const key = getMatchingAtsConfigKey(url);
  return key ? loadAtsConfigChunk(key) : null;
}

export function getElementByXPath(xpath: string, context: Node = document): HTMLElement | null {
  try {
    const result = document.evaluate(
      xpath,
      context,
      null,
      XPathResult.FIRST_ORDERED_NODE_TYPE,
      null
    );
    return result.singleNodeValue as HTMLElement;
  } catch (e) {
    return null;
  }
}

export function getElementsByXPath(xpath: string, context: Node = document): HTMLElement[] {
  try {
    const iterator = document.evaluate(
      xpath,
      context,
      null,
      XPathResult.ORDERED_NODE_ITERATOR_TYPE,
      null
    );
    const nodes: HTMLElement[] = [];
    let node = iterator.iterateNext();
    while (node) {
      nodes.push(node as HTMLElement);
      node = iterator.iterateNext();
    }
    return nodes;
  } catch (e) {
    return [];
  }
}

export function isElementVisible(el: HTMLElement): boolean {
  const rect = el.getBoundingClientRect();
  if (rect.width === 0 && rect.height === 0) return false;
  const style = getComputedStyle(el);
  return style.display !== "none" && style.visibility !== "hidden" && Number(style.opacity) > 0;
}

export function isXPath(selector: string): boolean {
  return selector.startsWith("/") || selector.startsWith(".//") || selector.startsWith("id(");
}

export function queryNode(selector: string, root: ParentNode = document): Element | null {
  if (isXPath(selector)) {
    return getElementByXPath(selector, root);
  }
  try {
    return root.querySelector(selector);
  } catch {
    return null;
  }
}

export function queryAllNodes(selector: string, root: ParentNode = document): Element[] {
  if (isXPath(selector)) {
    return getElementsByXPath(selector, root);
  }
  try {
    return Array.from(root.querySelectorAll(selector));
  } catch {
    return [];
  }
}
