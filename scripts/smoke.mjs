// Smoke test: load the packaged zip into a throwaway headless Chrome (temporary profile) and exercise
// the real chrome.* APIs. Usage: node scripts/smoke.mjs [--grant-openai]  (CHROME_PATH overrides the binary)
// --grant-openai adds a host permission to the unpacked copy only, so a run with an invalid key reaches
// OpenAI and must come back as an "auth" error (rejected keys are never billed).
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import puppeteer from "puppeteer-core";

const root = join(import.meta.dirname, "..");
const { version } = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
const zip = join(root, "dist", `pagesift-${version}.zip`);
const work = mkdtempSync(join(tmpdir(), "pagesift-"));
const extDir = join(work, "ext");
execFileSync("unzip", ["-q", zip, "-d", extDir]);
if (process.argv.includes("--grant-openai")) {
  const mf = join(extDir, "manifest.json");
  const m = JSON.parse(readFileSync(mf, "utf8"));
  m.host_permissions = ["https://api.openai.com/*"];
  writeFileSync(mf, JSON.stringify(m));
  console.log("TEST ONLY: host_permissions granted for api.openai.com in the unpacked copy");
}

const browser = await puppeteer.launch({
  executablePath: process.env.CHROME_PATH || "/usr/bin/google-chrome",
  headless: true,
  pipe: true,
  enableExtensions: true,
  userDataDir: join(work, "profile"),
  args: ["--no-first-run", "--disable-gpu"],
});
const errors = [];
const expect = (ok, what) => ok || errors.push(`check failed: ${what}`);
try {
  const id = await browser.installExtension(extDir);
  console.log("installed extension id:", id);

  const swTarget = await browser.waitForTarget((t) => t.type() === "service_worker" && t.url().includes(id), { timeout: 10000 });
  const sw = await swTarget.worker();
  console.log("service worker running:", swTarget.url().replace(id, "<id>"));
  const manifest = await sw.evaluate(() => chrome.runtime.getManifest());
  console.log("manifest:", manifest.manifest_version, manifest.version, JSON.stringify(manifest.permissions));

  const open = async (path) => {
    const page = await browser.newPage();
    page.on("pageerror", (e) => errors.push(`${path}: ${e.message}`));
    page.on("console", (m) => m.type() === "error" && errors.push(`${path}: ${m.text()}`));
    await page.goto(`chrome-extension://${id}/${path}`, { waitUntil: "networkidle0" });
    return page;
  };

  // Options page with no key, then with a key stored through the real storage API.
  let opts = await open("options.html");
  console.log("options (no key):", await opts.$eval("#providers", (el) => el.innerText.replace(/\s+/g, " ")));
  await sw.evaluate(() =>
    chrome.storage.local.set({
      settings: { provider: "openai", keys: { openai: "sk-proj-INVALIDtestKEY000000000000", anthropic: "", openrouter: "" }, models: {}, maxChars: 30000, includeLinks: true },
    }),
  );
  await opts.reload({ waitUntil: "networkidle0" });
  console.log("options (key saved):", await opts.$eval("#providers label", (el) => el.innerText.replace(/\s+/g, " ")));
  console.log("key input masked:", await opts.$eval("#key", (el) => el.type));

  // Popup opened as a tab: the active tab is the extension page itself, so it must show the restricted notice.
  const popup = await open("popup.html");
  console.log("popup model line:", await popup.$eval("#model-line", (el) => el.textContent));
  const restricted = await popup.$eval("#restricted", (el) => !el.hidden);
  console.log("popup restricted notice shown:", restricted);
  expect(restricted, "popup shows the restricted-page notice");

  // Background run with an invalid key against the real OpenAI endpoint (rejected, so nothing is billed).
  const hasPerm = await sw.evaluate(() => chrome.permissions.contains({ origins: ["https://api.openai.com/*"] }));
  console.log("optional host permission granted:", hasPerm);
  await popup.evaluate(() =>
    chrome.runtime.sendMessage({
      type: "run",
      job: { tabId: 999, url: "https://example.com/", title: "Example", pageText: "Example Domain. This domain is for use in examples.", truncated: false, fromSelection: false, mode: "summary", style: "tldr" },
    }),
  );
  let state;
  for (let i = 0; i < 40; i++) {
    state = (await sw.evaluate(() => chrome.storage.session.get("run:999")))["run:999"];
    if (state && state.status !== "running") break;
    await new Promise((r) => setTimeout(r, 250));
  }
  expect(state?.kind === (hasPerm ? "auth" : "network"), `run error kind is ${hasPerm ? "auth" : "network"}`);
  console.log("background run result:", JSON.stringify({ status: state?.status, kind: state?.kind, message: state?.message, model: state?.model }));

  const privacy = await open("privacy.html");
  console.log("privacy page title:", await privacy.title());
} finally {
  await browser.close();
  rmSync(work, { recursive: true, force: true });
}
console.log(errors.length ? `problems:\n  ${errors.join("\n  ")}` : "smoke test passed: no console errors, all checks ok");
process.exitCode = errors.length ? 1 : 0;
