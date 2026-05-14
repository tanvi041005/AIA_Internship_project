const API_BASE = 'https://afhnacykc0.execute-api.ap-southeast-1.amazonaws.com';

async function apiGet(path) {
  const res = await fetch(API_BASE + path);
  if (!res.ok) throw new Error('API ' + res.status + ': GET ' + path);
  return res.json();
}

async function apiPost(path, data) {
  const res = await fetch(API_BASE + path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('API ' + res.status + ': POST ' + path);
  return res.json();
}

async function apiPut(path, data) {
  const res = await fetch(API_BASE + path, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('API ' + res.status + ': PUT ' + path);
  return res.json();
}

async function apiDelete(path) {
  const res = await fetch(API_BASE + path, { method: 'DELETE' });
  if (!res.ok) throw new Error('API ' + res.status + ': DELETE ' + path);
  return res.json();
}

// ── Field mappers (DB snake_case → JS camelCase) ──────────────────────────────
//
// Every main table has an `extra JSON` column for dynamic fields (anything
// uploaded via Excel/CSV that doesn't match a fixed column). Each mapper
// spreads `extra` first, then lets fixed columns override — so future fields
// surface automatically without code changes.

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
    date:          r.booking_date,
    start:         (r.start_time || '').slice(0, 5),
    end:           (r.end_time   || '').slice(0, 5),
    by:            r.booked_by_name || '',
    notes:         r.notes || '',
    recurrence:    r.recurrence || 'none',
    recurrenceEnd: r.recurrence_end || '',
  });
}
