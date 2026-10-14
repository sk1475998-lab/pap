import fs from "node:fs";

for (const tab of ["ProfileTab.tsx", "SettingsTab.tsx"]) {
  const content = fs.readFileSync(`packages/extension/src/popup/tabs/${tab}`, "utf8");
  const matches = content.match(/className=["'][^"']+["']/g) || [];
  console.log(`${tab}: ${matches.length} className occurrences`);
}
