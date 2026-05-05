const leadData = [
  {
    id: 1,
    name: "John Smith",
    age: 34,
    contactProfile: "john.smith@email.com | +63 917 100 1122",
    meetupDate: "2026-05-06",
    meetupLocation: "Makati Office",
    meetingType: "F2F",
    urgency: "Urgent",
    remarks: "Could not close the deal on first meeting. Requested revised premium options.",
    planType: "Life Insurance - Term",
    premium: 120000,
    commissionType: "Upfront",
    stage: "Negotiation",
    owner: "agent"
  },
  {
    id: 2,
    name: "Sarah Johnson",
    age: 42,
    contactProfile: "sarah.j@email.com | +63 917 200 3344",
    meetupDate: "2026-05-08",
    meetupLocation: "Online - Teams",
    meetingType: "Non-F2F",
    urgency: "Non-Urgent",
    remarks: "Requested policy comparison with family package.",
    planType: "Health Insurance - Family",
    premium: 98000,
    commissionType: "Recurring",
    stage: "Qualified",
    owner: "agent"
  },
  {
    id: 3,
    name: "Michael Chen",
    age: 29,
    contactProfile: "m.chen@email.com | +63 917 300 5566",
    meetupDate: "2026-05-10",
    meetupLocation: "BGC Cafe",
    meetingType: "F2F",
    urgency: "Urgent",
    remarks: "Strong intent to sign by next week after discussing riders.",
    planType: "Auto Insurance - Premium",
    premium: 76000,
    commissionType: "Tiered",
    stage: "Proposal Sent",
    owner: "agent"
  },
  {
    id: 4,
    name: "Emma Davis",
    age: 38,
    contactProfile: "emma.d@email.com | +63 917 400 7788",
    meetupDate: "2026-05-18",
    meetupLocation: "District Office",
    meetingType: "F2F",
    urgency: "Non-Urgent",
    remarks: "Follow-up required after spouse review.",
    planType: "Property Insurance",
    premium: 142000,
    commissionType: "Upfront",
    stage: "Follow-up",
    owner: "district"
  },
  {
    id: 5,
    name: "Noah Wilson",
    age: 46,
    contactProfile: "nwilson@email.com | +63 917 500 9988",
    meetupDate: "2026-05-21",
    meetupLocation: "Online - Zoom",
    meetingType: "Non-F2F",
    urgency: "Urgent",
    remarks: "Appointment set to finalize terms and payment channel.",
    planType: "Life Insurance - Whole",
    premium: 186000,
    commissionType: "Hybrid",
    stage: "Closing",
    owner: "district"
  }
];

const districtEventsSeed = [
  { id: "agency-1", date: "2026-05-12", title: "District Training Session", type: "District Event" },
  { id: "agency-2", date: "2026-05-25", title: "District Sales Review", type: "District Event" }
];
const AGENCY_EVENTS_STORAGE_KEY = "agencyEvents";
const PERSONAL_EVENTS_STORAGE_KEY = "personalEvents";

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
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    maximumFractionDigits: 0
  }).format(value);
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

function addPersonalEvent(payload) {
  const { date, title, startTime = "", endTime = "", location = "", notes = "" } = payload;
  const events = getPersonalEvents();
  events.push({
    id: `personal-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    date,
    title,
    startTime,
    endTime,
    location,
    notes
  });
  savePersonalEvents(events);
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
      date: lead.meetupDate,
      title: `${lead.name} · ${lead.meetingType} Meet-up`,
      type: "Personal Appointment",
      category: "personal",
      editable: false
    }));
  const personalCustomEvents = getPersonalEvents().map((event) => ({
    ...event,
    type: "Personal Event",
    category: "personal",
    editable: true
  }));

  const agencyMeetups = getAgencyEvents().map((event) => ({
    ...event,
    type: "Agency Event",
    category: "agency"
  }));

  const events = [];
  if (options.showPersonal) events.push(...personalLeads, ...personalCustomEvents);
  if (options.showAgency) events.push(...agencyMeetups);
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
        <p><strong>Plan & Premium:</strong> ${lead.planType} · ${money(lead.premium)}</p>
      `;
      dialog.showModal();
    });
  });
  closeButton.onclick = () => dialog.close();
}

function wireLeadFilters() {
  const filterInput = document.getElementById("lead-date-filter");
  const sortSelect = document.getElementById("lead-sort-select");
  if (!filterInput || !sortSelect) return;

  const update = () => {
    const dateFilter = filterInput.value;
    const sortDirection = sortSelect.value;
    let filtered = [...leadData];
    if (dateFilter) {
      filtered = filtered.filter((lead) => lead.meetupDate === dateFilter);
    }
    filtered.sort((a, b) =>
      sortDirection === "asc" ? a.meetupDate.localeCompare(b.meetupDate) : b.meetupDate.localeCompare(a.meetupDate)
    );
    renderLeadTable(filtered);
    renderClosureTable(filtered);
    renderSalesPerformance(filtered);
    updatePremiumSummary(filtered);
    updateLeadSummary(filtered);
    wireLeadDetailDialog(filtered);
  };

  filterInput.addEventListener("change", update);
  sortSelect.addEventListener("change", update);
  update();
}

function renderOverviewCards() {
  updateLeadSummary(leadData);
  updatePremiumSummary(leadData);
  renderClosureTable(leadData);
  renderSalesPerformance(leadData);
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

  const getTasks = () => JSON.parse(localStorage.getItem("personalTasks") || "[]");
  const saveTasks = (tasks) => localStorage.setItem("personalTasks", JSON.stringify(tasks));

  const renderTasks = () => {
    const tasks = getTasks();
    list.innerHTML = tasks
      .map(
        (task, index) => `
        <li>
          <label><input type="checkbox" data-task-index="${index}" ${task.done ? "checked" : ""}> ${task.title}</label>
        </li>
      `
      )
      .join("");

    list.querySelectorAll("input[type='checkbox']").forEach((checkbox) => {
      checkbox.addEventListener("change", (event) => {
        const taskIndex = Number(event.target.dataset.taskIndex);
        const tasksList = getTasks();
        tasksList[taskIndex].done = event.target.checked;
        saveTasks(tasksList);
      });
    });
  };

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const value = input.value.trim();
    if (!value) return;
    const tasks = getTasks();
    tasks.unshift({ title: value, done: false });
    saveTasks(tasks);
    input.value = "";
    renderTasks();
  });

  renderTasks();
}

function renderCalendar(currentDate, role, viewOptions) {
  const grid = document.getElementById("calendar-grid");
  const monthLabel = document.getElementById("calendar-month-label");
  const reminderList = document.getElementById("calendar-reminder-list");
  if (!grid || !monthLabel || !reminderList) return;

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  monthLabel.textContent = currentDate.toLocaleString("en-US", { month: "long", year: "numeric" });

  const events = getLeadEvents(role, viewOptions);
  const eventMap = events.reduce((map, event) => {
    if (!map.has(event.date)) map.set(event.date, []);
    map.get(event.date).push(event);
    return map;
  }, new Map());

  const heads = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  let html = heads.map((day) => `<div class="cal-head">${day}</div>`).join("");
  for (let i = 0; i < firstDay; i += 1) {
    html += `<div class="cal-cell muted">·</div>`;
  }
  for (let day = 1; day <= daysInMonth; day += 1) {
    const dateString = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    const dailyEvents = eventMap.get(dateString) || [];
    const hasEvents = dailyEvents.length > 0;
    html += `
      <div class="cal-cell ${hasEvents ? "has-event" : ""} cal-cell-clickable" data-date="${dateString}" role="button" tabindex="0" aria-label="Open events for ${dateString}">
        <span class="pill ${hasEvents ? "highlight" : ""}">${day}</span>
        ${
          hasEvents
            ? dailyEvents
                .map((event) => `<small class="event-tag ${event.category}">${event.category === "personal" ? "Personal" : "Agency"}</small>`)
                .join("")
            : ""
        }
      </div>
    `;
  }
  grid.innerHTML = html;

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

function wireCalendarPage() {
  const prevBtn = document.getElementById("prev-month-btn");
  const nextBtn = document.getElementById("next-month-btn");
  const personalCheckbox = document.getElementById("calendar-show-personal");
  const agencyCheckbox = document.getElementById("calendar-show-agency");
  if (!prevBtn || !nextBtn || !personalCheckbox || !agencyCheckbox) return;
  const role = localStorage.getItem("calendarRole") || "agent";
  const userRole = sessionStorage.getItem("dashboardRole") || "agent";
  const state = { viewDate: new Date(2026, 4, 1), showPersonal: true, showAgency: false, selectedDate: null };

  const update = () => {
    renderCalendar(state.viewDate, role, state);
    wireCalendarDateClicks(state);
  };
  const syncViewToggles = () => {
    state.showPersonal = personalCheckbox.checked;
    state.showAgency = agencyCheckbox.checked;
    if (!state.showPersonal && !state.showAgency) {
      state.showPersonal = true;
      personalCheckbox.checked = true;
    }
    update();
  };
  personalCheckbox.addEventListener("change", syncViewToggles);
  agencyCheckbox.addEventListener("change", syncViewToggles);
  prevBtn.addEventListener("click", () => {
    state.viewDate.setMonth(state.viewDate.getMonth() - 1);
    update();
  });
  nextBtn.addEventListener("click", () => {
    state.viewDate.setMonth(state.viewDate.getMonth() + 1);
    update();
  });

  wirePersonalEventDialog(state, update);
  wireAgencyEventManager(userRole, update);
  update();
}

function wireCalendarDateClicks(state) {
  document.querySelectorAll(".cal-cell-clickable[data-date]").forEach((cell) => {
    const openForCell = () => {
      state.selectedDate = cell.dataset.date;
      openPersonalEventDialog(state.selectedDate);
    };

    cell.addEventListener("click", openForCell);
    cell.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        openForCell();
      }
    });
  });
}

function openPersonalEventDialog(date) {
  const dialog = document.getElementById("personal-event-dialog");
  const dateInput = document.getElementById("personal-event-dialog-date");
  const titleInput = document.getElementById("personal-event-dialog-title");
  const startTimeInput = document.getElementById("personal-event-dialog-start-time");
  const endTimeInput = document.getElementById("personal-event-dialog-end-time");
  const locationInput = document.getElementById("personal-event-dialog-location");
  const notesInput = document.getElementById("personal-event-dialog-notes");
  if (!dialog || !dateInput || !titleInput || !startTimeInput || !endTimeInput || !locationInput || !notesInput || !date) return;
  dateInput.value = date;
  titleInput.value = "";
  startTimeInput.value = "";
  endTimeInput.value = "";
  locationInput.value = "";
  notesInput.value = "";
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
  if (!dialog || !form || !closeBtn || !dateInput || !titleInput || !startTimeInput || !endTimeInput || !locationInput || !notesInput) return;

  closeBtn.addEventListener("click", () => dialog.close());
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const date = dateInput.value;
    const title = titleInput.value.trim();
    const startTime = startTimeInput.value;
    const endTime = endTimeInput.value;
    const location = locationInput.value.trim();
    const notes = notesInput.value.trim();
    if (!date || !title || !startTime || !endTime) return;
    addPersonalEvent({ date, title, startTime, endTime, location, notes });
    state.selectedDate = date;
    dialog.close();
    refreshCalendar();
  });
}

function wireAgencyEventManager(userRole, refreshCalendar) {
  const form = document.getElementById("agency-event-form");
  const dateInput = document.getElementById("agency-event-date");
  const titleInput = document.getElementById("agency-event-title");
  const editIdInput = document.getElementById("agency-event-edit-id");
  const submitBtn = document.getElementById("agency-event-submit-btn");
  const cancelBtn = document.getElementById("agency-event-cancel-btn");
  const list = document.getElementById("agency-events-editor-list");
  const accessNote = document.getElementById("agency-events-access-note");
  if (!form || !dateInput || !titleInput || !editIdInput || !submitBtn || !cancelBtn || !list || !accessNote) return;

  const canManage = userRole === "district";

  const setEditMode = (eventItem) => {
    if (!eventItem) {
      editIdInput.value = "";
      dateInput.value = "";
      titleInput.value = "";
      submitBtn.textContent = "Add Event";
      return;
    }
    editIdInput.value = eventItem.id;
    dateInput.value = eventItem.date;
    titleInput.value = eventItem.title;
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
            <p class="activity-desc">Agency-level event</p>
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
  form.style.display = canManage ? "flex" : "none";

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    if (!canManage) return;
    const date = dateInput.value;
    const title = titleInput.value.trim();
    if (!date || !title) return;

    const events = getAgencyEvents();
    const editingId = editIdInput.value;
    if (editingId) {
      const updated = events.map((item) => (item.id === editingId ? { ...item, date, title } : item));
      saveAgencyEvents(updated);
    } else {
      events.push({ id: `agency-${Date.now()}`, date, title, type: "Agency Event" });
      saveAgencyEvents(events);
    }

    setEditMode(null);
    renderEditorList();
    refreshCalendar();
  });

  cancelBtn.addEventListener("click", () => setEditMode(null));

  renderEditorList();
}

if (isOverviewPage()) {
  wireLeadFilters();
  wireRoleControl();
  wirePersonalTodo();
}

if (isHomeDashboardPage()) {
  renderOverviewCards();
  wireRoleControl();
  wirePersonalTodo();
}

if (isCalendarPage()) {
  wireCalendarPage();
}
