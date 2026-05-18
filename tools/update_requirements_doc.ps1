param(
  [Parameter(Mandatory=$true)][string]$InputPath,
  [Parameter(Mandatory=$true)][string]$OutputPath
)

Add-Type -AssemblyName System.IO.Compression.FileSystem

function Escape-XmlText([string]$Text) {
  return [System.Security.SecurityElement]::Escape($Text)
}

function ParaXml([string]$Text, [bool]$Bold = $false) {
  $escaped = Escape-XmlText $Text
  $boldXml = if ($Bold) { "<w:rPr><w:b/></w:rPr>" } else { "" }
  return "<w:p><w:r>$boldXml<w:t xml:space=`"preserve`">$escaped</w:t></w:r></w:p>"
}

function BlankParaXml {
  return "<w:p/>"
}

$requirements = @(
  @{
    Title = "SR-01: Performance Analytics & Leaderboard Dashboard"
    Lines = @(
      "Requirement: The system shall provide a performance dashboard that shows sales production, case activity, and ranking information at District, Agency, and Personal levels.",
      "Purpose: This dashboard is the main landing view for users after login. It helps agents understand their own progress, and helps leaders monitor agency-level performance without manually calculating figures from spreadsheets.",
      "Users: Agents, Agency Leaders, and Admin users.",
      "Key functions: Display Year-to-Date FYC, Year-to-Date ANP, total cases, weekly production, agency leaderboard ranking, selected agency overview, personal overview, and district-wide overview where the logged-in role is permitted to view it.",
      "Data used: Agent production records imported from the production report, user records, agency/team assignment, lead records, sales entries, and CPF tracker entries where applicable.",
      "Views: Personal Overview shall default to the logged-in user's data. Agency Overview shall default to the user's own agency and may provide an agency selector only on the Agency Overview page. All Agency Overview shall show district-wide data only to permitted users.",
      "Rules and permissions: Agents shall not be able to view other agents' sensitive personal data unless explicitly permitted. Leaders may view agency-level data for agents under their agency. Admin users may view and manage all production data.",
      "Acceptance criteria: The dashboard loads after successful login, shows no mock data, displays only database-backed values, handles missing metrics with a dash or 'No data', and updates after a successful production report upload."
    )
  },
  @{
    Title = "SR-02: Agent-to-Agent Comparison"
    Lines = @(
      "Requirement: The system shall allow users to compare selected agents' production performance side by side.",
      "Purpose: The comparison page helps users quickly understand performance differences between agents without manually checking spreadsheet rows.",
      "Users: Agents, Agency Leaders, and Admin users, subject to role-based access rules.",
      "Key functions: Search and select agents, display each selected agent's name, agent code, agency, FYC, ANP, case count, and district rank, and allow selected agents to be removed from the comparison.",
      "Data used: The comparison shall use records from the database, primarily the agent_performance table joined with users. It shall not use mock data or fallback calculations.",
      "Calculation rules: District rank may be derived from database-backed YTD FYC ranking when district_rank is unavailable. Other values shall be shown only when present in the database.",
      "Missing data handling: If FYC, ANP, cases, or other fields are unavailable, the interface shall show a dash or 'No data' rather than estimating values.",
      "Acceptance criteria: The dropdown shows database agents only, includes ranking information, prevents duplicate selection, and reflects the same production values shown elsewhere in the dashboard."
    )
  },
  @{
    Title = "SR-03: Integrated Calendar & Appointment Management"
    Lines = @(
      "Requirement: The system shall provide an interactive calendar for managing personal appointments, agency events, lead meet-ups, tasks, room bookings, and public holidays.",
      "Purpose: The calendar centralizes scheduling so agents and leaders can coordinate client appointments, meetings, training, and operational tasks from one interface.",
      "Users: Agents, Agency Leaders, and Admin users.",
      "Key functions: Display Month, Week, and Day calendar views; create, edit, and delete events; categorize events as Personal, Agency, Holiday, Task, Appointment, or Meeting; support start time, end time, location, notes, linked tasks, and recurrence.",
      "Lead integration: Lead meet-up dates should appear in the calendar when lead data contains meeting information.",
      "Task integration: Personal tasks created from the calendar shall be saved and shown in task-related widgets.",
      "Permissions: Agents may manage their own personal events and view agency events. Leaders and Admin users may create agency-level events according to their permissions.",
      "Acceptance criteria: Events persist in the database, recurring events can be created in bulk, deleted events are removed from the calendar, and calendar views reflect saved data after refresh."
    )
  },
  @{
    Title = "SR-04: CPF Cashflow Calculator"
    Lines = @(
      "Requirement: The system shall provide a CPF cashflow calculator for projecting a client's CPF balances over time.",
      "Purpose: The calculator supports financial planning discussions by showing how CPF balances may change based on age, salary, contribution rates, and interest assumptions.",
      "Users: Agents, Agency Leaders, and Admin users.",
      "Key inputs: Current age, target retirement age, current OA balance, current SA or RA balance, current MA balance, monthly salary, annual salary growth, applicable wage ceiling, and Medisave Account cap.",
      "Key outputs: Projected OA, SA/RA, MA, and total CPF balances by year, including contribution amounts and interest assumptions.",
      "Calculation rules: The calculator shall use Singapore CPF contribution and allocation rates stored or defined by the system. Interest assumptions shall be visible to users.",
      "Data handling: Calculator results may be used during client discussion but should not expose client data to other users unless saved under a permitted client or lead record.",
      "Acceptance criteria: Updating an input recalculates projections, results are shown in a clear table or chart, and invalid inputs are handled without breaking the page."
    )
  },
  @{
    Title = "SR-05: Audio Transcription Module"
    Lines = @(
      "Requirement: The system shall provide an audio transcription module for converting meeting recordings into text notes.",
      "Purpose: The module reduces manual note-taking after client meetings and helps agents capture follow-up actions more consistently.",
      "Users: Agents, Agency Leaders, and Admin users.",
      "Key functions: Upload supported audio or video files, process the recording, display editable transcript text, and allow users to copy or export the transcript.",
      "Data handling: Uploaded files and transcripts may contain sensitive client information and shall be protected from unauthorized access.",
      "Privacy expectations: The system should communicate when a recording is being processed and avoid exposing transcripts to other users.",
      "Acceptance criteria: A user can upload a supported file, receive a readable transcript, edit the transcript, and retain or export the notes according to system storage rules."
    )
  },
  @{
    Title = "SR-06: Training Attendance Tracking"
    Lines = @(
      "Requirement: The system shall track attendance for agency meetings and training sessions using event-based QR check-in.",
      "Purpose: The attendance feature helps leaders verify attendance for required training, meetings, and agency events.",
      "Users: Attendees, Agency Leaders, Hosts, and Admin users.",
      "Attendee functions: Attendees shall open a QR-linked attendance page, see the selected event, and check in under their logged-in account.",
      "Host functions: Hosts shall generate or display a QR code for an attendance-enabled event and view a live attendance summary.",
      "Data captured: Event ID, event title, user ID, check-in timestamp, attendance status, role, and related event information.",
      "Rules: The system shall determine whether a user is Present or Late based on the event start time where available. Test accounts may be allowed to test check-in behavior according to test rules.",
      "Acceptance criteria: Attendance events and records are stored in the database, duplicate check-ins update or preserve the user's attendance record correctly, and attendance summaries refresh from saved records."
    )
  },
  @{
    Title = "SR-07: Automated Personality Profile Parsing"
    Lines = @(
      "Requirement: The system shall extract personality profile information from uploaded personality test reports.",
      "Purpose: The feature helps agents and leaders maintain structured profile information without manually reading and retyping report results.",
      "Users: Agents, Agency Leaders, and Admin users.",
      "Key functions: Upload a supported report file, parse the report content, identify the personality type or result, and save the extracted value to the relevant user or profile record.",
      "Data handling: Uploaded reports may contain personal information and shall be accessible only to permitted users.",
      "Acceptance criteria: The system accepts supported report formats, extracts the expected personality result, allows user review before saving, and stores the result under the correct profile."
    )
  },
  @{
    Title = "SR-08: Peer-to-Peer Review System"
    Lines = @(
      "Requirement: The system shall allow users to submit structured peer reviews for colleagues.",
      "Purpose: The review feature supports coaching, collaboration, and professional development within the agency.",
      "Users: Agents, Agency Leaders, and Admin users.",
      "Key functions: Select a colleague, complete a structured review form, submit feedback, and view submitted reviews according to permissions.",
      "Data captured: Reviewer, reviewee, review date, scores or categories, written feedback, and optional follow-up notes.",
      "Permissions: Review visibility shall be controlled so private feedback is not exposed to unauthorized users.",
      "Acceptance criteria: Reviews can be submitted, stored, retrieved, and filtered by permitted users without exposing restricted feedback."
    )
  },
  @{
    Title = "SR-09: Global Announcements Board"
    Lines = @(
      "Requirement: The system shall provide an announcements board for publishing and tracking important agency updates.",
      "Purpose: Announcements centralize operational, compliance, training, and event communications.",
      "Users: Admin users and Agency Leaders may publish announcements where permitted. Agents may view and respond to announcements.",
      "Key functions: Create announcements with title, category, message, response type, creator, and created timestamp; display announcements in reverse chronological order; collect user responses or acknowledgements.",
      "Data captured: Announcement ID, title, category, message, response type, created by, created date, user response choice, note, and response timestamp.",
      "Permissions: Only permitted roles may create announcements. Users may submit only their own responses.",
      "Acceptance criteria: Announcements persist in the database, responses are saved per user, duplicate responses update the existing record, and users can see current announcements after refresh."
    )
  },
  @{
    Title = "SR-10: Lead and Client Management Module"
    Lines = @(
      "Requirement: The system shall provide a structured lead and client management module for capturing, updating, and tracking prospect information.",
      "Purpose: The module gives agents a consistent place to manage client pipeline details and follow-up actions.",
      "Users: Agents, Agency Leaders, and Admin users.",
      "Key data fields: Name, age, phone, email, meet-up date, meet-up location, meeting type, urgency, pipeline stage, remarks, plan type, annual premium, commission type, CPF OA, CPF SA, occupation, income, referred by, owner ID, and extra profile information.",
      "Key functions: Create leads, edit leads, delete leads, search leads, filter by urgency or stage, open a lead detail drawer, and maintain follow-up tasks.",
      "Pipeline stages: Prospecting, Fact-Find, Needs Analysis, Proposal Sent, Closing, and other configured stages where supported.",
      "Permissions: Agents may manage their own leads. Leaders and Admin users may view agency or broader lead data according to access rules.",
      "Acceptance criteria: Leads and follow-ups are stored in the database, edits persist after refresh, unauthorized users cannot access another user's lead data, and missing optional fields do not prevent saving."
    )
  },
  @{
    Title = "SR-11: Estimated Sales Pipeline"
    Lines = @(
      "Requirement: The system shall provide estimated pipeline views to forecast expected business and upcoming closures.",
      "Purpose: The pipeline view helps agents and leaders estimate future revenue and prioritize cases that are close to conversion.",
      "Users: Agents, Agency Leaders, and Admin users.",
      "Key functions: Display prospects by stage, show estimated annual premium and commission type, summarize closing opportunities, and visualize pipeline distribution.",
      "Data used: Lead records, plan type, annual premium, commission type, urgency, stage, and owner or agency assignment.",
      "Rules: Pipeline calculations shall use saved lead data rather than mock values. Missing annual premium or commission values shall be treated as unavailable instead of estimated unless a documented calculation rule exists.",
      "Acceptance criteria: Pipeline totals update when lead stages or premiums are changed, and users see only pipeline data they are permitted to access."
    )
  },
  @{
    Title = "SR-12: Centralized Document Resources"
    Lines = @(
      "Requirement: The system shall provide a resources section containing links to important agency documents and learning materials.",
      "Purpose: Resources reduce time spent searching for templates, product decks, compliance references, and training content.",
      "Users: Agents, Agency Leaders, and Admin users.",
      "Key functions: Display categorized resource links, show titles and descriptions, and open external repositories such as SharePoint or hosted video platforms.",
      "Resource categories: Client profile templates, product and plan decks, compliance references, and training videos.",
      "Data handling: Links should be maintained centrally so users receive consistent resource locations.",
      "Acceptance criteria: Resource links are visible in the resources tab, open correctly, and can be updated without changing unrelated dashboard behavior."
    )
  },
  @{
    Title = "SR-13: Personal Task Management Widget"
    Lines = @(
      "Requirement: The system shall provide a personal task management widget for daily user task tracking.",
      "Purpose: The widget helps users manage follow-ups, reminders, and personal work items without leaving the dashboard.",
      "Users: Agents, Agency Leaders, and Admin users.",
      "Key functions: Create tasks, edit task titles, mark tasks as done, reopen tasks, delete tasks, and display due dates where available.",
      "Data captured: Task ID, user ID, title, due date, source, linked event title, completion status, and created timestamp.",
      "Permissions: Users shall manage their own tasks. Admin access may be allowed for support or audit purposes.",
      "Acceptance criteria: Tasks persist in the database, task completion updates immediately in the UI, and task operations cannot modify another user's tasks without permission."
    )
  },
  @{
    Title = "SR-14: Conference Room Booking System"
    Lines = @(
      "Requirement: The system shall provide a booking system for reserving shared agency rooms and preventing scheduling conflicts.",
      "Purpose: The feature helps users reserve meeting rooms without double-booking shared spaces.",
      "Users: Agents, Agency Leaders, and Admin users.",
      "Rooms: Eagle Boardroom, Summit Event Hall, Ark, Armour, Inspiration Lounge, and Nest.",
      "Key functions: View room bookings by Month, Week, or Day; filter by room; create bookings with title, room, date, start time, end time, booked-by details, notes, and recurrence information; edit or delete bookings.",
      "Conflict rules: The system shall prevent overlapping bookings for the same room and date. Recurring bookings shall also be checked for conflicts across generated dates.",
      "Data captured: Booking ID, title, room ID, booking date, start time, end time, booked by, notes, recurrence, recurrence end, and recurrence ID.",
      "Acceptance criteria: Saved bookings appear after refresh, conflicting bookings are rejected, and users receive clear feedback when a room is unavailable."
    )
  },
  @{
    Title = "SR-15: Agent Training Platform"
    Lines = @(
      "Requirement: The system shall provide a structured training platform with video modules, quizzes, and progress tracking.",
      "Purpose: The training platform supports onboarding and compliance by guiding users through required learning content.",
      "Users: Agents, Agency Leaders, and Admin users.",
      "Key functions: Display training topics, embed training videos, present quiz questions and answer options, record video completion, record quiz pass status, and show module progress.",
      "Progress rules: Modules may unlock sequentially. A module can be marked completed only after the required video and quiz conditions are satisfied.",
      "Data captured: User ID, topic ID, video completion flag, quiz passed flag, and related training metadata.",
      "Leader view: Leaders and Admin users may view team progress where permitted to monitor training completion.",
      "Acceptance criteria: Progress is saved in the database, completed modules remain completed after refresh, locked modules cannot be accessed before prerequisites, and quiz results update the progress view."
    )
  }
)

$bodyXmlParts = New-Object System.Collections.Generic.List[string]
$bodyXmlParts.Add((ParaXml "System Requirements Document" $true))
$bodyXmlParts.Add((ParaXml "Updated detailed requirements for the AIA agency dashboard. This version is written so that a reader can understand the expected website behavior without having seen the live system." $false))
$bodyXmlParts.Add((BlankParaXml))

foreach ($req in $requirements) {
  $bodyXmlParts.Add((ParaXml $req.Title $true))
  foreach ($line in $req.Lines) {
    $bodyXmlParts.Add((ParaXml $line $false))
  }
  $bodyXmlParts.Add((BlankParaXml))
}

$tempDir = Join-Path ([System.IO.Path]::GetTempPath()) ("requirements-docx-" + [guid]::NewGuid().ToString("N"))
[System.IO.Compression.ZipFile]::ExtractToDirectory($InputPath, $tempDir)

$documentPath = Join-Path $tempDir "word\document.xml"
[xml]$doc = Get-Content $documentPath -Raw
$ns = New-Object System.Xml.XmlNamespaceManager($doc.NameTable)
$ns.AddNamespace("w", "http://schemas.openxmlformats.org/wordprocessingml/2006/main")
$body = $doc.SelectSingleNode("//w:body", $ns)
$sectPr = $body.SelectSingleNode("w:sectPr", $ns)

$body.RemoveAll()
$body.InnerXml = ($bodyXmlParts -join "")
if ($sectPr) {
  $imported = $doc.ImportNode($sectPr, $true)
  [void]$body.AppendChild($imported)
}

$settings = New-Object System.Xml.XmlWriterSettings
$settings.Encoding = New-Object System.Text.UTF8Encoding($false)
$settings.Indent = $false
$writer = [System.Xml.XmlWriter]::Create($documentPath, $settings)
$doc.Save($writer)
$writer.Close()

if (Test-Path $OutputPath) {
  Remove-Item -LiteralPath $OutputPath -Force
}
$zip = [System.IO.Compression.ZipFile]::Open($OutputPath, [System.IO.Compression.ZipArchiveMode]::Create)
try {
  Get-ChildItem -LiteralPath $tempDir -Recurse -File | ForEach-Object {
    $relative = $_.FullName.Substring($tempDir.Length).TrimStart("\", "/") -replace "\\", "/"
    [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile($zip, $_.FullName, $relative) | Out-Null
  }
} finally {
  $zip.Dispose()
}
Remove-Item -LiteralPath $tempDir -Recurse -Force

Write-Output "Updated requirements document written to: $OutputPath"
