import { escapeHtml, migrateQuote, computeStats, filterQuotes, generateId, isOverdue } from './crm-utils.js';

document.addEventListener('DOMContentLoaded', function () {

    // 1. DATA
    let quotes = [];
    const stored = localStorage.getItem('aakaaraQuotes');

    if (stored) {
        try {
            quotes = JSON.parse(stored).map(migrateQuote);
        } catch (err) {
            console.error('aakaaraQuotes corrupted; backing up and resetting.', err);
            localStorage.setItem('aakaaraQuotes.corrupt.' + Date.now(), stored);
            quotes = [];
        }
    } else {
        quotes = [
            { id: 1, clientName: 'Priya & Rohan', clientEmail: 'priya.r@example.com', eventDate: '2024-09-14', eventDateTo: '2024-09-15', status: 'sent', quotedPrice: 4500, confirmedPrice: null, phone: '', shootType: 'Wedding', depositPaid: null, followUpDate: null, location: '', notes: '' },
            { id: 2, clientName: 'Ananya Sharma', clientEmail: 'ananya.s@example.com', eventDate: '2024-10-05', eventDateTo: '2024-10-05', status: 'confirmed', quotedPrice: 2200, confirmedPrice: 2200, phone: '', shootType: 'Wedding', depositPaid: true, followUpDate: null, location: '', notes: '' },
            { id: 3, clientName: 'Vikram Singh', clientEmail: 'vikram.singh@example.com', eventDate: '2024-09-21', eventDateTo: '2024-09-21', status: 'sent', quotedPrice: 3000, confirmedPrice: null, phone: '', shootType: 'Engagement', depositPaid: null, followUpDate: null, location: '', notes: '' },
            { id: 4, clientName: 'Meera Desai', clientEmail: 'meera.d@example.com', eventDate: '2024-11-02', eventDateTo: '2024-11-02', status: 'rejected', quotedPrice: 1800, confirmedPrice: null, phone: '', shootType: '', depositPaid: null, followUpDate: null, location: '', notes: '' },
            { id: 5, clientName: 'Arjun & Diya', clientEmail: 'arjun.d@example.com', eventDate: '2024-10-06', eventDateTo: '2024-10-06', status: 'confirmed', quotedPrice: 7500, confirmedPrice: 7000, phone: '', shootType: 'Wedding', depositPaid: false, followUpDate: null, location: '', notes: '' },
        ];
        saveQuotes();
    }

    function saveQuotes() {
        try {
            localStorage.setItem('aakaaraQuotes', JSON.stringify(quotes));
        } catch (err) {
            console.error('localStorage quota exceeded.', err);
            alert('Unable to save: storage is full. Export your data first.');
        }
    }

    // 2. STATE
    let activeFilter = 'all';
    let searchTerm = '';
    let currentCalendarDate = new Date();

    // 3. STATS
    function renderStats() {
        const s = computeStats(quotes);
        document.querySelector('#statTotal .stat-value').textContent = s.total;
        document.querySelector('#statConfirmed .stat-value').textContent = s.confirmed;
        document.querySelector('#statPending .stat-value').textContent = s.pending;
        document.querySelector('#statRevenue .stat-value').textContent = '$' + s.revenue.toLocaleString();
        document.getElementById('statRevenueSub').textContent =
            s.unpaidDeposits > 0
                ? `${s.unpaidDeposits} deposit${s.unpaidDeposits > 1 ? 's' : ''} unpaid`
                : 'All deposits paid';
    }

    // 4. FILTER PILLS
    const FIXED_PILLS = [
        { key: 'all', label: 'All' },
        { key: 'confirmed', label: 'Confirmed' },
        { key: 'sent', label: 'Sent' },
        { key: 'rejected', label: 'Rejected' },
        { key: 'Wedding', label: 'Wedding' },
        { key: 'Engagement', label: 'Engagement' },
        { key: 'Maternity', label: 'Maternity' },
        { key: 'Graduation', label: 'Graduation' },
        { key: 'Birthday', label: 'Birthday' },
        { key: 'Other', label: 'Other' },
    ];

    function renderFilterPills() {
        const pills = document.getElementById('filterPills');
        const defs = FIXED_PILLS;
        pills.innerHTML = defs.map(({ key, label }) =>
            `<button class="filter-pill${activeFilter === key ? ' active' : ''}" data-filter="${escapeHtml(key)}">${escapeHtml(label)}</button>`
        ).join('');

        pills.querySelectorAll('.filter-pill').forEach(btn => {
            btn.addEventListener('click', () => {
                activeFilter = btn.dataset.filter;
                renderFilterPills();
                renderCards();
            });
        });
    }

    // 5. CARD GRID
    function formatDate(dateStr) {
        if (!dateStr) return '';
        return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    }

    function renderCards() {
        const container = document.getElementById('crmCards');
        const sorted = [...quotes].sort((a, b) => new Date(a.eventDate) - new Date(b.eventDate));
        const filtered = filterQuotes(sorted, activeFilter, searchTerm);

        if (!filtered.length) {
            container.innerHTML = '';
            const empty = document.createElement('div');
            empty.className = 'crm-empty';
            empty.textContent = 'No clients match your search.';
            container.appendChild(empty);
            renderCalendar();
            return;
        }

        container.innerHTML = '';
        filtered.forEach(q => {
            const dateDisplay = q.eventDateTo && q.eventDateTo !== q.eventDate
                ? `${formatDate(q.eventDate)} – ${formatDate(q.eventDateTo)}`
                : formatDate(q.eventDate);

            const badgeClass = { confirmed: 'badge-confirmed', sent: 'badge-sent', rejected: 'badge-rejected' }[q.status] || '';
            const badgeLabel = { confirmed: 'Confirmed', sent: 'Quote Sent', rejected: 'Rejected' }[q.status] || q.status;

            const card = document.createElement('div');
            card.className = `client-card status-${q.status}`;
            card.setAttribute('role', 'listitem');
            card.dataset.id = q.id;

            // Card top: name + status badge
            const top = document.createElement('div');
            top.className = 'card-top';

            const nameEl = document.createElement('div');
            nameEl.className = 'card-name';
            nameEl.textContent = q.clientName;

            const badge = document.createElement('div');
            badge.className = `card-status-badge ${badgeClass}`;
            badge.textContent = badgeLabel;

            top.appendChild(nameEl);
            top.appendChild(badge);
            card.appendChild(top);

            // Field helper — uses textContent, no XSS risk
            function addField(svgPath, content, isLink, href) {
                if (!content) return;
                const row = document.createElement('div');
                row.className = 'card-field';
                row.innerHTML = `<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">${svgPath}</svg>`;
                if (isLink) {
                    const a = document.createElement('a');
                    a.href = href;
                    a.textContent = content;
                    row.appendChild(a);
                } else {
                    const span = document.createElement('span');
                    span.textContent = content;
                    row.appendChild(span);
                }
                card.appendChild(row);
            }

            addField('<rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>', dateDisplay);
            addField('<path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.15 12a19.79 19.79 0 0 1-3.07-8.63A2 2 0 0 1 3.05 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 21 16.92z"/>', q.phone, true, `tel:${q.phone}`);
            addField('<path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>', q.location);
            addField('<path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/>', q.shootType);

            // Divider
            const divider = document.createElement('hr');
            divider.className = 'card-divider';
            card.appendChild(divider);

            // Price row
            const priceRow = document.createElement('div');
            priceRow.className = 'card-price-row';

            const prices = document.createElement('div');
            prices.className = 'card-prices';
            function priceCell(label, value) {
                const cell = document.createElement('div');
                const lbl = document.createElement('div');
                lbl.className = 'price-lbl';
                lbl.textContent = label;
                const val = document.createElement('div');
                val.className = 'price-val';
                val.textContent = value;
                cell.appendChild(lbl);
                cell.appendChild(val);
                return cell;
            }
            prices.appendChild(priceCell('Quoted', '$' + (q.quotedPrice || 0).toLocaleString()));
            prices.appendChild(priceCell('Confirmed', q.confirmedPrice ? '$' + q.confirmedPrice.toLocaleString() : '—'));
            priceRow.appendChild(prices);

            if (q.depositPaid === true || q.depositPaid === false) {
                const dep = document.createElement('span');
                dep.className = `deposit-badge ${q.depositPaid ? 'deposit-paid' : 'deposit-unpaid'}`;
                dep.textContent = q.depositPaid ? 'Deposit ✓' : 'Deposit Due';
                priceRow.appendChild(dep);
            }
            card.appendChild(priceRow);

            // Follow-up
            if (q.followUpDate) {
                const fu = document.createElement('div');
                fu.className = `card-followup${isOverdue(q.followUpDate) ? ' overdue' : ''}`;
                fu.innerHTML = `<svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>`;
                fu.appendChild(document.createTextNode(
                    `${isOverdue(q.followUpDate) ? 'Overdue: ' : 'Follow up: '}${formatDate(q.followUpDate)}`
                ));
                card.appendChild(fu);
            }

            // Notes
            if (q.notes) {
                const notes = document.createElement('div');
                notes.className = 'card-notes';
                notes.textContent = q.notes;
                card.appendChild(notes);
            }

            // Action buttons
            const actions = document.createElement('div');
            actions.className = 'card-actions';

            const emailBtn = document.createElement('button');
            emailBtn.className = 'card-btn btn-email';
            emailBtn.innerHTML = `<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>`;
            emailBtn.appendChild(document.createTextNode(' Copy Email'));
            emailBtn.addEventListener('click', () => {
                if (!q.clientEmail) return;
                const origHTML = emailBtn.innerHTML;
                navigator.clipboard.writeText(q.clientEmail)
                    .then(() => {
                        emailBtn.textContent = 'Copied!';
                        setTimeout(() => { emailBtn.innerHTML = origHTML; }, 2000);
                    })
                    .catch(() => {
                        emailBtn.textContent = 'Copy failed';
                        setTimeout(() => { emailBtn.innerHTML = origHTML; }, 2000);
                    });
            });

            const editBtn = document.createElement('button');
            editBtn.className = 'card-btn btn-edit';
            editBtn.innerHTML = `<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>`;
            editBtn.appendChild(document.createTextNode(' Edit'));
            editBtn.addEventListener('click', () => openModal(q));

            const deleteBtn = document.createElement('button');
            deleteBtn.className = 'card-btn btn-delete';
            deleteBtn.innerHTML = `<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>`;
            deleteBtn.appendChild(document.createTextNode(' Delete'));
            const deleteBtnOrigHTML = deleteBtn.innerHTML + ' Delete';
            deleteBtn.addEventListener('click', () => {
                if (!deleteBtn.classList.contains('confirm-state')) {
                    deleteBtn.classList.add('confirm-state');
                    deleteBtn.textContent = 'Sure?';
                    deleteBtn._revertTimeout = setTimeout(() => {
                        if (!deleteBtn.isConnected) return;
                        deleteBtn.classList.remove('confirm-state');
                        deleteBtn.innerHTML = deleteBtnOrigHTML;
                    }, 5000);
                } else {
                    clearTimeout(deleteBtn._revertTimeout);
                    quotes = quotes.filter(x => x.id !== q.id);
                    saveQuotes();
                    renderStats();
                    renderFilterPills();
                    renderCards();
                }
            });

            actions.appendChild(emailBtn);
            actions.appendChild(editBtn);
            actions.appendChild(deleteBtn);
            card.appendChild(actions);
            container.appendChild(card);
        });

        renderCalendar();
    }

    // 6. CALENDAR
    function renderCalendar() {
        const calendarDays = document.getElementById('calendarDays');
        const calendarMonthYear = document.getElementById('calendarMonthYear');
        const calendarWeekdays = document.getElementById('calendarWeekdays');
        calendarDays.innerHTML = '';
        calendarWeekdays.innerHTML = '';

        const month = currentCalendarDate.getMonth();
        const year = currentCalendarDate.getFullYear();
        calendarMonthYear.textContent = `${currentCalendarDate.toLocaleString('default', { month: 'long' })} ${year}`;

        // Build a list of events per date so double-bookings surface as conflicts
        const eventsByDate = {};
        quotes.forEach(q => {
            if (q.status === 'rejected' || !q.eventDate) return;
            const startDate = new Date(q.eventDate + 'T00:00:00');
            if (isNaN(startDate)) return;
            const rawEnd = q.eventDateTo ? new Date(q.eventDateTo + 'T00:00:00') : startDate;
            const endDate = rawEnd >= startDate ? rawEnd : startDate;
            for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
                const key = d.toISOString().split('T')[0];
                if (!eventsByDate[key]) eventsByDate[key] = [];
                eventsByDate[key].push({ clientName: q.clientName, status: q.status });
            }
        });

        ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].forEach(day => {
            const wd = document.createElement('div');
            wd.className = 'calendar-weekday';
            wd.textContent = day;
            calendarWeekdays.appendChild(wd);
        });

        const firstDay = new Date(year, month, 1).getDay();
        const daysInMonth = new Date(year, month + 1, 0).getDate();

        for (let i = 0; i < firstDay; i++) {
            calendarDays.appendChild(Object.assign(document.createElement('div'), { className: 'calendar-day' }));
        }

        for (let i = 1; i <= daysInMonth; i++) {
            const el = document.createElement('div');
            el.className = 'calendar-day';
            el.textContent = i;
            const key = `${year}-${String(month + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
            const events = eventsByDate[key];
            if (events) {
                const hasConfirmed = events.some(e => e.status === 'confirmed');
                const isConflict = events.length > 1 && hasConfirmed;
                el.classList.add(isConflict ? 'conflict' : hasConfirmed ? 'occupied' : 'pending');
                const tip = document.createElement('div');
                tip.className = 'tooltip';
                tip.textContent = isConflict
                    ? `Double-booked: ${events.map(e => e.clientName).join(', ')}`
                    : `${hasConfirmed ? 'Occupied' : 'Pending'}: ${events[0].clientName}`;
                el.appendChild(tip);
            }
            calendarDays.appendChild(el);
        }
    }

    // 7. MODAL
    const backdrop = document.getElementById('modalBackdrop');
    const form = document.getElementById('clientForm');
    const fStatus = document.getElementById('fStatus');
    const confirmedPriceGroup = document.getElementById('confirmedPriceGroup');
    const depositGroup = document.getElementById('depositGroup');

    function toggleConfirmedFields() {
        const show = fStatus.value === 'confirmed';
        confirmedPriceGroup.style.display = show ? '' : 'none';
        depositGroup.style.display = show ? '' : 'none';
    }

    function openModal(quote = null) {
        document.getElementById('modalTitle').textContent = quote ? 'Edit Client' : 'New Client';
        form.reset();
        if (quote) {
            document.getElementById('fId').value = quote.id;
            document.getElementById('fName').value = quote.clientName || '';
            document.getElementById('fEmail').value = quote.clientEmail || '';
            document.getElementById('fPhone').value = quote.phone || '';
            document.getElementById('fEventDate').value = quote.eventDate || '';
            document.getElementById('fEventDateTo').value = quote.eventDateTo || '';
            document.getElementById('fShootType').value = quote.shootType || '';
            document.getElementById('fLocation').value = quote.location || '';
            document.getElementById('fQuotedPrice').value = quote.quotedPrice || '';
            fStatus.value = quote.status || 'sent';
            document.getElementById('fConfirmedPrice').value = quote.confirmedPrice || '';
            document.getElementById('fDepositPaid').value =
                quote.depositPaid === true ? 'true' : quote.depositPaid === false ? 'false' : '';
            document.getElementById('fFollowUpDate').value = quote.followUpDate || '';
            document.getElementById('fNotes').value = quote.notes || '';
        }
        toggleConfirmedFields();
        backdrop.classList.add('open');
        document.getElementById('fName').focus();
    }

    function closeModal() { backdrop.classList.remove('open'); }

    fStatus.addEventListener('change', toggleConfirmedFields);
    document.getElementById('addClientBtn').addEventListener('click', () => openModal());
    document.getElementById('modalClose').addEventListener('click', closeModal);
    document.getElementById('modalCancel').addEventListener('click', closeModal);
    backdrop.addEventListener('click', e => { if (e.target === backdrop) closeModal(); });
    document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });

    form.addEventListener('submit', e => {
        e.preventDefault();
        const name = document.getElementById('fName').value.trim();
        const eventDate = document.getElementById('fEventDate').value;
        if (!name || !eventDate) return;

        const depositVal = document.getElementById('fDepositPaid').value;
        const editIdStr = document.getElementById('fId').value;
        // Preserve original ID type (numeric or string) to ensure map comparison matches
        const existingQuote = editIdStr ? quotes.find(q => String(q.id) === editIdStr) : null;
        const record = {
            id: existingQuote ? existingQuote.id : generateId(quotes),
            clientName: name,
            clientEmail: document.getElementById('fEmail').value.trim(),
            phone: document.getElementById('fPhone').value.trim(),
            eventDate,
            eventDateTo: document.getElementById('fEventDateTo').value || eventDate,
            shootType: document.getElementById('fShootType').value,
            location: document.getElementById('fLocation').value.trim(),
            quotedPrice: parseFloat(document.getElementById('fQuotedPrice').value) || 0,
            status: fStatus.value,
            confirmedPrice: parseFloat(document.getElementById('fConfirmedPrice').value) || null,
            depositPaid: depositVal === 'true' ? true : depositVal === 'false' ? false : null,
            followUpDate: document.getElementById('fFollowUpDate').value || null,
            notes: document.getElementById('fNotes').value.trim(),
        };

        if (existingQuote) {
            quotes = quotes.map(q => q.id === record.id ? record : q);
        } else {
            quotes.push(record);
        }

        saveQuotes();
        closeModal();
        renderStats();
        renderFilterPills();
        renderCards();
    });

    // 8. SEARCH
    let searchDebounce;
    document.getElementById('crmSearch').addEventListener('input', e => {
        clearTimeout(searchDebounce);
        searchDebounce = setTimeout(() => {
            searchTerm = e.target.value;
            renderCards();
        }, 200);
    });

    // 9. CALENDAR NAV — pin to day=1 to avoid month-overflow (e.g. May 31 + 1 month = July 1)
    document.getElementById('prevMonth').addEventListener('click', () => {
        currentCalendarDate = new Date(currentCalendarDate.getFullYear(), currentCalendarDate.getMonth() - 1, 1);
        renderCalendar();
    });
    document.getElementById('nextMonth').addEventListener('click', () => {
        currentCalendarDate = new Date(currentCalendarDate.getFullYear(), currentCalendarDate.getMonth() + 1, 1);
        renderCalendar();
    });

    // 10. CSV EXPORT — UTF-8 BOM ensures Excel renders non-ASCII names correctly
    function exportToExcel() {
        const sorted = [...quotes].sort((a, b) => new Date(a.eventDate) - new Date(b.eventDate));
        const headers = ['ID','Name','Email','Phone','Event Date','End Date','Shoot Type','Location','Status','Quoted Price','Confirmed Price','Deposit Paid','Notes'];
        const csvRows = sorted.map(q => {
            const start = formatDate(q.eventDate);
            const end = q.eventDateTo && q.eventDateTo !== q.eventDate ? formatDate(q.eventDateTo) : start;
            const cells = [
                q.id, q.clientName, q.clientEmail || '', q.phone || '',
                start, end, q.shootType || '', q.location || '',
                q.status.charAt(0).toUpperCase() + q.status.slice(1),
                q.quotedPrice || '', q.confirmedPrice || '',
                q.depositPaid === true ? 'Paid' : q.depositPaid === false ? 'Unpaid' : '',
                q.notes || '',
            ];
            return cells.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',');
        });
        const csv = '﻿' + [headers.join(','), ...csvRows].join('\r\n');
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'aakaara-clients.csv';
        a.click();
        URL.revokeObjectURL(url);
    }

    // 11. INIT
    renderStats();
    renderFilterPills();
    renderCards();
    renderCalendar();
    document.getElementById('crmExportBtn').addEventListener('click', exportToExcel);

});
