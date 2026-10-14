/**
 * Field/option similarity scoring — best-match resolution over a candidate
 * list, used to map form-field labels and dropdown option text to canonical
 * profile fields/values.
 *
 * CAPABILITY ORIGIN / PROVENANCE:
 * Concept inspired by `autoApplylinkedin/content/utils.js` (IliyaBrook), which
 * ships a fuzzy field-matching library (Levenshtein, Jaro-Winkler, stemming,
 * token/ngram similarity, threshold `findBestMatch` with exact-match
 * short-circuit). That repository's license is **custom non-commercial** and
 * forbids copying, so this file is an independent CLEAN-ROOM re-expression:
 * it implements only the standard, published algorithms (Jaro–Winkler 1990,
 * Dice 1945 on character bigrams, Jaccard on tokens) with original code,
 * structure, weights, and thresholds. No code was copied from the reference.
 *
 * SJA already ships regex-rule + Levenshtein classification in `resolver.ts`;
 * this module adds length-independent char-level and character-ngram scoring
 * for short, typo-prone labels/options.
 */

export interface BestMatchResult<T> {
  /** The best-matching candidate (undefined when none clears the threshold). */
  match: T | undefined;
  /** Blended similarity score of the best candidate in [0,1]. */
  score: number;
  /** All candidates sorted best-first with their blended scores. */
  ranked: Array<{ item: T; score: number }>;
}

export interface FindBestOptions {
  /** Minimum blended score to accept a match (default 0.6). */
  threshold?: number;
  /** Case-sensitive comparison (default false). */
  caseSensitive?: boolean;
  /** Weights controlling the blended score. */
  weights?: { char?: number; bigram?: number; token?: number };
}

const DEFAULT_WEIGHTS = { char: 0.55, bigram: 0.25, token: 0.2 };
const STOP = new Set(["a", "an", "the", "of", "for", "in", "on", "at", "to", "and", "or", "your", "what", "is", "are", "do", "you", "please", "enter", "select", "provide"]);

/** Lowercase + trim, collapse internal whitespace/punctuation runs. */
export function normalizeFieldText(text: string, caseSensitive = false): string {
  let t = text.trim().replace(/[\s_-]+/g, " ");
  if (!caseSensitive) t = t.toLowerCase();
  return t;
}

/** Split into non-trivial word tokens (stopwords dropped). */
export function tokenizeFieldText(text: string, caseSensitive = false): string[] {
  const normalized = normalizeFieldText(text, caseSensitive);
  return normalized
    .split(/[^a-z0-9'’]+/i)
    .filter((w) => w.length > 1 && !STOP.has(w.toLowerCase()));
}

/**
 * Standard Jaro similarity (1989) then Winkler prefix boost (1990).
 * Returns [0,1]; robust for short strings and transpositions.
 */
export function jaroWinklerSimilarity(a: string, b: string): number {
  const A = a.trim();
  const B = b.trim();
  if (A === B) return 1;
  if (A.length === 0 || B.length === 0) return 0;

  const matchWindow = Math.max(0, Math.floor(Math.max(A.length, B.length) / 2) - 1);
  const aMatch = new Array<boolean>(A.length).fill(false);
  const bMatch = new Array<boolean>(B.length).fill(false);
  let matches = 0;

  for (let i = 0; i < A.length; i++) {
    const lo = Math.max(0, i - matchWindow);
    const hi = Math.min(i + matchWindow + 1, B.length);
    for (let j = lo; j < hi; j++) {
      if (!bMatch[j] && A[i] === B[j]) {
        aMatch[i] = true;
        bMatch[j] = true;
        matches++;
        break;
      }
    }
  }
  if (matches === 0) return 0;

  // Count transpositions (order mismatches among matched chars)
  let k = 0;
  let transpositions = 0;
  for (let i = 0; i < A.length; i++) {
    if (!aMatch[i]) continue;
    while (!bMatch[k]) k++;
    if (A[i] !== B[k]) transpositions++;
    k++;
  }
  const m = matches;
  const jaro = (m / A.length + m / B.length + (m - transpositions / 2) / m) / 3;

  // Winkler prefix boost (max 4 chars)
  let prefix = 0;
  for (let i = 0; i < Math.min(A.length, B.length, 4); i++) {
    if (A[i] === B[i]) prefix++;
    else break;
  }
  return jaro + prefix * 0.1 * (1 - jaro);
}

/** Dice coefficient over character bigrams. */
export function bigramDiceSimilarity(a: string, b: string): number {
  const bigrams = (s: string): Map<string, number> => {
    const out = new Map<string, number>();
    for (let i = 0; i < s.length - 1; i++) {
      const bg = s.slice(i, i + 2);
      out.set(bg, (out.get(bg) ?? 0) + 1);
    }
    return out;
  };
  const A = bigrams(a.toLowerCase());
  const B = bigrams(b.toLowerCase());
  if (A.size === 0 || B.size === 0) return a.toLowerCase() === b.toLowerCase() ? 1 : 0;
  let overlap = 0;
  for (const [bg, count] of A) {
    const inB = B.get(bg) ?? 0;
    if (inB > 0) overlap += Math.min(count, inB);
  }
  const totalA = [...A.values()].reduce((s, n) => s + n, 0);
  const totalB = [...B.values()].reduce((s, n) => s + n, 0);
  return (2 * overlap) / (totalA + totalB);
}

/** Jaccard index over word-token sets. */
export function tokenJaccardSimilarity(a: string, b: string, caseSensitive = false): number {
  const ta = new Set(tokenizeFieldText(a, caseSensitive));
  const tb = new Set(tokenizeFieldText(b, caseSensitive));
  if (ta.size === 0 || tb.size === 0) return 0;
  let inter = 0;
  for (const t of ta) if (tb.has(t)) inter++;
  return inter / (ta.size + tb.size - inter);
}

/**
 * Blended similarity in [0,1] combining character-level (Jaro-Winkler),
 * character-bigram (Dice) and word-token (Jaccard) signals.
 */
export function blendedSimilarity(a: string, b: string, weights: typeof DEFAULT_WEIGHTS = DEFAULT_WEIGHTS): number {
  const A = a.trim();
  const B = b.trim();
  if (A === B) return 1;
  if (A.length === 0 || B.length === 0) return 0;
  const char = jaroWinklerSimilarity(A, B);
  const bigram = bigramDiceSimilarity(A, B);
  const token = tokenJaccardSimilarity(A, B);
  return Math.max(0, Math.min(1, char * weights.char + bigram * weights.bigram + token * weights.token));
}

/**
 * Find the best matching candidate for `query`.
 * Exact (normalized) equality short-circuits with score 1; otherwise all
 * candidates are scored and only those at/above `threshold` are considered.
 */
export function findBestMatch<T>(
  query: string,
  candidates: readonly T[],
  getText: (item: T) => string,
  options: FindBestOptions = {}
): BestMatchResult<T> {
  const caseSensitive = options.caseSensitive ?? false;
  const threshold = options.threshold ?? 0.6;
  const weights = { ...DEFAULT_WEIGHTS, ...options.weights };
  const q = normalizeFieldText(query, caseSensitive);

  const ranked: Array<{ item: T; score: number }> = [];
  for (const item of candidates) {
    const c = normalizeFieldText(getText(item), caseSensitive);
    let score = c === q ? 1 : blendedSimilarity(q, c, weights);
    if (q.length > 0 && c.length === 0) score = 0;
    ranked.push({ item, score });
  }
  ranked.sort((a, b) => b.score - a.score);
  const best = ranked[0];
  return {
    match: best && best.score >= threshold ? best.item : undefined,
    score: best ? best.score : 0,
    ranked,
  };
}

export interface OptionLike {
  label: string;
  value: string;
}

/**
 * Match a desired value against a list of `<option>`-like entries. Both the
 * option label and value are considered; the best of the two scores wins.
 * Useful for select/radio option resolution where a canonical profile value
 * ("United States") must map onto the ATS's own phrasing ("United States of
 * America (the)").
 */
export function bestOptionMatch(
  desired: string,
  options: readonly OptionLike[],
  threshold = 0.72
): { option: OptionLike | undefined; score: number; ranked: Array<{ option: OptionLike; score: number }> } {
  const ranked = options
    .map((option) => {
      const labelScore = blendedSimilarity(desired, option.label);
      const valueScore = blendedSimilarity(desired, option.value);
      return { option, score: Math.max(labelScore, valueScore) };
    })
    .sort((a, b) => b.score - a.score);
  const best = ranked[0];
  return {
    option: best && best.score >= threshold ? best.option : undefined,
    score: best ? best.score : 0,
    ranked,
  };
}
