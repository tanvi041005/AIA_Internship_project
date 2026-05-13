# AWS Hosting Guide — AIA Financial Agent Dashboard

> This guide covers hosting the full project on AWS using the Free Tier.
> It is split into two phases:
> - **Phase 1** — Host the static frontend (no code changes needed, live in ~30 min)
> - **Phase 2** — Add a real database and API layer (replaces localStorage)

---

## Architecture Overview

```
Users (Browser)
      │
      ▼
 CloudFront (HTTPS CDN)
      │
      ├──► S3 Bucket (frontend/ HTML, CSS, JS)
      │
      └──► API Gateway ──► Lambda Functions ──► RDS (MySQL)
```

| AWS Service | Purpose | Free Tier Limit |
|---|---|---|
| **S3** | Hosts all frontend static files | 5 GB storage, 20K GET/month |
| **CloudFront** | HTTPS + global CDN in front of S3 | 1 TB transfer, 10M requests/month |
| **RDS (MySQL)** | Relational database (all 25 tables) | 750 hrs/month db.t3.micro, 20 GB — **12 months only** |
| **Lambda** | Serverless API functions | 1M requests/month — **always free** |
| **API Gateway** | HTTP endpoints that invoke Lambda | 1M calls/month — **12 months free** |
| **IAM** | Permissions and roles | Always free |

> **Cost after 12 months:** RDS and API Gateway leave the free tier. Estimated cost: ~$15–25 USD/month for small usage. Lambda and S3 remain free indefinitely at this scale.

---

## Prerequisites

1. Create a free AWS account at [https://aws.amazon.com/free](https://aws.amazon.com/free)
   - Requires a credit card (not charged within free tier limits)
   - Set up billing alerts immediately (see Step 0)

2. Install the AWS CLI:
   ```bash
   # Windows (via installer)
   # Download from: https://aws.amazon.com/cli/
   # Then verify:
   aws --version
   ```

3. Configure the CLI with your credentials:
   ```bash
   aws configure
   # Enter: Access Key ID, Secret Access Key, Region (ap-southeast-1 for Singapore), output format (json)
   ```
   > Get your Access Key from AWS Console → IAM → Users → Your User → Security Credentials.

---

## Step 0 — Set a Billing Alarm (Do This First)

Prevents unexpected charges if you exceed free tier.

1. Go to AWS Console → **Billing** → **Budgets** → **Create Budget**
2. Choose **Cost Budget**
3. Set amount: `$5`
4. Set alert threshold: 80% of budget
5. Enter your email for notifications
6. Click **Create Budget**

---

# PHASE 1 — Host the Static Frontend

## Step 1 — Create an S3 Bucket

1. Go to AWS Console → **S3** → **Create bucket**
2. Set **Bucket name**: `aia-dashboard-frontend` *(must be globally unique — add your initials if taken)*
3. **Region**: `ap-southeast-1` (Singapore)
4. **Uncheck** "Block all public access" → confirm the warning
5. Leave all other settings as default
6. Click **Create bucket**

## Step 2 — Enable Static Website Hosting on S3

1. Click your new bucket → **Properties** tab
2. Scroll to **Static website hosting** → **Edit**
3. Enable it, set:
   - **Index document**: `index.html`
   - **Error document**: `index.html`
4. Save changes
5. Note the **Bucket website endpoint** URL shown (e.g. `http://aia-dashboard-frontend.s3-website-ap-southeast-1.amazonaws.com`)

## Step 3 — Set a Bucket Policy for Public Read

1. Click your bucket → **Permissions** tab → **Bucket policy** → **Edit**
2. Paste the following (replace `aia-dashboard-frontend` with your bucket name):

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "PublicReadGetObject",
      "Effect": "Allow",
      "Principal": "*",
      "Action": "s3:GetObject",
      "Resource": "arn:aws:s3:::aia-dashboard-frontend/*"
    }
  ]
}
```

3. Click **Save changes**

## Step 4 — Upload All Project Folders

The project has three folders that must be uploaded separately, preserving the folder structure.
The HTML files in `frontend/` use relative paths like `../css/` and `../backend/`, so all three
folders must exist side-by-side inside the bucket.

From your project root, run:

```bash
aws s3 sync ./frontend s3://aia-dashboard-frontend/frontend --delete
aws s3 sync ./backend  s3://aia-dashboard-frontend/backend  --delete
aws s3 sync ./css      s3://aia-dashboard-frontend/css      --delete
```

This produces the following structure in S3:
```
s3://aia-dashboard-frontend/
├── frontend/   ← HTML files
├── backend/    ← JS files (nav.js, auth.js, page scripts…)
└── css/        ← CSS files (styles.css, leads.css…)
```

The `--delete` flag removes any files in S3 that no longer exist locally.

> **Test it:** Visit `<S3 website endpoint>/frontend/index.html` in your browser.
> Note: At this point it still uses `localStorage` — that is addressed in Phase 2.

## Step 5 — Set Up CloudFront (HTTPS + CDN)

S3 website hosting is HTTP only. CloudFront adds HTTPS for free.

### 5.1 — Create the distribution

1. Go to AWS Console → **CloudFront** → **Create distribution**
2. **Origin domain**: Select your S3 bucket from the dropdown
3. **Origin path**: Leave **blank** (the project folders `frontend/`, `backend/`, `css/` all sit at the bucket root)
4. **Origin access**: Select **Origin access control settings (recommended)**
   - Create a new OAC when prompted
5. **Viewer protocol policy**: **Redirect HTTP to HTTPS**
6. **Default root object**: Leave **blank** (handled by the CloudFront Function in step 5.3)
7. **Price class**: Use only North America, Europe, Asia (reduces cost)
8. Click **Create distribution**

> CloudFront takes 5–15 minutes to deploy globally.

9. Once deployed, copy the **Distribution domain name** (e.g. `d1abc123.cloudfront.net`)

10. **Bucket policy update (only if you chose OAC in step 4):**
    - In the CloudFront console, open your distribution → **Origins** tab → edit the origin
    - Look for a blue **"Copy policy"** banner at the top of the page
    - Copy the policy, then go to S3 → your bucket → **Permissions** → **Bucket policy** and paste it
    - **If you chose "Public" origin access**, skip this — your existing public bucket policy already works

### 5.2 — Why a redirect function is needed

The project HTML files live in `frontend/` and reference assets with relative paths (`../css/`, `../backend/`). If CloudFront simply serves `frontend/index.html` at the root URL `/`, the browser's base URL stays as `/` — so relative links like `login.html` resolve to `/login.html` instead of `/frontend/login.html` and break.

The fix is a **CloudFront Function** that issues a proper HTTP 301 redirect from `/` to `/frontend/index.html`, moving the browser URL into the `frontend/` context where all relative paths resolve correctly.

### 5.3 — Create the root redirect CloudFront Function

1. Go to **CloudFront** → **Functions** → **Create function**
2. **Name**: `aia-root-redirect`
3. **Runtime**: `cloudfront-js-2.0`
4. Replace the default code with:

```javascript
function handler(event) {
    var uri = event.request.uri;
    if (uri === '/' || uri === '') {
        return {
            statusCode: 301,
            statusDescription: 'Moved Permanently',
            headers: {
                location: { value: '/frontend/index.html' }
            }
        };
    }
    return event.request;
}
```

5. Click **Save changes** → then **Publish**

### 5.4 — Attach the function to your distribution

1. Go to **CloudFront** → your distribution → **Behaviors** tab
2. Select the **Default (\*)** behavior → **Edit**
3. Scroll to **Function associations**
4. Under **Viewer request** → select **CloudFront Functions** → choose `aia-root-redirect`
5. Save changes and wait for the distribution to redeploy (~2 min)

> **Your site is now live at `https://d1abc123.cloudfront.net`**
> Visiting the root URL redirects to `/frontend/index.html` and all navigation works from there.

## Step 6 — Re-deploy After Any Changes

Any time you change files, sync only the folders that changed:

```bash
aws s3 sync ./frontend s3://aia-dashboard-frontend/frontend --delete
aws s3 sync ./backend  s3://aia-dashboard-frontend/backend  --delete
aws s3 sync ./css      s3://aia-dashboard-frontend/css      --delete
```

Then invalidate the CloudFront cache so users see the latest version:

```bash
aws cloudfront create-invalidation \
  --distribution-id YOUR_DISTRIBUTION_ID \
  --paths "/*"
```

Replace `YOUR_DISTRIBUTION_ID` with the ID shown in the CloudFront console.

---

# PHASE 2 — Add the Database and API Layer

This phase replaces all `localStorage` calls in the frontend with real HTTP API calls backed by a MySQL database on RDS.

---

## Step 7 — Create a VPC and Security Groups

All backend resources must live in a Virtual Private Cloud (VPC).

1. Go to **VPC** → **Create VPC**
   - Choose **VPC and more** (creates subnets automatically)
   - Name: `aia-dashboard-vpc`
   - IPv4 CIDR: `10.0.0.0/16`
   - Availability zones: 2
   - Public subnets: 2, Private subnets: 2
   - Click **Create VPC**

2. Create the **Lambda security group first** — Go to **EC2** → **Security Groups** → **Create security group**
   - Name: `aia-lambda-sg`
   - VPC: `aia-dashboard-vpc`
   - Inbound rules: none (Lambda initiates connections outward, nothing connects inbound to it)
   - Outbound: leave as default (All traffic)
   - Click **Create security group**

3. Create the **RDS security group** — **Create security group** again
   - Name: `aia-rds-sg`
   - VPC: `aia-dashboard-vpc`
   - Add **two** inbound rules:
     - Type `MySQL/Aurora`, Port `3306`, Source: **`aia-lambda-sg`** — allows Lambda to reach RDS
     - Type `MySQL/Aurora`, Port `3306`, Source: **`0.0.0.0/0`** — allows all developers to connect via MySQL Workbench
   - Click **Create security group**

> **Security note:** `0.0.0.0/0` means anyone on the internet can attempt a connection. The only protection is your RDS password — use a long, random password (20+ characters) and never commit it to git.

## Step 8 — Launch an RDS MySQL Instance

1. Go to **RDS** → **Create database**
2. Choose:
   - **Standard create**
   - **Engine**: MySQL
   - **Version**: MySQL 8.0.x (latest 8.0)
   - **Template**: **Free tier**
3. Settings:
   - **DB instance identifier**: `aia-dashboard-db`
   - **Master username**: `admin`
   - **Master password**: choose a strong password and save it securely
4. Instance configuration:
   - **DB instance class**: `db.t3.micro` (free tier)
5. Storage:
   - **Allocated storage**: 20 GB (free tier maximum)
   - **Disable storage autoscaling** (to avoid charges)
6. Connectivity:
   - **VPC**: `aia-dashboard-vpc`
   - **Subnet group**: choose a **public subnet** (so RDS gets a public DNS endpoint)
   - **Public access**: **Yes** (required for developers to connect via MySQL Workbench)
   - **VPC security group**: `aia-rds-sg`
7. Additional configuration:
   - **Initial database name**: `aia_dashboard`
8. Click **Create database**

> RDS takes 5–10 minutes to provision. Note the **Endpoint** URL shown once it is available (e.g. `aia-dashboard-db.xxxx.ap-southeast-1.rds.amazonaws.com`).

## Step 9 — Create the Database Schema

Connect to RDS directly from MySQL Workbench on your laptop:

1. Open MySQL Workbench → **+** to add a new connection
2. Set:
   - **Hostname**: your RDS endpoint (e.g. `aia-dashboard-db.xxxx.ap-southeast-1.rds.amazonaws.com`)
   - **Port**: `3306`
   - **Username**: `admin`
   - **Password**: your RDS master password
3. Click **Test Connection** to verify, then **OK**
4. Open the connection, paste the entire SQL block below into the query editor, and click **Execute (⚡)**



```sql
CREATE DATABASE IF NOT EXISTS aia_dashboard;
USE aia_dashboard;

-- ── Domain 1: User Management ───────────────────────────────────────────────

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
  created_at    DATETIME      DEFAULT NOW(),
  FOREIGN KEY (role_id) REFERENCES roles(role_id)
);

-- ── Domain 2: CRM / Leads ───────────────────────────────────────────────────

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
  created_at      DATETIME        DEFAULT NOW(),
  updated_at      DATETIME        ON UPDATE NOW(),
  FOREIGN KEY (owner_id) REFERENCES users(user_id)
);

CREATE TABLE follow_ups (
  follow_up_id   INT           AUTO_INCREMENT PRIMARY KEY,
  lead_id        INT           NOT NULL,
  label          VARCHAR(100)  NOT NULL,
  scheduled_date DATE,
  is_done        BOOLEAN       DEFAULT FALSE,
  FOREIGN KEY (lead_id) REFERENCES leads(lead_id) ON DELETE CASCADE
);

-- ── Domain 3: Calendar ──────────────────────────────────────────────────────

CREATE TABLE personal_tasks (
  task_id             VARCHAR(50)   PRIMARY KEY,
  user_id             VARCHAR(10)   NOT NULL,
  title               VARCHAR(200)  NOT NULL,
  due_date            DATE,
  source              VARCHAR(20),
  linked_event_title  VARCHAR(200),
  is_done             BOOLEAN       DEFAULT FALSE,
  created_at          DATETIME      DEFAULT NOW(),
  FOREIGN KEY (user_id) REFERENCES users(user_id)
);

CREATE TABLE calendar_events (
  event_id          VARCHAR(50)   PRIMARY KEY,
  title             VARCHAR(200)  NOT NULL,
  event_date        DATE          NOT NULL,
  start_time        TIME,
  end_time          TIME,
  location          VARCHAR(200),
  event_type        VARCHAR(50),
  category          ENUM('personal','agency','holiday') NOT NULL,
  notes             TEXT,
  attendance_token  VARCHAR(100),
  recurrence_id     VARCHAR(50),
  linked_task_id    VARCHAR(50),
  task_title        VARCHAR(100),
  is_editable       BOOLEAN       DEFAULT TRUE,
  created_by        VARCHAR(10),
  created_at        DATETIME      DEFAULT NOW(),
  FOREIGN KEY (linked_task_id) REFERENCES personal_tasks(task_id) ON DELETE SET NULL,
  FOREIGN KEY (created_by)     REFERENCES users(user_id)
);

CREATE TABLE public_holidays (
  holiday_id    INT           AUTO_INCREMENT PRIMARY KEY,
  holiday_date  DATE          NOT NULL,
  name          VARCHAR(100)  NOT NULL,
  year          INT           NOT NULL,
  country_code  CHAR(2)       DEFAULT 'SG'
);

-- ── Domain 5: Attendance ────────────────────────────────────────────────────

CREATE TABLE attendance_records (
  record_id      VARCHAR(50)   PRIMARY KEY,
  event_id       VARCHAR(50)   NOT NULL,
  event_title    VARCHAR(200),
  user_id        VARCHAR(10)   NOT NULL,
  check_in_time  DATETIME      NOT NULL,
  status         ENUM('Present','Late') NOT NULL,
  FOREIGN KEY (event_id) REFERENCES calendar_events(event_id),
  FOREIGN KEY (user_id)  REFERENCES users(user_id)
);

-- ── Domain 6: Room Booking ──────────────────────────────────────────────────

CREATE TABLE rooms (
  room_id    VARCHAR(20)   PRIMARY KEY,
  label      VARCHAR(100)  NOT NULL,
  css_class  VARCHAR(50),
  dot_color  VARCHAR(20),
  is_active  BOOLEAN       DEFAULT TRUE
);

INSERT INTO rooms (room_id, label, css_class, dot_color) VALUES
  ('eagle',       'Eagle Boardroom',        'room-eagle',       '#93c5fd'),
  ('summit',      'Summit Event Hall',      'room-summit',      '#fca5a5'),
  ('ark',         'Ark (near Eagle)',        'room-ark',         '#6ee7b7'),
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
  created_at     DATETIME      DEFAULT NOW(),
  FOREIGN KEY (room_id)      REFERENCES rooms(room_id),
  FOREIGN KEY (booked_by_id) REFERENCES users(user_id) ON DELETE SET NULL
);

-- ── Domain 7: Announcements ─────────────────────────────────────────────────

CREATE TABLE announcements (
  announcement_id  VARCHAR(50)   PRIMARY KEY,
  title            VARCHAR(100)  NOT NULL,
  category         VARCHAR(60)   NOT NULL,
  message          TEXT          NOT NULL,
  response_type    ENUM('acknowledge','rsvp','status') NOT NULL,
  created_by       VARCHAR(10)   NOT NULL,
  created_at       DATETIME      NOT NULL,
  FOREIGN KEY (created_by) REFERENCES users(user_id)
);

CREATE TABLE announcement_responses (
  response_id      INT           AUTO_INCREMENT PRIMARY KEY,
  announcement_id  VARCHAR(50)   NOT NULL,
  user_id          VARCHAR(10)   NOT NULL,
  choice           VARCHAR(20)   NOT NULL,
  note             TEXT,
  responded_at     DATETIME      NOT NULL,
  UNIQUE KEY uq_response (announcement_id, user_id),
  FOREIGN KEY (announcement_id) REFERENCES announcements(announcement_id) ON DELETE CASCADE,
  FOREIGN KEY (user_id)         REFERENCES users(user_id)
);

-- ── Domain 8: Helpdesk ──────────────────────────────────────────────────────

CREATE TABLE helpdesk_tickets (
  ticket_id     INT           PRIMARY KEY,
  title         VARCHAR(200)  NOT NULL,
  description   TEXT,
  reporter_name VARCHAR(100)  NOT NULL,
  reporter_id   VARCHAR(10),
  reported_at   DATETIME      NOT NULL,
  priority      ENUM('high','medium','low') NOT NULL,
  status        ENUM('open','progress','done') NOT NULL,
  category      VARCHAR(50)   NOT NULL,
  updated_at    DATETIME      ON UPDATE NOW(),
  FOREIGN KEY (reporter_id) REFERENCES users(user_id) ON DELETE SET NULL
);

-- ── Domain 9: Sales Tracker ─────────────────────────────────────────────────

CREATE TABLE activity_types (
  activity_type_id  VARCHAR(20)  PRIMARY KEY,
  label             VARCHAR(50)  NOT NULL,
  points            INT          NOT NULL
);

INSERT INTO activity_types (activity_type_id, label, points) VALUES
  ('activity',  'Activity',       3),
  ('contact',   'Contact',        1),
  ('schedule',  'Schedule Appt',  2),
  ('casual',    'Casual Meetup',  2),
  ('insurance', 'Insurance Appt', 5),
  ('referral',  'Referral',       3),
  ('case',      'Case Closed',   10);

CREATE TABLE sales_entries (
  entry_id          VARCHAR(50)   PRIMARY KEY,
  agent_id          VARCHAR(10)   NOT NULL,
  entry_date        DATE          NOT NULL,
  activity_type_id  VARCHAR(20)   NOT NULL,
  count             INT           NOT NULL DEFAULT 1,
  client_name       VARCHAR(100),
  status            VARCHAR(50),
  notes             TEXT,
  created_at        DATETIME      NOT NULL,
  FOREIGN KEY (agent_id)         REFERENCES users(user_id),
  FOREIGN KEY (activity_type_id) REFERENCES activity_types(activity_type_id)
);

CREATE TABLE sales_reflections (
  reflection_id   INT      AUTO_INCREMENT PRIMARY KEY,
  agent_id        VARCHAR(10)  NOT NULL,
  reflection_date DATE         NOT NULL,
  went_well       TEXT,
  went_poorly     TEXT,
  to_improve      TEXT,
  UNIQUE KEY uq_reflection (agent_id, reflection_date),
  FOREIGN KEY (agent_id) REFERENCES users(user_id)
);

-- ── Domain 10: Training ─────────────────────────────────────────────────────

CREATE TABLE training_topics (
  topic_id    VARCHAR(10)   PRIMARY KEY,
  title       VARCHAR(200)  NOT NULL,
  youtube_id  VARCHAR(50),
  sort_order  INT           NOT NULL
);

CREATE TABLE quiz_questions (
  question_id    VARCHAR(20)  PRIMARY KEY,
  topic_id       VARCHAR(10)  NOT NULL,
  question_text  TEXT         NOT NULL,
  sort_order     INT          NOT NULL,
  FOREIGN KEY (topic_id) REFERENCES training_topics(topic_id) ON DELETE CASCADE
);

CREATE TABLE quiz_options (
  option_id    VARCHAR(20)  PRIMARY KEY,
  question_id  VARCHAR(20)  NOT NULL,
  label        TEXT         NOT NULL,
  is_correct   BOOLEAN      NOT NULL DEFAULT FALSE,
  FOREIGN KEY (question_id) REFERENCES quiz_questions(question_id) ON DELETE CASCADE
);

CREATE TABLE training_progress (
  progress_id  INT          AUTO_INCREMENT PRIMARY KEY,
  user_id      VARCHAR(10)  NOT NULL,
  topic_id     VARCHAR(10)  NOT NULL,
  video_done   BOOLEAN      DEFAULT FALSE,
  quiz_passed  BOOLEAN      DEFAULT FALSE,
  updated_at   DATETIME     ON UPDATE NOW(),
  UNIQUE KEY uq_progress (user_id, topic_id),
  FOREIGN KEY (user_id)  REFERENCES users(user_id),
  FOREIGN KEY (topic_id) REFERENCES training_topics(topic_id)
);

-- ── Domain 11: Team Management ──────────────────────────────────────────────

CREATE TABLE team_roster (
  roster_id   INT          AUTO_INCREMENT PRIMARY KEY,
  manager_id  VARCHAR(10)  NOT NULL,
  agent_id    VARCHAR(10)  NOT NULL,
  notes       TEXT,
  joined_at   DATETIME     NOT NULL,
  UNIQUE KEY uq_roster (manager_id, agent_id),
  FOREIGN KEY (manager_id) REFERENCES users(user_id),
  FOREIGN KEY (agent_id)   REFERENCES users(user_id)
);

-- ── Domain 12: Recruitment ──────────────────────────────────────────────────

CREATE TABLE recruitment_programs (
  program_id        INT           AUTO_INCREMENT PRIMARY KEY,
  name              VARCHAR(100)  NOT NULL,
  total_opens       INT           DEFAULT 0,
  total_interviews  INT           DEFAULT 0,
  total_offers      INT           DEFAULT 0,
  status            ENUM('active','open','closed') NOT NULL,
  created_by        VARCHAR(10),
  created_at        DATETIME      DEFAULT NOW(),
  FOREIGN KEY (created_by) REFERENCES users(user_id) ON DELETE SET NULL
);

CREATE TABLE recruitment_funnel_stages (
  stage_id         INT           AUTO_INCREMENT PRIMARY KEY,
  program_id       INT,
  label            VARCHAR(100)  NOT NULL,
  candidate_count  INT           DEFAULT 0,
  percentage       DECIMAL(5,2),
  detail_text      TEXT,
  sort_order       INT           NOT NULL,
  FOREIGN KEY (program_id) REFERENCES recruitment_programs(program_id) ON DELETE CASCADE
);

CREATE TABLE recruitment_sources (
  source_id   INT           AUTO_INCREMENT PRIMARY KEY,
  program_id  INT,
  label       VARCHAR(50)   NOT NULL,
  percentage  DECIMAL(5,2)  NOT NULL,
  FOREIGN KEY (program_id) REFERENCES recruitment_programs(program_id) ON DELETE CASCADE
);

-- ── Domain 13: Agent Performance ────────────────────────────────────────────

CREATE TABLE agent_performance (
  performance_id  INT           AUTO_INCREMENT PRIMARY KEY,
  agent_id        VARCHAR(10)   NOT NULL,
  period_year     INT           NOT NULL,
  period_label    VARCHAR(30)   NOT NULL,
  ytd_fyc         DECIMAL(12,2),
  district_rank   INT,
  delta_pct       DECIMAL(8,2),
  total_cases     INT           DEFAULT 0,
  team_name       VARCHAR(50),
  updated_at      DATETIME      ON UPDATE NOW(),
  UNIQUE KEY uq_performance (agent_id, period_year, period_label),
  FOREIGN KEY (agent_id) REFERENCES users(user_id)
);
```

---

## Step 10 — Create a Single Lambda Function for the API

One Lambda function handles every domain. It inspects the request path and method internally and dispatches to the right handler — no separate function per module needed.

### 10.1 — Set up the Lambda execution role

1. Go to **IAM** → **Roles** → **Create role**
2. Trusted entity: **AWS service** → **Lambda**
3. Attach policies:
   - `AWSLambdaBasicExecutionRole`
   - `AWSLambdaVPCAccessExecutionRole`
4. Name it: `aia-lambda-role`

### 10.2 — Create a Lambda layer for the MySQL driver

```bash
mkdir -p lambda-layer/nodejs
cd lambda-layer/nodejs
npm install mysql2
cd ..
zip -r mysql2-layer.zip nodejs/
```

1. Go to **Lambda** → **Layers** → **Create layer**
2. Name: `mysql2-layer`
3. Upload `mysql2-layer.zip`
4. Compatible runtimes: `Node.js 20.x`

### 10.3 — Create the Lambda function

1. Go to **Lambda** → **Create function**
2. **Author from scratch**
   - Name: `aia-api`
   - Runtime: `Node.js 20.x`
   - Execution role: `aia-lambda-role`
3. **Advanced settings** → Enable VPC → select `aia-dashboard-vpc`, private subnets, security group **`aia-lambda-sg`**
4. Add the `mysql2-layer` under **Layers**

In the inline code editor:
- Confirm the entry file is **`index.mjs`** (recent Node.js 20.x Lambdas default to this). If you see `index.js` instead, right-click → Rename to `index.mjs`. The `.mjs` extension tells Node.js to treat the file as an ES module so `import`/`export` syntax works.
- Leave the **Handler** field as `index.handler` (Configuration → General configuration).

Paste the following as the function code:

```javascript
// index.mjs
import mysql from 'mysql2/promise';

const DB_CONFIG = {
  host:     process.env.DB_HOST,
  user:     process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
};

const HEADERS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
};

const ok      = (body) => ({ statusCode: 200, headers: HEADERS, body: JSON.stringify(body) });
const created = (body) => ({ statusCode: 201, headers: HEADERS, body: JSON.stringify(body) });
const notFound = ()   => ({ statusCode: 404, headers: HEADERS, body: JSON.stringify({ error: 'Not found' }) });

// ── Leads ──────────────────────────────────────────────────────────────────────
async function handleLeads(method, event, conn) {
  if (method === 'GET') {
    const userId = event.queryStringParameters?.userId;
    const [rows] = await conn.execute(
      'SELECT * FROM leads WHERE owner_id = ? ORDER BY created_at DESC', [userId]
    );
    return ok(rows);
  }
  if (method === 'POST') {
    const d = JSON.parse(event.body);
    const [r] = await conn.execute(
      `INSERT INTO leads (name,age,contact,email,meet_date,location,meet_type,urgency,stage,
         remarks,plan_type,annual_premium,commission_type,cpf_oa,cpf_sa,occupation,income,referred_by,owner_id)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [d.name,d.age,d.contact,d.email,d.meetDate,d.location,d.meetType,d.urgency,d.stage,
       d.remarks,d.planType,d.premium,d.commission,d.cpfOA,d.cpfSA,d.occupation,d.income,d.referredBy,d.ownerId]
    );
    return created({ id: r.insertId });
  }
  return notFound();
}

// ── Announcements ─────────────────────────────────────────────────────────────
async function handleAnnouncements(method, event, conn) {
  if (method === 'GET') {
    const [rows] = await conn.execute('SELECT * FROM announcements ORDER BY created_at DESC');
    return ok(rows);
  }
  if (method === 'POST') {
    const d = JSON.parse(event.body);
    const id = 'a' + Date.now();
    await conn.execute(
      `INSERT INTO announcements (announcement_id,title,category,message,response_type,created_by,created_at)
       VALUES (?,?,?,?,?,?,NOW())`,
      [id, d.title, d.category, d.message, d.responseType, d.createdBy]
    );
    return created({ id });
  }
  return notFound();
}

// ── Sales Tracker ─────────────────────────────────────────────────────────────
async function handleSales(method, event, conn) {
  if (method === 'GET') {
    const agentId = event.queryStringParameters?.agentId;
    const [rows] = await conn.execute(
      'SELECT * FROM sales_entries WHERE agent_id = ? ORDER BY entry_date DESC', [agentId]
    );
    return ok(rows);
  }
  if (method === 'POST') {
    const d = JSON.parse(event.body);
    await conn.execute(
      `INSERT INTO sales_entries (entry_id,agent_id,entry_date,activity_type_id,count,client_name,status,notes,created_at)
       VALUES (?,?,?,?,?,?,?,?,NOW())`,
      [d.entryId, d.agentId, d.date, d.activityId, d.count, d.client, d.status, d.notes]
    );
    return created({ id: d.entryId });
  }
  return notFound();
}

// ── Room Bookings ─────────────────────────────────────────────────────────────
async function handleRoomBookings(method, event, conn) {
  if (method === 'GET') {
    const [rows] = await conn.execute('SELECT * FROM room_bookings ORDER BY booking_date, start_time');
    return ok(rows);
  }
  if (method === 'POST') {
    const d = JSON.parse(event.body);
    const [r] = await conn.execute(
      `INSERT INTO room_bookings (title,room_id,booking_date,start_time,end_time,booked_by_id,booked_by_name,notes,recurrence,recurrence_end)
       VALUES (?,?,?,?,?,?,?,?,?,?)`,
      [d.title, d.roomId, d.date, d.start, d.end, d.bookedById || null, d.bookedByName, d.notes || null, d.recurrence || 'none', d.recurrenceEnd || null]
    );
    return created({ id: r.insertId });
  }
  if (method === 'DELETE') {
    const id = event.pathParameters?.id;
    await conn.execute('DELETE FROM room_bookings WHERE booking_id = ?', [id]);
    return ok({ deleted: id });
  }
  return notFound();
}

// ── Training ──────────────────────────────────────────────────────────────────
async function handleTraining(method, event, conn) {
  if (method === 'GET') {
    const [topics] = await conn.execute('SELECT * FROM training_topics ORDER BY sort_order');
    const [questions] = await conn.execute('SELECT * FROM quiz_questions ORDER BY sort_order');
    const [options] = await conn.execute('SELECT * FROM quiz_options');
    return ok({ topics, questions, options });
  }
  return notFound();
}

// ── Helpdesk ──────────────────────────────────────────────────────────────────
async function handleHelpdesk(method, event, conn) {
  if (method === 'GET') {
    const [rows] = await conn.execute('SELECT * FROM helpdesk_tickets ORDER BY reported_at DESC');
    return ok(rows);
  }
  if (method === 'POST') {
    const d = JSON.parse(event.body);
    const [r] = await conn.execute(
      `INSERT INTO helpdesk_tickets (title,description,reporter_name,reporter_id,reported_at,priority,status,category)
       VALUES (?,?,?,?,NOW(),?,?,?)`,
      [d.title, d.description, d.reporterName, d.reporterId || null, d.priority, d.status, d.category]
    );
    return created({ id: r.insertId });
  }
  return notFound();
}

// ── Calendar Events ───────────────────────────────────────────────────────────
async function handleCalendar(method, event, conn) {
  if (method === 'GET') {
    const [events] = await conn.execute('SELECT * FROM calendar_events ORDER BY event_date');
    const [holidays] = await conn.execute('SELECT * FROM public_holidays ORDER BY holiday_date');
    return ok({ events, holidays });
  }
  return notFound();
}

// ── Router ────────────────────────────────────────────────────────────────────
export const handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: HEADERS, body: '' };
  }

  const conn   = await mysql.createConnection(DB_CONFIG);
  const method = event.httpMethod;
  const path   = (event.path || '').replace(/\/$/, '');

  try {
    if (path === '/leads')         return await handleLeads(method, event, conn);
    if (path === '/announcements') return await handleAnnouncements(method, event, conn);
    if (path === '/sales')         return await handleSales(method, event, conn);
    if (path.startsWith('/room-bookings')) return await handleRoomBookings(method, event, conn);
    if (path === '/training')      return await handleTraining(method, event, conn);
    if (path === '/helpdesk')      return await handleHelpdesk(method, event, conn);
    if (path === '/calendar')      return await handleCalendar(method, event, conn);
    return notFound();
  } finally {
    await conn.end();
  }
};
```

5. Under **Configuration** → **Environment variables**, add:
   - `DB_HOST` → your RDS endpoint
   - `DB_USER` → `admin`
   - `DB_PASS` → your RDS password
   - `DB_NAME` → `aia_dashboard`

> To add a new domain, define a `handleX()` function and add one line to the router. No new Lambda functions needed.

---

## Step 11 — Set Up API Gateway

API Gateway creates the HTTPS URL your frontend calls. Because all routing is handled inside the single Lambda, you only need one catch-all route.

1. Go to **API Gateway** → **Create API** → **HTTP API**
2. Name: `aia-dashboard-api`
3. Add integration → **Lambda** → select `aia-api`
4. Define routes — add these two (both point to the same `aia-api` integration):
   - `ANY /`
   - `ANY /{proxy+}`
5. **CORS**: Enable, set allowed origin to your CloudFront domain (`https://d1abc123.cloudfront.net`)
6. **Stage**: `$default` (auto-deploy)
7. Click **Create**

> Your API base URL will look like: `https://abc123.execute-api.ap-southeast-1.amazonaws.com`
>
> `ANY /{proxy+}` passes every path and method through to the Lambda. The router inside the function handles the rest.

---

## Step 12 — Update the Frontend to Use the API

Replace `localStorage` calls in `backend/` JS files with `fetch()` API calls.

**Example — current `localStorage` pattern (leads.js):**
```javascript
const raw = localStorage.getItem("financial_leads_data");
const leads = JSON.parse(raw) || DEFAULT_LEADS;
```

**Replace with API call:**
```javascript
const API_BASE = "https://abc123.execute-api.ap-southeast-1.amazonaws.com";
const userId   = sessionStorage.getItem("dashboardUser");

const res   = await fetch(`${API_BASE}/leads?userId=${userId}`);
const leads = await res.json();
```

Create a shared `backend/api.js` file that exports a central `API_BASE` constant and helper functions (`getLeads`, `saveAnnouncement`, etc.) so all other JS files call through one place.

---

## Step 13 — Re-deploy the Updated Frontend

After updating the frontend JS files:

```bash
# Upload all three folders (preserving the folder structure the HTML files depend on)
aws s3 sync ./frontend s3://aia-dashboard-frontend/frontend --delete
aws s3 sync ./backend  s3://aia-dashboard-frontend/backend  --delete
aws s3 sync ./css      s3://aia-dashboard-frontend/css      --delete

# Invalidate CloudFront cache
aws cloudfront create-invalidation \
  --distribution-id YOUR_DISTRIBUTION_ID \
  --paths "/*"
```

---

## Step 14 — Set Up IAM Least-Privilege Access (Security)

Never use your root AWS account for deployments. Create a dedicated IAM user:

1. Go to **IAM** → **Users** → **Create user**
2. Name: `aia-deploy`
3. Attach policies:
   - `AmazonS3FullAccess` (scoped to your bucket)
   - `CloudFrontFullAccess`
   - `AWSLambda_FullAccess`
   - `AmazonAPIGatewayAdministrator`
4. Create access keys for this user and use them in `aws configure`

---

## Free Tier Usage Summary

| Service | Monthly Free Allowance | Typical Usage for This Project |
|---|---|---|
| S3 Storage | 5 GB | ~50 MB (well within limit) |
| S3 Requests | 20,000 GET | Depends on traffic |
| CloudFront Transfer | 1 TB | Well within limit for internal tool |
| CloudFront Requests | 10M | Well within limit |
| Lambda Invocations | 1M / month | Well within limit |
| Lambda Compute | 400,000 GB-seconds | Well within limit |
| RDS db.t3.micro | 750 hours / month *(12 months)* | 744 hrs = fits exactly |
| RDS Storage | 20 GB *(12 months)* | ~1–2 GB for this dataset |
| API Gateway | 1M calls / month *(12 months)* | Well within limit |

> **After 12 months:** RDS (~$15/mo) and API Gateway (~$3.50/mo) become paid.
> Consider migrating to **PlanetScale** (free MySQL) or **Supabase** (free PostgreSQL) to keep costs at $0 long-term.

---

## Checklist

### Phase 1 — Static Frontend
- [ ] AWS account created and billing alarm set
- [ ] AWS CLI installed and configured
- [ ] S3 bucket created with static website hosting enabled
- [ ] Bucket policy set to allow public read
- [ ] `frontend/`, `backend/`, and `css/` folders uploaded via `aws s3 sync`
- [ ] CloudFront distribution created (origin path blank, default root object blank)
- [ ] `aia-root-redirect` CloudFront Function created and published
- [ ] Function attached to distribution default behavior as Viewer request
- [ ] Site accessible at CloudFront HTTPS URL (`/` redirects to `/frontend/index.html`)

### Phase 2 — Database + API
- [ ] VPC and security groups configured
- [ ] RDS MySQL instance created
- [ ] Database schema applied (all 25 tables)
- [ ] Lambda execution role created
- [ ] `mysql2` Lambda layer packaged and uploaded
- [ ] Single `aia-api` Lambda function created with internal router
- [ ] Environment variables set on the Lambda function
- [ ] API Gateway HTTP API created with `ANY /` and `ANY /{proxy+}` routes
- [ ] CORS configured for CloudFront domain
- [ ] Frontend JS files updated to use `fetch()` instead of `localStorage`
- [ ] Updated frontend re-deployed and CloudFront cache invalidated
- [ ] IAM deploy user created with least-privilege policies
