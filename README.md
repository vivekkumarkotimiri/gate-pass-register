# Gate Pass Register System

A full register system for issuing gate passes, with a public read-only view
and a login-protected admin area for adding/editing/deleting entries.
Data is stored permanently in a database file on the server, and any computer
that can reach the server's address can use it — that's the "backend" part.

## 1. Requirement → Code map

| Your requirement | Where it's implemented |
|---|---|
| Auto-incremented gate pass number on each entry | `db/db.js` → `nextGatePassNumber()`, used in `routes/gatepass.js` (`POST /`) |
| Date field | `entry_date` column — form field in `public/admin.html` (`#c_date`) |
| Material name | `material_name` column — `#c_material` |
| Returnable / Non-Returnable dropdown | `return_type` column, `CHECK` constraint in `db/db.js`, `<select>` in `admin.html` |
| Address it's going to | `address` column — `#c_address` |
| Purpose (damage / replacement / repair / other) | `purpose` column — dropdown in `admin.html` with an "Other" free-text option |
| Status: Open / Closed | `status` column, `CHECK` constraint, editable in the Edit panel |
| Public can view the whole register | `public/index.html` + `public/js/public.js` call `GET /api/gatepasses` — **no login required** |
| Entry / update / delete restricted to authorized persons | `middleware/auth.js` (`requireAuth`) applied only to `POST`, `PUT`, `DELETE` in `routes/gatepass.js` |
| Login credentials | `routes/auth.js` (`POST /api/auth/login`), passwords hashed with bcrypt in `db/db.js` |
| Creating/changing logins is code-only, not on the dashboard | `scripts/manage-users.js` — a command-line tool, no web page or API route exposes this |
| Multiple authorized persons can be logged in at once | `users` table supports any number of rows; JWT logins are independent per person/computer, no single-session limit |
| Permanent storage | SQLite file `db/gatepass.db`, created automatically by `better-sqlite3` — survives server restarts |
| Accessible from other computers (backend) | `server.js` — an Express HTTP server; any machine that can reach `http://<server-ip>:4000` can use the public page, and authorized staff can log in from any machine too |

## 2. Folder structure

```
gatepass-system/
├── server.js              # starts everything
├── package.json
├── .env.example            # copy to .env and edit
├── db/
│   └── db.js               # SQLite tables + auto-increment logic
├── middleware/
│   └── auth.js             # checks login token on protected routes
├── routes/
│   ├── auth.js              # login
│   └── gatepass.js          # the register: list/get (public), create/update/delete (protected)
└── public/                  # the website itself
    ├── index.html            # public view — anyone can open this
    ├── admin.html            # login + dashboard — authorized staff only
    ├── css/style.css
    └── js/
        ├── public.js
        └── admin.js
```

## 3. How to run it

You'll need [Node.js](https://nodejs.org) installed (version 18 or later).

```bash
cd gatepass-system
npm install              # downloads express, better-sqlite3, bcryptjs, jsonwebtoken, etc.
cp .env.example .env      # then open .env and change JWT_SECRET and the default admin password
npm start
```

You'll see:
```
Public view : http://localhost:4000/
Admin login : http://localhost:4000/admin.html
```

The very first time it runs, it creates `db/gatepass.db` and seeds one
authorized login using whatever you put in `.env` (default `admin` / `admin123`
if you don't change it).

## 4. Creating or changing logins (code-only, not on the dashboard)

There is deliberately no button on any web page for this. All login
accounts are created and changed by running a script on the server,
in the code:

```bash
node scripts/manage-users.js list                                  # see all current logins
node scripts/manage-users.js add gatekeeper2 someStrongPass123      # add a new authorized person
node scripts/manage-users.js set-password admin newStrongPass123    # change a password
node scripts/manage-users.js set-username admin gatekeeper1         # change a username
node scripts/manage-users.js set-role gatekeeper2 admin              # change a role
node scripts/manage-users.js remove gatekeeper2                      # remove a login
```

Because each login is just a row in the database and gets its own
independent token when it signs in, any number of authorized persons
can be logged into the admin dashboard at the same time, from
different computers, without interfering with each other.

## 5. Letting other computers reach it

- **On the same office network:** find this computer's local IP (e.g. `192.168.1.20`),
  make sure the firewall allows port 4000, and others open `http://192.168.1.20:4000/`.
- **From anywhere on the internet:** deploy this folder to a host such as
  Render, Railway, or a small VPS (e.g. DigitalOcean), which gives you a
  permanent public URL. The code doesn't need to change — just set `.env`
  variables on the host and run `npm start` there. Ask me if you'd like
  step-by-step deployment instructions for a specific host.

## 6. Notes on the auto-numbering

Gate pass numbers look like `GP-000001`, `GP-000002`, ... They're derived
directly from the database's internal auto-increment counter, so numbers
stay unique and sequential even if several authorized staff are entering
passes from different computers at the same time.
