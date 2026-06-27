// middleware/auth.js
// ------------------------------------------------------------------
// REQUIREMENT: "entry, updation and deletion of few options has to
// be for authorized persons only with login credentials"
//
// This middleware checks for a valid login token (JWT) sent by the
// browser in the Authorization header. If missing/invalid -> 401.
// Public viewing routes do NOT use this middleware, so anyone can
// still see the register without logging in.
// ------------------------------------------------------------------

const jwt = require("jsonwebtoken");

function requireAuth(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;

  if (!token) {
    return res.status(401).json({ error: "Login required for this action." });
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.user = payload; // { id, username, role }
    next();
  } catch (err) {
    return res.status(401).json({ error: "Session expired or invalid. Please log in again." });
  }
}

// ------------------------------------------------------------------
// REQUIREMENT: managing OTHER users' login credentials should only be
// possible for an authorized "admin" role person, not every staff login.
// Use this AFTER requireAuth on routes that create/edit/delete users.
// ------------------------------------------------------------------
function requireAdmin(req, res, next) {
  if (!req.user || req.user.role !== "admin") {
    return res.status(403).json({ error: "Only an admin account can manage other users." });
  }
  next();
}

module.exports = { requireAuth, requireAdmin };
