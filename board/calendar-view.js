import { flattenSubEventsByMonth } from './board-utils.js';
// Part of the same board.js <-> project-modal.js circular-import cycle
// documented in project-modal.js (which imports refreshProjects from
// board.js) and in list-view.js (which imports both openDetailPanel from
// here and refreshProjects from board.js). Safe in this file because
// openDetailPanel is only ever invoked from inside a marker's click/keydown
// handler below, never at module-evaluation time. A future top-level call
// to openDetailPanel in this file would be a real hazard — a TDZ error at
// page load — so watch for that.
import { openDetailPanel } from './project-modal.js';

let currentCalendarMonth = new Date();
let cachedProjects = [];

export function renderCalendarView(projects) {
  cachedProjects = projects;
  const container = document.getElementById('calendarViewContainer');
  container.innerHTML = '';

  const header = document.createElement('div');
  header.className = 'calendar-header';

  const prevBtn = document.createElement('button');
  prevBtn.textContent = '‹';
  prevBtn.setAttribute('aria-label', 'Previous month');
  prevBtn.addEventListener('click', () => {
    currentCalendarMonth = new Date(currentCalendarMonth.getFullYear(), currentCalendarMonth.getMonth() - 1, 1);
    renderCalendarView(cachedProjects);
  });

  const monthLabel = document.createElement('div');
  monthLabel.id = 'calendarMonthYear';
  monthLabel.textContent = currentCalendarMonth.toLocaleString('default', { month: 'long', year: 'numeric' });

  const nextBtn = document.createElement('button');
  nextBtn.textContent = '›';
  nextBtn.setAttribute('aria-label', 'Next month');
  nextBtn.addEventListener('click', () => {
    currentCalendarMonth = new Date(currentCalendarMonth.getFullYear(), currentCalendarMonth.getMonth() + 1, 1);
    renderCalendarView(cachedProjects);
  });

  header.appendChild(prevBtn);
  header.appendChild(monthLabel);
  header.appendChild(nextBtn);
  container.appendChild(header);

  const weekdaysRow = document.createElement('div');
  weekdaysRow.className = 'calendar-grid';
  ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].forEach(d => {
    const wd = document.createElement('div');
    wd.className = 'calendar-weekday';
    wd.textContent = d;
    weekdaysRow.appendChild(wd);
  });
  container.appendChild(weekdaysRow);

  const daysGrid = document.createElement('div');
  daysGrid.className = 'calendar-grid';

  const year = currentCalendarMonth.getFullYear();
  const month = currentCalendarMonth.getMonth();
  const entries = flattenSubEventsByMonth(projects, year, month);
  const entriesByDay = {};
  entries.forEach(entry => {
    if (!entriesByDay[entry.day]) entriesByDay[entry.day] = [];
    entriesByDay[entry.day].push(entry);
  });

  const firstDayOfWeek = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  for (let i = 0; i < firstDayOfWeek; i++) {
    daysGrid.appendChild(document.createElement('div'));
  }

  for (let day = 1; day <= daysInMonth; day++) {
    const cell = document.createElement('div');
    cell.className = 'calendar-day';

    const dayNumber = document.createElement('div');
    dayNumber.className = 'calendar-day-number';
    dayNumber.textContent = day;
    cell.appendChild(dayNumber);

    const dayEntries = entriesByDay[day] || [];
    dayEntries.forEach(entry => {
      const marker = document.createElement('div');
      marker.className = 'calendar-marker';
      marker.setAttribute('role', 'button');
      marker.setAttribute('tabindex', '0');
      marker.setAttribute('aria-label', `${entry.clientName} — ${entry.subEventName}`);
      marker.addEventListener('click', () => {
        const project = projects.find(p => p.id === entry.projectId);
        if (project) openDetailPanel(project);
      });
      marker.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          marker.click();
        }
      });

      const tooltip = document.createElement('div');
      tooltip.className = 'tooltip';
      tooltip.textContent = `${entry.clientName} — ${entry.subEventName}`;
      marker.appendChild(tooltip);

      cell.appendChild(marker);
    });

    daysGrid.appendChild(cell);
  }

  container.appendChild(daysGrid);
}
