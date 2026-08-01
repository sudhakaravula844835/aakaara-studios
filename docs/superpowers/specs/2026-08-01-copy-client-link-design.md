# Copy Client Link — Design Spec
**Date:** 2026-08-01
**Project:** Aakaara Studios — Project Board, Owner/PM board enhancement
**Files affected:** `board/board.js` (modified), `board/index.html` (modified), `board/board.css` (modified), `board/project-modal.js` (modified)

---

## Context

The client portal (`board/client.html`) has existed since the client-tracker sub-project shipped, and reads its token from `?token=`, a `#`-hash, or a `/client/<token>` path segment. Nothing in the Owner/PM board surfaces that link anywhere — the only way to get a project's `client_access_token` today is a direct database query. This is the first item off the post-audit "recommended next enhancements" list, taken one at a time per the brainstorm → spec → plan → build process the rest of the board follows.

## Decisions Made During Brainstorming

| Question | Decision |
|---|---|
| Scope | Copy only. `regenerate_client_token` already exists as an RPC but has no UI anywhere — stays out of scope for this pass, to keep this change small and shippable. |
| Link format | `https://aakaarastudiosnyc.com/board/client.html?token=<token>` — the query-param path `client.js` already reads, no new `_redirects` rule needed. A prettier `/board/client/<token>` path was considered but deferred; nothing depends on it existing. |
| Placement | `.detail-header-actions` in the Owner/PM project detail panel, alongside the existing Edit/Close buttons, styled to match. |
| Behavior on a revoked token | Button stays active regardless of `token_revoked` — copies whatever token is currently on the row. A revoked link simply won't work for the client if pasted; no extra state to track for a copy-only action. |

## Architecture

```
board/board.js          — fetchProjects()'s .select(...) gains client_access_token.
                           Not currently selected; everything else this feature needs
                           (client_name, id) is already there.

board/index.html         — one new button in .detail-header-actions:
                           <button class="detail-copy-link" id="detailCopyLinkBtn">
                             Copy Client Link
                           </button>

board/board.css           — .detail-copy-link styled to match .detail-edit/.detail-close
                           (same border/hover treatment, no new visual language).

board/project-modal.js   — one new click listener, added next to the existing
                           detailEditBtn/detailClose wiring:
                             build the URL from currentDetailProject.client_access_token
                             navigator.clipboard.writeText(url)
                             showSuccessToast('Client link copied.') on success
                             showErrorToast('Could not copy link.') on failure
```

No backend change — the token already exists on every `projects` row and is already reachable by Owner/PM under the existing `projects_all_owner_pm` RLS policy. This is a read-and-display feature only.

## Error Handling

`navigator.clipboard.writeText()` rejects in a non-secure context (plain HTTP) or if the Permissions API denies clipboard-write. Both surface as the existing `showErrorToast` pattern — no new error UI needed. Netlify serves the board over HTTPS in production, so the non-secure-context case is a local-dev-only concern.

## Testing

A unit test in `board/test/board-fetch-fields.test.js` (the file that already asserts on selected columns and rendered UI strings by reading file contents, per its existing pattern) confirming:
- `client_access_token` is present in `fetchProjects()`'s select list
- `board/index.html` contains the `detailCopyLinkBtn` button
- `project-modal.js` wires a click listener to it and calls `navigator.clipboard.writeText`

No live Supabase integration test needed — this feature reads a column RLS already permits and writes to the clipboard, neither of which is a security boundary.

## Out of Scope

- Regenerating or revoking the token from this UI (see Decisions table).
- A prettier `/board/client/<token>` URL.
- Any indication in the UI of whether the copied link is currently revoked.
