import { describe, it, expect } from 'vitest';
import { buildPreFillUrl, parseIntakeParams } from './intake.js';

describe('buildPreFillUrl', () => {
  it('encodes required fields into URL params', () => {
    const data = {
      name: 'Jane & John Doe', email: 'jane@example.com', phone: '917-555-0123',
      eventType: 'Wedding', venue: 'The Pierre Hotel', city: 'New York',
      live: 'no', liveEvents: '',
      days: [{ date: '2026-10-15', events: [{ name: 'Ceremony', dur: '3' }] }],
    };
    const url = buildPreFillUrl(data);
    expect(url).toContain('/admin/quote-generator.html?');
    expect(url).toContain('name=');
    expect(url).toContain('eventType=Wedding');
    expect(url).toContain('city=New+York');
  });

  it('omits live params when live is no', () => {
    const data = {
      name: 'A', email: 'a@a.com', phone: '1', eventType: 'Wedding',
      venue: '', city: 'NYC', live: 'no', liveEvents: '',
      days: [{ date: '2026-10-15', events: [{ name: 'Ceremony', dur: '2' }] }],
    };
    expect(buildPreFillUrl(data)).not.toContain('live=yes');
  });

  it('includes live params when live is yes', () => {
    const data = {
      name: 'A', email: 'a@a.com', phone: '1', eventType: 'Wedding',
      venue: '', city: 'NYC', live: 'yes', liveEvents: 'Ceremony',
      days: [{ date: '2026-10-15', events: [{ name: 'Ceremony', dur: '2' }] }],
    };
    const url = buildPreFillUrl(data);
    expect(url).toContain('live=yes');
    expect(url).toContain('liveEvents=Ceremony');
  });
});

describe('parseIntakeParams', () => {
  it('returns null when name param is absent', () => {
    expect(parseIntakeParams('')).toBeNull();
    expect(parseIntakeParams('?foo=bar')).toBeNull();
  });

  it('parses all fields correctly', () => {
    const params = new URLSearchParams({
      name: 'Jane Doe', email: 'jane@example.com', phone: '917-555-0123',
      eventType: 'Wedding', venue: 'The Pierre', city: 'New York',
      live: 'yes', liveEvents: 'Ceremony',
      days: JSON.stringify([{ date: '2026-10-15', events: [{ name: 'Ceremony', dur: '3' }] }]),
    });
    const result = parseIntakeParams('?' + params.toString());
    expect(result.name).toBe('Jane Doe');
    expect(result.eventType).toBe('Wedding');
    expect(result.live).toBe('yes');
    expect(result.days).toHaveLength(1);
    expect(result.days[0].events[0].name).toBe('Ceremony');
  });

  it('returns empty days array on malformed days param', () => {
    const params = new URLSearchParams({ name: 'A', email: 'a@a.com', phone: '1', days: 'not-json' });
    const result = parseIntakeParams('?' + params.toString());
    expect(result.days).toEqual([]);
  });
});
