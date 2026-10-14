/**
 * Career Path Planner Route
 * Progression ladders, skill requirements, promotion timelines, salary trajectory
 */
import { Router } from "express";
import { readProfile, type Profile } from "@superjob/core";
import { asyncRoute } from "../lib/tenant.js";

export const careerRouter = Router();

export interface CareerLevel {
  level: string;
  title: string;
  yearsExp: string;
  avgSalaryGlobal: string;
  avgSalaryUS: string;
  requiredSkills: string[];
  scope: string;
  promotionChecklist: string[];
}

export interface CareerTrack {
  trackName: string;
  description: string;
  icon: string;
  levels: CareerLevel[];
}

const CAREER_LADDERS: Record<string, CareerTrack[]> = {
  "software engineer": [
    {
      trackName: "Individual Contributor (IC) Track",
      description: "Deep technical mastery, architecture, and system complexity leadership",
      icon: "💻",
      levels: [
        {
          level: "L1 / Entry",
          title: "Associate Software Engineer",
          yearsExp: "0-2 years",
          avgSalaryGlobal: "$70,000 - $100,000",
          avgSalaryUS: "$90,000 - $130,000",
          requiredSkills: ["Data Structures", "Algorithms", "Git", "Clean Code", "1 Core Language (TS/Java/Python)"],
          scope: "Executes well-defined tasks, writes tested code, participates in code reviews.",
          promotionChecklist: ["Delivers small features independently", "Writes unit & integration tests", "Receives constructive feedback smoothly"]
        },
        {
          level: "L2 / Mid-Level",
          title: "Software Engineer II",
          yearsExp: "2-5 years",
          avgSalaryGlobal: "$100,000 - $150,000",
          avgSalaryUS: "$130,000 - $185,000",
          requiredSkills: ["System Design Basics", "Database Indexing & Query Optimization", "API Design", "CI/CD", "Debugging in Prod"],
          scope: "Owns medium-to-large project modules end-to-end, mentors junior engineers.",
          promotionChecklist: ["Designs resilient REST/gRPC interfaces", "Leads incident root-cause investigations", "Consistently hits sprint deliverables"]
        },
        {
          level: "L3 / Senior",
          title: "Senior Software Engineer",
          yearsExp: "5-8 years",
          avgSalaryGlobal: "$140,000 - $210,000",
          avgSalaryUS: "$180,000 - $270,000",
          requiredSkills: ["Distributed Systems", "High Concurrency", "Cost Optimization", "Domain Modeling", "Technical Mentorship"],
          scope: "Sets technical standards for squad, drives architectural decisions across teams.",
          promotionChecklist: ["Authored design docs approved by principal engineers", "Reduced system latency or cloud bill by >25%", "Mentored 2+ engineers to promotion"]
        },
        {
          level: "L4 / Staff",
          title: "Staff Software Engineer",
          yearsExp: "8-12 years",
          avgSalaryGlobal: "$200,000 - $320,000",
          avgSalaryUS: "$280,000 - $450,000",
          requiredSkills: ["Cross-domain Architecture", "Multi-quarter Technical Strategy", "Consensus Building", "Executive Communication"],
          scope: "Influences entire engineering department (50+ engineers), solves multi-system bottlenecks.",
          promotionChecklist: ["Spearheaded company-wide architectural migration", "Published patent or company tech blog", "Drove 10x scalability milestone"]
        },
        {
          level: "L5 / Principal",
          title: "Principal Engineer / Fellow",
          yearsExp: "12+ years",
          avgSalaryGlobal: "$320,000 - $550,000+",
          avgSalaryUS: "$450,000 - $800,000+",
          requiredSkills: ["Pioneering Technology", "C-Suite Advisory", "Industry Thought Leadership"],
          scope: "Company-wide or industry-wide technological direction and survival.",
          promotionChecklist: ["Defines technology roadmap for 3-5 years", "Represents company at global tech symposiums", "Advises CTO on acquisitions"]
        }
      ]
    },
    {
      trackName: "Engineering Management Track",
      description: "People growth, team execution velocity, organizational strategy",
      icon: "👥",
      levels: [
        {
          level: "M1",
          title: "Engineering Manager (EM)",
          yearsExp: "6-9 years",
          avgSalaryGlobal: "$160,000 - $240,000",
          avgSalaryUS: "$200,000 - $300,000",
          requiredSkills: ["1-on-1 Coaching", "Sprint Planning & Agile", "Hiring & Interviewing", "Performance Reviews"],
          scope: "Directly leads 6-10 engineers, responsible for team morale, delivery, and retention.",
          promotionChecklist: ["Zero regrettable attrition in team", "100% on-time release milestones", "Built structured onboarding handbook"]
        },
        {
          level: "M2",
          title: "Senior Engineering Manager",
          yearsExp: "9-13 years",
          avgSalaryGlobal: "$220,000 - $350,000",
          avgSalaryUS: "$300,000 - $450,000",
          requiredSkills: ["Managing Managers", "Resource Allocation", "Cross-functional Product Strategy", "Budgeting"],
          scope: "Manages 2-4 teams (20-35 engineers) and first-line managers.",
          promotionChecklist: ["Scaled organization from 15 to 40+ engineers", "Established engineering excellence KPIs", "Aligned product roadmap with VP"]
        },
        {
          level: "M3 / Executive",
          title: "Director of Engineering / VP",
          yearsExp: "13+ years",
          avgSalaryGlobal: "$350,000 - $650,000+",
          avgSalaryUS: "$450,000 - $900,000+",
          requiredSkills: ["Executive Leadership", "Board Presentations", "Global Sourcing Strategy", "M&A Tech Due Diligence"],
          scope: "Oversees 80-250+ engineers, product lines, global headcount budgets.",
          promotionChecklist: ["Transformed engineering cost structure", "Led enterprise SOC2/ISO compliance", "Partnered with CEO on fundraise"]
        }
      ]
    }
  ]
};

// GET /api/career/paths?role=
careerRouter.get(
  "/paths",
  asyncRoute(async (req, res) => {
    const requestedRole = String(req.query.role ?? "").trim();
    if (!requestedRole) {
      return res.status(400).json({
        ok: false,
        error: "A target role is required.",
        code: "ROLE_REQUIRED",
        supportedRoles: Object.keys(CAREER_LADDERS),
      });
    }
    const roleQuery = requestedRole.toLowerCase();
    const profile = await readProfile<Profile>();

    const matchedKey = Object.keys(CAREER_LADDERS).find(
      (key) => roleQuery.includes(key) || key.includes(roleQuery),
    );
    if (!matchedKey) {
      return res.json({
        ok: true,
        data: {
          available: false,
          reason: "unsupported-role",
          role: requestedRole,
          supportedRoles: Object.keys(CAREER_LADDERS),
          tracks: [],
          adjacentTransitions: [],
        },
      });
    }

    const tracks = CAREER_LADDERS[matchedKey];

    // Report a level only when the profile contains evidence for one.
    const userSkills = profile?.skills || [];
    const expYearsValue = Number((profile as any)?.yearsOfExperience ?? (profile as any)?.experienceYears);
    const expYears = Number.isFinite(expYearsValue) && expYearsValue >= 0 ? expYearsValue : null;
    let currentLevel: string | null = null;
    if (expYears !== null) {
      if (expYears < 2) currentLevel = "L1 / Entry";
      else if (expYears < 6) currentLevel = "L2 / Mid-Level";
      else if (expYears < 10) currentLevel = "L3 / Senior";
      else currentLevel = "L4 / Staff";
    }

    res.json({
      ok: true,
      data: {
        available: true,
        role: requestedRole,
        currentEstimatedLevel: currentLevel,
        currentExpYears: expYears,
        userSkillsCount: userSkills.length,
        tracks,
        adjacentTransitions: [],
      },
    });
  }),
);
