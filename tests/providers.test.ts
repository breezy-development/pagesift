import assert from "node:assert/strict";
import { test } from "node:test";
import type { ModelRequest } from "../src/lib/prompt.ts";
import {
  ApiError,
  buildKeyCheckRequest,
  buildRequest,
  callModel,
  checkKey,
  parseJsonLoose,
  parseResponse,
  type FetchLike,
} from "../src/lib/providers.ts";

const schemaReq: ModelRequest = {
  system: "sys",
  user: "usr",
  schema: { name: "extracted_rows", schema: { type: "object" } },
  maxTokens: 100,
};

test("OpenAI request uses strict json_schema and max_completion_tokens", () => {
  const r = buildRequest("openai", "sk-test", "gpt-5.4-mini", schemaReq);
  assert.equal(r.url, "https://api.openai.com/v1/chat/completions");
  assert.equal(r.headers.authorization, "Bearer sk-test");
  const body = JSON.parse(r.body!);
  assert.equal(body.max_completion_tokens, 100);
  assert.equal(body.temperature, undefined);
  assert.deepEqual(body.messages.map((m: any) => m.role), ["system", "user"]);
  assert.deepEqual(body.response_format, {
    type: "json_schema",
    json_schema: { name: "extracted_rows", strict: true, schema: { type: "object" } },
  });
});

test("OpenRouter is OpenAI-compatible with max_tokens", () => {
  const r = buildRequest("openrouter", "sk-or-x", "openai/gpt-5.4-mini", { ...schemaReq, schema: undefined });
  assert.equal(r.url, "https://openrouter.ai/api/v1/chat/completions");
  const body = JSON.parse(r.body!);
  assert.equal(body.max_tokens, 100);
  assert.equal(body.response_format, undefined);
  assert.equal(r.headers["x-title"], "PageSift");
});

test("Anthropic request forces a tool call and allows browser access", () => {
  const r = buildRequest("anthropic", "sk-ant-x", "claude-haiku-4-5", schemaReq);
  assert.equal(r.url, "https://api.anthropic.com/v1/messages");
  assert.equal(r.headers["x-api-key"], "sk-ant-x");
  assert.equal(r.headers["anthropic-dangerous-direct-browser-access"], "true");
  const body = JSON.parse(r.body!);
  assert.equal(body.system, "sys");
  assert.deepEqual(body.tool_choice, { type: "tool", name: "extracted_rows" });
  assert.deepEqual(body.tools[0].input_schema, { type: "object" });
});

test("key checks hit free read-only endpoints", () => {
  assert.equal(buildKeyCheckRequest("openai", "k").url, "https://api.openai.com/v1/models");
  assert.equal(buildKeyCheckRequest("anthropic", "k").url, "https://api.anthropic.com/v1/models?limit=1");
  assert.equal(buildKeyCheckRequest("openrouter", "k").url, "https://openrouter.ai/api/v1/key");
  for (const p of ["openai", "anthropic", "openrouter"] as const) assert.equal(buildKeyCheckRequest(p, "k").method, "GET");
});

test("parses OpenAI JSON content and usage", () => {
  const res = parseResponse(
    "openai",
    { choices: [{ message: { content: '{"rows":[]}' }, finish_reason: "stop" }], usage: { prompt_tokens: 5, completion_tokens: 2 } },
    true,
  );
  assert.deepEqual(res.data, { rows: [] });
  assert.deepEqual(res.usage, { input: 5, output: 2 });
});

test("parses Anthropic tool_use input, and text replies", () => {
  const tool = parseResponse(
    "anthropic",
    { content: [{ type: "tool_use", input: { rows: [{ a: "1" }] } }], stop_reason: "tool_use", usage: { input_tokens: 9, output_tokens: 3 } },
    true,
  );
  assert.deepEqual(tool.data, { rows: [{ a: "1" }] });
  const text = parseResponse("anthropic", { content: [{ type: "text", text: " - point " }], stop_reason: "end_turn" }, false);
  assert.equal(text.text, "- point");
});

test("refusals and truncated replies become ApiErrors", () => {
  assert.throws(
    () => parseResponse("openai", { choices: [{ message: { content: null, refusal: "No." } }] }, true),
    (e: ApiError) => e.kind === "refused" && e.message === "No.",
  );
  assert.throws(
    () => parseResponse("openai", { choices: [{ message: { content: '{"rows":[' }, finish_reason: "length" }] }, true),
    (e: ApiError) => e.kind === "truncated",
  );
  assert.throws(() => parseResponse("anthropic", { content: [], stop_reason: "max_tokens" }, true), (e: ApiError) => e.kind === "truncated");
});

test("parseJsonLoose handles fences and surrounding prose", () => {
  assert.deepEqual(parseJsonLoose('```json\n{"a":1}\n```'), { a: 1 });
  assert.deepEqual(parseJsonLoose('Here you go: {"a":[1,2]} hope it helps'), { a: [1, 2] });
  assert.throws(() => parseJsonLoose("nope"), (e: ApiError) => e.kind === "parse");
});

const fakeFetch =
  (status: number, body: unknown, seen: { url?: string; init?: RequestInit } = {}): FetchLike =>
  async (url, init) => {
    seen.url = url;
    seen.init = init;
    return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
  };

test("callModel sends the request and parses the reply", async () => {
  const seen: { url?: string; init?: RequestInit } = {};
  const res = await callModel("openrouter", "sk-or-k", "m", schemaReq, {
    fetch: fakeFetch(200, { choices: [{ message: { content: '{"rows":[{"x":"1"}]}' } }] }, seen),
  });
  assert.equal(seen.url, "https://openrouter.ai/api/v1/chat/completions");
  assert.equal(seen.init?.method, "POST");
  assert.deepEqual(res.data, { rows: [{ x: "1" }] });
});

test("HTTP errors map to friendly kinds and keep the provider's message", async () => {
  const cases: [number, unknown, string][] = [
    [401, { error: { message: "Incorrect API key provided" } }, "auth"],
    [429, { error: { message: "Rate limit" } }, "rate_limit"],
    [402, {}, "rate_limit"],
    [400, { error: "bad model" }, "bad_request"],
    [503, {}, "server"],
  ];
  for (const [status, body, kind] of cases) {
    await assert.rejects(
      callModel("openai", "k", "m", schemaReq, { fetch: fakeFetch(status, body) }),
      (e: ApiError) => e.kind === kind && e.status === status && e.message.length > 0,
    );
  }
  await assert.rejects(
    callModel("openai", "k", "m", schemaReq, { fetch: fakeFetch(401, { error: { message: "Incorrect API key provided" } }) }),
    { message: "Incorrect API key provided" },
  );
});

test("network failures and aborts", async () => {
  const offline: FetchLike = async () => {
    throw new TypeError("Failed to fetch");
  };
  await assert.rejects(callModel("openai", "k", "m", schemaReq, { fetch: offline }), (e: ApiError) => e.kind === "network");

  const controller = new AbortController();
  const slow: FetchLike = (_url, init) =>
    new Promise((_, reject) => init.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError"))));
  const pending = callModel("openai", "k", "m", schemaReq, { fetch: slow, signal: controller.signal });
  controller.abort();
  await assert.rejects(pending, { name: "AbortError" });
});

test("checkKey resolves on 200 and rejects on 401", async () => {
  await checkKey("openai", "k", fakeFetch(200, { data: [] }));
  await assert.rejects(checkKey("anthropic", "k", fakeFetch(401, {})), (e: ApiError) => e.kind === "auth");
});
