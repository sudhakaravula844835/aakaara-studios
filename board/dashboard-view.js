import {
  STAGE_COLUMNS, stageLabel, formatDate, deriveWeddingDate, compareProjectsByDate,
} from './board-utils.js';
// Same board.js <-> project-modal.js import cycle documented in
// list-view.js and project-modal.js — safe here because openDetailPanel is
// only invoked from inside a card click/keydown handler, never at
// module-eval time.
import { openDetailPanel } from './project-modal.js';

// This view is the spiritual successor of the old admin/dashboard.html
// "Client CRM" home page — same searchable card-grid look, ported onto
// board's real project data. Unlike that page, board has no pre-booking
// "lead" concept (every row in `projects` is already a booked client), so
// there's no Sent/Rejected pipeline to filter by; stage is what's left.
let searchTerm = '';
let activeFilter = 'all';
let lastProjects = [];
let searchWired = false;

function formatCurrency(amount) {
  return `$${Math.round(amount).toLocaleString('en-US')}`;
}

// Collapses the 8 kanban stages down to the 3 colors the old CRM used for
// its status badges (confirmed/sent/rejected) so a glance at the grid still
// reads as "done / just booked / everything in between", without inventing
// a second stage taxonomy alongside STAGE_COLUMNS.
function stageGroup(stage) {
  if (stage === 'completed') return 'completed';
  if (stage === 'booked') return 'booked';
  return 'active';
}

function firstDatedSubEvent(subEvents) {
  if (!subEvents || !subEvents.length) return null;
  const dated = [...subEvents].filter(e => e.event_date).sort((a, b) => (a.event_date < b.event_date ? -1 : 1));
  return dated[0] || null;
}

function matchesFilter(project) {
  return activeFilter === 'all' || project.stage === activeFilter;
}

function matchesSearch(project) {
  if (!searchTerm) return true;
  const haystack = [
    project.client_name,
    project.package_tier,
    formatDate(deriveWeddingDate(project.sub_events)),
    firstDatedSubEvent(project.sub_events)?.venue,
  ].filter(Boolean).join(' ').toLowerCase();
  return haystack.includes(searchTerm);
}

function renderFilterPills() {
  const container = document.getElementById('dashFilterPills');
  if (!container) return;
  container.innerHTML = '';
  [{ key: 'all', label: 'All' }, ...STAGE_COLUMNS].forEach(({ key, label }) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'dash-filter-pill' + (activeFilter === key ? ' active' : '');
    btn.textContent = label;
    btn.addEventListener('click', () => {
      activeFilter = key;
      renderFilterPills();
      renderCardsGrid();
    });
    container.appendChild(btn);
  });
}

function addField(card, svgPath, content) {
  if (!content) return;
  const row = document.createElement('div');
  row.className = 'dash-card-field';
  row.innerHTML = `<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">${svgPath}</svg>`;
  const span = document.createElement('span');
  span.textContent = content;
  row.appendChild(span);
  card.appendChild(row);
}

function priceCell(label, value) {
  const cell = document.createElement('div');
  const lbl = document.createElement('div');
  lbl.className = 'dash-price-lbl';
  lbl.textContent = label;
  const val = document.createElement('div');
  val.className = 'dash-price-val';
  val.textContent = value;
  cell.appendChild(lbl);
  cell.appendChild(val);
  return cell;
}

function renderCard(project) {
  const group = stageGroup(project.stage);
  const card = document.createElement('div');
  card.className = `dash-card stage-${group}`;
  card.setAttribute('role', 'listitem');
  card.tabIndex = 0;
  card.addEventListener('click', () => openDetailPanel(project));
  card.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openDetailPanel(project); }
  });

  const top = document.createElement('div');
  top.className = 'dash-card-top';
  const name = document.createElement('div');
  name.className = 'dash-card-name';
  name.textContent = project.client_name;
  const badge = document.createElement('div');
  badge.className = `dash-card-badge dash-badge-${group}`;
  badge.textContent = stageLabel(project.stage);
  top.appendChild(name);
  top.appendChild(badge);
  card.appendChild(top);

  const dated = firstDatedSubEvent(project.sub_events);
  addField(card, '<rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>', formatDate(deriveWeddingDate(project.sub_events)));
  addField(card, '<path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>', dated?.venue);
  addField(card, '<path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/>', project.package_tier);

  const divider = document.createElement('hr');
  divider.className = 'dash-card-divider';
  card.appendChild(divider);

  const priceRow = document.createElement('div');
  priceRow.className = 'dash-card-price-row';
  const prices = document.createElement('div');
  prices.className = 'dash-card-prices';
  prices.appendChild(priceCell('Quoted', project.quoted_price ? formatCurrency(project.quoted_price) : '—'));
  prices.appendChild(priceCell('Confirmed', project.confirmed_price ? formatCurrency(project.confirmed_price) : '—'));
  priceRow.appendChild(prices);

  if (project.confirmed_price) {
    const balanceBadge = document.createElement('span');
    balanceBadge.className = `dash-balance-badge ${project.balance_paid ? 'dash-balance-paid' : 'dash-balance-due'}`;
    balanceBadge.textContent = project.balance_paid ? 'Balance Paid' : 'Balance Due';
    priceRow.appendChild(balanceBadge);
  }
  card.appendChild(priceRow);

  return card;
}

function renderCardsGrid() {
  const container = document.getElementById('dashCards');
  if (!container) return;
  container.innerHTML = '';

  const filtered = lastProjects.filter(matchesFilter).filter(matchesSearch).sort(compareProjectsByDate);

  if (!filtered.length) {
    const empty = document.createElement('div');
    empty.className = 'dash-empty';
    empty.textContent = lastProjects.length ? 'No projects match your search.' : 'No projects yet.';
    container.appendChild(empty);
    return;
  }

  filtered.forEach(p => container.appendChild(renderCard(p)));
}

// Wired once, not on every render — the search box is static markup in
// index.html (never torn down by renderCardsGrid, which only touches
// #dashCards), so a single listener here is all it ever needs. Rebuilding
// it per-render like the filter pills would blur the input on every
// keystroke.
function wireSearchOnce() {
  if (searchWired) return;
  const input = document.getElementById('dashSearch');
  if (!input) return;
  input.addEventListener('input', () => {
    searchTerm = input.value.trim().toLowerCase();
    renderCardsGrid();
  });
  searchWired = true;
}

export function renderDashboardView(projects) {
  lastProjects = projects || [];
  wireSearchOnce();
  renderFilterPills();
  renderCardsGrid();
}
