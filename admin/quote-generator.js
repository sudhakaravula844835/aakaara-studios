import {
  parseDurationToHours,
  sumEventPhotos,
  generateQuoteRef,
  calculatePricingSummary,
  computeInvestmentBoxHeight,
  migrateEventDay,
  parseBrief,
} from './quote-utils.js';

const { jsPDF } = window.jspdf;

// ── SETTINGS ──────────────────────────────────────────────────────
const APP_SETTINGS = {
  draftStorageKey: 'aakaaraQuoteDraft:v2',
  dashboardStorageKey: 'aakaara_quotes',
};

const DRAFT_VALUE_FIELD_IDS = [
  'clientName', 'clientEmail', 'clientPhone',
  'venueName', 'location', 'eventType',
  'quoteDate', 'quoteRef', 'referralSource',
  'timeline', 'customNotes',
  'pricingModel', 'hourlyRate', 'flatRate',
  'travelType', 'travelAmount', 'retainerFee',
  'standardRate', 'deposit', 'validity', 'balanceDue',
  'extraNotes', 'quickImportText',
];
const DRAFT_CHECK_FIELD_IDS = [
  'delEdited', 'delRaw', 'delGallery', 'delSneakPeek', 'delTeaser',
  'delDoc', 'delTraditional', 'delHighlight', 'delDrone', 'delLive',
  'delSecondShooter', 'delEngagement', 'delAddlHours', 'delRush', 'showIntro',
];
const DRAFT_ADDON_FIELDS = ['delEngagementNotes', 'delAddlHoursRate', 'delRushFee'];

// ── STATE ─────────────────────────────────────────────────────────
let dayCount = 0;
let draftSaveTimer = null;
let isApplyingDraft = false;
let previewObjectUrl = null;
let toastTimer = null;

// ── STORAGE ───────────────────────────────────────────────────────
function readStorage(key) {
  try { return JSON.parse(localStorage.getItem(key)); } catch { return null; }
}
function writeStorage(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch {}
}
function removeStorage(key) {
  try { localStorage.removeItem(key); } catch {}
}

// ── DOM SHORTHAND ─────────────────────────────────────────────────
function $(id) { return document.getElementById(id); }

// ── DAY / EVENT MANAGEMENT ────────────────────────────────────────
function addDay(dayData) {
  dayCount++;
  const tmpl = $('dayTemplate').content.cloneNode(true);
  const block = tmpl.querySelector('.day-block');
  block.dataset.dayId = dayCount;
  block.querySelector('.day-label').textContent = `Day ${dayCount}`;
  if (dayData && dayData.date) block.querySelector('[data-field="date"]').value = dayData.date;
  if (dayData && dayData.hours) {
    block.querySelector('[data-field="hours"]').value = dayData.hours;
  }
  $('daysContainer').appendChild(block);
  const addedBlock = $('daysContainer').lastElementChild;
  const events = (dayData && dayData.events) ? dayData.events : [{}];
  events.forEach(ev => addEvent(addedBlock, ev));
  recalcDayPhotos(addedBlock);
}

function addEvent(dayBlock, eventData) {
  const existingCount = dayBlock.querySelectorAll('[data-event-item]').length;
  const tmpl = $('eventTemplate').content.cloneNode(true);
  const item = tmpl.querySelector('[data-event-item]');
  item.querySelector('.event-num').textContent = `Event ${existingCount + 1}`;
  if (eventData && eventData.name) item.querySelector('[data-field="eventName"]').value = eventData.name;
  if (eventData && eventData.dur) item.querySelector('[data-field="eventDuration"]').value = eventData.dur;
  if (eventData && eventData.notes) item.querySelector('[data-field="eventNotes"]').value = eventData.notes;
  if (eventData && eventData.photos) item.querySelector('[data-field="eventPhotos"]').value = eventData.photos;
  dayBlock.querySelector('.events-container').appendChild(item);
  const addedItem = dayBlock.querySelector('.events-container').lastElementChild;
  updatePhotoPill(addedItem);
}

function removeDay(dayBlock) {
  dayBlock.remove();
  renumberDays();
  recalcTotal();
  scheduleDraftSave();
}

function removeEvent(eventItem) {
  const dayBlock = eventItem.closest('.day-block');
  eventItem.remove();
  renumberEvents(dayBlock);
  recalcDayHours(dayBlock);
  recalcDayPhotos(dayBlock);
  recalcTotal();
  scheduleDraftSave();
}

function renumberDays() {
  dayCount = 0;
  $('daysContainer').querySelectorAll('.day-block').forEach(block => {
    dayCount++;
    block.dataset.dayId = dayCount;
    block.querySelector('.day-label').textContent = `Day ${dayCount}`;
  });
}

function renumberEvents(dayBlock) {
  dayBlock.querySelectorAll('[data-event-item]').forEach((item, i) => {
    item.querySelector('.event-num').textContent = `Event ${i + 1}`;
  });
}

function updatePhotoPill(eventItem) {
  const photos = parseFloat(eventItem.querySelector('[data-field="eventPhotos"]').value) || 0;
  let pill = eventItem.querySelector('.photo-pill');
  if (photos > 0) {
    if (!pill) {
      pill = document.createElement('div');
      pill.className = 'photo-pill';
      eventItem.appendChild(pill);
    }
    pill.textContent = `${photos} photos`;
  } else if (pill) {
    pill.remove();
  }
}

// ── AUTO-SUM ──────────────────────────────────────────────────────
function recalcDayHours(dayBlock) {
  const hoursInput = dayBlock.querySelector('[data-field="hours"]');
  const isAuto = hoursInput.classList.contains('hours-auto') || hoursInput.value === '';
  if (!isAuto) return;
  const total = [...dayBlock.querySelectorAll('[data-field="eventDuration"]')]
    .reduce((s, inp) => s + parseDurationToHours(inp.value), 0);
  if (total > 0) {
    hoursInput.value = total;
    hoursInput.classList.add('hours-auto');
  } else {
    hoursInput.value = '';
    hoursInput.classList.remove('hours-auto');
  }
}

function recalcDayPhotos(dayBlock) {
  const events = [...dayBlock.querySelectorAll('[data-event-item]')].map(item => ({
    photos: item.querySelector('[data-field="eventPhotos"]').value,
  }));
  const total = sumEventPhotos(events);
  const footer = dayBlock.querySelector('.day-photo-total');
  if (total > 0) {
    footer.textContent = '';
    const label = document.createTextNode('Day photos: ');
    const val = document.createElement('span');
    val.className = 'total-val';
    val.textContent = total;
    footer.appendChild(label);
    footer.appendChild(val);
  } else {
    footer.textContent = '';
  }
}

// ── PRICING ───────────────────────────────────────────────────────
function getDays() {
  return [...$('daysContainer').querySelectorAll('.day-block')].map(block => ({
    hours: parseFloat(block.querySelector('[data-field="hours"]').value) || 0,
    events: [...block.querySelectorAll('[data-event-item]')].map(item => ({
      photos: item.querySelector('[data-field="eventPhotos"]').value,
    })),
  }));
}

function getPricingInputs() {
  return {
    model: $('pricingModel').value,
    hourlyRate: parseFloat($('hourlyRate').value) || 0,
    flatRate: parseFloat($('flatRate').value) || 0,
    travelType: $('travelType').value,
    travelAmount: parseFloat($('travelAmount').value) || 0,
    retainerFee: parseFloat($('retainerFee').value) || 0,
  };
}

function recalcTotal() {
  const days = getDays();
  const inputs = getPricingInputs();
  const pricing = calculatePricingSummary(days, inputs);
  updatePricingUI(pricing, inputs);
}

function updatePricingUI(pricing, inputs) {
  $('totalDisplay').textContent = `$${pricing.total.toLocaleString()}`;

  const metaParts = [];
  if (pricing.model === 'hourly' && pricing.totalHours > 0) metaParts.push(`${pricing.totalHours} hrs`);
  const numDays = getDays().length;
  if (numDays > 0) metaParts.push(`${numDays} day${numDays > 1 ? 's' : ''}`);
  if (inputs.travelType === 'separate') metaParts.push('Travel separate');
  if (inputs.travelType === 'included') metaParts.push('Travel included');
  $('totalMeta').textContent = metaParts.join(' · ');

  const preview = $('pricingPreview');
  preview.textContent = '';

  const addRow = (left, right, cls) => {
    const row = document.createElement('div');
    row.className = 'pr-row' + (cls ? ` ${cls}` : '');
    const l = document.createElement('span');
    l.textContent = left;
    const r = document.createElement('span');
    r.textContent = right;
    row.appendChild(l);
    row.appendChild(r);
    preview.appendChild(row);
  };

  if (pricing.model === 'hourly') {
    pricing.dayBreakdown.forEach(d => {
      addRow(`${d.label}: ${d.hours} hrs × $${inputs.hourlyRate.toLocaleString()}`, `$${d.amount.toLocaleString()}`);
    });
    addRow(`Base Total (${pricing.totalHours} hours)`, `$${pricing.baseTotal.toLocaleString()}`);
  } else {
    addRow('Package Rate', `$${pricing.flatRate.toLocaleString()}`);
  }

  if (inputs.travelType === 'fixed') addRow('Travel & Accommodation', `$${inputs.travelAmount.toLocaleString()}`);
  else if (inputs.travelType === 'separate') addRow('Travel & Accommodation', 'Billed Separately');
  else if (inputs.travelType === 'included') addRow('Travel & Accommodation', 'Included');

  if (inputs.retainerFee > 0) addRow('Retainer / Booking Fee', `$${inputs.retainerFee.toLocaleString()}`);

  const divider = document.createElement('div');
  divider.className = 'pr-divider';
  preview.appendChild(divider);

  const total = document.createElement('div');
  total.className = 'pr-total';
  const tl = document.createElement('span');
  tl.className = 'pr-lbl';
  tl.textContent = 'Estimated Total';
  const tv = document.createElement('span');
  tv.className = 'pr-val';
  tv.textContent = `$${pricing.total.toLocaleString()}`;
  total.appendChild(tl);
  total.appendChild(tv);
  preview.appendChild(total);
}

// ── DRAFT ─────────────────────────────────────────────────────────
function collectDraftState() {
  const state = {};
  DRAFT_VALUE_FIELD_IDS.forEach(id => { const el = $(id); if (el) state[id] = el.value; });
  DRAFT_CHECK_FIELD_IDS.forEach(id => { const el = $(id); if (el) state[id] = el.checked; });
  DRAFT_ADDON_FIELDS.forEach(id => { const el = $(id); if (el) state[id] = el.value; });
  state.days = [...$('daysContainer').querySelectorAll('.day-block')].map(block => ({
    date: block.querySelector('[data-field="date"]').value,
    hours: block.querySelector('[data-field="hours"]').value,
    hoursAuto: block.querySelector('[data-field="hours"]').classList.contains('hours-auto'),
    events: [...block.querySelectorAll('[data-event-item]')].map(item => ({
      name: item.querySelector('[data-field="eventName"]').value,
      dur: item.querySelector('[data-field="eventDuration"]').value,
      notes: item.querySelector('[data-field="eventNotes"]').value,
      photos: item.querySelector('[data-field="eventPhotos"]').value,
    })),
  }));
  return state;
}

function applyDraftState(state) {
  isApplyingDraft = true;
  DRAFT_VALUE_FIELD_IDS.forEach(id => { const el = $(id); if (el && state[id] !== undefined) el.value = state[id]; });
  DRAFT_CHECK_FIELD_IDS.forEach(id => { const el = $(id); if (el && state[id] !== undefined) el.checked = state[id]; });
  DRAFT_ADDON_FIELDS.forEach(id => { const el = $(id); if (el && state[id] !== undefined) el.value = state[id]; });
  toggleAddonFields();
  togglePricingFields();

  $('daysContainer').textContent = '';
  dayCount = 0;
  const days = (state.days || []).map(migrateEventDay);
  days.forEach(day => {
    addDay(day);
    if (day.hoursAuto) {
      const blocks = $('daysContainer').querySelectorAll('.day-block');
      blocks[blocks.length - 1].querySelector('[data-field="hours"]').classList.add('hours-auto');
    }
  });
  if (days.length === 0) addDay();
  recalcTotal();
  isApplyingDraft = false;
}

function saveDraftNow() {
  writeStorage(APP_SETTINGS.draftStorageKey, collectDraftState());
  const now = new Date();
  $('draftIndicator').textContent = `Draft saved ${now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
}

function scheduleDraftSave() {
  if (isApplyingDraft) return;
  clearTimeout(draftSaveTimer);
  draftSaveTimer = setTimeout(saveDraftNow, 800);
}

function clearDraft() {
  removeStorage(APP_SETTINGS.draftStorageKey);
}

// ── IMPORT ────────────────────────────────────────────────────────
function importBrief() {
  const text = $('quickImportText').value.trim();
  if (!text) return;
  const parsed = parseBrief(text);
  if (parsed.clientName) $('clientName').value = parsed.clientName;
  if (parsed.clientEmail) $('clientEmail').value = parsed.clientEmail;
  if (parsed.location) $('location').value = parsed.location;
  if (parsed.eventType) $('eventType').value = parsed.eventType;
  $('importStatus').textContent = 'Brief imported.';
  setTimeout(() => { $('importStatus').textContent = ''; }, 3000);
  scheduleDraftSave();
}

function loadBriefFromQuery() {
  const brief = new URLSearchParams(window.location.search).get('brief');
  if (!brief) return false;
  $('quickImportText').value = decodeURIComponent(brief);
  importBrief();
  return true;
}

// ── MODAL ─────────────────────────────────────────────────────────
function openPreview() { generatePDF('preview'); }

function closePreview() {
  $('previewModal').classList.add('hidden');
  revokePreviewUrl();
}

function revokePreviewUrl() {
  if (previewObjectUrl) { URL.revokeObjectURL(previewObjectUrl); previewObjectUrl = null; }
}

// ── PDF GENERATION ────────────────────────────────────────────────
function getDeliverableRows() {
  const rows = [];

  if ($('delEdited').checked) {
    const allEvents = [];
    $('daysContainer').querySelectorAll('.day-block').forEach(block => {
      block.querySelectorAll('[data-event-item]').forEach(item => {
        const name = item.querySelector('[data-field="eventName"]').value || 'Unnamed';
        const photos = parseFloat(item.querySelector('[data-field="eventPhotos"]').value) || 0;
        if (photos > 0) allEvents.push({ name, photos });
      });
    });
    const totalPhotos = allEvents.reduce((s, e) => s + e.photos, 0);
    if (allEvents.length > 1) {
      allEvents.forEach(e => rows.push({ label: e.name, detail: `${e.photos} photos`, highlight: true }));
      rows.push({ label: '__divider__', detail: '' });
      rows.push({ label: 'Total Edited Photos', detail: `${totalPhotos}`, highlight: true });
    } else if (allEvents.length === 1) {
      rows.push({ label: 'Edited Photos', detail: `${totalPhotos} photos · professional color grading`, highlight: true });
    } else {
      rows.push({ label: 'Edited Photos', detail: 'Professional color grading', highlight: true });
    }
  }

  const del = (id, label, detail) => { if ($(id) && $(id).checked) rows.push({ label, detail }); };
  del('delRaw', 'Raw Images', 'Full gallery delivered');
  del('delGallery', 'Online Gallery', 'Private link, downloads enabled');
  del('delSneakPeek', 'Sneak Peek', '5-10 images within 48 hours');
  del('delTeaser', 'Teaser Reel', '60-second social media cut');
  del('delDoc', 'Documentary Video', 'Full ceremony & reception');
  del('delTraditional', 'Traditional Video', 'Full coverage edit');
  del('delHighlight', 'Highlight Video', '2-3 min cinematic edit');
  del('delDrone', 'Drone Coverage', 'Aerial footage & stills');
  del('delLive', 'Livestream', 'Private streaming link');
  del('delSecondShooter', 'Second Shooter', 'Additional photographer');

  if ($('delEngagement').checked) {
    rows.push({ label: 'Engagement Session', detail: $('delEngagementNotes').value || 'Pre-wedding couple shoot' });
  }
  if ($('delAddlHours').checked) {
    const rate = parseFloat($('delAddlHoursRate').value);
    rows.push({ label: 'Additional Hours', detail: rate ? `$${rate}/hr overtime rate` : 'Rate TBD' });
  }
  if ($('delRush').checked) {
    const fee = parseFloat($('delRushFee').value);
    rows.push({ label: 'Rush Delivery', detail: fee ? `$${fee} priority fee` : 'Fee TBD' });
  }
  const custom = $('customNotes').value.trim();
  if (custom) rows.push({ label: custom, detail: '' });
  const timeline = $('timeline').value.trim();
  if (timeline) rows.push({ label: 'Delivery Timeline', detail: timeline });

  return rows;
}

function formatDateRange() {
  const dates = [...$('daysContainer').querySelectorAll('[data-field="date"]')]
    .map(inp => inp.value).filter(Boolean).sort();
  if (dates.length === 0) return '';
  if (dates.length === 1) {
    return new Date(dates[0] + 'T12:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  }
  const first = new Date(dates[0] + 'T12:00:00');
  const last = new Date(dates[dates.length - 1] + 'T12:00:00');
  return `${first.toLocaleDateString('en-US', { month: 'long', day: 'numeric' })} – ${last.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}`;
}

function generatePDF(action) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'letter' });
  const W = 612;
  const marginL = 56, marginR = 56;
  const contentW = W - marginL - marginR;
  let y = 0;

  const GOLD = [201, 168, 76];
  const CREAM = [237, 232, 220];
  const DARK = [10, 10, 10];
  const GREY = [122, 117, 104];
  const PANEL = [25, 25, 23];
  const BORDER = [46, 43, 34];

  function setColor(r, g, b) { doc.setTextColor(r, g, b); }
  function setFill(r, g, b) { doc.setFillColor(r, g, b); }

  function ensureSpace(currentY, needed) {
    if (currentY + needed > 740) {
      doc.addPage();
      drawPageHeader();
      return y;
    }
    return currentY;
  }

  function drawPageHeader() {
    setFill(...PANEL);
    doc.rect(0, 0, W, 42, 'F');
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    setColor(...GOLD);
    doc.text('AAKAARA STUDIOS NYC', marginL, 18);
    const ref = $('quoteRef').value;
    if (ref) doc.text(ref, W - marginR, 18, { align: 'right' });
    setColor(...GREY);
    doc.text(`Page ${doc.getCurrentPageInfo().pageNumber}`, W / 2, 18, { align: 'center' });
    y = 56;
  }

  // Cover page
  setFill(...DARK);
  doc.rect(0, 0, W, 792, 'F');
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  setColor(...GOLD);
  doc.text('AAKAARA STUDIOS NYC', W / 2, 60, { align: 'center' });
  const ref = $('quoteRef').value;
  if (ref) {
    doc.setFontSize(7);
    setColor(...GREY);
    doc.text(ref, W - marginR, 60, { align: 'right' });
  }
  doc.setDrawColor(...BORDER);
  doc.setLineWidth(0.5);
  doc.line(marginL, 72, W - marginR, 72);

  const clientName = $('clientName').value || 'Client Name';
  doc.setFontSize(28);
  doc.setFont('times', 'italic');
  setColor(...CREAM);
  doc.text(clientName, W / 2, 140, { align: 'center' });

  const eventType = $('eventType').value || 'Photography';
  const dateRange = formatDateRange();
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  setColor(...GOLD);
  const coverLine = [eventType.toUpperCase(), dateRange].filter(Boolean).join(' · ');
  doc.text(coverLine, W / 2, 164, { align: 'center' });

  const venueName = $('venueName').value.trim();
  const city = $('location').value.trim();
  if (venueName || city) {
    doc.setFontSize(9);
    setColor(...GREY);
    doc.text([venueName, city].filter(Boolean).join(', '), W / 2, 182, { align: 'center' });
  }
  doc.setFontSize(7);
  setColor(...GREY);
  doc.text(`Quote prepared ${new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}`, W / 2, 200, { align: 'center' });

  // Page 2
  doc.addPage();
  drawPageHeader();

  // Event Schedule section
  y = ensureSpace(y, 40);
  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');
  setColor(...GOLD);
  doc.text('EVENT SCHEDULE', marginL, y);
  y += 14;
  doc.setDrawColor(...BORDER);
  doc.setLineWidth(0.4);
  doc.line(marginL, y, W - marginR, y);
  y += 10;

  $('daysContainer').querySelectorAll('.day-block').forEach((block, di) => {
    const dateVal = block.querySelector('[data-field="date"]').value;
    const dateLabel = dateVal
      ? new Date(dateVal + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
      : `Day ${di + 1}`;
    const hours = block.querySelector('[data-field="hours"]').value;

    y = ensureSpace(y, 30);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    setColor(...CREAM);
    doc.text(dateLabel, marginL, y);
    if (hours) {
      doc.setFont('helvetica', 'normal');
      setColor(...GREY);
      doc.text(`${hours} hrs`, W - marginR, y, { align: 'right' });
    }
    y += 14;

    block.querySelectorAll('[data-event-item]').forEach(item => {
      const name = item.querySelector('[data-field="eventName"]').value;
      const dur = item.querySelector('[data-field="eventDuration"]').value;
      if (!name && !dur) return;
      y = ensureSpace(y, 16);
      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      setColor(...CREAM);
      doc.text(name || '—', marginL + 10, y);
      if (dur) { setColor(...GREY); doc.text(dur, W - marginR, y, { align: 'right' }); }
      y += 13;
    });
    y += 4;
  });
  y += 6;

  // Deliverables section
  const delRows = getDeliverableRows();
  if (delRows.length > 0) {
    y = ensureSpace(y, 40);
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    setColor(...GOLD);
    doc.text('DELIVERABLES', marginL, y);
    y += 14;
    doc.setDrawColor(...BORDER);
    doc.line(marginL, y, W - marginR, y);
    y += 10;

    delRows.forEach(row => {
      if (row.label === '__divider__') {
        y = ensureSpace(y, 12);
        doc.setDrawColor(...BORDER);
        doc.line(marginL + 10, y, W - marginR - 10, y);
        y += 10;
        return;
      }
      y = ensureSpace(y, 16);
      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      setColor(...CREAM);
      doc.text(row.label, marginL + 10, y);
      if (row.detail) { setColor(...GREY); doc.text(row.detail, W - marginR, y, { align: 'right' }); }
      y += 13;
    });
    y += 6;
  }

  // Investment section
  const pricing = calculatePricingSummary(getDays(), getPricingInputs());
  const showIntro = $('showIntro').checked;
  const investH = computeInvestmentBoxHeight(pricing, showIntro);
  y = ensureSpace(y, investH + 40);

  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');
  setColor(...GOLD);
  doc.text('INVESTMENT', marginL, y);
  y += 14;
  doc.setDrawColor(...BORDER);
  doc.setLineWidth(0.4);
  doc.line(marginL, y, W - marginR, y);
  y += 10;

  const boxTop = y;
  setFill(...PANEL);
  doc.roundedRect(marginL, boxTop, contentW, investH, 4, 4, 'F');
  y = boxTop + 14;

  if (pricing.model === 'hourly') {
    pricing.dayBreakdown.forEach(d => {
      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      setColor(...CREAM);
      doc.text(d.label, marginL + 12, y);
      setColor(...GREY);
      doc.text(`$${d.amount.toLocaleString()}`, W - marginR - 12, y, { align: 'right' });
      y += 13;
    });
  }

  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  setColor(...CREAM);
  const baseLabel = pricing.model === 'hourly' ? `Base Total (${pricing.totalHours} hrs)` : 'Package Rate';
  doc.text(baseLabel, marginL + 12, y);
  doc.text(`$${pricing.baseTotal.toLocaleString()}`, W - marginR - 12, y, { align: 'right' });
  y += 13;

  if (pricing.retainerFee > 0) {
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    setColor(...GREY);
    doc.text('Retainer / Booking Fee', marginL + 12, y);
    doc.text(`$${pricing.retainerFee.toLocaleString()}`, W - marginR - 12, y, { align: 'right' });
    y += 13;
  }

  if (showIntro) {
    const std = $('standardRate').value;
    if (std) {
      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      setColor(...GREY);
      doc.text(`Standard Rate: ${std} (Introductory Pricing)`, marginL + 12, y);
      y += 12;
    }
  }

  doc.setDrawColor(...BORDER);
  doc.line(marginL + 12, y, W - marginR - 12, y);
  y += 8;

  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  setColor(...GOLD);
  doc.text(`$${pricing.total.toLocaleString()}`, W - marginR - 12, y, { align: 'right' });
  setColor(...GREY);
  doc.setFontSize(8);
  doc.text('Estimated Total', marginL + 12, y);
  y = boxTop + investH + 16;

  // Additional Information section
  const deposit = $('deposit').value.trim();
  const validity = $('validity').value.trim();
  const balanceDue = $('balanceDue').value.trim();
  const extraNotes = $('extraNotes').value.trim();
  const travelType = $('travelType').value;

  if (deposit || validity || balanceDue || extraNotes || travelType !== 'none') {
    y = ensureSpace(y, 40);
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    setColor(...GOLD);
    doc.text('ADDITIONAL INFORMATION', marginL, y);
    y += 14;
    doc.setDrawColor(...BORDER);
    doc.setLineWidth(0.4);
    doc.line(marginL, y, W - marginR, y);
    y += 10;

    const infoRows = [];
    if (deposit) infoRows.push(['Deposit Requirement', deposit]);
    if (validity) infoRows.push(['Quote Validity', validity]);
    if (balanceDue) infoRows.push(['Balance Due', balanceDue]);
    if (travelType === 'separate') infoRows.push(['Travel & Accommodation', 'Billed separately — details to be confirmed']);
    if (travelType === 'included') infoRows.push(['Travel & Accommodation', 'Included in quoted price']);

    infoRows.forEach(([lbl, val]) => {
      y = ensureSpace(y, 16);
      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      setColor(...GREY);
      doc.text(lbl, marginL + 10, y);
      setColor(...CREAM);
      doc.text(val, W - marginR, y, { align: 'right' });
      y += 13;
    });

    if (extraNotes) {
      y = ensureSpace(y, 16);
      doc.setFontSize(8);
      setColor(...GREY);
      const wrapped = doc.splitTextToSize(extraNotes, contentW - 20);
      doc.text(wrapped, marginL + 10, y);
      y += wrapped.length * 12 + 4;
    }
  }

  // Output
  if (action === 'preview') {
    revokePreviewUrl();
    const blob = doc.output('blob');
    previewObjectUrl = URL.createObjectURL(blob);
    $('previewFrame').src = previewObjectUrl;
    $('previewModal').classList.remove('hidden');
  } else {
    const name = $('clientName').value || 'Client';
    doc.save(`Aakaara-Quote-${name}-${new Date().toISOString().slice(0, 10)}.pdf`);
  }
}

// ── CRM SAVE ──────────────────────────────────────────────────────
function sendQuoteEmail() {
  const quotes = readStorage(APP_SETTINGS.dashboardStorageKey) || [];
  const maxId = quotes.reduce((m, q) => Math.max(m, q.id || 0), 0);
  const dates = [...$('daysContainer').querySelectorAll('[data-field="date"]')]
    .map(inp => inp.value).filter(Boolean).sort();
  const pricing = calculatePricingSummary(getDays(), getPricingInputs());
  const venueName = $('venueName').value.trim();
  const city = $('location').value.trim();
  const record = {
    id: maxId + 1,
    clientName: $('clientName').value,
    clientEmail: $('clientEmail').value,
    phone: $('clientPhone').value,
    eventDate: dates[0] || '',
    eventDateTo: dates[dates.length - 1] || '',
    status: 'sent',
    quotedPrice: pricing.total,
    confirmedPrice: null,
    shootType: $('eventType').value,
    location: [venueName, city].filter(Boolean).join(', '),
    quoteRef: $('quoteRef').value,
    depositPaid: null,
    followUpDate: null,
    notes: '',
  };
  quotes.push(record);
  writeStorage(APP_SETTINGS.dashboardStorageKey, quotes);
  clearDraft();
  generatePDF('download');
  showToast('Quote sent and saved to CRM');
  setTimeout(closePreview, 600);
}

// ── TOAST ─────────────────────────────────────────────────────────
function showToast(message) {
  let toast = $('toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'toast';
    document.body.appendChild(toast);
  }
  toast.textContent = message;
  toast.classList.add('visible');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('visible'), 3000);
}

// ── UI TOGGLE HELPERS ─────────────────────────────────────────────
function toggleAddonFields() {
  $('delEngagementNotes').classList.toggle('hidden', !$('delEngagement').checked);
  $('delAddlHoursRateWrap').classList.toggle('hidden', !$('delAddlHours').checked);
  $('delRushFeeWrap').classList.toggle('hidden', !$('delRush').checked);
}

function togglePricingFields() {
  const isHourly = $('pricingModel').value === 'hourly';
  $('hourlyRateGroup').classList.toggle('hidden', !isHourly);
  $('flatRateGroup').classList.toggle('hidden', isHourly);
  $('travelAmountGroup').classList.toggle('hidden', $('travelType').value !== 'fixed');
  $('standardRate').classList.toggle('hidden', !$('showIntro').checked);
}

// ── INIT HELPERS ──────────────────────────────────────────────────
function initQuoteRef() {
  const quotes = readStorage(APP_SETTINGS.dashboardStorageKey) || [];
  const refs = quotes.map(q => q.quoteRef).filter(Boolean);
  if (!$('quoteRef').value) $('quoteRef').value = generateQuoteRef(refs);
  $('quoteRefDisplay').textContent = $('quoteRef').value;
}

// ── INIT ──────────────────────────────────────────────────────────
function init() {
  const draft = readStorage(APP_SETTINGS.draftStorageKey);
  if (draft) {
    applyDraftState(draft);
  } else if (!loadBriefFromQuery()) {
    addDay();
  }
  initQuoteRef();
  togglePricingFields();
  toggleAddonFields();
  recalcTotal();

  // Global input delegation
  document.addEventListener('input', e => {
    if (!e.target.closest('#qgMain') && !e.target.closest('#generateBar')) return;
    recalcTotal();
    scheduleDraftSave();
    if (e.target.dataset.field === 'hours') {
      e.target.classList.remove('hours-auto');
    }
    if (e.target.dataset.field === 'eventDuration') {
      const dayBlock = e.target.closest('.day-block');
      if (dayBlock) recalcDayHours(dayBlock);
    }
    if (e.target.dataset.field === 'eventPhotos') {
      const eventItem = e.target.closest('[data-event-item]');
      const dayBlock = e.target.closest('.day-block');
      if (eventItem) updatePhotoPill(eventItem);
      if (dayBlock) recalcDayPhotos(dayBlock);
    }
    if (e.target.id === 'quoteRef') {
      $('quoteRefDisplay').textContent = e.target.value;
    }
  });

  document.addEventListener('change', e => {
    if (['pricingModel', 'travelType', 'showIntro'].includes(e.target.id)) {
      togglePricingFields();
      recalcTotal();
      scheduleDraftSave();
    }
    if (['delEngagement', 'delAddlHours', 'delRush'].includes(e.target.id)) {
      toggleAddonFields();
      scheduleDraftSave();
    }
    if (e.target.dataset.field === 'date') scheduleDraftSave();
  });

  // Event delegation on days container
  $('daysContainer').addEventListener('click', e => {
    const actionEl = e.target.closest('[data-action]');
    if (!actionEl) return;
    const action = actionEl.dataset.action;
    if (action === 'addEvent') {
      addEvent(e.target.closest('.day-block'));
      scheduleDraftSave();
    } else if (action === 'removeEvent') {
      removeEvent(e.target.closest('[data-event-item]'));
    } else if (action === 'removeDay') {
      removeDay(e.target.closest('.day-block'));
    }
  });

  $('addDayBtn').addEventListener('click', () => { addDay(); scheduleDraftSave(); });
  $('importBtn').addEventListener('click', importBrief);
  $('resetBtn').addEventListener('click', () => {
    if (!confirm('Reset all fields? This cannot be undone.')) return;
    clearDraft();
    $('daysContainer').textContent = '';
    dayCount = 0;
    DRAFT_VALUE_FIELD_IDS.forEach(id => { const el = $(id); if (el) el.value = ''; });
    DRAFT_CHECK_FIELD_IDS.forEach(id => { const el = $(id); if (el) el.checked = false; });
    DRAFT_ADDON_FIELDS.forEach(id => { const el = $(id); if (el) el.value = ''; });
    addDay();
    initQuoteRef();
    togglePricingFields();
    toggleAddonFields();
    recalcTotal();
  });
  $('previewBtn').addEventListener('click', openPreview);
  $('topbarPreviewBtn').addEventListener('click', openPreview);
  $('closePreviewBtn').addEventListener('click', closePreview);
  $('previewOverlay').addEventListener('click', closePreview);
  $('confirmSendBtn').addEventListener('click', sendQuoteEmail);
  $('newQuoteBtn').addEventListener('click', () => {
    if (!confirm('Start a new quote? Unsaved changes will be lost.')) return;
    clearDraft();
    window.location.reload();
  });
  $('dashboardBtn').addEventListener('click', () => { window.location.href = 'dashboard.html'; });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closePreview(); });
}

init();
