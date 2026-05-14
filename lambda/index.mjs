// index.mjs
import mysql from "mysql2/promise";
import bcrypt from "bcryptjs";

// ─── DB pool (reused across warm invocations) ────────────────────────────────

const pool = mysql.createPool({
  host:     process.env.DB_HOST,
  user:     process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
  
});

// ─── CORS / response helpers ─────────────────────────────────────────────────

const CORS = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type,Authorization",
};

function res(statusCode, body, extra = {}) {
  return {
    statusCode,
    headers: { "Content-Type": "application/json", ...CORS, ...extra },
    body: JSON.stringify(body),
  };
}
const ok       = (b) => res(200, b);
const created  = (b) => res(201, b);
const bad      = (m) => res(400, { error: m });
const unauth   = (m) => res(401, { error: m });
const notFound = (m) => res(404, { error: m });
const fail     = (m) => res(500, { error: m });

// ─── Request helpers ─────────────────────────────────────────────────────────

function parseBody(event) {
  if (!event.body) return {};
  try {
    const raw = event.isBase64Encoded
      ? Buffer.from(event.body, "base64").toString()
      : event.body;
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

function getPath(event) {
  const raw = event.rawPath || event.path || "/";
  return raw.replace(/^\/(prod|dev|staging)(?=\/|$)/, "") || "/";
}

function getMethod(event) {
  return (
    event.requestContext?.http?.method ||
    event.httpMethod ||
    "GET"
  ).toUpperCase();
}

function qs(event) {
  return event.queryStringParameters || {};
}

// ─── Main handler ─────────────────────────────────────────────────────────────

export const handler = async (event) => {
  const method = getMethod(event);
  const path   = getPath(event);
  const query  = qs(event);

  if (method === "OPTIONS") {
    return { statusCode: 204, headers: CORS, body: "" };
  }

  try {
    // ── Health ──────────────────────────────────────────────────────────────
    if (method === "GET" && (path === "/health" || path === "/api/health")) {
      return ok({ ok: true });
    }

    // ────────────────────────────────────────────────────────────────────────
    // AUTH
    // ────────────────────────────────────────────────────────────────────────
    if (method === "POST" && (path === "/auth/login" || path === "/api/auth/login")) {
      const { userId, user_id, password } = parseBody(event);
      const uid = String(userId || user_id || "").trim().toUpperCase();
      if (!uid || !password) return bad("userId and password required");

      const [rows] = await pool.query(
        `SELECT u.user_id, u.full_name, u.password_hash, u.role_id, r.role_key
         FROM users u
         JOIN roles r ON r.role_id = u.role_id
         WHERE u.user_id = ? AND u.is_active = 1`,
        [uid]
      );
      if (!rows.length) return unauth("Invalid User ID or password");

      const user  = rows[0];
      const match = await bcrypt.compare(password, user.password_hash);
      if (!match) return unauth("Invalid User ID or password");

      return ok({
        userId:    user.user_id,
        user_id:   user.user_id,
        fullName:  user.full_name,
        full_name: user.full_name,
        role:      user.role_key,
        roleId:    user.role_id,
        role_id:   user.role_id,
        token: Buffer.from(`${user.user_id}:${Date.now()}`).toString("base64"),
      });
    }

    // ────────────────────────────────────────────────────────────────────────
    // USERS
    // ────────────────────────────────────────────────────────────────────────
    if (method === "GET" && path === "/users") {
      const { role } = query;
      let sql = `SELECT u.user_id, u.full_name, u.role_id, r.role_key AS role
                 FROM users u JOIN roles r ON r.role_id = u.role_id
                 WHERE u.is_active = 1`;
      const params = [];
      if (role) { sql += " AND r.role_key = ?"; params.push(role); }
      sql += " ORDER BY u.user_id";
      const [rows] = await pool.query(sql, params);
      return ok(rows);
    }

    // ────────────────────────────────────────────────────────────────────────
    // LEADS
    // ────────────────────────────────────────────────────────────────────────
    if (method === "GET" && path === "/leads") {
      const { userId } = query;
      let sql = "SELECT * FROM leads WHERE 1=1";
      const params = [];
      if (userId) { sql += " AND owner_id = ?"; params.push(userId); }
      sql += " ORDER BY created_at DESC";

      const [leads] = await pool.query(sql, params);
      if (!leads.length) return ok([]);

      const leadIds = leads.map((l) => l.lead_id);
      const [fups] = await pool.query(
        "SELECT * FROM follow_ups WHERE lead_id IN (?) ORDER BY scheduled_date",
        [leadIds]
      );
      return ok(
        leads.map((l) => ({
          ...l,
          followUps: fups.filter((f) => f.lead_id === l.lead_id),
        }))
      );
    }

    const leadSingle = path.match(/^\/leads\/(\d+)$/);
    if (leadSingle) {
      const leadId = Number(leadSingle[1]);

      if (method === "GET") {
        const [[lead]] = await pool.query("SELECT * FROM leads WHERE lead_id = ?", [leadId]);
        if (!lead) return notFound("Lead not found");
        const [fups] = await pool.query(
          "SELECT * FROM follow_ups WHERE lead_id = ? ORDER BY scheduled_date",
          [leadId]
        );
        return ok({ ...lead, followUps: fups });
      }

      if (method === "PUT") {
        const b = parseBody(event);
        const extra = b.extra != null ? JSON.stringify(b.extra) : null;
        await pool.query(
          `UPDATE leads SET
             name            = COALESCE(?, name),
             age             = COALESCE(?, age),
             contact         = COALESCE(?, contact),
             email           = COALESCE(?, email),
             meet_date       = COALESCE(?, meet_date),
             location        = COALESCE(?, location),
             meet_type       = COALESCE(?, meet_type),
             urgency         = COALESCE(?, urgency),
             stage           = COALESCE(?, stage),
             remarks         = COALESCE(?, remarks),
             plan_type       = COALESCE(?, plan_type),
             annual_premium  = COALESCE(?, annual_premium),
             commission_type = COALESCE(?, commission_type),
             cpf_oa          = COALESCE(?, cpf_oa),
             cpf_sa          = COALESCE(?, cpf_sa),
             occupation      = COALESCE(?, occupation),
             income          = COALESCE(?, income),
             referred_by     = COALESCE(?, referred_by),
             extra           = COALESCE(?, extra)
           WHERE lead_id = ?`,
          [
            b.name, b.age, b.contact, b.email, b.meet_date, b.location,
            b.meet_type, b.urgency, b.stage, b.remarks, b.plan_type,
            b.annual_premium, b.commission_type, b.cpf_oa, b.cpf_sa,
            b.occupation, b.income, b.referred_by, extra, leadId,
          ]
        );
        if (Array.isArray(b.followUps)) {
          await pool.query("DELETE FROM follow_ups WHERE lead_id = ?", [leadId]);
          if (b.followUps.length) {
            const vals = b.followUps.map((f) => [
              leadId, f.label, f.scheduled_date || null, f.is_done ? 1 : 0,
            ]);
            await pool.query(
              "INSERT INTO follow_ups (lead_id, label, scheduled_date, is_done) VALUES ?",
              [vals]
            );
          }
        }
        return ok({ updated: leadId });
      }

      if (method === "DELETE") {
        await pool.query("DELETE FROM leads WHERE lead_id = ?", [leadId]);
        return ok({ deleted: leadId });
      }
    }

    if (method === "POST" && path === "/leads") {
      const b = parseBody(event);
      if (!b.name || !b.owner_id) return bad("name and owner_id required");
      const extra = b.extra ? JSON.stringify(b.extra) : "{}";
      const [result] = await pool.query(
        `INSERT INTO leads
           (name, age, contact, email, meet_date, location, meet_type, urgency,
            stage, remarks, plan_type, annual_premium, commission_type, cpf_oa,
            cpf_sa, occupation, income, referred_by, owner_id, extra)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        [
          b.name, b.age || null, b.contact || null, b.email || null,
          b.meet_date || null, b.location || null, b.meet_type || null,
          b.urgency || "non-urgent", b.stage || "Prospecting",
          b.remarks || null, b.plan_type || null, b.annual_premium || null,
          b.commission_type || null, b.cpf_oa || null, b.cpf_sa || null,
          b.occupation || null, b.income || null, b.referred_by || null,
          b.owner_id, extra,
        ]
      );
      const newId = result.insertId;
      if (Array.isArray(b.followUps) && b.followUps.length) {
        const vals = b.followUps.map((f) => [
          newId, f.label, f.scheduled_date || null, f.is_done ? 1 : 0,
        ]);
        await pool.query(
          "INSERT INTO follow_ups (lead_id, label, scheduled_date, is_done) VALUES ?",
          [vals]
        );
      }
      return created({ lead_id: newId });
    }

    // ────────────────────────────────────────────────────────────────────────
    // CALENDAR EVENTS
    // ────────────────────────────────────────────────────────────────────────
    if (method === "GET" && path === "/events") {
      const { category, userId } = query;
      let sql = "SELECT * FROM calendar_events WHERE 1=1";
      const params = [];
      if (category) { sql += " AND category = ?";    params.push(category); }
      if (userId)   { sql += " AND created_by = ?";  params.push(userId); }
      sql += " ORDER BY event_date ASC, start_time ASC";
      const [rows] = await pool.query(sql, params);
      return ok(rows);
    }

    if (method === "POST" && path === "/events") {
      const b = parseBody(event);
      if (!b.title || !b.event_date) return bad("title and event_date required");
      const eventId = b.client_ref_id || b.event_id || `ev-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
      await pool.query(
        `INSERT INTO calendar_events
           (event_id, title, event_date, start_time, end_time, location,
            event_type, category, notes, recurrence_id, created_by)
         VALUES (?,?,?,?,?,?,?,?,?,?,?)
         ON DUPLICATE KEY UPDATE
           title      = VALUES(title),
           event_date = VALUES(event_date),
           start_time = VALUES(start_time),
           end_time   = VALUES(end_time),
           location   = VALUES(location),
           event_type = VALUES(event_type),
           notes      = VALUES(notes)`,
        [
          eventId, b.title, b.event_date,
          b.start_time || null, b.end_time || null,
          b.location   || null, b.event_type || null,
          b.category   || "personal",
          b.notes      || null,
          b.recurrence_id || null,
          b.user_id || b.created_by || null,
        ]
      );
      return created({ event_id: eventId });
    }

    // DELETE /events?recurrenceId=... — delete an entire recurring series
    if (method === "DELETE" && path === "/events") {
      const recurrenceId = query.recurrenceId;
      if (!recurrenceId) return bad("recurrenceId required");
      await pool.query(
        "DELETE FROM calendar_events WHERE recurrence_id = ?",
        [recurrenceId]
      );
      return ok({ deletedSeries: recurrenceId });
    }

    const eventSingle = path.match(/^\/events\/([^/]+)$/);
    if (eventSingle) {
      const eventId = decodeURIComponent(eventSingle[1]);

      if (method === "PUT") {
        const b = parseBody(event);
        await pool.query(
          `UPDATE calendar_events SET
             title      = COALESCE(?, title),
             event_date = COALESCE(?, event_date),
             start_time = ?,
             end_time   = ?,
             location   = ?,
             event_type = COALESCE(?, event_type),
             notes      = COALESCE(?, notes)
           WHERE event_id = ?`,
          [
            b.title || null, b.event_date || null,
            b.start_time ?? null, b.end_time ?? null, b.location ?? null,
            b.event_type || null, b.notes || null,
            eventId,
          ]
        );
        return ok({ updated: eventId });
      }

      if (method === "DELETE") {
        await pool.query("DELETE FROM calendar_events WHERE event_id = ?", [eventId]);
        return ok({ deleted: eventId });
      }
    }

    if (method === "POST" && path === "/events/bulk") {
      const b   = parseBody(event);
      const evs = Array.isArray(b.events) ? b.events : [];
      if (!evs.length) return ok({ inserted: 0 });
      const cat    = b.category || "personal";
      const userId = b.userId   || null;
      const vals   = evs.map((e) => [
        e.id || e.event_id || `ev-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
        e.title,
        e.date || e.event_date,
        e.startTime  || e.start_time  || null,
        e.endTime    || e.end_time    || null,
        e.location   || null,
        e.type       || e.event_type  || null,
        cat,
        e.notes      || null,
        e.recurrenceId || e.recurrence_id || null,
        e.createdBy  || userId,
      ]);
      await pool.query(
        `INSERT INTO calendar_events
           (event_id, title, event_date, start_time, end_time, location,
            event_type, category, notes, recurrence_id, created_by)
         VALUES ?
         ON DUPLICATE KEY UPDATE title = VALUES(title)`,
        [vals]
      );
      return ok({ inserted: vals.length });
    }

    // ────────────────────────────────────────────────────────────────────────
    // PERSONAL TASKS
    // ────────────────────────────────────────────────────────────────────────
    if (method === "GET" && path === "/tasks") {
      const { userId } = query;
      let sql = "SELECT * FROM personal_tasks WHERE 1=1";
      const params = [];
      if (userId) { sql += " AND user_id = ?"; params.push(userId); }
      sql += " ORDER BY created_at DESC";
      const [rows] = await pool.query(sql, params);
      return ok(rows);
    }

    if (method === "POST" && path === "/tasks") {
      const b = parseBody(event);
      if (!b.title || !b.user_id) return bad("title and user_id required");
      const taskId = b.client_ref_id || b.task_id || `task-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
      await pool.query(
        `INSERT INTO personal_tasks
           (task_id, user_id, title, due_date, source, linked_event_title)
         VALUES (?,?,?,?,?,?)
         ON DUPLICATE KEY UPDATE
           title              = VALUES(title),
           due_date           = VALUES(due_date),
           linked_event_title = VALUES(linked_event_title)`,
        [
          taskId, b.user_id, b.title,
          b.due_date    || null,
          b.source      || "manual",
          b.event_title || null,
        ]
      );
      return created({ task_id: taskId });
    }

    const taskSingle = path.match(/^\/tasks\/([^/]+)$/);
    if (taskSingle) {
      const taskId = decodeURIComponent(taskSingle[1]);

      if (method === "PUT") {
        const b = parseBody(event);
        await pool.query(
          `UPDATE personal_tasks SET
             title    = COALESCE(?, title),
             due_date = COALESCE(?, due_date),
             is_done  = COALESCE(?, is_done)
           WHERE task_id = ?`,
          [b.title || null, b.due_date || null, b.is_done ?? null, taskId]
        );
        return ok({ updated: taskId });
      }

      if (method === "DELETE") {
        await pool.query("DELETE FROM personal_tasks WHERE task_id = ?", [taskId]);
        return ok({ deleted: taskId });
      }
    }

    if (method === "POST" && path === "/tasks/bulk") {
      const b      = parseBody(event);
      const tasks  = Array.isArray(b.tasks) ? b.tasks : [];
      const userId = b.userId || null;
      if (!tasks.length || !userId) return ok({ inserted: 0 });
      const vals = tasks.map((t) => [
        t.id || `task-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        userId, t.title,
        t.dueDate || t.due_date || null,
        t.source  || "manual",
        t.eventTitle || null,
        t.done ? 1 : 0,
      ]);
      await pool.query(
        `INSERT INTO personal_tasks
           (task_id, user_id, title, due_date, source, linked_event_title, is_done)
         VALUES ?
         ON DUPLICATE KEY UPDATE title = VALUES(title), is_done = VALUES(is_done)`,
        [vals]
      );
      return ok({ inserted: vals.length });
    }

    // ────────────────────────────────────────────────────────────────────────
    // AGENT PERFORMANCE
    // ────────────────────────────────────────────────────────────────────────
    if (method === "GET" && path === "/performance") {
      const { year, period, agentId } = query;
      let sql = `SELECT ap.*, u.full_name, r.role_key AS role
                 FROM agent_performance ap
                 JOIN users u ON u.user_id = ap.agent_id
                 JOIN roles r ON r.role_id = u.role_id
                 WHERE 1=1`;
      const params = [];
      if (year)    { sql += " AND ap.period_year = ?";  params.push(Number(year)); }
      if (period)  { sql += " AND ap.period_label = ?"; params.push(period); }
      if (agentId) { sql += " AND ap.agent_id = ?";     params.push(agentId); }
      sql += " ORDER BY ap.district_rank ASC";
      const [rows] = await pool.query(sql, params);
      return ok(rows);
    }

    // ────────────────────────────────────────────────────────────────────────
    // CPF TRACKER
    // ────────────────────────────────────────────────────────────────────────
    if (method === "GET" && path === "/cpf") {
      const { agentId } = query;
      let sql = "SELECT * FROM cpf_tracker_entries WHERE 1=1";
      const params = [];
      if (agentId) { sql += " AND agent_id = ?"; params.push(agentId); }
      const [rows] = await pool.query(sql, params);
      return ok(rows);
    }

    // ────────────────────────────────────────────────────────────────────────
    // CPF CONTRIBUTION RATES  (static SG 2024 schedule)
    // ────────────────────────────────────────────────────────────────────────
    if (method === "GET" && path === "/cpf-rates") {
      return ok({
        contributionRates: [
          { ageGroup: "≤55",   employee: 20,  employer: 17,   total: 37   },
          { ageGroup: "55-60", employee: 15,  employer: 14.5, total: 29.5 },
          { ageGroup: "60-65", employee: 9.5, employer: 11,   total: 20.5 },
          { ageGroup: "65-70", employee: 7,   employer: 8.5,  total: 15.5 },
          { ageGroup: ">70",   employee: 5,   employer: 7.5,  total: 12.5 },
        ],
        allocationRates: [
          { ageGroup: "≤35",   oa: 62.17, sa: 16.21, ma: 21.62 },
          { ageGroup: "35-45", oa: 56.76, sa: 18.92, ma: 24.32 },
          { ageGroup: "45-50", oa: 51.35, sa: 21.62, ma: 27.03 },
          { ageGroup: "50-55", oa: 40.54, sa: 27.03, ma: 32.43 },
          { ageGroup: "55-60", oa: 31.08, sa: 14.19, ma: 54.73 },
          { ageGroup: "60-65", oa: 11.65, sa: 3.88,  ma: 84.47 },
          { ageGroup: "65-70", oa: 7.75,  sa: 2.58,  ma: 89.67 },
          { ageGroup: ">70",   oa: 5,     sa: 1.67,  ma: 93.33 },
        ],
        retirementSums: { basic: 106500, full: 213000, enhanced: 426000 },
      });
    }

    // ────────────────────────────────────────────────────────────────────────
    // TRAINING
    // ────────────────────────────────────────────────────────────────────────
    if (method === "GET" && path === "/training/topics") {
      const [topics]    = await pool.query("SELECT * FROM training_topics ORDER BY sort_order");
      const [questions] = await pool.query("SELECT * FROM quiz_questions ORDER BY sort_order");
      const [options]   = await pool.query("SELECT * FROM quiz_options ORDER BY sort_order");
      return ok(
        topics.map((t) => ({
          ...t,
          questions: questions
            .filter((q) => q.topic_id === t.topic_id)
            .map((q) => ({
              ...q,
              options: options.filter((o) => o.question_id === q.question_id),
            })),
        }))
      );
    }

    if (method === "GET" && path === "/training/progress") {
      const { userId } = query;
      if (!userId) return bad("userId required");
      const [rows] = await pool.query(
        "SELECT * FROM training_progress WHERE user_id = ?",
        [userId]
      );
      const out = {};
      rows.forEach((r) => {
        out[r.topic_id] = { video_done: !!r.video_done, quiz_passed: !!r.quiz_passed };
      });
      return ok(out);
    }

    if (method === "POST" && path === "/training/progress") {
      const { userId, progress } = parseBody(event);
      if (!userId || !progress) return bad("userId and progress required");
      for (const [topicId, p] of Object.entries(progress)) {
        await pool.query(
          `INSERT INTO training_progress (user_id, topic_id, video_done, quiz_passed)
           VALUES (?,?,?,?)
           ON DUPLICATE KEY UPDATE
             video_done  = VALUES(video_done),
             quiz_passed = VALUES(quiz_passed)`,
          [userId, topicId, p.video_done ? 1 : 0, p.quiz_passed ? 1 : 0]
        );
      }
      return ok({ saved: true });
    }

    // ────────────────────────────────────────────────────────────────────────
    // TEAM ROSTER
    // ────────────────────────────────────────────────────────────────────────
    const teamMember = path.match(/^\/teams\/([^/]+)\/([^/]+)$/);
    if (teamMember && method === "DELETE") {
      const [, managerId, agentId] = teamMember;
      await pool.query(
        "DELETE FROM team_roster WHERE manager_id = ? AND agent_id = ?",
        [decodeURIComponent(managerId), decodeURIComponent(agentId)]
      );
      return ok({ deleted: true });
    }

    const teamSingle = path.match(/^\/teams\/([^/]+)$/);
    if (teamSingle) {
      const managerId = decodeURIComponent(teamSingle[1]);

      if (method === "GET") {
        const [rows] = await pool.query(
          `SELECT tr.*, u.full_name, r.role_key AS role
           FROM team_roster tr
           JOIN users u ON u.user_id = tr.agent_id
           JOIN roles r ON r.role_id = u.role_id
           WHERE tr.manager_id = ?
           ORDER BY tr.joined_at ASC`,
          [managerId]
        );
        return ok(rows);
      }

      if (method === "POST") {
        const b = parseBody(event);
        if (!b.agentId) return bad("agentId required");
        await pool.query(
          `INSERT IGNORE INTO team_roster (manager_id, agent_id, notes, joined_at)
           VALUES (?,?,?,NOW())`,
          [managerId, String(b.agentId).toUpperCase(), b.notes || null]
        );
        return created({ manager_id: managerId, agent_id: b.agentId });
      }
    }

    // ────────────────────────────────────────────────────────────────────────
    // ANNOUNCEMENTS
    // ────────────────────────────────────────────────────────────────────────
    if (method === "GET" && path === "/announcements") {
      const [rows] = await pool.query("SELECT * FROM announcements ORDER BY created_at DESC");
      return ok(rows);
    }

    if (method === "POST" && path === "/announcements") {
      const b = parseBody(event);
      if (!b.title || !b.message || !b.created_by)
        return bad("title, message, created_by required");
      const id = b.announcement_id || `ann-${Date.now()}`;
      await pool.query(
        `INSERT INTO announcements
           (announcement_id, title, category, message, response_type, created_by, created_at)
         VALUES (?,?,?,?,?,?,NOW())`,
        [id, b.title, b.category || "General", b.message, b.response_type || "acknowledge", b.created_by]
      );
      return created({ announcement_id: id });
    }

    if (method === "GET" && path === "/announcement-responses") {
      const { userId } = query;
      let sql = "SELECT * FROM announcement_responses WHERE 1=1";
      const params = [];
      if (userId) { sql += " AND user_id = ?"; params.push(userId); }
      const [rows] = await pool.query(sql, params);
      return ok(rows);
    }

    const annResp = path.match(/^\/announcements\/([^/]+)\/responses$/);
    if (annResp && method === "POST") {
      const annId = decodeURIComponent(annResp[1]);
      const b = parseBody(event);
      if (!b.user_id || !b.choice) return bad("user_id and choice required");
      await pool.query(
        `INSERT INTO announcement_responses
           (announcement_id, user_id, choice, note, responded_at)
         VALUES (?,?,?,?,NOW())
         ON DUPLICATE KEY UPDATE
           choice       = VALUES(choice),
           note         = VALUES(note),
           responded_at = NOW()`,
        [annId, b.user_id, b.choice, b.note || null]
      );
      return ok({ saved: true });
    }

    // ────────────────────────────────────────────────────────────────────────
    // SALES TRACKER
    // ────────────────────────────────────────────────────────────────────────
    if (method === "GET" && path === "/sales-activity-types") {
      const [rows] = await pool.query("SELECT * FROM activity_types ORDER BY sort_order");
      return ok(rows);
    }

    if (method === "GET" && path === "/sales-settings") {
      const [types] = await pool.query("SELECT * FROM activity_types ORDER BY sort_order");
      return ok({ activityTypes: types, weeklyTarget: 30 });
    }

    if (method === "GET" && path === "/sales-entries") {
      const { agentId } = query;
      let sql = `SELECT se.*, at.label AS activity_label, at.points
                 FROM sales_entries se
                 JOIN activity_types at ON at.activity_type_id = se.activity_type_id
                 WHERE 1=1`;
      const params = [];
      if (agentId) { sql += " AND se.agent_id = ?"; params.push(agentId); }
      sql += " ORDER BY se.entry_date DESC, se.created_at DESC";
      const [rows] = await pool.query(sql, params);
      return ok(rows);
    }

    if (method === "POST" && path === "/sales-entries") {
      const b = parseBody(event);
      if (!b.agent_id || !b.activity_type_id || !b.entry_date)
        return bad("agent_id, activity_type_id, entry_date required");
      const entryId = b.entry_id || `entry-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
      await pool.query(
        `INSERT INTO sales_entries
           (entry_id, agent_id, entry_date, activity_type_id, count,
            client_name, status, notes, created_at)
         VALUES (?,?,?,?,?,?,?,?,NOW())`,
        [
          entryId, b.agent_id, b.entry_date, b.activity_type_id,
          b.count || 1, b.client_name || null, b.status || null, b.notes || null,
        ]
      );
      return created({ entry_id: entryId });
    }

    if (method === "GET" && path === "/sales-reflections") {
      const { agentId } = query;
      let sql = "SELECT * FROM sales_reflections WHERE 1=1";
      const params = [];
      if (agentId) { sql += " AND agent_id = ?"; params.push(agentId); }
      sql += " ORDER BY reflection_date DESC";
      const [rows] = await pool.query(sql, params);
      return ok(rows);
    }

    if (method === "POST" && path === "/sales-reflections") {
      const b = parseBody(event);
      if (!b.agent_id || !b.reflection_date)
        return bad("agent_id and reflection_date required");
      await pool.query(
        `INSERT INTO sales_reflections
           (agent_id, reflection_date, went_well, went_poorly, to_improve)
         VALUES (?,?,?,?,?)
         ON DUPLICATE KEY UPDATE
           went_well   = VALUES(went_well),
           went_poorly = VALUES(went_poorly),
           to_improve  = VALUES(to_improve)`,
        [b.agent_id, b.reflection_date, b.went_well || null, b.went_poorly || null, b.to_improve || null]
      );
      return ok({ saved: true });
    }

    // ────────────────────────────────────────────────────────────────────────
    // ROOMS
    // ────────────────────────────────────────────────────────────────────────
    if (method === "GET" && path === "/rooms") {
      const [rows] = await pool.query("SELECT * FROM rooms WHERE is_active = 1 ORDER BY room_id");
      return ok(rows);
    }

    // ────────────────────────────────────────────────────────────────────────
    // ROOM BOOKINGS
    // ────────────────────────────────────────────────────────────────────────
    if (method === "GET" && path === "/room-bookings") {
      const [rows] = await pool.query(
        "SELECT * FROM room_bookings ORDER BY booking_date, start_time"
      );
      return ok(rows);
    }

    if (method === "POST" && path === "/room-bookings") {
      const b = parseBody(event);
      if (!b.title || !b.room_id || !b.booking_date || !b.start_time || !b.end_time)
        return bad("title, room_id, booking_date, start_time, end_time required");
      const [result] = await pool.query(
        `INSERT INTO room_bookings
           (title, room_id, booking_date, start_time, end_time,
            booked_by_id, booked_by_name, notes, recurrence, recurrence_end, recurrence_id)
         VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
        [
          b.title, b.room_id, b.booking_date, b.start_time, b.end_time,
          b.booked_by_id || null, b.booked_by_name || null, b.notes || null,
          b.recurrence || "none", b.recurrence_end || null, b.recurrence_id || null,
        ]
      );
      return created({ booking_id: result.insertId });
    }

    const bookingSingle = path.match(/^\/room-bookings\/(\d+)$/);
    if (bookingSingle) {
      const bookingId = bookingSingle[1];

      if (method === "PUT") {
        const b = parseBody(event);
        await pool.query(
          `UPDATE room_bookings SET
             title          = COALESCE(?, title),
             room_id        = COALESCE(?, room_id),
             booking_date   = COALESCE(?, booking_date),
             start_time     = COALESCE(?, start_time),
             end_time       = COALESCE(?, end_time),
             booked_by_name = COALESCE(?, booked_by_name),
             notes          = COALESCE(?, notes)
           WHERE booking_id = ?`,
          [
            b.title || null, b.room_id || null,
            b.booking_date || null, b.start_time || null, b.end_time || null,
            b.booked_by_name || null, b.notes || null, bookingId,
          ]
        );
        return ok({ updated: bookingId });
      }

      if (method === "DELETE") {
        await pool.query("DELETE FROM room_bookings WHERE booking_id = ?", [bookingId]);
        return ok({ deleted: bookingId });
      }
    }

    // ────────────────────────────────────────────────────────────────────────
    // ATTENDANCE EVENTS
    // ────────────────────────────────────────────────────────────────────────
    if (method === "GET" && path === "/attendance-events") {
      const [rows] = await pool.query(
        `SELECT * FROM calendar_events
         WHERE attendance_token IS NOT NULL
         ORDER BY event_date DESC`
      );
      return ok(rows);
    }

    if (method === "POST" && path === "/attendance-events") {
      const b = parseBody(event);
      if (!b.title || !b.event_date || !b.id) return bad("id, title, event_date required");
      const token = b.attendanceToken || b.attendance_token || `qr-${Date.now()}`;
      await pool.query(
        `INSERT INTO calendar_events
           (event_id, title, event_date, start_time, end_time, location,
            event_type, category, attendance_token, created_by)
         VALUES (?,?,?,?,?,?,?,?,?,?)
         ON DUPLICATE KEY UPDATE
           attendance_token = VALUES(attendance_token),
           title            = VALUES(title),
           start_time       = VALUES(start_time),
           end_time         = VALUES(end_time),
           location         = VALUES(location)`,
        [
          b.id, b.title, b.event_date,
          b.startTime || b.start_time || null,
          b.endTime   || b.end_time   || null,
          b.location  || null,
          b.type      || b.event_type || "Calendar Event",
          b.category  || "personal",
          token,
          b.createdBy || b.created_by || null,
        ]
      );
      return created({ event_id: b.id, attendance_token: token });
    }

    // ────────────────────────────────────────────────────────────────────────
    // ATTENDANCE RECORDS
    // ────────────────────────────────────────────────────────────────────────
    if (method === "GET" && path === "/attendance-records") {
      const { eventId } = query;
      let sql = "SELECT * FROM attendance_records WHERE 1=1";
      const params = [];
      if (eventId) { sql += " AND event_id = ?"; params.push(eventId); }
      sql += " ORDER BY check_in_time DESC";
      const [rows] = await pool.query(sql, params);
      return ok(rows);
    }

    if (method === "POST" && path === "/attendance-records") {
      const b = parseBody(event);
      if (!b.record_id || !b.event_id || !b.user_id || !b.check_in_time || !b.status)
        return bad("record_id, event_id, user_id, check_in_time, status required");
      await pool.query(
        `INSERT INTO attendance_records
           (record_id, event_id, event_title, user_id, check_in_time, status, role)
         VALUES (?,?,?,?,?,?,?)
         ON DUPLICATE KEY UPDATE
           status        = VALUES(status),
           check_in_time = VALUES(check_in_time)`,
        [
          b.record_id, b.event_id, b.event_title || null,
          b.user_id, b.check_in_time, b.status, b.role || null,
        ]
      );
      return created({ record_id: b.record_id });
    }

    // ────────────────────────────────────────────────────────────────────────
    // PUBLIC HOLIDAYS
    // ────────────────────────────────────────────────────────────────────────
    if (method === "GET" && path === "/public-holidays") {
      const { year } = query;
      let sql = "SELECT * FROM public_holidays WHERE 1=1";
      const params = [];
      if (year) { sql += " AND year = ?"; params.push(Number(year)); }
      sql += " ORDER BY holiday_date";
      const [rows] = await pool.query(sql, params);
      return ok(rows);
    }

    // ────────────────────────────────────────────────────────────────────────
    // RECRUITMENT
    // ────────────────────────────────────────────────────────────────────────
    if (method === "GET" && path === "/recruitment") {
      return ok({ funnel: [], sources: [], programs: [], metrics: [] });
    }

    if (method === "POST" && path === "/recruitment/access") {
      const { code } = parseBody(event);
      const valid = process.env.RECRUITMENT_ACCESS_CODE || "";
      if (!valid || code !== valid) return unauth("Invalid access code");
      return ok({ granted: true });
    }

    // ────────────────────────────────────────────────────────────────────────
    // HELPDESK
    // ────────────────────────────────────────────────────────────────────────
    if (path.startsWith("/helpdesk/tickets")) {
      return ok([]);
    }

    // ────────────────────────────────────────────────────────────────────────
    // RESOURCES  (static)
    // ────────────────────────────────────────────────────────────────────────
    if (method === "GET" && path === "/resources") {
      return ok([
        {
          resource_id:  "sharepoint-templates",
          title:        "Client Profile Templates",
          url:          "https://www.sharepoint.com",
          description:  "Lead intake forms, fact-find sheets, and meeting note templates.",
        },
        {
          resource_id:  "sharepoint-decks",
          title:        "Product & Plan Decks",
          url:          "https://www.sharepoint.com",
          description:  "Plan comparison decks, premium tables, and sales presentation files.",
        },
        {
          resource_id:  "sharepoint-compliance",
          title:        "Compliance References",
          url:          "https://www.sharepoint.com",
          description:  "Disclosure scripts, product suitability checks, and document checklists.",
        },
      ]);
    }

    // ── 404 ──────────────────────────────────────────────────────────────────
    return notFound(`Route not found: ${method} ${path}`);

  } catch (err) {
    console.error("Lambda error:", { method, path, error: err.message, stack: err.stack });
    return fail(err.message || "Internal server error");
  }
};
