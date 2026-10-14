/**
 * Provider-specific job-key extractors. Add a new extractor here (or register
 * one at runtime) without changing the generic canonical-key fallback logic.
 */
export interface JobKeyExtractor {
  id: string;
  extract(url: string): string | null;
}

function firstMatch(url: string, ...patterns: RegExp[]): string | null {
  for (const pattern of patterns) {
    const match = url.match(pattern)?.[1];
    if (match) return match;
  }
  return null;
}

export const JOB_KEY_EXTRACTORS: readonly JobKeyExtractor[] = [
  { id: "linkedin", extract: (url) => firstMatch(url, /jobs\/(?:view|collections\/\w+\/)\/?(\d+)/, /currentJobId=(\d+)/i, /jobId=(\d+)/i) },
  { id: "greenhouse", extract: (url) => firstMatch(url, /greenhouse\.io\/[^/]+\/jobs\/(\d+)/) },
  { id: "lever", extract: (url) => firstMatch(url, /lever\.co\/[^/]+\/([a-f0-9-]{36})/) },
  { id: "ashby", extract: (url) => firstMatch(url, /ashbyhq\.com\/[^/]+\/([a-f0-9-]{36})/) },
  { id: "workday", extract: (url) => firstMatch(url, /\/job\/[^/]+\/((?:JR|R|WD|REQ)-?\d+)/i, /jobPostingId=([A-Z0-9-]+)/i) },
  { id: "smartrecruiters", extract: (url) => firstMatch(url, /smartrecruiters\.com\/[^/]+\/([a-f0-9-]{36})/) },
  { id: "icims", extract: (url) => firstMatch(url, /icims\.com\/jobs\/(\d+)/) },
  { id: "taleo", extract: (url) => firstMatch(url, /[?&]job=([A-Z0-9-]+)/i) },
  { id: "wellfound", extract: (url) => firstMatch(url, /wellfound\.com\/[^/]+\/([a-f0-9-]+)/) },
  { id: "yc", extract: (url) => firstMatch(url, /workatastartup\.com\/jobs\/(\d+)/) },
  { id: "jobvite", extract: (url) => firstMatch(url, /jobvite\.com\/[^/]+\/job\/([A-Za-z0-9]+)/) },
  { id: "bamboohr", extract: (url) => firstMatch(url, /bamboohr\.com\/[^/]*\/careers\/(\d+)/) },
];

export function extractProviderJobKey(url: string, extractors: readonly JobKeyExtractor[] = JOB_KEY_EXTRACTORS): string | null {
  for (const extractor of extractors) {
    const key = extractor.extract(url);
    if (key) return `${extractor.id}:${key}`;
  }
  return null;
}
