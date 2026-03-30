const API_BASE = "https://staff-portal-proxy.mdrobiulislam.workers.dev";

/* ========= ELEMENT HELPERS ========= */
function el(...ids) {
  for (const id of ids) {
    const node = document.getElementById(id);
    if (node) return node;
  }
  return null;
}

const apiStatus = el("apiStatus");
const logoutBtn = el("logoutBtn");
const checkInBtn = el("checkInBtn");
const checkOutBtn = el("checkOutBtn");

const breakTypeSelect = el("breakTypeSelect");
const breakRemarkInput = el("breakRemarkInput");
const breakStartBtn = el("breakStartBtn");
const breakEndBtn = el("breakEndBtn");
const breakState = el("breakState");

const resultBox = el("resultMessage", "resultBox");
const attendanceBox = el("attendanceMessage", "attendanceBox");
const attendanceState = el("attendanceState");
const shiftStatusPill = el("shiftStatusPill");

const todayCheckInEl = el("todayCheckIn");
const todayCheckOutEl = el("todayCheckOut");
const todayStatusEl = el("todayStatus");
const todayLateMinutesEl = el("todayLateMinutes");

const attendanceScoreEl = el("attendanceScore", "attendanceScoreValue");
const kpiScoreEl = el("kpiScore", "kpiScoreValue");
const finalScoreEl = el("finalScore", "finalScoreValue");
const ratingLabelEl = el("ratingLabel", "ratingLabelValue");
const scoreUpdatedTagEl = el("scoreUpdatedTag", "liveScoreMonth");
const scoreNoteEl = el("scoreNote");

const scoreboardMonthTagEl = el("scoreboardMonthTag");
const myScoreBox = el("myScoreBox");
const otherStaffScores = el("otherStaffScores");

const meFullNameEl = el("meFullName");
const meLoginIdEl = el("meLoginId");
const meTeamEl = el("meTeam");
const meRoleEl = el("meRole");

const meAttendanceScoreEl = el("meAttendanceScore");
const meKpiScoreEl = el("meKpiScore");
const meFinalScoreEl = el("meFinalScore");
const meRatingLabelEl = el("meRatingLabel");
const meRankEl = el("meRank");

const meLeadershipEl = el("meLeadership");
const meEffectivenessEl = el("meEffectiveness");
const meProblemSolvingEl = el("meProblemSolving");
const meCommunicationEl = el("meCommunication");
const meProductivityEl = el("meProductivity");
const meInitiativeEl = el("meInitiative");
const mePenaltyEl = el("mePenalty");

const meWorkingDaysEl = el("meWorkingDays");
const meOffDaysEl = el("meOffDays");
const meLeaveDaysEl = el("meLeaveDays");
const meLateDaysEl = el("meLateDays");
const meMissingSignInDaysEl = el("meMissingSignInDays");
const meMissingSignOutDaysEl = el("meMissingSignOutDays");
const meTotalLateMinutesEl = el("meTotalLateMinutes");

const accessBanner = el("accessBanner");

let currentStaff = null;
let currentShift = null;
let todayLogs = [];
let portalClientIp = localStorage.getItem("staffPortalClientIp") || "";

/* ========= BASIC HELPERS ========= */
function setText(node, value) {
  if (!node) return;
  node.textContent = value == null || value === "" ? "-" : String(value);
}

function showResult(message, isError = false) {
  if (!resultBox) return;
  resultBox.textContent = message || (isError ? "Action failed." : "Done.");
  if (resultBox.classList) {
    resultBox.classList.toggle("success-box", !isError);
    resultBox.classList.toggle("error-box", isError);
    resultBox.classList.toggle("success-message", !isError);
  }
}

function showAttendanceMessage(message) {
  if (attendanceBox) {
    attendanceBox.textContent = message || "No attendance action found for today.";
  }
}

function toUpper(v) {
  return String(v || "").trim().toUpperCase();
}

function toNum(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function fmtScore(v) {
  return toNum(v, 0).toFixed(2);
}

function escapeHtml(value) {
  return String(value == null ? "" : value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatTimeFromDateTime(value) {
  const raw = String(value || "").trim();
  if (!raw) return "-";

  const m = raw.match(/^(\d{4}-\d{2}-\d{2})[ T](\d{2}):(\d{2})(?::\d{2})?$/);
  if (m) {
    let hh = Number(m[2]);
    const mm = m[3];
    const ap = hh >= 12 ? "PM" : "AM";
    if (hh === 0) hh = 12;
    else if (hh > 12) hh -= 12;
    return `${hh}:${mm} ${ap}`;
  }

  return raw;
}

function prettifyLabel(key) {
  const map = {
    staff_id: "Staff ID",
    full_name: "Full Name",
    login_id: "Login ID",
    team: "Team",
    role: "Role",
    attendance_score: "Attendance Score",
    kpi_score: "KPI Score",
    final_score: "Final Score",
    rating_label: "Rating",
    rank: "Rank",
    score_month: "Score Month",
    raw_average: "Raw Average",
    leadership: "Leadership",
    effectiveness: "Effectiveness",
    problem_solving: "Problem Solving",
    communication: "Communication",
    productivity: "Productivity",
    initiative: "Initiative",
    penalty: "Penalty",
    filled_metrics: "Filled Metrics",
    note: "Note",
    working_days: "Working Days",
    off_days: "Off Days",
    leave_days: "Leave Days",
    late_days: "Late Days",
    missing_sign_in_days: "Missing Sign In Days",
    missing_sign_out_days: "Missing Sign Out Days",
    total_late_minutes: "Total Late Minutes",
    total_rows: "Total Rows"
  };

  return map[key] || String(key || "")
    .replaceAll("_", " ")
    .replace(/\b\w/g, s => s.toUpperCase());
}

/* ========= POPUP ========= */
function ensurePopup() {
  let popup = document.getElementById("actionPopup");
  if (popup) return popup;

  popup = document.createElement("div");
  popup.id = "actionPopup";
  popup.innerHTML = `
    <div id="actionPopupBox" style="
      position:fixed;
      inset:0;
      background:rgba(15,23,42,.35);
      display:none;
      align-items:center;
      justify-content:center;
      z-index:99999;
      padding:16px;
    ">
      <div id="actionPopupCard" style="
        width:100%;
        max-width:380px;
        background:#ffffff;
        border-radius:18px;
        box-shadow:0 20px 50px rgba(15,23,42,.22);
        padding:22px;
        text-align:center;
      ">
        <div id="actionPopupIcon" style="
          width:54px;
          height:54px;
          margin:0 auto 14px;
          border-radius:999px;
          display:flex;
          align-items:center;
          justify-content:center;
          font-size:24px;
          font-weight:800;
          background:#eef2ff;
          color:#3b5bdb;
        ">⏳</div>
        <div id="actionPopupTitle" style="
          font-size:20px;
          font-weight:800;
          color:#0f172a;
          margin-bottom:8px;
        ">Please wait</div>
        <div id="actionPopupText" style="
          font-size:14px;
          color:#475569;
          line-height:1.5;
        ">Processing...</div>
      </div>
    </div>
  `;
  document.body.appendChild(popup);
  return popup;
}

function showActionPopup(title, text, type = "loading") {
  ensurePopup();
  const box = document.getElementById("actionPopupBox");
  const icon = document.getElementById("actionPopupIcon");
  const t = document.getElementById("actionPopupTitle");
  const txt = document.getElementById("actionPopupText");

  if (!box || !icon || !t || !txt) return;

  box.style.display = "flex";
  t.textContent = title || "Please wait";
  txt.textContent = text || "";

  if (type === "success") {
    icon.textContent = "✓";
    icon.style.background = "#dcfce7";
    icon.style.color = "#166534";
  } else if (type === "error") {
    icon.textContent = "!";
    icon.style.background = "#fee2e2";
    icon.style.color = "#b91c1c";
  } else {
    icon.textContent = "⏳";
    icon.style.background = "#eef2ff";
    icon.style.color = "#3b5bdb";
  }
}

function hideActionPopup(delay = 0) {
  const box = document.getElementById("actionPopupBox");
  if (!box) return;
  setTimeout(() => {
    box.style.display = "none";
  }, delay);
}

/* ========= SESSION ========= */
function requireStaffSession() {
  const raw = localStorage.getItem("staffPortalStaff");
  if (!raw) {
    window.location.href = "index.html";
    return false;
  }

  try {
    currentStaff = JSON.parse(raw);
  } catch (err) {
    localStorage.removeItem("staffPortalStaff");
    window.location.href = "index.html";
    return false;
  }

  if (!currentStaff || !currentStaff.login_id) {
    localStorage.removeItem("staffPortalStaff");
    window.location.href = "index.html";
    return false;
  }

  return true;
}

function fillStaffCard() {
  setText(el("staffName"), currentStaff.full_name);
  setText(el("staffLoginIdView"), currentStaff.login_id);
  setText(el("staffTeam"), currentStaff.team);
  setText(el("staffRole"), currentStaff.role);
}

/* ========= API ========= */
async function checkApi() {
  try {
    const res = await fetch(`${API_BASE}?action=health`);
    const data = await res.json();
    if (apiStatus) {
      apiStatus.textContent = data.ok
        ? `API: Online (${data.version || "OK"})`
        : "API: Error";
    }
  } catch (err) {
    if (apiStatus) apiStatus.textContent = "API: Offline";
  }
}

async function getJson(url) {
  const res = await fetch(url);
  return res.json();
}

async function postJson(payload) {
  const res = await fetch(API_BASE, {
    method: "POST",
    headers: {
      "Content-Type": "text/plain;charset=utf-8"
    },
    body: JSON.stringify(payload)
  });
  return res.json();
}

/* ========= OPTIONAL IP CHECK ========= */
async function checkPortalAccess() {
  try {
    const res = await fetch(`${API_BASE}?action=portalAccess`);
    const data = await res.json();

    if (data && data.client_ip) {
      portalClientIp = data.client_ip;
      localStorage.setItem("staffPortalClientIp", portalClientIp);
    }

    if (accessBanner) {
      if (data && data.allowed === true) {
        accessBanner.textContent = `Office IP allowed (${portalClientIp || "-"})`;
      } else if (data && data.allowed === false) {
        accessBanner.textContent = `Access blocked (${portalClientIp || "-"})`;
      }
    }

    if (data && data.allowed === false) {
      document.body.innerHTML = `
        <div class="page">
          <div class="card">
            <h2>Access Blocked</h2>
            <p>This portal can be opened only from allowed office IP addresses.</p>
            <p>Current IP: ${portalClientIp || "-"}</p>
          </div>
        </div>
      `;
      return false;
    }

    return true;
  } catch (err) {
    if (accessBanner) {
      accessBanner.textContent = "IP check unavailable";
    }
    return true;
  }
}

/* ========= TODAY SHIFT ========= */
async function loadTodayShift() {
  const data = await getJson(
    `${API_BASE}?action=todayShift&login_id=${encodeURIComponent(currentStaff.login_id)}`
  );

  if (!data.ok) {
    if (shiftStatusPill) shiftStatusPill.textContent = "Shift Error";
    showResult(data.error || "Could not load today shift.", true);
    return;
  }

  currentShift = data.data || {};
  setText(el("shiftDate"), currentShift.date);
  setText(el("shiftCode"), currentShift.shift_code);
  setText(el("shiftStart"), currentShift.scheduled_start);
  setText(el("shiftEnd"), currentShift.scheduled_end);

  if (currentShift.is_off_day) {
    if (shiftStatusPill) shiftStatusPill.textContent = "OFF DAY";
  } else if (currentShift.is_leave_day) {
    if (shiftStatusPill) shiftStatusPill.textContent = "LEAVE";
  } else {
    if (shiftStatusPill) shiftStatusPill.textContent = "WORKING DAY";
  }
}

/* ========= ATTENDANCE ========= */
function buildAttendanceSummary(logs) {
  if (!logs || !logs.length) {
    if (attendanceState) attendanceState.textContent = "No logs yet";

    setText(todayCheckInEl, "-");
    setText(todayCheckOutEl, "-");
    setText(todayStatusEl, "-");
    setText(todayLateMinutesEl, "-");
    updateBreakState(logs);

    return "No attendance action found for today.";
  }

  const checkIn = logs.find(x => toUpper(x.action_type) === "CHECK_IN");
  const checkOut = logs.find(x => toUpper(x.action_type) === "CHECK_OUT");

  if (checkIn && checkOut) {
    if (attendanceState) attendanceState.textContent = "Checked In + Out";
  } else if (checkIn) {
    if (attendanceState) attendanceState.textContent = "Checked In";
  } else {
    if (attendanceState) attendanceState.textContent = "No logs yet";
  }

  const checkInTime = checkIn ? formatTimeFromDateTime(checkIn.actual_time || checkIn.timestamp) : "-";
  const checkOutTime = checkOut ? formatTimeFromDateTime(checkOut.actual_time || checkOut.timestamp) : "-";
  const statusFlag = checkIn ? (checkIn.status_flag || "ON_TIME") : "-";
  const lateMinutes = checkIn ? (checkIn.minutes_diff || 0) : "-";

  setText(todayCheckInEl, checkInTime);
  setText(todayCheckOutEl, checkOutTime);
  setText(todayStatusEl, statusFlag);
  setText(todayLateMinutesEl, lateMinutes);

  updateBreakState(logs);

  return [
    `Check In : ${checkInTime}`,
    `Check Out: ${checkOutTime}`,
    `Status   : ${statusFlag}`,
    `Late Min : ${lateMinutes}`
  ].join("\n");
}

async function loadAttendance() {
  try {
    const data = await getJson(
      `${API_BASE}?action=todayAttendance&login_id=${encodeURIComponent(currentStaff.login_id)}`
    );

    if (!data.ok) {
      showAttendanceMessage(data.error || "Could not load attendance.");
      updateBreakState([]);
      return;
    }

    todayLogs = data.logs || data.data || [];
    showAttendanceMessage(buildAttendanceSummary(todayLogs));
  } catch (err) {
    showAttendanceMessage("Could not load attendance.");
    updateBreakState([]);
  }
}

function refreshButtonState() {
  const checkIn = todayLogs.find(x => toUpper(x.action_type) === "CHECK_IN");
  const checkOut = todayLogs.find(x => toUpper(x.action_type) === "CHECK_OUT");

  if (checkInBtn) checkInBtn.disabled = !!checkIn;
  if (checkOutBtn) checkOutBtn.disabled = !checkIn || !!checkOut;

  const allowBreak = !!checkIn && !checkOut;
  if (breakStartBtn) breakStartBtn.disabled = !allowBreak;
  if (breakEndBtn) breakEndBtn.disabled = !allowBreak;
}

/* ========= SCORE ========= */
async function loadPerformanceScore() {
  try {
    const data = await getJson(
      `${API_BASE}?action=performanceScore&login_id=${encodeURIComponent(currentStaff.login_id)}`
    );

    if (!data.ok) {
      setText(attendanceScoreEl, "-");
      setText(kpiScoreEl, "-");
      setText(finalScoreEl, "-");
      setText(ratingLabelEl, data.error || "-");
      if (scoreNoteEl) scoreNoteEl.textContent = "Could not load performance score.";
      return;
    }

    const score = data.data || {};
    setText(attendanceScoreEl, score.attendance_score);
    setText(kpiScoreEl, score.kpi_score);
    setText(finalScoreEl, score.final_score);
    setText(ratingLabelEl, score.rating_label);

    if (scoreUpdatedTagEl) {
      if (score.score_month) scoreUpdatedTagEl.textContent = score.score_month;
      else scoreUpdatedTagEl.textContent = "Live";
    }

    if (scoreNoteEl) {
      const aw = score.attendance_weight ?? 40;
      const kw = score.kpi_weight ?? 60;
      scoreNoteEl.textContent = `Attendance ${aw}% + KPI ${kw}% = Final Score`;
    }
  } catch (err) {
    setText(attendanceScoreEl, "-");
    setText(kpiScoreEl, "-");
    setText(finalScoreEl, "-");
    setText(ratingLabelEl, "-");
    if (scoreNoteEl) scoreNoteEl.textContent = "Could not load performance score.";
  }
}

/* ========= MY SCORE DETAIL RENDER ========= */
function renderMyScoreDetails(item) {
  if (!item) {
    setText(meFullNameEl, "-");
    setText(meLoginIdEl, "-");
    setText(meTeamEl, "-");
    setText(meRoleEl, "-");

    setText(meAttendanceScoreEl, "-");
    setText(meKpiScoreEl, "-");
    setText(meFinalScoreEl, "-");
    setText(meRatingLabelEl, "-");
    setText(meRankEl, "-");

    setText(meLeadershipEl, "-");
    setText(meEffectivenessEl, "-");
    setText(meProblemSolvingEl, "-");
    setText(meCommunicationEl, "-");
    setText(meProductivityEl, "-");
    setText(meInitiativeEl, "-");
    setText(mePenaltyEl, "-");

    setText(meWorkingDaysEl, "-");
    setText(meOffDaysEl, "-");
    setText(meLeaveDaysEl, "-");
    setText(meLateDaysEl, "-");
    setText(meMissingSignInDaysEl, "-");
    setText(meMissingSignOutDaysEl, "-");
    setText(meTotalLateMinutesEl, "-");

    if (myScoreBox) {
      myScoreBox.textContent = "No score details found.";
    }
    return;
  }

  const attendance = item.attendance_details || {};
  const kpi = item.kpi_details || {};

  setText(meFullNameEl, item.full_name);
  setText(meLoginIdEl, item.login_id);
  setText(meTeamEl, item.team);
  setText(meRoleEl, item.role);

  setText(meAttendanceScoreEl, item.attendance_score);
  setText(meKpiScoreEl, item.kpi_score);
  setText(meFinalScoreEl, item.final_score);
  setText(meRatingLabelEl, item.rating_label);
  setText(meRankEl, item.rank);

  setText(meLeadershipEl, kpi.leadership);
  setText(meEffectivenessEl, kpi.effectiveness);
  setText(meProblemSolvingEl, kpi.problem_solving);
  setText(meCommunicationEl, kpi.communication);
  setText(meProductivityEl, kpi.productivity);
  setText(meInitiativeEl, kpi.initiative);
  setText(mePenaltyEl, kpi.penalty);

  setText(meWorkingDaysEl, attendance.working_days);
  setText(meOffDaysEl, attendance.off_days);
  setText(meLeaveDaysEl, attendance.leave_days);
  setText(meLateDaysEl, attendance.late_days);
  setText(meMissingSignInDaysEl, attendance.missing_sign_in_days);
  setText(meMissingSignOutDaysEl, attendance.missing_sign_out_days);
  setText(meTotalLateMinutesEl, attendance.total_late_minutes);

  if (myScoreBox) {
    myScoreBox.textContent = "";
  }
}

/* ========= STAFF SCOREBOARD ========= */
function renderOtherStaffScores(items) {
  if (!otherStaffScores) return;

  if (!items || !items.length) {
    otherStaffScores.innerHTML = `
      <div class="score-row">
        <div class="score-row-left">
          <div class="score-row-name">No data found</div>
          <div class="score-row-sub">No other staff score available</div>
        </div>
        <div class="score-row-right">
          <span class="final-score-chip">-</span>
        </div>
      </div>
    `;
    return;
  }

  otherStaffScores.innerHTML = items.map(item => `
    <div class="score-row">
      <div class="score-row-left">
        <div class="score-row-name">${escapeHtml(item.full_name || "-")}</div>
        <div class="score-row-sub">${escapeHtml(item.team || "-")} | ${escapeHtml(item.rating_label || "-")}</div>
      </div>
      <div class="score-row-right">
        <span class="final-score-chip">${fmtScore(item.final_score)}</span>
      </div>
    </div>
  `).join("");
}

async function loadStaffScoreboard() {
  try {
    const data = await getJson(
      `${API_BASE}?action=staffScoreboard&login_id=${encodeURIComponent(currentStaff.login_id)}`
    );

    if (!data?.ok) {
      renderMyScoreDetails(null);
      renderOtherStaffScores([]);
      if (scoreboardMonthTagEl) scoreboardMonthTagEl.textContent = "-";
      return;
    }

    if (scoreboardMonthTagEl) {
      scoreboardMonthTagEl.textContent = data.month || "Live";
    }

    renderMyScoreDetails(data.me || null);
    renderOtherStaffScores(data.others || []);
  } catch (err) {
    renderMyScoreDetails(null);
    renderOtherStaffScores([]);
    if (scoreboardMonthTagEl) scoreboardMonthTagEl.textContent = "-";
  }
}

/* ========= BREAK HELPERS ========= */
function getBreakOpenStatus(logs, breakType) {
  let balance = 0;

  (logs || []).forEach(item => {
    const action = toUpper(item.action_type);
    if (action === `${breakType}_START`) balance++;
    if (action === `${breakType}_END` && balance > 0) balance--;
  });

  return balance > 0;
}

function updateBreakState(logs) {
  const type = toUpper(breakTypeSelect?.value || "BREAK");
  const isOpen = getBreakOpenStatus(logs || todayLogs, type);

  if (!breakState) return;

  if (isOpen) {
    breakState.textContent = `${type.replaceAll("_", " ")} ACTIVE`;
  } else {
    breakState.textContent = "Ready";
  }
}

function getDeviceInfo() {
  return navigator.userAgent || "Browser";
}

/* ========= ACTION RUNNERS ========= */
async function afterActionRefresh() {
  await loadAttendance();
  await loadPerformanceScore();
  await loadStaffScoreboard();
  refreshButtonState();
}

async function handleBreakAction(mode) {
  const breakType = breakTypeSelect?.value || "BREAK";
  const remarks = breakRemarkInput?.value?.trim() || "";

  if (mode === "START") {
    if (breakStartBtn) breakStartBtn.disabled = true;
  } else {
    if (breakEndBtn) breakEndBtn.disabled = true;
  }

  showActionPopup(
    mode === "START" ? "Starting Break" : "Ending Break",
    `${breakType.replaceAll("_", " ")} is being processed...`,
    "loading"
  );

  try {
    const data = await postJson({
      action: "breakAction",
      login_id: currentStaff.login_id,
      break_type: breakType,
      break_mode: mode,
      source: "STAFF_PORTAL_WEB",
      office_ip: portalClientIp || "",
      device_info: getDeviceInfo(),
      remarks
    });

    if (data.ok) {
      showResult(data.ui_message || data.message || "Break action successful.");
      if (breakRemarkInput) breakRemarkInput.value = "";
      await afterActionRefresh();
      showActionPopup(
        "Completed",
        data.ui_message || data.message || "Break action completed successfully.",
        "success"
      );
      hideActionPopup(1200);
    } else {
      showResult(data.error || "Break action failed.", true);
      showActionPopup(
        "Action Failed",
        data.error || "Break action failed.",
        "error"
      );
      hideActionPopup(1600);
    }
  } catch (err) {
    const msg = "Break action failed: " + (err?.message || err);
    showResult(msg, true);
    showActionPopup("Action Failed", msg, "error");
    hideActionPopup(1600);
  } finally {
    refreshButtonState();
  }
}

async function handleCheckIn() {
  if (checkInBtn) checkInBtn.disabled = true;

  showActionPopup(
    "Checking In",
    "Your check-in is being processed. Please wait...",
    "loading"
  );

  try {
    const data = await postJson({
      action: "checkIn",
      login_id: currentStaff.login_id,
      source: "STAFF_PORTAL_WEB",
      office_ip: portalClientIp || "",
      device_info: getDeviceInfo(),
      remarks: ""
    });

    if (data.ok) {
      showResult(data.ui_message || data.message || "Check-in successful.");
      await afterActionRefresh();
      showActionPopup(
        "Check-In Complete",
        data.ui_message || data.message || "Check-in completed successfully.",
        "success"
      );
      hideActionPopup(1200);
    } else {
      showResult(data.error || "Check-in failed.", true);
      showActionPopup("Check-In Failed", data.error || "Check-in failed.", "error");
      hideActionPopup(1600);
    }
  } catch (err) {
    const msg = "Check-in failed: " + (err?.message || err);
    showResult(msg, true);
    showActionPopup("Check-In Failed", msg, "error");
    hideActionPopup(1600);
  } finally {
    refreshButtonState();
  }
}

async function handleCheckOut() {
  if (checkOutBtn) checkOutBtn.disabled = true;

  showActionPopup(
    "Checking Out",
    "Your check-out is being processed. Please wait...",
    "loading"
  );

  try {
    const data = await postJson({
      action: "checkOut",
      login_id: currentStaff.login_id,
      source: "STAFF_PORTAL_WEB",
      office_ip: portalClientIp || "",
      device_info: getDeviceInfo(),
      remarks: ""
    });

    if (data.ok) {
      showResult(data.ui_message || data.message || "Check-out successful.");
      await afterActionRefresh();
      showActionPopup(
        "Check-Out Complete",
        data.ui_message || data.message || "Check-out completed successfully.",
        "success"
      );
      hideActionPopup(1200);
    } else {
      showResult(data.error || "Check-out failed.", true);
      showActionPopup("Check-Out Failed", data.error || "Check-out failed.", "error");
      hideActionPopup(1600);
    }
  } catch (err) {
    const msg = "Check-out failed: " + (err?.message || err);
    showResult(msg, true);
    showActionPopup("Check-Out Failed", msg, "error");
    hideActionPopup(1600);
  } finally {
    refreshButtonState();
  }
}

/* ========= LOGOUT ========= */
function logout() {
  localStorage.removeItem("staffPortalStaff");
  window.location.href = "index.html";
}

/* ========= INIT ========= */
async function init() {
  if (!requireStaffSession()) return;

  ensurePopup();

  const allowed = await checkPortalAccess();
  if (!allowed) return;

  fillStaffCard();
  checkApi();

  await loadTodayShift();
  await loadAttendance();
  await loadPerformanceScore();
  await loadStaffScoreboard();

  refreshButtonState();

  if (checkInBtn) checkInBtn.addEventListener("click", handleCheckIn);
  if (checkOutBtn) checkOutBtn.addEventListener("click", handleCheckOut);
  if (breakStartBtn) breakStartBtn.addEventListener("click", () => handleBreakAction("START"));
  if (breakEndBtn) breakEndBtn.addEventListener("click", () => handleBreakAction("END"));
  if (breakTypeSelect) breakTypeSelect.addEventListener("change", () => updateBreakState(todayLogs));
  if (logoutBtn) logoutBtn.addEventListener("click", logout);
}

init();
