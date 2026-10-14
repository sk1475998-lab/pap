/**
 * Cold outreach and referral request template generator.
 */
export interface OutreachTemplate {
  linkedin: string;
  email: string;
  followUp?: string;
  recruiterName?: string;
}

export function generateOutreach(
  profileName: string = "",
  skills: string[] = [],
  jobTitle: string = "",
  company: string = "",
  recruiterName?: string
): OutreachTemplate {
  const safeSkills = Array.isArray(skills) ? skills : [];
  const topSkills = safeSkills.slice(0, 3).join(", ");
  const cleanRecruiterName = recruiterName?.trim();
  const greeting = cleanRecruiterName ? `Hi ${cleanRecruiterName}` : "Hi [Name]";
  const formalGreeting = cleanRecruiterName ? `Dear ${cleanRecruiterName}` : "Dear [Name]";

  const skillsSentence = topSkills ? ` Skills: ${topSkills}.` : "";
  const linkedin = `${greeting}, I'm interested in the ${jobTitle} role at ${company}.${skillsSentence} Could we connect? - ${profileName}`.slice(0, 200);

  const email = `Subject: Referral Request / Role Inquiry: ${jobTitle} - ${profileName}

${formalGreeting},

I hope this message finds you well.

I am interested in the ${jobTitle} opening at ${company}.${skillsSentence}

I am reaching out to ask whether you would be open to sharing any information about the role or its application process.

I would be happy to share my resume if helpful. Thank you for your time and consideration.

Best regards,
${profileName}`;

  const followUp = `${greeting}, following up on my application for the ${jobTitle} role at ${company}. I remain interested in the opportunity. - ${profileName}`.slice(0, 300);

  return { linkedin, email, followUp, recruiterName: cleanRecruiterName };
}
