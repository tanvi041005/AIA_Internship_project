// ─── Data ─────────────────────────────────────────────
    const FUNNEL = [
      { label: "Applicants",      count: 247, pct: 100, color: "#202124",
        detail: "247 total applicants across all channels. Referral (42%), LinkedIn (28%), Walk-in (18%), Job portals (12%)." },
      { label: "CV Review Pass",  count: 178, pct: 72,  color: "#374151",
        detail: "178 CVs cleared initial screening. Top drop-off: incomplete applications (38%), mismatched experience (24%)." },
      { label: "First Interview", count: 94,  pct: 38,  color: "#4b5563",
        detail: "94 candidates attended first interview. Panel: Agency Leader + HR. Avg duration 35 min." },
      { label: "Final Round",     count: 35,  pct: 14,  color: "#6b7280",
        detail: "35 reached final assessment. Includes role-play, financial planning exercise, and culture fit review." },
      { label: "Offer Extended",  count: 18,  pct: 7,   color: "#9ca3af",
        detail: "18 offers sent. Avg time from first interview to offer: 19 days. Decline reasons: competing offers (3), relocation (2)." },
      { label: "Active FC",       count: 10,  pct: 4,   color: "#a6192e",
        detail: "10 active Financial Consultants from this intake. Target was 10. Onboarding completion: 80%." },
    ];

    const SOURCES = [
      { label: "Referral",    pct: 42 },
      { label: "LinkedIn",    pct: 28 },
      { label: "Walk-in",     pct: 18 },
      { label: "Job Portals", pct: 12 },
    ];

    const PROGRAMS = [
      { name: "FC Graduate",       opens: 58, interviews: 22, offers: 6,  status: "active" },
      { name: "Internship – Eng",  opens: 41, interviews: 17, offers: 5,  status: "open"   },
      { name: "Internship – Data", opens: 33, interviews: 14, offers: 4,  status: "open"   },
    ];

    // ─── Render funnel ─────────────────────────────────────
    function renderFunnel() {
      const container = document.getElementById("funnel-rows");
      container.innerHTML = FUNNEL.map((s, i) => `
        <div class="funnel-row" data-idx="${i}" role="button" tabindex="0" aria-expanded="false"
             aria-label="${s.label}: ${s.count} (${s.pct}%)">
          <span class="funnel-lbl">${s.label}</span>
          <div class="funnel-track">
            <div class="funnel-fill" data-pct="${s.pct}" style="background:${s.color}">
              ${s.pct}%
            </div>
          </div>
          <span class="funnel-count">${s.count}</span>
        </div>
        <div class="funnel-detail" id="funnel-detail-${i}">${s.detail}</div>
      `).join("");

      // Animate on load
      requestAnimationFrame(() => setTimeout(() => {
        document.querySelectorAll(".funnel-fill").forEach(el => {
          el.style.width = el.dataset.pct + "%";
        });
      }, 120));

      // Toggle details on click / Enter
      container.querySelectorAll(".funnel-row").forEach(row => {
        const toggle = () => {
          const idx    = row.dataset.idx;
          const detail = document.getElementById(`funnel-detail-${idx}`);
          const open   = detail.classList.toggle("open");
          row.setAttribute("aria-expanded", String(open));
        };
        row.addEventListener("click",   toggle);
        row.addEventListener("keydown", e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggle(); } });
      });
    }

    // ─── Render source attribution ─────────────────────────
    function renderSources() {
      document.getElementById("source-rows").innerHTML = SOURCES.map(s => `
        <div class="src-row">
          <span class="src-lbl">${s.label}</span>
          <div class="src-track"><div class="src-fill" data-pct="${s.pct}"></div></div>
          <span class="src-pct">${s.pct}%</span>
        </div>
      `).join("");

      requestAnimationFrame(() => setTimeout(() => {
        document.querySelectorAll(".src-fill").forEach(el => {
          el.style.width = el.dataset.pct + "%";
        });
      }, 200));
    }

    // ─── Render programs ───────────────────────────────────
    function renderPrograms() {
      const statusPill = s => {
        if (s === "active")  return `<span class="stage-pill pill-active">Active</span>`;
        if (s === "closed")  return `<span class="stage-pill pill-closed">Closed</span>`;
        return `<span class="stage-pill pill-open">Open</span>`;
      };
      document.getElementById("prog-tbody").innerHTML = PROGRAMS.map(p => {
        const pct = Math.round((p.offers / p.opens) * 100);
        return `<tr>
          <td><strong>${p.name}</strong></td>
          <td>${p.opens}</td>
          <td>${p.interviews}</td>
          <td>${p.offers}</td>
          <td class="prog-bar-cell">
            <div class="prog-mini-track">
              <div class="prog-mini-fill" style="width:${pct}%"></div>
            </div>
          </td>
        </tr>`;
      }).join("");
    }

    renderFunnel();
    renderSources();
    renderPrograms();