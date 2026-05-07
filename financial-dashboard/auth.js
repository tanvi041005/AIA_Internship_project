(function authGate() {
  const PUBLIC_PAGES = new Set(["login.html", "recruitment-login.html"]);
  const currentPage = (window.location.pathname.split("/").pop() || "index.html").toLowerCase();
  const loggedRole = sessionStorage.getItem("dashboardRole");

  if (!PUBLIC_PAGES.has(currentPage) && !loggedRole) {
    window.location.replace("login.html");
    return;
  }

  if (currentPage === "recruitment.html" && loggedRole === "agent") {
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
      localStorage.setItem("calendarRole", detected.key === "district" ? "district_manager" : "agent");
      localStorage.setItem("overviewScope", "agency");
      window.location.assign("index.html");
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

    const setOverviewLabel = (link, label) => {
      link.innerHTML = `<span>${label}</span><span class="overview-caret" aria-hidden="true">▾</span>`;
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

    // Dynamic active tab highlighting based on the current page
    const navLinks = nav.querySelectorAll("a:not(#logout-link)");
    navLinks.forEach(link => {
      const href = (link.getAttribute("href") || "").toLowerCase();
      // Check if current link matches page or if we're in a lead-related sub-page
      const isCurrentPage = href === currentPage || (currentPage === "index.html" && (href === "" || href === "index.html"));
      const isLeadsSubPage = href === "leads.html" && currentPage === "create-profile.html";

      if (isCurrentPage || isLeadsSubPage) {
        link.classList.add("active");
      } else {
        link.classList.remove("active");
      }
    });

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
      if (loggedRole === "agent") {
        const recruitmentLink = Array.from(nav.querySelectorAll("a")).find(
          (link) => (link.getAttribute("href") || "").toLowerCase() === "recruitment.html"
        );
        if (recruitmentLink) {
          recruitmentLink.remove();
        }
      }

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
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", enhanceNav);
  } else {
    enhanceNav();
  }
})();
