require("dotenv").config();
const bcrypt = require("bcryptjs");

// initDB must complete before we can query
const { initDB, queryAll, queryOne, run } = require("../db/db");

initDB().then(() => {
  const [,, command, ...args] = process.argv;

  function listUsers() {
    const rows = queryAll("SELECT id, username, role, created_at FROM users ORDER BY id");
    if (!rows.length) { console.log("No users yet."); return; }
    console.table(rows);
  }

  function addUser(username, password, role = "staff") {
    if (!username || !password) { console.error("Usage: add <username> <password> [role]"); process.exit(1); }
    if (password.length < 6)    { console.error("Password must be at least 6 characters."); process.exit(1); }
    if (queryOne("SELECT id FROM users WHERE username = ?", [username]))
      { console.error(`Username "${username}" already exists.`); process.exit(1); }
    const hash = bcrypt.hashSync(password, 10);
    run("INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)", [username, hash, role]);
    console.log(`Created user "${username}" with role "${role}".`);
  }

  function setPassword(username, newPassword) {
    if (!username || !newPassword) { console.error("Usage: set-password <username> <newPassword>"); process.exit(1); }
    if (newPassword.length < 6)    { console.error("Password must be at least 6 characters."); process.exit(1); }
    const user = queryOne("SELECT id FROM users WHERE username = ?", [username]);
    if (!user) { console.error(`No user "${username}" found.`); process.exit(1); }
    run("UPDATE users SET password_hash = ? WHERE id = ?", [bcrypt.hashSync(newPassword, 10), user.id]);
    console.log(`Password updated for "${username}".`);
  }

  function setUsername(oldUsername, newUsername) {
    if (!oldUsername || !newUsername) { console.error("Usage: set-username <old> <new>"); process.exit(1); }
    const user = queryOne("SELECT id FROM users WHERE username = ?", [oldUsername]);
    if (!user) { console.error(`No user "${oldUsername}" found.`); process.exit(1); }
    if (queryOne("SELECT id FROM users WHERE username = ?", [newUsername]))
      { console.error(`Username "${newUsername}" already taken.`); process.exit(1); }
    run("UPDATE users SET username = ? WHERE id = ?", [newUsername, user.id]);
    console.log(`Username changed: "${oldUsername}" → "${newUsername}".`);
  }

  function setRole(username, role) {
    if (!["admin","staff"].includes(role)) { console.error('Role must be "admin" or "staff".'); process.exit(1); }
    const user = queryOne("SELECT id FROM users WHERE username = ?", [username]);
    if (!user) { console.error(`No user "${username}" found.`); process.exit(1); }
    run("UPDATE users SET role = ? WHERE id = ?", [role, user.id]);
    console.log(`Role for "${username}" set to "${role}".`);
  }

  function removeUser(username) {
    const user = queryOne("SELECT id FROM users WHERE username = ?", [username]);
    if (!user) { console.error(`No user "${username}" found.`); process.exit(1); }
    const count = queryAll("SELECT id FROM users").length;
    if (count <= 1) { console.error("Refusing to remove the last account."); process.exit(1); }
    run("DELETE FROM users WHERE id = ?", [user.id]);
    console.log(`Removed user "${username}".`);
  }

  switch (command) {
    case "list":         listUsers(); break;
    case "add":          addUser(args[0], args[1], args[2]); break;
    case "set-password": setPassword(args[0], args[1]); break;
    case "set-username": setUsername(args[0], args[1]); break;
    case "set-role":     setRole(args[0], args[1]); break;
    case "remove":       removeUser(args[0]); break;
    default:
      console.log(`Commands:
  node scripts/manage-users.js list
  node scripts/manage-users.js add <username> <password> [role]
  node scripts/manage-users.js set-password <username> <newPassword>
  node scripts/manage-users.js set-username <oldUsername> <newUsername>
  node scripts/manage-users.js set-role <username> <admin|staff>
  node scripts/manage-users.js remove <username>`);
  }
});