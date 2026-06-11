# Training Portal

A lightweight self-hosted internal training platform built with Node.js, Express, and SQLite.

Employees log in with their company email, complete assigned training modules (video + step-by-step guide + quiz), and track their own progress. Administrators can manage modules, assign them by role, and monitor completion across departments.

---

## Features

- **Role-based module assignment** — modules are assigned per role, not per person
- **Embedded YouTube videos** — unlisted videos supported
- **Step-by-step guides** — structured process steps within each module
- **Confirmation quiz** — 70 % pass threshold; results recorded per user
- **Admin dashboard** — completion stats by department, role, and individual
- **Lightweight** — single Node.js process + SQLite; no external services required

## Screenshots

<!-- TODO: add screenshots -->

## Tech stack

| Layer | Technology |
|---|---|
| Runtime | Node.js 18 + |
| Framework | Express 4 |
| Database | SQLite (via Node.js built-in `node:sqlite`) |
| Auth | express-session + bcryptjs |
| Process manager | PM2 (optional) |
| Reverse proxy | Nginx (optional) |

## Installation

```bash
# 1. Clone the repo
git clone https://github.com/Alexis2104/training-portal.git
cd training-portal

# 2. Install dependencies
npm install

# 3. Configure environment variables
cp .env.example .env
# Edit .env:
#   SESSION_SECRET — generate with: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
#   SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD — admin credentials for the seed
#   SEED_USER_PASSWORD — default password for sample users

# 4. Seed the database with sample data
npm run seed

# 5. Start the server
npm start
```

The app will be available at `http://localhost:3000`.

> **First login:** use the credentials you set in `.env` (defaults: `admin@acme-corp.example` / `Admin1234!`).  
> Change all passwords from the admin panel after your first login.

## Project structure

```
training-portal/
├── server.js               # Express server, session, page routing
├── database/
│   ├── init.js             # Schema creation (SQLite)
│   └── seed.js             # Sample data — run once with npm run seed
├── routes/
│   ├── auth.js             # Login / logout / session (/api/auth)
│   ├── modules.js          # Module detail and quiz (/api/modules)
│   └── admin.js            # Admin endpoints (/api/admin)
├── public/
│   ├── login.html          # Login page
│   ├── dashboard.html      # Employee dashboard
│   ├── module.html         # Module viewer (video + steps + quiz)
│   ├── admin.html          # Admin overview
│   ├── admin-module.html   # Create / edit modules
│   └── css/
│       └── main.css        # Global styles
├── data/                   # SQLite files (git-ignored)
├── .env.example            # Environment variable template
└── package.json
```

## Customising the seed data

Edit `database/seed.js` to match your company:

- **Departments and roles** — update the arrays at the top of the file
- **Admin credentials** — set `SEED_ADMIN_EMAIL` and `SEED_ADMIN_PASSWORD` in `.env`
- **Sample users** — add or replace entries in the `users` array
- **Modules** — replace the sample modules with your real training content
- **Videos** — replace `VIDEO_ID` placeholders with your actual YouTube video IDs

## Adding a video to a module

1. Upload the video to YouTube (**Unlisted** recommended for internal content)
2. Copy the video URL (`https://www.youtube.com/watch?v=<ID>`)
3. In the admin panel, edit the module and paste the URL in the video field
4. Save — the video embeds automatically

## Deployment with PM2 + Nginx

```bash
# Install PM2
npm install -g pm2

# Start the app
pm2 start server.js --name training-portal --node-args="--experimental-sqlite"

# Persist across reboots
pm2 startup
pm2 save
```

Sample Nginx config:

```nginx
server {
    listen 80;
    server_name training.your-domain.example;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

Enable HTTPS with Certbot:

```bash
sudo certbot --nginx -d training.your-domain.example
```

## License

See [LICENSE](LICENSE).
