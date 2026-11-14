/* Claude Finance on the phone: a position watcher and a stock checker, read-only.
   data.json is locked on Sam's Mac (signal_lab/mirror.py): PBKDF2-SHA256 makes two keys from the code,
   AES-256-CBC locks the snapshot, HMAC-SHA256 seals it. This page checks the seal, unlocks it and draws its own simple
   screens; "Full view" hands the V2 state to the Mac's front end (ct.js + ct.css = signal_lab/web/app.js + app.css).
   Nothing here can change anything; there are no buttons that act on the account. */
(() => {
'use strict';
const LS_KEY = 'ctm.key', LS_ENV = 'ctm.env', LS_UI = 'ctm.ui', LS_SEEN = 'ctm.seen', LS_TIP = 'ctm.tip';
const REFRESH_MS = 5 * 60 * 1000;
// which version of the screens this page is (signal_lab/mirror.py stamps it); data.json says which one is newest
const BUILD = (document.querySelector('meta[name="ct-build"]') || {}).content || '';
// Claude Finance's version, shown by the name (one number for the Mac and the phone: ct.js = signal_lab/web/app.js holds it)
const VER = window.CT_VERSION ? 'v' + window.CT_VERSION : '';
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => Array.from(el.querySelectorAll(s));
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const verTag = () => VER ? `<sup class="w-ver">${esc(VER)}</sup>` : '';
const MINUS = '−';
const isNum = v => typeof v === 'number' && isFinite(v);
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
function D(s) { const [y, m, d] = String(s).slice(0, 10).split('-').map(Number); return new Date(y, (m || 1) - 1, d || 1); }
const dayStart = d => new Date(d.getFullYear(), d.getMonth(), d.getDate());
function clock(t) {
  const d = new Date(t), h = d.getHours();
  return `${h % 12 || 12}:${String(d.getMinutes()).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`;
}
function when(t) {
  const d = new Date(t), today = dayStart(new Date()), n = Math.round((today - dayStart(d)) / 864e5);
  return (n === 0 ? 'today' : n === 1 ? 'yesterday' : n < 6 ? DOW[d.getDay()] : `${MON[d.getMonth()]} ${d.getDate()}`) + ' at ' + clock(t);
}
const ET = (() => { try { return new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit',
  day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }); } catch (e) { return null; } })();
function etNow(t) {
  if (!ET) return null;
  const p = {};
  for (const x of ET.formatToParts(new Date(t == null ? Date.now() : t))) p[x.type] = x.value;
  return { day: `${p.year}-${p.month}-${p.day}`, min: (+p.hour % 24) * 60 + +p.minute };
}
const isoAdd = (iso, n) => { const d = new Date(iso + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const isoDow = iso => new Date(iso + 'T12:00:00Z').getUTCDay();
const weekday = iso => isoDow(iso) % 6 !== 0;
const hm = s => { const [h, m] = String(s).split(':').map(Number); return h * 60 + (m || 0); };
const clockMin = m => `${(Math.floor(m / 60) % 12) || 12}:${String(m % 60).padStart(2, '0')} ${m < 720 ? 'AM' : 'PM'}`;
const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
function dayWord(iso, today) {
  const n = Math.round((Date.parse(iso + 'T12:00:00Z') - Date.parse(today + 'T12:00:00Z')) / 864e5);
  return n === 0 ? 'today' : n === 1 ? 'tomorrow' : n > 1 && n < 7 ? DAYS[isoDow(iso)] : fmtD(iso);
}
function marketNow(t) {
  const cal = (state.snap || {}).cal, e = etNow(t);
  if (!cal || !e) return null;
  const hol = cal.holidays || {}, early = new Set(cal.early || []);
  const trading = iso => weekday(iso) && !hol[iso], closes = iso => early.has(iso) ? 780 : 960;
  if (trading(e.day) && e.min >= 570 && e.min < closes(e.day))
    return { open: true, text: `Market open · closes at ${clockMin(closes(e.day))}${early.has(e.day) ? ' (early close)' : ''}` };
  const why = hol[e.day] ? `closed for ${hol[e.day]}` : !weekday(e.day) ? 'closed for the weekend' : e.min < 570 ? 'not open yet' : 'closed for the day';
  let d = e.day;
  if (!(trading(d) && e.min < 570)) { do d = isoAdd(d, 1); while (!trading(d)); }
  return { open: false, text: `Market ${why} · opens ${dayWord(d, e.day)} at 9:30 AM${early.has(d) ? ' (closes 1 PM)' : ''}` };
}
// the Mac's automatic scans run on weekdays (holidays too); the copy reaches phones a minute or two later
function scanSlot(t, dir) {
  const cal = (state.snap || {}).cal, e = etNow(t);
  if (!cal || !e || !(cal.scans || []).length) return null;
  const times = cal.scans.map(hm).sort((a, b) => dir * (a - b)), grace = dir > 0 ? 0 : 25;
  for (let k = 0, d = e.day; k < 9; k++, d = isoAdd(d, dir)) {
    if (!weekday(d)) continue;
    const m = times.find(x => k > 0 || (dir > 0 ? x > e.min : x + grace <= e.min));
    if (m != null) return { day: d, min: m, today: e.day };
  }
  return null;
}
function nextScanText(t) {
  const n = scanSlot(t, 1);
  return n ? `${dayWord(n.day, n.today)} around ${clockMin(n.min)}` : '';
}
function readJSON(k) { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } }
function writeJSON(k, v) { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* private mode */ } }
const te = new TextEncoder(), td = new TextDecoder();
const b64d = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));
function b64e(u) { let s = ''; for (let i = 0; i < u.length; i++) s += String.fromCharCode(u[i]); return btoa(s); }
const norm = c => String(c || '').toLowerCase().replace(/[^a-z0-9]/g, '');
function cat(...parts) {
  const out = new Uint8Array(parts.reduce((a, p) => a + p.length, 0));
  let o = 0; for (const p of parts) { out.set(p, o); o += p.length; }
  return out;
}
async function derive(code, env) {
  const base = await crypto.subtle.importKey('raw', te.encode(norm(code)), 'PBKDF2', false, ['deriveBits']);
  return new Uint8Array(await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: b64d(env.salt), iterations: env.rounds }, base, 512));
}
async function unlock(env, bits) {
  const salt = b64d(env.salt), iv = b64d(env.iv), ct = b64d(env.ct);
  const mk = await crypto.subtle.importKey('raw', bits.slice(32), { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']);
  if (!await crypto.subtle.verify('HMAC', mk, b64d(env.mac), cat(te.encode(`ctm1:${env.rounds}:`), salt, iv, ct))) throw new Error('code');
  const ek = await crypto.subtle.importKey('raw', bits.slice(0, 32), { name: 'AES-CBC' }, false, ['decrypt']);
  const buf = await crypto.subtle.decrypt({ name: 'AES-CBC', iv }, ek, ct);
  if (env.z === 'gzip') return JSON.parse(await new Response(new Blob([buf]).stream().pipeThrough(new DecompressionStream('gzip'))).text());
  return JSON.parse(td.decode(buf));
}
function savedBits(env) {
  const k = readJSON(LS_KEY);
  return k && env && k.salt === env.salt && k.rounds === env.rounds ? b64d(k.bits) : null;
}
async function fetchEnv() {
  // data.z.json is the same locked copy squeezed with gzip (a third of the download); older Safari reads data.json
  const z = 'DecompressionStream' in window;
  let r = await fetch((z ? 'data.z.json' : 'data.json') + '?t=' + Date.now(), { cache: 'no-store' });
  if (!r.ok && z) r = await fetch('data.json?t=' + Date.now(), { cache: 'no-store' });
  if (!r.ok) throw new Error('HTTP ' + r.status);
  const env = await r.json();
  if (env.app !== 'claude-trade-mirror') throw new Error('not a mirror file');
  return env;
}
function lockMsg(text, ok) { const m = $('#lock-msg'); m.textContent = text || ''; m.classList.toggle('ok', !!ok); }
function showLock(msg) {
  if (window.CT && CT.whatsNew && CT.whatsNew.hide) CT.whatsNew.hide();  // never the What's new screen over the lock
  $('#app').hidden = true; $('#lock').hidden = false;
  const glow = $('body > .aurora'); if (glow) glow.hidden = false;
  lockMsg(msg || '');
  setTimeout(() => { const c = $('#code'); if (c && !('ontouchstart' in window)) c.focus(); }, 50);
}
async function boot() {
  $('#lock h1').insertAdjacentHTML('beforeend', verTag());
  wire();
  if (!window.crypto || !crypto.subtle) { showLock('This browser can’t unlock the mirror. Open the link in Safari.'); return; }
  const cached = readJSON(LS_ENV), bits = savedBits(cached);
  if (cached && bits) {
    try { state.env = cached; state.bits = bits; show(await unlock(cached, bits)); } catch (e) { /* fall through to fetch */ }
  }
  if (!state.snap) showLock();
  // lets the Home Screen app open without a connection (the page and the locked copy, network first; see sw.js)
  if ('serviceWorker' in navigator && window.isSecureContext) navigator.serviceWorker.register('sw.js').catch(() => {});
  await refresh(false, true);  // just opened: newer screens on the site are loaded right away
  setInterval(() => { if (!document.hidden) refresh(); }, REFRESH_MS);
  setInterval(renderTop, 30e3);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) return;
    if (state.newBuild && reloadFor(state.newBuild)) return;  // new screens arrived while it was in the background
    if (Date.now() - state.lastCheck > 60e3) refresh(false, true);
  });
}
// A Home Screen app keeps running the screens it opened with until iOS closes it. When the site has newer ones,
// load them: once per version (a cached page can't loop), and not while the code is half typed.
function reloadFor(b) {
  const c = $('#code');
  if (!b || b === BUILD || (c && c.value && !$('#lock').hidden)) return false;
  try { if (sessionStorage.getItem('ctm.reload') === b) return false; sessionStorage.setItem('ctm.reload', b); } catch (e) { return false; }
  location.reload();
  return true;
}
async function refresh(manual, opening) {
  if (state.busy) return;
  state.busy = true;
  try {
    const env = await fetchEnv();
    if (env.build && BUILD && env.build !== BUILD) {
      if ((opening || manual || !state.snap) && reloadFor(env.build)) return;
      state.newBuild = env.build;  // while someone is reading, wait until the app is opened again
    }
    state.lastCheck = Date.now(); state.offline = false;
    if (state.snap && state.env && env.iv === state.env.iv) return;
    const bits = state.bits && state.env && state.env.salt === env.salt ? state.bits : savedBits(env);
    state.env = env;
    if (bits) {
      try { const snap = await unlock(env, bits); state.bits = bits; writeJSON(LS_ENV, env); show(snap); return; }
      catch (e) { writeJSON(LS_KEY, null); state.bits = null; }
    }
    if (state.snap) { state.snap = null; showLock('The code changed. The new one is on the Mac: Settings → Phone → Show the code.'); }
  } catch (e) {
    state.offline = true;
    if (!state.snap) lockMsg('Can’t reach the mirror right now. Check the connection and try again.');
    else if (manual) toast('No connection: showing the last copy');
  } finally {
    state.busy = false;
    if (state.snap) renderTop();
  }
}
async function onUnlock(ev) {
  ev.preventDefault();
  const code = $('#code').value;
  if (norm(code).length < 4) { lockMsg('Type the code for this copy.'); return; }
  const go = $('#go');
  go.disabled = true; go.textContent = 'Unlocking…'; lockMsg('');
  try {
    const env = state.env || await fetchEnv();
    state.env = env;
    const bits = await derive(code, env);
    let snap;
    try { snap = await unlock(env, bits); } catch (e) {
      const card = $('#lock-form'); card.classList.remove('bad'); void card.offsetWidth; card.classList.add('bad');
      lockMsg('That code didn’t work. Check it on the Mac: Settings → Phone → Show the code (capitals and spaces don’t matter).');
      return;
    }
    state.bits = bits;
    if ($('#remember').checked) { writeJSON(LS_KEY, { salt: env.salt, rounds: env.rounds, bits: b64e(bits) }); writeJSON(LS_ENV, env); }
    $('#code').value = '';
    $('#code').blur();  // close the iPhone keyboard first: hiding a focused field left the header unpainted until the next scroll
    show(snap);
    window.scrollTo(0, 0);
  } catch (e) {
    lockMsg('Can’t reach the mirror right now. Check the connection and try again.');
  } finally { go.disabled = false; go.textContent = 'Unlock'; }
}
function freshness(made) {
  const t = Date.parse(made), now = new Date(), hours = (now - t) / 36e5;
  if (!isFinite(t)) return { cls: 'old', text: 'Unknown age' };
  const n = Math.round((dayStart(now) - dayStart(new Date(t))) / 864e5), dt = new Date(t);
  const short = (n === 0 ? '' : n === 1 ? 'Yesterday ' : n < 6 ? DOW[dt.getDay()] + ' ' : `${MON[dt.getMonth()]} ${dt.getDate()} `) + clock(t);
  // behind = a scheduled scan came and went without a newer copy (the Mac was asleep, off or away)
  const exp = scanSlot(now, -1), got = etNow(t);
  let behind;
  if (exp && got) behind = got.day < exp.day || (got.day === exp.day && got.min < exp.min - 10);
  else { const d = now.getDay(); behind = hours > (d === 0 || d === 6 || (d === 1 && now.getHours() < 11) ? 72 : 26); }
  if (behind) return { cls: hours > 72 ? 'old' : 'stale', text: 'From ' + short, behind: true };
  return { cls: '', text: 'Updated ' + short };
}
// every half minute: the header's age, the market line and anything else that depends on the clock
async function checkNow() {
  const before = state.env && state.env.iv;
  await refresh(true);
  if (state.offline || !state.snap) return;
  if (state.env && state.env.iv !== before) { toast(`New copy from ${MAC()}`); return; }
  const f = freshness(state.snap.scanned_at || state.snap.made), next = nextScanText();
  toast(f.behind ? `Nothing newer yet: ${MAC()} missed its last check` : `Up to date${next ? ` · next update ${next}` : ''}`);
}
const LS_PUSH = 'ctm.push';
const push = { st: 'checking', id: null, err: '' };
const withTimeout = (p, ms) => Promise.race([p, new Promise((_, no) => setTimeout(() => no(new Error('timeout')), ms))]);
const b64u = s => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - s.length % 4) % 4)), c => c.charCodeAt(0));
async function subId(ep) { const h = new Uint8Array(await crypto.subtle.digest('SHA-256', te.encode(ep))); return Array.from(h.slice(0, 6), b => b.toString(16).padStart(2, '0')).join(''); }
async function seal(obj) {
  const env = state.env, bits = state.bits, salt = b64d(env.salt), iv = crypto.getRandomValues(new Uint8Array(16));
  const ek = await crypto.subtle.importKey('raw', bits.slice(0, 32), { name: 'AES-CBC' }, false, ['encrypt']);
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-CBC', iv }, ek, te.encode(JSON.stringify(obj))));
  const mk = await crypto.subtle.importKey('raw', bits.slice(32), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const mac = new Uint8Array(await crypto.subtle.sign('HMAC', mk, cat(te.encode(`ctm1:${env.rounds}:`), salt, iv, ct)));
  return { app: 'claude-trade-push', v: 1, rounds: env.rounds, salt: env.salt, iv: b64e(iv), ct: b64e(ct), mac: b64e(mac) };
}
const devName = () => /iPad/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1) ? 'iPad' : /iPhone/.test(navigator.userAgent) ? 'iPhone' : 'Browser';
async function tellMac(sub, on) {
  const p = (state.snap || {}).push;
  if (!p || !state.bits) throw new Error('locked');
  const j = sub.toJSON ? sub.toJSON() : sub;
  const r = await fetch('https://ntfy.sh/' + encodeURIComponent(p.inbox), { method: 'POST', body: JSON.stringify(await seal({ sub: j, on, name: devName(), at: Date.now() })) });
  if (!r.ok) throw new Error('inbox ' + r.status);
  writeJSON(LS_PUSH, { id: await subId(j.endpoint), sent: Date.now(), on });
}
async function pushCheck() {
  const p = (state.snap || {}).push, app = navigator.standalone || (window.matchMedia && matchMedia('(display-mode: standalone)').matches);
  const ios = /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  if (!p || !p.key) push.st = 'none';
  else if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) push.st = ios && !app ? 'need-home' : 'unsupported';
  else if (Notification.permission === 'denied') push.st = 'blocked';
  else {
    try {
      const reg = await withTimeout(navigator.serviceWorker.ready, 10e3);
      const sub = await withTimeout(reg.pushManager.getSubscription(), 10e3);
      if (!sub || Notification.permission !== 'granted') push.st = 'off';
      else {
        push.id = await subId(sub.endpoint);
        if ((p.on || []).includes(push.id)) push.st = 'on';
        else {
          push.st = 'pending';
          const last = readJSON(LS_PUSH) || {};
          if (last.id !== push.id || Date.now() - (last.sent || 0) > 3600e3) await tellMac(sub, true).catch(() => {});
        }
      }
    } catch (e) { push.st = 'error'; push.err = 'This device didn’t answer. Close the app and open it again.'; }
  }
  const el = $('#push-card'); if (el) el.outerHTML = pushCard();
}
async function pushOn() {
  push.st = 'working'; push.err = ''; let el = $('#push-card'); if (el) el.outerHTML = pushCard();
  try {
    if (await withTimeout(Notification.requestPermission(), 60e3) !== 'granted') { await pushCheck(); return; }
    const reg = await withTimeout(navigator.serviceWorker.ready, 10e3);
    const sub = (await withTimeout(reg.pushManager.getSubscription(), 10e3))
      || await withTimeout(reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64u(state.snap.push.key) }), 20e3);
    await tellMac(sub, true);
    await pushCheck();
  } catch (e) {
    push.st = 'error'; push.err = 'Couldn’t turn them on: ' + (e && e.message === 'timeout' ? 'this device didn’t answer' : (e && e.message) || 'unknown problem') + '. Try again.';
    el = $('#push-card'); if (el) el.outerHTML = pushCard();
  }
}
async function pushOff() {
  try {
    const reg = await withTimeout(navigator.serviceWorker.ready, 10e3), sub = await withTimeout(reg.pushManager.getSubscription(), 10e3);
    if (sub) { await tellMac(sub, false).catch(() => {}); await sub.unsubscribe(); }
  } catch (e) { /* already off */ }
  writeJSON(LS_PUSH, null); await pushCheck(); toast('Notifications are off on this device');
}
function pushCard() {
  const st = push.st;
  if (st === 'none') return '<div id="push-card"></div>';
  const what = 'Stop-losses, profit targets, big one-day drops, earnings tomorrow and new A-rated matches, at most a few per scan.';
  const body = {
    checking: '<p class="small muted">Checking this device…</p>',
    working: '<p class="small muted">Waiting for your answer… (iOS asks once)</p>',
    'need-home': '<p class="small">Notifications need the Home Screen app: in Safari, tap <b>Share</b> then <b>Add to Home Screen</b>, open it from there, and turn them on here.</p>',
    unsupported: '<p class="small muted">This browser can’t get notifications. On an iPhone or iPad, use the Home Screen app.</p>',
    blocked: '<p class="small">Notifications are blocked for this app. Turn them on in <b>Settings → Notifications → Claude Finance</b>, then come back.</p>',
    off: `<p class="small">${what}</p><div class="btns"><button class="ghost go-on" data-act="push-on">Turn on notifications</button></div>`,
    pending: `<p class="small"><span class="warn">Almost on.</span> ${esc(MAC(1))} turns them on at its next scan (${esc(nextScanText() || 'soon')}), and you’ll get a welcome notification.</p><div class="btns"><button class="ghost" data-act="push-off">Cancel</button></div>`,
    on: `<p class="small"><span class="pos">✓ On for this ${esc(devName())}.</span> ${what}</p><div class="btns"><button class="ghost" data-act="push-off">Turn off</button></div>`,
    error: `<p class="small warn">${esc(push.err)}</p><div class="btns"><button class="ghost go-on" data-act="push-on">Try again</button></div>`,
  }[st] || '';
  return `<section class="sec" id="push-card"><div class="sec-h"><h2>Notifications</h2></div><div class="card">${body}</div></section>`;
}

const state = { snap: null, env: null, bits: null, lastCheck: 0, busy: false, offline: false };

/* ======================= the phone app: a position watcher and a stock checker =======================
   Sam's phone doesn't copy the Mac screens: it watches what he owns, and checks any ticker against his rules.
   Everything comes from the locked copy: snap.v2 (the Mac's V2 state, signal_lab/v2.py), snap.universe (every scanned
   stock graded by the entry rules) and snap.answers (the bot's full checks on tickers asked from a phone).
   "Full view" still shows the Mac's own screens (ct.js + ct.css). */
const LS_ASKS = 'ctm.asks', LS_RECENT = 'ctm.recent';
const ui = { tab: 'today', sel: '', full: false, place: {} };
const HZL = { long: 'Long-term', medium: 'Medium-term', short: 'Short-term' };
const TONE = { ok: 't-ok', watch: 't-watch', act: 't-act' };

/* ---------- formatting ---------- */
function money(v, cents) {
  if (!isNum(v)) return '–';
  const a = Math.abs(v), c = cents === undefined ? a < 100 : cents;
  return (v < 0 ? MINUS : '') + '$' + a.toLocaleString('en-US', { minimumFractionDigits: c ? 2 : 0, maximumFractionDigits: c ? 2 : 0 });
}
const signed = (v, cents) => isNum(v) ? (v >= 0 ? '+' : MINUS) + money(Math.abs(v), cents) : '–';
function pct(v, d = 1, plus = true) {
  if (!isNum(v)) return '–';
  const s = (Math.abs(v) * 100).toFixed(d);
  return (v < 0 && +s !== 0 ? MINUS : v > 0 && plus && +s !== 0 ? '+' : '') + s + '%';
}
const price = v => isNum(v) ? '$' + v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '–';
const tone = v => isNum(v) ? (v > 0 ? 'pos' : v < 0 ? 'neg' : '') : '';
function fmtD(s, style) {
  if (!s) return '';
  const d = D(s);
  if (style === 'md') return `${MON[d.getMonth()]} ${d.getDate()}`;
  return `${DOW[d.getDay()]} ${MON[d.getMonth()]} ${d.getDate()}`;
}
const ago = t => { const m = Math.round((Date.now() - t) / 60e3); return m < 1 ? 'just now' : m < 60 ? `${m} min ago` : when(t); };

/* ---------- small pieces ---------- */
function toast(text, ms = 3200) {
  if (ui.full && window.CT) { CT.toast(text); return; }
  let el = $('#wtoast'); if (!el) return;
  el.textContent = text; el.hidden = false;
  clearTimeout(toast.t); toast.t = setTimeout(() => { el.hidden = true; }, ms);
}
function spark(vals, lines) {
  const v = (vals || []).filter(isNum);
  if (v.length < 2) return '';
  const w = 300, h = 40, up = v[v.length - 1] >= v[0], c = up ? 'var(--go)' : 'var(--stop)';
  let lo = Math.min(...v), hi = Math.max(...v);
  (lines || []).forEach(l => { if (isNum(l)) { lo = Math.min(lo, l); hi = Math.max(hi, l); } });
  const Y = x => (h - 3 - ((x - lo) / (hi - lo || 1)) * (h - 6)).toFixed(1);
  const d = v.map((x, i) => `${i ? 'L' : 'M'}${(i / (v.length - 1) * w).toFixed(1)},${Y(x)}`).join('');
  return `<svg class="sp" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none">${(lines || []).filter(isNum).map(l => `<line x1="0" x2="${w}" y1="${Y(l)}" y2="${Y(l)}" stroke="rgba(255,255,255,.3)" stroke-dasharray="3 4" vector-effect="non-scaling-stroke"/>`).join('')}`
    + `<path d="${d}" fill="none" stroke="${c}" stroke-width="1.7" vector-effect="non-scaling-stroke"/></svg>`;
}
const V2 = () => (state.snap && state.snap.v2) || {};
const positions = () => (V2().positions || []).filter(p => !p.error);
const posOf = t => positions().find(p => p.ticker === t);
function uni() {  // the universe as {ticker: row-object}, built once per copy
  const u = state.snap && state.snap.universe;
  if (!u || !u.rows) return null;
  if (uni.c && uni.c.src === u) return uni.c;
  const idx = {}, cols = u.cols;
  for (const r of u.rows) { const o = {}; cols.forEach((k, i) => { o[k] = r[i]; }); o.sector = u.sectors[o.sector] || ''; idx[o.t] = o; }
  uni.c = { src: u, idx, rules: u.rules || [], passing: u.passing, day: u.day };
  return uni.c;
}
const answerOf = t => (state.snap.answers || []).find(a => a.ticker === t);
const asks = () => readJSON(LS_ASKS) || {};

/* ---------- a chart you can read and zoom: drag to read a day, pinch to zoom, double-tap to see it all ---------- */
function wchart(el, cfg) {
  const n = cfg.v.length, minSpan = Math.min(n - 1, 4), st = { a: 0, b: n - 1, i: null, ptr: new Map(), pinch: null, down: null, tap: 0 };
  el.innerHTML = '<svg></svg><div class="tip" hidden></div><button class="zoom" type="button" data-act="w-zoomreset" hidden></button>';
  const svg = $('svg', el), tip = $('.tip', el), zb = $('.zoom', el), id = 'g' + Math.random().toString(36).slice(2, 7);
  let geo = null;
  const zoomed = () => st.a > 0.01 || st.b < n - 1.01;
  function paint() {
    const W = Math.max(120, el.clientWidth), H = cfg.h || 120, T = 8, B = 6, a = st.a, b = st.b;
    const i0 = Math.max(0, Math.floor(a)), i1 = Math.min(n - 1, Math.ceil(b)), X = i => (i - a) / (b - a || 1) * W;
    const all = [cfg.v].concat(cfg.v2 ? [cfg.v2] : []);
    let lo = Infinity, hi = -Infinity;
    all.forEach(s => { for (let i = i0; i <= i1; i++) if (isNum(s[i])) { lo = Math.min(lo, s[i]); hi = Math.max(hi, s[i]); } });
    if (!isFinite(lo)) return;
    const s0 = hi - lo || Math.abs(hi) * 0.02 || 1, near = l => !zoomed() || (l.v >= lo - s0 * 0.35 && l.v <= hi + s0 * 0.35);
    const lv = (cfg.lines || []).filter(l => isNum(l.v));
    lv.filter(near).forEach(l => { lo = Math.min(lo, l.v); hi = Math.max(hi, l.v); });
    const pad = (hi - lo) * 0.07 || 1, L0 = lo - pad, H0 = hi + pad, Y = v => T + (1 - (v - L0) / (H0 - L0)) * (H - T - B);
    const line = s => { let d = ''; for (let i = i0; i <= i1; i++) if (isNum(s[i])) d += (d ? 'L' : 'M') + X(i).toFixed(1) + ',' + Y(s[i]).toFixed(1); return d; };
    const up = cfg.v[n - 1] >= (isNum(cfg.base) ? cfg.base : cfg.v[0]), c = up ? 'var(--go)' : 'var(--stop)', d = line(cfg.v);
    let o = `<defs><linearGradient id="${id}" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="${c}" stop-opacity=".25"/><stop offset="1" stop-color="${c}" stop-opacity="0"/></linearGradient>`
      + `<clipPath id="${id}c"><rect x="0" y="0" width="${W}" height="${H}"/></clipPath></defs><g clip-path="url(#${id}c)">`;
    if (d) o += `<path d="${d}L${X(i1).toFixed(1)},${H}L${X(i0).toFixed(1)},${H}Z" fill="url(#${id})"/>`;
    if (cfg.v2) o += `<path d="${line(cfg.v2)}" fill="none" stroke="var(--dim)" stroke-width="1.3" stroke-dasharray="4 4"/>`;
    lv.filter(near).forEach(l => { o += `<line x1="0" x2="${W}" y1="${Y(l.v).toFixed(1)}" y2="${Y(l.v).toFixed(1)}" stroke="${l.c}" stroke-dasharray="3 4" opacity=".8"/>`
      + `<text class="lt" x="${W - 4}" y="${(Y(l.v) - 4).toFixed(1)}" text-anchor="end" fill="${l.c}">${esc(l.t)}</text>`; });
    o += `<path${geo ? '' : ' class="draw" pathLength="1"'} d="${d}" fill="none" stroke="${c}" stroke-width="1.8" stroke-linejoin="round"/></g>`;
    lv.filter(l => !near(l)).forEach((l, k) => { const above = l.v > hi; o += `<text class="lt" x="4" y="${above ? 12 + k * 12 : H - 6 - k * 12}" fill="${l.c}">${above ? '↑' : '↓'} ${esc(l.t)}</text>`; });
    o += `<g class="xh" style="display:none"><line y1="0" y2="${H}"/><circle r="4" fill="${c}"/>${cfg.v2 ? '<circle r="3.5" fill="var(--dim)"/>' : ''}</g>`;
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`); svg.setAttribute('height', H); svg.innerHTML = o;
    geo = { W, X, Y };
    zb.hidden = !zoomed();
    if (zoomed()) zb.innerHTML = `<span>${cfg.range ? cfg.range(Math.round(st.a), Math.round(st.b)) : 'Zoomed in'}</span><b>Show all</b>`;
    if (st.i != null) show(st.i);
  }
  function show(f) {
    if (!geo || !isFinite(f)) return;
    const i = Math.max(Math.ceil(st.a - 0.001), Math.min(Math.floor(st.b + 0.001), Math.round(f))), g = $('.xh', svg), x = geo.X(i);
    st.i = i; g.style.display = '';
    const ln = $('line', g); ln.setAttribute('x1', x); ln.setAttribute('x2', x);
    const cs = $$('circle', g), vals = [cfg.v[i], cfg.v2 ? cfg.v2[i] : null];
    cs.forEach((cn, k) => { const v = vals[k]; cn.style.display = isNum(v) ? '' : 'none'; if (isNum(v)) { cn.setAttribute('cx', x); cn.setAttribute('cy', geo.Y(v)); } });
    tip.innerHTML = cfg.tip(i, Math.round(st.a)); tip.hidden = false;
    const tw = tip.offsetWidth;
    tip.style.left = Math.max(0, Math.min(geo.W - tw, x < geo.W / 2 ? x + 14 : x - tw - 14)) + 'px';
  }
  function hide() { st.i = null; const g = $('.xh', svg); if (g) g.style.display = 'none'; tip.hidden = true; }
  function setWin(a, span) { span = Math.max(minSpan, Math.min(n - 1, span)); st.a = Math.max(0, Math.min(n - 1 - span, a)); st.b = st.a + span; paint(); }
  el._reset = () => { st.a = 0; st.b = n - 1; paint(); };
  const at = x => { const r = el.getBoundingClientRect(); return r.width ? st.a + Math.min(1, Math.max(0, (x - r.left) / r.width)) * (st.b - st.a) : NaN; };
  const two = () => { const [p, q] = [...st.ptr.values()]; return { d: Math.max(24, Math.hypot(p.x - q.x, p.y - q.y)), cx: (p.x + q.x) / 2 }; };
  el.addEventListener('pointerdown', e => {
    if (e.target.closest('.zoom')) return;
    st.ptr.set(e.pointerId, { x: e.clientX, y: e.clientY });
    try { el.setPointerCapture(e.pointerId); } catch (err) { /* older Safari */ }
    if (st.ptr.size === 2) { const t = two(), r = el.getBoundingClientRect(); st.pinch = r.width ? { d: t.d, span: st.b - st.a, c: at(t.cx), w: r.width, left: r.left } : null; hide(); }
    else if (st.ptr.size === 1) { st.down = { x: e.clientX, y: e.clientY, t: Date.now(), moved: false }; show(at(e.clientX)); }
  });
  el.addEventListener('pointermove', e => {
    if (!st.ptr.has(e.pointerId)) { if (e.pointerType === 'mouse' && !st.ptr.size) show(at(e.clientX)); return; }
    st.ptr.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (st.ptr.size >= 2 && st.pinch) { const P = st.pinch, t = two(), span = Math.max(minSpan, Math.min(n - 1, P.span * P.d / t.d)); setWin(P.c - ((t.cx - P.left) / P.w) * span, span); }
    else if (st.ptr.size === 1) { if (st.down && Math.hypot(e.clientX - st.down.x, e.clientY - st.down.y) > 6) st.down.moved = true; show(at(e.clientX)); }
  });
  const end = e => {
    const had = st.ptr.delete(e.pointerId);
    if (st.ptr.size < 2) st.pinch = null;
    if (e.type === 'pointercancel') { hide(); return; }
    if (!had || st.ptr.size || e.pointerType === 'mouse') return;
    const now = Date.now(), tapped = st.down && !st.down.moved && now - st.down.t < 300;
    if (tapped && now - st.tap < 350) { st.tap = 0; el._reset(); } else if (tapped) st.tap = now;
    hide();
  };
  el.addEventListener('pointerup', end);
  el.addEventListener('pointercancel', end);
  el.addEventListener('pointerleave', e => { if (e.pointerType === 'mouse' && !st.ptr.size) hide(); });
  el.addEventListener('dblclick', e => { e.preventDefault(); el._reset(); });
  ['gesturestart', 'gesturechange'].forEach(t => el.addEventListener(t, e => e.preventDefault()));
  if (window.ResizeObserver) { let w = 0; const ro = new ResizeObserver(() => { if (!el.isConnected) { ro.disconnect(); return; } if (el.clientWidth !== w) { w = el.clientWidth; paint(); } }); ro.observe(el); }
  paint();
}
const charts = [];
const chartBox = (cfg, h) => { charts.push(cfg); return `<div class="wch" data-ch="${charts.length - 1}" style="min-height:${h || cfg.h || 120}px"></div>`; };
function mountCharts(root) { $$('.wch[data-ch]', root).forEach(el => { const cfg = charts[+el.dataset.ch]; if (cfg && !el._done) { el._done = 1; wchart(el, cfg); } }); }
const span2 = (d1, d2) => { const a = D(d1), b = D(d2);
  return a.getMonth() === b.getMonth() ? `${MON[a.getMonth()]} ${a.getDate()}–${b.getDate()}` : `${MON[a.getMonth()]} ${a.getDate()} – ${MON[b.getMonth()]} ${b.getDate()}`; };
const HINT = '<p class="hint">Drag across it to read each day · pinch to zoom in · double-tap to see it all</p>';
function priceChart(sp, sd, lines, paid) {
  const v = (sp || []).filter(isNum);
  if (v.length < 2) return '';
  const dated = (sd || []).length === v.length, day = i => dated ? fmtD(sd[i]) : `${v.length - 1 - i} trading days ago`;
  return chartBox({ v, h: 170, base: paid, lines,
    tip: (i, a) => `<div class="d">${esc(day(i))}</div><b>${price(v[i])}</b><div class="s">`
      + (isNum(paid) ? `<span class="${tone(v[i] - paid)}">${pct(v[i] / paid - 1)}</span> vs what you paid` : i > a ? `<span class="${tone(v[i] - v[a])}">${pct(v[i] / v[a] - 1)}</span> in the days shown` : '') + '</div>',
    range: (x, y) => `${dated ? span2(sd[x], sd[y]) : ''} · <span class="${tone(v[y] - v[x])}">${pct(v[y] / v[x] - 1)}</span>` }) + HINT;
}

/* ---------- the shell ---------- */
const ICON = {
  today: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3"/></svg>',
  brain: '<svg viewBox="0 0 24 24"><path d="M9 4a3 3 0 0 0-3 3 3 3 0 0 0-2 5 3 3 0 0 0 2 5 3 3 0 0 0 6 1V6a2 2 0 0 0-3-2zM15 4a3 3 0 0 1 3 3 3 3 0 0 1 2 5 3 3 0 0 1-2 5 3 3 0 0 1-6 1"/></svg>',
  pos: '<svg viewBox="0 0 24 24"><path d="M4 19V9M10 19V5M16 19v-7M22 19H2"/></svg>',
  firm: '<svg viewBox="0 0 24 24"><circle cx="12" cy="5" r="2.4"/><circle cx="5" cy="18" r="2.4"/><circle cx="12" cy="18" r="2.4"/><circle cx="19" cy="18" r="2.4"/><path d="M12 7.5v8M12 11H5v4.5M12 11h7v4.5"/></svg>',
  check: '<svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></svg>',
  more: '<svg viewBox="0 0 24 24"><circle cx="5" cy="12" r="1.3"/><circle cx="12" cy="12" r="1.3"/><circle cx="19" cy="12" r="1.3"/></svg>',
};
function shell() {
  return `<div class="w" id="w"><header class="w-top"><button class="w-brand" data-act="w-tab" data-t="today"><span class="orb" id="worb"></span>Claude Finance${verTag()}</button>
    <button class="w-fresh" id="fresh" data-act="check" aria-label="When the Mac last checked. Tap to look for a newer copy"></button></header>
    <div class="w-view" id="wv"></div>
    <nav class="w-tabs">${[['today', 'Today'], ['pos', 'Portfolio'], ['firm', 'Firm'], ['check', 'Check'], ['more', 'More']].map(([k, l]) =>
      `<button data-act="w-tab" data-t="${k}">${ICON[k]}${l}${k === 'today' ? '<b class="badge" id="wbadge" hidden></b>' : ''}</button>`).join('')}</nav></div>
  <div id="wlayer"></div><div class="w-toast" id="wtoast" hidden></div><div id="full" hidden></div>`;
}
function draw(keepScroll) {
  const wv = $('#wv'); if (!wv) return;
  charts.length = 0;
  wv.innerHTML = ui.tab === 'check' ? viewCheck() : ui.tab === 'more' ? viewMore() : ui.tab === 'brain' ? viewBrain() : ui.tab === 'firm' ? viewFirm() : ui.tab === 'pos' ? viewPortfolio() : viewToday();
  $$('.w-tabs button').forEach(b => b.classList.toggle('on', b.dataset.t === ui.tab));
  const n = (V2().orders || []).length, bd = $('#wbadge');
  if (bd) { bd.hidden = !n; bd.textContent = n; }
  const orb = $('#worb'); if (orb) orb.classList.toggle('alert', (V2().orders || []).some(o => (o.urgency ?? 3) <= 0));
  mountCharts(wv);
  if (ui.tab === 'firm' && window.CT && CT.firm) CT.firm.mount(wv, V2(), { phone: true, toast });
  if (ui.tab === 'more') pushCheck();
  if (!keepScroll) window.scrollTo(0, 0);
  renderTop();
}
function go(tab, t) {
  ui.tab = tab;
  if (tab === 'check' && t) { ui.sel = t; remember(t); }
  history.replaceState(null, '', '#' + (tab === 'check' && ui.sel ? 'check/' + ui.sel : tab));
  draw();
}

/* ---------- Positions ---------- */
const splitSentences = t => {  // ends a sentence only at . ! ? followed by a space and a capital, digit or quote ("$14.21" and "U.S. stocks" stay whole)
  const s = String(t || '').trim(), out = []; let start = 0;
  for (let i = 0; i < s.length; i++) {
    if (!'.!?'.includes(s[i]) || (i + 1 < s.length && !/\s/.test(s[i + 1]))) continue;
    let j = i + 1; while (j < s.length && /\s/.test(s[j])) j++;
    if (j < s.length && !/[A-Z0-9"“'(\$]/.test(s[j])) continue;
    if (/\b(?:vs|e\.g|i\.e|Mr|Mrs|Dr|St|Inc|Co|U\.S)\.$/.test(s.slice(Math.max(0, i - 5), i + 1))) continue;
    out.push(s.slice(start, i + 1).trim()); start = j; i = j - 1;
  }
  if (start < s.length) out.push(s.slice(start).trim());
  return out.filter(Boolean);
};
const fold2 = (t, label) => { const m = splitSentences(t);
  const a = m.slice(0, 2).join(' '), b = m.slice(2).join(' ');
  return `<p>${esc(a)}</p>${b ? `<details class="fold3"><summary>${esc(label || 'More')}</summary><p>${esc(b)}</p></details>` : ''}`; };
function sparkFor(t) {
  const v = V2(), has = x => (x || []).filter(isNum).length > 5;
  const p = (v.positions || []).find(x => x.ticker === t); if (p && has(p.spark)) return p.spark;
  const r = (v.radar || []).find(x => x.ticker === t); if (r && has(r.spark)) return r.spark;
  if (has((v.sparks || {})[t])) return v.sparks[t];
  return null;
}
function viewPositions() {
  const v = V2(), a = v.account || {}, ps = positions().slice(), orders = v.orders || [];
  const order = { act: 0, watch: 1, ok: 2 };
  ps.sort((x, y) => (order[x.tone] ?? 3) - (order[y.tone] ?? 3) || (y.value || 0) - (x.value || 0));
  const pts = a.points || [];
  let dep = 0;
  const me = [], spy = [];
  pts.forEach((p, i) => { if (i) dep += p[3] || 0; me.push(p[1] - (pts[0][1] || 0) - dep); spy.push((p[2] || 0) - (pts[0][2] || pts[0][1] || 0) - dep); });
  const acct = `<section class="card acct"><small>Your account</small>
    <div class="big"><b>${money(a.total, true)}</b><span class="${tone(a.day)}">${isNum(a.day) ? signed(a.day, true) + ' (' + pct(a.day_pct, 2) + ') today' : ''}</span></div>
    <div class="vs"><span>Since ${esc(fmtD(a.since, 'md'))}: <b class="${tone(a.ret)}">${pct(a.ret)}</b></span><span>S&amp;P <b class="${tone(a.spy_ret)}">${pct(a.spy_ret)}</b></span><span>Cash <b>${money(a.cash)}</b></span></div>
    ${me.length > 1 ? chartBox({ v: me, v2: spy, h: 110, base: 0,
      tip: i => `<div class="d">${esc(fmtD(pts[i][0]))}</div><b>${money(pts[i][1], true)}</b><div class="s"><span class="${tone(me[i])}">You ${signed(me[i], true)}</span> · S&amp;P ${signed(spy[i], true)}</div>`,
      range: (x, y) => `${span2(pts[x][0], pts[y][0])} · <span class="${tone(me[y] - me[x])}">you ${signed(me[y] - me[x])}</span> · S&amp;P ${signed(spy[y] - spy[x])}` }) + '<p class="hint">Solid line: you · dashed: the same money in the S&amp;P 500. Drag to read a day, pinch to zoom.</p>' : ''}</section>`;
  const todo = orders.length ? `<div class="w-h"><h2>${orders.length === 1 ? '1 thing to do' : orders.length + ' things to do'}</h2><span>from the Firm</span></div>`
    + orders.map((o, k) => { const c = { sell: 'var(--stop)', buy: 'var(--go)', stop: 'var(--warn)' }[o.kind] || 'var(--violet)';
      const pl = window.CT && CT.place ? CT.place.label(o, v) : '';  // v1.2: step-by-step directions for the owner's broker
      return `<article class="card todo" style="--c:${c}"><span class="strip"></span><div class="in"><div class="top"><h3>${esc(o.title)}</h3><span class="when">${esc(o.when || '')}</span></div>
        ${(o.orders || []).length ? `<div class="ord">${o.orders.map(x => `<div>› ${esc(typeof x === 'string' ? x : x.ticker || '')}</div>`).join('')}</div>` : ''}

        ${o.risk ? `<div class="risk3"><b>⚠ Risk</b> ${esc(o.risk)}</div>` : ''}${sparkFor(o.ticker) ? `<div class="tk3">${spark(sparkFor(o.ticker))}<small>${esc(o.ticker)} · last few months</small></div>` : ''}${fold2(o.why, 'Why, in full')}${(o.steps || []).length ? `<ol>${o.steps.map(s => `<li>${esc(s)}</li>`).join('')}</ol>` : ''}
        ${pl ? `<button class="btn go w-place" data-act="w-place" data-i="${k}" aria-expanded="${!!ui.place[o.id]}">${esc(pl)}: show me how</button><div class="placebox" data-i="${k}">${ui.place[o.id] ? CT.place.box(o, k, v) : ''}</div>` : ''}</div></article>`; }).join('')
    : '';
  const list = ps.length ? `<div class="plist">${ps.map(posRow).join('')}</div>` : '<div class="card empty">Nothing owned yet.</div>';
  const B = v.analyst || {};
  const brief = B.at ? `<section class="card brief3"><small><span class="aib">Firm</span> ${esc(B.label || 'Briefing')} · ${esc(when(B.at))}</small>
      <h2>${esc(B.headline || '')}</h2>${v.bot && v.bot.since ? `<p class="upd"><b>Since then, from your answers</b><span>${esc(v.bot.since)}</span></p>` : ''}${(B.updates || []).slice(-2).map(u => `<p class="upd"><b>Operations desk · ${esc(when(u.at))}</b>${(u.changes || []).map(c => `<span>${esc(c)}</span>`).join('')}</p>`).join('')}${fold2(B.summary, 'Read the PM’s full note')}${B.market ? `<details class="fold3"><summary>The market today</summary><p class="dim">${esc(B.market)}</p></details>` : ''}
      ${B.error ? `<p class="warn">${esc(B.error)}</p>` : ''}${B.score_n ? `<p class="dim">${esc(B.score)}</p>` : ''}</section>`
    : B.running ? '<section class="card brief3"><small><span class="aib">Firm</span> writing the briefing…</small></section>' : '';
  const mo = (v.motion || []).filter(m => !m.done).slice(0, 4);
  const motion = mo.length ? `<div class="w-h"><h2>On the way</h2><span>orders and money moving</span></div>` + mo.map(m => {
    const n = (m.stages || []).length, at = m.at || 0;
    return `<div class="card mo"><b>${esc(m.title)}</b><div class="now">${esc(m.now || '')}</div><div class="steps">${(m.stages || []).map((s, k) =>
      `<span class="st ${k < at ? 'done' : k === at ? 'now' : ''}"><i></i>${esc(s)}</span>${k < n - 1 ? `<span class="ln ${k < at ? 'done' : ''}"></span>` : ''}`).join('')}</div></div>`; }).join('') : '';
  const sch = (v.schedule || []).slice(0, 5);
  const coming = sch.length ? `<div class="w-h"><h2>Coming up</h2></div><ol class="card sched">${sch.map(x => `<li><time>${esc(fmtD(x.date))}</time><div><b>${esc(x.what)}</b><span>${esc(x.then || '')}</span></div></li>`).join('')}</ol>` : '';
  const QA = state.snap.claude_answers || [], waitQ = readJSON('ctm.q');
  const askc = `<div class="w-h"><h2>Ask the Firm</h2><span>the PM knows your whole account</span></div><section class="card askc">
    <textarea id="cq" rows="2" aria-label="Ask the Firm a question" placeholder="Like “should I sell PLTR?”"></textarea><button class="btn go" data-act="w-q">Ask</button>
    ${waitQ && !QA.some(x => x.question === waitQ.q) ? `<p class="wait"><i></i><span>Asked ${esc(ago(waitQ.at))}. The firm answers from the Mac in a few minutes while Claude Finance is open there.</span></p>` : ''}
    ${QA.slice(0, 3).map(x => `<div class="qa"><b>${esc(x.question || '')}</b><p>${esc(x.answer || '')}</p>${x.action ? `<p class="go">${esc(x.action)}</p>` : ''}<small>${esc(when(x.at))}</small></div>`).join('')}</section>`;
  if (ui.tab === 'pos') return `${acct}${window.CT && CT.freshLine ? CT.freshLine(v, { phone: true }) : ''}<div class="w-h"><h2>Your positions</h2><span>${ps.length} · ${money(a.invested)} · the PM's call on each</span></div>${list}${motion}`;
  const gist = window.CT && CT.firm && CT.firm.gist ? CT.firm.gist(v, true) : '';  // v5.4: the firm's latest meeting in two highlighted lines
  return `${brief}${gist ? `<div class="w-gist" data-act="w-tab" data-t="firm" role="button" tabindex="0" aria-label="The gist of the firm's latest meeting. Open the Firm tab">${gist}</div>` : ''}${todo || '<div class="card empty" style="margin-top:12px">Nothing to do right now. The firm checks again at the next scan.</div>'}${askc}${coming}
    <p class="w-foot">${OWNER() ? `<b>${esc(OWNER())}’s Claude Finance.</b> ` : ''}The Firm works on ${esc(MAC())} around the clock. It never trades: you place every order.</p>`;
}
const viewToday = () => viewPositions(), viewPortfolio = () => viewPositions();
function viewFirm() {  // v5: the Firm (CT.firm from ct.js: the org chart, the board, scenario cards, predictions, the record)
  if (window.CT && CT.firm) return CT.firm.view(V2(), { phone: true });
  return '<div class="card empty" style="margin-top:12px">Open the Mac app once to load the Firm.</div>';
}
function viewBrain() {
  if (window.CT && CT.brain) return CT.brain.view(V2(), { phone: true });
  const B = V2().analyst || {}, rv = B.review, L = B.lessons || [], St = B.strategies || [];
  const pc = v => isNum(v) ? pct(v) : '–';
  return `<div class="w-h"><h2>The firm's brain</h2><span>it grades itself and learns every week</span></div>
    <section class="card brief3"><small><span class="aib">Firm</span> Weekly review${rv ? ' · ' + esc(when(rv.at)) : ''}</small>
      <p>${esc(rv ? rv.summary : 'Every Friday after the close the firm grades its calls, rewrites its playbook and tests new strategies.')}</p>${rv && rv.follow ? `<p>${esc(rv.follow)}</p>` : ''}
      ${B.score ? `<p class="dim">${esc(B.score)}</p>` : ''}</section>
    ${L.length ? `<div class="w-h"><h2>Playbook</h2><span>the lessons it follows</span></div><ol class="card lessons3">${L.map(x => `<li><b>${esc(x.text)}</b><span>${esc(x.why || '')}</span></li>`).join('')}</ol>` : ''}
    <div class="w-h"><h2>Strategy Lab</h2><span>tested on ~9 years of prices</span></div>
    ${St.map(x => `<section class="card strat3 st-${esc(x.status)}"><div class="top"><b>${esc(x.name)}</b><span class="tag ${x.status === 'active' ? 't-ok' : 't-mut'}">${esc(x.status === 'active' ? 'Active' : x.status === 'testing' ? 'Testing' : 'Retired')}</span></div>
      <p>${esc(x.idea || '')}</p><p class="dim">${esc(x.verdict_why || '')}</p>
      <div class="n3"><span>vs S&amp;P <b>${pc(x.avg_vs_spy)}</b></span><span>recent <b>${pc(x.recent_vs_spy)}</b></span><span>vs random <b>${pc(x.edge_vs_random)}</b></span></div>
      ${(x.picks || []).length ? `<p class="dim">Would buy today: ${x.picks.map(p => esc(p.ticker)).join(', ')}</p>` : ''}</section>`).join('')}
    ${(B.about_sam || []).length ? `<div class="w-h"><h2>What the firm knows about you</h2></div><ul class="card lessons3">${B.about_sam.map(x => `<li>${esc(x)}</li>`).join('')}</ul>` : ''}`;
}
function posRow(p) {
  const nx = (p.ifs || [])[0];
  const so = (V2().orders || []).find(x => x.kind === 'stop' && x.ticker === p.ticker), sm = so && String(so.title || '').match(/at \$([\d,.]+)/);  // v7.1: a new stop not at Schwab yet
  const pend = sm ? `<div class="pend3">⚠ New stop ${price(+sm[1].replace(/,/g, ''))} isn’t at Schwab yet: it’s waiting on Today.</div>` : '';
  return `<button class="card prow" data-act="w-pos" data-t="${esc(p.ticker)}">
    <div class="l1"><span class="tk">${esc(p.ticker)}</span><span class="tag ${TONE[p.tone] || 't-mut'}">${esc(p.state || 'On plan')}</span>
      <span class="px">${price(p.price)}<small class="${tone(p.day)}">${pct(p.day, 2)} today</small></span></div>
    <div class="nm">${esc(p.name || '')}${HZL[p.mode] ? ' · ' + HZL[p.mode] : ''}</div>
    ${spark(p.spark, [p.buy_price])}
    <div class="l2"><span>${sh(p.shares)} sh · ${money(p.value)}</span><span class="g ${tone(p.gain_usd)}">${signed(p.gain_usd)} (${pct(p.gain)})</span></div>
    ${pend}${nx ? `<div class="nx"><b>${esc(nx[0])}</b><span>→ ${esc(nx[1])}</span></div>` : ''}${window.CT && CT.firm && CT.firm.team ? `<div class="team3">${CT.firm.team(V2(), p.ticker)}</div>` : ''}</button>`;
}
const sh = v => isNum(+v) ? (+(+v).toFixed(4)).toLocaleString('en-US') : '–';
function openPos(t) {
  const p = posOf(t); if (!p) { go('check', t); return; }
  const n = (V2().notes || {})[t] || {};
  const lines = [{ v: p.buy_price, c: 'rgba(255,255,255,.55)', t: 'Paid ' + price(p.buy_price) }];
  if (p.range) { lines.push({ v: p.range.lo, c: 'var(--stop)', t: `${p.range.lo_label} ${price(p.range.lo)}` }); if (p.range.hi_label) lines.push({ v: p.range.hi, c: 'var(--go)', t: `${p.range.hi_label} ${price(p.range.hi)}` }); }
  charts.length = 0;
  const body = `<div class="sh"><div><h2>${esc(t)}</h2><div class="dim" style="font-size:13px;margin-top:4px">${esc(p.name || '')}</div>
      <div style="display:flex;gap:6px;margin-top:8px;flex-wrap:wrap"><span class="tag ${TONE[p.tone] || 't-mut'}">${esc(p.state || '')}</span>${HZL[p.mode] ? `<span class="tag hz-${esc(p.mode)}">${HZL[p.mode]}</span>` : ''}</div></div>
      <button class="x" data-act="w-close" aria-label="Close">✕</button></div>
    <div class="res" style="padding:0;animation:none"><div class="hd"><div style="font:650 24px var(--mono)">${price(p.price)}<small class="${tone(p.day)}" style="display:block;font:500 12.5px var(--mono)">${pct(p.day, 2)} today</small></div>
      <div class="px"><span class="${tone(p.gain_usd)}">${signed(p.gain_usd)}</span><small class="${tone(p.gain)}">${pct(p.gain)} since you bought</small></div></div></div>
    ${priceChart(p.spark, p.spark_d, lines, p.buy_price)}
    ${p.range ? `<div class="rng"><div class="bar3"><span class="b" style="left:${(p.range.buy * 100).toFixed(1)}%"></span><span class="p" style="left:${(p.range.at * 100).toFixed(1)}%"></span></div>
      <div class="ends"><span class="neg">${esc(p.range.lo_label)} ${price(p.range.lo)}</span><span class="pos">${p.range.hi_label ? esc(p.range.hi_label) + ' ' + price(p.range.hi) : ''}</span></div></div>` : ''}
    <div class="nums">${[['Shares', sh(p.shares)], ['Paid', price(p.buy_price)], ['Worth', money(p.value)], ['Held', isNum(p.days) ? p.days + ' days' : '–'], ['Health', isNum(p.health) ? p.health + '/100' : '–']].map(([k, v]) => `<div><small>${k}</small><b>${esc(v)}</b></div>`).join('')}</div>
    ${(p.ifs || []).length ? `<div class="sec2"><h3>What happens next</h3><ul class="ifs">${p.ifs.map(x => `<li class="${esc(x[2] || '')}"><b>${esc(x[0])}</b> → ${esc(x[1])}</li>`).join('')}</ul></div>` : ''}
    ${p.by === 'claude' && p.call ? `<div class="sec2"><h3><span class="aib">Firm</span> ${esc(p.verdict || p.state || '')}</h3><p style="margin:6px 0 0;line-height:1.5">${esc(p.call)}</p></div>` : ''}
    ${aiBlock(n.ai)}${noteBlock(n)}
    <p class="legal">What the firm and the app say about it, not advice.</p>`;
  openSheet(body);
  history.replaceState(null, '', '#pos/' + encodeURIComponent(t));
}
function aiBlock(a) {
  if (!a || !a.summary) return '';
  const w = String(a.verdict || '').toLowerCase(), word = { buy: 'Buy', keep: 'Keep it', hold: 'Keep it', wait: 'Wait', sell: 'Sell', avoid: 'Avoid' }[w] || a.verdict || '';
  const an = a.analysts || {}, list = (xs, cls) => (xs || []).slice(0, 3).map(x => `<li${cls ? ` class="${cls}"` : ''}>${esc(x)}</li>`).join('');
  const news = (a.news || []).slice(0, 3).filter(x => x && x.headline);
  return `<div class="sec2"><h3>The research desk${word ? ' · ' + esc(word) : ''}</h3><p>${esc(a.summary)}</p>
    ${(a.bull || []).length || (a.bear || []).length ? `<ul class="bb" style="margin-top:8px">${list(a.bull)}${list(a.bear, 'bear')}</ul>` : ''}
    ${an.count ? `<p class="w-sub">Analysts: ${an.buy || 0} buy, ${an.hold || 0} hold, ${an.sell || 0} sell${isNum(an.target_avg) ? ` · average target ${price(an.target_avg)}` : ''}</p>` : ''}
    ${news.length ? `<ul class="bb">${news.map(x => `<li class="nw">${x.date ? `<b>${esc(fmtD(x.date))}</b> ` : ''}${esc(x.headline)}</li>`).join('')}</ul>` : ''}
    ${a.at ? `<p class="w-sub">The research desk checked it ${esc(ago(Date.parse(a.at)))}.</p>` : ''}</div>`;
}
function noteBlock(n, skipHead) {
  if (!n || !(n.thesis || n.headline || (n.bull || []).length)) return '';
  const conv = '';  // v5: no confidence numbers for Sam
  return `<div class="sec2"><h3>The bot's note</h3>${skipHead ? '' : `<p style="margin-bottom:6px"><b>${esc(n.headline || n.verdict || '')}</b></p>`}${conv ? `<div style="margin:2px 0 8px">${conv}</div>` : ''}
    ${n.thesis ? `<p>${esc(n.thesis)}</p>` : ''}</div>
    ${(n.bull || []).length || (n.bear || []).length ? `<div class="sec2"><h3>For and against</h3><ul class="bb">${(n.bull || []).map(x => `<li>${esc(x)}</li>`).join('')}${(n.bear || []).map(x => `<li class="bear">${esc(x)}</li>`).join('')}</ul></div>` : ''}
    ${(n.plan || []).length ? `<div class="sec2"><h3>The plan</h3><ul class="bb">${n.plan.map(x => `<li class="plan">${esc(x)}</li>`).join('')}</ul></div>` : ''}
    ${(n.risks || []).length ? `<div class="sec2"><h3>Risks</h3><ul class="bb">${n.risks.map(x => `<li class="bear">${esc(x)}</li>`).join('')}</ul></div>` : ''}`;
}

/* ---------- Check a stock ---------- */
function remember(t) { const r = (readJSON(LS_RECENT) || []).filter(x => x !== t); r.unshift(t); writeJSON(LS_RECENT, r.slice(0, 8)); }
const isBuy = x => x.verdict === 'Buy' || x.when === 'now' || x.when === 'next';
function viewCheck() {
  const sel = ui.sel, U = uni(), R = (V2().radar || []).filter(x => x.verdict || x.when), gate = (V2().bot || {}).gate;
  const buys = R.filter(isBuy), radar = (buys.length ? buys : R.filter(x => isNum(x.confidence)).sort((a, b) => b.confidence - a.confidence)).slice(0, 6);
  const recent = (readJSON(LS_RECENT) || []).filter(t => t !== sel).slice(0, 6);
  return `<div class="search"><input id="q" type="search" aria-label="Search any stock" placeholder="Search: NVDA, Apple, Costco…" value="${esc(sel)}" autocapitalize="characters" autocorrect="off" spellcheck="false" autocomplete="off" enterkeyhint="search">
      <button class="btn go" data-act="w-go">Check</button></div><div id="sugg" class="card sugg" hidden></div>
    <div id="res">${sel ? result(sel) : `<p class="w-sub" style="margin-top:6px">Any stock the Mac scans (${U ? U.idx && Object.keys(U.idx).length.toLocaleString() : 'about 1,500'}) answers right away, from the last scan. For anything else, or the bot's full write-up, ask the bot.</p>`}</div>
    ${radar.length ? `<div class="w-h"><h2>${buys.length ? 'The bot\'s picks' : 'Closest to a buy'}</h2><span>${buys.length ? 'tap one' : 'none is a buy today'}</span></div><div class="chips">${radar.map(x => `<button class="chip" data-act="w-pick" data-t="${esc(x.ticker)}">${esc(x.ticker)} <small>${esc(isBuy(x) ? (x.when === 'now' ? 'in your orders' : 'buy') : x.confidence + '% sure')}</small></button>`).join('')}</div>` : ''}
    ${recent.length ? `<div class="w-h"><h2>Recent</h2></div><div class="chips">${recent.map(t => `<button class="chip" data-act="w-pick" data-t="${esc(t)}">${esc(t)}</button>`).join('')}</div>` : ''}
    <p class="legal">Shows what this copy's own rules and its Firm say about a stock. It isn't advice, and nothing here can buy or sell.</p>`;
}
function suggest(q) {
  const box = $('#sugg'); if (!box) return;
  q = q.trim().toUpperCase();
  if (!q) { box.hidden = true; return; }
  const U = uni(), out = [], seen = new Set(), add = (t, nm, note) => { if (!seen.has(t) && out.length < 7) { seen.add(t); out.push([t, nm, note]); } };
  positions().forEach(p => { if (p.ticker.startsWith(q)) add(p.ticker, p.name, 'you own it'); });
  if (U) {
    const rows = Object.values(U.idx), ql = q.toLowerCase();
    rows.filter(r => r.t === q).forEach(r => add(r.t, r.name));
    rows.filter(r => r.t.startsWith(q)).sort((a, b) => (b.dvol_m || 0) - (a.dvol_m || 0)).forEach(r => add(r.t, r.name));  // most traded first
    if (q.length >= 3) rows.filter(r => (r.name || '').toLowerCase().includes(ql)).forEach(r => add(r.t, r.name));
  }
  if (/^[A-Z][A-Z0-9.\-]{0,9}$/.test(q) && !seen.has(q)) out.push([q, 'Ask the bot about it', '']);
  box.innerHTML = out.map(([t, nm, note]) => `<button data-act="w-pick" data-t="${esc(t)}"><b>${esc(t)}</b><span>${esc(nm || '')}</span>${note ? `<span class="tag t-ok" style="flex:none">${esc(note)}</span>` : ''}</button>`).join('');
  box.hidden = !out.length;
}
function rulesList(row, U, note) {
  if (note && (note.checks || []).length) return note.checks.map(c => `<li class="${c[0] ? 'ok' : 'no'}"><i>${c[0] ? '✓' : '✗'}</i><span>${esc(c[1])}<small>${esc(c[2] || '')}</small></span></li>`).join('');
  const act = [price(row.price), isNum(row.dvol_m) ? '$' + Math.round(row.dvol_m).toLocaleString() + 'M a day' : '',
    `${pct(row.vs50, 0)} vs its 50-day · ${pct(row.vs200, 0)} vs its 200-day`, '', isNum(row.strength) ? `beats ${pct(row.strength, 0, false)} of stocks` : 'not ranked'];
  return (U.rules || []).map((r, i) => { const ok = (row.checks >> i) & 1; return `<li class="${ok ? 'ok' : 'no'}"><i>${ok ? '✓' : '✗'}</i><span>${esc(r)}${act[i] ? `<small>${esc(act[i])}</small>` : ''}</span></li>`; }).join('');
}
function result(t) {
  const U = uni(), row = U && U.idx[t], p = posOf(t), note = answerOf(t), bot = (V2().notes || {})[t], rd = (V2().radar || []).find(x => x.ticker === t);
  const name = (p && p.name) || (row && row.name) || (note && note.name) || (bot && bot.name) || '';
  const px = p ? p.price : row ? row.price : note ? note.price : null, day = p ? p.day : row ? row.day : note ? note.day : null;
  const allPass = row && (row.checks & 31) === 31, fails = row ? (U.rules || []).filter((_, i) => !((row.checks >> i) & 1)) : [];
  let v;
  if (p) v = ['v-go', `You own it: ${p.state || 'on plan'}`, `${sh(p.shares)} shares · ${signed(p.gain_usd)} (${pct(p.gain)}) since you bought. ${(p.ifs || [])[0] ? (p.ifs[0][0] + ' → ' + p.ifs[0][1]) : ''}`];
  else if (rd && isBuy(rd)) v = ['v-go', rd.when === 'now' ? 'The bot is buying it: it\'s in your orders' : 'The bot would buy it next', rd.call || rd.headline || ''];
  else if (rd && rd.verdict) v = ['v-warn', 'The bot says not now', rd.call || rd.why_not || ''];
  else if (note && !note.error && note.passes) v = ['v-go', 'Passes every entry rule', note.headline || ''];
  else if (row && allPass) v = ['v-go', 'Passes every entry rule', row.rank ? `#${row.rank} strongest of the ${U.passing} stocks that pass today${row.rank <= 5 ? ': a top pick' : ''}.` : ''];
  else if (row) v = [fails.length > 2 ? 'v-stop' : 'v-warn', 'Not a buy under your rules today', `Misses ${fails.length} of ${(U.rules || []).length}: ${fails.map(f => f.split(':')[0].toLowerCase()).join(', ')}.`];
  else if (note && note.error) v = ['v-mut', 'The bot couldn’t check it', note.error];
  else if (note) v = ['v-warn', note.verdict === 'Pass' ? 'Not a buy under your rules today' : (note.verdict || 'Checked'), note.headline || ''];
  else v = ['v-mut', 'Not one of the stocks the Mac scans', 'Ask the bot below: it can check any ticker.'];
  const nums = row ? [['1 month', pct(row.r1m, 0)], ['3 months', pct(row.r3m, 0)], ['1 year', pct(row.r12, 0)], ['vs 50-day', pct(row.vs50, 0)], ['Off the high', isNum(row.off_high) ? MINUS + pct(row.off_high, 0, false) : '–'], ['Swings', isNum(row.vol) ? '±' + pct(row.vol, 0, false) + '/yr' : '–']] : [];
  const a = asks()[t], fresh = note && note.at && Date.parse(note.at) > Date.now() - 6 * 36e5;
  const waiting = a && (!note || Date.parse(note.at || 0) < a) && Date.now() - a < 36 * 36e5;
  const askBox = `<div class="ask">${waiting ? `<p class="wait"><i></i><span>Asked ${esc(ago(a))}. ${esc(MAC(1))} checks ${esc(t)} and sends the answer here${state.snap.push && (state.snap.push.on || []).length ? ' with a notification' : ''}: usually within a few minutes while Claude Finance is open on the Mac, otherwise at its next check (${esc(nextScanText() || 'the next scan')}).</span></p>`
    : `<p>${fresh ? `The bot checked ${esc(t)} ${esc(ago(Date.parse(note.at)))}.` : `Want the bot's full write-up on ${esc(t)}: its verdict, reasons, risks and a 6-month chart?`}</p><button class="btn small${fresh ? '' : ' go'}" data-act="w-ask" data-t="${esc(t)}">${fresh ? 'Ask again' : 'Ask the bot'}</button>`}</div>`;
  const chart = note && (note.spark || []).length > 1 ? `<div class="sec2"><h3>The last 6 months</h3>${priceChart(note.spark, note.spark_d, p ? [{ v: p.buy_price, c: 'rgba(255,255,255,.55)', t: 'Paid ' + price(p.buy_price) }] : [], p ? p.buy_price : null)}</div>`
    : p && (p.spark || []).length > 1 ? `<div class="sec2"><h3>Since the summer</h3>${priceChart(p.spark, p.spark_d, [{ v: p.buy_price, c: 'rgba(255,255,255,.55)', t: 'Paid ' + price(p.buy_price) }], p.buy_price)}</div>` : '';
  return `<section class="card res"><div class="hd"><div><h2>${esc(t)}</h2><div class="nm">${esc(name)}${row && row.sector ? ' · ' + esc(row.sector) : ''}</div></div>
      <div class="px">${price(px)}<small class="${tone(day)}">${isNum(day) ? pct(day, 2) + ' today' : ''}</small></div></div>
    <div class="verdict ${v[0]}"><b>${esc(v[1])}</b>${v[2] ? `<p>${esc(v[2])}</p>` : ''}</div>
    ${row || (note && (note.checks || []).length) ? `<div class="sec2"><h3>Your entry rules${row && !note ? ' · last scan' : ''}</h3><ul class="rules">${rulesList(row, U, note)}</ul></div>` : ''}
    ${nums.length ? `<div class="nums">${nums.map(([k, x]) => `<div><small>${k}</small><b class="${x.startsWith('+') ? 'pos' : x.startsWith(MINUS) && k !== 'Off the high' ? 'neg' : ''}">${esc(x)}</b></div>`).join('')}</div>` : ''}
    ${chart}${aiBlock((rd && rd.ai) || (bot && bot.ai))}${noteBlock(note && !note.error ? note : bot)}${note && note.earnings ? `<p class="w-sub">Next earnings: ${esc(fmtD(note.earnings))}</p>` : ''}
    ${askBox}</section>`;
}
async function askQ(btn) {
  const p = state.snap.push, ta = $('#cq'), q = ta && ta.value.trim();
  if (!q) { if (ta) ta.focus(); return; }
  if (!p || !p.inbox || !state.bits) { toast('Asking needs the Mac’s inbox: turn on notifications once on the Mac.'); return; }
  btn.disabled = true; btn.textContent = 'Sending…';
  try {
    const r = await fetch('https://ntfy.sh/' + encodeURIComponent(p.inbox), { method: 'POST', body: JSON.stringify(await seal({ q, at: Date.now(), name: devName() })) });
    if (!r.ok) throw new Error('inbox ' + r.status);
    writeJSON('ctm.q', { q, at: Date.now() }); state.fastUntil = Date.now() + 20 * 60e3;
    toast('Sent. The firm answers from the Mac.'); ta.value = '';
  } catch (e) { toast('Couldn’t reach the inbox. Check the connection and try again.'); }
  btn.disabled = false; btn.textContent = 'Ask'; draw(true);
}
async function ask(t, btn) {
  const p = state.snap.push;
  if (!p || !p.inbox || !state.bits) { toast('Asking needs the Mac’s inbox: turn on notifications once on the Mac.'); return; }
  if (btn) { btn.disabled = true; btn.textContent = 'Sending…'; }
  try {
    const r = await fetch('https://ntfy.sh/' + encodeURIComponent(p.inbox), { method: 'POST', body: JSON.stringify(await seal({ ask: t, at: Date.now(), name: devName() })) });
    if (!r.ok) throw new Error('inbox ' + r.status);
    const a = asks(); a[t] = Date.now(); writeJSON(LS_ASKS, a);
    state.fastUntil = Date.now() + 20 * 60e3;  // look for the answer every 30 seconds for a while
    toast(`Sent. ${MAC(1)} will check ${t}.`);
  } catch (e) {
    toast('Couldn’t reach the inbox. Check the connection and try again.');
  }
  if (ui.tab === 'check' && ui.sel === t) { const r = $('#res'); if (r) { charts.length = 0; r.innerHTML = result(t); mountCharts(r); } }
}

/* ---------- More ---------- */
function viewMore() {
  const s = state.snap, v = V2(), b = v.bot || {}, m = marketNow() || v.market || {};
  return `${pushCard()}
    <div class="w-h"><h2>This copy</h2></div><div class="card panel"><dl class="kv">
      <dt>Prices from</dt><dd>${esc(s.scanned_at ? when(Date.parse(s.scanned_at)) : s.generated || '–')}</dd>
      <dt>Next update</dt><dd>${esc(nextScanText() || b.next_scan || '–')}</dd>
      <dt>Market</dt><dd>${esc(m.text || '–')}</dd>
      <dt>The bot</dt><dd>${esc(b.checked || '')}</dd>
      <dt>This device</dt><dd>${readJSON(LS_KEY) ? 'Remembers the code' : 'Asks for the code'}</dd></dl>
      <div class="btns"><button class="btn small" data-act="check">Check for an update</button><button class="btn small" data-act="w-full">Full view (the Mac's screens)</button></div></div>
    <div class="w-h"><h2>Help</h2></div><div class="card panel">${OWNER() ? `<p class="w-whose">This is <b>${esc(OWNER())}’s</b> Claude Finance: ${esc(OWNER())}’s account, from ${esc(OWNER())}’s Mac.</p>` : ''}<p>Portfolio shows what this account owns and what happens next to each one. Check a stock tells you what its rules say about any ticker.</p>
      <div class="btns"><a class="btn small" href="about.html" style="text-decoration:none">What is this?</a><button class="btn small" data-act="lock">Lock this device</button></div></div>
    <p class="w-foot">Read-only. It shows what ${esc(MAC())} and its own rules say; it can't trade or move money, and it isn't advice.</p>`;
}

/* ---------- sheet ---------- */
function openSheet(body) {
  const L = $('#wlayer');
  L.innerHTML = `<div class="scrim" data-act="w-close"></div><aside class="sheet" role="dialog"><div class="grab"></div>${body}</aside>`;
  document.body.style.overflow = 'hidden';
  const sh = $('.sheet', L);
  mountCharts(sh);
  let y0 = null, dy = 0, on = false;  // pull down from the top to close (charts keep their own drag)
  sh.addEventListener('touchstart', e => { y0 = e.touches.length === 1 && sh.scrollTop <= 0 && !e.target.closest('.wch') ? e.touches[0].clientY : null; dy = 0; on = false; }, { passive: true });
  sh.addEventListener('touchmove', e => {
    if (y0 === null) return; dy = e.touches[0].clientY - y0;
    if (!on) { if (dy < 0) { y0 = null; return; } if (dy < 8) return; on = true; }
    e.preventDefault(); sh.style.transition = 'none'; sh.style.transform = `translateY(${Math.max(0, dy)}px)`;
  }, { passive: false });
  const end = () => { if (!on) { y0 = null; return; } sh.style.transition = 'transform .22s var(--ease)';
    if (dy > 110) { sh.style.transform = 'translateY(105%)'; setTimeout(closeSheet, 180); } else sh.style.transform = ''; y0 = null; on = false; };
  sh.addEventListener('touchend', end); sh.addEventListener('touchcancel', end);
}
function closeSheet() { const L = $('#wlayer'); if (L) L.innerHTML = ''; document.body.style.overflow = ''; history.replaceState(null, '', '#' + (ui.tab === 'check' && ui.sel ? 'check/' + ui.sel : ui.tab)); }

/* ---------- Full view: the Mac's own screens (ct.js + ct.css) ---------- */
function openFull() {
  if (!window.CT || !V2().positions) { toast('The full view isn’t in this copy.'); return; }
  ui.full = true;
  $('#ctcss').media = 'all'; $('#w').hidden = true; $('#wlayer').innerHTML = '';
  const f = $('#full'); f.hidden = false;
  CT.mount(f, state.snap.v2, { phone: true, view: 'bot', extras: () => '<p style="text-align:center;margin:26px 0 0"><button class="btn" data-act="w-simple">← Back to the simple view</button></p>' });
  if (!$('.full-back')) document.body.insertAdjacentHTML('beforeend', '<button class="full-back" data-act="w-simple">← Simple view</button>');
}
function closeFull() {
  ui.full = false;
  $('#ctcss').media = 'not all';
  const f = $('#full'); f.hidden = true;
  const b = $('.full-back'); if (b) b.remove();
  $('#w').hidden = false; draw();
}

/* ---------- show a copy, keep the header fresh ---------- */
// Whose copy this is travels inside the locked data (v8.1), so every phone says whose Claude Finance it is showing.
const OWNER = () => String((state.snap && state.snap.owner) || '').slice(0, 40);
const MAC = cap => OWNER() ? `${OWNER()}’s Mac` : cap ? 'The Mac' : 'the Mac';
function hashRoute() {
  const [v, t] = decodeURIComponent(location.hash.replace(/^#/, '')).split('/');
  const tab = { check: 'check', picks: 'check', radar: 'check', horizons: 'check', more: 'more', proof: 'firm', brain: 'firm', ideas: 'firm', firm: 'firm', desks: 'firm', pos: 'pos', portfolio: 'pos', positions: 'pos' }[v] || 'today';
  return { tab, t: (t || '').toUpperCase(), pos: v === 'pos' || ((v === 'home' || v === 'positions' || v === 'bot') && t) };
}
function show(snap) {
  const prev = state.snap;
  state.snap = snap;
  $('#lock').hidden = true; $('#app').hidden = false;
  const glow = $('body > .aurora'); if (glow) glow.hidden = true;
  if (!snap.v2) {
    $('#app').innerHTML = '<p class="empty" style="padding:40px 20px">This copy came from an older version of the Mac app. It switches to the new one after the Mac\'s next scan.</p>';
    return;
  }
  // newly answered questions from this phone
  const a = asks();
  for (const n of snap.answers || []) {
    const t0 = a[n.ticker];
    if (t0 && Date.parse(n.at || 0) > t0 && !(prev && (prev.answers || []).some(x => x.ticker === n.ticker && x.at === n.at))) {
      if (prev) toast(`${n.ticker}: the bot's check is ready`);
      delete a[n.ticker]; writeJSON(LS_ASKS, a);
    }
  }
  if (ui.full) { CT.mount($('#full'), snap.v2, { phone: true, extras: () => '<p style="text-align:center;margin:26px 0 0"><button class="btn" data-act="w-simple">← Back to the simple view</button></p>' }); pushCheck(); return; }
  if (!$('#w')) {
    $('#app').innerHTML = shell();
    const h = hashRoute();
    ui.tab = h.tab; if (h.t && h.tab === 'check') ui.sel = h.t;
    draw();
    if (h.pos && h.t) openPos(h.t);
  } else {
    const sheetOpen = $('#wlayer .sheet');
    if (!sheetOpen && !(document.activeElement && document.activeElement.id === 'q')) draw(true);  // not while reading a sheet or typing
  }
  pushCheck();
  if (window.CT && CT.whatsNew) CT.whatsNew.auto({ phone: true });  // a new version introduces itself, once per phone
}
function renderTop() {
  if (!state.snap) return;
  const f = freshness(state.snap.scanned_at || state.snap.made);
  const ft = (state.offline ? 'Offline · ' : '') + f.text;  // a small phone has no room for the long form beside the name
  $$('#fresh').forEach(el => { const s = document.createElement('span'); s.textContent = ft.length > 16 && window.innerWidth < 520 ? ft.replace('Updated ', '') : ft; el.replaceChildren(s); el.title = ft; el.classList.toggle('stale', !!f.behind); });
}

/* ---------- events ---------- */
function wire() {
  // Safari's page pinch-zoom: blocked so the tabs and the top bar stay put (charts handle their own pinch)
  ['gesturestart', 'gesturechange'].forEach(t => document.addEventListener(t, e => e.preventDefault(), { passive: false }));
  $('#lock-form').addEventListener('submit', onUnlock);
  $('#eye').addEventListener('click', () => { const c = $('#code'), hid = c.type === 'password'; c.type = hid ? 'text' : 'password'; $('#eye').textContent = hid ? 'Hide' : 'Show'; });
  window.addEventListener('hashchange', () => { if (!state.snap || ui.full) return; const h = hashRoute(); if (h.pos && h.t) openPos(h.t); else if (h.tab !== ui.tab || (h.t && h.t !== ui.sel)) go(h.tab, h.t); });
  document.addEventListener('click', ev => {
    const el = ev.target.closest('[data-act]'); if (!el) return;
    const act = el.dataset.act, t = el.dataset.t;
    if (act === 'check') checkNow();
    else if (act === 'push-on') pushOn();
    else if (act === 'push-off') pushOff();
    else if (act === 'lock') { writeJSON(LS_KEY, null); writeJSON(LS_ENV, null); state.bits = null; state.snap = null; showLock('Locked. The code is needed again on this device.'); }
    else if (act === 'w-tab') { closeSheet(); go(t); }
    else if (act === 'w-pos') openPos(t);
    else if (act === 'w-close') closeSheet();
    else if (act === 'w-pick') { const q = $('#q'); if (q) q.blur(); go('check', t); }
    else if (act === 'w-go') pickTyped();
    else if (act === 'w-ask') ask(t, el);
    else if (act === 'w-q') askQ(el);
    else if (act === 'w-zoomreset') { const c = el.closest('.wch'); if (c && c._reset) c._reset(); }
    else if (act === 'w-full') openFull();
    else if (act === 'w-simple') closeFull();
    else if (act === 'w-place') {  // v1.2: the directions box on an order card
      const o = (V2().orders || [])[+el.dataset.i]; if (!o) return;
      ui.place[o.id] = !ui.place[o.id]; el.setAttribute('aria-expanded', !!ui.place[o.id]); placeBoxes();
    }
    else if ((act === 'broker' || act === 'plsteps' || act === 'plcopy') && window.CT && CT.place) {
      const box = el.closest('.placebox'), o = box ? (V2().orders || [])[+box.dataset.i] : null;
      if (CT.place.act(el, o, V2())) placeBoxes();
    }
  });
  function placeBoxes() {  // only the boxes are drawn again, so the page doesn't jump
    document.querySelectorAll('.todo .placebox').forEach(b => { const o = (V2().orders || [])[+b.dataset.i]; b.innerHTML = o && ui.place[o.id] ? CT.place.box(o, +b.dataset.i, V2()) : ''; });
  }
  document.addEventListener('input', ev => { if (ev.target.id === 'q') suggest(ev.target.value); });
  document.addEventListener('keydown', ev => {
    if (ev.target.id === 'q' && ev.key === 'Enter') { ev.preventDefault(); pickTyped(); }
    else if ((ev.key === 'Enter' || ev.key === ' ') && ev.target.matches && ev.target.matches('[role=button][data-act]')) { ev.preventDefault(); ev.target.click(); }  // v6: the gist box works from a keyboard too
    else if (ev.key === 'Escape') closeSheet();
  });
  if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
  // while waiting for an answer, look for it every 30 seconds
  setInterval(() => { if (state.fastUntil > Date.now() && !document.hidden && (Object.keys(asks()).length || readJSON('ctm.q'))) refresh(); }, 30e3);
}
function pickTyped() {
  const q = $('#q'); if (!q) return;
  const v = q.value.trim().toUpperCase().replace(/^\$/, ''); if (!v) return;
  const U = uni(), first = $('#sugg button');
  const known = (U && U.idx[v]) || posOf(v);  // a ticker the Mac knows; otherwise the best match ("apple" -> AAPL)
  const t = known ? v : first ? first.dataset.t : v;
  q.blur(); go('check', t);
}

boot();
})();
