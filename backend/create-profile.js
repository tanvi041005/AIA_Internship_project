const LEADS_STORAGE_KEY = "financial_leads_data";

    const ORDINAL_WORDS = [
      "First",
      "Second",
      "Third",
      "Fourth",
      "Fifth",
      "Sixth",
      "Seventh",
      "Eighth",
      "Ninth",
      "Tenth"
    ];

    function toOrdinalLabel(position) {
      const idx = Math.max(1, Number(position || 1));
      if (ORDINAL_WORDS[idx - 1]) return ORDINAL_WORDS[idx - 1];
      return `${idx}th`;
    }

    function normalizePlans(source) {
      if (Array.isArray(source)) return source.map((s) => String(s || "").trim()).filter(Boolean);
      if (!source) return [];
      return String(source)
        .split(/\r?\n|,|;/)
        .map((s) => s.trim())
        .filter(Boolean);
    }

    function renderPlanInputs(plans) {
      const container = document.getElementById("existing-plans-list");
      const normalizedPlans = plans && plans.length ? plans : [""];
      container.innerHTML = normalizedPlans.map((planValue, index) => {
        const position = index + 1;
        const ord = toOrdinalLabel(position);
        return `
          <div class="existing-plan-row">
            <span class="existing-plan-label">${ord} Plan</span>
            <input type="text" class="existing-plan-input" placeholder="${ord} plan (e.g. AIA Endowment)" value="${String(planValue || "").replace(/&/g, "&amp;").replace(/\"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;")}" />
          </div>
        `;
      }).join("");
    }

    function collectPlanInputs() {
      return Array.from(document.querySelectorAll(".existing-plan-input"))
        .map((input) => input.value.trim())
        .filter(Boolean);
    }

    function formatCurrencyAmount(amount) {
      return `SGD ${Number(amount || 0).toLocaleString()}`;
    }

    function calculateCommissionAmount() {
      const premium = parseFloat(document.getElementById("cp-premium").value) || 0;
      const commissionRate = parseFloat(document.getElementById("cp-commission-rate").value) || 0;
      const amount = premium * commissionRate / 100;
      const amountField = document.getElementById("cp-commission-amount");
      if (amountField) amountField.value = formatCurrencyAmount(amount);
      return amount;
    }

    function cleanContact(value) {
      return String(value || "").replace(/\D/g, "").slice(0, 8);
    }

    function bindContactCleaner(input) {
      if (!input) return;
      input.value = cleanContact(input.value);
      input.addEventListener("input", () => {
        input.value = cleanContact(input.value);
      });
    }

    // Excel Upload and Auto-fill functionality
    function parseExcelFile(file) {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
          try {
            const data = e.target.result;
            const workbook = XLSX.read(data, { type: 'binary' });
            const sheetName = workbook.SheetNames[0];
            const sheet = workbook.Sheets[sheetName];
            const rows = XLSX.utils.sheet_to_json(sheet);
            
            if (!rows || rows.length === 0) {
              reject(new Error("No data found in Excel file"));
              return;
            }
            
            // Get the first row
            const rowData = rows[0];
            resolve(rowData);
          } catch (error) {
            reject(new Error("Failed to parse Excel file: " + error.message));
          }
        };
        reader.onerror = () => reject(new Error("Failed to read file"));
        reader.readAsBinaryString(file);
      });
    }

    function mapExcelDataToForm(excelData) {
      // Mapping of Excel column headers to form field IDs
      const columnMapping = {
        'Full Name': 'cp-name',
        'Name': 'cp-name',
        'Age': 'cp-age',
        'Contact Number': 'cp-contact',
        'Contact': 'cp-contact',
        'Email Address': 'cp-email',
        'Email': 'cp-email',
        'Meet-up Date': 'cp-meetup-date',
        'Meeting Date': 'cp-meetup-date',
        'Date': 'cp-meetup-date',
        'Meeting Type': 'cp-meeting-type',
        'Type': 'cp-meeting-type',
        'Location': 'cp-location',
        'Urgency': 'cp-urgency',
        'Stage': 'cp-stage',
        'Pipeline Stage': 'cp-stage',
        'Occupation': 'cp-occupation',
        'Job Title': 'cp-occupation',
        'Monthly Income': 'cp-income',
        'Income': 'cp-income',
        'General Expense': 'cp-general-expense',
        'Expense': 'cp-general-expense',
        'Surplus': 'cp-surplus',
        'CPF OA Balance': 'cp-cpf-oa',
        'CPF OA': 'cp-cpf-oa',
        'CPF SA Balance': 'cp-cpf-sa',
        'CPF SA': 'cp-cpf-sa',
        'General Plan Type': 'cp-general-plan-type',
        'Plan Category': 'cp-general-plan-type',
        'Specific Plan Type': 'cp-plan-type',
        'Plan Type': 'cp-plan-type',
        'Product': 'cp-plan-type',
        'Currency': 'cp-currency',
        'Sum Assured': 'cp-sum-assured',
        'Coverage Amount': 'cp-sum-assured',
        'Premium': 'cp-premium',
        'Premium (Yearly)': 'cp-premium',
        'Annual Premium': 'cp-premium',
        'Commission Rate': 'cp-commission-rate',
        'Referred By': 'cp-referred',
        'Referrer': 'cp-referred',
        'Existing Plans': 'existing-plans-list',
        'Plans': 'existing-plans-list',
        'Remarks': 'cp-remarks',
        'Notes': 'cp-remarks'
      };

      const fillCount = {count: 0};

      // Iterate through Excel data and map to form fields
      for (const [excelHeader, value] of Object.entries(excelData)) {
        const fieldId = columnMapping[excelHeader];
        
        if (!fieldId || !value) continue;

        try {
          const element = document.getElementById(fieldId);
          if (!element) continue;

          // Special handling for existing plans
          if (fieldId === 'existing-plans-list') {
            const plansArray = String(value)
              .split(/\r?\n|,|;/)
              .map(p => p.trim())
              .filter(p => p.length > 0);
            if (plansArray.length > 0) {
              renderPlanInputs(plansArray);
              fillCount.count++;
            }
          } else {
            element.value = String(value).trim();
            fillCount.count++;
          }
        } catch (err) {
          console.warn(`Could not fill field ${fieldId}:`, err);
        }
      }

      // Recalculate commission if premium and rate are filled
      setTimeout(() => {
        calculateCommissionAmount();
      }, 100);

      return fillCount.count;
    }

    // Dropzone event handlers
    const dropzone = document.getElementById('excel-dropzone');
    const fileInput = document.getElementById('excel-upload-input');
    const uploadSuccess = document.getElementById('upload-success');
    const uploadError = document.getElementById('upload-error');

    if (dropzone && fileInput) {
      dropzone.addEventListener('click', () => fileInput.click());

      dropzone.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.stopPropagation();
        dropzone.classList.add('active');
      });

      dropzone.addEventListener('dragleave', () => {
        dropzone.classList.remove('active');
      });

      dropzone.addEventListener('drop', (e) => {
        e.preventDefault();
        e.stopPropagation();
        dropzone.classList.remove('active');
        
        const files = e.dataTransfer.files;
        if (files.length > 0) {
          handleFileUpload(files[0]);
        }
      });

      fileInput.addEventListener('change', (e) => {
        if (e.target.files.length > 0) {
          handleFileUpload(e.target.files[0]);
        }
      });
    }

    function handleFileUpload(file) {
      // Validate file type
      const validTypes = ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/vnd.ms-excel'];
      if (!validTypes.includes(file.type)) {
        showUploadError('Invalid file type. Please upload an Excel file (.xlsx or .xls)');
        return;
      }

      // Parse Excel and populate form
      parseExcelFile(file)
        .then((excelData) => {
          const fieldsCount = mapExcelDataToForm(excelData);
          if (fieldsCount > 0) {
            showUploadSuccess(`Successfully imported ${fieldsCount} fields from Excel!`);
            // Scroll to first form field
            const firstField = document.getElementById('cp-name');
            if (firstField) {
              setTimeout(() => {
                firstField.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
              }, 300);
            }
          } else {
            showUploadError('No matching fields found in Excel file.');
          }
        })
        .catch((error) => {
          showUploadError(error.message);
        });
    }

    function showUploadSuccess(message) {
      if (uploadSuccess) {
        uploadSuccess.textContent = '✓ ' + message;
        uploadSuccess.style.display = 'block';
        setTimeout(() => {
          uploadSuccess.style.display = 'none';
        }, 4000);
      }
    }

    function showUploadError(message) {
      if (uploadError) {
        uploadError.textContent = '✗ ' + message;
        uploadError.style.display = 'block';
        setTimeout(() => {
          uploadError.style.display = 'none';
        }, 4000);
      }
    }

    function getCustomLeads() {
      try { return JSON.parse(localStorage.getItem(LEADS_STORAGE_KEY)) || []; }
      catch { return []; }
    }

    const params = new URLSearchParams(location.search);
    const editId = params.get("edit") ? Number(params.get("edit")) : null;
    const editingLead = editId ? getCustomLeads().find((l) => l.id === editId) : null;
    const returnUrl = editId ? `client-profile.html?id=${editId}` : "leads.html";

    const initialPlans = editingLead
      ? normalizePlans(editingLead.existingPlansList && editingLead.existingPlansList.length ? editingLead.existingPlansList : editingLead.existingPlans)
      : [""];
    renderPlanInputs(initialPlans);

    document.getElementById("add-existing-plan-btn").addEventListener("click", () => {
      const currentPlans = collectPlanInputs();
      currentPlans.push("");
      renderPlanInputs(currentPlans);
      const inputs = document.querySelectorAll(".existing-plan-input");
      const lastInput = inputs[inputs.length - 1];
      if (lastInput) lastInput.focus();
    });

    if (editingLead) {
      document.getElementById("page-heading").textContent = "Edit Lead Profile";
      document.getElementById("submit-btn").textContent = "Update Profile";
      document.getElementById("cp-name").value = editingLead.name;
      document.getElementById("cp-age").value = editingLead.age;
      document.getElementById("cp-contact").value = cleanContact(editingLead.contact);
      document.getElementById("cp-email").value = editingLead.email || "";
      document.getElementById("cp-meetup-date").value = editingLead.meetDate;
      document.getElementById("cp-meeting-type").value = editingLead.meetType;
      document.getElementById("cp-location").value = editingLead.location;
      document.getElementById("cp-urgency").value = editingLead.urgency;
      document.getElementById("cp-stage").value = editingLead.stage;
      document.getElementById("cp-occupation").value = editingLead.occupation || "";
      document.getElementById("cp-income").value = editingLead.income || "";
      document.getElementById("cp-general-expense").value = editingLead.generalExpense || "";
      document.getElementById("cp-surplus").value = editingLead.surplus || "";
      document.getElementById("cp-cpf-oa").value = editingLead.cpfOA || "";
      document.getElementById("cp-cpf-sa").value = editingLead.cpfSA || "";
      document.getElementById("cp-currency").value = editingLead.currency || "SGD";
      document.getElementById("cp-general-plan-type").value = editingLead.generalPlanType || "";
      document.getElementById("cp-plan-type").value = editingLead.specificPlanType || editingLead.planType || "";
      document.getElementById("cp-sum-assured").value = editingLead.sumAssured || "";
      document.getElementById("cp-premium").value = editingLead.premium;
      document.getElementById("cp-commission-rate").value = editingLead.commissionRate ?? "";
      document.getElementById("cp-commission-amount").value = formatCurrencyAmount(
        editingLead.commissionAmount ?? (Number(editingLead.premium || 0) * Number(editingLead.commissionRate || 0) / 100)
      );
      document.getElementById("cp-referred").value = editingLead.referredBy || "";
      document.getElementById("cp-remarks").value = editingLead.remarks;
    }

    document.getElementById("cp-premium").addEventListener("input", calculateCommissionAmount);
    document.getElementById("cp-commission-rate").addEventListener("input", calculateCommissionAmount);
    bindContactCleaner(document.getElementById("cp-contact"));
    calculateCommissionAmount();

    document.getElementById("cancel-link").href = returnUrl;

    document.getElementById("create-profile-form").addEventListener("submit", function (e) {
      e.preventDefault();
      const err = document.getElementById("form-error");
      err.textContent = "";

      const name = document.getElementById("cp-name").value.trim();
      const age = parseInt(document.getElementById("cp-age").value, 10);
      const contact = cleanContact(document.getElementById("cp-contact").value);
      document.getElementById("cp-contact").value = contact;
      const email = document.getElementById("cp-email").value.trim();
      const meetDate = document.getElementById("cp-meetup-date").value;

      if (!name || !contact || !email || !meetDate || isNaN(age)) {
        err.textContent = "Please fill in all required fields.";
        return;
      }

      // Enforce 8-digit contact starting with 8 or 9
      var contactRe = /^[89][0-9]{7}$/;
      if (!contactRe.test(contact)) {
        err.textContent = "Contact must be 8 digits and start with 8 or 9.";
        return;
      }

      const existingPlansList = collectPlanInputs();
      const specificPlanType = document.getElementById("cp-plan-type").value.trim();

      const updated = {
        id: editId || Date.now(),
        name, age,
        contact,
        email,
        meetDate,
        location: document.getElementById("cp-location").value.trim(),
        meetType: document.getElementById("cp-meeting-type").value,
        urgency: document.getElementById("cp-urgency").value,
        stage: document.getElementById("cp-stage").value,
        occupation: document.getElementById("cp-occupation").value.trim(),
        income: document.getElementById("cp-income").value.trim(),
        generalExpense: document.getElementById("cp-general-expense").value.trim(),
        surplus: document.getElementById("cp-surplus").value.trim(),
        cpfOA: parseInt(document.getElementById("cp-cpf-oa").value, 10) || 0,
        cpfSA: parseInt(document.getElementById("cp-cpf-sa").value, 10) || 0,
        currency: document.getElementById("cp-currency").value || "SGD",
        generalPlanType: document.getElementById("cp-general-plan-type").value.trim(),
        specificPlanType,
        planType: specificPlanType,
        sumAssured: parseInt(document.getElementById("cp-sum-assured").value, 10) || 0,
        premium: parseInt(document.getElementById("cp-premium").value, 10) || 0,
        commissionRate: parseFloat(document.getElementById("cp-commission-rate").value) || 0,
        commissionAmount: calculateCommissionAmount(),
        referredBy: document.getElementById("cp-referred").value.trim(),
        existingPlansList,
        existingPlans: existingPlansList.join(", "),
        remarks: document.getElementById("cp-remarks").value.trim(),
        owner: "agent",
        followUps: editingLead ? editingLead.followUps : [
          {label:"Lead Created", date: new Date().toISOString().split('T')[0], done:true}
        ]
      };

      const leads = getCustomLeads();
      if (editId) {
        const idx = leads.findIndex((l) => l.id === editId);
        if (idx !== -1) leads[idx] = updated; else leads.push(updated);
      } else {
        leads.push(updated);
      }
      localStorage.setItem(LEADS_STORAGE_KEY, JSON.stringify(leads));

      const successMsg = document.getElementById("form-success");
      successMsg.textContent = editId ? "Profile updated! Redirecting…" : "Profile saved! Redirecting…";
      successMsg.style.display = "block";
      setTimeout(() => { window.location.href = returnUrl; }, 1200);
    });
