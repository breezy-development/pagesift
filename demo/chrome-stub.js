// chrome.* stub so the real popup.html / options.html (plus background.js in the same page) can run
// in a normal tab to render the README and store screenshots. Not part of the extension package.
// AI replies are canned (demo/canned-*.json) in the provider's real response format; everything
// else (page reading, prompt building, parsing, table rendering) is the shipped code.
//
// URL params: provider, autorun=extract|summary, mode, preset, columns, style
(() => {
  const params = new URLSearchParams(location.search);
  const stubSrc = document.currentScript.src;
  const PAGE = {
    url: params.get("pageUrl") || "https://ridgeline-supply.example/lighting/headlamps",
    title: params.get("pageTitle") || "Headlamps & Lanterns | Ridgeline Supply Co.",
  };
  const provider = params.get("provider") || "openai";
  const demoKey = { openai: "sk-proj-DEMOxxxxxxxxxxxxxxxx7Qa2", anthropic: "", openrouter: "" };

  const data = {
    local: {
      settings: { provider, keys: demoKey, models: { openai: "", anthropic: "", openrouter: "" }, maxChars: 30000, includeLinks: true },
      draft: {
        mode: params.get("mode") || "extract",
        preset: params.get("preset") || "products",
        columns: params.get("columns") ?? "Name, Price, Rating, Reviews, URL",
        instructions: "",
        style: params.get("style") || "bullets",
      },
    },
    session: {},
  };
  const changed = [];
  const messageListeners = [];

  const area = (name) => ({
    async get(keys) {
      const all = data[name];
      if (keys == null) return structuredClone(all);
      const list = typeof keys === "string" ? [keys] : Array.isArray(keys) ? keys : Object.keys(keys);
      return Object.fromEntries(list.filter((k) => k in all).map((k) => [k, structuredClone(all[k])]));
    },
    async set(items) {
      const changes = {};
      for (const [k, v] of Object.entries(items)) {
        changes[k] = { oldValue: data[name][k], newValue: structuredClone(v) };
        data[name][k] = structuredClone(v);
      }
      for (const fn of changed) fn(changes, name);
    },
    async remove(key) {
      delete data[name][key];
    },
    async clear() {
      data[name] = {};
    },
  });

  const noop = { addListener() {} };
  window.chrome = {
    storage: { local: area("local"), session: area("session"), onChanged: { addListener: (fn) => changed.push(fn) } },
    tabs: { async query() { return [{ id: 1, ...PAGE }]; }, onRemoved: noop, onUpdated: noop },
    scripting: {
      async executeScript({ func, args }) {
        const frame = parent.document.getElementById("page").contentWindow;
        const result = frame.eval(`(${func.toString()})`)(...args);
        return [{ result: { ...result, url: PAGE.url, title: PAGE.title } }];
      },
    },
    permissions: { async contains() { return true; }, async request() { return true; }, async remove() { return true; } },
    runtime: {
      id: "pagesift-demo",
      openOptionsPage() {},
      onMessage: { addListener: (fn) => messageListeners.push(fn) },
      async sendMessage(msg) {
        for (const fn of messageListeners) fn(msg, { id: "pagesift-demo" }, () => {});
        return { ok: true };
      },
    },
    action: { async setBadgeText() {}, async setBadgeBackgroundColor() {} },
  };

  const realFetch = window.fetch.bind(window);
  window.fetch = async (url, init) => {
    if (!/api\.openai\.com|api\.anthropic\.com|openrouter\.ai/.test(String(url))) return realFetch(url, init);
    const body = JSON.parse(init.body);
    const wantJson = Boolean(body.response_format || body.tools);
    const canned = await realFetch(new URL(wantJson ? "canned-extract.json" : "canned-summary.json", stubSrc)).then((r) => r.json());
    const content = typeof canned === "string" ? canned : JSON.stringify(canned);
    await new Promise((r) => setTimeout(r, 400));
    const reply = {
      choices: [{ message: { content }, finish_reason: "stop" }],
      usage: { prompt_tokens: Math.round(init.body.length / 4), completion_tokens: Math.round(content.length / 4) },
    };
    return new Response(JSON.stringify(reply), { status: 200, headers: { "content-type": "application/json" } });
  };

  const autorun = params.get("autorun");
  if (autorun) {
    addEventListener("load", () => setTimeout(() => document.getElementById(`run-${autorun}`).click(), 150));
  }
})();
