# Project Board 2a — Core Owner/PM UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Owner/PM Kanban board UI — login, drag-drop stage changes, project create/edit, and a detail panel (sub-events timeline + comments/activity feed) — against the live Foundation schema (PR #3).

**Architecture:** Vanilla ES modules, no build step, loaded via `<script type="module">`. `supabase-js` comes from a CDN ESM import (`esm.sh`), never bundled. Pure logic (stage/date/validation helpers) lives in `board-utils.js` and is unit-tested; DOM/event wiring lives in `board.js` (board fetch/render/realtime/drag-drop) and `project-modal.js` (create/edit form + detail panel). `board-shared.js` holds small cross-file state (current user's profile) and the toast system, breaking what would otherwise be a circular import between `board.js` and `project-modal.js`.

**Tech Stack:** Vanilla JS (ES modules), Supabase JS client (CDN), CSS custom properties (existing root vars), Vitest for unit tests.

**Design spec:** `docs/superpowers/specs/2026-07-27-project-board-2a-core-ui-design.md`

## Global Constraints

- No build step. All JS ships as plain ES modules; `supabase-js` loads from `https://esm.sh/@supabase/supabase-js@2`, never via npm bundling.
- `board.css` reuses root `styles.css` CSS vars only (`--noir`, `--rose`, `--ivory`, `--font-display`, `--font-body`, `--ease`) — no new token names, no third font family (only Cormorant Garamond + Outfit exist site-wide; dates/timestamps use `--font-body`).
- Owner/PM only. No role-branching logic anywhere in this UI for Editor/Client — those access models don't exist yet and never reach this page.
- No optimistic drag-drop moves. A dropped card gets a `.card-pending` class only; the actual move happens when the realtime-triggered redraw runs. No revert-on-failure state to manage.
- One error surface: `showErrorToast(message)` from `board-shared.js`, used for every failure type (fetch, realtime reconnect, drag-drop update, form submit). No separate banner component.
- Dismissing a toast never touches background realtime reconnect — Supabase's client reconnects independently of any UI state.
- New comments default to `internal: true` (a "Hidden from client" checkbox, checked by default), per the design spec's reasoning: no client view exists yet, so day-to-day notes are private by default until explicitly marked otherwise.
- A project can be created with zero sub-events (card shows "Date TBD"); creation is never blocked on having a dated sub-event.
- `SUPABASE_URL` and the anon key are hardcoded directly in `board/supabase-client.js` — both are safe to ship client-side (RLS is the real access boundary), and this site has no build step to inject them at deploy time. Live values for this project:
  - `SUPABASE_URL`: `https://hqvcwrkhqyeyufdnxryu.supabase.co`
  - `SUPABASE_ANON_KEY`: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhxdmN3cmtocXlleXVmZG54cnl1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODUxMjkzMzUsImV4cCI6MjEwMDcwNTMzNX0.bquPPhz1SBSZbydIYfDYokdrJrouhxA5H6xdtdldzy0`
- No automated e2e/Playwright coverage — this environment has no Playwright browsers installed (a pre-existing gap from the Foundation sub-project). Task 10 covers manual browser verification via the `run` skill instead, and this must be stated plainly in that task's report, not glossed over.

---

## File Map

| Action | File | Responsibility |
|---|---|---|
| Create | `board/board-utils.js` | Pure logic: stage/column mapping, progress bar, date derivation/sort, form validation, activity-log line synthesis |
| Create | `board/test/board-utils.test.js` | Vitest unit tests for board-utils.js |
| Create | `board/supabase-client.js` | Initializes and exports the supabase-js client |
| Create | `board/login.html`, `board/login.js` | Login page |
| Create | `board/index.html` | Board page shell (columns, modals, detail panel, toast container markup) |
| Create | `board/board-shared.js` | Toast system + current-profile state (breaks the board.js ↔ project-modal.js import cycle) |
| Create | `board/board.js` | Fetch, render columns/cards, realtime subscription, drag-drop |
| Create | `board/project-modal.js` | Create/edit project modal + detail panel (sub-events timeline, comments/activity feed) |
| Create | `board/board.css` | All board-specific styling |

---

## Task 1: Pure Logic + Unit Tests (TDD)

**Files:**
- Create: `board/test/board-utils.test.js`
- Create: `board/board-utils.js`

**Interfaces:**
- Produces: `STAGE_COLUMNS`, `SUBSTATUS_LABELS`, `stageIndex(stage)`, `stageLabel(stage)`, `progressSegments(stage)`, `deriveWeddingDate(subEvents)`, `formatDate(dateStr)`, `compareProjectsByDate(a, b)`, `validateProjectForm(fields)`, `photoSelectionLabel(selectedCount, totalCount)`, `synthesizeActivityLine(entry)` — all imported by name from later tasks.

- [ ] **Step 1.1: Write the failing tests — create `board/test/board-utils.test.js`**

```js
import { describe, it, expect } from 'vitest';
import {
  STAGE_COLUMNS, stageIndex, stageLabel, progressSegments,
  deriveWeddingDate, formatDate, compareProjectsByDate,
  validateProjectForm, photoSelectionLabel, synthesizeActivityLine,
} from '../board-utils.js';

describe('STAGE_COLUMNS', () => {
  it('has exactly 8 stages in schema order', () => {
    expect(STAGE_COLUMNS.map(c => c.key)).toEqual([
      'booked', 'shoot_completed', 'raw_delivered', 'photo_selection',
      'video_editing', 'song_finalization', 'final_delivery', 'completed',
    ]);
  });
});

describe('stageIndex', () => {
  it('returns 0 for booked', () => expect(stageIndex('booked')).toBe(0));
  it('returns 7 for completed', () => expect(stageIndex('completed')).toBe(7));
  it('returns -1 for an unknown stage', () => expect(stageIndex('nonsense')).toBe(-1));
});

describe('stageLabel', () => {
  it('returns the friendly label', () => expect(stageLabel('raw_delivered')).toBe('RAW Delivered'));
  it('falls back to the raw value for an unknown stage', () => expect(stageLabel('nonsense')).toBe('nonsense'));
});

describe('progressSegments', () => {
  it('booked is 1 of 8', () => expect(progressSegments('booked')).toEqual({ filled: 1, total: 8 }));
  it('completed is 8 of 8', () => expect(progressSegments('completed')).toEqual({ filled: 8, total: 8 }));
  it('an unknown stage is 0 of 8', () => expect(progressSegments('nonsense')).toEqual({ filled: 0, total: 8 }));
});

describe('deriveWeddingDate', () => {
  it('returns null for no sub-events', () => expect(deriveWeddingDate([])).toBeNull());
  it('returns null when sub-events have no dates', () => expect(deriveWeddingDate([{ event_date: null }])).toBeNull());
  it('returns the earliest date', () => {
    expect(deriveWeddingDate([{ event_date: '2026-09-15' }, { event_date: '2026-09-12' }])).toBe('2026-09-12');
  });
});

describe('formatDate', () => {
  it('returns "Date TBD" for null', () => expect(formatDate(null)).toBe('Date TBD'));
  it('formats a real date', () => expect(formatDate('2026-09-12')).toBe('Sep 12, 2026'));
});

describe('compareProjectsByDate', () => {
  it('sorts dated projects earliest first', () => {
    const a = { sub_events: [{ event_date: '2026-10-01' }] };
    const b = { sub_events: [{ event_date: '2026-09-01' }] };
    expect(compareProjectsByDate(a, b)).toBeGreaterThan(0);
  });
  it('sorts undated projects after dated ones', () => {
    const a = { sub_events: [] };
    const b = { sub_events: [{ event_date: '2026-09-01' }] };
    expect(compareProjectsByDate(a, b)).toBeGreaterThan(0);
  });
  it('treats two undated projects as equal', () => {
    expect(compareProjectsByDate({ sub_events: [] }, { sub_events: [] })).toBe(0);
  });
});

describe('validateProjectForm', () => {
  it('requires client_name', () => {
    const result = validateProjectForm({ client_name: '' });
    expect(result.valid).toBe(false);
    expect(result.errors.client_name).toBeTruthy();
  });
  it('passes with a client_name', () => {
    expect(validateProjectForm({ client_name: 'Priya & Rohan' }).valid).toBe(true);
  });
  it('rejects a whitespace-only client_name', () => {
    expect(validateProjectForm({ client_name: '   ' }).valid).toBe(false);
  });
});

describe('photoSelectionLabel', () => {
  it('returns null when total is 0', () => expect(photoSelectionLabel(0, 0)).toBeNull());
  it('formats a real count', () => expect(photoSelectionLabel(12, 40)).toBe('12/40 selected'));
});

describe('synthesizeActivityLine', () => {
  it('formats a stage change using the friendly stage labels', () => {
    expect(synthesizeActivityLine({ field_changed: 'stage', old_value: 'booked', new_value: 'shoot_completed' }))
      .toBe('Stage changed: Booked → Shoot Completed');
  });
  it('formats a video editing substatus change using the friendly substatus labels', () => {
    expect(synthesizeActivityLine({ field_changed: 'video_editing_substatus', old_value: 'not_started', new_value: 'in_progress' }))
      .toBe('Video editing status changed: Not Started → In Progress');
  });
  it('falls back to a generic line for any other field', () => {
    expect(synthesizeActivityLine({ field_changed: 'package_tier', old_value: 'Silver', new_value: 'Gold' }))
      .toBe('package tier changed: Silver → Gold');
  });
});
```

- [ ] **Step 1.2: Run the tests — verify they fail**

```bash
cd "/Users/sudhakaravula/Desktop/logo/files new version  draft 1/aakaara-site-v2"
npm run test:unit -- board/test/board-utils.test.js
```

Expected: every test fails with "Cannot find module '../board-utils.js'".

- [ ] **Step 1.3: Create `board/board-utils.js`**

```js
export const STAGE_COLUMNS = [
  { key: 'booked', label: 'Booked' },
  { key: 'shoot_completed', label: 'Shoot Completed' },
  { key: 'raw_delivered', label: 'RAW Delivered' },
  { key: 'photo_selection', label: 'Photo Selection' },
  { key: 'video_editing', label: 'Video Editing' },
  { key: 'song_finalization', label: 'Song Finalization' },
  { key: 'final_delivery', label: 'Final Delivery' },
  { key: 'completed', label: 'Completed' },
];

export const SUBSTATUS_LABELS = {
  not_started: 'Not Started',
  in_progress: 'In Progress',
  client_review: 'Client Review',
  revisions: 'Revisions',
  final: 'Final',
};

export function stageIndex(stage) {
  return STAGE_COLUMNS.findIndex(c => c.key === stage);
}

export function stageLabel(stage) {
  const col = STAGE_COLUMNS.find(c => c.key === stage);
  return col ? col.label : stage;
}

export function progressSegments(stage) {
  const idx = stageIndex(stage);
  const filled = idx === -1 ? 0 : idx + 1;
  return { filled, total: STAGE_COLUMNS.length };
}

export function deriveWeddingDate(subEvents) {
  if (!subEvents || subEvents.length === 0) return null;
  const dated = subEvents.map(e => e.event_date).filter(Boolean).sort();
  return dated.length ? dated[0] : null;
}

export function formatDate(dateStr) {
  if (!dateStr) return 'Date TBD';
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  });
}

export function compareProjectsByDate(a, b) {
  const dateA = deriveWeddingDate(a.sub_events);
  const dateB = deriveWeddingDate(b.sub_events);
  if (dateA && dateB) return dateA < dateB ? -1 : dateA > dateB ? 1 : 0;
  if (dateA && !dateB) return -1;
  if (!dateA && dateB) return 1;
  return 0;
}

export function validateProjectForm(fields) {
  const errors = {};
  if (!fields.client_name || !fields.client_name.trim()) {
    errors.client_name = 'Client name is required.';
  }
  return { valid: Object.keys(errors).length === 0, errors };
}

export function photoSelectionLabel(selectedCount, totalCount) {
  if (!totalCount) return null;
  return `${selectedCount}/${totalCount} selected`;
}

export function synthesizeActivityLine(entry) {
  const { field_changed, old_value, new_value } = entry;
  if (field_changed === 'stage') {
    return `Stage changed: ${stageLabel(old_value)} → ${stageLabel(new_value)}`;
  }
  if (field_changed === 'video_editing_substatus') {
    const oldLabel = old_value ? (SUBSTATUS_LABELS[old_value] || old_value) : 'None';
    const newLabel = new_value ? (SUBSTATUS_LABELS[new_value] || new_value) : 'None';
    return `Video editing status changed: ${oldLabel} → ${newLabel}`;
  }
  const fieldLabel = field_changed.replace(/_/g, ' ');
  const oldDisplay = old_value === null || old_value === undefined ? '—' : old_value;
  const newDisplay = new_value === null || new_value === undefined ? '—' : new_value;
  return `${fieldLabel} changed: ${oldDisplay} → ${newDisplay}`;
}
```

- [ ] **Step 1.4: Run the tests — verify all pass**

```bash
npm run test:unit -- board/test/board-utils.test.js
```

Expected: all tests pass (18 assertions across the describe blocks above).

- [ ] **Step 1.5: Commit**

```bash
cd "/Users/sudhakaravula/Desktop/logo/files new version  draft 1/aakaara-site-v2/.claude/worktrees/project-board-foundation"
git add board/board-utils.js board/test/board-utils.test.js
git commit -m "feat(board-ui): add pure stage/date/validation logic with full unit tests"
```

---

## Task 2: Supabase Client

**Files:**
- Create: `board/supabase-client.js`

**Interfaces:**
- Consumes: nothing.
- Produces: `supabase` (an initialized supabase-js client), imported by every later browser-side file.

- [ ] **Step 2.1: Create `board/supabase-client.js`**

```js
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = 'https://hqvcwrkhqyeyufdnxryu.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhxdmN3cmtocXlleXVmZG54cnl1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODUxMjkzMzUsImV4cCI6MjEwMDcwNTMzNX0.bquPPhz1SBSZbydIYfDYokdrJrouhxA5H6xdtdldzy0';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
```

- [ ] **Step 2.2: Commit**

```bash
git add board/supabase-client.js
git commit -m "feat(board-ui): add Supabase client config"
```

---

## Task 3: Auth Shell — Login Page + Board Page Scaffold

**Files:**
- Create: `board/login.html`
- Create: `board/login.js`
- Create: `board/index.html`
- Create: `board/board.css`

**Interfaces:**
- Consumes: `supabase` from Task 2.
- Produces: the DOM elements every later task's JS attaches to (`#boardColumns`, `#toastContainer`, `#projectModalBackdrop` + its form fields, `#detailBackdrop` + its sections, `#subEventModalBackdrop` + its form fields, `#logoutBtn`, `#addProjectBtn`) — exact `id` values later tasks depend on.

- [ ] **Step 3.1: Create `board/login.html`**

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Log In — Project Board — Aakaara Studios</title>
  <link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@300;400&family=Outfit:wght@200;300;400;500&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="../styles.css">
  <link rel="stylesheet" href="board.css">
</head>
<body class="login-body">
  <div class="login-box">
    <div class="brand">Aakaara Studios</div>
    <h1>Project Board</h1>
    <form id="loginForm" novalidate>
      <div class="form-group">
        <label class="form-label" for="lEmail">Email</label>
        <input class="form-input" type="email" id="lEmail" required autocomplete="username">
      </div>
      <div class="form-group">
        <label class="form-label" for="lPassword">Password</label>
        <input class="form-input" type="password" id="lPassword" required autocomplete="current-password">
      </div>
      <div class="login-error" id="loginError"></div>
      <button type="submit" class="btn-modal-save login-submit">Log In</button>
    </form>
  </div>
<script type="module" src="login.js"></script>
</body>
</html>
```

- [ ] **Step 3.2: Create `board/login.js`**

```js
import { supabase } from './supabase-client.js';

document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('loginForm');
  const errorEl = document.getElementById('loginError');

  supabase.auth.getSession().then(({ data }) => {
    if (data.session) window.location.href = 'index.html';
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    errorEl.textContent = '';

    const email = document.getElementById('lEmail').value.trim();
    const password = document.getElementById('lPassword').value;

    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      errorEl.textContent = 'Incorrect email or password.';
      return;
    }
    window.location.href = 'index.html';
  });
});
```

- [ ] **Step 3.3: Create `board/index.html`**

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Project Board — Aakaara Studios</title>
  <link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@300;400&family=Outfit:wght@200;300;400;500&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="../styles.css">
  <link rel="stylesheet" href="board.css">
</head>
<body>

  <header class="board-header">
    <div>
      <div class="brand">Aakaara Studios</div>
      <h1>Project Board</h1>
    </div>
    <div class="board-header-actions">
      <button class="board-add-btn" id="addProjectBtn">+ New Project</button>
      <button class="board-logout-btn" id="logoutBtn">Log Out</button>
    </div>
  </header>

  <main class="board-columns" id="boardColumns"></main>

  <div class="toast-container" id="toastContainer"></div>

  <!-- Create/Edit Project Modal -->
  <div class="modal-backdrop" id="projectModalBackdrop">
    <div class="modal-box" role="dialog" aria-modal="true" aria-labelledby="projectModalTitle">
      <div class="modal-header">
        <div class="modal-title" id="projectModalTitle">New Project</div>
        <button class="modal-close" id="projectModalClose" aria-label="Close">&times;</button>
      </div>
      <form class="modal-form" id="projectForm" novalidate>
        <input type="hidden" id="fId">
        <div class="modal-grid">
          <div class="form-group form-full">
            <label class="form-label" for="fClientName">Client Name *</label>
            <input class="form-input" type="text" id="fClientName" required>
            <div class="form-error" id="fClientNameError"></div>
          </div>
          <div class="form-group">
            <label class="form-label" for="fClientEmail">Email</label>
            <input class="form-input" type="email" id="fClientEmail">
          </div>
          <div class="form-group">
            <label class="form-label" for="fClientPhone">Phone</label>
            <input class="form-input" type="tel" id="fClientPhone">
          </div>
          <div class="form-group">
            <label class="form-label" for="fPackageTier">Package Tier</label>
            <input class="form-input" type="text" id="fPackageTier">
          </div>
          <div class="form-group">
            <label class="form-label" for="fHoursBooked">Hours Booked</label>
            <input class="form-input" type="number" id="fHoursBooked" min="0">
          </div>
          <div class="form-group">
            <label class="form-label" for="fQuotedPrice">Quoted Price ($)</label>
            <input class="form-input" type="number" id="fQuotedPrice" min="0">
          </div>
          <div class="form-group">
            <label class="form-label" for="fConfirmedPrice">Confirmed Price ($)</label>
            <input class="form-input" type="number" id="fConfirmedPrice" min="0">
          </div>
          <div class="form-group form-checkbox">
            <label><input type="checkbox" id="fDepositPaid"> Deposit Paid</label>
          </div>
          <div class="form-group form-checkbox">
            <label><input type="checkbox" id="fBalancePaid"> Balance Paid</label>
          </div>
          <div class="form-group form-full">
            <label class="form-label" for="fContractUrl">Contract URL</label>
            <input class="form-input" type="url" id="fContractUrl">
          </div>
          <div class="form-group form-full">
            <label class="form-label" for="fQuotePdfUrl">Quote PDF URL</label>
            <input class="form-input" type="url" id="fQuotePdfUrl">
          </div>
        </div>
        <div class="modal-actions">
          <button type="button" class="btn-modal-cancel" id="projectModalCancel">Cancel</button>
          <button type="submit" class="btn-modal-save">Save Project</button>
        </div>
      </form>
    </div>
  </div>

  <!-- Project Detail Panel -->
  <div class="detail-backdrop" id="detailBackdrop">
    <div class="detail-panel" role="dialog" aria-modal="true" aria-labelledby="detailClientName">
      <div class="detail-header">
        <div class="detail-title" id="detailClientName"></div>
        <button class="detail-close" id="detailClose" aria-label="Close">&times;</button>
      </div>

      <section class="detail-section">
        <div class="detail-section-title">Sub-Events</div>
        <div class="timeline" id="subEventsTimeline"></div>
        <button class="btn-add-subevent" id="addSubEventBtn">+ Add Sub-Event</button>
      </section>

      <section class="detail-section">
        <div class="detail-section-title">Activity &amp; Notes</div>
        <div class="activity-feed" id="activityFeed"></div>
        <form class="comment-composer" id="commentForm">
          <textarea class="comment-input" id="commentBody" placeholder="Add a note&hellip;" required></textarea>
          <div class="comment-composer-row">
            <label class="comment-internal-toggle">
              <input type="checkbox" id="commentInternal" checked> Hidden from client
            </label>
            <button type="submit" class="btn-comment-post">Post</button>
          </div>
        </form>
      </section>
    </div>
  </div>

  <!-- Sub-Event Add/Edit Modal -->
  <div class="modal-backdrop" id="subEventModalBackdrop">
    <div class="modal-box modal-box-small" role="dialog" aria-modal="true" aria-labelledby="subEventModalTitle">
      <div class="modal-header">
        <div class="modal-title" id="subEventModalTitle">New Sub-Event</div>
        <button class="modal-close" id="subEventModalClose" aria-label="Close">&times;</button>
      </div>
      <form class="modal-form" id="subEventForm" novalidate>
        <input type="hidden" id="seId">
        <div class="modal-grid modal-grid-single">
          <div class="form-group">
            <label class="form-label" for="seName">Name</label>
            <input class="form-input" type="text" id="seName" placeholder="Haldi, Sangeet, Wedding&hellip;" required>
          </div>
          <div class="form-group">
            <label class="form-label" for="seDate">Date</label>
            <input class="form-input" type="date" id="seDate">
          </div>
          <div class="form-group">
            <label class="form-label" for="seVenue">Venue</label>
            <input class="form-input" type="text" id="seVenue">
          </div>
        </div>
        <div class="modal-actions">
          <button type="button" class="btn-modal-cancel" id="subEventModalCancel">Cancel</button>
          <button type="submit" class="btn-modal-save">Save</button>
        </div>
      </form>
    </div>
  </div>

<script type="module" src="board.js"></script>
</body>
</html>
```

- [ ] **Step 3.4: Create `board/board.css`**

```css
/* Inherits CSS variables from ../styles.css */

html, body { background: var(--noir); }
body {
  font-family: var(--font-body); font-weight: 300;
  margin: 0; -webkit-font-smoothing: antialiased; color: var(--ivory);
}

/* Header */
.board-header {
  padding: 1.5rem 2rem;
  border-bottom: 1px solid rgba(201,149,107,0.1);
  display: flex; justify-content: space-between; align-items: center;
}
.board-header h1 {
  font-family: var(--font-display); font-weight: 300; font-size: 1.4rem;
  letter-spacing: 0.1em; margin: 0;
}
.board-header .brand {
  font-size: 0.6rem; letter-spacing: 0.3em; text-transform: uppercase; color: var(--rose);
}
.board-header-actions { display: flex; gap: 0.75rem; }
.board-add-btn, .board-logout-btn {
  padding: 0.5rem 1rem; border-radius: 6px; font-family: var(--font-body);
  font-size: 0.7rem; letter-spacing: 0.08em; cursor: pointer; transition: background 0.2s var(--ease);
}
.board-add-btn {
  background: rgba(201,149,107,0.12); border: 1px solid rgba(201,149,107,0.35); color: var(--rose);
}
.board-add-btn:hover { background: rgba(201,149,107,0.22); }
.board-logout-btn {
  background: none; border: 1px solid rgba(201,149,107,0.15); color: rgba(250,246,241,0.5);
}
.board-logout-btn:hover { border-color: rgba(201,149,107,0.3); color: var(--ivory); }

/* Login page */
.login-body {
  display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0;
}
.login-box {
  width: 100%; max-width: 380px; padding: 2.5rem 2rem;
  background: #111; border: 1px solid rgba(201,149,107,0.15); border-radius: 10px;
}
.login-box .brand {
  font-size: 0.6rem; letter-spacing: 0.3em; text-transform: uppercase; color: var(--rose);
}
.login-box h1 {
  font-family: var(--font-display); font-weight: 300; font-size: 1.6rem;
  margin: 0.3rem 0 1.75rem;
}
.login-error { color: #e07070; font-size: 0.75rem; min-height: 1rem; margin: 0.5rem 0 1rem; }
.login-submit { width: 100%; margin-top: 0.5rem; }

/* Shared form styles (modal + login) */
.form-group { display: flex; flex-direction: column; gap: 0.35rem; margin-bottom: 1rem; }
.form-group.form-full { grid-column: 1 / -1; }
.form-group.form-checkbox { flex-direction: row; align-items: center; gap: 0.5rem; }
.form-group.form-checkbox label { display: flex; align-items: center; gap: 0.5rem; font-size: 0.8rem; color: rgba(250,246,241,0.7); }
.form-label {
  font-size: 0.6rem; text-transform: uppercase; letter-spacing: 0.1em; color: rgba(250,246,241,0.35);
}
.form-input {
  background: rgba(0,0,0,0.3); border: 1px solid rgba(201,149,107,0.15); border-radius: 5px;
  padding: 0.55rem 0.75rem; color: var(--ivory); font-family: var(--font-body); font-size: 0.82rem;
  outline: none; transition: border-color 0.15s var(--ease); width: 100%; box-sizing: border-box;
}
.form-input:focus { border-color: rgba(201,149,107,0.45); }
.form-error { color: #e07070; font-size: 0.7rem; min-height: 1rem; }

/* Board columns */
.board-columns {
  display: flex; gap: 1rem; padding: 1.5rem 2rem; overflow-x: auto;
  align-items: flex-start;
}
.board-column {
  flex: 0 0 260px; background: #111; border: 1px solid rgba(201,149,107,0.1);
  border-radius: 8px; display: flex; flex-direction: column; max-height: calc(100vh - 8rem);
}
.board-column-header {
  padding: 0.85rem 1rem; font-size: 0.65rem; letter-spacing: 0.12em; text-transform: uppercase;
  color: var(--rose); border-bottom: 1px solid rgba(201,149,107,0.08);
}
.board-column-cards {
  padding: 0.75rem; display: flex; flex-direction: column; gap: 0.6rem; overflow-y: auto;
}
.board-column-empty {
  text-align: center; padding: 1.5rem 0; color: rgba(250,246,241,0.2); font-size: 0.75rem;
}

/* Project cards */
.project-card {
  background: rgba(0,0,0,0.25); border: 1px solid rgba(201,149,107,0.1); border-radius: 6px;
  padding: 0.75rem; cursor: grab; transition: border-color 0.15s var(--ease), opacity 0.2s var(--ease);
}
.project-card:hover { border-color: rgba(201,149,107,0.3); }
.project-card.card-pending { opacity: 0.45; pointer-events: none; }
.card-client-name {
  font-family: var(--font-display); font-size: 1rem; color: var(--ivory); margin-bottom: 0.25rem;
}
.card-date, .card-tier {
  font-size: 0.7rem; color: rgba(250,246,241,0.45); margin-bottom: 0.15rem;
}
.card-substatus {
  display: inline-block; margin-top: 0.3rem; font-size: 0.6rem; letter-spacing: 0.06em;
  text-transform: uppercase; padding: 0.15rem 0.45rem; border-radius: 4px;
  background: rgba(201,149,107,0.12); color: var(--rose);
}
.card-progress { display: flex; gap: 3px; margin-top: 0.6rem; }
.card-progress-segment {
  flex: 1; height: 3px; border-radius: 2px; background: rgba(201,149,107,0.15);
}
.card-progress-segment.filled { background: var(--rose); }

/* Toasts */
.toast-container {
  position: fixed; bottom: 1.5rem; right: 1.5rem; display: flex; flex-direction: column;
  gap: 0.5rem; z-index: 2000;
}
.toast {
  display: flex; align-items: center; gap: 0.75rem; background: #1a1418;
  border: 1px solid rgba(224,112,112,0.4); border-radius: 6px; padding: 0.65rem 0.9rem;
  color: var(--ivory); font-size: 0.78rem; max-width: 320px; box-shadow: 0 4px 16px rgba(0,0,0,0.4);
}
.toast-dismiss {
  background: none; border: none; color: rgba(250,246,241,0.5); font-size: 1rem; cursor: pointer;
  line-height: 1; padding: 0;
}

/* Mobile */
@media (max-width: 768px) {
  .board-header { padding: 1rem 1.25rem; flex-wrap: wrap; gap: 0.75rem; }
  .board-columns { padding: 1rem 1.25rem; scroll-snap-type: x mandatory; }
  .board-column { flex: 0 0 82vw; scroll-snap-align: start; max-height: none; }
}
```

- [ ] **Step 3.5: Verify the login page loads and redirects correctly**

```bash
cd "/Users/sudhakaravula/Desktop/logo/files new version  draft 1/aakaara-site-v2/.claude/worktrees/project-board-foundation"
npx serve . -p 8080 &
```

Open `http://localhost:8080/board/login.html` in a browser (via the `run` skill). Expected: the login form renders with the brand/title, no console errors on load (Supabase client should initialize without error, even though `board.js`/`index.html` logic doesn't exist yet). Stop the server after checking.

- [ ] **Step 3.6: Commit**

```bash
git add board/login.html board/login.js board/index.html board/board.css
git commit -m "feat(board-ui): add login page and board page scaffold"
```

---

## Task 4: Board Fetch + Render

**Files:**
- Create: `board/board-shared.js`
- Create: `board/board.js`
- Modify: `board/board.css`

**Interfaces:**
- Consumes: `supabase` from Task 2; `STAGE_COLUMNS`, `SUBSTATUS_LABELS`, `progressSegments`, `deriveWeddingDate`, `formatDate`, `compareProjectsByDate` from Task 1; DOM elements from Task 3 (`#boardColumns`, `#logoutBtn`, `#toastContainer`).
- Produces: `showErrorToast(message)`, `getCurrentProfile()`, `setCurrentProfile(profile)` from `board-shared.js` (consumed by Task 9's `project-modal.js`); `renderBoard()` (consumed by Tasks 5 and 6).

- [ ] **Step 4.1: Create `board/board-shared.js`**

```js
let currentProfile = { full_name: '', role: 'pm' };

export function setCurrentProfile(profile) {
  currentProfile = profile;
}

export function getCurrentProfile() {
  return currentProfile;
}

export function showErrorToast(message) {
  const container = document.getElementById('toastContainer');
  const toast = document.createElement('div');
  toast.className = 'toast toast-error';

  const text = document.createElement('span');
  text.textContent = message;
  toast.appendChild(text);

  const dismiss = document.createElement('button');
  dismiss.className = 'toast-dismiss';
  dismiss.setAttribute('aria-label', 'Dismiss');
  dismiss.textContent = '×';
  dismiss.addEventListener('click', () => toast.remove());
  toast.appendChild(dismiss);

  container.appendChild(toast);
  setTimeout(() => toast.remove(), 8000);
}
```

- [ ] **Step 4.2: Create `board/board.js`**

```js
import { supabase } from './supabase-client.js';
import {
  STAGE_COLUMNS, SUBSTATUS_LABELS, progressSegments,
  deriveWeddingDate, formatDate, compareProjectsByDate,
} from './board-utils.js';
import { showErrorToast, setCurrentProfile } from './board-shared.js';

async function requireSession() {
  const { data } = await supabase.auth.getSession();
  if (!data.session) {
    window.location.href = 'login.html';
    return null;
  }
  return data.session.user;
}

async function fetchProfile(userId) {
  const { data, error } = await supabase
    .from('profiles')
    .select('full_name, role')
    .eq('id', userId)
    .single();
  if (error) {
    showErrorToast('Could not load your profile.');
    return { full_name: '', role: 'pm' };
  }
  return data;
}

async function fetchProjects() {
  const { data, error } = await supabase
    .from('projects')
    .select('*, sub_events(id, name, event_date, venue, photo_selection_status, photo_selected_count, photo_total_count)');
  if (error) {
    showErrorToast('Could not load projects.');
    return [];
  }
  return data;
}

function renderColumns() {
  const container = document.getElementById('boardColumns');
  container.innerHTML = '';

  STAGE_COLUMNS.forEach(col => {
    const columnEl = document.createElement('div');
    columnEl.className = 'board-column';
    columnEl.dataset.stage = col.key;

    const header = document.createElement('div');
    header.className = 'board-column-header';
    header.textContent = col.label;
    columnEl.appendChild(header);

    const cardsEl = document.createElement('div');
    cardsEl.className = 'board-column-cards';
    cardsEl.dataset.stage = col.key;
    columnEl.appendChild(cardsEl);

    container.appendChild(columnEl);
  });
}

function renderCard(project) {
  const card = document.createElement('div');
  card.className = 'project-card';
  card.dataset.id = project.id;

  const name = document.createElement('div');
  name.className = 'card-client-name';
  name.textContent = project.client_name;
  card.appendChild(name);

  const date = document.createElement('div');
  date.className = 'card-date';
  date.textContent = formatDate(deriveWeddingDate(project.sub_events));
  card.appendChild(date);

  if (project.package_tier) {
    const tier = document.createElement('div');
    tier.className = 'card-tier';
    tier.textContent = project.package_tier;
    card.appendChild(tier);
  }

  if (project.stage === 'video_editing' && project.video_editing_substatus) {
    const sub = document.createElement('div');
    sub.className = 'card-substatus';
    sub.textContent = SUBSTATUS_LABELS[project.video_editing_substatus] || project.video_editing_substatus;
    card.appendChild(sub);
  }

  const progress = progressSegments(project.stage);
  const bar = document.createElement('div');
  bar.className = 'card-progress';
  for (let i = 0; i < progress.total; i++) {
    const seg = document.createElement('span');
    seg.className = 'card-progress-segment' + (i < progress.filled ? ' filled' : '');
    bar.appendChild(seg);
  }
  card.appendChild(bar);

  return card;
}

export async function renderBoard() {
  const projects = await fetchProjects();

  STAGE_COLUMNS.forEach(col => {
    const columnCardsEl = document.querySelector(`.board-column-cards[data-stage="${col.key}"]`);
    columnCardsEl.innerHTML = '';

    const columnProjects = projects.filter(p => p.stage === col.key).sort(compareProjectsByDate);

    if (columnProjects.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'board-column-empty';
      empty.textContent = 'No projects';
      columnCardsEl.appendChild(empty);
      return;
    }

    columnProjects.forEach(p => columnCardsEl.appendChild(renderCard(p)));
  });
}

async function init() {
  const user = await requireSession();
  if (!user) return;

  const profile = await fetchProfile(user.id);
  setCurrentProfile(profile);

  renderColumns();
  await renderBoard();

  document.getElementById('logoutBtn').addEventListener('click', async () => {
    await supabase.auth.signOut();
    window.location.href = 'login.html';
  });
}

document.addEventListener('DOMContentLoaded', init);
```

Note: `#addProjectBtn`'s click handler, drag-drop, and the realtime subscription are wired in later tasks (5, 6, 7) — this task only gets the board rendering with real data on load.

- [ ] **Step 4.3: Add card/toast styling verification**

The card and toast CSS already exist from Task 3 (`board.css` already includes `.project-card`, `.card-progress`, `.toast` rules) — no CSS changes needed in this task. Confirm this by grepping:

```bash
grep -c "project-card\|toast-container" board/board.css
```

Expected: a non-zero count (both selectors already present).

- [ ] **Step 4.4: Manually verify against the live database**

Using the `run` skill, serve the site locally, log in with the Owner account (`info@aakaarastudiosnyc.com`), and confirm the board loads all 8 columns and any existing projects render as cards with the correct client name, date/"Date TBD", and progress bar. If no projects exist yet in the live `aakaara-board` Supabase project, insert one manually via the Supabase SQL editor or MCP `execute_sql` for verification purposes, then confirm it renders, then decide with the user whether to leave it as real seed data or delete it.

- [ ] **Step 4.5: Commit**

```bash
git add board/board-shared.js board/board.js
git commit -m "feat(board-ui): fetch and render projects into Kanban columns"
```

---

## Task 5: Realtime Subscription

**Files:**
- Modify: `board/board.js`

**Interfaces:**
- Consumes: `renderBoard()` (defined in this same file, Task 4), `showErrorToast` from `board-shared.js`.
- Produces: nothing new consumed by later tasks — this task's effect is behavioral (live sync), not a new exported interface.

- [ ] **Step 5.1: Add the realtime subscription to `board/board.js`**

Add this function after `renderBoard()`:

```js
let realtimeChannel = null;

function subscribeToChanges() {
  realtimeChannel = supabase
    .channel('board-changes')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'projects' }, () => renderBoard())
    .on('postgres_changes', { event: '*', schema: 'public', table: 'sub_events' }, () => renderBoard())
    .on('postgres_changes', { event: '*', schema: 'public', table: 'comments' }, () => renderBoard())
    .on('postgres_changes', { event: '*', schema: 'public', table: 'activity_log' }, () => renderBoard())
    .subscribe((status) => {
      if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        showErrorToast('Live updates disconnected — reconnecting…');
      }
    });
}
```

Then update `init()` to call it, and update the logout handler to unsubscribe first:

```js
async function init() {
  const user = await requireSession();
  if (!user) return;

  const profile = await fetchProfile(user.id);
  setCurrentProfile(profile);

  renderColumns();
  await renderBoard();
  subscribeToChanges();

  document.getElementById('logoutBtn').addEventListener('click', async () => {
    if (realtimeChannel) supabase.removeChannel(realtimeChannel);
    await supabase.auth.signOut();
    window.location.href = 'login.html';
  });
}
```

- [ ] **Step 5.2: Manually verify live sync**

Using the `run` skill: open the board in two browser tabs (or one tab + a direct Supabase SQL edit), both logged in as Owner. In one tab (or via `execute_sql`), update a project's `stage` directly. Confirm the other tab's board updates within a couple seconds without a manual refresh. Also verify: temporarily disconnect network (or close/reopen the Supabase project connection) to confirm a toast appears on `CHANNEL_ERROR`/`TIMED_OUT`, and that dismissing it doesn't prevent the board from eventually reconnecting and resuming live updates once connectivity returns.

- [ ] **Step 5.3: Commit**

```bash
git add board/board.js
git commit -m "feat(board-ui): wire up realtime refetch-and-redraw"
```

---

## Task 6: Drag-and-Drop Stage Changes

**Files:**
- Modify: `board/board.js`
- Modify: `board/board.css`

**Interfaces:**
- Consumes: `showErrorToast` from `board-shared.js`; `.project-card`, `.board-column` DOM elements from Tasks 3/4.
- Produces: nothing new consumed by later tasks.

- [ ] **Step 6.1: Add drag-drop handlers to `board/board.js`**

Update `renderCard()` to make cards draggable — add this inside the function, right after `card.dataset.id = project.id;`:

```js
  card.draggable = true;
  card.addEventListener('dragstart', (e) => {
    e.dataTransfer.setData('text/plain', project.id);
  });
```

Update `renderColumns()` to wire drop handling — add this inside the `STAGE_COLUMNS.forEach` loop, right after `columnEl.appendChild(cardsEl);`:

```js
    columnEl.addEventListener('dragover', (e) => e.preventDefault());
    columnEl.addEventListener('drop', (e) => handleDrop(e, col.key));
```

Add the `handleDrop` function after `renderCard()`:

```js
async function handleDrop(e, newStage) {
  e.preventDefault();
  const projectId = e.dataTransfer.getData('text/plain');
  const card = document.querySelector(`.project-card[data-id="${projectId}"]`);
  if (card) card.classList.add('card-pending');

  const { error } = await supabase.from('projects').update({ stage: newStage }).eq('id', projectId);

  if (error) {
    if (card) card.classList.remove('card-pending');
    showErrorToast('Could not move project — please try again.');
  }
  // On success, the realtime subscription's redraw (Task 5) is what actually
  // moves the card — no local DOM move happens here, per the design spec's
  // explicit no-optimistic-update decision.
}
```

- [ ] **Step 6.2: Verify `.card-pending` styling already exists**

```bash
grep -n "card-pending" board/board.css
```

Expected: the rule already exists from Task 3 (`.project-card.card-pending { opacity: 0.45; pointer-events: none; }`). No CSS changes needed in this task.

- [ ] **Step 6.3: Manually verify drag-and-drop**

Using the `run` skill: drag a card from one column to another. Confirm: the card dims briefly (pending state), then moves to the new column once the realtime redraw fires, landing in the correct column sorted correctly among its new neighbors. Then check the Supabase `activity_log` table (via `execute_sql` or the dashboard) to confirm a `field_changed = 'stage'` row was written automatically by the Task 3 (Foundation) trigger, attributed to the Owner's `actor_role`.

- [ ] **Step 6.4: Commit**

```bash
git add board/board.js
git commit -m "feat(board-ui): add drag-and-drop stage changes"
```

---

## Task 7: Create/Edit Project Modal

**Files:**
- Create: `board/project-modal.js`
- Modify: `board/board.js`
- Modify: `board/board.css`

**Interfaces:**
- Consumes: `supabase` from Task 2; `validateProjectForm` from Task 1; `showErrorToast` from `board-shared.js`; the `#projectModalBackdrop`/`#projectForm`/etc. DOM elements from Task 3.
- Produces: `openProjectModal(project)` — consumed by `board.js`'s `#addProjectBtn` handler in this task, and by Task 8's card-click handler indirectly (Task 8 adds its own `openDetailPanel`, a separate function in the same file).

- [ ] **Step 7.1: Create `board/project-modal.js`**

```js
import { supabase } from './supabase-client.js';
import { validateProjectForm } from './board-utils.js';
import { showErrorToast } from './board-shared.js';

export function openProjectModal(project) {
  const backdrop = document.getElementById('projectModalBackdrop');
  const form = document.getElementById('projectForm');
  form.reset();
  document.getElementById('fClientNameError').textContent = '';
  document.getElementById('projectModalTitle').textContent = project ? 'Edit Project' : 'New Project';

  document.getElementById('fId').value = project ? project.id : '';
  document.getElementById('fClientName').value = project ? project.client_name : '';
  document.getElementById('fClientEmail').value = project ? (project.client_email || '') : '';
  document.getElementById('fClientPhone').value = project ? (project.client_phone || '') : '';
  document.getElementById('fPackageTier').value = project ? (project.package_tier || '') : '';
  document.getElementById('fHoursBooked').value = project ? (project.hours_booked ?? '') : '';
  document.getElementById('fQuotedPrice').value = project ? (project.quoted_price ?? '') : '';
  document.getElementById('fConfirmedPrice').value = project ? (project.confirmed_price ?? '') : '';
  document.getElementById('fDepositPaid').checked = project ? !!project.deposit_paid : false;
  document.getElementById('fBalancePaid').checked = project ? !!project.balance_paid : false;
  document.getElementById('fContractUrl').value = project ? (project.contract_url || '') : '';
  document.getElementById('fQuotePdfUrl').value = project ? (project.quote_pdf_url || '') : '';

  backdrop.classList.add('open');
  document.getElementById('fClientName').focus();
}

function closeProjectModal() {
  document.getElementById('projectModalBackdrop').classList.remove('open');
}

async function handleProjectFormSubmit(e) {
  e.preventDefault();

  const fields = {
    client_name: document.getElementById('fClientName').value.trim(),
    client_email: document.getElementById('fClientEmail').value.trim() || null,
    client_phone: document.getElementById('fClientPhone').value.trim() || null,
    package_tier: document.getElementById('fPackageTier').value.trim() || null,
    hours_booked: document.getElementById('fHoursBooked').value ? Number(document.getElementById('fHoursBooked').value) : null,
    quoted_price: document.getElementById('fQuotedPrice').value ? Number(document.getElementById('fQuotedPrice').value) : null,
    confirmed_price: document.getElementById('fConfirmedPrice').value ? Number(document.getElementById('fConfirmedPrice').value) : null,
    deposit_paid: document.getElementById('fDepositPaid').checked,
    balance_paid: document.getElementById('fBalancePaid').checked,
    contract_url: document.getElementById('fContractUrl').value.trim() || null,
    quote_pdf_url: document.getElementById('fQuotePdfUrl').value.trim() || null,
  };

  const { valid, errors } = validateProjectForm(fields);
  if (!valid) {
    document.getElementById('fClientNameError').textContent = errors.client_name || '';
    return;
  }

  const editId = document.getElementById('fId').value;
  const { error } = editId
    ? await supabase.from('projects').update(fields).eq('id', editId)
    : await supabase.from('projects').insert(fields);

  if (error) {
    showErrorToast('Could not save project — please try again.');
    return;
  }

  closeProjectModal();
}

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('projectForm').addEventListener('submit', handleProjectFormSubmit);
  document.getElementById('projectModalClose').addEventListener('click', closeProjectModal);
  document.getElementById('projectModalCancel').addEventListener('click', closeProjectModal);
  document.getElementById('projectModalBackdrop').addEventListener('click', (e) => {
    if (e.target.id === 'projectModalBackdrop') closeProjectModal();
  });
});
```

- [ ] **Step 7.2: Wire the "+ New Project" button and load the module in `board/board.js`**

Add this import near the top of `board/board.js`:

```js
import { openProjectModal } from './project-modal.js';
```

Add this line inside `init()`, after the logout handler is wired:

```js
  document.getElementById('addProjectBtn').addEventListener('click', () => openProjectModal(null));
```

Add the new script tag to `board/index.html`, right before the existing `board.js` script tag:

```html
<script type="module" src="project-modal.js"></script>
```

- [ ] **Step 7.3: Add modal styling to `board/board.css`**

Append:

```css
/* Modals (project create/edit, sub-event add/edit) */
.modal-backdrop {
  display: none; position: fixed; inset: 0; background: rgba(9,8,11,0.82);
  backdrop-filter: blur(6px); -webkit-backdrop-filter: blur(6px);
  z-index: 1000; align-items: center; justify-content: center; padding: 1.5rem;
}
.modal-backdrop.open { display: flex; }
.modal-box {
  background: #13121a; border: 1px solid rgba(201,149,107,0.2); border-radius: 10px;
  width: 100%; max-width: 620px; max-height: 90vh; overflow-y: auto; padding: 1.75rem;
}
.modal-box.modal-box-small { max-width: 400px; }
.modal-header {
  display: flex; align-items: center; justify-content: space-between; margin-bottom: 1.25rem;
}
.modal-title {
  font-family: var(--font-display); font-size: 1.5rem; font-weight: 300; color: var(--ivory);
}
.modal-close {
  background: none; border: 1px solid rgba(201,149,107,0.15); color: rgba(250,246,241,0.4);
  border-radius: 4px; width: 30px; height: 30px; cursor: pointer;
  display: flex; align-items: center; justify-content: center; transition: all 0.15s var(--ease);
}
.modal-close:hover { border-color: var(--rose); color: var(--rose); }
.modal-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 0 0.9rem; }
.modal-grid.modal-grid-single { grid-template-columns: 1fr; }
.modal-actions {
  display: flex; gap: 0.75rem; justify-content: flex-end; margin-top: 0.5rem;
}
.btn-modal-cancel {
  padding: 0.55rem 1.25rem; border: 1px solid rgba(201,149,107,0.15); border-radius: 5px;
  background: transparent; color: rgba(250,246,241,0.4); font-family: var(--font-body);
  font-size: 0.75rem; letter-spacing: 0.06em; cursor: pointer; transition: all 0.15s var(--ease);
}
.btn-modal-cancel:hover { border-color: rgba(201,149,107,0.3); color: var(--ivory); }
.btn-modal-save {
  padding: 0.55rem 1.5rem; border: 1px solid rgba(201,149,107,0.4); border-radius: 5px;
  background: rgba(201,149,107,0.12); color: var(--rose); font-family: var(--font-body);
  font-size: 0.75rem; letter-spacing: 0.06em; cursor: pointer; transition: background 0.15s var(--ease);
}
.btn-modal-save:hover { background: rgba(201,149,107,0.22); }

@media (max-width: 768px) {
  .modal-grid { grid-template-columns: 1fr; }
}
```

- [ ] **Step 7.4: Manually verify the create/edit flow**

Using the `run` skill: click "+ New Project", leave client name blank and submit — confirm the inline error appears and nothing is saved. Fill in a client name and a couple other fields, save — confirm a new card appears in the `Booked` column (via the realtime redraw from Task 5) with the right client name.

- [ ] **Step 7.5: Commit**

```bash
git add board/project-modal.js board/board.js board/board.css board/index.html
git commit -m "feat(board-ui): add create/edit project modal"
```

---

## Task 8: Detail Panel — Sub-Events Timeline

**Files:**
- Modify: `board/project-modal.js`
- Modify: `board/board.js`
- Modify: `board/board.css`

**Interfaces:**
- Consumes: `supabase` from Task 2; `formatDate`, `photoSelectionLabel` from Task 1; `showErrorToast` from `board-shared.js`; `#detailBackdrop`/`#subEventsTimeline`/`#subEventModalBackdrop`/etc. from Task 3.
- Produces: `openDetailPanel(project)`, appended to `board/project-modal.js` — consumed by `board.js`'s card-click handler in this task, and by Task 9's comment-feed code in the same file (shares the module-level `currentDetailProject` variable).

- [ ] **Step 8.1: Append the detail panel + sub-events timeline logic to `board/project-modal.js`**

Replace Task 7's `board-utils.js` import line:

```js
import { validateProjectForm } from './board-utils.js';
```

with:

```js
import { validateProjectForm, formatDate, photoSelectionLabel } from './board-utils.js';
```

(Extends the existing import statement — do not add a second, separate `import ... from './board-utils.js'` line.)

Append to the end of the file:

```js
// ---- Detail Panel ----

let currentDetailProject = null;

export async function openDetailPanel(project) {
  currentDetailProject = project;
  document.getElementById('detailClientName').textContent = project.client_name;
  document.getElementById('detailBackdrop').classList.add('open');
  await renderSubEventsTimeline();
}

function closeDetailPanel() {
  document.getElementById('detailBackdrop').classList.remove('open');
  currentDetailProject = null;
}

async function renderSubEventsTimeline() {
  const { data: subEvents, error } = await supabase
    .from('sub_events')
    .select('*')
    .eq('project_id', currentDetailProject.id)
    .order('event_date', { ascending: true, nullsFirst: false });

  const container = document.getElementById('subEventsTimeline');
  container.innerHTML = '';

  if (error) {
    showErrorToast('Could not load sub-events.');
    return;
  }

  if (subEvents.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'timeline-empty';
    empty.textContent = 'No sub-events yet.';
    container.appendChild(empty);
    return;
  }

  subEvents.forEach(se => {
    const item = document.createElement('div');
    item.className = 'timeline-item';

    const dot = document.createElement('div');
    dot.className = 'timeline-dot timeline-dot-' + se.photo_selection_status;
    item.appendChild(dot);

    const content = document.createElement('div');
    content.className = 'timeline-content';

    const name = document.createElement('div');
    name.className = 'timeline-name';
    name.textContent = se.name;
    content.appendChild(name);

    const meta = document.createElement('div');
    meta.className = 'timeline-meta';
    meta.textContent = [formatDate(se.event_date), se.venue].filter(Boolean).join(' · ');
    content.appendChild(meta);

    const selLabel = photoSelectionLabel(se.photo_selected_count, se.photo_total_count);
    if (selLabel) {
      const sel = document.createElement('div');
      sel.className = 'timeline-selection';
      sel.textContent = selLabel;
      content.appendChild(sel);
    }

    const editBtn = document.createElement('button');
    editBtn.className = 'timeline-edit-btn';
    editBtn.textContent = 'Edit';
    editBtn.addEventListener('click', () => openSubEventModal(se));
    content.appendChild(editBtn);

    item.appendChild(content);
    container.appendChild(item);
  });
}

function openSubEventModal(subEvent) {
  document.getElementById('subEventModalTitle').textContent = subEvent ? 'Edit Sub-Event' : 'New Sub-Event';
  document.getElementById('seId').value = subEvent ? subEvent.id : '';
  document.getElementById('seName').value = subEvent ? subEvent.name : '';
  document.getElementById('seDate').value = subEvent ? (subEvent.event_date || '') : '';
  document.getElementById('seVenue').value = subEvent ? (subEvent.venue || '') : '';
  document.getElementById('subEventModalBackdrop').classList.add('open');
}

function closeSubEventModal() {
  document.getElementById('subEventModalBackdrop').classList.remove('open');
}

async function handleSubEventFormSubmit(e) {
  e.preventDefault();
  const fields = {
    project_id: currentDetailProject.id,
    name: document.getElementById('seName').value.trim(),
    event_date: document.getElementById('seDate').value || null,
    venue: document.getElementById('seVenue').value.trim() || null,
  };
  const editId = document.getElementById('seId').value;

  const { error } = editId
    ? await supabase.from('sub_events').update(fields).eq('id', editId)
    : await supabase.from('sub_events').insert(fields);

  if (error) {
    showErrorToast('Could not save sub-event — please try again.');
    return;
  }

  closeSubEventModal();
  await renderSubEventsTimeline();
}

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('detailClose').addEventListener('click', closeDetailPanel);
  document.getElementById('detailBackdrop').addEventListener('click', (e) => {
    if (e.target.id === 'detailBackdrop') closeDetailPanel();
  });
  document.getElementById('addSubEventBtn').addEventListener('click', () => openSubEventModal(null));
  document.getElementById('subEventForm').addEventListener('submit', handleSubEventFormSubmit);
  document.getElementById('subEventModalClose').addEventListener('click', closeSubEventModal);
  document.getElementById('subEventModalCancel').addEventListener('click', closeSubEventModal);
});
```

- [ ] **Step 8.2: Wire card clicks to open the detail panel in `board/board.js`**

Replace Task 7's import line:

```js
import { openProjectModal } from './project-modal.js';
```

with:

```js
import { openProjectModal, openDetailPanel } from './project-modal.js';
```

(One import statement naming both functions — not a second, separate import line for the same module.)

Add this line inside `renderCard()`, right after the `dragstart` listener block:

```js
  card.addEventListener('click', () => openDetailPanel(project));
```

No drag-vs-click disambiguation logic is needed here: native HTML5 drag-and-drop already suppresses the `click` event on an element after a completed drag gesture in every evergreen browser (a `mousedown` → significant `mousemove` → `mouseup` sequence does not also fire `click`), so a real drag and a real click never both fire for the same interaction.

- [ ] **Step 8.3: Add detail panel + timeline styling to `board/board.css`**

Append:

```css
/* Detail panel */
.detail-backdrop {
  display: none; position: fixed; inset: 0; background: rgba(9,8,11,0.82);
  backdrop-filter: blur(6px); -webkit-backdrop-filter: blur(6px);
  z-index: 1000; justify-content: flex-end;
}
.detail-backdrop.open { display: flex; }
.detail-panel {
  width: 100%; max-width: 480px; height: 100vh; overflow-y: auto;
  background: #13121a; border-left: 1px solid rgba(201,149,107,0.2); padding: 1.75rem;
}
.detail-header {
  display: flex; align-items: center; justify-content: space-between; margin-bottom: 1.5rem;
}
.detail-title {
  font-family: var(--font-display); font-size: 1.6rem; font-weight: 300; color: var(--ivory);
}
.detail-close {
  background: none; border: 1px solid rgba(201,149,107,0.15); color: rgba(250,246,241,0.4);
  border-radius: 4px; width: 30px; height: 30px; cursor: pointer;
  display: flex; align-items: center; justify-content: center;
}
.detail-close:hover { border-color: var(--rose); color: var(--rose); }
.detail-section { margin-bottom: 2rem; }
.detail-section-title {
  font-size: 0.65rem; letter-spacing: 0.15em; text-transform: uppercase; color: var(--rose);
  margin-bottom: 1rem;
}

/* Sub-events timeline */
.timeline { position: relative; padding-left: 1.25rem; }
.timeline::before {
  content: ''; position: absolute; left: 4px; top: 4px; bottom: 4px; width: 1px;
  background: rgba(201,149,107,0.25);
}
.timeline-item { position: relative; margin-bottom: 1.25rem; }
.timeline-dot {
  position: absolute; left: -1.25rem; top: 4px; width: 9px; height: 9px; border-radius: 50%;
  border: 1.5px solid rgba(201,149,107,0.3); background: transparent; /* not_started: faint/hollow */
}
.timeline-dot-in_progress { border-color: var(--rose); background: transparent; } /* ring-only: full-strength border, still no fill */
.timeline-dot-complete { border-color: var(--rose); background: var(--rose); } /* solid */
.timeline-name { font-family: var(--font-display); font-size: 1rem; color: var(--ivory); }
.timeline-meta { font-size: 0.72rem; color: rgba(250,246,241,0.4); margin-top: 0.15rem; }
.timeline-selection { font-size: 0.7rem; color: var(--rose); margin-top: 0.2rem; }
.timeline-edit-btn {
  background: none; border: none; color: rgba(250,246,241,0.35); font-size: 0.68rem;
  cursor: pointer; margin-top: 0.3rem; padding: 0; text-decoration: underline;
}
.timeline-edit-btn:hover { color: var(--rose); }
.timeline-empty { color: rgba(250,246,241,0.25); font-size: 0.8rem; padding: 0.5rem 0; }
.btn-add-subevent {
  margin-top: 0.5rem; background: none; border: 1px dashed rgba(201,149,107,0.25);
  color: rgba(250,246,241,0.5); border-radius: 5px; padding: 0.45rem 0.8rem;
  font-size: 0.72rem; cursor: pointer; transition: all 0.15s var(--ease);
}
.btn-add-subevent:hover { border-color: var(--rose); color: var(--rose); }

@media (max-width: 768px) {
  .detail-panel { max-width: 100%; }
}
```

- [ ] **Step 8.4: Manually verify the timeline**

Using the `run` skill: click a project card, confirm the detail panel slides in from the right with the client name and an empty "No sub-events yet." state. Click "+ Add Sub-Event", fill in a name/date/venue, save — confirm it appears on the timeline with a hollow dot (since `photo_selection_status` defaults to `not_started`) and no selection-count label (since `photo_total_count` is 0). Confirm the corresponding card on the board now shows a real date instead of "Date TBD" after the next realtime redraw.

- [ ] **Step 8.5: Commit**

```bash
git add board/project-modal.js board/board.js board/board.css
git commit -m "feat(board-ui): add project detail panel with sub-events timeline"
```

---

## Task 9: Detail Panel — Comments & Activity Feed

**Files:**
- Modify: `board/project-modal.js`
- Modify: `board/board.css`

**Interfaces:**
- Consumes: `supabase` from Task 2; `synthesizeActivityLine` from Task 1; `showErrorToast`, `getCurrentProfile` from `board-shared.js`; `currentDetailProject` (module-level, set by Task 8's `openDetailPanel`); `#activityFeed`/`#commentForm`/etc. from Task 3.
- Produces: nothing new consumed by later tasks — this completes the detail panel.

- [ ] **Step 9.1: Append the comments/activity feed logic to `board/project-modal.js`**

Extend the two existing import lines at the top of the file (do not add new, separate `import ... from` lines for either module — each module gets exactly one import statement). Task 8's `board-utils.js` line:

```js
import { validateProjectForm, formatDate, photoSelectionLabel } from './board-utils.js';
```

becomes:

```js
import { validateProjectForm, formatDate, photoSelectionLabel, synthesizeActivityLine } from './board-utils.js';
```

Task 7's `board-shared.js` line:

```js
import { showErrorToast } from './board-shared.js';
```

becomes:

```js
import { showErrorToast, getCurrentProfile } from './board-shared.js';
```

Update `openDetailPanel` to also render the feed — change:

```js
export async function openDetailPanel(project) {
  currentDetailProject = project;
  document.getElementById('detailClientName').textContent = project.client_name;
  document.getElementById('detailBackdrop').classList.add('open');
  await renderSubEventsTimeline();
}
```

to:

```js
export async function openDetailPanel(project) {
  currentDetailProject = project;
  document.getElementById('detailClientName').textContent = project.client_name;
  document.getElementById('detailBackdrop').classList.add('open');
  await renderSubEventsTimeline();
  await renderActivityFeed();
}
```

Append to the end of the file:

```js
// ---- Activity & Comments Feed ----

async function renderActivityFeed() {
  const [{ data: comments, error: commentsError }, { data: activity, error: activityError }] = await Promise.all([
    supabase.from('comments').select('*').eq('project_id', currentDetailProject.id).order('created_at', { ascending: true }),
    supabase.from('activity_log').select('*').eq('project_id', currentDetailProject.id).order('created_at', { ascending: true }),
  ]);

  const container = document.getElementById('activityFeed');
  container.innerHTML = '';

  if (commentsError || activityError) {
    showErrorToast('Could not load activity.');
    return;
  }

  const entries = [
    ...comments.map(c => ({ type: 'comment', created_at: c.created_at, data: c })),
    ...activity.map(a => ({ type: 'activity', created_at: a.created_at, data: a })),
  ].sort((a, b) => new Date(a.created_at) - new Date(b.created_at));

  if (entries.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'feed-empty';
    empty.textContent = 'No comments yet.';
    container.appendChild(empty);
    return;
  }

  entries.forEach(entry => {
    const row = document.createElement('div');

    if (entry.type === 'comment') {
      row.className = 'feed-row feed-row-comment';

      const avatar = document.createElement('div');
      avatar.className = 'feed-avatar';
      avatar.textContent = (entry.data.author_label || '?').charAt(0).toUpperCase();
      row.appendChild(avatar);

      const content = document.createElement('div');
      content.className = 'feed-content';

      const authorLine = document.createElement('div');
      authorLine.className = 'feed-author-line';

      const authorName = document.createElement('span');
      authorName.className = 'feed-author-name';
      authorName.textContent = entry.data.author_label;
      authorLine.appendChild(authorName);

      if (entry.data.internal) {
        const tag = document.createElement('span');
        tag.className = 'feed-internal-tag';
        tag.textContent = 'Internal';
        authorLine.appendChild(tag);
      }
      content.appendChild(authorLine);

      const body = document.createElement('div');
      body.className = 'feed-body';
      body.textContent = entry.data.body;
      content.appendChild(body);

      row.appendChild(content);
    } else {
      row.className = 'feed-row feed-row-activity';

      const marker = document.createElement('div');
      marker.className = 'feed-marker';
      row.appendChild(marker);

      const text = document.createElement('div');
      text.className = 'feed-activity-text';
      text.textContent = synthesizeActivityLine(entry.data);
      row.appendChild(text);
    }

    container.appendChild(row);
  });
}

async function handleCommentSubmit(e) {
  e.preventDefault();
  const body = document.getElementById('commentBody').value.trim();
  if (!body) return;

  const internal = document.getElementById('commentInternal').checked;
  const profile = getCurrentProfile();

  const { error } = await supabase.from('comments').insert({
    project_id: currentDetailProject.id,
    author_role: profile.role,
    author_label: profile.full_name,
    body,
    internal,
  });

  if (error) {
    showErrorToast('Could not post comment — please try again.');
    return;
  }

  document.getElementById('commentBody').value = '';
  document.getElementById('commentInternal').checked = true;
  await renderActivityFeed();
}

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('commentForm').addEventListener('submit', handleCommentSubmit);
});
```

- [ ] **Step 9.2: Add feed styling to `board/board.css`**

Append:

```css
/* Activity & comments feed */
.activity-feed { display: flex; flex-direction: column; gap: 1rem; margin-bottom: 1rem; }
.feed-empty { color: rgba(250,246,241,0.25); font-size: 0.8rem; padding: 0.5rem 0; }

.feed-row-comment { display: flex; gap: 0.6rem; }
.feed-avatar {
  flex-shrink: 0; width: 28px; height: 28px; border-radius: 50%;
  border: 1px solid var(--rose); display: flex; align-items: center; justify-content: center;
  font-family: var(--font-display); font-size: 0.85rem; color: var(--rose);
}
.feed-content { flex: 1; }
.feed-author-line { display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.15rem; }
.feed-author-name { font-size: 0.78rem; color: var(--ivory); font-weight: 500; }
.feed-internal-tag {
  font-size: 0.55rem; text-transform: uppercase; letter-spacing: 0.08em;
  padding: 0.1rem 0.4rem; border-radius: 3px; background: rgba(201,149,107,0.15); color: var(--rose);
}
.feed-body { font-size: 0.78rem; color: rgba(250,246,241,0.75); line-height: 1.5; }

.feed-row-activity { display: flex; align-items: center; gap: 0.6rem; padding-left: 0.1rem; }
.feed-marker { flex-shrink: 0; width: 6px; height: 6px; border-radius: 50%; background: rgba(250,246,241,0.2); }
.feed-activity-text { font-size: 0.72rem; color: rgba(250,246,241,0.4); font-family: var(--font-body); }

/* Comment composer */
.comment-composer { display: flex; flex-direction: column; gap: 0.6rem; }
.comment-input {
  background: rgba(0,0,0,0.3); border: 1px solid rgba(201,149,107,0.15); border-radius: 5px;
  padding: 0.6rem 0.75rem; color: var(--ivory); font-family: var(--font-body); font-size: 0.8rem;
  min-height: 64px; resize: vertical; outline: none; transition: border-color 0.15s var(--ease);
}
.comment-input:focus { border-color: rgba(201,149,107,0.45); }
.comment-composer-row { display: flex; align-items: center; justify-content: space-between; }
.comment-internal-toggle {
  display: flex; align-items: center; gap: 0.4rem; font-size: 0.7rem; color: rgba(250,246,241,0.5);
}
.btn-comment-post {
  padding: 0.4rem 1rem; border: 1px solid rgba(201,149,107,0.4); border-radius: 5px;
  background: rgba(201,149,107,0.12); color: var(--rose); font-family: var(--font-body);
  font-size: 0.72rem; letter-spacing: 0.05em; cursor: pointer; transition: background 0.15s var(--ease);
}
.btn-comment-post:hover { background: rgba(201,149,107,0.22); }
```

- [ ] **Step 9.3: Manually verify the feed**

Using the `run` skill: open a project's detail panel, confirm "No comments yet." shows initially. Post a comment with "Hidden from client" left checked (the default) — confirm it appears with the "Internal" tag and your name/initial avatar. Drag that project's card to a different column, reopen the detail panel — confirm a quieter, avatar-less activity-log line appears for the stage change, correctly interleaved chronologically with the comment.

- [ ] **Step 9.4: Commit**

```bash
git add board/project-modal.js board/board.css
git commit -m "feat(board-ui): add comments and activity feed to detail panel"
```

---

## Task 10: Full Manual Verification Pass

**Files:** none (verification only; fix any real bugs found in the files above, no new files)

- [ ] **Step 10.1: Run the full unit suite**

```bash
cd "/Users/sudhakaravula/Desktop/logo/files new version  draft 1/aakaara-site-v2/.claude/worktrees/project-board-foundation"
npm run test:unit
```

Expected: all tests pass, including the new `board/test/board-utils.test.js` suite alongside every existing suite (Foundation's 37 integration tests + the 64 pre-existing unit tests + this task's ~18 new ones).

- [ ] **Step 10.2: End-to-end manual click-through via the `run` skill**

Launch the site, and walk through the complete flow in a real browser:

1. Visit `board/index.html` directly with no session — confirm redirect to `board/login.html`.
2. Log in with the wrong password — confirm the inline error shows, no redirect.
3. Log in with the real Owner credentials — confirm redirect to `board/index.html` and all 8 columns render.
4. Create a new project (client name only, everything else blank) — confirm it appears in `Booked` with "Date TBD".
5. Open its detail panel, add two sub-events with different dates — confirm the board card now shows the earlier date, and the timeline shows both in date order.
6. Drag the card to `Shoot Completed` — confirm the pending-state dim, then the move, then check `activity_log` shows the change.
7. Open the detail panel again, confirm the stage-change line appears in the activity feed.
8. Post an internal comment, then an external one (uncheck the box) — confirm both render with correct tagging.
9. Log out — confirm redirect to login and that revisiting `index.html` redirects back to login (session actually cleared).
10. Resize the browser to a mobile width — confirm columns become a horizontal-scroll strip and the detail panel remains usable.

- [ ] **Step 10.3: Report findings plainly**

Document in the task report: what was verified manually (this full list), and the explicit statement that no automated e2e/Playwright coverage exists for any of it — this is deliberate, not an oversight, per the Global Constraints. Fix any real bugs found during the walkthrough directly in the relevant task's files, re-verify the fix manually, and note the fix in the report.

- [ ] **Step 10.4: Commit any fixes**

```bash
git add -A
git status
# Confirm only expected files are staged
git commit -m "fix(board-ui): address issues found during manual verification"
```

(Skip this step entirely if no fixes were needed.)
