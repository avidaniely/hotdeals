// ============================================================
//  OpenAI Deals Scheduler
//  1. Collects candidate deals from hunter_sources (HTTP or Browser)
//  2. Sends candidates to OpenAI for scoring/ranking
//  3. Validates JSON output and imports deals directly.
// ============================================================
const cron    = require('node-cron');
const OpenAI  = require('openai');
const axios   = require('axios');
const crypto  = require('crypto');
const fs      = require('fs');
const path    = require('path');
const { collectAllSources } = require('./dealCollector');

const EXPECTED_KEYS = ['r','n','p','o','dp','s','u','i'];
const UPLOADS_DIR = path.join(__dirname, '..', 'uploads');

// ── Download image to local disk ──────────────────────────────
async function downloadImage(remoteUrl) {
  if (!remoteUrl) return null;
  if (remoteUrl.startsWith('/uploads/')) return remoteUrl; // already local

  try {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });

    const response = await axios.get(remoteUrl, {
      responseType: 'stream',
      timeout: 15000,
      headers: { 'User-Agent': 'Mozilla/5.0' },
    });

    // Derive extension from Content-Type or URL
    const contentType = response.headers['content-type'] || '';
    let ext = '.jpg';
    if (contentType.includes('png'))  ext = '.png';
    else if (contentType.includes('webp')) ext = '.webp';
    else if (contentType.includes('gif'))  ext = '.gif';
    else {
      const urlExt = path.extname(remoteUrl.split('?')[0]).toLowerCase();
      if (['.jpg','.jpeg','.png','.webp','.gif'].includes(urlExt)) ext = urlExt;
    }

    const filename = crypto.createHash('md5').update(remoteUrl).digest('hex') + ext;
    const dest = path.join(UPLOADS_DIR, filename);

    // Skip if already downloaded
    if (fs.existsSync(dest)) return '/uploads/' + filename;

    await new Promise((resolve, reject) => {
      const stream = fs.createWriteStream(dest);
      response.data.pipe(stream);
      stream.on('finish', resolve);
      stream.on('error', reject);
    });

    return '/uploads/' + filename;
  } catch (e) {
    console.warn(`  ⚠️  Image download failed (${remoteUrl.slice(0, 60)}...): ${e.message}`);
    return null;
  }
}

// ── Load openai_ config keys from DB ─────────────────────────
async function loadOpenAIConfig(db) {
  const [rows] = await db.execute(
    "SELECT config_key, config_value FROM hunter_config WHERE config_key LIKE 'openai_%'"
  );
  return Object.fromEntries(rows.map(r => [r.config_key, r.config_value]));
}

// ── Load enabled sources ──────────────────────────────────────
async function loadEnabledSources(db) {
  const [rows] = await db.execute(
    'SELECT id, name, url, store, use_proxy, adapter_mode FROM hunter_sources WHERE is_active=1'
  );
  return rows;
}

// ── Save a single config key ──────────────────────────────────
async function saveConfig(db, key, value) {
  await db.execute(
    'INSERT INTO hunter_config (config_key, config_value) VALUES (?,?) ON DUPLICATE KEY UPDATE config_value=?',
    [key, value, value]
  );
}

// ── Validate AI output strictly ───────────────────────────────
function validatePayload(payload) {
  if (!payload || typeof payload !== 'object') throw new Error('Payload is not an object');
  if (!payload.d) throw new Error('Missing field: d');
  if (!payload.k) throw new Error('Missing field: k');
  if (!payload.sites) throw new Error('Missing field: sites');

  const kStr = JSON.stringify(payload.k);
  const expectedStr = JSON.stringify(EXPECTED_KEYS);
  if (kStr !== expectedStr) throw new Error(`Invalid k field: ${kStr}`);

  if (typeof payload.sites !== 'object' || Array.isArray(payload.sites))
    throw new Error('sites must be a plain object');

  for (const [site, deals] of Object.entries(payload.sites)) {
    if (!Array.isArray(deals)) throw new Error(`Site "${site}" value must be an array`);
    for (const deal of deals) {
      if (!Array.isArray(deal) || deal.length !== 8)
        throw new Error(`Deal in "${site}" must have exactly 8 items`);
      const price = deal[2];
      if (typeof price !== 'number' || price <= 0)
        throw new Error(`Deal in "${site}" has invalid price: ${price}`);
      if (!Array.isArray(deal[7]))
        throw new Error(`Deal in "${site}" images must be an array`);
      if (deal[7].length > 3) deal[7] = deal[7].slice(0, 3);
    }
  }
  return true;
}

// ── Core import logic (shared with HTTP endpoint) ────────────
async function importDealsFromPayload(payload, db) {
  const [[admin]] = await db.execute("SELECT id FROM users WHERE role='admin' LIMIT 1");
  if (!admin) throw new Error('No admin user found');

  let imported = 0, skipped = 0;

  for (const [siteName, deals] of Object.entries(payload.sites || {})) {
    for (const d of deals) {
      // [rank, title, price, oldPrice, discountPct, score, url, images]
      const [, title, price, oldPrice, , score, url, images] = d;
      if (!title || !price) { skipped++; continue; }

      const [[existing]] = await db.execute(
        'SELECT id FROM deals WHERE title=? OR (url IS NOT NULL AND url!="" AND url=?)',
        [title, url || '']
      );
      if (existing) { skipped++; continue; }

      const remoteImageUrl = Array.isArray(images) && images[0] ? images[0] : null;
      const imageUrl = await downloadImage(remoteImageUrl);

      await db.execute(
        `INSERT INTO deals (user_id, category_id, title, description, url, image_url, store, original_price, deal_price, quality_score, is_approved)
         VALUES (?, 1, ?, '', ?, ?, ?, ?, ?, ?, 0)`,
        [admin.id, title, url || null, imageUrl, siteName, oldPrice || null, price, score || null]
      );
      imported++;
    }
  }

  return { imported, skipped };
}

// ── Build scoring prompt ──────────────────────────────────────
function buildScoringPrompt(template, candidates) {
  const candidatesJson = JSON.stringify(candidates, null, 2);
  return template.replace('{{site_candidates_json}}', candidatesJson);
}

// ── OpenAI call with retry ────────────────────────────────────
async function callOpenAI(client, model, prompt, maxRetries) {
  let lastError = null;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`  🔁 Attempt ${attempt}/${maxRetries} — model: ${model}`);
      const response = await client.chat.completions.create({
        model,
        messages: [{ role: 'user', content: prompt }],
        response_format: { type: 'json_object' },
      });
      return response.choices[0]?.message?.content || '';
    } catch (e) {
      lastError = e.message;
      console.warn(`  ⚠️  Attempt ${attempt} failed: ${e.message}`);
      if (attempt < maxRetries) await new Promise(r => setTimeout(r, 2000 * attempt));
    }
  }
  throw new Error(`All ${maxRetries} attempts failed. Last error: ${lastError}`);
}

// ── Main job ──────────────────────────────────────────────────
async function runOpenAIJob(db, triggeredBy = 'auto') {
  const startTime = Date.now();
  console.log('🤖 OpenAI Dealer started at', new Date().toLocaleString('he-IL'));

  const config = await loadOpenAIConfig(db);

  if (config.openai_enabled !== '1') {
    console.log('⏸️  OpenAI Dealer is disabled');
    return { imported: 0, skipped: 0, error: 'disabled' };
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    const err = 'OPENAI_API_KEY not set in environment';
    await saveConfig(db, 'openai_last_status', 'error');
    await saveConfig(db, 'openai_last_error', err);
    console.error('❌', err);
    return { imported: 0, skipped: 0, error: err };
  }

  const model          = config.openai_model          || 'gpt-4o-mini';
  const timeout        = parseInt(config.openai_timeout)        || 120000;
  const maxRetries     = parseInt(config.openai_max_retries)    || 3;
  const candidateLimit = parseInt(config.openai_candidate_limit)|| 20;

  // Determine prompt mode: use scoring prompt if we have sources; else fall back to legacy prompt
  const scoringPromptTemplate = config.openai_scoring_prompt || '';
  const legacyPromptTemplate  = config.openai_prompt         || '';

  const client = new OpenAI({ apiKey, timeout });

  // ── Phase 1: Collect candidates ──────────────────────────────
  let sources = [];
  let candidates = {};

  if (scoringPromptTemplate) {
    try {
      sources = await loadEnabledSources(db);
      console.log(`🌐 Collecting from ${sources.length} source(s)...`);
      if (sources.length > 0) {
        candidates = await collectAllSources(sources, candidateLimit);
        const totalCandidates = Object.values(candidates).reduce((s, a) => s + a.length, 0);
        console.log(`📦 Collected ${totalCandidates} candidates from ${Object.keys(candidates).length} site(s)`);
      }
    } catch (e) {
      console.warn(`⚠️  Collection phase error: ${e.message} — continuing with empty candidates`);
    }
  }

  // ── Phase 2: Build prompt ─────────────────────────────────────
  let finalPrompt;
  if (scoringPromptTemplate && Object.keys(candidates).length > 0) {
    finalPrompt = buildScoringPrompt(scoringPromptTemplate, candidates);
  } else if (legacyPromptTemplate) {
    // Legacy mode: send site names, let OpenAI find deals itself
    let sites = [];
    try { sites = JSON.parse(config.openai_sites || '[]'); } catch { sites = []; }
    finalPrompt = legacyPromptTemplate.replace('{{sites}}', sites.join(', '));
    console.log('📝 Using legacy prompt (no candidates collected)');
  } else {
    const err = 'No prompt configured (set openai_scoring_prompt or openai_prompt)';
    await saveConfig(db, 'openai_last_run',    new Date().toISOString());
    await saveConfig(db, 'openai_last_status', 'error');
    await saveConfig(db, 'openai_last_error',  err);
    return { imported: 0, skipped: 0, error: err };
  }

  // ── Phase 3: Call OpenAI ──────────────────────────────────────
  let rawResponse;
  try {
    rawResponse = await callOpenAI(client, model, finalPrompt, maxRetries);
  } catch (e) {
    await saveConfig(db, 'openai_last_run',    new Date().toISOString());
    await saveConfig(db, 'openai_last_status', 'error');
    await saveConfig(db, 'openai_last_error',  e.message);
    await saveConfig(db, 'openai_last_response', '');
    return { imported: 0, skipped: 0, error: e.message };
  }

  // Save raw response preview (truncated)
  await saveConfig(db, 'openai_last_response', rawResponse.slice(0, 8000));

  // ── Phase 4: Parse + validate ─────────────────────────────────
  let payload;
  try {
    payload = typeof rawResponse === 'string' ? JSON.parse(rawResponse) : rawResponse;
    validatePayload(payload);
  } catch (e) {
    const err = `JSON validation failed: ${e.message}`;
    await saveConfig(db, 'openai_last_run',    new Date().toISOString());
    await saveConfig(db, 'openai_last_status', 'error');
    await saveConfig(db, 'openai_last_error',  err);
    console.error('❌', err);
    return { imported: 0, skipped: 0, error: err };
  }

  // ── Phase 5: Import ───────────────────────────────────────────
  let result = { imported: 0, skipped: 0 };
  try {
    result = await importDealsFromPayload(payload, db);
  } catch (e) {
    const err = `Import failed: ${e.message}`;
    await saveConfig(db, 'openai_last_run',    new Date().toISOString());
    await saveConfig(db, 'openai_last_status', 'error');
    await saveConfig(db, 'openai_last_error',  err);
    return { imported: 0, skipped: 0, error: err };
  }

  const duration = Math.round((Date.now() - startTime) / 1000);

  // Log to hunter_logs
  try {
    await db.execute(
      'INSERT INTO hunter_logs (triggered_by, source_name, total_found, total_skipped, errors, duration_seconds) VALUES (?,?,?,?,?,?)',
      [triggeredBy, 'openai', result.imported, result.skipped, null, duration]
    );
  } catch (e) { console.warn('Failed to write log:', e.message); }

  // Save status
  await saveConfig(db, 'openai_last_run',    new Date().toISOString());
  await saveConfig(db, 'openai_last_status', 'success');
  await saveConfig(db, 'openai_last_error',  '');

  console.log(`🤖 OpenAI Dealer done — ${result.imported} imported, ${result.skipped} skipped (${duration}s)`);
  return { ...result, duration };
}

// ── Scheduler ─────────────────────────────────────────────────
let scheduledTask = null;

async function startOpenAIScheduler(db) {
  const config = await loadOpenAIConfig(db).catch(() => ({}));
  const schedule = config.openai_schedule || '0 8 * * *';
  const apiKey   = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    console.warn('⚠️  OPENAI_API_KEY not set — OpenAI Dealer scheduler not started');
    return;
  }
  if (scheduledTask) scheduledTask.destroy();
  scheduledTask = cron.schedule(schedule, () => runOpenAIJob(db, 'auto'));
  console.log(`🤖 OpenAI Dealer scheduled — ${schedule}`);
}

module.exports = { startOpenAIScheduler, runOpenAIJob, importDealsFromPayload };
