# Client Intake Form — Design Spec
**Date:** 2026-05-25  
**Project:** Aakaara Studios NYC  
**Status:** Approved

---

## Overview

A public-facing client intake form (`intake.html`) at the site root that collects essential wedding event details from clients. On submission, Formspree emails the admin with all data plus a pre-fill link. Clicking that link opens `/admin/quote-generator.html` with sections 01 (Client Info) and 02 (Schedule) already populated, so the admin only needs to add Deliverables and Pricing before generating the PDF.

---

## User Flow

```
Client visits intake.html (shared via website or direct link)
       ↓
Fills 4 sections (name/event/pre-wed/schedule)
       ↓
Submits → Formspree sends email to admin
Email contains: all form data + a clickable pre-fill link
       ↓
Client sees: thank-you message on page (no redirect)
       ↓
Admin clicks pre-fill link in email
/admin/quote-generator.html?name=...&email=...&days=[...]
       ↓
Quote generator reads URL params on load → populates sections 01 & 02
Admin adds Deliverables + Pricing → generates PDF quote
```

---

## Pages & Files

| File | Role |
|------|------|
| `intake.html` | New public intake form (root level) |
| `admin/quote-generator.js` | Add `loadFromUrlParams()` function |

---

## Form Structure — 4 Sections

### Section 1 — Your Details
| Field | Type | Required |
|-------|------|----------|
| Full name(s) | text | yes |
| Email address | email | yes |
| Phone number | tel | yes |

Maps to quote generator: `clientName`, `clientEmail`, `clientPhone`

---

### Section 2 — Your Event
| Field | Type | Required |
|-------|------|----------|
| Event type | select (Wedding / Engagement / Portrait / Maternity / Family / Other) | yes |
| Event date | date | yes |
| Venue / Location name | text | no |
| City | text | yes |
| Live streaming required? | radio yes/no | yes |
| Which event(s) need live coverage? | text (conditional, shown only if yes) | conditional |

Maps to quote generator: `eventType`, `venueName`, `location` + note in `customNotes` if live is yes

---

### Section 3 — Pre-Wedding Shoot
| Field | Type | Required |
|-------|------|----------|
| Interested in a pre-wedding shoot? | radio yes/no/not sure | yes |
| Preferred vibe or location | text (conditional, shown if yes) | no |
| Preferred date range | text (conditional, shown if yes) | no |

Not mapped to quote generator fields directly — included in Formspree email body as admin context. Admin uses this to decide whether to add `delEngagement` checkbox in Deliverables.

---

### Section 4 — Your Schedule
Dynamic day builder:

- "How many days does your event span?" — pill selector 1–5
- Each day renders:
  - Date picker (for that day)
  - Up to 3 event slots: event name (text) + duration in hours (number input)
  - "+ Add event" link to add a 3rd slot

Minimum: 1 day, 1 event per day.

Maps to quote generator: `addDay()` called per day with `{ date, events: [{ name, dur }] }`

---

## URL Pre-fill Format

On submit, the JS constructs a pre-fill URL:

```
/admin/quote-generator.html
  ?name=Jane+%26+John+Doe
  &email=jane@example.com
  &phone=917-555-0123
  &eventType=Wedding
  &venue=The+Pierre+Hotel
  &city=New+York
  &live=yes
  &liveEvents=Wedding+Ceremony
  &days=[{"date":"2026-10-15","events":[{"name":"Ceremony","dur":"3"},{"name":"Reception","dur":"5"}]}]
```

`days` is JSON-stringified then URI-encoded. Max practical length ~2000 chars for typical wedding data (well within browser URL limits).

---

## Quote Generator Change — `loadFromUrlParams()`

Added to `admin/quote-generator.js`, called at the end of `DOMContentLoaded`.

```
function loadFromUrlParams() {
  const p = new URLSearchParams(location.search);
  if (!p.has('name')) return;          // no params → skip

  // populate Section 01 fields
  set 'clientName', 'clientEmail', 'clientPhone',
      'eventType', 'venueName', 'location'

  // if live=yes, append to customNotes

  // populate Section 02 — call existing addDay() per day entry
  parse p.get('days') → for each day call addDay(dayData)

  // show a subtle banner: "Pre-filled from client intake"
  // auto-save draft immediately
}
```

No changes to existing `addDay()` or form logic — just a new consumer of existing APIs.

---

## Visual Design

- **Aesthetic:** Dark cinematic — matches Aakaara brand exactly
- **Colors:** `--noir` (#09080b) background, `--rose` (#c9956b) accents, `--ivory` (#faf6f1) text
- **Typography:** Cormorant Garamond (headings) + Outfit (body/labels) — already loaded via Google Fonts
- **Layout:** Single-column, full-width sections, generous padding, gold accent top border on each section card
- **Progress indicator:** 4-step indicator at top (Steps 1–4, current highlighted in rose)
- **Mobile-first:** All inputs min 44px touch target, date picker native on touch
- **Conditional fields:** Slide-down reveal (CSS `max-height` transition, ~200ms) — no layout jump
- **Submit button:** Gold/rose style matching quote generator's `btn-gold`
- **Post-submit:** Inline thank-you message replaces the button area; form stays visible (no redirect)

---

## Formspree Email Body

The hidden `_subject` field: `New Inquiry — {clientName}`

Email body (via hidden fields constructed in JS before submit):
```
Client: Jane & John Doe
Email: jane@example.com
Phone: 917-555-0123

Event: Wedding — 2026-10-15
Venue: The Pierre Hotel, New York
Live streaming: Yes (Wedding Ceremony)

Pre-wedding shoot interest: Yes
  Vibe/location: Golden hour in Central Park
  Date range: Sept 2026

Schedule:
  Day 1 (2026-10-15): Ceremony (3h), Reception (5h)

--- OPEN IN QUOTE GENERATOR ---
[pre-fill link]
```

The pre-fill link is appended as plain text so it's always clickable in any email client.

---

## Out of Scope

- Deliverables selection (admin only)
- Pricing (admin only)
- Referral source (admin fills in quote generator)
- Quote reference number (auto-generated by quote generator)
- Authentication / spam protection beyond Formspree's built-in honeypot

---

## Constraints

- Static site — no server-side logic, no database
- Formspree free tier: 50 submissions/month (sufficient for photography inquiry volume)
- URL length: JSON-encoded days param stays well under 2000 chars for up to 5 days × 3 events
- `intake.html` must work served from root (`/intake.html`), not opened as `file://`
