/* ===== 脑力健身房 · 后端服务（零依赖，Node >= 18）=====
 *
 * 启动：node server/server.js   （默认端口 8787，可用 PORT 环境变量覆盖）
 * 存储：server/data/db.json（自动创建；首次启动时若存在旧的 localStorage 数据由前端上报迁移）
 *
 * API 一览（全部 JSON）：
 *   GET  /api/health                 → { ok, now }
 *   GET  /api/state                  → { activity, scores, updatedAt }
 *   POST /api/activity               → body: { testId, extra }   记一次练习流水
 *   POST /api/scores/schulte         → body: { date, mode, sec } 记录方格成绩（自动留最佳）
 *   POST /api/scores/digit           → body: { date, len }       记录数字广度（自动留最佳）
 *   POST /api/scores/breathing       → body: { date, cycles, preset }
 *   POST /api/scores/palace          → body: { date, correct, total, pct }
 *   POST /api/scores/pressure        → body: { date, q, pack, duration, speed, struct, content, rating }
 *   POST /api/migrate                → body: { activity:[], scores:{} }  旧 localStorage 数据一次性迁移
 *   POST /api/reset                  → 清空全部数据（保留文件，便于撤销）
 *
 * 说明：静态文件服务根目录为项目根（server.js 上一级），因此
 *   http://localhost:8787/            即大厅首页
 *   http://localhost:8787/tests/...   即各训练页
 */
'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 8787;
const ROOT = path.resolve(__dirname, '..');
const DATA_DIR = path.join(__dirname, 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2'
};

/* ---------- 数据层 ---------- */
let db = { activity: [], scores: { schulte: {}, digit: [], breathing: [], palace: [], pressure: [], gonogo: [], stroop: [], srt: [], corsi: [], tmt: [], nback: [], rotation: [], sdmt: [], drm: [], delay: [] }, updatedAt: null };

function loadDb() {
  try {
    if (fs.existsSync(DB_FILE)) {
      const parsed = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
      db = Object.assign(db, parsed);
      // 分层合并 scores：磁盘缺新类型时补空数组，避免旧 db.json 挤掉新增键
      db.scores = Object.assign(
        { schulte: {}, digit: [], breathing: [], palace: [], pressure: [], gonogo: [], stroop: [], srt: [], corsi: [], tmt: [], nback: [], rotation: [], sdmt: [], drm: [], delay: [] },
        parsed.scores || {}
      );
    }
  } catch (e) {
    console.error('[db] 读取失败，使用空数据：', e.message);
  }
}
function saveDb() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  db.updatedAt = new Date().toISOString();
  const tmp = DB_FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(db, null, 1));
  fs.renameSync(tmp, DB_FILE);
}

function todayKey(d) {
  d = d || new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

/* ---------- 成绩写入规则 ---------- */
function applyScore(kind, body) {
  const date = typeof body.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(body.date) ? body.date : todayKey();
  if (kind === 'schulte') {
    const mode = ['asc', 'desc', 'color'].includes(body.mode) ? body.mode : 'asc';
    const sec = Number(body.sec);
    if (!isFinite(sec) || sec <= 0 || sec > 3600) return false;
    const rec = db.scores.schulte[date] || { asc: null, desc: null, color: null, count: 0 };
    if (rec[mode] == null || sec < rec[mode]) rec[mode] = +sec.toFixed(2);
    rec.count++;
    db.scores.schulte[date] = rec;
    return true;
  }
  if (kind === 'digit') {
    const len = Number(body.len);
    if (!isFinite(len) || len < 1 || len > 20) return false;
    const s = db.scores.digit;
    const i = s.findIndex(r => r.date === date);
    if (i >= 0) { if (len > s[i].maxLen) s[i].maxLen = Math.round(len); }
    else s.push({ date, maxLen: Math.round(len) });
    return true;
  }
  if (kind === 'breathing') {
    const cycles = Number(body.cycles);
    if (!isFinite(cycles) || cycles < 1 || cycles > 100) return false;
    db.scores.breathing.push({ date, cycles: Math.round(cycles), preset: String(body.preset || '478').slice(0, 10), ts: Date.now() });
    if (db.scores.breathing.length > 2000) db.scores.breathing = db.scores.breathing.slice(-2000);
    return true;
  }
  if (kind === 'palace') {
    const correct = Number(body.correct), total = Number(body.total);
    if (!isFinite(correct) || !isFinite(total) || total < 1 || correct < 0 || correct > total) return false;
    db.scores.palace.push({ date, correct, total, pct: Math.round(correct / total * 100), ts: Date.now() });
    return true;
  }
  if (kind === 'pressure') {
    const rating = Number(body.rating);
    db.scores.pressure.push({
      date,
      q: String(body.q || '').slice(0, 120),
      pack: String(body.pack || 'meeting').slice(0, 16),
      duration: Math.max(0, Math.round(Number(body.duration) || 0)),
      speed: Number(body.speed) || 0,
      struct: Number(body.struct) || 0,
      content: Number(body.content) || 0,
      rating: isFinite(rating) ? Math.min(Math.max(rating, 0), 3) : 0,
      ts: Date.now()
    });
    return true;
  }
  if (kind === 'gonogo') {
    const rt = Number(body.rt);
    db.scores.gonogo.push({
      date,
      rt: isFinite(rt) && rt > 0 ? Math.round(rt) : null,
      accuracy: Number(body.accuracy) || 0,
      commission: Number(body.commission) || 0,
      ts: Date.now()
    });
    return true;
  }
  if (kind === 'stroop') {
    db.scores.stroop.push({
      date,
      interference: Number(body.interference) || 0,
      accuracy: Number(body.accuracy) || 0,
      mc: Number(body.mc) || 0,
      mi: Number(body.mi) || 0,
      ts: Date.now()
    });
    return true;
  }
  if (kind === 'srt') {
    const rt = Number(body.rt);
    db.scores.srt.push({
      date,
      rt: isFinite(rt) && rt > 0 ? Math.round(rt) : null,
      premature: Math.max(0, Math.round(Number(body.premature) || 0)),
      ts: Date.now()
    });
    return true;
  }
  /* --- 通用追加型：任意标量字段白名单透传，防注入只留已知键 --- */
  const FLEX_KEYS = ['rt','span','level','sec','errors','accuracy','correct','total','pct',
                     'hitRate','falseRate','patience','premature','commission','interference','mc','mi'];
  if (db.scores[kind]) {
    const rec = { date, ts: Date.now() };
    for (const k of Object.keys(body)) {
      if (k === 'date' || k === 'ts') continue;
      const v = body[k];
      if (typeof v === 'number' && isFinite(v)) rec[k] = Math.round(v * 1000) / 1000;
      else if (typeof v === 'string') rec[k] = v.slice(0, 120);
    }
    db.scores[kind].push(rec);
    return true;
  }
  return false;
}

/* ---------- 迁移（旧 localStorage → 服务器） ---------- */
function migrate(payload) {
  let nAct = 0, nScore = 0;
  if (Array.isArray(payload.activity)) {
    const seen = new Set(db.activity.map(a => a.ts));
    for (const a of payload.activity) {
      if (a && a.ts && !seen.has(a.ts) && a.testId) {
        db.activity.push({
          date: /^\d{4}-\d{2}-\d{2}$/.test(a.date) ? a.date : todayKey(),
          ts: a.ts, testId: String(a.testId).slice(0, 20), extra: a.extra || {}
        });
        seen.add(a.ts); nAct++;
      }
    }
    db.activity.sort((x, y) => x.ts - y.ts);
  }
  const sc = payload.scores || {};
  if (Array.isArray(sc.schulte)) for (const r of sc.schulte) { if (applyScore('schulte', r)) nScore++; }
  if (Array.isArray(sc.digit)) for (const r of sc.digit) { if (applyScore('digit', r)) nScore++; }
  if (Array.isArray(sc.breathing)) for (const r of sc.breathing) { if (applyScore('breathing', r)) nScore++; }
  if (Array.isArray(sc.palace)) for (const r of sc.palace) { if (applyScore('palace', r)) nScore++; }
  if (Array.isArray(sc.pressure)) for (const r of sc.pressure) { if (applyScore('pressure', r)) nScore++; }
  return { activity: nAct, scores: nScore };
}

/* ---------- HTTP 工具 ---------- */
const CORS_ORIGIN = process.env.CORS_ORIGIN || '*'; // 前端域名，生产建议设为 Pages 域名
function send(res, status, data) {
  const body = JSON.stringify(data);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'Access-Control-Allow-Origin': CORS_ORIGIN,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  });
  res.end(body);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', c => {
      size += c.length;
      if (size > 2 * 1024 * 1024) { reject(new Error('body too large')); req.destroy(); return; }
      chunks.push(c);
    });
    req.on('end', () => {
      if (!chunks.length) return resolve({});
      try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8'))); }
      catch (e) { reject(new Error('invalid json')); }
    });
    req.on('error', reject);
  });
}

/* ---------- API 路由 ---------- */
async function handleApi(req, res, pathname) {
  // 跨域预检（GitHub Pages 等外部前端调用时浏览器会先发 OPTIONS）
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': CORS_ORIGIN,
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Max-Age': '86400'
    });
    return res.end();
  }

  if (req.method === 'GET' && pathname === '/api/health') {
    return send(res, 200, { ok: true, now: Date.now() });
  }

  if (req.method === 'GET' && pathname === '/api/state') {
    return send(res, 200, { activity: db.activity, scores: db.scores, updatedAt: db.updatedAt });
  }

  if (req.method === 'POST' && pathname === '/api/activity') {
    const body = await readBody(req);
    const testId = String(body.testId || '').slice(0, 20);
    if (!testId) return send(res, 400, { error: 'testId required' });
    db.activity.push({
      date: todayKey(), ts: Date.now(), testId,
      extra: body.extra && typeof body.extra === 'object' ? body.extra : {}
    });
    if (db.activity.length > 5000) db.activity = db.activity.slice(-5000);
    saveDb();
    return send(res, 200, { ok: true, total: db.activity.length });
  }

  const scoreMatch = pathname.match(/^\/api\/scores\/(schulte|digit|breathing|palace|pressure|gonogo|stroop|srt|corsi|tmt|nback|rotation|sdmt|drm|delay)$/);
  if (req.method === 'POST' && scoreMatch) {
    const body = await readBody(req);
    if (!applyScore(scoreMatch[1], body)) return send(res, 400, { error: 'invalid score payload' });
    saveDb();
    return send(res, 200, { ok: true });
  }

  if (req.method === 'POST' && pathname === '/api/migrate') {
    const body = await readBody(req);
    const r = migrate(body);
    saveDb();
    return send(res, 200, { ok: true, migrated: r });
  }

  if (req.method === 'POST' && pathname === '/api/reset') {
    db = { activity: [], scores: { schulte: {}, digit: [], breathing: [], palace: [], pressure: [], gonogo: [], stroop: [], srt: [], corsi: [], tmt: [], nback: [], rotation: [], sdmt: [], drm: [], delay: [] }, updatedAt: null };
    saveDb();
    return send(res, 200, { ok: true });
  }

  return send(res, 404, { error: 'not found' });
}

/* ---------- 静态文件 ---------- */
function serveStatic(req, res, pathname) {
  if (pathname === '/') pathname = '/index.html';
  const filePath = path.normalize(path.join(ROOT, pathname));
  if (!filePath.startsWith(ROOT)) { res.writeHead(403); return res.end('forbidden'); }
  fs.readFile(filePath, (err, buf) => {
    if (err) { res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }); return res.end('404 Not Found'); }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(filePath).toLowerCase()] || 'application/octet-stream' });
    res.end(buf);
  });
}

/* ---------- 服务器 ---------- */
loadDb();

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  const pathname = decodeURIComponent(url.pathname);
  try {
    if (pathname.startsWith('/api/')) return await handleApi(req, res, pathname);
    return serveStatic(req, res, pathname);
  } catch (e) {
    return send(res, 500, { error: e.message });
  }
});

server.listen(PORT, () => {
  console.log('脑力健身房后端已启动');
  console.log('  本机访问: http://localhost:' + PORT);
  console.log('  数据文件: ' + DB_FILE);
});
