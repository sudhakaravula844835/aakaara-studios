import { describe, it, expect, afterEach } from 'vitest';
import {
  createTestProfile, deleteTestProfile,
  createTestProject, deleteTestProject,
  adminClient,
} from './helpers.js';

describe('staff deactivation', () => {
  let pm;
  let project;

  afterEach(async () => {
    if (project) await deleteTestProject(project.id);
    if (pm) await deleteTestProfile(pm.id);
    pm = null;
    project = null;
  });

  it('active PM can update projects (baseline)', async () => {
    pm = await createTestProfile('pm');
    project = await createTestProject({ stage: 'booked' });

    const { data, error } = await pm.client
      .from('projects')
      .update({ stage: 'shoot_completed' })
      .eq('id', project.id)
      .select();
    expect(error).toBeNull();
    expect(data).toHaveLength(1);
  });

  it('deactivated PM loses all RLS-gated access immediately, without re-login', async () => {
    pm = await createTestProfile('pm');
    project = await createTestProject({ stage: 'booked' });

    const before = await pm.client.from('projects').select('id').eq('id', project.id);
    expect(before.data).toHaveLength(1);

    await adminClient.from('profiles').update({ active: false }).eq('id', pm.id);

    // Same already-signed-in client, no re-login -- current_profile_role()
    // is evaluated fresh on every RLS check, so deactivation must take
    // effect on the very next query, not just for a future session.
    const { data: reads } = await pm.client.from('projects').select('id').eq('id', project.id);
    expect(reads).toHaveLength(0);

    const { data: writes } = await pm.client
      .from('projects')
      .update({ stage: 'shoot_completed' })
      .eq('id', project.id)
      .select();
    expect(writes ?? []).toHaveLength(0);

    const { data: unchanged } = await adminClient.from('projects').select('stage').eq('id', project.id).single();
    expect(unchanged.stage).toBe('booked');
  });

  it('deactivated user can still read their own profile row', async () => {
    pm = await createTestProfile('pm');
    await adminClient.from('profiles').update({ active: false }).eq('id', pm.id);

    const { data, error } = await pm.client.from('profiles').select('active').eq('id', pm.id).single();
    expect(error).toBeNull();
    expect(data.active).toBe(false);
  });

  it('reactivating restores access without re-login', async () => {
    pm = await createTestProfile('pm');
    project = await createTestProject({ stage: 'booked' });
    await adminClient.from('profiles').update({ active: false }).eq('id', pm.id);
    await adminClient.from('profiles').update({ active: true }).eq('id', pm.id);

    const { data } = await pm.client.from('projects').select('id').eq('id', project.id);
    expect(data).toHaveLength(1);
  });
});
