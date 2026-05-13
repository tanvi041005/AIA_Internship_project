(async function () {
  let FUNNEL = [];
  let SOURCES = [];
  let PROGRAMS = [];
  let METRICS = {};

  function esc(value) {
    const node = document.createElement("div");
    node.textContent = String(value || "");
    return node.innerHTML;
  }

  async function loadRecruitmentData() {
    const data = await apiGet("/recruitment");
    FUNNEL = Array.isArray(data.funnel) ? data.funnel : [];
    SOURCES = Array.isArray(data.sources) ? data.sources : [];
    PROGRAMS = Array.isArray(data.programs) ? data.programs : [];
    const derivedMetrics = deriveMetrics();
    METRICS = data.metrics && typeof data.metrics === "object"
      ? { ...derivedMetrics, ...data.metrics, kpis: Array.isArray(data.metrics.kpis) ? data.metrics.kpis : derivedMetrics.kpis }
      : derivedMetrics;
  }

  function findByLabel(rows, pattern) {
    return rows.find((row) => pattern.test(String(row.label || row.name || "")));
  }

  function formatPct(value, digits = 0) {
    if (!Number.isFinite(value)) return "N/A";
    return value.toFixed(digits).replace(/\.0$/, "") + "%";
  }

  function deriveMetrics() {
    const applicants = Number((findByLabel(FUNNEL, /applicant/i) || {}).count || 0);
    const active = Number((findByLabel(FUNNEL, /active/i) || {}).count || 0);
    const offers = Number((findByLabel(FUNNEL, /offer/i) || {}).count || 0);
    const referral = Number((findByLabel(SOURCES, /referral/i) || {}).pct || 0);
    return {
      programmeLead: "District Manager",
      cycle: "2026 Intake",
      targetActiveFc: active || 0,
      intakeTag: `${applicants || 0} applicants - ${active || 0} active FCs`,
      kpis: [
        { label: "Conversion Rate", value: applicants ? formatPct((active / applicants) * 100, 1) : "N/A", delta: "" },
        { label: "Time to Offer", value: "N/A", delta: "" },
        { label: "Offer Acceptance", value: offers ? formatPct((active / offers) * 100) : "N/A", delta: "" },
        { label: "Source: Referral", value: referral ? formatPct(referral) : "N/A", delta: "highest converter" }
      ]
    };
  }

  function renderMetrics() {
    const meta = document.getElementById("rp-meta-summary");
    const tag = document.getElementById("funnel-intake-tag");
    const grid = document.getElementById("recruitment-kpi-grid");
    if (meta) {
      const pieces = [
        METRICS.programmeLead ? "Programme Lead: " + METRICS.programmeLead : "",
        METRICS.cycle ? "Cycle: " + METRICS.cycle : "",
        METRICS.targetActiveFc ? "Target: " + METRICS.targetActiveFc + " Active FCs" : ""
      ].filter(Boolean);
      meta.textContent = pieces.length ? pieces.join(" · ") : "Recruitment cycle loaded";
    }
    if (tag) tag.textContent = METRICS.intakeTag || "";
    if (!grid) return;
    const kpis = Array.isArray(METRICS.kpis) ? METRICS.kpis : [];
    grid.innerHTML = kpis.length ? kpis.map((kpi) => {
      const trendClass = /^-/.test(String(kpi.delta || "")) ? "delta-down" : "delta-up";
      const delta = kpi.delta
        ? `<p class="rp-kpi-delta"><span class="${trendClass}">${esc(kpi.delta)}</span> <span class="delta-note">${esc(kpi.note || "")}</span></p>`
        : `<p class="rp-kpi-delta"><span class="delta-note">${esc(kpi.note || "")}</span></p>`;
      return `<div class="rp-kpi">
        <p class="rp-kpi-lbl">${esc(kpi.label)}</p>
        <p class="rp-kpi-val">${esc(kpi.value)}</p>
        ${delta}
      </div>`;
    }).join("") : '<p class="muted-text">No recruitment KPI metrics found in the database.</p>';
  }

  function renderFunnel() {
    const container = document.getElementById("funnel-rows");
    if (!FUNNEL.length) {
      container.innerHTML = '<p class="muted-text">No recruitment funnel data found in the database.</p>';
      return;
    }
    container.innerHTML = FUNNEL.map((s, i) => `
      <div class="funnel-row" data-idx="${i}" role="button" tabindex="0" aria-expanded="false"
           aria-label="${esc(s.label)}: ${Number(s.count || 0)} (${Number(s.pct || s.percent || 0)}%)">
        <span class="funnel-lbl">${esc(s.label)}</span>
        <div class="funnel-track">
          <div class="funnel-fill" data-pct="${Number(s.pct || s.percent || 0)}" style="background:${esc(s.color || "#6b7280")}">
            ${Number(s.pct || s.percent || 0)}%
          </div>
        </div>
        <span class="funnel-count">${Number(s.count || 0)}</span>
      </div>
      <div class="funnel-detail" id="funnel-detail-${i}">${esc(s.detail || "")}</div>
    `).join("");

    requestAnimationFrame(() => setTimeout(() => {
      document.querySelectorAll(".funnel-fill").forEach(el => { el.style.width = el.dataset.pct + "%"; });
    }, 120));
    container.querySelectorAll(".funnel-row").forEach(row => {
      const toggle = () => {
        const detail = document.getElementById(`funnel-detail-${row.dataset.idx}`);
        const open = detail.classList.toggle("open");
        row.setAttribute("aria-expanded", String(open));
      };
      row.addEventListener("click", toggle);
      row.addEventListener("keydown", e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggle(); } });
    });
  }

  function renderSources() {
    const root = document.getElementById("source-rows");
    root.innerHTML = SOURCES.length ? SOURCES.map(s => `
      <div class="src-row">
        <span class="src-lbl">${esc(s.label)}</span>
        <div class="src-track"><div class="src-fill" data-pct="${Number(s.pct || s.percent || 0)}"></div></div>
        <span class="src-pct">${Number(s.pct || s.percent || 0)}%</span>
      </div>
    `).join("") : '<p class="muted-text">No source data found in the database.</p>';
    requestAnimationFrame(() => setTimeout(() => {
      document.querySelectorAll(".src-fill").forEach(el => { el.style.width = el.dataset.pct + "%"; });
    }, 200));
  }

  function renderPrograms() {
    const tbody = document.getElementById("prog-tbody");
    tbody.innerHTML = PROGRAMS.length ? PROGRAMS.map(p => {
      const opens = Number(p.opens || p.open_positions || 0);
      const offers = Number(p.offers || p.offers_extended || 0);
      const pct = opens ? Math.round((offers / opens) * 100) : 0;
      return `<tr>
        <td><strong>${esc(p.name || p.program_name)}</strong></td>
        <td>${opens}</td>
        <td>${Number(p.interviews || p.interviews_conducted || 0)}</td>
        <td>${offers}</td>
        <td class="prog-bar-cell"><div class="prog-mini-track"><div class="prog-mini-fill" style="width:${pct}%"></div></div></td>
      </tr>`;
    }).join("") : '<tr><td colspan="5" class="muted-text">No recruitment programs found in the database.</td></tr>';
  }

  try {
    await loadRecruitmentData();
  } catch (err) {
    console.error("Failed to load recruitment data", err);
  }
  renderMetrics();
  renderFunnel();
  renderSources();
  renderPrograms();
})();
