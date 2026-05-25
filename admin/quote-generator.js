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
    date: block.querySelector('[data-field="date"]').value,
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
  const W = 612, H = 792;
  const mL = 64, mR = 64;
  const cW = W - mL - mR;
  let y = 0;

  // Embed Cormorant Garamond
  if (typeof CORMORANT_REGULAR !== 'undefined') {
    doc.addFileToVFS('CormorantGaramond-Regular.ttf', CORMORANT_REGULAR);
    doc.addFont('CormorantGaramond-Regular.ttf', 'CormorantGaramond', 'normal');
    doc.addFileToVFS('CormorantGaramond-Italic.ttf', CORMORANT_ITALIC);
    doc.addFont('CormorantGaramond-Italic.ttf', 'CormorantGaramond', 'italic');
  }
  const CG = typeof CORMORANT_REGULAR !== 'undefined' ? 'CormorantGaramond' : 'times';

  const COPPER = [201, 149, 107];
  const CREAM  = [240, 235, 225];
  const DARK   = [10, 9, 8];
  const GREY   = [130, 120, 105];
  const PANEL  = [28, 24, 18];
  const BORD   = [55, 48, 36];
  const WHITE  = [255, 255, 255];

  const sc = (...c) => doc.setTextColor(...c);
  const sf = (...c) => doc.setFillColor(...c);
  const sd = (...c) => { doc.setDrawColor(...c); };

  // Copper top stripe drawn on every non-cover page
  function drawTopStripe() {
    sf(...COPPER); doc.rect(0, 0, W, 3, 'F');
  }

  const clientName = $('clientName').value || 'Client Name';
  const eventType  = $('eventType').value || 'Photography';
  const venueName  = $('venueName').value.trim();
  const city       = $('location').value.trim();
  const locationStr = [venueName, city].filter(Boolean).join(', ');
  const dateRange  = formatDateRange();
  const quoteDate  = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  const ref        = $('quoteRef').value;
  const pricing    = calculatePricingSummary(getDays(), getPricingInputs());
  const days       = getDays();
  const numDays    = days.length;
  const totalHours = days.reduce((s, d) => s + (parseFloat(d.hours) || 0), 0);
  const travelType = $('travelType').value;
  const deposit    = $('deposit').value.trim();
  const validity   = $('validity').value.trim();
  const balanceDue = $('balanceDue').value.trim();
  const extraNotes = $('extraNotes').value.trim();
  const customNotes = $('customNotes').value.trim();

  // Collect scope items from checked deliverables
  const scopeItems = [];
  if ($('delEdited').checked)       scopeItems.push('Edited photos with professional color grading');
  if ($('delRaw').checked)          scopeItems.push('All raw images delivered');
  if ($('delGallery').checked)      scopeItems.push('Online gallery for viewing and downloads');
  if ($('delSneakPeek').checked)    scopeItems.push('Sneak peek — 5-10 images within 48 hours');
  if ($('delTeaser').checked)       scopeItems.push('Teaser reel — 60 second social media cut');
  if ($('delDoc').checked)          scopeItems.push('Documentary Film — full ceremony & reception');
  if ($('delTraditional').checked)  scopeItems.push('Traditional video — full coverage edit');
  if ($('delHighlight').checked)    scopeItems.push('Highlight Video (2-3 minutes) — cinematic edit');
  if ($('delDrone').checked)        scopeItems.push('Drone footage where permitted');
  if ($('delLive').checked)         scopeItems.push('Livestream — private streaming link');
  if ($('delSecondShooter').checked) scopeItems.push('Second photographer for full coverage');
  if ($('delEngagement').checked)   scopeItems.push($('delEngagementNotes').value || 'Engagement session — pre-wedding couple shoot');

  const totalPgs = 4;

  function drawFooter() {
    sf(...PANEL); doc.rect(0, H - 50, W, 50, 'F');
    sd(...BORD); doc.setLineWidth(0.4);
    doc.line(mL, H - 50, W - mL, H - 50);
    doc.setFontSize(7); doc.setFont('helvetica', 'normal'); sc(...GREY);
    doc.text('aakaarastudiosnyc.com  |  info@aakaarastudiosnyc.com  |  +1 (475) 332-2020', W / 2, H - 20, { align: 'center' });
  }

  function drawPageHeader(pageNum) {
    sf(...PANEL); doc.rect(0, 0, W, 46, 'F');
    sd(...BORD); doc.setLineWidth(0.4);
    doc.line(mL, 46, W - mL, 46);
    doc.setFontSize(7.5); doc.setFont('helvetica', 'normal');
    sc(...COPPER); doc.text('AAKAARA STUDIOS', mL, 27);
    sc(...GREY); doc.text(`${String(pageNum).padStart(2, '0')} / ${String(totalPgs).padStart(2, '0')}`, W / 2, 27, { align: 'center' });
    if (ref) { sc(...COPPER); doc.text(ref, W - mR, 27, { align: 'right' }); }
    y = 68;
  }

  function sectionHeader(title) {
    doc.setFontSize(7.5); doc.setFont('helvetica', 'bold'); sc(...COPPER);
    doc.text(title, mL, y);
    y += 8;
    sd(...BORD); doc.setLineWidth(0.4);
    doc.line(mL, y, W - mR, y);
    y += 16;
  }

  // ── PAGE 1: COVER ──────────────────────────────────────────────────
  sf(...DARK); doc.rect(0, 0, W, H, 'F');

  // Studio name at top
  doc.setFontSize(10); doc.setFont('helvetica', 'normal'); sc(...COPPER);
  doc.text('A A K A A R A   S T U D I O S', W / 2, 36, { align: 'center' });
  doc.setFontSize(7.5); sc(...GREY);
  doc.text('N E W   Y O R K   C I T Y', W / 2, 50, { align: 'center' });
  sd(...BORD); doc.setLineWidth(0.5);
  doc.line(mL, 58, W - mL, 58);

  // Large event type title
  const isWedding = eventType.toLowerCase().includes('wedding');
  if (isWedding) {
    doc.setFontSize(56); doc.setFont(CG, 'normal'); sc(...WHITE);
    doc.text('Wedding', W / 2, 200, { align: 'center' });
    doc.text('Photography', W / 2, 265, { align: 'center' });
  } else {
    doc.setFontSize(52); doc.setFont(CG, 'normal'); sc(...WHITE);
    doc.text(eventType, W / 2, 232, { align: 'center' });
  }

  // Subtitle
  doc.setFontSize(11); doc.setFont(CG, 'italic'); sc(...GREY);
  doc.text('—  Professional Coverage Proposal  —', W / 2, 294, { align: 'center' });
  sd(...BORD); doc.setLineWidth(0.5);
  doc.line(W / 2 - 44, 306, W / 2 + 44, 306);

  // "Prepared for" + client name
  doc.setFontSize(10); doc.setFont(CG, 'italic'); sc(...GREY);
  doc.text('Prepared for', W / 2, 332, { align: 'center' });
  doc.setFontSize(34); doc.setFont(CG, 'normal'); sc(...COPPER);
  doc.text(clientName, W / 2, 374, { align: 'center' });

  // EVENT DETAILS table
  const detailRows = [
    ['Client',           clientName],
    ['Location',         locationStr || '—'],
    ['Coverage Dates',   dateRange   || '—'],
    ['Coverage Window',  numDays > 1 ? `${numDays} Days` : '1 Day'],
    ['Total Coverage',   `${totalHours} Hours`],
    ['Quote Date',       quoteDate],
  ];
  const rowH = 26, tableTop = 400, tableH = detailRows.length * rowH + 14;
  sf(...PANEL); doc.roundedRect(mL, tableTop, cW, tableH, 3, 3, 'F');
  sd(...BORD); doc.setLineWidth(0.3);
  detailRows.forEach(([label, val], i) => {
    const ry = tableTop + 14 + i * rowH + 12;
    doc.setFontSize(8); doc.setFont('helvetica', 'normal');
    sc(...COPPER); doc.text(label, mL + 14, ry);
    sc(...CREAM);  doc.text(val,   W - mR - 14, ry, { align: 'right' });
    if (i < detailRows.length - 1) doc.line(mL + 14, ry + 9, W - mR - 14, ry + 9);
  });

  drawFooter();

  // ── PAGE 2: EVENT SCHEDULE + SCOPE OF COVERAGE ────────────────────
  doc.addPage();
  sf(...DARK); doc.rect(0, 0, W, H, 'F');
  drawTopStripe();
  drawPageHeader(2); drawFooter();

  sectionHeader('EVENT SCHEDULE');

  $('daysContainer').querySelectorAll('.day-block').forEach((block, di) => {
    const dateVal = block.querySelector('[data-field="date"]').value;
    const dateLabel = dateVal
      ? new Date(dateVal + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }).toUpperCase()
      : `DAY ${di + 1}`;
    const hrs = parseFloat(block.querySelector('[data-field="hours"]').value) || 0;

    doc.setFontSize(7.5); doc.setFont('helvetica', 'bold'); sc(...COPPER);
    doc.text(`DAY ${di + 1}  —  ${dateLabel}`, mL, y);
    y += 14;

    block.querySelectorAll('[data-event-item]').forEach(item => {
      const name  = item.querySelector('[data-field="eventName"]').value;
      const dur   = item.querySelector('[data-field="eventDuration"]').value;
      const notes = item.querySelector('[data-field="eventNotes"]').value;
      if (!name && !dur) return;

      const cardH = notes ? 40 : 28;
      sf(...PANEL); doc.roundedRect(mL, y, cW, cardH, 2, 2, 'F');
      // Copper left accent bar
      sf(...COPPER); doc.roundedRect(mL, y, 3, cardH, 1, 1, 'F');
      doc.setFontSize(10); doc.setFont(CG, 'normal'); sc(...WHITE);
      doc.text(name || '—', mL + 14, y + 16);
      if (dur) {
        doc.setFont('helvetica', 'normal'); sc(...GREY);
        doc.setFontSize(8);
        doc.text(String(dur), W - mR - 12, y + 16, { align: 'right' });
      }
      if (notes) {
        doc.setFontSize(7.5); doc.setFont('helvetica', 'normal'); sc(...GREY);
        doc.text(notes, mL + 14, y + 30);
      }
      y += notes ? 46 : 34;
    });

    // Day total bar
    sf(38, 32, 24); doc.roundedRect(mL, y, cW, 22, 2, 2, 'F');
    doc.setFontSize(8); doc.setFont('helvetica', 'normal');
    sc(...GREY);   doc.text(`Day ${di + 1} Total`, mL + 12, y + 14);
    sc(...COPPER); doc.text(`${hrs} Hours`, W - mR - 12, y + 14, { align: 'right' });
    y += 30;
  });

  y += 10;

  if (scopeItems.length > 0) {
    sectionHeader('SCOPE OF COVERAGE');
    scopeItems.forEach(item => {
      doc.setFontSize(8); doc.setFont('helvetica', 'normal');
      sf(...COPPER); doc.circle(mL + 5, y - 2.5, 2, 'F');
      sc(...CREAM); doc.text(item, mL + 16, y);
      y += 14;
    });
  }

  // ── PAGE 3: DELIVERABLES + INVESTMENT + ADDITIONAL INFO ───────────
  doc.addPage();
  sf(...DARK); doc.rect(0, 0, W, H, 'F');
  drawTopStripe();
  drawPageHeader(3); drawFooter();

  sectionHeader('DELIVERABLES SUMMARY');

  const delRows = getDeliverableRows();
  // Table header row
  sf(40, 34, 26); doc.rect(mL, y, cW, 20, 'F');
  doc.setFontSize(7.5); doc.setFont('helvetica', 'bold');
  sc(...COPPER); doc.text('ITEM', mL + 12, y + 13);
  doc.text('DETAILS', W - mR - 12, y + 13, { align: 'right' });
  y += 20;

  // Count non-divider rows to size the panel
  const dataRows = delRows.filter(r => r.label !== '__divider__');
  const panelH = dataRows.length * 22 + 10;
  sf(...PANEL); doc.rect(mL, y, cW, panelH, 'F');
  let delY = y + 10;
  delRows.forEach(row => {
    if (row.label === '__divider__') {
      sd(...BORD); doc.setLineWidth(0.3);
      doc.line(mL + 12, delY + 3, W - mR - 12, delY + 3);
      delY += 10;
      return;
    }
    doc.setFontSize(8); doc.setFont('helvetica', 'normal');
    sc(...CREAM); doc.text(row.label, mL + 12, delY + 4);
    if (row.detail) { sc(...GREY); doc.text(row.detail, W - mR - 12, delY + 4, { align: 'right' }); }
    delY += 22;
  });
  y = delY + 16;

  sectionHeader('INVESTMENT');

  if (pricing.model === 'hourly' && pricing.hourlyRate > 0) {
    // Left: large hourly rate display
    const rateBoxW = cW * 0.38;
    sf(...PANEL); doc.roundedRect(mL, y, rateBoxW, 64, 3, 3, 'F');
    doc.setFontSize(7); doc.setFont('helvetica', 'normal'); sc(...GREY);
    doc.text('HOURLY RATE', mL + 12, y + 16);
    doc.setFontSize(28); doc.setFont('helvetica', 'bold'); sc(...WHITE);
    doc.text(`$${pricing.hourlyRate}`, mL + 12, y + 46);
    const rateW = doc.getTextWidth(`$${pricing.hourlyRate}`);
    doc.setFontSize(9); doc.setFont('helvetica', 'normal'); sc(...GREY);
    doc.text('/ hour', mL + 14 + rateW, y + 46);

    // Right: breakdown — two explicit columns inside the right half
    const bxL  = mL + rateBoxW + 16;
    const amtX = W - mR - 12;   // right-align anchor with safe inner padding
    let bY = y + 16;
    pricing.dayBreakdown.forEach(d => {
      doc.setFontSize(8); doc.setFont('helvetica', 'normal');
      sc(...GREY);  doc.text(`${d.label}: ${d.hours} hrs × $${pricing.hourlyRate.toLocaleString()}`, bxL, bY);
      sc(...CREAM); doc.text(`$${d.amount.toLocaleString()}`, amtX, bY, { align: 'right' });
      bY += 14;
    });
    doc.setFontSize(8.5); doc.setFont('helvetica', 'bold');
    sc(...CREAM); doc.text('Coverage Total', bxL, bY);
    sc(...COPPER); doc.text(`$${pricing.baseTotal.toLocaleString()}`, amtX, bY, { align: 'right' });
    y += 76;
  } else if (pricing.model === 'flat') {
    sf(...PANEL); doc.roundedRect(mL, y, cW, 30, 3, 3, 'F');
    doc.setFontSize(8); doc.setFont('helvetica', 'normal');
    sc(...GREY); doc.text('Package Rate', mL + 12, y + 19);
    sc(...COPPER); doc.text(`$${pricing.baseTotal.toLocaleString()}`, W - mR - 12, y + 19, { align: 'right' });
    y += 40;
  }

  // Travel row
  if (travelType === 'separate' || travelType === 'included' || travelType === 'fixed') {
    sf(36, 30, 22); doc.roundedRect(mL, y, cW, 22, 2, 2, 'F');
    doc.setFontSize(8); doc.setFont('helvetica', 'normal');
    sc(...GREY); doc.text('TRAVEL & ACCOMMODATION', mL + 12, y + 14);
    const travelVal = travelType === 'fixed'    ? `$${pricing.travelAmount.toLocaleString()}`
                    : travelType === 'separate' ? 'Calculated separately'
                    : 'Included in quoted price';
    sc(...CREAM); doc.text(travelVal, W - mR - 12, y + 14, { align: 'right' });
    y += 30;
  }

  // Retainer
  if (pricing.retainerFee > 0) {
    doc.setFontSize(8); doc.setFont('helvetica', 'normal');
    sc(...GREY); doc.text('Retainer / Booking Fee', mL + 12, y);
    sc(...COPPER); doc.text(`$${pricing.retainerFee.toLocaleString()}`, W - mR - 12, y, { align: 'right' });
    y += 16;
  }

  // Total — prominent box with copper border accent
  sf(...PANEL); doc.roundedRect(mL, y, cW, 52, 3, 3, 'F');
  sf(...COPPER); doc.roundedRect(mL, y, 4, 52, 1, 1, 'F');
  sd(...COPPER); doc.setLineWidth(0.5);
  doc.line(mL + 16, y + 36, W - mR - 12, y + 36);
  doc.setFontSize(7.5); doc.setFont('helvetica', 'normal'); sc(...GREY);
  doc.text('ESTIMATED COVERAGE TOTAL', mL + 16, y + 18);
  doc.setFontSize(30); doc.setFont(CG, 'normal'); sc(...COPPER);
  doc.text(`$${pricing.total.toLocaleString()}`, W - mR - 12, y + 46, { align: 'right' });
  y += 64;

  // Additional Information
  const infoRows = [];
  if (deposit)   infoRows.push(['Deposit',   deposit]);
  if (validity)  infoRows.push(['Timeline',  validity]);
  if (balanceDue) infoRows.push(['Balance Due', balanceDue]);
  if (infoRows.length > 0 || extraNotes) {
    sectionHeader('ADDITIONAL INFORMATION');
    infoRows.forEach(([lbl, val]) => {
      doc.setFontSize(8); doc.setFont('helvetica', 'normal');
      sc(...GREY);  doc.text(lbl, mL + 12, y);
      sc(...CREAM); doc.text(val, mL + 130, y);
      y += 14;
    });
    if (extraNotes) {
      doc.setFontSize(8); doc.setFont('helvetica', 'normal'); sc(...GREY);
      const wrapped = doc.splitTextToSize(extraNotes, cW - 24);
      doc.text(wrapped, mL + 12, y);
      y += wrapped.length * 12 + 4;
    }
    y += 6;
  }

  // Custom deliverable notes
  if (customNotes) {
    sectionHeader('CUSTOM DELIVERABLE NOTES');
    customNotes.split('\n').forEach(line => {
      if (!line.trim()) return;
      doc.setFontSize(8); doc.setFont('helvetica', 'normal'); sc(...CREAM);
      doc.text(line.trim(), mL + 12, y);
      y += 14;
    });
    y += 6;
  }

  // Validity note
  if (validity) {
    sf(36, 30, 22); doc.roundedRect(mL, y, cW, 22, 2, 2, 'F');
    doc.setFontSize(7.5); doc.setFont('helvetica', 'normal'); sc(...GREY);
    doc.text(`This quote is valid for ${validity} from the date above.`, W / 2, y + 14, { align: 'center' });
  }

  // ── PAGE 4: CLOSING (no header bar — personal letter feel) ────────
  doc.addPage();
  sf(...DARK); doc.rect(0, 0, W, H, 'F');
  drawFooter();

  // Faint petal mark — 6 rotated petal paths in copper at 12% opacity
  const petalPath = 'M0,-28 C7,-28 14,-19 11,-5 C9,7 -4,11 -11,5 C-19,-1 -14,-20 -5,-27 C-4,-27.6 -1,-28 0,-28Z';
  const petalRotations = [0, 60, 120, 180, 240, 300];
  const petalOpacities = [0.09, 0.06, 0.04, 0.09, 0.06, 0.04];
  const px = W / 2, py = 180;
  doc.saveGraphicsState();
  petalRotations.forEach((deg, i) => {
    const rad = deg * Math.PI / 180;
    const cos = Math.cos(rad), sin = Math.sin(rad);
    // Transform petal path points to page coords
    const pts = [
      [0, -28], [7, -28], [14, -19], [11, -5],
      [9, 7], [-4, 11], [-11, 5],
      [-19, -1], [-14, -20], [-5, -27], [-4, -27.6], [-1, -28], [0, -28],
    ].map(([x, z]) => [px + (x * cos - z * sin), py + (x * sin + z * cos)]);
    doc.setGState(new doc.GState({ opacity: petalOpacities[i] }));
    sf(...COPPER);
    doc.lines(
      [[pts[1][0] - pts[0][0], pts[1][1] - pts[0][1]]],
      pts[0][0], pts[0][1], [1, 1], 'F', true
    );
  });
  doc.restoreGraphicsState();

  // Thin copper rule above text
  sd(...COPPER); doc.setLineWidth(0.5);
  doc.line(W / 2 - 30, py + 50, W / 2 + 30, py + 50);

  const cx = W / 2, cy = py + 78;
  doc.setFontSize(17); doc.setFont(CG, 'normal'); sc(...WHITE);
  doc.text(`${clientName}, thank you for trusting us with your story.`, cx, cy, { align: 'center' });

  doc.setFontSize(11); doc.setFont(CG, 'normal'); sc(...GREY);
  doc.text("We don't just photograph moments — we preserve the emotions within them.", cx, cy + 34, { align: 'center' });
  doc.text('It would be an honor to be part of your celebration.', cx, cy + 52, { align: 'center' });

  doc.setFontSize(10); doc.setFont(CG, 'italic'); sc(...GREY);
  doc.text('With warmth,', cx, cy + 88, { align: 'center' });

  doc.setFontSize(22); doc.setFont(CG, 'normal'); sc(...WHITE);
  doc.text('Sudhakar Avula', cx, cy + 118, { align: 'center' });

  doc.setFontSize(8); doc.setFont('helvetica', 'normal'); sc(...GREY);
  doc.text('Founder & Lead Photographer, Aakaara Studios', cx, cy + 134, { align: 'center' });

  doc.setFontSize(12); doc.setFont(CG, 'italic'); sc(...COPPER);
  doc.text('Every story deserves its own canvas.', cx, cy + 182, { align: 'center' });

  // ── OUTPUT ─────────────────────────────────────────────────────────
  if (action === 'preview') {
    revokePreviewUrl();
    const blob = doc.output('blob');
    previewObjectUrl = URL.createObjectURL(blob);
    $('previewFrame').src = previewObjectUrl;
    $('previewModal').classList.remove('hidden');
  } else {
    const name = $('clientName').value || 'Client';
    doc.save(`Aakaara_Studios_Quote_${name}_${new Date().toISOString().slice(0, 10)}.pdf`);
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

// ── URL PARAM PRE-FILL ────────────────────────────────────────────
function loadFromUrlParams() {
  const p = new URLSearchParams(location.search);
  if (!p.has('name')) return;

  $('clientName').value  = p.get('name')  || '';
  $('clientEmail').value = p.get('email') || '';
  $('clientPhone').value = p.get('phone') || '';

  const et = p.get('eventType');
  if (et) $('eventType').value = et;

  $('venueName').value = p.get('venue') || '';
  $('location').value  = p.get('city')  || '';

  if (p.get('live') === 'yes') {
    const events = p.get('liveEvents');
    const notesText = events
      ? `Live streaming required: ${events}`
      : 'Live streaming required';
    $('customNotes').value = notesText;
  }

  let days = [];
  try { days = JSON.parse(p.get('days') || '[]'); } catch {}
  if (days.length > 0) {
    // Clear any default day(s) added during init before adding URL-param days
    $('daysContainer').textContent = '';
    dayCount = 0;
    days.forEach(day => addDay(day));
  }

  const banner = document.createElement('div');
  banner.className   = 'intake-prefill-banner';
  banner.textContent = 'Pre-filled from client intake';
  $('qgMain').insertBefore(banner, $('qgMain').firstChild);

  scheduleDraftSave();
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
    if (e.target.type === 'checkbox' && e.target.closest('#qgMain')) scheduleDraftSave();
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
    DRAFT_VALUE_FIELD_IDS.forEach(id => {
      const el = $(id);
      if (!el) return;
      if (el.tagName === 'SELECT') { el.selectedIndex = 0; } else { el.value = ''; }
    });
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
  loadFromUrlParams();
}

init();
