'use strict';
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

/* ── Asset Config ── */
const CORE = [
  { id: 'bitcoin',   sym: 'BTC', color: '#F7931A' },
  { id: 'ethereum',  sym: 'ETH', color: '#627EEA' },
  { id: 'solana',    sym: 'SOL', color: '#9945FF' },
  { id: 'dogecoin',  sym: 'DOGE',color: '#C3A634' },
];
const RAIL = [
  { id: 'cardano',               sym: 'ADA'  },
  { id: 'ripple',                sym: 'XRP'  },
  { id: 'polkadot',              sym: 'DOT'  },
  { id: 'litecoin',              sym: 'LTC'  },
  { id: 'chainlink',             sym: 'LINK' },
  { id: 'avalanche-2',           sym: 'AVAX' },
  { id: 'polygon-ecosystem-token', sym: 'POL'},
  { id: 'tron',                  sym: 'TRX'  },
  { id: 'stellar',               sym: 'XLM'  },
  { id: 'monero',                sym: 'XMR'  },
  { id: 'uniswap',               sym: 'UNI'  },
  { id: 'cosmos',                sym: 'ATOM' },
  { id: 'near',                  sym: 'NEAR' },
  { id: 'aptos',                 sym: 'APT'  },
  { id: 'internet-computer',     sym: 'ICP'  },
  { id: 'filecoin',              sym: 'FIL'  },
  { id: 'vechain',               sym: 'VET'  },
  { id: 'algorand',              sym: 'ALGO' },
];
const ALL = [...CORE, ...RAIL];

const RAIL_COLORS = [
  '#0033AD','#00AAE4','#E6007A','#BFBBBB',
  '#375BD2','#E84142','#8247E5','#FF0013',
  '#9B59FF','#FF6600','#FF007A','#2E3148',
  '#00EC97','#FC4C02','#29ABE2','#0090FF',
  '#15BDFF','#009900',
];

/* ── State ── */
const state = {
  data:        {},   // coin data keyed by id
  activeAsset: 'bitcoin',
  focusAsset:  null,
  isFetching:  false,
  pointsPlotted: 0,
};

/* ── Seed synthetic data ── */
const BASE_PRICES = {
  bitcoin:67000, ethereum:3400, solana:180, dogecoin:0.18,
  cardano:0.52, ripple:0.62, polkadot:9.5, litecoin:88,
  chainlink:19, 'avalanche-2':42, 'polygon-ecosystem-token':0.55,
  tron:0.13, stellar:0.13, monero:158, uniswap:11,
  cosmos:9.2, near:8.5, aptos:11, 'internet-computer':13,
  filecoin:6.2, vechain:0.04, algorand:0.23,
};
ALL.forEach(a => {
  const base = BASE_PRICES[a.id] ?? 1;
  const history = Array.from({ length: 48 }, (_, i) =>
    base * (1 + (Math.random() - 0.49) * 0.008 * (i + 1)));
  state.data[a.id] = {
    price: history.at(-1),
    change: +(Math.random() * 12 - 4).toFixed(2),
    high:  history.at(-1) * 1.04,
    low:   history.at(-1) * 0.96,
    history,
  };
});
state.pointsPlotted = ALL.length * 48;

/* ============================================================
   ANIMATED BACKGROUND
   ============================================================ */
(function initBg() {
  const canvas = $('#bgCanvas');
  const ctx    = canvas.getContext('2d');

  const orbs = [
    { x: 0.15, y: 0.2,  r: 350, hue: 160, speed: 0.00012 },
    { x: 0.85, y: 0.15, r: 280, hue: 220, speed: 0.00015 },
    { x: 0.5,  y: 0.7,  r: 320, hue: 270, speed: 0.00010 },
    { x: 0.1,  y: 0.85, r: 200, hue: 190, speed: 0.00018 },
    { x: 0.9,  y: 0.7,  r: 250, hue: 140, speed: 0.00013 },
  ];
  let t = 0;

  function resize() {
    canvas.width  = window.innerWidth;
    canvas.height = window.innerHeight;
  }
  window.addEventListener('resize', resize);
  resize();

  function drawBg() {
    t++;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    orbs.forEach((o, i) => {
      const ox = (o.x + Math.sin(t * o.speed + i) * 0.12) * canvas.width;
      const oy = (o.y + Math.cos(t * o.speed * 0.7 + i) * 0.1) * canvas.height;
      const g  = ctx.createRadialGradient(ox, oy, 0, ox, oy, o.r);
      g.addColorStop(0,   `hsla(${o.hue},70%,55%,0.12)`);
      g.addColorStop(0.5, `hsla(${o.hue},60%,40%,0.05)`);
      g.addColorStop(1,   `hsla(${o.hue},50%,30%,0)`);
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(ox, oy, o.r, 0, Math.PI * 2);
      ctx.fill();
    });

    requestAnimationFrame(drawBg);
  }
  drawBg();
})();

/* ============================================================
   GLASS CARD MOUSE LIGHT EFFECT
   ============================================================ */
function initGlassEffect() {
  document.addEventListener('mousemove', e => {
    $$('.glass-card').forEach(card => {
      const rect = card.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      card.style.setProperty('--mouse-x', `${x}px`);
      card.style.setProperty('--mouse-y', `${y}px`);
    });
  });
}

/* ============================================================
   PAGE ROUTING
   ============================================================ */
function initRouter() {
  $$('.nav-link').forEach(link => {
    link.addEventListener('click', () => {
      const target = link.dataset.page;
      $$('.nav-link').forEach(l => l.classList.remove('is-active'));
      link.classList.add('is-active');
      $$('.page').forEach(p => p.classList.remove('is-active', 'entering'));
      const page = $(`#page-${target}`);
      page.classList.add('is-active', 'entering');
      if (target === 'markets') renderMarketsTable();
      if (target === 'news')    loadNews();
    });
  });
}

/* ============================================================
   CANVAS UTILITIES
   ============================================================ */
function lerp(a, b, t) { return a + (b - a) * t; }
function easeOut(t) { return 1 - Math.pow(1 - t, 3); }

function drawSparkline(canvas, history, color) {
  if (!canvas) return;
  const dpr = window.devicePixelRatio || 1;
  const w   = canvas.clientWidth  || canvas.width;
  const h   = canvas.clientHeight || canvas.height;
  canvas.width  = w * dpr;
  canvas.height = h * dpr;
  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);
  if (!history || history.length < 2) return;
  const min = Math.min(...history);
  const max = Math.max(...history);
  const range = max - min || 1;
  const pts = history.map((v, i) => ({
    x: (i / (history.length - 1)) * w,
    y: h - ((v - min) / range) * h * 0.85 - h * 0.075,
  }));
  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  for (let i = 0; i < pts.length - 1; i++) {
    const mx = (pts[i].x + pts[i+1].x) / 2;
    const my = (pts[i].y + pts[i+1].y) / 2;
    ctx.quadraticCurveTo(pts[i].x, pts[i].y, mx, my);
  }
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.5;
  ctx.stroke();
  // Glow dot at end
  const last = pts.at(-1);
  ctx.beginPath();
  ctx.arc(last.x, last.y, 3, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.shadowColor = color;
  ctx.shadowBlur = 8;
  ctx.fill();
  ctx.shadowBlur = 0;
}

function drawMainChart(id) {
  const canvas = $('#mainChart');
  if (!canvas) return;
  const dpr  = window.devicePixelRatio || 1;
  const w    = canvas.clientWidth  || 600;
  const h    = canvas.clientHeight || 220;
  canvas.width  = w * dpr;
  canvas.height = h * dpr;
  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);
  const d = state.data[id];
  if (!d) return;
  const history = d.history;
  const min = Math.min(...history);
  const max = Math.max(...history);
  const range = max - min || 1;
  const pad = { t: 12, r: 8, b: 28, l: 8 };
  const cw  = w - pad.l - pad.r;
  const ch  = h - pad.t - pad.b;
  const color = CORE.find(c => c.id === id)?.color ?? '#00F5A0';

  // Grid lines
  ctx.strokeStyle = 'rgba(255,255,255,0.04)';
  ctx.lineWidth = 1;
  for (let i = 0; i <= 4; i++) {
    const y = pad.t + (ch / 4) * i;
    ctx.beginPath(); ctx.moveTo(pad.l, y); ctx.lineTo(w - pad.r, y); ctx.stroke();
  }

  const pts = history.map((v, i) => ({
    x: pad.l + (i / (history.length - 1)) * cw,
    y: pad.t + ch - ((v - min) / range) * ch,
  }));

  // Gradient fill
  const grad = ctx.createLinearGradient(0, pad.t, 0, h - pad.b);
  grad.addColorStop(0, color + '33');
  grad.addColorStop(1, color + '00');
  ctx.beginPath();
  ctx.moveTo(pts[0].x, h - pad.b);
  ctx.lineTo(pts[0].x, pts[0].y);
  for (let i = 0; i < pts.length - 1; i++) {
    const mx = (pts[i].x + pts[i+1].x) / 2;
    const my = (pts[i].y + pts[i+1].y) / 2;
    ctx.quadraticCurveTo(pts[i].x, pts[i].y, mx, my);
  }
  ctx.lineTo(pts.at(-1).x, h - pad.b);
  ctx.closePath();
  ctx.fillStyle = grad;
  ctx.fill();

  // Line
  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  for (let i = 0; i < pts.length - 1; i++) {
    const mx = (pts[i].x + pts[i+1].x) / 2;
    const my = (pts[i].y + pts[i+1].y) / 2;
    ctx.quadraticCurveTo(pts[i].x, pts[i].y, mx, my);
  }
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.shadowColor = color;
  ctx.shadowBlur = 8;
  ctx.stroke();
  ctx.shadowBlur = 0;

  // Glow dot
  const last = pts.at(-1);
  ctx.beginPath();
  ctx.arc(last.x, last.y, 4, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.shadowColor = color;
  ctx.shadowBlur = 16;
  ctx.fill();
  ctx.shadowBlur = 0;
}

function drawGauge() {
  const canvas = $('#gaugeChart');
  if (!canvas) return;
  const ctx   = canvas.getContext('2d');
  const w = canvas.width, h = canvas.height;
  ctx.clearRect(0, 0, w, h);
  const cx = w / 2, cy = h - 14;
  const r  = 72;

  // Compute avg change across CORE
  const avg = CORE.reduce((s, a) => s + (state.data[a.id]?.change || 0), 0) / CORE.length;
  const norm = Math.max(0, Math.min(1, (avg + 10) / 20));
  const color = norm > 0.6 ? '#00F5A0' : norm < 0.4 ? '#FF4560' : '#FFB800';

  // Track
  ctx.beginPath();
  ctx.arc(cx, cy, r, Math.PI, 0);
  ctx.strokeStyle = 'rgba(255,255,255,0.08)';
  ctx.lineWidth = 12;
  ctx.lineCap = 'round';
  ctx.stroke();

  // Fill
  ctx.beginPath();
  ctx.arc(cx, cy, r, Math.PI, Math.PI + norm * Math.PI);
  ctx.strokeStyle = color;
  ctx.shadowColor = color;
  ctx.shadowBlur = 12;
  ctx.stroke();
  ctx.shadowBlur = 0;

  // Needle
  const angle = Math.PI + norm * Math.PI;
  const nx = cx + (r - 6) * Math.cos(angle);
  const ny = cy + (r - 6) * Math.sin(angle);
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.lineTo(nx, ny);
  ctx.strokeStyle = 'rgba(255,255,255,0.7)';
  ctx.lineWidth = 2;
  ctx.shadowBlur = 0;
  ctx.stroke();

  // Labels
  ctx.fillStyle = 'rgba(255,255,255,0.25)';
  ctx.font = '9px JetBrains Mono';
  ctx.textAlign = 'left';
  ctx.fillText('FEAR', cx - r - 4, cy + 12);
  ctx.textAlign = 'right';
  ctx.fillText('GREED', cx + r + 4, cy + 12);

  const label = norm > 0.65 ? 'GREED' : norm < 0.35 ? 'FEAR' : 'NEUTRAL';
  const gLabel = $('#gaugeLabel');
  if (gLabel) { gLabel.textContent = label; gLabel.style.color = color; }
}

function drawDonut() {
  const canvas = $('#donutChart');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const w = canvas.width, h = canvas.height;
  ctx.clearRect(0, 0, w, h);
  const cx = w / 2, cy = h / 2, r = 52, iR = 34;
  const total = CORE.reduce((s, a) => s + (state.data[a.id]?.price || 0), 0) || 1;
  let start = -Math.PI / 2;
  CORE.forEach((a, i) => {
    const slice = ((state.data[a.id]?.price || 0) / total) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, r, start, start + slice);
    ctx.closePath();
    ctx.fillStyle = a.color;
    ctx.fill();
    start += slice;
  });
  // Hole
  ctx.save();
  ctx.globalCompositeOperation = 'destination-out';
  ctx.beginPath();
  ctx.arc(cx, cy, iR, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/* ── Focus chart ── */
function drawFocusChart(id) {
  const canvas = $('#focusChart');
  if (!canvas) return;
  const dpr = window.devicePixelRatio || 1;
  const w = Math.min(canvas.clientWidth  || 280, 280);
  const h = Math.min(canvas.clientHeight || 100, 100);
  canvas.width  = w * dpr;
  canvas.height = h * dpr;
  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);
  const d = state.data[id];
  if (!d) return;
  const history = d.history;
  const min = Math.min(...history);
  const max = Math.max(...history);
  const range = max - min || 1;
  const color = CORE.find(c => c.id === id)?.color ??
    RAIL_COLORS[RAIL.findIndex(r => r.id === id)] ?? '#00F5A0';
  const pts = history.map((v, i) => ({
    x: (i / (history.length - 1)) * w,
    y: h - ((v - min) / range) * h * 0.85 - h * 0.075,
  }));
  const grad = ctx.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, color + '44');
  grad.addColorStop(1, color + '00');
  ctx.beginPath();
  ctx.moveTo(pts[0].x, h);
  ctx.lineTo(pts[0].x, pts[0].y);
  for (let i = 0; i < pts.length - 1; i++) {
    const mx = (pts[i].x + pts[i+1].x) / 2;
    const my = (pts[i].y + pts[i+1].y) / 2;
    ctx.quadraticCurveTo(pts[i].x, pts[i].y, mx, my);
  }
  ctx.lineTo(pts.at(-1).x, h);
  ctx.closePath();
  ctx.fillStyle = grad;
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  for (let i = 0; i < pts.length - 1; i++) {
    const mx = (pts[i].x + pts[i+1].x) / 2;
    const my = (pts[i].y + pts[i+1].y) / 2;
    ctx.quadraticCurveTo(pts[i].x, pts[i].y, mx, my);
  }
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.shadowColor = color;
  ctx.shadowBlur = 8;
  ctx.stroke();
  ctx.shadowBlur = 0;
}

/* ============================================================
   RENDER FUNCTIONS
   ============================================================ */
function fmtPrice(p) {
  if (p >= 1000) return '$' + p.toLocaleString('en-US', { maximumFractionDigits: 0 });
  if (p >= 1)    return '$' + p.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return '$' + p.toFixed(4);
}
function fmtChg(c) { return (c >= 0 ? '+' : '') + c.toFixed(2) + '%'; }
function capitalize(str) {
  return str.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

/* Hero ticker */
function renderTicker() {
  const el = $('#heroTicker');
  if (!el) return;
  el.innerHTML = CORE.map(a => {
    const d = state.data[a.id];
    if (!d) return '';
    const cls = d.change >= 0 ? 'up' : 'down';
    return `<span class="ticker-item">
      <span class="ticker-sym">${a.sym}</span>
      <span class="ticker-val">${fmtPrice(d.price)}</span>
      <span class="ticker-chg ${cls}">${fmtChg(d.change)}</span>
    </span>`;
  }).join('');
}

/* Stat cards */
let statCardsBuilt = false;
function buildStatCards() {
  if (statCardsBuilt) return;
  statCardsBuilt = true;
  const row = $('#statRow');
  if (!row) return;
  row.innerHTML = CORE.map(a => `
    <div class="glass-card stat-card" data-asset="${a.id}" tabindex="0" role="button">
      <div class="stat-card-top">
        <div class="stat-coin-name">${a.sym}</div>
        <div class="stat-badge" id="badge-${a.id}">—</div>
      </div>
      <div class="stat-price" id="price-${a.id}">—</div>
      <canvas class="stat-sparkline" id="spark-${a.id}"></canvas>
    </div>`).join('');

  $$('.stat-card', row).forEach(card => {
    card.addEventListener('click', () => openFocus(card.dataset.asset));
    card.addEventListener('keydown', e => { if (e.key === 'Enter') openFocus(card.dataset.asset); });
  });
}

function renderStatCards() {
  buildStatCards();
  CORE.forEach(a => {
    const d = state.data[a.id];
    if (!d) return;
    const badge = $(`#badge-${a.id}`);
    const price = $(`#price-${a.id}`);
    const spark = $(`#spark-${a.id}`);
    if (badge) { badge.textContent = fmtChg(d.change); badge.className = 'stat-badge ' + (d.change >= 0 ? 'up' : 'down'); }
    if (price) price.textContent = fmtPrice(d.price);
    if (spark) drawSparkline(spark, d.history, a.color);
  });
}

/* Main panel */
let tabsBuilt = false;
function renderMainPanel() {
  if (!tabsBuilt) {
    const tabs = $('#chartTabs');
    if (tabs) {
      tabs.innerHTML = CORE.map(a =>
        `<button class="tab ${a.id === state.activeAsset ? 'is-active' : ''}" data-id="${a.id}">${a.sym}</button>`
      ).join('');
      $$('.tab', tabs).forEach(t => t.addEventListener('click', () => {
        state.activeAsset = t.dataset.id;
        $$('.tab').forEach(x => x.classList.remove('is-active'));
        t.classList.add('is-active');
        renderMainPanel();
      }));
    }
    tabsBuilt = true;
  }
  const id = state.activeAsset;
  const d  = state.data[id];
  if (!d) return;
  const cp = $('#chartPrice'); if (cp) cp.textContent = fmtPrice(d.price);
  const cc = $('#chartChange');
  if (cc) { cc.textContent = fmtChg(d.change); cc.className = 'chart-change ' + (d.change >= 0 ? 'up' : 'down'); }
  drawMainChart(id);
}

/* Signals */
function renderSignals() {
  const grid = $('#signalsGrid');
  if (!grid) return;
  const rows = ALL.map(a => ({ ...a, ...state.data[a.id] })).filter(r => r.price);
  const topGainer  = [...rows].sort((a, b) => b.change - a.change)[0];
  const topFaller  = [...rows].sort((a, b) => a.change - b.change)[0];
  const mostVol    = [...rows].sort((a, b) =>
    (Math.abs(b.high - b.low) / b.price) - (Math.abs(a.high - a.low) / a.price))[0];
  const steadiest  = [...rows].sort((a, b) =>
    (Math.abs(a.high - a.low) / a.price) - (Math.abs(b.high - b.low) / b.price))[0];
  const signals = [
    { tag: 'Strongest Gainer',   coin: topGainer,  val: fmtChg(topGainer?.change ?? 0),  cls: 'up'      },
    { tag: 'Steepest Decline',   coin: topFaller,  val: fmtChg(topFaller?.change ?? 0),  cls: 'down'    },
    { tag: 'Highest Volatility', coin: mostVol,    val: ((Math.abs(mostVol?.high - mostVol?.low) / mostVol?.price) * 100).toFixed(1) + '%', cls: 'neutral' },
    { tag: 'Steadiest',          coin: steadiest,  val: ((Math.abs(steadiest?.high - steadiest?.low) / steadiest?.price) * 100).toFixed(1) + '%', cls: 'up' },
  ];
  grid.innerHTML = signals.map(s => `
    <div class="glass-card signal-card">
      <div class="signal-tag">${s.tag}</div>
      <div class="signal-coin">${s.coin?.sym ?? '—'}</div>
      <div class="signal-val ${s.cls}">${s.val}</div>
    </div>`).join('');
}

/* Watchlist timeline */
let timelineBuilt = false;
function buildTimeline() {
  if (timelineBuilt) return;
  timelineBuilt = true;
  const tl = $('#watchlistTimeline');
  if (!tl) return;
  const rows = [];
  for (let i = 0; i < RAIL.length; i += 2) {
    const left  = RAIL[i];
    const right = RAIL[i + 1];
    rows.push(`
      <div class="wl-row">
        <div class="wl-card-slot">
          ${left ? `<div class="glass-card wl-card" data-asset="${left.id}">
            <div class="wl-info">
              <div class="wl-sym">${left.sym}</div>
              <div class="wl-price" id="wl-price-${left.id}">—</div>
            </div>
            <div class="wl-chg" id="wl-chg-${left.id}">—</div>
            <canvas id="wl-spark-${left.id}" width="60" height="28" class="wl-spark"></canvas>
          </div>` : ''}
        </div>
        <div class="wl-node"><div class="wl-dot"></div></div>
        <div class="wl-card-slot">
          ${right ? `<div class="glass-card wl-card" data-asset="${right.id}">
            <div class="wl-info">
              <div class="wl-sym">${right.sym}</div>
              <div class="wl-price" id="wl-price-${right.id}">—</div>
            </div>
            <div class="wl-chg" id="wl-chg-${right.id}">—</div>
            <canvas id="wl-spark-${right.id}" width="60" height="28" class="wl-spark"></canvas>
          </div>` : ''}
        </div>
      </div>`);
  }
  tl.innerHTML = rows.join('');
  $$('.wl-card', tl).forEach(card => {
    card.addEventListener('click', () => openFocus(card.dataset.asset));
  });
}

function renderTimeline() {
  buildTimeline();
  RAIL.forEach((a, i) => {
    const d = state.data[a.id];
    if (!d) return;
    const color = RAIL_COLORS[i] ?? '#888';
    const price = $(`#wl-price-${a.id}`); if (price) price.textContent = fmtPrice(d.price);
    const chg   = $(`#wl-chg-${a.id}`);
    if (chg) { chg.textContent = fmtChg(d.change); chg.className = 'wl-chg ' + (d.change >= 0 ? 'up' : 'down'); }
    const spark = $(`#wl-spark-${a.id}`); if (spark) drawSparkline(spark, d.history, color);
  });
}

/* Markets table */
function renderMarketsTable() {
  const body = $('#marketsTableBody');
  if (!body) return;
  body.innerHTML = ALL.map((a, i) => {
    const d = state.data[a.id];
    if (!d) return '';
    const color = CORE.find(c => c.id === a.id)?.color ?? RAIL_COLORS[RAIL.findIndex(r => r.id === a.id)] ?? '#888';
    return `<div class="table-row" data-asset="${a.id}" tabindex="0" role="button">
      <span class="table-rank">${i + 1}</span>
      <span class="table-sym">${a.sym}</span>
      <span>${fmtPrice(d.price)}</span>
      <span class="table-chg ${d.change >= 0 ? 'up' : 'down'}">${fmtChg(d.change)}</span>
      <span>${fmtPrice(d.high)}</span>
      <span>${fmtPrice(d.low)}</span>
      <span><canvas id="mt-spark-${a.id}" width="100" height="28"></canvas></span>
    </div>`;
  }).join('');
  ALL.forEach((a, i) => {
    const spark = $(`#mt-spark-${a.id}`);
    const color = CORE.find(c => c.id === a.id)?.color ?? RAIL_COLORS[RAIL.findIndex(r => r.id === a.id)] ?? '#888';
    if (spark && state.data[a.id]) drawSparkline(spark, state.data[a.id].history, color);
  });
  $$('.table-row', body).forEach(row => {
    row.addEventListener('click', () => openFocus(row.dataset.asset));
  });
}

/* Status bar */
function setStatus(live) {
  const dot = $('.status-dot');
  const txt = $('#statusText');
  if (dot) dot.className = 'status-dot' + (live ? ' is-live' : '');
  if (txt) txt.textContent = live ? 'Live' : 'Simulated';
}

/* Master render */
function renderAll(heavy = true) {
  renderTicker();
  renderStatCards();
  renderMainPanel();
  if (heavy) { drawGauge(); drawDonut(); renderSignals(); renderTimeline(); }
  if (state.focusAsset) renderFocusPanel(state.focusAsset);
}

/* ============================================================
   FOCUS OVERLAY
   ============================================================ */
function openFocus(id) {
  state.focusAsset = id;
  const overlay = $('#focusOverlay');
  overlay.classList.add('is-open');
  renderFocusPanel(id);
  requestAnimationFrame(() => requestAnimationFrame(() => drawFocusChart(id)));
}

function closeFocus() {
  state.focusAsset = null;
  $('#focusOverlay')?.classList.remove('is-open');
}

function renderFocusPanel(id) {
  const d    = state.data[id];
  if (!d) return;
  const meta = ALL.find(a => a.id === id);
  const name = $('#focusName');   if (name)   name.textContent  = capitalize(id);
  const price = $('#focusPrice'); if (price)  price.textContent = fmtPrice(d.price);
  const chg   = $('#focusChange');
  if (chg) { chg.textContent = fmtChg(d.change); chg.className = 'focus-change ' + (d.change >= 0 ? 'up' : 'down'); }
  const stats = $('#focusStats');
  if (stats) stats.innerHTML = [
    { label: '24h High',   val: fmtPrice(d.high) },
    { label: '24h Low',    val: fmtPrice(d.low) },
    { label: '24h Change', val: fmtChg(d.change) },
    { label: 'Range %',    val: (((d.high - d.low) / d.price) * 100).toFixed(2) + '%' },
    { label: 'History pts',val: d.history.length + ' pts' },
    { label: 'Volatility', val: ((Math.abs(d.high - d.low) / d.price) * 100).toFixed(1) + '%' },
  ].map(s => `<div class="focus-stat">
    <div class="focus-stat-label">${s.label}</div>
    <div class="focus-stat-val">${s.val}</div>
  </div>`).join('');
  drawFocusChart(id);
}

function initFocusOverlay() {
  $('#focusClose')?.addEventListener('click', closeFocus);
  $('#focusOverlay')?.addEventListener('click', e => { if (e.target === $('#focusOverlay')) closeFocus(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeFocus(); });
}

/* ============================================================
   SCROLL REVEAL
   ============================================================ */
function initScrollReveal() {
  const items = $$('[data-reveal]');
  if (!items.length) return;
  const obs = new IntersectionObserver(entries => {
    entries.forEach((entry, i) => {
      if (entry.isIntersecting) {
        setTimeout(() => entry.target.classList.add('is-visible'), i * 80);
        obs.unobserve(entry.target);
      }
    });
  }, { threshold: 0.08 });
  items.forEach(el => obs.observe(el));
}

/* ============================================================
   LIVE DATA
   ============================================================ */
async function fetchLiveData() {
  if (state.isFetching) return;
  state.isFetching = true;
  try {
    const ids = ALL.map(a => a.id).join(',');
    const res = await fetch(
      `https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd&include_24hr_change=true&include_24hr_vol=true&include_high_low=true`,
      { signal: AbortSignal.timeout(8000) }
    );
    if (!res.ok) throw new Error('API error');
    const json = await res.json();
    ALL.forEach(a => {
      const raw = json[a.id];
      if (!raw) return;
      const d   = state.data[a.id];
      const price = raw.usd ?? d.price;
      d.history.push(price);
      if (d.history.length > 60) d.history.shift();
      d.price  = price;
      d.change = raw.usd_24h_change ?? d.change;
      d.high   = raw.usd_24h_high   ?? d.high;
      d.low    = raw.usd_24h_low    ?? d.low;
    });
    setStatus(true);
  } catch {
    setStatus(false);
  } finally {
    state.isFetching = false;
  }
}

function microTick() {
  ALL.forEach(a => {
    const d = state.data[a.id];
    if (!d) return;
    const drift = d.price * (Math.random() - 0.499) * 0.0008;
    d.price = Math.max(0.0001, d.price + drift);
    d.history.push(d.price);
    if (d.history.length > 60) d.history.shift();
  });
  renderAll(false);
}

/* ════════════════════════════════════════════════════════════
   AUTH MODULE
   ════════════════════════════════════════════════════════════ */
const auth = {
  token: null,
  user:  null,
  mode:  'login',   // 'login' | 'register'
};

function authGetToken()       { return localStorage.getItem('terminal_token'); }
function authSaveToken(t)     { localStorage.setItem('terminal_token', t); auth.token = t; }
function authClearToken()     { localStorage.removeItem('terminal_token'); auth.token = null; auth.user = null; }

/* All backend calls go through here — attaches Bearer token automatically */
function backendFetch(url, opts = {}) {
  const token = auth.token || authGetToken();
  return fetch(url, {
    ...opts,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
      ...(opts.headers || {}),
    },
  });
}

/* Validate existing token on page load */
async function validateToken() {
  const token = authGetToken();
  if (!token) return false;
  auth.token = token;
  try {
    const res  = await backendFetch(`${BACKEND}/api/auth/me`);
    if (!res.ok) { authClearToken(); return false; }
    const data = await res.json();
    auth.user  = data;
    return true;
  } catch {
    return false;  // backend down — still show app if token exists
  }
}

/* Show / hide auth modal */
function showAuthModal() {
  const overlay = $('#authOverlay');
  if (overlay) overlay.classList.add('is-open');
}
function hideAuthModal() {
  const overlay = $('#authOverlay');
  if (overlay) overlay.classList.remove('is-open');
}

/* Switch between login / register */
function setAuthMode(mode) {
  auth.mode = mode;
  const submitBtn  = $('#authSubmit');
  const switchBtn  = $('#authSwitchBtn');
  const switchText = $('.auth-switch');
  const tabLogin   = $('#authTabLogin');
  const tabReg     = $('#authTabRegister');
  const errEl      = $('#authError');
  if (errEl) errEl.textContent = '';

  if (mode === 'login') {
    if (submitBtn)  submitBtn.textContent  = 'Login';
    if (switchBtn)  switchBtn.textContent  = 'Register';
    if (switchText) switchText.childNodes[0].textContent = "Don't have an account? ";
    tabLogin?.classList.add('is-active');
    tabReg?.classList.remove('is-active');
  } else {
    if (submitBtn)  submitBtn.textContent  = 'Create Account';
    if (switchBtn)  switchBtn.textContent  = 'Login';
    if (switchText) switchText.childNodes[0].textContent = 'Already have an account? ';
    tabReg?.classList.add('is-active');
    tabLogin?.classList.remove('is-active');
  }
}

/* Submit login or register */
async function submitAuth() {
  const email    = $('#authEmail')?.value?.trim();
  const password = $('#authPassword')?.value;
  const errEl    = $('#authError');
  const submitBtn = $('#authSubmit');

  if (!email || !password) { if (errEl) errEl.textContent = 'Fill in all fields.'; return; }
  if (errEl) errEl.textContent = '';
  if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = 'Please wait…'; }

  const endpoint = auth.mode === 'login' ? '/api/auth/login' : '/api/auth/register';
  try {
    const res  = await fetch(`${BACKEND}${endpoint}`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ email, password }),
    });
    const data = await res.json();
    if (!res.ok) {
      if (errEl) errEl.textContent = data.error || 'Something went wrong.';
      return;
    }
    authSaveToken(data.token);
    auth.user = data.user;
    hideAuthModal();
    renderNavUser();
    await fetchAccount();   // load trading data after login
  } catch {
    if (errEl) errEl.textContent = 'Cannot reach backend. Is server.js running?';
  } finally {
    if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = auth.mode === 'login' ? 'Login' : 'Create Account'; }
  }
}

/* Logout */
function logout() {
  authClearToken();
  renderNavUser();
  showAuthModal();
  // Clear trade state
  trade.account = null;
  renderTradeUI();
}

/* Show user email + logout in nav */
function renderNavUser() {
  const slot = $('#navUserSlot');
  if (!slot) return;
  if (auth.user) {
    slot.innerHTML = `
      <span class="nav-user-email">${escHtml(auth.user.email)}</span>
      <button class="nav-logout" id="navLogout">Logout</button>`;
    $('#navLogout')?.addEventListener('click', logout);
  } else {
    slot.innerHTML = '';
  }
}

/* Init auth — wires up all listeners */
async function initAuth() {
  // Tab switches
  $('#authTabLogin')?.addEventListener('click',    () => setAuthMode('login'));
  $('#authTabRegister')?.addEventListener('click', () => setAuthMode('register'));
  $('#authSwitchBtn')?.addEventListener('click',   () => setAuthMode(auth.mode === 'login' ? 'register' : 'login'));

  // Submit on button click or Enter key
  $('#authSubmit')?.addEventListener('click', submitAuth);
  $('#authPassword')?.addEventListener('keydown', e => { if (e.key === 'Enter') submitAuth(); });
  $('#authEmail')?.addEventListener('keydown',    e => { if (e.key === 'Enter') submitAuth(); });

  // Check existing token
  const valid = await validateToken();
  if (valid && auth.user) {
    renderNavUser();
    hideAuthModal();
    await fetchAccount();
  } else if (!auth.token) {
    // No token at all — show modal
    showAuthModal();
  } else {
    // Token exists but backend is down — still show app (graceful)
    renderNavUser();
    hideAuthModal();
  }
}

/* ════════════════════════════════════════════════════════════
   SESSION ID — kept for backwards compat but no longer used
   for auth (JWT replaced it). Removed.
   ════════════════════════════════════════════════════════════ */

/* escHtml defined early — used by auth + news modules */
function escHtml(str) {
  return String(str)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;')
    .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

/* ════════════════════════════════════════════════════════════
   NEWS MODULE
   ════════════════════════════════════════════════════════════ */
const newsState = {
  sentiment: 'all',
  coin:      '',
  loading:   false,
};

async function loadNews(forceRefresh = false) {
  if (newsState.loading) return;
  newsState.loading = true;
  const btn  = $('#refreshNewsBtn');
  const grid = $('#newsGrid');
  if (btn)  btn.classList.add('spinning');
  if (grid) grid.innerHTML = '<div class="news-loading">Fetching latest crypto news…</div>';

  try {
    const params = new URLSearchParams();
    if (newsState.sentiment !== 'all') params.set('sentiment', newsState.sentiment);
    if (newsState.coin)                params.set('coin', newsState.coin);
    if (forceRefresh)                  params.set('refresh', '1');

    const res  = await fetch(`${BACKEND}/api/news?${params}`, { signal: AbortSignal.timeout(12000) });
    const data = await res.json();
    renderNews(data);
  } catch (e) {
    if (grid) grid.innerHTML = `<div class="news-loading">Could not load news — is the backend running?<br><span style="font-size:11px;color:var(--ink-4)">node server.js</span></div>`;
  } finally {
    newsState.loading = false;
    if (btn) btn.classList.remove('spinning');
  }
}

function renderNews(data) {
  // Sentiment overview
  const { summary, articles, cachedAt } = data;
  const total = summary.total || 1;
  const moodEl = $('#moodVal');
  if (moodEl) { moodEl.textContent = summary.mood.toUpperCase(); moodEl.className = `mood-val ${summary.mood}`; }
  const bc = $('#bullishCount'); if (bc) bc.textContent = summary.bullish;
  const ec = $('#bearishCount'); if (ec) ec.textContent = summary.bearish;
  const nc = $('#neutralCount'); if (nc) nc.textContent = summary.neutral;
  const bb = $('#bullishBar');   if (bb) bb.style.width = `${(summary.bullish / total) * 100}%`;
  const eb = $('#bearishBar');   if (eb) eb.style.width = `${(summary.bearish / total) * 100}%`;
  const nb = $('#neutralBar');   if (nb) nb.style.width = `${(summary.neutral / total) * 100}%`;

  // Cached at
  const ca = $('#newsCachedAt');
  if (ca && cachedAt) ca.textContent = `Last fetched: ${new Date(cachedAt).toLocaleTimeString()}`;

  // News grid
  const grid = $('#newsGrid');
  if (!grid) return;
  if (!articles.length) {
    grid.innerHTML = '<div class="news-loading">No articles match the current filter.</div>';
    return;
  }
  grid.innerHTML = articles.map(a => {
    const ago   = timeAgo(a.time);
    const coins = a.coins.slice(0,3).map(c =>
      `<span class="news-coin-tag">${c.replace('avalanche-2','AVAX').replace('polygon-ecosystem-token','POL').toUpperCase().slice(0,4)}</span>`
    ).join('');
    return `<a class="glass-card news-card" href="${escHtml(a.link)}" target="_blank" rel="noopener">
      <div class="news-card-top">
        <span class="news-source">${escHtml(a.source)}</span>
        <span class="news-sentiment-badge ${a.sentiment}">${a.sentiment}</span>
      </div>
      <div class="news-title">${escHtml(a.title)}</div>
      ${a.summary ? `<div class="news-summary">${escHtml(a.summary)}</div>` : ''}
      <div class="news-footer">
        <span class="news-time">${ago}</span>
        <div class="news-coins">${coins}</div>
      </div>
    </a>`;
  }).join('');
}

function timeAgo(iso) {
  const diff = Date.now() - new Date(iso).getTime();
  const m    = Math.floor(diff / 60000);
  if (m < 1)   return 'just now';
  if (m < 60)  return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24)  return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function initNewsPage() {
  // Sentiment filters
  $$('.filter-btn', $('#sentimentFilter')).forEach(btn => {
    btn.addEventListener('click', () => {
      newsState.sentiment = btn.dataset.val;
      $$('.filter-btn', $('#sentimentFilter')).forEach(b => b.classList.remove('is-active'));
      btn.classList.add('is-active');
      loadNews();
    });
  });
  // Coin filters
  $$('.filter-btn', $('#coinFilter')).forEach(btn => {
    btn.addEventListener('click', () => {
      newsState.coin = btn.dataset.val;
      $$('.filter-btn', $('#coinFilter')).forEach(b => b.classList.remove('is-active'));
      btn.classList.add('is-active');
      loadNews();
    });
  });
  // Refresh button
  $('#refreshNewsBtn')?.addEventListener('click', () => loadNews(true));
}

/* ════════════════════════════════════════════════════════════
   TRADING MODULE
   ════════════════════════════════════════════════════════════ */
const BACKEND = 'http://localhost:3001';

const trade = {
  account:     null,   // fetched from backend
  action:      'buy',  // 'buy' | 'sell'
  selectedCoin: 'bitcoin',
  backendOk:   false,
};

/* ── Backend ping ── */
async function pingBackend() {
  const banner = $('#backendBanner');
  try {
    const res = await fetch(`${BACKEND}/api/health`, { signal: AbortSignal.timeout(3000) });
    if (!res.ok) throw new Error();
    trade.backendOk = true;
    if (banner) {
      banner.className = 'backend-banner is-ok';
      const msg = banner.querySelector('#backendMsg');
      const hint = banner.querySelector('.backend-hint');
      if (msg)  msg.textContent = '✓ Backend connected at localhost:3001';
      if (hint) hint.style.display = 'none';
    }
  } catch {
    trade.backendOk = false;
    if (banner) {
      banner.className = 'backend-banner is-err';
      const msg = banner.querySelector('#backendMsg');
      if (msg) msg.textContent = '✗ Backend not running — start it first';
    }
  }
}

/* ── Fetch account from backend ── */
async function fetchAccount() {
  try {
    const res = await backendFetch(`${BACKEND}/api/account`);
    if (res.status === 401) {
      // Token expired — force re-login
      authClearToken();
      showAuthModal();
      return;
    }
    const data = await res.json();
    trade.account = data;
    renderTradeUI();
  } catch { /* backend down — silently skip */ }
}

/* ── Place trade ── */
async function placeTrade() {
  if (!trade.backendOk) {
    showOrderMsg('Backend not running. Start server.js first.', 'err');
    return;
  }
  const amtInput = $('#orderAmount');
  const amount   = parseFloat(amtInput?.value);
  if (!amount || amount <= 0) { showOrderMsg('Enter a valid amount.', 'err'); return; }

  const coinId = trade.selectedCoin;
  const d      = state.data[coinId];
  if (!d) { showOrderMsg('Price data not available yet.', 'err'); return; }
  const sym    = ALL.find(a => a.id === coinId)?.sym ?? coinId.toUpperCase();

  const btn = $('#placeOrderBtn');
  if (btn) { btn.textContent = 'Placing…'; btn.disabled = true; }

  try {
    const res = await backendFetch(`${BACKEND}/api/trade`, {
      method:  'POST',
      body: JSON.stringify({
        coinId,
        sym,
        action:    trade.action,
        amountUSD: amount,
        price:     d.price,
      }),
    });
    const data = await res.json();
    if (!res.ok) { showOrderMsg(data.error ?? 'Trade failed.', 'err'); return; }
    trade.account = data.account;
    showOrderMsg(
      `${trade.action === 'buy' ? 'Bought' : 'Sold'} $${amount.toFixed(2)} of ${sym} ✓`,
      'ok'
    );
    if (amtInput) amtInput.value = '';
    renderTradeUI();
    updateOrderPreview();
  } catch {
    showOrderMsg('Network error — is the backend running?', 'err');
  } finally {
    if (btn) { btn.disabled = false; updatePlaceBtn(); }
  }
}

/* ── Reset account ── */
async function resetAccount() {
  if (!trade.backendOk) return;
  if (!confirm('Reset your account to $10,000? All trades will be lost.')) return;
  try {
    const res  = await backendFetch(`${BACKEND}/api/reset`, { method: 'POST' });
    const data = await res.json();
    trade.account = data.account;
    showOrderMsg('Account reset to $10,000 ✓', 'ok');
    renderTradeUI();
  } catch { showOrderMsg('Reset failed.', 'err'); }
}

/* ── Helper: show message ── */
function showOrderMsg(msg, type) {
  const el = $('#orderMsg');
  if (!el) return;
  el.textContent = msg;
  el.className   = `order-msg ${type}`;
  setTimeout(() => { if (el.textContent === msg) { el.textContent = ''; el.className = 'order-msg'; } }, 4000);
}

/* ── Update order preview box ── */
function updateOrderPreview() {
  const amt   = parseFloat($('#orderAmount')?.value) || 0;
  const d     = state.data[trade.selectedCoin];
  const price = d?.price ?? 0;
  const units = price > 0 ? amt / price : 0;
  const pu    = $('#prevUnits'),  pp = $('#prevPrice'), pt = $('#prevTotal');
  if (pu) pu.textContent = units > 0 ? units.toFixed(6) : '—';
  if (pp) pp.textContent = price > 0 ? fmtPrice(price)  : '—';
  if (pt) pt.textContent = amt   > 0 ? `$${amt.toFixed(2)}` : '—';
}

/* ── Update place button label/style ── */
function updatePlaceBtn() {
  const btn = $('#placeOrderBtn');
  if (!btn) return;
  btn.textContent = trade.action === 'buy' ? 'Buy' : 'Sell';
  btn.className   = 'place-order-btn' + (trade.action === 'sell' ? ' is-sell' : '');
}

/* ── Render live price in order form ── */
function renderOrderFormPrice() {
  const d   = state.data[trade.selectedCoin];
  const lp  = $('#orderLivePrice');
  const lc  = $('#orderLiveChg');
  if (!d) return;
  if (lp) lp.textContent = fmtPrice(d.price);
  if (lc) {
    lc.textContent = fmtChg(d.change);
    lc.className   = 'clp-chg ' + (d.change >= 0 ? 'up' : 'down');
  }
}

/* ── Build coin selector ── */
function buildCoinSelect() {
  const sel = $('#orderCoin');
  if (!sel || sel.children.length > 0) return;
  sel.innerHTML = ALL.map(a =>
    `<option value="${a.id}">${a.sym} — ${capitalize(a.id)}</option>`
  ).join('');
  sel.value = trade.selectedCoin;
  sel.addEventListener('change', () => {
    trade.selectedCoin = sel.value;
    renderOrderFormPrice();
    updateOrderPreview();
  });
}

/* ── Render summary bar ── */
function renderTradeSummary() {
  const acc = trade.account;
  if (!acc) return;

  // Portfolio value using current live prices
  const portVal = Object.entries(acc.holdings).reduce((sum, [id, h]) => {
    return sum + h.units * (state.data[id]?.price ?? 0);
  }, 0);

  const totalVal = acc.balance + portVal;
  const pnl      = totalVal - 10000;
  const pnlPct   = (pnl / 10000) * 100;

  const bal = $('#tsBalance');
  const prt = $('#tsPortfolio');
  const pl  = $('#tsPnl');
  const plp = $('#tsPnlPct');
  const pos = $('#tsPositions');

  if (bal) bal.textContent = `$${acc.balance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  if (prt) prt.textContent = `$${portVal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  if (pl)  {
    pl.textContent = (pnl >= 0 ? '+$' : '-$') + Math.abs(pnl).toFixed(2);
    pl.className   = 'ts-val ' + (pnl >= 0 ? 'pos' : 'neg');
  }
  if (plp) {
    plp.textContent = (pnlPct >= 0 ? '+' : '') + pnlPct.toFixed(2) + '%';
    plp.className   = 'ts-pct ' + (pnlPct >= 0 ? 'pos' : 'neg');
  }
  if (pos) pos.textContent = Object.keys(acc.holdings).length + ' coins';
}

/* ── Render holdings list ── */
function renderHoldings() {
  const list = $('#holdingsList');
  if (!list || !trade.account) return;
  const holdings = trade.account.holdings;
  if (Object.keys(holdings).length === 0) {
    list.innerHTML = '<div class="empty-state">No positions yet. Place your first trade.</div>';
    return;
  }
  list.innerHTML = Object.entries(holdings).map(([id, h]) => {
    const cur  = state.data[id]?.price ?? 0;
    const val  = h.units * cur;
    const cost = h.units * h.avgCost;
    const pnl  = val - cost;
    const pnlP = cost > 0 ? (pnl / cost) * 100 : 0;
    const cls  = pnl >= 0 ? 'pos' : 'neg';
    return `<div class="holding-row">
      <div>
        <div class="holding-sym">${h.sym}</div>
        <div class="holding-sub">${h.units.toFixed(6)} units @ ${fmtPrice(h.avgCost)}</div>
      </div>
      <div class="holding-val">${fmtPrice(cur)}</div>
      <div class="holding-pnl ${cls}">
        ${pnl >= 0 ? '+' : ''}$${Math.abs(pnl).toFixed(2)}<br>
        <span style="font-size:10px">${pnlP >= 0 ? '+' : ''}${pnlP.toFixed(2)}%</span>
      </div>
      <button class="sell-quick-btn" data-id="${id}" data-val="${val.toFixed(2)}">Sell All</button>
    </div>`;
  }).join('');

  // Wire "Sell All" buttons
  $$('.sell-quick-btn', list).forEach(btn => {
    btn.addEventListener('click', () => {
      const id  = btn.dataset.id;
      const val = parseFloat(btn.dataset.val);
      const sel = $('#orderCoin');
      const amt = $('#orderAmount');
      const tbs = $('#tabSell');
      // Switch to sell mode for this coin
      trade.selectedCoin    = id;
      trade.action          = 'sell';
      if (sel) sel.value    = id;
      if (amt) amt.value    = val.toFixed(2);
      $$('.order-tab').forEach(t => t.classList.remove('is-active'));
      if (tbs) tbs.classList.add('is-active');
      updatePlaceBtn();
      renderOrderFormPrice();
      updateOrderPreview();
      // Scroll to order form
      $('.trade-order-panel')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  });
}

/* ── Render order history ── */
function renderOrderHistory() {
  const body = $('#orderHistoryBody');
  if (!body || !trade.account) return;
  const orders = trade.account.orders;
  if (!orders.length) {
    body.innerHTML = '<div class="empty-state">No trades yet.</div>';
    return;
  }
  body.innerHTML = orders.map(o => {
    const time = new Date(o.time).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    return `<div class="order-row">
      <span>${time}</span>
      <span>${o.sym}</span>
      <span><span class="order-action-badge ${o.action}">${o.action.toUpperCase()}</span></span>
      <span>${o.units.toFixed(6)}</span>
      <span>${fmtPrice(o.price)}</span>
      <span>$${o.amountUSD.toFixed(2)}</span>
    </div>`;
  }).join('');
}

/* ── Master trade render ── */
function renderTradeUI() {
  renderTradeSummary();
  renderHoldings();
  renderOrderHistory();
  renderOrderFormPrice();
}

/* ── Init trade page ── */
function initTradePage() {
  buildCoinSelect();

  // Action tabs
  const tabBuy  = $('#tabBuy');
  const tabSell = $('#tabSell');
  tabBuy?.addEventListener('click', () => {
    trade.action = 'buy';
    tabBuy.classList.add('is-active');
    tabSell?.classList.remove('is-active');
    updatePlaceBtn();
  });
  tabSell?.addEventListener('click', () => {
    trade.action = 'sell';
    tabSell.classList.add('is-active');
    tabBuy?.classList.remove('is-active');
    updatePlaceBtn();
  });

  // Quick amount buttons
  $$('.qa-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const v   = btn.dataset.amt;
      const inp = $('#orderAmount');
      if (!inp) return;
      if (v === 'all') {
        // All-in = full cash balance (buy) or full holding value (sell)
        if (trade.action === 'buy') {
          inp.value = (trade.account?.balance ?? 0).toFixed(2);
        } else {
          const h = trade.account?.holdings[trade.selectedCoin];
          const p = state.data[trade.selectedCoin]?.price ?? 0;
          inp.value = h ? (h.units * p).toFixed(2) : '0';
        }
      } else {
        inp.value = v;
      }
      updateOrderPreview();
    });
  });

  // Amount input live preview
  $('#orderAmount')?.addEventListener('input', updateOrderPreview);

  // Place order button
  $('#placeOrderBtn')?.addEventListener('click', placeTrade);

  // Reset button
  $('#resetBtn')?.addEventListener('click', resetAccount);

  // Ping backend
  pingBackend();

  // Keep trade UI updated with live prices every 2s
  setInterval(() => {
    if ($('#page-trade')?.classList.contains('is-active')) {
      renderTradeUI();
    }
  }, 2000);
}

/* ============================================================
   INIT
   ============================================================ */
async function init() {
  try {
    initGlassEffect();
    initRouter();
    initFocusOverlay();
    initNewsPage();
    renderAll(true);
    initScrollReveal();
    initTradePage();
    fetchLiveData();
    setInterval(microTick,     2000);
    setInterval(fetchLiveData, 15000);
    setInterval(() => { drawGauge(); drawDonut(); }, 4000);
    // Auth last — shows modal if not logged in
    await initAuth();
  } catch (err) {
    console.error('Init error:', err);
    $$('[data-reveal]').forEach(el => el.classList.add('is-visible'));
  }
}

document.addEventListener('DOMContentLoaded', init);