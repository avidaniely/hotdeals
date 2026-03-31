// ============================================================
//  Deal Collector — HTTP + Browser adapters
//  Collects candidate deals from hunter_sources.
//  Reuses fetchPage/buildAgent from dealHunter.js.
//  Returns: { "store_name": [{name,price,oldPrice,url,image},...], ... }
// ============================================================
const cheerio   = require('cheerio');
const axios     = require('axios');
const { HttpsProxyAgent } = require('https-proxy-agent');
const { SocksProxyAgent } = require('socks-proxy-agent');

const CANDIDATE_LIMIT_DEFAULT = 20;

// ── Re-implement proxy/fetch (avoids circular dep with dealHunter) ───
const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Accept-Language': 'he-IL,he;q=0.9,en-US;q=0.8,en;q=0.7',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
  'Accept-Encoding': 'gzip, deflate, br',
  'Cache-Control': 'no-cache',
};

function loadProxies() {
  const raw = process.env.PROXIES || '';
  return raw.split(',').map(p => p.trim()).filter(Boolean);
}

function buildAgent(proxyUrl) {
  if (!proxyUrl) return null;
  if (proxyUrl.startsWith('socks4://') || proxyUrl.startsWith('socks5://'))
    return new SocksProxyAgent(proxyUrl);
  return new HttpsProxyAgent(proxyUrl);
}

async function fetchHttp(url, useProxy = false) {
  const proxies = useProxy ? loadProxies() : [];
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
      const opts = { headers: HEADERS, timeout: 30000 };
      if (proxy) { const a = buildAgent(proxy); opts.httpAgent = a; opts.httpsAgent = a; }
      const { data } = await axios.get(url, opts);
      return data;
    } catch (e) {
      if (attempt < maxAttempts - 1) continue;
      throw e;
    }
  }
}

// ── Generic HTML candidate extractor ────────────────────────
function extractCandidates(html, limit) {
  const $ = cheerio.load(html);
  const candidates = [];

  // Remove clutter
  $('script, style, nav, footer, header, noscript, iframe, .cookie-banner, #cookie').remove();

  // Price pattern: matches "1,234" or "1234" optionally followed by ₪/ILS/NIS
  const priceRe = /[\d,]+(?:\.\d{1,2})?/;

  // Try structured product containers first
  const productSelectors = [
    '[class*="product"]',
    '[class*="item"]',
    '[class*="card"]',
    '[class*="deal"]',
    '[class*="offer"]',
    'li[class]',
    'article',
  ];

  let containers = [];
  for (const sel of productSelectors) {
    const els = $(sel).toArray();
    if (els.length >= 3) { containers = els; break; }
  }

  // Fall back to any element with a price-like text
  if (containers.length === 0) {
    $('*').each((_, el) => {
      const text = $(el).text();
      if (priceRe.test(text) && text.length < 500) containers.push(el);
    });
  }

  for (const el of containers) {
    if (candidates.length >= limit * 3) break; // collect 3x, dedupe later

    const $el = $(el);
    const text = $el.text().replace(/\s+/g, ' ').trim();
    if (text.length < 5) continue;

    // Extract name: try heading first, then first substantial text node
    let name = $el.find('h1,h2,h3,h4,h5,h6,[class*="title"],[class*="name"]').first().text().trim()
      || $el.clone().children().remove().end().text().trim()
      || text.slice(0, 80);
    name = name.replace(/\s+/g, ' ').trim().slice(0, 120);
    if (!name || name.length < 3) continue;

    // Extract prices
    const priceMatches = text.match(/[\d,]+(?:\.\d{1,2})?/g) || [];
    const prices = priceMatches
      .map(p => parseFloat(p.replace(/,/g, '')))
      .filter(p => p > 0 && p < 1000000);
    if (prices.length === 0) continue;

    const price    = Math.min(...prices);
    const oldPrice = prices.length > 1 ? Math.max(...prices) : null;

    // Extract URL
    const href = $el.find('a').first().attr('href') || $el.closest('a').attr('href') || null;
    let url = null;
    if (href && href.startsWith('http')) url = href;
    else if (href && href.startsWith('/')) url = href; // relative — caller can prepend base

    // Extract image
    const img = $el.find('img').first().attr('src') || $el.find('img').first().attr('data-src') || null;

    candidates.push({ name, price, oldPrice, url, image: img });
  }

  // Dedupe by name
  const seen = new Set();
  return candidates.filter(c => {
    if (seen.has(c.name)) return false;
    seen.add(c.name);
    return true;
  }).slice(0, limit);
}

// ── Random delay ──────────────────────────────────────────────
function delay(ms) { return new Promise(r => setTimeout(r, ms)); }
function randomDelay(min = 500, max = 2000) {
  return delay(min + Math.floor(Math.random() * (max - min)));
}

// ── Browser adapter (Playwright + stealth) ───────────────────
async function collectWithBrowser(source, limit) {
  // Lazy-require so missing playwright doesn't crash the whole server
  // Try known paths first (Alpine apk installs binary at /usr/lib/chromium/chromium,
  // the /usr/bin/chromium-browser symlink points to a launcher script that may not work in Docker)
  const { existsSync } = require('fs');
  const { execSync } = require('child_process');
  let chromiumPath = null;
  const knownPaths = [
    '/usr/lib/chromium/chromium',
    '/usr/bin/chromium',
    '/usr/bin/google-chrome',
  ];
  for (const p of knownPaths) {
    if (existsSync(p)) { chromiumPath = p; break; }
  }
  if (!chromiumPath) {
    try {
      chromiumPath = execSync('which chromium-browser || which chromium || which google-chrome 2>/dev/null', { encoding: 'utf8' }).trim() || null;
    } catch { chromiumPath = null; }
  }

  if (!chromiumPath) {
    throw new Error('No system Chromium found — install chromium in the container');
  }

  const { chromium } = require('playwright-extra');
  const StealthPlugin = require('puppeteer-extra-plugin-stealth');
  chromium.use(StealthPlugin());

  // Chromium doesn't support authenticated SOCKS5 natively.
  // Use proxychains to wrap Chromium so it handles SOCKS5 auth transparently.
  let launchPath = chromiumPath;
  const proxies = source.use_proxy ? loadProxies() : [];
  if (proxies.length > 0) {
    const raw = proxies[Math.floor(Math.random() * proxies.length)];
    const proxychainsConf = '/tmp/proxychains-hotdeals.conf';
    // Parse proxy URL into proxychains format: type host port [user pass]
    const m = raw.match(/^socks([45]):\/\/(?:([^:@]+):([^@]+)@)?([^:]+):(\d+)/);
    if (m) {
      const [, ver, user, pass, host, port] = m;
      const authLine = user ? `${user} ${pass}` : '';
      fs.writeFileSync(proxychainsConf,
        `strict_chain\nproxy_dns\n[ProxyList]\nsocks${ver} ${host} ${port} ${authLine}\n`);
      // Create wrapper script
      const wrapper = '/tmp/chromium-proxychains.sh';
      fs.writeFileSync(wrapper, `#!/bin/sh\nexec proxychains4 -f ${proxychainsConf} ${chromiumPath} "$@"\n`);
      fs.chmodSync(wrapper, 0o755);
      launchPath = wrapper;
    }
  }

  const browser = await chromium.launch({
    executablePath: launchPath,
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--disable-software-rasterizer',
      '--disable-extensions',
      '--disable-background-networking',
      '--disable-default-apps',
      '--no-first-run',
      '--no-zygote',
    ],
  });

  try {
    const ctx  = await browser.newContext({
      userAgent: HEADERS['User-Agent'],
      locale: 'he-IL',
      viewport: { width: 1280, height: 800 },
    });
    const page = await ctx.newPage();

    // Block heavy resources to save memory
    await page.route('**/*', route => {
      const type = route.request().resourceType();
      if (['font', 'media', 'websocket'].includes(type)) return route.abort();
      return route.continue();
    });

    await page.goto(source.url, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await randomDelay(1000, 2500);

    // Scroll a bit to trigger lazy-load
    await page.evaluate(() => window.scrollBy(0, window.innerHeight));
    await randomDelay(500, 1500);

    const html = await page.content();
    await ctx.close();
    return extractCandidates(html, limit);
  } finally {
    await browser.close();
  }
}

// ── HTTP adapter ──────────────────────────────────────────────
async function collectWithHttp(source, limit) {
  const html = await fetchHttp(source.url, source.use_proxy);
  return extractCandidates(html, limit);
}

// ── Main collect function ─────────────────────────────────────
// Returns { storeName: [candidates], ... }
async function collectAllSources(sources, candidateLimit) {
  const limit = candidateLimit || CANDIDATE_LIMIT_DEFAULT;
  const results = {};

  for (const source of sources) {
    const storeName = source.store || source.name;
    console.log(`  📦 Collecting ${storeName} [${source.adapter_mode || 'http'}] — ${source.url}`);

    let candidates = [];
    let collectionError = null;

    if ((source.adapter_mode || 'http') === 'browser') {
      // Try browser first, fall back to HTTP
      try {
        candidates = await collectWithBrowser(source, limit);
        console.log(`     ✅ Browser: ${candidates.length} candidates`);
      } catch (e) {
        collectionError = e.message;
        console.warn(`     ⚠️  Browser failed (${e.message}) — falling back to HTTP`);
        try {
          candidates = await collectWithHttp(source, limit);
          console.log(`     ✅ HTTP fallback: ${candidates.length} candidates`);
        } catch (e2) {
          console.warn(`     ❌ HTTP fallback also failed: ${e2.message}`);
        }
      }
    } else {
      // HTTP mode
      try {
        candidates = await collectWithHttp(source, limit);
        console.log(`     ✅ HTTP: ${candidates.length} candidates`);
      } catch (e) {
        collectionError = e.message;
        console.warn(`     ❌ HTTP failed: ${e.message}`);
      }
    }

    if (candidates.length > 0) {
      results[storeName] = candidates;
    } else {
      console.warn(`     ⚠️  ${storeName}: no candidates collected${collectionError ? ' (' + collectionError + ')' : ''}`);
    }

    // Polite delay between sites
    if (sources.indexOf(source) < sources.length - 1) {
      await randomDelay(1000, 3000);
    }
  }

  return results;
}

module.exports = { collectAllSources };
