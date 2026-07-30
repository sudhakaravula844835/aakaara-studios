export const STAGE_COLUMNS = [
  { key: 'booked', label: 'Booked' },
  { key: 'shoot_completed', label: 'Shoot Completed' },
  { key: 'raw_delivered', label: 'RAW Delivered' },
  { key: 'photo_selection', label: 'Photo Selection' },
  { key: 'video_editing', label: 'Video Editing' },
  { key: 'song_finalization', label: 'Song Finalization' },
  { key: 'final_delivery', label: 'Final Delivery' },
  { key: 'completed', label: 'Completed' },
];

export const SUBSTATUS_LABELS = {
  not_started: 'Not Started',
  in_progress: 'In Progress',
  client_review: 'Client Review',
  revisions: 'Revisions',
  final: 'Final',
};

export function stageIndex(stage) {
  return STAGE_COLUMNS.findIndex(c => c.key === stage);
}

export function stageLabel(stage) {
  const col = STAGE_COLUMNS.find(c => c.key === stage);
  return col ? col.label : stage;
}

export function progressSegments(stage) {
  const idx = stageIndex(stage);
  const filled = idx === -1 ? 0 : idx + 1;
  return { filled, total: STAGE_COLUMNS.length };
}

export function deriveWeddingDate(subEvents) {
  if (!subEvents || subEvents.length === 0) return null;
  const dated = subEvents.map(e => e.event_date).filter(Boolean).sort();
  return dated.length ? dated[0] : null;
}

export function formatDate(dateStr) {
  if (!dateStr) return 'Date TBD';
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  });
}

export function compareProjectsByDate(a, b) {
  const dateA = deriveWeddingDate(a.sub_events);
  const dateB = deriveWeddingDate(b.sub_events);
  if (dateA && dateB) return dateA < dateB ? -1 : dateA > dateB ? 1 : 0;
  if (dateA && !dateB) return -1;
  if (!dateA && dateB) return 1;
  return 0;
}

export function validateProjectForm(fields) {
  const errors = {};
  if (!fields.client_name || !fields.client_name.trim()) {
    errors.client_name = 'Client name is required.';
  }
  return { valid: Object.keys(errors).length === 0, errors };
}

export function validateSubEventForm(fields) {
  const errors = {};
  if (!fields.name || !fields.name.trim()) {
    errors.name = 'Sub-event name is required.';
  }
  return { valid: Object.keys(errors).length === 0, errors };
}

export function photoSelectionLabel(selectedCount, totalCount) {
  if (!totalCount) return null;
  return `${selectedCount}/${totalCount} selected`;
}

export function synthesizeActivityLine(entry) {
  const { field_changed, old_value, new_value } = entry;
  if (field_changed === 'stage') {
    return `Stage changed: ${stageLabel(old_value)} → ${stageLabel(new_value)}`;
  }
  if (field_changed === 'video_editing_substatus') {
    const oldLabel = old_value ? (SUBSTATUS_LABELS[old_value] || old_value) : 'None';
    const newLabel = new_value ? (SUBSTATUS_LABELS[new_value] || new_value) : 'None';
    return `Video editing status changed: ${oldLabel} → ${newLabel}`;
  }
  const fieldLabel = field_changed.replace(/_/g, ' ');
  const oldDisplay = old_value === null || old_value === undefined ? '—' : old_value;
  const newDisplay = new_value === null || new_value === undefined ? '—' : new_value;
  return `${fieldLabel} changed: ${oldDisplay} → ${newDisplay}`;
}

export function flattenSubEventsByMonth(projects, year, month) {
  const entries = [];
  (projects || []).forEach(project => {
    (project.sub_events || []).forEach(se => {
      if (!se.event_date) return;
      const d = new Date(se.event_date + 'T00:00:00');
      if (d.getFullYear() === year && d.getMonth() === month) {
        entries.push({
          day: d.getDate(),
          subEventName: se.name,
          clientName: project.client_name,
          projectId: project.id,
        });
      }
    });
  });
  return entries;
}

export function compareProjectsByField(a, b, column) {
  if (column === 'client_name') return (a.client_name || '').localeCompare(b.client_name || '');
  if (column === 'date') return compareProjectsByDate(a, b);
  if (column === 'package_tier') return (a.package_tier || '').localeCompare(b.package_tier || '');
  if (column === 'stage' || column === 'progress') return stageIndex(a.stage) - stageIndex(b.stage);
  return 0;
}
