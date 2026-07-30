import { supabase } from './supabase-client.js';
import {
  formatDate, deriveWeddingDate, stageLabel, SUBSTATUS_LABELS,
} from './board-utils.js';
import { showErrorToast } from './board-shared.js';

let currentProjects = [];
let currentDetailProject = null;
let renderGeneration = 0;
let realtimeChannel = null;

export function getCurrentDetailProjectId() {
  return currentDetailProject?.id ?? null;
}

async function fetchAssignedProjects() {
  const { data, error } = await supabase
    .from('editor_project_view')
    .select('*, sub_events(id, name, event_date, venue)');
  if (error) {
    showErrorToast('Could not load your projects.');
    // null (not []) signals "fetch failed" distinctly from "fetch succeeded
    // with zero rows" -- refreshProjects() below relies on this distinction
    // to avoid blanking the list on a transient network blip, same pattern
    // as board.js's fetchProjects().
    return null;
  }
  return data;
}

function renderProjectRow(project) {
  const row = document.createElement('tr');
  row.className = 'list-row';
  row.addEventListener('click', () => openProjectDetail(project));

  const nameCell = document.createElement('td');
  nameCell.textContent = project.client_name;
  row.appendChild(nameCell);

  const dateCell = document.createElement('td');
  dateCell.textContent = formatDate(deriveWeddingDate(project.sub_events));
  row.appendChild(dateCell);

  const stageCell = document.createElement('td');
  stageCell.textContent = stageLabel(project.stage);
  row.appendChild(stageCell);

  const substatusCell = document.createElement('td');
  substatusCell.textContent = (project.stage === 'video_editing' && project.video_editing_substatus)
    ? (SUBSTATUS_LABELS[project.video_editing_substatus] || project.video_editing_substatus)
    : '—';
  row.appendChild(substatusCell);

  return row;
}

function renderProjectList() {
  const container = document.getElementById('editorProjectListContainer');
  container.innerHTML = '';

  const table = document.createElement('table');
  table.className = 'list-table';

  const thead = document.createElement('thead');
  const headerRow = document.createElement('tr');
  ['Client Name', 'Date', 'Stage', 'Video Editing Status'].forEach(label => {
    const th = document.createElement('th');
    th.textContent = label;
    headerRow.appendChild(th);
  });
  thead.appendChild(headerRow);
  table.appendChild(thead);

  const tbody = document.createElement('tbody');
  if (currentProjects.length === 0) {
    const emptyRow = document.createElement('tr');
    const emptyCell = document.createElement('td');
    emptyCell.colSpan = 4;
    emptyCell.className = 'list-empty';
    emptyCell.textContent = 'No projects assigned yet.';
    emptyRow.appendChild(emptyCell);
    tbody.appendChild(emptyRow);
  } else {
    currentProjects.forEach(project => tbody.appendChild(renderProjectRow(project)));
  }
  table.appendChild(tbody);
  container.appendChild(table);
}

async function refreshProjects() {
  const myGeneration = ++renderGeneration;
  const projects = await fetchAssignedProjects();
  if (myGeneration !== renderGeneration) return; // a newer refresh started while we were fetching; abandon this stale one
  if (projects === null) return;
  currentProjects = projects;
  renderProjectList();
}

async function openProjectDetail(project) {
  currentDetailProject = project;
  document.getElementById('detailClientName').textContent = project.client_name;
  document.getElementById('detailBackdrop').classList.add('open');
}

function closeProjectDetail() {
  document.getElementById('detailBackdrop').classList.remove('open');
  currentDetailProject = null;
}

async function requireSession() {
  const { data } = await supabase.auth.getSession();
  if (!data.session) {
    window.location.href = 'login.html';
    return null;
  }
  return data.session.user;
}

async function init() {
  // Wire up header/detail-panel handlers before any network awaits below,
  // so "Log Out" and the detail panel's close controls are never
  // visible-but-inert (same reasoning as board.js's init()).
  document.getElementById('logoutBtn').addEventListener('click', async () => {
    if (realtimeChannel) supabase.removeChannel(realtimeChannel);
    await supabase.auth.signOut();
    window.location.href = 'login.html';
  });
  document.getElementById('detailClose').addEventListener('click', closeProjectDetail);
  document.getElementById('detailBackdrop').addEventListener('click', (e) => {
    if (e.target.id === 'detailBackdrop') closeProjectDetail();
  });

  const user = await requireSession();
  if (!user) return;

  const { data: profile, error } = await supabase
    .from('profiles')
    .select('active')
    .eq('id', user.id)
    .single();

  // Same reasoning as board.js's init(): a deactivated user whose session is
  // still valid would otherwise sit on an empty list indefinitely with every
  // RLS-gated read returning nothing and no explanation. Eject them to a
  // clean login screen.
  if (!error && profile && profile.active === false) {
    await supabase.auth.signOut();
    window.location.href = 'login.html';
    return;
  }

  await refreshProjects();
}

document.addEventListener('DOMContentLoaded', init);
