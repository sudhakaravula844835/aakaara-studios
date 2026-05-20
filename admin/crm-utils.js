export function escapeHtml(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function migrateQuote(q) {
  return {
    phone: '',
    shootType: '',
    depositPaid: null,
    followUpDate: null,
    location: '',
    notes: '',
    ...q,
  };
}

export function computeStats(quotes) {
  const confirmed = quotes.filter(q => q.status === 'confirmed');
  return {
    total: quotes.length,
    confirmed: confirmed.length,
    pending: quotes.filter(q => q.status === 'sent').length,
    revenue: confirmed.reduce((sum, q) => sum + (q.confirmedPrice || 0), 0),
    unpaidDeposits: confirmed.filter(q => q.depositPaid === false).length,
  };
}

const STATUS_KEYWORDS = new Set(['all', 'confirmed', 'sent', 'rejected']);

export function filterQuotes(quotes, statusOrType, search) {
  const term = search.trim().toLowerCase();
  let filtered = quotes;

  if (statusOrType !== 'all') {
    if (STATUS_KEYWORDS.has(statusOrType)) {
      filtered = filtered.filter(q => q.status === statusOrType);
    } else {
      filtered = filtered.filter(q => q.shootType === statusOrType);
    }
  }

  if (term) {
    filtered = filtered.filter(q =>
      [q.clientName, q.clientEmail, q.location, q.notes]
        .some(f => (f || '').toLowerCase().includes(term))
    );
  }

  return filtered;
}

export function generateId(quotes) {
  if (!quotes.length) return 1;
  return Math.max(...quotes.map(q => q.id)) + 1;
}

export function isOverdue(dateStr) {
  if (!dateStr) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return new Date(dateStr + 'T00:00:00') < today;
}
