# Spatial Gallery Scroll-Orbit Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the static Palmer-layout with a scroll-hijacked orbit animation where cards rotate around a virtual vertical pole along a diagonal "/" spiral path, each card becoming featured (enlarged, centred) as it passes through slot 0.

**Architecture:** Single HTML file (`animation_spatial_gallery.html`). CSS is cleaned up (two stale blocks removed). The JS IIFE is fully replaced with a SLOTS-based position system, a `requestAnimationFrame` render loop, and a `wheel` event hijack with explicit re-lock logic. No build step, no dependencies.

**Tech Stack:** Vanilla JS (ES5-compatible IIFE), CSS 3D transforms (`transform-style: preserve-3d`, `perspective`), `wheel` event API.

**Spec:** `docs/superpowers/specs/2026-04-16-spatial-gallery-scroll-orbit.md`

---

### Task 1: CSS Cleanup

**Files:**
- Modify: `animation_spatial_gallery.html` (CSS section, lines ~145–150 and ~226–242)

- [ ] **Step 1: Remove the `.helix-field.is-ready .gallery-card` transition block**

In `animation_spatial_gallery.html`, delete this entire CSS block:

```css
.helix-field.is-ready .gallery-card {
  transition-property: transform, opacity;
  transition-duration: 900ms, 700ms;
  transition-timing-function: var(--ease), ease;
  transition-delay: calc(var(--i) * 80ms);
}
```

Transitions are now managed entirely in JS during entry animation only — no persistent CSS transition needed.

- [ ] **Step 2: Remove the card-0 full-screen override block**

Delete this entire CSS block:

```css
/* Style override for the first card */
.gallery-card[style*="--i:0"] {
  cursor: auto;
  width: 100%;
  height: 100%;
  top: 0;
  left: 0;
  margin: 0;
  border-radius: 0;
  display: block;
  object-fit: cover;
  background-color: rgba(0, 0, 0, 0);
  object-position: 50% 50%;
  border: none;
  box-shadow: none;
}
```

Card 0 is now a regular card — it orbits like the others.

- [ ] **Step 3: Update the hint text**

Change:
```html
<div class="study-meta">Move cursor to explore</div>
```
To:
```html
<div class="study-meta">Scroll to explore</div>
```

- [ ] **Step 4: Commit**

```bash
git add animation_spatial_gallery.html
git commit -m "chore(gallery): remove stale CSS — card-0 override and is-ready transition"
```

---

### Task 2: Replace the JS IIFE — Core Helpers and SLOTS

**Files:**
- Modify: `animation_spatial_gallery.html` (entire `<script>` block)

- [ ] **Step 1: Replace the entire `<script>…</script>` block** with the skeleton below. This step adds only the SLOTS data and helpers — later tasks fill in the rest.

```html
<script>
(function () {
  'use strict';

  /* ─── Slot positions ──────────────────────────────────────────────
     9 slots: −4 (upper-left past) → 0 (featured centre) → +4 (lower-right future).
     Array index = slotOffset + 4.
     tx  : lateral offset in vw  (positive = right)
     ty  : vertical offset in %  (of card's own height, positive = down)
     tz  : depth in px (negative = further from viewer)
     ry  : Y-axis rotation in degrees
     sc  : scale
     op  : opacity
  ──────────────────────────────────────────────────────────────── */
  var SLOTS = [
    { tx:   2, ty: -230, tz:  -850, ry:   0, sc: 0.70, op: 0.30 }, // −4
    { tx: -24, ty: -200, tz: -1400, ry:  38, sc: 0.75, op: 0.42 }, // −3
    { tx: -47, ty: -175, tz: -1680, ry: -110,sc: 0.82, op: 0.55 }, // −2
    { tx: -30, ty:  -65, tz:  -500, ry: -55, sc: 0.88, op: 0.78 }, // −1
    { tx:   0, ty:  -25, tz:     0, ry:   0, sc: 1.18, op: 1.00 }, //  0 FEATURED
    { tx:  30, ty:   15, tz:  -500, ry:  55, sc: 0.88, op: 0.78 }, // +1
    { tx:  47, ty:  125, tz: -1680, ry: 110, sc: 0.82, op: 0.55 }, // +2
    { tx:  24, ty:  150, tz: -1400, ry: -38, sc: 0.75, op: 0.42 }, // +3
    { tx:  -2, ty:  180, tz:  -850, ry:   0, sc: 0.70, op: 0.30 }, // +4
  ];

  /* ─── Helpers ─────────────────────────────────────────────────── */
  function lerp(a, b, t) { return a + (b - a) * t; }

  function slotProps(slotOffset) {
    var clamped = Math.max(-4, Math.min(4, slotOffset));
    var idx     = clamped + 4;          // 0–8
    var lo      = Math.floor(idx);
    var hi      = Math.min(8, lo + 1);
    var t       = idx - lo;
    var A = SLOTS[lo], B = SLOTS[hi];
    return {
      tx: lerp(A.tx, B.tx, t),
      ty: lerp(A.ty, B.ty, t),
      tz: lerp(A.tz, B.tz, t),
      ry: lerp(A.ry, B.ry, t),
      sc: lerp(A.sc, B.sc, t),
      op: lerp(A.op, B.op, t),
    };
  }

  function buildTransform(p) {
    return (
      'translateX(' + p.tx.toFixed(2) + 'vw) ' +
      'translateY(' + p.ty.toFixed(2) + '%) ' +
      'translateZ(' + p.tz.toFixed(0) + 'px) ' +
      'rotateY('    + p.ry.toFixed(1) + 'deg) ' +
      'scale('      + p.sc.toFixed(4) + ')'
    );
  }

  /* ─── DOM refs ────────────────────────────────────────────────── */
  var field = document.getElementById('helixField');
  var cards = Array.prototype.slice.call(
    field.querySelectorAll('.gallery-card')
  );
  var NUM_CARDS    = cards.length;   // 5
  var MAX_PROGRESS = NUM_CARDS - 1;  // 4

  /* PLACEHOLDER: render loop (Task 3) */
  /* PLACEHOLDER: scroll hijack (Task 3) */
  /* PLACEHOLDER: entry animation + boot (Task 4) */

})();
</script>
```

- [ ] **Step 2: Open `http://localhost:8080/animation_spatial_gallery.html` (or equivalent static server) and confirm the page loads without JS errors.** Cards may appear stacked at centre — that is expected at this stage.

- [ ] **Step 3: Commit**

```bash
git add animation_spatial_gallery.html
git commit -m "feat(gallery): add SLOTS data and transform helpers"
```

---

### Task 3: Render Loop + Scroll Hijack

**Files:**
- Modify: `animation_spatial_gallery.html` (inside the IIFE, replacing the PLACEHOLDER comments)

- [ ] **Step 1: Replace `/* PLACEHOLDER: render loop (Task 3) */` with:**

```javascript
  /* ─── Progress state ─────────────────────────────────────────── */
  var SENSITIVITY    = 0.005;   // deltaY of 200 → advance 1 card
  var targetProgress = 0;
  var lerpedProgress = 0;
  var scrollLocked   = true;    // true = hijack active

  /* ─── Render ──────────────────────────────────────────────────── */
  function applyFrame() {
    cards.forEach(function (card, i) {
      var offset = i - lerpedProgress;
      var p      = slotProps(offset);
      card.style.transform = buildTransform(p);
      card.style.opacity   = p.op.toFixed(3);
      card.style.zIndex    = String(Math.round(10 - Math.abs(offset)));
    });
  }

  var rafId = null;
  function tick() {
    lerpedProgress += (targetProgress - lerpedProgress) * 0.07;
    applyFrame();
    rafId = requestAnimationFrame(tick);
  }
```

- [ ] **Step 2: Replace `/* PLACEHOLDER: scroll hijack (Task 3) */` with:**

```javascript
  /* ─── Scroll hijack ───────────────────────────────────────────── */
  window.addEventListener('wheel', function (e) {
    var dy = e.deltaY;

    if (!scrollLocked) {
      // Re-lock if user scrolls back into the orbit range
      if (targetProgress >= MAX_PROGRESS && dy < 0) {
        scrollLocked = true;
      } else if (targetProgress <= 0 && dy > 0) {
        scrollLocked = true;
      } else {
        return; // still unlocked — let page scroll
      }
    }

    // Release when orbit is complete
    if (targetProgress >= MAX_PROGRESS && dy > 0) {
      scrollLocked = false;
      return;
    }
    if (targetProgress <= 0 && dy < 0) {
      scrollLocked = false;
      return;
    }

    e.preventDefault();
    targetProgress = Math.max(0, Math.min(MAX_PROGRESS,
      targetProgress + dy * SENSITIVITY));
  }, { passive: false });
```

- [ ] **Step 3: Reload the page. Scroll down — cards should orbit but the page should NOT scroll. Scroll past card 5 — the page should resume scrolling normally. Scroll back up into the gallery — the orbit should re-lock.**

- [ ] **Step 4: Commit**

```bash
git add animation_spatial_gallery.html
git commit -m "feat(gallery): render loop and scroll hijack with release/re-lock logic"
```

---

### Task 4: Entry Animation + Boot

**Files:**
- Modify: `animation_spatial_gallery.html` (inside the IIFE, replacing the final PLACEHOLDER)

- [ ] **Step 1: Replace `/* PLACEHOLDER: entry animation + boot (Task 4) */` with:**

```javascript
  /* ─── Entry animation ─────────────────────────────────────────── */
  function boot() {
    // 1. Place cards at initial positions, invisible
    cards.forEach(function (card, i) {
      var p = slotProps(i); // progress=0, so slotOffset=i
      card.style.opacity   = '0';
      card.style.transform = buildTransform(p);
    });

    // 2. After short pause, fade each card in with a stagger
    setTimeout(function () {
      cards.forEach(function (card, i) {
        setTimeout(function () {
          card.style.transition = 'opacity 700ms ease';
          card.style.opacity    = slotProps(i).op.toFixed(3);
        }, i * 110);
      });

      // 3. Once all fades complete, strip transitions and start the loop
      // Last card fade starts at (NUM_CARDS-1)*110 ms, lasts 700ms, +80ms buffer
      var loopDelay = 220 + (NUM_CARDS - 1) * 110 + 700 + 80;
      setTimeout(function () {
        cards.forEach(function (card) { card.style.transition = ''; });
        tick();
      }, loopDelay);
    }, 220);
  }

  /* ─── Boot ────────────────────────────────────────────────────── */
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    // Skip entry animation — place cards directly and start loop
    cards.forEach(function (card, i) {
      var p = slotProps(i);
      card.style.opacity   = p.op.toFixed(3);
      card.style.transform = buildTransform(p);
    });
    tick();
  } else {
    boot();
  }
```

- [ ] **Step 2: Reload the page. Confirm the staggered fade-in plays on load (cards appear one by one), then the orbit responds to scroll.**

- [ ] **Step 3: In browser DevTools, run `document.documentElement.style.setProperty('--test', '')` then reload with the media query forced to `prefers-reduced-motion: reduce` (DevTools → Rendering → Emulate CSS media). Cards should appear instantly with no fade.**

- [ ] **Step 4: Commit**

```bash
git add animation_spatial_gallery.html
git commit -m "feat(gallery): staggered entry animation with prefers-reduced-motion fallback"
```

---

### Task 5: Final Visual Verification

**Files:** None changed — verification only.

- [ ] **Step 1: Full orbit flow check**

Open the page on a static server. Scroll through all 5 cards:
- Card 1 starts featured (large, centre), cards 2–5 in lower-right diagonal
- Each scroll advance orbits the next card to centre
- Past cards recede to upper-left diagonal
- Scale and opacity visibly larger/brighter on the featured card vs background cards

- [ ] **Step 2: Scroll release check**

Scroll past card 5 — page should continue scrolling down to the next section. Scroll back up — orbit re-locks and card 5 is still featured.

- [ ] **Step 3: Entry animation check**

Hard-refresh (Cmd+Shift+R). Cards should fade in with a visible stagger (card 1 first, card 5 last ~550ms later).

- [ ] **Step 4: Commit final state**

```bash
git add animation_spatial_gallery.html
git commit -m "feat(gallery): scroll-orbit spatial gallery — diagonal spiral with A+C motion model"
```
