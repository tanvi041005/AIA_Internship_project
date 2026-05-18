(async function () {
  var params = new URLSearchParams(window.location.search);
  var eventId = params.get("eventId") || "";
  var checkInToken = params.get("token") || "";
  var openedFromQr = params.get("checkIn") === "qr" && !!eventId && !!checkInToken;
  var signedInRole = sessionStorage.getItem("dashboardRole");
  if (!signedInRole) return;

  if (typeof apiGet !== "function" || typeof apiPost !== "function") {
    console.error("Attendance requires the API helpers to be loaded.");
    return;
  }

  var user = (sessionStorage.getItem("dashboardUser") || "User").toUpperCase();
  var role = signedInRole;
  var isHostView = role === "admin" || role === "leader";
  var roleLabels = { agent: "Agent", leader: "Agency Leader", admin: "Admin Super User" };
  var attendanceEvents = [];
  var attendanceRecords = [];

  function toDateOnly(value) {
    if (!value) return "";
    if (/^\d{4}-\d{2}-\d{2}$/.test(String(value))) return String(value);
    var d = new Date(value);
    if (isNaN(d.getTime())) return String(value).slice(0, 10);
    return d.toLocaleDateString("en-CA", { timeZone: "Asia/Singapore" });
  }

  function toTimeOnly(value) {
    return value ? String(value).slice(0, 5) : "";
  }

  function mapAttendanceEvent(r) {
    return {
      id: r.event_id || r.id || "",
      title: r.title || "Calendar Event",
      date: toDateOnly(r.event_date || r.date),
      startTime: toTimeOnly(r.start_time || r.startTime),
      endTime: toTimeOnly(r.end_time || r.endTime),
      location: r.location || "",
      type: r.event_type || r.type || "Calendar Event",
      category: r.category || "agency",
      attendanceToken: r.attendance_token || r.attendanceToken || ""
    };
  }

  function mergeEvents(calendarRows, attendanceRows) {
    var byId = {};
    (Array.isArray(calendarRows) ? calendarRows : []).forEach(function (row) {
      var eventItem = mapAttendanceEvent(row);
      if (eventItem.id && eventItem.category !== "holiday") byId[eventItem.id] = eventItem;
    });
    (Array.isArray(attendanceRows) ? attendanceRows : []).forEach(function (row) {
      var eventItem = mapAttendanceEvent(row);
      if (!eventItem.id) return;
      byId[eventItem.id] = Object.assign({}, byId[eventItem.id] || {}, eventItem);
    });
    return Object.keys(byId).map(function (id) { return byId[id]; });
  }

  function mapAttendanceRecord(r) {
    return {
      id: r.record_id || r.id || "",
      eventId: r.event_id || r.eventId || "",
      eventTitle: r.event_title || r.eventTitle || "",
      userId: String(r.user_id || r.userId || "").toUpperCase(),
      role: r.role || "agent",
      checkInTime: r.check_in_time || r.checkInTime || "",
      status: r.status || "Present"
    };
  }

  function formatDate(value) {
    if (!value) return "-";
    var date = new Date(value + "T00:00:00");
    return new Intl.DateTimeFormat("en-SG", { day: "2-digit", month: "short", year: "numeric" }).format(date);
  }

  function formatDateTime(value) {
    if (!value) return "-";
    return new Intl.DateTimeFormat("en-SG", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    }).format(new Date(value));
  }

  function escapeHtml(value) {
    var node = document.createElement("div");
    node.textContent = String(value || "");
    return node.innerHTML;
  }

  function getEvents() {
    return attendanceEvents;
  }

  function getRecords() {
    return attendanceRecords;
  }

  function selectedEvent() {
    var events = getEvents();
    return events.find(function (item) { return item.id === eventId; }) || getAutoSelectedEvent(events);
  }

  function eventWindow(eventItem) {
    var date = eventItem && eventItem.date ? eventItem.date : new Date().toISOString().slice(0, 10);
    var startTime = eventItem && eventItem.startTime ? eventItem.startTime : "09:00";
    var start = new Date(date + "T" + startTime + ":00");
    var end = eventItem && eventItem.endTime
      ? new Date(date + "T" + eventItem.endTime + ":00")
      : new Date(start.getTime() + 2 * 60 * 60 * 1000);
    return { start: start, end: end };
  }

  function getAutoSelectedEvent(events) {
    var now = new Date();
    var withWindows = events.map(function (item) {
      var window = eventWindow(item);
      return { event: item, start: window.start, end: window.end };
    }).filter(function (item) {
      return !isNaN(item.start.getTime());
    });
    var current = withWindows
      .filter(function (item) { return item.start <= now && item.end >= now; })
      .sort(function (a, b) { return a.start - b.start; })[0];
    if (current) return current.event;
    var upcoming = withWindows
      .filter(function (item) { return item.start >= now; })
      .sort(function (a, b) { return a.start - b.start; })[0];
    if (upcoming) return upcoming.event;
    return withWindows.sort(function (a, b) { return b.start - a.start; })[0]?.event || null;
  }

  async function saveAttendanceEvent(eventItem) {
    if (!eventItem) return null;
    var token = eventItem.attendanceToken || ("qr-" + Date.now() + "-" + Math.floor(Math.random() * 100000));
    var normalized = {
      id: eventItem.id,
      title: eventItem.title || "Calendar Event",
      event_date: eventItem.date || "",
      start_time: eventItem.startTime || null,
      end_time: eventItem.endTime || null,
      location: eventItem.location || null,
      type: eventItem.type || "Calendar Event",
      category: eventItem.category || "agency",
      attendanceToken: token,
      createdBy: user
    };
    var saved = await apiPost("/attendance-events", normalized);
    var merged = Object.assign({}, eventItem, {
      attendanceToken: saved.attendance_token || saved.attendanceToken || token
    });
    var idx = attendanceEvents.findIndex(function (item) { return item.id === merged.id; });
    if (idx === -1) attendanceEvents.unshift(merged);
    else attendanceEvents[idx] = Object.assign({}, attendanceEvents[idx], merged);
    return merged;
  }

  function canCheckIn(eventItem) {
    return !!(openedFromQr && eventItem && eventItem.id === eventId && eventItem.attendanceToken === checkInToken);
  }

  function statusForCheckIn(eventItem, checkedAt) {
    if (!eventItem || !eventItem.date || !eventItem.startTime) return "Present";
    var start = new Date(eventItem.date + "T" + eventItem.startTime + ":00");
    return checkedAt > start ? "Late" : "Present";
  }

  function renderUserMeta() {
    document.getElementById("attendance-current-user").textContent = user;
    document.getElementById("attendance-current-role").textContent = roleLabels[role] || "User";
  }

  function renderRoleView() {
    var attendeePanel = document.querySelector(".attendance-checkin-panel");
    var hostPanel = document.querySelector(".attendance-host-panel");
    var grid = document.querySelector(".attendance-grid");
    var pageTitle = document.querySelector(".attendance-hero .page-title");
    var pageLede = document.querySelector(".attendance-hero .page-lede");
    if (attendeePanel) attendeePanel.hidden = isHostView;
    if (hostPanel) hostPanel.hidden = !isHostView;
    if (grid) {
      grid.classList.toggle("is-host-view", isHostView);
      grid.classList.toggle("is-attendee-view", !isHostView);
    }
    if (pageTitle) pageTitle.textContent = isHostView ? "Presenter Attendance View" : "Attendee Check-in";
    if (pageLede) {
      pageLede.textContent = isHostView
        ? "The admin host view automatically selects the current or next database attendance event and generates the attendance QR."
        : "Agents can only check in after scanning the host QR and signing in.";
    }
  }

  function renderEvent() {
    var eventItem = selectedEvent();
    var btn = document.getElementById("attendance-checkin-btn");
    if (!eventItem) {
      btn.disabled = true;
      document.getElementById("attendance-event-label").textContent = "No attendance-enabled event found in the database.";
      return;
    }
    document.getElementById("attendance-event-label").textContent = canCheckIn(eventItem) ? "Opened from attendance QR link." : "Scan the host QR code to check in.";
    document.getElementById("attendance-event-type").textContent = eventItem.type || "Calendar Event";
    document.getElementById("attendance-event-title").textContent = eventItem.title || "Calendar Event";
    document.getElementById("attendance-event-date").textContent = formatDate(eventItem.date);
    document.getElementById("attendance-event-time").textContent = eventItem.startTime ? (eventItem.startTime + (eventItem.endTime ? " - " + eventItem.endTime : "")) : "Time not set";
    document.getElementById("attendance-event-location").textContent = eventItem.location || "Location not set";
    btn.disabled = !canCheckIn(eventItem);
    btn.textContent = canCheckIn(eventItem) ? "Check in now" : "Scan QR to check in";
    var hostLabel = document.getElementById("attendance-host-event-label");
    if (hostLabel) hostLabel.textContent = "Auto-selected: " + (eventItem.title || "Calendar Event") + " - " + formatDate(eventItem.date);
  }

  function buildCheckInUrl(eventItem) {
    var params = new URLSearchParams({
      eventId: eventItem.id,
      checkIn: "qr",
      token: eventItem.attendanceToken
    });
    return "attendance.html?" + params.toString();
  }

  function drawQr(canvas, value) {
    if (!window.QRCode) {
      throw new Error("QR code library failed to load");
    }
    var holder = document.createElement("div");
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

    var generatedCanvas = holder.querySelector("canvas");
    var ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (generatedCanvas) {
      ctx.drawImage(generatedCanvas, 0, 0, canvas.width, canvas.height);
      holder.remove();
      return Promise.resolve();
    }

    var img = holder.querySelector("img");
    return new Promise(function (resolve, reject) {
      if (!img) {
        holder.remove();
        reject(new Error("QR code image was not generated"));
        return;
      }
      img.onload = function () {
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        holder.remove();
        resolve();
      };
      img.onerror = function () {
        holder.remove();
        reject(new Error("QR code image failed to render"));
      };
    });
  }

  async function renderHostQr(eventItem) {
    var dialog = document.getElementById("attendance-qr-fullscreen");
    var canvas = document.getElementById("attendance-host-qr-canvas");
    var title = document.getElementById("attendance-host-qr-title");
    var link = document.getElementById("attendance-host-qr-link");
    if (!dialog || !canvas || !title || !link || !eventItem) return;
    try {
      var saved = await saveAttendanceEvent(eventItem);
      var url = buildCheckInUrl(saved);
      var absoluteUrl = new URL(url, window.location.href).href;
      title.textContent = saved.title + " - " + formatDate(saved.date);
      link.href = url;
      await drawQr(canvas, absoluteUrl);
      dialog.showModal();
    } catch (error) {
      alert("Could not create attendance QR in the database: " + (error.message || error));
    }
  }

  function renderSelector() {
    var eventItem = selectedEvent();
    if (eventItem && !eventId) eventId = eventItem.id;
  }

  function renderRecords() {
    var eventItem = selectedEvent();
    var eventFilter = eventItem ? eventItem.id : "";
    var events = getEvents();
    var eventMap = events.reduce(function (map, item) {
      map[item.id] = item.title || item.id;
      return map;
    }, {});
    var rows = getRecords().filter(function (record) { return !eventFilter || record.eventId === eventFilter; });
    document.getElementById("attendance-total-count").textContent = String(rows.length);
    document.getElementById("attendance-present-count").textContent = String(rows.filter(function (row) { return row.status === "Present"; }).length);
    document.getElementById("attendance-late-count").textContent = String(rows.filter(function (row) { return row.status === "Late"; }).length);
    document.getElementById("attendance-records-body").innerHTML = rows.length
      ? rows.map(function (record) {
          return "<tr>" +
            "<td><strong>" + escapeHtml(record.userId) + "</strong></td>" +
            "<td>" + escapeHtml(roleLabels[record.role] || record.role || "User") + "</td>" +
            "<td>" + escapeHtml(eventMap[record.eventId] || record.eventTitle || record.eventId) + "</td>" +
            "<td>" + formatDateTime(record.checkInTime) + "</td>" +
            "<td><span class=\"status-pill " + (record.status === "Late" ? "urgent" : "non-urgent") + "\">" + escapeHtml(record.status) + "</span></td>" +
          "</tr>";
        }).join("")
      : '<tr><td colspan="5" class="muted-text">No attendance recorded for this event yet.</td></tr>';
  }

  async function reloadRecords(eventFilter) {
    var path = "/attendance-records" + (eventFilter ? "?eventId=" + encodeURIComponent(eventFilter) : "");
    var raw = await apiGet(path);
    attendanceRecords = Array.isArray(raw) ? raw.map(mapAttendanceRecord) : [];
  }

  async function checkIn() {
    var eventItem = selectedEvent();
    if (!eventItem) return;
    if (!canCheckIn(eventItem)) {
      document.getElementById("attendance-checkin-message").textContent = "Check-in is locked. Please scan the host's QR code for this event.";
      return;
    }
    var existing = getRecords().find(function (record) {
      return record.eventId === eventItem.id && record.userId === user;
    });
    var message = document.getElementById("attendance-checkin-message");
    var pill = document.getElementById("attendance-status-pill");
    if (existing) {
      message.textContent = "Already checked in at " + formatDateTime(existing.checkInTime) + ".";
      pill.textContent = existing.status;
      pill.className = "status-pill " + (existing.status === "Late" ? "urgent" : "non-urgent");
      renderRecords();
      return;
    }

    var now = new Date();
    var status = statusForCheckIn(eventItem, now);
    var record = {
      record_id: ("att-" + eventItem.id + "-" + user).replace(/[^A-Z0-9_-]/gi, "-").slice(0, 120),
      event_id: eventItem.id,
      event_title: eventItem.title,
      user_id: user,
      role: role,
      check_in_time: now.toISOString(),
      status: status
    };

    try {
      await apiPost("/attendance-records", record);
      await reloadRecords(eventItem.id);
      message.textContent = "Attendance recorded for " + user + " at " + formatDateTime(now.toISOString()) + ".";
      pill.textContent = status;
      pill.className = "status-pill " + (status === "Late" ? "urgent" : "non-urgent");
      renderRecords();
    } catch (error) {
      message.textContent = "Could not record attendance in the database. Please try again.";
    }
  }

  try {
    var loaded = await Promise.all([
      apiGet("/events"),
      apiGet("/attendance-events")
    ]);
    attendanceEvents = mergeEvents(loaded[0], loaded[1]);
  } catch (error) {
    console.warn("Failed to load attendance events:", error);
    attendanceEvents = [];
  }

  try {
    await reloadRecords(eventId || "");
  } catch (error) {
    console.warn("Failed to load attendance records:", error);
    attendanceRecords = [];
  }

  renderUserMeta();
  renderRoleView();
  renderSelector();
  renderEvent();
  renderRecords();
  document.getElementById("attendance-checkin-btn").addEventListener("click", checkIn);
  document.getElementById("attendance-generate-qr-btn").addEventListener("click", function () {
    var eventItem = selectedEvent();
    if (eventItem) renderHostQr(eventItem);
  });
  document.getElementById("attendance-close-qr-btn").addEventListener("click", function () {
    document.getElementById("attendance-qr-fullscreen").close();
  });
  if (eventId && openedFromQr) checkIn();
})();
