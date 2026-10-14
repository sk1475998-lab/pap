/**
 * Interview prep routes — AI question generation, STAR story bank
 */
import { Router } from "express";
import {
  getStore,
  readProfile,
  StoryBank,
  type Profile,
  type STARStory,
} from "@superjob/core";
import { getLLM } from "../lib/llm.js";
import { asyncRoute } from "../lib/tenant.js";

export const interviewRouter = Router();

const QUESTION_TEMPLATES: Record<string, { q: string; category: string; difficulty: "easy" | "medium" | "hard" }[]> = {
  behavioral: [
    { q: "Tell me about a time you led a complex technical project end-to-end.", category: "Leadership", difficulty: "medium" },
    { q: "Describe a situation where you had to work with a difficult stakeholder.", category: "Communication", difficulty: "medium" },
    { q: "Give an example of a time you failed and what you learned.", category: "Growth", difficulty: "hard" },
    { q: "Tell me about a time you improved a process or system significantly.", category: "Impact", difficulty: "medium" },
    { q: "How have you handled competing priorities under tight deadlines?", category: "Execution", difficulty: "easy" },
  ],
  technical: [
    { q: "Explain how you would design a URL shortener at scale (like bit.ly).", category: "System Design", difficulty: "hard" },
    { q: "What is the difference between REST, GraphQL, and gRPC — when would you use each?", category: "API Design", difficulty: "medium" },
    { q: "How does React's virtual DOM work, and what are its tradeoffs?", category: "Frontend", difficulty: "medium" },
    { q: "Explain database indexing. When would you add an index and when would you not?", category: "Databases", difficulty: "medium" },
    { q: "Walk me through how you would optimize a slow API endpoint.", category: "Performance", difficulty: "hard" },
  ],
  culture: [
    { q: "Why do you want to join this company specifically?", category: "Motivation", difficulty: "easy" },
    { q: "Where do you see yourself in 3 years?", category: "Career", difficulty: "easy" },
    { q: "How do you stay updated with the latest technology trends?", category: "Learning", difficulty: "easy" },
    { q: "What does your ideal team culture look like?", category: "Culture", difficulty: "easy" },
  ],
};

// GET /api/interview/questions?role=&company=&jd=
interviewRouter.get(
  "/questions",
  asyncRoute(async (req, res) => {
    const { role, company, jd } = req.query as Record<string, string>;
    const profile = await readProfile<Profile>();

    // Build role-specific technical questions
    const roleLower = (role ?? "").toLowerCase();
    const isLeader = /manager|lead|architect|principal|staff/i.test(roleLower);

    const behavioral = QUESTION_TEMPLATES.behavioral;
    const technical = QUESTION_TEMPLATES.technical;
    const culture = QUESTION_TEMPLATES.culture;

    // Try AI-enhanced questions if LLM available and JD provided
    let aiQuestions: any[] = [];
    if (jd) {
      try {
        const serverLLM = await getLLM();
        if (serverLLM.available) {
          const resp = await serverLLM.client.complete([
            { role: "system", content: "You are an expert technical interviewer. Return exactly 3 interview questions as JSON array with fields: q (question string), category (string), difficulty (easy|medium|hard), hint (2-sentence answer hint)." },
            { role: "user", content: `Generate 3 specific interview questions for this job at ${company ?? "the company"}:\n\n${jd.slice(0, 2000)}` },
          ]);
          const clean = resp.trim().replace(/```json|```/g, "").trim();
          const match = clean.match(/\[[\s\S]*\]/);
          const parsed = JSON.parse(match ? match[0] : clean);
          if (Array.isArray(parsed)) aiQuestions = parsed;
        }
      } catch {
        /* fallback to static templates */
      }
    }

    const allQuestions = [
      ...behavioral.slice(0, isLeader ? 4 : 3),
      ...technical.slice(0, 3),
      ...culture.slice(0, 2),
      ...aiQuestions,
    ].map((q, i) => ({
      id: `q_${i}`,
      ...q,
      answer: null,
      answerUnavailable: "No candidate story is saved for this question.",
      company: company ?? null,
    }));

    res.json({ ok: true, data: allQuestions, aiUsed: aiQuestions.length > 0 });
  }),
);

// GET /api/interview/stories — list STAR stories
interviewRouter.get(
  "/stories",
  asyncRoute(async (_req, res) => {
    const store = getStore();
    const stories = (await store.get<STARStory[]>("starStories")) ?? [];
    res.json({ ok: true, data: stories });
  }),
);

// POST /api/interview/stories — add new STAR story
interviewRouter.post(
  "/stories",
  asyncRoute(async (req, res) => {
    const store = getStore();
    const stories = (await store.get<STARStory[]>("starStories")) ?? [];
    const newStory: STARStory = {
      id: `story_${Date.now()}`,
      category: req.body.category ?? "impact",
      title: req.body.title ?? "Untitled Story",
      situation: req.body.situation ?? "",
      task: req.body.task ?? "",
      action: req.body.action ?? "",
      result: req.body.result ?? "",
      keywords: req.body.keywords ?? [],
    };
    stories.unshift(newStory);
    await store.set("starStories", stories);
    res.json({ ok: true, data: newStory });
  }),
);

// DELETE /api/interview/stories/:id
interviewRouter.delete(
  "/stories/:id",
  asyncRoute(async (req, res) => {
    const store = getStore();
    const stories = (await store.get<STARStory[]>("starStories")) ?? [];
    const filtered = stories.filter((s) => s.id !== req.params.id);
    await store.set("starStories", filtered);
    res.json({ ok: true });
  }),
);

// POST /api/interview/match-story — find best STAR story for a question
interviewRouter.post(
  "/match-story",
  asyncRoute(async (req, res) => {
    const { category, keywords } = req.body;
    const store = getStore();
    const stories = (await store.get<STARStory[]>("starStories")) ?? [];
    const bank = new StoryBank(stories);
    const story = bank.selectStory(category ?? "impact", keywords ?? []);
    res.json({ ok: true, data: story });
  }),
);
