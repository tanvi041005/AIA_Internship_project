const LEADS_STORAGE_KEY = "financial_leads_data";

    function getCustomLeads() {
      try { return JSON.parse(localStorage.getItem(LEADS_STORAGE_KEY)) || []; }
      catch { return []; }
    }

    const params = new URLSearchParams(location.search);
    const editId = params.get("edit") ? Number(params.get("edit")) : null;
    const editingLead = editId ? getCustomLeads().find((l) => l.id === editId) : null;
    const returnUrl = editId ? `client-profile.html?id=${editId}` : "leads.html";

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
      document.getElementById("cp-cpf-oa").value = editingLead.cpfOA || "";
      document.getElementById("cp-cpf-sa").value = editingLead.cpfSA || "";
      document.getElementById("cp-plan-type").value = editingLead.planType;
      document.getElementById("cp-premium").value = editingLead.premium;
      document.getElementById("cp-commission").value = editingLead.commission;
      document.getElementById("cp-referred").value = editingLead.referredBy || "";
      document.getElementById("cp-remarks").value = editingLead.remarks;
    }

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
        cpfOA: parseInt(document.getElementById("cp-cpf-oa").value, 10) || 0,
        cpfSA: parseInt(document.getElementById("cp-cpf-sa").value, 10) || 0,
        planType: document.getElementById("cp-plan-type").value.trim(),
        premium: parseInt(document.getElementById("cp-premium").value, 10) || 0,
        commission: document.getElementById("cp-commission").value,
        referredBy: document.getElementById("cp-referred").value.trim(),
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