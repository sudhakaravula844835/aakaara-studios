# Video Works FocusRail Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a 3D coverflow FocusRail hero above the existing Video Works filterable grid in the production site, built as a vanilla JS class with no new dependencies.

**Architecture:** A new `VideoFocusRail` class in `Script.js` reads 6 curated film items from DOM `data-*` attributes, positions cards via JS-driven CSS transforms (perspective + translateX/Z + rotateY), and wires its "Watch Film" action to the existing `openModal()` function. Two standalone pure helper functions (`vfrWrap`, `vfrCardStyle`) are extracted before the class for testability. CSS lives in `styles.css`; the HTML block is inserted in `index.html` between the section description and the filter pills.

**Tech Stack:** Vanilla JS (ES6 classes), CSS3 transforms, Vitest (unit), Playwright (e2e)

---

## File Map

| File | Change |
|------|--------|
| `styles.css` | Append ~80 lines of `.vfr-*` styles after existing `.vw-*` rules |
| `index.html` | Insert `#videoFocusRail` block + `.vfr-divider` between line 804 and line 806 (after `.section-desc`, before `.vw-filters`) |
| `Script.js` | Add `vfrWrap()`, `vfrCardStyle()` helper functions + `VideoFocusRail` class; instantiate in the existing carousel-init IIFE |
| `video-focus-rail.test.js` | New Vitest unit tests for helpers and class navigation logic |
| `gallery.spec.js` | Append Playwright smoke test for FocusRail |

---

## Task 1: CSS — VideoFocusRail styles

**Files:**
- Modify: `styles.css` (append after last `.vw-*` rule — search for `.vw-gi-8` to find the end)

- [ ] **Step 1: Find the append point in styles.css**

Run:
```bash
grep -n "vw-gi-8" styles.css | tail -3
```
Note the last line number — append the new CSS block immediately after it.

- [ ] **Step 2: Append VideoFocusRail CSS to styles.css**

Add this entire block at the end of the `.vw-*` rules section:

```css
/* ── VIDEO FOCUS RAIL ── */
.vfr-wrap {
  position: relative;
  background: var(--noir);
  border-radius: 16px;
  overflow: hidden;
  padding: 40px 0 32px;
  margin-bottom: 40px;
}

.vfr-ambience {
  position: absolute;
  inset: 0;
  z-index: 0;
  pointer-events: none;
}

.vfr-amb-img {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  filter: blur(60px) saturate(1.8);
  transform: scale(1.1);
  opacity: 0;
  transition: opacity 0.8s ease;
}

.vfr-amb-img.vfr-amb-active { opacity: 0.35; }

.vfr-amb-overlay {
  position: absolute;
  inset: 0;
  background: linear-gradient(to top, var(--noir) 15%, rgba(9,8,11,0.5) 60%, transparent);
}

.vfr-stage {
  position: relative;
  z-index: 1;
  height: 340px;
  display: flex;
  align-items: center;
  justify-content: center;
  perspective: 1200px;
  margin-bottom: 28px;
}

.vfr-card {
  position: absolute;
  width: 180px;
  aspect-ratio: 3 / 4;
  border-radius: 14px;
  border-top: 1px solid rgba(255,255,255,0.15);
  overflow: hidden;
  cursor: pointer;
  transition: transform 0.5s var(--ease), opacity 0.4s ease, filter 0.4s ease;
  transform-style: preserve-3d;
  background: var(--umber);
}

.vfr-card.is-center {
  cursor: default;
  box-shadow: 0 28px 64px rgba(0,0,0,0.65);
}

.vfr-card img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  pointer-events: none;
  display: block;
}

.vfr-card-sheen {
  position: absolute;
  inset: 0;
  background: linear-gradient(to bottom, rgba(255,255,255,0.08), transparent);
  pointer-events: none;
}

.vfr-info {
  position: relative;
  z-index: 1;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 36px;
  gap: 20px;
}

.vfr-text {
  flex: 1;
  transition: opacity 0.22s ease, transform 0.22s ease;
}

.vfr-text.vfr-exit {
  opacity: 0;
  transform: translateY(-8px);
}

.vfr-text.vfr-enter {
  animation: vfrTextIn 0.3s ease forwards;
}

@keyframes vfrTextIn {
  from { opacity: 0; transform: translateY(8px); }
  to   { opacity: 1; transform: translateY(0); }
}

.vfr-meta {
  font-size: 10px;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: var(--rose);
  margin-bottom: 6px;
}

.vfr-title {
  font-family: var(--font-display);
  font-size: clamp(1.4rem, 2.5vw, 2rem);
  font-weight: 400;
  color: var(--ivory);
  margin-bottom: 6px;
  line-height: 1.1;
}

.vfr-desc {
  font-size: 13px;
  color: rgba(250,246,241,0.48);
  max-width: 320px;
  line-height: 1.55;
}

.vfr-controls {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-shrink: 0;
}

.vfr-ctrl-pill {
  display: flex;
  align-items: center;
  gap: 2px;
  background: rgba(255,255,255,0.05);
  border: 1px solid rgba(255,255,255,0.1);
  border-radius: 999px;
  padding: 4px;
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
}

.vfr-ctrl-btn {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  border: none;
  background: transparent;
  color: rgba(250,246,241,0.45);
  font-size: 18px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.15s ease, color 0.15s ease;
}

.vfr-ctrl-btn:hover {
  background: rgba(255,255,255,0.1);
  color: var(--ivory);
}

.vfr-ctrl-btn:active { transform: scale(0.92); }

.vfr-count {
  font-size: 11px;
  font-family: monospace;
  color: rgba(250,246,241,0.3);
  min-width: 38px;
  text-align: center;
}

.vfr-watch-btn {
  padding: 10px 22px;
  border-radius: 999px;
  border: none;
  background: var(--rose);
  color: var(--noir);
  font-family: var(--font-body);
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.06em;
  cursor: pointer;
  white-space: nowrap;
  transition: opacity 0.15s ease, transform 0.15s ease;
}

.vfr-watch-btn:hover { opacity: 0.88; }
.vfr-watch-btn:active { transform: scale(0.96); }

.vfr-divider {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-bottom: 28px;
}

.vfr-divider-line {
  flex: 1;
  height: 1px;
  background: rgba(201,149,107,0.12);
}

.vfr-divider-label {
  font-size: 10px;
  letter-spacing: 0.2em;
  text-transform: uppercase;
  color: rgba(201,149,107,0.38);
}

@media (max-width: 768px) {
  .vfr-stage { height: 260px; }
  .vfr-card { width: 140px; }
  .vfr-info { flex-direction: column; align-items: flex-start; padding: 0 20px; gap: 16px; }
  .vfr-desc { display: none; }
  .vfr-controls { width: 100%; }
  .vfr-watch-btn { flex: 1; text-align: center; }
}
```

- [ ] **Step 3: Commit**

```bash
git add styles.css
git commit -m "style: add VideoFocusRail CSS"
```

---

## Task 2: Unit tests — write failing tests for pure helpers

**Files:**
- Create: `video-focus-rail.test.js`

The test file defines the expected behaviour of `vfrWrap` and `vfrCardStyle` as a contract. The implementation (Task 3) must satisfy this contract exactly.

- [ ] **Step 1: Create the test file**

Create `video-focus-rail.test.js` in the repo root:

```js
import { describe, it, expect } from 'vitest';

// ── Helpers under test ──
// These are defined at module scope in Script.js (before the VideoFocusRail class).
// Redefined here as the contract the implementation must match.

function vfrWrap(n, count) {
  return ((n % count) + count) % count;
}

function vfrCardStyle(offset) {
  const dist = Math.abs(offset);
  const xPx = offset * 320;
  const zPx = -dist * 180;
  const rotY = offset * -20;
  const scale = offset === 0 ? 1 : 0.85;
  const opacity = offset === 0 ? 1 : Math.max(0.1, 1 - dist * 0.5);
  const blur = offset === 0 ? 0 : dist * 6;
  const brightness = offset === 0 ? 1 : 0.5;
  return {
    transform: `translateX(${xPx}px) translateZ(${zPx}px) rotateY(${rotY}deg) scale(${scale})`,
    opacity,
    filter: `blur(${blur}px) brightness(${brightness})`,
    zIndex: offset === 0 ? 5 : 5 - dist,
  };
}

// ── vfrWrap ──
describe('vfrWrap', () => {
  it('returns index unchanged when within range', () => {
    expect(vfrWrap(0, 6)).toBe(0);
    expect(vfrWrap(5, 6)).toBe(5);
  });

  it('wraps negative index to end of range', () => {
    expect(vfrWrap(-1, 6)).toBe(5);
    expect(vfrWrap(-6, 6)).toBe(0);
  });

  it('wraps index past end to start', () => {
    expect(vfrWrap(6, 6)).toBe(0);
    expect(vfrWrap(7, 6)).toBe(1);
  });
});

// ── vfrCardStyle ──
describe('vfrCardStyle', () => {
  it('center card (offset 0) has full opacity, no blur, z-index 5', () => {
    const s = vfrCardStyle(0);
    expect(s.opacity).toBe(1);
    expect(s.filter).toBe('blur(0px) brightness(1)');
    expect(s.zIndex).toBe(5);
    expect(s.transform).toContain('scale(1)');
    expect(s.transform).toContain('translateX(0px)');
  });

  it('offset +1 card is shifted right, dimmed, slightly blurred', () => {
    const s = vfrCardStyle(1);
    expect(s.opacity).toBe(0.5);
    expect(s.filter).toBe('blur(6px) brightness(0.5)');
    expect(s.zIndex).toBe(4);
    expect(s.transform).toContain('translateX(320px)');
    expect(s.transform).toContain('rotateY(-20deg)');
    expect(s.transform).toContain('scale(0.85)');
  });

  it('offset -1 card mirrors offset +1 but shifts left', () => {
    const s = vfrCardStyle(-1);
    expect(s.opacity).toBe(0.5);
    expect(s.transform).toContain('translateX(-320px)');
    expect(s.transform).toContain('rotateY(20deg)');
  });

  it('offset +2 has minimum 0.1 opacity', () => {
    const s = vfrCardStyle(2);
    expect(s.opacity).toBe(0.1); // max(0.1, 1 - 2*0.5) = max(0.1, 0) = 0.1
    expect(s.zIndex).toBe(3);
  });
});
```

- [ ] **Step 2: Run to confirm they fail (functions not yet in Script.js)**

```bash
npm run test:unit -- video-focus-rail
```

Expected: all tests FAIL — `vfrWrap is not defined`.

---

## Task 3: VideoFocusRail class — constructor + render()

**Files:**
- Modify: `Script.js` (add before the carousel-init IIFE at line ~2467)

- [ ] **Step 1: Add helper functions and class to Script.js**

Insert this block in `Script.js` immediately before the line `let portfolioCarousel, videoCarousel;` (~line 2467):

```js
// ═══════ VIDEO FOCUS RAIL ═══════

function vfrWrap(n, count) {
  return ((n % count) + count) % count;
}

function vfrCardStyle(offset) {
  const dist = Math.abs(offset);
  const xPx = offset * 320;
  const zPx = -dist * 180;
  const rotY = offset * -20;
  const scale = offset === 0 ? 1 : 0.85;
  const opacity = offset === 0 ? 1 : Math.max(0.1, 1 - dist * 0.5);
  const blur = offset === 0 ? 0 : dist * 6;
  const brightness = offset === 0 ? 1 : 0.5;
  return {
    transform: `translateX(${xPx}px) translateZ(${zPx}px) rotateY(${rotY}deg) scale(${scale})`,
    opacity,
    filter: `blur(${blur}px) brightness(${brightness})`,
    zIndex: offset === 0 ? 5 : 5 - dist,
  };
}

class VideoFocusRail {
  constructor(container) {
    this.container = container;
    this.cards = Array.from(container.querySelectorAll('.vfr-card'));
    this.count = this.cards.length;
    this.activeIndex = 0;
    this.isDragging = false;
    this.dragStartX = 0;
    this.lastWheelTime = 0;

    // Inject poster <img> and sheen overlay into each card
    this.cards.forEach(card => {
      const img = document.createElement('img');
      img.src = card.dataset.poster || '';
      img.alt = card.dataset.title || '';
      card.appendChild(img);
      const sheen = document.createElement('div');
      sheen.className = 'vfr-card-sheen';
      card.appendChild(sheen);
    });

    this._ambA   = container.querySelector('.vfr-amb-a');
    this._ambB   = container.querySelector('.vfr-amb-b');
    this._ambSlot = 'a'; // which slot is currently visible
    this._text   = container.querySelector('.vfr-text');
    this._meta   = container.querySelector('.vfr-meta');
    this._titleEl = container.querySelector('.vfr-title');
    this._descEl  = container.querySelector('.vfr-desc');
    this._countEl = container.querySelector('.vfr-count');
    this._prevBtn = container.querySelector('.vfr-prev');
    this._nextBtn = container.querySelector('.vfr-next');
    this._watchBtn = container.querySelector('.vfr-watch-btn');

    this.render();
    this.updateAmbience(true);
    this.updateInfo(true);
    this.bindEvents();
  }

  render() {
    this.cards.forEach((card, i) => {
      // Compute signed offset from active, wrapping at half-count boundaries
      let offset = i - this.activeIndex;
      if (offset > Math.floor(this.count / 2))  offset -= this.count;
      if (offset < -Math.floor(this.count / 2)) offset += this.count;

      const visible = Math.abs(offset) <= 2;
      if (!visible) {
        card.style.opacity = '0';
        card.style.pointerEvents = 'none';
        card.classList.remove('is-center');
        card._vfrOffset = null;
        return;
      }

      const s = vfrCardStyle(offset);
      card.style.transform  = s.transform;
      card.style.opacity    = s.opacity;
      card.style.filter     = s.filter;
      card.style.zIndex     = s.zIndex;
      card.style.pointerEvents = 'auto';
      card.classList.toggle('is-center', offset === 0);
      card._vfrOffset = offset;
    });
  }

  updateAmbience(immediate = false) {
    const poster = this.cards[this.activeIndex].dataset.poster;
    if (!poster) return;
    const incoming = this._ambSlot === 'a' ? this._ambB : this._ambA;
    const outgoing = this._ambSlot === 'a' ? this._ambA : this._ambB;

    if (immediate) {
      incoming.src = poster;
      incoming.classList.add('vfr-amb-active');
      outgoing.classList.remove('vfr-amb-active');
      this._ambSlot = incoming === this._ambA ? 'a' : 'b';
      return;
    }

    incoming.src = poster;
    incoming.onload = () => {
      incoming.classList.add('vfr-amb-active');
      outgoing.classList.remove('vfr-amb-active');
      this._ambSlot = incoming === this._ambA ? 'a' : 'b';
    };
  }

  updateInfo(immediate = false) {
    const card = this.cards[this.activeIndex];
    const doUpdate = () => {
      this._meta.textContent  = card.dataset.type  || '';
      this._titleEl.textContent = card.dataset.title || '';
      this._descEl.textContent  = card.dataset.desc  || '';
      this._countEl.textContent = `${this.activeIndex + 1} / ${this.count}`;
    };

    if (immediate) { doUpdate(); return; }

    this._text.classList.add('vfr-exit');
    setTimeout(() => {
      doUpdate();
      this._text.classList.remove('vfr-exit');
      this._text.classList.add('vfr-enter');
      setTimeout(() => this._text.classList.remove('vfr-enter'), 350);
    }, 220);
  }

  prev() {
    this.activeIndex = vfrWrap(this.activeIndex - 1, this.count);
    this.render();
    this.updateAmbience();
    this.updateInfo();
  }

  next() {
    this.activeIndex = vfrWrap(this.activeIndex + 1, this.count);
    this.render();
    this.updateAmbience();
    this.updateInfo();
  }

  goTo(offset) {
    this.activeIndex = vfrWrap(this.activeIndex + offset, this.count);
    this.render();
    this.updateAmbience();
    this.updateInfo();
  }

  openActive() {
    if (typeof openModal === 'function') {
      openModal(this.cards[this.activeIndex]);
    }
  }

  bindEvents() {
    this._prevBtn.addEventListener('click', () => this.prev());
    this._nextBtn.addEventListener('click', () => this.next());
    this._watchBtn.addEventListener('click', () => this.openActive());

    this.cards.forEach(card => {
      card.addEventListener('click', () => {
        if (this.isDragging) return;
        const offset = card._vfrOffset;
        if (offset === 0) { this.openActive(); }
        else if (offset !== null && offset !== undefined) { this.goTo(offset); }
      });
    });

    // Keyboard — only when video modal is closed
    document.addEventListener('keydown', (e) => {
      const modal = document.getElementById('videoModal');
      if (modal && modal.classList.contains('vm-open')) return;
      if (e.key === 'ArrowLeft')  this.prev();
      if (e.key === 'ArrowRight') this.next();
    });

    // Mouse wheel (debounced 400ms)
    this.container.addEventListener('wheel', (e) => {
      const now = Date.now();
      if (now - this.lastWheelTime < 400) return;
      const isHorizontal = Math.abs(e.deltaX) > Math.abs(e.deltaY);
      const delta = isHorizontal ? e.deltaX : e.deltaY;
      if (Math.abs(delta) > 20) {
        delta > 0 ? this.next() : this.prev();
        this.lastWheelTime = now;
      }
    }, { passive: true });

    // Pointer drag / swipe
    this.container.addEventListener('pointerdown', (e) => {
      this.isDragging = false;
      this.dragStartX = e.clientX;
    });
    this.container.addEventListener('pointermove', (e) => {
      if (Math.abs(e.clientX - this.dragStartX) > 5) this.isDragging = true;
    });
    this.container.addEventListener('pointerup', (e) => {
      if (!this.isDragging) return;
      const dx = e.clientX - this.dragStartX;
      if (Math.abs(dx) > 60) { dx < 0 ? this.next() : this.prev(); }
      setTimeout(() => { this.isDragging = false; }, 50);
    });
  }
}
```

- [ ] **Step 2: Run the unit tests — they should now pass**

```bash
npm run test:unit -- video-focus-rail
```

Expected: all 8 tests PASS.

- [ ] **Step 3: Commit**

```bash
git add Script.js video-focus-rail.test.js
git commit -m "feat: add VideoFocusRail class and unit tests"
```

---

## Task 4: HTML — Add #videoFocusRail block to index.html

**Files:**
- Modify: `index.html` (insert after line 804, before line 806)

The block goes between the `.section-desc` div (line 804) and the `.vw-filters` div (line 806).

- [ ] **Step 1: Insert the FocusRail HTML block**

In `index.html`, find this exact line (around line 804):
```html
      <div class="section-desc" id="videoDesc" style="max-width: 580px;">Cinematic films for weddings, engagements &amp; life's most intimate milestones.</div>
```

Insert the following block **after** that line and **before** the `<div class="vw-filters reveal">` line:

```html
    </div><!-- /video-intro -->

    <!-- ── VIDEO FOCUS RAIL ── -->
    <div id="videoFocusRail" class="vfr-wrap reveal">
      <div class="vfr-ambience" aria-hidden="true">
        <img class="vfr-amb-img vfr-amb-a" src="" alt="">
        <img class="vfr-amb-img vfr-amb-b" src="" alt="">
        <div class="vfr-amb-overlay"></div>
      </div>
      <div class="vfr-stage">
        <div class="vfr-card"
          data-video="https://vz-757250d0-999.b-cdn.net/e970988b-a8ce-41a5-8e75-4c12c1afac81/playlist.m3u8"
          data-poster="/images/video-covers/wedding/pooja-amit/cover.jpg"
          data-title="Pooja &amp; Amit"
          data-type="Wedding Film"
          data-desc="A timeless wedding story told through light, motion, and quiet ceremony."></div>
        <div class="vfr-card"
          data-video="https://vz-757250d0-999.b-cdn.net/f8156d9b-53cb-415d-9d0a-c0fc05ba26e1/playlist.m3u8"
          data-poster="/images/video-covers/engagement/vyshnavi-daniel.jpg"
          data-title="Vyshnavi &amp; Daniel"
          data-type="Engagement Film"
          data-desc="Love found across cultures, captured in Philadelphia's golden afternoon."></div>
        <div class="vfr-card"
          data-video="https://vz-757250d0-999.b-cdn.net/9003fec7-04b8-4e5a-95f9-6f659354e0dc/playlist.m3u8"
          data-poster="/images/video-covers/wedding/abhinav-megha/cover.jpg"
          data-title="Abhinav &amp; Megha"
          data-type="Wedding Film"
          data-desc="A Houston wedding — tradition, joy, and cinematic grandeur distilled into one film."></div>
        <div class="vfr-card"
          data-video="https://vz-757250d0-999.b-cdn.net/fb52713c-9ec3-4767-9f74-8049d844cb70/playlist.m3u8"
          data-poster="/images/video-covers/conceptual/sameeksha-nyc.jpg"
          data-title="Sameeksha NYC"
          data-type="Conceptual Film"
          data-desc="New York through a conceptual lens — raw energy, city light, and a singular presence."></div>
        <div class="vfr-card"
          data-video="https://vz-757250d0-999.b-cdn.net/2b8a87cf-cc32-4851-aaf7-af3a5081fb89/playlist.m3u8"
          data-poster="/images/video-covers/prewedding/suprith-pragnya.jpg"
          data-title="Suprith &amp; Pragnya"
          data-type="Pre-Wedding Film"
          data-desc="The season before forever — a pre-wedding film wrapped in warmth and wonder."></div>
        <div class="vfr-card"
          data-video="https://vz-757250d0-999.b-cdn.net/84eadf17-2905-472d-a355-115a13141a26/playlist.m3u8"
          data-poster="/images/video-covers/conceptual/darzi-suits.jpg"
          data-title="Darzi Suits"
          data-type="Brand Film"
          data-desc="Where heritage meets modern craft — a brand film for a new era of Indian fashion."></div>
      </div>
      <div class="vfr-info">
        <div class="vfr-text">
          <div class="vfr-meta"></div>
          <div class="vfr-title"></div>
          <div class="vfr-desc"></div>
        </div>
        <div class="vfr-controls">
          <div class="vfr-ctrl-pill">
            <button class="vfr-ctrl-btn vfr-prev" aria-label="Previous film">&#8249;</button>
            <span class="vfr-count"></span>
            <button class="vfr-ctrl-btn vfr-next" aria-label="Next film">&#8250;</button>
          </div>
          <button class="vfr-watch-btn">Watch Film &#9654;</button>
        </div>
      </div>
    </div>

    <!-- ── ALL FILMS DIVIDER ── -->
    <div class="vfr-divider">
      <div class="vfr-divider-line"></div>
      <span class="vfr-divider-label">All Films</span>
      <div class="vfr-divider-line"></div>
    </div>
```

Also remove the now-orphaned closing `</div>` that was part of `.video-intro` — check the original HTML: the `<div class="video-intro">` (line 801) closes after line 804. The replacement above includes `</div><!-- /video-intro -->` explicitly.

- [ ] **Step 2: Verify the structure looks correct in a browser**

```bash
npx serve . -p 8080
```

Open `http://localhost:8080` → scroll to Video Works. The FocusRail block should be visible but without cards rendered yet (instantiation comes in Task 5).

- [ ] **Step 3: Commit**

```bash
git add index.html
git commit -m "feat: add VideoFocusRail HTML block to Video Works section"
```

---

## Task 5: Instantiate VideoFocusRail in Script.js

**Files:**
- Modify: `Script.js` — the existing carousel-init IIFE (~line 2469)

- [ ] **Step 1: Add instantiation inside the carousel-init IIFE**

Find the existing IIFE that starts with:
```js
(function() {
  // 1. Run initial filters
  const allBtnPortfolio = document.querySelector('.portfolio-filters button.active');
```

Inside that IIFE, after the `videoCarousel` block (after `videoCarousel.rebuild();`), add:

```js
  // 3. Instantiate VideoFocusRail
  const vfrEl = document.getElementById('videoFocusRail');
  if (vfrEl) {
    window.videoFocusRail = new VideoFocusRail(vfrEl);
  }
```

- [ ] **Step 2: Verify in browser — cards should render with 3D layout**

```bash
npx serve . -p 8080
```

Open `http://localhost:8080`, scroll to Video Works. You should see:
- 5 cards in 3D coverflow (center card prominent, two flanking pairs progressively smaller/blurred)
- Film title, type, description visible below the rail
- Counter showing "1 / 6"
- Prev/Next buttons and "Watch Film" button present
- Blurred poster ambience in the background
- "All Films" divider, then filter pills, then the existing grid — all unchanged

- [ ] **Step 3: Verify navigation works**

- Click the right flanking card — should advance to the next film, counter updates to "2 / 6"
- Press `←` / `→` arrow keys — should cycle through films
- Scroll horizontally over the rail — should navigate
- Click "Watch Film" — should open the existing video modal with the correct film playing

- [ ] **Step 4: Commit**

```bash
git add Script.js
git commit -m "feat: instantiate VideoFocusRail in DOMContentLoaded init"
```

---

## Task 6: Playwright e2e smoke test

**Files:**
- Modify: `gallery.spec.js` (append new describe block)

- [ ] **Step 1: Append the smoke test**

At the end of `gallery.spec.js`, add:

```js
test.describe('Video Focus Rail', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    // Skip intro animation
    await page.evaluate(() => {
      const intro = document.getElementById('intro');
      if (intro) intro.style.display = 'none';
      document.body.classList.remove('intro-active');
    });
  });

  test('renders 6 film cards with the center card active', async ({ page }) => {
    await page.locator('#videoFocusRail').scrollIntoViewIfNeeded();
    const cards = page.locator('#videoFocusRail .vfr-card');
    await expect(cards).toHaveCount(6);
    await expect(page.locator('#videoFocusRail .vfr-card.is-center')).toHaveCount(1);
  });

  test('counter starts at 1 / 6', async ({ page }) => {
    await page.locator('#videoFocusRail').scrollIntoViewIfNeeded();
    await expect(page.locator('.vfr-count')).toHaveText('1 / 6');
  });

  test('clicking next button advances to film 2', async ({ page }) => {
    await page.locator('#videoFocusRail').scrollIntoViewIfNeeded();
    await page.locator('.vfr-next').click();
    await expect(page.locator('.vfr-count')).toHaveText('2 / 6');
  });

  test('clicking prev button from film 1 wraps to film 6', async ({ page }) => {
    await page.locator('#videoFocusRail').scrollIntoViewIfNeeded();
    await page.locator('.vfr-prev').click();
    await expect(page.locator('.vfr-count')).toHaveText('6 / 6');
  });

  test('Watch Film button opens video modal', async ({ page }) => {
    await page.locator('#videoFocusRail').scrollIntoViewIfNeeded();
    await page.locator('.vfr-watch-btn').click();
    await expect(page.locator('#videoModal')).toHaveClass(/vm-open/);
  });
});
```

- [ ] **Step 2: Run e2e tests**

```bash
npm run test:e2e -- --grep "Video Focus Rail"
```

Expected: all 5 tests PASS. If the local server isn't running, start it first:
```bash
npx serve . -p 8080
```
And ensure `playwright.config.js` has `baseURL: 'http://localhost:8080'`.

- [ ] **Step 3: Run full test suite to check for regressions**

```bash
npm test
```

Expected: all existing tests continue to pass.

- [ ] **Step 4: Commit**

```bash
git add gallery.spec.js
git commit -m "test: add Playwright smoke tests for VideoFocusRail"
```

---

## Self-Review Checklist

- **Spec coverage:**
  - ✅ 6 curated items with full data attrs (Task 4)
  - ✅ 3D coverflow transforms — `vfrCardStyle` formula (Task 3)
  - ✅ Ambience crossfade — `updateAmbience` (Task 3)
  - ✅ Info text animation — `updateInfo` with `vfr-exit`/`vfr-enter` (Task 3)
  - ✅ prev/next/goTo navigation (Task 3)
  - ✅ Keyboard arrows (modal-closed guard) (Task 3)
  - ✅ Mouse wheel debounced 400ms (Task 3)
  - ✅ Pointer drag swipe threshold 60px (Task 3)
  - ✅ Side card click calls `goTo(offset)` (Task 3)
  - ✅ Center card click calls `openActive()` → `openModal()` (Task 3)
  - ✅ CSS mobile collapse at 768px (Task 1)
  - ✅ `vfr-divider` separator (Task 4)
  - ✅ EtherealCarousel / portfolio / grid untouched
  - ✅ e2e smoke test (Task 6)

- **Placeholder scan:** No TBDs, TODOs, or vague steps found.

- **Type consistency:** `vfrWrap` / `vfrCardStyle` names used consistently across Task 2 (test), Task 3 (implementation). `_prevBtn`/`_nextBtn` in constructor match `.vfr-prev`/`.vfr-next` selectors in HTML (Task 4). `_vfrOffset` property set in `render()`, read in card click handler — consistent. `openModal` called via `typeof openModal === 'function'` guard — safe if DOM loads before script runs.
