// public/js/admin.js
// Admin dashboard logic: login screen, then create/edit/delete gate passes.
// Uses a JWT stored in sessionStorage (cleared when the browser tab closes)
// so the login token isn't left lying around on a shared computer.

const API_BASE = "/api/gatepasses";
const AUTH_BASE = "/api/auth";

const loginView = document.getElementById("loginView");
const dashboardView = document.getElementById("dashboardView");
const loginForm = document.getElementById("loginForm");
const loginError = document.getElementById("loginError");
const whoAmI = document.getElementById("whoAmI");
const logoutBtn = document.getElementById("logoutBtn");

function getToken() { return sessionStorage.getItem("gp_token"); }
function getUsername() { return sessionStorage.getItem("gp_username"); }

function authHeaders() {
  return { Authorization: `Bearer ${getToken()}`, "Content-Type": "application/json" };
}

async function checkSession() {
  const token = getToken();
  if (!token) return showLogin();

  const res = await fetch(`${AUTH_BASE}/verify`, { headers: authHeaders() });
  if (res.ok) {
    showDashboard();
  } else {
    sessionStorage.clear();
    showLogin();
  }
}

function showLogin() {
  loginView.style.display = "block";
  dashboardView.style.display = "none";
}

function showDashboard() {
  loginView.style.display = "none";
  dashboardView.style.display = "block";
  whoAmI.textContent = `Signed in as ${getUsername()}`;

  const dateField = document.getElementById("c_date");
  if (dateField && !dateField.value) {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, "0");
    const dd = String(today.getDate()).padStart(2, "0");
    dateField.value = `${yyyy}-${mm}-${dd}`;
  }

  loadEntries();
}

loginForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  loginError.textContent = "";
  const username = document.getElementById("username").value.trim();
  const password = document.getElementById("password").value;

  try {
    const res = await fetch(`${AUTH_BASE}/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });
    const data = await res.json();
    if (!res.ok) {
      loginError.textContent = data.error || "Login failed.";
      return;
    }
    sessionStorage.setItem("gp_token", data.token);
    sessionStorage.setItem("gp_username", data.username);
    showDashboard();
  } catch (err) {
    loginError.textContent = "Could not reach the server.";
  }
});

logoutBtn.addEventListener("click", () => {
  sessionStorage.clear();
  showLogin();
});

// ---------------- Listing / search / filter ----------------

const tableBody = document.getElementById("tableBody");
const emptyState = document.getElementById("emptyState");
const searchInput = document.getElementById("searchInput");
const statusFilter = document.getElementById("statusFilter");
const refreshBtn = document.getElementById("refreshBtn");

function buildQuery() {
  const params = new URLSearchParams();
  if (searchInput.value.trim()) params.set("search", searchInput.value.trim());
  if (statusFilter.value) params.set("status", statusFilter.value);
  return params.toString();
}

function statusBadge(status) {
  const cls = status === "Open" ? "open" : "closed";
  return `<span class="badge ${cls}">${status}</span>`;
}
function typeBadge(type) {
  const cls = type === "Returnable" ? "returnable" : "nonreturnable";
  return `<span class="badge ${cls}">${type}</span>`;
}

async function loadEntries() {
  const query = buildQuery();
  const res = await fetch(`${API_BASE}${query ? "?" + query : ""}`);
  const data = await res.json();

  tableBody.innerHTML = "";
  if (!data.length) {
    emptyState.style.display = "block";
    return;
  }
  emptyState.style.display = "none";

  for (const entry of data) {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td><span class="tag-no">${entry.gate_pass_no}</span></td>
      <td>${entry.entry_date}</td>
      <td>${entry.material_name}</td>
      <td>${entry.technician || '—'}</td>
      <td>${entry.number || '—'}</td>
      <td>${typeBadge(entry.return_type)}</td>
      <td>${entry.address}</td>
      <td>${entry.purpose}</td>
      <td>${statusBadge(entry.status)}</td>
      <td>
        <div class="row-actions">
          <button class="secondary" data-edit="${entry.id}" type="button">Edit</button>
          <button class="danger" data-delete="${entry.id}" type="button">Delete</button>
        </div>
      </td>
    `;
    tableBody.appendChild(tr);
  }

  tableBody.querySelectorAll("[data-edit]").forEach((btn) =>
    btn.addEventListener("click", () => openEdit(data.find((d) => d.id === Number(btn.dataset.edit))))
  );
  tableBody.querySelectorAll("[data-delete]").forEach((btn) =>
    btn.addEventListener("click", () => deleteEntry(Number(btn.dataset.delete)))
  );
}

let debounceTimer;
searchInput.addEventListener("input", () => {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(loadEntries, 300);
});
statusFilter.addEventListener("change", loadEntries);
refreshBtn.addEventListener("click", loadEntries);

// ---------------- Create ----------------

const createForm = document.getElementById("createForm");
const createMsg = document.getElementById("createMsg");
const purposeSelect = document.getElementById("c_purpose");
const otherPurposeWrap = document.getElementById("otherPurposeWrap");
const otherPurposeInput = document.getElementById("c_purpose_other");

purposeSelect.addEventListener("change", () => {
  otherPurposeWrap.style.display = purposeSelect.value === "Other" ? "block" : "none";
});

createForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  createMsg.textContent = "";

  const purpose =
    purposeSelect.value === "Other" ? otherPurposeInput.value.trim() || "Other" : purposeSelect.value;

  const payload = {
    entry_date: document.getElementById("c_date").value,
    material_name: document.getElementById("c_material").value.trim(),
    technician: document.getElementById("c_technician").value,
    number: document.getElementById("c_number").value.trim(),
    return_type: document.getElementById("c_type").value,
    address: document.getElementById("c_address").value.trim(),
    purpose,
  };

  const res = await fetch(API_BASE, { method: "POST", headers: authHeaders(), body: JSON.stringify(payload) });
  const data = await res.json();

  if (!res.ok) {
    createMsg.style.color = "var(--closed)";
    createMsg.textContent = data.error || "Could not create entry.";
    return;
  }

  createMsg.style.color = "var(--open)";
  createMsg.textContent = `Added as ${data.gate_pass_no}`;
  createForm.reset();
  otherPurposeWrap.style.display = "none";
  loadEntries();
});

// ---------------- Edit ----------------

const editOverlay = document.getElementById("editOverlay");
const editForm = document.getElementById("editForm");
const editError = document.getElementById("editError");
const editGpNo = document.getElementById("editGpNo");
const cancelEditBtn = document.getElementById("cancelEditBtn");

function openEdit(entry) {
  if (!entry) return;
  editError.textContent = "";
  editGpNo.textContent = entry.gate_pass_no;
  document.getElementById("e_id").value = entry.id;
  document.getElementById("e_date").value = entry.entry_date;
  document.getElementById("e_material").value = entry.material_name;
  document.getElementById("e_technician").value = entry.technician;
  document.getElementById("e_number").value = entry.number;
  document.getElementById("e_type").value = entry.return_type;
  document.getElementById("e_status").value = entry.status;
  document.getElementById("e_address").value = entry.address;
  document.getElementById("e_purpose").value = entry.purpose;
  editOverlay.style.display = "flex";
}

cancelEditBtn.addEventListener("click", () => (editOverlay.style.display = "none"));

editForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  editError.textContent = "";
  const id = document.getElementById("e_id").value;

  const payload = {
    entry_date: document.getElementById("e_date").value,
    material_name: document.getElementById("e_material").value.trim(),
   technician: document.getElementById("e_technician").value,
    number: document.getElementById("e_number").value.trim(),
    return_type: document.getElementById("e_type").value,
    status: document.getElementById("e_status").value,
    address: document.getElementById("e_address").value.trim(),
    purpose: document.getElementById("e_purpose").value.trim(),
  };

  const res = await fetch(`${API_BASE}/${id}`, { method: "PUT", headers: authHeaders(), body: JSON.stringify(payload) });
  const data = await res.json();

  if (!res.ok) {
    editError.textContent = data.error || "Could not save changes.";
    return;
  }

  editOverlay.style.display = "none";
  loadEntries();
});

// ---------------- Delete ----------------

async function deleteEntry(id) {
  if (!confirm("Delete this gate pass entry? This cannot be undone.")) return;
  const res = await fetch(`${API_BASE}/${id}`, { method: "DELETE", headers: authHeaders() });
  const data = await res.json();
  if (!res.ok) {
    alert(data.error || "Could not delete entry.");
    return;
  }
  loadEntries();
}

// ---------------- Boot ----------------
checkSession();
