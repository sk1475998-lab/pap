/**
 * Deterministic, dependency-free keyword extraction + match scoring.
 *
 * Runs entirely locally with no LLM/network — a match score is computed in
 * well under 1ms per job, which is what makes Super Job Agent feel instant
 * vs. cloud tools that round-trip to a server.
 *
 * Design:
 *   - `term` (display) keeps the original readable token: "kubernetes", "services".
 *   - matching is done on a separate `stem` key so frontend≈frontends, api≈apis.
 *   - a protected tech set is never mangled by the stemmer.
 */

const STOPWORDS = new Set(
  // standard english
  `a an and are as at be by for from has have he in is it its of on that the to was were will with you your we our us i they them their this these those or but not no can do does did done into over under out up down off again more most other some such only own same so than too very just now about above after against all am any because before being below between both during each few further here how if me my myself nor should would could`
    .split(/\s+/)
    // contractions / tokenization fragments
    .concat(`re ve ll don doesn didn won couldn wouldn shouldn isn aren wasn weren hasn haven hadn im youre theyre weve whats`.split(/\s+/))
    // generic job-description filler (keeps "gaps" meaningful)
    .concat(`role roles team teams company companies hire hiring look looking seek seeking want wants need needs required require job jobs position positions opportunity opportunities apply application candidate candidates ability strong excellent great good fit join joining across using use used work working works experience experienced year years plus preferred nice able etc ideal email please send`.split(/\s+/))
    // compensation & numeric noise (not candidate skills)
    .concat(`salary ctc lpa inr usd eur gbp compensation remuneration stipend bonus equity benefits per annum month monthly annual hourly wage wages`.split(/\s+/))
);

// protected from stemming so they read correctly & match exactly
const PROTECTED = new Set(
  `kubernetes aws gcp azure react vue angular nodejs express graphql docker postgresql postgres mongodb mysql redis github gitlab linux unix kubernetes terraform ansible jenkins circleci typescript javascript python golang rust java kotlin swift scala ruby rails django flask fastapi spring numpy pandas pytorch tensorflow keras scikit airflow spark kafka rabbitmq nginx html css sass tailwind redux graphql`.split(
    /\s+/
  )
);

export interface Keyword {
  term: string; // original readable token (display)
  weight: number;
}

export interface StemmedKeyword extends Keyword {
  stem: string; // matching key
}

/** Tokenize: lowercase, strip punctuation, drop stopwords (NO stemming). */
export function tokenize(text: string): string[] {
  const safeText = typeof text === "string" ? text : String(text ?? "");
  return (safeText.toLowerCase().match(/[a-z0-9][a-z0-9+#.\-]{1,40}/g) ?? [])
    .map((t) => t.replace(/[.\-]+$/, ""))
    .filter((t) => t.length > 1 && !STOPWORDS.has(t) && !/^[\d\-+./]+$/.test(t));
}

/** Conservative stemmer that protects tech terms. */
export function stem(w: string): string {
  if (PROTECTED.has(w) || w.length <= 3) return w;
  if (/ies$/.test(w)) return w.replace(/ies$/, "y"); // stories→story
  if (/(ses|xes|zes|ches|shes|sses)$/.test(w)) return w.replace(/es$/, ""); // boxes→box, classes→class
  if (/[^s]s$/.test(w)) return w.replace(/s$/, ""); // apis→api, services→service
  return w;
}

/** Extract ranked keywords (original terms + stems), term-frequency weighted. */
export function extractKeywords(text: string, limit = 40): StemmedKeyword[] {
  const freq = new Map<string, { term: string; stem: string; count: number }>();
  for (const tok of tokenize(text)) {
    const key = stem(tok);
    const entry = freq.get(key);
    if (entry) entry.count++;
    else freq.set(key, { term: tok, stem: key, count: 1 });
  }
  const out: StemmedKeyword[] = [];
  for (const { term, stem: s, count } of freq.values()) {
    out.push({ term, stem: s, weight: count });
  }
  out.sort((a, b) => b.weight - a.weight);
  return out.slice(0, limit);
}

import { expandSkillSet, skillCovered } from "./skill-graph.js";

export interface MatchInput {
  resumeText: string;
  jobDescription: string;
  profileSkills?: string[];
}

export interface MatchOutput {
  score: number; // 0..100
  matched: string[];
  missing: string[];
  reasons: string[];
  keywords: Keyword[];
}

export function scoreMatch(input: MatchInput): MatchOutput {
  const { resumeText, jobDescription, profileSkills = [] } = input;
  const jobKeywords = extractKeywords(jobDescription, 40);

  // resume matched on stems + skill graph inference
  const resumeStems = new Set<string>([
    ...tokenize(resumeText).map(stem),
    ...profileSkills.map((s) => stem(s.toLowerCase())),
  ]);
  const graphSkills = expandSkillSet([...profileSkills, ...tokenize(resumeText)]);

  let matchedWeight = 0;
  let totalWeight = 0;
  const matched: string[] = [];
  const missing: string[] = [];

  for (const kw of jobKeywords) {
    totalWeight += kw.weight;
    const covered =
      resumeStems.has(kw.stem) ||
      skillCovered(kw.term, graphSkills) ||
      skillCovered(kw.stem, graphSkills);
    if (covered) {
      matchedWeight += kw.weight;
      matched.push(kw.term);
    } else {
      missing.push(kw.term);
    }
  }

  const raw = totalWeight === 0 ? 0 : matchedWeight / totalWeight;
  /**
   * The score IS the weighted overlap. Nothing else.
   *
   * This line used to read `(0.35 + 0.65 * raw) * 100` — "squash toward the middle
   * so decent-but-imperfect resumes still look applyable" — which meant a résumé
   * with literally nothing in common with the posting was shown as 35% matched, and
   * no job could ever score below 35. That is not a presentation choice: this number
   * is compared against `settings.search.minMatchScore` to decide what autopilot
   * applies to, so the floor pushed real applications out the door for jobs the
   * matcher had rated zero. If a threshold now admits too little, the threshold is
   * the thing to move — the measurement stays honest.
   */
  const score = Math.round(raw * 100);

  const reasons: string[] = [];
  if (score >= 80) reasons.push("Strong overlap on core skills.");
  if (missing.length && score < 80)
    reasons.push(`Missing high-signal terms: ${missing.slice(0, 5).join(", ")}.`);
  if (jobKeywords.length)
    reasons.push(`Matched ${matched.length} of ${jobKeywords.length} job keywords.`);

  return {
    score: Math.max(0, Math.min(100, score)),
    matched,
    missing,
    reasons,
    keywords: jobKeywords.map(({ term, weight }) => ({ term, weight })),
  };
}

/**
 * Deterministic First-Pass Filter (derived from job-copilot).
 * Used to immediately discard jobs based on strict user preferences before passing to LLM.
 */
export interface JobPreferences {
  jobTitles: string[];
  workLocation: string[];
  includeKeywords: string[];
  excludeKeywords: string[];
  excludeCompanies: string[];
}

export interface FirstPassJob {
  title?: string;
  company?: string;
  location?: string;
  description?: string;
}

const FIRST_PASS_WEIGHTS = {
  titleMatch: 30,
  locationMatch: 20,
  includeKeyword: 10,
};

function normalizePref(str?: string): string {
  return str?.toLowerCase().trim() || '';
}

/**
 * Returns a score if the job passes the strict exclusion rules, or null if it fails them.
 */
export function firstPassMatch(job: FirstPassJob, prefs: JobPreferences): number | null {
  let score = 0;

  const title = normalizePref(job.title);
  const company = normalizePref(job.company);
  const location = normalizePref(job.location);
  const description = normalizePref(job.description);

  // Hard Exclusion: Companies
  if (prefs.excludeCompanies.length > 0 && prefs.excludeCompanies.some(c => company.includes(c.toLowerCase()))) {
    return null;
  }

  // Hard Exclusion: Keywords
  if (prefs.excludeKeywords.length > 0 && prefs.excludeKeywords.some(k => description.includes(k.toLowerCase()))) {
    return null;
  }

  // Title Match (+30)
  if (prefs.jobTitles.length > 0 && prefs.jobTitles.some(t => title.includes(t.toLowerCase()))) {
    score += FIRST_PASS_WEIGHTS.titleMatch;
  }

  // Location Match (+20)
  if (prefs.workLocation.length > 0 && prefs.workLocation.some(loc => location.includes(loc.toLowerCase()))) {
    score += FIRST_PASS_WEIGHTS.locationMatch;
  }

  // Included Keywords (+10 per keyword)
  if (prefs.includeKeywords.length > 0) {
    const matchedKeywords = prefs.includeKeywords.filter(k => description.includes(k.toLowerCase()));
    score += matchedKeywords.length * FIRST_PASS_WEIGHTS.includeKeyword;
  }

  return score;
}
