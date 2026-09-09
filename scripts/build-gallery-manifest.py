#!/usr/bin/env python3
"""Record displayed dimensions for every published Framed Stories photograph."""

import json
import sys
from html.parser import HTMLParser
from pathlib import Path

try:
    from PIL import Image
except ImportError:
    sys.exit("Pillow is required: python3 -m pip install Pillow")

# This command reads only headers/EXIF, never decodes pixels. Some existing
# editorial originals exceed Pillow's raster-allocation safety threshold.
Image.MAX_IMAGE_PIXELS = None


ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "images" / "gallery-manifest.json"


class GalleryParser(HTMLParser):
    """Read actual gallery elements; HTML comments are ignored by HTMLParser."""

    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.albums = []

    def handle_starttag(self, tag, attrs):
        attributes = dict(attrs)
        if "gallery-item" not in (attributes.get("class") or "").split():
            return
        if attributes.get("data-coming-soon") == "true":
            return

        folder = (attributes.get("data-folder") or "").strip().strip("/")
        extension = (attributes.get("data-ext") or "jpg").lstrip(".")
        count = int(attributes.get("data-count") or "0")
        if not folder or count < 1:
            raise ValueError(f"Invalid gallery attributes: {attributes}")
        if not folder.startswith("images/") or ".." in Path(folder).parts:
            raise ValueError(f"Expected a local images folder: {folder}")
        self.albums.append((folder, count, extension))


def build_manifest():
    parser = GalleryParser()
    parser.feed((ROOT / "index.html").read_text(encoding="utf-8"))
    if not parser.albums:
        raise ValueError("No published gallery albums found in index.html")

    manifest = {}
    missing = []
    for folder, count, extension in parser.albums:
        print(f"Reading {folder} ({count} photographs)", flush=True)
        for number in range(1, count + 1):
            relative_path = f"{folder}/{number}.{extension}"
            image_path = ROOT / relative_path
            if not image_path.is_file():
                missing.append(relative_path)
                continue
            try:
                with Image.open(image_path) as photograph:
                    width, height = photograph.size
                    # EXIF orientations 5–8 exchange the displayed width and height.
                    if photograph.getexif().get(274, 1) in (5, 6, 7, 8):
                        width, height = height, width
            except (OSError, ValueError, Image.DecompressionBombError) as error:
                raise ValueError(f"Cannot read image dimensions for {relative_path}: {error}") from error
            manifest[f"/{relative_path}"] = [width, height]

    if missing:
        for relative_path in missing:
            print(f"Missing image: {relative_path}", file=sys.stderr)
        raise ValueError(f"{len(missing)} image(s) missing; manifest was not changed")

    OUTPUT.write_text(
        json.dumps(manifest, sort_keys=True, separators=(",", ":")) + "\n",
        encoding="utf-8",
    )
    print(
        f"Generated {OUTPUT.relative_to(ROOT)}: "
        f"{len(manifest)} photographs across {len(parser.albums)} published albums; "
        f"{OUTPUT.stat().st_size:,} bytes; no missing sources."
    )


if __name__ == "__main__":
    try:
        build_manifest()
    except (OSError, ValueError) as error:
        sys.exit(str(error))
