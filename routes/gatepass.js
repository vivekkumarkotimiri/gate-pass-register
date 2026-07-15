const express = require("express");
const { queryAll, queryOne, run, nextGatePassNumber } = require("../db/db");
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
  if (body.return_type && !ALLOWED_RETURN_TYPES.includes(body.return_type))
    errors.push("return_type must be 'Returnable' or 'Non-Returnable'.");
  if (body.status && !ALLOWED_STATUS.includes(body.status))
    errors.push("status must be 'Open' or 'Closed'.");
  return errors;
}

// PUBLIC
router.get("/", (req, res) => {
  const { search, status, return_type } = req.query;
  let sql = "SELECT * FROM gatepasses WHERE 1=1";
  const params = [];

  if (search) {
    sql += " AND (material_name LIKE ? OR address LIKE ? OR gate_pass_no LIKE ? OR technician LIKE ?)";
    const like = `%${search}%`;
    params.push(like, like, like, like);
  }
  if (status)      { sql += " AND status = ?";      params.push(status); }
  if (return_type) { sql += " AND return_type = ?";  params.push(return_type); }
  sql += " ORDER BY id DESC";

  res.json(queryAll(sql, params));
});

router.get("/:id", (req, res) => {
  const row = queryOne("SELECT * FROM gatepasses WHERE id = ?", [req.params.id]);
  if (!row) return res.status(404).json({ error: "Gate pass not found." });
  res.json(row);
});

// PROTECTED
router.post("/", requireAuth, (req, res) => {
  const errors = validatePayload(req.body);
  if (errors.length) return res.status(400).json({ error: errors.join(" ") });

  const { entry_date, material_name, technician, number, return_type, address, purpose } = req.body;
  const status = ALLOWED_STATUS.includes(req.body.status) ? req.body.status : "Open";
  const gate_pass_no = nextGatePassNumber();

  run(
    `INSERT INTO gatepasses
      (gate_pass_no, entry_date, material_name, technician, number, return_type, address, purpose, status, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [gate_pass_no, entry_date, material_name, technician || null, number || null,
     return_type, address, purpose, status, req.user.username]
  );

  const created = queryOne("SELECT * FROM gatepasses WHERE gate_pass_no = ?", [gate_pass_no]);
  res.status(201).json(created);
});

router.put("/:id", requireAuth, (req, res) => {
  const existing = queryOne("SELECT * FROM gatepasses WHERE id = ?", [req.params.id]);
  if (!existing) return res.status(404).json({ error: "Gate pass not found." });

  const errors = validatePayload(req.body, { partial: true });
  if (errors.length) return res.status(400).json({ error: errors.join(" ") });

  const merged = {
    entry_date:    req.body.entry_date    ?? existing.entry_date,
    material_name: req.body.material_name ?? existing.material_name,
    technician:    req.body.technician    ?? existing.technician,
    number:        req.body.number        ?? existing.number,
    return_type:   req.body.return_type   ?? existing.return_type,
    address:       req.body.address       ?? existing.address,
    purpose:       req.body.purpose       ?? existing.purpose,
    status:        req.body.status        ?? existing.status,
  };

  run(
    `UPDATE gatepasses SET
      entry_date=?, material_name=?, technician=?, number=?,
      return_type=?, address=?, purpose=?, status=?,
      updated_at=datetime('now')
     WHERE id=?`,
    [merged.entry_date, merged.material_name, merged.technician, merged.number,
     merged.return_type, merged.address, merged.purpose, merged.status, req.params.id]
  );

  res.json(queryOne("SELECT * FROM gatepasses WHERE id = ?", [req.params.id]));
});

router.delete("/:id", requireAuth, (req, res) => {
  const existing = queryOne("SELECT * FROM gatepasses WHERE id = ?", [req.params.id]);
  if (!existing) return res.status(404).json({ error: "Gate pass not found." });
  run("DELETE FROM gatepasses WHERE id = ?", [req.params.id]);
  res.json({ message: `Gate pass ${existing.gate_pass_no} deleted.` });
});

module.exports = router;