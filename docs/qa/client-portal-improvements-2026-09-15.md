# Client portal improvements — September 15, 2026

Implemented locally; not deployed. The sample preview uses in-memory demonstration data and never connects to Supabase.

## Changes

- Collapsible project journey and direct links to photographs, music, and messages.
- Next action checks selection counts for every event; quote and final delivery have explicit copy.
- Saved photo filenames remain visible and editable. Legacy lists are recovered from the latest matching client comment when the event name is unique.
- Atomic photo-list/count/comment RPC, including events with no configured gallery count. Repeating an identical list creates no duplicate comment.
- One song form initially; add more as needed. Stable submission IDs support retrying lost responses, and successful entries clear individually after partial batch failure. Maximum five suggestions enforced in the new RPC.
- Edit/remove unconfirmed songs. Confirmed music requires studio assistance.
- Finished photo gallery and film fields in the Board project form, surfaced in the client collection section.
- Message timestamps, visible form labels, higher-contrast portal controls, preserved in-page photo and message drafts, and retry for initial network errors.

## Validation

Run a local server on port 8766 from the repository root, then:

```sh
node tests/client-portal-improvements.cjs
```

The browser checks use mocked RPCs and sample data. They cover 375, 768, 1024, and 1440px layouts, horizontal overflow, saved photo lists, atomic-RPC use, failed-save recovery, message draft preservation, song retry IDs, expanding song forms, song editing, collapsed/expanded journey, timestamps, delivery links, and initial network-error recovery. JavaScript syntax and git whitespace checks also pass.

SQL has been reviewed but has not been executed against Supabase. These browser checks do not prove production database permissions or transactions.

## Required rollout order

1. Apply `board/supabase/migrations/20260915120000_client_portal_selections.sql` in the intended Supabase project. It is transactional and adds two project delivery fields, a saved-photo-list field, and token-scoped RPCs. Existing client data is retained.
2. Verify revoked/other-project tokens are rejected; photo list/count/comment save together; unknown gallery counts work; identical song submission IDs do not duplicate; confirmed songs cannot be edited; and the five-song cap works.
3. Deploy the frontend and Board changes together. Do not deploy the Board's new field query before the migration.
4. Verify a real authenticated Board owner/PM can set final links and that the corresponding client portal displays them.

No client data, messages, authentication accounts, or live website files were changed during this work. Drafts are retained during in-page refreshes/retries, not across closing or reloading the browser tab.
