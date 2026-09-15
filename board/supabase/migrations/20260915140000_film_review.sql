-- Draft preparation is staff-only; publishing requires an active owner/PM.
begin;
create table public.film_review_items (
 id uuid primary key default gen_random_uuid(),
 project_id uuid not null references public.projects(id) on delete cascade,
 kind text not null check(kind in ('film','message')),
 version integer,
 title text not null,
 video_url text,
 body text not null default '',
 author_label text not null,
 author_role text not null check(author_role in ('owner','pm','editor')),
 created_by uuid references auth.users(id) on delete set null,
 created_at timestamptz not null default now(),
 published_at timestamptz,
 published_by uuid references auth.users(id) on delete set null,
 check ((kind = 'film' and version > 0 and video_url ~* '^https://') or (kind = 'message' and version is null and video_url is null)),
 unique(project_id,version)
);
create table public.film_review_feedback (
 id uuid primary key,
 item_id uuid not null references public.film_review_items(id) on delete cascade,
 action text not null check(action in ('comment','changes_requested','approved')),
 at_seconds integer check(at_seconds between 0 and 86400),
 body text not null default '',
 created_at timestamptz not null default now()
);
create index film_review_feedback_item_idx on public.film_review_feedback(item_id);
alter table public.film_review_items enable row level security;
alter table public.film_review_feedback enable row level security;
-- All access goes through token/role-checked RPCs, never direct table grants.
revoke all on public.film_review_items, public.film_review_feedback from anon, authenticated, public;

create or replace function public.assert_review_staff(p_project_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
 if coalesce(current_profile_role(),'') in ('owner','pm') then
   if not exists(select 1 from projects where id=p_project_id) then raise exception 'project not found'; end if;
 else perform assert_editor_assigned(p_project_id);
 end if;
end; $$;
revoke all on function public.assert_review_staff(uuid) from public,anon,authenticated;

create or replace function public.get_film_review(p_project_id uuid default null,p_token uuid default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_project uuid; v_client boolean := p_token is not null;
begin
 if v_client then v_project := assert_valid_client_token(p_token);
 else v_project := p_project_id; perform assert_review_staff(v_project); end if;
 return jsonb_build_object(
 'can_publish', not v_client and coalesce(current_profile_role(),'') in ('owner','pm'),
 'items', (select coalesce(jsonb_agg(jsonb_build_object('id',i.id,'kind',i.kind,'version',i.version,'title',i.title,'video_url',i.video_url,'body',i.body,'author_label',i.author_label,'created_at',i.created_at,'published_at',i.published_at) order by i.created_at desc),'[]'::jsonb)
 from film_review_items i where i.project_id=v_project and (not v_client or (i.published_at is not null and i.kind='film'))),
 'feedback', (select coalesce(jsonb_agg(jsonb_build_object('id',f.id,'item_id',f.item_id,'action',f.action,'at_seconds',f.at_seconds,'body',f.body,'created_at',f.created_at) order by f.created_at),'[]'::jsonb)
 from film_review_feedback f join film_review_items i on i.id=f.item_id where i.project_id=v_project and (not v_client or i.published_at is not null)));
end; $$;
revoke all on function public.get_film_review(uuid,uuid) from public;
grant execute on function public.get_film_review(uuid,uuid) to anon,authenticated;

create or replace function public.prepare_film_review(p_project_id uuid,p_id uuid,p_kind text,p_title text,p_url text,p_body text)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_version integer; v_name text;
begin
 perform assert_review_staff(p_project_id);
 perform 1 from projects where id=p_project_id for update;
 if exists(select 1 from film_review_items where id=p_id and project_id=p_project_id) then
   if not exists(select 1 from film_review_items where id=p_id and kind=p_kind and title=trim(p_title) and video_url is not distinct from (case when p_kind='film' then p_url else null end) and body=coalesce(p_body,'')) then raise exception 'This draft was already saved. Refresh review before preparing another version.'; end if;
   return p_id;
 end if;
 if p_id is null or p_kind is null or p_kind not in ('film','message') or coalesce(length(trim(p_title)),0) not between 1 and 200 or coalesce(length(p_body),0)>10000 then raise exception 'invalid draft'; end if;
 if p_kind='film' then
   if p_url is null or p_url !~* '^https://' or length(p_url)>4000 then raise exception 'use an HTTPS video link'; end if;
   select coalesce(max(version),0)+1 into v_version from film_review_items where project_id=p_project_id;
 elsif coalesce(length(trim(p_body)),0)=0 then raise exception 'message required'; end if;
 select full_name into v_name from profiles where id=auth.uid();
 insert into film_review_items(id,project_id,kind,version,title,video_url,body,author_label,author_role,created_by)
 values(p_id,p_project_id,p_kind,v_version,trim(p_title),case when p_kind='film' then p_url else null end,coalesce(p_body,''),coalesce(v_name,'Studio'),current_profile_role(),auth.uid());
 return p_id;
end; $$;
revoke all on function public.prepare_film_review(uuid,uuid,text,text,text,text) from public;
grant execute on function public.prepare_film_review(uuid,uuid,text,text,text,text) to authenticated;

create or replace function public.publish_film_review(p_item_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_item film_review_items%rowtype; v_project uuid;
begin
 if coalesce(current_profile_role(),'') not in ('owner','pm') then raise exception 'only owner or PM may share with client'; end if;
 select project_id into v_project from film_review_items where id=p_item_id;
 perform 1 from projects where id=v_project for update;
 select * into v_item from film_review_items where id=p_item_id for update;
 if not found then raise exception 'draft not found'; end if;
 if v_item.published_at is not null then return; end if;
 if v_item.kind='film' and exists(select 1 from film_review_items where project_id=v_project and version>v_item.version and published_at is not null) then raise exception 'a newer draft is already shared'; end if;
 update film_review_items set published_at=now(),published_by=auth.uid() where id=p_item_id;
 if v_item.kind='film' then
   update projects set stage='video_editing',video_editing_substatus='client_review' where id=v_project;
 else
   insert into comments(project_id,author_role,author_label,body,internal)
   values(v_project,v_item.author_role,v_item.author_label,v_item.body,false);
 end if;
end; $$;
revoke all on function public.publish_film_review(uuid) from public;
grant execute on function public.publish_film_review(uuid) to authenticated;

create or replace function public.discard_film_review(p_item_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_item film_review_items%rowtype;
begin
 select * into v_item from film_review_items where id=p_item_id for update;
 if not found then raise exception 'draft not found'; end if;
 perform assert_review_staff(v_item.project_id);
 if v_item.published_at is not null then raise exception 'shared history cannot be removed'; end if;
 if coalesce(current_profile_role(),'') not in ('owner','pm') and v_item.created_by is distinct from auth.uid() then raise exception 'only the author or PM may discard this draft'; end if;
 delete from film_review_items where id=p_item_id;
end; $$;
revoke all on function public.discard_film_review(uuid) from public;
grant execute on function public.discard_film_review(uuid) to authenticated;

create or replace function public.respond_film_review(p_token uuid,p_item_id uuid,p_id uuid,p_action text,p_seconds integer,p_body text)
returns void language plpgsql security definer set search_path = public as $$
declare v_project uuid := assert_valid_client_token(p_token); v_item film_review_items%rowtype;
begin
 perform 1 from projects where id=v_project for update;
 select * into v_item from film_review_items where id=p_item_id and project_id=v_project and kind='film' and published_at is not null for update;
 if not found then raise exception 'shared draft not found'; end if;
 if exists(select 1 from film_review_feedback where id=p_id and item_id=p_item_id) then
   if not exists(select 1 from film_review_feedback where id=p_id and action=p_action and at_seconds is not distinct from p_seconds and body=coalesce(p_body,'')) then raise exception 'Your earlier response was saved. Refresh review before sending different feedback.'; end if;
   return;
 end if;
 if p_id is null or p_action is null or p_action not in ('comment','changes_requested','approved') or coalesce(length(p_body),0)>10000 then raise exception 'invalid response'; end if;
 if p_action <> 'approved' and coalesce(length(trim(p_body)),0)=0 then raise exception 'please add your feedback'; end if;
 if p_action <> 'comment' and exists(select 1 from film_review_items where project_id=v_project and kind='film' and published_at is not null and version>v_item.version) then raise exception 'please review the latest draft'; end if;
 insert into film_review_feedback(id,item_id,action,at_seconds,body) values(p_id,p_item_id,p_action,p_seconds,coalesce(p_body,''));
 if p_action='changes_requested' then update projects set video_editing_substatus='revisions' where id=v_project and stage='video_editing'; end if;
 if p_action='approved' then update projects set video_editing_substatus='client_review' where id=v_project and stage='video_editing'; end if;
 -- Approval is recorded for this version only. Final delivery stays under studio control.
end; $$;
revoke all on function public.respond_film_review(uuid,uuid,uuid,text,integer,text) from public;
grant execute on function public.respond_film_review(uuid,uuid,uuid,text,integer,text) to anon,authenticated;

-- Close the legacy editor bypass: old clients may still call post_comment.
create or replace function public.post_comment(p_project_id uuid,p_body text)
returns void language plpgsql security definer set search_path = public as $$
declare v_name text;
begin
 perform assert_editor_assigned(p_project_id);
 if coalesce(length(trim(p_body)),0) not between 1 and 10000 then raise exception 'note required'; end if;
 select full_name into v_name from profiles where id=auth.uid();
 insert into comments(project_id,author_role,author_label,body,internal) values(p_project_id,'editor',v_name,p_body,true);
end; $$;
revoke all on function public.post_comment(uuid,text) from public,anon;
grant execute on function public.post_comment(uuid,text) to authenticated;
commit;
