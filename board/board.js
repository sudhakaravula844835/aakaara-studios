import { supabase } from './supabase-client.js';
import {
  STAGE_COLUMNS, SUBSTATUS_LABELS, progressSegments,
  deriveWeddingDate, formatDate, compareProjectsByDate,
} from './board-utils.js';
import { showErrorToast, setCurrentProfile } from './board-shared.js';

async function requireSession() {
  const { data } = await supabase.auth.getSession();
  if (!data.session) {
    window.location.href = 'login.html';
    return null;
  }
  return data.session.user;
}

async function fetchProfile(userId) {
  const { data, error } = await supabase
    .from('profiles')
    .select('full_name, role')
    .eq('id', userId)
    .single();
  if (error) {
    showErrorToast('Could not load your profile.');
    return { full_name: '', role: 'pm' };
  }
  return data;
}

async function fetchProjects() {
  const { data, error } = await supabase
    .from('projects')
    .select('*, sub_events(id, name, event_date, venue, photo_selection_status, photo_selected_count, photo_total_count)');
  if (error) {
    showErrorToast('Could not load projects.');
    return [];
  }
  return data;
}

function renderColumns() {
  const container = document.getElementById('boardColumns');
  container.innerHTML = '';

  STAGE_COLUMNS.forEach(col => {
    const columnEl = document.createElement('div');
    columnEl.className = 'board-column';
    columnEl.dataset.stage = col.key;

    const header = document.createElement('div');
    header.className = 'board-column-header';
    header.textContent = col.label;
    columnEl.appendChild(header);

    const cardsEl = document.createElement('div');
    cardsEl.className = 'board-column-cards';
    cardsEl.dataset.stage = col.key;
    columnEl.appendChild(cardsEl);

    columnEl.addEventListener('dragover', (e) => e.preventDefault());
    columnEl.addEventListener('drop', (e) => handleDrop(e, col.key));

    container.appendChild(columnEl);
  });
}

function renderCard(project) {
  const card = document.createElement('div');
  card.className = 'project-card';
  card.dataset.id = project.id;
  card.draggable = true;
  card.addEventListener('dragstart', (e) => {
    e.dataTransfer.setData('text/plain', project.id);
  });

  const name = document.createElement('div');
  name.className = 'card-client-name';
  name.textContent = project.client_name;
  card.appendChild(name);

  const date = document.createElement('div');
  date.className = 'card-date';
  date.textContent = formatDate(deriveWeddingDate(project.sub_events));
  card.appendChild(date);

  if (project.package_tier) {
    const tier = document.createElement('div');
    tier.className = 'card-tier';
    tier.textContent = project.package_tier;
    card.appendChild(tier);
  }

  if (project.stage === 'video_editing' && project.video_editing_substatus) {
    const sub = document.createElement('div');
    sub.className = 'card-substatus';
    sub.textContent = SUBSTATUS_LABELS[project.video_editing_substatus] || project.video_editing_substatus;
    card.appendChild(sub);
  }

  const progress = progressSegments(project.stage);
  const bar = document.createElement('div');
  bar.className = 'card-progress';
  for (let i = 0; i < progress.total; i++) {
    const seg = document.createElement('span');
    seg.className = 'card-progress-segment' + (i < progress.filled ? ' filled' : '');
    bar.appendChild(seg);
  }
  card.appendChild(bar);

  return card;
}

async function handleDrop(e, newStage) {
  e.preventDefault();
  const projectId = e.dataTransfer.getData('text/plain');
  const card = document.querySelector(`.project-card[data-id="${projectId}"]`);
  if (card) card.classList.add('card-pending');

  const { error } = await supabase.from('projects').update({ stage: newStage }).eq('id', projectId);

  if (error) {
    if (card) card.classList.remove('card-pending');
    showErrorToast('Could not move project — please try again.');
    return;
  }

  // On success, the realtime subscription's redraw (Task 5) is what normally
  // moves the card — no local DOM move happens here, per the design spec's
  // explicit no-optimistic-update decision. Safety net: if a realtime event
  // was missed (e.g. this drop happened before the channel finished
  // subscribing on a freshly-loaded page), the card would otherwise stay
  // stuck showing .card-pending forever with no recovery path. Force a
  // redraw if it's still pending after a few seconds.
  setTimeout(() => {
    const stillPending = document.querySelector(`.project-card[data-id="${projectId}"].card-pending`);
    if (stillPending) renderBoard();
  }, 3000);
}

export async function renderBoard() {
  const projects = await fetchProjects();

  STAGE_COLUMNS.forEach(col => {
    const columnCardsEl = document.querySelector(`.board-column-cards[data-stage="${col.key}"]`);
    columnCardsEl.innerHTML = '';

    const columnProjects = projects.filter(p => p.stage === col.key).sort(compareProjectsByDate);

    if (columnProjects.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'board-column-empty';
      empty.textContent = 'No projects';
      columnCardsEl.appendChild(empty);
      return;
    }

    columnProjects.forEach(p => columnCardsEl.appendChild(renderCard(p)));
  });
}

let realtimeChannel = null;

function subscribeToChanges() {
  realtimeChannel = supabase
    .channel('board-changes')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'projects' }, () => renderBoard())
    .on('postgres_changes', { event: '*', schema: 'public', table: 'sub_events' }, () => renderBoard())
    .on('postgres_changes', { event: '*', schema: 'public', table: 'comments' }, () => renderBoard())
    .on('postgres_changes', { event: '*', schema: 'public', table: 'activity_log' }, () => renderBoard())
    .subscribe((status) => {
      if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        showErrorToast('Live updates disconnected — reconnecting…');
      }
    });
}

async function init() {
  const user = await requireSession();
  if (!user) return;

  const profile = await fetchProfile(user.id);
  setCurrentProfile(profile);

  renderColumns();
  await renderBoard();
  subscribeToChanges();

  document.getElementById('logoutBtn').addEventListener('click', async () => {
    if (realtimeChannel) supabase.removeChannel(realtimeChannel);
    await supabase.auth.signOut();
    window.location.href = 'login.html';
  });
}

document.addEventListener('DOMContentLoaded', init);
