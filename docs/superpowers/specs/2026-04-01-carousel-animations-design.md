# Instagram Carousel — Cinematic Animation System

**Date:** 2026-04-01  
**File:** `tools/insta-carousel.html`  
**Status:** Approved, ready for implementation

---

## Overview

Add per-slide CSS animations to the Instagram carousel tool so each slide feels cinematic and premium when screen-recorded for Instagram. Animations auto-trigger via IntersectionObserver as each slide scrolls into view — no button needed.

---

## Animation Styles

Two motion languages, used across the 6 slides:

### Style A — Cinematic Wipe
Text reveals upward through a clip-path mask. Film-title-card energy.
```css
@keyframes wipeUp {
  from { opacity: 0; clip-path: inset(100% 0 0 0); transform: translateY(12px); }
  to   { opacity: 1; clip-path: inset(0% 0 0 0);   transform: translateY(0); }
}
```

### Style B — Stagger Fade Up
Elements rise in sequence, each slightly delayed. Clean and premium.
```css
@keyframes fadeUp {
  from { opacity: 0; transform: translateY(18px); }
  to   { opacity: 1; transform: translateY(0); }
}
```

### Supporting keyframes
```css
@keyframes fadeIn {
  from { opacity: 0; } to { opacity: 1; }
}
@keyframes lineGrow {
  from { width: 0; } to { width: 40px; }
}
```

**Easing for all:** `cubic-bezier(0.16, 1, 0.3, 1)` — springy but not bouncy.

---

## Trigger Mechanism

`IntersectionObserver` with `threshold: 0.2`. When a `.slide` enters the viewport, the observer adds `.is-visible` to it and disconnects (fires once per slide per page load). All animations are defined as `animation: none` by default and activate only when `.is-visible` is present.

```js
const observer = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.classList.add('is-visible');
      observer.unobserve(entry.target);
    }
  });
}, { threshold: 0.2 });

document.querySelectorAll('.slide').forEach(s => observer.observe(s));
```

**Replay:** Refresh the page. All `.is-visible` classes are removed on load, animations reset.

---

## Per-Slide Breakdown

### Slide 01 — Cover (Style B)
| Element | Animation | Delay | Duration |
|---|---|---|---|
| `.mark` (logo icon) | fadeIn | 0s | 0.6s |
| `.logo` ("Aakaara") | fadeUp | 0.2s | 0.8s |
| `.logo-sub` | fadeUp | 0.5s | 0.6s |
| `.tagline` | fadeUp | 0.8s | 0.6s |

### Slide 02 — Definition (Style B)
| Element | Animation | Delay | Duration |
|---|---|---|---|
| `.word` | fadeUp | 0s | 0.8s |
| `.pos`, `.pron` | fadeUp | 0.4s | 0.5s |
| `.slide-02-divider` (new `<div>` added after `.pron`) | lineGrow | 0.6s | 0.5s |
| `.def-title`, `.def-body` | fadeUp | 0.8s | 0.6s |
| `.mission-title`, `.mission-body` | fadeUp | 1.1s | 0.6s |

### Slide 03 — What We Create (Style A, video bg)
Video plays in background from page load. Text reveals after a short delay.
The `.headline` div needs its content split into two `<span class="hl-line">` wrappers (one per visual line) so each can animate independently.
| Element | Animation | Delay | Duration |
|---|---|---|---|
| `.label` | wipeUp | 0.3s | 0.6s |
| `.hl-line:first-child` ("Love stories.") | wipeUp | 0.6s | 0.9s |
| `.hl-line:last-child` ("framed with intention.") | wipeUp | 1.0s | 0.9s |

### Slide 04 — Our Story (Style A + B)
| Element | Animation | Delay | Duration |
|---|---|---|---|
| `.heading` | wipeUp | 0s | 0.8s |
| `.accent-line` | lineGrow | 0.5s | 0.5s |
| `.body-text:first` | fadeUp | 0.8s | 0.6s |
| `.body-text:last` | fadeUp | 1.1s | 0.6s |

### Slide 05 — Services (Style A + B, video bg)
Video plays in background. Headline wipes in, services stagger.
| Element | Animation | Delay | Duration |
|---|---|---|---|
| `.heading` | wipeUp | 0.2s | 0.9s |
| `.svc:nth-child(1)` | fadeUp | 0.8s | 0.5s |
| `.svc:nth-child(2)` | fadeUp | 0.9s | 0.5s |
| `.svc:nth-child(3)` | fadeUp | 1.0s | 0.5s |
| `.svc:nth-child(4)` | fadeUp | 1.1s | 0.5s |
| `.svc:nth-child(5)` | fadeUp | 1.2s | 0.5s |
| `.svc:nth-child(6)` | fadeUp | 1.3s | 0.5s |

### Slide 06 — CTA Closing (Style B)
| Element | Animation | Delay | Duration |
|---|---|---|---|
| `.mark` | fadeIn | 0s | 0.6s |
| `.heading` | fadeUp | 0.3s | 0.8s |
| `.sub` | fadeUp | 0.6s | 0.6s |
| `.accent-line` | lineGrow | 0.9s | 0.4s |
| `.cta`, `.url` | fadeUp | 1.1s | 0.5s |

---

## Implementation Notes

- All animated elements start with `opacity: 0` in CSS (no JS needed for initial state).
- Animations only activate inside `.slide.is-visible` to avoid elements being invisible before observer fires.
- `animation-fill-mode: forwards` on all keyframes to hold the final state.
- The `.accent-line` `lineGrow` animation targets `width` directly (the element is `display: block` with a fixed height).
- Slide 02: the existing `border-bottom` on `.pron` is removed; a new `<div class="slide-02-divider">` is inserted after `.pron` and animated with `lineGrow`.
- Slide 03: `.headline` content is split into two `<span class="hl-line">` elements (one per line) so they can animate independently with separate delays. The existing `<em>` tags are preserved inside each span.
- `.slide-video-bg` is unaffected — always visible, no animation class on it.

---

## Export Workflow

1. Serve the tool: `npx serve .` from repo root → `http://localhost:3000/tools/insta-carousel.html`
2. Scroll to a slide → animation auto-fires
3. Screen-record 4–5 seconds (QuickTime → New Screen Recording, select the slide area)
4. Repeat for all 6 slides
5. Post the 6 video clips as an Instagram carousel
