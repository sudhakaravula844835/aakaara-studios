-- board/supabase/migrations/0005_security_fixes.sql
--
-- Addresses findings from `get_advisors(type: "security")` after Tasks 2-5.
--
-- NOT fixed here (false positive, by design — see Task 4's brief):
--   security_definer_view on editor_project_view. The view is intentionally
--   created without security_invoker so it runs with definer privileges
--   against `projects` (which has no editor SELECT policy at all); its own
--   join + column list are what enforce row/column scoping.
--
-- Background on the fixes below: Supabase grants EXECUTE on every new
-- function to `anon` and `authenticated` at creation time — both via a
-- project-level default-privilege grant AND, for some functions, the plain
-- Postgres default PUBLIC grant — independent of whatever a migration's own
-- `grant execute ... to <role>` statement says. A migration that only ever
-- granted `authenticated` therefore did not, by itself, keep `anon` out;
-- closing that required explicit revokes verified against the live ACL
-- (`has_function_privilege`), not just re-reading the migration SQL.

-- set_updated_at is not SECURITY DEFINER, so it wasn't covered by the
-- blanket "every SECURITY DEFINER function sets search_path" constraint —
-- but pinning it anyway removes the advisor warning at no cost. It remains
-- callable by anon/authenticated (matches the plan; harmless, since it only
-- does `new.updated_at = now(); return new;` and `new` is undefined outside
-- trigger context, so a direct RPC call errors regardless of ACL).
alter function set_updated_at() set search_path = public;

-- assert_editor_assigned / assert_valid_client_token / log_project_changes /
-- log_child_changes are internal helpers and trigger functions only, never
-- meant to be callable directly as RPC endpoints. The first two are only
-- ever called from within other SECURITY DEFINER functions (which execute
-- as the function owner — revoking anon/authenticated/public execute does
-- not affect those internal calls, since an owner always has implicit
-- execute on its own objects). The trigger functions are only invoked via
-- `CREATE TRIGGER ... EXECUTE FUNCTION`, which does not require the firing
-- role to hold EXECUTE on the function. None are referenced by any RLS
-- policy.
revoke execute on function assert_editor_assigned(uuid) from public, anon, authenticated;
revoke execute on function assert_valid_client_token(uuid) from public, anon, authenticated;
revoke execute on function log_project_changes() from public, anon, authenticated;
revoke execute on function log_child_changes() from public, anon, authenticated;

-- current_profile_role() must stay callable by `authenticated`: every
-- owner/pm RLS policy across every table (Task 3) calls it inside its
-- USING/WITH CHECK clause, evaluated in the querying role's own session
-- context — revoking `authenticated`'s execute grant would break RLS for
-- every owner/pm request against every table. Only `anon`/PUBLIC lose
-- access, since no anon-facing policy or function ever calls it.
revoke execute on function current_profile_role() from public, anon;

-- post_comment / set_song_license / update_editing_status (editor RPC
-- writes, Task 4) and regenerate_client_token (owner/pm-only, Task 5) are
-- meant to be authenticated-only. Each already had an explicit grant to
-- `authenticated`; this closes the anon/PUBLIC exposure that grant alone
-- didn't cover. None were actually exploitable as anon — each performs its
-- own role check internally (assert_editor_assigned or an inline
-- current_profile_role() check, the latter of which anon can no longer even
-- call) — but the ACL should match intent, not rely solely on the function
-- body to enforce it.
revoke execute on function post_comment(uuid, text) from public, anon;
revoke execute on function set_song_license(uuid, boolean) from public, anon;
revoke execute on function update_editing_status(uuid, text) from public, anon;
revoke execute on function regenerate_client_token(uuid) from public, anon;
