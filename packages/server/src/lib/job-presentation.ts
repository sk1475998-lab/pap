/**
 * Presentation helpers shared by every route that renders a posting.
 *
 * `iconFor` and `tagsFor` were defined in `routes/jobs.ts`, and `routes/company.ts`
 * needs both. The tag extractor is the one worth protecting from copies: it derives
 * skill tags from core's keyword extractor plus the skill graph, and the whole point
 * of that is that the tags on a card come from the SAME ontology the match score is
 * computed from. A private list of technology names in a second file — there were
 * two such lists in this repo — can only tag what someone remembered to type into
 * it, and drifts away from the graph silently.
 */
import { canonicalSkill, extractKeywords, isKnownSkill, type Job } from "@superjob/core";

/** Decoration only. Carries no data and must never be read as one. */
const ICONS = ["🏢", "💳", "🛒", "⚡", "🤖", "💎", "🚀", "🌐", "💼", "🔥", "🔮", "📐"];

/**
 * A stable avatar for a company. Deterministic on purpose: the previous
 * `ICONS[Math.floor(Math.random() * ICONS.length)]` gave the same job a different
 * logo on every request, which reads as a bug to anyone watching the list reload.
 */
export function iconFor(company: string): string {
  let hash = 0;
  for (let i = 0; i < company.length; i++) hash = (hash * 31 + company.charCodeAt(i)) >>> 0;
  return ICONS[hash % ICONS.length]!;
}

/** The term spelled the way the employer spelled it, else the token itself. */
export function asWrittenIn(source: string, term: string): string {
  const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return source.match(new RegExp(`\\b${escaped}\\b`, "i"))?.[0] ?? term;
}

/** Skill tags for one posting, taken from the posting. */
export function tagsFor(job: Pick<Job, "title" | "description">, limit = 4): string[] {
  const source = `${job.title}\n${job.description ?? ""}`;
  const seen = new Set<string>();
  const tags: string[] = [];
  for (const kw of extractKeywords(source, 60)) {
    if (!isKnownSkill(kw.term)) continue;
    const canonical = canonicalSkill(kw.term);
    if (seen.has(canonical)) continue;
    seen.add(canonical);
    tags.push(asWrittenIn(source, kw.term));
    if (tags.length >= limit) break;
  }
  return tags;
}

/**
 * The stack an employer actually asks for, ranked by how many of their postings
 * mention it — with the count kept, because "7 of 9 postings" is the evidence and a
 * bare chip list is just an assertion.
 *
 * This replaces a hardcoded `techStack: ["TypeScript", "Python", "React", …]` that
 * `routes/company.ts` served for every company on earth.
 */
export function rankSkills(
  jobs: Pick<Job, "title" | "description">[],
  limit = 10,
): { skill: string; postings: number }[] {
  const counts = new Map<string, { label: string; postings: number }>();
  for (const job of jobs) {
    const source = `${job.title}\n${job.description ?? ""}`;
    const seenInThisJob = new Set<string>();
    for (const kw of extractKeywords(source, 80)) {
      if (!isKnownSkill(kw.term)) continue;
      const canonical = canonicalSkill(kw.term);
      // Once per posting, so one JD repeating "React" nine times does not outrank
      // a skill that nine different postings ask for once.
      if (seenInThisJob.has(canonical)) continue;
      seenInThisJob.add(canonical);
      const prev = counts.get(canonical);
      if (prev) prev.postings++;
      else counts.set(canonical, { label: asWrittenIn(source, kw.term), postings: 1 });
    }
  }
  return [...counts.values()]
    .sort((a, b) => b.postings - a.postings || a.label.localeCompare(b.label))
    .slice(0, limit)
    .map((s) => ({ skill: s.label, postings: s.postings }));
}
