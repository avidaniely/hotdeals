// ============================================================
//  Deal Hunter — AI Agent
//  Scrapes Israeli deal sites every 6 hours, extracts deals
//  with Claude (or other AI), and submits them for admin approval.
// ============================================================
const cron      = require('node-cron');
const axios     = require('axios');
const cheerio   = require('cheerio');
const Anthropic = require('@anthropic-ai/sdk');

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept-Language': 'he-IL,he;q=0.9,en;q=0.8',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
};

// ── Load config from DB ───────────────────────────────────────
async function loadConfig(db) {
  const [rows] = await db.execute('SELECT config_key, config_value FROM hunter_config');
  return Object.fromEntries(rows.map(r => [r.config_key, r.config_value]));
}

// ── Scrape ───────────────────────────────────────────────────
async function fetchPage(url) {
  const { data } = await axios.get(url, { headers: HEADERS, timeout: 15000 });
  return data;
}

function extractText(html) {
  const $ = cheerio.load(html);
  $('script, style, nav, footer, header, noscript, iframe').remove();
  return $('body').text().replace(/\s+/g, ' ').trim().slice(0, 7000);
}

// ── AI extraction ─────────────────────────────────────────────
async function extractDealsWithAI(pageText, source, config) {
  const apiKey = config.ai_api_key || process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('No AI API key configured');

  const prompt = (config.system_prompt || '').replace('{store}', source.store)
    + `\n\nPage text from ${source.store}:\n${pageText}`;

  const client = new Anthropic({ apiKey });
  const msg = await client.messages.create({
    model: config.ai_model || 'claude-haiku-4-5-20251001',
    max_tokens: parseInt(config.ai_max_tokens) || 1800,
    messages: [{ role: 'user', content: prompt }],
  });

  try {
    const text = msg.content[0].text.trim();
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (jsonMatch) return JSON.parse(jsonMatch[0]);
    return [];
  } catch {
    return [];
  }
}

// ── Submit to DB ─────────────────────────────────────────────
async function submitDeal(deal, source, categoryId, adminId, db) {
  if (!deal.title || !deal.deal_price) return false;
  const [[existing]] = await db.execute(
    'SELECT id FROM deals WHERE title = ? OR (url IS NOT NULL AND url != "" AND url = ?)',
    [deal.title, deal.url || '']
  );
  if (existing) return false;
  await db.execute(
    `INSERT INTO deals (user_id, category_id, title, description, url, image_url, store, original_price, deal_price, is_approved)
     VALUES (?, ?, ?, ?, ?, NULL, ?, ?, ?, 0)`,
    [adminId, categoryId, deal.title, deal.description || '', deal.url || null, source.store, deal.original_price || null, deal.deal_price]
  );
  return true;
}

// ── Main runner ───────────────────────────────────────────────
async function runHunter(db, triggeredBy = 'auto') {
  const startTime = Date.now();
  console.log('🤖 Deal Hunter started at', new Date().toLocaleString('he-IL'));

  const config = await loadConfig(db);
  if (config.enabled === '0') {
    return { found: 0, skipped: 0, errors: ['Deal Hunter is disabled'], duration: 0 };
  }

  const [[admin]] = await db.execute("SELECT id FROM users WHERE role = 'admin' LIMIT 1");
  if (!admin) return { found: 0, errors: ['No admin user found'], duration: 0 };

  const [sources] = await db.execute('SELECT * FROM hunter_sources WHERE is_active = 1');
  if (!sources.length) {
    return { found: 0, skipped: 0, errors: ['No active sources configured'], duration: 0 };
  }

  let found = 0, skipped = 0;
  const errors = [];

  for (const source of sources) {
    source.categoryName = source.category_name;
    try {
      console.log(`  🔍 Scraping ${source.name}...`);
      const html  = await fetchPage(source.url);
      const text  = extractText(html);
      const deals = await extractDealsWithAI(text, source, config);
      const [[cat]] = await db.execute('SELECT id FROM categories WHERE name = ?', [source.categoryName]);
      const categoryId = cat?.id || 1;
      for (const deal of deals) {
        const submitted = await submitDeal(deal, source, categoryId, admin.id, db);
        if (submitted) { found++; console.log(`    ✅ ${deal.title} — ₪${deal.deal_price}`); }
        else skipped++;
      }
    } catch (e) {
      const errMsg = `${source.name}: ${e.message}`;
      errors.push(errMsg);
      console.error(`  ❌ ${errMsg}`);
    }
  }

  const duration = Math.round((Date.now() - startTime) / 1000);
  console.log(`🤖 Done — ${found} new, ${skipped} skipped, ${errors.length} errors (${duration}s)`);
  try {
    await db.execute(
      'INSERT INTO hunter_logs (triggered_by, total_found, total_skipped, errors, duration_seconds) VALUES (?, ?, ?, ?, ?)',
      [triggeredBy, found, skipped, errors.length ? JSON.stringify(errors) : null, duration]
    );
  } catch (logErr) { console.warn('Failed to write hunter log:', logErr.message); }
  return { found, skipped, errors, duration };
}

// ── Scheduler ─────────────────────────────────────────────────
let scheduledTask = null;

async function startScheduler(db) {
  const config = await loadConfig(db).catch(() => ({}));
  const schedule = config.schedule || '0 */6 * * *';
  const apiKey   = config.ai_api_key || process.env.ANTHROPIC_API_KEY;

  if (!apiKey) {
    console.warn('⚠️  No AI API key — Deal Hunter disabled');
    return;
  }
  if (scheduledTask) scheduledTask.destroy();
  scheduledTask = cron.schedule(schedule, () => runHunter(db));
  console.log(`🤖 Deal Hunter scheduled — ${schedule}`);
}

module.exports = { startScheduler, runHunter };
