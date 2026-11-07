"""Render store screenshots (1280x800) and the promo tile (440x280) from dist/demo.

Uses a throwaway headless Chrome (temporary profile, never your everyday profile), one browser
at a time. Run `npm run build && node scripts/demo.mjs` first. Set CHROME to override the binary.
"""
import functools
import http.server
import os
import subprocess
import sys
import tempfile
import threading
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
CHROME = os.environ.get("CHROME", "google-chrome")

SHOTS = [
    ("scene.html?kind=extract", "store/screenshot-1-extract.png", 1280, 800),
    ("scene.html?kind=summary", "store/screenshot-2-summary.png", 1280, 800),
    ("scene.html?kind=settings", "store/screenshot-3-settings.png", 1280, 800),
    ("promo.html", "store/promo-small-440x280.png", 440, 280),
]


def chrome_screenshot_url(url: str, out: Path, width: int, height: int, budget_ms: int) -> None:
    with tempfile.TemporaryDirectory() as tmp:
        cmd = [
            CHROME, "--headless=new", "--disable-gpu", "--no-first-run",
            f"--user-data-dir={tmp}/profile", "--hide-scrollbars",
            f"--window-size={width},{height}", f"--screenshot={out}",
            "--force-device-scale-factor=1", f"--virtual-time-budget={budget_ms}",
        ]
        subprocess.run([*cmd, url], check=True, capture_output=True, timeout=60)


def available_mb() -> int:
    line = subprocess.run(["free", "-m"], capture_output=True, text=True, check=True).stdout.splitlines()[1]
    return int(line.split()[6])


def main() -> None:
    demo = ROOT / "dist" / "demo"
    if not (demo / "scene.html").exists():
        sys.exit("dist/demo missing: run npm run build && node scripts/demo.mjs")
    class Quiet(http.server.SimpleHTTPRequestHandler):
        def log_message(self, *args) -> None:
            pass

    handler = functools.partial(Quiet, directory=str(demo))
    server = http.server.ThreadingHTTPServer(("127.0.0.1", 0), handler)
    threading.Thread(target=server.serve_forever, daemon=True).start()
    base = f"http://127.0.0.1:{server.server_address[1]}"
    try:
        for path, out, w, h in SHOTS:
            mb = available_mb()
            if mb < 1024:
                sys.exit(f"stopping: only {mb} MB available (< 1 GB)")
            dest = ROOT / out
            dest.parent.mkdir(parents=True, exist_ok=True)
            # Headless Chrome sometimes leaves the bottom rows unpainted; render taller and crop.
            chrome_screenshot_url(f"{base}/{path}", dest, w, h + 100, budget_ms=4000)
            Image.open(dest).crop((0, 0, w, h)).save(dest, optimize=True)
            print(f"{out} ({mb} MB free before render)")
    finally:
        server.shutdown()


if __name__ == "__main__":
    main()
