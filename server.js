'use strict';
// Мастер паркура 2D — сервер без внешних зависимостей (Node.js 18+).
// Раздаёт игру из папки public и даёт API: регистрация, вход, ник, рекорды, таблица лидеров.
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { promisify } = require('util');
const scrypt = promisify(crypto.scrypt);

const PORT = Number(process.env.PORT) || 3000;
const COOKIE_SECURE = process.env.COOKIE_SECURE === '1'; // включи при работе через HTTPS
const PUB = path.join(__dirname, 'public');
const DATA = path.join(__dirname, 'data');
const DBF = path.join(DATA, 'db.json');
const LEVELS = 6;
const SESSION_MS = 30 * 24 * 3600 * 1000;
const NICK_RE = /^[A-Za-z0-9_\-А-Яа-яЁё]{3,16}$/u;

// ---------- хранилище (JSON-файл) ----------
fs.mkdirSync(DATA, { recursive: true });
let db = { users: [], sessions: {} };
try { db = JSON.parse(fs.readFileSync(DBF, 'utf8')); }
catch (e) { if (e.code !== 'ENOENT') throw e; }

let saveTimer = null;
function writeNow() {
  clearTimeout(saveTimer); saveTimer = null;
  const tmp = DBF + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(db));
  fs.renameSync(tmp, DBF);
}
function save() { if (!saveTimer) saveTimer = setTimeout(writeNow, 200); }
for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, () => { if (saveTimer) writeNow(); process.exit(0); });

function cleanSessions() {
  const now = Date.now();
  for (const [k, s] of Object.entries(db.sessions)) if (s.exp < now) delete db.sessions[k];
  save();
}
cleanSessions();
setInterval(cleanSessions, 3600 * 1000).unref();

// ---------- помощники ----------
const sha = t => crypto.createHash('sha256').update(t).digest('hex');
const findNick = nick => db.users.find(u => u.nickLower === nick.toLowerCase());
const openOf = best => { let o = 1; while (o < LEVELS && best[o] != null) o++; return o; };
const publicUser = u => ({ nick: u.nick, best: u.best, open: openOf(u.best) });

async function hashPass(pw, salt = crypto.randomBytes(16).toString('hex')) {
  const h = await scrypt(pw, salt, 64);
  return { salt, hash: h.toString('hex') };
}
async function checkPass(u, pw) {
  const { hash } = await hashPass(pw, u.salt);
  return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(u.hash, 'hex'));
}

function send(res, code, obj, headers = {}) {
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...headers });
  res.end(JSON.stringify(obj));
}
function cookies(req) {
  const out = {};
  for (const p of (req.headers.cookie || '').split(';')) {
    const i = p.indexOf('='); if (i > 0) out[p.slice(0, i).trim()] = decodeURIComponent(p.slice(i + 1).trim());
  }
  return out;
}
function sessionCookie(token, maxAgeSec) {
  return `sid=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${maxAgeSec}${COOKIE_SECURE ? '; Secure' : ''}`;
}
function startSession(u) {
  const token = crypto.randomBytes(32).toString('hex');
  db.sessions[sha(token)] = { uid: u.id, exp: Date.now() + SESSION_MS };
  save();
  return sessionCookie(token, SESSION_MS / 1000);
}
function currentUser(req) {
  const t = cookies(req).sid; if (!t) return null;
  const s = db.sessions[sha(t)];
  if (!s || s.exp < Date.now()) return null;
  return db.users.find(u => u.id === s.uid) || null;
}
function readJson(req) {
  return new Promise((resolve, reject) => {
    if (!(req.headers['content-type'] || '').startsWith('application/json')) return reject(Object.assign(new Error('Нужен JSON'), { code: 415 }));
    let size = 0; const chunks = [];
    req.on('data', c => { size += c.length; if (size > 10000) { reject(Object.assign(new Error('Слишком большой запрос'), { code: 413 })); req.destroy(); } else chunks.push(c); });
    req.on('end', () => { try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}')); } catch { reject(Object.assign(new Error('Неверный JSON'), { code: 400 })); } });
    req.on('error', reject);
  });
}
// простое ограничение попыток входа/регистрации: 20 за 10 минут с одного IP
const hits = new Map();
function limited(req) {
  const ip = req.socket.remoteAddress || '?', now = Date.now();
  const h = hits.get(ip);
  if (!h || h.reset < now) { hits.set(ip, { n: 1, reset: now + 600000 }); return false; }
  return ++h.n > 20;
}
function checkNick(nick) {
  if (typeof nick !== 'string' || !NICK_RE.test(nick)) return 'Ник: 3–16 символов, буквы, цифры, _ или -';
  return null;
}

// ---------- API ----------
async function api(req, res, url) {
  const route = req.method + ' ' + url.pathname;
  const me = currentUser(req);

  if (route === 'GET /api/me') return send(res, 200, { user: me ? publicUser(me) : null });

  if (route === 'GET /api/leaderboard') {
    const level = Number(url.searchParams.get('level'));
    if (!Number.isInteger(level) || level < 1 || level > LEVELS) return send(res, 400, { error: 'Неверная трасса' });
    const all = db.users.filter(u => u.best[level] != null).sort((a, b) => a.best[level] - b.best[level]);
    const top = all.slice(0, 10).map(u => ({ nick: u.nick, time: u.best[level] }));
    const rank = me ? all.indexOf(me) + 1 : 0;
    return send(res, 200, { top, me: rank ? { rank, time: me.best[level] } : null });
  }

  if (req.method !== 'POST') return send(res, 404, { error: 'Не найдено' });
  const body = await readJson(req);

  if (route === 'POST /api/register') {
    if (limited(req)) return send(res, 429, { error: 'Слишком много попыток, подожди немного' });
    const { nick, password } = body;
    const bad = checkNick(nick); if (bad) return send(res, 400, { error: bad });
    if (typeof password !== 'string' || password.length < 6 || password.length > 128) return send(res, 400, { error: 'Пароль: от 6 до 128 символов' });
    if (findNick(nick)) return send(res, 409, { error: 'Такой ник уже занят' });
    const { salt, hash } = await hashPass(password);
    const u = { id: crypto.randomUUID(), nick, nickLower: nick.toLowerCase(), salt, hash, created: Date.now(), best: {} };
    db.users.push(u); save();
    return send(res, 201, { user: publicUser(u) }, { 'Set-Cookie': startSession(u) });
  }

  if (route === 'POST /api/login') {
    if (limited(req)) return send(res, 429, { error: 'Слишком много попыток, подожди немного' });
    const { nick, password } = body;
    const u = typeof nick === 'string' ? findNick(nick) : null;
    if (!u || typeof password !== 'string' || !(await checkPass(u, password))) return send(res, 401, { error: 'Неверный ник или пароль' });
    return send(res, 200, { user: publicUser(u) }, { 'Set-Cookie': startSession(u) });
  }

  if (route === 'POST /api/logout') {
    const t = cookies(req).sid; if (t) { delete db.sessions[sha(t)]; save(); }
    return send(res, 200, { ok: true }, { 'Set-Cookie': sessionCookie('', 0) });
  }

  if (!me) return send(res, 401, { error: 'Нужно войти' });

  if (route === 'POST /api/nick') {
    const { nick } = body;
    const bad = checkNick(nick); if (bad) return send(res, 400, { error: bad });
    const other = findNick(nick);
    if (other && other !== me) return send(res, 409, { error: 'Такой ник уже занят' });
    me.nick = nick; me.nickLower = nick.toLowerCase(); save();
    return send(res, 200, { user: publicUser(me) });
  }

  if (route === 'POST /api/score') {
    const level = Number(body.level), time = Number(body.time);
    if (!Number.isInteger(level) || level < 1 || level > LEVELS) return send(res, 400, { error: 'Неверная трасса' });
    if (level > openOf(me.best)) return send(res, 403, { error: 'Эта трасса ещё закрыта' });
    if (!Number.isFinite(time) || time < 3 || time > 3600) return send(res, 400, { error: 'Неверное время' });
    const t = Math.round(time * 100) / 100, prev = me.best[level];
    const record = prev == null || t < prev;
    if (record) { me.best[level] = t; save(); }
    return send(res, 200, { record, prev: prev ?? null, ...publicUser(me) });
  }

  return send(res, 404, { error: 'Не найдено' });
}

// ---------- статика ----------
const TYPES = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.png': 'image/png', '.svg': 'image/svg+xml', '.ico': 'image/x-icon' };
function serveStatic(req, res, pathname) {
  let rel;
  try { rel = decodeURIComponent(pathname); } catch { res.writeHead(400); return res.end(); }
  if (rel.endsWith('/')) rel += 'index.html';
  const file = path.join(PUB, path.normalize(rel));
  if (!file.startsWith(PUB + path.sep)) { res.writeHead(403); return res.end(); }
  fs.readFile(file, (err, buf) => {
    if (err) { res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }); return res.end('Не найдено'); }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-cache', 'X-Content-Type-Options': 'nosniff' });
    res.end(req.method === 'HEAD' ? undefined : buf);
  });
}

http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://localhost');
    if (url.pathname.startsWith('/api/')) return await api(req, res, url);
    if (req.method !== 'GET' && req.method !== 'HEAD') return send(res, 405, { error: 'Метод не поддерживается' });
    serveStatic(req, res, url.pathname);
  } catch (e) {
    if (e.code >= 400 && e.code < 500) return send(res, e.code, { error: e.message });
    console.error(e);
    if (!res.headersSent) send(res, 500, { error: 'Внутренняя ошибка сервера' });
  }
}).listen(PORT, () => console.log(`Мастер паркура: http://localhost:${PORT}`));
