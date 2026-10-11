#!/usr/bin/env python3
"""Vendor DM Sans from Google Fonts into public/fonts/ (SIL OFL).

Run from the repo root:  python3 scripts/fetch-fonts.py
Idempotent: re-running refreshes the files. Writes public/fonts/dm-sans.css with
relative URLs so the app needs no external CDN. Exits 1 if the download fails;
the frontend must still work with its system fallback stack.
"""
from __future__ import annotations

import re
import sys
import urllib.request
from pathlib import Path

CSS_URL = (
    "https://fonts.googleapis.com/css2?"
    "family=DM+Sans:opsz,wght@9..40,400..700&display=swap"
)
UA = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
)
KEEP = {"latin", "latin-ext"}
OUT = Path("public/fonts")
LICENSE_URL = "https://raw.githubusercontent.com/google/fonts/main/ofl/dmsans/OFL.txt"


def fetch(url: str) -> bytes:
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=30) as resp:
        return resp.read()


def main() -> int:
    try:
        css = fetch(CSS_URL).decode("utf-8")
    except Exception as exc:  # noqa: BLE001 - report and let the caller fall back
        print(f"fetch-fonts: could not download the Google Fonts stylesheet: {exc}", file=sys.stderr)
        return 1

    blocks = re.findall(r"@font-face\s*\{(.*?)\}", css, re.S)
    if not blocks:
        print("fetch-fonts: stylesheet contained no @font-face blocks", file=sys.stderr)
        return 1

    OUT.mkdir(parents=True, exist_ok=True)
    out_css: list[str] = [
        "/* DM Sans, vendored locally from Google Fonts (SIL OFL). "
        "Regenerate with scripts/fetch-fonts.py. */"
    ]
    written = 0
    index = 0
    for block in blocks:
        # Google's stylesheet emits one block per unicode subset with the subset name in a
        # leading comment; that comment is not reliably adjacent, so keep every kept block and
        # name the files by order instead of by comment.
        url = re.search(r"url\((https://[^)]+\.woff2)\)", block)
        if not url:
            continue
        # Keep only the basic-latin (U+0000-00FF) and latin-ext (U+0100-…) subsets; the rest of
        # the world's glyph coverage is dead weight for this app.
        if "U+0000-00FF" not in block and "U+0100" not in block:
            continue
        index += 1
        src = url.group(1)
        name = f"dm-sans-{index}.woff2"
        try:
            data = fetch(src)
        except Exception as exc:  # noqa: BLE001
            print(f"fetch-fonts: failed to download {src}: {exc}", file=sys.stderr)
            return 1
        (OUT / name).write_bytes(data)
        written += 1
        decl = re.sub(r"src:\s*url\([^)]+\)", f"src: url('{name}')", block)
        decl = re.sub(r"\s*\n\s*", "\n  ", decl.strip())
        out_css.append("@font-face {\n  " + decl + "\n}")

    if written == 0:
        print("fetch-fonts: no usable woff2 sources found", file=sys.stderr)
        return 1

    (OUT / "dm-sans.css").write_text("\n".join(out_css) + "\n", encoding="utf-8")
    try:
        (OUT / "OFL.txt").write_bytes(fetch(LICENSE_URL))
    except Exception as exc:  # noqa: BLE001
        print(f"fetch-fonts: license download failed ({exc}); continuing", file=sys.stderr)
    print(f"fetch-fonts: wrote {written} woff2 file(s) to {OUT}/")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
