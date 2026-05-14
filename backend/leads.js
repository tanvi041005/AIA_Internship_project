
const STAGES = ["Prospecting","Fact Find","Opening","Closing"];
const STAGE_COLORS = ["#d4a574","#a6192e","#8b5cf6","#1e3a8a"];
const URGENCY_ORDER = {urgent:0,medium:1,"non-urgent":2};
const AVATAR_COLORS = ["#a6192e","#3b82f6","#16a34a","#f59e0b","#8b5cf6","#ec4899"];

function formatCommissionRate(lead) {
  if (lead && lead.commissionRate !== undefined && lead.commissionRate !== null && lead.commissionRate !== "") {
    return `${Number(lead.commissionRate)}%`;
  }
  return lead && lead.commission ? lead.commission : "—";
}

function formatCommissionAmount(lead) {
  const amount = lead && lead.commissionAmount !== undefined && lead.commissionAmount !== null
    ? Number(lead.commissionAmount)
    : Number(lead.premium || 0) * Number(lead.commissionRate || 0) / 100;
  if (!Number.isFinite(amount) || amount <= 0) return "—";
  return `${(lead.currency === "USD" ? "USD" : "SGD")} ${amount.toLocaleString()}`;
}

let LEADS = [];
let filtered = [];
let sortCol = "meetDate", sortDir = "asc", activeId = null, stageFilter = null;

async function init(){
  const userId = sessionStorage.getItem("dashboardUser") || "A123";
  LEADS = (await apiGet('/leads?userId=' + userId)).map(mapLead);
  filtered = [...LEADS];
  renderKPIs();
  sortData();
  render();
  renderClosure();
  bindEvents();
}

function renderKPIs(){
  const urgent = LEADS.filter(l => l.urgency === "urgent").length;
  const totalPrem = LEADS.reduce((a,l) => a + l.premium, 0);
  const closing = LEADS.filter(l => l.stage === "Closing").length;
  const avgAge = Math.round(LEADS.reduce((a,l) => a + l.age, 0) / LEADS.length);
  const kpis = [
    {label:"Total Leads", val:LEADS.length, sub:`${urgent} urgent`},
    {label:"In Closing", val:closing, sub:"ready to sign"},
    {label:"Est. Annual Premium", val:"SGD "+totalPrem.toLocaleString(), sub:"across all leads"},
    {label:"Avg. Lead Age", val:avgAge+" yrs", sub:"average profile age"},
    {label:"Referral Rate", val:"67%", sub:"4 of 6 referred"},
  ];
  document.getElementById("kpi-grid").innerHTML = kpis.map(k => `
    <div class="kpi-card">
      <p class="kpi-label">${k.label}</p>
      <p class="kpi-value">${k.val}</p>
      <p class="kpi-sub">${k.sub}</p>
    </div>`).join("");
}

function applyFilters(){
  const search = document.getElementById("search-input").value.toLowerCase();
  const urg = document.getElementById("urgency-filter").value;
  const typ = document.getElementById("type-filter").value;
  const dt = document.getElementById("date-filter").value;
  filtered = LEADS.filter(l => {
    if(search && !l.name.toLowerCase().includes(search) && !l.location.toLowerCase().includes(search)) return false;
    if(urg && l.urgency !== urg) return false;
    if(typ && l.meetType !== typ) return false;
    if(dt && l.meetDate !== dt) return false;
    if(stageFilter && l.stage !== stageFilter) return false;
    return true;
  });
  sortData();
  render();
}

function sortData(){
  filtered.sort((a,b) => {
    let va = sortCol === "nextMeetDate" ? getNextMeetDate(a) : (a[sortCol] ?? a.name);
    let vb = sortCol === "nextMeetDate" ? getNextMeetDate(b) : (b[sortCol] ?? b.name);
    if(sortCol === "urgency"){ va = URGENCY_ORDER[a.urgency]; vb = URGENCY_ORDER[b.urgency]; }
    if(sortCol === "age" || sortCol === "premium"){ va = Number(va); vb = Number(vb); }
    if(va < vb) return sortDir === "asc" ? -1 : 1;
    if(va > vb) return sortDir === "asc" ? 1 : -1;
    return 0;
  });
}

function render(){
  document.getElementById("summary-line").textContent = `Showing ${filtered.length} of ${LEADS.length} leads`;
  document.querySelectorAll(".lead-table th[data-col]").forEach(th => {
    th.classList.toggle("sorted", th.dataset.col === sortCol);
    const arrow = th.querySelector(".sort-arrow");
    if(arrow) arrow.textContent = th.dataset.col === sortCol ? (sortDir === "asc" ? "↑" : "↓") : "↕";
  });
  const tbody = document.getElementById("lead-tbody");
  if(!filtered.length){
    tbody.innerHTML = `<tr><td colspan="10" style="text-align:center;padding:2rem;color:var(--text-muted)">No leads match the current filters.</td></tr>`;
    return;
  }
  tbody.innerHTML = filtered.map(l => `
    <tr class="lead-row${activeId === l.id ? " selected" : ""}" data-id="${l.id}" tabindex="0" role="button" aria-label="View details for ${l.name}">
      <td><strong class="lead-name">${l.name}</strong></td>
      <td>${l.age}</td>
      <td class="lead-contact">${l.contact}</td>
      <td class="lead-date">${formatDate(l.meetDate)}</td>
      <td class="lead-date">${formatDate(getNextMeetDate(l))}</td>
      <td class="lead-location" title="${l.location}">${l.location}</td>
      <td><span class="badge ${l.meetType.toLowerCase()}">${l.meetType}</span></td>
      <td><span class="status-pill ${l.urgency}">${cap(l.urgency)}</span></td>
      <td><span class="stage-pill ${stageClass(l.stage)}">${l.stage}</span></td>
      <td class="lead-remarks" title="${l.remarks}">${l.remarks}</td>
    </tr>`).join("");
}

function formatDate(d){
  if(!d) return "—";
  const [y,m,dd] = d.split("-");
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  return `${parseInt(dd)} ${months[parseInt(m)-1]} ${y}`;
}

function getNextMeetDate(lead){
  if(lead.nextMeetDate) return lead.nextMeetDate;
  const pending = (lead.followUps || [])
    .filter(f => !f.done && f.date)
    .sort((a,b) => a.date.localeCompare(b.date));
  return pending[0]?.date || "";
}

function cap(s){ return s.charAt(0).toUpperCase() + s.slice(1); }

function initials(name){ return name.split(" ").map(w=>w[0]).slice(0,2).join("").toUpperCase(); }

function stageClass(stage){ return stage.toLowerCase().replace(/\s+/g, "-"); }

function openDrawer(id){
  const lead = LEADS.find(l => l.id === id);
  if(!lead) return;
  const currency = lead.currency === "USD" ? "USD" : "SGD";
  activeId = id;
  render();
  document.getElementById("drawer-name").textContent = lead.name;
  document.getElementById("drawer-sub").textContent = `${lead.age} yrs · ${lead.occupation} · ${lead.stage}`;
  const col = AVATAR_COLORS[(id-1) % AVATAR_COLORS.length];
  document.getElementById("drawer-body").innerHTML = `
    <div class="detail-section">
      <div style="display:flex;gap:1rem;align-items:center;margin-bottom:1rem">
        <div class="avatar-circle" style="background:${col}">${initials(lead.name)}</div>
        <div>
          <p style="margin:0;font-size:1.05rem;font-weight:700">${lead.name}</p>
          <p style="margin:.1rem 0 0;font-size:.82rem;color:var(--text-muted)">${lead.occupation} · ${lead.income}</p>
          <p style="margin:.1rem 0 0;font-size:.82rem;color:var(--text-muted)">Referred by: <strong style="color:var(--text)">${lead.referredBy}</strong></p>
        </div>
      </div>
      <p class="detail-section-title">Contact Info</p>
      <div class="detail-grid">
        <div class="detail-item"><label>Phone</label><strong>${lead.contact}</strong></div>
        <div class="detail-item"><label>Email</label><strong style="font-size:.82rem">${lead.email}</strong></div>
        <div class="detail-item"><label>Urgency</label><span class="status-pill ${lead.urgency}">${cap(lead.urgency)}</span></div>
        <div class="detail-item"><label>Meeting Type</label><span class="badge ${lead.meetType.toLowerCase()}">${lead.meetType}</span></div>
        <div class="detail-item"><label>First Appointment</label><strong>${formatDate(lead.meetDate)}</strong></div>
        <div class="detail-item"><label>Follow-up Date</label><strong>${formatDate(getNextMeetDate(lead))}</strong></div>
        <div class="detail-item"><label>Location</label><strong style="font-size:.84rem">${lead.location}</strong></div>
      </div>
    </div>
    <div class="detail-section">
      <p class="detail-section-title">Financial Profile</p>
      <div class="detail-grid">
        <div class="detail-item"><label>Monthly Income</label><strong>${lead.income || "—"}</strong></div>
        <div class="detail-item"><label>General Expense</label><strong>${lead.generalExpense || "—"}</strong></div>
        <div class="detail-item"><label>Surplus</label><strong>${lead.surplus || "—"}</strong></div>
        <div class="detail-item" style="grid-column:1/-1"><label>Existing Plans</label><strong>${lead.existingPlans || "No existing plans recorded"}</strong></div>
        <div class="detail-item"><label>General Plan Type</label><strong>${lead.generalPlanType || "—"}</strong></div>
        <div class="detail-item"><label>Specific Plan Type</label><strong>${lead.specificPlanType || lead.planType || "—"}</strong></div>
        <div class="detail-item"><label>Sum Assured</label><strong>${lead.sumAssured ? `${currency} ${Number(lead.sumAssured).toLocaleString()}` : "—"}</strong></div>
        <div class="detail-item"><label>CPF OA Balance</label><strong>SGD ${lead.cpfOA.toLocaleString()}</strong></div>
        <div class="detail-item"><label>CPF SA Balance</label><strong>SGD ${lead.cpfSA.toLocaleString()}</strong></div>
        <div class="detail-item"><label>Recommended Plan</label><strong>${lead.specificPlanType || lead.planType}</strong></div>
        <div class="detail-item"><label>Est. Premium / yr</label><strong style="color:var(--brand)">${currency} ${lead.premium.toLocaleString()}</strong></div>
        <div class="detail-item"><label>Commission Rate</label><strong>${formatCommissionRate(lead)}</strong></div>
        <div class="detail-item"><label>Commission Amount</label><strong>${formatCommissionAmount(lead)}</strong></div>
        <div class="detail-item"><label>Pipeline Stage</label><span class="stage-pill ${stageClass(lead.stage)}">${lead.stage}</span></div>
      </div>
    </div>
    <div class="detail-section">
      <p class="detail-section-title">Remarks</p>
      <div class="remarks-box">${lead.remarks}</div>
    </div>
    <div class="detail-section">
      <p class="detail-section-title">Follow-up Timeline</p>
      <ul class="timeline-list">
        ${lead.followUps.map(f => `
          <li class="timeline-item">
            <span class="t-dot ${f.done ? "done" : "pending"}"></span>
            <span class="t-text">${f.label}<small>${formatDate(f.date)} · ${f.done ? "Completed" : "Pending"}</small></span>
          </li>`).join("")}
      </ul>
    </div>`;
  document.getElementById("detail-drawer").classList.add("open");
  document.getElementById("overlay").classList.add("open");
  document.getElementById("drawer-close-btn").focus();
}

function closeDrawer(){
  activeId = null;
  render();
  document.getElementById("detail-drawer").classList.remove("open");
  document.getElementById("overlay").classList.remove("open");
}

function renderClosure(){
  document.getElementById("closure-tbody").innerHTML = LEADS.map(l => `
    <tr>
      <td><strong>${l.name.split(" ")[0]} ${l.name.split(" ").slice(-1)[0]}</strong></td>
      <td><span class="status-pill ${l.urgency}" style="font-size:.7rem">${cap(l.urgency)}</span></td>
      <td style="font-size:.82rem">${l.specificPlanType || l.planType}</td>
      <td class="premium-val">${(l.currency === "USD" ? "USD" : "SGD")} ${l.premium.toLocaleString()}</td>
      <td style="font-size:.8rem;color:var(--text-muted)">${formatCommissionRate(l)}</td>
    </tr>`).join("");
}

function bindEvents(){
  document.getElementById("search-input").addEventListener("input", applyFilters);
  document.getElementById("urgency-filter").addEventListener("change", applyFilters);
  document.getElementById("type-filter").addEventListener("change", applyFilters);
  document.getElementById("date-filter").addEventListener("change", applyFilters);
  document.getElementById("sort-select").addEventListener("change", e => {
    sortDir = e.target.value; sortData(); render();
  });
  document.getElementById("clear-btn").addEventListener("click", () => {
    document.getElementById("search-input").value = "";
    document.getElementById("urgency-filter").value = "";
    document.getElementById("type-filter").value = "";
    document.getElementById("date-filter").value = "";
    stageFilter = null;
    filtered = [...LEADS]; sortData(); render();
  });
  document.getElementById("add-lead-btn").addEventListener("click", () => {
    window.location.href = "create-profile.html";
  });
  document.getElementById("drawer-close-btn").addEventListener("click", closeDrawer);
  document.getElementById("overlay").addEventListener("click", closeDrawer);
  document.getElementById("btn-edit-lead").addEventListener("click", () => {
    if(activeId) window.location.href = `client-profile.html?id=${activeId}`;
  });
  document.getElementById("lead-tbody").addEventListener("click", e => {
    const row = e.target.closest("tr[data-id]");
    if(!row) return;
    window.location.href = `client-profile.html?id=${row.dataset.id}`;
  });
  document.getElementById("lead-tbody").addEventListener("keydown", e => {
    if(e.key !== "Enter" && e.key !== " ") return;
    const row = e.target.closest("tr[data-id]");
    if(!row) return;
    e.preventDefault();
    window.location.href = `client-profile.html?id=${row.dataset.id}`;
  });
  document.querySelectorAll(".lead-table th[data-col]").forEach(th => {
    th.addEventListener("click", () => {
      if(sortCol === th.dataset.col) sortDir = sortDir === "asc" ? "desc" : "asc";
      else { sortCol = th.dataset.col; sortDir = "asc"; }
      sortData(); render();
    });
  });
  document.addEventListener("keydown", e => {
    if(e.key === "Escape" && activeId) closeDrawer();
  });
}

init();
