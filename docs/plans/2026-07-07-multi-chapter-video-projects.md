# Multi-Chapter Video Projects Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let one Video Works grid tile represent a whole wedding project (Haldi / Sangeet / Wedding, etc.) instead of one tile per film, with an in-modal tab switcher to move between the project's films.

**Architecture:** A `.vw-card` gains an optional hidden `.vw-chapters` block (one `.vw-chapter` button per film). `openModal()` reads that block if present and renders tab pills in the video modal; clicking a tab reuses the existing HLS attach/teardown path to swap the playing video in place. Cards without `.vw-chapters` behave exactly as they do today — zero changes to `filterVideos()`, `EtherealCarousel`, or the hover-preview system, which all key off the outer `.vw-card`.

**Tech Stack:** Vanilla JS (ES6+), plain CSS, Playwright (`@playwright/test`) for e2e coverage. No build step.

## Global Constraints

- No changes to `filterVideos()` (Script.js:1516), `EtherealCarousel`, or the hover-preview IIFE (Script.js:1590) — they must keep operating on `.vw-card` exactly as today.
- Every existing single-video `.vw-card` (no `.vw-chapters`) must render and behave identically to before this plan — verified by re-running the full existing Playwright suite.
- No fabricated/fake video URLs in committed `index.html`. The new demo card uses empty `data-video=""` chapters (the same "Coming Soon" placeholder pattern already used by the "Baby Shower" and "Sweet Sixteen" cards), per user decision — real chapter URLs get swapped in when the user has actual footage for a multi-event wedding.
- Follow existing code conventions: CSS vars from `:root` (`var(--rose)`, `var(--ivory)`, etc.), `var(--ease)`/existing cubic-beziers for transitions, and the project's existing IIFE-per-concern structure in Script.js.
- Commits are local only — do not push (per project workflow rule: never auto-deploy).

---

### Task 1: Placeholder multi-chapter project card (content) + inert `.vw-chapters` data block

**Files:**
- Modify: `index.html:1005-1007` (insert new card between the existing Abhinav & Megha Wedding card and the `<!-- PRE-WEDDING VIDEOS -->` comment)
- Modify: `styles.css` (insert after the `.vw-duration` rule block, styles.css:3645)
- Test: Create `video-chapters.spec.js`

**Interfaces:**
- Produces: a real `.vw-card[data-title="Wedding Weekend"]` in `#vwGrid` with `data-vcat="wedding"` and a nested `.vw-chapters` container holding three `.vw-chapter` buttons (`data-label="Haldi"|"Sangeet"|"Wedding"`, each `data-video=""`, `data-type="<Label> Film"`). The first chapter (`Haldi`) carries class `active`. Later tasks read this fixture; do not rename `data-label`/`data-video`/`data-type`/`active`.

- [ ] **Step 1: Write the failing test**

Create `video-chapters.spec.js`:

```js
const { test, expect } = require('@playwright/test');

test.describe('Multi-chapter video projects', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#intro')).toBeHidden({ timeout: 10000 });
    await page.locator('#video-works').scrollIntoViewIfNeeded();
    await page.locator('.vw-filters button[data-filter="wedding"]').click();
  });

  test('renders a hidden chapter data block on the placeholder multi-event project', async ({ page }) => {
    const card = page.locator('.vw-card[data-title="Wedding Weekend"]');
    await expect(card).toBeVisible();

    const chapters = card.locator('.vw-chapter');
    await expect(chapters).toHaveCount(3);
    await expect(chapters.nth(0)).toHaveAttribute('data-label', 'Haldi');
    await expect(chapters.nth(1)).toHaveAttribute('data-label', 'Sangeet');
    await expect(chapters.nth(2)).toHaveAttribute('data-label', 'Wedding');

    // .vw-chapters is a hidden data source, not a visible grid element
    await expect(card.locator('.vw-chapters')).toBeHidden();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx playwright test video-chapters.spec.js`
Expected: FAIL — `.vw-card[data-title="Wedding Weekend"]` not found (card doesn't exist yet).

- [ ] **Step 3: Add the placeholder card to index.html**

In `index.html`, insert immediately after line 1005 (the closing `</div>` of the Abhinav & Megha Wedding card) and before the `<!-- PRE-WEDDING VIDEOS -->` comment on line 1007:

```html
      <!-- MULTI-EVENT WEDDING PROJECT (placeholder — swap empty data-video/data-poster for real chapter footage when available) -->
      <div class="vw-card vw-gi-5" data-vcat="wedding" data-video="" data-title="Wedding Weekend" data-type="Haldi Film" data-poster="">
        <div class="vw-poster vw-gi-5"></div>
        <div class="vw-play-wrap">
          <div class="vw-play-ring"></div>
          <div class="vw-play-icon">
            <svg viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>
          </div>
        </div>
        <div class="vw-overlay">
          <div class="vw-badge">Wedding</div>
          <h4>Wedding Weekend</h4>
          <p>Haldi Film</p>
        </div>
        <div class="vw-duration">Coming Soon</div>
        <div class="vw-chapters">
          <button class="vw-chapter active" data-label="Haldi" data-video="" data-type="Haldi Film"></button>
          <button class="vw-chapter" data-label="Sangeet" data-video="" data-type="Sangeet Film"></button>
          <button class="vw-chapter" data-label="Wedding" data-video="" data-type="Wedding Film"></button>
        </div>
      </div>
```

- [ ] **Step 4: Hide `.vw-chapters` in the grid**

In `styles.css`, immediately after the `.vw-duration` block (after `.vw-card:hover .vw-duration { opacity: 1; }`, styles.css:3645) and before the `/* ── Video Modal ── */` comment, add:

```css
/* Hidden data source for multi-chapter (Haldi/Sangeet/Wedding) projects — read by JS on modal open, never shown in the grid */
.vw-chapters { display: none; }
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx playwright test video-chapters.spec.js`
Expected: PASS

- [ ] **Step 6: Run full existing suite for regressions**

Run: `npm run test:e2e`
Expected: all existing specs (`gallery.spec.js`, `mobile.integration.spec.js`, `about-redesign.spec.js`, etc.) still PASS — confirms the new card doesn't disturb existing video-works behavior.

- [ ] **Step 7: Commit**

```bash
git add index.html styles.css video-chapters.spec.js
git commit -m "feat: add placeholder multi-chapter wedding project card"
```

---

### Task 2: Auto-computed "N Films" badge

**Files:**
- Modify: `Script.js` (insert new IIFE after the poster-observer IIFE, Script.js:1588, before the hover-preview IIFE at Script.js:1590)
- Modify: `styles.css` (insert after the `.vw-chapters` rule added in Task 1)
- Test: `video-chapters.spec.js` (extend)

**Interfaces:**
- Consumes: `.vw-chapter` elements produced by Task 1 (any `.vw-card` with 2+ `.vw-chapter` children).
- Produces: a `.vw-badge-count` element appended as the last child of any `.vw-card` with 2+ chapters, `textContent` = `"<count> Films"`. Task 3 does not depend on this badge, but must not remove it.

- [ ] **Step 1: Write the failing test**

Add to `video-chapters.spec.js` inside the existing `describe` block:

```js
  test('shows an auto-computed "N Films" badge on multi-chapter projects', async ({ page }) => {
    const card = page.locator('.vw-card[data-title="Wedding Weekend"]');
    await expect(card.locator('.vw-badge-count')).toHaveText('3 Films');
  });

  test('does not show a films badge on single-video cards', async ({ page }) => {
    const card = page.locator('.vw-card[data-title="Pooja & Amit"]');
    await expect(card.locator('.vw-badge-count')).toHaveCount(0);
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx playwright test video-chapters.spec.js`
Expected: FAIL — `.vw-badge-count` not found on the "Wedding Weekend" card (badge logic doesn't exist yet).

- [ ] **Step 3: Implement the badge JS**

In `Script.js`, immediately after the poster-observer IIFE's closing `})();` (Script.js:1588) and before the `// Hover muted preview ...` comment (Script.js:1590), add:

```js
// Auto-compute "N Films" badge for multi-chapter video projects (Haldi/Sangeet/Wedding, etc.)
// Count is derived from .vw-chapter children so it can't drift out of sync when a chapter is added.
(function() {
  document.querySelectorAll('.vw-card').forEach(card => {
    const chapterCount = card.querySelectorAll('.vw-chapter').length;
    if (chapterCount < 2) return;
    const badge = document.createElement('div');
    badge.className = 'vw-badge-count';
    badge.textContent = `${chapterCount} Films`;
    card.appendChild(badge);
  });
})();
```

- [ ] **Step 4: Implement the badge CSS**

In `styles.css`, immediately after the `.vw-chapters { display: none; }` rule added in Task 1, add:

```css
/* "N Films" badge for multi-chapter projects — always visible (unlike .vw-duration's hover-only reveal) */
.vw-badge-count {
  position: absolute; top: 1rem; left: 1rem; z-index: 5;
  font-size: 0.49rem; letter-spacing: 0.08em;
  color: rgba(250,246,241,0.8);
  background: rgba(9,8,11,0.5);
  backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px);
  border: 1px solid rgba(250,246,241,0.08);
  padding: 0.25rem 0.65rem; border-radius: 20px;
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx playwright test video-chapters.spec.js`
Expected: PASS (all 4 tests so far)

- [ ] **Step 6: Commit**

```bash
git add Script.js styles.css video-chapters.spec.js
git commit -m "feat: auto-compute films-count badge for multi-chapter video cards"
```

---

### Task 3: In-modal chapter tabs

**Files:**
- Modify: `index.html:1396-1397` (insert `.vm-chapters` tab row between `.vm-header` and `.vm-stage`)
- Modify: `styles.css` (insert after `.vm-subtitle`, styles.css:3682-3685)
- Modify: `Script.js:1660-1871` (add `vmChapters` const, `loadModalSrc`/`renderChapterTabs`/`selectChapter` functions, update `openModal`)
- Test: `video-chapters.spec.js` (extend)

**Interfaces:**
- Consumes: `.vw-chapter` elements (Task 1) and `.vw-badge-count` (Task 2, unaffected by this task).
- Produces: `#vmChapters` element in the DOM; `openModal(card)` signature unchanged (still takes the clicked `.vw-card` element). No other task depends on new function names here, but keep `loadModalSrc(src, requestId)`, `renderChapterTabs(chapters, defaultChapter)`, and `selectChapter(chapter, tab)` names — they're referenced together in this task's own steps.

- [ ] **Step 1: Write the failing tests**

Add to `video-chapters.spec.js` inside the existing `describe` block:

```js
  test('opens the modal on the default chapter and lists chapter tabs', async ({ page }) => {
    await page.locator('.vw-card[data-title="Wedding Weekend"]').click();
    await expect(page.locator('#videoModal')).toHaveClass(/vm-open/);

    const tabs = page.locator('#vmChapters .vm-chapter-tab');
    await expect(tabs).toHaveCount(3);
    await expect(tabs.nth(0)).toHaveText('Haldi');
    await expect(tabs.nth(0)).toHaveClass(/active/);
    await expect(page.locator('#vmSubtitle')).toHaveText('Haldi Film');
  });

  test('switches chapters in place without closing the modal', async ({ page }) => {
    await page.locator('.vw-card[data-title="Wedding Weekend"]').click();
    await expect(page.locator('#videoModal')).toHaveClass(/vm-open/);

    const tabs = page.locator('#vmChapters .vm-chapter-tab');
    await tabs.nth(1).click(); // Sangeet
    await expect(page.locator('#videoModal')).toHaveClass(/vm-open/); // still open
    await expect(tabs.nth(1)).toHaveClass(/active/);
    await expect(tabs.nth(0)).not.toHaveClass(/active/);
    await expect(page.locator('#vmSubtitle')).toHaveText('Sangeet Film');

    await tabs.nth(2).click(); // Wedding
    await expect(page.locator('#vmSubtitle')).toHaveText('Wedding Film');
  });

  test('resets to the default chapter when reopened', async ({ page }) => {
    const card = page.locator('.vw-card[data-title="Wedding Weekend"]');
    await card.click();
    await page.locator('#vmChapters .vm-chapter-tab').nth(2).click(); // Wedding
    await expect(page.locator('#vmSubtitle')).toHaveText('Wedding Film');

    await page.locator('#vmClose').click();
    await expect(page.locator('#videoModal')).not.toHaveClass(/vm-open/);

    await card.click();
    await expect(page.locator('#vmSubtitle')).toHaveText('Haldi Film');
    await expect(page.locator('#vmChapters .vm-chapter-tab').nth(0)).toHaveClass(/active/);
  });

  test('single-video cards still open without a chapter tab row', async ({ page }) => {
    await page.locator('.vw-card[data-title="Pooja & Amit"]').click();
    await expect(page.locator('#videoModal')).toHaveClass(/vm-open/);
    await expect(page.locator('#vmChapters')).toBeHidden();
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx playwright test video-chapters.spec.js`
Expected: FAIL — `#vmChapters` doesn't exist yet.

- [ ] **Step 3: Add the tab row markup**

In `index.html`, insert between the `.vm-header` closing `</div>` (line 1396) and the `.vm-stage` opening tag (line 1397):

```html
    <div class="vm-chapters" id="vmChapters" hidden></div>
```

- [ ] **Step 4: Add the tab row CSS**

In `styles.css`, immediately after the `.vm-subtitle { ... }` rule (styles.css:3682-3685) and before the `.vm-close` comment/rule, add:

```css
.vm-chapters {
  display: flex; flex-wrap: wrap; gap: 0.5rem;
  margin: -0.4rem 0 1.2rem;
}
/* Author rule above always beats the UA [hidden] rule on specificity/origin,
   so the hidden attribute needs an explicit override to actually hide the row. */
.vm-chapters[hidden] { display: none; }
.vm-chapter-tab {
  font-family: var(--font-body); font-size: 0.49rem;
  letter-spacing: 0.15em; text-transform: uppercase;
  color: rgba(250,246,241,0.45);
  background: rgba(255,255,255,0.04);
  border: 1px solid rgba(250,246,241,0.12);
  padding: 0.4rem 0.9rem; border-radius: 999px;
  cursor: pointer; transition: color 0.3s, border-color 0.3s, background 0.3s;
}
.vm-chapter-tab:hover { color: var(--ivory); }
.vm-chapter-tab.active {
  color: var(--rose); border-color: rgba(201,149,107,0.5);
  background: rgba(201,149,107,0.08);
}
```

- [ ] **Step 5: Wire up the JS**

In `Script.js`, add `vmChapters` to the const block (Script.js:1660-1676), right after `const vmSub    = document.getElementById('vmSubtitle');`:

```js
  const vmChapters = document.getElementById('vmChapters');
```

Replace the body of `openModal` (Script.js:1826-1871) — everything from `async function openModal(card) {` through its closing `}` — with:

```js
  async function loadModalSrc(src, requestId) {
    if (src) {
      await attachHLS(vmVideo, src, requestId);
      if (requestId !== modalRequestId) return;
      vmStage.classList.add('vm-has-video');
      syncPlayToggle();
      if (vmFill) vmFill.style.width = '0%';
    } else {
      vmVideo.pause();
      if (activeHls) { activeHls.destroy(); activeHls = null; }
      vmVideo.src = '';
      vmStage.classList.remove('vm-has-video');
      syncPlayToggle();
    }
  }

  function renderChapterTabs(chapters, defaultChapter) {
    if (!vmChapters) return;
    vmChapters.innerHTML = '';
    if (chapters.length < 2) {
      vmChapters.hidden = true;
      return;
    }
    vmChapters.hidden = false;
    chapters.forEach(chapter => {
      const tab = document.createElement('button');
      tab.type = 'button';
      tab.className = 'vm-chapter-tab' + (chapter === defaultChapter ? ' active' : '');
      tab.textContent = chapter.dataset.label || '';
      tab.setAttribute('aria-pressed', chapter === defaultChapter ? 'true' : 'false');
      tab.addEventListener('click', () => selectChapter(chapter, tab));
      vmChapters.appendChild(tab);
    });
  }

  async function selectChapter(chapter, tab) {
    if (tab.classList.contains('active')) return;
    Array.from(vmChapters.children).forEach(el => {
      el.classList.remove('active');
      el.setAttribute('aria-pressed', 'false');
    });
    tab.classList.add('active');
    tab.setAttribute('aria-pressed', 'true');
    vmSub.textContent = chapter.dataset.type || '';
    const requestId = ++modalRequestId;
    await loadModalSrc(chapter.dataset.video, requestId);
  }

  async function openModal(card) {
    const chapters = Array.from(card.querySelectorAll('.vw-chapter'));
    const defaultChapter = chapters.find(ch => ch.classList.contains('active')) || chapters[0];
    const src  = chapters.length ? defaultChapter.dataset.video : card.dataset.video;
    const type = chapters.length ? (defaultChapter.dataset.type || '') : (card.dataset.type || '');
    const requestId = ++modalRequestId;
    if (typeof window.aakaaraStopVideoWorkPreviews === 'function') {
      window.aakaaraStopVideoWorkPreviews({ unload: true });
    }
    document.dispatchEvent(new CustomEvent('aakaara:modal-video-open'));
    modalLastFocusedEl = document.activeElement instanceof HTMLElement ? document.activeElement : card;
    vmTitle.textContent = card.dataset.title || '';
    vmSub.textContent   = type;
    renderChapterTabs(chapters, defaultChapter);

    // GA4 FIX: fire video_play event — marks this as an engagement conversion in GA4.
    // video_type matches the playing chapter (or the card badge for single-video cards).
    if (typeof gtag === 'function') {
      gtag('event', 'video_play', {
        event_category: 'Video',
        event_label: card.dataset.title || 'Unknown',
        video_type: type || 'Unknown',
        video_category: card.dataset.vcat || 'Unknown'
      });
    }

    modalScrollY = window.scrollY || window.pageYOffset || 0;
    vmVideo.muted = true;
    vmVideo.volume = 1;
    vmVideo.playsInline = true;
    vmVideo.setAttribute('muted', '');
    vmVideo.setAttribute('playsinline', '');
    vmVideo.setAttribute('webkit-playsinline', 'true');
    syncMuteToggle();
    modal.classList.add('vm-open');
    lockModalScroll(modalScrollY);
    requestAnimationFrame(() => modal.focus({ preventScroll: true }));

    await loadModalSrc(src, requestId);
  }
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `npx playwright test video-chapters.spec.js`
Expected: PASS (all tests, including Task 1 & 2's)

- [ ] **Step 7: Run full existing suite for regressions**

Run: `npm run test:e2e`
Expected: all existing specs still PASS — confirms single-video cards (Pooja & Amit, etc.) and the keyboard-shortcut/skip-control logic in the modal are unaffected.

- [ ] **Step 8: Commit**

```bash
git add index.html styles.css Script.js video-chapters.spec.js
git commit -m "feat: add in-modal chapter tabs for multi-event wedding projects"
```

---

### Task 4: Document the authoring pattern

**Files:**
- Modify: `CLAUDE.md` ("Adding Content" section and "Recent Changes" section)

**Interfaces:** None — documentation only.

- [ ] **Step 1: Add authoring instructions**

In `CLAUDE.md`, under the `## Adding Content` section, after the existing "**New video card:**" bullet, add:

```markdown
**New multi-event wedding project (Haldi/Sangeet/Wedding, etc.):** Instead of one `.vw-card` per film, author a single `.vw-card` (its own `data-video`/`data-type` should point at the default/hero film) and add a nested `<div class="vw-chapters">` with one `<button class="vw-chapter" data-label="..." data-video="..." data-type="...">` per event. Mark exactly one chapter `active` to control which film plays by default when the modal opens. The grid tile auto-shows an "N Films" badge; the video modal auto-shows chapter tabs. See the "Wedding Weekend" placeholder card in `index.html` for a working example.
```

- [ ] **Step 2: Note the change in Recent Changes**

In `CLAUDE.md`, under `## Recent Changes (March–April 2026)`, add a new bullet:

```markdown
- **Multi-chapter video projects**: `.vw-card` can now group multiple films (Haldi/Sangeet/Wedding) under one grid tile via a nested `.vw-chapters` block, with in-modal tabs to switch between them and an auto-computed "N Films" badge.
```

- [ ] **Step 3: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: document multi-chapter video project authoring pattern"
```
