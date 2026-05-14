(async function () {
  var role = (sessionStorage.getItem("dashboardRole") || "").toLowerCase();
  if (role === "agent") {
    window.location.replace("index.html");
    return;
  }

  var isAdmin = role === "admin";
  var STORAGE_KEY = "fm_team_members_v1";
  var managerId = (sessionStorage.getItem("dashboardUser") || "").toUpperCase();
  var users = [];

  function esc(s) {
    var n = document.createElement("div");
    n.textContent = String(s || "");
    return n.innerHTML;
  }

  function showMsg(el, type, text) {
    if (!el) return;
    el.className = "team-msg " + type;
    el.textContent = text;
    if (!text) {
      el.className = "team-msg";
      el.textContent = "";
    }
  }

  function roleLabel(roleKey) {
    return {
      admin: "Admin",
      leader: "Agency Leader",
      agent: "Agent"
    }[String(roleKey || "").toLowerCase()] || roleKey || "User";
  }

  function setPageMode() {
    var title = document.getElementById("onboarding-title");
    var lede = document.getElementById("onboarding-lede");
    var adminEditor = document.getElementById("admin-user-editor-panel");
    var adminUsers = document.getElementById("admin-users-panel");
    var teamAdd = document.getElementById("team-add-panel");
    var teamRoster = document.getElementById("team-roster-panel");

    if (isAdmin) {
      if (title) title.textContent = "User Management";
      if (lede) lede.textContent = "Create, edit, and deactivate dashboard users from one admin workspace.";
      if (adminEditor) adminEditor.hidden = false;
      if (adminUsers) adminUsers.hidden = false;
      if (teamAdd) teamAdd.hidden = true;
      if (teamRoster) teamRoster.hidden = true;
      return;
    }

    if (adminEditor) adminEditor.hidden = true;
    if (adminUsers) adminUsers.hidden = true;
  }

  function readStore() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return {};
      var parsed = JSON.parse(raw);
      return parsed && typeof parsed === "object" ? parsed : {};
    } catch (e) {
      return {};
    }
  }

  function writeStore(obj) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(obj));
  }

  function getList() {
    var all = readStore();
    var list = all[managerId];
    return Array.isArray(list) ? list : [];
  }

  function setList(list) {
    var all = readStore();
    all[managerId] = list;
    writeStore(all);
  }

  function renderTeamRoster() {
    var list = getList().slice().sort(function (a, b) {
      return String(a.agentId).localeCompare(String(b.agentId));
    });
    var tbody = document.getElementById("team-roster-body");
    var table = document.getElementById("team-roster-table");
    var empty = document.getElementById("team-roster-empty");
    var countEl = document.getElementById("team-roster-count");
    if (!tbody || !table || !empty || !countEl) return;

    countEl.textContent = list.length + " member" + (list.length === 1 ? "" : "s");

    if (list.length === 0) {
      empty.hidden = false;
      table.hidden = true;
      tbody.innerHTML = "";
      return;
    }
    empty.hidden = true;
    table.hidden = false;
    tbody.innerHTML = list
      .map(function (m) {
        var aid = String(m.agentId || "").toUpperCase();
        return (
          "<tr>" +
          "<td><strong>" + esc(aid) + "</strong></td>" +
          "<td>" + esc(m.name) + "</td>" +
          "<td>" + esc(m.joined ? new Date(m.joined).toLocaleDateString() : "-") + "</td>" +
          "<td>" + esc(m.notes || "") + "</td>" +
          "<td><button type=\"button\" class=\"team-remove-btn\" data-agent-id=\"" + esc(aid) + "\">Remove</button></td>" +
          "</tr>"
        );
      })
      .join("");
  }

  function wireTeamRoster() {
    var form = document.getElementById("team-add-form");
    var body = document.getElementById("team-roster-body");
    if (!form || !body) return;

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var msgEl = document.getElementById("team-form-msg");
      showMsg(msgEl, "", "");

      var idRaw = document.getElementById("team-agent-id").value.trim().toUpperCase();
      var name = document.getElementById("team-name").value.trim();
      var notes = document.getElementById("team-notes").value.trim();

      if (!idRaw) {
        showMsg(msgEl, "error", "Agent ID is required.");
        return;
      }
      if (!name) {
        showMsg(msgEl, "error", "Please enter the full name.");
        return;
      }

      var list = getList();
      if (list.some(function (m) { return String(m.agentId).toUpperCase() === idRaw; })) {
        showMsg(msgEl, "error", "That Agent ID is already on your roster.");
        return;
      }

      var member = { agentId: idRaw, name: name, notes: notes, joined: new Date().toISOString() };
      list.push(member);
      setList(list);
      if (typeof apiPost === "function") {
        apiPost("/teams/" + encodeURIComponent(managerId), { agentId: idRaw, notes: notes }).catch(function() {});
      }
      form.reset();
      showMsg(msgEl, "success", "Added " + idRaw + " to your team.");
      renderTeamRoster();
    });

    body.addEventListener("click", function(e) {
      var btn = e.target.closest(".team-remove-btn[data-agent-id]");
      if (!btn) return;
      var aid = (btn.getAttribute("data-agent-id") || "").toUpperCase();
      var fresh = getList().filter(function (m) {
        return String(m.agentId || "").toUpperCase() !== aid;
      });
      setList(fresh);
      renderTeamRoster();
      if (typeof apiDelete === "function") {
        apiDelete("/teams/" + encodeURIComponent(managerId) + "/" + encodeURIComponent(aid)).catch(function() {});
      }
    });
  }

  async function loadTeamRoster() {
    if (typeof apiGet !== "function" || !managerId) return;
    try {
      var members = await apiGet("/teams/" + encodeURIComponent(managerId));
      if (Array.isArray(members) && members.length > 0) {
        setList(members.map(function(m) {
          return {
            agentId: String(m.agent_id || "").toUpperCase(),
            name: m.full_name || m.name || "",
            notes: m.notes || "",
            joined: m.joined_at || ""
          };
        }));
      }
    } catch (e) {
      console.warn("Failed to load team roster:", e);
    }
  }

  function resetAdminForm() {
    var form = document.getElementById("admin-user-form");
    var editingId = document.getElementById("admin-user-editing-id");
    var userId = document.getElementById("admin-user-id");
    var password = document.getElementById("admin-user-password");
    var title = document.getElementById("admin-user-form-title");
    var submit = document.getElementById("admin-user-submit-btn");
    var cancel = document.getElementById("admin-user-cancel-btn");
    if (form) form.reset();
    if (editingId) editingId.value = "";
    if (userId) userId.disabled = false;
    if (password) password.required = false;
    if (title) title.textContent = "Create user";
    if (submit) submit.textContent = "Create user";
    if (cancel) cancel.hidden = true;
  }

  async function loadUsers() {
    if (typeof apiGet !== "function") return;
    try {
      var rows = await apiGet("/users");
      users = Array.isArray(rows) ? rows : [];
    } catch (e) {
      console.warn("Failed to load users:", e);
      users = [];
    }
  }

  function renderAdminUsers() {
    var tbody = document.getElementById("admin-users-body");
    var count = document.getElementById("admin-users-count");
    if (!tbody) return;
    var sorted = users.slice().sort(function(a, b) {
      return String(a.user_id || "").localeCompare(String(b.user_id || ""));
    });
    if (count) count.textContent = sorted.length + " user" + (sorted.length === 1 ? "" : "s");
    tbody.innerHTML = sorted.length
      ? sorted.map(function(user) {
          return (
            "<tr>" +
            "<td><strong>" + esc(user.user_id) + "</strong></td>" +
            "<td>" + esc(user.full_name || "-") + "</td>" +
            "<td>" + esc(roleLabel(user.role)) + "</td>" +
            "<td>" +
              "<button type=\"button\" class=\"team-remove-btn\" data-edit-user=\"" + esc(user.user_id) + "\">Edit</button> " +
              "<button type=\"button\" class=\"team-remove-btn\" data-delete-user=\"" + esc(user.user_id) + "\">Delete</button>" +
            "</td>" +
            "</tr>"
          );
        }).join("")
      : "<tr><td colspan=\"4\">No users found.</td></tr>";
  }

  function startEditUser(userId) {
    var row = users.find(function(u) {
      return String(u.user_id || "").toUpperCase() === String(userId || "").toUpperCase();
    });
    if (!row) return;
    document.getElementById("admin-user-editing-id").value = row.user_id;
    document.getElementById("admin-user-id").value = row.user_id;
    document.getElementById("admin-user-id").disabled = true;
    document.getElementById("admin-user-name").value = row.full_name || "";
    document.getElementById("admin-user-role").value = row.role || "agent";
    document.getElementById("admin-user-password").value = "";
    document.getElementById("admin-user-password").required = false;
    document.getElementById("admin-user-form-title").textContent = "Edit user";
    document.getElementById("admin-user-submit-btn").textContent = "Save changes";
    document.getElementById("admin-user-cancel-btn").hidden = false;
    document.getElementById("admin-user-id").scrollIntoView({ behavior: "smooth", block: "center" });
  }

  async function saveAdminUser(event) {
    event.preventDefault();
    var msgEl = document.getElementById("admin-user-form-msg");
    showMsg(msgEl, "", "");

    var editingId = document.getElementById("admin-user-editing-id").value.trim().toUpperCase();
    var userId = document.getElementById("admin-user-id").value.trim().toUpperCase();
    var fullName = document.getElementById("admin-user-name").value.trim();
    var roleKey = document.getElementById("admin-user-role").value;
    var password = document.getElementById("admin-user-password").value;

    if (!userId || !fullName || !roleKey) {
      showMsg(msgEl, "error", "User ID, full name, and role are required.");
      return;
    }
    if (!editingId && !password) {
      showMsg(msgEl, "error", "Password is required for new users.");
      return;
    }

    try {
      if (editingId) {
        var updatePayload = { full_name: fullName, role: roleKey, is_active: true };
        if (password) updatePayload.password = password;
        await apiPut("/users/" + encodeURIComponent(editingId), updatePayload);
        showMsg(msgEl, "success", "Updated " + editingId + ".");
      } else {
        await apiPost("/users", {
          user_id: userId,
          full_name: fullName,
          role: roleKey,
          password: password,
          is_active: true
        });
        showMsg(msgEl, "success", "Created " + userId + ".");
      }
      resetAdminForm();
      await loadUsers();
      renderAdminUsers();
    } catch (e) {
      showMsg(msgEl, "error", e.message || "Could not save user.");
    }
  }

  function wireAdminUsers() {
    var form = document.getElementById("admin-user-form");
    var cancel = document.getElementById("admin-user-cancel-btn");
    var tbody = document.getElementById("admin-users-body");
    if (!form || !tbody) return;
    form.addEventListener("submit", saveAdminUser);
    if (cancel) {
      cancel.addEventListener("click", function() {
        resetAdminForm();
        showMsg(document.getElementById("admin-user-form-msg"), "", "");
      });
    }
    tbody.addEventListener("click", async function(event) {
      var editBtn = event.target.closest("[data-edit-user]");
      var deleteBtn = event.target.closest("[data-delete-user]");
      if (editBtn) {
        startEditUser(editBtn.getAttribute("data-edit-user"));
        return;
      }
      if (!deleteBtn) return;
      var userId = deleteBtn.getAttribute("data-delete-user");
      if (String(userId || "").toUpperCase() === managerId) {
        showMsg(document.getElementById("admin-user-form-msg"), "error", "You cannot delete the user you are currently signed in as.");
        return;
      }
      if (!window.confirm("Deactivate user " + userId + "?")) return;
      try {
        await apiDelete("/users/" + encodeURIComponent(userId));
        await loadUsers();
        renderAdminUsers();
        showMsg(document.getElementById("admin-user-form-msg"), "success", "Deleted " + userId + ".");
      } catch (e) {
        showMsg(document.getElementById("admin-user-form-msg"), "error", e.message || "Could not delete user.");
      }
    });
  }

  setPageMode();

  if (isAdmin) {
    wireAdminUsers();
    await loadUsers();
    renderAdminUsers();
  } else {
    wireTeamRoster();
    await loadTeamRoster();
    renderTeamRoster();
  }
})();
