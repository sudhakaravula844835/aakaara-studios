# Owner/PM Project Tracker Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a read-only, 8-stage visual progress tracker to the Owner/PM project edit modal, visible only when editing an existing project (not when creating a new one).

**Architecture:** A new `.modal-section` in `board/index.html`'s project modal, hidden by default, toggled by `board/project-modal.js`'s `openProjectModal()`. A new `renderProjectTracker(project)` function (modeled on `client.js`'s function of the same name) builds the tracker DOM using the existing `STAGE_COLUMNS`/`stageIndex`/`SUBSTATUS_LABELS` utilities and the existing `.client-project-tracker`/`.client-tracker-*` CSS classes — no new CSS.

**Tech Stack:** Vanilla JS (DOM APIs, no innerHTML — matches `client.js`'s existing pattern), Vitest for tests (static file-content assertions, matching this codebase's established pattern for UI-wiring tests).

## Global Constraints

- Read-only — no click handlers, no stage-change logic. Stage still only changes via Kanban drag or List view's `<select>`.
- Hidden on project **creation**, shown only when **editing** an existing project: `projectTrackerSection.hidden = !project` inside `openProjectModal(project)`.
- Status text is exactly one of: `'Done'`, `'Not started'`, `'In Progress'`, or `` `In Progress · ${SUBSTATUS_LABELS[project.video_editing_substatus]}` `` (only when `stage === 'video_editing'` and `video_editing_substatus` is set) — no client-facing narrative copy.
- No new CSS in `board/board.css` — reuse `.client-project-tracker`, `.client-tracker-item`, `.client-tracker-done`, `.client-tracker-current`, `.client-tracker-waiting`, `.client-tracker-marker`, `.client-tracker-copy`, `.client-tracker-label`, `.client-tracker-status` exactly as they already exist (defined at `board/board.css:515-565`, used by `board/client.js`).
- No changes to `board/list-view.js`, `board/board.js`'s Kanban/drag-drop stage logic, or any RPC/SQL.

---

### Task 1: Add the tracker section markup

**Files:**
- Modify: `board/index.html:51-53`
- Test: `board/test/board-fetch-fields.test.js`

**Interfaces:**
- Produces: a `<div id="projectTrackerSection" class="modal-section" hidden>` containing an empty `<div id="projectTracker" class="client-project-tracker">`, for Task 2 to populate and toggle.

- [ ] **Step 1: Write the failing test**

Add to `board/test/board-fetch-fields.test.js` (append a new `describe` block at the end of the file):

```js
describe('Owner/PM project tracker section', () => {
  it('adds a hidden-by-default tracker section to the project modal', () => {
    expect(boardHtml).toContain('id="projectTrackerSection"');
    const match = boardHtml.match(/<div class="modal-section" id="projectTrackerSection"[^>]*>/);
    expect(match).not.toBeNull();
    expect(match[0]).toContain('hidden');
  });

  it('places an empty tracker container inside the section', () => {
    const sectionMatch = boardHtml.match(/id="projectTrackerSection"[\s\S]*?<\/div>\s*<\/div>/);
    expect(sectionMatch).not.toBeNull();
    expect(sectionMatch[0]).toContain('id="projectTracker"');
    expect(sectionMatch[0]).toContain('class="client-project-tracker"');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:unit -- board/test/board-fetch-fields.test.js`
Expected: FAIL — `projectTrackerSection` doesn't exist yet.

- [ ] **Step 3: Add the section to `board/index.html`**

Current content at lines 51-53:

```html
      <form class="modal-form" id="projectForm" novalidate>
        <input type="hidden" id="fId">
        <div class="modal-grid">
```

Replace with:

```html
      <form class="modal-form" id="projectForm" novalidate>
        <input type="hidden" id="fId">
        <div class="modal-section" id="projectTrackerSection" hidden>
          <div class="modal-section-title">Progress</div>
          <div class="client-project-tracker" id="projectTracker"></div>
        </div>
        <div class="modal-grid">
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test:unit -- board/test/board-fetch-fields.test.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add board/index.html board/test/board-fetch-fields.test.js
git commit -m "feat(board): add project tracker section to project modal"
```

---

### Task 2: Render the tracker and wire visibility

**Files:**
- Modify: `board/project-modal.js:2` (import line)
- Modify: `board/project-modal.js:130-160` (`openProjectModal`, and new functions added near it)
- Test: `board/test/board-fetch-fields.test.js`

**Interfaces:**
- Consumes: `projectTrackerSection`/`projectTracker` (from Task 1), `STAGE_COLUMNS`/`stageIndex`/`SUBSTATUS_LABELS` (existing exports from `board/board-utils.js`, already used the same way in `board/client.js:127-161`).
- Produces: nothing consumed by later tasks — this is the last task in this plan.

- [ ] **Step 1: Write the failing test**

Add to `board/test/board-fetch-fields.test.js` (append after the Task 1 `describe` block):

```js
describe('Owner/PM project tracker rendering', () => {
  const modalJs = fs.readFileSync(path.resolve(__dirname, '../project-modal.js'), 'utf8');

  it('imports the stage utilities needed to render the tracker', () => {
    expect(modalJs).toMatch(/STAGE_COLUMNS/);
    expect(modalJs).toMatch(/stageIndex/);
    expect(modalJs).toMatch(/SUBSTATUS_LABELS/);
  });

  it('defines a renderProjectTracker function', () => {
    expect(modalJs).toMatch(/function renderProjectTracker\(/);
  });

  it('uses plain operational status labels, not narrative copy', () => {
    expect(modalJs).toContain("'Done'");
    expect(modalJs).toContain("'Not started'");
    expect(modalJs).toContain('In Progress');
  });

  it('toggles the tracker section based on whether a project was passed to openProjectModal', () => {
    const openFnMatch = modalJs.match(/export async function openProjectModal\(project\)[\s\S]*?\n}/);
    expect(openFnMatch).not.toBeNull();
    expect(openFnMatch[0]).toMatch(/projectTrackerSection['"]\)\.hidden\s*=\s*!project/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:unit -- board/test/board-fetch-fields.test.js`
Expected: FAIL on all four new assertions in this block.

- [ ] **Step 3: Add the stage utilities to the existing import**

Current content at `board/project-modal.js:2-5`:

```js
import {
  validateProjectForm, validateSubEventForm, formatDate,
  photoSelectionLabel, synthesizeActivityLine,
} from './board-utils.js';
```

Replace with:

```js
import {
  validateProjectForm, validateSubEventForm, formatDate,
  photoSelectionLabel, synthesizeActivityLine,
  STAGE_COLUMNS, SUBSTATUS_LABELS, stageIndex,
} from './board-utils.js';
```

- [ ] **Step 4: Add `renderProjectTracker` and `trackerStatusText` functions**

Current content at `board/project-modal.js:126-133` (the end of the editor-assignment sync helper, right before `openProjectModal`):

```js
export async function openProjectModal(project) {
  const backdrop = document.getElementById('projectModalBackdrop');
  const form = document.getElementById('projectForm');
  form.reset();
```

Replace with:

```js
function trackerStatusText(stageKey, state, project) {
  if (state === 'done') return 'Done';
  if (state === 'waiting') return 'Not started';
  if (stageKey === 'video_editing' && project.video_editing_substatus) {
    return `In Progress · ${SUBSTATUS_LABELS[project.video_editing_substatus]}`;
  }
  return 'In Progress';
}

function renderProjectTracker(project) {
  const tracker = document.createElement('div');
  tracker.setAttribute('aria-label', 'Project stage tracker');

  const currentIndex = Math.max(stageIndex(project.stage), 0);
  STAGE_COLUMNS.forEach((stage, index) => {
    const item = document.createElement('div');
    const state = index < currentIndex ? 'done' : index === currentIndex ? 'current' : 'waiting';
    item.className = `client-tracker-item client-tracker-${state}`;

    const marker = document.createElement('div');
    marker.className = 'client-tracker-marker';
    marker.textContent = state === 'done' ? '✓' : String(index + 1);
    item.appendChild(marker);

    const copy = document.createElement('div');
    copy.className = 'client-tracker-copy';

    const label = document.createElement('div');
    label.className = 'client-tracker-label';
    label.textContent = stage.label;
    copy.appendChild(label);

    const status = document.createElement('div');
    status.className = 'client-tracker-status';
    status.textContent = trackerStatusText(stage.key, state, project);
    copy.appendChild(status);

    item.appendChild(copy);
    tracker.appendChild(item);
  });

  return tracker;
}

export async function openProjectModal(project) {
  const backdrop = document.getElementById('projectModalBackdrop');
  const form = document.getElementById('projectForm');
  form.reset();
```

- [ ] **Step 5: Wire the tracker into `openProjectModal`**

Current content at `board/project-modal.js:151-156` (immediately after the last form-field assignment, before `populateAssignmentFields`):

```js
  document.getElementById('fFirstSubEventName').value = '';
  document.getElementById('fFirstSubEventDate').value = '';
  document.getElementById('fFirstSubEventVenue').value = '';

  await populateAssignmentFields(project);
```

Replace with:

```js
  document.getElementById('fFirstSubEventName').value = '';
  document.getElementById('fFirstSubEventDate').value = '';
  document.getElementById('fFirstSubEventVenue').value = '';

  document.getElementById('projectTrackerSection').hidden = !project;
  const trackerContainer = document.getElementById('projectTracker');
  trackerContainer.textContent = '';
  if (project) {
    trackerContainer.appendChild(renderProjectTracker(project));
  }

  await populateAssignmentFields(project);
```

(Clearing `trackerContainer.textContent` before conditionally re-populating means reopening the modal for a *different* project never leaves a stale previous tracker rendered underneath, and reopening for *creation* after previously editing leaves the container correctly empty while hidden.)

- [ ] **Step 6: Run test to verify it passes**

Run: `npm run test:unit -- board/test/board-fetch-fields.test.js`
Expected: PASS — all tests in the file, including the pre-existing ones and Task 1's, green.

- [ ] **Step 7: Run the full unit suite once to confirm no regressions**

Run: `npm run test:unit -- board/test`
Expected: PASS. Note: the full-repo `npm run test:unit` (all files, not just `board/test`) is known to be flaky under concurrent load against the live Supabase project per the CRM security audit — prefer the scoped `-- board/test` run for a reliable signal, and re-run once if a failure looks like an unrelated timeout rather than an assertion failure.

- [ ] **Step 8: Commit**

```bash
git add board/project-modal.js board/test/board-fetch-fields.test.js
git commit -m "feat(board): render Owner/PM project tracker in project modal"
```

---

## Manual Verification (not covered by the static file-content tests above)

1. Run the board locally, click "+ New Project" — confirm the Progress section does **not** appear anywhere in the create form.
2. Open an existing project for editing (any stage) — confirm the Progress section appears above the field grid, showing all 8 stages with the correct one marked current, correct ones marked done (checkmark) vs not started.
3. Open a project specifically in the `video_editing` stage with a `video_editing_substatus` set — confirm that stage's status text reads `In Progress · <Substatus Label>` (e.g. `In Progress · Client Review`), not just `In Progress`.
4. Close the modal, open a *different* project for editing — confirm the tracker updates to that project's stage, with no leftover state from the previous project.
5. Visually compare against the client portal's tracker (`board/client.html?token=<a real token>`) — confirm the two look visually consistent (same grid, same marker/color treatment) even though the status text differs.
