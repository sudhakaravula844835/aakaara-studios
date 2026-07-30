-- board/supabase/migrations/0001_schema.sql

create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role in ('owner','pm','editor')),
  full_name text not null,
  email text not null,
  created_at timestamptz not null default now()
);

create table projects (
  id uuid primary key default gen_random_uuid(),
  client_name text not null,
  client_email text,
  client_phone text,
  stage text not null default 'booked'
    check (stage in ('booked','shoot_completed','raw_delivered','photo_selection',
      'video_editing','song_finalization','final_delivery','completed')),
  video_editing_substatus text
    check (video_editing_substatus in ('not_started','in_progress','client_review','revisions','final')),
  package_tier text,
  hours_booked numeric,
  quoted_price numeric,
  confirmed_price numeric,
  deposit_paid boolean,
  balance_paid boolean,
  pm_id uuid references profiles(id),
  contract_url text,
  quote_pdf_url text,
  raw_delivered_at date,
  raw_delivery_link text,
  client_access_token uuid not null default gen_random_uuid(),
  token_revoked boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index projects_client_access_token_idx on projects (client_access_token);

create table sub_events (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  name text not null,
  event_date date,
  venue text,
  photo_selection_status text not null default 'not_started'
    check (photo_selection_status in ('not_started','in_progress','complete')),
  photo_selected_count integer not null default 0,
  photo_total_count integer not null default 0
);

create table project_editors (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  editor_id uuid not null references profiles(id) on delete cascade,
  unique (project_id, editor_id)
);

create table songs (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  sub_event_id uuid references sub_events(id) on delete set null,
  title text not null,
  artist text,
  license_confirmed boolean not null default false,
  created_at timestamptz not null default now()
);

create table activity_log (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  actor_role text not null,
  actor_label text not null,
  field_changed text not null,
  old_value text,
  new_value text,
  created_at timestamptz not null default now()
);

create table comments (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  author_role text not null,
  author_label text not null,
  body text not null,
  created_at timestamptz not null default now()
);
