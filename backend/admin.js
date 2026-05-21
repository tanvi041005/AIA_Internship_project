(async function adminDashboard() {
  const role = (sessionStorage.getItem("dashboardRole") || "").toLowerCase();
  const user = sessionStorage.getItem("dashboardUser") || "Admin";

  if (role !== "admin") {
    window.location.replace("index.html");
    return;
  }

  const state = {
    users: [],
    selectedRole: ""
  };

  function money(value) {
    return new Intl.NumberFormat("en-SG", {
      style: "currency",
      currency: "SGD",
      maximumFractionDigits: 0
    }).format(Number(value || 0));
  }

  function compactMoney(value) {
    const n = Number(value || 0);
    if (Math.abs(n) >= 1000000) return "SGD " + (n / 1000000).toFixed(1) + "M";
    if (Math.abs(n) >= 1000) return "SGD " + (n / 1000).toFixed(1) + "K";
    return money(n);
  }

  function esc(value) {
    const node = document.createElement("div");
    node.textContent = String(value == null ? "" : value);
    return node.innerHTML;
  }

  function normalizeRole(roleKey) {
    const value = String(roleKey || "").toLowerCase();
    if (value === "district_manager" || value === "district") return "admin";
    return value;
  }

  function roleLabel(roleKey) {
    return {
      admin: "Admin",
      leader: "Agency Leader",
      agent: "Agent"
    }[normalizeRole(roleKey)] || roleKey || "User";
  }

  function getUserAgency(row) {
    return row.agency || row.team_name || row.teamName || "";
  }

  function showUserMsg(type, text) {
    const el = document.getElementById("admin-user-form-msg");
    if (!el) return;
    el.className = text ? "team-msg " + type : "team-msg";
    el.textContent = text || "";
  }

  function resetUserForm() {
    const form = document.getElementById("admin-user-form");
    const editingId = document.getElementById("admin-user-editing-id");
    const userId = document.getElementById("admin-user-id");
    const password = document.getElementById("admin-user-password");
    const submit = document.getElementById("admin-user-submit-btn");
    const cancel = document.getElementById("admin-user-cancel-btn");
    if (form) form.reset();
    if (editingId) editingId.value = "";
    if (userId) userId.disabled = false;
    if (password) {
      password.required = true;
      password.placeholder = "Required for new users";
    }
    if (submit) submit.textContent = "Create user";
    if (cancel) cancel.hidden = true;
  }

  function normalizeImportText(value) {
    return String(value == null ? "" : value).trim();
  }

  function normalizeAgentCode(value) {
    const raw = normalizeImportText(value);
    if (!raw) return "";
    if (/^\d+(\.0+)?$/.test(raw)) return String(Math.round(Number(raw)));
    return raw.toUpperCase();
  }

  function getWorksheetCellValue(ws, col, row) {
    const cell = ws[XLSX.utils.encode_cell({ c: col, r: row })];
    return cell ? cell.v : "";
  }

  function buildAgentCodeLookup(wb) {
    const lookup = {};
    const candidateSheets = ["YTD Cases", "Summary (Performance Bonus)", "YTD SPI", "YTD PA", "YTD AI"];
    candidateSheets.forEach(function(sheetName) {
      const ws = wb.Sheets[sheetName];
      if (!ws || !ws["!ref"]) return;
      const range = XLSX.utils.decode_range(ws["!ref"]);
      for (let row = 1; row <= range.e.r; row += 1) {
        const code = normalizeAgentCode(getWorksheetCellValue(ws, 1, row));
        const name = normalizeImportText(getWorksheetCellValue(ws, 3, row));
        if (code && name && name.toLowerCase() !== "agent name") {
          lookup[name.toLowerCase()] = code;
        }
      }
    });
    return lookup;
  }

  function parseProductionRows(wb) {
    const ws = wb.Sheets["Summary"] || wb.Sheets[wb.SheetNames[0]];
    const agentCodeByName = buildAgentCodeLookup(wb);
    const range = XLSX.utils.decode_range(ws["!ref"] || "A1");
    const agents = [];
    let lastAgency = "";

    function cellVal(col, row) {
      return getWorksheetCellValue(ws, col, row);
    }
    function toNum(value) {
      return parseFloat(value) || 0;
    }

    for (let row = 2; row <= range.e.r; row += 1) {
      const agentName = normalizeImportText(cellVal(1, row));
      if (!agentName) continue;
      const agencyCell = normalizeImportText(cellVal(0, row));
      if (agencyCell) lastAgency = agencyCell;
      agents.push({
        agentId: agentCodeByName[agentName.toLowerCase()] || "",
        agency: lastAgency,
        name: agentName,
        mtdFyc: toNum(cellVal(2, row)),
        mtdCases: toNum(cellVal(3, row)),
        ytdFyc: toNum(cellVal(4, row)),
        ytdFyp: toNum(cellVal(5, row)),
        ytdCases: toNum(cellVal(6, row)),
        target: toNum(cellVal(7, row)),
        todo: toNum(cellVal(8, row))
      });
    }
    return agents;
  }

  async function loadData() {
    try {
      const users = await apiGet("/users");
      state.users = Array.isArray(users) ? users : [];
    } catch (error) {
      console.warn("Failed to load users:", error);
      state.users = [];
    }
    document.getElementById("admin-current-user").textContent = user;
  }

  function renderUsers() {
    const tbody = document.getElementById("admin-users-table-body");
    const summary = document.getElementById("admin-users-summary");
    if (!tbody) return;
    const filtered = state.selectedRole
      ? state.users.filter(function(row) { return normalizeRole(row.role || row.role_key) === state.selectedRole; })
      : state.users;

    if (summary) summary.textContent = filtered.length + " shown from " + state.users.length + " users";
    tbody.innerHTML = filtered.length
      ? filtered.map(function(row) {
          const roleKey = normalizeRole(row.role || row.role_key);
          return `
            <tr>
              <td>${esc(row.user_id)}</td>
              <td>${esc(row.full_name || "-")}</td>
              <td><span class="status-pill ${roleKey === "admin" ? "urgent" : "non-urgent"}">${esc(roleLabel(roleKey))}</span></td>
              <td>${esc(getUserAgency(row) || "-")}</td>
              <td class="admin-table-actions">
                <button type="button" class="admin-action-btn edit" data-edit-user="${esc(row.user_id)}">Edit</button>
                <button type="button" class="admin-action-btn delete" data-delete-user="${esc(row.user_id)}">Delete</button>
              </td>
            </tr>
          `;
        }).join("")
      : "<tr><td colspan='5'>No users found.</td></tr>";
  }

  function startEditUser(userId) {
    const row = state.users.find(function(item) {
      return String(item.user_id || "").toUpperCase() === String(userId || "").toUpperCase();
    });
    if (!row) return;
    document.getElementById("admin-user-editing-id").value = row.user_id;
    document.getElementById("admin-user-id").value = row.user_id;
    document.getElementById("admin-user-id").disabled = true;
    document.getElementById("admin-user-name").value = row.full_name || "";
    document.getElementById("admin-user-role").value = normalizeRole(row.role || row.role_key) || "agent";
    document.getElementById("admin-user-agency").value = getUserAgency(row);
    document.getElementById("admin-user-password").value = "";
    document.getElementById("admin-user-password").required = false;
    document.getElementById("admin-user-password").placeholder = "Leave blank to keep current password";
    document.getElementById("admin-user-submit-btn").textContent = "Save changes";
    document.getElementById("admin-user-cancel-btn").hidden = false;
    showUserMsg("", "");
    document.getElementById("admin-user-form").scrollIntoView({ behavior: "smooth", block: "center" });
  }

  async function saveUser(event) {
    event.preventDefault();
    showUserMsg("", "");

    const editingId = document.getElementById("admin-user-editing-id").value.trim().toUpperCase();
    const userId = document.getElementById("admin-user-id").value.trim().toUpperCase();
    const fullName = document.getElementById("admin-user-name").value.trim();
    const roleKey = document.getElementById("admin-user-role").value;
    const agency = document.getElementById("admin-user-agency").value;
    const password = document.getElementById("admin-user-password").value.trim();

    if (!userId || !fullName || !roleKey) {
      showUserMsg("error", "User ID, full name, and role are required.");
      return;
    }
    if (!editingId && !password) {
      showUserMsg("error", "Password is required for new users.");
      return;
    }
    if (password && password.trim().length < 4) {
      showUserMsg("error", "Password must be at least 4 characters.");
      return;
    }

    try {
      if (editingId) {
        const payload = { full_name: fullName, role: roleKey, agency, is_active: true };
        if (password) payload.password = password;
        await apiPut("/users/" + encodeURIComponent(editingId), payload);
        showUserMsg("success", "Updated " + editingId + ".");
      } else {
        await apiPost("/users", {
          user_id: userId,
          full_name: fullName,
          role: roleKey,
          agency,
          password,
          is_active: true
        });
        showUserMsg("success", "Created " + userId + ".");
      }
      resetUserForm();
      await loadData();
      renderAll();
    } catch (error) {
      showUserMsg("error", error.message || "Could not save user.");
    }
  }

  async function deleteUser(userId) {
    const normalized = String(userId || "").toUpperCase();
    if (!normalized) return;
    if (normalized === String(user || "").toUpperCase()) {
      showUserMsg("error", "You cannot delete the user you are currently signed in as.");
      return;
    }
    if (!window.confirm("Deactivate user " + normalized + "?")) return;
    try {
      await apiDelete("/users/" + encodeURIComponent(normalized));
      await loadData();
      renderAll();
      showUserMsg("success", "Deleted " + normalized + ".");
    } catch (error) {
      showUserMsg("error", error.message || "Could not delete user.");
    }
  }

  function renderImportPreview(rows, fileName) {
    const content = document.getElementById("admin-production-report-content");
    const label = document.getElementById("admin-production-report-label");
    if (!content) return;
    const agencies = Array.from(new Set(rows.map(function(row) { return row.agency; }).filter(Boolean)));
    const missingCodes = rows.filter(function(row) { return !row.agentId; }).length;
    const totalYtd = rows.reduce(function(sum, row) { return sum + Number(row.ytdFyc || 0); }, 0);
    const totalMtdCases = rows.reduce(function(sum, row) { return sum + Number(row.mtdCases || 0); }, 0);
    if (label) label.textContent = rows.length + " rows parsed from " + fileName;
    content.innerHTML = `
      <div class="prod-kpi-row">
        <div class="prod-kpi"><span>Rows</span><strong>${rows.length}</strong></div>
        <div class="prod-kpi"><span>Agencies</span><strong>${agencies.length}</strong></div>
        <div class="prod-kpi"><span>YTD FYC</span><strong>${esc(compactMoney(totalYtd))}</strong></div>
        <div class="prod-kpi"><span>MTD Cases</span><strong>${totalMtdCases}</strong></div>
      </div>
      <p class="chart-insight">${missingCodes ? missingCodes + " rows did not have an agent code. Add the real code before importing." : "All parsed rows include an agent code."}</p>
    `;
  }

  function wireFilters() {
    const roleFilter = document.getElementById("admin-role-filter");
    if (roleFilter) {
      roleFilter.addEventListener("change", function() {
        state.selectedRole = roleFilter.value;
        renderUsers();
      });
    }
  }

  function wireUserManagement() {
    const form = document.getElementById("admin-user-form");
    const cancel = document.getElementById("admin-user-cancel-btn");
    const tbody = document.getElementById("admin-users-table-body");
    if (form) form.addEventListener("submit", saveUser);
    if (cancel) {
      cancel.addEventListener("click", function() {
        resetUserForm();
        showUserMsg("", "");
      });
    }
    if (tbody) {
      tbody.addEventListener("click", function(event) {
        const edit = event.target.closest("[data-edit-user]");
        const del = event.target.closest("[data-delete-user]");
        if (edit) {
          startEditUser(edit.getAttribute("data-edit-user"));
          return;
        }
        if (del) {
          deleteUser(del.getAttribute("data-delete-user"));
        }
      });
    }
  }

  function wireUpload() {
    const input = document.getElementById("admin-production-file-input");
    if (!input) return;
    input.addEventListener("change", function(event) {
      const file = event.target.files && event.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = async function(loadEvent) {
        const label = document.getElementById("admin-production-report-label");
        try {
          const wb = XLSX.read(loadEvent.target.result, { type: "array" });
          const rows = parseProductionRows(wb);
          if (!rows.length) throw new Error("No agent rows found in the Summary sheet.");
          renderImportPreview(rows, file.name);
          if (label) label.textContent = "Uploading " + rows.length + " rows to database...";
          await apiPost("/performance/bulk", {
            periodYear: new Date().getFullYear(),
            periodLabel: "current",
            rows
          });
          if (label) label.textContent = "Upload complete: " + rows.length + " rows imported";
          await loadData();
          renderAll();
        } catch (error) {
          const content = document.getElementById("admin-production-report-content");
          if (content) content.innerHTML = "<p class='prod-placeholder' style='color:var(--brand)'>Could not import file: " + esc(error.message) + "</p>";
        } finally {
          input.value = "";
        }
      };
      reader.readAsArrayBuffer(file);
    });
  }

  function renderAll() {
    renderUsers();
  }

  wireFilters();
  wireUserManagement();
  wireUpload();
  await loadData();
  renderAll();
})();
