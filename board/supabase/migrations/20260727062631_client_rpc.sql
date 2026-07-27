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
