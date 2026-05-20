import { describe, it, expect } from 'vitest';
import { escapeHtml, migrateQuote, computeStats, filterQuotes, generateId, isOverdue } from './crm-utils.js';

describe('escapeHtml', () => {
  it('escapes < > & " characters', () => {
    expect(escapeHtml('<script>alert("xss")</script>')).toBe('&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;');
  });
  it('returns empty string for null/undefined', () => {
    expect(escapeHtml(null)).toBe('');
    expect(escapeHtml(undefined)).toBe('');
  });
});

describe('migrateQuote', () => {
  it('adds missing new fields with defaults to a legacy quote', () => {
    const legacy = { id: 1, clientName: 'Test', eventDate: '2024-09-14', status: 'sent', quotedPrice: 1000, confirmedPrice: null };
    const result = migrateQuote(legacy);
    expect(result.phone).toBe('');
    expect(result.shootType).toBe('');
    expect(result.depositPaid).toBeNull();
    expect(result.followUpDate).toBeNull();
    expect(result.location).toBe('');
    expect(result.notes).toBe('');
  });

  it('preserves all pre-existing field values', () => {
    const full = {
      id: 2, clientName: 'A', eventDate: '2024-10-01', status: 'confirmed',
      quotedPrice: 2000, confirmedPrice: 2000,
      phone: '+1 555-0100', shootType: 'Wedding', depositPaid: true,
      followUpDate: '2025-06-01', location: 'NYC', notes: 'Great couple',
    };
    expect(migrateQuote(full)).toEqual(full);
  });
});

describe('computeStats', () => {
  const quotes = [
    { status: 'confirmed', confirmedPrice: 2000, depositPaid: false },
    { status: 'confirmed', confirmedPrice: 3000, depositPaid: true },
    { status: 'sent',      confirmedPrice: null,  depositPaid: null },
    { status: 'rejected',  confirmedPrice: null,  depositPaid: null },
  ];
  it('counts total clients', () => expect(computeStats(quotes).total).toBe(4));
  it('counts confirmed clients', () => expect(computeStats(quotes).confirmed).toBe(2));
  it('counts pending (sent) quotes', () => expect(computeStats(quotes).pending).toBe(1));
  it('sums confirmed revenue', () => expect(computeStats(quotes).revenue).toBe(5000));
  it('counts confirmed clients with unpaid deposit', () => expect(computeStats(quotes).unpaidDeposits).toBe(1));
});

describe('filterQuotes', () => {
  const quotes = [
    { clientName: 'Priya', clientEmail: 'p@e.com', status: 'confirmed', shootType: 'Wedding',    location: 'NYC',      notes: '' },
    { clientName: 'Vikram', clientEmail: 'v@e.com', status: 'sent',      shootType: 'Engagement', location: 'Brooklyn', notes: '' },
    { clientName: 'Meera',  clientEmail: 'm@e.com', status: 'rejected',  shootType: 'Wedding',    location: '',         notes: 'special note' },
  ];

  it('returns all when status=all and search empty', () => expect(filterQuotes(quotes, 'all', '')).toHaveLength(3));
  it('filters by status=confirmed', () => expect(filterQuotes(quotes, 'confirmed', '')).toHaveLength(1));
  it('filters by status=sent', () => expect(filterQuotes(quotes, 'sent', '')).toHaveLength(1));
  it('filters by shootType', () => {
    expect(filterQuotes(quotes, 'Wedding', '')).toHaveLength(2);
    expect(filterQuotes(quotes, 'Engagement', '')).toHaveLength(1);
  });
  it('filters by search against clientName (case-insensitive)', () => expect(filterQuotes(quotes, 'all', 'priya')).toHaveLength(1));
  it('filters by search against notes', () => expect(filterQuotes(quotes, 'all', 'special')).toHaveLength(1));
  it('filters by search against location', () => expect(filterQuotes(quotes, 'all', 'brooklyn')).toHaveLength(1));
  it('combines status and search', () => {
    expect(filterQuotes(quotes, 'confirmed', 'priya')).toHaveLength(1);
    expect(filterQuotes(quotes, 'sent', 'priya')).toHaveLength(0);
  });
});

describe('generateId', () => {
  it('returns 1 for empty array', () => expect(generateId([])).toBe(1));
  it('returns max id + 1', () => expect(generateId([{ id: 3 }, { id: 1 }, { id: 5 }])).toBe(6));
});

describe('isOverdue', () => {
  it('returns false for null', () => expect(isOverdue(null)).toBe(false));
  it('returns true for a past date', () => expect(isOverdue('2020-01-01')).toBe(true));
  it('returns false for a future date', () => expect(isOverdue('2099-12-31')).toBe(false));
});
