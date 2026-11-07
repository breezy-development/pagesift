// Writes docs/sample-export.csv from the demo's model reply using the shipped table/CSV code.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { parseColumns, PRESETS } from "../src/lib/columns.ts";
import { toCSV, toTable } from "../src/lib/table.ts";

const root = join(import.meta.dirname, "..");
const reply = JSON.parse(readFileSync(join(root, "demo/canned-extract.json"), "utf8"));
const columns = parseColumns(PRESETS.find((p) => p.id === "products")!.columns);
const csv = toCSV(toTable(reply, columns));
mkdirSync(join(root, "docs"), { recursive: true });
writeFileSync(join(root, "docs/sample-export.csv"), csv);
process.stdout.write(csv);
