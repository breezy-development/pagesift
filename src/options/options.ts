import { ApiError, checkKey } from "../lib/providers.ts";
import {
  keyLooksValid,
  loadSettings,
  normalizeSettings,
  PROVIDER_IDS,
  PROVIDERS,
  saveSettings,
  type ProviderId,
  type Settings,
} from "../lib/settings.ts";

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;

let settings: Settings;

function selected(): ProviderId {
  const v = document.querySelector<HTMLInputElement>('input[name="provider"]:checked')?.value;
  return (v as ProviderId) ?? settings.provider;
}

function say(text: string, tone: "ok" | "err" | "" = ""): void {
  const el = $("msg");
  el.textContent = text;
  el.className = `msg ${tone}`;
}

function renderProviders(): void {
  const box = $("providers");
  box.replaceChildren();
  for (const id of PROVIDER_IDS) {
    const p = PROVIDERS[id];
    const label = document.createElement("label");
    const input = Object.assign(document.createElement("input"), { type: "radio", name: "provider", value: id });
    input.checked = id === settings.provider;
    input.onchange = () => {
      stash();
      settings.provider = id;
      showProvider();
    };
    const name = Object.assign(document.createElement("b"), { textContent: p.label });
    const sub = document.createElement("small");
    if (settings.keys[id]) sub.append(Object.assign(document.createElement("span"), { className: "dot" }), "Key saved");
    else sub.textContent = `Default: ${p.defaultModel}`;
    label.append(input, name, sub);
    box.append(label);
  }
}

function showProvider(): void {
  const id = settings.provider;
  const p = PROVIDERS[id];
  $("key-label").textContent = `${p.label} API key`;
  $<HTMLInputElement>("key").value = settings.keys[id];
  $<HTMLInputElement>("key").placeholder = `${p.keyPrefix}…`;
  $<HTMLAnchorElement>("key-link").href = p.keyUrl;
  $<HTMLAnchorElement>("key-link").textContent = `Get a ${p.label} key`;
  $<HTMLInputElement>("model").value = settings.models[id];
  $<HTMLInputElement>("model").placeholder = p.defaultModel;
  say("");
}

function stash(): void {
  const id = settings.provider;
  settings.keys[id] = $<HTMLInputElement>("key").value.trim();
  settings.models[id] = $<HTMLInputElement>("model").value.trim();
  settings.maxChars = Number($<HTMLInputElement>("max-chars").value);
  settings.includeLinks = $<HTMLInputElement>("include-links").checked;
}

async function requestAccess(id: ProviderId): Promise<boolean> {
  try {
    return await chrome.permissions.request({ origins: [PROVIDERS[id].origin] });
  } catch {
    return false;
  }
}

async function save(e: SubmitEvent): Promise<void> {
  e.preventDefault();
  const id = selected();
  const granted = await requestAccess(id);
  stash();
  settings.provider = id;
  settings = normalizeSettings(settings);
  await saveSettings(settings);
  $<HTMLInputElement>("max-chars").value = String(settings.maxChars);
  renderProviders();
  const key = settings.keys[id];
  if (!key) return say("Saved. Add a key to start extracting.", "");
  if (!granted) return say(`Saved, but PageSift can't reach ${PROVIDERS[id].label} until you allow access.`, "err");
  if (!keyLooksValid(id, key)) return say(`Saved. That doesn't look like a ${PROVIDERS[id].label} key, though.`, "err");
  say("Saved ✓ Open any page and click the PageSift icon.", "ok");
}

async function test(): Promise<void> {
  const id = selected();
  const key = $<HTMLInputElement>("key").value.trim();
  if (!key) return say("Enter a key first.", "err");
  if (!(await requestAccess(id))) return say("Access to the provider wasn't allowed.", "err");
  say("Checking…");
  try {
    await checkKey(id, key);
    say(`Key works ✓ (${PROVIDERS[id].label})`, "ok");
  } catch (err) {
    say(err instanceof ApiError ? err.message : "Couldn't check the key.", "err");
  }
}

async function init(): Promise<void> {
  settings = await loadSettings();
  renderProviders();
  showProvider();
  $<HTMLInputElement>("max-chars").value = String(settings.maxChars);
  $<HTMLInputElement>("include-links").checked = settings.includeLinks;

  $<HTMLFormElement>("form").onsubmit = (e) => void save(e);
  $("test").onclick = () => void test();
  $("toggle-key").onclick = () => {
    const input = $<HTMLInputElement>("key");
    input.type = input.type === "password" ? "text" : "password";
    $("toggle-key").textContent = input.type === "password" ? "Show" : "Hide";
  };
  $("wipe").onclick = async () => {
    if (!confirm("Delete your saved API keys and settings from this browser?")) return;
    await chrome.storage.local.clear();
    await chrome.storage.session.clear();
    await chrome.permissions.remove({ origins: PROVIDER_IDS.map((i) => PROVIDERS[i].origin) });
    settings = normalizeSettings({});
    renderProviders();
    showProvider();
    say("All PageSift data deleted.", "ok");
  };
}

void init();
