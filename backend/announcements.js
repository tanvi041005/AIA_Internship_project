(async function announcementsPage() {
      var role = (sessionStorage.getItem("dashboardRole") || "").toLowerCase();
      var user = (sessionStorage.getItem("dashboardUser") || "").toUpperCase();
      var canCreate = role === "leader" || role === "admin";
      var RESPONSES_KEY = "fm_announcement_responses_v1";
      var announcementsCache = null;
      var responsesCache = null;

      function readJson(key, fallback) {
        try {
          var raw = localStorage.getItem(key);
          if (!raw) return fallback;
          var parsed = JSON.parse(raw);
          return parsed && typeof parsed === "object" ? parsed : fallback;
        } catch (e) {
          return fallback;
        }
      }

      function saveJson(key, value) {
        localStorage.setItem(key, JSON.stringify(value));
      }

      async function loadAnnouncements() {
        if (announcementsCache) return announcementsCache;
        var rows = await apiGet('/announcements');
        announcementsCache = rows.map(mapAnnouncement);
        return announcementsCache;
      }

      function responsesToStore(rows) {
        return (Array.isArray(rows) ? rows : []).reduce(function (store, row) {
          var response = typeof mapAnnouncementResponse === "function" ? mapAnnouncementResponse(row) : {
            announcementId: row.announcement_id,
            userId: row.user_id,
            choice: row.choice,
            note: row.note || "",
            at: row.responded_at
          };
          if (!response.announcementId || !response.userId) return store;
          if (!store[response.announcementId]) store[response.announcementId] = {};
          store[response.announcementId][String(response.userId).toUpperCase()] = {
            choice: response.choice,
            note: response.note || "",
            at: response.at
          };
          return store;
        }, {});
      }

      async function loadResponsesStore() {
        if (responsesCache) return responsesCache;
        try {
          var path = role === "agent"
            ? "/announcement-responses?userId=" + encodeURIComponent(user)
            : "/announcement-responses";
          var rows = await apiGet(path);
          responsesCache = responsesToStore(rows);
          saveJson(RESPONSES_KEY, responsesCache);
          return responsesCache;
        } catch (error) {
          console.warn("Failed to load announcement responses from API:", error);
          responsesCache = readJson(RESPONSES_KEY, {});
          return responsesCache;
        }
      }

      async function saveAnnouncementResponse(announcementId, choice, note) {
        var payload = {
          user_id: user,
          choice: choice,
          note: note || ""
        };
        try {
          await apiPost("/announcements/" + encodeURIComponent(announcementId) + "/responses", payload);
        } catch (error) {
          console.warn("Failed to save announcement response to API:", error);
        }

        var store = responsesCache || readJson(RESPONSES_KEY, {});
        if (!store[announcementId]) store[announcementId] = {};
        store[announcementId][user] = {
          choice: choice,
          note: note || "",
          at: new Date().toISOString()
        };
        responsesCache = store;
        saveJson(RESPONSES_KEY, store);
      }

      function esc(value) {
        var node = document.createElement("div");
        node.textContent = String(value || "");
        return node.innerHTML;
      }

      function responseChoices(type) {
        if (type === "rsvp") {
          return [
            { id: "yes", label: "Yes, attending" },
            { id: "maybe", label: "Maybe" },
            { id: "no", label: "Unable to attend" }
          ];
        }
        if (type === "status") {
          return [
            { id: "done", label: "Completed" },
            { id: "in_progress", label: "In progress" },
            { id: "blocked", label: "Blocked" }
          ];
        }
        return [
          { id: "ack", label: "Acknowledged" },
          { id: "clarify", label: "Need clarification" }
        ];
      }

      function typeLabel(type) {
        if (type === "rsvp") return "RSVP";
        if (type === "status") return "Progress Status";
        return "Acknowledgement";
      }

      function formatWhen(isoDate) {
        var date = new Date(isoDate);
        if (isNaN(date.getTime())) return "";
        return date.toLocaleString();
      }

      function renderCreatePanel() {
        var panel = document.getElementById("announcement-create-panel");
        if (!panel) return;
        if (!canCreate) {
          panel.classList.add("hidden");
          panel.innerHTML = "";
          return;
        }
        panel.classList.remove("hidden");
        panel.innerHTML =
          '<div class="px-6 py-5 border-b border-slate-100 bg-slate-50">' +
          '<h2 class="text-xl font-bold flex items-center gap-2"><i class="fa-solid fa-pen-to-square aia-red"></i>Create Announcement</h2>' +
          '<p class="text-sm text-slate-500 mt-1">Publish a new announcement and define how agents should respond.</p></div>' +
          '<form id="announcement-create-form" class="p-6 grid grid-cols-1 md:grid-cols-2 gap-4">' +
          '<label class="flex flex-col gap-1 text-sm"><span class="font-semibold text-slate-700">Title</span><input required id="announcement-title" class="border border-slate-300 rounded-lg px-3 py-2" maxlength="100" placeholder="Enter title"></label>' +
          '<label class="flex flex-col gap-1 text-sm"><span class="font-semibold text-slate-700">Category</span><input required id="announcement-category" class="border border-slate-300 rounded-lg px-3 py-2" maxlength="60" placeholder="Event / Policy / Alert"></label>' +
          '<label class="flex flex-col gap-1 text-sm md:col-span-2"><span class="font-semibold text-slate-700">Message</span><textarea required id="announcement-message" class="border border-slate-300 rounded-lg px-3 py-2 min-h-[96px]" maxlength="600" placeholder="Write announcement details"></textarea></label>' +
          '<label class="flex flex-col gap-1 text-sm"><span class="font-semibold text-slate-700">Response Type</span>' +
          '<select id="announcement-response-type" class="border border-slate-300 rounded-lg px-3 py-2">' +
          '<option value="acknowledge">Acknowledge / Clarification</option>' +
          '<option value="rsvp">RSVP</option>' +
          '<option value="status">Progress Status</option>' +
          '</select></label>' +
          '<div class="flex items-end"><button type="submit" class="bg-aia-red text-white px-5 py-2.5 rounded-lg font-semibold hover:bg-red-700 transition-colors">Publish</button></div>' +
          '</form>';

        var form = document.getElementById("announcement-create-form");
        if (!form) return;
        form.addEventListener("submit", async function (event) {
          event.preventDefault();
          var title = document.getElementById("announcement-title").value.trim();
          var category = document.getElementById("announcement-category").value.trim();
          var message = document.getElementById("announcement-message").value.trim();
          var responseType = document.getElementById("announcement-response-type").value;
          if (!title || !category || !message) return;

          await apiPost('/announcements', {
            title: title,
            category: category,
            message: message,
            response_type: responseType,
            created_by: user
          });
          announcementsCache = null;
          form.reset();
          await renderAnnouncements();
        });
      }

      function renderAgentResponse(announcement, existingResponse) {
        var choices = responseChoices(announcement.responseType);
        var name = "response-" + announcement.id;
        var options = choices.map(function (choice) {
          var checked = existingResponse && existingResponse.choice === choice.id ? "checked" : "";
          return '<label class="inline-flex items-center gap-2 text-sm text-slate-700 mr-4 mb-2"><input type="radio" name="' + name + '" value="' + choice.id + '" ' + checked + '> ' + esc(choice.label) + "</label>";
        }).join("");
        var note = existingResponse && existingResponse.note ? existingResponse.note : "";
        var buttonLabel = existingResponse ? "Update response" : "Submit response";
        var updatedLabel = existingResponse ? '<p class="text-xs text-slate-500 mt-2">Last updated: ' + esc(formatWhen(existingResponse.at)) + "</p>" : "";
        return (
          '<form class="mt-4 p-4 rounded-xl border border-slate-200 bg-slate-50" data-agent-response-form="' + announcement.id + '">' +
          '<p class="text-sm font-semibold text-slate-700 mb-2">Your response (' + esc(typeLabel(announcement.responseType)) + ")</p>" +
          '<div class="mb-2">' + options + "</div>" +
          '<textarea name="note" class="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" rows="2" maxlength="220" placeholder="Optional note for agency leader/admin">' + esc(note) + "</textarea>" +
          '<div class="mt-3 flex items-center justify-between"><button type="submit" class="bg-aia-red text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-red-700 transition-colors">' + buttonLabel + "</button>" + updatedLabel + "</div>" +
          "</form>"
        );
      }

      function summarizeResponses(announcement, responsesStore) {
        var entries = responsesStore[announcement.id] || {};
        var all = Object.keys(entries).map(function (agentId) {
          return { agentId: agentId, data: entries[agentId] };
        });
        if (all.length === 0) {
          return '<p class="text-sm text-slate-500 mt-3">No agent responses yet.</p>';
        }
        var choiceLabels = {};
        responseChoices(announcement.responseType).forEach(function (option) {
          choiceLabels[option.id] = option.label;
        });
        var counts = {};
        all.forEach(function (item) {
          var key = item.data.choice || "unknown";
          counts[key] = (counts[key] || 0) + 1;
        });
        var chips = Object.keys(counts).map(function (key) {
          var label = choiceLabels[key] || key;
          return '<span class="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 mr-2 mb-2">' + esc(label) + ": " + counts[key] + "</span>";
        }).join("");
        var rows = all.map(function (item) {
          var note = item.data.note ? esc(item.data.note) : "-";
          var status = choiceLabels[item.data.choice] || item.data.choice || "-";
          return "<tr><td class='py-2 pr-3 font-medium'>" + esc(item.agentId) + "</td><td class='py-2 pr-3'>" + esc(status) + "</td><td class='py-2 pr-3'>" + note + "</td><td class='py-2 text-slate-500'>" + esc(formatWhen(item.data.at)) + "</td></tr>";
        }).join("");
        return (
          '<div class="mt-4 p-4 rounded-xl border border-slate-200 bg-slate-50">' +
          '<p class="text-sm font-semibold text-slate-700 mb-2">Agent responses summary</p>' +
          "<div>" + chips + "</div>" +
          '<div class="mt-2 overflow-x-auto"><table class="min-w-full text-sm"><thead><tr class="text-left text-slate-500"><th class="py-1 pr-3">Agent</th><th class="py-1 pr-3">Response</th><th class="py-1 pr-3">Note</th><th class="py-1">Updated</th></tr></thead><tbody>' + rows + "</tbody></table></div>" +
          "</div>"
        );
      }

      async function renderAnnouncements() {
        var announcements = await loadAnnouncements();
        var responsesStore = await loadResponsesStore();
        var container = document.getElementById("announcement-list");
        if (!container) return;
        if (!announcements.length) {
          container.innerHTML = '<p class="text-sm text-slate-500">No announcements published yet.</p>';
          return;
        }
        container.innerHTML = announcements.map(function (announcement) {
          var existing = responsesStore[announcement.id] && responsesStore[announcement.id][user];
          var responseSection = role === "agent"
            ? renderAgentResponse(announcement, existing)
            : summarizeResponses(announcement, responsesStore);
          return (
            '<article class="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">' +
            '<div class="flex items-center justify-between gap-3">' +
            '<p class="text-xs uppercase tracking-wide font-semibold text-slate-500">' + esc(announcement.category || "Announcement") + "</p>" +
            '<span class="text-xs px-2 py-1 rounded-full bg-red-50 text-red-700 border border-red-100 font-semibold">' + esc(typeLabel(announcement.responseType || "acknowledge")) + "</span>" +
            "</div>" +
            '<h3 class="font-bold text-lg mt-1">' + esc(announcement.title) + "</h3>" +
            '<p class="text-sm text-slate-700 mt-2">' + esc(announcement.message) + "</p>" +
            '<p class="text-xs text-slate-500 mt-3">Posted by ' + esc(announcement.createdBy || "System") + " on " + esc(formatWhen(announcement.createdAt)) + "</p>" +
            responseSection +
            "</article>"
          );
        }).join("");
        bindAgentResponseForms();
      }

      function bindAgentResponseForms() {
        if (role !== "agent") return;
        var forms = document.querySelectorAll("[data-agent-response-form]");
        forms.forEach(function (form) {
          form.addEventListener("submit", async function (event) {
            event.preventDefault();
            var announcementId = form.getAttribute("data-agent-response-form");
            if (!announcementId) return;
            var selected = form.querySelector('input[type="radio"]:checked');
            if (!selected) return;
            var noteField = form.querySelector('textarea[name="note"]');
            var noteValue = noteField ? noteField.value.trim() : "";
            await saveAnnouncementResponse(announcementId, selected.value, noteValue);
            await renderAnnouncements();
          });
        });
      }

      renderCreatePanel();
      await renderAnnouncements();
    })();
