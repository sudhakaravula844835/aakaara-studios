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

## Quote tracking rollout

Apply `supabase/migrations/20260913120000_quote_tracking.sql` to the same Supabase
project used by `supabase-client.js` **before deploying this frontend**. It adds
`source_quote_id`, the `quote_sent` stage and `create_quote_project(uuid,jsonb)`.
Existing booked records keep their stage key; the interface calls it Confirmed.

The quote generator requires an active Board owner/PM session. Send quote saves a
shared Board record before downloading the PDF and opening a Gmail draft. Gmail
still requires the user to attach and send; this is not email delivery tracking.
The same draft UUID deduplicates retries without overwriting its original amount.
Editing the still-open form for a different client after a successful send
mints a fresh UUID automatically (`hasQuoteChangedSinceLastSend`), so a second
send always lands as its own Board record even without clicking New Quote or
Reset first. Old browser-only quotes are not migrated automatically.

To confirm: open the dashboard card, choose Edit, set Status to Confirmed, enter
Agreed price, and save. Original quote price is read-only for generated quotes.

Local checks: `node --test tests/unit/quote-tracking.test.mjs` and
`playwright test quote-tracking.spec.js`. Browser tests mock database calls and
email handoffs. After applying the migration to a test database, run
`vitest run board/test/quote-tracking.test.js` for real RLS and transaction checks.
