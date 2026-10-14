#!/usr/bin/env node
/**
 * Super Job Agent — CLI / headless pipeline.
 *
 * Usage:
 *   superjob score   --resume resume.txt --job jd.txt
 *   superjob match   --resume resume.txt --jd "<job description text>"
 *   superjob cover   --resume resume.txt --title "Backend Eng" --company "Acme" --jd "<text>"
 *   superjob ats     --resume resume.txt --jd "<text>"
 *   superjob profile export --file store.json
 *   superjob profile import --file store.json
 *   superjob profile from-resume --resume resume.txt
 */
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { parseArgs } from "node:util";
import {
  analyzeATS,
  createLLM,
  DEFAULT_LLM_CONFIG,
  exportSnapshot,
  generateCoverLetter,
  importSnapshot,
  parseResumeText,
  scoreMatch,
  writeProfile,
  type LLMConfig,
  type StoreSnapshot,
} from "../index.js";

const { values, positionals } = parseArgs({
  options: {
    resume: { type: "string" },
    job: { type: "string" },
    jd: { type: "string" },
    title: { type: "string" },
    company: { type: "string" },
    provider: { type: "string" },
    model: { type: "string" },
    file: { type: "string" },
    merge: { type: "boolean", default: false },
  },
  allowPositionals: true,
  strict: false,
});

function readText(file?: string, inline?: string): string {
  if (inline) return inline;
  if (file) return readFileSync(file, "utf-8");
  throw new Error("Provide --resume <file> and --job <file> or --jd <text>");
}

function llmConfig(): LLMConfig {
  const providerStr = (typeof values.provider === "string" ? values.provider : undefined) ??
    process.env.SUPERJOB_LLM_PROVIDER ??
    (DEFAULT_LLM_CONFIG.provider as string);
  return {
    provider: providerStr as LLMConfig["provider"],
    model: (typeof values.model === "string" ? values.model : undefined) ??
      process.env.SUPERJOB_LLM_MODEL ??
      (DEFAULT_LLM_CONFIG.model as string),
    baseUrl: process.env.SUPERJOB_LLM_BASE_URL ?? DEFAULT_LLM_CONFIG.baseUrl,
    apiKey: process.env.SUPERJOB_LLM_API_KEY ?? process.env.OPENAI_API_KEY ?? process.env.ANTHROPIC_API_KEY ?? "",
  };
}

async function handleProfile(sub: string | undefined) {
  const file = typeof values.file === "string" ? values.file : undefined;

  if (sub === "export") {
    const snap = await exportSnapshot();
    const json = JSON.stringify(snap, null, 2);
    if (file) {
      const resolvedPath = path.isAbsolute(file) ? file : path.resolve(process.env.INIT_CWD || process.cwd(), file);
      writeFileSync(resolvedPath, json, "utf-8");
      console.log(`✓ Exported store to ${resolvedPath}`);
    } else {
      console.log(json);
    }
    return;
  }

  if (sub === "import") {
    if (!file) throw new Error("profile import requires --file <path>");
    const resolvedPath = path.isAbsolute(file) ? file : path.resolve(process.env.INIT_CWD || process.cwd(), file);
    const snap = JSON.parse(readFileSync(resolvedPath, "utf-8")) as StoreSnapshot;
    await importSnapshot(snap, { mergeApplications: Boolean(values.merge) });
    console.log(`✓ Imported store from ${resolvedPath}`);
    return;
  }

  if (sub === "from-resume") {
    const resumeFile = typeof values.resume === "string" ? values.resume : undefined;
    if (!resumeFile) throw new Error("profile from-resume requires --resume <file>");
    const resolvedPath = path.isAbsolute(resumeFile) ? resumeFile : path.resolve(process.env.INIT_CWD || process.cwd(), resumeFile);
    const parsed = parseResumeText(readFileSync(resolvedPath, "utf-8"));
    await writeProfile(parsed.profile);
    console.log(`✓ Profile saved from ${resolvedPath}`);
    console.log(`  Name: ${parsed.profile.firstName} ${parsed.profile.lastName}`.trim() || "(not detected)");
    console.log(`  Email: ${parsed.profile.email || "(not detected)"}`);
    return;
  }

  console.log(`Super Job Agent — profile sync

  profile export --file store.json     export extension/CLI data to JSON
  profile import --file store.json     import JSON into CLI store (~/.super-job-agent/)
  profile from-resume --resume f.txt   bootstrap CLI profile from a resume file

Use export in the extension (Settings tab) then import here for crew/applier.`);
}

async function main() {
  const cmd = positionals[0] ?? "help";

  if (cmd === "profile") {
    await handleProfile(positionals[1]);
    return;
  }

  const resumeText = parseResumeText(readText(typeof values.resume === "string" ? values.resume : undefined)).text;
  const jdText = readText(typeof values.job === "string" ? values.job : undefined, typeof values.jd === "string" ? values.jd : undefined);

  switch (cmd) {
    case "score":
    case "match": {
      const m = scoreMatch({ resumeText, jobDescription: jdText });
      console.log(JSON.stringify(m, null, 2));
      break;
    }
    case "ats": {
      const a = analyzeATS(resumeText, jdText);
      console.log(`ATS score: ${a.score}/100`);
      console.log(`Workday-style pass probability: ${a.passProbability}/100 (${a.workday.status})`);
      console.log(`Required coverage: ${a.requiredScore}/100`);
      console.log(`Parseability: ${a.parseScore}/100`);
      console.log("Missing required:", a.missingRequired.join(", "));
      console.log("Gaps :", a.gaps.map((g) => g.term).join(", "));
      console.log("Covered:", a.covered.map((g) => g.term).join(", "));
      if (a.workday.recommendations.length) console.log("Recommendations:\n- " + a.workday.recommendations.join("\n- "));
      break;
    }
    case "cover": {
      const llm = createLLM(llmConfig());
      const { profile } = parseResumeText(resumeText);
      const { text, source } = await generateCoverLetter(
        { title: typeof values.title === "string" ? values.title : "", company: typeof values.company === "string" ? values.company : "", description: jdText },
        profile,
        llm
      );
      console.log(`(source: ${source})\n\n${text}`);
      break;
    }
    default:
      console.log(`Super Job Agent CLI
  score  --resume f --job f      compute job match score
  ats    --resume f --job f      ATS keyword gap analysis
  cover  --resume f --title X --company Y --jd "..."   generate cover letter
  profile export|import|from-resume   sync data with the browser extension

Set SUPERJOB_LLM_PROVIDER / SUPERJOB_LLM_API_KEY to enable AI features.`);
  }
}

main().catch((e) => {
  console.error("Error:", e instanceof Error ? e.message : e);
  process.exit(1);
});
