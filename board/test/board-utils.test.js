import { describe, it, expect } from 'vitest';
import {
  STAGE_COLUMNS, stageIndex, stageLabel, progressSegments,
  deriveWeddingDate, formatDate, compareProjectsByDate,
  validateProjectForm, photoSelectionLabel, synthesizeActivityLine,
} from '../board-utils.js';

describe('STAGE_COLUMNS', () => {
  it('has exactly 8 stages in schema order', () => {
    expect(STAGE_COLUMNS.map(c => c.key)).toEqual([
      'booked', 'shoot_completed', 'raw_delivered', 'photo_selection',
      'video_editing', 'song_finalization', 'final_delivery', 'completed',
    ]);
  });
});

describe('stageIndex', () => {
  it('returns 0 for booked', () => expect(stageIndex('booked')).toBe(0));
  it('returns 7 for completed', () => expect(stageIndex('completed')).toBe(7));
  it('returns -1 for an unknown stage', () => expect(stageIndex('nonsense')).toBe(-1));
});

describe('stageLabel', () => {
  it('returns the friendly label', () => expect(stageLabel('raw_delivered')).toBe('RAW Delivered'));
  it('falls back to the raw value for an unknown stage', () => expect(stageLabel('nonsense')).toBe('nonsense'));
});

describe('progressSegments', () => {
  it('booked is 1 of 8', () => expect(progressSegments('booked')).toEqual({ filled: 1, total: 8 }));
  it('completed is 8 of 8', () => expect(progressSegments('completed')).toEqual({ filled: 8, total: 8 }));
  it('an unknown stage is 0 of 8', () => expect(progressSegments('nonsense')).toEqual({ filled: 0, total: 8 }));
});

describe('deriveWeddingDate', () => {
  it('returns null for no sub-events', () => expect(deriveWeddingDate([])).toBeNull());
  it('returns null when sub-events have no dates', () => expect(deriveWeddingDate([{ event_date: null }])).toBeNull());
  it('returns the earliest date', () => {
    expect(deriveWeddingDate([{ event_date: '2026-09-15' }, { event_date: '2026-09-12' }])).toBe('2026-09-12');
  });
});

describe('formatDate', () => {
  it('returns "Date TBD" for null', () => expect(formatDate(null)).toBe('Date TBD'));
  it('formats a real date', () => expect(formatDate('2026-09-12')).toBe('Sep 12, 2026'));
});

describe('compareProjectsByDate', () => {
  it('sorts dated projects earliest first', () => {
    const a = { sub_events: [{ event_date: '2026-10-01' }] };
    const b = { sub_events: [{ event_date: '2026-09-01' }] };
    expect(compareProjectsByDate(a, b)).toBeGreaterThan(0);
  });
  it('sorts undated projects after dated ones', () => {
    const a = { sub_events: [] };
    const b = { sub_events: [{ event_date: '2026-09-01' }] };
    expect(compareProjectsByDate(a, b)).toBeGreaterThan(0);
  });
  it('treats two undated projects as equal', () => {
    expect(compareProjectsByDate({ sub_events: [] }, { sub_events: [] })).toBe(0);
  });
});

describe('validateProjectForm', () => {
  it('requires client_name', () => {
    const result = validateProjectForm({ client_name: '' });
    expect(result.valid).toBe(false);
    expect(result.errors.client_name).toBeTruthy();
  });
  it('passes with a client_name', () => {
    expect(validateProjectForm({ client_name: 'Priya & Rohan' }).valid).toBe(true);
  });
  it('rejects a whitespace-only client_name', () => {
    expect(validateProjectForm({ client_name: '   ' }).valid).toBe(false);
  });
});

describe('photoSelectionLabel', () => {
  it('returns null when total is 0', () => expect(photoSelectionLabel(0, 0)).toBeNull());
  it('formats a real count', () => expect(photoSelectionLabel(12, 40)).toBe('12/40 selected'));
});

describe('synthesizeActivityLine', () => {
  it('formats a stage change using the friendly stage labels', () => {
    expect(synthesizeActivityLine({ field_changed: 'stage', old_value: 'booked', new_value: 'shoot_completed' }))
      .toBe('Stage changed: Booked → Shoot Completed');
  });
  it('formats a video editing substatus change using the friendly substatus labels', () => {
    expect(synthesizeActivityLine({ field_changed: 'video_editing_substatus', old_value: 'not_started', new_value: 'in_progress' }))
      .toBe('Video editing status changed: Not Started → In Progress');
  });
  it('falls back to a generic line for any other field', () => {
    expect(synthesizeActivityLine({ field_changed: 'package_tier', old_value: 'Silver', new_value: 'Gold' }))
      .toBe('package tier changed: Silver → Gold');
  });
});
