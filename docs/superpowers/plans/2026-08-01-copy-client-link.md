# Copy Client Link Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "Copy Client Link" button to the Owner/PM project detail panel that copies that project's client-portal URL to the clipboard.

**Architecture:** A new button in the existing detail-panel header, wired to a click handler in `board/project-modal.js` that fetches just that project's `client_access_token` on demand (a dedicated one-row query, not the bulk board list), builds the client-portal URL, and writes it to the clipboard via the Clipboard API. No backend or schema change.

**Tech Stack:** Vanilla JS, Supabase JS client (`@supabase/supabase-js`), Vitest for tests (static assertions on file contents, matching this codebase's existing pattern for UI-wiring tests — no live Supabase call needed for this feature).

## Global Constraints

- Link format is exactly `https://aakaarastudiosnyc.com/board/client.html?token=<token>` — spec decision, not a placeholder.
- `board/board.js`'s `fetchProjects()` select list must NOT change — an existing test (`board/test/board-fetch-fields.test.js`) asserts `client_access_token` is absent from it, and that assertion must keep passing unmodified.
- The button stays active regardless of `token_revoked` — no conditional disabling logic.
- Toast copy: `'Client link copied.'` on success, `'Could not copy link.'` on any failure (fetch error or clipboard-write error) — use the existing `showSuccessToast`/`showErrorToast` helpers from `board/board-shared.js`, do not introduce new toast styling.
- No changes to `regenerate_client_token`, `editor.js`, `editor.html`, or the client portal itself — out of scope per spec.

---

### Task 1: Add the button markup and styling

**Files:**
- Modify: `board/index.html:138-141`
- Modify: `board/board.css:244-249`
- Test: `board/test/board-fetch-fields.test.js`

**Interfaces:**
- Produces: a button element `id="detailCopyLinkBtn"` inside `.detail-header-actions`, for Task 2 to attach a listener to.

- [ ] **Step 1: Write the failing test**

Add to `board/test/board-fetch-fields.test.js` (append a new `describe` block at the end of the file):

```js
describe('Copy Client Link button', () => {
  it('adds a Copy Client Link button to the detail panel header actions', () => {
    expect(boardHtml).toContain('id="detailCopyLinkBtn"');
  });

  it('places it inside .detail-header-actions, alongside Edit and Close', () => {
    const match = boardHtml.match(/<div class="detail-header-actions">([\s\S]*?)<\/div>/);
    expect(match).not.toBeNull();
    expect(match[1]).toContain('id="detailCopyLinkBtn"');
    expect(match[1]).toContain('id="detailEditBtn"');
    expect(match[1]).toContain('id="detailClose"');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:unit -- board/test/board-fetch-fields.test.js`
Expected: FAIL — both new assertions fail because `detailCopyLinkBtn` doesn't exist yet.

- [ ] **Step 3: Add the button to `board/index.html`**

Current content at lines 138-141:

```html
        <div class="detail-header-actions">
          <button class="detail-edit" id="detailEditBtn" aria-label="Edit project">Edit</button>
          <button class="detail-close" id="detailClose" aria-label="Close">&times;</button>
        </div>
```

Replace with:

```html
        <div class="detail-header-actions">
          <button class="detail-copy-link" id="detailCopyLinkBtn" aria-label="Copy client link">Copy Client Link</button>
          <button class="detail-edit" id="detailEditBtn" aria-label="Edit project">Edit</button>
          <button class="detail-close" id="detailClose" aria-label="Close">&times;</button>
        </div>
```

- [ ] **Step 4: Add matching styles to `board/board.css`**

Current content at lines 244-249:

```css
.detail-edit {
  background: none; border: 1px solid rgba(201,149,107,0.15); color: rgba(250,246,241,0.4);
  border-radius: 4px; height: 30px; padding: 0 0.65rem; cursor: pointer;
  display: flex; align-items: center; justify-content: center; font-size: 0.7rem;
}
.detail-edit:hover { border-color: var(--rose); color: var(--rose); }
```

Insert a new rule directly above `.detail-edit`, matching its shape exactly:

```css
.detail-copy-link {
  background: none; border: 1px solid rgba(201,149,107,0.15); color: rgba(250,246,241,0.4);
  border-radius: 4px; height: 30px; padding: 0 0.65rem; cursor: pointer;
  display: flex; align-items: center; justify-content: center; font-size: 0.7rem;
  white-space: nowrap;
}
.detail-copy-link:hover { border-color: var(--rose); color: var(--rose); }
.detail-edit {
  background: none; border: 1px solid rgba(201,149,107,0.15); color: rgba(250,246,241,0.4);
  border-radius: 4px; height: 30px; padding: 0 0.65rem; cursor: pointer;
  display: flex; align-items: center; justify-content: center; font-size: 0.7rem;
}
.detail-edit:hover { border-color: var(--rose); color: var(--rose); }
```

(`white-space: nowrap` is the one addition beyond copying `.detail-edit` verbatim — "Copy Client Link" is longer than "Edit" and shouldn't wrap inside the fixed-height button.)

- [ ] **Step 5: Run test to verify it passes**

Run: `npm run test:unit -- board/test/board-fetch-fields.test.js`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add board/index.html board/board.css board/test/board-fetch-fields.test.js
git commit -m "feat(board): add Copy Client Link button to project detail panel"
```

---

### Task 2: Wire the click handler

**Files:**
- Modify: `board/project-modal.js:6` (import line)
- Modify: `board/project-modal.js:417-419` (add function + wire listener)
- Test: `board/test/board-fetch-fields.test.js`

**Interfaces:**
- Consumes: `detailCopyLinkBtn` (from Task 1), `currentDetailProject` (existing module-level variable in `project-modal.js`, already holds `{ id, client_name, ... }` for whichever project's detail panel is open), `supabase` (existing import), `showErrorToast`/`showSuccessToast` (from `board/board-shared.js`).
- Produces: nothing consumed by later tasks — this is the last task in this plan.

- [ ] **Step 1: Write the failing test**

Add to `board/test/board-fetch-fields.test.js` (append after the Task 1 `describe` block):

```js
describe('Copy Client Link wiring', () => {
  const modalJs = fs.readFileSync(path.resolve(__dirname, '../project-modal.js'), 'utf8');

  it('still keeps client_access_token out of the bulk fetchProjects() select (regression guard)', () => {
    expect(fetchProjectsSelectArg()).not.toMatch(/\bclient_access_token\b/);
  });

  it('wires a click listener on detailCopyLinkBtn', () => {
    expect(modalJs).toMatch(/detailCopyLinkBtn['"]\)\.addEventListener\(\s*['"]click['"]/);
  });

  it('fetches client_access_token by id rather than through fetchProjects()', () => {
    expect(modalJs).toMatch(/\.select\(['"]client_access_token['"]\)/);
  });

  it('builds a client.html?token= URL and copies it to the clipboard', () => {
    expect(modalJs).toContain('board/client.html?token=');
    expect(modalJs).toContain('navigator.clipboard.writeText');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:unit -- board/test/board-fetch-fields.test.js`
Expected: FAIL on the three new "wiring"/"fetches"/"builds" assertions (the regression-guard test already passes, since it's checking `board.js`, untouched so far).

- [ ] **Step 3: Add `showSuccessToast` to the existing import**

Current content at `board/project-modal.js:6`:

```js
import { showErrorToast, getCurrentProfile } from './board-shared.js';
```

Replace with:

```js
import { showErrorToast, showSuccessToast, getCurrentProfile } from './board-shared.js';
```

- [ ] **Step 4: Add the `copyClientLink` function**

Current content at `board/project-modal.js:414-419`:

```js
  closeSubEventModal();
  await renderSubEventsTimeline();
}

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('detailClose').addEventListener('click', closeDetailPanel);
```

Replace with:

```js
  closeSubEventModal();
  await renderSubEventsTimeline();
}

async function copyClientLink() {
  if (!currentDetailProject) return;

  const { data, error } = await supabase
    .from('projects')
    .select('client_access_token')
    .eq('id', currentDetailProject.id)
    .single();

  if (error || !data) {
    showErrorToast('Could not copy link.');
    return;
  }

  const url = `https://aakaarastudiosnyc.com/board/client.html?token=${data.client_access_token}`;

  try {
    await navigator.clipboard.writeText(url);
    showSuccessToast('Client link copied.');
  } catch {
    showErrorToast('Could not copy link.');
  }
}

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('detailCopyLinkBtn').addEventListener('click', copyClientLink);
  document.getElementById('detailClose').addEventListener('click', closeDetailPanel);
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npm run test:unit -- board/test/board-fetch-fields.test.js`
Expected: PASS — all tests in the file, including the pre-existing ones, green.

- [ ] **Step 6: Run the full unit suite once to confirm no regressions**

Run: `npm run test:unit -- board/test`
Expected: PASS (same count as before this plan started, plus the 5 new assertions added across Tasks 1-2). Note: the full-repo `npm run test:unit` (all files, not just `board/test`) is known to be flaky under concurrent load against the live Supabase project per the CRM security audit — prefer the scoped `-- board/test` run for a reliable signal, and re-run once if a failure looks like an unrelated timeout rather than an assertion failure.

- [ ] **Step 7: Commit**

```bash
git add board/project-modal.js board/test/board-fetch-fields.test.js
git commit -m "feat(board): wire Copy Client Link to an on-demand token fetch"
```

---

## Manual Verification (not covered by the static file-content tests above)

These tests confirm the code exists and is wired correctly, but don't execute it in a browser. Before considering this done:

1. Run the board locally, open a real (or test) project's detail panel, click "Copy Client Link."
2. Paste the clipboard contents somewhere — confirm it's `https://aakaarastudiosnyc.com/board/client.html?token=<a real uuid>`, and that the uuid matches that project's `client_access_token` in the database.
3. Confirm the success toast reads "Client link copied."
4. Open the pasted URL in a new tab (or the client portal locally with that token) and confirm it loads that same project.
