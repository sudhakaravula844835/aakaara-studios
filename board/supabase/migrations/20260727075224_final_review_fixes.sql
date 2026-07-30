-- board/supabase/migrations/20260727075224_final_review_fixes.sql
--
-- Fixes from the final whole-branch security review of the project-board
-- Foundation (0001-0005 era). See docs/superpowers/sdd/.../final-review-fix-report.md
-- for the full writeup. Section numbers below match the review's Fix 1-8.

-- =====================================================================
-- Fix 1 (Critical): activity_log leaked financial data + client token
-- to assigned editors.
-- =====================================================================

-- 1a. Redefine activity_log_select_editor as a WHITELIST of non-sensitive
-- field_changed values, not "every row for my project". Anything added by a
-- later sub-project (a new projects/sub_events/songs column) is hidden from
-- editors by default until explicitly added here.
drop policy activity_log_select_editor on activity_log;

create policy activity_log_select_editor on activity_log
  for select to authenticated
  using (
    current_profile_role() = 'editor'
    and exists (select 1 from project_editors pe where pe.project_id = activity_log.project_id and pe.editor_id = auth.uid())
    and field_changed = any(array[
      'stage', 'video_editing_substatus', 'raw_delivered_at', 'raw_delivery_link',
      'photo_selected_count', 'photo_selection_status', 'song_added', 'license_confirmed',
      'name', 'event_date', 'venue', 'title', 'artist'
    ])
  );

-- 1b. client_access_token is a bearer credential, not just editor-sensitive
-- data — it should never be written to activity_log in plaintext at all,
-- including for Owner/PM viewing their own audit trail. Add it to
-- log_project_changes()'s excluded_cols alongside id/created_at/updated_at.
-- (Fix 3's coalesce(...,'system') fallback is folded into this same
-- CREATE OR REPLACE so we don't touch the function body twice.)
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
  excluded_cols text[] := array['id', 'created_at', 'updated_at', 'client_access_token'];
begin
  if auth.uid() is null then
    return new;
  end if;

  actor_role := coalesce(current_profile_role(), 'system');
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

-- =====================================================================
-- Fix 3 (Important): audit trigger hard-fails when auth.uid() is set but
-- no matching profiles row exists yet (current_profile_role() returns
-- null, actor_role is not-null on activity_log -> whole UPDATE aborts).
-- log_project_changes() already got its coalesce(...,'system') above;
-- apply the same fallback to log_child_changes() (sub_events/songs).
-- =====================================================================
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

  actor_role := coalesce(current_profile_role(), 'system');
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

-- =====================================================================
-- Fix 2 (Important): comments returned to the client via get_project_by_token
-- had no internal/external distinction — Owner/PM could never leave a
-- client-hidden note on a project.
-- =====================================================================

-- 2a. New column. Defaults to false, so post_comment (editor) and any
-- direct Owner/PM insert that doesn't set it explicitly stays external
-- (client-visible) exactly as before -- no signature changes needed.
alter table comments add column internal boolean not null default false;

-- 2b. Filter the client-facing RPC's comments sub-query to internal = false.
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
      from comments c where c.project_id = v_project_id and c.internal = false
    )
  ) into result;

  return result;
end;
$$;

-- =====================================================================
-- Fix 7 (Important): any authenticated user (any editor, or a self-signed-up
-- stranger, since Supabase Auth email signup is on by default) could SELECT
-- every row of `profiles` -- enumerating all staff names/emails/roles.
-- =====================================================================
drop policy profiles_select_authenticated on profiles;

create policy profiles_select_self_or_owner_pm on profiles
  for select to authenticated
  using (id = auth.uid() or current_profile_role() in ('owner','pm'));

-- Note: disabling public email signup itself is a Supabase Auth dashboard
-- toggle (Authentication -> Providers -> Email -> "Allow new users to sign
-- up"), not something reachable via SQL/migrations. Left as a manual
-- follow-up for the project owner -- see final-review-fix-report.md.

-- =====================================================================
-- Fix 8 (Important): unbounded text on anon-reachable write endpoints
-- (post_client_comment / submit_song), i.e. no server-side cap on how much
-- an anonymous client-token holder can shove into a text column.
-- =====================================================================
alter table comments add constraint comments_body_length check (length(body) <= 4000);
alter table songs
  add constraint songs_title_length check (length(title) <= 500),
  add constraint songs_artist_length check (length(artist) <= 500);

-- =====================================================================
-- Fix 5 (Important): Supabase's default ACL grants EXECUTE on every new
-- function to anon/authenticated automatically (see 0005's header). Flip
-- the schema default so any function created AFTER this migration must be
-- explicitly granted -- then re-issue the same explicit grants 0003/0004
-- already made, so the *current* effective privilege matrix is unchanged.
-- This only affects the default applied to functions created going forward.
-- =====================================================================
alter default privileges in schema public revoke execute on functions from anon, authenticated;

-- Client-facing (anon + authenticated): token-gated RPCs.
grant execute on function get_project_by_token(uuid) to anon, authenticated;
grant execute on function post_client_comment(uuid, text) to anon, authenticated;
grant execute on function submit_song(uuid, uuid, text, text) to anon, authenticated;
grant execute on function update_photo_selection(uuid, uuid, integer) to anon, authenticated;

-- Staff-facing (authenticated only): editor/owner/pm RPCs + the RLS helper.
grant execute on function post_comment(uuid, text) to authenticated;
grant execute on function set_song_license(uuid, boolean) to authenticated;
grant execute on function update_editing_status(uuid, text) to authenticated;
grant execute on function regenerate_client_token(uuid) to authenticated;
grant execute on function current_profile_role() to authenticated;
