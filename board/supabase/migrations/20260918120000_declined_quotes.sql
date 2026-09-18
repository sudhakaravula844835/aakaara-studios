begin;
alter table public.projects drop constraint projects_stage_check;
alter table public.projects add constraint projects_stage_check check (
  stage in ('quote_sent','declined','booked','shoot_completed','raw_delivered',
    'photo_selection','video_editing','song_finalization','final_delivery','completed')
);
alter table public.projects drop constraint projects_quote_confirmation_price_check;
alter table public.projects add constraint projects_quote_confirmation_price_check check (
  source_quote_id is null or stage in ('quote_sent','declined') or (
    confirmed_price is not null and confirmed_price >= 0
    and confirmed_price::text not in ('NaN', 'Infinity', '-Infinity')
  )
);
commit;
