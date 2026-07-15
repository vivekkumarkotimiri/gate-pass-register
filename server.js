require("dotenv").config();
const path = require("path");
const express = require("express");
const cors = require("cors");
const { initDB } = require("./db/db");

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());

// Boot database first, then start server
initDB().then(() => {
  const authRoutes    = require("./routes/auth");
  const gatepassRoutes = require("./routes/gatepass");
  const { requireAuth } = require("./middleware/auth");

  app.use("/api/auth", authRoutes);
  app.use("/api/gatepasses", gatepassRoutes);

  app.get("/api/auth/verify", requireAuth, (req, res) => {
    res.json({ valid: true, user: req.user });
  });

  app.use(express.static(path.join(__dirname, "public")));

  app.listen(PORT, async () => {
    console.log(`Server running:`);
    console.log(`Gate Pass Register running at http://localhost:${PORT}`);
    console.log(`Network: http://<Your Computer IP Address>:${PORT}   (share this with LAN users)`);

    if (process.env.NGROK_AUTHTOKEN) {
      try {
        const ngrok = require("@ngrok/ngrok");
        const listener = await ngrok.forward({
          addr: PORT,
          authtoken: process.env.NGROK_AUTHTOKEN,
        });
        console.log("\n  Public internet URL:");
        console.log(`  ${listener.url()}/`);
        console.log(`  ${listener.url()}/admin.html`);
      } catch (err) {
        console.log("\n  ngrok tunnel failed:", err.message);
      }
    }
  });
}).catch((err) => {
  console.error("Failed to initialise database:", err);
  process.exit(1);
});