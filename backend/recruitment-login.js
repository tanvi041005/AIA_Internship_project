(function () {
  var params = new URLSearchParams(location.search);
  var next = params.get("next") || "recruitment.html";
  if (!/^recruitment\.html$/i.test(next)) next = "recruitment.html";

  document.getElementById("login-form").addEventListener("submit", async function (e) {
    e.preventDefault();
    var input = document.getElementById("code");
    var err = document.getElementById("login-error");
    err.hidden = true;
    try {
      await apiPost("/recruitment/access", { code: input.value });
      sessionStorage.setItem("fm_leader_auth", "1");
      location.href = next;
    } catch (error) {
      err.textContent = "Incorrect code.";
      err.hidden = false;
    }
  });
})();
