# Spatial 3D Helix Gallery — Design Spec
**Date:** 2026-04-15
**File:** `animation_spatial_gallery.html`
**Status:** Approved — ready for implementation

---

## Overview

Transform the current single-column card stack into a front-facing 3D helix of 6 gallery cards. The leftmost card is closest to the viewer (largest, brightest); each successive card steps further back along the Z-axis, rotating on Y, scaling down, and dimming. The whole field tilts subtly in response to desktop mouse movement, with per-card depth parallax reinforcing the spatial illusion.

---

## 1. Helix Geometry

### Container Setup
- `.gallery-stage` gets `perspective: 1200px`
- A new `.helix-field` div wraps all 6 cards inside `.gallery-stage` — this is the element that mouse parallax rotates
- Cards are `position: absolute` inside `.helix-field`
- `.helix-field` itself is `position: relative; transform-style: preserve-3d`

### Per-Card Transform Table

| Card | translateX | translateY | translateZ | rotateY  | rotateZ | scale | opacity |
|------|-----------|-----------|-----------|----------|---------|-------|---------|
| 1    | -38vw     | +2%       | 0px       | 0°       | -1°     | 1.00  | 1.00    |
| 2    | -20vw     | -6%       | -120px    | -28°     | +1°     | 0.88  | 0.90    |
| 3    | -4vw      | +4%       | -240px    | -54°     | -1.5°   | 0.76  | 0.78    |
| 4    | +12vw     | -4%       | -360px    | -78°     | +1°     | 0.66  | 0.68    |
| 5    | +24vw     | +3%       | -480px    | -100°    | -1°     | 0.57  | 0.60    |
| 6    | +34vw     | -2%       | -580px    | -120°    | +1.5°   | 0.49  | 0.52    |

Each card also receives an inline CSS custom property `--depth` (0.0 for card 1 → 1.0 for card 6) used by the parallax system.

### Card Size
All cards share a fixed size set on `.helix-field .gallery-card`:
- `width: 28rem`
- `aspect-ratio: 1.42`
- Scale is applied via the transform table above, not by changing dimensions

---

## 2. Mouse Parallax — Desktop

### World Tilt (`.helix-field`)
- Mouse position normalized to `[-1, 1]` on both axes relative to viewport center
- Target rotation: `rotateY: mouse.x * 8deg`, `rotateX: mouse.y * -5deg`
- Smoothed each `requestAnimationFrame` tick via `lerp(current, target, 0.06)`
- On `mouseleave`: lerp target resets to `{x: 0, y: 0}` — field drifts back to rest

### Per-Card Depth Parallax
On each RAF tick, each card receives an additional `translateX/Y` nudge beyond its base position:
- `nudgeX = mouse.x * (1 - depth) * 18px` — front card: ±18px, back card: ±4px (linear by `--depth`)
- `nudgeY = mouse.y * (1 - depth) * 10px`
- Combined with the world tilt for a two-layer parallax

### Shine Update
The `.gallery-card__shine` gradient angle is updated each frame:
- Angle derived from `atan2(mouse.y, mouse.x)` — specular highlight tracks cursor as if cards are lit by it
- Applied as a CSS custom property `--shine-angle` on each card

### Activation Gate
Mouse parallax RAF loop only starts after `.helix-field` receives the `.is-ready` class (post entry animation). Prevents jitter during assembly.

---

## 3. Entry Animation

### Sequence
1. On load, all cards start with `opacity: 0`, `scale: 0.85`, at their target `translateX/Y` but with `translateZ: 0` and `rotateY: 0` (collapsed flat)
2. After `200ms` delay, `.is-ready` is added to `.helix-field`
3. Each card transitions to its full helix transform using CSS `transition` with staggered delays:
   - Card 1: `transition-delay: 0ms`
   - Card 2: `transition-delay: 80ms`
   - Card 3: `transition-delay: 160ms`
   - Card 4: `transition-delay: 240ms`
   - Card 5: `transition-delay: 320ms`
   - Card 6: `transition-delay: 400ms`
4. Transition: `transform 900ms var(--ease), opacity 700ms ease` — uses site's existing `--ease` variable
5. After final card's transition completes (~1300ms total), mouse parallax RAF loop activates

### Implementation
- Stagger delays set via inline `style="--i: N"` on each card, CSS reads `calc(var(--i) * 80ms)`
- Entry state applied via a `.before-ready` class on cards, removed when `.is-ready` is added to the parent
- No JS animation loop for entry — pure CSS transitions

---

## 4. Architecture Changes to `animation_spatial_gallery.html`

### HTML Changes
- Wrap all 6 `.gallery-card` articles in a new `<div class="helix-field">` inside `.gallery-stage`
- Add `style="--i: N; --depth: D"` inline vars to each card (N = 0–5, D = 0.0–1.0)
- Remove `.gallery-track` grid wrapper (replaced by absolute positioning)

### CSS Changes
- `.gallery-stage`: add `perspective: 1200px`
- `.helix-field`: `position: relative; width: 100%; height: 100vh; transform-style: preserve-3d`
- `.gallery-card`: switch to `position: absolute; width: 28rem; top: 50%; left: 50%` (centered, then offset by transforms)
- Add `.helix-field.is-ready .gallery-card` transition rule
- Add `.gallery-card.before-ready` collapsed state
- Add `--shine-angle` property to `.gallery-card__shine` gradient

### JS Changes (new `<script>` block in file)
- `initHelix()`: applies base transforms to each card, adds `.before-ready`, schedules `.is-ready` after 200ms
- `startParallax()`: RAF loop with lerp, world tilt + per-card nudge + shine angle update
- `stopParallax()`: cleans up RAF on element removal / visibility change
- Mouse event listeners on `.gallery-stage`

---

## 5. Out of Scope (This Iteration)

- Mobile / touch interaction (deferred)
- Scroll-driven animation
- Click-to-expand or lightbox behavior
- Integration into `index.html` (this spec covers `animation_spatial_gallery.html` only)

---

## Success Criteria

- [ ] 6 cards visibly arranged along a left-to-right receding helix at rest
- [ ] Cursor movement causes the whole field to tilt (±8° Y, ±5° X) with smooth lerp
- [ ] Front cards drift more than back cards on mouse move
- [ ] Shine highlight tracks cursor angle on each card
- [ ] Entry animation assembles the helix from a flat stack over ~1.3s
- [ ] No dependencies added (pure CSS + vanilla JS)
- [ ] `prefers-reduced-motion`: all transforms instant, no animation
