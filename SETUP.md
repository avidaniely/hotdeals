# 🔥 HOTדילים — Setup Guide

## Project Structure
```
hotdeals/
├── server/
│   ├── index.js          ← Express API
│   ├── schema.sql        ← MySQL database schema
│   ├── package.json
│   └── .env.example      ← Copy to .env and fill in
└── client/
    └── src/
        ├── App.jsx        ← React frontend
        └── api.js         ← API service layer
```

---

## Step 1 — MySQL Setup

```bash
# Log into MySQL
mysql -u root -p

# Run the schema (creates DB, tables, and admin user)
source /path/to/hotdeals/server/schema.sql
# OR:
mysql -u root -p < server/schema.sql
```

**Default admin login:** `admin` / `admin123`
> ⚠️ Change the admin password after first login!

---

## Step 2 — Backend Setup

```bash
cd hotdeals/server

# Install dependencies
npm install

# Copy and edit environment variables
cp .env.example .env
nano .env   # Fill in your MySQL credentials and JWT secret

# Generate a strong JWT secret:
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"

# Start the server
npm run dev        # development (with auto-restart)
npm start          # production
```

Server runs on: **http://localhost:5000**

---

## Step 3 — Frontend Setup

```bash
# Create a new React app (if starting fresh)
npx create-react-app hotdeals-client
cd hotdeals-client

# Copy App.jsx and api.js into src/
cp /path/to/client/src/App.jsx src/
cp /path/to/client/src/api.js src/

# Set the API URL (optional, defaults to localhost:5000)
echo "REACT_APP_API_URL=http://localhost:5000/api" > .env

# Start the app
npm start
```

Frontend runs on: **http://localhost:3000**

---

## API Reference

| Method | Endpoint                   | Auth     | Description              |
|--------|----------------------------|----------|--------------------------|
| POST   | /api/auth/register         | ✗        | Register new user        |
| POST   | /api/auth/login            | ✗        | Login, returns JWT       |
| GET    | /api/auth/me               | ✓        | Get current user         |
| GET    | /api/deals                 | ✗        | List deals (filterable)  |
| GET    | /api/deals/:id             | ✗        | Get deal + comments      |
| POST   | /api/deals                 | ✓        | Submit new deal          |
| DELETE | /api/deals/:id             | ✓        | Delete deal              |
| POST   | /api/deals/:id/vote        | ✓        | Vote hot/cold            |
| POST   | /api/deals/:id/comments    | ✓        | Add comment              |
| DELETE | /api/comments/:id          | ✓        | Delete comment           |
| GET    | /api/categories            | ✗        | List categories          |
| GET    | /api/admin/deals           | 👑 Admin  | All deals (incl pending) |
| PATCH  | /api/admin/deals/:id       | 👑 Admin  | Approve/feature/expire   |
| GET    | /api/admin/users           | 👑 Admin  | All users                |
| PATCH  | /api/admin/users/:id/ban   | 👑 Admin  | Ban/unban user           |
| GET    | /api/admin/stats           | 👑 Admin  | Site statistics          |

### Query params for GET /api/deals
- `sort=hot|new` — sort order
- `category=אלקטרוניקה` — filter by category
- `search=keyword` — search title/store
- `page=1` — pagination (20 per page)

---

## Deployment Options

### Option A: VPS (DigitalOcean, Linode, AWS EC2)
```bash
# Install Node + MySQL on the server, then:
npm install -g pm2
pm2 start server/index.js --name hotdeals
pm2 save && pm2 startup

# For React build:
cd client && npm run build
# Serve with nginx pointing to build/ folder
```

### Option B: Railway (easy, free tier)
1. Push to GitHub
2. Connect Railway to your repo
3. Add a MySQL plugin in Railway
4. Set env vars in Railway dashboard
5. Deploy!

### Option C: Render + PlanetScale
- Render for the Node.js backend (free tier)
- PlanetScale for managed MySQL (free tier, 5GB)

---

## Environment Variables

```env
PORT=5000
CLIENT_URL=http://localhost:3000   # your frontend URL
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=hotdeals
JWT_SECRET=very_long_random_string_here
```
