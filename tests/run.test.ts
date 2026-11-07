import assert from "node:assert/strict";
import { test } from "node:test";
import { PLANS } from "../src/lib/plan.ts";
import type { FetchLike } from "../src/lib/providers.ts";
import { runJob, runKey, type ExtractJob, type SummaryJob } from "../src/lib/run.ts";
import { normalizeSettings, type ProviderId } from "../src/lib/settings.ts";

const base = { tabId: 7, url: "https://shop.example/", title: "Shop", pageText: "Lamp $19\nDesk $120", truncated: false, fromSelection: false };
const extract: ExtractJob = { ...base, mode: "extract", columns: "Name, Price", instructions: "" };
const summary: SummaryJob = { ...base, mode: "summary", style: "bullets" };
const rows = { rows: [{ name: "Lamp", price: "$19" }, { name: "Desk", price: "$120" }] };

function replyFor(provider: ProviderId, wantJson: boolean): unknown {
  if (provider === "anthropic") {
    return wantJson
      ? { content: [{ type: "tool_use", input: rows }], stop_reason: "tool_use", usage: { input_tokens: 100, output_tokens: 20 } }
      : { content: [{ type: "text", text: "- Lamp is $19" }], stop_reason: "end_turn", usage: { input_tokens: 100, output_tokens: 8 } };
  }
  return {
    choices: [{ message: { content: wantJson ? JSON.stringify(rows) : "- Lamp is $19" }, finish_reason: "stop" }],
    usage: { prompt_tokens: 100, completion_tokens: 20 },
  };
}

const mockProvider =
  (provider: ProviderId): FetchLike =>
  async (_url, init) => {
    const body = JSON.parse(String(init.body));
    const wantJson = Boolean(body.response_format || body.tools);
    return new Response(JSON.stringify(replyFor(provider, wantJson)), { status: 200 });
  };

for (const provider of ["openai", "anthropic", "openrouter"] as const) {
  test(`extract job end-to-end via ${provider}`, async () => {
    const settings = normalizeSettings({ provider, keys: { [provider]: "k-123" } });
    const state = await runJob(extract, settings, PLANS.free, { fetch: mockProvider(provider), now: () => 1000 });
    assert.equal(state.status, "done");
    if (state.status !== "done") return;
    assert.deepEqual(state.table, { headers: ["Name", "Price"], rows: [["Lamp", "$19"], ["Desk", "$120"]] });
    assert.equal(state.url, "https://shop.example/");
    assert.ok(state.tokens > 0);
  });

  test(`summary job end-to-end via ${provider}`, async () => {
    const settings = normalizeSettings({ provider, keys: { [provider]: "k-123" } });
    const state = await runJob(summary, settings, PLANS.free, { fetch: mockProvider(provider) });
    assert.equal(state.status, "done");
    if (state.status === "done") assert.equal(state.summary, "- Lamp is $19");
  });
}

test("missing key, HTTP errors and cancellation become error states", async () => {
  const noKey = await runJob(extract, normalizeSettings({}), PLANS.free);
  assert.equal(noKey.status, "error");
  assert.equal(noKey.status === "error" && noKey.kind, "auth");

  const settings = normalizeSettings({ keys: { openai: "k" } });
  const denied: FetchLike = async () => new Response(JSON.stringify({ error: { message: "Invalid key" } }), { status: 401 });
  const bad = await runJob(extract, settings, PLANS.free, { fetch: denied });
  assert.deepEqual(bad.status === "error" && [bad.kind, bad.message], ["auth", "Invalid key"]);

  const aborted: FetchLike = async () => {
    throw new DOMException("aborted", "AbortError");
  };
  const cancelled = await runJob(summary, settings, PLANS.free, { fetch: aborted });
  assert.equal(cancelled.status === "error" && cancelled.kind, "cancelled");
});

test("the plan caps the number of columns sent to the model", async () => {
  let sentKeys: string[] = [];
  const spy: FetchLike = async (_url, init) => {
    const body = JSON.parse(String(init.body));
    sentKeys = body.response_format.json_schema.schema.properties.rows.items.required;
    return new Response(JSON.stringify(replyFor("openai", true)), { status: 200 });
  };
  const many = { ...extract, columns: Array.from({ length: 20 }, (_, i) => `c${i}`).join(",") };
  await runJob(many, normalizeSettings({ keys: { openai: "k" } }), PLANS.free, { fetch: spy });
  assert.equal(sentKeys.length, PLANS.free.maxColumns);
});

test("runKey is per tab", () => {
  assert.equal(runKey(42), "run:42");
});
