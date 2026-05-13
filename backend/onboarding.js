(function () {
  var role = (sessionStorage.getItem("dashboardRole") || "").toLowerCase();
  if (role === "agent") {
    window.location.replace("index.html");
    return;
  }

  var managerId = (sessionStorage.getItem("dashboardUser") || "").toUpperCase();
  var members = [];

  function esc(s) {
    var n = document.createElement("div");
    n.textContent = String(s || "");
    return n.innerHTML;
  }

  function showMsg(el, type, text) {
    el.className = "team-msg " + type;
    el.textContent = text;
    if (!text) {
      el.className = "team-msg";
      el.textContent = "";
    }
  }

  function normalizeMember(row) {
    return {
      agentId: String(row.agentId || row.agent_id || "").toUpperCase(),
      name: row.name || row.full_name || "",
      joined: row.joined || row.joined_at || "",
      notes: row.notes || ""
    };
  }

  async function loadRoster() {
    var rows = await apiGet("/teams/" + encodeURIComponent(managerId));
    members = Array.isArray(rows) ? rows.map(normalizeMember) : [];
  }

  function render() {
    var list = members.slice().sort(function (a, b) {
      return String(a.agentId).localeCompare(String(b.agentId));
    });
    var tbody = document.getElementById("team-roster-body");
    var table = document.getElementById("team-roster-table");
    var empty = document.getElementById("team-roster-empty");
    var countEl = document.getElementById("team-roster-count");

    countEl.textContent = list.length + " member" + (list.length === 1 ? "" : "s");
    if (!list.length) {
      empty.hidden = false;
      table.hidden = true;
      tbody.innerHTML = "";
      return;
    }
    empty.hidden = true;
    table.hidden = false;
    tbody.innerHTML = list.map(function (m) {
      return "<tr><td><strong>" + esc(m.agentId) + "</strong></td><td>" + esc(m.name) + "</td><td>" + esc(m.joined ? new Date(m.joined).toLocaleDateString() : "-") + "</td><td>" + esc(m.notes || "") + '</td><td><button type="button" class="team-remove-btn" data-agent-id="' + esc(m.agentId) + '">Remove</button></td></tr>';
    }).join("");

    tbody.querySelectorAll(".team-remove-btn[data-agent-id]").forEach(function (btn) {
      btn.addEventListener("click", async function () {
        var aid = (btn.getAttribute("data-agent-id") || "").toUpperCase();
        try {
          await apiDelete("/teams/" + encodeURIComponent(managerId) + "/" + encodeURIComponent(aid));
          await loadRoster();
          render();
        } catch (err) {
          console.error("Failed to remove team member", err);
        }
      });
    });
  }

  document.getElementById("team-add-form").addEventListener("submit", async function (e) {
    e.preventDefault();
    var msgEl = document.getElementById("team-form-msg");
    showMsg(msgEl, "", "");

    var idRaw = document.getElementById("team-agent-id").value.trim().toUpperCase();
    var name = document.getElementById("team-name").value.trim();
    var notes = document.getElementById("team-notes").value.trim();
    if (!/^A\d+$/i.test(idRaw)) {
      showMsg(msgEl, "error", "Agent ID must match format A followed by digits (e.g. A128).");
      return;
    }
    if (!name) {
      showMsg(msgEl, "error", "Please enter the full name.");
      return;
    }
    if (members.some(function (m) { return m.agentId === idRaw; })) {
      showMsg(msgEl, "error", "That Agent ID is already on your roster.");
      return;
    }
    try {
      await apiPost("/teams/" + encodeURIComponent(managerId), { agentId: idRaw, name: name, notes: notes });
      await loadRoster();
      document.getElementById("team-add-form").reset();
      showMsg(msgEl, "success", "Added " + idRaw + " to your team.");
      render();
    } catch (err) {
      console.error("Failed to add team member", err);
      showMsg(msgEl, "error", "Could not save this roster change to the database.");
    }
  });

  async function init() {
    try {
      await loadRoster();
    } catch (err) {
      console.error("Failed to load team roster", err);
      members = [];
    }
    render();
  }

  init();
})();
