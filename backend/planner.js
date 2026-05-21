// Planner/todo sidebar and personal task list.
// Depends on: calendar.js (getPersonalTasks, savePersonalTasks, addPersonalTask,
//   getUpcomingCalendarReminders, getCalendarEventsForView,
//   openCalendarEventDialog, openPersonalEventDialog,
//   notifyUpcomingEvents, requestNotificationPermission)

(function ensurePlannerFallbacks() {
  const TASKS_KEY = "personalTasks";

  if (typeof window.getPersonalTasks !== "function") {
    window.getPersonalTasks = function getPersonalTasksFallback() {
      try {
        const parsed = JSON.parse(localStorage.getItem(TASKS_KEY) || "[]");
        return Array.isArray(parsed) ? parsed : [];
      } catch (e) {
        return [];
      }
    };
  }

  if (typeof window.savePersonalTasks !== "function") {
    window.savePersonalTasks = function savePersonalTasksFallback(tasks) {
      localStorage.setItem(TASKS_KEY, JSON.stringify(Array.isArray(tasks) ? tasks : []));
      window.dispatchEvent(new CustomEvent("personalTasksUpdated"));
    };
  }

  if (typeof window.addPersonalTask !== "function") {
    window.addPersonalTask = function addPersonalTaskFallback(payload) {
      const title = String(payload && payload.title || "").trim();
      if (!title) return null;
      const task = {
        id: "task-local-" + Date.now() + "-" + Math.floor(Math.random() * 1000),
        title,
        done: false,
        source: "manual",
        dueDate: payload && payload.dueDate || "",
        eventTitle: payload && payload.eventTitle || "",
        priority: payload && payload.priority || "normal",
      };
      const tasks = window.getPersonalTasks();
      tasks.unshift(task);
      window.savePersonalTasks(tasks);
      return task;
    };
  }

  if (typeof window.getUpcomingCalendarReminders !== "function") {
    window.getUpcomingCalendarReminders = function getUpcomingCalendarRemindersFallback() {
      return [];
    };
  }

  if (typeof window.getCalendarEventsForView !== "function") {
    window.getCalendarEventsForView = function getCalendarEventsForViewFallback() {
      return [];
    };
  }

  if (typeof window.openCalendarEventDialog !== "function") {
    window.openCalendarEventDialog = function openCalendarEventDialogFallback() {};
  }

  if (typeof window.openPersonalEventDialog !== "function") {
    window.openPersonalEventDialog = function openPersonalEventDialogFallback() {};
  }
})();

function wirePersonalTodo() {
  const form = document.getElementById("personal-task-form");
  const input = document.getElementById("personal-task-input");
  const list = document.getElementById("personal-task-list");
  if (!form || !input || !list) return;

  const renderTasks = () => {
    const tasks = getPersonalTasks();
    list.innerHTML = tasks
      .map(
        (task) => `
        <li class="${task.done ? "is-done" : ""}">
          <label><input type="checkbox" data-task-id="${task.id}" ${task.done ? "checked" : ""}> <span>${task.title}</span>${task.dueDate || task.eventTitle ? `<small class="linked-info">${task.dueDate ? `Due ${task.dueDate}` : ""}${task.dueDate && task.eventTitle ? " · " : ""}${task.eventTitle ? task.eventTitle : ""}</small>` : ""}</label>
        </li>
      `
      )
      .join("");

    list.querySelectorAll("input[type='checkbox']").forEach((checkbox) => {
      checkbox.addEventListener("change", (event) => {
        const taskId = event.target.dataset.taskId;
        const tasksList = getPersonalTasks();
        const task = tasksList.find((t) => t.id === taskId);
        if (!task) return;
        task.done = event.target.checked;
        savePersonalTasks(tasksList);
        if (typeof apiPut === "function" && taskId && !taskId.startsWith("task-local")) {
          apiPut("/tasks/" + taskId, { is_done: task.done }).catch(() => {});
        }
      });
    });
  };

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const value = input.value.trim();
    if (!value) return;
    addPersonalTask({ title: value });
    input.value = "";
    renderTasks();
  });

  window.addEventListener("personalTasksUpdated", renderTasks);
  renderTasks();
}

function wireFloatingTodo() {
  if (document.getElementById("floating-task-form")) return;
  if (!document.body) return;

  const widget = document.createElement("aside");
  widget.id = "todo-sidebar";
  widget.className = "todo-sidebar is-collapsed";
  widget.setAttribute("aria-label", "Personal planner");
  widget.innerHTML = `
    <button type="button" class="todo-sidebar-toggle" id="todo-sidebar-toggle" aria-expanded="false" aria-controls="todo-sidebar-panel">
      <span class="todo-toggle-short">Planner</span>
      <span class="todo-sidebar-count" id="todo-sidebar-count">0</span>
    </button>
    <div class="todo-sidebar-panel" id="todo-sidebar-panel">
      <div class="todo-sidebar-head">
        <div>
          <h2>My Planner</h2>
          <p id="todo-sidebar-progress">0 open tasks</p>
        </div>
        <button type="button" class="ghost-btn" id="todo-sidebar-close">Close</button>
      </div>

      <div class="todo-controls" id="todo-controls">
        <label class="todo-controls-label" for="planner-day-select">Show events:</label>
        <select id="planner-day-select" class="planner-day-select">
          <option value="0">Today only</option>
          <option value="1">Next 1 day</option>
          <option value="2">Next 2 days</option>
          <option value="3">Next 3 days</option>
          <option value="4">Next 4 days</option>
          <option value="5">Next 5 days</option>
          <option value="6">Next 6 days</option>
          <option value="7">Next 7 days</option>
        </select>
        <label class="todo-notify-label">
          <input type="checkbox" id="todo-notify-toggle" /> Notify
        </label>
      </div>

      <div class="todo-section" id="todo-upcoming-section">
        <div class="todo-section-head">
          <h3 class="todo-section-title">Upcoming Events</h3>
        </div>
        <ul id="todo-reminder-list" class="todo-list"></ul>
      </div>

      <div class="todo-section" id="todo-tasks-section">
        <div class="todo-section-head">
          <h3 class="todo-section-title">To-Do</h3>
        </div>
        <form id="floating-task-form" class="floating-task-form">
          <div class="floating-task-form-row">
            <input id="floating-task-input" type="text" placeholder="Add a task" required />
            <button type="button" id="floating-task-priority-btn" class="task-priority-btn" data-priority="normal" title="Toggle priority">Normal</button>
          </div>
          <div class="floating-task-form-row">
            <input id="floating-task-due" type="date" class="floating-task-due" />
            <button type="submit">Add</button>
          </div>
        </form>
        <ul id="floating-task-list" class="todo-list" style="margin-top:0.5rem;"></ul>
        <div id="floating-completed-wrap"></div>
      </div>
    </div>
  `;
  document.body.appendChild(widget);

  const toggle        = document.getElementById("todo-sidebar-toggle");
  const close         = document.getElementById("todo-sidebar-close");
  const count         = document.getElementById("todo-sidebar-count");
  const progress      = document.getElementById("todo-sidebar-progress");
  const form          = document.getElementById("floating-task-form");
  const input         = document.getElementById("floating-task-input");
  const dueInput      = document.getElementById("floating-task-due");
  const priorityBtn   = document.getElementById("floating-task-priority-btn");
  const list          = document.getElementById("floating-task-list");
  const completedWrap = document.getElementById("floating-completed-wrap");
  const reminderList  = document.getElementById("todo-reminder-list");
  const daySelect     = document.getElementById("planner-day-select");
  const notifyToggle  = document.getElementById("todo-notify-toggle");

  priorityBtn.addEventListener("click", () => {
    const isHigh = priorityBtn.dataset.priority === "high";
    priorityBtn.dataset.priority = isHigh ? "normal" : "high";
    priorityBtn.textContent = isHigh ? "Normal" : "High";
    priorityBtn.classList.toggle("is-high", !isHigh);
  });

  const setExpanded = (expanded) => {
    widget.classList.toggle("is-collapsed", !expanded);
    toggle.setAttribute("aria-expanded", String(expanded));
    localStorage.setItem("todoSidebarExpanded", expanded ? "true" : "false");
    if (expanded) input.focus();
  };

  // Close when clicking outside the sidebar
  document.addEventListener("click", (e) => {
    if (!widget.classList.contains("is-collapsed") && !widget.contains(e.target)) {
      setExpanded(false);
    }
  });

  // ── Upcoming Events ──────────────────────────────────────────────────────────

  const TYPE_ACCENT = { Training: "#7c3aed", Meeting: "#0f766e", "Public Holiday": "#15803d" };
  const typeAccent = (ev) => TYPE_ACCENT[ev.type] || (ev.category === "personal" ? "#1d4ed8" : "#c2410c");

  const renderReminders = () => {
    if (!reminderList) return;
    const role = localStorage.getItem("calendarRole") || "agent";
    const windowDays = Number(localStorage.getItem("todoReminderWindow") || 0);
    const reminders = getUpcomingCalendarReminders(role, windowDays);
    const todayStr = new Date().toISOString().slice(0, 10);

    if (reminders.length === 0) {
      const label = windowDays === 0
        ? "No events today."
        : `No events in the next ${windowDays} day${windowDays === 1 ? "" : "s"}.`;
      reminderList.innerHTML = `<li class="reminder-empty">${label}</li>`;
      return;
    }

    reminderList.innerHTML = reminders
      .map((ev) => {
        const isToday = ev.date === todayStr;
        const accent  = typeAccent(ev);
        const dateLabel = isToday
          ? `<span class="today-evt-badge">Today</span>`
          : new Date(ev.date + "T00:00:00").toLocaleDateString("en-SG", { weekday: "short", day: "numeric", month: "short" });
        const timeLabel = ev.startTime
          ? ev.startTime + (ev.endTime ? `–${ev.endTime}` : "")
          : "";
        const typeLabel = ev.type || "Event";
        return `
          <li class="reminder-item">
            <button type="button" class="reminder-btn" data-ev-id="${ev.id || ""}" data-ev-date="${ev.date}" data-ev-title="${ev.title.replace(/"/g, "&quot;")}">
              <span class="reminder-accent" style="background:${accent};"></span>
              <div class="reminder-body">
                <div class="reminder-title">${ev.title}</div>
                <div class="reminder-meta">
                  <span>${dateLabel}</span>
                  ${timeLabel ? `<span class="reminder-dot-sep">·</span><span>${timeLabel}</span>` : ""}
                  <span class="reminder-dot-sep">·</span>
                  <span class="reminder-type-tag" style="color:${accent};">${typeLabel}</span>
                </div>
              </div>
            </button>
          </li>`;
      })
      .join("");

    reminderList.querySelectorAll(".reminder-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = btn.dataset.evId;
        const evDate = btn.dataset.evDate;
        const evTitle = btn.dataset.evTitle;
        const role = localStorage.getItem("calendarRole") || "agent";
        const all = getCalendarEventsForView(role, { showPersonal: true, showAgency: true });
        let ev = id ? all.find((e) => e.id === id) : null;
        if (!ev) ev = all.find((e) => e.date === evDate && e.title === evTitle);
        if (ev) openCalendarEventDialog(ev.date, [ev]);
        else openPersonalEventDialog(evDate);
      });
    });
  };

  // ── To-Do list ───────────────────────────────────────────────────────────────

  const getToday = () => new Date().toISOString().slice(0, 10);

  const sortOpenTasks = (tasks) => {
    const today = getToday();
    return [...tasks].sort((a, b) => {
      const pa = a.priority === "high" ? 0 : 1;
      const pb = b.priority === "high" ? 0 : 1;
      if (pa !== pb) return pa - pb;
      const aOver = a.dueDate && a.dueDate < today;
      const bOver = b.dueDate && b.dueDate < today;
      if (aOver !== bOver) return aOver ? -1 : 1;
      if (a.dueDate && b.dueDate) return a.dueDate.localeCompare(b.dueDate);
      if (a.dueDate) return -1;
      if (b.dueDate) return 1;
      return 0;
    });
  };

  const makeTaskLi = (task) => {
    const today = getToday();
    const isOverdue = task.dueDate && task.dueDate < today;
    const isDueToday = task.dueDate === today;
    const dotHtml = task.priority === "high"
      ? `<span class="task-high-dot" title="High priority"></span>`
      : "";
    const duePart = task.dueDate
      ? `<span class="task-due-label ${isOverdue ? "task-overdue" : isDueToday ? "task-due-today" : ""}">${isOverdue ? "⚠ Overdue · " : isDueToday ? "Due today · " : "Due "}${task.dueDate}</span>`
      : "";

    const li = document.createElement("li");
    li.className = "task-item";
    li.dataset.taskId = task.id;
    li.innerHTML = `
      <input type="checkbox" class="task-item-check" data-task-id="${task.id}" />
      <div class="task-item-body">
        <div class="task-item-row">
          ${dotHtml}
          <span class="task-item-title">${task.title}</span>
          <div class="task-actions">
            <button type="button" class="task-icon-btn task-edit-btn" data-task-id="${task.id}" title="Edit">✎</button>
            <button type="button" class="task-icon-btn task-delete-btn" data-task-id="${task.id}" title="Delete">×</button>
          </div>
        </div>
        ${duePart}
      </div>
    `;
    return li;
  };

  const renderTasks = () => {
    const allTasks  = getPersonalTasks();
    const openTasks = sortOpenTasks(allTasks.filter((t) => !t.done));
    const doneTasks = allTasks.filter((t) => t.done);
    const today     = getToday();
    const dueTodayCount = openTasks.filter((t) => t.dueDate === today).length;

    count.textContent = String(openTasks.length);
    progress.textContent = openTasks.length === 0
      ? "All caught up!"
      : `${openTasks.length} open${dueTodayCount > 0 ? ` · ${dueTodayCount} due today` : ""}`;

    list.innerHTML = "";
    openTasks.forEach((task) => list.appendChild(makeTaskLi(task)));

    // Completed section
    if (doneTasks.length > 0) {
      const details = document.createElement("details");
      details.innerHTML = `
        <summary class="completed-toggle">Completed (${doneTasks.length})</summary>
        <ul class="completed-list"></ul>
        <button type="button" class="clear-completed-btn">Clear all completed</button>
      `;
      completedWrap.innerHTML = "";
      completedWrap.appendChild(details);

      const doneList = details.querySelector(".completed-list");
      doneTasks.forEach((task) => {
        const li = document.createElement("li");
        li.innerHTML = `
          <input type="checkbox" checked data-task-id="${task.id}" />
          <span>${task.title}</span>
        `;
        doneList.appendChild(li);
      });

      doneList.querySelectorAll("input[type='checkbox']").forEach((cb) => {
        cb.addEventListener("change", () => {
          const taskId = cb.dataset.taskId;
          const tasks = getPersonalTasks().map((t) =>
            t.id === taskId ? { ...t, done: false } : t
          );
          savePersonalTasks(tasks);
          if (typeof apiPut === "function" && taskId && !taskId.startsWith("task-local")) {
            apiPut("/tasks/" + taskId, { is_done: false }).catch(() => {});
          }
        });
      });

      details.querySelector(".clear-completed-btn").addEventListener("click", () => {
        const toDelete = getPersonalTasks().filter((t) => t.done);
        savePersonalTasks(getPersonalTasks().filter((t) => !t.done));
        toDelete.forEach((t) => {
          if (typeof apiDelete === "function" && t.id && !String(t.id).startsWith("task-local")) {
            apiDelete("/tasks/" + t.id).catch(() => {});
          }
        });
      });
    } else {
      completedWrap.innerHTML = "";
    }

    // Checkboxes — mark done with fade-out animation
    list.querySelectorAll(".task-item-check").forEach((checkbox) => {
      checkbox.addEventListener("change", () => {
        const taskId = checkbox.dataset.taskId;
        const li = checkbox.closest("li");
        if (li) li.classList.add("is-removing");
        setTimeout(() => {
          const tasks = getPersonalTasks().map((t) =>
            t.id === taskId ? { ...t, done: true } : t
          );
          savePersonalTasks(tasks);
          if (typeof apiPut === "function" && taskId && !taskId.startsWith("task-local")) {
            apiPut("/tasks/" + taskId, { is_done: true }).catch(() => {});
          }
        }, 480);
      });
    });

    // Delete buttons
    list.querySelectorAll(".task-delete-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        const taskId = btn.dataset.taskId;
        savePersonalTasks(getPersonalTasks().filter((t) => t.id !== taskId));
        if (typeof apiDelete === "function" && taskId && !taskId.startsWith("task-local")) {
          apiDelete("/tasks/" + taskId).catch(() => {});
        }
      });
    });

    // Edit buttons — inline edit
    list.querySelectorAll(".task-edit-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        const taskId = btn.dataset.taskId;
        const li = btn.closest("li");
        const titleSpan = li.querySelector(".task-item-title");
        if (!titleSpan || li.querySelector(".task-edit-input")) return;

        const currentTitle = titleSpan.textContent;
        const editInput = document.createElement("input");
        editInput.type = "text";
        editInput.value = currentTitle;
        editInput.className = "task-edit-input";
        editInput.style.cssText = "flex:1;font:inherit;font-size:0.85rem;border:1px solid var(--brand,#a6192e);border-radius:4px;padding:0.1rem 0.3rem;min-width:0;";
        titleSpan.replaceWith(editInput);
        editInput.focus();
        editInput.select();

        const save = () => {
          const newTitle = editInput.value.trim();
          if (newTitle && newTitle !== currentTitle) {
            const tasks = getPersonalTasks().map((t) =>
              t.id === taskId ? { ...t, title: newTitle } : t
            );
            savePersonalTasks(tasks);
            if (typeof apiPut === "function" && taskId && !taskId.startsWith("task-local")) {
              apiPut("/tasks/" + taskId, { title: newTitle }).catch(() => {});
            }
          } else {
            renderTasks();
          }
        };
        editInput.addEventListener("blur", save);
        editInput.addEventListener("keydown", (e) => {
          if (e.key === "Enter") { e.preventDefault(); editInput.blur(); }
          if (e.key === "Escape") renderTasks();
        });
      });
    });
  };

  // Wire day dropdown
  if (daySelect) {
    daySelect.value = localStorage.getItem("todoReminderWindow") || "0";
    daySelect.addEventListener("change", () => {
      localStorage.setItem("todoReminderWindow", daySelect.value);
      renderReminders();
    });
  }

  toggle.addEventListener("click", (e) => {
    e.stopPropagation();
    setExpanded(widget.classList.contains("is-collapsed"));
  });
  close.addEventListener("click", () => setExpanded(false));

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const value = input.value.trim();
    if (!value) return;
    addPersonalTask({
      title: value,
      priority: priorityBtn.dataset.priority,
      dueDate: dueInput.value || ""
    });
    input.value = "";
    dueInput.value = "";
    priorityBtn.dataset.priority = "normal";
    priorityBtn.textContent = "Normal";
    priorityBtn.classList.remove("is-high");
    renderTasks();
  });

  window.addEventListener("personalTasksUpdated", renderTasks);
  window.addEventListener("calendarEventAdded", renderReminders);

  setExpanded(localStorage.getItem("todoSidebarExpanded") === "true");
  renderTasks();
  renderReminders();

  if (notifyToggle) {
    notifyToggle.checked = localStorage.getItem("todoNotifyEnabled") === "true";
    notifyToggle.addEventListener("change", () => {
      localStorage.setItem("todoNotifyEnabled", notifyToggle.checked ? "true" : "false");
      if (notifyToggle.checked) {
        requestNotificationPermission().then((perm) => {
          if (perm === "granted") scheduleEventNotifications();
        });
      }
    });
  }

  startNotificationScheduler();
}

// ── Smart notification scheduler ─────────────────────────────────────────────
// Fires browser notifications exactly once per trigger per event:
//   • The day BEFORE an event (once, any time the app is open that day)
//   • At 8 am ON the event day (once, after 8:00 am)
//   • 15 minutes BEFORE an event's start time (once, within that window)

function scheduleEventNotifications() {
  if (!("Notification" in window) || Notification.permission !== "granted") return;
  if (localStorage.getItem("todoNotifyEnabled") !== "true") return;

  const now = new Date();
  const todayStr = now.toISOString().slice(0, 10);
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = tomorrow.toISOString().slice(0, 10);
  const nowMinutes = now.getHours() * 60 + now.getMinutes();

  const storageKey = `_plannerNotified_${todayStr}`;
  Object.keys(localStorage).forEach((k) => {
    if (k.startsWith("_plannerNotified_") && k !== storageKey) localStorage.removeItem(k);
  });
  const fired = new Set(JSON.parse(localStorage.getItem(storageKey) || "[]"));

  const role = localStorage.getItem("calendarRole") || "agent";
  const events = getCalendarEventsForView(role, { showPersonal: true, showAgency: true });

  const fire = (title, body) => {
    try { new Notification(title, { body }); } catch (e) {}
  };

  events.forEach((ev) => {
    if (!ev || !ev.date || ev.category === "holiday") return;
    const evId = ev.id || `${ev.date}|${ev.title}`;

    if (ev.date === tomorrowStr) {
      const key = `dayBefore:${evId}`;
      if (!fired.has(key)) {
        fire(`Tomorrow · ${ev.title}`, `${tomorrowStr}${ev.startTime ? " · " + ev.startTime : " · All day"}`);
        fired.add(key);
      }
    }

    if (ev.date !== todayStr) return;

    const key8am = `8am:${evId}`;
    if (!fired.has(key8am) && nowMinutes >= 480) {
      fire(`Today · ${ev.title}`, `${ev.type || "Event"}${ev.startTime ? " · starts " + ev.startTime : ""}`);
      fired.add(key8am);
    }

    if (ev.startTime) {
      const [h, m] = ev.startTime.split(":").map(Number);
      const startMinutes = h * 60 + m;
      const key15 = `15min:${evId}`;
      if (!fired.has(key15) && nowMinutes >= startMinutes - 15 && nowMinutes < startMinutes) {
        fire(`Starting soon · ${ev.title}`, `In ${startMinutes - nowMinutes} min · ${ev.startTime}`);
        fired.add(key15);
      }
    }
  });

  localStorage.setItem(storageKey, JSON.stringify([...fired]));
}

function startNotificationScheduler() {
  scheduleEventNotifications();
  setInterval(scheduleEventNotifications, 60 * 1000);
}

// ── Page init ─────────────────────────────────────────────────────────────────
wireFloatingTodo();
wirePersonalTodo();
