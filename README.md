# Gate Pass Register System

A full-stack gate pass register with a public read-only view and a
login-protected admin dashboard for authorized persons. Data is stored
permanently on the server and accessible from any device on any network.

---

## Folder Structure

```
gatepass-system/
├── server.js                  # starts the server
├── package.json               # dependencies list
├── .env                       # your secret config (never share this)
├── .env.example               # template to copy from
├── db/
│   └── db.js                  # database setup, tables, auto-increment logic
├── middleware/
│   └── auth.js                # login token checker (protects admin routes)
├── routes/
│   ├── auth.js                # login API
│   └── gatepass.js            # gate pass CRUD API
├── scripts/
│   └── manage-users.js        # command-line tool to manage login accounts
└── public/                    # everything the browser loads
    ├── index.html             # public read-only register page
    ├── admin.html             # admin login + dashboard
    ├── css/
    │   └── style.css          # shared styles for both pages
    └── js/
        ├── clock.js           # live date and time (updates every second)
        ├── export-pdf.js      # PDF download by date range
        ├── public.js          # logic for the public page
        └── admin.js           # logic for the admin dashboard
```

---

## Requirements and Where They Live

| Requirement | File |
|---|---|
| Auto-incrementing gate pass number (GP-000001...) | `db/db.js` → `nextGatePassNumber()` |
| Date, material name, technician, contact number | `db/db.js` table columns, `admin.html` form fields |
| Returnable / Non-Returnable dropdown | `db/db.js` CHECK constraint, `admin.html` select |
| Address (going to) | `db/db.js` column, `admin.html` form |
| Purpose (Repair / Replacement / Damage / Other) | `admin.html` dropdown + free-text fallback |
| Status: Open / Closed | `db/db.js` column, editable in the Edit panel |
| Public read-only view (no login needed) | `public/index.html` + `public/js/public.js` |
| Entry / update / delete for authorized persons only | `middleware/auth.js` applied to POST/PUT/DELETE in `routes/gatepass.js` |
| Login credentials with CAPTCHA | `routes/auth.js`, `admin.js` CAPTCHA block |
| Credentials managed in code only (not on dashboard) | `scripts/manage-users.js` |
| Multiple users logged in at once from different devices | JWT tokens — each login is independent, no session limit |
| Permanent storage | SQLite file `db/gatepass.db` — survives restarts |
| Accessible from other computers/networks | `server.js` Express server + optional ngrok tunnel |
| Live date and time in header | `public/js/clock.js` |
| Export PDF by date range | `public/js/export-pdf.js` — jsPDF + AutoTable via CDN |

---

## First-Time Setup

You need [Node.js](https://nodejs.org) version 18 or later.

```powershell
cd gatepass-system
npm install
npm rebuild better-sqlite3
```

Copy the example env file and edit it:
```powershell
copy .env.example .env
```

Open `.env` and set these values:
```
PORT=4000
JWT_SECRET=change_this_to_a_long_random_string
DEFAULT_ADMIN_USERNAME=admin
DEFAULT_ADMIN_PASSWORD=admin123
NGROK_AUTHTOKEN=           # optional — see Remote Access section below
```

Start the server:
```powershell
npm start
```

You will see:
```
Server running locally:
  Public view : http://localhost:4000/
  Admin login : http://localhost:4000/admin.html
```

The very first run creates `db/gatepass.db` and seeds one admin login
using the username and password from your `.env`.

---

## Pages

| URL | Who can use it |
|---|---|
| `http://localhost:4000/` | Anyone — public read-only register |
| `http://localhost:4000/admin.html` | Authorized persons — full entry / edit / delete |

---

## Gate Pass Fields

| Field | Required | Notes |
|---|---|---|
| Gate Pass No. | Auto | Generated as GP-000001, GP-000002 ... never repeats |
| Date | Yes | Auto-filled with today's date on the admin dashboard |
| Material Name | Yes | Free text |
| Technician | No | Name of technician handling the material |
| Contact Number | No | Technician's contact number |
| Returnable / Non-Returnable | Yes | Dropdown selection |
| Address (Going To) | Yes | Destination address |
| Purpose | Yes | Repair / Replacement / Damage / Other (with free text) |
| Status | Yes | Open (default) or Closed — editable after creation |

---

## Admin Login (CAPTCHA)

The admin login page shows a random math question (addition, subtraction,
or multiplication) that must be answered correctly before credentials are
checked. A new question is generated after every failed attempt.
The refresh button (↻) generates a new question on demand.

---

## Managing Login Accounts (Code Only)

All account creation and changes are done by running a script directly
on the server — there is no button or web page for this.

```powershell
# List all current accounts
node scripts/manage-users.js list

# Add a new authorized person
node scripts/manage-users.js add <username> <password> [role]
# Example:
node scripts/manage-users.js add ramesh Ramesh@2026 staff

# Change a password
node scripts/manage-users.js set-password <username> <newPassword>
# Example:
node scripts/manage-users.js set-password admin NewPass@123

# Change a username
node scripts/manage-users.js set-username <oldUsername> <newUsername>
# Example:
node scripts/manage-users.js set-username admin gatekeeper1

# Change a role (admin or staff)
node scripts/manage-users.js set-role <username> <admin|staff>

# Remove an account
node scripts/manage-users.js remove <username>
```

Roles: both `admin` and `staff` can add, edit, and delete gate passes.
`admin` is the default for the seeded account. The `requireAdmin`
middleware in `middleware/auth.js` is available if you ever want to
restrict specific actions to admin-only in the future.

Any number of accounts can be logged in at the same time from different
devices — each login gets its own independent token valid for 8 hours.

---

## Resetting the Gate Pass Counter

If you want the next entry to start from GP-000001 (e.g. after testing):

```powershell
node -e "require('dotenv').config(); const {db}=require('./db/db'); db.prepare(\"DELETE FROM sqlite_sequence WHERE name='gatepasses'\").run(); console.log('Counter reset.');"
```

Or to reset to match the highest existing entry (without clearing data):

```powershell
node scripts/reset-counter.js
```

---

## Exporting to PDF

Both the public page and admin dashboard have an Export PDF bar at the
top of the register. Select a From date and a To date, then click
⬇ Download PDF. The downloaded file is named:

```
GatePass_YYYY-MM-DD_to_YYYY-MM-DD.pdf
```

The PDF includes:
- Header with date range, generation time, and total entry count
- Landscape A4 table with all columns
- Alternating row shading
- Status coloured green (Open) or red (Closed)
- Page numbers on every page

No server is involved in the PDF generation — it runs entirely in the
browser using jsPDF and jsPDF-AutoTable loaded from CDN.

---

## Remote Access (Other Networks / Internet)

### Same office network

Find this computer's local IP address:
```powershell
ipconfig
```
Look for IPv4 Address (e.g. `192.168.1.20`). Make sure Windows Firewall
allows port 4000 inbound, then any device on the same network can open:
```
http://192.168.1.20:4000/
```

### Any network / internet (ngrok)

1. Sign up free at https://ngrok.com
2. Copy your auth token from https://dashboard.ngrok.com/get-started/your-authtoken
3. Add it to `.env`:
   ```
   NGROK_AUTHTOKEN=your_token_here
   ```
4. Restart the server — it will print a public URL like:
   ```
   Public internet URL:
   https://abc123.ngrok-free.app/
   https://abc123.ngrok-free.app/admin.html
   ```

Share that URL with anyone — it works from any device, any network,
anywhere in the world. The URL changes each restart on the free plan.
The server must be running on your machine for the URL to stay active.

---

## Database

The database is a single file: `db/gatepass.db`

It is created automatically on first run. It contains two tables:

**users** — authorized login accounts
```
id | username | password_hash | role | created_at
```

**gatepasses** — the register
```
id | gate_pass_no | entry_date | material_name | technician | number
   | return_type  | address    | purpose       | status
   | created_by   | created_at | updated_at
```

Passwords are hashed with bcrypt and never stored in plain text.

To inspect the database directly without the website:
```powershell
node scripts/view-data.js
```

To flush WAL cache before opening with an external tool (DB Browser etc.):
```powershell
node scripts/checkpoint-db.js
```

If the database file is deleted, the server recreates it from scratch
on next start and reseeds the default admin login from `.env`.

---

## VS Code Extensions (Recommended)

Install these for the best development experience:

```powershell
code --install-extension dbaeumer.vscode-eslint
code --install-extension esbenp.prettier-vscode
code --install-extension qwtel.sqlite-viewer
code --install-extension humao.rest-client
code --install-extension mikestead.dotenv
code --install-extension xabikos.javascriptsnippets
code --install-extension christian-kohler.path-intellisense
code --install-extension formulahendry.auto-rename-tag
code --install-extension ritwickdey.liveserver
code --install-extension eamodio.gitlens
```

Recommended VS Code settings (`Ctrl+Shift+P` → Open User Settings JSON):
```json
{
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "editor.tabSize": 2,
  "files.autoSave": "afterDelay",
  "files.autoSaveDelay": 1000
}
```

---

## Common Commands Reference

| Task | Command |
|---|---|
| Start server | `npm start` |
| Install dependencies | `npm install` |
| Rebuild SQLite native binding | `npm rebuild better-sqlite3` |
| View all stored data | `node scripts/view-data.js` |
| Reset gate pass counter | `node scripts/reset-counter.js` |
| Flush database WAL cache | `node scripts/checkpoint-db.js` |
| List all user accounts | `node scripts/manage-users.js list` |
| Add a user | `node scripts/manage-users.js add <user> <pass> [role]` |
| Change a password | `node scripts/manage-users.js set-password <user> <pass>` |
| Change a username | `node scripts/manage-users.js set-username <old> <new>` |
| Remove a user | `node scripts/manage-users.js remove <username>` |
| Delete database (fresh start) | `Remove-Item db\gatepass.db, db\gatepass.db-wal, db\gatepass.db-shm` |
