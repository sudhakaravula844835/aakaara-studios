# Spatial Gallery Orbit Exit Fade Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Apply progressive opacity falloff to the four negative slots in the SLOTS array so post-featured cards fade out instead of sliding visibly through the orbit.

**Architecture:** Single array edit in `animation_spatial_gallery.html`. The existing `lerp` interpolation in `slotProps()` handles smooth opacity transitions automatically — no JS logic changes required. Only the four `op` values for slots −4 through −1 change; all geometry and positive-slot values are untouched.

**Tech Stack:** Vanilla JS, static HTML. No build step. Test by loading in a browser via a local static server.

---

### Task 1: Edit the SLOTS array opacity values

**Files:**
- Modify: `animation_spatial_gallery.html` (lines 274–277 — the four negative slots)

- [ ] **Step 1: Open the file and locate the SLOTS array**

  In `animation_spatial_gallery.html`, find the `var SLOTS = [` declaration (around line 273). Confirm the current `op` values are all `1.00` for slots −4 through −1.

- [ ] **Step 2: Replace the four negative-slot `op` values**

  Change lines 274–277 from:

  ```js
  var SLOTS = [
    { tx:   0, ty: -230, tz:  -850, ry: -165, sc: 1.00, op: 1.00 }, // −4
    { tx: -24, ty: -200, tz: -1400, ry: -140, sc: 1.00, op: 1.00 }, // −3
    { tx: -55, ty: -175, tz: -1500, ry: -110, sc: 1.00, op: 1.00 }, // −2
    { tx: -30, ty:  -65, tz:  -500, ry:  -55, sc: 1.00, op: 1.00 }, // −1
  ```

  To:

  ```js
  var SLOTS = [
    { tx:   0, ty: -230, tz:  -850, ry: -165, sc: 1.00, op: 0.00 }, // −4
    { tx: -24, ty: -200, tz: -1400, ry: -140, sc: 1.00, op: 0.03 }, // −3
    { tx: -55, ty: -175, tz: -1500, ry: -110, sc: 1.00, op: 0.15 }, // −2
    { tx: -30, ty:  -65, tz:  -500, ry:  -55, sc: 1.00, op: 0.50 }, // −1
  ```

  Leave slots 0 through +4 exactly as-is (`op: 1.00`).

- [ ] **Step 3: Verify the full SLOTS array looks correct**

  After the edit the complete array should be:

  ```js
  var SLOTS = [
    { tx:   0, ty: -230, tz:  -850, ry: -165, sc: 1.00, op: 0.00 }, // −4
    { tx: -24, ty: -200, tz: -1400, ry: -140, sc: 1.00, op: 0.03 }, // −3
    { tx: -55, ty: -175, tz: -1500, ry: -110, sc: 1.00, op: 0.15 }, // −2
    { tx: -30, ty:  -65, tz:  -500, ry:  -55, sc: 1.00, op: 0.50 }, // −1
    { tx:   0, ty:  -25, tz:     0, ry:    0, sc: 1.00, op: 1.00 }, //  0 FEATURED
    { tx:  30, ty:   15, tz:  -500, ry:   55, sc: 1.00, op: 1.00 }, // +1
    { tx:  47, ty:  125, tz: -1680, ry:  110, sc: 1.00, op: 1.00 }, // +2
    { tx:  24, ty:  150, tz: -1400, ry:  140, sc: 1.00, op: 1.00 }, // +3
    { tx:   0, ty:  180, tz:  -850, ry:  165, sc: 1.00, op: 1.00 }, // +4
  ];
  ```

- [ ] **Step 4: Load in browser and verify visually**

  ```bash
  npx serve .
  # Open http://localhost:3000/animation_spatial_gallery.html
  ```

  Scroll through the gallery. Confirm:
  - Card entering from below (positive slots): fully visible, no change
  - Card at featured (slot 0): fully visible, no change
  - Card just leaving featured (slot −1): visible at ~50% — orbit still feels populated
  - Card at slot −2: nearly gone (15%)
  - Card at slot −3: trace only (3%)
  - Card at slot −4: invisible (0%)
  - Transitions between all slots are smooth (lerp handles this automatically)

- [ ] **Step 5: Commit**

  ```bash
  git add animation_spatial_gallery.html
  git commit -m "fix(gallery): fade post-featured cards — soft opacity falloff on exit slots"
  ```
