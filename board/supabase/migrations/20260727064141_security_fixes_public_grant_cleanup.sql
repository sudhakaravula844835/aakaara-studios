-- board/supabase/migrations/20260727064141_security_fixes_public_grant_cleanup.sql
--
-- Closes out the same PUBLIC-default gap for post_comment / set_song_license
-- / update_editing_status / regenerate_client_token that
-- security_fixes_anon_authenticated_only_functions closed for `anon`: the
-- plain Postgres PUBLIC default grant on these four functions independent
-- of their explicit `authenticated`-only grant.

revoke execute on function post_comment(uuid, text) from public;
revoke execute on function set_song_license(uuid, boolean) from public;
revoke execute on function update_editing_status(uuid, text) from public;
revoke execute on function regenerate_client_token(uuid) from public;
