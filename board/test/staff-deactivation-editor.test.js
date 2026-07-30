import { describe, it, expect, afterEach } from 'vitest';
import {
  createTestProfile, deleteTestProfile,
  createTestProject, deleteTestProject,
  adminClient,
} from './helpers.js';

// The Editor access path is the one place `profiles.active` could be bypassed:
//
//  - assert_editor_assigned() is the ONLY gate on all three Editor write RPCs
//    (they're SECURITY DEFINER, so RLS is bypassed entirely). Its role check
//    used `<>`, and `NULL <> 'editor'` is NULL -- `IF NULL THEN` doesn't
//    branch, so a deactivated editor (current_profile_role() -> NULL) sailed
//    straight through.
//  - editor_project_view runs with definer privileges (security_invoker =
//    false) against `projects`, which has no editor SELECT policy at all. It
//    checked only the project_editors join, never the role, so a deactivated
//    editor kept full read access to client_email / client_phone /
//    package_tier / raw_delivery_link.
//
// Both are exercised here against the SAME already-signed-in client, with no
// re-login, matching the "takes effect immediately" contract established in
// staff-deactivation.test.js -- a still-valid JWT must stop working the
// instant the profile is deactivated.
describe('editor deactivation', () => {
  let editor;
  let project;

  afterEach(async () => {
    if (project) await deleteTestProject(project.id);
    if (editor) await deleteTestProfile(editor.id);
    editor = null;
    project = null;
  });

  it('revokes all three editor write RPCs and editor_project_view read access immediately, without re-login', async () => {
    editor = await createTestProfile('editor');
    project = await createTestProject({ stage: 'video_editing' });
    await adminClient.from('project_editors').insert({ project_id: project.id, editor_id: editor.id });

    const { data: song } = await adminClient
      .from('songs')
      .insert({ project_id: project.id, title: 'Deactivation Test Song' })
      .select()
      .single();

    // --- baseline: everything works while active ---
    const statusBefore = await editor.client.rpc('update_editing_status', {
      p_project_id: project.id,
      p_substatus: 'in_progress',
    });
    expect(statusBefore.error).toBeNull();

    const licenseBefore = await editor.client.rpc('set_song_license', {
      p_song_id: song.id,
      p_license_confirmed: true,
    });
    expect(licenseBefore.error).toBeNull();

    const commentBefore = await editor.client.rpc('post_comment', {
      p_project_id: project.id,
      p_body: 'Editing started',
    });
    expect(commentBefore.error).toBeNull();

    const viewBefore = await editor.client.from('editor_project_view').select('*').eq('id', project.id);
    expect(viewBefore.error).toBeNull();
    expect(viewBefore.data).toHaveLength(1);

    // --- deactivate ---
    await adminClient.from('profiles').update({ active: false }).eq('id', editor.id);

    // Same client, same JWT, no re-login.
    const statusAfter = await editor.client.rpc('update_editing_status', {
      p_project_id: project.id,
      p_substatus: 'final',
    });
    expect(statusAfter.error).not.toBeNull();

    const licenseAfter = await editor.client.rpc('set_song_license', {
      p_song_id: song.id,
      p_license_confirmed: false,
    });
    expect(licenseAfter.error).not.toBeNull();

    const commentAfter = await editor.client.rpc('post_comment', {
      p_project_id: project.id,
      p_body: 'Should never be written',
    });
    expect(commentAfter.error).not.toBeNull();

    const viewAfter = await editor.client.from('editor_project_view').select('*').eq('id', project.id);
    expect(viewAfter.error ? [] : viewAfter.data).toHaveLength(0);

    // Nothing the deactivated editor attempted may have landed.
    const { data: proj } = await adminClient
      .from('projects')
      .select('video_editing_substatus')
      .eq('id', project.id)
      .single();
    expect(proj.video_editing_substatus).toBe('in_progress');

    const { data: songRow } = await adminClient
      .from('songs')
      .select('license_confirmed')
      .eq('id', song.id)
      .single();
    expect(songRow.license_confirmed).toBe(true);

    const { data: comments } = await adminClient
      .from('comments')
      .select('body')
      .eq('project_id', project.id);
    expect(comments.map(c => c.body)).not.toContain('Should never be written');
  });

  it('reactivating an editor restores RPC and view access without re-login', async () => {
    editor = await createTestProfile('editor');
    project = await createTestProject({ stage: 'video_editing' });
    await adminClient.from('project_editors').insert({ project_id: project.id, editor_id: editor.id });

    await adminClient.from('profiles').update({ active: false }).eq('id', editor.id);
    await adminClient.from('profiles').update({ active: true }).eq('id', editor.id);

    const { error } = await editor.client.rpc('update_editing_status', {
      p_project_id: project.id,
      p_substatus: 'in_progress',
    });
    expect(error).toBeNull();

    const { data } = await editor.client.from('editor_project_view').select('id').eq('id', project.id);
    expect(data).toHaveLength(1);
  });
});
