-- Free-text crew assignment (photographers/videographers/second-shooters)
-- per sub-event. Owner/PM-only visibility -- not exposed via
-- get_project_by_token, since this is internal scheduling info, not
-- something the client needs to see. No RLS change needed: sub_events
-- already has full owner/pm access (sub_events_all_owner_pm) and
-- row-scoped editor read access (sub_events_select_editor); RLS is
-- row-level, so a new column is automatically covered by both.

alter table sub_events add column crew text;
