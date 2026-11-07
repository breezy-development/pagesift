import type { BackgroundMessage } from "../background.ts";
import { PRESETS } from "../lib/columns.ts";
import { collectPage, hostOf, isRestrictedUrl, snapshotToPromptText, type PageSnapshot } from "../lib/page.ts";
import { getPlan, type Plan } from "../lib/plan.ts";
import { SUMMARY_STYLES, type SummaryStyle } from "../lib/prompt.ts";
import { runKey, type Job, type RunState } from "../lib/run.ts";
import { activeKey, activeModel, loadSettings, maskKey, PROVIDERS, type Settings } from "../lib/settings.ts";
import { exportFilename, toCSV, toJSONRecords, toTSV, type Table } from "../lib/table.ts";
import { bulletItems } from "../lib/text.ts";

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;

type Mode = Job["mode"];
interface Draft {
  mode: Mode;
  preset: string;
  columns: string;
  instructions: string;
  style: SummaryStyle;
}
const DEFAULT_DRAFT: Draft = { mode: "extract", preset: "products", columns: PRESETS[1]!.columns, instructions: "", style: "bullets" };

let settings: Settings;
let plan: Plan;
let tab: chrome.tabs.Tab;
let draft: Draft = { ...DEFAULT_DRAFT };
let hasPermission = false;
let lastTable: Table | null = null;
let lastSummary = "";

function show(id: string, visible: boolean): void {
  $(id).hidden = !visible;
}

function setMode(mode: Mode): void {
  draft.mode = mode;
  $("tab-extract").setAttribute("aria-selected", String(mode === "extract"));
  $("tab-summary").setAttribute("aria-selected", String(mode === "summary"));
  show("extract-panel", mode === "extract");
  show("summary-panel", mode === "summary");
}

function setBusy(busy: boolean, text = ""): void {
  show("status", busy);
  $("status-text").textContent = text;
  for (const id of ["run-extract", "run-summary"]) $<HTMLButtonElement>(id).disabled = busy;
}

function showError(message: string, action?: { label: string; run: () => void }): void {
  setBusy(false);
  $("error-text").textContent = message;
  const btn = $<HTMLButtonElement>("error-action");
  btn.hidden = !action;
  if (action) {
    btn.textContent = action.label;
    btn.onclick = action.run;
  }
  show("error", true);
}

function clearMessages(): void {
  show("error", false);
  show("result", false);
}

async function saveDraft(): Promise<void> {
  await chrome.storage.local.set({ draft });
}

function buildControls(): void {
  const select = $<HTMLSelectElement>("preset");
  select.append(new Option("Custom columns", "custom"));
  for (const p of PRESETS) select.append(new Option(p.label, p.id));

  const seg = $("styles");
  for (const [id, s] of Object.entries(SUMMARY_STYLES)) {
    const label = document.createElement("label");
    const input = document.createElement("input");
    input.type = "radio";
    input.name = "style";
    input.value = id;
    label.append(input, s.label);
    seg.append(label);
  }
}

function applyDraft(): void {
  $<HTMLSelectElement>("preset").value = draft.preset;
  $<HTMLInputElement>("columns").value = draft.columns;
  $<HTMLTextAreaElement>("instructions").value = draft.instructions;
  if (draft.instructions) $<HTMLDetailsElement>("more").open = true;
  const radio = document.querySelector<HTMLInputElement>(`input[name="style"][value="${draft.style}"]`);
  if (radio) radio.checked = true;
  setMode(draft.mode);
}

function readForm(): void {
  draft.columns = $<HTMLInputElement>("columns").value.trim();
  draft.instructions = $<HTMLTextAreaElement>("instructions").value.trim();
  draft.preset = $<HTMLSelectElement>("preset").value;
  const style = document.querySelector<HTMLInputElement>('input[name="style"]:checked')?.value;
  if (style && style in SUMMARY_STYLES) draft.style = style as SummaryStyle;
}

async function ensurePermission(): Promise<boolean> {
  if (hasPermission) return true;
  try {
    hasPermission = await chrome.permissions.request({ origins: [PROVIDERS[settings.provider].origin] });
  } catch {
    hasPermission = false;
  }
  return hasPermission;
}

function permissionError(): void {
  const host = new URL(PROVIDERS[settings.provider].origin.replace("/*", "/")).host;
  showError(`PageSift needs your OK to send requests to ${host}.`, {
    label: "Allow",
    run: async () => {
      if (await ensurePermission()) show("error", false);
    },
  });
}

async function readPage(): Promise<PageSnapshot> {
  const [res] = await chrome.scripting.executeScript({ target: { tabId: tab.id! }, func: collectPage, args: [400] });
  if (!res?.result) throw new Error("no result");
  return res.result as PageSnapshot;
}

async function run(mode: Mode): Promise<void> {
  if (!(await ensurePermission())) return permissionError();
  readForm();
  draft.mode = mode;
  void saveDraft();
  clearMessages();
  setBusy(true, "Reading the page…");

  let page: PageSnapshot;
  try {
    page = await readPage();
  } catch {
    return showError("Couldn't read this page. Reload it and try again.");
  }
  const { text, truncated } = snapshotToPromptText(page, Math.min(settings.maxChars, plan.maxChars), settings.includeLinks);
  if (text.trim().length < 20) return showError("There's no readable text on this page.");

  const base = {
    tabId: tab.id!,
    url: page.url,
    title: page.title,
    pageText: text,
    truncated,
    fromSelection: page.fromSelection,
  };
  const job: Job =
    mode === "extract"
      ? { ...base, mode, columns: draft.columns, instructions: draft.instructions }
      : { ...base, mode, style: draft.style };
  const msg: BackgroundMessage = { type: "run", job };
  await chrome.runtime.sendMessage(msg);
}

function cellNode(value: string): Node {
  if (/^https?:\/\/\S+$/.test(value)) {
    const a = document.createElement("a");
    a.href = value;
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    const u = new URL(value);
    a.textContent = u.hostname.replace(/^www\./, "") + (u.pathname.length > 1 ? u.pathname : "");
    return a;
  }
  return document.createTextNode(value);
}

function renderTable(t: Table): void {
  const table = $<HTMLTableElement>("table");
  table.replaceChildren();
  const head = table.createTHead().insertRow();
  head.append(Object.assign(document.createElement("th"), { textContent: "#" }));
  for (const h of t.headers) head.append(Object.assign(document.createElement("th"), { textContent: h }));
  const body = table.createTBody();
  t.rows.slice(0, 200).forEach((r, i) => {
    const tr = body.insertRow();
    const num = tr.insertCell();
    num.className = "num";
    num.textContent = String(i + 1);
    for (const v of r) {
      const td = tr.insertCell();
      td.title = v;
      td.append(cellNode(v));
    }
  });
}

function render(state: RunState | undefined): void {
  if (!state || state.url !== tab.url) return;
  if (state.status === "running") {
    show("error", false);
    show("result", false);
    setBusy(true, `Asking ${state.model}…`);
    return;
  }
  setBusy(false);
  if (state.status === "error") {
    if (state.kind === "cancelled") return;
    if (state.kind === "auth") return showError(state.message, { label: "Settings", run: () => chrome.runtime.openOptionsPage() });
    if (state.kind === "network" && !hasPermission) return permissionError();
    return showError(state.message);
  }

  setMode(state.mode);
  show("result", true);
  show("error", false);
  const warnings: string[] = [];
  if (state.truncated) warnings.push("The page was long, so only the first part was read. Select a section, or raise the limit in Settings.");
  if (state.fromSelection) warnings.push("Used only the text you selected.");
  const tokens = state.tokens ? ` · ${state.tokens.toLocaleString()} tokens` : "";
  $("result-meta").textContent = `${state.model}${tokens}`;

  const isTable = state.mode === "extract" && state.table;
  show("table-wrap", Boolean(isTable && state.table!.rows.length));
  show("table-actions", Boolean(isTable && state.table!.rows.length));
  show("summary-out", !isTable);
  show("summary-actions", !isTable);

  if (isTable) {
    lastTable = state.table!;
    const { rows, headers } = lastTable;
    $("result-title").textContent = `${rows.length} ${rows.length === 1 ? "row" : "rows"} × ${headers.length} columns`;
    if (rows.length) renderTable(lastTable);
    else warnings.unshift("No matching rows found. Try other columns, or select the part of the page that has the data.");
    if (rows.length > 200) warnings.push("Preview shows the first 200 rows; exports include all of them.");
  } else {
    lastSummary = state.summary ?? "";
    $("result-title").textContent = "Summary";
    const out = $("summary-out");
    const items = bulletItems(lastSummary);
    if (items) {
      const ul = document.createElement("ul");
      for (const item of items) ul.append(Object.assign(document.createElement("li"), { textContent: item }));
      out.replaceChildren(ul);
    } else {
      out.textContent = lastSummary;
    }
  }
  show("tip", false);
  $("warn").textContent = warnings.join(" ");
  show("warn", warnings.length > 0);
}

async function copy(button: HTMLButtonElement, text: string): Promise<void> {
  await navigator.clipboard.writeText(text);
  const old = button.textContent;
  button.textContent = "Copied ✓";
  setTimeout(() => (button.textContent = old), 1200);
}

function download(): void {
  if (!lastTable) return;
  const blob = new Blob(["\uFEFF" + toCSV(lastTable)], { type: "text/csv;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = exportFilename(hostOf(tab.url ?? ""), new Date(), "csv");
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}

function wire(): void {
  $("open-settings").onclick = () => chrome.runtime.openOptionsPage();
  $("setup-btn").onclick = () => chrome.runtime.openOptionsPage();
  $("tab-extract").onclick = () => setMode("extract");
  $("tab-summary").onclick = () => setMode("summary");
  $("extract-panel").onsubmit = (e) => {
    e.preventDefault();
    void run("extract");
  };
  $("summary-panel").onsubmit = (e) => {
    e.preventDefault();
    void run("summary");
  };
  $<HTMLSelectElement>("preset").onchange = (e) => {
    const p = PRESETS.find((x) => x.id === (e.target as HTMLSelectElement).value);
    if (!p) return;
    $<HTMLInputElement>("columns").value = p.columns;
    $<HTMLTextAreaElement>("instructions").value = p.hint ?? "";
    readForm();
    void saveDraft();
  };
  $<HTMLInputElement>("columns").oninput = (e) => {
    const value = (e.target as HTMLInputElement).value.trim();
    const match = PRESETS.find((p) => p.columns && p.columns === value);
    $<HTMLSelectElement>("preset").value = match ? match.id : value ? "custom" : "auto";
  };
  $("cancel").onclick = () => {
    const msg: BackgroundMessage = { type: "cancel", tabId: tab.id! };
    void chrome.runtime.sendMessage(msg);
    setBusy(false);
  };
  $("dl-csv").onclick = download;
  $<HTMLButtonElement>("copy-tsv").onclick = (e) => lastTable && copy(e.currentTarget as HTMLButtonElement, toTSV(lastTable));
  $<HTMLButtonElement>("copy-json").onclick = (e) =>
    lastTable && copy(e.currentTarget as HTMLButtonElement, JSON.stringify(toJSONRecords(lastTable), null, 2));
  $<HTMLButtonElement>("copy-summary").onclick = (e) => copy(e.currentTarget as HTMLButtonElement, lastSummary);
}

async function init(): Promise<void> {
  [settings, plan] = await Promise.all([loadSettings(), getPlan()]);
  [tab] = (await chrome.tabs.query({ active: true, currentWindow: true })) as [chrome.tabs.Tab];

  $("page-host").textContent = hostOf(tab.url ?? "") || "this page";
  $("page-title").textContent = tab.title || tab.url || "";
  const key = activeKey(settings);
  $("model-line").textContent = key
    ? `${activeModel(settings)} via ${PROVIDERS[settings.provider].label} · key ${maskKey(key)} (stored on this device)`
    : "No API key yet";

  wire();
  if (!key) return show("setup", true);
  if (isRestrictedUrl(tab.url)) return show("restricted", true);

  show("main", true);
  buildControls();
  const stored = await chrome.storage.local.get("draft");
  draft = { ...DEFAULT_DRAFT, ...(stored.draft as Partial<Draft> | undefined) };
  applyDraft();

  hasPermission = await chrome.permissions.contains({ origins: [PROVIDERS[settings.provider].origin] });

  const k = runKey(tab.id!);
  render((await chrome.storage.session.get(k))[k] as RunState | undefined);
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "session" && changes[k]) render(changes[k].newValue as RunState | undefined);
  });
}

void init();
