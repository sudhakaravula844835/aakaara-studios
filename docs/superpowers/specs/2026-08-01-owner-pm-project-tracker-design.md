# Owner/PM Project Tracker (in Project Modal) — Design Spec
**Date:** 2026-08-01
**Project:** Aakaara Studios — Project Board, Owner/PM board enhancement
**Files affected:** `board/index.html` (modified), `board/project-modal.js` (modified)

---

## Context

Second item off the post-audit "recommended next enhancements" list, following the same brainstorm → spec → plan → build process as the first (Copy Client Link).

The project create/edit modal (`board/index.html`'s `#projectModalBackdrop`) currently shows zero stage information — no dropdown, no indicator. `stage` only changes via Kanban drag-drop or List view's per-row `<select>` (`board/list-view.js:96-120`). A PM opening this modal to edit a project's contact info or pricing has no way to see where that project sits in the pipeline without closing the modal and checking elsewhere.

The client portal (`board/client.js:127-161`, `renderProjectTracker()`) already renders an 8-stage visual tracker for clients, using shared utilities (`STAGE_COLUMNS`, `stageIndex()` from `board-utils.js`) and existing CSS (`.client-project-tracker`/`.client-tracker-*` in `board/board.css:515-565`). This feature reuses that pattern for Owner/PM, with different (simpler) status copy.

## Decisions Made During Brainstorming

| Question | Decision |
|---|---|
| Interactive or read-only | Read-only. Stage still only changes via Kanban drag or List view's dropdown — this modal stays focused on project details, not a third place to change stage. |
| Shown on create, or edit only | Edit only. A brand-new project is always `booked` with nothing else having happened — showing 8 stages with only the first lit up is clutter with no information gained. Mirrors the existing `firstSubEventSection` pattern, inverted (that section shows on create, hides on edit; this one does the reverse). |
| Status text per stage | Simple operational labels — "Done" / "In Progress" / "Not started" — not the client-facing narrative copy ("We are preparing your delivery timeline"). Owner/PM don't need customer-service framing, just a fast read. `video_editing_substatus` is appended when the stage is `video_editing` and a substatus is set (e.g. "In Progress · Client Review"), using the existing `SUBSTATUS_LABELS`. |
| CSS | Reuse `.client-project-tracker`/`.client-tracker-*` classes verbatim from `board/board.css` — no new CSS. These classes describe stage state (done/current/waiting) generically; they aren't conceptually client-specific despite the name, and duplicating near-identical rules under a new class name would be pure repetition for no visual difference. |

## Architecture

```
board/index.html         — new section in the project modal, placed after .modal-header
                           and before .modal-grid (a quick-glance summary before the
                           editable fields):
                             <div class="modal-section" id="projectTrackerSection" hidden>
                               <div class="modal-section-title">Progress</div>
                               <div class="client-project-tracker" id="projectTracker"></div>
                             </div>
                           Mirrors firstSubEventSection's existing structure and visibility
                           pattern (a sibling .modal-section, toggled via the .hidden
                           property in JS) — just inverted (hidden on create, not on edit).

board/project-modal.js   — new function renderProjectTracker(project), modeled on
                           client.js's function of the same name and same DOM-building
                           approach (createElement, not innerHTML), but building
                           .client-tracker-status text from stageIndex()/STAGE_COLUMNS/
                           SUBSTATUS_LABELS directly rather than narrative copy.
                           Called from openProjectModal(project): toggles
                           #projectTrackerSection.hidden = !project, and when project is
                           truthy, clears #projectTracker and appends the rendered tracker.
```

No backend change, no new data — `project.stage` and `project.video_editing_substatus` are already present on every project object passed into `openProjectModal` (both are already selected by `board/board.js`'s `fetchProjects()`).

## Status Text Logic

For each of the 8 `STAGE_COLUMNS` entries, compare its index to `stageIndex(project.stage)`:

- index < current → **"Done"**
- index > current → **"Not started"**
- index === current → **"In Progress"**, or if `stage === 'video_editing'` and `project.video_editing_substatus` is set, `` `In Progress · ${SUBSTATUS_LABELS[project.video_editing_substatus]}` ``

This mirrors `client.js`'s `done`/`current`/`waiting` state classification (same three CSS states, same marker treatment — checkmark for done, number for current/waiting) but swaps the label text function only.

## Testing

A unit test in `board/test/board-fetch-fields.test.js`, following its established file-content-assertion pattern:

- `board/index.html` contains `id="projectTrackerSection"` and it starts `hidden`
- `project-modal.js` contains a `renderProjectTracker` function
- `openProjectModal` toggles `projectTrackerSection`'s hidden state based on whether a project was passed in

No live Supabase test needed — this is a pure display feature over data already fetched elsewhere, not a new query or a security boundary.

## Out of Scope

- Making the tracker clickable/interactive (see Decisions table).
- Showing the tracker during project creation.
- Any change to `board/list-view.js`'s existing stage `<select>` or the Kanban drag-drop stage-change flow.
- New CSS — reusing existing classes is the point.
