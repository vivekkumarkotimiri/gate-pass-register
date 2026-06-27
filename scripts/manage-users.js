// scripts/manage-users.js
// ------------------------------------------------------------------
// This is the ONLY place authorized-person accounts get created or
// changed. There is deliberately no web page and no API endpoint for
// this - it is run directly on the server, in the code, by whoever
// has access to this codebase. The login table supports any number
// of accounts, and any number of them can be logged in at the same
// time from different computers (each login just gets its own token).
//
// USAGE (run from the project's root folder):
//
//   node scripts/manage-users.js list
//   node scripts/manage-users.js add <username> <password> [role]
//   node scripts/manage-users.js set-password <username> <newPassword>
//   node scripts/manage-users.js set-username <oldUsername> <newUsername>
//   node scripts/manage-users.js set-role <username> <admin|staff>
//   node scripts/manage-users.js remove <username>
//
// role defaults to "staff" when adding. "admin" and "staff" both get
// full entry/update/delete rights on gate passes today - role exists
// so you can restrict that further later if you ever need to.
// ------------------------------------------------------------------

require("dotenv").config();
const bcrypt = require("bcryptjs");
const { db } = require("../db/db");

const [, , command, ...args] = process.argv;

function listUsers() {
  const rows = db.prepare("SELECT id, username, role, created_at FROM users ORDER BY id").all();
  if (!rows.length) {
    console.log("No users yet.");
    return;
  }
  console.table(rows);
}

function addUser(username, password, role = "staff") {
  if (!username || !password) {
    console.error("Usage: node scripts/manage-users.js add <username> <password> [role]");
    process.exit(1);
  }
  if (password.length < 6) {
    console.error("Password must be at least 6 characters.");
    process.exit(1);
  }
  const exists = db.prepare("SELECT id FROM users WHERE username = ?").get(username);
  if (exists) {
    console.error(`Username "${username}" already exists.`);
    process.exit(1);
  }
  const hash = bcrypt.hashSync(password, 10);
  db.prepare("INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)").run(username, hash, role);
  console.log(`Created user "${username}" with role "${role}".`);
}

function setPassword(username, newPassword) {
  if (!username || !newPassword) {
    console.error("Usage: node scripts/manage-users.js set-password <username> <newPassword>");
    process.exit(1);
  }
  if (newPassword.length < 6) {
    console.error("Password must be at least 6 characters.");
    process.exit(1);
  }
  const user = db.prepare("SELECT id FROM users WHERE username = ?").get(username);
  if (!user) {
    console.error(`No user found with username "${username}".`);
    process.exit(1);
  }
  const hash = bcrypt.hashSync(newPassword, 10);
  db.prepare("UPDATE users SET password_hash = ? WHERE id = ?").run(hash, user.id);
  console.log(`Password updated for "${username}".`);
}

function setUsername(oldUsername, newUsername) {
  if (!oldUsername || !newUsername) {
    console.error("Usage: node scripts/manage-users.js set-username <oldUsername> <newUsername>");
    process.exit(1);
  }
  const user = db.prepare("SELECT id FROM users WHERE username = ?").get(oldUsername);
  if (!user) {
    console.error(`No user found with username "${oldUsername}".`);
    process.exit(1);
  }
  const taken = db.prepare("SELECT id FROM users WHERE username = ?").get(newUsername);
  if (taken) {
    console.error(`Username "${newUsername}" is already taken.`);
    process.exit(1);
  }
  db.prepare("UPDATE users SET username = ? WHERE id = ?").run(newUsername, user.id);
  console.log(`Username changed: "${oldUsername}" -> "${newUsername}".`);
}

function setRole(username, role) {
  if (!["admin", "staff"].includes(role)) {
    console.error('Role must be "admin" or "staff".');
    process.exit(1);
  }
  const user = db.prepare("SELECT id FROM users WHERE username = ?").get(username);
  if (!user) {
    console.error(`No user found with username "${username}".`);
    process.exit(1);
  }
  db.prepare("UPDATE users SET role = ? WHERE id = ?").run(role, user.id);
  console.log(`Role for "${username}" set to "${role}".`);
}

function removeUser(username) {
  const user = db.prepare("SELECT id FROM users WHERE username = ?").get(username);
  if (!user) {
    console.error(`No user found with username "${username}".`);
    process.exit(1);
  }
  const remaining = db.prepare("SELECT COUNT(*) AS count FROM users").get().count;
  if (remaining <= 1) {
    console.error("Refusing to remove the last remaining login account - add another one first.");
    process.exit(1);
  }
  db.prepare("DELETE FROM users WHERE id = ?").run(user.id);
  console.log(`Removed user "${username}".`);
}

switch (command) {
  case "list":
    listUsers();
    break;
  case "add":
    addUser(args[0], args[1], args[2]);
    break;
  case "set-password":
    setPassword(args[0], args[1]);
    break;
  case "set-username":
    setUsername(args[0], args[1]);
    break;
  case "set-role":
    setRole(args[0], args[1]);
    break;
  case "remove":
    removeUser(args[0]);
    break;
  default:
    console.log(`Unknown or missing command: "${command || ""}"

Available commands:
  node scripts/manage-users.js list
  node scripts/manage-users.js add amc amc1234 [role]
  node scripts/manage-users.js set-password <username> <newPassword>
  node scripts/manage-users.js set-username <oldUsername> <newUsername>
  node scripts/manage-users.js set-role amc <admin>
  node scripts/manage-users.js remove <username>`);
}
