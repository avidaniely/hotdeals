// ============================================================
//  HOTדילים - Express + MySQL Backend
//  File: server/index.js
// ============================================================
require('dotenv').config();
const express  = require('express');
const cors     = require('cors');
const bcrypt   = require('bcrypt');
const jwt      = require('jsonwebtoken');
const mysql    = require('mysql2/promise');

const app  = express();
const PORT = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET || 'hotdeals_secret_change_in_production';

// ── Middleware ───────────────────────────────────────────────
app.use(cors({ origin: process.env.CLIENT_URL || 'http://localhost:3000', credentials: true }));
app.use(express.json());

// ── DB Pool ──────────────────────────────────────────────────
const db = mysql.createPool({
  host:     process.env.DB_HOST     || 'localhost',
  port:     process.env.DB_PORT     || 3306,
  user:     process.env.DB_USER     || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME     || 'hotdeals',
  waitForConnections: true,
  connectionLimit: 10,
});

// ── Auth Middleware ──────────────────────────────────────────
const auth = async (req, res, next) => {
  const header = req.headers.authorization;
  if (!header) return res.status(401).json({ error: 'לא מחובר' });
  try {
    req.user = jwt.verify(header.replace('Bearer ', ''), JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'טוקן לא תקין' });
  }
};

const adminAuth = async (req, res, next) => {
  await auth(req, res, async () => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'אין הרשאה' });
    next();
  });
};

// ── Helper: deal query ───────────────────────────────────────
const DEAL_SELECT = `
  SELECT
    d.*,
    c.name            AS category,
    u.username,
    u.avatar,
    COALESCE(SUM(v.vote_type = 'hot'),  0) AS hot,
    COALESCE(SUM(v.vote_type = 'cold'), 0) AS cold,
    COUNT(DISTINCT cm.id)                  AS comment_count
  FROM deals d
  JOIN categories c ON d.category_id = c.id
  JOIN users u      ON d.user_id = u.id
  LEFT JOIN votes v    ON v.deal_id = d.id
  LEFT JOIN comments cm ON cm.deal_id = d.id
`;
const DEAL_GROUP = `GROUP BY d.id`;

// ════════════════════════════════════════════════════════════
//  AUTH ROUTES
// ════════════════════════════════════════════════════════════

// POST /api/auth/register
app.post('/api/auth/register', async (req, res) => {
  const { username, email, password } = req.body;
  if (!username || !email || !password)
    return res.status(400).json({ error: 'כל השדות חובה' });
  try {
    const hash = await bcrypt.hash(password, 10);
    const avatars = ['🐱','🦊','🐸','🦋','🐧','🦁','🐨','🦄','🐙','🦅'];
    const avatar  = avatars[Math.floor(Math.random() * avatars.length)];
    const [result] = await db.execute(
      'INSERT INTO users (username, email, password, avatar) VALUES (?, ?, ?, ?)',
      [username, email, hash, avatar]
    );
    const token = jwt.sign(
      { id: result.insertId, username, avatar, role: 'user' },
      JWT_SECRET, { expiresIn: '30d' }
    );
    res.json({ token, user: { id: result.insertId, username, email, avatar, role: 'user' } });
  } catch (e) {
    if (e.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'שם משתמש או אימייל כבר קיים' });
    console.error(e);
    res.status(500).json({ error: 'שגיאת שרת' });
  }
});

// POST /api/auth/login
app.post('/api/auth/login', async (req, res) => {
  const { username, password } = req.body;
  try {
    const [[user]] = await db.execute(
      'SELECT * FROM users WHERE username = ?', [username]
    );
    if (!user) return res.status(401).json({ error: 'שם משתמש או סיסמה שגויים' });
    if (user.is_banned) return res.status(403).json({ error: 'החשבון שלך חסום' });
    const ok = await bcrypt.compare(password, user.password);
    if (!ok) return res.status(401).json({ error: 'שם משתמש או סיסמה שגויים' });
    const token = jwt.sign(
      { id: user.id, username: user.username, avatar: user.avatar, role: user.role },
      JWT_SECRET, { expiresIn: '30d' }
    );
    res.json({
      token,
      user: { id: user.id, username: user.username, email: user.email, avatar: user.avatar, role: user.role }
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'שגיאת שרת' });
  }
});

// GET /api/auth/me
app.get('/api/auth/me', auth, async (req, res) => {
  const [[user]] = await db.execute(
    'SELECT id, username, email, avatar, role, created_at FROM users WHERE id = ?',
    [req.user.id]
  );
  res.json(user);
});

// ════════════════════════════════════════════════════════════
//  CATEGORIES
// ════════════════════════════════════════════════════════════

app.get('/api/categories', async (req, res) => {
  const [rows] = await db.execute('SELECT * FROM categories ORDER BY name');
  res.json(rows);
});

// ════════════════════════════════════════════════════════════
//  DEALS
// ════════════════════════════════════════════════════════════

// GET /api/deals  ?category=X&sort=hot|new&search=Y&page=1
app.get('/api/deals', async (req, res) => {
  try {
    const { category, sort = 'hot', search, page = 1 } = req.query;
    const limit  = 20;
    const offset = (page - 1) * limit;
    const params = [];
    let where = 'WHERE d.is_approved = 1 ';

    if (category) {
      where += 'AND c.name = ? ';
      params.push(category);
    }
    if (search) {
      where += 'AND (d.title LIKE ? OR d.store LIKE ?) ';
      params.push(`%${search}%`, `%${search}%`);
    }

    const orderBy = sort === 'hot'
      ? 'ORDER BY (hot - cold) DESC, d.created_at DESC'
      : 'ORDER BY d.created_at DESC';

    const [rows] = await db.execute(
      `${DEAL_SELECT} ${where} ${DEAL_GROUP} ${orderBy} LIMIT ${limit} OFFSET ${offset}`,
      params
    );
    const [[{ total }]] = await db.execute(
      `SELECT COUNT(DISTINCT d.id) AS total FROM deals d JOIN categories c ON d.category_id = c.id ${where}`,
      params
    );
    res.json({ deals: rows, total, page: +page, pages: Math.ceil(total / limit) });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'שגיאת שרת' });
  }
});

// GET /api/deals/:id
app.get('/api/deals/:id', async (req, res) => {
  const [[deal]] = await db.execute(
    `${DEAL_SELECT} WHERE d.id = ? ${DEAL_GROUP}`, [req.params.id]
  );
  if (!deal) return res.status(404).json({ error: 'לא נמצא' });
  const [comments] = await db.execute(
    `SELECT cm.*, u.username, u.avatar
     FROM comments cm JOIN users u ON cm.user_id = u.id
     WHERE cm.deal_id = ? ORDER BY cm.created_at ASC`,
    [req.params.id]
  );
  res.json({ ...deal, comments });
});

// POST /api/deals
app.post('/api/deals', auth, async (req, res) => {
  const { title, description, url, image_url, store, original_price, deal_price, category_id } = req.body;
  if (!title || !deal_price || !category_id)
    return res.status(400).json({ error: 'שדות חובה חסרים' });
  try {
    const is_approved = req.user.role === 'admin' ? 1 : 0;
    const [result] = await db.execute(
      `INSERT INTO deals (user_id, category_id, title, description, url, image_url, store, original_price, deal_price, is_approved)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [req.user.id, category_id, title, description, url, image_url, store, original_price, deal_price, is_approved]
    );
    res.json({ id: result.insertId, approved: !!is_approved });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'שגיאת שרת' });
  }
});

// DELETE /api/deals/:id
app.delete('/api/deals/:id', auth, async (req, res) => {
  const [[deal]] = await db.execute('SELECT user_id FROM deals WHERE id = ?', [req.params.id]);
  if (!deal) return res.status(404).json({ error: 'לא נמצא' });
  if (deal.user_id !== req.user.id && req.user.role !== 'admin')
    return res.status(403).json({ error: 'אין הרשאה' });
  await db.execute('DELETE FROM deals WHERE id = ?', [req.params.id]);
  res.json({ success: true });
});

// ════════════════════════════════════════════════════════════
//  VOTES
// ════════════════════════════════════════════════════════════

// POST /api/deals/:id/vote  { vote_type: 'hot'|'cold' }
app.post('/api/deals/:id/vote', auth, async (req, res) => {
  const { vote_type } = req.body;
  if (!['hot', 'cold'].includes(vote_type))
    return res.status(400).json({ error: 'סוג הצבעה לא תקין' });
  try {
    const [[existing]] = await db.execute(
      'SELECT id, vote_type FROM votes WHERE deal_id = ? AND user_id = ?',
      [req.params.id, req.user.id]
    );
    if (existing) {
      if (existing.vote_type === vote_type) {
        // undo vote
        await db.execute('DELETE FROM votes WHERE id = ?', [existing.id]);
        return res.json({ action: 'removed' });
      }
      await db.execute('UPDATE votes SET vote_type = ? WHERE id = ?', [vote_type, existing.id]);
      return res.json({ action: 'changed', vote_type });
    }
    await db.execute(
      'INSERT INTO votes (deal_id, user_id, vote_type) VALUES (?, ?, ?)',
      [req.params.id, req.user.id, vote_type]
    );
    res.json({ action: 'added', vote_type });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'שגיאת שרת' });
  }
});

// GET /api/deals/:id/my-vote  (returns user's current vote)
app.get('/api/deals/:id/my-vote', auth, async (req, res) => {
  const [[row]] = await db.execute(
    'SELECT vote_type FROM votes WHERE deal_id = ? AND user_id = ?',
    [req.params.id, req.user.id]
  );
  res.json({ vote_type: row?.vote_type || null });
});

// ════════════════════════════════════════════════════════════
//  COMMENTS
// ════════════════════════════════════════════════════════════

// POST /api/deals/:id/comments
app.post('/api/deals/:id/comments', auth, async (req, res) => {
  const { text } = req.body;
  if (!text?.trim()) return res.status(400).json({ error: 'תגובה ריקה' });
  const [result] = await db.execute(
    'INSERT INTO comments (deal_id, user_id, text) VALUES (?, ?, ?)',
    [req.params.id, req.user.id, text.trim()]
  );
  res.json({
    id: result.insertId,
    deal_id: +req.params.id,
    user_id: req.user.id,
    username: req.user.username,
    avatar: req.user.avatar,
    text: text.trim(),
    created_at: new Date(),
  });
});

// DELETE /api/comments/:id
app.delete('/api/comments/:id', auth, async (req, res) => {
  const [[comment]] = await db.execute('SELECT user_id FROM comments WHERE id = ?', [req.params.id]);
  if (!comment) return res.status(404).json({ error: 'לא נמצא' });
  if (comment.user_id !== req.user.id && req.user.role !== 'admin')
    return res.status(403).json({ error: 'אין הרשאה' });
  await db.execute('DELETE FROM comments WHERE id = ?', [req.params.id]);
  res.json({ success: true });
});

// ════════════════════════════════════════════════════════════
//  ADMIN ROUTES
// ════════════════════════════════════════════════════════════

// GET /api/admin/deals  (all deals including unapproved)
app.get('/api/admin/deals', adminAuth, async (req, res) => {
  const [rows] = await db.execute(
    `${DEAL_SELECT} ${DEAL_GROUP} ORDER BY d.created_at DESC`
  );
  res.json(rows);
});

// PATCH /api/admin/deals/:id
app.patch('/api/admin/deals/:id', adminAuth, async (req, res) => {
  const allowed = ['is_approved', 'is_featured', 'is_expired'];
  const updates = Object.entries(req.body).filter(([k]) => allowed.includes(k));
  if (!updates.length) return res.status(400).json({ error: 'אין שדות לעדכון' });
  const set    = updates.map(([k]) => `${k} = ?`).join(', ');
  const values = [...updates.map(([, v]) => v), req.params.id];
  await db.execute(`UPDATE deals SET ${set} WHERE id = ?`, values);
  res.json({ success: true });
});

// GET /api/admin/users
app.get('/api/admin/users', adminAuth, async (req, res) => {
  const [rows] = await db.execute(
    'SELECT id, username, email, avatar, role, is_banned, created_at FROM users ORDER BY created_at DESC'
  );
  res.json(rows);
});

// PATCH /api/admin/users/:id/ban
app.patch('/api/admin/users/:id/ban', adminAuth, async (req, res) => {
  const [[user]] = await db.execute('SELECT is_banned FROM users WHERE id = ?', [req.params.id]);
  if (!user) return res.status(404).json({ error: 'משתמש לא נמצא' });
  const newStatus = user.is_banned ? 0 : 1;
  await db.execute('UPDATE users SET is_banned = ? WHERE id = ?', [newStatus, req.params.id]);
  res.json({ is_banned: newStatus });
});

// GET /api/admin/stats
app.get('/api/admin/stats', adminAuth, async (req, res) => {
  const [[{ total_deals }]]   = await db.execute('SELECT COUNT(*) AS total_deals FROM deals');
  const [[{ pending }]]       = await db.execute('SELECT COUNT(*) AS pending FROM deals WHERE is_approved = 0');
  const [[{ total_users }]]   = await db.execute('SELECT COUNT(*) AS total_users FROM users');
  const [[{ total_comments }]]= await db.execute('SELECT COUNT(*) AS total_comments FROM comments');
  const [[{ featured }]]      = await db.execute('SELECT COUNT(*) AS featured FROM deals WHERE is_featured = 1');
  res.json({ total_deals, pending, total_users, total_comments, featured });
});

// ── Start ────────────────────────────────────────────────────
app.listen(PORT, () => console.log(`🔥 HOTדילים server running on port ${PORT}`));
