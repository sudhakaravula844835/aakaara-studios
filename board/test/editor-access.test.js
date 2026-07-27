import { describe, it, expect, afterEach } from 'vitest';
import {
  createTestProfile, deleteTestProfile,
  createTestProject, deleteTestProject,
  adminClient,
} from './helpers.js';

describe('editor access', () => {
  let editor;
  let project;

  afterEach(async () => {
    if (project) await deleteTestProject(project.id);
    if (editor) await deleteTestProfile(editor.id);
    editor = null;
    project = null;
  });

  it('editor sees zero rows querying projects directly, even for an assigned project', async () => {
    editor = await createTestProfile('editor');
    project = await createTestProject({ confirmed_price: 5000 });
    await adminClient.from('project_editors').insert({ project_id: project.id, editor_id: editor.id });

    const { data } = await editor.client.from('projects').select('id').eq('id', project.id);
    expect(data).toHaveLength(0);
  });

  it('editor sees the project via editor_project_view without financial columns', async () => {
    editor = await createTestProfile('editor');
    project = await createTestProject({ confirmed_price: 5000 });
    await adminClient.from('project_editors').insert({ project_id: project.id, editor_id: editor.id });

    const { data, error } = await editor.client.from('editor_project_view').select('*').eq('id', project.id);
    expect(error).toBeNull();
    expect(data).toHaveLength(1);
    expect(data[0]).not.toHaveProperty('confirmed_price');
    expect(data[0]).not.toHaveProperty('quoted_price');
  });

  it('editor cannot see a project they are not assigned to', async () => {
    editor = await createTestProfile('editor');
    project = await createTestProject();

    const { data } = await editor.client.from('editor_project_view').select('*').eq('id', project.id);
    expect(data).toHaveLength(0);
  });

  it('editor cannot directly update projects (no write grant path)', async () => {
    editor = await createTestProfile('editor');
    project = await createTestProject();
    await adminClient.from('project_editors').insert({ project_id: project.id, editor_id: editor.id });

    const { data } = await editor.client
      .from('projects')
      .update({ confirmed_price: 9999 })
      .eq('id', project.id)
      .select();
    expect(data).toHaveLength(0);

    const { data: unchanged } = await adminClient.from('projects').select('confirmed_price').eq('id', project.id).single();
    expect(unchanged.confirmed_price).toBeNull();
  });

  it('update_editing_status succeeds when project is in video_editing stage and assigned', async () => {
    editor = await createTestProfile('editor');
    project = await createTestProject({ stage: 'video_editing' });
    await adminClient.from('project_editors').insert({ project_id: project.id, editor_id: editor.id });

    const { error } = await editor.client.rpc('update_editing_status', {
      p_project_id: project.id,
      p_substatus: 'in_progress',
    });
    expect(error).toBeNull();

    const { data } = await adminClient.from('projects').select('video_editing_substatus').eq('id', project.id).single();
    expect(data.video_editing_substatus).toBe('in_progress');

    const { data: log } = await adminClient
      .from('activity_log')
      .select('actor_role')
      .eq('project_id', project.id)
      .eq('field_changed', 'video_editing_substatus');
    expect(log).toHaveLength(1);
    expect(log[0].actor_role).toBe('editor');
  });

  it('update_editing_status rejects when project is not in video_editing stage', async () => {
    editor = await createTestProfile('editor');
    project = await createTestProject({ stage: 'booked' });
    await adminClient.from('project_editors').insert({ project_id: project.id, editor_id: editor.id });

    const { error } = await editor.client.rpc('update_editing_status', {
      p_project_id: project.id,
      p_substatus: 'in_progress',
    });
    expect(error).not.toBeNull();
  });

  it('update_editing_status rejects when editor is not assigned to the project', async () => {
    editor = await createTestProfile('editor');
    project = await createTestProject({ stage: 'video_editing' });

    const { error } = await editor.client.rpc('update_editing_status', {
      p_project_id: project.id,
      p_substatus: 'in_progress',
    });
    expect(error).not.toBeNull();
  });

  it('set_song_license and post_comment work for an assigned project', async () => {
    editor = await createTestProfile('editor');
    project = await createTestProject();
    await adminClient.from('project_editors').insert({ project_id: project.id, editor_id: editor.id });
    const { data: song } = await adminClient
      .from('songs')
      .insert({ project_id: project.id, title: 'Test Song' })
      .select()
      .single();

    const { error: licenseError } = await editor.client.rpc('set_song_license', {
      p_song_id: song.id,
      p_license_confirmed: true,
    });
    expect(licenseError).toBeNull();

    const { error: commentError } = await editor.client.rpc('post_comment', {
      p_project_id: project.id,
      p_body: 'Editing started',
    });
    expect(commentError).toBeNull();
  });

  // Fix 6: set_song_license must check assignment against the SONG's own
  // project, not just "some project this editor happens to be assigned to".
  it('set_song_license rejects when the song belongs to a project the editor is not assigned to', async () => {
    editor = await createTestProfile('editor');
    project = await createTestProject(); // deliberately NOT assigning editor
    const { data: song } = await adminClient
      .from('songs')
      .insert({ project_id: project.id, title: 'Unassigned Project Song' })
      .select()
      .single();

    const { error } = await editor.client.rpc('set_song_license', {
      p_song_id: song.id,
      p_license_confirmed: true,
    });
    expect(error).not.toBeNull();

    const { data: unchanged } = await adminClient.from('songs').select('license_confirmed').eq('id', song.id).single();
    expect(unchanged.license_confirmed).toBe(false);
  });

  // Fix 6: table-level SELECT policies for sub_events/songs/activity_log/
  // comments are all "editor AND assigned to this project" -- confirm the
  // assignment half actually gates it, not just editor_project_view's own
  // row-scoping (which was already covered above).
  describe('editor denied table access for a project they are NOT assigned to', () => {
    it('sub_events', async () => {
      editor = await createTestProfile('editor');
      project = await createTestProject();
      await adminClient.from('sub_events').insert({ project_id: project.id, name: 'Sangeet' });

      const { data, error } = await editor.client.from('sub_events').select('*').eq('project_id', project.id);
      expect(error).toBeNull();
      expect(data).toHaveLength(0);
    });

    it('songs', async () => {
      editor = await createTestProfile('editor');
      project = await createTestProject();
      await adminClient.from('songs').insert({ project_id: project.id, title: 'Song' });

      const { data, error } = await editor.client.from('songs').select('*').eq('project_id', project.id);
      expect(error).toBeNull();
      expect(data).toHaveLength(0);
    });

    it('activity_log', async () => {
      editor = await createTestProfile('editor');
      project = await createTestProject({ stage: 'shoot_completed' });

      const { data, error } = await editor.client.from('activity_log').select('*').eq('project_id', project.id);
      expect(error).toBeNull();
      expect(data).toHaveLength(0);
    });

    it('comments', async () => {
      editor = await createTestProfile('editor');
      project = await createTestProject();
      await adminClient.from('comments').insert({ project_id: project.id, author_role: 'owner', author_label: 'Owner', body: 'hi' });

      const { data, error } = await editor.client.from('comments').select('*').eq('project_id', project.id);
      expect(error).toBeNull();
      expect(data).toHaveLength(0);
    });
  });

  // Fix 6: the primary self-escalation path -- an editor inserting
  // themselves into project_editors for a project nobody assigned them to.
  it('editor cannot self-assign to an arbitrary project via project_editors insert', async () => {
    editor = await createTestProfile('editor');
    project = await createTestProject();

    const { data, error } = await editor.client
      .from('project_editors')
      .insert({ project_id: project.id, editor_id: editor.id })
      .select();
    expect(data ?? []).toHaveLength(0);
    expect(error).not.toBeNull();

    const { data: rows } = await adminClient
      .from('project_editors')
      .select('*')
      .eq('project_id', project.id)
      .eq('editor_id', editor.id);
    expect(rows).toHaveLength(0);
  });

  // Fix 7: profiles is no longer readable by every authenticated user --
  // an editor can see their own row but not another user's.
  it('editor can select their own profile row but not another user\'s', async () => {
    editor = await createTestProfile('editor');
    const other = await createTestProfile('editor');
    try {
      const { data: own } = await editor.client.from('profiles').select('id').eq('id', editor.id);
      expect(own).toHaveLength(1);

      const { data: theirs } = await editor.client.from('profiles').select('id').eq('id', other.id);
      expect(theirs).toHaveLength(0);
    } finally {
      await deleteTestProfile(other.id);
    }
  });
});
