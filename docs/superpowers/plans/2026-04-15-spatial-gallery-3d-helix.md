# Spatial 3D Helix Gallery Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform `animation_spatial_gallery.html` from a flat card stack into a front-facing 3D helix of 6 cards with mouse-driven world-tilt parallax and a cinematic entry animation.

**Architecture:** Six cards are absolutely positioned inside a `.helix-field` container using pre-calculated CSS transforms (translateX/Y/Z + rotateY/Z + scale). A vanilla JS RAF loop lerps the field's world rotation toward the mouse position while applying per-card depth nudges. Entry animation uses CSS transitions triggered by a class toggle.

**Tech Stack:** Pure HTML5, CSS3, Vanilla JS (ES6 IIFE) — zero new dependencies.

---

## File Map

| File | Change |
|------|--------|
| `animation_spatial_gallery.html` | All changes — HTML structure, CSS block, new `<script>` block |

---

## Task 1: HTML — Restructure Gallery Markup

**Files:**
- Modify: `animation_spatial_gallery.html` (the `<section class="gallery-stage">` block)

Replace the `.gallery-track` grid wrapper with a `.helix-field` div. Add `--i` (0–5) and `--depth` (0.0–1.0) inline custom properties to each card. Keep all card content (eyebrow, title, subtitle, shine div) exactly as-is.

- [ ] **Step 1: Replace the gallery section HTML**

Find the `<section class="gallery-stage" ...>` block and replace its entire contents with:

```html
<section class="gallery-stage" aria-label="3D spatial gallery study">
  <div class="helix-field" id="helixField">

    <article class="gallery-card is-wide" style="--i:0; --depth:0.0"
      style="background-image:
        linear-gradient(180deg, rgba(12,8,8,0.02), rgba(12,8,8,0.32)),
        url('/images/couple-portraits/karthik-sowmya/1.jpg')">
      <div class="gallery-card__shine"></div>
      <div class="gallery-card__copy">
        <p class="gallery-card__eyebrow">Frame 01</p>
        <h3 class="gallery-card__title">Weddings</h3>
        <p class="gallery-card__subtitle">Grandeur in motion</p>
      </div>
    </article>

    <article class="gallery-card is-tall" style="--i:1; --depth:0.2"
      style="background-image:
        linear-gradient(180deg, rgba(12,8,8,0.03), rgba(12,8,8,0.32)),
        url('/images/couple-portraits/anusha-akshay/2.jpg')">
      <div class="gallery-card__shine"></div>
      <div class="gallery-card__copy">
        <p class="gallery-card__eyebrow">Frame 02</p>
        <h3 class="gallery-card__title">Portraits</h3>
        <p class="gallery-card__subtitle">Soft contrast, held close</p>
      </div>
    </article>

    <article class="gallery-card is-small" style="--i:2; --depth:0.4"
      style="background-image:
        linear-gradient(180deg, rgba(12,8,8,0.04), rgba(12,8,8,0.42)),
        url('/images/couple-portraits/sripad-ritika/2.jpg')">
      <div class="gallery-card__shine"></div>
      <div class="gallery-card__copy">
        <p class="gallery-card__eyebrow">Frame 03</p>
        <h3 class="gallery-card__title">Films</h3>
        <p class="gallery-card__subtitle">Motion after dusk</p>
      </div>
    </article>

    <article class="gallery-card is-medium" style="--i:3; --depth:0.6"
      style="background-image:
        linear-gradient(180deg, rgba(12,8,8,0.03), rgba(12,8,8,0.36)),
        url('/images/couple-portraits/sameeksha-aman/5.jpg')">
      <div class="gallery-card__shine"></div>
      <div class="gallery-card__copy">
        <p class="gallery-card__eyebrow">Frame 04</p>
        <h3 class="gallery-card__title">Editorial</h3>
        <p class="gallery-card__subtitle">Quiet cinematic rhythm</p>
      </div>
    </article>

    <article class="gallery-card is-small" style="--i:4; --depth:0.8"
      style="background-image:
        linear-gradient(180deg, rgba(12,8,8,0.05), rgba(12,8,8,0.42)),
        url('/images/couple-portraits/yogesh-supritha/3.jpg')">
      <div class="gallery-card__shine"></div>
      <div class="gallery-card__copy">
        <p class="gallery-card__eyebrow">Frame 05</p>
        <h3 class="gallery-card__title">Couples</h3>
        <p class="gallery-card__subtitle">Held in warmth</p>
      </div>
    </article>

    <article class="gallery-card is-tiny" style="--i:5; --depth:1.0"
      style="background-image:
        linear-gradient(180deg, rgba(12,8,8,0.05), rgba(12,8,8,0.44)),
        url('/images/couple-portraits/suprith-pragnya/1.jpg')">
      <div class="gallery-card__shine"></div>
      <div class="gallery-card__copy">
        <p class="gallery-card__eyebrow">Frame 06</p>
        <h3 class="gallery-card__title">Events</h3>
        <p class="gallery-card__subtitle">Echo at the edge</p>
      </div>
    </article>

  </div>
</section>
```

> **Note:** HTML does not allow two `style` attributes on the same element. In Step 1 above the custom properties (`--i`, `--depth`) and the `background-image` must be merged into a single `style` attribute per card. The correct merged form for card 1 is:
> ```html
> <article class="gallery-card is-wide"
>   style="--i:0; --depth:0.0; background-image: linear-gradient(180deg, rgba(12,8,8,0.02), rgba(12,8,8,0.32)), url('/images/couple-portraits/karthik-sowmya/1.jpg')">
> ```
> Apply the same merge to all 6 cards.

- [ ] **Step 2: Verify markup in browser**

Serve the file (`npx serve .` from the project root, open `http://localhost:3000/animation_spatial_gallery.html`). The page will look broken (cards stacked or missing layout) — that is expected. Confirm no JS console errors about missing elements.

---

## Task 2: CSS — Add `--ease`, Stage Perspective, Helix-Field, Card Base Positioning

**Files:**
- Modify: `animation_spatial_gallery.html` (the `<style>` block)

- [ ] **Step 1: Add `--ease` to `:root`**

In the `:root` block, add one line after `--line`:

```css
:root {
  --bg: #050404;
  --text: #f5eee8;
  --muted: rgba(245, 238, 232, 0.55);
  --accent: #c9956b;
  --line: rgba(201, 149, 107, 0.25);
  --ease: cubic-bezier(0.16, 1, 0.3, 1);   /* ← add this */
}
```

- [ ] **Step 2: Replace `.gallery-stage` rule**

Remove the existing `.gallery-stage` rule and replace with:

```css
.gallery-stage {
  position: relative;
  z-index: 1;
  width: 100%;
  height: 100vh;
  perspective: 1200px;
  overflow: hidden;
}
```

- [ ] **Step 3: Add `.helix-field` rule**

After `.gallery-stage`, add:

```css
.helix-field {
  position: absolute;
  inset: 0;
  transform-style: preserve-3d;
  will-change: transform;
}
```

- [ ] **Step 4: Replace `.gallery-card` base rule**

Remove the existing `.gallery-card` rule and replace with:

```css
.gallery-card {
  position: absolute;
  width: 28rem;
  aspect-ratio: 1.42;
  top: 50%;
  left: 50%;
  margin-top: -9.86rem;   /* half of (28rem / 1.42) */
  margin-left: -14rem;    /* half of 28rem */
  overflow: hidden;
  border-radius: 2.5rem;
  border: 1px solid rgba(255, 255, 255, 0.08);
  background-color: #110d0c;
  background-position: center;
  background-repeat: no-repeat;
  background-size: cover;
  box-shadow: 0 40px 90px rgba(0, 0, 0, 0.28);
  will-change: transform, opacity;
}
```

- [ ] **Step 5: Remove now-unused rules**

Delete these rules entirely from the `<style>` block (they were for the old `.gallery-track` grid):

- `.gallery-track { ... }`
- `.gallery-card.is-wide, .gallery-card.is-tall, .gallery-card.is-medium, .gallery-card.is-small, .gallery-card.is-tiny { ... }`

Also delete the `@media (max-width: 900px)` block — all breakpoint overrides for `.gallery-track` are no longer needed.

- [ ] **Step 6: Verify in browser**

Reload. All 6 cards should now be stacked on top of each other at the viewport center (a pile of cards). No layout is visible yet — that's correct. No console errors.

---

## Task 3: CSS — Entry Animation Transitions

**Files:**
- Modify: `animation_spatial_gallery.html` (the `<style>` block)

The entry animation relies on CSS transitions that fire when `.helix-field` gains `.is-ready`. JS sets the collapsed transform first (no transition), then adds `.is-ready` and sets the helix transform (transition fires).

- [ ] **Step 1: Add transition rules after the `.gallery-card` rule**

```css
/* Entry animation — transitions activate only after .is-ready */
.helix-field.is-ready .gallery-card {
  transition-property: transform, opacity;
  transition-duration: 900ms, 700ms;
  transition-timing-function: var(--ease), ease;
  transition-delay: calc(var(--i) * 80ms);
}
```

---

## Task 4: CSS — Update Shine Gradient to Track Cursor Angle

**Files:**
- Modify: `animation_spatial_gallery.html` (the `<style>` block)

The JS will set `--shine-angle` on each card every RAF tick. The shine gradient must read this variable.

- [ ] **Step 1: Replace the `.gallery-card__shine` gradient**

Find the existing `.gallery-card__shine` rule:
```css
.gallery-card__shine {
  ...
  background: linear-gradient(115deg, transparent 30%, rgba(255, 255, 255, 0.12) 50%, transparent 72%);
  ...
}
```

Change only the `background` line to:
```css
background: linear-gradient(var(--shine-angle, 115deg), transparent 30%, rgba(255, 255, 255, 0.12) 50%, transparent 72%);
```

---

## Task 5: JS — HELIX Config, `lerp`, and `cardTransform` Helpers

**Files:**
- Modify: `animation_spatial_gallery.html` — add `<script>` block before `</body>`

- [ ] **Step 1: Add the IIFE shell and HELIX data table**

Add this `<script>` block immediately before `</body>`:

```html
<script>
(function () {
  'use strict';

  /* ─── Helix data ─────────────────────────────────────────────
     One entry per card (index 0 = front/left, 5 = back/right).
     tx/ty: offset from the card's centred anchor point.
     tz: depth in px (negative = further from viewer).
     ry: Y-axis rotation in degrees.
     rz: subtle lean in degrees.
     sc: scale multiplier.
     op: resting opacity.
     depth: 0.0 (front) → 1.0 (back) — drives parallax magnitude.
  ─────────────────────────────────────────────────────────────── */
  const HELIX = [
    { tx: '-38vw', ty: '-2%',  tz:    0, ry:    0, rz:  -1,  sc: 1.00, op: 1.00, depth: 0.0 },
    { tx: '-20vw', ty: '-6%',  tz: -120, ry:  -28, rz:   1,  sc: 0.88, op: 0.90, depth: 0.2 },
    { tx:  '-4vw', ty:  '4%',  tz: -240, ry:  -54, rz:  -1.5,sc: 0.76, op: 0.78, depth: 0.4 },
    { tx:  '12vw', ty: '-4%',  tz: -360, ry:  -78, rz:   1,  sc: 0.66, op: 0.68, depth: 0.6 },
    { tx:  '24vw', ty:  '3%',  tz: -480, ry: -100, rz:  -1,  sc: 0.57, op: 0.60, depth: 0.8 },
    { tx:  '34vw', ty: '-2%',  tz: -580, ry: -120, rz:   1.5, sc: 0.49, op: 0.52, depth: 1.0 },
  ];

  /* ─── Helpers ────────────────────────────────────────────── */
  function lerp(a, b, t) {
    return a + (b - a) * t;
  }

  /**
   * Build the full CSS transform string for card index `i`,
   * with optional pixel nudge applied on top of the base position.
   */
  function cardTransform(i, nudgeX, nudgeY) {
    const h = HELIX[i];
    return (
      'translateX(calc(' + h.tx + ' + ' + nudgeX + 'px)) ' +
      'translateY(calc(' + h.ty + ' + ' + nudgeY + 'px)) ' +
      'translateZ(' + h.tz + 'px) ' +
      'rotateY(' + h.ry + 'deg) ' +
      'rotateZ(' + h.rz + 'deg) ' +
      'scale(' + h.sc + ')'
    );
  }

})();
</script>
```

- [ ] **Step 2: Verify in browser console**

Open DevTools console and run:
```js
// These are inside the IIFE so not globally accessible — just verify no parse errors on load.
```
Expected: No errors in the console. Page still shows the stacked card pile.

---

## Task 6: JS — `initHelix()` Entry Animation

**Files:**
- Modify: `animation_spatial_gallery.html` — inside the IIFE from Task 5, before the closing `})();`

- [ ] **Step 1: Add DOM refs and `initHelix()` inside the IIFE**

Add the following after the `cardTransform` function definition (still inside the IIFE):

```js
/* ─── DOM refs ───────────────────────────────────────────── */
const stage = document.querySelector('.gallery-stage');
const field = document.getElementById('helixField');
const cards = Array.from(field.querySelectorAll('.gallery-card'));

/* ─── Entry animation ────────────────────────────────────── */
function initHelix() {
  // 1. Apply collapsed (flat) entry state — no transition active yet
  cards.forEach(function (card, i) {
    var h = HELIX[i];
    card.style.opacity = '0';
    card.style.transform = (
      'translateX(' + h.tx + ') ' +
      'translateY(' + h.ty + ') ' +
      'translateZ(0px) ' +
      'rotateY(0deg) ' +
      'rotateZ(' + h.rz + 'deg) ' +
      'scale(0.85)'
    );
  });

  // 2. After 200 ms: add .is-ready (enables CSS transitions), then set helix transforms
  setTimeout(function () {
    field.classList.add('is-ready');

    // Small rAF buffer so the browser registers the initial transform before transitioning
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        cards.forEach(function (card, i) {
          var h = HELIX[i];
          card.style.opacity = String(h.op);
          card.style.transform = cardTransform(i, 0, 0);
        });

        // 3. Activate parallax after last card finishes
        //    Last card delay: 5 * 80ms = 400ms, transition: 900ms → total ≈ 1300ms + 100ms buffer
        setTimeout(startParallax, 1400);
      });
    });
  }, 200);
}
```

- [ ] **Step 2: Verify entry animation in browser**

Reload. Expected sequence:
- 0–200ms: 6 cards stacked flat at centre, invisible
- 200ms: cards fan horizontally (tx offsets kick in) — still flat, fading in
- 200–1300ms: cards rotate into 3D helix, staggered, each 80ms apart
- After ~1600ms: helix at rest, all cards visible at their spec opacities

---

## Task 7: JS — `startParallax()` and the RAF Tick Loop

**Files:**
- Modify: `animation_spatial_gallery.html` — inside the IIFE, after `initHelix()`

- [ ] **Step 1: Add parallax state vars and `startParallax` / `tick` inside the IIFE**

```js
/* ─── Parallax state ─────────────────────────────────────── */
var mouse  = { x: 0, y: 0 };   // normalised [-1, 1] target
var lerped = { x: 0, y: 0 };   // smoothed current value
var rafId  = null;
var active = false;

function startParallax() {
  active = true;
  tick();
}

function stopParallax() {
  active = false;
  if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
}

function tick() {
  if (!active) return;
  rafId = requestAnimationFrame(tick);

  // Smooth lerp toward mouse target
  lerped.x = lerp(lerped.x, mouse.x, 0.06);
  lerped.y = lerp(lerped.y, mouse.y, 0.06);

  // World tilt — rotate the entire helix field toward the cursor
  field.style.transform = (
    'rotateY(' + (lerped.x * 8) + 'deg) ' +
    'rotateX(' + (lerped.y * -5) + 'deg)'
  );

  // Per-card: depth nudge + shine angle
  var shineAngle = Math.atan2(mouse.y, mouse.x) * (180 / Math.PI);

  cards.forEach(function (card, i) {
    var h = HELIX[i];
    // Front cards (depth=0) get full nudge; back cards (depth=1) get almost none
    var nudgeX = lerped.x * (1 - h.depth) * 18;
    var nudgeY = lerped.y * (1 - h.depth) * 10;
    card.style.transform = cardTransform(i, nudgeX, nudgeY);

    // Shine: update the --shine-angle custom property so the gradient tracks the cursor
    card.style.setProperty('--shine-angle', (shineAngle + 115) + 'deg');
  });
}
```

---

## Task 8: JS — Mouse Event Listeners, Hover State, and `prefers-reduced-motion`

**Files:**
- Modify: `animation_spatial_gallery.html` — inside the IIFE, after `tick()`

- [ ] **Step 1: Add event listeners and boot call inside the IIFE**

```js
/* ─── Mouse listeners ────────────────────────────────────── */
stage.addEventListener('mousemove', function (e) {
  var r = stage.getBoundingClientRect();
  mouse.x = ((e.clientX - r.left)  / r.width  - 0.5) * 2;
  mouse.y = ((e.clientY - r.top)   / r.height - 0.5) * 2;
});

stage.addEventListener('mouseleave', function () {
  // Return to rest — lerp will drift back naturally
  mouse.x = 0;
  mouse.y = 0;
});

// Card hover: toggle .is-hovered for border/shadow lift (already defined in CSS)
cards.forEach(function (card) {
  card.addEventListener('mouseenter', function () { card.classList.add('is-hovered'); });
  card.addEventListener('mouseleave', function () { card.classList.remove('is-hovered'); });
});

/* ─── Boot ───────────────────────────────────────────────── */
if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
  // Skip animation — place cards directly at helix positions
  cards.forEach(function (card, i) {
    var h = HELIX[i];
    card.style.opacity = String(h.op);
    card.style.transform = cardTransform(i, 0, 0);
  });
  // Still start parallax (no animation, just responds to mouse)
  startParallax();
} else {
  initHelix();
}
```

- [ ] **Step 2: Full end-to-end visual verification**

Serve the file and open `http://localhost:3000/animation_spatial_gallery.html`. Check each success criterion from the spec:

**Geometry:**
- [ ] Card 1 is leftmost, largest, fully opaque
- [ ] Each card steps right, smaller, dimmer — visually reads as a receding helix
- [ ] Card 6 is rightmost, smallest (~0.49 scale), opacity ~0.52

**Entry animation:**
- [ ] Hard-reload: cards fan out and rotate into helix over ~1.3s with staggered timing
- [ ] No jitter or jump when parallax activates after entry

**Parallax:**
- [ ] Moving mouse left/right tilts the whole field (world rotation visible)
- [ ] Card 1 drifts noticeably more than Card 6 when moving the mouse
- [ ] Moving mouse off the stage: field drifts smoothly back to rest

**Shine:**
- [ ] Specular highlight on each card shifts direction as cursor moves

**Hover:**
- [ ] Hovering a card brightens its border and shadow (`is-hovered` class fires)

**Reduced motion:**
- [ ] In DevTools → Rendering → "Emulate CSS media feature prefers-reduced-motion: reduce": cards appear at helix positions instantly, no animation, parallax still works

- [ ] **Step 3: Commit**

```bash
cd "/Users/sudhakaravula/Desktop/logo/files new version  draft 1/aakaara-site-v2"
git add animation_spatial_gallery.html docs/superpowers/plans/2026-04-15-spatial-gallery-3d-helix.md docs/superpowers/specs/2026-04-15-spatial-gallery-design.md
git commit -m "feat: 3D helix gallery with mouse parallax and entry animation"
```

---

## Self-Review Checklist

- [x] **Spec coverage:** All 7 success criteria have a corresponding task and step
- [x] **Placeholder scan:** No TBD/TODO — all steps have exact code
- [x] **Type consistency:** `cardTransform(i, nudgeX, nudgeY)` signature used consistently in Task 5, 6, and 7; `HELIX[i].depth` used consistently in Task 7; `lerp(a, b, t)` defined in Task 5 and called in Task 7
- [x] **Known edge:** HTML `style` attribute merge (two `style` attrs on same element) — called out explicitly in Task 1 Step 1 note
- [x] **Known edge:** Double-rAF buffer in `initHelix` ensures browser registers the initial collapsed transform before transitioning, preventing a zero-duration flash

---

## Appendix: Complete Final `<script>` Block

For reference, the complete script as it should appear after all tasks:

```html
<script>
(function () {
  'use strict';

  const HELIX = [
    { tx: '-38vw', ty: '-2%',  tz:    0, ry:    0, rz:  -1,   sc: 1.00, op: 1.00, depth: 0.0 },
    { tx: '-20vw', ty: '-6%',  tz: -120, ry:  -28, rz:   1,   sc: 0.88, op: 0.90, depth: 0.2 },
    { tx:  '-4vw', ty:  '4%',  tz: -240, ry:  -54, rz:  -1.5, sc: 0.76, op: 0.78, depth: 0.4 },
    { tx:  '12vw', ty: '-4%',  tz: -360, ry:  -78, rz:   1,   sc: 0.66, op: 0.68, depth: 0.6 },
    { tx:  '24vw', ty:  '3%',  tz: -480, ry: -100, rz:  -1,   sc: 0.57, op: 0.60, depth: 0.8 },
    { tx:  '34vw', ty: '-2%',  tz: -580, ry: -120, rz:   1.5, sc: 0.49, op: 0.52, depth: 1.0 },
  ];

  function lerp(a, b, t) { return a + (b - a) * t; }

  function cardTransform(i, nudgeX, nudgeY) {
    const h = HELIX[i];
    return (
      'translateX(calc(' + h.tx + ' + ' + nudgeX + 'px)) ' +
      'translateY(calc(' + h.ty + ' + ' + nudgeY + 'px)) ' +
      'translateZ(' + h.tz + 'px) ' +
      'rotateY(' + h.ry + 'deg) ' +
      'rotateZ(' + h.rz + 'deg) ' +
      'scale(' + h.sc + ')'
    );
  }

  const stage = document.querySelector('.gallery-stage');
  const field = document.getElementById('helixField');
  const cards = Array.from(field.querySelectorAll('.gallery-card'));

  var mouse  = { x: 0, y: 0 };
  var lerped = { x: 0, y: 0 };
  var rafId  = null;
  var active = false;

  function startParallax() { active = true; tick(); }

  function stopParallax() {
    active = false;
    if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
  }

  function tick() {
    if (!active) return;
    rafId = requestAnimationFrame(tick);

    lerped.x = lerp(lerped.x, mouse.x, 0.06);
    lerped.y = lerp(lerped.y, mouse.y, 0.06);

    field.style.transform = (
      'rotateY(' + (lerped.x * 8) + 'deg) ' +
      'rotateX(' + (lerped.y * -5) + 'deg)'
    );

    var shineAngle = Math.atan2(mouse.y, mouse.x) * (180 / Math.PI);

    cards.forEach(function (card, i) {
      const h = HELIX[i];
      var nudgeX = lerped.x * (1 - h.depth) * 18;
      var nudgeY = lerped.y * (1 - h.depth) * 10;
      card.style.transform = cardTransform(i, nudgeX, nudgeY);
      card.style.setProperty('--shine-angle', (shineAngle + 115) + 'deg');
    });
  }

  function initHelix() {
    cards.forEach(function (card, i) {
      const h = HELIX[i];
      card.style.opacity = '0';
      card.style.transform = (
        'translateX(' + h.tx + ') ' +
        'translateY(' + h.ty + ') ' +
        'translateZ(0px) ' +
        'rotateY(0deg) ' +
        'rotateZ(' + h.rz + 'deg) ' +
        'scale(0.85)'
      );
    });

    setTimeout(function () {
      field.classList.add('is-ready');
      requestAnimationFrame(function () {
        requestAnimationFrame(function () {
          cards.forEach(function (card, i) {
            const h = HELIX[i];
            card.style.opacity = String(h.op);
            card.style.transform = cardTransform(i, 0, 0);
          });
          setTimeout(startParallax, 1400);
        });
      });
    }, 200);
  }

  stage.addEventListener('mousemove', function (e) {
    var r = stage.getBoundingClientRect();
    mouse.x = ((e.clientX - r.left)  / r.width  - 0.5) * 2;
    mouse.y = ((e.clientY - r.top)   / r.height - 0.5) * 2;
  });

  stage.addEventListener('mouseleave', function () {
    mouse.x = 0;
    mouse.y = 0;
  });

  cards.forEach(function (card) {
    card.addEventListener('mouseenter', function () { card.classList.add('is-hovered'); });
    card.addEventListener('mouseleave', function () { card.classList.remove('is-hovered'); });
  });

  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    cards.forEach(function (card, i) {
      const h = HELIX[i];
      card.style.opacity = String(h.op);
      card.style.transform = cardTransform(i, 0, 0);
    });
    startParallax();
  } else {
    initHelix();
  }

})();
</script>
```
