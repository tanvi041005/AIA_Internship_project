(function () {
      var EVENTS_KEY = "attendanceEvents";
      var RECORDS_KEY = "attendanceRecords";
      var params = new URLSearchParams(window.location.search);
      var eventId = params.get("eventId") || "";
      var checkInToken = params.get("token") || "";
      var openedFromQr = params.get("checkIn") === "qr" && !!eventId && !!checkInToken;
      var signedInRole = sessionStorage.getItem("dashboardRole");
      if (!signedInRole) return;
      var user = (sessionStorage.getItem("dashboardUser") || "User").toUpperCase();
      var role = signedInRole;
      var isHostView = role === "district";
      var roleLabels = { agent: "Agent", leader: "Leader", district: "District Manager" };
      var fallbackEvents = [
        { id: "agency-1", title: "District Training Session", date: "2026-05-12", startTime: "09:00", endTime: "11:00", location: "District Training Room", type: "Training" },
        { id: "agency-2", title: "District Sales Review", date: "2026-05-25", startTime: "14:00", endTime: "15:30", location: "Main Meeting Room", type: "Meeting" }
      ];

      function readList(key) {
        try {
          var parsed = JSON.parse(localStorage.getItem(key) || "[]");
          return Array.isArray(parsed) ? parsed : [];
        } catch (error) {
          return [];
        }
      }

      function writeList(key, rows) {
        localStorage.setItem(key, JSON.stringify(rows));
      }

      function normalizeCalendarEvent(item, prefix) {
        if (!item || !item.id || !item.title) return null;
        return {
          id: item.id || prefix + "-" + item.date + "-" + item.title,
          title: item.title,
          date: item.date || "",
          startTime: item.startTime || "",
          endTime: item.endTime || "",
          location: item.location || "",
          type: item.type || "Calendar Event",
          category: item.category || prefix
        };
      }

      function calendarEventsFromStorage() {
        var personal = readList("personalEvents").map(function (item) {
          return normalizeCalendarEvent(item, "personal");
        }).filter(Boolean);
        var agency = readList("agencyEvents").map(function (item) {
          return normalizeCalendarEvent(item, "agency");
        }).filter(Boolean);
        return agency.concat(personal);
      }

      function eventFromUrl() {
        if (!eventId || !params.get("title")) return null;
        return {
          id: eventId,
          title: params.get("title") || "Calendar Event",
          date: params.get("date") || "",
          startTime: params.get("startTime") || "",
          endTime: params.get("endTime") || "",
          location: params.get("location") || "",
          type: params.get("type") || "Calendar Event",
          attendanceToken: checkInToken
        };
      }

      function getEvents() {
        var stored = readList(EVENTS_KEY);
        var urlEvent = eventFromUrl();
        if (urlEvent && !stored.some(function (item) { return item.id === urlEvent.id; })) {
          stored.unshift(urlEvent);
          writeList(EVENTS_KEY, stored);
        }
        var merged = stored.concat(calendarEventsFromStorage()).concat(fallbackEvents);
        var seen = {};
        return merged.filter(function (item) {
          if (!item || !item.id || seen[item.id]) return false;
          seen[item.id] = true;
          return true;
        });
      }

      function getRecords() {
        return readList(RECORDS_KEY);
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

      function saveAttendanceEvent(eventItem) {
        if (!eventItem) return null;
        var stored = readList(EVENTS_KEY);
        var existing = stored.find(function (item) { return item.id === eventItem.id; });
        var normalized = {
          id: eventItem.id,
          title: eventItem.title || "Calendar Event",
          date: eventItem.date || "",
          startTime: eventItem.startTime || "",
          endTime: eventItem.endTime || "",
          location: eventItem.location || "",
          type: eventItem.type || "Calendar Event",
          category: eventItem.category || "calendar",
          attendanceToken: (existing && existing.attendanceToken) || eventItem.attendanceToken || ("qr-" + Date.now() + "-" + Math.floor(Math.random() * 100000)),
          createdBy: user
        };
        var next = existing
          ? stored.map(function (item) { return item.id === normalized.id ? Object.assign({}, item, normalized) : item; })
          : [normalized].concat(stored);
        writeList(EVENTS_KEY, next);
        return normalized;
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
            ? "The District host view automatically selects the current or next event and generates the attendance QR."
            : "Agents can only check in after scanning the host QR and signing in.";
        }
      }

      function renderEvent() {
        var eventItem = selectedEvent();
        var btn = document.getElementById("attendance-checkin-btn");
        if (!eventItem) {
          btn.disabled = true;
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
        if (hostLabel) hostLabel.textContent = "Auto-selected: " + (eventItem.title || "Calendar Event") + " · " + formatDate(eventItem.date);
      }

      function buildCheckInUrl(eventItem) {
        var params = new URLSearchParams({
          eventId: eventItem.id,
          title: eventItem.title || "Calendar Event",
          date: eventItem.date || "",
          startTime: eventItem.startTime || "",
          endTime: eventItem.endTime || "",
          location: eventItem.location || "",
          type: eventItem.type || "Calendar Event",
          checkIn: "qr",
          token: eventItem.attendanceToken
        });
        return "attendance.html?" + params.toString();
      }

      function drawMockQr(canvas, value) {
        var ctx = canvas.getContext("2d");
        var size = canvas.width;
        var cells = 29;
        var cell = Math.floor(size / cells);
        var offset = Math.floor((size - cell * cells) / 2);
        var hash = 0;
        for (var i = 0; i < value.length; i += 1) hash = (hash * 31 + value.charCodeAt(i)) >>> 0;
        ctx.fillStyle = "#fff";
        ctx.fillRect(0, 0, size, size);
        ctx.fillStyle = "#111827";
        function drawFinder(x, y) {
          ctx.fillStyle = "#111827";
          ctx.fillRect(offset + x * cell, offset + y * cell, cell * 7, cell * 7);
          ctx.fillStyle = "#fff";
          ctx.fillRect(offset + (x + 1) * cell, offset + (y + 1) * cell, cell * 5, cell * 5);
          ctx.fillStyle = "#111827";
          ctx.fillRect(offset + (x + 2) * cell, offset + (y + 2) * cell, cell * 3, cell * 3);
        }
        drawFinder(1, 1);
        drawFinder(cells - 8, 1);
        drawFinder(1, cells - 8);
        for (var y = 0; y < cells; y += 1) {
          for (var x = 0; x < cells; x += 1) {
            var inFinder = (x >= 1 && x <= 7 && y >= 1 && y <= 7) || (x >= cells - 8 && x <= cells - 2 && y >= 1 && y <= 7) || (x >= 1 && x <= 7 && y >= cells - 8 && y <= cells - 2);
            if (inFinder) continue;
            if (((hash + x * 17 + y * 29 + x * y * 7) % 5) < 2) {
              ctx.fillRect(offset + x * cell, offset + y * cell, cell, cell);
            }
          }
        }
      }

      function renderHostQr(eventItem) {
        var dialog = document.getElementById("attendance-qr-fullscreen");
        var canvas = document.getElementById("attendance-host-qr-canvas");
        var title = document.getElementById("attendance-host-qr-title");
        var meta = document.getElementById("attendance-host-qr-meta");
        var link = document.getElementById("attendance-host-qr-link");
        if (!dialog || !canvas || !title || !link || !eventItem) return;
        var saved = saveAttendanceEvent(eventItem);
        var url = buildCheckInUrl(saved);
        title.textContent = saved.title + " · " + formatDate(saved.date);
        link.href = url;
        drawMockQr(canvas, window.location.href.replace(/[^/]+$/, "") + url);
        dialog.showModal();
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

      function checkIn() {
        var eventItem = selectedEvent();
        if (!eventItem) return;
        if (!canCheckIn(eventItem)) {
          document.getElementById("attendance-checkin-message").textContent = "Check-in is locked. Please scan the host's QR code for this event.";
          return;
        }
        var records = getRecords();
        var existing = records.find(function (record) {
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
        records.unshift({
          id: "att-" + Date.now(),
          eventId: eventItem.id,
          eventTitle: eventItem.title,
          userId: user,
          role: role,
          checkInTime: now.toISOString(),
          status: status
        });
        writeList(RECORDS_KEY, records);
        message.textContent = "Attendance recorded for " + user + " at " + formatDateTime(now.toISOString()) + ".";
        pill.textContent = status;
        pill.className = "status-pill " + (status === "Late" ? "urgent" : "non-urgent");
        renderRecords();
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