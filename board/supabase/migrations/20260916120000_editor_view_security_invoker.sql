-- Preserve the editor API while removing the SECURITY DEFINER view.
-- The privileged read lives in a non-API schema, with explicit row/column gates.
begin;
create schema if not exists editor_private;
revoke all on schema editor_private from public, anon;
grant usage on schema editor_private to authenticated;

create or replace function editor_private.assigned_editor_projects()
returns table (
 id uuid, client_name text, client_email text, client_phone text, stage text,
 video_editing_substatus text, package_tier text, hours_booked numeric, pm_id uuid,
 raw_delivered_at date, raw_delivery_link text, created_at timestamptz, updated_at timestamptz
)
language sql stable security definer set search_path = '' as $$
 select p.id,p.client_name,p.client_email,p.client_phone,p.stage,
   p.video_editing_substatus,p.package_tier,p.hours_booked,p.pm_id,
   p.raw_delivered_at,p.raw_delivery_link,p.created_at,p.updated_at
 from public.projects p
 join public.project_editors pe on pe.project_id=p.id
 where pe.editor_id=(select auth.uid())
   and (select public.current_profile_role())='editor';
$$;
revoke all on function editor_private.assigned_editor_projects() from public,anon,authenticated;
grant execute on function editor_private.assigned_editor_projects() to authenticated;

create or replace view public.editor_project_view
with (security_invoker = true)
as select * from editor_private.assigned_editor_projects();
revoke all on public.editor_project_view from public,anon;
grant select on public.editor_project_view to authenticated;

-- The function-backed view no longer carries an inferred foreign key.
-- Preserve the existing PostgREST select('*, sub_events(...)') contract.
create or replace function public.sub_events(public.editor_project_view)
returns setof public.sub_events
language sql stable security invoker set search_path = '' as $$
 select se.* from public.sub_events se where se.project_id=($1).id;
$$;
revoke all on function public.sub_events(public.editor_project_view) from public,anon,authenticated;
grant execute on function public.sub_events(public.editor_project_view) to authenticated;
notify pgrst, 'reload schema';
commit;
