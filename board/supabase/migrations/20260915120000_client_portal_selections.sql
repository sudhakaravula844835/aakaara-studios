-- Apply before deploying the updated client portal.
begin;
alter table public.projects add column if not exists final_gallery_url text;
alter table public.projects add column if not exists final_film_url text;
alter table public.sub_events add column if not exists photo_selection_list text[] not null default '{}';

create or replace function public.save_client_photo_selection(p_token uuid, p_sub_event_id uuid, p_photos text[])
returns void language plpgsql security definer set search_path = public as $$
declare
  v_project uuid := assert_valid_client_token(p_token);
  v_event sub_events%rowtype;
  v_photos text[];
begin
  select * into v_event from sub_events where id = p_sub_event_id and project_id = v_project for update;
  if not found then raise exception 'sub-event not found for this project'; end if;
  select array_agg(photo order by first_seen) into v_photos from (
    select trim(value) photo, min(n) first_seen from unnest(p_photos) with ordinality as items(value,n)
    where trim(value) <> '' group by trim(value)
  ) clean;
  if coalesce(cardinality(v_photos),0) = 0 or cardinality(v_photos) > 10000 then
    raise exception 'provide between 1 and 10000 photo filenames';
  end if;
  if v_event.photo_total_count > 0 and cardinality(v_photos) > v_event.photo_total_count then
    raise exception 'selection exceeds gallery count';
  end if;
  if v_event.photo_selection_list = v_photos then return; end if;
  update sub_events set photo_selection_list = v_photos, photo_selected_count = cardinality(v_photos),
    photo_selection_status = case when cardinality(v_photos) = photo_total_count then 'complete' else 'in_progress' end
    where id = p_sub_event_id;
  perform post_client_comment(p_token, 'Photo selections for ' || v_event.name || ':' || chr(10) || array_to_string(v_photos, ', '));
end;
$$;
revoke all on function public.save_client_photo_selection(uuid,uuid,text[]) from public;
grant execute on function public.save_client_photo_selection(uuid,uuid,text[]) to anon, authenticated;

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
        'raw_delivered_at', p.raw_delivered_at, 'raw_delivery_link', p.raw_delivery_link,
        'expected_delivery_date', p.expected_delivery_date,
        'final_gallery_url', p.final_gallery_url, 'final_film_url', p.final_film_url,
        'contract_uploaded_at', p.contract_uploaded_at, 'quote_uploaded_at', p.quote_uploaded_at
      )
      from projects p where p.id = v_project_id
    ),
    'sub_events', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', se.id, 'name', se.name, 'event_date', se.event_date, 'venue', se.venue,
        'photo_selection_status', se.photo_selection_status,
        'photo_selected_count', se.photo_selected_count,
        'photo_total_count', se.photo_total_count,
        'photo_selection_list', se.photo_selection_list
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

create or replace function public.edit_client_song(p_token uuid, p_song_id uuid, p_title text, p_artist text, p_remove boolean default false)
returns void language plpgsql security definer set search_path = public as $$
declare v_project uuid := assert_valid_client_token(p_token); v_song songs%rowtype;
begin
  select * into v_song from songs where id = p_song_id and project_id = v_project for update;
  if not found then raise exception 'song not found'; end if;
  if v_song.license_confirmed then raise exception 'contact the studio to change confirmed music'; end if;
  if p_remove then delete from songs where id = p_song_id;
  else
    if p_title is null or length(trim(p_title)) = 0 then raise exception 'song title required'; end if;
    update songs set title = trim(p_title), artist = p_artist where id = p_song_id;
  end if;
end;
$$;
revoke all on function public.edit_client_song(uuid,uuid,text,text,boolean) from public;
grant execute on function public.edit_client_song(uuid,uuid,text,text,boolean) to anon, authenticated;
-- A stable browser-generated ID makes retries safe even if the response was lost.
create or replace function public.save_client_song(p_token uuid, p_submission_id uuid, p_sub_event_id uuid, p_title text, p_artist text)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_project uuid := assert_valid_client_token(p_token);
begin
  perform 1 from projects where id = v_project for update;
  if exists(select 1 from songs where id = p_submission_id and project_id = v_project) then return p_submission_id; end if;
  if p_submission_id is null or p_title is null or length(trim(p_title)) = 0 then raise exception 'song title and submission id required'; end if;
  if p_sub_event_id is not null and not exists(select 1 from sub_events where id = p_sub_event_id and project_id = v_project) then raise exception 'sub-event not found for this project'; end if;
  if (select count(*) from songs where project_id = v_project) >= 5 then raise exception 'maximum of five song suggestions reached'; end if;
  insert into songs(id,project_id,sub_event_id,title,artist,license_confirmed)
    values(p_submission_id,v_project,p_sub_event_id,trim(p_title),p_artist,false);
  insert into activity_log(project_id,actor_role,actor_label,field_changed,new_value)
    select v_project,'client',client_name,'song_added',trim(p_title) from projects where id = v_project;
  return p_submission_id;
end;
$$;
revoke all on function public.save_client_song(uuid,uuid,uuid,text,text) from public;
grant execute on function public.save_client_song(uuid,uuid,uuid,text,text) to anon, authenticated;
commit;
