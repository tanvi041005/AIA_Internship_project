PRAGMA foreign_keys = ON;

-- Identity and access control for the existing A/L/D demo login roles.
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('agent', 'leader', 'district')),
  display_name TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Lead profile fields currently stored under localStorage key financial_leads_data.
CREATE TABLE IF NOT EXISTS leads (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  owner_user_id INTEGER,
  name TEXT NOT NULL,
  age INTEGER NOT NULL CHECK (age BETWEEN 18 AND 120),
  contact TEXT NOT NULL,
  email TEXT NOT NULL,
  meet_date TEXT NOT NULL,
  location TEXT NOT NULL DEFAULT '',
  meet_type TEXT NOT NULL CHECK (meet_type IN ('Physical', 'Online', 'Hybrid')),
  urgency TEXT NOT NULL CHECK (urgency IN ('urgent', 'medium', 'non-urgent')),
  stage TEXT NOT NULL CHECK (
    stage IN (
      'Prospecting',
      'Fact Find',
      'Fact-Find',
      'Opening',
      'Needs Analysis',
      'Proposal Sent',
      'Closing'
    )
  ),
  remarks TEXT NOT NULL DEFAULT '',
  plan_type TEXT NOT NULL DEFAULT '',
  premium INTEGER NOT NULL DEFAULT 0 CHECK (premium >= 0),
  commission TEXT NOT NULL DEFAULT '',
  cpf_sa INTEGER NOT NULL DEFAULT 0 CHECK (cpf_sa >= 0),
  cpf_oa INTEGER NOT NULL DEFAULT 0 CHECK (cpf_oa >= 0),
  occupation TEXT NOT NULL DEFAULT '',
  income TEXT NOT NULL DEFAULT '',
  referred_by TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (owner_user_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS lead_follow_ups (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  lead_id INTEGER NOT NULL,
  label TEXT NOT NULL,
  due_date TEXT,
  done INTEGER NOT NULL DEFAULT 0 CHECK (done IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_leads_owner_user_id ON leads(owner_user_id);
CREATE INDEX IF NOT EXISTS idx_leads_meet_date ON leads(meet_date);
CREATE INDEX IF NOT EXISTS idx_leads_stage ON leads(stage);
CREATE INDEX IF NOT EXISTS idx_leads_urgency ON leads(urgency);
CREATE INDEX IF NOT EXISTS idx_lead_follow_ups_lead_id ON lead_follow_ups(lead_id);
CREATE INDEX IF NOT EXISTS idx_lead_follow_ups_due_date ON lead_follow_ups(due_date);
