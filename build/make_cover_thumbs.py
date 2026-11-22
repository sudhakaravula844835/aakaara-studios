#!/usr/bin/env python3
"""Make small copies of the homepage carousel covers.

The Portfolio and Films cards show their cover at ~400px wide on a phone
(~600px on desktop), but the originals are 1600-1920px and 500-800 KB each.
This writes a 1000px-wide JPEG of every card cover in index.html to
/thumbs/<original path>.jpg, which Script.js tries first (see coverThumb()).
A cover without a copy falls back to the original, so nothing breaks; run
this again after adding a gallery or film card:

    python3 build/make_cover_thumbs.py

Only missing or out-of-date copies are (re)made.
"""
import html.parser
import sys
from pathlib import Path

from PIL import Image, ImageOps

ROOT = Path(__file__).resolve().parent.parent
WIDTH = 1000
QUALITY = 72


class Covers(html.parser.HTMLParser):
    def __init__(self):
        super().__init__()
        self.paths = set()

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        classes = (a.get('class') or '').split()
        src = None
        if 'gallery-item' in classes:
            folder = a.get('data-folder')
            src = a.get('data-cover') or (folder and f"{folder}/1.{a.get('data-ext') or 'jpg'}")
        elif 'vw-card' in classes:
            src = a.get('data-poster')
        if src and not src.startswith(('http:', 'https:', 'data:')):
            self.paths.add(src.split('?')[0].lstrip('/'))


def thumb_path(rel):
    return ROOT / 'thumbs' / (str(Path(rel).with_suffix('')) + '.jpg')


def main():
    parser = Covers()
    parser.feed((ROOT / 'index.html').read_text(encoding='utf-8'))
    made = skipped = missing = 0
    before = after = 0
    for rel in sorted(parser.paths):
        src = ROOT / rel
        if not src.exists():
            print(f'  missing source: {rel}')
            missing += 1
            continue
        out = thumb_path(rel)
        if out.exists() and out.stat().st_mtime >= src.stat().st_mtime:
            skipped += 1
            continue
        out.parent.mkdir(parents=True, exist_ok=True)
        with Image.open(src) as im:
            im = ImageOps.exif_transpose(im).convert('RGB')
            if im.width > WIDTH:
                im = im.resize((WIDTH, round(im.height * WIDTH / im.width)), Image.LANCZOS)
            im.save(out, 'JPEG', quality=QUALITY, optimize=True, progressive=True)
        before += src.stat().st_size
        after += out.stat().st_size
        made += 1
    print(f'{made} made, {skipped} up to date, {missing} missing sources')
    if made:
        print(f'{before / 1e6:.1f} MB of originals -> {after / 1e6:.1f} MB of copies')
    return 1 if missing else 0


if __name__ == '__main__':
    sys.exit(main())
