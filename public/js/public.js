// public/js/public.js
// Read-only viewing logic for the public register page.
// Talks to the backend API (no login token needed for these GET requests).

const API_BASE = "/api/gatepasses";

const tableBody = document.getElementById("tableBody");
const emptyState = document.getElementById("emptyState");
const searchInput = document.getElementById("searchInput");
const statusFilter = document.getElementById("statusFilter");
const typeFilter = document.getElementById("typeFilter");
const refreshBtn = document.getElementById("refreshBtn");

function buildQuery() {
  const params = new URLSearchParams();
  if (searchInput.value.trim()) params.set("search", searchInput.value.trim());
  if (statusFilter.value) params.set("status", statusFilter.value);
  if (typeFilter.value) params.set("return_type", typeFilter.value);
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
      <td>${typeBadge(entry.return_type)}</td>
      <td>${entry.technician || '—'}</td>
      <td>${entry.number || '—'}</td>
      <td>${entry.address}</td>
      <td>${entry.purpose}</td>
      <td>${statusBadge(entry.status)}</td>
    `;
    tableBody.appendChild(tr);
  }
}

let debounceTimer;
searchInput.addEventListener("input", () => {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(loadEntries, 300);
});
statusFilter.addEventListener("change", loadEntries);
typeFilter.addEventListener("change", loadEntries);
refreshBtn.addEventListener("click", loadEntries);

loadEntries();
