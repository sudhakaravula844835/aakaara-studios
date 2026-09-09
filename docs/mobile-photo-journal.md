# Mobile photo journal

Every published Framed Stories album opens in the journal on viewports up to
768px wide, and on touch phones in landscape up to 600px tall. The presentation
chosen on opening remains stable when the phone rotates. Desktop albums retain
the cinematic viewer, and coming-soon collections retain their existing notice.

The shared renderer in `photo-journal.js` reads the album's existing title,
location, folder, extension, and count. An early landscape from the first six
photographs opens the story when available. Remaining photographs keep their
source order: landscapes span the width, adjacent portraits form pairs, and
occasional individual portraits receive a full-width frame. Photos keep their
natural proportions. Tapping opens the full photograph, with previous/next
controls; Back to story restores the original scroll position and focus.

The first photograph loads eagerly; the rest load lazily. Missing images keep
their space and show a fallback. If the dimension index cannot load, the album
still opens and learns dimensions from the images as they load.

On touch devices, album covers start in black and white. The first tap reveals
the color, title, location, and story text, which remain visible after release.
The second tap opens the album. Selecting another cover, tapping outside the
carousel, or closing the album resets the reveal. Desktop hover and keyboard
activation retain their existing behavior.

`images/gallery-manifest.json` records the displayed width and height of every
numbered photograph in published Framed Stories albums. The mobile journal uses
these dimensions to arrange photographs and reserve space before they load.

After adding, removing, or replacing album photographs, or changing an album's
`data-folder`, `data-count`, or `data-ext` in `index.html`, regenerate the manifest:

```sh
python3 scripts/build-gallery-manifest.py
```

The script requires Pillow (`python3 -m pip install Pillow`). It parses actual
`.gallery-item` elements, excludes HTML comments and albums marked
`data-coming-soon="true"`, and reads each numbered image from `1` through
`data-count`. The extension defaults to `jpg`. Image orientation from EXIF is
included, and the source images are never modified. Missing files are reported
and prevent replacing the existing manifest.

Only image headers and EXIF data are read. Large source originals are supported
without decoding their pixel data during this metadata scan.

The JSON maps each root-relative image path to `[width, height]`. Paths preserve
the folder's case, spaces, and decoded HTML characters from `data-folder`.
Output is deterministic; commit the regenerated JSON with album changes.
