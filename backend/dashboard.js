// Lead and performance data loaded dynamically from API on overview page init.
// GET /leads?userId=...  GET /performance  GET /cpf?agentId=...
var leadData = [];

const districtEventsSeed = [];

// GET /cpf?agentId=... → maps to { name, accountFocus, status, amount, note }
let cpfTrackerData = [];
let performanceRows = [];

// GET /performance → leaderboard rows; yearlyFyc summed from ytd_fyc; monthly/weekly not yet in API
let performanceData = {
  yearlyFyc: 0,
  yearlyTarget: 0,
  weeklyFyc: 0,
  lastWeekFyc: 0,
  leaderboard: [],
  monthlyYtd: [],
  menteeStatuses: [],
  weekly: []
};

const overviewScopeCopy = {
  district: "All-agency performance across agents, leads, and FYC activity.",
  agency: "Agency production, selected agents, and active lead movement.",
  personal: "Your personal production, appointments, lead pipeline, and weekly case activity."
};

async function loadOverviewData() {
  if (typeof apiGet !== 'function') return;
  const userId = sessionStorage.getItem('dashboardUser');
  if (!userId) return;
  try {
    const rows = await apiGet('/leads');
    if (Array.isArray(rows)) {
      leadData = rows.map(mapLead).map(function(r) {
        var u = r.urgency || '';
        return {
          id: r.id,
          name: r.name,
          age: r.age,
          contactProfile: [r.email, r.contact].filter(Boolean).join(' | '),
          meetupDate: r.meetDate || '',
          meetupLocation: r.location || '',
          meetingType: r.meetType || '',
          urgency: u === 'urgent' ? 'Urgent' : u === 'non-urgent' ? 'Non-Urgent' : (u ? u.charAt(0).toUpperCase() + u.slice(1) : 'Non-Urgent'),
          remarks: r.remarks || '',
          planType: r.planType || '',
          premium: r.premium || 0,
          commissionType: r.commission || '',
          stage: r.stage || '',
          ownerId: r.ownerId || '',
          owner: r.ownerId === userId ? 'agent' : 'district',
          agency: r.agency || ''
        };
      });
    }
  } catch (e) { console.warn('Failed to load leads for overview:', e); }
  try {
    const perf = await apiGet('/performance?year=' + new Date().getFullYear() + '&period=current');
    if (Array.isArray(perf) && perf.length > 0) {
      performanceRows = perf.map(mapPerformanceRow);
      performanceData = buildPerformanceDataset(performanceRows);
    }
  } catch (e) { console.warn('Failed to load performance for overview:', e); }
  try {
    const cpf = await apiGet('/cpf?agentId=' + encodeURIComponent(userId));
    if (Array.isArray(cpf)) {
      cpfTrackerData = cpf.map(function(r) {
        return { name: r.client_name || r.name || '', accountFocus: r.account_focus || '', status: r.status || '', amount: Number(r.amount || 0), note: r.note || r.notes || '' };
      });
    }
  } catch (e) { console.warn('Failed to load CPF tracker:', e); }
}

function localParseExtra(r) {
  if (!r || !r.extra) return {};
  if (typeof r.extra === "string") {
    try { return JSON.parse(r.extra) || {}; } catch (e) { return {}; }
  }
  return r.extra || {};
}

function mapPerformanceRow(r) {
  var extra = localParseExtra(r);
  return {
    agentId: r.agent_id,
    agent: r.full_name || r.agent_id || "",
    teamName: r.team_name || extra.teamName || extra.agency || "",
    ytdFyc: Number(r.ytd_fyc || 0),
    yearlyTarget: Number(r.yearly_target || 0),
    monthlyProduction: Number(r.weekly_fyc || extra.mtdFyc || 0),
    lastWeekFyc: Number(r.last_week_fyc || 0),
    delta: Number(r.delta_pct || 0),
    ytdCases: Number(r.total_cases || extra.ytdCases || 0),
    mtdCases: Number(extra.mtdCases || 0),
    monthlyYtd: Array.isArray(extra.monthlyYtd) ? extra.monthlyYtd : [],
    weekly: Array.isArray(extra.weekly) ? extra.weekly : [],
    menteeStatus: extra.menteeStatus || "Production tracked",
    extra: extra
  };
}

function buildPerformanceDataset(rows) {
  var sorted = rows.slice().sort(function(a, b) {
    return Number(b.ytdFyc || 0) - Number(a.ytdFyc || 0);
  });
  var yearlyFyc = rows.reduce(function(sum, r) { return sum + Number(r.ytdFyc || 0); }, 0);
  var yearlyTarget = rows.reduce(function(sum, r) { return sum + Number(r.yearlyTarget || 0); }, 0);
  var weeklyFyc = rows.reduce(function(sum, r) { return sum + Number(r.monthlyProduction || 0); }, 0);
  var lastWeekFyc = rows.reduce(function(sum, r) { return sum + Number(r.lastWeekFyc || 0); }, 0);
  var mtdCases = rows.reduce(function(sum, r) { return sum + Number(r.mtdCases || 0); }, 0);
  var ytdCases = rows.reduce(function(sum, r) { return sum + Number(r.ytdCases || 0); }, 0);
  var firstMonthly = rows.find(function(r) { return r.monthlyYtd && r.monthlyYtd.length; });
  var firstWeekly = rows.find(function(r) { return r.weekly && r.weekly.length; });
  return {
    yearlyFyc: yearlyFyc,
    yearlyTarget: yearlyTarget,
    weeklyFyc: weeklyFyc,
    lastWeekFyc: lastWeekFyc,
    totalCases: mtdCases,
    ytdCases: ytdCases,
    leaderboard: sorted.map(function(r) {
      return {
        agent: r.agent,
        agentId: r.agentId,
        teamName: r.teamName,
        monthlyProduction: r.monthlyProduction,
        ytdFyc: r.ytdFyc,
        ytdCases: r.ytdCases,
        mtdCases: r.mtdCases,
        delta: r.delta
      };
    }),
    monthlyYtd: firstMonthly ? firstMonthly.monthlyYtd : [],
    menteeStatuses: sorted.map(function(r) { return r.menteeStatus; }),
    weekly: firstWeekly ? firstWeekly.weekly : []
  };
}

function sameId(a, b) {
  return String(a || "").trim().toUpperCase() === String(b || "").trim().toUpperCase();
}

function getAvailableAgencyNames() {
  return performanceRows
    .map(function(row) { return row.teamName; })
    .filter(function(team, index, teams) { return team && teams.indexOf(team) === index; })
    .sort();
}

function getCurrentPerformanceRow() {
  var userId = sessionStorage.getItem("dashboardUser");
  var selectedAgentId = localStorage.getItem("overviewAgentId");
  return performanceRows.find(function(row) { return sameId(row.agentId, userId); }) ||
    performanceRows.find(function(row) { return sameId(row.agentId, selectedAgentId); }) ||
    performanceRows[0] ||
    null;
}

function getActiveAgencyName(currentRow) {
  var selectedAgency = localStorage.getItem("overviewAgency");
  var agencies = getAvailableAgencyNames();
  if (selectedAgency && agencies.indexOf(selectedAgency) !== -1) return selectedAgency;
  if (currentRow && currentRow.teamName) return currentRow.teamName;
  return agencies[0] || "";
}

function initializeOverviewAgencyPreference() {
  var userId = sessionStorage.getItem("dashboardUser") || "";
  var currentRow = getCurrentPerformanceRow();
  var agencies = getAvailableAgencyNames();
  var ownAgency = currentRow && sameId(currentRow.agentId, userId) ? currentRow.teamName : "";
  var initializedKey = "overviewAgencyInitializedFor";

  if (ownAgency && sessionStorage.getItem(initializedKey) !== userId) {
    localStorage.setItem("overviewAgency", ownAgency);
    localStorage.setItem("overviewScope", "agency");
    sessionStorage.setItem(initializedKey, userId);
    return;
  }

  var selectedAgency = localStorage.getItem("overviewAgency");
  if (selectedAgency && agencies.indexOf(selectedAgency) !== -1) return;
  if (ownAgency) {
    localStorage.setItem("overviewAgency", ownAgency);
    localStorage.setItem("overviewScope", "agency");
  } else if (agencies.length) {
    localStorage.setItem("overviewAgency", agencies[0]);
  }
}

function syncOverviewAgencySelect(scope) {
  var select = document.getElementById("overview-agency-select");
  if (!select) return;
  var control = select.closest(".overview-agency-control");
  if (control) control.hidden = scope !== "agency";
  var agencies = getAvailableAgencyNames();
  var selectedAgency = getActiveAgencyName(getCurrentPerformanceRow());

  select.innerHTML = agencies.map(function(agency) {
    return "<option value=\"" + agency.replace(/"/g, "&quot;") + "\">" + agency + "</option>";
  }).join("");

  if (selectedAgency && agencies.indexOf(selectedAgency) !== -1) {
    select.value = selectedAgency;
  } else if (agencies.length) {
    select.value = agencies[0];
  }
}

function isOverviewPage() {
  return document.getElementById("lead-table-body") !== null;
}

function isHomeDashboardPage() {
  return document.getElementById("total-leads-card") !== null;
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
  var currentRow = getCurrentPerformanceRow();
  var userId = sessionStorage.getItem("dashboardUser");
  if (scope === "personal") {
    var personalRows = currentRow ? [currentRow] : [];
    var isSessionUserRow = currentRow && sameId(currentRow.agentId, userId);
    var personalLeads = currentRow
      ? leadData.filter(function(lead) { return sameId(lead.ownerId, currentRow.agentId) || (isSessionUserRow && lead.owner === "agent"); })
      : [];
    return {
      scope,
      leads: personalLeads,
      data: buildPerformanceDataset(personalRows)
    };
  }

  if (scope === "agency") {
    var teamName = getActiveAgencyName(currentRow);
    var agencyRows = teamName
      ? performanceRows.filter(function(row) { return row.teamName === teamName; })
      : [];
    var agencyLeads = teamName
      ? leadData.filter(function(lead) { return lead.agency === teamName; })
      : [];
    return {
      scope,
      leads: agencyLeads,
      data: buildPerformanceDataset(agencyRows)
    };
  }

  return { scope: "district", leads: leadData, data: buildPerformanceDataset(performanceRows) };
}

function renderPerformanceOverview(scope = localStorage.getItem("overviewScope") || "agency") {
  const { data, leads } = getOverviewDataset(scope);
  const lede = document.getElementById("overview-scope-lede");
  if (lede) {
    var activeAgency = getActiveAgencyName(getCurrentPerformanceRow());
    lede.textContent = scope === "agency" && activeAgency
      ? activeAgency + " performance across agents, leads, and FYC activity."
      : overviewScopeCopy[scope] || overviewScopeCopy.district;
  }
  syncOverviewAgencySelect(scope);
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
    district: "All Agencies Overview",
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

  initializeOverviewAgencyPreference();
  setScope(localStorage.getItem("overviewScope") || "agency");
}

function wireOverviewAgencySelector() {
  const select = document.getElementById("overview-agency-select");
  if (!select) return;
  select.addEventListener("change", function() {
    localStorage.setItem("overviewAgency", select.value);
    localStorage.setItem("overviewScope", "agency");
    window.dispatchEvent(new CustomEvent("overviewScopeChanged", { detail: { scope: "agency" } }));
    renderPerformanceOverview("agency");
  });
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

  const targetPercent = data.yearlyTarget
    ? Math.min(100, Math.round((data.yearlyFyc / data.yearlyTarget) * 1000) / 10)
    : 0;
  const weekDelta = data.lastWeekFyc
    ? Math.round(((data.weeklyFyc - data.lastWeekFyc) / data.lastWeekFyc) * 1000) / 10
    : 0;
  const totalCases = Number.isFinite(data.totalCases)
    ? data.totalCases
    : (data.weekly || []).reduce((sum, item) => sum + item.cases, 0);

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
  if (!data.leaderboard.length) {
    tbody.innerHTML = `<tr><td colspan="4">No performance data loaded yet.</td></tr>`;
    return;
  }
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
  if (!data.leaderboard.length) {
    chart.className = "bar-chart";
    chart.innerHTML = `<p class="prod-placeholder">No performance data loaded yet.</p>`;
    if (insight) insight.textContent = "Upload a production Excel file to populate this view.";
    return;
  }
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
  const maxValue = Math.max(...data.leaderboard.map((item) => item.ytdFyc), 1);
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
  if (!data.monthlyYtd.length) {
    chart.innerHTML = `<p class="prod-placeholder">No monthly data loaded yet.</p>`;
    if (insight) insight.textContent = "Upload a report with monthly breakdown data to populate this chart.";
    return;
  }
  const maxValue = Math.max(...data.monthlyYtd.map((item) => item.value), 1);
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
  if (!data.weekly.length) {
    chart.innerHTML = `<p class="prod-placeholder">No weekly data loaded yet.</p>`;
    if (insight) insight.textContent = "Upload a report with weekly FYC and case data to populate this chart.";
    return;
  }
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

if (isOverviewPage()) {
  wireLeadFilters();
  wireRoleControl();
  wirePersonalTodo();
  wireFloatingTodo();
}

if (isHomeDashboardPage()) {
  (async function() {
    await loadOverviewData();
    wireOverviewAgencySelector();
    wireOverviewTabs();
    wireRoleControl();
    wirePersonalTodo();
    wireFloatingTodo();
  })();
}


wireFloatingTodo();



// Production Report

function wireProductionReport() {
  var panel = document.getElementById("production-report-panel");
  var isAdmin = (sessionStorage.getItem("dashboardRole") || "").toLowerCase() === "admin";
  if (!isAdmin) {
    if (panel) panel.hidden = true;
    return;
  }
  if (panel) panel.hidden = false;
  var input = document.getElementById("production-file-input");
  if (!input) return;
  input.addEventListener("change", async function(e) {
    var file = e.target.files[0];
    if (!file) return;
    var reader = new FileReader();
    reader.onload = async function(ev) {
      try {
        var wb = XLSX.read(ev.target.result, { type: "array" });
        var ws = wb.Sheets["Summary"] || wb.Sheets[wb.SheetNames[0]];
        var agents = parseProductionRows(wb);
        if (typeof apiPost === "function" && agents.length) {
          var label = document.getElementById("production-report-label");
          if (label) label.textContent = "Uploading " + agents.length + " rows to database...";
          await apiPost("/performance/bulk", {
            periodYear: new Date().getFullYear(),
            periodLabel: "current",
            rows: agents
          });
          await loadOverviewData();
          renderPerformanceOverview(localStorage.getItem("overviewScope") || "agency");
        }
        renderProductionViz(ws, file.name, agents);
      } catch (err) {
        document.getElementById("production-report-content").innerHTML =
          "<p class='prod-placeholder' style='color:var(--brand)'>Could not parse file: " + err.message + "</p>";
      }
    };
    reader.readAsArrayBuffer(file);
  });
}

function normalizeImportText(value) {
  return String(value == null ? "" : value).trim();
}

function normalizeAgentCode(value) {
  var raw = normalizeImportText(value);
  if (!raw) return "";
  if (/^\d+(\.0+)?$/.test(raw)) return String(Math.round(Number(raw)));
  return raw.toUpperCase();
}

function getWorksheetCellValue(ws, col, row) {
  var cell = ws[XLSX.utils.encode_cell({ c: col, r: row })];
  return cell ? cell.v : "";
}

function buildAgentCodeLookup(wb) {
  var lookup = {};
  var candidateSheets = ["YTD Cases", "Summary (Performance Bonus)", "YTD SPI", "YTD PA", "YTD AI"];
  candidateSheets.forEach(function(sheetName) {
    var ws = wb.Sheets[sheetName];
    if (!ws || !ws["!ref"]) return;
    var range = XLSX.utils.decode_range(ws["!ref"]);
    for (var row = 1; row <= range.e.r; row++) {
      var code = normalizeAgentCode(getWorksheetCellValue(ws, 1, row)); // Agent Code, col B
      var name = normalizeImportText(getWorksheetCellValue(ws, 3, row)); // Agent Name, col D
      if (code && name && name.toLowerCase() !== "agent name") {
        lookup[name.toLowerCase()] = code;
      }
    }
  });
  return lookup;
}

function parseProductionRows(source) {
  var wb = source && source.Sheets ? source : null;
  var ws = wb ? (wb.Sheets["Summary"] || wb.Sheets[wb.SheetNames[0]]) : source;
  var agentCodeByName = wb ? buildAgentCodeLookup(wb) : {};
  var range = XLSX.utils.decode_range(ws["!ref"] || "A1");

  function cellVal(col, row) {
    return getWorksheetCellValue(ws, col, row);
  }
  function toNum(v) { return parseFloat(v) || 0; }
  var agents = [];
  var lastAgency = "";
  for (var row = 2; row <= range.e.r; row++) {
    var agtNm = normalizeImportText(cellVal(1, row));  // col B
    if (!agtNm) continue;
    var agyCel = normalizeImportText(cellVal(0, row));  // col A
    if (agyCel) lastAgency = agyCel;
    agents.push({
      agentId:  agentCodeByName[agtNm.toLowerCase()] || "",
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
  return agents;
}

function renderProductionViz(ws, fileName, parsedAgents) {
  var content = document.getElementById("production-report-content");
  var label   = document.getElementById("production-report-label");
  if (!content) return;

  function fmtK(v) {
    if (v >= 1000000) return (v / 1000000).toFixed(1) + "M";
    if (v >= 1000)    return (v / 1000).toFixed(1) + "K";
    return String(Math.round(v));
  }

  var agents = parsedAgents || parseProductionRows(ws);

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
