import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { PROVIDER_IDS, PROVIDERS } from "../src/lib/settings.ts";

const root = join(import.meta.dirname, "..");
const manifest = JSON.parse(readFileSync(join(root, "src/manifest.json"), "utf8"));

test("Manifest V3 with only activeTab, scripting and storage", () => {
  assert.equal(manifest.manifest_version, 3);
  assert.deepEqual([...manifest.permissions].sort(), ["activeTab", "scripting", "storage"]);
  assert.equal(manifest.host_permissions, undefined, "no install-time host permissions");
  assert.equal(manifest.content_scripts, undefined, "content script is injected on demand only");
});

test("optional host permissions are exactly the supported provider APIs", () => {
  assert.deepEqual(
    [...manifest.optional_host_permissions].sort(),
    PROVIDER_IDS.map((id) => PROVIDERS[id].origin).sort(),
  );
});

test("CSP forbids remote code", () => {
  assert.equal(manifest.content_security_policy.extension_pages, "script-src 'self'; object-src 'self'");
});

test("store limits: name <= 75 chars, description <= 132 chars", () => {
  assert.ok(manifest.name.length <= 75, manifest.name);
  assert.ok(manifest.description.length <= 132, `${manifest.description.length} chars`);
  assert.ok(manifest.short_name.length <= 12);
});

test("every icon exists and every page the build copies is present", () => {
  for (const p of Object.values({ ...manifest.icons, ...manifest.action.default_icon }) as string[]) {
    assert.ok(existsSync(join(root, "src", p)), p);
  }
  for (const f of ["popup/popup.html", "options/options.html", "privacy.html", "ui.css"]) {
    assert.ok(existsSync(join(root, "src", f)), f);
  }
});

test("HTML pages load only local scripts and no inline scripts", () => {
  for (const f of ["popup/popup.html", "options/options.html", "privacy.html"]) {
    const html = readFileSync(join(root, "src", f), "utf8");
    for (const m of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)) {
      assert.match(m[1]!, /src="[a-z]+\.js"/, `${f}: external or inline script`);
      assert.equal(m[2]!.trim(), "", `${f}: inline script body`);
    }
  }
});

test("no API keys or secrets are bundled in the source", () => {
  const files = ["src/lib/settings.ts", "src/lib/providers.ts", "src/background.ts", "src/popup/popup.ts", "src/options/options.ts"];
  for (const f of files) {
    const src = readFileSync(join(root, f), "utf8");
    assert.doesNotMatch(src, /sk-(proj|ant-api|or-v1)-[A-Za-z0-9_-]{16,}/, f);
  }
});
