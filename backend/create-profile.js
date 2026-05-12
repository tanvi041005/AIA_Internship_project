const LEADS_STORAGE_KEY = "financial_leads_data";

    const ORDINAL_WORDS = [
      "First",
      "Second",
      "Third",
      "Fourth",
      "Fifth",
      "Sixth",
      "Seventh",
      "Eighth",
      "Ninth",
      "Tenth"
    ];

    function toOrdinalLabel(position) {
      const idx = Math.max(1, Number(position || 1));
      if (ORDINAL_WORDS[idx - 1]) return ORDINAL_WORDS[idx - 1];
      return `${idx}th`;
    }

    function normalizePlans(source) {
      if (Array.isArray(source)) return source.map((s) => String(s || "").trim()).filter(Boolean);
      if (!source) return [];
      return String(source)
        .split(/\r?\n|,|;/)
        .map((s) => s.trim())
        .filter(Boolean);
    }

    function renderPlanInputs(plans) {
      const container = document.getElementById("existing-plans-list");
      const normalizedPlans = plans && plans.length ? plans : [""];
      container.innerHTML = normalizedPlans.map((planValue, index) => {
        const position = index + 1;
        const ord = toOrdinalLabel(position);
        return `
          <div class="existing-plan-row">
            <span class="existing-plan-label">${ord} Plan</span>
            <input type="text" class="existing-plan-input" placeholder="${ord} plan (e.g. AIA Endowment)" value="${String(planValue || "").replace(/&/g, "&amp;").replace(/\"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;")}" />
          </div>
        `;
      }).join("");
    }

    function collectPlanInputs() {
      return Array.from(document.querySelectorAll(".existing-plan-input"))
        .map((input) => input.value.trim())
        .filter(Boolean);
    }

    function formatCurrencyAmount(amount) {
      return `SGD ${Number(amount || 0).toLocaleString()}`;
    }

    function calculateCommissionAmount() {
      const premium = parseFloat(document.getElementById("cp-premium").value) || 0;
      const commissionRate = parseFloat(document.getElementById("cp-commission-rate").value) || 0;
      const amount = premium * commissionRate / 100;
      const amountField = document.getElementById("cp-commission-amount");
      if (amountField) amountField.value = formatCurrencyAmount(amount);
      return amount;
    }

    function getCustomLeads() {
      try { return JSON.parse(localStorage.getItem(LEADS_STORAGE_KEY)) || []; }
      catch { return []; }
    }

    const params = new URLSearchParams(location.search);
    const editId = params.get("edit") ? Number(params.get("edit")) : null;
    const editingLead = editId ? getCustomLeads().find((l) => l.id === editId) : null;
    const returnUrl = editId ? `client-profile.html?id=${editId}` : "leads.html";

    const initialPlans = editingLead
      ? normalizePlans(editingLead.existingPlansList && editingLead.existingPlansList.length ? editingLead.existingPlansList : editingLead.existingPlans)
      : [""];
    renderPlanInputs(initialPlans);

    document.getElementById("add-existing-plan-btn").addEventListener("click", () => {
      const currentPlans = collectPlanInputs();
      currentPlans.push("");
      renderPlanInputs(currentPlans);
      const inputs = document.querySelectorAll(".existing-plan-input");
      const lastInput = inputs[inputs.length - 1];
      if (lastInput) lastInput.focus();
    });

    if (editingLead) {
      document.getElementById("page-heading").textContent = "Edit Lead Profile";
      document.getElementById("submit-btn").textContent = "Update Profile";
      document.getElementById("cp-name").value = editingLead.name;
      document.getElementById("cp-age").value = editingLead.age;
      document.getElementById("cp-contact").value = editingLead.contact;
      document.getElementById("cp-email").value = editingLead.email || "";
      document.getElementById("cp-meetup-date").value = editingLead.meetDate;
      document.getElementById("cp-meeting-type").value = editingLead.meetType;
      document.getElementById("cp-location").value = editingLead.location;
      document.getElementById("cp-urgency").value = editingLead.urgency;
      document.getElementById("cp-stage").value = editingLead.stage;
      document.getElementById("cp-occupation").value = editingLead.occupation || "";
      document.getElementById("cp-income").value = editingLead.income || "";
      document.getElementById("cp-general-expense").value = editingLead.generalExpense || "";
      document.getElementById("cp-surplus").value = editingLead.surplus || "";
      document.getElementById("cp-cpf-oa").value = editingLead.cpfOA || "";
      document.getElementById("cp-cpf-sa").value = editingLead.cpfSA || "";
      document.getElementById("cp-currency").value = editingLead.currency || "SGD";
      document.getElementById("cp-general-plan-type").value = editingLead.generalPlanType || "";
      document.getElementById("cp-plan-type").value = editingLead.specificPlanType || editingLead.planType || "";
      document.getElementById("cp-sum-assured").value = editingLead.sumAssured || "";
      document.getElementById("cp-premium").value = editingLead.premium;
      document.getElementById("cp-commission-rate").value = editingLead.commissionRate ?? "";
      document.getElementById("cp-commission-amount").value = formatCurrencyAmount(
        editingLead.commissionAmount ?? (Number(editingLead.premium || 0) * Number(editingLead.commissionRate || 0) / 100)
      );
      document.getElementById("cp-referred").value = editingLead.referredBy || "";
      document.getElementById("cp-remarks").value = editingLead.remarks;
    }

    document.getElementById("cp-premium").addEventListener("input", calculateCommissionAmount);
    document.getElementById("cp-commission-rate").addEventListener("input", calculateCommissionAmount);
    calculateCommissionAmount();

    document.getElementById("cancel-link").href = returnUrl;

    document.getElementById("create-profile-form").addEventListener("submit", function (e) {
      e.preventDefault();
      const err = document.getElementById("form-error");
      err.textContent = "";

      const name = document.getElementById("cp-name").value.trim();
      const age = parseInt(document.getElementById("cp-age").value, 10);
      const contact = document.getElementById("cp-contact").value.trim();
      const email = document.getElementById("cp-email").value.trim();
      const meetDate = document.getElementById("cp-meetup-date").value;

      if (!name || !contact || !email || !meetDate || isNaN(age)) {
        err.textContent = "Please fill in all required fields.";
        return;
      }

      const existingPlansList = collectPlanInputs();
      const specificPlanType = document.getElementById("cp-plan-type").value.trim();

      const updated = {
        id: editId || Date.now(),
        name, age,
        contact,
        email,
        meetDate,
        location: document.getElementById("cp-location").value.trim(),
        meetType: document.getElementById("cp-meeting-type").value,
        urgency: document.getElementById("cp-urgency").value,
        stage: document.getElementById("cp-stage").value,
        occupation: document.getElementById("cp-occupation").value.trim(),
        income: document.getElementById("cp-income").value.trim(),
        generalExpense: document.getElementById("cp-general-expense").value.trim(),
        surplus: document.getElementById("cp-surplus").value.trim(),
        cpfOA: parseInt(document.getElementById("cp-cpf-oa").value, 10) || 0,
        cpfSA: parseInt(document.getElementById("cp-cpf-sa").value, 10) || 0,
        currency: document.getElementById("cp-currency").value || "SGD",
        generalPlanType: document.getElementById("cp-general-plan-type").value.trim(),
        specificPlanType,
        planType: specificPlanType,
        sumAssured: parseInt(document.getElementById("cp-sum-assured").value, 10) || 0,
        premium: parseInt(document.getElementById("cp-premium").value, 10) || 0,
        commissionRate: parseFloat(document.getElementById("cp-commission-rate").value) || 0,
        commissionAmount: calculateCommissionAmount(),
        referredBy: document.getElementById("cp-referred").value.trim(),
        existingPlansList,
        existingPlans: existingPlansList.join(", "),
        remarks: document.getElementById("cp-remarks").value.trim(),
        owner: "agent",
        followUps: editingLead ? editingLead.followUps : [
          {label:"Lead Created", date: new Date().toISOString().split('T')[0], done:true}
        ]
      };

      const leads = getCustomLeads();
      if (editId) {
        const idx = leads.findIndex((l) => l.id === editId);
        if (idx !== -1) leads[idx] = updated; else leads.push(updated);
      } else {
        leads.push(updated);
      }
      localStorage.setItem(LEADS_STORAGE_KEY, JSON.stringify(leads));

      const successMsg = document.getElementById("form-success");
      successMsg.textContent = editId ? "Profile updated! Redirecting…" : "Profile saved! Redirecting…";
      successMsg.style.display = "block";
      setTimeout(() => { window.location.href = returnUrl; }, 1200);
    });