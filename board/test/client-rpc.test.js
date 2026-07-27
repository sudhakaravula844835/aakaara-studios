import { describe, it, expect, afterEach } from 'vitest';
import { createClient } from '@supabase/supabase-js';
import { createTestProfile, deleteTestProfile, createTestProject, deleteTestProject, adminClient } from './helpers.js';

const anon = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

describe('client RPC gateway', () => {
  let project;
  let pm;

  afterEach(async () => {
    if (project) await deleteTestProject(project.id);
    if (pm) await deleteTestProfile(pm.id);
    project = null;
    pm = null;
  });

  it('get_project_by_token returns scoped data with no financial fields for a valid token', async () => {
    project = await createTestProject({ confirmed_price: 5000, client_name: 'Priya & Rohan' });

    const { data, error } = await anon.rpc('get_project_by_token', { p_token: project.client_access_token });
    expect(error).toBeNull();
    expect(data.project.client_name).toBe('Priya & Rohan');
    expect(data.project).not.toHaveProperty('confirmed_price');
    expect(data.project).not.toHaveProperty('quoted_price');
  });

  it('get_project_by_token rejects an unknown token', async () => {
    const { error } = await anon.rpc('get_project_by_token', { p_token: '00000000-0000-0000-0000-000000000000' });
    expect(error).not.toBeNull();
  });

  it('get_project_by_token rejects a revoked token', async () => {
    project = await createTestProject({ token_revoked: true });

    const { error } = await anon.rpc('get_project_by_token', { p_token: project.client_access_token });
    expect(error).not.toBeNull();
  });

  it('update_photo_selection updates count and status, rejects out-of-range values', async () => {
    project = await createTestProject();
    const { data: subEvent } = await adminClient
      .from('sub_events')
      .insert({ project_id: project.id, name: 'Sangeet', photo_total_count: 10 })
      .select()
      .single();

    const { error: ok } = await anon.rpc('update_photo_selection', {
      p_token: project.client_access_token,
      p_sub_event_id: subEvent.id,
      p_selected_count: 10,
    });
    expect(ok).toBeNull();

    const { data: updated } = await adminClient.from('sub_events').select('*').eq('id', subEvent.id).single();
    expect(updated.photo_selection_status).toBe('complete');

    const { error: tooMany } = await anon.rpc('update_photo_selection', {
      p_token: project.client_access_token,
      p_sub_event_id: subEvent.id,
      p_selected_count: 999,
    });
    expect(tooMany).not.toBeNull();
  });

  it('submit_song inserts an unlicensed song and logs client activity', async () => {
    project = await createTestProject();

    const { data: songId, error } = await anon.rpc('submit_song', {
      p_token: project.client_access_token,
      p_sub_event_id: null,
      p_title: 'Kesariya',
      p_artist: 'Arijit Singh',
    });
    expect(error).toBeNull();

    const { data: song } = await adminClient.from('songs').select('*').eq('id', songId).single();
    expect(song.license_confirmed).toBe(false);

    const { data: log } = await adminClient
      .from('activity_log')
      .select('actor_role')
      .eq('project_id', project.id)
      .eq('field_changed', 'song_added');
    expect(log[0].actor_role).toBe('client');
  });

  it('post_client_comment inserts with author_role client', async () => {
    project = await createTestProject({ client_name: 'Meera Desai' });

    const { error } = await anon.rpc('post_client_comment', {
      p_token: project.client_access_token,
      p_body: 'Excited to see the photos!',
    });
    expect(error).toBeNull();

    const { data } = await adminClient.from('comments').select('*').eq('project_id', project.id).single();
    expect(data.author_role).toBe('client');
    expect(data.author_label).toBe('Meera Desai');
  });

  it('regenerate_client_token invalidates the old token and issues a working new one', async () => {
    pm = await createTestProfile('pm');
    project = await createTestProject();
    const oldToken = project.client_access_token;

    const { data: newToken, error } = await pm.client.rpc('regenerate_client_token', { p_project_id: project.id });
    expect(error).toBeNull();
    expect(newToken).not.toBe(oldToken);

    const { error: oldFails } = await anon.rpc('get_project_by_token', { p_token: oldToken });
    expect(oldFails).not.toBeNull();

    const { error: newWorks } = await anon.rpc('get_project_by_token', { p_token: newToken });
    expect(newWorks).toBeNull();
  });
});
