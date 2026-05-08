# Requirements Gathering — AIA Financial Agent Dashboard

**Project:** AIA Internship Project — Financial Agent Dashboard
**Type:** Internal tool for AIA financial agents, leaders, and district managers
**Architecture:** Static HTML/CSS/JS client-side application (no backend server)
**Date Compiled:** 2026-05-08

---

SR-01: Performance Analytics & Leaderboard Dashboard
The system shall track overall sales performance and display statistics separated by Agency and District levels.
Description: The dashboard shall visualize key metrics including Year-to-Date FYC, weekly FYC and case counts, total cases with urgency breakdown, and a ranked leaderboard table. It shall serve as the central sales tracker by integrating directly with lead data to provide comprehensive pipeline visibility through charts — a bar chart of Year FYC per agent, a line chart of monthly YTD trends, a weekly FYC and case count chart, and a sales funnel visualization. The dashboard shall support scope switching between District, Agency, and Personal views, display a mentee list panel, and allow managers to import a team production report via Excel file upload, allowing agents and managers to monitor real-time progress against predefined goals.

SR-02: Agent-to-Agent Comparison
The system shall allow users to compare their performance statistics with other selected agents.
Description: The comparison module shall allow agents to select peers from a list to view side-by-side metrics such as FYC and case count, fostering a competitive and transparent sales environment.

SR-03: Integrated Calendar & Appointment Management
The system shall provide an interactive calendar that synchronizes personal appointments, lead meet-ups, and global agency events, governed by role-based access control.
Description: The calendar shall reflect all scheduled lead meet-ups and support Month, Week, and Day views with navigation between time periods. Users may create events specifying a title, type (Appointment, Task, or Event), date, start and end times, location, notes, linked tasks, and repeat frequency (daily, weekly, or monthly with an optional end date). Events shall be filterable by category (Personal, Agency, Holiday), with the Month view displaying event counts per day and the Week view rendering an hourly grid with event blocks. Access shall be permission-based: Agents can view and edit their personal schedules and view district events, while District Managers possess view and edit privileges for both agent and district-level calendars.

SR-04: CPF Cashflow Calculator
The system shall provide a built-in calculator to project a client's Central Provident Fund (CPF) balances (cashflow).
Description: The calculator shall accept client inputs including current age, target retirement age, starting CPF balances, monthly salary, salary growth percentage, wage ceiling, and Medisave Account cap. It shall calculate future projections across three CPF accounts — OA (Ordinary Account), SA/RA (Special/Retirement Account), and MA (Medisave Account) — applying age-based statutory contribution rate bands and standard interest rates (OA at 2.5% p.a., SA and MA at 4% p.a.). Results shall display projected balances per account type, total CPF, and a year-by-year projection table, recalculating in real time as inputs change, assisting agents during client financial planning sessions.

SR-05: Audio Transcription Module
The system shall automatically generate text transcripts from uploaded meeting audio or video recordings.
Description: The transcription module shall accept standard media files, process the audio into editable text, and allow the agent to export the notes, reducing manual administrative work.

SR-06: Training Attendance Tracking
The system shall track and record agent attendance for scheduled agency meetings and training sessions.
Description: The tracking mechanism shall provide two role-based views. Attendees may scan a host-generated QR code to check in and view their check-in status and timestamp. The Host view, accessible to District Managers only, shall auto-select the current or next scheduled event, display a generated QR code for attendees to scan, and present a live attendance summary including checked-in count, present count, and late count. The system shall automatically mark attendees as late when check-in occurs after the event start time, and shall maintain a full attendance records table showing user, role, event, check-in time, and status, enabling managers to monitor agent participation and compliance with attendance requirements.

SR-07: Automated Personality Profile Parsing
The system shall automatically extract and record personality types from uploaded personality test reports.
Description: The system shall accept PDF uploads of standard personality reports, automatically extract the resulting personality type, and save it to the agent's profile.

SR-08: Peer-to-Peer Review System
The system shall allow agents to submit structured reviews of their colleagues.
Description: The review module shall provide standardized forms for agents to leave constructive feedback for peers.

SR-09: Global Announcements Board
The system shall allow administrators to publish agency-wide announcements and track read receipts.
Description: The announcement board shall support rich text and file attachments, ensuring that all agents receive critical updates regarding events, product changes, or compliance notices.

SR-10: Lead and Client Management Module
The system shall provide a structured leads module to capture, manage, and filter client profiles and meeting details.
Description: The module shall capture lead data in a structured format including Name, Age, Contact (phone and email), Meet-up Date and Location, Meeting Type (Physical, Online, or Hybrid), color-coded Urgency Status (Urgent, Medium, Non-urgent), Pipeline Stage (Prospecting, Fact-Find, Needs Analysis, Proposal Sent, Closing), and Remarks. It shall display KPI summary cards covering total leads, in-closing count, estimated annual premium, average lead age, and referral rate, and shall present leads in a sortable, searchable table with urgency, meeting type, and date-based filtering. Clicking a lead row shall open a detailed side drawer showing the client's full financial profile including CPF OA and SA balances, plan type, annual premium, commission type, and a follow-up task timeline. The module shall provide a follow-up email draft modal with pre-filled templates for Gmail, Outlook, and Yahoo (or copy-to-clipboard), and shall display a CPF tracker visualizing each lead's OA versus SA distribution. Agents shall be able to create new profiles and edit existing ones through a dedicated form page.

SR-11: Estimated Sales Pipeline
The system shall feature an estimated closure section to track and forecast pending business.
Description: This section shall track pending policies by displaying the prospect's Name, Plan Type, anticipated Annual Premium, and expected Commission Type, enabling agents to accurately forecast their upcoming revenue and prioritize urgent closures. The dashboard shall also expose a broader sales funnel visualization that maps the full lead pipeline across all active stages — Prospecting through Closing — giving managers visibility into overall pipeline health at Agency and District levels.

SR-12: Centralized Document Resources
The system shall include a dedicated resources tab linking to external document repositories.
Description: The resource section shall provide seamless, direct links to external enterprise platforms such as SharePoint, ensuring agents have immediate, organized access to standardized agency documents including Client Profile Templates (intake forms and fact-find sheets), Product and Plan Decks (comparison decks and premium tables), and Compliance References (disclosure scripts and suitability checks).

SR-13: Personal Task Management Widget
The system shall provide a personal to-do list for individual daily task tracking.
Description: Located persistently at the top right of the application interface, the to-do list shall allow each user to independently create, monitor, and check off individual tasks and progress to improve daily operational productivity.

SR-14: Authentication & Role-Based Access Control
The system shall enforce role-based access control across all modules through a secure login mechanism.
Description: Users shall authenticate with a User ID and password, with the role automatically determined by the User ID prefix (A for Agent, L for Leader, D for District Manager). The session shall be maintained via sessionStorage and shall expire when the browser session closes, with unauthenticated users redirected to the login page. Role permissions shall govern visibility of pages and features throughout the application, restricting agents from leadership-only modules. The Recruitment Pipeline module shall additionally require a secondary access code enforced through a dedicated recruitment login page.

SR-15: Conference Room Booking System
The system shall provide a booking interface for reserving shared agency conference rooms and prevent scheduling conflicts.
Description: The system shall manage six predefined rooms — Eagle Boardroom, Summit Event Hall, Ark, Armour, Inspiration Lounge, and Nest — displayed in Week, Day, and Month views on a color-coded 24-hour time-slot grid. A mini calendar sidebar shall support date navigation, and room filter checkboxes shall allow users to isolate specific rooms. Users shall be able to create bookings specifying a title, room, date, start and end times, booked-by name, and optional notes. The system shall detect and prevent conflicting overlapping bookings for the same room, and shall allow users to view full booking details, edit, and delete existing bookings through a detail popup.

SR-16: Agent Training Platform
The system shall deliver a structured, sequential video-based training programme with competency assessments and individual progress tracking.
Description: The platform shall host training modules consisting of embedded YouTube videos accompanied by multiple-choice quizzes. Modules shall unlock sequentially, with each subsequent module becoming available only after the preceding module's quiz is passed with a perfect score. The system shall persist completion status per user in local storage, display a learning path sidebar showing each module's locked, current, or completed state, and track achievement milestones. Video completion shall be detected automatically via the YouTube IFrame API. Leaders and District Managers shall have access to a team progress table displaying per-agent, per-module completion status to monitor overall training compliance.

SR-17: Recruitment Pipeline Management
The system shall provide a dedicated recruitment pipeline view for tracking agency hiring programmes, restricted to Leader and District Manager roles.
Description: The module shall display a pipeline table listing active recruitment programmes — including the Engineering Internship, Data Internship, and Graduate Programme — with columns for open positions, interviews conducted, offers extended, and assigned owner. Access shall be restricted to Leader and District Manager roles via role-based authentication, with an additional secondary access code gate enforced through a dedicated recruitment login page, preventing agents from viewing or modifying recruitment data.
