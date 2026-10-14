/**
 * Outreach routes — referral messages, LinkedIn DMs, email templates
 */
import { Router } from "express";
import {
  getStore,
  readProfile,
  generateOutreach,
  findRecruiters,
  type Profile,
} from "@superjob/core";
import { getLLM } from "../lib/llm.js";
import { asyncRoute } from "../lib/tenant.js";

export const outreachRouter = Router();

const LINKEDIN_INVITE_MAX_CHARS = 200;

export function limitLinkedInInvite(message: string): string {
  const normalized = message.trim().replace(/\s+/g, " ");
  if (normalized.length <= LINKEDIN_INVITE_MAX_CHARS) return normalized;

  const maxContentLength = LINKEDIN_INVITE_MAX_CHARS - 3;
  const lastWordBoundary = normalized.lastIndexOf(" ", maxContentLength);
  const end = lastWordBoundary >= maxContentLength * 0.75 ? lastWordBoundary : maxContentLength;
  return `${normalized.slice(0, end).trimEnd()}...`;
}

// POST /api/outreach/message — generate referral message for a job
outreachRouter.post(
  "/message",
  asyncRoute(async (req, res) => {
    const { company, jobTitle, contactName, contactTitle, useAI } = req.body;
    const profile = await readProfile<Profile>();
    if (!profile) return res.status(400).json({ ok: false, error: "No profile found." });

    const name = `${profile.firstName ?? ""} ${profile.lastName ?? ""}`.trim() || "Candidate";
    const skills = profile.skills?.slice(0, 5) ?? [];

    // Basic deterministic template from core
    const basic = generateOutreach(name, skills, jobTitle ?? "Software Engineer", company ?? "the company", contactName);

    let aiLinkedIn: string | null = null;
    let aiEmail: string | null = null;
    let modelUsed: string | null = null;

    if (useAI) {
      const serverLLM = await getLLM();
      if (serverLLM.available) {
        modelUsed = serverLLM.config.provider;
        const prompt = `Write a personalized LinkedIn connection request (max 200 chars) from ${name} to ${contactName ?? "[Name]"} (${contactTitle ?? "employee"}) at ${company} regarding the ${jobTitle} opening. Skills: ${skills.join(", ")}. Be specific, warm, not generic.`;
        aiLinkedIn = (await serverLLM.client.complete([{ role: "user", content: prompt }]).catch(() => null))?.trim() || null;

        const emailPrompt = `Write a short cold email (subject + body, max 150 words) from ${name} to ${contactName ?? "[Name]"} at ${company} requesting a referral for the ${jobTitle} role. Skills: ${skills.join(", ")}. Professional but human tone.`;
        aiEmail = (await serverLLM.client.complete([{ role: "user", content: emailPrompt }]).catch(() => null))?.trim() || null;
      }
    }

    const isAIGenerated = !!(aiLinkedIn || aiEmail);
    res.json({
      ok: true,
      data: {
        linkedin: limitLinkedInInvite(aiLinkedIn ?? basic.linkedin),
        email: aiEmail ?? basic.email,
        isAIGenerated,
        modelUsed: isAIGenerated ? modelUsed : null,
        tips: [
          "Personalize with something specific you noticed about their work",
          "LinkedIn messages over 300 chars get much lower response rates",
          "Best times to send: Tuesday–Thursday 9–11 AM or 4–6 PM",
          "Follow up once after 5-7 days if no response",
        ],
      },
    });
  }),
);

// GET /api/outreach/templates — get saved outreach templates
outreachRouter.get(
  "/templates",
  asyncRoute(async (_req, res) => {
    const store = getStore();
    const templates = (await store.get<any[]>("outreachTemplates")) ?? [
      {
        id: "tpl_1",
        name: "Referral Request — Short",
        type: "linkedin",
        template: "Hi [Name], I noticed the {role} opening at {company}. As a {skills} engineer with {exp} years, I'd love to learn more about the team. Would you be open to a 10-min call? — {yourName}",
      },
      {
        id: "tpl_2",
        name: "Cold Outreach — Alumni",
        type: "email",
        template: "Subject: {role} Role — Fellow {college} Alum\n\nHi [Name],\n\nI came across your profile and noticed we both attended {college}. I'm currently exploring {role} opportunities and {company} caught my attention...",
      },
    ];
    res.json({ ok: true, data: templates });
  }),
);

// GET /api/outreach/history — saved outreach activity
outreachRouter.get(
  "/history",
  asyncRoute(async (_req, res) => {
    const store = getStore();
    const history = (await store.get<any[]>("outreachHistory")) ?? [];
    res.json({ ok: true, data: history, total: history.length });
  }),
);

// POST /api/outreach/history — log a sent message
outreachRouter.post(
  "/history",
  asyncRoute(async (req, res) => {
    const store = getStore();
    const history = (await store.get<any[]>("outreachHistory")) ?? [];
    const entry = {
      id: `msg_${Date.now()}`,
      sentAt: Date.now(),
      ...req.body,
    };
    history.unshift(entry);
    await store.set("outreachHistory", history);
    res.json({ ok: true, data: entry });
  }),
);

// GET /api/outreach/recruiters?company=&role= — find recruiters and hiring managers
outreachRouter.get(
  "/recruiters",
  asyncRoute(async (req, res) => {
    const { company, role } = req.query as Record<string, string>;
    if (!company) return res.status(400).json({ ok: false, error: "Company name is required" });

    const profile = await readProfile<Profile>();
    const candidateName = profile ? `${profile.firstName ?? ""} ${profile.lastName ?? ""}`.trim() : "Candidate";
    const skills = profile?.skills?.slice(0, 5) ?? ["Software Engineering"];
    const jobTitle = role || (profile as any)?.targetRoles?.[0] || "Software Engineer";

    const contacts = findRecruiters(candidateName, skills, jobTitle, company, 5);
    res.json({ ok: true, data: contacts });
  }),
);
