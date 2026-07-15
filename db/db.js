require("dotenv").config();
const path = require("path");
const fs = require("fs");
const bcrypt = require("bcryptjs");
const initSqlJs = require("sql.js");

const DB_PATH = path.join(__dirname, "gatepass.db");

let db;

async function initDB() {
  const SQL = await initSqlJs();

  if (fs.existsSync(DB_PATH)) {
    const fileBuffer = fs.readFileSync(DB_PATH);
    db = new SQL.Database(fileBuffer);
  } else {
    db = new SQL.Database();
  }

  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'admin',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS gatepasses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      gate_pass_no TEXT UNIQUE NOT NULL,
      entry_date TEXT NOT NULL,
      material_name TEXT NOT NULL,
      technician TEXT,
      number TEXT,
      return_type TEXT NOT NULL CHECK (return_type IN ('Returnable','Non-Returnable')),
      address TEXT NOT NULL,
      purpose TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'Open' CHECK (status IN ('Open','Closed')),
      created_by TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  seedDefaultAdmin();
  saveDB();
  return db;
}

function saveDB() {
  const data = db.export();
  fs.writeFileSync(DB_PATH, Buffer.from(data));
}

function seedDefaultAdmin() {
  const result = db.exec("SELECT COUNT(*) AS count FROM users");
  const count = result[0]?.values[0][0] || 0;
  if (count === 0) {
    const username = process.env.DEFAULT_ADMIN_USERNAME || "admin";
    const password = process.env.DEFAULT_ADMIN_PASSWORD || "admin123";
    const hash = bcrypt.hashSync(password, 10);
    db.run(
      "INSERT INTO users (username, password_hash, role) VALUES (?, ?, 'admin')",
      [username, hash]
    );
    saveDB();
    console.log(`Seeded default admin user "${username}".`);
  }
}

function nextGatePassNumber() {
  const result = db.exec(
    "SELECT seq FROM sqlite_sequence WHERE name = 'gatepasses'"
  );
  const nextId = result[0] ? result[0].values[0][0] + 1 : 1;
  return "GP-" + String(nextId).padStart(6, "0");
}

// Helper: run a SELECT and return array of row objects
function queryAll(sql, params = []) {
  const result = db.exec(sql, params);
  if (!result[0]) return [];
  const { columns, values } = result[0];
  return values.map((row) =>
    Object.fromEntries(columns.map((col, i) => [col, row[i]]))
  );
}

// Helper: run a SELECT and return one row object or null
function queryOne(sql, params = []) {
  const rows = queryAll(sql, params);
  return rows[0] || null;
}

// Helper: run INSERT/UPDATE/DELETE and save the db file
function run(sql, params = []) {
  db.run(sql, params);
  saveDB();
  return db;
}

module.exports = { initDB, db: () => db, queryAll, queryOne, run, nextGatePassNumber, saveDB };