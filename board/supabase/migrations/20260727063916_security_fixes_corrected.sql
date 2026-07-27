-- board/supabase/migrations/20260727063916_security_fixes_corrected.sql
--
-- Corrects security_fixes (20260727063759): revoking EXECUTE from PUBLIC
-- alone did not close anon/authenticated's access. Supabase grants EXECUTE
-- on every new function to `anon` and `authenticated` at creation time via
-- a project-level default-privilege grant, independent of the plain
-- Postgres PUBLIC default that the previous migration addressed -- closing
-- that required explicit revokes for those two roles by name, verified
-- against the live ACL (`has_function_privilege`), not just re-reading the
-- migration SQL.

revoke execute on function assert_editor_assigned(uuid) from anon, authenticated;
revoke execute on function assert_valid_client_token(uuid) from anon, authenticated;
revoke execute on function log_project_changes() from anon, authenticated;
revoke execute on function log_child_changes() from anon, authenticated;

-- current_profile_role() must stay callable by `authenticated`: every
-- owner/pm RLS policy across every table (Task 3) calls it inside its
-- USING/WITH CHECK clause, evaluated in the querying role's own session
-- context -- revoking `authenticated`'s execute grant would break RLS for
-- every owner/pm request against every table. Only `anon`/PUBLIC lose
-- access, since no anon-facing policy or function ever calls it.
revoke execute on function current_profile_role() from public, anon;
