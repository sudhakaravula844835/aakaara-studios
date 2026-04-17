# Spec: Spatial Gallery — Soft Opacity Fade for Post-Featured Cards

**Date:** 2026-04-17  
**File affected:** `animation_spatial_gallery.html`  
**Status:** Approved

---

## Problem

After a card leaves the featured (slot 0) position and enters the negative slots (−1 through −4), it remains fully opaque (`op: 1.00`) while visibly sliding upward-left. Because the exit corridor is the same upper-left region that incoming cards travel through, the viewer cannot distinguish "card leaving" from "card arriving." The result reads as a linear slide, not an orbit.

## Solution

Apply a progressive opacity falloff to the four negative slots only. All geometry (`tx`, `ty`, `tz`, `ry`, `sc`) and all positive-slot values remain unchanged.

## SLOTS Opacity Changes

| Slot | Current `op` | New `op` | Rationale |
|------|-------------|----------|-----------|
| −1   | 1.00        | **0.50** | Half-visible — orbit still feels populated on both sides |
| −2   | 1.00        | **0.15** | Mostly gone |
| −3   | 1.00        | **0.03** | Trace — invisible at a glance |
| −4   | 1.00        | **0.00** | Fully gone |
| 0 → +4 | 1.00    | 1.00     | Unchanged |

## Implementation

Edit the `SLOTS` array in `animation_spatial_gallery.html`:

```js
var SLOTS = [
  { tx:   0, ty: -230, tz:  -850, ry: -165, sc: 1.00, op: 0.00 }, // −4
  { tx: -24, ty: -200, tz: -1400, ry: -140, sc: 1.00, op: 0.03 }, // −3
  { tx: -55, ty: -175, tz: -1500, ry: -110, sc: 1.00, op: 0.15 }, // −2
  { tx: -30, ty:  -65, tz:  -500, ry:  -55, sc: 1.00, op: 0.50 }, // −1
  { tx:   0, ty:  -25, tz:     0, ry:    0, sc: 1.00, op: 1.00 }, //  0  FEATURED
  { tx:  30, ty:   15, tz:  -500, ry:   55, sc: 1.00, op: 1.00 }, // +1
  { tx:  47, ty:  125, tz: -1680, ry:  110, sc: 1.00, op: 1.00 }, // +2
  { tx:  24, ty:  150, tz: -1400, ry:  140, sc: 1.00, op: 1.00 }, // +3
  { tx:   0, ty:  180, tz:  -850, ry:  165, sc: 1.00, op: 1.00 }, // +4
];
```

The existing `lerp` interpolation in `slotProps()` handles smooth opacity transitions between slots automatically — no JS logic changes required.

## Scope

- **4 numbers changed** in the `SLOTS` array
- No geometry changes
- No CSS changes
- No JS logic changes
- No other files touched

## Success Criteria

- Card 1 after leaving featured fades out gracefully rather than sliding visibly upward
- Slot −1 cards remain at 50% opacity — the orbit still feels populated on both sides
- Incoming cards (positive slots) are unaffected and remain fully visible
