import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error(
    'Missing SUPABASE_URL / SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY — copy board/.env.example to board/.env and fill it in.'
  );
}

export const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

let testCounter = 0;

export async function createTestProfile(role) {
  testCounter += 1;
  const email = `test-${role}-${Date.now()}-${testCounter}@example.com`;
  const password = 'TestPassword123!';

  const { data: userData, error: userError } = await adminClient.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (userError) throw userError;

  const { error: profileError } = await adminClient
    .from('profiles')
    .insert({ id: userData.user.id, role, full_name: `Test ${role}`, email });
  if (profileError) throw profileError;

  const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  const { error: signInError } = await client.auth.signInWithPassword({ email, password });
  if (signInError) throw signInError;

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
