# Project Board 4 — Editor's Own Dashboard Design Spec
**Date:** 2026-07-29
**Project:** Aakaara Studios — Project Board, sub-project 4
**Files affected:** new `board/editor.html`, new `board/editor.js`, `board/login.js` (modified)

---

## Context

Foundation built the entire backend for the Editor role — a column-restricted read view (`editor_project_view`), row-scoped RLS reads on `sub_events`/`songs`/`activity_log`/`comments`, and three `SECURITY DEFINER` RPCs (`update_editing_status`, `set_song_license`, `post_comment`) — but no UI has ever existed for an Editor to use any of it. Sub-project 2c (staff invite flow) just made it possible to create real Editor accounts for the first time; right now an invited Editor has nowhere to go after logging in (`login.js` always redirects to `index.html`, the Owner/PM board, where RLS blocks almost everything they'd try to read). This sub-project closes that gap.

## Decisions Made During Brainstorming

| Question | Decision |
|---|---|
| Landing view | A flat list of the Editor's assigned projects (Client Name, Date, Stage, Video Editing Substatus) — not a Kanban board. Editors only act during one stage; the full 8-column pipeline visualization Owner/PM uses isn't useful to them. |
| Detail view scope | Everything the existing backend supports: read-only sub-events timeline, video-editing substatus control (gated to the `video_editing` stage), song license toggles, comments + activity feed. Nothing narrower — no backend work needed, only UI against RPCs/views that already exist. |
| Comment visibility | Editor comments stay always-visible-to-client, matching `post_comment`'s existing behavior exactly (it never sets an internal flag). No backend change, no internal/external toggle in the Editor's comment composer. |
| Routing | A separate page, `board/editor.html`, not a role-aware `index.html`. `login.js` redirects Owner/PM → `index.html`, Editor → `editor.html`. Keeps the two roles' code fully independent — an Editor never loads Kanban/List/Calendar/Staff code they have no RLS access to use. |
| Live sync | Realtime, matching the Owner/PM board's existing pattern — subscribe to `postgres_changes` on `projects`/`sub_events`/`songs`/`comments`, refetch-and-redraw. Concretely matters: if a PM moves a project out of `video_editing` while the Editor has it open, their substatus control should disable live, not on next manual refresh. |

## Architecture

```
board/editor.html   — page shell: header (Editor's name, Log Out), project list
                       container, detail panel (opened over the list, same
                       backdrop/modal pattern as index.html's detail panel)

board/editor.js      — everything: fetchAssignedProjects(), renderProjectList(),
                       openProjectDetail(project), renderSubEventsTimeline()
                       (read-only variant), renderSongsList(), renderActivityFeed()
                       (reusing synthesizeActivityLine from board-utils.js),
                       handleSubstatusChange(), handleLicenseToggle(),
                       handleCommentSubmit(), subscribeToChanges(), init()

board/login.js       — after successful sign-in, fetch the profile's `role`
                       (in addition to the existing `active` check from 2c),
                       redirect to editor.html for 'editor', index.html
                       otherwise
```

`board/editor.js` is a single file rather than split like the Owner/PM board's `board.js`/`project-modal.js`/`list-view.js` split — the Editor's total surface area (one list, one detail view, three write actions) is small enough that splitting it would add indirection without a real benefit. `board-utils.js`'s pure functions (`formatDate`, `deriveWeddingDate`, `synthesizeActivityLine`, `stageLabel`, `SUBSTATUS_LABELS`) are imported and reused as-is — no duplication.

## Data Fetching

`fetchAssignedProjects()` queries `editor_project_view` (already scoped server-side to the signed-in Editor's assignments — no `.eq()` filter needed client-side) joined with `sub_events` for date display:

```js
supabase.from('editor_project_view').select('*, sub_events(id, name, event_date, venue)')
```

This mirrors `board.js`'s `fetchProjects()` null-vs-`[]` convention: on error, return `null` and leave the prior render untouched (don't blank the list on a transient network blip); on success, always update, even if `[]`.

## Landing View

A single `<table>` (reusing `.list-table` styling from `board.css`, no new visual language): Client Name, Date (`formatDate(deriveWeddingDate(project.sub_events))`), Stage (`stageLabel(project.stage)`, plain text — Editors have no RLS write grant on `projects.stage`, so this is never a dropdown), Video Editing Substatus (shown only when `project.stage === 'video_editing'`, using the existing `SUBSTATUS_LABELS` map). Clicking a row opens the detail view for that project. No sorting, no filtering, no view toggle — the Editor's project count is expected to be small enough that a plain list needs neither.

## Detail View

Opens as a backdrop/panel over the list (same open/close pattern as `index.html`'s existing `#detailBackdrop`), with four sections:

**Sub-events timeline (read-only):** Same rendering as the Owner/PM detail panel's timeline (name, date, venue) but with no Edit/Delete buttons — Editors have no RLS write grant on `sub_events`, so those controls would only ever fail.

**Video-editing substatus:** A `<select>` populated from `SUBSTATUS_LABELS`, calling `update_editing_status(p_project_id, p_substatus)` on change. Enabled only when `project.stage === 'video_editing'`; otherwise disabled with a short note ("Available once this project reaches Video Editing"). On the RPC's own rejection (project moved out of that stage between page-load and the click — a real race the RPC already guards server-side), show the existing `showErrorToast` pattern and refetch to resync.

**Songs:** A list of the project's songs (title, artist) each with a "License confirmed" checkbox calling `set_song_license(p_song_id, p_license_confirmed)`. No "add song" control — Editors have no RLS/RPC path to insert a song (only the Client's `submit_song` RPC or a direct Owner/PM write can do that).

**Activity & comments:** Identical rendering to the Owner/PM detail panel's merged feed (`synthesizeActivityLine` for activity rows, plain comment rows) plus a comment composer with no internal/external toggle (per the decision above) — submitting calls `post_comment(p_project_id, p_body)`.

## Realtime

`subscribeToChanges()` mirrors `board.js`'s pattern: subscribe to `postgres_changes` on `projects`, `sub_events`, `songs`, `comments`, and `activity_log` (this last one matching `board.js`'s own subscription, since the Editor's activity feed needs to reflect Owner/PM's edits showing up live too, not just their own). Any change refetches `fetchAssignedProjects()`, and if the detail view is open for the affected project, its timeline/songs/activity feed re-render in place — same generation-counter guard against out-of-order renders that `board.js` already established.

## Styling

Reuses `board.css` almost entirely: `.list-table`/`.list-row` for the landing list, `.modal-box`/`.detail-backdrop`/`.timeline`/`.activity-feed`/`.comment-composer` classes for the detail view, `.form-input` for the substatus select. No new CSS file — additions (if any are truly needed, e.g. a songs-list-specific class) go into the existing `board.css`, following the same "extend, don't invent" pattern 2b/2c already established.

## Testing

- **Unit (Vitest):** none of this sub-project's logic is new pure/stateless functions — it's read/render/write wiring against an already-existing, already-tested backend (Foundation's `editor-access.test.js` already covers the RPCs/view's RLS behavior thoroughly). No new unit tests.
- **No automated e2e** — same documented, deliberate gap as every other UI sub-project in this codebase (no Playwright browsers in this environment). Manual verification via the `run` skill: log in as a real Editor account, confirm the list shows only assigned projects, open detail, confirm the sub-events timeline has no edit controls, confirm the substatus control is disabled outside `video_editing` and works inside it, toggle a song's license, post a comment and confirm it appears (and separately confirm, via the client-token view once sub-project 3 exists, that it's visible there too — for now, confirm via a direct DB read that `internal` is `false`), confirm Realtime picks up a PM's stage change live.

## Out of Scope (this sub-project)

- Any backend/RPC changes — Foundation's existing Editor surface is used exactly as built.
- An internal/external toggle on Editor comments (explicitly decided against above).
- Adding songs, editing sub-events, or any other write Editors don't already have an RLS/RPC path for.
- Multi-editor-per-project visibility (seeing who else is assigned) — not requested, not part of the existing backend's exposed data either.
