(async function () {
      // GET /cpf-rates → { allocationRates, contributionRates, retirementSums }
      var allocationBands = [];
      var contributionBands = [];

      function parseMaxAge(g) {
        var s = String(g || "").trim();
        if (/^[≤<]/.test(s)) return parseInt(s.replace(/[^0-9]/g, ""), 10) || 120;
        var m = s.match(/(\d+)-(\d+)/);
        if (m) return parseInt(m[2], 10);
        if (s.startsWith(">")) return 120;
        return 120;
      }

      if (typeof apiGet === "function") {
        try {
          var rates = await apiGet("/cpf-rates");
          if (rates && rates.allocationRates) {
            allocationBands = rates.allocationRates.map(function (r) {
              return { maxAge: parseMaxAge(r.ageGroup), oa: r.oa / 100, sa: r.sa / 100, ma: r.ma / 100 };
            });
          }
          if (rates && rates.contributionRates) {
            contributionBands = rates.contributionRates.map(function (r) {
              return { maxAge: parseMaxAge(r.ageGroup), employer: r.employer / 100, employee: r.employee / 100 };
            });
          }
        } catch (e) { console.warn("Failed to load CPF rates:", e); }
      }

      function money(value) {
        return new Intl.NumberFormat("en-SG", { style: "currency", currency: "SGD", maximumFractionDigits: 0 }).format(value);
      }

      function numberValue(id) {
        return Number(document.getElementById(id).value) || 0;
      }

      function bandFor(age, bands) {
        return bands.find(function (band) { return age <= band.maxAge; }) || bands[bands.length - 1];
      }

      function calculateCpf() {
        var currentAge = numberValue("cpf-current-age");
        var targetAge = Math.max(numberValue("cpf-target-age"), currentAge + 1);
        var startingBalance = numberValue("cpf-starting-balance");
        var monthlySalary = numberValue("cpf-monthly-salary");
        var growth = numberValue("cpf-salary-growth") / 100;
        var wageCeiling = numberValue("cpf-wage-ceiling");
        var maCap = numberValue("cpf-ma-cap");
        var applyMaCap = document.getElementById("cpf-apply-ma-cap").checked;

        var initialAllocation = bandFor(currentAge, allocationBands);
        var oa = startingBalance * initialAllocation.oa;
        var sa = startingBalance * initialAllocation.sa;
        var ma = startingBalance * initialAllocation.ma;
        var totalContributions = 0;
        var maOverflowTotal = 0;
        var rows = [];

        for (var age = currentAge; age < targetAge; age += 1) {
          var yearsFromStart = age - currentAge;
          var annualSalary = monthlySalary * Math.pow(1 + growth, yearsFromStart) * 12;
          var cappedMonthlySalary = Math.min(monthlySalary * Math.pow(1 + growth, yearsFromStart), wageCeiling);
          var contributionRate = bandFor(age, contributionBands);
          var employerContribution = Math.round(cappedMonthlySalary * contributionRate.employer) * 12;
          var employeeContribution = Math.floor(cappedMonthlySalary * contributionRate.employee) * 12;
          var annualContribution = employerContribution + employeeContribution;
          var allocation = bandFor(age, allocationBands);

          totalContributions += annualContribution;
          oa += annualContribution * allocation.oa;
          sa += annualContribution * allocation.sa;
          ma += annualContribution * allocation.ma;

          if (applyMaCap && maCap > 0 && ma > maCap) {
            var maOverflow = ma - maCap;
            ma = maCap;
            sa += maOverflow;
            maOverflowTotal += maOverflow;
          }

          oa *= 1.025;
          sa *= 1.04;
          ma *= 1.04;

          if (applyMaCap && maCap > 0 && ma > maCap) {
            var interestOverflow = ma - maCap;
            ma = maCap;
            sa += interestOverflow;
            maOverflowTotal += interestOverflow;
          }

          rows.push({
            age: age,
            salary: annualSalary,
            contribution: annualContribution,
            total: oa + sa + ma
          });
        }

        document.getElementById("cpf-projection-label").textContent = "Age " + targetAge;
        document.getElementById("cpf-oa-result").textContent = money(oa);
        document.getElementById("cpf-sa-result").textContent = money(sa);
        document.getElementById("cpf-ma-result").textContent = money(ma);
        document.getElementById("cpf-total-result").textContent = money(oa + sa + ma);

        var summaryItems = [
          '<li><span class="dot blue"></span><div class="activity-body"><div class="activity-row"><span class="activity-name">Total CPF contributions</span><span class="activity-time">' + money(totalContributions) + '</span></div><p class="activity-desc">Calculated from salary, wage ceiling, and CPF contribution rates.</p></div></li>'
        ];
        if (applyMaCap) {
          summaryItems.push('<li><span class="dot orange"></span><div class="activity-body"><div class="activity-row"><span class="activity-name">MA overflow redirected to SA/RA</span><span class="activity-time">' + money(maOverflowTotal) + '</span></div><p class="activity-desc">When MA exceeds the cap, excess is moved into SA/RA in this simplified model.</p></div></li>');
        }
        summaryItems.push('<li><span class="dot red"></span><div class="activity-body"><div class="activity-row"><span class="activity-name">Projection type</span><span class="activity-time">Basic CPF</span></div><p class="activity-desc">Only CPF contribution, allocation, salary growth, wage ceiling, and interest assumptions are included.</p></div></li>');
        document.getElementById("cpf-summary-list").innerHTML = summaryItems.join("");

        document.getElementById("cpf-projection-body").innerHTML = rows.slice(-8).map(function (row) {
          return "<tr><td>" + row.age + "</td><td>" + money(row.salary) + "</td><td>" + money(row.contribution) + "</td><td>" + money(row.total) + "</td></tr>";
        }).join("");
      }

      document.getElementById("cpf-calculator-form").addEventListener("submit", function (event) {
        event.preventDefault();
        calculateCpf();
      });

      document.getElementById("cpf-calculator-form").addEventListener("reset", function () {
        setTimeout(calculateCpf, 0);
      });

      document.querySelectorAll("#cpf-calculator-form input").forEach(function (input) {
        input.addEventListener("input", calculateCpf);
        input.addEventListener("change", calculateCpf);
      });

      calculateCpf();
    })();