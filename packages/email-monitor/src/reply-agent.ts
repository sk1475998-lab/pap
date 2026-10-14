import type { LLMClient } from "@superjob/core";

export interface DraftedReply {
  toEmail: string;
  subject: string;
  body: string;
  sendAfter: Date;
}

export interface UserSchedulePreferences {
  userName: string;
  weeklyAvailability: string; // e.g. "Tuesdays & Thursdays, 2 PM - 5 PM IST"
  timezone: string;           // e.g. "IST"
}

export class ReplyAgent {
  private llm: LLMClient;

  constructor(llm: LLMClient) {
    this.llm = llm;
  }

  /**
   * Drafts a professional reply confirming interview availability.
   */
  async draftInterviewReply(
    recruiterEmailText: string,
    recruiterName: string,
    recruiterEmailAddress: string,
    originalSubject: string,
    prefs: UserSchedulePreferences
  ): Promise<DraftedReply> {
    const systemPrompt = `You compose brief, warm, professional email responses to recruiter interview invites.
Write under 80 words. Adopt a natural, professional tone.
Propose interview availability using ONLY the candidate's preferred times.
Return ONLY the email body text, no subject line, greetings or footers.`;

    const userPrompt = `Recruiter Email:
"${recruiterEmailText}"

Candidate Info & Preferred Availability:
- Name: ${prefs.userName}
- Availability: ${prefs.weeklyAvailability}
- Timezone: ${prefs.timezone}

Compose a reply for ${recruiterName || "the recruiter"} to schedule the interview.`;

    let body = `Dear ${recruiterName || "Hiring Team"},\n\nThank you for reaching out. I would be glad to connect for an interview. I am generally available on ${prefs.weeklyAvailability} (${prefs.timezone}). Please let me know what slot works best for you.\n\nBest regards,\n${prefs.userName}`;

    if (this.llm.isAvailable()) {
      try {
        const generated = await this.llm.complete([
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ], { temperature: 0.3, maxTokens: 150 });
        if (generated.trim()) {
          body = generated.trim();
        }
      } catch (err) {
        console.error("Drafting response failed. Using default template:", err);
      }
    }

    // Delay outgoing response by 5-20 minutes to look natural
    const delayMs = (5 + Math.floor(Math.random() * 15)) * 60 * 1000;
    const sendAfter = new Date(Date.now() + delayMs);

    return {
      toEmail: recruiterEmailAddress,
      subject: originalSubject.toLowerCase().startsWith("re:") ? originalSubject : `Re: ${originalSubject}`,
      body,
      sendAfter,
    };
  }
}
