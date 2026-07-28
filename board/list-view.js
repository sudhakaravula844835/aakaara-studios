import { supabase } from './supabase-client.js';
import {
  STAGE_COLUMNS, formatDate, deriveWeddingDate, compareProjectsByField, progressSegments,
} from './board-utils.js';
import { showErrorToast } from './board-shared.js';
import { openDetailPanel } from './project-modal.js';

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
    th.textContent = col.label;
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
    }
    // On success, the realtime subscription's refresh reflects the change
    // (including re-sorting if the active sort column is affected) — no
    // local mutation here, consistent with the rest of the board.
  });
  stageCell.appendChild(select);
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
