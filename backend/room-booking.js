// ── Data ────────────────────────────────────────────────────────────────────
    const ROOMS = [
      { id: 'eagle', label: 'Eagle Boardroom', cls: 'room-eagle', dot: '#93c5fd' },
      { id: 'summit', label: 'Summit Event Hall', cls: 'room-summit', dot: '#fca5a5' },
      { id: 'ark', label: 'Ark (near Eagle)', cls: 'room-ark', dot: '#6ee7b7' },
      { id: 'armour', label: 'Armour (beside Pigeon)', cls: 'room-armour', dot: '#d1d5db' },
      { id: 'inspiration', label: 'Inspiration Lounge', cls: 'room-inspiration', dot: '#c4b5fd' },
      { id: 'nest', label: 'Nest / Nursing Room', cls: 'room-nest', dot: '#fde68a' },
    ];

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let bookings = [];
    let nextId = 1;

    // ── State ────────────────────────────────────────────────────────────────────
    let currentView = 'week';
    let currentDate = new Date(today);
    let miniDate = new Date(today);
    let visibleRooms = new Set(ROOMS.map((r) => r.id));
    let editingId = null;

    // ── Helpers ──────────────────────────────────────────────────────────────────
    function fmtDate(d) {
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${y}-${m}-${day}`;
    }
    function offsetDate(d, n) {
      const x = new Date(d);
      x.setDate(x.getDate() + n);
      return x;
    }
    function parseDate(s) {
      const [y, m, dy] = s.split('-').map(Number);
      return new Date(y, m - 1, dy);
    }
    function startOfWeek(d) {
      const x = new Date(d);
      x.setHours(0, 0, 0, 0);
      const day = x.getDay();
      const diff = day === 0 ? -6 : 1 - day;
      x.setDate(x.getDate() + diff);
      return x;
    }
    function timeToMins(t) {
      const [h, m] = t.split(':').map(Number);
      return h * 60 + m;
    }
    function minsToTime(n) {
      return String(Math.floor(n / 60)).padStart(2, '0') + ':' + String(n % 60).padStart(2, '0');
    }
    function nextRecurringDate(current, recurrence, anchorDay) {
      const next = new Date(current);
      if (recurrence === 'daily') {
        next.setDate(next.getDate() + 1);
        return next;
      }
      if (recurrence === 'weekly') {
        next.setDate(next.getDate() + 7);
        return next;
      }
      if (recurrence === 'biweekly') {
        next.setDate(next.getDate() + 14);
        return next;
      }
      if (recurrence === 'monthly') {
        const monthStart = new Date(next.getFullYear(), next.getMonth() + 1, 1);
        const monthLastDay = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 0).getDate();
        monthStart.setDate(Math.min(anchorDay, monthLastDay));
        return monthStart;
      }
      return null;
    }
    function roomById(id) {
      return ROOMS.find((r) => r.id === id);
    }
    function visibleBookingsForDate(ds) {
      return bookings.filter((b) => b.date === ds && visibleRooms.has(b.room));
    }

    const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    const DAYS_SHORT = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];

    // ── Render ────────────────────────────────────────────────────────────────────
    function render() {
      renderToolbar();
      if (currentView === 'week') renderWeek();
      else if (currentView === 'day') renderDay();
      else renderMonth();
      renderMiniCal();
      renderRoomChips();
      syncRoomFilterUI();
    }

    function renderToolbar() {
      document.getElementById('btn-week').className = currentView === 'week' ? 'active' : '';
      document.getElementById('btn-day').className = currentView === 'day' ? 'active' : '';
      document.getElementById('btn-month').className = currentView === 'month' ? 'active' : '';
      if (currentView === 'week') {
        const ws = startOfWeek(currentDate);
        const we = offsetDate(ws, 6);
        const label =
          ws.getMonth() === we.getMonth()
            ? `${MONTHS[ws.getMonth()]} ${ws.getDate()}–${we.getDate()}, ${ws.getFullYear()}`
            : `${MONTHS[ws.getMonth()]} ${ws.getDate()} – ${MONTHS[we.getMonth()]} ${we.getDate()}, ${ws.getFullYear()}`;
        document.getElementById('rangeLabel').textContent = label;
      } else if (currentView === 'day') {
        const d = currentDate;
        document.getElementById('rangeLabel').textContent = `${MONTHS[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
      } else {
        const d = currentDate;
        document.getElementById('rangeLabel').textContent = `${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
      }
    }

    function renderWeek() {
      document.querySelector('.week-grid-wrap').style.display = '';
      document.getElementById('monthView').style.display = 'none';
      const ws = startOfWeek(currentDate);
      const days = Array.from({ length: 7 }, (_, i) => offsetDate(ws, i));
      const hdr = document.getElementById('weekHeader');
      const body = document.getElementById('weekBody');
      hdr.style.gridTemplateColumns = '';
      body.style.gridTemplateColumns = '';

      hdr.innerHTML =
        `<div class="week-header-cell"></div>` +
        days
          .map((d) => {
            const isToday = fmtDate(d) === fmtDate(today);
            return `<div class="week-header-cell">
        ${DAYS_SHORT[(d.getDay() + 6) % 7]}
        <div class="day-num${isToday ? ' today' : ''}">${d.getDate()}</div>
      </div>`;
          })
          .join('');

      const HOURS = Array.from({ length: 24 }, (_, i) => i);
      let html = '';

      html += `<div class="time-col">${HOURS.map((h) => `<div class="time-slot">${h}:00</div>`).join('')}</div>`;

      days.forEach((d) => {
        const ds = fmtDate(d);
        const dayBookings = visibleBookingsForDate(ds);
        let colHtml = `<div class="day-col" data-date="${ds}" onclick="slotClick(event,'${ds}')">`;
        HOURS.forEach((h) => {
          colHtml += `<div class="hour-cell" data-hour="${h}"></div>`;
        });
        dayBookings.forEach((b) => {
          const top = (timeToMins(b.start) / 60) * 48;
          const height = ((timeToMins(b.end) - timeToMins(b.start)) / 60) * 48;
          const room = roomById(b.room);
          colHtml += `<div class="booking-block ${room.cls}" 
        style="top:${top}px;height:${Math.max(height, 20)}px"
        data-id="${b.id}"
        onclick="showDetail(event,${b.id})"
        title="${b.title} (${b.start}–${b.end})">
        <strong>${b.title}</strong>
        <small>${b.start}–${b.end}</small>
      </div>`;
        });
        colHtml += `</div>`;
        html += colHtml;
      });

      body.innerHTML = html;
      body.scrollTop = 7 * 48;
    }

    function renderDay() {
      document.querySelector('.week-grid-wrap').style.display = '';
      document.getElementById('monthView').style.display = 'none';
      const ds = fmtDate(currentDate);
      const hdr = document.getElementById('weekHeader');
      const body = document.getElementById('weekBody');
      const isToday = ds === fmtDate(today);

      hdr.style.gridTemplateColumns = '52px 1fr';
      body.style.gridTemplateColumns = '52px 1fr';

      hdr.innerHTML = `<div class="week-header-cell"></div>
    <div class="week-header-cell">
      ${DAYS_SHORT[(currentDate.getDay() + 6) % 7]}
      <div class="day-num${isToday ? ' today' : ''}">${currentDate.getDate()}</div>
    </div>`;

      const HOURS = Array.from({ length: 24 }, (_, i) => i);
      const dayBookings = visibleBookingsForDate(ds);
      let html = `<div class="time-col">${HOURS.map((h) => `<div class="time-slot">${h}:00</div>`).join('')}</div>`;
      let col = `<div class="day-col" data-date="${ds}" onclick="slotClick(event,'${ds}')">`;
      HOURS.forEach((h) => {
        col += `<div class="hour-cell" data-hour="${h}"></div>`;
      });
      dayBookings.forEach((b) => {
        const top = (timeToMins(b.start) / 60) * 48;
        const height = ((timeToMins(b.end) - timeToMins(b.start)) / 60) * 48;
        const room = roomById(b.room);
        col += `<div class="booking-block ${room.cls}" 
      style="top:${top}px;height:${Math.max(height, 20)}px"
      data-id="${b.id}"
      onclick="showDetail(event,${b.id})"
      title="${b.title}">
      <strong>${b.title}</strong>
      <small>${b.start}–${b.end} &middot; ${room.label}</small>
    </div>`;
      });
      col += `</div>`;
      body.innerHTML = html + col;
      body.scrollTop = 7 * 48;
    }

    function renderMonth() {
      document.querySelector('.week-grid-wrap').style.display = 'none';
      document.getElementById('monthView').style.display = 'block';
      const grid = document.getElementById('monthGrid');
      const y = currentDate.getFullYear();
      const m = currentDate.getMonth();
      const first = new Date(y, m, 1);
      const startOffset = (first.getDay() + 6) % 7;
      const start = offsetDate(first, -startOffset);
      const days = Array.from({ length: 42 }, (_, i) => offsetDate(start, i));

      let html = DAYS_SHORT.map((d) => `<div class="month-dow">${d}</div>`).join('');
      days.forEach((d) => {
        const ds = fmtDate(d);
        const dayBookings = visibleBookingsForDate(ds).sort((a, b) => a.start.localeCompare(b.start));
        const cls = [
          d.getMonth() !== m ? 'other-month' : '',
          ds === fmtDate(today) ? 'today' : ''
        ].filter(Boolean).join(' ');
        html += `<div class="month-cell ${cls}" data-date="${ds}" onclick="openModal({date:'${ds}'})">
          <div class="month-cell-head">
            <span>${d.getDate()}</span>
            ${dayBookings.length ? `<span class="month-count">${dayBookings.length}</span>` : ''}
          </div>
          ${dayBookings.slice(0, 3).map((b) => {
            const room = roomById(b.room);
            return `<button class="month-booking ${room.cls}" type="button" onclick="showDetail(event,${b.id})" title="${b.title} · ${room.label}">
              ${b.start} ${b.title}
            </button>`;
          }).join('')}
          ${dayBookings.length > 3 ? `<div class="month-more">+${dayBookings.length - 3} more</div>` : ''}
        </div>`;
      });
      grid.innerHTML = html;
    }

    function renderMiniCal() {
      const y = miniDate.getFullYear(),
        m = miniDate.getMonth();
      document.getElementById('miniMonthLabel').textContent = `${MONTHS[m]} ${y}`;
      const first = new Date(y, m, 1).getDay();
      const daysInMonth = new Date(y, m + 1, 0).getDate();
      const startOffset = (first + 6) % 7;
      const booked = new Set(bookings.filter((b) => visibleRooms.has(b.room)).map((b) => b.date));
      let html = DAYS_SHORT.map((d) => `<div class="dow">${d[0]}</div>`).join('');
      for (let i = 0; i < startOffset; i++) html += `<div class="d other-month"></div>`;
      for (let d = 1; d <= daysInMonth; d++) {
        const dt = new Date(y, m, d);
        const ds = fmtDate(dt);
        const cls = [];
        if (ds === fmtDate(today)) cls.push('today');
        if (ds === fmtDate(currentDate)) cls.push('selected');
        if (booked.has(ds)) cls.push('has-event');
        html += `<div class="d ${cls.join(' ')}" onclick="miniSelect('${ds}')">${d}</div>`;
      }
      document.getElementById('miniCal').innerHTML = html;
    }

    function renderRoomChips() {
      const el = document.getElementById('roomChips');
      const fRoomSel = document.getElementById('fRoom');
      el.innerHTML = ROOMS.map(
        (r) => `
    <label class="room-chip" for="room-filter-${r.id}">
      <input type="checkbox" id="room-filter-${r.id}" data-room-id="${r.id}" ${visibleRooms.has(r.id) ? 'checked' : ''} onchange="toggleRoom('${r.id}',this.checked)">
      <span class="room-dot" style="background:${r.dot}"></span>
      <span>${r.label}</span>
    </label>`
      ).join('');
      if (fRoomSel) fRoomSel.innerHTML = ROOMS.map((r) => `<option value="${r.id}">${r.label}</option>`).join('');
    }

    function syncRoomFilterUI() {
      ROOMS.forEach((r) => {
        const cb = document.getElementById(`room-filter-${r.id}`);
        if (cb) cb.checked = visibleRooms.has(r.id);
      });
    }


    function syncMiniDateToCurrent() {
      miniDate = new Date(currentDate);
    }
    // ── Interaction ───────────────────────────────────────────────────────────────
    function setView(v) {
      currentView = v;
      const hdr = document.getElementById('weekHeader');
      const body = document.getElementById('weekBody');
      hdr.style.gridTemplateColumns = '';
      body.style.gridTemplateColumns = '';
      render();
    }

    function navigate(dir) {
      if (currentView === 'week') currentDate = offsetDate(currentDate, dir * 7);
      else if (currentView === 'day') currentDate = offsetDate(currentDate, dir);
      else currentDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + dir, 1);
      syncMiniDateToCurrent();
      render();
    }

    function goToday() {
      currentDate = new Date(today);
      syncMiniDateToCurrent();
      render();
    }

    function miniNav(dir) {
      miniDate = new Date(miniDate.getFullYear(), miniDate.getMonth() + dir, 1);
      currentDate = new Date(miniDate);
      render();
    }

    function miniSelect(ds) {
      currentDate = parseDate(ds);
      syncMiniDateToCurrent();
      render();
    }

    function toggleRoom(id, on) {
      if (on) visibleRooms.add(id);
      else visibleRooms.delete(id);
      syncRoomFilterUI();
      renderCurrentCalendar();
    }

    function selectAllRooms() {
      ROOMS.forEach((r) => visibleRooms.add(r.id));
      syncRoomFilterUI();
      renderCurrentCalendar();
    }

    function clearRooms() {
      visibleRooms.clear();
      syncRoomFilterUI();
      renderCurrentCalendar();
    }

    function renderCurrentCalendar() {
      if (currentView === 'week') renderWeek();
      else if (currentView === 'day') renderDay();
      else renderMonth();
      renderMiniCal();
    }

    function slotClick(e, ds) {
      if (e.target.closest('.booking-block')) return;
      const cell = e.target.closest('.hour-cell');
      let mins = timeToMins('09:00');

      if (cell && cell.dataset.hour !== undefined) {
        const hour = Number(cell.dataset.hour);
        const rect = cell.getBoundingClientRect();
        const withinCell = Math.min(Math.max(e.clientY - rect.top, 0), rect.height - 1);
        mins = hour * 60 + Math.round((withinCell / rect.height) * 60 / 15) * 15;
      } else {
        const col = e.currentTarget;
        const rect = col.getBoundingClientRect();
        const relY = e.clientY - rect.top + col.closest('.week-body').scrollTop;
        mins = Math.round((relY / 48) * 60 / 15) * 15;
      }

      const start = minsToTime(Math.min(mins, 23 * 60));
      const end = minsToTime(Math.min(mins + 60, 24 * 60 - 1));
      openModal({ date: ds, start, end });
    }

    // ── Modal ─────────────────────────────────────────────────────────────────────
    function openModal(prefill = {}) {
      editingId = null;
      document.getElementById('modalTitle').textContent = 'New Reservation';
      document.getElementById('fTitle').value = '';
      document.getElementById('fRoom').value = ROOMS[0].id;
      document.getElementById('fDate').value = prefill.date || fmtDate(currentDate);
      document.getElementById('fStart').value = prefill.start || '09:00';
      document.getElementById('fEnd').value = prefill.end || '10:00';
      document.getElementById('fBy').value = '';
      document.getElementById('fNotes').value = '';
      document.getElementById('fRecurrence').value = 'none';
      document.getElementById('fRecurrenceEnd').value = '';
      document.getElementById('recurrenceEndGroup').style.display = 'none';
      document.getElementById('bookingModal').showModal();
    }

    function openEditModal(id) {
      const b = bookings.find((x) => x.id === id);
      if (!b) return;
      editingId = id;
      document.getElementById('modalTitle').textContent = 'Edit Reservation';
      document.getElementById('fTitle').value = b.title;
      document.getElementById('fRoom').value = b.room;
      document.getElementById('fDate').value = b.date;
      document.getElementById('fStart').value = b.start;
      document.getElementById('fEnd').value = b.end;
      document.getElementById('fBy').value = b.by || '';
      document.getElementById('fNotes').value = b.notes || '';
      document.getElementById('fRecurrence').value = b.recurrence || 'none';
      document.getElementById('fRecurrenceEnd').value = b.recurrenceEnd || '';
      document.getElementById('recurrenceEndGroup').style.display = b.recurrence && b.recurrence !== 'none' ? 'block' : 'none';
      closeDetail();
      document.getElementById('bookingModal').showModal();
    }

    function closeModal() {
      document.getElementById('bookingModal').close();
    }

    async function saveBooking() {
      const title = document.getElementById('fTitle').value.trim();
      const room = document.getElementById('fRoom').value;
      const date = document.getElementById('fDate').value;
      const start = document.getElementById('fStart').value;
      const end = document.getElementById('fEnd').value;
      const by = document.getElementById('fBy').value.trim();
      const notes = document.getElementById('fNotes').value.trim();
      const recurrence = document.getElementById('fRecurrence').value;
      const recurrenceEnd = document.getElementById('fRecurrenceEnd').value;
      if (!title || !date || !start || !end) {
        alert('Please fill in title, date and times.');
        return;
      }
      if (start >= end) {
        alert('End time must be after start time.');
        return;
      }
      
      // Generate all booking dates based on recurrence
      const datesToBook = [date];
      if (recurrence !== 'none') {
        const startDate = parseDate(date);
        const limitDate = recurrenceEnd ? parseDate(recurrenceEnd) : new Date(startDate.getFullYear() + 2, startDate.getMonth(), startDate.getDate());
        const anchorDay = startDate.getDate();
        const maxOccurrences = 730;
        let currentBookDate = new Date(startDate);

        if (recurrenceEnd && limitDate < startDate) {
          alert('Repeat until date must be the same as or after the booking date.');
          return;
        }

        for (let i = 0; i < maxOccurrences; i++) {
          const nextDate = nextRecurringDate(currentBookDate, recurrence, anchorDay);
          if (!nextDate || nextDate > limitDate) break;
          datesToBook.push(fmtDate(nextDate));
          currentBookDate = nextDate;
        }
      }
      
      // Check conflicts for all dates
      for (let checkDate of datesToBook) {
        const hasConflict = bookings.some((b) => {
          if (editingId && b.id === editingId) return false;
          if (b.room !== room || b.date !== checkDate) return false;
          return start < b.end && end > b.start;
        });
        if (hasConflict) {
          alert(`This room already has a booking during that time on ${checkDate}. Please choose another room or time.`);
          return;
        }
      }
      
      if (editingId) {
        const idx = bookings.findIndex((b) => b.id === editingId);
        if (idx > -1) {
          bookings[idx] = { ...bookings[idx], title, room, date, start, end, by, notes, recurrence: recurrence !== 'none' ? recurrence : null, recurrenceEnd: recurrence !== 'none' ? recurrenceEnd : null };
        }
      } else {
        const saved = await apiPost('/bookings', {
          title,
          room_id: room,
          booking_date: date,
          start_time: start + ':00',
          end_time: end + ':00',
          booked_by_name: by,
          notes,
          recurrence: recurrence !== 'none' ? recurrence : null,
          recurrence_end: recurrence !== 'none' ? recurrenceEnd : null
        });
        bookings.push(mapBooking(saved));

        if (recurrence !== 'none') {
          const refreshed = await apiGet('/bookings');
          bookings = refreshed.map(mapBooking);
        }
      }
      closeModal();
      render();
    }

    // ── Detail popup ──────────────────────────────────────────────────────────────
    function showDetail(e, id) {
      e.stopPropagation();
      const b = bookings.find((x) => x.id === id);
      if (!b) return;
      const room = roomById(b.room);
      const popup = document.getElementById('detailPopup');
      const dateStr = parseDate(b.date).toLocaleDateString('en-SG', {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      });
      document.getElementById('detailContent').innerHTML = `
    <span class="room-tag ${room.cls}">${room.label}</span>
    <h4>${b.title}</h4>
    <p>📅 ${dateStr}</p>
    <p>🕐 ${b.start} – ${b.end}</p>
    ${b.by ? `<p>👤 ${b.by}</p>` : ''}
    ${b.notes ? `<p>📝 ${b.notes}</p>` : ''}
    <div class="detail-actions">
      <button class="detail-edit" onclick="openEditModal(${id})">Edit</button>
      <button class="detail-delete" onclick="deleteBooking(${id})">Delete</button>
    </div>`;
      const rect = e.target.getBoundingClientRect();
      popup.style.left = Math.min(rect.right + 8, window.innerWidth - 290) + 'px';
      popup.style.top = Math.max(rect.top - 20, 8) + 'px';
      popup.classList.add('visible');
    }

    function closeDetail() {
      document.getElementById('detailPopup').classList.remove('visible');
    }

    async function deleteBooking(id) {
      if (!confirm('Delete this booking?')) return;
      await apiDelete('/bookings/' + id);
      bookings = bookings.filter((b) => b.id !== id);
      closeDetail();
      render();
    }

    document.addEventListener('click', (e) => {
      const popup = document.getElementById('detailPopup');
      if (!popup.contains(e.target)) closeDetail();
    });

    // Add event listener for recurrence select
    document.getElementById('fRecurrence').addEventListener('change', (e) => {
      const endDateGroup = document.getElementById('recurrenceEndGroup');
      if (e.target.value !== 'none') {
        endDateGroup.style.display = 'block';
      } else {
        endDateGroup.style.display = 'none';
      }
    });

    // ── Init ──────────────────────────────────────────────────────────────────────
    (async function() {
      const data = await apiGet('/bookings');
      bookings = data.map(mapBooking);
      render();
    })();