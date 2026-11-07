// Assemble dist/demo/: the built extension + demo pages, with the chrome.* stub and background.js
// injected into popup.html / options.html so they run in a normal tab. Used only for screenshots.
import { cpSync, existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const ext = join(root, "dist", "extension");
const out = join(root, "dist", "demo");
if (!existsSync(join(ext, "manifest.json"))) throw new Error("run npm run build first");

rmSync(out, { recursive: true, force: true });
cpSync(ext, out, { recursive: true });
cpSync(join(root, "demo"), out, { recursive: true });

const inject = '<script src="chrome-stub.js"></script>\n    <script type="module" src="background.js"></script>\n    ';
for (const page of ["popup.html", "options.html"]) {
  const file = join(out, page);
  const html = readFileSync(file, "utf8");
  writeFileSync(file, html.replace('<script type="module"', `${inject}<script type="module"`));
}
console.log("built dist/demo");
