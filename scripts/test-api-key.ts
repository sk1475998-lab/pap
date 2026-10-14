/**
 * Live API Key & LLM Connectivity Diagnostic Tester
 *
 * Usage:
 *   npx tsx scripts/test-api-key.ts --provider gemini --key YOUR_API_KEY
 *   npx tsx scripts/test-api-key.ts --provider openai --key YOUR_API_KEY
 *   npx tsx scripts/test-api-key.ts --provider anthropic --key YOUR_API_KEY
 *   npx tsx scripts/test-api-key.ts (picks up environment variables from .env or process.env)
 */
import "dotenv/config";
import { parseArgs } from "node:util";
import {
  createLLM,
  answerQuestion,
  generateCoverLetter,
  createProfile,
  DEFAULT_LLM_CONFIG,
  DEFAULT_MODEL_BY_PROVIDER,
  type LLMConfig,
  type LLMProvider,
} from "../packages/core/src/index.js";

const { values } = parseArgs({
  options: {
    provider: { type: "string", short: "p" },
    key: { type: "string", short: "k" },
    model: { type: "string", short: "m" },
    baseUrl: { type: "string" },
  },
  strict: false,
});

async function main() {
  console.log("=================================================");
  console.log("       SuperJobAgent LLM API Key Validator       ");
  console.log("=================================================\n");

  const provider = (values.provider as LLMProvider) ||
    process.env.SUPERJOB_LLM_PROVIDER ||
    (process.env.GEMINI_API_KEY ? "gemini" : undefined) ||
    (process.env.OPENAI_API_KEY ? "openai" : undefined) ||
    (process.env.ANTHROPIC_API_KEY ? "anthropic" : undefined) ||
    (process.env.OPENROUTER_API_KEY ? "openrouter" : undefined) ||
    "gemini";

  const apiKey = (values.key as string) ||
    process.env.SUPERJOB_LLM_API_KEY ||
    (provider === "gemini" ? process.env.GEMINI_API_KEY : undefined) ||
    (provider === "openai" ? process.env.OPENAI_API_KEY : undefined) ||
    (provider === "anthropic" ? process.env.ANTHROPIC_API_KEY : undefined) ||
    (provider === "openrouter" ? process.env.OPENROUTER_API_KEY : undefined) ||
    "";

  const model = (values.model as string) ||
    DEFAULT_MODEL_BY_PROVIDER[provider] ||
    DEFAULT_LLM_CONFIG.model;

  console.log(`Provider : ${provider}`);
  console.log(`Model    : ${model}`);
  console.log(`API Key  : ${apiKey ? apiKey.slice(0, 7) + "..." + apiKey.slice(-4) : "(none provided)"}`);
  console.log("-------------------------------------------------");

  if (!apiKey && provider !== "ollama" && provider !== "none") {
    console.error("\n❌ Error: No API key provided.");
    console.error("Please pass your key with --key <your-key> or set environment variables:");
    console.error("  npx tsx scripts/test-api-key.ts --provider gemini --key <YOUR_KEY>");
    console.error("  npx tsx scripts/test-api-key.ts --provider openai --key <YOUR_KEY>");
    console.error("  npx tsx scripts/test-api-key.ts --provider anthropic --key <YOUR_KEY>");
    process.exit(1);
  }

  const config: LLMConfig = {
    provider,
    model,
    apiKey,
    baseUrl: values.baseUrl as string | undefined,
  };

  const llm = createLLM(config);

  if (!llm.isAvailable()) {
    console.error("❌ LLM Client reports client unavailable with this configuration.");
    process.exit(1);
  }

  // Test 1: Basic Chat Completion
  console.log("\n[1/3] Testing Basic Chat Ping...");
  const t0 = Date.now();
  try {
    const reply = await llm.complete([
      { role: "system", content: "You are a concise AI assistant. Reply in under 10 words." },
      { role: "user", content: "Confirm you are active and ready for job applications." },
    ]);
    const duration = Date.now() - t0;
    console.log(`✓ Response received in ${duration}ms:`);
    console.log(`  "${reply.trim()}"`);
  } catch (err) {
    console.error(`❌ Chat ping failed: ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  }

  // Test 2: Grounded Screening Question Answering
  console.log("\n[2/3] Testing ATS Screening Question Answering...");
  const sampleProfile = createProfile({
    firstName: "Alex",
    lastName: "Chen",
    skills: ["TypeScript", "Node.js", "React", "Docker", "PostgreSQL", "AWS"],
    masterResumeText: "Senior Software Engineer with 6 years experience architecting backend microservices and full-stack cloud applications in TypeScript and Go.",
  });

  const questionPrompt = "How many years of experience do you have with TypeScript and microservices?";
  const t1 = Date.now();
  let failures = 0;
  try {
    const answer = await answerQuestion(llm, questionPrompt, sampleProfile.masterResumeText ?? "");
    const duration2 = Date.now() - t1;
    console.log(`✓ Screening answer generated in ${duration2}ms:`);
    console.log(`  Question: "${questionPrompt}"`);
    console.log(`  Answer  : "${answer.trim()}"`);
  } catch (err) {
    console.error(`❌ Question answering failed: ${err instanceof Error ? err.message : String(err)}`);
    failures++;
  }

  // Test 3: Cover Letter Generation
  console.log("\n[3/3] Testing Tailored Cover Letter Generator...");
  const t2 = Date.now();
  try {
    const result = await generateCoverLetter(
      {
        title: "Lead Platform Engineer",
        company: "Stripe",
        description: "Looking for an engineer experienced in high-scale distributed payments infrastructure, fault tolerance, and developer tooling.",
      },
      sampleProfile,
      llm
    );
    const duration3 = Date.now() - t2;
    console.log(`✓ Cover letter generated in ${duration3}ms (Source: ${result.source}):`);
    const preview = result.text.split("\n").slice(0, 4).join("\n");
    console.log(`  Preview:\n${preview}\n  ...`);
  } catch (err) {
    console.error(`❌ Cover letter generation failed: ${err instanceof Error ? err.message : String(err)}`);
    failures++;
  }

  console.log("\n=================================================");
  if (failures > 0) {
    console.error(`❌ ${failures} diagnostic test(s) failed. Check the provider response and configuration.`);
    console.log("=================================================\n");
    process.exitCode = 1;
    return;
  }
  console.log("🎉 ALL TESTS PASSED! The diagnostic requests completed successfully.");
  console.log("=================================================\n");
}

main().catch((err) => {
  console.error("Fatal Error:", err);
  process.exit(1);
});
