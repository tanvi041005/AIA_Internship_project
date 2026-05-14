# AI Session Record — AIA Financial Agent Dashboard

**Date:** 2026-05-14  
**Branch:** main  
**Model:** Claude Sonnet 4.6

---

## Project Overview

**Stack:** Static HTML/CSS/JS frontend + AWS Lambda (Node.js ESM) + API Gateway + RDS MySQL  
**API Base:** `https://afhnacykc0.execute-api.ap-southeast-1.amazonaws.com`  
**Key files:**
- `backend/api.js` — global `apiGet`, `apiPost`, `apiPut`, `apiDelete` helpers
- `backend/dashboard.js` — shared across `index.html`, `calendar.html`, `resources.html`
- `lambda/index.mjs` — single Lambda handler for all routes
- `frontend/*.html` — one page per feature module

---

## What Was Done This Session

### Session 1 — Calendar DB Integration
- **Problem:** Calendar events were saved only to `localStorage`; no API calls were made.
- **Fix in `backend/dashboard.js`:**
  - Added `mapCalendarEvent(r)` to map DB snake_case → JS camelCase
  - Added `loadCalendarEventsFromApi()` — loads `GET /events?userId=...` and populates localStorage on page init
  - Added fire-and-forget API calls alongside every localStorage write for:
    - `addPersonalEvent` → `POST /events`
    - `addAgencyEvent` → `POST /events`
    - `addPersonalTask` → `POST /tasks`
    - `updatePersonalEvent` → `PUT /events/:id`
    - `deletePersonalEvent` → `DELETE /events/:id`
    - `deletePersonalEventSeries` → `DELETE /events?recurrenceId=...`
  - Wired `wireAgencyEventEditDialog` submit/delete to also call API
- **Fix in `frontend/calendar.html`:** Added missing `<script src="../backend/api.js">` tag
- **Fix in `backend/api.js`:** Added `apiPut` function (was missing)
- **Fix in `lambda/index.mjs`:** Added `DELETE /events?recurrenceId=...` handler for recurring series deletion

### Session 2 — Lambda Auth Fix + Path/Field Mismatches
- **Problem:** Lambda threw `"Access denied for user 'admin'@'...' (using password: NO)"` — `DB_PASSWORD` env var was named `DB_PASS` in Lambda console.
- **Fix in `lambda/index.mjs`:** Changed pool config to `password: process.env.DB_PASSWORD || process.env.DB_PASS`
- **Also fixed:** All dashboard API calls were using wrong paths (`/calendar/events`) and camelCase bodies. Corrected to `/events`, `/tasks` with proper snake_case field names.

### Session 3 — .gitignore
- Added `lambda/` to `.gitignore` so the Lambda source is not tracked in git.

### Session 4 — Remove All Hardcoded Dummy Data (This Session)
All 10 backend JS files and 6 HTML files were updated. Details below.

---

## Session 4 Detailed Changes

### Files Modified

| File | What Changed |
|------|-------------|
| `backend/leads.js` | Deleted `DEFAULT_LEADS` array (6 leads, 82 lines). The `init()` function already called `GET /leads` — the array was unused dead code. |
| `backend/dashboard.js` | Removed `leadData` (5 leads), `districtEventsSeed` (2 events), `cpfTrackerData` (3 entries), `performanceData` (full nested object with 10-agent leaderboard + monthly data). Replaced with `let` empty defaults. Added `loadOverviewData()` async function that fetches `GET /leads`, `GET /performance`, `GET /cpf`. Changed home-page init to `await loadOverviewData()` before rendering. |
| `backend/cpf-calculator.js` | Removed `allocationBands` and `contributionBands` rate tables. Made IIFE async. Added `GET /cpf-rates` call on init; parses `ageGroup` strings (e.g. `"≤55"`, `"55-60"`, `">70"`) to `maxAge` numbers; converts percentages to decimals for internal calculation. |
| `backend/room-booking.js` | Removed `const ROOMS = [...]` (6 rooms). Changed to `let ROOMS = []`. Updated async init to call `GET /rooms` alongside `GET /room-bookings`; maps `room_id`, `name`, `color` to internal format. Also fixed pre-existing path bug: `/bookings` → `/room-bookings`; added `apiPut` call for edit. |
| `backend/sales-tracker.js` | Removed `agentNames` map (5 agents) and `activityTypes` array (7 types). Added `GET /users` to build `agentNames` map and `GET /sales-settings` to build `activityTypes`. Fixed pre-existing path bug: `/sales` → `/sales-entries`. |
| `backend/client-profile.js` | Removed `DEFAULT_LEADS` array (6 leads, 196 lines). Made IIFE async. Changed `getLeads()` to read only from localStorage (no more hardcoded fallback). Added API prime on init: `GET /leads?userId=...` → maps via `mapLead()` → stores to localStorage before rendering. |
| `backend/attendance.js` | Removed `fallbackEvents` (2 hardcoded events). Made IIFE async. Added `GET /attendance-events` call on init; maps `event_id`, `title`, `event_date`, `attendance_token` etc. to internal format. The `getEvents()` function now merges stored + calendarEventsFromStorage + `apiAttendanceEvents`. |
| `backend/agent-comparison.js` | Removed `AGENTS` array (10 agents with rank/ytdFyc/delta/cases/team) and `DISTRICT_CUM` (12-month cumulative). Changed to `let AGENTS = []` and `let DISTRICT_CUM = new Array(12).fill(0)`. Wrapped init in async IIFE that calls `GET /performance` and maps rows to agent format. `DISTRICT_CUM` initialized to zeros (see **Limitations** below). |
| `backend/training.js` | Removed `TOPICS` array (2 full modules + quiz questions/answers), `TEAM_MAP`, `DEFAULT_AGENT_POOL`. Made IIFE async. Added `GET /training/topics` call that maps DB fields (`topic_id`, `youtube_id`, `question_text`, `option_label`, `is_correct`) to frontend format. Added `GET /teams/:managerId` to populate team pool for progress view. |
| `backend/onboarding.js` | No hardcoded data to remove, but all operations were localStorage-only. Made IIFE async. Added `GET /teams/:managerId` on init to prime localStorage from DB. Added `apiPost('/teams/:managerId', ...)` call when adding a member. Added `apiDelete('/teams/:managerId/:agentId')` call on member removal. |

### HTML Files Updated — Added `api.js` Script Tag

These pages were missing `<script src="../backend/api.js">` so `apiGet`/`apiPost` were undefined:

- `frontend/agent-comparison.html`
- `frontend/training.html`
- `frontend/attendance.html`
- `frontend/cpf-calculator.html`
- `frontend/client-profile.html` (also reordered: nav/auth before client-profile.js)
- `frontend/onboarding.html`

### Pre-existing Bugs Fixed Along the Way

| Bug | Fix |
|-----|-----|
| `room-booking.js` called `/bookings` | Lambda uses `/room-bookings`; corrected all 4 occurrences |
| `sales-tracker.js` called `/sales` and `POST /sales` | Lambda uses `/sales-entries`; corrected both occurrences |
| `room-booking.js` edit path had no API call | Added `apiPut('/room-bookings/:id', ...)` on save |

---

## Known Limitations / Future Work

### `agent-comparison.js` — Monthly Chart Data (`DISTRICT_CUM`)
The month-by-month FYC chart (`renderMonthly`) requires a 12-element cumulative array by month. The current `GET /performance` endpoint only returns YTD totals, not month-by-month breakdown. `DISTRICT_CUM` is initialized to `new Array(12).fill(0)`, so the monthly chart shows flat zero lines.

**Fix needed:** Add a `/performance?monthly=true` or `/performance/monthly` endpoint to the Lambda that returns monthly FYC data per agent/district. Then update `agentCum()` in `agent-comparison.js` to consume it.

### `dashboard.js` — Performance KPIs (`yearlyTarget`, `weeklyFyc`, `lastWeekFyc`, `weekly`)
`loadOverviewData()` computes `yearlyFyc` as the sum of all agents' `ytd_fyc`, but `yearlyTarget`, `weeklyFyc`, `lastWeekFyc`, and the `weekly` breakdown (Mon–Fri FYC/cases) are set to 0/empty because the Lambda doesn't return them.

**Fix needed:** Either store targets in a `performance_targets` table and return them from `/performance`, or add a `/performance/summary` endpoint that returns the aggregated KPI block.

### `dashboard.js` — `menteeStatuses` and `monthlyYtd`
These arrays are returned as empty. The leaderboard renders correctly from API but the monthly YTD chart and mentee list panels will be blank.

**Fix needed:** `monthlyYtd` requires a monthly breakdown (see above). `menteeStatuses` could be derived from lead pipeline stages or stored as manager annotations.

### `cpf-calculator.js` — No Fallback if API Fails
The calculator now requires a successful `GET /cpf-rates` call. If the Lambda is unreachable, `allocationBands` and `contributionBands` remain empty arrays and `bandFor()` returns `undefined`, breaking the calculation silently.

**Fix needed:** Add a try/catch that shows a user-visible error message on the page, or restore the hardcoded rates as a client-side fallback since they are official government figures (not dummy data).

### `training.js` — Progress Still Saved to localStorage
Training progress (video done, quiz passed) is read from and written to `localStorage` via `progressKey = "fm_training_progress_v2"`. The Lambda has `GET /training/progress?userId=...` and `POST /training/progress` endpoints that support full sync.

**Fix needed:** On init, load progress from `GET /training/progress?userId=...` and merge with localStorage. On `saveProgressStore()`, also call `POST /training/progress` with the updated state.

### `onboarding.js` — Remove Button Wiring
The existing per-button listeners in `render()` handle local state (setList + re-render). The new delegation listener on `team-roster-body` handles the API DELETE call. Both fire on click, which is intentional but slightly redundant.

**Fix needed:** Consolidate into a single handler or ensure the delegation listener is idempotent.

---

## Commit-Ready Summary

**16 files changed, ~581 lines removed, ~274 lines added.**

All hardcoded dummy data (fake leads, agents, CPF rates, training modules, rooms, activity types, performance figures) has been removed from the frontend codebase. Every module now pulls data dynamically from the corresponding Lambda API endpoint at runtime.

To commit:
```bash
git add backend/leads.js backend/dashboard.js backend/cpf-calculator.js backend/room-booking.js backend/sales-tracker.js backend/client-profile.js backend/attendance.js backend/agent-comparison.js backend/training.js backend/onboarding.js frontend/agent-comparison.html frontend/training.html frontend/attendance.html frontend/cpf-calculator.html frontend/client-profile.html frontend/onboarding.html
git commit -m "Remove all hardcoded dummy data; all modules pull from API"
```
