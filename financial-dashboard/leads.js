const STORAGE_KEY = "financial_leads_data";

const DEFAULT_LEADS = [
  {
    id:1,name:"Lim Wei Jie",age:34,contact:"9123-4567",email:"weijie.lim@email.com",
    meetDate:"2025-05-12",location:"Toa Payoh HDB",meetType:"Physical",urgency:"urgent",stage:"Proposal Sent",
    remarks:"Interested in term life; wife expecting. Has existing GE policy expiring soon.",
    planType:"Term Life",premium:2400,commission:"FYC",cpfSA:42000,cpfOA:88000,
    occupation:"Software Engineer",income:"SGD 7,200/mo",referredBy:"John Tan",
    followUps:[
      {label:"Initial meeting",date:"2025-04-30",done:true},
      {label:"Proposal sent",date:"2025-05-05",done:true},
      {label:"Follow-up call",date:"2025-05-14",done:false},
      {label:"Closing",date:"2025-05-20",done:false}
    ]
  },
  {
    id:2,name:"Nur Aisyah Binte Rahman",age:28,contact:"8234-5678",email:"aisyah.r@email.com",
    meetDate:"2025-05-15",location:"Tampines Mall",meetType:"Online",urgency:"medium",stage:"Fact-Find",
    remarks:"Self-employed, irregular income. Keen on savings plan for rainy day fund.",
    planType:"Endowment",premium:3600,commission:"Trail",cpfSA:18000,cpfOA:31000,
    occupation:"Freelance Designer",income:"SGD 3,800/mo (avg)",referredBy:"Self (Instagram)",
    followUps:[
      {label:"Intro call",date:"2025-05-10",done:true},
      {label:"Fact-find session",date:"2025-05-15",done:false},
      {label:"Needs analysis",date:"2025-05-22",done:false}
    ]
  },
  {
    id:3,name:"Chen Jia Hao",age:42,contact:"9345-6789",email:"jiahao.chen@corp.sg",
    meetDate:"2025-05-08",location:"Raffles Place (Client Office)",meetType:"Physical",urgency:"urgent",stage:"Closing",
    remarks:"Director-level. Needs keyman insurance + personal CI cover. Decide by end of month.",
    planType:"CI + Keyman",premium:9800,commission:"FYC",cpfSA:95000,cpfOA:180000,
    occupation:"Company Director",income:"SGD 22,000/mo",referredBy:"Existing client (Peter Goh)",
    followUps:[
      {label:"Discovery",date:"2025-04-22",done:true},
      {label:"Proposal",date:"2025-05-02",done:true},
      {label:"Negotiation",date:"2025-05-08",done:true},
      {label:"Closing sign-off",date:"2025-05-15",done:false}
    ]
  },
  {
    id:4,name:"Priya Nair",age:31,contact:"9456-7890",email:"priya.nair@gmail.com",
    meetDate:"2025-05-20",location:"Jurong East CC",meetType:"Hybrid",urgency:"non-urgent",stage:"Prospecting",
    remarks:"Teacher. Wants ILP for long-term growth. No rush — reviewing options with husband.",
    planType:"ILP",premium:4200,commission:"Trail",cpfSA:28000,cpfOA:54000,
    occupation:"Secondary School Teacher",income:"SGD 4,500/mo",referredBy:"Colleague referral",
    followUps:[
      {label:"WhatsApp intro",date:"2025-05-17",done:true},
      {label:"Meet-up",date:"2025-05-20",done:false},
      {label:"Proposal",date:"2025-05-28",done:false}
    ]
  },
  {
    id:5,name:"Marcus Tan Boon Kiat",age:38,contact:"9567-8901",email:"marcus.tbk@finco.com",
    meetDate:"2025-05-06",location:"CBD (Zoom)",meetType:"Online",urgency:"urgent",stage:"Needs Analysis",
    remarks:"Planning early retirement at 55. HNW profile — keen on wealth accumulation + legacy planning.",
    planType:"Whole Life + Trust",premium:24000,commission:"FYC + Trail",cpfSA:150000,cpfOA:320000,
    occupation:"VP Finance",income:"SGD 18,000/mo",referredBy:"Wealth manager partner",
    followUps:[
      {label:"Zoom intro",date:"2025-05-01",done:true},
      {label:"Needs analysis",date:"2025-05-06",done:true},
      {label:"Solutioning",date:"2025-05-12",done:false},
      {label:"Proposal",date:"2025-05-19",done:false}
    ]
  },
  {
    id:6,name:"Sandra Loh Mei Ling",age:55,contact:"8678-9012",email:"sandraloh@email.com",
    meetDate:"2025-05-25",location:"Woodlands Civic Centre",meetType:"Physical",urgency:"non-urgent",stage:"Fact-Find",
    remarks:"Near retirement. Reviewing existing Prudential policies. Possible DPS lapse to address.",
    planType:"Retirement + MediShield",premium:1800,commission:"Trail",cpfSA:65000,cpfOA:120000,
    occupation:"Admin Executive (Govt)",income:"SGD 3,200/mo",referredBy:"Daughter's recommendation",
    followUps:[
      {label:"Phone call",date:"2025-05-20",done:true},
      {label:"Fact-find",date:"2025-05-25",done:false}
    ]
  }
];

const STAGES = ["Prospecting","Fact-Find","Needs Analysis","Proposal Sent","Closing"];
const STAGE_COLORS = ["#6b7280","#3b82f6","#f59e0b","#a855f7","#a6192e"];
const URGENCY_ORDER = {urgent:0,medium:1,"non-urgent":2};
const AVATAR_COLORS = ["#a6192e","#3b82f6","#16a34a","#f59e0b","#8b5cf6","#ec4899"];

let LEADS = JSON.parse(localStorage.getItem(STORAGE_KEY)) || DEFAULT_LEADS;
let filtered = [...LEADS];
let sortCol = "meetDate", sortDir = "asc", activeId = null, stageFilter = null;

function init(){
  if(!localStorage.getItem(STORAGE_KEY)) localStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULT_LEADS));
  renderKPIs();
  sortData();
  render();
  renderClosure();
  renderCPF();
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
        <div class="detail-item"><label>CPF OA Balance</label><strong>SGD ${lead.cpfOA.toLocaleString()}</strong></div>
        <div class="detail-item"><label>CPF SA Balance</label><strong>SGD ${lead.cpfSA.toLocaleString()}</strong></div>
        <div class="detail-item"><label>Recommended Plan</label><strong>${lead.planType}</strong></div>
        <div class="detail-item"><label>Est. Premium / yr</label><strong style="color:var(--brand)">SGD ${lead.premium.toLocaleString()}</strong></div>
        <div class="detail-item"><label>Commission Type</label><strong>${lead.commission}</strong></div>
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
      <td style="font-size:.82rem">${l.planType}</td>
      <td class="premium-val">SGD ${l.premium.toLocaleString()}</td>
      <td style="font-size:.8rem;color:var(--text-muted)">${l.commission}</td>
    </tr>`).join("");
}

function renderCPF(){
  document.getElementById("cpf-list").innerHTML = LEADS.map((l,i) => {
    const tot = l.cpfOA + l.cpfSA;
    const pct = Math.round((l.cpfSA / tot) * 100);
    const colors = ["red","blue","amber","green","red","blue"];
    return `<li>
      <span class="dot ${colors[i]}"></span>
      <div class="activity-body">
        <div class="activity-row">
          <span class="activity-name">${l.name.split(" ")[0]}</span>
          <span class="activity-time">SA: ${pct}% of total</span>
        </div>
        <p class="activity-desc">OA: SGD ${l.cpfOA.toLocaleString()} · SA: SGD ${l.cpfSA.toLocaleString()} · Total: SGD ${tot.toLocaleString()}</p>
      </div>
    </li>`;
  }).join("");
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
  document.getElementById("btn-draft-email").addEventListener("click", () => {
    const lead = LEADS.find(l => l.id === activeId);
    if(!lead) return;
    const firstName = lead.name.split(" ")[0];
    document.getElementById("em-name").value = firstName;
    document.getElementById("em-to").value = lead.email;
    document.getElementById("em-company").value = lead.occupation;
    document.getElementById("em-context").value = `${lead.stage} — ${lead.planType}`;
    document.getElementById("em-subject").value = `Following up on your ${lead.planType} plan`;
    document.getElementById("em-body").value = `Hi ${firstName},\n\nThank you for taking the time to meet with me. I wanted to follow up on our discussion regarding the ${lead.planType} plan and check if you have any questions or would like to move forward.\n\nBased on your current stage (${lead.stage}), I believe the next step would be to ${lead.stage === 'Closing' ? 'finalise the paperwork and get you covered' : lead.stage === 'Proposal Sent' ? 'review the proposal together and address any concerns' : lead.stage === 'Needs Analysis' ? 'go through the solutioning and tailor the right plan for you' : 'schedule our next meeting to continue the conversation'}.\n\nPlease let me know a time that works for you — I am happy to meet in person or over a call.\n\nBest regards`;
    document.getElementById("email-modal-overlay").classList.add("open");
    emUpdateLinks();
  });
  document.getElementById("em-close-btn").addEventListener("click", () =>
    document.getElementById("email-modal-overlay").classList.remove("open")
  );
  document.getElementById("email-modal-overlay").addEventListener("click", e => {
    if(e.target === document.getElementById("email-modal-overlay"))
      document.getElementById("email-modal-overlay").classList.remove("open");
  });
  document.getElementById("btn-edit-lead").addEventListener("click", () => {
    if(activeId) window.location.href = `create-profile.html?edit=${activeId}`;
  });
  document.getElementById("lead-tbody").addEventListener("click", e => {
    const row = e.target.closest("tr[data-id]");
    if(!row) return;
    openDrawer(Number(row.dataset.id));
  });
  document.getElementById("lead-tbody").addEventListener("keydown", e => {
    if(e.key !== "Enter" && e.key !== " ") return;
    const row = e.target.closest("tr[data-id]");
    if(!row) return;
    e.preventDefault();
    openDrawer(Number(row.dataset.id));
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

function emGetFields(){ return { to:document.getElementById("em-to").value.trim(), subject:document.getElementById("em-subject").value.trim(), body:document.getElementById("em-body").value.trim() }; }
function emUpdateLinks(){
  const {to,subject,body}=emGetFields();
  document.getElementById("em-link-gmail").href=`https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(to)}&su=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  document.getElementById("em-link-outlook").href=`https://outlook.live.com/mail/0/deeplink/compose?to=${encodeURIComponent(to)}&subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  document.getElementById("em-link-yahoo").href=`https://compose.mail.yahoo.com/?to=${encodeURIComponent(to)}&subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}
function emCopy(){
  const {to,subject,body}=emGetFields();
  navigator.clipboard.writeText(`To: ${to}\nSubject: ${subject}\n\n${body}`).then(()=>{
    const btn=document.getElementById('em-copy-btn');
    const orig=btn.innerHTML;
    btn.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg> Copied!';
    setTimeout(()=>btn.innerHTML=orig,1500);
  });
}
