-- Moves contract/quote from external URLs to actual uploaded PDF files in
-- Supabase Storage. contract_url/quote_pdf_url are dropped in favor of
-- contract_uploaded_at/quote_uploaded_at (existence + freshness marker --
-- the actual file lives at a deterministic Storage path,
-- project-documents/<project_id>/contract.pdf or .../quote.pdf, not
-- duplicated as a column).

alter table projects add column contract_uploaded_at timestamptz;
alter table projects add column quote_uploaded_at timestamptz;
alter table projects drop column contract_url;
alter table projects drop column quote_pdf_url;

-- Private bucket -- these are real client contracts/financial documents,
-- never publicly readable by URL guessing.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('project-documents', 'project-documents', false, 10485760, array['application/pdf']);

-- Owner/PM: full access, same role check used everywhere else in this
-- schema. No policy at all for anon or editor -- the client reaches these
-- files exclusively through the get-client-document edge function (which
-- uses the service-role key and bypasses RLS after validating the token
-- itself, the same pattern as every other client-facing access path).
create policy project_documents_all_owner_pm on storage.objects
  for all to authenticated
  using (bucket_id = 'project-documents' and current_profile_role() in ('owner','pm'))
  with check (bucket_id = 'project-documents' and current_profile_role() in ('owner','pm'));

-- Surface the upload markers to the client (not the file itself -- the
-- client fetches the actual PDF through the edge function, which
-- validates their token independently before minting a signed URL).
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
        'contract_uploaded_at', p.contract_uploaded_at, 'quote_uploaded_at', p.quote_uploaded_at
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
