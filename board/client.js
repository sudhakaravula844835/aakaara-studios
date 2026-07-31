import { supabase } from './supabase-client.js';
import {
  formatDate, stageLabel, SUBSTATUS_LABELS, photoSelectionLabel,
} from './board-utils.js';
import { showErrorToast } from './board-shared.js';

let token = '';
let portalData = null;

function getTokenFromLocation() {
  const url = new URL(window.location.href);
  const queryToken = url.searchParams.get('token');
  if (queryToken) return queryToken;

  const hashToken = window.location.hash.replace(/^#/, '').trim();
  if (hashToken) return hashToken;

  const parts = window.location.pathname.split('/').filter(Boolean);
  const clientIndex = parts.indexOf('client');
  return clientIndex !== -1 ? (parts[clientIndex + 1] || '') : '';
}

async function fetchProject() {
  const { data, error } = await supabase.rpc('get_project_by_token', { p_token: token });
  if (error) {
    renderInvalidToken();
    return;
  }
  portalData = data;
  renderPortal();
}

function renderInvalidToken() {
  document.getElementById('clientProjectHeader').innerHTML = `
    <div class="client-muted">This project link is invalid or has been revoked.</div>
  `;
  document.getElementById('clientSubEvents').innerHTML = '';
  document.getElementById('clientSongsList').innerHTML = '';
  document.getElementById('clientComments').innerHTML = '';
  document.getElementById('songForm').hidden = true;
  document.getElementById('clientCommentForm').hidden = true;
}

function renderPortal() {
  renderHeader();
  renderSubEvents();
  renderSongs();
  renderComments();
}

function renderHeader() {
  const { project } = portalData;
  const header = document.getElementById('clientProjectHeader');
  header.innerHTML = '';

  const name = document.createElement('div');
  name.className = 'client-project-name';
  name.textContent = project.client_name;
  header.appendChild(name);

  const meta = document.createElement('div');
  meta.className = 'client-project-meta';
  const pieces = [stageLabel(project.stage)];
  if (project.stage === 'video_editing' && project.video_editing_substatus) {
    pieces.push(SUBSTATUS_LABELS[project.video_editing_substatus] || project.video_editing_substatus);
  }
  meta.textContent = pieces.join(' · ');
  header.appendChild(meta);

  if (project.raw_delivery_link) {
    const link = document.createElement('a');
    link.className = 'client-raw-link';
    link.href = project.raw_delivery_link;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.textContent = 'Open RAW Delivery';
    header.appendChild(link);
  }
}

function renderSubEvents() {
  const container = document.getElementById('clientSubEvents');
  container.innerHTML = '';

  if (portalData.sub_events.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'timeline-empty';
    empty.textContent = 'No sub-events yet.';
    container.appendChild(empty);
    return;
  }

  portalData.sub_events.forEach(event => {
    const row = document.createElement('div');
    row.className = 'client-sub-event-row';

    const summary = document.createElement('div');
    summary.className = 'client-sub-event-summary';

    const name = document.createElement('div');
    name.className = 'timeline-name';
    name.textContent = event.name;
    summary.appendChild(name);

    const meta = document.createElement('div');
    meta.className = 'timeline-meta';
    meta.textContent = [formatDate(event.event_date), event.venue].filter(Boolean).join(' · ');
    summary.appendChild(meta);

    const selection = photoSelectionLabel(event.photo_selected_count, event.photo_total_count);
    if (selection) {
      const label = document.createElement('div');
      label.className = 'timeline-selection';
      label.textContent = selection;
      summary.appendChild(label);
    }

    row.appendChild(summary);

    if (event.photo_total_count > 0) {
      const form = document.createElement('form');
      form.className = 'client-photo-form';
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        await updatePhotoSelection(event.id, input.value, submitBtn);
      });

      const input = document.createElement('input');
      input.className = 'form-input client-count-input';
      input.type = 'number';
      input.min = '0';
      input.max = String(event.photo_total_count);
      input.value = String(event.photo_selected_count || 0);
      form.appendChild(input);

      const total = document.createElement('span');
      total.className = 'client-count-total';
      total.textContent = `/ ${event.photo_total_count}`;
      form.appendChild(total);

      const submitBtn = document.createElement('button');
      submitBtn.className = 'btn-comment-post';
      submitBtn.type = 'submit';
      submitBtn.textContent = 'Update';
      form.appendChild(submitBtn);

      row.appendChild(form);
    }

    container.appendChild(row);
  });

  renderSongSubEventOptions();
}

async function updatePhotoSelection(subEventId, value, button) {
  const selectedCount = Number(value);
  button.disabled = true;
  const { error } = await supabase.rpc('update_photo_selection', {
    p_token: token,
    p_sub_event_id: subEventId,
    p_selected_count: selectedCount,
  });
  button.disabled = false;

  if (error) {
    showErrorToast('Could not update photo selection — please try again.');
    return;
  }
  await fetchProject();
}

function renderSongSubEventOptions() {
  const select = document.getElementById('songSubEvent');
  select.innerHTML = '';

  const general = document.createElement('option');
  general.value = '';
  general.textContent = 'General song';
  select.appendChild(general);

  portalData.sub_events.forEach(event => {
    const option = document.createElement('option');
    option.value = event.id;
    option.textContent = event.name;
    select.appendChild(option);
  });
}

function renderSongs() {
  const container = document.getElementById('clientSongsList');
  container.innerHTML = '';

  if (portalData.songs.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'timeline-empty';
    empty.textContent = 'No songs yet.';
    container.appendChild(empty);
    return;
  }

  portalData.songs.forEach(song => {
    const row = document.createElement('div');
    row.className = 'song-row';

    const title = document.createElement('div');
    title.className = 'song-title';
    title.textContent = song.artist ? `${song.title} — ${song.artist}` : song.title;
    row.appendChild(title);

    const status = document.createElement('div');
    status.className = 'client-muted';
    status.textContent = song.license_confirmed ? 'License confirmed' : 'License pending';
    row.appendChild(status);

    container.appendChild(row);
  });
}

async function handleSongSubmit(e) {
  e.preventDefault();
  const titleInput = document.getElementById('songTitle');
  const artistInput = document.getElementById('songArtist');
  const submitBtn = document.querySelector('#songForm button[type="submit"]');
  const title = titleInput.value.trim();
  if (!title) return;

  submitBtn.disabled = true;
  const { error } = await supabase.rpc('submit_song', {
    p_token: token,
    p_sub_event_id: document.getElementById('songSubEvent').value || null,
    p_title: title,
    p_artist: artistInput.value.trim() || null,
  });
  submitBtn.disabled = false;

  if (error) {
    showErrorToast('Could not add song — please try again.');
    return;
  }

  titleInput.value = '';
  artistInput.value = '';
  await fetchProject();
}

function renderComments() {
  const container = document.getElementById('clientComments');
  container.innerHTML = '';

  if (portalData.comments.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'feed-empty';
    empty.textContent = 'No comments yet.';
    container.appendChild(empty);
    return;
  }

  portalData.comments.forEach(comment => {
    const row = document.createElement('div');
    row.className = 'feed-row feed-row-comment';

    const avatar = document.createElement('div');
    avatar.className = 'feed-avatar';
    avatar.textContent = (comment.author_label || '?').charAt(0).toUpperCase();
    row.appendChild(avatar);

    const content = document.createElement('div');
    content.className = 'feed-content';

    const author = document.createElement('div');
    author.className = 'feed-author-name';
    author.textContent = comment.author_label || '?';
    content.appendChild(author);

    const body = document.createElement('div');
    body.className = 'feed-body';
    body.textContent = comment.body;
    content.appendChild(body);

    row.appendChild(content);
    container.appendChild(row);
  });
}

async function handleCommentSubmit(e) {
  e.preventDefault();
  const bodyInput = document.getElementById('clientCommentBody');
  const body = bodyInput.value.trim();
  if (!body) return;

  const submitBtn = document.querySelector('#clientCommentForm button[type="submit"]');
  submitBtn.disabled = true;
  const { error } = await supabase.rpc('post_client_comment', {
    p_token: token,
    p_body: body,
  });
  submitBtn.disabled = false;

  if (error) {
    showErrorToast('Could not post comment — please try again.');
    return;
  }

  bodyInput.value = '';
  await fetchProject();
}

document.addEventListener('DOMContentLoaded', async () => {
  token = getTokenFromLocation();
  document.getElementById('songForm').addEventListener('submit', handleSongSubmit);
  document.getElementById('clientCommentForm').addEventListener('submit', handleCommentSubmit);

  if (!token) {
    renderInvalidToken();
    return;
  }

  await fetchProject();
});
