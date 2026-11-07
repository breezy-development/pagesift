export type ProviderId = "openai" | "anthropic" | "openrouter";

export interface ProviderInfo {
  label: string;
  origin: string;
  defaultModel: string;
  keyPrefix: string;
  keyUrl: string;
}

export const PROVIDERS: Record<ProviderId, ProviderInfo> = {
  openai: {
    label: "OpenAI",
    origin: "https://api.openai.com/*",
    defaultModel: "gpt-5.4-mini",
    keyPrefix: "sk-",
    keyUrl: "https://platform.openai.com/api-keys",
  },
  anthropic: {
    label: "Anthropic",
    origin: "https://api.anthropic.com/*",
    defaultModel: "claude-haiku-4-5",
    keyPrefix: "sk-ant-",
    keyUrl: "https://console.anthropic.com/settings/keys",
  },
  openrouter: {
    label: "OpenRouter",
    origin: "https://openrouter.ai/*",
    defaultModel: "openai/gpt-5.4-mini",
    keyPrefix: "sk-or-",
    keyUrl: "https://openrouter.ai/settings/keys",
  },
};

export const PROVIDER_IDS = Object.keys(PROVIDERS) as ProviderId[];

export interface Settings {
  provider: ProviderId;
  keys: Record<ProviderId, string>;
  models: Record<ProviderId, string>;
  maxChars: number;
  includeLinks: boolean;
}

export const MIN_CHARS = 2_000;
export const MAX_CHARS = 120_000;

export const DEFAULT_SETTINGS: Settings = {
  provider: "openai",
  keys: { openai: "", anthropic: "", openrouter: "" },
  models: { openai: "", anthropic: "", openrouter: "" },
  maxChars: 30_000,
  includeLinks: true,
};

function isProvider(value: unknown): value is ProviderId {
  return typeof value === "string" && value in PROVIDERS;
}

function strings(raw: unknown): Record<ProviderId, string> {
  const out = { openai: "", anthropic: "", openrouter: "" };
  if (raw && typeof raw === "object") {
    for (const id of PROVIDER_IDS) {
      const v = (raw as Record<string, unknown>)[id];
      if (typeof v === "string") out[id] = v.trim();
    }
  }
  return out;
}

export function normalizeSettings(raw: unknown): Settings {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const chars = Number(r.maxChars);
  return {
    provider: isProvider(r.provider) ? r.provider : DEFAULT_SETTINGS.provider,
    keys: strings(r.keys),
    models: strings(r.models),
    maxChars: Number.isFinite(chars)
      ? Math.min(MAX_CHARS, Math.max(MIN_CHARS, Math.round(chars)))
      : DEFAULT_SETTINGS.maxChars,
    includeLinks: typeof r.includeLinks === "boolean" ? r.includeLinks : DEFAULT_SETTINGS.includeLinks,
  };
}

export function activeKey(s: Settings): string {
  return s.keys[s.provider];
}

export function activeModel(s: Settings): string {
  return s.models[s.provider] || PROVIDERS[s.provider].defaultModel;
}

export function maskKey(key: string): string {
  if (!key) return "";
  if (key.length <= 10) return "•".repeat(key.length);
  return `${key.slice(0, 6)}…${key.slice(-4)}`;
}

/** Plausibility check only; the real test is the provider's key-check endpoint. */
export function keyLooksValid(provider: ProviderId, key: string): boolean {
  const k = key.trim();
  if (k.length < 20 || /\s/.test(k)) return false;
  if (provider === "openai") return k.startsWith("sk-") && !k.startsWith("sk-ant-") && !k.startsWith("sk-or-");
  return k.startsWith(PROVIDERS[provider].keyPrefix);
}

// API keys live in chrome.storage.local (never .sync) so they don't leave this device.
const STORAGE_KEY = "settings";

export async function loadSettings(storage: chrome.storage.StorageArea = chrome.storage.local): Promise<Settings> {
  const got = await storage.get(STORAGE_KEY);
  return normalizeSettings(got[STORAGE_KEY]);
}

export async function saveSettings(
  settings: Settings,
  storage: chrome.storage.StorageArea = chrome.storage.local,
): Promise<void> {
  await storage.set({ [STORAGE_KEY]: normalizeSettings(settings) });
}
