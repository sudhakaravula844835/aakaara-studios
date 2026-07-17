# Business Card — Premium/Cinematic Polish

## Problem

`tools/business-card.html` (front + back preview, 3.5"×2" print target) has a clean but flat execution: single-color logo strokes, one thin top gold line, a flat gradient background, a plain white QR box, and generic stroke-icon contact rows. Explored a full layout overhaul (three alternate compositions — full-bleed cinematic frame, editorial masthead, film-strip/production slate) via the visual companion; user rejected a layout change and instead wants the *current* layout pushed to a materially richer, more premium execution.

## Goals

- Keep the existing layout structure exactly as-is: front = logo mark + wordmark + tagline top, name/role bottom-left; back = QR left, contact list right.
- Keep all existing content (copy, links, phone/email/Instagram, print-specs footer) unchanged.
- Elevate the visual execution to read as a premium print product: foil-stamped edges, metallic (not flat-color) logo strokes, deeper cinematic lighting, a simulated spot-UV sheen, finer paper texture, sharper type hierarchy, and a more considered back-side QR/contact treatment.
- Preserve the 3.5"×2" print target, CMYK-safe palette (existing `--rose`/`--champagne`/etc. vars), and print-specs footer claims (the design should now visually earn the "spot UV" claim it already makes).
- Preserve existing responsive behavior at the `700px` breakpoint.

## Non-Goals

- No structural/layout changes (no repositioning of logo, name, QR, or contact rows).
- No new imagery/photography — abstract/editorial treatment only (per user's explicit choice during brainstorming).
- No changes to `tools/business-card-print.html` or `tools/generate-card-pdf.py` in this pass — this spec covers the HTML preview (`business-card.html`) only. (Print/PDF variants can be synced in a follow-up once this is approved.)
- No changes to contact details, QR target URL, or any copy text.

## Design

### 1. Foil-edge frame (front + back)

Replace the front's single top gold line (`.card-front::before`) and the back's single bottom gold line (`.card-back::before`) with a full-perimeter hairline frame on both faces: a `::before` pseudo-element inset ~10px from each edge, 1px border using the existing rose gradient (`linear-gradient` already used for the top line, applied as a `border-image` or four gradient-edges via `background` trick), plus four small corner accent marks (short L-shaped strokes, ~8px, rose, opacity ~0.5) at each corner to read as a foil-stamped edge rather than a printed rule. Same treatment on both card faces for front/back cohesion.

### 2. Metallic logo mark

The petal strokes in `.logo-icon svg` (front) and `.back-logo` (back) currently use flat `stroke="#c9956b"` at varying opacity. Change to a linear gradient stroke (`--rose-light` → `--rose` → `--umber`-tinted dark, roughly 3 stops) via an SVG `<linearGradient>` def, applied to all four petal paths and the center dot. Add a soft radial glow (`filter: drop-shadow` or a blurred radial-gradient circle behind the mark) so the logo reads as catching light rather than sitting flat.

### 3. Deeper cinematic lighting (front)

Strengthen `.card-front`'s background stack: increase the existing light-leak radial-gradient opacity/spread slightly, add a second diagonal light-leak sweep (soft warm band running corner-to-corner behind the content, low opacity ~0.05–0.08) for filmic depth, and tighten the vignette radial-gradient so corners read darker/richer than the current version.

### 4. Simulated spot-UV sheen

Add a thin diagonal high-gloss band (a `linear-gradient` strip, white/rose at very low opacity, angled ~20deg) positioned across the logo mark area on the front. This is static in the HTML preview (no hover-triggered animation needed, since the print version is static) — it's there to visually cue the glossy spot-UV finish the print-specs footer already promises.

### 5. Sharper type hierarchy (front)

- Increase weight/size contrast between `.logo-text` ("Aakaara") and `.studios-nyc` ("Studios · New York City") slightly — widen the letter-spacing gap so the wordmark reads as clearly dominant.
- Refine `.person-block`: add a thin rose hairline rule (~16px wide, 1px, opacity ~0.4) above `.person-name` to separate it from the content above, matching the "engraved rule" language used elsewhere in the design.

### 6. Fine paper texture (both faces)

Add a second, finer-grain SVG noise texture (higher `baseFrequency`, lower opacity ~0.015) layered on top of the existing film-grain texture, simulating premium uncoated/soft-touch card stock rather than a flat digital gradient.

### 7. Back-side QR + contact refinement

- `.qr-frame`: replace the flat white box with an inset-bevel treatment — a thin rose-gradient ring border (~2px) plus an inner `box-shadow` (subtle inset dark shadow) so the QR reads as set into the card rather than pasted on top.
- `.contact-info`: add a vertical divider rule (1px, rose, opacity ~0.15) between the `.qr-section` and `.contact-info` columns to formalize the two-zone layout.
- Contact row icons: keep the same icon set (globe/envelope/phone/instagram/pin) but standardize stroke-width and size for visual consistency (they're already close; this is a tightening pass, not a redraw).
- `.back-logo`: apply the same metallic gradient treatment as the front mark (item 2) for front/back cohesion.

## Testing

Visual-only change to a standalone static HTML file with no JS logic and no test coverage (`business-card.html` isn't exercised by the Vitest/Playwright suites). Verification is manual: open the file in a browser at desktop width and at the `700px` breakpoint, confirm both card faces render correctly, hover state still works, and the QR code still generates/scans correctly.
