/**
 * Visa sponsorship & E-Verify checker — offline local database and text heuristic analysis.
 */
export interface VisaAnalysis {
  rating: "High" | "Medium" | "Low" | "Unknown";
  eVerify: boolean;
  reason: string;
}

const TOP_SPONSORS = new Set([
  "google", "meta", "microsoft", "apple", "amazon", "netflix", "salesforce", "adobe", "nvidia", "intel", "amd",
  "cisco", "qualcomm", "vmware", "oracle", "uber", "lyft", "stripe", "airbnb", "pinterest", "snap", "twitter", "x",
  "bytedance", "tiktok", "linkedin", "bloomberg", "goldman sachs", "jpmorgan", "ibm", "accenture", "deloitte", "pwc",
  "ey", "kpmg", "tcs", "infosys", "wipro", "cognizant", "hcl", "tech mahindra", "capgemini", "tesla", "spacex",
  "atlassian", "zoom", "slack", "shopify", "square", "block", "coinbase", "robinhood", "datadog", "snowflake",
  "confluent", "mongodb", "elastic", "splunk", "paypal", "ebay", "walmart", "target", "nike", "disney"
]);

export function analyzeVisaSponsorship(companyName: string, jobDescription: string): VisaAnalysis {
  const comp = companyName.toLowerCase().trim();
  const desc = jobDescription.toLowerCase();

  // 1. Check for explicit negative keywords
  const noSponsorPhrases = [
    "no visa sponsorship",
    "does not offer sponsorship",
    "unable to sponsor",
    "must be citizen",
    "no sponsorship",
    "us citizen only",
    "no c2c",
    "no corp-to-corp",
    "green card only",
    "work authorization required but no sponsorship",
    "citizenship required",
    "permanent resident only"
  ];

  const hasNegative = noSponsorPhrases.some(phrase => desc.includes(phrase));
  if (hasNegative) {
    return {
      rating: "Low",
      eVerify: TOP_SPONSORS.has(comp), // Top sponsors are still E-Verify registered even if they won't sponsor this specific job
      reason: "Listing indicates visa sponsorship is NOT available or requires US citizenship."
    };
  }

  // 2. Check for explicit positive keywords
  const yesSponsorPhrases = [
    "sponsorship available",
    "visa sponsorship",
    "sponsorship is offered",
    "h-1b transfer",
    "will sponsor",
    "opt/cpt welcome",
    "opt welcome",
    "cpt welcome",
    "sponsorship can be provided"
  ];

  const hasPositive = yesSponsorPhrases.some(phrase => desc.includes(phrase));
  if (hasPositive) {
    return {
      rating: "High",
      eVerify: true,
      reason: "Listing explicitly mentions visa sponsorship availability or OPT/CPT support."
    };
  }

  // 3. Check local database of top known H-1B sponsors
  if (TOP_SPONSORS.has(comp)) {
    return {
      rating: "High",
      eVerify: true,
      reason: "Employer is a recognized top H-1B sponsor with high filing frequency."
    };
  }

  // 4. Fallback check for general sponsorship terms in description
  if (desc.includes("sponsorship") || desc.includes("h-1b") || desc.includes("e-verify")) {
    return {
      rating: "Medium",
      eVerify: desc.includes("e-verify"),
      reason: "Listing contains general sponsorship/visa terms. Verify eligibility with the recruiter."
    };
  }

  return {
    rating: "Unknown",
    eVerify: false,
    reason: "Sponsorship history not found for this employer. Verify with recruiter."
  };
}
