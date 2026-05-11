const LEADS_STORAGE_KEY = "financial_leads_data";
    const DEFAULT_LEADS = [
      {
        id:1,name:"Lim Wei Jie",age:34,contact:"9123-4567",email:"weijie.lim@email.com",
        meetDate:"2025-05-12",location:"Toa Payoh HDB",meetType:"Physical",urgency:"urgent",stage:"Proposal Sent",
        remarks:"Interested in term life; wife expecting. Has existing GE policy expiring soon.",
        planType:"Term Life",premium:2400,commission:"FYC",cpfSA:42000,cpfOA:88000,
        occupation:"Software Engineer",income:"SGD 7,200/mo",referredBy:"John Tan",
        followUps:[
          {label:"Initial meeting",date:"2025-04-30",done:true},
          {label:"Proposal sent",date:"2025-05-05",done:true},
          {label:"Follow-up call",date:"2025-05-14",done:false},
          {label:"Closing",date:"2025-05-20",done:false}
        ]
      },
      {
        id:2,name:"Nur Aisyah Binte Rahman",age:28,contact:"8234-5678",email:"aisyah.r@email.com",
        meetDate:"2025-05-15",location:"Tampines Mall",meetType:"Online",urgency:"medium",stage:"Fact-Find",
        remarks:"Self-employed, irregular income. Keen on savings plan for rainy day fund.",
        planType:"Endowment",premium:3600,commission:"Trail",cpfSA:18000,cpfOA:31000,
        occupation:"Freelance Designer",income:"SGD 3,800/mo (avg)",referredBy:"Self (Instagram)",
        followUps:[
          {label:"Intro call",date:"2025-05-10",done:true},
          {label:"Fact-find session",date:"2025-05-15",done:false},
          {label:"Needs analysis",date:"2025-05-22",done:false}
        ]
      },
      {
        id:3,name:"Chen Jia Hao",age:42,contact:"9345-6789",email:"jiahao.chen@corp.sg",
        meetDate:"2025-05-08",location:"Raffles Place (Client Office)",meetType:"Physical",urgency:"urgent",stage:"Closing",
        remarks:"Director-level. Needs keyman insurance + personal CI cover. Decide by end of month.",
        planType:"CI + Keyman",premium:9800,commission:"FYC",cpfSA:95000,cpfOA:180000,
        occupation:"Company Director",income:"SGD 22,000/mo",referredBy:"Existing client (Peter Goh)",
        followUps:[
          {label:"Discovery",date:"2025-04-22",done:true},
          {label:"Proposal",date:"2025-05-02",done:true},
          {label:"Negotiation",date:"2025-05-08",done:true},
          {label:"Closing sign-off",date:"2025-05-15",done:false}
        ]
      },
      {
        id:4,name:"Priya Nair",age:31,contact:"9456-7890",email:"priya.nair@gmail.com",
        meetDate:"2025-05-20",location:"Jurong East CC",meetType:"Hybrid",urgency:"non-urgent",stage:"Prospecting",
        remarks:"Teacher. Wants ILP for long-term growth. No rush — reviewing options with husband.",
        planType:"ILP",premium:4200,commission:"Trail",cpfSA:28000,cpfOA:54000,
        occupation:"Secondary School Teacher",income:"SGD 4,500/mo",referredBy:"Colleague referral",
        followUps:[
          {label:"WhatsApp intro",date:"2025-05-17",done:true},
          {label:"Meet-up",date:"2025-05-20",done:false},
          {label:"Proposal",date:"2025-05-28",done:false}
        ]
      },
      {
        id:5,name:"Marcus Tan Boon Kiat",age:38,contact:"9567-8901",email:"marcus.tbk@finco.com",
        meetDate:"2025-05-06",location:"CBD (Zoom)",meetType:"Online",urgency:"urgent",stage:"Needs Analysis",
        remarks:"Planning early retirement at 55. HNW profile — keen on wealth accumulation + legacy planning.",
        planType:"Whole Life + Trust",premium:24000,commission:"FYC + Trail",cpfSA:150000,cpfOA:320000,
        occupation:"VP Finance",income:"SGD 18,000/mo",referredBy:"Wealth manager partner",
        followUps:[
          {label:"Zoom intro",date:"2025-05-01",done:true},
          {label:"Needs analysis",date:"2025-05-06",done:true},
          {label:"Solutioning",date:"2025-05-12",done:false},
          {label:"Proposal",date:"2025-05-19",done:false}
        ]
      },
      {
        id:6,name:"Sandra Loh Mei Ling",age:55,contact:"8678-9012",email:"sandraloh@email.com",
        meetDate:"2025-05-25",location:"Woodlands Civic Centre",meetType:"Physical",urgency:"non-urgent",stage:"Fact-Find",
        remarks:"Near retirement. Reviewing existing Prudential policies. Possible DPS lapse to address.",
        planType:"Retirement + MediShield",premium:1800,commission:"Trail",cpfSA:65000,cpfOA:120000,
        occupation:"Admin Executive (Govt)",income:"SGD 3,200/mo",referredBy:"Daughter's recommendation",
        followUps:[
          {label:"Phone call",date:"2025-05-20",done:true},
          {label:"Fact-find",date:"2025-05-25",done:false}
        ]
      }
    ];

    const AVATAR_COLORS = ["#a6192e","#3b82f6","#16a34a","#f59e0b","#8b5cf6","#ec4899"];

    function getLeads() {
      try {
        return JSON.parse(localStorage.getItem(LEADS_STORAGE_KEY)) || DEFAULT_LEADS;
      } catch {
        return DEFAULT_LEADS;
      }
    }

    function initials(name) {
      return name.split(" ").map(w=>w[0]).slice(0,2).join("").toUpperCase();
    }

    function formatDate(d) {
      if(!d) return "—";
      const [y,m,dd] = d.split("-");
      const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
      return `${parseInt(dd)} ${months[parseInt(m)-1]} ${y}`;
    }

    function renderProfile(leadId) {
      const leads = getLeads();
      const lead = leads.find(l => l.id === leadId);
      
      if (!lead) {
        document.getElementById('profileContent').innerHTML = '<div class="error-message">Lead not found</div>';
        return;
      }

      const avatarColor = AVATAR_COLORS[(lead.id-1) % AVATAR_COLORS.length];
      const urgencyColor = lead.urgency === 'urgent' ? '#ef4444' : lead.urgency === 'medium' ? '#f59e0b' : '#6b7280';

      const html = `
        <div class="profile-header" style="background: linear-gradient(135deg, ${avatarColor}15 0%, ${avatarColor}08 100%);">
          <div class="profile-avatar" style="background: linear-gradient(135deg, ${avatarColor} 0%, ${avatarColor}dd 100%);">
            ${initials(lead.name)}
          </div>
          <div class="profile-info">
            <h1>${lead.name}</h1>
            <p class="profile-subtitle">${lead.occupation} • ${lead.income}</p>
            <div class="profile-meta">
              <div class="meta-item">
                <span class="meta-label">Referred By</span>
                <span class="meta-value">${lead.referredBy}</span>
              </div>
              <div class="meta-item">
                <span class="meta-label">Stage</span>
                <span class="meta-value">${lead.stage}</span>
              </div>
              <div class="meta-item">
                <span class="meta-label">Urgency</span>
                <span class="meta-value" style="color: ${urgencyColor};">${lead.urgency.toUpperCase()}</span>
              </div>
            </div>
          </div>
          <div class="profile-actions">
            <button class="btn-primary" onclick="window.location.href='create-profile.html?edit=${lead.id}'">Edit Profile</button>
          </div>
        </div>

        <div class="content-grid">
          <div class="card">
            <h2 class="card-title">Client Details</h2>
            <div class="section-divider"></div>
            <div class="info-grid">
              <div class="info-item">
                <div class="info-label">Age</div>
                <div class="info-value">${lead.age} years</div>
              </div>
              <div class="info-item">
                <div class="info-label">Contact</div>
                <div class="info-value">${lead.contact}</div>
              </div>
              <div class="info-item">
                <div class="info-label">Email</div>
                <div class="info-value" style="font-size: 0.95rem;">${lead.email}</div>
              </div>
              <div class="info-item">
                <div class="info-label">Meeting Type</div>
                <div class="info-value">${lead.meetType}</div>
              </div>
              <div class="info-item">
                <div class="info-label">First Appointment</div>
                <div class="info-value">${formatDate(lead.meetDate)}</div>
              </div>
              <div class="info-item">
                <div class="info-label">Location</div>
                <div class="info-value">${lead.location}</div>
              </div>
              <div class="info-item">
                <div class="info-label">Stage</div>
                <div class="info-value">${lead.stage}</div>
              </div>
              <div class="info-item">
                <div class="info-label">Urgency</div>
                <div class="info-value" style="color:${urgencyColor}">${lead.urgency.toUpperCase()}</div>
              </div>
            </div>
          </div>

          <div class="card">
            <h2 class="card-title">Financial Portfolio</h2>
            <div class="section-divider"></div>
            <div class="info-grid">
              <div class="info-item">
                <div class="info-label">CPF OA Balance</div>
                <div class="info-value">SGD ${lead.cpfOA.toLocaleString()}</div>
              </div>
              <div class="info-item">
                <div class="info-label">CPF SA Balance</div>
                <div class="info-value">SGD ${lead.cpfSA.toLocaleString()}</div>
              </div>
              <div class="info-item">
                <div class="info-label">Recommended Plan</div>
                <div class="info-value">${lead.planType}</div>
              </div>
              <div class="info-item">
                <div class="info-label">Est. Premium / yr</div>
                <div class="info-value" style="color: var(--brand);">SGD ${lead.premium.toLocaleString()}</div>
              </div>
              <div class="info-item">
                <div class="info-label">Commission Type</div>
                <div class="info-value">${lead.commission}</div>
              </div>
            </div>
          </div>
        </div>

        <div class="timeline-section">
          <h2 class="card-title">Follow-up Timeline</h2>
          <div class="section-divider"></div>
          <div class="timeline">
            ${(lead.followUps || []).map(f => `
              <div class="timeline-item ${f.done ? 'done' : 'pending'}">
                <div class="timeline-dot"></div>
                <div class="timeline-title">${f.label}</div>
                <div class="timeline-date">
                  ${formatDate(f.date)}
                  <span class="timeline-status ${f.done ? 'completed' : 'pending'}">
                    ${f.done ? '✓ Completed' : '◌ Pending'}
                  </span>
                </div>
              </div>
            `).join('')}
          </div>
        </div>

        <div class="card" style="grid-column: span 2; margin-top: 0;">
          <h2 class="card-title">Remarks</h2>
          <div class="section-divider"></div>
          <p style="font-size: 1rem; line-height: 1.6; color: var(--text);">${lead.remarks}</p>
        </div>
      `;

      document.getElementById('profileContent').innerHTML = html;
    }

    // Get lead ID from URL
    const params = new URLSearchParams(window.location.search);
    const leadId = parseInt(params.get('id'));
    
    if (leadId) {
      renderProfile(leadId);
    } else {
      document.getElementById('profileContent').innerHTML = '<div class="error-message">No lead ID provided</div>';
    }