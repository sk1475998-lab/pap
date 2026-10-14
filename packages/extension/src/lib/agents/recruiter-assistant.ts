/**
 * Operation Zero-Defect: Recruiter/Referral Assistant (Feature #10)
 * Context-aware AI assistant that analyzes a recruiter's profile and a target job,
 * generating personalized outreach messages.
 */
import { diagLog } from "../diagnostics.js";

export interface OutreachContext {
  recruiterName?: string;
  recruiterBio?: string;
  companyName: string;
  jobTitle: string;
  applicantProfile: string;
  platform: 'linkedin' | 'email';
}

function fitInvitationLimit(message: string): string {
  const trimmed = message.trim();
  if (trimmed.length <= 280) return trimmed;
  return `${trimmed.slice(0, 280).replace(/\s+\S*$/, "").trimEnd()}`.slice(0, 280);
}

export async function generateTargetedOutreach(context: OutreachContext) {
  void diagLog("recruiter-assistant", "generate-outreach", { data: { company: context.companyName, platform: context.platform } });

  const prefix = context.recruiterName ? `Hi ${context.recruiterName},` : `Hi there,`;

  try {
    const { getLLM } = await import("../store.js");
    const llm = await getLLM();

    if (llm.isAvailable()) {
      if (context.platform === "linkedin") {
        const prompt = `Write a personalized LinkedIn connection invitation note to a recruiter.
STRICT CONSTRAINT: The note MUST BE UNDER 280 CHARACTERS TOTAL.
Recruiter: ${context.recruiterName || "Hiring Team"}
Company: ${context.companyName}
Role: ${context.jobTitle}
Recruiter Bio: ${context.recruiterBio || "Engineering Recruiting"}
Candidate Background: ${context.applicantProfile ? context.applicantProfile.slice(0, 300) : "Software Engineer"}

Write ONLY the invitation note text. No preamble. No quotation marks. Under 280 characters.`;

        const response = await llm.complete(
          [{ role: "user", content: prompt }],
          { maxTokens: 100, temperature: 0.6 }
        );
        const note = response.trim().replace(/^["']|["']$/g, "");
        if (note.length >= 20 && note.length <= 280) {
          return {
            message: note,
            charCount: note.length,
            success: true,
          };
        }
      } else {
        const prompt = `Write a high-converting, polite cold email to a recruiter or hiring manager.
Recruiter: ${context.recruiterName || "Hiring Manager"}
Company: ${context.companyName}
Role: ${context.jobTitle}
Candidate Background: ${context.applicantProfile}

Include a clear Subject line and 2-3 concise paragraphs. Keep it professional and compelling.`;

        const response = await llm.complete(
          [{ role: "user", content: prompt }],
          { maxTokens: 400, temperature: 0.6 }
        );
        if (response.trim().length > 40) {
          return {
            message: response.trim(),
            success: true,
          };
        }
      }
    }
  } catch (err) {
    console.warn("[recruiter-assistant] LLM outreach generation failed, using structured template:", err);
  }

  // Fallback
  const bioHook = context.recruiterBio ? `I noticed your focus on ${context.recruiterBio.split(' ')[0]} and ` : ``;
  if (context.platform === 'linkedin') {
    const msg = fitInvitationLimit(`${prefix} ${bioHook}I saw the ${context.jobTitle} opening at ${context.companyName}. My background makes me a strong fit and I'd love to connect!`);
    return {
      message: msg,
      charCount: msg.length,
      success: true
    };
  }

  return {
    message: `Subject: Interest in ${context.jobTitle} at ${context.companyName}\n\n${prefix}\n\n${bioHook}I am reaching out regarding the ${context.jobTitle} position. Based on my experience in this domain, I believe I can make an immediate impact at ${context.companyName}.\n\nWould you be open to a brief chat or reviewing my attached resume?\n\nBest regards.`,
    success: true
  };
}
