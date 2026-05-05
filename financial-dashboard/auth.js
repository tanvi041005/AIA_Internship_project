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
      window.location.assign("index.html");
    });
    return;
  }

  const nav = document.querySelector(".nav-inner");
  if (nav && !document.getElementById("logout-link")) {
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
})();
