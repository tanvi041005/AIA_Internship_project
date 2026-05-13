(function () {
  var DAILY_TARGET = 15;
  var role = sessionStorage.getItem("dashboardRole") || "agent";
  var user = (sessionStorage.getItem("dashboardUser") || "A123").toUpperCase();
  var isManager = role === "district" || role === "leader";
  var agentNames = {};
  var activityTypes = [];
  var entries = [];
  var reflections = [];
  var currentFilter = isManager ? "all" : user;
  var selectedWeekOffset = 0;

  function todayISO() {
    return new Date().toISOString().slice(0, 10);
  }

  function normalizeType(row) {
    return {
      id: row.activity_type_id || row.id,
      label: row.label || row.activity_label || row.name || row.activity_type_id,
      points: Number(row.points || row.point_value || 0)
    };
  }

  function normalizeEntry(row) {
    var type = activityTypes.find(function (item) { return item.id === (row.activity_type_id || row.activityId); });
    return {
      id: row.entry_id || row.id,
      agentId: row.agent_id || row.agentId,
      date: row.entry_date || row.date,
      activityId: row.activity_type_id || row.activityId,
      activityLabel: row.activity_label || row.activityLabel || (type && type.label) || row.activity_type_id,
      pointValue: Number(row.point_value || row.pointValue || (type && type.points) || 0),
      count: Number(row.count || 0),
      client: row.client_name || row.client || "-",
      status: row.status || "Completed",
      notes: row.notes || "-",
      createdAt: row.created_at || row.createdAt
    };
  }

  async function loadData() {
    var settings = await apiGet("/sales-settings").catch(function () { return {}; });
    DAILY_TARGET = Number(settings.dailyTarget || settings.daily_target || DAILY_TARGET);
    var users = await apiGet("/users?role=agent").catch(function () { return []; });
    agentNames = {};
    users.forEach(function (u) { agentNames[u.user_id || u.userId] = u.full_name || u.fullName || u.user_id || u.userId; });
    activityTypes = (await apiGet("/sales-activity-types").catch(function () { return []; })).map(normalizeType);
    entries = (await apiGet("/sales-entries" + (isManager ? "" : "?agentId=" + encodeURIComponent(user))).catch(function () { return []; })).map(normalizeEntry);
    reflections = (await apiGet("/sales-reflections?agentId=" + encodeURIComponent(user)).catch(function () { return []; }));
  }

  function points(row) {
    return Number(row.pointValue || 0) * Number(row.count || 0);
  }

  function visibleEntries() {
    if (!isManager) return entries.filter(function (row) { return row.agentId === user; });
    if (currentFilter === "all") return entries;
    return entries.filter(function (row) { return row.agentId === currentFilter; });
  }

  function formatDate(value) {
    return new Intl.DateTimeFormat("en-SG", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(value + "T00:00:00"));
  }

  function renderMeta() {
    document.getElementById("sales-tracker-lede").textContent = isManager
      ? "View all agents' activity points, appointments, cases, and weekly tracker entries."
      : "Log your daily sales activities and review your weekly 15-point tracker.";
    document.getElementById("sales-entry-panel").hidden = isManager;
    document.getElementById("sales-weekly-reflection-panel").hidden = isManager;
    document.getElementById("sales-manager-weekly-panel").hidden = false;
    document.getElementById("sales-chart-panel").hidden = false;
    document.getElementById("sales-activity-mix-panel").hidden = false;
    document.getElementById("sales-records-panel").hidden = false;
  }

  function renderActivityOptions() {
    var select = document.getElementById("sales-entry-activity");
    select.innerHTML = activityTypes.map(function (item) {
      return '<option value="' + item.id + '">' + item.label + " - " + item.points + " pts</option>";
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
    if (!select.dataset.wired) {
      select.addEventListener("change", function () {
        currentFilter = select.value;
        renderAll();
      });
      select.dataset.wired = "true";
    }
  }

  function renderKpis(rows) {
    var today = todayISO();
    var todayPoints = rows.filter(function (row) { return row.date === today; }).reduce(function (sum, row) { return sum + points(row); }, 0);
    document.getElementById("sales-chart-title").textContent = "Daily Points";
    document.getElementById("sales-chart-insight").textContent = "Target line: " + DAILY_TARGET + " points per day.";
    return todayPoints;
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
      return '<div class="sales-point-day"><span>' + total + '</span><i style="height:' + height + '%" class="' + (total >= DAILY_TARGET ? "hit" : "") + '"></i><small>' + new Intl.DateTimeFormat("en-SG", { weekday: "short" }).format(new Date(day + "T00:00:00")) + "</small></div>";
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
    }).join("") : '<p class="muted-text">No activity data found in the database.</p>';
  }

  function renderTable(rows) {
    var tbody = document.getElementById("sales-record-body");
    document.getElementById("sales-table-title").textContent = isManager ? "Agent Sales Activity Records" : "My Sales Activity Records";
    document.getElementById("sales-table-summary").textContent = "Showing " + rows.length + " sales tracker entries.";
    tbody.innerHTML = rows.length ? rows.slice().sort(function (a, b) { return String(b.date).localeCompare(String(a.date)); }).map(function (row) {
      return '<tr><td>' + formatDate(row.date) + '</td><td><strong>' + (agentNames[row.agentId] || row.agentId) + '</strong><br><span class="muted-text">' + row.agentId + '</span></td><td>' + row.activityLabel + '<br><span class="muted-text">' + row.pointValue + ' pts each</span></td><td>' + (row.client || "-") + '</td><td>' + row.count + '</td><td><strong>' + points(row) + '</strong></td><td><span class="status-pill ' + (row.status === "Completed" ? "non-urgent" : "urgent") + '">' + row.status + '</span></td><td>' + (row.notes || "-") + '</td></tr>';
    }).join("") : '<tr><td colspan="8" class="muted-text">No sales entries found in the database.</td></tr>';
  }

  function weekDays() {
    var today = new Date(todayISO() + "T00:00:00");
    var monday = new Date(today);
    var day = monday.getDay();
    monday.setDate(monday.getDate() + (day === 0 ? -6 : 1 - day) + selectedWeekOffset * 7);
    var days = [];
    for (var i = 0; i < 7; i += 1) {
      var date = new Date(monday);
      date.setDate(monday.getDate() + i);
      days.push(date.toISOString().slice(0, 10));
    }
    return days;
  }

  function renderManagerWeeklyTable() {
    var days = weekDays();
    document.getElementById("sales-week-label").textContent = formatDate(days[0]) + " - " + formatDate(days[6]);
    var agentIds = Object.keys(agentNames);
    var selectedAgent = isManager ? (currentFilter !== "all" ? currentFilter : agentIds[0]) : user;
    var toggle = document.getElementById("sales-weekly-agent-toggle");
    if (toggle) toggle.hidden = !isManager;
    if (toggle && !toggle.dataset.wired) {
      toggle.innerHTML = agentIds.map(function (id) { return '<option value="' + id + '">' + agentNames[id] + " (" + id + ")</option>"; }).join("");
      toggle.addEventListener("change", function () { currentFilter = toggle.value; renderAll(); });
      toggle.dataset.wired = "true";
    }
    if (toggle) toggle.value = selectedAgent || "";
    var categories = activityTypes.filter(function (type) { return type.id !== "case"; });
    var dailyTotals = days.map(function (day) {
      return entries.filter(function (row) { return row.agentId === selectedAgent && row.date === day; }).reduce(function (sum, row) { return sum + points(row); }, 0);
    });
    var weekTotal = dailyTotals.reduce(function (sum, value) { return sum + value; }, 0);
    document.getElementById("sales-weekly-agent-summary").textContent = (agentNames[selectedAgent] || "No agent selected") + " - " + (selectedAgent || "") + " - " + weekTotal + "/" + (DAILY_TARGET * days.length) + " points";
    document.getElementById("sales-weekly-head").innerHTML = '<tr><th></th>' + days.map(function (day) { return '<th>' + formatDate(day) + '</th>'; }).join("") + "</tr>";
    document.getElementById("sales-weekly-body").innerHTML = categories.map(function (type) {
      return '<tr><th><span>' + type.points + '</span> ' + type.label + '</th>' + days.map(function (day) {
        var count = entries.filter(function (row) { return row.agentId === selectedAgent && row.date === day && row.activityId === type.id; }).reduce(function (sum, row) { return sum + Number(row.count || 0); }, 0);
        return '<td>' + (count || "") + '</td>';
      }).join("") + '</tr>';
    }).join("") +
      '<tr class="sales-weekly-total-row"><th>Total</th>' + dailyTotals.map(function (value) { return '<td><strong>' + value + '</strong></td>'; }).join("") + '</tr>' +
      '<tr class="sales-weekly-target-row"><th>Target</th>' + days.map(function () { return '<td><strong>' + DAILY_TARGET + '</strong></td>'; }).join("") + '</tr>';
  }

  function renderReflections() {
    var form = document.getElementById("sales-reflection-form");
    var list = document.getElementById("sales-reflection-list");
    if (isManager) return;
    list.innerHTML = reflections.slice(-3).reverse().map(function (item) {
      return '<li><span class="dot blue"></span><div class="activity-body"><div class="activity-row"><span class="activity-name">' + formatDate(item.reflection_date || item.date) + '</span><span class="activity-time">Weekly flow</span></div><p class="activity-desc"><strong>Good:</strong> ' + (item.good || "-") + '</p><p class="activity-desc"><strong>Bad:</strong> ' + (item.bad || "-") + '</p><p class="activity-desc"><strong>Improve:</strong> ' + (item.improve || "-") + '</p></div></li>';
    }).join("");
    form.onsubmit = async function (event) {
      event.preventDefault();
      await apiPost("/sales-reflections", {
        agentId: user,
        date: todayISO(),
        good: document.getElementById("sales-good").value.trim() || "-",
        bad: document.getElementById("sales-bad").value.trim() || "-",
        improve: document.getElementById("sales-improve").value.trim() || "-"
      });
      await loadData();
      form.reset();
      renderAll();
    };
  }

  function wireForm() {
    var form = document.getElementById("sales-entry-form");
    var dialog = document.getElementById("sales-entry-dialog");
    var openBtn = document.getElementById("sales-open-entry-btn");
    var closeBtn = document.getElementById("sales-close-entry-btn");
    if (openBtn && dialog) openBtn.addEventListener("click", function () { dialog.showModal(); });
    if (closeBtn && dialog) closeBtn.addEventListener("click", function () { dialog.close(); });
    if (isManager) return;
    form.addEventListener("submit", async function (event) {
      event.preventDefault();
      var activityId = document.getElementById("sales-entry-activity").value;
      await apiPost("/sales-entries", {
        agentId: user,
        date: document.getElementById("sales-entry-date").value,
        activityId: activityId,
        count: Number(document.getElementById("sales-entry-count").value || 1)
      });
      if (dialog) dialog.close();
      await loadData();
      renderActivityOptions();
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
    document.getElementById("sales-prev-week-btn").addEventListener("click", function () { selectedWeekOffset -= 1; renderAll(); });
    document.getElementById("sales-next-week-btn").addEventListener("click", function () { selectedWeekOffset += 1; renderAll(); });
  }

  async function init() {
    await loadData();
    renderMeta();
    renderActivityOptions();
    renderAgentFilter();
    wireWeekControls();
    wireForm();
    renderAll();
  }

  init().catch(function (err) {
    console.error("Failed to initialize sales tracker", err);
  });
})();
