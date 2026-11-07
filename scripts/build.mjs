// Build the unpacked extension into dist/extension/. Usage: node scripts/build.mjs [--watch]
import { build, context } from "esbuild";
import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const src = join(root, "src");
const out = join(root, "dist", "extension");
const { version } = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));

const STATIC = [
  "popup/popup.html",
  "popup/popup.css",
  "options/options.html",
  "options/options.css",
  "ui.css",
  "privacy.html",
];

function copyStatic() {
  for (const file of STATIC) cpSync(join(src, file), join(out, file.split("/").pop()));
  cpSync(join(src, "icons"), join(out, "icons"), { recursive: true });
  const manifest = JSON.parse(readFileSync(join(src, "manifest.json"), "utf8"));
  manifest.version = version;
  writeFileSync(join(out, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n");
}

// Readable, unminified output: Chrome Web Store reviewers can read it, and MV3 forbids remote code anyway.
const options = {
  entryPoints: {
    popup: join(src, "popup/popup.ts"),
    options: join(src, "options/options.ts"),
    background: join(src, "background.ts"),
  },
  outdir: out,
  bundle: true,
  format: "esm",
  target: "chrome116",
  minify: false,
  legalComments: "none",
  logLevel: "info",
};

rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });
copyStatic();

if (process.argv.includes("--watch")) {
  const ctx = await context({ ...options, plugins: [{ name: "static", setup: (b) => b.onEnd(copyStatic) }] });
  await ctx.watch();
} else {
  await build(options);
  console.log(`built dist/extension (v${version})`);
}
