# Client Intake Form Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a public client intake form (`intake.html`) that collects wedding event details, submits to Formspree, and generates a pre-fill link that auto-populates the quote generator's sections 01 (Client) and 02 (Schedule).

**Architecture:** `intake.html` (root, public) submits via Formspree AJAX. JS builds a URL-encoded pre-fill link included in the email body. Admin clicks the link, `quote-generator.html` reads URL params on load via a new `loadFromUrlParams()` function, and populates client + schedule fields. Pure utility functions (`buildPreFillUrl`, `parseIntakeParams`, `formatDaysForEmail`) are exported from `intake.js` for Vitest testability.

**Tech Stack:** Vanilla HTML/CSS/JS (ES modules), Formspree AJAX, Vitest (unit tests), Playwright (e2e)

---

## File Map

| Action | File | Responsibility |
|--------|------|----------------|
| Create | `intake.html` | Form markup — 4 sections, progress indicator, hidden Formspree fields |
| Create | `intake.css` | Dark cinematic styles matching Aakaara brand |
| Create | `intake.js` | Exported pure functions + DOM init (conditional fields, day builder, submit) |
| Create | `intake.test.js` | Vitest unit tests for `buildPreFillUrl` and `parseIntakeParams` |
| Create | `tests/intake.spec.js` | Playwright e2e — form behavior + quote generator pre-fill |
| Modify | `admin/quote-generator.js` | Add `loadFromUrlParams()` called at end of DOMContentLoaded |
| Modify | `admin/quote-generator.css` | Add `.intake-prefill-banner` styles |

---

## Prerequisite: Create Formspree intake form

- [ ] Go to https://formspree.io, click "New Form", name it "Aakaara Intake", set recipient to your email
- [ ] Copy the 8-character form ID from the dashboard (format: `xxxxxxxx`)
- [ ] You will replace `YOUR_FORMSPREE_ID` in Task 5 with this real ID

---

## Task 1: Unit tests for `buildPreFillUrl` and `parseIntakeParams`

**Files:**
- Create: `intake.test.js` (root)

- [ ] **Step 1: Create the failing test file**

```js
// intake.test.js
import { describe, it, expect } from 'vitest';
import { buildPreFillUrl, parseIntakeParams } from './intake.js';

describe('buildPreFillUrl', () => {
  it('encodes required fields into URL params', () => {
    const data = {
      name: 'Jane & John Doe', email: 'jane@example.com', phone: '917-555-0123',
      eventType: 'Wedding', venue: 'The Pierre Hotel', city: 'New York',
      live: 'no', liveEvents: '',
      days: [{ date: '2026-10-15', events: [{ name: 'Ceremony', dur: '3' }] }],
    };
    const url = buildPreFillUrl(data);
    expect(url).toContain('/admin/quote-generator.html?');
    expect(url).toContain('name=');
    expect(url).toContain('eventType=Wedding');
    expect(url).toContain('city=New+York');
  });

  it('omits live params when live is no', () => {
    const data = {
      name: 'A', email: 'a@a.com', phone: '1', eventType: 'Wedding',
      venue: '', city: 'NYC', live: 'no', liveEvents: '',
      days: [{ date: '2026-10-15', events: [{ name: 'Ceremony', dur: '2' }] }],
    };
    expect(buildPreFillUrl(data)).not.toContain('live=yes');
  });

  it('includes live params when live is yes', () => {
    const data = {
      name: 'A', email: 'a@a.com', phone: '1', eventType: 'Wedding',
      venue: '', city: 'NYC', live: 'yes', liveEvents: 'Ceremony',
      days: [{ date: '2026-10-15', events: [{ name: 'Ceremony', dur: '2' }] }],
    };
    const url = buildPreFillUrl(data);
    expect(url).toContain('live=yes');
    expect(url).toContain('liveEvents=Ceremony');
  });
});

describe('parseIntakeParams', () => {
  it('returns null when name param is absent', () => {
    expect(parseIntakeParams('')).toBeNull();
    expect(parseIntakeParams('?foo=bar')).toBeNull();
  });

  it('parses all fields correctly', () => {
    const params = new URLSearchParams({
      name: 'Jane Doe', email: 'jane@example.com', phone: '917-555-0123',
      eventType: 'Wedding', venue: 'The Pierre', city: 'New York',
      live: 'yes', liveEvents: 'Ceremony',
      days: JSON.stringify([{ date: '2026-10-15', events: [{ name: 'Ceremony', dur: '3' }] }]),
    });
    const result = parseIntakeParams('?' + params.toString());
    expect(result.name).toBe('Jane Doe');
    expect(result.eventType).toBe('Wedding');
    expect(result.live).toBe('yes');
    expect(result.days).toHaveLength(1);
    expect(result.days[0].events[0].name).toBe('Ceremony');
  });

  it('returns empty days array on malformed days param', () => {
    const params = new URLSearchParams({ name: 'A', email: 'a@a.com', phone: '1', days: 'not-json' });
    const result = parseIntakeParams('?' + params.toString());
    expect(result.days).toEqual([]);
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npm run test:unit -- intake.test.js
```
Expected: FAIL — `Cannot find module './intake.js'`

---

## Task 2: Create `intake.js` — pure functions + DOM init shell

**Files:**
- Create: `intake.js` (root)

- [ ] **Step 1: Create `intake.js`**

```js
// intake.js

// ── Pure functions (exported for testing) ─────────────────────────

export function buildPreFillUrl(data) {
  const p = new URLSearchParams();
  p.set('name',      data.name);
  p.set('email',     data.email);
  p.set('phone',     data.phone);
  p.set('eventType', data.eventType);
  if (data.venue) p.set('venue', data.venue);
  p.set('city', data.city);
  if (data.live === 'yes') {
    p.set('live', 'yes');
    if (data.liveEvents) p.set('liveEvents', data.liveEvents);
  }
  p.set('days', JSON.stringify(data.days));
  return `/admin/quote-generator.html?${p.toString()}`;
}

export function parseIntakeParams(searchString) {
  const p = new URLSearchParams(searchString);
  if (!p.has('name')) return null;
  let days = [];
  try { days = JSON.parse(p.get('days') || '[]'); } catch { days = []; }
  return {
    name:       p.get('name')       || '',
    email:      p.get('email')      || '',
    phone:      p.get('phone')      || '',
    eventType:  p.get('eventType')  || '',
    venue:      p.get('venue')      || '',
    city:       p.get('city')       || '',
    live:       p.get('live')       || 'no',
    liveEvents: p.get('liveEvents') || '',
    days,
  };
}

export function formatDaysForEmail(days) {
  return days.map((day, i) => {
    const events = day.events.map(e => `${e.name} (${e.dur}h)`).join(', ');
    return `Day ${i + 1} (${day.date || 'TBD'}): ${events || 'No events listed'}`;
  }).join('\n');
}

// ── DOM init — browser only ───────────────────────────────────────

if (typeof document !== 'undefined') {
  document.addEventListener('DOMContentLoaded', initIntakeForm);
}

function initIntakeForm() {
  // populated in Task 5
}
```

- [ ] **Step 2: Run unit tests — confirm they pass**

```bash
npm run test:unit -- intake.test.js
```
Expected: PASS — all 6 tests green

- [ ] **Step 3: Commit**

```bash
git add intake.js intake.test.js
git commit -m "feat: add intake URL builder and param parser with unit tests"
```

---

## Task 3: Create `intake.html` — form structure

**Files:**
- Create: `intake.html` (root)

- [ ] **Step 1: Create `intake.html`**

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Tell Us About Your Day — Aakaara Studios</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@300;400;500&family=Outfit:wght@200;300;400;500&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="intake.css">
</head>
<body>

<header class="intake-header">
  <div class="intake-logo">
    <svg width="32" height="32" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
      <ellipse cx="50" cy="30" rx="12" ry="28" fill="#c9956b" opacity="0.85" transform="rotate(0 50 50)"/>
      <ellipse cx="50" cy="30" rx="12" ry="28" fill="#c9956b" opacity="0.55" transform="rotate(90 50 50)"/>
      <ellipse cx="50" cy="30" rx="12" ry="28" fill="#c9956b" opacity="0.35" transform="rotate(45 50 50)"/>
      <ellipse cx="50" cy="30" rx="12" ry="28" fill="#c9956b" opacity="0.2" transform="rotate(135 50 50)"/>
    </svg>
    <span class="intake-brand">Aakaara Studios</span>
  </div>
</header>

<main class="intake-main">
  <div class="intake-hero">
    <p class="intake-eyebrow">Let's get started</p>
    <h1 class="intake-title">Tell us about your day</h1>
    <p class="intake-subtitle">Fill in the details below and we'll have a personalised quote ready for you.</p>
  </div>

  <div class="intake-progress" aria-label="Form progress">
    <div class="progress-step active" data-step="1">
      <span class="step-num">01</span><span class="step-label">Details</span>
    </div>
    <div class="progress-divider"></div>
    <div class="progress-step" data-step="2">
      <span class="step-num">02</span><span class="step-label">Event</span>
    </div>
    <div class="progress-divider"></div>
    <div class="progress-step" data-step="3">
      <span class="step-num">03</span><span class="step-label">Pre-Wedding</span>
    </div>
    <div class="progress-divider"></div>
    <div class="progress-step" data-step="4">
      <span class="step-num">04</span><span class="step-label">Schedule</span>
    </div>
  </div>

  <form id="intakeForm" novalidate>
    <!-- Honeypot — bots fill this, humans don't -->
    <input type="text" name="_gotcha" tabindex="-1" autocomplete="off" style="display:none">

    <!-- Hidden fields populated by JS before Formspree submit -->
    <input type="hidden" name="_subject"      id="fs_subject">
    <input type="hidden" name="schedule_text" id="fs_schedule">
    <input type="hidden" name="prefill_link"  id="fs_link">

    <!-- 01 Your Details -->
    <section class="intake-section" id="step1">
      <div class="section-accent"></div>
      <h2 class="section-title"><span class="section-num">01</span> Your Details</h2>

      <div class="field-group">
        <label class="field-label" for="clientName">Full name(s)</label>
        <input type="text" id="clientName" name="client_name" required autocomplete="name" placeholder="e.g. Priya &amp; Arjun Mehta">
        <span class="field-error" id="err-clientName"></span>
      </div>
      <div class="field-row">
        <div class="field-group">
          <label class="field-label" for="clientEmail">Email</label>
          <input type="email" id="clientEmail" name="client_email" required autocomplete="email" placeholder="your@email.com">
          <span class="field-error" id="err-clientEmail"></span>
        </div>
        <div class="field-group">
          <label class="field-label" for="clientPhone">Phone</label>
          <input type="tel" id="clientPhone" name="client_phone" required autocomplete="tel" placeholder="+1 (917) 555-0123">
          <span class="field-error" id="err-clientPhone"></span>
        </div>
      </div>
    </section>

    <!-- 02 Your Event -->
    <section class="intake-section" id="step2">
      <div class="section-accent"></div>
      <h2 class="section-title"><span class="section-num">02</span> Your Event</h2>

      <div class="field-row">
        <div class="field-group">
          <label class="field-label" for="eventType">Event type</label>
          <select id="eventType" name="event_type" required>
            <option value="">Select…</option>
            <option value="Wedding">Wedding</option>
            <option value="Engagement">Engagement</option>
            <option value="Portrait">Portrait</option>
            <option value="Maternity">Maternity</option>
            <option value="Family">Family</option>
            <option value="Other">Other</option>
          </select>
          <span class="field-error" id="err-eventType"></span>
        </div>
        <div class="field-group">
          <label class="field-label" for="eventDate">Event date</label>
          <input type="date" id="eventDate" name="event_date" required>
          <span class="field-error" id="err-eventDate"></span>
        </div>
      </div>
      <div class="field-row">
        <div class="field-group">
          <label class="field-label" for="venue">Venue / Location name</label>
          <input type="text" id="venue" name="venue" autocomplete="off" placeholder="e.g. The Pierre Hotel">
        </div>
        <div class="field-group">
          <label class="field-label" for="city">City</label>
          <input type="text" id="city" name="city" required autocomplete="off" placeholder="e.g. New York">
          <span class="field-error" id="err-city"></span>
        </div>
      </div>
      <div class="field-group">
        <label class="field-label">Will any events require live streaming?</label>
        <div class="radio-group">
          <label class="radio-label"><input type="radio" name="live" value="no" checked> No</label>
          <label class="radio-label"><input type="radio" name="live" value="yes"> Yes</label>
        </div>
      </div>
      <div class="field-group conditional" id="liveEventsField" hidden>
        <label class="field-label" for="liveEvents">Which event(s) need live coverage?</label>
        <input type="text" id="liveEvents" name="live_events" placeholder="e.g. Wedding Ceremony, Sangeet">
      </div>
    </section>

    <!-- 03 Pre-Wedding Shoot -->
    <section class="intake-section" id="step3">
      <div class="section-accent"></div>
      <h2 class="section-title"><span class="section-num">03</span> Pre-Wedding Shoot</h2>
      <p class="section-description">A pre-wedding session is a wonderful way to get comfortable in front of the camera before your big day — and creates beautiful images for invitations or décor.</p>
      <div class="field-group">
        <label class="field-label">Are you interested in a pre-wedding shoot?</label>
        <div class="radio-group">
          <label class="radio-label"><input type="radio" name="prewed" value="no" checked> Not for us</label>
          <label class="radio-label"><input type="radio" name="prewed" value="maybe"> Not sure yet</label>
          <label class="radio-label"><input type="radio" name="prewed" value="yes"> Yes, interested</label>
        </div>
      </div>
      <div class="field-group conditional" id="prewedDetails" hidden>
        <label class="field-label" for="prewedVibe">Preferred vibe or location <span class="optional">(optional)</span></label>
        <input type="text" id="prewedVibe" name="prewed_vibe" placeholder="e.g. Golden hour in Central Park">
        <label class="field-label" for="prewedDates" style="margin-top:12px">Preferred date range <span class="optional">(optional)</span></label>
        <input type="text" id="prewedDates" name="prewed_dates" placeholder="e.g. September 2026">
      </div>
    </section>

    <!-- 04 Your Schedule -->
    <section class="intake-section" id="step4">
      <div class="section-accent"></div>
      <h2 class="section-title"><span class="section-num">04</span> Your Schedule</h2>
      <p class="section-description">Tell us how many days your celebration spans and what happens each day.</p>
      <div class="field-group">
        <label class="field-label">How many days does your event span?</label>
        <div class="day-pills" id="dayPills">
          <button type="button" class="day-pill active" data-days="1">1</button>
          <button type="button" class="day-pill" data-days="2">2</button>
          <button type="button" class="day-pill" data-days="3">3</button>
          <button type="button" class="day-pill" data-days="4">4</button>
          <button type="button" class="day-pill" data-days="5">5</button>
        </div>
      </div>
      <div id="daysBuilder"></div>
    </section>

    <div class="intake-submit-area">
      <button type="submit" id="submitBtn" class="btn-submit">Send My Details</button>
      <p class="submit-note">We'll review your details and send a personalised quote within 24 hours.</p>
    </div>

    <div id="successMessage" class="success-message" hidden>
      <div class="success-icon">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="20 6 9 17 4 12"/>
        </svg>
      </div>
      <h3 class="success-title">Thank you!</h3>
      <p class="success-body">We've received your details and will be in touch within 24 hours. We can't wait to be part of your day.</p>
    </div>
  </form>
</main>

<footer class="intake-footer">
  <p>© 2026 Aakaara Studios NYC &nbsp;·&nbsp; <a href="/">Back to site</a></p>
</footer>

<script type="module" src="intake.js"></script>
</body>
</html>
```

- [ ] **Step 2: Verify structure in browser**

```bash
npx serve .
```
Navigate to `http://localhost:3000/intake.html`. Confirm: 4 section cards render, form fields present, no JS console errors.

- [ ] **Step 3: Commit**

```bash
git add intake.html
git commit -m "feat: add client intake form HTML structure"
```

---

## Task 4: Create `intake.css` — dark cinematic styles

**Files:**
- Create: `intake.css` (root)

- [ ] **Step 1: Create `intake.css`**

```css
/* intake.css */
:root {
  --noir:        #09080b;
  --umber:       #1e1a16;
  --rose:        #c9956b;
  --rose-light:  #dbb08a;
  --ivory:       #faf6f1;
  --champagne:   #f2e6d9;
  --muted:       rgba(250, 246, 241, 0.45);
  --border:      rgba(201, 149, 107, 0.2);
  --font-display: 'Cormorant Garamond', Georgia, serif;
  --font-body:    'Outfit', 'Helvetica Neue', sans-serif;
  --ease:         cubic-bezier(0.16, 1, 0.3, 1);
}

*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
html { scroll-behavior: smooth; }
body {
  background: var(--noir);
  color: var(--ivory);
  font-family: var(--font-body);
  font-size: 16px;
  line-height: 1.6;
  -webkit-font-smoothing: antialiased;
}

/* Header */
.intake-header { padding: 24px 32px; border-bottom: 1px solid var(--border); display: flex; align-items: center; }
.intake-logo   { display: flex; align-items: center; gap: 12px; }
.intake-brand  { font-family: var(--font-display); font-size: 1.2rem; font-weight: 400; letter-spacing: 0.08em; }

/* Main */
.intake-main { max-width: 680px; margin: 0 auto; padding: 56px 24px 80px; }

/* Hero */
.intake-hero { text-align: center; margin-bottom: 48px; }
.intake-eyebrow {
  font-size: 0.75rem; letter-spacing: 0.2em; text-transform: uppercase;
  color: var(--rose); margin-bottom: 12px;
}
.intake-title {
  font-family: var(--font-display);
  font-size: clamp(2.2rem, 6vw, 3.2rem);
  font-weight: 300; line-height: 1.15; margin-bottom: 16px;
}
.intake-subtitle { color: var(--muted); font-size: 1rem; max-width: 480px; margin: 0 auto; }

/* Progress */
.intake-progress { display: flex; align-items: center; justify-content: center; margin-bottom: 48px; }
.progress-step {
  display: flex; flex-direction: column; align-items: center; gap: 4px;
  opacity: 0.35; transition: opacity 0.3s var(--ease); min-width: 60px;
}
.progress-step.active { opacity: 1; }
.progress-step.done   { opacity: 0.7; }
.step-num { font-family: var(--font-display); font-size: 1.1rem; color: var(--rose); line-height: 1; }
.step-label { font-size: 0.65rem; letter-spacing: 0.12em; text-transform: uppercase; color: var(--muted); }
.progress-divider { flex: 1; height: 1px; background: var(--border); max-width: 48px; margin: 0 4px 14px; }

/* Sections */
.intake-section {
  background: rgba(30, 26, 22, 0.6);
  border: 1px solid var(--border);
  border-radius: 12px; padding: 32px; margin-bottom: 24px;
  position: relative; overflow: hidden;
}
.section-accent {
  position: absolute; top: 0; left: 0; right: 0; height: 2px;
  background: linear-gradient(90deg, var(--rose), transparent);
}
.section-title {
  font-family: var(--font-display); font-size: 1.4rem; font-weight: 400;
  color: var(--ivory); margin-bottom: 24px;
  display: flex; align-items: baseline; gap: 12px;
}
.section-num { font-size: 0.85rem; color: var(--rose); letter-spacing: 0.1em; }
.section-description { color: var(--muted); font-size: 0.9rem; margin-bottom: 24px; line-height: 1.65; }

/* Fields */
.field-row { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
.field-group { display: flex; flex-direction: column; gap: 6px; margin-bottom: 16px; }
.field-group:last-child { margin-bottom: 0; }
.field-label { font-size: 0.75rem; letter-spacing: 0.1em; text-transform: uppercase; color: var(--muted); }
.optional { font-size: 0.7rem; color: rgba(250,246,241,0.3); text-transform: none; letter-spacing: 0; }

input[type="text"], input[type="email"], input[type="tel"],
input[type="date"], input[type="number"], select {
  background: rgba(9, 8, 11, 0.6);
  border: 1px solid rgba(201, 149, 107, 0.25);
  border-radius: 8px; color: var(--ivory);
  font-family: var(--font-body); font-size: 0.95rem;
  padding: 12px 14px; outline: none; width: 100%; min-height: 44px;
  transition: border-color 0.2s var(--ease), box-shadow 0.2s var(--ease);
}
input::placeholder { color: rgba(250,246,241,0.25); }
input:focus, select:focus {
  border-color: var(--rose);
  box-shadow: 0 0 0 3px rgba(201,149,107,0.12);
}
select {
  appearance: none;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'%3E%3Cpath d='M1 1l5 5 5-5' stroke='%23c9956b' stroke-width='1.5' fill='none' stroke-linecap='round'/%3E%3C/svg%3E");
  background-repeat: no-repeat; background-position: right 14px center;
  padding-right: 36px; cursor: pointer;
}
select option { background: var(--umber); }
.field-error { color: #e07070; font-size: 0.75rem; min-height: 16px; }

/* Radios */
.radio-group { display: flex; flex-wrap: wrap; gap: 12px; margin-top: 4px; }
.radio-label {
  display: flex; align-items: center; gap: 8px; cursor: pointer;
  font-size: 0.9rem; color: var(--champagne);
  padding: 8px 16px; border: 1px solid var(--border); border-radius: 24px; min-height: 44px;
  transition: border-color 0.2s var(--ease), background 0.2s var(--ease);
}
.radio-label:hover { border-color: var(--rose); }
.radio-label input[type="radio"] { width: 16px; height: 16px; min-height: unset; accent-color: var(--rose); cursor: pointer; }
.radio-label:has(input:checked) { border-color: var(--rose); background: rgba(201,149,107,0.1); color: var(--ivory); }

/* Conditional fields */
.conditional { max-height: 0; overflow: hidden; opacity: 0; transition: max-height 0.25s var(--ease), opacity 0.25s var(--ease); }
.conditional.visible { max-height: 220px; opacity: 1; }

/* Day pills */
.day-pills { display: flex; gap: 10px; flex-wrap: wrap; margin-top: 4px; }
.day-pill {
  width: 48px; height: 48px; border-radius: 50%;
  border: 1px solid var(--border); background: transparent;
  color: var(--champagne); font-family: var(--font-body); font-size: 1rem;
  cursor: pointer;
  transition: border-color 0.2s var(--ease), background 0.2s var(--ease), color 0.2s var(--ease);
}
.day-pill:hover { border-color: var(--rose); }
.day-pill.active { border-color: var(--rose); background: rgba(201,149,107,0.15); color: var(--ivory); }

/* Day cards */
#daysBuilder { margin-top: 24px; }
.day-card {
  background: rgba(9, 8, 11, 0.4);
  border: 1px solid rgba(201,149,107,0.15);
  border-radius: 10px; padding: 20px; margin-bottom: 16px;
}
.day-card-header {
  font-family: var(--font-display); font-size: 1rem;
  color: var(--rose-light); margin-bottom: 16px; letter-spacing: 0.06em;
}
.event-row { display: grid; grid-template-columns: 1fr 100px; gap: 10px; margin-bottom: 10px; align-items: start; }
.event-row .field-group { margin-bottom: 0; }
.add-event-btn {
  background: none; border: none; color: var(--rose);
  font-size: 0.8rem; letter-spacing: 0.08em; cursor: pointer;
  padding: 4px 0; font-family: var(--font-body); transition: opacity 0.2s;
}
.add-event-btn:hover { opacity: 0.7; }
.event-hours-label { font-size: 0.7rem; color: var(--muted); margin-top: 2px; }

/* Submit */
.intake-submit-area { text-align: center; padding: 16px 0 0; }
.btn-submit {
  background: linear-gradient(135deg, var(--rose), var(--rose-light));
  color: var(--noir); border: none; border-radius: 50px;
  font-family: var(--font-body); font-size: 0.9rem; font-weight: 500;
  letter-spacing: 0.12em; text-transform: uppercase; padding: 16px 48px;
  cursor: pointer; min-height: 44px;
  transition: opacity 0.2s var(--ease), transform 0.2s var(--ease);
}
.btn-submit:hover    { opacity: 0.9; transform: translateY(-1px); }
.btn-submit:disabled { opacity: 0.5; cursor: not-allowed; transform: none; }
.submit-note { color: var(--muted); font-size: 0.8rem; margin-top: 12px; }

/* Success */
.success-message {
  text-align: center; padding: 40px 24px; margin-top: 16px;
  border: 1px solid rgba(201,149,107,0.3); border-radius: 12px;
  background: rgba(201,149,107,0.05);
}
.success-icon {
  width: 48px; height: 48px; border-radius: 50%; border: 1px solid var(--rose);
  display: flex; align-items: center; justify-content: center;
  margin: 0 auto 16px; color: var(--rose);
}
.success-title { font-family: var(--font-display); font-size: 1.6rem; font-weight: 400; margin-bottom: 8px; }
.success-body  { color: var(--muted); font-size: 0.95rem; max-width: 380px; margin: 0 auto; }

/* Footer */
.intake-footer { text-align: center; padding: 24px; border-top: 1px solid var(--border); color: var(--muted); font-size: 0.8rem; }
.intake-footer a { color: var(--rose); text-decoration: none; }

/* Pre-fill banner (rendered inside quote generator) */
.intake-prefill-banner {
  background: rgba(201,149,107,0.12); border: 1px solid rgba(201,149,107,0.35);
  color: #dbb08a; padding: 10px 16px; border-radius: 6px;
  font-size: 0.8rem; letter-spacing: 0.05em; margin-bottom: 16px;
}

/* Responsive */
@media (max-width: 640px) {
  .intake-header  { padding: 16px 20px; }
  .intake-main    { padding: 40px 16px 60px; }
  .intake-section { padding: 24px 20px; }
  .field-row      { grid-template-columns: 1fr; }
  .event-row      { grid-template-columns: 1fr 80px; }
  .progress-divider { max-width: 24px; }
}

@media (prefers-reduced-motion: reduce) {
  .conditional { transition: none; }
  .btn-submit:hover { transform: none; }
}
```

- [ ] **Step 2: Verify visuals in browser** — `http://localhost:3000/intake.html`. Confirm: dark noir background, rose gold accents, gold top stripe on each section card, Cormorant Garamond headings. Check at 375px viewport width — two-column rows should collapse to single column.

- [ ] **Step 3: Commit**

```bash
git add intake.css
git commit -m "feat: add intake form dark cinematic styles"
```

---

## Task 5: Add form interactivity to `intake.js`

**Files:**
- Modify: `intake.js` (root — replace `initIntakeForm` and add helper functions)

- [ ] **Step 1: Replace `function initIntakeForm() { // populated in Task 5 }` and add all helpers below it**

The complete replacement block (everything from `function initIntakeForm` to end of file):

```js
function initIntakeForm() {
  // Conditional: live streaming
  document.querySelectorAll('input[name="live"]').forEach(radio => {
    radio.addEventListener('change', () => {
      const isYes = document.querySelector('input[name="live"]:checked')?.value === 'yes';
      toggleConditional(document.getElementById('liveEventsField'), isYes);
    });
  });

  // Conditional: pre-wedding shoot
  document.querySelectorAll('input[name="prewed"]').forEach(radio => {
    radio.addEventListener('change', () => {
      const val = document.querySelector('input[name="prewed"]:checked')?.value;
      toggleConditional(document.getElementById('prewedDetails'), val === 'yes');
    });
  });

  // Day pill selector
  const dayPills = document.querySelectorAll('.day-pill');
  dayPills.forEach(pill => {
    pill.addEventListener('click', () => {
      dayPills.forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
      renderDays(parseInt(pill.dataset.days, 10));
    });
  });
  renderDays(1);

  // Progress scrollspy — highlights the progress step for the visible section
  const sections     = document.querySelectorAll('.intake-section');
  const progressSteps = document.querySelectorAll('.progress-step');
  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const idx = Array.from(sections).indexOf(entry.target);
        progressSteps.forEach((s, i) => {
          s.classList.toggle('active', i === idx);
          s.classList.toggle('done',   i < idx);
        });
      }
    });
  }, { threshold: 0.5 });
  sections.forEach(s => observer.observe(s));

  // Form submit
  const form      = document.getElementById('intakeForm');
  const submitBtn = document.getElementById('submitBtn');

  form.addEventListener('submit', async e => {
    e.preventDefault();
    if (!validateForm()) return;

    submitBtn.disabled   = true;
    submitBtn.textContent = 'Sending…';

    const data = collectFormData();
    document.getElementById('fs_subject').value  = `New Inquiry — ${data.name}`;
    document.getElementById('fs_schedule').value = formatDaysForEmail(data.days);
    document.getElementById('fs_link').value     = window.location.origin + buildPreFillUrl(data);

    try {
      const res = await fetch('https://formspree.io/f/YOUR_FORMSPREE_ID', {
        method:  'POST',
        body:    new FormData(form),
        headers: { Accept: 'application/json' },
      });

      if (res.ok) {
        document.querySelector('.intake-submit-area').hidden = true;
        document.getElementById('successMessage').hidden     = false;
      } else {
        submitBtn.disabled    = false;
        submitBtn.textContent = 'Send My Details';
        alert('Something went wrong. Please try again or email us directly.');
      }
    } catch {
      submitBtn.disabled    = false;
      submitBtn.textContent = 'Send My Details';
      alert('Something went wrong. Please try again or email us directly.');
    }
  });
}

function toggleConditional(el, show) {
  if (show) {
    el.hidden = false;
    el.offsetHeight; // force reflow so CSS transition fires
    el.classList.add('visible');
  } else {
    el.classList.remove('visible');
    el.addEventListener('transitionend', () => { el.hidden = true; }, { once: true });
  }
}

function renderDays(count) {
  const container = document.getElementById('daysBuilder');
  container.textContent = ''; // clear without XSS risk
  for (let i = 1; i <= count; i++) container.appendChild(buildDayCard(i));
}

function buildDayCard(dayNum) {
  const card = document.createElement('div');
  card.className      = 'day-card';
  card.dataset.dayNum = String(dayNum);

  const header = document.createElement('div');
  header.className   = 'day-card-header';
  header.textContent = `Day ${dayNum}`;

  const dateGroup = document.createElement('div');
  dateGroup.className = 'field-group';

  const dateLabel = document.createElement('label');
  dateLabel.className   = 'field-label';
  dateLabel.textContent = 'Date';

  const dateInput = document.createElement('input');
  dateInput.type      = 'date';
  dateInput.className = 'day-date';

  dateGroup.appendChild(dateLabel);
  dateGroup.appendChild(dateInput);

  const eventsList = document.createElement('div');
  eventsList.className = 'events-list';

  const addBtn = document.createElement('button');
  addBtn.type        = 'button';
  addBtn.className   = 'add-event-btn';
  addBtn.textContent = '+ Add event';
  addBtn.addEventListener('click', () => {
    if (eventsList.children.length < 3) addEventRow(eventsList);
  });

  card.appendChild(header);
  card.appendChild(dateGroup);
  card.appendChild(eventsList);
  card.appendChild(addBtn);

  addEventRow(eventsList); // always start with one event row
  return card;
}

function addEventRow(list) {
  const row = document.createElement('div');
  row.className = 'event-row';

  const nameGroup = document.createElement('div');
  nameGroup.className = 'field-group';

  const nameInput = document.createElement('input');
  nameInput.type         = 'text';
  nameInput.className    = 'event-name';
  nameInput.placeholder  = 'Event name (e.g. Ceremony)';
  nameInput.autocomplete = 'off';

  nameGroup.appendChild(nameInput);

  const hoursGroup = document.createElement('div');
  hoursGroup.className = 'field-group';

  const hoursInput = document.createElement('input');
  hoursInput.type        = 'number';
  hoursInput.className   = 'event-hours';
  hoursInput.min         = '0.5';
  hoursInput.max         = '24';
  hoursInput.step        = '0.5';
  hoursInput.placeholder = 'Hrs';

  const hoursSpan = document.createElement('span');
  hoursSpan.className   = 'event-hours-label';
  hoursSpan.textContent = 'hours';

  hoursGroup.appendChild(hoursInput);
  hoursGroup.appendChild(hoursSpan);

  row.appendChild(nameGroup);
  row.appendChild(hoursGroup);
  list.appendChild(row);
}

function collectFormData() {
  const days = [];
  document.querySelectorAll('.day-card').forEach(card => {
    const date   = card.querySelector('.day-date').value;
    const events = [];
    card.querySelectorAll('.event-row').forEach(row => {
      const name = row.querySelector('.event-name').value.trim();
      const dur  = row.querySelector('.event-hours').value.trim();
      if (name || dur) events.push({ name, dur });
    });
    days.push({ date, events });
  });

  return {
    name:       document.getElementById('clientName').value.trim(),
    email:      document.getElementById('clientEmail').value.trim(),
    phone:      document.getElementById('clientPhone').value.trim(),
    eventType:  document.getElementById('eventType').value,
    venue:      document.getElementById('venue').value.trim(),
    city:       document.getElementById('city').value.trim(),
    live:       document.querySelector('input[name="live"]:checked')?.value || 'no',
    liveEvents: document.getElementById('liveEvents').value.trim(),
    days,
  };
}

function validateForm() {
  const fields = [
    { id: 'clientName',  errId: 'err-clientName',  msg: 'Please enter your name'    },
    { id: 'clientEmail', errId: 'err-clientEmail', msg: 'Please enter a valid email' },
    { id: 'clientPhone', errId: 'err-clientPhone', msg: 'Please enter your phone'    },
    { id: 'eventType',   errId: 'err-eventType',   msg: 'Please select event type'   },
    { id: 'eventDate',   errId: 'err-eventDate',   msg: 'Please select a date'       },
    { id: 'city',        errId: 'err-city',         msg: 'Please enter the city'      },
  ];
  let valid = true;
  fields.forEach(({ id, errId, msg }) => {
    const el  = document.getElementById(id);
    const err = document.getElementById(errId);
    if (!el.value.trim()) {
      if (err) err.textContent = msg;
      if (valid) el.focus();
      valid = false;
    } else {
      if (err) err.textContent = '';
    }
  });
  return valid;
}
```

- [ ] **Step 2: Verify interactivity in browser**
  - "Yes" on live streaming radio → `#liveEventsField` slides down; "No" → slides back up
  - "Yes, interested" on pre-wedding radio → `#prewedDetails` slides down
  - Day pill "3" → 3 day cards render
  - "+ Add event" adds row up to 3; 4th click does nothing
  - Submit with all fields empty → first empty field focused, error text appears
  - Console: zero errors

- [ ] **Step 3: Commit**

```bash
git add intake.js
git commit -m "feat: add intake form interactivity — conditional fields, day builder, validation, submit"
```

---

## Task 6: Add `loadFromUrlParams()` to `quote-generator.js`

**Files:**
- Modify: `admin/quote-generator.js`
- Modify: `admin/quote-generator.css`

- [ ] **Step 1: Add `loadFromUrlParams` function to `admin/quote-generator.js`**

Add this function at module scope (before or after other named functions, outside the DOMContentLoaded callback):

```js
function loadFromUrlParams() {
  const p = new URLSearchParams(location.search);
  if (!p.has('name')) return;

  $('clientName').value  = p.get('name')  || '';
  $('clientEmail').value = p.get('email') || '';
  $('clientPhone').value = p.get('phone') || '';

  const et = p.get('eventType');
  if (et) $('eventType').value = et;

  $('venueName').value = p.get('venue') || '';
  $('location').value  = p.get('city')  || '';

  if (p.get('live') === 'yes') {
    const events = p.get('liveEvents');
    $('customNotes').value = events
      ? `Live streaming required: ${events}`
      : 'Live streaming required';
  }

  let days = [];
  try { days = JSON.parse(p.get('days') || '[]'); } catch {}
  days.forEach(day => addDay(day));

  const banner = document.createElement('div');
  banner.className   = 'intake-prefill-banner';
  banner.textContent = 'Pre-filled from client intake';
  $('qgMain').insertBefore(banner, $('qgMain').firstChild);

  scheduleDraftSave();
}
```

- [ ] **Step 2: Call `loadFromUrlParams()` at the end of the `DOMContentLoaded` callback**

Find the closing `});` of the `document.addEventListener('DOMContentLoaded', ...)` block. Add this as the last line before it:

```js
  loadFromUrlParams();
```

- [ ] **Step 3: Add banner CSS to `admin/quote-generator.css`**

Append to the bottom of `admin/quote-generator.css`:

```css
.intake-prefill-banner {
  background: rgba(201, 149, 107, 0.12);
  border: 1px solid rgba(201, 149, 107, 0.35);
  color: #dbb08a;
  padding: 10px 16px;
  border-radius: 6px;
  font-size: 0.8rem;
  letter-spacing: 0.05em;
  margin-bottom: 16px;
}
```

- [ ] **Step 4: Test pre-fill manually in browser**

Start: `npx serve .`

Visit:
```
http://localhost:3000/admin/quote-generator.html?name=Test+Client&email=test@test.com&phone=555-1234&eventType=Wedding&venue=The+Pierre&city=New+York&live=yes&liveEvents=Ceremony&days=[{"date":"2026-10-15","events":[{"name":"Ceremony","dur":"3"},{"name":"Reception","dur":"5"}]}]
```

Confirm all of these are true:
- `#clientName` value = "Test Client"
- `#clientEmail` value = "test@test.com"
- `#eventType` select = "Wedding"
- `#venueName` value = "The Pierre"
- `#location` value = "New York"
- `#customNotes` value = "Live streaming required: Ceremony"
- One day card rendered with Ceremony (3h) and Reception (5h) events
- Rose banner "Pre-filled from client intake" visible at top

- [ ] **Step 5: Commit**

```bash
git add admin/quote-generator.js admin/quote-generator.css
git commit -m "feat: pre-fill quote generator sections 01 & 02 from intake URL params"
```

---

## Task 7: Playwright e2e smoke tests

**Files:**
- Create: `tests/intake.spec.js`

- [ ] **Step 1: Create test file**

```js
// tests/intake.spec.js
import { test, expect } from '@playwright/test';

test.describe('Intake form', () => {
  test.beforeEach(async ({ page }) => { await page.goto('/intake.html'); });

  test('renders all 4 sections', async ({ page }) => {
    await expect(page.locator('#step1')).toBeVisible();
    await expect(page.locator('#step2')).toBeVisible();
    await expect(page.locator('#step3')).toBeVisible();
    await expect(page.locator('#step4')).toBeVisible();
  });

  test('live streaming field shows when Yes selected', async ({ page }) => {
    await expect(page.locator('#liveEventsField')).toBeHidden();
    await page.locator('input[name="live"][value="yes"]').click();
    await expect(page.locator('#liveEventsField')).toBeVisible();
  });

  test('pre-wedding details show when Yes selected', async ({ page }) => {
    await expect(page.locator('#prewedDetails')).toBeHidden();
    await page.locator('input[name="prewed"][value="yes"]').click();
    await expect(page.locator('#prewedDetails')).toBeVisible();
  });

  test('day pills render correct number of day cards', async ({ page }) => {
    await page.locator('.day-pill[data-days="3"]').click();
    await expect(page.locator('.day-card')).toHaveCount(3);
  });

  test('add-event button respects 3-row maximum', async ({ page }) => {
    const addBtn = page.locator('.add-event-btn').first();
    await addBtn.click(); // 2
    await addBtn.click(); // 3
    await addBtn.click(); // should not add 4th
    await expect(page.locator('.day-card').first().locator('.event-row')).toHaveCount(3);
  });

  test('validation shows error for empty required fields', async ({ page }) => {
    await page.locator('#submitBtn').click();
    await expect(page.locator('#err-clientName')).not.toBeEmpty();
  });
});

test.describe('Quote generator pre-fill', () => {
  test('populates client and schedule from URL params', async ({ page }) => {
    const days = JSON.stringify([{
      date: '2026-10-15',
      events: [{ name: 'Ceremony', dur: '3' }],
    }]);
    const params = new URLSearchParams({
      name: 'Test Client', email: 'test@example.com', phone: '555-1234',
      eventType: 'Wedding', venue: 'Test Venue', city: 'New York',
      live: 'yes', liveEvents: 'Ceremony', days,
    });
    await page.goto(`/admin/quote-generator.html?${params.toString()}`);

    await expect(page.locator('#clientName')).toHaveValue('Test Client');
    await expect(page.locator('#clientEmail')).toHaveValue('test@example.com');
    await expect(page.locator('#location')).toHaveValue('New York');
    await expect(page.locator('#customNotes')).toContainText('Ceremony');
    await expect(page.locator('.intake-prefill-banner')).toBeVisible();
    await expect(page.locator('.day-block')).toHaveCount(1);
  });

  test('skips pre-fill when name param absent', async ({ page }) => {
    await page.goto('/admin/quote-generator.html?foo=bar');
    await expect(page.locator('#clientName')).toHaveValue('');
    await expect(page.locator('.intake-prefill-banner')).toHaveCount(0);
  });
});
```

- [ ] **Step 2: Run e2e tests**

```bash
npm run test:e2e -- tests/intake.spec.js
```
Expected: PASS — all 7 tests green

- [ ] **Step 3: Commit**

```bash
git add tests/intake.spec.js
git commit -m "test: Playwright e2e for intake form and quote generator pre-fill"
```

---

## Task 8: Wire Formspree ID + full test run

**Files:**
- Modify: `intake.js`

- [ ] **Step 1: Replace the Formspree placeholder in `intake.js`**

Find in `intake.js`:
```js
const res = await fetch('https://formspree.io/f/YOUR_FORMSPREE_ID', {
```
Replace `YOUR_FORMSPREE_ID` with the real 8-character ID from the Formspree dashboard.

- [ ] **Step 2: Run the full test suite**

```bash
npm test
```
Expected: all unit and e2e tests pass

- [ ] **Step 3: Final commit**

```bash
git add intake.js
git commit -m "feat: wire Formspree endpoint for client intake form"
```

---

## Self-Review — Spec Coverage

| Spec requirement | Task |
|-----------------|------|
| Public `intake.html` at root | Task 3 |
| Section 01: name, email, phone | Task 3 |
| Section 02: event type, date, venue, city | Task 3 |
| Section 02: live streaming yes/no + conditional events field | Tasks 3, 5 |
| Section 03: pre-wedding interest + conditional vibe/dates | Tasks 3, 5 |
| Section 04: day pill selector 1–5 | Tasks 3, 5 |
| Section 04: per-day date + event name + hours (up to 3) | Tasks 3, 5 |
| Client-side validation before submit | Task 5 |
| Formspree AJAX submission with all fields | Task 5 |
| Pre-fill URL built and included in email via hidden field | Task 5 |
| Inline thank-you on success (no redirect) | Tasks 3, 5 |
| Honeypot spam protection field | Task 3 |
| `loadFromUrlParams()` in quote-generator.js | Task 6 |
| Sections 01 and 02 auto-populated from URL params | Task 6 |
| Live note written to customNotes when live=yes | Task 6 |
| Rose banner shown when pre-filled | Tasks 4, 6 |
| Dark cinematic Aakaara brand styling | Task 4 |
| 4-step progress scrollspy | Tasks 3, 4, 5 |
| Mobile responsive (640px breakpoint) | Task 4 |
| prefers-reduced-motion respected | Task 4 |
| Unit tests: buildPreFillUrl, parseIntakeParams | Tasks 1, 2 |
| E2e tests: form behavior + pre-fill | Task 7 |

All 22 spec requirements covered. No TBDs or placeholders remain in implementation steps.
