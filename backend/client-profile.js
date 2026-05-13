(function () {
  const AVATAR_COLORS = ["#a6192e", "#3b82f6", "#16a34a", "#f59e0b", "#8b5cf6", "#ec4899"];

  function parseExtra(value) {
    if (!value) return {};
    if (typeof value === "object") return value;
    try { return JSON.parse(value) || {}; } catch (e) { return {}; }
  }

  function mapLeadRow(row) {
    const extra = parseExtra(row.extra);
    const followUps = Array.isArray(row.followUps) ? row.followUps : Array.isArray(row.follow_ups) ? row.follow_ups : [];
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

  function esc(value) {
    const node = document.createElement("div");
    node.textContent = String(value || "");
    return node.innerHTML;
  }

  function initials(name) {
    return String(name || "").split(/\s+/).map(function (w) { return w[0]; }).filter(Boolean).slice(0, 2).join("").toUpperCase();
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

  async function loadLead(leadId) {
    return mapLeadRow(await apiGet("/leads/" + encodeURIComponent(leadId)));
  }

  function renderProfile(lead) {
    const avatarColor = AVATAR_COLORS[(lead.id - 1) % AVATAR_COLORS.length];
    const urgencyColor = lead.urgency === "urgent" ? "#ef4444" : lead.urgency === "medium" ? "#f59e0b" : "#6b7280";
    const followUps = (lead.followUps || []).map(function (item) {
      return '<div class="timeline-item">' +
        '<div class="timeline-dot ' + (item.done ? "completed" : "pending") + '"></div>' +
        '<div class="timeline-content"><strong>' + esc(item.label) + '</strong><span>' + formatDate(item.date) + " - " + (item.done ? "Completed" : "Pending") + "</span></div>" +
      "</div>";
    }).join("");

    document.getElementById("profileContent").innerHTML =
      '<div class="profile-header" style="background: linear-gradient(135deg, ' + avatarColor + '15 0%, ' + avatarColor + '08 100%);">' +
        '<div class="profile-avatar" style="background: linear-gradient(135deg, ' + avatarColor + " 0%, " + avatarColor + 'dd 100%);">' + esc(initials(lead.name)) + '</div>' +
        '<div class="profile-info"><h1>' + esc(lead.name) + '</h1><p class="profile-subtitle">' + esc(lead.occupation) + ' | ' + esc(lead.income) + '</p>' +
        '<div class="profile-meta">' +
          '<div class="meta-item"><span class="meta-label">Referred By</span><span class="meta-value">' + esc(lead.referredBy || "-") + '</span></div>' +
          '<div class="meta-item"><span class="meta-label">Stage</span><span class="meta-value">' + esc(lead.stage) + '</span></div>' +
          '<div class="meta-item"><span class="meta-label">Urgency</span><span class="meta-value" style="color:' + urgencyColor + ';">' + esc(lead.urgency.toUpperCase()) + '</span></div>' +
        '</div></div>' +
        '<div class="profile-actions"><button class="btn-primary" onclick="window.location.href=\'create-profile.html?edit=' + encodeURIComponent(lead.id) + '\'">Edit Profile</button></div>' +
      '</div>' +
      '<div class="content-grid">' +
        '<div class="card"><h2 class="card-title">Client Details</h2><div class="section-divider"></div><div class="info-grid">' +
          info("Age", lead.age + " years") +
          info("Contact", lead.contact) +
          info("Email", lead.email) +
          info("Meeting Type", lead.meetType) +
          info("First Appointment", formatDate(lead.meetDate)) +
          info("Location", lead.location) +
          info("Stage", lead.stage) +
          info("Urgency", lead.urgency) +
        '</div></div>' +
        '<div class="card"><h2 class="card-title">Financial Profile</h2><div class="section-divider"></div><div class="info-grid">' +
          info("CPF OA", money(lead.cpfOA)) +
          info("CPF SA", money(lead.cpfSA)) +
          info("Recommended Plan", lead.planType) +
          info("Annual Premium", money(lead.premium)) +
          info("Commission", lead.commission) +
          info("Sum Assured", lead.sumAssured ? money(lead.sumAssured) : "-") +
          info("General Expense", lead.generalExpense || "-") +
          info("Surplus", lead.surplus || "-") +
        '</div></div>' +
        '<div class="card full-width"><h2 class="card-title">Remarks</h2><div class="section-divider"></div><p class="remarks-text">' + esc(lead.remarks || "-") + '</p></div>' +
        '<div class="card full-width"><h2 class="card-title">Follow-up Timeline</h2><div class="section-divider"></div><div class="timeline">' + (followUps || '<p class="muted-text">No follow-ups found.</p>') + '</div></div>' +
      '</div>';
  }

  function info(label, value) {
    return '<div class="info-item"><div class="info-label">' + esc(label) + '</div><div class="info-value">' + esc(value) + '</div></div>';
  }

  async function init() {
    const params = new URLSearchParams(location.search);
    const leadId = params.get("id");
    const root = document.getElementById("profileContent");
    if (!leadId) {
      root.innerHTML = '<div class="error-message">Missing lead id.</div>';
      return;
    }
    root.innerHTML = '<div class="loading">Loading client profile from database...</div>';
    try {
      renderProfile(await loadLead(leadId));
    } catch (err) {
      console.error("Failed to load lead profile", err);
      root.innerHTML = '<div class="error-message">Lead not found in the database.</div>';
    }
  }

  init();
})();
