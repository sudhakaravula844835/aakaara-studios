# Project Board — Foundation Design Spec
**Date:** 2026-07-27
**Project:** Aakaara Studios — Project Board (production CRM), sub-project 1 of 6
**Files affected:** new `/board` directory (schema/config only in this sub-project; no board UI yet)

---

## Context

This is the first of six sequential sub-projects that together build a Jira-style project management board tracking each wedding from booking through final delivery, for four roles (Owner, Project Manager, Editor, Client). The full breakdown, agreed with the user before this spec was written:

1. **Foundation** (this spec) — Supabase schema, RLS policies, auth for all 4 roles, client magic-link mechanism. No real UI yet.
2. **Owner/PM board** — authenticated Kanban + list view, full CRUD, realtime sync, activity feed/comments, calendar view.
3. **Client magic-link view** — scoped read-mostly page, photo-selection + song-list edit rights.
4. **Editor view** — scoped to assigned projects, editing-status + licensing fields.
5. **Notifications** — in-app activity indicator + email (client/editor activity → Owner/PM; stage change → client).
6. **Excel import tool** — bulk migration of the existing project spreadsheet.

Branding is applied as each UI sub-project is built (not a separate polish pass). Netlify/GitHub deploy is wired up during this Foundation sub-project so later work targets a real environment from the start.

**Relationship to the existing quote CRM** (`admin/dashboard.html`, localStorage-based, spec at `docs/specs/2026-05-20-crm-dashboard-design.md`): that system tracks the *pre-booking sales pipeline* (quote sent → confirmed → rejected). This new board is the *successor* — it eventually replaces the quote CRM entirely. A confirmed quote becomes a `projects` row at the `booked` stage. This Foundation schema absorbs the fields the quote CRM currently owns (client contact, quoted/confirmed price, deposit) so there is one source of truth going forward, not two systems to keep in sync. Migrating existing localStorage quote data into this schema is handled by sub-project 6 (Excel import tool can also import the quote CRM's CSV export), not by this spec.

---

## Decisions Made During Brainstorming

| Question | Decision |
|---|---|
| Tracking granularity | Whole-project level. One card, one pipeline stage per wedding. Sub-events (Haldi, Sangeet, Wedding, Reception) are metadata + have their own photo-selection progress, but do not each have an independent pipeline stage. |
| Repo/hosting | New `/board` folder in this repo (`aakaara-site-v2`), deployed as part of the same Netlify site — not a separate repo. |
| Client link lifetime | Permanent by default, but revocable/regenerable by Owner/PM at any time (old token stops working immediately). |
| Editor/PM account provisioning | Owner invites by email via Supabase Auth's invite flow; invitee sets their own password. |
| Multi-editor field scoping | One shared "Editor" permission set. Assignment (`project_editors`) controls which *projects* an editor sees, not which *fields* within a project — any editor assigned to a project can touch all editing-related fields. |
| Client access model | RPC-gateway (Approach A), not scoped-JWT (Approach B). Base tables stay under normal RLS for authenticated roles only; all client (token-based) reads/writes go through SECURITY DEFINER Postgres functions that validate the token internally. Trade-off accepted: the client's own page does not get Supabase Realtime live-sync (their own edits show immediately since it's their own action; they wouldn't see someone else's change appear without a refresh). The Owner/PM dashboard — the actual "see it reflected immediately" requirement — gets full Realtime since it's on real authenticated Supabase sessions. |

---

## Data Model

```sql
-- Extends auth.users; one row per Owner/PM/Editor account
profiles (
  id            uuid primary key references auth.users(id),
  role          text not null check (role in ('owner','pm','editor')),
  full_name     text not null,
  email         text not null,
  created_at    timestamptz not null default now()
)

projects (
  id                        uuid primary key default gen_random_uuid(),
  client_name               text not null,
  client_email              text,
  client_phone              text,
  stage                     text not null default 'booked'
                              check (stage in ('booked','shoot_completed','raw_delivered',
                                'photo_selection','video_editing','song_finalization',
                                'final_delivery','completed')),
  video_editing_substatus   text check (video_editing_substatus in
                                ('not_started','in_progress','client_review','revisions','final')),
  package_tier              text,
  hours_booked              numeric,
  quoted_price              numeric,
  confirmed_price           numeric,
  deposit_paid              boolean,
  balance_paid              boolean,
  pm_id                     uuid references profiles(id),
  contract_url              text,
  quote_pdf_url             text,
  raw_delivered_at          date,
  raw_delivery_link         text,
  client_access_token       uuid not null default gen_random_uuid(),
  token_revoked             boolean not null default false,
  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now()
)
create unique index on projects (client_access_token);

sub_events (
  id                    uuid primary key default gen_random_uuid(),
  project_id            uuid not null references projects(id) on delete cascade,
  name                  text not null,           -- 'Haldi' | 'Sangeet' | 'Wedding' | 'Reception' | custom
  event_date            date,
  venue                 text,
  photo_selection_status text default 'not_started'
                          check (photo_selection_status in ('not_started','in_progress','complete')),
  photo_selected_count  integer default 0,
  photo_total_count     integer default 0
)

project_editors (            -- join table: multi-editor assignment
  id           uuid primary key default gen_random_uuid(),
  project_id   uuid not null references projects(id) on delete cascade,
  editor_id    uuid not null references profiles(id) on delete cascade,
  unique (project_id, editor_id)
)

songs (
  id                 uuid primary key default gen_random_uuid(),
  project_id         uuid not null references projects(id) on delete cascade,
  sub_event_id       uuid references sub_events(id) on delete set null,
  title              text not null,
  artist             text,
  license_confirmed  boolean not null default false,
  created_at         timestamptz not null default now()
)

activity_log (
  id             uuid primary key default gen_random_uuid(),
  project_id     uuid not null references projects(id) on delete cascade,
  actor_role     text not null,      -- 'owner' | 'pm' | 'editor' | 'client'
  actor_label    text not null,      -- display name at time of action
  field_changed  text not null,
  old_value      text,
  new_value      text,
  created_at     timestamptz not null default now()
)

comments (
  id            uuid primary key default gen_random_uuid(),
  project_id    uuid not null references projects(id) on delete cascade,
  author_role   text not null,
  author_label  text not null,
  body          text not null,
  created_at    timestamptz not null default now()
)
```

`activity_log` rows are written automatically (via trigger on `projects`/`sub_events`/`songs` UPDATE for Owner/PM direct writes, and explicitly inside each RPC function for Editor/Client writes) — never hand-maintained by the UI. This is what powers the "who changed what, when" requirement.

---

## Auth & Roles

- **Owner/PM/Editor**: standard Supabase Auth, email + password. `profiles.role` gates what they can do.
- **Owner**: bootstrapped once by hand (direct SQL insert after creating the first Supabase Auth user) — no self-serve owner signup.
- **PM/Editor**: created via Supabase Auth's invite-by-email flow, triggered by the Owner from the board UI (built in sub-project 2) via a Netlify function that holds the service-role key. The invitee clicks the emailed link and sets their own password. No shared/manually-distributed credentials.
- **Client**: no Supabase Auth account. Identity is entirely the possession of `projects.client_access_token` in their URL (`/board/client/<token>`).

---

## RLS & Permission Enforcement

Postgres RLS is row-level, not column-level, so it cannot natively express "editor can change `stage` but not `confirmed_price`" on the same table. Two different write paths are used depending on how much access a role needs, kept as one consistent mechanism across both non-Owner/PM roles:

- **Owner/PM** — direct table grants. RLS policies on every table allow full SELECT/UPDATE/INSERT/DELETE when `auth.uid()` maps to a `profiles` row with `role in ('owner','pm')`.
- **Editor** — no direct SELECT grant on `projects` at all, since RLS can't hide individual columns and the requirement is "cannot see... financials." Instead, editors read through `editor_project_view` — a view over `projects` that joins `project_editors` (so it's automatically row-scoped to their assignments) and omits `quoted_price`, `confirmed_price`, `deposit_paid`, `balance_paid`, `contract_url`, and `quote_pdf_url`. Dependent tables (`sub_events`, `songs`, `activity_log`, `comments`) have no financial columns, so those keep normal row-scoped SELECT grants (via the `project_editors` join). All *writes* go through SECURITY DEFINER RPC functions (`update_editing_status`, `set_song_license`, `post_comment`) that internally re-check the assignment and only touch the specific columns each function is meant for. No direct UPDATE grant on `projects`/`songs` for the editor role.
- **Client** — no RLS grants at all on the base tables (not even SELECT). All access is through SECURITY DEFINER RPC functions that take `client_access_token` as their first argument, validate it against `projects.client_access_token` and `token_revoked = false`, and only then read/write the specific columns that function is meant for. `get_project_by_token` also omits the financial columns from its return shape — the client was never meant to see itemized pricing here in the first place (that lives in the quote/contract PDFs), only status.

### Client RPC Functions (Foundation scope: signatures + implementation, no UI)

| Function | Purpose |
|---|---|
| `get_project_by_token(token uuid)` | Returns project + sub_events + songs + comments for display. Read-only. |
| `update_photo_selection(token uuid, sub_event_id uuid, selected_count int)` | Client marks photos selected for a sub-event. |
| `submit_song(token uuid, sub_event_id uuid, title text, artist text)` | Client adds a song to the list. Cannot set `license_confirmed` — that stays Owner/PM/Editor-only. |
| `post_client_comment(token uuid, body text)` | Adds a `comments` row with `author_role = 'client'`. |
| `regenerate_client_token(project_id uuid)` | Owner/PM-only (standard RLS-gated, not token-gated). Issues a new `client_access_token` and sets `token_revoked = false`; effectively invalidates the old link. |

Every function that mutates data also inserts the corresponding `activity_log` row before returning.

---

## Deploy & Environment

- Lives at `/board` inside this repo (`aakaara-site-v2`), deployed as part of the existing Netlify site — not a separate repo/site.
- `SUPABASE_URL` and the Supabase anon key are safe to ship client-side (standard Supabase model; RLS is the actual gate).
- The Supabase **service-role key** (needed only for the PM/Editor invite flow) is never shipped to the client — it lives in Netlify environment variables and is used only inside a Netlify function, following the same secret-handling pattern already established by `netlify/edge-functions/admin-auth.ts`.
- This sub-project provisions: the Supabase project, the SQL migration for the schema above, RLS policies, the five RPC functions, and Netlify env var wiring. It does not include the invite-flow Netlify function itself (that ships with sub-project 2, alongside the UI that triggers it).

---

## Testing

RLS and RPC-gateway logic are security boundaries, not just business logic — a bug here means a client seeing another client's wedding, or an editor editing financials. Testing plan:

- **Integration tests (Vitest)** against a local Supabase instance (`supabase start`, via Supabase CLI), asserting role-boundary behavior directly against the database rather than mocking it:
  - Editor cannot `SELECT` a project they're not assigned to.
  - Editor cannot directly `UPDATE` `projects.confirmed_price` (no grant exists).
  - Client RPC calls reject a token that doesn't match any project.
  - Client RPC calls reject a token where `token_revoked = true`.
  - `regenerate_client_token` invalidates the old token and the new one works.
  - Every RPC mutation produces exactly one `activity_log` row with correct `actor_role`.
- Tests live under `board/` (mirroring how `admin/dashboard.test.js` sits next to `admin/`) and run via `npm run test:unit` alongside existing suites.

---

## Out of Scope (this sub-project)

- Any board UI (Kanban, list view, client page, editor page) — sub-projects 2–4.
- The invite-flow Netlify function itself — sub-project 2.
- Email notifications — sub-project 5.
- Excel/quote-CRM data import — sub-project 6.
- Payment *enforcement* (e.g., blocking final delivery until `balance_paid`) — the fields exist here, but any UI gate/warning logic is a board (sub-project 2) concern.
