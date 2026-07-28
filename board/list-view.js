import { supabase } from './supabase-client.js';
import {
  STAGE_COLUMNS, SUBSTATUS_LABELS, formatDate, deriveWeddingDate, compareProjectsByField, progressSegments,
} from './board-utils.js';
import { showErrorToast } from './board-shared.js';
// Circular import: board.js imports renderListView from this module, and
// this module imports openDetailPanel from project-modal.js and
// refreshProjects from board.js — same board.js <-> project-modal.js cycle
// documented in project-modal.js's own import comment, now with this file
// as a third participant. Safe here because openDetailPanel is only invoked
// from inside a row click handler (never at module-eval time), and
// refreshProjects is a hoisted function declaration only invoked from
// inside the stage <select>'s change handler below. A future top-level call
// to either in this file (e.g. outside an event handler) would be a real
// hazard — a TDZ error at page load — so watch for that.
import { openDetailPanel } from './project-modal.js';
import { refreshProjects } from './board.js';

let sortState = { column: null, direction: 1 };

export function renderListView(projects) {
  const container = document.getElementById('listViewContainer');
  container.innerHTML = '';

  const columns = [
    { key: 'client_name', label: 'Client Name' },
    { key: 'date', label: 'Date' },
    { key: 'package_tier', label: 'Package Tier' },
    { key: 'stage', label: 'Stage' },
    { key: 'progress', label: 'Progress' },
  ];

  const table = document.createElement('table');
  table.className = 'list-table';

  const thead = document.createElement('thead');
  const headerRow = document.createElement('tr');
  columns.forEach(col => {
    const th = document.createElement('th');
    const isActive = sortState.column === col.key;
    th.textContent = isActive ? `${col.label} ${sortState.direction === 1 ? '▲' : '▼'}` : col.label;
    th.setAttribute('aria-sort', isActive ? (sortState.direction === 1 ? 'ascending' : 'descending') : 'none');
    if (isActive) th.classList.add('list-table-th-active');
    th.addEventListener('click', () => {
      if (sortState.column === col.key) {
        sortState = { column: col.key, direction: sortState.direction * -1 };
      } else {
        sortState = { column: col.key, direction: 1 };
      }
      renderListView(projects);
    });
    headerRow.appendChild(th);
  });
  thead.appendChild(headerRow);
  table.appendChild(thead);

  const tbody = document.createElement('tbody');
  const sorted = sortState.column
    ? [...projects].sort((a, b) => sortState.direction * compareProjectsByField(a, b, sortState.column))
    : projects;

  if (sorted.length === 0) {
    const emptyRow = document.createElement('tr');
    const emptyCell = document.createElement('td');
    emptyCell.colSpan = columns.length;
    emptyCell.className = 'list-empty';
    emptyCell.textContent = 'No projects yet.';
    emptyRow.appendChild(emptyCell);
    tbody.appendChild(emptyRow);
  } else {
    sorted.forEach(project => tbody.appendChild(renderListRow(project)));
  }
  table.appendChild(tbody);
  container.appendChild(table);
}

function renderListRow(project) {
  const row = document.createElement('tr');
  row.className = 'list-row';
  row.addEventListener('click', () => openDetailPanel(project));

  const nameCell = document.createElement('td');
  nameCell.textContent = project.client_name;
  row.appendChild(nameCell);

  const dateCell = document.createElement('td');
  dateCell.textContent = formatDate(deriveWeddingDate(project.sub_events));
  row.appendChild(dateCell);

  const tierCell = document.createElement('td');
  tierCell.textContent = project.package_tier || '—';
  row.appendChild(tierCell);

  const stageCell = document.createElement('td');
  const select = document.createElement('select');
  select.className = 'list-stage-select';
  STAGE_COLUMNS.forEach(col => {
    const option = document.createElement('option');
    option.value = col.key;
    option.textContent = col.label;
    if (col.key === project.stage) option.selected = true;
    select.appendChild(option);
  });
  // Stop the click from bubbling to the row (which would open the detail
  // panel) — this covers both opening the native dropdown and selecting an
  // option, since both originate as a click on the select element itself.
  select.addEventListener('click', (e) => e.stopPropagation());
  select.addEventListener('change', async () => {
    const newStage = select.value;
    const previousStage = project.stage;
    select.disabled = true;
    const { error } = await supabase.from('projects').update({ stage: newStage }).eq('id', project.id);
    select.disabled = false;
    if (error) {
      select.value = previousStage;
      showErrorToast('Could not update stage — please try again.');
      return;
    }
    // Don't rely solely on the realtime redraw — if realtime is ever
    // silently down, a user changing the stage here should still see List
    // (and Kanban) agree with what was just written to the DB. Same pattern
    // as project-modal.js's handleProjectFormSubmit and board.js's
    // handleDrop 3-second safety net.
    await refreshProjects();
  });
  stageCell.appendChild(select);

  if (project.stage === 'video_editing' && project.video_editing_substatus) {
    const sub = document.createElement('span');
    sub.className = 'list-stage-substatus';
    sub.textContent = SUBSTATUS_LABELS[project.video_editing_substatus] || project.video_editing_substatus;
    stageCell.appendChild(sub);
  }

  row.appendChild(stageCell);

  const progressCell = document.createElement('td');
  const progress = progressSegments(project.stage);
  const bar = document.createElement('div');
  bar.className = 'card-progress list-progress';
  for (let i = 0; i < progress.total; i++) {
    const seg = document.createElement('span');
    seg.className = 'card-progress-segment' + (i < progress.filled ? ' filled' : '');
    bar.appendChild(seg);
  }
  progressCell.appendChild(bar);
  row.appendChild(progressCell);

  return row;
}
