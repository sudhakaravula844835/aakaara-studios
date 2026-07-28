import { supabase } from './supabase-client.js';
import {
  STAGE_COLUMNS, SUBSTATUS_LABELS, progressSegments,
  deriveWeddingDate, formatDate, compareProjectsByDate,
} from './board-utils.js';
import { showErrorToast, setCurrentProfile } from './board-shared.js';
import {
  openProjectModal, openDetailPanel, getCurrentDetailProjectId,
  renderSubEventsTimeline, renderActivityFeed,
} from './project-modal.js';
import { renderListView } from './list-view.js';
import { renderCalendarView } from './calendar-view.js';

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
    // Do NOT synthesize a fake-but-plausible profile here — that would
    // silently mis-attribute every subsequent comment to a blank-named PM,
    // permanently, in an audit-adjacent record. Leave currentProfile at its
    // board-shared.js default (full_name: '') and disable the comment
    // composer so authorship can't be forged. handleCommentSubmit also
    // double-checks getCurrentProfile().full_name as defense in depth.
    showErrorToast('Could not load your profile — comments are disabled.');
    const commentSubmitBtn = document.querySelector('#commentForm button[type="submit"]');
    if (commentSubmitBtn) commentSubmitBtn.disabled = true;
    return null;
  }
  return data;
}

async function fetchProjects() {
  const { data, error } = await supabase
    .from('projects')
    .select('id, client_name, client_email, client_phone, stage, video_editing_substatus, package_tier, hours_booked, quoted_price, confirmed_price, deposit_paid, balance_paid, contract_url, quote_pdf_url, sub_events(id, name, event_date, venue, photo_selection_status, photo_selected_count, photo_total_count)');
  if (error) {
    showErrorToast('Could not load projects.');
    // null (not []) signals "fetch failed" distinctly from "fetch succeeded
    // with zero rows" — refreshProjects() below relies on this distinction
    // to avoid blanking the board on a transient network blip.
    return null;
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
  card.addEventListener('click', () => openDetailPanel(project));

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

  if (card) {
    // Same-column no-op guard: dropping a card back into the column it
    // already lives in shouldn't hit Supabase at all.
    const sourceColumn = card.closest('.board-column-cards');
    if (sourceColumn && sourceColumn.dataset.stage === newStage) return;
    card.classList.add('card-pending');
  }

  const { error } = await supabase.from('projects').update({ stage: newStage }).eq('id', projectId);

  if (error) {
    if (card) card.classList.remove('card-pending');
    showErrorToast('Could not move project — please try again.');
    return;
  }

  // On success, the realtime subscription's refresh is what normally moves
  // the card — no local DOM move happens here, per the design spec's
  // explicit no-optimistic-update decision. Safety net: if a realtime event
  // was missed, the card would otherwise stay stuck showing .card-pending
  // forever with no recovery path. Force a refresh if it's still pending
  // after a few seconds.
  setTimeout(() => {
    const stillPending = document.querySelector(`.project-card[data-id="${projectId}"].card-pending`);
    if (stillPending) refreshProjects();
  }, 3000);
}

function renderBoard() {
  STAGE_COLUMNS.forEach(col => {
    const columnCardsEl = document.querySelector(`.board-column-cards[data-stage="${col.key}"]`);
    if (!columnCardsEl) return;
    columnCardsEl.innerHTML = '';

    const columnProjects = currentProjects.filter(p => p.stage === col.key).sort(compareProjectsByDate);

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

let currentProjects = [];
let currentView = 'kanban';
let renderGeneration = 0;

function renderActiveView() {
  if (currentView === 'kanban') renderBoard();
  else if (currentView === 'list') renderListView(currentProjects);
  else if (currentView === 'calendar') renderCalendarView(currentProjects);
}

export async function refreshProjects() {
  const myGeneration = ++renderGeneration;
  const projects = await fetchProjects();
  if (myGeneration !== renderGeneration) return; // a newer refresh started while we were fetching; abandon this stale one
  // null means the fetch itself failed (fetchProjects already showed a
  // toast) — leave currentProjects/the on-screen render exactly as they
  // were rather than blanking the board to "No projects yet.", which would
  // misleadingly read as "you have zero projects" instead of "something
  // went wrong." A genuinely empty result ([]) still updates and renders
  // normally.
  if (projects === null) return;
  currentProjects = projects;
  renderActiveView();
}

function setActiveView(view) {
  currentView = view;
  document.querySelectorAll('.view-toggle-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.view === view);
  });
  document.getElementById('boardColumns').classList.toggle('view-active', view === 'kanban');
  document.getElementById('listViewContainer').classList.toggle('view-active', view === 'list');
  document.getElementById('calendarViewContainer').classList.toggle('view-active', view === 'calendar');
  renderActiveView();
}

let realtimeChannel = null;

function subscribeToChanges() {
  realtimeChannel = supabase
    .channel('board-changes')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'projects' }, () => refreshProjects())
    .on('postgres_changes', { event: '*', schema: 'public', table: 'sub_events' }, (payload) => {
      // Sub-event dates affect card display (deriveWeddingDate) and the
      // Calendar view, so a full refresh is still needed. Additionally, if
      // the detail panel is open for the affected project, refresh its
      // timeline in place so a second person's edit shows up without
      // closing/reopening.
      refreshProjects();
      const projectId = payload.new?.project_id ?? payload.old?.project_id;
      if (projectId && getCurrentDetailProjectId() === projectId) renderSubEventsTimeline();
    })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'comments' }, (payload) => {
      // Nothing on a board card, list row, or calendar marker reads
      // comments — do NOT trigger a full refresh (that resets Kanban's
      // column scroll positions). Only the open detail panel's activity
      // feed, if any, cares about this.
      const projectId = payload.new?.project_id ?? payload.old?.project_id;
      if (projectId && getCurrentDetailProjectId() === projectId) renderActivityFeed();
    })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'activity_log' }, (payload) => {
      const projectId = payload.new?.project_id ?? payload.old?.project_id;
      if (projectId && getCurrentDetailProjectId() === projectId) renderActivityFeed();
    })
    .subscribe((status) => {
      if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        showErrorToast('Live updates disconnected — reconnecting…');
      }
    });
}

async function init() {
  // Wire up header button handlers before any network awaits below, so
  // "+ New Project" / "Log Out" / the view toggle are never visible-but-inert.
  document.getElementById('logoutBtn').addEventListener('click', async () => {
    if (realtimeChannel) supabase.removeChannel(realtimeChannel);
    await supabase.auth.signOut();
    window.location.href = 'login.html';
  });

  document.getElementById('addProjectBtn').addEventListener('click', () => openProjectModal(null));

  document.querySelectorAll('.view-toggle-btn').forEach(btn => {
    btn.addEventListener('click', () => setActiveView(btn.dataset.view));
  });

  const user = await requireSession();
  if (!user) return;

  const profile = await fetchProfile(user.id);
  if (profile) setCurrentProfile(profile);

  renderColumns();
  await refreshProjects();
  subscribeToChanges();
}

document.addEventListener('DOMContentLoaded', init);
