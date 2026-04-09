# Filmstrip Dock Animation — Design Spec
**Date:** 2026-04-09  
**Status:** Approved

## Problem

The filmstrip dock animation in the Framed Stories gallery viewer is inconsistent and mechanical:
- Influence radius is only 120px — too tight, too few thumbs lift at once
- Quadratic falloff (`pow(1 - dist/radius, 2)`) doesn't match the authentic macOS curve
- Scale changes are instant — CSS `0.14s` transition does all smoothing, producing a lag that doesn't feel physical
- Mouse position uses absolute `clientX` instead of relative position within the strip container

## Goal

Replace the current implementation with the authentic macOS cosine magnification algorithm + RAF lerp interpolation, desktop-only, growing thumbnails upward from `bottom center`. Matches the feel of the reference React component provided by the user, ported to vanilla JS.

---

## Section 1: Algorithm & Parameters

**Cosine magnification (authentic macOS formula):**

```
effectWidth = 240px       // influence zone half-width on each side of cursor
maxScale    = 1.85        // peak scale at cursor center
minScale    = 1.0         // resting scale

mouseRelX = e.clientX - strip.getBoundingClientRect().left

for each thumb:
  thumbCenterX = thumb.offsetLeft + thumb.offsetWidth / 2
  minX = mouseRelX - effectWidth / 2
  maxX = mouseRelX + effectWidth / 2

  if thumbCenterX in [minX, maxX]:
    theta = ((thumbCenterX - minX) / effectWidth) * 2π
    scaleFactor = (1 - cos(theta)) / 2        // smooth bell: 0 → 1 → 0
    targetScale = minScale + scaleFactor * (maxScale - minScale)
  else:
    targetScale = minScale
```

The cosine bell produces a smooth, symmetric lift. Thumbs at the edges of the influence zone get a gentle lift; the thumb directly under the cursor reaches full `1.85×`. No hard cutoff artifacts.

---

## Section 2: RAF Lerp Loop

A `requestAnimationFrame` loop smoothly chases target scales each frame.

**State variables (inside the dock block of the IIFE):**
- `currentScales[]` — one float per thumb, initialized to `1.0`
- `targetScales[]` — recalculated on every `mousemove`
- `dockRAF` — RAF handle (number), used to cancel on close
- `dockRAFRunning` — boolean flag, prevents duplicate RAF scheduling
- `dockLerp` — current lerp factor (`0.18` on hover, `0.10` on leave)

**Loop logic:**
```
function dockTick() {
  let settled = true;
  stripThumbCache.forEach((thumb, i) => {
    const diff = targetScales[i] - currentScales[i];
    if (Math.abs(diff) > 0.002) {
      currentScales[i] += diff * dockLerp;
      settled = false;
    } else {
      currentScales[i] = targetScales[i];
    }
    thumb.style.transform = `scale(${currentScales[i].toFixed(4)})`;
  });
  if (!settled) {
    dockRAF = requestAnimationFrame(dockTick);
  } else {
    dockRAFRunning = false;
  }
}
```

**On `mousemove`:** recalculate `targetScales[]`, set `dockLerp = 0.18`, start RAF if not running.  
**On `mouseleave`:** set all `targetScales[i] = 1.0`, set `dockLerp = 0.10`, RAF winds down naturally.

`transform-origin: bottom center` is already set in CSS — thumbnails grow upward.

---

## Section 3: Integration Points

### `Script.js` changes

| Location | Change |
|---|---|
| Dock block vars | Add `currentScales`, `targetScales`, `dockRAF`, `dockRAFRunning`, `dockLerp` |
| `dockMouseMoveFn` body | Replace quadratic calc with cosine + RAF start |
| `dockMouseLeaveFn` body | Set all targets to 1.0, slow lerp, RAF continues to settle |
| `renderSwStrip()` | After populating `stripThumbCache`, reset both scale arrays to `1.0 × length` |
| `closeSwGallery()` | Add `cancelAnimationFrame(dockRAF)` alongside existing listener removal |

### `styles.css` changes

Line ~2337 — remove `transform` from the transition list:

**Before:**
```css
.sw-gallery-strip:hover .sw-strip-thumb {
  transition: transform 0.14s cubic-bezier(0.22, 1, 0.36, 1),
              width 0.4s cubic-bezier(0.16,1,0.3,1),
              border-color 0.4s, box-shadow 0.4s;
}
```

**After:**
```css
.sw-gallery-strip:hover .sw-strip-thumb {
  transition: width 0.4s cubic-bezier(0.16,1,0.3,1),
              border-color 0.4s, box-shadow 0.4s;
}
```

JS fully owns `transform`. All other transitions stay.

### No changes to:
- The `matchMedia('(hover: none)')` desktop guard
- Named listener ref pattern (`dockMouseMoveFn` / `dockMouseLeaveFn`)
- `@media (hover: none)` CSS block
- Thumb size, active state, or any other gallery logic

---

## Out of Scope
- Mobile/touch devices — dock effect stays disabled
- Vertical position shifting of the strip itself
- Any other gallery component (carousel, nav buttons, etc.)
