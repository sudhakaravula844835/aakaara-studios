# Quote Generator Redesign — Design Spec

> **For agentic workers:** Use `superpowers:writing-plans` to turn this spec into an implementation plan, then `superpowers:subagent-driven-development` to execute it.

**Goal:** Full redesign of `admin/quote-generator.*` — fix 6 bugs, add new client fields and deliverables, per-event photo distribution, local jsPDF bundle, clean JS architecture with event delegation and testable pure functions.

**Design decisions:**
- Keep dark gold aesthetic (`--gold: #c9a84c`, `--black: #0a0a0a`) — no redesign of color palette
- Single-column polished sections layout (no split panel)
- All 6 bugs fixed (see Bug Fixes section)
- No CDN dependencies — jsPDF bundled locally

---

## Architecture

### Files

| File | Action | Responsibility |
|------|--------|----------------|
| `admin/quote-generator.html` | Rewrite | Semantic HTML, no inline `onclick`, all IDs per spec |
| `admin/quote-generator.css` | Rewrite | Polished dark gold CSS, inherits `styles.css` vars |
| `admin/quote-generator.js` | Rewrite | Single orchestrator: event delegation, UI wiring, PDF generation, draft/CRM save |
| `admin/quote-utils.js` | Create | Pure functions only — parsing, calculation, ID generation |
| `admin/quote.test.js` | Create | Vitest unit tests for all quote-utils functions |
| `admin/lib/jspdf.umd.min.js` | Copy in | Local jsPDF bundle — downloaded from npm, not CDN |

### Key architecture rules
- `quote-generator.js` uses `<script type="module">` and imports from `./quote-utils.js`
- No inline `onclick=` anywhere — use `id` + `addEventListener` or event delegation on containers
- localStorage key: **`aakaara_quotes`** (matches CRM dashboard — fixes Bug 1)
- Draft key stays: `aakaaraQuoteDraft:v2`
- All user data rendered via `textContent` or DOM methods, never raw `innerHTML`

---

## quote-utils.js — Pure Functions

All functions are exported, pure (no DOM access), and fully unit-tested.

### `parseDurationToHours(text)`
Parses a human-typed duration string into a float.

```js
parseDurationToHours('3 Hours')   // → 3
parseDurationToHours('2.5 hrs')   // → 2.5
parseDurationToHours('4 hour')    // → 4
parseDurationToHours('90 min')    // → 1.5  (minutes → hours)
parseDurationToHours('')           // → 0
parseDurationToHours('TBD')        // → 0
```

Implementation: regex `(\d+(?:\.\d+)?)\s*(hours?|hrs?|h\b|minutes?|mins?|m\b)` — divide minutes by 60.

### `sumEventPhotos(events)`
Sums `photos` fields from an array of event objects, ignoring blanks/non-numeric.

```js
sumEventPhotos([{photos: '100'}, {photos: '200'}, {photos: ''}])  // → 300
sumEventPhotos([])  // → 0
```

### `generateQuoteRef(existingRefs)`
Generates next reference number in format `AAS-YYYY-NNN`.

```js
generateQuoteRef([])                          // → 'AAS-2026-001'
generateQuoteRef(['AAS-2026-001','AAS-2026-002']) // → 'AAS-2026-003'
generateQuoteRef(['AAS-2025-047'])             // → 'AAS-2026-001'  (new year resets)
```

Uses current year. Finds max sequence number for current year, increments by 1, zero-pads to 3 digits.

### `calculatePricingSummary(days, { model, hourlyRate, flatRate, travelType, travelAmount, retainerFee })`
Pure pricing calculation — no DOM access.

```js
// Returns:
{
  model,          // 'hourly' | 'flat'
  hourlyRate,
  flatRate,
  travelType,
  travelAmount,
  retainerFee,
  totalHours,     // sum of day.hours across all days (hourly mode only)
  totalPhotos,    // sum of all event photos across all days
  baseTotal,      // hours × rate OR flatRate
  total,          // baseTotal + travel (if fixed) + retainerFee
  dayBreakdown    // [{ label, hours, amount }]
}
```

### `parseBrief(text)`
Unchanged from current implementation — moved here from `quote-generator.js` for testability. Returns `{ days, clientEmail, clientName, location, eventType }`.

### `migrateEventDay(day)`
Ensures day objects have all required fields with defaults — used when loading drafts saved before the photo-per-event feature.

```js
// Adds missing fields to each event in day.events:
// { name, dur, notes, photos: '' }
```

---

## HTML Structure — Section by Section

### Top Bar (`#topbar`)
```
[Brand: Aakaara Studios]  [Ref: AAS-2026-047]  [Draft saved 3:14 PM]  [New Quote] [Dashboard] [Preview PDF →]
```
- `#draftIndicator` — auto-save status (unchanged)
- `#quoteRefDisplay` — shows current reference number (read-only display, not a form field)
- "Preview PDF" button: `id="topbarPreviewBtn"` — same handler as `#previewBtn` in the sticky bar

### Section 01 — Client Information (`#sectionClient`)

**Quick Import card** (unchanged functionally, just restyled):
- `#quickImportText` textarea
- `#importBtn` button (replaces `onclick="importBrief()"`)
- `#importStatus` div

**Fields — Row 1 (3 columns):**
| ID | Label | Type | Notes |
|----|-------|------|-------|
| `#clientName` | Client Name(s) | text | existing |
| `#clientEmail` | Email | email | existing |
| `#clientPhone` | Phone | tel | **NEW** |

**Fields — Row 2 (3 columns):**
| ID | Label | Type | Notes |
|----|-------|------|-------|
| `#eventType` | Event Type | select | existing options |
| `#venueName` | Venue / Location | text | **NEW** — venue name (e.g. "The Pierre Hotel") |
| `#location` | City | text | existing — now labelled "City" |

**Fields — Row 3 (3 columns):**
| ID | Label | Type | Notes |
|----|-------|------|-------|
| `#quoteDate` | Quote Date | date | existing |
| `#quoteRef` | Reference # | text | **NEW** — auto-filled via `generateQuoteRef()`, editable |
| `#referralSource` | Referred By | select | **NEW** — options: Instagram, Google, Referral, Wedding Wire, The Knot, Other |

### Section 02 — Event Schedule (`#sectionSchedule`)

**Day blocks** rendered into `#daysContainer`. Each day block (`[data-day-id]`):

```
Day N header — date label — [Remove]
  Date input        | Total Hours (auto-summed, green when auto)
  Event items:
    Event N:
      Name | Duration | Photos | Notes   [×]
    [📷 N photos] pill shown when photos > 0
  Day footer: "Day photos: N" | [+ Add Event]
```

**Event item fields** (within each event item `[data-event-item]`):
| data-field | Label | Type | Notes |
|-----------|-------|------|-------|
| `eventName` | Name | text | existing |
| `eventDuration` | Duration | text | existing — now parsed for auto-sum |
| `eventPhotos` | Photos | number | **NEW** — optional photo count for this event |
| `eventNotes` | Notes | text | existing |

**Auto-sum behavior:**
- On every `input` event on any `[data-field="eventDuration"]`: call `parseDurationToHours()` on all events in that day, sum, write to that day's `[data-field="hours"]` input, and add class `hours-auto` (green styling)
- If user manually edits the Total Hours field directly: remove `hours-auto` class — field stays in manual mode for that day; subsequent duration changes do NOT override it
- Manual mode is sticky per-day until the day block is removed and re-added (e.g., removing and re-adding a day resets to auto)

**Photo totals:**
- Per-day photo subtotal shown in day footer: sum of `[data-field="eventPhotos"]` values in that day
- Grand total photos: sum across all days — replaces the old `#editedCount` field (removed)

### Section 03 — Deliverables (`#sectionDeliverables`)

**Existing checkboxes** (all kept, IDs unchanged):
`#delEdited`, `#delRaw`, `#delGallery`, `#delSneakPeek`, `#delTeaser`, `#delDoc`, `#delTraditional`, `#delHighlight`, `#delDrone`, `#delLive`, `#delSecondShooter`

**Add-ons & Upgrades subsection** (new, visually distinct card):

| ID | Label | Type |
|----|-------|------|
| `#delEngagement` | Engagement / Pre-Wedding Session | checkbox |
| `#delEngagementNotes` | Session notes | text input (shown when checked) |
| `#delAddlHours` | Additional Hours | checkbox |
| `#delAddlHoursRate` | Overtime rate ($/hr) | number input (shown when checked) |
| `#delRush` | Rush / Priority Delivery | checkbox |
| `#delRushFee` | Rush fee ($) | number input (shown when checked) |

**Removed:** `#editedCount` (replaced by per-event photo sum)

**Kept:**
- `#timeline` — Delivery Timeline text input
- `#customNotes` — Custom Deliverable Notes textarea

### Section 04 — Pricing (`#sectionPricing`)

**Fields (2 columns):**
| ID | Label | Type | Notes |
|----|-------|------|-------|
| `#pricingModel` | Pricing Model | select | existing |
| `#hourlyRate` | Hourly Rate ($) | number | existing |
| `#flatRate` | Package Price ($) | number | existing |
| `#travelType` | Travel & Accommodation | select | existing |
| `#travelAmount` | Travel Amount ($) | number | existing (shown when fixed) |
| `#retainerFee` | Retainer / Booking Fee ($) | number | **NEW** — optional; shown as separate line in preview and PDF |
| `#showIntro` | Show as Introductory Rate | checkbox | existing |
| `#standardRate` | Standard Rate (strikethrough) | text | existing (shown when showIntro checked) |

**`#pricingPreview`** — live pricing breakdown (rebuilt on every change):
```
Sep 14: 6 hrs × $300      $1,800
Sep 15: 8 hrs × $300      $2,400
Base Total (14 hours)     $4,200
Travel & Accommodation    Separate
Retainer / Booking Fee    $500
────────────────────────────────
Estimated Total           $4,700
```

### Section 05 — Additional Terms (`#sectionTerms`)

| ID | Label | Type | Notes |
|----|-------|------|-------|
| `#deposit` | Deposit Requirement | text | existing |
| `#validity` | Quote Validity | text | existing |
| `#balanceDue` | Balance Due Date | text | **NEW** — e.g. "30 days before event" |
| `#extraNotes` | Extra Notes | textarea | existing |

### Sticky Generate Bar (`#generateBar`)
```
[Estimated Total]  [$4,700]  [14 hrs · 2 days · Travel separate]     [Reset]  [Preview Quote →]
```
- `#totalDisplay` — formatted total (existing)
- `#totalMeta` — **NEW** — shows hours + days + travel note below total
- `#resetBtn` — replaces old `onclick="resetForm()"`
- `#previewBtn` — replaces old `onclick="generatePDF('preview')"`

### Preview Modal (`#previewModal`)
Unchanged structure — `#previewFrame` iframe, close button, "Confirm & Send" button (`#confirmSendBtn`).

---

## quote-generator.js — Controller Sections

Single file, ES module. 13 sections:

1. **IMPORTS** — from `./quote-utils.js`; `jsPDF` from `./lib/jspdf.umd.min.js`
2. **SETTINGS** — `APP_SETTINGS` with `draftStorageKey`, `dashboardStorageKey: 'aakaara_quotes'`
3. **STATE** — `dayCount`, `draftSaveTimer`, `isApplyingDraft`, `previewObjectUrl`, `toastTimer`
4. **STORAGE HELPERS** — `readStorage`, `writeStorage`, `removeStorage` (unchanged)
5. **DAY MANAGEMENT** — `addDay(dayData)`, `addEvent(dayEl, eventData)`, `removeDay(dayEl)`, `removeEvent(eventEl)`, `renumberDays()` — all use event delegation, no `onclick` strings
6. **AUTO-SUM** — `recalcDayHours(dayEl)`, `recalcDayPhotos(dayEl)`, `recalcTotalPhotos()` — triggered on input events
7. **PRICING** — `calculatePricingSummary()` (calls `quote-utils.js`), `recalcTotal()`, `updatePricingUI()`
8. **DRAFT** — `collectDraftState()`, `applyDraftState()`, `saveDraftNow()`, `scheduleDraftSave()`, `clearDraft()` — updated to include new fields and `migrateEventDay()`
9. **IMPORT** — `parseBrief()` wrapper, `importBrief()`, `loadBriefFromQuery()`
10. **MODAL** — `openPreview()`, `closePreview()`, `revokePreviewUrl()`
11. **PDF** — `generatePDF(action)` — all bug fixes applied; new fields on cover; per-event photo table in deliverables
12. **CRM SAVE** — `sendQuoteEmail()` — saves full record including `phone`, `venueName`, `location`, `shootType`, `quoteRef`
13. **INIT** — all event listeners wired via `addEventListener`, `applyDraftState()` or `loadBriefFromQuery()` on load

---

## PDF Changes

### Cover Page additions
- Venue name shown below location (if filled)
- Quote reference number shown in top-right corner of cover
- Phone omitted from cover (too personal for a client-facing doc)

### Deliverables Section — per-event photo table
When `#delEdited` is checked AND more than one event has a photo count > 0:
```
EDITED PHOTOS
  Haldi                100 photos
  Sangeet              100 photos
  Wedding              200 photos
  ──────────────────────────
  Total                400 photos
```

When only one event has photos (or single-event quote):
```
Edited Photos          400 photos · professional color grading
```

### Investment Section — overflow fix (Bug 4)
```js
// Before (broken):
ensureSpace(y, 160)

// After (fixed):
const investmentBoxHeight = computeInvestmentBoxHeight(pricing, showIntro);
ensureSpace(y, investmentBoxHeight + 40)  // +40 for surrounding content
```

`computeInvestmentBoxHeight` is a pure function in `quote-utils.js`:
```js
export function computeInvestmentBoxHeight(pricing, showIntro) {
  const breakdownLines = pricing.model === 'hourly' ? pricing.dayBreakdown.length : 1;
  return Math.max(72, 52 + breakdownLines * 14 + (showIntro ? 12 : 0));
}
```

### New fields in PDF
- Retainer fee shown in Investment section if `retainerFee > 0`
- Balance due date shown in Additional Information section
- Engagement session, Additional Hours rate, Rush fee shown in deliverables when checked
- Quote reference shown in header bar of each page (alongside page number)

---

## Bug Fixes (all 6)

| # | Bug | Fix |
|---|-----|-----|
| 1 | localStorage key mismatch | `dashboardStorageKey: 'aakaara_quotes'` in APP_SETTINGS |
| 2 | jsPDF from CDN | Copy `jspdf.umd.min.js` to `admin/lib/`, import locally |
| 3 | Event durations not summed | `parseDurationToHours()` + `recalcDayHours()` auto-sum on input |
| 4 | PDF investment box overflow | `computeInvestmentBoxHeight()` passed to `ensureSpace()` |
| 5 | CRM save missing fields | `sendQuoteEmail()` includes phone, venueName, location, eventType, quoteRef |
| 6 | Inline onclick handlers | All removed; replaced with event delegation and `addEventListener` |

---

## CRM Record Shape (on Confirm & Send)

```js
{
  id: generateId(quotes),          // integer — from crm-utils.js
  clientName,
  clientEmail,
  phone,                            // NEW
  eventDate: firstEventDate,
  eventDateTo: lastEventDate,
  status: 'sent',
  quotedPrice: pricing.total,
  confirmedPrice: null,
  shootType: eventType,             // NEW — maps eventType to CRM shootType
  location: `${venueName ? venueName + ', ' : ''}${city}`,  // NEW — combined
  quoteRef,                         // NEW
  depositPaid: null,
  followUpDate: null,
  notes: ''
}
```

---

## Testing (`admin/quote.test.js`)

Vitest unit tests for all `quote-utils.js` functions:

**`parseDurationToHours`** (8 tests):
- `'3 Hours'` → 3
- `'2.5 hrs'` → 2.5
- `'4 hour'` → 4
- `'90 min'` → 1.5
- `'90 minutes'` → 1.5
- `''` → 0
- `'TBD'` → 0
- `null` → 0

**`sumEventPhotos`** (4 tests):
- Mixed values → correct sum
- All blank → 0
- Single value → that value
- Non-numeric strings → ignored (treated as 0)

**`generateQuoteRef`** (5 tests):
- Empty array → `AAS-{year}-001`
- Existing refs for current year → increments
- Max is `AAS-{year}-099` → next is `AAS-{year}-100`
- Refs from previous year only → resets to 001 for current year
- Editable ref preserved if passed back in

**`calculatePricingSummary`** (6 tests):
- Hourly: 2 days, correct per-day and total
- Flat: ignores hourly rate
- Travel fixed: adds to total
- Travel separate: doesn't add to total
- Retainer fee: adds to total
- Zero hours: total = 0 (no NaN)

**`computeInvestmentBoxHeight`** (3 tests):
- 1 day hourly → correct height
- 8 days hourly → larger height (no overflow)
- Flat rate → minimum height

---

## DRAFT_VALUE_FIELD_IDS (updated)

Adds new field IDs to draft serialisation (top-level form fields):
`clientPhone`, `venueName`, `quoteRef`, `referralSource`, `retainerFee`, `balanceDue`

Adds new add-on sub-fields (serialised as part of deliverables state):
`delEngagementNotes`, `delAddlHoursRate`, `delRushFee`

`migrateEventDay(day)` added to `quote-utils.js` — ensures `eventPhotos: ''` exists on all events when loading older drafts.
