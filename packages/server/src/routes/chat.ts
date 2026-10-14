/**
 * `/api/chat` — the career assistant ("Orion").
 *
 * TWO THINGS WERE WRONG HERE.
 *
 * 1. It built its own LLM client from settings fields that do not exist
 *    (`settings.aiProvider ?? "ollama"`, `aiModel ?? "llama3.2"`, `aiApiKey ?? ""`).
 *    `normalizeAgentSettings` strips all three, so this was always Ollama on
 *    localhost with no key — a `NullClient` on any hosted deployment. Orion never
 *    reached a model. It now uses `lib/llm.ts`, which reads core's real `llmConfig`.
 *
 * 2. When no model answered, it returned a 3,000-character wall of invented market
 *    data as if a coach had written it, with `ok: true` and nothing marking it as a
 *    fallback:
 *
 *      "For FAANG-tier companies in Bangalore, Senior SWE (3-5yr) ranges from
 *       ₹40-80L total comp. Unicorns: ₹25-50L. Service companies: ₹12-25L."
 *      "Backend → ML Engineer: +30-50% at FAANG tier"
 *      "Key inflection points: ₹20L→₹35L (3yr), ₹35L→₹60L (6yr FAANG …)"
 *
 *    Nobody measured any of that. Since the LLM was never reachable (see 1), this
 *    fallback was in practice the ONLY thing Orion ever said — a chat assistant
 *    whose entire output was five hardcoded essays keyed off substring matches, and
 *    the `catch` at the bottom returned one even when the request had failed.
 *
 * The fallback is now grounded: it states that no model is configured, says which
 * provider setting to change, and answers from what the product actually knows
 * about this user — their tracked applications, their stages, their real ATS score,
 * their own profile. `aiUsed` travels with every reply so the UI can label it.
 */
import { Router } from "express";
import {
  describeLLMConfig,
  getStore,
  readApplications,
  readProfile,
  type Application,
  type Profile,
} from "@superjob/core";
import { getLLM } from "../lib/llm.js";
import { asyncRoute } from "../lib/tenant.js";

export const chatRouter = Router();

interface ChatTurn {
  role: "user" | "assistant";
  content: string;
  ts: number;
}

/** Turns kept in the store. The prompt uses a shorter window (see `HISTORY_IN_PROMPT`). */
const HISTORY_LIMIT = 40;
const HISTORY_IN_PROMPT = 10;

const SYSTEM_PROMPT = `You are Orion, the career assistant inside SuperJobAgent.
You help with job-search strategy, résumé and ATS wording, interview preparation,
career planning, and recruiter outreach.

Rules you must follow:
- Be concise: at most four short paragraphs.
- Ground every claim in the user context you are given, or in what the user told you
  in this conversation. If you do not know something about this user, ask.
- Never invent salary figures, company ratings, or statistics. If asked for market
  numbers you do not have, say what you would need (a levels.fyi or Glassdoor lookup
  for that title, level and city) instead of guessing a range.
- Use **bold** for key points.`;

/**
 * Session ids become store keys, so they are constrained here rather than trusted.
 * `chat_${sessionId}` with a client-chosen id could otherwise address any key in the
 * tenant's namespace — `../profile`, `settings`, anything the store's key handling
 * happens to accept.
 */
function chatKey(raw: unknown): string {
  const id = String(raw ?? "default").replace(/[^A-Za-z0-9_-]/g, "").slice(0, 64);
  return `chat_${id || "default"}`;
}

/** Compact, factual description of this user for the system prompt. */
function buildContext(profile: Profile | undefined, apps: Application[], atsScore: number | null): string {
  if (!profile) {
    return "\n\n[User context: no profile saved yet. Ask what role they are targeting before advising.]";
  }
  const name = `${profile.firstName ?? ""} ${profile.lastName ?? ""}`.trim();
  const roles = (profile.jobPreferences?.roleTitles ?? []).filter(Boolean);
  const byStage = apps.reduce<Record<string, number>>((acc, a) => {
    acc[a.stage] = (acc[a.stage] ?? 0) + 1;
    return acc;
  }, {});
  const stages = Object.entries(byStage).map(([s, n]) => `${n} ${s}`).join(", ") || "none tracked";
  return [
    "\n\n[User context — all measured, use it and do not contradict it:",
    name ? ` name: ${name};` : "",
    ` target roles: ${roles.length ? roles.join(", ") : "not set"};`,
    ` location: ${profile.city || profile.location || "not set"};`,
    ` years of experience: ${profile.yearsOfExperience || "not set"};`,
    ` skills: ${(profile.skills ?? []).slice(0, 12).join(", ") || "not set"};`,
    ` applications: ${apps.length} (${stages});`,
    ` ATS score: ${atsScore === null ? "not calculated" : `${atsScore}/100`};`,
    ` résumé text on file: ${String(profile.masterResumeText ?? "").trim() ? "yes" : "no"}]`,
  ].join("");
}

/**
 * What Orion says when there is no model to ask.
 *
 * Everything here is either a fact about this user's own stored data or a plain
 * instruction. There are no market figures, because without a data source there is
 * no honest one to give.
 */
function groundedFallback(
  message: string,
  profile: Profile | undefined,
  apps: Application[],
  atsScore: number | null,
  llmMessage: string,
): string {
  const m = message.toLowerCase();
  const lines: string[] = [
    `**Orion is not connected to an AI model right now.** ${llmMessage}`,
    "Set a provider and API key under Settings → AI Configuration and ask again. Until then, here is what your own data says:",
  ];

  if (!profile) {
    lines.push(
      "You have no profile saved yet, so there is nothing to advise from. Add your target roles, location, skills and résumé text on the Profile page — that is also what the autofill engine and the matcher read.",
    );
    return lines.join("\n\n");
  }

  const sent = apps.filter((a) => a.stage !== "saved");
  const advanced = apps.filter((a) => ["screening", "interview", "offer"].includes(a.stage));
  const gaps: string[] = [];
  if (!String(profile.masterResumeText ?? "").trim()) gaps.push("résumé text (needed for ATS analysis and tailoring)");
  if (!(profile.skills ?? []).length) gaps.push("skills (needed for match scoring)");
  if (!(profile.jobPreferences?.roleTitles ?? []).length) gaps.push("target roles (needed to search)");
  if (!profile.city && !profile.location) gaps.push("location");
  if (!profile.phone) gaps.push("phone (asked for on most application forms)");

  if (/resume|cv|ats|keyword/.test(m)) {
    lines.push(
      atsScore === null
        ? "No ATS score has been calculated for your résumé yet. Open Resume AI and run the analysis — it reports the real parse result, section coverage and missing keywords for a specific job description."
        : `Your last measured ATS score is **${atsScore}/100**. Open Resume AI to see which sections and keywords produced that number, and tailor against a specific posting from the job feed.`,
    );
  } else if (/apply|application|track|ghost|status/.test(m)) {
    lines.push(
      `You have **${apps.length}** tracked applications, **${sent.length}** actually sent, and **${advanced.length}** that reached screening or beyond. Open the Tracker for the per-stage breakdown and which rows have gone quiet.`,
    );
  } else if (/interview/.test(m)) {
    lines.push(
      advanced.length
        ? `You have ${advanced.length} application(s) at screening or later. Open Interview Prep for one of them — it builds questions from that posting's own description.`
        : "Nothing in your tracker has reached an interview stage yet, so there is no specific loop to prepare for. Interview Prep can still generate questions from any job description in your feed.",
    );
  } else if (/salary|ctc|negotiat|lpa|compensation/.test(m)) {
    lines.push(
      "This product has no salary-benchmark data source connected, so it cannot tell you a market range — any number it printed would be made up. Use levels.fyi or Glassdoor for your exact title, level and city. What it *can* do is read the salary a posting itself publishes: that is shown on each job card when the board provides it.",
    );
  } else {
    lines.push(
      `Your profile lists ${(profile.skills ?? []).length} skills and ${(profile.jobPreferences?.roleTitles ?? []).length} target role(s), and you have ${apps.length} tracked applications.`,
    );
  }

  if (gaps.length) lines.push(`**Missing from your profile:** ${gaps.join("; ")}.`);
  return lines.join("\n\n");
}

// POST /api/chat — send a message
chatRouter.post(
  "/",
  asyncRoute(async (req, res) => {
    const message = String((req.body ?? {}).message ?? "").trim();
    if (!message) return res.status(400).json({ ok: false, error: "message required" });

    const store = getStore();
    const key = chatKey((req.body ?? {}).sessionId);
    const history = (await store.get<ChatTurn[]>(key)) ?? [];

    const [profile, apps, atsRecord, llm] = await Promise.all([
      readProfile<Profile>(),
      readApplications<Application>(),
      store.get<{ overall?: number }>("ats_score"),
      getLLM(),
    ]);
    const atsScore = typeof atsRecord?.overall === "number" ? atsRecord.overall : null;

    let reply = "";
    let aiUsed = false;
    if (llm.available) {
      const conversation = history
        .slice(-HISTORY_IN_PROMPT)
        .map((t) => `${t.role === "user" ? "User" : "Orion"}: ${t.content}`)
        .join("\n\n");
      try {
        reply = (
          await llm.client.complete(
            [
              { role: "system", content: SYSTEM_PROMPT + buildContext(profile, apps, atsScore) },
              { role: "user", content: conversation ? `${conversation}\n\nUser: ${message}\n\nOrion:` : message },
            ],
            { temperature: llm.temperature },
          )
        ).trim();
        aiUsed = Boolean(reply);
      } catch {
        // Fall through to the grounded reply below; the user is told which it is.
        reply = "";
      }
    }

    if (!reply) {
      const why = llm.available
        ? "The model was configured but did not respond."
        : describeLLMConfig(llm.config).message;
      reply = groundedFallback(message, profile, apps, atsScore, why);
    }

    const now = Date.now();
    history.push({ role: "user", content: message, ts: now });
    history.push({ role: "assistant", content: reply, ts: now });
    await store.set(key, history.slice(-HISTORY_LIMIT));

    // `aiUsed` is the honest label. Without it the UI cannot tell a model's answer
    // from a fallback, which is how the old hardcoded essays passed as coaching.
    res.json({ ok: true, reply, aiUsed, sessionId: key.replace(/^chat_/, "") });
  }),
);

// GET /api/chat/history
chatRouter.get(
  "/history",
  asyncRoute(async (req, res) => {
    const history = (await getStore().get<ChatTurn[]>(chatKey(req.query.sessionId))) ?? [];
    res.json({ ok: true, data: history, count: history.length });
  }),
);

// DELETE /api/chat/history
chatRouter.delete(
  "/history",
  asyncRoute(async (req, res) => {
    await getStore().set(chatKey(req.query.sessionId), []);
    res.json({ ok: true });
  }),
);
