import assert from "node:assert/strict";
import { test } from "node:test";
import { hostOf, isRestrictedUrl, snapshotToPromptText, type PageSnapshot } from "../src/lib/page.ts";

const page = (text: string, n = 0): PageSnapshot => ({
  url: "https://shop.example/list",
  title: "List",
  text,
  links: Array.from({ length: n }, (_, i) => ({ text: `Item ${i}`, href: `https://shop.example/p/${i}` })),
  fromSelection: false,
});

test("short pages pass through untruncated, with a links section", () => {
  const { text, truncated } = snapshotToPromptText(page("Hello world", 2), 10_000);
  assert.equal(truncated, false);
  assert.match(text, /^Hello world\n/);
  assert.match(text, /Links on the page \(text <url>\):\n- Item 0 <https:\/\/shop\.example\/p\/0>\n- Item 1/);
});

test("links are capped at a quarter of the budget and the total stays within it", () => {
  const { text, truncated } = snapshotToPromptText(page("x".repeat(50_000), 500), 8_000);
  assert.equal(truncated, true);
  assert.ok(text.length <= 8_000 + 40, `length ${text.length}`);
  const linksPart = text.slice(text.indexOf("Links on the page"));
  assert.ok(linksPart.length <= 2_000 + 40);
});

test("unused link budget goes to the page text", () => {
  const { text, truncated } = snapshotToPromptText(page("y".repeat(7_900)), 8_000);
  assert.equal(truncated, false);
  assert.equal(text, "y".repeat(7_900));
});

test("links can be turned off", () => {
  const { text } = snapshotToPromptText(page("body", 3), 5_000, false);
  assert.equal(text, "body");
});

test("hostOf and isRestrictedUrl", () => {
  assert.equal(hostOf("https://www.example.com/a?b"), "example.com");
  assert.equal(hostOf("not a url"), "");
  for (const u of ["chrome://extensions", "about:blank", "https://chromewebstore.google.com/detail/x", undefined]) {
    assert.equal(isRestrictedUrl(u), true, String(u));
  }
  assert.equal(isRestrictedUrl("https://news.ycombinator.com/"), false);
});
