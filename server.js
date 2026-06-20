'use strict';
const express  = require('express');
const cors     = require('cors');
const https    = require('https');
const bcrypt   = require('bcryptjs');
const jwt      = require('jsonwebtoken');
const { Pool } = require('pg');
const app      = express();

app.use(cors());
app.use(express.json());

/* CONFIG */
const JWT_SECRET = process.env.JWT_SECRET || 'terminal_dev_secret_change_in_prod';
const JWT_EXPIRY = '7d';
const SALT_ROUNDS = 10;
const STARTING_BALANCE = 10000;

/* POSTGRESQL */
let pool  = null;
let useDB = false;

async function initDB() {
  try {
    pool = new Pool({
      host:     process.env.PG_HOST     || 'localhost',
      port:     process.env.PG_PORT     || 5432,
      database: process.env.PG_DB       || 'terminal',
      user:     process.env.PG_USER     || 'postgres',
      password: process.env.PG_PASSWORD || 'bhavya19',
      connectionTimeoutMillis: 3000,
    });
    await pool.query('SELECT 1');
    useDB = true;
    console.log('  ✓ PostgreSQL connected');
  } catch {
    pool  = null;
    useDB = false;
    console.log('  ⚠ PostgreSQL not found — using in-memory (data resets on restart)');
  }
}

/* ═══════════════════════════════════════════════════════════
   IN-MEMORY FALLBACK
   ═══════════════════════════════════════════════════════════ */
const mem = {
  users:    {},   // { email: { id, email, password } }
  accounts: {},   // { userId: { balance, holdings:{}, orders:[] } }
  nextId:   1,
};

function memGetOrCreateAccount(userId) {
  if (!mem.accounts[userId]) {
    mem.accounts[userId] = { balance: STARTING_BALANCE, holdings: {}, orders: [] };
  }
  return mem.accounts[userId];
}

/* ═══════════════════════════════════════════════════════════
   JWT MIDDLEWARE
   ═══════════════════════════════════════════════════════════ */
function requireAuth(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No token provided' });
  }
  try {
    const payload = jwt.verify(auth.slice(7), JWT_SECRET);
    req.userId    = payload.userId;
    req.userEmail = payload.email;
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired token. Please log in again.' });
  }
}

/* ═══════════════════════════════════════════════════════════
   AUTH ROUTES
   ═══════════════════════════════════════════════════════════ */

/* POST /api/auth/register */
app.post('/api/auth/register', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email and password required' });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ error: 'Invalid email' });
  if (password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });

  const hash = await bcrypt.hash(password, SALT_ROUNDS);

  try {
    if (useDB) {
      // Check if user exists
      const exists = await pool.query('SELECT id FROM users WHERE email=$1', [email.toLowerCase()]);
      if (exists.rows.length) return res.status(409).json({ error: 'Email already registered' });

      // Create user + account in one transaction
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const uRes = await client.query(
          'INSERT INTO users(email,password) VALUES($1,$2) RETURNING id,email,created_at',
          [email.toLowerCase(), hash]
        );
        const user = uRes.rows[0];
        await client.query('INSERT INTO accounts(user_id) VALUES($1)', [user.id]);
        await client.query('COMMIT');
        const token = jwt.sign({ userId: user.id, email: user.email }, JWT_SECRET, { expiresIn: JWT_EXPIRY });
        res.json({ token, user: { id: user.id, email: user.email } });
      } catch (e) { await client.query('ROLLBACK'); throw e; }
      finally { client.release(); }

    } else {
      // Memory
      const emailLower = email.toLowerCase();
      if (mem.users[emailLower]) return res.status(409).json({ error: 'Email already registered' });
      const id = mem.nextId++;
      mem.users[emailLower] = { id, email: emailLower, password: hash };
      memGetOrCreateAccount(id);
      const token = jwt.sign({ userId: id, email: emailLower }, JWT_SECRET, { expiresIn: JWT_EXPIRY });
      res.json({ token, user: { id, email: emailLower } });
    }
  } catch (e) {
    console.error('Register:', e.message);
    res.status(500).json({ error: 'Registration failed' });
  }
});

/* POST /api/auth/login */
app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email and password required' });

  try {
    let user = null;
    if (useDB) {
      const r = await pool.query('SELECT id,email,password FROM users WHERE email=$1', [email.toLowerCase()]);
      if (!r.rows.length) return res.status(401).json({ error: 'Invalid email or password' });
      user = r.rows[0];
    } else {
      user = mem.users[email.toLowerCase()];
      if (!user) return res.status(401).json({ error: 'Invalid email or password' });
    }

    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.status(401).json({ error: 'Invalid email or password' });

    const token = jwt.sign({ userId: user.id, email: user.email }, JWT_SECRET, { expiresIn: JWT_EXPIRY });
    res.json({ token, user: { id: user.id, email: user.email } });
  } catch (e) {
    console.error('Login:', e.message);
    res.status(500).json({ error: 'Login failed' });
  }
});

/* GET /api/auth/me — validate token */
app.get('/api/auth/me', requireAuth, (req, res) => {
  res.json({ userId: req.userId, email: req.userEmail });
});

/* ═══════════════════════════════════════════════════════════
   TRADING ROUTES (all require auth)
   ═══════════════════════════════════════════════════════════ */

/* GET /api/account */
app.get('/api/account', requireAuth, async (req, res) => {
  const uid = req.userId;
  try {
    if (useDB) {
      // Ensure account row exists
      await pool.query(
        'INSERT INTO accounts(user_id) VALUES($1) ON CONFLICT DO NOTHING', [uid]
      );
      const [accR, holdR, ordR] = await Promise.all([
        pool.query('SELECT balance FROM accounts WHERE user_id=$1', [uid]),
        pool.query('SELECT coin_id,sym,units,avg_cost FROM holdings WHERE user_id=$1', [uid]),
        pool.query('SELECT * FROM orders WHERE user_id=$1 ORDER BY created_at DESC LIMIT 50', [uid]),
      ]);
      const holdings = {};
      holdR.rows.forEach(r => {
        holdings[r.coin_id] = { sym: r.sym, units: +r.units, avgCost: +r.avg_cost };
      });
      const orders = ordR.rows.map(r => ({
        id: r.id, coinId: r.coin_id, sym: r.sym, action: r.action,
        units: +r.units, price: +r.price, amountUSD: +r.amount_usd, time: r.created_at,
      }));
      return res.json({ balance: +accR.rows[0].balance, holdings, orders });
    } else {
      const acc = memGetOrCreateAccount(uid);
      return res.json({ balance: acc.balance, holdings: acc.holdings, orders: acc.orders.slice(0,50) });
    }
  } catch (e) { res.status(500).json({ error: 'Server error' }); }
});

/* POST /api/trade */
app.post('/api/trade', requireAuth, async (req, res) => {
  const uid = req.userId;
  const { coinId, sym, action, amountUSD, price } = req.body;
  if (!coinId || !sym || !['buy','sell'].includes(action) || !amountUSD || !price)
    return res.status(400).json({ error: 'Missing fields' });
  const amount = parseFloat(amountUSD);
  const px     = parseFloat(price);
  const units  = amount / px;
  if (isNaN(amount) || amount <= 0 || isNaN(px) || px <= 0)
    return res.status(400).json({ error: 'Invalid amount or price' });

  try {
    if (useDB) {
      // Get current balance
      const accR = await pool.query('SELECT balance FROM accounts WHERE user_id=$1', [uid]);
      const balance = accR.rows[0] ? +accR.rows[0].balance : STARTING_BALANCE;
      const client  = await pool.connect();
      try {
        await client.query('BEGIN');
        if (action === 'buy') {
          if (amount > balance + 0.01) { await client.query('ROLLBACK'); return res.status(400).json({ error: 'Insufficient balance' }); }
          await client.query('UPDATE accounts SET balance=balance-$1,updated_at=NOW() WHERE user_id=$2', [amount, uid]);
          await client.query(
            `INSERT INTO holdings(user_id,coin_id,sym,units,avg_cost) VALUES($1,$2,$3,$4,$5)
             ON CONFLICT(user_id,coin_id) DO UPDATE SET
               avg_cost=(holdings.avg_cost*holdings.units+$5*$4)/(holdings.units+$4),
               units=holdings.units+$4`,
            [uid, coinId, sym, units, px]
          );
        } else {
          const hR = await client.query('SELECT units FROM holdings WHERE user_id=$1 AND coin_id=$2 FOR UPDATE', [uid, coinId]);
          if (!hR.rows.length || +hR.rows[0].units < units - 1e-8) {
            await client.query('ROLLBACK'); return res.status(400).json({ error: 'Insufficient holdings' });
          }
          await client.query('UPDATE accounts SET balance=balance+$1,updated_at=NOW() WHERE user_id=$2', [amount, uid]);
          const remR = await client.query('UPDATE holdings SET units=units-$1 WHERE user_id=$2 AND coin_id=$3 RETURNING units', [units, uid, coinId]);
          if (+remR.rows[0].units < 1e-8) await client.query('DELETE FROM holdings WHERE user_id=$1 AND coin_id=$2', [uid, coinId]);
        }
        await client.query(
          'INSERT INTO orders(user_id,coin_id,sym,action,units,price,amount_usd) VALUES($1,$2,$3,$4,$5,$6,$7)',
          [uid, coinId, sym, action, units, px, amount]
        );
        await client.query('COMMIT');
      } catch (e) { await client.query('ROLLBACK'); throw e; }
      finally { client.release(); }

      // Return updated account
      const [aR,hR,oR] = await Promise.all([
        pool.query('SELECT balance FROM accounts WHERE user_id=$1', [uid]),
        pool.query('SELECT coin_id,sym,units,avg_cost FROM holdings WHERE user_id=$1', [uid]),
        pool.query('SELECT * FROM orders WHERE user_id=$1 ORDER BY created_at DESC LIMIT 50', [uid]),
      ]);
      const holdings = {};
      hR.rows.forEach(r => { holdings[r.coin_id] = { sym: r.sym, units: +r.units, avgCost: +r.avg_cost }; });
      return res.json({ success: true, account: { balance: +aR.rows[0].balance, holdings, orders: oR.rows.map(r => ({ id:r.id,coinId:r.coin_id,sym:r.sym,action:r.action,units:+r.units,price:+r.price,amountUSD:+r.amount_usd,time:r.created_at })) } });

    } else {
      const acc = memGetOrCreateAccount(uid);
      if (action === 'buy') {
        if (amount > acc.balance + 0.01) return res.status(400).json({ error: 'Insufficient balance' });
        acc.balance -= amount;
        if (!acc.holdings[coinId]) acc.holdings[coinId] = { sym, units: 0, avgCost: 0 };
        const h = acc.holdings[coinId];
        h.avgCost = (h.avgCost * h.units + px * units) / (h.units + units);
        h.units  += units;
      } else {
        const h = acc.holdings[coinId];
        if (!h || h.units < units - 1e-8) return res.status(400).json({ error: 'Insufficient holdings' });
        h.units -= units;
        acc.balance += amount;
        if (h.units < 1e-8) delete acc.holdings[coinId];
      }
      const order = { id: Date.now(), coinId, sym, action, units, price: px, amountUSD: amount, time: new Date() };
      acc.orders.unshift(order);
      if (acc.orders.length > 100) acc.orders.pop();
      return res.json({ success: true, account: { balance: acc.balance, holdings: acc.holdings, orders: acc.orders.slice(0,50) } });
    }
  } catch (e) { console.error('Trade:', e.message); res.status(500).json({ error: e.message || 'Trade failed' }); }
});

/* POST /api/reset */
app.post('/api/reset', requireAuth, async (req, res) => {
  const uid = req.userId;
  try {
    if (useDB) {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        await client.query('UPDATE accounts SET balance=$1,updated_at=NOW() WHERE user_id=$2', [STARTING_BALANCE, uid]);
        await client.query('DELETE FROM holdings WHERE user_id=$1', [uid]);
        await client.query('DELETE FROM orders   WHERE user_id=$1', [uid]);
        await client.query('COMMIT');
      } catch (e) { await client.query('ROLLBACK'); throw e; }
      finally { client.release(); }
    } else {
      mem.accounts[uid] = { balance: STARTING_BALANCE, holdings: {}, orders: [] };
    }
    res.json({ success: true, account: { balance: STARTING_BALANCE, holdings: {}, orders: [] } });
  } catch { res.status(500).json({ error: 'Reset failed' }); }
});

/* ═══════════════════════════════════════════════════════════
   NEWS (public — no auth needed)
   ═══════════════════════════════════════════════════════════ */
const FEEDS = [
  { name: 'CoinDesk',      url: 'https://www.coindesk.com/arc/outboundfeeds/rss/' },
  { name: 'CoinTelegraph', url: 'https://cointelegraph.com/rss' },
  { name: 'Decrypt',       url: 'https://decrypt.co/feed' },
];
const BULLISH_WORDS = ['surge','rally','bull','bullish','gain','rise','pump','breakout','ath','soar','rebound','recovery','growth','adoption','launch','partnership','positive','record'];
const BEARISH_WORDS = ['crash','bear','bearish','fall','dump','drop','decline','hack','exploit','ban','regulation','fine','loss','scam','fraud','plunge','negative','liquidation'];
const COIN_KEYWORDS = {
  bitcoin:['bitcoin','btc'], ethereum:['ethereum','eth'], solana:['solana','sol'],
  dogecoin:['dogecoin','doge'], ripple:['ripple','xrp'], cardano:['cardano','ada'],
  chainlink:['chainlink','link'], polkadot:['polkadot','dot'],
};

function scoreSentiment(text) {
  const t = text.toLowerCase();
  const b = BULLISH_WORDS.filter(w => t.includes(w)).length;
  const e = BEARISH_WORDS.filter(w => t.includes(w)).length;
  return b > e + 1 ? 'bullish' : e > b + 1 ? 'bearish' : 'neutral';
}
function tagCoins(text) {
  const t = text.toLowerCase();
  return Object.entries(COIN_KEYWORDS).filter(([,kws]) => kws.some(kw => t.includes(kw))).map(([id]) => id);
}
function fetchURL(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' }, timeout: 6000 }, res => {
      let d = ''; res.on('data', c => d += c); res.on('end', () => resolve(d));
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
  });
}
function parseRSS(xml, src) {
  const items = []; const re = /<item>([\s\S]*?)<\/item>/g; let m;
  while ((m = re.exec(xml)) !== null) {
    const b = m[1];
    const get = tag => { const r = b.match(new RegExp(`<${tag}[^>]*>(?:<!\\[CDATA\\[)?([\\s\\S]*?)(?:\\]\\]>)?<\\/${tag}>`, 'i')); return r ? r[1].replace(/<[^>]+>/g,'').trim() : ''; };
    const title = get('title'), link = get('link') || get('guid'), desc = get('description').slice(0,300), date = get('pubDate');
    if (!title || !link) continue;
    items.push({ id: Buffer.from(link).toString('base64').slice(0,16), title, link: link.startsWith('http') ? link : `https://${link}`, summary: desc, source: src, time: date ? new Date(date).toISOString() : new Date().toISOString(), sentiment: scoreSentiment(`${title} ${desc}`), coins: tagCoins(`${title} ${desc}`) });
  }
  return items;
}
let newsCache = [], lastFetched = 0;
async function fetchAllNews() {
  if (newsCache.length && Date.now() - lastFetched < 600000) return newsCache;
  const results = await Promise.allSettled(FEEDS.map(async f => parseRSS(await fetchURL(f.url), f.name)));
  const seen = new Set();
  newsCache = results.filter(r => r.status === 'fulfilled').flatMap(r => r.value)
    .filter(n => { if (seen.has(n.id)) return false; seen.add(n.id); return true; })
    .sort((a,b) => new Date(b.time) - new Date(a.time)).slice(0,60);
  lastFetched = Date.now();
  return newsCache;
}
app.get('/api/news', async (req, res) => {
  try {
    const news = await fetchAllNews();
    const { sentiment, coin } = req.query;
    let filtered = [...news];
    if (sentiment && sentiment !== 'all') filtered = filtered.filter(n => n.sentiment === sentiment);
    if (coin) filtered = filtered.filter(n => n.coins.includes(coin));
    const total = news.length || 1;
    const bullish = news.filter(n => n.sentiment==='bullish').length;
    const bearish = news.filter(n => n.sentiment==='bearish').length;
    res.json({ articles: filtered.slice(0,30), summary: { total, bullish, bearish, neutral: total-bullish-bearish, mood: bullish>bearish?'bullish':bearish>bullish?'bearish':'neutral' }, cachedAt: new Date(lastFetched).toISOString() });
  } catch (e) { res.status(500).json({ error: 'News fetch failed', articles: [], summary: { total:0,bullish:0,bearish:0,neutral:0,mood:'neutral' } }); }
});

/* Health */
app.get('/api/health', (req, res) => res.json({ ok: true, db: useDB ? 'postgresql' : 'memory', uptime: Math.floor(process.uptime()) }));

/* ═══════════════════════════════════════════════════════════
   START
   ═══════════════════════════════════════════════════════════ */
const PORT = 3001;
(async () => {
  await initDB();
  fetchAllNews().catch(() => {});
  app.listen(PORT, () => {
    console.log(`\n  TERMINAL backend → http://localhost:${PORT}`);
    console.log(`  Auth: JWT (${JWT_EXPIRY} expiry) + bcrypt`);
    console.log(`  Storage: ${useDB ? 'PostgreSQL ✓' : 'In-memory'}\n`);
  });
})();