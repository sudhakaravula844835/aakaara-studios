# Video Works — FocusRail Hero Design

**Date:** 2026-04-25  
**Status:** Approved  
**Scope:** Production site (`index.html` + `Script.js` + `styles.css`) — no build step, no dependencies

---

## Overview

Replace the Video Works section's EtherealCarousel with a two-part layout:

1. **FocusRail hero** — a new 3D coverflow carousel showcasing 6 curated films, built as a self-contained vanilla JS class
2. **Filterable grid** — the existing 18-card EtherealCarousel grid, unchanged

The FocusRail design is a port of the React `FocusRail` component (already in `gallery-preview/components/ui/focus-rail.tsx`) into vanilla JS/CSS, adapted to match Aakaara's existing brand tokens and wired to the existing video modal.

---

## Layout

```
#video-works section
├── section-tag + section-title ("Video Works")
├── #videoFocusRail                    ← NEW
│   ├── .vfr-ambience                  ← blurred poster bg, crossfades on change
│   ├── .vfr-stage                     ← 5 visible cards in 3D perspective
│   │   └── .vfr-card × 6 items        ← data attrs carry all film data
│   └── .vfr-info                      ← title, type, description + controls
│       ├── .vfr-text (title/meta/desc)
│       └── .vfr-controls (prev/counter/next + Watch Film btn)
├── .vfr-divider ("All Films")         ← NEW — thin separator
├── .vw-filters                        ← UNCHANGED
└── #vwGrid (EtherealCarousel)         ← UNCHANGED
```

---

## Curated Items (6 hero films)

These are hardcoded in `index.html` as `data-*` attributes on `.vfr-card` elements. They mirror entries already in `#vwGrid`.

| # | Title | Type | data-video (HLS) | data-poster |
|---|-------|------|-----------------|-------------|
| 1 | Pooja & Amit | Wedding Film | `e970988b…/playlist.m3u8` | `/images/video-covers/wedding/pooja-amit/cover.jpg` |
| 2 | Vyshnavi & Daniel | Engagement Film | `f8156d9b…/playlist.m3u8` | `/images/video-covers/engagement/vyshnavi-daniel.jpg` |
| 3 | Abhinav & Megha | Wedding Film | `9003fec7…/playlist.m3u8` | `/images/video-covers/wedding/abhinav-megha/cover.jpg` |
| 4 | Sameeksha NYC | Conceptual Film | `fb52713c…/playlist.m3u8` | `/images/video-covers/conceptual/sameeksha-nyc.jpg` |
| 5 | Suprith & Pragnya | Pre-Wedding Film | `2b8a87cf…/playlist.m3u8` | `/images/video-covers/prewedding/suprith-pragnya.jpg` |
| 6 | Darzi Suits | Brand Film | `84eadf17…/playlist.m3u8` | `/images/video-covers/conceptual/darzi-suits.jpg` |

Full CDN base URL: `https://vz-757250d0-999.b-cdn.net/`

---

## VideoFocusRail Class (`Script.js`)

### Responsibilities
- Read item data from DOM (`.vfr-card[data-*]` attributes)
- Manage `activeIndex` state
- Render 3D transforms for 5 visible cards (`offset` -2 to +2)
- Handle all input: click on side cards, prev/next buttons, keyboard, mouse wheel, touch swipe
- Crossfade the ambience background on item change
- Animate the info panel text transition on item change
- Call the existing `openVideoModal()` on "Watch Film" click

### State
```js
activeIndex    // integer, wraps via modulo
isDragging     // boolean — suppresses click during drag
dragStartX     // number — pointer x at dragstart
lastWheelTime  // number — timestamp for 400ms wheel debounce
```

### Card transform formula (per offset -2..+2)
```
translateX  = offset × 320px
translateZ  = -|offset| × 180px
rotateY     = offset × -20deg
scale       = offset === 0 ? 1 : 0.85
opacity     = offset === 0 ? 1 : max(0.1, 1 - |offset| × 0.5)
filter      = blur(|offset| × 6px) brightness(offset===0 ? 1 : 0.5)
z-index     = offset === 0 ? 5 : 5 - |offset|
```

CSS transition on each card:
```css
transition: transform 0.5s cubic-bezier(0.16,1,0.3,1),
            opacity 0.4s ease,
            filter 0.4s ease;
```

### Input handling
| Input | Behaviour |
|-------|-----------|
| Click center card | Calls `openActive()` |
| Click side card | `goTo(offset)` — advances by the card's offset |
| Prev / Next buttons | `prev()` / `next()` |
| `ArrowLeft` / `ArrowRight` | `prev()` / `next()` — only when the video modal is closed (`.vm-open` not on modal element), to avoid conflicting with the modal's own arrow-key skip controls |
| Mouse wheel `deltaX` or `deltaY` | `next()` / `prev()` — debounced 400ms |
| Pointer drag swipe | `next()` / `prev()` if `|offsetX| > 60px` on pointerup |

### `openActive()`
Passes the active `.vfr-card` DOM element directly to the existing `openModal(card)` function (defined at line ~1539 of `Script.js`). `openModal` reads `card.dataset.video`, `card.dataset.title`, and `card.dataset.type` — so `.vfr-card` items must carry all three. No changes to the modal itself.

### Ambience crossfade
Two absolutely-positioned `<img class="vfr-amb-img">` elements stacked. On item change: new image preloads, then CSS `opacity` transition crossfades old → new over 0.8s. Same pattern used by the existing services scroll-stack.

### Info text animation
On `activeIndex` change: info container gets class `vfr-info--exit` (opacity 0, translateY -8px, 0.2s), swaps text content, then class `vfr-info--enter` (opacity 1, translateY 0, 0.3s).

---

## CSS (`styles.css`)

New rules appended after existing Video Works styles (~60 lines):

```
.vfr-wrap          perspective container, overflow-hidden, noir bg, mb-40px
.vfr-ambience      absolute inset-0, z-0, pointer-events-none
.vfr-amb-img       absolute inset-0, w/h 100%, object-cover, blur(60px), saturate(1.8), opacity transition
.vfr-stage         relative, h-340px, display-flex, align-center, justify-center, perspective-1200px
.vfr-card          absolute, aspect-ratio 3/4, w-180px, rounded-16px, border-top-white/20, overflow-hidden, cursor-pointer
.vfr-card.is-center cursor-default
.vfr-info          relative z-10, display-flex, justify-between, align-center, px-32px, pt-24px, gap-16px
.vfr-meta          font-size-10px, letter-spacing, uppercase, color-rose
.vfr-title         Cormorant Garamond, ~1.8rem, ivory
.vfr-desc          Outfit 13px, ivory/50, max-w-300px, line-height-1.55
.vfr-ctrl-pill     flex, gap-2px, bg-white/5, ring-1-white/10, rounded-full, p-4px, backdrop-blur
.vfr-ctrl-btn      36px circle, hover bg-white/10, transition
.vfr-count         monospace 11px, ivory/35, min-w-36px text-center
.vfr-watch-btn     bg-rose, color-noir, rounded-full, px-20px py-10px, font-600, 12px, letter-spacing
.vfr-divider       flex, align-center, gap-16px, my-40px — rose/12 lines + "All Films" label
```

Mobile (`≤768px`): stage height 260px, cards 140px wide, info stacks vertically, description hidden, Watch Film btn full-width.

---

## What Is Not Changed

- `EtherealCarousel` class — untouched
- Portfolio section — untouched
- Video modal (HLS player, keyboard shortcuts, skip controls) — untouched
- Filter pills (`.vw-filters`) — untouched
- All 18 `.vw-card` grid items — untouched
- `filterVideos()` function — untouched

---

## Files Modified

| File | Change |
|------|--------|
| `index.html` | Add `#videoFocusRail` block + `.vfr-divider` before `.vw-filters` |
| `Script.js` | Append `VideoFocusRail` class; instantiate after DOMContentLoaded |
| `styles.css` | Append Video FocusRail styles after existing `.vw-*` rules |

---

## Out of Scope

- Deploying `gallery-preview` Next.js project
- Porting FocusRail to other sections (portfolio, couple portraits)
- Adding descriptions to video cards that currently lack them
- Changing the video modal UI
