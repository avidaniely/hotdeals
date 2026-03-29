// ============================================================
//  Deal Hunter — AI Agent
//  Scrapes Israeli deal sites every 6 hours, extracts deals
//  with Claude (or other AI), and submits them for admin approval.
// ============================================================
const cron      = require('node-cron');
const axios     = require('axios');
const cheerio   = require('cheerio');
const Anthropic = require('@anthropic-ai/sdk');
const { HttpsProxyAgent } = require('https-proxy-agent');
const { SocksProxyAgent } = require('socks-proxy-agent');

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Accept-Language': 'he-IL,he;q=0.9,en-US;q=0.8,en;q=0.7',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
  'Accept-Encoding': 'gzip, deflate, br',
  'Cache-Control': 'no-cache',
  'Pragma': 'no-cache',
  'Sec-Fetch-Dest': 'document',
  'Sec-Fetch-Mode': 'navigate',
  'Sec-Fetch-Site': 'none',
  'Sec-Fetch-User': '?1',
  'Upgrade-Insecure-Requests': '1',
};

// ── Proxy rotation ────────────────────────────────────────────
function loadProxies() {
  const raw = process.env.PROXIES || '';
  return raw.split(',').map(p => p.trim()).filter(Boolean);
}

// ── Load config from DB ───────────────────────────────────────
async function loadConfig(db) {
  const [rows] = await db.execute('SELECT config_key, config_value FROM hunter_config');
  return Object.fromEntries(rows.map(r => [r.config_key, r.config_value]));
}

// ── Scrape ───────────────────────────────────────────────────
function buildAgent(proxyUrl) {
  if (!proxyUrl) return null;
  if (proxyUrl.startsWith('socks4://') || proxyUrl.startsWith('socks5://')) {
    return new SocksProxyAgent(proxyUrl);
  }
  return new HttpsProxyAgent(proxyUrl);
}

async function fetchPage(url, proxies = [], vpnProxy = null) {
  // If a dedicated VPN proxy is requested, use it (single attempt, no rotation)
  if (vpnProxy) {
    const agent = buildAgent(vpnProxy);
    const options = { headers: HEADERS, timeout: 60000 };
    if (agent) { options.httpAgent = agent; options.httpsAgent = agent; }
    const { data } = await axios.get(url, options);
    return data;
  }

  const maxAttempts = proxies.length > 0 ? Math.min(proxies.length, 3) : 1;
  const tried = new Set();

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    let proxy = null;
    if (proxies.length > 0) {
      const available = proxies.filter(p => !tried.has(p));
      const pool = available.length > 0 ? available : proxies;
      proxy = pool[Math.floor(Math.random() * pool.length)];
      tried.add(proxy);
    }

    try {
      const options = { headers: HEADERS, timeout: 15000 };
      if (proxy) {
        const agent = buildAgent(proxy);
        options.httpAgent  = agent;
        options.httpsAgent = agent;
      }
      const { data } = await axios.get(url, options);
      return data;
    } catch (e) {
      if (attempt < maxAttempts - 1) {
        console.warn(`  ⚠️  ${proxy ? `Proxy ${proxy} failed` : 'Request failed'}, retrying...`);
        continue;
      }
      throw e;
    }
  }
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

  const DEFAULT_PROMPT =
    'You are a deal extraction AI for hotILdeals.\n' +
    'Analyze the text from {store} and find the 3-5 best deals.\n' +
    'For each deal return: title, deal_price (number, ₪), original_price (number or null), description (short, Hebrew preferred), url.\n' +
    'Rules: only clear prices in ₪. Prefer deals with both original and sale price.\n' +
    'Return JSON only: [{...}]';

  const basePrompt = source.custom_prompt || DEFAULT_PROMPT;
  const prompt = basePrompt
    .replace('{store}', source.store)
    .replace('{min_votes}', config.min_votes || '5')
    .replace('{min_comments}', config.min_comments || '2')
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

// ── Quality score algorithm ───────────────────────────────────
// Score 0–100 based on: discount %, savings amount, community signals, recency
function calculateQualityScore(deal) {
  let score = 0;
  const price    = parseFloat(deal.deal_price)     || 0;
  const original = parseFloat(deal.original_price) || 0;
  const votes    = parseInt(deal.votes)             || 0;
  const comments = parseInt(deal.comments)          || 0;
  const hoursAgo = parseFloat(deal.hours_ago)       || 0;

  // 1. Discount % score (0–40 pts): 80%+ discount = full 40
  if (original > price && original > 0) {
    const discountPct = (1 - price / original) * 100;
    score += Math.min(discountPct * 0.5, 40);
  }

  // 2. Absolute savings score (0–20 pts): ₪500 saved = full 20
  if (original > price) {
    score += Math.min((original - price) / 25, 20);
  }

  // 3. Community engagement (0–25 pts): votes×2 + comments×3, cap at 25
  score += Math.min((votes * 2 + comments * 3) / 4, 25);

  // 4. Recency bonus (0–10 pts): decays over 48h, full 10 pts if ≤5h old
  if (hoursAgo > 0) {
    score += Math.max(10 - hoursAgo / 4.8, 0);
  }

  // 5. Sanity: suspiciously cheap items lose 5 pts
  if (price > 0 && price < 10) score = Math.max(score - 5, 0);

  return Math.round(Math.min(score, 100));
}

// ── Submit to DB ─────────────────────────────────────────────
async function submitDeal(deal, source, categoryId, adminId, db) {
  if (!deal.title || !deal.deal_price) return false;
  const [[existing]] = await db.execute(
    'SELECT id FROM deals WHERE title = ? OR (url IS NOT NULL AND url != "" AND url = ?)',
    [deal.title, deal.url || '']
  );
  if (existing) return false;
  const qualityScore = calculateQualityScore(deal);
  await db.execute(
    `INSERT INTO deals (user_id, category_id, title, description, url, image_url, store, original_price, deal_price, quality_score, is_approved)
     VALUES (?, ?, ?, ?, ?, NULL, ?, ?, ?, ?, 0)`,
    [adminId, categoryId, deal.title, deal.description || '', deal.url || null, source.store, deal.original_price || null, deal.deal_price, qualityScore || null]
  );
  return true;
}

// ── Main runner ───────────────────────────────────────────────
async function runHunter(db, triggeredBy = 'auto', sourceId = null) {
  const startTime = Date.now();
  console.log('🤖 Deal Hunter started at', new Date().toLocaleString('he-IL'));

  const config = await loadConfig(db);
  if (config.enabled === '0') {
    return { found: 0, skipped: 0, errors: ['Deal Hunter is disabled'], duration: 0 };
  }

  const proxies = loadProxies();
  if (proxies.length) console.log(`🔀 Proxy rotation enabled — ${proxies.length} proxies loaded`);

  const [[admin]] = await db.execute("SELECT id FROM users WHERE role = 'admin' LIMIT 1");
  if (!admin) return { found: 0, errors: ['No admin user found'], duration: 0 };

  const [sources] = await db.execute(
    `SELECT hs.*, hp.prompt_text AS custom_prompt
     FROM hunter_sources hs
     LEFT JOIN hunter_prompts hp ON hp.id = hs.prompt_id
     WHERE hs.is_active = 1${sourceId ? ' AND hs.id = ?' : ''}`,
    sourceId ? [sourceId] : []
  );
  if (!sources.length) {
    return { found: 0, skipped: 0, errors: ['No active sources configured'], duration: 0 };
  }

  let found = 0, skipped = 0;
  const errors = [];

  const vpnProxy = config.vpn_proxy || null;
  if (vpnProxy) console.log(`🔒 VPN proxy configured — will use for sources with proxy enabled`);

  for (const source of sources) {
    source.categoryName = source.category_name;
    const useVpn = source.use_proxy && vpnProxy;
    try {
      console.log(`  🔍 Scraping ${source.name}${useVpn ? ' [VPN]' : ''}...`);
      const html  = await fetchPage(source.url, proxies, useVpn ? vpnProxy : null);
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
    const sourceName = sourceId && sources.length === 1 ? sources[0].name : null;
    await db.execute(
      'INSERT INTO hunter_logs (triggered_by, source_name, total_found, total_skipped, errors, duration_seconds) VALUES (?, ?, ?, ?, ?, ?)',
      [triggeredBy, sourceName, found, skipped, errors.length ? JSON.stringify(errors) : null, duration]
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
