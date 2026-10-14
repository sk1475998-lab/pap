import { classifyLabel, profileToLookup, decideFieldPolicy, resolveValue } from "../packages/core/src/index.js";

const sampleProfile = {
  firstName: "Shashi",
  lastName: "Banoth",
  yearsOfExperience: "2",
  experience: [
    {
      title: "Founder and Sole Developer",
      company: "Super Job Agent",
      location: "warangal",
      startDate: "2024-01-01",
      endDate: "present",
      bullets: ["Shipped Super Job Agent"]
    }
  ]
};

const lookup = profileToLookup(sampleProfile as any);

console.log("--- WORKDAY LABEL CLASSIFICATION ---");
console.log("Classify 'Company*':", classifyLabel("Company*"));
console.log("Classify 'Job Title*':", classifyLabel("Job Title*"));
console.log("Classify 'Location':", classifyLabel("Location"));
console.log("Classify 'Role Description':", classifyLabel("Role Description"));

console.log("\n--- FIELD POLICIES (autonomousMode=false) ---");
const policyCompany = decideFieldPolicy({ label: "Company*", fieldKey: classifyLabel("Company*") }, lookup, { allowAutonomousFallback: false });
console.log("Policy 'Company*':", policyCompany);

const policyTitle = decideFieldPolicy({ label: "Job Title*", fieldKey: classifyLabel("Job Title*") }, lookup, { allowAutonomousFallback: false });
console.log("Policy 'Job Title*':", policyTitle);

console.log("\n--- VALUE RESOLUTION ---");
const valCompany = resolveValue({ label: "Company*", fieldKey: classifyLabel("Company*") } as any, lookup);
console.log("Resolved 'Company*' Value:", valCompany);

const valTitle = resolveValue({ label: "Job Title*", fieldKey: classifyLabel("Job Title*") } as any, lookup);
console.log("Resolved 'Job Title*' Value:", valTitle);

const valLocation = resolveValue({ label: "Location", fieldKey: classifyLabel("Location") } as any, lookup);
console.log("Resolved 'Location' Value:", valLocation);

if (policyCompany.action === "fill" && valCompany === "Super Job Agent") {
  console.log("\n✅ ALL CHECKS PASSED: Company* is recognized as safe and filled from candidate experience!");
} else {
  console.error("\n❌ FAILED: Company* policy or value resolution failed!");
  process.exit(1);
}
