import type { Column } from "./columns.ts";

export interface Table {
  headers: string[];
  rows: string[][];
}

function cell(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value.replace(/\s+/g, " ").trim();
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) return value.map(cell).filter(Boolean).join("; ");
  return JSON.stringify(value);
}

/**
 * Turns the model's JSON into a rectangular table. Accepts the fixed-column shape
 * ({rows:[{key:value}]}), the auto shape ({columns:[...], rows:[[...]]}) and a bare array.
 */
export function toTable(data: unknown, columns: Column[]): Table {
  const obj = (data && typeof data === "object" ? data : {}) as Record<string, unknown>;
  const rawRows: unknown[] = Array.isArray(data) ? data : Array.isArray(obj.rows) ? obj.rows : [];

  let headers: string[];
  let rows: string[][];

  if (columns.length) {
    headers = columns.map((c) => c.label);
    rows = rawRows.map((r) => {
      if (Array.isArray(r)) return columns.map((_, i) => cell(r[i]));
      const rec = (r && typeof r === "object" ? r : {}) as Record<string, unknown>;
      return columns.map((c) => cell(rec[c.key] ?? rec[c.label]));
    });
  } else {
    const declared = Array.isArray(obj.columns) ? obj.columns.map(cell) : [];
    const firstObj = rawRows.find((r) => r && typeof r === "object" && !Array.isArray(r)) as
      | Record<string, unknown>
      | undefined;
    headers = declared.length ? declared : firstObj ? Object.keys(firstObj) : [];
    rows = rawRows.map((r) => {
      if (Array.isArray(r)) return r.map(cell);
      const rec = (r && typeof r === "object" ? r : {}) as Record<string, unknown>;
      return headers.map((h) => cell(rec[h]));
    });
    const width = Math.max(headers.length, ...rows.map((r) => r.length));
    for (let i = headers.length; i < width; i++) headers.push(`Column ${i + 1}`);
    rows = rows.map((r) => [...r, ...Array(width - r.length).fill("")].slice(0, width));
  }

  return { headers, rows: rows.filter((r) => r.some((v) => v !== "")) };
}

const FORMULA_START = /^[=+\-@\t\r]/;
const PLAIN_NUMBER = /^[+-]?(\d[\d,]*)?(\.\d+)?%?$/;

/** Neutralises spreadsheet formula injection without mangling negative numbers. */
export function safeCell(value: string): string {
  return FORMULA_START.test(value) && !PLAIN_NUMBER.test(value) ? `'${value}` : value;
}

function csvField(value: string): string {
  const v = safeCell(value);
  return /[",\r\n]|^\s|\s$/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}

export function toCSV(table: Table): string {
  return [table.headers, ...table.rows].map((r) => r.map(csvField).join(",")).join("\r\n") + "\r\n";
}

/** Tab-separated, for pasting straight into Google Sheets or Excel. */
export function toTSV(table: Table): string {
  return [table.headers, ...table.rows]
    .map((r) => r.map((v) => safeCell(v).replace(/[\t\r\n]+/g, " ")).join("\t"))
    .join("\n");
}

export function toJSONRecords(table: Table): Record<string, string>[] {
  return table.rows.map((r) => Object.fromEntries(table.headers.map((h, i) => [h, r[i] ?? ""])));
}

export function exportFilename(host: string, date: Date, ext: string): string {
  const day = date.toISOString().slice(0, 10);
  const safeHost = host.replace(/[^a-z0-9.-]+/gi, "-").replace(/^-+|-+$/g, "") || "page";
  return `pagesift-${safeHost}-${day}.${ext}`;
}
