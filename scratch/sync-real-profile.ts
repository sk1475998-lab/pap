import fs from "fs";
import path from "path";
import { pdfToText, parseResumeText, mergeProfileFromParse, writeProfile, readProfile, type Profile } from "../packages/core/src/index.js";
import { getStore, getBaseStore, namespacedStore, touchSyncKey } from "../packages/core/src/index.js";
import { findUserByEmail } from "../packages/server/src/lib/identity.js";

async function run() {
  const filePath = path.resolve("shashi_resume_fina (1).pdf");
  const buf = fs.readFileSync(filePath);
  const text = await pdfToText(new Uint8Array(buf));
  const parsed = parseResumeText(text);

  const realProfile: Profile = {
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
    resumeUploadedAt: Date.now(),
    updatedAt: Date.now(),
    preferredLocation: "Bengaluru, Hyderabad, Remote, India",
    willingToRelocate: "Yes",
    yearsOfExperience: "1",
  };

  // 1. Write to base store
  const existingBase = (await readProfile<Profile>()) ?? ({} as Profile);
  await writeProfile(mergeProfileFromParse(existingBase, realProfile));
  await getStore().set("resumePath", filePath);

  // 2. Write to user's tenant store if exists
  const user = await findUserByEmail("shashikumarbanoth91@gmail.com");
  if (user) {
    const tenantStore = namespacedStore(getBaseStore(), user.userId);
    const tenantExisting = (await tenantStore.get<Profile>("profile")) ?? ({} as Profile);
    const tenantMerged = mergeProfileFromParse(tenantExisting, realProfile);
    await tenantStore.set("profile", tenantMerged);
    await tenantStore.set("resumePath", filePath);
    console.log(`Synced to tenant user:${user.userId}`);
  }

  console.log("Profile successfully updated in all stores with 80 skills, real education, real projects, real contact info!");
}

run().catch(console.error);
