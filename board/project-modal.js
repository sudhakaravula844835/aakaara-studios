import { supabase } from './supabase-client.js';
import { validateProjectForm, formatDate, photoSelectionLabel } from './board-utils.js';
import { showErrorToast } from './board-shared.js';

export function openProjectModal(project) {
  const backdrop = document.getElementById('projectModalBackdrop');
  const form = document.getElementById('projectForm');
  form.reset();
  document.getElementById('fClientNameError').textContent = '';
  document.getElementById('projectModalTitle').textContent = project ? 'Edit Project' : 'New Project';

  document.getElementById('fId').value = project ? project.id : '';
  document.getElementById('fClientName').value = project ? project.client_name : '';
  document.getElementById('fClientEmail').value = project ? (project.client_email || '') : '';
  document.getElementById('fClientPhone').value = project ? (project.client_phone || '') : '';
  document.getElementById('fPackageTier').value = project ? (project.package_tier || '') : '';
  document.getElementById('fHoursBooked').value = project ? (project.hours_booked ?? '') : '';
  document.getElementById('fQuotedPrice').value = project ? (project.quoted_price ?? '') : '';
  document.getElementById('fConfirmedPrice').value = project ? (project.confirmed_price ?? '') : '';
  document.getElementById('fDepositPaid').checked = project ? !!project.deposit_paid : false;
  document.getElementById('fBalancePaid').checked = project ? !!project.balance_paid : false;
  document.getElementById('fContractUrl').value = project ? (project.contract_url || '') : '';
  document.getElementById('fQuotePdfUrl').value = project ? (project.quote_pdf_url || '') : '';

  backdrop.classList.add('open');
  document.getElementById('fClientName').focus();
}

function closeProjectModal() {
  document.getElementById('projectModalBackdrop').classList.remove('open');
}

async function handleProjectFormSubmit(e) {
  e.preventDefault();

  const fields = {
    client_name: document.getElementById('fClientName').value.trim(),
    client_email: document.getElementById('fClientEmail').value.trim() || null,
    client_phone: document.getElementById('fClientPhone').value.trim() || null,
    package_tier: document.getElementById('fPackageTier').value.trim() || null,
    hours_booked: document.getElementById('fHoursBooked').value ? Number(document.getElementById('fHoursBooked').value) : null,
    quoted_price: document.getElementById('fQuotedPrice').value ? Number(document.getElementById('fQuotedPrice').value) : null,
    confirmed_price: document.getElementById('fConfirmedPrice').value ? Number(document.getElementById('fConfirmedPrice').value) : null,
    deposit_paid: document.getElementById('fDepositPaid').checked,
    balance_paid: document.getElementById('fBalancePaid').checked,
    contract_url: document.getElementById('fContractUrl').value.trim() || null,
    quote_pdf_url: document.getElementById('fQuotePdfUrl').value.trim() || null,
  };

  const { valid, errors } = validateProjectForm(fields);
  if (!valid) {
    document.getElementById('fClientNameError').textContent = errors.client_name || '';
    return;
  }

  const editId = document.getElementById('fId').value;
  const { error } = editId
    ? await supabase.from('projects').update(fields).eq('id', editId)
    : await supabase.from('projects').insert(fields);

  if (error) {
    showErrorToast('Could not save project — please try again.');
    return;
  }

  closeProjectModal();
}

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('projectForm').addEventListener('submit', handleProjectFormSubmit);
  document.getElementById('projectModalClose').addEventListener('click', closeProjectModal);
  document.getElementById('projectModalCancel').addEventListener('click', closeProjectModal);
  document.getElementById('projectModalBackdrop').addEventListener('click', (e) => {
    if (e.target.id === 'projectModalBackdrop') closeProjectModal();
  });
});

// ---- Detail Panel ----

let currentDetailProject = null;

export async function openDetailPanel(project) {
  currentDetailProject = project;
  document.getElementById('detailClientName').textContent = project.client_name;
  document.getElementById('detailBackdrop').classList.add('open');
  await renderSubEventsTimeline();
}

function closeDetailPanel() {
  document.getElementById('detailBackdrop').classList.remove('open');
  currentDetailProject = null;
}

async function renderSubEventsTimeline() {
  const { data: subEvents, error } = await supabase
    .from('sub_events')
    .select('*')
    .eq('project_id', currentDetailProject.id)
    .order('event_date', { ascending: true, nullsFirst: false });

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

    const selLabel = photoSelectionLabel(se.photo_selected_count, se.photo_total_count);
    if (selLabel) {
      const sel = document.createElement('div');
      sel.className = 'timeline-selection';
      sel.textContent = selLabel;
      content.appendChild(sel);
    }

    const editBtn = document.createElement('button');
    editBtn.className = 'timeline-edit-btn';
    editBtn.textContent = 'Edit';
    editBtn.addEventListener('click', () => openSubEventModal(se));
    content.appendChild(editBtn);

    item.appendChild(content);
    container.appendChild(item);
  });
}

function openSubEventModal(subEvent) {
  document.getElementById('subEventModalTitle').textContent = subEvent ? 'Edit Sub-Event' : 'New Sub-Event';
  document.getElementById('seId').value = subEvent ? subEvent.id : '';
  document.getElementById('seName').value = subEvent ? subEvent.name : '';
  document.getElementById('seDate').value = subEvent ? (subEvent.event_date || '') : '';
  document.getElementById('seVenue').value = subEvent ? (subEvent.venue || '') : '';
  document.getElementById('subEventModalBackdrop').classList.add('open');
}

function closeSubEventModal() {
  document.getElementById('subEventModalBackdrop').classList.remove('open');
}

async function handleSubEventFormSubmit(e) {
  e.preventDefault();
  const fields = {
    project_id: currentDetailProject.id,
    name: document.getElementById('seName').value.trim(),
    event_date: document.getElementById('seDate').value || null,
    venue: document.getElementById('seVenue').value.trim() || null,
  };
  const editId = document.getElementById('seId').value;

  const { error } = editId
    ? await supabase.from('sub_events').update(fields).eq('id', editId)
    : await supabase.from('sub_events').insert(fields);

  if (error) {
    showErrorToast('Could not save sub-event — please try again.');
    return;
  }

  closeSubEventModal();
  await renderSubEventsTimeline();
}

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('detailClose').addEventListener('click', closeDetailPanel);
  document.getElementById('detailBackdrop').addEventListener('click', (e) => {
    if (e.target.id === 'detailBackdrop') closeDetailPanel();
  });
  document.getElementById('addSubEventBtn').addEventListener('click', () => openSubEventModal(null));
  document.getElementById('subEventForm').addEventListener('submit', handleSubEventFormSubmit);
  document.getElementById('subEventModalClose').addEventListener('click', closeSubEventModal);
  document.getElementById('subEventModalCancel').addEventListener('click', closeSubEventModal);
});
