export type QuestionCategory =
  | 'motivation_company'    // "Why do you want to work here?"
  | 'motivation_role'       // "Why this role?"
  | 'behavioural_lead'      // "Tell me about a time you led..."
  | 'behavioural_challenge' // "Describe a difficult situation..."
  | 'behavioural_conflict'  // "How do you handle disagreement?"
  | 'availability'          // "When can you start?" / "Notice period?"
  | 'salary_ctc'            // "Expected CTC?" / "Current salary?"
  | 'relocation'            // "Are you willing to relocate?"
  | 'remote_hybrid'         // "Open to hybrid work?"
  | 'experience_specific'   // "How many years of React experience?"
  | 'portfolio_link'        // "Share your GitHub / portfolio"
  | 'cover_letter'          // A dedicated cover letter textarea
  | 'reference'             // "Provide a professional reference"
  | 'unknown';

const QUESTION_PATTERNS: Record<Exclude<QuestionCategory, 'unknown'>, RegExp[]> = {
  motivation_company: [
    /why.*(?:company|organisation|organization|us|join|interested in us)/i,
    /what.*attract.*(?:to us|this company)/i,
    /why.*want.*work.*(?:here|us|this)/i,
  ],
  motivation_role: [
    /why.*this role/i,
    /why.*position/i,
    /what.*interest.*(?:in this|this role)/i,
  ],
  behavioural_lead: [
    /tell.*(?:time|example).*lead/i,
    /describe.*leadership/i,
    /example.*(?:leading|managed)/i,
  ],
  behavioural_challenge: [
    /(?:difficult|challenging|hard).*situation/i,
    /obstacle.*overcome/i,
    /tell.*time.*(?:failed|struggled|challenge)/i,
  ],
  behavioural_conflict: [
    /conflict.*(?:colleague|team|manager)/i,
    /disagree.*(?:with|team)/i,
    /handle.*conflict/i,
  ],
  availability: [
    /(?:notice period|notice)/i,
    /when.*(?:start|join|available)/i,
    /earliest.*joining/i,
    /availability/i,
  ],
  salary_ctc: [
    /(?:expected|current|desired|present|last\s*drawn).*(?:ctc|salary|compensation|package|lpa)/i,
    /(?:ctc|salary|lpa).*(?:expected|current|present|desired|last\s*drawn)/i,
    /how much.*expect/i,
  ],
  relocation: [
    /willing.*reloc/i,
    /open.*reloc/i,
    /relocat/i,
  ],
  remote_hybrid: [
    /(?:remote|hybrid|work from home|wfh)/i,
    /office.*flexible/i,
  ],
  experience_specific: [
    /how many years.*(?:of experience|experience with)/i,
    /years.*(?:using|working with|of)/i,
  ],
  portfolio_link: [
    /(?:github|portfolio|website|work sample|dribbble|behance)/i,
    /link.*(?:your|to)/i,
    /share.*(?:work|sample|portfolio)/i,
  ],
  cover_letter: [
    /cover letter/i,
    /tell us about yourself/i,
    /introduce yourself/i,
  ],
  reference: [
    /reference/i,
    /referral/i,
  ],
};

export function classifyQuestion(label: string, placeholder?: string): QuestionCategory {
  const text = `${label} ${placeholder || ''}`.trim();

  for (const [category, patterns] of Object.entries(QUESTION_PATTERNS)) {
    for (const pattern of patterns) {
      if (pattern.test(text)) return category as QuestionCategory;
    }
  }
  return 'unknown';
}
