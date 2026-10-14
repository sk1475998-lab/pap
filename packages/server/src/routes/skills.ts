/**
 * Skill Gap Analysis Route — Enterprise Intelligence Engine
 * Compares job description requirements against user profile skills and generates learning roadmaps.
 */
import { Router } from "express";
import { expandSkillSet, readProfile, skillCovered, type Profile } from "@superjob/core";
import { asyncRoute } from "../lib/tenant.js";

export const skillsRouter = Router();

interface RoleRequirements {
  role: string;
  coreSkills: string[];
  niceToHave: string[];
  learningResources: Record<string, { priority: "High" | "Medium" | "Low"; resources: string[]; estimatedWeeks: number }>;
}

const ROLE_SKILL_MAP: Record<string, RoleRequirements> = {
  fullstack: {
    role: "Full Stack Engineer",
    coreSkills: ["React", "TypeScript", "Node.js", "PostgreSQL", "REST", "Git", "System Design"],
    niceToHave: ["Next.js", "GraphQL", "Redis", "Docker", "Kubernetes", "AWS", "CI/CD", "TailwindCSS"],
    learningResources: {
      "Docker": { priority: "High", resources: ["Docker Mastery (Bret Fisher)", "Docker Official Guides"], estimatedWeeks: 2 },
      "Kubernetes": { priority: "High", resources: ["Kubernetes for Developers (KodeKloud)", "K8s Docs"], estimatedWeeks: 3 },
      "GraphQL": { priority: "Medium", resources: ["Apollo Odyssey Course", "GraphQL.org Tutorial"], estimatedWeeks: 1.5 },
      "Redis": { priority: "Medium", resources: ["Redis University (RU101)", "Redis Caching Patterns"], estimatedWeeks: 1 },
      "AWS": { priority: "High", resources: ["AWS Certified Developer Prep", "Stephane Maarek AWS"], estimatedWeeks: 4 },
      "System Design": { priority: "High", resources: ["Designing Data-Intensive Applications", "ByteByteGo"], estimatedWeeks: 4 },
    }
  },
  backend: {
    role: "Backend / Distributed Systems Engineer",
    coreSkills: ["Node.js", "Go", "Java", "Python", "PostgreSQL", "Redis", "Kafka", "Microservices", "gRPC", "Docker"],
    niceToHave: ["Kubernetes", "Cassandra", "Elasticsearch", "AWS", "Terraform", "Distributed Transactions"],
    learningResources: {
      "Kafka": { priority: "High", resources: ["Confluent Kafka Developer Certification", "Stephane Maarek Kafka"], estimatedWeeks: 3 },
      "gRPC": { priority: "Medium", resources: ["Protobuf & gRPC Mastery", "Go Microservices Tutorial"], estimatedWeeks: 1.5 },
      "Kubernetes": { priority: "High", resources: ["CKAD Certification Guide", "Cloud Native Computing Foundation"], estimatedWeeks: 3.5 },
      "Terraform": { priority: "Medium", resources: ["Terraform Up & Running (Yevgeniy Brikman)", "HashiCorp Learn"], estimatedWeeks: 2 },
    }
  },
  frontend: {
    role: "Senior Frontend / UI Engineer",
    coreSkills: ["React", "TypeScript", "JavaScript", "HTML5", "CSS3", "Next.js", "State Management", "Web Performance"],
    niceToHave: ["Vue.js", "GraphQL", "TailwindCSS", "Jest", "Playwright", "Microfrontends", "Web Workers"],
    learningResources: {
      "Web Performance": { priority: "High", resources: ["Web.dev Core Web Vitals", "Addy Osmani Fast Web Apps"], estimatedWeeks: 2 },
      "Playwright": { priority: "Medium", resources: ["Playwright.dev official walkthrough", "E2E Testing Mastery"], estimatedWeeks: 1 },
      "Microfrontends": { priority: "Medium", resources: ["Module Federation Deep Dive", "Single-SPA Architecture"], estimatedWeeks: 2 },
    }
  },
  ai_ml: {
    role: "AI / ML Platform Engineer",
    coreSkills: ["Python", "PyTorch", "TensorFlow", "FastAPI", "Docker", "MLOps", "LLMs", "Vector Databases"],
    niceToHave: ["Kubeflow", "LangChain", "LlamaIndex", "vLLM", "Triton Inference Server", "CUDA", "Spark"],
    learningResources: {
      "MLOps": { priority: "High", resources: ["Made With ML (Goku Mohandas)", "Full Stack Deep Learning"], estimatedWeeks: 4 },
      "Vector Databases": { priority: "High", resources: ["Pinecone Architecture Guide", "Milvus / Qdrant Deep Dive"], estimatedWeeks: 1.5 },
      "vLLM": { priority: "High", resources: ["PagedAttention Paper", "vLLM Production Serving Guide"], estimatedWeeks: 2 },
    }
  },
  devops: {
    role: "Cloud Infrastructure & DevOps Engineer",
    coreSkills: ["Linux", "AWS", "Docker", "Kubernetes", "Terraform", "CI/CD", "Prometheus", "Grafana", "Bash"],
    niceToHave: ["GCP", "Ansible", "Helm", "Service Mesh (Istio)", "ArgoCD", "GitOps", "Cost Optimization"],
    learningResources: {
      "Kubernetes": { priority: "High", resources: ["CKA Certification Guide", "Mumshad Mannambeth KodeKloud"], estimatedWeeks: 4 },
      "Terraform": { priority: "High", resources: ["HashiCorp Certified Terraform Associate", "Terraform Up & Running"], estimatedWeeks: 2.5 },
      "ArgoCD": { priority: "Medium", resources: ["GitOps with ArgoCD Course", "CNCF Argo Tutorials"], estimatedWeeks: 1.5 },
    }
  }
};

/* ----------------------------- skill matching ----------------------------- */

/**
 * Skill equivalence lives in core's skill graph — ONE alias table shared with the
 * match scorer, the ATS analyzer and the extension. This file briefly carried its
 * own copy (its own alias map, its own substring rule), which is precisely how the
 * dashboard and the extension end up disagreeing about whether the user knows
 * Kubernetes. Anything missing here is a missing edge in `skill-graph-data.ts`.
 *
 * `infer: false` is the important part: gap analysis must not credit a skill the
 * user only *plausibly* has. Knowing Docker is not knowing Kubernetes, and the
 * whole point of this endpoint is to name the difference.
 */
function coveredBy(required: string, declared: Set<string>): boolean {
  return skillCovered(required, declared, { infer: false });
}

/**
 * Which role definition to score against. Ordered rules over WORD tokens, not raw
 * substrings: `"html developer".includes("ml")` is true, so the old substring chain
 * scored a frontend candidate against the ML platform role.
 */
function resolveRole(rawRole: string): keyof typeof ROLE_SKILL_MAP {
  const tokens = new Set(rawRole.toLowerCase().split(/[^a-z0-9+#]+/).filter(Boolean));
  const has = (...words: string[]) => words.some((w) => tokens.has(w));

  if (has("devops", "sre", "infrastructure", "infra", "cloud", "platform", "kubernetes")) return "devops";
  if (has("ml", "ai", "mlops", "machine", "learning", "data", "llm", "nlp")) return "ai_ml";
  if (has("frontend", "front", "ui", "ux", "react", "web")) return "frontend";
  if (has("backend", "distributed", "systems", "api", "server", "go", "golang", "java")) return "backend";
  if (has("fullstack", "full")) return "fullstack";
  // Not one of the five: score against the broadest definition rather than guess.
  return "fullstack";
}

// GET /api/skills/gaps?targetRole=
skillsRouter.get(
  "/gaps",
  asyncRoute(async (req, res) => {
    const profile = await readProfile<Profile>();
    
    const targetDef = ROLE_SKILL_MAP[resolveRole(String(req.query.targetRole ?? ""))];

    // An empty profile is an empty profile. This used to substitute a hardcoded
    // list of ten skills the user had never entered, so a brand-new account was
    // told which gaps it had based on somebody else's résumé.
    const rawSkills = (profile?.skills ?? []).filter((s) => String(s ?? "").trim().length > 0);
    if (rawSkills.length === 0) {
      return res.json({
        ok: true,
        data: {
          role: targetDef.role,
          needsProfile: true,
          message: "Add your skills to your profile and this becomes a real gap analysis. Nothing to compare against yet.",
          skillCoverage: 0,
          totalRequired: targetDef.coreSkills.length + targetDef.niceToHave.length,
          presentCount: 0,
          missingCount: targetDef.coreSkills.length + targetDef.niceToHave.length,
          present: [],
          missing: [...targetDef.coreSkills, ...targetDef.niceToHave],
          learningPlan: [],
        },
      });
    }

    // Expanded upward through the graph: someone who listed "Next.js" has React,
    // and saying otherwise would hand them a learning plan for a skill they use
    // daily. The reverse guess (React ⇒ Next.js) stays off — see `coveredBy`.
    const declared = expandSkillSet(rawSkills);

    const allRequired = [...targetDef.coreSkills, ...targetDef.niceToHave];
    const present = allRequired.filter((s) => coveredBy(s, declared));
    const missing = allRequired.filter((s) => !present.includes(s));

    const skillCoverage = Math.round((present.length / allRequired.length) * 100);

    const learningPlan = missing.slice(0, 5).map(skill => {
      const info = targetDef.learningResources[skill] || {
        priority: targetDef.coreSkills.includes(skill) ? "High" : "Medium",
        resources: [`${skill} Official Documentation & Best Practices`, `Interactive Labs on ${skill}`],
        estimatedWeeks: 2,
      };
      return {
        skill,
        priority: info.priority,
        resources: info.resources,
        estimatedWeeks: info.estimatedWeeks,
      };
    });

    res.json({
      ok: true,
      data: {
        role: targetDef.role,
        // The real number. `Math.max(45, …)` used to sit here, so a candidate
        // matching nothing was shown "45% ready" — a figure the analysis never
        // computed. A gap report that flatters is worse than no gap report.
        skillCoverage,
        totalRequired: allRequired.length,
        presentCount: present.length,
        missingCount: missing.length,
        present,
        missing,
        learningPlan,
      }
    });
  }),
);
