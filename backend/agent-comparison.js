// ─── Dataset — loaded from GET /performance ───────────────────────────
    let AGENTS = [];
    // DISTRICT_CUM (12-month cumulative) not yet returned by /performance; needs monthly breakdown endpoint
    let DISTRICT_CUM = new Array(12).fill(0);
    const MONTHS       = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
    let TOTAL_YTD    = 0;
    const SLOT_COLORS  = ["#a6192e", "#374151", "#6d5bd0", "#059669"];

    // ─── Helpers ──────────────────────────────────────────────────────────
    function initials(name) {
      const p = name.trim().split(" ");
      return (p[0][0] + (p[p.length - 1][0] || "")).toUpperCase();
    }
    function fmt(n)    { return "SGD " + Math.round(n).toLocaleString("en-SG"); }
    function slotColor(i) { return SLOT_COLORS[i % SLOT_COLORS.length]; }

    function agentCum(agent) {
      const r = agent.ytdFyc / TOTAL_YTD;
      return DISTRICT_CUM.map(v => Math.round(v * r));
    }
    function agentInc(agent) {
      const c = agentCum(agent);
      return c.map((v, i) => i === 0 ? v : v - c[i - 1]);
    }

    // ─── Period helpers ────────────────────────────────────────────────────
    function periodInfo(period) {
      const ranges = {
        ytd:   { start: 0, end: 4, label: "Jan – May · 2026",              future: false },
        month: { start: 4, end: 4, label: "May · 2026",                    future: false },
        q1:    { start: 0, end: 2, label: "Jan – Mar · 2026",              future: false },
        q2:    { start: 3, end: 4, label: "Apr – May · 2026 (partial)",    future: false },
        q3:    { start: 6, end: 8, label: "Jul – Sep · 2026",              future: true  },
        q4:    { start: 9, end: 11, label: "Oct – Dec · 2026",             future: true  },
      };
      return ranges[period] || ranges.ytd;
    }

    function agentPeriodMetrics(agent, period) {
      const { start, end, label, future } = periodInfo(period);
      if (future) return { label, available: false };

      const inc     = agentInc(agent);
      const slice   = inc.slice(start, end + 1);
      const fyc     = slice.reduce((s, v) => s + v, 0);
      const months  = slice.length;
      const bestVal = Math.max(...slice);
      const bestIdx = start + slice.indexOf(bestVal);
      const anp     = Math.round(fyc * 4.25);

      let cases;
      if (period === "ytd")   cases = agent.cases;
      else if (period === "q1") cases = Math.round(agent.cases * 3 / 5);
      else if (period === "q2") cases = Math.round(agent.cases * 2 / 5);
      else                    cases = Math.max(0, Math.round(agent.cases / 5));

      return {
        label, available: true,
        fyc, anp, cases,
        avgMonthly: Math.round(fyc / months),
        bestMonth: bestVal,
        bestMonthName: MONTHS[bestIdx],
        months
      };
    }

    // ─── State ────────────────────────────────────────────────────────────
    let selected = [];    // array of agent indices
    let period   = "ytd";

    // ─── Add / Remove ─────────────────────────────────────────────────────
    function addAgent(idx) {
      if (selected.includes(idx) || selected.length >= 4) return;
      selected.push(idx);
      render();
    }
    function removeAgent(slotIdx) {
      selected.splice(slotIdx, 1);
      render();
    }

    // ─── Dropdown ─────────────────────────────────────────────────────────
    function openDropdown() {
      const dd  = document.getElementById("add-dropdown");
      const btn = document.getElementById("add-agent-btn");
      dd.hidden = false;
      btn.setAttribute("aria-expanded", "true");
      const inp = document.getElementById("agent-search");
      inp.value = "";
      renderDropdownList("");
      inp.focus();
    }
    function closeDropdown() {
      const dd  = document.getElementById("add-dropdown");
      const btn = document.getElementById("add-agent-btn");
      dd.hidden = true;
      btn.setAttribute("aria-expanded", "false");
    }
    function renderDropdownList(q) {
      const ul = document.getElementById("agent-list-ul");
      ul.innerHTML = "";
      const lq = q.trim().toLowerCase();
      let count = 0;
      AGENTS.forEach((a, idx) => {
        if (lq && !a.name.toLowerCase().includes(lq) && !a.team.toLowerCase().includes(lq)) return;
        const added = selected.includes(idx);
        const nextColor = slotColor(selected.length);
        const li = document.createElement("li");
        if (added) li.className = "already-added";
        li.setAttribute("role", "option");
        li.innerHTML = `
          <span class="list-avatar" style="background:${added ? "#c9c3b8" : nextColor}">${initials(a.name)}</span>
          <span class="list-info">
            <span class="list-name">${a.name}</span>
            <span class="list-rank">Rank #${a.rank} · ${a.team}</span>
          </span>
          ${added ? '<span style="font-size:0.7rem;color:#c0b0a0">Added</span>' : ""}
        `;
        if (!added) li.addEventListener("click", () => { addAgent(idx); closeDropdown(); });
        ul.appendChild(li);
        count++;
      });
      if (count === 0) {
        ul.innerHTML = `<li style="padding:0.7rem 0.9rem;color:#b0a090;font-size:0.82rem;cursor:default">No results</li>`;
      }
    }

    document.getElementById("add-agent-btn").addEventListener("click", e => {
      e.stopPropagation();
      const dd = document.getElementById("add-dropdown");
      dd.hidden ? openDropdown() : closeDropdown();
    });
    document.getElementById("agent-search").addEventListener("input", e => renderDropdownList(e.target.value));
    document.addEventListener("click", e => {
      if (!document.getElementById("comp-add-wrap").contains(e.target)) closeDropdown();
    });

    // ─── Render ───────────────────────────────────────────────────────────
    function render() {
      renderChips();
      renderTable();
    }

    function renderChips() {
      const container = document.getElementById("comp-chips");
      container.querySelectorAll(".agent-chip").forEach(c => c.remove());
      const addWrap = document.getElementById("comp-add-wrap");

      selected.forEach((agentIdx, slot) => {
        const a = AGENTS[agentIdx];
        const color = slotColor(slot);
        const chip = document.createElement("div");
        chip.className = "agent-chip";
        chip.innerHTML = `
          <span class="chip-avatar" style="background:${color}">${initials(a.name)}</span>
          <span>${a.name}</span>
          <button class="chip-remove" aria-label="Remove ${a.name}" data-slot="${slot}">&times;</button>
        `;
        chip.querySelector(".chip-remove").addEventListener("click", () => removeAgent(slot));
        container.insertBefore(chip, addWrap);
      });

      const btn = document.getElementById("add-agent-btn");
      btn.disabled = selected.length >= 4;
      renderDropdownList(document.getElementById("agent-search").value || "");
    }

    function winnerIdx(nums) {
      const valid = nums.map(n => (typeof n === "number" && isFinite(n)) ? n : -Infinity);
      const max   = Math.max(...valid);
      if (max === -Infinity) return -1;
      return valid.filter(v => v === max).length > 1 ? -1 : valid.indexOf(max);
    }

    function renderTable() {
      const wrap    = document.getElementById("comp-table-wrap");
      const monthly = document.getElementById("comp-monthly");

      if (selected.length === 0) {
        wrap.innerHTML = `<div class="comp-empty"><strong>No agents selected</strong>Click "+ Add another agent" above to get started.</div>`;
        monthly.innerHTML = "";
        return;
      }

      const cols = selected.map((idx, slot) => ({
        agent:   AGENTS[idx],
        color:   slotColor(slot),
        slot,
        metrics: agentPeriodMetrics(AGENTS[idx], period)
      }));

      // Metric definitions
      const metrics = [
        {
          key: "period",
          label: "PERIOD", sub: "",
          vals: cols.map(c => ({ text: c.metrics.label || "—", num: null })),
          noWinner: true
        },
        {
          key: "fyc",
          label: "FYC", sub: "",
          vals: cols.map(c => ({ text: c.metrics.available ? fmt(c.metrics.fyc) : "—", num: c.metrics.fyc ?? null }))
        },
        {
          key: "anp",
          label: "ANP", sub: "",
          vals: cols.map(c => ({ text: c.metrics.available ? fmt(c.metrics.anp) : "—", num: c.metrics.anp ?? null }))
        },
        {
          key: "cases",
          label: "CASES", sub: "",
          vals: cols.map(c => ({ text: c.metrics.available ? c.metrics.cases : "—", num: c.metrics.cases ?? null }))
        },
        {
          key: "avg",
          label: "AVG MONTHLY FYC",
          sub: cols[0]?.metrics.available ? `across ${cols[0].metrics.months} month${cols[0].metrics.months !== 1 ? "s" : ""}` : "",
          vals: cols.map(c => ({ text: c.metrics.available ? fmt(c.metrics.avgMonthly) : "—", num: c.metrics.avgMonthly ?? null }))
        },
        {
          key: "best",
          label: "BEST MONTH", sub: "Highest FYC",
          vals: cols.map(c => ({
            text:    c.metrics.available ? fmt(c.metrics.bestMonth) : "—",
            subtext: c.metrics.available ? c.metrics.bestMonthName : "",
            num:     c.metrics.bestMonth ?? null
          }))
        },
        {
          key: "rank",
          label: "DISTRICT RANK", sub: "",
          vals: cols.map(c => ({ text: "#" + c.agent.rank, num: -c.agent.rank })) // lower rank = better
        },
        {
          key: "delta",
          label: "DELTA", sub: "vs last period",
          vals: cols.map(c => ({
            text: c.agent.delta === 0 ? "—" : (c.agent.delta > 0 ? "+" : "") + c.agent.delta + "%",
            num: c.agent.delta
          }))
        }
      ];

      // Build table
      let html = `<table class="comp-table">
        <colgroup>
          <col class="col-lbl" />
          ${cols.map(() => `<col />`).join("")}
        </colgroup>
        <thead><tr>
          <th class="th-lbl"></th>
          ${cols.map(c => `
            <th class="th-agent" scope="col">
              <div class="agent-col-wrap">
                <div class="agent-col-avatar" style="background:${c.color}">${initials(c.agent.name)}</div>
                <div class="agent-col-info">
                  <span class="agent-col-name">${c.agent.name}</span>
                  <span class="agent-col-team">${c.agent.team}</span>
                </div>
              </div>
              <button class="agent-col-remove" data-slot="${c.slot}" aria-label="Remove ${c.agent.name}">&times;</button>
            </th>
          `).join("")}
        </tr></thead>
        <tbody>
      `;

      metrics.forEach(m => {
        const wi = m.noWinner ? -1 : winnerIdx(m.vals.map(v => v.num));
        html += `<tr>
          <td class="td-lbl">
            <span class="m-label">${m.label}</span>
            ${m.sub ? `<span class="m-sublabel">${m.sub}</span>` : ""}
          </td>
          ${m.vals.map((v, i) => `
            <td class="td-val">
              <span class="m-value${i === wi ? " is-winner" : ""}">${v.text}</span>
              ${v.subtext ? `<span class="m-sub">${v.subtext}</span>` : ""}
            </td>
          `).join("")}
        </tr>`;
      });

      html += `</tbody></table>`;
      wrap.innerHTML = html;

      // Wire remove buttons inside table
      wrap.querySelectorAll(".agent-col-remove").forEach(btn => {
        btn.addEventListener("click", () => removeAgent(+btn.dataset.slot));
      });

      renderMonthly(cols);
    }

    function renderMonthly(cols) {
      const section = document.getElementById("comp-monthly");
      const { start, end, future } = periodInfo(period);
      if (future || start === end) { section.innerHTML = ""; return; }

      const monthIdxs = Array.from({ length: end - start + 1 }, (_, i) => start + i);
      const agentIncs = cols.map(c => agentInc(c.agent));

      let html = `<div class="monthly-wrap">
        <div class="monthly-head"><h2>Month-by-month FYC</h2></div>
        <table class="monthly-table">
          <colgroup>
            <col style="width:80px" />
            ${cols.map(() => `<col />`).join("")}
          </colgroup>
          <thead><tr>
            <th>Month</th>
            ${cols.map(c => `<th>${c.agent.name.split(" ")[0]}</th>`).join("")}
          </tr></thead>
          <tbody>`;

      monthIdxs.forEach(mi => {
        const vals = agentIncs.map(inc => inc[mi]);
        const wi   = winnerIdx(vals);
        html += `<tr>
          <td class="td-month">${MONTHS[mi]}</td>
          ${vals.map((v, i) => `<td class="${i === wi ? "td-best" : ""}">${fmt(v)}</td>`).join("")}
        </tr>`;
      });

      html += `</tbody></table></div>`;
      section.innerHTML = html;
    }

    // ─── Period tab wiring ────────────────────────────────────────────────
    document.querySelectorAll(".period-tab[data-period]").forEach(tab => {
      tab.addEventListener("click", () => {
        document.querySelectorAll(".period-tab").forEach(t => t.classList.remove("active"));
        tab.classList.add("active");
        period = tab.dataset.period;
        renderTable();
      });
    });

    // ─── Init — load agents from GET /performance ─────────────────────────
    (async function() {
      if (typeof apiGet === "function") {
        try {
          const rows = await apiGet("/performance");
          if (Array.isArray(rows) && rows.length > 0) {
            AGENTS = rows.map(function(r) {
              return { name: r.full_name || r.agent_id, rank: r.district_rank || 0, ytdFyc: Number(r.ytd_fyc || 0), delta: Number(r.delta || 0), cases: Number(r.cases || 0), team: r.team_code || r.agent_id };
            });
            TOTAL_YTD = AGENTS.reduce((s, a) => s + a.ytdFyc, 0);
          }
        } catch (e) { console.warn("Failed to load performance data:", e); }
      }
      if (AGENTS.length >= 2) { addAgent(0); addAgent(1); }
      else { render(); }
    })();