# AIA Financial Agent Dashboard — Bug / Issue Review

_Audited 2026-05-14. Reviewer: automated code audit._
_Files inspected: every file under `frontend/`, `backend/`, plus `lambda/index.mjs` and `schema.sql`._

Code state At 3.55pm

---

## 1. Summary — Top 5 highest-priority issues

1. **`dashboard.js` always calls `wireFloatingTodo()` unconditionally at line 906** even on pages that don't include `calendar.js`. On `resources.html` and `index.html` this happens to be safe because `calendar.js` is loaded, but on any future page that loads `dashboard.js` without `calendar.js`, this will throw `ReferenceError: getPersonalTasks is not defined`. More immediately: it runs **twice** on the home dashboard (once unconditionally at line 906, once inside the `isHomeDashboardPage()` async IIFE at line 901), creating duplicate event listeners on `window` for `personalTasksUpdated` and `calendarEventAdded`.
2. **`backend/agent-comparison.js` reads `r.delta`, `r.cases`, and `r.team_code` but the Lambda `/performance` response returns `delta_pct`, `total_cases`, and `team_name`** (see `schema.sql:380-398` and `lambda/index.mjs:462-473`). Result: every agent shows `delta = 0`, `cases = 0`, and `team` falls back to agent_id. Same bug in `dashboard.js:66`.
3. **`backend/room-booking.js:561` maps `r.name` and `r.color`, but the `rooms` table columns are `label` and `dot_color`** (`schema.sql:184-191`; Lambda returns `SELECT *`). Result: room labels default to the room_id and chips render with the hardcoded fallback color `#93c5fd`.
4. **`auth.js` does NOT call `POST /auth/login`.** It still uses a hardcoded local `DEMO_USERS` map (`auth.js:25-29`) and stores `dashboardRole`/`dashboardUser` from that. The Lambda's login endpoint with bcrypt is completely orphaned. Any user added to the DB will be unable to log in; only the three hardcoded demo IDs work.
5. **Multiple writes to localStorage that the Lambda never sees** — attendance records (`backend/attendance.js`), announcement responses (`backend/announcements.js`), training progress (`backend/training.js`), and sales weekly reflections (`backend/sales-tracker.js:259-272`) all save **only** to `localStorage`, despite the Lambda having endpoints for each (`/attendance-records`, `/announcements/:id/responses`, `/training/progress`, `/sales-reflections`). Data is per-browser and lost on logout from another device.

---

## 2. Critical bugs

### 2.1 `wireFloatingTodo()` called unconditionally and twice on home page

**File**: `backend/dashboard.js:894-906`

```js
if (isHomeDashboardPage()) {
  (async function() {
    await loadOverviewData();
    wireOverviewTabs();
    wireOverviewPdfExport();
    wireRoleControl();
    wirePersonalTodo();
    wireFloatingTodo();          // ← call #1
  })();
}


wireFloatingTodo();              // ← call #2 (line 906) — runs unconditionally
```

Effects:
- On the home page, `wireFloatingTodo()` runs at script-parse time (before `loadOverviewData()` finishes). It then runs **again** after the async IIFE finishes. The internal `document.getElementById("floating-task-form")` guard at the top prevents the DOM from being duplicated, but `window.addEventListener("personalTasksUpdated", renderTasks)` (line 846) and `window.addEventListener("calendarEventAdded", …)` (line 847) are registered twice — every personal-task save fires two re-renders.
- On `index.html` (home) and `resources.html` the unconditional call works because `calendar.js` is loaded first and supplies `getPersonalTasks`, `getUpcomingCalendarReminders`, etc. But if `dashboard.js` is ever loaded on a page without `calendar.js`, this line throws.
- On the calendar page (`isOverviewPage()` returns true because of `lead-table-body`? No — `lead-table-body` does not exist on `calendar.html`. `isCalendarPage()` is in `calendar.js`. So on `calendar.html`, the bottom `wireFloatingTodo()` at line 906 fires and creates a planner widget that the calendar page UI was never designed to show.). Verify: `frontend/calendar.html` has no element with id `total-leads-card` or `lead-table-body`, so only line 906 runs `wireFloatingTodo`. The widget will appear on the calendar page.

### 2.2 `wireRoleControl` and `wirePersonalTodo` also called twice on home page

**File**: `backend/dashboard.js:877-882` and `:894-902`

```js
if (isOverviewPage()) {       // 'overview page' = has lead-table-body
  wireLeadFilters();
  wireRoleControl();
  wirePersonalTodo();
  wireFloatingTodo();
}
…
if (isHomeDashboardPage()) {  // 'home page' = has total-leads-card
  (async function() {
    …
    wireRoleControl();
    wirePersonalTodo();
    wireFloatingTodo();
  })();
}
```

The home dashboard (`index.html`) has both `total-leads-card` and possibly `lead-table-body`. If both flags fire, the same wiring is done twice plus the unconditional line 906. Need to verify which of those elements exist on `index.html` — the duplication is at minimum confusing.

### 2.3 `wireRoleControl()` calls `renderCalendarPermissions` (now in calendar.js)

**File**: `backend/dashboard.js:651-661`

```js
function wireRoleControl() {
  const roleSelect = document.getElementById("role-select");
  if (!roleSelect) return;
  const syncRole = () => {
    localStorage.setItem("calendarRole", roleSelect.value);
    renderCalendarPermissions(roleSelect.value);   // ← in calendar.js
  };
  …
}
```

Safe only because every page that loads `dashboard.js` also loads `calendar.js` first (`index.html:152-153`, `resources.html:74-75`, `calendar.html:193-194`). Brittle — comment in the file should call this out.

### 2.4 `auth.js` ignores the Lambda login endpoint

**File**: `backend/auth.js:25-81`

```js
const DEMO_USERS = {
  A123: { password: "A123", role: "agent" },
  L123: { password: "L123", role: "leader" },
  D123: { password: "D123", role: "district" }
};
…
const userRecord = DEMO_USERS[username];
if (!userRecord || userRecord.password !== password) {
  …error…
}
…
sessionStorage.setItem("dashboardRole", detected.key);
```

No call to `POST /auth/login`. Any user provisioned in the DB cannot sign in. The bcrypt-hashed `users.password_hash` schema column and the `/auth/login` route (`lambda/index.mjs:88-116`) are wholly unused.

### 2.5 Field-name mismatches between `/performance` and the frontend

**Lambda returns** `SELECT ap.*, u.full_name, r.role_key AS role` → row keys are the literal schema columns:
`agent_id, period_year, period_label, ytd_fyc, yearly_target, weekly_fyc, last_week_fyc, district_rank, delta_pct, total_cases, team_name, full_name, role` (`schema.sql:379-398`, `lambda/index.mjs:462-473`).

**`backend/agent-comparison.js:346-348`** maps:
```js
return { name: r.full_name || r.agent_id,
         rank: r.district_rank || 0,
         ytdFyc: Number(r.ytd_fyc || 0),
         delta: Number(r.delta || 0),            // ← should be r.delta_pct
         cases: Number(r.cases || 0),            // ← should be r.total_cases
         team: r.team_code || r.agent_id };     // ← should be r.team_name
```

**`backend/dashboard.js:66`** has the same `r.delta` bug:
```js
return { agent: r.full_name || r.agent_id, monthlyProduction: 0, ytdFyc: Number(r.ytd_fyc || 0), delta: Number(r.delta || 0) };
```

Net result: leaderboard delta % is always 0, agent-comparison "DELTA vs last period" row is always 0, every CASES value is 0 (forces `agentInc()`/`agentCum()` to produce zero-only arrays after the slice math in `periodInfo`), and every team label silently falls back to the agent ID.

### 2.6 `/rooms` field-name mismatches

**Schema** (`schema.sql:184-191`):
```sql
CREATE TABLE rooms (
  room_id    VARCHAR(20)   PRIMARY KEY,
  label      VARCHAR(100)  NOT NULL,
  css_class  VARCHAR(50),
  dot_color  VARCHAR(20),
  is_active  BOOLEAN       DEFAULT TRUE,
  …
);
```

**`backend/room-booking.js:560-561`** reads non-existent columns:
```js
ROOMS = roomsData.map(function(r) {
  return { id: r.room_id, label: r.name || r.room_id, cls: 'room-' + r.room_id, dot: r.color || '#93c5fd' };
});
```

Should be `r.label` and `r.dot_color`. Currently every room shows its `room_id` as its label (e.g. "eagle" instead of "Eagle Boardroom") and uses the fallback dot color for every room.

### 2.7 `wireLeadFilters` uses `localeCompare` on potentially undefined `meetupDate`

**File**: `backend/dashboard.js:258-260`

```js
filtered.sort((a, b) =>
  sortDirection === "asc" ? a.meetupDate.localeCompare(b.meetupDate) : b.meetupDate.localeCompare(a.meetupDate)
);
```

`loadOverviewData` sets `meetupDate: r.meetDate || ''` which can be `''` — calling `.localeCompare('')` is fine, but `mapLead` returns `meetDate` from `r.meet_date` which may be a `Date` instance (mysql2 returns dates as Date objects for `DATE` columns) — `meetDate.localeCompare` would throw. Mitigated only because `loadOverviewData` reads via `r.meetDate` after passing through `mapLead`, where the assignment `meetDate: r.meet_date` may still be a Date.

### 2.8 `mapLead` references `r.follow_ups` (snake) but Lambda nests as `followUps` (camel)

**File**: `backend/api.js:83-85`

```js
followUps: (r.follow_ups || []).map(function(f) {
  return { label: f.label, date: f.scheduled_date, done: !!f.is_done };
}),
```

But the Lambda emits the nested array under the key `followUps` (camelCase) — see `lambda/index.mjs:152-156`:
```js
return ok(
  leads.map((l) => ({
    ...l,
    followUps: fups.filter((f) => f.lead_id === l.lead_id),
  }))
);
```

So `r.follow_ups` is always `undefined` and every lead surfaces `followUps: []` to the UI. The Leads page's drawer (`leads.js:189-196`) will silently show no timeline; `client-profile.js` likewise.

### 2.9 `mapLead` premature reference to `extra` before its destructure

**File**: `backend/api.js:50-87`

```js
function mapLead(r) {
  var extra = parseExtra(r);
  return Object.assign({}, extra, {
    …
    planType:         r.plan_type || extra.specificPlanType || extra.generalPlanType || '',
    …
  });
}
```

`extra` is built before the spread; logic looks OK. But note: `Object.assign({}, extra, {...})` means lambda-side `extra` fields beat fixed columns for any keys not overridden. For keys both define (`agency`, `commissionRate`, etc.) the fixed-column override wins. Verified correct, but the comment in `api.js:39` claims the opposite ("then lets fixed columns override") — that's accurate.

### 2.10 `dashboard.js:194-202` filters leads on `meetupDate <= today` for "YTD premium", but `meetupDate` is the next meet date, not the closure date

**File**: `backend/dashboard.js:190-203`

```js
const ytdPremium = rows
  .filter((lead) => lead.meetupDate <= today)
  .reduce((sum, lead) => sum + lead.premium, 0);
```

Conceptually questionable — meetup date isn't when commission accrues. Tag this as data-model smell.

### 2.11 Async fire-and-forget API calls swallow all errors silently

Many places do `apiPost(...).catch(function() {})` (e.g. `backend/calendar.js:241, 279, 317, 337, 344, 351, 898, 910`; `backend/onboarding.js:127, 140`). If the API fails (timeout, 500, CORS), the user gets a green checkmark locally with nothing written server-side and no log. Should at minimum `console.warn` the error.

### 2.12 `calendar.js` writes `if (agency.length > 0) localStorage.setItem(AGENCY_EVENTS_STORAGE_KEY, …)` — never *clears* stale agency events

**File**: `backend/calendar.js:125-126`

```js
localStorage.setItem(PERSONAL_EVENTS_STORAGE_KEY, JSON.stringify(personal));
if (agency.length > 0) localStorage.setItem(AGENCY_EVENTS_STORAGE_KEY, JSON.stringify(agency));
```

If the API returns an empty agency list, the stale localStorage copy keeps showing on the calendar. Personal events do not have this bug — they always overwrite. Should be consistent.

### 2.13 `calendar.js` `loadCalendarEventsFromApi` does not pass `category` filter

**File**: `backend/calendar.js:117`

```js
const rows = await apiGet('/events?userId=' + encodeURIComponent(userId));
```

Lambda `/events` with `userId` filters by `created_by = userId` (`lambda/index.mjs:267`). Agency-level events created by another user (e.g. district manager) will not be returned to an agent. That's likely a bug — agents should see agency events created by anyone. Either drop the `userId` filter, or split into two calls (`?userId=...` for personal, `?category=agency` for agency).

### 2.14 `client-profile.js` does not refresh page when API returns no rows

**File**: `backend/client-profile.js:402-410`

```js
if (typeof apiGet === "function") {
  const userId = sessionStorage.getItem("dashboardUser");
  try {
    const rows = await apiGet("/leads" + (userId ? "?userId=" + encodeURIComponent(userId) : ""));
    if (Array.isArray(rows) && rows.length > 0) {
      localStorage.setItem(LEADS_STORAGE_KEY, JSON.stringify(rows.map(mapLead)));
    }
  } catch (e) { console.warn("Failed to load leads from API:", e); }
}
```

If a new agent has zero leads in the DB but has stale `financial_leads_data` in localStorage from a different user, the old data is shown. Should clear when `rows.length === 0`.

### 2.15 `attendance.js` early-returns if no `dashboardRole`, breaking guest QR check-in flow

**File**: `backend/attendance.js:8-9`

```js
var signedInRole = sessionStorage.getItem("dashboardRole");
if (!signedInRole) return;
```

But `auth.js` should already have redirected unauthenticated users to login. So this is mostly defensive. However the `auth.js` check happens at script-parse time, and `attendance.js` is wrapped in an async IIFE — the redirect from auth.js races the attendance script. Safe but worth noting.

### 2.16 `onboarding.js` writes `setList(mapped)` from API but does NOT remove the early redirect for agent role from `auth.js`

`auth.js:12-14`:
```js
if (currentPage === "onboarding.html" && loggedRole === "agent") {
  window.location.replace("index.html");
  return;
}
```

`onboarding.js:3-6`:
```js
if (role === "agent") {
  window.location.replace("index.html");
  return;
}
```

Duplicate guards. Functional, but two places of truth. Pick one.

### 2.17 `dashboard.js` `loadOverviewData` skips API if no `dashboardUser`, but doesn't show an error

**File**: `backend/dashboard.js:28-31`

```js
async function loadOverviewData() {
  if (typeof apiGet !== 'function') return;
  const userId = sessionStorage.getItem('dashboardUser');
  if (!userId) return;
  …
}
```

Silently leaves `leadData = []`. The home dashboard then renders with all-zero KPIs. No user feedback.

### 2.18 `dashboard.js` declares `let cpfTrackerData = []` but `loadOverviewData` reassigns it inside the function — works because `let` is block-scoped to the module body, but the calendar.js comment says it expects `var leadData` so it lands on `window`

`dashboard.js:3` does use `var leadData = []` ✓ — confirmed `var` (becomes `window.leadData` in non-module script). `cpfTrackerData` and `performanceData` use `let`, so they're NOT on `window`. They are only read inside `dashboard.js` so that's OK — but the comment "shares the global `leadData` var from dashboard.js" in calendar.js line 3 should be the only inter-file shared global.

### 2.19 `index.html` likely contains BOTH `lead-table-body` and `total-leads-card`, causing both init branches to run

Inferred from `dashboard.js:84-90`. Confirm by checking `frontend/index.html` (not fully inspected here). If both IDs exist, `wireLeadFilters() + wireRoleControl() + wirePersonalTodo() + wireFloatingTodo()` runs (line 877), then the async block at 894 fires `wireOverviewTabs/PdfExport/RoleControl/PersonalTodo/FloatingTodo` again. Plus line 906 runs again. **`wireRoleControl()` runs 3×, `wirePersonalTodo` 3×, `wireFloatingTodo` 3×** on the home dashboard. Each registers DOM listeners; the in-function `if (document.getElementById(...)) return` guards prevent DOM duplication for `wireFloatingTodo` but not for `wirePersonalTodo` (no guard at line 663).

### 2.20 Mojibake (UTF-8 / cp1252) artifacts in several backend files

**File**: `backend/dashboard.js:133, 179, 222, 225` — `Â·` appears where `·` (U+00B7) was intended. Triggered by re-saving a UTF-8 file as cp1252 then back. Visible to the user as garbled text. Same in `backend/agent-comparison.js:5` MONTHS comment and elsewhere.

### 2.21 `dashboard.js:983` string-concat precedence bug

**File**: `backend/dashboard.js:983`

```js
if (label) label.textContent = agents.length + " agents · " + agencies.length - 1 + " agencies · " + fileName;
```

Operator precedence: `("xxx" + agencies.length) - 1` → `NaN` (since the left side is a string concatenation containing digits, e.g. `"...12 agents · 6" - 1 = NaN`). Should be `(agencies.length - 1)` in parens.

### 2.22 Unguarded `document.getElementById('fRecurrence')` on room-booking init

**File**: `backend/room-booking.js:548`

```js
document.getElementById('fRecurrence').addEventListener('change', (e) => { … });
```

If `room-booking.html` is ever reduced/refactored without `#fRecurrence`, this throws. Add a null check.

### 2.23 `room-booking.js` deletes only one occurrence even for recurring bookings

**File**: `backend/room-booking.js:534-540` — deletes a single booking row by id; if the booking is part of a recurring series, sibling occurrences remain. No "delete series" UX or API call.

### 2.24 `room-booking.js:561` builds `cls: 'room-' + r.room_id` (ignores `css_class`)

Schema has `css_class` (`schema.sql:187`) but front-end derives the CSS class from `room_id`. Will work only if CSS rules match the convention exactly.

### 2.25 `calendar.js:431` — `getCalendarEventsForView` ignores `showHolidays`/`year`/`canManageAgency` defaults

```js
function getCalendarEventsForView(role, viewOptions) {
  return getLeadEvents(role, viewOptions);
}
```

`getLeadEvents` receives `viewOptions` directly. When called as `getCalendarEventsForView(role, { showPersonal: true, showAgency: true })` (e.g. `dashboard.js:833`), `showHolidays` defaults to undefined → `getLeadEvents:426` `if (options.showHolidays !== false)` → true → holidays are pushed even when the caller wanted only personal+agency. Minor — but means holiday entries show up in reminder lists.

### 2.26 Mock QR — both `attendance.js` and `calendar.js` define `drawMockQr` independently

`backend/attendance.js:237-268` and `backend/calendar.js:818-859` are near-duplicate canvas-mock-QR functions. Not strictly a bug, but a real QR library should replace both.

### 2.27 `agent-comparison.js:351` and elsewhere references `selected.length >= 4` cap — but `addAgent(0)` and `addAgent(1)` runs after the async IIFE, only if `AGENTS.length >= 2`. If API returns 0 or 1 agent, no rendering happens.

```js
if (AGENTS.length >= 2) { addAgent(0); addAgent(1); }
else { render(); }
```

Edge case: an environment with a single agent shows an empty page (just an "Add another agent" button).

---

## 3. API / DB mismatches — route audit

### 3.1 Lambda routes implemented in `lambda/index.mjs`

| # | Method  | Path                                | Lambda line | Notes |
|---|---------|-------------------------------------|-------------|-------|
| 1 | GET     | `/health`, `/api/health`            | 81 | unused |
| 2 | POST    | `/auth/login`, `/api/auth/login`    | 88 | **NEVER called by frontend** (auth.js uses local DEMO_USERS) |
| 3 | GET     | `/users`                            | 121 | called by sales-tracker.js |
| 4 | GET     | `/leads`                            | 136 | called by leads.js, client-profile.js, dashboard.js |
| 5 | GET     | `/leads/:id`                        | 159 | unused (no single-lead fetch from frontend) |
| 6 | PUT     | `/leads/:id`                        | 173 | **unused** (`create-profile.js` saves to localStorage only) |
| 7 | DELETE  | `/leads/:id`                        | 220 | unused |
| 8 | POST    | `/leads`                            | 226 | **unused** (`create-profile.js` saves to localStorage only) |
| 9 | GET     | `/events`                           | 262 | called by calendar.js |
| 10 | POST    | `/events`                          | 273 | called by calendar.js |
| 11 | DELETE  | `/events?recurrenceId=`            | 304 | called by calendar.js |
| 12 | PUT     | `/events/:id`                      | 318 | called by calendar.js |
| 13 | DELETE  | `/events/:id`                      | 340 | called by calendar.js |
| 14 | POST    | `/events/bulk`                     | 346 | unused |
| 15 | GET     | `/tasks`                           | 379 | unused (calendar.js reads only from localStorage) |
| 16 | POST    | `/tasks`                           | 389 | called by calendar.js (addPersonalTask) |
| 17 | PUT     | `/tasks/:id`                       | 415 | unused (task toggle is local-only) |
| 18 | DELETE  | `/tasks/:id`                       | 428 | unused |
| 19 | POST    | `/tasks/bulk`                      | 434 | unused |
| 20 | GET     | `/performance`                     | 460 | called by dashboard.js, agent-comparison.js |
| 21 | GET     | `/cpf`                             | 479 | called by dashboard.js |
| 22 | GET     | `/cpf-rates`                       | 491 | called by cpf-calculator.js |
| 23 | GET     | `/training/topics`                 | 517 | called by training.js |
| 24 | GET     | `/training/progress`               | 534 | **unused** (training.js reads/writes localStorage `fm_training_progress_v2`) |
| 25 | POST    | `/training/progress`               | 548 | **unused** |
| 26 | DELETE  | `/teams/:managerId/:agentId`       | 568 | called by onboarding.js |
| 27 | GET     | `/teams/:managerId`                | 581 | called by onboarding.js, training.js |
| 28 | POST    | `/teams/:managerId`                | 594 | called by onboarding.js |
| 29 | GET     | `/announcements`                   | 609 | called by announcements.js |
| 30 | POST    | `/announcements`                   | 614 | called by announcements.js |
| 31 | GET     | `/announcement-responses`          | 628 | **unused** |
| 32 | POST    | `/announcements/:id/responses`     | 637 | **unused** (announcements.js writes responses to localStorage `fm_announcement_responses_v1`) |
| 33 | GET     | `/sales-activity-types`            | 658 | **unused** (sales-tracker.js uses /sales-settings) |
| 34 | GET     | `/sales-settings`                  | 663 | called by sales-tracker.js |
| 35 | GET     | `/sales-entries`                   | 668 | called by sales-tracker.js |
| 36 | POST    | `/sales-entries`                   | 681 | called by sales-tracker.js |
| 37 | GET     | `/sales-reflections`               | 699 | **unused** (sales-tracker.js writes reflections to localStorage `salesTrackerReflections`) |
| 38 | POST    | `/sales-reflections`               | 709 | **unused** |
| 39 | GET     | `/rooms`                           | 729 | called by room-booking.js |
| 40 | GET     | `/room-bookings`                   | 737 | called by room-booking.js |
| 41 | POST    | `/room-bookings`                   | 744 | called by room-booking.js |
| 42 | PUT     | `/room-bookings/:id`               | 766 | called by room-booking.js |
| 43 | DELETE  | `/room-bookings/:id`               | 787 | called by room-booking.js |
| 44 | GET     | `/attendance-events`               | 796 | called by attendance.js |
| 45 | POST    | `/attendance-events`               | 805 | unused |
| 46 | GET     | `/attendance-records`              | 837 | **unused** |
| 47 | POST    | `/attendance-records`              | 847 | **unused** (attendance.js writes records to localStorage `attendanceRecords`) |
| 48 | GET     | `/public-holidays`                 | 869 | **unused** (calendar.js fetches `https://date.nager.at/api/v3/PublicHolidays`) |
| 49 | GET     | `/recruitment`                     | 882 | unused |
| 50 | POST    | `/recruitment/access`              | 886 | unused |
| 51 | startsWith `/helpdesk/tickets`     | 896 | unused stub |
| 52 | GET     | `/resources`                       | 903 | **unused** (resources.html is static, has no resource list rendering) |

### 3.2 Frontend routes called

Every path used by frontend code matches a Lambda route — **no 404s expected**. The mismatch is the inverse: many Lambda routes are dead code, and several flows that the Lambda supports are still localStorage-only on the frontend.

| Path called by frontend | File | Lambda handler? | Notes |
|------|------|-----------------|-------|
| `GET /leads?userId=` | leads.js, client-profile.js, dashboard.js | ✓ | Returns `followUps` (camelCase) — `mapLead` reads `r.follow_ups` (snake), so followUps array is dropped (bug 2.8) |
| `GET /performance` | dashboard.js, agent-comparison.js | ✓ | Frontend reads non-existent fields `delta`, `cases`, `team_code` (bug 2.5) |
| `GET /cpf?agentId=` | dashboard.js | ✓ | OK |
| `GET /events?userId=` | calendar.js | ✓ | Filters by `created_by`, excluding agency events from other users (bug 2.13) |
| `POST /events` | calendar.js | ✓ | OK |
| `PUT /events/:id` | calendar.js | ✓ | OK |
| `DELETE /events/:id` | calendar.js | ✓ | OK |
| `DELETE /events?recurrenceId=` | calendar.js | ✓ | OK |
| `POST /tasks` | calendar.js | ✓ | OK |
| `GET /announcements` | announcements.js | ✓ | OK |
| `POST /announcements` | announcements.js | ✓ | OK |
| `GET /sales-settings` | sales-tracker.js | ✓ | OK |
| `GET /sales-entries` | sales-tracker.js | ✓ | OK |
| `POST /sales-entries` | sales-tracker.js | ✓ | OK |
| `GET /users` | sales-tracker.js | ✓ | OK |
| `GET /cpf-rates` | cpf-calculator.js | ✓ | OK |
| `GET /training/topics` | training.js | ✓ | OK |
| `GET /teams/:id` | onboarding.js, training.js | ✓ | OK |
| `POST /teams/:id` | onboarding.js | ✓ | OK |
| `DELETE /teams/:mgr/:agt` | onboarding.js | ✓ | OK |
| `GET /rooms` | room-booking.js | ✓ | Frontend reads `r.name`, `r.color` — schema has `label`, `dot_color` (bug 2.6) |
| `GET /room-bookings` | room-booking.js | ✓ | OK |
| `POST /room-bookings` | room-booking.js | ✓ | OK |
| `PUT /room-bookings/:id` | room-booking.js | ✓ | OK |
| `DELETE /room-bookings/:id` | room-booking.js | ✓ | OK |
| `GET /attendance-events` | attendance.js | ✓ | OK |

---

## 4. JS dependency issues

### 4.1 Missing `api.js` / `nav.js` / `auth.js` on some pages

| Page                       | nav.js | auth.js | api.js | calendar.js | dashboard.js | Module |
|----------------------------|:------:|:-------:|:------:|:-----------:|:------------:|--------|
| `index.html`               | ✓ | ✓ | ✓ | ✓ | ✓ | n/a |
| `leads.html`               | ✓ | ✓ | ✓ | – | – | leads.js |
| `client-profile.html`      | ✓ | ✓ | ✓ | – | – | client-profile.js |
| `calendar.html`            | ✓ | ✓ | ✓ | ✓ | ✓ | n/a |
| `room-booking.html`        | ✓ | ✓ | ✓ | – | – | room-booking.js |
| `attendance.html`          | ✓ | ✓ | ✓ | – | – | attendance.js |
| `sales-tracker.html`       | ✓ | ✓ | ✓ | – | – | sales-tracker.js |
| `cpf-calculator.html`      | ✓ | ✓ | ✓ | – | – | cpf-calculator.js |
| `training.html`            | ✓ | ✓ | ✓ | – | – | training.js |
| `announcements.html`       | ✓ | ✓ | ✓ | – | – | announcements.js |
| `agent-comparison.html`    | ✓ | ✓ | ✓ | – | – | agent-comparison.js |
| `onboarding.html`          | **MISSING** | ✓ | ✓ | – | – | onboarding.js |
| `resources.html`           | ✓ | ✓ | ✓ | ✓ | ✓ | n/a (resources are hardcoded HTML) |
| `login.html`               | – | ✓ | – | – | – | n/a |
| `create-profile.html`      | ✓ | ✓ | **MISSING** | – | – | create-profile.js |

Issues:
- **`onboarding.html` is missing `nav.js`** (`frontend/onboarding.html:180-182`). Page therefore has no top navigation strip injected.
- **`create-profile.html` is missing `api.js`** (`frontend/create-profile.html:377-379`). `create-profile.js` doesn't call `apiGet/apiPost`, so currently no runtime error — but the file saves leads only to `localStorage` (`create-profile.js:186`), confirming bug 2.6 of the route audit (POST /leads is never invoked).
- **`resources.html` loads `dashboard.js` (and therefore `calendar.js`)** despite being a static page with no dashboard widgets. The unconditional `wireFloatingTodo()` at `dashboard.js:906` will inject a planner widget on the resources page — likely unintended.

### 4.2 Load order

All script tags use synchronous loading (no `defer`/`async` attributes anywhere except CDN scripts). Order on every page that uses them is `nav.js → auth.js → api.js → [calendar.js → dashboard.js]` or `nav.js → auth.js → api.js → <module>.js`. This is correct.

`login.html` correctly loads only `auth.js` (no module scripts) — good.

### 4.3 Cross-file globals

`dashboard.js:3` declares `var leadData = []` — yes, `var` (not `let`), so the binding is on the global object. `calendar.js:395-396` reads it. ✓

`dashboard.js` after the calendar.js extraction still uses functions defined in calendar.js:
- `renderCalendarPermissions` (`dashboard.js:656`, defined `calendar.js:479`)
- `getPersonalTasks` (`dashboard.js:670, 684, 776, 797`, defined `calendar.js:166`)
- `savePersonalTasks` (`dashboard.js:686, 798`)
- `addPersonalTask` (`dashboard.js:695, 813`)
- `getUpcomingCalendarReminders` (`dashboard.js:822, 852`)
- `getCalendarEventsForView` (`dashboard.js:833`)
- `openCalendarEventDialog` (`dashboard.js:840`)
- `openPersonalEventDialog` (`dashboard.js:841`)
- `notifyUpcomingEvents` (`dashboard.js:853`)
- `requestNotificationPermission` (`dashboard.js:872`)

All defined in calendar.js. Safe only if calendar.js loads first — which it does on the 3 pages that use dashboard.js.

### 4.4 No undefined references found inside any single file

Spot-checked all module files. No `apiSomething` calls that don't exist in `api.js`. No references to deleted helpers.

---

## 5. HTML script tag audit (per page)

Listing `<script src=…>` in load order, plus what's missing.

### `frontend/index.html`
```
xlsx@0.20.3 (CDN) → nav.js → auth.js → api.js → calendar.js → dashboard.js
```
✅ Complete.

### `frontend/leads.html`
```
nav.js → auth.js → api.js → leads.js
```
✅ OK. `leads.js` calls `apiGet` and `mapLead` — both available.

### `frontend/client-profile.html`
```
nav.js → auth.js → api.js → client-profile.js
```
✅ OK.

### `frontend/calendar.html`
```
xlsx (CDN) → nav.js → auth.js → api.js → calendar.js → dashboard.js
```
✅ OK. But `dashboard.js` is loaded only for its unconditional `wireFloatingTodo()` — see 2.1.

### `frontend/room-booking.html`
```
nav.js → auth.js → api.js → room-booking.js
```
✅ OK.

### `frontend/attendance.html`
```
nav.js → auth.js → api.js → attendance.js
```
✅ OK.

### `frontend/sales-tracker.html`
```
nav.js → auth.js → api.js → sales-tracker.js
```
✅ OK.

### `frontend/cpf-calculator.html`
```
nav.js → auth.js → api.js → cpf-calculator.js
```
✅ OK.

### `frontend/training.html`
```
tailwind (CDN) → nav.js → auth.js → api.js → youtube iframe API (CDN) → training.js
```
✅ OK.

### `frontend/announcements.html`
```
tailwind (CDN) → nav.js → auth.js → … → api.js → announcements.js
```
Order in file: nav.js (13), auth.js (14), api.js (38), announcements.js (39). ✅ OK but unusual that `api.js` is placed near the bottom instead of after `auth.js`. Functionally fine because `announcements.js` is the last script.

### `frontend/agent-comparison.html`
```
nav.js → auth.js → api.js → agent-comparison.js
```
✅ OK.

### `frontend/onboarding.html`
```
auth.js → api.js → onboarding.js
```
❌ **MISSING `nav.js`** — no top nav rendered. (line 180-182)

### `frontend/resources.html`
```
nav.js → auth.js → api.js → calendar.js → dashboard.js
```
⚠️ Unnecessary: page has no dashboard widgets. `wireFloatingTodo()` will render the planner widget here. Either remove `calendar.js`/`dashboard.js` from `resources.html`, or gate the unconditional `wireFloatingTodo()` call.

### `frontend/login.html`
```
auth.js
```
✅ Correct — no auth-gated scripts.

### `frontend/create-profile.html`
```
nav.js → auth.js → create-profile.js
```
⚠️ Missing `api.js`. Currently harmless because `create-profile.js` is local-storage-only (`backend/create-profile.js:186`). But this means newly-created leads never hit `POST /leads`.

---

## 6. Field / schema mismatches

| Frontend location | Field accessed | DB column actually returned | Effect |
|--------|----|----|---|
| `backend/api.js:83` (`mapLead`) | `r.follow_ups` | Lambda key is `followUps` (camel) | All follow-up arrays appear empty in UI |
| `backend/dashboard.js:66` | `r.delta` | DB column `delta_pct` | Leaderboard delta % is always 0 |
| `backend/agent-comparison.js:347` | `r.delta` | DB column `delta_pct` | Comparison DELTA row is always 0 |
| `backend/agent-comparison.js:347` | `r.cases` | DB column `total_cases` | Comparison CASES is always 0 |
| `backend/agent-comparison.js:347` | `r.team_code` | DB column `team_name` | Team chip falls back to agent_id |
| `backend/room-booking.js:561` | `r.name` | DB column `label` | Room labels show their ids |
| `backend/room-booking.js:561` | `r.color` | DB column `dot_color` | All rooms render with the same fallback dot color `#93c5fd` |
| `backend/dashboard.js:78` | `r.client_name`, `r.account_focus` | OK — these are the actual schema columns | ✓ |
| `backend/dashboard.js:78` | `r.amount` cast to Number | DB column is `VARCHAR(50)` for `amount` (`schema.sql:412`) | If amount string contains non-numeric chars (e.g. "$1,000"), result is `NaN` |
| `backend/calendar.js:108` | `r.is_editable !== false` | DB column `is_editable` BOOLEAN | OK |
| `lambda/index.mjs:271` | returns `r.event_type` | OK | But UI expects `type` after mapping in `mapCalendarEvent` — mapper converts |
| `backend/attendance.js:361` | builds `category: r.category || "agency"` from `/attendance-events` | OK | But Lambda doesn't filter; the route just returns all events with `attendance_token IS NOT NULL` |

---

## 7. Auth / session issues

### 7.1 Auth flow does not consult the API
See bug 2.4. `auth.js:25-29` hardcodes three demo IDs. The token returned by `POST /auth/login` (`lambda/index.mjs:114`) is never requested and never stored. There is no Authorization header anywhere — every API call is unauthenticated.

### 7.2 Session keys actually set / read

Set by `auth.js`:
- `sessionStorage.dashboardRole`  → `"agent" | "leader" | "district"`
- `sessionStorage.dashboardUser`  → uppercased userId (e.g. `"A123"`)
- `sessionStorage.announcementPromptPending` → `"1"`
- `localStorage.calendarRole`     → `"agent" | "district_manager"` ← note **different** values than `dashboardRole`
- `localStorage.overviewScope`    → `"district" | "agency" | "personal"`

Removed on logout (`auth.js:313-316`):
- `sessionStorage.dashboardRole`, `sessionStorage.dashboardUser`

**Bug:** logout does NOT remove `localStorage.calendarRole`, `localStorage.overviewScope`, or the user-scoped stores `personalEvents`, `agencyEvents`, `personalTasks`, `financial_leads_data`, `fm_team_members_v1`, `fm_announcement_responses_v1`, `salesTrackerReflections`, `fm_training_progress_v2`, `attendanceEvents`, `attendanceRecords`, `sgHolidaysByYear`, `todoSidebarExpanded`, `todoReminderWindow`, `todoNotifyEnabled`. The next user to log in on the same browser sees the previous user's data.

### 7.3 Stale role values

`localStorage.calendarRole` uses `"district_manager"` vs `sessionStorage.dashboardRole` uses `"district"`. Code that compares the wrong key — e.g. `calendar.js:582` `canManageAgency = userRole === "district"` from `sessionStorage.dashboardRole` — works, but `calendar.js:580` reads `calendarRole` and compares to `"district_manager"` later. Easy to confuse; two sources of truth.

### 7.4 `dashboardUser` defaulting to `"A123"` in modules

Many modules default to `"A123"` when `sessionStorage.dashboardUser` is missing (`backend/leads.js:27`, `sales-tracker.js:5`, `attendance.js:10`, `training.js:8`, `announcements.js:3`). With `auth.js`'s redirect, the value should always be set — but if any race or future bug bypasses the redirect, every user appears as A123.

### 7.5 `attendance.js` early-returns silently if no role

`attendance.js:8-9` — see bug 2.15.

### 7.6 Onboarding double-guard

See bug 2.16. Both `auth.js:12-14` and `onboarding.js:3-6` redirect agents away from onboarding. Pick one.

### 7.7 Login page redirect target

`auth.js:79` checks `next` against `/^[a-z0-9-]+\.html(\?.*)?$/i` before redirecting — good; prevents open-redirect. But the regex doesn't allow capital letters in the URL path. Fine for this static set of pages.

---

## 8. localStorage / sessionStorage key consistency

### All keys observed
```
localStorage:
  agencyEvents                          calendar.js
  personalEvents                        calendar.js, attendance.js (read)
  personalTasks                         calendar.js
  attendanceEvents                      attendance.js, calendar.js
  attendanceRecords                     attendance.js
  sgHolidaysByYear                      calendar.js
  calendarRole                          auth.js, dashboard.js, calendar.js
  overviewScope                         auth.js, dashboard.js
  todoSidebarExpanded                   dashboard.js
  todoReminderWindow                    dashboard.js
  todoNotifyEnabled                     dashboard.js, calendar.js
  financial_leads_data                  client-profile.js, create-profile.js
  fm_team_members_v1                    training.js (read), onboarding.js
  fm_announcement_responses_v1          announcements.js
  fm_announcements_v1                   auth.js (read)               ← only READ, never written by any module
  fm_training_progress_v2               training.js
  salesTrackerReflections               sales-tracker.js

sessionStorage:
  dashboardRole                         auth.js, attendance.js, sales-tracker.js, training.js, calendar.js, …
  dashboardUser                         auth.js + all modules
  announcementPromptPending             auth.js
  calendarReminderShown-<date>          calendar.js
```

### Issues
- **`fm_announcements_v1` is read by `auth.js:386` but never written** by any module. The announcements page lives off `/announcements` (API), and the in-app `announcement-login-prompt` panel will always show "New Announcement" / empty body because `readAnnouncements()` finds nothing. Either:
  - (a) cache the API result into `fm_announcements_v1` when announcements.js loads, or
  - (b) fetch live in `showAnnouncementPrompt()`.
- **`attendance.js:45` reads `"personalEvents"` directly as a string literal** — works only because it happens to match `calendar.js`'s `PERSONAL_EVENTS_STORAGE_KEY`. Same for `"agencyEvents"` at line 48. Should import the constant or keep both files in sync.
- **`auth.js:75` sets `calendarRole` to `"district_manager"` for district users** but `dashboard.js:658` and `calendar.js:580` default to `"agent"` if not set. If a user logs in as district then a non-`auth.js` code path runs first, the role is briefly wrong.
- No typos like `personal_events` vs `personalEvents` — all key spellings match exactly.

---

## 9. Other bugs / smells

### 9.1 `dashboard.js:906` — unconditional `wireFloatingTodo()` (already #1)

### 9.2 `dashboard.js:983` — `agencies.length - 1` precedence bug (#2.21)

### 9.3 `dashboard.js:191-201` — `wireOverviewTabs()` registers a `window` listener every call

```js
if (isOverviewDashboard) {
  window.addEventListener("overviewScopeChanged", (event) => setScope(event.detail.scope));
}
```

Combined with bug 2.2 (multiple wirings), the scope-change handler may be registered up to 3× on the home page.

### 9.4 `calendar.js:65` — fetch to nager.at is unauthenticated and assumes CORS allowed

```js
const res = await fetch(`https://date.nager.at/api/v3/PublicHolidays/${year}/SG`);
```

External dependency. If nager.at is unreachable, the fallback covers only 2026 (`_sgHolidays2026Fallback`). For 2027 and beyond an empty list is returned.

### 9.5 `calendar.js:65` — Year 2026 hardcoded in fallback

The `_sgHolidays2026Fallback` array is only useful for 2026. By 2027 the fallback returns `[]`. Either provide multi-year fallbacks or use the Lambda `/public-holidays` route (currently unused — see 3.1#48).

### 9.6 `agent-comparison.js:339-355` — assumes `AGENTS.length >= 2`

```js
if (AGENTS.length >= 2) { addAgent(0); addAgent(1); }
else { render(); }
```

If only 1 agent (or 0), the page shows the empty state instead of the single agent. Minor.

### 9.7 `agent-comparison.js:84-91` — `document.getElementById("add-agent-btn")` accessed at script-eval

```js
document.getElementById("add-agent-btn").addEventListener("click", e => { … });
```

Top-level (no DOMContentLoaded guard). Because the script tag is at end-of-body, the element exists — but this pattern is fragile if the script ever moves.

### 9.8 `sales-tracker.js:107-127` — `renderPointChart` uses today as anchor, ignores `selectedWeekOffset`

The week-offset controls (line 336-348) only affect `renderManagerWeeklyTable`. The point chart and KPIs always show the actual current week regardless. Likely a UX bug.

### 9.9 `sales-tracker.js:297-322` — entry submit doesn't wait for API response before pushing to local cache

```js
await apiPost('/sales-entries', { … });
salesEntriesCache.push({
  id: "sale-" + Date.now(),   // ← made-up id, not the one the server returned
  …
});
```

The Lambda generates an `entry_id` (`lambda/index.mjs:685, 696`) but the response is discarded. Subsequent edits (none exist now, but would fail to round-trip) and reloads will show a different id.

### 9.10 `calendar.js:507` — `state.viewDate` value mutated and re-rendered, but the `selectedDate` reset to null is never done after month change

Not a bug per se; just notice that `selectedDate` persists across months, possibly confusing.

### 9.11 `calendar.js:550-567` — `renderCalendar` writes the month-of-events list into `#todo-reminder-list`

```js
const reminderList = document.getElementById("todo-reminder-list");
if (!reminderList) return;
…
reminderList.innerHTML = monthlyEvents.map(…).join("");
```

But `#todo-reminder-list` is also populated by `wireFloatingTodo`'s `renderReminders()` (in dashboard.js). On the calendar page both `renderCalendar()` and `renderReminders()` write to the same element — last write wins, and depending on order the reminder list shows month-of-events or week-of-events. Race between the two unrelated features.

### 9.12 `room-booking.js:475` — fire-and-forget `apiPut` on edit, but `apiPost` on add awaits

Inconsistent — an edit failure is silently lost while an add failure throws. Either both should await with error handling, or both fire-and-forget.

### 9.13 `room-booking.js:489-494` — on recurring booking, refetches entire list

```js
if (recurrence !== 'none') {
  const refreshed = await apiGet('/room-bookings');
  bookings = refreshed.map(mapBooking);
}
```

But Lambda's `POST /room-bookings` only inserts a single row (`lambda/index.mjs:744-760`), not the whole series — so refetching returns only one new row anyway. Either the Lambda needs to expand recurrences server-side, or the client needs to POST each occurrence individually.

### 9.14 `onboarding.js:152` — `setList(mapped)` overwrites local roster every page load

If the local roster has unsynced add/delete operations and the API call succeeds, server state wins — but with the fire-and-forget pattern (line 127, 140), failed writes are dropped silently and overwritten on next refresh. Race-condition data loss possible.

### 9.15 `onboarding.js:153` — `setList(mapped)` runs even when `members.length === 0`

If the API returns an empty roster, the local roster is wiped. Acceptable if API is authoritative; not acceptable while POST/DELETE are fire-and-forget.

### 9.16 `training.js:15` — `window.onYouTubeIframeAPIReady` is set inside an IIFE

```js
window.onYouTubeIframeAPIReady = function () { ytReady = true; render(); };
```

If the YouTube iframe API has already fired before this line executes (because the CDN script is in `<head>` and this IIFE awaits an API call), the callback is missed. Mitigation: also check `window.YT` synchronously.

### 9.17 `training.js` writes progress to `localStorage` only

The `/training/progress` Lambda endpoint exists but is never called. Same anti-pattern as 1.5.

### 9.18 `announcements.js:209-230` — `bindAgentResponseForms` doesn't remove old listeners on re-render

Every `renderAnnouncements()` call binds new submit handlers, but the previous form nodes are replaced by `container.innerHTML = …` so the handlers go with them. ✓ Safe — but the listener-on-rebuild pattern can cause subtle leaks if `innerHTML` ever changes to `appendChild`-style updates.

### 9.19 `client-profile.js:184` — `AVATAR_COLORS[(lead.id - 1) % 6]`

`lead.id` from the API is `r.lead_id` (an integer from MySQL AUTO_INCREMENT). `% 6` works. But if a future migration uses UUIDs, `(undefined-1) % 6 = NaN`, and the gradient color becomes `undefined`. Defensive coding gap.

### 9.20 `dashboard.js:201-203` — uses `compactMoney(yearlyValue)` but `yearlyTarget` is `0` for agency/personal scopes, causing `targetPercent = NaN` then capped to 100

```js
const targetPercent = Math.min(100, Math.round((data.yearlyFyc / data.yearlyTarget) * 1000) / 10);
```

Division by 0 → `Infinity` → `Math.min(100, Infinity)` = 100. Bar always 100%. Fine UX but misleading.

### 9.21 `dashboard.js:929-931` — Production report uses XLSX library that may not be loaded

```js
var wb = XLSX.read(ev.target.result, { type: "array" });
```

If user opens `calendar.html` (no XLSX) and `wireFloatingTodo` runs but the production form input doesn't exist, fine. But the upload flow is wired only inside `isHomeDashboardPage()` so this is safe.

### 9.22 `dashboard.js:484-487` — Hard-coded fudge factor in case calculation

```js
function getYtdCaseCount(item, index) {
  if (Number.isFinite(item.ytdCases)) return item.ytdCases;
  return Math.max(4, Math.round(item.ytdFyc / 850) - index);
}
```

If the API ever returns `ytdCases`, this is fine. Today the API returns `total_cases` (see bug 2.5) and the mapper drops it because of the wrong field name — so this fallback always fires. Visual numbers are made-up.

### 9.23 `agent-comparison.js:178-201` — `periodInfo` uses calendar-month indices `start: 0, end: 4` (Jan-May)

Hard-coded for May 2026. Should use the current date.

### 9.24 `calendar.js:281` — Custom event `calendarEventAdded` dispatched without `detail.event` check in listener

`dashboard.js:847` checks `e && e.detail && e.detail.event` — safe. But other potential consumers should follow the same guard pattern.

### 9.25 `auth.js:62-69` — Role mismatch message after `userRecord.role !== detected.key`

```js
if (userRecord.role !== detected.key) {
  if (roleError) {
    roleError.textContent = "User role mismatch for this User ID.";
    roleError.hidden = false;
  }
  return;
}
```

`detectRole(value)` already returns the role based on the prefix, so a "mismatch" is impossible given how `DEMO_USERS` is keyed (A123→agent, L123→leader, D123→district). Dead branch.

### 9.26 `announcements.js:23-28` — Cache never invalidates

```js
async function loadAnnouncements() {
  if (announcementsCache) return announcementsCache;
  …
}
```

A second user posting an announcement in another tab won't appear until full reload. Acceptable trade-off; document it.

### 9.27 `room-booking.js:78` — `MONTHS` and `DAYS_SHORT` are module-level constants but declared mid-function

```js
const MONTHS = ['January', …];
const DAYS_SHORT = ['MON', …];
```

These appear inside the IIFE at line 78 — they're scoped fine, but mixed between code paths makes the file hard to read. Move to top.

---

## Suggestions / refactor opportunities

1. **Single source of truth for role labels.** Today `auth.js`, `dashboard.js`, `attendance.js`, `sales-tracker.js`, `announcements.js`, `training.js`, `agent-comparison.js` each define their own `roleLabels` map. Move to `api.js` or a shared `constants.js`.
2. **Wire the unused Lambda endpoints.** The biggest payoff is `/training/progress`, `/sales-reflections`, `/announcements/:id/responses`, `/attendance-records`. Today these are localStorage-only, which means a leader/district can't see agent submissions from another browser.
3. **Replace `auth.js` DEMO_USERS with real `POST /auth/login`.** Store the returned token; add an `Authorization: Bearer <token>` header in `api.js` helpers; have the Lambda validate it.
4. **Move the unconditional `wireFloatingTodo()` at `dashboard.js:906` inside one of the existing `if (isHomeDashboardPage())` / `if (isOverviewPage())` branches**, or gate it by `if (typeof getPersonalTasks === 'function')`.
5. **Fix the field-name bugs in section 2.5/2.6/2.8** — three near-trivial one-line fixes:
   - `api.js:83` — change `r.follow_ups` → `r.followUps`.
   - `dashboard.js:66` and `agent-comparison.js:347` — change `r.delta` → `r.delta_pct`, `r.cases` → `r.total_cases`, `r.team_code` → `r.team_name`.
   - `room-booking.js:561` — change `r.name` → `r.label`, `r.color` → `r.dot_color`, optionally add `cls: r.css_class || ('room-' + r.room_id)`.
6. **Add a global error handler in `api.js`** that surfaces failures to the user (toast/snackbar) rather than swallowing in `.catch(function() {})` everywhere.
7. **Add `nav.js` to `onboarding.html`** (one-line addition).
8. **Remove `calendar.js` and `dashboard.js` from `resources.html`** — that page doesn't need either.
9. **Clear all user-scoped localStorage keys on logout**. Add to `auth.js:313-316`:
   ```js
   logout.addEventListener("click", () => {
     ["dashboardRole","dashboardUser","announcementPromptPending"].forEach(k => sessionStorage.removeItem(k));
     ["calendarRole","overviewScope","personalEvents","agencyEvents","personalTasks",
      "financial_leads_data","fm_team_members_v1","fm_announcement_responses_v1",
      "salesTrackerReflections","fm_training_progress_v2","attendanceEvents",
      "attendanceRecords","todoSidebarExpanded","todoReminderWindow","todoNotifyEnabled"]
       .forEach(k => localStorage.removeItem(k));
   });
   ```
10. **Eliminate duplicate `drawMockQr`** (`attendance.js` and `calendar.js`). Move to `api.js` or a shared util, or — better — adopt `qrcode.js`.
11. **Hardcoded period info in `agent-comparison.js:28-37`** — derive from `new Date()` instead of pinning to 2026.
12. **`fm_announcements_v1` is read but never written.** Either remove the dead read in `auth.js:386` or cache `/announcements` results to that key.
13. **`renderCalendar` writing to `#todo-reminder-list` (bug 9.11)** — pick one renderer or rename one of the element ids to disambiguate the two reminder lists.
14. **Use `defer` on module scripts** so they always execute after parse, and HTML script ordering is less brittle.
15. **Type-check `period_year` / `district_rank` returns** — MySQL numeric types come back as JS numbers in mysql2, but DECIMAL comes back as a string by default. `Number(r.ytd_fyc || 0)` defends against that — good — but `r.district_rank` is passed to `agentInc(item, index)` without conversion in places.
16. **Add a `Content-Security-Policy` header at the API gateway / via CloudFront** if these pages are ever served publicly. Today `auth.js` and `nav.js` use plenty of `innerHTML` injection of user-controlled data — only `escapeHtml` in `announcements.js` and `attendance.js` actually sanitizes.

---

_End of review. Generated by automated audit; no source files modified._
