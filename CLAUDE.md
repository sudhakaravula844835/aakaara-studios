# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Site Overview

Aakaara Studios NYC — a static photography portfolio site. No build step, no package manager, no framework. Pure HTML/CSS/JS deployed directly to Netlify.

## Running the Site Locally

```bash
# Any static file server works. Examples:
npx serve .
python3 -m http.server 8080
```

Open `http://localhost:8080`. The site must be served (not opened as `file://`) because image paths use absolute roots (`/images/...`).

## Deployment

Netlify auto-deploys from the repo root. Config is minimal:

```toml
# netlify.toml
publish = "."   # root is the publish directory
```

`_redirects` serves `404.html` for all unmatched paths.

## File Structure

| File | Purpose |
|------|---------|
| `index.html` | Entire main site (hero → portfolio → films → about → services → testimonials → contact → footer) |
| `couple-portraits.html` | Standalone gallery page for couple portraits |
| `404.html` / `thank-you.html` | Utility pages |
| `styles.css` | All styles for all pages (single file, ~2100 lines) |
| `Script.js` | All JS for `index.html` (~1700 lines) |

## Architecture & Key Patterns

### Gallery System
Gallery items in `index.html` use data attributes — no server-side logic:
```html
<a class="gallery-item" data-folder="/images/weddings/pooja-amit" data-count="10" data-ext="jpg" onclick="openSwGallery(this); return false;">
```
`Script.js` builds image URLs as `${folder}/${1..count}.${ext}`. Cover image defaults to `folder/1.jpg` unless `data-cover` is set. Images are lazy-loaded via `IntersectionObserver`.

### Cinematic Gallery Viewer (`openSwGallery`)
Defined inside an IIFE in `Script.js`, exposed as `window.openSwGallery`. Handles swipe, keyboard nav, filmstrip dock effect, and parallax. Called from inline `onclick` on every gallery item.

### Ethereal Coverflow Carousel (`EtherealCarousel` class)
Both the portfolio grid and video grid are wrapped in `.ethereal-carousel` and driven by the `EtherealCarousel` class. The carousel:
- Positions cards via JS `transform` (not CSS grid) using `data-ec-offset` attributes (`"0"` = center, `"1"`/`"-1"` = sides, `"hidden"` = offscreen)
- `portfolioCarousel` and `videoCarousel` are global `let` vars reset when filters change via `filterGallery()` / `filterVideos()`

### Cinematic Services Scroll Stack (`#services`)
`.cs-wrapper` is `7 * 100vh` tall. `.cs-sticky-zone` is `position: sticky; top: 0; height: 100vh`. JS reads `scrollY` relative to `wrapTop` and translates each `.cs-panel` via `translateY()` to create a slide-over wipe effect. Videos are HLS streams via `hls.js` with image/gradient fallback chain.

### Intro Animation & Sub-page Navigation
`body.intro-active` (set on `<body>`) locks scroll during the 4-second cinematic intro. The intro is skipped when `sessionStorage.getItem('skipIntro') === '1'`. When linking to `couple-portraits.html`, always set both:
```js
sessionStorage.setItem('skipIntro', '1');
sessionStorage.setItem('returnScrollY', window.scrollY);
```
so the intro doesn't replay and scroll position is restored on return.

### Video Modal
HLS streams (`.m3u8`) use `hls.js` on supported browsers, native `<video src>` on Safari. `activeHls` instance is destroyed on close to prevent memory leaks. Video cards also have a muted hover-preview that auto-plays inline.

### Contact Form
`action="https://formspree.io/f/xlgwznnz"` — AJAX submission via `fetch`. On success redirects to `thank-you.html`. Honeypot field `name="_gotcha"` is present for bot filtering.

## Adding Content

**New gallery project:** Copy any `<a class="gallery-item">` block inside `#galleryGrid`, set `data-cat`, `data-title`, `data-type`, `data-folder`, `data-count`. Place images as `1.jpg`, `2.jpg`, … `N.jpg` in the folder.

**New video card:** Copy any `<div class="vw-card">` block inside `#vwGrid`, set `data-vcat`, `data-video` (HLS `.m3u8` URL or empty for "Coming Soon"), `data-poster`, `data-title`, `data-type`.

**Gradient fallback classes:** Gallery items use `gi-1`–`gi-8`; video cards use `vw-gi-1`–`vw-gi-8`. All are defined in `styles.css`. Reuse or add new ones following the same pattern.

## CSS Conventions

- All CSS variables are in `:root` at the top of `styles.css`. Always use variables (`var(--rose)`, `var(--ivory)`, etc.) rather than raw hex values.
- Responsive breakpoints: `1024px` (tablet), `768px` (mobile), `480px` (small phone).
- The `@media (max-width: 768px)` block is near the bottom of `styles.css` — all mobile overrides live there.
- `backdrop-filter` is used throughout; always pair with `-webkit-backdrop-filter` and a solid-color fallback `background` for Firefox Android.

## Recent Changes (March 2026 Session)

#### Carousel Animations
- Implemented cinematic animations (wipeUp, fadeUp, fadeIn, lineGrow) in `tools/insta-carousel.html`.
- Integrated `IntersectionObserver` to trigger reveals as slides scroll into view.
- Refactored Slide 02 (divider) and Slide 03 (headline spans) for motion.

#### Carousel Animations Plan
- Created implementation plan for cinematic animations in `tools/insta-carousel.html`.
- Defined steps for CSS @keyframes integration and HTML refactoring.
- Outlined JS IntersectionObserver trigger mechanism.

### Logo Consistency
The Aakaara logo is consistent across **header nav**, **hero intro**, and **footer**:
- **4 petals** with gradually decreasing opacity (0.85 → 0.55 → 0.35 → 0.2)
- Petal shapes are organic (not perfect ovals)
- **Visarga dots** positioned above the second letter "a" in "Aakaara"
- Dots are close to the text, not floating high above

### Footer Connect Icons
Each link in the footer "Connect" column has an inline SVG icon:
- Instagram (camera icon), Email Us (envelope), Call Us (phone)
- Icons use `display: flex; align-items: center; gap: 0.5rem`
- Icons are 50% opacity, brighten to 100% on hover

### Video Player — 5-Second Skip Controls
The cinematic video modal (`#videoModal`) has YouTube-style skip controls:
- **Control bar buttons**: Rewind 5s and Forward 5s buttons between play/pause and progress bar
- **On-screen overlays**: `.vm-skip-overlay` with ripple animation on left/right sides of video
- **Keyboard support**: Left/Right arrow keys skip 5 seconds when modal is open
- JS function `triggerSkip(seconds)` handles both button clicks and keyboard events
- Elements: `#vmSkipBackBtn`, `#vmSkipFwdBtn`, `#vmSkipBack`, `#vmSkipFwd`

### Portfolio Filter Pills
- **Desktop**: Keyframe-based intro animation with staggered delays (`filterPillIn`)
- **Mobile (≤768px)**: Horizontal scroll strip (`flex-wrap: nowrap; overflow-x: auto`) for both `.portfolio-filters` and `.vw-filters`
- Interaction transitions are snappy (`0.15s`) — separated from intro animation
- The `.vw-filters` mobile override must appear AFTER the base `.vw-filters` definition in `styles.css` to win specificity

### Mobile Scroll-Stack
The "Explore our Video Work" services section uses the same slide-over cover effect on mobile as desktop. The old mobile "reels mode" was removed entirely — `position: sticky` + `translateY` transforms run on all screen sizes.

### Business Card (`tools/business-card.html`)
- Dark cinematic design (01 — Dark Cinematic palette)
- Editorial asymmetric layout: name + role bottom-left, logo centered
- "STUDIOS · NEW YORK CITY" and tagline width-matched to "Aakaara" text
- Logo icon enlarged with 4 petals matching the site logo
- Divider removed for cleaner look
- Print HTML version at `tools/business-card-print.html`
- PDF generator script at `tools/generate-card-pdf.py` (uses reportlab)

### Admin Dashboard (`admin/dashboard.js`)
- Delete button on each quote row with two-click confirmation pattern
- First click shows "Sure?" text, auto-reverts after 5 seconds
- Second click within 5s actually deletes the quote

## Known Constraints

- **Testimonials section** (`#testimonials`) contains placeholder copy — replace with real client quotes before publishing.
- **Bhandhavi graduation folder** (`/images/graduation/bhandhavi`) was corrected in `data-folder` but the actual image folder may still be named differently on disk — verify the folder name matches.
- The `#services` cinematic scroll stack is 700vh tall on all screen sizes by design (intentional trade-off for mobile UX).
- **Business card PDF**: The reportlab-generated PDF doesn't perfectly match the HTML version. For best results, use browser print-to-PDF from `business-card-print.html` with "Background graphics" enabled.

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
