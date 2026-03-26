// ============================================================
//  Deal Hunter — AI Agent
//  Scrapes Israeli deal sites every 6 hours, extracts deals
//  with Claude, and submits them for admin approval.
// ============================================================
const cron       = require('node-cron');
const axios      = require('axios');
const cheerio    = require('cheerio');
const Anthropic  = require('@anthropic-ai/sdk');

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });


const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept-Language': 'he-IL,he;q=0.9,en;q=0.8',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
};

// ── Scrape ───────────────────────────────────────────────────
async function fetchPage(url) {
  const { data } = await axios.get(url, {
    headers: HEADERS,
    timeout: 15000,
  });
  return data;
}

function extractText(html) {
  const $ = cheerio.load(html);
  $('script, style, nav, footer, header, noscript, iframe').remove();
  const text = $('body').text()
    .replace(/\s+/g, ' ')
    .trim();
  // Keep first 7000 chars — enough for Claude to find deals
  return text.slice(0, 7000);
}

// ── Claude extraction ────────────────────────────────────────
async function extractDealsWithClaude(pageText, source) {
  const msg = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 1800,
    messages: [{
      role: 'user',
      content: `You are a deal-extraction AI for an Israeli deals site called hotILdeals.
Analyze the text below from ${source.store}'s website and find the best 3–5 deals.

For each deal, return a JSON object with these fields:
- title         (string — product name, prefer Hebrew)
- deal_price    (number — current sale price in ₪, required)
- original_price (number — original price in ₪, or null)
- description   (string — 1–2 sentences in Hebrew describing the deal)
- url           (string — product page URL, or null if not found)

Rules:
- Only include items with a clear numeric price in ₪ (NIS).
- Prefer items with both original and sale price (showing a discount).
- If you cannot find any real deals, return an empty array [].
- Return ONLY a valid JSON array — no explanation, no markdown.

Page text from ${source.store}:
${pageText}`,
    }],
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

  // Deduplicate by title similarity or exact URL
  const [[existing]] = await db.execute(
    'SELECT id FROM deals WHERE title = ? OR (url IS NOT NULL AND url != "" AND url = ?)',
    [deal.title, deal.url || '']
  );
  if (existing) return false;

  await db.execute(
    `INSERT INTO deals
       (user_id, category_id, title, description, url, image_url, store,
        original_price, deal_price, is_approved)
     VALUES (?, ?, ?, ?, ?, NULL, ?, ?, ?, 0)`,
    [
      adminId,
      categoryId,
      deal.title,
      deal.description || '',
      deal.url || null,
      source.store,
      deal.original_price || null,
      deal.deal_price,
    ]
  );
  return true;
}

// ── Main runner ───────────────────────────────────────────────
async function runHunter(db) {
  const startTime = Date.now();
  console.log('🤖 Deal Hunter started at', new Date().toLocaleString('he-IL'));

  // Get admin user
  const [[admin]] = await db.execute(
    "SELECT id FROM users WHERE role = 'admin' LIMIT 1"
  );
  if (!admin) {
    return { found: 0, errors: ['No admin user found'], duration: 0 };
  }

  // Load active sources from DB
  const [sources] = await db.execute('SELECT * FROM hunter_sources WHERE is_active = 1');
  if (!sources.length) {
    return { found: 0, skipped: 0, errors: ['No active sources configured'], duration: 0 };
  }

  let found   = 0;
  let skipped = 0;
  const errors = [];

  for (const source of sources) {
    source.categoryName = source.category_name;
    try {
      console.log(`  🔍 Scraping ${source.name}...`);

      const html  = await fetchPage(source.url);
      const text  = extractText(html);
      const deals = await extractDealsWithClaude(text, source);

      // Get or fallback category
      const [[cat]] = await db.execute(
        'SELECT id FROM categories WHERE name = ?',
        [source.categoryName]
      );
      const categoryId = cat?.id || 1;

      for (const deal of deals) {
        const submitted = await submitDeal(deal, source, categoryId, admin.id, db);
        if (submitted) {
          found++;
          console.log(`    ✅ ${deal.title} — ₪${deal.deal_price}`);
        } else {
          skipped++;
        }
      }
    } catch (e) {
      const errMsg = `${source.name}: ${e.message}`;
      errors.push(errMsg);
      console.error(`  ❌ ${errMsg}`);
    }
  }

  const duration = Math.round((Date.now() - startTime) / 1000);
  console.log(`🤖 Done — ${found} new, ${skipped} skipped, ${errors.length} errors (${duration}s)`);

  return { found, skipped, errors, duration };
}

// ── Scheduler ─────────────────────────────────────────────────
function startScheduler(db) {
  if (!process.env.ANTHROPIC_API_KEY) {
    console.warn('⚠️  ANTHROPIC_API_KEY not set — Deal Hunter disabled');
    return;
  }
  // Every 6 hours at minute 0
  cron.schedule('0 */6 * * *', () => runHunter(db));
  console.log('🤖 Deal Hunter scheduled — runs every 6 hours');
}

module.exports = { startScheduler, runHunter };
