const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { queryOne } = require("../db/db");

const router = express.Router();

router.post("/login", (req, res) => {
  const { username, password } = req.body;
  if (!username || !password)
    return res.status(400).json({ error: "Username and password are required." });

  const user = queryOne("SELECT * FROM users WHERE username = ?", [username]);
  if (!user)
    return res.status(401).json({ error: "Invalid username or password." });

  if (!bcrypt.compareSync(password, user.password_hash))
    return res.status(401).json({ error: "Invalid username or password." });

  const token = jwt.sign(
    { id: user.id, username: user.username, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: "8h" }
  );

  res.json({ token, username: user.username, role: user.role });
});

module.exports = router;