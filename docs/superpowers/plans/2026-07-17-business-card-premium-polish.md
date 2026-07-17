# Business Card Premium/Cinematic Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Elevate `tools/business-card.html` from a flat, clean preview to a materially richer, premium/cinematic execution — foil-edge frame, metallic logo mark, deeper lighting, simulated spot-UV sheen, sharper type hierarchy, finer paper texture, and a refined back-side QR/contact treatment — with zero layout or content changes.

**Architecture:** Single static HTML file, all changes are CSS (`<style>` block) plus a handful of new decorative markup elements (corner-accent spans, an SVG gradient def, a sheen div). No JS, no build step, no new files.

**Tech Stack:** Plain HTML5 + CSS3 (existing `:root` custom properties), inline SVG. No frameworks, no test runner applies to this file.

## Global Constraints

- Keep the existing layout structure exactly as-is: front = logo mark + wordmark + tagline top, name/role bottom-left; back = QR left, contact list right. (spec Goals)
- Keep all existing content (copy, links, phone/email/Instagram, print-specs footer) unchanged. (spec Goals)
- No structural/layout repositioning of logo, name, QR, or contact rows. (spec Non-Goals)
- No new imagery/photography — abstract/editorial treatment only. (spec Non-Goals)
- Do not touch `tools/business-card-print.html` or `tools/generate-card-pdf.py` in this pass. (spec Non-Goals)
- Do not change contact details, QR target URL, or any copy text. (spec Non-Goals)
- Preserve the 3.5"×2" print target, existing CMYK-safe palette vars (`--noir`, `--umber`, `--rose`, `--rose-light`, `--ivory`, `--champagne`), and the `700px` responsive breakpoint. (spec Goals)
- This file has no automated test coverage and isn't exercised by the Vitest/Playwright suites — verification is manual visual inspection in a browser at desktop width and at the `700px` breakpoint, per task. (spec Testing)

---

## File Structure

- **Modify:** `tools/business-card.html` — all 6 tasks edit this single file (CSS in the existing `<style>` block, plus small markup additions: `.card-corners` spans, one SVG `<linearGradient>` def, one `.uv-sheen` div).

Each task below is self-contained and independently verifiable in the browser; tasks are ordered so each commit leaves the file in a working, visually-inspectable state. Later tasks don't depend on internal names/values from earlier tasks except where noted.

---

### Task 1: Foil-edge frame (front + back)

**Files:**
- Modify: `tools/business-card.html` (`.card-front::before` rule, `.card-back::before` rule, and the `.card-front` / `.card-back` markup)

**Interfaces:**
- Produces: `.card-corners` markup pattern (4 `<span>` corner marks) — reused as-is on both card faces in this same task. No other task depends on it.

- [ ] **Step 1: Replace the front's single top gold line with a full-perimeter inset frame**

Find this rule (currently the front's top gold line):

```css
  /* Gold line at top */
  .card-front::before {
    content: '';
    position: absolute;
    top: 0; left: 15%; right: 15%;
    height: 1px;
    background: linear-gradient(
      90deg,
      transparent,
      var(--rose) 20%,
      var(--rose-light) 50%,
      var(--rose) 80%,
      transparent
    );
    opacity: 0.6;
  }
```

Replace it with:

```css
  /* Foil-edge hairline frame */
  .card-front::before,
  .card-back::before {
    content: '';
    position: absolute;
    inset: 10px;
    border: 1px solid var(--rose);
    border-radius: 4px;
    opacity: 0.28;
    pointer-events: none;
    z-index: 1;
  }
```

(This single rule now covers both faces — it replaces the front's top-line rule here, and you'll delete the back's now-redundant bottom-line rule in Step 2.)

- [ ] **Step 2: Remove the back's now-redundant bottom gold line rule**

Find and delete this rule entirely (it's superseded by the shared `.card-front::before, .card-back::before` rule from Step 1):

```css
  /* Gold border line at bottom */
  .card-back::before {
    content: '';
    position: absolute;
    bottom: 0; left: 10%; right: 10%;
    height: 1px;
    background: linear-gradient(
      90deg,
      transparent,
      var(--rose) 20%,
      var(--rose-light) 50%,
      var(--rose) 80%,
      transparent
    );
    opacity: 0.5;
  }
```

- [ ] **Step 3: Add corner-accent CSS**

Add this new rule block right after the `.card-front::before, .card-back::before` rule from Step 1:

```css
  /* Corner accent marks — foil-stamp detail */
  .card-corners {
    position: absolute;
    inset: 0;
    pointer-events: none;
    z-index: 2;
  }
  .card-corners span {
    position: absolute;
    width: 14px;
    height: 14px;
    opacity: 0.65;
  }
  .card-corners .cc-tl { top: 8px; left: 8px; border-top: 1px solid var(--rose); border-left: 1px solid var(--rose); }
  .card-corners .cc-tr { top: 8px; right: 8px; border-top: 1px solid var(--rose); border-right: 1px solid var(--rose); }
  .card-corners .cc-bl { bottom: 8px; left: 8px; border-bottom: 1px solid var(--rose); border-left: 1px solid var(--rose); }
  .card-corners .cc-br { bottom: 8px; right: 8px; border-bottom: 1px solid var(--rose); border-right: 1px solid var(--rose); }
```

- [ ] **Step 4: Add the corner-accent markup to the front card**

Find the opening of the front card:

```html
      <div class="card card-front">
        <!-- Watermark petal in background -->
        <div class="front-watermark">
```

Replace with:

```html
      <div class="card card-front">
        <!-- Corner accent marks -->
        <div class="card-corners">
          <span class="cc-tl"></span><span class="cc-tr"></span><span class="cc-bl"></span><span class="cc-br"></span>
        </div>
        <!-- Watermark petal in background -->
        <div class="front-watermark">
```

- [ ] **Step 5: Add the corner-accent markup to the back card**

Find the opening of the back card:

```html
      <div class="card card-back">

        <!-- Small logo watermark -->
        <div class="back-logo">
```

Replace with:

```html
      <div class="card card-back">
        <!-- Corner accent marks -->
        <div class="card-corners">
          <span class="cc-tl"></span><span class="cc-tr"></span><span class="cc-bl"></span><span class="cc-br"></span>
        </div>

        <!-- Small logo watermark -->
        <div class="back-logo">
```

- [ ] **Step 6: Verify in browser**

Open `tools/business-card.html` directly in a browser (double-click or `open "tools/business-card.html"` on macOS — no server needed, this file has no absolute-root image paths). Confirm:
- Both front and back cards show a thin inset rose frame around all four edges (not just one line).
- All four corners of each card show a small brighter L-shaped accent mark.
- No content is visually obscured by the frame or corners (they sit inset from the edge, away from text/logo/QR).

- [ ] **Step 7: Commit**

```bash
git add "tools/business-card.html"
git commit -m "$(cat <<'EOF'
feat: add foil-edge frame and corner accents to business card

Replaces the single top/bottom gold lines with a full-perimeter inset
frame plus corner accent marks on both card faces, for a more
foil-stamped premium-print feel.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: Metallic logo mark (front + back)

**Files:**
- Modify: `tools/business-card.html` (front `.logo-icon svg`, `.logo-dots span`, `.back-logo-text`, `.back-logo-dots span`)

**Interfaces:**
- Consumes: none.
- Produces: SVG gradient def `#logoMetal` (defined and used only within the front logo-icon SVG in this task). No other task references it.

- [ ] **Step 1: Add a metallic gradient def and glow to the front logo icon**

Find the front logo icon SVG:

```html
            <div class="logo-icon">
              <svg viewBox="0 0 60 60" fill="none" xmlns="http://www.w3.org/2000/svg">
                <g transform="translate(30,30)">
                  <circle cx="0" cy="0" r="25.7" fill="none" stroke="#c9956b" stroke-width="0.6" opacity="0.25"/>
                  <path d="M0,-18 C5.1,-18 9.4,-12 7.7,-3.4 C6,5.1 -2.6,7.7 -7.7,3.4 C-12.9,-0.9 -9.4,-12.9 -3.4,-17.1 C-2.1,-17.8 -1.1,-18 0,-18Z" fill="none" stroke="#c9956b" stroke-width="1.2" opacity="0.85"/>
                  <path d="M0,-18 C5.1,-18 9.4,-12 7.7,-3.4 C6,5.1 -2.6,7.7 -7.7,3.4 C-12.9,-0.9 -9.4,-12.9 -3.4,-17.1 C-2.1,-17.8 -1.1,-18 0,-18Z" fill="none" stroke="#c9956b" stroke-width="1.2" opacity="0.55" transform="rotate(72)"/>
                  <path d="M0,-18 C5.1,-18 9.4,-12 7.7,-3.4 C6,5.1 -2.6,7.7 -7.7,3.4 C-12.9,-0.9 -9.4,-12.9 -3.4,-17.1 C-2.1,-17.8 -1.1,-18 0,-18Z" fill="none" stroke="#c9956b" stroke-width="1.2" opacity="0.35" transform="rotate(144)"/>
                  <path d="M0,-18 C5.1,-18 9.4,-12 7.7,-3.4 C6,5.1 -2.6,7.7 -7.7,3.4 C-12.9,-0.9 -9.4,-12.9 -3.4,-17.1 C-2.1,-17.8 -1.1,-18 0,-18Z" fill="none" stroke="#c9956b" stroke-width="1.2" opacity="0.2" transform="rotate(216)"/>
                  <circle cx="0" cy="0" r="2.5" fill="#c9956b" opacity="0.85"/>
                </g>
              </svg>
            </div>
```

Replace with (adds a `<defs>` gradient and swaps every `stroke="#c9956b"` / `fill="#c9956b"` for `url(#logoMetal)`):

```html
            <div class="logo-icon">
              <svg viewBox="0 0 60 60" fill="none" xmlns="http://www.w3.org/2000/svg">
                <defs>
                  <linearGradient id="logoMetal" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stop-color="#dbb08a"/>
                    <stop offset="50%" stop-color="#c9956b"/>
                    <stop offset="100%" stop-color="#8a6647"/>
                  </linearGradient>
                </defs>
                <g transform="translate(30,30)">
                  <circle cx="0" cy="0" r="25.7" fill="none" stroke="url(#logoMetal)" stroke-width="0.6" opacity="0.25"/>
                  <path d="M0,-18 C5.1,-18 9.4,-12 7.7,-3.4 C6,5.1 -2.6,7.7 -7.7,3.4 C-12.9,-0.9 -9.4,-12.9 -3.4,-17.1 C-2.1,-17.8 -1.1,-18 0,-18Z" fill="none" stroke="url(#logoMetal)" stroke-width="1.2" opacity="0.85"/>
                  <path d="M0,-18 C5.1,-18 9.4,-12 7.7,-3.4 C6,5.1 -2.6,7.7 -7.7,3.4 C-12.9,-0.9 -9.4,-12.9 -3.4,-17.1 C-2.1,-17.8 -1.1,-18 0,-18Z" fill="none" stroke="url(#logoMetal)" stroke-width="1.2" opacity="0.55" transform="rotate(72)"/>
                  <path d="M0,-18 C5.1,-18 9.4,-12 7.7,-3.4 C6,5.1 -2.6,7.7 -7.7,3.4 C-12.9,-0.9 -9.4,-12.9 -3.4,-17.1 C-2.1,-17.8 -1.1,-18 0,-18Z" fill="none" stroke="url(#logoMetal)" stroke-width="1.2" opacity="0.35" transform="rotate(144)"/>
                  <path d="M0,-18 C5.1,-18 9.4,-12 7.7,-3.4 C6,5.1 -2.6,7.7 -7.7,3.4 C-12.9,-0.9 -9.4,-12.9 -3.4,-17.1 C-2.1,-17.8 -1.1,-18 0,-18Z" fill="none" stroke="url(#logoMetal)" stroke-width="1.2" opacity="0.2" transform="rotate(216)"/>
                  <circle cx="0" cy="0" r="2.5" fill="url(#logoMetal)" opacity="0.85"/>
                </g>
              </svg>
            </div>
```

- [ ] **Step 2: Add a soft glow behind the logo icon**

Find:

```css
  .logo-icon {
    width: 56px;
    height: 56px;
    position: relative;
  }
```

Replace with:

```css
  .logo-icon {
    width: 56px;
    height: 56px;
    position: relative;
  }
  .logo-icon::before {
    content: '';
    position: absolute;
    inset: -10px;
    background: radial-gradient(circle, rgba(201,149,107,0.32) 0%, rgba(201,149,107,0.08) 45%, transparent 70%);
    filter: blur(6px);
    z-index: -1;
  }
```

- [ ] **Step 3: Apply the metallic gradient to the front's visarga dots**

Find:

```css
  .logo-dots span {
    width: 0.12em;
    height: 0.12em;
    border-radius: 50%;
    background: var(--rose);
    opacity: 0.85;
  }
```

Replace with:

```css
  .logo-dots span {
    width: 0.12em;
    height: 0.12em;
    border-radius: 50%;
    background: linear-gradient(135deg, var(--rose-light), var(--rose));
    opacity: 0.85;
  }
```

- [ ] **Step 4: Apply the same metallic treatment to the back logo mark**

Find:

```css
  .back-logo-text {
    font-family: 'Cormorant Garamond', Georgia, serif;
    font-weight: 400;
    font-size: 0.75rem;
    letter-spacing: 0.12em;
    color: var(--rose);
  }
```

Replace with:

```css
  .back-logo-text {
    font-family: 'Cormorant Garamond', Georgia, serif;
    font-weight: 400;
    font-size: 0.75rem;
    letter-spacing: 0.12em;
    background: linear-gradient(135deg, var(--rose-light), var(--rose) 60%, #8a6647);
    -webkit-background-clip: text;
    background-clip: text;
    color: transparent;
  }
```

Find:

```css
  .back-logo-dots span {
    width: 0.12em;
    height: 0.12em;
    border-radius: 50%;
    background: var(--rose);
    opacity: 0.85;
  }
```

Replace with:

```css
  .back-logo-dots span {
    width: 0.12em;
    height: 0.12em;
    border-radius: 50%;
    background: linear-gradient(135deg, var(--rose-light), var(--rose));
    opacity: 0.85;
  }
```

- [ ] **Step 5: Verify in browser**

Open `tools/business-card.html`. Confirm:
- The front logo petal mark now shows a visible light-to-dark diagonal gradient across the strokes (not a flat single color), with a soft warm glow behind it.
- The two visarga dots above "Aakaara" (front) show the same gradient.
- The small "Aakaara" wordmark on the back card face reads with a metallic gradient fill instead of flat rose, and its two dots match.

- [ ] **Step 6: Commit**

```bash
git add "tools/business-card.html"
git commit -m "$(cat <<'EOF'
feat: give business card logo mark a metallic gradient treatment

Front petal icon and both faces' visarga dots/wordmark now use a
light-to-dark rose gradient plus a soft glow, so the mark reads as
catching light instead of sitting flat.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: Deeper cinematic lighting + simulated spot-UV sheen (front)

**Files:**
- Modify: `tools/business-card.html` (`.card-front` background rule, new `.uv-sheen` rule + markup)

**Interfaces:**
- Consumes: none.
- Produces: `.uv-sheen` class, used only in this task.

- [ ] **Step 1: Strengthen the light leak and vignette**

Find:

```css
  .card-front {
    background:
      /* film grain texture */
      url("data:image/svg+xml,%3Csvg viewBox='0 0 512 512' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.03'/%3E%3C/svg%3E"),
      /* warm cinematic light leak — top right */
      radial-gradient(
        ellipse at 85% 15%,
        rgba(201,149,107,0.08) 0%,
        rgba(201,149,107,0.02) 35%,
        transparent 65%
      ),
      /* deep vignette — dark corners */
      radial-gradient(
        ellipse at 50% 50%,
        transparent 30%,
        rgba(9,8,11,0.4) 100%
      ),
      /* base gradient */
      linear-gradient(
        155deg,
        #0e0c10 0%,
        #151210 25%,
        #1c1712 50%,
        #12100e 75%,
        #0a090c 100%
      );
  }
```

Replace with:

```css
  .card-front {
    background:
      /* film grain texture */
      url("data:image/svg+xml,%3Csvg viewBox='0 0 512 512' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.03'/%3E%3C/svg%3E"),
      /* second diagonal light leak — corner to corner */
      linear-gradient(
        115deg,
        transparent 35%,
        rgba(201,149,107,0.07) 50%,
        transparent 65%
      ),
      /* warm cinematic light leak — top right */
      radial-gradient(
        ellipse at 85% 15%,
        rgba(201,149,107,0.12) 0%,
        rgba(201,149,107,0.03) 35%,
        transparent 65%
      ),
      /* deep vignette — dark corners */
      radial-gradient(
        ellipse at 50% 50%,
        transparent 22%,
        rgba(9,8,11,0.55) 100%
      ),
      /* base gradient */
      linear-gradient(
        155deg,
        #0e0c10 0%,
        #151210 25%,
        #1c1712 50%,
        #12100e 75%,
        #0a090c 100%
      );
  }
```

- [ ] **Step 2: Add the spot-UV sheen CSS**

Add this new rule right after the `.card-front` rule from Step 1:

```css
  /* Simulated spot-UV sheen across the logo area */
  .uv-sheen {
    position: absolute;
    top: -20%;
    left: 8%;
    width: 62%;
    height: 140%;
    background: linear-gradient(
      20deg,
      transparent 42%,
      rgba(255,255,255,0.05) 50%,
      rgba(201,149,107,0.07) 54%,
      transparent 62%
    );
    pointer-events: none;
    z-index: 1;
  }
```

- [ ] **Step 3: Add the sheen markup to the front card**

Find:

```html
        <!-- Watermark petal in background -->
        <div class="front-watermark">
```

Replace with:

```html
        <!-- Simulated spot-UV sheen -->
        <div class="uv-sheen"></div>
        <!-- Watermark petal in background -->
        <div class="front-watermark">
```

- [ ] **Step 4: Verify in browser**

Open `tools/business-card.html`. Confirm:
- The front card's corners read noticeably darker/richer than the center (tighter vignette).
- A faint diagonal warm sweep is visible crossing the card behind the logo mark, distinct from the existing top-right light leak.
- Text (wordmark, tagline, name) remains fully legible — the sheen must not wash out contrast.

- [ ] **Step 5: Commit**

```bash
git add "tools/business-card.html"
git commit -m "$(cat <<'EOF'
feat: deepen business card front lighting, add spot-UV sheen

Adds a second diagonal light leak and tighter vignette for more
filmic depth, plus a subtle diagonal gloss band over the logo area
that visually pays off the spot-UV finish already claimed in the
print-specs footer.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: Sharper type hierarchy (front)

**Files:**
- Modify: `tools/business-card.html` (`.studios-nyc`, `.person-block`)

**Interfaces:**
- Consumes: none.
- Produces: none consumed elsewhere.

- [ ] **Step 1: Push the "Studios · New York City" subtitle further back visually**

Find:

```css
  .studios-nyc {
    font-family: 'Outfit', sans-serif;
    font-weight: 300;
    font-size: 0.48rem;
    letter-spacing: 0.68em;
    text-transform: uppercase;
    color: var(--champagne);
    opacity: 0.6;
    margin-top: 0.15rem;
    margin-bottom: 0.25rem;
    margin-left: 60px; /* offset for larger logo icon + gap */
  }
```

Replace with:

```css
  .studios-nyc {
    font-family: 'Outfit', sans-serif;
    font-weight: 300;
    font-size: 0.48rem;
    letter-spacing: 0.72em;
    text-transform: uppercase;
    color: var(--champagne);
    opacity: 0.48;
    margin-top: 0.15rem;
    margin-bottom: 0.25rem;
    margin-left: 60px; /* offset for larger logo icon + gap */
  }
```

- [ ] **Step 2: Add a hairline rule above the name/role block**

Find:

```css
  /* Person name — bottom-left editorial placement */
  .person-block {
    position: absolute;
    bottom: 1.4rem;
    left: 2.5rem;
    z-index: 1;
  }
```

Replace with:

```css
  /* Person name — bottom-left editorial placement */
  .person-block {
    position: absolute;
    bottom: 1.4rem;
    left: 2.5rem;
    z-index: 1;
  }
  .person-block::before {
    content: '';
    position: absolute;
    top: -0.5rem;
    left: 0;
    width: 16px;
    height: 1px;
    background: var(--rose);
    opacity: 0.4;
  }
```

- [ ] **Step 3: Verify in browser**

Open `tools/business-card.html`. Confirm:
- "Studios · New York City" reads visibly more recessed/secondary compared to "Aakaara" above it.
- A short thin rose hairline appears directly above "Sudhakar Avula" in the bottom-left block, separating it from the content above.

- [ ] **Step 4: Commit**

```bash
git add "tools/business-card.html"
git commit -m "$(cat <<'EOF'
feat: sharpen business card front type hierarchy

Widens the visual gap between the Aakaara wordmark and the Studios/NYC
subtitle, and adds a hairline rule above the name/role block to
separate it from the content above.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 5: Fine paper texture (both faces)

**Files:**
- Modify: `tools/business-card.html` (`.card-front`, `.card-back` background rules)

**Interfaces:**
- Consumes: none.
- Produces: none consumed elsewhere.

- [ ] **Step 1: Layer a finer noise texture onto the front**

Find (the top of the `.card-front` background list, as left by Task 3):

```css
  .card-front {
    background:
      /* film grain texture */
      url("data:image/svg+xml,%3Csvg viewBox='0 0 512 512' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.03'/%3E%3C/svg%3E"),
```

Replace with:

```css
  .card-front {
    background:
      /* fine paper/linen texture */
      url("data:image/svg+xml,%3Csvg viewBox='0 0 512 512' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='p'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='1.3' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23p)' opacity='0.015'/%3E%3C/svg%3E"),
      /* film grain texture */
      url("data:image/svg+xml,%3Csvg viewBox='0 0 512 512' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.03'/%3E%3C/svg%3E"),
```

- [ ] **Step 2: Layer the same fine noise texture onto the back**

Find:

```css
  .card-back {
    background:
      url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.025'/%3E%3C/svg%3E"),
      linear-gradient(
        160deg,
        #0e0c10 0%,
        #12100e 40%,
        #1a1612 70%,
        #0e0c10 100%
      );
  }
```

Replace with:

```css
  .card-back {
    background:
      /* fine paper/linen texture */
      url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='p2'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='1.3' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23p2)' opacity='0.015'/%3E%3C/svg%3E"),
      url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.025'/%3E%3C/svg%3E"),
      linear-gradient(
        160deg,
        #0e0c10 0%,
        #12100e 40%,
        #1a1612 70%,
        #0e0c10 100%
      );
  }
```

(Note: the SVG `<filter>` ids `p`/`p2`/`n` are scoped to each data-URI's own inline SVG document, not the page — reusing `n` across front/back data URIs is safe and already the existing pattern in this file.)

- [ ] **Step 3: Verify in browser**

Open `tools/business-card.html`. Zoom in (browser zoom ~150–200%) on both card faces. Confirm a subtle finer-grain texture is visible layered on top of the existing grain, without making the background look noisy or muddy at normal viewing size.

- [ ] **Step 4: Commit**

```bash
git add "tools/business-card.html"
git commit -m "$(cat <<'EOF'
feat: add fine paper texture layer to business card

Layers a second, finer-grain noise texture on top of the existing
film grain on both card faces, simulating premium uncoated/soft-touch
card stock.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 6: Back-side QR + contact refinement

**Files:**
- Modify: `tools/business-card.html` (`.qr-frame`, `.qr-section`, `.contact-icon`)

**Interfaces:**
- Consumes: none.
- Produces: none consumed elsewhere.

- [ ] **Step 1: Give the QR frame an inset-bevel gradient border**

Find:

```css
  .qr-frame {
    width: 120px;
    height: 120px;
    background: var(--ivory);
    border-radius: 8px;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 8px;
    position: relative;
    box-shadow: 0 2px 12px rgba(0,0,0,0.3);
  }
```

Replace with:

```css
  .qr-frame {
    width: 120px;
    height: 120px;
    border-radius: 8px;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 8px;
    position: relative;
    border: 2px solid transparent;
    background:
      linear-gradient(var(--ivory), var(--ivory)) padding-box,
      linear-gradient(135deg, var(--rose-light), var(--rose)) border-box;
    box-shadow: 0 2px 12px rgba(0,0,0,0.3), inset 0 2px 6px rgba(0,0,0,0.15);
  }
```

- [ ] **Step 2: Add a divider rule between the QR section and contact info**

Find:

```css
  /* QR Code Area */
  .qr-section {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.6rem;
  }
```

Replace with:

```css
  /* QR Code Area */
  .qr-section {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.6rem;
    position: relative;
  }
  .qr-section::after {
    content: '';
    position: absolute;
    top: 0;
    bottom: 0;
    right: -1.25rem;
    width: 1px;
    background: var(--rose);
    opacity: 0.15;
  }
```

- [ ] **Step 3: Give contact icons slightly more presence**

Find:

```css
  .contact-icon {
    width: 14px;
    height: 14px;
    flex-shrink: 0;
    opacity: 0.5;
    color: var(--rose);
  }
```

Replace with:

```css
  .contact-icon {
    width: 14px;
    height: 14px;
    flex-shrink: 0;
    opacity: 0.62;
    color: var(--rose);
  }
```

- [ ] **Step 4: Verify in browser**

Open `tools/business-card.html`. Confirm on the back card:
- The QR frame shows a thin rose-gradient ring border and a subtle inset shadow (reads as set-in, not pasted-on-top).
- A faint vertical divider line is visible in the gap between the QR block and the contact list.
- Contact icons are slightly more visible than before but still clearly secondary to the text.
- The QR code itself still renders and is scannable (open the page, confirm the QR pattern draws correctly — the QR generation script is untouched by this task, but confirm visually the `.qr-frame` styling didn't break its layout/centering).

- [ ] **Step 5: Commit**

```bash
git add "tools/business-card.html"
git commit -m "$(cat <<'EOF'
feat: refine business card back-side QR frame and contact layout

QR frame gets an inset-bevel gradient border, adds a divider rule
between the QR block and contact list, and gives contact icons
slightly more visual presence.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Final Verification

- [ ] Open `tools/business-card.html` in a browser at full desktop width. Confirm both card faces read as a cohesive, materially richer pair (foil frame, metallic mark, deeper lighting, sheen, refined QR/contact) compared to `git show HEAD~6:tools/business-card.html` (pre-polish version) opened side-by-side or in another tab.
- [ ] Resize the browser to below 700px width. Confirm the existing responsive rules (`@media (max-width: 700px)`) still apply correctly and none of the new elements (corner accents, sheen, divider) break or overflow at the mobile card size.
- [ ] Confirm the QR code still generates and is scannable with a phone camera.
