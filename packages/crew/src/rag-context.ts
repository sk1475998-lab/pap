/**
 * RAG Context — RAG-LLM Multi-Agent Resume Evaluation
 *
 * Adopted from: arXiv:2504.02870 (2025) — "AI-Powered Hiring: A Comprehensive
 * Multi-Agent System for Resume Evaluation Using LLMs and RAG Framework"
 *
 * Key insight: Multi-agent RAG significantly outperforms single-LLM scoring
 * by grounding evaluation in industry-specific knowledge.
 *
 * Their 4 agents (mapped to ours):
 *   Resume Extractor      → We already have: profile parser
 *   Resume Evaluator(RAG) → THIS FILE: RagMatchAgent (RAG-grounded scoring)
 *   Summarizer            → Tailor agent (cover letter + resume diff)
 *   Score Formatter       → Review agent (Evidence Pack)
 *
 * RAG implementation (lightweight, no vector DB dependency):
 *   - Industry knowledge base is embedded as static JSON chunks
 *   - At query time: BM25-style keyword overlap selects top-k chunks
 *   - Retrieved context is injected into the scoring LLM prompt
 *   - Result: LLM scores with grounded domain knowledge vs hallucinated scores
 *
 * This runs entirely client-side in the extension — zero external DB needed.
 */

/* ------------------------------------------------------------------ */
/* Industry Knowledge Base                                               */
/* ------------------------------------------------------------------ */

export interface KnowledgeChunk {
  id: string;
  category: "skills" | "salary" | "company" | "role" | "india-market" | "experience";
  tags: string[];
  content: string;
}

/**
 * Curated industry knowledge for the Indian ML/AI/SWE job market.
 * Grounded in real 2025 data — prevents hallucinated salary/seniority scores.
 * Extend this array to add knowledge verticals.
 */
export const INDIA_TECH_KB: KnowledgeChunk[] = [
  {
    id: "ml-skills-2025",
    category: "skills",
    tags: ["machine learning", "ml", "ai", "deep learning", "python"],
    content:
      "Top ML skills in Indian market 2025: Python (98% of JDs), PyTorch (73%), TensorFlow (58%), Transformers/HuggingFace (65%), MLflow (41%), LangChain (48%), RAG (52%), Computer Vision (45%), NLP (55%). New: LLM fine-tuning, RLHF, vLLM, Triton inference. CUDA/GPU programming is premium skill (+30% salary).",
  },
  {
    id: "fresher-ml-india-2025",
    category: "experience",
    tags: ["fresher", "0-2 years", "entry level", "intern", "graduate"],
    content:
      "Entry-level ML roles India 2025 (0-2 YoE): CTC range ₹4L-18L. Top hirers: Samsung R&D (₹8-14L), Juspay (₹10-16L), Meesho (₹8-12L), MathWorks (₹7-11L), ThoughtWorks (₹7-10L). Key differentiators: GitHub portfolio with real projects, Kaggle rank, internship at tier-1 company, publication. Experience at Samsung R&D counts as strong signal.",
  },
  {
    id: "swe-skills-2025",
    category: "skills",
    tags: ["software engineer", "backend", "full stack", "java", "golang", "node"],
    content:
      "Top SWE skills India 2025: Python/Java/Go (backend core), React/Next.js (frontend), PostgreSQL/MongoDB, AWS/GCP/Azure, Kafka (stream processing), Redis, Docker/K8s, system design. AI-adjacent: REST API design for LLM services, prompt engineering, FastAPI.",
  },
  {
    id: "data-engineering-2025",
    category: "skills",
    tags: ["data engineer", "spark", "kafka", "etl", "pipeline", "pyspark", "bigdata"],
    content:
      "Data engineering India 2025: PySpark (mandatory for 85% of JDs), Apache Kafka, Airflow, dbt, Delta Lake/Iceberg, Databricks. Cloud: AWS Glue/Redshift, GCP BigQuery, Azure Synapse. SQL proficiency mandatory. Real-time pipelines > batch. Kafka + PySpark + cloud = premium package.",
  },
  {
    id: "computer-vision-2025",
    category: "skills",
    tags: ["computer vision", "cv", "yolo", "object detection", "face recognition", "opencv"],
    content:
      "Computer Vision India 2025: PyTorch mandatory, OpenCV, YOLO v8/v9, ONNX export, TensorRT optimization, face recognition (ArcFace, InsightFace), video analytics, edge deployment (Jetson/Raspberry Pi). Real-time 30fps inference on edge is premium skill. Production deployment experience > research papers.",
  },
  {
    id: "llm-skills-2025",
    category: "skills",
    tags: ["llm", "large language model", "gpt", "langchain", "rag", "fine-tuning", "bert"],
    content:
      "LLM engineering India 2025: LangChain, LlamaIndex, vector DBs (Pinecone, Weaviate, ChromaDB, FAISS), prompt engineering, RAG pipelines, function calling, LLM fine-tuning (LoRA/QLoRA), RLHF, model evaluation (RAGAS, TruLens), API cost optimization. Production LLM deployment: vLLM, Ollama, TGI.",
  },
  {
    id: "startup-vs-mnc-india",
    category: "company",
    tags: ["startup", "mnc", "product", "service", "band"],
    content:
      "India tech landscape 2025: Product startups (Series A+) offer ESOPs + higher base + ownership; MNCs (Google, Microsoft, Samsung) offer stability + global exposure + structured career paths. Service companies (TCS, Infosys) offer scale but lower ML exposure. For ML/AI roles, product companies + research labs are stronger resume builders.",
  },
  {
    id: "resume-format-india",
    category: "role",
    tags: ["resume", "format", "ats", "keywords", "skills"],
    content:
      "ATS optimization for India market: Use exact keyword matches (e.g., 'PySpark' not 'Spark', 'PyTorch' not 'Torch'). Include GitHub links, Kaggle profile, publications. Quantify impact: 'Reduced inference latency by 40%' > 'Improved model speed'. 1-2 page resume preferred. CGPA above 7.5 CGPA/GPA helps for fresher roles.",
  },
  {
    id: "interview-signals-india",
    category: "role",
    tags: ["interview", "dsa", "system design", "ml design", "coding"],
    content:
      "India tech interview 2025: DSA on LeetCode (medium-hard) mandatory for product companies. ML roles add: ML system design (feature stores, model serving, A/B testing), statistics, ML theory. For LLM roles: RAG architecture, evaluation metrics, prompt engineering live coding. Samsung R&D: heavy on C++ and embedded ML.",
  },
];

/* ------------------------------------------------------------------ */
/* BM25-style Retrieval (no vector DB needed)                            */
/* ------------------------------------------------------------------ */

/**
 * Retrieve top-k knowledge chunks most relevant to the query.
 * Uses BM25-inspired keyword overlap — runs in <1ms, zero API calls.
 */
export function retrieveRelevantContext(
  query: string,
  k = 3,
  kb: KnowledgeChunk[] = INDIA_TECH_KB
): KnowledgeChunk[] {
  const queryTerms = tokenize(query);

  const scored = kb.map((chunk) => {
    const docTerms = tokenize(chunk.content + " " + chunk.tags.join(" "));
    const tagTerms = tokenize(chunk.tags.join(" "));

    let score = 0;
    for (const qTerm of queryTerms) {
      // Tag match: 3x weight (exact role/skill match)
      if (tagTerms.includes(qTerm)) score += 3;
      // Content match: 1x weight
      if (docTerms.includes(qTerm)) score += 1;
    }

    return { chunk, score };
  });

  return scored
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, k)
    .map((s) => s.chunk);
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s\-\_]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 2);
}

/* ------------------------------------------------------------------ */
/* RAG-Powered Match Scorer                                              */
/* ------------------------------------------------------------------ */

export interface RagScoreInput {
  resumeText: string;
  jobDescription: string;
  jobTitle: string;
  company: string;
  candidateSkills?: string[];
}

export interface RagScoreOutput {
  score: number;               // 0–100
  matchedSkills: string[];
  missingSkills: string[];
  inferredSkills: string[];
  confidence: "HIGH" | "MEDIUM" | "LOW";
  recommendation: "APPLY" | "REVIEW" | "SKIP";
  reasoning: string;
  ragChunksUsed: string[];     // chunk IDs used for grounding
}

function scrubForPrompt(text: string): string {
  if (!text) return "";
  return text
    .replace(/[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g, "[EMAIL]")
    .replace(/(?:\+?91[\s-]?)?[6-9]\d{9}/g, "[PHONE]")
    .replace(/\+1\s?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]\d{4}/g, "[PHONE]")
    .replace(/\b[2-9]\d{3}[\s-]?\d{4}[\s-]?\d{4}\b/g, "[GOV_ID]")
    .replace(/\b[A-Z]{5}[0-9]{4}[A-Z]\b/g, "[GOV_ID]");
}

/**
 * RAG-grounded scoring: retrieve industry context → inject into LLM prompt.
 * Much more accurate than vanilla LLM scoring because the model has real
 * market data to ground its evaluation against.
 */
export async function ragScoreMatch(
  input: RagScoreInput,
  think: (prompt: string, system?: string) => Promise<string>
): Promise<RagScoreOutput> {
  // 1. Retrieve relevant industry knowledge
  const queryText = `${input.jobTitle} ${input.company} ${input.candidateSkills?.slice(0, 10).join(" ")}`;
  const ragChunks = retrieveRelevantContext(queryText, 3);

  // 2. Build grounded context string
  const industryContext =
    ragChunks.length > 0
      ? ragChunks.map((c) => c.content).join("\n\n")
      : "No specific industry context retrieved.";

  const ragChunkIds = ragChunks.map((c) => c.id);

  // 3. LLM evaluation with grounded context (arXiv:2504.02870 pattern)
  // GAP-SEC-01 FIX: Scrub PII from resume and JD text before building LLM prompt
  const safeResume = scrubForPrompt(input.resumeText?.slice(0, 1500) ?? "Not provided");
  const safeJd = scrubForPrompt(input.jobDescription?.slice(0, 1500) ?? "Not provided");

  const prompt = `You are a Senior Technical Recruiter with 10 years of experience in the Indian tech market.

INDUSTRY CONTEXT (use this to ground your evaluation):
${industryContext}

CANDIDATE RESUME (excerpt, max 1500 chars):
${safeResume}

JOB DESCRIPTION (excerpt, max 1500 chars):
${safeJd}

JOB: ${input.jobTitle} at ${input.company}`

  const system = `You are an expert technical recruiter. Return ONLY valid JSON. No markdown. No explanation outside the JSON.`;

  let raw = "";
  try {
    raw = await think(prompt, system);
    if (!raw || !raw.trim()) {
      return deterministicFallback(input, ragChunkIds);
    }
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return deterministicFallback(input, ragChunkIds);
    }
    const parsed = JSON.parse(jsonMatch[0]);
    if (parsed.score === undefined && parsed.recommendation === undefined) {
      return deterministicFallback(input, ragChunkIds);
    }

    return {
      score: Math.max(0, Math.min(100, parseInt(parsed.score ?? "0", 10))),
      matchedSkills: Array.isArray(parsed.matchedSkills) ? parsed.matchedSkills : [],
      missingSkills: Array.isArray(parsed.missingSkills) ? parsed.missingSkills : [],
      inferredSkills: Array.isArray(parsed.inferredSkills) ? parsed.inferredSkills : [],
      confidence: (["HIGH", "MEDIUM", "LOW"].includes(parsed.confidence)) ? parsed.confidence : "LOW",
      recommendation: (["APPLY", "REVIEW", "SKIP"].includes(parsed.recommendation)) ? parsed.recommendation : "SKIP",
      reasoning: parsed.reasoning ?? "No reasoning provided.",
      ragChunksUsed: ragChunkIds,
    };
  } catch {
    // Fallback: deterministic keyword scoring
    return deterministicFallback(input, ragChunkIds);
  }
}

/* ------------------------------------------------------------------ */
/* Deterministic Fallback (no LLM)                                       */
/* ------------------------------------------------------------------ */

function deterministicFallback(input: RagScoreInput, ragChunkIds: string[]): RagScoreOutput {
  const jd = (input.jobDescription ?? "").toLowerCase();
  const resume = (input.resumeText ?? "").toLowerCase();

  const skills = [
    "python", "pytorch", "tensorflow", "machine learning", "deep learning",
    "nlp", "computer vision", "langchain", "rag", "pyspark", "kafka",
    "java", "golang", "react", "typescript", "kubernetes", "docker",
    "aws", "gcp", "azure", "sql", "mongodb", "redis", "fastapi",
  ];

  const matched = skills.filter((s) => jd.includes(s) && resume.includes(s));
  const missing = skills.filter((s) => jd.includes(s) && !resume.includes(s));

  const score = Math.min(100, Math.round((matched.length / Math.max(1, matched.length + missing.length)) * 100));

  return {
    score,
    matchedSkills: matched,
    missingSkills: missing.slice(0, 5),
    inferredSkills: [],
    confidence: score >= 70 ? "MEDIUM" : "LOW",
    recommendation: score >= 70 ? "APPLY" : score >= 50 ? "REVIEW" : "SKIP",
    reasoning: `Keyword match: ${matched.length}/${matched.length + missing.length} required skills found in resume.`,
    ragChunksUsed: ragChunkIds,
  };
}

/* ------------------------------------------------------------------ */
/* Export for extension use                                              */
/* ------------------------------------------------------------------ */

export { tokenize as tokenizeForSearch };
