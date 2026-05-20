const API_BASE = 'https://afhnacykc0.execute-api.ap-southeast-1.amazonaws.com';

function isPublicApiPath(path) {
  return path === '/auth/login' || path === '/api/auth/login' || path === '/health' || path === '/api/health';
}

function requireApiToken(path) {
  const token = sessionStorage.getItem('dashboardToken');
  if (token || isPublicApiPath(path)) return token;

  const currentPage = (window.location.pathname.split('/').pop() || 'index.html').toLowerCase();
  const nextPath = currentPage + (window.location.search || '');
  sessionStorage.removeItem('dashboardRole');
  sessionStorage.removeItem('dashboardUser');
  sessionStorage.removeItem('dashboardToken');
  if (currentPage !== 'login.html') {
    window.location.replace('login.html?next=' + encodeURIComponent(nextPath));
  }
  throw new Error('Login required before calling ' + path);
}

function apiHeaders(path, includeJson) {
  const headers = includeJson ? { 'Content-Type': 'application/json' } : {};
  const token = requireApiToken(path);
  if (token && !isPublicApiPath(path)) {
    headers.Authorization = 'Bearer ' + token;
  }
  return headers;
}

async function handleApiResponse(res, method, path) {
  if (res.status === 401) {
    sessionStorage.removeItem('dashboardToken');
    sessionStorage.removeItem('dashboardRole');
    sessionStorage.removeItem('dashboardUser');
  }
  if (!res.ok) throw new Error('API ' + res.status + ': ' + method + ' ' + path);
  return res.json();
}

async function apiGet(path) {
  const res = await fetch(API_BASE + path, { headers: apiHeaders(path, false) });
  return handleApiResponse(res, 'GET', path);
}

async function apiPost(path, data) {
  const res = await fetch(API_BASE + path, {
    method: 'POST',
    headers: apiHeaders(path, true),
    body: JSON.stringify(data),
  });
  return handleApiResponse(res, 'POST', path);
}

async function apiPut(path, data) {
  const res = await fetch(API_BASE + path, {
    method: 'PUT',
    headers: apiHeaders(path, true),
    body: JSON.stringify(data),
  });
  return handleApiResponse(res, 'PUT', path);
}

async function apiDelete(path) {
  const res = await fetch(API_BASE + path, { method: 'DELETE', headers: apiHeaders(path, false) });
  return handleApiResponse(res, 'DELETE', path);
}

// ── Field mappers (DB snake_case → JS camelCase) ──────────────────────────────
//
// Every main table has an `extra JSON` column for dynamic fields (anything
// uploaded via Excel/CSV that doesn't match a fixed column). Each mapper
// spreads `extra` first, then lets fixed columns override — so future fields
// surface automatically without code changes.

// Convert any date value (ISO string, Date object, "YYYY-MM-DD") to a
// Singapore-local YYYY-MM-DD string.  This handles the mysql2 behaviour where
// a DATE column can arrive as "2026-05-14T16:00:00.000Z" (UTC midnight that is
// actually 2026-05-15 00:00 SGT) and .slice(0,10) would give the wrong day.
function toSGDate(raw) {
  if (raw == null || raw === '') return '';
  var s = raw instanceof Date ? raw.toISOString() : String(raw);
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;  // already "YYYY-MM-DD"
  try {
    return new Date(s).toLocaleDateString('en-CA', { timeZone: 'Asia/Singapore' });
  } catch (e) {
    return s.slice(0, 10);
  }
}

function parseExtra(r) {
  if (!r || !r.extra) return {};
  if (typeof r.extra === 'string') {
    try { return JSON.parse(r.extra) || {}; } catch (e) { return {}; }
  }
  return r.extra;
}

/** Calendar YYYY-MM-DD in local TZ (matches HTML date inputs & weekly grid). */
function ymdLocalDate(value) {
  if (value == null || value === '') return '';
  var d = new Date(value);
  if (isNaN(d.getTime())) {
    var m = String(value).match(/^(\d{4}-\d{2}-\d{2})/);
    return m ? m[1] : '';
  }
  var y = d.getFullYear();
  var mo = String(d.getMonth() + 1);
  if (mo.length === 1) mo = '0' + mo;
  var da = String(d.getDate());
  if (da.length === 1) da = '0' + da;
  return y + '-' + mo + '-' + da;
}

function mapLead(r) {
  var extra = parseExtra(r);
  return Object.assign({}, extra, {
    id:               r.lead_id,
    name:             r.name,
    age:              r.age,
    contact:          r.contact,
    email:            r.email,
    meetDate:         r.meet_date,
    location:         r.location,
    meetType:         r.meet_type,
    urgency:          r.urgency,
    stage:            r.stage,
    remarks:          r.remarks,
    planType:         r.plan_type || extra.specificPlanType || extra.generalPlanType || '',
    specificPlanType: extra.specificPlanType || r.plan_type || '',
    generalPlanType:  extra.generalPlanType || '',
    premium:          Number(r.annual_premium || 0),
    commission:       r.commission_type || '',
    commissionRate:   extra.commissionRate,
    commissionAmount: extra.commissionAmount,
    cpfOA:            Number(r.cpf_oa || 0),
    cpfSA:            Number(r.cpf_sa || 0),
    cpfMA:            Number(r.cpf_ma || 0),
    bankBalance:      Number(r.bank_balance || 0),
    occupation:       r.occupation || '',
    income:           r.income || '',
    generalExpense:   extra.generalExpense || '',
    surplus:          extra.surplus || '',
    existingPlans:    extra.existingPlans || '',
    referredBy:       r.referred_by || '',
    ownerId:          r.owner_id,
    currency:         extra.currency === 'USD' ? 'USD' : 'SGD',
    sumAssured:       Number(extra.sumAssured || 0),
    agency:           extra.agency || '',
    followUps: (r.follow_ups || []).map(function(f) {
      return { label: f.label, date: f.scheduled_date, done: !!f.is_done };
    }),
  });
}

function mapAnnouncement(r) {
  var extra = parseExtra(r);
  return Object.assign({}, extra, {
    id:           r.announcement_id,
    title:        r.title,
    category:     r.category,
    message:      r.message,
    responseType: r.response_type,
    createdBy:    r.created_by,
    createdAt:    r.created_at,
  });
}

function mapSalesEntry(r, activityTypes) {
  var extra = parseExtra(r);
  var type = (activityTypes || []).find(function(t) { return t.id === r.activity_type_id; });
  var labelFromJoin = r.activity_label != null ? r.activity_label : null;
  var pointsFromJoin = r.points != null ? Number(r.points) : null;
  return Object.assign({}, extra, {
    id:            r.entry_id,
    agentId:       r.agent_id,
    date:          ymdLocalDate(r.entry_date),
    activityId:    r.activity_type_id,
    activityLabel: type ? type.label : (labelFromJoin || r.activity_type_id),
    pointValue:    type ? type.points : (pointsFromJoin != null ? pointsFromJoin : 0),
    count:         r.count,
    client:        r.client_name || '-',
    status:        r.status,
    notes:         r.notes || '-',
    createdAt:     r.created_at,
  });
}

function mapBooking(r) {
  var extra = parseExtra(r);
  return Object.assign({}, extra, {
    id:            r.booking_id,
    title:         r.title,
    room:          r.room_id,
    date:          toSGDate(r.booking_date),
    start:         (r.start_time || '').slice(0, 5),
    end:           (r.end_time   || '').slice(0, 5),
    by:            r.booked_by_name || '',
    notes:         r.notes || '',
    recurrence:    r.recurrence || 'none',
    recurrenceEnd: r.recurrence_end || '',
    recurrenceId:  r.recurrence_id  || '',
  });
}

function mapCalendarEvent(r) {
  var extra = parseExtra(r);
  return Object.assign({}, extra, {
    // Accept both raw DB snake_case and pre-mapped camelCase from Lambda
    id:           r.event_id         || r.id,
    title:        r.title,
    date:         toSGDate(r.event_date != null ? r.event_date : r.date),
    startTime:    (r.start_time || r.startTime || '').slice(0, 5),
    endTime:      (r.end_time   || r.endTime   || '').slice(0, 5),
    location:     r.location                   || '',
    type:         r.event_type  || r.type      || '',
    category:     r.category,
    notes:        r.notes                      || '',
    recurrenceId: r.recurrence_id  || r.recurrenceId  || '',
    taskId:       r.linked_task_id || r.taskId || '',
    editable:     r.is_editable !== false,
  });
}

function mapPersonalTask(r) {
  var extra = parseExtra(r);
  return Object.assign({}, extra, {
    // Accept both raw DB snake_case and pre-mapped camelCase from Lambda
    id:         r.task_id  || r.id,
    title:      r.title,
    done:       !!(r.is_done || r.done),
    source:     r.source                      || 'manual',
    dueDate:    toSGDate(r.due_date != null ? r.due_date : r.dueDate),
    eventTitle: r.linked_event_title || r.eventTitle || '',
  });
}
