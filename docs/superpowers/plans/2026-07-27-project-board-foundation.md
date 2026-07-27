# Project Board Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Provision the Supabase schema, RLS policies, RPC functions, and auth foundation for the Aakaara Studios project board — no UI yet, just a tested, secure data layer that sub-projects 2–6 build on.

**Architecture:** Supabase Postgres with RLS enabled on every table. Owner/PM get direct table access gated by row policies. Editors get a column-restricted view (`editor_project_view`) for reads and narrow SECURITY DEFINER RPC functions for writes, since RLS can't restrict individual columns. Clients (no Supabase Auth account at all) get an RPC-only gateway keyed by a per-project token (`client_access_token`), validated inside each function before any row is touched. All mutations are captured in `activity_log` — either automatically via trigger (Owner/PM/Editor writes, all of which have a real `auth.uid()`) or explicitly inside the RPC function itself (Client writes, which run as the anonymous Postgres role and have no `auth.uid()`).

**Tech Stack:** Supabase (Postgres + Auth), `@supabase/supabase-js` for tests, Vitest for integration tests against the real hosted dev project (not local Docker — see Global Constraints).

**Design spec:** `docs/superpowers/specs/2026-07-27-project-board-foundation-design.md`

## Global Constraints

- No Docker/Supabase CLI available in this environment — integration tests run against the actual hosted Supabase dev project via `@supabase/supabase-js`, using a service-role client for seed/teardown and per-role signed-in clients for RLS assertions. Each test cleans up its own rows.
- Every SECURITY DEFINER function must set `search_path = public` explicitly (prevents search-path hijacking).
- All SQL identifiers use snake_case, matching the spec's schema.
- `board/.env` (holds the service-role key) must never be committed — verify `.gitignore` covers it before writing it.
- Three steps in this plan touch real infrastructure or need information only the user can provide (Supabase project creation in Task 1; the Owner account bootstrap in Task 7; Netlify env vars in Task 12) — all are marked as **STOP AND CONFIRM WITH USER** checkpoints. Do not proceed past them without explicit approval.
- Money fields are `numeric`, not `float`, per the schema in the design spec.

---

## Task 1: Provision the Supabase Project

**Files:** none (infrastructure only)

**Interfaces:**
- Produces: a Supabase `project_id`, project URL, and anon key that every later task depends on.

- [ ] **Step 1: List available organizations**

Call `mcp__claude_ai_Supabase__list_organizations`. If there's more than one organization, ask the user which one to use.

- [ ] **Step 2: Get the cost estimate and confirm with the user — STOP AND CONFIRM**

Call `mcp__claude_ai_Supabase__get_cost` for a new project in the chosen organization. Then call `mcp__claude_ai_Supabase__confirm_cost` with `type: "project"`, the returned `recurrence`, and `amount`. **Before calling `create_project`, show the user the exact cost/recurrence and get explicit approval.** Do not proceed on assumed approval.

- [ ] **Step 3: Create the project**

Call `mcp__claude_ai_Supabase__create_project` with:
- `name`: `"aakaara-board"`
- `region`: `"us-east-1"`
- `organization_id`: the org chosen in Step 1
- `confirm_cost_id`: the ID returned from Step 2

- [ ] **Step 4: Wait for the project to become active**

Poll `mcp__claude_ai_Supabase__get_project` with the new project's `id` until `status` is `ACTIVE_HEALTHY`. This can take a few minutes.

- [ ] **Step 5: Record connection details**

Call `mcp__claude_ai_Supabase__get_project_url` and `mcp__claude_ai_Supabase__get_publishable_keys` with the project id. Save the project id, URL, and anon/publishable key somewhere you'll reference in Task 8 (they are not secret and will be written into `board/.env.example` there — do not write the service-role key anywhere in the repo).

---

## Task 2: Core Schema Migration

**Files:**
- Create: `board/supabase/migrations/0001_schema.sql`

**Interfaces:**
- Produces: tables `profiles`, `projects`, `sub_events`, `project_editors`, `songs`, `activity_log`, `comments` — the column names in this task are referenced verbatim by every later task's SQL.

- [ ] **Step 1: Write the migration file**

```sql
-- board/supabase/migrations/0001_schema.sql

create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role in ('owner','pm','editor')),
  full_name text not null,
  email text not null,
  created_at timestamptz not null default now()
);

create table projects (
  id uuid primary key default gen_random_uuid(),
  client_name text not null,
  client_email text,
  client_phone text,
  stage text not null default 'booked'
    check (stage in ('booked','shoot_completed','raw_delivered','photo_selection',
      'video_editing','song_finalization','final_delivery','completed')),
  video_editing_substatus text
    check (video_editing_substatus in ('not_started','in_progress','client_review','revisions','final')),
  package_tier text,
  hours_booked numeric,
  quoted_price numeric,
  confirmed_price numeric,
  deposit_paid boolean,
  balance_paid boolean,
  pm_id uuid references profiles(id),
  contract_url text,
  quote_pdf_url text,
  raw_delivered_at date,
  raw_delivery_link text,
  client_access_token uuid not null default gen_random_uuid(),
  token_revoked boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index projects_client_access_token_idx on projects (client_access_token);

create table sub_events (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  name text not null,
  event_date date,
  venue text,
  photo_selection_status text not null default 'not_started'
    check (photo_selection_status in ('not_started','in_progress','complete')),
  photo_selected_count integer not null default 0,
  photo_total_count integer not null default 0
);

create table project_editors (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  editor_id uuid not null references profiles(id) on delete cascade,
  unique (project_id, editor_id)
);

create table songs (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  sub_event_id uuid references sub_events(id) on delete set null,
  title text not null,
  artist text,
  license_confirmed boolean not null default false,
  created_at timestamptz not null default now()
);

create table activity_log (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  actor_role text not null,
  actor_label text not null,
  field_changed text not null,
  old_value text,
  new_value text,
  created_at timestamptz not null default now()
);

create table comments (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  author_role text not null,
  author_label text not null,
  body text not null,
  created_at timestamptz not null default now()
);
```

- [ ] **Step 2: Apply the migration**

Call `mcp__claude_ai_Supabase__apply_migration` with `project_id` from Task 1, `name: "schema"`, and `query` set to the full contents of the file above.

- [ ] **Step 3: Verify the tables exist**

Call `mcp__claude_ai_Supabase__list_tables` with `project_id`, `schemas: ["public"]`, `verbose: true`. Confirm all 7 tables appear with the expected columns.

- [ ] **Step 4: Commit**

```bash
cd "/Users/sudhakaravula/Desktop/logo/files new version  draft 1/aakaara-site-v2"
git add board/supabase/migrations/0001_schema.sql
git commit -m "feat(board): create core project board schema"
```

---

## Task 3: RLS + Owner/PM Policies + Audit Logging

**Files:**
- Create: `board/supabase/migrations/0002_rls_owner_pm.sql`

**Interfaces:**
- Consumes: tables from Task 2.
- Produces: `current_profile_role()` function (used by every later policy/function in this plan), `set_updated_at()`, `log_project_changes()`, `log_child_changes()` trigger functions.

- [ ] **Step 1: Write the migration file**

```sql
-- board/supabase/migrations/0002_rls_owner_pm.sql

alter table profiles enable row level security;
alter table projects enable row level security;
alter table sub_events enable row level security;
alter table project_editors enable row level security;
alter table songs enable row level security;
alter table activity_log enable row level security;
alter table comments enable row level security;

create or replace function current_profile_role()
returns text
language sql
security definer
stable
set search_path = public
as $$
  select role from profiles where id = auth.uid();
$$;

-- profiles
create policy profiles_select_authenticated on profiles
  for select to authenticated
  using (true);

create policy profiles_all_owner on profiles
  for all to authenticated
  using (current_profile_role() = 'owner')
  with check (current_profile_role() = 'owner');

-- projects, sub_events, project_editors, songs, comments: owner/pm full access
create policy projects_all_owner_pm on projects
  for all to authenticated
  using (current_profile_role() in ('owner','pm'))
  with check (current_profile_role() in ('owner','pm'));

create policy sub_events_all_owner_pm on sub_events
  for all to authenticated
  using (current_profile_role() in ('owner','pm'))
  with check (current_profile_role() in ('owner','pm'));

create policy project_editors_all_owner_pm on project_editors
  for all to authenticated
  using (current_profile_role() in ('owner','pm'))
  with check (current_profile_role() in ('owner','pm'));

create policy songs_all_owner_pm on songs
  for all to authenticated
  using (current_profile_role() in ('owner','pm'))
  with check (current_profile_role() in ('owner','pm'));

create policy comments_all_owner_pm on comments
  for all to authenticated
  using (current_profile_role() in ('owner','pm'))
  with check (current_profile_role() in ('owner','pm'));

-- activity_log: owner/pm read (writes happen only via trigger/RPC, never direct insert)
create policy activity_log_select_owner_pm on activity_log
  for select to authenticated
  using (current_profile_role() in ('owner','pm'));

-- keep projects.updated_at current on every direct update
create or replace function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger projects_set_updated_at
  before update on projects
  for each row
  execute function set_updated_at();

-- Audit logging. Only fires for requests with a real auth.uid() (Owner/PM/Editor).
-- Client (anon-role, token-based) writes have auth.uid() = null and log themselves
-- explicitly inside their RPC functions (see Task 5) — this trigger intentionally
-- no-ops for those so we don't misattribute a client edit to "owner" or double-log it.
create or replace function log_project_changes()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_role text;
  actor_name text;
  key text;
  old_val text;
  new_val text;
  excluded_cols text[] := array['id', 'created_at', 'updated_at'];
begin
  if auth.uid() is null then
    return new;
  end if;

  actor_role := current_profile_role();
  select full_name into actor_name from profiles where id = auth.uid();

  for key in select jsonb_object_keys(to_jsonb(new))
  loop
    if key = any(excluded_cols) then
      continue;
    end if;
    old_val := to_jsonb(old) ->> key;
    new_val := to_jsonb(new) ->> key;
    if old_val is distinct from new_val then
      insert into activity_log (project_id, actor_role, actor_label, field_changed, old_value, new_value)
      values (new.id, actor_role, coalesce(actor_name, actor_role), key, old_val, new_val);
    end if;
  end loop;

  return new;
end;
$$;

create trigger projects_log_changes
  after update on projects
  for each row
  execute function log_project_changes();

create or replace function log_child_changes()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_role text;
  actor_name text;
  key text;
  old_val text;
  new_val text;
  excluded_cols text[] := array['id', 'project_id', 'created_at'];
begin
  if auth.uid() is null then
    return new;
  end if;

  actor_role := current_profile_role();
  select full_name into actor_name from profiles where id = auth.uid();

  for key in select jsonb_object_keys(to_jsonb(new))
  loop
    if key = any(excluded_cols) then
      continue;
    end if;
    old_val := to_jsonb(old) ->> key;
    new_val := to_jsonb(new) ->> key;
    if old_val is distinct from new_val then
      insert into activity_log (project_id, actor_role, actor_label, field_changed, old_value, new_value)
      values (new.project_id, actor_role, coalesce(actor_name, actor_role), key, old_val, new_val);
    end if;
  end loop;

  return new;
end;
$$;

create trigger sub_events_log_changes
  after update on sub_events
  for each row
  execute function log_child_changes();

create trigger songs_log_changes
  after update on songs
  for each row
  execute function log_child_changes();
```

- [ ] **Step 2: Apply the migration**

Call `apply_migration` with `name: "rls_owner_pm"` and the query above.

- [ ] **Step 3: Verify RLS is enabled**

Call `execute_sql` with:
```sql
select relname, relrowsecurity from pg_class
where relname in ('profiles','projects','sub_events','project_editors','songs','activity_log','comments');
```
Confirm `relrowsecurity` is `true` for all 7 rows.

- [ ] **Step 4: Commit**

```bash
git add board/supabase/migrations/0002_rls_owner_pm.sql
git commit -m "feat(board): enable RLS, owner/pm policies, and audit-log triggers"
```

---

## Task 4: Editor Access — Restricted View + RPC Writes

**Files:**
- Create: `board/supabase/migrations/0003_editor_access.sql`

**Interfaces:**
- Consumes: `current_profile_role()` from Task 3.
- Produces: `editor_project_view`, `assert_editor_assigned(uuid)`, `update_editing_status(uuid, text)`, `set_song_license(uuid, boolean)`, `post_comment(uuid, text)` — RPC names/signatures used by sub-project 4 (editor UI).

- [ ] **Step 1: Write the migration file**

```sql
-- board/supabase/migrations/0003_editor_access.sql

-- Column-restricted, row-scoped read path for editors. Deliberately created
-- WITHOUT security_invoker so it runs with definer privileges against `projects`
-- (which has no editor SELECT policy at all) — the join to project_editors and
-- the column list are what enforce access here, not the caller's own grants.
create view editor_project_view
with (security_invoker = false)
as
select
  p.id, p.client_name, p.client_email, p.client_phone, p.stage,
  p.video_editing_substatus, p.package_tier, p.hours_booked, p.pm_id,
  p.raw_delivered_at, p.raw_delivery_link, p.created_at, p.updated_at
from projects p
join project_editors pe on pe.project_id = p.id
where pe.editor_id = auth.uid();

grant select on editor_project_view to authenticated;

create policy sub_events_select_editor on sub_events
  for select to authenticated
  using (
    current_profile_role() = 'editor'
    and exists (select 1 from project_editors pe where pe.project_id = sub_events.project_id and pe.editor_id = auth.uid())
  );

create policy songs_select_editor on songs
  for select to authenticated
  using (
    current_profile_role() = 'editor'
    and exists (select 1 from project_editors pe where pe.project_id = songs.project_id and pe.editor_id = auth.uid())
  );

create policy activity_log_select_editor on activity_log
  for select to authenticated
  using (
    current_profile_role() = 'editor'
    and exists (select 1 from project_editors pe where pe.project_id = activity_log.project_id and pe.editor_id = auth.uid())
  );

create policy comments_select_editor on comments
  for select to authenticated
  using (
    current_profile_role() = 'editor'
    and exists (select 1 from project_editors pe where pe.project_id = comments.project_id and pe.editor_id = auth.uid())
  );

create policy project_editors_select_own on project_editors
  for select to authenticated
  using (current_profile_role() = 'editor' and editor_id = auth.uid());

create or replace function assert_editor_assigned(p_project_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if current_profile_role() <> 'editor' then
    raise exception 'not an editor';
  end if;
  if not exists (
    select 1 from project_editors
    where project_id = p_project_id and editor_id = auth.uid()
  ) then
    raise exception 'editor not assigned to this project';
  end if;
end;
$$;

-- Editors may only advance the substatus while the project is already in the
-- video_editing stage — moving the project INTO that stage is a PM decision.
create or replace function update_editing_status(p_project_id uuid, p_substatus text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_current_stage text;
begin
  perform assert_editor_assigned(p_project_id);
  if p_substatus not in ('not_started','in_progress','client_review','revisions','final') then
    raise exception 'invalid substatus: %', p_substatus;
  end if;

  select stage into v_current_stage from projects where id = p_project_id;
  if v_current_stage <> 'video_editing' then
    raise exception 'project is not currently in the video_editing stage';
  end if;

  update projects set video_editing_substatus = p_substatus where id = p_project_id;
end;
$$;

grant execute on function update_editing_status(uuid, text) to authenticated;

create or replace function set_song_license(p_song_id uuid, p_license_confirmed boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_project_id uuid;
begin
  select project_id into v_project_id from songs where id = p_song_id;
  if v_project_id is null then
    raise exception 'song not found';
  end if;
  perform assert_editor_assigned(v_project_id);

  update songs set license_confirmed = p_license_confirmed where id = p_song_id;
end;
$$;

grant execute on function set_song_license(uuid, boolean) to authenticated;

create or replace function post_comment(p_project_id uuid, p_body text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_name text;
begin
  perform assert_editor_assigned(p_project_id);
  if length(trim(p_body)) = 0 then
    raise exception 'comment body cannot be empty';
  end if;
  select full_name into actor_name from profiles where id = auth.uid();
  insert into comments (project_id, author_role, author_label, body)
  values (p_project_id, 'editor', coalesce(actor_name, 'editor'), p_body);
end;
$$;

grant execute on function post_comment(uuid, text) to authenticated;
```

- [ ] **Step 2: Apply the migration**

Call `apply_migration` with `name: "editor_access"` and the query above.

- [ ] **Step 3: Verify the view excludes financial columns**

Call `execute_sql`:
```sql
select column_name from information_schema.columns where table_name = 'editor_project_view';
```
Confirm `quoted_price`, `confirmed_price`, `deposit_paid`, `balance_paid`, `contract_url`, `quote_pdf_url` are **not** in the result.

- [ ] **Step 4: Commit**

```bash
git add board/supabase/migrations/0003_editor_access.sql
git commit -m "feat(board): add editor-scoped view and RPC write functions"
```

---

## Task 5: Client Magic-Link RPC Gateway

**Files:**
- Create: `board/supabase/migrations/0004_client_rpc.sql`

**Interfaces:**
- Consumes: `current_profile_role()` from Task 3.
- Produces: `assert_valid_client_token(uuid)`, `get_project_by_token(uuid)`, `update_photo_selection(uuid, uuid, integer)`, `submit_song(uuid, uuid, text, text)`, `post_client_comment(uuid, text)`, `regenerate_client_token(uuid)` — RPC names/signatures used by sub-project 3 (client UI) and sub-project 2 (regenerate button).

- [ ] **Step 1: Write the migration file**

```sql
-- board/supabase/migrations/0004_client_rpc.sql

create or replace function assert_valid_client_token(p_token uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_project_id uuid;
begin
  select id into v_project_id from projects
  where client_access_token = p_token and token_revoked = false;
  if v_project_id is null then
    raise exception 'invalid or revoked token';
  end if;
  return v_project_id;
end;
$$;

create or replace function get_project_by_token(p_token uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_project_id uuid;
  result jsonb;
begin
  v_project_id := assert_valid_client_token(p_token);

  select jsonb_build_object(
    'project', (
      select jsonb_build_object(
        'id', p.id, 'client_name', p.client_name, 'stage', p.stage,
        'video_editing_substatus', p.video_editing_substatus,
        'raw_delivered_at', p.raw_delivered_at, 'raw_delivery_link', p.raw_delivery_link
      )
      from projects p where p.id = v_project_id
    ),
    'sub_events', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', se.id, 'name', se.name, 'event_date', se.event_date, 'venue', se.venue,
        'photo_selection_status', se.photo_selection_status,
        'photo_selected_count', se.photo_selected_count,
        'photo_total_count', se.photo_total_count
      )), '[]'::jsonb)
      from sub_events se where se.project_id = v_project_id
    ),
    'songs', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', s.id, 'sub_event_id', s.sub_event_id, 'title', s.title, 'artist', s.artist,
        'license_confirmed', s.license_confirmed
      )), '[]'::jsonb)
      from songs s where s.project_id = v_project_id
    ),
    'comments', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'author_role', c.author_role, 'author_label', c.author_label,
        'body', c.body, 'created_at', c.created_at
      ) order by c.created_at), '[]'::jsonb)
      from comments c where c.project_id = v_project_id
    )
  ) into result;

  return result;
end;
$$;

grant execute on function get_project_by_token(uuid) to anon, authenticated;

create or replace function update_photo_selection(p_token uuid, p_sub_event_id uuid, p_selected_count integer)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_project_id uuid;
  v_total integer;
  v_new_status text;
begin
  v_project_id := assert_valid_client_token(p_token);

  select photo_total_count into v_total
  from sub_events
  where id = p_sub_event_id and project_id = v_project_id;

  if v_total is null then
    raise exception 'sub-event not found for this project';
  end if;
  if p_selected_count < 0 or p_selected_count > v_total then
    raise exception 'selected count must be between 0 and %', v_total;
  end if;

  v_new_status := case
    when p_selected_count = 0 then 'not_started'
    when p_selected_count = v_total then 'complete'
    else 'in_progress'
  end;

  update sub_events
  set photo_selected_count = p_selected_count, photo_selection_status = v_new_status
  where id = p_sub_event_id;

  insert into activity_log (project_id, actor_role, actor_label, field_changed, old_value, new_value)
  select v_project_id, 'client', client_name, 'photo_selected_count', null, p_selected_count::text
  from projects where id = v_project_id;
end;
$$;

grant execute on function update_photo_selection(uuid, uuid, integer) to anon, authenticated;

create or replace function submit_song(p_token uuid, p_sub_event_id uuid, p_title text, p_artist text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_project_id uuid;
  v_song_id uuid;
begin
  v_project_id := assert_valid_client_token(p_token);

  if p_sub_event_id is not null and not exists (
    select 1 from sub_events where id = p_sub_event_id and project_id = v_project_id
  ) then
    raise exception 'sub-event not found for this project';
  end if;
  if length(trim(p_title)) = 0 then
    raise exception 'song title cannot be empty';
  end if;

  insert into songs (project_id, sub_event_id, title, artist, license_confirmed)
  values (v_project_id, p_sub_event_id, p_title, p_artist, false)
  returning id into v_song_id;

  insert into activity_log (project_id, actor_role, actor_label, field_changed, old_value, new_value)
  select v_project_id, 'client', client_name, 'song_added', null, p_title
  from projects where id = v_project_id;

  return v_song_id;
end;
$$;

grant execute on function submit_song(uuid, uuid, text, text) to anon, authenticated;

create or replace function post_client_comment(p_token uuid, p_body text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_project_id uuid;
  v_client_name text;
begin
  v_project_id := assert_valid_client_token(p_token);
  if length(trim(p_body)) = 0 then
    raise exception 'comment body cannot be empty';
  end if;

  select client_name into v_client_name from projects where id = v_project_id;

  insert into comments (project_id, author_role, author_label, body)
  values (v_project_id, 'client', v_client_name, p_body);
end;
$$;

grant execute on function post_client_comment(uuid, text) to anon, authenticated;

-- Owner/PM only. security invoker (the default) so the underlying UPDATE still
-- has to satisfy the projects_all_owner_pm RLS policy from Task 3 — the role
-- check below is defense in depth, not the only gate.
create or replace function regenerate_client_token(p_project_id uuid)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_new_token uuid := gen_random_uuid();
begin
  if current_profile_role() not in ('owner','pm') then
    raise exception 'only owner or pm may regenerate a client access token';
  end if;

  update projects
  set client_access_token = v_new_token, token_revoked = false
  where id = p_project_id;

  return v_new_token;
end;
$$;

grant execute on function regenerate_client_token(uuid) to authenticated;
```

- [ ] **Step 2: Apply the migration**

Call `apply_migration` with `name: "client_rpc"` and the query above.

- [ ] **Step 3: Smoke-test with a throwaway project**

Call `execute_sql`:
```sql
insert into projects (client_name) values ('Smoke Test Client') returning id, client_access_token;
```
Note the returned token, then call `execute_sql`:
```sql
select get_project_by_token('<token from above>'::uuid);
```
Confirm it returns the project JSON with no `quoted_price`/`confirmed_price` keys. Then delete the smoke-test row:
```sql
delete from projects where client_name = 'Smoke Test Client';
```

- [ ] **Step 4: Commit**

```bash
git add board/supabase/migrations/0004_client_rpc.sql
git commit -m "feat(board): add client magic-link RPC gateway functions"
```

---

## Task 6: Security Advisor Check

**Files:** none

- [ ] **Step 1: Run the security advisor**

Call `mcp__claude_ai_Supabase__get_advisors` with `project_id` and `type: "security"`.

- [ ] **Step 2: Address any findings**

For each finding: if it's a false positive given the design in this plan (e.g., it may flag `editor_project_view` for not using `security_invoker` — that's intentional, see Task 4's comment), note why in a commit message rather than changing it. If it's a real gap (e.g., a table with RLS enabled but no policies at all, which silently blocks everyone including owner/pm), fix it with a follow-up migration file (`board/supabase/migrations/0005_security_fixes.sql`) and re-run the advisor to confirm.

- [ ] **Step 3: Commit if any fixes were made**

```bash
git add board/supabase/migrations/
git commit -m "fix(board): address security advisor findings"
```

---

## Task 7: Bootstrap the Owner Account — STOP AND CONFIRM

**Files:** none (one-time manual account creation)

**Interfaces:**
- Consumes: `profiles` table from Task 2.
- Produces: one `profiles` row with `role = 'owner'`, tied to a real Supabase Auth account for Sudhakar — every later Owner-only capability (invite PM/Editor, regenerate client tokens) depends on this account existing.

There's no MCP tool for creating a Supabase Auth user directly (only SQL execution against the database), so this step is a short manual round-trip with the user rather than something to script.

- [ ] **Step 1: Ask the user for their name and the email they want to use for the Owner login — STOP AND CONFIRM**

Ask directly: "What email should the Owner (your) login use, and what should the display name be?" Do not guess or use a placeholder.

- [ ] **Step 2: Have the user create the Supabase Auth account**

Direct the user to the Supabase dashboard for the project created in Task 1: **Authentication → Users → Add User**, using the email from Step 1 and a password of their choosing. Ask them to paste back the generated User UID shown in the dashboard once created.

- [ ] **Step 3: Insert the corresponding profiles row**

Call `mcp__claude_ai_Supabase__execute_sql` with the project id and:
```sql
insert into profiles (id, role, full_name, email)
values ('<user-uid-from-step-2>', 'owner', '<name-from-step-1>', '<email-from-step-1>');
```

- [ ] **Step 4: Verify**

Call `execute_sql`:
```sql
select id, role, full_name, email from profiles where role = 'owner';
```
Confirm exactly one row, matching what the user provided.

---

## Task 8: Integration Test Harness

**Files:**
- Create: `board/.env.example`
- Create: `board/test/helpers.js`
- Modify: `/Users/sudhakaravula/Desktop/logo/files new version  draft 1/aakaara-site-v2/package.json`
- Modify: `/Users/sudhakaravula/Desktop/logo/files new version  draft 1/aakaara-site-v2/vitest.config.js`
- Modify: `/Users/sudhakaravula/Desktop/logo/files new version  draft 1/aakaara-site-v2/.gitignore` (only if `board/.env` isn't already covered)

**Interfaces:**
- Produces: `adminClient`, `createTestProfile(role)`, `deleteTestProfile(id)`, `createTestProject(overrides)`, `deleteTestProject(id)` from `board/test/helpers.js`, used by Tasks 8–10.

- [ ] **Step 1: Confirm `.env` files are gitignored**

```bash
cd "/Users/sudhakaravula/Desktop/logo/files new version  draft 1/aakaara-site-v2"
grep -E "^\.env|^\*\.env" .gitignore
```

If nothing matches, add these lines to `.gitignore`:
```
.env
board/.env
```

- [ ] **Step 2: Write `board/.env.example`**

```
SUPABASE_URL=
SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
```

Then create `board/.env` (real values from Task 1's project + the service-role key from the Supabase dashboard's API settings for this project) — this file is gitignored per Step 1 and must never be committed.

- [ ] **Step 3: Add dependencies**

```bash
npm install --save-dev @supabase/supabase-js dotenv
```

- [ ] **Step 4: Add a Vitest setup file that loads `board/.env`**

Create `board/test/vitest.setup.js`:
```js
import { config } from 'dotenv';
import { resolve } from 'path';

config({ path: resolve(__dirname, '../.env') });
```

- [ ] **Step 5: Wire the setup file into `vitest.config.js`**

Modify `vitest.config.js`:
```js
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    include: ['**/*.test.js'],
    exclude: ['**/node_modules/**', '**/dist/**', '**/*.spec.js', '**/.claude/**'],
    setupFiles: ['./board/test/vitest.setup.js'],
  },
});
```

- [ ] **Step 6: Write `board/test/helpers.js`**

```js
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error(
    'Missing SUPABASE_URL / SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY — copy board/.env.example to board/.env and fill it in.'
  );
}

export const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

let testCounter = 0;

export async function createTestProfile(role) {
  testCounter += 1;
  const email = `test-${role}-${Date.now()}-${testCounter}@example.com`;
  const password = 'TestPassword123!';

  const { data: userData, error: userError } = await adminClient.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (userError) throw userError;

  const { error: profileError } = await adminClient
    .from('profiles')
    .insert({ id: userData.user.id, role, full_name: `Test ${role}`, email });
  if (profileError) throw profileError;

  const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  const { error: signInError } = await client.auth.signInWithPassword({ email, password });
  if (signInError) throw signInError;

  return { id: userData.user.id, email, client };
}

export async function deleteTestProfile(id) {
  await adminClient.auth.admin.deleteUser(id);
}

export async function createTestProject(overrides = {}) {
  const { data, error } = await adminClient
    .from('projects')
    .insert({ client_name: 'Test Client', ...overrides })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteTestProject(id) {
  await adminClient.from('projects').delete().eq('id', id);
}
```

- [ ] **Step 7: Verify the harness connects**

Create a temporary file `board/test/_smoke.test.js`:
```js
import { describe, it, expect } from 'vitest';
import { createTestProject, deleteTestProject } from './helpers.js';

describe('test harness smoke test', () => {
  it('can create and delete a project via the admin client', async () => {
    const project = await createTestProject();
    expect(project.client_name).toBe('Test Client');
    await deleteTestProject(project.id);
  });
});
```

Run: `npm run test:unit -- board/test/_smoke.test.js`
Expected: 1 passing test. Then delete `board/test/_smoke.test.js` — it was only to verify the harness.

- [ ] **Step 8: Commit**

```bash
git add board/.env.example board/test/helpers.js board/test/vitest.setup.js package.json package-lock.json vitest.config.js .gitignore
git commit -m "test(board): add Supabase integration test harness"
```

---

## Task 9: Integration Tests — Owner/PM Access & Audit Log

**Files:**
- Create: `board/test/owner-pm-access.test.js`

**Interfaces:**
- Consumes: `helpers.js` from Task 8.

- [ ] **Step 1: Write the tests**

```js
import { describe, it, expect, afterEach } from 'vitest';
import {
  createTestProfile, deleteTestProfile,
  createTestProject, deleteTestProject,
  adminClient,
} from './helpers.js';

describe('owner/pm access', () => {
  let profile;
  let project;

  afterEach(async () => {
    if (project) await deleteTestProject(project.id);
    if (profile) await deleteTestProfile(profile.id);
    project = null;
    profile = null;
  });

  it('owner can select all projects', async () => {
    profile = await createTestProfile('owner');
    project = await createTestProject();

    const { data, error } = await profile.client.from('projects').select('id').eq('id', project.id);
    expect(error).toBeNull();
    expect(data).toHaveLength(1);
  });

  it('pm can update a project stage and it is reflected immediately', async () => {
    profile = await createTestProfile('pm');
    project = await createTestProject();

    const { error } = await profile.client
      .from('projects')
      .update({ stage: 'shoot_completed' })
      .eq('id', project.id);
    expect(error).toBeNull();

    const { data } = await adminClient.from('projects').select('stage').eq('id', project.id).single();
    expect(data.stage).toBe('shoot_completed');
  });

  it('a pm stage update writes an activity_log row attributed to pm', async () => {
    profile = await createTestProfile('pm');
    project = await createTestProject();

    await profile.client.from('projects').update({ stage: 'shoot_completed' }).eq('id', project.id);

    const { data } = await adminClient
      .from('activity_log')
      .select('actor_role, field_changed, old_value, new_value')
      .eq('project_id', project.id)
      .eq('field_changed', 'stage');

    expect(data).toHaveLength(1);
    expect(data[0].actor_role).toBe('pm');
    expect(data[0].old_value).toBe('booked');
    expect(data[0].new_value).toBe('shoot_completed');
  });

  it('owner can post a comment directly', async () => {
    profile = await createTestProfile('owner');
    project = await createTestProject();

    const { error } = await profile.client
      .from('comments')
      .insert({ project_id: project.id, author_role: 'owner', author_label: 'Sudhakar', body: 'Looks good' });
    expect(error).toBeNull();
  });
});
```

- [ ] **Step 2: Run the tests**

Run: `npm run test:unit -- board/test/owner-pm-access.test.js`
Expected: 4 passing tests.

- [ ] **Step 3: Commit**

```bash
git add board/test/owner-pm-access.test.js
git commit -m "test(board): verify owner/pm full access and audit logging"
```

---

## Task 10: Integration Tests — Editor Scoping

**Files:**
- Create: `board/test/editor-access.test.js`

**Interfaces:**
- Consumes: `helpers.js` from Task 8; `editor_project_view`, `update_editing_status`, `set_song_license`, `post_comment` from Task 4.

- [ ] **Step 1: Write the tests**

```js
import { describe, it, expect, afterEach } from 'vitest';
import {
  createTestProfile, deleteTestProfile,
  createTestProject, deleteTestProject,
  adminClient,
} from './helpers.js';

describe('editor access', () => {
  let editor;
  let project;

  afterEach(async () => {
    if (project) await deleteTestProject(project.id);
    if (editor) await deleteTestProfile(editor.id);
    editor = null;
    project = null;
  });

  it('editor sees zero rows querying projects directly, even for an assigned project', async () => {
    editor = await createTestProfile('editor');
    project = await createTestProject({ confirmed_price: 5000 });
    await adminClient.from('project_editors').insert({ project_id: project.id, editor_id: editor.id });

    const { data } = await editor.client.from('projects').select('id').eq('id', project.id);
    expect(data).toHaveLength(0);
  });

  it('editor sees the project via editor_project_view without financial columns', async () => {
    editor = await createTestProfile('editor');
    project = await createTestProject({ confirmed_price: 5000 });
    await adminClient.from('project_editors').insert({ project_id: project.id, editor_id: editor.id });

    const { data, error } = await editor.client.from('editor_project_view').select('*').eq('id', project.id);
    expect(error).toBeNull();
    expect(data).toHaveLength(1);
    expect(data[0]).not.toHaveProperty('confirmed_price');
    expect(data[0]).not.toHaveProperty('quoted_price');
  });

  it('editor cannot see a project they are not assigned to', async () => {
    editor = await createTestProfile('editor');
    project = await createTestProject();

    const { data } = await editor.client.from('editor_project_view').select('*').eq('id', project.id);
    expect(data).toHaveLength(0);
  });

  it('editor cannot directly update projects (no write grant path)', async () => {
    editor = await createTestProfile('editor');
    project = await createTestProject();
    await adminClient.from('project_editors').insert({ project_id: project.id, editor_id: editor.id });

    const { data } = await editor.client
      .from('projects')
      .update({ confirmed_price: 9999 })
      .eq('id', project.id)
      .select();
    expect(data).toHaveLength(0);

    const { data: unchanged } = await adminClient.from('projects').select('confirmed_price').eq('id', project.id).single();
    expect(unchanged.confirmed_price).toBeNull();
  });

  it('update_editing_status succeeds when project is in video_editing stage and assigned', async () => {
    editor = await createTestProfile('editor');
    project = await createTestProject({ stage: 'video_editing' });
    await adminClient.from('project_editors').insert({ project_id: project.id, editor_id: editor.id });

    const { error } = await editor.client.rpc('update_editing_status', {
      p_project_id: project.id,
      p_substatus: 'in_progress',
    });
    expect(error).toBeNull();

    const { data } = await adminClient.from('projects').select('video_editing_substatus').eq('id', project.id).single();
    expect(data.video_editing_substatus).toBe('in_progress');

    const { data: log } = await adminClient
      .from('activity_log')
      .select('actor_role')
      .eq('project_id', project.id)
      .eq('field_changed', 'video_editing_substatus');
    expect(log).toHaveLength(1);
    expect(log[0].actor_role).toBe('editor');
  });

  it('update_editing_status rejects when project is not in video_editing stage', async () => {
    editor = await createTestProfile('editor');
    project = await createTestProject({ stage: 'booked' });
    await adminClient.from('project_editors').insert({ project_id: project.id, editor_id: editor.id });

    const { error } = await editor.client.rpc('update_editing_status', {
      p_project_id: project.id,
      p_substatus: 'in_progress',
    });
    expect(error).not.toBeNull();
  });

  it('update_editing_status rejects when editor is not assigned to the project', async () => {
    editor = await createTestProfile('editor');
    project = await createTestProject({ stage: 'video_editing' });

    const { error } = await editor.client.rpc('update_editing_status', {
      p_project_id: project.id,
      p_substatus: 'in_progress',
    });
    expect(error).not.toBeNull();
  });

  it('set_song_license and post_comment work for an assigned project', async () => {
    editor = await createTestProfile('editor');
    project = await createTestProject();
    await adminClient.from('project_editors').insert({ project_id: project.id, editor_id: editor.id });
    const { data: song } = await adminClient
      .from('songs')
      .insert({ project_id: project.id, title: 'Test Song' })
      .select()
      .single();

    const { error: licenseError } = await editor.client.rpc('set_song_license', {
      p_song_id: song.id,
      p_license_confirmed: true,
    });
    expect(licenseError).toBeNull();

    const { error: commentError } = await editor.client.rpc('post_comment', {
      p_project_id: project.id,
      p_body: 'Editing started',
    });
    expect(commentError).toBeNull();
  });
});
```

- [ ] **Step 2: Run the tests**

Run: `npm run test:unit -- board/test/editor-access.test.js`
Expected: 8 passing tests.

- [ ] **Step 3: Commit**

```bash
git add board/test/editor-access.test.js
git commit -m "test(board): verify editor row/column scoping and RPC write restrictions"
```

---

## Task 11: Integration Tests — Client RPC Gateway

**Files:**
- Create: `board/test/client-rpc.test.js`

**Interfaces:**
- Consumes: `helpers.js` from Task 8; all functions from Task 5.

- [ ] **Step 1: Write the tests**

```js
import { describe, it, expect, afterEach } from 'vitest';
import { createClient } from '@supabase/supabase-js';
import { createTestProfile, deleteTestProfile, createTestProject, deleteTestProject, adminClient } from './helpers.js';

const anon = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

describe('client RPC gateway', () => {
  let project;
  let pm;

  afterEach(async () => {
    if (project) await deleteTestProject(project.id);
    if (pm) await deleteTestProfile(pm.id);
    project = null;
    pm = null;
  });

  it('get_project_by_token returns scoped data with no financial fields for a valid token', async () => {
    project = await createTestProject({ confirmed_price: 5000, client_name: 'Priya & Rohan' });

    const { data, error } = await anon.rpc('get_project_by_token', { p_token: project.client_access_token });
    expect(error).toBeNull();
    expect(data.project.client_name).toBe('Priya & Rohan');
    expect(data.project).not.toHaveProperty('confirmed_price');
    expect(data.project).not.toHaveProperty('quoted_price');
  });

  it('get_project_by_token rejects an unknown token', async () => {
    const { error } = await anon.rpc('get_project_by_token', { p_token: '00000000-0000-0000-0000-000000000000' });
    expect(error).not.toBeNull();
  });

  it('get_project_by_token rejects a revoked token', async () => {
    project = await createTestProject({ token_revoked: true });

    const { error } = await anon.rpc('get_project_by_token', { p_token: project.client_access_token });
    expect(error).not.toBeNull();
  });

  it('update_photo_selection updates count and status, rejects out-of-range values', async () => {
    project = await createTestProject();
    const { data: subEvent } = await adminClient
      .from('sub_events')
      .insert({ project_id: project.id, name: 'Sangeet', photo_total_count: 10 })
      .select()
      .single();

    const { error: ok } = await anon.rpc('update_photo_selection', {
      p_token: project.client_access_token,
      p_sub_event_id: subEvent.id,
      p_selected_count: 10,
    });
    expect(ok).toBeNull();

    const { data: updated } = await adminClient.from('sub_events').select('*').eq('id', subEvent.id).single();
    expect(updated.photo_selection_status).toBe('complete');

    const { error: tooMany } = await anon.rpc('update_photo_selection', {
      p_token: project.client_access_token,
      p_sub_event_id: subEvent.id,
      p_selected_count: 999,
    });
    expect(tooMany).not.toBeNull();
  });

  it('submit_song inserts an unlicensed song and logs client activity', async () => {
    project = await createTestProject();

    const { data: songId, error } = await anon.rpc('submit_song', {
      p_token: project.client_access_token,
      p_sub_event_id: null,
      p_title: 'Kesariya',
      p_artist: 'Arijit Singh',
    });
    expect(error).toBeNull();

    const { data: song } = await adminClient.from('songs').select('*').eq('id', songId).single();
    expect(song.license_confirmed).toBe(false);

    const { data: log } = await adminClient
      .from('activity_log')
      .select('actor_role')
      .eq('project_id', project.id)
      .eq('field_changed', 'song_added');
    expect(log[0].actor_role).toBe('client');
  });

  it('post_client_comment inserts with author_role client', async () => {
    project = await createTestProject({ client_name: 'Meera Desai' });

    const { error } = await anon.rpc('post_client_comment', {
      p_token: project.client_access_token,
      p_body: 'Excited to see the photos!',
    });
    expect(error).toBeNull();

    const { data } = await adminClient.from('comments').select('*').eq('project_id', project.id).single();
    expect(data.author_role).toBe('client');
    expect(data.author_label).toBe('Meera Desai');
  });

  it('regenerate_client_token invalidates the old token and issues a working new one', async () => {
    pm = await createTestProfile('pm');
    project = await createTestProject();
    const oldToken = project.client_access_token;

    const { data: newToken, error } = await pm.client.rpc('regenerate_client_token', { p_project_id: project.id });
    expect(error).toBeNull();
    expect(newToken).not.toBe(oldToken);

    const { error: oldFails } = await anon.rpc('get_project_by_token', { p_token: oldToken });
    expect(oldFails).not.toBeNull();

    const { error: newWorks } = await anon.rpc('get_project_by_token', { p_token: newToken });
    expect(newWorks).toBeNull();
  });
});
```

- [ ] **Step 2: Run the tests**

Run: `npm run test:unit -- board/test/client-rpc.test.js`
Expected: 7 passing tests.

- [ ] **Step 3: Commit**

```bash
git add board/test/client-rpc.test.js
git commit -m "test(board): verify client magic-link RPC gateway and token lifecycle"
```

---

## Task 12: Netlify Env Vars + Docs — STOP AND CONFIRM

**Files:**
- Create: `board/README.md`

- [ ] **Step 1: Write `board/README.md`**

```markdown
# Project Board — Foundation

Supabase schema, RLS policies, and RPC functions for the Aakaara Studios project board.
No UI yet — see `docs/superpowers/plans/` for the sub-projects that build on this.

## Local setup

1. Copy `board/.env.example` to `board/.env`.
2. Fill in `SUPABASE_URL` and `SUPABASE_ANON_KEY` from the Supabase dashboard's API settings
   (Project Settings → API). Fill in `SUPABASE_SERVICE_ROLE_KEY` from the same page —
   this key bypasses RLS entirely and is used only by integration tests to seed/tear down
   data. Never commit `board/.env` or use the service-role key in browser-facing code.
3. Run `npm run test:unit -- board/test` to run the integration tests against the real
   Supabase dev project (no local Docker/Supabase CLI needed).

## Migrations

SQL lives in `board/supabase/migrations/`, applied to the hosted project via the
Supabase MCP `apply_migration` tool in the order the files are numbered.

## Roles

- **Owner/PM** — Supabase Auth accounts, full access via RLS policies.
- **Editor** — Supabase Auth accounts, scoped to assigned projects via `editor_project_view`
  (read) and dedicated RPC functions (write): `update_editing_status`, `set_song_license`,
  `post_comment`.
- **Client** — no account. Access is a `client_access_token` (UUID) in the URL, validated
  inside every RPC call: `get_project_by_token`, `update_photo_selection`, `submit_song`,
  `post_client_comment`. Owner/PM can invalidate a leaked link with `regenerate_client_token`.
```

- [ ] **Step 2: STOP AND CONFIRM before touching Netlify config**

Show the user: "Foundation is built and tested. The next sub-project (the Owner/PM board UI) will need `SUPABASE_URL` and `SUPABASE_ANON_KEY` set as Netlify environment variables on the live site. Want me to set those now via the Netlify MCP tools, or would you rather add them yourself in the Netlify dashboard when sub-project 2 starts?" Only proceed to Step 3 if the user explicitly asks you to set them now.

- [ ] **Step 3 (only if confirmed): Set Netlify env vars**

Use the Netlify MCP tools to set `SUPABASE_URL` and `SUPABASE_ANON_KEY` on the site's environment variables. Do not set `SUPABASE_SERVICE_ROLE_KEY` — it isn't needed until sub-project 2's invite flow, which will scope it to a server-side Netlify function, not a general site env var.

- [ ] **Step 4: Commit**

```bash
git add board/README.md
git commit -m "docs(board): add foundation README"
```
