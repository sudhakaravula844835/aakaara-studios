-- A quote starts a project before booking; existing booked projects are unchanged.
alter table public.projects drop constraint projects_stage_check;
alter table public.projects add constraint projects_stage_check check (
  stage in ('quote_sent','booked','shoot_completed','raw_delivered','photo_selection',
    'video_editing','song_finalization','final_delivery','completed')
);
alter table public.projects add column source_quote_id uuid unique;
alter table public.projects add constraint projects_quote_confirmation_price_check check (
  source_quote_id is null or stage = 'quote_sent' or (
    confirmed_price is not null and confirmed_price >= 0
    and confirmed_price::text not in ('NaN', 'Infinity', '-Infinity')
  )
);

-- Keep the editor view's explicit, non-financial column list unchanged. These
-- privileges still require the existing active owner/PM RLS policy to pass.
grant select (source_quote_id), insert (source_quote_id) on public.projects to authenticated;

create or replace function public.create_quote_project(p_quote_id uuid, p_quote jsonb)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_project_id uuid;
  v_price numeric;
  v_event jsonb;
begin
  if coalesce(current_profile_role(), '') not in ('owner','pm') then
    raise exception 'only an active owner or pm may create a quote project';
  end if;
  if p_quote_id is null then
    raise exception 'quote id is required';
  end if;

  -- A retry must never overwrite negotiated pricing or return a booked project
  -- to quote_sent, even if the retried payload has since changed.
  select id into v_project_id from projects where source_quote_id = p_quote_id;
  if found then return v_project_id; end if;

  if jsonb_typeof(p_quote) is distinct from 'object'
    or jsonb_typeof(p_quote->'client_name') is distinct from 'string'
    or nullif(btrim(p_quote->>'client_name'), '') is null then
    raise exception 'client name is required';
  end if;
  if jsonb_typeof(p_quote->'quoted_price') is distinct from 'number' then
    raise exception 'quoted price must be a finite nonnegative number';
  end if;
  v_price := (p_quote->>'quoted_price')::numeric;
  if v_price < 0 or v_price::text in ('NaN','Infinity','-Infinity') then
    raise exception 'quoted price must be a finite nonnegative number';
  end if;
  if p_quote ? 'events' and jsonb_typeof(p_quote->'events') is distinct from 'array' then
    raise exception 'events must be an array';
  end if;

  insert into projects (source_quote_id, client_name, client_email, client_phone,
    stage, package_tier, hours_booked, quoted_price)
  values (p_quote_id, btrim(p_quote->>'client_name'), nullif(p_quote->>'client_email',''),
    nullif(p_quote->>'client_phone',''), 'quote_sent', nullif(p_quote->>'package_tier',''),
    nullif(p_quote->>'hours_booked','')::numeric, v_price)
  on conflict (source_quote_id) do nothing
  returning id into v_project_id;

  -- Handles two concurrent send/retry requests without duplicate events.
  if v_project_id is null then
    select id into v_project_id from projects where source_quote_id = p_quote_id;
    return v_project_id;
  end if;

  for v_event in select value from jsonb_array_elements(coalesce(p_quote->'events', '[]'::jsonb))
  loop
    if jsonb_typeof(v_event) is distinct from 'object'
      or jsonb_typeof(v_event->'name') is distinct from 'string'
      or nullif(btrim(v_event->>'name'), '') is null then
      raise exception 'each event requires a name';
    end if;
    insert into sub_events (project_id, name, event_date, venue)
    values (v_project_id, btrim(v_event->>'name'),
      nullif(v_event->>'event_date','')::date, nullif(v_event->>'venue',''));
  end loop;
  return v_project_id;
end;
$$;

revoke execute on function public.create_quote_project(uuid, jsonb) from public, anon;
grant execute on function public.create_quote_project(uuid, jsonb) to authenticated;
