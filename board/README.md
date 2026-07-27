# Project Board — Foundation

Supabase schema, RLS policies, and RPC functions for the Aakaara Studios project board.
No UI yet — see `docs/superpowers/plans/` for the sub-projects that build on this.

## Local setup

1. Copy `board/.env.example` to `board/.env`.
2. Fill in `SUPABASE_URL` and `SUPABASE_ANON_KEY` from the Supabase dashboard's API settings
   (Project Settings → API). Fill in `SUPABASE_SERVICE_ROLE_KEY` from the same page —
   this key bypasses RLS entirely and is used only by integration tests to seed/tear down
   data. Never commit `board/.env` or use the service-role key in browser-facing code.
3. Run `npm run test:unit -- board/test` to run the integration tests against the real
   Supabase dev project (no local Docker/Supabase CLI needed).

## Migrations

SQL lives in `board/supabase/migrations/`, applied to the hosted project via the
Supabase MCP `apply_migration` tool in the order the files are numbered.

## Roles

- **Owner/PM** — Supabase Auth accounts, full access via RLS policies.
- **Editor** — Supabase Auth accounts, scoped to assigned projects via `editor_project_view`
  (read) and dedicated RPC functions (write): `update_editing_status`, `set_song_license`,
  `post_comment`.
- **Client** — no account. Access is a `client_access_token` (UUID) in the URL, validated
  inside every RPC call: `get_project_by_token`, `update_photo_selection`, `submit_song`,
  `post_client_comment`. Owner/PM can invalidate a leaked link with `regenerate_client_token`.
