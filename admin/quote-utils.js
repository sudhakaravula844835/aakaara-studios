export function parseDurationToHours(text) {
  if (!text || typeof text !== 'string') return 0;
  const match = text.match(/(\d+(?:\.\d+)?)\s*(hours?|hrs?|h\b|minutes?|mins?|m\b)/i);
  if (!match) return 0;
  const value = parseFloat(match[1]);
  return /^m/i.test(match[2]) ? value / 60 : value;
}

export function sumEventPhotos(events) {
  return events.reduce((sum, ev) => {
    const n = parseFloat(ev.photos);
    return sum + (Number.isFinite(n) ? n : 0);
  }, 0);
}

export function generateQuoteRef(existingRefs) {
  const year = new Date().getFullYear();
  const prefix = `AAS-${year}-`;
  let max = 0;
  for (const ref of existingRefs) {
    if (ref.startsWith(prefix)) {
      const seq = parseInt(ref.slice(prefix.length), 10);
      if (!Number.isNaN(seq) && seq > max) max = seq;
    }
  }
  return `${prefix}${String(max + 1).padStart(3, '0')}`;
}

export function calculatePricingSummary(days, { model, hourlyRate, flatRate, travelType, travelAmount, retainerFee }) {
  const rate = parseFloat(hourlyRate) || 0;
  const flat = parseFloat(flatRate) || 0;
  const travel = travelType === 'fixed' ? (parseFloat(travelAmount) || 0) : 0;
  const retainer = parseFloat(retainerFee) || 0;

  const dayBreakdown = days.map((day, i) => {
    const hours = parseFloat(day.hours) || 0;
    const amount = model === 'hourly' ? hours * rate : 0;
    let label = `Day ${i + 1}`;
    if (day.date) {
      try { label = new Date(day.date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' }); } catch {}
    }
    return { label, hours, amount };
  });

  const totalHours = dayBreakdown.reduce((s, d) => s + d.hours, 0);
  const totalPhotos = days.reduce((s, day) => s + sumEventPhotos(day.events || []), 0);
  const baseTotal = model === 'hourly' ? totalHours * rate : flat;
  const total = baseTotal + travel + retainer;

  return { model, hourlyRate: rate, flatRate: flat, travelType, travelAmount: travel, retainerFee: retainer, totalHours, totalPhotos, baseTotal, total, dayBreakdown };
}

export function computeInvestmentBoxHeight(pricing, showIntro) {
  const breakdownLines = pricing.model === 'hourly' ? pricing.dayBreakdown.length : 1;
  return Math.max(66, 46 + breakdownLines * 14 + (showIntro ? 12 : 0));
}

export function migrateEventDay(day) {
  const events = (day.events || []).map(ev => ({
    name: ev.name || '',
    dur: ev.dur || '',
    notes: ev.notes || '',
    photos: ev.photos !== undefined ? ev.photos : '',
  }));
  return { ...day, events };
}

export function parseBrief(text) {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  const result = { days: [], clientEmail: '', clientName: '', location: '', eventType: '' };
  for (const line of lines) {
    const emailMatch = line.match(/[\w.+-]+@[\w-]+\.[a-z]{2,}/i);
    if (emailMatch) { result.clientEmail = emailMatch[0]; continue; }
    if (/^(client|name):/i.test(line)) { result.clientName = line.replace(/^.*?:\s*/, ''); continue; }
    if (/^(location|venue|city):/i.test(line)) { result.location = line.replace(/^.*?:\s*/, ''); continue; }
    if (/^(event|type):/i.test(line)) { result.eventType = line.replace(/^.*?:\s*/, ''); continue; }
  }
  return result;
}
