/**
 * Non-destructive resume enhancer.
 *
 * The #1 trust guarantee of the fleet: tailoring a resume for a specific job
 * MUST NEVER mutate the candidate's master profile / original resume. This
 * module enforces that at runtime, not just by convention:
 *
 *   1. The original profile is deep-frozen before any work begins.
 *   2. A stable SHA-256 fingerprint of the original is taken before and after.
 *      If they ever differ, we throw — a mutation bug can never ship silently.
 *   3. All tailoring operates on a structural clone; the enhanced resume is a
 *      brand-new object. The caller gets `{ original, enhanced, diff }`.
 *
 * The actual keyword-weaving reuses @superjob/core's `tailorResumeExperience`
 * (LLM, honest — never invents credentials) and `analyzeATS` for before/after
 * scoring. This module adds the safety envelope and the human-readable diff.
 */
import {
  analyzeATS,
  tailorResumeExperience,
  generateTailoredResumeText,
  type Profile,
  type WorkExperience,
} from "@superjob/core";
import type { LLMClient } from "@superjob/core";

/** A single field-level change the enhancement introduced. */
export interface ResumeDiffEntry {
  experienceId: string;
  company: string;
  title: string;
  bulletIndex: number;
  before: string;
  after: string;
}

export interface ResumeEnhancement {
  /** The untouched original resume text (verbatim from the master profile). */
  originalResumeText: string;
  /** The newly generated, job-tailored resume text. */
  enhancedResumeText: string;
  /** Keywords that were targeted for this job. */
  targetedKeywords: string[];
  /** Keywords that actually made it into the enhanced text. */
  incorporatedKeywords: string[];
  atsScoreBefore: number;
  atsScoreAfter: number;
  /** Per-bullet changes, for transparent review. */
  changes: ResumeDiffEntry[];
  /** True when the LLM was available and did the weaving; false = untouched. */
  llmApplied: boolean;
  /** Proof the original profile object was not mutated during enhancement. */
  originalFingerprint: string;
}

/**
 * Deterministic FNV-1a-ish hash is not collision-safe enough for a trust
 * guarantee, so we use Web Crypto SHA-256 (available in Node >=15 and all
 * MV3 service workers). Falls back to a structural JSON compare if crypto
 * is somehow unavailable.
 */
async function fingerprint(value: unknown): Promise<string> {
  const json = stableStringify(value);
  const cryptoObj: Crypto | undefined =
    (globalThis as { crypto?: Crypto }).crypto;
  if (cryptoObj?.subtle) {
    const bytes = new TextEncoder().encode(json);
    const digest = await cryptoObj.subtle.digest("SHA-256", bytes);
    return [...new Uint8Array(digest)]
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  }
  // Fallback: the JSON itself acts as the fingerprint (still detects mutation).
  return `json:${json.length}:${json}`;
}

/** JSON.stringify with sorted keys so field order never affects the hash. */
function stableStringify(value: unknown): string {
  return JSON.stringify(value, (_key, val) => {
    if (val && typeof val === "object" && !Array.isArray(val)) {
      return Object.keys(val)
        .sort()
        .reduce<Record<string, unknown>>((acc, k) => {
          acc[k] = (val as Record<string, unknown>)[k];
          return acc;
        }, {});
    }
    return val;
  });
}

/** Recursively freeze an object graph so accidental writes throw in strict mode. */
function deepFreeze<T>(obj: T): Readonly<T> {
  if (obj && typeof obj === "object" && !Object.isFrozen(obj)) {
    Object.freeze(obj);
    for (const key of Object.keys(obj as Record<string, unknown>)) {
      deepFreeze((obj as Record<string, unknown>)[key]);
    }
  }
  return obj as Readonly<T>;
}

/** Structural clone that works in Node and the browser, with a JSON fallback. */
function clone<T>(obj: T): T {
  const sc = (globalThis as { structuredClone?: <U>(v: U) => U }).structuredClone;
  if (typeof sc === "function") return sc(obj);
  return JSON.parse(JSON.stringify(obj)) as T;
}

function countIncorporated(text: string, keywords: string[]): string[] {
  const hay = text.toLowerCase();
  return keywords.filter((k) => k && hay.includes(k.toLowerCase()));
}

function diffExperience(
  before: WorkExperience[],
  after: WorkExperience[],
): ResumeDiffEntry[] {
  const changes: ResumeDiffEntry[] = [];
  for (const a of after) {
    const b = before.find((x) => x.id === a.id);
    if (!b) continue;
    const n = Math.min(a.bullets.length, b.bullets.length);
    for (let i = 0; i < n; i++) {
      if (a.bullets[i] !== b.bullets[i]) {
        changes.push({
          experienceId: a.id,
          company: a.company,
          title: a.title,
          bulletIndex: i,
          before: b.bullets[i]!,
          after: a.bullets[i]!,
        });
      }
    }
  }
  return changes;
}

export interface EnhanceOptions {
  /** Cap how many keyword gaps we try to weave in (default 10). */
  maxKeywords?: number;
}

/**
 * Produce a job-tailored resume WITHOUT mutating `profile`.
 *
 * @throws if the original profile object is mutated at any point (should never
 *         happen — this is a hard safety assertion that protects the user's data).
 */
export async function enhanceResumeForJob(
  profile: Profile,
  jobDescription: string,
  llm: LLMClient,
  opts: EnhanceOptions = {},
): Promise<ResumeEnhancement> {
  const originalResumeText = profile.masterResumeText || "";

  // (1) Fingerprint + freeze the original so mutation is detectable AND blocked.
  const beforeFp = await fingerprint(profile);
  deepFreeze(profile);

  // (2) All work happens on a clone. The original is never passed anywhere
  //     that writes.
  const working = clone(profile);

  // (3) Determine the keyword gaps for THIS job from the original resume text.
  const ats = analyzeATS(originalResumeText || working.skills.join(" "), jobDescription);
  const maxK = opts.maxKeywords ?? 10;
  const targetedKeywords = ats.gaps.slice(0, maxK).map((g) => g.term);

  // (4) Weave keywords into the clone's experience bullets (honest LLM rewrite,
  //     or a no-op passthrough when the LLM is unavailable).
  const tailoredExperience = await tailorResumeExperience(
    working,
    targetedKeywords,
    llm,
  );
  const llmApplied =
    llm.isAvailable() &&
    targetedKeywords.length > 0 &&
    JSON.stringify(tailoredExperience) !== JSON.stringify(working.experience);

  // (5) Build the enhanced resume text from the tailored clone.
  const enhancedResumeText = generateTailoredResumeText(
    working,
    tailoredExperience,
    targetedKeywords,
  );

  const atsAfter = analyzeATS(enhancedResumeText, jobDescription);

  // (6) HARD GUARANTEE: prove the original never changed.
  const afterFp = await fingerprint(profile);
  if (beforeFp !== afterFp) {
    throw new Error(
      "Resume immutability violation: the original profile was mutated during enhancement. " +
        "Aborting to protect the candidate's master resume.",
    );
  }

  return {
    originalResumeText,
    enhancedResumeText,
    targetedKeywords,
    incorporatedKeywords: countIncorporated(enhancedResumeText, targetedKeywords),
    atsScoreBefore: ats.score,
    atsScoreAfter: atsAfter.score,
    changes: diffExperience(working.experience, tailoredExperience),
    llmApplied,
    originalFingerprint: beforeFp,
  };
}
