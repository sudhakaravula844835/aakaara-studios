# Plan: Restyle Quote Generator to Match Contract Generator Aesthetic

## Goal
Make `quote-generator.html` visually match the contract generator's dark/gold Aakaara aesthetic — same fonts, colors, input styles, section layout, login screen, noise overlay, gold sidebar, etc.

## Current State
- **Quote generator**: 3-file setup (`quote-generator.html` + `quote-generator.css` + `quote-generator.js`), uses `styles.css` variables (`--rose`, `--parch`, `--noir`), rounded corners, DM Sans font, pill-shaped buttons
- **Contract generator**: Self-contained single file, own CSS variables (`--gold`, `--off-white`, `--card`), sharp corners, DM Mono + Cormorant Garamond + Jost fonts, noise overlay, gold sidebar

## Key Visual Differences to Align

| Element | Quote (current) | Contract (target) |
|---------|----------------|-------------------|
| Fonts | DM Sans + Cormorant Garamond | DM Mono + Cormorant Garamond + Jost |
| Colors | `--rose` (warm copper) | `--gold` (#c9a84c) |
| Corners | Rounded (6-12px) | Sharp (0px) |
| Background | Pure black #000 | #0a0a0a with noise overlay |
| Sidebar | None | 3px gold gradient bar |
| Inputs | Rounded, rgba borders | Sharp, solid `--border` color |
| Section cards | Rounded #111 cards | Flat with gold rule section labels |
| Labels | 0.65rem, muted | 9px DM Mono, gold, spaced caps with trailing gold line |
| Buttons | Rounded pill-style | Sharp, uppercase, wide letter-spacing |
| Checkboxes | Simple flex rows | Card-style items with gold highlight on checked |
| Login | Rounded input, warm copper accent | Sharp input, gold accent, Cormorant Garamond title |
| Topbar | Sticky blurred glass | Matching sticky bar with DM Mono buttons |
| Generate bar | Sticky bottom glass | Centered generate section with primary + secondary buttons |

## Approach
Convert `quote-generator.css` to use the contract generator's design system. Keep the HTML structure largely the same since it works well. Keep `quote-generator.js` untouched (all logic stays the same).

### Changes:

**1. `quote-generator.html`** (minor HTML tweaks)
- Switch Google Fonts link from DM Sans → DM Mono + Jost (keep Cormorant Garamond)
- Remove `styles.css` import (self-contained like contract generator)
- Update login screen markup: Cormorant Garamond title, DM Mono subtitle
- Update section labels to contract-style (e.g. "01 — Client Information")
- Update topbar markup: simpler, matching contract style
- Update bottom generate bar → centered generate section like contract generator
- Update preview modal header to match contract modal style

**2. `quote-generator.css`** (full restyle)
- Replace CSS variable system → use contract generator's `:root` variables
- Add noise overlay (`body::before`) and gold sidebar (`body::after`)
- Restyle login screen → sharp corners, gold accents, DM Mono error text
- Restyle topbar → DM Mono buttons, no rounded corners
- Restyle sections → no border-radius, `--card` background, gold rule labels
- Restyle inputs → sharp corners, `--input-bg` background, gold focus glow
- Restyle checkboxes → card-style `.check-item` with gold highlight
- Restyle day blocks → gold tag label (like contract's `data-day` badge)
- Restyle buttons → sharp, uppercase, wide letter-spacing
- Restyle generate bar → centered layout with gold primary button + ghost secondary
- Restyle preview modal → matching header with DM Mono buttons
- Restyle toast → gold background, DM Mono text
- Update responsive breakpoints

**3. `quote-generator.js`** — NO CHANGES needed (all logic stays the same)

## Files Modified
1. `quote-generator.html` — HTML structure tweaks
2. `quote-generator.css` — Complete restyle

## What Stays the Same
- All JavaScript logic (pricing calc, PDF generation, login, Gmail compose, dashboard save)
- PDF output styling (already has its own dark/gold aesthetic)
- Form field IDs and data flow
- Dashboard link functionality
