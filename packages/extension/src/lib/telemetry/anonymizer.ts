/**
 * Operation Zero-Defect: Privacy-Preserving Telemetry (Feature #4)
 * PII Stripping utility before data leaves the machine.
 */

const PII_PATTERNS = [
  { regex: /\b[\w\.-]+@[\w\.-]+\.\w{2,4}\b/g, replacement: "[EMAIL]" },
  { regex: /\b(?:\+?1[-.\s]?)?\(?[2-9]\d{2}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g, replacement: "[PHONE]" },
  { regex: /\b\d{3}-\d{2}-\d{4}\b/g, replacement: "[SSN]" } // US SSN pattern
];

export function stripPII(data: any): any {
  if (typeof data === 'string') {
    let scrubbed = data;
    for (const { regex, replacement } of PII_PATTERNS) {
      scrubbed = scrubbed.replace(regex, replacement);
    }
    return scrubbed;
  }
  
  if (Array.isArray(data)) {
    return data.map(stripPII);
  }
  
  if (data !== null && typeof data === 'object') {
    const scrubbedObj: any = {};
    for (const [key, value] of Object.entries(data)) {
      if (['firstName', 'lastName', 'password', 'token', 'secret'].includes(key)) {
        scrubbedObj[key] = "[REDACTED]";
      } else {
        scrubbedObj[key] = stripPII(value);
      }
    }
    return scrubbedObj;
  }
  
  return data;
}
