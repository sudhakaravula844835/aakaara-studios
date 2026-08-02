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

  it('includes the RAW delivery fields editable in the project modal', () => {
    expect(fetchProjectsSelectArg()).toMatch(/\braw_delivered_at\b/);
    expect(fetchProjectsSelectArg()).toMatch(/\braw_delivery_link\b/);
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

  it('renders a project tracker and next-step guidance for clients', () => {
    expect(clientJs).toContain('renderNextStepBanner');
    expect(clientJs).toContain('renderProjectTracker');
    expect(clientJs).toContain('client-next-step');
    expect(clientJs).toContain('client-project-tracker');
    expect(clientJs).toContain('Select photos for editing.');
    expect(clientJs).toContain('Suggest songs before video editing.');
    expect(clientJs).toContain('Studio is editing your film.');
  });
});

describe('Owner/PM project tracker section', () => {
  it('adds a hidden-by-default tracker section to the project modal', () => {
    expect(boardHtml).toContain('id="projectTrackerSection"');
    const match = boardHtml.match(/<div class="modal-section" id="projectTrackerSection"[^>]*>/);
    expect(match).not.toBeNull();
    expect(match[0]).toContain('hidden');
  });

  it('places an empty tracker container inside the section', () => {
    const sectionMatch = boardHtml.match(/id="projectTrackerSection"[\s\S]*?<\/div>\s*<\/div>/);
    expect(sectionMatch).not.toBeNull();
    expect(sectionMatch[0]).toContain('id="projectTracker"');
  });
});

describe('Copy Client Link button', () => {
  it('adds a Copy Client Link button to the detail panel header actions', () => {
    expect(boardHtml).toContain('id="detailCopyLinkBtn"');
  });

  it('places it inside .detail-header-actions, alongside Edit and Close', () => {
    const match = boardHtml.match(/<div class="detail-header-actions">([\s\S]*?)<\/div>/);
    expect(match).not.toBeNull();
    expect(match[1]).toContain('id="detailCopyLinkBtn"');
    expect(match[1]).toContain('id="detailEditBtn"');
    expect(match[1]).toContain('id="detailClose"');
  });
});

describe('Copy Client Link wiring', () => {
  const modalJs = fs.readFileSync(path.resolve(__dirname, '../project-modal.js'), 'utf8');

  it('still keeps client_access_token out of the bulk fetchProjects() select (regression guard)', () => {
    expect(fetchProjectsSelectArg()).not.toMatch(/\bclient_access_token\b/);
  });

  it('wires a click listener on detailCopyLinkBtn', () => {
    expect(modalJs).toMatch(/detailCopyLinkBtn['"]\)\.addEventListener\(\s*['"]click['"]/);
  });

  it('fetches client_access_token by id rather than through fetchProjects()', () => {
    expect(modalJs).toMatch(/\.select\(['"]client_access_token['"]\)/);
  });

  it('builds a client.html?token= URL and copies it to the clipboard', () => {
    expect(modalJs).toContain('board/client.html?token=');
    expect(modalJs).toContain('navigator.clipboard.writeText');
  });
});

describe('Owner/PM project tracker rendering', () => {
  const modalJs = fs.readFileSync(path.resolve(__dirname, '../project-modal.js'), 'utf8');

  it('imports the stage utilities needed to render the tracker', () => {
    expect(modalJs).toMatch(/STAGE_COLUMNS/);
    expect(modalJs).toMatch(/stageIndex/);
    expect(modalJs).toMatch(/SUBSTATUS_LABELS/);
  });

  it('defines a renderProjectTracker function', () => {
    expect(modalJs).toMatch(/function renderProjectTracker\(/);
  });

  it('uses plain operational status labels, not narrative copy', () => {
    expect(modalJs).toContain("'Done'");
    expect(modalJs).toContain("'Not started'");
    expect(modalJs).toContain('In Progress');
  });

  it('toggles the tracker section based on whether a project was passed to openProjectModal', () => {
    const openFnMatch = modalJs.match(/export async function openProjectModal\(project\)[\s\S]*?\n}/);
    expect(openFnMatch).not.toBeNull();
    expect(openFnMatch[0]).toMatch(/projectTrackerSection['"]\)\.hidden\s*=\s*!project/);
  });
});

describe('RAW delivery fields in the project modal', () => {
  const modalJs = fs.readFileSync(path.resolve(__dirname, '../project-modal.js'), 'utf8');

  it('adds date and URL inputs for RAW delivery to the modal markup', () => {
    expect(boardHtml).toContain('id="fRawDeliveredAt"');
    expect(boardHtml).toContain('id="fRawDeliveryLink"');
  });

  it('populates both fields when opening an existing project for edit', () => {
    expect(modalJs).toMatch(/fRawDeliveredAt['"]\)\.value\s*=\s*project \? \(project\.raw_delivered_at/);
    expect(modalJs).toMatch(/fRawDeliveryLink['"]\)\.value\s*=\s*project \? \(project\.raw_delivery_link/);
  });

  it('saves both fields back to raw_delivered_at and raw_delivery_link on submit', () => {
    expect(modalJs).toMatch(/raw_delivered_at:\s*document\.getElementById\('fRawDeliveredAt'\)/);
    expect(modalJs).toMatch(/raw_delivery_link:\s*document\.getElementById\('fRawDeliveryLink'\)/);
  });
});

describe('Expected delivery date', () => {
  const modalJs = fs.readFileSync(path.resolve(__dirname, '../project-modal.js'), 'utf8');

  it('adds an editable field in the project modal, populated and saved like the other date fields', () => {
    expect(boardHtml).toContain('id="fExpectedDeliveryDate"');
    expect(modalJs).toMatch(/fExpectedDeliveryDate['"]\)\.value\s*=\s*project \? \(project\.expected_delivery_date/);
    expect(modalJs).toMatch(/expected_delivery_date:\s*document\.getElementById\('fExpectedDeliveryDate'\)/);
  });

  it('is included in fetchProjects() so the modal can populate it on edit', () => {
    expect(fetchProjectsSelectArg()).toMatch(/\bexpected_delivery_date\b/);
  });

  it('is mentioned in the client-facing Next Step banner and tracker for the final_delivery stage', () => {
    expect(clientJs).toContain('Expected by ${formatDate(project.expected_delivery_date)}');
    expect(clientJs).toMatch(/stageKey === 'final_delivery' && project\.expected_delivery_date/);
  });
});

describe('Dashboard counters', () => {
  it('renders a counters container in the board header', () => {
    expect(boardHtml).toContain('id="boardCounters"');
  });

  it('defines the four counters with the agreed stage groupings', () => {
    expect(boardJs).toMatch(/function renderCounters\(/);
    expect(boardJs).toContain("p.stage !== 'completed'");
    expect(boardJs).toMatch(/WAITING_ON_CLIENT_STAGES\s*=\s*\['raw_delivered', 'photo_selection', 'song_finalization'\]/);
    expect(boardJs).toContain("p.stage === 'video_editing'");
    expect(boardJs).toContain("p.stage === 'final_delivery'");
  });

  it('refreshes counters every time projects are refetched', () => {
    const refreshFnMatch = boardJs.match(/export async function refreshProjects\(\)[\s\S]*?\n}/);
    expect(refreshFnMatch).not.toBeNull();
    expect(refreshFnMatch[0]).toContain('renderCounters(currentProjects)');
  });
});

describe('Sub-event crew field', () => {
  const modalJs = fs.readFileSync(path.resolve(__dirname, '../project-modal.js'), 'utf8');

  it('adds an editable crew field to the sub-event modal', () => {
    expect(boardHtml).toContain('id="seCrew"');
  });

  it('populates and saves the crew field like the other sub-event fields', () => {
    expect(modalJs).toMatch(/seCrew['"]\)\.value\s*=\s*subEvent \? \(subEvent\.crew/);
    expect(modalJs).toMatch(/crew:\s*document\.getElementById\('seCrew'\)/);
  });

  it('shows crew in the detail panel timeline when set', () => {
    expect(modalJs).toContain('if (se.crew)');
    expect(modalJs).toContain('Crew: ${se.crew}');
  });
});

describe('Financial summary', () => {
  it('renders summary and outstanding-balance containers in the board header', () => {
    expect(boardHtml).toContain('id="financeSummary"');
    expect(boardHtml).toContain('id="financeOutstanding"');
  });

  it('computes total quoted, total confirmed, and outstanding balance from already-fetched projects', () => {
    expect(boardJs).toMatch(/function renderFinancialSummary\(/);
    expect(boardJs).toContain('p.quoted_price');
    expect(boardJs).toContain('p.confirmed_price');
    expect(boardJs).toMatch(/p\.confirmed_price && !p\.balance_paid/);
  });

  it('subtracts the deposit already paid from confirmed_price, rather than treating the full price as owed', () => {
    expect(boardJs).toMatch(/amountOwed\s*=\s*\(p\)\s*=>\s*p\.confirmed_price\s*-\s*\(p\.deposit_amount \|\| 0\)/);
  });

  it('lists unpaid balances by client name, not just the total', () => {
    expect(boardJs).toMatch(/unpaidBalances[\s\S]*?client_name/);
  });

  it('refreshes the financial summary every time projects are refetched', () => {
    const refreshFnMatch = boardJs.match(/export async function refreshProjects\(\)[\s\S]*?\n}/);
    expect(refreshFnMatch).not.toBeNull();
    expect(refreshFnMatch[0]).toContain('renderFinancialSummary(currentProjects)');
  });
});

describe('Deposit amount field', () => {
  const modalJs = fs.readFileSync(path.resolve(__dirname, '../project-modal.js'), 'utf8');

  it('replaced the Deposit Paid checkbox with a Deposit Amount ($) number field', () => {
    expect(boardHtml).toContain('id="fDepositAmount"');
    expect(boardHtml).not.toContain('id="fDepositPaid"');
  });

  it('is selected in fetchProjects(), populated on edit, and saved on submit', () => {
    expect(fetchProjectsSelectArg()).toMatch(/\bdeposit_amount\b/);
    expect(modalJs).toMatch(/fDepositAmount['"]\)\.value\s*=\s*project \? \(project\.deposit_amount/);
    expect(modalJs).toMatch(/deposit_amount:\s*document\.getElementById\('fDepositAmount'\)/);
  });
});
