# AIA Financial Agent Dashboard — Bug / Issue Review

_Originally audited 2026-05-14. **Updated 2026-05-14 after pulling `72d2dc2` and `82ee560`.**_
_Files inspected: every file under `frontend/`, `backend/`, plus `lambda/index.mjs` and `schema.sql`._

---

## Update Log (2026-05-14)

### What the two commits changed

**`72d2dc2` "Updated Backend for Users" (Daryl)**
- Introduced a new **admin** role and a dedicated admin workspace (`backend/admin.js`, `frontend/admin.html`).
- Reworked `backend/auth.js` to accept agent IDs as usernames and to call `POST /auth/login` (with a hardcoded `ARIEL`/`ariel` fallback so dev login still works without a seeded DB).
- Removed the `"A123"` default for `dashboardUser` and the `"district"` role string from `attendance.js`, `sales-tracker.js`, `training.js`, `announcements.js`, `leads.js`. The role values the frontend now produces are `agent | leader | admin`.
- Onboarding page was repurposed: `onboarding.js` redirects admins to an admin user editor; `frontend/admin.html` (separate page) is the primary admin surface.
- Frontend index page received an `#overview-agency-select` dropdown and renamed the second KPI to "Month to Date FYC".
- Lambda gained `POST /users`, `PUT /users/:id`, `DELETE /users/:id`, and `POST /performance/bulk` (~+209 lines).

**`82ee560` "calendar sync with db, updated the ui for planner and calendar" (Crystal)**
- Extracted the floating planner widget into a new `backend/planner.js` (527 lines).
- Massively rewrote `backend/calendar.js` (now 1958 lines, up from ~868). The rewrite adds per-event popovers, recurring-series edit/delete flows, an XLSX/CSV agency import path, a "Clear all agency events" action, an in-memory event cache fed by `loadCalendarFromApi()`, and a smart browser-notification scheduler.
- Trimmed `backend/dashboard.js` (1078 lines now). All planner/widget functions (`wireFloatingTodo`, `wirePersonalTodo`, reminder rendering, notification scheduler) moved to `planner.js`. The unconditional bottom `wireFloatingTodo()` at the old line 906 is gone.
- `backend/api.js` gained `toSGDate`, `mapCalendarEvent`, and `mapPersonalTask` (+47 lines). Note: `mapCalendarEvent` is now declared in **both** `api.js` and `calendar.js`.
- `frontend/calendar.html` was updated, and now loads scripts in the unusual order: `api.js → dashboard.js → calendar.js → planner.js → nav.js → auth.js` (auth/nav last — see new finding N4).

### Status of old findings (after cleanup)

The two commits resolved roughly 13 of the 27 original findings outright (`wireFloatingTodo` extracted to planner.js, `/auth/login` wired up, dashboard's `/performance` field reads corrected, cross-user agency events fetched, A123 fallback dropped, render-race in `renderCalendar` resolved, division-by-zero guarded, calendar rewrites supersede several smells). **Those entries have been removed from this file** to keep it actionable. What remains in §2/§7/§9 below is the set of issues still present in the current code, plus the new ones introduced by the pull (sections numbered 2.28+, 7.8, 9.28+).

### New top issues introduced by the two commits

1. **Floating planner widget vanished from the home dashboard.** `planner.js` is loaded **only** by `frontend/calendar.html`. `index.html` does not include it, so the planner sidebar — the primary entry point for personal tasks and the "upcoming events" reminder strip — is no longer reachable from the home page. (Was previously injected by `dashboard.js`'s unconditional `wireFloatingTodo()` call.)
2. **`mapCalendarEvent` is declared twice** — once in `api.js:151-168` and again in `backend/calendar.js:101-117`. Both are non-strict function declarations; on pages where both files load (`index.html`, `calendar.html`, `resources.html`) the second declaration wins. The two implementations differ subtly: `api.js` runs `toSGDate()` and slices times to `HH:MM`; `calendar.js` does its own date slicing and time slicing. Confusing and ripe for future drift.
3. **`backend/calendar.js:481` filters personal leads by `lead.owner === "district"` for admins**, but `dashboard.js:53` only ever assigns `owner: 'agent'` or `'district'` based on whether the lead's `ownerId === sessionStorage.dashboardUser`. For an admin user, every lead owned by themselves becomes `'agent'`, so the admin sees the *opposite* set of leads they should: agency-wide leads (not theirs) instead of their own. Likely a regression from re-labelling "district" → "admin" elsewhere without updating this filter.
4. **`frontend/calendar.html` script load order is inverted**: `api.js → dashboard.js → calendar.js → planner.js → nav.js → auth.js`. Authentication gating now happens *after* all the calendar/planner code has fired side-effectful initializers and (potentially) network requests. Functionally still works because `wireCalendarPage()` reads `sessionStorage.dashboardUser`, which is empty for unauthenticated users (then `loadCalendarFromApi` calls `/events?userId=` → returns global events). Visible symptom for an unauthenticated visitor: brief flash of the calendar grid before `auth.js` redirects to `login.html`.
5. **`/users` schema vs. admin user creation.** `schema.sql:33-36` seeds only the role keys `agent`, `leader`, `district`. The new admin path (`admin.js:213-242` POST to `/users` with `role: "admin"`) hits Lambda line 500-504 which does `SELECT role_id FROM roles WHERE role_key='admin'` — if that row is missing, the Lambda returns `400 "Invalid role"`. Similarly, the new login attempts to look up ARIEL in the DB before falling back to the hardcoded `DEMO_USERS` map. The seed migration to add an `admin` role is not in the repo.
6. **`backend/agent-comparison.js:347` still reads `r.delta`, `r.cases`, `r.team_code`** — none of which exist on the `/performance` response. The same fields were fixed in `dashboard.js:84-102` but the parallel mapper here was missed. Result: the agent-comparison page still shows 0 for every DELTA, 0 for every CASES value, and falls back to `agent_id` for every team chip.

---

## 1. Summary — Top 5 highest-priority issues (current)

1. **Planner widget no longer renders on `index.html`.** New regression: `planner.js` (which now owns `wireFloatingTodo` and `wirePersonalTodo`) is included only by `frontend/calendar.html`. Every other page that previously had the floating "My Planner" sidebar — most importantly the home dashboard at `index.html` — now has no entry point for personal tasks or upcoming-event reminders. Fix: add `<script src="../backend/planner.js"></script>` to `index.html` (and arguably to every page that used to receive it).
2. **`backend/agent-comparison.js:347` field-name mismatch.** Reads `r.delta`, `r.cases`, `r.team_code`; Lambda returns `delta_pct`, `total_cases`, `team_name`. Delta is always 0, cases is always 0, team chip falls back to agent_id. Dashboard.js was fixed; this parallel mapper was missed.
3. **`backend/calendar.js:481` inverted owner filter.** `(role === "admin" ? lead.owner === "district" : lead.owner === "agent")` — but `dashboard.js:53` never sets `lead.owner = "district"` anymore (only `'agent'` or `'district'`, computed against current session user). For an admin, this returns the leads they do *not* own — silently wrong "Personal Appointment" calendar entries.
4. **`backend/api.js:98` still maps `r.follow_ups` (snake)** while the Lambda emits `followUps` (camelCase, `lambda/index.mjs:167`). Every lead surfaces `followUps: []`. The Leads-page drawer, the client-profile timeline, and the leads-list "next meet date" derivation all see empty arrays.
5. **`backend/room-booking.js:561` still reads `r.name` and `r.color`** while the `rooms` table columns are `label` and `dot_color`. Room labels render as their room_id; chips render with the hardcoded fallback color `#93c5fd`. Untouched by either of the new commits.

---

## 2. Critical bugs

### 2.3 `wireRoleControl()` calls `renderCalendarPermissions` (now in calendar.js)  **[still present]**

**File**: `backend/dashboard.js:797-807`

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

Still defined the same way. Still safe because `index.html`, `calendar.html`, `resources.html` all load `calendar.js` before `dashboard.js` (well, `calendar.html` loads `dashboard.js` *first* then `calendar.js`, but the call site is inside an event listener so by the time the user clicks the role select, calendar.js has been parsed). Brittle.

### 2.4 Login token never stored; subsequent calls unauthenticated  **[partially fixed]**

`backend/auth.js:44-51` now calls `apiPost("/auth/login", { userId, password })` and stores `role`/`userId` in sessionStorage. Three remaining concerns:
- The returned `token` (`lambda/index.mjs:126`) is **not stored** anywhere and **no `Authorization` header is sent** by `api.js` on subsequent calls (`api.js:3-33`). Login hits the DB, but every other endpoint remains unauthenticated.
- Any user ID that does not start with `ARIEL`/`ADMIN` is bucketed as `"agent"` by `detectRole()` (`auth.js:32-34`) — so a leader provisioned in the DB but with prefix `L123` ends up with `role="agent"` until the API responds (then `resolvedRole = apiUser?.role || detected.key` overrides).
- "Open agent login" mode (`isOpenAgentLogin` at `auth.js:36`) silently lets any non-ARIEL user in without an API check when `loginFromApi` returns null (e.g., network error). Soft bypass — partially intentional for offline dev.

### 2.5 `agent-comparison.js` still reads wrong `/performance` field names  **[still present]**

`backend/dashboard.js` was fixed in `72d2dc2` but the parallel mapper in `agent-comparison.js:347` was missed:
```js
return { name: r.full_name || r.agent_id,
         rank: r.district_rank || 0,
         ytdFyc: Number(r.ytd_fyc || 0),
         delta: Number(r.delta || 0),            // ← should be r.delta_pct
         cases: Number(r.cases || 0),            // ← should be r.total_cases
         team: r.team_code || r.agent_id };     // ← should be r.team_name
```
The agent-comparison page still shows 0 delta, 0 cases, and falls back to the agent_id for every team chip.

### 2.6 `/rooms` field-name mismatches  **[still present]**

**File**: `backend/room-booking.js:561` — unchanged:
```js
return { id: r.room_id, label: r.name || r.room_id, cls: 'room-' + r.room_id, dot: r.color || '#93c5fd' };
```
Should be `r.label` and `r.dot_color`. Schema (`schema.sql:184-191`) and Lambda (`SELECT *` at line 937-939) both confirm the columns are `label` and `dot_color`.

### 2.7 `wireLeadFilters` uses `localeCompare` on potentially undefined `meetupDate`  **[still present]**

**File**: `backend/dashboard.js:387` (was 258-260):
```js
filtered.sort((a, b) =>
  sortDirection === "asc" ? a.meetupDate.localeCompare(b.meetupDate) : b.meetupDate.localeCompare(a.meetupDate)
);
```
Unchanged. `mapLead` passes `r.meet_date` to `meetDate` and dashboard.js wraps it as `meetupDate: r.meetDate || ''`. The `|| ''` coercion is correct for an empty Date, but a `Date` object would still throw on `.localeCompare`. Low-priority because `loadOverviewData` normalises the value, but the safeguard is fragile.

### 2.8 `mapLead` references `r.follow_ups` (snake) but Lambda nests as `followUps` (camel)  **[still present]**

**File**: `backend/api.js:98-100`:
```js
followUps: (r.follow_ups || []).map(function(f) {
  return { label: f.label, date: f.scheduled_date, done: !!f.is_done };
}),
```
Lambda's GET `/leads` still emits the nested array under key `followUps` (`lambda/index.mjs:163-169`). So `r.follow_ups` is always undefined → every lead surfaces `followUps: []`. Affects:
- `leads.js:122` (next-meet-date derivation) → always empty.
- `leads.js:190` (lead-drawer timeline) → renders no items.
- `client-profile.js:184-191` (Profile timeline) → renders no items.

### 2.9 `mapLead` Object.assign + extra ordering  **[still present, semantics unchanged]**

`api.js:65-102` still uses `Object.assign({}, extra, {...})`. Behaviour identical to the previous audit. Not a bug.

### 2.10 `dashboard.js` filters leads on `meetupDate <= today` for "YTD premium"  **[still present]**

**File**: `backend/dashboard.js:323-326` (was 194-202). Same data-model smell. Meetup date is not closure date.

### 2.11 Async fire-and-forget API calls swallow all errors silently  **[still present, worse]**

Now even more places — every CRUD path in `calendar.js` swallows errors:
`backend/calendar.js:278, 311, 350, 373, 380, 397, 403, 410, 427, 1739` plus `planner.js:34, 314, 324, 344, 356, 387`. The pattern remains `apiPost(...).catch(() => {})`. No `console.warn` even in the catch block in most cases. UI shows a green checkmark; data never reaches DB.

### 2.12 `calendar.js` writes agency events to localStorage only when non-empty  **[still present]**

**File**: `backend/calendar.js:155-157`:
```js
localStorage.setItem(PERSONAL_EVENTS_STORAGE_KEY, JSON.stringify(_personalEvents));
localStorage.setItem(PERSONAL_TASKS_STORAGE_KEY,  JSON.stringify(_personalTasks));
if (_agencyEvents.length > 0) localStorage.setItem(AGENCY_EVENTS_STORAGE_KEY, JSON.stringify(_agencyEvents));
```
Same pattern as before. Empty API agency-event response leaves stale local data on the page.

### 2.14 `client-profile.js` does not refresh page when API returns no rows  **[still present]**

**File**: `backend/client-profile.js:402-410`. Unchanged. Same stale-localStorage hazard when the API returns `[]`.

### 2.15 `attendance.js` early-returns if no `dashboardRole`  **[still present]**

`backend/attendance.js:8-9` — still:
```js
var signedInRole = sessionStorage.getItem("dashboardRole");
if (!signedInRole) return;
```
Mostly defensive; auth.js redirects unauthenticated users before this matters.

### 2.17 `dashboard.js` `loadOverviewData` skips API if no `dashboardUser`  **[still present]**

`backend/dashboard.js:29-32`. Unchanged. Silently leaves leadData empty when `dashboardUser` is missing. But the auth.js redirect for unauthenticated users now stores a session user immediately on login, so this path is normally unreachable.

### 2.20 Mojibake (UTF-8 / cp1252) artifacts  **[still present]**

`backend/dashboard.js:261, 307, 353` still contain `Â·` instead of `·`. Same in agent-comparison.js. The rewrites added some new garbled-character locations too (`calendar.js:181, 247, 938, 1077, 1090` contain `·` characters that *are* correct UTF-8 now — the existing mojibake in dashboard.js stands out as the only remaining problem).

### 2.21 `dashboard.js` string-concat precedence bug  **[still present]**

**File**: `backend/dashboard.js:960`:
```js
if (label) label.textContent = agents.length + " agents · " + agencies.length - 1 + " agencies · " + fileName;
```
Same operator-precedence trap. `"x agents · 6" - 1 = NaN`. Should wrap `(agencies.length - 1)` in parens. Untouched by the new commits.

### 2.22 Unguarded `document.getElementById('fRecurrence')`  **[still present]**

`backend/room-booking.js:548`. Unchanged.

### 2.23 `room-booking.js` deletes only one occurrence  **[still present]**

`backend/room-booking.js:534-540`. Unchanged. No "delete series" UX or API.

### 2.24 `room-booking.js` builds `cls: 'room-' + r.room_id`  **[still present]**

`backend/room-booking.js:561`. Same as 2.6. Ignores `css_class`.

### 2.25 Planner's "Upcoming Events" list always includes holidays  **[still present — minor]**

`backend/calendar.js:516-518` (`getCalendarEventsForView`) defers to `getLeadEvents`, which gates holidays behind `if (options.showHolidays !== false)`. But the planner sidebar (`backend/planner.js:210`) calls it with `{ showPersonal: true, showAgency: true }` — no `showHolidays` flag — so holidays show up in the planner's "Upcoming Events" reminder list.

### 2.26 Mock QR — `attendance.js` and `calendar.js` define `drawMockQr` independently  **[still present]**

`backend/attendance.js:237-268` and `backend/calendar.js:1181-1217`. Two near-duplicate canvas mock-QR functions. Unchanged.

### 2.27 `agent-comparison.js` assumes `AGENTS.length >= 2`  **[still present]**

`backend/agent-comparison.js:353-354`:
```js
if (AGENTS.length >= 2) { addAgent(0); addAgent(1); }
else { render(); }
```
Unchanged. An environment with 0 or 1 agents shows the empty state.

### 2.28 (NEW) `getLeadEvents` admin owner filter is inverted  **[NEW — introduced by `72d2dc2` rename]**

**File**: `backend/calendar.js:480-491`

```js
const personalLeads = leadData
  .filter((lead) => (role === "admin" ? lead.owner === "district" : lead.owner === "agent"))
  .map((lead) => ({ … }));
```

But `backend/dashboard.js:53` defines `owner` as:
```js
owner: r.ownerId === userId ? 'agent' : 'district',
```
For a logged-in admin, the leads they own get `owner: "agent"` (because `ownerId === userId`); the leads owned by other agents get `owner: "district"`. The filter then takes `owner === "district"` for admin role — meaning the calendar shows **everyone else's** lead meet-ups but **not the admin's own**. Functionally the opposite of what an admin would expect.

Root cause: when the `"district"` role was renamed to `"admin"` throughout, this branch was updated to check `role === "admin"` but the inner `lead.owner === "district"` check wasn't reconciled. Either change to `lead.owner === "agent"` (show admin's own only — but then this branch becomes identical to the else) or define a separate predicate for "all leads".

### 2.29 (NEW) `mapCalendarEvent` declared twice  **[NEW — introduced by `82ee560`]**

`backend/api.js:151-168` declares `function mapCalendarEvent(r)`. `backend/calendar.js:101-117` declares another `function mapCalendarEvent(r)`. Both run as plain function declarations (no module scope). On `index.html`, `calendar.html`, and `resources.html` both files load. The second declaration overrides the first; `calendar.js`'s wins.

The two differ:
- `api.js` runs `toSGDate()` (timezone-aware) and slices times to 5 chars.
- `calendar.js` uses an ad-hoc `toDate` helper that does `.toISOString().slice(0, 10)` (no timezone math), and slices times to 5 chars with a different guard.

Result: in `calendar.js`'s wrap, a DATE column arriving as `"2026-05-14T16:00:00.000Z"` (UTC) gets converted to `"2026-05-14"`, even though it represents 2026-05-15 00:00 SGT. The toSGDate fix in api.js is silently overridden on the calendar page. (For pages that don't load `calendar.js`, the api.js version applies.)

### 2.30 (NEW) Planner widget removed from non-calendar pages  **[NEW — regression from `82ee560`]**

`backend/planner.js:526-527`:
```js
wireFloatingTodo();
wirePersonalTodo();
```
runs unconditionally at script-load, **but `planner.js` is only included by `frontend/calendar.html`**. Every other page that previously got the floating planner sidebar (most importantly `index.html`) now has nothing. Verified by grep:

```
$ grep -l planner.js frontend/*.html
frontend/calendar.html
```

Recommended fix: include `<script src="../backend/planner.js"></script>` after `calendar.js` on `index.html` (and arguably on every authenticated page).

### 2.31 (NEW) `dashboard.js` calls `wireOverviewAgencySelector` only on home; agency selector hidden on other pages  **[NEW — by design but worth noting]**

`backend/dashboard.js:530-539` defines `wireOverviewAgencySelector` and `dashboard.js:819` calls it inside the `isHomeDashboardPage()` async IIFE. `#overview-agency-select` only exists on `index.html` (verified by grep). So the agency dropdown is bound only on the home dashboard. The dropdown is populated from `performanceRows[*].teamName` — empty until `/performance` returns rows. If `/performance` returns an empty array (e.g., fresh DB), the dropdown's only option remains `<option value="">Loading agencies</option>` (`index.html:31`).

---

## 3. API / DB mismatches — route audit

### 3.1 Lambda routes implemented in `lambda/index.mjs`

Updated for the new endpoints added in `72d2dc2`. Re-counted with fresh line numbers (`lambda/index.mjs` is now 1140 lines).

| # | Method  | Path                                | Lambda line | Notes |
|---|---------|-------------------------------------|-------------|-------|
| 1 | GET     | `/health`, `/api/health`            | 93 | unused |
| 2 | POST    | `/auth/login`, `/api/auth/login`    | 100 | **now called by `auth.js:46-51`** (fixes old #2) |
| 3 | GET     | `/users`                            | 133 | called by sales-tracker.js, admin.js |
| 4 | **POST**    | `/users`                            | 489 | **NEW** — called by admin.js for create |
| 5 | **PUT**     | `/users/:id`                        | 525 | **NEW** — called by admin.js for edit |
| 6 | **DELETE**  | `/users/:id`                        | 563 | **NEW** — called by admin.js for delete (soft-delete, sets `is_active=0`) |
| 7 | GET     | `/leads`                            | 149 | called by leads.js, client-profile.js, dashboard.js |
| 8 | GET     | `/leads/:id`                        | 176 | unused |
| 9 | PUT     | `/leads/:id`                        | 186 | **unused** (`create-profile.js` saves to localStorage only) |
| 10 | DELETE  | `/leads/:id`                        | 233 | unused |
| 11 | POST    | `/leads`                            | 239 | **unused** (`create-profile.js` saves to localStorage only) |
| 12 | GET     | `/events`                           | 275 | called by calendar.js (twice — once with userId, once with category=agency) |
| 13 | POST    | `/events`                          | 286 | called by calendar.js |
| 14 | DELETE  | `/events?recurrenceId=`            | 317 | called by calendar.js (`deleteAgencyEventSeries`, `deletePersonalEventSeries`) |
| 15 | PUT     | `/events/:id`                      | 331 | called by calendar.js |
| 16 | DELETE  | `/events/:id`                      | 353 | called by calendar.js |
| 17 | POST    | `/events/bulk`                     | 359 | unused (calendar.js does individual POSTs in a batched loop) |
| 18 | GET     | `/tasks`                           | 392 | called by calendar.js (`loadCalendarFromApi`) |
| 19 | POST    | `/tasks`                           | 402 | called by calendar.js (`addPersonalTask`) |
| 20 | PUT     | `/tasks/:id`                       | 428 | **now called** by planner.js (lines 34, 314, 344, 387) |
| 21 | DELETE  | `/tasks/:id`                       | 441 | **now called** by planner.js (lines 324, 356) |
| 22 | POST    | `/tasks/bulk`                      | 447 | unused |
| 23 | GET     | `/performance`                     | 473 | called by dashboard.js, agent-comparison.js |
| 24 | **POST**    | `/performance/bulk`                 | 569 | **NEW** — called by admin.js (line 337) and dashboard.js (line 851) |
| 25 | GET     | `/cpf`                             | 686 | called by dashboard.js |
| 26 | GET     | `/cpf-rates`                       | 698 | called by cpf-calculator.js |
| 27 | GET     | `/training/topics`                 | 724 | called by training.js |
| 28 | GET     | `/training/progress`               | 741 | **unused** (training.js reads/writes localStorage) |
| 29 | POST    | `/training/progress`               | 755 | **unused** |
| 30 | DELETE  | `/teams/:managerId/:agentId`       | 774 | called by onboarding.js |
| 31 | GET     | `/teams/:managerId`                | 784 | called by onboarding.js, training.js |
| 32 | POST    | `/teams/:managerId`                | 801 | called by onboarding.js |
| 33 | GET     | `/announcements`                   | 816 | called by announcements.js |
| 34 | POST    | `/announcements`                   | 821 | called by announcements.js |
| 35 | GET     | `/announcement-responses`          | 835 | **unused** |
| 36 | POST    | `/announcements/:id/responses`     | 844 | **unused** (announcements.js writes to localStorage) |
| 37 | GET     | `/sales-activity-types`            | 865 | **unused** |
| 38 | GET     | `/sales-settings`                  | 870 | called by sales-tracker.js |
| 39 | GET     | `/sales-entries`                   | 875 | called by sales-tracker.js |
| 40 | POST    | `/sales-entries`                   | 888 | called by sales-tracker.js |
| 41 | GET     | `/sales-reflections`               | 906 | **unused** |
| 42 | POST    | `/sales-reflections`               | 916 | **unused** (sales-tracker.js writes to localStorage) |
| 43 | GET     | `/rooms`                           | 936 | called by room-booking.js |
| 44 | GET     | `/room-bookings`                   | 944 | called by room-booking.js |
| 45 | POST    | `/room-bookings`                   | 951 | called by room-booking.js |
| 46 | PUT     | `/room-bookings/:id`               | 973 | called by room-booking.js |
| 47 | DELETE  | `/room-bookings/:id`               | 994 | called by room-booking.js |
| 48 | GET     | `/attendance-events`               | 1003 | called by attendance.js |
| 49 | POST    | `/attendance-events`               | 1012 | unused |
| 50 | GET     | `/attendance-records`              | 1044 | **unused** |
| 51 | POST    | `/attendance-records`              | 1054 | **unused** (attendance.js writes to localStorage) |
| 52 | GET     | `/public-holidays`                 | 1076 | **unused** (calendar.js fetches nager.at instead) |
| 53 | GET     | `/recruitment`                     | 1089 | unused |
| 54 | POST    | `/recruitment/access`              | 1093 | unused |
| 55 | startsWith `/helpdesk/tickets`     | 1103 | unused stub |
| 56 | GET     | `/resources`                       | 1110 | **unused** (resources.html is static) |

Net change since previous audit: **5 new routes** (`POST /users`, `PUT /users/:id`, `DELETE /users/:id`, `POST /performance/bulk`, and `POST /auth/login` is now actually called). **2 more existing routes are now actually called** (`PUT /tasks/:id` and `DELETE /tasks/:id` via the planner's checkbox/delete buttons).

### 3.2 Frontend routes called

Updated table:

| Path called by frontend | File | Notes |
|------|------|-------|
| `POST /auth/login` | auth.js:46-51 | **NEW caller** |
| `GET /users` | sales-tracker.js, admin.js | NEW second caller |
| `POST /users` | admin.js:230 | NEW |
| `PUT /users/:id` | admin.js:227 | NEW |
| `DELETE /users/:id` | admin.js:257 | NEW |
| `POST /performance/bulk` | admin.js:337, dashboard.js:851 | NEW; both callers do roughly the same thing |
| `PUT /tasks/:id` | planner.js:34, 314, 344, 387 | NEW caller |
| `DELETE /tasks/:id` | planner.js:324, 356 | NEW caller |
| `GET /leads?userId=` | leads.js, client-profile.js, dashboard.js | still drops `followUps` (camelCase) → bug 2.8 |
| `GET /performance` | dashboard.js, agent-comparison.js | dashboard fixed, agent-comparison still reads `r.delta`/`r.cases`/`r.team_code` (bug 2.5 part) |
| `GET /events?userId=` | calendar.js:128 | personal events |
| `GET /events?category=agency` | calendar.js:129 | NEW: agency events fetched separately (fixes old 2.13) |
| `GET /tasks?userId=` | calendar.js:130 | NEW: tasks loaded from API on calendar page |
| `POST /events` | calendar.js (`addPersonalEvent`, `addAgencyEvent`, import loop) | OK |
| `PUT /events/:id` | calendar.js (`updatePersonalEvent`, `updateAgencyEventSeries`, agency-edit save) | OK |
| `DELETE /events/:id` | calendar.js (`deleteAgencyEvent`, `deletePersonalEvent`) | OK |
| `DELETE /events?recurrenceId=` | calendar.js (series delete) | OK |
| `POST /tasks` | calendar.js (`addPersonalTask`) | OK |
| `GET /announcements`, `POST /announcements` | announcements.js | OK |
| `GET /sales-settings`, `GET /sales-entries`, `POST /sales-entries` | sales-tracker.js | OK |
| `GET /cpf?agentId=` | dashboard.js | OK |
| `GET /cpf-rates` | cpf-calculator.js | OK |
| `GET /training/topics` | training.js | OK |
| `GET /teams/:id`, `POST /teams/:id`, `DELETE /teams/:mgr/:agt` | onboarding.js, training.js | OK |
| `GET /rooms`, `GET /room-bookings`, `POST/PUT/DELETE /room-bookings` | room-booking.js | OK (room field bug 2.6 unchanged) |
| `GET /attendance-events` | attendance.js | OK |

---

## 4. JS dependency issues

### 4.1 Missing `api.js` / `nav.js` / `auth.js` / `planner.js` on some pages

Re-derived table:

| Page                       | nav.js | auth.js | api.js | calendar.js | dashboard.js | planner.js | Module |
|----------------------------|:------:|:-------:|:------:|:-----------:|:------------:|:----------:|--------|
| `index.html`               | ✓ | ✓ | ✓ | ✓ | ✓ | **MISSING** | n/a |
| `admin.html` (NEW)         | ✓ | ✓ | ✓ | – | – | – | admin.js |
| `leads.html`               | ✓ | ✓ | ✓ | – | – | – | leads.js |
| `client-profile.html`      | ✓ | ✓ | ✓ | – | – | – | client-profile.js |
| `calendar.html`            | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | n/a |
| `room-booking.html`        | ✓ | ✓ | ✓ | – | – | – | room-booking.js |
| `attendance.html`          | ✓ | ✓ | ✓ | – | – | – | attendance.js |
| `sales-tracker.html`       | ✓ | ✓ | ✓ | – | – | – | sales-tracker.js |
| `cpf-calculator.html`      | ✓ | ✓ | ✓ | – | – | – | cpf-calculator.js |
| `training.html`            | ✓ | ✓ | ✓ | – | – | – | training.js |
| `announcements.html`       | ✓ | ✓ | ✓ | – | – | – | announcements.js |
| `agent-comparison.html`    | ✓ | ✓ | ✓ | – | – | – | agent-comparison.js |
| `onboarding.html`          | **MISSING** | ✓ | ✓ | – | – | – | onboarding.js |
| `resources.html`           | ✓ | ✓ | ✓ | ✓ | ✓ | – | n/a (resources are hardcoded HTML) |
| `login.html`               | – | ✓ | ✓ | – | – | – | n/a |
| `create-profile.html`      | ✓ | ✓ | **MISSING** | – | – | – | create-profile.js |

Issues:
- **`onboarding.html` is still missing `nav.js`** (`frontend/onboarding.html:236-238`). Unchanged from previous audit. Page has no top navigation strip injected.
- **`create-profile.html` is still missing `api.js`** (`frontend/create-profile.html:377-379`). Unchanged. `create-profile.js` saves leads only to localStorage; the `POST /leads` Lambda route remains unused.
- **`index.html` is missing `planner.js`** (NEW regression — the floating planner widget is gone from the home dashboard). See finding 2.30.
- **`login.html` now correctly includes `api.js`** before `auth.js` (`frontend/login.html:28-29`). The new login form needs `apiPost` to call `/auth/login`. ✓
- **`resources.html` still loads `calendar.js` + `dashboard.js`** (`frontend/resources.html:74-75`). This is now mostly harmless because `wireFloatingTodo` is no longer called by dashboard.js — but the bulk of those scripts is still being parsed for a page that doesn't need them.

### 4.2 Load order

`frontend/calendar.html` has an unusual order: `xlsx (CDN) → api.js → dashboard.js → calendar.js → planner.js → nav.js → auth.js`. See new finding N4 (auth/nav last).

Every other page that uses module scripts still uses the conventional `nav.js → auth.js → api.js → <module>` order.

### 4.3 Cross-file globals

`dashboard.js:3` still declares `var leadData = []`. `calendar.js:480` still reads it. ✓

`dashboard.js` no longer calls calendar.js functions directly (planner.js now owns those call sites). `dashboard.js:802` still calls `renderCalendarPermissions(...)` from calendar.js (in the role-select sync handler) — see 2.3.

`planner.js` (lines 14, 28, 44, 49, 164, 210, 213, 214, 271, 480, 510) reads from calendar.js: `getPersonalTasks`, `savePersonalTasks`, `addPersonalTask`, `getUpcomingCalendarReminders`, `getCalendarEventsForView`, `openCalendarEventDialog`, `openPersonalEventDialog`. All defined in `calendar.js`. ✓ Safe only because `calendar.html` loads calendar.js before planner.js.

### 4.4 Undefined references

None inside any single file. The cross-file references in §4.3 cover all the inter-file dependencies.

---

## 5. HTML script tag audit (per page) — rebuilt 2026-05-14

Listing `<script src=…>` in load order.

### `frontend/index.html`
```
xlsx@0.20.3 (CDN) → nav.js → auth.js → api.js → calendar.js → dashboard.js
```
⚠️ **Missing planner.js** — no floating planner widget on home dashboard. See finding 2.30.

### `frontend/admin.html` (NEW)
```
xlsx@0.20.3 (CDN) → nav.js → auth.js → api.js → admin.js
```
✅ OK. admin.js requires XLSX for the production-report upload path.

### `frontend/leads.html`
```
nav.js → auth.js → api.js → leads.js
```
✅ OK.

### `frontend/client-profile.html`
```
nav.js → auth.js → api.js → client-profile.js
```
✅ OK.

### `frontend/calendar.html`
```
xlsx (CDN) → api.js → dashboard.js → calendar.js → planner.js → nav.js → auth.js
```
⚠️ Unusual order: `nav.js` and `auth.js` load **last**. All module scripts initialize before authentication is checked. See finding N4.

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
✅ OK (same caveat as before — `api.js` is positioned at line 38, near the announcements.js tag, instead of right after auth.js).

### `frontend/agent-comparison.html`
```
nav.js → auth.js → api.js → agent-comparison.js
```
✅ OK.

### `frontend/onboarding.html`
```
auth.js → api.js → onboarding.js
```
❌ **MISSING `nav.js`** — unchanged from previous audit (`frontend/onboarding.html:236-238`).

### `frontend/resources.html`
```
nav.js → auth.js → api.js → calendar.js → dashboard.js
```
⚠️ Still unnecessary load of `calendar.js` and `dashboard.js`. Bug 2.1 ("unconditional `wireFloatingTodo()` injects a planner widget here") is no longer triggered because that code lives in `planner.js` now and `planner.js` is not on this page. So the over-include is wasted parse time but no longer renders a stray widget.

### `frontend/login.html`
```
api.js → auth.js
```
✅ Correct — `api.js` must load before `auth.js` so that `auth.js`'s new `loginFromApi` can call `apiPost`.

### `frontend/create-profile.html`
```
nav.js → auth.js → create-profile.js
```
⚠️ Still missing `api.js`. `create-profile.js` is still local-storage-only (`POST /leads` never invoked). Unchanged from previous audit.

---

## 6. Field / schema mismatches

Updated:

| Frontend location | Field accessed | DB column actually returned | Effect | Status |
|--------|----|----|---|---|
| `backend/api.js:98` (`mapLead`) | `r.follow_ups` | Lambda key is `followUps` (camel) | All follow-up arrays appear empty | **still present** |
| `backend/agent-comparison.js:347` | `r.delta`, `r.cases`, `r.team_code` | DB columns are `delta_pct`, `total_cases`, `team_name` | Comparison page DELTA, CASES are zero | **still present** |
| `backend/room-booking.js:561` | `r.name`, `r.color` | DB columns `label`, `dot_color` | Room labels show their ids; all rooms render with the same fallback dot color | **still present** |
| `lambda/index.mjs:493, 500-504` | `roleKey` from POST body looked up in `roles` table | **`schema.sql:33-36` seeds only `agent`, `leader`, `district` — no `admin` row** | `POST /users role=admin` returns 400 "Invalid role" until the `admin` role is seeded | **NEW — see finding N5** |
| `backend/calendar.js:480-491` | `lead.owner === "district"` for admin role | `dashboard.js:53` never sets `owner: 'district'` for the admin's own leads; it's set for everyone *else*'s leads | Admin's calendar shows other agents' lead meet-ups, not their own | **NEW — see finding 2.28** |
| `backend/calendar.js:101-117` and `backend/api.js:151-168` | both declare `mapCalendarEvent` | n/a | calendar.js wins; api.js timezone-aware mapper is shadowed | **NEW — see finding 2.29** |
| `backend/dashboard.js:78` (`r.amount`) | `r.amount` cast to Number | DB column `VARCHAR(50)` | NaN if amount has commas/symbols | **still present (unchanged)** |

---

## 7. Auth / session issues

### 7.1 Login token discarded; no Bearer auth on subsequent calls  **[partially fixed]**

See 2.4. `auth.js:46-51` calls `apiPost("/auth/login", ...)` and stores `role`/`userId`, but the bcrypt-validated `token` in the response is never stored or sent as a Bearer header. Every subsequent API call remains unauthenticated.

### 7.2 Session keys actually set / read

**Set by `auth.js`:**
- `sessionStorage.dashboardRole`  → `"agent" | "leader" | "admin"` (no longer `"district"`)
- `sessionStorage.dashboardUser`  → uppercased userId
- `sessionStorage.announcementPromptPending` → `"1"`
- `localStorage.calendarRole`     → `"admin"` if admin else `"agent"` (`auth.js:88`) — **simpler** than before; no longer maps district → district_manager. Most calendar.js compares against `"admin" || "district"` (line 646, 1396, 1650) which still accepts both, so this change is backward-compatible.
- `localStorage.overviewScope`    → `"agency"` on every fresh login (`auth.js:89`)

**Removed on logout** (`auth.js:345-346`):
- `sessionStorage.dashboardRole`, `sessionStorage.dashboardUser`

**Still leaked on logout** (unchanged from previous audit): `localStorage.calendarRole`, `overviewScope`, `personalEvents`, `agencyEvents`, `personalTasks`, `financial_leads_data`, `fm_team_members_v1`, `fm_announcement_responses_v1`, `salesTrackerReflections`, `fm_training_progress_v2`, `attendanceEvents`, `attendanceRecords`, `sgHolidaysByYear`, `todoSidebarExpanded`, `todoReminderWindow`, `todoNotifyEnabled`, and now `overviewAgency`, `overviewAgencyInitializedFor`, `_plannerNotified_YYYY-MM-DD` keys (planner.js:473-475 cleans only its own per-day notification cache). Multi-user shared browsers still see previous-user data.

### 7.3 Empty `dashboardUser` exposes all leads  **[new defense gap]**

The previous `"A123"` fallback was dropped in `72d2dc2` (good), but if `dashboardUser` is somehow empty (auth redirect bypassed, race), `leads.js:28` calls `GET /leads?userId=` with an empty query value. Lambda treats the empty string as "no filter" and returns **all** leads in the DB — potentially exposing every lead to whichever user reached the page without a session. Normally unreachable via the auth.js redirect, but the defense-in-depth is gone.

Two sources of truth for role still exist (`localStorage.calendarRole` vs `sessionStorage.dashboardRole`), but both now use the same vocabulary (`agent | admin`). Calendar.js falls back to `"agent"` if missing (`calendar.js:644, 878`).

### 7.5 `attendance.js` early-returns silently if no role  **[still present]**

See 2.15. Unchanged.

### 7.8 (NEW) Admin role not seeded in DB

See finding N5 / §6 row. `schema.sql:33-36` does not include the `admin` role. The new flows (`POST /users role=admin`, `POST /auth/login` for admin user) will fail with `400 "Invalid role"` and `401 "Invalid User ID or password"` respectively until the role is seeded and an admin user is inserted with a bcrypt-hashed password. The hardcoded `DEMO_USERS = { ARIEL: { password: "ariel", role: "admin" } }` (auth.js:25-27) is the only emergency admin login when the DB doesn't have the role.

---

## 8. localStorage / sessionStorage key consistency

### All keys observed (updated)

```
localStorage:
  agencyEvents                            calendar.js
  personalEvents                          calendar.js, attendance.js (read)
  personalTasks                           calendar.js (also via planner.js)
  attendanceEvents                        attendance.js, calendar.js
  attendanceRecords                       attendance.js
  sgHolidaysByYear                        calendar.js
  calendarRole                            auth.js, dashboard.js, calendar.js, planner.js (read)
  overviewScope                           auth.js, dashboard.js
  overviewAgency                          dashboard.js  (NEW)
  overviewAgencyInitializedFor            dashboard.js  (NEW — sessionStorage actually)
  overviewAgentId                         dashboard.js (read only — never written by any module — orphan)
  todoSidebarExpanded                     planner.js
  todoReminderWindow                      planner.js
  todoNotifyEnabled                       planner.js, calendar.js (read)
  _plannerNotified_<YYYY-MM-DD>           planner.js (one per day, self-cleans old)
  financial_leads_data                    client-profile.js, create-profile.js
  fm_team_members_v1                      training.js (read), onboarding.js
  fm_announcement_responses_v1            announcements.js
  fm_announcements_v1                     auth.js (read)               ← still only READ, never written
  fm_training_progress_v2                 training.js
  salesTrackerReflections                 sales-tracker.js

sessionStorage:
  dashboardRole                           auth.js, attendance.js, sales-tracker.js, training.js, calendar.js, …
  dashboardUser                           auth.js + all modules
  announcementPromptPending               auth.js
  calendarReminderShown-<date>            calendar.js
  overviewAgencyInitializedFor            dashboard.js  (NEW — used to mark "have we seeded the user's home agency once this session?")
```

### Issues
- **`fm_announcements_v1` orphan read still present** (`auth.js:417-424`). Unchanged.
- **`overviewAgentId` orphan read** (NEW, `dashboard.js:154`): `localStorage.getItem("overviewAgentId")` — nothing in the repo writes this key. Probably a leftover from a planned feature; falls back to first row.
- **`attendance.js:45`** still reads `"personalEvents"` as a literal string. Same as previous audit. Should import the constant.
- No new typos like `personal_events` vs `personalEvents`.

---

## 9. Other bugs / smells

### 9.2 `dashboard.js` `agencies.length - 1` precedence bug  **[still present]**

See 2.21.

### 9.3 `wireOverviewTabs()` registers a `window` listener every call  **[partially fixed]**

`backend/dashboard.js:493-528`. Same `window.addEventListener("overviewScopeChanged", …)` (line 523) inside `wireOverviewTabs`. But the function is now only called from one place on the home page (the `isHomeDashboardPage()` async IIFE at line 820), so the duplicate-listener problem is gone in practice. Still: every page reload registers one new listener (no removal) — fine for a fresh page but fragile if the function were ever re-called by future code.

### 9.4 `calendar.js` fetch to nager.at is unauthenticated  **[still present]**

`backend/calendar.js:57`. Now wrapped in `ensureSGHolidaysLoaded` with caching, but the external dependency remains. Fallback for non-2026 years returns `[]`. Lambda has `/public-holidays` route (`lambda/index.mjs:1076`) but no frontend caller.

### 9.5 `calendar.js` — Year 2026 hardcoded in fallback  **[still present]**

`backend/calendar.js:7-19` `_sgHolidays2026Fallback`. Same.

### 9.6 `agent-comparison.js:353-354` — assumes `AGENTS.length >= 2`  **[still present]**

See 2.27.

### 9.7 `agent-comparison.js` top-level `getElementById("add-agent-btn")`  **[still present]**

`backend/agent-comparison.js:84-91`. Unchanged.

### 9.8 `sales-tracker.js` point chart ignores `selectedWeekOffset`  **[still present]**

`backend/sales-tracker.js:107-127`. Unchanged.

### 9.9 `sales-tracker.js:297-322` — sets a made-up id after POST  **[still present]**

Unchanged.

### 9.12 `room-booking.js:475` — inconsistent `await` on edit vs add  **[still present]**

Unchanged.

### 9.13 `room-booking.js:489-494` — refetches whole list after recurring booking  **[still present]**

Unchanged.

### 9.14 `onboarding.js` — `setList(mapped)` overwrites local roster every page load  **[still present]**

Unchanged.

### 9.15 `onboarding.js` — `setList(mapped)` runs even when `members.length === 0`  **[still present]**

Unchanged.

### 9.16 `training.js` — `window.onYouTubeIframeAPIReady` set inside IIFE  **[still present]**

Unchanged.

### 9.17 `training.js` writes progress to `localStorage` only  **[still present]**

Unchanged.

### 9.18 `announcements.js:209-230` — re-bind on `innerHTML` rebuild  **[still present, safe]**

Unchanged.

### 9.19 `client-profile.js:184` — `AVATAR_COLORS[(lead.id - 1) % 6]`  **[still present]**

Unchanged.

### 9.23 `agent-comparison.js:178-201` — hardcoded period info  **[still present]**

Unchanged.

### 9.25 `auth.js:62-69` — dead role-mismatch branch  **[partially fixed]**

`auth.js:77-83`:
```js
if (!apiUser && userRecord && userRecord.role !== detected.key) {
  if (roleError) { roleError.textContent = "User role mismatch for this User ID."; roleError.hidden = false; }
  return;
}
```
Now only fires when the API failed *and* the local DEMO_USERS has a mismatch — but DEMO_USERS contains only ARIEL/admin, and `detectRole("ARIEL")` returns `{ key: "admin" }`. So `userRecord.role === "admin"` always equals `detected.key === "admin"`. The branch is still dead, just for a different reason. Cosmetic.

### 9.26 `announcements.js:23-28` — cache never invalidates  **[still present]**

Unchanged.

### 9.27 `room-booking.js:78` — constants declared mid-IIFE  **[still present]**

Unchanged.

### 9.28 (NEW) `planner.js:526-527` — runs unconditionally  **[NEW]**

```js
wireFloatingTodo();
wirePersonalTodo();
```
Same anti-pattern as the old `dashboard.js:906` issue, but now in planner.js. The `wireFloatingTodo` guard at line 54 (`if (document.getElementById("floating-task-form")) return;`) prevents DOM duplication. The `wirePersonalTodo` guard at line 11 (`if (!form || !input || !list) return;`) prevents wiring without the right DOM. Safe today, but moves the script's behaviour out of the caller's control — the only way to opt out is to not include `planner.js` (which is what every page except `calendar.html` currently does, accidentally).

### 9.29 (NEW) `calendar.js:1042-1140` `openCalendarEventDialog` legacy modal path

The new code has two display modes: if called with a click event (the common case from grid clicks), it opens the non-blocking `_openDayPopup`; otherwise it falls back to the legacy `<dialog>` modal. The legacy modal is used by `planner.js:213` when clicking a reminder. The two have slightly different button labels and event wiring. Not a bug — just complexity worth noting.

### 9.30 (NEW) `calendar.js:1232` `dateInput.disabled = !!editSeries`

When editing an entire recurring series, the date input is disabled. But the form submit at line 1267-1294 still reads `dialog.querySelector("#agency-edit-dialog-date").value`. A disabled `<input type="date">` returns its current value, not empty — so this works. Minor code smell; would be cleaner to skip the date field entirely in series mode.

### 9.31 (NEW) `admin.js` data flow on save uses optimistic re-fetch

`backend/admin.js:240-242`:
```js
resetUserForm();
await loadData();
renderAll();
```
After every save, the entire users list is refetched. Slightly wasteful for a single-row edit but acceptable.

### 9.33 (NEW) `admin.js:38` — `normalizeRole` rewrites district → admin

```js
function normalizeRole(roleKey) {
  const value = String(roleKey || "").toLowerCase();
  if (value === "district_manager" || value === "district") return "admin";
  return value;
}
```
If the seed data still has a `district`-role user (because the schema seeds it), the admin UI will display them as Admin. Possibly intentional ("admin replaces district") but it does mean a leader cannot see a district user as `district` in this UI.

### 9.34 (NEW) `dashboard.js:843-866` — production report duplicated between `dashboard.js` and `admin.js`

Both files implement the same Excel parse → `POST /performance/bulk` flow:
- `backend/dashboard.js:829-1078` (`wireProductionReport`, `parseProductionRows`, `renderProductionViz`).
- `backend/admin.js:76-355` (similar functions, slightly different render).

Identical core logic. The dashboard.js path is gated to admins (`dashboardRole === "admin"`); on a typical admin's workflow they'd open admin.html for the same upload. Keeping both works but is duplicate code.

---

## Suggestions / refactor opportunities

1. **Restore the planner widget on `index.html`** (and arguably every authenticated page) by adding `<script src="../backend/planner.js"></script>` after `dashboard.js`. Or move the unconditional bottom calls from `planner.js` into a guarded `wireIfNeeded()` that explicitly opts in.
2. **Fix `backend/agent-comparison.js:347`** — change `r.delta` → `r.delta_pct`, `r.cases` → `r.total_cases`, `r.team_code` → `r.team_name`. Same fix as was applied to `dashboard.js` in `72d2dc2`.
3. **Reconcile `mapCalendarEvent` duplication** — delete one of the two declarations. `calendar.js`'s version is the one currently winning on pages where both load; `api.js`'s is timezone-aware. Pick one and re-export.
4. **Fix the inverted owner filter at `backend/calendar.js:481`** — either change the filter to `lead.owner === "agent"` for admin (so admin sees own leads) or define an explicit "all leads" predicate when the intent is "show every appointment".
5. **Seed the `admin` role and at least one admin user in `schema.sql`.** Add `('admin', 'Admin Super User')` to the role inserts, and provide a sample bcrypt-hashed admin user so the new POST /auth/login can succeed for the ARIEL workflow.
6. **Persist the `/auth/login` token** in `sessionStorage`, and have `api.js` send `Authorization: Bearer <token>` on every call. The Lambda doesn't validate it yet, but at least the wire format is in place.
7. **Wire the unused Lambda endpoints** — same list as before: `/training/progress`, `/sales-reflections`, `/announcements/:id/responses`, `/attendance-records`. (And now `/public-holidays`, since calendar.js's nager.at fetch fails for years beyond the 2026 fallback.)
8. **Fix the field-name bug at `backend/api.js:98`** — change `r.follow_ups` → `r.followUps`. Trivial one-line fix; restores the lead timeline on multiple pages.
9. **Fix the `r.name`/`r.color` bug at `backend/room-booking.js:561`** — change to `r.label` and `r.dot_color` (and optionally use `r.css_class` for `cls`).
10. **Add `nav.js` to `frontend/onboarding.html`** — one-line addition, unchanged need.
11. **Add `api.js` to `frontend/create-profile.html`** and wire `POST /leads` for new profile creation.
12. **Move the `calendar.html` script load order** so that `nav.js → auth.js → api.js → dashboard.js → calendar.js → planner.js`. Currently auth/nav are last; this defers authentication gating until after all module init has fired.
13. **Add a global error handler in `api.js`** that surfaces failures to the user (toast/snackbar) rather than swallowing in `.catch(() => {})` everywhere. Especially relevant after `82ee560` — fire-and-forget is more prevalent now.
14. **Clear user-scoped localStorage on logout** — `auth.js:344-347` needs the same key sweep recommended in the previous audit, plus the new keys (`overviewAgency`, `overviewAgencyInitializedFor`, `_plannerNotified_*`).
15. **Eliminate duplicate `drawMockQr`** — unchanged need.
16. **Hardcoded period info in `agent-comparison.js`** — unchanged need.
17. **Resolve dead `fm_announcements_v1`** — unchanged need.
18. **Type-check / number-coerce `district_rank`** — unchanged need.
19. **`Content-Security-Policy`** — unchanged need; `auth.js` still uses plenty of `innerHTML` injection.
20. **Reduce duplication of the production-report upload flow** between `dashboard.js` and `admin.js` (finding 9.34).

---

_End of update. Generated by automated audit; no source files modified._
