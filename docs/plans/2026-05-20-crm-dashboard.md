# CRM Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade `admin/dashboard.html` from a quote-tracking table to a full client CRM — card grid, stats bar, live search/filter, quick-add/edit modal — without deleting any existing localStorage data.

**Architecture:** Pure logic functions extracted into `admin/crm-utils.js` (ES module, unit-tested). `admin/dashboard.js` becomes a module that imports from crm-utils and owns all DOM/event logic. HTML is loaded as `type="module"`. All user-provided strings are escaped through a shared `escapeHtml()` helper to prevent XSS.

**Tech Stack:** Vanilla JS (ES modules), CSS custom properties (existing vars), Vitest + jsdom (unit tests)

**Run tests:** `npm run test:unit`

---

## File Map

| Action | File | Responsibility |
|--------|------|----------------|
| Create | `admin/crm-utils.js` | Pure functions: escapeHtml, migrate, stats, filter, id gen, overdue |
| Create | `admin/dashboard.test.js` | Vitest unit tests for crm-utils.js |
| Modify | `admin/dashboard.html` | Stats bar, toolbar, card grid container, modal HTML |
| Modify | `admin/dashboard.css` | Replace table CSS with card grid + modal + stats bar CSS |
| Modify | `admin/dashboard.js` | Import crm-utils, render cards, modal, search, filter |

---

## Task 1: Pure Logic + Unit Tests (TDD)

**Files:** Create `admin/dashboard.test.js`, Create `admin/crm-utils.js`

- [ ] **Step 1.1: Write the failing tests — create `admin/dashboard.test.js`**

```js
import { describe, it, expect } from 'vitest';
import { escapeHtml, migrateQuote, computeStats, filterQuotes, generateId, isOverdue } from './crm-utils.js';

describe('escapeHtml', () => {
  it('escapes < > & " characters', () => {
    expect(escapeHtml('<script>alert("xss")</script>')).toBe('&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;');
  });
  it('returns empty string for null/undefined', () => {
    expect(escapeHtml(null)).toBe('');
    expect(escapeHtml(undefined)).toBe('');
  });
});

describe('migrateQuote', () => {
  it('adds missing new fields with defaults to a legacy quote', () => {
    const legacy = { id: 1, clientName: 'Test', eventDate: '2024-09-14', status: 'sent', quotedPrice: 1000, confirmedPrice: null };
    const result = migrateQuote(legacy);
    expect(result.phone).toBe('');
    expect(result.shootType).toBe('');
    expect(result.depositPaid).toBeNull();
    expect(result.followUpDate).toBeNull();
    expect(result.location).toBe('');
    expect(result.notes).toBe('');
  });

  it('preserves all pre-existing field values', () => {
    const full = {
      id: 2, clientName: 'A', eventDate: '2024-10-01', status: 'confirmed',
      quotedPrice: 2000, confirmedPrice: 2000,
      phone: '+1 555-0100', shootType: 'Wedding', depositPaid: true,
      followUpDate: '2025-06-01', location: 'NYC', notes: 'Great couple',
    };
    expect(migrateQuote(full)).toEqual(full);
  });
});

describe('computeStats', () => {
  const quotes = [
    { status: 'confirmed', confirmedPrice: 2000, depositPaid: false },
    { status: 'confirmed', confirmedPrice: 3000, depositPaid: true },
    { status: 'sent',      confirmedPrice: null,  depositPaid: null },
    { status: 'rejected',  confirmedPrice: null,  depositPaid: null },
  ];
  it('counts total clients', () => expect(computeStats(quotes).total).toBe(4));
  it('counts confirmed clients', () => expect(computeStats(quotes).confirmed).toBe(2));
  it('counts pending (sent) quotes', () => expect(computeStats(quotes).pending).toBe(1));
  it('sums confirmed revenue', () => expect(computeStats(quotes).revenue).toBe(5000));
  it('counts confirmed clients with unpaid deposit', () => expect(computeStats(quotes).unpaidDeposits).toBe(1));
});

describe('filterQuotes', () => {
  const quotes = [
    { clientName: 'Priya', clientEmail: 'p@e.com', status: 'confirmed', shootType: 'Wedding',    location: 'NYC',      notes: '' },
    { clientName: 'Vikram', clientEmail: 'v@e.com', status: 'sent',      shootType: 'Engagement', location: 'Brooklyn', notes: '' },
    { clientName: 'Meera',  clientEmail: 'm@e.com', status: 'rejected',  shootType: 'Wedding',    location: '',         notes: 'special note' },
  ];

  it('returns all when status=all and search empty', () => expect(filterQuotes(quotes, 'all', '')).toHaveLength(3));
  it('filters by status=confirmed', () => expect(filterQuotes(quotes, 'confirmed', '')).toHaveLength(1));
  it('filters by status=sent', () => expect(filterQuotes(quotes, 'sent', '')).toHaveLength(1));
  it('filters by shootType', () => {
    expect(filterQuotes(quotes, 'Wedding', '')).toHaveLength(2);
    expect(filterQuotes(quotes, 'Engagement', '')).toHaveLength(1);
  });
  it('filters by search against clientName (case-insensitive)', () => expect(filterQuotes(quotes, 'all', 'priya')).toHaveLength(1));
  it('filters by search against notes', () => expect(filterQuotes(quotes, 'all', 'special')).toHaveLength(1));
  it('filters by search against location', () => expect(filterQuotes(quotes, 'all', 'brooklyn')).toHaveLength(1));
  it('combines status and search', () => {
    expect(filterQuotes(quotes, 'confirmed', 'priya')).toHaveLength(1);
    expect(filterQuotes(quotes, 'sent', 'priya')).toHaveLength(0);
  });
});

describe('generateId', () => {
  it('returns 1 for empty array', () => expect(generateId([])).toBe(1));
  it('returns max id + 1', () => expect(generateId([{ id: 3 }, { id: 1 }, { id: 5 }])).toBe(6));
});

describe('isOverdue', () => {
  it('returns false for null', () => expect(isOverdue(null)).toBe(false));
  it('returns true for a past date', () => expect(isOverdue('2020-01-01')).toBe(true));
  it('returns false for a future date', () => expect(isOverdue('2099-12-31')).toBe(false));
});
```

- [ ] **Step 1.2: Run tests — verify they fail**

```bash
cd "/Users/sudhakaravula/Desktop/logo/files new version  draft 1/aakaara-site-v2"
npm run test:unit
```

Expected: All dashboard.test.js tests fail with "Cannot find module './crm-utils.js'"

- [ ] **Step 1.3: Create `admin/crm-utils.js`**

```js
export function escapeHtml(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function migrateQuote(q) {
  return {
    phone: '',
    shootType: '',
    depositPaid: null,
    followUpDate: null,
    location: '',
    notes: '',
    ...q,
  };
}

export function computeStats(quotes) {
  const confirmed = quotes.filter(q => q.status === 'confirmed');
  return {
    total: quotes.length,
    confirmed: confirmed.length,
    pending: quotes.filter(q => q.status === 'sent').length,
    revenue: confirmed.reduce((sum, q) => sum + (q.confirmedPrice || 0), 0),
    unpaidDeposits: confirmed.filter(q => q.depositPaid === false).length,
  };
}

const STATUS_KEYWORDS = new Set(['all', 'confirmed', 'sent', 'rejected']);

export function filterQuotes(quotes, statusOrType, search) {
  const term = search.trim().toLowerCase();
  let filtered = quotes;

  if (statusOrType !== 'all') {
    if (STATUS_KEYWORDS.has(statusOrType)) {
      filtered = filtered.filter(q => q.status === statusOrType);
    } else {
      filtered = filtered.filter(q => q.shootType === statusOrType);
    }
  }

  if (term) {
    filtered = filtered.filter(q =>
      [q.clientName, q.clientEmail, q.location, q.notes]
        .some(f => (f || '').toLowerCase().includes(term))
    );
  }

  return filtered;
}

export function generateId(quotes) {
  if (!quotes.length) return 1;
  return Math.max(...quotes.map(q => q.id)) + 1;
}

export function isOverdue(dateStr) {
  if (!dateStr) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return new Date(dateStr + 'T00:00:00') < today;
}
```

- [ ] **Step 1.4: Run tests — verify all 17 pass**

```bash
npm run test:unit
```

Expected: 17 passing tests in dashboard.test.js. No failures.

- [ ] **Step 1.5: Commit**

```bash
git add admin/crm-utils.js admin/dashboard.test.js
git commit -m "feat: add crm-utils pure functions with full unit tests"
```

---

## Task 2: Update HTML Structure

**Files:** Modify `admin/dashboard.html`

- [ ] **Step 2.1: Replace full contents of `admin/dashboard.html`**

Write this as the complete file (no partial edits):

```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Client CRM — Aakaara Studios</title>
    <link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@300;400&family=Outfit:wght@200;300;400;500&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="../styles.css">
    <link rel="stylesheet" href="dashboard.css">
</head>
<body>

    <header class="dashboard-header">
        <div>
            <div class="brand">Aakaara Studios</div>
            <h1>Client CRM</h1>
        </div>
        <div class="header-nav-links">
            <a href="quote-generator.html">&#8249; Quote Generator</a>
            <a href="../index.html">Main Site &#8250;</a>
        </div>
    </header>

    <main class="crm-container">

        <!-- Stats Bar -->
        <div class="stats-bar">
            <div class="stat-card" id="statTotal">
                <div class="stat-label">Total Clients</div>
                <div class="stat-value">&#8212;</div>
                <div class="stat-sub">All time</div>
            </div>
            <div class="stat-card stat-green" id="statConfirmed">
                <div class="stat-label">Confirmed</div>
                <div class="stat-value">&#8212;</div>
                <div class="stat-sub">Booked</div>
            </div>
            <div class="stat-card stat-amber" id="statPending">
                <div class="stat-label">Awaiting Reply</div>
                <div class="stat-value">&#8212;</div>
                <div class="stat-sub">Quotes sent</div>
            </div>
            <div class="stat-card stat-rose" id="statRevenue">
                <div class="stat-label">Confirmed Revenue</div>
                <div class="stat-value">&#8212;</div>
                <div class="stat-sub" id="statRevenueSub"></div>
            </div>
        </div>

        <!-- Toolbar -->
        <div class="crm-toolbar">
            <div class="crm-search-wrap">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
                <input type="text" id="crmSearch" placeholder="Search clients, dates, notes&#8230;" autocomplete="off" aria-label="Search clients">
            </div>
            <div class="crm-filter-pills" id="filterPills" role="group" aria-label="Filter clients"></div>
            <button class="crm-add-btn" id="addClientBtn" aria-label="Add new client">
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                Add Client
            </button>
            <button class="crm-export-btn" onclick="exportToExcel()" aria-label="Export clients to CSV">
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                Export CSV
            </button>
        </div>

        <!-- Cards Grid -->
        <div class="crm-cards" id="crmCards" role="list"></div>

        <!-- Availability Calendar -->
        <div class="section crm-calendar-section">
            <div class="section-header">Availability Calendar</div>
            <div class="section-body">
                <div class="calendar-header">
                    <button id="prevMonth" aria-label="Previous month">&#8249;</button>
                    <div id="calendarMonthYear"></div>
                    <button id="nextMonth" aria-label="Next month">&#8250;</button>
                </div>
                <div class="calendar-grid" id="calendarWeekdays" role="row"></div>
                <div class="calendar-grid" id="calendarDays" role="grid"></div>
            </div>
        </div>

    </main>

    <!-- Quick-Add / Edit Modal -->
    <div class="modal-backdrop" id="modalBackdrop" role="presentation">
        <div class="modal-box" role="dialog" aria-modal="true" aria-labelledby="modalTitle">
            <div class="modal-header">
                <div class="modal-title" id="modalTitle">New Client</div>
                <button class="modal-close" id="modalClose" aria-label="Close modal">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                </button>
            </div>
            <form class="modal-form" id="clientForm" novalidate>
                <input type="hidden" id="fId">
                <div class="modal-grid">
                    <div class="form-group form-full">
                        <label class="form-label" for="fName">Client Name *</label>
                        <input class="form-input" type="text" id="fName" placeholder="Priya &amp; Rohan" required>
                    </div>
                    <div class="form-group">
                        <label class="form-label" for="fEmail">Email</label>
                        <input class="form-input" type="email" id="fEmail" placeholder="client@example.com">
                    </div>
                    <div class="form-group">
                        <label class="form-label" for="fPhone">Phone</label>
                        <input class="form-input" type="tel" id="fPhone" placeholder="+1 917-555-0100">
                    </div>
                    <div class="form-group">
                        <label class="form-label" for="fEventDate">Event Date *</label>
                        <input class="form-input" type="date" id="fEventDate" required>
                    </div>
                    <div class="form-group">
                        <label class="form-label" for="fEventDateTo">End Date (multi-day)</label>
                        <input class="form-input" type="date" id="fEventDateTo">
                    </div>
                    <div class="form-group">
                        <label class="form-label" for="fShootType">Shoot Type</label>
                        <select class="form-input" id="fShootType">
                            <option value="">&#8212; Select &#8212;</option>
                            <option value="Wedding">Wedding</option>
                            <option value="Engagement">Engagement</option>
                            <option value="Maternity">Maternity</option>
                            <option value="Graduation">Graduation</option>
                            <option value="Birthday">Birthday</option>
                            <option value="Other">Other</option>
                        </select>
                    </div>
                    <div class="form-group form-full">
                        <label class="form-label" for="fLocation">Location / Venue</label>
                        <input class="form-input" type="text" id="fLocation" placeholder="The Pierre Hotel, NYC">
                    </div>
                    <div class="form-group">
                        <label class="form-label" for="fQuotedPrice">Quoted Price ($)</label>
                        <input class="form-input" type="number" id="fQuotedPrice" placeholder="4500" min="0">
                    </div>
                    <div class="form-group">
                        <label class="form-label" for="fStatus">Status</label>
                        <select class="form-input" id="fStatus">
                            <option value="sent">Sent</option>
                            <option value="confirmed">Confirmed</option>
                            <option value="rejected">Rejected</option>
                        </select>
                    </div>
                    <div class="form-group" id="confirmedPriceGroup">
                        <label class="form-label" for="fConfirmedPrice">Confirmed Price ($)</label>
                        <input class="form-input" type="number" id="fConfirmedPrice" placeholder="4500" min="0">
                    </div>
                    <div class="form-group" id="depositGroup">
                        <label class="form-label" for="fDepositPaid">Deposit</label>
                        <select class="form-input" id="fDepositPaid">
                            <option value="">&#8212; Not set &#8212;</option>
                            <option value="true">Paid</option>
                            <option value="false">Unpaid</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label class="form-label" for="fFollowUpDate">Follow-up Date</label>
                        <input class="form-input" type="date" id="fFollowUpDate">
                    </div>
                    <div class="form-group form-full">
                        <label class="form-label" for="fNotes">Notes</label>
                        <textarea class="form-input form-textarea" id="fNotes" placeholder="Shot list, special requests, next steps&#8230;"></textarea>
                    </div>
                </div>
                <div class="modal-actions">
                    <button type="button" class="btn-modal-cancel" id="modalCancel">Cancel</button>
                    <button type="submit" class="btn-modal-save">Save Client &#8250;</button>
                </div>
            </form>
        </div>
    </div>

<script type="module" src="dashboard.js"></script>

</body>
</html>
```

- [ ] **Step 2.2: Commit**

```bash
git add admin/dashboard.html
git commit -m "feat: update CRM dashboard HTML with card grid, stats bar, modal structure"
```

---

## Task 3: Replace dashboard.css

**Files:** Modify `admin/dashboard.css`

- [ ] **Step 3.1: Replace full contents of `admin/dashboard.css`**

```css
/* Inherits CSS variables from styles.css */

html, body { background: #000 !important; }
body {
    font-family: var(--font-body);
    font-weight: 300;
    margin: 0;
    -webkit-font-smoothing: antialiased;
    color: var(--ivory);
}

/* Header */
.dashboard-header {
    padding: 1.5rem 2rem;
    border-bottom: 1px solid rgba(201,149,107,0.1);
    display: flex;
    justify-content: space-between;
    align-items: center;
}
.dashboard-header h1 {
    font-family: var(--font-display);
    font-weight: 300;
    font-size: 1.4rem;
    letter-spacing: 0.1em;
    margin: 0;
}
.dashboard-header .brand {
    font-size: 0.6rem;
    letter-spacing: 0.3em;
    text-transform: uppercase;
    color: var(--rose);
}
.header-nav-links { display: flex; gap: 1.5rem; }
.header-nav-links a {
    color: rgba(250,246,241,0.4);
    font-size: 0.8rem;
    text-decoration: none;
    transition: color 0.3s;
}
.header-nav-links a:hover { color: var(--rose); }

/* Main layout */
.crm-container {
    padding: 2rem;
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
}

/* Stats Bar */
.stats-bar {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 1rem;
}
.stat-card {
    background: #111;
    border: 1px solid rgba(201,149,107,0.1);
    border-radius: 8px;
    padding: 1rem 1.25rem;
}
.stat-label {
    font-size: 0.6rem;
    text-transform: uppercase;
    letter-spacing: 0.12em;
    color: rgba(250,246,241,0.35);
    margin-bottom: 0.35rem;
}
.stat-value {
    font-family: var(--font-display);
    font-size: 1.8rem;
    font-weight: 300;
    color: var(--ivory);
    line-height: 1.1;
}
.stat-sub { font-size: 0.65rem; color: rgba(250,246,241,0.3); margin-top: 0.2rem; }
.stat-card.stat-green .stat-value { color: #a8b8a0; }
.stat-card.stat-amber .stat-value { color: #e0a458; }
.stat-card.stat-rose  .stat-value { color: var(--rose); }

/* Toolbar */
.crm-toolbar {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    flex-wrap: wrap;
}
.crm-search-wrap {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    background: #111;
    border: 1px solid rgba(201,149,107,0.1);
    border-radius: 6px;
    padding: 0.5rem 0.85rem;
    flex: 1;
    min-width: 180px;
}
.crm-search-wrap svg { opacity: 0.35; flex-shrink: 0; }
.crm-search-wrap input {
    background: none;
    border: none;
    outline: none;
    color: var(--ivory);
    font-family: var(--font-body);
    font-size: 0.8rem;
    width: 100%;
}
.crm-search-wrap input::placeholder { color: rgba(250,246,241,0.25); }

.crm-filter-pills { display: flex; gap: 0.4rem; flex-wrap: wrap; }
.filter-pill {
    padding: 0.35rem 0.85rem;
    border-radius: 20px;
    font-size: 0.65rem;
    letter-spacing: 0.07em;
    border: 1px solid rgba(201,149,107,0.15);
    color: rgba(250,246,241,0.4);
    background: none;
    cursor: pointer;
    transition: all 0.15s;
    font-family: var(--font-body);
}
.filter-pill:hover { border-color: rgba(201,149,107,0.35); color: var(--ivory); }
.filter-pill.active {
    background: rgba(201,149,107,0.12);
    border-color: rgba(201,149,107,0.4);
    color: var(--rose);
}

.crm-add-btn, .crm-export-btn {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    padding: 0.5rem 1rem;
    border-radius: 6px;
    font-family: var(--font-body);
    font-size: 0.7rem;
    letter-spacing: 0.08em;
    cursor: pointer;
    transition: background 0.2s;
    white-space: nowrap;
}
.crm-add-btn {
    background: rgba(201,149,107,0.1);
    border: 1px solid rgba(201,149,107,0.3);
    color: var(--rose);
}
.crm-add-btn:hover { background: rgba(201,149,107,0.2); }
.crm-export-btn {
    background: rgba(138,154,126,0.1);
    border: 1px solid rgba(138,154,126,0.25);
    color: #a8b8a0;
}
.crm-export-btn:hover { background: rgba(138,154,126,0.2); }

/* Cards Grid */
.crm-cards {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 1rem;
}
.crm-empty {
    grid-column: 1 / -1;
    text-align: center;
    padding: 3rem;
    color: rgba(250,246,241,0.2);
    font-size: 0.85rem;
    letter-spacing: 0.05em;
}

/* Client Card */
.client-card {
    background: #111;
    border: 1px solid rgba(201,149,107,0.1);
    border-left: 3px solid transparent;
    border-radius: 8px;
    padding: 1.1rem;
    display: flex;
    flex-direction: column;
    transition: border-color 0.2s;
}
.client-card:hover { border-color: rgba(201,149,107,0.2); border-left-color: inherit; }
.client-card.status-confirmed { border-left-color: #a8b8a0; }
.client-card.status-sent      { border-left-color: #e0a458; }
.client-card.status-rejected  { border-left-color: #c28ca0; opacity: 0.55; }

.card-top {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    margin-bottom: 0.7rem;
}
.card-name {
    font-family: var(--font-display);
    font-size: 1.1rem;
    font-weight: 300;
    color: var(--ivory);
    line-height: 1.2;
}
.card-status-badge {
    font-size: 0.6rem;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    padding: 0.2rem 0.5rem;
    border-radius: 4px;
    flex-shrink: 0;
    margin-left: 0.5rem;
    margin-top: 0.15rem;
}
.badge-confirmed { background: rgba(168,184,160,0.15); color: #a8b8a0; }
.badge-sent      { background: rgba(224,164,88,0.15);  color: #e0a458; }
.badge-rejected  { background: rgba(194,140,160,0.15); color: #c28ca0; }

.card-field {
    display: flex;
    align-items: flex-start;
    gap: 0.45rem;
    margin-bottom: 0.35rem;
    color: rgba(250,246,241,0.55);
    font-size: 0.75rem;
    line-height: 1.4;
}
.card-field svg { flex-shrink: 0; margin-top: 1px; opacity: 0.6; }
.card-field a { color: inherit; text-decoration: none; }
.card-field a:hover { color: var(--rose); }

.card-divider {
    border: none;
    border-top: 1px solid rgba(201,149,107,0.08);
    margin: 0.7rem 0;
}

.card-price-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 0.4rem;
}
.card-prices { display: flex; gap: 1rem; }
.price-lbl {
    font-size: 0.55rem;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    color: rgba(250,246,241,0.3);
    margin-bottom: 0.1rem;
}
.price-val {
    font-family: var(--font-display);
    font-size: 1rem;
    color: var(--rose);
}

.deposit-badge {
    font-size: 0.6rem;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    padding: 0.2rem 0.5rem;
    border-radius: 4px;
}
.deposit-paid   { background: rgba(168,184,160,0.12); color: #a8b8a0; }
.deposit-unpaid { background: rgba(224,164,88,0.12);  color: #e0a458; }

.card-followup {
    display: flex;
    align-items: center;
    gap: 0.35rem;
    font-size: 0.7rem;
    color: rgba(250,246,241,0.35);
    margin-bottom: 0.4rem;
}
.card-followup svg { opacity: 0.6; }
.card-followup.overdue { color: #e07070; }

.card-notes {
    background: rgba(0,0,0,0.25);
    border-radius: 4px;
    padding: 0.45rem 0.6rem;
    font-size: 0.72rem;
    color: rgba(250,246,241,0.35);
    font-style: italic;
    line-height: 1.45;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
    margin-top: 0.4rem;
}

.card-actions {
    display: flex;
    gap: 0.4rem;
    margin-top: 0.75rem;
}
.card-btn {
    flex: 1;
    padding: 0.35rem 0.5rem;
    border: 1px solid rgba(201,149,107,0.1);
    border-radius: 4px;
    background: transparent;
    color: rgba(250,246,241,0.35);
    font-family: var(--font-body);
    font-size: 0.65rem;
    letter-spacing: 0.04em;
    cursor: pointer;
    transition: all 0.15s;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 0.3rem;
}
.card-btn:hover { background: rgba(201,149,107,0.06); color: var(--ivory); border-color: rgba(201,149,107,0.25); }
.card-btn.btn-delete:hover { border-color: #c28ca0; color: #c28ca0; }
.card-btn.btn-delete.confirm-state {
    border-color: #c28ca0;
    color: #c28ca0;
    background: rgba(194,140,160,0.12);
}

/* Section wrapper (calendar) */
.section {
    background: #111;
    border: 1px solid rgba(201,149,107,0.1);
    border-radius: 8px;
}
.section-header {
    padding: 1rem 1.5rem;
    border-bottom: 1px solid rgba(201,149,107,0.1);
    font-size: 0.7rem;
    letter-spacing: 0.2em;
    text-transform: uppercase;
    color: var(--rose);
}
.section-body { padding: 1.5rem; }

/* Calendar */
.calendar-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 1rem;
}
.calendar-header button {
    background: none;
    border: 1px solid rgba(201,149,107,0.2);
    color: var(--rose);
    border-radius: 50%;
    width: 28px;
    height: 28px;
    cursor: pointer;
    transition: all 0.2s;
}
.calendar-header button:hover { background: rgba(201,149,107,0.1); }
#calendarMonthYear { font-size: 1rem; }
.calendar-grid { display: grid; grid-template-columns: repeat(7, 1fr); gap: 5px; }
.calendar-day, .calendar-weekday {
    height: 40px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 0.8rem;
}
.calendar-weekday { font-size: 0.6rem; text-transform: uppercase; color: rgba(250,246,241,0.3); }
.calendar-day.occupied {
    background: rgba(138,154,126,0.2);
    color: #a8b8a0;
    border-radius: 4px;
    position: relative;
    cursor: help;
}
.calendar-day.pending {
    background: rgba(224,164,88,0.1);
    border: 1px solid rgba(224,164,88,0.2);
    color: #e0a458;
    border-radius: 4px;
    position: relative;
    cursor: help;
}
.calendar-day .tooltip {
    display: none;
    position: absolute;
    bottom: 110%;
    left: 50%;
    transform: translateX(-50%);
    background: var(--umber);
    padding: 0.5rem 0.8rem;
    border-radius: 4px;
    font-size: 0.75rem;
    white-space: nowrap;
    z-index: 10;
    border: 1px solid rgba(201,149,107,0.2);
}
.calendar-day.occupied:hover .tooltip,
.calendar-day.pending:hover .tooltip { display: block; }

/* Modal */
.modal-backdrop {
    display: none;
    position: fixed;
    inset: 0;
    background: rgba(9,8,11,0.82);
    backdrop-filter: blur(6px);
    -webkit-backdrop-filter: blur(6px);
    z-index: 1000;
    align-items: center;
    justify-content: center;
    padding: 1.5rem;
}
.modal-backdrop.open { display: flex; }
.modal-box {
    background: #13121a;
    border: 1px solid rgba(201,149,107,0.2);
    border-radius: 10px;
    width: 100%;
    max-width: 600px;
    max-height: 90vh;
    overflow-y: auto;
    padding: 1.75rem;
}
.modal-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 1.25rem;
}
.modal-title {
    font-family: var(--font-display);
    font-size: 1.5rem;
    font-weight: 300;
    color: var(--ivory);
}
.modal-close {
    background: none;
    border: 1px solid rgba(201,149,107,0.15);
    color: rgba(250,246,241,0.4);
    border-radius: 4px;
    width: 30px;
    height: 30px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.15s;
}
.modal-close:hover { border-color: var(--rose); color: var(--rose); }

.modal-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0.9rem;
}
.form-group { display: flex; flex-direction: column; gap: 0.35rem; }
.form-group.form-full { grid-column: 1 / -1; }
.form-label {
    font-size: 0.6rem;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    color: rgba(250,246,241,0.35);
}
.form-input {
    background: rgba(0,0,0,0.3);
    border: 1px solid rgba(201,149,107,0.15);
    border-radius: 5px;
    padding: 0.55rem 0.75rem;
    color: var(--ivory);
    font-family: var(--font-body);
    font-size: 0.82rem;
    outline: none;
    transition: border-color 0.15s;
    width: 100%;
    box-sizing: border-box;
}
.form-input:focus { border-color: rgba(201,149,107,0.45); }
.form-input option { background: var(--umber); }
.form-textarea { min-height: 72px; resize: vertical; }

.modal-actions {
    display: flex;
    gap: 0.75rem;
    justify-content: flex-end;
    margin-top: 1.25rem;
}
.btn-modal-cancel {
    padding: 0.55rem 1.25rem;
    border: 1px solid rgba(201,149,107,0.15);
    border-radius: 5px;
    background: transparent;
    color: rgba(250,246,241,0.4);
    font-family: var(--font-body);
    font-size: 0.75rem;
    letter-spacing: 0.06em;
    cursor: pointer;
    transition: all 0.15s;
}
.btn-modal-cancel:hover { border-color: rgba(201,149,107,0.3); color: var(--ivory); }
.btn-modal-save {
    padding: 0.55rem 1.5rem;
    border: 1px solid rgba(201,149,107,0.4);
    border-radius: 5px;
    background: rgba(201,149,107,0.12);
    color: var(--rose);
    font-family: var(--font-body);
    font-size: 0.75rem;
    letter-spacing: 0.06em;
    cursor: pointer;
    transition: background 0.15s;
}
.btn-modal-save:hover { background: rgba(201,149,107,0.22); }

/* Responsive */
@media (max-width: 1024px) {
    .crm-cards { grid-template-columns: repeat(2, 1fr); }
    .stats-bar  { grid-template-columns: repeat(2, 1fr); }
}
@media (max-width: 768px) {
    .crm-container { padding: 1rem; }
    .crm-cards  { grid-template-columns: 1fr; }
    .stats-bar  { grid-template-columns: repeat(2, 1fr); }
    .crm-toolbar { flex-direction: column; align-items: stretch; }
    .crm-search-wrap { min-width: unset; }
    .modal-grid { grid-template-columns: 1fr; }
    .form-group.form-full { grid-column: 1; }
}
```

- [ ] **Step 3.2: Commit**

```bash
git add admin/dashboard.css
git commit -m "feat: replace table CSS with CRM card grid, modal, and stats bar styles"
```

---

## Task 4: Rewrite dashboard.js

**Files:** Modify `admin/dashboard.js`

- [ ] **Step 4.1: Replace full contents of `admin/dashboard.js`**

All user-provided strings are passed through `escapeHtml()` before insertion into the DOM via template literals. This prevents XSS from data entered into the modal form.

```js
import { escapeHtml, migrateQuote, computeStats, filterQuotes, generateId, isOverdue } from './crm-utils.js';

document.addEventListener('DOMContentLoaded', function () {

    // 1. DATA
    let quotes = [];
    const stored = localStorage.getItem('aakaaraQuotes');

    if (stored) {
        quotes = JSON.parse(stored).map(migrateQuote);
    } else {
        quotes = [
            { id: 1, clientName: 'Priya & Rohan', clientEmail: 'priya.r@example.com', eventDate: '2024-09-14', eventDateTo: '2024-09-15', status: 'sent', quotedPrice: 4500, confirmedPrice: null, phone: '', shootType: 'Wedding', depositPaid: null, followUpDate: null, location: '', notes: '' },
            { id: 2, clientName: 'Ananya Sharma', clientEmail: 'ananya.s@example.com', eventDate: '2024-10-05', eventDateTo: '2024-10-05', status: 'confirmed', quotedPrice: 2200, confirmedPrice: 2200, phone: '', shootType: 'Wedding', depositPaid: true, followUpDate: null, location: '', notes: '' },
            { id: 3, clientName: 'Vikram Singh', clientEmail: 'vikram.singh@example.com', eventDate: '2024-09-21', eventDateTo: '2024-09-21', status: 'sent', quotedPrice: 3000, confirmedPrice: null, phone: '', shootType: 'Engagement', depositPaid: null, followUpDate: null, location: '', notes: '' },
            { id: 4, clientName: 'Meera Desai', clientEmail: 'meera.d@example.com', eventDate: '2024-11-02', eventDateTo: '2024-11-02', status: 'rejected', quotedPrice: 1800, confirmedPrice: null, phone: '', shootType: '', depositPaid: null, followUpDate: null, location: '', notes: '' },
            { id: 5, clientName: 'Arjun & Diya', clientEmail: 'arjun.d@example.com', eventDate: '2024-10-06', eventDateTo: '2024-10-06', status: 'confirmed', quotedPrice: 7500, confirmedPrice: 7000, phone: '', shootType: 'Wedding', depositPaid: false, followUpDate: null, location: '', notes: '' },
        ];
        localStorage.setItem('aakaaraQuotes', JSON.stringify(quotes));
    }

    function saveQuotes() {
        localStorage.setItem('aakaaraQuotes', JSON.stringify(quotes));
    }

    // 2. STATE
    let activeFilter = 'all';
    let searchTerm = '';
    let currentCalendarDate = new Date();

    // 3. STATS
    function renderStats() {
        const s = computeStats(quotes);
        document.querySelector('#statTotal .stat-value').textContent = s.total;
        document.querySelector('#statConfirmed .stat-value').textContent = s.confirmed;
        document.querySelector('#statPending .stat-value').textContent = s.pending;
        document.querySelector('#statRevenue .stat-value').textContent = '$' + s.revenue.toLocaleString();
        document.getElementById('statRevenueSub').textContent =
            s.unpaidDeposits > 0
                ? `${s.unpaidDeposits} deposit${s.unpaidDeposits > 1 ? 's' : ''} unpaid`
                : 'All deposits paid';
    }

    // 4. FILTER PILLS
    function renderFilterPills() {
        const pills = document.getElementById('filterPills');
        const shootTypes = [...new Set(quotes.map(q => q.shootType).filter(Boolean))].sort();
        const defs = [
            { key: 'all', label: 'All' },
            { key: 'confirmed', label: 'Confirmed' },
            { key: 'sent', label: 'Pending' },
            { key: 'rejected', label: 'Rejected' },
            ...shootTypes.map(t => ({ key: t, label: t })),
        ];
        pills.innerHTML = defs.map(({ key, label }) =>
            `<button class="filter-pill${activeFilter === key ? ' active' : ''}" data-filter="${escapeHtml(key)}">${escapeHtml(label)}</button>`
        ).join('');

        pills.querySelectorAll('.filter-pill').forEach(btn => {
            btn.addEventListener('click', () => {
                activeFilter = btn.dataset.filter;
                renderFilterPills();
                renderCards();
            });
        });
    }

    // 5. CARD GRID
    function formatDate(dateStr) {
        if (!dateStr) return '';
        return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    }

    function renderCards() {
        const container = document.getElementById('crmCards');
        const sorted = [...quotes].sort((a, b) => new Date(a.eventDate) - new Date(b.eventDate));
        const filtered = filterQuotes(sorted, activeFilter, searchTerm);

        if (!filtered.length) {
            container.innerHTML = '';
            const empty = document.createElement('div');
            empty.className = 'crm-empty';
            empty.textContent = 'No clients match your search.';
            container.appendChild(empty);
            renderCalendar();
            return;
        }

        container.innerHTML = '';
        filtered.forEach(q => {
            const dateDisplay = q.eventDateTo && q.eventDateTo !== q.eventDate
                ? `${formatDate(q.eventDate)} – ${formatDate(q.eventDateTo)}`
                : formatDate(q.eventDate);

            const badgeClass = { confirmed: 'badge-confirmed', sent: 'badge-sent', rejected: 'badge-rejected' }[q.status] || '';
            const badgeLabel = { confirmed: 'Confirmed', sent: 'Quote Sent', rejected: 'Rejected' }[q.status] || q.status;

            const card = document.createElement('div');
            card.className = `client-card status-${q.status}`;
            card.setAttribute('role', 'listitem');
            card.dataset.id = q.id;

            // Build card using safe DOM methods to avoid XSS
            const top = document.createElement('div');
            top.className = 'card-top';

            const nameEl = document.createElement('div');
            nameEl.className = 'card-name';
            nameEl.textContent = q.clientName;

            const badge = document.createElement('div');
            badge.className = `card-status-badge ${badgeClass}`;
            badge.textContent = badgeLabel;

            top.appendChild(nameEl);
            top.appendChild(badge);
            card.appendChild(top);

            // Field helper
            function addField(svgPath, content, isLink, href) {
                if (!content) return;
                const row = document.createElement('div');
                row.className = 'card-field';
                row.innerHTML = `<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">${svgPath}</svg>`;
                if (isLink) {
                    const a = document.createElement('a');
                    a.href = href;
                    a.textContent = content;
                    row.appendChild(a);
                } else {
                    const span = document.createElement('span');
                    span.textContent = content;
                    row.appendChild(span);
                }
                card.appendChild(row);
            }

            addField('<rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>', dateDisplay);
            addField('<path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.15 12a19.79 19.79 0 0 1-3.07-8.63A2 2 0 0 1 3.05 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 21 16.92z"/>', q.phone, true, `tel:${q.phone}`);
            addField('<path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>', q.location);
            addField('<path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/>', q.shootType);

            // Divider
            const divider = document.createElement('hr');
            divider.className = 'card-divider';
            card.appendChild(divider);

            // Price row
            const priceRow = document.createElement('div');
            priceRow.className = 'card-price-row';

            const prices = document.createElement('div');
            prices.className = 'card-prices';
            prices.innerHTML =
                `<div><div class="price-lbl">Quoted</div><div class="price-val">$${(q.quotedPrice || 0).toLocaleString()}</div></div>` +
                `<div><div class="price-lbl">Confirmed</div><div class="price-val">${q.confirmedPrice ? '$' + q.confirmedPrice.toLocaleString() : '—'}</div></div>`;
            priceRow.appendChild(prices);

            if (q.depositPaid === true || q.depositPaid === false) {
                const dep = document.createElement('span');
                dep.className = `deposit-badge ${q.depositPaid ? 'deposit-paid' : 'deposit-unpaid'}`;
                dep.textContent = q.depositPaid ? 'Deposit ✓' : 'Deposit Due';
                priceRow.appendChild(dep);
            }
            card.appendChild(priceRow);

            // Follow-up
            if (q.followUpDate) {
                const fu = document.createElement('div');
                fu.className = `card-followup${isOverdue(q.followUpDate) ? ' overdue' : ''}`;
                fu.innerHTML = `<svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>`;
                const fuText = document.createTextNode(
                    `${isOverdue(q.followUpDate) ? 'Overdue: ' : 'Follow up: '}${formatDate(q.followUpDate)}`
                );
                fu.appendChild(fuText);
                card.appendChild(fu);
            }

            // Notes
            if (q.notes) {
                const notes = document.createElement('div');
                notes.className = 'card-notes';
                notes.textContent = q.notes;
                card.appendChild(notes);
            }

            // Action buttons
            const actions = document.createElement('div');
            actions.className = 'card-actions';

            const emailBtn = document.createElement('button');
            emailBtn.className = 'card-btn btn-email';
            emailBtn.innerHTML = `<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>`;
            emailBtn.appendChild(document.createTextNode(' Copy Email'));
            emailBtn.addEventListener('click', () => {
                if (!q.clientEmail) return;
                navigator.clipboard.writeText(q.clientEmail).then(() => {
                    const orig = emailBtn.innerHTML;
                    emailBtn.textContent = 'Copied!';
                    setTimeout(() => { emailBtn.innerHTML = orig; }, 2000);
                });
            });

            const editBtn = document.createElement('button');
            editBtn.className = 'card-btn btn-edit';
            editBtn.innerHTML = `<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>`;
            editBtn.appendChild(document.createTextNode(' Edit'));
            editBtn.addEventListener('click', () => openModal(q));

            const deleteBtn = document.createElement('button');
            deleteBtn.className = 'card-btn btn-delete';
            deleteBtn.innerHTML = `<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>`;
            deleteBtn.appendChild(document.createTextNode(' Delete'));
            deleteBtn.addEventListener('click', () => {
                if (!deleteBtn.classList.contains('confirm-state')) {
                    deleteBtn.classList.add('confirm-state');
                    deleteBtn.textContent = 'Sure?';
                    deleteBtn._revertTimeout = setTimeout(() => {
                        deleteBtn.classList.remove('confirm-state');
                        renderCards();
                    }, 5000);
                } else {
                    clearTimeout(deleteBtn._revertTimeout);
                    quotes = quotes.filter(x => x.id !== q.id);
                    saveQuotes();
                    renderStats();
                    renderFilterPills();
                    renderCards();
                }
            });

            actions.appendChild(emailBtn);
            actions.appendChild(editBtn);
            actions.appendChild(deleteBtn);
            card.appendChild(actions);
            container.appendChild(card);
        });

        renderCalendar();
    }

    // 6. CALENDAR
    function renderCalendar() {
        const calendarDays = document.getElementById('calendarDays');
        const calendarMonthYear = document.getElementById('calendarMonthYear');
        const calendarWeekdays = document.getElementById('calendarWeekdays');
        calendarDays.innerHTML = '';
        calendarWeekdays.innerHTML = '';

        const month = currentCalendarDate.getMonth();
        const year = currentCalendarDate.getFullYear();
        calendarMonthYear.textContent = `${currentCalendarDate.toLocaleString('default', { month: 'long' })} ${year}`;

        const eventsByDate = {};
        quotes.forEach(q => {
            if (q.status === 'rejected' || !q.eventDate) return;
            const startDate = new Date(q.eventDate + 'T00:00:00');
            const endDate = q.eventDateTo ? new Date(q.eventDateTo + 'T00:00:00') : startDate;
            for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
                const key = d.toISOString().split('T')[0];
                if (eventsByDate[key] && eventsByDate[key].status === 'confirmed' && q.status !== 'confirmed') continue;
                eventsByDate[key] = { clientName: q.clientName, status: q.status };
            }
        });

        ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].forEach(day => {
            const wd = document.createElement('div');
            wd.className = 'calendar-weekday';
            wd.textContent = day;
            calendarWeekdays.appendChild(wd);
        });

        const firstDay = new Date(year, month, 1).getDay();
        const daysInMonth = new Date(year, month + 1, 0).getDate();

        for (let i = 0; i < firstDay; i++) {
            calendarDays.appendChild(Object.assign(document.createElement('div'), { className: 'calendar-day' }));
        }

        for (let i = 1; i <= daysInMonth; i++) {
            const el = document.createElement('div');
            el.className = 'calendar-day';
            el.textContent = i;
            const key = `${year}-${String(month + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
            const event = eventsByDate[key];
            if (event) {
                el.classList.add(event.status === 'confirmed' ? 'occupied' : 'pending');
                const tip = document.createElement('div');
                tip.className = 'tooltip';
                tip.textContent = `${event.status === 'confirmed' ? 'Occupied' : 'Pending'}: ${event.clientName}`;
                el.appendChild(tip);
            }
            calendarDays.appendChild(el);
        }
    }

    // 7. MODAL
    const backdrop = document.getElementById('modalBackdrop');
    const form = document.getElementById('clientForm');
    const fStatus = document.getElementById('fStatus');
    const confirmedPriceGroup = document.getElementById('confirmedPriceGroup');
    const depositGroup = document.getElementById('depositGroup');

    function toggleConfirmedFields() {
        const show = fStatus.value === 'confirmed';
        confirmedPriceGroup.style.display = show ? '' : 'none';
        depositGroup.style.display = show ? '' : 'none';
    }

    function openModal(quote = null) {
        document.getElementById('modalTitle').textContent = quote ? 'Edit Client' : 'New Client';
        form.reset();
        if (quote) {
            document.getElementById('fId').value = quote.id;
            document.getElementById('fName').value = quote.clientName || '';
            document.getElementById('fEmail').value = quote.clientEmail || '';
            document.getElementById('fPhone').value = quote.phone || '';
            document.getElementById('fEventDate').value = quote.eventDate || '';
            document.getElementById('fEventDateTo').value = quote.eventDateTo || '';
            document.getElementById('fShootType').value = quote.shootType || '';
            document.getElementById('fLocation').value = quote.location || '';
            document.getElementById('fQuotedPrice').value = quote.quotedPrice || '';
            fStatus.value = quote.status || 'sent';
            document.getElementById('fConfirmedPrice').value = quote.confirmedPrice || '';
            document.getElementById('fDepositPaid').value =
                quote.depositPaid === true ? 'true' : quote.depositPaid === false ? 'false' : '';
            document.getElementById('fFollowUpDate').value = quote.followUpDate || '';
            document.getElementById('fNotes').value = quote.notes || '';
        }
        toggleConfirmedFields();
        backdrop.classList.add('open');
        document.getElementById('fName').focus();
    }

    function closeModal() { backdrop.classList.remove('open'); }

    fStatus.addEventListener('change', toggleConfirmedFields);
    document.getElementById('addClientBtn').addEventListener('click', () => openModal());
    document.getElementById('modalClose').addEventListener('click', closeModal);
    document.getElementById('modalCancel').addEventListener('click', closeModal);
    backdrop.addEventListener('click', e => { if (e.target === backdrop) closeModal(); });
    document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });

    form.addEventListener('submit', e => {
        e.preventDefault();
        const name = document.getElementById('fName').value.trim();
        const eventDate = document.getElementById('fEventDate').value;
        if (!name || !eventDate) return;

        const depositVal = document.getElementById('fDepositPaid').value;
        const editId = document.getElementById('fId').value;
        const record = {
            id: editId ? parseInt(editId) : generateId(quotes),
            clientName: name,
            clientEmail: document.getElementById('fEmail').value.trim(),
            phone: document.getElementById('fPhone').value.trim(),
            eventDate,
            eventDateTo: document.getElementById('fEventDateTo').value || eventDate,
            shootType: document.getElementById('fShootType').value,
            location: document.getElementById('fLocation').value.trim(),
            quotedPrice: parseFloat(document.getElementById('fQuotedPrice').value) || 0,
            status: fStatus.value,
            confirmedPrice: parseFloat(document.getElementById('fConfirmedPrice').value) || null,
            depositPaid: depositVal === 'true' ? true : depositVal === 'false' ? false : null,
            followUpDate: document.getElementById('fFollowUpDate').value || null,
            notes: document.getElementById('fNotes').value.trim(),
        };

        if (editId) {
            quotes = quotes.map(q => q.id === record.id ? record : q);
        } else {
            quotes.push(record);
        }

        saveQuotes();
        closeModal();
        renderStats();
        renderFilterPills();
        renderCards();
    });

    // 8. SEARCH
    let searchDebounce;
    document.getElementById('crmSearch').addEventListener('input', e => {
        clearTimeout(searchDebounce);
        searchDebounce = setTimeout(() => {
            searchTerm = e.target.value;
            renderCards();
        }, 200);
    });

    // 9. CALENDAR NAV
    document.getElementById('prevMonth').addEventListener('click', () => {
        currentCalendarDate.setMonth(currentCalendarDate.getMonth() - 1);
        renderCalendar();
    });
    document.getElementById('nextMonth').addEventListener('click', () => {
        currentCalendarDate.setMonth(currentCalendarDate.getMonth() + 1);
        renderCalendar();
    });

    // 10. CSV EXPORT
    window.exportToExcel = function () {
        const sorted = [...quotes].sort((a, b) => new Date(a.eventDate) - new Date(b.eventDate));
        const headers = ['Client Name','Wedding Date','Wedding Date (End)','Status','Email','Phone','Shoot Type','Location','Quoted ($)','Confirmed ($)','Deposit','Follow-up Date','Notes'];
        const csvRows = sorted.map(q => {
            const start = formatDate(q.eventDate);
            const end = q.eventDateTo && q.eventDateTo !== q.eventDate ? formatDate(q.eventDateTo) : start;
            const cells = [
                q.clientName, start, end,
                q.status.charAt(0).toUpperCase() + q.status.slice(1),
                q.clientEmail || '', q.phone || '', q.shootType || '', q.location || '',
                q.quotedPrice || '', q.confirmedPrice || '',
                q.depositPaid === true ? 'Paid' : q.depositPaid === false ? 'Unpaid' : '',
                q.followUpDate || '', q.notes || '',
            ];
            return cells.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',');
        });
        const csv = [headers.join(','), ...csvRows].join('\n');
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'aakaara-clients.csv';
        a.click();
        URL.revokeObjectURL(url);
    };

    // 11. INIT
    renderStats();
    renderFilterPills();
    renderCards();
});
```

- [ ] **Step 4.2: Run unit tests**

```bash
npm run test:unit
```

Expected: All 17 tests pass (dashboard.js not imported by tests — crm-utils.js is tested directly).

- [ ] **Step 4.3: Manual browser verification**

Start a local server: `npx serve . -p 8080`
Open `http://localhost:8080/admin/dashboard.html` and check:
- [ ] 4 stats cards show correct numbers (5 total, 2 confirmed, 2 pending, revenue)
- [ ] 5 client cards render in a 3-column grid
- [ ] Cards have correct color-coded left borders (green = confirmed, amber = sent)
- [ ] Filter pill "Confirmed" → shows 2 cards; "All" → shows 5
- [ ] "Wedding" pill appears and filters to 3 cards
- [ ] Typing "vikram" in search box → 1 card shown
- [ ] "+ Add Client" opens modal; fill name + date + shoot type → Save → new card appears in grid
- [ ] Click Edit on any card → modal opens pre-filled → change a field → Save → card updates
- [ ] Delete a card → "Sure?" → click again → card removed
- [ ] Calendar still shows event date indicators with tooltips
- [ ] "Export CSV" downloads a file with 13 columns

- [ ] **Step 4.4: Commit**

```bash
git add admin/dashboard.js
git commit -m "feat: rewrite dashboard.js as full CRM — card grid, modal, search, stats, export"
```

---

## Task 5: Final Commit

- [ ] **Step 5.1: Run all tests one last time**

```bash
npm run test:unit
```

Expected: All tests pass, no failures.

- [ ] **Step 5.2: Tag the completion commit**

```bash
git add -A
git status
# Confirm only expected files are staged
git commit -m "feat: admin dashboard upgraded to full client CRM"
```
