// routes/gatepass.js
// ------------------------------------------------------------------
// REQUIREMENT MAP:
// - "auto incremented for each entry"        -> nextGatePassNumber() in POST /
// - "date, material name"                    -> entry_date, material_name
// - "returnable or non-returnable" dropdown  -> return_type
// - "address to where it is going"           -> address
// - "purpose ... damage/replacement/repair"  -> purpose
// - "status ... open or close"               -> status
// - "visionary to public use" (public view)  -> GET routes have NO requireAuth
// - "entry, updation, deletion for authorized persons only" -> POST/PUT/DELETE use requireAuth
// ------------------------------------------------------------------

const express = require("express");
const { db, nextGatePassNumber } = require("../db/db");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();

const ALLOWED_RETURN_TYPES = ["Returnable", "Non-Returnable"];
const ALLOWED_STATUS = ["Open", "Closed"];

function validatePayload(body, { partial = false } = {}) {
  const errors = [];
  const fields = ["entry_date", "material_name", "return_type", "address", "purpose"];

  for (const field of fields) {
    if (!partial && !body[field]) errors.push(`${field} is required.`);
  }
  if (body.return_type && !ALLOWED_RETURN_TYPES.includes(body.return_type)) {
    errors.push("return_type must be 'Returnable' or 'Non-Returnable'.");
  }
  if (body.status && !ALLOWED_STATUS.includes(body.status)) {
    errors.push("status must be 'Open' or 'Closed'.");
  }
  return errors;
}

// ---------------- PUBLIC: anyone can view the register ----------------
// GET /api/gatepasses?search=...&status=Open&return_type=Returnable
router.get("/", (req, res) => {
  const { search, status, return_type } = req.query;

  let sql = "SELECT * FROM gatepasses WHERE 1=1";
  const params = [];

  if (search) {
    sql += " AND (material_name LIKE ? OR address LIKE ? OR gate_pass_no LIKE ?)";
    const like = `%${search}%`;
    params.push(like, like, like);
  }
  if (status) {
    sql += " AND status = ?";
    params.push(status);
  }
  if (return_type) {
    sql += " AND return_type = ?";
    params.push(return_type);
  }

  sql += " ORDER BY id DESC";

  const rows = db.prepare(sql).all(...params);
  res.json(rows);
});

// GET single record by id (public)
router.get("/:id", (req, res) => {
  const row = db.prepare("SELECT * FROM gatepasses WHERE id = ?").get(req.params.id);
  if (!row) return res.status(404).json({ error: "Gate pass not found." });
  res.json(row);
});

// ---------------- PROTECTED: only logged-in authorized persons ----------------

// CREATE a new gate pass entry (auto-incremented number assigned here)
router.post("/", requireAuth, (req, res) => {
  const errors = validatePayload(req.body);
  if (errors.length) return res.status(400).json({ error: errors.join(" ") });

  const { entry_date, material_name, return_type, address, purpose } = req.body;
  const status = req.body.status && ALLOWED_STATUS.includes(req.body.status) ? req.body.status : "Open";
  const gate_pass_no = nextGatePassNumber();

  const result = db
    .prepare(
      `INSERT INTO gatepasses
        (gate_pass_no, entry_date, material_name, return_type, address, purpose, status, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(gate_pass_no, entry_date, material_name, return_type, address, purpose, status, req.user.username);

  const created = db.prepare("SELECT * FROM gatepasses WHERE id = ?").get(result.lastInsertRowid);
  res.status(201).json(created);
});

// UPDATE an existing gate pass (e.g. edit details, or flip status Open -> Closed)
router.put("/:id", requireAuth, (req, res) => {
  const existing = db.prepare("SELECT * FROM gatepasses WHERE id = ?").get(req.params.id);
  if (!existing) return res.status(404).json({ error: "Gate pass not found." });

  const errors = validatePayload(req.body, { partial: true });
  if (errors.length) return res.status(400).json({ error: errors.join(" ") });

  const merged = {
    entry_date: req.body.entry_date ?? existing.entry_date,
    material_name: req.body.material_name ?? existing.material_name,
    return_type: req.body.return_type ?? existing.return_type,
    address: req.body.address ?? existing.address,
    purpose: req.body.purpose ?? existing.purpose,
    status: req.body.status ?? existing.status,
  };

  db.prepare(
    `UPDATE gatepasses SET
      entry_date = ?, material_name = ?, return_type = ?, address = ?, purpose = ?, status = ?,
      updated_at = datetime('now')
     WHERE id = ?`
  ).run(
    merged.entry_date,
    merged.material_name,
    merged.return_type,
    merged.address,
    merged.purpose,
    merged.status,
    req.params.id
  );

  const updated = db.prepare("SELECT * FROM gatepasses WHERE id = ?").get(req.params.id);
  res.json(updated);
});

// DELETE a gate pass entry
router.delete("/:id", requireAuth, (req, res) => {
  const existing = db.prepare("SELECT * FROM gatepasses WHERE id = ?").get(req.params.id);
  if (!existing) return res.status(404).json({ error: "Gate pass not found." });

  db.prepare("DELETE FROM gatepasses WHERE id = ?").run(req.params.id);
  res.json({ message: `Gate pass ${existing.gate_pass_no} deleted.` });
});

module.exports = router;
