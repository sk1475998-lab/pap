/**
 * Operation Zero-Defect: AI Answer Memory & Review Center (Feature #8)
 * Stores AI-generated custom question answers so users can review, rate, and reuse them.
 * Enhanced with Hybrid Semantic Matching (Mind2Web / AgentGym architecture)
 * for cross-form question matching with tokenized Jaccard overlap and stem similarity.
 */
import { isChromeRuntimeValid } from "./runtime-guard.js";
import { getStore } from "@superjob/core";

export interface SavedAnswer {
  id: string;
  question: string;
  answer: string;
  jobTitle?: string;
  company?: string;
  rating?: 'up' | 'down';
  timestamp: number;
}

const STORAGE_KEY = "sja-answer-memory";

const STOP_WORDS = new Set([
  "a", "an", "the", "in", "on", "of", "for", "to", "at", "by", "with", "from",
  "is", "are", "was", "were", "be", "been", "being", "do", "does", "did",
  "you", "your", "yours", "have", "has", "had", "how", "many", "much", "what",
  "when", "where", "why", "which", "who", "whom", "this", "that", "these", "those",
  "please", "state", "enter", "indicate", "specify", "select", "choose", "provide", "possible"
]);

// Canonical semantic clusters for common ATS and job board screening questions
const SYNONYM_MAP: Record<string, string> = {
  // Compensation
  salary: "compensation",
  salaries: "compensation",
  compensation: "compensation",
  pay: "compensation",
  wage: "compensation",
  wages: "compensation",
  desired: "expectation",
  expectation: "expectation",
  expectations: "expectation",
  expected: "expectation",

  // Authorization
  authorized: "work_auth",
  authorization: "work_auth",
  eligible: "work_auth",
  eligibility: "work_auth",
  legally: "work_auth",
  legal: "work_auth",
  work: "work_auth",
  employment: "work_auth",
  us: "united_states",
  usa: "united_states",
  united: "united_states",
  states: "united_states",

  // Sponsorship
  sponsor: "sponsorship",
  sponsorship: "sponsorship",
  visa: "sponsorship",
  h1b: "sponsorship",
  require: "require_sponsor",
  need: "require_sponsor",

  // Experience
  experience: "experience",
  exp: "experience",
  years: "experience",
  year: "experience",

  // Date / Notice
  start: "start_date",
  date: "start_date",
  earliest: "start_date",
  notice: "start_date",
  period: "start_date",
  availability: "start_date",
  available: "start_date",

  // Demographics / Gender
  gender: "gender_identity",
  sex: "gender_identity",
  identity: "gender_identity",

  // Links
  url: "link",
  link: "link",
  profile: "link",
  website: "link",
  portfolio: "link",

  // Management
  manage: "management",
  managing: "management",
  management: "management",
  lead: "management",
  leadership: "management",
};

const HIGH_VALUE_CONCEPTS = new Set([
  "compensation",
  "work_auth",
  "sponsorship",
  "require_sponsor",
  "start_date",
  "gender_identity",
  "link",
  "management",
]);

function isNegated(question: string): boolean {
  return /\b(?:not|no|never|without|cannot|can't|don't|doesn't|won't|isn't|aren't|neither)\b/i.test(question);
}

/**
 * Compute semantic similarity between two question strings using tokenized
 * Jaccard overlap, canonical synonym clustering, stem similarity, and ATS intent weighting.
 */
export function computeQuestionSimilarity(q1: string, q2: string): number {
  const norm1 = q1.toLowerCase().replace(/[^a-z0-9\s]/g, " ").trim();
  const norm2 = q2.toLowerCase().replace(/[^a-z0-9\s]/g, " ").trim();
  if (norm1 === norm2) return 1.0;
  const sensitiveIntent = /\b(?:sponsor(?:ship)?|visa|authorized|authorised|eligible|citizen(?:ship)?|work permit|right to work)\b/i;
  if (sensitiveIntent.test(norm1) && sensitiveIntent.test(norm2) && isNegated(q1) !== isNegated(q2)) return 0;

  const rawTokens1 = norm1.split(/\s+/).filter((t) => t.length > 1 && !STOP_WORDS.has(t));
  const rawTokens2 = norm2.split(/\s+/).filter((t) => t.length > 1 && !STOP_WORDS.has(t));

  if (rawTokens1.length === 0 || rawTokens2.length === 0) {
    return norm1 === norm2 ? 1.0 : 0.0;
  }

  // Map each token to its canonical semantic concept or 4-character morphological stem
  const canonicalize = (w: string) => SYNONYM_MAP[w] || (w.length > 4 ? w.slice(0, 4) : w);
  const concepts1 = new Set(rawTokens1.map(canonicalize));
  const concepts2 = new Set(rawTokens2.map(canonicalize));

  let intersection = 0;
  let sharedDomainConcepts = 0;
  for (const c of concepts1) {
    if (concepts2.has(c)) {
      intersection++;
      if (HIGH_VALUE_CONCEPTS.has(c)) {
        sharedDomainConcepts++;
      }
    }
  }
  const union = new Set([...concepts1, ...concepts2]).size;
  const jaccard = union > 0 ? intersection / union : 0;
  const domainBonus = sharedDomainConcepts > 0 ? Math.min(0.35, sharedDomainConcepts * 0.18) : 0;
  const substringBonus = (norm1.includes(norm2) || norm2.includes(norm1)) ? 0.2 : 0;

  return Math.min(1.0, jaccard + domainBonus + substringBonus);
}

export async function saveAnswer(answer: Omit<SavedAnswer, "id" | "timestamp">): Promise<SavedAnswer | undefined> {
  if (!isChromeRuntimeValid()) return;
  const data = await chrome.storage.local.get(STORAGE_KEY) as Record<string, unknown>;
  const memory: SavedAnswer[] = Array.isArray(data[STORAGE_KEY]) ? data[STORAGE_KEY] as SavedAnswer[] : [];
  
  // Deduplicate existing identical question entries
  const existingIdx = memory.findIndex(
    (a) => computeQuestionSimilarity(a.question, answer.question) >= 0.95
  );

  const newAnswer: SavedAnswer = {
    ...answer,
    id: existingIdx !== -1 ? memory[existingIdx].id : crypto.randomUUID(),
    timestamp: Date.now()
  };

  if (existingIdx !== -1) {
    memory[existingIdx] = newAnswer;
  } else {
    memory.unshift(newAnswer);
  }
  
  // Keep the last 1000 answers to prevent storage bloat
  await chrome.storage.local.set({ [STORAGE_KEY]: memory.slice(0, 1000) });
  const store = getStore();
  const shared = await store.get<SavedAnswer[]>("savedAnswers") ?? [];
  const sharedIndex = shared.findIndex((saved) =>
    saved.id === newAnswer.id || computeQuestionSimilarity(saved.question, newAnswer.question) >= 0.95
  );
  const nextShared = [...shared];
  if (sharedIndex >= 0) nextShared[sharedIndex] = newAnswer;
  else nextShared.unshift(newAnswer);
  await store.set("savedAnswers", nextShared.slice(0, 1000));
  return newAnswer;
}

export async function getAnswers(): Promise<SavedAnswer[]> {
  if (!isChromeRuntimeValid()) return [];
  const data = await chrome.storage.local.get(STORAGE_KEY) as Record<string, unknown>;
  const local = Array.isArray(data[STORAGE_KEY]) ? data[STORAGE_KEY] as SavedAnswer[] : [];
  const shared = await getStore().get<SavedAnswer[]>("savedAnswers") ?? [];
  const merged = new Map<string, SavedAnswer>();
  for (const answer of [...shared, ...local]) {
    if (!answer || typeof answer.question !== "string" || typeof answer.answer !== "string") continue;
    const match = [...merged.values()].find((saved) => computeQuestionSimilarity(saved.question, answer.question) >= 0.95);
    merged.set(match?.id ?? answer.id ?? crypto.randomUUID(), match ? { ...match, ...answer } : answer);
  }
  return [...merged.values()];
}

/**
 * Retrieve the best matching historical answer for a screening question.
 * Reuses verified answers without calling the LLM.
 */
export async function findSemanticAnswer(
  question: string,
  minScore = 0.65
): Promise<{ answer: SavedAnswer; score: number } | undefined> {
  const answers = await getAnswers();
  if (!answers.length) return undefined;

  let bestMatch: { answer: SavedAnswer; score: number } | undefined;

  for (const a of answers) {
    if (a.rating === "down") continue; // Never reuse downvoted answers
    let score = computeQuestionSimilarity(question, a.question);
    if (a.rating === "up") score = Math.min(1.0, score + 0.15); // Boost approved, capped at 1.0

    if (score >= minScore && (!bestMatch || score > bestMatch.score)) {
      bestMatch = { answer: a, score };
    }
  }

  return bestMatch;
}

export async function rateAnswer(id: string, rating: 'up' | 'down'): Promise<void> {
  if (!isChromeRuntimeValid()) return;
  const data = await chrome.storage.local.get(STORAGE_KEY) as Record<string, unknown>;
  const memory: SavedAnswer[] = Array.isArray(data[STORAGE_KEY]) ? data[STORAGE_KEY] as SavedAnswer[] : [];
  const index = memory.findIndex(a => a.id === id);
  if (index !== -1) {
    memory[index].rating = rating;
    await chrome.storage.local.set({ [STORAGE_KEY]: memory });
  }
}
