import assert from "node:assert/strict";
import { test } from "node:test";
import { getPlan, PLANS, setPlanSource } from "../src/lib/plan.ts";
import {
  activeKey,
  activeModel,
  DEFAULT_SETTINGS,
  keyLooksValid,
  loadSettings,
  maskKey,
  normalizeSettings,
  saveSettings,
} from "../src/lib/settings.ts";

test("normalizeSettings fills defaults and rejects junk", () => {
  assert.deepEqual(normalizeSettings(undefined), DEFAULT_SETTINGS);
  const s = normalizeSettings({ provider: "evil", keys: { openai: "  sk-x ", other: "y" }, maxChars: "999999", includeLinks: "no" });
  assert.equal(s.provider, "openai");
  assert.deepEqual(s.keys, { openai: "sk-x", anthropic: "", openrouter: "" });
  assert.equal(s.maxChars, 120_000);
  assert.equal(s.includeLinks, true);
  assert.equal(normalizeSettings({ maxChars: 5 }).maxChars, 2_000);
});

test("active model falls back to the provider default", () => {
  const s = normalizeSettings({ provider: "anthropic", keys: { anthropic: "sk-ant-1" }, models: { openai: "gpt-x" } });
  assert.equal(activeKey(s), "sk-ant-1");
  assert.equal(activeModel(s), "claude-haiku-4-5");
  assert.equal(activeModel(normalizeSettings({ models: { openai: "gpt-x" } })), "gpt-x");
});

test("maskKey never reveals the middle of a key", () => {
  assert.equal(maskKey(""), "");
  assert.equal(maskKey("short"), "•••••");
  assert.equal(maskKey("sk-proj-abcdefghijklmnop1234"), "sk-pro…1234");
});

test("keyLooksValid tells providers' key formats apart", () => {
  const long = "x".repeat(30);
  assert.equal(keyLooksValid("openai", `sk-proj-${long}`), true);
  assert.equal(keyLooksValid("openai", `sk-ant-${long}`), false);
  assert.equal(keyLooksValid("anthropic", `sk-ant-api03-${long}`), true);
  assert.equal(keyLooksValid("openrouter", `sk-or-v1-${long}`), true);
  assert.equal(keyLooksValid("openrouter", "sk-or-short"), false);
  assert.equal(keyLooksValid("openai", `sk-${long} extra`), false);
});

test("settings round-trip through a storage area", async () => {
  const data: Record<string, unknown> = {};
  const area = {
    async get(key: string) {
      return { [key]: data[key] };
    },
    async set(items: Record<string, unknown>) {
      Object.assign(data, structuredClone(items));
    },
  } as unknown as chrome.storage.StorageArea;
  await saveSettings(normalizeSettings({ provider: "openrouter", keys: { openrouter: "sk-or-1" } }), area);
  const loaded = await loadSettings(area);
  assert.equal(loaded.provider, "openrouter");
  assert.equal(loaded.keys.openrouter, "sk-or-1");
});

test("plan defaults to free and survives a failing licence check", async () => {
  assert.deepEqual(await getPlan(), PLANS.free);
  setPlanSource(async () => "pro");
  assert.equal((await getPlan()).tier, "pro");
  setPlanSource(async () => {
    throw new Error("offline");
  });
  assert.equal((await getPlan()).tier, "free");
  setPlanSource(async () => "free");
});
