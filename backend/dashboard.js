const leadData = [
  {
    id: 1,
    name: "Tan Wei Ming",
    age: 34,
    contactProfile: "weiming.tan@email.com | +65 8123 4456",
    meetupDate: "2026-05-06",
    meetupLocation: "Makati Office",
    meetingType: "F2F",
    urgency: "Urgent",
    remarks: "Could not close the deal on first meeting. Requested revised premium options.",
    planType: "Life Insurance - Term",
    premium: 120000,
    commissionType: "Upfront",
    stage: "Negotiation",
    owner: "agent",
    agency: "Agency Alpha"
  },
  {
    id: 2,
    name: "Nur Aisyah Rahman",
    age: 42,
    contactProfile: "aisyah.rahman@email.com | +65 8234 5567",
    meetupDate: "2026-05-08",
    meetupLocation: "Online - Teams",
    meetingType: "Non-F2F",
    urgency: "Non-Urgent",
    remarks: "Requested plan options with family package.",
    planType: "Health Insurance - Family",
    premium: 98000,
    commissionType: "Recurring",
    stage: "Qualified",
    owner: "agent",
    agency: "Agency Beta"
  },
  {
    id: 3,
    name: "Marcus Lim",
    age: 29,
    contactProfile: "marcus.lim@email.com | +65 8345 6678",
    meetupDate: "2026-05-10",
    meetupLocation: "BGC Cafe",
    meetingType: "F2F",
    urgency: "Urgent",
    remarks: "Strong intent to sign by next week after discussing riders.",
    planType: "Auto Insurance - Premium",
    premium: 76000,
    commissionType: "Tiered",
    stage: "Proposal Sent",
    owner: "agent",
    agency: "Agency Alpha"
  },
  {
    id: 4,
    name: "Priya Nair",
    age: 38,
    contactProfile: "priya.nair@email.com | +65 8456 7789",
    meetupDate: "2026-05-18",
    meetupLocation: "District Office",
    meetingType: "F2F",
    urgency: "Non-Urgent",
    remarks: "Follow-up required after spouse review.",
    planType: "Property Insurance",
    premium: 142000,
    commissionType: "Upfront",
    stage: "Follow-up",
    owner: "district",
    agency: "Agency Gamma"
  },
  {
    id: 5,
    name: "Daniel Koh",
    age: 46,
    contactProfile: "daniel.koh@email.com | +65 8567 8890",
    meetupDate: "2026-05-21",
    meetupLocation: "Online - Zoom",
    meetingType: "Non-F2F",
    urgency: "Urgent",
    remarks: "Appointment set to finalize terms and payment channel.",
    planType: "Life Insurance - Whole",
    premium: 186000,
    commissionType: "Hybrid",
    stage: "Closing",
    owner: "district",
    agency: "Agency Beta"
  }
];

const districtEventsSeed = [
  { id: "agency-1", date: "2026-05-12", title: "District Training Session", type: "District Event" },
  { id: "agency-2", date: "2026-05-25", title: "District Sales Review", type: "District Event" }
];

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

const cpfTrackerData = [
  {
    name: "Tan Wei Ming",
    accountFocus: "OA allocation",
    status: "Review due",
    amount: 42000,
    note: "Confirm CPF nomination and protection gap before revised proposal."
  },
  {
    name: "Nur Aisyah Rahman",
    accountFocus: "MA buffer",
    status: "On track",
    amount: 28000,
    note: "Family health plan discussion includes MediSave affordability check."
  },
  {
    name: "Marcus Lim",
    accountFocus: "SA planning",
    status: "Action needed",
    amount: 36000,
    note: "Prepare retirement income projection before next F2F meeting."
  }
];

const performanceData = {
  yearlyFyc: 111800,
  yearlyTarget: 1500000,
  weeklyFyc: 6913,
  lastWeekFyc: 5187,
  leaderboard: [
    { agent: "Alicia Tan", monthlyProduction: 0, ytdFyc: 34525, delta: 435 },
    { agent: "Brandon Lee", monthlyProduction: 0, ytdFyc: 23210, delta: 44 },
    { agent: "Chloe Ong", monthlyProduction: 0, ytdFyc: 9400, delta: -39 },
    { agent: "Darren Lim", monthlyProduction: 0, ytdFyc: 8025, delta: 0 },
    { agent: "Farah Rahim", monthlyProduction: 0, ytdFyc: 7627, delta: -26 },
    { agent: "Gavin Teo", monthlyProduction: 0, ytdFyc: 6577, delta: 346 },
    { agent: "Hui Min Chua", monthlyProduction: 0, ytdFyc: 6100, delta: 76 },
    { agent: "Isaac Wong", monthlyProduction: 0, ytdFyc: 5240, delta: -55 },
    { agent: "Jia En Low", monthlyProduction: 0, ytdFyc: 4941, delta: -56 },
    { agent: "Kumar Singh", monthlyProduction: 0, ytdFyc: 2022, delta: 0 }
  ],
  monthlyYtd: [
    { month: "Jan", value: 6200 },
    { month: "Feb", value: 12400 },
    { month: "Mar", value: 18800 },
    { month: "Apr", value: 33100 },
    { month: "May", value: 45500 },
    { month: "Jun", value: 58600 },
    { month: "Jul", value: 68800 },
    { month: "Aug", value: 74200 },
    { month: "Sep", value: 87500 },
    { month: "Oct", value: 96800 },
    { month: "Nov", value: 104600 },
    { month: "Dec", value: 111800 }
  ],
  menteeStatuses: ["Top producer", "Consistent follow-up", "Needs weekly coaching", "Pipeline review due"],
  weekly: [
    { day: "Mon", fyc: 4200, cases: 2 },
    { day: "Tue", fyc: 6800, cases: 3 },
    { day: "Wed", fyc: 2600, cases: 1 },
    { day: "Thu", fyc: 9100, cases: 4 },
    { day: "Fri", fyc: 5600, cases: 2 }
  ]
};

const overviewScopeCopy = {
  district: "District-wide performance across all agents, leads, and FYC activity.",
  agency: "Department view for agency production, selected agents, and active lead movement.",
  personal: "Your personal production, appointments, lead pipeline, and weekly case activity."
};

const AGENCY_EVENTS_STORAGE_KEY = "agencyEvents";
const PERSONAL_EVENTS_STORAGE_KEY = "personalEvents";
const PERSONAL_TASKS_STORAGE_KEY = "personalTasks";

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
const ATTENDANCE_EVENTS_STORAGE_KEY = "attendanceEvents";

function isOverviewPage() {
  return document.getElementById("lead-table-body") !== null;
}

function isHomeDashboardPage() {
  return document.getElementById("total-leads-card") !== null;
}

function isCalendarPage() {
  return document.getElementById("calendar-grid") !== null;
}

function money(value) {
  return new Intl.NumberFormat("en-SG", {
    style: "currency",
    currency: "SGD",
    maximumFractionDigits: 0
  }).format(value);
}

function compactMoney(value) {
  const sign = value < 0 ? "-" : "";
  const absolute = Math.abs(value);
  if (absolute >= 1000000) return `${sign}SGD ${(absolute / 1000000).toFixed(1)}M`;
  if (absolute >= 1000) return `${sign}SGD ${(absolute / 1000).toFixed(1)}K`;
  return `${sign}${money(absolute)}`;
}

function getAgencyEvents() {
  try {
    const raw = localStorage.getItem(AGENCY_EVENTS_STORAGE_KEY);
    if (!raw) return [...districtEventsSeed];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) return parsed;
  } catch (error) {
    // Fall back to seed events if storage is invalid.
  }
  return [...districtEventsSeed];
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
  // Notify other parts of the app that a calendar event was added
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

function formatTimeRange(event) {
  const start = event.startTime || "";
  const end = event.endTime || "";
  if (start && end) return `${start} - ${end}`;
  if (start) return `Starts ${start}`;
  if (end) return `Ends ${end}`;
  return "Time not set";
}

function getLeadEvents(role = "agent", options = { showPersonal: true, showAgency: false }) {
  const personalLeads = leadData
    .filter((lead) => (role === "district_manager" ? lead.owner === "district" : lead.owner === "agent"))
    .map((lead) => ({
      id: `lead-${lead.id}`,
      leadId: lead.id,
      date: lead.meetupDate,
      title: `${lead.name} Â· ${lead.meetingType} Meet-up`,
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

function renderLeadTable(rows) {
  const tbody = document.getElementById("lead-table-body");
  if (!tbody) return;
  tbody.innerHTML = rows
    .map(
      (lead) => `
      <tr data-lead-id="${lead.id}" class="lead-row">
        <td>${lead.name}</td>
        <td>${lead.age}</td>
        <td>${lead.contactProfile}</td>
        <td>${lead.meetupDate}</td>
        <td>${lead.meetupLocation}</td>
        <td>${lead.meetingType}</td>
        <td><span class="status-pill ${lead.urgency === "Urgent" ? "urgent" : "non-urgent"}">${lead.urgency}</span></td>
        <td>${lead.remarks}</td>
      </tr>
    `
    )
    .join("");
}

function updateLeadPageSummary(rows) {
  const summary = document.getElementById("lead-summary-line");
  if (!summary) return;
  const urgentCount = rows.filter((lead) => lead.urgency === "Urgent").length;
  summary.textContent = `Showing ${rows.length} lead${rows.length === 1 ? "" : "s"} Â· ${urgentCount} urgent`;
}

function renderClosureTable(rows) {
  const tbody = document.getElementById("closure-table-body");
  if (!tbody) return;
  tbody.innerHTML = rows
    .map(
      (lead) => `
      <tr>
        <td>${lead.name}</td>
        <td><span class="status-pill ${lead.urgency === "Urgent" ? "urgent" : "non-urgent"}">${lead.urgency}</span></td>
        <td>${lead.planType}</td>
        <td>${money(lead.premium)}</td>
        <td>${lead.commissionType}</td>
      </tr>
    `
    )
    .join("");
}

function renderSalesPerformance(rows) {
  const list = document.getElementById("sales-performance-list");
  if (!list) return;
  const totalPremium = rows.reduce((sum, lead) => sum + lead.premium, 0);
  const urgentCount = rows.filter((lead) => lead.urgency === "Urgent").length;
  const conversionReady = rows.filter((lead) => lead.stage === "Closing" || lead.stage === "Proposal Sent").length;
  list.innerHTML = `
    <li><span class="dot blue" aria-hidden="true"></span><div class="activity-body"><div class="activity-row"><span class="activity-name">Total Pipeline Premium</span><span class="activity-time">${money(totalPremium)}</span></div><p class="activity-desc">Integrated from lead records and closure estimates.</p></div></li>
    <li><span class="dot red" aria-hidden="true"></span><div class="activity-body"><div class="activity-row"><span class="activity-name">Urgent Leads</span><span class="activity-time">${urgentCount}</span></div><p class="activity-desc">Requires immediate follow-up and meeting confirmation.</p></div></li>
    <li><span class="dot orange" aria-hidden="true"></span><div class="activity-body"><div class="activity-row"><span class="activity-name">Near Conversion</span><span class="activity-time">${conversionReady}</span></div><p class="activity-desc">Leads in proposal or closing stage.</p></div></li>
  `;
}

function renderCpfTracker() {
  const list = document.getElementById("cpf-tracker-list");
  if (!list) return;

  list.innerHTML = cpfTrackerData
    .map((item) => {
      const dotClass = item.status === "On track" ? "blue" : item.status === "Review due" ? "orange" : "red";
      return `
        <li>
          <span class="dot ${dotClass}" aria-hidden="true"></span>
          <div class="activity-body">
            <div class="activity-row">
              <span class="activity-name">${item.name} Â· ${item.accountFocus}</span>
              <span class="activity-time">${money(item.amount)}</span>
            </div>
            <p class="activity-desc"><strong>${item.status}:</strong> ${item.note}</p>
          </div>
        </li>
      `;
    })
    .join("");
}

function updatePremiumSummary(rows) {
  const ytdElement = document.getElementById("premium-ytd");
  const expectedElement = document.getElementById("premium-expected");
  if (!ytdElement || !expectedElement) return;

  const today = new Date().toISOString().slice(0, 10);
  const ytdPremium = rows
    .filter((lead) => lead.meetupDate <= today)
    .reduce((sum, lead) => sum + lead.premium, 0);
  const expectedPremium = rows.reduce((sum, lead) => sum + lead.premium, 0);

  ytdElement.textContent = money(ytdPremium);
  expectedElement.textContent = money(expectedPremium);
}

function updateLeadSummary(rows) {
  const totalElement = document.getElementById("total-leads-count");
  if (totalElement) totalElement.textContent = String(rows.length);
}

function renderCalendarPermissions(role) {
  const list = document.getElementById("calendar-permissions");
  if (!list) return;
  if (role === "district_manager") {
    list.innerHTML = `
      <li><span class="dot blue"></span><div class="activity-body"><p class="activity-desc">Can view and edit agent calendars.</p></div></li>
      <li><span class="dot red"></span><div class="activity-body"><p class="activity-desc">Can view and edit district calendars.</p></div></li>
    `;
  } else {
    list.innerHTML = `
      <li><span class="dot blue"></span><div class="activity-body"><p class="activity-desc">Can view and edit own calendar only.</p></div></li>
      <li><span class="dot orange"></span><div class="activity-body"><p class="activity-desc">Can view district-level events (read-only).</p></div></li>
    `;
  }
}

function wireLeadDetailDialog(currentRows) {
  const dialog = document.getElementById("lead-detail-dialog");
  const closeButton = document.getElementById("close-lead-dialog");
  if (!dialog || !closeButton) return;
  document.querySelectorAll(".lead-row").forEach((row) => {
    row.addEventListener("click", () => {
      const leadId = Number(row.dataset.leadId);
      const lead = currentRows.find((item) => item.id === leadId);
      if (!lead) return;
      document.getElementById("lead-detail-name").textContent = lead.name;
      document.getElementById("lead-detail-content").innerHTML = `
        <p><strong>Profile:</strong> ${lead.contactProfile}</p>
        <p><strong>Meet-up:</strong> ${lead.meetupDate} at ${lead.meetupLocation} (${lead.meetingType})</p>
        <p><strong>Urgency:</strong> ${lead.urgency}</p>
        <p><strong>Remarks:</strong> ${lead.remarks}</p>
        <p><strong>Plan & Premium:</strong> ${lead.planType} Â· ${money(lead.premium)}</p>
      `;
      dialog.showModal();
    });
  });
  closeButton.onclick = () => dialog.close();
}

function wireLeadFilters() {
  const filterInput = document.getElementById("lead-date-filter");
  const sortSelect = document.getElementById("lead-sort-select");
  const agencySelect = document.getElementById("lead-agency-filter"); // Assuming this ID for the new dropdown
  if (!filterInput || !sortSelect) return;

  // Populate agency filter dropdown
  if (agencySelect) {
    const uniqueAgencies = [...new Set(leadData.map(lead => lead.agency))].sort();
    agencySelect.innerHTML = '<option value="">All Agencies</option>' +
      uniqueAgencies.map(agency => `<option value="${agency}">${agency}</option>`).join('');
  }

  const update = () => {
    const dateFilter = filterInput.value;
    const sortDirection = sortSelect.value;
    const agencyFilter = agencySelect ? agencySelect.value : "";

    let filtered = [...leadData];
    if (dateFilter) {
      filtered = filtered.filter((lead) => lead.meetupDate === dateFilter);
    }
    if (agencyFilter) {
      filtered = filtered.filter((lead) => lead.agency === agencyFilter);
    }
    filtered.sort((a, b) =>
      sortDirection === "asc" ? a.meetupDate.localeCompare(b.meetupDate) : b.meetupDate.localeCompare(a.meetupDate)
    );
    renderLeadTable(filtered);
    renderClosureTable(filtered);
    renderSalesPerformance(filtered);
    renderCpfTracker();
    updatePremiumSummary(filtered);
    updateLeadSummary(filtered);
    updateLeadPageSummary(filtered);
    wireLeadDetailDialog(filtered);
  };

  filterInput.addEventListener("change", update);
  sortSelect.addEventListener("change", update);
  if (agencySelect) agencySelect.addEventListener("change", update);
  update();
}

function renderOverviewCards() {
  updateLeadSummary(leadData);
  renderPerformanceOverview();
}

function getOverviewDataset(scope = "district") {
  if (scope === "personal") {
    const personalLeads = leadData.filter((lead) => lead.owner === "agent");
    const personalFyc = 34525;
    return {
      scope,
      leads: personalLeads,
      data: {
        yearlyFyc: personalFyc,
        yearlyTarget: 180000,
        weeklyFyc: 4200,
        lastWeekFyc: 3600,
        leaderboard: [
          { agent: "You", monthlyProduction: 4200, ytdFyc: personalFyc, delta: 18 },
          { agent: "Team Average", monthlyProduction: 3100, ytdFyc: 23210, delta: 9 },
          { agent: "Best Peer", monthlyProduction: 5600, ytdFyc: 52400, delta: 27 }
        ],
        monthlyYtd: performanceData.monthlyYtd.map((item) => ({ ...item, value: Math.round(item.value * 0.31) })),
        menteeStatuses: ["Follow-up due", "Proposal pending", "Closing conversation"],
        weekly: [
          { day: "Mon", fyc: 1200, cases: 1 },
          { day: "Tue", fyc: 0, cases: 0 },
          { day: "Wed", fyc: 2100, cases: 1 },
          { day: "Thu", fyc: 900, cases: 1 },
          { day: "Fri", fyc: 0, cases: 0 }
        ]
      }
    };
  }

  if (scope === "agency") {
    const agencyLeads = leadData.filter((lead) => lead.owner === "agent");
    const agencyLeaderboard = performanceData.leaderboard.slice(0, 6);
    return {
      scope,
      leads: agencyLeads,
      data: {
        yearlyFyc: 83540,
        yearlyTarget: 650000,
        weeklyFyc: 5200,
        lastWeekFyc: 4800,
        leaderboard: agencyLeaderboard,
        monthlyYtd: performanceData.monthlyYtd.map((item) => ({ ...item, value: Math.round(item.value * 0.72) })),
        menteeStatuses: ["Top producer", "Strong pipeline", "Needs weekly coaching", "Follow-up discipline"],
        weekly: [
          { day: "Mon", fyc: 2900, cases: 1 },
          { day: "Tue", fyc: 4500, cases: 2 },
          { day: "Wed", fyc: 1800, cases: 1 },
          { day: "Thu", fyc: 6100, cases: 3 },
          { day: "Fri", fyc: 3400, cases: 1 }
        ]
      }
    };
  }

  return { scope: "district", leads: leadData, data: performanceData };
}

function renderPerformanceOverview(scope = localStorage.getItem("overviewScope") || "agency") {
  const { data, leads } = getOverviewDataset(scope);
  const lede = document.getElementById("overview-scope-lede");
  if (lede) lede.textContent = overviewScopeCopy[scope] || overviewScopeCopy.district;
  toggleOverviewPanels(scope);
  updateAgentPanelLabels(scope);
  renderFycKpis(data, leads);
  renderLeaderboard(data);
  renderAgentFycChart(data, scope);
  renderMonthlyYtdChart(data);
  renderMenteeList(data);
  renderSalesFunnel(leads);
  renderWeeklyFycCaseChart(data);
}

function updateAgentPanelLabels(scope) {
  const title = document.getElementById("agent-fyc-panel-title");
  const summary = document.getElementById("agent-fyc-panel-summary");
  const insight = document.getElementById("agent-fyc-insight");
  const chart = document.getElementById("agent-fyc-chart");
  if (title) title.textContent = scope === "district" ? "Leaderboard for YTD Cases" : "Year FYC by Agent";
  if (summary) summary.textContent = scope === "district" ? "YTD case ranking" : "Top producers";
  if (insight) {
    insight.classList.toggle("is-hidden", scope === "district");
    insight.textContent = "Select an agent bar to view FYC details.";
  }
  if (chart) chart.setAttribute("aria-label", scope === "district" ? "Leaderboard for YTD cases" : "Year FYC by agent");
}

function toggleOverviewPanels(scope) {
  const compactOverviewPanelIds = ["monthly-ytd-panel", "mentee-list-panel", "sales-closure", "weekly-fyc-case-panel"];
  const useCompactOverview = scope === "district" || scope === "agency";
  compactOverviewPanelIds.forEach((panelId) => {
    const panel = document.getElementById(panelId);
    if (panel) panel.classList.toggle("is-hidden", useCompactOverview);
  });

  ["leaderboard-panel", "agent-fyc-panel"].forEach((panelId) => {
    const panel = document.getElementById(panelId);
    if (panel) panel.classList.toggle("is-hidden", scope === "personal");
  });
}

function wireOverviewTabs() {
  const tabs = Array.from(document.querySelectorAll("[data-overview-scope]"));
  const isOverviewDashboard = document.getElementById("total-leads-card") !== null;
  const overviewLink = document.querySelector(".overview-nav-menu a[href='index.html']");
  const scopeLabels = {
    district: "District Overview",
    agency: "Agency Overview",
    personal: "Personal Overview"
  };
  if (tabs.length === 0 && !isOverviewDashboard) return;

  const setScope = (scope) => {
    const normalizedScope = ["district", "agency", "personal"].includes(scope) ? scope : "agency";
    localStorage.setItem("overviewScope", normalizedScope);
    if (overviewLink) {
      overviewLink.innerHTML = `<span>${scopeLabels[normalizedScope]}</span><span class="overview-caret" aria-hidden="true">▾</span>`;
    }
    tabs.forEach((tab) => {
      const isActive = tab.dataset.overviewScope === normalizedScope;
      tab.classList.toggle("active", isActive);
      tab.setAttribute("aria-selected", String(isActive));
    });
    renderPerformanceOverview(normalizedScope);
  };

  tabs.forEach((tab) => {
    tab.addEventListener("click", () => setScope(tab.dataset.overviewScope));
  });

  if (isOverviewDashboard) {
    window.addEventListener("overviewScopeChanged", (event) => setScope(event.detail.scope));
  }

  setScope(localStorage.getItem("overviewScope") || "agency");
}

function wireChartInteractions(container, insightElement) {
  if (!container || !insightElement) return;
  const items = Array.from(container.querySelectorAll("[data-insight]"));
  const setSelected = (item) => {
    insightElement.textContent = item.dataset.insight;
    container.querySelectorAll(".is-selected").forEach((selected) => selected.classList.remove("is-selected"));
    item.classList.add("is-selected");
  };
  items.forEach((item) => {
    const updateInsight = () => {
      setSelected(item);
    };
    item.addEventListener("click", updateInsight);
    item.addEventListener("mouseenter", updateInsight);
    item.addEventListener("focus", updateInsight);
  });
  if (items.length > 0) setSelected(items[0]);
}

function renderFycKpis(data = performanceData, leads = leadData) {
  const yearlyValue = document.getElementById("yearly-fyc-value");
  const yearlyProgress = document.getElementById("yearly-fyc-progress");
  const yearlyPercent = document.getElementById("yearly-fyc-percent");
  const yearlyTarget = document.getElementById("yearly-fyc-target");
  const weeklyValue = document.getElementById("weekly-fyc-value");
  const weeklyLast = document.getElementById("weekly-fyc-last");
  const weeklyChange = document.getElementById("weekly-fyc-change");
  const totalLeads = document.getElementById("total-leads-count");
  const urgentLeads = document.getElementById("urgent-leads-count");
  const nearClose = document.getElementById("near-close-count");

  const targetPercent = Math.min(100, Math.round((data.yearlyFyc / data.yearlyTarget) * 1000) / 10);
  const weekDelta = data.lastWeekFyc
    ? Math.round(((data.weeklyFyc - data.lastWeekFyc) / data.lastWeekFyc) * 1000) / 10
    : 0;
  const totalCases = data.weekly.reduce((sum, item) => sum + item.cases, 0);

  if (yearlyValue) yearlyValue.textContent = compactMoney(data.yearlyFyc);
  if (yearlyProgress) yearlyProgress.style.width = `${targetPercent}%`;
  if (yearlyPercent) yearlyPercent.textContent = `${targetPercent}%`;
  if (yearlyTarget) yearlyTarget.textContent = compactMoney(data.yearlyTarget);
  if (weeklyValue) weeklyValue.textContent = compactMoney(data.weeklyFyc);
  if (weeklyLast) weeklyLast.textContent = `${compactMoney(data.lastWeekFyc)} vs previous MTD`;
  if (weeklyChange) weeklyChange.textContent = `${weekDelta > 0 ? "+" : ""}${weekDelta}%`;
  if (totalLeads) totalLeads.textContent = String(totalCases);
  if (urgentLeads) urgentLeads.textContent = `${leads.filter((lead) => lead.urgency === "Urgent").length} urgent`;
  if (nearClose) nearClose.textContent = `${leads.filter((lead) => lead.stage === "Closing" || lead.stage === "Proposal Sent").length} near close`;
}

function renderLeaderboard(data = performanceData) {
  const tbody = document.getElementById("leaderboard-table-body");
  if (!tbody) return;
  tbody.innerHTML = data.leaderboard
    .map(
      (item, index) => `
      <tr>
        <td>${index + 1}</td>
        <td>${item.agent}</td>
        <td>${compactMoney(item.monthlyProduction)} <span class="muted-text">(0.0%)</span></td>
        <td>${compactMoney(item.ytdFyc)} <span class="${item.delta >= 0 ? "positive-text" : "negative-text"}">(${item.delta >= 0 ? "+" : ""}${item.delta}%)</span></td>
      </tr>
    `
    )
    .join("");
}

function getYtdCaseCount(item, index) {
  if (Number.isFinite(item.ytdCases)) return item.ytdCases;
  return Math.max(4, Math.round(item.ytdFyc / 850) - index);
}

function renderAgentFycChart(data = performanceData, scope = "agency") {
  const chart = document.getElementById("agent-fyc-chart");
  const insight = document.getElementById("agent-fyc-insight");
  if (!chart) return;
  if (scope === "district") {
    chart.className = "table-wrap compact-table";
    chart.innerHTML = `
      <table class="lead-table leaderboard-table cases-leaderboard-table">
        <thead>
          <tr>
            <th>#</th>
            <th>Agent</th>
            <th>Monthly Cases</th>
            <th>YTD Cases</th>
          </tr>
        </thead>
        <tbody>
          ${data.leaderboard
            .slice(0, 9)
            .map((item, index) => {
              const ytdCases = getYtdCaseCount(item, index);
              const monthlyCases = Math.max(0, Math.round(item.monthlyProduction / 1800));
              return `
                <tr class="case-leaderboard-row">
                  <td>${index + 1}</td>
                  <td>${item.agent}</td>
                  <td>${monthlyCases}</td>
                  <td><strong>${ytdCases}</strong></td>
                </tr>
              `;
            })
            .join("")}
        </tbody>
      </table>
    `;
    return;
  }

  chart.className = "bar-chart";
  const maxValue = Math.max(...data.leaderboard.map((item) => item.ytdFyc));
  const colors = ["#a6192e", "#e8decf", "#c69a67", "#4a4a4a", "#aaa7a2"];
  chart.innerHTML = data.leaderboard
    .slice(0, 9)
    .map((item, index) => {
      const height = Math.max(10, Math.round((item.ytdFyc / maxValue) * 100));
      return `
        <button type="button" class="bar-chart-item" data-insight="${item.agent}: ${money(item.ytdFyc)} YTD FYC, ${money(item.monthlyProduction)} monthly production.">
          <span class="bar-value">${Math.round(item.ytdFyc).toLocaleString("en-SG")}</span>
          <span class="bar-column" style="height:${height}%;background:${colors[index % colors.length]}"></span>
          <span class="bar-label">${item.agent.split(" ")[0]}</span>
        </button>
      `;
    })
    .join("");
  wireChartInteractions(chart, insight);
}

function renderMonthlyYtdChart(data = performanceData) {
  const chart = document.getElementById("monthly-ytd-chart");
  const insight = document.getElementById("monthly-ytd-insight");
  if (!chart) return;
  const maxValue = Math.max(...data.monthlyYtd.map((item) => item.value));
  chart.innerHTML = data.monthlyYtd
    .map((item) => {
      const height = Math.max(4, Math.round((item.value / maxValue) * 100));
      return `
        <button type="button" class="monthly-point" data-insight="${item.month}: ${money(item.value)} YTD FYC.">
          <span class="monthly-bar" style="height:${height}%"></span>
          <strong>${compactMoney(item.value).replace("SGD ", "")}</strong>
          <small>${item.month}</small>
        </button>
      `;
    })
    .join("");
  wireChartInteractions(chart, insight);
}

function renderMenteeList(data = performanceData) {
  const list = document.getElementById("mentee-list");
  const count = document.getElementById("mentee-count-label");
  if (!list) return;
  const mentees = data.leaderboard.slice(0, 4).map((agent, index) => ({
    name: agent.agent,
    status: data.menteeStatuses[index] || "Mentorship active",
    fyc: agent.ytdFyc
  }));
  if (count) count.textContent = `${mentees.length} total`;
  list.innerHTML = mentees
    .map(
      (mentee) => `
      <li>
        <span class="dot blue" aria-hidden="true"></span>
        <div class="activity-body">
          <div class="activity-row">
            <span class="activity-name">${mentee.name}</span>
            <span class="activity-time">${money(mentee.fyc)}</span>
          </div>
          <p class="activity-desc">${mentee.status}</p>
        </div>
      </li>
    `
    )
    .join("");
}

function renderSalesFunnel(leads = leadData) {
  const funnel = document.getElementById("sales-funnel-dashboard");
  const insight = document.getElementById("sales-funnel-insight");
  if (!funnel) return;
  const stages = [
    { label: "Prospecting", count: leads.length, color: "#d99a00", shade: "#b77f00" },
    { label: "Fact Find", count: leads.filter((lead) => lead.stage === "Qualified" || lead.stage === "Follow-up").length, color: "#d64a62", shade: "#b8334c" },
    { label: "Opening", count: leads.filter((lead) => lead.stage === "Proposal Sent" || lead.stage === "Negotiation").length, color: "#9b2f91", shade: "#76226e" },
    { label: "Closing", count: leads.filter((lead) => lead.stage === "Closing").length, color: "#4d367f", shade: "#332358" }
  ];
  funnel.innerHTML = `
    <div class="funnel-shape">
      ${stages
        .map((stage, index) => {
          const width = 92 - index * 14;
          return `
            <button type="button" class="funnel-stage" style="--stage-width:${width}%;--stage-color:${stage.color};--stage-shade:${stage.shade}" data-insight="${stage.label}: ${stage.count} lead${stage.count === 1 ? "" : "s"} in this stage.">
              <span>${stage.label}</span>
              <strong>${stage.count}</strong>
            </button>
          `;
        })
        .join("")}
    </div>
    <div class="funnel-legend">
      ${stages.map((stage) => `<span><i style="background:${stage.color}"></i>${stage.label}</span>`).join("")}
    </div>
  `;
  wireChartInteractions(funnel, insight);
}

function renderWeeklyFycCaseChart(data = performanceData) {
  const chart = document.getElementById("weekly-fyc-case-chart");
  const insight = document.getElementById("weekly-fyc-case-insight");
  if (!chart) return;
  const maxFyc = Math.max(...data.weekly.map((item) => item.fyc), 1);
  const maxCases = Math.max(...data.weekly.map((item) => item.cases), 1);
  chart.innerHTML = data.weekly
    .map((item) => {
      const fycHeight = Math.max(8, Math.round((item.fyc / maxFyc) * 100));
      const caseHeight = Math.max(8, Math.round((item.cases / maxCases) * 100));
      return `
        <button type="button" class="weekly-item" data-insight="${item.day}: ${money(item.fyc)} FYC across ${item.cases} case${item.cases === 1 ? "" : "s"}.">
          <div class="weekly-bars">
            <span class="weekly-bar fyc" style="height:${fycHeight}%"></span>
            <span class="weekly-bar cases" style="height:${caseHeight}%"></span>
          </div>
          <strong>${item.day}</strong>
          <small>${compactMoney(item.fyc).replace("SGD ", "")} / ${item.cases}</small>
        </button>
      `;
    })
    .join("");
  wireChartInteractions(chart, insight);
}

function wireRoleControl() {
  const roleSelect = document.getElementById("role-select");
  if (!roleSelect) return;
  const syncRole = () => {
    localStorage.setItem("calendarRole", roleSelect.value);
    renderCalendarPermissions(roleSelect.value);
  };
  roleSelect.value = localStorage.getItem("calendarRole") || "agent";
  syncRole();
  roleSelect.addEventListener("change", syncRole);
}

function wirePersonalTodo() {
  const form = document.getElementById("personal-task-form");
  const input = document.getElementById("personal-task-input");
  const list = document.getElementById("personal-task-list");
  if (!form || !input || !list) return;

  const renderTasks = () => {
    const tasks = getPersonalTasks();
    list.innerHTML = tasks
      .map(
        (task, index) => `
        <li class="${task.done ? "is-done" : ""}">
          <label><input type="checkbox" data-task-index="${index}" ${task.done ? "checked" : ""}> <span>${task.title}</span>${task.dueDate || task.eventTitle ? `<small class="linked-info">${task.dueDate ? `Due ${task.dueDate}` : ""}${task.dueDate && task.eventTitle ? " · " : ""}${task.eventTitle ? task.eventTitle : ""}</small>` : ""}</label>
        </li>
      `
      )
      .join("");

    list.querySelectorAll("input[type='checkbox']").forEach((checkbox) => {
      checkbox.addEventListener("change", (event) => {
        const taskIndex = Number(event.target.dataset.taskIndex);
        const tasksList = getPersonalTasks();
        tasksList[taskIndex].done = event.target.checked;
        savePersonalTasks(tasksList);
      });
    });
  };

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const value = input.value.trim();
    if (!value) return;
    addPersonalTask({ title: value });
    input.value = "";
    renderTasks();
  });

  window.addEventListener("personalTasksUpdated", renderTasks);
  renderTasks();
}

function wireFloatingTodo() {
  if (document.getElementById("floating-task-form")) return;
  const main = document.getElementById("main");
  if (!main) return;

  const widget = document.createElement("aside");
  widget.className = "todo-sidebar is-collapsed";
  widget.setAttribute("aria-label", "Personal planner");
  widget.innerHTML = `
    <button type="button" class="todo-sidebar-toggle" id="todo-sidebar-toggle" aria-expanded="false" aria-controls="todo-sidebar-panel">
      <span class="todo-toggle-short">Planner</span>
      <span class="todo-toggle-count" id="todo-sidebar-count">0</span>
    </button>
    <div class="todo-sidebar-panel" id="todo-sidebar-panel">
      <div class="todo-sidebar-head">
        <div>
          <h2>My Planner</h2>
          <p id="todo-sidebar-progress">0 open tasks</p>
        </div>
        <button type="button" class="ghost-btn" id="todo-sidebar-close">Close</button>
      </div>
      <div id="todo-controls" style="display:flex;gap:0.5rem;align-items:center;margin-top:0.6rem;">
        <label style="display:flex;gap:0.35rem;align-items:center;font-size:0.9rem;">
          Window:
          <select id="todo-reminder-window" class="reminder-select">
            <option value="1">1d</option>
            <option value="3">3d</option>
            <option value="7" selected>7d</option>
            <option value="14">14d</option>
          </select>
        </label>
        <label style="display:flex;gap:0.35rem;align-items:center;font-size:0.9rem;">
          <input type="checkbox" id="todo-notify-toggle" /> Desktop
        </label>
      </div>
      <div class="todo-section" id="todo-upcoming-section">
        <div class="todo-section-head">
          <h3 class="todo-section-title">Upcoming Events</h3>
        </div>
        <ul id="todo-reminder-list" class="todo-list" style="margin-top:0.45rem;"></ul>
      </div>
      <div class="todo-section" id="todo-tasks-section">
        <div class="todo-section-head">
          <h3 class="todo-section-title">To-Do</h3>
        </div>
        <form id="floating-task-form" class="floating-task-form">
          <input id="floating-task-input" type="text" placeholder="Add a task" required />
          <button type="submit">Add</button>
        </form>
        <ul id="floating-task-list" class="todo-list"></ul>
      </div>
    </div>
  `;
  document.body.appendChild(widget);

  const toggle = document.getElementById("todo-sidebar-toggle");
  const close = document.getElementById("todo-sidebar-close");
  const count = document.getElementById("todo-sidebar-count");
  const progress = document.getElementById("todo-sidebar-progress");
  const form = document.getElementById("floating-task-form");
  const input = document.getElementById("floating-task-input");
  const list = document.getElementById("floating-task-list");
  const reminderList = document.getElementById("todo-reminder-list");

  const setExpanded = (expanded) => {
    widget.classList.toggle("is-collapsed", !expanded);
    toggle.setAttribute("aria-expanded", String(expanded));
    localStorage.setItem("todoSidebarExpanded", expanded ? "true" : "false");
    if (expanded) input.focus();
  };

  const renderTasks = () => {
    const tasks = getPersonalTasks().filter((t) => !t.done);
    const openTasks = tasks.length;
    count.textContent = String(openTasks);
    progress.textContent = `${openTasks} open task${openTasks === 1 ? "" : "s"}`;
    list.innerHTML = tasks
      .map(
        (task) => `
        <li data-task-id="${task.id}">
          <label><input type="checkbox" data-task-id="${task.id}" ${task.done ? "checked" : ""}> <span>${task.title}${task.dueDate ? `<small>Due ${task.dueDate}${task.eventTitle ? ` · ${task.eventTitle}` : ""}</small>` : ""}</span></label>
        </li>
      `
      )
      .join("");

    list.querySelectorAll("input[type='checkbox']").forEach((checkbox) => {
      checkbox.addEventListener("change", (event) => {
        if (!event.target.checked) return;
        const taskId = event.target.dataset.taskId;
        const li = event.target.closest("li");
        if (li) li.classList.add("is-removing");
        setTimeout(() => {
          const tasksList = getPersonalTasks().filter((t) => t.id !== taskId);
          savePersonalTasks(tasksList);
          renderTasks();
        }, 480);
      });
    });

    renderReminders();
  };

  toggle.addEventListener("click", () => setExpanded(widget.classList.contains("is-collapsed")));
  close.addEventListener("click", () => setExpanded(false));
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const value = input.value.trim();
    if (!value) return;
    addPersonalTask({ title: value });
    input.value = "";
    renderTasks();
  });

  const renderReminders = () => {
    if (!reminderList) return;
    const role = localStorage.getItem("calendarRole") || "agent";
    const windowDays = Number(localStorage.getItem("todoReminderWindow") || 7);
    const reminders = getUpcomingCalendarReminders(role, windowDays);
    reminderList.innerHTML = reminders
      .map((ev) => {
        const label = `${ev.date} · ${ev.title}`;
        return `<li><button type="button" class="ghost-btn" data-ev-id="${ev.id}" style="width:100%;text-align:left;padding:0.5rem;border:none;background:transparent;">${label}</button></li>`;
      })
      .join("");
    reminderList.querySelectorAll("button[data-ev-id]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = btn.dataset.evId;
        const role = localStorage.getItem("calendarRole") || "agent";
        const all = getCalendarEventsForView(role, { showPersonal: true, showAgency: true });
        let ev = all.find((e) => e.id && id && e.id === id);
        if (!ev) {
          const [datePart, ...rest] = btn.textContent.split(" · ");
          const titlePart = rest.join(" · ").trim();
          ev = all.find((e) => e.date === datePart && e.title === titlePart);
        }
        if (ev) openCalendarEventDialog(ev.date, [ev]);
        else openPersonalEventDialog(btn.textContent.split(" · ")[0]);
      });
    });
  };

  window.addEventListener("personalTasksUpdated", renderTasks);
  window.addEventListener("calendarEventAdded", (e) => {
    renderReminders();
    try {
      const role = localStorage.getItem("calendarRole") || "agent";
      const windowDays = Number(localStorage.getItem("todoReminderWindow") || 7);
      const upcoming = getUpcomingCalendarReminders(role, windowDays);
      notifyUpcomingEvents([...(e && e.detail && e.detail.event ? [e.detail.event] : []), ...upcoming]);
    } catch (err) {}
  });
  setExpanded(localStorage.getItem("todoSidebarExpanded") === "true");
  renderTasks();

  const windowSelect = document.getElementById("todo-reminder-window");
  const notifyToggle = document.getElementById("todo-notify-toggle");
  if (windowSelect) {
    windowSelect.value = localStorage.getItem("todoReminderWindow") || "7";
    windowSelect.addEventListener("change", () => {
      localStorage.setItem("todoReminderWindow", windowSelect.value);
      renderReminders();
    });
  }
  if (notifyToggle) {
    notifyToggle.checked = localStorage.getItem("todoNotifyEnabled") === "true";
    notifyToggle.addEventListener("change", () => {
      localStorage.setItem("todoNotifyEnabled", notifyToggle.checked ? "true" : "false");
      if (notifyToggle.checked) requestNotificationPermission();
    });
  }
}

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
    html += `<div class="cal-cell muted">Â·</div>`;
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
  const canManageAgency = userRole === "district";
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
    const canChooseSource = userRole === "district" && !isEdit;
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

  // Wire delete button (edit mode only)
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

  // Wire type buttons
  form.querySelectorAll("[data-type]").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      if (typeInput) typeInput.value = btn.dataset.type;
      form.querySelectorAll("[data-type]").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
    });
  });

  // Wire source toggle (district users)
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

  // Wire repeat select
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

  const canManage = userRole === "district";

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
    ? "You have District access and can add or edit agency-level events."
    : "Agency-level events are read-only. Only District users can add or edit.";
  form.style.display = canManage ? "grid" : "none";

  // Wire type buttons
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

  // Wire CSV/Excel import (district users only)
  const uploadInput = document.getElementById("agency-events-upload");
  const importBtn = document.getElementById("agency-events-import-btn");
  
  const parseCsv = (text) => {
    const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    const rows = [];
    for (let i = 0; i < lines.length; i++) {
      const parts = lines[i].split(",");
      // basic CSV: date,title,type,location,startTime,endTime
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
        // Check if column 0 is a month name
        const monthIndex = monthNames.findIndex((m) => col0.toLowerCase().includes(m.toLowerCase()));
        if (monthIndex !== -1) {
          currentMonth = monthIndex + 1;
          return;
        }
        // If column 0 is a number and column 1 has text, it's a day + event
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

if (isOverviewPage()) {
  wireLeadFilters();
  wireRoleControl();
  wirePersonalTodo();
  wireFloatingTodo();
}

function wireOverviewPdfExport() {
  const btn = document.getElementById("overview-download-pdf-btn");
  if (!btn) return;

  btn.addEventListener("click", () => {
    // Use native browser print flow for a simple, reliable Save-to-PDF action.
    window.print();
  });
}

if (isHomeDashboardPage()) {
  wireOverviewTabs();
  wireOverviewPdfExport();
  wireRoleControl();
  wirePersonalTodo();
  wireFloatingTodo();
}

if (isCalendarPage()) {
  wireCalendarPage();
}

wireFloatingTodo();



// Production Report

function wireProductionReport() {
  var input = document.getElementById("production-file-input");
  if (!input) return;
  input.addEventListener("change", function(e) {
    var file = e.target.files[0];
    if (!file) return;
    var reader = new FileReader();
    reader.onload = function(ev) {
      try {
        var wb = XLSX.read(ev.target.result, { type: "array" });
        var ws = wb.Sheets["Summary"] || wb.Sheets[wb.SheetNames[0]];
        renderProductionViz(ws, file.name);
      } catch (err) {
        document.getElementById("production-report-content").innerHTML =
          "<p class='prod-placeholder' style='color:var(--brand)'>Could not parse file: " + err.message + "</p>";
      }
    };
    reader.readAsArrayBuffer(file);
  });
}

function renderProductionViz(ws, fileName) {
  var content = document.getElementById("production-report-content");
  var label   = document.getElementById("production-report-label");
  if (!content) return;

  var range = XLSX.utils.decode_range(ws["!ref"] || "A1");

  function cellVal(col, row) {
    var cell = ws[XLSX.utils.encode_cell({ c: col, r: row })];
    return cell ? cell.v : "";
  }
  function toNum(v) { return parseFloat(v) || 0; }
  function fmtK(v) {
    if (v >= 1000000) return (v / 1000000).toFixed(1) + "M";
    if (v >= 1000)    return (v / 1000).toFixed(1) + "K";
    return String(Math.round(v));
  }

  // Parse agents — forward-fill agency name (col A is blank for rows after first in group)
  var agents = [];
  var lastAgency = "";
  for (var row = 2; row <= range.e.r; row++) {
    var agtNm = String(cellVal(1, row)).trim();  // col B
    if (!agtNm) continue;
    var agyCel = String(cellVal(0, row)).trim();  // col A
    if (agyCel) lastAgency = agyCel;
    agents.push({
      agency:   lastAgency,
      name:     agtNm,
      mtdFyc:   toNum(cellVal(2, row)),
      mtdCases: toNum(cellVal(3, row)),
      ytdFyc:   toNum(cellVal(4, row)),
      ytdFyp:   toNum(cellVal(5, row)),
      ytdCases: toNum(cellVal(6, row)),
      target:   toNum(cellVal(7, row)),
      todo:     toNum(cellVal(8, row))
    });
  }

  if (!agents.length) {
    content.innerHTML = "<p class='prod-placeholder'>No agent rows found. Make sure data starts on row 3 with agent names in column B.</p>";
    return;
  }

  // Build agency list for dropdown
  var agencies = ["All"];
  agents.forEach(function(r) {
    if (r.agency && agencies.indexOf(r.agency) === -1) agencies.push(r.agency);
  });

  if (label) label.textContent = agents.length + " agents \u00b7 " + agencies.length - 1 + " agencies \u00b7 " + fileName;

  // Render shell with dropdown
  content.innerHTML =
    "<div class='prod-toolbar'>" +
      "<label class='prod-filter-label'>Agency</label>" +
      "<select id='prod-agency-select' class='prod-agency-select'>" +
        agencies.map(function(a) { return "<option value='" + a + "'>" + a + "</option>"; }).join("") +
      "</select>" +
    "</div>" +
    "<div id='prod-viz-body'></div>";

  function renderForAgency(selected) {
    var filtered = selected === "All" ? agents : agents.filter(function(r) { return r.agency === selected; });
    var body = document.getElementById("prod-viz-body");
    if (!body) return;

    var totalYtdFyc = filtered.reduce(function(s,r){ return s + r.ytdFyc; }, 0);
    var totalMtdFyc = filtered.reduce(function(s,r){ return s + r.mtdFyc; }, 0);
    var totalYtdCas = filtered.reduce(function(s,r){ return s + r.ytdCases; }, 0);
    var totalMtdCas = filtered.reduce(function(s,r){ return s + r.mtdCases; }, 0);

    var byFyc  = filtered.slice().sort(function(a,b){ return b.ytdFyc - a.ytdFyc; });
    var byCas  = filtered.slice().sort(function(a,b){ return b.ytdCases - a.ytdCases; });
    var maxFyc = byFyc.length ? (byFyc[0].ytdFyc || 1) : 1;
    var maxCas = byCas.length ? (byCas[0].ytdCases || 1) : 1;

    var colors = ["#a6192e","#c69a67","#4a4a4a","#e8a020","#38bdf8","#9b2f91"];

    function hbar(sorted, getVal, maxVal, fmt) {
      return sorted.map(function(r, i) {
        var v   = getVal(r);
        var pct = Math.max(4, Math.round((v / maxVal) * 100));
        return "<div class='prod-hbar-row'>" +
          "<span class='prod-hbar-label'>" + r.name + "</span>" +
          "<div class='prod-hbar-track'><div class='prod-hbar-fill' style='width:" + pct + "%;background:" + colors[i % colors.length] + "'></div></div>" +
          "<span class='prod-hbar-val'>" + fmt(v) + "</span>" +
        "</div>";
      }).join("");
    }

    var targetSection = "";
    if (filtered.some(function(r){ return r.target > 0; })) {
      targetSection =
        "<div class='prod-chart-panel prod-target-panel'>" +
          "<p class='prod-chart-title'>&#127919; Target Progress &mdash; YTD FYC vs Target</p>" +
          filtered.map(function(r) {
            var pct   = r.target > 0 ? Math.min(100, Math.round((r.ytdFyc / r.target) * 100)) : 0;
            var color = pct >= 80 ? "#16a34a" : pct >= 50 ? "#e8a020" : "#a6192e";
            return "<div class='prod-target-row'>" +
              "<div class='prod-target-meta'>" +
                "<span class='prod-target-name'>" + r.name + "</span>" +
                "<span class='prod-target-nums'>" +
                  fmtK(r.ytdFyc) + " / " + fmtK(r.target) +
                  " &nbsp;&middot;&nbsp; <span style='color:" + color + "'>" + pct + "%</span>" +
                  (r.todo > 0 ? " &nbsp;&middot;&nbsp; <span class='prod-todo'>To do: " + fmtK(r.todo) + "</span>" : "") +
                "</span>" +
              "</div>" +
              "<div class='prod-hbar-track'><div class='prod-hbar-fill' style='width:" + pct + "%;background:" + color + "'></div></div>" +
            "</div>";
          }).join("") +
        "</div>";
    }

    // When "All" is selected, also show per-agency summary cards
    var agencySummary = "";
    if (selected === "All") {
      agencySummary = "<div class='prod-agency-summary'>" +
        agencies.filter(function(a){ return a !== "All"; }).map(function(agency) {
          var grp = agents.filter(function(r){ return r.agency === agency; });
          var aFyc = grp.reduce(function(s,r){ return s + r.ytdFyc; }, 0);
          var aCas = grp.reduce(function(s,r){ return s + r.ytdCases; }, 0);
          var aTgt = grp.reduce(function(s,r){ return s + r.target; }, 0);
          var aPct = aTgt > 0 ? Math.min(100, Math.round((aFyc / aTgt) * 100)) : 0;
          var aColor = aPct >= 80 ? "#16a34a" : aPct >= 50 ? "#e8a020" : "#a6192e";
          return "<div class='prod-agency-card'>" +
            "<p class='prod-agency-card-name'>" + agency + "</p>" +
            "<div class='prod-agency-card-stats'>" +
              "<span><strong>" + fmtK(aFyc) + "</strong><small>YTD FYC</small></span>" +
              "<span><strong>" + aCas + "</strong><small>Cases</small></span>" +
              "<span><strong style='color:" + aColor + "'>" + aPct + "%</strong><small>vs Target</small></span>" +
            "</div>" +
            "<div class='prod-hbar-track' style='margin-top:0.5rem'><div class='prod-hbar-fill' style='width:" + aPct + "%;background:" + aColor + "'></div></div>" +
          "</div>";
        }).join("") +
      "</div>";
    }

    body.innerHTML =
      "<div class='prod-kpi-row'>" +
        "<div class='prod-kpi'><span>YTD FYC</span><strong>" + fmtK(totalYtdFyc) + "</strong></div>" +
        "<div class='prod-kpi'><span>MTD FYC (Apr)</span><strong>" + fmtK(totalMtdFyc) + "</strong></div>" +
        "<div class='prod-kpi'><span>YTD Cases</span><strong>" + totalYtdCas + "</strong></div>" +
        "<div class='prod-kpi'><span>MTD Cases (Apr)</span><strong>" + totalMtdCas + "</strong></div>" +
      "</div>" +
      agencySummary +
      "<div class='prod-charts-grid'>" +
        "<div class='prod-chart-panel'>" +
          "<p class='prod-chart-title'>&#127942; Top YTD FYC</p>" +
          hbar(byFyc, function(r){ return r.ytdFyc; }, maxFyc, fmtK) +
        "</div>" +
        "<div class='prod-chart-panel'>" +
          "<p class='prod-chart-title'>&#128203; Top Cases Closed (YTD)</p>" +
          hbar(byCas, function(r){ return r.ytdCases; }, maxCas, function(v){ return v; }) +
        "</div>" +
      "</div>" +
      targetSection;
  }

  document.getElementById("prod-agency-select").addEventListener("change", function() {
    renderForAgency(this.value);
  });

  renderForAgency("All");
}

if (isHomeDashboardPage()) {
  wireProductionReport();
}
