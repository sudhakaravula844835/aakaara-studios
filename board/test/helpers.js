import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'node:crypto';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error(
    'Missing SUPABASE_URL / SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY — copy board/.env.example to board/.env and fill it in.'
  );
}

export const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// The full suite creates ~50 auth users in a short window, and GoTrue
// occasionally answers one createUser call with a transient 500
// (AuthRetryableFetchError). Retry only that shape -- a genuine validation
// error (duplicate email, weak password) must still fail loudly and
// immediately rather than being retried into a slower identical failure.
function isRetryableAuthError(error) {
  if (!error) return false;
  if (error.name === 'AuthRetryableFetchError') return true;
  if (error.status === 429 || error.code === 'over_request_rate_limit') return true;
  return typeof error.status === 'number' && error.status >= 500;
}

async function createAuthUserWithRetry(payload, attempts = 5) {
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const { data, error } = await adminClient.auth.admin.createUser(payload);
    if (!error) return data;
    lastError = error;
    if (!isRetryableAuthError(error) || attempt === attempts) break;
    await sleep(750 * attempt);
  }
  throw lastError;
}

async function signInWithRetry(client, credentials, attempts = 5) {
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const { error } = await client.auth.signInWithPassword(credentials);
    if (!error) return;
    lastError = error;
    if (!isRetryableAuthError(error) || attempt === attempts) break;
    await sleep(750 * attempt);
  }
  throw lastError;
}

export async function createTestProfile(role) {
  const email = `test-${role}-${randomUUID()}@example.com`;
  const password = 'TestPassword123!';

  const userData = await createAuthUserWithRetry({
    email,
    password,
    email_confirm: true,
  });

  const { error: profileError } = await adminClient
    .from('profiles')
    .insert({ id: userData.user.id, role, full_name: `Test ${role}`, email });
  if (profileError) throw profileError;

  const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  await signInWithRetry(client, { email, password });

  return { id: userData.user.id, email, client };
}

export async function deleteTestProfile(id) {
  await adminClient.auth.admin.deleteUser(id);
}

export async function createTestProject(overrides = {}) {
  const { data, error } = await adminClient
    .from('projects')
    .insert({ client_name: 'Test Client', ...overrides })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteTestProject(id) {
  await adminClient.from('projects').delete().eq('id', id);
}
