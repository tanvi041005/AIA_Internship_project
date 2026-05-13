-- ═══════════════════════════════════════════════════════════════════════════
-- AIA Dashboard — dummy data seed (MySQL 8.0+)
--
-- Run after schema.sql has been applied. Idempotent: uses INSERT IGNORE so
-- re-running is safe.
--
-- ⚠️  password_hash placeholder
-- ----------------------------------------------------------------------------
-- This file uses a placeholder bcrypt-shaped hash for every user. Before any
-- non-local deployment, replace these by running the existing seed.js
-- (which calls bcryptjs.hash) or update each row manually:
--
--   UPDATE users SET password_hash = '$2a$10$<real-bcrypt-hash>'
--   WHERE user_id = 'A123';
--
-- For local testing, your auth Lambda can either:
--   (a) Switch to bcrypt.compare after running seed.js to populate real hashes
--   (b) Compare against the plaintext stored here (dev only)
-- ═══════════════════════════════════════════════════════════════════════════

USE aia_dashboard;


-- ── 1. USERS ─────────────────────────────────────────────────────────────────
-- 10 agents (A123-A132), 1 leader (L123), 1 district manager (D123).
-- Agent names sourced from sales-tracker.js + agent-comparison.js.

INSERT IGNORE INTO users (user_id, full_name, role_id, password_hash, is_active) VALUES
  ('A123', 'Alicia Tan',    (SELECT role_id FROM roles WHERE role_key='agent'),    '$2a$10$PLACEHOLDER.REPLACE.WITH.REAL.BCRYPT.HASH.A123', TRUE),
  ('A124', 'Brandon Lee',   (SELECT role_id FROM roles WHERE role_key='agent'),    '$2a$10$PLACEHOLDER.REPLACE.WITH.REAL.BCRYPT.HASH.A124', TRUE),
  ('A125', 'Chloe Ong',     (SELECT role_id FROM roles WHERE role_key='agent'),    '$2a$10$PLACEHOLDER.REPLACE.WITH.REAL.BCRYPT.HASH.A125', TRUE),
  ('A126', 'Darren Lim',    (SELECT role_id FROM roles WHERE role_key='agent'),    '$2a$10$PLACEHOLDER.REPLACE.WITH.REAL.BCRYPT.HASH.A126', TRUE),
  ('A127', 'Farah Rahim',   (SELECT role_id FROM roles WHERE role_key='agent'),    '$2a$10$PLACEHOLDER.REPLACE.WITH.REAL.BCRYPT.HASH.A127', TRUE),
  ('A128', 'Gavin Teo',     (SELECT role_id FROM roles WHERE role_key='agent'),    '$2a$10$PLACEHOLDER.REPLACE.WITH.REAL.BCRYPT.HASH.A128', TRUE),
  ('A129', 'Hui Min Chua',  (SELECT role_id FROM roles WHERE role_key='agent'),    '$2a$10$PLACEHOLDER.REPLACE.WITH.REAL.BCRYPT.HASH.A129', TRUE),
  ('A130', 'Isaac Wong',    (SELECT role_id FROM roles WHERE role_key='agent'),    '$2a$10$PLACEHOLDER.REPLACE.WITH.REAL.BCRYPT.HASH.A130', TRUE),
  ('A131', 'Jia En Low',    (SELECT role_id FROM roles WHERE role_key='agent'),    '$2a$10$PLACEHOLDER.REPLACE.WITH.REAL.BCRYPT.HASH.A131', TRUE),
  ('A132', 'Kumar Singh',   (SELECT role_id FROM roles WHERE role_key='agent'),    '$2a$10$PLACEHOLDER.REPLACE.WITH.REAL.BCRYPT.HASH.A132', TRUE),
  ('L123', 'Leader Demo',   (SELECT role_id FROM roles WHERE role_key='leader'),   '$2a$10$PLACEHOLDER.REPLACE.WITH.REAL.BCRYPT.HASH.L123', TRUE),
  ('D123', 'District Demo', (SELECT role_id FROM roles WHERE role_key='district'), '$2a$10$PLACEHOLDER.REPLACE.WITH.REAL.BCRYPT.HASH.D123', TRUE);


-- ── 2. LEADS  ────────────────────────────────────────────────────────────────
-- 6 leads from leads.js DEFAULT_LEADS, all owned by A123.
-- Fields not in fixed columns (sumAssured, currency, generalExpense, surplus,
-- existingPlans, generalPlanType, specificPlanType) are stored in `extra`.

INSERT INTO leads (lead_id, name, age, contact, email, meet_date, location, meet_type, urgency, stage, remarks, plan_type, annual_premium, commission_type, cpf_oa, cpf_sa, occupation, income, referred_by, owner_id, extra) VALUES
  (1, 'Lim Wei Jie', 34, '9123-4567', 'weijie.lim@email.com', '2025-05-12', 'Toa Payoh HDB', 'Physical', 'urgent', 'Opening',
   'Interested in term life; wife expecting. Has existing GE policy expiring soon.',
   'Term Life', 2400, 'FYC', 88000, 42000, 'Software Engineer', 'SGD 7,200/mo', 'John Tan', 'A123',
   '{"sumAssured":300000,"currency":"SGD","generalExpense":"SGD 3,600/mo","surplus":"SGD 3,600/mo","existingPlans":"Existing GE policy expiring soon","generalPlanType":"Protection","specificPlanType":"Term Life"}'),

  (2, 'Nur Aisyah Binte Rahman', 28, '8234-5678', 'aisyah.r@email.com', '2025-05-15', 'Tampines Mall', 'Online', 'medium', 'Fact Find',
   'Self-employed, irregular income. Keen on savings plan for rainy day fund.',
   'Endowment', 3600, 'Trail', 31000, 18000, 'Freelance Designer', 'SGD 3,800/mo (avg)', 'Self (Instagram)', 'A123',
   '{"sumAssured":180000,"currency":"SGD","generalExpense":"SGD 2,100/mo","surplus":"SGD 1,700/mo","existingPlans":"No current plan on record","generalPlanType":"Savings","specificPlanType":"Endowment"}'),

  (3, 'Chen Jia Hao', 42, '9345-6789', 'jiahao.chen@corp.sg', '2025-05-08', 'Raffles Place (Client Office)', 'Physical', 'urgent', 'Closing',
   'Director-level. Needs keyman insurance + personal CI cover. Decide by end of month.',
   'CI + Keyman', 9800, 'FYC', 180000, 95000, 'Company Director', 'SGD 22,000/mo', 'Existing client (Peter Goh)', 'A123',
   '{"sumAssured":750000,"currency":"SGD","generalExpense":"SGD 9,000/mo","surplus":"SGD 13,000/mo","existingPlans":"Existing personal CI cover; looking at keyman and additional protection","generalPlanType":"Protection","specificPlanType":"CI + Keyman"}'),

  (4, 'Priya Nair', 31, '9456-7890', 'priya.nair@gmail.com', '2025-05-20', 'Jurong East CC', 'Hybrid', 'non-urgent', 'Prospecting',
   'Teacher. Wants ILP for long-term growth. No rush — reviewing options with husband.',
   'ILP', 4200, 'Trail', 54000, 28000, 'Secondary School Teacher', 'SGD 4,500/mo', 'Colleague referral', 'A123',
   '{"sumAssured":200000,"currency":"SGD","generalExpense":"SGD 2,500/mo","surplus":"SGD 2,000/mo","existingPlans":"No active insurance plan yet","generalPlanType":"Investment","specificPlanType":"ILP"}'),

  (5, 'Marcus Tan Boon Kiat', 38, '9567-8901', 'marcus.tbk@finco.com', '2025-05-06', 'CBD (Zoom)', 'Online', 'urgent', 'Opening',
   'Planning early retirement at 55. HNW profile — keen on wealth accumulation + legacy planning.',
   'Whole Life + Trust', 24000, 'FYC + Trail', 320000, 150000, 'VP Finance', 'SGD 18,000/mo', 'Wealth manager partner', 'A123',
   '{"sumAssured":1000000,"currency":"SGD","generalExpense":"SGD 8,000/mo","surplus":"SGD 10,000/mo","existingPlans":"Corporate coverage only; reviewing personal wealth and legacy plans","generalPlanType":"Wealth","specificPlanType":"Whole Life + Trust"}'),

  (6, 'Sandra Loh Mei Ling', 55, '8678-9012', 'sandraloh@email.com', '2025-05-25', 'Woodlands Civic Centre', 'Physical', 'non-urgent', 'Fact Find',
   'Near retirement. Reviewing existing Prudential policies. Possible DPS lapse to address.',
   'Retirement + MediShield', 1800, 'Trail', 120000, 65000, 'Admin Executive (Govt)', 'SGD 3,200/mo', 'Daughter''s recommendation', 'A123',
   '{"sumAssured":120000,"currency":"SGD","generalExpense":"SGD 2,000/mo","surplus":"SGD 1,200/mo","existingPlans":"Reviewing existing Prudential policies","generalPlanType":"Retirement","specificPlanType":"Retirement + MediShield"}');


-- ── 3. FOLLOW_UPS  ───────────────────────────────────────────────────────────

INSERT INTO follow_ups (lead_id, label, scheduled_date, is_done) VALUES
  (1, 'Initial meeting',     '2025-04-30', TRUE),
  (1, 'Proposal sent',       '2025-05-05', TRUE),
  (1, 'Follow-up call',      '2025-05-14', FALSE),
  (1, 'Closing',             '2025-05-20', FALSE),
  (2, 'Intro call',          '2025-05-10', TRUE),
  (2, 'Fact-find session',   '2025-05-15', FALSE),
  (2, 'Needs analysis',      '2025-05-22', FALSE),
  (3, 'Discovery',           '2025-04-22', TRUE),
  (3, 'Proposal',            '2025-05-02', TRUE),
  (3, 'Negotiation',         '2025-05-08', TRUE),
  (3, 'Closing sign-off',    '2025-05-15', FALSE),
  (4, 'WhatsApp intro',      '2025-05-17', TRUE),
  (4, 'Meet-up',             '2025-05-20', FALSE),
  (4, 'Proposal',            '2025-05-28', FALSE),
  (5, 'Zoom intro',          '2025-05-01', TRUE),
  (5, 'Needs analysis',      '2025-05-06', TRUE),
  (5, 'Solutioning',         '2025-05-12', FALSE),
  (5, 'Proposal',            '2025-05-19', FALSE),
  (6, 'Phone call',          '2025-05-20', TRUE),
  (6, 'Fact-find',           '2025-05-25', FALSE);


-- ── 4. CALENDAR EVENTS  ──────────────────────────────────────────────────────
-- District events from dashboard.js districtEventsSeed.

INSERT IGNORE INTO calendar_events (event_id, title, event_date, category, event_type, created_by) VALUES
  ('agency-1', 'District Training Session', '2026-05-12', 'agency', 'District Event', 'D123'),
  ('agency-2', 'District Sales Review',     '2026-05-25', 'agency', 'District Event', 'D123');


-- ── 5. PUBLIC HOLIDAYS  ──────────────────────────────────────────────────────
-- SG 2026 holidays from dashboard.js _sgHolidays2026Fallback.

INSERT IGNORE INTO public_holidays (holiday_date, name, year, country_code) VALUES
  ('2026-01-01', 'New Year''s Day',      2026, 'SG'),
  ('2026-01-29', 'Chinese New Year',     2026, 'SG'),
  ('2026-01-30', 'Chinese New Year',     2026, 'SG'),
  ('2026-03-31', 'Hari Raya Puasa',      2026, 'SG'),
  ('2026-04-03', 'Good Friday',          2026, 'SG'),
  ('2026-05-01', 'Labour Day',           2026, 'SG'),
  ('2026-05-12', 'Vesak Day',            2026, 'SG'),
  ('2026-06-07', 'Hari Raya Haji',       2026, 'SG'),
  ('2026-08-09', 'National Day',         2026, 'SG'),
  ('2026-10-27', 'Deepavali',            2026, 'SG'),
  ('2026-12-25', 'Christmas Day',        2026, 'SG');


-- ── 6. ROOM BOOKINGS  ────────────────────────────────────────────────────────
-- 6 bookings from room-booking.js. Original code used fmtDate(today) — here
-- they're pinned to fixed 2026-05-11..14 dates for reproducibility.

INSERT INTO room_bookings (title, room_id, booking_date, start_time, end_time, booked_by_name, recurrence) VALUES
  ('Board Review',      'eagle',       '2026-05-12', '09:00:00', '10:30:00', 'Sarah L.',    'none'),
  ('All-Hands',         'summit',      '2026-05-12', '14:00:00', '15:00:00', 'Operations',  'none'),
  ('Dev Sprint Sync',   'ark',         '2026-05-13', '10:00:00', '11:00:00', 'Tech Team',   'none'),
  ('HR Interview',      'armour',      '2026-05-14', '13:00:00', '14:00:00', 'HR',          'none'),
  ('L&D Session',       'inspiration', '2026-05-11', '15:00:00', '16:30:00', 'Learning',    'none'),
  ('Wellness Break',    'nest',        '2026-05-12', '12:00:00', '12:30:00', 'HR',          'none');


-- ── 7. ANNOUNCEMENTS  ────────────────────────────────────────────────────────

INSERT IGNORE INTO announcements (announcement_id, title, category, message, response_type, created_by, created_at) VALUES
  ('a1', 'Q2 Client Follow-up Compliance', 'Policy Update',
   'All agents must complete follow-up notes for new leads within 24 hours and mark the status in the lead tracker.',
   'acknowledge', 'D123', '2026-05-08 01:00:00'),
  ('a2', 'RSVP for This Event', 'Event Reminder',
   'Please RSVP for the Monthly Sales Kickoff by Wednesday 5:00 PM so the admin team can confirm attendance and seating.',
   'rsvp', 'L123', '2026-05-08 01:30:00'),
  ('a3', 'Portal Feature Testing Window', 'Testing Notice',
   'This is a test announcement. Please open the Training and Leads modules, then report any issue to your team leader before end of day.',
   'status', 'L123', '2026-05-08 02:00:00');


-- ── 8. SALES ENTRIES  ────────────────────────────────────────────────────────
-- 35 entries from sales-tracker.js seedEntries (5 agents × 5 days).

INSERT IGNORE INTO sales_entries (entry_id, agent_id, entry_date, activity_type_id, count, client_name, status, notes, created_at) VALUES
  ('seed-0',  'A123', '2026-05-04', 'schedule',  4, 'Marcus Tan',         'Completed', 'Booked policy reviews',       '2026-05-04 18:00:00'),
  ('seed-1',  'A123', '2026-05-04', 'contact',   7, 'Warm list',          'Completed', 'Daily call block',            '2026-05-04 18:00:00'),
  ('seed-2',  'A123', '2026-05-05', 'insurance', 2, 'Chen Jia Hao',       'Completed', 'CI and keyman discussion',    '2026-05-05 18:00:00'),
  ('seed-3',  'A123', '2026-05-05', 'referral',  2, 'Nur Aisyah',         'Follow-up', 'Referred colleague',          '2026-05-05 18:00:00'),
  ('seed-4',  'A123', '2026-05-06', 'casual',    3, 'Coffee chats',       'Completed', 'Prospecting meetings',        '2026-05-06 18:00:00'),
  ('seed-5',  'A123', '2026-05-06', 'activity',  3, 'Pipeline work',      'Completed', 'Fact-find prep',              '2026-05-06 18:00:00'),
  ('seed-6',  'A123', '2026-05-07', 'case',      1, 'Lim Wei Jie',        'Completed', 'Term life case closed',       '2026-05-07 18:00:00'),
  ('seed-7',  'A123', '2026-05-07', 'schedule',  3, 'Next week',          'Scheduled', 'Follow-up meetings',          '2026-05-07 18:00:00'),
  ('seed-8',  'A123', '2026-05-08', 'insurance', 1, 'Priya Nair',         'Completed', 'Proposal review',             '2026-05-08 18:00:00'),
  ('seed-9',  'A123', '2026-05-08', 'referral',  4, 'COI list',           'Completed', 'Referral push',               '2026-05-08 18:00:00'),
  ('seed-10', 'A124', '2026-05-04', 'contact',   6, 'Warm leads',         'Completed', 'Morning call block',          '2026-05-04 18:00:00'),
  ('seed-11', 'A124', '2026-05-04', 'schedule',  5, 'May pipeline',       'Scheduled', 'Booked first appointments',   '2026-05-04 18:00:00'),
  ('seed-12', 'A124', '2026-05-05', 'casual',    4, 'Coffee chats',       'Completed', 'Relationship building',       '2026-05-05 18:00:00'),
  ('seed-13', 'A124', '2026-05-05', 'insurance', 1, 'Client review',      'Completed', 'Protection gap',              '2026-05-05 18:00:00'),
  ('seed-14', 'A124', '2026-05-06', 'activity',  2, 'Admin follow-up',    'Completed', 'Needs analysis prep',         '2026-05-06 18:00:00'),
  ('seed-15', 'A124', '2026-05-06', 'schedule',  3, 'Prospects',          'Scheduled', 'Next week pipeline',          '2026-05-06 18:00:00'),
  ('seed-16', 'A124', '2026-05-07', 'referral',  2, 'Centre of influence','Completed', 'Referral asks',               '2026-05-07 18:00:00'),
  ('seed-17', 'A124', '2026-05-07', 'casual',    3, 'Lunch meetings',     'Completed', 'Warm prospects',              '2026-05-07 18:00:00'),
  ('seed-18', 'A124', '2026-05-08', 'insurance', 2, 'Review clients',     'Completed', 'Policy review day',           '2026-05-08 18:00:00'),
  ('seed-19', 'A124', '2026-05-08', 'contact',   5, 'Cold follow-up',     'Completed', 'Reactivation calls',          '2026-05-08 18:00:00'),
  ('seed-20', 'A125', '2026-05-04', 'schedule',  5, 'Prospects',          'Scheduled', 'Next week pipeline',          '2026-05-04 18:00:00'),
  ('seed-21', 'A125', '2026-05-05', 'insurance', 2, 'Family planning',    'Completed', 'Protection review',           '2026-05-05 18:00:00'),
  ('seed-22', 'A125', '2026-05-06', 'referral',  3, 'Client network',     'Completed', 'Referral campaign',           '2026-05-06 18:00:00'),
  ('seed-23', 'A125', '2026-05-07', 'casual',    4, 'Warm prospects',     'Completed', 'Coffee meetings',             '2026-05-07 18:00:00'),
  ('seed-24', 'A125', '2026-05-08', 'case',      1, 'Savings plan',       'Completed', 'Case closed',                 '2026-05-08 18:00:00'),
  ('seed-25', 'A126', '2026-05-04', 'activity',  5, 'Pipeline cleanup',   'Completed', 'CRM hygiene',                 '2026-05-04 18:00:00'),
  ('seed-26', 'A126', '2026-05-05', 'contact',   8, 'Existing clients',   'Completed', 'Review calls',                '2026-05-05 18:00:00'),
  ('seed-27', 'A126', '2026-05-06', 'insurance', 2, 'Corporate client',   'Completed', 'Group policy discussion',     '2026-05-06 18:00:00'),
  ('seed-28', 'A126', '2026-05-07', 'case',      1, 'Corporate client',   'Completed', 'Group policy',                '2026-05-07 18:00:00'),
  ('seed-29', 'A126', '2026-05-08', 'schedule',  4, 'Upcoming week',      'Scheduled', 'Booked reviews',              '2026-05-08 18:00:00'),
  ('seed-30', 'A127', '2026-05-04', 'referral',  3, 'Centre of influence','Completed', 'Referral drive',              '2026-05-04 18:00:00'),
  ('seed-31', 'A127', '2026-05-05', 'casual',    5, 'Networking',         'Completed', 'Event follow-ups',            '2026-05-05 18:00:00'),
  ('seed-32', 'A127', '2026-05-06', 'schedule',  4, 'Prospects',          'Scheduled', 'Booked fact-finds',           '2026-05-06 18:00:00'),
  ('seed-33', 'A127', '2026-05-07', 'insurance', 2, 'Client reviews',     'Completed', 'Needs analysis',              '2026-05-07 18:00:00'),
  ('seed-34', 'A127', '2026-05-08', 'activity',  4, 'Admin + prep',       'Completed', 'Proposal preparation',        '2026-05-08 18:00:00');


-- ── 9. TRAINING TOPICS  ──────────────────────────────────────────────────────

INSERT IGNORE INTO training_topics (topic_id, title, youtube_id, sort_order) VALUES
  ('t1', 'AIA Agent Foundations: Protection Planning',         'x3MBoq2b33k', 1),
  ('t2', 'AIA Agent Practice: Objection Handling and Follow-up', 'zRSSQycVdzo', 2);

INSERT IGNORE INTO quiz_questions (question_id, topic_id, question_text, sort_order) VALUES
  ('t1q1', 't1', 'During client fact-finding, what should an AIA agent confirm first?', 1),
  ('t1q2', 't1', 'Which action best matches responsible AIA advisory practice?',         2),
  ('t1q3', 't1', 'Before proposal confirmation, what should the agent do?',              3),
  ('t2q1', 't2', 'When a client says ''I need time to think'', what is the best response?', 1),
  ('t2q2', 't2', 'Which follow-up habit supports stronger AIA conversion quality?',      2),
  ('t2q3', 't2', 'For leadership visibility, what should agent updates include?',        3);

INSERT IGNORE INTO quiz_options (option_id, question_id, label, is_correct, sort_order) VALUES
  ('t1q1a', 't1q1', 'Client protection needs and priorities',                                          TRUE,  1),
  ('t1q1b', 't1q1', 'Client social media profile only',                                                FALSE, 2),
  ('t1q1c', 't1q1', 'Only premium discount preference',                                                FALSE, 3),
  ('t1q2a', 't1q2', 'Recommend plans that fit goals, affordability, and risk profile',                 TRUE,  1),
  ('t1q2b', 't1q2', 'Push the highest premium product regardless of need',                             FALSE, 2),
  ('t1q2c', 't1q2', 'Skip needs analysis if client is in a hurry',                                     FALSE, 3),
  ('t1q3a', 't1q3', 'Clearly explain coverage, exclusions, and payment commitment',                    TRUE,  1),
  ('t1q3b', 't1q3', 'Ask the client to sign without discussion',                                       FALSE, 2),
  ('t1q3c', 't1q3', 'Focus only on commission details',                                                FALSE, 3),
  ('t2q1a', 't2q1', 'Acknowledge concern, clarify questions, and agree on follow-up date',             TRUE,  1),
  ('t2q1b', 't2q1', 'Close the case immediately and stop follow-up',                                   FALSE, 2),
  ('t2q1c', 't2q1', 'Pressure for same-day payment only',                                              FALSE, 3),
  ('t2q2a', 't2q2', 'Document concerns and next actions after each meeting',                           TRUE,  1),
  ('t2q2b', 't2q2', 'Wait for clients to message first every time',                                    FALSE, 2),
  ('t2q2c', 't2q2', 'Use one script for every client scenario',                                        FALSE, 3),
  ('t2q3a', 't2q3', 'Training completion status and key client follow-up outcomes',                    TRUE,  1),
  ('t2q3b', 't2q3', 'Only personal notes with no next steps',                                          FALSE, 2),
  ('t2q3c', 't2q3', 'No records, only verbal updates',                                                 FALSE, 3);


-- ── 10. TEAM ROSTER  ─────────────────────────────────────────────────────────
-- From training.js TEAM_MAP — L123 manages 3 agents, D123 manages 5.

INSERT IGNORE INTO team_roster (manager_id, agent_id, joined_at) VALUES
  ('L123', 'A123', '2026-01-01 09:00:00'),
  ('L123', 'A124', '2026-01-01 09:00:00'),
  ('L123', 'A125', '2026-01-01 09:00:00'),
  ('D123', 'A123', '2026-01-01 09:00:00'),
  ('D123', 'A124', '2026-01-01 09:00:00'),
  ('D123', 'A125', '2026-01-01 09:00:00'),
  ('D123', 'A126', '2026-01-01 09:00:00'),
  ('D123', 'A127', '2026-01-01 09:00:00');


-- ── 11. AGENT PERFORMANCE  ───────────────────────────────────────────────────
-- 10 agents from agent-comparison.js AGENTS, period "Jan - May 2026".
-- District-wide breakdowns (monthlyYtd, weekly, menteeStatuses) embedded in
-- A123's extra so the dashboard overview can read them.

INSERT IGNORE INTO agent_performance (agent_id, period_year, period_label, ytd_fyc, yearly_target, weekly_fyc, last_week_fyc, district_rank, delta_pct, total_cases, team_name, extra) VALUES
  ('A123', 2026, 'Jan - May', 34525, 1500000, 6913, 5187,  1,  435, 14, 'SP-ALPHA-GABY',
   '{"monthlyYtd":[{"month":"Jan","value":6200},{"month":"Feb","value":12400},{"month":"Mar","value":18800},{"month":"Apr","value":33100},{"month":"May","value":45500},{"month":"Jun","value":58600},{"month":"Jul","value":68800},{"month":"Aug","value":74200},{"month":"Sep","value":87500},{"month":"Oct","value":96800},{"month":"Nov","value":104600},{"month":"Dec","value":111800}],"weekly":[{"day":"Mon","fyc":4200,"cases":2},{"day":"Tue","fyc":6800,"cases":3},{"day":"Wed","fyc":2600,"cases":1},{"day":"Thu","fyc":9100,"cases":4},{"day":"Fri","fyc":5600,"cases":2}],"menteeStatuses":["Top producer","Consistent follow-up","Needs weekly coaching","Pipeline review due"]}'),
  ('A124', 2026, 'Jan - May', 23210, NULL, NULL, NULL,  2,   44, 10, 'SP-BETA-GABY',    '{}'),
  ('A125', 2026, 'Jan - May',  9400, NULL, NULL, NULL,  3,  -39,  5, 'SP-GAMMA-GABY',   '{}'),
  ('A126', 2026, 'Jan - May',  8025, NULL, NULL, NULL,  4,    0,  4, 'SP-DELTA-GABY',   '{}'),
  ('A127', 2026, 'Jan - May',  7627, NULL, NULL, NULL,  5,  -26,  4, 'SP-EPSILON-GABY', '{}'),
  ('A128', 2026, 'Jan - May',  6577, NULL, NULL, NULL,  6,  346,  3, 'SP-ZETA-GABY',    '{}'),
  ('A129', 2026, 'Jan - May',  6100, NULL, NULL, NULL,  7,   76,  3, 'SP-ETA-GABY',     '{}'),
  ('A130', 2026, 'Jan - May',  5240, NULL, NULL, NULL,  8,  -55,  2, 'SP-THETA-GABY',   '{}'),
  ('A131', 2026, 'Jan - May',  4941, NULL, NULL, NULL,  9,  -56,  2, 'SP-IOTA-GABY',    '{}'),
  ('A132', 2026, 'Jan - May',  2022, NULL, NULL, NULL, 10,    0,  1, 'SP-KAPPA-GABY',   '{}');


-- ── 12. CPF TRACKER  ─────────────────────────────────────────────────────────
-- From dashboard.js cpfTrackerData. Linked to A123 (the demo agent).

INSERT INTO cpf_tracker_entries (agent_id, client_name, account_focus, status, amount, note) VALUES
  ('A123', 'Tan Wei Ming',        'OA allocation', 'Review due',     '42000', 'Confirm CPF nomination and protection gap before revised proposal.'),
  ('A123', 'Nur Aisyah Rahman',   'MA buffer',     'On track',       '28000', 'Family health plan discussion includes MediSave affordability check.'),
  ('A123', 'Marcus Lim',          'SA planning',   'Action needed',  '36000', 'Prepare retirement income projection before next F2F meeting.');
