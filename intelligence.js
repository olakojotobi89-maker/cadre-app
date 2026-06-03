// ============================================================
// CADRE INTELLIGENCE — FULL ENGINE v2
// ============================================================
// Tables expected in Supabase:
//   intelligence_cases        (id, title, status, priority, description, created_at)
//   intelligence_evidence     (id, case_id, name, type, notes, file_url, file_data, collector, date_collected, created_at)
//   intelligence_activity_log (id, case_id, action, actor, notes, created_at)
//   intelligence_officers     (id, name, badge, rank, state, unit, status, notes, created_at)
//   intelligence_operations   (id, case_id, name, status, date, location, officers, report, created_at)
// ============================================================

const CADRE_SUPABASE_URL = "https://ihroattnnnsckvvbosfz.supabase.co";
const CADRE_SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imlocm9hdHRubm5zY2t2dmJvc2Z6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk3MDE2MTksImV4cCI6MjA5NTI3NzYxOX0.yAj6veGjl-ZRtpGBx7ka6L05mdBsIVQNjji8hEi-Jcs";

const sbClient = window.supabase.createClient(CADRE_SUPABASE_URL, CADRE_SUPABASE_KEY, {
    auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false
    },
    global: {
        headers: {
            'apikey': CADRE_SUPABASE_KEY,
            'Authorization': `Bearer ${CADRE_SUPABASE_KEY}`
        }
    }
});

// ── ADMIN PASSWORD ──────────────────────────────────────────
const ADMIN_PASSWORD = "CDR123";

// ── STATE ───────────────────────────────────────────────────
const state = {
    currentUser: null,
    cases: [],
    filteredCases: [],
    selectedCase: null,
    officers: [],
    filteredOfficers: [],
    operations: [],
    filteredOps: [],
    evidence: [],
    filteredEvidence: [],
    selectedEvidence: null,
    // pending admin delete action
    pendingDelete: null,   // { type: 'case'|'officer'|'op'|'evidence', id: ... }
    // selected file for upload
    selectedFile: null,
    selectedFileDataUrl: null
};

// ── UTILITIES ───────────────────────────────────────────────

function esc(v) {
    return String(v ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function formatDate(v) {
    if (!v) return "—";
    const d = new Date(v);
    return isNaN(d.getTime()) ? v : d.toLocaleString();
}

function toast(msg, type = "") {
    const el = document.getElementById("toast");
    el.textContent = msg;
    el.className = "show " + type;
    clearTimeout(window._toastTimer);
    window._toastTimer = setTimeout(() => el.className = "", 3500);
}

function logErr(label, err) {
    console.error(`[Intelligence] ${label}:`, err?.message, err?.code, err?.hint);
}

// ── CLOCK ───────────────────────────────────────────────────
function startClock() {
    function tick() {
        const now = new Date();
        document.getElementById("clockDisplay").textContent =
            now.toLocaleTimeString("en-GB") + " | SECURE";
    }
    tick();
    setInterval(tick, 1000);
}

// ── TABS ────────────────────────────────────────────────────
function switchTab(tab) {
    document.querySelectorAll(".view").forEach(v => v.classList.remove("active"));
    document.querySelectorAll(".nav-tab").forEach(t => t.classList.remove("active"));
    document.getElementById("tab-" + tab).classList.add("active");
    document.querySelectorAll(".nav-tab").forEach(t => {
        if (t.textContent.toLowerCase().includes(tab)) t.classList.add("active");
    });
    if (tab === "officers") renderOfficers();
    if (tab === "operations") renderOps();
    if (tab === "evidence") renderEvidenceList();
}

// ── MODALS ──────────────────────────────────────────────────
function openModal(id) {
    document.getElementById(id).classList.add("open");
    if (id === "uploadEvidenceModal") populateCaseLinkDropdown("ev_caseLink");
    if (id === "newOpModal") populateCaseLinkDropdown("op_caseLink");
}

function closeModal(id) {
    document.getElementById(id).classList.remove("open");
    if (id === "passwordModal") {
        document.getElementById("adminPwdInput").value = "";
        document.getElementById("pwdError").style.display = "none";
        state.pendingDelete = null;
    }
}

function populateCaseLinkDropdown(selectId) {
    const sel = document.getElementById(selectId);
    if (!sel) return;
    // keep first "none" option
    while (sel.options.length > 1) sel.remove(1);
    state.cases.forEach(c => {
        const opt = document.createElement("option");
        opt.value = c.id;
        opt.textContent = c.title || "Untitled Case";
        sel.appendChild(opt);
    });
}

// ── AUTH ────────────────────────────────────────────────────
async function requireSession() {
    const { data, error } = await sbClient.auth.getSession();
    if (error || !data.session?.user) {
        // Allow unauthenticated access for local/offline use; just log warning
        console.warn("[Intelligence] No authenticated session — running in guest mode.");
        return true;
    }
    state.currentUser = data.session.user;
    return true;
}

// ── CASES ───────────────────────────────────────────────────
async function loadCases() {
    const { data, error } = await sbClient
        .from("intelligence_cases")
        .select("*")
        .order("created_at", { ascending: false });

    if (error) {
        logErr("loadCases", error);
        document.getElementById("caseList").innerHTML =
            `<div class="card card-meta" style="color:var(--red)">⚠ Could not load cases. Check Supabase table "intelligence_cases" and RLS.</div>`;
        return;
    }
    state.cases = Array.isArray(data) ? data : [];
    applyCaseFilters();
}

function applyCaseFilters() {
    const q = (document.getElementById("searchBox")?.value || "").toLowerCase();
    const st = document.getElementById("statusFilter")?.value || "all";
    const pr = document.getElementById("priorityFilter")?.value || "all";
    state.filteredCases = state.cases.filter(c =>
        (c.title || "").toLowerCase().includes(q) &&
        (st === "all" || (c.status || "").toLowerCase() === st) &&
        (pr === "all" || (c.priority || "").toLowerCase() === pr)
    );
    renderCases();
}

function renderCases() {
    const el = document.getElementById("caseList");
    if (!el) return;
    if (!state.filteredCases.length) {
        el.innerHTML = `<div class="empty-state"><div class="empty-icon">📂</div>No cases match filters.</div>`;
        return;
    }
    el.innerHTML = state.filteredCases.map(c => {
        const isActive = state.selectedCase?.id === c.id;
        const badgeClass = c.status === "active" ? "badge-active" : c.status === "open" ? "badge-open" : "badge-closed";
        return `
        <div class="card case-item ${isActive ? "selected" : ""}" style="cursor:pointer" onclick="openCase('${esc(c.id)}')">
            <div style="display:flex;justify-content:space-between;align-items:flex-start;">
                <div class="card-title">${esc(c.title || "Untitled Case")}</div>
                <span class="badge ${badgeClass}">${esc(c.status || "?")}</span>
            </div>
            <div class="card-meta">
                <span class="badge-${esc(c.priority || 'low')}">● ${esc(c.priority || "—")}</span>
                <span>${formatDate(c.created_at)}</span>
            </div>
        </div>`;
    }).join("");
}

async function openCase(id) {
    const caseItem = state.cases.find(c => c.id === id);
    if (!caseItem) return;
    state.selectedCase = caseItem;
    renderCases();
    renderCaseDetail(caseItem);
    await Promise.all([loadCaseEvidence(id), loadActivity(id)]);
}

function renderCaseDetail(c) {
    const el = document.getElementById("caseDetail");
    if (!el) return;
    const badgeClass = c.status === "active" ? "badge-active" : c.status === "open" ? "badge-open" : "badge-closed";
    el.innerHTML = `
        <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:12px;">
            <h2 style="font-family:Orbitron,monospace;font-size:15px;color:var(--text)">${esc(c.title || "Untitled")}</h2>
            <div style="display:flex;gap:6px;">
                <span class="badge ${badgeClass}">${esc(c.status || "?")}</span>
                <button class="btn btn-danger btn-sm" onclick="requestDelete('case','${esc(c.id)}')">Delete</button>
            </div>
        </div>
        <div class="card-meta" style="margin-bottom:12px;">
            <span>ID: ${esc(c.id)}</span>
            <span>Priority: <span class="badge-${esc(c.priority || 'low')}">${esc(c.priority || "—")}</span></span>
            <span>Created: ${formatDate(c.created_at)}</span>
        </div>
        <hr class="divider">
        <p style="font-size:14px;line-height:1.7;white-space:pre-wrap">${esc(c.description || c.summary || "No description.")}</p>
    `;
}

async function submitNewCase() {
    const title = document.getElementById("nc_title").value.trim();
    if (!title) { toast("Case title is required.", "error"); return; }

    const payload = {
        title,
        status: document.getElementById("nc_status").value,
        priority: document.getElementById("nc_priority").value,
        description: document.getElementById("nc_desc").value.trim()
    };

    const { data, error } = await sbClient.from("intelligence_cases").insert([payload]).select();
    if (error) { logErr("submitNewCase", error); toast("Failed to create case: " + error.message, "error"); return; }

    state.cases.unshift(data[0]);
    applyCaseFilters();
    closeModal("newCaseModal");
    clearFields(["nc_title", "nc_desc"]);
    toast("Case created successfully.", "success");
    openCase(data[0].id);
}

// ── EVIDENCE (right panel) ──────────────────────────────────
async function loadCaseEvidence(caseId) {
    const panel = document.getElementById("evidencePanel");
    panel.innerHTML = `<div class="card card-meta">Loading…</div>`;
    const { data, error } = await sbClient
        .from("intelligence_evidence")
        .select("*")
        .eq("case_id", caseId)
        .order("created_at", { ascending: false });

    if (error) { logErr("loadCaseEvidence", error); panel.innerHTML = `<div class="card card-meta" style="color:var(--red)">Error loading evidence.</div>`; return; }

    if (!data?.length) { panel.innerHTML = `<div class="card card-meta">No evidence linked.</div>`; return; }

    panel.innerHTML = data.map(e => `
        <div class="card" style="cursor:pointer" onclick="switchTab('evidence')">
            <div style="font-size:13px;font-weight:600">${fileIcon(e.type)} ${esc(e.name || "Evidence")}</div>
            <div class="card-meta">${esc(e.type || "—")} • ${formatDate(e.created_at)}</div>
            <div style="font-size:12px;color:#999;margin-top:3px">${esc((e.notes || "").substring(0, 80))}…</div>
        </div>
    `).join("");
}

// ── ACTIVITY LOG ────────────────────────────────────────────
async function loadActivity(caseId) {
    const panel = document.getElementById("activityPanel");
    panel.innerHTML = `<div class="card card-meta">Loading…</div>`;
    const { data, error } = await sbClient
        .from("intelligence_activity_log")
        .select("*")
        .eq("case_id", caseId)
        .order("created_at", { ascending: false });

    if (error) { panel.innerHTML = `<div class="card card-meta" style="color:var(--red)">Error loading log.</div>`; return; }
    if (!data?.length) { panel.innerHTML = `<div class="card card-meta">No activity recorded.</div>`; return; }

    panel.innerHTML = data.map(l => `
        <div class="card">
            <div style="font-size:13px">${esc(l.action || l.message || "Activity")}</div>
            <div class="card-meta">${esc(l.actor || l.user_name || "System")} | ${formatDate(l.created_at)}</div>
            ${l.notes ? `<div style="font-size:12px;color:#888;margin-top:3px">${esc(l.notes)}</div>` : ""}
        </div>
    `).join("");
}

// ── EVIDENCE FULL TAB ───────────────────────────────────────
async function loadAllEvidence() {
    const { data, error } = await sbClient
        .from("intelligence_evidence")
        .select("*")
        .order("created_at", { ascending: false });

    if (error) { logErr("loadAllEvidence", error); return; }
    state.evidence = Array.isArray(data) ? data : [];
    renderEvidenceList();
}

function renderEvidenceList() {
    const el = document.getElementById("evidenceListCol");
    if (!state.evidence.length) {
        el.innerHTML = `<div class="empty-state"><div class="empty-icon">🗂️</div>No evidence on file.</div>`;
        return;
    }
    el.innerHTML = state.evidence.map(e => `
        <div class="card ${state.selectedEvidence?.id === e.id ? "selected" : ""}" style="cursor:pointer" onclick="viewEvidence('${esc(e.id)}')">
            <div style="font-size:14px;font-weight:600">${fileIcon(e.type)} ${esc(e.name || "Evidence")}</div>
            <div class="card-meta">${esc(e.type || "—")} • ${esc(e.collector || "—")}</div>
            <div class="card-meta">${formatDate(e.created_at)}</div>
        </div>
    `).join("");
}

function viewEvidence(id) {
    const ev = state.evidence.find(e => e.id === id);
    if (!ev) return;
    state.selectedEvidence = ev;
    renderEvidenceList();

    const col = document.getElementById("evidenceDetailCol");
    const linkedCase = state.cases.find(c => c.id === ev.case_id);

    let mediaHtml = "";
    const src = ev.file_url || ev.file_data || "";
    if (src) {
        if (ev.type === "image") {
            mediaHtml = `<img src="${esc(src)}" style="max-width:100%;border-radius:3px;margin-bottom:12px;border:1px solid #1a1a1a">`;
        } else if (ev.type === "video") {
            mediaHtml = `<video controls style="max-width:100%;border-radius:3px;margin-bottom:12px"><source src="${esc(src)}"></video>`;
        } else if (ev.type === "audio") {
            mediaHtml = `<audio controls style="width:100%;margin-bottom:12px"><source src="${esc(src)}"></audio>`;
        }
    }

    col.innerHTML = `
        <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:14px;">
            <h2 style="font-family:Orbitron,monospace;font-size:14px;color:var(--text)">${fileIcon(ev.type)} ${esc(ev.name || "Evidence")}</h2>
            <button class="btn btn-danger btn-sm" onclick="requestDelete('evidence','${esc(ev.id)}')">Delete</button>
        </div>
        <div class="card-meta" style="margin-bottom:12px;">
            <span>Type: ${esc(ev.type || "—")}</span>
            <span>Collector: ${esc(ev.collector || "—")}</span>
            <span>Date: ${esc(ev.date_collected || "—")}</span>
            ${linkedCase ? `<span>Case: ${esc(linkedCase.title)}</span>` : ""}
        </div>
        ${mediaHtml}
        <hr class="divider">
        <div style="font-size:13px;font-family:Share Tech Mono,monospace;font-weight:600;color:var(--red);margin-bottom:8px;letter-spacing:1px;">WRITE-UP / NOTES</div>
        <p style="font-size:13px;line-height:1.8;white-space:pre-wrap;color:#ccc">${esc(ev.notes || "No notes recorded.")}</p>
    `;
}

// ── FILE HANDLING ───────────────────────────────────────────
function fileIcon(type) {
    const map = { image: "🖼️", video: "🎬", audio: "🔊", document: "📄", writeup: "📝" };
    return map[type] || "📎";
}

function handleDragOver(e) {
    e.preventDefault();
    document.getElementById("uploadZone").classList.add("dragover");
}

function handleDragLeave(e) {
    document.getElementById("uploadZone").classList.remove("dragover");
}

function handleDrop(e) {
    e.preventDefault();
    document.getElementById("uploadZone").classList.remove("dragover");
    const file = e.dataTransfer.files[0];
    if (file) processFile(file);
}

function handleFileSelect(e) {
    const file = e.target.files[0];
    if (file) processFile(file);
}

function processFile(file) {
    state.selectedFile = file;
    document.getElementById("uploadZoneText").textContent = `✓ ${file.name} (${(file.size / 1024).toFixed(1)} KB)`;

    // Auto-fill type
    const typeEl = document.getElementById("ev_type");
    if (file.type.startsWith("image/")) typeEl.value = "image";
    else if (file.type.startsWith("video/")) typeEl.value = "video";
    else if (file.type.startsWith("audio/")) typeEl.value = "audio";
    else typeEl.value = "document";

    // Preview
    const reader = new FileReader();
    reader.onload = (ev) => {
        state.selectedFileDataUrl = ev.target.result;
        const wrap = document.getElementById("filePreviewWrap");
        let previewHtml = "";
        if (file.type.startsWith("image/")) {
            previewHtml = `<img src="${ev.target.result}" style="max-width:100%;max-height:180px;border-radius:3px;border:1px solid #1a1a1a">`;
        } else if (file.type.startsWith("video/")) {
            previewHtml = `<video controls style="max-width:100%;max-height:180px;border-radius:3px"><source src="${ev.target.result}"></video>`;
        } else if (file.type.startsWith("audio/")) {
            previewHtml = `<audio controls style="width:100%"><source src="${ev.target.result}"></audio>`;
        } else {
            previewHtml = `<div class="card card-meta">📄 File selected: ${esc(file.name)}</div>`;
        }
        wrap.innerHTML = previewHtml;
        wrap.style.display = "block";
    };
    reader.readAsDataURL(file);
}

async function submitEvidence() {
    const name = document.getElementById("ev_name").value.trim();
    const notes = document.getElementById("ev_notes").value.trim();
    if (!name) { toast("Evidence label is required.", "error"); return; }
    if (!notes) { toast("Write-up / notes are required.", "error"); return; }

    const payload = {
        case_id: document.getElementById("ev_caseLink").value || null,
        name,
        type: document.getElementById("ev_type").value,
        notes,
        collector: document.getElementById("ev_collector").value.trim(),
        date_collected: document.getElementById("ev_date").value.trim(),
        // Store file as base64 data URL — works without a storage bucket
        file_data: state.selectedFileDataUrl || null,
        file_name: state.selectedFile?.name || null
    };

    const { data, error } = await sbClient.from("intelligence_evidence").insert([payload]).select();
    if (error) { logErr("submitEvidence", error); toast("Failed to save evidence: " + error.message, "error"); return; }

    state.evidence.unshift(data[0]);
    closeModal("uploadEvidenceModal");
    clearFields(["ev_name", "ev_notes", "ev_collector", "ev_date"]);
    document.getElementById("uploadZoneText").textContent = "Click to browse or drag & drop";
    document.getElementById("filePreviewWrap").style.display = "none";
    state.selectedFile = null;
    state.selectedFileDataUrl = null;
    renderEvidenceList();
    toast("Evidence saved successfully.", "success");
}

// ── OFFICERS ────────────────────────────────────────────────
async function loadOfficers() {
    const { data, error } = await sbClient
        .from("intelligence_officers")
        .select("*")
        .order("created_at", { ascending: false });

    if (error) { logErr("loadOfficers", error); return; }
    state.officers = Array.isArray(data) ? data : [];
    state.filteredOfficers = [...state.officers];

    // Populate state filter
    const states = [...new Set(state.officers.map(o => o.state).filter(Boolean))].sort();
    const stateSelect = document.getElementById("officerStateFilter");
    while (stateSelect.options.length > 1) stateSelect.remove(1);
    states.forEach(s => { const o = document.createElement("option"); o.value = s; o.textContent = s; stateSelect.appendChild(o); });

    // Populate rank filter
    const ranks = [...new Set(state.officers.map(o => o.rank).filter(Boolean))].sort();
    const rankSelect = document.getElementById("officerRankFilter");
    while (rankSelect.options.length > 1) rankSelect.remove(1);
    ranks.forEach(r => { const o = document.createElement("option"); o.value = r; o.textContent = r; rankSelect.appendChild(o); });

    renderOfficers();
}

function filterOfficers() {
    const q = (document.getElementById("officerSearch")?.value || "").toLowerCase();
    const st = document.getElementById("officerStateFilter")?.value || "all";
    const rk = document.getElementById("officerRankFilter")?.value || "all";
    state.filteredOfficers = state.officers.filter(o =>
        (o.name || "").toLowerCase().includes(q) &&
        (st === "all" || (o.state || "") === st) &&
        (rk === "all" || (o.rank || "") === rk)
    );
    renderOfficers();
}

function renderOfficers() {
    const el = document.getElementById("officersTable");
    if (!state.filteredOfficers.length) {
        el.innerHTML = `<div class="empty-state"><div class="empty-icon">👤</div>No officers found.</div>`;
        return;
    }

    const statusBadge = (s) => {
        const map = { active: "badge-open", standby: "badge-medium", suspended: "badge-active", retired: "badge-closed" };
        return `<span class="badge ${map[s] || ""}">${esc(s || "—")}</span>`;
    };

    el.innerHTML = `
        <table class="data-table">
            <thead>
                <tr>
                    <th>Name</th>
                    <th>Badge</th>
                    <th>Rank</th>
                    <th>State</th>
                    <th>Unit</th>
                    <th>Status</th>
                    <th>Notes</th>
                    <th>Action</th>
                </tr>
            </thead>
            <tbody>
                ${state.filteredOfficers.map(o => `
                    <tr>
                        <td><strong>${esc(o.name || "—")}</strong></td>
                        <td style="font-family:Share Tech Mono,monospace">${esc(o.badge || "—")}</td>
                        <td>${esc(o.rank || "—")}</td>
                        <td>${esc(o.state || "—")}</td>
                        <td>${esc(o.unit || "—")}</td>
                        <td>${statusBadge(o.status)}</td>
                        <td style="max-width:180px;font-size:12px;color:#888">${esc((o.notes || "").substring(0, 80))}</td>
                        <td>
                            <button class="btn btn-danger btn-sm" onclick="requestDelete('officer','${esc(o.id)}')">Delete</button>
                        </td>
                    </tr>
                `).join("")}
            </tbody>
        </table>
    `;
}

async function submitOfficer() {
    const name = document.getElementById("of_name").value.trim();
    const rank = document.getElementById("of_rank").value.trim();
    const st = document.getElementById("of_state").value.trim();
    if (!name || !rank || !st) { toast("Name, rank, and state are required.", "error"); return; }

    const payload = {
        name,
        badge: document.getElementById("of_badge").value.trim(),
        rank,
        state: st,
        unit: document.getElementById("of_unit").value.trim(),
        status: document.getElementById("of_status").value,
        notes: document.getElementById("of_notes").value.trim()
    };

    const { data, error } = await sbClient.from("intelligence_officers").insert([payload]).select();
    if (error) { logErr("submitOfficer", error); toast("Failed to add officer: " + error.message, "error"); return; }

    state.officers.unshift(data[0]);
    state.filteredOfficers = [...state.officers];
    closeModal("newOfficerModal");
    clearFields(["of_name", "of_badge", "of_rank", "of_state", "of_unit", "of_notes"]);
    renderOfficers();
    toast("Officer added to registry.", "success");
}

// ── OPERATIONS ──────────────────────────────────────────────
async function loadOperations() {
    const { data, error } = await sbClient
        .from("intelligence_operations")
        .select("*")
        .order("created_at", { ascending: false });

    if (error) { logErr("loadOperations", error); return; }
    state.operations = Array.isArray(data) ? data : [];
    state.filteredOps = [...state.operations];
    renderOps();
}

function filterOps() {
    const q = (document.getElementById("opSearch")?.value || "").toLowerCase();
    const st = document.getElementById("opStatusFilter")?.value || "all";
    state.filteredOps = state.operations.filter(o =>
        (o.name || "").toLowerCase().includes(q) &&
        (st === "all" || (o.status || "").toLowerCase() === st)
    );
    renderOps();
}

function renderOps() {
    const el = document.getElementById("operationsList");
    if (!state.filteredOps.length) {
        el.innerHTML = `<div class="empty-state"><div class="empty-icon">🎯</div>No operations logged.</div>`;
        return;
    }

    const opColor = { successful: "var(--green)", ongoing: "var(--amber)", failed: "var(--red)", cancelled: "#555" };
    el.innerHTML = state.filteredOps.map(op => {
        const color = opColor[op.status] || "#aaa";
        const linkedCase = state.cases.find(c => c.id === op.case_id);
        return `
            <div class="card" style="border-left: 3px solid ${color};padding-left:12px;">
                <div style="display:flex;justify-content:space-between;align-items:flex-start;">
                    <div class="op-title">${esc(op.name || "Unnamed Operation")}</div>
                    <div style="display:flex;gap:6px;align-items:center;">
                        <span style="font-size:11px;color:${color};font-family:Share Tech Mono,monospace;text-transform:uppercase">${esc(op.status || "—")}</span>
                        <button class="btn btn-danger btn-sm" onclick="requestDelete('op','${esc(op.id)}')">Delete</button>
                    </div>
                </div>
                <div class="card-meta" style="margin:4px 0 8px;">
                    ${op.date ? `<span>📅 ${esc(op.date)}</span>` : ""}
                    ${op.location ? `<span>📍 ${esc(op.location)}</span>` : ""}
                    ${op.officers ? `<span>👤 ${esc(op.officers)}</span>` : ""}
                    ${linkedCase ? `<span>🗂️ ${esc(linkedCase.title)}</span>` : ""}
                </div>
                <div class="op-body">${esc(op.report || "No report.")}</div>
            </div>
        `;
    }).join("");
}

async function submitOperation() {
    const name = document.getElementById("op_name").value.trim();
    const report = document.getElementById("op_report").value.trim();
    if (!name) { toast("Operation name is required.", "error"); return; }
    if (!report) { toast("Operation report is required.", "error"); return; }

    const payload = {
        name,
        status: document.getElementById("op_status").value,
        date: document.getElementById("op_date").value.trim(),
        location: document.getElementById("op_location").value.trim(),
        officers: document.getElementById("op_officers").value.trim(),
        report,
        case_id: document.getElementById("op_caseLink").value || null
    };

    const { data, error } = await sbClient.from("intelligence_operations").insert([payload]).select();
    if (error) { logErr("submitOperation", error); toast("Failed to log operation: " + error.message, "error"); return; }

    state.operations.unshift(data[0]);
    state.filteredOps = [...state.operations];
    closeModal("newOpModal");
    clearFields(["op_name", "op_date", "op_location", "op_officers", "op_report"]);
    renderOps();
    toast("Operation logged successfully.", "success");
}

// ── ADMIN DELETE ─────────────────────────────────────────────
function requestDelete(type, id) {
    state.pendingDelete = { type, id };
    document.getElementById("adminPwdInput").value = "";
    document.getElementById("pwdError").style.display = "none";
    openModal("passwordModal");
    setTimeout(() => document.getElementById("adminPwdInput").focus(), 300);
}

async function confirmAdminAction() {
    const pwd = document.getElementById("adminPwdInput").value;
    if (pwd !== ADMIN_PASSWORD) {
        document.getElementById("pwdError").style.display = "block";
        document.getElementById("adminPwdInput").value = "";
        return;
    }

    const { type, id } = state.pendingDelete;
    const tableMap = {
        case: "intelligence_cases",
        evidence: "intelligence_evidence",
        officer: "intelligence_officers",
        op: "intelligence_operations"
    };

    const table = tableMap[type];
    if (!table) { toast("Unknown delete type.", "error"); closeModal("passwordModal"); return; }

    const { error } = await sbClient.from(table).delete().eq("id", id);
    if (error) { logErr("delete " + type, error); toast("Delete failed: " + error.message, "error"); closeModal("passwordModal"); return; }

    // Remove from local state
    if (type === "case") {
        state.cases = state.cases.filter(c => c.id !== id);
        applyCaseFilters();
        if (state.selectedCase?.id === id) {
            state.selectedCase = null;
            document.getElementById("caseDetail").innerHTML = `<div class="empty-state"><div class="empty-icon">🔍</div>Case deleted. Select another case.</div>`;
            document.getElementById("evidencePanel").innerHTML = `<div class="card card-meta">—</div>`;
            document.getElementById("activityPanel").innerHTML = `<div class="card card-meta">—</div>`;
        }
    }
    if (type === "evidence") {
        state.evidence = state.evidence.filter(e => e.id !== id);
        if (state.selectedEvidence?.id === id) {
            state.selectedEvidence = null;
            document.getElementById("evidenceDetailCol").innerHTML = `<div class="empty-state"><div class="empty-icon">📎</div>Evidence deleted.</div>`;
        }
        renderEvidenceList();
    }
    if (type === "officer") {
        state.officers = state.officers.filter(o => o.id !== id);
        state.filteredOfficers = state.filteredOfficers.filter(o => o.id !== id);
        renderOfficers();
    }
    if (type === "op") {
        state.operations = state.operations.filter(o => o.id !== id);
        state.filteredOps = state.filteredOps.filter(o => o.id !== id);
        renderOps();
    }

    closeModal("passwordModal");
    toast("Record permanently deleted.", "success");
}

// ── HELPERS ──────────────────────────────────────────────────
function clearFields(ids) {
    ids.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = "";
    });
}

// ── BOOT ─────────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", async () => {
    startClock();

    // Bind filter events
    document.getElementById("searchBox")?.addEventListener("input", applyCaseFilters);
    document.getElementById("statusFilter")?.addEventListener("change", applyCaseFilters);
    document.getElementById("priorityFilter")?.addEventListener("change", applyCaseFilters);

    await requireSession();

    // Load all data in parallel
    await Promise.all([
        loadCases(),
        loadAllEvidence(),
        loadOfficers(),
        loadOperations()
    ]);
});