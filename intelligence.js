// ================================
// CADRE INTELLIGENCE CORE ENGINE
// ================================

const CADRE_SUPABASE_URL = "https://ihroattnnnsckvvbosfz.supabase.co";
const CADRE_SUPABASE_KEY = "sb_publishable_M0wwGKR9he08sEfHhZQQxA_vmnXS2eX";

const sbClient = window.supabase.createClient(CADRE_SUPABASE_URL, CADRE_SUPABASE_KEY);

const state = {
    currentUser: null,
    cases: [],
    filteredCases: [],
    selectedCase: null,
    els: {}
};

// ================================
// UTILITIES
// ================================

function esc(value) {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function formatDate(value) {
    if (!value) return "Unknown time";
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? "Unknown time" : date.toLocaleString();
}

function requiredEl(id) {
    const el = document.getElementById(id);
    if (!el) console.error(`[Intelligence] Missing DOM element: #${id}`);
    return el;
}

function showPanelMessage(panel, message) {
    if (panel) panel.innerHTML = `<div class="card small">${esc(message)}</div>`;
}

function logDataError(label, error) {
    console.error(`[Intelligence] ${label} failed:`, {
        message: error?.message,
        code: error?.code,
        details: error?.details,
        hint: error?.hint
    });
}

// ================================
// DOM + AUTH
// ================================

function bindDom() {
    state.els = {
        caseList: requiredEl("caseList"),
        caseDetail: requiredEl("caseDetail"),
        evidencePanel: requiredEl("evidencePanel"),
        activityPanel: requiredEl("activityPanel"),
        inboxPanel: requiredEl("inboxPanel"),
        searchBox: requiredEl("searchBox"),
        statusFilter: requiredEl("statusFilter"),
        priorityFilter: requiredEl("priorityFilter")
    };

    if (state.els.searchBox) state.els.searchBox.addEventListener("input", applyCaseFilters);
    if (state.els.statusFilter) state.els.statusFilter.addEventListener("change", applyCaseFilters);
    if (state.els.priorityFilter) state.els.priorityFilter.addEventListener("change", applyCaseFilters);
}

async function requireSession() {
    const { data, error } = await sbClient.auth.getSession();

    if (error) {
        console.error("[Intelligence] Supabase auth session check failed:", error);
        window.location.href = "login.html";
        return null;
    }

    if (!data.session?.user) {
        console.warn("[Intelligence] No authenticated Supabase session. Redirecting to login.html.");
        window.location.href = "login.html";
        return null;
    }

    state.currentUser = data.session.user;
    return state.currentUser;
}

// ================================
// CASES
// ================================

async function loadCases() {
    const { data, error } = await sbClient
        .from("intelligence_cases")
        .select("*")
        .order("created_at", { ascending: false });

    if (error) {
        logDataError("Loading intelligence_cases", error);
        showPanelMessage(state.els.caseList, "Unable to load intelligence cases. Check table name, fields, and RLS policies.");
        return;
    }

    state.cases = Array.isArray(data) ? data : [];
    applyCaseFilters();
}

function applyCaseFilters() {
    const query = (state.els.searchBox?.value || "").trim().toLowerCase();
    const status = state.els.statusFilter?.value || "all";
    const priority = state.els.priorityFilter?.value || "all";

    state.filteredCases = state.cases.filter(item => {
        const titleMatch = String(item.title || "").toLowerCase().includes(query);
        const statusMatch = status === "all" || String(item.status || "").toLowerCase() === status;
        const priorityMatch = priority === "all" || String(item.priority || "").toLowerCase() === priority;
        return titleMatch && statusMatch && priorityMatch;
    });

    renderCases();
}

function renderCases() {
    const container = state.els.caseList;
    if (!container) return;

    container.innerHTML = "<h3 style='padding:10px;'>Cases</h3>";

    if (!state.filteredCases.length) {
        container.insertAdjacentHTML("beforeend", `<div class="card small">No cases match the current filters.</div>`);
        return;
    }

    state.filteredCases.forEach(item => {
        const div = document.createElement("div");
        const isActive = state.selectedCase?.id === item.id;

        div.className = "card case-item";
        div.style.cursor = "pointer";
        div.style.borderColor = isActive ? "rgba(255,0,0,0.35)" : "rgba(255,0,0,0.08)";
        div.innerHTML = `
            <div><strong>${esc(item.title || "Untitled Case")}</strong></div>
            <div class="small">Status: ${esc(item.status || "unknown")}</div>
            <div class="small">Priority: ${esc(item.priority || "normal")}</div>
        `;

        div.addEventListener("click", () => openCase(item));
        container.appendChild(div);
    });
}

async function openCase(caseItem) {
    state.selectedCase = caseItem;
    renderCases();
    renderCaseDetail(caseItem);

    await Promise.all([
        loadEvidence(caseItem.id),
        loadActivity(caseItem.id)
    ]);
}

function renderCaseDetail(caseItem) {
    const detail = state.els.caseDetail;
    if (!detail) return;

    detail.innerHTML = `
        <h3>${esc(caseItem.title || "Untitled Case")}</h3>
        <div class="small">Case ID: ${esc(caseItem.id)}</div>
        <div class="small">Status: ${esc(caseItem.status || "unknown")} | Priority: ${esc(caseItem.priority || "normal")}</div>
        <hr style="border:1px solid rgba(255,255,255,0.05); margin:10px 0;">
        <p>${esc(caseItem.description || caseItem.summary || "No description available.")}</p>
    `;
}

// ================================
// EVIDENCE
// ================================

async function loadEvidence(caseId) {
    const panel = state.els.evidencePanel;
    showPanelMessage(panel, "Loading evidence...");

    const { data, error } = await sbClient
        .from("intelligence_evidence")
        .select("*")
        .eq("case_id", caseId)
        .order("created_at", { ascending: false });

    if (error) {
        logDataError("Loading intelligence_evidence", error);
        showPanelMessage(panel, "Unable to load evidence. Check intelligence_evidence.case_id and RLS policies.");
        return;
    }

    if (!data?.length) {
        showPanelMessage(panel, "No evidence linked to this case.");
        return;
    }

    panel.innerHTML = data.map(item => {
        const url = item.file_url || item.url || item.link || "";
        const fileLink = url
            ? `<a class="small" href="${esc(url)}" target="_blank" rel="noopener noreferrer">Open file</a>`
            : `<div class="small">No file link</div>`;

        return `
            <div class="card evidence-item">
                <div><strong>${esc(item.file_name || item.name || "Evidence File")}</strong></div>
                <div class="small">Type: ${esc(item.file_type || item.type || "unknown")}</div>
                <div class="small">${esc(item.notes || "No notes")}</div>
                ${fileLink}
            </div>
        `;
    }).join("");
}

// ================================
// ACTIVITY LOG
// ================================

async function loadActivity(caseId) {
    const panel = state.els.activityPanel;
    showPanelMessage(panel, "Loading activity...");

    const { data, error } = await sbClient
        .from("intelligence_activity_log")
        .select("*")
        .eq("case_id", caseId)
        .order("created_at", { ascending: false });

    if (error) {
        logDataError("Loading intelligence_activity_log", error);
        showPanelMessage(panel, "Unable to load activity log. Check intelligence_activity_log.case_id and RLS policies.");
        return;
    }

    if (!data?.length) {
        showPanelMessage(panel, "No activity recorded for this case.");
        return;
    }

    panel.innerHTML = data.map(log => `
        <div class="card timeline-item">
            <div>${esc(log.action || log.message || "Activity")}</div>
            <div class="small">${esc(log.actor || log.user_name || "System")} | ${esc(formatDate(log.created_at))}</div>
            ${log.notes ? `<div class="small">${esc(log.notes)}</div>` : ""}
        </div>
    `).join("");
}

function prepareInboxPanel() {
    showPanelMessage(state.els.inboxPanel, "Inbox ready.");
}

// ================================
// INITIAL BOOT SEQUENCE
// ================================

document.addEventListener("DOMContentLoaded", async () => {
    bindDom();
    prepareInboxPanel();

    const user = await requireSession();
    if (!user) return;

    await loadCases();
});
