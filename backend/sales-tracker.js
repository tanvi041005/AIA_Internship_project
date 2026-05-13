(async function () {
      var REFLECTION_KEY = "salesTrackerReflections";
      var DAILY_TARGET = 15;
      var role = sessionStorage.getItem("dashboardRole") || "agent";
      var user = (sessionStorage.getItem("dashboardUser") || "A123").toUpperCase();
      var isManager = role === "district" || role === "leader";
      var roleLabels = { agent: "Agent", leader: "Leader", district: "District Manager" };
      var agentNames = {
        A123: "Alicia Tan",
        A124: "Brandon Lee",
        A125: "Chloe Ong",
        A126: "Darren Lim",
        A127: "Farah Rahim"
      };
      var activityTypes = [
        { id: "activity", label: "Activity", points: 3 },
        { id: "contact", label: "Contact", points: 1 },
        { id: "schedule", label: "Schedule Appt", points: 2 },
        { id: "casual", label: "Casual Meetup", points: 2 },
        { id: "insurance", label: "Insurance Appt", points: 5 },
        { id: "referral", label: "Referral", points: 3 },
        { id: "case", label: "Case Closed", points: 10 }
      ];
      var currentFilter = isManager ? "all" : user;
      var selectedWeekOffset = 0;
      var salesEntriesCache = [];

      function todayISO() {
        return new Date().toISOString().slice(0, 10);
      }

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

      function getEntries() {
        return salesEntriesCache;
      }

      function visibleEntries() {
        var rows = getEntries();
        if (!isManager) return rows.filter(function (row) { return row.agentId === user; });
        if (currentFilter === "all") return rows;
        return rows.filter(function (row) { return row.agentId === currentFilter; });
      }

      function points(row) {
        return Number(row.pointValue || 0) * Number(row.count || 0);
      }

      function formatDate(value) {
        return new Intl.DateTimeFormat("en-SG", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(value + "T00:00:00"));
      }

      function renderMeta() {
        document.getElementById("sales-tracker-lede").textContent = isManager
          ? "View all agents' activity points, appointments, cases, and weekly tracker entries."
          : "Log your daily sales activities and review your weekly 15-point tracker.";
        document.getElementById("sales-entry-panel").hidden = isManager;
        document.getElementById("sales-weekly-reflection-panel").hidden = true;
        document.getElementById("sales-manager-weekly-panel").hidden = false;
        document.getElementById("sales-chart-panel").hidden = true;
        document.getElementById("sales-activity-mix-panel").hidden = true;
        document.getElementById("sales-records-panel").hidden = true;
      }

      function renderActivityOptions() {
        var select = document.getElementById("sales-entry-activity");
        select.innerHTML = activityTypes.map(function (item) {
          return '<option value="' + item.id + '">' + item.label + " · " + item.points + " pts</option>";
        }).join("");
        document.getElementById("sales-entry-date").value = todayISO();
      }

      function renderAgentFilter() {
        var select = document.getElementById("sales-agent-filter");
        if (!isManager) {
          select.hidden = true;
          return;
        }
        var agentIds = Object.keys(agentNames);
        select.innerHTML = '<option value="all">All agents</option>' + agentIds.map(function (id) {
          return '<option value="' + id + '">' + agentNames[id] + " (" + id + ")</option>";
        }).join("");
        select.value = currentFilter;
        select.addEventListener("change", function () {
          currentFilter = select.value;
          renderAll();
        });
      }

      function renderKpis(rows) {
        if (!document.getElementById("sales-today-points")) return;
        var today = todayISO();
        var todayPoints = rows.filter(function (row) { return row.date === today; }).reduce(function (sum, row) { return sum + points(row); }, 0);
        var weekStart = new Date(today + "T00:00:00");
        weekStart.setDate(weekStart.getDate() - 6);
        var weekRows = rows.filter(function (row) { return new Date(row.date + "T00:00:00") >= weekStart; });
        var weekPoints = weekRows.reduce(function (sum, row) { return sum + points(row); }, 0);
        var weekTarget = DAILY_TARGET * 7;
        document.getElementById("sales-today-points").textContent = String(todayPoints);
        document.getElementById("sales-today-progress").style.width = Math.min(100, Math.round(todayPoints / DAILY_TARGET * 100)) + "%";
        document.getElementById("sales-daily-target").textContent = String(DAILY_TARGET);
        document.getElementById("sales-week-points").textContent = String(weekPoints);
        document.getElementById("sales-week-count").textContent = weekRows.length + " entr" + (weekRows.length === 1 ? "y" : "ies");
        document.getElementById("sales-week-shortfall").textContent = Math.max(0, weekTarget - weekPoints) + " shortfall";
        document.getElementById("sales-insurance-count").textContent = String(rows.filter(function (row) { return row.activityId === "insurance"; }).reduce(function (sum, row) { return sum + Number(row.count || 0); }, 0));
        document.getElementById("sales-case-count").textContent = String(rows.filter(function (row) { return row.activityId === "case"; }).reduce(function (sum, row) { return sum + Number(row.count || 0); }, 0));
      }

      function renderPointChart(rows) {
        var root = document.getElementById("sales-point-chart");
        var today = new Date(todayISO() + "T00:00:00");
        var days = [];
        for (var i = 6; i >= 0; i -= 1) {
          var d = new Date(today);
          d.setDate(today.getDate() - i);
          days.push(d.toISOString().slice(0, 10));
        }
        var maxValue = Math.max(DAILY_TARGET, rows.reduce(function (max, row) { return Math.max(max, points(row)); }, 0));
        root.innerHTML = days.map(function (day) {
          var total = rows.filter(function (row) { return row.date === day; }).reduce(function (sum, row) { return sum + points(row); }, 0);
          var height = Math.max(4, Math.round(total / maxValue * 100));
          var hitTarget = total >= DAILY_TARGET;
          return '<div class="sales-point-day">' +
            '<span>' + total + '</span>' +
            '<i style="height:' + height + '%" class="' + (hitTarget ? "hit" : "") + '"></i>' +
            '<small>' + new Intl.DateTimeFormat("en-SG", { weekday: "short" }).format(new Date(day + "T00:00:00")) + '</small>' +
          '</div>';
        }).join("");
      }

      function renderMixChart(rows) {
        var root = document.getElementById("sales-mix-chart");
        var totals = activityTypes.map(function (type) {
          return {
            label: type.label,
            value: rows.filter(function (row) { return row.activityId === type.id; }).reduce(function (sum, row) { return sum + points(row); }, 0)
          };
        }).filter(function (item) { return item.value > 0; });
        var max = Math.max(1, Math.max.apply(null, totals.map(function (item) { return item.value; })));
        root.innerHTML = totals.length ? totals.map(function (item) {
          return '<div class="sales-mix-row"><span>' + item.label + '</span><div><i style="width:' + Math.max(5, Math.round(item.value / max * 100)) + '%"></i></div><strong>' + item.value + '</strong></div>';
        }).join("") : '<p class="muted-text">No activity data yet.</p>';
      }

      function renderTable(rows) {
        var tbody = document.getElementById("sales-record-body");
        document.getElementById("sales-table-title").textContent = isManager ? "Agent Sales Activity Records" : "My Sales Activity Records";
        document.getElementById("sales-table-summary").textContent = "Showing " + rows.length + " sales tracker entr" + (rows.length === 1 ? "y." : "ies.");
        tbody.innerHTML = rows.slice().sort(function (a, b) { return b.date.localeCompare(a.date); }).map(function (row) {
          return '<tr>' +
            '<td>' + formatDate(row.date) + '</td>' +
            '<td><strong>' + (agentNames[row.agentId] || row.agentId) + '</strong><br><span class="muted-text">' + row.agentId + '</span></td>' +
            '<td>' + row.activityLabel + '<br><span class="muted-text">' + row.pointValue + ' pts each</span></td>' +
            '<td>' + (row.client || "-") + '</td>' +
            '<td>' + row.count + '</td>' +
            '<td><strong>' + points(row) + '</strong></td>' +
            '<td><span class="status-pill ' + (row.status === "Completed" ? "non-urgent" : "urgent") + '">' + row.status + '</span></td>' +
            '<td>' + (row.notes || "-") + '</td>' +
          '</tr>';
        }).join("");
      }

      function weekDays() {
        var today = new Date(todayISO() + "T00:00:00");
        var monday = new Date(today);
        var day = monday.getDay();
        var diff = day === 0 ? -6 : 1 - day;
        monday.setDate(monday.getDate() + diff);
        monday.setDate(monday.getDate() + selectedWeekOffset * 7);
        var days = [];
        for (var i = 0; i < 7; i += 1) {
          var date = new Date(monday);
          date.setDate(monday.getDate() + i);
          days.push(date.toISOString().slice(0, 10));
        }
        return days;
      }

      function renderWeekLabel(days) {
        var first = new Date(days[0] + "T00:00:00");
        var last = new Date(days[6] + "T00:00:00");
        var label = new Intl.DateTimeFormat("en-SG", { day: "numeric", month: "short" }).format(first) +
          " - " +
          new Intl.DateTimeFormat("en-SG", { day: "numeric", month: "short", year: "numeric" }).format(last);
        document.getElementById("sales-week-label").textContent = label;
      }

      function renderManagerWeeklyTable() {
        var panel = document.getElementById("sales-manager-weekly-panel");
        if (!panel) return;
        var days = weekDays();
        renderWeekLabel(days);
        var rows = getEntries();
        var agentIds = Object.keys(agentNames);
        var selectedAgent = isManager ? (currentFilter !== "all" ? currentFilter : agentIds[0]) : user;
        var toggle = document.getElementById("sales-weekly-agent-toggle");
        if (toggle) toggle.hidden = !isManager;
        if (toggle && !toggle.dataset.wired) {
          toggle.innerHTML = agentIds.map(function (id) {
            return '<option value="' + id + '">' + agentNames[id] + " (" + id + ")</option>";
          }).join("");
          toggle.addEventListener("change", function () {
            currentFilter = toggle.value;
            var managerFilter = document.getElementById("sales-agent-filter");
            if (managerFilter) managerFilter.value = currentFilter;
            renderAll();
          });
          toggle.dataset.wired = "true";
        }
        if (toggle) toggle.value = selectedAgent;
        var head = document.getElementById("sales-weekly-head");
        var body = document.getElementById("sales-weekly-body");
        var categories = activityTypes.filter(function (type) { return type.id !== "case"; });
        var dailyTotals = days.map(function (day) {
          return rows
            .filter(function (row) { return row.agentId === selectedAgent && row.date === day; })
            .reduce(function (sum, row) { return sum + points(row); }, 0);
        });
        var missedDays = dailyTotals.filter(function (value) { return value < DAILY_TARGET; }).length;
        var weekTarget = DAILY_TARGET * days.length;
        var weekTotal = dailyTotals.reduce(function (sum, value) { return sum + value; }, 0);
        var flagged = missedDays > 0 || weekTotal < weekTarget;
        document.getElementById("sales-weekly-agent-summary").textContent = (agentNames[selectedAgent] || "My Tracker") + " · " + selectedAgent + " · " + weekTotal + "/" + weekTarget + " points";
        head.innerHTML =
          '<tr><th></th>' + days.map(function (day) {
            return '<th>' + new Intl.DateTimeFormat("en-SG", { day: "numeric", month: "short" }).format(new Date(day + "T00:00:00")) + '</th>';
          }).join("") + '</tr>' +
          '<tr><th>Point System</th>' + days.map(function (day) {
            return '<th>' + new Intl.DateTimeFormat("en-SG", { weekday: "short" }).format(new Date(day + "T00:00:00")).toUpperCase() + '</th>';
          }).join("") + '</tr>';

        body.innerHTML =
          categories.map(function (type) {
            return '<tr><th><span>' + type.points + '</span> ' + type.label + '</th>' + days.map(function (day) {
              var count = rows
                .filter(function (row) { return row.agentId === selectedAgent && row.date === day && row.activityId === type.id; })
                .reduce(function (sum, row) { return sum + Number(row.count || 0); }, 0);
              return '<td>' + (count ? count : "") + '</td>';
            }).join("") + '</tr>';
          }).join("") +
          '<tr class="sales-weekly-total-row"><th>Total</th>' + dailyTotals.map(function (value) {
            return '<td><strong>' + value + '</strong></td>';
          }).join("") + '</tr>' +
          '<tr class="sales-weekly-target-row"><th>Target</th>' + days.map(function () {
            return '<td><strong>' + DAILY_TARGET + '</strong></td>';
          }).join("") + '</tr>' +
          '<tr class="sales-weekly-shortfall-row"><th>Shortfall</th>' + dailyTotals.map(function (value) {
            var delta = value - DAILY_TARGET;
            return '<td class="' + (delta < 0 ? "miss" : "met") + '">' + (delta >= 0 ? "+" : "") + delta + '</td>';
          }).join("") + '</tr>';
      }

      function renderReflections() {
        var form = document.getElementById("sales-reflection-form");
        var list = document.getElementById("sales-reflection-list");
        if (isManager) return;
        var saved = readList(REFLECTION_KEY).filter(function (item) { return item.agentId === user; }).slice(-3).reverse();
        list.innerHTML = saved.map(function (item) {
          return '<li><span class="dot blue"></span><div class="activity-body"><div class="activity-row"><span class="activity-name">' + formatDate(item.date) + '</span><span class="activity-time">Weekly flow</span></div><p class="activity-desc"><strong>Good:</strong> ' + item.good + '</p><p class="activity-desc"><strong>Bad:</strong> ' + item.bad + '</p><p class="activity-desc"><strong>Improve:</strong> ' + item.improve + '</p></div></li>';
        }).join("");
        form.onsubmit = function (event) {
          event.preventDefault();
          var rows = readList(REFLECTION_KEY);
          rows.push({
            agentId: user,
            date: todayISO(),
            good: document.getElementById("sales-good").value.trim() || "-",
            bad: document.getElementById("sales-bad").value.trim() || "-",
            improve: document.getElementById("sales-improve").value.trim() || "-"
          });
          writeList(REFLECTION_KEY, rows);
          form.reset();
          renderReflections();
        };
      }

      function wireForm() {
        var form = document.getElementById("sales-entry-form");
        var dialog = document.getElementById("sales-entry-dialog");
        var openBtn = document.getElementById("sales-open-entry-btn");
        var closeBtn = document.getElementById("sales-close-entry-btn");
        if (isManager) return;
        if (openBtn && dialog) {
          openBtn.addEventListener("click", function () {
            dialog.showModal();
          });
        }
        if (closeBtn && dialog) {
          closeBtn.addEventListener("click", function () {
            dialog.close();
          });
        }
        form.addEventListener("submit", async function (event) {
          event.preventDefault();
          var activityId = document.getElementById("sales-entry-activity").value;
          var type = activityTypes.find(function (item) { return item.id === activityId; });
          var entryDate = document.getElementById("sales-entry-date").value;
          var count = Number(document.getElementById("sales-entry-count").value || 1);
          await apiPost('/sales', {
            agent_id: user,
            entry_date: entryDate,
            activity_type_id: activityId,
            count: count,
            client_name: "-",
            status: "Completed",
            notes: "-"
          });
          salesEntriesCache.push({
            id: "sale-" + Date.now(),
            agentId: user,
            date: entryDate,
            activityId: activityId,
            activityLabel: type.label,
            pointValue: type.points,
            count: count,
            client: "-",
            status: "Completed",
            notes: "-",
            createdAt: new Date().toISOString()
          });
          form.reset();
          document.getElementById("sales-entry-date").value = todayISO();
          if (dialog) dialog.close();
          renderAll();
        });
      }

      function renderAll() {
        var rows = visibleEntries();
        renderKpis(rows);
        renderPointChart(rows);
        renderMixChart(rows);
        renderTable(rows);
        renderManagerWeeklyTable();
        renderReflections();
      }

      function wireWeekControls() {
        var prev = document.getElementById("sales-prev-week-btn");
        var next = document.getElementById("sales-next-week-btn");
        if (!prev || !next) return;
        prev.addEventListener("click", function () {
          selectedWeekOffset -= 1;
          renderAll();
        });
        next.addEventListener("click", function () {
          selectedWeekOffset += 1;
          renderAll();
        });
      }

      salesEntriesCache = (await apiGet('/sales')).map(function(r) { return mapSalesEntry(r, activityTypes); });
      renderMeta();
      renderActivityOptions();
      renderAgentFilter();
      wireWeekControls();
      wireForm();
      renderAll();
    })();