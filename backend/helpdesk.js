// ─── Default tickets ──────────────────────────────────
    const TICKETS_KEY = "fm_helpdesk_v1";

    const SEED = [
      { id: 247, title: "SharePoint access denied on Resources tab",
        desc: "Agent cannot access the SharePoint resource links. Getting 403 Forbidden error when clicking any document link.",
        reporter: "Charvelle Tan", reportedAt: "2026-05-08T10:48:00",
        priority: "high", status: "open", category: "Access" },
      { id: 246, title: "CPF Calculator not saving inputs on Safari",
        desc: "When using Safari browser, the CPF calculator fields reset when switching between browser tabs. Affects iOS and macOS users.",
        reporter: "Qistinah Bte Rashid", reportedAt: "2026-05-08T08:30:00",
        priority: "medium", status: "open", category: "Bug" },
      { id: 245, title: "Need access to AIA iSmart for client demos",
        desc: "Requesting access to the AIA iSmart financial planning tool for use during client meetings and product presentations.",
        reporter: "Soon Chuan Lim", reportedAt: "2026-05-07T16:20:00",
        priority: "low", status: "progress", category: "Access" },
      { id: 244, title: "Calendar sync timeout on district events",
        desc: "District calendar events take over 10 seconds to load. Suspected issue with the SG holiday API fallback logic.",
        reporter: "Kristen Ng", reportedAt: "2026-05-07T14:00:00",
        priority: "low", status: "done", category: "Performance" },
      { id: 243, title: "Leads module table overflows on mobile",
        desc: "The leads table scrolls horizontally on mobile screen widths and the detail drawer doesn't open properly on touch devices.",
        reporter: "Brandon Lee", reportedAt: "2026-05-06T09:15:00",
        priority: "medium", status: "open", category: "Bug" },
      { id: 242, title: "Training video playback fails on Edge browser",
        desc: "Module 1 YouTube video shows 'Video unavailable' on Microsoft Edge. Works correctly on Chrome and Firefox.",
        reporter: "Alicia Tan", reportedAt: "2026-05-05T11:30:00",
        priority: "low", status: "done", category: "Bug" },
    ];

    // ─── Load / save ──────────────────────────────────────
    function loadTickets() {
      try {
        const raw = localStorage.getItem(TICKETS_KEY);
        if (raw) return JSON.parse(raw);
      } catch(e) {}
      return JSON.parse(JSON.stringify(SEED));
    }
    function saveTickets(t) { localStorage.setItem(TICKETS_KEY, JSON.stringify(t)); }

    let tickets  = loadTickets();
    let filter   = "all";
    let query    = "";
    let openId   = null;

    // ─── Helpers ──────────────────────────────────────────
    function relTime(iso) {
      const diff = (Date.now() - new Date(iso)) / 1000;
      if (diff < 60)   return "just now";
      if (diff < 3600) return Math.floor(diff / 60) + " min ago";
      if (diff < 86400)return Math.floor(diff / 3600) + " hr ago";
      return Math.floor(diff / 86400) + " day" + (Math.floor(diff / 86400) > 1 ? "s" : "") + " ago";
    }
    function badgeClass(s) {
      return { open: "badge-open", progress: "badge-progress", done: "badge-done", urgent: "badge-urgent" }[s]
        || (s === "open" ? "badge-open" : "badge-done");
    }
    function badgeLabel(t) {
      if (t.priority === "high" && t.status === "open") return "URGENT";
      if (t.status === "progress") return "IN PROGRESS";
      if (t.status === "done")     return "DONE";
      return "OPEN";
    }
    function priorityLabel(p) {
      return { high: "High priority", medium: "Medium", low: "Low" }[p] || p;
    }
    function nextStatus(current) {
      if (current === "open")     return "progress";
      if (current === "progress") return "done";
      return "open";
    }
    function nextStatusLabel(current) {
      if (current === "open")     return "Mark In Progress";
      if (current === "progress") return "Mark Done";
      return "Reopen";
    }

    // ─── Filter & render list ─────────────────────────────
    function filteredTickets() {
      return tickets.filter(t => {
        const matchFilter =
          filter === "all"      ||
          (filter === "open"     && t.status === "open")     ||
          (filter === "progress" && t.status === "progress") ||
          (filter === "done"     && t.status === "done")     ||
          (filter === "high"     && t.priority === "high" && t.status !== "done");
        const matchQuery = !query ||
          t.title.toLowerCase().includes(query) ||
          t.reporter.toLowerCase().includes(query) ||
          t.category.toLowerCase().includes(query) ||
          String(t.id).includes(query);
        return matchFilter && matchQuery;
      });
    }

    function updateCounts() {
      const open     = tickets.filter(t => t.status === "open").length;
      const progress = tickets.filter(t => t.status === "progress").length;
      const done     = tickets.filter(t => t.status === "done").length;
      const high     = tickets.filter(t => t.priority === "high" && t.status !== "done").length;

      document.getElementById("cnt-all").textContent      = tickets.length;
      document.getElementById("cnt-open").textContent     = open;
      document.getElementById("cnt-progress").textContent = progress;
      document.getElementById("cnt-done").textContent     = done;
      document.getElementById("cnt-high").textContent     = high;

      document.getElementById("kpi-open").textContent     = open + progress;
      document.getElementById("kpi-resolved").textContent = done;
      document.getElementById("kpi-high").textContent     = high;
    }

    function renderList() {
      updateCounts();
      const list    = document.getElementById("hd-list");
      const visible = filteredTickets();
      if (visible.length === 0) {
        list.innerHTML = `<div class="hd-empty">No tickets match this filter.</div>`;
        return;
      }
      list.innerHTML = visible.map(t => {
        const bl = t.priority === "high" && t.status !== "done" ? "badge-urgent"
                 : t.status === "progress" ? "badge-progress"
                 : t.status === "done"     ? "badge-done" : "badge-open";
        const bl2 = t.priority === "high" && t.status === "open" ? "URGENT"
                  : t.status === "progress" ? "IN PROGRESS"
                  : t.status === "done"     ? "DONE" : "OPEN";
        return `<div class="hd-ticket priority-${t.priority} status-${t.status}"
                     data-id="${t.id}" role="button" tabindex="0"
                     aria-label="Ticket #${t.id}: ${t.title}">
          <span class="hd-ticket-id">#${String(t.id).padStart(4, "0")}</span>
          <div class="hd-ticket-body">
            <p class="hd-ticket-title">${t.title}</p>
            <p class="hd-ticket-meta">Reported ${relTime(t.reportedAt)} &middot; ${t.reporter} &middot; ${t.category}</p>
          </div>
          <span class="hd-ticket-priority">${priorityLabel(t.priority)}</span>
          <span class="hd-badge ${bl}">${bl2}</span>
        </div>`;
      }).join("");

      list.querySelectorAll(".hd-ticket").forEach(row => {
        const open = () => openDrawer(+row.dataset.id);
        row.addEventListener("click", open);
        row.addEventListener("keydown", e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); open(); } });
      });
    }

    // ─── Drawer ───────────────────────────────────────────
    function openDrawer(id) {
      openId = id;
      const t = tickets.find(x => x.id === id);
      if (!t) return;

      document.getElementById("drawer-title").textContent = `#${String(t.id).padStart(4, "0")} · ${t.category}`;
      document.getElementById("drawer-body").innerHTML = `
        <div class="drawer-field">
          <span class="drawer-field-lbl">Title</span>
          <span class="drawer-field-val" style="font-weight:600">${t.title}</span>
        </div>
        <div class="drawer-field">
          <span class="drawer-field-lbl">Description</span>
          <span class="drawer-field-val">${t.desc || "No description provided."}</span>
        </div>
        <div class="drawer-field">
          <span class="drawer-field-lbl">Reporter</span>
          <span class="drawer-field-val">${t.reporter}</span>
        </div>
        <div class="drawer-field">
          <span class="drawer-field-lbl">Reported</span>
          <span class="drawer-field-val">${relTime(t.reportedAt)}</span>
        </div>
        <div class="drawer-field">
          <span class="drawer-field-lbl">Category</span>
          <span class="drawer-field-val">${t.category}</span>
        </div>
        <div class="drawer-field">
          <span class="drawer-field-lbl">Priority</span>
          <span class="drawer-field-val">${priorityLabel(t.priority)}</span>
        </div>
        <div class="drawer-field">
          <span class="drawer-field-lbl">Status</span>
          <span class="hd-badge ${badgeClass(t.status === "open" && t.priority === "high" ? "urgent" : t.status)}"
                style="display:inline-block">
            ${badgeLabel(t)}
          </span>
        </div>
      `;

      document.getElementById("drawer-actions").innerHTML = `
        <button class="action-btn primary" id="drawer-status-btn">${nextStatusLabel(t.status)}</button>
        <button class="action-btn danger"  id="drawer-delete-btn">Delete</button>
      `;

      document.getElementById("drawer-status-btn").addEventListener("click", () => {
        t.status = nextStatus(t.status);
        saveTickets(tickets);
        renderList();
        openDrawer(id);
      });
      document.getElementById("drawer-delete-btn").addEventListener("click", () => {
        if (confirm(`Delete ticket #${String(t.id).padStart(4,"0")}?`)) {
          tickets = tickets.filter(x => x.id !== id);
          saveTickets(tickets);
          closeDrawer();
          renderList();
        }
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

    document.getElementById("drawer-close").addEventListener("click", closeDrawer);
    document.getElementById("hd-overlay").addEventListener("click", closeDrawer);
    document.addEventListener("keydown", e => { if (e.key === "Escape") { closeDrawer(); closeModal(); } });

    // ─── New ticket modal ─────────────────────────────────
    function openModal() {
      document.getElementById("f-title").value    = "";
      document.getElementById("f-desc").value     = "";
      document.getElementById("f-reporter").value = sessionStorage.getItem("dashboardUser") || "";
      document.getElementById("hd-modal-bg") || 0;
      document.getElementById("modal-bg").classList.add("open");
      document.getElementById("f-title").focus();
    }
    function closeModal() {
      document.getElementById("modal-bg").classList.remove("open");
    }

    document.getElementById("new-ticket-btn").addEventListener("click", openModal);
    document.getElementById("modal-close").addEventListener("click",  closeModal);
    document.getElementById("modal-cancel").addEventListener("click", closeModal);

    document.getElementById("modal-submit").addEventListener("click", () => {
      const title    = document.getElementById("f-title").value.trim();
      const reporter = document.getElementById("f-reporter").value.trim();
      if (!title)    { document.getElementById("f-title").focus();    return; }
      if (!reporter) { document.getElementById("f-reporter").focus(); return; }

      const newId = Math.max(...tickets.map(t => t.id), 247) + 1;
      tickets.unshift({
        id:         newId,
        title,
        desc:       document.getElementById("f-desc").value.trim(),
        reporter,
        reportedAt: new Date().toISOString(),
        priority:   document.getElementById("f-priority").value,
        status:     "open",
        category:   document.getElementById("f-category").value,
      });
      saveTickets(tickets);
      closeModal();
      renderList();
    });

    // ─── Filters ──────────────────────────────────────────
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

    renderList();