# Experience Section — 3D WebGL Path Accent

**Date:** 2026-04-20
**Page:** `couple-portraits.html`
**Section:** `.cp-experience` → `.ae-canvas`

## Goal

Replace the existing flat SVG path animation in the experience section with a Three.js 3D metallic S-curve rendered on a WebGL canvas. The 5 existing HTML cards stay unchanged — the 3D path is a cinematic visual accent sitting behind them.

Visual reference: minta.framer.ai — thin organic S-curve with numbered step markers, dark background, warm amber accent.

## Scope

- Desktop only (mobile deferred)
- Ambient continuous animation — no scroll dependency
- No React, no build step — vanilla JS + Three.js via CDN importmap

---

## Architecture

### Files Changed

| File | Change |
|------|--------|
| `couple-portraits.html` | Add importmap for Three.js; add `<script type="module" src="/experience-3d.js">`; remove `<svg class="ae-path-svg">` |
| `experience-3d.js` | New file — owns the entire Three.js scene |
| `couple-portraits.html` (inline CSS) | `.ae-canvas`: add `position: relative; overflow: hidden`; `.ae-card`: ensure `z-index: 1` |

### Three.js Delivery

```html
<script type="importmap">
  { "imports": { "three": "https://cdn.jsdelivr.net/npm/three@0.163.0/build/three.module.min.js" } }
</script>
<script type="module" src="/experience-3d.js"></script>
```

~600KB async CDN load. Scene initializes on `DOMContentLoaded`, only when `.ae-canvas` is present in the DOM.

---

## Canvas Integration

- `experience-3d.js` queries `.ae-canvas`, injects a `<canvas>` as its first child
- Canvas CSS: `position: absolute; inset: 0; width: 100%; height: 100%; pointer-events: none; z-index: 0`
- `.ae-card` elements: `position: relative; z-index: 1` — always above canvas
- Canvas resizes with `ResizeObserver` on `.ae-canvas` — renderer size always matches the element's bounding box, which is driven by the card layout height
- `renderer.dispose()` called if element leaves DOM (no persistent leak)

---

## 3D Scene

### Camera
- `PerspectiveCamera(50, aspect, 0.1, 300)`
- Position: `(0, 0, 16)`, looking at origin
- Ambient drift: `camera.position.x = sin(tick * 0.5) * 0.4`, `camera.position.y = cos(tick * 0.35) * 0.3`

### Lights
| Light | Color | Intensity | Notes |
|-------|-------|-----------|-------|
| AmbientLight | `#ffffff` | 0.1 | Base fill |
| DirectionalLight (key) | `#ffd090` | 2.0 | Position (4, 8, 10) |
| PointLight 1 | `#c9956b` | 10 (±2.5 pulse) | Position (-6, 4, -10) |
| PointLight 2 | `#ff9944` | 6 (±2 pulse) | Position (7, -4, 6) |
| PointLight 3 | `#ffd580` | 5 (±1.5 pulse) | Position (0, 2, 14) |

Light pulse: `pl1.intensity = 9 + sin(tick * 2) * 2.5`, etc. Tick increments `0.0025` per frame.

### S-Curve

`CatmullRomCurve3` with 8 control points:

```
(-8,  5, -20)   // far top-left — start
(-5,  3, -14)
(-1,  1,  -7)   // first arc peak, moving right
( 2,  0,  -2)   // S inflection — crossing center
( 0, -2,   3)   // second arc, swings back
(-1, -3.5, 8)
( 3, -5,  14)   // exits bottom-right, close/foreground
( 7, -6,  18)
```

500 tube segments, 24 radial segments.

### Tube Layers (rendered in order)

1. **Shadow base** — radius 0.14, `MeshStandardMaterial({ color: 0x2a1000, metalness: 0.3, roughness: 1 })`
2. **Main gold tube** — radius 0.09, `MeshStandardMaterial({ color: 0xc07840, metalness: 0.95, roughness: 0.10, emissive: 0x4a1c00, emissiveIntensity: 0.45 })`
3. **Highlight strip** — radius 0.022, 8 segments, `MeshBasicMaterial({ color: 0xfff8e0, opacity: 0.9 })`
4. **Outer glow shell** — radius 0.38, 16 segments, `BackSide`, `MeshBasicMaterial({ color: 0xc9956b, opacity: 0.025 })`

### Step Markers (5 total)

At `t = [0.08, 0.25, 0.45, 0.65, 0.90]` along the curve:

- **Sphere** — radius 0.20, `MeshStandardMaterial({ color: 0xffd060, metalness: 0.95, roughness: 0.08, emissive: 0xb05010, emissiveIntensity: 0.9 })`
- **Halo ring** — `TorusGeometry(0.38, 0.014, 8, 48)`, faces camera, `MeshBasicMaterial({ color: 0xc9956b, opacity: 0.45 })`
- **Dashed tick** — `LineDashedMaterial({ color: 0xc9956b, dashSize: 0.2, gapSize: 0.15, opacity: 0.5 })`, extends `(0, 2, 0)` upward from sphere position

The curve's control points are tuned so each sphere lands visually near its corresponding card's vertical zone. Fine-tuning by adjusting control points after first render.

### Particles

- 700 points, positioned by sampling random `t` along curve + radial scatter (radius 0.4–3.4) + z-jitter ±1.5
- `PointsMaterial({ color: 0xc9956b, size: 0.055, opacity: 0.25 })`

---

## Animation Loop

```
tick += 0.0025
camera drift (sin/cos on x/y)
point light pulse (sin/cos on intensity)
renderer.render(scene, camera)
```

`requestAnimationFrame` loop. Cancelled on cleanup via stored RAF id.

---

## What's Removed

- `<svg class="ae-path-svg">` element and its two child `<path>` elements from `couple-portraits.html`
- The JS scroll handler section labelled `// The Experience — desktop luxury timeline` that animates the SVG path draw (`stroke-dashoffset`)

---

## Out of Scope

- Mobile behavior (deferred)
- Scroll-driven sphere highlighting
- Label projection from 3D to 2D (cards stay CSS-positioned)
- Any changes to card copy, layout, or reveal animation
