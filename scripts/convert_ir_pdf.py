#!/usr/bin/env python3
"""Convert an official IR PDF into per-page images for the original_image
presentation engine (engine B).

Usage:
    python3 scripts/convert_ir_pdf.py <pdf_path> <material_id>

Output:
    materials/ir/<material_id>/page-01.jpg, page-02.jpg, ...

Spec (fixed 2026-11-14):
    - JPEG, 150 dpi, quality 85 (readable on the LCD, moderate file size)
    - The page image is the original document page, unmodified
      (no cropping, no text extraction, no re-typesetting).

The PDF itself is NOT stored in the repository; only page images are.
Keep the source URL in data/materials.json (pdf_url) for provenance.
"""
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


def main() -> int:
    if len(sys.argv) != 3:
        print(__doc__)
        return 2
    pdf_path = Path(sys.argv[1])
    material_id = sys.argv[2]
    if not pdf_path.exists():
        print(f"PDF not found: {pdf_path}")
        return 1

    info = subprocess.run(
        ["pdfinfo", str(pdf_path)], capture_output=True, text=True, check=True
    ).stdout
    pages = None
    for line in info.splitlines():
        if line.startswith("Pages:"):
            pages = int(line.split(":", 1)[1].strip())
    if not pages:
        print("Could not read page count from pdfinfo")
        return 1

    out_dir = ROOT / "materials" / "ir" / material_id
    out_dir.mkdir(parents=True, exist_ok=True)
    prefix = out_dir / "page"
    subprocess.run(
        [
            "pdftoppm", "-jpeg", "-r", "150",
            "-jpegopt", "quality=85",
            str(pdf_path), str(prefix),
        ],
        check=True,
    )
    width = len(str(pages))
    produced = []
    for f in sorted(out_dir.glob("page-*.jpg")):
        # pdftoppm zero-pads to the page-count width; normalize to 2 digits min
        num = int(f.stem.split("-")[1])
        new = out_dir / f"page-{num:02d}.jpg"
        if f != new:
            f.rename(new)
        produced.append(new)
    total = sum(f.stat().st_size for f in produced)
    print(f"{material_id}: {pages} pages, {len(produced)} images, "
          f"total {total/1024:.0f} KiB -> {out_dir}")
    for f in produced:
        print(f"  {f.relative_to(ROOT)}  {f.stat().st_size/1024:.0f} KiB")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
