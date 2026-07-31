import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

// The Owner/PM board intentionally includes staff-assignment fields but keeps
// token-gated client portal fields out of the browser payload.
const boardJs = fs.readFileSync(path.resolve(__dirname, '../board.js'), 'utf8');
const boardHtml = fs.readFileSync(path.resolve(__dirname, '../index.html'), 'utf8');
const clientHtml = fs.readFileSync(path.resolve(__dirname, '../client.html'), 'utf8');
const clientJs = fs.readFileSync(path.resolve(__dirname, '../client.js'), 'utf8');
const editorJs = fs.readFileSync(path.resolve(__dirname, '../editor.js'), 'utf8');

function fetchProjectsSelectArg() {
  const match = boardJs.match(/async function fetchProjects\(\)[\s\S]*?\.select\((['`])([\s\S]*?)\1\)/);
  if (!match) throw new Error('Could not locate fetchProjects()\'s .select(...) call in board.js');
  return match[2];
}

describe('fetchProjects() select field list', () => {
  it('includes the PM assignment field used by the project modal', () => {
    expect(fetchProjectsSelectArg()).toMatch(/\bpm_id\b/);
  });

  it('does not include client portal fields from later phases', () => {
    expect(fetchProjectsSelectArg()).not.toMatch(/\bclient_access_token\b/);
  });

  it('still includes id and client_name (sanity check the regex found the real select call)', () => {
    const arg = fetchProjectsSelectArg();
    expect(arg).toMatch(/\bid\b/);
    expect(arg).toMatch(/\bclient_name\b/);
  });
});

describe('2b board views', () => {
  it('loads the List, Calendar, and Staff modules', () => {
    expect(boardHtml).toContain('src="list-view.js"');
    expect(boardHtml).toContain('src="calendar-view.js"');
    expect(boardHtml).toContain('src="staff.js"');
  });

  it('has containers for Kanban, List, Calendar, and Staff views', () => {
    expect(boardHtml).toContain('id="boardColumns"');
    expect(boardHtml).toContain('id="listViewContainer"');
    expect(boardHtml).toContain('id="calendarViewContainer"');
    expect(boardHtml).toContain('id="staffViewContainer"');
  });

  it('keeps Staff controls Owner-only', () => {
    expect(boardHtml).toContain('id="staffToggleBtn"');
    expect(boardHtml).toContain('owner-only');
  });

  it('includes the invite staff modal', () => {
    expect(boardHtml).toContain('id="inviteModalBackdrop"');
    expect(boardHtml).toContain('id="inviteForm"');
  });
});

describe('client token portal', () => {
  it('loads a dedicated client script without auth login controls', () => {
    expect(clientHtml).toContain('src="client.js"');
    expect(clientHtml).not.toContain('logoutBtn');
    expect(clientHtml).not.toContain('loginForm');
  });

  it('uses only token-gated client RPCs for project data and writes', () => {
    expect(clientJs).toContain('get_project_by_token');
    expect(clientJs).toContain('update_photo_selection');
    expect(clientJs).toContain('submit_song');
    expect(clientJs).toContain('post_client_comment');
    expect(clientJs).not.toMatch(/from\(['"`](projects|sub_events|songs|comments)['"`]\)/);
    expect(clientJs).not.toContain('auth.getSession');
    expect(clientJs).not.toContain('auth.signIn');
  });

  it('supports production client links with token query params', () => {
    expect(clientJs).toContain("searchParams.get('token')");
    expect(clientJs).toContain('getTokenFromLocation');
  });

  it('lets clients paste photo-number lists and stores them as client notes', () => {
    expect(clientJs).toContain('parsePhotoNumbers');
    expect(clientJs).toContain('client-photo-list-input');
    expect(clientJs).toContain('client-live-count');
    expect(clientJs).toContain('post_client_comment');
    expect(clientJs).toContain('Photo selections for');
  });

  it('captures song reference links for editors', () => {
    expect(clientHtml).toContain('song-url-input');
    expect(clientHtml.match(/class="client-song-slot"/g)).toHaveLength(5);
    expect(clientJs).toContain('YouTube:');
    expect(clientJs).toContain('getFilledSongSlots');
    expect(clientJs).toContain('song-reference-link');
    expect(editorJs).toContain('song-reference-link');
  });

  it('renders guided client workflow language', () => {
    expect(clientHtml).toContain('Choose Photos for Editing');
    expect(clientHtml).toContain('Song Suggestions');
    expect(clientHtml).toContain('Notes for the Studio');
    expect(clientJs).toContain('client-status-grid');
  });
});
