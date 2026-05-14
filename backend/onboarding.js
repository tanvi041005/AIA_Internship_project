(async function () {
      var role = (sessionStorage.getItem("dashboardRole") || "").toLowerCase();
      if (role === "agent") {
        window.location.replace("index.html");
        return;
      }

      var STORAGE_KEY = "fm_team_members_v1";
      var managerId = (sessionStorage.getItem("dashboardUser") || "").toUpperCase();

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

      function render() {
        var list = getList().slice().sort(function (a, b) {
          return String(a.agentId).localeCompare(String(b.agentId));
        });
        var tbody = document.getElementById("team-roster-body");
        var table = document.getElementById("team-roster-table");
        var empty = document.getElementById("team-roster-empty");
        var countEl = document.getElementById("team-roster-count");

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

        tbody.querySelectorAll(".team-remove-btn[data-agent-id]").forEach(function (btn) {
          btn.addEventListener("click", function () {
            var aid = (btn.getAttribute("data-agent-id") || "").toUpperCase();
            var fresh = getList().filter(function (m) {
              return String(m.agentId || "").toUpperCase() !== aid;
            });
            setList(fresh);
            render();
          });
        });
      }

      document.getElementById("team-add-form").addEventListener("submit", function (e) {
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

        var list = getList();
        if (list.some(function (m) { return String(m.agentId).toUpperCase() === idRaw; })) {
          showMsg(msgEl, "error", "That Agent ID is already on your roster.");
          return;
        }

        var member = { agentId: idRaw, name: name, notes: notes, joined: new Date().toISOString() };
        list.push(member);
        setList(list);
        if (typeof apiPost === "function") {
          apiPost("/teams/" + encodeURIComponent(managerId), { agent_id: idRaw, notes: notes }).catch(function() {});
        }
        document.getElementById("team-add-form").reset();
        showMsg(msgEl, "success", "Added " + idRaw + " to your team.");
        render();
      });

      // Wire remove buttons to also call API
      document.getElementById("team-roster-body").addEventListener("click", function(e) {
        var btn = e.target.closest(".team-remove-btn[data-agent-id]");
        if (!btn) return;
        var aid = (btn.getAttribute("data-agent-id") || "").toUpperCase();
        if (typeof apiDelete === "function") {
          apiDelete("/teams/" + encodeURIComponent(managerId) + "/" + encodeURIComponent(aid)).catch(function() {});
        }
      });

      // Load team roster from GET /teams/:managerId
      if (typeof apiGet === "function" && managerId) {
        try {
          var members = await apiGet("/teams/" + encodeURIComponent(managerId));
          if (Array.isArray(members) && members.length > 0) {
            var mapped = members.map(function(m) {
              return { agentId: String(m.agent_id || "").toUpperCase(), name: m.full_name || m.name || "", notes: m.notes || "", joined: m.joined_at || "" };
            });
            setList(mapped);
          }
        } catch (e) { console.warn("Failed to load team roster:", e); }
      }

      render();
    })();