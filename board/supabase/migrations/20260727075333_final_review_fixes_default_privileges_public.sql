-- Verification during Fix 5 rollout showed that revoking the default
-- EXECUTE grant from anon/authenticated alone does NOT close the gap:
-- Postgres itself grants EXECUTE to the PUBLIC pseudo-role by default on
-- every newly created function, independent of the anon/authenticated
-- default-privilege entries -- and PUBLIC's grant is visible to every role,
-- including anon and authenticated (confirmed empirically via a throwaway
-- probe function + has_function_privilege). Revoke the PUBLIC default too
-- so a function created with no explicit grants is truly inaccessible to
-- anon/authenticated going forward, matching Fix 5's actual intent.
alter default privileges in schema public revoke execute on functions from public;
