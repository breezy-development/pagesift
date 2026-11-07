import type { ModelRequest } from "./prompt.ts";
import type { ProviderId } from "./settings.ts";

export interface HttpRequest {
  url: string;
  method: "GET" | "POST";
  headers: Record<string, string>;
  body?: string;
}

export type ApiErrorKind = "auth" | "rate_limit" | "bad_request" | "server" | "network" | "parse" | "refused" | "truncated";

export class ApiError extends Error {
  readonly kind: ApiErrorKind;
  readonly status: number | undefined;
  constructor(kind: ApiErrorKind, message: string, status?: number) {
    super(message);
    this.name = "ApiError";
    this.kind = kind;
    this.status = status;
  }
}

export interface ModelResult {
  text: string;
  data?: unknown;
  usage?: { input: number; output: number };
}

const OPENAI_COMPATIBLE: Record<"openai" | "openrouter", string> = {
  openai: "https://api.openai.com/v1/chat/completions",
  openrouter: "https://openrouter.ai/api/v1/chat/completions",
};

export function buildRequest(provider: ProviderId, apiKey: string, model: string, req: ModelRequest): HttpRequest {
  if (provider === "anthropic") {
    const body: Record<string, unknown> = {
      model,
      max_tokens: req.maxTokens,
      system: req.system,
      messages: [{ role: "user", content: req.user }],
    };
    if (req.schema) {
      body.tools = [
        { name: req.schema.name, description: "Return the extracted data.", input_schema: req.schema.schema },
      ];
      body.tool_choice = { type: "tool", name: req.schema.name };
    }
    return {
      url: "https://api.anthropic.com/v1/messages",
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "anthropic-dangerous-direct-browser-access": "true",
      },
      body: JSON.stringify(body),
    };
  }

  const body: Record<string, unknown> = {
    model,
    messages: [
      { role: "system", content: req.system },
      { role: "user", content: req.user },
    ],
  };
  body[provider === "openai" ? "max_completion_tokens" : "max_tokens"] = req.maxTokens;
  if (req.schema) {
    body.response_format = {
      type: "json_schema",
      json_schema: { name: req.schema.name, strict: true, schema: req.schema.schema },
    };
  }
  const headers: Record<string, string> = {
    "content-type": "application/json",
    authorization: `Bearer ${apiKey}`,
  };
  if (provider === "openrouter") headers["x-title"] = "PageSift";
  return { url: OPENAI_COMPATIBLE[provider], method: "POST", headers, body: JSON.stringify(body) };
}

/** A free, read-only request that only succeeds with a valid key (no tokens are billed). */
export function buildKeyCheckRequest(provider: ProviderId, apiKey: string): HttpRequest {
  switch (provider) {
    case "openai":
      return { url: "https://api.openai.com/v1/models", method: "GET", headers: { authorization: `Bearer ${apiKey}` } };
    case "anthropic":
      return {
        url: "https://api.anthropic.com/v1/models?limit=1",
        method: "GET",
        headers: {
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
          "anthropic-dangerous-direct-browser-access": "true",
        },
      };
    case "openrouter":
      return { url: "https://openrouter.ai/api/v1/key", method: "GET", headers: { authorization: `Bearer ${apiKey}` } };
  }
}

function errorMessage(json: unknown): string {
  const err = (json as { error?: unknown } | null)?.error;
  if (typeof err === "string") return err;
  const msg = (err as { message?: unknown } | undefined)?.message;
  return typeof msg === "string" ? msg : "";
}

export function httpError(status: number, json: unknown): ApiError {
  const detail = errorMessage(json);
  if (status === 401 || status === 403) {
    return new ApiError("auth", detail || "The API key was rejected. Check it in Settings.", status);
  }
  if (status === 402) return new ApiError("rate_limit", detail || "Out of credits on this API account.", status);
  if (status === 429) return new ApiError("rate_limit", detail || "Rate limit or quota reached. Try again shortly.", status);
  if (status >= 500) return new ApiError("server", detail || `The provider had an error (HTTP ${status}).`, status);
  return new ApiError("bad_request", detail || `Request failed (HTTP ${status}).`, status);
}

/** Parses JSON that may be wrapped in a ``` fence or surrounded by prose. */
export function parseJsonLoose(text: string): unknown {
  const trimmed = text.trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    const fenced = /```(?:json)?\s*([\s\S]*?)```/i.exec(trimmed)?.[1];
    const candidate = fenced ?? trimmed.slice(trimmed.indexOf("{"), trimmed.lastIndexOf("}") + 1);
    try {
      return JSON.parse(candidate);
    } catch {
      throw new ApiError("parse", "The model's reply wasn't valid JSON. Try again or pick a stronger model.");
    }
  }
}

export function parseResponse(provider: ProviderId, json: unknown, wantJson: boolean): ModelResult {
  if (provider === "anthropic") {
    const r = json as {
      content?: { type: string; text?: string; input?: unknown }[];
      stop_reason?: string;
      usage?: { input_tokens?: number; output_tokens?: number };
    };
    const blocks = r.content ?? [];
    const usage = { input: r.usage?.input_tokens ?? 0, output: r.usage?.output_tokens ?? 0 };
    if (r.stop_reason === "max_tokens") {
      throw new ApiError("truncated", "The reply hit the output limit. Narrow the columns or select part of the page.");
    }
    const tool = blocks.find((b) => b.type === "tool_use");
    const text = blocks.filter((b) => b.type === "text").map((b) => b.text ?? "").join("").trim();
    if (wantJson) {
      if (tool) return { text: JSON.stringify(tool.input), data: tool.input, usage };
      return { text, data: parseJsonLoose(text), usage };
    }
    return { text, usage };
  }

  const r = json as {
    choices?: { message?: { content?: string | null; refusal?: string | null }; finish_reason?: string }[];
    usage?: { prompt_tokens?: number; completion_tokens?: number };
  };
  const choice = r.choices?.[0];
  const usage = { input: r.usage?.prompt_tokens ?? 0, output: r.usage?.completion_tokens ?? 0 };
  if (!choice?.message) throw new ApiError("parse", "The provider returned an empty reply.");
  if (choice.message.refusal) throw new ApiError("refused", choice.message.refusal);
  if (choice.finish_reason === "length") {
    throw new ApiError("truncated", "The reply hit the output limit. Narrow the columns or select part of the page.");
  }
  const text = (choice.message.content ?? "").trim();
  return wantJson ? { text, data: parseJsonLoose(text), usage } : { text, usage };
}

export type FetchLike = (url: string, init: RequestInit) => Promise<Response>;

async function send(req: HttpRequest, fetchImpl: FetchLike, signal?: AbortSignal): Promise<unknown> {
  let res: Response;
  try {
    const init: RequestInit = { method: req.method, headers: req.headers };
    if (req.body !== undefined) init.body = req.body;
    if (signal) init.signal = signal;
    res = await fetchImpl(req.url, init);
  } catch (e) {
    if ((e as Error).name === "AbortError") throw e;
    throw new ApiError("network", "Couldn't reach the API. Check your connection and that access to the API was allowed.");
  }
  let json: unknown = null;
  try {
    json = await res.json();
  } catch {
    if (res.ok) throw new ApiError("parse", "The provider returned a non-JSON reply.", res.status);
  }
  if (!res.ok) throw httpError(res.status, json);
  return json;
}

export async function callModel(
  provider: ProviderId,
  apiKey: string,
  model: string,
  req: ModelRequest,
  opts: { fetch?: FetchLike; signal?: AbortSignal } = {},
): Promise<ModelResult> {
  const json = await send(buildRequest(provider, apiKey, model, req), opts.fetch ?? fetch, opts.signal);
  return parseResponse(provider, json, Boolean(req.schema));
}

export async function checkKey(provider: ProviderId, apiKey: string, fetchImpl: FetchLike = fetch): Promise<void> {
  await send(buildKeyCheckRequest(provider, apiKey), fetchImpl);
}
