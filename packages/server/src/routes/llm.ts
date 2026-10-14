import { Router } from "express";
import type { ChatMessage } from "@superjob/core";
import type { CompleteOptions } from "@superjob/core/llm";
import { asyncRoute, type AuthedRequest } from "../lib/tenant.js";
import { LLM_RULE, consume } from "../lib/rate-limit.js";
import { getLLM } from "../lib/llm.js";

export const llmRouter = Router();

const MAX_MESSAGES = 32;
const MAX_MESSAGE_CHARS = 20_000;
const MAX_TOTAL_CHARS = 50_000;
const MAX_TOKENS = 4_096;

llmRouter.post(
  "/complete",
  (req: AuthedRequest, res, next) => {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ ok: false, error: "Sign in required." });

    const verdict = consume(`llm:${userId}`, LLM_RULE);
    if (!verdict.allowed) {
      res.setHeader("Retry-After", Math.ceil(verdict.retryAfterMs / 1000));
      return res.status(429).json({
        ok: false,
        error: "AI requests are temporarily rate limited. Try again shortly.",
        retryAfterMs: verdict.retryAfterMs,
      });
    }
    next();
  },
  asyncRoute(async (req, res) => {
    const body = req.body as {
      messages?: unknown;
      options?: {
        temperature?: unknown;
        maxTokens?: unknown;
        responseFormat?: unknown;
      };
    };
    if (!Array.isArray(body?.messages) || body.messages.length === 0 || body.messages.length > MAX_MESSAGES) {
      return res.status(400).json({ ok: false, error: `Provide between 1 and ${MAX_MESSAGES} messages.` });
    }

    let totalChars = 0;
    const messages: ChatMessage[] = [];
    for (const item of body.messages) {
      if (
        !item ||
        typeof item !== "object" ||
        !["system", "user", "assistant"].includes((item as { role?: string }).role ?? "") ||
        typeof (item as { content?: unknown }).content !== "string"
      ) {
        return res.status(400).json({ ok: false, error: "Each message must have a valid role and text content." });
      }
      const { role, content } = item as ChatMessage;
      if (content.length > MAX_MESSAGE_CHARS) {
        return res.status(400).json({ ok: false, error: `Each message is limited to ${MAX_MESSAGE_CHARS} characters.` });
      }
      totalChars += content.length;
      if (totalChars > MAX_TOTAL_CHARS) {
        return res.status(413).json({ ok: false, error: `The combined prompt is limited to ${MAX_TOTAL_CHARS} characters.` });
      }
      messages.push({ role, content });
    }

    const inputOptions = body.options ?? {};
    const temperature = inputOptions.temperature;
    const maxTokens = inputOptions.maxTokens;
    if (temperature !== undefined && (
      typeof temperature !== "number" || !Number.isFinite(temperature) || temperature < 0 || temperature > 2
    )) {
      return res.status(400).json({ ok: false, error: "Temperature must be a number from 0 to 2." });
    }
    if (maxTokens !== undefined && (
      typeof maxTokens !== "number" || !Number.isInteger(maxTokens) || maxTokens < 1 || maxTokens > MAX_TOKENS
    )) {
      return res.status(400).json({ ok: false, error: `maxTokens must be an integer from 1 to ${MAX_TOKENS}.` });
    }
    const responseFormat = inputOptions.responseFormat;
    if (responseFormat !== undefined && (
      !responseFormat ||
      typeof responseFormat !== "object" ||
      (responseFormat as { type?: unknown }).type !== "json_object"
    )) {
      return res.status(400).json({ ok: false, error: "responseFormat must be json_object when specified." });
    }

    const llm = await getLLM();
    if (!llm.available) {
      return res.status(503).json({
        ok: false,
        error: "AI is not configured for this account. Configure a provider on the web dashboard.",
      });
    }

    const options: CompleteOptions = {
      temperature: typeof temperature === "number" ? temperature : llm.temperature,
      maxTokens: typeof maxTokens === "number" ? maxTokens : 1_200,
      ...(responseFormat ? { responseFormat: { type: "json_object" } } : {}),
    };
    try {
      const text = await llm.client.complete(messages, options);
      res.json({ ok: true, text });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const safeMessage = llm.config.apiKey
        ? message.replaceAll(llm.config.apiKey, "[redacted]")
        : message;
      res.status(502).json({
        ok: false,
        error: `Configured AI provider request failed: ${safeMessage.slice(0, 500)}`,
      });
    }
  }),
);
