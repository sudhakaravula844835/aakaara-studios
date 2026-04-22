# Experience Section 3D WebGL Path — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the flat SVG path in the couple portraits experience section with a Three.js 3D metallic S-curve rendered on a WebGL canvas, while keeping all 5 existing HTML cards unchanged.

**Architecture:** Three.js loaded via importmap CDN — no build step. A new `experience-3d.js` module owns the entire 3D scene and injects its canvas into `.ae-canvas` as a background layer. The existing card reveal/dimming JS is trimmed to remove SVG path logic but otherwise stays intact.

**Tech Stack:** Vanilla JS ES modules, Three.js 0.163 via jsDelivr CDN, HTML/CSS

---

## File Map

| File | Action | Responsibility |
|------|--------|---------------|
| `couple-portraits.html` | Modify | Add importmap + script tag; remove SVG element; trim experience IIFE; remove dead CSS |
| `experience-3d.js` | Create | Three.js scene: renderer, camera, lights, S-curve tube, spheres, particles, animation loop, resize |

---

## Task 1: Add Three.js importmap and module script tag

**Files:**
- Modify: `couple-portraits.html` (inside `<head>` and just before `</body>`)

- [ ] **Step 1: Add importmap to `<head>`**

In `couple-portraits.html`, add this block immediately after the `<meta charset="UTF-8">` line (line 5):

```html
<script type="importmap">
  { "imports": { "three": "https://cdn.jsdelivr.net/npm/three@0.163.0/build/three.module.min.js" } }
</script>
```

- [ ] **Step 2: Add module script tag before `</body>`**

In `couple-portraits.html`, add this line just before the closing `</body>` tag:

```html
<script type="module" src="/experience-3d.js"></script>
```

- [ ] **Step 3: Verify importmap parses**

Open the page in Chrome DevTools → Console. There should be no `"Cannot resolve module specifier 'three'"` error on load (the module won't run yet since the file doesn't exist, but the importmap itself must parse without error).

Expected console: `GET /experience-3d.js net::ERR_FILE_NOT_FOUND` — this is expected, confirms script tag is wired.

- [ ] **Step 4: Commit**

```bash
git add couple-portraits.html
git commit -m "feat: wire Three.js importmap and experience-3d module script"
```

---

## Task 2: Create `experience-3d.js` — Three.js scene

**Files:**
- Create: `experience-3d.js` (repo root)

- [ ] **Step 1: Create the file with the full scene**

Create `/experience-3d.js` with this exact content:

```js
import * as THREE from 'three';

function initExperience3D() {
  const container = document.querySelector('.ae-canvas');
  if (!container) return;
  if (window.matchMedia('(max-width: 768px)').matches) return;

  const W = container.offsetWidth;
  const H = container.offsetHeight;

  // Renderer — transparent background so section's #F7F2EA shows through
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setSize(W, H);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
  renderer.setClearColor(0x000000, 0);

  const cvs = renderer.domElement;
  cvs.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;pointer-events:none;z-index:0;';
  container.insertBefore(cvs, container.firstChild);

  // Scene + camera
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(50, W / H, 0.1, 300);
  camera.position.set(0, 0, 16);
  camera.lookAt(0, 0, 0);

  // Lights
  scene.add(new THREE.AmbientLight(0xffffff, 0.1));

  const key = new THREE.DirectionalLight(0xffd090, 2);
  key.position.set(4, 8, 10);
  scene.add(key);

  const pl1 = new THREE.PointLight(0xc9956b, 10, 50);
  pl1.position.set(-6, 4, -10);
  scene.add(pl1);

  const pl2 = new THREE.PointLight(0xff9944, 6, 30);
  pl2.position.set(7, -4, 6);
  scene.add(pl2);

  const pl3 = new THREE.PointLight(0xffd580, 5, 20);
  pl3.position.set(0, 2, 14);
  scene.add(pl3);

  // S-curve: starts top-left far, inflects at center, exits bottom-right close
  const curve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-8,  5,  -20),
    new THREE.Vector3(-5,  3,  -14),
    new THREE.Vector3(-1,  1,   -7),
    new THREE.Vector3( 2,  0,   -2),
    new THREE.Vector3( 0, -2,    3),
    new THREE.Vector3(-1, -3.5,  8),
    new THREE.Vector3( 3, -5,   14),
    new THREE.Vector3( 7, -6,   18),
  ]);

  const SEGS = 500, R = 24;

  // Layer 1: shadow base (thick, rough)
  scene.add(new THREE.Mesh(
    new THREE.TubeGeometry(curve, SEGS, 0.14, R, false),
    new THREE.MeshStandardMaterial({ color: 0x2a1000, metalness: 0.3, roughness: 1 })
  ));

  // Layer 2: main gold metallic tube
  scene.add(new THREE.Mesh(
    new THREE.TubeGeometry(curve, SEGS, 0.09, R, false),
    new THREE.MeshStandardMaterial({
      color: 0xc07840,
      metalness: 0.95,
      roughness: 0.10,
      emissive: 0x4a1c00,
      emissiveIntensity: 0.45,
    })
  ));

  // Layer 3: bright highlight strip
  scene.add(new THREE.Mesh(
    new THREE.TubeGeometry(curve, SEGS, 0.022, 8, false),
    new THREE.MeshBasicMaterial({ color: 0xfff8e0, transparent: true, opacity: 0.9 })
  ));

  // Layer 4: outer glow shell (backside)
  scene.add(new THREE.Mesh(
    new THREE.TubeGeometry(curve, SEGS, 0.38, 16, false),
    new THREE.MeshBasicMaterial({ color: 0xc9956b, transparent: true, opacity: 0.025, side: THREE.BackSide })
  ));

  // Step markers: 5 glowing spheres, one per card
  [0.08, 0.25, 0.45, 0.65, 0.90].forEach(t => {
    const pt = curve.getPointAt(t);

    // Glowing sphere
    const sphere = new THREE.Mesh(
      new THREE.SphereGeometry(0.20, 24, 24),
      new THREE.MeshStandardMaterial({
        color: 0xffd060,
        metalness: 0.95,
        roughness: 0.08,
        emissive: 0xb05010,
        emissiveIntensity: 0.9,
      })
    );
    sphere.position.copy(pt);
    scene.add(sphere);

    // Halo ring (faces camera at init — stays fixed, close enough for ambient)
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(0.38, 0.014, 8, 48),
      new THREE.MeshBasicMaterial({ color: 0xc9956b, transparent: true, opacity: 0.45 })
    );
    ring.position.copy(pt);
    ring.lookAt(camera.position);
    scene.add(ring);

    // Dashed tick line extending upward from sphere
    const tickGeo = new THREE.BufferGeometry().setFromPoints([
      pt.clone(),
      pt.clone().add(new THREE.Vector3(0, 2, 0)),
    ]);
    const tickLine = new THREE.Line(
      tickGeo,
      new THREE.LineDashedMaterial({ color: 0xc9956b, dashSize: 0.2, gapSize: 0.15, opacity: 0.5, transparent: true })
    );
    tickLine.computeLineDistances();
    scene.add(tickLine);
  });

  // Particles scattered around the curve
  const N = 700;
  const pos = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) {
    const p = curve.getPointAt(Math.random());
    const a = Math.random() * Math.PI * 2;
    const r = 0.4 + Math.random() * 3;
    pos[i * 3]     = p.x + Math.cos(a) * r;
    pos[i * 3 + 1] = p.y + Math.sin(a) * r;
    pos[i * 3 + 2] = p.z + (Math.random() - 0.5) * 3;
  }
  const partGeo = new THREE.BufferGeometry();
  partGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  scene.add(new THREE.Points(
    partGeo,
    new THREE.PointsMaterial({ color: 0xc9956b, size: 0.055, transparent: true, opacity: 0.25 })
  ));

  // Ambient animation loop
  let raf, tick = 0;
  function animate() {
    raf = requestAnimationFrame(animate);
    tick += 0.0025;
    camera.position.x = Math.sin(tick * 0.5) * 0.4;
    camera.position.y = Math.cos(tick * 0.35) * 0.3;
    camera.lookAt(0, 0, 0);
    pl1.intensity = 9   + Math.sin(tick * 2)   * 2.5;
    pl2.intensity = 5   + Math.cos(tick * 1.7)  * 2;
    pl3.intensity = 4.5 + Math.sin(tick * 3)   * 1.5;
    renderer.render(scene, camera);
  }
  animate();

  // Resize with container
  const ro = new ResizeObserver(() => {
    const w = container.offsetWidth;
    const h = container.offsetHeight;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
  });
  ro.observe(container);
}

document.addEventListener('DOMContentLoaded', initExperience3D);
```

- [ ] **Step 2: Open the page locally and verify the 3D canvas renders**

```bash
npx serve . -l 8080
# Open http://localhost:8080/couple-portraits.html
```

Expected: A gold metallic S-curve floats behind the 5 experience cards. Camera drifts gently. Lights pulse. No console errors.

If you see a blank canvas: open DevTools → Console and check for `three` import errors or WebGL context failures.

- [ ] **Step 3: Commit**

```bash
git add experience-3d.js
git commit -m "feat: add Three.js 3D S-curve ambient scene to experience section"
```

---

## Task 3: Trim the experience IIFE — remove SVG path logic, keep card reveal

**Files:**
- Modify: `couple-portraits.html` (inline `<script>` near bottom, the IIFE labelled `// The Experience — desktop luxury timeline`)

The current IIFE runs `buildPath()` (builds the SVG d-attribute), `updatePath()` (scroll-drives the stroke-dashoffset), and card reveal/dimming. We keep only the card reveal and dimming.

- [ ] **Step 1: Replace the entire experience IIFE**

Find the block starting with `// The Experience — desktop luxury timeline` (around line 2440) and ending with the matching `})();` (around line 2575). Replace the entire IIFE with:

```js
// The Experience — card reveal & dimming
(() => {
  const canvas   = document.querySelector('.ae-canvas');
  const cards    = document.querySelectorAll('.ae-card');
  const header   = document.querySelector('.ae-header');
  const reduceM  = window.matchMedia('(prefers-reduced-motion: reduce)');
  const isMobile = () => window.matchMedia('(max-width: 768px)').matches;

  if (!canvas || !cards.length) return;

  function revealHeader() {
    if (reduceM.matches) return;
    if (header) setTimeout(() => header.classList.add('ae-visible'), 120);
  }

  function updateDimming() {
    if (isMobile() || reduceM.matches) return;
    const mid = window.innerHeight * 0.42;
    let lastPast = -1;
    cards.forEach(card => {
      if (!card.classList.contains('ae-visible')) return;
      const rect = card.getBoundingClientRect();
      if (rect.top + rect.height * 0.5 < mid) lastPast = parseInt(card.dataset.step);
    });
    cards.forEach(card => {
      if (card.matches(':hover')) return;
      const step = parseInt(card.dataset.step);
      const shouldDim = lastPast > 0 && step < lastPast && card.classList.contains('ae-visible');
      card.classList.toggle('ae-dim', shouldDim);
    });
  }

  // Card reveal via IntersectionObserver
  if ('IntersectionObserver' in window && !reduceM.matches && !isMobile()) {
    const obs = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        const i = parseInt(entry.target.dataset.step || '1') - 1;
        setTimeout(() => entry.target.classList.add('ae-visible'), i * 80);
        obs.unobserve(entry.target);
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -80px 0px' });
    cards.forEach(c => obs.observe(c));
  } else {
    cards.forEach(c => c.classList.add('ae-visible'));
  }

  cards.forEach(card => {
    card.addEventListener('mouseenter', () => card.classList.remove('ae-dim'));
    card.addEventListener('mouseleave', () => updateDimming());
  });

  window.addEventListener('scroll', updateDimming, { passive: true });

  if (document.readyState === 'complete') {
    revealHeader();
  } else {
    window.addEventListener('load', revealHeader);
  }
})();
```

- [ ] **Step 2: Verify card reveal still works**

Reload `http://localhost:8080/couple-portraits.html`. Scroll through the experience section. Each of the 5 cards should fade in sequentially as they enter the viewport. Cards that have scrolled past viewport midpoint should dim to `opacity: 0.28`. Hover on a dimmed card should restore full opacity.

- [ ] **Step 3: Commit**

```bash
git add couple-portraits.html
git commit -m "refactor: remove SVG path logic from experience IIFE, keep card reveal/dimming"
```

---

## Task 4: Remove SVG element and dead CSS

**Files:**
- Modify: `couple-portraits.html` (HTML + inline `<style>`)

- [ ] **Step 1: Remove the SVG element from HTML**

Find and delete these 4 lines (around line 1914):

```html
        <svg class="ae-path-svg" viewBox="0 0 1440 1800" preserveAspectRatio="none" aria-hidden="true">
          <path class="ae-path-glow" d=""/>
          <path class="ae-path" d=""/>
        </svg>
```

- [ ] **Step 2: Add `overflow: hidden` to `.ae-canvas`**

Find the `.ae-canvas` rule in the inline `<style>` block (around line 468):

```css
        .ae-canvas {
            position: relative;
            width: 100%;
            min-height: 190vh;
        }
```

Change to:

```css
        .ae-canvas {
            position: relative;
            width: 100%;
            min-height: 190vh;
            overflow: hidden;
        }
```

- [ ] **Step 3: Remove dead CSS rules**

Delete the following CSS rule blocks from the inline `<style>` (around lines 474–498):

```css
        .ae-path-svg {
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            pointer-events: none;
            z-index: 1;
            overflow: visible;
        }

        .ae-path-glow {
            fill: none;
            stroke: rgba(200, 154, 100, 0.09);
            stroke-width: 18;
            stroke-linecap: round;
            filter: blur(6px);
        }

        .ae-path {
            fill: none;
            stroke: rgba(200, 154, 100, 0.28);
            stroke-width: 1;
            stroke-dasharray: 4 9;
        }
```

Also delete this line from the `@media (prefers-reduced-motion: reduce)` block (around line 575):

```css
            .ae-path, .ae-path-glow { stroke-dashoffset: 0 !important; }
```

Also delete this line from the `@media (max-width: 768px)` block (around line 1590):

```css
            .ae-path-svg { display: none; }
```

- [ ] **Step 4: Verify no regressions**

Reload the page. The experience section should show: 3D canvas behind cards, cards fade in on scroll, dimming works. No layout shifts. No console errors referencing `ae-path-svg`.

- [ ] **Step 5: Commit**

```bash
git add couple-portraits.html
git commit -m "chore: remove SVG path element and dead ae-path CSS rules"
```

---

## Task 5: Tune curve control points so spheres align with card positions

**Files:**
- Modify: `experience-3d.js` (CatmullRomCurve3 control points and/or t-values)

This is an iterative visual tuning task. The goal: each glowing sphere should land near its corresponding `.ae-card` in the desktop viewport.

Card positions (from CSS):
- Step 1: `top: 3vh;   left: 4%`
- Step 2: `top: 36vh;  left: 21%`
- Step 3: `top: 69vh;  left: 38%`
- Step 4: `top: 102vh; left: 55%`
- Step 5: `top: 135vh; left: 70%`

- [ ] **Step 1: Open the page at 1440px viewport width**

In Chrome DevTools, set device width to 1440px. Scroll slowly through the experience section with the 3D scene visible.

- [ ] **Step 2: Assess sphere-to-card alignment**

For each step, note whether the glowing sphere appears visually near the card's dashed left border. The sphere doesn't need to be pixel-perfect — within ~100px of the card's top-left is the target.

- [ ] **Step 3: Adjust t-values first**

If spheres are clustered (not spread evenly), adjust the 5 t-values in `experience-3d.js`:

```js
// Current:
[0.08, 0.25, 0.45, 0.65, 0.90].forEach(t => {
```

Increase the later values to spread them further, or decrease early ones to pull the first sphere closer to the top of the canvas. Example adjustment if spheres 4 and 5 are too close:

```js
[0.08, 0.24, 0.44, 0.67, 0.92].forEach(t => {
```

- [ ] **Step 4: Adjust control points if lateral alignment needs work**

If spheres land too far left or right relative to their cards, adjust the x-values of the CatmullRomCurve3 control points. The mapping is: x=-8 is far left, x=7 is far right. Increase x-values on later points to push the curve rightward as it descends:

```js
// Example: push the bottom-right exit further right to match cards at left: 70%
new THREE.Vector3( 5, -5,  14),  // was (3, -5, 14)
new THREE.Vector3( 9, -6,  18),  // was (7, -6, 18)
```

- [ ] **Step 5: Commit final tuned values**

```bash
git add experience-3d.js
git commit -m "chore: tune 3D S-curve control points for card alignment"
```

---

## Verification Checklist

Before declaring done, verify all of the following at 1440px viewport width:

- [ ] 3D gold metallic S-curve is visible behind the 5 cards
- [ ] Camera drifts gently (x/y oscillation) — continuous, not jerky
- [ ] Point light intensities pulse visibly
- [ ] 5 glowing spheres are visible, roughly aligned with card positions
- [ ] Halo rings and dashed tick lines appear at each sphere
- [ ] Amber particles scattered around the curve
- [ ] All 5 cards fade in via IntersectionObserver as you scroll down
- [ ] Passed cards dim to `opacity: 0.28`; hover restores full opacity
- [ ] No console errors
- [ ] Page `<title>` and other content sections unaffected
- [ ] `prefers-reduced-motion` users: cards are immediately visible, 3D canvas still renders (Three.js doesn't respect reduced motion — acceptable per scope)
