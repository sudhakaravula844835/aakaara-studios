# Coming Soon Gallery Treatment — Design Spec

**Date:** 2026-03-26
**Status:** Approved

---

## Problem

Gallery items whose image folders are empty show only a gradient background with no photo cover. Clicking them opens a broken, empty gallery viewer. This looks unfinished to visitors.

## Goal

Empty gallery cards should look intentional — visually marked "Coming Soon" with a cinematic centered treatment. Clicking still opens the gallery viewer, which shows a styled Coming Soon screen instead of empty content.

---

## Approach

Use an explicit `data-coming-soon="true"` attribute on gallery items whose folders are confirmed empty. CSS handles the card overlay. JS (`openSwGallery`) detects the flag and renders a Coming Soon screen inside the existing viewer instead of loading images.

This is explicit and controlled — a card is Coming Soon because it was deliberately marked so, not because of a broken image or a transient file system state.

---

## Card Cover Treatment

Gallery items with `data-coming-soon="true"` display a centered cinematic overlay on their card face:

- The gradient background (`gi-1`–`gi-8`) shows through as normal
- Centered overlay contains:
  - Eyebrow label: `COMING SOON` in Outfit, ~10px, wide letterspacing, ~40% opacity
  - Gallery title in Cormorant Garamond italic, ~1.3rem, below the eyebrow
- The photo-count badge (`.gi-count`) is hidden for Coming Soon cards
- The card remains fully clickable — no `pointer-events: none`, no disabled state

CSS target: `[data-coming-soon="true"]`

---

## Gallery Viewer — Coming Soon Screen

When `openSwGallery()` is called on an element with `data-coming-soon="true"`:

1. The viewer opens as normal (overlay fades in, close button appears)
2. Instead of building image URLs and rendering the filmstrip, the viewer renders a full-screen Coming Soon state:
   - Background: the same gradient class as the card (`gi-1`–`gi-8` applied to the viewer background)
   - Centered content block:
     - Eyebrow: `COMING SOON` in Outfit, spaced, muted
     - Gallery title in Cormorant Garamond italic, ~2.5rem
     - Thin decorative horizontal rule (matching site style)
     - Subtitle: `"We're still building this collection — check back soon."`
   - Filmstrip dock: hidden (`.sw-gallery-strip` not rendered)
3. Close button (`×`) works as normal
4. Navigation arrows are hidden (nothing to navigate)
5. Keyboard left/right arrows do nothing in this state

---

## Galleries to Mark

The following gallery items in `index.html` need `data-coming-soon="true"` added:

| Title | Category | Folder |
|---|---|---|
| Pooja & Amit | wedding | weddings/pooja-amit |
| Vivek & Srujana | couple | couple-portraits/vivek-srujana |
| Deekshitha & Varun | couple | couple-portraits/deekshitha-varun |
| Sowmya & Family | couple | couple-portraits/sowmya-family |
| Sameeksha & Aman | couple | couple-portraits/sameeksha-aman |
| Yogesh & Supritha | couple | couple-portraits/yogesh-supritha |
| Shivani | maternity | maternity/shivani |
| Shwetha | maternity | maternity/shwetha |
| The Last Hour | conceptual | conceptual/varsha-sunset |
| A Thousand Silences | conceptual | conceptual/manasa-india |
| Lilly | spring | spring/lilly |
| Darzi Suits | brand | brand-collabs/darzi-suits |
| Neha | housewarming | house-warming/neha |
| Rupa | housewarming | house-warming/rupa |
| Karthik Concert | events | events/karthik-concert |
| Holi Event | events | events/holi-event |
| Noora Fatehi | events | events/noora-fatehi |
| Ram Tour USA | events | events/ram-tour-usa |
| DSP | events | events/dsp |
| Goutham & Family | birthday | first-birthday/goutham-family |
| Joana Sweet Sixteen | birthday | first-birthday/joana-sweet-sixteen |

---

## Implementation Scope

**`index.html`** — Add `data-coming-soon="true"` to each gallery item listed above. No other HTML changes per card — the title is already in `.gi-overlay h4`.

**`styles.css`** — Add styles for the card overlay treatment (no new HTML elements needed):
- `.gallery-item[data-coming-soon] .gi-count` → `display: none`
- `.gallery-item[data-coming-soon] .gi-overlay` → vertically and horizontally centered (override the default bottom-aligned position)
- `.gallery-item[data-coming-soon] .gi-overlay::before` → CSS pseudo-element injecting `"COMING SOON"` eyebrow text above the title

**`Script.js`** — In `openSwGallery()`:
- Check `el.dataset.comingSoon === 'true'` early in the function
- If true, open the overlay but render the Coming Soon screen instead of image logic
- Skip filmstrip rendering, skip navigation arrows
- Apply the card's gradient class to the viewer background

---

## Out of Scope

- Video cards: already have "Coming Soon" duration badge — no change needed
- Auto-detection via image load failure — not used (explicit attribute only)
- Contact CTA inside the viewer — not included (keep it clean)
