// ─── Dataset — loaded from GET /performance ───────────────────────────
    let AGENTS = [];
    let TOTAL_YTD    = 0;
    const SLOT_COLORS  = ["#a6192e", "#374151", "#6d5bd0", "#059669"];

    // ─── Helpers ──────────────────────────────────────────────────────────
    function initials(name) {
      const p = name.trim().split(" ");
      return (p[0][0] + (p[p.length - 1][0] || "")).toUpperCase();
    }
    function fmt(n)    { return "SGD " + Math.round(n).toLocaleString("en-SG"); }
    function slotColor(i) { return SLOT_COLORS[i % SLOT_COLORS.length]; }
    function hasNumber(value) { return typeof value === "number" && Number.isFinite(value); }
    function numOrNull(value) {
      if (value == null || value === "") return null;
      const n = Number(value);
      return Number.isFinite(n) ? n : null;
    }

    function parseExtra(row) {
      if (!row || !row.extra) return {};
      if (typeof row.extra === "object") return row.extra;
      try { return JSON.parse(row.extra); }
      catch { return {}; }
    }

    function applyDerivedDistrictRanks() {
      AGENTS
        .slice()
        .filter(agent => hasNumber(agent.ytdFyc))
        .sort((a, b) => b.ytdFyc - a.ytdFyc || a.name.localeCompare(b.name))
        .forEach((agent, i) => {
          agent.rank = i + 1;
        });
    }

    function agentPeriodMetrics(agent) {
      return {
        label: "YTD",
        fyc: agent.ytdFyc,
        anp: agent.ytdAnp,
        cases: agent.cases
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
      AGENTS
        .map((agent, idx) => ({ agent, idx }))
        .sort((a, b) => {
          const ar = a.agent.rank > 0 ? a.agent.rank : Number.MAX_SAFE_INTEGER;
          const br = b.agent.rank > 0 ? b.agent.rank : Number.MAX_SAFE_INTEGER;
          return ar - br || a.agent.name.localeCompare(b.agent.name);
        })
        .forEach(({ agent: a, idx }) => {
        if (lq && !a.name.toLowerCase().includes(lq) && !a.team.toLowerCase().includes(lq)) return;
        const added = selected.includes(idx);
        const nextColor = slotColor(selected.length);
        const rankText = a.rank > 0 ? `#${a.rank}` : "Unranked";
        const li = document.createElement("li");
        if (added) li.className = "already-added";
        li.setAttribute("role", "option");
        li.innerHTML = `
          <span class="list-avatar" style="background:${added ? "#c9c3b8" : nextColor}">${initials(a.name)}</span>
          <span class="list-info">
            <span class="list-name">${a.name}</span>
            <span class="list-rank">District rank ${rankText} · ${a.team}</span>
          </span>
          <span class="list-rank-badge">${rankText}</span>
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
      const wrap = document.getElementById("comp-table-wrap");

      if (selected.length === 0) {
        wrap.innerHTML = `<div class="comp-empty"><strong>No agents selected</strong>Click "+ Add another agent" above to get started.</div>`;
        return;
      }

      const cols = selected.map((idx, slot) => ({
        agent:   AGENTS[idx],
        color:   slotColor(slot),
        slot,
        metrics: agentPeriodMetrics(AGENTS[idx])
      }));

      // Metric definitions
      const metrics = [
        {
          key: "fyc",
          label: "FYC", sub: "",
          vals: cols.map(c => ({ text: hasNumber(c.metrics.fyc) ? fmt(c.metrics.fyc) : "—", num: c.metrics.fyc }))
        },
        {
          key: "anp",
          label: "ANP", sub: "",
          vals: cols.map(c => ({ text: hasNumber(c.metrics.anp) ? fmt(c.metrics.anp) : "—", num: c.metrics.anp }))
        },
        {
          key: "cases",
          label: "CASES", sub: "",
          vals: cols.map(c => ({ text: hasNumber(c.metrics.cases) ? c.metrics.cases : "—", num: c.metrics.cases }))
        },
        {
          key: "rank",
          label: "DISTRICT RANK", sub: "",
          vals: cols.map(c => ({ text: hasNumber(c.agent.rank) ? "#" + c.agent.rank : "—", num: hasNumber(c.agent.rank) ? -c.agent.rank : null })) // lower rank = better
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

    }

    // ─── Init — load agents from GET /performance ─────────────────────────
    (async function() {
      if (typeof apiGet === "function") {
        try {
          const rows = await apiGet("/performance?year=" + new Date().getFullYear() + "&period=current");
          if (Array.isArray(rows) && rows.length > 0) {
            AGENTS = rows
              .filter(function(r) { return !/^A\d+$/i.test(String(r.agent_id || "")); })
              .map(function(r) {
                const extra = parseExtra(r);
                return {
                  name: r.full_name || r.agent_id,
                rank: numOrNull(r.district_rank),
                ytdFyc: numOrNull(r.ytd_fyc),
                ytdAnp: numOrNull(r.ytd_fyp != null ? r.ytd_fyp : extra.ytdFyp),
                cases: numOrNull(r.total_cases != null ? r.total_cases : extra.ytdCases),
                team: r.team_name || extra.teamName || extra.agency || r.agent_id
              };
              });
            applyDerivedDistrictRanks();
            TOTAL_YTD = AGENTS.reduce((s, a) => s + (a.ytdFyc || 0), 0);
          }
        } catch (e) { console.warn("Failed to load performance data:", e); }
      }
      render();
    })();
