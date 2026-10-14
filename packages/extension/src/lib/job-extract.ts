/** Heuristic extraction of the current job posting's title/company/description. */
import { earlyAdvantageFromApplicantSignals, type SalienceTier } from "@superjob/core";
import { isLinkedInJobsUrl } from "./linkedin.js";

export interface EarlyAdvantageInfo {
  applicantCount?: number;
  applicantText?: string;
  postedText?: string;
  isEarlyBird: boolean;
  advantageScore: number;
  /** Salience tier (legacy field name). Not a measured callback multiplier. */
  callbackMultiplier: SalienceTier | string;
  salienceTier?: SalienceTier;
  badgeText: string;
}

export interface HiringTeamInfo {
  name: string;
  title?: string;
  profileUrl?: string;
}

export interface ExtractedJob {
  title: string;
  company: string;
  description: string;
  url: string;
  earlyAdvantage?: EarlyAdvantageInfo | null;
  hiringTeam?: HiringTeamInfo | null;
}

export async function extractJobFromPageAsync(): Promise<ExtractedJob> {
  const url = location.href;
  if (isLinkedInJobsUrl(url)) return extractLinkedInJob(url);
  try {
    const { detectGenericJob } = await import("@superjob/ats-config");
    const generic = detectGenericJob(document);
    if (generic.confidence >= 0.6 && generic.title && generic.description) {
      return {
        title: clean(generic.title),
        company: clean(generic.company) || guessCompanyFromUrl(url) || "Unknown company",
        description: normalizeDescription(generic.description),
        url,
        earlyAdvantage: extractEarlyAdvantage(document),
        hiringTeam: extractHiringTeam(document),
      };
    }
  } catch {
    /* ats-config dynamic import failure — fall through */
  }
  return extractJobFromPage();
}

export function extractJobFromPage(): ExtractedJob {
  const url = location.href;
  if (isLinkedInJobsUrl(url)) return extractLinkedInJob(url);
  return extractGenericJob(url);
}

function extractGenericJob(url: string): ExtractedJob {
  const title = readSelectors([
    'h1',
    '[data-automation-id="jobPostingHeader"]',
    '.job-title',
    '.posting-headline h2',
    '.application-name',
    'meta[property="og:title"]',
  ]) || document.title;

  const company = readSelectors([
    '[data-automation-id="jobPostingCompany"]',
    '.company-name',
    '.posting-headline .company',
    '.company-link',
    'meta[name="company"]',
  ]) || guessCompanyFromUrl(url);

  const description = extractDescription();
  return {
    title: clean(title),
    company: clean(company),
    description,
    url,
    earlyAdvantage: extractEarlyAdvantage(document),
    hiringTeam: extractHiringTeam(document),
  };
}

function extractLinkedInJob(url: string): ExtractedJob {
  const title = readSelectors([
    '.job-details-jobs-unified-top-card__job-title',
    '.jobs-unified-top-card__job-title',
    'h1.t-24',
    'h2.job-details-jobs-unified-top-card__job-title',
    '.top-card-layout__title',
    'h1',
  ]) || cleanLinkedInTitle(document.title);

  let company = readSelectors([
    '.job-details-jobs-unified-top-card__company-name',
    '.jobs-unified-top-card__company-name',
    '.jobs-unified-top-card__subtitle-primary-grouping a',
    'a[href*="/company/"]',
    '.topcard__org-name-link',
    '.jobs-unified-top-card__company-name a',
    '[data-tracking-control-name="public_jobs_topcard-org-name"]',
  ]);

  if (!company || company === "Unknown company") {
    try {
      const u = new URL(url);
      const urlComp = u.searchParams.get("companyName");
      if (urlComp) company = decodeURIComponent(urlComp).trim();
    } catch {}
  }

  if (!company || company === "Unknown company") {
    const titleMatch = document.title.match(/\bat\s+([^|·•\n]+)/i);
    if (titleMatch && titleMatch[1]) company = titleMatch[1].trim();
  }

  const description = extractDescriptionLinkedIn();

  return {
    title: clean(title),
    company: clean(company) || "Unknown company",
    description,
    url: linkedInJobUrl(url),
    earlyAdvantage: extractEarlyAdvantage(document),
    hiringTeam: extractHiringTeam(document),
  };
}

export function extractEarlyAdvantage(target?: Document | Element | string | null): EarlyAdvantageInfo | null {
  try {
    let applicantText = "";
    let applicantCount: number | undefined;
    let isEarlyBird = false;
    let postedText = "";

    if (typeof target === "string") {
      const txt = target.trim();
      if (!txt) return null;
      if (/applicant/i.test(txt)) {
        applicantText = txt;
        if (/be among the first 25 applicants/i.test(txt)) {
          applicantCount = 20;
          isEarlyBird = true;
        } else {
          const m = txt.match(/(\d+)\s+applicants?/i);
          if (m) {
            applicantCount = parseInt(m[1]!, 10);
            isEarlyBird = applicantCount <= 25;
          } else if (/over\s+(\d+)/i.test(txt)) {
            applicantCount = 150;
            isEarlyBird = false;
          }
        }
      }
      if (/posted\s+|ago\b|reposted/i.test(txt)) {
        const timeMatch = txt.match(/(\d+\s+(?:hour|minute|day|week)s?\s+ago)/i);
        postedText = timeMatch ? timeMatch[1]! : txt;
      }
    } else {
      const doc: Document | Element | null =
        target || (typeof document !== "undefined" ? document : null);
      if (!doc || typeof (doc as any).querySelectorAll !== "function") return null;

      const bulletCandidates = Array.from(
        doc.querySelectorAll(
          ".jobs-unified-top-card__bullet, .jobs-unified-top-card__bullet-item, .job-details-jobs-unified-top-card__bullet, .jobs-unified-top-card__subtitle-secondary-grouping span, [class*='applicant-count'], [class*='num-applicants'], .jobsearch-HiringInsights-entry--bullet"
        )
      );

      for (const el of bulletCandidates) {
        const txt = el.textContent?.trim() || "";
        if (/applicant/i.test(txt)) {
          applicantText = txt;
          if (/be among the first 25 applicants/i.test(txt)) {
            applicantCount = 20;
            isEarlyBird = true;
          } else {
            const m = txt.match(/(\d+)\s+applicant/i);
            if (m) {
              applicantCount = parseInt(m[1]!, 10);
              isEarlyBird = applicantCount <= 25;
            } else if (/over\s+(\d+)/i.test(txt)) {
              applicantCount = 150;
              isEarlyBird = false;
            }
          }
        }
        if (/posted\s+|ago\b/i.test(txt)) {
          postedText = txt;
        }
      }

      if (!applicantText) {
        const topCard = doc.querySelector(".jobs-unified-top-card, .job-details-jobs-unified-top-card, header");
        if (topCard) {
          const allText = topCard.textContent || "";
          if (/be among the first 25 applicants/i.test(allText)) {
            applicantText = "Be among the first 25 applicants";
            applicantCount = 20;
            isEarlyBird = true;
          } else {
            const m = allText.match(/(\d+)\s+applicants?/i);
            if (m) {
              applicantCount = parseInt(m[1]!, 10);
              isEarlyBird = applicantCount <= 25;
              applicantText = `${applicantCount} applicants`;
            }
          }
          const timeMatch = allText.match(/(\d+\s+(?:hour|minute|day|week)s?\s+ago)/i);
          if (timeMatch) postedText = timeMatch[1]!;
        }
      }
    }

    const isRecentPost = /\b(?:minute|hour|today|just\s*posted)\b/i.test(postedText);
    if (isRecentPost && applicantCount === undefined) {
      isEarlyBird = true;
    }

    const labels = earlyAdvantageFromApplicantSignals({
      applicantCount,
      isRecentPost,
      applicantText,
      postedText,
    });
    if (!labels) return null;

    const advantageScore =
      labels.salienceTier === "early"
        ? 95
        : labels.salienceTier === "moderate"
          ? 75
          : labels.salienceTier === "competitive"
            ? 35
            : 60;

    return {
      applicantCount,
      applicantText: applicantText || (applicantCount ? `${applicantCount} applicants` : undefined),
      postedText: postedText || undefined,
      isEarlyBird: labels.isEarlyBird,
      advantageScore,
      callbackMultiplier: labels.salienceTier,
      salienceTier: labels.salienceTier,
      badgeText: labels.badgeText,
    };
  } catch {
    return null;
  }
}

export function extractHiringTeam(target?: Document | Element | string | null): HiringTeamInfo | null {
  try {
    if (typeof target === "string") {
      const txt = target.trim();
      if (!txt) return null;
      const m1 = txt.match(/Hiring team:\s*([A-Z][a-z]+ [A-Z][a-z]+)(?:[·\s-]+([^,\n]+))?/i);
      if (m1 && m1[1]) {
        return {
          name: m1[1].trim(),
          title: m1[2]?.trim() || undefined,
        };
      }
      const m2 = txt.match(/Meet the hiring team\s*\n\s*([A-Z][a-z]+ [A-Z][a-z]+)(?:\n\s*([^,\n]+))?/i);
      if (m2 && m2[1]) {
        return {
          name: m2[1].trim(),
          title: m2[2]?.trim() || undefined,
        };
      }
      const m3 = txt.match(/(?:hiring manager|recruiter|talent partner):\s*([A-Z][a-z]+ [A-Z][a-z]+)/i);
      if (m3 && m3[1]) {
        return {
          name: m3[1].trim(),
        };
      }
      return null;
    }

    const doc: Document | Element | null =
      target || (typeof document !== "undefined" ? document : null);
    if (!doc || typeof (doc as any).querySelector !== "function") return null;

    const hirerCard = doc.querySelector(
      ".hirer-card__hirer-information, .jobs-poster, [class*='hirer-card'], .job-details-hirer-card"
    );
    if (hirerCard) {
      const nameEl = hirerCard.querySelector(
        ".jobs-poster__name, strong, h3, a[data-control-name='jobdetails_shared_hirer'], .hirer-card__hirer-information strong"
      );
      const titleEl = hirerCard.querySelector(
        ".jobs-poster__headline, .hirer-card__hirer-job-title, [class*='headline'], p"
      );
      const linkEl = hirerCard.querySelector<HTMLAnchorElement>("a[href*='/in/']");

      const name = nameEl?.textContent?.trim();
      if (name && name.length > 2 && !/linkedin|premium|hiring team/i.test(name)) {
        return {
          name,
          title: titleEl?.textContent?.trim() || undefined,
          profileUrl: linkEl?.href || undefined,
        };
      }
    }

    const bodyText = (doc as any).body?.textContent || doc.textContent;
    const recruiterRegexMatch = bodyText?.match(/(?:hiring manager|recruiter|talent partner):\s*([A-Z][a-z]+ [A-Z][a-z]+)/i);
    if (recruiterRegexMatch && recruiterRegexMatch[1]) {
      return {
        name: recruiterRegexMatch[1].trim(),
      };
    }

    return null;
  } catch {
    return null;
  }
}

function extractDescriptionLinkedIn(): string {
  const blocks = Array.from(
    document.querySelectorAll(
      [
        "#job-details",
        ".jobs-description__content",
        ".jobs-description-content__text",
        ".jobs-box__html-content",
        "[data-job-description]",
        '[data-test-id*="job-description"]',
        '[class*="jobs-description"]',
      ].join(",")
    )
  );
  let best = "";
  for (const b of blocks) {
    if (!(b instanceof HTMLElement) || b.closest("#sja-persistent-docked-panel-container, dialog, [role='dialog']")) continue;
    const style = getComputedStyle(b);
    if (style.display === "none" || style.visibility === "hidden" || b.getClientRects().length === 0) continue;
    const clone = b.cloneNode(true) as HTMLElement;
    clone.querySelectorAll("button, script, style, [aria-hidden='true']").forEach((node) => node.remove());
    const text = normalizeDescription(clone.innerText || clone.textContent || "");
    if (text.length > best.length) best = text;
  }
  return best;
}

function linkedInJobUrl(url: string): string {
  const viewMatch = url.match(/\/jobs\/view\/(\d+)/i);
  if (viewMatch) return `https://www.linkedin.com/jobs/view/${viewMatch[1]}`;

  const paramMatch = url.match(/[?&]currentJobId=(\d+)/);
  if (paramMatch) return `https://www.linkedin.com/jobs/view/${paramMatch[1]}`;

  if (/post-apply|next-best-action/i.test(url)) {
    const id =
      document.querySelector("[data-job-id]")?.getAttribute("data-job-id") ??
      document.querySelector("[data-occludable-job-id]")?.getAttribute("data-occludable-job-id");
    if (id) return `https://www.linkedin.com/jobs/view/${id}`;
  }

  return url.split("?")[0];
}

function cleanLinkedInTitle(title: string): string {
  return title.replace(/\s*\|\s*LinkedIn.*$/i, "").trim();
}

function readSelectors(selectors: string[]): string {
  for (const s of selectors) {
    const el = document.querySelector<HTMLElement>(s);
    if (!el) continue;
    if (el.tagName === "META") return el.getAttribute("content") ?? "";
    const text = el.textContent?.trim();
    if (text && text.length > 1 && !/^linkedin$/i.test(text)) return text;
  }
  return "";
}

function extractDescription(): string {
  const candidates = Array.from(
    document.querySelectorAll(
      "article, [data-job-description], [class*=job-description], [class*=job-desc], [class*=posting-content], #job-description"
    )
  );
  let best = "";
  for (const c of candidates) {
    if (!(c instanceof HTMLElement) || c.closest("#sja-persistent-docked-panel-container, dialog, [role='dialog']")) continue;
    const style = getComputedStyle(c);
    if (style.display === "none" || style.visibility === "hidden" || c.getClientRects().length === 0) continue;
    const clone = c.cloneNode(true) as HTMLElement;
    clone.querySelectorAll("button, script, style, [aria-hidden='true']").forEach((node) => node.remove());
    const text = normalizeDescription(clone.innerText || clone.textContent || "");
    if (text.length > best.length) best = text;
  }
  return best;
}

function normalizeDescription(value: string): string {
  return value
    .replace(/\u00a0/g, " ")
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function guessCompanyFromUrl(url: string): string {
  try {
    const u = new URL(url);
    if (/linkedin/i.test(u.hostname)) return "";
    const host = u.hostname.replace(/^www\./, "").split(".")[0];
    return host.charAt(0).toUpperCase() + host.slice(1);
  } catch {
    return "";
  }
}

function clean(s: string | null | undefined): string {
  if (!s) return "";
  return s.replace(/\s+/g, " ").trim().slice(0, 200);
}

export function isJobPageUrl(url: string): boolean {
  try {
    const u = url.toLowerCase();
    return (
      /job|career|apply|posting|recruit|position|vacancy|workday|greenhouse|lever|ashby|icims|ripplehire|infosys|wellfound|jobs\./.test(u) ||
      u.includes("/view/") ||
      u.includes("/j/") ||
      u.includes("/p/")
    );
  } catch {
    return false;
  }
}
