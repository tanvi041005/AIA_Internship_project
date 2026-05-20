(async function () {
      // GET /training/topics → { topic_id, title, youtube_id, questions: [{ question_id, question_text, options: [{ option_id, option_label, is_correct }] }] }
      var TOPICS = [];
      // GET /teams/:managerId → team roster; TEAM_MAP and DEFAULT_AGENT_POOL replaced by API
      var TEAM_MAP = {};
      var DEFAULT_AGENT_POOL = [];
      var role = sessionStorage.getItem("dashboardRole") || "agent";
      var user = (sessionStorage.getItem("dashboardUser") || "").toUpperCase();
      var activeTopicIndex = 0;
      var player = null;
      var ytReady = false;
      var progressStore = {};
      var adminSaveBusy = false;
      var adminStatusMessage = "";
      var adminStatusIsError = false;
      var adminPreviewMode = false;

      window.onYouTubeIframeAPIReady = function () { ytReady = true; render(); };

      function getUserProgress(userId) {
        if (!progressStore[userId]) progressStore[userId] = { topics: {} };
        return progressStore[userId];
      }
      function getTopicState(userId, topicId) {
        var userData = getUserProgress(userId);
        if (!userData.topics[topicId]) userData.topics[topicId] = { videoDone: false, quizPassed: false };
        return userData.topics[topicId];
      }
      function mapApiProgress(raw) {
        var topics = {};
        Object.keys(raw || {}).forEach(function(topicId) {
          var item = raw[topicId] || {};
          topics[String(topicId)] = {
            videoDone: !!(item.video_done || item.videoDone),
            quizPassed: !!(item.quiz_passed || item.quizPassed)
          };
        });
        return { topics: topics };
      }
      function progressPayload(userId) {
        var userData = getUserProgress(userId);
        var out = {};
        Object.keys(userData.topics || {}).forEach(function(topicId) {
          var state = userData.topics[topicId] || {};
          out[topicId] = {
            video_done: !!state.videoDone,
            quiz_passed: !!state.quizPassed
          };
        });
        return out;
      }
      async function loadProgressForUser(userId) {
        if (!userId || typeof apiGet !== "function") return;
        var raw = await apiGet("/training/progress?userId=" + encodeURIComponent(userId));
        progressStore[userId] = mapApiProgress(raw || {});
      }
      async function saveProgressStore(userId) {
        if (!userId || typeof apiPost !== "function") return;
        await apiPost("/training/progress", {
          userId: userId,
          progress: progressPayload(userId)
        });
      }
      function isTopicUnlocked(index) {
        if (role === "admin") return true;
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
        var pathRoot = document.getElementById("learning-path");
        if (role === "admin" && !adminPreviewMode) {
          var adminList = TOPICS.map(function (topic, index) {
            return '<button type="button" draggable="true" class="training-admin-section' + (index === activeTopicIndex ? " active" : "") + '" data-admin-action="select-topic" data-topic-index="' + index + '">' +
              '<span><b aria-hidden="true">::</b> Section ' + String(index + 1).padStart(2, "0") + '</span>' +
              '<strong>' + esc(topic.title || "Untitled section") + '</strong>' +
              '<small>' + ((topic.quiz || []).length) + ' quiz question' + ((topic.quiz || []).length === 1 ? "" : "s") + '</small>' +
              '</button>';
          }).join("");
          pathRoot.innerHTML =
            '<div class="training-admin-section-list">' +
            (adminList || '<p class="training-admin-empty">No sections yet.</p>') +
            '<button type="button" class="training-admin-add-section" data-admin-action="add-topic">Add section</button>' +
            '</div>';
          return;
        }
        if (!TOPICS.length) {
          pathRoot.innerHTML = '<div class="p-4 text-sm text-slate-500">No training modules yet.</div>';
          return;
        }
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
        pathRoot.innerHTML = html;
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
        if (role === "admin" && !adminPreviewMode) {
          document.getElementById("topic-view").innerHTML = "";
          return;
        }
        var topic = TOPICS[activeTopicIndex];
        if (!topic) {
          document.getElementById("topic-view").innerHTML =
            '<section class="bg-white rounded-2xl shadow-sm border border-slate-200 p-6"><h2 class="text-xl font-bold">Video Lesson</h2><p class="text-sm text-slate-500 mt-1">No training module selected.</p></section>';
          return;
        }
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
                  saveProgressStore(user).catch(function(error) {
                    console.warn("Failed to save training video progress:", error);
                  });
                  render();
                }
              }
            }
          }
        });
      }

      function renderQuiz() {
        if (role === "admin" && !adminPreviewMode) {
          document.getElementById("quiz-view").innerHTML = "";
          return;
        }
        var topic = TOPICS[activeTopicIndex];
        if (!topic) {
          document.getElementById("quiz-view").innerHTML = "";
          return;
        }
        var state = getTopicState(user, topic.id);
        if (!state.videoDone && !(role === "admin" && adminPreviewMode)) {
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
        form.addEventListener("submit", async function (event) {
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
            if (role === "admin" && adminPreviewMode) {
              result.className = "text-sm text-green-700 font-medium";
              result.textContent = "Preview passed with 100%.";
              return;
            }
            state.quizPassed = true;
            try {
              await saveProgressStore(user);
            } catch (error) {
              result.className = "text-sm text-red-700 font-medium";
              result.textContent = "Passed, but database save failed. Please try submitting again.";
              return;
            }
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

      function getManagedAgents() {
        if (role !== "leader" && role !== "admin") return [];
        var configured = TEAM_MAP[user] || [];
        var pool = configured.concat(DEFAULT_AGENT_POOL);
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
        if (role === "admin") {
          root.innerHTML = "";
          return;
        }
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

      function trainingAdminRoot() {
        var root = document.getElementById("training-admin-view");
        if (root) return root;
        root = document.createElement("section");
        root.id = "training-admin-view";
        root.className = "space-y-4";
        var progress = document.getElementById("progress-view");
        if (progress) progress.insertAdjacentElement("beforebegin", root);
        return root;
      }

      function makeId(prefix, maxLength) {
        return (prefix + Date.now().toString(36) + Math.random().toString(36).slice(2, 5)).slice(0, maxLength);
      }

      function extractYoutubeId(value) {
        var input = String(value || "").trim();
        var match = input.match(/[?&]v=([^&]+)/) || input.match(/youtu\.be\/([^?&]+)/) || input.match(/embed\/([^?&]+)/);
        return match ? match[1] : input;
      }

      function defaultQuestion() {
        return {
          id: makeId("Q", 20),
          question: "",
          options: [
            { id: makeId("O", 20), label: "", correct: true },
            { id: makeId("O", 20), label: "", correct: false },
            { id: makeId("O", 20), label: "", correct: false },
            { id: makeId("O", 20), label: "", correct: false }
          ]
        };
      }

      function normalizeTopicForSave(topic, index) {
        return {
          id: topic.id || makeId("T", 10),
          title: String(topic.title || ("Module " + (index + 1))).trim(),
          youtubeId: extractYoutubeId(topic.youtubeId),
          quiz: (topic.quiz || []).map(function (question, questionIndex) {
            return {
              id: question.id || makeId("Q", 20),
              question: String(question.question || ("Question " + (questionIndex + 1))).trim(),
              options: (question.options || []).filter(function (option) {
                return String(option.label || "").trim();
              }).map(function (option) {
                return {
                  id: option.id || makeId("O", 20),
                  label: String(option.label || "").trim(),
                  correct: !!option.correct
                };
              })
            };
          })
        };
      }

      function renderTrainingAdmin() {
        if (role !== "admin") return;
        var root = trainingAdminRoot();
        if (adminPreviewMode) {
          root.innerHTML =
            '<section class="training-admin-preview-bar">' +
            '<div><strong>Agent view preview</strong><span>Review how agents will see the selected training section.</span></div>' +
            '<button type="button" class="training-admin-btn secondary" data-admin-action="toggle-preview">Back to edit</button>' +
            '</section>';
          return;
        }
        var topicIndex = activeTopicIndex;
        var topic = TOPICS[topicIndex];
        if (!topic) {
          root.innerHTML =
            '<section class="training-admin-panel">' +
            '<div class="training-admin-head"><div><h2>Training Admin</h2><p>Create the first training section to begin.</p></div>' +
            '<div class="training-admin-actions"><button type="button" class="training-admin-btn" data-admin-action="add-topic">Add section</button></div></div>' +
            '<div class="training-admin-body"><p class="training-admin-empty">No section selected.</p></div>' +
            '</section>';
          return;
        }
        var questions = (topic.quiz || []).map(function (question, questionIndex) {
          var options = (question.options || []).map(function (option, optionIndex) {
            return '<div class="training-admin-option">' +
              '<input class="training-admin-input" data-admin-field="option-label" data-topic-index="' + topicIndex + '" data-question-index="' + questionIndex + '" data-option-index="' + optionIndex + '" value="' + esc(option.label) + '" placeholder="Answer option" />' +
              '<label class="training-admin-correct"><input type="radio" name="correct-' + topicIndex + '-' + questionIndex + '" data-admin-field="option-correct" data-topic-index="' + topicIndex + '" data-question-index="' + questionIndex + '" data-option-index="' + optionIndex + '"' + (option.correct ? " checked" : "") + ' /> Correct</label>' +
              '</div>';
          }).join("");
          return '<div class="training-admin-question">' +
            '<div class="training-admin-question-head"><span>Question ' + (questionIndex + 1) + '</span></div>' +
            '<input class="training-admin-input training-admin-question-input" data-admin-field="question" data-topic-index="' + topicIndex + '" data-question-index="' + questionIndex + '" value="' + esc(question.question) + '" placeholder="Quiz question" />' +
            '<div class="training-admin-options">' + options + '</div>' +
            '<button type="button" class="training-admin-small" data-admin-action="add-option" data-topic-index="' + topicIndex + '" data-question-index="' + questionIndex + '">Add option</button>' +
            '</div>';
        }).join("");
        root.innerHTML =
          '<section class="training-admin-panel">' +
          '<div class="training-admin-head"><div><h2>Edit Section ' + String(topicIndex + 1).padStart(2, "0") + '</h2><p>Update the title, video link, and quiz questions for this section.</p></div>' +
          '<div class="training-admin-actions"><button type="button" class="training-admin-btn" data-admin-action="save"' + (adminSaveBusy ? " disabled" : "") + '>' + (adminSaveBusy ? "Saving..." : "Save training") + '</button><button type="button" class="training-admin-btn secondary" data-admin-action="toggle-preview">Agent view</button><button type="button" class="training-admin-btn delete" data-admin-action="delete-topic" data-topic-index="' + topicIndex + '">Delete section</button></div></div>' +
          '<div class="training-admin-body">' +
          '<article class="training-admin-card">' +
          '<div class="training-admin-grid">' +
          '<label class="training-admin-label">Section title<input class="training-admin-input" data-admin-field="topic-title" data-topic-index="' + topicIndex + '" value="' + esc(topic.title) + '" placeholder="Module title" /></label>' +
          '<label class="training-admin-label">Video link<input class="training-admin-input" data-admin-field="topic-video" data-topic-index="' + topicIndex + '" value="' + esc(topic.youtubeId) + '" placeholder="YouTube ID or URL" /></label>' +
          '</div>' +
          '<div class="training-admin-questions">' + (questions || '<p class="training-admin-empty">No quiz questions yet.</p>') + '</div>' +
          '<button type="button" class="training-admin-small" data-admin-action="add-question" data-topic-index="' + topicIndex + '">Add quiz question</button>' +
          '</article>' +
          '<p id="training-admin-status" class="training-admin-status' + (adminStatusIsError ? " error" : "") + '">' + esc(adminStatusMessage) + '</p></div>' +
          '</section>';
      }

      function wireTrainingAdmin() {
        if (role !== "admin" || document.body.dataset.trainingAdminWired === "true") return;
        document.body.dataset.trainingAdminWired = "true";
        var draggedTopicIndex = null;
        document.addEventListener("input", function (event) {
          var field = event.target && event.target.dataset ? event.target.dataset.adminField : "";
          if (!field) return;
          var topic = TOPICS[Number(event.target.dataset.topicIndex)];
          if (!topic) return;
          if (field === "topic-title") topic.title = event.target.value;
          if (field === "topic-video") topic.youtubeId = extractYoutubeId(event.target.value);
          if (field === "question") {
            var question = (topic.quiz || [])[Number(event.target.dataset.questionIndex)];
            if (question) question.question = event.target.value;
          }
          if (field === "option-label") {
            var q = (topic.quiz || [])[Number(event.target.dataset.questionIndex)];
            var option = q && (q.options || [])[Number(event.target.dataset.optionIndex)];
            if (option) option.label = event.target.value;
          }
        });
        document.addEventListener("change", function (event) {
          if (!event.target || event.target.dataset.adminField !== "option-correct") return;
          var topic = TOPICS[Number(event.target.dataset.topicIndex)];
          var question = topic && (topic.quiz || [])[Number(event.target.dataset.questionIndex)];
          if (!question) return;
          question.options.forEach(function (option, index) {
            option.correct = index === Number(event.target.dataset.optionIndex);
          });
          renderTrainingAdmin();
        });
        document.addEventListener("dragstart", function (event) {
          var section = event.target && event.target.closest ? event.target.closest(".training-admin-section") : null;
          if (!section) return;
          draggedTopicIndex = Number(section.dataset.topicIndex);
          section.classList.add("dragging");
          if (event.dataTransfer) {
            event.dataTransfer.effectAllowed = "move";
            event.dataTransfer.setData("text/plain", String(draggedTopicIndex));
          }
        });
        document.addEventListener("dragend", function (event) {
          var section = event.target && event.target.closest ? event.target.closest(".training-admin-section") : null;
          if (section) section.classList.remove("dragging");
          draggedTopicIndex = null;
          document.querySelectorAll(".training-admin-section.drag-over").forEach(function (item) {
            item.classList.remove("drag-over");
          });
        });
        document.addEventListener("dragover", function (event) {
          var section = event.target && event.target.closest ? event.target.closest(".training-admin-section") : null;
          if (!section || draggedTopicIndex == null) return;
          event.preventDefault();
          section.classList.add("drag-over");
          if (event.dataTransfer) event.dataTransfer.dropEffect = "move";
        });
        document.addEventListener("dragleave", function (event) {
          var section = event.target && event.target.closest ? event.target.closest(".training-admin-section") : null;
          if (section) section.classList.remove("drag-over");
        });
        document.addEventListener("drop", function (event) {
          var section = event.target && event.target.closest ? event.target.closest(".training-admin-section") : null;
          if (!section || draggedTopicIndex == null) return;
          event.preventDefault();
          var dropIndex = Number(section.dataset.topicIndex);
          document.querySelectorAll(".training-admin-section.drag-over").forEach(function (item) {
            item.classList.remove("drag-over");
          });
          if (dropIndex === draggedTopicIndex || dropIndex < 0 || dropIndex >= TOPICS.length) return;
          var moved = TOPICS.splice(draggedTopicIndex, 1)[0];
          TOPICS.splice(dropIndex, 0, moved);
          activeTopicIndex = dropIndex;
          adminStatusMessage = "Section order updated. Remember to save.";
          adminStatusIsError = false;
          draggedTopicIndex = null;
          render();
        });
        document.addEventListener("click", async function (event) {
          var actionEl = event.target && event.target.closest ? event.target.closest("[data-admin-action]") : null;
          var action = actionEl && actionEl.dataset ? actionEl.dataset.adminAction : "";
          if (!action) return;
          if (action === "toggle-preview") {
            adminPreviewMode = !adminPreviewMode;
            render();
          }
          if (action === "add-topic") {
            adminStatusMessage = "";
            adminPreviewMode = false;
            TOPICS.push({ id: makeId("T", 10), title: "New Training Section", youtubeId: "", quiz: [defaultQuestion()] });
            activeTopicIndex = TOPICS.length - 1;
            render();
          }
          if (action === "select-topic") {
            activeTopicIndex = Number(actionEl.dataset.topicIndex);
            render();
          }
          if (action === "delete-topic") {
            var deleteIndex = Number(actionEl.dataset.topicIndex);
            var deleteTopic = TOPICS[deleteIndex];
            if (!deleteTopic) return;
            var confirmed = window.confirm('Delete "' + (deleteTopic.title || "this section") + '"? This also removes quiz questions and agent progress for this section.');
            if (!confirmed) return;
            try {
              adminSaveBusy = true;
              adminStatusMessage = "";
              adminStatusIsError = false;
              renderTrainingAdmin();
              await apiDelete("/training/topics/" + encodeURIComponent(deleteTopic.id));
              TOPICS.splice(deleteIndex, 1);
              activeTopicIndex = Math.max(0, Math.min(deleteIndex, TOPICS.length - 1));
              adminStatusMessage = "Section deleted.";
              adminStatusIsError = false;
              render();
            } catch (error) {
              if (error && String(error.message || "").indexOf("404") !== -1) {
                TOPICS.splice(deleteIndex, 1);
                activeTopicIndex = Math.max(0, Math.min(deleteIndex, TOPICS.length - 1));
                adminStatusMessage = "Unsaved section removed.";
                adminStatusIsError = false;
                render();
              } else {
                adminStatusMessage = "Could not delete section. Please check the API and try again.";
                adminStatusIsError = true;
                renderTrainingAdmin();
              }
            } finally {
              adminSaveBusy = false;
              renderTrainingAdmin();
            }
          }
          if (action === "add-question") {
            var topic = TOPICS[Number(actionEl.dataset.topicIndex)];
            if (topic) {
              adminStatusMessage = "";
              if (!Array.isArray(topic.quiz)) topic.quiz = [];
              topic.quiz.push(defaultQuestion());
              renderTrainingAdmin();
            }
          }
          if (action === "add-option") {
            var t = TOPICS[Number(actionEl.dataset.topicIndex)];
            var q = t && (t.quiz || [])[Number(actionEl.dataset.questionIndex)];
            if (q) {
              adminStatusMessage = "";
              q.options.push({ id: makeId("O", 20), label: "", correct: false });
              renderTrainingAdmin();
            }
          }
          if (action === "save") {
            try {
              adminSaveBusy = true;
              adminStatusMessage = "";
              adminStatusIsError = false;
              renderTrainingAdmin();
              TOPICS = TOPICS.map(normalizeTopicForSave);
              await apiPut("/training/topics", { topics: TOPICS });
              adminStatusMessage = "Training saved.";
              adminStatusIsError = false;
              render();
            } catch (error) {
              adminStatusMessage = "Could not save training. Please check the API and try again.";
              adminStatusIsError = true;
            } finally {
              adminSaveBusy = false;
              renderTrainingAdmin();
            }
          }
        });
      }

      function esc(value) {
        var node = document.createElement("div");
        node.textContent = String(value || "");
        return node.innerHTML;
      }

      function render() {
        if (activeTopicIndex >= TOPICS.length) activeTopicIndex = Math.max(0, TOPICS.length - 1);
        renderLearningPath();
        renderTopicView();
        renderQuiz();
        renderTrainingAdmin();
        renderProgress();
      }

      if (typeof apiGet === "function") {
        try {
          var raw = await apiGet("/training/topics");
          if (Array.isArray(raw)) {
            TOPICS = raw.map(function(t) {
              return {
                id: String(t.topic_id),
                title: t.title || "",
                youtubeId: t.youtube_id || "",
                quiz: (t.questions || []).map(function(q) {
                  return {
                    id: String(q.question_id),
                    question: q.question_text || "",
                    options: (q.options || []).map(function(o) {
                      return {
                        id: String(o.option_id),
                        label: o.option_label || o.label || o.option_text || "",
                        correct: !!o.is_correct
                      };
                    })
                  };
                })
              };
            });
          }
        } catch (e) { console.warn("Failed to load training topics:", e); }
        try {
          await loadProgressForUser(user);
        } catch (e) { console.warn("Failed to load your training progress:", e); }
        try {
          if (role === "leader") {
            var team = await apiGet("/teams/" + encodeURIComponent(user));
            if (Array.isArray(team)) {
              DEFAULT_AGENT_POOL = team.map(function(m) { return String(m.agent_id || "").toUpperCase(); }).filter(Boolean);
            }
          } else if (role === "admin") {
            var agents = await apiGet("/users?role=agent");
            if (Array.isArray(agents)) {
              DEFAULT_AGENT_POOL = agents.map(function(a) { return String(a.user_id || "").toUpperCase(); }).filter(Boolean);
            }
          }
        } catch (e) { console.warn("Failed to load team roster:", e); }
        try {
          var managed = getManagedAgents();
          await Promise.all(managed.map(function(agentId) {
            return loadProgressForUser(agentId).catch(function(error) {
              console.warn("Failed to load training progress for " + agentId + ":", error);
            });
          }));
        } catch (e) { console.warn("Failed to load managed training progress:", e); }
      }
      wireTrainingAdmin();
      render();
    })();
