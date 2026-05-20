// ── Data ────────────────────────────────────────────────────────────────────
    // Loaded from GET /rooms on init
    let ROOMS = [];

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let bookings = [];
    let nextId = 1;

    // ── State ────────────────────────────────────────────────────────────────────
    let currentView = 'week';
    let currentDate = new Date(today);
    let miniDate = new Date(today);
    let visibleRooms = new Set();
    let editingId = null;
    let _editingSeries = false;

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
    function generateRecurringDates(startDate, recurrenceType, untilDate) {
      const dates = [];
      const current = new Date(startDate + 'T00:00:00');
      const until   = new Date(untilDate  + 'T00:00:00');
      while (current <= until) {
        dates.push(fmtDate(current));
        if      (recurrenceType === 'daily')     current.setDate(current.getDate() + 1);
        else if (recurrenceType === 'weekly')    current.setDate(current.getDate() + 7);
        else if (recurrenceType === 'biweekly')  current.setDate(current.getDate() + 14);
        else if (recurrenceType === 'monthly')   current.setMonth(current.getMonth() + 1);
        else break;
        if (dates.length > 730) break;
      }
      return dates;
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
      let hour = 9;
      if (cell && cell.dataset.hour !== undefined) {
        hour = Number(cell.dataset.hour);
      }
      const start = String(hour).padStart(2, '0') + ':00';
      const end = String(Math.min(hour + 1, 23)).padStart(2, '0') + ':00';
      openModal({ date: ds, start, end });
    }

    // ── Modal ─────────────────────────────────────────────────────────────────────
    function openModal(prefill = {}) {
      editingId = null;
      _editingSeries = false;
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

    function _doOpenEditModal(id, editSeries) {
      const b = bookings.find((x) => x.id === id);
      if (!b) return;
      editingId = id;
      _editingSeries = editSeries;
      document.getElementById('modalTitle').textContent = editSeries ? 'Edit Booking Series' : 'Edit Reservation';
      document.getElementById('fTitle').value = b.title;
      document.getElementById('fRoom').value = b.room;
      document.getElementById('fDate').value = b.date;
      document.getElementById('fStart').value = b.start;
      document.getElementById('fEnd').value = b.end;
      document.getElementById('fBy').value = b.by || '';
      document.getElementById('fNotes').value = b.notes || '';
      document.getElementById('fRecurrence').value = 'none';
      document.getElementById('fRecurrenceEnd').value = '';
      document.getElementById('recurrenceEndGroup').style.display = 'none';
      closeDetail();
      document.getElementById('bookingModal').showModal();
    }

    function openEditModal(id) {
      const b = bookings.find((x) => x.id === id);
      if (!b) return;
      if (b.recurrenceId) {
        showRecurringChoice(
          'Edit Recurring Booking',
          'This booking is part of a recurring series. What would you like to edit?',
          () => _doOpenEditModal(id, false),
          () => _doOpenEditModal(id, true)
        );
      } else {
        _doOpenEditModal(id, false);
      }
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

      // Build list of dates to book using generateRecurringDates (same as calendar page)
      let datesToBook;
      if (recurrence !== 'none') {
        if (!recurrenceEnd) {
          alert('Please set a "Repeat Until" date for recurring bookings.');
          return;
        }
        if (recurrenceEnd < date) {
          alert('"Repeat Until" date must be on or after the booking date.');
          return;
        }
        datesToBook = generateRecurringDates(date, recurrence, recurrenceEnd);
      } else {
        datesToBook = [date];
      }

      // Conflict check (skip series entries when editing series)
      for (const checkDate of datesToBook) {
        const hasConflict = bookings.some((b) => {
          if (editingId && (_editingSeries ? b.recurrenceId === bookings.find(x => x.id === editingId)?.recurrenceId : b.id === editingId)) return false;
          if (b.room !== room || b.date !== checkDate) return false;
          return start < b.end && end > b.start;
        });
        if (hasConflict) {
          alert(`This room already has a booking during that time on ${checkDate}. Please choose another room or time.`);
          return;
        }
      }

      try {
        if (editingId) {
          if (_editingSeries) {
            const eb = bookings.find((x) => x.id === editingId);
            const seriesBookings = eb && eb.recurrenceId
              ? bookings.filter((x) => x.recurrenceId === eb.recurrenceId)
              : [eb];
            await Promise.all(seriesBookings.map((sb) =>
              apiPut('/room-bookings/' + sb.id, {
                title, room_id: room, start_time: start + ':00', end_time: end + ':00', booked_by_name: by, notes,
              })
            ));
          } else {
            await apiPut('/room-bookings/' + editingId, {
              title, room_id: room, booking_date: date,
              start_time: start + ':00', end_time: end + ':00', booked_by_name: by, notes,
            });
          }
        } else {
          const recurrenceId = recurrence !== 'none' ? ('recur-room-' + Date.now()) : null;
          await Promise.all(datesToBook.map((d) =>
            apiPost('/room-bookings', {
              title,
              room_id: room,
              booking_date: d,
              start_time: start + ':00',
              end_time: end + ':00',
              booked_by_name: by,
              notes,
              ...(recurrenceId ? { recurrence_id: recurrenceId } : {}),
            })
          ));
        }
      } catch (error) {
        alert(error.message && error.message.includes('400')
          ? 'This room already has a booking during that time. Please choose another room or time.'
          : 'Could not save the booking. Please try again.');
        return;
      }

      try {
        const refreshed = await apiGet('/room-bookings');
        bookings = refreshed.map(mapBooking);
        closeModal();
        render();
      } catch (error) {
        console.warn('Failed to refresh room bookings:', error);
        closeModal();
        setRoomLoadStatus('error', 'Booking saved, but refresh failed', 'Please retry loading bookings to see the latest calendar.');
      }
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
    ${b.recurrenceId ? `<p style="font-size:0.78rem;color:#7c3aed;">🔁 Recurring series</p>` : ''}
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

    function showRecurringChoice(title, msg, onThis, onAll) {
      const dlg = document.getElementById('recurChoiceModal');
      document.getElementById('recurChoiceTitle').textContent = title;
      document.getElementById('recurChoiceMsg').textContent = msg;
      document.getElementById('recurChoiceThis').onclick = () => { dlg.close(); onThis(); };
      document.getElementById('recurChoiceAll').onclick = () => { dlg.close(); onAll(); };
      document.getElementById('recurChoiceCancel').onclick = () => dlg.close();
      dlg.showModal();
    }

    async function deleteBooking(id) {
      const b = bookings.find((x) => x.id === id);
      if (!b) return;
      if (b.recurrenceId) {
        showRecurringChoice(
          'Delete Recurring Booking',
          'This booking is part of a recurring series. What would you like to delete?',
          async () => {
            await apiDelete('/room-bookings/' + id);
            bookings = bookings.filter((x) => x.id !== id);
            closeDetail();
            render();
          },
          async () => {
            const rid = b.recurrenceId;
            const seriesIds = bookings.filter((x) => x.recurrenceId === rid).map((x) => x.id);
            await Promise.all(seriesIds.map((sid) => apiDelete('/room-bookings/' + sid).catch(() => {})));
            bookings = bookings.filter((x) => x.recurrenceId !== rid);
            closeDetail();
            render();
          }
        );
      } else {
        if (!confirm('Delete this booking?')) return;
        await apiDelete('/room-bookings/' + id);
        bookings = bookings.filter((x) => x.id !== id);
        closeDetail();
        render();
      }
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
      const [roomsData, bookingsData] = await Promise.all([apiGet('/rooms'), apiGet('/room-bookings')]);
      ROOMS = roomsData.map(function(r) {
        return { id: r.room_id, label: r.label || r.name || r.room_id, cls: 'room-' + r.room_id, dot: r.dot_color || r.color || '#93c5fd' };
      });
      visibleRooms = new Set(ROOMS.map(function(r) { return r.id; }));
      bookings = bookingsData.map(mapBooking);
      render();
    })();
