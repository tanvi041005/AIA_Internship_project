(async function () {
  const LEADS_STORAGE_KEY = "financial_leads_data";
  const AVATAR_COLORS = ["#a6192e", "#3b82f6", "#16a34a", "#f59e0b", "#8b5cf6", "#ec4899"];

  function getLeads() {
    try {
      var stored = JSON.parse(localStorage.getItem(LEADS_STORAGE_KEY));
      if (Array.isArray(stored) && stored.length > 0) return stored;
    } catch (e) {}
    return [];
  }

  function saveLeads(leads) {
    localStorage.setItem(LEADS_STORAGE_KEY, JSON.stringify(leads));
  }

  function cleanContact(value) {
    return String(value || "").replace(/\D/g, "").slice(0, 8);
  }

  function bindContactCleaner(input) {
    if (!input) return;
    input.value = cleanContact(input.value);
    input.addEventListener("input", () => {
      input.value = cleanContact(input.value);
    });
  }

  function normalizeId(value) {
    return String(value == null ? "" : value).trim();
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
      return String(Number(lead.commissionRate));
    }
    return "—";
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
      return '<p class="timeline-empty">No follow-up steps yet. Click Edit Section to add one.</p>';
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

  function followUpsWithFirstMeetup(lead) {
    const items = Array.isArray(lead?.followUps) ? [...lead.followUps] : [];
    if (lead?.meetDate && !items.some((item) => item && (item.isFirstMeetup || (item.label === "First Meet-up" && item.date === lead.meetDate)))) {
      items.unshift({
        label: "First Meet-up",
        date: lead.meetDate,
        done: true,
        isFirstMeetup: true,
      });
    }
    return items;
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

  function getProposedPlans(lead) {
    if (Array.isArray(lead.proposedPlans) && lead.proposedPlans.length) {
      return lead.proposedPlans;
    }
    return [{
      generalPlanType: lead.generalPlanType || "",
      specificPlanType: lead.specificPlanType || lead.planType || "",
      sumAssured: Number(lead.sumAssured || 0),
      commissionRate: Number(lead.commissionRate || 0),
      premium: Number(lead.premium || 0),
      commissionAmount: Number(lead.commissionAmount || ((Number(lead.premium || 0) * Number(lead.commissionRate || 0)) / 100)),
    }];
  }

  function proposedPlanEditorRow(plan, index) {
    const commissionAmount = Number(plan.commissionAmount || ((Number(plan.premium || 0) * Number(plan.commissionRate || 0)) / 100) || 0);
    return `
      <div class="proposed-plan-row" data-index="${index}">
        <div class="proposed-plan-row-header">
          <span class="proposed-plan-label">Plan ${index + 1}</span>
          <button type="button" class="btn-secondary proposed-remove-btn">Remove</button>
        </div>
        <div class="section-form-grid two-col">
          <label>General Plan Type
            <input type="text" class="pp-general-plan-type" value="${escapeHtml(plan.generalPlanType || "")}" />
          </label>
          <label>Specific Plan Type
            <input type="text" class="pp-specific-plan-type" value="${escapeHtml(plan.specificPlanType || "")}" />
          </label>
          <label>Sum Assured
            <input type="number" class="pp-sum-assured" value="${Number(plan.sumAssured || 0)}" min="0" />
          </label>
          <label>Commission Rate (%)
            <input type="number" class="pp-commission-rate" value="${Number(plan.commissionRate || 0)}" min="0" step="0.01" />
          </label>
          <label>Est. Premium / yr
            <input type="number" class="pp-premium" value="${Number(plan.premium || 0)}" min="0" />
          </label>
          <label>Commission Amount
            <input type="number" class="pp-commission-amount" value="${commissionAmount}" min="0" readonly />
          </label>
        </div>
      </div>
    `;
  }

  function updateLead(leadId, updater) {
    const leads = getLeads();
    const leadIndex = leads.findIndex((lead) => normalizeId(lead.id) === normalizeId(leadId));
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

  function renderProfileEditForm(leadId) {
    const profileContent = document.getElementById("profileContent");
    const leads = getLeads();
    const lead = leads.find((item) => normalizeId(item.id) === normalizeId(leadId));

    if (!lead) {
      profileContent.innerHTML = '<div class="error-message">Lead not found</div>';
      return;
    }

    const avatarColor = AVATAR_COLORS[(lead.id - 1) % AVATAR_COLORS.length];

    profileContent.innerHTML = `
      <div class="profile-header" style="background: linear-gradient(135deg, ${avatarColor}15 0%, ${avatarColor}08 100%);">
        <div class="profile-info">
          <h1>Fill Client Profile</h1>
          <p class="profile-subtitle">Complete all the details to create this lead profile</p>
        </div>
      </div>

      <div class="content-grid">
        <form id="profile-edit-form" class="profile-form" novalidate>
          <div class="form-row">
            <div>
              <label for="ep-name">Full Name <span aria-hidden="true">*</span></label>
              <input type="text" id="ep-name" required placeholder="e.g. Jane Doe" value="${escapeHtml(lead.name || '')}" />
            </div>
            <div>
              <label for="ep-age">Age <span aria-hidden="true">*</span></label>
              <input type="number" id="ep-age" required min="18" max="99" placeholder="e.g. 35" value="${lead.age || ''}" />
            </div>
          </div>

          <div class="form-row">
            <div>
              <label for="ep-contact">Contact Number <span aria-hidden="true">*</span></label>
              <input type="text" id="ep-contact" required maxlength="8" pattern="^[89][0-9]{7}$" placeholder="e.g. 91234567" value="${escapeHtml(cleanContact(lead.contact))}" />
            </div>
            <div>
              <label for="ep-email">Email Address <span aria-hidden="true">*</span></label>
              <input type="email" id="ep-email" required placeholder="e.g. jane@email.com" value="${escapeHtml(lead.email || '')}" />
            </div>
          </div>

          <div class="form-row">
            <div>
              <label for="ep-meetup-date">Meet-up Date <span aria-hidden="true">*</span></label>
              <input type="date" id="ep-meetup-date" required value="${lead.meetDate || ''}" />
            </div>
            <div>
              <label for="ep-meeting-type">Meeting Type</label>
              <select id="ep-meeting-type">
                <option value="Physical" ${lead.meetType === "Physical" ? "selected" : ""}>Physical</option>
                <option value="Online" ${lead.meetType === "Online" ? "selected" : ""}>Online</option>
                <option value="Hybrid" ${lead.meetType === "Hybrid" ? "selected" : ""}>Hybrid</option>
              </select>
            </div>
          </div>

          <div>
            <label for="ep-location">Location</label>
            <input type="text" id="ep-location" placeholder="📍 location: Makati Office or Marina Bay" value="${escapeHtml(lead.location || '')}" />
            <small>Office, mall, or district name</small>
          </div>

          <div class="form-row">
            <div>
              <label for="ep-urgency">Urgency</label>
              <select id="ep-urgency">
                <option value="urgent" ${lead.urgency === "urgent" ? "selected" : ""}>Urgent</option>
                <option value="medium" ${lead.urgency === "medium" ? "selected" : ""}>Medium</option>
                <option value="non-urgent" ${lead.urgency === "non-urgent" ? "selected" : ""}>Non-Urgent</option>
              </select>
            </div>
            <div>
              <label for="ep-stage">Stage</label>
              <select id="ep-stage">
                <option value="Prospecting" ${lead.stage === "Prospecting" ? "selected" : ""}>Prospecting</option>
                <option value="Fact-Find" ${lead.stage === "Fact-Find" ? "selected" : ""}>Fact-Find</option>
                <option value="Needs Analysis" ${lead.stage === "Needs Analysis" ? "selected" : ""}>Needs Analysis</option>
                <option value="Proposal Sent" ${lead.stage === "Proposal Sent" ? "selected" : ""}>Proposal Sent</option>
                <option value="Closing" ${lead.stage === "Closing" ? "selected" : ""}>Closing</option>
              </select>
            </div>
          </div>

          <div class="form-row">
            <div>
              <label for="ep-occupation">Occupation</label>
              <input type="text" id="ep-occupation" placeholder="Job title: Software Engineer" value="${escapeHtml(lead.occupation || '')}" />
              <small>Current job/profession</small>
            </div>
            <div>
              <label for="ep-income">Monthly Income</label>
              <input type="text" id="ep-income" placeholder="$ format: SGD 7,000 or 7000" value="${escapeHtml(lead.income || '')}" />
              <small>Include currency code (SGD/USD) or numbers only</small>
            </div>
          </div>

          <div class="form-row">
            <div>
              <label for="ep-general-expense">General Expense</label>
              <input type="text" id="ep-general-expense" placeholder="$ format: SGD 3,200 or 3200" value="${escapeHtml(lead.generalExpense || '')}" />
              <small>Monthly expenses</small>
            </div>
            <div>
              <label for="ep-surplus">Surplus</label>
              <input type="text" id="ep-surplus" placeholder="$ format: SGD 3,800 or 3800" value="${escapeHtml(lead.surplus || '')}" />
              <small>Income minus expenses</small>
            </div>
          </div>

          <div class="form-row">
            <div>
              <label for="ep-cpf-oa">CPF OA Balance</label>
              <input type="number" id="ep-cpf-oa" placeholder="# numbers only: 50000" value="${lead.cpfOA || ''}" />
              <small>Ordinary Account balance</small>
            </div>
            <div>
              <label for="ep-cpf-sa">CPF SA Balance</label>
              <input type="number" id="ep-cpf-sa" placeholder="# numbers only: 20000" value="${lead.cpfSA || ''}" />
              <small>Special Account balance</small>
            </div>
          </div>

          <div class="form-row">
            <div>
              <label for="ep-cpf-ma">CPF MA Balance</label>
              <input type="number" id="ep-cpf-ma" placeholder="# numbers only: 10000" value="${lead.cpfMA || ''}" />
              <small>Medisave Account balance</small>
            </div>
            <div>
              <label for="ep-bank-balance">Bank Balance</label>
              <input type="number" id="ep-bank-balance" placeholder="# numbers only: 30000" value="${lead.bankBalance || ''}" />
              <small>Total bank savings</small>
            </div>
          </div>

          <div class="form-row">
            <div>
              <label for="ep-general-plan-type">General Plan Type</label>
              <input type="text" id="ep-general-plan-type" placeholder="Category: Protection" value="${escapeHtml(lead.generalPlanType || '')}" />
              <small>e.g., Protection, Savings, Investment, Wealth, Retirement</small>
            </div>
            <div>
              <label for="ep-plan-type">Specific Plan Type</label>
              <input type="text" id="ep-plan-type" placeholder="Product: Whole Life" value="${escapeHtml(lead.specificPlanType || '')}" />
              <small>e.g., Term Life, Whole Life, Endowment, ILP</small>
            </div>
          </div>

          <div class="form-row">
            <div>
              <label for="ep-sum-assured">Sum Assured</label>
              <input type="number" id="ep-sum-assured" min="0" placeholder="# numbers only: 300000" value="${lead.sumAssured || ''}" />
              <small>Total coverage amount</small>
            </div>
            <div>
              <label for="ep-premium">Premium (Yearly)</label>
              <input type="number" id="ep-premium" min="0" placeholder="# numbers only: 12000" value="${lead.premium || ''}" />
              <small>Annual premium payment</small>
            </div>
          </div>

          <div class="form-row">
            <div>
              <label for="ep-commission-rate">Commission Rate (%)</label>
              <input type="number" id="ep-commission-rate" min="0" step="0.01" placeholder="% enter number: 12" value="${lead.commissionRate || ''}" />
              <small>Percentage rate</small>
            </div>
            <div>
              <label>&nbsp;</label>
            </div>
          </div>

          <div>
            <label for="ep-referred">Referred By</label>
            <input type="text" id="ep-referred" placeholder="Name or referrer: John Tan" value="${escapeHtml(lead.referredBy || '')}" />
            <small>Who referred this lead to you?</small>
          </div>

          <div>
            <label for="ep-remarks">Remarks / Notes</label>
            <textarea id="ep-remarks" placeholder="e.g. Interested in term life protection, family of 4, wife expecting..."></textarea>
            <small>Add any additional notes, preferences, or follow-up items</small>
          </div>

          <p id="form-error" class="form-error" aria-live="polite"></p>

          <div class="form-actions">
            <button type="submit" class="btn-primary" id="ep-submit-btn">Save Profile</button>
            <a href="leads.html" class="ghost-btn">Cancel</a>
          </div>

          <p id="form-success" class="form-success" aria-live="polite">Profile saved! Redirecting…</p>
        </form>
      </div>
    `;

    // Form submission handler
    const form = document.getElementById("profile-edit-form");
    const errorEl = document.getElementById("form-error");
    const successEl = document.getElementById("form-success");
    bindContactCleaner(document.getElementById("ep-contact"));

    form.addEventListener("submit", (e) => {
      e.preventDefault();
      errorEl.textContent = "";

      const name = document.getElementById("ep-name").value.trim();
      const age = parseInt(document.getElementById("ep-age").value, 10);
      const contact = cleanContact(document.getElementById("ep-contact").value);
      document.getElementById("ep-contact").value = contact;
      const email = document.getElementById("ep-email").value.trim();
      const meetDate = document.getElementById("ep-meetup-date").value;

      if (!name || !contact || !email || !meetDate || isNaN(age)) {
        errorEl.textContent = "Please fill in all required fields.";
        return;
      }

      const updatedLead = {
        ...lead,
        name,
        age,
        contact: cleanContact(contact),
        email,
        meetDate,
        meetType: document.getElementById("ep-meeting-type").value,
        location: document.getElementById("ep-location").value.trim(),
        urgency: document.getElementById("ep-urgency").value,
        stage: document.getElementById("ep-stage").value,
        occupation: document.getElementById("ep-occupation").value.trim(),
        generalExpense: document.getElementById("ep-general-expense").value.trim(),
        surplus: document.getElementById("ep-surplus").value.trim(),
        cpfOA: parseInt(document.getElementById("ep-cpf-oa").value, 10) || 0,
        cpfSA: parseInt(document.getElementById("ep-cpf-sa").value, 10) || 0,
        cpfMA: parseInt(document.getElementById("ep-cpf-ma").value, 10) || 0,
        bankBalance: parseInt(document.getElementById("ep-bank-balance").value, 10) || 0,
        currency: "SGD",
        generalPlanType: document.getElementById("ep-general-plan-type").value.trim(),
        specificPlanType: document.getElementById("ep-plan-type").value.trim(),
        planType: document.getElementById("ep-plan-type").value.trim(),
        sumAssured: parseInt(document.getElementById("ep-sum-assured").value, 10) || 0,
        premium: parseInt(document.getElementById("ep-premium").value, 10) || 0,
        commissionRate: parseFloat(document.getElementById("ep-commission-rate").value) || 0,
        referredBy: document.getElementById("ep-referred").value.trim(),
        remarks: document.getElementById("ep-remarks").value.trim()
      };

      // Save updated lead
      const allLeads = getLeads();
      const idx = allLeads.findIndex((l) => normalizeId(l.id) === normalizeId(leadId));
      if (idx !== -1) {
        allLeads[idx] = updatedLead;
        saveLeads(allLeads);

        successEl.style.display = "block";
        setTimeout(() => {
          window.location.href = `client-profile.html?id=${leadId}`;
        }, 1200);
      }
    });
  }

  function profileUrl(leadId, section = "") {
    const id = encodeURIComponent(normalizeId(leadId));
    if (!section) return `client-profile.html?id=${id}`;
    return `client-profile.html?id=${id}&section=${encodeURIComponent(section)}`;
  }

  function renderProfile(leadId, editSection = "") {
    const profileContent = document.getElementById("profileContent");
    const leads = getLeads();
    const lead = leads.find((item) => normalizeId(item.id) === normalizeId(leadId));

    if (!lead) {
      profileContent.innerHTML = '<div class="error-message">Lead not found</div>';
      return;
    }

    const avatarColor = AVATAR_COLORS[(lead.id - 1) % AVATAR_COLORS.length];
    const urgencyColor = lead.urgency === "urgent" ? "#ef4444" : lead.urgency === "medium" ? "#f59e0b" : "#6b7280";
    const currency = getCurrencyCode(lead);
    const followUps = followUpsWithFirstMeetup(lead);
    const isGeneralEdit = editSection === "general";
    const isFinancialEdit = editSection === "financial";
    const isProposedEdit = editSection === "proposed";
    const isTimelineEdit = editSection === "timeline";
    const isRemarksEdit = editSection === "remarks";
    const proposedPlans = getProposedPlans(lead);

    const timelineHtml = isTimelineEdit
      ? renderTimelineEditor(followUps)
      : `<div class="timeline">${renderTimelineView(followUps)}</div>`;

    const timelineActions = isTimelineEdit
      ? `
        <div class="timeline-toolbar-actions">
          <button type="button" class="btn-secondary" id="timeline-cancel-btn">Cancel</button>
          <button type="button" class="btn-primary" id="timeline-save-btn">Save Timeline</button>
          <button type="button" class="btn-secondary" id="timeline-add-btn">Add Step</button>
        </div>
      `
      : `
        <div class="timeline-toolbar-actions">
          <button type="button" class="btn-secondary" id="timeline-edit-btn">Edit Section</button>
        </div>
      `;

    const generalSectionBody = isGeneralEdit
      ? `
        <form id="general-edit-form" class="section-edit-form" novalidate>
          <div class="section-form-grid two-col">
            <label>
              Full Name
              <input type="text" id="g-name" value="${escapeHtml(lead.name || "")}" required maxlength="80" pattern="[A-Za-z0-9 .,'-]{2,80}" />
            </label>
            <label>
              Date of Birth
              <input type="date" id="g-birth-date" value="${escapeHtml(lead.birthDate || "")}" />
            </label>
            <label>
              Age
              <input type="number" id="g-age" min="0" max="120" step="1" value="${lead.age || ""}" required />
            </label>
            <label>
              Contact
              <input type="tel" id="g-contact" value="${escapeHtml(cleanContact(lead.contact))}" required maxlength="8" pattern="^[89][0-9]{7}$" placeholder="e.g. 91234567" />
              <small>Must be 8 digits, starting with 8 or 9</small>
            </label>
            <label>
              Email
              <input type="email" id="g-email" value="${escapeHtml(lead.email || "")}" required maxlength="120" />
            </label>
            <label>
              Urgency
              <select id="g-urgency">
                <option value="urgent" ${lead.urgency === "urgent" ? "selected" : ""}>Urgent</option>
                <option value="medium" ${lead.urgency === "medium" ? "selected" : ""}>Medium</option>
                <option value="non-urgent" ${lead.urgency === "non-urgent" ? "selected" : ""}>Non-Urgent</option>
              </select>
            </label>
            <label>
              Stage
              <select id="g-stage">
                <option value="Prospecting" ${lead.stage === "Prospecting" ? "selected" : ""}>Prospecting</option>
                <option value="Fact Find" ${lead.stage === "Fact Find" ? "selected" : ""}>Fact Find</option>
                <option value="Fact-Find" ${lead.stage === "Fact-Find" ? "selected" : ""}>Fact-Find</option>
                <option value="Needs Analysis" ${lead.stage === "Needs Analysis" ? "selected" : ""}>Needs Analysis</option>
                <option value="Proposal Sent" ${lead.stage === "Proposal Sent" ? "selected" : ""}>Proposal Sent</option>
                <option value="Closing" ${lead.stage === "Closing" ? "selected" : ""}>Closing</option>
              </select>
            </label>
            <label>
              Occupation
              <input type="text" id="g-occupation" value="${escapeHtml(lead.occupation || "")}" maxlength="80" pattern="[A-Za-z0-9 .,'&/-]{0,80}" />
            </label>
            <label>
              Referred By
              <input type="text" id="g-referred-by" value="${escapeHtml(lead.referredBy || "")}" maxlength="80" pattern="[A-Za-z0-9 .,'&/-]{0,80}" />
            </label>
          </div>
          <p class="section-edit-error" id="general-edit-error"></p>
          <div class="section-edit-actions">
            <button type="button" class="btn-secondary" id="general-cancel-btn">Cancel</button>
            <button type="submit" class="btn-primary">Save General Details</button>
          </div>
        </form>
      `
      : `
        <div class="info-grid">
          <div class="info-item">
            <div class="info-label">Occupation</div>
            <div class="info-value">${escapeHtml(lead.occupation || "—")}</div>
          </div>
          <div class="info-item">
            <div class="info-label">Referred By</div>
            <div class="info-value">${escapeHtml(lead.referredBy || "—")}</div>
          </div>
          <div class="info-item">
            <div class="info-label">Stage</div>
            <div class="info-value">${escapeHtml(lead.stage || "—")}</div>
          </div>
          <div class="info-item">
            <div class="info-label">Urgency</div>
            <div class="info-value" style="color:${urgencyColor}">${escapeHtml((lead.urgency || "").toUpperCase())}</div>
          </div>
          <div class="info-item">
            <div class="info-label">Date of Birth</div>
            <div class="info-value">${lead.birthDate ? formatDate(lead.birthDate) : "—"}</div>
          </div>
          <div class="info-item">
            <div class="info-label">Age</div>
            <div class="info-value">${lead.age || "—"} years</div>
          </div>
          <div class="info-item">
            <div class="info-label">Contact</div>
            <div class="info-value">${escapeHtml(cleanContact(lead.contact) || "—")}</div>
          </div>
          <div class="info-item">
            <div class="info-label">Email</div>
            <div class="info-value" style="font-size: 0.95rem;">${escapeHtml(lead.email || "—")}</div>
          </div>
        </div>
      `;

    const financialSectionBody = isFinancialEdit
      ? `
        <form id="financial-edit-form" class="section-edit-form" novalidate>
          <div class="section-form-grid two-col">
            <label>
              Bank Balance
              <input type="number" id="f-bank-balance" value="${Number(lead.bankBalance || 0)}" min="0" />
            </label>
            <label>
              General Expense
              <input type="number" id="f-general-expense" value="${Number(lead.generalExpense || 0)}" min="0" step="0.01" inputmode="decimal" />
            </label>
            <label>
              Monthly Income
              <input type="number" id="f-income" value="${Number(lead.income || 0)}" min="0" step="0.01" inputmode="decimal" />
            </label>
            <label>
              Surplus
              <input type="number" id="f-surplus" value="${Number(lead.surplus || 0)}" min="0" step="0.01" inputmode="decimal" />
            </label>
            <label>
              CPF OA Balance
              <input type="number" id="f-cpf-oa" value="${Number(lead.cpfOA || 0)}" min="0" />
            </label>
            <label>
              CPF SA Balance
              <input type="number" id="f-cpf-sa" value="${Number(lead.cpfSA || 0)}" min="0" />
            </label>
            <label>
              CPF MA Balance
              <input type="number" id="f-cpf-ma" value="${Number(lead.cpfMA || 0)}" min="0" />
            </label>
          </div>
          <div class="section-edit-actions">
            <button type="button" class="btn-secondary" id="financial-cancel-btn">Cancel</button>
            <button type="submit" class="btn-primary">Save Financial Portfolio</button>
          </div>
        </form>
      `
      : `
        <div class="financial-detail-grid">
          <div class="info-item">
            <div class="info-label">Bank Balance</div>
            <div class="info-value">SGD ${Number(lead.bankBalance || 0).toLocaleString()}</div>
          </div>
          <div class="info-item">
            <div class="info-label">General Expense</div>
            <div class="info-value">${escapeHtml(formatFinancialAmount(lead.generalExpense))}</div>
          </div>
          <div class="info-item">
            <div class="info-label">Monthly Income</div>
            <div class="info-value">${escapeHtml(formatFinancialAmount(lead.income))}</div>
          </div>
          <div class="info-item">
            <div class="info-label">Surplus</div>
            <div class="info-value">${escapeHtml(formatFinancialAmount(lead.surplus))}</div>
          </div>
          <div class="info-item">
            <div class="info-label">CPF OA Balance</div>
            <div class="info-value">SGD ${Number(lead.cpfOA || 0).toLocaleString()}</div>
          </div>
          <div class="info-item">
            <div class="info-label">CPF SA Balance</div>
            <div class="info-value">SGD ${Number(lead.cpfSA || 0).toLocaleString()}</div>
          </div>
          <div class="info-item">
            <div class="info-label">CPF MA Balance</div>
            <div class="info-value">SGD ${Number(lead.cpfMA || 0).toLocaleString()}</div>
          </div>
        </div>
      `;

    const proposedSectionBody = isProposedEdit
      ? `
        <form id="proposed-edit-form" class="section-edit-form" novalidate>
          <div id="proposed-plans-editor">
            ${proposedPlans.map((plan, index) => proposedPlanEditorRow(plan, index)).join("")}
          </div>
          <div class="proposed-add-row">
            <button type="button" class="btn-secondary" id="proposed-add-plan-btn">+ Add Plan</button>
          </div>
          <div class="section-edit-actions">
            <button type="button" class="btn-secondary" id="proposed-cancel-btn">Cancel</button>
            <button type="submit" class="btn-primary">Save Proposed Plans</button>
          </div>
        </form>
      `
      : `
        <div class="proposed-plans-view">
          ${proposedPlans.map((plan, index) => `
            ${index > 0 ? '<div class="proposed-plan-divider"></div>' : ""}
            <div class="proposed-plan-view-block">
              ${proposedPlans.length > 1 ? `<div class="proposed-plan-view-label">Plan ${index + 1}</div>` : ""}
              <div class="financial-detail-grid">
                <div class="info-item">
                  <div class="info-label">General Plan Type</div>
                  <div class="info-value">${escapeHtml(plan.generalPlanType || "—")}</div>
                </div>
                <div class="info-item">
                  <div class="info-label">Specific Plan Type</div>
                  <div class="info-value">${escapeHtml(plan.specificPlanType || "—")}</div>
                </div>
                <div class="info-item">
                  <div class="info-label">Sum Assured</div>
                  <div class="info-value">${plan.sumAssured ? `${currency} ${Number(plan.sumAssured).toLocaleString()}` : "—"}</div>
                </div>
                <div class="info-item">
                  <div class="info-label">Commission Rate</div>
                  <div class="info-value">${plan.commissionRate ? `${Number(plan.commissionRate)}%` : "—"}</div>
                </div>
                <div class="info-item">
                  <div class="info-label">Est. Premium / yr</div>
                  <div class="info-value" style="color: var(--brand);">${currency} ${Number(plan.premium || 0).toLocaleString()}</div>
                </div>
                <div class="info-item">
                  <div class="info-label">Commission Amount</div>
                  <div class="info-value">${(plan.premium && plan.commissionRate) ? `${currency} ${Number(plan.commissionAmount || (plan.premium * plan.commissionRate / 100)).toLocaleString()}` : "—"}</div>
                </div>
              </div>
            </div>
          `).join("")}
        </div>
      `;

    const remarksSectionBody = isRemarksEdit
      ? `
        <form id="remarks-edit-form" class="section-edit-form" novalidate>
          <label class="section-form-stack">
            Remarks
            <textarea id="r-remarks" rows="6" placeholder="Add client notes, context, and follow-up pointers...">${escapeHtml(lead.remarks || "")}</textarea>
          </label>
          <div class="section-edit-actions">
            <button type="button" class="btn-secondary" id="remarks-cancel-btn">Cancel</button>
            <button type="submit" class="btn-primary">Save Remarks</button>
          </div>
        </form>
      `
      : `<p style="font-size: 1rem; line-height: 1.6; color: var(--text);">${escapeHtml(lead.remarks || "")}</p>`;

    profileContent.innerHTML = `
      <div class="profile-header" style="background: linear-gradient(135deg, ${avatarColor}15 0%, ${avatarColor}08 100%);">
        <div class="profile-avatar" style="background: linear-gradient(135deg, ${avatarColor} 0%, ${avatarColor}dd 100%);">
          ${initials(lead.name)}
        </div>
        <div class="profile-info">
          <h1>${escapeHtml(lead.name)}</h1>
        </div>
      </div>

      <div class="content-grid">
        <div class="card">
          <div class="section-header">
            <h2 class="card-title">General Client Details</h2>
            ${isGeneralEdit ? "" : '<button type="button" class="btn-secondary section-edit-btn" id="edit-general-btn">Edit Section</button>'}
          </div>
          <div class="section-divider"></div>
          ${generalSectionBody}
        </div>

        <div class="card financial-card">
          <div class="section-header">
            <h2 class="card-title">Financial Portfolio</h2>
            ${isFinancialEdit ? "" : '<button type="button" class="btn-secondary section-edit-btn" id="edit-financial-btn">Edit Section</button>'}
          </div>
          <div class="section-divider"></div>
          ${financialSectionBody}
        </div>
      </div>

      <div class="card proposed-section">
        <div class="section-header">
          <h2 class="card-title">Proposed Insurance Plans</h2>
          ${isProposedEdit ? "" : '<button type="button" class="btn-secondary section-edit-btn" id="edit-proposed-btn">Edit Section</button>'}
        </div>
        <div class="section-divider"></div>
        ${proposedSectionBody}
      </div>

      <div class="timeline-section">
        <div class="timeline-toolbar">
          <h2 class="card-title">Timeline</h2>
          ${timelineActions}
        </div>
        <div class="section-divider"></div>
        ${timelineHtml}
      </div>

      <div class="card remarks-section">
        <div class="section-header">
          <h2 class="card-title">Remarks</h2>
          ${isRemarksEdit ? "" : '<button type="button" class="btn-secondary section-edit-btn" id="edit-remarks-btn">Edit Section</button>'}
        </div>
        <div class="section-divider"></div>
        ${remarksSectionBody}
      </div>
    `;

    if (!isGeneralEdit) {
      const generalEditButton = document.getElementById("edit-general-btn");
      if (generalEditButton) {
        generalEditButton.addEventListener("click", () => {
          renderProfile(leadId, "general");
        });
      }
    } else {
      const generalForm = document.getElementById("general-edit-form");
      const generalCancelButton = document.getElementById("general-cancel-btn");
      const generalErrorEl = document.getElementById("general-edit-error");

      if (generalCancelButton) {
        generalCancelButton.addEventListener("click", () => {
          renderProfile(leadId);
        });
      }

      if (generalForm) {
        bindContactCleaner(document.getElementById("g-contact"));
        generalForm.addEventListener("submit", (event) => {
          event.preventDefault();
          if (!generalForm.checkValidity()) {
            generalForm.reportValidity();
            return;
          }
          const name = document.getElementById("g-name")?.value.trim() || "";
          const age = Number.parseInt(document.getElementById("g-age")?.value, 10);
          const contact = cleanContact(document.getElementById("g-contact")?.value || "");
          const email = document.getElementById("g-email")?.value.trim() || "";
          const meetDate = lead.meetDate || "";

          if (!name || !contact || !email || !Number.isFinite(age)) {
            if (generalErrorEl) {
              generalErrorEl.textContent = "Please fill all required general details.";
            }
            return;
          }

            // Enforce Singapore-style contact: 8 digits starting with 8 or 9
            const contactRe = /^[89][0-9]{7}$/;
            if (!contactRe.test(contact)) {
              if (generalErrorEl) {
                generalErrorEl.textContent = "Contact must be 8 digits and start with 8 or 9.";
              }
              return;
            }

          updateLead(leadId, (currentLead) => ({
            ...currentLead,
            name,
            birthDate: document.getElementById("g-birth-date")?.value || "",
            age,
            contact,
            email,
            meetDate,
            urgency: document.getElementById("g-urgency")?.value || "non-urgent",
            stage: document.getElementById("g-stage")?.value || "Prospecting",
            occupation: document.getElementById("g-occupation")?.value.trim() || "",
            referredBy: document.getElementById("g-referred-by")?.value.trim() || ""
          }));

          renderProfile(leadId);
        });
      }
    }

    if (!isFinancialEdit) {
      const financialEditButton = document.getElementById("edit-financial-btn");
      if (financialEditButton) {
        financialEditButton.addEventListener("click", () => {
          renderProfile(leadId, "financial");
        });
      }
    } else {
      const financialForm = document.getElementById("financial-edit-form");
      const financialCancelButton = document.getElementById("financial-cancel-btn");

      if (financialCancelButton) {
        financialCancelButton.addEventListener("click", () => {
          renderProfile(leadId);
        });
      }

      if (financialForm) {
        financialForm.addEventListener("submit", (event) => {
          event.preventDefault();
          if (!financialForm.checkValidity()) {
            financialForm.reportValidity();
            return;
          }

          const income = document.getElementById("f-income")?.value.trim() || "";
          const generalExpense = document.getElementById("f-general-expense")?.value.trim() || "";
          const surplus = document.getElementById("f-surplus")?.value.trim() || "";
          const cpfOA = Number.parseInt(document.getElementById("f-cpf-oa")?.value, 10) || 0;
          const cpfSA = Number.parseInt(document.getElementById("f-cpf-sa")?.value, 10) || 0;
          const cpfMA = Number.parseInt(document.getElementById("f-cpf-ma")?.value, 10) || 0;
          const bankBalance = Number.parseInt(document.getElementById("f-bank-balance")?.value, 10) || 0;

          updateLead(leadId, (currentLead) => ({
            ...currentLead,
            income,
            generalExpense,
            surplus,
            cpfOA,
            cpfSA,
            cpfMA,
            bankBalance,
          }));

          renderProfile(leadId);
        });
      }
    }

    if (!isProposedEdit) {
      const proposedEditButton = document.getElementById("edit-proposed-btn");
      if (proposedEditButton) {
        proposedEditButton.addEventListener("click", () => {
          renderProfile(leadId, "proposed");
        });
      }
    } else {
      const proposedForm = document.getElementById("proposed-edit-form");
      const proposedCancelButton = document.getElementById("proposed-cancel-btn");
      const proposedEditor = document.getElementById("proposed-plans-editor");
      const proposedAddBtn = document.getElementById("proposed-add-plan-btn");

      if (proposedCancelButton) {
        proposedCancelButton.addEventListener("click", () => {
          renderProfile(leadId);
        });
      }

      if (proposedEditor) {
        proposedEditor.addEventListener("input", (event) => {
          const row = event.target.closest(".proposed-plan-row");
          if (!row) return;
          const premiumInput = row.querySelector(".pp-premium");
          const rateInput = row.querySelector(".pp-commission-rate");
          const amountInput = row.querySelector(".pp-commission-amount");
          if (premiumInput && rateInput && amountInput) {
            const premium = Number.parseFloat(premiumInput.value || "0") || 0;
            const rate = Number.parseFloat(rateInput.value || "0") || 0;
            amountInput.value = String((premium * rate) / 100);
          }
        });

        proposedEditor.addEventListener("click", (event) => {
          const removeBtn = event.target.closest(".proposed-remove-btn");
          if (!removeBtn) return;
          const rows = proposedEditor.querySelectorAll(".proposed-plan-row");
          if (rows.length <= 1) return;
          removeBtn.closest(".proposed-plan-row").remove();
          proposedEditor.querySelectorAll(".proposed-plan-row").forEach((row, i) => {
            const label = row.querySelector(".proposed-plan-label");
            if (label) label.textContent = `Plan ${i + 1}`;
            row.dataset.index = i;
          });
        });
      }

      if (proposedAddBtn && proposedEditor) {
        proposedAddBtn.addEventListener("click", () => {
          const index = proposedEditor.querySelectorAll(".proposed-plan-row").length;
          proposedEditor.insertAdjacentHTML("beforeend", proposedPlanEditorRow(
            { generalPlanType: "", specificPlanType: "", sumAssured: 0, commissionRate: 0, premium: 0, commissionAmount: 0 },
            index
          ));
        });
      }

      if (proposedForm) {
        proposedForm.addEventListener("submit", (event) => {
          event.preventDefault();
          if (!proposedForm.checkValidity()) {
            proposedForm.reportValidity();
            return;
          }
          const plans = Array.from(proposedEditor?.querySelectorAll(".proposed-plan-row") || []).map((row) => {
            const premium = Number.parseInt(row.querySelector(".pp-premium")?.value, 10) || 0;
            const commissionRate = Number.parseFloat(row.querySelector(".pp-commission-rate")?.value) || 0;
            return {
              generalPlanType: row.querySelector(".pp-general-plan-type")?.value.trim() || "",
              specificPlanType: row.querySelector(".pp-specific-plan-type")?.value.trim() || "",
              sumAssured: Number.parseInt(row.querySelector(".pp-sum-assured")?.value, 10) || 0,
              commissionRate,
              premium,
              commissionAmount: (premium * commissionRate) / 100,
            };
          });
          const first = plans[0] || {};
          updateLead(leadId, (currentLead) => ({
            ...currentLead,
            proposedPlans: plans,
            generalPlanType: first.generalPlanType || "",
            specificPlanType: first.specificPlanType || "",
            planType: first.specificPlanType || "",
            sumAssured: first.sumAssured || 0,
            commissionRate: first.commissionRate || 0,
            commissionAmount: first.commissionAmount || 0,
            premium: first.premium || 0,
          }));
          renderProfile(leadId);
        });
      }
    }

    if (!isRemarksEdit) {
      const remarksEditButton = document.getElementById("edit-remarks-btn");
      if (remarksEditButton) {
        remarksEditButton.addEventListener("click", () => {
          renderProfile(leadId, "remarks");
        });
      }
    } else {
      const remarksForm = document.getElementById("remarks-edit-form");
      const remarksCancelButton = document.getElementById("remarks-cancel-btn");

      if (remarksCancelButton) {
        remarksCancelButton.addEventListener("click", () => {
          renderProfile(leadId);
        });
      }

      if (remarksForm) {
        remarksForm.addEventListener("submit", (event) => {
          event.preventDefault();
          const remarks = document.getElementById("r-remarks")?.value.trim() || "";
          updateLead(leadId, (currentLead) => ({
            ...currentLead,
            remarks
          }));
          renderProfile(leadId);
        });
      }
    }

    if (!isTimelineEdit) {
      const editButton = document.getElementById("timeline-edit-btn");
      if (editButton) {
        editButton.addEventListener("click", () => {
          renderProfile(leadId, "timeline");
        });
      }
      return;
    }

    const cancelButton = document.getElementById("timeline-cancel-btn");
    const saveButton = document.getElementById("timeline-save-btn");
    const addButton = document.getElementById("timeline-add-btn");
    const timelineEditor = document.getElementById("timeline-editor");

    if (cancelButton) {
      cancelButton.addEventListener("click", () => {
        renderProfile(leadId);
      });
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
        renderProfile(leadId);
      });
    }
  }

  const params = new URLSearchParams(window.location.search);
  const leadId = params.get("id");
  const editMode = params.get("edit") === "true";
  const section = (params.get("section") || "").toLowerCase();
  const allowedSections = new Set(["general", "financial", "proposed", "timeline", "remarks"]);
  const editSection = allowedSections.has(section) ? section : (editMode ? "general" : "");

  // Prime cache from API (GET /leads?userId=...) before rendering
  if (typeof apiGet === "function") {
    const userId = sessionStorage.getItem("dashboardUser");
    try {
      const rows = await apiGet("/leads" + (userId ? "?userId=" + encodeURIComponent(userId) : ""));
      if (Array.isArray(rows) && rows.length > 0) {
        const remoteLeads = rows.map(mapLead);
        const localLeads = getLeads();
        const mergedById = new Map();

        remoteLeads.forEach((lead) => {
          mergedById.set(normalizeId(lead.id), lead);
        });
        localLeads.forEach((lead) => {
          mergedById.set(normalizeId(lead.id), lead);
        });

        saveLeads(Array.from(mergedById.values()));
      }
    } catch (e) { console.warn("Failed to load leads from API:", e); }
  }

  if (leadId) {
    renderProfile(leadId, editSection);
  } else {
    document.getElementById("profileContent").innerHTML = '<div class="error-message">No lead ID provided</div>';
  }
})();
