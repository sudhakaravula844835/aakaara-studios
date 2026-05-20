# CRM Dashboard Design Spec
**Date:** 2026-05-20  
**Project:** Aakaara Studios — Admin Dashboard → CRM  
**Files affected:** `admin/dashboard.html`, `admin/dashboard.js`, `admin/dashboard.css`

---

## Goal

Upgrade the existing quote-tracking dashboard into a proper client CRM. The table view is replaced with a rich client card grid that shows every piece of relevant info at a glance, plus a quick-add modal so new clients can be entered without leaving the page.

**Constraint:** All existing localStorage data must be preserved. The data schema is extended (new optional fields added), not replaced. Existing records without new fields display gracefully with empty/default values.

---

## Layout Structure

```
┌─────────────────────────────────────────────┐
│  Header: Brand · "Client CRM" · Nav links   │
├─────────────────────────────────────────────┤
│  Stats Bar (4 cards)                        │
├─────────────────────────────────────────────┤
│  Toolbar: Search | Filter Pills | +Add Btn  │
├─────────────────────────────────────────────┤
│  Client Cards Grid (3-col desktop,          │
│  2-col tablet, 1-col mobile)                │
├─────────────────────────────────────────────┤
│  Availability Calendar (unchanged)          │
└─────────────────────────────────────────────┘
```

---

## Data Schema

Existing fields (preserved as-is):
```js
id, clientName, clientEmail, eventDate, eventDateTo,
status, quotedPrice, confirmedPrice
```

New optional fields (added to each record, default to empty string / null):
```js
phone        // string  — client phone number
shootType    // string  — "Wedding" | "Engagement" | "Maternity" | "Graduation" | "Other"
depositPaid  // boolean — true = paid, false = unpaid, null = not set
followUpDate // string  — ISO date "YYYY-MM-DD" or null
location     // string  — venue / location free text
notes        // string  — free-text notes
```

`saveQuotes()` already persists the full object to localStorage — new fields persist automatically once written.

---

## Components

### 1. Stats Bar
Four stat cards across the top:
- **Total Clients** — `quotes.length`
- **Confirmed** — count where `status === 'confirmed'`
- **Awaiting Reply** — count where `status === 'sent'`
- **Confirmed Revenue** — sum of `confirmedPrice` for confirmed quotes, formatted as `$XX,XXX`. Sub-label shows count of confirmed clients with `depositPaid === false`.

### 2. Toolbar
- **Search input** — filters cards in real time against `clientName`, `clientEmail`, `location`, `notes`. Case-insensitive.
- **Filter pills** — All, Confirmed, Pending, Rejected, + one pill per unique `shootType` present in data. Active pill highlighted in rose/bronze. Combining status filter + search is supported.
- **+ Add Client button** — opens Quick-Add Modal.

### 3. Client Cards Grid
- 3 columns on desktop (≥1024px), 2 on tablet (768px–1023px), 1 on mobile (≤767px)
- Cards sorted by `eventDate` ascending by default
- Color-coded left border: green = confirmed, amber = sent, muted red = rejected; rejected cards at 60% opacity

Each card displays:
| Element | Detail |
|---------|--------|
| Client name | `Cormorant Garamond`, 16px |
| Status badge | top-right, color-coded |
| Event date(s) | start → end if multi-day |
| Phone | tap-to-call link on mobile (`tel:`) |
| Location | free text |
| Shoot type | tag |
| Quoted price | Cormorant Garamond, bronze |
| Confirmed price | shown if set, otherwise `—` |
| Deposit badge | "Deposit ✓" (green) or "Deposit Due" (amber) or hidden if `depositPaid === null` |
| Follow-up date | shown in red + "Overdue" label if date is before today |
| Notes | italic, muted, truncated to 2 lines |
| Actions row | Email (copies address) · Edit (opens Edit Modal pre-filled) · Delete (two-click confirm) |

### 4. Quick-Add / Edit Modal
Single modal component used for both adding and editing. When editing, all fields pre-filled.

Fields in the modal:
1. Client Name (text, required)
2. Email (email input)
3. Phone (tel input)
4. Event Date (date picker)
5. End Date (date picker, optional)
6. Shoot Type (select: Wedding, Engagement, Maternity, Graduation, Birthday, Other)
7. Location / Venue (text)
8. Quoted Price (number)
9. Status (select: Sent, Confirmed, Rejected)
10. Confirmed Price (number, enabled only when status = Confirmed)
11. Deposit Paid (select: Paid, Unpaid — shown only when status = Confirmed)
12. Follow-up Date (date picker)
13. Notes (textarea, 3 rows)

Actions: Cancel · Save Client  
On save: generate new `id` (max existing + 1), push to `quotes`, call `saveQuotes()`, re-render grid, close modal.

### 5. Availability Calendar
No changes. Remains below the cards grid. Still reads from `quotes` array and marks confirmed/pending dates.

### 6. Export Excel Button
Preserved as-is (CSV download). Extended to include new fields: phone, shoot type, location, deposit status, follow-up date, notes.

---

## Interaction Details

- **Search + filter** operate on the in-memory `quotes` array; results update without re-reading localStorage
- **Edit** opens the same modal as Add, pre-populated; saving updates the existing record in place by `id`
- **Delete** retains the two-click confirm pattern (shows "Sure?" → auto-reverts after 5s → second click deletes)
- **Email copy button** uses `navigator.clipboard.writeText(email)` and shows "Copied!" feedback for 2s (existing pattern)
- **Modal close** on Escape key or clicking the backdrop overlay
- **Follow-up overdue** detection: compare `followUpDate` against `new Date()` at render time; no background timer needed

---

## CSS / Styling

- Follows existing CSS variable palette: `--noir`, `--rose`, `--ivory`, `--umber`
- Card grid added to `dashboard.css` (not `styles.css`)
- Modal uses `position: fixed; inset: 0` overlay with `backdrop-filter: blur(8px)` + solid fallback
- Responsive breakpoints: 1024px (3→2 col), 768px (2→1 col)
- No new Google Fonts — already loading Cormorant Garamond + Outfit via existing link tag

---

## Out of Scope

- PDF quote generation (still handled by `quote-generator.html`)
- Email sending (copy-to-clipboard only)
- Cloud sync / multi-device (localStorage only)
- Drag-and-drop between status columns (not needed for card grid layout)
