import { describe, it, expect, afterEach } from 'vitest';
import {
  createTestProfile, deleteTestProfile,
  createTestProject, deleteTestProject,
  adminClient,
} from './helpers.js';

const FINANCIAL_FIELDS = [
  'quoted_price', 'confirmed_price', 'deposit_paid', 'balance_paid',
  'contract_url', 'quote_pdf_url', 'client_access_token',
];

describe('owner/pm access', () => {
  let profile;
  let project;
  let editor;

  afterEach(async () => {
    if (project) await deleteTestProject(project.id);
    if (profile) await deleteTestProfile(profile.id);
    if (editor) await deleteTestProfile(editor.id);
    project = null;
    profile = null;
    editor = null;
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

  // Fix 1 regression guard: activity_log must never let an assigned editor
  // see financial-field or credential-field changes, even though the
  // editor/project_editors join otherwise scopes them to "their" project.
  it('assigned editor sees zero activity_log rows for financial field changes', async () => {
    profile = await createTestProfile('pm');
    editor = await createTestProfile('editor');
    project = await createTestProject();
    await adminClient.from('project_editors').insert({ project_id: project.id, editor_id: editor.id });

    const { error } = await profile.client
      .from('projects')
      .update({ confirmed_price: 8000, contract_url: 'https://example.com/contract.pdf' })
      .eq('id', project.id);
    expect(error).toBeNull();

    // Sanity check: the writes really did happen and got logged somewhere
    // (as pm, who can see everything) before asserting the editor can't.
    const { data: pmView } = await adminClient
      .from('activity_log')
      .select('field_changed')
      .eq('project_id', project.id)
      .in('field_changed', ['confirmed_price', 'contract_url']);
    expect(pmView).toHaveLength(2);

    const { data: editorView, error: editorError } = await editor.client
      .from('activity_log')
      .select('field_changed')
      .eq('project_id', project.id)
      .in('field_changed', FINANCIAL_FIELDS);
    expect(editorError).toBeNull();
    expect(editorView).toHaveLength(0);
  });

  // Fix 6: a PM has full owner_pm write access to `projects` etc, but no
  // policy at all grants them UPDATE on `profiles` -- confirm they can't
  // use that to self-promote (or demote anyone else).
  it('pm cannot change a profiles.role value, including their own', async () => {
    profile = await createTestProfile('pm');

    const { data, error } = await profile.client
      .from('profiles')
      .update({ role: 'owner' })
      .eq('id', profile.id)
      .select();
    expect(data ?? []).toHaveLength(0);

    const { data: unchanged } = await adminClient.from('profiles').select('role').eq('id', profile.id).single();
    expect(unchanged.role).toBe('pm');
  });
});
