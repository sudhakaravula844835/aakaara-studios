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
