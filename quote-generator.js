// ===== LOGIN =====
const ACCESS_CODE = 'aakaara2026';

function doLogin() {
  const val = document.getElementById('loginPass').value;
  if (val === ACCESS_CODE) {
    document.getElementById('loginScreen').classList.add('hidden');
    document.getElementById('app').classList.add('visible');
  } else {
    document.getElementById('loginError').classList.add('show');
    setTimeout(() => document.getElementById('loginError').classList.remove('show'), 2000);
  }
}
document.getElementById('loginPass').addEventListener('keydown', e => {
  if (e.key === 'Enter') doLogin();
});

// ===== SET TODAY'S DATE =====
document.getElementById('quoteDate').valueAsDate = new Date();

// ===== DAY MANAGEMENT =====
let dayCount = 0;

function addDay() {
  dayCount++;
  const div = document.createElement('div');
  div.className = 'day-block';
  div.id = `day-${dayCount}`;
  const dayNum = dayCount;
  div.innerHTML = `
    <div class="day-header">
      <div class="day-title">Day ${dayNum}</div>
      <button class="day-remove" onclick="removeDay(${dayNum})">Remove</button>
    </div>
    <div class="form-row">
      <div class="form-group">
        <label class="form-label">Date</label>
        <input class="form-input" type="date" data-field="date">
      </div>
      <div class="form-group">
        <label class="form-label">Total Hours</label>
        <input class="form-input" type="number" data-field="hours" placeholder="e.g. 4" oninput="recalcTotal()">
      </div>
    </div>
    <div class="events-list" id="events-${dayNum}"></div>
    <button class="add-btn" onclick="addEvent(${dayNum})" style="margin-top:0.5rem;">+ Add Event to Day ${dayNum}</button>
  `;
  document.getElementById('daysContainer').appendChild(div);
  addEvent(dayNum);
  recalcTotal();
}

function removeDay(num) {
  const el = document.getElementById(`day-${num}`);
  if (el) el.remove();
  recalcTotal();
}

function addEvent(dayNum) {
  const container = document.getElementById(`events-${dayNum}`);
  if (!container) return;
  const div = document.createElement('div');
  div.className = 'event-item';
  div.innerHTML = `
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
    <button class="event-remove" onclick="this.parentElement.remove()">&times;</button>
  `;
  container.appendChild(div);
}

// ===== PRICING UI =====
function updatePricingUI() {
  const model = document.getElementById('pricingModel').value;
  document.getElementById('hourlyRateGroup').style.display = model === 'hourly' ? '' : 'none';
  document.getElementById('flatRateGroup').style.display = model === 'flat' ? '' : 'none';

  const showIntro = document.getElementById('showIntro').checked;
  document.getElementById('standardRateGroup').style.display = showIntro ? '' : 'none';

  const travelType = document.getElementById('travelType').value;
  document.getElementById('travelFixedRow').style.display = travelType === 'fixed' ? '' : 'none';

  recalcTotal();
}
document.getElementById('travelType').addEventListener('change', updatePricingUI);

function recalcTotal() {
  const model = document.getElementById('pricingModel').value;
  let total = 0;
  let previewHTML = '';

  if (model === 'hourly') {
    const rate = parseFloat(document.getElementById('hourlyRate').value) || 0;
    // Sum hours from all days
    const dayBlocks = document.querySelectorAll('.day-block');
    let totalHours = 0;
    dayBlocks.forEach((block, i) => {
      const hrs = parseFloat(block.querySelector('[data-field="hours"]').value) || 0;
      const dateInput = block.querySelector('[data-field="date"]');
      const dateStr = dateInput.value ? formatDate(dateInput.value) : `Day ${i+1}`;
      totalHours += hrs;
      if (hrs > 0) {
        previewHTML += `<div class="preview-row"><span class="label">${dateStr}: ${hrs} hrs × $${rate}</span><span class="value">$${(hrs * rate).toLocaleString()}</span></div>`;
      }
    });
    total = totalHours * rate;
    previewHTML += `<div class="preview-row total"><span class="label">Base Total (${totalHours} hours)</span><span class="value">$${total.toLocaleString()}</span></div>`;
  } else {
    total = parseFloat(document.getElementById('flatRate').value) || 0;
    previewHTML = `<div class="preview-row total"><span class="label">Package Price</span><span class="value">$${total.toLocaleString()}</span></div>`;
  }

  const travelType = document.getElementById('travelType').value;
  if (travelType === 'fixed') {
    const travelAmt = parseFloat(document.getElementById('travelAmount').value) || 0;
    previewHTML += `<div class="preview-row"><span class="label">Travel & Accommodation</span><span class="value">$${travelAmt.toLocaleString()}</span></div>`;
    total += travelAmt;
  } else if (travelType === 'separate') {
    previewHTML += `<div class="preview-row"><span class="label">Travel & Accommodation</span><span class="value" style="color:var(--muted)">Separate</span></div>`;
  } else if (travelType === 'included') {
    previewHTML += `<div class="preview-row"><span class="label">Travel & Accommodation</span><span class="value" style="color:var(--gold)">Included</span></div>`;
  }

  document.getElementById('pricingPreview').innerHTML = previewHTML;
  document.getElementById('totalDisplay').textContent = '$' + total.toLocaleString();
}

function formatDate(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

function formatQuoteDate(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

// ===== TOAST =====
function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 3000);
}

// ===== RESET =====
function resetForm() {
  if (!confirm('Start a new quote? Current data will be cleared.')) return;
  document.getElementById('clientName').value = '';
  document.getElementById('clientEmail').value = '';
  document.getElementById('location').value = '';
  document.getElementById('quoteDate').valueAsDate = new Date();
  document.getElementById('daysContainer').innerHTML = '';
  dayCount = 0;
  addDay(); // Add Day 1 back
  document.getElementById('editedCount').value = '200';
  document.getElementById('customNotes').value = '';
  document.getElementById('extraNotes').value = '';
  
  // Reset checkboxes to defaults
  document.getElementById('delEdited').checked = true;
  document.getElementById('delRaw').checked = true;
  document.getElementById('delGallery').checked = true;
  const optional = ['delSneakPeek', 'delTeaser', 'delDoc', 'delTraditional', 'delHighlight', 'delDrone', 'delLive', 'delSecondShooter'];
  optional.forEach(id => { if(document.getElementById(id)) document.getElementById(id).checked = false; });

  recalcTotal();
  showToast('Form reset');
}

// ===== PDF GENERATION =====
function generatePDF(action = 'download') {
 try {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF('p', 'pt', 'letter');
  const W = 612, H = 792;
  const M = 55;

  // Colors
  const GOLD = [201, 149, 107];
  const GOLD_DIM = [160, 120, 86];
  const CREAM = [240, 235, 228];
  const MUTED = [138, 133, 128];
  const DARK_BG = [10, 10, 10];
  const SURFACE = [17, 17, 17];

  // Helpers
  function pageBg() { doc.setFillColor(...DARK_BG); doc.rect(0, 0, W, H, 'F'); }
  function goldLine(x1, y, x2, alpha) {
    doc.setDrawColor(...GOLD); doc.setLineWidth(0.5);
    doc.line(x1, y, x2, y);
  }
  function footerBar() {
    goldLine(M, H - 70, W - M);
    doc.setFontSize(6); doc.setTextColor(...MUTED);
    doc.text('aakaarastudiosnyc.com  |  info@aakaarastudiosnyc.com  |  +1 (475) 332-2020', W/2, H - 52, { align: 'center' });
  }
  function headerBar(page, total) {
    doc.setFontSize(6); doc.setTextColor(...GOLD);
    doc.text('A A K A A R A   S T U D I O S', M, 38);
    doc.text(`${String(page).padStart(2,'0')} / ${String(total).padStart(2,'0')}`, W - M, 38, { align: 'right' });
    goldLine(M, 48, W - M);
  }

  // Gather data
  const clientName = document.getElementById('clientName').value || 'Client';
  const eventType = document.getElementById('eventType').value;
  const location = document.getElementById('location').value || 'TBD';
  const quoteDate = document.getElementById('quoteDate').value;
  const quoteDateFormatted = quoteDate ? formatQuoteDate(quoteDate) : 'N/A';
  const model = document.getElementById('pricingModel').value;
  const hourlyRate = parseFloat(document.getElementById('hourlyRate').value) || 0;
  const flatRate = parseFloat(document.getElementById('flatRate').value) || 0;
  const travelType = document.getElementById('travelType').value;
  const showIntro = document.getElementById('showIntro').checked;
  const standardRate = document.getElementById('standardRate').value;
  const editedCount = document.getElementById('editedCount').value || '200';
  const timeline = document.getElementById('timeline').value || '6-8 weeks';
  const deposit = document.getElementById('deposit').value;
  const validity = document.getElementById('validity').value || '30 days';

  // Gather days
  const days = [];
  document.querySelectorAll('.day-block').forEach((block, i) => {
    const date = block.querySelector('[data-field="date"]').value;
    const hours = block.querySelector('[data-field="hours"]').value;
    const events = [];
    block.querySelectorAll('.event-item').forEach(ev => {
      const name = ev.querySelector('[data-field="eventName"]').value;
      const dur = ev.querySelector('[data-field="eventDuration"]').value;
      const notes = ev.querySelector('[data-field="eventNotes"]').value;
      if (name) events.push({ name, dur, notes });
    });
    days.push({ date, hours, events });
  });

  const totalHours = days.reduce((s, d) => s + (parseFloat(d.hours) || 0), 0);
  const totalPages = 4;

  // Deliverables
  const dels = [];
  if (document.getElementById('delEdited').checked) dels.push('Edited photos with professional color grading');
  if (document.getElementById('delRaw').checked) dels.push('All raw images delivered');
  if (document.getElementById('delGallery').checked) dels.push('Online gallery for viewing and downloads');
  if (document.getElementById('delSneakPeek').checked) dels.push('Same-day sneak peek reels (24hr delivery)');
  if (document.getElementById('delTeaser').checked) dels.push('Wedding Teaser (2-3 minutes) — all event highlights');
  if (document.getElementById('delDoc').checked) dels.push('Documentary Film (10 min) — interviews with couple, parents & friends');
  if (document.getElementById('delTraditional').checked) dels.push('Traditional Video Coverage (Full length)');
  if (document.getElementById('delHighlight').checked) dels.push('Highlight Video (2-3 minutes)');
  if (document.getElementById('delDrone').checked) dels.push('Drone Footage — included where permitted');
  if (document.getElementById('delLive').checked) dels.push('Live Wedding Coverage (venue must provide internet)');
  if (document.getElementById('delSecondShooter').checked) dels.push('Second Photographer (Full Coverage)');

  // ===== PAGE 1 — COVER =====
  pageBg();
  goldLine(M, 45, W - M);

  // Logo text
  doc.setFontSize(8); doc.setTextColor(...GOLD);
  doc.text('A A K A A R A   S T U D I O S', W/2, 145, { align: 'center' });
  doc.setFontSize(6); doc.setTextColor(...MUTED);
  doc.text('N E W   Y O R K   C I T Y', W/2, 158, { align: 'center' });

  // Title
  const titleWords = eventType.replace(' Photography', '').split(' ');
  doc.setFont('times', 'normal');
  doc.setFontSize(32); doc.setTextColor(...CREAM);
  doc.text(titleWords.join(' '), W/2, 240, { align: 'center' });
  doc.text('Photography', W/2, 275, { align: 'center' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9); doc.setTextColor(...GOLD);
  doc.text('— Professional Coverage Proposal —', W/2, 303, { align: 'center' });
  goldLine(W/2 - 55, 322, W/2 + 55);

  // Prepared For
  doc.setFont('times', 'italic');
  doc.setFontSize(10); doc.setTextColor(...CREAM);
  doc.text('Prepared for', W/2, 350, { align: 'center' });
  doc.setFont('times', 'normal');
  doc.setFontSize(22); doc.setTextColor(...GOLD);
  doc.text(clientName, W/2, 380, { align: 'center' });

  // Event details on cover
  let y = 420;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6); doc.setTextColor(...GOLD);
  doc.text('EVENT DETAILS', M, y);
  y += 22;

  const coverDetails = [
    ['Client', clientName],
    ['Location', location],
  ];
  if (days.length === 1) {
    coverDetails.push(['Date', days[0].date ? formatDate(days[0].date) : 'TBD']);
    coverDetails.push(['Duration', (days[0].hours || '0') + ' Hours']);
  } else if (days.length > 1) {
    days.forEach((d, i) => {
      coverDetails.push([`Day ${i+1}`, (d.date ? formatDate(d.date) : 'TBD') + '  —  ' + (d.hours || '0') + ' Hours']);
    });
    coverDetails.push(['Total Coverage', totalHours + ' Hours across ' + days.length + ' Days']);
  }

  coverDetails.forEach(([label, value]) => {
    doc.setFillColor(17, 17, 17);
    doc.roundedRect(M, y - 10, W - 2*M, 20, 3, 3, 'F');
    doc.setFontSize(7); doc.setTextColor(...MUTED);
    doc.text(label, M + 12, y + 2);
    doc.setFontSize(8); doc.setTextColor(...CREAM);
    doc.text(value, W - M - 12, y + 2, { align: 'right' });
    y += 26;
  });

  doc.setFontSize(6); doc.setTextColor(...MUTED);
  doc.text('Quote Date: ' + quoteDateFormatted, W/2, y + 12, { align: 'center' });

  footerBar();

  // ===== PAGE 2 — SCHEDULE + SCOPE =====
  doc.addPage();
  pageBg();
  headerBar(2, totalPages);

  y = 78;

  // Day-by-day schedule
  days.forEach((day, di) => {
    doc.setFontSize(6); doc.setTextColor(...GOLD);
    doc.text(`DAY ${di+1}  —  ${day.date ? formatDate(day.date).toUpperCase() : 'TBD'}`, M, y);
    y += 18;

    day.events.forEach(ev => {
      doc.setFillColor(17, 17, 17);
      doc.roundedRect(M, y - 10, W - 2*M, 28, 3, 3, 'F');
      doc.setFontSize(9); doc.setTextColor(...CREAM);
      doc.text(ev.name, M + 12, y + 2);
      if (ev.notes) {
        doc.setFontSize(6.5); doc.setTextColor(...MUTED);
        doc.text(ev.notes, M + 12, y + 12);
      }
      if (ev.dur) {
        doc.setFontSize(7.5); doc.setTextColor(...GOLD);
        doc.text(ev.dur, W - M - 12, y + 2, { align: 'right' });
      }
      y += 34;
    });

    // Day total
    doc.setFillColor(30, 26, 22);
    doc.roundedRect(M, y - 10, W - 2*M, 20, 3, 3, 'F');
    doc.setFontSize(7.5); doc.setTextColor(...GOLD);
    doc.text(`Day ${di+1} Total`, M + 12, y + 2);
    doc.text((day.hours || '0') + ' Hours', W - M - 12, y + 2, { align: 'right' });
    y += 35;
  });

  // Scope
  y += 8;
  doc.setFontSize(6); doc.setTextColor(...GOLD);
  doc.text('SCOPE OF COVERAGE', M, y);
  y += 20;

  dels.forEach(item => {
    doc.setFillColor(...GOLD);
    doc.circle(M + 7, y - 1, 1.5, 'F');
    doc.setFontSize(7.5); doc.setTextColor(...CREAM);
    doc.text(item, M + 16, y);
    y += 16;
  });

  // Live wedding highlight if checked
  if (document.getElementById('delLive').checked) {
    y += 5;
    doc.setFillColor(30, 26, 22);
    doc.roundedRect(M, y - 10, W - 2*M, 35, 4, 4, 'F');
    doc.setDrawColor(...GOLD); doc.setLineWidth(0.8);
    doc.roundedRect(M, y - 10, W - 2*M, 35, 4, 4, 'S');
    doc.setFontSize(5.5); doc.setTextColor(...GOLD);
    doc.text('★  HIGHLIGHTED', M + 12, y + 2);
    doc.setFontSize(9); doc.setTextColor(...CREAM);
    doc.text('Live Wedding Coverage', M + 12, y + 14);
    doc.setFontSize(7); doc.setTextColor(...MUTED);
    doc.text('Included for the wedding ceremony (venue must provide internet)', M + 155, y + 14);
  }

  footerBar();

  // ===== PAGE 3 — DELIVERABLES + INVESTMENT =====
  doc.addPage();
  pageBg();
  headerBar(3, totalPages);

  y = 78;

  // Photo deliverables
  doc.setFontSize(6); doc.setTextColor(...GOLD);
  doc.text('DELIVERABLES SUMMARY', M, y);
  y += 20;

  doc.setFillColor(21, 21, 21);
  doc.roundedRect(M, y - 8, W - 2*M, 18, 3, 3, 'F');
  doc.setFontSize(6); doc.setTextColor(...GOLD);
  doc.text('ITEM', M + 12, y + 2);
  doc.text('DETAILS', W - M - 12, y + 2, { align: 'right' });
  y += 22;

  const delItems = [];
  if (document.getElementById('delEdited').checked) delItems.push(['Edited Photos', editedCount + ' photos']);
  if (document.getElementById('delRaw').checked) delItems.push(['Raw Images', 'Full gallery delivered']);
  if (document.getElementById('delGallery').checked) delItems.push(['Online Gallery', 'Private link for viewing & downloads']);
  if (document.getElementById('delSneakPeek').checked) delItems.push(['Sneak Peek Reels', '24-hour delivery']);
  if (document.getElementById('delTeaser').checked) delItems.push(['Wedding Teaser', '2-3 minute highlight reel']);
  if (document.getElementById('delDoc').checked) delItems.push(['Documentary Film', '10 min with interviews']);
  if (document.getElementById('delTraditional').checked) delItems.push(['Traditional Video', 'Full length coverage']);
  if (document.getElementById('delHighlight').checked) delItems.push(['Highlight Video', '2-3 minute cinematic edit']);
  if (document.getElementById('delDrone').checked) delItems.push(['Drone Footage', 'Where permitted']);
  if (document.getElementById('delLive').checked) delItems.push(['Live Coverage', 'Venue internet required']);
  if (document.getElementById('delSecondShooter').checked) delItems.push(['Second Shooter', 'Full coverage']);

  delItems.forEach(([item, detail]) => {
    doc.setFontSize(8); doc.setTextColor(...CREAM);
    doc.text(item, M + 12, y);
    doc.setFontSize(7.5); doc.setTextColor(...MUTED);
    doc.text(detail, W - M - 12, y, { align: 'right' });
    y += 20;
  });

  // Investment
  y += 15;
  doc.setFontSize(6); doc.setTextColor(...GOLD);
  doc.text('INVESTMENT', M, y);
  y += 20;

  // Price box
  const boxH = 72;
  doc.setFillColor(17, 17, 17);
  doc.roundedRect(M, y - 8, W - 2*M, boxH, 4, 4, 'F');
  doc.setDrawColor(...GOLD); doc.setLineWidth(0.4);
  doc.roundedRect(M, y - 8, W - 2*M, boxH, 4, 4, 'S');

  if (showIntro) {
    doc.setFillColor(30, 26, 22);
    doc.roundedRect(M + 15, y - 2, 100, 13, 6, 6, 'F');
    doc.setFontSize(5.5); doc.setTextColor(...GOLD);
    doc.text('INTRODUCTORY RATE', M + 65, y + 7, { align: 'center' });
  }

  if (model === 'hourly') {
    doc.setFontSize(6); doc.setTextColor(...MUTED);
    doc.text('HOURLY RATE', M + 15, y + (showIntro ? 20 : 8));
    doc.setFontSize(32); doc.setTextColor(...CREAM);
    doc.text('$' + hourlyRate, M + 15, y + (showIntro ? 46 : 36));
    doc.setFontSize(9); doc.setTextColor(...MUTED);
    doc.text('/ hour', M + 90, y + (showIntro ? 42 : 32));

    // Breakdown on right
    doc.setFontSize(6); doc.setTextColor(...MUTED);
    doc.text('BREAKDOWN', W/2 + 10, y + (showIntro ? 20 : 8));
    let by = y + (showIntro ? 32 : 20);
    let baseTotal = 0;
    days.forEach((d, i) => {
      const hrs = parseFloat(d.hours) || 0;
      const amt = hrs * hourlyRate;
      baseTotal += amt;
      doc.setFontSize(7.5); doc.setTextColor(...CREAM);
      doc.text(`Day ${i+1}: ${hrs} hrs × $${hourlyRate}`, W/2 + 10, by);
      doc.setTextColor(...GOLD);
      doc.text('$' + amt.toLocaleString(), W - M - 15, by, { align: 'right' });
      by += 14;
    });
    goldLine(W/2 + 10, by - 4, W - M - 15);
    doc.setFontSize(9); doc.setTextColor(...CREAM);
    doc.text('Base Total', W/2 + 10, by + 6);
    doc.setTextColor(...GOLD);
    doc.text('$' + baseTotal.toLocaleString(), W - M - 15, by + 6, { align: 'right' });
  } else {
    doc.setFontSize(6); doc.setTextColor(...MUTED);
    doc.text('PACKAGE PRICE', M + 15, y + (showIntro ? 20 : 8));
    doc.setFontSize(32); doc.setTextColor(...CREAM);
    doc.text('$' + flatRate.toLocaleString(), M + 15, y + (showIntro ? 46 : 36));
    doc.setFontSize(8); doc.setTextColor(...MUTED);
    doc.text('All-inclusive package', W/2 + 10, y + (showIntro ? 30 : 20));
  }

  if (showIntro && standardRate) {
    doc.setFontSize(6.5); doc.setTextColor(...MUTED);
    const srText = 'Standard rate: ' + standardRate;
    doc.text(srText, M + 15, y + boxH - 10);
    const srWidth = doc.getTextWidth(srText);
    doc.setDrawColor(...MUTED); doc.setLineWidth(0.4);
    doc.line(M + 15, y + boxH - 13, M + 15 + srWidth, y + boxH - 13);
  }

  y += boxH + 10;

  // Travel
  if (travelType === 'separate') {
    doc.setFillColor(17, 17, 17);
    doc.roundedRect(M, y - 4, W - 2*M, 22, 3, 3, 'F');
    doc.setFontSize(7); doc.setTextColor(...MUTED);
    doc.text('TRAVEL & ACCOMMODATION', M + 12, y + 8);
    doc.setFontSize(8); doc.setTextColor(...CREAM);
    doc.text('Calculated separately', W - M - 12, y + 8, { align: 'right' });
    y += 30;
  } else if (travelType === 'fixed') {
    const tAmt = parseFloat(document.getElementById('travelAmount').value) || 0;
    doc.setFillColor(17, 17, 17);
    doc.roundedRect(M, y - 4, W - 2*M, 22, 3, 3, 'F');
    doc.setFontSize(7); doc.setTextColor(...MUTED);
    doc.text('TRAVEL & ACCOMMODATION', M + 12, y + 8);
    doc.setFontSize(8); doc.setTextColor(...GOLD);
    doc.text('$' + tAmt.toLocaleString(), W - M - 12, y + 8, { align: 'right' });
    y += 30;
  }

  // Additional info
  doc.setFontSize(6); doc.setTextColor(...GOLD);
  doc.text('ADDITIONAL INFORMATION', M, y);
  y += 15;

  const addInfo = [
    ['Deposit', deposit],
    ['Timeline', 'Final deliverables within ' + timeline],
  ];
  const extraNotes = document.getElementById('extraNotes').value;
  if (extraNotes) {
    extraNotes.split('\n').forEach(line => {
      if (line.trim()) {
        const parts = line.split(':');
        if (parts.length > 1) {
          addInfo.push([parts[0].trim(), parts.slice(1).join(':').trim()]);
        } else {
          addInfo.push(['Note', line.trim()]);
        }
      }
    });
  }

  addInfo.forEach(([label, detail]) => {
    doc.setFontSize(7); doc.setTextColor(...CREAM);
    doc.text(label, M + 8, y);
    doc.setTextColor(...MUTED);
    doc.text(detail, M + 110, y);
    y += 13;
  });

  // Validity
  y += 8;
  doc.setFillColor(30, 26, 22);
  doc.roundedRect(M, y - 6, W - 2*M, 18, 3, 3, 'F');
  doc.setFontSize(7); doc.setTextColor(...CREAM);
  doc.text('This quote is valid for ' + validity + ' from the date above.', W/2, y + 4, { align: 'center' });

  footerBar();

  // ===== PAGE 4 — CLOSING =====
  doc.addPage();
  pageBg();
  headerBar(4, totalPages);

  y = 220;
  const firstName = clientName.split('&')[0].split(' ')[0].trim().replace(/,/g, '');
  
  doc.setFont('times', 'normal');
  doc.setFontSize(12); doc.setTextColor(...CREAM);
  doc.text(`${firstName}, thank you for trusting us with your story.`, W/2, y, { align: 'center' });
  y += 24;
  doc.setFontSize(10); doc.setTextColor(...MUTED);
  doc.text("We don't just photograph moments — we preserve the emotions within them.", W/2, y, { align: 'center' });
  y += 16;
  doc.text("It would be an honor to be part of your celebration.", W/2, y, { align: 'center' });

  y += 40;
  doc.setFont('times', 'italic');
  doc.setFontSize(11); doc.setTextColor(...GOLD);
  doc.text("With warmth,", W/2, y, { align: 'center' });
  y += 20;
  doc.setFont('times', 'normal');
  doc.setFontSize(14); doc.setTextColor(...CREAM);
  doc.text("Sudhakar Avula", W/2, y, { align: 'center' });
  y += 14;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7); doc.setTextColor(...MUTED);
  doc.text("Founder & Lead Photographer, Aakaara Studios", W/2, y, { align: 'center' });

  y = H - 100;
  doc.setFont('times', 'italic');
  doc.setFontSize(9); doc.setTextColor(...GOLD_DIM);
  doc.text("Every story deserves its own canvas.", W/2, y, { align: 'center' });

  footerBar();

  // Save
  const safeName = clientName.replace(/[^a-zA-Z0-9]/g, '_');
  
  if (action === 'preview') {
    const blob = doc.output('blob');
    const url = URL.createObjectURL(blob);
    document.getElementById('previewFrame').src = url;
    document.getElementById('previewModal').classList.add('show');
  } else {
    doc.save(`Aakaara_Studios_Quote_${safeName}.pdf`);
    showToast('PDF generated & downloading!');
  }
 } catch (err) {
   console.error(err);
   alert('Error generating PDF: ' + err.message);
 }
}

function closePreview() {
  document.getElementById('previewModal').classList.remove('show');
}

function sendQuoteEmail() {
  const email = document.getElementById('clientEmail').value;
  const name = document.getElementById('clientName').value;

  if (!email || !name) {
    alert('Please enter a Client Name and Email address first.');
    closePreview();
    document.getElementById('clientName').focus();
    return;
  }

  // --- NEW: Save quote data to localStorage for the dashboard ---
  try {
    let quotes = JSON.parse(localStorage.getItem('aakaaraQuotes')) || [];
    const totalText = document.getElementById('totalDisplay').textContent;
    const total = parseFloat(totalText.replace(/[^0-9.-]+/g, ""));

    const dayDates = Array.from(document.querySelectorAll('.day-block [data-field="date"]'))
                          .map(input => input.value)
                          .filter(date => date) // Filter out empty dates
                          .sort(); // Sort chronologically

    const eventDateFrom = dayDates.length > 0 ? dayDates[0] : new Date().toISOString().split('T')[0];
    const eventDateTo = dayDates.length > 0 ? dayDates[dayDates.length - 1] : eventDateFrom;

    const newQuote = {
      id: Date.now(),
      clientName: name,
      eventDate: eventDateFrom,
      eventDateTo: eventDateTo,
      status: 'sent',
      quotedPrice: total,
      confirmedPrice: null
    };

    quotes.unshift(newQuote); // Add to the top of the list
    localStorage.setItem('aakaaraQuotes', JSON.stringify(quotes));
    showToast('Quote saved to dashboard!');

  } catch (e) {
    console.error("Failed to save quote to localStorage", e);
    alert("Could not save quote to dashboard. Please check browser permissions.");
  }

  // 1. Download the PDF so the user has it to attach
  generatePDF('download');

  // 2. Construct email
  const subject = `Photography Quote: ${name} — Aakaara Studios`;
  const body = `Hi ${name.split(' ')[0]},\n\nIt was wonderful connecting with you. Please find the attached quote for your photography coverage.\n\nWe've customized this based on our discussion. Let us know if you have any questions!\n\nBest,\nSudhakar Avula\nAakaara Studios NYC`;
  const gmailUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(email)}&su=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  setTimeout(() => {
    window.open(gmailUrl, '_blank');
  }, 800);
}

// Init with one day
addDay();
recalcTotal();

// Listen for changes
document.addEventListener('input', recalcTotal);