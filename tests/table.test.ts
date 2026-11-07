import assert from "node:assert/strict";
import { test } from "node:test";
import { parseColumns } from "../src/lib/columns.ts";
import { exportFilename, safeCell, toCSV, toJSONRecords, toTable, toTSV } from "../src/lib/table.ts";
import { bulletItems } from "../src/lib/text.ts";

test("bulletItems turns bullet replies into list items, leaves prose alone", () => {
  assert.deepEqual(bulletItems("- one\n\n* two\n•  three"), ["one", "two", "three"]);
  assert.equal(bulletItems("Just a paragraph.\n- not all bullets"), null);
  assert.equal(bulletItems("- only one"), null);
});

const cols = parseColumns("Name, Price (USD), Tags");

test("fixed columns: maps keys, falls back to labels, coerces values, drops empty rows", () => {
  const t = toTable(
    {
      rows: [
        { name: "  Lamp\n  Pro ", price_usd: 19.5, tags: ["a", "b", null] },
        { Name: "Desk", "Price (USD)": "$120", tags: null },
        { name: "", price_usd: "", tags: "" },
        ["Chair", "45", "c"],
      ],
    },
    cols,
  );
  assert.deepEqual(t.headers, ["Name", "Price (USD)", "Tags"]);
  assert.deepEqual(t.rows, [
    ["Lamp Pro", "19.5", "a; b"],
    ["Desk", "$120", ""],
    ["Chair", "45", "c"],
  ]);
});

test("auto columns: uses declared headers and pads ragged rows", () => {
  const t = toTable({ columns: ["City", "Pop"], rows: [["Austin", "974k"], ["Boise"], ["Reno", "264k", "NV"]] }, []);
  assert.deepEqual(t.headers, ["City", "Pop", "Column 3"]);
  assert.deepEqual(t.rows, [
    ["Austin", "974k", ""],
    ["Boise", "", ""],
    ["Reno", "264k", "NV"],
  ]);
});

test("auto columns: a bare array of objects uses the first object's keys", () => {
  const t = toTable([{ a: 1, b: 2 }, { a: 3 }], []);
  assert.deepEqual(t, { headers: ["a", "b"], rows: [["1", "2"], ["3", ""]] });
});

test("garbage input gives an empty table instead of throwing", () => {
  assert.deepEqual(toTable(null, cols).rows, []);
  assert.deepEqual(toTable("x", []).rows, []);
});

test("safeCell blocks formulas but keeps negative numbers", () => {
  assert.equal(safeCell("=HYPERLINK(\"x\")"), "'=HYPERLINK(\"x\")");
  assert.equal(safeCell("@SUM(A1)"), "'@SUM(A1)");
  assert.equal(safeCell("+1 555 0100"), "'+1 555 0100");
  assert.equal(safeCell("-12.50"), "-12.50");
  assert.equal(safeCell("-15%"), "-15%");
  assert.equal(safeCell("Plain"), "Plain");
});

test("toCSV quotes when needed and uses CRLF", () => {
  const csv = toCSV({ headers: ["a", "b"], rows: [['say "hi"', "x,y"], ["=1+1", " pad"]] });
  assert.equal(csv, 'a,b\r\n"say ""hi""","x,y"\r\n\'=1+1," pad"\r\n');
});

test("toTSV flattens tabs/newlines; JSON records keyed by header", () => {
  const t = { headers: ["a", "b"], rows: [["1\t2", "line\nbreak"]] };
  assert.equal(toTSV(t), "a\tb\n1 2\tline break");
  assert.deepEqual(toJSONRecords(t), [{ a: "1\t2", b: "line\nbreak" }]);
});

test("exportFilename is filesystem-safe", () => {
  const d = new Date("2026-11-07T15:00:00Z");
  assert.equal(exportFilename("shop.example.com", d, "csv"), "pagesift-shop.example.com-2026-11-07.csv");
  assert.equal(exportFilename("", d, "csv"), "pagesift-page-2026-11-07.csv");
  assert.equal(exportFilename("a/b:c", d, "json"), "pagesift-a-b-c-2026-11-07.json");
});
