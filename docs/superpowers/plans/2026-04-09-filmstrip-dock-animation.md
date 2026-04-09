# Filmstrip Dock Animation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the broken quadratic-falloff dock animation with the authentic macOS cosine magnification + RAF lerp interpolation so the filmstrip effect works consistently on every gallery open.

**Architecture:** Two file changes: (1) remove `transform` from the CSS hover transition so JS owns animation exclusively, (2) rewrite the dock JS block in `Script.js` to use cosine magnification with a lerp RAF loop, and move listener attachment into `renderSwStrip()` so it re-fires on every gallery open instead of only once at IIFE init.

**Tech Stack:** Vanilla JS (ES6), CSS3. No new dependencies.

---

## Root Cause

The dock listeners are attached once at IIFE init time (Script.js lines 695-696) and removed in `closeSwGallery`. After the first gallery is closed, the listeners are **never re-added**, so the dock is silently dead for every subsequent gallery. The quadratic algorithm and instant scale changes (no lerp) also produce mechanical, inconsistent feel.

---

## File Map

| File | Change |
|------|--------|
| `styles.css:2337` | Remove `transform 0.14s` from the hover transition list |
| `Script.js:447-449` | Add 4 new dock state variables after existing state vars |
| `Script.js:550-563` | `renderSwStrip()` — reset scale arrays and re-attach dock listeners |
| `Script.js:575-579` | `closeSwGallery()` — cancel RAF before clearing strip |
| `Script.js:678-697` | Replace entire dock block with cosine + RAF lerp implementation |

---

## Task 1: Remove CSS `transform` transition (JS owns animation now)

**Files:**
- Modify: `styles.css:2337`

- [ ] **Step 1: Edit styles.css line 2337**

Find this exact line:
```css
.sw-gallery-strip:hover .sw-strip-thumb { transition: transform 0.14s cubic-bezier(0.22, 1, 0.36, 1), width 0.4s cubic-bezier(0.16,1,0.3,1), border-color 0.4s, box-shadow 0.4s; }
```

Replace with:
```css
.sw-gallery-strip:hover .sw-strip-thumb { transition: width 0.4s cubic-bezier(0.16,1,0.3,1), border-color 0.4s, box-shadow 0.4s; }
```

`transform-origin: bottom center` and `will-change: transform` on `.sw-strip-thumb` stay unchanged. The `@media (hover: none)` block stays unchanged.

- [ ] **Step 2: Commit**

```bash
cd "/Users/sudhakaravula/Desktop/logo/files new version  draft 1/aakaara-site-v2"
git add styles.css
git commit -m "style: remove CSS transform transition from filmstrip thumbs — JS owns dock animation"
```

---

## Task 2: Add dock state variables

**Files:**
- Modify: `Script.js:447-449`

- [ ] **Step 1: Edit Script.js lines 447-449**

Find these three lines (inside the gallery viewer IIFE):
```js
  let swImages = [], swIndex = 0, swIsOpen = false, swParafRAF = null, lastFocusedElement = null;
  let stripThumbCache = [];
  let dockMouseMoveFn = null, dockMouseLeaveFn = null;
```

Replace with (one new line appended):
```js
  let swImages = [], swIndex = 0, swIsOpen = false, swParafRAF = null, lastFocusedElement = null;
  let stripThumbCache = [];
  let dockMouseMoveFn = null, dockMouseLeaveFn = null;
  let dockCurrentScales = [], dockTargetScales = [], dockRAF = null, dockRAFRunning = false, dockLerp = 0.18;
```

- [ ] **Step 2: Commit**

```bash
git add Script.js
git commit -m "refactor: add dock RAF state variables to gallery viewer IIFE"
```

---

## Task 3: Replace the dock algorithm block

**Files:**
- Modify: `Script.js:678-697`

- [ ] **Step 1: Edit Script.js — replace lines 678-697**

Find this exact block:
```js
  // Mac Dock Effect for Filmstrip — desktop/pointer only
  if (galleryStrip && !window.matchMedia('(hover: none)').matches) {
    const RADIUS = 120, MAX_BOOST = 0.9;
    dockMouseMoveFn = (e) => {
      const mx = e.clientX;
      stripThumbCache.forEach(thumb => {
        const rect = thumb.getBoundingClientRect();
        const cx = rect.left + rect.width / 2;
        const dist = Math.abs(mx - cx);
        // Gaussian-style falloff: max scale 1.9, influence radius 120px
        const scale = dist < RADIUS ? 1 + MAX_BOOST * Math.pow(1 - dist / RADIUS, 2) : 1;
        thumb.style.transform = `scale(${scale.toFixed(3)})`;
      });
    };
    dockMouseLeaveFn = () => {
      stripThumbCache.forEach(thumb => { thumb.style.transform = ''; });
    };
    galleryStrip.addEventListener('mousemove', dockMouseMoveFn);
    galleryStrip.addEventListener('mouseleave', dockMouseLeaveFn);
  }
```

Replace with:
```js
  // Mac Dock Effect for Filmstrip — desktop/pointer only
  // Listeners are re-attached in renderSwStrip() on every gallery open
  if (galleryStrip && !window.matchMedia('(hover: none)').matches) {
    const EFFECT_WIDTH = 240, MAX_SCALE = 1.85, MIN_SCALE = 1.0;

    function dockTick() {
      let settled = true;
      stripThumbCache.forEach((thumb, i) => {
        const diff = dockTargetScales[i] - dockCurrentScales[i];
        if (Math.abs(diff) > 0.002) {
          dockCurrentScales[i] += diff * dockLerp;
          settled = false;
        } else {
          dockCurrentScales[i] = dockTargetScales[i];
        }
        thumb.style.transform = `scale(${dockCurrentScales[i].toFixed(4)})`;
      });
      if (!settled) {
        dockRAF = requestAnimationFrame(dockTick);
      } else {
        dockRAFRunning = false;
        dockRAF = null;
      }
    }

    dockMouseMoveFn = (e) => {
      const stripRect = galleryStrip.getBoundingClientRect();
      const mouseRelX = e.clientX - stripRect.left;
      stripThumbCache.forEach((thumb, i) => {
        const thumbRect = thumb.getBoundingClientRect();
        const thumbCenterX = thumbRect.left - stripRect.left + thumbRect.width / 2;
        const minX = mouseRelX - EFFECT_WIDTH / 2;
        const maxX = mouseRelX + EFFECT_WIDTH / 2;
        if (thumbCenterX >= minX && thumbCenterX <= maxX) {
          const theta = ((thumbCenterX - minX) / EFFECT_WIDTH) * 2 * Math.PI;
          const scaleFactor = (1 - Math.cos(theta)) / 2;
          dockTargetScales[i] = MIN_SCALE + scaleFactor * (MAX_SCALE - MIN_SCALE);
        } else {
          dockTargetScales[i] = MIN_SCALE;
        }
      });
      dockLerp = 0.18;
      if (!dockRAFRunning) {
        dockRAFRunning = true;
        dockRAF = requestAnimationFrame(dockTick);
      }
    };

    dockMouseLeaveFn = () => {
      dockTargetScales = dockTargetScales.map(() => MIN_SCALE);
      dockLerp = 0.10;
      if (!dockRAFRunning) {
        dockRAFRunning = true;
        dockRAF = requestAnimationFrame(dockTick);
      }
    };
  }
```

The `galleryStrip.addEventListener` calls from the old block are **intentionally removed** — listener attachment now lives in `renderSwStrip()` (Task 4).

- [ ] **Step 2: Commit**

```bash
git add Script.js
git commit -m "feat: replace filmstrip dock with cosine magnification + RAF lerp animation"
```

---

## Task 4: Re-attach dock listeners on every gallery open

**Files:**
- Modify: `Script.js:550-563` (`renderSwStrip` function)

This is the root cause fix. Listeners must be attached in `renderSwStrip`, not at IIFE init, so they survive close/re-open cycles.

- [ ] **Step 1: Edit Script.js — add to the end of `renderSwStrip()`**

Find the closing section of `renderSwStrip` — it ends like this:
```js
    stripThumbCache.forEach(thumb => {
      thumb.addEventListener('click', () => {
        swIndex = parseInt(thumb.dataset.idx, 10);
        renderSwImage(swIndex, false);
      });
    });
  }
```

Replace with:
```js
    stripThumbCache.forEach(thumb => {
      thumb.addEventListener('click', () => {
        swIndex = parseInt(thumb.dataset.idx, 10);
        renderSwImage(swIndex, false);
      });
    });

    // Reset dock scale state for fresh strip, then re-attach listeners.
    // Re-attachment is needed because closeSwGallery removes listeners on every close.
    dockCurrentScales = stripThumbCache.map(() => 1.0);
    dockTargetScales  = stripThumbCache.map(() => 1.0);
    if (dockMouseMoveFn) {
      galleryStrip.removeEventListener('mousemove',  dockMouseMoveFn);
      galleryStrip.removeEventListener('mouseleave', dockMouseLeaveFn);
      galleryStrip.addEventListener('mousemove',  dockMouseMoveFn);
      galleryStrip.addEventListener('mouseleave', dockMouseLeaveFn);
    }
  }
```

The `removeEventListener` calls before `addEventListener` are defensive — they prevent duplicate listeners if `renderSwStrip` were ever called twice without a close in between.

- [ ] **Step 2: Commit**

```bash
git add Script.js
git commit -m "fix: re-attach dock listeners in renderSwStrip so effect works on every gallery open"
```

---

## Task 5: Cancel RAF on gallery close

**Files:**
- Modify: `Script.js:575-579` (`closeSwGallery` cleanup function)

Prevent a ghost RAF loop running after the gallery closes.

- [ ] **Step 1: Edit Script.js — add RAF cancel at the start of the `cleanup()` block inside `closeSwGallery`**

Find this section inside the `cleanup` function:
```js
      if (galleryStrip) {
        galleryStrip.innerHTML = '';
        if (dockMouseMoveFn)  { galleryStrip.removeEventListener('mousemove',  dockMouseMoveFn);  }
        if (dockMouseLeaveFn) { galleryStrip.removeEventListener('mouseleave', dockMouseLeaveFn); }
      }
      stripThumbCache = [];
```

Add one line **before** the `if (galleryStrip)` block:
```js
      if (dockRAF) { cancelAnimationFrame(dockRAF); dockRAF = null; dockRAFRunning = false; }
      if (galleryStrip) {
        galleryStrip.innerHTML = '';
        if (dockMouseMoveFn)  { galleryStrip.removeEventListener('mousemove',  dockMouseMoveFn);  }
        if (dockMouseLeaveFn) { galleryStrip.removeEventListener('mouseleave', dockMouseLeaveFn); }
      }
      stripThumbCache = [];
```

- [ ] **Step 2: Commit**

```bash
git add Script.js
git commit -m "fix: cancel dock RAF loop when gallery closes to prevent ghost animation"
```

---

## Task 6: Manual verification

No automated test is practical for a `requestAnimationFrame` + `mousemove` interaction against live DOM. Verify manually.

- [ ] **Step 1: Start local server**

```bash
cd "/Users/sudhakaravula/Desktop/logo/files new version  draft 1/aakaara-site-v2"
npx serve .
```

Open `http://localhost:3000` (or the port `serve` reports).

- [ ] **Step 2: Verify dock works on first gallery open**

1. Click any gallery item (e.g. Abhinav & Megha)
2. Move cursor slowly across the filmstrip at the bottom
3. Expected: thumbnails under the cursor grow **upward** smoothly; neighbours lift proportionally in a bell curve; the effect follows the cursor with slight physical lag

- [ ] **Step 3: Verify dock works after close/re-open (original bug)**

1. Close the gallery (X or Escape)
2. Open a different gallery (e.g. Nicoli - Graduation)
3. Move cursor across the filmstrip
4. Expected: dock effect works the same as Step 2

- [ ] **Step 4: Verify multiple roundtrips**

Open and close 4-5 different galleries in sequence, testing filmstrip hover each time. Expected: consistent dock animation every time.

- [ ] **Step 5: Verify mobile is unaffected**

Open DevTools → toggle device toolbar (mobile emulation). Open any gallery. Expected: no scale animation, thumbs stay flat, tapping still changes image.

- [ ] **Step 6: Verify active thumb behaviour**

While dock animation is running, click a thumbnail. Expected: it becomes active (wider, rose border, full colour) and the main image changes. The dock animation continues to work after clicking.
