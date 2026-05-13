const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const root = path.resolve(__dirname, "..");
const port = Number(process.env.PORT) || 8080;
const recruitmentAccessCode = process.env.RECRUITMENT_ACCESS_CODE || "";

const mime = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".ico": "image/x-icon",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
};

const devUsers = {
  A123: { userId: "A123", fullName: "Alicia Tan", role: "agent", roleId: 1 },
  A124: { userId: "A124", fullName: "Brandon Lee", role: "agent", roleId: 1 },
  A125: { userId: "A125", fullName: "Chloe Ong", role: "agent", roleId: 1 },
  A126: { userId: "A126", fullName: "Darren Lim", role: "agent", roleId: 1 },
  A127: { userId: "A127", fullName: "Farah Rahim", role: "agent", roleId: 1 },
  A128: { userId: "A128", fullName: "Gavin Teo", role: "agent", roleId: 1 },
  A129: { userId: "A129", fullName: "Hui Min Chua", role: "agent", roleId: 1 },
  A130: { userId: "A130", fullName: "Isaac Wong", role: "agent", roleId: 1 },
  A131: { userId: "A131", fullName: "Jia En Low", role: "agent", roleId: 1 },
  A132: { userId: "A132", fullName: "Kumar Singh", role: "agent", roleId: 1 },
  L123: { userId: "L123", fullName: "Leader Demo", role: "leader", roleId: 2 },
  D123: { userId: "D123", fullName: "District Demo", role: "district", roleId: 3 },
};

const activityTypes = [
  { activity_type_id: "activity", label: "Activity", points: 3 },
  { activity_type_id: "contact", label: "Contact", points: 1 },
  { activity_type_id: "schedule", label: "Schedule Appt", points: 2 },
  { activity_type_id: "casual", label: "Casual Meetup", points: 2 },
  { activity_type_id: "insurance", label: "Insurance Appt", points: 5 },
  { activity_type_id: "referral", label: "Referral", points: 3 },
  { activity_type_id: "case", label: "Case Closed", points: 10 },
];

let leads = [
  { lead_id: 1, name: "Lim Wei Jie", age: 34, contact: "9123-4567", email: "weijie.lim@email.com", meet_date: "2025-05-12", location: "Toa Payoh HDB", meet_type: "Physical", urgency: "urgent", stage: "Opening", remarks: "Interested in term life; wife expecting. Has existing GE policy expiring soon.", plan_type: "Term Life", annual_premium: 2400, commission_type: "FYC", cpf_oa: 88000, cpf_sa: 42000, occupation: "Software Engineer", income: "SGD 7,200/mo", referred_by: "John Tan", owner_id: "A123", extra: { sumAssured: 300000, currency: "SGD", generalExpense: "SGD 3,600/mo", surplus: "SGD 3,600/mo", existingPlans: "Existing GE policy expiring soon", generalPlanType: "Protection", specificPlanType: "Term Life" } },
  { lead_id: 2, name: "Nur Aisyah Binte Rahman", age: 28, contact: "8234-5678", email: "aisyah.r@email.com", meet_date: "2025-05-15", location: "Tampines Mall", meet_type: "Online", urgency: "medium", stage: "Fact Find", remarks: "Self-employed, irregular income. Keen on savings plan for rainy day fund.", plan_type: "Endowment", annual_premium: 3600, commission_type: "Trail", cpf_oa: 31000, cpf_sa: 18000, occupation: "Freelance Designer", income: "SGD 3,800/mo (avg)", referred_by: "Self (Instagram)", owner_id: "A123", extra: { sumAssured: 180000, currency: "SGD", generalExpense: "SGD 2,100/mo", surplus: "SGD 1,700/mo", existingPlans: "No current plan on record", generalPlanType: "Savings", specificPlanType: "Endowment" } },
  { lead_id: 3, name: "Chen Jia Hao", age: 42, contact: "9345-6789", email: "jiahao.chen@corp.sg", meet_date: "2025-05-08", location: "Raffles Place (Client Office)", meet_type: "Physical", urgency: "urgent", stage: "Closing", remarks: "Director-level. Needs keyman insurance + personal CI cover. Decide by end of month.", plan_type: "CI + Keyman", annual_premium: 9800, commission_type: "FYC", cpf_oa: 180000, cpf_sa: 95000, occupation: "Company Director", income: "SGD 22,000/mo", referred_by: "Existing client (Peter Goh)", owner_id: "A123", extra: { sumAssured: 750000, currency: "SGD", generalExpense: "SGD 9,000/mo", surplus: "SGD 13,000/mo", existingPlans: "Existing personal CI cover; looking at keyman and additional protection", generalPlanType: "Protection", specificPlanType: "CI + Keyman" } },
  { lead_id: 4, name: "Priya Nair", age: 31, contact: "9456-7890", email: "priya.nair@gmail.com", meet_date: "2025-05-20", location: "Jurong East CC", meet_type: "Hybrid", urgency: "non-urgent", stage: "Prospecting", remarks: "Teacher. Wants ILP for long-term growth. No rush - reviewing options with husband.", plan_type: "ILP", annual_premium: 4200, commission_type: "Trail", cpf_oa: 54000, cpf_sa: 28000, occupation: "Secondary School Teacher", income: "SGD 4,500/mo", referred_by: "Colleague referral", owner_id: "A123", extra: { sumAssured: 200000, currency: "SGD", generalExpense: "SGD 2,500/mo", surplus: "SGD 2,000/mo", existingPlans: "No active insurance plan yet", generalPlanType: "Investment", specificPlanType: "ILP" } },
  { lead_id: 5, name: "Marcus Tan Boon Kiat", age: 38, contact: "9567-8901", email: "marcus.tbk@finco.com", meet_date: "2025-05-06", location: "CBD (Zoom)", meet_type: "Online", urgency: "urgent", stage: "Opening", remarks: "Planning early retirement at 55. HNW profile - keen on wealth accumulation + legacy planning.", plan_type: "Whole Life + Trust", annual_premium: 24000, commission_type: "FYC + Trail", cpf_oa: 320000, cpf_sa: 150000, occupation: "VP Finance", income: "SGD 18,000/mo", referred_by: "Wealth manager partner", owner_id: "A123", extra: { sumAssured: 1000000, currency: "SGD", generalExpense: "SGD 8,000/mo", surplus: "SGD 10,000/mo", existingPlans: "Corporate coverage only; reviewing personal wealth and legacy plans", generalPlanType: "Wealth", specificPlanType: "Whole Life + Trust" } },
  { lead_id: 6, name: "Sandra Loh Mei Ling", age: 55, contact: "8678-9012", email: "sandraloh@email.com", meet_date: "2025-05-25", location: "Woodlands Civic Centre", meet_type: "Physical", urgency: "non-urgent", stage: "Fact Find", remarks: "Near retirement. Reviewing existing Prudential policies. Possible DPS lapse to address.", plan_type: "Retirement + MediShield", annual_premium: 1800, commission_type: "Trail", cpf_oa: 120000, cpf_sa: 65000, occupation: "Admin Executive (Govt)", income: "SGD 3,200/mo", referred_by: "Daughter's recommendation", owner_id: "A123", extra: { sumAssured: 120000, currency: "SGD", generalExpense: "SGD 2,000/mo", surplus: "SGD 1,200/mo", existingPlans: "Reviewing existing Prudential policies", generalPlanType: "Retirement", specificPlanType: "Retirement + MediShield" } },
];

let followUps = [
  { lead_id: 1, label: "Initial meeting", scheduled_date: "2025-04-30", is_done: true },
  { lead_id: 1, label: "Proposal sent", scheduled_date: "2025-05-05", is_done: true },
  { lead_id: 1, label: "Follow-up call", scheduled_date: "2025-05-14", is_done: false },
  { lead_id: 1, label: "Closing", scheduled_date: "2025-05-20", is_done: false },
  { lead_id: 2, label: "Intro call", scheduled_date: "2025-05-10", is_done: true },
  { lead_id: 2, label: "Fact-find session", scheduled_date: "2025-05-15", is_done: false },
  { lead_id: 2, label: "Needs analysis", scheduled_date: "2025-05-22", is_done: false },
  { lead_id: 3, label: "Discovery", scheduled_date: "2025-04-22", is_done: true },
  { lead_id: 3, label: "Proposal", scheduled_date: "2025-05-02", is_done: true },
  { lead_id: 3, label: "Negotiation", scheduled_date: "2025-05-08", is_done: true },
  { lead_id: 3, label: "Closing sign-off", scheduled_date: "2025-05-15", is_done: false },
  { lead_id: 4, label: "WhatsApp intro", scheduled_date: "2025-05-17", is_done: true },
  { lead_id: 4, label: "Meet-up", scheduled_date: "2025-05-20", is_done: false },
  { lead_id: 4, label: "Proposal", scheduled_date: "2025-05-28", is_done: false },
  { lead_id: 5, label: "Zoom intro", scheduled_date: "2025-05-01", is_done: true },
  { lead_id: 5, label: "Needs analysis", scheduled_date: "2025-05-06", is_done: true },
  { lead_id: 5, label: "Solutioning", scheduled_date: "2025-05-12", is_done: false },
  { lead_id: 5, label: "Proposal", scheduled_date: "2025-05-19", is_done: false },
  { lead_id: 6, label: "Phone call", scheduled_date: "2025-05-20", is_done: true },
  { lead_id: 6, label: "Fact-find", scheduled_date: "2025-05-25", is_done: false },
];

let calendarEvents = [
  { event_id: "agency-1", title: "District Training Session", event_date: "2026-05-12", category: "agency", event_type: "District Event", created_by: "D123" },
  { event_id: "agency-2", title: "District Sales Review", event_date: "2026-05-25", category: "agency", event_type: "District Event", created_by: "D123" },
];
let personalTasks = [];

let roomBookings = [
  { booking_id: 1, title: "Board Review", room_id: "eagle", booking_date: "2026-05-12", start_time: "09:00:00", end_time: "10:30:00", booked_by_name: "Sarah L.", recurrence: "none" },
  { booking_id: 2, title: "All-Hands", room_id: "summit", booking_date: "2026-05-12", start_time: "14:00:00", end_time: "15:00:00", booked_by_name: "Operations", recurrence: "none" },
  { booking_id: 3, title: "Dev Sprint Sync", room_id: "ark", booking_date: "2026-05-13", start_time: "10:00:00", end_time: "11:00:00", booked_by_name: "Tech Team", recurrence: "none" },
  { booking_id: 4, title: "HR Interview", room_id: "armour", booking_date: "2026-05-14", start_time: "13:00:00", end_time: "14:00:00", booked_by_name: "HR", recurrence: "none" },
  { booking_id: 5, title: "L&D Session", room_id: "inspiration", booking_date: "2026-05-11", start_time: "15:00:00", end_time: "16:30:00", booked_by_name: "Learning", recurrence: "none" },
  { booking_id: 6, title: "Wellness Break", room_id: "nest", booking_date: "2026-05-12", start_time: "12:00:00", end_time: "12:30:00", booked_by_name: "HR", recurrence: "none" },
];

const rooms = [
  { room_id: "eagle", label: "Eagle Boardroom", css_class: "room-eagle", dot_color: "#93c5fd" },
  { room_id: "summit", label: "Summit Event Hall", css_class: "room-summit", dot_color: "#fca5a5" },
  { room_id: "ark", label: "Ark", css_class: "room-ark", dot_color: "#6ee7b7" },
  { room_id: "armour", label: "Armour", css_class: "room-armour", dot_color: "#d1d5db" },
  { room_id: "inspiration", label: "Inspiration Lounge", css_class: "room-inspiration", dot_color: "#c4b5fd" },
  { room_id: "nest", label: "Nest / Nursing Room", css_class: "room-nest", dot_color: "#fde68a" },
];

let announcements = [
  { announcement_id: "a1", title: "Q2 Client Follow-up Compliance", category: "Policy Update", message: "All agents must complete follow-up notes for new leads within 24 hours and mark the status in the lead tracker.", response_type: "acknowledge", created_by: "D123", created_at: "2026-05-08T01:00:00.000Z" },
  { announcement_id: "a2", title: "RSVP for This Event", category: "Event Reminder", message: "Please RSVP for the Monthly Sales Kickoff by Wednesday 5:00 PM so the admin team can confirm attendance and seating.", response_type: "rsvp", created_by: "L123", created_at: "2026-05-08T01:30:00.000Z" },
  { announcement_id: "a3", title: "Portal Feature Testing Window", category: "Testing Notice", message: "This is a test announcement. Please open the Training and Leads modules, then report any issue to your team leader before end of day.", response_type: "status", created_by: "L123", created_at: "2026-05-08T02:00:00.000Z" },
];

let announcementResponses = {};
let attendanceEvents = [];
let attendanceRecords = [];
let salesReflections = [];
let trainingProgress = {};
let helpdeskTickets = [];

let salesEntries = [
  ["A123","2026-05-04","schedule",4,"Marcus Tan","Completed","Booked policy reviews"],
  ["A123","2026-05-04","contact",7,"Warm list","Completed","Daily call block"],
  ["A123","2026-05-05","insurance",2,"Chen Jia Hao","Completed","CI and keyman discussion"],
  ["A123","2026-05-05","referral",2,"Nur Aisyah","Follow-up","Referred colleague"],
  ["A123","2026-05-06","casual",3,"Coffee chats","Completed","Prospecting meetings"],
  ["A123","2026-05-06","activity",3,"Pipeline work","Completed","Fact-find prep"],
  ["A123","2026-05-07","case",1,"Lim Wei Jie","Completed","Term life case closed"],
  ["A123","2026-05-07","schedule",3,"Next week","Scheduled","Follow-up meetings"],
  ["A123","2026-05-08","insurance",1,"Priya Nair","Completed","Proposal review"],
  ["A123","2026-05-08","referral",4,"COI list","Completed","Referral push"],
  ["A124","2026-05-04","contact",6,"Warm leads","Completed","Morning call block"],
  ["A124","2026-05-04","schedule",5,"May pipeline","Scheduled","Booked first appointments"],
  ["A124","2026-05-05","casual",4,"Coffee chats","Completed","Relationship building"],
  ["A124","2026-05-05","insurance",1,"Client review","Completed","Protection gap"],
  ["A124","2026-05-06","activity",2,"Admin follow-up","Completed","Needs analysis prep"],
  ["A124","2026-05-06","schedule",3,"Prospects","Scheduled","Next week pipeline"],
  ["A124","2026-05-07","referral",2,"Centre of influence","Completed","Referral asks"],
  ["A124","2026-05-07","casual",3,"Lunch meetings","Completed","Warm prospects"],
  ["A124","2026-05-08","insurance",2,"Review clients","Completed","Policy review day"],
  ["A124","2026-05-08","contact",5,"Cold follow-up","Completed","Reactivation calls"],
  ["A125","2026-05-04","schedule",5,"Prospects","Scheduled","Next week pipeline"],
  ["A125","2026-05-05","insurance",2,"Family planning","Completed","Protection review"],
  ["A125","2026-05-06","referral",3,"Client network","Completed","Referral campaign"],
  ["A125","2026-05-07","casual",4,"Warm prospects","Completed","Coffee meetings"],
  ["A125","2026-05-08","case",1,"Savings plan","Completed","Case closed"],
  ["A126","2026-05-04","activity",5,"Pipeline cleanup","Completed","CRM hygiene"],
  ["A126","2026-05-05","contact",8,"Existing clients","Completed","Review calls"],
  ["A126","2026-05-06","insurance",2,"Corporate client","Completed","Group policy discussion"],
  ["A126","2026-05-07","case",1,"Corporate client","Completed","Group policy"],
  ["A126","2026-05-08","schedule",4,"Upcoming week","Scheduled","Booked reviews"],
  ["A127","2026-05-04","referral",3,"Centre of influence","Completed","Referral drive"],
  ["A127","2026-05-05","casual",5,"Networking","Completed","Event follow-ups"],
  ["A127","2026-05-06","schedule",4,"Prospects","Scheduled","Booked fact-finds"],
  ["A127","2026-05-07","insurance",2,"Client reviews","Completed","Needs analysis"],
  ["A127","2026-05-08","activity",4,"Admin + prep","Completed","Proposal preparation"],
].map((row, index) => ({
  entry_id: "seed-" + index, agent_id: row[0], entry_date: row[1], activity_type_id: row[2],
  activity_label: activityTypes.find((t) => t.activity_type_id === row[2]).label,
  point_value: activityTypes.find((t) => t.activity_type_id === row[2]).points,
  count: row[3], client_name: row[4], status: row[5], notes: row[6], created_at: row[1] + "T18:00:00.000Z"
}));

const trainingTopics = [
  { id: "t1", title: "AIA Agent Foundations: Protection Planning", youtubeId: "x3MBoq2b33k", quiz: [
    { id: "t1q1", question: "During client fact-finding, what should an AIA agent confirm first?", options: [{ id: "t1q1a", label: "Client protection needs and priorities", correct: true }, { id: "t1q1b", label: "Client social media profile only", correct: false }, { id: "t1q1c", label: "Only premium discount preference", correct: false }] },
    { id: "t1q2", question: "Which action best matches responsible AIA advisory practice?", options: [{ id: "t1q2a", label: "Recommend plans that fit goals, affordability, and risk profile", correct: true }, { id: "t1q2b", label: "Push the highest premium product regardless of need", correct: false }, { id: "t1q2c", label: "Skip needs analysis if client is in a hurry", correct: false }] },
    { id: "t1q3", question: "Before proposal confirmation, what should the agent do?", options: [{ id: "t1q3a", label: "Clearly explain coverage, exclusions, and payment commitment", correct: true }, { id: "t1q3b", label: "Ask the client to sign without discussion", correct: false }, { id: "t1q3c", label: "Focus only on commission details", correct: false }] },
  ] },
  { id: "t2", title: "AIA Agent Practice: Objection Handling and Follow-up", youtubeId: "zRSSQycVdzo", quiz: [
    { id: "t2q1", question: "When a client says 'I need time to think', what is the best response?", options: [{ id: "t2q1a", label: "Acknowledge concern, clarify questions, and agree on follow-up date", correct: true }, { id: "t2q1b", label: "Close the case immediately and stop follow-up", correct: false }, { id: "t2q1c", label: "Pressure for same-day payment only", correct: false }] },
    { id: "t2q2", question: "Which follow-up habit supports stronger AIA conversion quality?", options: [{ id: "t2q2a", label: "Document concerns and next actions after each meeting", correct: true }, { id: "t2q2b", label: "Wait for clients to message first every time", correct: false }, { id: "t2q2c", label: "Use one script for every client scenario", correct: false }] },
    { id: "t2q3", question: "For leadership visibility, what should agent updates include?", options: [{ id: "t2q3a", label: "Training completion status and key client follow-up outcomes", correct: true }, { id: "t2q3b", label: "Only personal notes with no next steps", correct: false }, { id: "t2q3c", label: "No records, only verbal updates", correct: false }] },
  ] },
];

let teamRoster = [
  { manager_id: "L123", agent_id: "A123", joined_at: "2026-01-01T09:00:00.000Z" },
  { manager_id: "L123", agent_id: "A124", joined_at: "2026-01-01T09:00:00.000Z" },
  { manager_id: "L123", agent_id: "A125", joined_at: "2026-01-01T09:00:00.000Z" },
  { manager_id: "D123", agent_id: "A123", joined_at: "2026-01-01T09:00:00.000Z" },
  { manager_id: "D123", agent_id: "A124", joined_at: "2026-01-01T09:00:00.000Z" },
  { manager_id: "D123", agent_id: "A125", joined_at: "2026-01-01T09:00:00.000Z" },
  { manager_id: "D123", agent_id: "A126", joined_at: "2026-01-01T09:00:00.000Z" },
  { manager_id: "D123", agent_id: "A127", joined_at: "2026-01-01T09:00:00.000Z" },
];

const performanceRows = [
  { agent_id: "A123", full_name: "Alicia Tan", period_year: 2026, period_label: "Jan - May", ytd_fyc: 34525, yearly_target: 1500000, weekly_fyc: 6913, last_week_fyc: 5187, district_rank: 1, delta_pct: 435, total_cases: 14, team_name: "SP-ALPHA-GABY", extra: { monthlyYtd: [{ month: "Jan", value: 6200 }, { month: "Feb", value: 12400 }, { month: "Mar", value: 18800 }, { month: "Apr", value: 33100 }, { month: "May", value: 45500 }, { month: "Jun", value: 58600 }, { month: "Jul", value: 68800 }, { month: "Aug", value: 74200 }, { month: "Sep", value: 87500 }, { month: "Oct", value: 96800 }, { month: "Nov", value: 104600 }, { month: "Dec", value: 111800 }], weekly: [{ day: "Mon", fyc: 4200, cases: 2 }, { day: "Tue", fyc: 6800, cases: 3 }, { day: "Wed", fyc: 2600, cases: 1 }, { day: "Thu", fyc: 9100, cases: 4 }, { day: "Fri", fyc: 5600, cases: 2 }], menteeStatuses: ["Top producer", "Consistent follow-up", "Needs weekly coaching", "Pipeline review due"] } },
  ...["A124","A125","A126","A127","A128","A129","A130","A131","A132"].map((id, index) => ({ agent_id: id, full_name: devUsers[id].fullName, period_year: 2026, period_label: "Jan - May", ytd_fyc: [23210,9400,8025,7627,6577,6100,5240,4941,2022][index], district_rank: index + 2, delta_pct: [44,-39,0,-26,346,76,-55,-56,0][index], total_cases: [10,5,4,4,3,3,2,2,1][index], team_name: ["SP-BETA-GABY","SP-GAMMA-GABY","SP-DELTA-GABY","SP-EPSILON-GABY","SP-ZETA-GABY","SP-ETA-GABY","SP-THETA-GABY","SP-IOTA-GABY","SP-KAPPA-GABY"][index], extra: {} })),
];

const cpfTrackerEntries = [
  { agent_id: "A123", client_name: "Tan Wei Ming", account_focus: "OA allocation", status: "Review due", amount: 42000, note: "Confirm CPF nomination and protection gap before revised proposal." },
  { agent_id: "A123", client_name: "Nur Aisyah Rahman", account_focus: "MA buffer", status: "On track", amount: 28000, note: "Family health plan discussion includes MediSave affordability check." },
  { agent_id: "A123", client_name: "Marcus Lim", account_focus: "SA planning", status: "Action needed", amount: 36000, note: "Prepare retirement income projection before next F2F meeting." },
];

function sendJson(res, status, payload) {
  setCorsHeaders(res);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  });
  res.end(JSON.stringify(payload));
}

function setCorsHeaders(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type,Authorization");
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 1_000_000) {
        req.destroy();
        reject(new Error("Request body too large"));
      }
    });
    req.on("end", () => {
      if (!body) return resolve({});
      try {
        resolve(JSON.parse(body));
      } catch (err) {
        reject(err);
      }
    });
    req.on("error", reject);
  });
}

function makeToken(userId) {
  return crypto
    .createHash("sha256")
    .update(userId + ":" + Date.now() + ":" + Math.random())
    .digest("hex");
}

async function handleApi(req, res, pathname) {
  const url = new URL(req.url, "http://x");
  if (req.method === "OPTIONS") {
    setCorsHeaders(res);
    res.writeHead(204);
    res.end();
    return true;
  }

  if (req.method === "GET" && pathname === "/api/health") {
    sendJson(res, 200, { ok: true });
    return true;
  }

  if (req.method === "POST" && (pathname === "/auth/login" || pathname === "/api/auth/login")) {
    let body;
    try {
      body = await readJson(req);
    } catch (err) {
      sendJson(res, 400, { error: "Invalid JSON body" });
      return true;
    }

    const userId = String(body.userId || body.user_id || "").trim().toUpperCase();
    const password = String(body.password || "");
    const user = devUsers[userId];

    if (!user || password !== userId) {
      sendJson(res, 401, { error: "Invalid User ID or password" });
      return true;
    }

    sendJson(res, 200, {
      userId: user.userId,
      user_id: user.userId,
      fullName: user.fullName,
      full_name: user.fullName,
      role: user.role,
      roleId: user.roleId,
      role_id: user.roleId,
      token: makeToken(user.userId),
    });
    return true;
  }

  if (req.method === "GET" && pathname === "/users") {
    const role = url.searchParams.get("role");
    const rows = Object.values(devUsers)
      .filter((u) => !role || u.role === role)
      .map((u) => ({ user_id: u.userId, full_name: u.fullName, role_id: u.roleId, role: u.role }));
    sendJson(res, 200, rows);
    return true;
  }

  if (req.method === "GET" && pathname === "/leads") {
    const userId = url.searchParams.get("userId");
    const rows = leads
      .filter((lead) => !userId || lead.owner_id === userId)
      .map((lead) => ({ ...lead, followUps: followUps.filter((f) => f.lead_id === lead.lead_id) }));
    sendJson(res, 200, rows);
    return true;
  }

  if (req.method === "GET" && /^\/leads\/\d+$/.test(pathname)) {
    const id = Number(pathname.split("/").pop());
    const lead = leads.find((row) => row.lead_id === id);
    if (!lead) sendJson(res, 404, { error: "Lead not found" });
    else sendJson(res, 200, { ...lead, followUps: followUps.filter((f) => f.lead_id === id) });
    return true;
  }

  if ((req.method === "POST" && pathname === "/leads") || (req.method === "PUT" && /^\/leads\/\d+$/.test(pathname))) {
    const body = await readJson(req);
    const id = req.method === "PUT" ? Number(pathname.split("/").pop()) : Math.max(0, ...leads.map((l) => l.lead_id)) + 1;
    const row = {
      lead_id: id,
      name: body.name,
      age: Number(body.age || 0),
      contact: body.contact,
      email: body.email,
      meet_date: body.meetDate,
      location: body.location,
      meet_type: body.meetType,
      urgency: body.urgency,
      stage: body.stage,
      remarks: body.remarks,
      plan_type: body.planType,
      annual_premium: Number(body.premium || 0),
      commission_type: body.commission,
      cpf_oa: Number(body.cpfOA || 0),
      cpf_sa: Number(body.cpfSA || 0),
      occupation: body.occupation,
      income: body.income,
      referred_by: body.referredBy,
      owner_id: body.ownerId || "A123",
      extra: {},
    };
    leads = leads.filter((lead) => lead.lead_id !== id).concat(row);
    if (req.method === "POST") followUps.push({ lead_id: id, label: "Lead Created", scheduled_date: new Date().toISOString().slice(0, 10), is_done: true });
    sendJson(res, 200, { ...row, followUps: followUps.filter((f) => f.lead_id === id) });
    return true;
  }

  if (req.method === "GET" && pathname === "/events") {
    const category = url.searchParams.get("category");
    sendJson(res, 200, calendarEvents.filter((event) => !category || event.category === category));
    return true;
  }

  if (req.method === "POST" && pathname === "/events/bulk") {
    const body = await readJson(req);
    const category = body.category || "personal";
    calendarEvents = calendarEvents.filter((event) => event.category !== category).concat((body.events || []).map((event) => ({
      event_id: event.id || event.event_id || category + "-" + Date.now() + "-" + Math.floor(Math.random() * 1000),
      title: event.title,
      event_date: event.date,
      category,
      event_type: event.type || event.event_type || "Event",
      start_time: event.startTime || event.start_time || "",
      end_time: event.endTime || event.end_time || "",
      location: event.location || "",
      notes: event.notes || "",
      created_by: body.userId || "A123",
    })));
    sendJson(res, 200, { ok: true });
    return true;
  }

  if (req.method === "GET" && pathname === "/tasks") {
    const userId = url.searchParams.get("userId");
    sendJson(res, 200, personalTasks.filter((task) => !userId || task.user_id === userId));
    return true;
  }

  if (req.method === "POST" && pathname === "/tasks/bulk") {
    const body = await readJson(req);
    const userId = body.userId || "A123";
    personalTasks = personalTasks.filter((task) => task.user_id !== userId).concat((body.tasks || []).map((task) => ({ ...task, user_id: userId })));
    sendJson(res, 200, { ok: true });
    return true;
  }

  if (req.method === "GET" && pathname === "/performance") {
    sendJson(res, 200, performanceRows);
    return true;
  }

  if (req.method === "GET" && pathname === "/cpf") {
    const agentId = url.searchParams.get("agentId");
    sendJson(res, 200, cpfTrackerEntries.filter((row) => !agentId || row.agent_id === agentId));
    return true;
  }

  if (req.method === "GET" && pathname === "/training/topics") {
    sendJson(res, 200, trainingTopics);
    return true;
  }

  if (req.method === "GET" && pathname === "/training/progress") {
    const userId = url.searchParams.get("userId") || "A123";
    sendJson(res, 200, trainingProgress[userId] || {});
    return true;
  }

  if (req.method === "POST" && pathname === "/training/progress") {
    const body = await readJson(req);
    trainingProgress[body.userId || "A123"] = body.progress || {};
    sendJson(res, 200, { ok: true });
    return true;
  }

  if (req.method === "GET" && /^\/teams\/[^/]+$/.test(pathname)) {
    const managerId = decodeURIComponent(pathname.split("/").pop());
    const rows = teamRoster.filter((row) => row.manager_id === managerId).map((row) => ({
      manager_id: row.manager_id,
      agent_id: row.agent_id,
      agentId: row.agent_id,
      full_name: devUsers[row.agent_id]?.fullName || row.agent_id,
      joined_at: row.joined_at,
    }));
    sendJson(res, 200, rows);
    return true;
  }

  if (req.method === "POST" && /^\/teams\/[^/]+$/.test(pathname)) {
    const managerId = decodeURIComponent(pathname.split("/").pop());
    const body = await readJson(req);
    teamRoster = teamRoster.filter((row) => !(row.manager_id === managerId && row.agent_id === body.agentId));
    teamRoster.push({ manager_id: managerId, agent_id: body.agentId, joined_at: new Date().toISOString(), notes: body.notes || "" });
    sendJson(res, 200, { ok: true });
    return true;
  }

  if (req.method === "DELETE" && /^\/teams\/[^/]+\/[^/]+$/.test(pathname)) {
    const parts = pathname.split("/");
    const managerId = decodeURIComponent(parts[2]);
    const agentId = decodeURIComponent(parts[3]);
    teamRoster = teamRoster.filter((row) => !(row.manager_id === managerId && row.agent_id === agentId));
    sendJson(res, 200, { ok: true });
    return true;
  }

  if (req.method === "GET" && pathname === "/announcements") {
    sendJson(res, 200, announcements);
    return true;
  }

  if (req.method === "POST" && pathname === "/announcements") {
    const body = await readJson(req);
    const row = { announcement_id: "a" + Date.now(), title: body.title, category: body.category, message: body.message, response_type: body.responseType, created_by: body.createdBy, created_at: new Date().toISOString() };
    announcements.unshift(row);
    sendJson(res, 200, row);
    return true;
  }

  if (req.method === "GET" && pathname === "/announcement-responses") {
    sendJson(res, 200, announcementResponses);
    return true;
  }

  if (req.method === "POST" && /^\/announcements\/[^/]+\/responses$/.test(pathname)) {
    const announcementId = decodeURIComponent(pathname.split("/")[2]);
    const body = await readJson(req);
    if (!announcementResponses[announcementId]) announcementResponses[announcementId] = {};
    announcementResponses[announcementId][body.userId] = { choice: body.choice, note: body.note, at: new Date().toISOString() };
    sendJson(res, 200, announcementResponses[announcementId][body.userId]);
    return true;
  }

  if (req.method === "GET" && pathname === "/sales-settings") {
    sendJson(res, 200, { dailyTarget: 15 });
    return true;
  }

  if (req.method === "GET" && pathname === "/sales-activity-types") {
    sendJson(res, 200, activityTypes);
    return true;
  }

  if (req.method === "GET" && pathname === "/sales-entries") {
    const agentId = url.searchParams.get("agentId");
    sendJson(res, 200, salesEntries.filter((row) => !agentId || row.agent_id === agentId));
    return true;
  }

  if (req.method === "POST" && pathname === "/sales-entries") {
    const body = await readJson(req);
    const type = activityTypes.find((t) => t.activity_type_id === body.activityId) || {};
    const row = { entry_id: "sale-" + Date.now(), agent_id: body.agentId, entry_date: body.date, activity_type_id: body.activityId, activity_label: type.label || body.activityId, point_value: type.points || 0, count: Number(body.count || 1), client_name: body.client || "-", status: "Completed", notes: body.notes || "-", created_at: new Date().toISOString() };
    salesEntries.push(row);
    sendJson(res, 200, row);
    return true;
  }

  if (req.method === "GET" && pathname === "/sales-reflections") {
    const agentId = url.searchParams.get("agentId");
    sendJson(res, 200, salesReflections.filter((row) => !agentId || row.agent_id === agentId));
    return true;
  }

  if (req.method === "POST" && pathname === "/sales-reflections") {
    const body = await readJson(req);
    const row = { agent_id: body.agentId, reflection_date: body.date, good: body.good, bad: body.bad, improve: body.improve };
    salesReflections.push(row);
    sendJson(res, 200, row);
    return true;
  }

  if (req.method === "GET" && pathname === "/rooms") {
    sendJson(res, 200, rooms);
    return true;
  }

  if (req.method === "GET" && pathname === "/room-bookings") {
    sendJson(res, 200, roomBookings);
    return true;
  }

  if (req.method === "POST" && pathname === "/room-bookings") {
    const body = await readJson(req);
    const row = { booking_id: Math.max(0, ...roomBookings.map((b) => Number(b.booking_id))) + 1, title: body.title, room_id: body.roomId, booking_date: body.date, start_time: body.startTime, end_time: body.endTime, booked_by_name: body.bookedByName, notes: body.notes || "", recurrence: body.recurrence || "none" };
    roomBookings.push(row);
    sendJson(res, 200, row);
    return true;
  }

  if ((req.method === "PUT" || req.method === "DELETE") && /^\/room-bookings\/\d+$/.test(pathname)) {
    const id = Number(pathname.split("/").pop());
    if (req.method === "DELETE") {
      roomBookings = roomBookings.filter((row) => Number(row.booking_id) !== id);
      sendJson(res, 200, { ok: true });
    } else {
      const body = await readJson(req);
      roomBookings = roomBookings.map((row) => Number(row.booking_id) === id ? { ...row, title: body.title, room_id: body.roomId, booking_date: body.date, start_time: body.startTime, end_time: body.endTime, booked_by_name: body.bookedByName, notes: body.notes || "", recurrence: body.recurrence || "none" } : row);
      sendJson(res, 200, roomBookings.find((row) => Number(row.booking_id) === id));
    }
    return true;
  }

  if (req.method === "GET" && pathname === "/attendance-events") {
    sendJson(res, 200, attendanceEvents);
    return true;
  }

  if (req.method === "POST" && pathname === "/attendance-events") {
    const body = await readJson(req);
    const row = { ...body, event_id: body.id || "att-event-" + Date.now(), attendance_token: body.attendanceToken || "qr-" + Date.now() };
    attendanceEvents = attendanceEvents.filter((event) => event.event_id !== row.event_id).concat(row);
    sendJson(res, 200, row);
    return true;
  }

  if (req.method === "GET" && pathname === "/attendance-records") {
    sendJson(res, 200, attendanceRecords);
    return true;
  }

  if (req.method === "POST" && pathname === "/attendance-records") {
    const body = await readJson(req);
    const row = { attendance_id: body.id || "att-" + Date.now(), event_id: body.eventId, event_title: body.eventTitle, user_id: body.userId, role: body.role, check_in_time: body.checkInTime, status: body.status };
    attendanceRecords.unshift(row);
    sendJson(res, 200, row);
    return true;
  }

  if (req.method === "GET" && pathname === "/recruitment") {
    const funnel = [
      { label: "Applicants", count: 247, pct: 100, color: "#202124", detail: "247 total applicants across all channels." },
      { label: "CV Review Pass", count: 178, pct: 72, color: "#374151", detail: "178 CVs cleared initial screening." },
      { label: "First Interview", count: 94, pct: 38, color: "#4b5563", detail: "94 candidates attended first interview." },
      { label: "Final Round", count: 35, pct: 14, color: "#6b7280", detail: "35 reached final assessment." },
      { label: "Offer Extended", count: 18, pct: 7, color: "#9ca3af", detail: "18 offers sent." },
      { label: "Active FC", count: 10, pct: 4, color: "#a6192e", detail: "10 active Financial Consultants from this intake." },
    ];
    const sources = [{ label: "Referral", pct: 42 }, { label: "LinkedIn", pct: 28 }, { label: "Walk-in", pct: 18 }, { label: "Job Portals", pct: 12 }];
    const programs = [{ name: "FC Graduate", opens: 58, interviews: 22, offers: 6 }, { name: "Internship - Eng", opens: 41, interviews: 17, offers: 5 }, { name: "Internship - Data", opens: 33, interviews: 14, offers: 4 }];
    sendJson(res, 200, {
      metrics: {
        programmeLead: "District Manager",
        cycle: "2026 Intake",
        targetActiveFc: 10,
        intakeTag: "2026 intake - 247 applicants - 10 active FCs",
        kpis: [
          { label: "Conversion Rate", value: "4.0%", delta: "+0.8%", note: "vs 2025" },
          { label: "Time to Offer", value: "19d", delta: "-4d", note: "vs 2025" },
          { label: "Offer Acceptance", value: "67%", delta: "+12%", note: "vs 2025" },
          { label: "Source: Referral", value: "42%", note: "highest converter" },
        ],
      },
      funnel,
      sources,
      programs,
    });
    return true;
  }

  if (req.method === "POST" && pathname === "/recruitment/access") {
    const body = await readJson(req);
    if (!recruitmentAccessCode) sendJson(res, 503, { error: "Recruitment access code is not configured" });
    else if (body.code === recruitmentAccessCode) sendJson(res, 200, { ok: true });
    else sendJson(res, 401, { error: "Incorrect code" });
    return true;
  }

  if (req.method === "GET" && pathname === "/helpdesk/tickets") {
    sendJson(res, 200, helpdeskTickets);
    return true;
  }

  if (req.method === "POST" && pathname === "/helpdesk/tickets") {
    const body = await readJson(req);
    const row = {
      ticket_id: helpdeskTickets.reduce((max, ticket) => Math.max(max, Number(ticket.ticket_id || ticket.id || 0)), 0) + 1,
      title: body.title || "",
      description: body.description || body.desc || "",
      reporter: body.reporter || body.reported_by || "",
      reported_at: new Date().toISOString(),
      priority: body.priority || "low",
      status: body.status || "open",
      category: body.category || "General",
    };
    helpdeskTickets.unshift(row);
    sendJson(res, 200, row);
    return true;
  }

  if (req.method === "PUT" && /^\/helpdesk\/tickets\/\d+$/.test(pathname)) {
    const id = Number(pathname.split("/").pop());
    const body = await readJson(req);
    const ticket = helpdeskTickets.find((row) => Number(row.ticket_id || row.id) === id);
    if (!ticket) {
      sendJson(res, 404, { error: "Ticket not found" });
      return true;
    }
    Object.assign(ticket, {
      title: body.title || ticket.title,
      description: body.description || body.desc || ticket.description,
      reporter: body.reporter || body.reported_by || ticket.reporter,
      priority: body.priority || ticket.priority,
      status: body.status || ticket.status,
      category: body.category || ticket.category,
    });
    sendJson(res, 200, ticket);
    return true;
  }

  if (req.method === "DELETE" && /^\/helpdesk\/tickets\/\d+$/.test(pathname)) {
    const id = Number(pathname.split("/").pop());
    helpdeskTickets = helpdeskTickets.filter((row) => Number(row.ticket_id || row.id) !== id);
    sendJson(res, 200, { ok: true });
    return true;
  }

  if (req.method === "GET" && pathname === "/cpf-rates") {
    sendJson(res, 200, {
      allocationBands: [
        { maxAge: 35, oa: 0.6217, sa: 0.1621, ma: 0.2162 }, { maxAge: 45, oa: 0.5677, sa: 0.1891, ma: 0.2432 },
        { maxAge: 50, oa: 0.5136, sa: 0.2162, ma: 0.2702 }, { maxAge: 55, oa: 0.4055, sa: 0.3108, ma: 0.2837 },
        { maxAge: 60, oa: 0.3694, sa: 0.3076, ma: 0.323 }, { maxAge: 65, oa: 0.149, sa: 0.4042, ma: 0.4468 },
        { maxAge: 70, oa: 0.0607, sa: 0.303, ma: 0.6363 }, { maxAge: 120, oa: 0.08, sa: 0.08, ma: 0.84 },
      ],
      contributionBands: [
        { maxAge: 55, employer: 0.17, employee: 0.2 }, { maxAge: 60, employer: 0.155, employee: 0.17 },
        { maxAge: 65, employer: 0.12, employee: 0.115 }, { maxAge: 70, employer: 0.09, employee: 0.075 },
        { maxAge: 120, employer: 0.075, employee: 0.05 },
      ],
      defaults: { "cpf-current-age": 30, "cpf-target-age": 55, "cpf-starting-balance": 90000, "cpf-monthly-salary": 5367, "cpf-salary-growth": 4.3, "cpf-wage-ceiling": 7400, "cpf-ma-cap": 79000 },
    });
    return true;
  }

  if (req.method === "GET" && pathname === "/resources") {
    sendJson(res, 200, [
      { title: "Client Profile Templates", url: "https://www.sharepoint.com", description: "Lead intake forms, fact-find sheets, and meeting note templates.", dot: "blue" },
      { title: "Product & Plan Decks", url: "https://www.sharepoint.com", description: "Plan comparison decks, premium tables, and sales presentation files.", dot: "red" },
      { title: "Compliance References", url: "https://www.sharepoint.com", description: "Disclosure scripts, product suitability checks, and document checklists.", dot: "orange" },
    ]);
    return true;
  }

  return false;
}

http
  .createServer(async (req, res) => {
    const pathname = decodeURIComponent(new URL(req.url, "http://x").pathname);

    if (await handleApi(req, res, pathname)) return;

    if (pathname === "/" || pathname === "/index.html") {
      res.writeHead(302, { Location: "/frontend/index.html" });
      return res.end();
    }

    let p = path.join(root, pathname);
    if (!p.startsWith(root)) {
      res.writeHead(403);
      return res.end();
    }
    fs.stat(p, (err, st) => {
      if (!err && st.isDirectory()) p = path.join(p, "index.html");
      fs.readFile(p, (e, buf) => {
        if (e) {
          res.writeHead(404);
          return res.end("Not found");
        }
        const ext = path.extname(p).toLowerCase();
        res.setHeader("Content-Type", mime[ext] || "application/octet-stream");
        res.end(buf);
      });
    });
  })
  .listen(port, () => {
    console.log("Serving at http://127.0.0.1:" + port + "/frontend/");
  });
