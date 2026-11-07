import { parseColumns } from "./columns.ts";
import type { Plan } from "./plan.ts";
import { buildExtractRequest, buildSummaryRequest, type SummaryStyle } from "./prompt.ts";
import { ApiError, callModel, type FetchLike } from "./providers.ts";
import { activeKey, activeModel, PROVIDERS, type Settings } from "./settings.ts";
import { toTable, type Table } from "./table.ts";

interface JobBase {
  tabId: number;
  url: string;
  title: string;
  pageText: string;
  truncated: boolean;
  fromSelection: boolean;
}

export interface ExtractJob extends JobBase {
  mode: "extract";
  columns: string;
  instructions: string;
}

export interface SummaryJob extends JobBase {
  mode: "summary";
  style: SummaryStyle;
}

export type Job = ExtractJob | SummaryJob;

export interface RunMeta {
  mode: Job["mode"];
  url: string;
  model: string;
  provider: string;
  truncated: boolean;
  fromSelection: boolean;
  startedAt: number;
}

export type RunState =
  | ({ status: "running" } & RunMeta)
  | ({ status: "done"; table?: Table; summary?: string; tokens: number; finishedAt: number } & RunMeta)
  | ({ status: "error"; kind: string; message: string } & RunMeta);

export function runKey(tabId: number): string {
  return `run:${tabId}`;
}

export function metaFor(job: Job, settings: Settings, now = Date.now()): RunMeta {
  return {
    mode: job.mode,
    url: job.url,
    model: activeModel(settings),
    provider: PROVIDERS[settings.provider].label,
    truncated: job.truncated,
    fromSelection: job.fromSelection,
    startedAt: now,
  };
}

export async function runJob(
  job: Job,
  settings: Settings,
  plan: Plan,
  opts: { fetch?: FetchLike; signal?: AbortSignal; now?: () => number } = {},
): Promise<RunState> {
  const now = opts.now ?? Date.now;
  const meta = metaFor(job, settings, now());
  const key = activeKey(settings);
  if (!key) {
    return { status: "error", kind: "auth", message: "Add an API key in Settings first.", ...meta };
  }
  try {
    if (job.mode === "extract") {
      const columns = parseColumns(job.columns, plan.maxColumns);
      const req = buildExtractRequest({
        url: job.url,
        title: job.title,
        pageText: job.pageText,
        columns,
        instructions: job.instructions,
      });
      const res = await callModel(settings.provider, key, meta.model, req, opts);
      const table = toTable(res.data, columns);
      return { status: "done", table, tokens: (res.usage?.input ?? 0) + (res.usage?.output ?? 0), finishedAt: now(), ...meta };
    }
    const req = buildSummaryRequest({ url: job.url, title: job.title, pageText: job.pageText, style: job.style });
    const res = await callModel(settings.provider, key, meta.model, req, opts);
    return {
      status: "done",
      summary: res.text,
      tokens: (res.usage?.input ?? 0) + (res.usage?.output ?? 0),
      finishedAt: now(),
      ...meta,
    };
  } catch (e) {
    if ((e as Error).name === "AbortError") {
      return { status: "error", kind: "cancelled", message: "Cancelled.", ...meta };
    }
    if (e instanceof ApiError) return { status: "error", kind: e.kind, message: e.message, ...meta };
    return { status: "error", kind: "unknown", message: (e as Error).message || String(e), ...meta };
  }
}
