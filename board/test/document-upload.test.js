import { describe, it, expect, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import { randomUUID } from 'node:crypto';
import {
  createTestProfile, deleteTestProfile,
  deleteTestProject, adminClient,
} from './helpers.js';

// Bug: uploadProjectDocument() in project-modal.js uploaded the file to
// Storage, then ran `supabase.from('projects').update({...}).eq('id',
// projectId)` with no `.select()` and no check on rows affected. PostgREST
// does not treat "0 rows matched" as an error, so any wrong-but-valid-format
// projectId (a stale detail-panel snapshot for a project deleted in another
// tab, or any future bug that miscomputes the id) silently reported success
// while writing nothing -- the file lands in Storage but
// contract_uploaded_at/quote_uploaded_at never gets stamped, so the modal
// keeps showing "Not uploaded" forever with no error toast.
const modalJs = fs.readFileSync(path.resolve(__dirname, '../project-modal.js'), 'utf8');

function uploadProjectDocumentSource() {
  const match = modalJs.match(/async function uploadProjectDocument\([\s\S]*?\n}/);
  if (!match) throw new Error('Could not locate uploadProjectDocument() in project-modal.js');
  return match[0];
}

function handleProjectFormSubmitSource() {
  const match = modalJs.match(/async function handleProjectFormSubmit\(e\)[\s\S]*?\n}/);
  if (!match) throw new Error('Could not locate handleProjectFormSubmit() in project-modal.js');
  return match[0];
}

describe('uploadProjectDocument no-op safety (regression)', () => {
  it('chains .select() onto the projects update so a 0-row match is visible', () => {
    expect(uploadProjectDocumentSource()).toMatch(/\.update\(\{\s*\[column\]:\s*uploadedAt\s*\}\)[\s\S]*?\.eq\('id',\s*projectId\)[\s\S]*?\.select\(/);
  });

  it('treats an empty update result as an error instead of a success', () => {
    const src = uploadProjectDocumentSource();
    expect(src).toMatch(/\.length === 0/);
    expect(src).toContain('error:');
  });

  it('handleProjectFormSubmit does not attempt a document upload when projectId is falsy', () => {
    expect(handleProjectFormSubmitSource()).toMatch(/!projectId/);
  });
});

describe('document upload persistence (DB-level, real Supabase)', () => {
  let profile;
  let project;

  afterEach(async () => {
    if (project) await deleteTestProject(project.id);
    if (profile) await deleteTestProfile(profile.id);
    project = null;
    profile = null;
  });

  it('a contract_uploaded_at stamp written right after project creation persists and is re-readable', async () => {
    profile = await createTestProfile('pm');

    const insertResult = await profile.client
      .from('projects')
      .insert({ client_name: 'Doc Upload Test Client' })
      .select()
      .single();
    expect(insertResult.error).toBeNull();
    project = insertResult.data;
    expect(project.id).toBeTruthy();

    const uploadedAt = new Date().toISOString();
    const { data: updateData, error: updateError } = await profile.client
      .from('projects')
      .update({ contract_uploaded_at: uploadedAt })
      .eq('id', project.id)
      .select('id');
    expect(updateError).toBeNull();
    expect(updateData).toHaveLength(1);

    // Re-read as a fresh, independent client -- mirrors "returning to the
    // project later" from the bug report, not just trusting the write's own
    // response. Compare as Date values, not raw strings -- Postgres round-trips
    // timestamptz as "...+00:00" rather than the "...Z" JS produced it with.
    const { data: reread, error: rereadError } = await adminClient
      .from('projects')
      .select('contract_uploaded_at')
      .eq('id', project.id)
      .single();
    expect(rereadError).toBeNull();
    expect(new Date(reread.contract_uploaded_at).getTime()).toBe(new Date(uploadedAt).getTime());
  });

  it('pins the silent-failure shape: an update against a non-matching id returns zero rows with no error', async () => {
    profile = await createTestProfile('pm');
    const bogusId = randomUUID(); // well-formed UUID, no matching project row

    const { data, error } = await profile.client
      .from('projects')
      .update({ contract_uploaded_at: new Date().toISOString() })
      .eq('id', bogusId)
      .select('id');

    // This is exactly the response shape the old code silently treated as
    // success. If Supabase/PostgREST ever changes this behavior, this test
    // should be the first thing to fail.
    expect(error).toBeNull();
    expect(data).toEqual([]);
  });
});
