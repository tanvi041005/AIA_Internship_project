(function () {
  const params = new URLSearchParams(location.search);
  const editId = params.get("edit") ? Number(params.get("edit")) : null;
  const returnUrl = editId ? "client-profile.html?id=" + encodeURIComponent(editId) : "leads.html";

  function value(id) {
    return document.getElementById(id).value.trim();
  }

  function numberValue(id) {
    return Number(document.getElementById(id).value || 0);
  }

  function mapLeadRow(row) {
    return {
      id: Number(row.lead_id || row.id),
      name: row.name || "",
      age: Number(row.age || 0),
      contact: row.contact || "",
      email: row.email || "",
      meetDate: row.meet_date || row.meetDate || "",
      meetType: row.meet_type || row.meetType || "",
      location: row.location || "",
      urgency: row.urgency || "",
      stage: row.stage || "",
      occupation: row.occupation || "",
      income: row.income || "",
      cpfOA: Number(row.cpf_oa || row.cpfOA || 0),
      cpfSA: Number(row.cpf_sa || row.cpfSA || 0),
      planType: row.plan_type || row.planType || "",
      premium: Number(row.annual_premium || row.premium || 0),
      commission: row.commission_type || row.commission || "",
      referredBy: row.referred_by || row.referredBy || "",
      remarks: row.remarks || ""
    };
  }

  async function loadEditingLead() {
    if (!editId) return null;
    return mapLeadRow(await apiGet("/leads/" + encodeURIComponent(editId)));
  }

  function setField(id, value) {
    document.getElementById(id).value = value || "";
  }

  function fillForm(lead) {
    if (!lead) return;
    document.getElementById("page-heading").textContent = "Edit Lead Profile";
    document.getElementById("submit-btn").textContent = "Update Profile";
    setField("cp-name", lead.name);
    setField("cp-age", lead.age);
    setField("cp-contact", lead.contact);
    setField("cp-email", lead.email);
    setField("cp-meetup-date", lead.meetDate);
    setField("cp-meeting-type", lead.meetType);
    setField("cp-location", lead.location);
    setField("cp-urgency", lead.urgency);
    setField("cp-stage", lead.stage);
    setField("cp-occupation", lead.occupation);
    setField("cp-income", lead.income);
    setField("cp-cpf-oa", lead.cpfOA);
    setField("cp-cpf-sa", lead.cpfSA);
    setField("cp-plan-type", lead.planType);
    setField("cp-premium", lead.premium);
    setField("cp-commission", lead.commission);
    setField("cp-referred", lead.referredBy);
    setField("cp-remarks", lead.remarks);
  }

  function buildPayload() {
    return {
      leadId: editId,
      name: value("cp-name"),
      age: numberValue("cp-age"),
      contact: value("cp-contact"),
      email: value("cp-email"),
      meetDate: value("cp-meetup-date"),
      location: value("cp-location"),
      meetType: value("cp-meeting-type"),
      urgency: value("cp-urgency"),
      stage: value("cp-stage"),
      occupation: value("cp-occupation"),
      income: value("cp-income"),
      cpfOA: numberValue("cp-cpf-oa"),
      cpfSA: numberValue("cp-cpf-sa"),
      planType: value("cp-plan-type"),
      premium: numberValue("cp-premium"),
      commission: value("cp-commission"),
      referredBy: value("cp-referred"),
      remarks: value("cp-remarks"),
      ownerId: (sessionStorage.getItem("dashboardUser") || "A123").toUpperCase()
    };
  }

  async function saveLead(event) {
    event.preventDefault();
    const err = document.getElementById("form-error");
    err.textContent = "";
    const payload = buildPayload();
    if (!payload.name || !payload.contact || !payload.email || !payload.meetDate || !payload.age) {
      err.textContent = "Please fill in all required fields.";
      return;
    }
    try {
      if (editId) {
        await apiPut("/leads/" + encodeURIComponent(editId), payload);
      } else {
        await apiPost("/leads", payload);
      }
    } catch (e) {
      console.error("Failed to save lead", e);
      err.textContent = "Could not save profile to database.";
      return;
    }
    const successMsg = document.getElementById("form-success");
    successMsg.textContent = editId ? "Profile updated! Redirecting..." : "Profile saved! Redirecting...";
    successMsg.style.display = "block";
    setTimeout(function () { window.location.href = returnUrl; }, 700);
  }

  async function init() {
    document.getElementById("cancel-link").href = returnUrl;
    if (editId) {
      try {
        fillForm(await loadEditingLead());
      } catch (err) {
        document.getElementById("form-error").textContent = "Could not load this lead from database.";
      }
    }
    document.getElementById("create-profile-form").addEventListener("submit", saveLead);
  }

  init();
})();
