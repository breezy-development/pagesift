import assert from "node:assert/strict";
import { test } from "node:test";
import { parseColumns, PRESETS, slugify } from "../src/lib/columns.ts";

test("slugify makes schema-safe keys", () => {
  assert.equal(slugify("Price (USD)"), "price_usd");
  assert.equal(slugify("  Café Name "), "cafe_name");
  assert.equal(slugify("% / #"), "column");
});

test("parseColumns splits on commas, semicolons, tabs and newlines", () => {
  assert.deepEqual(parseColumns("Name, Price (USD); rating\nURL"), [
    { label: "Name", key: "name" },
    { label: "Price (USD)", key: "price_usd" },
    { label: "rating", key: "rating" },
    { label: "URL", key: "url" },
  ]);
});

test("parseColumns drops blanks, de-duplicates keys and respects the limit", () => {
  assert.deepEqual(parseColumns(" , Name,,name ,NAME"), [
    { label: "Name", key: "name" },
    { label: "name", key: "name_2" },
    { label: "NAME", key: "name_3" },
  ]);
  assert.equal(parseColumns("a,b,c,d,e", 3).length, 3);
  assert.deepEqual(parseColumns("   "), []);
});

test("every preset parses to unique keys", () => {
  for (const p of PRESETS) {
    const keys = parseColumns(p.columns).map((c) => c.key);
    assert.equal(new Set(keys).size, keys.length, p.id);
  }
});
