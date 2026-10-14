/**
 * Least-privilege runtime permission policy for Super Job Agent.
 *
 * The extension intentionally keeps the always-on surface narrow. Heavy content
 * modules may be injected only on known job/application surfaces or on a page the
 * user explicitly activated via activeTab/context menu. This file is shared by
 * background/content entrypoints so host decisions are auditable in one place.
 */

export const JOB_HOST_MATCHES = [
  "*://*.linkedin.com/*",
  "*://linkedin.com/*",
  "*://*.keka.com/*",
  "*://keka.com/*",
  "*://*.greenhouse.io/*",
  "*://greenhouse.io/*",
  "*://*.lever.co/*",
  "*://lever.co/*",
  "*://*.ashbyhq.com/*",
  "*://ashbyhq.com/*",
  "*://*.myworkdayjobs.com/*",
  "*://myworkdayjobs.com/*",
  "*://*.workdayjobs.com/*",
  "*://workdayjobs.com/*",
  "*://*.myworkdaysite.com/*",
  "*://myworkdaysite.com/*",
  "*://*.myworkday.com/*",
  "*://myworkday.com/*",
  "*://*.workday.com/*",
  "*://workday.com/*",
  "*://*.wday.com/*",
  "*://*.icims.com/*",
  "*://*.icims.net/*",
  "*://icims.com/*",
  "*://*.smartrecruiters.com/*",
  "*://smartrecruiters.com/*",
  "*://*.workable.com/*",
  "*://workable.com/*",
  "*://*.jobvite.com/*",
  "*://jobvite.com/*",
  "*://*.bamboohr.com/*",
  "*://bamboohr.com/*",
  "*://*.taleo.net/*",
  "*://taleo.net/*",
  "*://*.successfactors.com/*",
  "*://successfactors.com/*",
  "*://*.successfactors.eu/*",
  "*://*.sap.com/*",
  "*://*.phenompeople.com/*",
  "*://phenompeople.com/*",
  "*://*.oraclecloud.com/*",
  "*://oraclecloud.com/*",
  "*://*.eightfold.ai/*",
  "*://eightfold.ai/*",
  "*://*.recruitee.com/*",
  "*://recruitee.com/*",
  "*://*.teamtailor.com/*",
  "*://teamtailor.com/*",
  "*://*.jobylon.com/*",
  "*://jobylon.com/*",
  "*://*.breezy.hr/*",
  "*://breezy.hr/*",
  "*://*.jazzhr.com/*",
  "*://jazzhr.com/*",
  "*://*.naukri.com/*",
  "*://naukri.com/*",
  "*://*.indeed.com/*",
  "*://indeed.com/*",
  "*://*.glassdoor.com/*",
  "*://glassdoor.com/*",
  "*://*.monster.com/*",
  "*://monster.com/*",
  "*://*.foundit.in/*",
  "*://foundit.in/*",
  "*://*.wellfound.com/*",
  "*://wellfound.com/*",
  "*://*.instahyre.com/*",
  "*://instahyre.com/*",
  "*://*.cutshort.io/*",
  "*://cutshort.io/*",
  "*://*.amazon.jobs/*",
  "*://amazon.jobs/*",
  "*://*.metacareers.com/*",
  "*://metacareers.com/*",
  "*://*.brassring.com/*",
  "*://brassring.com/*",
  "*://*.kenexa.com/*",
  "*://*.hirevue.com/*",
  "*://*.jobadder.com/*",
  "*://*.jobsoid.com/*",
  "*://*.freshteam.com/*",
  "*://*.recruiterbox.com/*",
  "*://*.ultipro.com/*",
  "*://*.dayforcehcm.com/*",
  "*://*.ceridiandayforce.com/*",
  "*://*.avature.net/*",
  "*://*.newtonsoftware.net/*",
  "*://*.tbe.taleo.net/*",
  "*://*.applytojob.com/*",
  "*://*.jobapscloud.com/*",
  "*://*.ceipal.com/*",
  "*://*.jobdiva.com/*",
  "*://*.manatal.com/*",
  "*://*.isolvedhcm.com/*",
  "*://*.harri.com/*",
  "*://*.pinpointhq.com/*",
  "*://*.zoho.com/*",
  "*://*.zohorecruit.com/*",
  "*://*.ziprecruiter.com/*",
  "*://*.hirect.in/*",
  "*://*.apna.co/*",
  "*://*.shine.com/*",
  "*://*.timesjobs.com/*",
  "*://*.freshersworld.com/*",
  "*://*.iimjobs.com/*",
  "*://*.hirist.com/*",
  "*://*.accenture.com/*",
  "*://accenture.com/*",
  "*://*.mycareer.accenture.com/*",
  "*://mycareer.accenture.com/*",
  "*://*.tcs.com/*",
  "*://*.infosys.com/*",
  "*://*.wipro.com/*",
  "*://*.cognizant.com/*",
  "*://*.deloitte.com/*",
  "*://*.capgemini.com/*",
] as const;

const JOB_HOST_SUFFIXES = [
  "linkedin.com",
  "keka.com",
  "greenhouse.io",
  "lever.co",
  "ashbyhq.com",
  "myworkdayjobs.com",
  "workdayjobs.com",
  "myworkdaysite.com",
  "myworkday.com",
  "workday.com",
  "wday.com",
  "icims.com",
  "icims.net",
  "smartrecruiters.com",
  "workable.com",
  "jobvite.com",
  "bamboohr.com",
  "taleo.net",
  "successfactors.com",
  "successfactors.eu",
  "sap.com",
  "phenompeople.com",
  "oraclecloud.com",
  "eightfold.ai",
  "recruitee.com",
  "teamtailor.com",
  "jobylon.com",
  "breezy.hr",
  "jazzhr.com",
  "naukri.com",
  "indeed.com",
  "glassdoor.com",
  "monster.com",
  "foundit.in",
  "wellfound.com",
  "instahyre.com",
  "cutshort.io",
  "amazon.jobs",
  "metacareers.com",
  "brassring.com",
  "kenexa.com",
  "hirevue.com",
  "avature.net",
  "ultipro.com",
  "dayforcehcm.com",
  "ceridiandayforce.com",
  "freshteam.com",
  "jobadder.com",
  "jobsoid.com",
  "ceipal.com",
  "jobdiva.com",
  "harri.com",
  "manatal.com",
  "isolvedhcm.com",
  "ziprecruiter.com",
  "zoho.com",
  "zohorecruit.com",
  "hirect.in",
  "apna.co",
  "shine.com",
  "timesjobs.com",
  "freshersworld.com",
  "iimjobs.com",
  "hirist.com",
  "accenture.com",
  "mycareer.accenture.com",
  "tcs.com",
  "infosys.com",
  "wipro.com",
  "cognizant.com",
  "deloitte.com",
  "capgemini.com",
] as const;

const JOB_PATH_RE = /\b(apply|application|career|careers|job|jobs|recruit|recruiting|position|opening|workday|greenhouse|lever|ashby|icims)\b/i;
const EXCLUDED_HOST_RE = /(^|\.)(googleusercontent\.com|googletagmanager\.com|doubleclick\.net|cloudflare\.com|recaptcha\.net|gstatic\.com)$/i;

export interface InjectionPolicyDecision {
  allowed: boolean;
  reason: string;
  requiresOptionalHostPermission: boolean;
}

export function normalizeHostname(hostname: string): string {
  return hostname.trim().toLowerCase().replace(/^www\./, "");
}

export function isKnownJobHost(hostname: string): boolean {
  const host = normalizeHostname(hostname);
  if (EXCLUDED_HOST_RE.test(host)) return false;
  return JOB_HOST_SUFFIXES.some((suffix) => host === suffix || host.endsWith(`.${suffix}`));
}

export function isProbablyJobUrl(rawUrl: string): boolean {
  try {
    const url = new URL(rawUrl);
    if (!/^https?:$/.test(url.protocol)) return false;
    if (isKnownJobHost(url.hostname)) return true;
    return JOB_PATH_RE.test(`${url.hostname}${url.pathname}${url.search}`);
  } catch {
    return false;
  }
}

export function decideInjectionForUrl(rawUrl?: string | null): InjectionPolicyDecision {
  if (!rawUrl) {
    return { allowed: false, reason: "missing-url", requiresOptionalHostPermission: false };
  }
  try {
    const url = new URL(rawUrl);
    // Allow the extension's own demo sandbox page (bootstrap via direct <script> tag,
    // not executeScript — handled specially by the INJECT_ORCHESTRATOR handler).
    if (/^chrome-extension:|^moz-extension:|^extension:/.test(url.protocol)) {
      if (/demo-job\.html/i.test(url.pathname)) {
        return { allowed: true, reason: "extension-demo-page", requiresOptionalHostPermission: false };
      }
      return { allowed: false, reason: "unsupported-protocol", requiresOptionalHostPermission: false };
    }
    if (!/^https?:$/.test(url.protocol)) {
      return { allowed: false, reason: "unsupported-protocol", requiresOptionalHostPermission: false };
    }
    if (EXCLUDED_HOST_RE.test(normalizeHostname(url.hostname))) {
      return { allowed: false, reason: "excluded-host", requiresOptionalHostPermission: false };
    }
    const host = normalizeHostname(url.hostname);
    if (host === "linkedin.com" || host.endsWith(".linkedin.com")) {
      const isJobUrl = /linkedin\.com\/jobs|linkedin\.com\/job\b/i.test(rawUrl);
      if (!isJobUrl) {
        return { allowed: false, reason: "linkedin-non-job-page", requiresOptionalHostPermission: false };
      }
    }
    if (isKnownJobHost(url.hostname)) {
      return { allowed: true, reason: "known-job-host", requiresOptionalHostPermission: false };
    }
    if (JOB_PATH_RE.test(`${url.hostname}${url.pathname}${url.search}`)) {
      return { allowed: true, reason: "job-url-heuristic", requiresOptionalHostPermission: true };
    }
    return { allowed: false, reason: "not-job-context", requiresOptionalHostPermission: false };
  } catch {
    return { allowed: false, reason: "invalid-url", requiresOptionalHostPermission: false };
  }
}

export function canInjectOrchestrator(
  frameUrl: string | undefined,
  tabUrl: string | undefined,
  reason: string
): boolean {
  if (!frameUrl || !tabUrl) return false;

  let frame: URL;
  let tab: URL;
  try {
    frame = new URL(frameUrl);
    tab = new URL(tabUrl);
  } catch {
    return false;
  }
  if (!/^https?:$/.test(frame.protocol) || !/^https?:$/.test(tab.protocol)) return false;

  const frameDecision = decideInjectionForUrl(frameUrl);
  const tabDecision = decideInjectionForUrl(tabUrl);
  if (
    frameDecision.reason === "excluded-host" ||
    tabDecision.reason === "excluded-host"
  ) {
    return false;
  }

  if (reason === "manual") return true;
  if (
    frameDecision.reason === "linkedin-non-job-page" ||
    tabDecision.reason === "linkedin-non-job-page"
  ) {
    return false;
  }

  if (frameDecision.allowed || tabDecision.allowed) return true;
  return reason === "form-heuristic";
}

export function originPatternForUrl(rawUrl: string): string | null {
  try {
    const url = new URL(rawUrl);
    if (!/^https?:$/.test(url.protocol)) return null;
    return `${url.protocol}//${url.hostname}/*`;
  } catch {
    return null;
  }
}
