import { supabase } from './supabase-client.js';
import {
  validateProjectForm, validateSubEventForm, formatDate,
  photoSelectionLabel, synthesizeActivityLine,
} from './board-utils.js';
import { showErrorToast, getCurrentProfile } from './board-shared.js';
// Circular import: board.js imports openProjectModal/openDetailPanel/etc from
// this module, and this module imports renderBoard from board.js. Safe here
// because renderBoard is a hoisted function declaration and is only invoked
// from inside an event handler (after a user submits the form), never at
// module-evaluation time — by then both modules have finished initializing.
import { renderBoard } from './board.js';

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

  // If the detail panel is open for the project we just edited, refresh its
  // in-memory snapshot too — otherwise re-opening Edit from the still-open
  // panel (without closing/reopening it) would show stale pre-edit values,
  // even though the save itself succeeded.
  if (editId && currentDetailProject && currentDetailProject.id === editId) {
    currentDetailProject = { ...currentDetailProject, ...fields };
    document.getElementById('detailClientName').textContent = currentDetailProject.client_name;
  }

  closeProjectModal();
  // Don't rely solely on the realtime redraw — if realtime is ever silently
  // down (this exact failure mode happened once before the publication was
  // fixed), a user clicking Save should still see the project appear.
  await renderBoard();
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

export function getCurrentDetailProjectId() {
  return currentDetailProject?.id ?? null;
}

export async function openDetailPanel(project) {
  currentDetailProject = project;
  document.getElementById('detailClientName').textContent = project.client_name;
  document.getElementById('detailBackdrop').classList.add('open');
  await renderSubEventsTimeline();
  await renderActivityFeed();
}

function closeDetailPanel() {
  document.getElementById('detailBackdrop').classList.remove('open');
  currentDetailProject = null;
}

export async function renderSubEventsTimeline() {
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

    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'timeline-delete-btn';
    deleteBtn.textContent = 'Delete';
    deleteBtn.addEventListener('click', async () => {
      const { error } = await supabase.from('sub_events').delete().eq('id', se.id);
      if (error) {
        showErrorToast('Could not delete sub-event — please try again.');
        return;
      }
      await renderSubEventsTimeline();
    });
    content.appendChild(deleteBtn);

    item.appendChild(content);
    container.appendChild(item);
  });
}

function openSubEventModal(subEvent) {
  document.getElementById('subEventModalTitle').textContent = subEvent ? 'Edit Sub-Event' : 'New Sub-Event';
  document.getElementById('seNameError').textContent = '';
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

  const { valid, errors } = validateSubEventForm(fields);
  if (!valid) {
    document.getElementById('seNameError').textContent = errors.name || '';
    return;
  }

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
  document.getElementById('detailEditBtn').addEventListener('click', () => openProjectModal(currentDetailProject));
  document.getElementById('detailBackdrop').addEventListener('click', (e) => {
    if (e.target.id === 'detailBackdrop') closeDetailPanel();
  });
  document.getElementById('addSubEventBtn').addEventListener('click', () => openSubEventModal(null));
  document.getElementById('subEventForm').addEventListener('submit', handleSubEventFormSubmit);
  document.getElementById('subEventModalClose').addEventListener('click', closeSubEventModal);
  document.getElementById('subEventModalCancel').addEventListener('click', closeSubEventModal);
});

// ---- Activity & Comments Feed ----

export async function renderActivityFeed() {
  const [{ data: comments, error: commentsError }, { data: activity, error: activityError }] = await Promise.all([
    supabase.from('comments').select('*').eq('project_id', currentDetailProject.id).order('created_at', { ascending: true }),
    supabase.from('activity_log').select('*').eq('project_id', currentDetailProject.id).order('created_at', { ascending: true }),
  ]);

  const container = document.getElementById('activityFeed');
  container.innerHTML = '';

  if (commentsError || activityError) {
    showErrorToast('Could not load activity.');
    return;
  }

  const entries = [
    ...comments.map(c => ({ type: 'comment', created_at: c.created_at, data: c })),
    ...activity.map(a => ({ type: 'activity', created_at: a.created_at, data: a })),
  ].sort((a, b) => new Date(a.created_at) - new Date(b.created_at));

  if (entries.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'feed-empty';
    empty.textContent = 'No comments yet.';
    container.appendChild(empty);
    return;
  }

  entries.forEach(entry => {
    const row = document.createElement('div');

    if (entry.type === 'comment') {
      row.className = 'feed-row feed-row-comment';

      const avatar = document.createElement('div');
      avatar.className = 'feed-avatar';
      avatar.textContent = (entry.data.author_label || '?').charAt(0).toUpperCase();
      row.appendChild(avatar);

      const content = document.createElement('div');
      content.className = 'feed-content';

      const authorLine = document.createElement('div');
      authorLine.className = 'feed-author-line';

      const authorName = document.createElement('span');
      authorName.className = 'feed-author-name';
      authorName.textContent = entry.data.author_label || '?';
      authorLine.appendChild(authorName);

      if (entry.data.internal) {
        const tag = document.createElement('span');
        tag.className = 'feed-internal-tag';
        tag.textContent = 'Internal';
        authorLine.appendChild(tag);
      }
      content.appendChild(authorLine);

      const body = document.createElement('div');
      body.className = 'feed-body';
      body.textContent = entry.data.body;
      content.appendChild(body);

      row.appendChild(content);
    } else {
      row.className = 'feed-row feed-row-activity';

      const marker = document.createElement('div');
      marker.className = 'feed-marker';
      row.appendChild(marker);

      const text = document.createElement('div');
      text.className = 'feed-activity-text';
      text.textContent = synthesizeActivityLine(entry.data);
      row.appendChild(text);
    }

    container.appendChild(row);
  });
}

async function handleCommentSubmit(e) {
  e.preventDefault();
  const body = document.getElementById('commentBody').value.trim();
  if (!body) return;

  const internal = document.getElementById('commentInternal').checked;
  const profile = getCurrentProfile();

  // Defense in depth: the submit button is disabled when the profile fetch
  // fails (see board.js's fetchProfile), but double-check authorship here
  // too so a comment can never be posted under a blank/unknown name.
  if (!profile.full_name) {
    showErrorToast('Your profile could not be loaded — comments are disabled.');
    return;
  }

  const { error } = await supabase.from('comments').insert({
    project_id: currentDetailProject.id,
    author_role: profile.role,
    author_label: profile.full_name,
    body,
    internal,
  });

  if (error) {
    showErrorToast('Could not post comment — please try again.');
    return;
  }

  document.getElementById('commentBody').value = '';
  document.getElementById('commentInternal').checked = true;
  await renderActivityFeed();
}

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('commentForm').addEventListener('submit', handleCommentSubmit);
});
