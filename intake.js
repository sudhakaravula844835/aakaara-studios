// intake.js

// ── Pure functions (exported for testing) ─────────────────────────

export function buildPreFillUrl(data) {
  const p = new URLSearchParams();
  p.set('name',      data.name);
  p.set('email',     data.email);
  p.set('phone',     data.phone);
  p.set('eventType', data.eventType);
  if (data.venue) p.set('venue', data.venue);
  p.set('city', data.city);
  if (data.live === 'yes') {
    p.set('live', 'yes');
    if (data.liveEvents) p.set('liveEvents', data.liveEvents);
  }
  p.set('days', JSON.stringify(data.days));
  return `/admin/quote-generator.html?${p.toString()}`;
}

export function parseIntakeParams(searchString) {
  const p = new URLSearchParams(searchString);
  if (!p.has('name')) return null;
  let days = [];
  try { days = JSON.parse(p.get('days') || '[]'); } catch { days = []; }
  return {
    name:       p.get('name')       || '',
    email:      p.get('email')      || '',
    phone:      p.get('phone')      || '',
    eventType:  p.get('eventType')  || '',
    venue:      p.get('venue')      || '',
    city:       p.get('city')       || '',
    live:       p.get('live')       || 'no',
    liveEvents: p.get('liveEvents') || '',
    days,
  };
}

export function formatDaysForEmail(days) {
  return days.map((day, i) => {
    const events = day.events.map(e => `${e.name} (${e.dur}h)`).join(', ');
    return `Day ${i + 1} (${day.date || 'TBD'}): ${events || 'No events listed'}`;
  }).join('\n');
}

// ── DOM init — browser only ───────────────────────────────────────

if (typeof document !== 'undefined') {
  document.addEventListener('DOMContentLoaded', initIntakeForm);
}

function initIntakeForm() {
  // Date picker
  flatpickr('#eventDate', {
    minDate: 'today',
    dateFormat: 'Y-m-d',
    altInput: true,
    altFormat: 'F j, Y',
    disableMobile: false,
  });

  // Conditional: live streaming
  document.querySelectorAll('input[name="live"]').forEach(radio => {
    radio.addEventListener('change', () => {
      const isYes = document.querySelector('input[name="live"]:checked')?.value === 'yes';
      toggleConditional(document.getElementById('liveEventsField'), isYes);
    });
  });

  // Conditional: pre-wedding shoot
  document.querySelectorAll('input[name="prewed"]').forEach(radio => {
    radio.addEventListener('change', () => {
      const val = document.querySelector('input[name="prewed"]:checked')?.value;
      toggleConditional(document.getElementById('prewedDetails'), val === 'yes');
    });
  });

  // Day pill selector
  const dayPills = document.querySelectorAll('.day-pill');
  dayPills.forEach(pill => {
    pill.addEventListener('click', () => {
      dayPills.forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
      renderDays(parseInt(pill.dataset.days, 10));
    });
  });
  renderDays(1);

  // Progress scrollspy — highlights the progress step for the visible section
  const sections      = document.querySelectorAll('.intake-section');
  const progressSteps = document.querySelectorAll('.progress-step');
  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const idx = Array.from(sections).indexOf(entry.target);
        progressSteps.forEach((s, i) => {
          s.classList.toggle('active', i === idx);
          s.classList.toggle('done',   i < idx);
        });
      }
    });
  }, { threshold: 0.5 });
  sections.forEach(s => observer.observe(s));

  // Form submit
  const form      = document.getElementById('intakeForm');
  const submitBtn = document.getElementById('submitBtn');

  form.addEventListener('submit', async e => {
    e.preventDefault();
    if (!validateForm()) return;

    submitBtn.disabled    = true;
    submitBtn.textContent = 'Sending…';

    const data = collectFormData();
    document.getElementById('fs_subject').value  = `New Inquiry — ${data.name}`;
    document.getElementById('fs_schedule').value = formatDaysForEmail(data.days);
    document.getElementById('fs_link').value     = window.location.origin + buildPreFillUrl(data);

    try {
      const res = await fetch('https://formspree.io/f/meedrjaj', {
        method:  'POST',
        body:    new FormData(form),
        headers: { Accept: 'application/json' },
      });

      if (res.ok) {
        document.querySelector('.intake-submit-area').hidden = true;
        document.getElementById('successMessage').hidden     = false;
      } else {
        submitBtn.disabled    = false;
        submitBtn.textContent = 'Send My Details';
        alert('Something went wrong. Please try again or email us directly.');
      }
    } catch {
      submitBtn.disabled    = false;
      submitBtn.textContent = 'Send My Details';
      alert('Something went wrong. Please try again or email us directly.');
    }
  });
}

function toggleConditional(el, show) {
  if (show) {
    el.hidden = false;
    el.offsetHeight; // force reflow so CSS transition fires
    el.classList.add('visible');
  } else {
    el.classList.remove('visible');
    el.addEventListener('transitionend', () => { el.hidden = true; }, { once: true });
  }
}

function renderDays(count) {
  const container = document.getElementById('daysBuilder');
  container.textContent = ''; // clear safely
  for (let i = 1; i <= count; i++) container.appendChild(buildDayCard(i));
}

function buildDayCard(dayNum) {
  const card = document.createElement('div');
  card.className      = 'day-card';
  card.dataset.dayNum = String(dayNum);

  const header = document.createElement('div');
  header.className   = 'day-card-header';
  header.textContent = `Day ${dayNum}`;

  const dateGroup = document.createElement('div');
  dateGroup.className = 'field-group';

  const dateLabel = document.createElement('label');
  dateLabel.className   = 'field-label';
  dateLabel.textContent = 'Date';

  const dateInput = document.createElement('input');
  dateInput.type        = 'text';
  dateInput.className   = 'day-date';
  dateInput.placeholder = 'Select a date…';
  dateInput.readOnly    = true;

  dateGroup.appendChild(dateLabel);
  dateGroup.appendChild(dateInput);

  flatpickr(dateInput, {
    dateFormat:    'Y-m-d',
    altInput:      true,
    altFormat:     'F j, Y',
    disableMobile: false,
  });

  const eventsList = document.createElement('div');
  eventsList.className = 'events-list';

  const addBtn = document.createElement('button');
  addBtn.type        = 'button';
  addBtn.className   = 'add-event-btn';
  addBtn.textContent = '+ Add event';
  addBtn.addEventListener('click', () => {
    if (eventsList.children.length < 3) addEventRow(eventsList);
  });

  card.appendChild(header);
  card.appendChild(dateGroup);
  card.appendChild(eventsList);
  card.appendChild(addBtn);

  addEventRow(eventsList); // always start with one event row
  return card;
}

function addEventRow(list) {
  const row = document.createElement('div');
  row.className = 'event-row';

  const nameGroup = document.createElement('div');
  nameGroup.className = 'field-group';

  const nameInput = document.createElement('input');
  nameInput.type         = 'text';
  nameInput.className    = 'event-name';
  nameInput.placeholder  = 'Event name (e.g. Ceremony)';
  nameInput.autocomplete = 'off';

  nameGroup.appendChild(nameInput);

  const hoursGroup = document.createElement('div');
  hoursGroup.className = 'field-group';

  const hoursInput = document.createElement('input');
  hoursInput.type        = 'number';
  hoursInput.className   = 'event-hours';
  hoursInput.min         = '0.5';
  hoursInput.max         = '24';
  hoursInput.step        = '0.5';
  hoursInput.placeholder = 'Hrs';

  const hoursSpan = document.createElement('span');
  hoursSpan.className   = 'event-hours-label';
  hoursSpan.textContent = 'hours';

  hoursGroup.appendChild(hoursInput);
  hoursGroup.appendChild(hoursSpan);

  row.appendChild(nameGroup);
  row.appendChild(hoursGroup);
  list.appendChild(row);
}

function collectFormData() {
  const days = [];
  document.querySelectorAll('.day-card').forEach(card => {
    const date   = card.querySelector('.day-date').value;
    const events = [];
    card.querySelectorAll('.event-row').forEach(row => {
      const name = row.querySelector('.event-name').value.trim();
      const dur  = row.querySelector('.event-hours').value.trim();
      if (name || dur) events.push({ name, dur });
    });
    days.push({ date, events });
  });

  return {
    name:       document.getElementById('clientName').value.trim(),
    email:      document.getElementById('clientEmail').value.trim(),
    phone:      document.getElementById('clientPhone').value.trim(),
    eventType:  document.getElementById('eventType').value,
    venue:      document.getElementById('venue').value.trim(),
    city:       document.getElementById('city').value.trim(),
    live:       document.querySelector('input[name="live"]:checked')?.value || 'no',
    liveEvents: document.getElementById('liveEvents').value.trim(),
    days,
  };
}

function validateForm() {
  const fields = [
    { id: 'clientName',  errId: 'err-clientName',  msg: 'Please enter your name'    },
    { id: 'clientEmail', errId: 'err-clientEmail', msg: 'Please enter a valid email' },
    { id: 'clientPhone', errId: 'err-clientPhone', msg: 'Please enter your phone'    },
    { id: 'eventType',   errId: 'err-eventType',   msg: 'Please select event type'   },
    { id: 'eventDate',   errId: 'err-eventDate',   msg: 'Please select a date'       },
    { id: 'city',        errId: 'err-city',         msg: 'Please enter the city'      },
  ];
  let valid = true;
  fields.forEach(({ id, errId, msg }) => {
    const el  = document.getElementById(id);
    const err = document.getElementById(errId);
    if (!el.value.trim()) {
      if (err) err.textContent = msg;
      if (valid) el.focus();
      valid = false;
    } else {
      if (err) err.textContent = '';
    }
  });
  return valid;
}
