import { supabase } from './supabase-client.js';
import {
  formatDate, stageLabel, STAGE_COLUMNS, SUBSTATUS_LABELS, photoSelectionLabel, stageIndex,
} from './board-utils.js';
import { showErrorToast, showSuccessToast } from './board-shared.js';

let token = '';
let portalData = null;

const URL_PATTERN = /(https?:\/\/[^\s]+)/i;

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

  header.appendChild(renderNextStepBanner(project));
  header.appendChild(renderProjectTracker(project));

  const statusGrid = document.createElement('div');
  statusGrid.className = 'client-status-grid';
  statusGrid.appendChild(renderStatusTile(
    'RAW Gallery',
    project.raw_delivery_link ? 'Ready' : 'Waiting',
    project.raw_delivery_link ? 'client-status-ready' : 'client-status-waiting'
  ));
  statusGrid.appendChild(renderStatusTile(
    'Photo Selection',
    summarizePhotoSelection(),
    'client-status-ready'
  ));
  statusGrid.appendChild(renderStatusTile(
    'Songs',
    `${Math.min(portalData.songs.length, 5)} of 5 suggested`,
    portalData.songs.length > 0 ? 'client-status-ready' : 'client-status-waiting'
  ));
  header.appendChild(statusGrid);

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

function renderNextStepBanner(project) {
  const banner = document.createElement('div');
  banner.className = 'client-next-step';

  const eyebrow = document.createElement('div');
  eyebrow.className = 'client-next-step-label';
  eyebrow.textContent = 'Next Step';
  banner.appendChild(eyebrow);

  const title = document.createElement('div');
  title.className = 'client-next-step-title';
  title.textContent = nextStepCopy(project).title;
  banner.appendChild(title);

  const body = document.createElement('div');
  body.className = 'client-next-step-body';
  body.textContent = nextStepCopy(project).body;
  banner.appendChild(body);

  return banner;
}

function renderProjectTracker(project) {
  const tracker = document.createElement('div');
  tracker.className = 'client-project-tracker';
  tracker.setAttribute('aria-label', 'Project progress tracker');

  const currentIndex = Math.max(stageIndex(project.stage), 0);
  STAGE_COLUMNS.forEach((stage, index) => {
    const item = document.createElement('div');
    const state = index < currentIndex ? 'done' : index === currentIndex ? 'current' : 'waiting';
    item.className = `client-tracker-item client-tracker-${state}`;

    const marker = document.createElement('div');
    marker.className = 'client-tracker-marker';
    marker.textContent = state === 'done' ? '✓' : String(index + 1);
    item.appendChild(marker);

    const copy = document.createElement('div');
    copy.className = 'client-tracker-copy';

    const label = document.createElement('div');
    label.className = 'client-tracker-label';
    label.textContent = stage.label;
    copy.appendChild(label);

    const status = document.createElement('div');
    status.className = 'client-tracker-status';
    status.textContent = trackerStatusText(stage.key, state, project);
    copy.appendChild(status);

    item.appendChild(copy);
    tracker.appendChild(item);
  });

  return tracker;
}

function nextStepCopy(project) {
  const selected = portalData.sub_events.reduce((sum, event) => sum + (event.photo_selected_count || 0), 0);
  const songsCount = portalData.songs.length;

  if (project.stage === 'booked' || project.stage === 'shoot_completed') {
    return {
      title: 'We are preparing your delivery timeline.',
      body: 'After the event, RAW delivery and selection steps will appear here.',
    };
  }
  if (project.stage === 'raw_delivered') {
    return project.raw_delivery_link
      ? { title: 'Review your RAW gallery.', body: 'Open the RAW delivery link, then paste the photo numbers you want edited.' }
      : { title: 'RAW gallery is being prepared.', body: 'The gallery link will appear here as soon as it is ready.' };
  }
  if (project.stage === 'photo_selection') {
    if (selected === 0) {
      return { title: 'Select photos for editing.', body: 'Paste the photo numbers or filenames from the RAW gallery into the selection box.' };
    }
    return songsCount > 0
      ? { title: 'Selections received.', body: 'Your photo list and song suggestions are saved. Video editing will begin after studio review.' }
      : { title: 'Suggest songs before video editing.', body: 'Add up to 5 song links so the editor can start with the right music direction.' };
  }
  if (project.stage === 'song_finalization') {
    return songsCount > 0
      ? { title: 'Songs received for final review.', body: 'Once the music direction is confirmed, the studio will move your project into video editing.' }
      : { title: 'Suggest songs before video editing.', body: 'Add up to 5 song links so the editor can start with the exact versions.' };
  }
  if (project.stage === 'video_editing') {
    return songsCount > 0
      ? { title: 'Studio is editing your film.', body: 'Your song suggestions are saved for the editing team.' }
      : { title: 'Studio is editing your film.', body: 'Leave a note below if you still need to share music direction.' };
  }
  if (project.stage === 'final_delivery') {
    return { title: 'Final delivery is being prepared.', body: 'Your finished gallery and films will be shared here when ready.' };
  }
  if (project.stage === 'completed') {
    return { title: 'Project completed.', body: 'Your project has reached final delivery. You can still leave a note if needed.' };
  }
  return { title: 'Project is in progress.', body: 'Track each studio step here as your project moves forward.' };
}

function trackerStatusText(stageKey, state, project) {
  if (state === 'done') return 'Done';
  if (state === 'waiting') return 'Waiting';
  if (stageKey === 'raw_delivered' && project.raw_delivered_at) {
    return `Current · ${formatDate(project.raw_delivered_at)}`;
  }
  if (stageKey === 'video_editing' && project.video_editing_substatus) {
    return `Current · ${SUBSTATUS_LABELS[project.video_editing_substatus] || project.video_editing_substatus}`;
  }
  return 'Current';
}

function renderStatusTile(label, value, className) {
  const tile = document.createElement('div');
  tile.className = `client-status-tile ${className}`;
  const labelEl = document.createElement('div');
  labelEl.className = 'client-status-label';
  labelEl.textContent = label;
  tile.appendChild(labelEl);
  const valueEl = document.createElement('div');
  valueEl.className = 'client-status-value';
  valueEl.textContent = value;
  tile.appendChild(valueEl);
  return tile;
}

function summarizePhotoSelection() {
  const selected = portalData.sub_events.reduce((sum, event) => sum + (event.photo_selected_count || 0), 0);
  const total = portalData.sub_events.reduce((sum, event) => sum + (event.photo_total_count || 0), 0);
  if (selected === 0) return 'Not started';
  return total > 0 ? `${selected} of ${total} selected` : `${selected} selected`;
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

    const form = document.createElement('form');
    form.className = 'client-photo-form client-photo-list-form';
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      await updatePhotoSelection(event, input.value, submitBtn);
    });

    const input = document.createElement('textarea');
    input.className = 'form-input client-photo-list-input';
    input.rows = 4;
    input.placeholder = 'Paste photo numbers: 0012, 0019, DSC_0244, IMG_1050';
    form.appendChild(input);

    const total = document.createElement('span');
    total.className = 'client-count-total';
    total.textContent = event.photo_total_count > 0
      ? `${event.photo_selected_count || 0} / ${event.photo_total_count} selected`
      : `${event.photo_selected_count || 0} selected`;
    form.appendChild(total);

    const liveCount = document.createElement('div');
    liveCount.className = 'client-live-count';
    liveCount.textContent = '0 photos in this list';
    input.addEventListener('input', () => {
      const count = parsePhotoNumbers(input.value).length;
      liveCount.textContent = count === 1 ? '1 photo in this list' : `${count} photos in this list`;
    });
    form.appendChild(liveCount);

    const submitBtn = document.createElement('button');
    submitBtn.className = 'btn-comment-post';
    submitBtn.type = 'submit';
    submitBtn.textContent = 'Submit Selection';
    form.appendChild(submitBtn);

    row.appendChild(form);

    container.appendChild(row);
  });

  renderSongSubEventOptions();
}

function parsePhotoNumbers(value) {
  return Array.from(new Set(value
    .split(/[\s,;]+/)
    .map(item => item.trim())
    .filter(Boolean)));
}

async function updatePhotoSelection(event, value, button) {
  const photoNumbers = parsePhotoNumbers(value);
  const selectedCount = photoNumbers.length;
  if (selectedCount === 0) {
    showErrorToast('Paste at least one photo number.');
    return;
  }
  if (event.photo_total_count > 0 && selectedCount > event.photo_total_count) {
    showErrorToast(`Please choose no more than ${event.photo_total_count} photos.`);
    return;
  }

  button.disabled = true;
  if (event.photo_total_count > 0) {
    const { error } = await supabase.rpc('update_photo_selection', {
      p_token: token,
      p_sub_event_id: event.id,
      p_selected_count: selectedCount,
    });

    if (error) {
      button.disabled = false;
      showErrorToast('Could not update photo selection — please try again.');
      return;
    }
  }

  const note = [
    `Photo selections for ${event.name}:`,
    photoNumbers.join(', '),
  ].join('\n');
  const { error: commentError } = await supabase.rpc('post_client_comment', {
    p_token: token,
    p_body: note,
  });
  button.disabled = false;

  if (commentError) {
    showErrorToast('Photo count saved, but the number list could not be posted.');
    await fetchProject();
    return;
  }
  await fetchProject();
  showSuccessToast('Photo list submitted.');
}

function renderSongSubEventOptions() {
  const selects = document.querySelectorAll('.song-sub-event-select');
  selects.forEach(select => {
    select.innerHTML = '';

    const general = document.createElement('option');
    general.value = '';
    general.textContent = 'General';
    select.appendChild(general);

    portalData.sub_events.forEach(event => {
      const option = document.createElement('option');
      option.value = event.id;
      option.textContent = event.name;
      select.appendChild(option);
    });
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

    renderSongText(row, song);

    const status = document.createElement('div');
    status.className = 'client-muted';
    status.textContent = song.license_confirmed ? 'License confirmed' : 'License pending';
    row.appendChild(status);

    container.appendChild(row);
  });
}

function splitSongArtistAndUrl(artistValue) {
  const artist = artistValue || '';
  const urlMatch = artist.match(URL_PATTERN);
  const url = urlMatch ? urlMatch[1] : '';
  return {
    artist: artist.replace(URL_PATTERN, '').replace(/^YouTube:\s*/im, '').trim(),
    url,
  };
}

function renderSongText(row, song) {
  const { artist, url } = splitSongArtistAndUrl(song.artist);
  const title = document.createElement('div');
  title.className = 'song-title';
  title.textContent = artist ? `${song.title} — ${artist}` : song.title;
  row.appendChild(title);

  if (url) {
    const link = document.createElement('a');
    link.className = 'song-reference-link';
    link.href = url;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.textContent = 'Open song reference';
    row.appendChild(link);
  }
}

async function handleSongSubmit(e) {
  e.preventDefault();
  const submitBtn = document.querySelector('#songForm button[type="submit"]');
  const slotData = getFilledSongSlots();
  if (slotData.length === 0) {
    showErrorToast('Add at least one song title.');
    return;
  }

  submitBtn.disabled = true;
  for (const song of slotData) {
    const { error } = await supabase.rpc('submit_song', {
      p_token: token,
      p_sub_event_id: song.subEventId || null,
      p_title: song.title,
      p_artist: song.artistPayload,
    });
    if (error) {
      submitBtn.disabled = false;
      showErrorToast('Could not add one of the songs — please try again.');
      return;
    }
  }
  submitBtn.disabled = false;

  document.querySelectorAll('.client-song-slot input').forEach(input => { input.value = ''; });
  updateSongSlotNote();
  await fetchProject();
  showSuccessToast('Song suggestions submitted.');
}

function getFilledSongSlots() {
  return Array.from(document.querySelectorAll('.client-song-slot'))
    .map(slot => {
      const title = slot.querySelector('.song-title-input').value.trim();
      const artist = slot.querySelector('.song-artist-input').value.trim();
      const songUrl = slot.querySelector('.song-url-input').value.trim();
      return {
        subEventId: slot.querySelector('.song-sub-event-select').value,
        title,
        artistPayload: [artist, songUrl ? `YouTube: ${songUrl}` : ''].filter(Boolean).join('\n') || null,
      };
    })
    .filter(song => song.title);
}

function updateSongSlotNote() {
  const count = getFilledSongSlots().length;
  document.getElementById('songSlotNote').textContent = `${count} of 5 slots filled`;
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
  showSuccessToast('Comment posted.');
}

document.addEventListener('DOMContentLoaded', async () => {
  token = getTokenFromLocation();
  document.getElementById('songForm').addEventListener('submit', handleSongSubmit);
  document.getElementById('clientCommentForm').addEventListener('submit', handleCommentSubmit);
  document.getElementById('songSlots').addEventListener('input', updateSongSlotNote);

  if (!token) {
    renderInvalidToken();
    return;
  }

  await fetchProject();
});
