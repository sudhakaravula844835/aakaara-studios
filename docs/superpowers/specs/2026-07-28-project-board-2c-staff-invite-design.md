# Project Board 2c — Staff Invite Flow Design Spec
**Date:** 2026-07-28
**Project:** Aakaara Studios — Project Board, sub-project 2c (of the 2a/2b/2c split)
**Files affected:** new `netlify/edge-functions/invite-staff.ts`, `netlify.toml` (modified), new `board/staff.js`, `board/index.html` (modified), `board/board.css` (modified), `board/board-utils.js` (modified), `board/project-modal.js` (modified), `board/login.js` (modified), new migration in `board/supabase/migrations/`

---

## Context

Foundation shipped `profiles` with three roles (`owner`, `pm`, `editor`) and RLS that restricts all writes to `profiles` to Owner (`profiles_all_owner`). No signup path exists — the one Owner account was seeded manually during Foundation. 2a/2b built the Owner/PM Kanban, List, and Calendar views, but nothing lets Owner actually create PM/Editor accounts or assign them to a project. 2c closes that gap: it's the last piece blocking sub-project 3 (client view, which reads `pm_id`/assigned editors for context) and sub-project 4 (Editor's own dashboard, which needs Editor accounts and `project_editors` rows to exist at all).

## Decisions Made During Brainstorming

| Question | Decision |
|---|---|
| Who can invite staff | Owner only — matches the existing `profiles_all_owner` RLS exactly, no policy change needed. |
| Invite mechanism | Email invite link via Supabase Auth's `inviteUserByEmail` admin API — the invited person sets their own password. Requires Supabase's project email delivery to be working (flagged as a manual dashboard check, same category as the two Auth toggles already flagged from Foundation). |
| Offboarding | Included — a `profiles.active` flag Owner can toggle, not a hard delete. Preserves activity-log and past-assignment history. |
| UI placement | A new "Staff" page, 4th item in the board's nav toggle, visible to Owner only. |
| Role changes | Editable after invite — a role `<select>` per staff row, using the same RLS write Owner already has. |
| Assignment scope | Included — the project create/edit modal gets a PM picker and an Editor multi-select, so staff accounts are immediately usable, not inert. |

## Architecture

```
netlify/edge-functions/invite-staff.ts   — the only new server-side code. Holds the
                                            service-role key (Netlify env var
                                            SUPABASE_SERVICE_ROLE_KEY, never shipped to
                                            the browser). Verifies the caller is an
                                            active Owner, then creates the Auth account
                                            + profiles row.

board/staff.js                           — new file: renders the Staff page (table +
                                            invite modal), all reads/writes except
                                            account creation go straight through the
                                            existing Supabase client via RLS.

board/project-modal.js                   — gets a PM <select> and Editor multi-select
                                            added to the existing create/edit form.

board/login.js                           — after sign-in, checks own profile's `active`
                                            flag; if false, signs out immediately and
                                            shows "Your access has been revoked" instead
                                            of entering the board.
```

No realtime/generation-counter concerns here — the Staff page is a simple CRUD table on infrequently-changing data (unlike Kanban's concurrent drag-drop), refetched after every mutation rather than subscribed to Realtime.

## Schema Change

One migration:

```sql
alter table profiles add column active boolean not null default true;

create or replace function current_profile_role()
returns text
language sql
security definer
stable
set search_path = public
as $$
  select role from profiles where id = auth.uid() and active = true;
$$;
```

This is the entire deactivation mechanism. Every existing RLS policy in Foundation/2a/2b already gates on `current_profile_role()` returning `'owner'`, `'pm'`, or `'editor'` — folding `active = true` into that one function means a deactivated staff member loses all board access (Kanban, List, Calendar, comments, everything) instantly, with no other policy touched. `profiles_select_self_or_owner_pm` (the read policy) is untouched, so a deactivated user can still read their own row — required for `login.js` to detect the deactivation and show a clear message rather than a confusing empty board.

## Invite Edge Function

`netlify/edge-functions/invite-staff.ts`, registered in `netlify.toml` under `/board/api/invite-staff` (new edge function path, alongside the existing `/admin/*` entry). Request: `POST` with `Authorization: Bearer <owner's Supabase session JWT>` and JSON body `{ email, full_name, role }` (`role` one of `'pm' | 'editor'` — inviting another Owner is out of scope, see below).

Steps:
1. Call `supabase.auth.getUser(jwt)` (service-role client) — this validates the JWT's signature and expiry against Supabase Auth itself and returns the authenticated user, or `null`/error if the token is invalid, expired, or forged. Reject with `401` on failure. (Decoding the JWT's payload directly without this call would let anyone forge a token claiming an arbitrary `sub`, so `getUser` — not manual decoding — is the trust boundary here.)
2. Using the service-role client, query `profiles` for that verified user's id. Reject with `403` unless the row has `role = 'owner' and active = true`.
3. Call `supabase.auth.admin.inviteUserByEmail(email)` (service-role client). Supabase sends the invite email and returns the new `auth.users` row.
4. Insert into `profiles`: `{ id: <new user's id>, role, full_name, email, active: true }` (service-role client, bypasses RLS — safe here since step 1-2 already gated the whole request on caller-is-a-verified-active-Owner).
5. Return `{ id, email, role, full_name }` as JSON on success.

Errors (duplicate email from step 3, a `role` value outside `pm`/`editor`, missing fields) return `{ error: "<message>" }` with an appropriate 4xx status, which `staff.js` surfaces via `showErrorToast` (reusing `board-shared.js`'s existing helper).

## Staff Page UI

`board/staff.js` exports `renderStaffView()`, wired into `board.js`'s `renderActiveView()` dispatcher alongside the existing Kanban/List/Calendar branches (4th `currentView` value: `'staff'`). The nav toggle in `board/index.html` gets a 4th button, shown only when the signed-in profile's role is `'owner'` (checked the same way the header already conditionally shows/hides Owner-only controls).

**Table columns:** Name, Email, Role, Status.

- **Role column:** a `<select>` (`pm`/`editor`) bound to the row's current role. On change: `supabase.from('profiles').update({ role: newValue }).eq('id', staffId)`, then refetch the staff list. Same error-toast pattern as List view's stage `<select>` from 2b.
- **Status column:** shows "Active" or "Deactivated"; a button toggles it via `supabase.from('profiles').update({ active: !current }).eq('id', staffId)`, then refetch.
- **Invite Staff button:** opens a modal (Name, Email, Role fields) that `fetch()`s the edge function with the current session's access token, shows a pending state, then on success closes the modal and refetches the staff list; on failure shows the error toast and leaves the modal open with the entered values intact.

Owner's own row is included in the list (for visibility) but its Role/Status controls are disabled — Owner cannot demote or deactivate themselves through this UI (prevents an Owner locking themselves out; if that's ever needed, it's a direct Supabase-dashboard action).

## Assignment Picker

Added to the existing project create/edit modal (`project-modal.js`, `openProjectModal`/`handleProjectFormSubmit`):

- **PM `<select>`:** options from `profiles where role = 'pm' and active = true`, plus a blank "Unassigned" option. Writes `projects.pm_id`.
- **Editor multi-select:** options from `profiles where role = 'editor' and active = true`. On save, diffs the selected set against existing `project_editors` rows for that project (insert new, delete removed) — same insert/delete pattern the sub-events timeline already uses for its own child-row updates, not a new pattern.

Both pickers are populated once when the modal opens (`profiles` fetched fresh each time — small table, no caching concern) and naturally exclude deactivated staff, since the query filters `active = true` directly rather than filtering client-side.

## Login-Time Deactivation Check

`board/login.js`, immediately after a successful `signInWithPassword`: fetch the signed-in user's own `profiles` row. If `active === false`, call `supabase.auth.signOut()` and show "Your access has been revoked. Contact the studio owner." instead of redirecting into the board. This is a UX nicety, not the security boundary — the real boundary is `current_profile_role()` returning `null` for a deactivated user, which already blocks every RLS-gated read/write regardless of whether this check runs.

## Styling

Staff page table reuses `board.css`'s existing dark/card table styling from 2b's List view (same row/border/hover treatment) — no new visual language. The invite modal reuses the existing modal CSS classes from the project create/edit modal. The 4th nav toggle button reuses `.view-toggle-btn` from 2b, unchanged.

## Testing

- **Unit (Vitest):** none of this sub-project's logic is pure/stateless in the way `board-utils.js`'s functions are (it's almost entirely CRUD + one server-side function) — no new unit-testable pure functions are introduced.
- **Integration:** a new `board/test/staff-invite.test.js`, following the existing pattern in `board/test/` (real calls against the live Supabase project via the service-role key for setup/teardown). Covers: (1) a non-Owner JWT calling the edge function gets 403 and no `profiles`/`auth.users` row is created; (2) a valid Owner invite creates both rows correctly; (3) a deactivated Owner's JWT is rejected (403) even though the JWT itself is still validly signed; (4) after setting `active = false` on a PM/Editor test profile, `current_profile_role()` returns `null` for that user and a representative RLS-gated query (e.g. reading `projects`) returns zero rows.
- **No automated e2e** — same documented, deliberate gap as 2a/2b (no Playwright browsers in this environment). Manual verification via the `run` skill: invite a real test address, confirm the email arrives and the set-password flow works, confirm the new account can log in and see only what its role allows, deactivate it and confirm login is blocked, reactivate and confirm access returns, assign the account to a project via the picker and confirm it shows up in Kanban/List/Calendar.

## Out of Scope (this sub-project)

- Inviting another Owner — a second Owner account is a rare, high-stakes action; if ever needed, done directly in the Supabase dashboard, not through this UI.
- Self-service profile editing (staff changing their own name/password) — not requested; Supabase Auth's own password-reset flow already covers "I forgot my password" if it comes up.
- Bulk invite / CSV import of staff — the studio has a handful of staff, not a roster requiring bulk tooling.
- Any change to Kanban/List/Calendar's own behavior beyond the assignment picker being added to the project modal.
