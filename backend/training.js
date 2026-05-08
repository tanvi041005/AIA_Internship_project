(function () {
      var TOPICS = [
        {
          id: "t1",
          title: "AIA Agent Foundations: Protection Planning",
          youtubeId: "x3MBoq2b33k",
          quiz: [
            { id: "q1", question: "During client fact-finding, what should an AIA agent confirm first?", options: [
              { id: "a", label: "Client protection needs and priorities", correct: true },
              { id: "b", label: "Client social media profile only" },
              { id: "c", label: "Only premium discount preference" }
            ]},
            { id: "q2", question: "Which action best matches responsible AIA advisory practice?", options: [
              { id: "a", label: "Recommend plans that fit goals, affordability, and risk profile", correct: true },
              { id: "b", label: "Push the highest premium product regardless of need" },
              { id: "c", label: "Skip needs analysis if client is in a hurry" }
            ]},
            { id: "q3", question: "Before proposal confirmation, what should the agent do?", options: [
              { id: "a", label: "Clearly explain coverage, exclusions, and payment commitment", correct: true },
              { id: "b", label: "Ask the client to sign without discussion" },
              { id: "c", label: "Focus only on commission details" }
            ]}
          ]
        },
        {
          id: "t2",
          title: "AIA Agent Practice: Objection Handling and Follow-up",
          youtubeId: "zRSSQycVdzo",
          quiz: [
            { id: "q1", question: "When a client says 'I need time to think', what is the best response?", options: [
              { id: "a", label: "Acknowledge concern, clarify questions, and agree on follow-up date", correct: true },
              { id: "b", label: "Close the case immediately and stop follow-up" },
              { id: "c", label: "Pressure for same-day payment only" }
            ]},
            { id: "q2", question: "Which follow-up habit supports stronger AIA conversion quality?", options: [
              { id: "a", label: "Document concerns and next actions after each meeting", correct: true },
              { id: "b", label: "Wait for clients to message first every time" },
              { id: "c", label: "Use one script for every client scenario" }
            ]},
            { id: "q3", question: "For leadership visibility, what should agent updates include?", options: [
              { id: "a", label: "Training completion status and key client follow-up outcomes", correct: true },
              { id: "b", label: "Only personal notes with no next steps" },
              { id: "c", label: "No records, only verbal updates" }
            ]}
          ]
        }
      ];

      var TEAM_MAP = { L123: ["A123", "A124", "A125"], D123: ["A123", "A124", "A125", "A126", "A127"] };
      var DEFAULT_AGENT_POOL = ["A123", "A124", "A125", "A126", "A127"];
      var role = sessionStorage.getItem("dashboardRole") || "agent";
      var user = (sessionStorage.getItem("dashboardUser") || "A123").toUpperCase();
      var activeTopicIndex = 0;
      var player = null;
      var ytReady = false;
      var progressKey = "fm_training_progress_v2";
      var progressStore = readProgressStore();

      window.onYouTubeIframeAPIReady = function () { ytReady = true; render(); };

      function readProgressStore() {
        try {
          var raw = localStorage.getItem(progressKey);
          if (!raw) return {};
          var parsed = JSON.parse(raw);
          return parsed && typeof parsed === "object" ? parsed : {};
        } catch (e) { return {}; }
      }
      function saveProgressStore() { localStorage.setItem(progressKey, JSON.stringify(progressStore)); }
      function getUserProgress(userId) {
        if (!progressStore[userId]) progressStore[userId] = { topics: {} };
        return progressStore[userId];
      }
      function getTopicState(userId, topicId) {
        var userData = getUserProgress(userId);
        if (!userData.topics[topicId]) userData.topics[topicId] = { videoDone: false, quizPassed: false };
        return userData.topics[topicId];
      }
      function isTopicUnlocked(index) {
        if (index === 0) return true;
        var prevState = getTopicState(user, TOPICS[index - 1].id);
        return !!(prevState.videoDone && prevState.quizPassed);
      }
      function isTopicComplete(index) {
        var state = getTopicState(user, TOPICS[index].id);
        return state.videoDone && state.quizPassed;
      }
      function getTopicPercent(index) {
        var state = getTopicState(user, TOPICS[index].id);
        if (state.videoDone && state.quizPassed) return 100;
        if (state.videoDone) return 50;
        return 0;
      }

      function renderLearningPath() {
        var html = "";
        TOPICS.forEach(function (topic, index) {
          var unlocked = isTopicUnlocked(index);
          var complete = isTopicComplete(index);
          var current = index === activeTopicIndex;
          var percent = getTopicPercent(index);
          var statusIcon = complete
            ? '<i class="fa-solid fa-circle-check text-green-500"></i>'
            : unlocked ? '<span class="px-2 py-0.5 bg-aia-red text-white text-[10px] font-bold rounded-full">' + (current ? "CURRENT" : "OPEN") + "</span>"
            : '<i class="fa-solid fa-lock text-slate-400"></i>';
          html +=
            '<div class="p-4 border-b border-slate-100 topic-row ' + (current ? "sidebar-item-active" : "") + " " + (unlocked ? "" : "bg-slate-50 opacity-60 locked") + '" data-topic-index="' + index + '">' +
            '<div class="flex items-start justify-between"><span class="text-xs font-bold uppercase tracking-wider ' + (current ? "text-aia-red" : "text-slate-400") + '">Module ' + String(index + 1).padStart(2, "0") + "</span>" + statusIcon + "</div>" +
            '<h3 class="font-semibold mt-1">' + esc(topic.title) + "</h3>" +
            '<div class="w-full bg-slate-200 h-1 rounded-full mt-3 overflow-hidden"><div class="bg-aia-red h-full" style="width:' + percent + '%"></div></div>' +
            '<p class="text-xs text-slate-500 mt-2">' + (complete ? "Completed" : unlocked ? ("In Progress (" + percent + "%)") : "Unlock after previous module") + "</p></div>";
        });
        document.getElementById("learning-path").innerHTML = html;
        document.querySelectorAll("[data-topic-index]").forEach(function (item) {
          item.addEventListener("click", function () {
            var index = Number(item.dataset.topicIndex);
            if (!isTopicUnlocked(index)) return;
            activeTopicIndex = index;
            render();
          });
        });
      }

      function renderTopicView() {
        var topic = TOPICS[activeTopicIndex];
        var state = getTopicState(user, topic.id);
        var url = "https://www.youtube.com/embed/" + topic.youtubeId + "?enablejsapi=1&rel=0&modestbranding=1";
        document.getElementById("topic-view").innerHTML =
          '<div class="flex items-center justify-between mb-4"><h2 class="text-2xl font-bold text-slate-800">Video Lesson</h2>' +
          '<span class="text-sm font-medium px-3 py-1 rounded-full flex items-center ' + (state.videoDone ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700") + '">' +
          '<span class="w-2 h-2 rounded-full mr-2 ' + (state.videoDone ? "bg-green-500" : "bg-amber-500") + '"></span>' + (state.videoDone ? "Video completed" : "Watch until end") + "</span></div>" +
          '<div class="bg-black rounded-2xl shadow-2xl overflow-hidden ring-8 ring-white/50"><div class="video-container"><iframe id="yt-player" src="' + url + '" title="' + esc(topic.title) + '" frameborder="0" allow="autoplay; encrypted-media; picture-in-picture" allowfullscreen></iframe></div></div>' +
          '<div class="mt-4 flex items-start p-4 bg-blue-50 border-l-4 border-blue-500 rounded-r-lg"><i class="fa-solid fa-circle-info text-blue-500 mt-1 mr-3"></i><div><p class="text-sm text-blue-800 font-medium">' +
          (state.videoDone ? "Video completed. The quiz is now available below." : "Complete the full video before taking the quiz.") +
          '</p><p class="text-xs text-blue-600 mt-1">You must score 100% to unlock the next module.</p></div></div>';
        initPlayer(topic.id);
      }

      function initPlayer(topicId) {
        if (!ytReady || !window.YT || !window.YT.Player) return;
        if (player && typeof player.destroy === "function") player.destroy();
        player = new YT.Player("yt-player", {
          events: {
            onStateChange: function (event) {
              if (event.data === YT.PlayerState.ENDED) {
                var state = getTopicState(user, topicId);
                if (!state.videoDone) {
                  state.videoDone = true;
                  saveProgressStore();
                  render();
                }
              }
            }
          }
        });
      }

      function renderQuiz() {
        var topic = TOPICS[activeTopicIndex];
        var state = getTopicState(user, topic.id);
        if (!state.videoDone) {
          document.getElementById("quiz-view").innerHTML =
            '<section class="bg-white rounded-2xl shadow-sm border border-slate-200 p-6"><h2 class="text-xl font-bold flex items-center"><i class="fa-solid fa-lock aia-red mr-3 text-lg"></i> Topic Quiz</h2><p class="text-sm text-slate-500 mt-1">Finish the video first to unlock this quiz.</p></section>';
          return;
        }
        var quizItems = topic.quiz || [];
        var body = quizItems.map(function (quizItem, idx) {
          var options = quizItem.options.map(function (opt, optIndex) {
            var inputId = "q-" + topic.id + "-" + quizItem.id + "-" + opt.id;
            return '<div class="relative"><input type="radio" name="quiz-' + quizItem.id + '" id="' + inputId + '" class="hidden quiz-option" value="' + opt.id + '">' +
              '<label for="' + inputId + '" class="flex items-center p-4 border border-slate-200 rounded-xl cursor-pointer hover:bg-slate-50 hover:border-slate-300 transition-all">' +
              '<span class="w-5 h-5 border-2 border-slate-300 rounded-full flex-shrink-0 mr-4"></span><span class="text-sm font-medium">' + esc(opt.label) + "</span></label></div>";
          }).join("");
          return '<div class="space-y-4"><div class="flex items-start"><span class="bg-aia-red text-white w-7 h-7 rounded-lg flex items-center justify-center font-bold text-sm flex-shrink-0 mt-0.5">' + (idx + 1) + '</span><h3 class="ml-4 text-lg font-semibold text-slate-800 leading-tight">' + esc(quizItem.question) + '</h3></div><div class="grid grid-cols-1 gap-3 ml-11">' + options + "</div></div>";
        }).join("");

        document.getElementById("quiz-view").innerHTML =
          '<section class="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden"><div class="p-6 border-b border-slate-100 bg-slate-50/50"><h2 class="text-xl font-bold flex items-center"><i class="fa-solid fa-pen-to-square aia-red mr-3 text-lg"></i> Topic Quiz</h2><p class="text-sm text-slate-500 mt-1">Answer all questions correctly to pass this topic.</p></div>' +
          '<form id="quiz-form"><div class="p-6 space-y-8">' + body + '</div><div class="p-6 bg-slate-50 border-t border-slate-100 flex items-center justify-between"><p id="quiz-result" class="text-sm text-slate-500 font-medium">Progress: 0 of ' + quizItems.length + ' answered</p><button class="bg-aia-red text-white px-8 py-3 rounded-xl font-bold shadow-lg hover:bg-red-700 transition-all" type="submit">Submit Quiz <i class="fa-solid fa-arrow-right ml-3"></i></button></div></form></section>';

        var form = document.getElementById("quiz-form");
        form.addEventListener("change", function () {
          var answered = quizItems.filter(function (q) { return !!document.querySelector('input[name="quiz-' + q.id + '"]:checked'); }).length;
          document.getElementById("quiz-result").textContent = "Progress: " + answered + " of " + quizItems.length + " answered";
        });
        form.addEventListener("submit", function (event) {
          event.preventDefault();
          var totalCorrect = 0;
          var allAnswered = true;
          quizItems.forEach(function (quizItem) {
            var selected = document.querySelector('input[name="quiz-' + quizItem.id + '"]:checked');
            if (!selected) { allAnswered = false; return; }
            var correct = quizItem.options.find(function (item) { return item.correct; });
            if (correct && selected.value === correct.id) totalCorrect += 1;
          });
          var result = document.getElementById("quiz-result");
          if (!allAnswered) {
            result.className = "text-sm text-amber-700 font-medium";
            result.textContent = "Please answer every question first.";
            return;
          }
          if (totalCorrect === quizItems.length) {
            state.quizPassed = true;
            saveProgressStore();
            result.className = "text-sm text-green-700 font-medium";
            result.textContent = "Passed with 100%. Next module unlocked.";
            renderLearningPath();
            renderProgress();
          } else {
            result.className = "text-sm text-red-700 font-medium";
            result.textContent = "Score: " + totalCorrect + "/" + quizItems.length + ". Review video and try again.";
          }
        });
      }

      function summarizeUserProgress(userId) {
        var completed = TOPICS.filter(function (topic) {
          var state = getTopicState(userId, topic.id);
          return state.videoDone && state.quizPassed;
        }).length;
        return completed + "/" + TOPICS.length + " modules completed";
      }

      function summarizeUserPercent(userId) {
        var total = TOPICS.length;
        if (!total) return 0;
        var points = TOPICS.reduce(function (sum, topic) {
          var state = getTopicState(userId, topic.id);
          if (state.videoDone && state.quizPassed) return sum + 100;
          if (state.videoDone) return sum + 50;
          return sum;
        }, 0);
        return Math.round(points / total);
      }

      function getRosterAgentIdsForManager(managerId) {
        try {
          var raw = localStorage.getItem("fm_team_members_v1");
          if (!raw) return [];
          var all = JSON.parse(raw);
          if (!all || typeof all !== "object") return [];
          var list = all[managerId] || [];
          if (!Array.isArray(list)) return [];
          return list
            .map(function (m) { return String(m.agentId || "").toUpperCase(); })
            .filter(function (id) { return /^A\d+$/i.test(id); });
        } catch (e) {
          return [];
        }
      }

      function getManagedAgents() {
        if (role !== "leader" && role !== "district") return [];
        var rosterIds = getRosterAgentIdsForManager(user);
        var configured = TEAM_MAP[user] || [];
        var tracked = Object.keys(progressStore || {}).filter(function (id) { return /^A\d+$/i.test(id); });
        var pool = rosterIds.concat(configured).concat(tracked).concat(DEFAULT_AGENT_POOL);
        var unique = pool.filter(function (id, index) { return pool.indexOf(id) === index; });
        return unique.sort();
      }

      function moduleBadge(userId, topic) {
        var state = getTopicState(userId, topic.id);
        if (state.videoDone && state.quizPassed) {
          return '<span class="inline-flex items-center px-2 py-1 rounded-full text-[11px] font-semibold bg-green-100 text-green-700">Done</span>';
        }
        if (state.videoDone) {
          return '<span class="inline-flex items-center px-2 py-1 rounded-full text-[11px] font-semibold bg-amber-100 text-amber-700">Quiz Pending</span>';
        }
        return '<span class="inline-flex items-center px-2 py-1 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-600">Not Started</span>';
      }

      function renderProgress() {
        var completed = TOPICS.filter(function (_, idx) { return isTopicComplete(idx); }).length;
        document.getElementById("achievement-note").textContent = "Complete " + Math.max(0, TOPICS.length - completed) + " more modules";
        var root = document.getElementById("progress-view");
        if (role === "agent") {
          root.innerHTML = '<section class="bg-white rounded-2xl shadow-sm border border-slate-200 p-6"><h2 class="text-xl font-bold">Your Progress</h2><p class="text-sm text-slate-600 mt-2">' + esc(user) + ": " + summarizeUserProgress(user) + "</p></section>";
          return;
        }
        var subgroup = getManagedAgents();
        var rows = subgroup.map(function (agentId) {
          var moduleCells = TOPICS.map(function (topic) {
            return '<td class="py-3 px-4">' + moduleBadge(agentId, topic) + "</td>";
          }).join("");
          return '<tr class="border-b border-slate-100"><td class="py-3 px-4 font-medium">' + esc(agentId) + '</td><td class="py-3 px-4 text-slate-600">' + summarizeUserProgress(agentId) + '</td><td class="py-3 px-4 text-slate-600 font-semibold">' + summarizeUserPercent(agentId) + "%</td>" + moduleCells + "</tr>";
        }).join("");
        var moduleHeaders = TOPICS.map(function (_, idx) {
          return '<th class="text-left py-3 px-4">M' + (idx + 1) + "</th>";
        }).join("");
        root.innerHTML =
          '<section class="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden"><div class="p-6 border-b border-slate-100"><h2 class="text-xl font-bold">Subgroup Training Progress</h2></div>' +
          (subgroup.length === 0 ? '<div class="p-6 text-sm text-slate-500">No agents found for this account yet.</div>' :
            '<div class="p-4 text-xs text-slate-500">M1/M2... shows per-module status: Done, Quiz Pending, or Not Started.</div><table class="w-full text-sm"><thead class="bg-slate-50"><tr><th class="text-left py-3 px-4">Agent</th><th class="text-left py-3 px-4">Progress</th><th class="text-left py-3 px-4">Overall</th>' + moduleHeaders + "</tr></thead><tbody>" + rows + "</tbody></table>") +
          "</section>";
      }

      function esc(value) {
        var node = document.createElement("div");
        node.textContent = String(value || "");
        return node.innerHTML;
      }

      function render() {
        renderLearningPath();
        renderTopicView();
        renderQuiz();
        renderProgress();
      }

      render();
    })();