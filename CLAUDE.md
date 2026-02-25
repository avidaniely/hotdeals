# CLAUDE.md — AI Assistant Guide for hotdeals

This file provides context for AI assistants (Claude Code and similar tools) working in this repository. Read this before making changes.

---

## Project Overview

**hotdeals** (HOTדילים) is an Israeli deals-sharing community platform. Users submit discount deals, vote them hot or cold, comment on them, and admins moderate content. The UI is in Hebrew with RTL (right-to-left) layout.

**Stack:** Node.js/Express backend + React/Vite frontend + MySQL database. Deployed on Railway (backend) and Vercel (frontend).

---

## Repository Structure

```
hotdeals/
├── CLAUDE.md              # This file
├── SETUP.md               # Setup and deployment guide
├── railway.json           # Railway deployment config
├── package-lock.json      # Root lock file (not a workspace root)
├── server/                # Express.js API server
│   ├── index.js           # Entire backend (single file, ~361 lines)
│   ├── package.json       # Backend dependencies
│   ├── schema.sql         # MySQL schema (run once to initialize DB)
│   └── env.example        # Template for required env vars
└── client/                # React SPA (Vite)
    ├── src/
    │   ├── App.jsx        # Entire frontend (single file, ~693 lines)
    │   ├── api.js         # API service layer (all fetch calls)
    │   ├── main.jsx       # React entry point
    │   ├── index.css      # Global styles
    │   └── App.css        # App-level styles
    ├── public/            # Static assets
    ├── index.html         # HTML template
    ├── vite.config.js     # Vite configuration
    ├── eslint.config.js   # ESLint flat config
    └── package.json       # Frontend dependencies
```

### Key architectural note

Both the backend and frontend are intentionally **single-file** — all server routes live in `server/index.js` and all React components live in `client/src/App.jsx`. Do **not** split these into separate files unless explicitly asked; the current structure is intentional.

---

## Development Setup

### Prerequisites
- Node.js (v18+)
- MySQL 8.x

### 1. Database
```bash
mysql -u root -p < server/schema.sql
```
This creates the `hotdeals` database, all tables, and a default admin user (`admin` / `admin123`).

### 2. Backend
```bash
cd server
cp env.example .env      # Fill in DB credentials and JWT_SECRET
npm install
npm run dev              # nodemon, auto-restarts on changes
```

### 3. Frontend
```bash
cd client
npm install
npm run dev              # Vite dev server on http://localhost:5173
```

The frontend proxies API calls to `http://localhost:5000` by default (configured via `VITE_API_URL`).

---

## Commands Reference

### Backend (`server/`)
| Command | Description |
|---------|-------------|
| `npm start` | Production start (`node index.js`) |
| `npm run dev` | Development with auto-reload (`nodemon`) |

### Frontend (`client/`)
| Command | Description |
|---------|-------------|
| `npm run dev` | Vite dev server |
| `npm run build` | Production build to `dist/` |
| `npm run lint` | ESLint check |
| `npm run preview` | Preview production build locally |

---

## Environment Variables

All env vars live in `server/.env` (copy from `server/env.example`):

| Variable | Example | Purpose |
|----------|---------|---------|
| `PORT` | `5000` | Express server port |
| `CLIENT_URL` | `http://localhost:3000` | Allowed CORS origin |
| `DB_HOST` | `localhost` | MySQL host |
| `DB_PORT` | `3306` | MySQL port |
| `DB_USER` | `root` | MySQL user |
| `DB_PASSWORD` | `secret` | MySQL password |
| `DB_NAME` | `hotdeals` | MySQL database name |
| `JWT_SECRET` | `long-random-string` | JWT signing secret |

Frontend env (optional, in `client/.env`):

| Variable | Default | Purpose |
|----------|---------|---------|
| `VITE_API_URL` | `http://localhost:5000/api` | Backend API base URL |

---

## API Endpoints

Base URL: `/api`

### Auth
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/auth/register` | None | Register new user |
| POST | `/auth/login` | None | Login, returns JWT |
| GET | `/auth/me` | JWT | Get current user |

### Deals
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/deals` | None | List deals (filterable, paginated) |
| GET | `/deals/:id` | None | Get deal with comments |
| POST | `/deals` | JWT | Submit new deal |
| DELETE | `/deals/:id` | JWT | Delete deal (owner or admin) |
| POST | `/deals/:id/vote` | JWT | Vote hot/cold on a deal |

**GET /deals query params:** `sort=hot\|new`, `category=<name>`, `search=<keyword>`, `page=<number>` (20 per page)

### Comments
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/deals/:id/comments` | JWT | Add comment |
| DELETE | `/comments/:id` | JWT | Delete comment (author or admin) |

### Categories
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/categories` | None | List all categories |

### Admin (admin role required)
| Method | Path | Description |
|--------|------|-------------|
| GET | `/admin/deals` | List all deals (pending/approved) |
| PATCH | `/admin/deals/:id` | Update deal status flags |
| GET | `/admin/users` | List all users |
| PATCH | `/admin/users/:id/ban` | Ban/unban a user |
| GET | `/admin/stats` | Platform statistics |

---

## Database Schema

Tables in `hotdeals` database:

- **users** — `id, username, email, password_hash, role (user|admin), is_banned, created_at`
- **categories** — `id, name` (9 Hebrew category names pre-seeded)
- **deals** — `id, user_id, category_id, title, description, original_price, deal_price, deal_url, image_url, is_approved, is_featured, is_expired, created_at`
- **votes** — `id, user_id, deal_id, vote_type (hot|cold), created_at` (unique per user/deal)
- **comments** — `id, user_id, deal_id, content, created_at`

All foreign keys use `ON DELETE CASCADE`.

---

## Frontend Architecture

### Component Structure (all in `App.jsx`)
- `App` — Root component, manages global state (auth, deals, modals, filters)
- `DealCard` — Individual deal display with vote counts
- `DealModal` — Deal detail view with comments
- `LoginModal` — Authentication
- `RegisterModal` — User registration
- `NewDealModal` — Deal submission form
- `AdminPanel` — Admin dashboard

### State Management
- React `useState` and `useEffect` hooks only — no Redux or Context API
- Auth token stored in `localStorage` under key `token`
- All API calls centralized in `client/src/api.js`

### Styling Conventions
- Inline styles via `style={{}}` props (primary method)
- Some global CSS in `index.css` and `App.css`
- `<style>` tags injected inside JSX for media queries
- RTL layout: `direction: 'rtl'` applied at root level
- Hebrew fonts: **Assistant** and **Heebo** (Google Fonts)
- Color scheme: orange/yellow gradient (`#ff6b35`, `#ffd700`, `#ff8c00`)

### API Layer (`api.js`)
Organized into named modules:
- `authAPI` — register, login, me
- `dealsAPI` — list, get, create, delete, vote
- `commentsAPI` — add, delete
- `categoriesAPI` — list
- `adminAPI` — deals, stats, users, ban/update

All functions return parsed JSON or throw on HTTP errors. Token is read from `localStorage` on each call.

---

## Backend Architecture

### Middleware Stack (in order)
1. CORS — allows `localhost:3000`, `localhost:5173`, and `*.vercel.app`
2. `express.json()` — body parsing
3. `authenticateToken` — JWT middleware (applied per-route, not globally)

### Auth Middleware
`authenticateToken(req, res, next)` — reads `Authorization: Bearer <token>`, verifies JWT, attaches `req.user`. Returns 401/403 on failure.

`requireAdmin(req, res, next)` — checks `req.user.role === 'admin'`. Must be called after `authenticateToken`.

### Database
- Uses `mysql2/promise` with a connection pool
- Pool created once on startup, exported as `pool`
- All queries use parameterized placeholders (`?`) — never concatenate user input into SQL

### Error Handling
- Try/catch on every async route handler
- Returns `{ error: 'message' }` JSON with appropriate HTTP status
- `500` for unexpected server errors, `400` for validation, `401/403` for auth, `404` for not found

---

## Code Conventions

### JavaScript Style
- ES Modules (`import`/`export`) in the frontend (Vite/ESM)
- CommonJS (`require`) in the backend (Node.js without `"type": "module"`)
- `async/await` everywhere — no `.then()` chains
- No TypeScript — plain `.js` and `.jsx`

### Naming
- Variables and functions: `camelCase`
- React components: `PascalCase`
- SQL table/column names: `snake_case`
- Environment variables: `UPPER_SNAKE_CASE`

### Security
- Passwords hashed with `bcryptjs` (10 rounds)
- JWTs expire after `7d`
- All SQL queries use parameterized statements
- User input is never interpolated into queries
- Admin routes protected by `requireAdmin` middleware

---

## Deployment

### Backend → Railway
- Config: `railway.json`
- Builder: NIXPACKS
- Build command: `npm install`
- Start command: `node index.js`
- Set all env vars from `server/env.example` in Railway dashboard

### Frontend → Vercel
- Root directory: `client/`
- Build command: `npm run build`
- Output directory: `dist/`
- Set `VITE_API_URL` to the Railway backend URL

---

## No Tests

This project currently has **no test suite**. There is no Jest, Vitest, or any testing framework configured. Do not add test runner dependencies without explicit user instruction.

---

## Known Constraints

- **Single-file architecture is intentional** — both `server/index.js` and `client/src/App.jsx` are large monolithic files by design. Do not refactor into multiple files unless asked.
- **No TypeScript** — the project uses plain JavaScript.
- **Hebrew/RTL UI** — all user-facing text is in Hebrew. Preserve RTL layout when modifying components.
- **bcryptjs (not bcrypt)** — uses the pure-JS bcryptjs package for Railway compatibility; do not swap back to native bcrypt.
- **Vite beta** — client uses `vite@8.0.0-beta.13`. Be aware this is a pre-release version.
