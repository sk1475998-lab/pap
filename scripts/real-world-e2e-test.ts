/**
 * Authenticated end-to-end check against a running server.
 *
 * WHAT THIS FILE USED TO DO. Every line printed `✅` unconditionally, so the run
 * ended with "🎉 ALL 5 REAL-WORLD ENTERPRISE MODULES VERIFIED WITH SUCCESS!" no
 * matter what came back. Concretely:
 *   - `POST /resume/parse { filePath: "C:/Users/shash/Downloads/shashi_resume_latest.pdf" }`
 *     — a hardcoded absolute path on one developer's machine, sent to the
 *     arbitrary-file-read endpoint that has since been removed.
 *   - `✅ Overall ATS Score: ${atsRes.data?.overall}/100` printed a tick over
 *     `undefined/100`, and read `breakdown.format` / `breakdown.quantifiedImpact`,
 *     two fields the scorer never returned.
 *   - `POST /auth/otp/send` and `/auth/otp/verify` — routes that no longer exist —
 *     printed `✅ OTP Challenge Dispatched: undefined`.
 *   - `genericAdapter.ensureLogin({} as any)` "verified" login handling by passing
 *     an empty object where a Playwright Page belongs; the method returns a hardcoded
 *     `true`.
 *   - No request carried a token, and every `/api/*` route below is behind
 *     `requireAuth`, so in its final state the whole suite was 401s reported as
 *     passes.
 *
 * It now signs in for real, asserts on what comes back, prints PASS/FAIL/SKIP per
 * check, and exits non-zero if anything failed. A missing résumé file is a SKIP,
 * not a pass.
 *
 * Usage:
 *   npx tsx scripts/real-world-e2e-test.ts [path/to/resume.pdf]
 *   SUPERJOB_API=http://localhost:3001/api SUPERJOB_TEST_RESUME=... npx tsx scripts/real-world-e2e-test.ts
 */
import fs from "node:fs";
import path from "node:path";
import { scoreMatch, type Profile } from "@superjob/core";
import { createGenericAdapter } from "@superjob/applier";

const API = (process.env.SUPERJOB_API ?? "http://localhost:3001/api").replace(/\/$/, "");
const RESUME_PATH = process.argv[2] ?? process.env.SUPERJOB_TEST_RESUME ?? "";

let token = "";
let passed = 0;
let failed = 0;
let skipped = 0;

function ok(name: string, cond: unknown, detail = ""): boolean {
  if (cond) {
    passed++;
    console.log(`   PASS  ${name}${detail ? ` — ${detail}` : ""}`);
    return true;
  }
  failed++;
  console.error(`   FAIL  ${name}${detail ? ` — ${detail}` : ""}`);
  return false;
}

function skip(name: string, why: string): void {
  skipped++;
  console.log(`   SKIP  ${name} — ${why}`);
}

interface Reply {
  status: number;
  json: any;
}

/**
 * One request helper for the whole suite.
 *
 * It carries the bearer token, and it picks up `X-Superjob-Token` when the server
 * slides the session forward — the same refresh the extension has to honour, so a
 * long run does not die halfway through on an expired token.
 */
async function call(method: string, route: string, body?: unknown): Promise<Reply> {
  const headers: Record<string, string> = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  let payload: BodyInit | undefined;
  if (body instanceof FormData) {
    payload = body;
  } else if (body !== undefined) {
    headers["Content-Type"] = "application/json";
    payload = JSON.stringify(body);
  }
  const res = await fetch(`${API}${route}`, { method, headers, body: payload });
  const refreshed = res.headers.get("X-Superjob-Token");
  if (refreshed) token = refreshed;
  let json: any;
  try {
    json = await res.json();
  } catch {
    json = undefined;
  }
  return { status: res.status, json };
}

const get = (route: string) => call("GET", route);
const post = (route: string, body?: unknown) => call("POST", route, body);

/** Numbers the product reports must be real numbers in range, not `undefined`. */
function isScore(v: unknown): boolean {
  return typeof v === "number" && Number.isFinite(v) && v >= 0 && v <= 100;
}

/* ------------------------------------------------------------------ */
/* 0. Server up, and a real signed-in session                          */
/* ------------------------------------------------------------------ */

async function signIn(): Promise<boolean> {
  const health = await get("/health");
  if (!ok("server is reachable", health.status === 200 && health.json?.ok, `GET ${API}/health`)) {
    console.error(`\n   Start it first:  npm run dev --workspace @superjob/server\n`);
    return false;
  }

  // A throwaway tenant per run, so the suite never mutates a real user's profile.
  // Every /api route below is namespaced to whoever this token belongs to.
  const email = `e2e-${Date.now()}@superjob.test`;
  const password = "E2e-Suite-Passw0rd!";
  const reg = await post("/auth/register", { email, password, name: "E2E Suite" });
  if (reg.status === 200 && reg.json?.token) {
    token = reg.json.token;
  } else {
    const login = await post("/auth/login", { email, password });
    if (login.status === 200 && login.json?.token) token = login.json.token;
  }
  if (!ok("register + issue a bearer token", Boolean(token), token ? `tenant ${email}` : `HTTP ${reg.status}: ${reg.json?.error ?? "no token"}`)) {
    return false;
  }

  const session = await get("/auth/session");
  ok(
    "the token authenticates a session",
    session.status === 200 && session.json?.authenticated === true && session.json?.user?.email === email,
    session.json?.user?.email ?? `HTTP ${session.status}`,
  );

  // The negative case matters more than the positive one: an endpoint that answers
  // without a token is an endpoint leaking one tenant's data to anyone.
  const saved = token;
  token = "";
  const anon = await get("/profile");
  ok(
    "an unauthenticated request is rejected with UNAUTHENTICATED",
    anon.status === 401 && anon.json?.code === "UNAUTHENTICATED",
    `HTTP ${anon.status} ${anon.json?.code ?? ""}`,
  );
  token = saved;
  return true;
}

/* ------------------------------------------------------------------ */
/* 1. Résumé upload → parse → profile                                  */
/* ------------------------------------------------------------------ */

const MIME: Record<string, string> = {
  ".pdf": "application/pdf",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".txt": "text/plain",
  ".md": "text/markdown",
};

/** A résumé with enough substance for the parser and the ATS checks to bite on. */
const SYNTHETIC_RESUME = `ASHA RAO
asha.rao@example.com | +91 98765 43210 | Bengaluru, Karnataka
linkedin.com/in/asharao | github.com/asharao

SUMMARY
Backend engineer with four years building Python services in production.

WORK EXPERIENCE
Backend Engineer | Nimbus Systems                          2021 - 2024
Bengaluru, India
- Built internal reporting services in Python and Django.
- Owned the PostgreSQL schema behind billing and usage metering.
- Wrote the migration tooling the data team runs weekly.

Software Engineer | Corvus Labs                            2020 - 2021
- Maintained REST APIs consumed by three internal dashboards.

EDUCATION
B.Tech in Computer Science | IIIT Kurnool                  2016 - 2020

SKILLS & TECHNOLOGIES
Python, Django, PostgreSQL, REST APIs, Git, Linux, Docker
`;

async function uploadResume(): Promise<{ profile: Profile | null; usedFile: string }> {
  const form = new FormData();
  let label: string;

  if (RESUME_PATH && fs.existsSync(RESUME_PATH)) {
    const ext = path.extname(RESUME_PATH).toLowerCase();
    const bytes = fs.readFileSync(RESUME_PATH);
    form.append("file", new Blob([bytes], { type: MIME[ext] ?? "application/octet-stream" }), path.basename(RESUME_PATH));
    label = RESUME_PATH;
  } else {
    if (RESUME_PATH) skip("upload the résumé passed on the command line", `no file at ${RESUME_PATH}`);
    form.append("file", new Blob([SYNTHETIC_RESUME], { type: "text/plain" }), "e2e-resume.txt");
    label = "built-in synthetic résumé (pass a path to use your own)";
  }

  // Multipart, the way the browser sends it. The old suite posted a filesystem
  // path as JSON and the server read whatever was there.
  const up = await post("/resume", form);
  ok("upload a résumé (multipart POST /resume)", up.status === 200 && up.json?.ok, `HTTP ${up.status} ${up.json?.error ?? ""}`);
  ok("extracted text from the upload", typeof up.json?.textLength === "number" && up.json.textLength >= 50, `${up.json?.textLength ?? 0} chars`);
  ok("the response does not leak the server path", !JSON.stringify(up.json ?? {}).includes(".uploads"));

  const parsed = up.json?.parsed;
  if (parsed) {
    ok("parsed a name out of the résumé", typeof parsed.name === "string" && parsed.name.trim().length > 0, parsed.name);
    ok("parsed an email out of the résumé", /@/.test(String(parsed.email ?? "")), parsed.email);
    ok("parsed at least one skill", Number(parsed.skillsCount) > 0, `${parsed.skillsCount} skills`);
    ok("parsed at least one work experience", Number(parsed.experienceCount) > 0, `${parsed.experienceCount} roles`);
  } else {
    skip("parse the uploaded résumé into a profile", up.json?.note ?? "the server returned no parse summary");
  }

  const prof = await get("/profile");
  const profile = (prof.json?.data ?? null) as Profile | null;
  ok("the parse persisted to this tenant's profile", Boolean(profile), profile ? `${profile.firstName ?? ""} ${profile.lastName ?? ""}`.trim() : "no profile stored");
  ok("the résumé text is on file for analysis", String(profile?.masterResumeText ?? "").length >= 50);

  // The rule that must never break: tailoring may not rewrite the master.
  return { profile, usedFile: label };
}

/* ------------------------------------------------------------------ */
/* 2. ATS scoring — structural, then against a real posting            */
/* ------------------------------------------------------------------ */

const JD = `Backend Engineer, Platform.

Required: strong Python, Django or FastAPI, PostgreSQL, and experience running
services in production on Linux. You will own schema design and data migrations.

Preferred: Kubernetes, Terraform, Kafka, and exposure to observability tooling.`;

async function checkAts(): Promise<void> {
  const structural = await get("/resume/score");
  const s = structural.json?.data;
  ok("GET /resume/score answers", structural.status === 200 && structural.json?.ok, `HTTP ${structural.status} ${structural.json?.error ?? ""}`);
  if (s) {
    // The old route reported a weighted overall score with no job description, so
    // 52% of the weight (keyword + required coverage) was structurally zero.
    ok("a JD-less score is labelled structural, not overall", s.scope === "structure", `scope=${s.scope}`);
    ok("the structural score is a real number", isScore(s.overall), `${s.overall}`);
    ok("no keywords are reported as missing without a JD", Array.isArray(s.missingKeywords) && s.missingKeywords.length === 0);
    ok("it says what a full score would need", typeof s.message === "string" && /job description/i.test(s.message));
    ok("the breakdown is JD-independent", Boolean(s.breakdown) && "contactParsing" in s.breakdown && !("allKeywords" in s.breakdown), Object.keys(s.breakdown ?? {}).join(", "));
    ok("it says which text it read", s.resumeSource === "masterResumeText" || s.resumeSource === "profileFields", s.resumeSource);
    ok("every breakdown value is a real number", Object.values(s.breakdown ?? {}).every(isScore));
  }

  const scoped = await post("/resume/score", { jobDescription: JD, jobTitle: "Backend Engineer" });
  const j = scoped.json?.data;
  ok("POST /resume/score answers", scoped.status === 200 && scoped.json?.ok, `HTTP ${scoped.status} ${scoped.json?.error ?? ""}`);
  if (j) {
    ok("a JD-scoped score is labelled as such", j.scope === "job", `scope=${j.scope}`);
    ok("the overall score is a real number", isScore(j.overall), `${j.overall}/100`);
    ok("pass probability is a real number", isScore(j.passProbability), `${j.passProbability}`);
    ok("keyword coverage is measured, not assumed", Array.isArray(j.keywordCoverage) && j.keywordCoverage.length > 0, `${j.keywordCoverage?.length ?? 0} keywords`);
    ok("required keywords come from the posting", Array.isArray(j.requiredKeywords) && j.requiredKeywords.some((k: string) => /python|postgres|django/i.test(k)), (j.requiredKeywords ?? []).slice(0, 5).join(", "));
    ok("the breakdown reports keyword coverage", Boolean(j.breakdown?.allKeywords !== undefined && j.breakdown?.requiredKeywords !== undefined), Object.keys(j.breakdown ?? {}).join(", "));
    ok("every breakdown value is a real number", Object.values(j.breakdown ?? {}).every(isScore));
    ok("suggestions are an array", Array.isArray(j.suggestions), `${j.suggestions?.length ?? 0} suggestions`);
    // The old route returned a fixed TRENDING list here — keywords no posting had
    // asked for — so this asserts the gaps actually come from the JD.
    const gaps: string[] = [...(j.missingRequired ?? []), ...(j.missingPreferred ?? [])];
    ok("missing keywords are drawn from the posting", gaps.every((g) => JD.toLowerCase().includes(String(g).toLowerCase().split(/\s+/)[0])), gaps.slice(0, 6).join(", ") || "none missing");
  }
}

/* ------------------------------------------------------------------ */
/* 3. Per-job tailoring — and the master résumé left alone             */
/* ------------------------------------------------------------------ */

async function checkTailoring(before: Profile | null): Promise<void> {
  const r = await post("/resume/tailor", {
    jobTitle: "Backend Engineer",
    company: "Acme Platform",
    jobUrl: "https://boards.greenhouse.io/acme/jobs/998877",
    jobDescription: JD,
    // Deliberately no matchScore: nothing measured one, so nothing may report one.
  });
  const v = r.json?.data;
  ok("POST /resume/tailor answers", r.status === 200 && r.json?.ok, `HTTP ${r.status} ${r.json?.error ?? ""}`);
  if (!v) return;

  ok("the version is labelled for the resume bank", v.label === "Backend Engineer @ Acme Platform", v.label);
  ok("it is keyed by canonical job key", v.jobKey === "greenhouse:998877", v.jobKey);
  ok("it says whether a model wrote it", v.source === "llm" || v.source === "profile", `source=${v.source}, isAI=${r.json.isAI}`);
  ok("no match score is invented", v.matchScore === undefined, v.matchScore === undefined ? "absent, as it should be" : `reported ${v.matchScore}`);
  ok("keywords come from the posting", Array.isArray(v.keywords) && v.keywords.some((k: string) => /python|django|postgres/i.test(k)), (v.keywords ?? []).slice(0, 6).join(", "));
  ok(
    "unowned preferred skills are not claimed as matching",
    Array.isArray(v.matchingSkills) && !v.matchingSkills.some((s: string) => /kubernetes|terraform|kafka/i.test(s)),
    `matching: ${(v.matchingSkills ?? []).join(", ") || "none"}`,
  );
  ok(
    "the tailored résumé text does not list unowned skills as competencies",
    !/kubernetes|terraform/i.test(String(v.tailoredText ?? "")),
  );

  // The fabrication guard. When no model is configured the bullets must be the
  // candidate's own, unchanged — not the five invented achievements the old route
  // printed ("2M+ daily requests with 99.9% uptime, reducing latency by 40%").
  const own = (before?.experience ?? []).flatMap((e: any) => e.bullets ?? []).map(String);
  if (v.source === "profile") {
    const bullets: string[] = v.bullets ?? [];
    ok(
      "with no model, every bullet is one the profile already had",
      bullets.length > 0 && bullets.every((b) => own.includes(b)),
      `${bullets.length} bullets, all from the profile`,
    );
    ok("with no model, no metrics are invented", !/\d+%|\d+M\+|99\.9|\d+x /i.test(bullets.join(" ")));
  } else {
    ok("with a model, bullets were produced", Array.isArray(v.bullets) && v.bullets.length > 0, `${v.bullets?.length ?? 0} bullets from ${v.source}`);
  }

  // Never mutate the master résumé. This is the standing product rule.
  const after = (await get("/profile")).json?.data as Profile | null;
  ok(
    "tailoring did not touch the master résumé",
    String(after?.masterResumeText ?? "") === String(before?.masterResumeText ?? ""),
  );
  ok(
    "tailoring did not rewrite the stored experience bullets",
    JSON.stringify(after?.experience ?? []) === JSON.stringify(before?.experience ?? []),
  );

  // It has to be readable back out of the bank, by the same key the extension uses.
  const bank = await get("/resume/versions");
  const saved = (bank.json?.data ?? []).find((x: any) => x.jobKey === v.jobKey);
  ok("the version is saved to the resume bank", Boolean(saved), `${bank.json?.count ?? 0} version(s) stored`);
  ok("the bank stores the same shape the extension reads", Boolean(saved?.label && Array.isArray(saved?.keywords) && typeof saved?.createdAt === "number"));

  // Re-tailoring the same posting replaces its entry rather than adding a second.
  await post("/resume/tailor", {
    jobTitle: "Backend Engineer",
    company: "Acme Platform",
    jobUrl: "https://boards.greenhouse.io/acme/jobs/998877",
    jobDescription: JD,
  });
  const again = await get("/resume/versions");
  ok(
    "re-tailoring one posting does not duplicate it",
    (again.json?.data ?? []).filter((x: any) => x.jobKey === v.jobKey).length === 1,
    `${again.json?.count ?? 0} version(s) after re-tailoring`,
  );

  const del = await call("DELETE", `/resume/versions/${encodeURIComponent(v.jobKey)}`);
  ok("a saved version can be deleted", del.status === 200 && del.json?.ok, `HTTP ${del.status}`);
  const gone = await call("DELETE", `/resume/versions/${encodeURIComponent(v.jobKey)}`);
  ok("deleting a version that is not there is a 404, not a cheerful ok", gone.status === 404, `HTTP ${gone.status}`);
}

/* ------------------------------------------------------------------ */
/* 4. Cover letters — including the tone control                        */
/* ------------------------------------------------------------------ */

async function checkCoverLetter(): Promise<void> {
  const pro = await post("/resume/cover-letter", { company: "Acme Platform", jobTitle: "Backend Engineer", jobDescription: JD });
  ok("POST /resume/cover-letter answers", pro.status === 200 && pro.json?.ok, `HTTP ${pro.status} ${pro.json?.error ?? ""}`);
  const a = pro.json?.data;
  if (!a) return;
  ok("a letter was produced", typeof a.text === "string" && a.text.trim().length > 80, `${String(a.text ?? "").length} chars`);
  ok("it says who wrote it", a.source === "llm" || a.source === "template", `source=${a.source}`);
  ok("it reports the tone it applied", a.tone === "professional", `tone=${a.tone}`);
  ok("it names the posting", new RegExp("Backend Engineer", "i").test(String(a.text)));
  ok("it invents no metrics about the candidate", !/\d+%|\d+M\+|99\.9/.test(String(a.text)));

  // `tone` used to be read off the body and dropped, so the dashboard's selector
  // changed nothing. Two different tones must produce two different letters.
  const formal = await post("/resume/cover-letter", { company: "Acme Platform", jobTitle: "Backend Engineer", jobDescription: JD, tone: "formal" });
  const b = formal.json?.data;
  ok("the tone control is honoured", b?.tone === "formal", `tone=${b?.tone}`);
  if (a.source === "template" && b?.source === "template") {
    ok("a formal letter reads differently from a professional one", String(b.text) !== String(a.text));
    ok("the formal template opens formally", /Dear Hiring Manager/.test(String(b.text)));
    ok("the formal template signs off formally", /Sincerely,/.test(String(b.text)));
  } else {
    skip("compare tone wording byte-for-byte", "a model wrote these, so wording is not deterministic");
  }
  const bogus = await post("/resume/cover-letter", { company: "Acme", jobTitle: "Backend Engineer", tone: "pirate" });
  ok("an unknown tone falls back to professional rather than failing", bogus.json?.data?.tone === "professional", `tone=${bogus.json?.data?.tone}`);
}

/* ------------------------------------------------------------------ */
/* 5. The security holes that used to be here                          */
/* ------------------------------------------------------------------ */

async function checkResumeSecurity(): Promise<void> {
  // `POST /parse { filePath }` read and returned any file on the server. The old
  // version of THIS script was its only known caller.
  const traversal = await post("/resume/parse", { filePath: "C:/Windows/win.ini" });
  ok(
    "a client-supplied filePath is refused",
    traversal.status === 400 && traversal.json?.code === "FILEPATH_REMOVED",
    `HTTP ${traversal.status} ${traversal.json?.code ?? ""}`,
  );

  // Uploads were saved as path.join(UPLOAD_DIR, originalname).
  const evil = new FormData();
  evil.append("file", new Blob([SYNTHETIC_RESUME], { type: "text/plain" }), "../../../../evil-e2e.txt");
  const up = await post("/resume", evil);
  ok("a traversal filename cannot escape the upload directory", up.status === 200 && up.json?.ok && !String(up.json.filename).includes(".."), `stored as ${up.json?.filename}`);

  const wrongType = new FormData();
  wrongType.append("file", new Blob(["MZ\u0000binary"], { type: "application/x-msdownload" }), "payload.exe");
  const rejected = await post("/resume", wrongType);
  ok("a disallowed file type is rejected", rejected.status === 400, `HTTP ${rejected.status}`);

  const empty = await post("/resume/parse", { text: "too short" });
  ok("text too short to be a résumé is refused with a reason", empty.status === 400 && /at least/i.test(String(empty.json?.error)), String(empty.json?.error ?? "").slice(0, 60));

  const pasted = await post("/resume/parse", { text: SYNTHETIC_RESUME });
  ok("pasted résumé text is accepted", pasted.status === 200 && pasted.json?.ok && pasted.json?.data?.from === "text", `from=${pasted.json?.data?.from}`);
}

/* ------------------------------------------------------------------ */
/* 6. Matcher, recruiter finder, career-site adapter                   */
/* ------------------------------------------------------------------ */

async function checkMatcherAndOutreach(profile: Profile | null): Promise<void> {
  const resumeText = String(profile?.masterResumeText ?? "") || (profile?.skills ?? []).join(" ");
  const m = scoreMatch({ resumeText, jobDescription: JD, profileSkills: profile?.skills ?? [] });
  ok("the matcher returns a real score", isScore(m.score), `${m.score}% against the platform role`);
  ok("the matcher names what it matched on", Array.isArray(m.matched) && m.matched.length > 0, m.matched.slice(0, 6).join(", "));
  const unrelated = scoreMatch({ resumeText, jobDescription: "We are hiring a pastry chef to run our bakery in Lyon." });
  ok("an unrelated posting scores below a relevant one", unrelated.score < m.score, `${unrelated.score}% vs ${m.score}%`);

  const hr = await get("/outreach/recruiters?company=Flipkart&role=Backend+Engineer");
  ok("GET /outreach/recruiters answers", hr.status === 200 && hr.json?.ok, `HTTP ${hr.status} ${hr.json?.error ?? ""}`);
  const searches = hr.json?.data?.searches ?? [];
  ok("it returns recruiter searches", Array.isArray(searches) && searches.length > 0, `${searches.length} searches`);
  ok(
    "every search is a real LinkedIn URL, not a placeholder",
    searches.every((s: any) => /^https:\/\/(www\.)?linkedin\.com\//.test(String(s.linkedinSearchUrl ?? ""))),
  );

  // The generic career-site adapter. The old suite "verified login handling" by
  // calling ensureLogin({} as any) — a hardcoded `return true` given an empty
  // object where a Playwright Page belongs. Assert what can be asserted without a
  // browser instead: that the URLs it is given become the cards it will apply to.
  const urls = ["https://boards.greenhouse.io/sample/jobs/12345", "https://jobs.lever.co/sample/abcdef"];
  const adapter = createGenericAdapter(urls);
  ok("the generic career-site adapter is registered", adapter.id === "generic", adapter.id);
  ok("it exposes the apply surface the pipeline needs", typeof adapter.collectCards === "function" && typeof adapter.ensureLogin === "function");
}

/* ------------------------------------------------------------------ */

async function main(): Promise<void> {
  console.log("═".repeat(70));
  console.log("SuperJobAgent — authenticated end-to-end verification");
  console.log(`API: ${API}`);
  console.log("═".repeat(70));

  console.log("\n[0] Server and session");
  if (!(await signIn())) {
    report();
    return;
  }

  console.log("\n[1] Résumé upload, extraction and profile ingest");
  const { profile, usedFile } = await uploadResume();
  console.log(`      source: ${usedFile}`);

  console.log("\n[2] ATS scoring");
  await checkAts();

  console.log("\n[3] Per-job tailoring");
  await checkTailoring(profile);

  console.log("\n[4] Cover letters");
  await checkCoverLetter();

  console.log("\n[5] Résumé endpoint security");
  await checkResumeSecurity();

  console.log("\n[6] Matcher, recruiter finder, career-site adapter");
  await checkMatcherAndOutreach(profile);

  report();
}

function report(): void {
  console.log("\n" + "═".repeat(70));
  console.log(`${passed} passed · ${failed} failed · ${skipped} skipped`);
  console.log("═".repeat(70));
  if (failed > 0) process.exitCode = 1;
}

main().catch((err) => {
  console.error("\nThe suite itself crashed:", err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
