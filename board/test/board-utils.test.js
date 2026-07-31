import { describe, it, expect } from 'vitest';
import {
  STAGE_COLUMNS, stageIndex, stageLabel, progressSegments,
  deriveWeddingDate, formatDate, compareProjectsByDate,
  validateProjectForm, validateSubEventForm, photoSelectionLabel, synthesizeActivityLine,
  flattenSubEventsByMonth, compareProjectsByField,
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
  it('requires a first sub-event name when requested', () => {
    const result = validateProjectForm(
      { client_name: 'Priya & Rohan' },
      { requireDatedSubEvent: true, subEvents: [{ name: '', event_date: '2026-09-12' }] },
    );
    expect(result.valid).toBe(false);
    expect(result.errors.first_sub_event_name).toBeTruthy();
  });
  it('requires a first sub-event date when requested', () => {
    const result = validateProjectForm(
      { client_name: 'Priya & Rohan' },
      { requireDatedSubEvent: true, subEvents: [{ name: 'Wedding', event_date: null }] },
    );
    expect(result.valid).toBe(false);
    expect(result.errors.first_sub_event_date).toBeTruthy();
  });
  it('passes with client_name and a dated first sub-event when requested', () => {
    const result = validateProjectForm(
      { client_name: 'Priya & Rohan' },
      { requireDatedSubEvent: true, subEvents: [{ name: 'Wedding', event_date: '2026-09-12' }] },
    );
    expect(result.valid).toBe(true);
  });
});

describe('validateSubEventForm', () => {
  it('requires name', () => {
    const result = validateSubEventForm({ name: '' });
    expect(result.valid).toBe(false);
    expect(result.errors.name).toBeTruthy();
  });
  it('passes with a name', () => {
    expect(validateSubEventForm({ name: 'Haldi' }).valid).toBe(true);
  });
  it('rejects a whitespace-only name', () => {
    expect(validateSubEventForm({ name: '   ' }).valid).toBe(false);
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

describe('flattenSubEventsByMonth', () => {
  const projects = [
    { id: 'p1', client_name: 'Priya & Rohan', sub_events: [
      { name: 'Haldi', event_date: '2026-09-05' },
      { name: 'Wedding', event_date: '2026-09-12' },
    ] },
    { id: 'p2', client_name: 'Meera & Arjun', sub_events: [
      { name: 'Sangeet', event_date: '2026-10-01' },
    ] },
  ];

  it('returns only entries in the given month/year', () => {
    // September = month index 8 (JS Date months are 0-indexed)
    expect(flattenSubEventsByMonth(projects, 2026, 8)).toHaveLength(2);
  });

  it('excludes sub-events with no date', () => {
    const withUndated = [{ id: 'p3', client_name: 'X', sub_events: [{ name: 'TBD', event_date: null }] }];
    expect(flattenSubEventsByMonth(withUndated, 2026, 8)).toHaveLength(0);
  });

  it('includes the day, sub-event name, client name, and project id', () => {
    const result = flattenSubEventsByMonth(projects, 2026, 8);
    expect(result[0]).toEqual({ day: 5, subEventName: 'Haldi', clientName: 'Priya & Rohan', projectId: 'p1' });
  });

  it('returns an empty array for a month with no sub-events', () => {
    expect(flattenSubEventsByMonth(projects, 2026, 0)).toHaveLength(0);
  });

  it('handles a project with no sub_events at all', () => {
    expect(flattenSubEventsByMonth([{ id: 'p4', client_name: 'Y', sub_events: [] }], 2026, 8)).toHaveLength(0);
  });
});

describe('compareProjectsByField', () => {
  const a = {
    client_name: 'Bravo', package_tier: 'Silver', stage: 'booked',
    sub_events: [{ event_date: '2026-09-01' }],
  };
  const b = {
    client_name: 'Alpha', package_tier: 'Gold', stage: 'completed',
    sub_events: [{ event_date: '2026-08-01' }],
  };

  it('sorts by client_name alphabetically', () => {
    expect(compareProjectsByField(a, b, 'client_name')).toBeGreaterThan(0); // 'Bravo' > 'Alpha'
  });

  it('sorts by date using compareProjectsByDate', () => {
    expect(compareProjectsByField(a, b, 'date')).toBeGreaterThan(0); // Sep 2026 > Aug 2026
  });

  it('sorts by package_tier alphabetically', () => {
    expect(compareProjectsByField(a, b, 'package_tier')).toBeGreaterThan(0); // 'Silver' > 'Gold'
  });

  it('sorts by stage using pipeline order', () => {
    expect(compareProjectsByField(a, b, 'stage')).toBeLessThan(0); // booked (index 0) < completed (index 7)
  });

  it('sorts by progress identically to stage', () => {
    expect(compareProjectsByField(a, b, 'progress')).toBe(compareProjectsByField(a, b, 'stage'));
  });

  it('returns 0 for an unrecognized column', () => {
    expect(compareProjectsByField(a, b, 'nonsense')).toBe(0);
  });
});
