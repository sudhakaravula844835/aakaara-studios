# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Site Overview

Aakaara Studios NYC — a static photography portfolio site. No build step, no framework. Pure HTML/CSS/JS deployed directly to Netlify. ~7,600 lines of code total.

- **URL**: https://www.aakaarastudiosnyc.com/
- **Deployment**: Netlify (auto-deploy from repo root)
- **Tech stack**: HTML5, CSS3, Vanilla JS (ES6+), HLS.js, Flatpickr, Formspree

## Running the Site Locally

```bash
# Any static file server works. Examples:
npx serve .
python3 -m http.server 8080
```

Open `http://localhost:8080`. The site **must** be served (not opened as `file://`) because image paths use absolute roots (`/images/...`).

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
| `index.html` | Entire main site (intro → hero → portfolio → films → about → services → testimonials → contact → footer) |
| `couple-portraits.html` | Standalone gallery page for couple portraits |
| `404.html` / `thank-you.html` | Utility pages |
| `styles.css` | All styles for all pages (~3,568 lines) |
| `Script.js` | All JS for `index.html` (~2,553 lines) |
| `favicon.svg` | Site logo as SVG favicon |
| `package.json` | Dev dependencies: Vitest, Playwright |
| `playwright.config.js` / `vitest.config.js` | Test configuration |

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

`include.js` fetches and injects `header.html` / `footer.html` before `Script.js` loads. Sub-pages use this to avoid duplicating markup.

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

Gallery items in `index.html` use data attributes — no server-side logic:

```html
<a class="gallery-item" data-folder="/images/weddings/pooja-amit" data-count="10" data-ext="jpg" onclick="openSwGallery(this); return false;">
```

`Script.js` builds image URLs as `${folder}/${1..count}.${ext}`. Cover image defaults to `folder/1.jpg` unless `data-cover` is set. Images are lazy-loaded via `IntersectionObserver`.

All gallery items require: `data-cat`, `data-title`, `data-type`, `data-folder`, `data-count`. Optional: `data-ext` (default: `jpg`), `data-cover`.

### Cinematic Gallery Viewer (`openSwGallery`)

Defined inside an IIFE in `Script.js`, exposed as `window.openSwGallery`. Handles swipe, keyboard nav, filmstrip dock effect, and parallax. Called from inline `onclick` on every gallery item.

### Ethereal Coverflow Carousel (`EtherealCarousel` class)

Both the portfolio grid and video grid are wrapped in `.ethereal-carousel` and driven by the `EtherealCarousel` class. The carousel:
- Positions cards via JS `transform` (not CSS grid) using `data-ec-offset` attributes (`"0"` = center, `"1"`/`"-1"` = sides, `"hidden"` = offscreen)
- `portfolioCarousel` and `videoCarousel` are global `let` vars reset when filters change via `filterGallery()` / `filterVideos()`
- Falls back to native scroll for `prefers-reduced-motion` users

### Cinematic Services Scroll Stack (`#services`)

`.cs-wrapper` is `700vh` tall (intentional — same on all screen sizes). `.cs-sticky-zone` is `position: sticky; top: 0; height: 100vh`. JS reads `scrollY` relative to `wrapTop` and translates each `.cs-panel` via `translateY()` to create a slide-over wipe effect. Videos are HLS streams via `hls.js` with image/gradient fallback chain.

### Intro Animation & Sub-page Navigation

`body.intro-active` (set on `<body>`) locks scroll during the 4-second cinematic intro. The intro is skipped when `sessionStorage.getItem('skipIntro') === '1'`. When linking to `couple-portraits.html`, always set both:

```js
sessionStorage.setItem('skipIntro', '1');
sessionStorage.setItem('returnScrollY', window.scrollY);
```

so the intro doesn't replay and scroll position is restored on return.

### Video Modal

HLS streams (`.m3u8`) use `hls.js` on supported browsers, native `<video src>` on Safari. `activeHls` instance is destroyed on close to prevent memory leaks. Video cards also have a muted hover-preview that auto-plays inline.

**Keyboard shortcuts** (when modal is open): `Space`/`K` = play/pause, `J`/`←` = skip back 5s, `L`/`→` = skip forward 5s, `F` = fullscreen, `M` = mute.

### Contact Form

`action="https://formspree.io/f/xlgwznnz"` — AJAX submission via `fetch`. On success redirects to `thank-you.html`. Honeypot field `name="_gotcha"` is present for bot filtering.

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

**New gallery project:** Copy any `<a class="gallery-item">` block inside `#galleryGrid`, set `data-cat`, `data-title`, `data-type`, `data-folder`, `data-count`. Place images as `1.jpg`, `2.jpg`, … `N.jpg` in the folder.

**New video card:** Copy any `<div class="vw-card">` block inside `#vwGrid`, set `data-vcat`, `data-video` (HLS `.m3u8` URL or empty for "Coming Soon"), `data-poster`, `data-title`, `data-type`.

**Gradient fallback classes:** Gallery items use `gi-1`–`gi-8`; video cards use `vw-gi-1`–`vw-gi-8`. All are defined in `styles.css`. Reuse or add new ones following the same pattern.

## CSS Conventions

- All CSS variables are in `:root` at the top of `styles.css`. Always use variables (`var(--rose)`, `var(--ivory)`, etc.) rather than raw hex values.

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
- The `@media (max-width: 768px)` block is near the bottom of `styles.css` — all mobile overrides live there.
- `backdrop-filter` is used throughout; always pair with `-webkit-backdrop-filter` and a solid-color fallback `background` for Firefox Android:

```css
backdrop-filter: blur(12px);
-webkit-backdrop-filter: blur(12px);
background: rgba(24, 21, 24, 0.68); /* solid fallback */
```

- The `.vw-filters` mobile override must appear **after** the base `.vw-filters` definition in `styles.css` to win specificity.

## Logo & Branding Consistency

The Aakaara logo is consistent across **header nav**, **hero intro**, and **footer**:
- **4 organic petals** with gradually decreasing opacity (0.85 → 0.55 → 0.35 → 0.2)
- Petal shapes are organic (not perfect ovals)
- **Visarga dots** positioned above the second letter "a" in "Aakaara" — close to the text, not floating high above

## Footer Connect Icons

Each link in the footer "Connect" column has an inline SVG icon:
- Instagram (camera icon), Email Us (envelope), Call Us (phone)
- Icons use `display: flex; align-items: center; gap: 0.5rem`
- Icons are 50% opacity, brighten to 100% on hover

## Video Player — 5-Second Skip Controls

The cinematic video modal (`#videoModal`) has YouTube-style skip controls:
- **Control bar buttons**: Rewind 5s and Forward 5s buttons between play/pause and progress bar
- **On-screen overlays**: `.vm-skip-overlay` with ripple animation on left/right sides of video
- **Keyboard support**: Left/Right arrow keys skip 5 seconds when modal is open
- JS function `triggerSkip(seconds)` handles both button clicks and keyboard events
- Elements: `#vmSkipBackBtn`, `#vmSkipFwdBtn`, `#vmSkipBack`, `#vmSkipFwd`

## Portfolio Filter Pills

- **Desktop**: Keyframe-based intro animation with staggered delays (`filterPillIn`)
- **Mobile (≤768px)**: Horizontal scroll strip (`flex-wrap: nowrap; overflow-x: auto`) for both `.portfolio-filters` and `.vw-filters`
- Interaction transitions are snappy (`0.15s`) — separated from intro animation

## Admin Dashboard (`admin/dashboard.js`)

- localStorage-based quote management; mock data fallback when empty
- Quote record shape: `{ id, clientName, clientEmail, eventDate, eventDateTo, status, quotedPrice, confirmedPrice }`
- Delete button uses two-click confirmation: first click shows "Sure?", auto-reverts after 5 seconds, second click within 5s confirms deletion
- Calendar visualization with event date indicators

## Business Card (`tools/business-card.html`)

- Dark cinematic design (01 — Dark Cinematic palette)
- Editorial asymmetric layout: name + role bottom-left, logo centered
- Print HTML version at `tools/business-card-print.html`
- PDF generator script at `tools/generate-card-pdf.py` (uses reportlab)

## Recent Changes (March–April 2026)

- **Carousel animations**: Implemented cinematic animations (wipeUp, fadeUp, fadeIn, lineGrow) in `tools/insta-carousel.html` with `IntersectionObserver` triggers.
- **Mobile scroll-stack**: The services section uses `position: sticky` + `translateY` on all screen sizes (old mobile "reels mode" removed entirely).
- **Mobile filter pills**: Horizontal scroll strip for both portfolio and video filters on mobile.
- **Video modal skip controls**: 5-second skip with on-screen ripple overlays and keyboard shortcuts.
- **Production header CTA**: Improved contrast for accessibility.
- **Code refactoring**: Removed unused code, standardized structure, removed broken GitHub Actions workflows (Netlify only).
- **Testing infrastructure added**: Vitest unit tests + Playwright e2e tests.

## Known Constraints

- **Testimonials section** (`#testimonials`) contains placeholder copy — replace with real client quotes before publishing.
- **Bhandhavi graduation folder** (`/images/graduation/bhandhavi`) was corrected in `data-folder` but the actual image folder on disk may be named differently — verify before deploying.
- The `#services` cinematic scroll stack is **700vh tall on all screen sizes** by design (intentional trade-off for mobile UX).
- **Business card PDF**: The reportlab-generated PDF doesn't perfectly match the HTML version. For best results, use browser print-to-PDF from `business-card-print.html` with "Background graphics" enabled.
- `styles.css` is a single global file for all pages (~3,568 lines). Be careful about selector specificity when adding mobile overrides — they must appear after their base definitions.

<!-- code-review-graph MCP tools -->
## MCP Tools: code-review-graph

**IMPORTANT: This project has a knowledge graph. ALWAYS use the
code-review-graph MCP tools BEFORE using Grep/Glob/Read to explore
the codebase.** The graph is faster, cheaper (fewer tokens), and gives
you structural context (callers, dependents, test coverage) that file
scanning cannot.

### When to use graph tools FIRST

- **Exploring code**: `semantic_search_nodes` or `query_graph` instead of Grep
- **Understanding impact**: `get_impact_radius` instead of manually tracing imports
- **Code review**: `detect_changes` + `get_review_context` instead of reading entire files
- **Finding relationships**: `query_graph` with callers_of/callees_of/imports_of/tests_for
- **Architecture questions**: `get_architecture_overview` + `list_communities`

Fall back to Grep/Glob/Read **only** when the graph doesn't cover what you need.

### Key Tools

| Tool | Use when |
|------|----------|
| `detect_changes` | Reviewing code changes — gives risk-scored analysis |
| `get_review_context` | Need source snippets for review — token-efficient |
| `get_impact_radius` | Understanding blast radius of a change |
| `get_affected_flows` | Finding which execution paths are impacted |
| `query_graph` | Tracing callers, callees, imports, tests, dependencies |
| `semantic_search_nodes` | Finding functions/classes by name or keyword |
| `get_architecture_overview` | Understanding high-level codebase structure |
| `refactor_tool` | Planning renames, finding dead code |

### Workflow

1. The graph auto-updates on file changes (via hooks).
2. Use `detect_changes` for code review.
3. Use `get_affected_flows` to understand impact.
4. Use `query_graph` pattern="tests_for" to check coverage.
