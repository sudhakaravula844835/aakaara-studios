// tests/board-helpers.js
// Shared setup for board/ Playwright specs: creates real Supabase auth
// users + profiles (service-role, same pattern as board/test/helpers.js)
// and produces real, signed-in session state for Playwright contexts --
// no mocked auth or stubbed network responses anywhere in these specs.
import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'node:crypto';
import { config } from 'dotenv';
import path from 'node:path';

// Not import.meta.url + fileURLToPath: Playwright's loader transforms this
// file to CJS to run under Node, where import.meta is invalid syntax and
// breaks the whole transform with a confusing "exports is not defined"
// error. __dirname is a real global in that CJS output, so use it directly.
config({ path: path.resolve(__dirname, '../board/.env') });

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

export const boardEnvAvailable = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY && SUPABASE_SERVICE_ROLE_KEY);

export const adminClient = boardEnvAvailable ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY) : null;

// supabase-js's default localStorage adapter key -- must match
// board/supabase-client.js's client (created with no custom storageKey).
// Derived the same way supabase-js derives it: `sb-<project-ref>-auth-token`.
const PROJECT_REF = SUPABASE_URL ? new URL(SUPABASE_URL).hostname.split('.')[0] : '';
export const AUTH_STORAGE_KEY = `sb-${PROJECT_REF}-auth-token`;

export async function createTestUser(role, overrides = {}) {
  const email = `pw-${role}-${randomUUID()}@example.com`;
  const password = 'TestPassword123!';
  const { data: userData, error: userError } = await adminClient.auth.admin.createUser({
    email, password, email_confirm: true,
  });
  if (userError) throw userError;
  const { error: profileError } = await adminClient
    .from('profiles')
    .insert({ id: userData.user.id, role, full_name: `Playwright ${role}`, email, ...overrides });
  if (profileError) throw profileError;
  return { id: userData.user.id, email, password };
}

export async function deleteTestUser(id) {
  await adminClient.auth.admin.deleteUser(id);
}

export async function createTestProject(overrides = {}) {
  const { data, error } = await adminClient
    .from('projects')
    .insert({ client_name: `Playwright Project ${randomUUID().slice(0, 8)}`, ...overrides })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteTestProject(id) {
  await adminClient.from('projects').delete().eq('id', id);
}

// Real sign-in via the anon client (the same call board/login.js makes),
// returned as a Playwright `storageState`-shaped object so specs can seed a
// genuinely valid, RLS-enforced session without re-typing credentials into
// the login form for every single test.
export async function realSessionStorageState(email, password, origin) {
  const anon = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  const { data, error } = await anon.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return {
    cookies: [],
    origins: [{
      origin,
      localStorage: [{ name: AUTH_STORAGE_KEY, value: JSON.stringify(data.session) }],
    }],
  };
}
