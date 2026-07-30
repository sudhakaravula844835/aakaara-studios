-- Fix: profiles.active is folded into current_profile_role(), which now
-- returns NULL for a deactivated user. Two spots in the Editor access path
-- didn't handle that NULL, so a deactivated Editor's still-valid JWT kept
-- both read and write access.

-- C1: `NULL <> 'editor'` is NULL, and `IF NULL THEN` does not branch, so the
-- guard silently passed for a deactivated user. `is distinct from` is
-- NULL-safe: `NULL is distinct from 'editor'` is TRUE, so the exception fires
-- for a wrong role AND for a deactivated (NULL) one. This function is the
-- ONLY gate on update_editing_status / set_song_license / post_comment --
-- all SECURITY DEFINER, so RLS is bypassed entirely.
create or replace function assert_editor_assigned(p_project_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if current_profile_role() is distinct from 'editor' then
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

-- C2: the view runs with definer privileges (security_invoker = false)
-- against `projects`, which has no editor SELECT policy at all -- the join
-- was the entire access control, and it never consulted the caller's role.
-- A deactivated editor kept reading client_email / client_phone /
-- package_tier / hours_booked / raw_delivery_link for assigned projects.
-- Column list is unchanged, so `create or replace view` preserves the
-- existing `grant select on editor_project_view to authenticated`.
create or replace view editor_project_view
with (security_invoker = false)
as
select
  p.id, p.client_name, p.client_email, p.client_phone, p.stage,
  p.video_editing_substatus, p.package_tier, p.hours_booked, p.pm_id,
  p.raw_delivered_at, p.raw_delivery_link, p.created_at, p.updated_at
from projects p
join project_editors pe on pe.project_id = p.id
where pe.editor_id = auth.uid()
  and current_profile_role() = 'editor';

-- Same NULL-unsafe shape, currently non-exploitable: this function is
-- `security invoker`, so the UPDATE below it still has to satisfy
-- projects_all_owner_pm, which NULL-denies correctly. Fixed anyway so the
-- check works on its own merits rather than depending on a second layer.
create or replace function regenerate_client_token(p_project_id uuid)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_new_token uuid := gen_random_uuid();
begin
  if coalesce(current_profile_role(), '') not in ('owner','pm') then
    raise exception 'only owner or pm may regenerate a client access token';
  end if;

  update projects
  set client_access_token = v_new_token, token_revoked = false
  where id = p_project_id;

  return v_new_token;
end;
$$;
