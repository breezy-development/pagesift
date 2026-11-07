import { getPlan } from "./lib/plan.ts";
import { metaFor, runJob, runKey, type Job, type RunState } from "./lib/run.ts";
import { loadSettings } from "./lib/settings.ts";

export type BackgroundMessage = { type: "run"; job: Job } | { type: "cancel"; tabId: number };

const inFlight = new Map<number, AbortController>();

async function start(job: Job): Promise<void> {
  inFlight.get(job.tabId)?.abort();
  const controller = new AbortController();
  inFlight.set(job.tabId, controller);

  const settings = await loadSettings();
  const running: RunState = { status: "running", ...metaFor(job, settings) };
  await chrome.storage.session.set({ [runKey(job.tabId)]: running });

  const result = await runJob(job, settings, await getPlan(), { signal: controller.signal });
  if (inFlight.get(job.tabId) !== controller) return;
  inFlight.delete(job.tabId);
  await chrome.storage.session.set({ [runKey(job.tabId)]: result });
  if (result.status === "done") {
    const n = result.table ? String(result.table.rows.length) : "✓";
    await chrome.action.setBadgeBackgroundColor({ color: "#5b4cf0", tabId: job.tabId });
    await chrome.action.setBadgeText({ text: n.length > 3 ? "999+" : n, tabId: job.tabId });
  }
}

chrome.runtime.onMessage.addListener((msg: BackgroundMessage, sender, sendResponse) => {
  if (sender.id !== chrome.runtime.id) return false;
  if (msg.type === "run") {
    start(msg.job).catch((e) => console.error("PageSift run failed", e));
    sendResponse({ ok: true });
  } else if (msg.type === "cancel") {
    inFlight.get(msg.tabId)?.abort();
    sendResponse({ ok: true });
  }
  return false;
});

chrome.tabs.onRemoved.addListener((tabId) => {
  inFlight.get(tabId)?.abort();
  inFlight.delete(tabId);
  void chrome.storage.session.remove(runKey(tabId));
});

chrome.tabs.onUpdated.addListener((tabId, info) => {
  if (info.url) void chrome.action.setBadgeText({ text: "", tabId });
});
