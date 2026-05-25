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
  // populated in Task 5
}
