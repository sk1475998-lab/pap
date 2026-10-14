/** Extension-local state access. */
import {
  chromeStorageLLMCache,
  DEFAULT_LLM_CONFIG,
  mergeAgentSettings,
  profileToLookup,
  readProfile,
  readApplications,
  writeApplications,
  type AgentSettings,
  type Application,
  type LLMClient,
  type LLMConfig,
  type Profile,
  type ProfileLookup,
} from "@superjob/core";
import { wrapCachedLLM } from "@superjob/core/llm";
import { createCloudLLMClient } from "./cloud-llm.js";
import { isChromeRuntimeValid } from "./runtime-guard.js";
import { redactSensitiveLookup } from "./sensitive-profile.js";
import { hydrateProfileFromVault, protectProfileForStorage } from "./profile-vault.js";

export async function getProfile(): Promise<Profile | undefined> {
  if (!isChromeRuntimeValid()) return undefined;
  return hydrateProfileFromVault(await readProfile<Profile>());
}

export async function getProfileLookup(options: { includeSensitive?: boolean } = {}): Promise<ProfileLookup> {
  const p = await getProfile();
  if (!p) return {};
  const lookup = profileToLookup(p);
  return options.includeSensitive ? lookup : redactSensitiveLookup(lookup);
}

export async function getLLMConfig(): Promise<LLMConfig> {
  if (!isChromeRuntimeValid()) return { ...DEFAULT_LLM_CONFIG, apiKey: "" };
  const { getStore } = await import("@superjob/core");
  const store = getStore();
  const stored = await store.get<Partial<LLMConfig>>("llmConfig");
  if (stored?.apiKey) {
    await store.set("llmConfig", { ...DEFAULT_LLM_CONFIG, ...stored, apiKey: "" });
  }
  return {
    ...DEFAULT_LLM_CONFIG,
    ...stored,
    provider: stored?.provider ?? DEFAULT_LLM_CONFIG.provider,
    model: stored?.model ?? DEFAULT_LLM_CONFIG.model,
    apiKey: "",
  };
}

export async function getAgentSettings(): Promise<AgentSettings> {
  if (!isChromeRuntimeValid()) return mergeAgentSettings(undefined);
  const { getStore } = await import("@superjob/core");
  const stored = await getStore().get<Partial<AgentSettings>>("settings");
  return mergeAgentSettings(stored);
}

export async function setAgentSettings(cfg: Partial<AgentSettings>) {
  if (!isChromeRuntimeValid()) return;
  const { getStore } = await import("@superjob/core");
  const current = await getAgentSettings();
  await getStore().set("settings", { ...current, ...cfg });
}

export async function getLLM(): Promise<LLMClient> {
  const cfg = await getLLMConfig();
  const settings = await getAgentSettings();
  return wrapCachedLLM(createCloudLLMClient(cfg), {
    cache: chromeStorageLLMCache(),
    cacheEnabled: settings.llmCacheEnabled !== false,
  });
}

export async function addApplication(app: Application) {
  if (!isChromeRuntimeValid()) return;
  const list = (await readApplications<Application>()) ?? [];
  const idx = list.findIndex((a) => a.url === app.url);
  if (idx >= 0) list[idx] = { ...list[idx], ...app };
  else list.unshift(app);
  await writeApplications(list);
}

export async function saveProfile(profile: Profile) {
  if (!isChromeRuntimeValid()) return;
  const { getStore } = await import("@superjob/core");
  const updated = { ...profile, updatedAt: Date.now() };
  await getStore().set("profile", await protectProfileForStorage(updated));
}

export async function getApplications(): Promise<Application[]> {
  if (!isChromeRuntimeValid()) return [];
  return (await readApplications<Application>()) ?? [];
}

export async function getFillHistory(): Promise<any[]> {
  if (!isChromeRuntimeValid()) return [];
  const { readFillHistory } = await import("@superjob/core");
  return (await readFillHistory()) ?? [];
}

export async function saveFillHistory(list: any[]): Promise<void> {
  if (!isChromeRuntimeValid()) return;
  const { writeFillHistory } = await import("@superjob/core");
  await writeFillHistory(list);
}
