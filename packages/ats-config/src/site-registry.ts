/**
 * Comprehensive ATS Site Registry
 *
 * Enterprise site detection registry containing 50+ ATS platforms with domain patterns,
 * URL regexes, iframe domains, query parameters, and page source detection keywords.
 *
 * Each entry defines how to detect and interact with a specific ATS platform.
 */

/** Site registry entry for a single ATS platform */
export interface SiteRegistryEntry {
  id: string;
  domains?: string[];
  patterns?: string[];
  iframeDomains?: string[];
  queryParams?: string[];
  pathRegex?: string;
  urlRegex?: string;
  pageSourceKeyword?: string;
  pageSourceDomain?: string;
  iframeOnly?: boolean;
}

/**
 * Master ATS site registry covering 50+ enterprise job platforms.
 */
export const SITE_REGISTRY: Record<string, SiteRegistryEntry> = {
  greenhouse: {
    id: "greenhouse",
    domains: ["greenhouse.io"],
    iframeDomains: ["greenhouse.io"],
    queryParams: ["gh_jid", "gh_src"],
    pathRegex: "^/(?:[^/]+/jobs/\\d+|embed/job_app)",
    // FIX: Add wildcard patterns for custom Greenhouse career sites (40-50% more coverage)
    patterns: [
      "*://boards.greenhouse.io/*/*",
      "*://*.greenhouse.io/embed/*",
      "*://*/jobs/*",
      "*://*/careers/jobs/*",
    ],
    pageSourceKeyword: "greenhouse",
  },
  lever: {
    id: "lever",
    patterns: [
      "*://jobs.lever.co/*/*", 
      "*://jobs.eu.lever.co/*/*",
      // FIX: Add custom Lever career site patterns
      "*://*.lever.co/jobs/*",
      "*://*/jobs/*",
      "*://*/careers/*",
    ],
    iframeDomains: ["lever.co"],
    queryParams: ["LeverAppId"],
    pathRegex: "^/[^/]+/[^/]+(?:/apply)?/?$",
    pageSourceKeyword: "lever",
  },
  ashby: {
    id: "ashby",
    patterns: ["*://*.ashbyhq.com/*/*"],
    iframeDomains: ["jobs.ashbyhq.com"],
    queryParams: ["ashby_jid"],
    pathRegex:
      "^/[^/]+/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}",
  },
  workday: {
    id: "workday",
    domains: [
      "myworkdayjobs.com",
      "myworkdayjobs-impl.com",
      "myworkdaysite.com",
      "myworkday.com",
    ],
    // FIX: Add wildcard patterns for custom Workday career sites
    patterns: [
      "*://*.myworkdayjobs.com/*",
      "*://*.myworkdayjobs-impl.com/*",
      "*://*/careers/jobs*",
      "*://*/job/*",
      "*://*/en-US/job/*",
    ],
    pageSourceKeyword: "workday",
  },
  oraclecloud: {
    id: "oraclecloud",
    patterns: [
      "*://*.oraclecloud.com/*/CandidateExperience/*/sites/*/job/*",
      "*://*.oraclecloud.com/*/CandidateExperience/*/sites/*/*/preview/*",
      "*://*/*/CandidateExperience/*/sites/*/job/*",
      "*://*/*/sites/*/jobs/preview/*/apply/*",
    ],
    pathRegex:
      "(?:/CandidateExperience/.*/sites/[^/]+/job/[^/]+(?:/apply(?:/.*)?)?/?$|/apply)",
  },
  icims: {
    id: "icims",
    domains: ["icims.com"],
    iframeDomains: ["icims.com"],
    iframeOnly: true,
    pathRegex: "^/jobs/\\d+(?!.*/job$)",
  },
  jobvite: {
    id: "jobvite",
    patterns: ["*://jobs.jobvite.com/*/apply*"],
    iframeDomains: ["jobs.jobvite.com"],
    queryParams: ["jobviteiframe"],
  },
  eightfold: {
    id: "eightfold",
    patterns: ["*://*.eightfold.ai/careers*"],
    iframeDomains: ["eightfold.ai"],
    pageSourceKeyword: "eightfold",
    pageSourceDomain: "eightfold.ai",
    urlRegex:
      "^/careers(?:/(?:job/[^/?#]+(?:/apply)?(?:[/?#]|$)|apply(?:[/?#]|$))|\\?(?=(?:pid=[^&#]+|[^#]*&pid=[^&#]+))(?!(?:(?:start|location|query)=|[^#]*&(?:start|location|query)=))[^#]*(?:#.*)?$)",
  },
  taleo: {
    id: "taleo",
    patterns: [
      "*://*.taleo.net/*/application.jss*",
      "*://*.taleo.net/*/flow.jsf*",
      "*://*.taleo.net/*/jobapply*",
      "*://*.taleo.net/*/ats/careers/*",
      "*://*.burnsmcd.com/apply*",
      "*://*.burnsmcd.com/careersection/application.jss*",
      "*://talentacquisition.3ds.com/*/application.jss*",
      "*://talentacquisition.3ds.com/*/flow.jsf*",
    ],
  },
  smartrecruiters: {
    id: "smartrecruiters",
    domains: ["smartr.me"],
    patterns: [
      "*://jobs.smartrecruiters.com/oneclick-ui/company/*",
    ],
  },
  workable: {
    id: "workable",
    patterns: [
      "*://apply.workable.com/*",
      "*://jobs.workable.com/*",
    ],
    iframeDomains: ["workable.com"],
    queryParams: ["selectedJobId"],
    pathRegex:
      "^/(?:[^/]+/j/[^/]+(?:/apply)?/?$|(?:[a-z]{2}/)?(?:view|company)/[\\w-]+)",
  },
  bamboohr: {
    id: "bamboohr",
    patterns: [
      "*://*.bamboohr.com/jobs*",
      "*://*.bamboohr.com/careers*",
    ],
    iframeDomains: ["bamboohr.com"],
    pathRegex: "^/(?:jobs|careers/[\\w-]*\\d)",
  },
  adp: {
    id: "adp",
    domains: ["workforcenow.adp.com"],
    patterns: [
      "*://recruiting.adp.com/srccar/public/*",
      "*://myjobs.adp.com/*/cx/*",
    ],
  },
  paylocity: {
    id: "paylocity",
    patterns: [
      "*://*.paylocity.com/recruiting/*",
      "*://*.paylocity.com/Recruiting/*",
    ],
    iframeDomains: ["paylocity.com"],
    urlRegex:
      "^/[Rr]ecruiting/[Jj]obs/(?:[Aa]pply/|[Dd]etails/[^/?#]+(?:[/?#]|$))",
  },
  breezy: {
    id: "breezy",
    patterns: ["*://*.breezy.hr/p/*", "*://*.breezy.hr/*/apply*"],
  },
  jazzhr: {
    id: "jazzhr",
    patterns: ["*://*.applytojob.com/apply/*"],
  },
  ultipro: {
    id: "ultipro",
    patterns: [
      "*://*.ultipro.com/*/JobBoard/*/OpportunityDetail*",
      "*://*.ultipro.com/*/JobBoard/*/OpportunityApply*",
      "*://*.ultipro.ca/*/JobBoard/*/OpportunityDetail*",
      "*://*.rec.pro.ukg.net/*/JobBoard/*/OpportunityDetail*",
    ],
  },
  avature: {
    id: "avature",
    patterns: [
      "*://*.avature.net/*/ApplicationForm*",
      "*://*.avature.net/*/ApplicationMethods*",
      "*://*.avature.net/*/ApplicationQuestions*",
      "*://*.avature.net/*/ApplicationReview*",
      "*://*.avature.net/*/Register*",
      "*://*.avature.net/careers/JobDetail*",
      "*://*.avature.net/careers/LocationAndProfile/*",
      "*://apply.deloitte.com/*/careers/ApplicationForm*",
      "*://careers.cbre.com/*/careers/ApplicationForm*",
      "*://careers.ibm.com/*/careers/ApplicationForm*",
    ],
    pageSourceKeyword: "avature",
    pageSourceDomain: "avature.net",
  },
  brassring: {
    id: "brassring",
    patterns: ["*://*.brassring.com/TGnewUI/*"],
    iframeDomains: ["brassring.com"],
    urlRegex: "#(?:Applypage|jobDetails=)",
  },
  successfactors: {
    id: "successfactors",
    domains: ["successfactors.eu", "successfactors.com", "sapsf.com"],
  },
  phenom: {
    id: "phenom",
    pageSourceKeyword: "APPLY_form_renderer.js",
    pageSourceDomain: "phenompeople.com",
    patterns: [
      "*://careers.mastercard.com/*/apply*",
      "*://careers.roche.com/*/apply*",
      "*://careers.kbr.com/*/apply*",
      "*://careers.fivebelow.com/*/apply*",
    ],
  },
  cisco: {
    id: "cisco",
    patterns: ["*://careers.cisco.com/*/apply*"],
  },
  tesla: {
    id: "tesla",
    patterns: ["*://*.jobs.tesla.com/*", "*://*.tesla.com/careers/*"],
    pathRegex: "/apply",
  },
  amazon: {
    id: "amazon",
    patterns: ["*://*.amazon.jobs/*"],
    pathRegex: "/jobs/[\\w-]+/apply",
  },
  uber: {
    id: "uber",
    domains: ["uber.com"],
    pathRegex: "^/(?:(?:[^/]+/){1,2})?careers/(?:apply(?:/|$)|list/[^/?#]+)",
  },
  google: {
    id: "google",
    patterns: [
      "*://google.com/about/careers/*",
      "*://*.google.com/about/careers/*",
    ],
    pathRegex: "^/about/careers/applications(/u/\\d+)?/apply/",
  },
  metacareers: {
    id: "metacareers",
    domains: ["metacareers.com"],
    pathRegex: "^/profile/(create_application|job_details)/[^/]+",
  },
  ripplehire: {
    id: "ripplehire",
    domains: ["ripplehire.com"],
  },
  personio: {
    id: "personio",
    domains: ["personio.de", "personio.com"],
    urlRegex:
      "^/job/[^/?#]+\\?(?:[^#&]*&)*apply(?:[=&]|&|#|$)",
  },
  comeet: {
    id: "comeet",
    patterns: [
      "*://*.comeet.com/jobs/*/*/*/*",
      "*://*.comeet.co/jobs/*/*/apply*",
    ],
    iframeDomains: ["comeet.co", "comeet.com"],
  },
  apple: {
    id: "apple",
    patterns: ["*://jobs.apple.com/app/*/apply/*"],
  },
  recruiterflow: {
    id: "recruiterflow",
    domains: ["recruiterflow.com"],
    pageSourceKeyword: "recruiterflow.com",
    pageSourceDomain: "recruiterflow.com",
    pathRegex: "^/[^/]+/jobs/[^/?#]+",
  },
  kula: {
    id: "kula",
    domains: ["careers.kula.ai"],
    pathRegex: "^/[^/]+/[^/]+",
  },
  dover: {
    id: "dover",
    domains: ["dover.com"],
  },
  gem: {
    id: "gem",
    domains: ["jobs.gem.com"],
    pathRegex: "^/[\\w-]+/[\\w-]+/?$",
  },
  gusto: {
    id: "gusto",
    patterns: ["*://jobs.gusto.com/postings/*/applicants/new*"],
  },
  hiringthing: {
    id: "hiringthing",
    domains: [
      "hiringthing.com",
      "oasisrecruit.com",
      "elevate-apply",
      "prismhr-hire.com",
      "gnahiring.com",
      "rippling-ats.com",
    ],
    pathRegex: "^/job/\\d+/",
  },
  hubspot: {
    id: "hubspot",
    patterns: ["*://www.hubspot.com/careers/jobs/*"],
  },
  paycomonline: {
    id: "paycomonline",
    domains: ["paycomonline.com", "paycomonline.net"],
    urlRegex:
      "^/v4/ats/web\\.php/portal/[^/]+/(?:applications(?:[/?#].*)?|jobs/[^/?#]+\\?[^#]*\\bjr_id=)",
  },
  teamtailor: {
    id: "teamtailor",
    domains: ["teamtailor.com"],
    pageSourceKeyword: "teamtailor-cdn.com",
    pageSourceDomain: "teamtailor.com",
    pathRegex: "^/jobs/.+",
  },
  catsone: {
    id: "catsone",
    domains: ["catsone.com"],
    pathRegex: "/apply/?$",
  },
  careerplug: {
    id: "careerplug",
    domains: ["careerplug.com", "sfagentjobs.com", "sfagentcareers.com"],
    pathRegex: "^/jobs/\\d+/apps/new",
  },
  isolved: {
    id: "isolved",
    domains: ["isolvedhire.com"],
    pathRegex: "^/(?:apply/|jobs/|iframe/mobile/|account/)",
  },
  jobdiva: {
    id: "jobdiva",
    patterns: ["*://*.jobdiva.com/portal/*"],
  },
  dayforce: {
    id: "dayforce",
    patterns: ["*://jobs.dayforcehcm.com/*/jobs/*/apply*"],
  },
  rippling: {
    id: "rippling",
    patterns: [
      "*://*.rippling-ats.com/job/*/apply*",
      "*://ats.rippling.com/*/jobs/*/apply*",
    ],
    iframeDomains: ["ats.rippling.com"],
  },
  pinpointhq: {
    id: "pinpointhq",
    patterns: [
      "*://*.pinpointhq.com/*/postings/*",
      "*://*.pinpointhq.com/postings/*",
    ],
  },
  freshteam: {
    id: "freshteam",
    patterns: ["*://*.freshteam.com/jobs/*"],
  },
  trakstar: {
    id: "trakstar",
    patterns: ["*://*.hire.trakstar.com/jobs/*"],
    pathRegex: "^/jobs/[^/]+/?$",
  },
  trinethire: {
    id: "trinethire",
    patterns: ["*://app.trinethire.com/companies/*/jobs/*"],
  },
  jobscore: {
    id: "jobscore",
    patterns: [
      "*://careers.jobscore.com/apply_flow/*",
      "*://careers.jobscore.com/careers/*/jobs/*",
    ],
    iframeDomains: ["jobscore.com"],
  },
  gohire: {
    id: "gohire",
    patterns: ["*://jobs.gohire.io/*/*"],
    iframeDomains: ["app.gohire.io/widget/"],
    pathRegex: "^/[^/]+/.+-\\d+/?$",
  },
  zohorecruit: {
    id: "zohorecruit",
    domains: ["zohorecruit.com", "zohorecruit.ca", "zohorecruit.eu"],
    iframeDomains: ["zohorecruit.com", "zohorecruit.ca", "zohorecruit.eu"],
    pathRegex: "^/jobs/Careers/.+",
  },
  careerspage: {
    id: "careerspage",
    domains: ["careers-page.com"],
  },
  tiktok: {
    id: "tiktok",
    patterns: ["*://*.lifeattiktok.com/resume*"],
  },
  bytedance: {
    id: "bytedance",
    patterns: [
      "*://*.jobs.bytedance.com/en/resume*",
      "*://jobs.bytedance.com/*/*/*/detail*",
      "*://jobs.bytedance.com/*/*/*/apply*",
    ],
  },
  ycombinator: {
    id: "ycombinator",
    domains: ["www.ycombinator.com"],
  },
  clearcompany: {
    id: "clearcompany",
    domains: ["clearcompany.com"],
  },
  careerswithwaymo: {
    id: "careerswithwaymo",
    patterns: ["*://careers.withwaymo.com/jobs/*"],
    pathRegex: "^/jobs/(?!search(?:/|$))[^/]+",
  },
  adobe: {
    id: "adobe",
    domains: ["careers.adobe.com"],
    pathRegex: "^/[^/]+/[^/]+/apply",
  },
  okta: {
    id: "okta",
    patterns: ["*://www.okta.com/company/careers/*/*"],
    pathRegex: "^/company/careers/(?!job-listing(?:/|$))",
  },
  toasttab: {
    id: "toasttab",
    patterns: ["*://careers.toasttab.com/jobs*"],
  },
  polymer: {
    id: "polymer",
    patterns: ["*://jobs.polymer.co/*/*"],
  },
  walmart: {
    id: "walmart",
    patterns: ["*://careers.walmart.com/*"],
    pathRegex:
      "^/(us/en/(home|jobs?/[^/]+|apply(?:/.*)?|application(?:/.*)?)|content/careers/us/en/.*)$",
  },
  jacobs: {
    id: "jacobs",
    patterns: ["*://careers.jacobs.com/en_US/careers/*"],
    pathRegex:
      "^/en_US/careers/(Register|ApplicationForm|ApplicationReview)(?:/|$)",
  },
  amazonuniversity: {
    id: "amazonuniversity",
    patterns: ["*://*.amazonuniversity.jobs/profile*"],
  },
};

// ─── Derived Helpers ───────────────────────────────────────────────

/**
 * Get all support domains from the registry.
 */
export function getAllSupportDomains(): string[] {
  const domains = new Set<string>();
  for (const entry of Object.values(SITE_REGISTRY)) {
    if (entry.domains) entry.domains.forEach((d) => domains.add(d));
    if (entry.iframeDomains)
      entry.iframeDomains.forEach((d) => domains.add(d));
    if (entry.patterns) {
      for (const p of entry.patterns) {
        const match = /^[^:]+:\/\/([^/]+)/.exec(p);
        if (match && match[1] && match[1] !== "*") {
          domains.add(match[1].startsWith("*.") ? match[1].slice(2) : match[1]);
        }
      }
    }
  }
  return Array.from(domains);
}

/**
 * Get all iframe domain patterns.
 */
export function getAllIframeDomains(): string[] {
  const domains = new Set<string>();
  for (const entry of Object.values(SITE_REGISTRY)) {
    if (entry.iframeDomains) {
      entry.iframeDomains.forEach((d) => domains.add(d));
    }
  }
  return Array.from(domains);
}

/**
 * Get all query parameters that indicate an ATS platform.
 */
export function getAllQueryParams(): string[] {
  const params = new Set<string>();
  for (const entry of Object.values(SITE_REGISTRY)) {
    if (entry.queryParams) {
      entry.queryParams.forEach((p) => params.add(p));
    }
  }
  return Array.from(params);
}

/**
 * Get page source ATS detection entries.
 */
export function getPageSourceEntries(): Array<{
  keyword: string;
  domain: string;
}> {
  return Object.values(SITE_REGISTRY)
    .filter((e) => e.pageSourceKeyword && e.pageSourceDomain)
    .map((e) => ({
      keyword: e.pageSourceKeyword!,
      domain: e.pageSourceDomain!,
    }));
}

/**
 * Check if a hostname matches a domain (supports subdomains).
 */
export function isDomainMatch(hostname: string, domain: string): boolean {
  return hostname === domain || hostname.endsWith(`.${domain}`);
}

/**
 * Check if a hostname matches any domain in a list.
 */
export function matchesAnyDomain(hostname: string, domains: string[]): boolean {
  return domains.some((d) => isDomainMatch(hostname, d));
}
