/**
 * JSON-LD / schema.org JobPosting generic detector (Teal-inspired).
 *
 * For unrecognized sites, look for <script type="application/ld+data"> blocks
 * containing schema.org/JobPosting and return a normalized job object. This
 * allows generic fallback detection even without a per-site adapter.
 *
 * Also checks:
 *  - meta[property="og:title"] / og:description / og:site_name
 *  - <title>
 *  - [data-testid="jobTitle"], [class*="job-title"] etc. as fallbacks
 */

export interface GenericJobDetection {
  /** Where the job info came from */
  source: "jsonld" | "og" | "heuristic" | "none";
  title: string | null;
  company: string | null;
  description: string | null;
  location: string | null;
  employmentType: string | null;
  datePosted: string | null;
  /** Raw parsed JSON-LD for debugging */
  raw?: unknown;
  /** Confidence 0-1 */
  confidence: number;
}

function text(el: Element | null | undefined): string | null {
  if (!el) return null;
  const t = (el.textContent ?? "").trim().replace(/\s+/g, " ");
  return t.length > 0 ? t : null;
}

function attr(el: Element | null | undefined, name: string): string | null {
  if (!el) return null;
  const v = el.getAttribute(name);
  return v && v.trim().length > 0 ? v.trim() : null;
}

/** Walk a possibly-nested JSON-LD graph looking for JobPosting nodes. */
function findJobPosting(node: unknown): Record<string, unknown> | null {
  if (!node || typeof node !== "object") return null;
  const n = node as Record<string, unknown>;
  const t = n["@type"];
  const types = Array.isArray(t) ? t : [t];
  if (types.some((tt) => typeof tt === "string" && tt.toLowerCase().includes("jobposting"))) {
    return n;
  }
  if (Array.isArray(n["@graph"])) {
    for (const child of n["@graph"]) {
      const hit = findJobPosting(child);
      if (hit) return hit;
    }
  }
  if (Array.isArray(n)) {
    for (const child of n) {
      const hit = findJobPosting(child);
      if (hit) return hit;
    }
  }
  if (n.mainEntity) {
    const hit = findJobPosting(n.mainEntity);
    if (hit) return hit;
  }
  return null;
}

function pickString(v: unknown): string | null {
  if (typeof v === "string") return v.trim() || null;
  if (typeof v === "number") return String(v);
  if (v && typeof v === "object") {
    // schema.org name / value patterns
    const obj = v as Record<string, unknown>;
    if (typeof obj.name === "string") return obj.name.trim();
    if (typeof obj.value === "string") return obj.value.trim();
  }
  return null;
}

function pickLocation(v: unknown): string | null {
  if (!v) return null;
  if (typeof v === "string") return v.trim();
  if (Array.isArray(v)) return v.map(pickLocation).filter(Boolean)[0] ?? null;
  if (typeof v === "object") {
    const obj = v as Record<string, unknown>;
    const parts = [pickString(obj.addressLocality), pickString(obj.addressRegion), pickString(obj.addressCountry)].filter(Boolean);
    if (obj.address && typeof obj.address === "object") {
      const addr = obj.address as Record<string, unknown>;
      const a = [pickString(addr.addressLocality), pickString(addr.addressRegion), pickString(addr.addressCountry)].filter(Boolean);
      if (a.length) return a.join(", ");
    }
    if (parts.length) return parts.join(", ");
    return pickString(obj.name);
  }
  return null;
}

function pickDescription(v: unknown): string | null {
  if (typeof v === "string") return v.trim() || null;
  return null;
}

/** Extract the longest visible text block that looks like a job description. */
function heuristicDescription(doc: Document): string | null {
  // Prefer known description containers
  const preferred = [
    "[class*='job-description']",
    "[class*='description']",
    "[id*='job-description']",
    "[data-testid*='description']",
    "[class*='details']",
    "article",
    "main",
  ];
  for (const sel of preferred) {
    const el = doc.querySelector(sel);
    if (el && el.textContent && el.textContent.trim().length > 200) {
      return el.textContent.trim().replace(/\s+/g, " ").slice(0, 8000);
    }
  }
  // Fallback: largest <p>-rich block
  let best: Element | null = null;
  let bestScore = 0;
  const candidates = doc.querySelectorAll("div, section, article");
  for (const c of candidates) {
    const ps = c.querySelectorAll("p").length;
    const len = c.textContent?.length ?? 0;
    const score = ps * 50 + Math.min(len, 4000);
    if (score > bestScore && len > 300) {
      bestScore = score;
      best = c;
    }
  }
  return best ? text(best) : null;
}

function heuristicCompany(doc: Document): string | null {
  const meta = doc.querySelector('meta[property="og:site_name"]');
  if (meta?.getAttribute("content")) return meta.getAttribute("content")!.trim();
  const selectors = [
    "[class*='company-name']",
    "[class*='companyName']",
    "[data-testid*='company']",
    "[class*='employer']",
    "a[class*='company']",
  ];
  for (const sel of selectors) {
    const el = doc.querySelector(sel);
    const t = text(el);
    if (t && t.length < 80) return t;
  }
  return null;
}

function heuristicTitle(doc: Document): string | null {
  const h1 = doc.querySelector("h1");
  const t = text(h1);
  if (t && t.length < 160) return t;
  const og = doc.querySelector('meta[property="og:title"]')?.getAttribute("content");
  if (og) return og.trim();
  const titleEl = doc.querySelector("title");
  const t2 = text(titleEl);
  if (t2) {
    // Strip trailing " - company | Careers" boilerplate
    return t2.split(/[-–|]/)[0].trim();
  }
  return null;
}

export function detectGenericJob(doc: Document = document): GenericJobDetection {
  // 1) JSON-LD
  const scripts = doc.querySelectorAll<HTMLScriptElement>('script[type="application/ld+json"]');
  for (const s of scripts) {
    try {
      const parsed = JSON.parse(s.textContent ?? "");
      const jp = findJobPosting(parsed);
      if (jp) {
        return {
          source: "jsonld",
          title: pickString(jp.title),
          company: pickString(jp.hiringOrganization) ?? null,
          description: pickDescription(jp.description),
          location: pickLocation(jp.jobLocation),
          employmentType: pickString(jp.employmentType),
          datePosted: pickString(jp.datePosted),
          raw: jp,
          confidence: 0.95,
        };
      }
    } catch {
      /* malformed JSON-LD — skip */
    }
  }

  // 2) OpenGraph
  const ogTitle = attr(doc.querySelector('meta[property="og:title"]'), "content");
  const ogDesc = attr(doc.querySelector('meta[property="og:description"]'), "content");
  const ogSite = attr(doc.querySelector('meta[property="og:site_name"]'), "content");
  if (ogTitle && (ogDesc || ogSite) && /job|career|hire|apply|engineer|position/i.test(`${ogTitle} ${ogDesc ?? ""}`)) {
    return {
      source: "og",
      title: ogTitle,
      company: ogSite ?? null,
      description: ogDesc,
      location: null,
      employmentType: null,
      datePosted: null,
      confidence: 0.6,
    };
  }

  // 3) Heuristics — only when we find a plausible title + description
  const hTitle = heuristicTitle(doc);
  const hCompany = heuristicCompany(doc);
  const hDesc = heuristicDescription(doc);
  if (hTitle && hDesc && hDesc.length > 200) {
    return {
      source: "heuristic",
      title: hTitle,
      company: hCompany,
      description: hDesc,
      location: null,
      employmentType: null,
      datePosted: null,
      confidence: 0.4,
    };
  }

  return {
    source: "none",
    title: hTitle,
    company: hCompany,
    description: hDesc,
    location: null,
    employmentType: null,
    datePosted: null,
    confidence: 0,
  };
}
