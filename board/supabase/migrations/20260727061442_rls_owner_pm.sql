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
