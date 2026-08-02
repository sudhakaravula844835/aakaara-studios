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
import { renderStaffView } from './staff.js';

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
    // `active` must stay in this list: login.js only checks it on the
    // login-FORM submit path, so a tab that already holds a valid session
    // lands straight on the board without ever passing that check. init()
    // below is the only place a deactivated-but-still-signed-in user gets
    // ejected, and it can't notice what this select doesn't fetch.
    .select('full_name, role, active')
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
    .select('id, client_name, client_email, client_phone, stage, video_editing_substatus, package_tier, hours_booked, quoted_price, confirmed_price, deposit_amount, balance_paid, contract_uploaded_at, quote_uploaded_at, raw_delivered_at, raw_delivery_link, expected_delivery_date, pm_id, sub_events(id, name, event_date, venue, photo_selection_status, photo_selected_count, photo_total_count)');
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
let renderGeneration = 0;
let currentView = 'kanban';

const WAITING_ON_CLIENT_STAGES = ['raw_delivered', 'photo_selection', 'song_finalization'];

function renderCounters(projects) {
  const container = document.getElementById('boardCounters');
  if (!container) return;

  const counts = [
    { label: 'Active Weddings', value: projects.filter(p => p.stage !== 'completed').length },
    { label: 'Waiting on Client', value: projects.filter(p => WAITING_ON_CLIENT_STAGES.includes(p.stage)).length },
    { label: 'Editing', value: projects.filter(p => p.stage === 'video_editing').length },
    { label: 'Final Delivery', value: projects.filter(p => p.stage === 'final_delivery').length },
  ];

  container.textContent = '';
  counts.forEach(({ label, value }) => {
    const stat = document.createElement('div');
    const valueEl = document.createElement('div');
    valueEl.className = 'board-counter-value';
    valueEl.textContent = String(value);
    const labelEl = document.createElement('div');
    labelEl.className = 'board-counter-label';
    labelEl.textContent = label;
    stat.appendChild(valueEl);
    stat.appendChild(labelEl);
    container.appendChild(stat);
  });
}

function formatCurrency(amount) {
  return `$${Math.round(amount).toLocaleString('en-US')}`;
}

function renderFinancialSummary(projects) {
  const summaryEl = document.getElementById('financeSummary');
  const outstandingEl = document.getElementById('financeOutstanding');
  if (!summaryEl || !outstandingEl) return;

  const totalQuoted = projects.reduce((sum, p) => sum + (p.quoted_price || 0), 0);
  const totalConfirmed = projects.reduce((sum, p) => sum + (p.confirmed_price || 0), 0);
  // Amount still owed on a project = confirmed price minus whatever deposit
  // was already paid, not the full confirmed price -- a partial deposit
  // still leaves a balance, just a smaller one.
  const amountOwed = (p) => p.confirmed_price - (p.deposit_amount || 0);
  const unpaidBalances = projects.filter(p => p.confirmed_price && !p.balance_paid && amountOwed(p) > 0);
  const totalOutstanding = unpaidBalances.reduce((sum, p) => sum + amountOwed(p), 0);

  const stats = [
    { label: 'Total Quoted', value: formatCurrency(totalQuoted) },
    { label: 'Total Confirmed', value: formatCurrency(totalConfirmed) },
    { label: 'Outstanding Balance', value: formatCurrency(totalOutstanding) },
  ];

  summaryEl.textContent = '';
  stats.forEach(({ label, value }) => {
    const stat = document.createElement('div');
    const valueEl = document.createElement('div');
    valueEl.className = 'board-counter-value';
    valueEl.textContent = value;
    const labelEl = document.createElement('div');
    labelEl.className = 'board-counter-label';
    labelEl.textContent = label;
    stat.appendChild(valueEl);
    stat.appendChild(labelEl);
    summaryEl.appendChild(stat);
  });

  outstandingEl.textContent = '';
  const outstandingLabel = document.createElement('span');
  outstandingLabel.className = 'board-finance-outstanding-label';
  outstandingLabel.textContent = 'Balance Due';
  outstandingEl.appendChild(outstandingLabel);

  if (unpaidBalances.length === 0) {
    const empty = document.createElement('span');
    empty.className = 'board-finance-outstanding-empty';
    empty.textContent = 'None outstanding';
    outstandingEl.appendChild(empty);
    return;
  }

  unpaidBalances
    .sort((a, b) => amountOwed(b) - amountOwed(a))
    .forEach(p => {
      const item = document.createElement('span');
      item.className = 'board-finance-outstanding-item';
      item.textContent = `${p.client_name} · ${formatCurrency(amountOwed(p))}`;
      outstandingEl.appendChild(item);
    });
}

function renderActiveView() {
  if (currentView === 'list') {
    renderListView(currentProjects);
    return;
  }
  if (currentView === 'calendar') {
    renderCalendarView(currentProjects);
    return;
  }
  if (currentView === 'staff') {
    renderStaffView();
    return;
  }
  renderBoard();
}

function setActiveView(view) {
  currentView = view;

  document.querySelectorAll('.view-toggle-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.view === view);
  });

  document.getElementById('boardColumns').classList.toggle('view-active', view === 'kanban');
  document.getElementById('listViewContainer').classList.toggle('view-active', view === 'list');
  document.getElementById('calendarViewContainer').classList.toggle('view-active', view === 'calendar');
  document.getElementById('staffViewContainer').classList.toggle('view-active', view === 'staff');

  renderActiveView();
}

function setupViewToggle() {
  document.querySelectorAll('.view-toggle-btn').forEach(btn => {
    btn.addEventListener('click', () => setActiveView(btn.dataset.view));
  });
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
  renderCounters(currentProjects);
  renderFinancialSummary(currentProjects);
  renderActiveView();
}

let realtimeChannel = null;

function subscribeToChanges() {
  realtimeChannel = supabase
    .channel('board-changes')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'projects' }, () => refreshProjects())
    .on('postgres_changes', { event: '*', schema: 'public', table: 'sub_events' }, (payload) => {
      // Sub-event dates affect Kanban card dates, List rows, and Calendar
      // markers, so a full refresh is still needed. Additionally, if
      // the detail panel is open for the affected project, refresh its
      // timeline in place so a second person's edit shows up without
      // closing/reopening.
      refreshProjects();
      const projectId = payload.new?.project_id ?? payload.old?.project_id;
      if (projectId && getCurrentDetailProjectId() === projectId) renderSubEventsTimeline();
    })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'comments' }, (payload) => {
      // Nothing on a board card reads comments, so do not trigger a full
      // refresh that resets Kanban's column scroll positions.
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
  // "+ New Project" / "Log Out" / view switching are never visible-but-inert.
  document.getElementById('logoutBtn').addEventListener('click', async () => {
    if (realtimeChannel) supabase.removeChannel(realtimeChannel);
    await supabase.auth.signOut();
    window.location.href = 'login.html';
  });

  document.getElementById('addProjectBtn').addEventListener('click', () => openProjectModal(null));
  setupViewToggle();

  const user = await requireSession();
  if (!user) return;

  const profile = await fetchProfile(user.id);
  if (profile) {
    // A deactivated user whose session is still valid would otherwise sit on
    // a fully-rendered (if empty) board indefinitely -- every RLS-gated read
    // returns nothing, but nothing tells them why or sends them away. Eject
    // them to a clean login screen; login.js's own check then shows the
    // "access revoked" message if they try to sign back in.
    if (profile.active === false) {
      await supabase.auth.signOut();
      window.location.href = 'login.html';
      return;
    }

    setCurrentProfile(profile);
    if (profile.role === 'owner') {
      document.querySelectorAll('.owner-only').forEach(el => el.classList.add('owner-visible'));
    }
  }

  renderColumns();
  await refreshProjects();
  subscribeToChanges();
}

document.addEventListener('DOMContentLoaded', init);
