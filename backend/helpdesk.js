(async function () {
  let tickets = [];
  let filter = "all";
  let query = "";
  let openId = null;

  function normalizeTicket(row) {
    return {
      id: Number(row.ticket_id || row.id),
      title: row.title || "",
      desc: row.description || row.desc || "",
      reporter: row.reporter || row.reported_by || "",
      reportedAt: row.reported_at || row.reportedAt || "",
      priority: row.priority || "low",
      status: row.status || "open",
      category: row.category || "General"
    };
  }

  async function loadTickets() {
    const rows = await apiGet("/helpdesk/tickets").catch(function () { return []; });
    tickets = Array.isArray(rows) ? rows.map(normalizeTicket) : [];
  }

  function relTime(iso) {
    const date = new Date(iso);
    if (isNaN(date.getTime())) return "-";
    const diff = (Date.now() - date) / 1000;
    if (diff < 60) return "just now";
    if (diff < 3600) return Math.floor(diff / 60) + " min ago";
    if (diff < 86400) return Math.floor(diff / 3600) + " hr ago";
    return Math.floor(diff / 86400) + " day" + (Math.floor(diff / 86400) > 1 ? "s" : "") + " ago";
  }

  function badgeClass(s) {
    return { open: "badge-open", progress: "badge-progress", done: "badge-done", urgent: "badge-urgent" }[s] || "badge-open";
  }

  function badgeLabel(t) {
    if (t.priority === "high" && t.status === "open") return "URGENT";
    if (t.status === "progress") return "IN PROGRESS";
    if (t.status === "done") return "DONE";
    return "OPEN";
  }

  function priorityLabel(p) {
    return { high: "High priority", medium: "Medium", low: "Low" }[p] || p;
  }

  function nextStatus(current) {
    if (current === "open") return "progress";
    if (current === "progress") return "done";
    return "open";
  }

  function nextStatusLabel(current) {
    if (current === "open") return "Mark In Progress";
    if (current === "progress") return "Mark Done";
    return "Reopen";
  }

  function filteredTickets() {
    return tickets.filter(t => {
      const matchFilter = filter === "all" || (filter === "open" && t.status === "open") || (filter === "progress" && t.status === "progress") || (filter === "done" && t.status === "done") || (filter === "high" && t.priority === "high" && t.status !== "done");
      const matchQuery = !query || t.title.toLowerCase().includes(query) || t.reporter.toLowerCase().includes(query) || t.category.toLowerCase().includes(query) || String(t.id).includes(query);
      return matchFilter && matchQuery;
    });
  }

  function updateCounts() {
    const open = tickets.filter(t => t.status === "open").length;
    const progress = tickets.filter(t => t.status === "progress").length;
    const done = tickets.filter(t => t.status === "done").length;
    const high = tickets.filter(t => t.priority === "high" && t.status !== "done").length;
    document.getElementById("cnt-all").textContent = tickets.length;
    document.getElementById("cnt-open").textContent = open;
    document.getElementById("cnt-progress").textContent = progress;
    document.getElementById("cnt-done").textContent = done;
    document.getElementById("cnt-high").textContent = high;
    document.getElementById("kpi-open").textContent = open + progress;
    document.getElementById("kpi-resolved").textContent = done;
    document.getElementById("kpi-high").textContent = high;
  }

  function renderList() {
    updateCounts();
    const list = document.getElementById("hd-list");
    const visible = filteredTickets();
    if (!visible.length) {
      list.innerHTML = `<div class="hd-empty">No tickets found in the database for this filter.</div>`;
      return;
    }
    list.innerHTML = visible.map(t => {
      const bl = t.priority === "high" && t.status !== "done" ? "badge-urgent" : t.status === "progress" ? "badge-progress" : t.status === "done" ? "badge-done" : "badge-open";
      return `<div class="hd-ticket priority-${t.priority} status-${t.status}" data-id="${t.id}" role="button" tabindex="0" aria-label="Ticket #${t.id}: ${t.title}">
        <span class="hd-ticket-id">#${String(t.id).padStart(4, "0")}</span>
        <div class="hd-ticket-body"><p class="hd-ticket-title">${t.title}</p><p class="hd-ticket-meta">Reported ${relTime(t.reportedAt)} &middot; ${t.reporter} &middot; ${t.category}</p></div>
        <span class="hd-ticket-priority">${priorityLabel(t.priority)}</span><span class="hd-badge ${bl}">${badgeLabel(t)}</span>
      </div>`;
    }).join("");
    list.querySelectorAll(".hd-ticket").forEach(row => {
      const open = () => openDrawer(+row.dataset.id);
      row.addEventListener("click", open);
      row.addEventListener("keydown", e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); open(); } });
    });
  }

  function openDrawer(id) {
    openId = id;
    const t = tickets.find(x => x.id === id);
    if (!t) return;
    document.getElementById("drawer-title").textContent = `#${String(t.id).padStart(4, "0")} · ${t.category}`;
    document.getElementById("drawer-body").innerHTML = `
      <div class="drawer-field"><span class="drawer-field-lbl">Title</span><span class="drawer-field-val" style="font-weight:600">${t.title}</span></div>
      <div class="drawer-field"><span class="drawer-field-lbl">Description</span><span class="drawer-field-val">${t.desc || "No description provided."}</span></div>
      <div class="drawer-field"><span class="drawer-field-lbl">Reporter</span><span class="drawer-field-val">${t.reporter}</span></div>
      <div class="drawer-field"><span class="drawer-field-lbl">Reported</span><span class="drawer-field-val">${relTime(t.reportedAt)}</span></div>
      <div class="drawer-field"><span class="drawer-field-lbl">Category</span><span class="drawer-field-val">${t.category}</span></div>
      <div class="drawer-field"><span class="drawer-field-lbl">Priority</span><span class="drawer-field-val">${priorityLabel(t.priority)}</span></div>
      <div class="drawer-field"><span class="drawer-field-lbl">Status</span><span class="hd-badge ${badgeClass(t.status === "open" && t.priority === "high" ? "urgent" : t.status)}" style="display:inline-block">${badgeLabel(t)}</span></div>`;
    document.getElementById("drawer-actions").innerHTML = `<button class="action-btn primary" id="drawer-status-btn">${nextStatusLabel(t.status)}</button><button class="action-btn danger" id="drawer-delete-btn">Delete</button>`;
    document.getElementById("drawer-status-btn").addEventListener("click", async () => {
      await apiPut("/helpdesk/tickets/" + encodeURIComponent(id), { status: nextStatus(t.status) });
      await loadTickets();
      renderList();
      openDrawer(id);
    });
    document.getElementById("drawer-delete-btn").addEventListener("click", async () => {
      if (!confirm(`Delete ticket #${String(t.id).padStart(4, "0")}?`)) return;
      await apiDelete("/helpdesk/tickets/" + encodeURIComponent(id));
      await loadTickets();
      closeDrawer();
      renderList();
    });
    document.getElementById("hd-overlay").classList.add("open");
    document.getElementById("hd-drawer").classList.add("open");
    document.getElementById("drawer-close").focus();
  }

  function closeDrawer() {
    document.getElementById("hd-overlay").classList.remove("open");
    document.getElementById("hd-drawer").classList.remove("open");
    openId = null;
  }

  function openModal() {
    document.getElementById("f-title").value = "";
    document.getElementById("f-desc").value = "";
    document.getElementById("f-reporter").value = sessionStorage.getItem("dashboardUser") || "";
    document.getElementById("modal-bg").classList.add("open");
    document.getElementById("f-title").focus();
  }

  function closeModal() {
    document.getElementById("modal-bg").classList.remove("open");
  }

  document.getElementById("drawer-close").addEventListener("click", closeDrawer);
  document.getElementById("hd-overlay").addEventListener("click", closeDrawer);
  document.addEventListener("keydown", e => { if (e.key === "Escape") { closeDrawer(); closeModal(); } });
  document.getElementById("new-ticket-btn").addEventListener("click", openModal);
  document.getElementById("modal-close").addEventListener("click", closeModal);
  document.getElementById("modal-cancel").addEventListener("click", closeModal);
  document.getElementById("modal-submit").addEventListener("click", async () => {
    const title = document.getElementById("f-title").value.trim();
    const reporter = document.getElementById("f-reporter").value.trim();
    if (!title) { document.getElementById("f-title").focus(); return; }
    if (!reporter) { document.getElementById("f-reporter").focus(); return; }
    await apiPost("/helpdesk/tickets", {
      title,
      description: document.getElementById("f-desc").value.trim(),
      reporter,
      priority: document.getElementById("f-priority").value,
      category: document.getElementById("f-category").value
    });
    await loadTickets();
    closeModal();
    renderList();
  });
  document.getElementById("filter-tabs").addEventListener("click", e => {
    const btn = e.target.closest(".hd-filter-btn");
    if (!btn) return;
    document.querySelectorAll(".hd-filter-btn").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    filter = btn.dataset.filter;
    renderList();
  });
  document.getElementById("hd-search").addEventListener("input", e => {
    query = e.target.value.trim().toLowerCase();
    renderList();
  });

  await loadTickets();
  renderList();
})();
