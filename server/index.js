// ============================================================
//  HOTדילים - Express + MySQL Backend
//  File: server/index.js
// ============================================================
require('dotenv').config();
const express  = require('express');
const cors     = require('cors');
const bcrypt   = require('bcryptjs');
const jwt      = require('jsonwebtoken');
const mysql    = require('mysql2/promise');
const { startScheduler, runHunter } = require('./agent/dealHunter');
const { startOpenAIScheduler, runOpenAIJob, importDealsFromPayload } = require('./agent/openaiDealer');

const app  = express();
const PORT = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET || 'hotdeals_secret_change_in_production';

// ── Middleware ───────────────────────────────────────────────
app.use(cors({
  origin: [
    'http://localhost:5173',
    'http://localhost:3000',
    process.env.CLIENT_URL,
    /\.vercel\.app$/
  ],
  credentials: true
}));
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

// ── Auto-migrate & seed ──────────────────────────────────────
(async () => {
  try {
    // hunter_sources table
    await db.execute(`
      CREATE TABLE IF NOT EXISTS hunter_sources (
        id            INT AUTO_INCREMENT PRIMARY KEY,
        name          VARCHAR(100) NOT NULL,
        url           TEXT         NOT NULL,
        store         VARCHAR(100) NOT NULL,
        category_name VARCHAR(100) NOT NULL DEFAULT 'אלקטרוניקה',
        is_active     TINYINT(1)   NOT NULL DEFAULT 1,
        created_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Seed default sources if empty
    const [[{ cnt }]] = await db.execute('SELECT COUNT(*) AS cnt FROM hunter_sources');
    if (cnt === 0) {
      await db.execute(`
        INSERT INTO hunter_sources (name, url, store, category_name) VALUES
          ('KSP',      'https://ksp.co.il/web/cat/offers',                    'KSP',   'אלקטרוניקה'),
          ('Bug',      'https://www.bug.co.il/cat/mivtzaim',                  'Bug',   'אלקטרוניקה'),
          ('Zap Deals','https://www.zap.co.il/models.aspx?sog=v-cheapest',    'Zap',   'אלקטרוניקה'),
          ('Ivory',    'https://www.ivory.co.il/catalog.php?act=cat&id=14',   'Ivory', 'אלקטרוניקה')
      `);
      console.log('✅ Seeded default hunter sources');
    }

    // Add prompt_id column to hunter_sources (existing installs)
    await db.execute('ALTER TABLE hunter_sources ADD COLUMN prompt_id INT DEFAULT NULL')
      .catch(e => { if (e.code !== 'ER_DUP_FIELDNAME') throw e; });

    // Add use_proxy column to hunter_sources (existing installs)
    await db.execute('ALTER TABLE hunter_sources ADD COLUMN use_proxy TINYINT(1) NOT NULL DEFAULT 0')
      .catch(e => { if (e.code !== 'ER_DUP_FIELDNAME') throw e; });

    // Add search columns to hunter_sources (existing installs)
    await db.execute('ALTER TABLE hunter_sources ADD COLUMN use_search TINYINT(1) NOT NULL DEFAULT 0')
      .catch(e => { if (e.code !== 'ER_DUP_FIELDNAME') throw e; });
    await db.execute('ALTER TABLE hunter_sources ADD COLUMN search_query VARCHAR(255) DEFAULT NULL')
      .catch(e => { if (e.code !== 'ER_DUP_FIELDNAME') throw e; });

    // Add adapter_mode column to hunter_sources (http or browser)
    await db.execute("ALTER TABLE hunter_sources ADD COLUMN adapter_mode VARCHAR(10) NOT NULL DEFAULT 'http'")
      .catch(e => { if (e.code !== 'ER_DUP_FIELDNAME') throw e; });

    // hunter_prompts table
    await db.execute(`
      CREATE TABLE IF NOT EXISTS hunter_prompts (
        id           INT AUTO_INCREMENT PRIMARY KEY,
        name         VARCHAR(100) NOT NULL,
        description  VARCHAR(255),
        prompt_text  TEXT NOT NULL,
        created_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Prompt templates — defined once, used for both seed and migration updates
    const PROMPT_TEMPLATES = [
      {
        name: 'מרצנט - כללי',
        description: 'לאתרי חנויות כמו KSP, Bug, Ivory — סריקת דף מבצעים',
        prompt_text:
          'אתה AI לחילוץ דילים עבור אתר hotILdeals.\n' +
          'קיבלת טקסט מדף המבצעים של {store}. מצא עד 5 מוצרים במחיר מבצע.\n\n' +
          'עבור כל מוצר החזר אובייקט JSON עם השדות הבאים:\n' +
          '- title (string): שם המוצר, כולל מותג ודגם אם מופיע\n' +
          '- deal_price (number): מחיר המבצע בשקלים — חובה, ללא סימן ₪\n' +
          '- original_price (number|null): מחיר מקורי בשקלים אם מופיע, אחרת null\n' +
          '- description (string): משפט-שניים בעברית — מה המוצר + למה כדאי לקנות\n' +
          '- url (string|null): כתובת URL ישירה למוצר מהטקסט, null אם לא נמצאה\n\n' +
          'כלל חשוב: כלול מוצר גם אם אין מחיר מקורי — deal_price לבד מספיק.\n' +
          'דלג על מוצר רק אם אין לו מחיר ברור כלל.\n' +
          'החזר JSON array בלבד, ללא טקסט נוסף: [{"title":"...","deal_price":0,"original_price":null,"description":"...","url":null}]'
      },
      {
        name: 'אגרגטור קהילתי',
        description: 'לאתרי דילים כמו bee.deals, FXP — עם ציון פופולריות',
        prompt_text:
          'אתה AI שמחלץ דילים מאתר קהילתי בשם {store}.\n' +
          'קיבלת טקסט מהאתר המכיל פוסטים של דילים שמשתמשים שיתפו.\n\n' +
          'חלץ עד 5 דילים. עדף דילים עם הרבה הצבעות/תגובות ודילים עדכניים.\n' +
          'אם אין נתוני הצבעות — כלול בכל זאת, הכנס 0.\n\n' +
          'עבור כל דיל החזר:\n' +
          '- title (string): שם המוצר או כותרת הדיל\n' +
          '- deal_price (number): מחיר בשקלים — אם USD המר ב-3.7, אם EUR ב-4\n' +
          '- original_price (number|null): מחיר מקורי אם ידוע, אחרת null\n' +
          '- description (string): משפט-שניים בעברית — מה הדיל, באיזה חנות, למה שווה\n' +
          '- url (string|null): קישור לדיל מהטקסט\n' +
          '- votes (number): הצבעות חיוביות, 0 אם לא ידוע\n' +
          '- comments (number): מספר תגובות, 0 אם לא ידוע\n' +
          '- hours_ago (number): גיל הפוסט בשעות, 0 אם לא ידוע\n\n' +
          'החזר JSON array בלבד: [{"title":"...","deal_price":0,"original_price":null,"description":"...","url":null,"votes":0,"comments":0,"hours_ago":0}]'
      },
      {
        name: 'אלקטרוניקה מתמחה',
        description: 'לאתרי אלקטרוניקה — מתמקד בגאדג\'טים וטכנולוגיה',
        prompt_text:
          'אתה מומחה אלקטרוניקה שמחפש דילים טכנולוגיים מ-{store}.\n' +
          'קיבלת טקסט מדף מוצרים. חלץ רק מוצרי טכנולוגיה: סמארטפונים, מחשבים ניידים, טאבלטים, אוזניות, מסכים, מקלדות, עכברים, SSD, GPU, מצלמות, שעונים חכמים.\n' +
          'התעלם ממוצרים שאינם טכנולוגיה (בגדים, מזון, ספרים וכדומה).\n\n' +
          'עבור כל מוצר החזר:\n' +
          '- title (string): שם המוצר כולל מותג ודגם (לדוגמה: "Samsung Galaxy S24 128GB")\n' +
          '- deal_price (number): מחיר בשקלים, חובה\n' +
          '- original_price (number|null): מחיר מקורי אם ידוע\n' +
          '- description (string): מפרט קצר + למה זו עסקה טובה (עברית)\n' +
          '- url (string|null): קישור ישיר למוצר מהטקסט\n\n' +
          'החזר JSON array בלבד: [{"title":"...","deal_price":0,"original_price":null,"description":"...","url":null}]'
      },
      {
        name: 'בינלאומי - המרת מחיר',
        description: 'לאתרים כמו AliExpress, Banggood — המר USD/EUR ל-₪',
        prompt_text:
          'אתה AI לדילים בינלאומיים מ-{store}.\n' +
          'קיבלת טקסט מדף מבצעים. חלץ עד 5 מוצרים.\n\n' +
          'המרת מחירים ל-₪ (הכנס את הסכום בשקלים בשדה deal_price):\n' +
          '1 USD = 3.7 ₪ · 1 EUR = 4 ₪ · 1 GBP = 4.7 ₪ · 1 CNY = 0.51 ₪\n\n' +
          'עבור כל מוצר החזר:\n' +
          '- title (string): שם המוצר (עברית מועדפת)\n' +
          '- deal_price (number): מחיר לאחר המרה ל-₪\n' +
          '- original_price (number|null): מחיר מקורי לאחר המרה ל-₪, אם ידוע\n' +
          '- description (string): תיאור קצר בעברית + "מחיר מקורי: X$" + זמן משלוח אם ידוע\n' +
          '- url (string|null): קישור ישיר למוצר מהטקסט\n\n' +
          'אל תדרוש אישור משלוח לישראל — הכנס את כל המוצרים עם מחיר ברור.\n' +
          'החזר JSON array בלבד: [{"title":"...","deal_price":0,"original_price":null,"description":"...","url":null}]'
      },
      {
        name: 'חיסכון מקסימלי',
        description: 'מחפש רק הנחות של 20%+ עם מחיר מקורי ברור',
        prompt_text:
          'אתה ציד הנחות מ-{store}. מטרתך: למצוא רק עסקאות עם הנחה משמעותית.\n' +
          'כלול מוצר רק אם יש לו גם מחיר מקורי וגם מחיר מבצע, וההנחה >= 20%.\n' +
          'חשב: discount_pct = round((1 - deal_price / original_price) * 100)\n\n' +
          'עבור כל מוצר שעובר את הסף:\n' +
          '- title (string): שם המוצר\n' +
          '- deal_price (number): מחיר מבצע בשקלים\n' +
          '- original_price (number): מחיר מקורי בשקלים — חובה\n' +
          '- description (string): תיאור קצר בעברית + "הנחה של X%" במפורש\n' +
          '- url (string|null): קישור מהטקסט\n\n' +
          'מיין מהנחה הגבוהה לנמוכה. אם אין עסקאות עם 20%+ — החזר [].\n' +
          'החזר JSON array בלבד: [{"title":"...","deal_price":0,"original_price":0,"description":"...","url":null}]'
      },
      {
        name: 'חיפוש - כללי',
        description: 'למצב חיפוש (DuckDuckGo) — מחלץ דילים מתוצאות חיפוש',
        prompt_text:
          'אתה AI לחילוץ דילים עבור אתר hotILdeals.\n' +
          'קיבלת תוצאות חיפוש מ-DuckDuckGo עבור {store}. כל תוצאה מכילה: כותרת, תיאור קצר, וקישור.\n\n' +
          'עברו על התוצאות ומצא עד 5 מוצרים שנראים כעסקאות/מבצעים.\n' +
          'אפילו אם המחיר לא מפורש בתיאור — כלול את המוצר עם deal_price: 0 ו-description שמסביר שהוא נראה כמבצע.\n\n' +
          'עבור כל תוצאה רלוונטית החזר:\n' +
          '- title (string): שם המוצר מהכותרת\n' +
          '- deal_price (number): מחיר בשקלים אם מופיע בתיאור, אחרת 0\n' +
          '- original_price (number|null): מחיר מקורי אם מופיע, אחרת null\n' +
          '- description (string): תיאור קצר בעברית על המוצר והסיבה שנראה כדיל טוב\n' +
          '- url (string): הקישור מתוצאת החיפוש — חובה\n\n' +
          'החזר JSON array בלבד: [{"title":"...","deal_price":0,"original_price":null,"description":"...","url":"https://..."}]'
      }
    ];

    // Seed default prompt templates if empty
    const [[{ pCnt }]] = await db.execute('SELECT COUNT(*) AS pCnt FROM hunter_prompts');
    if (pCnt === 0) {
      for (const p of PROMPT_TEMPLATES) {
        await db.execute(
          'INSERT INTO hunter_prompts (name, description, prompt_text) VALUES (?, ?, ?)',
          [p.name, p.description, p.prompt_text]
        );
      }
      console.log('✅ Seeded default prompt templates');
    } else {
      // Update existing prompts by name
      for (const p of PROMPT_TEMPLATES) {
        await db.execute(
          'UPDATE hunter_prompts SET description = ?, prompt_text = ? WHERE name = ?',
          [p.description, p.prompt_text, p.name]
        );
      }
      console.log('✅ Updated existing prompt templates');
    }

    // Ensure aggregator sources exist (for existing installs)
    const aggregatorSources = [
      { name: 'bee.deals',     url: 'https://bee.deals/',                                          store: 'bee.deals',  category_name: 'הכל' },
      { name: 'Amazon IL',     url: 'https://www.amazon.co.il/gp/goldbox',                         store: 'Amazon',     category_name: 'הכל' },
      { name: 'Banggood',      url: 'https://www.banggood.com/deals.html',                         store: 'Banggood',   category_name: 'אלקטרוניקה' },
      { name: 'AliExpress IL', url: 'https://www.aliexpress.com/category/4000000000/deals.html',   store: 'AliExpress', category_name: 'הכל' },
      { name: 'FXP Deals',     url: 'https://www.fxp.co.il/forumdisplay.php?f=137',               store: 'FXP',        category_name: 'אלקטרוניקה' },
    ];
    for (const s of aggregatorSources) {
      const [[{ n }]] = await db.execute('SELECT COUNT(*) AS n FROM hunter_sources WHERE name = ?', [s.name]);
      if (!n) await db.execute(
        'INSERT INTO hunter_sources (name, url, store, category_name) VALUES (?,?,?,?)',
        [s.name, s.url, s.store, s.category_name]
      );
    }

    // hunter_config table
    await db.execute(`
      CREATE TABLE IF NOT EXISTS hunter_config (
        config_key   VARCHAR(100) NOT NULL PRIMARY KEY,
        config_value TEXT,
        updated_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);

    // Seed default config if empty
    const [[{ cfgCnt }]] = await db.execute('SELECT COUNT(*) AS cfgCnt FROM hunter_config');
    if (cfgCnt === 0) {
      await db.execute(`
        INSERT INTO hunter_config (config_key, config_value) VALUES
          ('ai_provider',  'anthropic'),
          ('ai_api_key',   ''),
          ('ai_model',     'claude-haiku-4-5-20251001'),
          ('ai_max_tokens','1800'),
          ('schedule',     '0 */6 * * *'),
          ('enabled',      '1'),
          ('system_prompt', 'You are a deal-extraction AI for an Israeli deals site called hotILdeals.\\nAnalyze the text below from {store}\\''s website and find the best 3–5 deals.\\n\\nFor each deal, return a JSON object with these fields:\\n- title         (string — product name, prefer Hebrew)\\n- deal_price    (number — current sale price in ₪, required)\\n- original_price (number — original price in ₪, or null)\\n- description   (string — 1–2 sentences in Hebrew describing the deal)\\n- url           (string — product page URL, or null if not found)\\n\\nRules:\\n- Only include items with a clear numeric price in ₪ (NIS).\\n- Prefer items with both original and sale price (showing a discount).\\n- If you cannot find any real deals, return an empty array [].\\n- Return ONLY a valid JSON array — no explanation, no markdown.')
      `);
      console.log('✅ Seeded default hunter config');
    }
    // Ensure threshold keys exist (for existing installations)
    for (const [k, v] of [['min_votes','5'],['min_comments','2']]) {
      await db.execute(
        'INSERT INTO hunter_config (config_key, config_value) VALUES (?,?) ON DUPLICATE KEY UPDATE config_value=config_value',
        [k, v]
      );
    }

    // Seed OpenAI Dealer config keys (won't overwrite existing values)
    const DEFAULT_OPENAI_PROMPT =
      'Scan these Israeli retail sites for today\'s deals: {{sites}}\n\n' +
      'Return 6–10 best deals per site. Score 0–100 based on discount strength, value, brand quality, demand.\n\n' +
      'Rules:\n' +
      '- Ignore out-of-stock items\n' +
      '- Ignore unclear bundles\n' +
      '- No duplicates within same site\n' +
      '- images: max 3, prefer 2, absolute URLs only\n\n' +
      'Return JSON only. No markdown. No commentary.\n\n' +
      'Schema:\n' +
      '{"d":"YYYY-MM-DD","k":["r","n","p","o","dp","s","u","i"],"sites":{"site.com":[[1,"name",999,1299,23,87,"https://url",["https://img1"]]]}}\n\n' +
      'Field order per deal array: rank, product_name, price_ils, old_price_ils, discount_percent, score, product_url, images';

    for (const [k, v] of [
      ['openai_enabled',       '0'],
      ['openai_model',         'gpt-4o-mini'],
      ['openai_sites',         '["ksp.co.il","ivory.co.il","bug.co.il"]'],
      ['openai_schedule',      '0 8 * * *'],
      ['openai_timeout',       '60000'],
      ['openai_max_retries',   '3'],
      ['openai_last_run',      ''],
      ['openai_last_status',   ''],
      ['openai_last_error',    ''],
      ['openai_last_response', ''],
      ['openai_prompt',           DEFAULT_OPENAI_PROMPT],
      ['openai_scoring_prompt',   ''],
      ['openai_candidate_limit',  '20'],
    ]) {
      await db.execute(
        'INSERT INTO hunter_config (config_key, config_value) VALUES (?,?) ON DUPLICATE KEY UPDATE config_value=config_value',
        [k, v]
      );
    }
    console.log('✅ OpenAI Dealer config seeded');
  } catch (e) {
    console.error('Migration error:', e.message);
  }
})();

// ── Auto-assign prompts to sources + update intl prompt ──────
(async () => {
  try {
    // Update international prompt with Israel-shipping awareness
    const intlPrompt = `אתה AI לדילים בינלאומיים מ-{store} עבור קונים ישראלים.\n\nחוקים:\n1. כלול רק מוצרים שניתן לשלוח לישראל (Israel / IL)\n2. חשב deal_price = מחיר המוצר + עלות משלוח לישראל (בשקלים)\n3. המר: 1 USD ≈ 3.7 ₪ | 1 EUR ≈ 4 ₪ | 1 GBP ≈ 4.7 ₪\n4. אם משלוח חינם — deal_price = מחיר המוצר בלבד\n5. אם המוצר לא נשלח לישראל — דלג עליו לחלוטין\n\nעבור כל דיל:\n- title: שם המוצר\n- deal_price: מחיר סופי כולל משלוח לישראל (₪)\n- original_price: מחיר מקורי של המוצר ללא מבצע (₪)\n- description: תיאור קצר + ציין "כולל משלוח ₪XX" או "משלוח חינם"\n- url: קישור למוצר\n- shipping_cost_ils: עלות משלוח לישראל (₪, 0 אם חינם)\n\nהחזר JSON בלבד: [{"title":"...","deal_price":0,"original_price":null,"description":"...","url":"...","shipping_cost_ils":0}]`;

    await db.execute(
      `UPDATE hunter_prompts SET prompt_text = ? WHERE name = 'בינלאומי - המרת מחיר'`,
      [intlPrompt]
    );

    // Auto-assign prompts to sources that have none
    const promptAssignMap = [
      { sourceNames: ['KSP','Bug','Zap Deals','Ivory','Amazon IL'],       promptName: 'מרצ\'נט כללי'           },
      { sourceNames: ['bee.deals','FXP Deals'],                            promptName: 'אגרגטור קהילתי'          },
      { sourceNames: ['AliExpress IL','Banggood'],                         promptName: 'בינלאומי - המרת מחיר'   },
    ];
    for (const { sourceNames, promptName } of promptAssignMap) {
      const [[prompt]] = await db.execute('SELECT id FROM hunter_prompts WHERE name = ?', [promptName]);
      if (!prompt) continue;
      for (const name of sourceNames) {
        await db.execute(
          'UPDATE hunter_sources SET prompt_id = ? WHERE name = ? AND (prompt_id IS NULL)',
          [prompt.id, name]
        );
      }
    }
    console.log('✅ Prompt auto-assignment done');
  } catch (e) {
    console.error('Prompt assignment migration:', e.message);
  }
})();

// ── Auto-migrate quality_score column ────────────────────────
(async () => {
  try {
    await db.execute('ALTER TABLE deals ADD COLUMN quality_score FLOAT DEFAULT NULL');
    console.log('✅ Added quality_score column');
  } catch (e) {
    if (e.code !== 'ER_DUP_FIELDNAME') console.error('quality_score migration:', e.message);
  }
})();

// ── Auto-migrate hunter_logs ──────────────────────────────────
(async () => {
  try {
    await db.execute(`
      CREATE TABLE IF NOT EXISTS hunter_logs (
        id               INT AUTO_INCREMENT PRIMARY KEY,
        run_at           DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
        triggered_by     VARCHAR(20)  NOT NULL DEFAULT 'manual',
        source_name      VARCHAR(100) DEFAULT NULL,
        total_found      INT          NOT NULL DEFAULT 0,
        total_skipped    INT          NOT NULL DEFAULT 0,
        errors           TEXT,
        duration_seconds INT          NOT NULL DEFAULT 0
      )
    `);
    await db.execute('ALTER TABLE hunter_logs ADD COLUMN source_name VARCHAR(100) DEFAULT NULL')
      .catch(e => { if (e.code !== 'ER_DUP_FIELDNAME') throw e; });
  } catch (e) {
    console.error('hunter_logs migration error:', e.message);
  }
})();

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
  try {
    const [rows] = await db.execute('SELECT * FROM categories ORDER BY name');
    res.json(rows);
  } catch (e) {
    console.error('DB error:', e.message);
    res.status(500).json({ error: 'שגיאת שרת', detail: e.message });
  }
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
      ? "ORDER BY (COALESCE(SUM(v.vote_type = 'hot'), 0) - COALESCE(SUM(v.vote_type = 'cold'), 0)) DESC, d.created_at DESC"
      : sort === 'quality'
      ? 'ORDER BY ISNULL(d.quality_score), d.quality_score DESC, d.created_at DESC'
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

// ════════════════════════════════════════════════════════════
//  DEAL HUNTER
// ════════════════════════════════════════════════════════════

// POST /api/admin/hunt  — trigger manually (all sources)
app.post('/api/admin/hunt', adminAuth, async (req, res) => {
  try {
    const result = await runHunter(db, 'manual');
    res.json(result);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});

// POST /api/admin/hunt/:id  — trigger a single source
app.post('/api/admin/hunt/:id', adminAuth, async (req, res) => {
  try {
    const result = await runHunter(db, 'manual', req.params.id);
    res.json(result);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});

// ════════════════════════════════════════════════════════════
//  HUNTER SOURCES (admin)
// ════════════════════════════════════════════════════════════

// GET /api/admin/sources
app.get('/api/admin/sources', adminAuth, async (req, res) => {
  const [rows] = await db.execute(`
    SELECT hs.*, hp.name AS prompt_name
    FROM hunter_sources hs
    LEFT JOIN hunter_prompts hp ON hp.id = hs.prompt_id
    ORDER BY hs.created_at DESC
  `);
  res.json(rows);
});

// POST /api/admin/sources
app.post('/api/admin/sources', adminAuth, async (req, res) => {
  const { name, url, store, category_name } = req.body;
  if (!name || !url || !store) return res.status(400).json({ error: 'name, url, store חובה' });
  const [result] = await db.execute(
    'INSERT INTO hunter_sources (name, url, store, category_name) VALUES (?, ?, ?, ?)',
    [name, url, store, category_name || 'אלקטרוניקה']
  );
  res.json({ id: result.insertId, name, url, store, category_name: category_name || 'אלקטרוניקה', is_active: 1 });
});

// PATCH /api/admin/sources/:id
app.patch('/api/admin/sources/:id', adminAuth, async (req, res) => {
  const { is_active, prompt_id, use_proxy, adapter_mode, name, url, store, category_name } = req.body;
  if (is_active !== undefined)
    await db.execute('UPDATE hunter_sources SET is_active = ? WHERE id = ?', [is_active ? 1 : 0, req.params.id]);
  if (prompt_id !== undefined)
    await db.execute('UPDATE hunter_sources SET prompt_id = ? WHERE id = ?', [prompt_id || null, req.params.id]);
  if (use_proxy !== undefined)
    await db.execute('UPDATE hunter_sources SET use_proxy = ? WHERE id = ?', [use_proxy ? 1 : 0, req.params.id]);
  if (adapter_mode !== undefined)
    await db.execute("UPDATE hunter_sources SET adapter_mode = ? WHERE id = ?", [adapter_mode === 'browser' ? 'browser' : 'http', req.params.id]);
  if (name !== undefined || url !== undefined || store !== undefined || category_name !== undefined || use_search !== undefined || search_query !== undefined) {
    const { use_search: us, search_query: sq } = req.body;
    const fields = [], vals = [];
    if (name          !== undefined) { fields.push('name=?');          vals.push(name); }
    if (url           !== undefined) { fields.push('url=?');           vals.push(url); }
    if (store         !== undefined) { fields.push('store=?');         vals.push(store); }
    if (category_name !== undefined) { fields.push('category_name=?'); vals.push(category_name); }
    if (us            !== undefined) { fields.push('use_search=?');    vals.push(us ? 1 : 0); }
    if (sq            !== undefined) { fields.push('search_query=?');  vals.push(sq || null); }
    vals.push(req.params.id);
    await db.execute(`UPDATE hunter_sources SET ${fields.join(',')} WHERE id=?`, vals);
  }
  res.json({ success: true });
});

// DELETE /api/admin/sources/:id
app.delete('/api/admin/sources/:id', adminAuth, async (req, res) => {
  await db.execute('DELETE FROM hunter_sources WHERE id = ?', [req.params.id]);
  res.json({ success: true });
});

// ════════════════════════════════════════════════════════════
//  HUNTER PROMPTS (admin)
// ════════════════════════════════════════════════════════════

// GET /api/admin/prompts
app.get('/api/admin/prompts', adminAuth, async (req, res) => {
  const [rows] = await db.execute('SELECT * FROM hunter_prompts ORDER BY created_at ASC');
  res.json(rows);
});

// POST /api/admin/prompts
app.post('/api/admin/prompts', adminAuth, async (req, res) => {
  const { name, description, prompt_text } = req.body;
  if (!name || !prompt_text) return res.status(400).json({ error: 'name ו-prompt_text חובה' });
  const [result] = await db.execute(
    'INSERT INTO hunter_prompts (name, description, prompt_text) VALUES (?,?,?)',
    [name, description || '', prompt_text]
  );
  res.json({ id: result.insertId, name, description: description || '', prompt_text });
});

// PATCH /api/admin/prompts/:id
app.patch('/api/admin/prompts/:id', adminAuth, async (req, res) => {
  const { name, description, prompt_text } = req.body;
  const fields = [], vals = [];
  if (name        !== undefined) { fields.push('name=?');        vals.push(name); }
  if (description !== undefined) { fields.push('description=?'); vals.push(description); }
  if (prompt_text !== undefined) { fields.push('prompt_text=?'); vals.push(prompt_text); }
  if (!fields.length) return res.status(400).json({ error: 'nothing to update' });
  vals.push(req.params.id);
  await db.execute(`UPDATE hunter_prompts SET ${fields.join(',')} WHERE id=?`, vals);
  res.json({ success: true });
});

// DELETE /api/admin/prompts/:id
app.delete('/api/admin/prompts/:id', adminAuth, async (req, res) => {
  await db.execute('UPDATE hunter_sources SET prompt_id = NULL WHERE prompt_id = ?', [req.params.id]);
  await db.execute('DELETE FROM hunter_prompts WHERE id = ?', [req.params.id]);
  res.json({ success: true });
});

// ════════════════════════════════════════════════════════════
//  HUNTER CONFIG (admin)
// ════════════════════════════════════════════════════════════

// GET /api/admin/hunter-config  — returns config as { key: value } object
app.get('/api/admin/hunter-config', adminAuth, async (req, res) => {
  const [rows] = await db.execute('SELECT config_key, config_value FROM hunter_config');
  const config = Object.fromEntries(rows.map(r => [r.config_key, r.config_value]));
  // Mask the API key
  if (config.ai_api_key) config.ai_api_key = config.ai_api_key ? '••••••••' : '';
  res.json(config);
});

// PATCH /api/admin/hunter-config  — upsert one or more keys
app.patch('/api/admin/hunter-config', adminAuth, async (req, res) => {
  const allowed = ['ai_provider','ai_api_key','ai_model','ai_max_tokens','schedule','enabled','min_votes','min_comments','vpn_proxy'];
  const entries = Object.entries(req.body).filter(([k]) => allowed.includes(k));
  if (!entries.length) return res.status(400).json({ error: 'no valid keys' });
  for (const [key, value] of entries) {
    // Don't overwrite api key with mask
    if (key === 'ai_api_key' && value === '••••••••') continue;
    await db.execute(
      'INSERT INTO hunter_config (config_key, config_value) VALUES (?,?) ON DUPLICATE KEY UPDATE config_value=?',
      [key, value, value]
    );
  }
  res.json({ success: true });
});

// ════════════════════════════════════════════════════════════
//  HUNTER LOGS (admin)
// ════════════════════════════════════════════════════════════

// GET /api/admin/hunter-logs
app.get('/api/admin/hunter-logs', adminAuth, async (req, res) => {
  const [rows] = await db.execute(
    'SELECT * FROM hunter_logs ORDER BY run_at DESC LIMIT 100'
  );
  res.json(rows);
});

// ════════════════════════════════════════════════════════════
//  IMPORT DEALS (from external AI agent)
// ════════════════════════════════════════════════════════════

// POST /api/admin/import-deals
app.post('/api/admin/import-deals', adminAuth, async (req, res) => {
  try {
    const payload = req.body.payload || req.body;
    if (!payload || !payload.sites) return res.status(400).json({ error: 'Missing payload.sites' });
    const result = await importDealsFromPayload(payload, db);
    res.json(result);
  } catch (e) {
    console.error('import-deals error:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// ════════════════════════════════════════════════════════════
//  OPENAI DEALER CONFIG & RUN (admin)
// ════════════════════════════════════════════════════════════

// GET /api/admin/openai-config
app.get('/api/admin/openai-config', adminAuth, async (req, res) => {
  const [rows] = await db.execute(
    "SELECT config_key, config_value FROM hunter_config WHERE config_key LIKE 'openai_%'"
  );
  const config = Object.fromEntries(rows.map(r => [r.config_key, r.config_value]));
  res.json(config);
});

// POST /api/admin/openai-config
app.post('/api/admin/openai-config', adminAuth, async (req, res) => {
  const allowed = ['openai_enabled','openai_model','openai_sites','openai_schedule','openai_timeout','openai_max_retries','openai_prompt','openai_scoring_prompt','openai_candidate_limit'];
  const entries = Object.entries(req.body).filter(([k]) => allowed.includes(k));
  if (!entries.length) return res.status(400).json({ error: 'no valid keys' });
  for (const [key, value] of entries) {
    await db.execute(
      'INSERT INTO hunter_config (config_key, config_value) VALUES (?,?) ON DUPLICATE KEY UPDATE config_value=?',
      [key, value, value]
    );
  }
  res.json({ success: true });
});

// POST /api/admin/openai-run  — manual trigger
app.post('/api/admin/openai-run', adminAuth, async (req, res) => {
  try {
    const result = await runOpenAIJob(db, 'manual');
    res.json(result);
  } catch (e) {
    console.error('openai-run error:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// ── Start ────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`🔥 hotILdeals server running on port ${PORT}`);
  startScheduler(db);
  startOpenAIScheduler(db);
});
