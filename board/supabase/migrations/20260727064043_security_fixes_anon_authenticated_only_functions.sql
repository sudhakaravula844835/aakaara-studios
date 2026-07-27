-- board/supabase/migrations/20260727064043_security_fixes_anon_authenticated_only_functions.sql
--
-- post_comment / set_song_license / update_editing_status (editor RPC
-- writes, Task 4) and regenerate_client_token (owner/pm-only, Task 5) are
-- meant to be authenticated-only. Each already had an explicit grant to
-- `authenticated`; this closes the anon exposure that grant alone didn't
-- cover (see security_fixes_corrected's note on Supabase's project-level
-- anon/authenticated default-privilege grant). None were actually
-- exploitable as anon -- each performs its own role check internally
-- (assert_editor_assigned or an inline current_profile_role() check, the
-- latter of which anon can no longer even call) -- but the ACL should
-- match intent, not rely solely on the function body to enforce it.

revoke execute on function post_comment(uuid, text) from anon;
revoke execute on function set_song_license(uuid, boolean) from anon;
revoke execute on function update_editing_status(uuid, text) from anon;
revoke execute on function regenerate_client_token(uuid) from anon;
