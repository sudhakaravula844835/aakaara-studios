# Project Board 4 — Editor's Own Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give Editors a working dashboard — a list of their assigned projects and a detail view where they can advance video-editing status, confirm song licenses, and post comments — using the Editor backend Foundation already built and never had a UI for.

**Architecture:** Two new files (`board/editor.html`, `board/editor.js`) mirroring the Owner/PM board's shape but standalone — no shared code with `board.js`/`project-modal.js` beyond the pure helpers in `board-utils.js` and the toast helper in `board-shared.js`. `board/login.js` gains a role-based redirect (Editor → `editor.html`, everyone else → `index.html`).

**Tech Stack:** Vanilla JS ES modules (browser), Supabase JS client v2 (already-existing RPCs and views), Supabase Realtime.

## Global Constraints

- No build step — plain ES modules, matching every existing `board/*.js` file.
- No backend/RPC/RLS changes — this sub-project is UI only, against `editor_project_view`, `update_editing_status`, `set_song_license`, and `post_comment`, all already built and tested in Foundation (`board/test/editor-access.test.js`).
- Editor comments never get an internal/external toggle — `post_comment` always inserts `internal = false` (unchanged); the comment composer has no checkbox for it.
- Match existing conventions exactly: `showErrorToast` (from `board-shared.js`) for user-facing errors, the null-vs-`[]` fetch-failure distinction already used in `board.js`'s `fetchProjects`, no optimistic UI updates, the entry-point-guard + post-await-guard race-condition pattern already used in `project-modal.js`'s `renderSubEventsTimeline`/`renderActivityFeed` for any render function that awaits before touching `currentDetailProject`-scoped DOM.
- Reuse existing `board.css` classes (`.list-table`, `.list-empty`, `.detail-backdrop`, `.detail-panel`, `.timeline`, `.activity-feed`, `.comment-composer`, `.form-input`) rather than introducing a new visual language. New classes are additive only, for elements with no existing equivalent (the songs list).
- Editors have no RLS write grant on `sub_events`, `songs` (insert), or `projects` directly — the sub-events timeline is read-only (no Edit/Delete/Add buttons), and there is no "add song" control.

---

### Task 1: Role-Based Login Redirect

**Files:**
- Modify: `board/login.js`

**Interfaces:**
- Consumes: `profiles.role`, `profiles.active` (unchanged, from Foundation/2c).
- Produces: nothing consumed by later tasks — `editor.html` doesn't need to exist yet for this task's own testing (redirecting to a 404 for a nonexistent `editor.html` is fine to observe during this task; Task 2 makes the target real).

- [ ] **Step 1: Replace the full contents of `board/login.js`**

```javascript
import { supabase } from './supabase-client.js';

async function redirectForRole(userId) {
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', userId)
    .single();
  window.location.href = profile && profile.role === 'editor' ? 'editor.html' : 'index.html';
}

document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('loginForm');
  const errorEl = document.getElementById('loginError');

  supabase.auth.getSession().then(({ data }) => {
    if (data.session) redirectForRole(data.session.user.id);
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    errorEl.textContent = '';

    const email = document.getElementById('lEmail').value.trim();
    const password = document.getElementById('lPassword').value;

    const { data: signInData, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      errorEl.textContent = 'Incorrect email or password.';
      return;
    }

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role, active')
      .eq('id', signInData.user.id)
      .single();

    // A failed profile fetch here doesn't block login -- this check is a UX
    // nicety on top of the real boundary (current_profile_role() returning
    // null for a deactivated user), which already blocks every RLS-gated
    // read/write regardless of whether this check ever runs.
    if (!profileError && profile && profile.active === false) {
      await supabase.auth.signOut();
      errorEl.textContent = 'Your access has been revoked. Contact the studio owner.';
      return;
    }

    window.location.href = (!profileError && profile && profile.role === 'editor') ? 'editor.html' : 'index.html';
  });
});
```

- [ ] **Step 2: Run the full unit suite to confirm no regression**

Run: `npm run test:unit`
Expected: PASS (this task adds no new pure functions/unit tests — DOM wiring, verified manually in Task 7).

- [ ] **Step 3: Commit**

```bash
git add board/login.js
git commit -m "feat(board): redirect Editor accounts to editor.html on login"
```

---

### Task 2: Editor Dashboard Shell — Page Markup + Project List

**Files:**
- Create: `board/editor.html`
- Create: `board/editor.js`
- Modify: `board/board.css`

**Interfaces:**
- Consumes: `formatDate`, `deriveWeddingDate`, `stageLabel`, `SUBSTATUS_LABELS` from `board-utils.js`; `showErrorToast` from `board-shared.js`.
- Produces: `editor.html`'s full markup (all sections, including the detail panel skeleton every later task fills in — songs list, substatus control, activity feed are present as empty containers now so later tasks only touch `editor.js`, not `editor.html`, again). `editor.js`'s module-level state (`currentProjects`, `currentDetailProject`, `renderGeneration`, `realtimeChannel`) and `getCurrentDetailProjectId()`, `refreshProjects()`, `openProjectDetail(project)`, `closeProjectDetail()` — every later task's functions read/write this same state and call these same functions.

- [ ] **Step 1: Create `board/editor.html`**

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>My Projects — Aakaara Studios</title>
  <link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@300;400&family=Outfit:wght@200;300;400;500&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="../styles.css">
  <link rel="stylesheet" href="board.css">
</head>
<body>

  <header class="board-header">
    <div>
      <div class="brand">Aakaara Studios</div>
      <h1>My Projects</h1>
    </div>
    <div class="board-header-actions">
      <button class="board-logout-btn" id="logoutBtn">Log Out</button>
    </div>
  </header>

  <main class="board-main">
    <div class="list-view-container view-active" id="editorProjectListContainer"></div>
  </main>

  <div class="toast-container" id="toastContainer"></div>

  <!-- Project Detail Panel -->
  <div class="detail-backdrop" id="detailBackdrop">
    <div class="detail-panel" role="dialog" aria-modal="true" aria-labelledby="detailClientName">
      <div class="detail-header">
        <div class="detail-title" id="detailClientName"></div>
        <div class="detail-header-actions">
          <button class="detail-close" id="detailClose" aria-label="Close">&times;</button>
        </div>
      </div>

      <section class="detail-section">
        <div class="detail-section-title">Sub-Events</div>
        <div class="timeline" id="subEventsTimeline"></div>
      </section>

      <section class="detail-section">
        <div class="detail-section-title">Video Editing Status</div>
        <select class="form-input" id="substatusSelect"></select>
        <div class="substatus-note" id="substatusNote"></div>
      </section>

      <section class="detail-section">
        <div class="detail-section-title">Songs</div>
        <div class="songs-list" id="songsList"></div>
      </section>

      <section class="detail-section">
        <div class="detail-section-title">Activity &amp; Notes</div>
        <div class="activity-feed" id="activityFeed"></div>
        <form class="comment-composer" id="commentForm">
          <textarea class="comment-input" id="commentBody" placeholder="Add a note&hellip;" required></textarea>
          <div class="comment-composer-row">
            <button type="submit" class="btn-comment-post">Post</button>
          </div>
        </form>
      </section>
    </div>
  </div>

<script type="module" src="editor.js"></script>
</body>
</html>
```

- [ ] **Step 2: Create `board/editor.js`**

```javascript
import { supabase } from './supabase-client.js';
import {
  formatDate, deriveWeddingDate, stageLabel, SUBSTATUS_LABELS,
} from './board-utils.js';
import { showErrorToast } from './board-shared.js';

let currentProjects = [];
let currentDetailProject = null;
let renderGeneration = 0;
let realtimeChannel = null;

export function getCurrentDetailProjectId() {
  return currentDetailProject?.id ?? null;
}

async function fetchAssignedProjects() {
  const { data, error } = await supabase
    .from('editor_project_view')
    .select('*, sub_events(id, name, event_date, venue)');
  if (error) {
    showErrorToast('Could not load your projects.');
    // null (not []) signals "fetch failed" distinctly from "fetch succeeded
    // with zero rows" -- refreshProjects() below relies on this distinction
    // to avoid blanking the list on a transient network blip, same pattern
    // as board.js's fetchProjects().
    return null;
  }
  return data;
}

function renderProjectRow(project) {
  const row = document.createElement('tr');
  row.className = 'list-row';
  row.addEventListener('click', () => openProjectDetail(project));

  const nameCell = document.createElement('td');
  nameCell.textContent = project.client_name;
  row.appendChild(nameCell);

  const dateCell = document.createElement('td');
  dateCell.textContent = formatDate(deriveWeddingDate(project.sub_events));
  row.appendChild(dateCell);

  const stageCell = document.createElement('td');
  stageCell.textContent = stageLabel(project.stage);
  row.appendChild(stageCell);

  const substatusCell = document.createElement('td');
  substatusCell.textContent = (project.stage === 'video_editing' && project.video_editing_substatus)
    ? (SUBSTATUS_LABELS[project.video_editing_substatus] || project.video_editing_substatus)
    : '—';
  row.appendChild(substatusCell);

  return row;
}

function renderProjectList() {
  const container = document.getElementById('editorProjectListContainer');
  container.innerHTML = '';

  const table = document.createElement('table');
  table.className = 'list-table';

  const thead = document.createElement('thead');
  const headerRow = document.createElement('tr');
  ['Client Name', 'Date', 'Stage', 'Video Editing Status'].forEach(label => {
    const th = document.createElement('th');
    th.textContent = label;
    headerRow.appendChild(th);
  });
  thead.appendChild(headerRow);
  table.appendChild(thead);

  const tbody = document.createElement('tbody');
  if (currentProjects.length === 0) {
    const emptyRow = document.createElement('tr');
    const emptyCell = document.createElement('td');
    emptyCell.colSpan = 4;
    emptyCell.className = 'list-empty';
    emptyCell.textContent = 'No projects assigned yet.';
    emptyRow.appendChild(emptyCell);
    tbody.appendChild(emptyRow);
  } else {
    currentProjects.forEach(project => tbody.appendChild(renderProjectRow(project)));
  }
  table.appendChild(tbody);
  container.appendChild(table);
}

async function refreshProjects() {
  const myGeneration = ++renderGeneration;
  const projects = await fetchAssignedProjects();
  if (myGeneration !== renderGeneration) return; // a newer refresh started while we were fetching; abandon this stale one
  if (projects === null) return;
  currentProjects = projects;
  renderProjectList();
}

async function openProjectDetail(project) {
  currentDetailProject = project;
  document.getElementById('detailClientName').textContent = project.client_name;
  document.getElementById('detailBackdrop').classList.add('open');
}

function closeProjectDetail() {
  document.getElementById('detailBackdrop').classList.remove('open');
  currentDetailProject = null;
}

async function requireSession() {
  const { data } = await supabase.auth.getSession();
  if (!data.session) {
    window.location.href = 'login.html';
    return null;
  }
  return data.session.user;
}

async function init() {
  // Wire up header/detail-panel handlers before any network awaits below,
  // so "Log Out" and the detail panel's close controls are never
  // visible-but-inert (same reasoning as board.js's init()).
  document.getElementById('logoutBtn').addEventListener('click', async () => {
    if (realtimeChannel) supabase.removeChannel(realtimeChannel);
    await supabase.auth.signOut();
    window.location.href = 'login.html';
  });
  document.getElementById('detailClose').addEventListener('click', closeProjectDetail);
  document.getElementById('detailBackdrop').addEventListener('click', (e) => {
    if (e.target.id === 'detailBackdrop') closeProjectDetail();
  });

  const user = await requireSession();
  if (!user) return;

  const { data: profile, error } = await supabase
    .from('profiles')
    .select('active')
    .eq('id', user.id)
    .single();

  // Same reasoning as board.js's init(): a deactivated user whose session is
  // still valid would otherwise sit on an empty list indefinitely with every
  // RLS-gated read returning nothing and no explanation. Eject them to a
  // clean login screen.
  if (!error && profile && profile.active === false) {
    await supabase.auth.signOut();
    window.location.href = 'login.html';
    return;
  }

  await refreshProjects();
}

document.addEventListener('DOMContentLoaded', init);
```

- [ ] **Step 3: Add editor-dashboard-specific styles to `board/board.css`**

Append to `board/board.css`:

```css
/* Editor dashboard: songs list */
.songs-list { display: flex; flex-direction: column; }
.song-row { padding: 0.75rem 0; border-bottom: 1px solid rgba(201,149,107,0.08); }
.song-title { font-size: 0.85rem; color: var(--ivory); margin-bottom: 0.35rem; }
.song-license-toggle { display: flex; align-items: center; gap: 0.5rem; font-size: 0.75rem; color: rgba(250,246,241,0.6); cursor: pointer; }

/* Editor dashboard: video-editing substatus control */
.substatus-note { font-size: 0.7rem; color: rgba(250,246,241,0.35); margin-top: 0.4rem; }
```

- [ ] **Step 4: Run the full unit suite to confirm no regression**

Run: `npm run test:unit`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add board/editor.html board/editor.js board/board.css
git commit -m "feat(board): add Editor dashboard shell (project list, detail panel skeleton)"
```

---

### Task 3: Sub-Events Timeline (Read-Only)

**Files:**
- Modify: `board/editor.js`

**Interfaces:**
- Consumes: `currentDetailProject`, `getCurrentDetailProjectId()` from Task 2. `formatDate` from `board-utils.js`.
- Produces: `renderSubEventsTimeline()`, called by `openProjectDetail` (modified in this task) and by Task 6's realtime `sub_events` handler.

- [ ] **Step 1: Add `renderSubEventsTimeline` to `board/editor.js`**

Add this function (place it above `openProjectDetail`):

```javascript
async function renderSubEventsTimeline() {
  // Capture the project this call is rendering for *before* the await --
  // currentDetailProject may be reassigned (panel closed -> null, or
  // switched to another project) while the fetch below is in flight. Same
  // guard pattern as project-modal.js's renderSubEventsTimeline.
  const requestedProject = currentDetailProject;
  if (!requestedProject) return;
  const { data: subEvents, error } = await supabase
    .from('sub_events')
    .select('*')
    .eq('project_id', requestedProject.id)
    .order('event_date', { ascending: true, nullsFirst: false });

  if (!currentDetailProject || currentDetailProject.id !== requestedProject.id) return;

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

    item.appendChild(content);
    container.appendChild(item);
  });
}
```

- [ ] **Step 2: Wire it into `openProjectDetail`**

Modify `openProjectDetail` (from Task 2):

```javascript
async function openProjectDetail(project) {
  currentDetailProject = project;
  document.getElementById('detailClientName').textContent = project.client_name;
  document.getElementById('detailBackdrop').classList.add('open');
  await renderSubEventsTimeline();
}
```

- [ ] **Step 3: Run the full unit suite to confirm no regression**

Run: `npm run test:unit`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add board/editor.js
git commit -m "feat(board): render read-only sub-events timeline in Editor detail panel"
```

---

### Task 4: Video-Editing Substatus Control

**Files:**
- Modify: `board/editor.js`

**Interfaces:**
- Consumes: `currentDetailProject` from Task 2.
- Produces: `renderSubstatusControl()`, called by `openProjectDetail` (modified in this task) and by Task 6's realtime `projects` handler (to reflect a stage change made elsewhere without the Editor closing/reopening the panel).

- [ ] **Step 1: Add `renderSubstatusControl` and `handleSubstatusChange` to `board/editor.js`**

Add these functions (place them above `openProjectDetail`):

```javascript
function renderSubstatusControl() {
  const select = document.getElementById('substatusSelect');
  const note = document.getElementById('substatusNote');
  select.innerHTML = '';

  Object.entries(SUBSTATUS_LABELS).forEach(([value, label]) => {
    const option = document.createElement('option');
    option.value = value;
    option.textContent = label;
    if (value === currentDetailProject.video_editing_substatus) option.selected = true;
    select.appendChild(option);
  });

  const isEditable = currentDetailProject.stage === 'video_editing';
  select.disabled = !isEditable;
  note.textContent = isEditable ? '' : 'Available once this project reaches Video Editing.';
}

// Re-fetches the open detail panel's project row and re-renders the
// substatus control against the fresh data -- used after a failed substatus
// update, since the failure is most likely a stage-race (a PM moved the
// project out of video_editing between page-load and this click) and the
// locally-cached currentDetailProject.stage is now stale.
async function resyncCurrentDetailProject() {
  if (!currentDetailProject) return;
  const requestedId = currentDetailProject.id;
  const { data, error } = await supabase
    .from('editor_project_view')
    .select('*')
    .eq('id', requestedId)
    .single();
  if (!error && data && currentDetailProject && currentDetailProject.id === requestedId) {
    currentDetailProject = { ...currentDetailProject, ...data };
    renderSubstatusControl();
  }
  await refreshProjects();
}

async function handleSubstatusChange() {
  const select = document.getElementById('substatusSelect');
  const newSubstatus = select.value;
  select.disabled = true;
  const { error } = await supabase.rpc('update_editing_status', {
    p_project_id: currentDetailProject.id,
    p_substatus: newSubstatus,
  });
  if (error) {
    showErrorToast('Could not update status — please try again.');
    await resyncCurrentDetailProject();
    return;
  }
  currentDetailProject = { ...currentDetailProject, video_editing_substatus: newSubstatus };
  renderSubstatusControl();
  await refreshProjects();
}
```

- [ ] **Step 2: Wire it into `openProjectDetail` and `init`**

Modify `openProjectDetail`:

```javascript
async function openProjectDetail(project) {
  currentDetailProject = project;
  document.getElementById('detailClientName').textContent = project.client_name;
  document.getElementById('detailBackdrop').classList.add('open');
  renderSubstatusControl();
  await renderSubEventsTimeline();
}
```

Modify `init()` — add the substatus select's change listener alongside the other listeners already wired before the network awaits:

```javascript
  document.getElementById('detailClose').addEventListener('click', closeProjectDetail);
  document.getElementById('detailBackdrop').addEventListener('click', (e) => {
    if (e.target.id === 'detailBackdrop') closeProjectDetail();
  });
  document.getElementById('substatusSelect').addEventListener('change', handleSubstatusChange);
```

- [ ] **Step 3: Run the full unit suite to confirm no regression**

Run: `npm run test:unit`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add board/editor.js
git commit -m "feat(board): add video-editing substatus control to Editor detail panel"
```

---

### Task 5: Songs List + License Toggle

**Files:**
- Modify: `board/editor.js`

**Interfaces:**
- Consumes: `currentDetailProject`, `getCurrentDetailProjectId()` from Task 2.
- Produces: `renderSongsList()`, called by `openProjectDetail` (modified in this task) and by Task 6's realtime `songs` handler.

- [ ] **Step 1: Add `renderSongsList` and `renderSongRow` to `board/editor.js`**

Add these functions (place them above `openProjectDetail`):

```javascript
function renderSongRow(song) {
  const row = document.createElement('div');
  row.className = 'song-row';

  const title = document.createElement('div');
  title.className = 'song-title';
  title.textContent = song.artist ? `${song.title} — ${song.artist}` : song.title;
  row.appendChild(title);

  const label = document.createElement('label');
  label.className = 'song-license-toggle';
  const checkbox = document.createElement('input');
  checkbox.type = 'checkbox';
  checkbox.checked = song.license_confirmed;
  checkbox.addEventListener('change', async () => {
    const newValue = checkbox.checked;
    checkbox.disabled = true;
    const { error } = await supabase.rpc('set_song_license', {
      p_song_id: song.id,
      p_license_confirmed: newValue,
    });
    checkbox.disabled = false;
    if (error) {
      checkbox.checked = !newValue;
      showErrorToast('Could not update song license — please try again.');
    }
  });
  label.appendChild(checkbox);
  label.appendChild(document.createTextNode(' License confirmed'));
  row.appendChild(label);

  return row;
}

async function renderSongsList() {
  const requestedProject = currentDetailProject;
  if (!requestedProject) return;
  const { data: songs, error } = await supabase
    .from('songs')
    .select('*')
    .eq('project_id', requestedProject.id)
    .order('created_at', { ascending: true });

  if (!currentDetailProject || currentDetailProject.id !== requestedProject.id) return;

  const container = document.getElementById('songsList');
  container.innerHTML = '';

  if (error) {
    showErrorToast('Could not load songs.');
    return;
  }

  if (songs.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'timeline-empty';
    empty.textContent = 'No songs yet.';
    container.appendChild(empty);
    return;
  }

  songs.forEach(song => container.appendChild(renderSongRow(song)));
}
```

- [ ] **Step 2: Wire it into `openProjectDetail`**

Modify `openProjectDetail`:

```javascript
async function openProjectDetail(project) {
  currentDetailProject = project;
  document.getElementById('detailClientName').textContent = project.client_name;
  document.getElementById('detailBackdrop').classList.add('open');
  renderSubstatusControl();
  await renderSubEventsTimeline();
  await renderSongsList();
}
```

- [ ] **Step 3: Run the full unit suite to confirm no regression**

Run: `npm run test:unit`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add board/editor.js
git commit -m "feat(board): add songs list with license-confirmed toggle to Editor detail panel"
```

---

### Task 6: Activity Feed, Comments, and Full Realtime Sync

**Files:**
- Modify: `board/editor.js`

**Interfaces:**
- Consumes: `synthesizeActivityLine` from `board-utils.js`. `currentDetailProject`, `getCurrentDetailProjectId()`, `refreshProjects()`, `renderSubEventsTimeline()`, `renderSubstatusControl()`, `renderSongsList()` from Tasks 2-5.
- Produces: `renderActivityFeed()`, `handleCommentSubmit()`, `subscribeToChanges()` — this task's `subscribeToChanges()` is the last piece `init()` needs; no later task depends on anything from here.

- [ ] **Step 1: Add `synthesizeActivityLine` to the `board-utils.js` import**

Modify the import at the top of `board/editor.js`:

```javascript
import {
  formatDate, deriveWeddingDate, stageLabel, SUBSTATUS_LABELS, synthesizeActivityLine,
} from './board-utils.js';
```

- [ ] **Step 2: Add `renderActivityFeed` and `handleCommentSubmit` to `board/editor.js`**

Add these functions (place them above `openProjectDetail`):

```javascript
async function renderActivityFeed() {
  const requestedProject = currentDetailProject;
  if (!requestedProject) return;
  const [{ data: comments, error: commentsError }, { data: activity, error: activityError }] = await Promise.all([
    supabase.from('comments').select('*').eq('project_id', requestedProject.id).order('created_at', { ascending: true }),
    supabase.from('activity_log').select('*').eq('project_id', requestedProject.id).order('created_at', { ascending: true }),
  ]);

  if (!currentDetailProject || currentDetailProject.id !== requestedProject.id) return;

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
      authorName.textContent = entry.data.author_label || '?';
      authorLine.appendChild(authorName);

      // Editors can see internal (staff-only) comments too, per the
      // comments_select_editor RLS policy -- this tag makes it clear which
      // past notes were never shown to the client, matching the Owner/PM
      // feed's own behavior in project-modal.js.
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
  if (!body || !currentDetailProject) return;

  const submitBtn = document.querySelector('#commentForm button[type="submit"]');
  submitBtn.disabled = true;
  const { error } = await supabase.rpc('post_comment', {
    p_project_id: currentDetailProject.id,
    p_body: body,
  });
  submitBtn.disabled = false;

  if (error) {
    showErrorToast('Could not post comment — please try again.');
    return;
  }

  document.getElementById('commentBody').value = '';
  await renderActivityFeed();
}
```

- [ ] **Step 3: Wire the feed into `openProjectDetail` and the composer's submit handler into `init`**

Modify `openProjectDetail`:

```javascript
async function openProjectDetail(project) {
  currentDetailProject = project;
  document.getElementById('detailClientName').textContent = project.client_name;
  document.getElementById('detailBackdrop').classList.add('open');
  renderSubstatusControl();
  await renderSubEventsTimeline();
  await renderSongsList();
  await renderActivityFeed();
}
```

Modify `init()` — add the comment form's submit listener alongside the other listeners already wired before the network awaits:

```javascript
  document.getElementById('substatusSelect').addEventListener('change', handleSubstatusChange);
  document.getElementById('commentForm').addEventListener('submit', handleCommentSubmit);
```

- [ ] **Step 4: Add `subscribeToChanges` to `board/editor.js`**

Add this function (place it above `init`):

```javascript
function subscribeToChanges() {
  realtimeChannel = supabase
    .channel('editor-changes')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'projects' }, (payload) => {
      refreshProjects();
      const projectId = payload.new?.id ?? payload.old?.id;
      if (projectId && getCurrentDetailProjectId() === projectId) {
        // Sync the open detail panel's in-memory project object with the
        // fresh row so the substatus control's enabled/disabled state
        // (gated on currentDetailProject.stage) reflects a stage change
        // made elsewhere -- e.g. a PM moving the project out of
        // video_editing -- without the Editor needing to close/reopen.
        currentDetailProject = { ...currentDetailProject, ...payload.new };
        renderSubstatusControl();
      }
    })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'sub_events' }, (payload) => {
      refreshProjects();
      const projectId = payload.new?.project_id ?? payload.old?.project_id;
      if (projectId && getCurrentDetailProjectId() === projectId) renderSubEventsTimeline();
    })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'songs' }, (payload) => {
      const projectId = payload.new?.project_id ?? payload.old?.project_id;
      if (projectId && getCurrentDetailProjectId() === projectId) renderSongsList();
    })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'comments' }, (payload) => {
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
```

- [ ] **Step 5: Call it from `init`**

Modify the end of `init()`:

```javascript
  await refreshProjects();
  subscribeToChanges();
}
```

- [ ] **Step 6: Run the full unit suite to confirm no regression**

Run: `npm run test:unit`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add board/editor.js
git commit -m "feat(board): add activity feed, comments, and full realtime sync to Editor dashboard"
```

---

### Task 7: Full Manual Verification Pass

**Files:** none (verification only — use the `run` skill for the browser-driving parts of this task).

**Interfaces:**
- Consumes: everything from Tasks 1-6.

- [ ] **Step 1: Start a local static server**

```bash
npx serve .
```

(No edge function involved in this sub-project, so a plain static server is sufficient — no `netlify dev` needed here.)

- [ ] **Step 2: Seed a test Editor and an assigned project**

Using the service-role client (matching `board/test/helpers.js`'s pattern), create a test Editor profile with a real password, a test project in the `video_editing` stage with a `video_editing_substatus`, a sub-event, and a song, and assign the Editor to that project via `project_editors`. Also create a second test project the Editor is NOT assigned to, to verify it's excluded.

- [ ] **Step 3: Login routing**

Using the `run` skill, log in as the test Editor at `http://localhost:<port>/board/login.html`. Confirm it redirects to `editor.html`, not `index.html`. Confirm an Owner/PM login still redirects to `index.html` (no regression from Task 1).

- [ ] **Step 4: Project list**

Confirm the list shows only the assigned test project (not the unassigned one), with the correct client name, date, stage label, and substatus.

- [ ] **Step 5: Detail panel — sub-events, substatus, songs, activity**

Click the project row. Confirm: the sub-events timeline shows the seeded sub-event with no Edit/Delete controls; the substatus select is enabled (project is in `video_editing`) and shows the seeded substatus; changing it persists (confirm via a direct DB read); the songs list shows the seeded song, and toggling "License confirmed" persists; posting a comment appears in the activity feed immediately, and a direct DB read confirms `internal = false` on it.

- [ ] **Step 6: Substatus gating**

Using the service-role client, change the test project's `stage` to something other than `video_editing` (e.g. `raw_delivered`), then refresh the Editor's page and reopen the detail panel — confirm the substatus select is now disabled with the "Available once this project reaches Video Editing" note. Set it back to `video_editing` and confirm it re-enables.

- [ ] **Step 7: Realtime**

With the detail panel open for the test project, use the service-role client to update the project's `stage` directly in the database. Confirm the substatus control's enabled/disabled state updates live, without a manual page refresh.

- [ ] **Step 8: Deactivation**

Deactivate the test Editor via the service-role client (or the Staff page as a real Owner, if convenient), then attempt to log in as that account again — confirm the "Your access has been revoked." message from `login.js` appears.

- [ ] **Step 9: Clean up**

Delete every test profile/project created in Step 2, using the service-role client (matching `board/test/helpers.js`'s `deleteTestProfile`/`deleteTestProject` pattern). Verify via a final query that no test data remains.

- [ ] **Step 10: Stop the server, run the full suite one more time**

```bash
npm run test:unit
```

Expected: PASS, full suite green.

- [ ] **Step 11: Commit anything left uncommitted**

If Steps 1-10 required no code changes (expected — this task is verification only), there is nothing to commit. If any issue surfaced a real bug, fix it, re-run the relevant checks, and commit the fix with a message describing what step caught it.
