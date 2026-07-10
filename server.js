// server.js
// ------------------------------------------------------------------
// Entry point. Run with: npm start
// Serves:
//   - the backend API under /api/...
//   - the public viewing page at  /            (public/index.html)
//   - the admin login + dashboard at /admin    (public/admin.html)
//
// REQUIREMENT: "accessed by other computers also"
// Any computer on the same network can open http://<this-machine-IP>:4000
// once this server is running. To make it reachable from the internet,
// deploy it on a host (Render, Railway, a VPS, etc.) - see README.md.
// ------------------------------------------------------------------

require("dotenv").config();
const path = require("path");
const express = require("express");
const cors = require("cors");

const authRoutes = require("./routes/auth");
const gatepassRoutes = require("./routes/gatepass");
const { requireAuth } = require("./middleware/auth");

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());

// ---- API routes ----
app.use("/api/auth", authRoutes);
app.use("/api/gatepasses", gatepassRoutes);

// A simple endpoint the admin page can call to verify a token is still valid
app.get("/api/auth/verify", requireAuth, (req, res) => {
  res.json({ valid: true, user: req.user });
});

// ---- Serve the frontend (public + admin pages) ----
app.use(express.static(path.join(__dirname, "public")));

app.listen(PORT, () => {
  console.log(`Gate Pass Register server running:`);
  console.log(` Local:   http://localhost:${PORT}`);
  console.log(` Network: http://<Your Computer IP Address>:${PORT}   (share this with LAN users)`);
});
