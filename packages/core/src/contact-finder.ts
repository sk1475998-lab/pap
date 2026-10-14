/**
 * Contact Finder — generates recruiter/hiring manager search links and
 * personalized outreach drafts for a target company and role.
 *
 * This is a heuristic module — it generates LinkedIn People Search URLs
 * based on likely recruiter role patterns. No external API calls are made.
 */
import { generateOutreach, type OutreachTemplate } from "./outreach.js";

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

export interface RecruiterSearchResult {
  /** The role pattern we're searching for (e.g. "Technical Recruiter") */
  roleQuery: string;
  /** LinkedIn People Search URL */
  linkedinSearchUrl: string;
  /** A personalized outreach message for this recruiter type */
  outreach: OutreachTemplate;
}

export interface ContactFinderResult {
  company: string;
  jobTitle: string;
  searches: RecruiterSearchResult[];
}

/* ------------------------------------------------------------------ */
/* Recruiter role patterns                                             */
/* ------------------------------------------------------------------ */

const RECRUITER_ROLE_PATTERNS = [
  "Technical Recruiter",
  "Talent Acquisition",
  "Engineering Manager",
  "Hiring Manager",
  "HR Manager",
  "People Operations",
  "Recruiting Coordinator",
];

/**
 * Build a LinkedIn People Search URL for a specific role at a company.
 */
function buildLinkedInSearchUrl(company: string, roleQuery: string): string {
  const keywords = `${roleQuery} ${company}`;
  return `https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent(keywords)}&origin=GLOBAL_SEARCH_HEADER`;
}

/* ------------------------------------------------------------------ */
/* Main API                                                            */
/* ------------------------------------------------------------------ */

/**
 * Generate recruiter search links and outreach drafts for a target company.
 *
 * @param candidateName  Full name of the candidate (for outreach personalization)
 * @param skills         Top skills from the candidate's profile
 * @param jobTitle       The job title being applied to
 * @param company        The target company name
 * @param maxResults     Maximum number of recruiter role patterns to return (default 4)
 */
export function findRecruiters(
  candidateName: string,
  skills: string[],
  jobTitle: string,
  company: string,
  maxResults = 4
): ContactFinderResult {
  if (!company.trim()) {
    return { company, jobTitle, searches: [] };
  }

  // Pick the most relevant recruiter patterns
  const patterns = selectRelevantPatterns(jobTitle, maxResults);

  const searches: RecruiterSearchResult[] = patterns.map((roleQuery) => ({
    roleQuery,
    linkedinSearchUrl: buildLinkedInSearchUrl(company, roleQuery),
    outreach: generateOutreach(candidateName, skills, jobTitle, company),
  }));

  return { company, jobTitle, searches };
}

/**
 * Select the most relevant recruiter role patterns based on the job title.
 * Engineering roles prioritize Technical Recruiter and Engineering Manager.
 * Others get a more general mix.
 */
function selectRelevantPatterns(jobTitle: string, max: number): string[] {
  const lower = jobTitle.toLowerCase();
  const isEngineering =
    /engineer|developer|swe|sde|architect|devops|data scientist|ml |machine learning|backend|frontend|fullstack|full.?stack/i.test(lower);
  const isDesign = /design|ux|ui|product design/i.test(lower);
  const isProduct = /product manager|program manager|project manager/i.test(lower);

  let ordered: string[];

  if (isEngineering) {
    ordered = [
      "Technical Recruiter",
      "Engineering Manager",
      "Talent Acquisition",
      "Hiring Manager",
      "Recruiting Coordinator",
      "HR Manager",
      "People Operations",
    ];
  } else if (isDesign) {
    ordered = [
      "Talent Acquisition",
      "Hiring Manager",
      "Technical Recruiter",
      "HR Manager",
      "People Operations",
      "Recruiting Coordinator",
      "Engineering Manager",
    ];
  } else if (isProduct) {
    ordered = [
      "Hiring Manager",
      "Talent Acquisition",
      "Technical Recruiter",
      "HR Manager",
      "People Operations",
      "Recruiting Coordinator",
      "Engineering Manager",
    ];
  } else {
    ordered = [...RECRUITER_ROLE_PATTERNS];
  }

  return ordered.slice(0, max);
}
