document.addEventListener('DOMContentLoaded', function() {

    // --- 1. DATA MANAGEMENT ---
    // Load from localStorage or use mock data as a fallback.
    let quotes = [];
    const storedQuotes = localStorage.getItem('aakaaraQuotes');

    if (storedQuotes) {
        quotes = JSON.parse(storedQuotes);
    } else {
        // Fallback to mock data if nothing is stored, then save it.
        quotes = [
            { id: 1, clientName: 'Priya & Rohan', clientEmail: 'priya.r@example.com', eventDate: '2024-09-14', eventDateTo: '2024-09-15', status: 'sent', quotedPrice: 4500, confirmedPrice: null },
            { id: 2, clientName: 'Ananya Sharma', clientEmail: 'ananya.s@example.com', eventDate: '2024-10-05', eventDateTo: '2024-10-05', status: 'confirmed', quotedPrice: 2200, confirmedPrice: 2200 },
            { id: 3, clientName: 'Vikram Singh', clientEmail: 'vikram.singh@example.com', eventDate: '2024-09-21', eventDateTo: '2024-09-21', status: 'sent', quotedPrice: 3000, confirmedPrice: null },
            { id: 4, clientName: 'Meera Desai', clientEmail: 'meera.d@example.com', eventDate: '2024-11-02', eventDateTo: '2024-11-02', status: 'rejected', quotedPrice: 1800, confirmedPrice: null },
            { id: 5, clientName: 'Arjun & Diya', clientEmail: 'arjun.d@example.com', eventDate: '2024-10-06', eventDateTo: '2024-10-06', status: 'confirmed', quotedPrice: 7500, confirmedPrice: 7000 },
        ];
        localStorage.setItem('aakaaraQuotes', JSON.stringify(quotes));
    }

    // Function to save all quotes back to localStorage
    function saveQuotes() {
        localStorage.setItem('aakaaraQuotes', JSON.stringify(quotes));
    }
    const quoteTableBody = document.querySelector('#quoteTable tbody');
    let currentDate = new Date();

    // --- 2. RENDER FUNCTIONS ---

    function renderQuotes() {
        quoteTableBody.innerHTML = '';
        quotes.forEach(quote => {
            const row = document.createElement('tr');

            const statusOptions = `
                <option value="sent" ${quote.status === 'sent' ? 'selected' : ''}>Sent</option>
                <option value="confirmed" ${quote.status === 'confirmed' ? 'selected' : ''}>Confirmed</option>
                <option value="rejected" ${quote.status === 'rejected' ? 'selected' : ''}>Rejected</option>
            `;

            const confirmedPriceInput = `
                <input 
                    type="number" 
                    class="price-input" 
                    value="${quote.confirmedPrice || ''}" 
                    ${quote.status !== 'confirmed' ? 'disabled' : ''}
                    data-id="${quote.id}"
                />`;

            let dateDisplay = new Date(quote.eventDate + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
            if (quote.eventDateTo && quote.eventDateTo !== quote.eventDate) {
                const dateToDisplay = new Date(quote.eventDateTo + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
                dateDisplay += ` to ${dateToDisplay}`;
            }

            row.innerHTML = `
                <td>${quote.clientName}</td>
                <td>${dateDisplay}</td>
                <td>
                    <select class="status-select" data-id="${quote.id}">
                        ${statusOptions}
                    </select>
                </td>
                <td>$${quote.quotedPrice.toLocaleString()}</td>
                <td>${confirmedPriceInput}</td>
                <td>
                    <button class="btn-copy" data-email="${quote.clientEmail || ''}" title="Copy Email">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                    </button>
                </td>
            `;

            // Apply styling based on status
            const select = row.querySelector('.status-select');
            styleStatus(select, quote.status);

            quoteTableBody.appendChild(row);
        });

        addEventListeners();
        renderCalendar(); // Re-render calendar when quotes change
    }

    function renderCalendar() {
        const calendarDays = document.getElementById('calendarDays');
        const calendarMonthYear = document.getElementById('calendarMonthYear');
        const calendarWeekdays = document.getElementById('calendarWeekdays');
        calendarDays.innerHTML = '';
        calendarWeekdays.innerHTML = '';

        const month = currentDate.getMonth();
        const year = currentDate.getFullYear();

        calendarMonthYear.textContent = `${currentDate.toLocaleString('default', { month: 'long' })} ${year}`;

        // Get all events and populate a map of dates, handling ranges
        const eventsByDate = {};
        quotes.forEach(q => {
            if (q.status === 'rejected' || !q.eventDate) return;

            const startDate = new Date(q.eventDate + 'T00:00:00');
            const endDate = q.eventDateTo ? new Date(q.eventDateTo + 'T00:00:00') : startDate;

            // Loop from start to end date
            for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
                const dateString = d.toISOString().split('T')[0];

                // If a date already has a confirmed event, don't overwrite it with a pending one
                if (eventsByDate[dateString] && eventsByDate[dateString].status === 'confirmed' && q.status !== 'confirmed') {
                    continue;
                }
            
                eventsByDate[dateString] = { clientName: q.clientName, status: q.status };
            }
        });

        // Render weekdays
        const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        weekdays.forEach(day => {
            calendarWeekdays.innerHTML += `<div class="calendar-weekday">${day}</div>`;
        });

        const firstDayOfMonth = new Date(year, month, 1).getDay();
        const daysInMonth = new Date(year, month + 1, 0).getDate();

        // Add blank days for the start of the month
        for (let i = 0; i < firstDayOfMonth; i++) {
            calendarDays.innerHTML += `<div class="calendar-day"></div>`;
        }

        // Add days of the month
        for (let i = 1; i <= daysInMonth; i++) {
            const dayEl = document.createElement('div');
            dayEl.classList.add('calendar-day');
            dayEl.textContent = i;

            const dateString = `${year}-${String(month + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
            const event = eventsByDate[dateString];

            if (event) {
                if (event.status === 'confirmed') {
                    dayEl.classList.add('occupied');
                    dayEl.innerHTML += `<div class="tooltip">Occupied: ${event.clientName}</div>`;
                } else if (event.status === 'sent') {
                    dayEl.classList.add('pending');
                    dayEl.innerHTML += `<div class="tooltip">Pending: ${event.clientName}</div>`;
                }
            }
            
            calendarDays.appendChild(dayEl);
        }
    }

    // --- 3. EVENT HANDLING ---

    function addEventListeners() {
        // Status change
        document.querySelectorAll('.status-select').forEach(select => {
            select.addEventListener('change', (e) => {
                const quoteId = parseInt(e.target.dataset.id);
                const newStatus = e.target.value;
                
                const quote = quotes.find(q => q.id === quoteId);
                if (quote) {
                    quote.status = newStatus;
                    saveQuotes(); // Save changes to localStorage
                    renderQuotes(); // Re-render to update UI
                }
            });
        });

        // Confirmed price change
        document.querySelectorAll('.price-input').forEach(input => {
            input.addEventListener('change', (e) => {
                const quoteId = parseInt(e.target.dataset.id);
                const newPrice = parseFloat(e.target.value);

                const quote = quotes.find(q => q.id === quoteId);
                if (quote && !isNaN(newPrice)) {
                    quote.confirmedPrice = newPrice;
                    saveQuotes(); // Save changes to localStorage
                }
            });
        });

        // Copy email button
        document.querySelectorAll('.btn-copy').forEach(button => {
            button.addEventListener('click', () => {
                const email = button.dataset.email;
                if (!email) return;

                navigator.clipboard.writeText(email).then(() => {
                    const originalContent = button.innerHTML;
                    button.textContent = 'Copied!';
                    button.classList.add('copied');
                    setTimeout(() => {
                        button.innerHTML = originalContent;
                        button.classList.remove('copied');
                    }, 2000);
                }).catch(err => {
                    console.error('Failed to copy email: ', err);
                });
            });
        });
    }

    function styleStatus(selectElement, status) {
        selectElement.className = 'status-select'; // Reset
        switch (status) {
            case 'sent':
                selectElement.style.color = '#e0a458';
                selectElement.style.backgroundColor = 'rgba(224,164,88,0.1)';
                break;
            case 'confirmed':
                selectElement.style.color = '#a8b8a0';
                selectElement.style.backgroundColor = 'rgba(138,154,126,0.1)';
                break;
            case 'rejected':
                selectElement.style.color = '#c28ca0';
                selectElement.style.backgroundColor = 'rgba(122,59,78,0.1)';
                break;
        }
    }

    // Calendar navigation
    document.getElementById('prevMonth').addEventListener('click', () => {
        currentDate.setMonth(currentDate.getMonth() - 1);
        renderCalendar();
    });

    document.getElementById('nextMonth').addEventListener('click', () => {
        currentDate.setMonth(currentDate.getMonth() + 1);
        renderCalendar();
    });


    // --- 4. INITIAL RENDER ---
    renderQuotes();

});