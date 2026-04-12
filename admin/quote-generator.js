const APP_SETTINGS = {
  accessCode: 'aakaara2026',
  draftStorageKey: 'aakaaraQuoteDraft:v2',
  loginSessionKey: 'aakaaraQuoteGeneratorUnlocked:v1',
  dashboardStorageKey: 'aakaaraQuotes',
  draftSaveDelay: 240
};

const DEFAULT_IMPORT_MESSAGE = 'Dates, hours, and repeated-day events will be grouped automatically.';

const DEFAULT_FIELD_VALUES = {
  quickImportText: '',
  clientName: '',
  clientEmail: '',
  eventType: 'Wedding Photography',
  location: '',
  pricingModel: 'hourly',
  hourlyRate: '300',
  flatRate: '',
  travelType: 'separate',
  travelAmount: '',
  standardRate: '',
  editedCount: '200',
  timeline: '6-8 weeks',
  customNotes: '',
  deposit: '50% deposit required to secure dates',
  validity: '30 days',
  extraNotes: ''
};

const DEFAULT_CHECKBOX_VALUES = {
  showIntro: false,
  delEdited: true,
  delRaw: true,
  delGallery: true,
  delSneakPeek: false,
  delTeaser: false,
  delDoc: false,
  delTraditional: false,
  delHighlight: false,
  delDrone: false,
  delLive: false,
  delSecondShooter: false
};

const DRAFT_VALUE_FIELD_IDS = [
  'quickImportText',
  'clientName',
  'clientEmail',
  'eventType',
  'location',
  'quoteDate',
  'pricingModel',
  'hourlyRate',
  'flatRate',
  'travelType',
  'travelAmount',
  'standardRate',
  'editedCount',
  'timeline',
  'customNotes',
  'deposit',
  'validity',
  'extraNotes'
];

const DRAFT_CHECKBOX_FIELD_IDS = Object.keys(DEFAULT_CHECKBOX_VALUES);

const MONTH_LOOKUP = {
  jan: 0,
  january: 0,
  feb: 1,
  february: 1,
  mar: 2,
  march: 2,
  apr: 3,
  april: 3,
  may: 4,
  jun: 5,
  june: 5,
  jul: 6,
  july: 6,
  aug: 7,
  august: 7,
  sep: 8,
  sept: 8,
  september: 8,
  oct: 9,
  october: 9,
  nov: 10,
  november: 10,
  dec: 11,
  december: 11
};

const $ = id => document.getElementById(id);

let dayCount = 0;
let draftSaveTimer = null;
let isApplyingDraft = false;
let previewObjectUrl = null;
let toastTimer = null;

function readStorage(storage, key) {
  try {
    return storage.getItem(key);
  } catch (error) {
    console.error(`Failed reading storage key "${key}"`, error);
    return null;
  }
}

function writeStorage(storage, key, value) {
  try {
    storage.setItem(key, value);
    return true;
  } catch (error) {
    console.error(`Failed writing storage key "${key}"`, error);
    return false;
  }
}

function removeStorage(storage, key) {
  try {
    storage.removeItem(key);
    return true;
  } catch (error) {
    console.error(`Failed removing storage key "${key}"`, error);
    return false;
  }
}

function updateDraftIndicator(message, tone = 'muted') {
  const indicator = $('draftIndicator');
  if (!indicator) return;
  indicator.textContent = message;
  indicator.dataset.tone = tone;
}

function updateImportStatus(message, tone = 'muted') {
  const status = $('importStatus');
  if (!status) return;
  status.textContent = message;
  status.style.color = tone === 'success'
    ? 'var(--gold-light)'
    : tone === 'error'
      ? 'var(--red)'
      : 'var(--warm-grey)';
}

function showToast(message) {
  const toast = $('toast');
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), 3000);
}

function showApp({ persistSession = true } = {}) {
  $('loginScreen').classList.add('hidden');
  $('app').classList.add('visible');
  if (persistSession) {
    writeStorage(sessionStorage, APP_SETTINGS.loginSessionKey, '1');
  }
}

function doLogin() {
  const password = $('loginPass').value;
  if (password === APP_SETTINGS.accessCode) {
    $('loginError').classList.remove('show');
    showApp();
  } else {
    $('loginError').classList.add('show');
    setTimeout(() => $('loginError').classList.remove('show'), 2000);
  }
}

function initializeLogin() {
  if (readStorage(sessionStorage, APP_SETTINGS.loginSessionKey) === '1') {
    showApp({ persistSession: false });
  }

  $('loginPass').addEventListener('keydown', event => {
    if (event.key === 'Enter') {
      event.preventDefault();
      doLogin();
    }
  });

  $('loginPass').addEventListener('input', () => {
    $('loginError').classList.remove('show');
  });
}

function titleCaseWords(value) {
  return value.replace(/\b([a-z])/gi, match => match.toUpperCase());
}

function cleanupEventName(value) {
  return value
    .replace(/\s+/g, ' ')
    .replace(/\s+,/g, ',')
    .trim()
    .replace(/^[,\-:;]+|[,\-:;]+$/g, '')
    .trim();
}

function formatDurationText(hours) {
  const numeric = Number(hours);
  if (!Number.isFinite(numeric) || numeric <= 0) return '';
  return `${numeric} ${numeric === 1 ? 'Hour' : 'Hours'}`;
}

function inferEventDate(monthIndex, dayNumber, parserState) {
  const today = new Date();
  const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  let year = todayStart.getFullYear();

  if (parserState.lastDate) {
    year = parserState.lastDate.getFullYear();
    const candidate = new Date(year, monthIndex, dayNumber);
    if (candidate < parserState.lastDate && monthIndex < parserState.lastDate.getMonth()) {
      year += 1;
    }
  } else {
    const candidate = new Date(year, monthIndex, dayNumber);
    if (candidate < todayStart) year += 1;
  }

  return new Date(year, monthIndex, dayNumber);
}

function parseEventLine(line, parserState) {
  const cleanedLine = line.replace(/^[\s\-*•]+/, '').trim();
  const dateMatch = cleanedLine.match(/^(?:(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t)?(?:ember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s*)?(\d{1,2})(?:st|nd|rd|th)?\b[\s,.-]*(.+)$/i);
  if (!dateMatch) return null;

  const monthToken = dateMatch[1] ? dateMatch[1].toLowerCase() : '';
  const resolvedMonth = monthToken ? MONTH_LOOKUP[monthToken] : parserState.currentMonth;
  if (resolvedMonth === undefined || resolvedMonth === null) return null;

  const dayNumber = parseInt(dateMatch[2], 10);
  if (!Number.isFinite(dayNumber)) return null;

  const eventDate = inferEventDate(resolvedMonth, dayNumber, parserState);
  parserState.currentMonth = resolvedMonth;
  parserState.lastDate = eventDate;

  const hoursMatch = cleanedLine.match(/\(\s*(\d+(?:\.\d+)?)\s*(?:hours?|hrs?)?\s*\)/i)
    || cleanedLine.match(/\b(\d+(?:\.\d+)?)\s*(?:hours?|hrs?)\b/i);
  const hoursValue = hoursMatch ? parseFloat(hoursMatch[1]) : 0;

  let name = dateMatch[3];
  if (hoursMatch) {
    name = name.replace(hoursMatch[0], '');
  }
  name = cleanupEventName(titleCaseWords(name));
  if (!name) return null;

  return {
    date: eventDate.toISOString().split('T')[0],
    hours: Number.isFinite(hoursValue) ? hoursValue : 0,
    eventName: name,
    duration: formatDurationText(hoursValue)
  };
}

function detectImportedEventType(days) {
  const combined = days.flatMap(day => day.events.map(event => event.name.toLowerCase())).join(' ');
  if (/(wedding|sangeet|haldi|mehendi|mehndi|baraat|reception|pelli?|kuthuru|koduku|marriage)/.test(combined)) return 'Wedding Photography';
  if (/engagement/.test(combined)) return 'Engagement Photography';
  if (/birthday/.test(combined)) return 'Birthday Photography';
  if (/baby shower/.test(combined)) return 'Baby Shower Photography';
  if (/gender reveal/.test(combined)) return 'Gender Reveal Photography';
  if (/house warming|housewarming/.test(combined)) return 'House Warming Photography';
  return 'Event Photography';
}

function parseBrief(text) {
  const lines = text
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean);

  const parserState = { currentMonth: null, lastDate: null };
  const daysByDate = new Map();
  let clientEmail = '';
  let clientName = '';
  let location = '';

  lines.forEach(line => {
    if (!clientEmail && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(line)) {
      clientEmail = line;
      return;
    }

    const parsedEvent = parseEventLine(line, parserState);
    if (parsedEvent) {
      if (!daysByDate.has(parsedEvent.date)) {
        daysByDate.set(parsedEvent.date, {
          date: parsedEvent.date,
          totalHours: 0,
          events: []
        });
      }

      const day = daysByDate.get(parsedEvent.date);
      day.events.push({
        name: parsedEvent.eventName,
        dur: parsedEvent.duration,
        notes: ''
      });
      day.totalHours += parsedEvent.hours;
      return;
    }

    if (!location && line.includes(',') && !/\d/.test(line)) {
      location = line.replace(/\s+,/g, ',').replace(/\s+/g, ' ').trim();
      return;
    }

    if (!clientName && !line.includes('@')) {
      clientName = titleCaseWords(line);
    }
  });

  const days = Array.from(daysByDate.values()).sort((a, b) => a.date.localeCompare(b.date));
  return {
    clientEmail,
    clientName,
    location,
    days,
    eventType: days.length ? detectImportedEventType(days) : ''
  };
}

function collectDayData() {
  return Array.from(document.querySelectorAll('#daysContainer .day-block')).map(block => ({
    date: block.querySelector('[data-field="date"]')?.value || '',
    hours: block.querySelector('[data-field="hours"]')?.value || '',
    events: Array.from(block.querySelectorAll('.event-item')).map(eventItem => ({
      name: eventItem.querySelector('[data-field="eventName"]')?.value || '',
      dur: eventItem.querySelector('[data-field="eventDuration"]')?.value || '',
      notes: eventItem.querySelector('[data-field="eventNotes"]')?.value || ''
    }))
  }));
}

function collectDraftState() {
  const values = {};
  DRAFT_VALUE_FIELD_IDS.forEach(id => {
    const field = $(id);
    if (field) values[id] = field.value;
  });

  const checks = {};
  DRAFT_CHECKBOX_FIELD_IDS.forEach(id => {
    const field = $(id);
    if (field) checks[id] = field.checked;
  });

  return {
    version: 2,
    savedAt: new Date().toISOString(),
    values,
    checks,
    days: collectDayData()
  };
}

function formatSavedTimestamp(isoString) {
  const savedAt = new Date(isoString);
  if (Number.isNaN(savedAt.getTime())) return 'Draft saved';
  return `Draft saved at ${savedAt.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`;
}

function saveDraftNow({ silent = false } = {}) {
  if (isApplyingDraft) return;
  clearTimeout(draftSaveTimer);

  const snapshot = collectDraftState();
  const didSave = writeStorage(localStorage, APP_SETTINGS.draftStorageKey, JSON.stringify(snapshot));
  if (didSave) {
    updateDraftIndicator(formatSavedTimestamp(snapshot.savedAt), 'saved');
  } else if (!silent) {
    updateDraftIndicator('Draft could not be saved', 'error');
  }
}

function scheduleDraftSave() {
  if (isApplyingDraft) return;
  updateDraftIndicator('Saving draft...', 'saving');
  clearTimeout(draftSaveTimer);
  draftSaveTimer = setTimeout(() => saveDraftNow({ silent: true }), APP_SETTINGS.draftSaveDelay);
}

function clearDraft() {
  clearTimeout(draftSaveTimer);
  removeStorage(localStorage, APP_SETTINGS.draftStorageKey);
  updateDraftIndicator('Local draft ready', 'muted');
}

function applyDefaultFieldState() {
  Object.entries(DEFAULT_FIELD_VALUES).forEach(([id, value]) => {
    const field = $(id);
    if (field) field.value = value;
  });

  const quoteDateInput = $('quoteDate');
  if (quoteDateInput) quoteDateInput.valueAsDate = new Date();

  Object.entries(DEFAULT_CHECKBOX_VALUES).forEach(([id, checked]) => {
    const field = $(id);
    if (field) field.checked = checked;
  });

  updateImportStatus(DEFAULT_IMPORT_MESSAGE);
}

function addEvent(dayNum, eventData = null) {
  const container = $(`events-${dayNum}`);
  if (!container) return;

  const item = document.createElement('div');
  item.className = 'event-item';
  item.innerHTML = `
    <div class="form-group">
      <label class="form-label">Event Name</label>
      <input class="form-input" data-field="eventName" placeholder="e.g. Wedding Ceremony">
    </div>
    <div class="form-group">
      <label class="form-label">Duration</label>
      <input class="form-input" data-field="eventDuration" placeholder="e.g. 2 Hours">
    </div>
    <div class="form-group">
      <label class="form-label">Notes</label>
      <input class="form-input" data-field="eventNotes" placeholder="e.g. Candid & traditional">
    </div>
    <button type="button" class="event-remove" onclick="removeEvent(this)">&times;</button>
  `;

  container.appendChild(item);

  if (eventData) {
    item.querySelector('[data-field="eventName"]').value = eventData.name || '';
    item.querySelector('[data-field="eventDuration"]').value = eventData.dur || '';
    item.querySelector('[data-field="eventNotes"]').value = eventData.notes || '';
  }

  if (!isApplyingDraft) scheduleDraftSave();
}

function addDay(dayData = null) {
  dayCount += 1;
  const dayNum = dayCount;

  const block = document.createElement('div');
  block.className = 'day-block';
  block.id = `day-${dayNum}`;
  block.innerHTML = `
    <div class="day-header">
      <div class="day-title">Day ${dayNum}</div>
      <button type="button" class="day-remove" onclick="removeDay(${dayNum})">Remove</button>
    </div>
    <div class="form-row">
      <div class="form-group">
        <label class="form-label">Date</label>
        <input class="form-input" type="date" data-field="date">
      </div>
      <div class="form-group">
        <label class="form-label">Total Hours</label>
        <input class="form-input" type="number" data-field="hours" placeholder="e.g. 4">
      </div>
    </div>
    <div class="events-list" id="events-${dayNum}"></div>
    <button type="button" class="add-btn" onclick="addEvent(${dayNum})" style="margin-top:0.5rem;">+ Add Event to Day ${dayNum}</button>
  `;

  $('daysContainer').appendChild(block);

  if (dayData) {
    block.querySelector('[data-field="date"]').value = dayData.date || '';
    block.querySelector('[data-field="hours"]').value = dayData.hours ?? dayData.totalHours ?? '';

    const events = Array.isArray(dayData.events) && dayData.events.length
      ? dayData.events
      : [{ name: '', dur: '', notes: '' }];
    events.forEach(event => addEvent(dayNum, event));
  } else {
    addEvent(dayNum);
  }

  recalcTotal();
  if (!isApplyingDraft) scheduleDraftSave();
}

function removeEvent(button) {
  const eventItem = button.closest('.event-item');
  const list = eventItem?.parentElement;
  eventItem?.remove();

  if (list && !list.children.length) {
    const dayNum = Number(list.id.replace('events-', ''));
    addEvent(dayNum);
  }

  scheduleDraftSave();
}

function renumberDays() {
  const blocks = document.querySelectorAll('#daysContainer .day-block');
  blocks.forEach((block, index) => {
    const dayNum = index + 1;
    block.id = `day-${dayNum}`;
    block.querySelector('.day-title').textContent = `Day ${dayNum}`;

    const removeButton = block.querySelector('.day-remove');
    removeButton.setAttribute('onclick', `removeDay(${dayNum})`);

    const eventsList = block.querySelector('.events-list');
    eventsList.id = `events-${dayNum}`;

    const addButton = block.querySelector('.add-btn');
    addButton.setAttribute('onclick', `addEvent(${dayNum})`);
    addButton.textContent = `+ Add Event to Day ${dayNum}`;
  });

  dayCount = blocks.length;
}

function removeDay(dayNum) {
  const block = $(`day-${dayNum}`);
  if (block) block.remove();
  renumberDays();

  if (!document.querySelector('#daysContainer .day-block')) {
    addDay();
  }

  recalcTotal();
  scheduleDraftSave();
}

function populateImportedDays(days) {
  const previousApplyingState = isApplyingDraft;
  isApplyingDraft = true;
  $('daysContainer').innerHTML = '';
  dayCount = 0;

  if (days.length) {
    days.forEach(day => addDay(day));
  } else {
    addDay();
  }

  isApplyingDraft = previousApplyingState;
}

function importBrief() {
  const text = $('quickImportText')?.value.trim() || '';
  if (!text) {
    updateImportStatus('Paste event notes first, then import.', 'error');
    showToast('Paste details to import');
    return;
  }

  const parsed = parseBrief(text);
  if (!parsed.days.length && !parsed.clientEmail && !parsed.location && !parsed.clientName) {
    updateImportStatus('Nothing usable was found in that note. Check the date lines and try again.', 'error');
    showToast('Could not parse that brief');
    return;
  }

  if (parsed.clientName && !$('clientName').value.trim()) $('clientName').value = parsed.clientName;
  if (parsed.clientEmail) $('clientEmail').value = parsed.clientEmail;
  if (parsed.location) $('location').value = parsed.location;
  if (parsed.eventType) $('eventType').value = parsed.eventType;
  if (parsed.days.length) populateImportedDays(parsed.days);

  updatePricingUI();
  recalcTotal();
  saveDraftNow({ silent: true });

  const totalHours = parsed.days.reduce((sum, day) => sum + day.totalHours, 0);
  const detailBits = [];
  if (parsed.days.length) detailBits.push(`${parsed.days.length} day${parsed.days.length === 1 ? '' : 's'}`);
  if (totalHours) detailBits.push(`${totalHours} total hour${totalHours === 1 ? '' : 's'}`);
  if (parsed.clientEmail) detailBits.push('email filled');
  if (parsed.location) detailBits.push('location filled');

  updateImportStatus(`Imported ${detailBits.join(' • ')}. Review the client name before sending.`, 'success');
  showToast('Brief imported');
}

function loadBriefFromQuery() {
  const params = new URLSearchParams(window.location.search);
  const brief = params.get('brief');
  if (!brief || !$('quickImportText')) return false;

  $('quickImportText').value = brief;
  importBrief();
  return true;
}

function applyDraftState(snapshot) {
  if (!snapshot || typeof snapshot !== 'object') return false;

  isApplyingDraft = true;
  applyDefaultFieldState();

  DRAFT_VALUE_FIELD_IDS.forEach(id => {
    const field = $(id);
    if (field && snapshot.values && snapshot.values[id] !== undefined) {
      field.value = snapshot.values[id];
    }
  });

  DRAFT_CHECKBOX_FIELD_IDS.forEach(id => {
    const field = $(id);
    if (field) {
      field.checked = snapshot.checks && snapshot.checks[id] !== undefined
        ? Boolean(snapshot.checks[id])
        : DEFAULT_CHECKBOX_VALUES[id];
    }
  });

  $('daysContainer').innerHTML = '';
  dayCount = 0;
  const savedDays = Array.isArray(snapshot.days) && snapshot.days.length ? snapshot.days : [{}];
  savedDays.forEach(day => addDay(day));

  updatePricingUI();
  recalcTotal();
  updateImportStatus('Draft restored. Review your details and continue.', 'success');
  updateDraftIndicator(snapshot.savedAt ? formatSavedTimestamp(snapshot.savedAt) : 'Draft restored', 'saved');
  isApplyingDraft = false;
  return true;
}

function loadDraftFromStorage() {
  const rawDraft = readStorage(localStorage, APP_SETTINGS.draftStorageKey);
  if (!rawDraft) return false;

  try {
    const snapshot = JSON.parse(rawDraft);
    const restored = applyDraftState(snapshot);
    if (restored) {
      showToast('Draft restored');
      return true;
    }
  } catch (error) {
    console.error('Failed to parse saved draft', error);
  }

  return false;
}

function formatDate(dateString) {
  if (!dateString) return 'TBD';
  const date = new Date(`${dateString}T00:00:00`);
  if (Number.isNaN(date.getTime())) return 'TBD';
  return date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

function formatQuoteDate(dateString) {
  return formatDate(dateString);
}

function formatCurrency(amount) {
  return `$${Number(amount || 0).toLocaleString()}`;
}

function getCoverageDateLabel(days) {
  const validDates = days.map(day => day.date).filter(Boolean).sort();
  if (!validDates.length) return 'Date to be finalized';
  if (validDates.length === 1) return formatDate(validDates[0]);
  return `${formatDate(validDates[0])} — ${formatDate(validDates[validDates.length - 1])}`;
}

function calculatePricingSummary(days = collectDayData()) {
  const model = $('pricingModel').value;
  const hourlyRate = parseFloat($('hourlyRate').value) || 0;
  const flatRate = parseFloat($('flatRate').value) || 0;
  const travelType = $('travelType').value;
  const travelAmount = parseFloat($('travelAmount').value) || 0;

  let totalHours = 0;
  let baseTotal = 0;
  const dayBreakdown = [];

  if (model === 'hourly') {
    days.forEach((day, index) => {
      const hours = parseFloat(day.hours) || 0;
      totalHours += hours;
      const amount = hours * hourlyRate;
      baseTotal += amount;
      dayBreakdown.push({
        label: day.date ? formatDate(day.date) : `Day ${index + 1}`,
        hours,
        amount
      });
    });
  } else {
    baseTotal = flatRate;
  }

  const total = baseTotal + (travelType === 'fixed' ? travelAmount : 0);
  return {
    model,
    hourlyRate,
    flatRate,
    travelType,
    travelAmount,
    totalHours,
    baseTotal,
    total,
    dayBreakdown
  };
}

function recalcTotal() {
  const summary = calculatePricingSummary();
  let previewHtml = '';

  if (summary.model === 'hourly') {
    summary.dayBreakdown.forEach(day => {
      if (day.hours > 0) {
        previewHtml += `<div class="preview-row"><span class="label">${day.label}: ${day.hours} hrs × ${formatCurrency(summary.hourlyRate)}</span><span class="value">${formatCurrency(day.amount)}</span></div>`;
      }
    });
    previewHtml += `<div class="preview-row total"><span class="label">Base Total (${summary.totalHours} hours)</span><span class="value">${formatCurrency(summary.baseTotal)}</span></div>`;
  } else {
    previewHtml += `<div class="preview-row total"><span class="label">Package Price</span><span class="value">${formatCurrency(summary.baseTotal)}</span></div>`;
  }

  if (summary.travelType === 'fixed') {
    previewHtml += `<div class="preview-row"><span class="label">Travel & Accommodation</span><span class="value">${formatCurrency(summary.travelAmount)}</span></div>`;
  } else if (summary.travelType === 'separate') {
    previewHtml += '<div class="preview-row"><span class="label">Travel & Accommodation</span><span class="value" style="color:var(--warm-grey)">Separate</span></div>';
  } else if (summary.travelType === 'included') {
    previewHtml += '<div class="preview-row"><span class="label">Travel & Accommodation</span><span class="value" style="color:var(--gold)">Included</span></div>';
  }

  $('pricingPreview').innerHTML = previewHtml;
  $('totalDisplay').textContent = formatCurrency(summary.total);
}

function updatePricingUI() {
  const model = $('pricingModel').value;
  $('hourlyRateGroup').style.display = model === 'hourly' ? '' : 'none';
  $('flatRateGroup').style.display = model === 'flat' ? '' : 'none';
  $('standardRateGroup').style.display = $('showIntro').checked ? '' : 'none';
  $('travelFixedRow').style.display = $('travelType').value === 'fixed' ? '' : 'none';
  recalcTotal();
}

function resetForm({ confirmReset = true } = {}) {
  if (confirmReset && !window.confirm('Start a new quote? Current data will be cleared.')) return;

  const previousApplyingState = isApplyingDraft;
  isApplyingDraft = true;
  applyDefaultFieldState();
  $('daysContainer').innerHTML = '';
  dayCount = 0;
  addDay();
  updatePricingUI();
  recalcTotal();
  isApplyingDraft = previousApplyingState;

  closePreview();
  clearDraft();
  updateImportStatus(DEFAULT_IMPORT_MESSAGE);
  showToast('Form reset');
}

function getSelectedDeliverables() {
  const deliverables = [];
  if ($('delEdited').checked) deliverables.push('Edited photos with professional color grading');
  if ($('delRaw').checked) deliverables.push('All raw images delivered');
  if ($('delGallery').checked) deliverables.push('Online gallery for viewing and downloads');
  if ($('delSneakPeek').checked) deliverables.push('Same-day sneak peek reels (24-hour delivery)');
  if ($('delTeaser').checked) deliverables.push('Wedding Teaser (2-3 minutes) — all event highlights');
  if ($('delDoc').checked) deliverables.push('Documentary Film (10 min) — interviews with couple, parents and friends');
  if ($('delTraditional').checked) deliverables.push('Traditional Video Coverage (full length)');
  if ($('delHighlight').checked) deliverables.push('Highlight Video (2-3 minutes)');
  if ($('delDrone').checked) deliverables.push('Drone footage where permitted');
  if ($('delLive').checked) deliverables.push('Live wedding coverage (venue must provide internet)');
  if ($('delSecondShooter').checked) deliverables.push('Second photographer for full coverage');
  return deliverables;
}

function getDeliverableSummaryRows() {
  const editedCount = $('editedCount').value || '200';
  const rows = [];
  if ($('delEdited').checked) rows.push(['Edited Photos', `${editedCount} photos`]);
  if ($('delRaw').checked) rows.push(['Raw Images', 'Full gallery delivered']);
  if ($('delGallery').checked) rows.push(['Online Gallery', 'Private link for viewing and downloads']);
  if ($('delSneakPeek').checked) rows.push(['Sneak Peek Reels', '24-hour delivery']);
  if ($('delTeaser').checked) rows.push(['Wedding Teaser', '2-3 minute highlight reel']);
  if ($('delDoc').checked) rows.push(['Documentary Film', '10 minute story edit with interviews']);
  if ($('delTraditional').checked) rows.push(['Traditional Video', 'Full length coverage']);
  if ($('delHighlight').checked) rows.push(['Highlight Video', '2-3 minute cinematic edit']);
  if ($('delDrone').checked) rows.push(['Drone Footage', 'Included where permitted']);
  if ($('delLive').checked) rows.push(['Live Coverage', 'Venue internet required']);
  if ($('delSecondShooter').checked) rows.push(['Second Shooter', 'Full coverage support']);
  return rows;
}

function getAdditionalInfoRows() {
  const rows = [
    ['Deposit', $('deposit').value || 'TBD'],
    ['Timeline', `Final deliverables within ${$('timeline').value || '6-8 weeks'}`]
  ];

  const extraNotes = $('extraNotes').value.trim();
  if (!extraNotes) return rows;

  extraNotes.split('\n').forEach(line => {
    const trimmed = line.trim();
    if (!trimmed) return;

    const pieces = trimmed.split(':');
    if (pieces.length > 1) {
      rows.push([pieces[0].trim(), pieces.slice(1).join(':').trim()]);
    } else {
      rows.push(['Note', trimmed]);
    }
  });

  return rows;
}

function revokePreviewUrl() {
  if (previewObjectUrl) {
    URL.revokeObjectURL(previewObjectUrl);
    previewObjectUrl = null;
  }
}

function generatePDF(action = 'download') {
  try {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF('p', 'pt', 'letter');
    const W = 612;
    const H = 792;
    const M = 55;
    const CONTENT_TOP = 78;
    const CONTENT_BOTTOM = 92;

    const GOLD = [201, 149, 107];
    const GOLD_DIM = [160, 120, 86];
    const CREAM = [240, 235, 228];
    const MUTED = [138, 133, 128];
    const DARK_BG = [10, 10, 10];

    const clientName = $('clientName').value.trim() || 'Client';
    const firstName = clientName.split('&')[0].split(' ')[0].trim().replace(/,/g, '') || 'Friend';
    const eventType = $('eventType').value;
    const location = $('location').value.trim() || 'Location to be finalized';
    const quoteDate = $('quoteDate').value;
    const quoteDateFormatted = quoteDate ? formatQuoteDate(quoteDate) : 'N/A';
    const timeline = $('timeline').value || '6-8 weeks';
    const validity = $('validity').value || '30 days';
    const customNotes = $('customNotes').value.trim();
    const standardRate = $('standardRate').value.trim();
    const showIntro = $('showIntro').checked;
    const travelType = $('travelType').value;
    const days = collectDayData();
    const pricing = calculatePricingSummary(days);
    const deliverables = getSelectedDeliverables();
    const deliverableRows = getDeliverableSummaryRows();
    const additionalRows = getAdditionalInfoRows();

    function pageBg() {
      doc.setFillColor(...DARK_BG);
      doc.rect(0, 0, W, H, 'F');
    }

    function goldLine(x1, y, x2) {
      doc.setDrawColor(...GOLD);
      doc.setLineWidth(0.5);
      doc.line(x1, y, x2, y);
    }

    function footerBar() {
      goldLine(M, H - 70, W - M);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6);
      doc.setTextColor(...MUTED);
      doc.text('aakaarastudiosnyc.com  |  info@aakaarastudiosnyc.com  |  +1 (475) 332-2020', W / 2, H - 52, { align: 'center' });
    }

    function headerBar(page, total) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6);
      doc.setTextColor(...GOLD);
      doc.text('A A K A A R A   S T U D I O S', M, 38);
      doc.text(`${String(page).padStart(2, '0')} / ${String(total).padStart(2, '0')}`, W - M, 38, { align: 'right' });
      goldLine(M, 48, W - M);
    }

    function stampPageChrome() {
      const totalPages = doc.internal.getNumberOfPages();
      for (let page = 1; page <= totalPages; page += 1) {
        doc.setPage(page);
        if (page === 1) {
          goldLine(M, 45, W - M);
        } else {
          headerBar(page, totalPages);
        }
        footerBar();
      }
    }

    function addNewPage() {
      doc.addPage();
      pageBg();
      return CONTENT_TOP;
    }

    function ensureSpace(currentY, requiredHeight) {
      return currentY + requiredHeight > H - CONTENT_BOTTOM ? addNewPage() : currentY;
    }

    function splitLines(text, maxWidth) {
      const value = String(text || '').trim();
      return value ? doc.splitTextToSize(value, maxWidth) : [];
    }

    function drawLines(lines, x, y, { align = 'left', lineHeight = 10 } = {}) {
      lines.forEach((line, index) => {
        doc.text(line, x, y + index * lineHeight, { align });
      });
    }

    function drawCoverDetail(label, value, currentY) {
      const valueLines = splitLines(value, 300);
      const labelLines = splitLines(label, 115);
      const lineCount = Math.max(labelLines.length || 1, valueLines.length || 1);
      const boxHeight = Math.max(20, 8 + lineCount * 9);

      doc.setFillColor(17, 17, 17);
      doc.roundedRect(M, currentY - 10, W - (2 * M), boxHeight, 3, 3, 'F');

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      doc.setTextColor(...MUTED);
      drawLines(labelLines.length ? labelLines : [''], M + 12, currentY + 2, { lineHeight: 8 });

      doc.setFontSize(8);
      doc.setTextColor(...CREAM);
      drawLines(valueLines.length ? valueLines : ['TBD'], W - M - 12, currentY + 2, { align: 'right', lineHeight: 8 });

      return currentY + boxHeight + 6;
    }

    function drawSectionTitle(title, currentY) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6);
      doc.setTextColor(...GOLD);
      doc.text(title, M, currentY);
      return currentY + 20;
    }

    function drawBulletItem(text, currentY) {
      const lines = splitLines(text, W - (2 * M) - 22);
      const rowHeight = Math.max(12, lines.length * 10);

      doc.setFillColor(...GOLD);
      doc.circle(M + 7, currentY - 1, 1.5, 'F');
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(...CREAM);
      drawLines(lines, M + 16, currentY, { lineHeight: 10 });

      return currentY + rowHeight + 4;
    }

    function drawTableHeader(currentY) {
      doc.setFillColor(21, 21, 21);
      doc.roundedRect(M, currentY - 8, W - (2 * M), 18, 3, 3, 'F');
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6);
      doc.setTextColor(...GOLD);
      doc.text('ITEM', M + 12, currentY + 2);
      doc.text('DETAILS', W - M - 12, currentY + 2, { align: 'right' });
      return currentY + 22;
    }

    function drawDeliverableRow(item, detail, currentY) {
      const itemLines = splitLines(item, 170);
      const detailLines = splitLines(detail, 210);
      const lineCount = Math.max(itemLines.length || 1, detailLines.length || 1);
      const rowHeight = Math.max(18, lineCount * 10);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(...CREAM);
      drawLines(itemLines, M + 12, currentY, { lineHeight: 10 });

      doc.setFontSize(7.5);
      doc.setTextColor(...MUTED);
      drawLines(detailLines, W - M - 12, currentY, { align: 'right', lineHeight: 10 });

      return currentY + rowHeight + 2;
    }

    function drawAdditionalRow(label, detail, currentY) {
      const detailLines = splitLines(detail, W - (2 * M) - 118);
      const lineCount = Math.max(detailLines.length || 1, 1);
      const rowHeight = Math.max(13, lineCount * 10);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      doc.setTextColor(...CREAM);
      doc.text(label, M + 8, currentY);

      doc.setTextColor(...MUTED);
      drawLines(detailLines.length ? detailLines : [''], M + 110, currentY, { lineHeight: 10 });

      return currentY + rowHeight;
    }

    function drawEventCard(event, currentY) {
      const nameLines = splitLines(event.name || 'Coverage details to be finalized', 300);
      const noteLines = splitLines(event.notes, 300);
      const hasNotes = noteLines.length > 0;
      const rowHeight = 16 + (nameLines.length * 10) + (hasNotes ? 6 + noteLines.length * 8 : 0);

      doc.setFillColor(17, 17, 17);
      doc.roundedRect(M, currentY - 10, W - (2 * M), rowHeight, 3, 3, 'F');

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(...CREAM);
      drawLines(nameLines, M + 12, currentY + 2, { lineHeight: 10 });

      if (hasNotes) {
        doc.setFontSize(6.5);
        doc.setTextColor(...MUTED);
        drawLines(noteLines, M + 12, currentY + (nameLines.length * 10) + 6, { lineHeight: 8 });
      }

      if (event.dur) {
        doc.setFontSize(7.5);
        doc.setTextColor(...GOLD);
        doc.text(event.dur, W - M - 12, currentY + 2, { align: 'right' });
      }

      return currentY + rowHeight + 6;
    }

    function getClosingSectionHeight(mode = 'inline') {
      const thankYouLines = splitLines(`${firstName}, thank you for trusting us with your story.`, mode === 'page' ? 320 : 360);
      const promiseLines = splitLines("We don't just photograph moments — we preserve the emotions within them.", 360);
      const honorLines = splitLines('It would be an honor to be part of your celebration.', 360);
      const roleLines = splitLines('Founder & Lead Photographer, Aakaara Studios', 280);
      const quoteLines = splitLines('Every story deserves its own canvas.', 280);

      let height = 0;
      height += thankYouLines.length * 14;
      height += 18;
      height += promiseLines.length * 12;
      height += 8;
      height += honorLines.length * 12;
      height += 32;
      height += 14;
      height += 20;
      height += 16;
      height += roleLines.length * 9;
      height += mode === 'inline' ? 30 + quoteLines.length * 11 : 0;
      return height;
    }

    function drawClosingSection(startY, mode = 'inline') {
      const thankYouLines = splitLines(`${firstName}, thank you for trusting us with your story.`, mode === 'page' ? 320 : 360);
      const promiseLines = splitLines("We don't just photograph moments — we preserve the emotions within them.", 360);
      const honorLines = splitLines('It would be an honor to be part of your celebration.', 360);
      const roleLines = splitLines('Founder & Lead Photographer, Aakaara Studios', 280);
      const quoteLines = splitLines('Every story deserves its own canvas.', 280);
      let closingY = startY;

      if (mode === 'inline') {
        goldLine(M + 90, startY - 22, W - M - 90);
      }

      doc.setFont('times', 'normal');
      doc.setFontSize(12);
      doc.setTextColor(...CREAM);
      drawLines(thankYouLines, W / 2, closingY, { align: 'center', lineHeight: 14 });
      closingY += thankYouLines.length * 14 + 18;

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      doc.setTextColor(...MUTED);
      drawLines(promiseLines, W / 2, closingY, { align: 'center', lineHeight: 12 });
      closingY += promiseLines.length * 12 + 8;
      drawLines(honorLines, W / 2, closingY, { align: 'center', lineHeight: 12 });
      closingY += honorLines.length * 12 + 32;

      doc.setFont('times', 'italic');
      doc.setFontSize(11);
      doc.setTextColor(...GOLD);
      doc.text('With warmth,', W / 2, closingY, { align: 'center' });
      closingY += 20;

      doc.setFont('times', 'normal');
      doc.setFontSize(14);
      doc.setTextColor(...CREAM);
      doc.text('Sudhakar Avula', W / 2, closingY, { align: 'center' });
      closingY += 16;

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      doc.setTextColor(...MUTED);
      drawLines(roleLines, W / 2, closingY, { align: 'center', lineHeight: 9 });
      closingY += roleLines.length * 9;

      if (mode === 'inline') {
        closingY += 30;
        doc.setFont('times', 'italic');
        doc.setFontSize(9);
        doc.setTextColor(...GOLD_DIM);
        drawLines(quoteLines, W / 2, closingY, { align: 'center', lineHeight: 11 });
        closingY += quoteLines.length * 11;
      } else {
        doc.setFont('times', 'italic');
        doc.setFontSize(9);
        doc.setTextColor(...GOLD_DIM);
        drawLines(quoteLines, W / 2, H - 100, { align: 'center', lineHeight: 11 });
      }

      return closingY;
    }

    pageBg();

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(...GOLD);
    doc.text('A A K A A R A   S T U D I O S', W / 2, 145, { align: 'center' });

    doc.setFontSize(6);
    doc.setTextColor(...MUTED);
    doc.text('N E W   Y O R K   C I T Y', W / 2, 158, { align: 'center' });

    const titleWords = eventType.replace(' Photography', '').split(' ');
    doc.setFont('times', 'normal');
    doc.setFontSize(32);
    doc.setTextColor(...CREAM);
    doc.text(titleWords.join(' '), W / 2, 240, { align: 'center' });
    doc.text('Photography', W / 2, 275, { align: 'center' });

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(...GOLD);
    doc.text('— Professional Coverage Proposal —', W / 2, 303, { align: 'center' });
    goldLine(W / 2 - 55, 322, W / 2 + 55);

    doc.setFont('times', 'italic');
    doc.setFontSize(10);
    doc.setTextColor(...CREAM);
    doc.text('Prepared for', W / 2, 350, { align: 'center' });

    doc.setFont('times', 'normal');
    doc.setFontSize(22);
    doc.setTextColor(...GOLD);
    doc.text(clientName, W / 2, 380, { align: 'center' });

    let y = 420;
    y = drawSectionTitle('EVENT DETAILS', y);

    const coverDetails = [
      ['Client', clientName],
      ['Location', location],
      ['Coverage Dates', getCoverageDateLabel(days)],
      ['Coverage Window', days.length ? `${days.length} ${days.length === 1 ? 'Day' : 'Days'}` : 'To be finalized'],
      ['Total Coverage', pricing.totalHours ? `${pricing.totalHours} Hours` : 'Hours to be finalized']
    ];

    coverDetails.forEach(([label, value]) => {
      y = drawCoverDetail(label, value, y);
    });

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6);
    doc.setTextColor(...MUTED);
    doc.text(`Quote Date: ${quoteDateFormatted}`, W / 2, y + 12, { align: 'center' });

    y = addNewPage();
    y = drawSectionTitle('EVENT SCHEDULE', y);

    const printableDays = days.length ? days : [{
      date: '',
      hours: '',
      events: [{ name: 'Coverage details to be finalized', dur: '', notes: '' }]
    }];

    printableDays.forEach((day, index) => {
      const printableEvents = day.events.length
        ? day.events.filter(event => event.name || event.dur || event.notes)
        : [{ name: 'Coverage details to be finalized', dur: '', notes: '' }];
      const eventHeights = printableEvents.map(event => {
        const nameLines = splitLines(event.name || 'Coverage details to be finalized', 300);
        const noteLines = splitLines(event.notes, 300);
        return 16 + (nameLines.length * 10) + (noteLines.length ? 6 + noteLines.length * 8 : 0) + 6;
      });
      const estimatedHeight = 24 + eventHeights.reduce((sum, height) => sum + height, 0) + 28;

      y = ensureSpace(y, estimatedHeight);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6);
      doc.setTextColor(...GOLD);
      doc.text(`DAY ${index + 1}  —  ${day.date ? formatDate(day.date).toUpperCase() : 'TBD'}`, M, y);
      y += 18;

      printableEvents.forEach(event => {
        y = drawEventCard(event, y);
      });

      doc.setFillColor(30, 26, 22);
      doc.roundedRect(M, y - 10, W - (2 * M), 20, 3, 3, 'F');
      doc.setFontSize(7.5);
      doc.setTextColor(...GOLD);
      doc.text(`Day ${index + 1} Total`, M + 12, y + 2);
      doc.text(`${day.hours || '0'} Hours`, W - M - 12, y + 2, { align: 'right' });
      y += 34;
    });

    y += 8;
    y = ensureSpace(y, 40);
    y = drawSectionTitle('SCOPE OF COVERAGE', y);

    const scopeItems = deliverables.length
      ? deliverables
      : ['Coverage details will be customized to match your celebration'];
    scopeItems.forEach(item => {
      const requiredHeight = Math.max(18, splitLines(item, W - (2 * M) - 22).length * 10) + 4;
      y = ensureSpace(y, requiredHeight + 10);
      y = drawBulletItem(item, y);
    });

    if ($('delLive').checked) {
      y = ensureSpace(y, 48);
      y += 5;
      doc.setFillColor(30, 26, 22);
      doc.roundedRect(M, y - 10, W - (2 * M), 35, 4, 4, 'F');
      doc.setDrawColor(...GOLD);
      doc.setLineWidth(0.8);
      doc.roundedRect(M, y - 10, W - (2 * M), 35, 4, 4, 'S');
      doc.setFontSize(5.5);
      doc.setTextColor(...GOLD);
      doc.text('★  HIGHLIGHTED', M + 12, y + 2);
      doc.setFontSize(9);
      doc.setTextColor(...CREAM);
      doc.text('Live Wedding Coverage', M + 12, y + 14);
      doc.setFontSize(7);
      doc.setTextColor(...MUTED);
      doc.text('Included for the wedding ceremony (venue must provide internet)', M + 155, y + 14);
    }

    y = addNewPage();
    y = drawSectionTitle('DELIVERABLES SUMMARY', y);
    y = drawTableHeader(y);

    const printableDeliverables = deliverableRows.length
      ? deliverableRows
      : [['Coverage', 'Deliverables will be customized for this quote']];

    printableDeliverables.forEach(([item, detail]) => {
      const lineCount = Math.max(splitLines(item, 170).length || 1, splitLines(detail, 210).length || 1);
      const rowHeight = Math.max(18, lineCount * 10) + 2;
      y = ensureSpace(y, rowHeight + 16);
      if (y === CONTENT_TOP) {
        y = drawSectionTitle('DELIVERABLES SUMMARY', y);
        y = drawTableHeader(y);
      }
      y = drawDeliverableRow(item, detail, y);
    });

    y += 15;
    y = ensureSpace(y, 160);
    y = drawSectionTitle('INVESTMENT', y);

    const investmentBoxHeight = Math.max(72, 52 + (pricing.model === 'hourly' ? pricing.dayBreakdown.length * 14 : 14) + (showIntro ? 12 : 0));
    doc.setFillColor(17, 17, 17);
    doc.roundedRect(M, y - 8, W - (2 * M), investmentBoxHeight, 4, 4, 'F');
    doc.setDrawColor(...GOLD);
    doc.setLineWidth(0.4);
    doc.roundedRect(M, y - 8, W - (2 * M), investmentBoxHeight, 4, 4, 'S');

    if (showIntro) {
      doc.setFillColor(30, 26, 22);
      doc.roundedRect(M + 15, y - 2, 100, 13, 6, 6, 'F');
      doc.setFontSize(5.5);
      doc.setTextColor(...GOLD);
      doc.text('INTRODUCTORY RATE', M + 65, y + 7, { align: 'center' });
    }

    if (pricing.model === 'hourly') {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6);
      doc.setTextColor(...MUTED);
      doc.text('HOURLY RATE', M + 15, y + (showIntro ? 20 : 8));
      doc.setFontSize(32);
      doc.setTextColor(...CREAM);
      doc.text(formatCurrency(pricing.hourlyRate), M + 15, y + (showIntro ? 46 : 36));
      doc.setFontSize(9);
      doc.setTextColor(...MUTED);
      doc.text('/ hour', M + 102, y + (showIntro ? 42 : 32));

      let breakdownY = y + (showIntro ? 20 : 8);
      doc.setFontSize(6);
      doc.setTextColor(...MUTED);
      doc.text('BREAKDOWN', W / 2 + 10, breakdownY);
      breakdownY += 12;

      pricing.dayBreakdown.forEach((day, index) => {
        doc.setFontSize(7.5);
        doc.setTextColor(...CREAM);
        const label = `Day ${index + 1}: ${day.hours} hrs × ${formatCurrency(pricing.hourlyRate)}`;
        doc.text(label, W / 2 + 10, breakdownY);
        doc.setTextColor(...GOLD);
        doc.text(formatCurrency(day.amount), W - M - 15, breakdownY, { align: 'right' });
        breakdownY += 14;
      });

      goldLine(W / 2 + 10, breakdownY - 4, W - M - 15);
      doc.setFontSize(9);
      doc.setTextColor(...CREAM);
      doc.text('Coverage Total', W / 2 + 10, breakdownY + 6);
      doc.setTextColor(...GOLD);
      doc.text(formatCurrency(pricing.baseTotal), W - M - 15, breakdownY + 6, { align: 'right' });
    } else {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6);
      doc.setTextColor(...MUTED);
      doc.text('PACKAGE PRICE', M + 15, y + (showIntro ? 20 : 8));
      doc.setFontSize(32);
      doc.setTextColor(...CREAM);
      doc.text(formatCurrency(pricing.flatRate), M + 15, y + (showIntro ? 46 : 36));
      doc.setFontSize(8);
      doc.setTextColor(...MUTED);
      doc.text('All-inclusive package', W / 2 + 10, y + (showIntro ? 30 : 20));
    }

    if (showIntro && standardRate) {
      doc.setFontSize(6.5);
      doc.setTextColor(...MUTED);
      const standardRateText = `Standard rate: ${standardRate}`;
      doc.text(standardRateText, M + 15, y + investmentBoxHeight - 10);
      const textWidth = doc.getTextWidth(standardRateText);
      doc.setDrawColor(...MUTED);
      doc.setLineWidth(0.4);
      doc.line(M + 15, y + investmentBoxHeight - 13, M + 15 + textWidth, y + investmentBoxHeight - 13);
    }

    y += investmentBoxHeight + 10;

    if (travelType === 'separate') {
      y = ensureSpace(y, 30);
      doc.setFillColor(17, 17, 17);
      doc.roundedRect(M, y - 4, W - (2 * M), 22, 3, 3, 'F');
      doc.setFontSize(7);
      doc.setTextColor(...MUTED);
      doc.text('TRAVEL & ACCOMMODATION', M + 12, y + 8);
      doc.setFontSize(8);
      doc.setTextColor(...CREAM);
      doc.text('Calculated separately', W - M - 12, y + 8, { align: 'right' });
      y += 30;
    } else if (travelType === 'fixed') {
      y = ensureSpace(y, 30);
      doc.setFillColor(17, 17, 17);
      doc.roundedRect(M, y - 4, W - (2 * M), 22, 3, 3, 'F');
      doc.setFontSize(7);
      doc.setTextColor(...MUTED);
      doc.text('TRAVEL & ACCOMMODATION', M + 12, y + 8);
      doc.setFontSize(8);
      doc.setTextColor(...GOLD);
      doc.text(formatCurrency(pricing.travelAmount), W - M - 12, y + 8, { align: 'right' });
      y += 30;
    }

    y = ensureSpace(y, 34);
    doc.setFillColor(30, 26, 22);
    doc.roundedRect(M, y - 6, W - (2 * M), 24, 3, 3, 'F');
    doc.setFontSize(7);
    doc.setTextColor(...CREAM);
    doc.text(travelType === 'separate' ? 'Estimated Coverage Total' : 'Estimated Quote Total', M + 12, y + 8);
    doc.setFont('times', 'normal');
    doc.setFontSize(16);
    doc.setTextColor(...GOLD);
    doc.text(formatCurrency(pricing.total), W - M - 12, y + 8, { align: 'right' });
    doc.setFont('helvetica', 'normal');
    y += 34;

    y = ensureSpace(y, 30);
    y = drawSectionTitle('ADDITIONAL INFORMATION', y);

    additionalRows.forEach(([label, detail]) => {
      const requiredHeight = Math.max(13, (splitLines(detail, W - (2 * M) - 118).length || 1) * 10);
      y = ensureSpace(y, requiredHeight + 16);
      if (y === CONTENT_TOP) {
        y = drawSectionTitle('ADDITIONAL INFORMATION', y);
      }
      y = drawAdditionalRow(label, detail, y);
    });

    if (customNotes) {
      const noteLines = splitLines(customNotes, W - (2 * M) - 16);
      const noteHeight = 18 + (noteLines.length * 10);
      y = ensureSpace(y + 6, noteHeight + 18);

      doc.setFillColor(17, 17, 17);
      doc.roundedRect(M, y, W - (2 * M), noteHeight, 3, 3, 'F');
      doc.setFontSize(6);
      doc.setTextColor(...GOLD);
      doc.text('CUSTOM DELIVERABLE NOTES', M + 12, y + 16);
      doc.setFontSize(7.5);
      doc.setTextColor(...CREAM);
      drawLines(noteLines, M + 12, y + 30, { lineHeight: 10 });
      y += noteHeight + 12;
    } else {
      y += 8;
    }

    y = ensureSpace(y, 28);
    doc.setFillColor(30, 26, 22);
    doc.roundedRect(M, y - 6, W - (2 * M), 18, 3, 3, 'F');
    doc.setFontSize(7);
    doc.setTextColor(...CREAM);
    doc.text(`This quote is valid for ${validity} from the date above.`, W / 2, y + 4, { align: 'center' });

    const inlineClosingStart = y + 52;
    const inlineClosingHeight = getClosingSectionHeight('inline');
    if (inlineClosingStart + inlineClosingHeight <= H - CONTENT_BOTTOM) {
      drawClosingSection(inlineClosingStart, 'inline');
    } else {
      doc.addPage();
      pageBg();
      drawClosingSection(220, 'page');
    }

    stampPageChrome();

    const safeName = clientName.replace(/[^a-zA-Z0-9]/g, '_') || 'Client';
    if (action === 'preview') {
      revokePreviewUrl();
      previewObjectUrl = URL.createObjectURL(doc.output('blob'));
      $('previewFrame').src = previewObjectUrl;
      $('previewModal').classList.add('show');
    } else {
      doc.save(`Aakaara_Studios_Quote_${safeName}.pdf`);
      showToast('PDF generated & downloading!');
    }
  } catch (error) {
    console.error(error);
    window.alert(`Error generating PDF: ${error.message}`);
  }
}

function closePreview() {
  $('previewModal').classList.remove('show');
  $('previewFrame').src = 'about:blank';
  revokePreviewUrl();
}

function sendQuoteEmail() {
  const email = $('clientEmail').value.trim();
  const name = $('clientName').value.trim();

  if (!email || !name) {
    window.alert('Please enter a Client Name and Email address first.');
    closePreview();
    $('clientName').focus();
    return;
  }

  try {
    const quotes = JSON.parse(readStorage(localStorage, APP_SETTINGS.dashboardStorageKey) || '[]');
    const totalText = $('totalDisplay').textContent;
    const total = parseFloat(totalText.replace(/[^0-9.-]+/g, '')) || 0;
    const dayDates = collectDayData().map(day => day.date).filter(Boolean).sort();
    const eventDateFrom = dayDates.length ? dayDates[0] : new Date().toISOString().split('T')[0];
    const eventDateTo = dayDates.length ? dayDates[dayDates.length - 1] : eventDateFrom;

    const newQuote = {
      id: Date.now(),
      clientName: name,
      clientEmail: email,
      eventDate: eventDateFrom,
      eventDateTo,
      status: 'sent',
      quotedPrice: total,
      confirmedPrice: null
    };

    quotes.unshift(newQuote);
    writeStorage(localStorage, APP_SETTINGS.dashboardStorageKey, JSON.stringify(quotes));
    showToast('Quote saved to dashboard!');
  } catch (error) {
    console.error('Failed to save quote to localStorage', error);
    window.alert('Could not save quote to dashboard. Please check browser permissions.');
  }

  generatePDF('download');

  const subject = `Photography Quote: ${name} — Aakaara Studios`;
  const body = `Hi ${name.split(' ')[0]},\n\nIt was wonderful connecting with you. Please find the attached quote for your photography coverage.\n\nWe've customized this based on our discussion. Let us know if you have any questions!\n\nBest,\nSudhakar Avula\nAakaara Studios NYC`;
  const gmailUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(email)}&su=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

  setTimeout(() => {
    window.open(gmailUrl, '_blank');
  }, 800);
}

function isPricingRelevantTarget(target) {
  return target.matches('#pricingModel, #hourlyRate, #flatRate, #travelType, #travelAmount, #showIntro, [data-field="hours"], [data-field="date"]');
}

function initializeEventBindings() {
  document.addEventListener('submit', event => {
    event.preventDefault();
  });

  document.addEventListener('input', event => {
    if (!event.target.closest('#app')) return;
    if (isPricingRelevantTarget(event.target)) recalcTotal();
    scheduleDraftSave();
  });

  document.addEventListener('change', event => {
    if (!event.target.closest('#app')) return;
    if (isPricingRelevantTarget(event.target)) recalcTotal();
    scheduleDraftSave();
  });

  $('pricingModel').addEventListener('change', updatePricingUI);
  $('travelType').addEventListener('change', updatePricingUI);
  $('showIntro').addEventListener('change', updatePricingUI);

  $('previewModal').addEventListener('click', event => {
    if (event.target === $('previewModal')) closePreview();
  });

  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && $('previewModal').classList.contains('show')) {
      closePreview();
    }
  });

  window.addEventListener('pagehide', () => saveDraftNow({ silent: true }));
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) saveDraftNow({ silent: true });
  });
}

function initializeApp() {
  initializeLogin();
  initializeEventBindings();

  const restoredDraft = loadDraftFromStorage();
  if (!restoredDraft) {
    isApplyingDraft = true;
    applyDefaultFieldState();
    addDay();
    isApplyingDraft = false;
    updatePricingUI();
    recalcTotal();
    updateDraftIndicator('Local draft ready', 'muted');
  }

  if (loadBriefFromQuery()) {
    updateDraftIndicator('Draft imported from shared brief', 'saved');
  }
}

initializeApp();
