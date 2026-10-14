/**
 * Operation Zero-Defect: Resume and Cover-Letter Co-pilot (Feature #9)
 * Generates context-aware, tailored job application materials.
 */
import { diagLog } from "../diagnostics.js";

export interface CopilotRequest {
  jobContext: string;
  profileData: string;
  tone?: 'professional' | 'creative' | 'direct';
}

export async function generateCoverLetter(req: CopilotRequest) {
  void diagLog("autopilot", "generate-cover-letter", { data: { tone: req.tone } });

  try {
    const { getLLM } = await import("../store.js");
    const llm = await getLLM();

    if (llm.isAvailable()) {
      const prompt = `You are an expert executive career coach. Write a tailored, compelling cover letter for the following job and candidate profile.

TONE: ${req.tone || "professional"}

TARGET JOB DETAILS:
${req.jobContext}

CANDIDATE PROFILE:
${req.profileData}

INSTRUCTIONS:
1. Highlight candidate's exact stack alignment, problem-solving domain, and quantifiable achievements.
2. Address the hiring manager professionally.
3. Keep it punchy (3 to 4 concise paragraphs).
4. Do not invent fake degrees or employers. Return only the finished cover letter text.`;

      const response = await llm.complete(
        [{ role: "user", content: prompt }],
        { temperature: 0.7, maxTokens: 800 }
      );
      if (response && response.trim().length > 40) {
        return {
          coverLetter: response.trim(),
          success: true,
        };
      }
    }
  } catch (err) {
    console.warn("[copilot-agent] LLM cover letter generation failed:", err);
  }

  return {
    coverLetter: "",
    success: false,
    error: "Cover letter generation is unavailable. Configure an AI provider and try again.",
  };
}

export async function tailorResume(req: CopilotRequest) {
  void diagLog("autopilot", "tailor-resume");

  try {
    const { getLLM } = await import("../store.js");
    const llm = await getLLM();

    if (llm.isAvailable()) {
      const prompt = `You are a principal ATS resume optimization specialist. Analyze this candidate profile against the target job posting.

TARGET JOB:
${req.jobContext}

CANDIDATE PROFILE:
${req.profileData}

Return a valid JSON object with this exact structure:
{
  "tailoredSummary": "A high-impact 2-3 sentence executive summary tailored directly to this role.",
  "skillsToHighlight": ["Skill1", "Skill2", "Skill3", "Skill4", "Skill5"]
}`;

      const response = await llm.complete(
        [{ role: "user", content: prompt }],
        { responseFormat: { type: "json_object" }, temperature: 0.3 }
      );
      const parsed = JSON.parse(response);
      if (parsed.tailoredSummary && Array.isArray(parsed.skillsToHighlight)) {
        return {
          tailoredSummary: parsed.tailoredSummary,
          skillsToHighlight: parsed.skillsToHighlight,
          success: true,
        };
      }
    }
  } catch (err) {
    console.warn("[copilot-agent] LLM resume tailoring failed:", err);
  }

  return {
    tailoredSummary: "",
    skillsToHighlight: [],
    success: false,
    error: "Resume tailoring is unavailable. Configure an AI provider and try again.",
  };
}
