/**
 * Taxonomy Normalizer — Inspired by WorkRB (TechWolf AI, ACM RecSys / arXiv:2407.01476)
 *
 * Implements hierarchical skill extraction and canonical normalization.
 * Maps noisy free-form entities in resumes and job postings into standardized
 * taxonomy buckets (Languages, Frameworks, Cloud/DevOps, Data/AI, Core Engineering),
 * resolving synonyms and acronyms.
 */

export interface CanonicalSkill {
  id: string;
  name: string;
  category: "language" | "framework" | "cloud_data" | "ai_ml" | "engineering_practice";
  aliases: string[];
  subsumes?: string[]; // e.g. "pyspark" subsumes ["python", "spark"]
}

export const CANONICAL_TAXONOMY: CanonicalSkill[] = [
  // Languages
  { id: "python", name: "Python", category: "language", aliases: ["py", "python3", "python2"] },
  { id: "typescript", name: "TypeScript", category: "language", aliases: ["ts", "typescript.js"] },
  { id: "javascript", name: "JavaScript", category: "language", aliases: ["js", "es6", "ecmascript"] },
  { id: "java", name: "Java", category: "language", aliases: ["core java", "java 8", "java 11", "java 17"] },
  { id: "cplusplus", name: "C++", category: "language", aliases: ["cpp", "c/c++"] },
  { id: "golang", name: "Go", category: "language", aliases: ["golang"] },
  { id: "sql", name: "SQL", category: "language", aliases: ["postgresql", "mysql", "t-sql", "pl/sql", "sqlite"] },

  // Frameworks
  { id: "react", name: "React", category: "framework", aliases: ["react.js", "reactjs", "react native"] },
  { id: "nodejs", name: "Node.js", category: "framework", aliases: ["node", "nodejs", "node.js"] },
  { id: "nextjs", name: "Next.js", category: "framework", aliases: ["nextjs", "next.js"] },
  { id: "express", name: "Express.js", category: "framework", aliases: ["express", "expressjs"] },
  { id: "django", name: "Django", category: "framework", aliases: ["django rest framework", "drf"] },
  { id: "fastapi", name: "FastAPI", category: "framework", aliases: ["fast api"] },
  { id: "spring_boot", name: "Spring Boot", category: "framework", aliases: ["spring", "springboot"] },

  // Cloud & Data
  { id: "aws", name: "Amazon Web Services", category: "cloud_data", aliases: ["aws", "amazon cloud", "ec2", "s3", "lambda"] },
  { id: "azure", name: "Microsoft Azure", category: "cloud_data", aliases: ["azure", "azure cloud"] },
  { id: "gcp", name: "Google Cloud Platform", category: "cloud_data", aliases: ["gcp", "google cloud"] },
  { id: "docker", name: "Docker", category: "cloud_data", aliases: ["containerization", "containers"] },
  { id: "kubernetes", name: "Kubernetes", category: "cloud_data", aliases: ["k8s"] },
  { id: "kafka", name: "Apache Kafka", category: "cloud_data", aliases: ["kafka"] },
  { id: "spark", name: "Apache Spark", category: "cloud_data", aliases: ["spark", "pyspark", "spark sql"], subsumes: ["python"] },
  { id: "snowflake", name: "Snowflake", category: "cloud_data", aliases: ["snowflake data warehouse"] },
  { id: "power_bi", name: "Power BI", category: "cloud_data", aliases: ["powerbi", "power bi desktop", "power-bi"] },
  { id: "tableau", name: "Tableau", category: "cloud_data", aliases: ["tableau desktop"] },

  // AI & Machine Learning
  { id: "machine_learning", name: "Machine Learning", category: "ai_ml", aliases: ["ml", "scikit-learn", "sklearn"] },
  { id: "deep_learning", name: "Deep Learning", category: "ai_ml", aliases: ["dl", "neural networks", "cnn", "rnn", "lstm"] },
  { id: "pytorch", name: "PyTorch", category: "ai_ml", aliases: ["torch", "pytorch"] },
  { id: "tensorflow", name: "TensorFlow", category: "ai_ml", aliases: ["tf", "keras"] },
  { id: "llm", name: "Large Language Models", category: "ai_ml", aliases: ["llms", "genai", "generative ai", "langchain", "rag", "transformers"] },
  { id: "computer_vision", name: "Computer Vision", category: "ai_ml", aliases: ["cv", "opencv", "yolo", "image processing"] },
  { id: "nlp", name: "Natural Language Processing", category: "ai_ml", aliases: ["nlp", "text mining", "spacy", "nltk", "bert"] },

  // Engineering Practices
  { id: "ci_cd", name: "CI/CD", category: "engineering_practice", aliases: ["github actions", "gitlab ci", "jenkins", "continuous integration"] },
  { id: "git", name: "Git", category: "engineering_practice", aliases: ["github", "gitlab", "version control"] },
  { id: "rest_api", name: "REST APIs", category: "engineering_practice", aliases: ["restful", "rest api", "microservices"] },
  { id: "agile", name: "Agile / Scrum", category: "engineering_practice", aliases: ["scrum", "kanban", "sprints"] },
];

/** Index mapping normalized string -> CanonicalSkill */
const SKILL_INDEX: Map<string, CanonicalSkill> = new Map();

for (const skill of CANONICAL_TAXONOMY) {
  SKILL_INDEX.set(skill.id.toLowerCase(), skill);
  SKILL_INDEX.set(skill.name.toLowerCase(), skill);
  for (const alias of skill.aliases) {
    SKILL_INDEX.set(alias.toLowerCase(), skill);
  }
}

/** Clean text by stripping punctuation and extra whitespace */
function normalizeToken(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/[^\w\s+#.-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Normalizes an arbitrary array of skill strings or entity mentions
 * into a deduplicated set of canonical skill objects.
 */
export function normalizeSkills(rawSkills: string[]): CanonicalSkill[] {
  const matched = new Map<string, CanonicalSkill>();

  for (const raw of rawSkills) {
    const norm = normalizeToken(raw);
    if (!norm) continue;

    // 1. Direct index hit
    const hit = SKILL_INDEX.get(norm);
    if (hit) {
      matched.set(hit.id, hit);
      continue;
    }

    // 2. Substring or multi-token scan
    for (const [key, skill] of SKILL_INDEX.entries()) {
      if (key.length >= 3 && (norm === key || norm.includes(` ${key} `) || norm.startsWith(`${key} `) || norm.endsWith(` ${key}`))) {
        matched.set(skill.id, skill);
      }
    }
  }

  return Array.from(matched.values());
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Extracts canonical skills directly from free-form text (resume summary or job description).
 */
export function extractCanonicalSkillsFromText(text: string): CanonicalSkill[] {
  if (!text || text.length < 5) return [];
  const lower = ` ${text.toLowerCase().replace(/[^\w+#.-]/g, " ")} `;
  const found = new Map<string, CanonicalSkill>();

  for (const [key, skill] of SKILL_INDEX.entries()) {
    // Avoid short common words false-positive matching
    if (key.length <= 2 && !["c", "r", "go", "js", "ts", "py", "ml", "dl", "cv", "ai", "ui"].includes(key)) {
      continue;
    }

    const prefix = key.length <= 2 ? "[\\s,;()/-]" : "[\\s,;.:()/-]";
    const suffix = key.length <= 2 ? "[\\s,;()/-]" : "[\\s,;.:()/-]";
    const boundaryPattern = new RegExp(`${prefix}${escapeRegex(key)}${suffix}`, "i");
    if (boundaryPattern.test(lower)) {
      found.set(skill.id, skill);
    }
  }

  return Array.from(found.values());
}


export interface SkillMatchMatrix {
  matchedSkills: CanonicalSkill[];
  missingSkills: CanonicalSkill[];
  overlapRatio: number; // 0 to 1
  categoryCoverage: Record<string, number>; // e.g. language: 1.0, cloud_data: 0.5
}

/**
 * Computes WorkRB-style multi-view overlap between candidate skills and required job skills.
 */
export function computeSkillOverlap(
  candidateSkills: CanonicalSkill[],
  requiredSkills: CanonicalSkill[]
): SkillMatchMatrix {
  if (requiredSkills.length === 0) {
    return {
      matchedSkills: candidateSkills,
      missingSkills: [],
      overlapRatio: 1.0,
      categoryCoverage: {},
    };
  }

  const candSet = new Set(candidateSkills.map((s) => s.id));
  // Include subsumed skills
  for (const cs of candidateSkills) {
    if (cs.subsumes) {
      for (const sub of cs.subsumes) candSet.add(sub);
    }
  }

  const matchedSkills: CanonicalSkill[] = [];
  const missingSkills: CanonicalSkill[] = [];

  const categoryTotals: Record<string, { total: number; matched: number }> = {};

  for (const req of requiredSkills) {
    if (!categoryTotals[req.category]) {
      categoryTotals[req.category] = { total: 0, matched: 0 };
    }
    categoryTotals[req.category].total += 1;

    if (candSet.has(req.id)) {
      matchedSkills.push(req);
      categoryTotals[req.category].matched += 1;
    } else {
      missingSkills.push(req);
    }
  }

  const categoryCoverage: Record<string, number> = {};
  for (const [cat, counts] of Object.entries(categoryTotals)) {
    categoryCoverage[cat] = counts.total > 0 ? counts.matched / counts.total : 1.0;
  }

  const overlapRatio = matchedSkills.length / requiredSkills.length;

  return {
    matchedSkills,
    missingSkills,
    overlapRatio,
    categoryCoverage,
  };
}
