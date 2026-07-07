The user provided the text inline rather than a file path. I'll apply the compression rules directly per the skill.

# CLAUDE.md

Guidance for Claude Code (claude.ai/code) when working with this repo.

## Site Overview

Aakaara Studios NYC — static photography portfolio. No build step, no framework. Pure HTML/CSS/JS on Netlify. ~7,600 lines total.

- **URL**: https://www.aakaarastudiosnyc.com/
- **Deployment**: Netlify (auto-deploy from repo root)
- **Tech stack**: HTML5, CSS3, Vanilla JS (ES6+), HLS.js, Flatpickr, Formspree

## Running the Site Locally

```bash
# Any static file server works. Examples:
npx serve .
python3 -m http.server 8080
```

Open `http://localhost:8080`. Site **must** be served (not opened as `file://`) — image paths use absolute roots (`/images/...`).

## Running Tests

```bash
npm test           # All tests (unit + e2e)
npm run test:unit  # Vitest unit tests only
npm run test:e2e   # Playwright e2e tests only
```

Test files: `gallery.spec.js`, `location-guide.test.js`, `mobile.integration.spec.js`

## Deployment

```toml
# netlify.toml
[build]
  command = "echo 'Static site — no build needed'"
  publish = "."
```

**`_redirects`**:
```
/the-experience.html   /couple-portraits.html   301
/*                     /404.html                404
```

## File Structure

### Root-level files

| File | Purpose |
|------|---------|
| `index.html` | Main site (intro → hero → portfolio → films → about → services → testimonials → contact → footer) |
| `couple-portraits.html` | Gallery page for couple portraits |
| `404.html` / `thank-you.html` | Utility pages |
| `styles.css` | All styles (~3,568 lines) |
| `Script.js` | All JS for `index.html` (~2,553 lines) |
| `favicon.svg` | Site logo SVG favicon |
| `package.json` | Dev deps: Vitest, Playwright |
| `playwright.config.js` / `vitest.config.js` | Test config |

### Directories

| Directory | Purpose |
|-----------|---------|
| `/images/` | Photography assets by category (see Image Directory below) |
| `/templates/` | Reusable `header.html`, `footer.html`, `include.js` loader |
| `/tools/` | Utility pages: business cards, Instagram DP, carousel templates |
| `/admin/` | Internal dashboard, quote generator, contract generator |
| `/docs/` | Planning docs and brainstorm notes |
| `/build/` | Python/Ruby build and image optimization scripts |

### Templates (`/templates/`)

`include.js` fetches + injects `header.html` / `footer.html` before `Script.js`. Sub-pages use to avoid markup duplication.

### Tools (`/tools/`)

| File | Purpose |
|------|---------|
| `business-card.html` | Dark cinematic business card |
| `business-card-print.html` | Print-to-PDF version |
| `generate-card-pdf.py` | reportlab-based PDF generator |
| `insta-carousel.html` | Instagram carousel animation tool |
| `insta-dp.html` | Instagram DP editor |
| `dp dark and moody.html` | Dark profile picture tool |

### Admin (`/admin/`)

| File | Purpose |
|------|---------|
| `dashboard.html` / `dashboard.js` / `dashboard.css` | Quote management dashboard (localStorage-based) |
| `quote-generator.html` / `.js` / `.css` | Quote creation form with PDF export |
| `contract-generator.html` | HTML contract builder |

### Image Directory

```
/images/
├── about/
├── conceptual/        (9 sub-folders)
├── couple-portraits/  (13 sub-folders)
├── engagement/        (3 sub-folders)
├── first-birthday/    (3 sub-folders)
├── graduation/        (4 sub-folders)
├── house-warming/     (4 sub-folders)
├── maternity/         (3 sub-folders)
├── nyc/               (location guides)
├── nyfw-runway/       (fashion/runway)
└── video-covers/      (7 sub-folders)
```

Each project folder uses numbered images: `1.jpg`, `2.jpg`, … `N.jpg`.

## Architecture & Key Patterns

### Gallery System

Gallery items in `index.html` use data attrs — no server logic:

```html
<a class="gallery-item" data-folder="/images/weddings/pooja-amit" data-count="10" data-ext="jpg" onclick="openSwGallery(this); return false;">
```

`Script.js` builds URLs as `${folder}/${1..count}.${ext}`. Cover defaults to `folder/1.jpg` unless `data-cover` set. Lazy-loaded via `IntersectionObserver`.

All gallery items require: `data-cat`, `data-title`, `data-type`, `data-folder`, `data-count`. Optional: `data-ext` (default: `jpg`), `data-cover`.

### Cinematic Gallery Viewer (`openSwGallery`)

Defined in IIFE in `Script.js`, exposed as `window.openSwGallery`. Handles swipe, keyboard nav, filmstrip dock, parallax. Called from inline `onclick` on every gallery item.

### Ethereal Coverflow Carousel (`EtherealCarousel` class)

Portfolio + video grids wrapped in `.ethereal-carousel`, driven by `EtherealCarousel` class. The carousel:
- Positions cards via JS `transform` (not CSS grid) using `data-ec-offset` attrs (`"0"` = center, `"1"`/`"-1"` = sides, `"hidden"` = offscreen)
- `portfolioCarousel` and `videoCarousel` are global `let` vars reset when filters change via `filterGallery()` / `filterVideos()`
- Falls back to native scroll for `prefers-reduced-motion` users

### Cinematic Services Scroll Stack (`#services`)

`.cs-wrapper` is `700vh` tall (intentional, all screen sizes). `.cs-sticky-zone` is `position: sticky; top: 0; height: 100vh`. JS reads `scrollY` vs `wrapTop`, translates each `.cs-panel` via `translateY()` for slide-over wipe. Videos are HLS streams via `hls.js` with image/gradient fallback chain.

### Intro Animation & Sub-page Navigation

`body.intro-active` locks scroll during 4s intro. Skipped when `sessionStorage.getItem('skipIntro') === '1'`. When linking to `couple-portraits.html`, always set both:

```js
sessionStorage.setItem('skipIntro', '1');
sessionStorage.setItem('returnScrollY', window.scrollY);
```

intro won't replay + scroll position restored on return.

### Video Modal

HLS (`.m3u8`) via `hls.js` on supported browsers, native `<video src>` on Safari. `activeHls` destroyed on close to prevent memory leaks. Video cards have muted hover-preview inline.

**Keyboard shortcuts** (modal open): `Space`/`K` = play/pause, `J`/`←` = skip back 5s, `L`/`→` = skip forward 5s, `F` = fullscreen, `M` = mute.

### Contact Form

`action="https://formspree.io/f/xlgwznnz"` — AJAX via `fetch`. Success → `thank-you.html`. Honeypot `name="_gotcha"` for bot filtering.

Date picker uses **Flatpickr** on desktop and native `<input type="date">` on touch devices.

## Global JavaScript State

```
portfolioCarousel      EtherealCarousel instance for the gallery grid
videoCarousel          EtherealCarousel instance for the video grid
activeHls              Current HLS.js instance in the video modal
serviceHlsInstances    Array of HLS instances in the scroll-stack panels
```

Global functions exposed to inline HTML:
- `openSwGallery(element)` — opens cinematic gallery viewer
- `filterGallery(cat, btn)` — filter portfolio by category
- `triggerSkip(seconds)` — skip ±5s in video modal

## Adding Content

**New gallery project:** Copy `<a class="gallery-item">` inside `#galleryGrid`, set `data-cat`, `data-title`, `data-type`, `data-folder`, `data-count`. Place images as `1.jpg`…`N.jpg` in folder.

**New video card:** Copy `<div class="vw-card">` inside `#vwGrid`, set `data-vcat`, `data-video` (HLS `.m3u8` or empty for "Coming Soon"), `data-poster`, `data-title`, `data-type`.

**New multi-event wedding project (Haldi/Sangeet/Wedding, etc.):** Instead of one `.vw-card` per film, author a single `.vw-card` (its own `data-video`/`data-type` should point at the default/hero film) and add a nested `<div class="vw-chapters">` with one `<button class="vw-chapter" data-label="..." data-video="..." data-type="...">` per event. Mark exactly one chapter `active` to control which film plays by default when the modal opens. The grid tile auto-shows an "N Films" badge; the video modal auto-shows chapter tabs. See the "Wedding Weekend" placeholder card in `index.html` for a working example.

**Gradient fallback classes:** Gallery `gi-1`–`gi-8`; video `vw-gi-1`–`vw-gi-8`. Defined in `styles.css`. Reuse or add following same pattern.

## CSS Conventions

CSS vars in `:root` at top of `styles.css`. Use vars (`var(--rose)`, `var(--ivory)`) not raw hex.

**Key variables:**
```css
--noir: #09080b;        /* Deep black background */
--umber: #1e1a16;       /* Dark brown */
--rose: #c9956b;        /* Signature bronze/rose accent */
--rose-light: #dbb08a;
--ivory: #faf6f1;
--champagne: #f2e6d9;
--font-display: 'Cormorant Garamond';
--font-body: 'Outfit';
--ease: cubic-bezier(0.16, 1, 0.3, 1);
```

- Responsive breakpoints: `1024px` (tablet), `768px` (mobile), `480px` (small phone).
- `@media (max-width: 768px)` block near bottom of `styles.css` — all mobile overrides there.
- `backdrop-filter` used throughout; pair with `-webkit-backdrop-filter` + solid fallback `background` for Firefox Android:

```css
backdrop-filter: blur(12px);
-webkit-backdrop-filter: blur(12px);
background: rgba(24, 21, 24, 0.68); /* solid fallback */
```

- `.vw-filters` mobile override must appear **after** base `.vw-filters` in `styles.css` for specificity.

## Logo & Branding Consistency

Aakaara logo consistent across **header nav**, **hero intro**, **footer**:
- **4 organic petals** with gradually decreasing opacity (0.85 → 0.55 → 0.35 → 0.2)
- Petal shapes are organic (not perfect ovals)
- **Visarga dots** positioned above second letter "a" in "Aakaara" — close to text, not floating high above

## Footer Connect Icons

Footer "Connect" links have inline SVG icons:
- Instagram (camera icon), Email Us (envelope), Call Us (phone)
- Icons use `display: flex; align-items: center; gap: 0.5rem`
- Icons are 50% opacity, brighten to 100% on hover

## Video Player — 5-Second Skip Controls

`#videoModal` has YouTube-style skip controls:
- **Control bar buttons**: Rewind 5s and Forward 5s buttons between play/pause and progress bar
- **On-screen overlays**: `.vm-skip-overlay` with ripple animation on left/right sides of video
- **Keyboard support**: Left/Right arrow keys skip 5 seconds when modal is open
- JS function `triggerSkip(seconds)` handles both button clicks and keyboard events
- Elements: `#vmSkipBackBtn`, `#vmSkipFwdBtn`, `#vmSkipBack`, `#vmSkipFwd`

## Portfolio Filter Pills

- **Desktop**: Keyframe-based intro animation with staggered delays (`filterPillIn`)
- **Mobile (≤768px)**: Horizontal scroll strip (`flex-wrap: nowrap; overflow-x: auto`) for both `.portfolio-filters` and `.vw-filters`
- Interaction transitions snappy (`0.15s`) — separated from intro animation

## Admin Dashboard (`admin/dashboard.js`)

- localStorage-based quote management; mock data fallback when empty
- Quote record shape: `{ id, clientName, clientEmail, eventDate, eventDateTo, status, quotedPrice, confirmedPrice }`
- Delete uses two-click confirm: first click shows "Sure?", auto-reverts after 5s, second click within 5s confirms deletion
- Calendar visualization with event date indicators

## Business Card (`tools/business-card.html`)

- Dark cinematic design (01 — Dark Cinematic palette)
- Editorial asymmetric layout: name + role bottom-left, logo centered
- Print HTML version at `tools/business-card-print.html`
- PDF generator at `tools/generate-card-pdf.py` (uses reportlab)

## Recent Changes (March–April 2026)

- **Carousel animations**: Cinematic animations (wipeUp, fadeUp, fadeIn, lineGrow) in `tools/insta-carousel.html` via `IntersectionObserver`.
- **Mobile scroll-stack**: Services use `position: sticky` + `translateY` on all screen sizes (old "reels mode" removed).
- **Mobile filter pills**: Horizontal scroll strip for portfolio + video filters on mobile.
- **Video modal skip controls**: 5-second skip with on-screen ripple overlays and keyboard shortcuts.
- **Production header CTA**: Improved contrast for accessibility.
- **Code refactoring**: Removed unused code, standardized structure, removed broken GitHub Actions (Netlify only).
- **Testing infrastructure added**: Vitest unit tests + Playwright e2e tests.
- **Multi-chapter video projects**: `.vw-card` can now group multiple films (Haldi/Sangeet/Wedding) under one grid tile via a nested `.vw-chapters` block, with in-modal tabs to switch between them and an auto-computed "N Films" badge.

## Known Constraints

- **Testimonials** (`#testimonials`) — placeholder copy, replace before publishing.
- **Bhandhavi graduation** (`/images/graduation/bhandhavi`) — `data-folder` corrected but disk folder may differ, verify before deploy.
- `#services` scroll stack **700vh on all screen sizes** by design (mobile UX trade-off).
- **Business card PDF**: reportlab PDF won't match HTML exactly. Use browser print-to-PDF from `business-card-print.html` with "Background graphics" enabled.
- `styles.css` single global file (~3,568 lines). Watch specificity when adding mobile overrides — must appear after base definitions.

<!-- code-review-graph MCP tools -->
## MCP Tools: code-review-graph

**IMPORTANT: Knowledge graph exists. ALWAYS use code-review-graph MCP tools BEFORE Grep/Glob/Read.** Faster, cheaper, gives structural context (callers, dependents, test coverage) file scanning cannot.

### When to use graph tools FIRST

- **Exploring code**: `semantic_search_nodes` or `query_graph` instead of Grep
- **Understanding impact**: `get_impact_radius` instead of manually tracing imports
- **Code review**: `detect_changes` + `get_review_context` instead of reading entire files
- **Finding relationships**: `query_graph` with callers_of/callees_of/imports_of/tests_for
- **Architecture questions**: `get_architecture_overview` + `list_communities`

Fall back to Grep/Glob/Read **only** when graph doesn't cover what you need.

### Key Tools

| Tool | Use when |
|------|----------|
| `detect_changes` | Code changes review — risk-scored analysis |
| `get_review_context` | Source snippets for review — token-efficient |
| `get_impact_radius` | Blast radius of change |
| `get_affected_flows` | Which execution paths impacted |
| `query_graph` | Tracing callers, callees, imports, tests, dependencies |
| `semantic_search_nodes` | Find functions/classes by name or keyword |
| `get_architecture_overview` | High-level codebase structure |
| `refactor_tool` | Planning renames, finding dead code |

### Workflow

1. Graph auto-updates on file changes (hooks).
2. Use `detect_changes` for code review.
3. Use `get_affected_flows` to understand impact.
4. Use `query_graph` pattern="tests_for" to check coverage.