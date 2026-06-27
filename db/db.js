// db.js
// ------------------------------------------------------------------
// REQUIREMENT: "storage should be permanent and accessible by other
// computers also"
//
// We use SQLite (via better-sqlite3) which writes to a single file
// on disk: gatepass.db. That file is the permanent storage.
// "Accessible by other computers" is handled by server.js exposing
// this data over HTTP - any computer on the network/internet that
// can reach the server's URL can read/write through the API.
// (See README.md for notes on deploying so other computers can reach it.)
// ------------------------------------------------------------------

const path = require("path");
const bcrypt = require("bcryptjs");
const Database = require("better-sqlite3");

const DB_PATH = path.join(__dirname, "gatepass.db");
const db = new Database(DB_PATH);

db.pragma("journal_mode = WAL"); // safer for concurrent access from multiple computers

// ---------- Table: users (authorized persons who can log in) ----------
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'admin',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);

// ---------- Table: gatepasses (the register itself) ----------
// id auto-increments -> this IS the auto incrementing gate pass number.
db.exec(`
  CREATE TABLE IF NOT EXISTS gatepasses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    gate_pass_no TEXT UNIQUE NOT NULL,
    entry_date TEXT NOT NULL,
    material_name TEXT NOT NULL,
    return_type TEXT NOT NULL CHECK (return_type IN ('Returnable','Non-Returnable')),
    address TEXT NOT NULL,
    purpose TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'Open' CHECK (status IN ('Open','Closed')),
    created_by TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);

// ---------- Seed a default authorized user the first time the app runs ----------
function seedDefaultAdmin() {
  const existing = db.prepare("SELECT COUNT(*) AS count FROM users").get();
  if (existing.count === 0) {
    const username = process.env.DEFAULT_ADMIN_USERNAME || "admin";
    const password = process.env.DEFAULT_ADMIN_PASSWORD || "admin123";
    const hash = bcrypt.hashSync(password, 10);
    db.prepare(
      "INSERT INTO users (username, password_hash, role) VALUES (?, ?, 'admin')"
    ).run(username, hash);
    console.log(`Seeded default admin user "${username}". Change this password after first login.`);
  }
}
seedDefaultAdmin();

// ---------- Helper: generate the next auto-incrementing gate pass number ----------
// Format: GP-000001, GP-000002, ... derived from the auto-increment id,
// so numbers are guaranteed unique and sequential even with many computers
// writing at once (SQLite serializes the writes).
function nextGatePassNumber() {
  const row = db.prepare("SELECT seq FROM sqlite_sequence WHERE name = 'gatepasses'").get();
  const nextId = row ? row.seq + 1 : 1;
  return "GP-" + String(nextId).padStart(6, "0");
}

module.exports = { db, nextGatePassNumber };
