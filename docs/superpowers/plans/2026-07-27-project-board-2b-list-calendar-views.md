# Project Board 2b — List & Calendar Views Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a sortable List/table view and a Calendar view (every sub-event date, not one date per project) behind a three-way toggle alongside 2a's existing Kanban board, all sharing the same fetched project data.

**Architecture:** `board.js` gains a shared `currentProjects` array and a `currentView` state. A new `refreshProjects()` function centralizes fetch + staleness-guarding (replacing the generation-counter logic that used to live inside `renderBoard()`) and always ends by calling `renderActiveView()`, which dispatches to whichever of the three pure renderers (`renderBoard` for Kanban, `renderListView`, `renderCalendarView`) matches `currentView`. Switching the view toggle only calls `renderActiveView()` — no new fetch, since `currentProjects` is already loaded. `list-view.js` and `calendar-view.js` are new, fully standalone files (each a pure renderer taking the shared project array as a parameter, with no dependency on `board.js`'s internals) — they're built and reviewed first, and `board.js` only starts importing from them once they already exist, so no task ever leaves the board in a state where a script fails to load.

**Tech Stack:** Vanilla JS (ES modules), Supabase JS client (unchanged), CSS custom properties (existing root vars), Vitest for unit tests. No backend changes.

**Design spec:** `docs/superpowers/specs/2026-07-27-project-board-2b-list-calendar-views-design.md`

## Global Constraints

- No build step — plain ES modules, same as 2a.
- `board.css` reuses root `styles.css` CSS vars only — no new token names.
- `renderBoard` is no longer exported from `board.js` (nothing outside the file calls it directly anymore — `refreshProjects` is the new exported entry point `project-modal.js` uses instead).
- List and Calendar are pure renderers: they take `projects` as a parameter and never fetch data themselves — only `board.js`'s `refreshProjects()` talks to Supabase for reads.
- The List view's stage `<select>` writes via the exact same `supabase.from('projects').update({ stage })` call `handleDrop` uses, so a failed write surfaces the same `showErrorToast` pattern already established.
- **Task ordering is deliberate:** `list-view.js` and `calendar-view.js` (Tasks 2-3) are created and committed *before* anything in `board.js` or `index.html` references them (Task 4). Do not reorder — importing a not-yet-created module from `board.js` would break the entire page's script loading (a failed ES module import is not inert the way unwired HTML markup is), not just the two new views.
- No automated e2e — same documented, deliberate gap as Foundation and 2a (no Playwright browsers in this environment). Task 5 covers manual browser verification via the `run` skill.

## File Map

| Action | File | Responsibility |
|---|---|---|
| Modify | `board/board-utils.js` | Add `flattenSubEventsByMonth`, `compareProjectsByField` |
| Modify | `board/test/board-utils.test.js` | Unit tests for the two new functions |
| Create | `board/list-view.js` | `renderListView(projects)`, column sort, inline stage dropdown |
| Create | `board/calendar-view.js` | `renderCalendarView(projects)`, month nav, per-day markers |
| Modify | `board/board.js` | `currentProjects`/`currentView` state, `refreshProjects()`, `renderActiveView()`, `renderBoard()` becomes a pure renderer, view-toggle wiring |
| Modify | `board/project-modal.js` | Import/call `refreshProjects` instead of `renderBoard` |
| Modify | `board/index.html` | View-toggle buttons, `<main>` restructured into 3 sibling view containers, 2 new script tags |
| Modify | `board/board.css` | Toggle pills, view-container visibility, List table, Calendar grid |

---

## Task 1: Pure Logic + Unit Tests (TDD)

**Files:**
- Modify: `board/test/board-utils.test.js`
- Modify: `board/board-utils.js`

**Interfaces:**
- Consumes: `stageIndex`, `compareProjectsByDate` (both already exist in `board-utils.js`).
- Produces: `flattenSubEventsByMonth(projects, year, month)`, `compareProjectsByField(a, b, column)` — consumed by Task 3 and Task 2 respectively.

- [ ] **Step 1.1: Write the failing tests — append to `board/test/board-utils.test.js`**

Add these names to the existing import line at the top of the file (extend it, don't add a second `from '../board-utils.js'` line):

```js
import {
  STAGE_COLUMNS, stageIndex, stageLabel, progressSegments,
  deriveWeddingDate, formatDate, compareProjectsByDate,
  validateProjectForm, photoSelectionLabel, synthesizeActivityLine,
  flattenSubEventsByMonth, compareProjectsByField,
} from '../board-utils.js';
```

Append these describe blocks to the end of the file:

```js
describe('flattenSubEventsByMonth', () => {
  const projects = [
    { id: 'p1', client_name: 'Priya & Rohan', sub_events: [
      { name: 'Haldi', event_date: '2026-09-05' },
      { name: 'Wedding', event_date: '2026-09-12' },
    ] },
    { id: 'p2', client_name: 'Meera & Arjun', sub_events: [
      { name: 'Sangeet', event_date: '2026-10-01' },
    ] },
  ];

  it('returns only entries in the given month/year', () => {
    // September = month index 8 (JS Date months are 0-indexed)
    expect(flattenSubEventsByMonth(projects, 2026, 8)).toHaveLength(2);
  });

  it('excludes sub-events with no date', () => {
    const withUndated = [{ id: 'p3', client_name: 'X', sub_events: [{ name: 'TBD', event_date: null }] }];
    expect(flattenSubEventsByMonth(withUndated, 2026, 8)).toHaveLength(0);
  });

  it('includes the day, sub-event name, client name, and project id', () => {
    const result = flattenSubEventsByMonth(projects, 2026, 8);
    expect(result[0]).toEqual({ day: 5, subEventName: 'Haldi', clientName: 'Priya & Rohan', projectId: 'p1' });
  });

  it('returns an empty array for a month with no sub-events', () => {
    expect(flattenSubEventsByMonth(projects, 2026, 0)).toHaveLength(0);
  });

  it('handles a project with no sub_events at all', () => {
    expect(flattenSubEventsByMonth([{ id: 'p4', client_name: 'Y', sub_events: [] }], 2026, 8)).toHaveLength(0);
  });
});

describe('compareProjectsByField', () => {
  const a = {
    client_name: 'Bravo', package_tier: 'Silver', stage: 'booked',
    sub_events: [{ event_date: '2026-09-01' }],
  };
  const b = {
    client_name: 'Alpha', package_tier: 'Gold', stage: 'completed',
    sub_events: [{ event_date: '2026-08-01' }],
  };

  it('sorts by client_name alphabetically', () => {
    expect(compareProjectsByField(a, b, 'client_name')).toBeGreaterThan(0); // 'Bravo' > 'Alpha'
  });

  it('sorts by date using compareProjectsByDate', () => {
    expect(compareProjectsByField(a, b, 'date')).toBeGreaterThan(0); // Sep 2026 > Aug 2026
  });

  it('sorts by package_tier alphabetically', () => {
    expect(compareProjectsByField(a, b, 'package_tier')).toBeGreaterThan(0); // 'Silver' > 'Gold'
  });

  it('sorts by stage using pipeline order', () => {
    expect(compareProjectsByField(a, b, 'stage')).toBeLessThan(0); // booked (index 0) < completed (index 7)
  });

  it('sorts by progress identically to stage', () => {
    expect(compareProjectsByField(a, b, 'progress')).toBe(compareProjectsByField(a, b, 'stage'));
  });

  it('returns 0 for an unrecognized column', () => {
    expect(compareProjectsByField(a, b, 'nonsense')).toBe(0);
  });
});
```

- [ ] **Step 1.2: Run the tests — verify the new ones fail**

```bash
cd "/Users/sudhakaravula/Desktop/logo/files new version  draft 1/aakaara-site-v2"
npm run test:unit -- board/test/board-utils.test.js
```

Expected: the existing tests still pass; the new `flattenSubEventsByMonth`/`compareProjectsByField` tests fail with "flattenSubEventsByMonth is not a function" / "compareProjectsByField is not a function".

- [ ] **Step 1.3: Add the implementations to `board/board-utils.js`**

Append to the end of the file:

```js
export function flattenSubEventsByMonth(projects, year, month) {
  const entries = [];
  (projects || []).forEach(project => {
    (project.sub_events || []).forEach(se => {
      if (!se.event_date) return;
      const d = new Date(se.event_date + 'T00:00:00');
      if (d.getFullYear() === year && d.getMonth() === month) {
        entries.push({
          day: d.getDate(),
          subEventName: se.name,
          clientName: project.client_name,
          projectId: project.id,
        });
      }
    });
  });
  return entries;
}

export function compareProjectsByField(a, b, column) {
  if (column === 'client_name') return (a.client_name || '').localeCompare(b.client_name || '');
  if (column === 'date') return compareProjectsByDate(a, b);
  if (column === 'package_tier') return (a.package_tier || '').localeCompare(b.package_tier || '');
  if (column === 'stage' || column === 'progress') return stageIndex(a.stage) - stageIndex(b.stage);
  return 0;
}
```

- [ ] **Step 1.4: Run the tests — verify all pass**

```bash
npm run test:unit -- board/test/board-utils.test.js
```

Expected: all tests pass (34 total: the 28 existing plus these 12 new ones).

- [ ] **Step 1.5: Commit**

```bash
cd "/Users/sudhakaravula/Desktop/logo/files new version  draft 1/aakaara-site-v2/.claude/worktrees/project-board-foundation"
git add board/board-utils.js board/test/board-utils.test.js
git commit -m "feat(board-ui): add sub-event month-flattening and multi-column sort logic"
```

---

## Task 2: List View (standalone, not yet wired into the page)

**Files:**
- Create: `board/list-view.js`
- Modify: `board/board.css`

**Interfaces:**
- Consumes: `STAGE_COLUMNS`, `formatDate`, `deriveWeddingDate`, `compareProjectsByField`, `progressSegments` from `board-utils.js`; `showErrorToast` from `board-shared.js`; `openDetailPanel` from `project-modal.js`; `supabase` from `supabase-client.js`.
- Produces: `renderListView(projects)` — not imported by anything yet. Task 4 wires it into `board.js`.

This file is created and reviewed on its own — nothing in `board.js` or `index.html` references it yet, so there is no way to browser-verify it end-to-end in this task. Verification here is syntax + code-review only; full behavioral verification happens once Task 4 wires it in.

- [ ] **Step 2.1: Create `board/list-view.js`**

```js
import { supabase } from './supabase-client.js';
import {
  STAGE_COLUMNS, formatDate, deriveWeddingDate, compareProjectsByField, progressSegments,
} from './board-utils.js';
import { showErrorToast } from './board-shared.js';
import { openDetailPanel } from './project-modal.js';

let sortState = { column: null, direction: 1 };

export function renderListView(projects) {
  const container = document.getElementById('listViewContainer');
  container.innerHTML = '';

  const columns = [
    { key: 'client_name', label: 'Client Name' },
    { key: 'date', label: 'Date' },
    { key: 'package_tier', label: 'Package Tier' },
    { key: 'stage', label: 'Stage' },
    { key: 'progress', label: 'Progress' },
  ];

  const table = document.createElement('table');
  table.className = 'list-table';

  const thead = document.createElement('thead');
  const headerRow = document.createElement('tr');
  columns.forEach(col => {
    const th = document.createElement('th');
    th.textContent = col.label;
    th.addEventListener('click', () => {
      if (sortState.column === col.key) {
        sortState = { column: col.key, direction: sortState.direction * -1 };
      } else {
        sortState = { column: col.key, direction: 1 };
      }
      renderListView(projects);
    });
    headerRow.appendChild(th);
  });
  thead.appendChild(headerRow);
  table.appendChild(thead);

  const tbody = document.createElement('tbody');
  const sorted = sortState.column
    ? [...projects].sort((a, b) => sortState.direction * compareProjectsByField(a, b, sortState.column))
    : projects;

  if (sorted.length === 0) {
    const emptyRow = document.createElement('tr');
    const emptyCell = document.createElement('td');
    emptyCell.colSpan = columns.length;
    emptyCell.className = 'list-empty';
    emptyCell.textContent = 'No projects yet.';
    emptyRow.appendChild(emptyCell);
    tbody.appendChild(emptyRow);
  } else {
    sorted.forEach(project => tbody.appendChild(renderListRow(project)));
  }
  table.appendChild(tbody);
  container.appendChild(table);
}

function renderListRow(project) {
  const row = document.createElement('tr');
  row.className = 'list-row';
  row.addEventListener('click', () => openDetailPanel(project));

  const nameCell = document.createElement('td');
  nameCell.textContent = project.client_name;
  row.appendChild(nameCell);

  const dateCell = document.createElement('td');
  dateCell.textContent = formatDate(deriveWeddingDate(project.sub_events));
  row.appendChild(dateCell);

  const tierCell = document.createElement('td');
  tierCell.textContent = project.package_tier || '—';
  row.appendChild(tierCell);

  const stageCell = document.createElement('td');
  const select = document.createElement('select');
  select.className = 'list-stage-select';
  STAGE_COLUMNS.forEach(col => {
    const option = document.createElement('option');
    option.value = col.key;
    option.textContent = col.label;
    if (col.key === project.stage) option.selected = true;
    select.appendChild(option);
  });
  // Stop the click from bubbling to the row (which would open the detail
  // panel) — this covers both opening the native dropdown and selecting an
  // option, since both originate as a click on the select element itself.
  select.addEventListener('click', (e) => e.stopPropagation());
  select.addEventListener('change', async () => {
    const newStage = select.value;
    const previousStage = project.stage;
    select.disabled = true;
    const { error } = await supabase.from('projects').update({ stage: newStage }).eq('id', project.id);
    select.disabled = false;
    if (error) {
      select.value = previousStage;
      showErrorToast('Could not update stage — please try again.');
    }
    // On success, the realtime subscription's refresh reflects the change
    // (including re-sorting if the active sort column is affected) — no
    // local mutation here, consistent with the rest of the board.
  });
  stageCell.appendChild(select);
  row.appendChild(stageCell);

  const progressCell = document.createElement('td');
  const progress = progressSegments(project.stage);
  const bar = document.createElement('div');
  bar.className = 'card-progress list-progress';
  for (let i = 0; i < progress.total; i++) {
    const seg = document.createElement('span');
    seg.className = 'card-progress-segment' + (i < progress.filled ? ' filled' : '');
    bar.appendChild(seg);
  }
  progressCell.appendChild(bar);
  row.appendChild(progressCell);

  return row;
}
```

- [ ] **Step 2.2: Add List view CSS to `board/board.css`**

Append:

```css
/* List view */
.list-view-container { display: none; padding: 1.5rem 2rem; overflow-x: auto; }
.list-view-container.view-active { display: block; }
.list-table { width: 100%; border-collapse: collapse; font-size: 0.8rem; }
.list-table th {
  text-align: left; padding: 0.75rem 1rem; font-size: 0.62rem; letter-spacing: 0.1em;
  text-transform: uppercase; color: var(--rose); border-bottom: 1px solid rgba(201,149,107,0.15);
  cursor: pointer; user-select: none;
}
.list-table th:hover { color: var(--ivory); }
.list-row { cursor: pointer; transition: background 0.15s var(--ease); }
.list-row:hover { background: rgba(201,149,107,0.05); }
.list-row td { padding: 0.75rem 1rem; border-bottom: 1px solid rgba(201,149,107,0.08); color: var(--ivory); }
.list-stage-select {
  background: rgba(0,0,0,0.3); border: 1px solid rgba(201,149,107,0.15); border-radius: 5px;
  padding: 0.35rem 0.6rem; color: var(--ivory); font-family: var(--font-body); font-size: 0.75rem;
  cursor: pointer;
}
.list-progress { width: 100px; }
.list-empty { text-align: center; padding: 2rem 0; color: rgba(250,246,241,0.2); }

@media (max-width: 768px) {
  .list-view-container { padding: 1rem 1.25rem; }
}
```

Note: `.list-view-container`'s `id="listViewContainer"` element doesn't exist in `index.html` yet (Task 4 adds it) — this CSS rule is inert until then, which is fine (unused CSS selectors don't break anything, unlike a missing JS import).

- [ ] **Step 2.3: Verify syntax**

```bash
cd "/Users/sudhakaravula/Desktop/logo/files new version  draft 1/aakaara-site-v2/.claude/worktrees/project-board-foundation"
node --check board/list-view.js
```

Expected: no output (valid syntax). This cannot verify the module resolves at runtime yet, since `project-modal.js` and `board-shared.js` resolving correctly in a browser isn't something `node --check` tests — that happens in Task 4's integrated verification.

- [ ] **Step 2.4: Commit**

```bash
git add board/list-view.js board/board.css
git commit -m "feat(board-ui): add sortable List/table view (not yet wired in)"
```

---

## Task 3: Calendar View (standalone, not yet wired into the page)

**Files:**
- Create: `board/calendar-view.js`
- Modify: `board/board.css`

**Interfaces:**
- Consumes: `flattenSubEventsByMonth` from `board-utils.js`; `openDetailPanel` from `project-modal.js`.
- Produces: `renderCalendarView(projects)` — not imported by anything yet. Task 4 wires it into `board.js`.

Same situation as Task 2: standalone file, no browser verification possible until Task 4.

- [ ] **Step 3.1: Create `board/calendar-view.js`**

```js
import { flattenSubEventsByMonth } from './board-utils.js';
import { openDetailPanel } from './project-modal.js';

let currentCalendarMonth = new Date();
let cachedProjects = [];

export function renderCalendarView(projects) {
  cachedProjects = projects;
  const container = document.getElementById('calendarViewContainer');
  container.innerHTML = '';

  const header = document.createElement('div');
  header.className = 'calendar-header';

  const prevBtn = document.createElement('button');
  prevBtn.textContent = '‹';
  prevBtn.setAttribute('aria-label', 'Previous month');
  prevBtn.addEventListener('click', () => {
    currentCalendarMonth = new Date(currentCalendarMonth.getFullYear(), currentCalendarMonth.getMonth() - 1, 1);
    renderCalendarView(cachedProjects);
  });

  const monthLabel = document.createElement('div');
  monthLabel.id = 'calendarMonthYear';
  monthLabel.textContent = currentCalendarMonth.toLocaleString('default', { month: 'long', year: 'numeric' });

  const nextBtn = document.createElement('button');
  nextBtn.textContent = '›';
  nextBtn.setAttribute('aria-label', 'Next month');
  nextBtn.addEventListener('click', () => {
    currentCalendarMonth = new Date(currentCalendarMonth.getFullYear(), currentCalendarMonth.getMonth() + 1, 1);
    renderCalendarView(cachedProjects);
  });

  header.appendChild(prevBtn);
  header.appendChild(monthLabel);
  header.appendChild(nextBtn);
  container.appendChild(header);

  const weekdaysRow = document.createElement('div');
  weekdaysRow.className = 'calendar-grid';
  ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].forEach(d => {
    const wd = document.createElement('div');
    wd.className = 'calendar-weekday';
    wd.textContent = d;
    weekdaysRow.appendChild(wd);
  });
  container.appendChild(weekdaysRow);

  const daysGrid = document.createElement('div');
  daysGrid.className = 'calendar-grid';

  const year = currentCalendarMonth.getFullYear();
  const month = currentCalendarMonth.getMonth();
  const entries = flattenSubEventsByMonth(projects, year, month);
  const entriesByDay = {};
  entries.forEach(entry => {
    if (!entriesByDay[entry.day]) entriesByDay[entry.day] = [];
    entriesByDay[entry.day].push(entry);
  });

  const firstDayOfWeek = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  for (let i = 0; i < firstDayOfWeek; i++) {
    daysGrid.appendChild(document.createElement('div'));
  }

  for (let day = 1; day <= daysInMonth; day++) {
    const cell = document.createElement('div');
    cell.className = 'calendar-day';

    const dayNumber = document.createElement('div');
    dayNumber.className = 'calendar-day-number';
    dayNumber.textContent = day;
    cell.appendChild(dayNumber);

    const dayEntries = entriesByDay[day] || [];
    dayEntries.forEach(entry => {
      const marker = document.createElement('div');
      marker.className = 'calendar-marker';
      marker.addEventListener('click', () => {
        const project = projects.find(p => p.id === entry.projectId);
        if (project) openDetailPanel(project);
      });

      const tooltip = document.createElement('div');
      tooltip.className = 'tooltip';
      tooltip.textContent = `${entry.clientName} — ${entry.subEventName}`;
      marker.appendChild(tooltip);

      cell.appendChild(marker);
    });

    daysGrid.appendChild(cell);
  }

  container.appendChild(daysGrid);
}
```

- [ ] **Step 3.2: Add Calendar view CSS to `board/board.css`**

Append:

```css
/* Calendar view */
.calendar-view-container { display: none; padding: 1.5rem 2rem; }
.calendar-view-container.view-active { display: block; }
.calendar-header {
  display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;
}
.calendar-header button {
  background: none; border: 1px solid rgba(201,149,107,0.2); color: var(--rose);
  border-radius: 50%; width: 28px; height: 28px; cursor: pointer; transition: all 0.2s var(--ease);
}
.calendar-header button:hover { background: rgba(201,149,107,0.1); }
#calendarMonthYear { font-family: var(--font-display); font-size: 1.1rem; }
.calendar-grid { display: grid; grid-template-columns: repeat(7, 1fr); gap: 5px; margin-bottom: 5px; }
.calendar-weekday {
  text-align: center; font-size: 0.6rem; text-transform: uppercase; color: rgba(250,246,241,0.3);
  padding: 0.4rem 0;
}
.calendar-day {
  min-height: 70px; padding: 0.4rem; border: 1px solid rgba(201,149,107,0.08); border-radius: 4px;
  display: flex; flex-direction: column; gap: 3px;
}
.calendar-day-number { font-size: 0.7rem; color: rgba(250,246,241,0.35); }
.calendar-marker {
  position: relative; background: rgba(201,149,107,0.15); border: 1px solid rgba(201,149,107,0.35);
  border-radius: 3px; height: 6px; cursor: pointer;
}
.calendar-marker:hover { background: rgba(201,149,107,0.3); }
.calendar-marker .tooltip {
  display: none; position: absolute; bottom: 130%; left: 0; background: var(--umber);
  padding: 0.5rem 0.8rem; border-radius: 4px; font-size: 0.72rem; white-space: nowrap;
  z-index: 10; border: 1px solid rgba(201,149,107,0.2); color: var(--ivory);
}
.calendar-marker:hover .tooltip { display: block; }

@media (max-width: 768px) {
  .calendar-view-container { padding: 1rem 1.25rem; }
  .calendar-day { min-height: 50px; }
}
```

- [ ] **Step 3.3: Verify syntax**

```bash
node --check board/calendar-view.js
```

Expected: no output (valid syntax).

- [ ] **Step 3.4: Commit**

```bash
git add board/calendar-view.js board/board.css
git commit -m "feat(board-ui): add Calendar view with per-sub-event day markers (not yet wired in)"
```

---

## Task 4: Wire It All Together — View State, refreshProjects/renderActiveView, Toggle

**Files:**
- Modify: `board/board.js`
- Modify: `board/project-modal.js`
- Modify: `board/index.html`
- Modify: `board/board.css`

**Interfaces:**
- Consumes: `renderListView` from `board/list-view.js` (Task 2), `renderCalendarView` from `board/calendar-view.js` (Task 3) — both already exist by this point.
- Produces: `refreshProjects()` (exported from `board.js`, replaces the old exported `renderBoard`, consumed by `project-modal.js`).

- [ ] **Step 4.1: Replace the full contents of `board/board.js`**

```js
import { supabase } from './supabase-client.js';
import {
  STAGE_COLUMNS, SUBSTATUS_LABELS, progressSegments,
  deriveWeddingDate, formatDate, compareProjectsByDate,
} from './board-utils.js';
import { showErrorToast, setCurrentProfile } from './board-shared.js';
import {
  openProjectModal, openDetailPanel, getCurrentDetailProjectId,
  renderSubEventsTimeline, renderActivityFeed,
} from './project-modal.js';
import { renderListView } from './list-view.js';
import { renderCalendarView } from './calendar-view.js';

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
    // Do NOT synthesize a fake-but-plausible profile here — that would
    // silently mis-attribute every subsequent comment to a blank-named PM,
    // permanently, in an audit-adjacent record. Leave currentProfile at its
    // board-shared.js default (full_name: '') and disable the comment
    // composer so authorship can't be forged. handleCommentSubmit also
    // double-checks getCurrentProfile().full_name as defense in depth.
    showErrorToast('Could not load your profile — comments are disabled.');
    const commentSubmitBtn = document.querySelector('#commentForm button[type="submit"]');
    if (commentSubmitBtn) commentSubmitBtn.disabled = true;
    return null;
  }
  return data;
}

async function fetchProjects() {
  const { data, error } = await supabase
    .from('projects')
    .select('id, client_name, client_email, client_phone, stage, video_editing_substatus, package_tier, hours_booked, quoted_price, confirmed_price, deposit_paid, balance_paid, contract_url, quote_pdf_url, sub_events(id, name, event_date, venue, photo_selection_status, photo_selected_count, photo_total_count)');
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

    columnEl.addEventListener('dragover', (e) => e.preventDefault());
    columnEl.addEventListener('drop', (e) => handleDrop(e, col.key));

    container.appendChild(columnEl);
  });
}

function renderCard(project) {
  const card = document.createElement('div');
  card.className = 'project-card';
  card.dataset.id = project.id;
  card.draggable = true;
  card.addEventListener('dragstart', (e) => {
    e.dataTransfer.setData('text/plain', project.id);
  });
  card.addEventListener('click', () => openDetailPanel(project));

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

async function handleDrop(e, newStage) {
  e.preventDefault();
  const projectId = e.dataTransfer.getData('text/plain');
  const card = document.querySelector(`.project-card[data-id="${projectId}"]`);

  if (card) {
    // Same-column no-op guard: dropping a card back into the column it
    // already lives in shouldn't hit Supabase at all.
    const sourceColumn = card.closest('.board-column-cards');
    if (sourceColumn && sourceColumn.dataset.stage === newStage) return;
    card.classList.add('card-pending');
  }

  const { error } = await supabase.from('projects').update({ stage: newStage }).eq('id', projectId);

  if (error) {
    if (card) card.classList.remove('card-pending');
    showErrorToast('Could not move project — please try again.');
    return;
  }

  // On success, the realtime subscription's refresh is what normally moves
  // the card — no local DOM move happens here, per the design spec's
  // explicit no-optimistic-update decision. Safety net: if a realtime event
  // was missed, the card would otherwise stay stuck showing .card-pending
  // forever with no recovery path. Force a refresh if it's still pending
  // after a few seconds.
  setTimeout(() => {
    const stillPending = document.querySelector(`.project-card[data-id="${projectId}"].card-pending`);
    if (stillPending) refreshProjects();
  }, 3000);
}

function renderBoard() {
  STAGE_COLUMNS.forEach(col => {
    const columnCardsEl = document.querySelector(`.board-column-cards[data-stage="${col.key}"]`);
    if (!columnCardsEl) return;
    columnCardsEl.innerHTML = '';

    const columnProjects = currentProjects.filter(p => p.stage === col.key).sort(compareProjectsByDate);

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

let currentProjects = [];
let currentView = 'kanban';
let renderGeneration = 0;

function renderActiveView() {
  if (currentView === 'kanban') renderBoard();
  else if (currentView === 'list') renderListView(currentProjects);
  else if (currentView === 'calendar') renderCalendarView(currentProjects);
}

export async function refreshProjects() {
  const myGeneration = ++renderGeneration;
  const projects = await fetchProjects();
  if (myGeneration !== renderGeneration) return; // a newer refresh started while we were fetching; abandon this stale one
  currentProjects = projects;
  renderActiveView();
}

function setActiveView(view) {
  currentView = view;
  document.querySelectorAll('.view-toggle-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.view === view);
  });
  document.getElementById('boardColumns').classList.toggle('view-active', view === 'kanban');
  document.getElementById('listViewContainer').classList.toggle('view-active', view === 'list');
  document.getElementById('calendarViewContainer').classList.toggle('view-active', view === 'calendar');
  renderActiveView();
}

let realtimeChannel = null;

function subscribeToChanges() {
  realtimeChannel = supabase
    .channel('board-changes')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'projects' }, () => refreshProjects())
    .on('postgres_changes', { event: '*', schema: 'public', table: 'sub_events' }, (payload) => {
      // Sub-event dates affect card display (deriveWeddingDate) and the
      // Calendar view, so a full refresh is still needed. Additionally, if
      // the detail panel is open for the affected project, refresh its
      // timeline in place so a second person's edit shows up without
      // closing/reopening.
      refreshProjects();
      const projectId = payload.new?.project_id ?? payload.old?.project_id;
      if (projectId && getCurrentDetailProjectId() === projectId) renderSubEventsTimeline();
    })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'comments' }, (payload) => {
      // Nothing on a board card, list row, or calendar marker reads
      // comments — do NOT trigger a full refresh (that resets Kanban's
      // column scroll positions). Only the open detail panel's activity
      // feed, if any, cares about this.
      const projectId = payload.new?.project_id ?? payload.old?.project_id;
      if (projectId && getCurrentDetailProjectId() === projectId) renderActivityFeed();
    })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'activity_log' }, (payload) => {
      const projectId = payload.new?.project_id ?? payload.old?.project_id;
      if (projectId && getCurrentDetailProjectId() === projectId) renderActivityFeed();
    })
    .subscribe((status) => {
      if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        showErrorToast('Live updates disconnected — reconnecting…');
      }
    });
}

async function init() {
  // Wire up header button handlers before any network awaits below, so
  // "+ New Project" / "Log Out" / the view toggle are never visible-but-inert.
  document.getElementById('logoutBtn').addEventListener('click', async () => {
    if (realtimeChannel) supabase.removeChannel(realtimeChannel);
    await supabase.auth.signOut();
    window.location.href = 'login.html';
  });

  document.getElementById('addProjectBtn').addEventListener('click', () => openProjectModal(null));

  document.querySelectorAll('.view-toggle-btn').forEach(btn => {
    btn.addEventListener('click', () => setActiveView(btn.dataset.view));
  });

  const user = await requireSession();
  if (!user) return;

  const profile = await fetchProfile(user.id);
  if (profile) setCurrentProfile(profile);

  renderColumns();
  await refreshProjects();
  subscribeToChanges();
}

document.addEventListener('DOMContentLoaded', init);
```

- [ ] **Step 4.2: Update `board/project-modal.js`'s import and post-save call**

Replace the circular-import comment block and import line:

```js
// Circular import: board.js imports openProjectModal/openDetailPanel/etc from
// this module, and this module imports renderBoard from board.js. Safe here
// because renderBoard is a hoisted function declaration and is only invoked
// from inside an event handler (after a user submits the form), never at
// module-evaluation time — by then both modules have finished initializing.
import { renderBoard } from './board.js';
```

with:

```js
// Circular import: board.js imports openProjectModal/openDetailPanel/etc from
// this module, and this module imports refreshProjects from board.js. Safe
// here because refreshProjects is a hoisted function declaration and is only
// invoked from inside an event handler (after a user submits the form),
// never at module-evaluation time — by then both modules have finished
// initializing.
import { refreshProjects } from './board.js';
```

Replace the post-save call:

```js
  closeProjectModal();
  // Don't rely solely on the realtime redraw — if realtime is ever silently
  // down (this exact failure mode happened once before the publication was
  // fixed), a user clicking Save should still see the project appear.
  await renderBoard();
}
```

with:

```js
  closeProjectModal();
  // Don't rely solely on the realtime redraw — if realtime is ever silently
  // down (this exact failure mode happened once before the publication was
  // fixed), a user clicking Save should still see the project appear.
  // refreshProjects() (not just re-rendering) since the underlying data
  // changed and whichever view is active needs the new snapshot.
  await refreshProjects();
}
```

- [ ] **Step 4.3: Update `board/index.html`'s header and `<main>` structure**

Replace:

```html
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
```

with:

```html
  <header class="board-header">
    <div>
      <div class="brand">Aakaara Studios</div>
      <h1>Project Board</h1>
    </div>
    <div class="board-header-actions">
      <div class="view-toggle" id="viewToggle" role="group" aria-label="Board view">
        <button class="view-toggle-btn active" data-view="kanban" type="button">Kanban</button>
        <button class="view-toggle-btn" data-view="list" type="button">List</button>
        <button class="view-toggle-btn" data-view="calendar" type="button">Calendar</button>
      </div>
      <button class="board-add-btn" id="addProjectBtn">+ New Project</button>
      <button class="board-logout-btn" id="logoutBtn">Log Out</button>
    </div>
  </header>

  <main class="board-main">
    <div class="board-columns view-active" id="boardColumns"></div>
    <div class="list-view-container" id="listViewContainer"></div>
    <div class="calendar-view-container" id="calendarViewContainer"></div>
  </main>
```

- [ ] **Step 4.4: Add the two new script tags**

Replace:

```html
<script type="module" src="project-modal.js"></script>
<script type="module" src="board.js"></script>
```

with:

```html
<script type="module" src="project-modal.js"></script>
<script type="module" src="list-view.js"></script>
<script type="module" src="calendar-view.js"></script>
<script type="module" src="board.js"></script>
```

- [ ] **Step 4.5: Update `board/board.css`'s `.board-columns` rule and add view-toggle CSS**

Replace the existing `.board-columns` rule:

```css
/* Board columns */
.board-columns {
  display: flex; gap: 1rem; padding: 1.5rem 2rem; overflow-x: auto;
  align-items: flex-start;
}
```

with:

```css
/* View toggle */
.view-toggle { display: flex; gap: 0.4rem; }
.view-toggle-btn {
  padding: 0.4rem 0.85rem; border-radius: 20px; font-size: 0.65rem; letter-spacing: 0.07em;
  border: 1px solid rgba(201,149,107,0.15); color: rgba(250,246,241,0.4); background: none;
  cursor: pointer; transition: all 0.15s var(--ease); font-family: var(--font-body);
}
.view-toggle-btn:hover { border-color: rgba(201,149,107,0.35); color: var(--ivory); }
.view-toggle-btn.active {
  background: rgba(201,149,107,0.12); border-color: rgba(201,149,107,0.4); color: var(--rose);
}

/* Board columns */
.board-columns {
  display: none; gap: 1rem; padding: 1.5rem 2rem; overflow-x: auto;
  align-items: flex-start;
}
.board-columns.view-active { display: flex; }
```

- [ ] **Step 4.6: Manually verify the full toggle + all three views**

Using the `run` skill: log in, confirm Kanban is the default active view. Click "List" — confirm the table renders with the same projects, sort by each of the 5 columns in both directions, change a row's stage via the dropdown and confirm (via switching back to Kanban) the card moved to the new column, and confirm clicking a row (not the dropdown) opens the detail panel. Click "Calendar" — confirm the current month renders, add a sub-event with a date in the visible month (via the detail panel, reachable from List or Kanban) and confirm a marker appears after switching to/staying on Calendar, hover a marker for the tooltip, click it to open the detail panel, and navigate a month forward and back.

- [ ] **Step 4.7: Commit**

```bash
git add board/board.js board/project-modal.js board/index.html board/board.css
git commit -m "feat(board-ui): wire List/Calendar views into shared state and view toggle"
```

---

## Task 5: Full Manual Verification Pass

**Files:** none (verification only; fix any real bugs found in the files above)

- [ ] **Step 5.1: Run the full unit suite**

```bash
cd "/Users/sudhakaravula/Desktop/logo/files new version  draft 1/aakaara-site-v2/.claude/worktrees/project-board-foundation"
npm run test:unit
```

Expected: all tests pass, including the 12 new ones from Task 1.

- [ ] **Step 5.2: End-to-end manual click-through via the `run` skill**

1. Log in, confirm Kanban is the default active view (toggle button shows "Kanban" as active).
2. Switch to List, confirm the same projects appear; sort by each of the 5 columns in both directions.
3. Change a project's stage via the List dropdown; switch to Kanban, confirm the card is in the new column; switch to Calendar, confirm nothing about the calendar broke (stage changes don't affect calendar markers, which are date-based).
4. Switch to Calendar; add a new sub-event to a project (via its detail panel, reachable from any view) with a date in the currently-displayed month; confirm a new marker appears without needing to manually refresh (realtime `sub_events` → `refreshProjects()` → `renderActiveView()`, and since Calendar is the active view, `renderCalendarView` runs).
5. Navigate the calendar forward and back a few months; confirm no errors and correct empty months render cleanly.
6. Create a brand-new project via "+ New Project" while List view is active; confirm it appears in the list (not just Kanban) — this exercises Task 4's `refreshProjects()` fix ensuring the *active* view refreshes after a save, not just Kanban.
7. Resize to mobile width; confirm List and Calendar remain usable (no horizontal overflow breaking the layout).

- [ ] **Step 5.3: Fix any real bugs found, re-verify, report**

Fix directly in the relevant files, re-verify the specific fix manually, note it in your report. State plainly that no automated e2e/Playwright coverage exists for any of this — deliberate, per the Global Constraints, not an oversight.

- [ ] **Step 5.4: Commit any fixes**

```bash
git add -A
git status
# Confirm only expected files are staged
git commit -m "fix(board-ui): address issues found during manual verification"
```

(Skip this step entirely if no fixes were needed.)
