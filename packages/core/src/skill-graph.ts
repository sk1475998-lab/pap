/**
 * Skill graph — infer parent skills (FastAPI → Python) without LLM calls.
 *
 * TWO QUESTIONS, ONE GRAPH. "Could this person do the job?" and "what is this
 * person missing?" are not the same question, and answering both with one boolean
 * is how a gap report ends up hiding the gaps. Match scoring wants adjacency to
 * count (a Python engineer can pick up FastAPI, so the job is still worth showing);
 * a gap analysis must not, or it tells the user they already have the skill they
 * came here to learn. `skillCovered` therefore takes an explicit mode instead of
 * having callers re-implement whichever half they need.
 */
import { SKILL_EDGES } from "./skill-graph-data.js";

const CHILD_TO_PARENTS = new Map<string, string[]>();
const ALIAS_TO_CHILD = new Map<string, string>();
/** Reverse of CHILD_TO_PARENTS: "python" → ["fastapi", "django", …]. */
const PARENT_TO_CHILDREN = new Map<string, string[]>();

// Aliases first, so parents can be written in ANY spelling the data author reaches
// for and still resolve. Building both in one pass meant a parent named "llm" stayed
// "llm" while the graph's canonical form was "llms", and the two never met.
for (const edge of SKILL_EDGES) {
  const child = normalizeSkill(edge.child);
  for (const a of edge.aliases ?? []) ALIAS_TO_CHILD.set(normalizeSkill(a), child);
}

for (const edge of SKILL_EDGES) {
  const child = normalizeSkill(edge.child);
  const parents = [...new Set(edge.parents.map((p) => canonicalSkill(p)))].filter((p) => p !== child);
  CHILD_TO_PARENTS.set(child, parents);
  for (const p of parents) {
    const kids = PARENT_TO_CHILDREN.get(p);
    if (kids) kids.push(child);
    else PARENT_TO_CHILDREN.set(p, [child]);
  }
}

export function normalizeSkill(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, " ");
}

/** The canonical name for a skill, resolving aliases ("k8s" → "kubernetes"). */
export function canonicalSkill(s: string): string {
  const key = normalizeSkill(s);
  return ALIAS_TO_CHILD.get(key) ?? key;
}

/** Expand a skill token to itself + inferred parents (1 hop). */
export function expandSkill(skill: string): string[] {
  const canonical = canonicalSkill(skill);
  const parents = CHILD_TO_PARENTS.get(canonical) ?? [];
  return [...new Set([canonical, ...parents])];
}

/**
 * Does the ontology know this token as a skill at all — as a child, a parent, or
 * an alias of either?
 *
 * This is the "is this word worth showing as a tag?" question. Callers that want
 * to pull skills out of free text (a job description, a résumé) otherwise end up
 * keeping a private list of technology names — there was one in the jobs route
 * and another in the ATS analyzer's neighbourhood — and those lists then rot
 * independently of the graph everything else matches against.
 */
export function isKnownSkill(skill: string): boolean {
  const canonical = canonicalSkill(skill);
  return CHILD_TO_PARENTS.has(canonical) || PARENT_TO_CHILDREN.has(canonical);
}

/** Expand resume/profile skills into a set including inferred parents. */
export function expandSkillSet(skills: string[]): Set<string> {
  const out = new Set<string>();
  for (const s of skills) {
    for (const x of expandSkill(s)) out.add(x);
  }
  return out;
}

/** How generous to be when deciding whether a résumé covers a job's skill. */
export interface CoverageOptions {
  /**
   * Count an adjacent skill as coverage — the résumé has one of the job skill's
   * PARENTS ("Python" for a job asking FastAPI). True by default, because match
   * scoring is asking "is this job worth showing?".
   *
   * Pass false for gap analysis, résumé-readiness, or anything that reports what
   * the user still needs to learn. Knowing Docker is not knowing Kubernetes, and
   * saying otherwise deletes the finding the user asked for.
   */
  infer?: boolean;
}

/**
 * True if the job's skill is covered by `resumeSkills`.
 *
 * `resumeSkills` is expected to come from `expandSkillSet`, which already walks
 * child → parent (a résumé saying "Next.js" covers a job asking "React"). That
 * direction is sound and always applies. `infer` controls the OTHER direction,
 * parent → child, which is a guess rather than a fact.
 */
export function skillCovered(
  jobSkill: string,
  resumeSkills: Set<string>,
  opts: CoverageOptions = {},
): boolean {
  const job = normalizeSkill(jobSkill);
  if (resumeSkills.has(job)) return true;
  const canonical = canonicalSkill(job);
  if (resumeSkills.has(canonical)) return true;
  if (opts.infer === false) return false;
  const parents = CHILD_TO_PARENTS.get(canonical) ?? [];
  return parents.some((p) => resumeSkills.has(p));
}

/**
 * Job skills the résumé does not state outright but plausibly reaches, and the
 * skill each guess leans on. Two routes, and the label says which:
 *   - "adjacent": the résumé has a PARENT of the job skill (Python → FastAPI).
 *     A lead, not a qualification.
 *   - "specific": the résumé has a CHILD of it (FastAPI → Python). This one is
 *     sound, and it is here because a JD asking for "Python" should not be listed
 *     as missing by someone who only wrote "FastAPI" on their résumé.
 */
export function inferMatches(
  jobSkills: string[],
  resumeSkills: string[],
): { job: string; via: string; kind: "adjacent" | "specific" }[] {
  const expanded = expandSkillSet(resumeSkills);
  const inferred: { job: string; via: string; kind: "adjacent" | "specific" }[] = [];
  for (const job of jobSkills) {
    const canonical = canonicalSkill(job);
    if (expanded.has(normalizeSkill(job)) || expanded.has(canonical)) continue;

    const child = (PARENT_TO_CHILDREN.get(canonical) ?? []).find((c) => expanded.has(c));
    if (child) {
      inferred.push({ job, via: child, kind: "specific" });
      continue;
    }
    const parent = (CHILD_TO_PARENTS.get(canonical) ?? []).find((p) => expanded.has(p));
    if (parent) inferred.push({ job, via: parent, kind: "adjacent" });
  }
  return inferred;
}
