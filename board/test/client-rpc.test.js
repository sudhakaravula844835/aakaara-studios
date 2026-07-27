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

  // Fix 2: comments.internal lets Owner/PM leave notes the client never sees.
  it('get_project_by_token excludes internal comments but includes external ones', async () => {
    project = await createTestProject();
    await adminClient.from('comments').insert([
      { project_id: project.id, author_role: 'owner', author_label: 'Owner', body: 'Internal note', internal: true },
      { project_id: project.id, author_role: 'owner', author_label: 'Owner', body: 'Visible to client', internal: false },
    ]);

    const { data, error } = await anon.rpc('get_project_by_token', { p_token: project.client_access_token });
    expect(error).toBeNull();
    expect(data.comments).toHaveLength(1);
    expect(data.comments[0].body).toBe('Visible to client');
  });

  // Fix 6: anon has zero base-table access -- the spec's core claim that
  // clients only ever reach data through the token-gated RPCs.
  it('anon cannot select from projects directly', async () => {
    project = await createTestProject();

    const { data, error } = await anon.from('projects').select('id').eq('id', project.id);
    expect(error).toBeNull();
    expect(data).toHaveLength(0);
  });

  // Fix 6 / Task 5 lock-in: a token for project A can't be used to write to
  // a sub_event that belongs to project B, even though update_photo_selection
  // only takes the sub_event id (not the project id) as an argument.
  it('update_photo_selection rejects a sub_event belonging to a different project than the token', async () => {
    project = await createTestProject(); // project A
    const otherProject = await createTestProject({ client_name: 'Project B' });
    const { data: subEvent } = await adminClient
      .from('sub_events')
      .insert({ project_id: otherProject.id, name: 'Project B Event', photo_total_count: 5 })
      .select()
      .single();

    try {
      const { error } = await anon.rpc('update_photo_selection', {
        p_token: project.client_access_token, // project A's token
        p_sub_event_id: subEvent.id, // but project B's sub_event
        p_selected_count: 3,
      });
      expect(error).not.toBeNull();

      const { data: unchanged } = await adminClient.from('sub_events').select('photo_selected_count').eq('id', subEvent.id).single();
      expect(unchanged.photo_selected_count).toBe(0);
    } finally {
      await deleteTestProject(otherProject.id);
    }
  });

  // Fix 8: unbounded text on anon-reachable write endpoints.
  it('submit_song rejects an oversized title', async () => {
    project = await createTestProject();

    const { error } = await anon.rpc('submit_song', {
      p_token: project.client_access_token,
      p_sub_event_id: null,
      p_title: 'x'.repeat(5000),
      p_artist: null,
    });
    expect(error).not.toBeNull();
  });

  it('post_client_comment rejects an oversized body', async () => {
    project = await createTestProject();

    const { error } = await anon.rpc('post_client_comment', {
      p_token: project.client_access_token,
      p_body: 'x'.repeat(5000),
    });
    expect(error).not.toBeNull();
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
