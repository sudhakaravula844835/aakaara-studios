-- board/supabase/migrations/20260727063759_security_fixes.sql
--
-- First pass at `get_advisors(type: "security")` findings after Tasks 2-5.
-- Reconstructed record: this is the first of four real applied migrations
-- that the repo had previously squashed into one hand-written summary file
-- (old 0005_security_fixes.sql). See the final review's Fix 4 for context
-- on why this was split back out, and security_fixes_corrected below for
-- why this first attempt turned out to be incomplete.

-- set_updated_at is not SECURITY DEFINER, so it wasn't covered by the
-- blanket "every SECURITY DEFINER function sets search_path" constraint --
-- but pinning it anyway removes the advisor warning at no cost. It remains
-- callable by anon/authenticated (matches the plan; harmless, since it only
-- does `new.updated_at = now(); return new;` and `new` is undefined outside
-- trigger context, so a direct RPC call errors regardless of ACL).
alter function set_updated_at() set search_path = public;

-- assert_editor_assigned / assert_valid_client_token / log_project_changes /
-- log_child_changes are internal helpers and trigger functions only, never
-- meant to be callable directly as RPC endpoints. First attempt: revoke the
-- plain Postgres PUBLIC default only. (This turned out not to be enough --
-- see security_fixes_corrected.)
revoke execute on function assert_editor_assigned(uuid) from public;
revoke execute on function assert_valid_client_token(uuid) from public;
revoke execute on function log_project_changes() from public;
revoke execute on function log_child_changes() from public;
