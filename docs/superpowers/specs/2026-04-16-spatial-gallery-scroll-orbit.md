# Spatial Gallery — Scroll-Orbit Animation

**Date:** 2026-04-16
**File:** `animation_spatial_gallery.html`
**Status:** Approved, ready for implementation

---

## Overview

The gallery cards are arranged in a diagonal spiral ("/" axis) and orbit around a virtual vertical pole driven by touchpad scroll. Scroll is hijacked while the orbit is active. When the last card reaches centre, the hijack releases and the page continues to the next section.

---

## Interaction Model

### Scroll Hijack

- Listen to `wheel` events on `window` with `{ passive: false }`.
- Call `e.preventDefault()` to suppress native page scroll.
- Accumulate `e.deltaY * SENSITIVITY` into a `targetProgress` value.
- `targetProgress` is clamped to `[0, NUM_CARDS − 1]` = `[0, 4]`.

### Scroll Release

Two release conditions (checked before clamping):

| Condition | Action |
|-----------|--------|
| `progress >= 4.0` and `deltaY > 0` | Release hijack — page scrolls forward |
| `progress <= 0.0` and `deltaY < 0` | Release hijack — page scrolls backward |

A boolean `scrollLocked` flag gates the hijack. Set to `true` on load. Set to `false` when a release condition fires.

**Re-lock rule:** When `scrollLocked = false`, check the incoming `deltaY` direction on each `wheel` event:

- If `progress >= 4` and `deltaY < 0` → re-lock, consume the event
- If `progress <= 0` and `deltaY > 0` → re-lock, consume the event

This allows the user to scroll back into the gallery from the next/previous section.

### Progress → Card Position

Each card's **slot offset** = `cardIndex − lerpedProgress`.

- `lerpedProgress` chases `targetProgress` at lerp factor `0.07` per frame.
- No snap — progress stops exactly where the scroll leaves it.
- Slot offset is a float; positions are interpolated between adjacent slots.

---

## Slot Positions

9 named slots indexed `−4` through `+4` (array index = `slotOffset + 4`).

| Slot | tx (vw) | ty (%) | tz (px) | ry (deg) | scale | opacity | Role |
|------|---------|--------|---------|----------|-------|---------|------|
| −4 | 2 | −230 | −850 | 0 | 0.70 | 0.30 | Upper-left, furthest |
| −3 | −24 | −200 | −1400 | 38 | 0.75 | 0.42 | Upper-left |
| −2 | −47 | −175 | −1680 | −110 | 0.82 | 0.55 | Upper-left |
| −1 | −30 | −65 | −500 | −55 | 0.88 | 0.78 | Just above centre |
| **0** | **0** | **−25** | **0** | **0** | **1.18** | **1.00** | **Featured / centre** |
| +1 | 30 | 15 | −500 | 55 | 0.88 | 0.78 | Just below centre |
| +2 | 47 | 125 | −1680 | 110 | 0.82 | 0.55 | Lower-right |
| +3 | 24 | 150 | −1400 | −38 | 0.75 | 0.42 | Lower-right |
| +4 | −2 | 180 | −850 | 0 | 0.70 | 0.30 | Lower-right, furthest |

Interpolation between adjacent slots is linear (`lerp(a, b, t)` where `t = fractional part of array index`).

Transform applied per card:
```
translateX({tx}vw)
translateY({ty}%)
translateZ({tz}px)
rotateY({ry}deg)
scale({sc})
```

Z-ordering via CSS `transform-style: preserve-3d` on `.helix-field` — no manual `z-index` needed.

---

## Entry Animation

1. Place all cards at their `progress = 0` positions, `opacity: 0`.
2. After 220ms: add `transition: opacity 700ms ease` to each card.
3. Fade each card in with a 110ms stagger (card 0 first, card 4 last).
4. After the last fade completes (~220 + 4×110 + 700 + 80ms = ~1440ms total): strip transitions, start the render loop, activate scroll hijack.

### `prefers-reduced-motion`

Skip steps 1–4. Place cards directly at positions, start render loop immediately.

---

## CSS Changes Required

Remove the full-screen override for card 0:
```css
/* DELETE this entire block */
.gallery-card[style*="--i:0"] { … }
```

Remove the `.is-ready` transition block (no longer used):
```css
/* DELETE this block */
.helix-field.is-ready .gallery-card { … }
```

`.gallery-stage` pointer-events is already `none` — no change needed (scroll is captured on `window`).

Update `.study-meta` hint text from "Move cursor to explore" → "Scroll to explore".

---

## Scroll Sensitivity

`SENSITIVITY = 0.005` — meaning a deltaY of 200 advances progress by 1 card. Tunable constant at the top of the script.

---

## Files Changed

| File | Change |
|------|--------|
| `animation_spatial_gallery.html` | Full JS rewrite + CSS cleanup |

No other files affected.
