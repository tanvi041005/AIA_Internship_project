
const STAGES = ["Prospecting","Fact Find","Opening","Closing"];
const STAGE_COLORS = ["#d4a574","#a6192e","#8b5cf6","#1e3a8a"];
const LEADS_STORAGE_KEY = "financial_leads_data";
const URGENCY_ORDER = {urgent:0,medium:1,"non-urgent":2};
const AVATAR_COLORS = ["#a6192e","#3b82f6","#16a34a","#f59e0b","#8b5cf6","#ec4899"];

function normalizeId(value) {
  return String(value == null ? "" : value).trim();
}

function normalizeDateValue(value) {
  if (!value) return "";
  if (typeof toSGDate === "function") return toSGDate(value);
  const text = String(value);
  const match = text.match(/^(\d{4}-\d{2}-\d{2})/);
  return match ? match[1] : text;
}

function normalizeFollowUps(followUps) {
  return (Array.isArray(followUps) ? followUps : [])
    .map((item) => ({
      label: item.label || "",
      date: normalizeDateValue(item.date || item.scheduled_date),
      done: !!(item.done || item.is_done),
      isFirstMeetup: !!item.isFirstMeetup,
    }))
    .filter((item) => item.label || item.date || item.done);
}

function normalizeLead(lead) {
  return {
    ...lead,
    id: lead.id != null ? lead.id : lead.lead_id,
    meetDate: normalizeDateValue(lead.meetDate || lead.meet_date),
    nextMeetDate: normalizeDateValue(lead.nextMeetDate),
    followUps: normalizeFollowUps(lead.followUps || lead.follow_ups),
    premium: Number(lead.premium || lead.annual_premium || 0),
    cpfOA: Number(lead.cpfOA || lead.cpf_oa || 0),
    cpfSA: Number(lead.cpfSA || lead.cpf_sa || 0),
  };
}

function getStoredLeads() {
  try {
    const stored = JSON.parse(localStorage.getItem(LEADS_STORAGE_KEY) || "[]");
    return Array.isArray(stored) ? stored.map(normalizeLead) : [];
  } catch (e) {
    return [];
  }
}

function saveStoredLeads(leads) {
  localStorage.setItem(LEADS_STORAGE_KEY, JSON.stringify((Array.isArray(leads) ? leads : []).map(normalizeLead)));
}

function mergeLeads(remoteLeads, localLeads) {
  const merged = new Map();
  (remoteLeads || []).map(normalizeLead).forEach((lead) => merged.set(normalizeId(lead.id), lead));
  (localLeads || []).map(normalizeLead).forEach((lead) => {
    const key = normalizeId(lead.id);
    if (!key) return;
    merged.set(key, { ...(merged.get(key) || {}), ...lead });
  });
  return Array.from(merged.values());
}

function calculateLatestFollowUpDate(followUps) {
  const dates = normalizeFollowUps(followUps).map((item) => item.date).filter(Boolean).sort();
  return dates.length ? dates[dates.length - 1] : "";
}

function buildLeadExtraPayload(lead) {
  return {
    specificPlanType: lead.specificPlanType || "",
    generalPlanType: lead.generalPlanType || "",
    commissionRate: lead.commissionRate || 0,
    commissionAmount: lead.commissionAmount || 0,
    cpfMA: lead.cpfMA || 0,
    bankBalance: lead.bankBalance || 0,
    generalExpense: lead.generalExpense || "",
    surplus: lead.surplus || "",
    existingPlans: lead.existingPlans || "",
    existingPlansList: lead.existingPlansList || [],
    currency: lead.currency === "USD" ? "USD" : "SGD",
    sumAssured: lead.sumAssured || 0,
    agency: lead.agency || "",
    proposedPlans: lead.proposedPlans || [],
    noReferrals: !!lead.noReferrals,
    referredByLeadId: lead.referredByLeadId || "",
    birthDate: lead.birthDate || "",
    nextMeetDate: lead.nextMeetDate || calculateLatestFollowUpDate(lead.followUps),
  };
}

function leadToApiPayload(lead) {
  const normalized = normalizeLead(lead);
  return {
    name: normalized.name || "New Lead",
    age: normalized.age || null,
    contact: cleanContact(normalized.contact),
    email: normalized.email || null,
    meet_date: normalized.meetDate || null,
    location: normalized.location || null,
    meet_type: normalized.meetType || "Physical",
    urgency: normalized.urgency || "non-urgent",
    stage: normalized.stage || "Prospecting",
    remarks: normalized.remarks || null,
    plan_type: normalized.specificPlanType || normalized.planType || null,
    annual_premium: normalized.premium || null,
    commission_type: normalized.commission || null,
    cpf_oa: normalized.cpfOA || null,
    cpf_sa: normalized.cpfSA || null,
    occupation: normalized.occupation || null,
    income: normalized.income || null,
    referred_by: normalized.referredBy || null,
    owner_id: normalized.ownerId || sessionStorage.getItem("dashboardUser") || null,
    extra: buildLeadExtraPayload(normalized),
    followUps: normalizeFollowUps(normalized.followUps).map((item) => ({
      label: item.label || "Follow-up",
      scheduled_date: item.date || null,
      is_done: !!item.done,
    })),
  };
}

async function persistLead(lead) {
  const payload = leadToApiPayload(lead);
  if (typeof apiPost !== "function" || typeof apiPut !== "function" || !payload.owner_id) return normalizeLead(lead);
  if (/^\d{1,10}$/.test(String(lead.id || ""))) {
    await apiPut("/leads/" + encodeURIComponent(lead.id), payload);
    return normalizeLead(lead);
  }
  const saved = await apiPost("/leads", payload);
  return normalizeLead({ ...lead, id: saved.lead_id || saved.id || lead.id, ownerId: payload.owner_id });
}

function formatCommissionRate(lead) {
  if (lead && lead.commissionRate !== undefined && lead.commissionRate !== null && lead.commissionRate !== "") {
    return String(Number(lead.commissionRate));
  }
  return "—";
}

function formatCommissionAmount(lead) {
  const amount = lead && lead.commissionAmount !== undefined && lead.commissionAmount !== null
    ? Number(lead.commissionAmount)
    : Number(lead.premium || 0) * Number(lead.commissionRate || 0) / 100;
  if (!Number.isFinite(amount) || amount <= 0) return "—";
  return `${(lead.currency === "USD" ? "USD" : "SGD")} ${amount.toLocaleString()}`;
}

function cleanContact(value) {
  return String(value || "").replace(/\D/g, "").slice(0, 8);
}

function followUpsWithFirstMeetup(lead) {
  const items = Array.isArray(lead.followUps) ? [...lead.followUps] : [];
  if (lead.meetDate && !items.some((f) => f && (f.isFirstMeetup || (f.label === "First Meet-up" && f.date === lead.meetDate)))) {
    items.unshift({ label: "First Meet-up", date: lead.meetDate, done: true, isFirstMeetup: true });
  }
  // Ensure there is a default Follow-up step (pending) for display
  if (!items.some((it) => it && String(it.label).toLowerCase() === "follow-up")) {
    items.push({ label: "Follow-up", date: "", done: false });
  }
  return items;
}

let LEADS = [];
let filtered = [];
let sortCol = "meetDate", sortDir = "asc", activeId = null, stageFilter = null;

async function init(){
  const userId = sessionStorage.getItem("dashboardUser") || "";
  const localLeads = getStoredLeads();
  let remoteLeads = [];
  try {
    remoteLeads = typeof apiGet === "function"
      ? (await apiGet('/leads' + (userId ? '?userId=' + encodeURIComponent(userId) : ''))).map(mapLead)
      : [];
  } catch (e) {
    console.warn("Failed to load leads from API:", e);
  }
  LEADS = mergeLeads(remoteLeads, localLeads);
  saveStoredLeads(LEADS);
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
  const avgAge = LEADS.length ? Math.round(LEADS.reduce((a,l) => a + Number(l.age || 0), 0) / LEADS.length) : 0;
  const referred = LEADS.filter(l => l.referredBy && l.referredBy.trim() !== "").length;
  const refRate = LEADS.length > 0 ? Math.round(referred / LEADS.length * 100) : 0;
  const avgCase = LEADS.length ? Math.round(totalPrem / LEADS.length) : 0;
  const kpis = [
    {label:"Total Leads", val:LEADS.length, sub:`${urgent} urgent`},
    {label:"In Closing", val:closing, sub:"ready to sign"},
    {label:"Est. Annual Premium", val:"SGD "+totalPrem.toLocaleString(), sub:"across all leads"},
    {label:"Avg. Case Size", val: "SGD " + avgCase.toLocaleString(), sub: "per lead"},
    {label:"Avg. Lead Age", val:LEADS.length ? avgAge+" yrs" : "—", sub:"average profile age"},
    {label:"Referral Rate", val:refRate+"%", sub:`${referred} of ${LEADS.length} referred`},
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
  const typFilter = document.getElementById("type-filter");
  const typ = typFilter ? typFilter.value : "";
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
    th.classList.remove("sorted");
    const arrow = th.querySelector(".sort-arrow");
    if(arrow) arrow.remove();
  });
  const tbody = document.getElementById("lead-tbody");
  if(!filtered.length){
    tbody.innerHTML = `<tr><td colspan="8" style="text-align:center;padding:2rem;color:var(--text-muted)">No leads match the current filters.</td></tr>`;
    return;
  }
  tbody.innerHTML = filtered.map(l => {
    const col = AVATAR_COLORS[Math.abs(l.id) % AVATAR_COLORS.length];
    return `
    <tr class="lead-row${activeId === l.id ? " selected" : ""}" data-id="${l.id}" tabindex="0" role="button" aria-label="View details for ${l.name}">
      <td>
        <div class="lead-name-cell">
          <div class="lead-mini-avatar" style="background:${col}">${initials(l.name)}</div>
          <strong class="lead-name">${l.name}</strong>
        </div>
      </td>
      <td>${l.age}</td>
      <td class="lead-contact">${cleanContact(l.contact)}</td>
      <td class="lead-date">${formatDate(l.meetDate)}</td>
      <td class="lead-date">${formatDate(getNextMeetDate(l))}</td>
      <td><span class="status-pill ${l.urgency}">${cap(l.urgency)}</span></td>
      <td><span class="stage-pill ${stageClass(l.stage)}">${l.stage}</span></td>
      <td class="lead-remarks" title="${l.remarks}">${l.remarks}</td>
    </tr>`;
  }).join("");
}

function formatDate(d){
  if(!d) return "—";
  const [y,m,dd] = d.split("-");
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  return `${parseInt(dd)} ${months[parseInt(m)-1]} ${y}`;
}

function getNextMeetDate(lead){
  if(lead.nextMeetDate) return normalizeDateValue(lead.nextMeetDate);
  return calculateLatestFollowUpDate(lead.followUps);
}

function cap(s){ return s.charAt(0).toUpperCase() + s.slice(1); }

function initials(name){ return name.split(" ").map(w=>w[0]).slice(0,2).join("").toUpperCase(); }

function stageClass(stage){ return (stage||'').toLowerCase().replace(/[\s-]+/g, "-"); }

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
        <div class="detail-item"><label>Phone</label><strong>${cleanContact(lead.contact)}</strong></div>
        <div class="detail-item"><label>Email</label><strong style="font-size:.82rem">${lead.email}</strong></div>
        <div class="detail-item"><label>Urgency</label><span class="status-pill ${lead.urgency}">${cap(lead.urgency)}</span></div>
        <div class="detail-item"><label>First Appointment</label><strong>${formatDate(lead.meetDate)}</strong></div>
        <div class="detail-item"><label>Follow-up Date</label><strong>${formatDate(getNextMeetDate(lead))}</strong></div>
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
        ${followUpsWithFirstMeetup(lead).map(f => `
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

function parseExcelFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = e.target.result;
        const workbook = XLSX.read(data, { type: 'binary' });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const rows = XLSX.utils.sheet_to_json(sheet);
        
        if (!rows || rows.length === 0) {
          reject(new Error("No data found in Excel file"));
          return;
        }
        
        // Get the first row
        const rowData = rows[0];
        resolve(rowData);
      } catch (error) {
        reject(new Error("Failed to parse Excel file: " + error.message));
      }
    };
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.readAsBinaryString(file);
  });
}

function mapExcelDataToLead(excelData) {
  // Mapping of Excel column headers to lead object properties
  const columnMapping = {
    'Full Name': 'name',
    'Name': 'name',
    'Age': 'age',
    'Contact Number': 'contact',
    'Contact': 'contact',
    'Email Address': 'email',
    'Email': 'email',
    'Meet-up Date': 'meetDate',
    'Meeting Date': 'meetDate',
    'Date': 'meetDate',
    'Meeting Type': 'meetType',
    'Type': 'meetType',
    'Location': 'location',
    'Urgency': 'urgency',
    'Stage': 'stage',
    'Pipeline Stage': 'stage',
    'Occupation': 'occupation',
    'Job Title': 'occupation',
    'Monthly Income': 'income',
    'Income': 'income',
    'General Expense': 'generalExpense',
    'Expense': 'generalExpense',
    'Surplus': 'surplus',
    'CPF OA Balance': 'cpfOA',
    'CPF OA': 'cpfOA',
    'CPF SA Balance': 'cpfSA',
    'CPF SA': 'cpfSA',
    'General Plan Type': 'generalPlanType',
    'Plan Category': 'generalPlanType',
    'Specific Plan Type': 'specificPlanType',
    'Plan Type': 'specificPlanType',
    'Product': 'specificPlanType',
    'Currency': 'currency',
    'Sum Assured': 'sumAssured',
    'Coverage Amount': 'sumAssured',
    'Premium': 'premium',
    'Premium (Yearly)': 'premium',
    'Annual Premium': 'premium',
    'Commission Rate': 'commissionRate',
    'Referred By': 'referredBy',
    'Referrer': 'referredBy',
    'Existing Plans': 'existingPlans',
    'Plans': 'existingPlans',
    'Remarks': 'remarks',
    'Notes': 'remarks'
  };

  const lead = {
    id: Date.now(),
    name: '',
    age: 0,
    contact: '',
    email: '',
    meetDate: '',
    meetType: 'Physical',
    location: '',
    urgency: 'non-urgent',
    stage: 'Prospecting',
    occupation: '',
    income: '',
    generalExpense: '',
    surplus: '',
    cpfOA: 0,
    cpfSA: 0,
    currency: 'SGD',
    generalPlanType: '',
    specificPlanType: '',
    planType: '',
    sumAssured: 0,
    premium: 0,
    commissionRate: 0,
    commissionAmount: 0,
    referredBy: '',
    existingPlansList: [],
    existingPlans: '',
    remarks: '',
    owner: 'agent',
    followUps: [
      {label: "Lead Created", date: new Date().toISOString().split('T')[0], done: true}
    ]
  };

  // Map Excel data to lead object
  for (const [excelHeader, value] of Object.entries(excelData)) {
    const fieldName = columnMapping[excelHeader];
    
    if (!fieldName || !value) continue;

    const stringValue = String(value).trim();
    
    if (fieldName === 'existingPlans') {
      const plansArray = stringValue
        .split(/\r?\n|,|;/)
        .map(p => p.trim())
        .filter(p => p.length > 0);
      lead.existingPlansList = plansArray;
      lead.existingPlans = plansArray.join(", ");
    } else if (fieldName === 'age' || fieldName === 'cpfOA' || fieldName === 'cpfSA' || fieldName === 'sumAssured' || fieldName === 'premium') {
      lead[fieldName] = parseInt(stringValue, 10) || 0;
    } else if (fieldName === 'commissionRate') {
      lead[fieldName] = parseFloat(stringValue) || 0;
    } else {
      lead[fieldName] = stringValue;
    }
  }

  // Calculate commission amount
  if (lead.premium && lead.commissionRate) {
    lead.commissionAmount = (lead.premium * lead.commissionRate) / 100;
  }

  return lead;
}

function handleExcelFileUpload(file, closeModalCallback) {
  const uploadSuccess = document.getElementById("upload-success-modal");
  const uploadError = document.getElementById("upload-error-modal");
  
  // Validate file type
  const validTypes = ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/vnd.ms-excel'];
  if (!validTypes.includes(file.type)) {
    uploadError.textContent = '✗ Invalid file type. Please upload an Excel file (.xlsx or .xls)';
    uploadError.style.display = 'block';
    return;
  }

  // Parse Excel and create lead
  parseExcelFile(file)
    .then(async (excelData) => {
      let newLead = mapExcelDataToLead(excelData);
      try {
        newLead = await persistLead(newLead);
      } catch (e) {
        console.warn("Failed to save imported lead to API; cached locally:", e);
      }
      LEADS = mergeLeads(LEADS, [newLead]);
      saveStoredLeads(LEADS);
      
      // Show success message
      uploadSuccess.style.display = 'block';
      
      // Redirect to client profile after short delay
      setTimeout(() => {
        window.location.href = `client-profile.html?id=${encodeURIComponent(newLead.id)}`;
      }, 1000);
    })
    .catch((error) => {
      uploadError.textContent = '✗ ' + error.message;
      uploadError.style.display = 'block';
    });
}

function bindEvents(){
  document.getElementById("search-input").addEventListener("input", applyFilters);
  document.getElementById("urgency-filter").addEventListener("change", applyFilters);
  const typeFilter = document.getElementById("type-filter");
  if (typeFilter) typeFilter.addEventListener("change", applyFilters);
  document.getElementById("date-filter").addEventListener("change", applyFilters);
  document.getElementById("sort-select").addEventListener("change", e => {
    sortDir = e.target.value; sortData(); render();
  });
  document.getElementById("clear-btn").addEventListener("click", () => {
    document.getElementById("search-input").value = "";
    document.getElementById("urgency-filter").value = "";
    if (typeFilter) typeFilter.value = "";
    document.getElementById("date-filter").value = "";
    stageFilter = null;
    filtered = [...LEADS]; sortData(); render();
  });
  
  // Excel Import Modal
  const modal = document.getElementById("excel-import-modal");
  const dropzone = document.getElementById("excel-dropzone-modal");
  const fileInput = document.getElementById("excel-upload-input-modal");
  const modalCloseBtn = document.getElementById("modal-close-btn");
  const modalOverlay = document.querySelector(".modal-overlay");
  const uploadSuccess = document.getElementById("upload-success-modal");
  const uploadError = document.getElementById("upload-error-modal");
  const manualFillBtn = document.getElementById("manual-fill-btn");

  // Open modal on "Add Lead" button click
  document.getElementById("add-lead-btn").addEventListener("click", () => {
    modal.style.display = "flex";
    uploadSuccess.style.display = "none";
    uploadError.style.display = "none";
  });

  // Close modal
  function closeModal() {
    modal.style.display = "none";
    uploadSuccess.style.display = "none";
    uploadError.style.display = "none";
    fileInput.value = "";
  }

  modalCloseBtn.addEventListener("click", closeModal);
  modalOverlay.addEventListener("click", closeModal);
  
  // Manual fill button - create new lead and navigate to client profile
  manualFillBtn.addEventListener("click", async () => {
    const newLeadId = Date.now();
    
    // Create empty lead
    const newLead = {
      id: newLeadId,
      name: 'New Lead',
      age: '',
      contact: '',
      email: '',
      meetDate: '',
      meetType: 'Physical',
      location: '',
      urgency: 'non-urgent',
      stage: 'Prospecting',
      occupation: '',
      income: '',
      generalExpense: '',
      surplus: '',
      cpfOA: 0,
      cpfSA: 0,
      currency: 'SGD',
      generalPlanType: '',
      specificPlanType: '',
      planType: '',
      sumAssured: 0,
      premium: 0,
      commissionRate: 0,
      commissionAmount: 0,
      referredBy: '',
      existingPlansList: [],
      existingPlans: '',
      remarks: '',
      owner: 'agent',
      followUps: [
        {label: "Lead Created", date: new Date().toISOString().split('T')[0], done: true}
      ]
    };
    
    try {
      const savedLead = await persistLead(newLead);
      LEADS = mergeLeads(LEADS, [savedLead]);
      saveStoredLeads(LEADS);
      window.location.href = `client-profile.html?id=${encodeURIComponent(savedLead.id)}`;
    } catch (e) {
      console.warn("Failed to save lead draft to API; cached locally:", e);
      LEADS = mergeLeads(LEADS, [newLead]);
      saveStoredLeads(LEADS);
      window.location.href = `client-profile.html?id=${newLeadId}`;
    }
  });

  // Dropzone interactions
  dropzone.addEventListener("click", () => fileInput.click());

  dropzone.addEventListener("dragover", (e) => {
    e.preventDefault();
    e.stopPropagation();
    dropzone.classList.add("active");
  });

  dropzone.addEventListener("dragleave", () => {
    dropzone.classList.remove("active");
  });

  dropzone.addEventListener("drop", (e) => {
    e.preventDefault();
    e.stopPropagation();
    dropzone.classList.remove("active");
    
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      handleExcelFileUpload(files[0], closeModal);
    }
  });

  fileInput.addEventListener("change", (e) => {
    if (e.target.files.length > 0) {
      handleExcelFileUpload(e.target.files[0], closeModal);
    }
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
  document.addEventListener("keydown", e => {
    if(e.key === "Escape" && activeId) closeDrawer();
  });

  // Listen for localStorage changes (made by client-profile page) and refresh leads view
  window.addEventListener('storage', (e) => {
    if (e.key !== LEADS_STORAGE_KEY) return;
    try {
      const newVal = JSON.parse(e.newValue || '[]') || [];
      LEADS = Array.isArray(newVal) ? newVal.map(normalizeLead) : [];
      filtered = [...LEADS];
      renderKPIs();
      sortData();
      render();
      renderClosure();
    } catch (err) { /* ignore parse errors */ }
  });
}

init();
