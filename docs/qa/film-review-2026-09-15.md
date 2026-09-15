# Film draft review and editor communication

Implemented locally. No live Supabase migration or deployment has been performed.

## Workflow

1. In the Board or editor project detail, open **Drafts & client review**. Save a film title, HTTPS video/review link, and optional client note. A new version is assigned transactionally. Editors see only assigned projects.
2. An active owner/PM reviews the saved draft and selects **Share with client**. The client can now see it and the project moves to Video Editing / Client review. Published versions are immutable; corrections use a new draft. Unpublished drafts can be discarded by their author or an owner/PM.
3. The client opens **Film review**, watches the linked video, and submits feedback with an optional mm:ss or hh:mm:ss timestamp. Direct MP4/WebM links also have an inline player; other hosted review links open in a new tab.
4. Clients approve or request changes on the latest shared version. Older versions retain their feedback. Requesting changes sets Revisions. Approval is recorded for the version and leaves final delivery under studio control.
5. Editors use **Post internal note** for team-only communication. **Message to client** in the preparation form queues a message for owner/PM review. Publishing places it in the client conversation with the original author's name. No email/SMS notifications are sent. Use Refresh review or reload to retrieve new updates.

The legacy editor `post_comment` RPC now creates internal notes, closing the old direct-to-client route. Roll out the migration and frontend together so the editor labels match this behavior.

## Verification

- `node tests/film-review-database.cjs`: executed the existing schema/access helpers and both new migrations in isolated PGlite PostgreSQL with simulated auth identities. Verified assignment checks, deactivated staff denial, private-draft visibility, direct-table denial, owner-only publishing, token isolation/revocation, versioned feedback, approval/revisions, shared-history protection, retry idempotency, and internal/client message separation. Also verified the previous photo-selection RPC rolls back counts when comment insertion fails, and song retries do not duplicate.
- `node tests/film-review-browser.cjs`: editor, owner, and client interactions at 375px and 1440px, including failed-save recovery, stable retry IDs, timestamp conversion, publishing controls, draft preparation, client-message preparation, and overflow checks.
- `node tests/film-review-integration.cjs`: actual editor and Board pages mount the new review panel with mocked authentication/data.
- `node tests/client-portal-improvements.cjs`: existing portal checks at 375/768/1024/1440px still pass.
- JavaScript syntax and git whitespace checks pass.

The browser scripts expect a local repository server at 127.0.0.1:8766. The database test uses `PGLITE_MODULE` or `/tmp/aakaara-review-db/node_modules/@electric-sql/pglite`; install the temporary dependency with `npm install --prefix /tmp/aakaara-review-db @electric-sql/pglite --no-audit --no-fund`.

These tests do not verify hosted Supabase configuration, actual account sessions, or the playback/privacy settings of a client's video provider.

## Rollout

Apply these migrations in order before deploying the frontend:

1. `board/supabase/migrations/20260915120000_client_portal_selections.sql`
2. `board/supabase/migrations/20260915140000_film_review.sql`

Then verify one owner/PM → assigned editor → client workflow on the intended Supabase environment. The review RPCs use explicit token/role checks and keep private tables inaccessible directly to anonymous/authenticated callers.

## Local sample preview

The preview at port 8767 includes Editor, Owner/PM, and Client links. Its sample workflow is stored under `aakaara-film-review-demo` in that origin's localStorage. It never connects to Supabase, and video URLs are placeholders. Changes in one role can be seen by refreshing the other role.
