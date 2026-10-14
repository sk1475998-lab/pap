import fs from "fs";
import path from "path";
import { pdfToText, parseResumeText, mergeProfileFromParse, writeProfile, readProfile, type Profile } from "../packages/core/src/index.js";
import { getStore } from "../packages/core/src/index.js";

async function run() {
  const filePath = path.resolve("shashi_resume_fina (1).pdf");
  console.log("Reading:", filePath);
  const buf = fs.readFileSync(filePath);
  const text = await pdfToText(new Uint8Array(buf));
  console.log("Extracted text length:", text.length);
  console.log("First 300 chars:\n" + text.slice(0, 300));
  
  const parsed = parseResumeText(text);
  console.log("\n--- PARSED DETAILS ---");
  console.log("Extracted items:", parsed.extracted);
  console.log("Detected skills (" + parsed.profile.skills?.length + "):", parsed.profile.skills?.slice(0, 15));
  console.log("Detected experience count:", parsed.profile.experience?.length);
  parsed.profile.experience?.forEach((exp, idx) => {
    console.log(`  [${idx + 1}] ${exp.title} @ ${exp.company} (${exp.startDate} - ${exp.endDate})`);
  });
  console.log("Detected education count:", parsed.profile.education?.length);
  parsed.profile.education?.forEach((edu, idx) => {
    console.log(`  [${idx + 1}] ${edu.degree} from ${edu.institution} (${edu.graduationYear})`);
  });
  console.log("Detected projects count:", parsed.profile.projects?.length);
  parsed.profile.projects?.forEach((proj, idx) => {
    console.log(`  [${idx + 1}] ${proj.name}: ${proj.technologies?.join(", ")}`);
  });

  // Now ensure this profile is cleanly merged into store
  const existing = (await readProfile<Profile>()) ?? ({} as Profile);
  const merged = mergeProfileFromParse(existing, {
    ...parsed.profile,
    firstName: "Shashi Kumar",
    lastName: "Banoth",
    email: "shashikumarbanoth91@gmail.com",
    phone: "9182805541",
    masterResumeText: text,
    resumeFileName: "shashi_resume_fina (1).pdf",
    resumeUploadedAt: Date.now(),
    updatedAt: Date.now(),
  });
  await writeProfile(merged);
  console.log("\nSuccessfully saved Shashi's real parsed resume to local profile store!");
}

run().catch(console.error);
