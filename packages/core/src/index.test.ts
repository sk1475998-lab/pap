import { assert } from "node:console";
import { scoreMatch, extractKeywords } from "./matcher.js";
import { analyzeATS } from "./ats.js";
import { parseResumeText } from "./parser.js";
import { createProfile, profileToLookup } from "./profile.js";
import { mergeProfileFromParse, suggestSetupStep, validateProfile } from "./profile-complete.js";
import { applyLearnedValue, brainGaps } from "./profile-brain.js";
import { repairProfile, normalizeCTCToLpa, salaryToAnnual } from "./profile-repair.js";
import { buildRunAudit } from "./runtime-audit.js";
import { classifyLabel, normalizeQuestion, isSensitiveQuestion, smartDefaultForQuestion } from "./resolver.js";
import { templateCoverLetter, normalizeCoverLetterTone } from "./cover-letter.js";
import { parseEnvBool } from "./env.js";
import { mergeAgentSettings, deriveSearchIntent, mergedExclusions } from "./settings.js";
import { normalizeLLMConfig, describeLLMConfig, isLLMConfigured } from "./llm-config.js";
import { isLoginUrl, looksLikeOtpField, normalizeHostname } from "./login-helpers.js";
import { expandSkill, expandSkillSet, skillCovered, canonicalSkill, isKnownSkill, inferMatches } from "./skill-graph.js";
import { analyzeJobDescription } from "./jd-analyzer.js";
import {
  buildResumeVersion,
  listResumeVersions,
  resumeTextForAnalysis,
  tailorForJob,
  upsertResumeVersion,
  RESUME_VERSION_LIMIT,
  type ResumeVersion,
} from "./resume-version.js";
import { decideFieldPolicy } from "./field-policy.js";
import { assessJobRisk, assessPostingAge } from "./job-risk.js";
import { assessApplicationReadiness } from "./application-readiness.js";
import { hashMessages } from "./llm/cache.js";
import { setStore, exportSnapshot, importSnapshot, type KVStore } from "./storage.js";
import { analyzeVisaSponsorship } from "./visa-verify.js";
import { generateOutreach } from "./outreach.js";
import { SalaryEngine } from "./salary-engine.js";
import { classifyQuestion } from "./question-classifier.js";
import { StoryBank } from "./story-bank.js";
import { CompanyContextService } from "./company-context.js";
import type { Profile } from "./types.js";
import type { LLMClient } from "./llm/types.js";

let passed = 0;
const ok = (name: string, cond: boolean) => {
  if (cond) {
    passed++;
  } else {
    console.error(`  ✗ FAIL: ${name}`);
    process.exitCode = 1;
  }
};

/* matcher */
{
  const m = scoreMatch({
    resumeText: "I built React and TypeScript frontends and Node APIs at Acme.",
    jobDescription: "We need a frontend engineer with React, TypeScript, and Node experience.",
  });
  ok("match score in range", m.score >= 0 && m.score <= 100);
  ok("matched includes react", m.matched.includes("react"));
  ok("extracts keywords", extractKeywords("python python java golang").length > 0);
  ok("high overlap scores well", m.score >= 75);

  const low = scoreMatch({
    resumeText: "I am a chef who cooks pasta.",
    jobDescription: "We need a Kubernetes and Terraform DevOps engineer with AWS.",
  });
  ok("low overlap scores low", low.score < 70);

  // The score is the overlap and nothing else. This used to be
  // `(0.35 + 0.65 * raw) * 100`, so a résumé with nothing in common with the
  // posting reported 35 and no job could score below it — while that same number
  // was compared against `minMatchScore` to decide what autopilot applies to.
  const zero = scoreMatch({
    resumeText: "Pastry, sourdough, plating, kitchen brigade.",
    jobDescription: "Kubernetes Terraform Prometheus Istio.",
  });
  ok("zero overlap scores zero, not a floor", zero.score === 0);
  ok("empty job description scores zero", scoreMatch({ resumeText: "react", jobDescription: "" }).score === 0);
}

/* ats */
{
  const a = analyzeATS("I know Python and SQL.", "Need Python, Kubernetes, Terraform, AWS.");
  ok("ats gap detected", a.gaps.some((g) => g.term.includes("kubernetes")));
  ok("ats covered detected", a.covered.some((g) => g.term.includes("python")));
  ok("ats score computed", a.score >= 0);
}

/* parser */
{
  const { profile } = parseResumeText(
    `Jane Doe
Senior Software Engineer
jane.doe@example.com | (555) 123-4567
https://linkedin.com/in/janedoe | github.com/janedoe

SKILLS
Python, TypeScript, React, PostgreSQL, AWS

SUMMARY
Engineer with 8 years building scalable systems.`
  );
  ok("parsed email", profile.email === "jane.doe@example.com");
  ok("parsed name", profile.firstName === "Jane" && profile.lastName === "Doe");
  ok("parsed phone", profile.phone.includes("555"));
  ok("parsed linkedin", profile.linkedin.includes("linkedin.com"));
  ok("parsed skills", profile.skills.includes("python"));
  ok("parsed summary", profile.summary.includes("Engineer"));
}

/* parser projects + certifications + languages + awards + merge */
{
  const { profile } = parseResumeText(
    `Jane Doe
jane@example.com

PROJECTS
AI-Powered Safe Route Planning Oct 2025 - Apr 2026
https://github.com/shashi-kumar91/Safe-trajec
Trained an autonomous driving model on 850 parameters.

CERTIFICATIONS
AWS Certified Developer (Amazon)

SKILLS
Python, Kafka, AWS

LANGUAGES
English, Telugu, Hindi

AWARDS & ACHIEVEMENTS
First place in local Hackathon`
  );
  ok("parsed project name", profile.projects[0]?.name === "AI-Powered Safe Route Planning");
  ok("parsed project url", profile.projects[0]?.url === "https://github.com/shashi-kumar91/Safe-trajec");
  ok("parsed project start date", profile.projects[0]?.startDate === "Oct 2025");
  ok("parsed project end date", profile.projects[0]?.endDate === "Apr 2026");
  ok("parsed project description", profile.projects[0]?.description.includes("Trained an autonomous driving"));
  ok("parsed certification", profile.certifications[0]?.name === "AWS Certified Developer");
  ok("parsed certification issuer", profile.certifications[0]?.issuer === "Amazon");
  ok("parsed languages", profile.languages.includes("English") && profile.languages.includes("Hindi"));
  ok("parsed awards", profile.awards[0]?.includes("First place"));

  // merge test
  const existing = createProfile();
  const merged = mergeProfileFromParse(existing, profile);
  ok("merge project", merged.projects[0]?.name === "AI-Powered Safe Route Planning");
  ok("merge certification", merged.certifications[0]?.name === "AWS Certified Developer");
  ok("merge languages", merged.languages.includes("English"));
  ok("merge awards", merged.awards[0]?.includes("First place"));
}

/* field policy + job risk + readiness */
{
  const p = createProfile({
    firstName: "Jane",
    lastName: "Doe",
    email: "jane@example.com",
    phone: "5551234567",
    city: "Bengaluru",
    expectedCTC: "20",
    noticePeriod: "30 days",
    yearsOfExperience: "5",
    masterResumeText: "Backend engineer with Python AWS Kafka PostgreSQL",
    skills: ["Python", "AWS", "Kafka", "PostgreSQL"],
    experience: [{ id: "e1", title: "Backend Engineer", company: "Acme", current: false, bullets: [], skills: [] }],
    education: [{ id: "ed1", school: "Uni", degree: "BS" }],
  });
  const lookup = profileToLookup(p);
  ok("policy blocks password", decideFieldPolicy({ label: "Password", fieldKey: "ai" }, lookup).action === "skip");
  ok("policy requires user for SSN", decideFieldPolicy({ label: "SSN", fieldKey: "ai" }, lookup).action === "needs-user");
  ok("policy never defaults EEO answers in autonomous mode", decideFieldPolicy(
    { label: "Race / Ethnicity", fieldKey: "ethnicity" },
    lookup,
    { allowAutonomousFallback: true }
  ).action === "needs-user");
  ok("policy fills salary explicit", decideFieldPolicy({ label: "Expected salary", fieldKey: "expectedCTC" }, lookup).action === "fill");
  const risk = assessJobRisk({ title: "Engineer", company: "ScamCo", url: "https://x.test", location: "Remote", description: "Send bank account and passport scan for W-4 before interview" });
  ok("risk blocks scam", risk.shouldApply === false && risk.level === "blocked");

  /* posting age — the ghost-job signal, from real dates only */
  const day = 86_400_000;
  const now = Date.now();
  ok("no date means unknown, never fresh", assessPostingAge(undefined).freshness === "unknown");
  ok("unknown age reports no day count", assessPostingAge(undefined).daysSincePosted === null);
  ok("unparseable date is unknown", assessPostingAge("last Tuesday-ish").freshness === "unknown");
  // A future date is bad board data, not a brand-new posting.
  ok("future date is unknown", assessPostingAge(new Date(now + 5 * day).toISOString()).freshness === "unknown");
  ok("recent posting is fresh", assessPostingAge(new Date(now - 3 * day).toISOString()).freshness === "fresh");
  ok("recent posting reports its real age", assessPostingAge(new Date(now - 3 * day).toISOString()).daysSincePosted === 3);
  ok("month-old posting is stale", assessPostingAge(new Date(now - 40 * day).toISOString()).freshness === "stale");
  ok("very old posting is likely a ghost", assessPostingAge(new Date(now - 90 * day).toISOString()).freshness === "likely-ghost");

  const staleJob = { title: "Engineer", company: "GoodCo", url: "https://good.test", location: "Remote", description: "Need Python AWS Kafka PostgreSQL backend systems", postedAt: new Date(now - 120 * day).toISOString() };
  const staleRisk = assessJobRisk(staleJob);
  ok("stale posting raises a risk signal", staleRisk.signals.some((s) => s.code === "likely-ghost"));
  ok("stale posting needs review but is not blocked", staleRisk.needsReview && staleRisk.shouldApply);
  ok("risk carries the age it judged", staleRisk.age.daysSincePosted === 120);
  ok("a dateless posting is not penalised", assessJobRisk({ ...staleJob, postedAt: undefined }).signals.every((s) => s.code !== "likely-ghost"));
  const ready = assessApplicationReadiness(p, { title: "Backend Engineer", company: "GoodCo", url: "https://good.test", location: "Remote", description: "Need Python AWS Kafka PostgreSQL backend systems" }, { minScore: 40 });
  ok("readiness apply/review", ready.decision === "apply" || ready.decision === "review");
  ok("readiness has next actions", ready.nextActions.length > 0);
}

/* profile completeness */
{
  const empty = createProfile();
  const v0 = validateProfile(empty);
  ok("empty profile incomplete", !v0.complete);
  ok("empty profile missing resume", v0.missingRequired.some((f) => f.key === "masterResumeText"));

  const { profile: parsed } = parseResumeText(
    `SHASHI KUMAR BANOTH
shashikumar9182805541@gmail.com | +91 9182805541
Bengaluru, Karnataka, India

EXPERIENCE
Software Engineer @ Eurofins
2022 - Present
- Built ML pipelines

EDUCATION
IIITDM Kurnool
B.Tech Computer Science
2018 - 2022

SKILLS
Python, Machine Learning, TensorFlow`
  );
  ok("india parsed email", parsed.email.includes("gmail.com"));
  ok("india parsed phone", parsed.phone.length === 10);
  ok("india parsed city", parsed.city?.toLowerCase().includes("bengaluru") ?? false);
  ok("india parsed experience", parsed.experience[0]?.title.length > 0);
  ok("india parsed education", parsed.education[0]?.school.includes("IIITDM") ?? false);

  const merged = mergeProfileFromParse(createProfile(), parsed);
  ok("merge keeps parsed name", merged.firstName.includes("Shashi") || merged.firstName.includes("SHASHI"));
  ok("merge keeps experience", merged.experience.length > 0);

  const step = suggestSetupStep(merged);
  ok("suggest step after parse", step === "mandatory" || step === "screening");

  const complete = {
    ...merged,
    expectedCTC: "12",
    noticePeriod: "30 days",
    yearsOfExperience: merged.yearsOfExperience || "2",
  };
  const v1 = validateProfile(complete);
  ok("complete india profile", v1.complete);
}

/* profile lookup */
{
  const p = createProfile({
    firstName: "Shashi",
    lastName: "Banoth",
    location: "Shashi Kumar Banoth Hyderabad",
    city: "",
    yearsOfExperience: "3.5",
    noticePeriod: "30 days",
    currentCTC: "8",
    expectedCTC: "12",
  });
  const lookup = profileToLookup(p);
  ok("city strips name from location", lookup.city === "Hyderabad");
  ok("exp years split", lookup.experienceYears === "3");
  ok("exp months split", lookup.experienceMonths === "6");
  ok("notice days parsed", lookup.noticePeriodDays === "30");
  ok("annual salary from LPA", lookup.annualExpectedSalary === "1200000");
}

/* profile lookup robustness (regression: null/legacy entries) */
{
  const weird = Object.assign(createProfile({ firstName: "Ada", lastName: "Lovelace" }), {
    skills: "python,  go ,kubernetes" as unknown as string[],
    certifications: [{ name: null }, { name: "PMP" }],
    projects: [{ name: "X", description: "Y" }, null, { name: "Z" }],
    languages: ["English", null] as any[],
    awards: [] as any[],
  });
  const lookup = profileToLookup(weird);
  ok("legacy CSV skills normalized", lookup.skills.length === 3 && lookup.skills[1] === "go");
  ok("skillsList joins cleanly", lookup.skillsList === "python, go, kubernetes");
  ok("null certifications don't leak separators", lookup.certifications === "PMP");
  ok("null projects don't leak separators", lookup.projects === "X, Z");
  ok("null languages skipped", lookup.languages === "English");
  const sparse = profileToLookup(
    Object.assign(createProfile({ firstName: "A" }), {
      lastName: null as any,
      skills: ["a", null as any, "b"],
    })
  );
  ok("null skill entry becomes empty string", (sparse.skills as string[]).join("|") === "a||b");
  ok("fullName omits null middle/last", sparse.fullName === "A");
}

/* profile brain */
{
  const p = createProfile({ firstName: "A", lastName: "B" });
  const r1 = applyLearnedValue(p, "Expected annual salary", "1200000", "ripplehire.com", "manual");
  ok("brain learns custom salary", r1.changed && r1.action === "custom");
  const r2 = applyLearnedValue(r1.profile, "Expected annual salary", "1200000", "ripplehire.com", "manual");
  ok("brain dedupes", !r2.changed && r2.action === "duplicate");
  const r3 = applyLearnedValue(p, "City", "Hyderabad", "test.com", "manual");
  ok("brain fills empty city", r3.changed && r3.profile.city === "Hyderabad");
  ok("brain gaps detected", brainGaps(createProfile()).length > 0);
}

/* resolver */
{
  ok("classify email", classifyLabel("Email Address") === "email");
  ok("classify first name", classifyLabel("First Name") === "firstName");
  ok("classify sponsorship", classifyLabel("Will you now or in the future require sponsorship?") === "requiresSponsorship");
  ok("classify unknown -> ai", classifyLabel("What is your favorite color?") === "ai");
  ok("classify notice period", classifyLabel("What is your notice period?") === "noticePeriod");
  ok("classify current CTC", classifyLabel("Current CTC in LPA") === "currentCTC");
  ok("classify expected CTC", classifyLabel("Expected CTC") === "expectedCTC");
  ok("classify exp years", classifyLabel("Exp Years") === "experienceYears");
  ok("classify exp months", classifyLabel("Exp Months") === "experienceMonths");
  ok("classify current company", classifyLabel("Current Company") === "workExperienceCompany");
  ok("classify annual salary", classifyLabel("Expected annual salary") === "annualExpectedSalary");
  ok("classify middle name", classifyLabel("Middle name") === "middleName");
  ok("classify gender", classifyLabel("Gender") === "gender");
  ok("classify drawn salary", classifyLabel("Current/ Last drawn salary") === "currentCTC");
  ok("sensitive PAN question", isSensitiveQuestion("Please enter your PAN number") === true);
  ok("work authorization cannot be guessed", isSensitiveQuestion("Are you legally authorized to work in the US?"));
  ok("relocation preference cannot be guessed", isSensitiveQuestion("Are you willing to relocate?"));
  ok("blank profile has no invented employment facts", (() => {
    const blank = createProfile();
    return !blank.country && !blank.workAuthorization && !blank.requiresSponsorship &&
      !blank.willingToRelocate && !blank.immediateJoiner;
  })());
  ok("EEO choices are never supplied as defaults", smartDefaultForQuestion("Race / Ethnicity") === undefined &&
    smartDefaultForQuestion("Veteran status") === undefined &&
    smartDefaultForQuestion("Disability status") === undefined);
  ok("smart default skips CTC", smartDefaultForQuestion("Current CTC") === undefined);
  ok("normalize question stable", normalizeQuestion("Do you  have  3+ years???") === "do you have 3 years");
}

/* cover letter template */
{
  const letter = templateCoverLetter(
    { title: "Backend Engineer", company: "Acme", description: "" },
    { firstName: "Jane", lastName: "Doe", skills: ["Python", "Go"], experience: [{ title: "SWE", company: "X", bullets: ["built things"] } as any] } as any
  );
  ok("cover letter mentions company", letter.includes("Acme"));
  ok("cover letter signed", letter.includes("Jane Doe"));
  ok("cover letter quotes own bullet", letter.includes("built things"));

  // `tone` must actually change the output, including with no LLM — otherwise the
  // UI's tone selector is decorative.
  const formal = templateCoverLetter(
    { title: "Backend Engineer", company: "Acme", description: "" },
    { firstName: "Jane", lastName: "Doe", skills: ["Python"], experience: [] } as any,
    "formal"
  );
  const concise = templateCoverLetter(
    { title: "Backend Engineer", company: "Acme", description: "" },
    { firstName: "Jane", lastName: "Doe", skills: ["Python"], experience: [] } as any,
    "concise"
  );
  ok("formal tone greets formally", formal.includes("Dear Hiring Manager") && formal.includes("Sincerely,"));
  ok("concise tone is shorter", concise.length < letter.length);
  ok("tone normalizes unknown", normalizeCoverLetterTone("nonsense") === "professional");
  ok("tone accepts real value", normalizeCoverLetterTone("Enthusiastic") === "enthusiastic");
  // No profile experience must never become an invented achievement.
  ok("no invented bullet without experience", !/\d+%|\d+x|2M\+/.test(formal));
}

/* llm config — the record every surface used to guess at */
{
  const fresh = normalizeLLMConfig({});
  ok("llm default provider none-or-known", ["none", "ollama", "openai", "gemini", "anthropic", "openrouter"].includes(fresh.provider));

  const openai = normalizeLLMConfig({ provider: "openai", apiKey: "sk-test" });
  ok("llm keyed provider ready", isLLMConfigured(openai));
  ok("llm keyed provider gets default model", Boolean(openai.model));

  // Absent apiKey means "unchanged": a settings form that never receives the
  // stored key must not wipe it by saving temperature.
  const kept = normalizeLLMConfig({ temperature: 0.9 }, openai);
  ok("llm partial save keeps key", kept.apiKey === "sk-test");
  ok("llm partial save applies temperature", kept.temperature === 0.9);
  ok("llm explicit empty clears key", normalizeLLMConfig({ apiKey: "" }, openai).apiKey === "");

  // Switching provider must not carry the old provider's model across.
  const switched = normalizeLLMConfig({ provider: "gemini" }, openai);
  ok("llm provider switch resets model", switched.model !== openai.model && Boolean(switched.model));

  const missingKey = normalizeLLMConfig({ provider: "anthropic", apiKey: "" });
  ok("llm missing key not ready", !isLLMConfigured(missingKey));

  const summary = describeLLMConfig(openai);
  ok("llm summary hides key", !JSON.stringify(summary).includes("sk-test"));
  ok("llm summary reports hasApiKey", summary.hasApiKey === true && summary.ready === true);
  ok("llm summary explains itself", summary.message.length > 10);
  // Legacy flat names the old dashboard posted must upgrade, not reset.
  const legacy = normalizeLLMConfig({ aiProvider: "openai", aiModel: "gpt-4o", aiApiKey: "sk-legacy" });
  ok("llm accepts legacy ai* names", legacy.provider === "openai" && legacy.model === "gpt-4o" && legacy.apiKey === "sk-legacy");
}

/* search intent — one derivation for dashboard, extension and pipeline */
{
  const fromRoles = deriveSearchIntent({ jobPreferences: { roleTitles: ["Backend Engineer"], locations: ["Bengaluru"] } });
  ok("intent uses jobPreferences roles", fromRoles.keywords === "Backend Engineer" && fromRoles.keywordsFrom === "roles");
  ok("intent uses jobPreferences locations", fromRoles.location === "Bengaluru" && fromRoles.locationFrom === "preference");

  const fromSkills = deriveSearchIntent({ skills: ["Rust", "Kafka"], city: "Pune" });
  ok("intent falls back to skills", fromSkills.keywordsFrom === "skills" && fromSkills.keywords.includes("Rust"));
  ok("intent falls back to profile city", fromSkills.location === "Pune" && fromSkills.locationFrom === "profile");

  const empty = deriveSearchIntent({});
  ok("intent reports default honestly", empty.keywordsFrom === "default" && empty.locationFrom === "default");

  // The legacy cloud shape must still count, or an existing user's saved roles vanish.
  const legacy = deriveSearchIntent({ targetRoles: ["Data Engineer"], preferredLocation: "Remote" });
  ok("intent accepts legacy targetRoles", legacy.keywords === "Data Engineer" && legacy.keywordsFrom === "roles");

  const union = mergedExclusions(
    { jobPreferences: { excludedCompanies: ["Acme"] }, blacklistedCompanies: "Globex, Initech" },
    mergeAgentSettings({ search: { blacklistedCompanies: ["Umbrella"] } as any })
  );
  ok("exclusions union all sources", ["Acme", "Globex", "Initech", "Umbrella"].every((c) => union.includes(c)));
  ok("exclusions deduplicate", new Set(union).size === union.length);
}

/* env parsing */
{
  ok("parseEnvBool true", parseEnvBool("true", false) === true);
  ok("parseEnvBool false", parseEnvBool("false", true) === false);
  ok("parseEnvBool 0", parseEnvBool("0", true) === false);
  ok("parseEnvBool default", parseEnvBool(undefined, true) === true);
}

/* storage snapshot */
{
  const mem: Record<string, unknown> = {};
  const mock: KVStore = {
    get: async (k) => mem[k] as never,
    set: async (k, v) => { mem[k] = v; },
    delete: async (k) => { delete mem[k]; },
    keys: async () => Object.keys(mem),
  };
  setStore(mock);
  await importSnapshot({ profile: { id: "t1", firstName: "Test" } });
  const snap = await exportSnapshot();
  ok("export snapshot profile", (snap.profile as { firstName?: string })?.firstName === "Test");
}

/* profile repair + salary */
{
  const p = createProfile({
    currentCTC: "800000",
    expectedCTC: "1000000",
    noticePeriod: "0",
    immediateJoiner: "No",
    firstName: "Shashi Kumar",
    middleName: "",
    customAnswers: { password: "secret123" },
  });
  const { profile, repairs } = repairProfile(p);
  ok("repair normalizes CTC to LPA", profile.currentCTC === "8" && profile.expectedCTC === "10");
  ok("repair syncs immediate joiner", profile.immediateJoiner === "Yes");
  ok("repair splits combined first name", profile.firstName === "Shashi" && profile.middleName === "Kumar");
  ok("repair removes password from custom", profile.customAnswers.password === undefined);
  ok("repair records actions", repairs.some((r) => r.action === "normalize-ctc-lpa"));
  ok("salaryToAnnual from LPA", salaryToAnnual("8") === "800000");
  ok("salaryToAnnual from annual", salaryToAnnual("800000") === "800000");
  ok("normalizeCTCToLpa", normalizeCTCToLpa("800000") === "8");
}

/* runtime audit */
{
  const p = createProfile({ firstName: "A", lastName: "B", email: "a@b.com", phone: "9999999999", city: "X" });
  const audit = buildRunAudit(
    p,
    [{ field: "currentCTC", action: "normalize-ctc-lpa", before: "800000", after: "8" }],
    [
      { label: "Email", ok: true, value: "a@b.com" },
      { label: "Gender", ok: false, value: "no value" },
    ],
    [{ label: "Email", fieldKey: "email" }, { label: "Gender", fieldKey: "gender" }],
    { url: "https://ripplehire.com/apply", platform: "ripplehire" }
  );
  ok("audit summary counts", audit.summary.filled === 1 && audit.summary.skipped === 1);
  ok("audit has recommendations", audit.recommendations.length > 0);
  ok("audit gender suggestion", audit.fieldResults[1]?.suggestion?.includes("Gender") === true);
}

/* skills parser categories */
{
  const { profile } = parseResumeText(
    `Jane Doe
jane@example.com

SKILLS
Domains: Artificial Intelligence, Machine Learning, Deep Learning
Python, PyTorch, LangChain, A/B testing`
  );
  ok("skills no category prefix", !profile.skills.some((s) => s.startsWith("domains:")));
  ok("skills keeps ab testing", profile.skills.some((s) => s.includes("a/b testing") || s === "a/b testing"));
  ok("skills has python", profile.skills.includes("python"));
}

/* skills extraction from inline and dense PDF text layouts */
{
  const allSkills = Array.from({ length: 100 }, (_, index) => `Skill${index}`);
  const { profile } = parseResumeText(
    `Jane Doe
TECHNICAL SKILLS: Languages: Python, TypeScript | Frameworks: React, Node.js
SKILLS  ${allSkills.join(", ")}
EXPERIENCE
Software Engineer`
  );
  ok("inline skill headings are parsed", profile.skills.includes("python") && profile.skills.includes("node.js"));
  ok("skills section is not truncated at 80 entries", profile.skills.length >= 100 && profile.skills.includes("skill99"));
  ok("skills extraction stops at the next section", !profile.skills.includes("software engineer"));
}

/* brain rejects password */
{
  const p = createProfile({ firstName: "A", lastName: "B" });
  const r = applyLearnedValue(p, "Password *", "hackme", "example.com", "manual");
  ok("brain skips password", !r.changed);
}

/* login / OTP helpers */
{
  ok("login url detected", isLoginUrl("https://career.infosys.com/login"));
  ok("login url not job page", !isLoginUrl("https://career.infosys.com/jobs/123"));
  ok("otp label detected", looksLikeOtpField({ label: "Enter OTP", inputType: "text" }));
  ok("otp autocomplete", looksLikeOtpField({ autocomplete: "one-time-code", inputType: "text" }));
  ok("password not otp", !looksLikeOtpField({ label: "Password", inputType: "password" }));
  ok("hostname normalized", normalizeHostname("WWW.Infosys.COM") === "infosys.com");
}

/* agent settings defaults */
{
  const s = mergeAgentSettings({});
  ok("autoLogin default is safety-first off", s.autoLogin === false);
  ok("pauseOnOtp default", s.pauseOnOtp === true);
  ok("autoSubmitLogin default off", s.autoSubmitLogin === false);
  ok("maxLlmCallsPerRun default is cost-safe", s.maxLlmCallsPerRun === 3);
  ok("llmCacheEnabled default", s.llmCacheEnabled === true);
}

/* skill graph */
{
  ok("fastapi expands python", expandSkill("fastapi").includes("python"));
  ok("skill covered via graph", skillCovered("fastapi", new Set(["python"])));
  const inf = inferMatches(["fastapi"], ["python"]);
  ok("infers fastapi via python", inf.some((x) => x.job === "fastapi" && x.via === "python"));

  // Two questions, two answers. Match scoring counts adjacency ("could this
  // person do the job?"); gap analysis must not, or it deletes the finding the
  // user came for. Knowing Docker is not knowing Kubernetes.
  ok("adjacent skill counts for matching", skillCovered("kubernetes", new Set(["docker"])));
  ok(
    "adjacent skill is NOT coverage for gap analysis",
    skillCovered("kubernetes", new Set(["docker"]), { infer: false }) === false,
  );
  // The other direction is a fact, not a guess, so it holds in strict mode too:
  // a résumé saying Next.js has React whether or not inference is allowed.
  ok(
    "specific skill covers its parent even when strict",
    skillCovered("react", expandSkillSet(["Next.js"]), { infer: false }),
  );

  // Aliases: one spelling has to win, or the résumé and the posting never meet.
  ok("k8s resolves to kubernetes", canonicalSkill("K8s") === "kubernetes");
  ok("js resolves to javascript", canonicalSkill("JS") === "javascript");
  ok("google cloud resolves to gcp", canonicalSkill("Google Cloud") === "gcp");
  ok("node.js resolves to nodejs", canonicalSkill("Node.js") === "nodejs");
  // The classic way a match score lies. These are different languages.
  ok("java is not javascript", canonicalSkill("Java") !== canonicalSkill("JavaScript"));
  ok("java does not cover a javascript requirement", skillCovered("javascript", expandSkillSet(["Java"])) === false);
  // GraphQL is an alternative to REST, not a form of it, so it is not coverage
  // when the question is "what is this person missing?". Under match scoring's
  // adjacency rule the two are still bridged by their shared "api" parent — which
  // is correct there: a GraphQL engineer can pick up REST, so the job is worth
  // showing. The distinction is the whole point of `infer`.
  ok("graphql is not rest experience", skillCovered("rest", expandSkillSet(["GraphQL"]), { infer: false }) === false);
  ok("graphql is adjacent to rest for matching", skillCovered("rest", expandSkillSet(["GraphQL"])));

  ok("known skills are recognised", isKnownSkill("Kubernetes") && isKnownSkill("python"));
  ok("prose is not a skill", isKnownSkill("candidate") === false && isKnownSkill("responsibilities") === false);
}

/* jd analyzer */
{
  const a = analyzeJobDescription({
    resumeText: "Built Python APIs with FastAPI and Docker.",
    jobDescription: "Need FastAPI, Kubernetes, and Python experience.",
    profileSkills: ["python", "docker"],
  });
  ok("jd analyzer score", a.score > 0);
  ok("jd has matched", a.matched.length > 0);
  ok("jd active default", a.isInactive === false);

  const inactive = analyzeJobDescription({
    resumeText: "Built Python APIs with FastAPI and Docker.",
    jobDescription: "This job has expired and is no longer accepting applications.",
    profileSkills: ["python", "docker"],
  });
  ok("jd inactive detected", inactive.isInactive === true);
  ok("jd inactive reasons present", inactive.inactiveReasons.length > 0);
}

/* parser truncation bug fix verification */
{
  const { profile } = parseResumeText(
    `Jane Doe
jane.doe@example.com

WORK EXPERIENCE
Software Engineer @ Google
2020 - Present
- Experience building scalable distributed backend systems.
- Projects included migrating legacy services to Kubernetes.
- Skills used: Go, Kubernetes, GCP.

EDUCATION
Stanford University`
  );
  ok("parser did not truncate experience due to 'projects' or 'skills' words in bullets", 
    profile.experience[0]?.bullets?.length === 3 &&
    profile.experience[0]?.bullets[1]?.includes("Projects included") &&
    profile.experience[0]?.bullets[2]?.includes("Skills used")
  );
}

/* resume version */
{
  const v = buildResumeVersion("job:1", "Eng", "Acme", "Python dev", "Need Python and AWS", ["python"]);
  ok("resume version gaps", Array.isArray(v.keywordGaps));
}

/* llm cache hash */
{
  const h1 = hashMessages([{ role: "user", content: "hello" }]);
  const h2 = hashMessages([{ role: "user", content: "hello" }]);
  ok("llm hash stable", h1 === h2);
}

/* visa sponsorship & E-Verify checks */
{
  const v1 = analyzeVisaSponsorship("Google", "Looking for a Software Engineer. We offer great benefits.");
  ok("visa high for top sponsor", v1.rating === "High" && v1.eVerify === true);
  
  const v2 = analyzeVisaSponsorship("StartupInc", "US Citizen or Permanent Resident only. No visa sponsorship available.");
  ok("visa low for explicit denial", v2.rating === "Low");
  
  const v3 = analyzeVisaSponsorship("SomeCompany", "We are a participant in E-Verify.");
  ok("everify flag parsed", v3.eVerify === true);
}

/* cold outreach template generator */
{
  const outreach = generateOutreach("Jane Doe", ["Python", "AWS", "FastAPI"], "Staff Engineer", "Google");
  ok("linkedin message generated", outreach.linkedin.includes("Staff Engineer") && outreach.linkedin.includes("Google"));
  ok("linkedin message fits the dashboard's 200-character limit", outreach.linkedin.length <= 200);
  ok("email message generated", outreach.email.includes("Dear [Name]") && outreach.email.includes("Jane Doe"));
  ok("email does not claim a resume is attached", !outreach.email.includes("attached my resume"));
}

/* SalaryEngine */
{
  const se = new SalaryEngine();
  const res1 = se.extractSalaryFromJD("Looking for a developer. Budget: 8-15 LPA in Bengaluru.");
  ok("extract LPA range min", res1?.min === 8);
  ok("extract LPA range max", res1?.max === 15);
  ok("extract LPA currency", res1?.currency === "INR");

  const res2 = se.extractSalaryFromJD("Expected salary range is ₹ 1200000 to ₹ 1800000 per annum.");
  ok("extract direct Lakhs min", res2?.min === 12);
  ok("extract direct Lakhs max", res2?.max === 18);
  ok("extract direct Lakhs currency", res2?.currency === "INR");

  const res3 = se.extractSalaryFromJD("Annual Salary: $90,000 - $140,000 per year.");
  ok("extract global range min", res3?.min === 90000);
  ok("extract global range max", res3?.max === 140000);
  ok("extract global currency", res3?.currency === "USD");

  const hikeSalary = se.calculateExpectedSalary(10, 12, res1);
  ok("calculate expected salary logic", hikeSalary > 10 && hikeSalary <= 15);
}

/* classifyQuestion */
{
  ok("classify company motivation", classifyQuestion("Why do you want to join us?") === "motivation_company");
  ok("classify notice period", classifyQuestion("Notice period in days") === "availability");
  ok("classify current CTC", classifyQuestion("What is your current LPA?") === "salary_ctc");
  ok("classify relocation", classifyQuestion("Willing to relocate?") === "relocation");
  ok("classify unknown question", classifyQuestion("What is your favorite color?") === "unknown");
}

/* StoryBank */
{
  const stories = [
    {
      id: "story1",
      category: "behavioural_lead" as any,
      title: "Led React migration",
      situation: "Legacy codebase was slow.",
      task: "Migrate to React.",
      action: "Led a team of 3 engineers.",
      result: "Performance improved by 40%.",
      keywords: ["React", "migration"],
    },
    {
      id: "story2",
      category: "behavioural_challenge" as any,
      title: "Fixed Prod Crash",
      situation: "Production was down.",
      task: "Restore service.",
      action: "Found memory leak in Node.",
      result: "Restored in 15 mins.",
      keywords: ["Node", "debugging"],
    }
  ];

  const bank = new StoryBank(stories);
  const matched = bank.selectStory("behavioural_lead" as any, ["React", "Frontend"]);
  ok("select story by category & keyword", matched?.id === "story1");
  const composed = bank.composeResponse(matched!, 10);
  ok("compose response under word limit", composed.split(" ").length <= 11);
}

/* CompanyContextService */
{
  const ccs = new CompanyContextService();
  const context = await ccs.getContext("Google");
  ok("retrieve company context name", context.name === "Google");
  ok("retrieve company context industry", context.industry !== "");
}

/* Localized Resolver & smartDefaults */
{
  ok("classify localized Name (Hindi)", classifyLabel("पूरा नाम") === "fullName");
  ok("classify localized Phone (Hindi)", classifyLabel("फ़ोन") === "phone");
  ok("classify localized Email (Hindi)", classifyLabel("ईमेल") === "email");
  ok("localized consent requires an explicit candidate answer", smartDefaultForQuestion("नियम और शर्तें स्वीकार करें") === undefined);
}

/* canonicalJobKey */
{
  const { canonicalJobKey } = await import("./job-key.js");
  ok("canonicalJobKey LinkedIn", canonicalJobKey("https://www.linkedin.com/jobs/view/123456?refId=123") === "linkedin:123456");
  ok("canonicalJobKey Greenhouse", canonicalJobKey("https://boards.greenhouse.io/google/jobs/78901") === "greenhouse:78901");
  ok("canonicalJobKey generic fallback", canonicalJobKey("https://example.com/careers/apply?id=42", "Staff Engineer", "Acme Corp") === "page:https://example.com/careers/apply:staff-engineer:acme-corp");
}

/* ------------------------------------------------------------------ */
/* Per-job tailoring — the fabrication guard                           */
/* ------------------------------------------------------------------ */
/*
 * The route this replaced printed five invented achievements as the user's own
 * experience: "handling 2M+ daily requests with 99.9% uptime, reducing latency by
 * 40%", "team of 6 engineers … cutting costs by 35%", "Mentored 3 junior engineers
 * … velocity improvement of 25%". Because its LLM client was built from settings
 * fields that do not exist, that fallback was what every user actually got. These
 * assertions are here so no future edit can put invented numbers back.
 */
{
  const nullLLM: LLMClient = {
    config: { provider: "none", model: "" },
    isAvailable: () => false,
    complete: async () => {
      throw new Error("no model configured");
    },
  };

  const candidate: Profile = {
    firstName: "Asha",
    lastName: "Rao",
    email: "asha@example.com",
    skills: ["Python", "Django", "PostgreSQL"],
    experience: [
      {
        title: "Backend Engineer",
        company: "Nimbus",
        startDate: "2021",
        endDate: "2024",
        bullets: ["Built internal reporting services in Python.", "Owned the Postgres schema for billing."],
      },
    ],
  } as Profile;

  const jd =
    "Backend Engineer. Required: Python, Django, PostgreSQL. Preferred: Kubernetes, Terraform, Kafka. " +
    "You will own services in production and work with the data team.";

  const version = await tailorForJob({
    jobKey: "page:https://acme.test/jobs/1:backend-engineer:acme",
    title: "Backend Engineer",
    company: "Acme",
    jobDescription: jd,
    profile: candidate,
    llm: nullLLM,
  });

  const allText = [...version.bullets, version.tailoredText ?? ""].join("\n");

  // The headline guarantee: with no model, the bullets are the candidate's own,
  // byte for byte. Nothing is written on their behalf.
  ok("tailoring with no model returns the user's own bullets", version.bullets.join("|") === (candidate.experience?.[0]?.bullets ?? []).join("|"));
  ok("tailoring with no model reports source 'profile', not 'llm'", version.source === "profile");
  ok("tailored output invents no metrics", !/\d+%|\d+M\+|\d+x|99\.9|2M/.test(allText));
  ok("tailored output does not claim leading a team", !/led (a )?(cross-functional )?team|mentored \d/i.test(allText));

  // Keywords the posting asks for are reported; only the ones the candidate's own
  // skills back up are marked as matching.
  ok("keywords come from the posting", version.keywords.some((k) => /python|django|postgres/i.test(k)));
  ok("matchingSkills only contains skills the profile backs", version.matchingSkills.every((s) => /python|django|postgres|sql/i.test(s)));
  ok("unowned preferred skills are not claimed as matching", !version.matchingSkills.some((s) => /kubernetes|terraform|kafka/i.test(s)));

  // `generateTailoredResumeText` prints its keyword argument verbatim under "CORE
  // COMPETENCIES", so passing raw JD gaps there would put Kubernetes on the résumé
  // of someone who has never used it. `tailorForJob` passes only claimable ones.
  ok("résumé text does not list unowned skills as competencies", !/kubernetes|terraform/i.test(version.tailoredText ?? ""));
  ok("unowned gaps are surfaced as gaps instead", version.keywordGaps.some((g) => /kubernetes|terraform|kafka/i.test(g)));

  // No match score was measured, so none is reported. The route used to store
  // `matchScore || 75`, which put a number on disk that nothing had computed.
  ok("no matchScore is invented when none was measured", version.matchScore === undefined);
  ok("a measured matchScore is passed through", (await tailorForJob({
    jobKey: "k", title: "Backend Engineer", company: "Acme", jobDescription: jd,
    profile: candidate, llm: nullLLM, matchScore: 63.4,
  })).matchScore === 63);

  ok("label is the human name for the bank", version.label === "Backend Engineer @ Acme");
  ok("resumeSource says which text was analysed", version.resumeSource === "profileFields");

  // A profile with no uploaded résumé still gets analysed against its real stored
  // experience rather than an empty string (which scored every such user ~0).
  const rendered = resumeTextForAnalysis(candidate);
  ok("resumeTextForAnalysis falls back to profile fields", rendered.source === "profileFields" && rendered.text.includes("Nimbus"));
  ok("resumeTextForAnalysis prefers an uploaded résumé", resumeTextForAnalysis({ ...candidate, masterResumeText: "REAL UPLOAD" } as Profile).source === "masterResumeText");

  // Bank storage: one key, one shape, both surfaces.
  const v = (jobKey: string, createdAt: number): ResumeVersion => ({
    jobKey, title: "T", company: "C", score: 1, atsScore: 1,
    suggestedAdditions: [], keywordGaps: [], createdAt,
  });
  let bank = upsertResumeVersion<ResumeVersion>({}, v("a", 1000));
  bank = upsertResumeVersion(bank, v("b", 2000));
  ok("upsert stores by jobKey", Object.keys(bank).sort().join(",") === "a,b");
  bank = upsertResumeVersion(bank, v("a", 3000));
  ok("re-tailoring a posting replaces its entry", Object.keys(bank).length === 2 && bank.a.createdAt === 3000);
  ok("listResumeVersions is newest first", listResumeVersions(bank).map((x) => x.jobKey).join(",") === "a,b");

  let full: Record<string, ResumeVersion> = {};
  for (let i = 0; i < RESUME_VERSION_LIMIT + 5; i++) full = upsertResumeVersion(full, v(`k${i}`, 1000 + i));
  ok("the bank is capped", Object.keys(full).length === RESUME_VERSION_LIMIT);
  ok("the cap drops the oldest, not the newest", full[`k${RESUME_VERSION_LIMIT + 4}`] !== undefined && full.k0 === undefined);
  ok("listResumeVersions tolerates a missing bank", listResumeVersions(undefined).length === 0);
}

console.log(`\nCore engine: ${passed} assertions passed (failures exit non-zero).`);
if (process.exitCode === 1) {
  throw new Error("tests failed");
}
