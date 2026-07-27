import { describe, it, expect } from 'vitest';
import { createClient } from '@supabase/supabase-js';

const anon = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

// Fix 5: after `alter default privileges ... revoke execute on functions
// from public, anon, authenticated`, the staff-only RPCs (post_comment,
// set_song_license, update_editing_status, regenerate_client_token) must
// still be unreachable by anon -- their explicit `to authenticated` grants
// were re-issued, but anon was never supposed to have access in the first
// place. This also covers the anon half of Fix 6's coverage gap for these
// four functions.
//
// A Postgres "insufficient privilege" error surfaces through PostgREST as
// HTTP 401/403 with code 42501 and a "permission denied for function ..."
// message -- we assert on that shape rather than "any error", so this test
// doesn't silently pass if the RPC instead fails for an unrelated reason
// (e.g. a bad argument) before the ACL is ever checked.
function expectPermissionDenied(error) {
  expect(error).not.toBeNull();
  const haystack = `${error.code ?? ''} ${error.message ?? ''}`.toLowerCase();
  expect(haystack).toMatch(/42501|permission denied/);
}

describe('security defaults: anon cannot execute staff-only RPCs', () => {
  it('post_comment', async () => {
    const { error } = await anon.rpc('post_comment', {
      p_project_id: '00000000-0000-0000-0000-000000000000',
      p_body: 'hello',
    });
    expectPermissionDenied(error);
  });

  it('set_song_license', async () => {
    const { error } = await anon.rpc('set_song_license', {
      p_song_id: '00000000-0000-0000-0000-000000000000',
      p_license_confirmed: true,
    });
    expectPermissionDenied(error);
  });

  it('update_editing_status', async () => {
    const { error } = await anon.rpc('update_editing_status', {
      p_project_id: '00000000-0000-0000-0000-000000000000',
      p_substatus: 'in_progress',
    });
    expectPermissionDenied(error);
  });

  it('regenerate_client_token', async () => {
    const { error } = await anon.rpc('regenerate_client_token', {
      p_project_id: '00000000-0000-0000-0000-000000000000',
    });
    expectPermissionDenied(error);
  });
});
