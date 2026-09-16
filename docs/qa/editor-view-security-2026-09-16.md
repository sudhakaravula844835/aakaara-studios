# Editor view security fix

Applied to the live aakaara-board Supabase project through SQL Editor on September 16, 2026. SQL Editor returned Success. No rows returned.

Migration: `board/supabase/migrations/20260916120000_editor_view_security_invoker.sql`.

The public editor_project_view now uses security_invoker=true. A non-API editor_private schema contains a fixed-search-path SECURITY DEFINER function with an explicit 13-column allowlist, current active editor role check, and auth.uid()-scoped project assignment join. This retains the necessary narrow privileged read without granting editors access to the underlying projects table. Anonymous access to the view/helper is revoked. A SECURITY INVOKER computed relationship preserves the existing PostgREST sub_events embedding, with the existing sub-event RLS policies still applied. No frontend deployment is required.

## Verification

- Isolated PostgreSQL test passed: assigned/unassigned projects, safe columns, finance/token exclusion, direct project denial, anonymous denial, inactive editor denial, owner financial access preserved, sub-event relationship including forged IDs, and migration reapplication.
- Live read-only transaction using an existing active editor identity returned: active_editor=true, assigned_count_matches=true, direct_projects_blocked=true, accessible_sub_events=5, view_options=[security_invoker=true]. The transaction was rolled back; no client records or assignments were changed.
- Live anonymous REST request using the editor's nested sub-event select returned HTTP 401 / PostgreSQL 42501 (permission denied for view editor_project_view), confirming anonymous access is blocked without a missing-relationship/schema-cache error.
- Security Advisor's browser overlay prevented a reliable final visual refresh. The live database property that caused the specific SECURITY DEFINER view finding is verified corrected; refresh/rerun Security Advisor to clear its cached result.

Run the isolated test with `node tests/editor-view-security.cjs`. It expects @electric-sql/pglite under `/tmp/aakaara-review-db/node_modules/` or at the path specified by PGLITE_MODULE. The test uses no production credentials or network access.

Reference: https://supabase.com/docs/guides/database/views and https://docs.postgrest.org/en/v14/references/api/resource_embedding.html (computed relationships).
