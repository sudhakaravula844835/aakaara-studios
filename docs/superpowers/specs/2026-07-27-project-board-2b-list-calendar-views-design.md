# Project Board 2b — List & Calendar Views Design Spec
**Date:** 2026-07-27
**Project:** Aakaara Studios — Project Board, sub-project 2b (of the 2a/2b/2c split)
**Files affected:** `board/board.js` (modified), new `board/list-view.js`, new `board/calendar-view.js`, `board/index.html` (modified), `board/board.css` (modified), `board/board-utils.js` (modified)

---

## Context

Sub-project 2a shipped the Kanban board (login, drag-drop, create/edit, detail panel) — PR #3, merged into the same branch as Foundation. This sub-project adds the two remaining views from the original "Owner/PM board" scope: a sortable List/table view, and a Calendar view showing every sub-event date across every project, so Sudhakar can see his August-bookings-style scheduling load at a glance. No backend changes — this is UI only, built entirely on data 2a's `fetchProjects()` already retrieves.

## Decisions Made During Brainstorming

| Question | Decision |
|---|---|
| Calendar scope | Every sub-event date (Haldi, Sangeet, Wedding, Reception, etc.) marks its own day, across all projects — not one simplified date per project. Each is a day requiring physical presence, which is the actual scheduling concern. |
| View layout | A three-way toggle (Kanban / List / Calendar) in the header, all reading from the same already-loaded data. Not a separate always-visible calendar section like the old quote-CRM. |
| List stage changes | An inline `<select>` per row, firing the same `update()` call Kanban's drag-drop uses — benefits from the same generation-counter/safety-net logic already in `board.js` (2a Fix 1/3). |
| Calendar click behavior | Clicking a sub-event marker opens that project's detail panel — same `openDetailPanel` used by Kanban cards and (this spec's) List rows, one consistent drill-in path across all three views. |
| List columns/sorting | Client Name, Date, Package Tier, Stage (dropdown), Progress — same fields as the Kanban card. Click a column header to sort ascending/descending, client-side over already-loaded data, no new query. |

## Architecture

```
board/board.js
  currentProjects     — module-level array, populated by fetchProjects(), now the single
                         shared source for all 3 views (previously only Kanban read it)
  currentView         — 'kanban' | 'list' | 'calendar', module-level state
  renderActiveView()  — dispatches to renderBoard() / renderListView() / renderCalendarView()
                         based on currentView. Replaces direct renderBoard() calls at every
                         call site that currently exists in board.js (init, realtime handlers,
                         the drag-drop safety net, project-modal.js's create/edit fallback).

board/list-view.js
  renderListView(projects)          — builds/rebuilds the table from currentProjects
  sortState = { column, direction } — module state; clicking a header toggles it

board/calendar-view.js
  currentCalendarMonth   — module state (Date), defaults to today's month
  renderCalendarView()   — flattens every project's sub_events into the visible month's
                            day-grouped markers; prev/next nav re-renders in place
```

Switching the toggle calls `renderActiveView()` against the already-cached `currentProjects` — instant, no fetch. Realtime events (already wired in 2a) refetch into `currentProjects` once, then call `renderActiveView()` — whichever view is on screen updates live; the other two simply render fresh next time they're switched to, since they always read from the current `currentProjects` array rather than a snapshot.

**Renaming note:** since `renderBoard` (2a's name for "render the Kanban view") is now one of three view-specific renderers, not "the" renderer, `renderActiveView()` becomes the new top-level entry point that Tasks in this plan wire into every existing call site — `renderBoard` itself keeps its name (it still only renders the Kanban DOM) but is called only by `renderActiveView()` and no longer called directly from `init()`, the realtime handlers, or `project-modal.js`.

## List View

**Columns:** Client Name, Date (`formatDate(deriveWeddingDate(project.sub_events))`, same as Kanban cards), Package Tier, Stage, Progress.

**Stage column:** a `<select>` populated from `STAGE_COLUMNS` (from `board-utils.js`), value bound to `project.stage`. On change, calls `supabase.from('projects').update({ stage: newValue }).eq('id', project.id)` — the exact same call `handleDrop` makes, so a stale/failed update surfaces the same `showErrorToast` and the same generation-counter protects against a rapid double-change race (extending 2a's Fix 1 pattern to this new write path, not just drag-drop).

**Sorting:** clicking a column header sorts `currentProjects` client-side (comparator per column — string comparison for Client Name/Package Tier, `compareProjectsByDate` for Date, `stageIndex` for Stage, `stageIndex` again for Progress since they're equivalent), toggling direction on repeat clicks of the same header. Sort state does not persist across a view switch away and back (resets to unsorted/insertion order) — not something the original request or brainstorming called for, and adding persistence would be scope creep for a first pass.

**Row interaction:** clicking anywhere on a row except the stage `<select>` calls `openDetailPanel(project)` — same function Kanban cards already use (imported from `project-modal.js`, no new detail-panel code needed).

## Calendar View

**Data:** flatten every project's `sub_events` into `{ date, subEventName, projectId, clientName }` entries (a pure function in `board-utils.js`, unit-tested), filter to entries falling within `currentCalendarMonth`, group by day-of-month.

**Rendering:** adapts `admin/dashboard.css`'s existing month-grid structure (weekday header row, day cells, prev/next nav buttons) rather than inventing new grid CSS. Each day cell shows one small marker per sub-event scheduled that day — a project with Haldi/Sangeet/Wedding on three different days shows three separate markers on three different cells, not one marker "for the project." Marker color is a single `--rose`-based treatment (no occupied/pending distinction like the old CRM, since every sub-event in this data model belongs to an already-`booked`-or-later project — there's no "pending quote" concept here to distinguish).

**Interaction:** hovering a marker shows a tooltip with client name + sub-event name (matching the old CRM's hover pattern, familiar to Sudhakar already). Clicking a marker calls `openDetailPanel(project)` for that sub-event's project — same function as List/Kanban.

## Styling

Toggle is a small pill-button group (reusing the site's existing filter-pill CSS pattern) placed next to `#addProjectBtn` in the header. Table styling extends `board.css`'s existing dark/card visual language — row hover is a subtle background lift, consistent border/radius with the rest of the board, not a new visual language. Calendar grid restyles `admin/dashboard.css`'s month-grid pattern with `--rose` markers.

## Testing

- **Unit (Vitest):** the sub-event-flattening/day-grouping function and the per-column sort comparators go in `board-utils.js` and get unit tests, following 2a's established pattern.
- **No automated e2e** — same documented, deliberate gap as 2a (no Playwright browsers in this environment). Manual verification via the `run` skill: toggle between all three views, sort each List column both directions, change a stage via the List dropdown and confirm it behaves identically to a Kanban drag (pending/error/safety-net), navigate the calendar across months, click a marker and confirm the detail panel opens for the right project.

## Out of Scope (this sub-project)

- Sort-state persistence across view switches.
- Filtering (by stage, client name, date range) in List or Calendar — not requested, would be a deliberate follow-up once the plain views are in daily use and a real filtering need is identified.
- PM/Editor assignment display in any view — still blocked on 2c (no staff exist to assign yet).
- Any change to Kanban's own behavior — this sub-project only adds the two new views and the toggle mechanism around the existing one.
