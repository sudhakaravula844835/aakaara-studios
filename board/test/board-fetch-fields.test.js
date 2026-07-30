import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

// board.js's fetchProjects() supplies the exact project objects that
// openDetailPanel() stores as currentDetailProject -- and Edit re-opens the
// project modal from that in-memory object, not a fresh fetch. Any field the
// assignment picker (or anything else in the modal) reads from `project`
// must round-trip through this select() call, or it silently falls back to
// its empty default on every re-open even though the DB value is correct.
//
// Regression coverage for a bug caught during Task 6 manual verification:
// pm_id was missing from this select, so the PM dropdown always showed
// "Unassigned" when re-opened via Detail Panel -> Edit, and an unnoticed
// Save would silently wipe a project's real PM assignment.
const boardJs = fs.readFileSync(path.resolve(__dirname, '../board.js'), 'utf8');

function fetchProjectsSelectArg() {
  const match = boardJs.match(/async function fetchProjects\(\)[\s\S]*?\.select\((['`])([\s\S]*?)\1\)/);
  if (!match) throw new Error('Could not locate fetchProjects()\'s .select(...) call in board.js');
  return match[2];
}

describe('fetchProjects() select field list', () => {
  it('includes pm_id, so currentDetailProject carries the real PM assignment into the Edit modal', () => {
    expect(fetchProjectsSelectArg()).toMatch(/\bpm_id\b/);
  });

  it('still includes id and client_name (sanity check the regex found the real select call)', () => {
    const arg = fetchProjectsSelectArg();
    expect(arg).toMatch(/\bid\b/);
    expect(arg).toMatch(/\bclient_name\b/);
  });
});
