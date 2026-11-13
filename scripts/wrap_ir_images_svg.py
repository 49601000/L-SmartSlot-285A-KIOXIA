#!/usr/bin/env python3
"""Wrap IR page JPEGs in SVG containers for transport.

Why: the GitHub push path available to this project accepts text files
only, so binary JPEGs cannot be pushed directly. An SVG file is text,
renders in browsers as a normal image, and embeds the original JPEG
bytes (base64) completely unmodified — the embedded JPEG can be
extracted byte-identically at any time.

Usage:
    python3 scripts/wrap_ir_images_svg.py <material_id> [<material_id> ...]

For each materials/ir/<material_id>/page-XX.jpg this writes
page-XX.svg next to it. The game loads the .svg files; the .jpg files
are the canonical local copies.
"""
import base64
import hashlib
import sys
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent


def wrap_one(jpg: Path) -> Path:
    data = jpg.read_bytes()
    with Image.open(jpg) as im:
        w, h = im.size
    b64 = base64.b64encode(data).decode("ascii")
    svg = (
        f'<svg xmlns="http://www.w3.org/2000/svg" width="{w}" height="{h}" '
        f'viewBox="0 0 {w} {h}">'
        f'<image href="data:image/jpeg;base64,{b64}" width="{w}" height="{h}"/>'
        f"</svg>\n"
    )
    out = jpg.with_suffix(".svg")
    out.write_text(svg, encoding="utf-8")
    # verify: decode the base64 back and compare hashes
    embedded = svg.split("base64,", 1)[1].split('"', 1)[0]
    assert hashlib.sha256(base64.b64decode(embedded)).hexdigest() == \
        hashlib.sha256(data).hexdigest(), f"byte mismatch: {jpg}"
    return out


def main() -> int:
    if len(sys.argv) < 2:
        print(__doc__)
        return 2
    total = 0
    for material_id in sys.argv[1:]:
        d = ROOT / "materials" / "ir" / material_id
        jpgs = sorted(d.glob("page-*.jpg"))
        if not jpgs:
            print(f"no JPEGs for {material_id}")
            return 1
        for jpg in jpgs:
            out = wrap_one(jpg)
            total += 1
            print(f"{out.relative_to(ROOT)}  {out.stat().st_size/1024:.0f} KiB")
    print(f"wrapped {total} pages, all byte-identical to the source JPEGs")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
