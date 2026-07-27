import { describe, it, expect, afterEach } from 'vitest';
import {
  createTestProfile, deleteTestProfile,
  createTestProject, deleteTestProject,
  adminClient,
} from './helpers.js';

describe('owner/pm access', () => {
  let profile;
  let project;

  afterEach(async () => {
    if (project) await deleteTestProject(project.id);
    if (profile) await deleteTestProfile(profile.id);
    project = null;
    profile = null;
  });

  it('owner can select all projects', async () => {
    profile = await createTestProfile('owner');
    project = await createTestProject();

    const { data, error } = await profile.client.from('projects').select('id').eq('id', project.id);
    expect(error).toBeNull();
    expect(data).toHaveLength(1);
  });

  it('pm can update a project stage and it is reflected immediately', async () => {
    profile = await createTestProfile('pm');
    project = await createTestProject();

    const { error } = await profile.client
      .from('projects')
      .update({ stage: 'shoot_completed' })
      .eq('id', project.id);
    expect(error).toBeNull();

    const { data } = await adminClient.from('projects').select('stage').eq('id', project.id).single();
    expect(data.stage).toBe('shoot_completed');
  });

  it('a pm stage update writes an activity_log row attributed to pm', async () => {
    profile = await createTestProfile('pm');
    project = await createTestProject();

    await profile.client.from('projects').update({ stage: 'shoot_completed' }).eq('id', project.id);

    const { data } = await adminClient
      .from('activity_log')
      .select('actor_role, field_changed, old_value, new_value')
      .eq('project_id', project.id)
      .eq('field_changed', 'stage');

    expect(data).toHaveLength(1);
    expect(data[0].actor_role).toBe('pm');
    expect(data[0].old_value).toBe('booked');
    expect(data[0].new_value).toBe('shoot_completed');
  });

  it('owner can post a comment directly', async () => {
    profile = await createTestProfile('owner');
    project = await createTestProject();

    const { error } = await profile.client
      .from('comments')
      .insert({ project_id: project.id, author_role: 'owner', author_label: 'Sudhakar', body: 'Looks good' });
    expect(error).toBeNull();
  });
});
