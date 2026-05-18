// calendar.js — all calendar-related state, storage, rendering, and wiring.
// Dependencies: api.js (apiGet, apiPost, apiPut, apiDelete, toSGDate, mapPersonalTask) must load first.
// Shares the global `leadData` var from dashboard.js (loaded before this file).

// ── SG Public Holidays ────────────────────────────────────────────────────────

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
const SG_HOLIDAYS_TTL_MS = 30 * 24 * 60 * 60 * 1000;
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

// ── Storage keys (localStorage fallback for non-calendar pages) ───────────────

const AGENCY_EVENTS_STORAGE_KEY    = "agencyEvents";
const PERSONAL_EVENTS_STORAGE_KEY  = "personalEvents";
const PERSONAL_TASKS_STORAGE_KEY   = "personalTasks";

// ── In-memory state ───────────────────────────────────────────────────────────
// Populated by loadCalendarFromApi() on the calendar page.
// Other pages fall back to localStorage (kept in sync by every save operation).

let _calendarLoaded = false;
let _personalEvents = [];
let _agencyEvents   = [];
let _personalTasks  = [];
let leadData         = [];
let _agencyEditDialogState = { editSeries: false, recurrenceId: '' };
let _hoverTimer = null;

// Leads for the appointment lead-picker dropdown. Populated lazily on first use.
let _calendarLeads = null;
let _calendarLeadsFetchPromise = null;

async function _ensureCalendarLeads() {
  if (_calendarLeads !== null) return _calendarLeads;
  // Use the globally loaded leadData if it is already populated
  if (typeof leadData !== 'undefined' && Array.isArray(leadData) && leadData.length > 0) {
    _calendarLeads = leadData;
    return _calendarLeads;
  }
  // Avoid duplicate in-flight fetches
  if (_calendarLeadsFetchPromise) return _calendarLeadsFetchPromise;
  _calendarLeadsFetchPromise = (async () => {
    try {
      const userId = sessionStorage.getItem('dashboardUser') || '';
      const rows = await apiGet('/leads' + (userId ? '?userId=' + encodeURIComponent(userId) : ''));
      _calendarLeads = (Array.isArray(rows) ? rows : []).map(r => ({
        id:    r.lead_id,
        name:  r.name  || '',
        stage: r.stage || '',
      }));
    } catch (e) {
      console.warn('Calendar: could not fetch leads for picker', e);
      _calendarLeads = [];
    }
    return _calendarLeads;
  })();
  return _calendarLeadsFetchPromise;
}

// ── Page detection ────────────────────────────────────────────────────────────

function isCalendarPage() {
  return document.getElementById("calendar-grid") !== null;
}

// ── DB row mappers ────────────────────────────────────────────────────────────

function mapCalendarEvent(r) {
  const toDate = (v) => { const s = v instanceof Date ? v.toISOString() : String(v || ''); return s.slice(0, 10); };
  return {
    id:          r.event_id,
    title:       r.title,
    date:        toDate(r.event_date),
    startTime:   r.start_time  ? String(r.start_time).slice(0, 5)  : '',
    endTime:     r.end_time    ? String(r.end_time).slice(0, 5)    : '',
    location:    r.location    || '',
    notes:       r.notes       || '',
    type:        r.event_type  || 'Appointment',
    category:    r.category,
    recurrenceId: r.recurrence_id  || '',
    taskId:      r.linked_task_id  || '',
    leadId:      r.lead_id         || '',
    leadName:    r.lead_name       || '',
    editable:    r.is_editable !== false,
  };
}

// ── API load ──────────────────────────────────────────────────────────────────

async function loadCalendarFromApi() {
  const userId = sessionStorage.getItem('dashboardUser') || '';
  const qs = userId ? '?userId=' + encodeURIComponent(userId) : '';

  let rawEvents = [], rawAgencyEvents = [], rawTasks = [], rawLeads = [];
  try {
    [rawEvents, rawAgencyEvents, rawTasks, rawLeads] = await Promise.all([
      apiGet('/events' + qs),
      apiGet('/events?category=agency'),
      apiGet('/tasks'  + qs),
      apiGet('/leads'  + qs),
    ]);
  } catch (e) {
    // Fall back to legacy endpoint
    try {
      const data = await apiGet('/events' + qs);
      rawEvents = Array.isArray(data) ? data : (data.events || []);
    } catch (_) {}
    try { rawAgencyEvents = await apiGet('/events?category=agency'); } catch (_) {}
    try { rawTasks = await apiGet('/tasks' + qs); } catch (_) {}
    try { rawLeads = await apiGet('/leads' + qs); } catch (_) {}
  }

  const personalEvents = (Array.isArray(rawEvents) ? rawEvents : []).map(mapCalendarEvent).filter(e => e.id && e.date);
  const agencyOnly     = (Array.isArray(rawAgencyEvents) ? rawAgencyEvents : []).map(mapCalendarEvent).filter(e => e.id && e.date);
  leadData = (Array.isArray(rawLeads) ? rawLeads : []).map(mapLead).map((lead) => ({
    id: lead.id,
    name: lead.name || '',
    meetupDate: lead.meetDate || '',
    meetupLocation: lead.location || '',
    meetingType: lead.meetType || '',
    owner: lead.ownerId === userId ? 'agent' : 'district'
  }));

  // Before overwriting, snapshot lead info stored in localStorage so it can be merged back
  // (the DB events table does not have lead_id/lead_name columns yet, so that info lives locally)
  let _lsLeadMap = {};
  try {
    const lsRaw = localStorage.getItem(PERSONAL_EVENTS_STORAGE_KEY);
    if (lsRaw) {
      JSON.parse(lsRaw).forEach(e => {
        if (e.id && (e.leadId || e.leadName)) _lsLeadMap[e.id] = { leadId: e.leadId || '', leadName: e.leadName || '' };
      });
    }
  } catch (_) {}

  _personalEvents = personalEvents
    .filter(e => e.category === 'personal' || e.category === 'calendar')
    .map(e => {
      const lead = _lsLeadMap[e.id];
      return lead ? { ...e, leadId: lead.leadId, leadName: lead.leadName } : e;
    });

  // Merge agency events, deduplicate by id in case admin's personal fetch already included them
  const agencyIds = new Set(agencyOnly.map(e => e.id));
  _agencyEvents   = [
    ...agencyOnly,
    ...personalEvents.filter(e => e.category === 'agency' && !agencyIds.has(e.id)),
  ];
  _personalTasks  = (Array.isArray(rawTasks) ? rawTasks : []).map(mapPersonalTask).filter(t => t.id && t.title);

  // Keep localStorage in sync so other pages can read from it
  try {
    localStorage.setItem(PERSONAL_EVENTS_STORAGE_KEY, JSON.stringify(_personalEvents));
    localStorage.setItem(PERSONAL_TASKS_STORAGE_KEY,  JSON.stringify(_personalTasks));
    if (_agencyEvents.length > 0) localStorage.setItem(AGENCY_EVENTS_STORAGE_KEY, JSON.stringify(_agencyEvents));
  } catch (_) {}

  _calendarLoaded = true;
}

// ── Getters / setters ─────────────────────────────────────────────────────────
// Getters return in-memory state when the API has loaded; otherwise fall back
// to localStorage so the floating planner sidebar works on all pages.

function getAgencyEvents() {
  if (_calendarLoaded) return _agencyEvents;
  try {
    const raw = localStorage.getItem(AGENCY_EVENTS_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) { return []; }
}

function saveAgencyEvents(events) {
  _agencyEvents = events;
  try { localStorage.setItem(AGENCY_EVENTS_STORAGE_KEY, JSON.stringify(events)); } catch (e) {}
}

function getPersonalEvents() {
  if (_calendarLoaded) return _personalEvents;
  try {
    const raw = localStorage.getItem(PERSONAL_EVENTS_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) { return []; }
}

function savePersonalEvents(events) {
  _personalEvents = events;
  try { localStorage.setItem(PERSONAL_EVENTS_STORAGE_KEY, JSON.stringify(events)); } catch (e) {}
}

function getPersonalTasks() {
  if (_calendarLoaded) return _personalTasks;
  try {
    const raw = localStorage.getItem(PERSONAL_TASKS_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) { return []; }
}

function savePersonalTasks(tasks) {
  _personalTasks = tasks;
  try { localStorage.setItem(PERSONAL_TASKS_STORAGE_KEY, JSON.stringify(tasks)); } catch (e) {}
  window.dispatchEvent(new CustomEvent("personalTasksUpdated"));
}

async function saveAttendanceEvent(eventItem) {
  if (!eventItem || !eventItem.id) return null;
  if (typeof apiPost !== "function") throw new Error("API helper unavailable");
  const normalized = {
    id:              eventItem.id,
    title:           eventItem.title           || "Calendar Event",
    date:            eventItem.date            || "",
    event_date:      eventItem.date            || "",
    startTime:       eventItem.startTime       || "",
    endTime:         eventItem.endTime         || "",
    location:        eventItem.location        || "",
    type:            eventItem.type            || "Calendar Event",
    category:        eventItem.category        || "personal",
    attendanceToken: eventItem.attendanceToken || `qr-${Date.now()}-${Math.floor(Math.random() * 100000)}`,
    createdBy:       sessionStorage.getItem("dashboardUser") || "Host"
  };
  const saved = await apiPost("/attendance-events", normalized);
  return {
    ...normalized,
    attendanceToken: saved.attendance_token || saved.attendanceToken || normalized.attendanceToken,
  };
}

// ── CRUD operations ───────────────────────────────────────────────────────────
// Add operations: optimistic (update memory + localStorage immediately), then
// fire-and-forget API so callers don't need to await.
// Update / delete: async so callers can await and show a spinner.

function addPersonalTask(payload) {
  const title = String(payload.title || '').trim();
  if (!title) return null;
  const task = {
    id:         `task-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    title,
    done:       false,
    source:     payload.source   || 'manual',
    dueDate:    payload.dueDate  || '',
    eventTitle: payload.eventTitle || '',
    priority:   payload.priority || 'normal',
  };
  _personalTasks.unshift(task);
  try { localStorage.setItem(PERSONAL_TASKS_STORAGE_KEY, JSON.stringify(_personalTasks)); } catch (e) {}
  window.dispatchEvent(new CustomEvent('personalTasksUpdated'));

  const userId = sessionStorage.getItem('dashboardUser') || null;
  if (typeof apiPost === 'function' && userId) {
    apiPost('/tasks', {
      user_id:            userId,
      title,
      due_date:           task.dueDate   || null,
      source:             task.source    || 'manual',
      linked_event_title: task.eventTitle || null,
      is_done:            false,
    }).then(result => {
      if (result && (result.task_id || result.id)) {
        task.id = result.task_id || result.id;
        // Re-save and re-render so the DOM data-task-id reflects the real DB ID
        try { localStorage.setItem(PERSONAL_TASKS_STORAGE_KEY, JSON.stringify(_personalTasks)); } catch (e) {}
        window.dispatchEvent(new CustomEvent('personalTasksUpdated'));
      }
    }).catch(() => {});
  }
  return task;
}

function addPersonalEvent(payload) {
  const { date, title, startTime = '', endTime = '', location = '', notes = '', taskTitle = '', taskId = '', type = 'Appointment', recurrenceId = '', leadId = '', leadName = '' } = payload;
  const ev = {
    id:       `personal-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    date,
    title, startTime, endTime, location, notes, taskTitle, taskId, type,
    category: 'personal',
    ...(leadId      ? { leadId }      : {}),
    ...(leadName    ? { leadName }    : {}),
    ...(recurrenceId ? { recurrenceId } : {}),
  };
  _personalEvents.push(ev);
  try { localStorage.setItem(PERSONAL_EVENTS_STORAGE_KEY, JSON.stringify(_personalEvents)); } catch (e) {}

  const userId = sessionStorage.getItem('dashboardUser') || null;
  if (typeof apiPost === 'function' && userId) {
    apiPost('/events', {
      title,
      event_date:     date,
      start_time:     startTime   || null,
      end_time:       endTime     || null,
      location:       location    || null,
      event_type:     type,
      category:       'personal',
      notes:          notes       || null,
      recurrence_id:  recurrenceId || null,
      linked_task_id: taskId      || null,
      lead_id:        leadId      || null,
      lead_name:      leadName    || null,
      created_by:     userId,
    }).then(result => {
      if (result && (result.event_id || result.id)) ev.id = result.event_id || result.id;
    }).catch(() => {});
  }
  try { window.dispatchEvent(new CustomEvent("calendarEventAdded", { detail: { type: "personal", event: ev } })); } catch (_) {}
  return ev;
}

function addAgencyEvent(payload) {
  const { date, title, type = 'Event', startTime = '', endTime = '', location = '', notes = '', recurrenceId = '' } = payload;
  const ev = {
    id:       `agency-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    date, title, type,
    ...(startTime    ? { startTime }    : {}),
    ...(endTime      ? { endTime   }    : {}),
    ...(location     ? { location  }    : {}),
    ...(notes        ? { notes     }    : {}),
    ...(recurrenceId ? { recurrenceId } : {}),
    category: 'agency',
  };
  _agencyEvents.push(ev);
  try { localStorage.setItem(AGENCY_EVENTS_STORAGE_KEY, JSON.stringify(_agencyEvents)); } catch (e) {}

  const userId = sessionStorage.getItem('dashboardUser') || null;
  if (typeof apiPost === 'function' && userId) {
    apiPost('/events', {
      title,
      event_date:    date,
      start_time:    startTime    || null,
      end_time:      endTime      || null,
      location:      location     || null,
      event_type:    type,
      category:      'agency',
      notes:         notes        || null,
      recurrence_id: recurrenceId || null,
      created_by:    userId,
    }).then(result => {
      if (result && (result.event_id || result.id)) {
        ev.id = result.event_id || result.id;
        try { localStorage.setItem(AGENCY_EVENTS_STORAGE_KEY, JSON.stringify(_agencyEvents)); } catch (e) {}
      }
    }).catch(() => {});
  }
  try { window.dispatchEvent(new CustomEvent("calendarEventAdded", { detail: { type: "agency", event: ev } })); } catch (_) {}
  return ev;
}

async function updatePersonalEvent(id, payload) {
  await apiPut('/events/' + id, {
    title:      payload.title,
    event_date: payload.date,
    start_time: payload.startTime || null,
    end_time:   payload.endTime   || null,
    location:   payload.location  || null,
    event_type: payload.type      || null,
    notes:      payload.notes     || null,
    lead_id:    payload.leadId    || null,
    lead_name:  payload.leadName  || null,
  });
  _personalEvents = _personalEvents.map(e => e.id === id ? { ...e, ...payload } : e);
  try { localStorage.setItem(PERSONAL_EVENTS_STORAGE_KEY, JSON.stringify(_personalEvents)); } catch (e) {}
}

function deleteAgencyEvent(id) {
  _agencyEvents = _agencyEvents.filter(e => e.id !== id);
  try { localStorage.setItem(AGENCY_EVENTS_STORAGE_KEY, JSON.stringify(_agencyEvents)); } catch (e) {}
  apiDelete('/events/' + id).catch(() => {});
}

function deleteAgencyEventSeries(recurrenceId) {
  const toDelete = _agencyEvents.filter(e => e.recurrenceId === recurrenceId);
  _agencyEvents = _agencyEvents.filter(e => e.recurrenceId !== recurrenceId);
  try { localStorage.setItem(AGENCY_EVENTS_STORAGE_KEY, JSON.stringify(_agencyEvents)); } catch (e) {}
  toDelete.forEach(ev => apiDelete('/events/' + ev.id).catch(() => {}));
}

function updateAgencyEventSeries(recurrenceId, payload) {
  _agencyEvents = _agencyEvents.map(e =>
    e.recurrenceId === recurrenceId ? { ...e, ...payload, date: e.date } : e
  );
  try { localStorage.setItem(AGENCY_EVENTS_STORAGE_KEY, JSON.stringify(_agencyEvents)); } catch (e) {}
  _agencyEvents
    .filter(e => e.recurrenceId === recurrenceId)
    .forEach(ev => apiPut('/events/' + ev.id, {
      title:      payload.title,
      start_time: payload.startTime || null,
      end_time:   payload.endTime   || null,
      location:   payload.location  || null,
      event_type: payload.type      || null,
      notes:      payload.notes     || null,
    }).catch(() => {}));
}

function deletePersonalEvent(id) {
  _personalEvents = _personalEvents.filter(e => e.id !== id);
  try { localStorage.setItem(PERSONAL_EVENTS_STORAGE_KEY, JSON.stringify(_personalEvents)); } catch (e) {}
  apiDelete('/events/' + id).catch(() => {});
}

function deletePersonalEventSeries(recurrenceId) {
  const toDelete = _personalEvents.filter(e => e.recurrenceId === recurrenceId);
  _personalEvents = _personalEvents.filter(e => e.recurrenceId !== recurrenceId);
  try { localStorage.setItem(PERSONAL_EVENTS_STORAGE_KEY, JSON.stringify(_personalEvents)); } catch (e) {}
  toDelete.forEach(ev => apiDelete('/events/' + ev.id).catch(() => {}));
}

function updatePersonalEventSeries(recurrenceId, payload) {
  _personalEvents = _personalEvents.map(e =>
    e.recurrenceId === recurrenceId ? { ...e, ...payload, date: e.date } : e
  );
  try { localStorage.setItem(PERSONAL_EVENTS_STORAGE_KEY, JSON.stringify(_personalEvents)); } catch (e) {}
  _personalEvents
    .filter(e => e.recurrenceId === recurrenceId)
    .forEach(ev => apiPut('/events/' + ev.id, {
      title:      payload.title,
      start_time: payload.startTime || null,
      end_time:   payload.endTime   || null,
      location:   payload.location  || null,
      event_type: payload.type      || null,
      notes:      payload.notes     || null,
    }).catch(() => {}));
}

function showCalendarToast(message) {
  const existing = document.getElementById("calendar-toast");
  if (existing) existing.remove();
  const toast = document.createElement("div");
  toast.id = "calendar-toast";
  toast.textContent = message;
  toast.style.cssText = "position:fixed;bottom:1.5rem;left:50%;transform:translateX(-50%);background:#1f2937;color:#fff;padding:0.6rem 1.25rem;border-radius:8px;font-size:0.9rem;z-index:9999;box-shadow:0 4px 12px rgba(0,0,0,0.25);transition:opacity 0.4s;";
  document.body.appendChild(toast);
  setTimeout(() => { toast.style.opacity = "0"; setTimeout(() => toast.remove(), 400); }, 2500);
}

function generateRecurringDates(startDate, recurrenceType, untilDate) {
  const dates = [];
  const current = new Date(startDate + "T00:00:00");
  const until = new Date(untilDate + "T00:00:00");
  while (current <= until) {
    dates.push(current.toISOString().slice(0, 10));
    if (recurrenceType === "daily")        current.setDate(current.getDate() + 1);
    else if (recurrenceType === "weekly")  current.setDate(current.getDate() + 7);
    else if (recurrenceType === "monthly") current.setMonth(current.getMonth() + 1);
    else break;
    if (dates.length > 366) break;
  }
  return dates;
}

// ── Calendar utilities ────────────────────────────────────────────────────────

function formatTimeRange(event) {
  const start = event.startTime || "";
  const end   = event.endTime   || "";
  if (start && end) return `${start} - ${end}`;
  if (start) return `Starts ${start}`;
  if (end)   return `Ends ${end}`;
  return "Time not set";
}

function getPublicHolidayEvents(year) {
  const holidays = _getSGHolidaysCached(year) || (year === 2026 ? _sgHolidays2026Fallback : []);
  return holidays.map((h) => ({
    id:       `holiday-${h.date}`,
    date:     h.date,
    title:    `🇸🇬 ${h.title}`,
    type:     "Public Holiday",
    category: "holiday",
    editable: false
  }));
}

function getLeadEvents(role = "agent", options = { showPersonal: true, showAgency: false }) {
  const personalLeads = leadData
    .filter((lead) => (role === "admin" ? lead.owner === "district" : lead.owner === "agent"))
    .map((lead) => ({
      id:       `lead-${lead.id}`,
      leadId:   lead.id,
      date:     lead.meetupDate,
      title:    `${lead.name} · ${lead.meetingType} Meet-up`,
      location: lead.meetupLocation,
      type:     "Personal Appointment",
      category: "personal",
      editable: false
    }));

  const personalCustomEvents = getPersonalEvents().map((event) => ({
    ...event,
    type:     event.type || "Personal Event",
    category: "personal",
    editable: true
  }));

  const agencyMeetups = getAgencyEvents().map((event) => ({
    ...event,
    type:     event.type || "Agency Event",
    category: "agency",
    editable: options.canManageAgency === true
  }));

  const holidayEvents = getPublicHolidayEvents(options.year || new Date().getFullYear());

  const events = [];
  if (options.showPersonal) events.push(...personalLeads, ...personalCustomEvents);
  if (options.showAgency)   events.push(...agencyMeetups);
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
          try { new Notification(ev.title, { body: `${ev.date} · ${ev.type || "Event"}` }); } catch (e) {}
        });
      }
    });
    return;
  }
  if (Notification.permission === "granted") {
    events.forEach((ev) => {
      try { new Notification(ev.title, { body: `${ev.date} · ${ev.type || "Event"}` }); } catch (e) {}
    });
  }
}

// ── Calendar permissions panel ────────────────────────────────────────────────

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

// ── Calendar grid rendering ───────────────────────────────────────────────────

function renderCalendar(currentDate, role, viewOptions) {
  const grid = document.getElementById("calendar-grid");
  const monthLabel = document.getElementById("calendar-month-label");
  if (!grid || !monthLabel) return;

  const year  = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const today = new Date().toISOString().slice(0, 10);
  monthLabel.textContent = currentDate.toLocaleString("en-US", { month: "long", year: "numeric" });

  const events   = getLeadEvents(role, { ...viewOptions, year });
  const eventMap = events.reduce((map, event) => {
    if (!map.has(event.date)) map.set(event.date, []);
    map.get(event.date).push(event);
    return map;
  }, new Map());

  const heads = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const firstDay    = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const MAX_SHOW = 2;

  let html = heads.map((day) => `<div class="cal-head">${day}</div>`).join("");
  for (let i = 0; i < firstDay; i++) html += `<div class="cal-cell muted">·</div>`;

  for (let day = 1; day <= daysInMonth; day++) {
    const dateString  = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    const dailyEvents = eventMap.get(dateString) || [];
    const hasEvents   = dailyEvents.length > 0;
    const isToday     = dateString === today;
    const visibleEvs  = dailyEvents.slice(0, MAX_SHOW);
    const extraCount  = dailyEvents.length - MAX_SHOW;

    const eventTags = hasEvents
      ? visibleEvs.map((ev) => {
          const label     = ev.title.length > 22 ? ev.title.slice(0, 21) + "…" : ev.title;
          const typeClass = ev.category === "agency" ? `agency-${(ev.type || "event").toLowerCase()}` : "";
          return `<small class="event-tag ${ev.category} ${typeClass}" data-event-id="${ev.id || ""}" data-event-editable="${ev.editable ? "true" : "false"}" title="${ev.title.replace(/"/g, "&quot;")}">${label}</small>`;
        }).join("") + (extraCount > 0 ? `<small class="event-tag more">+${extraCount} more</small>` : "")
      : "";

    html += `
      <div class="cal-cell ${hasEvents ? "has-event" : ""} ${isToday ? "is-today" : ""} cal-cell-clickable" data-date="${dateString}" role="button" tabindex="0" aria-label="Open events for ${dateString}">
        <span class="pill ${hasEvents ? "highlight" : ""}">${day}</span>
        ${eventTags}
      </div>
    `;
  }
  grid.innerHTML = html;

  // Planner sidebar renders #todo-reminder-list itself via renderReminders()
}

// ── Calendar page wiring ──────────────────────────────────────────────────────

let _calendarRefresh = null;

function wireCalendarPage() {
  const prevBtn           = document.getElementById("prev-month-btn");
  const nextBtn           = document.getElementById("next-month-btn");
  const personalCheckbox  = document.getElementById("calendar-show-personal");
  const agencyCheckbox    = document.getElementById("calendar-show-agency");
  const holidaysCheckbox  = document.getElementById("calendar-show-holidays");
  if (!prevBtn || !nextBtn || !personalCheckbox || !agencyCheckbox) return;

  const role            = localStorage.getItem("calendarRole") || "agent";
  const userRole        = sessionStorage.getItem("dashboardRole") || "agent";
  const canManageAgency = userRole === "admin" || userRole === "district";
  const _now  = new Date();
  const state = {
    viewDate: new Date(_now.getFullYear(), _now.getMonth(), 1),
    showPersonal: true, showAgency: true, showHolidays: true,
    selectedDate: null, canManageAgency,
  };

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
    state.showAgency   = agencyCheckbox.checked;
    state.showHolidays = holidaysCheckbox ? holidaysCheckbox.checked : true;
    if (!state.showPersonal && !state.showAgency) {
      state.showPersonal      = true;
      personalCheckbox.checked = true;
    }
    update();
  };
  personalCheckbox.addEventListener("change", syncViewToggles);
  agencyCheckbox.addEventListener("change", syncViewToggles);
  if (holidaysCheckbox) holidaysCheckbox.addEventListener("change", syncViewToggles);

  prevBtn.addEventListener("click", () => { state.viewDate.setMonth(state.viewDate.getMonth() - 1); update(); });
  nextBtn.addEventListener("click", () => { state.viewDate.setMonth(state.viewDate.getMonth() + 1); update(); });

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
    if (e.altKey && e.key === "ArrowLeft")  { state.viewDate.setMonth(state.viewDate.getMonth() - 1); update(); }
    if (e.altKey && e.key === "ArrowRight") { state.viewDate.setMonth(state.viewDate.getMonth() + 1); update(); }
  });

  wirePersonalEventDialog(state, update);
  wireCalendarEventDialog();
  wireAgencyEventManager(userRole, update);
  wireAgencyEventEditDialog(update);

  // Show loading state while API fetch is in flight
  const grid = document.getElementById("calendar-grid");
  if (grid) grid.innerHTML = '<p style="grid-column:1/-1;padding:2rem;color:var(--muted);text-align:center;">Loading events...</p>';

  // Render immediately from localStorage/fallback data; refresh again when API data arrives.
  update();

  loadCalendarFromApi()
    .then(() => {
      update();
      showTodayRemindersOnce(state);
    })
    .catch((err) => {
      console.warn("Calendar: could not load events from DB", err);
      update();
    });
}

// ── Event detail popup (inline, positioned near the clicked tag) ──────────────

function initCalendarDetailPopup() {
  if (document.getElementById("cal-detail-popup")) return;
  const popup = document.createElement("div");
  popup.id = "cal-detail-popup";
  popup.style.cssText = [
    "position:fixed;z-index:1200;background:var(--card,#fff);border:1px solid var(--border,#e5e7eb)",
    "border-radius:var(--radius,10px);padding:1rem;min-width:220px;max-width:280px",
    "box-shadow:0 4px 20px rgba(0,0,0,0.14);display:none"
  ].join(";");
  popup.innerHTML = `
    <button id="cal-detail-close" style="position:absolute;top:0.5rem;right:0.5rem;background:none;border:none;font-size:1rem;cursor:pointer;color:var(--text-muted,#6b7280);line-height:1;" aria-label="Close">×</button>
    <div id="cal-detail-content"></div>
  `;
  document.body.appendChild(popup);

  document.getElementById("cal-detail-close").addEventListener("click", closeCalendarDetailPopup);
  popup.addEventListener("mouseenter", () => clearTimeout(_hoverTimer));
  popup.addEventListener("mouseleave", () => { _hoverTimer = setTimeout(closeCalendarDetailPopup, 120); });
  document.addEventListener("click", (e) => {
    const p = document.getElementById("cal-detail-popup");
    if (p && p.style.display !== "none" && !p.contains(e.target)) closeCalendarDetailPopup();
  });
}

function closeCalendarDetailPopup() {
  clearTimeout(_hoverTimer);
  const popup = document.getElementById("cal-detail-popup");
  if (popup) popup.style.display = "none";
}

// Shows a clean modal asking "This event only / All events / Cancel"
// action: "edit" | "delete"
// onSingle(ev): called when user picks "This event only"
// onSeries(ev): called when user picks "All events in series"
function showRecurringChoiceModal(action, ev, onSingle, onSeries) {
  const existing = document.getElementById("recurring-choice-modal");
  if (existing) existing.remove();

  const isDelete = action === "delete";
  const overlay = document.createElement("div");
  overlay.id = "recurring-choice-modal";
  overlay.style.cssText = "position:fixed;inset:0;z-index:1300;background:rgba(0,0,0,0.35);display:flex;align-items:center;justify-content:center;padding:1rem;";

  overlay.innerHTML = `
    <div style="background:#fff;border-radius:12px;padding:1.5rem;max-width:320px;width:100%;box-shadow:0 16px 40px rgba(0,0,0,0.2);">
      <p style="font-weight:700;font-size:1rem;margin:0 0 0.35rem;">${isDelete ? "Delete recurring event" : "Edit recurring event"}</p>
      <p style="font-size:0.85rem;color:#6b7280;margin:0 0 1.25rem;">Which events do you want to ${isDelete ? "delete" : "edit"}?</p>
      <div style="display:flex;flex-direction:column;gap:0.5rem;">
        <button id="rcm-single" style="padding:0.6rem 1rem;border:1px solid ${isDelete ? "#fca5a5" : "var(--border,#e5e7eb)"};border-radius:8px;background:#fff;color:${isDelete ? "#dc2626" : "var(--text)"};font:inherit;font-weight:600;cursor:pointer;text-align:left;">
          This event only
        </button>
        <button id="rcm-series" style="padding:0.6rem 1rem;border:1px solid ${isDelete ? "#fca5a5" : "var(--border,#e5e7eb)"};border-radius:8px;background:${isDelete ? "#fee2e2" : "#f3f4f6"};color:${isDelete ? "#b91c1c" : "#374151"};font:inherit;font-weight:600;cursor:pointer;text-align:left;">
          All events in this series
        </button>
        <button id="rcm-cancel" style="padding:0.5rem 1rem;border:none;border-radius:8px;background:transparent;color:#6b7280;font:inherit;cursor:pointer;text-align:center;">
          Cancel
        </button>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);

  const close = () => overlay.remove();
  overlay.querySelector("#rcm-single").addEventListener("click",  () => { close(); onSingle(ev); });
  overlay.querySelector("#rcm-series").addEventListener("click",  () => { close(); onSeries(ev); });
  overlay.querySelector("#rcm-cancel").addEventListener("click",  close);
  overlay.addEventListener("click", (e) => { if (e.target === overlay) close(); });
}

function showCalendarDetailPopup(e, ev, state) {
  e.stopPropagation();
  initCalendarDetailPopup();
  const popup   = document.getElementById("cal-detail-popup");
  const content = document.getElementById("cal-detail-content");

  const typeColors = { Training: "#6d28d9", Meeting: "#0f766e", "Public Holiday": "#166534" };
  const typeColor  = typeColors[ev.type] || (ev.category === "personal" ? "#1d4ed8" : "#c2410c");
  const typeBg     = typeColors[ev.type] ? (ev.type === "Training" ? "#ede9fe" : "#ccfbf1") : (ev.category === "personal" ? "#dbeafe" : "#ffedd5");

  const canEdit       = ev.editable !== false && ev.category !== "holiday";
  const canEditAgency = ev.category === "agency" && state.canManageAgency;
  const canDelete     = (ev.category === "personal" && canEdit) || (ev.category === "agency" && canEditAgency);

  const dateFormatted = ev.date
    ? new Date(ev.date + "T00:00:00").toLocaleDateString("en-SG", { weekday: "short", day: "numeric", month: "short", year: "numeric" })
    : ev.date;

  content.innerHTML = `
    <span style="display:inline-block;padding:0.12rem 0.45rem;border-radius:999px;font-size:0.72rem;font-weight:700;margin-bottom:0.4rem;background:${typeBg};color:${typeColor};">${ev.type || "Event"}</span>
    <h4 style="margin:0 0 0.4rem;font-size:0.95rem;font-weight:700;line-height:1.3;padding-right:1.2rem;">${ev.title}</h4>
    <p style="margin:0.2rem 0;font-size:0.82rem;color:var(--text-muted,#6b7280);">📅 ${dateFormatted}</p>
    ${ev.startTime ? `<p style="margin:0.2rem 0;font-size:0.82rem;color:var(--text-muted,#6b7280);">🕐 ${ev.startTime}${ev.endTime ? " – " + ev.endTime : ""}</p>` : ""}
    ${ev.location  ? `<p style="margin:0.2rem 0;font-size:0.82rem;color:var(--text-muted,#6b7280);">📍 ${ev.location}</p>` : ""}
    ${ev.leadName  ? `<p style="margin:0.2rem 0;font-size:0.82rem;color:var(--text-muted,#6b7280);">👤 ${ev.leadName}</p>` : ""}
    ${ev.notes     ? `<p style="margin:0.2rem 0;font-size:0.82rem;color:var(--text-muted,#6b7280);">📝 ${ev.notes}</p>` : ""}
    ${ev.recurrenceId ? `<p style="margin:0.3rem 0 0;font-size:0.78rem;color:#7c3aed;">🔁 Recurring series</p>` : ""}
    ${(canEdit || canEditAgency || canDelete) ? `
    <div style="display:flex;gap:0.4rem;margin-top:0.65rem;">
      ${(canEdit || canEditAgency) ? `<button id="cal-detail-edit" style="flex:1;padding:0.35rem 0.5rem;border-radius:6px;font:inherit;font-size:0.75rem;font-weight:600;cursor:pointer;background:#fdf2f3;color:var(--brand,#a6192e);border:1px solid #f4cbd2;">Edit</button>` : ""}
      ${canDelete ? `<button id="cal-detail-delete" style="flex:1;padding:0.35rem 0.5rem;border-radius:6px;font:inherit;font-size:0.75rem;font-weight:600;cursor:pointer;background:#fff;color:#b91c1c;border:1px solid #fecaca;">Delete</button>` : ""}
    </div>` : ""}
  `;

  const editBtn   = content.querySelector("#cal-detail-edit");
  const deleteBtn = content.querySelector("#cal-detail-delete");

  if (editBtn) {
    editBtn.addEventListener("click", () => {
      closeCalendarDetailPopup();
      if (ev.category === "agency") openAgencyEventEditDialog(ev);
      else openEditEventDialog(ev);
    });
  }

  if (deleteBtn) {
    deleteBtn.addEventListener("click", () => {
      const isAgency = ev.category === "agency";
      if (ev.recurrenceId) {
        showRecurringChoiceModal(
          "delete", ev,
          (e) => {
            if (isAgency) deleteAgencyEvent(e.id); else deletePersonalEvent(e.id);
            closeCalendarDetailPopup(); if (_calendarRefresh) _calendarRefresh(); showCalendarToast("Event deleted.");
          },
          (e) => {
            if (isAgency) deleteAgencyEventSeries(e.recurrenceId); else deletePersonalEventSeries(e.recurrenceId);
            closeCalendarDetailPopup(); if (_calendarRefresh) _calendarRefresh(); showCalendarToast("Recurring series deleted.");
          }
        );
      } else {
        if (!confirm("Delete this event?")) return;
        if (isAgency) deleteAgencyEvent(ev.id); else deletePersonalEvent(ev.id);
        closeCalendarDetailPopup();
        if (_calendarRefresh) _calendarRefresh();
        showCalendarToast("Event deleted.");
      }
    });
  }

  // Position popup near the clicked tag, keeping it within viewport
  const rect = e.target.getBoundingClientRect();
  const popupW = 278;
  const left   = rect.right + 8 + popupW > window.innerWidth ? rect.left - popupW - 8 : rect.right + 8;
  popup.style.left    = Math.max(8, left) + "px";
  popup.style.top     = Math.max(8, Math.min(rect.top - 8, window.innerHeight - 300)) + "px";
  popup.style.display = "block";
}

function wireCalendarDateClicks(state) {
  document.querySelectorAll(".cal-cell-clickable[data-date]").forEach((cell) => {
    const openForCell = (clickEvt) => {
      closeCalendarDetailPopup();
      closeDayPopup();
      state.selectedDate = cell.dataset.date;
      const role   = localStorage.getItem("calendarRole") || "agent";
      const events = getCalendarEventsForView(role, state).filter((ev) => ev.date === state.selectedDate);
      if (events.length > 0) { openCalendarEventDialog(state.selectedDate, events, clickEvt, state); return; }
      openPersonalEventDialog(state.selectedDate);
    };

    cell.addEventListener("mouseover", (e) => {
      const tag = e.target.closest(".event-tag[data-event-id]");
      if (!tag || !tag.dataset.eventId) return;
      clearTimeout(_hoverTimer);
      const role = localStorage.getItem("calendarRole") || "agent";
      const ev   = getCalendarEventsForView(role, state).find((ev2) => ev2.id === tag.dataset.eventId);
      if (ev) { closeDayPopup(); showCalendarDetailPopup(e, ev, state); }
    });

    cell.addEventListener("mouseout", (e) => {
      const tag = e.target.closest(".event-tag[data-event-id]");
      if (!tag) return;
      _hoverTimer = setTimeout(closeCalendarDetailPopup, 200);
    });

    cell.addEventListener("click", (e) => {
      const tag = e.target.closest(".event-tag[data-event-id]");
      if (tag && tag.dataset.eventId) {
        e.stopPropagation();
        // Popup already shown on hover; just keep it open
        clearTimeout(_hoverTimer);
        return;
      }
      closeCalendarDetailPopup();
      openForCell(e);
    });
    cell.addEventListener("keydown", (ev) => {
      if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); openForCell(); }
    });
  });
}

// ── Day popup (non-blocking) ──────────────────────────────────────────────────

function _openDayPopup(clickEvent, date, events, state) {
  closeDayPopup();
  closeCalendarDetailPopup();

  const dotColor = (cat, type) => {
    if (cat === "personal") return "#1d4ed8";
    if (cat === "holiday")  return "#16a34a";
    if (type === "Training") return "#7c3aed";
    if (type === "Meeting")  return "#0f766e";
    return "#c2410c";
  };

  const userRole   = sessionStorage.getItem("dashboardRole") || "agent";
  const isDistrict = userRole === "district" || userRole === "admin";
  const dateLabel  = new Date(date + "T00:00:00").toLocaleDateString("en-SG", { weekday: "short", day: "numeric", month: "short", year: "numeric" });

  const popup = document.createElement("div");
  popup.id = "cal-day-popup";
  popup.style.cssText = [
    "position:fixed;z-index:1200;background:#fff",
    "border:1px solid var(--border,#e5e7eb);border-radius:12px",
    "width:300px;max-height:420px;display:flex;flex-direction:column",
    "box-shadow:0 8px 28px rgba(0,0,0,0.15);overflow:hidden"
  ].join(";");

  const canManage = state && state.canManageAgency;
  const eventsHtml = events.map((ev) => {
    const color    = dotColor(ev.category, ev.type);
    const canEdit  = ev.editable !== false && ev.category !== "holiday";
    const canDel   = (ev.category === "personal" && canEdit) || (ev.category === "agency" && canManage);
    const timeStr  = ev.startTime ? `${ev.startTime}${ev.endTime ? " – " + ev.endTime : ""}` : "All day";
    const metaParts = [timeStr, ev.location || "", ev.leadName || ""].filter(Boolean);
    return `
      <li class="day-popup-item" data-ev-id="${ev.id}">
        <span class="day-popup-dot" style="background:${color};"></span>
        <div class="day-popup-body">
          <div class="day-popup-title">${ev.title}</div>
          <div class="day-popup-meta">${metaParts.join(" · ")}</div>
        </div>
        <span class="day-popup-type" style="color:${color};">${ev.type || ""}</span>
        ${canEdit ? `<button class="day-popup-edit-btn" data-ev-id="${ev.id}" title="Edit">✎</button>` : ""}
        ${canDel  ? `<button class="day-popup-del-btn"  data-ev-id="${ev.id}" title="Delete">×</button>` : ""}
      </li>`;
  }).join("");

  popup.innerHTML = `
    <div class="day-popup-header">
      <span class="day-popup-date">${dateLabel}</span>
      <button class="day-popup-close" id="day-popup-close-btn" aria-label="Close">×</button>
    </div>
    <ul class="day-popup-list">${eventsHtml}</ul>
    <div class="day-popup-footer">
      <button class="day-popup-add-btn" id="day-popup-add-btn">${isDistrict ? "Add Event" : "Add Personal Event"}</button>
    </div>
  `;
  document.body.appendChild(popup);

  // Position near click, flip if off-screen
  const popupW = 308, popupH = Math.min(420, 120 + events.length * 64);
  const left = clickEvent.clientX + popupW + 12 > window.innerWidth
    ? clickEvent.clientX - popupW - 4
    : clickEvent.clientX + 4;
  popup.style.left = Math.max(8, left) + "px";
  popup.style.top  = Math.max(8, Math.min(clickEvent.clientY - 20, window.innerHeight - popupH - 16)) + "px";

  // Wire close
  document.getElementById("day-popup-close-btn").addEventListener("click", closeDayPopup);
  setTimeout(() => {
    document.addEventListener("click", function outsideClick(e) {
      if (!popup.contains(e.target)) { closeDayPopup(); document.removeEventListener("click", outsideClick); }
    });
  }, 0);

  // Wire Add
  document.getElementById("day-popup-add-btn").addEventListener("click", () => {
    closeDayPopup();
    openPersonalEventDialog(date);
    if (isDistrict) {
      setTimeout(() => {
        const agencyBtn = document.querySelector('#personal-event-source-toggle .event-type-btn[data-source="agency"]');
        if (agencyBtn) agencyBtn.click();
      }, 0);
    }
  });

  // Wire Edit
  popup.querySelectorAll(".day-popup-edit-btn").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const role = localStorage.getItem("calendarRole") || "agent";
      const ev   = getCalendarEventsForView(role, { showPersonal: true, showAgency: true, showHolidays: false, canManageAgency: true })
                     .find((x) => x.id === btn.dataset.evId);
      if (!ev) return;
      closeDayPopup();
      if (ev.category === "agency") openAgencyEventEditDialog(ev);
      else openEditEventDialog(ev);
    });
  });

  // Wire Delete
  popup.querySelectorAll(".day-popup-del-btn").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const role = localStorage.getItem("calendarRole") || "agent";
      const ev   = getCalendarEventsForView(role, { showPersonal: true, showAgency: true, showHolidays: false, canManageAgency: true })
                     .find((x) => x.id === btn.dataset.evId);
      if (!ev) return;
      const isAgency = ev.category === "agency";
      if (ev.recurrenceId) {
        showRecurringChoiceModal(
          "delete", ev,
          (x) => {
            if (isAgency) deleteAgencyEvent(x.id); else deletePersonalEvent(x.id);
            closeDayPopup(); if (_calendarRefresh) _calendarRefresh(); showCalendarToast("Event deleted.");
          },
          (x) => {
            if (isAgency) deleteAgencyEventSeries(x.recurrenceId); else deletePersonalEventSeries(x.recurrenceId);
            closeDayPopup(); if (_calendarRefresh) _calendarRefresh(); showCalendarToast("Recurring series deleted.");
          }
        );
      } else {
        if (!confirm("Delete this event?")) return;
        if (isAgency) deleteAgencyEvent(ev.id); else deletePersonalEvent(ev.id);
        closeDayPopup();
        if (_calendarRefresh) _calendarRefresh();
        showCalendarToast("Event deleted.");
      }
    });
  });
}

function closeDayPopup() {
  const p = document.getElementById("cal-day-popup");
  if (p) p.remove();
}

function openCalendarEventDialog(date, events, clickEvent = null, state = null) {
  // If we have a click position, use the non-blocking positioned popup
  if (clickEvent) {
    _openDayPopup(clickEvent, date, events, state);
    return;
  }
  // Fallback: legacy modal (used when called without a position, e.g. from planner)
  const dialog    = document.getElementById("calendar-event-dialog");
  const title     = document.getElementById("calendar-event-dialog-title");
  const list      = document.getElementById("calendar-event-dialog-list");
  const addButton = document.getElementById("calendar-add-personal-from-detail");
  const qrButton  = document.getElementById("calendar-show-attendance-qr");
  if (!dialog || !title || !list || !addButton) return;

  const dotColor = (cat, type) => {
    if (cat === "personal") return "blue";
    if (cat === "holiday")  return "green";
    if (type === "Training") return "purple";
    if (type === "Meeting")  return "teal";
    return "orange";
  };
  const attendanceEvent = events.find((event) => event.category !== "holiday") || events[0];

  title.textContent = `Scheduled Events · ${date}`;
  list.innerHTML = events.map((event) => {
    const canEdit   = event.editable !== false && event.category !== "holiday";
    const editBtn   = canEdit
      ? `<button type="button" class="ghost-btn" data-edit-id="${event.id}" data-edit-category="${event.category}" style="font-size:0.8rem;padding:0.25rem 0.5rem;">Edit</button>`
      : "";
    const deleteBtn = event.category === "personal" && canEdit
      ? `<button type="button" class="ghost-btn" data-delete-id="${event.id}" data-delete-recurrence="${event.recurrenceId || ""}" style="font-size:0.8rem;padding:0.25rem 0.5rem;color:var(--danger,#dc2626);">Delete</button>`
      : "";
    return `
      <li>
        <span class="dot ${dotColor(event.category, event.type)}" aria-hidden="true"></span>
        <div class="activity-body">
          <div class="activity-row">
            <span class="activity-name">${event.title}</span>
            <span class="activity-time">${event.type}</span>
          </div>
          <p class="activity-desc">${event.location ? `${event.location} · ` : ""}${formatTimeRange(event)}</p>
          ${event.notes     ? `<p class="activity-desc" style="white-space:pre-wrap;">${event.notes}</p>` : ""}
          ${event.taskTitle ? `<p class="activity-desc"><strong>Linked task:</strong> ${event.taskTitle}</p>` : ""}
          <div style="display:flex;gap:0.5rem;margin-top:0.35rem;">${editBtn}${deleteBtn}</div>
        </div>
      </li>
    `;
  }).join("");

  list.querySelectorAll("button[data-edit-id]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const role = localStorage.getItem("calendarRole") || "agent";
      const ev   = getCalendarEventsForView(role, { showPersonal: true, showAgency: true, showHolidays: false, canManageAgency: true })
                     .find((e) => e.id === btn.dataset.editId);
      if (!ev) return;
      dialog.close();
      if (btn.dataset.editCategory === "agency") openAgencyEventEditDialog(ev);
      else openEditEventDialog(ev);
    });
  });

  list.querySelectorAll("button[data-delete-id]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const eventId      = btn.dataset.deleteId;
      const recurrenceId = btn.dataset.deleteRecurrence;
      if (recurrenceId) {
        const fakeEv = { id: eventId, recurrenceId };
        showRecurringChoiceModal(
          "delete", fakeEv,
          (e) => { deletePersonalEvent(e.id);                 dialog.close(); if (_calendarRefresh) _calendarRefresh(); showCalendarToast("Event deleted."); },
          (e) => { deletePersonalEventSeries(e.recurrenceId); dialog.close(); if (_calendarRefresh) _calendarRefresh(); showCalendarToast("Recurring series deleted."); }
        );
      } else {
        if (!confirm("Delete this event?")) return;
        deletePersonalEvent(eventId);
        dialog.close();
        if (_calendarRefresh) _calendarRefresh();
        showCalendarToast("Event deleted.");
      }
    });
  });

  const userRole = sessionStorage.getItem("dashboardRole") || "agent";
  const isDistrict = userRole === "district" || userRole === "admin";
  addButton.textContent = isDistrict ? "Add Event" : "Add Personal Event";
  addButton.onclick = () => {
    dialog.close();
    openPersonalEventDialog(date);
    if (isDistrict) {
      // Pre-select "Agency" in the source toggle so district users land on the right tab
      setTimeout(() => {
        const sourceToggle = document.getElementById("personal-event-source-toggle");
        const agencyBtn = sourceToggle && sourceToggle.querySelector('.event-type-btn[data-source="agency"]');
        if (agencyBtn) agencyBtn.click();
      }, 0);
    }
  };

  if (qrButton) {
    const canTakeAttendance = attendanceEvent && attendanceEvent.category !== "holiday";
    qrButton.hidden  = !canTakeAttendance;
    qrButton.onclick = () => { if (canTakeAttendance) openAttendanceQrDialog(attendanceEvent); };
  }
  dialog.showModal();
}

function wireCalendarEventDialog() {
  const dialog   = document.getElementById("calendar-event-dialog");
  const closeBtn = document.getElementById("close-calendar-event-dialog");
  if (!dialog || !closeBtn) return;
  closeBtn.addEventListener("click", () => dialog.close());

  const qrDialog = document.getElementById("attendance-qr-dialog");
  const qrClose  = document.getElementById("close-attendance-qr-dialog");
  if (qrDialog && qrClose) qrClose.addEventListener("click", () => qrDialog.close());
}

// ── Attendance QR dialog ──────────────────────────────────────────────────────

async function openAttendanceQrDialog(eventItem) {
  const dialog = document.getElementById("attendance-qr-dialog");
  const canvas = document.getElementById("attendance-qr-canvas");
  const title  = document.getElementById("attendance-qr-event");
  const link   = document.getElementById("attendance-qr-link");
  if (!dialog || !canvas || !link || !eventItem) return;

  let storedEvent;
  try {
    storedEvent = await saveAttendanceEvent({
      ...eventItem,
      id: eventItem.id || `event-${eventItem.date}-${String(eventItem.title || "attendance").toLowerCase().replace(/[^a-z0-9]+/g, "-")}`
    });
  } catch (error) {
    alert("Could not create attendance QR in the database: " + (error.message || error));
    return;
  }
  if (!storedEvent) return;

  const checkInParams = new URLSearchParams({
    eventId: storedEvent.id,
    checkIn: "qr",
    token: storedEvent.attendanceToken
  });
  const checkInUrl = `attendance.html?${checkInParams.toString()}`;
  if (title) title.textContent = `${storedEvent.title} · ${storedEvent.date}`;
  link.href = checkInUrl;
  await drawQr(canvas, new URL(checkInUrl, window.location.href).href);
  dialog.showModal();
}

function drawQr(canvas, value) {
  if (!window.QRCode) {
    throw new Error("QR code library failed to load");
  }
  const holder = document.createElement("div");
  holder.style.position = "fixed";
  holder.style.left = "-9999px";
  holder.style.top = "-9999px";
  document.body.appendChild(holder);

  new window.QRCode(holder, {
    text: value,
    width: canvas.width,
    height: canvas.height,
    colorDark: "#111827",
    colorLight: "#ffffff",
    correctLevel: window.QRCode.CorrectLevel.M
  });

  const generatedCanvas = holder.querySelector("canvas");
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  if (generatedCanvas) {
    ctx.drawImage(generatedCanvas, 0, 0, canvas.width, canvas.height);
    holder.remove();
    return Promise.resolve();
  }

  const img = holder.querySelector("img");
  return new Promise((resolve, reject) => {
    if (!img) {
      holder.remove();
      reject(new Error("QR code image was not generated"));
      return;
    }
    img.onload = () => {
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      holder.remove();
      resolve();
    };
    img.onerror = () => {
      holder.remove();
      reject(new Error("QR code image failed to render"));
    };
  });
}

// ── Agency event edit dialog ──────────────────────────────────────────────────

function _doOpenAgencyEditDialog(ev, editSeries) {
  const dialog = document.getElementById("agency-event-edit-dialog");
  if (!dialog) return;
  const dateInput      = dialog.querySelector("#agency-edit-dialog-date");
  const titleInput     = dialog.querySelector("#agency-edit-dialog-title");
  const idInput        = dialog.querySelector("#agency-edit-dialog-id");
  const startTimeInput = dialog.querySelector("#agency-edit-dialog-start-time");
  const endTimeInput   = dialog.querySelector("#agency-edit-dialog-end-time");
  if (!dateInput || !titleInput || !idInput) return;
  _agencyEditDialogState = { editSeries: !!editSeries, recurrenceId: ev.recurrenceId || '' };
  const h3 = dialog.querySelector("h3");
  if (h3) h3.textContent = editSeries ? "Edit Agency Series" : "Edit Agency Event";
  dateInput.value    = ev.date;
  dateInput.disabled = !!editSeries;
  titleInput.value   = ev.title;
  idInput.value      = ev.id;
  if (startTimeInput) startTimeInput.value = ev.startTime || "";
  if (endTimeInput)   endTimeInput.value   = ev.endTime   || "";
  dialog.showModal();
}

function openAgencyEventEditDialog(ev) {
  if (ev.recurrenceId) {
    showRecurringChoiceModal(
      "edit", ev,
      (e) => _doOpenAgencyEditDialog(e, false),
      (e) => _doOpenAgencyEditDialog(e, true)
    );
  } else {
    _doOpenAgencyEditDialog(ev, false);
  }
}

function wireAgencyEventEditDialog(refreshCalendar) {
  const dialog    = document.getElementById("agency-event-edit-dialog");
  if (!dialog) return;
  const form      = dialog.querySelector("#agency-edit-dialog-form");
  const closeBtn  = dialog.querySelector("#agency-edit-dialog-close");
  const deleteBtn = dialog.querySelector("#agency-edit-dialog-delete");
  if (!form || !closeBtn) return;

  closeBtn.addEventListener("click", () => dialog.close());

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const id        = dialog.querySelector("#agency-edit-dialog-id").value;
    const date      = dialog.querySelector("#agency-edit-dialog-date").value;
    const title     = dialog.querySelector("#agency-edit-dialog-title").value.trim();
    const startTime = (dialog.querySelector("#agency-edit-dialog-start-time") || {}).value || "";
    const endTime   = (dialog.querySelector("#agency-edit-dialog-end-time")   || {}).value || "";
    if (!title) return;
    const { editSeries, recurrenceId } = _agencyEditDialogState;
    const saveBtn = form.querySelector("[type=submit]");
    if (saveBtn) saveBtn.disabled = true;
    try {
      if (editSeries && recurrenceId) {
        updateAgencyEventSeries(recurrenceId, { title, startTime, endTime });
        dialog.close();
        if (refreshCalendar) refreshCalendar();
        showCalendarToast("Agency series updated.");
      } else {
        await apiPut('/events/' + id, {
          title, event_date: date, start_time: startTime || null, end_time: endTime || null,
        });
        saveAgencyEvents(getAgencyEvents().map((ev) => (ev.id === id ? { ...ev, date, title, startTime, endTime } : ev)));
        dialog.close();
        if (refreshCalendar) refreshCalendar();
      }
    } catch (err) {
      console.error("Agency event update failed:", err);
    } finally {
      if (saveBtn) saveBtn.disabled = false;
    }
  });

  if (deleteBtn) {
    deleteBtn.addEventListener("click", () => {
      const id = dialog.querySelector("#agency-edit-dialog-id").value;
      const ev = getAgencyEvents().find((e) => e.id === id);
      if (!ev) return;
      if (ev.recurrenceId) {
        dialog.close();
        showRecurringChoiceModal(
          "delete", ev,
          (e) => { deleteAgencyEvent(e.id);              if (refreshCalendar) refreshCalendar(); showCalendarToast("Event deleted."); },
          (e) => { deleteAgencyEventSeries(e.recurrenceId); if (refreshCalendar) refreshCalendar(); showCalendarToast("Recurring series deleted."); }
        );
      } else {
        if (!confirm("Delete this agency event?")) return;
        deleteAgencyEvent(id);
        dialog.close();
        if (refreshCalendar) refreshCalendar();
        showCalendarToast("Event deleted successfully");
      }
    });
  }
}

// ── Today reminders ───────────────────────────────────────────────────────────

function showTodayRemindersOnce(state) {
  const today       = new Date().toISOString().slice(0, 10);
  const reminderKey = `calendarReminderShown-${today}`;
  if (sessionStorage.getItem(reminderKey)) return;

  const role   = localStorage.getItem("calendarRole") || "agent";
  const events = getCalendarEventsForView(role, state).filter((event) => event.date === today);
  if (events.length === 0) return;

  sessionStorage.setItem(reminderKey, "true");
  openCalendarEventDialog(today, events);
}

function openEditEventDialog(ev) {
  if (!ev) return;
  if (ev.recurrenceId) {
    showRecurringChoiceModal(
      "edit", ev,
      (e) => openPersonalEventDialog(e.date, e, false),
      (e) => openPersonalEventDialog(e.date, e, true)
    );
  } else {
    openPersonalEventDialog(ev.date, ev);
  }
}

// ── Personal event dialog ─────────────────────────────────────────────────────

function openPersonalEventDialog(date, existingEvent = null, editSeries = false) {
  const dialog        = document.getElementById("personal-event-dialog");
  const heading       = document.getElementById("personal-event-dialog-heading");
  const dateInput     = document.getElementById("personal-event-dialog-date");
  const titleInput    = document.getElementById("personal-event-dialog-title");
  const startTimeInput = document.getElementById("personal-event-dialog-start-time");
  const endTimeInput  = document.getElementById("personal-event-dialog-end-time");
  const locationInput = document.getElementById("personal-event-dialog-location");
  const notesInput    = document.getElementById("personal-event-dialog-notes");
  const taskInput     = document.getElementById("personal-event-dialog-task");
  const typeInput     = document.getElementById("personal-event-dialog-type");
  const editIdInput   = document.getElementById("personal-event-dialog-edit-id");
  const editSeriesInput = document.getElementById("personal-event-dialog-edit-series");
  const seriesNote    = document.getElementById("personal-event-series-note");
  const submitBtn     = document.getElementById("personal-event-dialog-submit-btn");
  const deleteBtn     = document.getElementById("personal-event-dialog-delete-btn");
  const sourceToggle  = document.getElementById("personal-event-source-toggle");
  const userRole      = sessionStorage.getItem("dashboardRole") || "agent";
  if (!dialog || !dateInput || !titleInput || !date) return;

  const isEdit    = !!existingEvent;
  const isSeries  = isEdit && editSeries && !!(existingEvent.recurrenceId);
  const isRecurring = isEdit && !!(existingEvent.recurrenceId);

  if (heading)       heading.textContent   = isSeries ? "Edit Recurring Series" : isEdit ? "Edit Personal Event" : "Add Personal Event";
  if (submitBtn)     submitBtn.textContent = isEdit ? "Save Changes" : "Save Event";
  if (editSeriesInput) editSeriesInput.value = isSeries ? "1" : "";
  if (seriesNote)    seriesNote.style.display = isSeries ? "block" : "none";

  dateInput.value    = isEdit ? existingEvent.date  : date;
  dateInput.disabled = isSeries; // Date doesn't apply when editing all occurrences
  titleInput.value   = isEdit ? existingEvent.title : "";
  if (startTimeInput) startTimeInput.value = isEdit ? (existingEvent.startTime || "") : "";
  if (endTimeInput)   endTimeInput.value   = isEdit ? (existingEvent.endTime   || "") : "";
  if (locationInput)  locationInput.value  = isEdit ? (existingEvent.location  || "") : "";
  if (notesInput)     notesInput.value     = isEdit ? (existingEvent.notes     || "") : "";
  if (taskInput)      taskInput.value      = isEdit ? (existingEvent.taskTitle || "") : "";
  if (editIdInput)    editIdInput.value    = isEdit ? existingEvent.id : "";
  if (deleteBtn) {
    deleteBtn.style.display            = isEdit && !isSeries ? "block" : "none";
    deleteBtn.dataset.recurrenceId     = isEdit ? (existingEvent.recurrenceId || "") : "";
  }

  const currentType = isEdit ? (existingEvent.type || "Appointment") : "Appointment";
  if (typeInput) typeInput.value = currentType;

  if (sourceToggle) {
    const canChooseSource = (userRole === "admin" || userRole === "district") && !isEdit;
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

  // Hide repeat fields when editing — can't change recurrence pattern retroactively
  const repeatSect    = document.getElementById("personal-event-repeat-section");
  const repeatEndWrap = document.getElementById("personal-event-repeat-end-wrap");
  const repeatSelect  = document.getElementById("personal-event-dialog-repeat");
  if (isEdit) {
    if (repeatSect)   repeatSect.style.display   = "none";
    if (repeatEndWrap) repeatEndWrap.style.display = "none";
  } else {
    if (repeatSect)   repeatSect.style.display   = "";
    if (repeatSelect) repeatSelect.value = "none";
    if (repeatEndWrap) repeatEndWrap.style.display = "none";
  }

  // Lead section: pre-fill when editing and sync visibility
  const leadSectionEl   = document.getElementById("personal-event-lead-section");
  const leadSearchEl    = document.getElementById("personal-event-lead-search");
  const leadIdEl        = document.getElementById("personal-event-lead-id");
  const leadNameEl      = document.getElementById("personal-event-lead-name");
  const leadClearEl     = document.getElementById("personal-event-lead-clear");
  if (leadSectionEl) {
    leadSectionEl.style.display = currentType === "Appointment" ? "block" : "none";
    const existingLeadName = isEdit ? (existingEvent.leadName || "") : "";
    const existingLeadId   = isEdit ? (existingEvent.leadId   || "") : "";
    if (leadSearchEl)  leadSearchEl.value  = existingLeadName;
    if (leadIdEl)      leadIdEl.value      = existingLeadId;
    if (leadNameEl)    leadNameEl.value    = existingLeadName;
    if (leadClearEl)   leadClearEl.style.display = existingLeadName ? "inline-block" : "none";
    const dd = document.getElementById("personal-event-lead-dropdown");
    if (dd) dd.style.display = "none";
  }

  const timeErrEl = document.getElementById("personal-event-time-error");
  const saveErrEl = document.getElementById("personal-event-save-error");
  if (timeErrEl) timeErrEl.style.display = "none";
  if (saveErrEl) saveErrEl.style.display = "none";

  dialog.showModal();
  titleInput.focus();
}

function wirePersonalEventDialog(state, refreshCalendar) {
  const dialog        = document.getElementById("personal-event-dialog");
  const form          = document.getElementById("personal-event-dialog-form");
  const closeBtn      = document.getElementById("close-personal-event-dialog");
  const dateInput     = document.getElementById("personal-event-dialog-date");
  const titleInput    = document.getElementById("personal-event-dialog-title");
  const startTimeInput = document.getElementById("personal-event-dialog-start-time");
  const endTimeInput  = document.getElementById("personal-event-dialog-end-time");
  const locationInput = document.getElementById("personal-event-dialog-location");
  const notesInput    = document.getElementById("personal-event-dialog-notes");
  const taskInput     = document.getElementById("personal-event-dialog-task");
  const typeInput     = document.getElementById("personal-event-dialog-type");
  const editIdInput    = document.getElementById("personal-event-dialog-edit-id");
  const editSeriesInput = document.getElementById("personal-event-dialog-edit-series");
  const repeatSelect   = document.getElementById("personal-event-dialog-repeat");
  const repeatEndWrap  = document.getElementById("personal-event-repeat-end-wrap");
  const repeatEndInput = document.getElementById("personal-event-dialog-repeat-end");
  const sourceInput    = document.getElementById("personal-event-dialog-source");
  const sourceToggle   = document.getElementById("personal-event-source-toggle");
  const deleteBtnWire = document.getElementById("personal-event-dialog-delete-btn");
  if (!dialog || !form || !closeBtn || !dateInput || !titleInput) return;

  // Delete button (edit mode)
  if (deleteBtnWire) {
    deleteBtnWire.addEventListener("click", () => {
      const eventId      = editIdInput ? editIdInput.value : "";
      if (!eventId) return;
      const recurrenceId = deleteBtnWire.dataset.recurrenceId || "";
      if (recurrenceId) {
        const fakeEv = { id: eventId, recurrenceId };
        showRecurringChoiceModal(
          "delete", fakeEv,
          (e) => { deletePersonalEvent(e.id);                 dialog.close(); if (refreshCalendar) refreshCalendar(); showCalendarToast("Event deleted."); },
          (e) => { deletePersonalEventSeries(e.recurrenceId); dialog.close(); if (refreshCalendar) refreshCalendar(); showCalendarToast("Recurring series deleted."); }
        );
      } else {
        if (!confirm("Delete this event?")) return;
        deletePersonalEvent(eventId);
        dialog.close();
        if (refreshCalendar) refreshCalendar();
        showCalendarToast("Event deleted.");
      }
    });
  }

  // Lead search dropdown
  const leadSection    = document.getElementById("personal-event-lead-section");
  const leadSearch     = document.getElementById("personal-event-lead-search");
  const leadDropdown   = document.getElementById("personal-event-lead-dropdown");
  const leadIdInput    = document.getElementById("personal-event-lead-id");
  const leadNameInput  = document.getElementById("personal-event-lead-name");
  const leadClearBtn   = document.getElementById("personal-event-lead-clear");

  function _syncLeadSectionVisibility() {
    if (!leadSection) return;
    const t = typeInput ? typeInput.value : "Appointment";
    leadSection.style.display = t === "Appointment" ? "block" : "none";
  }

  function _applyLeadList(leads, query) {
    if (!leadDropdown) return;
    const q = (query || "").toLowerCase().trim();
    const matches = q ? leads.filter(l => l.name && l.name.toLowerCase().includes(q)) : leads;
    if (!matches.length) {
      leadDropdown.innerHTML = `<li style="padding:0.5rem 0.9rem;font-size:0.85rem;color:var(--muted,#6b7280);">No leads found</li>`;
    } else {
      leadDropdown.innerHTML = matches.slice(0, 40).map(l => `
        <li data-lead-id="${l.id}" data-lead-name="${(l.name || '').replace(/"/g,'&quot;')}"
          style="padding:0.45rem 0.9rem;cursor:pointer;font-size:0.875rem;display:flex;flex-direction:column;gap:0.1rem;"
          onmouseenter="this.style.background='#f3f4f6'" onmouseleave="this.style.background=''">
          <span style="font-weight:600;">${l.name || ''}</span>
          <span style="font-size:0.78rem;color:var(--muted,#6b7280);">${l.stage || ''}</span>
        </li>`).join("");
      leadDropdown.querySelectorAll("li[data-lead-id]").forEach(li => {
        li.addEventListener("mousedown", (e) => {
          e.preventDefault();
          if (leadIdInput)   leadIdInput.value   = li.dataset.leadId;
          if (leadNameInput) leadNameInput.value  = li.dataset.leadName;
          if (leadSearch)    leadSearch.value     = li.dataset.leadName;
          if (leadClearBtn)  leadClearBtn.style.display = "inline-block";
          if (leadDropdown)  leadDropdown.style.display = "none";
        });
      });
    }
    leadDropdown.style.display = "block";
  }

  function _renderLeadOptions(query) {
    if (!leadDropdown) return;
    if (_calendarLeads && _calendarLeads.length > 0) {
      _applyLeadList(_calendarLeads, query);
      return;
    }
    leadDropdown.innerHTML = `<li style="padding:0.5rem 0.9rem;font-size:0.85rem;color:var(--muted,#6b7280);">Loading…</li>`;
    leadDropdown.style.display = "block";
    _ensureCalendarLeads().then(leads => {
      if (leadDropdown.style.display !== "none") _applyLeadList(leads, query);
    });
  }

  if (leadSearch) {
    leadSearch.addEventListener("focus", () => _renderLeadOptions(leadSearch.value));
    leadSearch.addEventListener("input", () => {
      if (leadIdInput)  leadIdInput.value  = "";
      if (leadNameInput) leadNameInput.value = "";
      if (leadClearBtn) leadClearBtn.style.display = leadSearch.value ? "inline-block" : "none";
      _renderLeadOptions(leadSearch.value);
    });
    leadSearch.addEventListener("blur", () => {
      setTimeout(() => { if (leadDropdown) leadDropdown.style.display = "none"; }, 150);
    });
  }
  if (leadClearBtn) {
    leadClearBtn.addEventListener("click", () => {
      if (leadSearch)    leadSearch.value    = "";
      if (leadIdInput)   leadIdInput.value   = "";
      if (leadNameInput) leadNameInput.value  = "";
      leadClearBtn.style.display = "none";
      if (leadDropdown)  leadDropdown.style.display = "none";
    });
  }

  // Event type toggle buttons
  form.querySelectorAll("[data-type]").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      if (typeInput) typeInput.value = btn.dataset.type;
      form.querySelectorAll("[data-type]").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      _syncLeadSectionVisibility();
    });
  });

  // Source toggle (district users: personal vs agency)
  if (sourceToggle && sourceInput) {
    const headingEl   = document.getElementById("personal-event-dialog-heading");
    const typeSection = document.getElementById("personal-event-type-section");

    const applySource = (source) => {
      sourceInput.value = source;
      if (headingEl) headingEl.textContent = source === "agency" ? "Add Agency Event" : "Add Personal Event";

      // Swap type buttons based on source
      if (typeSection) {
        const btnContainer = typeSection.querySelector("div");
        if (source === "agency") {
          btnContainer.innerHTML = `
            <button type="button" class="event-type-btn active" data-type="Event">Event</button>
            <button type="button" class="event-type-btn" data-type="Meeting">Meeting</button>
            <button type="button" class="event-type-btn" data-type="Training">Training</button>
          `;
          if (typeInput) typeInput.value = "Event";
        } else {
          btnContainer.innerHTML = `
            <button type="button" class="event-type-btn active" data-type="Appointment">Appointment</button>
            <button type="button" class="event-type-btn" data-type="Task">Task</button>
            <button type="button" class="event-type-btn" data-type="Event">Event</button>
          `;
          if (typeInput) typeInput.value = "Appointment";
        }
        typeSection.style.display = "";
        // Re-wire the freshly created buttons
        btnContainer.querySelectorAll(".event-type-btn[data-type]").forEach((b) => {
          b.addEventListener("click", (ev) => {
            ev.preventDefault();
            if (typeInput) typeInput.value = b.dataset.type;
            btnContainer.querySelectorAll(".event-type-btn[data-type]").forEach((x) => x.classList.remove("active"));
            b.classList.add("active");
            _syncLeadSectionVisibility();
          });
        });
      }

      // Hide task/lead sections for agency events
      const taskSect   = document.getElementById("personal-event-task-section");
      const isAgency   = source === "agency";
      if (taskSect)   taskSect.style.display = isAgency ? "none" : "";
      if (leadSection) leadSection.style.display = isAgency ? "none" : (typeInput && typeInput.value === "Appointment" ? "block" : "none");
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

  // Repeat select
  if (repeatSelect && repeatEndWrap) {
    repeatSelect.addEventListener("change", () => {
      repeatEndWrap.style.display = repeatSelect.value !== "none" ? "block" : "none";
    });
  }

  closeBtn.addEventListener("click", () => dialog.close());

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const date      = dateInput.value;
    const title     = titleInput.value.trim();
    const startTime = startTimeInput ? startTimeInput.value : "";
    const endTime   = endTimeInput   ? endTimeInput.value   : "";
    const location  = locationInput  ? locationInput.value.trim()  : "";
    const notes     = notesInput     ? notesInput.value.trim()     : "";
    const taskTitle = taskInput      ? taskInput.value.trim()      : "";
    const type      = typeInput      ? typeInput.value || "Appointment" : "Appointment";
    const editId    = editIdInput     ? editIdInput.value     : "";
    const isSeries  = editSeriesInput ? editSeriesInput.value === "1" : false;
    const source    = sourceInput     ? sourceInput.value     : "personal";
    const recurrenceType = repeatSelect  ? repeatSelect.value  : "none";
    const repeatUntil    = repeatEndInput ? repeatEndInput.value : "";
    const leadId    = leadIdInput   ? leadIdInput.value   : "";
    const leadName  = leadNameInput ? leadNameInput.value : "";

    const timeErr = document.getElementById("personal-event-time-error");
    const saveErr = document.getElementById("personal-event-save-error");
    if (timeErr) timeErr.style.display = "none";
    if (saveErr) saveErr.style.display = "none";

    if (!date || !title) return;

    if (!startTime || !endTime) {
      if (timeErr) timeErr.style.display = "block";
      if (startTimeInput && !startTime) startTimeInput.focus();
      else if (endTimeInput) endTimeInput.focus();
      return;
    }

    const submitBtn  = document.getElementById("personal-event-dialog-submit-btn");
    const closeBtnEl = document.getElementById("close-personal-event-dialog");
    const origLabel  = submitBtn ? submitBtn.textContent : "";
    if (submitBtn)  { submitBtn.disabled  = true; submitBtn.textContent = "Saving…"; }
    if (closeBtnEl)   closeBtnEl.disabled = true;

    try {
      if (editId && isSeries) {
        const evForSeries = _personalEvents.find(e => e.id === editId);
        const recurrenceId = evForSeries ? evForSeries.recurrenceId : "";
        if (recurrenceId) {
          updatePersonalEventSeries(recurrenceId, { title, startTime, endTime, location, notes, type });
        } else {
          await updatePersonalEvent(editId, { date, title, startTime, endTime, location, notes, type, leadId, leadName });
        }
      } else if (editId) {
        await updatePersonalEvent(editId, { date, title, startTime, endTime, location, notes, type, leadId, leadName });
      } else if (source === "agency") {
        if (recurrenceType !== "none" && repeatUntil) {
          const recurrenceId = `recur-${Date.now()}`;
          for (const d of generateRecurringDates(date, recurrenceType, repeatUntil)) {
            addAgencyEvent({ date: d, title, type, startTime, endTime, location, notes, recurrenceId });
          }
        } else {
          addAgencyEvent({ date, title, type, startTime, endTime, location, notes });
        }
      } else {
        const task = taskTitle
          ? addPersonalTask({ title: taskTitle, source: "calendar", dueDate: date, eventTitle: title })
          : null;
        if (recurrenceType !== "none" && repeatUntil) {
          const recurrenceId = `recur-${Date.now()}`;
          for (const d of generateRecurringDates(date, recurrenceType, repeatUntil)) {
            addPersonalEvent({ date: d, title, startTime, endTime, location, notes, taskTitle, taskId: task ? task.id : "", type, recurrenceId, leadId, leadName });
          }
        } else {
          addPersonalEvent({ date, title, startTime, endTime, location, notes, taskTitle, taskId: task ? task.id : "", type, leadId, leadName });
        }
      }
      dialog.close();
      state.selectedDate = date;
      if (refreshCalendar) refreshCalendar();
    } catch (err) {
      console.error("Save failed:", err);
      if (saveErr) {
        saveErr.textContent  = "Failed to save: " + (err.message || "Please try again.");
        saveErr.style.display = "block";
      }
    } finally {
      if (submitBtn)  { submitBtn.disabled  = false; submitBtn.textContent = origLabel; }
      if (closeBtnEl)   closeBtnEl.disabled = false;
    }
  });
}

// ── Agency event manager ──────────────────────────────────────────────────────

function wireAgencyEventManager(userRole, refreshCalendar) {
  const form        = document.getElementById("agency-event-form");
  const typeInput   = document.getElementById("agency-event-type");
  const dateInput   = document.getElementById("agency-event-date");
  const titleInput  = document.getElementById("agency-event-title");
  const editIdInput = document.getElementById("agency-event-edit-id");
  const submitBtn   = document.getElementById("agency-event-submit-btn");
  const cancelBtn   = document.getElementById("agency-event-cancel-btn");
  const list        = document.getElementById("agency-events-editor-list");
  const accessNote  = document.getElementById("agency-events-access-note");
  if (!form || !typeInput || !dateInput || !titleInput || !editIdInput || !submitBtn || !cancelBtn || !list || !accessNote) return;

  const canManage = userRole === "admin" || userRole === "district";

  const typeButtons = form.querySelectorAll(".event-type-btn");

  const setEditMode = (eventItem) => {
    if (!eventItem) {
      editIdInput.value  = "";
      dateInput.value    = "";
      titleInput.value   = "";
      typeInput.value    = "Event";
      typeButtons.forEach((btn) => btn.classList.toggle("active", btn.dataset.type === "Event"));
      submitBtn.textContent = "Add Event";
      return;
    }
    editIdInput.value  = eventItem.id;
    dateInput.value    = eventItem.date;
    titleInput.value   = eventItem.title;
    typeInput.value    = eventItem.type || "Event";
    typeButtons.forEach((btn) => btn.classList.toggle("active", btn.dataset.type === (eventItem.type || "Event")));
    submitBtn.textContent = "Save Changes";
  };

  const agencyDotColor = (type) => {
    if (type === "Training") return "purple";
    if (type === "Meeting")  return "teal";
    return "orange";
  };

  const renderEditorList = () => {
    const events = getAgencyEvents().sort((a, b) => a.date.localeCompare(b.date));
    list.innerHTML = events.map((eventItem) => {
      const controls = canManage
        ? `<div class="agency-event-actions"><button type="button" data-action="edit" data-id="${eventItem.id}">Edit</button></div>`
        : "";
      return `
        <li>
          <span class="dot ${agencyDotColor(eventItem.type)}" aria-hidden="true"></span>
          <div class="activity-body">
            <div class="activity-row">
              <span class="activity-name">${eventItem.title}</span>
              <span class="activity-time">${eventItem.date}</span>
            </div>
            <p class="activity-desc">${eventItem.type || "Agency Event"}</p>
            ${controls}
          </div>
        </li>
      `;
    }).join("");

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
    ? "You have admin access and can add, edit, or import agency-level events."
    : "Agency-level events are read-only. Only admins can add, edit, or import.";
  form.style.display = canManage ? "grid" : "none";

  const importSection = document.getElementById("agency-events-import-section");
  if (importSection) importSection.style.display = canManage ? "block" : "none";

  // Clear-all button (district only)
  if (canManage) {
    const clearAllId = "agency-events-clear-all-btn";
    if (!document.getElementById(clearAllId)) {
      const clearBtn = document.createElement("button");
      clearBtn.id = clearAllId;
      clearBtn.type = "button";
      clearBtn.textContent = "Clear All Agency Events";
      clearBtn.style.cssText = "margin-bottom:1rem;padding:0.4rem 0.85rem;border:1px solid #fca5a5;border-radius:8px;background:#fff;color:#dc2626;cursor:pointer;font-size:0.85rem;font-weight:600;";
      list.parentElement.insertBefore(clearBtn, list);

      clearBtn.addEventListener("click", async () => {
        const all = getAgencyEvents();
        if (all.length === 0) return alert("No agency events to clear.");
        if (!confirm(`Delete all ${all.length} agency events? This cannot be undone.`)) return;

        clearBtn.disabled = true;
        clearBtn.textContent = `Deleting… 0/${all.length}`;
        let done = 0;
        const BATCH = 5;
        for (let i = 0; i < all.length; i += BATCH) {
          const batch = all.slice(i, i + BATCH);
          await Promise.all(batch.map(ev => apiDelete('/events/' + ev.id).catch(() => {})));
          done += batch.length;
          clearBtn.textContent = `Deleting… ${Math.min(done, all.length)}/${all.length}`;
          if (i + BATCH < all.length) await new Promise(r => setTimeout(r, 150));
        }

        saveAgencyEvents([]);
        renderEditorList();
        refreshCalendar();
        clearBtn.disabled = false;
        clearBtn.textContent = "Clear All Agency Events";
        showCalendarToast(`Deleted ${all.length} agency events.`);
      });
    }
  }

  typeButtons.forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      typeInput.value = btn.dataset.type;
      typeButtons.forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
    });
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!canManage) return;
    const date  = dateInput.value;
    const title = titleInput.value.trim();
    if (!date || !title) return;

    const editingId  = editIdInput.value;
    const typeValue  = typeInput.value || "Event";
    const origText   = submitBtn.textContent;
    submitBtn.disabled = true;
    submitBtn.textContent = "Saving…";

    try {
      if (editingId) {
        await apiPut('/events/' + editingId, { title, event_date: date, event_type: typeValue });
        const updated = getAgencyEvents().map((item) => (item.id === editingId ? { ...item, date, title, type: typeValue } : item));
        saveAgencyEvents(updated);
        try { window.dispatchEvent(new CustomEvent("calendarEventAdded", { detail: { type: "agency", event: updated.find((it) => it.id === editingId) } })); } catch (_) {}
      } else {
        const newEv = addAgencyEvent({ date, title, type: typeValue });
        try { window.dispatchEvent(new CustomEvent("calendarEventAdded", { detail: { type: "agency", event: newEv } })); } catch (_) {}
      }
      setEditMode(null);
      renderEditorList();
      refreshCalendar();
    } catch (err) {
      console.error("Agency event save failed:", err);
    } finally {
      submitBtn.disabled    = false;
      submitBtn.textContent = origText;
    }
  });

  cancelBtn.addEventListener("click", () => setEditMode(null));
  renderEditorList();

  // CSV / Excel import
  const uploadInput = document.getElementById("agency-events-upload");
  const importBtn   = document.getElementById("agency-events-import-btn");

  const detectEventType = (title) => {
    const t = title.toLowerCase();
    if (t.includes("training"))                                           return "Training";
    if (t.includes("meeting") || t.includes("mtg") ||
        t.includes("tele night") || t.includes("telenight") ||
        t.includes("networking"))                                         return "Meeting";
    return "Event";
  };

  const parseCsv = (text) => {
    const rawRows = [];
    let i = 0;
    while (i < text.length) {
      const row = [];
      while (i < text.length) {
        let field = "";
        if (text[i] === '"') {
          i++;
          while (i < text.length) {
            if (text[i] === '"' && text[i + 1] === '"') { field += '"'; i += 2; }
            else if (text[i] === '"') { i++; break; }
            else { field += text[i++]; }
          }
        } else {
          while (i < text.length && text[i] !== "," && text[i] !== "\n" && text[i] !== "\r") field += text[i++];
        }
        row.push(field.trim());
        if (i < text.length && text[i] === ",") i++;
        else { if (text[i] === "\r") i++; if (text[i] === "\n") i++; break; }
      }
      if (row.some((f) => f !== "")) rawRows.push(row);
    }
    const startIdx = rawRows.length > 0 && rawRows[0][0].toLowerCase() === "date" ? 1 : 0;
    return rawRows.slice(startIdx).map(([date = "", title = "", type = "", location = "", startTime = "", endTime = ""] = []) => {
      if (!date || !title) return null;
      return { date, title, type: type || detectEventType(title), location, startTime, endTime };
    }).filter(Boolean);
  };

  const parseXlsx = (buffer, year = 2026) => {
    if (typeof XLSX === "undefined") throw new Error("XLSX library not loaded");
    const workbook  = XLSX.read(new Uint8Array(buffer), { type: "array" });
    const sheetName = workbook.SheetNames[0];
    if (!sheetName) throw new Error("No sheet found in workbook");
    const rows       = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { header: 1 });
    const monthNames = ["January","February","March","April","May","June","July","August","September","October","November","December"];
    const parsed     = [];
    let currentMonth = null;
    rows.forEach((row) => {
      if (!Array.isArray(row) || row.length < 1) return;
      const col0 = String(row[0] || "").trim();
      const col1 = String(row[1] || "").trim();
      const mIdx = monthNames.findIndex((m) => col0.toLowerCase().includes(m.toLowerCase()));
      if (mIdx !== -1) { currentMonth = mIdx + 1; return; }
      if (currentMonth !== null && /^\d+$/.test(col0) && col1.length > 0) {
        const day = parseInt(col0);
        if (day >= 1 && day <= 31) {
          parsed.push({ date: `${year}-${String(currentMonth).padStart(2, "0")}-${String(day).padStart(2, "0")}`, title: col1, type: "Event", location: "", startTime: "", endTime: "" });
        }
      }
    });
    return parsed;
  };

  const doImport = (file) => {
    if (!file) return alert("No file selected.");
    const isXlsx = file.name.toLowerCase().endsWith(".xlsx") || file.type.includes("spreadsheet");
    const reader  = new FileReader();
    reader.onload = async (e) => {
      try {
        const yearInput = document.getElementById("agency-events-year");
        const year      = yearInput ? parseInt(yearInput.value) || 2026 : 2026;
        const parsed    = isXlsx ? parseXlsx(e.target.result, year) : parseCsv(String(e.target.result || ""));
        if (parsed.length === 0) return alert("No valid rows found in file.");

        const BATCH_SIZE = 5;
        const results = [];
        const failed = [];
        const errorSamples = [];
        const userId = sessionStorage.getItem('dashboardUser') || null;

        // Show live progress so the user knows it's working
        const importBtn = document.getElementById("agency-events-import-btn");
        const origLabel = importBtn ? importBtn.textContent : "";
        if (importBtn) importBtn.disabled = true;

        for (let i = 0; i < parsed.length; i += BATCH_SIZE) {
          const batch = parsed.slice(i, i + BATCH_SIZE);
          if (importBtn) importBtn.textContent = `Importing… ${Math.min(i + BATCH_SIZE, parsed.length)}/${parsed.length}`;

          await Promise.all(batch.map(async (r) => {
            // Normalise date to YYYY-MM-DD in case the CSV has DD/MM/YYYY or D/M/YYYY
            let eventDate = r.date || "";
            const dmyMatch = eventDate.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
            if (dmyMatch) eventDate = `${dmyMatch[3]}-${dmyMatch[2].padStart(2,"0")}-${dmyMatch[1].padStart(2,"0")}`;

            const ev = { id: `agency-${Date.now()}-${Math.floor(Math.random() * 1000)}`, date: eventDate, title: r.title, type: r.type || "Event", location: r.location || "" };
            if (r.startTime) ev.startTime = r.startTime;
            if (r.endTime)   ev.endTime   = r.endTime;
            try {
              const res = await apiPost('/events', {
                title: ev.title, event_date: ev.date, event_type: ev.type,
                location: ev.location || null, start_time: ev.startTime || null, end_time: ev.endTime || null,
                category: 'agency', created_by: userId,
              });
              if (res && (res.event_id || res.id)) ev.id = res.event_id || res.id;
              results.push(ev);
            } catch (err) {
              console.error("Import failed:", r.title, r.date, err.message);
              failed.push(r.title);
              if (errorSamples.length < 3) errorSamples.push(err.message);
            }
          }));

          // Small pause between batches to avoid overwhelming the DB connection pool
          if (i + BATCH_SIZE < parsed.length) await new Promise(res => setTimeout(res, 150));
        }

        if (importBtn) { importBtn.disabled = false; importBtn.textContent = origLabel; }

        saveAgencyEvents(getAgencyEvents().concat(results));
        renderEditorList();
        refreshCalendar();
        try { window.dispatchEvent(new CustomEvent("calendarEventAdded", { detail: { type: "agency-batch", events: results } })); } catch (_) {}

        let failMsg = "";
        if (failed.length > 0) {
          failMsg = `\n${failed.length} failed to save to DB.`;
          if (errorSamples.length > 0) failMsg += `\nFirst error: ${errorSamples[0]}`;
          failMsg += "\n(Check browser console for full details.)";
        }
        alert(`Imported ${results.length} of ${parsed.length} events.${failMsg}`);
      } catch (err) {
        console.error(err);
        alert(`Failed to parse file: ${err.message}`);
      }
    };
    if (isXlsx) reader.readAsArrayBuffer(file);
    else         reader.readAsText(file);
  };

  if (importBtn && uploadInput) {
    importBtn.addEventListener("click", () => {
      if (!uploadInput.files || uploadInput.files.length === 0) return alert("Please choose a file first.");
      doImport(uploadInput.files[0]);
    });
  }
}

// ── Page init ─────────────────────────────────────────────────────────────────

if (isCalendarPage()) {
  wireCalendarPage();
}
