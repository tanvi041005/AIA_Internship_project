(function () {
  const LEADS_STORAGE_KEY = "financial_leads_data";
  const DEFAULT_LEADS = [
    {
      id: 1,
      name: "Lim Wei Jie",
      age: 34,
      contact: "9123-4567",
      email: "weijie.lim@email.com",
      meetDate: "2025-05-12",
      location: "Toa Payoh HDB",
      meetType: "Physical",
      urgency: "urgent",
      stage: "Proposal Sent",
      remarks: "Interested in term life; wife expecting. Has existing GE policy expiring soon.",
      planType: "Term Life",
      generalPlanType: "Protection",
      specificPlanType: "Term Life",
      sumAssured: 300000,
      premium: 2400,
      commission: "FYC",
      cpfSA: 42000,
      cpfOA: 88000,
      occupation: "Software Engineer",
      income: "SGD 7,200/mo",
      generalExpense: "SGD 3,600/mo",
      surplus: "SGD 3,600/mo",
      existingPlans: "Existing GE policy expiring soon",
      referredBy: "John Tan",
      followUps: [
        { label: "Initial meeting", date: "2025-04-30", done: true },
        { label: "Proposal sent", date: "2025-05-05", done: true },
        { label: "Follow-up call", date: "2025-05-14", done: false },
        { label: "Closing", date: "2025-05-20", done: false }
      ]
    },
    {
      id: 2,
      name: "Nur Aisyah Binte Rahman",
      age: 28,
      contact: "8234-5678",
      email: "aisyah.r@email.com",
      meetDate: "2025-05-15",
      location: "Tampines Mall",
      meetType: "Online",
      urgency: "medium",
      stage: "Fact-Find",
      remarks: "Self-employed, irregular income. Keen on savings plan for rainy day fund.",
      planType: "Endowment",
      generalPlanType: "Savings",
      specificPlanType: "Endowment",
      sumAssured: 180000,
      premium: 3600,
      commission: "Trail",
      cpfSA: 18000,
      cpfOA: 31000,
      occupation: "Freelance Designer",
      income: "SGD 3,800/mo (avg)",
      generalExpense: "SGD 2,100/mo",
      surplus: "SGD 1,700/mo",
      existingPlans: "No current plan on record",
      referredBy: "Self (Instagram)",
      followUps: [
        { label: "Intro call", date: "2025-05-10", done: true },
        { label: "Fact-find session", date: "2025-05-15", done: false },
        { label: "Needs analysis", date: "2025-05-22", done: false }
      ]
    },
    {
      id: 3,
      name: "Chen Jia Hao",
      age: 42,
      contact: "9345-6789",
      email: "jiahao.chen@corp.sg",
      meetDate: "2025-05-08",
      location: "Raffles Place (Client Office)",
      meetType: "Physical",
      urgency: "urgent",
      stage: "Closing",
      remarks: "Director-level. Needs keyman insurance + personal CI cover. Decide by end of month.",
      planType: "CI + Keyman",
      generalPlanType: "Protection",
      specificPlanType: "CI + Keyman",
      sumAssured: 750000,
      premium: 9800,
      commission: "FYC",
      cpfSA: 95000,
      cpfOA: 180000,
      occupation: "Company Director",
      income: "SGD 22,000/mo",
      generalExpense: "SGD 9,000/mo",
      surplus: "SGD 13,000/mo",
      existingPlans: "Existing personal CI cover; looking at keyman and additional protection",
      referredBy: "Existing client (Peter Goh)",
      followUps: [
        { label: "Discovery", date: "2025-04-22", done: true },
        { label: "Proposal", date: "2025-05-02", done: true },
        { label: "Negotiation", date: "2025-05-08", done: true },
        { label: "Closing sign-off", date: "2025-05-15", done: false }
      ]
    },
    {
      id: 4,
      name: "Priya Nair",
      age: 31,
      contact: "9456-7890",
      email: "priya.nair@gmail.com",
      meetDate: "2025-05-20",
      location: "Jurong East CC",
      meetType: "Hybrid",
      urgency: "non-urgent",
      stage: "Prospecting",
      remarks: "Teacher. Wants ILP for long-term growth. No rush — reviewing options with husband.",
      planType: "ILP",
      generalPlanType: "Investment",
      specificPlanType: "ILP",
      sumAssured: 200000,
      premium: 4200,
      commission: "Trail",
      cpfSA: 28000,
      cpfOA: 54000,
      occupation: "Secondary School Teacher",
      income: "SGD 4,500/mo",
      generalExpense: "SGD 2,500/mo",
      surplus: "SGD 2,000/mo",
      existingPlans: "No active insurance plan yet",
      referredBy: "Colleague referral",
      followUps: [
        { label: "WhatsApp intro", date: "2025-05-17", done: true },
        { label: "Meet-up", date: "2025-05-20", done: false },
        { label: "Proposal", date: "2025-05-28", done: false }
      ]
    },
    {
      id: 5,
      name: "Marcus Tan Boon Kiat",
      age: 38,
      contact: "9567-8901",
      email: "marcus.tbk@finco.com",
      meetDate: "2025-05-06",
      location: "CBD (Zoom)",
      meetType: "Online",
      urgency: "urgent",
      stage: "Needs Analysis",
      remarks: "Planning early retirement at 55. HNW profile — keen on wealth accumulation + legacy planning.",
      planType: "Whole Life + Trust",
      generalPlanType: "Wealth",
      specificPlanType: "Whole Life + Trust",
      sumAssured: 1000000,
      premium: 24000,
      commission: "FYC + Trail",
      cpfSA: 150000,
      cpfOA: 320000,
      occupation: "VP Finance",
      income: "SGD 18,000/mo",
      generalExpense: "SGD 8,000/mo",
      surplus: "SGD 10,000/mo",
      existingPlans: "Corporate coverage only; reviewing personal wealth and legacy plans",
      referredBy: "Wealth manager partner",
      followUps: [
        { label: "Zoom intro", date: "2025-05-01", done: true },
        { label: "Needs analysis", date: "2025-05-06", done: true },
        { label: "Solutioning", date: "2025-05-12", done: false },
        { label: "Proposal", date: "2025-05-19", done: false }
      ]
    },
    {
      id: 6,
      name: "Sandra Loh Mei Ling",
      age: 55,
      contact: "8678-9012",
      email: "sandraloh@email.com",
      meetDate: "2025-05-25",
      location: "Woodlands Civic Centre",
      meetType: "Physical",
      urgency: "non-urgent",
      stage: "Fact-Find",
      remarks: "Near retirement. Reviewing existing Prudential policies. Possible DPS lapse to address.",
      planType: "Retirement + MediShield",
      generalPlanType: "Retirement",
      specificPlanType: "Retirement + MediShield",
      sumAssured: 120000,
      premium: 1800,
      commission: "Trail",
      cpfSA: 65000,
      cpfOA: 120000,
      occupation: "Admin Executive (Govt)",
      income: "SGD 3,200/mo",
      generalExpense: "SGD 2,000/mo",
      surplus: "SGD 1,200/mo",
      existingPlans: "Reviewing existing Prudential policies",
      referredBy: "Daughter's recommendation",
      followUps: [
        { label: "Phone call", date: "2025-05-20", done: true },
        { label: "Fact-find", date: "2025-05-25", done: false }
      ]
    }
  ];

  const AVATAR_COLORS = ["#a6192e", "#3b82f6", "#16a34a", "#f59e0b", "#8b5cf6", "#ec4899"];

  function getLeads() {
    try {
      return JSON.parse(localStorage.getItem(LEADS_STORAGE_KEY)) || DEFAULT_LEADS;
    } catch {
      return DEFAULT_LEADS;
    }
  }

  function saveLeads(leads) {
    localStorage.setItem(LEADS_STORAGE_KEY, JSON.stringify(leads));
  }

  function initials(name) {
    return String(name || "")
      .split(" ")
      .filter(Boolean)
      .map((word) => word[0])
      .slice(0, 2)
      .join("")
      .toUpperCase();
  }

  function formatDate(dateValue) {
    if (!dateValue) return "—";
    const parts = String(dateValue).split("-");
    if (parts.length !== 3) return dateValue;
    const [year, month, day] = parts;
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    return `${parseInt(day, 10)} ${months[parseInt(month, 10) - 1]} ${year}`;
  }

  function formatFinancialAmount(value, suffix = "/mo") {
    if (value == null || value === "") return "—";
    const text = String(value).trim();
    if (/^sgd\s/i.test(text)) return text;
    const numeric = Number(text.replace(/[^0-9.-]/g, ""));
    if (!Number.isFinite(numeric)) return text;
    return `SGD ${numeric.toLocaleString()}${suffix}`;
  }

  function formatCommissionRate(lead) {
    if (lead && lead.commissionRate !== undefined && lead.commissionRate !== null && lead.commissionRate !== "") {
      return `${Number(lead.commissionRate)}%`;
    }
    return lead && lead.commission ? lead.commission : "—";
  }

  function formatCommissionAmount(lead, currency) {
    const amount = lead && lead.commissionAmount !== undefined && lead.commissionAmount !== null
      ? Number(lead.commissionAmount)
      : Number(lead.premium || 0) * Number(lead.commissionRate || 0) / 100;
    if (!Number.isFinite(amount) || amount <= 0) return "—";
    return `${currency} ${amount.toLocaleString()}`;
  }

  function getCurrencyCode(lead) {
    return lead && lead.currency === "USD" ? "USD" : "SGD";
  }

  function escapeHtml(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function toOrdinalLabel(position) {
    const labels = ["First", "Second", "Third", "Fourth", "Fifth", "Sixth", "Seventh", "Eighth", "Ninth", "Tenth"];
    const idx = Math.max(1, Number(position || 1));
    return labels[idx - 1] || `${idx}th`;
  }

  function getExistingPlansList(lead) {
    if (Array.isArray(lead?.existingPlansList) && lead.existingPlansList.length) {
      return lead.existingPlansList.map((plan) => String(plan || "").trim()).filter(Boolean);
    }
    if (!lead?.existingPlans) return [];
    return String(lead.existingPlans)
      .split(/\r?\n|,|;/)
      .map((plan) => plan.trim())
      .filter(Boolean);
  }

  function renderExistingPlans(lead) {
    const plans = getExistingPlansList(lead);
    if (!plans.length) {
      return '<div class="financial-note-value">No existing plans recorded</div>';
    }
    return plans
      .map((plan, index) => `
        <div class="existing-plan-row-view">
          <span class="existing-plan-tag">${toOrdinalLabel(index + 1)} Plan</span>
          <span class="existing-plan-text">${escapeHtml(plan)}</span>
        </div>
      `)
      .join("");
  }

  function renderTimelineView(followUps) {
    const items = Array.isArray(followUps) ? followUps : [];
    if (!items.length) {
      return '<p class="timeline-empty">No follow-up steps yet. Click Edit Timeline to add one.</p>';
    }

    return items.map((item) => `
      <div class="timeline-item ${item.done ? "done" : "pending"}">
        <div class="timeline-dot"></div>
        <div class="timeline-title">${escapeHtml(item.label)}</div>
        <div class="timeline-date">
          ${formatDate(item.date)}
          <span class="timeline-status ${item.done ? "completed" : "pending"}">${item.done ? "✓ Completed" : "◌ Pending"}</span>
        </div>
      </div>
    `).join("");
  }

  function timelineEditorRow(item, index) {
    return `
      <div class="timeline-editor-row" data-index="${index}">
        <div class="timeline-editor-grid">
          <label>
            <span>Step</span>
            <input type="text" class="timeline-label-input" value="${escapeHtml(item.label || "")}" placeholder="e.g. Follow-up call" />
          </label>
          <label>
            <span>Date</span>
            <input type="date" class="timeline-date-input" value="${escapeHtml(item.date || "")}" />
          </label>
        </div>
        <div class="timeline-editor-actions">
          <label class="timeline-checkbox">
            <input type="checkbox" class="timeline-done-input" ${item.done ? "checked" : ""} />
            <span>Completed</span>
          </label>
          <button type="button" class="btn-secondary timeline-remove-btn">Remove</button>
        </div>
      </div>
    `;
  }

  function renderTimelineEditor(followUps) {
    const items = Array.isArray(followUps) && followUps.length ? followUps : [{ label: "", date: "", done: false }];
    return `
      <div class="timeline-editor" id="timeline-editor">
        ${items.map((item, index) => timelineEditorRow(item, index)).join("")}
      </div>
    `;
  }

  function updateLead(leadId, updater) {
    const leads = getLeads();
    const leadIndex = leads.findIndex((lead) => lead.id === leadId);
    if (leadIndex === -1) return null;
    const updatedLead = updater({ ...leads[leadIndex] });
    leads[leadIndex] = updatedLead;
    saveLeads(leads);
    return updatedLead;
  }

  function readTimelineRows() {
    return Array.from(document.querySelectorAll(".timeline-editor-row")).map((row) => ({
      label: row.querySelector(".timeline-label-input")?.value.trim() || "",
      date: row.querySelector(".timeline-date-input")?.value || "",
      done: Boolean(row.querySelector(".timeline-done-input")?.checked)
    })).filter((item) => item.label || item.date || item.done);
  }

  function renderProfile(leadId, editTimeline = false) {
    const profileContent = document.getElementById("profileContent");
    const leads = getLeads();
    const lead = leads.find((item) => item.id === leadId);

    if (!lead) {
      profileContent.innerHTML = '<div class="error-message">Lead not found</div>';
      return;
    }

    const avatarColor = AVATAR_COLORS[(lead.id - 1) % AVATAR_COLORS.length];
    const urgencyColor = lead.urgency === "urgent" ? "#ef4444" : lead.urgency === "medium" ? "#f59e0b" : "#6b7280";
    const currency = getCurrencyCode(lead);
    const followUps = Array.isArray(lead.followUps) ? lead.followUps : [];

    const timelineHtml = editTimeline
      ? renderTimelineEditor(followUps)
      : `<div class="timeline">${renderTimelineView(followUps)}</div>`;

    const timelineActions = editTimeline
      ? `
        <div class="timeline-toolbar-actions">
          <button type="button" class="btn-secondary" id="timeline-cancel-btn">Cancel</button>
          <button type="button" class="btn-primary" id="timeline-save-btn">Save Timeline</button>
          <button type="button" class="btn-secondary" id="timeline-add-btn">Add Step</button>
        </div>
      `
      : `
        <div class="timeline-toolbar-actions">
          <button type="button" class="btn-secondary" id="timeline-edit-btn">Edit Timeline</button>
        </div>
      `;

    profileContent.innerHTML = `
      <div class="profile-header" style="background: linear-gradient(135deg, ${avatarColor}15 0%, ${avatarColor}08 100%);">
        <div class="profile-avatar" style="background: linear-gradient(135deg, ${avatarColor} 0%, ${avatarColor}dd 100%);">
          ${initials(lead.name)}
        </div>
        <div class="profile-info">
          <h1>${escapeHtml(lead.name)}</h1>
          <p class="profile-subtitle">${escapeHtml(lead.occupation || "—")} • ${escapeHtml(lead.income || "—")}</p>
          <div class="profile-meta">
            <div class="meta-item">
              <span class="meta-label">Referred By</span>
              <span class="meta-value">${escapeHtml(lead.referredBy || "—")}</span>
            </div>
            <div class="meta-item">
              <span class="meta-label">Stage</span>
              <span class="meta-value">${escapeHtml(lead.stage || "—")}</span>
            </div>
            <div class="meta-item">
              <span class="meta-label">Urgency</span>
              <span class="meta-value" style="color: ${urgencyColor};">${escapeHtml((lead.urgency || "").toUpperCase())}</span>
            </div>
          </div>
        </div>
        <div class="profile-actions">
          <button class="btn-primary" onclick="window.location.href='create-profile.html?edit=${lead.id}'">Edit Profile</button>
        </div>
      </div>

      <div class="content-grid">
        <div class="card">
          <h2 class="card-title">Client Details</h2>
          <div class="section-divider"></div>
          <div class="info-grid">
            <div class="info-item">
              <div class="info-label">Age</div>
              <div class="info-value">${lead.age} years</div>
            </div>
            <div class="info-item">
              <div class="info-label">Contact</div>
              <div class="info-value">${escapeHtml(lead.contact || "—")}</div>
            </div>
            <div class="info-item">
              <div class="info-label">Email</div>
              <div class="info-value" style="font-size: 0.95rem;">${escapeHtml(lead.email || "—")}</div>
            </div>
            <div class="info-item">
              <div class="info-label">Meeting Type</div>
              <div class="info-value">${escapeHtml(lead.meetType || "—")}</div>
            </div>
            <div class="info-item">
              <div class="info-label">First Appointment</div>
              <div class="info-value">${formatDate(lead.meetDate)}</div>
            </div>
            <div class="info-item">
              <div class="info-label">Location</div>
              <div class="info-value">${escapeHtml(lead.location || "—")}</div>
            </div>
            <div class="info-item">
              <div class="info-label">Stage</div>
              <div class="info-value">${escapeHtml(lead.stage || "—")}</div>
            </div>
            <div class="info-item">
              <div class="info-label">Urgency</div>
              <div class="info-value" style="color:${urgencyColor}">${escapeHtml((lead.urgency || "").toUpperCase())}</div>
            </div>
          </div>
        </div>

        <div class="card financial-card">
          <h2 class="card-title">Financial Portfolio</h2>
          <div class="section-divider"></div>
          <div class="financial-summary-grid">
            <div class="financial-summary-item accent-income">
              <div class="info-label">Monthly Income</div>
              <div class="financial-value">${escapeHtml(formatFinancialAmount(lead.income))}</div>
            </div>
            <div class="financial-summary-item accent-expense">
              <div class="info-label">General Expense</div>
              <div class="financial-value">${escapeHtml(formatFinancialAmount(lead.generalExpense))}</div>
            </div>
            <div class="financial-summary-item accent-surplus">
              <div class="info-label">Surplus</div>
              <div class="financial-value">${escapeHtml(formatFinancialAmount(lead.surplus))}</div>
            </div>
          </div>

          <div class="financial-note">
            <div class="info-label">Existing Plans</div>
            ${renderExistingPlans(lead)}
          </div>

          <div class="financial-detail-grid">
            <div class="info-item">
              <div class="info-label">CPF OA Balance</div>
              <div class="info-value">SGD ${Number(lead.cpfOA || 0).toLocaleString()}</div>
            </div>
            <div class="info-item">
              <div class="info-label">CPF SA Balance</div>
              <div class="info-value">SGD ${Number(lead.cpfSA || 0).toLocaleString()}</div>
            </div>
            <div class="info-item">
              <div class="info-label">General Plan Type</div>
              <div class="info-value">${escapeHtml(lead.generalPlanType || "—")}</div>
            </div>
            <div class="info-item">
              <div class="info-label">Specific Plan Type</div>
              <div class="info-value">${escapeHtml(lead.specificPlanType || lead.planType || "—")}</div>
            </div>
            <div class="info-item">
              <div class="info-label">Sum Assured</div>
              <div class="info-value">${lead.sumAssured ? `${currency} ${Number(lead.sumAssured).toLocaleString()}` : "—"}</div>
            </div>
            <div class="info-item">
              <div class="info-label">Commission Rate</div>
              <div class="info-value">${escapeHtml(formatCommissionRate(lead))}</div>
            </div>
            <div class="info-item">
              <div class="info-label">Commission Amount</div>
              <div class="info-value">${escapeHtml(formatCommissionAmount(lead, currency))}</div>
            </div>
            <div class="info-item">
              <div class="info-label">Est. Premium / yr</div>
              <div class="info-value" style="color: var(--brand);">${currency} ${Number(lead.premium || 0).toLocaleString()}</div>
            </div>
          </div>
        </div>
      </div>

      <div class="timeline-section">
        <div class="timeline-toolbar">
          <h2 class="card-title">Follow-up Timeline</h2>
          ${timelineActions}
        </div>
        <div class="section-divider"></div>
        ${timelineHtml}
      </div>

      <div class="card" style="grid-column: span 2; margin-top: 0;">
        <h2 class="card-title">Remarks</h2>
        <div class="section-divider"></div>
        <p style="font-size: 1rem; line-height: 1.6; color: var(--text);">${escapeHtml(lead.remarks || "")}</p>
      </div>
    `;

    if (!editTimeline) {
      const editButton = document.getElementById("timeline-edit-btn");
      if (editButton) {
        editButton.addEventListener("click", () => renderProfile(leadId, true));
      }
      return;
    }

    const cancelButton = document.getElementById("timeline-cancel-btn");
    const saveButton = document.getElementById("timeline-save-btn");
    const addButton = document.getElementById("timeline-add-btn");
    const timelineEditor = document.getElementById("timeline-editor");

    if (cancelButton) {
      cancelButton.addEventListener("click", () => renderProfile(leadId, false));
    }

    if (addButton && timelineEditor) {
      addButton.addEventListener("click", () => {
        const nextIndex = timelineEditor.querySelectorAll(".timeline-editor-row").length;
        timelineEditor.insertAdjacentHTML("beforeend", timelineEditorRow({ label: "", date: "", done: false }, nextIndex));
      });
    }

    if (timelineEditor) {
      timelineEditor.addEventListener("click", (event) => {
        const removeButton = event.target.closest(".timeline-remove-btn");
        if (!removeButton) return;
        const row = removeButton.closest(".timeline-editor-row");
        if (row) {
          row.remove();
        }
      });
    }

    if (saveButton) {
      saveButton.addEventListener("click", () => {
        const followUps = readTimelineRows();
        updateLead(leadId, (currentLead) => ({
          ...currentLead,
          followUps
        }));
        renderProfile(leadId, false);
      });
    }
  }

  const params = new URLSearchParams(window.location.search);
  const leadId = parseInt(params.get("id"), 10);

  if (leadId) {
    renderProfile(leadId);
  } else {
    document.getElementById("profileContent").innerHTML = '<div class="error-message">No lead ID provided</div>';
  }
})();