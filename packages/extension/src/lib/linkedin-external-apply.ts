/**
 * LinkedIn External Apply URL Detection
 *
 * When a LinkedIn job uses "External Apply" (not Easy Apply), the job posting
 * has a redirect URL to the company's ATS/career page. This module extracts
 * that URL so the autopilot can open it and fill the external application
 * autonomously.
 *
 * Detection strategies (in order of reliability):
 * 1. The primary top-card Apply button <a> tag href (authoritative).
 * 2. data-url / data-apply-url / data-tracking-control-name attributes on the
 *    top-card apply button.
 * 3. JSON-LD JobPosting structured data.
 *
 * We deliberately do NOT crawl the whole page for "apply" / "apply now" links:
 * earlier builds that did this kept hijacking sponsored sidebar cards /
 * "Promoted" company links (e.g. "IDFC FIRST Bank — Apply now") and
 * redirecting the user off the LinkedIn jobs list every time a job detail
 * loaded. Strategy 6 was removed.
 */

import { isLinkedInJobsUrl, isLinkedInEasyApplyOpen } from "./linkedin.js";

/** Blacklist of hostnames that are NEVER valid external-apply destinations.
 *  Catches tracking redirectors, ad networks, CDN assets, and auth walls. */
const BLOCKLIST_HOST = /(^|\.)(linkedin\.com|lnkd\.in|licdn\.com|linkedin\.atl\.net|doubleclick\.net|googlesyndication\.com|googleadservices\.com|google\.com|facebook\.com|twitter\.com|x\.com|instagram\.com|youtube\.com|t\.co|bit\.ly|tinyurl\.com|ow\.ly|taleo\.net|(workday|myworkday)(-|-wd[0-9]+\.)?com$)/i;
// NOTE: workday/myworkday are in the blocklist here because Workday career
// pages are accessed via tenant-specific subdomains (e.g. wd1.myworkdaysite.com)
// — the regex above blocks only the bare apex/known-login hosts; tenant
// career-site subdomains resolve normally via suffix matching in
// `isValidExternalUrl` (which only blocks linkedin.com). The broader blocklist
// above is for tracking/ads/social.

/** Pattern that identifies the *primary* apply button for the currently
 *  viewed job. LinkedIn renders this inside the top-card / action area. */
const PRIMARY_APPLY_SELECTORS = [
  // New unified top card (2025+)
  '.job-details-jobs-unified-top-card__container--two-pane [class*="apply-button"]',
  '.jobs-unified-top-card__container--two-pane .jobs-apply-button',
  // Classic top card
  '.jobs-top-card .jobs-apply-button',
  '.jobs-details-top-card__actions .jobs-apply-button',
  // Top card by aria
  '.jobs-unified-top-card, .job-details-jobs-unified-top-card__container--two-pane, [class*="top-card"]',
];

/**
 * Check if the current LinkedIn job uses external apply (not Easy Apply).
 * Returns true ONLY when the primary top-card apply button is external.
 */
export function isExternalApplyJob(doc: Document = document): boolean {
  return getExternalApplyButton(doc) !== null;
}

/**
 * Find the external Apply button element on LinkedIn.
 * Returns the button only if it is the primary job action (top-card),
 * not a sponsored/sidebar link.
 */
export function getExternalApplyButton(doc: Document = document): HTMLElement | null {
  if (!isLinkedInJobsUrl()) return null;
  if (isLinkedInEasyApplyOpen(doc)) return null; // Already in Easy Apply modal

  // 1. Look specifically in the top-card / job-action area first.
  for (const areaSel of PRIMARY_APPLY_SELECTORS) {
    const areas = doc.querySelectorAll<HTMLElement>(areaSel);
    for (const area of areas) {
      // Narrow down to buttons/anchors that look like apply controls.
      const candidates = area.querySelectorAll<HTMLElement>(
        'button, a, [role="button"]'
      );
      for (const btn of candidates) {
        if (!isVisible(btn)) continue;
        const score = scoreApplyButton(btn);
        if (score.external && score.confidence >= 60) {
          return btn;
        }
      }
    }
  }

  // 2. Fallback: any element with the explicit jobs-apply-button class at top
  // level (outside the scoped area selectors — covers LinkedIn UI updates).
  const allApplyBtns = doc.querySelectorAll<HTMLElement>(
    'button.jobs-apply-button, a.jobs-apply-button, [data-job-apply-button]'
  );
  let best: HTMLElement | null = null;
  let bestScore = 0;
  for (const btn of allApplyBtns) {
    if (!isVisible(btn)) continue;
    // Skip buttons inside job cards in the list (we only want the detail view
    // primary action). The list cards are inside .jobs-search-results-list or
    // .scaffold-layout__list-item.
    if (btn.closest('.jobs-search-results-list, .scaffold-layout__list-item, .jobs-job-board-list__item, li[data-occludable-job-id]')) continue;
    // Skip buttons inside sponsored/promoted modules or newsfeed.
    if (isInsideSponsored(btn)) continue;
    const s = scoreApplyButton(btn);
    if (s.external && s.confidence > bestScore) {
      best = btn;
      bestScore = s.confidence;
    }
  }
  return bestScore >= 60 ? best : null;
}

function isVisible(el: HTMLElement): boolean {
  const r = el.getBoundingClientRect();
  if (r.width < 30 || r.height < 10) return false;
  const st = getComputedStyle(el);
  if (st.display === "none" || st.visibility === "hidden" || parseFloat(st.opacity) === 0) return false;
  return true;
}

function isInsideSponsored(el: HTMLElement): boolean {
  // Any ancestor that flags itself as promoted/sponsored/newsfeed/ad should
  // disqualify the link.
  let cur: HTMLElement | null = el;
  for (let i = 0; i < 8 && cur; i++, cur = cur.parentElement) {
    const cls = (cur.className && typeof cur.className === "string") ? cur.className : "";
    const dataTest = cur.getAttribute?.("data-test-id") ?? "";
    const dataCtrl = cur.getAttribute?.("data-tracking-control-name") ?? "";
    if (/promoted|sponsored|ad-banner|ad-slot|newsfeed|feed-shared|upsell|premium|jobs-pyml|jobs-you-may|recommendation|sidebar|related-job|people-also-viewed/i.test(cls + " " + dataTest + " " + dataCtrl)) {
      return true;
    }
    if (cur.tagName === "ARTICLE") return true; // newsfeed cards are ARTICLEs
  }
  return false;
}

interface ButtonScore { external: boolean; confidence: number }
function scoreApplyButton(btn: HTMLElement): ButtonScore {
  const aria = (btn.getAttribute("aria-label") ?? "").toLowerCase();
  const text = (btn.textContent ?? "").replace(/\s+/g, " ").trim().toLowerCase();
  const label = `${aria} ${text}`;
  const cls = (typeof btn.className === "string") ? btn.className : "";
  const href = (btn as HTMLAnchorElement).href ?? btn.getAttribute("href") ?? "";
  const dataUrl = btn.getAttribute("data-url") ?? btn.getAttribute("data-apply-url") ?? "";
  const isAnchor = btn.tagName === "A";

  // Negative signals — this is NOT the real external-apply button.
  if (/easy\s*apply/i.test(label)) return { external: false, confidence: 0 };
  if (/save|follow|share|message|connect/i.test(label) && !/apply/i.test(label)) return { external: false, confidence: 0 };
  if (/^\s*$/.test(label)) return { external: false, confidence: 0 };

  // Positive: contains "apply" keyword.
  if (!/apply/i.test(label)) return { external: false, confidence: 0 };

  let conf = 20;
  if (/jobs-apply-button|apply-button|data-job-apply/i.test(cls)) conf += 50;
  if (/apply\s*(on|at\s+company|now|to\s+this\s+job)?\s*(on\s+company\s+website|externally)?$/i.test(text.trim())) conf += 25;
  if (isAnchor && href && !/linkedin\.com/i.test(href) && isValidExternalUrl(href)) conf += 40;
  if (dataUrl && isValidExternalUrl(dataUrl)) conf += 40;
  // LinkedIn renders external-apply buttons with an <icon> showing external-link;
  // or the text suffix "on company website" / "on <company>".
  if (/on\s+company\s+website|company\s+website|externally/i.test(label)) conf += 20;

  const external = isAnchor
    ? Boolean(href && !/linkedin\.com/i.test(href) && isValidExternalUrl(href))
    : Boolean(dataUrl && isValidExternalUrl(dataUrl)) || /company\s+website|externally/i.test(label);

  return { external, confidence: external ? conf : 0 };
}

/**
 * Extract the external apply URL from a LinkedIn job page.
 * Uses ONLY authoritative sources (top-card button, JSON-LD) — never crawls
 * arbitrary page links, which was the source of the IDFC/promoted-job
 * redirect bug.
 */
export function getExternalApplyUrl(doc: Document = document): string | null {
  if (!isLinkedInJobsUrl()) return null;

  // Strategy 1: the detected primary button (highest confidence).
  const btn = getExternalApplyButton(doc);
  if (btn) {
    if (btn.tagName === "A") {
      const href = (btn as HTMLAnchorElement).href;
      if (href && isValidExternalUrl(href)) return normalizeApplyUrl(href);
    }
    const dataUrl = btn.getAttribute("data-url") || btn.getAttribute("data-apply-url") || btn.getAttribute("data-redirect-url");
    if (dataUrl && isValidExternalUrl(dataUrl)) return normalizeApplyUrl(dataUrl);
    // Walk up once to find a wrapping anchor.
    const wrap = btn.closest<HTMLAnchorElement>("a[href]");
    if (wrap && wrap.href && isValidExternalUrl(wrap.href)) return normalizeApplyUrl(wrap.href);
  }

  // Strategy 2: JSON-LD JobPosting.
  const jsonLdScripts = doc.querySelectorAll<HTMLScriptElement>('script[type="application/ld+json"]');
  for (const script of jsonLdScripts) {
    try {
      const data = JSON.parse(script.textContent ?? "");
      const url = extractUrlFromJsonLd(data);
      if (url) return normalizeApplyUrl(url);
    } catch { /* invalid JSON */ }
  }

  return null;
}

/**
 * Normalize a URL that may come through LinkedIn's tracking redirect.
 * LinkedIn sometimes wraps external apply URLs via
 *   https://www.linkedin.com/redir/redirect?url=<encoded>&token=...
 * We unwrap that to the real ATS URL.
 */
function normalizeApplyUrl(url: string): string | null {
  try {
    const u = new URL(url);
    if (/linkedin\.com/i.test(u.hostname) && /redir|redirect/i.test(u.pathname)) {
      const target = u.searchParams.get("url");
      if (target && isValidExternalUrl(target)) return target;
    }
    return u.href;
  } catch {
    return null;
  }
}

function isValidExternalUrl(url: string): boolean {
  try {
    const u = new URL(url);
    if (!/^https?:$/i.test(u.protocol)) return false;
    if (/linkedin\.com|lnkd\.in|licdn\.com/i.test(u.hostname)) return false;
    if (BLOCKLIST_HOST.test(u.hostname)) return false;
    // Must look like a job/application URL OR at least be a valid https URL
    // (career sites live on many domains). Reject obvious asset paths.
    if (/\.(png|jpg|jpeg|gif|svg|webp|css|js|ico|woff2?|ttf|mp4|mp3|pdf)(\?|#|$)/i.test(u.pathname)) return false;
    // Reject anchor-only / javascript: / mailto:
    if (/^(javascript|mailto|tel):/i.test(url)) return false;
    return true;
  } catch {
    return false;
  }
}

function extractUrlFromJsonLd(data: any): string | null {
  if (!data) return null;
  if (data["@graph"] && Array.isArray(data["@graph"])) {
    for (const item of data["@graph"]) {
      const url = extractUrlFromJsonLd(item);
      if (url) return url;
    }
    return null;
  }
  if (data["@type"] === "JobPosting" || (Array.isArray(data["@type"]) && data["@type"].includes("JobPosting"))) {
    if (data.url && isValidExternalUrl(data.url)) return data.url;
    if (data.applicationContact?.url && isValidExternalUrl(data.applicationContact.url)) return data.applicationContact.url;
  }
  return null;
}

/**
 * Request the background script to open an external ATS URL in a NEW tab
 * (never the current LinkedIn tab — doing so destroyed the LinkedIn
 * jobs list view, which was the "cannot open jobs section" complaint).
 *
 * The background script owns tab lifecycle: it waits for the new tab to
 * finish loading, injects the orchestrator, and starts autopilot. This
 * function only asks background to open the tab and returns the tabId.
 *
 * Earlier versions duplicated a tabs.onUpdated listener here and raced the
 * background's own injection (both tried to inject agent.js and send
 * SJA:AUTOPILOT from two different contexts), which produced a stuck state
 * where neither side's message landed reliably. The fix is to have exactly
 * one owner (background) for post-open wiring.
 */
export async function openExternalApplyTab(url: string, opts: { active?: boolean } = {}): Promise<number | null> {
  try {
    const response = await chrome.runtime.sendMessage({
      type: "SJA:OPEN_EXTERNAL_TAB",
      payload: { url, active: opts.active !== false },
    });
    const tabId = response?.data?.tabId ?? response?.tabId ?? null;
    return typeof tabId === "number" ? tabId : null;
  } catch {
    return null;
  }
}
