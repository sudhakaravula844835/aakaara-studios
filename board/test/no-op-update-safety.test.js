import { describe, it, expect, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import {
  createTestProfile, deleteTestProfile,
  createTestProject, deleteTestProject,
  adminClient,
} from './helpers.js';

// Companion to document-upload.test.js's uploadProjectDocument fix (9cf35ad).
// The same anti-pattern -- `supabase.from(...).update(...).eq('id', X)` with
// no `.select()` and no check on rows affected -- was still live in five
// more places. PostgREST does not treat "0 rows matched" as an error, so
// each of these reported success on a 0-row update:
//   - staff.js: role-change dropdown, activate/deactivate toggle
//   - board.js: Kanban drag-and-drop stage change (handleDrop)
//   - list-view.js: List view stage dropdown
//   - project-modal.js: the main project Edit save (handleProjectFormSubmit),
//     and the sub-event Edit save (handleSubEventFormSubmit) -- both missed
//     by 9cf35ad, which only fixed the document-upload update in the same
//     file.
//
// The concretely reproducible trigger for all of these (confirmed
// empirically below, not just hypothesized): current_profile_role() returns
// null once a caller's own profile goes active=false (see
// 20260729012603_staff_deactivation.sql), so if the acting Owner/PM is
// deactivated in another tab between page load and the click, every RLS
// policy keyed on current_profile_role() silently excludes their update --
// PostgREST returns 0 rows with no error. A deleted-row race (project or
// sub-event removed between page load and Save) produces the identical
// shape.

function readSource(file) {
  return fs.readFileSync(path.resolve(__dirname, '..', file), 'utf8');
}

function fnSource(source, signature) {
  const match = source.match(signature);
  if (!match) throw new Error(`Could not locate ${signature} in source`);
  return match[0];
}

describe('no-op update safety (regression, source-level)', () => {
  it('staff.js role-change handler chains .select() and checks for an empty result', () => {
    const src = fnSource(readSource('staff.js'), /select\.addEventListener\('change', async \(\) => \{[\s\S]*?\n {4}\}\);/);
    expect(src).toMatch(/\.update\(\{ role: newRole \}\)[\s\S]*?\.select\('id'\)/);
    expect(src).toMatch(/data\.length === 0/);
  });

  it('staff.js activate/deactivate toggle handler chains .select() and checks for an empty result', () => {
    const src = fnSource(readSource('staff.js'), /toggleBtn\.addEventListener\('click', async \(\) => \{[\s\S]*?\n {4}\}\);/);
    expect(src).toMatch(/\.update\(\{ active: !staff\.active \}\)[\s\S]*?\.select\('id'\)/);
    expect(src).toMatch(/data\.length === 0/);
  });

  it('board.js handleDrop chains .select() and checks for an empty result', () => {
    const src = fnSource(readSource('board.js'), /async function handleDrop\(e, newStage\) \{[\s\S]*?\n}/);
    expect(src).toMatch(/\.update\(\{ stage: newStage \}\)[\s\S]*?\.select\('id'\)/);
    expect(src).toMatch(/data\.length === 0/);
  });

  it('list-view.js stage dropdown handler chains .select() and checks for an empty result', () => {
    const src = fnSource(readSource('list-view.js'), /select\.addEventListener\('change', async \(\) => \{[\s\S]*?\n {2}\}\);/);
    expect(src).toMatch(/\.update\(\{ stage: newStage \}\)[\s\S]*?\.select\('id'\)/);
    expect(src).toMatch(/data\.length === 0/);
  });

  it('project-modal.js handleProjectFormSubmit\'s edit-path project update chains .select() and checks for an empty result', () => {
    const src = fnSource(readSource('project-modal.js'), /async function handleProjectFormSubmit\(e\)[\s\S]*?\n}/);
    expect(src).toMatch(/\.update\(fields\)\.eq\('id', editId\)\.select\('id'\)/);
    expect(src).toMatch(/updateData\.length === 0/);
  });

  it('project-modal.js handleSubEventFormSubmit\'s edit-path sub-event update chains .select() and checks for an empty result', () => {
    const src = fnSource(readSource('project-modal.js'), /async function handleSubEventFormSubmit\(e\)[\s\S]*?\n}/);
    expect(src).toMatch(/\.update\(fields\)\.eq\('id', editId\)\.select\('id'\)/);
    expect(src).toMatch(/data\.length === 0/);
  });
});

describe('no-op update safety (DB-level, real Supabase): deactivation mid-session race', () => {
  let pm;
  let owner;
  let editor;
  let project;

  afterEach(async () => {
    if (project) await deleteTestProject(project.id);
    if (pm) await deleteTestProfile(pm.id);
    if (owner) await deleteTestProfile(owner.id);
    if (editor) await deleteTestProfile(editor.id);
    pm = null; owner = null; editor = null; project = null;
  });

  it('pins the silent-failure shape for board.js/list-view.js: a PM deactivated mid-session gets 0 rows/no error on a stage update, and the project is genuinely untouched', async () => {
    pm = await createTestProfile('pm');
    project = await createTestProject({ stage: 'booked' });

    // Simulate "deactivated in another tab" -- pm.client's session is still
    // live, nothing forces it to re-authenticate.
    await adminClient.from('profiles').update({ active: false }).eq('id', pm.id);

    const { data, error } = await pm.client
      .from('projects')
      .update({ stage: 'shoot_completed' })
      .eq('id', project.id)
      .select('id');

    expect(error).toBeNull();
    expect(data).toEqual([]);

    const { data: reread } = await adminClient.from('projects').select('stage').eq('id', project.id).single();
    expect(reread.stage).toBe('booked');
  });

  it('pins the silent-failure shape for staff.js: an Owner deactivated mid-session gets 0 rows/no error trying to deactivate someone else, who stays active', async () => {
    owner = await createTestProfile('owner');
    editor = await createTestProfile('editor');

    await adminClient.from('profiles').update({ active: false }).eq('id', owner.id);

    const { data, error } = await owner.client
      .from('profiles')
      .update({ active: false })
      .eq('id', editor.id)
      .select('id');

    expect(error).toBeNull();
    expect(data).toEqual([]);

    const { data: reread } = await adminClient.from('profiles').select('active').eq('id', editor.id).single();
    expect(reread.active).toBe(true);
  });

  it('pins the silent-failure shape for staff.js role-change: a deactivated Owner cannot silently promote/demote another user', async () => {
    owner = await createTestProfile('owner');
    editor = await createTestProfile('editor');

    await adminClient.from('profiles').update({ active: false }).eq('id', owner.id);

    const { data, error } = await owner.client
      .from('profiles')
      .update({ role: 'pm' })
      .eq('id', editor.id)
      .select('id');

    expect(error).toBeNull();
    expect(data).toEqual([]);

    const { data: reread } = await adminClient.from('profiles').select('role').eq('id', editor.id).single();
    expect(reread.role).toBe('editor');
  });

  it('sanity check: the same stage update succeeds normally for a still-active PM (confirms the race above is really about deactivation, not something else)', async () => {
    pm = await createTestProfile('pm');
    project = await createTestProject({ stage: 'booked' });

    const { data, error } = await pm.client
      .from('projects')
      .update({ stage: 'shoot_completed' })
      .eq('id', project.id)
      .select('id');

    expect(error).toBeNull();
    expect(data).toHaveLength(1);

    const { data: reread } = await adminClient.from('projects').select('stage').eq('id', project.id).single();
    expect(reread.stage).toBe('shoot_completed');
  });
});

describe('no-op update safety (DB-level, real Supabase): project-modal.js edit-save paths', () => {
  let pm;
  let project;

  afterEach(async () => {
    if (project) await deleteTestProject(project.id);
    if (pm) await deleteTestProfile(pm.id);
    pm = null; project = null;
  });

  it('pins the silent-failure shape for the main project Edit save: a project deleted between page load and Save gets 0 rows/no error', async () => {
    pm = await createTestProfile('pm');
    const doomed = await createTestProject({ client_name: 'Deleted Mid-Edit' });

    // Simulate "deleted in another tab while this PM had Edit open".
    await deleteTestProject(doomed.id);

    const { data, error } = await pm.client
      .from('projects')
      .update({ client_name: 'Edited Name' })
      .eq('id', doomed.id)
      .select('id');

    expect(error).toBeNull();
    expect(data).toEqual([]);
  });

  it('pins the silent-failure shape for the sub-event Edit save: a sub-event deleted between page load and Save gets 0 rows/no error', async () => {
    pm = await createTestProfile('pm');
    project = await createTestProject();
    const { data: subEvent } = await adminClient
      .from('sub_events')
      .insert({ project_id: project.id, name: 'Sangeet' })
      .select()
      .single();

    await adminClient.from('sub_events').delete().eq('id', subEvent.id);

    const { data, error } = await pm.client
      .from('sub_events')
      .update({ name: 'Renamed Sangeet' })
      .eq('id', subEvent.id)
      .select('id');

    expect(error).toBeNull();
    expect(data).toEqual([]);
  });

  it('sanity check: both edit-save updates succeed normally against a live row', async () => {
    pm = await createTestProfile('pm');
    project = await createTestProject({ client_name: 'Original Name' });
    const { data: subEvent } = await adminClient
      .from('sub_events')
      .insert({ project_id: project.id, name: 'Sangeet' })
      .select()
      .single();

    const projectUpdate = await pm.client
      .from('projects').update({ client_name: 'Updated Name' }).eq('id', project.id).select('id');
    expect(projectUpdate.error).toBeNull();
    expect(projectUpdate.data).toHaveLength(1);

    const subEventUpdate = await pm.client
      .from('sub_events').update({ name: 'Renamed Sangeet' }).eq('id', subEvent.id).select('id');
    expect(subEventUpdate.error).toBeNull();
    expect(subEventUpdate.data).toHaveLength(1);
  });
});
