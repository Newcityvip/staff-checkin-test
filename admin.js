const API_BASE = "https://staff-portal-proxy.mdrobiulislam.workers.dev";

const apiStatus = document.getElementById("apiStatus");
const uploadBtn = document.getElementById("uploadBtn");
const resultBox = document.getElementById("resultBox");
const csvFileInput = document.getElementById("csvFile");
const adminLogoutBtn = document.getElementById("adminLogoutBtn");
const uploadMonthInput = document.getElementById("uploadMonth");
const uploadedByInput = document.getElementById("uploadedBy");

let adminSession = null;
let dashboardMonth = "";
let dashboardData = [];

function requireAdminSession() {
  const raw = localStorage.getItem("staffPortalAdmin");
  if (!raw) {
    window.location.href = "index.html";
    return false;
  }

  try {
    adminSession = JSON.parse(raw);
  } catch (err) {
    localStorage.removeItem("staffPortalAdmin");
    window.location.href = "index.html";
    return false;
  }

  return true;
}

async function checkApi() {
  try {
    const res = await fetch(`${API_BASE}?action=health`);
    const data = await res.json();
    if (data.ok) {
      apiStatus.textContent = `API: Online (${data.version})`;
    } else {
      apiStatus.textContent = "API: Error";
    }
  } catch (err) {
    apiStatus.textContent = "API: Offline";
  }
}

function readFileAsText(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = e => resolve(e.target.result);
    reader.onerror = err => reject(err);
    reader.readAsText(file);
  });
}

async function getJson(url) {
  const res = await fetch(url);
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch (err) {
    throw new Error(text || `HTTP ${res.status}`);
  }
}

async function postJson(payload) {
  const res = await fetch(API_BASE, {
    method: "POST",
    headers: {
      "Content-Type": "text/plain;charset=utf-8"
    },
    body: JSON.stringify(payload)
  });

  const text = await res.text();

  try {
    return JSON.parse(text);
  } catch (err) {
    throw new Error(text || `HTTP ${res.status}`);
  }
}

function getAdminLoginId() {
  return (
    adminSession?.login_id ||
    adminSession?.admin?.login_id ||
    adminSession?.staff?.login_id ||
    uploadedByInput?.value?.trim() ||
    "ADMIN"
  );
}

function isRealCsvFile(file) {
  if (!file) return false;
  const name = String(file.name || "").toLowerCase().trim();
  return name.endsWith(".csv") && !name.endsWith(".csv.xlsx") && !name.endsWith(".csv.xls");
}
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function looksLikeTimeoutError(message) {
  const msg = String(message || "").toLowerCase();
  return (
    msg.includes("524") ||
    msg.includes("timeout") ||
    msg.includes("timed out") ||
    msg.includes("failed to fetch") ||
    msg.includes("unexpected token") ||
    msg.includes("error code")
  );
}

async function pollUploadVerification(uploadMonth, fileName, maxTry = 20, waitMs = 3000) {
  for (let i = 0; i < maxTry; i++) {
    try {
      const verifyData = await postJson({
        action: "verifyLastScheduleUpload",
        upload_month: uploadMonth,
        file_name: fileName
      });

      if (verifyData?.ok && Number(verifyData?.saved_rows || 0) > 0) {
        return verifyData;
      }
    } catch (err) {
      // ignore and retry
    }

    await sleep(waitMs);
  }

  return null;
}

async function uploadCsv() {
  const uploadMonth = uploadMonthInput?.value?.trim() || "";
  const uploadedBy = uploadedByInput?.value?.trim() || "ADMIN";
  const file = csvFileInput?.files?.[0];

  if (!uploadMonth) {
    alert("Please select upload month");
    return;
  }

  if (!file) {
    alert("Please choose a CSV file first");
    return;
  }

  if (!isRealCsvFile(file)) {
    resultBox.textContent = "❌ Upload failed\n\nPlease upload a real .csv file only.";
    return;
  }

  uploadBtn.disabled = true;
  uploadBtn.textContent = "Uploading...";
  resultBox.textContent = "Sending to backend... please wait.";

  try {
    const csvText = await readFileAsText(file);

    let uploadData = null;
    let uploadErr = null;

    try {
      uploadData = await postJson({
        action: "importScheduleCsv",
        upload_month: uploadMonth,
        uploaded_by: uploadedBy,
        file_name: file.name,
        csv_text: csvText
      });
    } catch (err) {
      uploadErr = err;
    }

    if (uploadData?.ok) {
      resultBox.textContent = "✅ Upload successful\n\n" + JSON.stringify(uploadData, null, 2);
      await refreshPerformanceArea();
      return;
    }

    const uploadErrMsg = String(uploadErr?.message || "");
    const uploadDataErrMsg =
      String(uploadData?.error || "") + " " +
      String(uploadData?.message || "") + " " +
      String(uploadData?.status || "") + " " +
      String(uploadData?.http_code || "");

    const combinedErrMsg = (uploadErrMsg + " " + uploadDataErrMsg).toLowerCase();

    if (!uploadData || looksLikeTimeoutError(combinedErrMsg)) {
      resultBox.textContent =
        "Upload timed out or returned no final response.\n" +
        "Checking whether rows were still saved...";

      const verifyData = await pollUploadVerification(uploadMonth, file.name, 20, 3000);

      if (verifyData?.ok && Number(verifyData?.saved_rows || 0) > 0) {
        resultBox.textContent =
          "✅ Upload completed successfully after timeout check\n\n" +
          JSON.stringify({
            ok: true,
            message: "Upload completed successfully after timeout check.",
            upload_month: verifyData.upload_month || uploadMonth,
            file_name: verifyData.file_name || file.name,
            batch_id: verifyData.batch_id || "",
            saved_rows: verifyData.saved_rows || 0
          }, null, 2);

        await refreshPerformanceArea();
        return;
      }
    }

    if (uploadData) {
      resultBox.textContent =
        "❌ Upload failed\n\n" +
        JSON.stringify(uploadData, null, 2) +
        "\n\nIf this shows error code 524, the request timed out before the final response came back.";
    } else {
      resultBox.textContent = "❌ Upload failed\n\n" + (uploadErr?.message || "Upload failed");
    }
  } catch (err) {
    resultBox.textContent = "❌ Upload failed\n\n" + (err?.message || err);
  } finally {
    uploadBtn.disabled = false;
    uploadBtn.textContent = "Upload Schedule CSV";
  }
}

function logoutAdmin() {
  localStorage.removeItem("staffPortalAdmin");
  window.location.href = "index.html";
}

function escapeHtml(value) {
  return String(value == null ? "" : value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function toNum(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function fmtScore(value) {
  return toNum(value, 0).toFixed(2);
}

function getRatingClass(label) {
  const x = String(label || "").toLowerCase();
  if (x.includes("crucial")) return "rating-highest";
  if (x.includes("independent")) return "rating-high";
  if (x.includes("extra effort")) return "rating-mid";
  if (x.includes("meet")) return "rating-ok";
  return "rating-low";
}

function ensurePerformanceUi() {
  if (document.getElementById("performanceWrap")) return;

  const page = document.querySelector(".card");
  if (!page) return;

  const wrap = document.createElement("div");
  wrap.id = "performanceWrap";
  wrap.innerHTML = `
    <style>
      #performanceWrap .admin-section{margin-top:18px}
      #performanceWrap .grid-3{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px}
      #performanceWrap .grid-4{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:14px}
      #performanceWrap .two-col{display:grid;grid-template-columns:minmax(0,1.5fr) minmax(320px,0.95fr);gap:18px}
      #performanceWrap .toolbar{display:flex;gap:12px;flex-wrap:wrap;align-items:end}
      #performanceWrap .toolbar .field{flex:0 0 auto}
      #performanceWrap .toolbar .field.wide{min-width:260px;flex:1 1 260px}
      #performanceWrap .score-card{
        border:1px solid #dbe4f0;
        border-radius:16px;
        padding:16px;
        background:#ffffff;
        box-shadow:0 2px 10px rgba(15,23,42,.04)
      }
      #performanceWrap .score-card .label{
        display:block;
        font-size:13px;
        color:#6b7280;
        margin-bottom:8px;
        font-weight:600
      }
      #performanceWrap .score-card strong{
        font-size:18px;
        line-height:1.15;
        color:#0f172a
      }
      #performanceWrap .mini-note{
        font-size:12px;
        color:#475569;
        margin-top:8px;
        line-height:1.45
      }
      #performanceWrap .table-wrap{
        overflow:auto;
        border:1px solid #dbe4f0;
        border-radius:16px;
        background:#fff
      }
      #performanceWrap table{
        width:100%;
        border-collapse:collapse;
        min-width:760px
      }
      #performanceWrap th,
      #performanceWrap td{
        padding:12px 14px;
        border-bottom:1px solid #eef2f7;
        text-align:left;
        font-size:14px;
        vertical-align:top;
        color:#1f2937
      }
      #performanceWrap th{
        position:sticky;
        top:0;
        background:#f8fbff;
        z-index:1;
        font-weight:800;
        color:#0f172a
      }
      #performanceWrap .row-actions{
        display:flex;
        gap:8px;
        flex-wrap:wrap
      }
      #performanceWrap .small-btn{
        padding:9px 13px;
        border:0;
        border-radius:12px;
        cursor:pointer;
        font-weight:700
      }
      #performanceWrap .ghost-btn{
        background:#e9efff;
        color:#3346b4
      }
      #performanceWrap .save-btn{
        background:#0f1838;
        color:#fff
      }
      #performanceWrap .secondary-btn{
        background:#eef2f7;
        color:#0f172a
      }
      #performanceWrap .field label{
        display:block;
        font-size:13px;
        font-weight:800;
        color:#0f172a;
        margin-bottom:8px;
        line-height:1.35;
        white-space:normal;
        word-break:break-word
      }
      #performanceWrap input[type="text"],
      #performanceWrap input[type="number"],
      #performanceWrap input[type="month"],
      #performanceWrap select{
        width:100%;
        padding:11px 12px;
        border:1px solid #cfd8e3;
        border-radius:12px;
        background:#fff;
        color:#111827;
        font-size:14px
      }
      #performanceWrap .kpi-grid{
        display:grid;
        grid-template-columns:repeat(3,minmax(0,1fr));
        gap:12px;
        margin-top:4px
      }
      #performanceWrap .kpi-grid .field{
        min-width:0
      }
      #performanceWrap .kpi-grid .field label{
        min-height:38px
      }
      #performanceWrap .rating-chip{
        display:inline-flex;
        align-items:center;
        justify-content:center;
        padding:6px 12px;
        border-radius:999px;
        font-size:12px;
        font-weight:800;
        line-height:1.2;
        color:#0f172a
      }
      #performanceWrap .rating-highest{background:#dcfce7;color:#166534}
      #performanceWrap .rating-high{background:#dbeafe;color:#1d4ed8}
      #performanceWrap .rating-mid{background:#fef3c7;color:#92400e}
      #performanceWrap .rating-ok{background:#ede9fe;color:#5b21b6}
      #performanceWrap .rating-low{background:#fee2e2;color:#b91c1c}
      #performanceWrap .leader-name{
        font-weight:800;
        color:#0f172a
      }
      #performanceWrap .leader-sub{
        font-size:12px;
        color:#64748b;
        margin-top:2px
      }
      #performanceWrap pre{
        white-space:pre-wrap;
        word-break:break-word;
        background:#fff;
        border:1px solid #e5e7eb;
        border-radius:14px;
        padding:12px;
        color:#0f172a
      }
      @media (max-width: 1100px){
        #performanceWrap .two-col{grid-template-columns:1fr}
      }
      @media (max-width: 920px){
        #performanceWrap .grid-4{grid-template-columns:repeat(2,minmax(0,1fr))}
        #performanceWrap .kpi-grid{grid-template-columns:repeat(2,minmax(0,1fr))}
      }
      @media (max-width: 640px){
        #performanceWrap .grid-3,
        #performanceWrap .grid-4,
        #performanceWrap .kpi-grid{
          grid-template-columns:1fr
        }
      }
    </style>

    <div class="panel admin-section">
      <div class="panel-title-row">
        <h3>Performance Dashboard</h3>
      </div>

      <div class="toolbar">
        <div class="field">
          <label for="dashboardMonth">Score Month</label>
          <input type="month" id="dashboardMonth" />
        </div>
        <div class="field">
          <button type="button" class="small-btn secondary-btn" id="refreshDashboardBtn">Refresh Dashboard</button>
        </div>
        <div class="field wide">
          <label for="staffSearchInput">Quick Search</label>
          <input type="text" id="staffSearchInput" placeholder="Search by name / login id / team" />
        </div>
      </div>

      <div class="grid-4 admin-section" id="topSummaryCards">
        <div class="score-card"><span class="label">Staff Count</span><strong id="sumStaffCount">0</strong></div>
        <div class="score-card"><span class="label">Average Attendance</span><strong id="sumAttendanceAvg">0.00</strong></div>
        <div class="score-card"><span class="label">Average KPI</span><strong id="sumKpiAvg">0.00</strong></div>
        <div class="score-card"><span class="label">Average Final Score</span><strong id="sumFinalAvg">0.00</strong></div>
      </div>

      <div class="two-col admin-section">
        <div class="panel" style="margin:0">
          <div class="panel-title-row">
            <h3>Monthly Leaderboard</h3>
            <span class="mini-pill" id="leaderboardMonthTag">-</span>
          </div>
          <div class="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Rank</th>
                  <th>Staff</th>
                  <th>Team</th>
                  <th>Attendance</th>
                  <th>KPI</th>
                  <th>Final</th>
                  <th>Rating</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody id="leaderboardBody">
                <tr><td colspan="8">Loading...</td></tr>
              </tbody>
            </table>
          </div>
        </div>

        <div class="panel" style="margin:0">
          <div class="panel-title-row">
            <h3>Admin KPI Input</h3>
          </div>

          <div class="field">
            <label for="kpiStaffSelect">Select Staff</label>
            <select id="kpiStaffSelect"></select>
          </div>

          <div class="kpi-grid">
            <div class="field">
              <label for="kpiLeadership">L_Leadership</label>
              <input type="number" id="kpiLeadership" min="0" max="5" step="0.1" value="0" />
            </div>
            <div class="field">
              <label for="kpiEffectiveness">E_Effectiveness</label>
              <input type="number" id="kpiEffectiveness" min="0" max="5" step="0.1" value="0" />
            </div>
            <div class="field">
              <label for="kpiProblemSolving">P_ProblemSolving</label>
              <input type="number" id="kpiProblemSolving" min="0" max="5" step="0.1" value="0" />
            </div>
            <div class="field">
              <label for="kpiCommunication">C_Communication</label>
              <input type="number" id="kpiCommunication" min="0" max="5" step="0.1" value="0" />
            </div>
            <div class="field">
              <label for="kpiProductivity">PR_Productivity</label>
              <input type="number" id="kpiProductivity" min="0" max="5" step="0.1" value="0" />
            </div>
            <div class="field">
              <label for="kpiInitiative">I_Initiative</label>
              <input type="number" id="kpiInitiative" min="0" max="5" step="0.1" value="0" />
            </div>
            <div class="field">
              <label for="kpiPenalty">Penalty</label>
              <input type="number" id="kpiPenalty" min="0" step="0.1" value="0" />
            </div>
            <div class="field">
              <label for="kpiMonthInput">KPI Month</label>
              <input type="month" id="kpiMonthInput" />
            </div>
          </div>

          <div class="row-actions admin-section">
            <button type="button" class="small-btn save-btn" id="saveKpiBtn">Save KPI</button>
            <button type="button" class="small-btn ghost-btn" id="loadSelectedKpiBtn">Load Selected</button>
            <button type="button" class="small-btn secondary-btn" id="resetKpiBtn">Reset Form</button>
          </div>

          <div class="mini-note">
            Attendance score = 40%, KPI score = 60%, final score shown out of 5.
          </div>

          <div class="panel admin-section" style="margin-bottom:0">
            <div class="panel-title-row">
              <h3>Selected Staff Preview</h3>
            </div>
            <pre id="kpiPreviewBox">Select a staff to view score details.</pre>
          </div>
        </div>
      </div>
    </div>
  `;

  page.appendChild(wrap);

  document.getElementById("refreshDashboardBtn")?.addEventListener("click", refreshPerformanceArea);
  document.getElementById("saveKpiBtn")?.addEventListener("click", saveKpiForm);
  document.getElementById("resetKpiBtn")?.addEventListener("click", resetKpiForm);
  document.getElementById("loadSelectedKpiBtn")?.addEventListener("click", loadSelectedStaffIntoForm);
  document.getElementById("kpiStaffSelect")?.addEventListener("change", loadSelectedStaffIntoForm);
  document.getElementById("staffSearchInput")?.addEventListener("input", renderLeaderboardTable);
}

function getMonthValue() {
  return (
    document.getElementById("dashboardMonth")?.value?.trim() ||
    uploadMonthInput?.value?.trim() ||
    new Date().toISOString().slice(0, 7)
  );
}

function setMonthDefaults() {
  const fallbackMonth = uploadMonthInput?.value?.trim() || new Date().toISOString().slice(0, 7);
  const dashboardMonthInput = document.getElementById("dashboardMonth");
  const kpiMonthInput = document.getElementById("kpiMonthInput");

  if (dashboardMonthInput && !dashboardMonthInput.value) dashboardMonthInput.value = fallbackMonth;
  if (kpiMonthInput && !kpiMonthInput.value) kpiMonthInput.value = fallbackMonth;
}

function renderSummaryCards(data) {
  const staffCount = data.length;
  const attendanceAvg = staffCount ? data.reduce((a, x) => a + toNum(x.attendance_score), 0) / staffCount : 0;
  const kpiAvg = staffCount ? data.reduce((a, x) => a + toNum(x.kpi_score), 0) / staffCount : 0;
  const finalAvg = staffCount ? data.reduce((a, x) => a + toNum(x.final_score), 0) / staffCount : 0;

  const ids = {
    sumStaffCount: staffCount,
    sumAttendanceAvg: fmtScore(attendanceAvg),
    sumKpiAvg: fmtScore(kpiAvg),
    sumFinalAvg: fmtScore(finalAvg)
  };

  Object.keys(ids).forEach(id => {
    const node = document.getElementById(id);
    if (node) node.textContent = ids[id];
  });
}

function buildRowActionButtons(item) {
  return `
    <button type="button" class="small-btn ghost-btn pick-staff-btn" data-staff-id="${escapeHtml(item.staff_id)}">Use</button>
  `;
}

function renderLeaderboardTable() {
  const tbody = document.getElementById("leaderboardBody");
  const searchValue = String(document.getElementById("staffSearchInput")?.value || "").trim().toLowerCase();

  if (!tbody) return;

  const filtered = dashboardData.filter(item => {
    if (!searchValue) return true;
    return [
      item.full_name,
      item.login_id,
      item.team,
      item.staff_id,
      item.role
    ].join(" ").toLowerCase().includes(searchValue);
  });

  if (!filtered.length) {
    tbody.innerHTML = `<tr><td colspan="8">No matching staff found.</td></tr>`;
    return;
  }

  tbody.innerHTML = filtered.map(item => `
    <tr>
      <td>${item.rank || "-"}</td>
      <td>
        <div class="leader-name">${escapeHtml(item.full_name || "-")}</div>
        <div class="leader-sub">${escapeHtml(item.login_id || item.staff_id || "-")}</div>
      </td>
      <td>${escapeHtml(item.team || "-")}</td>
      <td>${fmtScore(item.attendance_score)}</td>
      <td>${fmtScore(item.kpi_score)}</td>
      <td><strong>${fmtScore(item.final_score)}</strong></td>
      <td><span class="rating-chip ${getRatingClass(item.rating_label)}">${escapeHtml(item.rating_label || "-")}</span></td>
      <td>${buildRowActionButtons(item)}</td>
    </tr>
  `).join("");

  tbody.querySelectorAll(".pick-staff-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      const select = document.getElementById("kpiStaffSelect");
      if (!select) return;
      select.value = btn.dataset.staffId || "";
      loadSelectedStaffIntoForm();
      window.scrollTo({ top: document.body.scrollHeight * 0.4, behavior: "smooth" });
    });
  });
}

function fillStaffSelect(data) {
  const select = document.getElementById("kpiStaffSelect");
  if (!select) return;

  const current = select.value;
  const options = data.map(item => {
    const text = `${item.full_name || "-"} | ${item.team || "-"} | ${item.login_id || item.staff_id || "-"}`;
    return `<option value="${escapeHtml(item.staff_id)}">${escapeHtml(text)}</option>`;
  }).join("");

  select.innerHTML = `<option value="">Select staff</option>${options}`;

  if (current && data.some(x => String(x.staff_id) === String(current))) {
    select.value = current;
  }
}

function setInputValue(id, value) {
  const node = document.getElementById(id);
  if (node) node.value = value == null ? "" : String(value);
}

function resetKpiForm() {
  setInputValue("kpiLeadership", 0);
  setInputValue("kpiEffectiveness", 0);
  setInputValue("kpiProblemSolving", 0);
  setInputValue("kpiCommunication", 0);
  setInputValue("kpiProductivity", 0);
  setInputValue("kpiInitiative", 0);
  setInputValue("kpiPenalty", 0);
  const preview = document.getElementById("kpiPreviewBox");
  if (preview) preview.textContent = "Select a staff to view score details.";
}

function fillKpiFormFromItem(item) {
  const details = item?.kpi_details || {};
  setInputValue("kpiLeadership", details.L_Leadership ?? details.leadership ?? 0);
  setInputValue("kpiEffectiveness", details.E_Effectiveness ?? details.effectiveness ?? 0);
  setInputValue("kpiProblemSolving", details.P_ProblemSolving ?? details.problem_solving ?? 0);
  setInputValue("kpiCommunication", details.C_Communication ?? details.communication ?? 0);
  setInputValue("kpiProductivity", details.PR_Productivity ?? details.productivity ?? 0);
  setInputValue("kpiInitiative", details.I_Initiative ?? details.initiative ?? 0);
  setInputValue("kpiPenalty", details.Penalty ?? details.penalty ?? 0);
}

function renderPreview(item) {
  const preview = document.getElementById("kpiPreviewBox");
  if (!preview) return;

  if (!item) {
    preview.textContent = "Selected staff not found in current dashboard.";
    return;
  }

  preview.textContent = JSON.stringify({
    staff_id: item.staff_id,
    full_name: item.full_name,
    login_id: item.login_id,
    team: item.team,
    attendance_score: item.attendance_score,
    kpi_score: item.kpi_score,
    final_score: item.final_score,
    rating_label: item.rating_label,
    attendance_details: item.attendance_details,
    kpi_details: item.kpi_details
  }, null, 2);
}

function getSelectedDashboardItem() {
  const staffId = document.getElementById("kpiStaffSelect")?.value || "";
  if (!staffId) return null;
  return dashboardData.find(item => String(item.staff_id) === String(staffId)) || null;
}

function loadSelectedStaffIntoForm() {
  const item = getSelectedDashboardItem();
  fillKpiFormFromItem(item);
  renderPreview(item);
}

async function refreshPerformanceArea() {
  ensurePerformanceUi();
  setMonthDefaults();

  const month = getMonthValue();
  dashboardMonth = month;

  const monthTag = document.getElementById("leaderboardMonthTag");
  const body = document.getElementById("leaderboardBody");
  if (monthTag) monthTag.textContent = month || "-";
  if (body) body.innerHTML = `<tr><td colspan="8">Loading dashboard...</td></tr>`;

  try {
    const data = await getJson(`${API_BASE}?action=adminKpiDashboard&month=${encodeURIComponent(month)}`);
    if (!data?.ok) {
      throw new Error(data?.error || "Failed to load admin KPI dashboard");
    }

    dashboardData = Array.isArray(data.data) ? data.data : [];
    renderSummaryCards(dashboardData);
    fillStaffSelect(dashboardData);
    renderLeaderboardTable();

    const currentSelected = getSelectedDashboardItem();
    if (currentSelected) {
      fillKpiFormFromItem(currentSelected);
      renderPreview(currentSelected);
    }
  } catch (err) {
    dashboardData = [];
    renderSummaryCards([]);
    if (body) body.innerHTML = `<tr><td colspan="8">ERROR: ${escapeHtml(err?.message || err)}</td></tr>`;
  }
}

function getKpiPayload() {
  return {
    action: "saveKpiScore",
    staff_id: document.getElementById("kpiStaffSelect")?.value || "",
    month: document.getElementById("kpiMonthInput")?.value?.trim() || dashboardMonth || getMonthValue(),
    L_Leadership: document.getElementById("kpiLeadership")?.value || 0,
    E_Effectiveness: document.getElementById("kpiEffectiveness")?.value || 0,
    P_ProblemSolving: document.getElementById("kpiProblemSolving")?.value || 0,
    C_Communication: document.getElementById("kpiCommunication")?.value || 0,
    PR_Productivity: document.getElementById("kpiProductivity")?.value || 0,
    I_Initiative: document.getElementById("kpiInitiative")?.value || 0,
    Penalty: document.getElementById("kpiPenalty")?.value || 0,
    updated_by: getAdminLoginId(),
    admin_login_id: getAdminLoginId()
  };
}

async function saveKpiForm() {
  const payload = getKpiPayload();
  const preview = document.getElementById("kpiPreviewBox");

  if (!payload.staff_id) {
    alert("Please select staff first");
    return;
  }

  if (!payload.month) {
    alert("Please select KPI month");
    return;
  }

  if (preview) preview.textContent = "Saving KPI score...";

  try {
    const data = await postJson(payload);
    if (!data?.ok) {
      throw new Error(data?.error || "Failed to save KPI");
    }

    if (preview) preview.textContent = JSON.stringify(data, null, 2);
    resultBox.textContent = JSON.stringify(data, null, 2);

    if (document.getElementById("dashboardMonth")) {
      document.getElementById("dashboardMonth").value = payload.month;
    }

    await refreshPerformanceArea();

    const select = document.getElementById("kpiStaffSelect");
    if (select) {
      select.value = payload.staff_id;
      loadSelectedStaffIntoForm();
    }
  } catch (err) {
    const message = err?.message || String(err);
    if (preview) preview.textContent = "ERROR:\n" + message;
    resultBox.textContent = "ERROR:\n" + message;
  }
}

if (requireAdminSession()) {
  uploadBtn?.addEventListener("click", uploadCsv);
  adminLogoutBtn?.addEventListener("click", logoutAdmin);
  checkApi();
  ensurePerformanceUi();
  setMonthDefaults();
  refreshPerformanceArea();
}
