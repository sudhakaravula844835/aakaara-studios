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

async function renderSubEventsTimeline() {
  // Capture the project this call is rendering for *before* the await --
  // currentDetailProject may be reassigned (panel closed -> null, or
  // switched to another project) while the fetch below is in flight. Same
  // guard pattern as project-modal.js's renderSubEventsTimeline.
  const requestedProject = currentDetailProject;
  if (!requestedProject) return;
  const { data: subEvents, error } = await supabase
    .from('sub_events')
    .select('*')
    .eq('project_id', requestedProject.id)
    .order('event_date', { ascending: true, nullsFirst: false });

  if (!currentDetailProject || currentDetailProject.id !== requestedProject.id) return;

  const container = document.getElementById('subEventsTimeline');
  container.innerHTML = '';

  if (error) {
    showErrorToast('Could not load sub-events.');
    return;
  }

  if (subEvents.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'timeline-empty';
    empty.textContent = 'No sub-events yet.';
    container.appendChild(empty);
    return;
  }

  subEvents.forEach(se => {
    const item = document.createElement('div');
    item.className = 'timeline-item';

    const dot = document.createElement('div');
    dot.className = 'timeline-dot timeline-dot-' + se.photo_selection_status;
    item.appendChild(dot);

    const content = document.createElement('div');
    content.className = 'timeline-content';

    const name = document.createElement('div');
    name.className = 'timeline-name';
    name.textContent = se.name;
    content.appendChild(name);

    const meta = document.createElement('div');
    meta.className = 'timeline-meta';
    meta.textContent = [formatDate(se.event_date), se.venue].filter(Boolean).join(' · ');
    content.appendChild(meta);

    item.appendChild(content);
    container.appendChild(item);
  });
}

function renderSubstatusControl() {
  const select = document.getElementById('substatusSelect');
  const note = document.getElementById('substatusNote');
  select.innerHTML = '';

  Object.entries(SUBSTATUS_LABELS).forEach(([value, label]) => {
    const option = document.createElement('option');
    option.value = value;
    option.textContent = label;
    if (value === currentDetailProject.video_editing_substatus) option.selected = true;
    select.appendChild(option);
  });

  const isEditable = currentDetailProject.stage === 'video_editing';
  select.disabled = !isEditable;
  note.textContent = isEditable ? '' : 'Available once this project reaches Video Editing.';
}

// Re-fetches the open detail panel's project row and re-renders the
// substatus control against the fresh data -- used after a failed substatus
// update, since the failure is most likely a stage-race (a PM moved the
// project out of video_editing between page-load and this click) and the
// locally-cached currentDetailProject.stage is now stale.
async function resyncCurrentDetailProject() {
  if (!currentDetailProject) return;
  const requestedId = currentDetailProject.id;
  const { data, error } = await supabase
    .from('editor_project_view')
    .select('*')
    .eq('id', requestedId)
    .single();
  if (!error && data && currentDetailProject && currentDetailProject.id === requestedId) {
    currentDetailProject = { ...currentDetailProject, ...data };
    renderSubstatusControl();
  }
  await refreshProjects();
}

async function handleSubstatusChange() {
  const select = document.getElementById('substatusSelect');
  const newSubstatus = select.value;
  select.disabled = true;
  const { error } = await supabase.rpc('update_editing_status', {
    p_project_id: currentDetailProject.id,
    p_substatus: newSubstatus,
  });
  if (error) {
    showErrorToast('Could not update status — please try again.');
    await resyncCurrentDetailProject();
    return;
  }
  currentDetailProject = { ...currentDetailProject, video_editing_substatus: newSubstatus };
  renderSubstatusControl();
  await refreshProjects();
}

async function openProjectDetail(project) {
  currentDetailProject = project;
  document.getElementById('detailClientName').textContent = project.client_name;
  document.getElementById('detailBackdrop').classList.add('open');
  renderSubstatusControl();
  await renderSubEventsTimeline();
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
  document.getElementById('substatusSelect').addEventListener('change', handleSubstatusChange);

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
