/**
 * `/api/resume` — upload, parse, ATS scoring, cover letters, per-job tailoring.
 *
 * SIX THINGS WERE WRONG HERE. Three were security holes; the worst was a lie.
 *
 * 1. FABRICATED RÉSUMÉ CONTENT. `generateTailoredBullets()` invented five
 *    achievements with specific metrics and handed them to the user as their own
 *    experience, ready to send to an employer:
 *
 *      "Architected and delivered ${kw1}-based microservices handling 2M+ daily
 *       requests with 99.9% uptime, reducing latency by 40%"
 *      "Led cross-functional team of 6 engineers … cutting costs by 35%"
 *      "Mentored 3 junior engineers … driving team velocity improvement of 25%"
 *
 *    `kw1` came from a fixed technology list, not from the posting. This was the
 *    `aiTailored.length >= 3 ? aiTailored : tailoredBullets` fallback — and since
 *    the LLM client was built from settings fields that do not exist (defect 2),
 *    it was what every user got, every time. Tailoring now runs core's
 *    `tailorForJob`, which rewrites the user's OWN stored bullets and only weaves
 *    in keywords their own skills already back up.
 *
 * 2. AN LLM THAT WAS NEVER REACHABLE. Two `createLLM({ provider:
 *    settings.aiProvider ?? "ollama", model: settings.aiModel ?? "llama3.2",
 *    apiKey: settings.aiApiKey ?? "" })` literals. `normalizeAgentSettings` strips
 *    all three fields, so both resolved to Ollama-on-localhost with no key: a
 *    `NullClient` on any hosted deployment. Now `getLLM()` (core's real
 *    `llmConfig`), and every reply says which produced it.
 *
 * 3. ARBITRARY SERVER-SIDE FILE READ. `POST /parse` did
 *    `const targetPath = filePath || "C:/Users/shash/Downloads/shashi_resume_latest.pdf"`
 *    — a client-supplied absolute path, read and returned. `filePath` is gone; the
 *    endpoint reads pasted text or this tenant's own stored upload.
 *
 * 4. COMMAND INJECTION. `execSync(`python "${helper}" "${filePath}"`)` ran a shell
 *    with that same path interpolated. Core already extracts text in-process
 *    (`pdfToText` via pdfjs-dist, `docxToText` via fflate) — the same code the
 *    extension uses — so the subprocess is deleted, not escaped.
 *
 * 5. PATH TRAVERSAL / CROSS-TENANT OVERWRITE. Uploads were saved as
 *    `path.join(UPLOAD_DIR, req.file.originalname)`, so "../../server.js" escaped
 *    the directory and two tenants uploading "resume.pdf" overwrote each other.
 *    Files are now written to a per-tenant directory under a sanitised name.
 *
 * 6. A THIRD ATS IMPLEMENTATION, MADE OF CONSTANTS. `GET /score` scored keywords
 *    as `… : 70`, format as `60 + …`, quantification as `hasNumbers ? 85 : 45`,
 *    and reported a fixed TRENDING list as "missing keywords" — keywords no job
 *    had asked for. It now runs core's `analyzeATS`, and says plainly that
 *    keyword coverage needs a target job description.
 */
import { Router, type RequestHandler } from "express";
import multer from "multer";
import path from "node:path";
import fs from "node:fs/promises";
import {
  touchSyncKey,
  analyzeATS,
  canonicalJobKey,
  describeLLMConfig,
  docxToText,
  generateCoverLetter,
  getStore,
  listResumeVersions,
  mergeProfileFromParse,
  parseResumeText,
  parseResumeUniversal,
  groundedTailorResume,
  pdfToText,
  readProfile,
  resumeTextForAnalysis,
  suggestInsertions,
  tailorForJob,
  textToPdf,
  upsertResumeVersion,
  writeProfile,
  type Profile,
  type TailoredResumeVersion,
} from "@superjob/core";
import { ocrImage, ocrPdf, type OcrResult } from "@superjob/core/ocr";
import { getLLM } from "../lib/llm.js";
import { asyncRoute, currentUser, runAsUser } from "../lib/tenant.js";
import { uploadResumeToSupabaseStorage } from "../lib/supabase.js";

export const resumeRouter = Router();

const UPLOAD_ROOT = path.resolve(".uploads");
const ALLOWED_EXT = new Set([".pdf", ".docx", ".txt", ".md", ".png", ".jpg", ".jpeg"]);
const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
const MAX_ACTIVE_JOB_DESCRIPTION_CHARS = 250_000;
/** Below this, extraction produced noise rather than a résumé. */
const MIN_RESUME_CHARS = 50;

interface ActiveJobContext {
  jobKey: string;
  jobUrl: string;
  title: string;
  company: string;
  description: string;
  updatedAt: number;
}

function activeJobKey(jobUrl: string, title: string, company: string): string {
  return canonicalJobKey(jobUrl, title, company);
}

async function saveActiveJobContext(context: ActiveJobContext): Promise<void> {
  await getStore().set("activeJobContext", context);
}

function validateJobUrl(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const raw = value.trim();
  if (!raw || raw.length > 2048) return null;
  try {
    const url = new URL(raw);
    if (url.protocol !== "https:" || url.username || url.password) return null;
    return url.href;
  } catch {
    return null;
  }
}

/**
 * Memory storage, deliberately: multer's disk mode names the temp file itself and
 * the old handler then renamed it to `req.file.originalname`. Keeping the bytes in
 * memory means nothing is written until the name has been sanitised and the
 * tenant's directory resolved. The 10 MB limit bounds the memory.
 */
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_UPLOAD_BYTES, files: 1 },
  fileFilter: (_req, file, cb) => {
    cb(null, ALLOWED_EXT.has(path.extname(file.originalname).toLowerCase()));
  },
});

const uploadResumeForTenant: RequestHandler = (req, res, next) => {
  const user = currentUser() ?? {
    userId: "local",
    email: "candidate@superjob.local",
    tier: "ultra",
    name: "Candidate",
    createdAt: Date.now(),
    lastLoginAt: Date.now(),
  };

  upload.single("file")(req, res, (error) => {
    void runAsUser(user as any, () => next(error));
  });
};

/* ------------------------------------------------------------------ */
/* Files                                                               */
/* ------------------------------------------------------------------ */

/** This tenant's upload directory. Never influenced by request data. */
function tenantUploadDir(): string {
  const raw = currentUser()?.userId ?? "local";
  const safe = raw.replace(/[^A-Za-z0-9_-]/g, "_").slice(0, 64) || "local";
  return path.join(UPLOAD_ROOT, safe);
}

/** A filename that cannot escape a directory or collide across tenants. */
function safeFileName(original: unknown): string {
  const base = path.basename(String(original ?? "resume"));
  const ext = path.extname(base).toLowerCase();
  const stem =
    base.slice(0, base.length - ext.length).replace(/[^A-Za-z0-9._-]+/g, "_").slice(0, 80) || "resume";
  return `${stem}${ALLOWED_EXT.has(ext) ? ext : ".txt"}`;
}

/**
 * Résumé bytes → text, in this process.
 *
 * The Python subprocess this replaces needed PyMuPDF installed on the host, only
 * handled PDFs (a .docx passed the upload filter and then failed silently), and
 * interpolated a caller-supplied path into a shell command. Core's extractors are
 * the ones the extension already uses, so both surfaces read a résumé identically.
 */
export interface ResumeOcr {
  image(data: Uint8Array): Promise<OcrResult>;
  pdf(data: Uint8Array): Promise<OcrResult>;
}

export async function extractResumeText(
  bytes: Uint8Array,
  filename: string,
  ocr: ResumeOcr = { image: ocrImage, pdf: ocrPdf },
): Promise<{ text: string; error?: string; method: "text" | "pdf-text" | "ocr-image" | "ocr-pdf" }> {
  const ext = path.extname(filename).toLowerCase();
  try {
    if (ext === ".txt" || ext === ".md") {
      return { text: new TextDecoder("utf-8").decode(bytes), method: "text" };
    }
    if (ext === ".docx") return { text: docxToText(bytes), method: "text" };
    if (ext === ".png" || ext === ".jpg" || ext === ".jpeg") {
      const result = await ocr.image(bytes);
      return { text: result.text, method: "ocr-image" };
    }
    if (ext === ".pdf") {
      let extractedText = "";
      try {
        extractedText = await pdfToText(bytes);
      } catch {
        // A malformed or scanned PDF can still be readable by the OCR renderer.
      }
      if (extractedText.trim().length >= MIN_RESUME_CHARS) {
        return { text: extractedText, method: "pdf-text" };
      }
      try {
        const result = await ocr.pdf(bytes);
        return {
          text: [extractedText.trim(), result.text.trim()].filter(Boolean).join("\n\n"),
          method: "ocr-pdf",
        };
      } catch (error) {
        return {
          text: extractedText,
          error: error instanceof Error ? error.message : String(error),
          method: "ocr-pdf",
        };
      }
    }
    return {
      text: "",
      error: `Unsupported file type "${ext || "unknown"}".`,
      method: "text",
    };
  } catch (e) {
    return {
      text: "",
      error: e instanceof Error ? e.message : String(e),
      method: ext === ".png" || ext === ".jpg" || ext === ".jpeg" ? "ocr-image" : "text",
    };
  }
}

/* ------------------------------------------------------------------ */
/* Profile ingest                                                      */
/* ------------------------------------------------------------------ */

/**
 * Parse résumé text into the profile.
 *
 * `mergeProfileFromParse` is core's merge — the same one the extension's upload
 * path uses. The two hand-rolled 15-line spreads this replaced disagreed with it
 * (they overwrote nothing but also filled nothing beyond nine fields, and dropped
 * projects, certifications, languages and every India-specific field the parser
 * had just extracted).
 */
async function ingestResumeText(
  text: string,
  meta: { fileName?: string; mimeType?: string },
): Promise<{ profile: Profile; warnings: string[]; extracted: string[]; confidence: number; source: string }> {
  const llm = await getLLM().catch(() => null);
  const result = await parseResumeUniversal(text, llm?.client);
  const existing = (await readProfile<Profile>()) ?? ({} as Profile);
  const parsed: Profile = {
    ...result.profile,
    masterResumeText: text,
    ...(meta.fileName ? { resumeFileName: meta.fileName } : {}),
    ...(meta.mimeType ? { resumeMimeType: meta.mimeType } : {}),
    resumeUploadedAt: Date.now(),
  };
  const merged = mergeProfileFromParse(existing, parsed);
  await writeProfile(merged);
  await touchSyncKey("profile");
  return {
    profile: merged,
    warnings: result.warnings ?? [],
    extracted: [
      `${merged.experience?.length ?? 0} jobs`,
      `${merged.education?.length ?? 0} education`,
      `${merged.skills?.length ?? 0} skills`,
      `${merged.projects?.length ?? 0} projects`,
    ],
    confidence: result.confidence,
    source: result.source,
  };
}

/** What the UI shows after a parse. Counts, not claims. */
function ingestSummary(p: Profile) {
  return {
    name: `${p.firstName ?? ""} ${p.lastName ?? ""}`.trim(),
    email: p.email ?? "",
    phone: p.phone ?? "",
    skillsCount: (p.skills ?? []).length,
    experienceCount: (p.experience ?? []).length,
    educationCount: (p.education ?? []).length,
    projectsCount: (p.projects ?? []).length,
  };
}

/* ------------------------------------------------------------------ */
/* POST /api/resume — upload a résumé file                             */
/* ------------------------------------------------------------------ */

resumeRouter.post(
  "/",
  uploadResumeForTenant,
  asyncRoute(async (req, res) => {
    const file = (req as { file?: { buffer: Buffer; originalname: string; mimetype?: string } }).file;
    if (!file) {
      return res.status(400).json({
        ok: false,
        error: "Attach a .pdf, .docx, .txt, .md, .png, .jpg or .jpeg résumé under 10 MB (form field name: file).",
      });
    }

    const filename = safeFileName(file.originalname);
    const dir = tenantUploadDir();
    await fs.mkdir(dir, { recursive: true });
    const dest = path.join(dir, `${Date.now()}-${filename}`);
    // Defence in depth: after sanitising, prove the target is still inside the
    // tenant's own directory before writing a single byte.
    if (!dest.startsWith(dir + path.sep)) {
      return res.status(400).json({ ok: false, error: "Invalid file name." });
    }
    await fs.writeFile(dest, file.buffer);
    await getStore().set("resumePath", dest);

    // Upload to Supabase Storage Bucket
    const supabaseUpload = await uploadResumeToSupabaseStorage(
      currentUser()?.userId || "local",
      filename,
      file.buffer,
      file.mimetype || "application/pdf",
    );
    if (supabaseUpload.publicUrl) {
      await getStore().set("resumeCloudUrl", supabaseUpload.publicUrl);
    }

    const extraction = await extractResumeText(new Uint8Array(file.buffer), filename);
    const { text, error } = extraction;
    const trimmed = text.trim();
    if (trimmed.length < MIN_RESUME_CHARS) {
      return res.json({
        ok: true,
        filename,
        bytes: file.buffer.length,
        textLength: trimmed.length,
        parsed: null,
        extractionMethod: extraction.method,
        cloudStorage: {
          ok: supabaseUpload.ok,
          publicUrl: supabaseUpload.publicUrl,
        },
        warnings: [],
        note: error
          ? `Saved the file, but text extraction failed (${error}). Review the scan or paste its text with POST /api/resume/parse.`
          : "Saved the file, but extraction returned too little readable text to update the profile. Review the scan or paste its text with POST /api/resume/parse.",
      });
    }

    const { profile, warnings, extracted, source, confidence } = await ingestResumeText(trimmed, {
      fileName: filename,
      mimeType: file.mimetype,
    });
    res.json({
      ok: true,
      filename,
      bytes: file.buffer.length,
      textLength: trimmed.length,
      parsed: ingestSummary(profile),
      extractionMethod: extraction.method,
      cloudStorage: {
        ok: supabaseUpload.ok,
        publicUrl: supabaseUpload.publicUrl,
        storagePath: supabaseUpload.storagePath,
      },
      source,
      confidence,
      extracted,
      warnings,
    });
  }),
);

/* ------------------------------------------------------------------ */
/* GET /api/resume/download — download active resume file             */
/* ------------------------------------------------------------------ */

resumeRouter.get(
  "/download",
  asyncRoute(async (_req, res) => {
    const stored = await getStore().get<string>("resumePath");
    const cloudUrl = await getStore().get<string>("resumeCloudUrl");

    if (stored) {
      const resolved = path.resolve(stored);
      if (resolved.startsWith(UPLOAD_ROOT + path.sep)) {
        try {
          const stats = await fs.stat(resolved);
          if (stats.isFile()) {
            const ext = path.extname(resolved).toLowerCase();
            const mimeType =
              ext === ".pdf"
                ? "application/pdf"
                : ext === ".docx"
                ? "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                : "text/plain";
            res.setHeader("Content-Type", mimeType);
            res.setHeader("Content-Disposition", `attachment; filename="${path.basename(resolved)}"`);
            const fileStream = await fs.readFile(resolved);
            return res.send(fileStream);
          }
        } catch {
          // fallback to cloudUrl
        }
      }
    }

    if (cloudUrl) {
      return res.redirect(cloudUrl);
    }

    return res.status(404).json({ ok: false, error: "No active resume document found." });
  }),
);

/* ------------------------------------------------------------------ */
/* GET /api/resume/file — stream active resume file for preview       */
/* ------------------------------------------------------------------ */

resumeRouter.get(
  "/file",
  asyncRoute(async (_req, res) => {
    const stored = await getStore().get<string>("resumePath");
    const cloudUrl = await getStore().get<string>("resumeCloudUrl");

    if (stored) {
      const resolved = path.resolve(stored);
      if (resolved.startsWith(UPLOAD_ROOT + path.sep)) {
        try {
          const stats = await fs.stat(resolved);
          if (stats.isFile()) {
            const ext = path.extname(resolved).toLowerCase();
            const mimeType =
              ext === ".pdf"
                ? "application/pdf"
                : ext === ".docx"
                ? "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                : "text/plain";
            res.setHeader("Content-Type", mimeType);
            res.setHeader("Content-Disposition", `inline; filename="${path.basename(resolved)}"`);
            const fileStream = await fs.readFile(resolved);
            return res.send(fileStream);
          }
        } catch {
          // fallback to cloudUrl
        }
      }
    }

    if (cloudUrl) {
      return res.redirect(cloudUrl);
    }

    return res.status(404).json({ ok: false, error: "No active resume document found." });
  }),
);

/* ------------------------------------------------------------------ */
/* GET /api/resume/status — metadata & storage sync status            */
/* ------------------------------------------------------------------ */

resumeRouter.get(
  "/status",
  asyncRoute(async (_req, res) => {
    const profile = await readProfile<Profile>();
    const resumePath = await getStore().get<string>("resumePath");
    const resumeCloudUrl = await getStore().get<string>("resumeCloudUrl");

    let fileExists = false;
    let fileSizeBytes = 0;

    if (resumePath) {
      try {
        const stats = await fs.stat(path.resolve(resumePath));
        fileExists = stats.isFile();
        fileSizeBytes = stats.size;
      } catch {
        fileExists = false;
      }
    }

    res.json({
      ok: true,
      data: {
        hasResume: Boolean(fileExists || resumeCloudUrl || profile?.masterResumeText),
        filename: profile?.resumeFileName || (resumePath ? path.basename(resumePath) : null),
        cloudUrl: resumeCloudUrl || null,
        storageProvider: resumeCloudUrl ? "supabase" : "local",
        fileSizeBytes,
        uploadedAt: profile?.resumeUploadedAt || null,
        parsedSummary: profile ? ingestSummary(profile) : null,
      },
    });
  }),
);

/* ------------------------------------------------------------------ */
/* POST /api/resume/update-profile — UI live editor update & sync     */
/* ------------------------------------------------------------------ */

resumeRouter.post(
  "/update-profile",
  asyncRoute(async (req, res) => {
    const existing = (await readProfile<Profile>()) ?? ({} as Profile);
    const updates = (req.body ?? {}) as Partial<Profile>;

    const updatedProfile: Profile = {
      ...existing,
      ...updates,
      updatedAt: Date.now(),
    };

    await writeProfile(updatedProfile);
    await touchSyncKey("profile");

    res.json({
      ok: true,
      profile: updatedProfile,
      summary: ingestSummary(updatedProfile),
    });
  }),
);

/* ------------------------------------------------------------------ */
/* POST /api/resume/parse — re-parse stored résumé, or parse pasted text */
/* ------------------------------------------------------------------ */

resumeRouter.post(
  "/parse",
  asyncRoute(async (req, res) => {
    const body = (req.body ?? {}) as { text?: unknown; filePath?: unknown };

    // Explicit rather than ignored: a client that still sends `filePath` gets told
    // why it stopped working instead of silently parsing the wrong thing.
    // Graceful backward compatibility: if client sends filePath or empty body, parse stored resume
    if (body.filePath !== undefined && !body.text) {
      console.log("[resume/parse] Client sent legacy filePath — defaulting to stored resume file");
    }

    let text = String(body.text ?? "").trim();
    let from: "text" | "storedFile" = "text";

    if (!text) {
      const stored = await getStore().get<string>("resumePath");
      if (!stored) {
        return res.status(400).json({
          ok: false,
          error: "No résumé on file. Upload one to POST /api/resume, or send { text } with your résumé text.",
        });
      }
      // Only a file this server wrote under its own upload root is readable, which
      // is what keeps a stored path from becoming the old arbitrary-read hole.
      const resolved = path.resolve(stored);
      if (resolved !== UPLOAD_ROOT && !resolved.startsWith(UPLOAD_ROOT + path.sep)) {
        return res.status(400).json({
          ok: false,
          error:
            "The résumé on file is outside this server's upload directory, so it is not readable. Re-upload it to POST /api/resume.",
        });
      }
      const bytes = await fs.readFile(resolved).catch(() => undefined);
      if (!bytes) {
        return res.status(404).json({ ok: false, error: "The stored résumé file is gone. Re-upload it." });
      }
      const extractedText = await extractResumeText(new Uint8Array(bytes), resolved);
      text = extractedText.text.trim();
      from = "storedFile";
      if (extractedText.error && !text) {
        return res.status(400).json({ ok: false, error: `Could not read that file: ${extractedText.error}` });
      }
    }

    if (text.length < MIN_RESUME_CHARS) {
      return res.status(400).json({
        ok: false,
        error: `Need at least ${MIN_RESUME_CHARS} characters of résumé text to parse (got ${text.length}).`,
      });
    }

    const { profile, warnings, extracted } = await ingestResumeText(text, {});
    res.json({
      ok: true,
      data: { profile, warnings, extracted, from, textLength: text.length, parsed: ingestSummary(profile) },
    });
  }),
);

/* ------------------------------------------------------------------ */
/* ATS score                                                           */
/* ------------------------------------------------------------------ */

/**
 * One scorer for both routes.
 *
 * Without a job description there is no honest keyword score: `analyzeATS` has
 * nothing to compare against, so `keywordScore` and `requiredScore` are 0 and the
 * weighted `score` (52% of which is keyword coverage) would report a terrible ATS
 * result for a perfectly good résumé. So the JD-less answer reports only the
 * JD-independent measurements — parseability, sections, contact, formatting,
 * readability — and says what is missing. The old code filled the gap with
 * constants (`keywordPct … : 70`, `quantPct = hasNumbers ? 85 : 45`) and a fixed
 * "trending skills" list presented as keywords the user was missing.
 */
async function computeAtsScore(jobDescription: string, jobTitle: string) {
  const profile = await readProfile<Profile>();
  if (!profile) {
    return { error: "No profile saved yet. Upload a résumé or fill in your profile first." as string };
  }
  const { text: resumeText, source: resumeSource } = resumeTextForAnalysis(profile);
  if (resumeText.trim().length < MIN_RESUME_CHARS) {
    return {
      error:
        "There is not enough résumé text to analyse. Upload your résumé (POST /api/resume) or paste its text so the ATS checks have something to read." as string,
    };
  }

  const jd = jobDescription.trim();
  const ats = analyzeATS(resumeText, jd);
  const lower = resumeText.toLowerCase();
  const skills = (profile.skills ?? []).map((s) => String(s)).filter(Boolean);
  // A real intersection: skills the user lists that the résumé text actually
  // contains. This one thing the old route already did honestly.
  const detectedSkills = skills.filter((s) => lower.includes(s.toLowerCase()));
  const scoped = Boolean(jd);

  const overall = scoped ? ats.score : ats.parseScore;
  const breakdown = scoped
    ? {
        requiredKeywords: ats.requiredScore,
        allKeywords: ats.keywordScore,
        parseability: ats.parseScore,
        sections: ats.sectionScore,
        titleAlignment: ats.titleScore,
        readability: ats.readabilityScore,
      }
    : {
        contactParsing: ats.contactScore,
        sectionStructure: ats.sectionScore,
        formatting: ats.formatScore,
        readability: ats.readabilityScore,
      };

  const suggestions = scoped
    ? suggestInsertions(ats).slice(0, 8)
    : ats.checks
        .filter((c) => c.status !== "pass" && c.code !== "required-keywords" && c.code !== "title-alignment")
        .map((c) => c.fix)
        .filter((x): x is string => Boolean(x));

  await getStore().set("ats_score", {
    overall,
    scope: scoped ? "job" : "structure",
    resumeSource,
    ...(jobTitle ? { jobTitle } : {}),
    updatedAt: Date.now(),
  });

  return {
    data: {
      overall,
      scope: scoped ? "job" : "structure",
      resumeSource,
      breakdown,
      detectedSkills: detectedSkills.slice(0, 24),
      missingKeywords: scoped ? [...ats.missingRequired, ...ats.missingPreferred].slice(0, 12) : [],
      suggestions,
      warnings: ats.warnings,
      sections: ats.sectionScores,
      checks: ats.checks,
      ...(scoped
        ? {
            passProbability: ats.passProbability,
            workday: ats.workday,
            missingRequired: ats.missingRequired,
            missingPreferred: ats.missingPreferred,
            requiredKeywords: ats.requiredKeywords,
            keywordCoverage: ats.keywordCoverage.slice(0, 30),
            ...(jobTitle ? { jobTitle } : {}),
          }
        : {
            message:
              "This is a structural score only — parseability, sections, contact details and formatting. Keyword coverage and an overall ATS score need a target job description: POST /api/resume/score with { jobDescription }.",
          }),
      analyzedAt: Date.now(),
    },
  };
}

// GET /api/resume/score — structural analysis of the stored résumé
resumeRouter.get(
  "/score",
  asyncRoute(async (_req, res) => {
    const result = await computeAtsScore("", "");
    if (result.error) return res.status(400).json({ ok: false, error: result.error });
    res.json({ ok: true, data: result.data });
  }),
);

// POST /api/resume/score — full analysis against one posting
resumeRouter.post(
  "/score",
  asyncRoute(async (req, res) => {
    const body = (req.body ?? {}) as { jobDescription?: unknown; jobTitle?: unknown };
    const result = await computeAtsScore(String(body.jobDescription ?? ""), String(body.jobTitle ?? "").trim());
    if (result.error) return res.status(400).json({ ok: false, error: result.error });
    res.json({ ok: true, data: result.data });
  }),
);

/* ------------------------------------------------------------------ */
/* Cover letter                                                        */
/* ------------------------------------------------------------------ */

/**
 * POST /api/resume/cover-letter — `{ company, jobTitle, jobDescription, tone? }`
 *
 * `tone` was read off the body here and then dropped, because core's
 * `generateCoverLetter` had no parameter for it: the dashboard's tone selector
 * changed nothing. Core now takes it, so the reply reports the tone it actually
 * applied. `source` says whether a model wrote it or the template did, and when
 * there is no model the reason travels with it instead of the UI having to guess.
 */
resumeRouter.post(
  "/cover-letter",
  asyncRoute(async (req, res) => {
    const body = (req.body ?? {}) as {
      company?: unknown;
      jobTitle?: unknown;
      jobDescription?: unknown;
      tone?: unknown;
    };
    const title = String(body.jobTitle ?? "").trim();
    const company = String(body.company ?? "").trim();
    if (!title && !company) {
      return res.status(400).json({ ok: false, error: "jobTitle or company is required." });
    }

    const profile = await readProfile<Profile>();
    if (!profile) {
      return res.status(400).json({
        ok: false,
        error: "No profile saved yet. Upload a résumé or fill in your profile so the letter has something true to say.",
      });
    }

    const llm = await getLLM();
    const result = await generateCoverLetter(
      { title, company, description: String(body.jobDescription ?? "") },
      profile,
      llm.client,
      body.tone,
    );

    res.json({
      ok: true,
      data: {
        text: result.text,
        source: result.source,
        tone: result.tone,
        aiUsed: result.source === "llm",
        // Only when the letter came from the template: why, so the UI can say it.
        ...(result.source === "template" ? { note: describeLLMConfig(llm.config).message } : {}),
      },
    });
  }),
);

/* ------------------------------------------------------------------ */
/* Tailored versions                                                   */
/* ------------------------------------------------------------------ */

resumeRouter.get(
  "/active-job",
  asyncRoute(async (req, res) => {
    const active = await getStore().get<ActiveJobContext>("activeJobContext");
    if (!active) return res.json({ ok: true, data: null });

    const requestedUrl = req.query.jobUrl === undefined ? null : validateJobUrl(req.query.jobUrl);
    if (req.query.jobUrl !== undefined && !requestedUrl) {
      return res.status(400).json({ ok: false, error: "jobUrl must be a valid HTTPS job-posting URL." });
    }
    if (requestedUrl && active.jobKey !== activeJobKey(requestedUrl, active.title, active.company)) {
      return res.json({ ok: true, data: null });
    }
    res.json({ ok: true, data: active });
  }),
);

resumeRouter.post(
  "/active-job",
  asyncRoute(async (req, res) => {
    const body = (req.body ?? {}) as {
      jobUrl?: unknown;
      jobTitle?: unknown;
      company?: unknown;
      jobDescription?: unknown;
    };
    const jobUrl = validateJobUrl(body.jobUrl);
    if (!jobUrl) {
      return res.status(400).json({ ok: false, error: "A valid HTTPS job-posting URL is required." });
    }
    if (
      (body.jobTitle !== undefined && typeof body.jobTitle !== "string") ||
      (body.company !== undefined && typeof body.company !== "string") ||
      (body.jobDescription !== undefined && typeof body.jobDescription !== "string")
    ) {
      return res.status(400).json({ ok: false, error: "Job title, company and description must be text." });
    }
    const title = (body.jobTitle ?? "").trim().slice(0, 300);
    const company = (body.company ?? "").trim().slice(0, 300);
    const description = (body.jobDescription ?? "").trim();
    if (description.length > MAX_ACTIVE_JOB_DESCRIPTION_CHARS) {
      return res.status(413).json({
        ok: false,
        error: `Job description exceeds the ${MAX_ACTIVE_JOB_DESCRIPTION_CHARS.toLocaleString()}-character storage limit; it was not saved or truncated.`,
      });
    }

    const updatedAt = Date.now();
    const context: ActiveJobContext = {
      jobKey: activeJobKey(jobUrl, title, company),
      jobUrl,
      title,
      company,
      description,
      updatedAt,
    };
    await saveActiveJobContext(context);
    res.json({
      ok: true,
      data: { jobKey: context.jobKey, descriptionLength: description.length, updatedAt },
    });
  }),
);

resumeRouter.delete(
  "/active-job",
  asyncRoute(async (req, res) => {
    const jobUrl = validateJobUrl(req.query.jobUrl);
    if (!jobUrl) {
      return res.status(400).json({ ok: false, error: "A valid HTTPS jobUrl is required to clear active job data." });
    }
    const active = await getStore().get<ActiveJobContext>("activeJobContext");
    if (!active) return res.json({ ok: true, cleared: false });
    if (active.jobKey !== activeJobKey(jobUrl, active.title, active.company)) {
      return res.status(409).json({ ok: false, error: "The active job changed; refusing to clear a different job description." });
    }
    await getStore().delete("activeJobContext");
    res.json({ ok: true, cleared: true });
  }),
);

/**
 * The resume bank, in the shape the extension already stores.
 *
 * One store key (`resumeVersions`), two incompatible readers: the extension keeps
 * `Record<jobKey, ResumeVersion>` while this route kept an array of a private
 * `{ id, label, jobTitle, matchScore, bullets }` shape with its own
 * `resume_${Date.now()}` ids. A version tailored in the cloud was therefore
 * invisible to the extension on the posting it was made for. Both sides now write
 * the map, keyed by `canonicalJobKey`, through core's `upsertResumeVersion`.
 *
 * Legacy array records are discarded rather than migrated: their bullets were the
 * five fabricated achievements described at the top of this file, and no user
 * should keep those.
 */
async function readVersionMap(): Promise<Record<string, TailoredResumeVersion>> {
  const raw = await getStore().get<unknown>("resumeVersions");
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const out: Record<string, TailoredResumeVersion> = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (value && typeof value === "object" && typeof (value as TailoredResumeVersion).jobKey === "string") {
      out[key] = value as TailoredResumeVersion;
    }
  }
  return out;
}

resumeRouter.get(
  "/preview.pdf",
  asyncRoute(async (req, res) => {
    const version = String(req.query.version ?? "source");
    if (version !== "source" && version !== "latest") {
      return res.status(400).json({ ok: false, error: "version must be source or latest." });
    }

    let pdf: Uint8Array;
    let fileName: string;
    if (version === "latest") {
      const latest = listResumeVersions(await readVersionMap())[0];
      if (!latest?.tailoredText?.trim()) {
        return res.status(404).json({ ok: false, error: "No tailored resume is available to preview yet." });
      }
      pdf = textToPdf(latest.tailoredText);
      fileName = "latest-tailored-resume.pdf";
    } else {
      const profile = await readProfile<Profile>();
      const profileText = String(profile?.masterResumeText ?? "").trim();
      const storedPath = await getStore().get<string>("resumePath");
      let sourcePdf: Uint8Array | undefined;
      let sourceText = profileText;

      if (storedPath) {
        const resolved = path.resolve(storedPath);
        const tenantDir = path.resolve(tenantUploadDir());
        const relativePath = path.relative(tenantDir, resolved);
        if (
          !relativePath ||
          relativePath === ".." ||
          relativePath.startsWith(`..${path.sep}`) ||
          path.isAbsolute(relativePath)
        ) {
          return res.status(400).json({ ok: false, error: "The stored resume is outside this account's upload directory." });
        }
        const bytes = await fs.readFile(resolved).catch(() => undefined);
        if (!bytes) return res.status(404).json({ ok: false, error: "The uploaded source resume is missing. Upload it again." });

        if (path.extname(resolved).toLowerCase() === ".pdf" && bytes.subarray(0, 5).toString("ascii") === "%PDF-") {
          sourcePdf = new Uint8Array(bytes);
        } else if (!sourceText) {
          const extracted = await extractResumeText(new Uint8Array(bytes), resolved);
          sourceText = extracted.text.trim();
        }
      }

      if (sourcePdf) {
        pdf = sourcePdf;
      } else if (sourceText) {
        pdf = textToPdf(sourceText);
      } else {
        return res.status(404).json({ ok: false, error: "No readable source resume is available to preview." });
      }
      fileName = "source-resume.pdf";
    }

    res.setHeader("Cache-Control", "no-store");
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Content-Disposition", `inline; filename="${fileName}"`);
    res.type("application/pdf").send(Buffer.from(pdf));
  }),
);

// GET /api/resume/versions — the bank, newest first
resumeRouter.get(
  "/versions",
  asyncRoute(async (_req, res) => {
    const versions = listResumeVersions(await readVersionMap());
    res.json({ ok: true, data: versions, count: versions.length });
  }),
);

// DELETE /api/resume/versions/:jobKey — drop one tailored version
resumeRouter.delete(
  "/versions/:jobKey",
  asyncRoute(async (req, res) => {
    const map = await readVersionMap();
    const key = String(req.params.jobKey ?? "");
    if (!map[key]) {
      // A 404 rather than a cheerful ok: the caller asked to delete something that
      // is not there, and saying "done" hides a bad job key.
      return res.status(404).json({ ok: false, error: "No tailored version with that job key." });
    }
    delete map[key];
    await getStore().set("resumeVersions", map);
    res.json({ ok: true, jobKey: key });
  }),
);

/**
 * POST /api/resume/tailor — `{ jobTitle, company, jobDescription, jobUrl?, matchScore? }`
 *
 * The whole tailoring lives in core (`tailorForJob`), so the extension and the
 * cloud produce the same version for the same posting. What this route used to do
 * instead is defect 1 in the header: five invented achievements with invented
 * metrics, offered as the user's own experience, plus `matchScore: matchScore || 75`
 * so an unscored posting acquired a score of 75 on disk.
 *
 * The master résumé is never touched — `tailorForJob` reads `profile` and returns a
 * new version; nothing writes back to `masterResumeText`.
 */
resumeRouter.post(
  "/tailor",
  asyncRoute(async (req, res) => {
    const body = (req.body ?? {}) as {
      jobTitle?: unknown;
      company?: unknown;
      jobDescription?: unknown;
      jobUrl?: unknown;
      url?: unknown;
      matchScore?: unknown;
    };
    const title = String(body.jobTitle ?? "").trim();
    const company = String(body.company ?? "").trim();
    const jobDescription = String(body.jobDescription ?? "").trim();
    if (!title && !company) {
      return res.status(400).json({ ok: false, error: "jobTitle or company is required." });
    }

    const profile = await readProfile<Profile>();
    if (!profile) {
      return res.status(400).json({
        ok: false,
        error:
          "No profile saved yet. Tailoring rewrites your own stored experience, so upload a résumé (POST /api/resume) first.",
      });
    }

    const llm = await getLLM();
    const jobUrl = String(body.jobUrl ?? body.url ?? "");
    const rawScore = Number(body.matchScore);
    const normalizedJobUrl = jobUrl ? validateJobUrl(jobUrl) : null;
    if (jobUrl && !normalizedJobUrl) {
      return res.status(400).json({ ok: false, error: "jobUrl must be a valid HTTPS job-posting URL." });
    }
    if (jobDescription.length > MAX_ACTIVE_JOB_DESCRIPTION_CHARS) {
      return res.status(413).json({
        ok: false,
        error: `Job description exceeds the ${MAX_ACTIVE_JOB_DESCRIPTION_CHARS.toLocaleString()}-character processing limit; it was not truncated.`,
      });
    }
    if (normalizedJobUrl && jobDescription) {
      await saveActiveJobContext({
        jobKey: activeJobKey(normalizedJobUrl, title, company),
        jobUrl: normalizedJobUrl,
        title,
        company,
        description: jobDescription,
        updatedAt: Date.now(),
      });
    }
    const version = await tailorForJob({
      jobKey: canonicalJobKey(jobUrl, title, company),
      title,
      company,
      jobDescription,
      profile,
      llm: llm.client,
      // Passed through only when the caller measured one. Never defaulted.
      ...(Number.isFinite(rawScore) && body.matchScore !== null && body.matchScore !== ""
        ? { matchScore: rawScore }
        : {}),
    });

    await getStore().set("resumeVersions", upsertResumeVersion(await readVersionMap(), version));

    res.json({
      ok: true,
      data: version,
      // The dashboard modal labels the result with this. `source: "profile"` means
      // no model rewrote anything, so the bullets are the user's own, unchanged.
      isAI: version.source === "llm",
      ...(version.source === "profile" ? { note: describeLLMConfig(llm.config).message } : {}),
    });
  }),
);

/**
 * POST /api/resume/grounded-tailor
 * Grounded Resume Tailoring with Myers token diff and visual green highlighting.
 */
resumeRouter.post(
  "/grounded-tailor",
  asyncRoute(async (req, res) => {
    const body = (req.body ?? {}) as {
      jobTitle?: unknown;
      company?: unknown;
      jobDescription?: unknown;
      jobUrl?: unknown;
      url?: unknown;
    };
    const title = String(body.jobTitle ?? "").trim();
    const company = String(body.company ?? "").trim();
    const jobDescription = String(body.jobDescription ?? "").trim();
    if (!title && !company) {
      return res.status(400).json({ ok: false, error: "jobTitle or company is required." });
    }

    const profile = await readProfile<Profile>();
    if (!profile) {
      return res.status(400).json({
        ok: false,
        error: "No profile saved yet. Upload a résumé first.",
      });
    }

    const llm = await getLLM();
    const jobUrl = String(body.jobUrl ?? body.url ?? "");
    const jobKey = canonicalJobKey(jobUrl, title, company);
    const normalizedJobUrl = jobUrl ? validateJobUrl(jobUrl) : null;
    if (jobUrl && !normalizedJobUrl) {
      return res.status(400).json({ ok: false, error: "jobUrl must be a valid HTTPS job-posting URL." });
    }
    if (jobDescription.length > MAX_ACTIVE_JOB_DESCRIPTION_CHARS) {
      return res.status(413).json({
        ok: false,
        error: `Job description exceeds the ${MAX_ACTIVE_JOB_DESCRIPTION_CHARS.toLocaleString()}-character processing limit; it was not truncated.`,
      });
    }
    if (normalizedJobUrl && jobDescription) {
      await saveActiveJobContext({
        jobKey: activeJobKey(normalizedJobUrl, title, company),
        jobUrl: normalizedJobUrl,
        title,
        company,
        description: jobDescription,
        updatedAt: Date.now(),
      });
    }

    const tailored = await groundedTailorResume({
      jobKey,
      title,
      company,
      jobDescription,
      profile,
      llm: llm.client,
    });

    res.json({
      ok: true,
      data: tailored,
      isAI: tailored.aiUsed,
      ...(!tailored.aiUsed
        ? {
            note: llm.client.isAvailable()
              ? "No valid AI rewrite was produced; the original verified resume content was retained."
              : describeLLMConfig(llm.config).message,
          }
        : {}),
    });
  }),
);
