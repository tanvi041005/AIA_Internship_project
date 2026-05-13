(function () {
  const STAGES = ["Prospecting", "Fact Find", "Opening", "Closing"];
  const STAGE_COLORS = ["#d4a574", "#a6192e", "#8b5cf6", "#1e3a8a"];
  const URGENCY_ORDER = { urgent: 0, medium: 1, "non-urgent": 2 };
  const AVATAR_COLORS = ["#a6192e", "#3b82f6", "#16a34a", "#f59e0b", "#8b5cf6", "#ec4899"];

  let LEADS = [];
  let filtered = [];
  let sortCol = "meetDate";
  let sortDir = "asc";
  let activeId = null;
  let stageFilter = null;

  function userId() {
    return (sessionStorage.getItem("dashboardUser") || "A123").toUpperCase();
  }

  function parseExtra(value) {
    if (!value) return {};
    if (typeof value === "object") return value;
    try { return JSON.parse(value) || {}; } catch (e) { return {}; }
  }

  function mapLeadRow(row) {
    const extra = parseExtra(row.extra);
    const followUps = Array.isArray(row.followUps)
      ? row.followUps
      : Array.isArray(row.follow_ups)
        ? row.follow_ups
        : [];
    return {
      id: Number(row.lead_id || row.id),
      name: row.name || "",
      age: Number(row.age || 0),
      contact: row.contact || "",
      email: row.email || "",
      meetDate: row.meet_date || row.meetDate || "",
      location: row.location || "",
      meetType: row.meet_type || row.meetType || "",
      urgency: String(row.urgency || "").toLowerCase(),
      stage: row.stage || "",
      remarks: row.remarks || "",
      planType: row.plan_type || row.planType || "",
      premium: Number(row.annual_premium || row.premium || 0),
      commission: row.commission_type || row.commission || "",
      cpfOA: Number(row.cpf_oa || row.cpfOA || 0),
      cpfSA: Number(row.cpf_sa || row.cpfSA || 0),
      occupation: row.occupation || "",
      income: row.income || "",
      referredBy: row.referred_by || row.referredBy || "",
      sumAssured: extra.sumAssured,
      currency: extra.currency || "SGD",
      generalExpense: extra.generalExpense,
      surplus: extra.surplus,
      existingPlans: extra.existingPlans,
      generalPlanType: extra.generalPlanType,
      specificPlanType: extra.specificPlanType,
      followUps: followUps.map(function (f) {
        return {
          label: f.label || f.follow_up_label || "",
          date: f.date || f.scheduled_date || "",
          done: Boolean(f.done || f.is_done)
        };
      })
    };
  }

  async function loadLeads() {
    const rows = await apiGet("/leads?userId=" + encodeURIComponent(userId()));
    LEADS = Array.isArray(rows) ? rows.map(mapLeadRow) : [];
    filtered = LEADS.slice();
  }

  function esc(value) {
    const node = document.createElement("div");
    node.textContent = String(value || "");
    return node.innerHTML;
  }

  function shortName(name) {
    const parts = String(name || "").trim().split(/\s+/).filter(Boolean);
    if (parts.length <= 1) return parts[0] || "";
    return parts[0] + " " + parts[parts.length - 1];
  }

  function initials(name) {
    const parts = String(name || "").trim().split(/\s+/).filter(Boolean);
    return ((parts[0] || "?")[0] + ((parts[parts.length - 1] || "")[0] || "")).toUpperCase();
  }

  function formatDate(value) {
    if (!value) return "-";
    const date = new Date(value + "T00:00:00");
    if (isNaN(date.getTime())) return value;
    return new Intl.DateTimeFormat("en-SG", { day: "numeric", month: "short", year: "numeric" }).format(date);
  }

  function money(value) {
    return "SGD " + Math.round(Number(value || 0)).toLocaleString("en-SG");
  }

  function urgencyLabel(value) {
    if (value === "urgent") return "Urgent";
    if (value === "medium") return "Medium";
    return "Non-urgent";
  }

  function stageColor(stage) {
    const idx = STAGES.indexOf(stage);
    return STAGE_COLORS[idx >= 0 ? idx : 0];
  }

  function nextFollowUp(lead) {
    const pending = (lead.followUps || []).filter(function (item) { return !item.done && item.date; });
    pending.sort(function (a, b) { return String(a.date).localeCompare(String(b.date)); });
    return pending[0] || null;
  }

  function renderKPIs() {
    const urgent = LEADS.filter(function (l) { return l.urgency === "urgent"; }).length;
    const totalPrem = LEADS.reduce(function (sum, l) { return sum + l.premium; }, 0);
    const closing = LEADS.filter(function (l) { return l.stage === "Closing"; }).length;
    const avgAge = LEADS.length ? Math.round(LEADS.reduce(function (sum, l) { return sum + l.age; }, 0) / LEADS.length) : 0;
    const referred = LEADS.filter(function (l) { return !!l.referredBy; }).length;
    const referralRate = LEADS.length ? Math.round(referred / LEADS.length * 100) : 0;
    const kpis = [
      { label: "Total Leads", val: LEADS.length, sub: urgent + " urgent" },
      { label: "In Closing", val: closing, sub: "ready to sign" },
      { label: "Est. Annual Premium", val: money(totalPrem), sub: "across all leads" },
      { label: "Avg. Lead Age", val: avgAge + " yrs", sub: "average profile age" },
      { label: "Referral Rate", val: referralRate + "%", sub: referred + " of " + LEADS.length + " referred" }
    ];
    document.getElementById("kpi-grid").innerHTML = kpis.map(function (k) {
      return '<div class="kpi-card"><p class="kpi-label">' + esc(k.label) + '</p><p class="kpi-value">' + esc(k.val) + '</p><p class="kpi-sub">' + esc(k.sub) + "</p></div>";
    }).join("");
  }

  function sortData() {
    filtered.sort(function (a, b) {
      let va = sortCol === "nextMeetDate" ? (nextFollowUp(a)?.date || "") : (a[sortCol] ?? a.name);
      let vb = sortCol === "nextMeetDate" ? (nextFollowUp(b)?.date || "") : (b[sortCol] ?? b.name);
      if (sortCol === "urgency") {
        va = URGENCY_ORDER[a.urgency] ?? 99;
        vb = URGENCY_ORDER[b.urgency] ?? 99;
      }
      if (sortCol === "age" || sortCol === "premium") {
        va = Number(va || 0);
        vb = Number(vb || 0);
      }
      if (va < vb) return sortDir === "asc" ? -1 : 1;
      if (va > vb) return sortDir === "asc" ? 1 : -1;
      return 0;
    });
  }

  function applyFilters() {
    const search = document.getElementById("search-input").value.toLowerCase();
    const urgency = document.getElementById("urgency-filter").value;
    const type = document.getElementById("type-filter").value;
    const date = document.getElementById("date-filter").value;
    filtered = LEADS.filter(function (lead) {
      if (search && !lead.name.toLowerCase().includes(search) && !lead.location.toLowerCase().includes(search)) return false;
      if (urgency && lead.urgency !== urgency) return false;
      if (type && lead.meetType !== type) return false;
      if (date && lead.meetDate !== date) return false;
      if (stageFilter && lead.stage !== stageFilter) return false;
      return true;
    });
    sortData();
    render();
  }

  function render() {
    document.getElementById("summary-line").textContent = "Showing " + filtered.length + " of " + LEADS.length + " leads";
    document.querySelectorAll(".lead-table th[data-col]").forEach(function (th) {
      th.classList.toggle("sorted", th.dataset.col === sortCol);
      const arrow = th.querySelector(".sort-arrow");
      if (arrow) arrow.textContent = th.dataset.col === sortCol ? (sortDir === "asc" ? "^" : "v") : "";
    });

    const tbody = document.getElementById("lead-tbody");
    if (!filtered.length) {
      tbody.innerHTML = '<tr><td colspan="10" style="text-align:center;padding:2rem;color:var(--text-muted)">No leads found in the database for this view.</td></tr>';
      return;
    }
    tbody.innerHTML = filtered.map(function (lead) {
      const follow = nextFollowUp(lead);
      const color = stageColor(lead.stage);
      return '<tr class="lead-row' + (activeId === lead.id ? " selected" : "") + '" data-id="' + lead.id + '" tabindex="0" role="button" aria-label="View details for ' + esc(lead.name) + '">' +
        '<td><strong class="lead-name">' + esc(lead.name) + '</strong></td>' +
        '<td>' + lead.age + '</td>' +
        '<td class="lead-contact">' + esc(lead.contact) + '</td>' +
        '<td>' + formatDate(lead.meetDate) + '</td>' +
        '<td>' + (follow ? esc(follow.label) + '<br><span class="muted-text">' + formatDate(follow.date) + '</span>' : '<span class="muted-text">No pending follow-up</span>') + '</td>' +
        '<td>' + esc(lead.location) + '</td>' +
        '<td><span class="badge-text">' + esc(lead.meetType) + '</span></td>' +
        '<td><span class="status-pill ' + esc(lead.urgency) + '">' + esc(urgencyLabel(lead.urgency)) + '</span></td>' +
        '<td><span style="font-size:.78rem;padding:.1rem .4rem;border-radius:4px;background:' + color + ';color:#fff">' + esc(lead.stage) + '</span></td>' +
        '<td style="max-width:150px;font-size:.8rem;color:var(--text-muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="' + esc(lead.remarks) + '">' + esc(lead.remarks) + '</td>' +
      '</tr>';
    }).join("");

    tbody.querySelectorAll(".lead-row").forEach(function (row) {
      const open = function () { openDrawer(Number(row.dataset.id)); };
      row.addEventListener("click", open);
      row.addEventListener("keydown", function (event) {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          open();
        }
      });
    });
  }

  function renderClosure() {
    document.getElementById("closure-tbody").innerHTML = LEADS.map(function (lead) {
      return '<tr><td><strong>' + esc(shortName(lead.name)) + '</strong></td>' +
        '<td><span class="status-pill ' + esc(lead.urgency) + '" style="font-size:.7rem">' + esc(urgencyLabel(lead.urgency)) + '</span></td>' +
        '<td style="font-size:.82rem">' + esc(lead.planType) + '</td>' +
        '<td class="premium-val">' + money(lead.premium) + '</td>' +
        '<td style="font-size:.8rem;color:var(--text-muted)">' + esc(lead.commission) + '</td></tr>';
    }).join("");
  }

  function renderCPF() {
    const dots = ["red", "blue", "amber", "green"];
    document.getElementById("cpf-list").innerHTML = LEADS.map(function (lead, idx) {
      const total = lead.cpfOA + lead.cpfSA;
      const pct = total ? Math.round(lead.cpfSA / total * 100) : 0;
      return '<li><span class="dot ' + dots[idx % dots.length] + '"></span><div class="activity-body">' +
        '<div class="activity-row"><span class="activity-name">' + esc(shortName(lead.name)) + '</span><span class="activity-time">SA: ' + pct + '% of total</span></div>' +
        '<p class="activity-desc">OA: ' + money(lead.cpfOA) + ' | SA: ' + money(lead.cpfSA) + ' | Total: ' + money(total) + '</p>' +
        '</div></li>';
    }).join("");
  }

  function openDrawer(id) {
    const lead = LEADS.find(function (l) { return l.id === id; });
    if (!lead) return;
    activeId = id;
    render();
    const overlay = document.getElementById("overlay");
    const drawer = document.getElementById("detail-drawer");
    document.getElementById("drawer-name").textContent = lead.name;
    document.getElementById("drawer-sub").textContent = lead.age + " yrs | " + lead.occupation + " | " + lead.stage;
    const avatarColor = AVATAR_COLORS[(lead.id - 1) % AVATAR_COLORS.length];
    const followUps = (lead.followUps || []).map(function (item) {
      return '<li class="timeline-item"><span class="t-dot ' + (item.done ? "done" : "pending") + '"></span><span class="t-text">' + esc(item.label) + '<small>' + formatDate(item.date) + " | " + (item.done ? "Completed" : "Pending") + "</small></span></li>";
    }).join("");
    document.getElementById("drawer-body").innerHTML =
      '<div class="detail-section"><div style="display:flex;gap:1rem;align-items:center;margin-bottom:1rem">' +
      '<div class="avatar-circle" style="background:' + avatarColor + '">' + initials(lead.name) + '</div><div>' +
      '<p style="margin:0;font-size:1.05rem;font-weight:700">' + esc(lead.name) + '</p>' +
      '<p style="margin:.1rem 0 0;font-size:.82rem;color:var(--text-muted)">' + esc(lead.occupation) + ' | ' + esc(lead.income) + '</p>' +
      '<p style="margin:.1rem 0 0;font-size:.82rem;color:var(--text-muted)">Referred by: <strong style="color:var(--text)">' + esc(lead.referredBy || "-") + '</strong></p></div></div>' +
      '<p class="detail-section-title">Contact Info</p><div class="detail-grid">' +
      '<div class="detail-item"><label>Phone</label><strong>' + esc(lead.contact) + '</strong></div>' +
      '<div class="detail-item"><label>Email</label><strong style="font-size:.82rem">' + esc(lead.email) + '</strong></div>' +
      '<div class="detail-item"><label>Urgency</label><span class="status-pill ' + esc(lead.urgency) + '">' + esc(urgencyLabel(lead.urgency)) + '</span></div>' +
      '<div class="detail-item"><label>Meeting Type</label><span class="badge-text">' + esc(lead.meetType) + '</span></div>' +
      '<div class="detail-item"><label>First Appointment</label><strong>' + formatDate(lead.meetDate) + '</strong></div>' +
      '<div class="detail-item"><label>Follow-up Date</label><strong>' + formatDate(nextFollowUp(lead)?.date) + '</strong></div>' +
      '<div class="detail-item"><label>Location</label><strong style="font-size:.84rem">' + esc(lead.location) + '</strong></div></div></div>' +
      '<div class="detail-section"><p class="detail-section-title">Financial Profile</p><div class="detail-grid">' +
      '<div class="detail-item"><label>CPF OA Balance</label><strong>' + money(lead.cpfOA) + '</strong></div>' +
      '<div class="detail-item"><label>CPF SA Balance</label><strong>' + money(lead.cpfSA) + '</strong></div>' +
      '<div class="detail-item"><label>Recommended Plan</label><strong>' + esc(lead.planType) + '</strong></div>' +
      '<div class="detail-item"><label>Est. Premium / yr</label><strong style="color:var(--brand)">' + money(lead.premium) + '</strong></div>' +
      '<div class="detail-item"><label>Commission Type</label><strong>' + esc(lead.commission) + '</strong></div>' +
      '<div class="detail-item"><label>Pipeline Stage</label><strong>' + esc(lead.stage) + '</strong></div></div></div>' +
      '<div class="detail-section"><p class="detail-section-title">Remarks</p><div class="remarks-box">' + esc(lead.remarks) + '</div></div>' +
      '<div class="detail-section"><p class="detail-section-title">Follow-up Timeline</p><ul class="timeline-list">' + (followUps || '<li class="timeline-item"><span class="t-text">No follow-ups found.</span></li>') + '</ul></div>';
    document.getElementById("btn-edit-lead").onclick = function () {
      window.location.href = "client-profile.html?id=" + encodeURIComponent(lead.id);
    };
    overlay.classList.add("open");
    drawer.classList.add("open");
  }

  function closeDrawer() {
    document.getElementById("overlay").classList.remove("open");
    document.getElementById("detail-drawer").classList.remove("open");
  }

  function bindEvents() {
    ["search-input", "urgency-filter", "type-filter", "date-filter"].forEach(function (id) {
      const el = document.getElementById(id);
      if (el) el.addEventListener("input", applyFilters);
      if (el) el.addEventListener("change", applyFilters);
    });
    document.getElementById("sort-select").addEventListener("change", function (event) {
      sortDir = event.target.value;
      applyFilters();
    });
    document.querySelectorAll(".lead-table th[data-col]").forEach(function (th) {
      th.addEventListener("click", function () {
        sortCol = th.dataset.col;
        sortDir = sortDir === "asc" ? "desc" : "asc";
        document.getElementById("sort-select").value = sortDir;
        applyFilters();
      });
    });
    document.getElementById("clear-btn").addEventListener("click", function () {
      document.getElementById("search-input").value = "";
      document.getElementById("urgency-filter").value = "";
      document.getElementById("type-filter").value = "";
      document.getElementById("date-filter").value = "";
      stageFilter = null;
      applyFilters();
    });
    document.getElementById("add-lead-btn").addEventListener("click", function () {
      window.location.href = "create-profile.html";
    });
    document.getElementById("drawer-close-btn").addEventListener("click", closeDrawer);
    document.getElementById("overlay").addEventListener("click", closeDrawer);
  }

  async function init() {
    document.getElementById("lead-tbody").innerHTML = '<tr><td colspan="10" style="text-align:center;padding:2rem;color:var(--text-muted)">Loading leads from database...</td></tr>';
    bindEvents();
    try {
      await loadLeads();
    } catch (err) {
      console.error("Failed to load leads", err);
      LEADS = [];
      filtered = [];
    }
    renderKPIs();
    sortData();
    render();
    renderClosure();
    renderCPF();
  }

  init();
})();
