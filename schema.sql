-- ═══════════════════════════════════════════════════════════════════════════
-- AIA Dashboard schema (MySQL 8.0+)
--
-- Design principle:
--   Every main entity has fixed columns for fields the application code
--   already filters, sorts, joins, or aggregates on. Anything else lives in
--   an `extra` JSON column. When a CSV/Excel upload introduces a new column
--   like "Secondary Beneficiary", the importer puts it into `extra` — no
--   ALTER TABLE required.
--
-- Querying JSON fields:
--   SELECT extra->>'$.secondaryBeneficiary' FROM leads WHERE lead_id = 1;
--   CREATE INDEX idx_leads_extra_agency
--     ON leads ( (CAST(extra->>'$.agency' AS CHAR(50))) );
-- ═══════════════════════════════════════════════════════════════════════════

CREATE DATABASE IF NOT EXISTS aia_dashboard
  DEFAULT CHARACTER SET utf8mb4
  DEFAULT COLLATE utf8mb4_unicode_ci;
USE aia_dashboard;


-- ═══════════════════════════════════════════════════════════════════════════
-- 1. IDENTITY  ──  users, roles
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE roles (
  role_id   INT          AUTO_INCREMENT PRIMARY KEY,
  role_key  VARCHAR(20)  NOT NULL UNIQUE,
  label     VARCHAR(50)  NOT NULL
);

INSERT INTO roles (role_key, label) VALUES
  ('agent',    'Agent'),
  ('leader',   'Leader'),
  ('district', 'District Manager');

CREATE TABLE users (
  user_id       VARCHAR(10)   PRIMARY KEY,
  full_name     VARCHAR(100),
  role_id       INT           NOT NULL,
  password_hash VARCHAR(255)  NOT NULL,
  is_active     BOOLEAN       DEFAULT TRUE,
  extra         JSON          DEFAULT (JSON_OBJECT()),
  created_at    DATETIME      DEFAULT NOW(),
  updated_at    DATETIME      DEFAULT NOW() ON UPDATE NOW(),
  FOREIGN KEY (role_id) REFERENCES roles(role_id),
  INDEX idx_users_role (role_id)
);


-- ═══════════════════════════════════════════════════════════════════════════
-- 2. LEADS  ──  leads, follow_ups
--   Frontend uses: lead.sumAssured, generalExpense, surplus, existingPlans,
--   generalPlanType, specificPlanType, commissionRate, commissionAmount,
--   currency, agency  →  all live in `extra` so Excel imports can extend
--   the shape without DDL changes.
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE leads (
  lead_id         INT             AUTO_INCREMENT PRIMARY KEY,
  name            VARCHAR(100)    NOT NULL,
  age             INT,
  contact         VARCHAR(20),
  email           VARCHAR(150),
  meet_date       DATE,
  location        VARCHAR(200),
  meet_type       ENUM('Physical','Online','Hybrid'),
  urgency         ENUM('urgent','medium','non-urgent'),
  stage           VARCHAR(50),
  remarks         TEXT,
  plan_type       VARCHAR(100),
  annual_premium  DECIMAL(12,2),
  commission_type VARCHAR(50),
  cpf_oa          DECIMAL(12,2),
  cpf_sa          DECIMAL(12,2),
  occupation      VARCHAR(100),
  income          VARCHAR(50),
  referred_by     VARCHAR(100),
  owner_id        VARCHAR(10)     NOT NULL,
  extra           JSON            DEFAULT (JSON_OBJECT()),
  created_at      DATETIME        DEFAULT NOW(),
  updated_at      DATETIME        DEFAULT NOW() ON UPDATE NOW(),
  FOREIGN KEY (owner_id) REFERENCES users(user_id),
  INDEX idx_leads_owner (owner_id),
  INDEX idx_leads_stage (stage),
  INDEX idx_leads_meet_date (meet_date)
);

CREATE TABLE follow_ups (
  follow_up_id   INT           AUTO_INCREMENT PRIMARY KEY,
  lead_id        INT           NOT NULL,
  label          VARCHAR(100)  NOT NULL,
  scheduled_date DATE,
  is_done        BOOLEAN       DEFAULT FALSE,
  extra          JSON          DEFAULT (JSON_OBJECT()),
  FOREIGN KEY (lead_id) REFERENCES leads(lead_id) ON DELETE CASCADE,
  INDEX idx_followups_lead (lead_id),
  INDEX idx_followups_date (scheduled_date)
);


-- ═══════════════════════════════════════════════════════════════════════════
-- 3. CALENDAR  ──  personal_tasks, calendar_events, public_holidays
--   `category` distinguishes personal vs agency/district vs holiday events.
--   `attendance_token` is the per-event QR token used by the check-in flow.
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE personal_tasks (
  task_id             VARCHAR(50)   PRIMARY KEY,
  user_id             VARCHAR(10)   NOT NULL,
  title               VARCHAR(200)  NOT NULL,
  due_date            DATE,
  source              VARCHAR(20),
  linked_event_title  VARCHAR(200),
  is_done             BOOLEAN       DEFAULT FALSE,
  extra               JSON          DEFAULT (JSON_OBJECT()),
  created_at          DATETIME      DEFAULT NOW(),
  FOREIGN KEY (user_id) REFERENCES users(user_id),
  INDEX idx_tasks_user_due (user_id, due_date)
);

CREATE TABLE calendar_events (
  event_id          VARCHAR(50)   PRIMARY KEY,
  title             VARCHAR(200)  NOT NULL,
  event_date        DATE          NOT NULL,
  start_time        TIME,
  end_time          TIME,
  location          VARCHAR(200),
  event_type        VARCHAR(50),
  category          ENUM('personal','agency','holiday','calendar') NOT NULL,
  notes             TEXT,
  attendance_token  VARCHAR(100),
  recurrence_id     VARCHAR(50),
  linked_task_id    VARCHAR(50),
  is_editable       BOOLEAN       DEFAULT TRUE,
  created_by        VARCHAR(10),
  extra             JSON          DEFAULT (JSON_OBJECT()),
  created_at        DATETIME      DEFAULT NOW(),
  FOREIGN KEY (linked_task_id) REFERENCES personal_tasks(task_id) ON DELETE SET NULL,
  FOREIGN KEY (created_by)     REFERENCES users(user_id),
  INDEX idx_events_date (event_date),
  INDEX idx_events_category (category),
  INDEX idx_events_creator (created_by)
);

CREATE TABLE public_holidays (
  holiday_id    INT           AUTO_INCREMENT PRIMARY KEY,
  holiday_date  DATE          NOT NULL,
  name          VARCHAR(100)  NOT NULL,
  year          INT           NOT NULL,
  country_code  CHAR(2)       DEFAULT 'SG',
  extra         JSON          DEFAULT (JSON_OBJECT()),
  UNIQUE KEY uq_holiday (holiday_date, country_code),
  INDEX idx_holidays_year (year)
);


-- ═══════════════════════════════════════════════════════════════════════════
-- 4. ATTENDANCE  ──  attendance_records
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE attendance_records (
  record_id      VARCHAR(50)   PRIMARY KEY,
  event_id       VARCHAR(50)   NOT NULL,
  event_title    VARCHAR(200),
  user_id        VARCHAR(10)   NOT NULL,
  check_in_time  DATETIME      NOT NULL,
  status         ENUM('Present','Late') NOT NULL,
  role           VARCHAR(20),
  extra          JSON          DEFAULT (JSON_OBJECT()),
  FOREIGN KEY (event_id) REFERENCES calendar_events(event_id),
  FOREIGN KEY (user_id)  REFERENCES users(user_id),
  UNIQUE KEY uq_attendance (event_id, user_id),
  INDEX idx_attendance_user (user_id),
  INDEX idx_attendance_time (check_in_time)
);


-- ═══════════════════════════════════════════════════════════════════════════
-- 5. ROOM BOOKING  ──  rooms (static), room_bookings
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE rooms (
  room_id    VARCHAR(20)   PRIMARY KEY,
  label      VARCHAR(100)  NOT NULL,
  css_class  VARCHAR(50),
  dot_color  VARCHAR(20),
  is_active  BOOLEAN       DEFAULT TRUE,
  extra      JSON          DEFAULT (JSON_OBJECT())
);

INSERT INTO rooms (room_id, label, css_class, dot_color) VALUES
  ('eagle',       'Eagle Boardroom',        'room-eagle',       '#93c5fd'),
  ('summit',      'Summit Event Hall',      'room-summit',      '#fca5a5'),
  ('ark',         'Ark (near Eagle)',       'room-ark',         '#6ee7b7'),
  ('armour',      'Armour (beside Pigeon)', 'room-armour',      '#d1d5db'),
  ('inspiration', 'Inspiration Lounge',     'room-inspiration', '#c4b5fd'),
  ('nest',        'Nest / Nursing Room',    'room-nest',        '#fde68a');

CREATE TABLE room_bookings (
  booking_id     INT           AUTO_INCREMENT PRIMARY KEY,
  title          VARCHAR(200)  NOT NULL,
  room_id        VARCHAR(20)   NOT NULL,
  booking_date   DATE          NOT NULL,
  start_time     TIME          NOT NULL,
  end_time       TIME          NOT NULL,
  booked_by_id   VARCHAR(10),
  booked_by_name VARCHAR(100),
  notes          TEXT,
  recurrence     ENUM('none','daily','weekly','biweekly','monthly') DEFAULT 'none',
  recurrence_end DATE,
  recurrence_id  VARCHAR(50),
  extra          JSON          DEFAULT (JSON_OBJECT()),
  created_at     DATETIME      DEFAULT NOW(),
  FOREIGN KEY (room_id)      REFERENCES rooms(room_id),
  FOREIGN KEY (booked_by_id) REFERENCES users(user_id) ON DELETE SET NULL,
  INDEX idx_bookings_room_date (room_id, booking_date),
  INDEX idx_bookings_date (booking_date)
);


-- ═══════════════════════════════════════════════════════════════════════════
-- 6. ANNOUNCEMENTS  ──  announcements, announcement_responses
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE announcements (
  announcement_id  VARCHAR(50)   PRIMARY KEY,
  title            VARCHAR(100)  NOT NULL,
  category         VARCHAR(60)   NOT NULL,
  message          TEXT          NOT NULL,
  response_type    ENUM('acknowledge','rsvp','status') NOT NULL,
  created_by       VARCHAR(10)   NOT NULL,
  created_at       DATETIME      NOT NULL,
  extra            JSON          DEFAULT (JSON_OBJECT()),
  FOREIGN KEY (created_by) REFERENCES users(user_id),
  INDEX idx_announcements_created (created_at)
);

CREATE TABLE announcement_responses (
  response_id      INT           AUTO_INCREMENT PRIMARY KEY,
  announcement_id  VARCHAR(50)   NOT NULL,
  user_id          VARCHAR(10)   NOT NULL,
  choice           VARCHAR(20)   NOT NULL,
  note             TEXT,
  responded_at     DATETIME      NOT NULL,
  extra            JSON          DEFAULT (JSON_OBJECT()),
  UNIQUE KEY uq_response (announcement_id, user_id),
  FOREIGN KEY (announcement_id) REFERENCES announcements(announcement_id) ON DELETE CASCADE,
  FOREIGN KEY (user_id)         REFERENCES users(user_id),
  INDEX idx_responses_user (user_id)
);


-- ═══════════════════════════════════════════════════════════════════════════
-- 7. SALES TRACKER  ──  activity_types (static), sales_entries, sales_reflections
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE activity_types (
  activity_type_id  VARCHAR(20)  PRIMARY KEY,
  label             VARCHAR(50)  NOT NULL,
  points            INT          NOT NULL,
  sort_order        INT          DEFAULT 0,
  extra             JSON         DEFAULT (JSON_OBJECT())
);

INSERT INTO activity_types (activity_type_id, label, points, sort_order) VALUES
  ('activity',  'Activity',       3,  1),
  ('contact',   'Contact',        1,  2),
  ('schedule',  'Schedule Appt',  2,  3),
  ('casual',    'Casual Meetup',  2,  4),
  ('insurance', 'Insurance Appt', 5,  5),
  ('referral',  'Referral',       3,  6),
  ('case',      'Case Closed',   10,  7);

CREATE TABLE sales_entries (
  entry_id          VARCHAR(50)   PRIMARY KEY,
  agent_id          VARCHAR(10)   NOT NULL,
  entry_date        DATE          NOT NULL,
  activity_type_id  VARCHAR(20)   NOT NULL,
  count             INT           NOT NULL DEFAULT 1,
  client_name       VARCHAR(100),
  status            VARCHAR(50),
  notes             TEXT,
  extra             JSON          DEFAULT (JSON_OBJECT()),
  created_at        DATETIME      NOT NULL,
  FOREIGN KEY (agent_id)         REFERENCES users(user_id),
  FOREIGN KEY (activity_type_id) REFERENCES activity_types(activity_type_id),
  INDEX idx_sales_agent_date (agent_id, entry_date),
  INDEX idx_sales_date (entry_date)
);

CREATE TABLE sales_reflections (
  reflection_id   INT          AUTO_INCREMENT PRIMARY KEY,
  agent_id        VARCHAR(10)  NOT NULL,
  reflection_date DATE         NOT NULL,
  went_well       TEXT,
  went_poorly     TEXT,
  to_improve      TEXT,
  extra           JSON         DEFAULT (JSON_OBJECT()),
  UNIQUE KEY uq_reflection (agent_id, reflection_date),
  FOREIGN KEY (agent_id) REFERENCES users(user_id)
);


-- ═══════════════════════════════════════════════════════════════════════════
-- 8. TRAINING  ──  training_topics, quiz_questions, quiz_options, training_progress
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE training_topics (
  topic_id    VARCHAR(10)   PRIMARY KEY,
  title       VARCHAR(200)  NOT NULL,
  youtube_id  VARCHAR(50),
  sort_order  INT           NOT NULL,
  extra       JSON          DEFAULT (JSON_OBJECT())
);

CREATE TABLE quiz_questions (
  question_id    VARCHAR(20)  PRIMARY KEY,
  topic_id       VARCHAR(10)  NOT NULL,
  question_text  TEXT         NOT NULL,
  sort_order     INT          NOT NULL,
  extra          JSON         DEFAULT (JSON_OBJECT()),
  FOREIGN KEY (topic_id) REFERENCES training_topics(topic_id) ON DELETE CASCADE,
  INDEX idx_questions_topic (topic_id)
);

CREATE TABLE quiz_options (
  option_id    VARCHAR(20)  PRIMARY KEY,
  question_id  VARCHAR(20)  NOT NULL,
  label        TEXT         NOT NULL,
  is_correct   BOOLEAN      NOT NULL DEFAULT FALSE,
  sort_order   INT          DEFAULT 0,
  extra        JSON         DEFAULT (JSON_OBJECT()),
  FOREIGN KEY (question_id) REFERENCES quiz_questions(question_id) ON DELETE CASCADE,
  INDEX idx_options_question (question_id)
);

CREATE TABLE training_progress (
  progress_id  INT          AUTO_INCREMENT PRIMARY KEY,
  user_id      VARCHAR(10)  NOT NULL,
  topic_id     VARCHAR(10)  NOT NULL,
  video_done   BOOLEAN      DEFAULT FALSE,
  quiz_passed  BOOLEAN      DEFAULT FALSE,
  extra        JSON         DEFAULT (JSON_OBJECT()),
  updated_at   DATETIME     DEFAULT NOW() ON UPDATE NOW(),
  UNIQUE KEY uq_progress (user_id, topic_id),
  FOREIGN KEY (user_id)  REFERENCES users(user_id),
  FOREIGN KEY (topic_id) REFERENCES training_topics(topic_id)
);


-- ═══════════════════════════════════════════════════════════════════════════
-- 9. TEAM MANAGEMENT  ──  team_roster (onboarding rosters per manager)
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE team_roster (
  roster_id   INT          AUTO_INCREMENT PRIMARY KEY,
  manager_id  VARCHAR(10)  NOT NULL,
  agent_id    VARCHAR(10)  NOT NULL,
  notes       TEXT,
  joined_at   DATETIME     NOT NULL,
  extra       JSON         DEFAULT (JSON_OBJECT()),
  UNIQUE KEY uq_roster (manager_id, agent_id),
  FOREIGN KEY (manager_id) REFERENCES users(user_id),
  FOREIGN KEY (agent_id)   REFERENCES users(user_id),
  INDEX idx_roster_manager (manager_id)
);


-- ═══════════════════════════════════════════════════════════════════════════
-- 10. AGENT PERFORMANCE  ──  agent_performance
--   Fixed columns for the metrics shown on agent-comparison.html.
--   Complex breakdowns (monthlyYtd[], weekly[], menteeStatuses[]) live in
--   `extra` since they are read together as a blob per snapshot, never
--   filtered or aggregated by individual sub-fields.
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE agent_performance (
  performance_id   INT           AUTO_INCREMENT PRIMARY KEY,
  agent_id         VARCHAR(10)   NOT NULL,
  period_year      INT           NOT NULL,
  period_label     VARCHAR(30)   NOT NULL,
  ytd_fyc          DECIMAL(12,2),
  yearly_target    DECIMAL(12,2),
  weekly_fyc       DECIMAL(12,2),
  last_week_fyc    DECIMAL(12,2),
  district_rank    INT,
  delta_pct        DECIMAL(8,2),
  total_cases      INT           DEFAULT 0,
  team_name        VARCHAR(50),
  extra            JSON          DEFAULT (JSON_OBJECT()),
  updated_at       DATETIME      DEFAULT NOW() ON UPDATE NOW(),
  UNIQUE KEY uq_performance (agent_id, period_year, period_label),
  FOREIGN KEY (agent_id) REFERENCES users(user_id),
  INDEX idx_performance_period (period_year, period_label),
  INDEX idx_performance_rank (district_rank)
);


-- ═══════════════════════════════════════════════════════════════════════════
-- 11. CPF TRACKER  ──  cpf_tracker_entries
--   Static reference rows shown on the overview's CPF panel.
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE cpf_tracker_entries (
  entry_id       INT           AUTO_INCREMENT PRIMARY KEY,
  agent_id       VARCHAR(10),
  client_name    VARCHAR(100)  NOT NULL,
  account_focus  VARCHAR(50),
  status         VARCHAR(50),
  amount         VARCHAR(50),
  note           TEXT,
  extra          JSON          DEFAULT (JSON_OBJECT()),
  created_at     DATETIME      DEFAULT NOW(),
  updated_at     DATETIME      DEFAULT NOW() ON UPDATE NOW(),
  FOREIGN KEY (agent_id) REFERENCES users(user_id) ON DELETE SET NULL,
  INDEX idx_cpf_agent (agent_id)
);
