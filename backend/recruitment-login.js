(function () {
      var ACCESS_CODE = "changeme";
      var params = new URLSearchParams(location.search);
      var next = params.get("next") || "recruitment.html";
      if (!/^recruitment\.html$/i.test(next)) next = "recruitment.html";

      document.getElementById("login-form").addEventListener("submit", function (e) {
        e.preventDefault();
        var input = document.getElementById("code");
        var err = document.getElementById("login-error");
        err.hidden = true;
        if (input.value === ACCESS_CODE) {
          sessionStorage.setItem("fm_leader_auth", "1");
          location.href = next;
        } else {
          err.textContent = "Incorrect code.";
          err.hidden = false;
        }
      });
    })();