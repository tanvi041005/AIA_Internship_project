// calendar.js — all calendar-related state, storage, rendering, and wiring.
// Dependencies: api.js (apiGet, apiPost, apiPut, apiDelete) must load first.
// Shares the global `leadData` var from dashboard.js (loaded after this file).

// --- Page detection ---

function isCalendarPage() {
  return document.getElementById("calendar-grid") !== null;
}

// --- SG Public Holidays ---

// Offline fallback for 2026 in case the API is unreachable
const _sgHolidays2026Fallback = [
  { date: "2026-01-01", title: "New Year's Day" },
  { date: "2026-01-29", title: "Chinese New Year" },
  { date: "2026-01-30", title: "Chinese New Year" },
  { date: "2026-03-31", title: "Hari Raya Puasa" },
  { date: "2026-04-03", title: "Good Friday" },
  { date: "2026-05-01", title: "Labour Day" },
  { date: "2026-05-12", title: "Vesak Day" },
  { date: "2026-06-07", title: "Hari Raya Haji" },
  { date: "2026-08-09", title: "National Day" },
  { date: "2026-10-27", title: "Deepavali" },
  { date: "2026-12-25", title: "Christmas Day" }
];

const SG_HOLIDAYS_LS_KEY = "sgHolidaysByYear";
const SG_HOLIDAYS_TTL_MS = 30 * 24 * 60 * 60 * 1000; // re-fetch after 30 days
const _sgHolidaysMem = {};
const _sgFetchingYears = new Set();

function _getSGHolidaysCached(year) {
  if (_sgHolidaysMem[year]) return _sgHolidaysMem[year];
  try {
    const stored = JSON.parse(localStorage.getItem(SG_HOLIDAYS_LS_KEY) || "{}");
    const entry = stored[year];
    if (entry && Array.isArray(entry.data)) {
      const age = Date.now() - (entry.fetchedAt || 0);
      if (age < SG_HOLIDAYS_TTL_MS) {
        _sgHolidaysMem[year] = entry.data;
        return entry.data;
      }
      // Cache is stale — evict so ensureSGHolidaysLoaded re-fetches
      delete stored[year];
      localStorage.setItem(SG_HOLIDAYS_LS_KEY, JSON.stringify(stored));
    }
  } catch (e) {}
  return null;
}

function _storeSGHolidays(year, holidays) {
  _sgHolidaysMem[year] = holidays;
  try {
    const stored = JSON.parse(localStorage.getItem(SG_HOLIDAYS_LS_KEY) || "{}");
    stored[year] = { data: holidays, fetchedAt: Date.now() };
    localStorage.setItem(SG_HOLIDAYS_LS_KEY, JSON.stringify(stored));
  } catch (e) {}
}

async function ensureSGHolidaysLoaded(year, onLoaded) {
  if (_getSGHolidaysCached(year) || _sgFetchingYears.has(year)) return;
  _sgFetchingYears.add(year);
  try {
    const res = await fetch(`https://date.nager.at/api/v3/PublicHolidays/${year}/SG`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    if (!Array.isArray(data) || data.length === 0) throw new Error("No data returned");
    _storeSGHolidays(year, data.map((h) => ({ date: h.date, title: h.localName || h.name })));
  } catch (e) {
    console.warn(`Could not fetch SG holidays for ${year}, using fallback:`, e);
    // Only cache the fallback temporarily (1 day) so it retries sooner
    _sgHolidaysMem[year] = year === 2026 ? _sgHolidays2026Fallback : [];
    try {
      const stored = JSON.parse(localStorage.getItem(SG_HOLIDAYS_LS_KEY) || "{}");
      stored[year] = { data: _sgHolidaysMem[year], fetchedAt: Date.now() - SG_HOLIDAYS_TTL_MS + 24 * 60 * 60 * 1000 };
      localStorage.setItem(SG_HOLIDAYS_LS_KEY, JSON.stringify(stored));
    } catch (_) {}
  } finally {
    _sgFetchingYears.delete(year);
    if (onLoaded) onLoaded();
  }
}

// --- Storage key constants ---

const AGENCY_EVENTS_STORAGE_KEY = "agencyEvents";
const PERSONAL_EVENTS_STORAGE_KEY = "personalEvents";
const PERSONAL_TASKS_STORAGE_KEY = "personalTasks";
const ATTENDANCE_EVENTS_STORAGE_KEY = "attendanceEvents";

// --- Event mapping from DB rows ---

function mapCalendarEvent(r) {
  const toDate = (v) => { const s = v instanceof Date ? v.toISOString() : String(v || ''); return s.slice(0, 10); };
  return {
    id: r.event_id,
    title: r.title,
    date: toDate(r.event_date),
    startTime: r.start_time ? String(r.start_time).slice(0, 5) : '',
    endTime: r.end_time ? String(r.end_time).slice(0, 5) : '',
    location: r.location || '',
    notes: r.notes || '',
    type: r.event_type || 'Appointment',
    category: r.category,
    recurrenceId: r.recurrence_id || '',
    taskId: r.linked_task_id || '',
    editable: r.is_editable !== false,
  };
}

async function loadCalendarEventsFromApi() {
  if (typeof apiGet !== 'function') return;
  const userId = sessionStorage.getItem("dashboardUser");
  if (!userId) return;
  try {
    const rows = await apiGet('/events?userId=' + encodeURIComponent(userId));
    if (!Array.isArray(rows)) return;
    const personal = [], agency = [];
    for (const r of rows) {
      const ev = mapCalendarEvent(r);
      if (ev.category === 'agency') agency.push(ev);
      else if (ev.category === 'personal') personal.push(ev);
    }
    localStorage.setItem(PERSONAL_EVENTS_STORAGE_KEY, JSON.stringify(personal));
    if (agency.length > 0) localStorage.setItem(AGENCY_EVENTS_STORAGE_KEY, JSON.stringify(agency));
  } catch (e) {
    console.warn('Failed to load calendar events from API:', e);
  }
}

// --- localStorage helpers ---

function getAgencyEvents() {
  try {
    const raw = localStorage.getItem(AGENCY_EVENTS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) return parsed;
  } catch (error) {
    // fall through
  }
  return [];
}

function saveAgencyEvents(events) {
  localStorage.setItem(AGENCY_EVENTS_STORAGE_KEY, JSON.stringify(events));
}

function getPersonalEvents() {
  try {
    const raw = localStorage.getItem(PERSONAL_EVENTS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed;
  } catch (error) {
    // Fall back to empty list if storage is invalid.
  }
  return [];
}

function savePersonalEvents(events) {
  localStorage.setItem(PERSONAL_EVENTS_STORAGE_KEY, JSON.stringify(events));
}

function getPersonalTasks() {
  try {
    const raw = localStorage.getItem(PERSONAL_TASKS_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    if (Array.isArray(parsed)) return parsed;
  } catch (error) {
    // Fall back to empty list if storage is invalid.
  }
  return [];
}

function savePersonalTasks(tasks) {
  localStorage.setItem(PERSONAL_TASKS_STORAGE_KEY, JSON.stringify(tasks));
  window.dispatchEvent(new CustomEvent("personalTasksUpdated"));
}

function getAttendanceEvents() {
  try {
    const raw = localStorage.getItem(ATTENDANCE_EVENTS_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    if (Array.isArray(parsed)) return parsed;
  } catch (error) {
    // Fall back to an empty list if storage is invalid.
  }
  return [];
}

function saveAttendanceEvent(eventItem) {
  if (!eventItem || !eventItem.id) return null;
  const stored = getAttendanceEvents();
  const existing = stored.find((item) => item.id === eventItem.id);
  const normalized = {
    id: eventItem.id,
    title: eventItem.title || "Calendar Event",
    date: eventItem.date || "",
    startTime: eventItem.startTime || "",
    endTime: eventItem.endTime || "",
    location: eventItem.location || "",
    type: eventItem.type || "Calendar Event",
    category: eventItem.category || "personal",
    attendanceToken: eventItem.attendanceToken || (existing && existing.attendanceToken) || `qr-${Date.now()}-${Math.floor(Math.random() * 100000)}`,
    createdBy: sessionStorage.getItem("dashboardUser") || "Host"
  };
  const next = stored.some((item) => item.id === normalized.id)
    ? stored.map((item) => (item.id === normalized.id ? { ...item, ...normalized } : item))
    : [normalized, ...stored];
  localStorage.setItem(ATTENDANCE_EVENTS_STORAGE_KEY, JSON.stringify(next));
  return normalized;
}

// --- Event CRUD (localStorage + fire-and-forget API) ---

function addPersonalTask(payload) {
  const title = String(payload.title || "").trim();
  if (!title) return null;
  const task = {
    id: `task-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    title,
    done: false,
    source: payload.source || "manual",
    dueDate: payload.dueDate || "",
    eventTitle: payload.eventTitle || ""
  };
  const tasks = getPersonalTasks();
  tasks.unshift(task);
  savePersonalTasks(tasks);
  const userId = sessionStorage.getItem("dashboardUser");
  if (typeof apiPost === 'function' && userId) {
    apiPost('/tasks', {
      task_id: task.id,
      user_id: userId,
      title: task.title,
      due_date: task.dueDate || null,
      source: task.source || 'manual',
      event_title: task.eventTitle || null,
    }).catch(function() {});
  }
  return task;
}

function addPersonalEvent(payload) {
  const { date, title, startTime = "", endTime = "", location = "", notes = "", taskTitle = "", taskId = "", type = "Appointment", recurrenceId = "" } = payload;
  const events = getPersonalEvents();
  const eventItem = {
    id: `personal-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    date,
    title,
    startTime,
    endTime,
    location,
    notes,
    taskTitle,
    taskId,
    type,
    category: "personal",
    ...(recurrenceId ? { recurrenceId } : {})
  };
  events.push(eventItem);
  savePersonalEvents(events);
  const _userId = sessionStorage.getItem("dashboardUser");
  if (typeof apiPost === 'function' && _userId) {
    apiPost('/events', {
      event_id: eventItem.id,
      title: eventItem.title,
      event_date: eventItem.date,
      start_time: eventItem.startTime || null,
      end_time: eventItem.endTime || null,
      location: eventItem.location || null,
      event_type: eventItem.type || null,
      category: 'personal',
      notes: eventItem.notes || null,
      recurrence_id: eventItem.recurrenceId || null,
      user_id: _userId,
    }).catch(function() {});
  }
  try {
    window.dispatchEvent(new CustomEvent("calendarEventAdded", { detail: { type: "personal", event: eventItem } }));
  } catch (e) {
    // ignore in older browsers
  }
  return eventItem;
}

function addAgencyEvent(payload) {
  const { date, title, type = "Event", startTime = "", endTime = "", location = "", notes = "" } = payload;
  const events = getAgencyEvents();
  const eventItem = {
    id: `agency-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    date,
    title,
    type,
    ...(startTime ? { startTime } : {}),
    ...(endTime ? { endTime } : {}),
    ...(location ? { location } : {}),
    ...(notes ? { notes } : {})
  };
  events.push(eventItem);
  saveAgencyEvents(events);
  const _agencyUserId = sessionStorage.getItem("dashboardUser");
  if (typeof apiPost === 'function' && _agencyUserId) {
    apiPost('/events', {
      event_id: eventItem.id,
      title: eventItem.title,
      event_date: eventItem.date,
      start_time: eventItem.startTime || null,
      end_time: eventItem.endTime || null,
      location: eventItem.location || null,
      event_type: eventItem.type || null,
      category: 'agency',
      notes: eventItem.notes || null,
      user_id: _agencyUserId,
    }).catch(function() {});
  }
  try {
    window.dispatchEvent(new CustomEvent("calendarEventAdded", { detail: { type: "agency", event: eventItem } }));
  } catch (e) {}
  return eventItem;
}

function updatePersonalEvent(id, payload) {
  const events = getPersonalEvents().map((e) => (e.id === id ? { ...e, ...payload } : e));
  savePersonalEvents(events);
  if (typeof apiPut === 'function') {
    apiPut('/events/' + id, {
      title: payload.title,
      event_date: payload.date,
      start_time: payload.startTime ?? null,
      end_time: payload.endTime ?? null,
      location: payload.location ?? null,
      event_type: payload.type || null,
      notes: payload.notes ?? null,
    }).catch(function() {});
  }
}

function deletePersonalEvent(id) {
  savePersonalEvents(getPersonalEvents().filter((e) => e.id !== id));
  if (typeof apiDelete === 'function') {
    apiDelete('/events/' + id).catch(function() {});
  }
}

function deletePersonalEventSeries(recurrenceId) {
  savePersonalEvents(getPersonalEvents().filter((e) => e.recurrenceId !== recurrenceId));
  if (typeof apiDelete === 'function') {
    apiDelete('/events?recurrenceId=' + encodeURIComponent(recurrenceId)).catch(function() {});
  }
}

function generateRecurringDates(startDate, recurrenceType, untilDate) {
  const dates = [];
  const current = new Date(startDate + "T00:00:00");
  const until = new Date(untilDate + "T00:00:00");
  while (current <= until) {
    dates.push(current.toISOString().slice(0, 10));
    if (recurrenceType === "daily") current.setDate(current.getDate() + 1);
    else if (recurrenceType === "weekly") current.setDate(current.getDate() + 7);
    else if (recurrenceType === "monthly") current.setMonth(current.getMonth() + 1);
    else break;
    if (dates.length > 366) break;
  }
  return dates;
}

// --- Calendar utilities ---

function formatTimeRange(event) {
  const start = event.startTime || "";
  const end = event.endTime || "";
  if (start && end) return `${start} - ${end}`;
  if (start) return `Starts ${start}`;
  if (end) return `Ends ${end}`;
  return "Time not set";
}

function getPublicHolidayEvents(year) {
  const holidays = _getSGHolidaysCached(year) || (year === 2026 ? _sgHolidays2026Fallback : []);
  return holidays.map((h) => ({
    id: `holiday-${h.date}`,
    date: h.date,
    title: `🇸🇬 ${h.title}`,
    type: "Public Holiday",
    category: "holiday",
    editable: false
  }));
}

// References global `leadData` var declared in dashboard.js.
function getLeadEvents(role = "agent", options = { showPersonal: true, showAgency: false }) {
  const personalLeads = leadData
    .filter((lead) => (role === "admin" ? lead.owner === "district" : lead.owner === "agent"))
    .map((lead) => ({
      id: `lead-${lead.id}`,
      leadId: lead.id,
      date: lead.meetupDate,
      title: `${lead.name} · ${lead.meetingType} Meet-up`,
      location: lead.meetupLocation,
      type: "Personal Appointment",
      category: "personal",
      editable: false
    }));
  const personalCustomEvents = getPersonalEvents().map((event) => ({
    ...event,
    type: event.type || "Personal Event",
    category: "personal",
    editable: true
  }));

  const agencyMeetups = getAgencyEvents().map((event) => ({
    ...event,
    type: event.type || "Agency Event",
    category: "agency",
    editable: options.canManageAgency === true
  }));

  const holidayEvents = getPublicHolidayEvents(options.year || new Date().getFullYear());

  const events = [];
  if (options.showPersonal) events.push(...personalLeads, ...personalCustomEvents);
  if (options.showAgency) events.push(...agencyMeetups);
  if (options.showHolidays !== false) events.push(...holidayEvents);
  return events;
}

function getCalendarEventsForView(role, viewOptions) {
  return getLeadEvents(role, viewOptions);
}

function getUpcomingCalendarReminders(role = "agent", days = 7) {
  const today = new Date();
  const end = new Date();
  end.setDate(today.getDate() + days);
  const events = getCalendarEventsForView(role, { showPersonal: true, showAgency: true });
  return events.filter((ev) => {
    if (!ev || !ev.date) return false;
    const d = new Date(ev.date + "T00:00:00");
    return d >= new Date(today.toISOString().slice(0, 10) + "T00:00:00") && d <= end;
  }).sort((a, b) => a.date.localeCompare(b.date));
}

function requestNotificationPermission() {
  if (!("Notification" in window)) return Promise.resolve("unsupported");
  return Notification.requestPermission();
}

function notifyUpcomingEvents(events) {
  if (!Array.isArray(events) || events.length === 0) return;
  if (!("Notification" in window)) return;
  const allowed = localStorage.getItem("todoNotifyEnabled") === "true";
  if (!allowed) return;
  if (Notification.permission === "default") {
    requestNotificationPermission().then((perm) => {
      if (perm === "granted") {
        events.forEach((ev) => {
          try {
            new Notification(ev.title, { body: `${ev.date} · ${ev.type || "Event"}` });
          } catch (e) {}
        });
      }
    });
    return;
  }
  if (Notification.permission === "granted") {
    events.forEach((ev) => {
      try {
        new Notification(ev.title, { body: `${ev.date} · ${ev.type || "Event"}` });
      } catch (e) {}
    });
  }
}

// --- Calendar permissions panel ---

function renderCalendarPermissions(role) {
  const list = document.getElementById("calendar-permissions");
  if (!list) return;
  if (role === "admin") {
    list.innerHTML = `
      <li><span class="dot blue"></span><div class="activity-body"><p class="activity-desc">Can view and edit agent calendars.</p></div></li>
      <li><span class="dot red"></span><div class="activity-body"><p class="activity-desc">Can view and edit agency calendars.</p></div></li>
    `;
  } else {
    list.innerHTML = `
      <li><span class="dot blue"></span><div class="activity-body"><p class="activity-desc">Can view and edit own calendar only.</p></div></li>
      <li><span class="dot orange"></span><div class="activity-body"><p class="activity-desc">Can view agency events (read-only).</p></div></li>
    `;
  }
}

// --- Calendar rendering ---

function renderCalendar(currentDate, role, viewOptions) {
  const grid = document.getElementById("calendar-grid");
  const monthLabel = document.getElementById("calendar-month-label");
  if (!grid || !monthLabel) return;

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const today = new Date().toISOString().slice(0, 10);
  monthLabel.textContent = currentDate.toLocaleString("en-US", { month: "long", year: "numeric" });

  const events = getLeadEvents(role, { ...viewOptions, year });
  const eventMap = events.reduce((map, event) => {
    if (!map.has(event.date)) map.set(event.date, []);
    map.get(event.date).push(event);
    return map;
  }, new Map());

  const heads = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const MAX_SHOW = 2;

  let html = heads.map((day) => `<div class="cal-head">${day}</div>`).join("");
  for (let i = 0; i < firstDay; i += 1) {
    html += `<div class="cal-cell muted">·</div>`;
  }
  for (let day = 1; day <= daysInMonth; day += 1) {
    const dateString = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    const dailyEvents = eventMap.get(dateString) || [];
    const hasEvents = dailyEvents.length > 0;
    const isToday = dateString === today;
    const visibleEvs = dailyEvents.slice(0, MAX_SHOW);
    const extraCount = dailyEvents.length - MAX_SHOW;
    const eventTags = hasEvents
      ? visibleEvs
          .map((ev) => {
            const label = ev.title.length > 22 ? ev.title.slice(0, 21) + "…" : ev.title;
            return `<small class="event-tag ${ev.category}" data-event-id="${ev.id || ""}" data-event-editable="${ev.editable ? "true" : "false"}" title="${ev.title.replace(/"/g, "&quot;")}">${label}</small>`;
          })
          .join("") + (extraCount > 0 ? `<small class="event-tag more">+${extraCount} more</small>` : "")
      : "";
    html += `
      <div class="cal-cell ${hasEvents ? "has-event" : ""} ${isToday ? "is-today" : ""} cal-cell-clickable" data-date="${dateString}" role="button" tabindex="0" aria-label="Open events for ${dateString}">
        <span class="pill ${hasEvents ? "highlight" : ""}">${day}</span>
        ${eventTags}
      </div>
    `;
  }
  grid.innerHTML = html;

  const reminderList = document.getElementById("todo-reminder-list");
  if (!reminderList) return;
  const monthPrefix = `${year}-${String(month + 1).padStart(2, "0")}`;
  const monthlyEvents = events.filter((event) => event.date.startsWith(monthPrefix));
  reminderList.innerHTML = monthlyEvents
    .map(
      (event) => `
      <li>
        <span class="dot ${event.category === "personal" ? "blue" : "orange"}" aria-hidden="true"></span>
        <div class="activity-body">
          <div class="activity-row">
            <span class="activity-name">${event.title}</span>
            <span class="activity-time">${event.date}</span>
          </div>
          <p class="activity-desc">${event.type} reminder scheduled${event.category === "personal" ? ` · ${formatTimeRange(event)}` : ""}.</p>
        </div>
      </li>
    `
    )
    .join("");
}

// --- Calendar page wiring ---

let _calendarRefresh = null;

function wireCalendarPage() {
  const prevBtn = document.getElementById("prev-month-btn");
  const nextBtn = document.getElementById("next-month-btn");
  const personalCheckbox = document.getElementById("calendar-show-personal");
  const agencyCheckbox = document.getElementById("calendar-show-agency");
  const holidaysCheckbox = document.getElementById("calendar-show-holidays");
  if (!prevBtn || !nextBtn || !personalCheckbox || !agencyCheckbox) return;
  const role = localStorage.getItem("calendarRole") || "agent";
  const userRole = sessionStorage.getItem("dashboardRole") || "agent";
  const canManageAgency = userRole === "admin";
  const _now = new Date();
  const state = { viewDate: new Date(_now.getFullYear(), _now.getMonth(), 1), showPersonal: true, showAgency: false, showHolidays: true, selectedDate: null, canManageAgency };

  const update = () => {
    const viewYear = state.viewDate.getFullYear();
    if (!_getSGHolidaysCached(viewYear)) {
      ensureSGHolidaysLoaded(viewYear, () => {
        if (state.viewDate.getFullYear() === viewYear) update();
      });
    }
    renderCalendar(state.viewDate, role, state);
    wireCalendarDateClicks(state);
  };

  _calendarRefresh = update;

  const syncViewToggles = () => {
    state.showPersonal = personalCheckbox.checked;
    state.showAgency = agencyCheckbox.checked;
    state.showHolidays = holidaysCheckbox ? holidaysCheckbox.checked : true;
    if (!state.showPersonal && !state.showAgency) {
      state.showPersonal = true;
      personalCheckbox.checked = true;
    }
    update();
  };
  personalCheckbox.addEventListener("change", syncViewToggles);
  agencyCheckbox.addEventListener("change", syncViewToggles);
  if (holidaysCheckbox) holidaysCheckbox.addEventListener("change", syncViewToggles);

  prevBtn.addEventListener("click", () => {
    state.viewDate.setMonth(state.viewDate.getMonth() - 1);
    update();
  });
  nextBtn.addEventListener("click", () => {
    state.viewDate.setMonth(state.viewDate.getMonth() + 1);
    update();
  });

  const todayBtn = document.getElementById("today-btn");
  if (todayBtn) {
    todayBtn.addEventListener("click", () => {
      const now = new Date();
      state.viewDate = new Date(now.getFullYear(), now.getMonth(), 1);
      update();
    });
  }

  document.addEventListener("keydown", (e) => {
    if (document.activeElement && document.activeElement.closest(".cal-cell-clickable")) return;
    if (e.altKey && e.key === "ArrowLeft") { state.viewDate.setMonth(state.viewDate.getMonth() - 1); update(); }
    else if (e.altKey && e.key === "ArrowRight") { state.viewDate.setMonth(state.viewDate.getMonth() + 1); update(); }
  });

  wirePersonalEventDialog(state, update);
  wireCalendarEventDialog();
  wireAgencyEventManager(userRole, update);
  wireAgencyEventEditDialog(update);
  loadCalendarEventsFromApi().then(function() {
    update();
    showTodayRemindersOnce(state);
  });
}

function wireCalendarDateClicks(state) {
  document.querySelectorAll(".cal-cell-clickable[data-date]").forEach((cell) => {
    const openForCell = () => {
      state.selectedDate = cell.dataset.date;
      const role = localStorage.getItem("calendarRole") || "agent";
      const events = getCalendarEventsForView(role, state).filter((event) => event.date === state.selectedDate);
      if (events.length > 0) {
        openCalendarEventDialog(state.selectedDate, events);
        return;
      }
      openPersonalEventDialog(state.selectedDate);
    };

    cell.addEventListener("click", (e) => {
      const tag = e.target.closest(".event-tag[data-event-id]");
      if (tag && tag.dataset.eventId) {
        e.stopPropagation();
        const eventId = tag.dataset.eventId;
        const editable = tag.dataset.eventEditable === "true";
        if (editable) {
          const role = localStorage.getItem("calendarRole") || "agent";
          const all = getCalendarEventsForView(role, state);
          const ev = all.find((ev2) => ev2.id === eventId);
          if (ev) {
            if (ev.category === "agency") openAgencyEventEditDialog(ev);
            else openPersonalEventDialog(ev.date, ev);
            return;
          }
        }
      }
      openForCell();
    });
    cell.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        openForCell();
      }
    });
  });
}

function openCalendarEventDialog(date, events) {
  const dialog = document.getElementById("calendar-event-dialog");
  const title = document.getElementById("calendar-event-dialog-title");
  const list = document.getElementById("calendar-event-dialog-list");
  const addButton = document.getElementById("calendar-add-personal-from-detail");
  const qrButton = document.getElementById("calendar-show-attendance-qr");
  if (!dialog || !title || !list || !addButton) return;

  const dotColor = (cat) => (cat === "personal" ? "blue" : cat === "holiday" ? "green" : "orange");
  const attendanceEvent = events.find((event) => event.category !== "holiday") || events[0];

  title.textContent = `Scheduled Events · ${date}`;
  list.innerHTML = events
    .map((event) => {
      const canEdit = event.editable !== false && event.category !== "holiday";
      const editBtn = canEdit
        ? `<button type="button" class="ghost-btn" data-edit-id="${event.id}" data-edit-category="${event.category}" style="font-size:0.8rem;padding:0.25rem 0.5rem;">Edit</button>`
        : "";
      const deleteBtn = event.category === "personal" && canEdit
        ? `<button type="button" class="ghost-btn" data-delete-id="${event.id}" data-delete-recurrence="${event.recurrenceId || ""}" style="font-size:0.8rem;padding:0.25rem 0.5rem;color:var(--danger,#dc2626);">Delete</button>`
        : "";
      return `
        <li>
          <span class="dot ${dotColor(event.category)}" aria-hidden="true"></span>
          <div class="activity-body">
            <div class="activity-row">
              <span class="activity-name">${event.title}</span>
              <span class="activity-time">${event.type}</span>
            </div>
            <p class="activity-desc">${event.location ? `${event.location} · ` : ""}${formatTimeRange(event)}</p>
            ${event.notes ? `<p class="activity-desc" style="white-space:pre-wrap;">${event.notes}</p>` : ""}
            ${event.taskTitle ? `<p class="activity-desc"><strong>Linked task:</strong> ${event.taskTitle}</p>` : ""}
            <div style="display:flex;gap:0.5rem;margin-top:0.35rem;">${editBtn}${deleteBtn}</div>
          </div>
        </li>
      `;
    })
    .join("");

  list.querySelectorAll("button[data-edit-id]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const eventId = btn.dataset.editId;
      const category = btn.dataset.editCategory;
      const role = localStorage.getItem("calendarRole") || "agent";
      const all = getCalendarEventsForView(role, { showPersonal: true, showAgency: true, showHolidays: false, canManageAgency: true });
      const ev = all.find((e) => e.id === eventId);
      if (!ev) return;
      dialog.close();
      if (category === "agency") openAgencyEventEditDialog(ev);
      else openPersonalEventDialog(ev.date, ev);
    });
  });

  list.querySelectorAll("button[data-delete-id]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const eventId = btn.dataset.deleteId;
      const recurrenceId = btn.dataset.deleteRecurrence;
      if (recurrenceId) {
        const choice = confirm("Delete all events in this recurring series?\n\nOK = entire series · Cancel = just this one");
        if (choice) deletePersonalEventSeries(recurrenceId);
        else deletePersonalEvent(eventId);
      } else {
        if (!confirm("Delete this event?")) return;
        deletePersonalEvent(eventId);
      }
      dialog.close();
      if (_calendarRefresh) _calendarRefresh();
    });
  });

  addButton.onclick = () => {
    dialog.close();
    openPersonalEventDialog(date);
  };

  if (qrButton) {
    const canTakeAttendance = attendanceEvent && attendanceEvent.category !== "holiday";
    qrButton.hidden = !canTakeAttendance;
    qrButton.onclick = () => {
      if (!canTakeAttendance) return;
      openAttendanceQrDialog(attendanceEvent);
    };
  }
  dialog.showModal();
}

function wireCalendarEventDialog() {
  const dialog = document.getElementById("calendar-event-dialog");
  const closeBtn = document.getElementById("close-calendar-event-dialog");
  if (!dialog || !closeBtn) return;
  closeBtn.addEventListener("click", () => dialog.close());

  const qrDialog = document.getElementById("attendance-qr-dialog");
  const qrClose = document.getElementById("close-attendance-qr-dialog");
  if (qrDialog && qrClose) {
    qrClose.addEventListener("click", () => qrDialog.close());
  }
}

function openAttendanceQrDialog(eventItem) {
  const dialog = document.getElementById("attendance-qr-dialog");
  const canvas = document.getElementById("attendance-qr-canvas");
  const title = document.getElementById("attendance-qr-event");
  const link = document.getElementById("attendance-qr-link");
  if (!dialog || !canvas || !link || !eventItem) return;

  const storedEvent = saveAttendanceEvent({
    ...eventItem,
    id: eventItem.id || `event-${eventItem.date}-${String(eventItem.title || "attendance").toLowerCase().replace(/[^a-z0-9]+/g, "-")}`
  });
  if (!storedEvent) return;

  const checkInParams = new URLSearchParams({
    eventId: storedEvent.id,
    title: storedEvent.title,
    date: storedEvent.date,
    startTime: storedEvent.startTime,
    endTime: storedEvent.endTime,
    location: storedEvent.location,
    type: storedEvent.type,
    checkIn: "qr",
    token: storedEvent.attendanceToken
  });
  const checkInUrl = `attendance.html?${checkInParams.toString()}`;
  if (title) title.textContent = `${storedEvent.title} · ${storedEvent.date}`;
  link.href = checkInUrl;
  drawMockQr(canvas, `${window.location.origin}${window.location.pathname.replace(/[^/]+$/, "")}${checkInUrl}`);
  dialog.showModal();
}

function drawMockQr(canvas, value) {
  const ctx = canvas.getContext("2d");
  const size = canvas.width;
  const cells = 29;
  const cell = Math.floor(size / cells);
  const offset = Math.floor((size - cell * cells) / 2);
  let hash = 0;

  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 31 + value.charCodeAt(i)) >>> 0;
  }

  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, size, size);
  ctx.fillStyle = "#111827";

  const drawCell = (x, y) => ctx.fillRect(offset + x * cell, offset + y * cell, cell, cell);
  const drawFinder = (x, y) => {
    ctx.fillStyle = "#111827";
    ctx.fillRect(offset + x * cell, offset + y * cell, cell * 7, cell * 7);
    ctx.fillStyle = "#fff";
    ctx.fillRect(offset + (x + 1) * cell, offset + (y + 1) * cell, cell * 5, cell * 5);
    ctx.fillStyle = "#111827";
    ctx.fillRect(offset + (x + 2) * cell, offset + (y + 2) * cell, cell * 3, cell * 3);
  };

  drawFinder(1, 1);
  drawFinder(cells - 8, 1);
  drawFinder(1, cells - 8);

  for (let y = 0; y < cells; y += 1) {
    for (let x = 0; x < cells; x += 1) {
      const inFinder =
        (x >= 1 && x <= 7 && y >= 1 && y <= 7) ||
        (x >= cells - 8 && x <= cells - 2 && y >= 1 && y <= 7) ||
        (x >= 1 && x <= 7 && y >= cells - 8 && y <= cells - 2);
      if (inFinder) continue;
      const bit = ((hash + x * 17 + y * 29 + x * y * 7) % 5) < 2;
      if (bit) drawCell(x, y);
    }
  }
}

function openAgencyEventEditDialog(ev) {
  const dialog = document.getElementById("agency-event-edit-dialog");
  if (!dialog) return;
  const dateInput = dialog.querySelector("#agency-edit-dialog-date");
  const titleInput = dialog.querySelector("#agency-edit-dialog-title");
  const idInput = dialog.querySelector("#agency-edit-dialog-id");
  const startTimeInput = dialog.querySelector("#agency-edit-dialog-start-time");
  const endTimeInput = dialog.querySelector("#agency-edit-dialog-end-time");
  if (!dateInput || !titleInput || !idInput) return;
  dateInput.value = ev.date;
  titleInput.value = ev.title;
  idInput.value = ev.id;
  if (startTimeInput) startTimeInput.value = ev.startTime || "";
  if (endTimeInput) endTimeInput.value = ev.endTime || "";
  dialog.showModal();
}

function wireAgencyEventEditDialog(refreshCalendar) {
  const dialog = document.getElementById("agency-event-edit-dialog");
  if (!dialog) return;
  const form = dialog.querySelector("#agency-edit-dialog-form");
  const closeBtn = dialog.querySelector("#agency-edit-dialog-close");
  const deleteBtn = dialog.querySelector("#agency-edit-dialog-delete");
  if (!form || !closeBtn) return;

  closeBtn.addEventListener("click", () => dialog.close());

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const id = dialog.querySelector("#agency-edit-dialog-id").value;
    const date = dialog.querySelector("#agency-edit-dialog-date").value;
    const title = dialog.querySelector("#agency-edit-dialog-title").value.trim();
    const startTime = (dialog.querySelector("#agency-edit-dialog-start-time") || {}).value || "";
    const endTime = (dialog.querySelector("#agency-edit-dialog-end-time") || {}).value || "";
    if (!date || !title) return;
    saveAgencyEvents(getAgencyEvents().map((ev) => (ev.id === id ? { ...ev, date, title, startTime, endTime } : ev)));
    if (typeof apiPut === 'function') {
      apiPut('/events/' + id, { event_date: date, title, start_time: startTime || null, end_time: endTime || null }).catch(function() {});
    }
    dialog.close();
    if (refreshCalendar) refreshCalendar();
  });

  if (deleteBtn) {
    deleteBtn.addEventListener("click", () => {
      const id = dialog.querySelector("#agency-edit-dialog-id").value;
      if (!confirm("Delete this agency event?")) return;
      saveAgencyEvents(getAgencyEvents().filter((ev) => ev.id !== id));
      if (typeof apiDelete === 'function') {
        apiDelete('/events/' + id).catch(function() {});
      }
      dialog.close();
      if (refreshCalendar) refreshCalendar();
    });
  }
}

function showTodayRemindersOnce(state) {
  const today = new Date().toISOString().slice(0, 10);
  const reminderKey = `calendarReminderShown-${today}`;
  if (sessionStorage.getItem(reminderKey)) return;

  const role = localStorage.getItem("calendarRole") || "agent";
  const events = getCalendarEventsForView(role, state).filter((event) => event.date === today);
  if (events.length === 0) return;

  sessionStorage.setItem(reminderKey, "true");
  openCalendarEventDialog(today, events);
}

function openPersonalEventDialog(date, existingEvent = null) {
  const dialog = document.getElementById("personal-event-dialog");
  const heading = document.getElementById("personal-event-dialog-heading");
  const dateInput = document.getElementById("personal-event-dialog-date");
  const titleInput = document.getElementById("personal-event-dialog-title");
  const startTimeInput = document.getElementById("personal-event-dialog-start-time");
  const endTimeInput = document.getElementById("personal-event-dialog-end-time");
  const locationInput = document.getElementById("personal-event-dialog-location");
  const notesInput = document.getElementById("personal-event-dialog-notes");
  const taskInput = document.getElementById("personal-event-dialog-task");
  const typeInput = document.getElementById("personal-event-dialog-type");
  const editIdInput = document.getElementById("personal-event-dialog-edit-id");
  const submitBtn = document.getElementById("personal-event-dialog-submit-btn");
  const deleteBtn = document.getElementById("personal-event-dialog-delete-btn");
  const sourceToggle = document.getElementById("personal-event-source-toggle");
  const userRole = sessionStorage.getItem("dashboardRole") || "agent";
  if (!dialog || !dateInput || !titleInput || !date) return;

  const isEdit = !!existingEvent;
  if (heading) heading.textContent = isEdit ? "Edit Personal Event" : "Add Personal Event";
  if (submitBtn) submitBtn.textContent = isEdit ? "Save Changes" : "Save Event";
  dateInput.value = isEdit ? existingEvent.date : date;
  titleInput.value = isEdit ? existingEvent.title : "";
  if (startTimeInput) startTimeInput.value = isEdit ? (existingEvent.startTime || "") : "";
  if (endTimeInput) endTimeInput.value = isEdit ? (existingEvent.endTime || "") : "";
  if (locationInput) locationInput.value = isEdit ? (existingEvent.location || "") : "";
  if (notesInput) notesInput.value = isEdit ? (existingEvent.notes || "") : "";
  if (taskInput) taskInput.value = isEdit ? (existingEvent.taskTitle || "") : "";
  if (editIdInput) editIdInput.value = isEdit ? existingEvent.id : "";
  if (deleteBtn) {
    deleteBtn.style.display = isEdit ? "block" : "none";
    deleteBtn.dataset.recurrenceId = isEdit ? (existingEvent.recurrenceId || "") : "";
  }

  const currentType = isEdit ? (existingEvent.type || "Appointment") : "Appointment";
  if (typeInput) typeInput.value = currentType;

  if (sourceToggle) {
    const canChooseSource = userRole === "admin" && !isEdit;
    sourceToggle.style.display = canChooseSource ? "block" : "none";
    const sourceInput = document.getElementById("personal-event-dialog-source");
    if (sourceInput) sourceInput.value = "personal";
    sourceToggle.querySelectorAll(".event-type-btn[data-source]").forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.source === "personal");
    });
  }
  const typeSection = document.getElementById("personal-event-type-section");
  if (typeSection) typeSection.style.display = "";

  dialog.querySelectorAll("[data-type]").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.type === currentType);
  });

  const repeatEndWrap = document.getElementById("personal-event-repeat-end-wrap");
  const repeatSelect = document.getElementById("personal-event-dialog-repeat");
  if (repeatSelect) repeatSelect.value = "none";
  if (repeatEndWrap) repeatEndWrap.style.display = "none";

  dialog.showModal();
  titleInput.focus();
}

function wirePersonalEventDialog(state, refreshCalendar) {
  const dialog = document.getElementById("personal-event-dialog");
  const form = document.getElementById("personal-event-dialog-form");
  const closeBtn = document.getElementById("close-personal-event-dialog");
  const dateInput = document.getElementById("personal-event-dialog-date");
  const titleInput = document.getElementById("personal-event-dialog-title");
  const startTimeInput = document.getElementById("personal-event-dialog-start-time");
  const endTimeInput = document.getElementById("personal-event-dialog-end-time");
  const locationInput = document.getElementById("personal-event-dialog-location");
  const notesInput = document.getElementById("personal-event-dialog-notes");
  const taskInput = document.getElementById("personal-event-dialog-task");
  const typeInput = document.getElementById("personal-event-dialog-type");
  const editIdInput = document.getElementById("personal-event-dialog-edit-id");
  const repeatSelect = document.getElementById("personal-event-dialog-repeat");
  const repeatEndWrap = document.getElementById("personal-event-repeat-end-wrap");
  const repeatEndInput = document.getElementById("personal-event-dialog-repeat-end");
  const sourceInput = document.getElementById("personal-event-dialog-source");
  const sourceToggle = document.getElementById("personal-event-source-toggle");
  const deleteBtnWire = document.getElementById("personal-event-dialog-delete-btn");
  if (!dialog || !form || !closeBtn || !dateInput || !titleInput) return;

  if (deleteBtnWire) {
    deleteBtnWire.addEventListener("click", () => {
      const eventId = editIdInput ? editIdInput.value : "";
      if (!eventId) return;
      const recurrenceId = deleteBtnWire.dataset.recurrenceId || "";
      if (recurrenceId) {
        const choice = confirm("Delete all events in this recurring series?\n\nOK = entire series · Cancel = just this one");
        if (choice) deletePersonalEventSeries(recurrenceId);
        else deletePersonalEvent(eventId);
      } else {
        if (!confirm("Delete this event?")) return;
        deletePersonalEvent(eventId);
      }
      dialog.close();
      if (refreshCalendar) refreshCalendar();
    });
  }

  form.querySelectorAll("[data-type]").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      if (typeInput) typeInput.value = btn.dataset.type;
      form.querySelectorAll("[data-type]").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
    });
  });

  if (sourceToggle && sourceInput) {
    const headingEl = document.getElementById("personal-event-dialog-heading");
    const typeSection = document.getElementById("personal-event-type-section");

    const applySource = (source) => {
      sourceInput.value = source;
      if (headingEl) headingEl.textContent = source === "agency" ? "Add Agency Event" : "Add Personal Event";
      if (typeSection) {
        if (source === "agency") {
          typeSection.style.display = "none";
          if (typeInput) typeInput.value = "Event";
        } else {
          typeSection.style.display = "";
        }
      }
    };

    sourceToggle.querySelectorAll(".event-type-btn[data-source]").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        sourceToggle.querySelectorAll(".event-type-btn[data-source]").forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");
        applySource(btn.dataset.source);
      });
    });
  }

  if (repeatSelect && repeatEndWrap) {
    repeatSelect.addEventListener("change", () => {
      repeatEndWrap.style.display = repeatSelect.value !== "none" ? "block" : "none";
    });
  }

  closeBtn.addEventListener("click", () => dialog.close());

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const date = dateInput.value;
    const title = titleInput.value.trim();
    const startTime = startTimeInput ? startTimeInput.value : "";
    const endTime = endTimeInput ? endTimeInput.value : "";
    const location = locationInput ? locationInput.value.trim() : "";
    const notes = notesInput ? notesInput.value.trim() : "";
    const taskTitle = taskInput ? taskInput.value.trim() : "";
    const type = typeInput ? typeInput.value || "Appointment" : "Appointment";
    const editId = editIdInput ? editIdInput.value : "";
    const source = sourceInput ? sourceInput.value : "personal";
    const recurrenceType = repeatSelect ? repeatSelect.value : "none";
    const repeatUntil = repeatEndInput ? repeatEndInput.value : "";
    if (!date || !title) return;

    dialog.close();

    if (editId) {
      updatePersonalEvent(editId, { date, title, startTime, endTime, location, notes, taskTitle, type });
      if (refreshCalendar) refreshCalendar();
      return;
    }

    if (source === "agency") {
      addAgencyEvent({ date, title, type, startTime, endTime, location, notes });
      if (refreshCalendar) refreshCalendar();
      return;
    }

    const task = taskTitle ? addPersonalTask({ title: taskTitle, source: "calendar", dueDate: date, eventTitle: title }) : null;
    if (recurrenceType !== "none" && repeatUntil) {
      const recurrenceId = `recur-${Date.now()}`;
      generateRecurringDates(date, recurrenceType, repeatUntil).forEach((d) => {
        addPersonalEvent({ date: d, title, startTime, endTime, location, notes, taskTitle, taskId: task ? task.id : "", type, recurrenceId });
      });
    } else {
      addPersonalEvent({ date, title, startTime, endTime, location, notes, taskTitle, taskId: task ? task.id : "", type });
    }

    state.selectedDate = date;
    if (refreshCalendar) refreshCalendar();
  });
}

function wireAgencyEventManager(userRole, refreshCalendar) {
  const form = document.getElementById("agency-event-form");
  const typeInput = document.getElementById("agency-event-type");
  const dateInput = document.getElementById("agency-event-date");
  const titleInput = document.getElementById("agency-event-title");
  const editIdInput = document.getElementById("agency-event-edit-id");
  const submitBtn = document.getElementById("agency-event-submit-btn");
  const cancelBtn = document.getElementById("agency-event-cancel-btn");
  const list = document.getElementById("agency-events-editor-list");
  const accessNote = document.getElementById("agency-events-access-note");
  if (!form || !typeInput || !dateInput || !titleInput || !editIdInput || !submitBtn || !cancelBtn || !list || !accessNote) return;

  const canManage = userRole === "admin";

  const setEditMode = (eventItem) => {
    if (!eventItem) {
      editIdInput.value = "";
      dateInput.value = "";
      titleInput.value = "";
      typeInput.value = "Event";
      typeButtons.forEach((btn) => btn.classList.remove("active"));
      typeButtons.forEach((btn) => {
        if (btn.dataset.type === "Event") btn.classList.add("active");
      });
      submitBtn.textContent = "Add Event";
      return;
    }
    editIdInput.value = eventItem.id;
    dateInput.value = eventItem.date;
    titleInput.value = eventItem.title;
    typeInput.value = eventItem.type || "Event";
    typeButtons.forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.type === (eventItem.type || "Event"));
    });
    submitBtn.textContent = "Save Changes";
  };

  const renderEditorList = () => {
    const events = getAgencyEvents().sort((a, b) => a.date.localeCompare(b.date));
    list.innerHTML = events
      .map((eventItem) => {
        const controls = canManage
          ? `<div class="agency-event-actions"><button type="button" data-action="edit" data-id="${eventItem.id}">Edit</button></div>`
          : "";
        return `
        <li>
          <span class="dot orange" aria-hidden="true"></span>
          <div class="activity-body">
            <div class="activity-row">
              <span class="activity-name">${eventItem.title}</span>
              <span class="activity-time">${eventItem.date}</span>
            </div>
            <p class="activity-desc">${eventItem.type || 'Agency Event'}</p>
            ${controls}
          </div>
        </li>
      `;
      })
      .join("");

    if (canManage) {
      list.querySelectorAll("button[data-action='edit']").forEach((button) => {
        button.addEventListener("click", () => {
          const eventToEdit = getAgencyEvents().find((item) => item.id === button.dataset.id);
          if (eventToEdit) setEditMode(eventToEdit);
        });
      });
    }
  };

  accessNote.textContent = canManage
    ? "You have admin access and can add or edit agency-level events."
    : "Agency-level events are read-only. Only admins can add or edit.";
  form.style.display = canManage ? "grid" : "none";

  const typeButtons = form.querySelectorAll(".event-type-btn");
  typeButtons.forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      typeInput.value = btn.dataset.type;
      typeButtons.forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
    });
  });

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    if (!canManage) return;
    const date = dateInput.value;
    const title = titleInput.value.trim();
    if (!date || !title) return;

    const events = getAgencyEvents();
    const editingId = editIdInput.value;
    const typeValue = typeInput.value || "Event";
    if (editingId) {
      const updated = events.map((item) => (item.id === editingId ? { ...item, date, title, type: typeValue } : item));
      saveAgencyEvents(updated);
      const updatedEvent = updated.find((it) => it.id === editingId);
      try {
        window.dispatchEvent(new CustomEvent("calendarEventAdded", { detail: { type: "agency", event: updatedEvent } }));
      } catch (e) {}
    } else {
      const newEv = { id: `agency-${Date.now()}`, date, title, type: typeValue };
      events.push(newEv);
      saveAgencyEvents(events);
      try {
        window.dispatchEvent(new CustomEvent("calendarEventAdded", { detail: { type: "agency", event: newEv } }));
      } catch (e) {}
    }

    setEditMode(null);
    renderEditorList();
    refreshCalendar();
  });

  cancelBtn.addEventListener("click", () => setEditMode(null));

  renderEditorList();

  const uploadInput = document.getElementById("agency-events-upload");
  const importBtn = document.getElementById("agency-events-import-btn");

  const parseCsv = (text) => {
    const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    const rows = [];
    for (let i = 0; i < lines.length; i++) {
      const parts = lines[i].split(",");
      const [date, title, type = "Event", location = "", startTime = "", endTime = ""] = parts.map((p) => (p || "").trim());
      if (!date || !title) continue;
      rows.push({ date, title, type, location, startTime, endTime });
    }
    return rows;
  };

  const parseXlsx = (buffer, year = 2026) => {
    try {
      if (typeof XLSX === "undefined") throw new Error("XLSX library not loaded");
      const workbook = XLSX.read(new Uint8Array(buffer), { type: "array" });
      const sheetName = workbook.SheetNames[0];
      if (!sheetName) throw new Error("No sheet found in workbook");
      const sheet = workbook.Sheets[sheetName];
      const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 });
      const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
      const parsed = [];
      let currentMonth = null;
      rows.forEach((row) => {
        if (!Array.isArray(row) || row.length < 1) return;
        const col0 = String(row[0] || "").trim();
        const col1 = String(row[1] || "").trim();
        const monthIndex = monthNames.findIndex((m) => col0.toLowerCase().includes(m.toLowerCase()));
        if (monthIndex !== -1) {
          currentMonth = monthIndex + 1;
          return;
        }
        if (currentMonth !== null && /^\d+$/.test(col0) && col1.length > 0) {
          const day = parseInt(col0);
          if (day >= 1 && day <= 31) {
            const dateStr = `${year}-${String(currentMonth).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
            parsed.push({ date: dateStr, title: col1, type: "Event", location: "", startTime: "", endTime: "" });
          }
        }
      });
      return parsed;
    } catch (err) {
      console.error("XLSX parse error:", err);
      throw err;
    }
  };

  const doImport = (file) => {
    if (!file) return alert("No file selected.");
    const isXlsx = file.name.toLowerCase().endsWith(".xlsx") || file.type.includes("spreadsheet");
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const yearInput = document.getElementById("agency-events-year");
        const year = yearInput ? parseInt(yearInput.value) || 2026 : 2026;
        let parsed = [];
        if (isXlsx) {
          parsed = parseXlsx(e.target.result, year);
        } else {
          parsed = parseCsv(String(e.target.result || ""));
        }
        if (parsed.length === 0) return alert("No valid rows found in file.");
        const events = getAgencyEvents();
        const added = [];
        parsed.forEach((r) => {
          const ev = { id: `agency-${Date.now()}-${Math.floor(Math.random()*1000)}`, date: r.date, title: r.title, type: r.type || "Event", location: r.location || "" };
          if (r.startTime) ev.startTime = r.startTime;
          if (r.endTime) ev.endTime = r.endTime;
          events.push(ev);
          added.push(ev);
        });
        saveAgencyEvents(events);
        renderEditorList();
        refreshCalendar();
        try { window.dispatchEvent(new CustomEvent("calendarEventAdded", { detail: { type: "agency-batch", events: added } })); } catch (e) {}
        alert(`Imported ${added.length} events.`);
      } catch (err) {
        console.error(err);
        alert(`Failed to parse file: ${err.message}`);
      }
    };
    if (isXlsx) {
      reader.readAsArrayBuffer(file);
    } else {
      reader.readAsText(file);
    }
  };

  if (importBtn && uploadInput) {
    importBtn.addEventListener("click", () => {
      if (!uploadInput.files || uploadInput.files.length === 0) return alert("Please choose a file first.");
      const file = uploadInput.files[0];
      doImport(file);
    });
  }
}

// --- Calendar page init ---

if (isCalendarPage()) {
  wireCalendarPage();
}
