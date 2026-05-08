(function authGate() {
  const PUBLIC_PAGES = new Set(["login.html", "recruitment-login.html"]);
  const currentPage = (window.location.pathname.split("/").pop() || "index.html").toLowerCase();
  const loggedRole = sessionStorage.getItem("dashboardRole");

  if (!PUBLIC_PAGES.has(currentPage) && !loggedRole) {
    const nextPath = `${currentPage}${window.location.search || ""}`;
    window.location.replace(`login.html?next=${encodeURIComponent(nextPath)}`);
    return;
  }

  if (currentPage === "recruitment.html" && loggedRole !== "district") {
    window.location.replace("index.html");
    return;
  }

  if (currentPage === "onboarding.html" && loggedRole === "agent") {
    window.location.replace("index.html");
    return;
  }

  if (currentPage === "login.html") {
    const form = document.getElementById("role-login-form");
    const usernameInput = document.getElementById("login-username");
    const passwordInput = document.getElementById("login-password");
    const roleError = document.getElementById("login-role-error");

    if (!form || !usernameInput || !passwordInput) return;

    const DEMO_USERS = {
      A123: { password: "A123", role: "agent" },
      L123: { password: "L123", role: "leader" },
      D123: { password: "D123", role: "district" }
    };

    function detectRole(userId) {
      const value = String(userId || "").trim().toUpperCase();
      if (/^A\d+$/i.test(value)) return { key: "agent", label: "Agent" };
      if (/^L\d+$/i.test(value)) return { key: "leader", label: "Leader" };
      if (/^D\d+$/i.test(value)) return { key: "district", label: "District" };
      return null;
    }

    usernameInput.addEventListener("input", () => {
      if (roleError) roleError.hidden = true;
    });

    form.addEventListener("submit", (event) => {
      event.preventDefault();
      const username = usernameInput.value.trim().toUpperCase();
      const password = passwordInput.value;
      const detected = detectRole(username);
      if (!detected) {
        if (roleError) {
          roleError.textContent = "User ID not recognized. Use A###, L###, or D### format.";
          roleError.hidden = false;
        }
        return;
      }

      const userRecord = DEMO_USERS[username];
      if (!userRecord || userRecord.password !== password) {
        if (roleError) {
          roleError.textContent = "Invalid User ID or password.";
          roleError.hidden = false;
        }
        return;
      }
      if (userRecord.role !== detected.key) {
        if (roleError) {
          roleError.textContent = "User role mismatch for this User ID.";
          roleError.hidden = false;
        }
        return;
      }

      sessionStorage.setItem("dashboardRole", detected.key);
      sessionStorage.setItem("dashboardUser", username || "User");
      sessionStorage.setItem("announcementPromptPending", "1");
      localStorage.setItem("calendarRole", detected.key === "district" ? "district_manager" : "agent");
      localStorage.setItem("overviewScope", "agency");
      const params = new URLSearchParams(window.location.search);
      const next = params.get("next") || "";
      const safeNext = /^[a-z0-9-]+\.html(\?.*)?$/i.test(next) ? next : "index.html";
      window.location.assign(safeNext);
    });
    return;
  }

  function enhanceNav() {
    const nav = document.querySelector(".nav-inner");
    if (!nav) return;
    const roleLabels = {
      agent: "Agent",
      leader: "Leader",
      district: "District Manager"
    };

    const overviewLink = Array.from(nav.querySelectorAll("a")).find(
      (link) => (link.getAttribute("href") || "").toLowerCase() === "index.html"
    );
    const calendarLink = Array.from(nav.querySelectorAll("a")).find(
      (link) => (link.getAttribute("href") || "").toLowerCase() === "calendar.html"
    );

    const hasCompareLink = Array.from(nav.querySelectorAll("a")).some(
      (link) => (link.getAttribute("href") || "").toLowerCase() === "agent-comparison.html"
    );
    if (!hasCompareLink) {
      const compareLink = document.createElement("a");
      compareLink.href = "agent-comparison.html";
      compareLink.textContent = "Compare";
      const leadsLink = Array.from(nav.querySelectorAll("a")).find(
        (link) => (link.getAttribute("href") || "").toLowerCase() === "leads.html"
      );
      if (leadsLink) {
        leadsLink.insertAdjacentElement("afterend", compareLink);
      } else {
        nav.appendChild(compareLink);
      }
    }

    const hasAnnouncementsLink = Array.from(nav.querySelectorAll("a")).some(
      (link) => (link.getAttribute("href") || "").toLowerCase() === "announcements.html"
    );
    if (!hasAnnouncementsLink) {
      const announcementsLink = document.createElement("a");
      announcementsLink.href = "announcements.html";
      announcementsLink.textContent = "Announcements";
      const resourcesLink = Array.from(nav.querySelectorAll("a")).find(
        (link) => (link.getAttribute("href") || "").toLowerCase() === "resources.html"
      );
      if (resourcesLink) {
        resourcesLink.insertAdjacentElement("beforebegin", announcementsLink);
      } else {
        nav.appendChild(announcementsLink);
      }
    }

    const hasRecruitmentLink = Array.from(nav.querySelectorAll("a")).some(
      (link) => (link.getAttribute("href") || "").toLowerCase() === "recruitment.html"
    );
    if (!hasRecruitmentLink && loggedRole === "district") {
      const recruitmentLink = document.createElement("a");
      recruitmentLink.href = "recruitment.html";
      recruitmentLink.textContent = "Recruitment";
      const resourcesLink2 = Array.from(nav.querySelectorAll("a")).find(
        (link) => (link.getAttribute("href") || "").toLowerCase() === "resources.html"
      );
      if (resourcesLink2) {
        resourcesLink2.insertAdjacentElement("afterend", recruitmentLink);
      } else {
        nav.appendChild(recruitmentLink);
      }
    }

    const hasTeamLink = Array.from(nav.querySelectorAll("a")).some(
      (link) => (link.getAttribute("href") || "").toLowerCase() === "onboarding.html"
    );
    if (!hasTeamLink && loggedRole && (loggedRole === "leader" || loggedRole === "district")) {
      const teamLink = document.createElement("a");
      teamLink.href = "onboarding.html";
      teamLink.textContent = "Onboarding";
      const announcementsLinkEl = Array.from(nav.querySelectorAll("a")).find(
        (link) => (link.getAttribute("href") || "").toLowerCase() === "announcements.html"
      );
      const resourcesLinkEl = Array.from(nav.querySelectorAll("a")).find(
        (link) => (link.getAttribute("href") || "").toLowerCase() === "resources.html"
      );
      if (announcementsLinkEl) {
        announcementsLinkEl.insertAdjacentElement("afterend", teamLink);
      } else if (resourcesLinkEl) {
        resourcesLinkEl.insertAdjacentElement("beforebegin", teamLink);
      } else {
        nav.appendChild(teamLink);
      }
    }

    const setOverviewLabel = (link, label) => {
      link.innerHTML = `<span>${label}</span><span class="overview-caret" aria-hidden="true">&#9662;</span>`;
    };

    if (overviewLink && !document.getElementById("overview-scope-menu")) {
      const scopeLabels = {
        district: "District Overview",
        agency: "Agency Overview",
        personal: "Personal Overview"
      };
      const initialOverviewScope = localStorage.getItem("overviewScope") || "agency";
      const overviewMenu = document.createElement("div");
      overviewMenu.className = "overview-nav-menu";
      overviewLink.insertAdjacentElement("beforebegin", overviewMenu);
      overviewMenu.appendChild(overviewLink);
      setOverviewLabel(overviewLink, scopeLabels[initialOverviewScope] || scopeLabels.agency);
      overviewMenu.insertAdjacentHTML(
        "beforeend",
        `
          <div class="overview-scope-menu" id="overview-scope-menu" role="menu" aria-label="Overview scope">
            <button type="button" role="menuitem" data-overview-menu-scope="district">District Overview</button>
            <button type="button" role="menuitem" data-overview-menu-scope="agency">Agency Overview</button>
            <button type="button" role="menuitem" data-overview-menu-scope="personal">Personal Overview</button>
          </div>
        `
      );

      const setScope = (scope) => {
        const normalizedScope = scopeLabels[scope] ? scope : "agency";
        localStorage.setItem("overviewScope", normalizedScope);
        setOverviewLabel(overviewLink, scopeLabels[normalizedScope]);
        overviewMenu.classList.remove("is-open");
        window.dispatchEvent(new CustomEvent("overviewScopeChanged", { detail: { scope: normalizedScope } }));
        if (currentPage !== "index.html") {
          window.location.assign("index.html");
        }
      };

      overviewLink.setAttribute("aria-haspopup", "true");
      overviewLink.setAttribute("aria-expanded", "false");
      overviewLink.addEventListener("click", (event) => {
        if (currentPage === "index.html") {
          event.preventDefault();
          const isOpen = overviewMenu.classList.toggle("is-open");
          overviewLink.setAttribute("aria-expanded", String(isOpen));
        }
      });

      overviewMenu.querySelectorAll("[data-overview-menu-scope]").forEach((button) => {
        button.addEventListener("click", () => setScope(button.dataset.overviewMenuScope));
      });

      document.addEventListener("click", (event) => {
        if (!overviewMenu.contains(event.target)) {
          overviewMenu.classList.remove("is-open");
          overviewLink.setAttribute("aria-expanded", "false");
        }
      });
    }

    if (calendarLink && !document.getElementById("calendar-section-menu")) {
      const existingCalendarMenu = calendarLink.closest(".calendar-nav-menu");
      const existingCalendarSection = existingCalendarMenu ? existingCalendarMenu.querySelector(".calendar-section-menu") : null;
      if (existingCalendarMenu && existingCalendarSection) {
        existingCalendarSection.id = "calendar-section-menu";
        calendarLink.innerHTML = `<span>Calendar</span><span class="overview-caret" aria-hidden="true">&#9662;</span>`;
        calendarLink.setAttribute("aria-haspopup", "true");
        calendarLink.setAttribute("aria-expanded", "false");
      } else {
        const calendarMenu = document.createElement("div");
        calendarMenu.className = "calendar-nav-menu";
        calendarLink.insertAdjacentElement("beforebegin", calendarMenu);
        calendarMenu.appendChild(calendarLink);
        calendarLink.innerHTML = `<span>Calendar</span><span class="overview-caret" aria-hidden="true">&#9662;</span>`;
        calendarLink.setAttribute("aria-haspopup", "true");
        calendarLink.setAttribute("aria-expanded", "false");
        calendarMenu.insertAdjacentHTML(
          "beforeend",
          `
            <div class="calendar-section-menu" id="calendar-section-menu" role="menu" aria-label="Calendar sections">
              <a href="calendar.html" role="menuitem">Calendar</a>
              <a href="room-booking.html" role="menuitem">Room Booking</a>
              <a href="attendance.html" role="menuitem">Attendance</a>
            </div>
          `
        );

        calendarLink.addEventListener("click", (event) => {
          if (currentPage === "calendar.html" || currentPage === "attendance.html" || currentPage === "room-booking.html") {
            event.preventDefault();
            const isOpen = calendarMenu.classList.toggle("is-open");
            calendarLink.setAttribute("aria-expanded", String(isOpen));
          }
        });

        document.addEventListener("click", (event) => {
          if (!calendarMenu.contains(event.target)) {
            calendarMenu.classList.remove("is-open");
            calendarLink.setAttribute("aria-expanded", "false");
          }
        });
      }
    }

    const toolsMenu = document.querySelector(".tools-nav-menu");
    const toolsTrigger = document.getElementById("tools-nav-trigger");
    if (toolsMenu && toolsTrigger) {
      toolsTrigger.addEventListener("click", (event) => {
        event.preventDefault();
        const isOpen = toolsMenu.classList.toggle("is-open");
        toolsTrigger.setAttribute("aria-expanded", String(isOpen));
      });
      document.addEventListener("click", (event) => {
        if (!toolsMenu.contains(event.target)) {
          toolsMenu.classList.remove("is-open");
          toolsTrigger.setAttribute("aria-expanded", "false");
        }
      });
    }

    // Dynamic active tab highlighting based on the current page
    const navLinks = nav.querySelectorAll("a:not(#logout-link)");
    navLinks.forEach(link => {
      const href = (link.getAttribute("href") || "").toLowerCase();
      // Check if current link matches page or if we're in a lead-related sub-page
      const isCurrentPage = href === currentPage || (currentPage === "index.html" && (href === "" || href === "index.html"));
      const isLeadsSubPage = href === "leads.html" && currentPage === "create-profile.html";
      const isComparisonPage = href === "agent-comparison.html" && currentPage === "agent-comparison.html";
      const isCalendarSection = href === "calendar.html" && (currentPage === "attendance.html" || currentPage === "room-booking.html");
      const isRecruitmentPage = href === "recruitment.html" && currentPage === "recruitment.html";
      const isHelpdeskPage = href === "helpdesk.html" && currentPage === "helpdesk.html";
      const isTeamPage = href === "onboarding.html" && currentPage === "onboarding.html";

      if (isCurrentPage || isLeadsSubPage || isCalendarSection || isComparisonPage || isRecruitmentPage || isHelpdeskPage || isTeamPage) {
        link.classList.add("active");
      } else {
        link.classList.remove("active");
      }
    });

    const toolsTriggerEl = document.getElementById("tools-nav-trigger");
    if (toolsTriggerEl) {
      const toolsPages = ["sales-tracker.html", "cpf-calculator.html", "helpdesk.html"];
      if (toolsPages.includes(currentPage)) {
        toolsTriggerEl.classList.add("active");
      } else {
        toolsTriggerEl.classList.remove("active");
      }
    }

    if (loggedRole && !document.getElementById("nav-user-meta")) {
      const userMeta = document.createElement("div");
      userMeta.id = "nav-user-meta";
      userMeta.className = "header-user-meta nav-user-meta";
      userMeta.innerHTML = `
        <span>${roleLabels[loggedRole] || "User"}</span>
        <strong>${sessionStorage.getItem("dashboardUser") || "User"}</strong>
      `;
      nav.appendChild(userMeta);
    }

    if (loggedRole && !document.getElementById("logout-link")) {
      const logout = document.createElement("a");
      logout.href = "login.html";
      logout.id = "logout-link";
      logout.textContent = "Logout";
      logout.addEventListener("click", () => {
        sessionStorage.removeItem("dashboardRole");
        sessionStorage.removeItem("dashboardUser");
      });
      nav.appendChild(logout);
    }

    showAnnouncementPrompt();
  }

  function showAnnouncementPrompt() {
    if (!loggedRole) return;
    if (currentPage === "announcements.html") {
      sessionStorage.removeItem("announcementPromptPending");
      return;
    }
    if (sessionStorage.getItem("announcementPromptPending") !== "1") return;
    if (document.getElementById("announcement-login-prompt")) return;
    const announcements = readAnnouncements();
    const latest = Array.isArray(announcements) && announcements.length ? announcements[0] : null;

    const panel = document.createElement("aside");
    panel.id = "announcement-login-prompt";
    panel.setAttribute("role", "dialog");
    panel.setAttribute("aria-live", "polite");
    panel.style.position = "fixed";
    panel.style.top = "86px";
    panel.style.right = "16px";
    panel.style.zIndex = "1200";
    panel.style.width = "min(360px, calc(100vw - 24px))";
    panel.style.background = "#ffffff";
    panel.style.border = "1px solid #dedbd4";
    panel.style.borderRadius = "12px";
    panel.style.boxShadow = "0 12px 26px rgba(32,33,36,.18)";
    panel.style.padding = "14px";
    panel.innerHTML = `
      <div style="display:flex;align-items:flex-start;gap:10px;">
        <i class="fa-solid fa-bullhorn" style="margin-top:2px;color:#d31145;"></i>
        <div style="flex:1;">
          <p style="margin:0 0 4px 0;font-weight:700;color:#202124;">${latest ? escapeHtml(latest.title || "New Announcement") : "New Announcement"}</p>
          ${latest ? `<p style="margin:0 0 6px 0;font-size:11px;font-weight:700;letter-spacing:.03em;text-transform:uppercase;color:#a6192e;">${escapeHtml(latest.category || "Announcement")}</p>` : ""}
          <p style="margin:0;color:#69655e;font-size:13px;line-height:1.4;">${latest ? escapeHtml(latest.message || "") : "Would you like to open the Announcements page now?"}</p>
          <div style="display:flex;justify-content:flex-end;gap:8px;margin-top:12px;">
            <button type="button" id="announcement-cancel-btn" style="border:1px solid #d0d7de;background:#fff;color:#202124;border-radius:8px;padding:6px 12px;font-weight:600;cursor:pointer;">Cancel</button>
            <button type="button" id="announcement-ok-btn" style="border:0;background:#d31145;color:#fff;border-radius:8px;padding:7px 14px;font-weight:700;cursor:pointer;">OK</button>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(panel);

    const dismissPrompt = () => {
      sessionStorage.removeItem("announcementPromptPending");
      panel.remove();
    };

    const cancelBtn = panel.querySelector("#announcement-cancel-btn");
    const okBtn = panel.querySelector("#announcement-ok-btn");

    if (cancelBtn) {
      cancelBtn.addEventListener("click", dismissPrompt);
    }
    if (okBtn) {
      okBtn.addEventListener("click", () => {
        sessionStorage.removeItem("announcementPromptPending");
        window.location.assign("announcements.html");
      });
    }
  }

  function readAnnouncements() {
    try {
      const raw = localStorage.getItem("fm_announcements_v1");
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
      return [];
    }
  }

  function escapeHtml(value) {
    const node = document.createElement("div");
    node.textContent = String(value || "");
    return node.innerHTML;
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", enhanceNav);
  } else {
    enhanceNav();
  }
})();
