/**
 * Enhanced Skill Extractor — comprehensive skill, project, and experience
 * extraction from job descriptions and resumes.
 *
 * Uses a multi-layer approach:
 * 1. Deterministic extraction via regex patterns and keyword matching
 * 2. Context-aware extraction using surrounding text
 * 3. Skill graph inference (related skills via skill-graph-data.ts)
 * 4. LLM-powered extraction for ambiguous/implicit skills
 *
 * Categories extracted:
 * - Technical skills (languages, frameworks, tools, platforms)
 * - Soft skills (leadership, communication, teamwork)
 * - Certifications & qualifications
 * - Experience requirements (years, level)
 * - Education requirements
 * - Projects & deliverables mentioned
 * - Industry/domain knowledge
 */

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

export interface ExtractedSkill {
  name: string;
  category: SkillCategory;
  confidence: number; // 0-1
  source: "exact" | "inferred" | "context" | "llm";
  context?: string; // surrounding text that indicates this skill
}

export interface ExtractedProject {
  name: string;
  description: string;
  technologies: string[];
  relevance: number; // 0-1
}

export interface ExtractedExperience {
  title: string;
  yearsRequired?: number;
  level?: "entry" | "mid" | "senior" | "lead" | "executive";
  domain?: string;
}

export interface ExtractionResult {
  skills: ExtractedSkill[];
  projects: ExtractedProject[];
  experiences: ExtractedExperience[];
  certifications: string[];
  educationRequirements: string[];
  yearsOfExperienceRequired?: number;
  rawText: string;
}

export type SkillCategory =
  | "programming_language"
  | "framework"
  | "library"
  | "tool"
  | "platform"
  | "database"
  | "cloud"
  | "devops"
  | "methodology"
  | "soft_skill"
  | "certification"
  | "domain"
  | "other";

/* ------------------------------------------------------------------ */
/* Skill Pattern Database                                              */
/* ------------------------------------------------------------------ */

interface SkillPattern {
  pattern: RegExp;
  name: string;
  category: SkillCategory;
}

const SKILL_PATTERNS: SkillPattern[] = [
  // Programming Languages
  { pattern: /\b(python|python3|python2)\b/gi, name: "Python", category: "programming_language" },
  { pattern: /\b(java|java\s*\d+)\b/gi, name: "Java", category: "programming_language" },
  { pattern: /\b(javascript|js|es6|es20\d{2}|typescript|ts)\b/gi, name: "JavaScript/TypeScript", category: "programming_language" },
  { pattern: /\b(c\+\+|cpp|c#|csharp|c\.net)\b/gi, name: "C++/C#", category: "programming_language" },
  { pattern: /\b(go|golang)\b/gi, name: "Go", category: "programming_language" },
  { pattern: /\b(rust|rustlang)\b/gi, name: "Rust", category: "programming_language" },
  { pattern: /\b(ruby|rails)\b/gi, name: "Ruby", category: "programming_language" },
  { pattern: /\b(php|laravel|symfony)\b/gi, name: "PHP", category: "programming_language" },
  { pattern: /\b(swift|objective-c)\b/gi, name: "Swift", category: "programming_language" },
  { pattern: /\b(kotlin|android)\b/gi, name: "Kotlin", category: "programming_language" },
  { pattern: /\b(scala)\b/gi, name: "Scala", category: "programming_language" },
  { pattern: /\b(r\b|r\s+programming|rlang)\b/gi, name: "R", category: "programming_language" },
  { pattern: /\b(sql|plsql|tsql|mysql|postgresql|oracle\s*sql)\b/gi, name: "SQL", category: "programming_language" },
  { pattern: /\b(html|html5|css|css3|sass|scss|less)\b/gi, name: "HTML/CSS", category: "programming_language" },
  { pattern: /\b(jsx|tsx)\b/gi, name: "JSX/TSX", category: "programming_language" },
  { pattern: /\b(shell|bash|powershell|zsh)\b/gi, name: "Shell Scripting", category: "programming_language" },
  { pattern: /\b(lua)\b/gi, name: "Lua", category: "programming_language" },
  { pattern: /\b(dart|flutter)\b/gi, name: "Dart/Flutter", category: "programming_language" },

  // Frameworks
  { pattern: /\b(react|reactjs|react\.js|react\.native)\b/gi, name: "React", category: "framework" },
  { pattern: /\b(angular|angularjs|angular\.js)\b/gi, name: "Angular", category: "framework" },
  { pattern: /\b(vue|vuejs|vue\.js|nuxt|nuxtjs)\b/gi, name: "Vue.js", category: "framework" },
  { pattern: /\b(next\.?js|nextjs)\b/gi, name: "Next.js", category: "framework" },
  { pattern: /\b(django|flask|fastapi)\b/gi, name: "Django/Flask", category: "framework" },
  { pattern: /\b(spring|spring\s*boot|springboot)\b/gi, name: "Spring Boot", category: "framework" },
  { pattern: /\b(express\.?js|expressjs|express)\b/gi, name: "Express.js", category: "framework" },
  { pattern: /\b(node\.?js|nodejs|node)\b/gi, name: "Node.js", category: "framework" },
  { pattern: /\b(deno)\b/gi, name: "Deno", category: "framework" },
  { pattern: /\b(dotnet|\.net|asp\.net|aspnet)\b/gi, name: ".NET", category: "framework" },
  { pattern: /\b(ruby\s*on\s*rails|rails)\b/gi, name: "Ruby on Rails", category: "framework" },
  { pattern: /\b(laravel)\b/gi, name: "Laravel", category: "framework" },
  { pattern: /\b(svelte|sveltekit)\b/gi, name: "Svelte", category: "framework" },
  { pattern: /\b(ember|emberjs)\b/gi, name: "Ember.js", category: "framework" },
  { pattern: /\b(tailwind|tailwindcss)\b/gi, name: "Tailwind CSS", category: "framework" },
  { pattern: /\b(bootstrap)\b/gi, name: "Bootstrap", category: "framework" },
  { pattern: /\b(material\s*ui|mui|ant\s*design|chakra)\b/gi, name: "UI Framework", category: "framework" },

  // Cloud Platforms
  { pattern: /\b(aws|amazon\s*web\s*services|ec2|s3|lambda|iam|cloudformation)\b/gi, name: "AWS", category: "cloud" },
  { pattern: /\b(azure|microsoft\s*azure|azur)\b/gi, name: "Azure", category: "cloud" },
  { pattern: /\b(gcp|google\s*cloud|google\s*cloud\s*platform)\b/gi, name: "GCP", category: "cloud" },
  { pattern: /\b(heroku)\b/gi, name: "Heroku", category: "cloud" },
  { pattern: /\b(digitalocean)\b/gi, name: "DigitalOcean", category: "cloud" },
  { pattern: /\b(vercel|netlify)\b/gi, name: "Vercel/Netlify", category: "cloud" },

  // Databases
  { pattern: /\b(postgres|postgresql)\b/gi, name: "PostgreSQL", category: "database" },
  { pattern: /\b(mysql|mariadb)\b/gi, name: "MySQL", category: "database" },
  { pattern: /\b(mongodb|mongo)\b/gi, name: "MongoDB", category: "database" },
  { pattern: /\b(redis|memcached)\b/gi, name: "Redis", category: "database" },
  { pattern: /\b(elasticsearch|elastic\s*search)\b/gi, name: "Elasticsearch", category: "database" },
  { pattern: /\b(dynamodb|dynamo\s*db)\b/gi, name: "DynamoDB", category: "database" },
  { pattern: /\b(cassandra|scylla)\b/gi, name: "Cassandra", category: "database" },
  { pattern: /\b(firebase|supabase)\b/gi, name: "Firebase/Supabase", category: "database" },
  { pattern: /\b(snowflake)\b/gi, name: "Snowflake", category: "database" },
  { pattern: /\b(graphql|graph\s*ql)\b/gi, name: "GraphQL", category: "database" },
  { pattern: /\b(prisma|sequelize|typeorm|knex)\b/gi, name: "ORM", category: "database" },

  // DevOps / Tools
  { pattern: /\b(docker|docker\s*compose|containeri[sz]ation)\b/gi, name: "Docker", category: "devops" },
  { pattern: /\b(kubernetes|k8s)\b/gi, name: "Kubernetes", category: "devops" },
  { pattern: /\b(terraform|infrastructure\s*as\s*code|iac)\b/gi, name: "Terraform", category: "devops" },
  { pattern: /\b(ansible)\b/gi, name: "Ansible", category: "devops" },
  { pattern: /\b(ci\/cd|cicd|continuous\s*integration|continuous\s*deployment|jenkins|github\s*actions|gitlab\s*ci)\b/gi, name: "CI/CD", category: "devops" },
  { pattern: /\b(git|github|gitlab|bitbucket)\b/gi, name: "Git", category: "devops" },
  { pattern: /\b(linux|unix|ubuntu|centos|rhel)\b/gi, name: "Linux", category: "devops" },
  { pattern: /\b(nginx|apache|haproxy)\b/gi, name: "Web Server", category: "devops" },
  { pattern: /\b(prometheus|grafana|datadog|new\s*relic)\b/gi, name: "Monitoring", category: "devops" },
  { pattern: /\b(elk\s*stack|logstash|kibana)\b/gi, name: "ELK Stack", category: "devops" },

  // AI/ML
  { pattern: /\b(machine\s*learning|ml|deep\s*learning|dl)\b/gi, name: "Machine Learning", category: "tool" },
  { pattern: /\b(artificial\s*intelligence|ai)\b/gi, name: "AI", category: "tool" },
  { pattern: /\b(tensorflow|pytorch|keras)\b/gi, name: "TensorFlow/PyTorch", category: "tool" },
  { pattern: /\b(nlp|natural\s*language\s*processing)\b/gi, name: "NLP", category: "tool" },
  { pattern: /\b(computer\s*vision|cv|image\s*processing)\b/gi, name: "Computer Vision", category: "tool" },
  { pattern: /\b(llm|large\s*language\s*model|gpt|chatgpt|openai)\b/gi, name: "LLM/GPT", category: "tool" },
  { pattern: /\b(data\s*science|data\s*analysis|data\s*engineering)\b/gi, name: "Data Science", category: "tool" },
  { pattern: /\b(pandas|numpy|scikit-learn|scipy)\b/gi, name: "Python Data Libraries", category: "tool" },
  { pattern: /\b(tableau|power\s*bi|looker)\b/gi, name: "BI Tools", category: "tool" },
  { pattern: /\b(spark|apache\s*spark|hadoop|hive)\b/gi, name: "Big Data", category: "tool" },
  { pattern: /\b(airflow|prefect|dagster)\b/gi, name: "Orchestration", category: "tool" },

  // Methodologies
  { pattern: /\b(agile|scrum|kanban|sprint)\b/gi, name: "Agile/Scrum", category: "methodology" },
  { pattern: /\b(tdd|test[\s-]*driven\s*development)\b/gi, name: "TDD", category: "methodology" },
  { pattern: /\b(microservices?|service[\s-]*oriented)\b/gi, name: "Microservices", category: "methodology" },
  { pattern: /\b(rest|restful|api\s*design)\b/gi, name: "REST API", category: "methodology" },
  { pattern: /\b(oauth|jwt|authentication|authorization)\b/gi, name: "Auth/Security", category: "methodology" },
  { pattern: /\b(tdd|bdd|unit\s*test|integration\s*test|e2e\s*test)\b/gi, name: "Testing", category: "methodology" },
  { pattern: /\b(devops|site\s*reliability|sre)\b/gi, name: "DevOps/SRE", category: "methodology" },
  { pattern: /\b(security|cybersecurity|penetration\s*test|ethical\s*hacking)\b/gi, name: "Security", category: "methodology" },

  // Soft Skills
  { pattern: /\b(leader|leadership|team\s*lead|tech\s*lead)\b/gi, name: "Leadership", category: "soft_skill" },
  { pattern: /\b(communication|communicate|presentation)\b/gi, name: "Communication", category: "soft_skill" },
  { pattern: /\b(problem[\s-]*solving|analytical|critical\s*thinking)\b/gi, name: "Problem Solving", category: "soft_skill" },
  { pattern: /\b(teamwork|collaborat|team\s*player)\b/gi, name: "Teamwork", category: "soft_skill" },
  { pattern: /\b(mentor|mentoring|coach)\b/gi, name: "Mentoring", category: "soft_skill" },
  { pattern: /\b(cross[\s-]*functional|cross[\s-]*team)\b/gi, name: "Cross-functional", category: "soft_skill" },

  // Certifications
  { pattern: /\b(aws\s*certified|aws\s*solutions\s*architect|aws\s*developer)\b/gi, name: "AWS Certification", category: "certification" },
  { pattern: /\b(pmp|project\s*management\s*professional)\b/gi, name: "PMP", category: "certification" },
  { pattern: /\b(csm|certified\s*scrum\s*master)\b/gi, name: "CSM", category: "certification" },
  { pattern: /\b(cka|certified\s*kubernetes\s*administrator)\b/gi, name: "CKA", category: "certification" },
  { pattern: /\b(comp\s*tia|security\+|network\+)\b/gi, name: "CompTIA", category: "certification" },
];

/* ------------------------------------------------------------------ */
/* Experience Level Detection                                          */
/* ------------------------------------------------------------------ */

const EXPERIENCE_PATTERNS = [
  { pattern: /(\d+)\+?\s*(?:years?|yrs?)\s*(?:of\s*)?(?:experience|exp)/gi, extractor: (m: RegExpMatchArray) => parseInt(m[1]) },
  { pattern: /(?:experience|exp)\s*(?:of\s*)?(\d+)\+?\s*years?/gi, extractor: (m: RegExpMatchArray) => parseInt(m[1]) },
  { pattern: /(?:minimum|at\s*least|min)\s*(\d+)\s*(?:years?|yrs?)/gi, extractor: (m: RegExpMatchArray) => parseInt(m[1]) },
];

function detectExperienceLevel(text: string): { years?: number; level?: ExtractedExperience["level"] } {
  const lower = text.toLowerCase();

  // Extract years
  let years: number | undefined;
  for (const { pattern, extractor } of EXPERIENCE_PATTERNS) {
    pattern.lastIndex = 0;
    const match = pattern.exec(lower);
    if (match) {
      years = extractor(match);
      break;
    }
  }

  // Detect level
  let level: ExtractedExperience["level"] | undefined;
  if (/\b(entry[\s-]*level|junior|fresh(er)?|0[\s-]*2\s*years?|intern)\b/i.test(lower)) level = "entry";
  else if (/\b(mid[\s-]*level|intermediate|3[\s-]*5\s*years?)\b/i.test(lower)) level = "mid";
  else if (/\b(senior|lead|staff|principal|5[\s-]*8\s*years?|8\+?\s*years?)\b/i.test(lower)) level = "senior";
  else if (/\b(director|head\s*of|vp|vice\s*president|10\+?\s*years?)\b/i.test(lower)) level = "lead";
  else if (/\b(cxo|cto|ceo|cfo|executive|founder|co[\s-]*founder)\b/i.test(lower)) level = "executive";
  else if (years) {
    if (years <= 2) level = "entry";
    else if (years <= 5) level = "mid";
    else if (years <= 8) level = "senior";
    else level = "lead";
  }

  return { years, level };
}

/* ------------------------------------------------------------------ */
/* Main Extraction Engine                                              */
/* ------------------------------------------------------------------ */

/**
 * Extract all skills, projects, and experience requirements from text.
 */
export function extractFromText(text: string): ExtractionResult {
  if (!text || text.length < 10) {
    return { skills: [], projects: [], experiences: [], certifications: [], educationRequirements: [], rawText: text };
  }

  const skills = extractSkills(text);
  const experiences = extractExperiences(text);
  const certifications = extractCertifications(text);
  const educationRequirements = extractEducation(text);
  const expInfo = detectExperienceLevel(text);

  return {
    skills,
    projects: [], // Project extraction requires LLM
    experiences,
    certifications,
    educationRequirements,
    yearsOfExperienceRequired: expInfo.years,
    rawText: text,
  };
}

/**
 * Extract skills using pattern matching.
 */
function extractSkills(text: string): ExtractedSkill[] {
  const found = new Map<string, ExtractedSkill>();

  for (const { pattern, name, category } of SKILL_PATTERNS) {
    pattern.lastIndex = 0;
    const match = pattern.exec(text);
    if (match) {
      const key = name.toLowerCase();
      if (!found.has(key)) {
        // Get context: 40 chars before and after the match
        const idx = match.index;
        const start = Math.max(0, idx - 40);
        const end = Math.min(text.length, idx + match[0].length + 40);
        const context = text.slice(start, end).trim();

        found.set(key, {
          name,
          category,
          confidence: 0.9,
          source: "exact",
          context,
        });
      }
    }
  }

  return Array.from(found.values());
}

/**
 * Extract experience requirements.
 */
function extractExperiences(text: string): ExtractedExperience[] {
  const experiences: ExtractedExperience[] = [];
  const expInfo = detectExperienceLevel(text);

  if (expInfo.years || expInfo.level) {
    experiences.push({
      title: "General Experience",
      yearsRequired: expInfo.years,
      level: expInfo.level,
    });
  }

  return experiences;
}

/**
 * Extract certifications mentioned in text.
 */
function extractCertifications(text: string): string[] {
  const certs: string[] = [];
  for (const { pattern, name, category } of SKILL_PATTERNS) {
    if (category !== "certification") continue;
    pattern.lastIndex = 0;
    if (pattern.test(text)) {
      certs.push(name);
    }
  }
  return certs;
}

/**
 * Extract education requirements.
 */
function extractEducation(text: string): string[] {
  const education: string[] = [];
  const patterns = [
    /(?:bachelor|bsc|b\.?s\.?|b\.?a\.?)\s*(?:'s)?\s*(?:degree)?\s*(?:in\s+)?([\w\s]+)/gi,
    /(?:master|msc|m\.?s\.?|m\.?a\.?|mba|phd|ph\.?d\.?)\s*(?:'s)?\s*(?:degree)?\s*(?:in\s+)?([\w\s]+)/gi,
    /(?:degree|education)\s*(?:in|required|preferred)?\s*(?:in\s+)?([\w\s]+)/gi,
  ];

  for (const pattern of patterns) {
    pattern.lastIndex = 0;
    let match;
    while ((match = pattern.exec(text)) !== null) {
      if (match[1]) {
        const field = match[1].trim().slice(0, 60);
        if (field.length > 2 && !education.includes(field)) {
          education.push(field);
        }
      }
    }
  }

  // Check for generic degree requirements
  if (/\bbachelor'?s?\b/i.test(text) && !education.some((e) => /bachelor/i.test(e))) {
    education.push("Bachelor's degree");
  }
  if (/\bmaster'?s?\b/i.test(text) && !education.some((e) => /master/i.test(e))) {
    education.push("Master's degree");
  }
  if (/\bphd\b/i.test(text) && !education.some((e) => /phd/i.test(e))) {
    education.push("PhD");
  }

  return education;
}

/**
 * Merge two extraction results, deduplicating skills.
 */
export function mergeExtractions(a: ExtractionResult, b: ExtractionResult): ExtractionResult {
  const skillMap = new Map<string, ExtractedSkill>();
  for (const skill of [...a.skills, ...b.skills]) {
    const key = skill.name.toLowerCase();
    const existing = skillMap.get(key);
    if (!existing || skill.confidence > existing.confidence) {
      skillMap.set(key, skill);
    }
  }

  return {
    skills: Array.from(skillMap.values()),
    projects: [...a.projects, ...b.projects],
    experiences: [...a.experiences, ...b.experiences],
    certifications: [...new Set([...a.certifications, ...b.certifications])],
    educationRequirements: [...new Set([...a.educationRequirements, ...b.educationRequirements])],
    yearsOfExperienceRequired: Math.max(a.yearsOfExperienceRequired ?? 0, b.yearsOfExperienceRequired ?? 0) || undefined,
    rawText: a.rawText + "\n" + b.rawText,
  };
}
