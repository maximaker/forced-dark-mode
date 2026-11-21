"""Renders store/demo.html frame by frame and encodes store/demo.mp4 (1920x1080, 30 fps, H.264).

Usage: python store/record-demo.py [--preview t1,t2,...]
Needs: pip install playwright imageio-ffmpeg  (and `playwright install chromium`)
"""
import subprocess
import sys
from pathlib import Path

import imageio_ffmpeg
from playwright.sync_api import sync_playwright

HERE = Path(__file__).resolve().parent
FPS = 30

def main():
    preview = None
    if "--preview" in sys.argv:
        preview = [float(x) for x in sys.argv[sys.argv.index("--preview") + 1].split(",")]

    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page(viewport={"width": 1280, "height": 720}, device_scale_factor=1.5)
        page.goto((HERE / "demo.html").as_uri())
        page.wait_for_load_state("networkidle")
        duration = page.evaluate("window.DURATION")

        if preview:
            for t in preview:
                page.evaluate(f"render({t})")
                page.screenshot(path=str(HERE / f"preview-{t:g}.png"))
            browser.close()
            return

        out = HERE / "demo.mp4"
        ff = subprocess.Popen([
            imageio_ffmpeg.get_ffmpeg_exe(), "-y", "-loglevel", "error",
            "-f", "image2pipe", "-framerate", str(FPS), "-c:v", "png", "-i", "-",
            "-c:v", "libx264", "-preset", "slow", "-crf", "18", "-pix_fmt", "yuv420p",
            "-movflags", "+faststart", str(out),
        ], stdin=subprocess.PIPE)
        total = int(duration * FPS)
        for n in range(total):
            page.evaluate(f"render({n / FPS})")
            ff.stdin.write(page.screenshot(type="png"))
            if n % 60 == 0:
                print(f"frame {n}/{total}", flush=True)
        ff.stdin.close()
        ff.wait()
        browser.close()
        print(f"wrote {out}")

if __name__ == "__main__":
    main()
