import type { SidePanelHandle } from "@/lib/side-panel.js";
import type { AutopilotState } from "@/lib/autopilot/autopilot-state.js";
import { analyzeJobDescription, buildResumeVersion, findRecruiters, generateOutreach, scoreMatch, profileToText, type Profile } from "@superjob/core";
import { diagLog } from "@/lib/diagnostics.js";
import { extractJobFromPageAsync, isJobPageUrl } from "@/lib/job-extract.js";
import { isLinkedInJobsUrl } from "@/lib/linkedin.js";
import { jobKey } from "@/lib/app-state.js";
import { saveResumeVersion, getResumeVersion } from "@/lib/resume-version-store.js";
import { getLLM, getProfile } from "@/lib/store.js";
import { scanPage } from "@/lib/autofill.js";
import type { MatchResponse } from "@/lib/messaging.js";

export interface JobIntelligenceDeps {
  state: AutopilotState;
  getPanel: () => SidePanelHandle | null;
  isRuntimeValid: () => boolean;
}

export function createJobIntelligence({ state, getPanel, isRuntimeValid }: JobIntelligenceDeps) {
  async function refreshScore(): Promise<void> {
    if (!isRuntimeValid()) return;
    const panel = getPanel();
    const profile = await getProfile();
    const baseResumeText = profile?.masterResumeText || (profile ? profileToText(profile as Profile) : "");
    if (!baseResumeText) { panel?.setStatus("Add your resume or profile to score"); return; }
    
    let job = await extractJobFromPageAsync();
    if (job.description.length < 80 && isLinkedInJobsUrl()) {
      for (const delay of [800, 1600]) {
        await new Promise((r) => setTimeout(r, delay));
        if (!isRuntimeValid()) return;
        job = await extractJobFromPageAsync();
        if (job.description.length >= 80) break;
      }
    }

    if (job.description.length < 80) {
      panel?.setStatus("Could not read the full job description. Open the selected job details or paste the description in Resume Tailoring.");
      return;
    }
    const key = jobKey(job.url, job.title, job.company);
    const existingVersion = await getResumeVersion(key);
    const resumeText = existingVersion?.tailoredText || baseResumeText;
    const analysis = analyzeJobDescription({ resumeText, jobDescription: job.description, profileSkills: profile?.skills, companyName: job.company });
    state.lastScore = analysis.score;
    panel?.update({ score: analysis.score, matched: analysis.matched.length, total: analysis.matched.length + analysis.missing.length });
    panel?.setJdAnalysis({ matched: analysis.matched, missing: analysis.missing, inferred: analysis.inferred });
    panel?.setTailoredResume(existingVersion?.tailoredText ?? null);
    panel?.setEarlyAdvantage?.(job.earlyAdvantage ?? null);
    panel?.setHiringTeam?.(job.hiringTeam ?? null);
    const outreach = generateOutreach(`${profile?.firstName ?? ""} ${profile?.lastName ?? ""}`.trim() || "Applicant", profile?.skills ?? [], job.title, job.company, job.hiringTeam?.name);
    panel?.setCareerInsights({ visa: analysis.visa, outreach });
    const contacts = findRecruiters(`${profile?.firstName ?? ""} ${profile?.lastName ?? ""}`.trim() || "Applicant", profile?.skills ?? [], job.title, job.company, 4);
    panel?.setRecruiterLinks(contacts.searches.map((s) => ({ roleQuery: s.roleQuery, linkedinSearchUrl: s.linkedinSearchUrl })));
    if (job.description.length >= 80 && profile?.skills) {
      const version = buildResumeVersion(key, job.title, job.company, resumeText, job.description, profile.skills);
      if (existingVersion?.tailoredText) version.tailoredText = existingVersion.tailoredText;
      await saveResumeVersion(version);
    }
  }

  async function runCoverLetterGeneration(): Promise<void> {
    if (!isRuntimeValid()) return;
    const panel = getPanel();
    panel?.setStatus("🤖 Generating role-tailored AI cover letter…");
    const profile = await getProfile();
    if (!profile?.masterResumeText) {
      panel?.setStatus("⚠ Add your resume to your profile first.");
      return;
    }
    const job = await extractJobFromPageAsync();
    if (job.description.length < 80) {
      panel?.setStatus("Could not read enough of the job description to generate a grounded cover letter.");
      return;
    }
    try {
      const llm = await getLLM();
      const { generateCoverLetter } = await import("@superjob/core");
      const coverResult = await generateCoverLetter(
        { title: job.title, company: job.company, description: job.description },
        profile as Profile,
        llm
      );
      const letter = coverResult.text;

      // Copy to clipboard
      if (typeof navigator !== "undefined" && navigator.clipboard) {
        await navigator.clipboard.writeText(letter).catch(() => {});
      }

      // Auto-insert into any open cover letter or pitch textarea on the active page
      const textareas = Array.from(document.querySelectorAll<HTMLElement>("textarea, div[contenteditable='true']"));
      let inserted = false;
      for (const ta of textareas) {
        const label = (ta.getAttribute("aria-label") || ta.getAttribute("placeholder") || ta.getAttribute("name") || ta.id || "").toLowerCase();
        const parentText = (ta.closest("label, .form-group, .fb-dash-form-element, fieldset, [class*='form-field']")?.textContent || "").toLowerCase();
        if (/cover\s*letter|why\s*(?:do\s*you\s*want|work|join|us)|pitch|summary|note\s*to\s*hiring|additional\s*info/i.test(label + " " + parentText)) {
          if (ta instanceof HTMLTextAreaElement) {
            ta.value = letter;
            ta.dispatchEvent(new Event("input", { bubbles: true }));
            ta.dispatchEvent(new Event("change", { bubbles: true }));
          } else {
            ta.textContent = letter;
            ta.dispatchEvent(new Event("input", { bubbles: true }));
          }
          inserted = true;
          break;
        }
      }

      panel?.setStatus(
        inserted
          ? "✓ AI Cover Letter generated, inserted into form & copied to clipboard!"
          : "✓ AI Cover Letter generated & copied to clipboard! (Paste with Ctrl+V)"
      );
    } catch (err) {
      panel?.setStatus(`⚠ Cover letter generation failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  async function runResumeTailoring(): Promise<void> {
    if (!isRuntimeValid()) return;
    const panel = getPanel();
    panel?.setStatus("🤖 Tailoring resume details for this job…");
    const profile = await getProfile();
    if (!profile) { panel?.setStatus("⚠ Complete your profile first."); return; }
    const baseResumeText = profile?.masterResumeText || (profile ? profileToText(profile as Profile) : "");
    if (!baseResumeText) { panel?.setStatus("⚠ Add your resume or profile first."); return; }
    const job = await extractJobFromPageAsync();
    if (job.description.length < 80) {
      panel?.setStatus("Could not read enough of the job description to tailor a resume. Open the full job description and retry.");
      return;
    }
    const key = jobKey(job.url, job.title, job.company);
    const analysis = analyzeJobDescription({ resumeText: baseResumeText, jobDescription: job.description, profileSkills: profile?.skills });
    const missingKeywords = [...new Set([...analysis.missing, ...analysis.atsGaps])].slice(0, 10);
    try {
      const { authenticatedCloudFetch } = await import("@/lib/sync/sync-client.js");
      const response = await authenticatedCloudFetch("/resume/grounded-tailor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jobTitle: job.title,
          company: job.company,
          jobDescription: job.description,
          jobUrl: job.url,
        }),
      });
      const result = await response.json() as {
        ok?: boolean;
        error?: string;
        note?: string;
        isAI?: boolean;
        data?: {
          fullTailoredText?: string;
          tailoredScore?: number;
          suggestedAdditions?: string[];
          addedKeywords?: string[];
        };
      };
      if (!response.ok || !result.ok || !result.data?.fullTailoredText) {
        throw new Error(result.error || `Resume tailoring failed (HTTP ${response.status}).`);
      }
      const tailoredText = result.data.fullTailoredText;
      await saveResumeVersion({
        jobKey: key,
        title: job.title,
        company: job.company,
        score: result.data.tailoredScore ?? analysis.score,
        atsScore: result.data.tailoredScore ?? analysis.atsScore,
        suggestedAdditions: result.data.suggestedAdditions ?? [],
        keywordGaps: result.data.addedKeywords ?? missingKeywords,
        createdAt: Date.now(),
        tailoredText,
      });
      panel?.setTailoredResume(tailoredText);
      panel?.setStatus(result.isAI
        ? "✓ AI-tailored resume ready. Verify each change; original project details are preserved."
        : `✓ Grounded resume draft ready without AI. ${result.note || "Review before use."}`);
      void refreshScore();
    } catch (e) {
      panel?.setStatus(`⚠ Tailoring failed: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  async function getMatchResponse(): Promise<MatchResponse> {
    const profile = await getProfile();
    const job = await extractJobFromPageAsync();
    const baseResumeText = profile?.masterResumeText || (profile ? profileToText(profile as Profile) : "");
    if (!baseResumeText) return { score: 0, matched: [], missing: [], reasons: ["No resume saved."] };
    if (job.description.length < 80) {
      return { score: 0, matched: [], missing: [], reasons: ["Could not read enough of the job description to calculate a meaningful match."] };
    }
    if (!isJobPageUrl(location.href) && !scanPage().fields.length) return { score: 0, matched: [], missing: [], reasons: [] };
    const m = scoreMatch({ resumeText: baseResumeText, jobDescription: job.description, profileSkills: profile?.skills });
    return { score: m.score, matched: m.matched, missing: m.missing, reasons: m.reasons };
  }

  return { refreshScore, runCoverLetterGeneration, runResumeTailoring, getMatchResponse };
}
