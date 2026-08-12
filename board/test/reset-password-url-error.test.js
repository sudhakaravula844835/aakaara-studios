import { describe, it, expect } from 'vitest';
import { readUrlError } from '../reset-password.js';

// Pure URL-parsing logic only -- no Supabase session/network involved, so
// this runs without board/.env credentials. The live "valid link -> shows
// the set-password form -> updateUser() persists" path needs a real
// Supabase session and is intentionally not covered here.

function fakeLocation(hash = '', search = '') {
  return { hash, search };
}

describe('readUrlError', () => {
  it('returns null when the URL carries no error params', () => {
    expect(readUrlError(fakeLocation())).toBeNull();
    expect(readUrlError(fakeLocation('', '?foo=bar'))).toBeNull();
  });

  it('reads error_description from the query string', () => {
    const loc = fakeLocation('', '?error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired');
    expect(readUrlError(loc)).toBe('Email link is invalid or has expired');
  });

  it('reads error_description from the hash fragment', () => {
    const loc = fakeLocation('#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired');
    expect(readUrlError(loc)).toBe('Email link is invalid or has expired');
  });

  it('falls back to error_code, then error, when no description is present', () => {
    expect(readUrlError(fakeLocation('', '?error_code=otp_expired'))).toBe('otp_expired');
    expect(readUrlError(fakeLocation('', '?error=access_denied'))).toBe('access_denied');
  });

  it('prefers the hash fragment over the query string when both somehow carry error params', () => {
    const loc = fakeLocation('#error=from_hash', '?error=from_query');
    expect(readUrlError(loc)).toBe('from_hash');
  });
});
