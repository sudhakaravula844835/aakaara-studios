# Project Board 2a — Core Owner/PM Board Design Spec
**Date:** 2026-07-27
**Project:** Aakaara Studios — Project Board, sub-project 2 (split into 2a/2b/2c)
**Files affected:** new `/board/index.html`, `/board/login.html`, `/board/supabase-client.js`, `/board/board.js`, `/board/board.css`, `/board/project-modal.js`

---

## Context

This is the first UI sub-project built on top of Foundation (sub-project 1: schema, RLS, RPC functions — PR #3, not yet merged). Foundation shipped no UI at all. The original "Owner/PM board" scope (Kanban + list view, full CRUD, realtime sync, activity feed/comments, calendar view, staff invites) was itself too large for one cycle, so it's split into three:

- **2a (this spec)** — Owner/PM login, the Kanban board itself, project create/edit, drag-drop stage changes, a project detail panel (sub-events + comments/activity).
- **2b** — list/table view toggle and calendar view, built on the same data layer once 2a exists.
- **2c** — the "Owner invites PM/Editor by email" flow, isolated because it needs a Netlify function holding the service-role key.

**Branching:** since 2a depends on Foundation's schema/RLS/RPC surface which isn't merged to `main` yet, 2a is built as further commits on the same `worktree-project-board-foundation` branch (PR #3), not a fresh branch off `main`. This gets reconciled when Foundation merges.

## Decisions Made During Brainstorming

| Question | Decision |
|---|---|
| Tech approach | Vanilla JS, no build step, matching the rest of the site. Drag-and-drop via the native HTML5 Drag and Drop API — no dependency. |
| Detail panel scope | Sub-events (add/edit/delete) + a merged comments/activity-log feed. Song licensing and PM/editor assignment explicitly deferred (no staff exist to assign to until 2c ships). |
| Create/edit form scope | Core booking fields only (client contact, date, location, package, pricing, deposit/balance, contract/quote URLs). No inline sub-event setup at creation — sub-events are added afterward from the detail panel. |
| Deadline/staleness flags | Deferred. Cards show current stage only; no "stuck in this stage too long" logic yet — better decided once the board is in daily use and it's clear what's actually worth flagging. |
| Realtime architecture | Approach A: refetch-and-redraw. Any `postgres_changes` event (including the current user's own writes) triggers a full data refetch and full re-render, not fine-grained per-row patching. Simpler, fewer reconciliation bugs, and the performance cost is invisible at this studio's project-count scale. |
| Drag-drop feedback | No optimistic local move (avoids the exact reconciliation problem Approach A was chosen to avoid, just scoped to one interaction). On drop: add a `.card-pending` class to the dragged card in place (dimmed/pulsing), remove it via natural DOM replacement on the next redraw, or explicitly on a caught error. |
| Error handling | One error surface for everything — a single toast component (`showErrorToast(message)`) used for failed fetch, failed realtime reconnect, failed drag-drop update, and failed form submit. No separate banner/toast split. |
| Realtime reconnect vs. dismiss | Dismissing an error toast only hides that instance; it never affects Supabase's own background reconnect logic. A renewed failure fires a fresh toast. Decoupled deliberately — a "dismiss stops retry" design would let a user silently kill their own live-sync. |
| Auth separation | `board/login.html` uses real per-PM Supabase Auth accounts (email+password via `supabase.auth.signInWithPassword()`), fully decoupled from `admin/login.html`'s shared-password cookie gate. Different trust models, kept independent so either can change without touching the other. |
| Role scope | `index.html` assumes Owner/PM only. No role-branching logic for Editor/Client — those views don't exist yet (sub-projects 3/4), and speculative branching would be dead code. |
| Testing | Vitest unit tests for pure logic (stage/progress-bar helpers, date sorting, form validation), matching the `admin/crm-utils.js` pattern. No automated e2e — this environment has no Playwright browsers installed (a real, pre-existing gap, documented here rather than silently skipped). Manual verification via the `run` skill (launch + click through login → view → drag → edit) before calling any task done. |

---

## File Structure

```
board/
  index.html          — the Kanban board (requires a session; redirects to login.html if none)
  login.html           — email/password login form
  supabase-client.js   — initializes and exports the supabase-js client (SUPABASE_URL + anon key hardcoded — both safe client-side; no build step means no env-injection mechanism exists, and none is needed here)
  board.js             — fetch, render, drag-drop, realtime subscription, toast system
  board.css            — board-specific layout/styles, reusing root styles.css CSS vars
  project-modal.js      — create/edit form + detail panel (sub-events, comments/activity feed)
  board-utils.js        — pure logic: stage label mapping, progress-bar segment calc, date-sort comparator, form field validation (unit-tested)
```

`board-utils.js` is split out specifically so its logic can be unit-tested the same way `admin/crm-utils.js` is — `board.js` and `project-modal.js` own DOM/event wiring and import from it.

## Auth

- `login.html`: form posts to `supabase.auth.signInWithPassword({ email, password })`. On success, supabase-js persists the session in `localStorage` automatically; redirect to `index.html`. On failure, inline error message on the form (not the shared toast — this is a pre-board-load failure with no board context to show a toast in).
- `index.html`: on load, `supabase.auth.getSession()`. No session → redirect to `login.html`. A logout button calls `supabase.auth.signOut()` and redirects back to `login.html`.
- Session refresh is handled by supabase-js automatically (default `autoRefreshToken: true`).

## Data Model & Kanban Board

**Columns** (in order, matching `projects.stage`): `Booked` → `Shoot Completed` → `RAW Delivered` → `Photo Selection` → `Video Editing` → `Song Finalization` → `Final Delivery` → `Completed`.

**Initial load:** fetch all `projects` rows (RLS already returns everything for owner/pm), group by `stage`, sort each column's cards by `wedding date` ascending (soonest first — the `wedding date` here is `projects` having no direct date column itself; sub-events carry `event_date`. For sort purposes, use the earliest `sub_events.event_date` for that project if any exist, else fall back to `created_at`).

**Card content:** client name, earliest sub-event date (or "Date TBD" if none set yet), package tier, an 8-segment progress bar computed from stage position, and — only when `stage = 'video_editing'` — a small substatus sub-label (`In Progress`, `Client Review`, etc.).

**Realtime subscription:** one Supabase Realtime channel subscribed to `postgres_changes` on `projects`, `sub_events`, `comments`, and `activity_log` (INSERT/UPDATE/DELETE), scoped to no filter (owner/pm see everything anyway). Any event triggers a full refetch-and-redraw of the board. Connection-state changes (disconnect/reconnect) surface via the shared toast.

**Drag-and-drop:** cards are `draggable="true"`; `dragstart` stores the project id; column containers handle `dragover` (`preventDefault`) and `drop`. On drop: add `.card-pending` to the source card element, call `supabase.from('projects').update({ stage: newStage }).eq('id', projectId)`. Success: the resulting realtime event triggers the redraw that actually moves the card (removing the pending state as a side effect of the DOM rebuild). Failure: catch, remove `.card-pending` explicitly, call `showErrorToast()`.

## Create/Edit Project Modal

Single modal for both add and edit (mirroring `admin/dashboard.js`'s existing quick-add/edit pattern). Fields:

1. Client name (required), email, phone
2. Wedding location/venue
3. Package tier, hours booked
4. Quoted price, confirmed price, deposit paid (checkbox), balance paid (checkbox)
5. Contract URL, quote PDF URL (plain text/URL inputs)
6. Stage (select, defaults to `Booked` on create — exists so historical/backfilled projects can be created directly into a later stage; day-to-day stage changes happen via drag-drop, not this field)

No sub-event fields here — those are added afterward from the detail panel. Save calls `insert` (create) or `update` (edit) directly via RLS-permitted owner/pm write access; the realtime subscription's redraw reflects the result, so no separate local re-render logic is needed on top of what the modal-close already triggers.

## Project Detail Panel

Opens on card click (not drag — a `click` handler distinct from the drag lifecycle, so drag doesn't accidentally trigger it).

**Sub-events section:** list of existing `sub_events` for the project (name, date, venue), with add/edit/delete. Each row also shows `photo_selected_count / photo_total_count` read-only (will be `0 / 0` for every sub-event until sub-project 3 ships the client photo-selection flow — that's expected, not a bug).

**Comments/activity feed:** a single chronological list merging `comments` (manually posted, shown with author label) and `activity_log` (auto-generated, shown as plain "PM changed stage: Booked → Shoot Completed"-style lines) — read-only for the log half, with a text input, a "Hidden from client" checkbox, and a submit button to post a new comment.

The checkbox defaults to **checked** (`internal: true`), not unchecked. Reasoning: no client-facing view exists until sub-project 3, so every comment posted through 2a is a PM/Owner jotting a working note with no client watching — that's the realistic default use, not the exception. If new comments defaulted to `internal: false`, ordinary day-to-day notes written today would silently become client-visible the moment sub-project 3 ships, with no record of which ones were meant to be private. Defaulting internal keeps that decision explicit and reversible (uncheck it when a comment is actually meant for the client) rather than accidentally leaking history later. Internal comments show a small "Internal" tag in the feed so it's visually clear which is which.

## Styling

`board.css` reuses root `styles.css` CSS vars directly (`--noir: #09080b`, `--rose: #c9956b`, `--ivory`, `--font-display`, `--font-body`, `--ease`) — verified against the approved mockup, no drift. Layout patterns (card structure, modal chrome) adapt `admin/dashboard.css`'s existing card-grid/modal CSS rather than inventing new conventions. Mobile: columns become a horizontal-scroll strip, matching the existing portfolio/video filter-pill mobile pattern. Empty states ("No sub-events yet", "No comments yet") stay plain and direct — not apologetic, not cutesy — since an empty section is an invitation to act, not a mood moment.

## Testing

- **Unit (Vitest):** `board-utils.js`'s pure functions — stage-to-label mapping, progress-bar segment count, date-sort comparator (project with no sub-events sorts after ones with dates), form validation (required fields).
- **No automated e2e.** This environment has no Playwright browsers installed — a pre-existing, documented gap, not a silently skipped one. Manual verification via the `run` skill: launch the board, log in, confirm the Kanban columns render, drag a card and confirm it moves (with the pending-state flash visible), open the create modal and add a project, open a card's detail panel and add a sub-event and a comment.

## Out of Scope (this sub-project)

- List/table view toggle, calendar view — sub-project 2b.
- PM/Editor invite flow, PM/editor assignment on a project — sub-project 2c (no staff exist to assign to yet).
- Song list / licensing display — deferred to whichever of 4 (Editor view) or a later 2-series pass covers it; not decided yet, revisit when scoping that sub-project.
- Deadline/staleness flags on cards — deferred per brainstorming decision above.
- Client-facing anything — sub-project 3.
