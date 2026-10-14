import fs from "fs";
import path from "path";
import { pdfToText, parseResumeText } from "../packages/core/src/index.js";

async function run() {
  const filePath = path.resolve("shashi_resume_fina (1).pdf");
  const buf = fs.readFileSync(filePath);
  const text = await pdfToText(new Uint8Array(buf));
  const parsed = parseResumeText(text);

  // 1. Get dev-session token
  const authRes = await fetch("http://localhost:3001/api/auth/dev-session", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "shashikumarbanoth91@gmail.com", name: "Shashi Kumar Banoth" })
  });
  const auth = await authRes.json();
  const token = auth.token;
  console.log("Authenticated, token acquired.");

  // 2. Build complete real profile
  const fullProfile = {
    ...parsed.profile,
    firstName: "Shashi Kumar",
    lastName: "Banoth",
    email: "shashikumarbanoth91@gmail.com",
    phone: "+91-9182805541",
    linkedInUrl: "https://www.linkedin.com/in/shashi-kumar-banoth-a0a287276/",
    githubUrl: "https://github.com/shashi-kumar91",
    targetRoles: ["AI/ML Engineer", "Data Scientist", "LLM Engineer", "Machine Learning Engineer"],
    masterResumeText: text,
    resumeFileName: "shashi_resume_fina (1).pdf",
    preferredLocation: "Bengaluru, Hyderabad, Remote, India",
    willingToRelocate: "Yes",
    yearsOfExperience: "1",
    currentCTC: "12 LPA",
    expectedCTC: "24 LPA",
    noticePeriod: "Immediate / 15 days",
    skills: parsed.profile.skills || [],
    experience: parsed.profile.experience || [],
    education: parsed.profile.education || [],
    projects: parsed.profile.projects || [],
    certifications: parsed.profile.certifications || [],
  };

  // 3. Post to /api/profile
  const profRes = await fetch("http://localhost:3001/api/profile", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`
    },
    body: JSON.stringify(fullProfile)
  });
  const profData = await profRes.json();
  console.log("POST /api/profile result:", profData.ok);
  console.log("Saved skills count:", profData.data?.skills?.length);
  console.log("Saved experience count:", profData.data?.experience?.length);
  console.log("Saved projects count:", profData.data?.projects?.length);
  console.log("Master resume text length:", profData.data?.masterResumeText?.length);

  // 4. Test /api/sync
  const syncRes = await fetch("http://localhost:3001/api/sync", {
    headers: { "Authorization": `Bearer ${token}` }
  });
  const syncData = await syncRes.json();
  console.log("\nGET /api/sync check:");
  console.log("Sync envelope ok:", syncData.ok);
  console.log("Sync profile name:", syncData.envelope?.data?.profile?.firstName, syncData.envelope?.data?.profile?.lastName);
  console.log("Sync skills count:", syncData.envelope?.data?.profile?.skills?.length);
  console.log("Sync masterResumeText length:", syncData.envelope?.data?.profile?.masterResumeText?.length);
}

run().catch(console.error);
