export interface Column {
  label: string;
  key: string;
}

export function slugify(label: string): string {
  const slug = label
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40);
  return slug || "column";
}

/** "Name, Price (USD); rating" -> [{label:"Name",key:"name"}, {label:"Price (USD)",key:"price_usd"}, ...] */
export function parseColumns(input: string, max = 30): Column[] {
  const seen = new Map<string, number>();
  const out: Column[] = [];
  for (const part of input.split(/[,;\n\t]/)) {
    const label = part.trim().replace(/\s+/g, " ");
    if (!label) continue;
    const base = slugify(label);
    const n = (seen.get(base) ?? 0) + 1;
    seen.set(base, n);
    out.push({ label, key: n === 1 ? base : `${base}_${n}` });
    if (out.length >= max) break;
  }
  return out;
}

export interface Preset {
  id: string;
  label: string;
  columns: string;
  hint?: string;
}

export const PRESETS: Preset[] = [
  { id: "auto", label: "Let AI choose columns", columns: "" },
  { id: "products", label: "Products", columns: "Name, Price, Rating, Reviews, URL" },
  { id: "articles", label: "Articles / posts", columns: "Title, Author, Date, Summary, URL" },
  { id: "events", label: "Events", columns: "Event, Date, Time, Venue, City, URL" },
  { id: "jobs", label: "Job listings", columns: "Title, Company, Location, Salary, Posted, URL" },
  { id: "table", label: "Main table on page", columns: "", hint: "Copy the main data table on the page, keeping its own headers." },
];
