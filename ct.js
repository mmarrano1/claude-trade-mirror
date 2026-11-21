/* SRM Finance (Claude Finance until 2.0, Claude Trade before that): one front end for the Mac app and the phone.
   CT.mount(root, state, {phone}) draws the bot from the JSON state that signal_lab/v2.py builds.
   On the Mac the buttons call the app (window.pywebview.api); on the phone everything is read-only. */
// The version every screen shows by the name (this Mac app, the phone, every other copy). The slower rule, also in
// V2.md and CLAUDE.md (Sam, 2026-11-09: "they have been going up way to fast"):
//   a fix or a touch-up          → the third number (2.0 → 2.0.1); no What's new screen
//   a new feature you'd notice   → the second number (2.0 → 2.1), with an entry in RELEASES below (What's new)
//   the next whole number (3.0)  → only when Sam says so; its RELEASES entry gets a tour
// One sitting's work ships as one version, however many things changed. History: Claude Trade reached v8.3 in a week,
// Claude Finance counted 1.0 (2026-11-10) to 1.2.1, and SRM Finance began at 2.0 on 2026-11-15 (Sam chose the number).
window.CT_VERSION = '2.2.3';
(() => {
'use strict';
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => Array.from(el.querySelectorAll(s));
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const isNum = v => typeof v === 'number' && isFinite(v);
const MINUS = '−';
const APP = 'SRM Finance';  // the app's name, wherever the page says it (since 2.0: its maker's initials)
const MAKER = 'Sam Marrano';  // who makes it: the same name as who.MAKER (signal_lab/who.py). About, What's new, Feedback
const VER = 'v' + window.CT_VERSION;
const HZ ={ long: 'Long-term', medium: 'Medium-term', short: 'Short-term' };
const KIND = { sell: 't-stop', buy: 't-go', stop: 't-warn', decide: 't-acc', rebalance: 't-acc', confirm: 't-mut', fix: 't-warn', cancel: 't-warn' };
const STRIP = { sell: 'var(--stop)', buy: 'var(--go)', stop: 'var(--warn)', decide: 'var(--violet)', rebalance: 'var(--violet)', confirm: 'var(--dim)', fix: 'var(--warn)', cancel: 'var(--warn)' };
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'], DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

let S = null, phone = false, root = null, OPT = {}, ui = { view: 'bot', radar: 'all', sheet: null, sent: {} };
const api = () => (!phone && window.pywebview && window.pywebview.api) || null;

/* ---------------- formatting ---------------- */
function money(v, cents) {
  if (!isNum(v)) return '–';
  const a = Math.abs(v), c = cents === undefined ? a < 100 : cents;
  return (v < 0 ? MINUS : '') + '$' + a.toLocaleString('en-US', { minimumFractionDigits: c ? 2 : 0, maximumFractionDigits: c ? 2 : 0 });
}
const signed = (v, cents) => isNum(v) ? (v >= 0 ? '+' : MINUS) + money(Math.abs(v), cents) : '–';
function pct(v, d = 1, plus = true) {
  if (!isNum(v)) return '–';
  const s = (Math.abs(v) * 100).toFixed(d) + '%';
  return v < 0 ? MINUS + s : (plus ? '+' : '') + s;
}
const tone = v => isNum(v) ? (v > 0 ? 'pos' : v < 0 ? 'neg' : '') : '';
const D = s => { const [y, m, d] = String(s).slice(0, 10).split('-').map(Number); return new Date(y, (m || 1) - 1, d || 1); };
function fmtD(s, long) {
  if (!s) return '';
  const d = D(s), now = new Date();
  const base = `${DOW[d.getDay()]} ${MON[d.getMonth()]} ${d.getDate()}`;
  return d.getFullYear() !== now.getFullYear() || long === 'y' ? `${MON[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}` : base;
}
function hm(iso) {
  const t = new Date(iso); if (isNaN(t)) return '';
  const today = new Date().toDateString() === t.toDateString();
  return today ? t.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) : `${MON[t.getMonth()]} ${t.getDate()}`;
}
const cap = s => s ? s[0].toUpperCase() + s.slice(1) : '';

/* ---------------- tiny charts ---------------- */
function path(vals, w, h, pad = 2, lo, hi) {
  const v = vals.filter(isNum);
  if (v.length < 2) return '';
  lo = lo !== undefined ? lo : Math.min(...v); hi = hi !== undefined ? hi : Math.max(...v);
  const span = hi - lo || 1;
  return vals.map((x, i) => `${i ? 'L' : 'M'}${(i / (vals.length - 1) * w).toFixed(1)},${(h - pad - ((x - lo) / span) * (h - pad * 2)).toFixed(1)}`).join('');
}
function spark(vals, opt = {}) {
  const v = (vals || []).filter(isNum);
  if (v.length < 2) return '';
  const w = 300, h = opt.h || 46, up = v[v.length - 1] >= v[0], c = opt.c || (up ? 'var(--go)' : 'var(--stop)'), id = 'g' + Math.random().toString(36).slice(2, 8);
  let lo = Math.min(...v), hi = Math.max(...v);
  (opt.lines || []).forEach(l => { if (isNum(l.v)) { lo = Math.min(lo, l.v); hi = Math.max(hi, l.v); } });
  const d = path(v, w, h, 3, lo, hi), y = x => (h - 3 - ((x - lo) / (hi - lo || 1)) * (h - 6)).toFixed(1);
  const ls = (opt.lines || []).filter(l => isNum(l.v));
  const lines = ls.map(l => `<line x1="0" x2="${w}" y1="${y(l.v)}" y2="${y(l.v)}" stroke="${l.c}" stroke-dasharray="3 4" stroke-width="1" opacity=".7"/>`).join('');
  // v6: a line's label sits beside the picture, not in it: the picture stretches to fit (preserveAspectRatio none), which squished the text
  const labels = ls.filter(l => l.t).map(l => `<span class="sp-lb" style="top:${(+y(l.v) - 15).toFixed(0)}px;color:${l.c}">${esc(l.t)}</span>`).join('');
  const svg = `<svg class="sp" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" aria-hidden="true" focusable="false"><defs><linearGradient id="${id}" x1="0" x2="0" y1="0" y2="1">`
    + `<stop offset="0" stop-color="${c}" stop-opacity=".28"/><stop offset="1" stop-color="${c}" stop-opacity="0"/></linearGradient></defs>`
    + `<path d="${d}L${w},${h}L0,${h}Z" fill="url(#${id})"/>${lines}<path class="draw" pathLength="1" d="${d}" fill="none" stroke="${c}" stroke-width="1.7" vector-effect="non-scaling-stroke"/>`
    + `<circle class="glint" cx="${w}" cy="${y(v[v.length - 1])}" r="3" fill="${c}"/></svg>`;
  return labels ? `<div class="sp-wrap">${svg}${labels}</div>` : svg;
}
function ring(v, size) {
  const n = Math.max(0, Math.min(100, v || 0));
  return `<span class="ring"${size ? ` style="width:${size}px;height:${size}px"` : ''}><svg viewBox="0 0 40 40"><circle class="bg" cx="20" cy="20" r="16"/>`
    + `<circle class="fg" cx="20" cy="20" r="16" pathLength="100" stroke-dasharray="${n} 100"/></svg><b>${isNum(v) ? Math.round(v) : '–'}</b></span>`;
}
const GRAD = '<svg width="0" height="0" style="position:absolute"><defs><linearGradient id="ringgrad" x1="0" x2="1"><stop offset="0" stop-color="#56cbff"/><stop offset="1" stop-color="#3ff2a3"/></linearGradient></defs></svg>';

/* ---------------- charts you can read and zoom ----------------
   Touch: drag a finger to read any day, pinch to zoom into a stretch of days, two fingers to slide along it, double-tap
   to see it all again. Mac: hover to read, pinch the trackpad (or ⌘-scroll) to zoom, swipe sideways to slide,
   double-click to reset. cfg: {series: [{v, c}], levels: [{v, c, t}], zero, h, label, tip(i, a), range(a, b)} */
const CH = new Map();
let chN = 0;
function chart(cfg) {
  const id = 'ch' + (++chN);
  CH.set(id, cfg);
  return `<div class="ich" data-ch="${id}" style="min-height:${cfg.h || 110}px" role="img" aria-label="${esc(cfg.label || 'Chart')}"></div>`;
}
// "Oct 22–28" or "Oct 30 – Nov 3"
const span2 = (d1, d2) => { const a = D(d1), b = D(d2);
  return a.getMonth() === b.getMonth() ? `${MON[a.getMonth()]} ${a.getDate()}–${b.getDate()}` : `${MON[a.getMonth()]} ${a.getDate()} – ${MON[b.getMonth()]} ${b.getDate()}`; };
const chHint = () => `<p class="ich-hint">${phone ? 'Drag across it to read each day · pinch to zoom in · double-tap to see it all'
  : 'Hover to read each day · pinch the trackpad (or ⌘-scroll) to zoom · double-click to see it all'}</p>`;
function mountCharts(scope) {
  $$('.ich', scope).forEach(el => {
    const cfg = CH.get(el.dataset.ch);
    if (!cfg || el._ch) return;
    CH.delete(el.dataset.ch);
    chartInit(el, cfg);
  });
}
function chartInit(el, cfg) {
  const n = cfg.series[0].v.length, minSpan = Math.min(n - 1, 4);
  const st = { a: 0, b: n - 1, i: null, ptr: new Map(), pinch: null, down: null, tap: 0, g: null, drawn: false };
  el._ch = st;
  el.innerHTML = '<svg></svg><div class="ich-tip" hidden></div><button class="ich-z" type="button" hidden></button>';
  const svg = $('svg', el), tip = $('.ich-tip', el), zb = $('.ich-z', el), gid = el.dataset.ch;
  let geo = null;
  const zoomed = () => st.a > 0.01 || st.b < n - 1.01;
  function paint() {
    const W = Math.max(120, el.clientWidth), H = cfg.h || 110, T = 10, B = 6, a = st.a, b = st.b;
    const i0 = Math.max(0, Math.floor(a)), i1 = Math.min(n - 1, Math.ceil(b)), X = i => (i - a) / (b - a || 1) * W;
    let lo = Infinity, hi = -Infinity;
    cfg.series.forEach(s => { for (let i = i0; i <= i1; i++) if (isNum(s.v[i])) { lo = Math.min(lo, s.v[i]); hi = Math.max(hi, s.v[i]); } });
    if (cfg.zero) { lo = Math.min(lo, 0); hi = Math.max(hi, 0); }
    if (!isFinite(lo)) return;
    const s0 = hi - lo || Math.abs(hi) * 0.02 || 1, lv = (cfg.levels || []).filter(l => isNum(l.v));
    const near = l => !zoomed() || (l.v >= lo - s0 * 0.35 && l.v <= hi + s0 * 0.35);  // zoomed in, far-away lines become edge notes
    lv.filter(near).forEach(l => { lo = Math.min(lo, l.v); hi = Math.max(hi, l.v); });
    const pad = (hi - lo) * 0.06 || 1, L0 = lo - pad, H0 = hi + pad, Y = v => T + (1 - (v - L0) / (H0 - L0)) * (H - T - B);
    const line = s => { let d = ''; for (let i = i0; i <= i1; i++) if (isNum(s.v[i])) d += (d ? 'L' : 'M') + X(i).toFixed(1) + ',' + Y(s.v[i]).toFixed(1); return d; };
    const main = cfg.series[0], c = main.c, md = line(main);
    let o = `<defs><linearGradient id="${gid}g" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="${c}" stop-opacity=".26"/><stop offset="1" stop-color="${c}" stop-opacity="0"/></linearGradient>`
      + `<clipPath id="${gid}c"><rect x="0" y="0" width="${W}" height="${H}"/></clipPath></defs><g clip-path="url(#${gid}c)">`;
    if (cfg.zero) o += `<line x1="0" x2="${W}" y1="${Y(0).toFixed(1)}" y2="${Y(0).toFixed(1)}" stroke="rgba(255,255,255,.18)" stroke-dasharray="2 4"/>`;
    if (md) o += `<path d="${md}L${X(i1).toFixed(1)},${H}L${X(i0).toFixed(1)},${H}Z" fill="url(#${gid}g)"/>`;
    cfg.series.slice(1).forEach(s => { o += `<path d="${line(s)}" fill="none" stroke="${s.c}" stroke-width="1.3" stroke-dasharray="4 4"/>`; });
    lv.filter(near).forEach(l => { o += `<line x1="0" x2="${W}" y1="${Y(l.v).toFixed(1)}" y2="${Y(l.v).toFixed(1)}" stroke="${l.c}" stroke-dasharray="3 4" opacity=".8"/>`
      + (l.t ? `<text class="ich-lt" x="${W - 4}" y="${(Y(l.v) - 4).toFixed(1)}" text-anchor="end" fill="${l.c}">${esc(l.t)}</text>` : ''); });
    o += `<path${st.drawn ? '' : ' class="draw" pathLength="1"'} d="${md}" fill="none" stroke="${c}" stroke-width="1.8" stroke-linejoin="round"/></g>`;
    lv.filter(l => !near(l)).forEach((l, k) => { const up = l.v > hi;
      o += `<text class="ich-lt" x="4" y="${up ? 12 + k * 12 : H - 6 - k * 12}" fill="${l.c}">${up ? '↑' : '↓'} ${esc(l.t || '')}</text>`; });
    if (i1 === n - 1 && isNum(main.v[n - 1])) o += `<circle class="glint" cx="${X(n - 1).toFixed(1)}" cy="${Y(main.v[n - 1]).toFixed(1)}" r="3" fill="${c}"/>`;
    o += `<g class="ich-x" style="display:none"><line y1="0" y2="${H}"/>${cfg.series.map((s, k) => `<circle r="4" data-k="${k}" fill="${s.c}"/>`).join('')}</g>`;
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`); svg.setAttribute('height', H);
    svg.innerHTML = o;
    geo = { W, X, Y }; st.drawn = true;
    zb.hidden = !zoomed();
    if (zoomed()) zb.innerHTML = `<span class="zr">${cfg.range ? cfg.range(Math.round(st.a), Math.round(st.b)) : 'Zoomed in'}</span><b>Show all</b>`;
    if (st.i != null) show(st.i);
  }
  function show(f) {
    if (!geo || !isFinite(f)) return;  // a hidden (zero-width) chart has no days to point at
    const i = Math.max(Math.ceil(st.a - 0.001), Math.min(Math.floor(st.b + 0.001), Math.round(f))), g = $('.ich-x', svg), x = geo.X(i);
    st.i = i; g.style.display = '';
    const ln = $('line', g); ln.setAttribute('x1', x); ln.setAttribute('x2', x);
    $$('circle', g).forEach(cn => { const v = cfg.series[+cn.dataset.k].v[i]; cn.style.display = isNum(v) ? '' : 'none'; if (isNum(v)) { cn.setAttribute('cx', x); cn.setAttribute('cy', geo.Y(v)); } });
    tip.innerHTML = cfg.tip(i, Math.round(st.a)); tip.hidden = false;
    const tw = tip.offsetWidth;  // beside the line, on the side away from the finger
    tip.style.left = Math.max(0, Math.min(geo.W - tw, x < geo.W / 2 ? x + 14 : x - tw - 14)) + 'px';
  }
  function hide() { st.i = null; const g = $('.ich-x', svg); if (g) g.style.display = 'none'; tip.hidden = true; }
  function setWin(a, span) {
    span = Math.max(minSpan, Math.min(n - 1, span));
    st.a = Math.max(0, Math.min(n - 1 - span, a)); st.b = st.a + span;
    paint();
  }
  const reset = () => { st.a = 0; st.b = n - 1; paint(); };
  const at = x => { const r = el.getBoundingClientRect(); return r.width ? st.a + Math.min(1, Math.max(0, (x - r.left) / r.width)) * (st.b - st.a) : NaN; };
  const two = () => { const [p, q] = [...st.ptr.values()]; return { d: Math.max(24, Math.hypot(p.x - q.x, p.y - q.y)), cx: (p.x + q.x) / 2 }; };
  el.addEventListener('pointerdown', e => {
    if (e.target.closest('.ich-z') || (e.pointerType === 'mouse' && e.button !== 0)) return;
    st.ptr.set(e.pointerId, { x: e.clientX, y: e.clientY });
    try { el.setPointerCapture(e.pointerId); } catch (err) { /* older Safari */ }
    if (st.ptr.size === 2) { const t = two(), r = el.getBoundingClientRect(); st.pinch = r.width ? { d: t.d, a: st.a, span: st.b - st.a, c: at(t.cx), w: r.width, left: r.left } : null; hide(); }
    else if (st.ptr.size === 1) { st.down = { x: e.clientX, y: e.clientY, t: Date.now(), moved: false }; show(at(e.clientX)); }
  });
  el.addEventListener('pointermove', e => {
    if (!st.ptr.has(e.pointerId)) { if (e.pointerType === 'mouse' && !st.ptr.size) show(at(e.clientX)); return; }
    st.ptr.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (st.ptr.size >= 2 && st.pinch) {  // fingers apart: fewer days; the day under the pinch stays under it
      const P = st.pinch, t = two(), span = Math.max(minSpan, Math.min(n - 1, P.span * P.d / t.d));
      setWin(P.c - ((t.cx - P.left) / P.w) * span, span);
    } else if (st.ptr.size === 1) {
      if (st.down && Math.hypot(e.clientX - st.down.x, e.clientY - st.down.y) > 6) st.down.moved = true;
      show(at(e.clientX));
    }
  });
  const end = e => {
    const had = st.ptr.delete(e.pointerId);
    if (st.ptr.size < 2) st.pinch = null;
    if (e.type === 'pointercancel') { hide(); return; }
    if (!had || st.ptr.size || e.pointerType === 'mouse') return;
    const now = Date.now(), tapped = st.down && !st.down.moved && now - st.down.t < 300;
    if (tapped && now - st.tap < 350) { st.tap = 0; reset(); } else if (tapped) st.tap = now;
    hide();  // the reading ends when the finger lifts
  };
  el.addEventListener('pointerup', end);
  el.addEventListener('pointercancel', end);
  el.addEventListener('pointerleave', e => { if (e.pointerType === 'mouse' && !st.ptr.size) hide(); });
  el.addEventListener('dblclick', e => { e.preventDefault(); reset(); });
  zb.addEventListener('click', e => { e.stopPropagation(); reset(); });
  el.addEventListener('wheel', e => {
    if (e.ctrlKey || e.metaKey) {  // a trackpad pinch arrives as ctrl+scroll; ⌘-scroll with a mouse
      e.preventDefault();
      if (!el.clientWidth) return;
      const c = at(e.clientX), span = (st.b - st.a) * Math.exp(e.deltaY * 0.01), f = (c - st.a) / (st.b - st.a || 1);
      setWin(c - f * Math.max(minSpan, Math.min(n - 1, span)), span);
    } else if (zoomed() && Math.abs(e.deltaX) > Math.abs(e.deltaY)) {
      e.preventDefault();
      setWin(st.a + e.deltaX / el.getBoundingClientRect().width * (st.b - st.a), st.b - st.a);
    }
  }, { passive: false });
  // Safari's own pinch events: the Mac trackpad uses them; on a phone the two-finger pointers above already zoom
  el.addEventListener('gesturestart', e => { e.preventDefault(); st.g = st.ptr.size ? null : { a: st.a, span: st.b - st.a, c: st.i != null ? st.i : (st.a + st.b) / 2 }; });
  el.addEventListener('gesturechange', e => {
    e.preventDefault();
    if (!st.g || !e.scale) return;
    const G = st.g, span = Math.max(minSpan, Math.min(n - 1, G.span / e.scale));
    setWin(G.c - ((G.c - G.a) / (G.span || 1)) * span, span);
  });
  el.addEventListener('gestureend', e => { e.preventDefault(); st.g = null; });
  if (window.ResizeObserver) {
    let w = 0;
    const ro = new ResizeObserver(() => { if (!el.isConnected) { ro.disconnect(); return; } if (el.clientWidth !== w) { w = el.clientWidth; paint(); } });
    ro.observe(el);
  }
  paint();
}

/* ---------------- shell ---------------- */
const ICON = {
  bot: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3"/></svg>',
  pos: '<svg viewBox="0 0 24 24"><path d="M4 19V9M10 19V5M16 19v-7M22 19H2"/></svg>',
  radar: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 12 18 6M12 3v3M21 12h-3"/></svg>',
  proof: '<svg viewBox="0 0 24 24"><path d="M4 18 9 12l4 4 7-9"/><path d="M15 7h5v5"/></svg>',
  brain: '<svg viewBox="0 0 24 24"><path d="M9 4a3 3 0 0 0-3 3 3 3 0 0 0-2 5 3 3 0 0 0 2 5 3 3 0 0 0 6 1V6a2 2 0 0 0-3-2zM15 4a3 3 0 0 1 3 3 3 3 0 0 1 2 5 3 3 0 0 1-2 5 3 3 0 0 1-6 1"/></svg>',
  firm: '<svg viewBox="0 0 24 24"><circle cx="12" cy="5" r="2.4"/><circle cx="5" cy="18" r="2.4"/><circle cx="12" cy="18" r="2.4"/><circle cx="19" cy="18" r="2.4"/><path d="M12 7.5v8M12 11H5v4.5M12 11h7v4.5"/></svg>',
  search: '<svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></svg>',
  scan: '<svg viewBox="0 0 24 24"><path d="M20 12a8 8 0 1 1-2.3-5.6M20 4v4h-4"/></svg>',
  fb: '<svg viewBox="0 0 24 24"><path d="M4 5.5A1.5 1.5 0 0 1 5.5 4h13A1.5 1.5 0 0 1 20 5.5v9a1.5 1.5 0 0 1-1.5 1.5H10l-4.5 4v-4h0A1.5 1.5 0 0 1 4 14.5z"/><path d="M8 8.5h8M8 11.5h5"/></svg>',
  gear: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></svg>',
};
const VIEWS = [['bot', 'Today'], ['positions', 'Portfolio'], ['firm', 'Firm'], ['chat', 'Chat']];  // v5.1: Ideas and Brain are sections of the Firm; 2.0: the Chat
const views = () => phone ? VIEWS.filter(v => v[0] !== 'chat') : VIEWS;  // the phone asks through its own box, so no Chat tab there
const ALIAS = { radar: 'firm', picks: 'firm', ideas: 'firm', brain: 'firm', proof: 'firm', desks: 'firm', home: 'positions', today: 'bot' };
function shell() {
  const n = (S.orders || []).length;
  const nav = views().map(([k, l]) => `<button data-view="${k}" class="${ui.view === k ? 'on' : ''}">${l}${k === 'bot' && n ? `<span class="badge">${n}</span>` : ''}</button>`).join('');
  const tabs = views().map(([k, l]) => `<button data-view="${k}" class="${ui.view === k ? 'on' : ''}"${k === 'bot' && n ? ` aria-label="${l}, ${n} order${n === 1 ? '' : 's'} waiting"` : ''}>${ICON[{ bot: 'bot', positions: 'pos', picks: 'radar', firm: 'firm', brain: 'brain', chat: 'chat' }[k]]}${l}`
    + `${k === 'bot' && n ? `<span class="badge" aria-hidden="true">${n}</span>` : ''}</button>`).join('');
  return `<div class="aurora"><i></i><i></i><i></i></div><div class="grid-bg"></div>${GRAD}
  <header class="bar ct-drag"><div class="bar-l ct-drag">
    ${phone ? '' : '<div class="lights"><button class="c" data-act="win" data-w="close" aria-label="Hide" title="Hide the window. SRM Finance keeps running: click its Dock icon to bring it back, ⌘Q quits."></button><button class="m" data-act="win" data-w="min" aria-label="Minimize"></button><button class="f" data-act="win" data-w="full" aria-label="Full screen"></button></div>'}
    <button class="brand" data-view="bot"><span class="orb"></span><b>SRM Finance</b><sup>${VER}</sup></button>
    ${phone ? '' : `<span class="mkt${S.market.open ? ' open' : ''}" title="${esc(S.market.text || '')}"><i></i><span class="mt">${(t => { const k = t.indexOf(' · '); return k > 0 ? esc(t.slice(0, k)) + `<span class="mx">${esc(t.slice(k))}</span>` : esc(t); })(shortMkt(S.market.text))}</span></span>`}</div>
    <nav class="nav" id="nav" aria-label="Sections">${nav}<span class="pill" aria-hidden="true"></span></nav>
    <div class="bar-r ct-drag">
      ${phone ? `<button class="chip" data-act="check" id="fresh">${esc(fresh())}</button>` : `<button class="ibtn" data-act="search" title="Search any stock (⌘K)">${ICON.search}<span class="lbl">Search</span><kbd>⌘K</kbd></button>
      <button class="ibtn tm" id="rescan" data-act="rescan" title="Press to check everything again now. The app also checks by itself every weekday at ${esc((S.bot && S.bot.scan_times) || '9:45 AM, 12 PM and 4:15 PM')}."><i></i><em>Updated&nbsp;</em><span>${esc(freshT())}</span></button>
      ${fbBtn()}<button class="ibtn" data-act="settings" aria-label="Settings">${ICON.gear}</button>`}
    </div></header>
  <main id="view"></main><nav class="tabs" aria-label="Sections">${tabs}</nav><div id="layer"></div>`;
}
function freshT() { return fresh().replace(/^Updated /, ''); }
function fresh() {
  const t = Date.parse(S.checked_at || S.made); if (!isFinite(t)) return '';
  const d = new Date(t), tm = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  return 'Updated ' + (new Date().toDateString() === d.toDateString() ? tm : `${DOW[d.getDay()]} ${tm}`);
}
/* How fresh the numbers are, said out loud. Holdings and cash come from Schwab (through Yahoo, which copies Schwab about
   once a day); the Mac app reads that about hourly. Prices come from the three daily scans, and on the Mac from a live
   check every 5 minutes while the market is open (CT_live below). A sync that stopped working shows as a warning here
   instead of the numbers quietly going old. */
function whenT(iso) {
  const t = new Date(iso); if (isNaN(t)) return '';
  const tm = t.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }), now = new Date(), y = new Date(now); y.setDate(now.getDate() - 1);
  if (now.toDateString() === t.toDateString()) return tm;
  if (y.toDateString() === t.toDateString()) return 'yesterday ' + tm;
  return `${DOW[t.getDay()]} ${MON[t.getMonth()]} ${t.getDate()}, ${tm}`;
}
function freshLine(st, opt) {
  st = st || S; opt = opt || {};
  const sy = st.sync || {}, px = st.live_at || st.checked_at || st.made, live = !!st.live_at;
  const ref = opt.phone ? Date.parse(st.made) : Date.now(), last = Date.parse(sy.last);
  const old = sy.connected && isFinite(last) && isFinite(ref) && ref - last > 26 * 3600e3;
  const fix = opt.phone ? ' Open the app on the Mac to fix it.' : ' <button class="fl-fix" data-act="settings">Fix it in Settings</button>';
  const prices = px ? `<span class="fl-p${live ? ' live' : ''}">${live ? '<i></i>' : ''}Prices as of ${esc(whenT(px))}</span>` : '';
  let own, warn = false;
  if (!sy.connected) own = '<span>Holdings and cash are what’s been logged in the app (Schwab isn’t linked).</span>';
  else if (sy.error) { warn = true; own = `<span><b>⚠ The Schwab sync isn’t working</b> (${esc(sy.error)}). Holdings and cash are from ${esc(whenT(sy.last) || 'the last time it worked')}.${fix}</span>`; }
  else if (old) { warn = true; own = `<span><b>⚠ Holdings and cash haven’t been checked against Schwab since ${esc(whenT(sy.last))}.</b>${opt.phone ? ' The Mac app does that while it’s open.' : ''}</span>`; }
  else own = `<span title="Schwab’s numbers reach the app through Yahoo, which copies Schwab about once a day. A sale by a stop and Schwab’s fill emails show up sooner.">Holdings and cash match Schwab as of ${esc(whenT(sy.last) || '–')}</span>`;
  return `<p class="freshline${warn ? ' warn' : ''}" id="freshline">${own}${prices}${awLine(st, opt)}</p>`;
}
function applyLive(d) {
  if (!d || !S) return false;
  if (d.sync) S.sync = d.sync;
  if (d.awake !== undefined && !phone) S.awake = d.awake;  // 2.0: keep-awake, for Today's "this Mac was asleep" note
  const at = Date.parse(d.at), base = Date.parse(S.checked_at || S.made);
  if (!d.px || !isFinite(at) || (isFinite(base) && at <= base)) return false;  // the page's own scan is newer
  const ps = (S.positions || []).filter(p => !p.error), sum = () => ps.reduce((t, p) => t + (p.value || 0), 0), before = sum();
  let moved = false;
  ps.forEach(p => {
    const q = d.px[p.ticker]; if (!q || !isNum(q.p) || !isNum(+p.shares)) return;
    if (p.price !== q.p) moved = true;
    p.price = q.p; if (isNum(q.d)) p.day = q.d;
    p.value = +(p.shares * q.p).toFixed(2);
    if (isNum(p.buy_price) && p.buy_price) { p.gain = q.p / p.buy_price - 1; p.gain_usd = +((q.p - p.buy_price) * p.shares).toFixed(2); }
    const g = p.range; if (g && isNum(g.lo) && isNum(g.hi) && g.hi !== g.lo) g.at = Math.max(0, Math.min(1, (q.p - g.lo) / (g.hi - g.lo)));
  });
  const a = S.account, dl = sum() - before;
  if (a && moved && isNum(a.total)) {
    a.invested = +((a.invested || 0) + dl).toFixed(2); a.total = +(a.total + dl).toFixed(2);
    if (isNum(a.day)) { a.day = +(a.day + dl).toFixed(2); const prev = a.total - a.day; if (prev > 0) a.day_pct = a.day / prev; }
  }
  S.live_at = d.at;
  return moved;
}
let pillRO = null;
function render() {
  root.innerHTML = shell();
  draw();
  if (window.ResizeObserver) { if (pillRO) pillRO.disconnect(); pillRO = new ResizeObserver(() => movePill()); const nv = $('#nav'); if (nv) pillRO.observe(nv); }
}
function draw(keepScroll, still) {
  ui.view = ALIAS[ui.view] || ui.view;
  if (ui.view === 'stock' && !ui.stock) ui.view = 'bot';
  if (ui.view === 'chat' && phone) ui.view = 'bot';
  const v = { bot: viewBot, positions: viewPositions, firm: viewFirm, stock: viewStock, chat: viewChat }[ui.view] || viewBot;
  fzStyle();
  $('#view').innerHTML = `<div class="view${still ? ' still' : ''}">${v()}${OPT.extras ? OPT.extras(ui.view) : ''}</div>`;
  document.body.classList.toggle('v-firm', ui.view === 'firm');  // v8: the office may use more of a wide screen
  document.body.classList.toggle('v-chat', ui.view === 'chat');
  mountCharts($('#view'));
  if (ui.view === 'firm') firmMount($('#view'), S, { phone });
  if (ui.view === 'chat') chMount();
  $$('[data-view]', root).forEach(b => { const on = b.dataset.view === (ui.view === 'stock' ? ui.prev || 'bot' : ui.view) && !b.classList.contains('brand');
    b.classList.toggle('on', on); if (b.closest('.nav, .tabs')) { if (on) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current'); } });
  movePill();
  if (!keepScroll) window.scrollTo(0, 0);
  try { if (ui.view !== 'stock') sessionStorage.setItem('ct2-view', ui.view); } catch (e) { /* private mode */ }
}
function movePill() {
  const nav = $('#nav'); if (!nav) return;
  const on = $('button.on', nav), pill = $('.pill', nav);
  if (on && pill) { pill.style.left = on.offsetLeft + 'px'; pill.style.width = on.offsetWidth + 'px'; }
}

const VWORD = { Buy: 'v-buy', Sell: 'v-sell', Trim: 'v-sell', Watch: 'v-decide', Wait: 'v-decide', Avoid: 'v-sell', Hold: 'v-hold', Keep: 'v-hold', 'Your Hold': 'v-decide', 'Re-check': 'v-decide', Skip: 'v-skip', Selling: 'v-skip' };
const vword = (v, big) => v ? `<span class="vword ${VWORD[v] || 'v-skip'}${big ? ' big' : ''}">${esc(v === 'Re-check' ? 'Decide' : v === 'Your Hold' ? 'Hold' : v)}</span>` : '';
const shortMkt = t => String(t || '').replace('Market closed for the day · opens ', 'Closed · opens ').replace('Market open · closes at ', 'Open · closes ').replace('Market closed · opens ', 'Closed · opens ')
  .replace(/^Market (\w)/, (m, c) => c.toUpperCase()).replace(' at ', ' ');  // 2.0: "Closed for the weekend · …" too (the dot says it's the market; the tooltip has the whole line)


/* ---------------- V2.2 helpers (Mac session) ---------------- */
const GATE = () => (S.bot && S.bot.gate) || 80;
const AIV = { buy: ['Buy', 'v-buy'], wait: ['Wait', 'v-decide'], avoid: ['Avoid', 'v-sell'], keep: ['Keep', 'v-hold'], watch: ['Watch', 'v-decide'], sell: ['Sell', 'v-sell'] };
const aiWord = v => (AIV[v] || [cap(v || ''), 'v-skip']);
const first = s => { const m = String(s || '').match(/^.*?[.!?](\s|$)/); return (m ? m[0] : String(s || '')).trim(); };
// v5: Sam doesn't weigh odds: confidence changes ("Conviction 66 → 62", "sure 53 → 66") and base-rate odds stay out of his screens
const noOdds = t => String(t || '').split(/;\s*/).filter(x => !/\b(conviction|sure|confidence)\b[^;]*\d/i.test(x)).join('; ').replace(/^\s*;\s*/, '');
const isOdds = t => /\d+%\s*(sure|of the time)|\bbeat the S&P \d+%/i.test(String(t || ''));
const bigMoney = v => !isNum(v) ? '–' : Math.abs(v) >= 1e12 ? '$' + (v / 1e12).toFixed(2) + 'T' : Math.abs(v) >= 1e9 ? '$' + (v / 1e9).toFixed(1) + 'B'
  : Math.abs(v) >= 1e6 ? '$' + (v / 1e6).toFixed(0) + 'M' : money(v);
const SYS = [['momentum', 'Momentum', 'how much it has climbed in 3 and 6 months'], ['trend', 'Trend', 'above its 50- and 200-day averages, near its high'],
  ['business', 'Business', 'sales and earnings growth, margins, debt'], ['value', 'Value', 'what you pay for its earnings, room to targets'],
  ['analysts', 'Analysts', 'Wall Street ratings and price targets'], ['steady', 'Steadiness', 'smaller swings and drops rank higher'],
  ['claude', 'Research desk', 'how strongly the research desk backs it']];
function confMeter(c, big) {
  if (!isNum(c)) return '';
  const g = GATE(), ok = c >= g;
  return `<div class="cm${ok ? ' ok' : ''}${big ? ' big' : ''}"><div class="cm-top"><b>${c}%</b><span>${ok ? 'sure: enough to buy' : `sure · buys at ${g}%+`}</span></div>
    <div class="cm-bar"><i style="width:${Math.max(2, c)}%"></i><s style="left:${g}%"></s></div></div>`;
}
function srcLink(x) {
  const u = String((x && x.url) || '');
  if (!/^https?:\/\//i.test(u)) return '';
  let host = ''; try { host = new URL(u).hostname.replace(/^www\./, ''); } catch (e) { return ''; }
  const label = esc((x.title || host).slice(0, 90));
  return api() ? `<button class="src" data-act="link" data-u="${esc(u)}"><b>${label}</b><span>${esc(host)}</span></button>`
    : `<a class="src" href="${esc(u)}" target="_blank" rel="noopener noreferrer"><b>${label}</b><span>${esc(host)}</span></a>`;
}
function aiMeta(ai) {
  const bits = [{ deep: 'Deep research', standard: 'Standard research', check: 'Owned-stock check' }[ai.depth] || 'Research'];
  if (ai.searches) bits.push(`${ai.searches} web search${ai.searches === 1 ? '' : 'es'}`);
  if ((ai.sources || []).length) bits.push(`${ai.sources.length} sources`);
  if (ai.seconds) bits.push(ai.seconds >= 90 ? `${Math.round(ai.seconds / 60)} min` : `${ai.seconds}s`);
  if (ai.at) bits.push(hm(ai.at));
  return bits.join(' · ');
}

/* the bot's next buy, or the closest one when nothing is sure enough */
function nextBuy() {
  const R = (S.radar || []).filter(x => x.verdict), top = R.find(x => x.verdict === 'Buy');
  const best = top || R.slice().sort((x, y) => (y.confidence || 0) - (x.confidence || 0))[0];
  if (!best) return '';
  const size = S.bot && S.bot.size_goal, cash = S.account.cash, need = top && size && cash < size ? size - cash : 0, ai = best.ai || {};
  const when = !top ? '' : top.queued ? 'In your orders now' : need ? `Buys ~${money(size)}: needs ${money(need)} more cash` : `Buys ~${money(size)} at the next check`;
  return `<section class="b2-next card"><div class="nb-l">
      <p class="eyebrow${top ? ' live' : ''}">${top ? '<i></i>The bot’s next buy' : `Nothing clears ${GATE()}% today · the closest`}</p>
      <button class="nb-t" data-act="stock" data-t="${esc(best.ticker)}"><b>${esc(best.ticker)}</b><span>${esc(best.name)}</span></button>
      <p class="call">${esc(best.call || '')}</p>
      ${confMeter(best.confidence)}
      ${ai.summary ? `<div class="nb-ai"><span class="aib">Firm</span><p>${esc(ai.summary)}</p></div>`
        : best.ai_waiting ? '<div class="nb-ai"><span class="aib">Firm</span><p class="dim">Researching it after the scan…</p></div>' : ''}
      <div class="meta">${when ? `<span class="chip go"><i></i>${esc(when)}</span>` : ''}<span class="tag hz-${best.mode}">${HZ[best.mode] || ''}</span></div></div>
    <div class="nb-r">${(best.spark || []).length > 20 ? spark(best.spark, { h: 110 }) : ''}
      <button class="btn quiet" data-act="stock" data-t="${esc(best.ticker)}">Everything the bot checked ›</button></div></section>`;
}
/* what Claude researched today */
function deskCard() {
  const C = S.claude || {};
  if (C.available === false && !C.today) return '';
  const rows = [...(S.radar || []).filter(x => x.ai).map(x => ({ t: x.ticker, ai: x.ai, conf: x.confidence })),
    ...(S.positions || []).filter(p => p.ai).map(p => ({ t: p.ticker, ai: p.ai, own: true }))];
  const rank = { deep: 0, standard: 1, check: 2 };
  rows.sort((a, b) => (rank[a.ai.depth] ?? 3) - (rank[b.ai.depth] ?? 3) || String(b.ai.at).localeCompare(String(a.ai.at)));
  const head = C.running ? `<span class="live"><i></i></span>The research desk is researching ${esc((C.doing || []).join(', ') || C.step || '')}…`
    : `${C.today || 0} researched today${C.searches ? ` · ${C.searches} web searches` : ''}`;
  const list = rows.slice(0, 9).map(r => {
    const w = aiWord(r.ai.verdict);
    return `<button class="dk" data-act="stock" data-t="${esc(r.t)}"><b>${esc(r.t)}</b><span class="vword ${w[1]}">${esc(w[0])}</span>
      <span class="tag ${r.ai.depth === 'deep' ? 't-go' : 't-mut'}">${esc(r.ai.depth === 'deep' ? 'Deep' : r.own ? 'You own it' : 'Standard')}</span>
      <p>${esc(first(r.ai.summary))}</p></button>`;
  }).join('');
  return `<section class="b2-desk card panel"><h2>Research desk <span>${head}</span></h2>
    ${list ? `<div class="dks">${list}</div>` : '<p class="dim" style="margin:0;font-size:13.5px">The research desk digs into the firm’s picks and what you own after each scan: results, analysts, news, insiders and risks. The #1 pick gets about 5× the research.</p>'}
    ${C.error ? `<p class="dim" style="font-size:12.5px;margin:10px 0 0">Last run: ${esc(C.error)}</p>` : ''}</section>`;
}
/* v1.0.1: the orders the owner answered "not now" or "no" to, and the ones waiting on money: listed under Orders with
   what was said, when each comes back and a way to bring it back now. (The card that showed them was lost in v4, so an
   answered order just vanished.) */
function heldCard() {
  const held = S.snoozed || [];
  if (!held.length) return '';
  const cond = x => x.after_sale ? 'Comes back after your next sale' : x.need ? `Comes back when your cash reaches ${money(x.need)}` : x.researching ? 'Comes back when the research desk’s report is in' : x.until ? `Comes back ${fmtD(x.until)}` : x.thinking ? 'The PM is reading your reply…' : '';
  return `<section class="b2-held card panel"><h2>Set aside <span>${held.length === 1 ? 'one order, from what you told the firm' : held.length + ' orders, from what you told the firm'}</span></h2>
    ${held.map(x => `<div class="mem"><div><b>${esc(x.title)}</b><p>${esc(x.why || x.said || '')}</p><small>${esc(cond(x))}</small></div>
      ${phone || x.yours === false ? '' : `<button class="link" data-act="back" data-id="${esc(x.id)}">Bring it back</button>`}</div>`).join('')}</section>`;
}
/* what the bot is holding for you and what it learned from you */
function memoryCard() {
  const held = S.snoozed || [], fromYou = ['sale_to_core', 'cash_first', 'smaller', 'steady', 'earnings', 'order'];
  const L = (S.lessons || []).filter(x => fromYou.includes(x.key)).slice(0, 4);
  const notes = (S.memory || []).filter(x => x.lesson && !x.prefer).slice(0, 2);
  if (!held.length && !L.length && !notes.length) return '';
  const cond = x => x.after_sale ? 'Comes back after your next sale' : x.need ? `Comes back when your cash reaches ${money(x.need)}` : x.researching ? 'Comes back when the research desk’s report is in' : x.until ? `Comes back ${fmtD(x.until)}` : x.thinking ? 'The PM is reading your reply…' : '';
  return `<section class="b2-mem card panel"><h2>The bot’s memory <span>from what you told it</span></h2>
    ${held.map(x => `<div class="mem"><div><b>${esc(x.title)}</b><p>${esc(x.said || x.why || '')}</p><small>${esc(cond(x))}</small></div>
      ${phone ? '' : `<button class="link" data-act="back" data-id="${esc(x.id)}">Bring it back</button>`}</div>`).join('')}
    ${L.length || notes.length ? `<ul class="mem-l">${L.map(x => `<li><b>${esc(x.title)}</b><span>${esc(x.applied || x.text || '')}</span></li>`).join('')}
      ${notes.map(x => `<li><b>Noted</b><span>${esc(x.lesson)}</span></li>`).join('')}</ul>` : ''}</section>`;
}

/* ---------------- v3/v4: Claude's briefing, Ideas, Brain ---------------- */
const CL = () => S.analyst || {};
const byClaude = () => !!CL().has;
const pctN = v => isNum(v) ? (v >= 0 ? '+' : MINUS) + Math.abs(v).toFixed(1) + '%' : '–';
const VERD = { works: ['t-go', 'Works'], maybe: ['t-warn', 'Maybe'], "doesn't work": ['t-stop', 'Doesn’t work'], 'too few trades': ['t-mut', 'Too few trades'] };
const STAT = { active: ['t-go', 'Active'], testing: ['t-warn', 'Testing'], retired: ['t-mut', 'Retired'] };
function briefCard() {
  const B = CL();
  if (B.running && !B.has) return `<section class="card panel brief b2-brief"><h2><span class="live"><i></i></span>The PM is writing your briefing…</h2>
    <p class="dim">It reads everything the app gathered, checks the news, then decides. About 5 to 15 minutes; this page updates by itself.</p></section>`;
  if (!B.at) return '';
  const src = (B.sources || []).slice(0, 6).map(srcLink).join('');
  const btn = phone ? '' : `<button class="btn quiet" data-act="brief"${B.running ? ' disabled' : ''}>${B.running ? 'The PM is writing a new one…' : 'Ask for a fresh briefing'}</button>`;
  return `<section class="card panel brief b2-brief"><h2><span class="aib">Firm</span>The market today <span>${esc(B.label || 'Briefing')} · ${esc(hm(B.at))}${isNum(B.searches) ? ` · ${B.searches} web searches` : ''}${B.stale ? ' · a few days old' : ''}</span></h2>
    ${B.market ? `<p class="br-mkt">${esc(B.market)}</p>` : ''}
    ${B.error ? `<p class="br-err">${esc(B.error)}</p>` : ''}
    ${(B.rulings || []).length ? `<h4 class="br-h4">Where the desks disagreed, and what the PM decided</h4><ul class="br-rul">${B.rulings.map(x => `<li><b>${esc(x.question)}</b><span class="d">${esc(x.decision)}</span><span>${esc(x.why)}</span></li>`).join('')}</ul>
      <button class="link br-firm" data-view="firm">Read the whole meeting on the Firm tab ›</button>` : ''}
    ${src ? `<h4 class="br-h4">What the PM read</h4><div class="srcs">${src}</div>` : ''}<div class="br-acts">${btn}</div></section>`;
}
function askCard() {
  if (phone) return '';
  const rec = (CHT.list || []).slice(0, 3);
  return `<section class="card panel ask b2-ask"><h2><span class="aib">Firm</span>Talk to the Firm <span>the PM knows your whole account</span></h2>
    <div class="ask-row"><textarea id="askq" rows="2" aria-label="Message the PM" placeholder="Ask anything, or tell the PM how you want your money run…"></textarea>
    <button class="btn go" data-act="ask">Send</button></div>
    <div class="ask-more"><button class="btn quiet" data-act="chcallnew">${CH_ICON.call}Call the PM</button><button class="btn quiet" data-act="chfilesnew">${CH_ICON.clip}Give it a file</button><button class="link" data-act="chgo">Open the Chat ›</button></div>
    ${rec.length ? `<div class="ask-rec"><span class="eyebrow">Recent</span>${rec.map(t => `<button class="ask-t" data-act="chopen" data-id="${esc(t.id)}">${t.pending ? '<i class="ch-dot" aria-label="answering"></i>' : ''}<b>${esc(t.title)}</b><span>${esc(t.name || chName(t.who))} · ${esc(hm(t.at))}</span></button>`).join('')}</div>` : ''}</section>`;
}
function brainMini() {
  const B = CL(), L = B.lessons || [], act = (B.strategies || []).filter(x => x.status === 'active'), rv = B.review;
  if (!L.length && !act.length) return '';
  return `<section class="card panel b2-brainmini"><h2>The firm’s brain <button class="link" data-view="brain">Open ›</button></h2>
    <div class="bm-n"><div><b>${L.length}</b><span>lessons</span></div><div><b>${act.length}</b><span>in use</span></div><div><b>${(B.strategies || []).length}</b><span>tested</span></div></div>
    ${L.slice(0, 2).map(x => `<p class="bm-l">${esc(x.text)}</p>`).join('')}
    <p class="dim bm-f">${rv ? `Last review ${esc(fmtD(rv.at))} · next one Friday after the close` : 'First weekly review: Friday after the close'}</p></section>`;
}

/* Ideas */
function sparkOf(t) {
  const has = v => (v || []).filter(isNum).length > 5;
  const p = (S.positions || []).find(x => x.ticker === t); if (p && has(p.spark)) return p.spark;
  const r = (S.radar || []).find(x => x.ticker === t); if (r && has(r.spark)) return r.spark;
  if (has((S.sparks || {})[t])) return S.sparks[t];
  for (const x of ((S.analyst || {}).strategies || [])) for (const pk of (x.picks || [])) if (pk.ticker === t && has(pk.spark)) return pk.spark;
  return null;
}
function idRow(k, t, body, right, tags) {
  return `<button class="pk-row" data-act="stock" data-t="${esc(t)}"><span class="n">${String(k + 1).padStart(2, '0')}</span>
    <div><div class="t"><b>${esc(t)}</b>${tags || ''}</div>${body}</div><div class="px id-px">${sparkOf(t) ? `<span class="id-sp">${spark(sparkOf(t), { h: 34 })}</span>` : ''}<span>${right || ''}</span></div></button>`;
}
function aiTagFor(t) {
  const n = (S.radar || []).find(x => x.ticker === t && x.ai) || ((S.notes || {})[t] && { ai: S.notes[t].ai });
  if (!n || !n.ai) return '';
  const w = aiWord(n.ai.verdict);
  return `<span class="vword ${w[1]}" title="The research desk’s view">Research: ${esc(w[0])}</span>`;
}
function viewIdeas() {
  const W = CL().watchlist || [], strats = (CL().strategies || []).filter(x => x.status === 'active');
  const watch = W.length ? `<section class="id-sec"><div class="sec-h"><h2>The firm is watching</h2><span>it buys one of these when its “buy if” comes true</span></div>
    <div class="card pk-list">${W.map((w, k) => { const sp = sparkOf(w.ticker), last = sp ? sp.filter(isNum).slice(-1)[0] : null;
      return idRow(k, w.ticker, `<p>${esc(w.why)}</p><p class="buyif"><b>Buys if</b> ${esc(w.buy_if)}</p>`, isNum(last) ? money(last, true) : '', aiTagFor(w.ticker)); }).join('')}</div></section>`
    : '<div class="card empty">The watchlist fills in with the PM’s next briefing.</div>';
  const lab = strats.map(x => `<section class="id-sec"><div class="sec-h"><h2>${esc(x.name)}</h2><span class="tag t-go">Active strategy</span>
      <span>${isNum(x.avg_vs_spy) ? `backtest: ${pct(x.avg_vs_spy)} a trade vs the S&amp;P` : ''}${isNum(x.beat_years) ? ` · beat it ${x.beat_years} of ${x.n_years} years` : ''} · what it would buy today</span></div>
    <div class="card pk-list">${(x.picks || []).map((p, k) => idRow(k, p.ticker, `<p>${esc(p.sector || '')} · this month ${pctN(p.month_pct)} · past year ${pctN(p.year_pct)}</p>`,
      money(p.price, true), aiTagFor(p.ticker))).join('') || '<p class="dim" style="padding:16px 20px;margin:0">No stock passes it today.</p>'}</div></section>`).join('');
  const seen = new Set(W.map(w => w.ticker));
  const R = (S.radar || []).filter(x => x.ai && !seen.has(x.ticker) && seen.add(x.ticker));
  const say = t => { const a = first(t); return a.split(/\s+/).length > 3 ? a : (String(t || '').match(/^(.*?[.!?]\s+.*?[.!?])(\s|$)/) || [0, t])[1]; };
  const researched = R.length ? `<section class="id-sec"><div class="sec-h"><h2>Also researched</h2><span>stocks from the scans the research desk looked into</span></div>
    <div class="card pk-list">${R.map((x, k) => idRow(k, x.ticker, `<p>${esc(say(x.ai.summary))}</p>`, money(x.price, true), aiTagFor(x.ticker))).join('')}</div></section>` : '';
  return `<div class="pk"><div class="sec-h" style="margin:0"><h2>Ideas</h2><span>where the firm’s next buys come from. The PM picks; you OK the order on Today.</span></div>
    ${watch}${lab}${researched}<p class="foot">Search any stock with ⌘K and the research desk looks into it.</p></div>`;
}

/* ---------------- v4.1: the visual Brain (the phone app uses it too: CT.brain) ----------------
   A living map of Claude's mind (Claude in the middle; its playbook, Strategy Lab, track record, your stocks and what it
   knows about you around it; hover to read, click to open), a bubble chart of the Strategy Lab, a visual track record,
   the playbook as tiles and the week's review in two sentences. It brings its own styles, so it looks the same in the
   Mac app and in the phone app's simple view (where ct.css is off). */
const BZ = { sel: 'core', lab: null, tile: null, rv: false, trait: null, calls: false };
const BZC = { core: '#c3b4ff', lessons: '#a38cff', lab: '#3ff2a3', calls: '#56cbff', stocks: '#ffb454', you: '#ff7eb6' };
const TOPC = { earnings: '#ffb454', timing: '#56cbff', risk: '#ff5f6e', size: '#a38cff', diversify: '#3ff2a3', cash: '#7ee0b0',
  strategy: '#c3b4ff', research: '#56cbff', sam: '#ff7eb6' };
const TOPN = { earnings: 'Earnings', timing: 'Timing', risk: 'Risk', size: 'Position size', diversify: 'Spread out', cash: 'Cash',
  strategy: 'Strategy', research: 'Research', sam: 'About you' };
const TOPI = {
  earnings: '<path d="M4 6h16v14H4zM4 10h16M8 3v4M16 3v4"/>',
  timing: '<circle cx="12" cy="12" r="8"/><path d="M12 8v4l3 2"/>',
  risk: '<path d="M12 3l7 3v5c0 5-3 8-7 10-4-2-7-5-7-10V6z"/>',
  size: '<path d="M12 3v9h9a9 9 0 1 1-9-9z"/>',
  diversify: '<rect x="4" y="4" width="7" height="7" rx="1.5"/><rect x="13" y="4" width="7" height="7" rx="1.5"/><rect x="4" y="13" width="7" height="7" rx="1.5"/><rect x="13" y="13" width="7" height="7" rx="1.5"/>',
  cash: '<path d="M12 3v18M16 7.5c-.8-1.2-2.3-2-4-2-2.2 0-4 1.2-4 3s1.8 2.6 4 3 4 1.2 4 3-1.8 3-4 3c-1.8 0-3.4-.9-4.2-2.2"/>',
  strategy: '<path d="M9 3h6M10 3v6l-5 9a2 2 0 0 0 1.8 3h10.4a2 2 0 0 0 1.8-3l-5-9V3"/><path d="M7 15h10"/>',
  research: '<circle cx="11" cy="11" r="6.5"/><path d="M20 20l-4.3-4.3"/>',
  sam: '<circle cx="12" cy="8" r="4"/><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6"/>',
};
const bzIcon = (k, size) => `<svg viewBox="0 0 24 24" width="${size || 18}" height="${size || 18}" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${TOPI[k] || TOPI.strategy}</svg>`;
const bzPct = (v, d = 1) => isNum(v) ? (v >= 0 ? '+' : MINUS) + (Math.abs(v) * 100).toFixed(d) + '%' : '–';
const bzMD = s => { if (!s) return ''; const d = D(s); return `${MON[d.getMonth()]} ${d.getDate()}`; };
const foldText = (t, n, label, cls) => { const [a, b] = bzSentences(t, n || 2);
  return `<p class="${cls || ''}">${esc(a)}</p>${b ? `<details class="rdfold"><summary>${esc(label || 'Read more')}</summary><p class="${cls || ''}">${esc(b)}</p></details>` : ''}`; };
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
const bzSentences = (t, n) => { const m = splitSentences(t); return [m.slice(0, n).join(' '), m.slice(n).join(' ')]; };
function bzStratColor(x) { return x.status === 'active' ? '#3ff2a3' : x.status === 'testing' ? '#ffc65a' : '#8b6b75'; }
const bzRight = x => !isNum(x.vs_spy_since_pct) ? undefined : 'right' in x ? x.right : (x.vs_spy_since_pct * (x.call === 'buy' ? 1 : -1) > 0);  // true, false, null = even, undefined = not graded yet
function bzCallColor(x) { const r = bzRight(x); return r === undefined ? '#56cbff' : r === null ? '#c5cad6' : r ? '#3ff2a3' : '#ff5f6e'; }

function bzGraph(st) {
  const A = st.analyst || {}, L = A.lessons || [], St = A.strategies || [], C = A.calls || [];
  const P = (st.positions || []).filter(p => !p.error);
  const T = (A.traits && A.traits.length ? A.traits : (A.about_sam || []).map(x => ({ label: '', text: x })));
  const nodes = [{ id: 'core', kind: 'core', group: 'core', label: 'The firm', r: 22 }], links = [];
  const hubs = [['h-lessons', 'Playbook', 'lessons', L.length], ['h-lab', 'Strategy Lab', 'lab', St.length], ['h-calls', 'Track record', 'calls', C.length],
    ['h-stocks', 'Your stocks', 'stocks', P.length], ['h-you', 'About you', 'you', T.length]];
  hubs.forEach(([id, label, g, n]) => { nodes.push({ id, kind: 'hub', group: g, label, n, r: 12 }); links.push(['core', id, 1]); });
  L.forEach((x, i) => { nodes.push({ id: 'l' + i, kind: 'lesson', group: 'lessons', label: x.title || first(x.text), data: x, r: 6, c: TOPC[x.topic] }); links.push(['h-lessons', 'l' + i, 0]); });
  St.forEach((x, i) => { nodes.push({ id: 's' + i, kind: 'strategy', group: 'lab', label: x.name, data: x, r: 5 + Math.min(7, Math.sqrt((x.trades || 0) / 80)), c: bzStratColor(x) }); links.push(['h-lab', 's' + i, 0]); });
  C.forEach((x, i) => { nodes.push({ id: 'c' + i, kind: 'call', group: 'calls', label: `${cap(x.call)} ${x.ticker}`, data: x, r: 6, c: bzCallColor(x) }); links.push(['h-calls', 'c' + i, 0]); });
  const tot = P.reduce((s, p) => s + (p.value || 0), 0) || 1;
  P.forEach((x, i) => { nodes.push({ id: 'p' + i, kind: 'stock', group: 'stocks', label: x.ticker, data: x, r: 5 + 11 * Math.sqrt((x.value || 0) / tot), c: ['Sell', 'Trim'].includes(x.verdict) ? '#ff5f6e' : '#ffb454', tag: true }); links.push(['h-stocks', 'p' + i, 0]); });
  T.forEach((x, i) => { nodes.push({ id: 't' + i, kind: 'trait', group: 'you', label: x.label || first(x.text), data: x, r: 5 }); links.push(['h-you', 't' + i, 0]); });
  P.forEach((p, j) => {  // threads: a lesson learned from a stock you own; a call on a stock you own
    const re = new RegExp('\\b' + p.ticker.replace(/[^A-Z0-9]/g, '') + '\\b');
    L.forEach((x, i) => { if (re.test((x.text || '') + ' ' + (x.why || ''))) links.push(['l' + i, 'p' + j, 2]); });
    C.forEach((x, i) => { if (x.ticker === p.ticker) links.push(['c' + i, 'p' + j, 2]); });
  });
  const by = {}; nodes.forEach(n => { by[n.id] = n; });
  return { nodes, links, by };
}
function bzLayout(g, w, h) {
  const cx = w / 2, cy = h / 2 + 4, small = w < 560;
  const rx = Math.min(w * (small ? 0.27 : 0.30), 520), ry = Math.min(h * 0.29, 175), grow = Math.max(1, Math.min(1.7, w / 760));
  const hubs = g.nodes.filter(n => n.kind === 'hub');
  g.by.core.x = cx; g.by.core.y = cy;
  hubs.forEach((hb, k) => {
    const ang = -Math.PI / 2 + k * 2 * Math.PI / hubs.length;
    hb.a = ang; hb.x = cx + rx * Math.cos(ang); hb.y = cy + ry * Math.sin(ang);
    const kids = g.nodes.filter(n => n.kind !== 'hub' && n.kind !== 'core' && n.group === hb.group);
    const n = kids.length, rows = n > 7 ? 2 : 1, per = Math.ceil(n / rows);
    kids.forEach((kd, i) => {
      const row = rows === 2 ? i % 2 : 0, j = rows === 2 ? Math.floor(i / 2) : i;
      const spread = Math.min(Math.PI * 0.95, per * (small ? 0.32 : 0.36)), step = per > 1 ? spread / (per - 1) : 0;
      const a = ang + (j - (per - 1) / 2) * step, R = ((small ? 44 : 58) + row * (small ? 20 : 26)) * grow + kd.r;
      kd.x = Math.max(kd.r + 6, Math.min(w - kd.r - 6, hb.x + R * Math.cos(a) * 1.15));
      kd.y = Math.max(kd.r + 8, Math.min(h - kd.r - 18, hb.y + R * Math.sin(a)));
    });
  });
  const hubOf = {}; hubs.forEach(hb => { hubOf[hb.group] = hb; });
  const mov = g.nodes.filter(n => n.kind !== 'core'), bot = h - (small ? 18 : 34);
  const room = n => n.r + (n.kind === 'hub' ? 26 : n.tag ? 13 : 7);
  for (let it = 0; it < 220; it++) {
    for (let i = 0; i < mov.length; i++) for (let j = i + 1; j < mov.length; j++) {
      const A = mov[i], B = mov[j], need = room(A) + room(B);
      let dx = B.x - A.x, dy = B.y - A.y; const d = Math.hypot(dx, dy) || 0.01;
      if (d >= need) continue;
      const push = (need - d) / 2, wa = A.kind === 'hub' ? 0.15 : 1, wb = B.kind === 'hub' ? 0.15 : 1;
      dx /= d; dy /= d; A.x -= dx * push * wa; A.y -= dy * push * wa; B.x += dx * push * wb; B.y += dy * push * wb;
    }
    mov.forEach(n => {
      if (n.kind !== 'hub') {  // a soft pull back toward its hub
        const hb = hubOf[n.group], dx = n.x - hb.x, dy = n.y - hb.y, d = Math.hypot(dx, dy) || 1, pref = (small ? 46 : 62) * grow + n.r;
        const f = (d - pref) * 0.035; n.x -= dx / d * f; n.y -= dy / d * f;
      }
      const dx = n.x - cx, dy = n.y - cy, d = Math.hypot(dx, dy) || 1, keep = 60 + n.r;  // clear of Claude
      if (d < keep) { n.x = cx + dx / d * keep; n.y = cy + dy / d * keep; }
      n.x = Math.max(n.r + 10, Math.min(w - n.r - 10, n.x));
      n.y = Math.max(n.r + 10, Math.min(bot - n.r - (n.tag || n.kind === 'hub' ? 16 : 4), n.y));
    });
  }
  g.nodes.forEach((n, i) => { n.ph = i * 1.7; n.amp = n.kind === 'core' ? 0 : n.kind === 'hub' ? 1.2 : 2.2; });
}
function bzMap(root, st, opt) {
  const cv = $('.bz-map', root); if (!cv || cv._on) return;
  cv._on = true;
  const ctx = cv.getContext('2d'), g = bzGraph(st), still = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  let W = 0, H = 0, hover = null, t0 = performance.now(), pulses = [], lastPulse = 0;
  const stars = Array.from({ length: 70 }, (_, i) => ({ x: (Math.sin(i * 91.7) + 1) / 2, y: (Math.cos(i * 37.3) + 1) / 2, r: 0.4 + ((i * 13) % 7) / 10, p: i }));
  const color = n => n.c || BZC[n.group] || '#c3b4ff';
  function size() {
    const r = cv.parentElement.getBoundingClientRect(), dpr = Math.min(2, window.devicePixelRatio || 1);
    W = Math.max(280, cv.clientWidth); H = Math.max(240, cv.clientHeight);
    cv.width = W * dpr; cv.height = H * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    bzLayout(g, W, H);
  }
  size();
  if (window.IntersectionObserver) new IntersectionObserver(es => { cv._vis = es[es.length - 1].isIntersecting; }).observe(cv);  // v5.1: off screen = paused
  const pos = (n, t) => [n.x + Math.sin(t * 0.55 + n.ph) * n.amp, n.y + Math.cos(t * 0.47 + n.ph) * n.amp];
  const linked = id => new Set(g.links.filter(l => l[0] === id || l[1] === id).flatMap(l => [l[0], l[1]]));
  function frame(now) {
    if (!cv.isConnected) return;
    if (document.hidden || cv._vis === false) { setTimeout(() => requestAnimationFrame(frame), 500); return; }
    const t = still ? 0 : (now - t0) / 1000;
    ctx.clearRect(0, 0, W, H);
    const bg = ctx.createRadialGradient(W / 2, H / 2, 10, W / 2, H / 2, Math.max(W, H) * 0.7);
    bg.addColorStop(0, 'rgba(120,90,255,.10)'); bg.addColorStop(0.5, 'rgba(63,242,163,.03)'); bg.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
    stars.forEach(s => { ctx.globalAlpha = 0.25 + 0.25 * Math.sin(t * 0.8 + s.p); ctx.fillStyle = '#cfd6ff'; ctx.beginPath(); ctx.arc(s.x * W, s.y * H, s.r, 0, 6.29); ctx.fill(); });
    ctx.globalAlpha = 1;
    const sel = g.by[BZ.sel] ? BZ.sel : 'core', hot = linked(hover || sel);
    g.links.forEach(([a, b, k]) => {
      const A = g.by[a], B = g.by[b]; if (!A || !B) return;
      const [x1, y1] = pos(A, t), [x2, y2] = pos(B, t), on = hot.has(a) && hot.has(b) && (a === (hover || sel) || b === (hover || sel));
      ctx.strokeStyle = k === 2 ? (on ? 'rgba(255,180,84,.85)' : 'rgba(255,180,84,.07)') : on ? 'rgba(210,200,255,.75)' : k === 1 ? 'rgba(195,180,255,.30)' : 'rgba(195,180,255,.13)';
      ctx.lineWidth = on ? 1.6 : k === 1 ? 1.2 : 0.8;
      ctx.setLineDash(k === 2 ? [3, 4] : []);
      ctx.beginPath(); ctx.moveTo(x1, y1);
      const mx = (x1 + x2) / 2 + (y2 - y1) * 0.12, my = (y1 + y2) / 2 - (x2 - x1) * 0.12;
      ctx.quadraticCurveTo(mx, my, x2, y2); ctx.stroke();
    });
    ctx.setLineDash([]);
    if (!still && now - lastPulse > 420) {  // signals travel out from Claude
      lastPulse = now;
      const pool = g.links.filter(l => l[2] !== 2);
      const l = pool[Math.floor(Math.random() * pool.length)];
      if (l) pulses.push({ l, s: now, d: 1100 + Math.random() * 700 });
    }
    pulses = pulses.filter(p => now - p.s < p.d);
    pulses.forEach(p => {
      const A = g.by[p.l[0]], B = g.by[p.l[1]], f = (now - p.s) / p.d;
      const [x1, y1] = pos(A, t), [x2, y2] = pos(B, t), mx = (x1 + x2) / 2 + (y2 - y1) * 0.12, my = (y1 + y2) / 2 - (x2 - x1) * 0.12;
      const x = (1 - f) * (1 - f) * x1 + 2 * (1 - f) * f * mx + f * f * x2, y = (1 - f) * (1 - f) * y1 + 2 * (1 - f) * f * my + f * f * y2;
      ctx.globalAlpha = Math.sin(f * Math.PI); ctx.fillStyle = color(B); ctx.shadowColor = color(B); ctx.shadowBlur = 10;
      ctx.beginPath(); ctx.arc(x, y, 2, 0, 6.29); ctx.fill(); ctx.shadowBlur = 0; ctx.globalAlpha = 1;
    });
    g.nodes.forEach(n => {
      const [x, y] = pos(n, t), c = color(n), focus = n.id === hover || n.id === sel, dim = (hover || sel !== 'core') && !hot.has(n.id) && n.kind !== 'core';
      let r = n.r * (focus ? 1.35 : 1);
      if (n.kind === 'core') r = n.r + Math.sin(t * 1.6) * 1.6;
      ctx.globalAlpha = dim ? 0.35 : 1;
      ctx.shadowColor = c; ctx.shadowBlur = n.kind === 'core' ? 34 : focus ? 22 : n.kind === 'hub' ? 16 : 9;
      const gr = ctx.createRadialGradient(x - r * 0.35, y - r * 0.35, 1, x, y, r);
      gr.addColorStop(0, '#ffffff'); gr.addColorStop(0.35, c); gr.addColorStop(1, n.kind === 'core' ? 'rgba(120,90,255,.9)' : c);
      ctx.fillStyle = n.kind === 'hub' ? 'rgba(14,16,24,.92)' : gr;
      ctx.beginPath(); ctx.arc(x, y, r, 0, 6.29); ctx.fill(); ctx.shadowBlur = 0;
      if (n.kind === 'hub') { ctx.strokeStyle = c; ctx.lineWidth = 2; ctx.stroke(); ctx.fillStyle = c; ctx.font = '700 10px ui-monospace,Menlo,monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(String(n.n), x, y + 0.5); }
      if (focus && n.kind !== 'core' && n.kind !== 'hub') { ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(x, y, r + 3, 0, 6.29); ctx.stroke(); }
      ctx.globalAlpha = dim ? 0.35 : 1;
      ctx.textAlign = 'center'; ctx.textBaseline = 'top';
      if (n.kind === 'core') { ctx.font = '700 13px -apple-system,system-ui,sans-serif'; ctx.fillStyle = '#fff'; ctx.fillText('The firm', x, y + r + 8); }
      else if (n.kind === 'hub') { ctx.font = '650 12px -apple-system,system-ui,sans-serif'; ctx.fillStyle = 'rgba(235,238,245,.92)'; ctx.fillText(n.label, x, y + r + 6); }
      else if (n.tag || focus) {
        ctx.font = (n.tag ? '650 10.5px ui-monospace,Menlo,monospace' : '600 11.5px -apple-system,system-ui,sans-serif');
        const txt = n.label.length > 30 ? n.label.slice(0, 29) + '…' : n.label, tw = ctx.measureText(txt).width;
        let lx = Math.max(tw / 2 + 4, Math.min(W - tw / 2 - 4, x));
        if (focus && !n.tag) { ctx.fillStyle = 'rgba(10,12,18,.85)'; ctx.fillRect(lx - tw / 2 - 6, y + r + 4, tw + 12, 18); }
        ctx.fillStyle = focus ? '#fff' : 'rgba(255,214,160,.9)'; ctx.fillText(txt, lx, y + r + (focus && !n.tag ? 7 : 4));
      }
      ctx.globalAlpha = 1;
    });
    requestAnimationFrame(frame);
  }
  function pick(ev) {
    const b = cv.getBoundingClientRect(), mx = ev.clientX - b.left, my = ev.clientY - b.top, t = still ? 0 : (performance.now() - t0) / 1000;
    let best = null, bd = 1e9;
    g.nodes.forEach(n => { const [x, y] = pos(n, t), d = Math.hypot(x - mx, y - my); if (d < n.r + 10 && d < bd) { bd = d; best = n; } });
    return best;
  }
  cv.addEventListener('mousemove', ev => { const n = pick(ev); hover = n ? n.id : null; cv.style.cursor = n ? 'pointer' : 'default'; });
  cv.addEventListener('mouseleave', () => { hover = null; });
  cv.addEventListener('click', ev => { const n = pick(ev); bzSelect(root, st, n ? n.id : 'core'); });
  if (window.ResizeObserver) { const ro = new ResizeObserver(() => { if (!cv.isConnected) { ro.disconnect(); return; } size(); }); ro.observe(cv); }
  requestAnimationFrame(frame);
}
function bzDetail(st, id) {
  const g = bzGraph(st), n = g.by[id] || g.by.core, A = st.analyst || {}, x = n.data || {};
  const dot = c => `<i class="bz-dot" style="background:${c};box-shadow:0 0 10px ${c}"></i>`;
  const kids = grp => g.nodes.filter(k => k.group === grp && k.kind !== 'hub').map(k => `<button class="bz-kid" data-bact="sel" data-id="${k.id}">${dot(k.c || BZC[grp])}<span>${esc(k.label)}</span></button>`).join('');
  if (n.kind === 'core') {
    const L = A.lessons || [], St = A.strategies || [];
    return `<div class="bz-dh">${dot(BZC.core)}<b>The firm</b><span>its memory</span></div>
      <p>Everything the firm has learned lives here. Click any dot to open it.</p>
      <div class="bz-nums"><div><b>${L.length}</b><span>lessons</span></div><div><b>${St.length}</b><span>strategies tested</span></div>
      <div><b>${St.filter(s => s.status === 'active').length}</b><span>in use</span></div><div><b>${(A.calls || []).length}</b><span>calls</span></div></div>
      <p class="bz-fine">${A.review ? `Last review ${esc(bzMD(A.review.at))} · next one Friday after the close` : 'First review: Friday after the close'}</p>`;
  }
  if (n.kind === 'hub') {
    const say = { lessons: 'The rules the PM follows in every briefing. It rewrites them every week from what happened.', lab: 'Strategies the firm invented, each tested on ~9 years of prices. Green ones are in use.',
      calls: 'Every buy and sell the firm suggested, graded against the S&P 500 after 5 days.', stocks: 'What you own. Bigger dots are bigger positions; red ones the firm would sell.',
      you: 'What the firm has noticed about how you trade.' }[n.group];
    return `<div class="bz-dh">${dot(BZC[n.group])}<b>${esc(n.label)}</b><span>${n.n}</span></div><p>${esc(say)}</p><div class="bz-kids">${kids(n.group) || '<p class="bz-fine">Nothing here yet.</p>'}</div>`;
  }
  if (n.kind === 'lesson') return `<div class="bz-dh"><span class="bz-ico" style="color:${TOPC[x.topic] || BZC.lessons}">${bzIcon(x.topic, 20)}</span><b>${esc(x.title || 'Lesson')}</b><span>${esc(TOPN[x.topic] || 'Lesson')}</span></div>
    <p class="bz-big">${esc(x.text)}</p>${x.why ? `<div class="bz-why"><small>Why the firm learned this</small><p>${esc(x.why)}</p></div>` : ''}`;
  if (n.kind === 'strategy') {
    const st2 = STAT[x.status] || ['', x.status], vd = VERD[x.verdict];
    return `<div class="bz-dh">${dot(n.c)}<b>${esc(x.name)}</b><span>${esc(st2[1])}</span></div><p>${esc(x.idea || '')}</p>
      ${bzYears(x.years)}<div class="bz-nums"><div><b class="${(x.avg_vs_spy || 0) >= 0 ? 'bz-pos' : 'bz-neg'}">${bzPct(x.avg_vs_spy)}</b><span>vs S&amp;P a trade</span></div>
      <div><b class="${(x.edge_vs_random || 0) >= 0 ? 'bz-pos' : 'bz-neg'}">${bzPct(x.edge_vs_random)}</b><span>vs random stocks</span></div><div><b>${isNum(x.trades) ? x.trades.toLocaleString() : '–'}</b><span>test trades</span></div></div>
      ${vd ? `<p class="bz-fine">Backtest: <b style="color:${n.c}">${esc(vd[1])}</b>${x.note ? ' · ' + esc(x.note) : ''}</p>` : ''}`;
  }
  if (n.kind === 'call') {
    const graded = isNum(x.vs_spy_since_pct), days = Math.min(5, x.age_days || 0);
    return `<div class="bz-dh">${dot(n.c)}<b>${esc(n.label)}</b><span>${esc(bzMD(x.date))}</span></div>
      <div class="bz-nums"><div><b>${money(+x.price_then, true)}</b><span>price then</span></div><div><b>${isNum(x.price_now) ? money(x.price_now, true) : '–'}</b><span>now</span></div>
      <div><b class="${graded && bzRight(x) != null ? (bzRight(x) ? 'bz-pos' : 'bz-neg') : ''}">${graded ? pctN(x.vs_spy_since_pct) : '…'}</b><span>vs S&amp;P since</span></div></div>
      ${graded ? '' : x.is_index ? '<p class="bz-fine">This fund is the S&amp;P 500 itself, so it can’t beat or lag it: not graded.</p>' : `<div class="bz-prog"><i style="width:${days / 5 * 100}%"></i></div><p class="bz-fine">Graded ${esc(bzMD(x.graded_on))}, once it’s 5 days old (${days} of 5 days).</p>`}
      ${x.repeats ? `<p class="bz-fine">Said again at ${x.repeats} later briefing${x.repeats === 1 ? '' : 's'}. It counts once, from ${esc(bzMD(x.date))}.</p>` : ''}`;
  }
  if (n.kind === 'stock') return `<div class="bz-dh">${dot(n.c)}<b>${esc(x.ticker)}</b><span>${esc(x.name || '')}</span></div>
    <div class="bz-call"><span class="bz-word" style="color:${n.c};border-color:${n.c}">${esc(x.verdict || 'Keep')}</span><p>${esc(x.call || '')}</p></div>
    ${(x.spark || []).length > 5 ? `<div class="bz-spark">${spark(x.spark, { h: 54 })}</div>` : ''}
    <div class="bz-nums"><div><b>${money(x.value)}</b><span>worth</span></div><div><b class="${(x.gain || 0) >= 0 ? 'bz-pos' : 'bz-neg'}">${pct(x.gain)}</b><span>since you bought</span></div><div><b>${esc(String(x.days ?? '–'))}</b><span>days held</span></div></div>`;
  if (n.kind === 'trait') return `<div class="bz-dh">${dot(BZC.you)}<b>${esc(x.label || 'About you')}</b><span>about you</span></div><p class="bz-big">${esc(x.text)}</p>`;
  return '';
}
function bzYears(years) {
  const ys = Object.keys(years || {}).sort(), v = ys.map(y => years[y]).filter(isNum);
  if (!v.length) return '';
  const w = 300, h = 88, mid = 38, bw = Math.min(22, (w - 8) / ys.length - 4), top = Math.max(0.02, ...v.map(Math.abs));
  const bars = ys.map((y, i) => {
    const x = 4 + i * ((w - 8) / ys.length) + ((w - 8) / ys.length - bw) / 2, val = years[y] || 0, bh = Math.max(1.5, Math.abs(val) / top * 30);
    return `<rect x="${x.toFixed(1)}" y="${(val >= 0 ? mid - bh : mid).toFixed(1)}" width="${bw.toFixed(1)}" height="${bh.toFixed(1)}" rx="2" fill="${val >= 0 ? '#3ff2a3' : '#ff5f6e'}" opacity=".85"><title>${y}: ${bzPct(val)} a trade vs the S&amp;P</title></rect>`
      + `<text x="${(x + bw / 2).toFixed(1)}" y="${h - 2}" text-anchor="middle">${"'" + y.slice(2)}</text>`;
  }).join('');
  return `<div class="bz-years"><small>Each year vs the S&amp;P (per trade)</small><svg viewBox="0 0 ${w} ${h}"><line x1="0" x2="${w}" y1="${mid}" y2="${mid}" stroke="rgba(255,255,255,.18)"/>${bars}</svg></div>`;
}
function bzLabChart(St, sel) {
  const W = 620, H = 330, L = 50, R = 20, T = 20, B = 44, lo = -0.012, hi = 0.032;
  const sx = v => L + (Math.max(lo, Math.min(hi, v || 0)) - lo) / (hi - lo) * (W - L - R), sy = v => T + (1 - (Math.max(lo, Math.min(hi, v || 0)) - lo) / (hi - lo)) * (H - T - B);
  const ticks = [-0.01, 0, 0.01, 0.02, 0.03];
  const grid = ticks.map(v => `<line x1="${sx(v)}" x2="${sx(v)}" y1="${T}" y2="${H - B}" class="${v ? 'g' : 'z'}"/><text x="${sx(v)}" y="${H - B + 14}" text-anchor="middle">${bzPct(v, 0)}</text>`
    + `<line x1="${L}" x2="${W - R}" y1="${sy(v)}" y2="${sy(v)}" class="${v ? 'g' : 'z'}"/><text x="${L - 6}" y="${sy(v) + 3}" text-anchor="end">${bzPct(v, 0)}</text>`).join('');
  const pts = St.map((x, i) => isNum(x.avg_vs_spy) ? { x, i, X: sx(x.edge_vs_random), Y: sy(x.avg_vs_spy), r: 8 + Math.min(12, Math.sqrt((x.trades || 0) / 30)) } : null).filter(Boolean);
  const placed = [];  // labels to the right of each bubble, nudged down until none overlap
  pts.slice().sort((a, b) => a.Y - b.Y).forEach(p => {
    p.right = p.X < W - 190; p.ly = p.Y + 4;
    for (let k = 0; k < 12 && placed.some(q => q.right === p.right && Math.abs(q.ly - p.ly) < 15 && Math.abs(q.X - p.X) < 190); k++) p.ly += 15;
    placed.push(p);
  });
  const dots = pts.map(p => {
    const x = p.x, c = bzStratColor(x), on = sel === p.i, lab = x.name.length > 32 ? x.name.slice(0, 31) + '…' : x.name;
    const lx = p.right ? p.X + p.r + 7 : p.X - p.r - 7, lead = Math.abs(p.ly - p.Y - 4) > 2 ? `<line x1="${p.X}" y1="${p.Y}" x2="${lx - (p.right ? 3 : -3)}" y2="${p.ly - 4}" stroke="${c}" stroke-opacity=".4"/>` : '';
    return `<g class="bz-b${on ? ' on' : ''}" data-bact="lab" data-i="${p.i}" tabindex="0" role="button" aria-label="${esc(x.name)}"><title>${esc(x.name)}: ${bzPct(x.avg_vs_spy)} a trade vs the S&amp;P, ${bzPct(x.edge_vs_random)} vs random stocks, ${x.trades} trades</title>
      <circle cx="${p.X}" cy="${p.Y}" r="${p.r + 9}" fill="${c}" opacity="${on ? .16 : 0}"/>${lead}<circle cx="${p.X}" cy="${p.Y}" r="${p.r}" fill="${c}" fill-opacity=".28" stroke="${c}" stroke-width="${on ? 2.6 : 1.5}"/>
      <text x="${lx}" y="${p.ly}" text-anchor="${p.right ? 'start' : 'end'}" class="lbl">${esc(lab)}</text></g>`;
  }).join('');
  return `<svg class="bz-lab" viewBox="0 0 ${W} ${H}"><rect x="${sx(0)}" y="${T}" width="${W - R - sx(0)}" height="${sy(0) - T}" fill="rgba(63,242,163,.06)"/>
    <text x="${W - R - 6}" y="${T + 14}" text-anchor="end" class="zone">Real edge</text>${grid}
    <text x="${(L + W - R) / 2}" y="${H - 6}" text-anchor="middle" class="ax">beats random stocks by (a trade) →</text>
    <text x="12" y="${(T + H - B) / 2}" text-anchor="middle" class="ax" transform="rotate(-90 12 ${(T + H - B) / 2})">beats the S&amp;P by →</text>${dots}</svg>`;
}
function bzLabPanel(St) {
  const i = BZ.lab != null ? BZ.lab : Math.max(0, St.findIndex(x => x.status === 'active')), x = St[i];
  if (!x) return '<p class="bz-fine">No strategies yet.</p>';
  const e = (x.spec || {}).exits || {}, st2 = STAT[x.status] || ['', x.status], vd = VERD[x.verdict], c = bzStratColor(x);
  return `<div class="bz-dh"><i class="bz-dot" style="background:${c};box-shadow:0 0 10px ${c}"></i><b>${esc(x.name)}</b><span>${esc(st2[1])}${x.by === 'app' ? ' · the app’s original' : ' · invented by the firm'}</span></div>
    <p>${esc(x.idea || '')}</p>${bzYears(x.years)}
    <div class="bz-nums"><div><b class="${(x.avg_vs_spy || 0) >= 0 ? 'bz-pos' : 'bz-neg'}">${bzPct(x.avg_vs_spy)}</b><span>vs S&amp;P</span></div><div><b class="${(x.recent_vs_spy || 0) >= 0 ? 'bz-pos' : 'bz-neg'}">${bzPct(x.recent_vs_spy)}</b><span>recent years</span></div>
      <div><b class="${(x.edge_vs_random || 0) >= 0 ? 'bz-pos' : 'bz-neg'}">${bzPct(x.edge_vs_random)}</b><span>vs random</span></div><div><b>${isNum(x.win_rate) ? Math.round(x.win_rate * 100) + '%' : '–'}</b><span>trades won</span></div></div>
    <p class="bz-fine">Holds ${e.hold_days || '?'} days${isNum(e.stop_loss_pct) ? ` · stop −${e.stop_loss_pct}%` : ''}${isNum(e.profit_target_pct) ? ` · target +${e.profit_target_pct}%` : ''} · ${isNum(x.trades) ? x.trades.toLocaleString() : '?'} test trades${vd ? ` · backtest: <b style="color:${c}">${esc(vd[1])}</b>` : ''}</p>
    ${x.note ? `<p class="bz-note"><span class="aib">Firm</span> ${esc(x.note)}</p>` : ''}`;
}
function bzRecord(A) {
  // Each call once (the app counts a call said again at later briefings as one, from its first day). A percentage on
  // a handful of calls would overstate it, so the ring shows the plain count until there are 10 graded.
  const C = A.calls || [], gr = C.filter(c => isNum(c.vs_spy_since_pct)), right = gr.filter(c => bzRight(c) === true).length;
  const wait = C.filter(c => !isNum(c.vs_spy_since_pct) && !c.is_index), R = 34, circ = 2 * Math.PI * R, share = gr.length ? right / gr.length : 0;
  const pctMode = gr.length >= 10;
  const ringSvg = `<svg viewBox="0 0 90 90" class="bz-ring" role="img" aria-label="${gr.length ? `${right} of ${gr.length} graded calls were right` : 'No calls graded yet'}"><circle cx="45" cy="45" r="${R}" stroke="rgba(255,255,255,.08)" stroke-width="8" fill="none"/>`
    + (gr.length ? `<circle cx="45" cy="45" r="${R}" stroke="#3ff2a3" stroke-width="8" fill="none" stroke-linecap="round" stroke-dasharray="${(share * circ).toFixed(1)} ${circ.toFixed(1)}" transform="rotate(-90 45 45)"/>` : '')
    + `<text x="45" y="44" text-anchor="middle" class="big">${pctMode ? Math.round(share * 100) + '%' : gr.length ? right + ' of ' + gr.length : '0'}</text><text x="45" y="60" text-anchor="middle" class="sm">${gr.length ? 'right' : 'graded'}</text></svg>`;
  const next = wait.map(c => c.graded_on).filter(Boolean).sort()[0];
  const sum = gr.length
    ? `${right} of ${gr.length} graded call${gr.length === 1 ? '' : 's'} ${gr.length === 1 ? 'was' : 'were'} right${wait.length ? `; ${wait.length} more ${wait.length === 1 ? 'is' : 'are'} waiting to be graded${next ? ` (next: ${bzDate(next)})` : ''}` : ''}.`
    : C.length ? `${C.length} call${C.length === 1 ? '' : 's'} so far. The first grade${next ? ` comes ${bzDate(next)}` : 's come once a call is 5 days old'}.` : '';
  const rows = C.slice(0, BZ.calls ? 24 : 7).map((c, i) => {
    const g2 = isNum(c.vs_spy_since_pct), col = c.is_index ? '#8d93a3' : bzCallColor(c), d = Math.min(5, c.age_days || 0), ok = bzRight(c);
    return `<button class="bz-callrow" data-bact="sel" data-id="c${i}"><i class="bz-dot" style="background:${col}"></i><b>${esc(cap(c.call))} ${esc(c.ticker)}</b><time>${esc(bzMD(c.date))}</time>
      ${g2 ? `<span class="bz-bar"><i style="width:${Math.min(100, Math.max(4, Math.abs(c.vs_spy_since_pct) * 15))}%;background:${col}"></i></span><em style="color:${col}">${ok === null ? 'Even' : ok ? 'Right' : 'Wrong'} · ${pctN(c.vs_spy_since_pct)} vs S&amp;P</em>`
        : c.is_index ? `<span></span><em>is the S&amp;P: not graded</em>`
        : `<span class="bz-prog"><i style="width:${d / 5 * 100}%"></i></span><em>grades ${esc(bzMD(c.graded_on))}</em>`}</button>`;
  }).join('');
  const more = C.length > 7 ? `<button class="bz-more" data-bact="calls">${BZ.calls ? 'Show fewer' : `Show all ${C.length} calls`}</button>` : '';
  return `<div class="bz-rec">${ringSvg}<div><p class="bz-recsum">${esc(sum || 'The firm’s calls show up here and get graded once they’re 5 days old.')}</p>
    <p class="bz-fine" style="margin:0 0 8px!important">How a call is graded: once it’s 5 days old, the stock’s move since the call is compared with the S&amp;P 500’s. A buy is right if the stock did better; a sell or trim is right if it did worse; within 0.05% is even. A call said again at later briefings counts once, from its first day.</p>
    ${rows}${more}</div></div>`;
}
function bzTiles(L) {
  return L.map((x, i) => { const c = TOPC[x.topic] || BZC.lessons, on = BZ.tile === i;
    return `<button class="bz-tile${on ? ' on' : ''}" data-bact="tile" data-i="${i}" style="--tc:${c}"><span class="bz-ico" style="color:${c}">${bzIcon(x.topic, 20)}</span>
      <b>${esc(x.title || first(x.text))}</b><small>${esc(TOPN[x.topic] || 'Lesson')}</small>${on ? `<p>${esc(x.text)}</p>${x.why ? `<p class="why">${esc(x.why)}</p>` : ''}` : ''}</button>`; }).join('');
}
function bzReview(A, St) {
  const rv = A.review;
  if (!rv) return '<p class="bz-fine">Every Friday after the close, the firm grades its calls, rewrites its playbook and invents new strategies to test. The first one hasn’t happened yet.</p>';
  const [lead, rest] = bzSentences(rv.summary, 2), dec = rv.decisions || [];
  const chip = d => { const nm = ((St.find(x => x.id === d.id) || {}).name) || d.id, on = d.decision === 'activate';
    return `<span class="bz-chip" style="--cc:${on ? '#3ff2a3' : '#8b6b75'}" title="${esc(d.why)}">${on ? '✓ In use' : '✕ Retired'} · ${esc(nm)}</span>`; };
  return `<p class="bz-wrote">Written ${esc(bzDate(rv.at))}</p><p class="bz-lead">${esc(lead)}</p>${dec.length ? `<div class="bz-chips">${dec.map(chip).join('')}</div>` : ''}
    ${BZ.rv ? `<p>${esc(rest)}</p>${rv.follow ? `<p>${esc(rv.follow)}</p>` : ''}` : ''}${rest || rv.follow ? `<button class="bz-more" data-bact="rv">${BZ.rv ? 'Show less' : 'Read the whole review'}</button>` : ''}`;
}
function bzTraits(A) {
  const T = (A.traits && A.traits.length ? A.traits : (A.about_sam || []).map(x => ({ label: first(x), text: x })));
  return `<div class="bz-chips">${T.map((x, i) => `<button class="bz-chip pink${BZ.trait === i ? ' on' : ''}" data-bact="trait" data-i="${i}">${esc(x.label || first(x.text))}</button>`).join('')}</div>
    ${BZ.trait != null && T[BZ.trait] ? `<p class="bz-traittext">${esc(T[BZ.trait].text)}</p>` : ''}`;
}
const bzDate = v => { if (!v) return ''; const d = D(v); return `${DOW[d.getDay()]} ${MON[d.getMonth()]} ${d.getDate()}`; };
function bzNextReview(at) {  // analyst.py: Fridays after the close, once the last review is 6+ days old
  const d = at ? D(at) : new Date(), today = new Date(); today.setHours(0, 0, 0, 0);
  if (at) d.setDate(d.getDate() + 6);
  while (d.getDay() !== 5) d.setDate(d.getDate() + 1);
  return d < today ? 'due now' : `${DOW[d.getDay()]} ${MON[d.getMonth()]} ${d.getDate()}, after the close`;
}
/* What the app does, in the order it does it. Every number is read from the page's own data, so the explanation
   can't drift from what's running. Plain text in, so the same lines also make the one-page summary. */
function bzSteps(st) {
  const A = st.analyst || {}, F = st.firm || {}, b = st.bot || {}, n = v => isNum(v) ? v.toLocaleString() : '';
  const desks = (F.desks || []).length || 22, meets = (F.schedule || []).filter(x => /weekdays/.test(x.days || '')).length || 5;
  const C = A.calls || [], gr = C.filter(c => isNum(c.vs_spy_since_pct)).length, waiting = (st.orders || []).length;
  const open = isNum((F.record || {}).open) ? F.record.open : (F.open || []).length;
  const place = `You OK each order and place it at ${BN()} yourself`;
  return [
    { k: 'Gather', who: 'prog', by: 'Programs', text: `Plain programs, with no AI, download prices for ${n(b.scanned) || 'about 1,500'} U.S. stocks ${b.scan_times ? 'at ' + b.scan_times : 'three times'} each market day, and read the account’s holdings and cash from ${BN()}.`,
      live: st.data_through ? `Prices through ${st.data_through}` : '' },
    { k: 'Screen', who: 'prog', by: 'Programs', text: 'Fixed rules, tested on about 9 years of prices, rank every stock on trend and strength. The rules only make a shortlist. They don’t decide anything.',
      live: isNum(b.passed) && isNum(b.scanned) ? `${n(b.passed)} of ${n(b.scanned)} pass today` : '' },
    { k: 'Research', who: 'ai', by: `${desks} AI desks`, text: `Each desk covers one beat: the Fed, earnings, each sector, the news, risk, and a red team whose job is to argue against the popular idea. They meet ${meets} times a day and post memos and dated predictions that get checked later.`,
      live: [isNum(F.posts_today) ? `${F.posts_today} posts today` : '', open ? `${open} open predictions` : ''].filter(Boolean).join(' · ') },
    { k: 'Decide', who: 'ai', by: 'The PM (an AI)', text: 'The portfolio manager reads the numbers, the desks and its playbook, then writes the briefing: each order with its reason, how sure it is and what could go wrong, plus a Keep, Trim, Sell or Watch call on every holding.',
      live: A.at ? `Latest: ${A.label || 'briefing'}, ${whenT(A.at)}` : '' },
    { k: 'Approve', who: 'you', by: 'A person', text: `Nothing happens without a person. ${place}. The app only reads the account: it has no way to place a trade or move money.`,
      live: waiting ? `${waiting} order${waiting === 1 ? '' : 's'} waiting on Today` : 'Nothing waiting on Today' },
    { k: 'Check itself', who: 'prog', by: 'Programs, then the firm', text: 'Every call is graded against the S&P 500 once it’s 5 days old. Each Friday the firm reviews its week, rewrites its playbook and tests strategy ideas on about 9 years of prices.',
      live: C.length ? `${gr} of ${C.length} calls graded so far` : '' },
  ];
}
function bzGuards(st) {
  const A = st.analyst || {}, F = st.firm || {}, b = st.bot || {}, T = (st.proof || {}).test || {}, St = A.strategies || [], rec = (F.record || {}).firm || {};
  const core = String((st.settings || {}).core_funds || '').match(/[A-Z]{2,5}/g) || [], O = st.orders || [], warned = O.filter(o => o.risk).length;
  const inuse = St.filter(x => x.status === 'active').length, period = T.period || (St[0] || {}).period || 'about 9 years';
  return [
    { ic: 'sam', k: 'A person approves every order', text: `The app can’t trade. It only reads the account, and you place each order at ${BN()} yourself.`, live: '' },
    { ic: 'risk', k: 'Every order is checked first', text: 'Before an order is shown, programs check it: is there enough free cash, would one stock be more than 20% of the account, does a buy have a stop-loss, is it selling something bought today (a cash-account rule) or selling at a big loss. A problem shows as a ⚠ note on the order. These are warnings, not locks: the owner decides.',
      live: O.length ? `${warned} of ${O.length} order${O.length === 1 ? '' : 's'} on Today carr${warned === 1 ? 'ies' : 'y'} a risk note` : '' },
    { ic: 'strategy', k: 'A strategy has to beat luck', text: `A strategy is only used if, over ${period}, it beat the S&P 500 and also beat random stocks bought on the same days with the same sell rules, in the early years and in recent ones, after trading costs.`,
      live: St.length ? `${St.length} tested · ${inuse} in use · ${St.length - inuse} turned down` : '' },
    { ic: 'research', k: 'Every call is graded', text: 'Each buy, sell and trim is written down with that day’s price. Once it’s 5 days old it’s compared with the S&P 500: no call is quietly forgotten.', live: A.score || '' },
    { ic: 'timing', k: 'Predictions are scored against betting markets', text: 'Desks put a percentage on dated events (will the Fed cut in December?). When the date passes, a scorekeeper grades each one and compares the firm with the odds on Polymarket and Kalshi.',
      live: isNum(rec.brier) && rec.n ? `${rec.n} graded · Brier score ${rec.brier.toFixed(2)} (0 is perfect, 0.25 is a coin flip)${rec.vs_market_n && isNum(rec.market_brier) && isNum(rec.firm_on_those) ? ` · on the ${rec.vs_market_n} with market odds: the firm ${rec.firm_on_those.toFixed(2)}, the market ${rec.market_brier.toFixed(2)}` : ''}` : 'None graded yet' },
    { ic: 'size', k: 'Smaller buys until it’s proven', text: 'New buys are sized by how well the strategy has held up. Until it clearly beats the S&P 500, they stay below full size.', live: b.size_why ? b.size_why + '.' : '' },
    { ic: 'earnings', k: 'Stops are watched', text: 'While the market is open, every stop-loss is checked against prices every 15 minutes, so a stop that sold shows up quickly and the plan is redone around it.', live: '' },
    { ic: 'diversify', k: 'Core funds are left alone', text: `${core.length ? core.join(' and ') + (core.length === 1 ? ' is' : ' are') : 'The core index funds are'} buy-and-hold. The firm can add to them, and any order to sell one carries a warning.`, live: '' },
  ];
}
function bzLimits(st) {
  const A = st.analyst || {}, C = A.calls || [], gr = C.filter(c => isNum(c.vs_spy_since_pct)).length, firstDay = C.map(c => c.date).filter(Boolean).sort()[0];
  return [
    ['It’s new', `${firstDay ? `The firm’s live calls started ${bzDate(firstDay)}` : 'The firm’s live calls have only just started'}, and ${gr} ${gr === 1 ? 'has' : 'have'} been graded. That is far too few to prove anything yet.`],
    ['Backtests look backward', 'A strategy that worked on past prices can stop working. The tests only show it wasn’t luck in the past.'],
    ['AI can be wrong', 'It can misread news, miss something, or be too sure. The “% sure” on an order is its own estimate, which is why every call is graded.'],
    ['The account view can lag', 'Holdings and cash reach the app from the broker through Yahoo Finance, about once a day. Portfolio shows the “as of” time.'],
    ['It’s a research tool, not advice', 'Nobody at this firm is a licensed advisor. It’s a personal tool for one account, and every decision is the owner’s.'],
  ];
}
function bzSummary(st) {  // the same explanation as plain text, to paste into a note or an email
  const steps = bzSteps(st), guards = bzGuards(st), lim = bzLimits(st), A = st.analyst || {};
  return [`${APP}, in one page`, '',
    `What it is: a research and decision app for one personal brokerage account. Programs gather the numbers, a firm of AI desks researches, an AI portfolio manager writes the orders with its reasons and risks, and a person approves every one. It never places a trade.`, '',
    'How a decision gets made:', ...steps.map((x, i) => `${i + 1}. ${x.k} (${x.by}): ${x.text}${x.live ? ` [Now: ${x.live}]` : ''}`), '',
    'What keeps it honest:', ...guards.map(x => `- ${x.k}: ${x.text}${x.live ? ` [Now: ${x.live}]` : ''}`), '',
    'Its limits:', ...lim.map(x => `- ${x[0]}: ${x[1]}`), '',
    A.score ? `Track record so far: ${A.score}` : ''].join('\n').trim();
}
const BZNAV = [['how', 'How it works'], ['safe', 'Safeguards'], ['record', 'Track record'], ['playbook', 'Playbook'], ['lab', 'Strategy Lab'], ['you', 'About you'], ['map', 'Memory map']];
function brainView(st, opt) {
  const A = st.analyst || {}, L = A.lessons || [], St = A.strategies || [], o = opt || {}, ph = o.phone;
  const inuse = St.filter(x => x.status === 'active').length, C = A.calls || [], gr = C.filter(c => isNum(c.vs_spy_since_pct)).length;
  const btn = !ph && api() ? `<button class="bz-btn" data-act="review"${A.running ? ' disabled' : ''}>Run the weekly review now</button>` : '';
  const steps = bzSteps(st), guards = bzGuards(st), lim = bzLimits(st);
  const WHO = { prog: 'Programs', ai: 'AI', you: 'A person' };
  return `<div class="bz${ph ? ' ph' : ''}">
    <div class="bz-top">${o.room ? '' : '<h2>The firm’s brain</h2>'}<p class="bz-what">${esc(APP)} is a research and decision app for one personal brokerage account. Programs gather the numbers, a firm of AI desks researches, an AI portfolio manager writes the orders with its reasons and risks, and <b>a person approves every one</b>. It never places a trade.</p>
      <nav class="bz-nav" aria-label="Parts of this page">${BZNAV.map(([k, l]) => `<button data-bact="go" data-to="${k}">${l}</button>`).join('')}</nav></div>
    <section class="bz-card" data-sec="how"><h3>How a decision gets made <span>from raw numbers to an order you approve</span></h3>
      <ol class="bz-steps">${steps.map((x, i) => `<li class="w-${x.who}"><i>${i + 1}</i><div><b>${esc(x.k)}</b><small>${esc(x.by)}</small><p>${esc(x.text)}</p>${x.live ? `<em>${esc(x.live)}</em>` : ''}</div></li>`).join('')}</ol>
      <p class="bz-key"><span class="w-prog"><i></i>Programs: fixed rules, no AI</span><span class="w-ai"><i></i>AI: reads, researches, recommends</span><span class="w-you"><i></i>A person: approves and places</span></p></section>
    <section class="bz-card" data-sec="safe"><h3>What keeps it honest <span>the checks built in, and what they show right now</span></h3>
      <div class="bz-guards">${guards.map(x => `<div class="bz-guard"><span class="bz-ico">${bzIcon(x.ic, 18)}</span><div><b>${esc(x.k)}</b><p>${esc(x.text)}</p>${x.live ? `<em>Now: ${esc(x.live)}</em>` : ''}</div></div>`).join('')}</div>
      <div class="bz-limits"><h4>Know its limits</h4><ul>${lim.map(x => `<li><b>${esc(x[0])}.</b> ${esc(x[1])}</li>`).join('')}</ul></div></section>
    <div class="bz-row" data-sec="record">
      <section class="bz-card"><h3>Track record <span>${C.length} call${C.length === 1 ? '' : 's'} · ${gr} graded against the S&amp;P 500</span></h3><div class="bz-recwrap">${bzRecord(A)}</div></section>
      <section class="bz-card"><h3>Weekly review <span>${A.review ? `latest ${esc(bzDate(A.review.at))} · next ${esc(bzNextReview(A.review.at))}` : `first one ${esc(bzNextReview(null))}`}</span></h3><div class="bz-rv">${bzReview(A, St)}</div>${btn}</section></div>
    <section class="bz-card" data-sec="playbook"><h3>Playbook <span>${L.length} lesson${L.length === 1 ? '' : 's'} the PM reads before every briefing, rewritten at each weekly review · tap one</span></h3><div class="bz-tiles">${bzTiles(L) || '<p class="bz-fine">The first lessons are written at the first weekly review.</p>'}</div></section>
    <section class="bz-card" data-sec="lab"><h3>Strategy Lab <span>${St.length} strateg${St.length === 1 ? 'y' : 'ies'} tested · ${inuse} in use</span></h3>
      <p class="bz-read"><b>How to read this.</b> Each bubble is one strategy, tested on about 9 years of prices. Further right means it beat random stocks by more; higher means it beat the S&amp;P 500 by more; bigger means more test trades. Green is in use and grey was turned down. Only the shaded corner is a real edge. Tap a bubble.</p>
      <div class="bz-labwrap">${bzLabChart(St, BZ.lab != null ? BZ.lab : St.findIndex(x => x.status === 'active'))}<div class="bz-labsel">${bzLabPanel(St)}</div></div></section>
    <section class="bz-card" data-sec="you"><h3>What the firm has noticed about you <span>it reads these before every briefing · tap one</span></h3><div class="bz-tr">${bzTraits(A)}</div></section>
    <section class="bz-card bz-mapcard" data-sec="map"><h3>The memory map <span>everything above as one picture · click a dot</span></h3>
    <div class="bz-mapwrap"><canvas class="bz-map" role="img" aria-label="A map of the firm's memory: the firm in the middle, joined to its playbook, the Strategy Lab, its track record, your stocks and what it knows about you. The panel beside it and the buttons below describe each part."></canvas><div class="bz-detail">${bzDetail(st, BZ.sel)}</div>
      <div class="bz-legend">${[['lessons', 'Playbook'], ['lab', 'Strategy Lab'], ['calls', 'Track record'], ['stocks', 'Your stocks'], ['you', 'About you']].map(([k, l]) => `<button data-bact="sel" data-id="h-${k}"><i style="background:${BZC[k]}"></i>${l}</button>`).join('')}</div></div></section>
    <div class="bz-foot"><button class="bz-copy" data-bact="copy">Copy this as a one-page summary</button><span>Plain text, ready to paste into a note or an email.</span></div>
  </div>`;
}
function bzSelect(root, st, id) {
  BZ.sel = id; const d = $('.bz-detail', root); if (d) d.innerHTML = bzDetail(st, id);
}
function brainMount(root, st, opt) {
  bzStyle();
  const box = $('.bz', root); if (!box) return;
  bzMap(box, st, opt);
  if (box._bound) return;
  box._bound = true;
  box.addEventListener('keydown', e => { if ((e.key === 'Enter' || e.key === ' ') && e.target.matches('g[data-bact]')) { e.preventDefault(); e.target.dispatchEvent(new MouseEvent('click', { bubbles: true })); } });
  box.addEventListener('click', e => {
    const el = e.target.closest('[data-bact]'); if (!el) return;
    const A = st.analyst || {}, k = el.dataset.bact;
    if (k === 'sel') { bzSelect(box, st, el.dataset.id); const m = $('.bz-mapwrap', box), r = m && m.getBoundingClientRect(); if (r && (r.top < 0 || r.top > innerHeight - 160) && !el.closest('.bz-mapwrap')) m.scrollIntoView({ behavior: 'smooth', block: 'center' }); }
    else if (k === 'go') { const t = $(`[data-sec="${el.dataset.to}"]`, box); if (t) t.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
    else if (k === 'calls') { BZ.calls = !BZ.calls; $('.bz-recwrap', box).innerHTML = bzRecord(A); }
    else if (k === 'copy') { const text = bzSummary(st), A2 = api(), done = () => toast('Copied. Paste it anywhere.'), no = () => toast('Couldn’t copy here.');
      if (A2 && A2.copy_text) Promise.resolve(A2.copy_text(text)).then(done, no); else if (navigator.clipboard) navigator.clipboard.writeText(text).then(done, no); else no(); }
    else if (k === 'lab') { BZ.lab = +el.dataset.i; const w = $('.bz-labwrap', box); if (w) w.innerHTML = bzLabChart(A.strategies || [], BZ.lab) + `<div class="bz-labsel">${bzLabPanel(A.strategies || [])}</div>`; bzSelect(box, st, 's' + BZ.lab); }
    else if (k === 'tile') { const i = +el.dataset.i; BZ.tile = BZ.tile === i ? null : i; $('.bz-tiles', box).innerHTML = bzTiles(A.lessons || []); if (BZ.tile != null) bzSelect(box, st, 'l' + i); }
    else if (k === 'rv') { BZ.rv = !BZ.rv; $('.bz-rv', box).innerHTML = bzReview(A, A.strategies || []); }
    else if (k === 'trait') { const i = +el.dataset.i; BZ.trait = BZ.trait === i ? null : i; $('.bz-tr', box).innerHTML = bzTraits(A); if (BZ.trait != null) bzSelect(box, st, 't' + i); }
  });
}
function bzStyle() {
  if (document.getElementById('bz-css')) return;
  const css = `
.bz{--g:#3ff2a3;--r:#ff5f6e;--ink:#eef0f6;--ink2:#c5cad6;--dim:#8d93a3;--line:rgba(255,255,255,.08);color:var(--ink);display:flex;flex-direction:column;gap:16px}
.bz h2{margin:0;font-size:22px;font-weight:700;letter-spacing:-.03em}.bz-top p{margin:4px 0 0;color:var(--dim);font-size:13.5px}
.bz-top{display:flex;flex-wrap:wrap;gap:12px 20px;align-items:flex-end;justify-content:space-between}
.bz-stats{display:flex;flex-wrap:wrap;gap:8px}.bz-stats span{font-size:12.5px;color:var(--ink2);padding:6px 11px;border-radius:999px;background:rgba(255,255,255,.04);border:1px solid var(--line)}
.bz-stats b{font:700 13px ui-monospace,Menlo,monospace;color:#fff;margin-right:3px}
.bz-mapwrap{position:relative;display:grid;grid-template-columns:minmax(0,1fr) 330px;min-height:470px;border-radius:22px;overflow:hidden;
  background:radial-gradient(120% 90% at 40% 50%,rgba(40,28,90,.55),rgba(8,9,14,.92) 70%);border:1px solid rgba(195,180,255,.14);box-shadow:inset 0 0 80px rgba(120,90,255,.08)}
.bz-map{width:100%;height:100%;min-height:470px;display:block}
.bz-detail{position:relative;z-index:1;align-self:start;margin:14px;padding:16px 18px;border-radius:18px;background:rgba(12,13,20,.78);border:1px solid rgba(255,255,255,.09);backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px);overflow:auto;max-height:440px;animation:bzIn .35s ease}
@keyframes bzIn{from{opacity:0;transform:translateY(6px)}}
.bz-legend{position:absolute;left:12px;bottom:10px;display:flex;flex-wrap:wrap;gap:4px}.bz-legend button{font:inherit;font-size:12px;color:var(--dim);background:none;border:0;min-height:26px;padding:4px 8px;border-radius:8px;cursor:pointer}
.bz-legend button:hover{color:#fff;background:rgba(255,255,255,.06)}.bz-legend i{display:inline-block;width:8px;height:8px;border-radius:50%;margin-right:6px;vertical-align:0}
.bz-dh{display:flex;align-items:center;gap:9px;flex-wrap:wrap;margin-bottom:8px}.bz-dh b{font-size:16px;font-weight:700;letter-spacing:-.02em}.bz-dh span{font-size:12px;color:var(--dim)}
.bz-dot{display:inline-block;width:10px;height:10px;border-radius:50%;flex:none}
.bz-ico{display:inline-grid;place-items:center;width:34px;height:34px;border-radius:11px;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.08);flex:none}
.bz-detail p{margin:0 0 10px;font-size:13.5px;line-height:1.5;color:var(--ink2)}.bz-detail .bz-big{font-size:14.5px;color:var(--ink)}
.bz-why{padding:10px 12px;border-radius:12px;background:rgba(255,255,255,.04);border-left:2px solid #a38cff}.bz-why small{display:block;font:600 11px ui-monospace,Menlo,monospace;letter-spacing:.12em;text-transform:uppercase;color:var(--dim);margin-bottom:4px}.bz-why p{margin:0!important;font-size:13px!important}
.bz-nums{display:grid;grid-template-columns:repeat(auto-fit,minmax(70px,1fr));gap:8px;margin:10px 0}.bz-nums div{padding:9px 10px;border-radius:12px;background:rgba(255,255,255,.035);border:1px solid var(--line)}
.bz-nums b{display:block;font:700 16px ui-monospace,Menlo,monospace;letter-spacing:-.03em}.bz-nums span{font-size:11px;color:var(--dim)}
.bz-pos{color:var(--g)}.bz-neg{color:var(--r)}.bz-fine{font-size:12px!important;color:var(--dim)!important;margin:6px 0 0!important}
.bz-kids{display:flex;flex-direction:column;gap:4px;margin-top:6px}.bz-kid{display:flex;align-items:center;gap:9px;text-align:left;padding:7px 9px;border-radius:10px;border:0;background:rgba(255,255,255,.03);color:var(--ink2);font-size:13px;cursor:pointer}
.bz-kid:hover{background:rgba(255,255,255,.08);color:#fff}.bz-kid .bz-dot{width:8px;height:8px}
.bz-call{display:flex;gap:10px;align-items:flex-start}.bz-word{flex:none;font:700 11px ui-monospace,Menlo,monospace;letter-spacing:.1em;text-transform:uppercase;padding:4px 9px;border:1px solid;border-radius:999px}
.bz-spark{height:54px;margin:4px 0}.bz-spark svg{width:100%;height:54px}
.bz-prog{display:block;height:6px;border-radius:6px;background:rgba(255,255,255,.07);overflow:hidden;margin:8px 0 4px}.bz-prog i{display:block;height:100%;background:linear-gradient(90deg,#56cbff,#a38cff);border-radius:6px}
.bz-row{display:grid;grid-template-columns:minmax(0,1.55fr) minmax(0,1fr);gap:16px}
.bz-card{padding:18px 20px;border-radius:20px;background:rgba(255,255,255,.03);border:1px solid var(--line)}
.bz-card h3{margin:0 0 12px;font-size:15px;font-weight:650;letter-spacing:-.02em}.bz-card h3 span{margin-left:8px;font-size:12.5px;font-weight:500;color:var(--dim)}
.bz-labwrap{display:grid;grid-template-columns:minmax(0,1.45fr) minmax(0,1fr);gap:22px;align-items:start}
.bz-detail .bz-nums{grid-template-columns:1fr 1fr}
.bz-lab{width:100%;max-width:780px;height:auto;font:12px ui-monospace,Menlo,monospace}.bz-lab text{fill:#8d93a3}.bz-lab .ax{fill:#a6acbb;font-family:-apple-system,system-ui,sans-serif;font-size:12.5px}
.bz-lab .zone{fill:#3ff2a3;opacity:.75;font-weight:700;letter-spacing:.08em}.bz-lab line.g{stroke:rgba(255,255,255,.05)}.bz-lab line.z{stroke:rgba(255,255,255,.22);stroke-dasharray:3 4}
.bz-b{cursor:pointer}.bz-b .lbl{fill:#dfe3ec;font:600 13px -apple-system,system-ui,sans-serif}.bz-b:hover circle{stroke-width:2.6}.bz-b.on .lbl{fill:#fff}
.bz-labsel p{margin:0 0 8px;font-size:13px;line-height:1.5;color:var(--ink2)}.bz-note{font-size:12.5px!important}
.bz-years small{display:block;font:600 11px ui-monospace,Menlo,monospace;letter-spacing:.12em;text-transform:uppercase;color:var(--dim);margin:6px 0 2px}.bz-years svg{width:100%;height:88px;font:11px ui-monospace,Menlo,monospace}.bz-years text{fill:#8d93a3}
.bz-what{margin:6px 0 0!important;max-width:880px;font-size:15px!important;line-height:1.55;color:var(--ink2)!important}.bz-what b{color:#fff;font-weight:650}
.bz-top{display:block!important}.bz-nav{display:flex;flex-wrap:wrap;gap:6px;margin-top:14px}
.bz-nav button{font:inherit;font-size:12.5px;color:var(--ink2);min-height:32px;padding:6px 12px;border-radius:999px;border:1px solid var(--line);background:rgba(255,255,255,.04);cursor:pointer}
.bz-nav button:hover{color:#fff;border-color:rgba(195,180,255,.5);background:rgba(163,140,255,.12)}
.bz [data-sec]{scroll-margin-top:84px}
.bz-steps{list-style:none;margin:0;padding:0;display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}
.bz-steps li{--wc:#56cbff;position:relative;display:flex;gap:12px;padding:14px 14px 14px 12px;border-radius:16px;border:1px solid var(--line);background:linear-gradient(160deg,color-mix(in srgb,var(--wc) 9%,transparent),rgba(255,255,255,.015));border-top:2px solid color-mix(in srgb,var(--wc) 70%,transparent)}
.bz-steps li.w-ai,.bz-key .w-ai{--wc:#a38cff}.bz-steps li.w-you,.bz-key .w-you{--wc:#ffd36e}.bz-key .w-prog{--wc:#56cbff}
.bz-steps li>i{flex:none;display:grid;place-items:center;width:28px;height:28px;border-radius:50%;font:700 13px ui-monospace,Menlo,monospace;font-style:normal;color:#0b0c12;background:var(--wc)}
.bz-steps b{display:block;font-size:15px;font-weight:700;letter-spacing:-.02em}.bz-steps small{display:block;margin-top:1px;font:600 11px ui-monospace,Menlo,monospace;letter-spacing:.1em;text-transform:uppercase;color:var(--wc)}
.bz-steps p{margin:7px 0 0;font-size:13px;line-height:1.5;color:var(--ink2)}
.bz-steps em,.bz-guard em{display:inline-block;margin-top:9px;padding:4px 9px;border-radius:8px;font:600 11.5px ui-monospace,Menlo,monospace;font-style:normal;color:var(--ink);background:rgba(255,255,255,.06);border:1px solid var(--line);line-height:1.45}
.bz-key{display:flex;flex-wrap:wrap;gap:6px 18px;margin:12px 0 0;font-size:12px;color:var(--dim)}.bz-key i{display:inline-block;width:9px;height:9px;border-radius:50%;background:var(--wc);margin-right:6px}
.bz-guards{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}
.bz-guard{display:flex;gap:12px;padding:13px 14px;border-radius:14px;border:1px solid var(--line);background:rgba(255,255,255,.025)}.bz-guard .bz-ico{color:#3ff2a3}
.bz-guard b{display:block;font-size:14px;font-weight:650;letter-spacing:-.01em}.bz-guard p{margin:4px 0 0;font-size:13px;line-height:1.5;color:var(--ink2)}.bz-guard em{color:#bff5dc;border-color:rgba(63,242,163,.22);background:rgba(63,242,163,.07)}
.bz-limits{margin-top:14px;padding:14px 16px;border-radius:14px;border:1px solid rgba(255,180,84,.28);background:rgba(255,180,84,.06)}
.bz-limits h4{margin:0 0 8px;font:700 11.5px ui-monospace,Menlo,monospace;letter-spacing:.12em;text-transform:uppercase;color:#ffb454}
.bz-limits ul{margin:0;padding:0;list-style:none;display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px 22px}.bz-limits li{font-size:13px;line-height:1.5;color:var(--ink2)}.bz-limits li b{color:var(--ink);font-weight:650}
.bz-read{margin:0 0 12px;font-size:13px;line-height:1.55;color:var(--ink2);max-width:900px}.bz-read b{color:var(--ink)}
.bz-wrote{margin:0 0 6px!important;font:600 11px ui-monospace,Menlo,monospace!important;letter-spacing:.1em;text-transform:uppercase;color:var(--dim)!important}
.bz-recsum{margin:0 0 6px;font-size:14.5px;line-height:1.45;color:var(--ink)}
.bz-mapcard{padding-bottom:20px}
.bz-foot{display:flex;flex-wrap:wrap;gap:8px 14px;align-items:center;font-size:12.5px;color:var(--dim)}
.bz-copy{font:inherit;font-size:13.5px;font-weight:600;color:#fff;min-height:38px;padding:8px 16px;border-radius:12px;border:1px solid rgba(195,180,255,.4);background:rgba(163,140,255,.16);cursor:pointer}.bz-copy:hover{background:rgba(163,140,255,.28)}
@media (max-width:1100px){.bz-steps{grid-template-columns:repeat(2,minmax(0,1fr))}}
@media (max-width:760px){.bz-steps,.bz-guards,.bz-limits ul{grid-template-columns:1fr}}
.bz.ph .bz-steps,.bz.ph .bz-guards,.bz.ph .bz-limits ul{grid-template-columns:1fr}.bz.ph .bz-what{font-size:14px!important}
.bz-rec{display:grid;grid-template-columns:96px minmax(0,1fr);gap:16px;align-items:start}.bz-ring{width:96px;height:96px}.bz-ring .big{fill:#fff;font:700 15px ui-monospace,Menlo,monospace}.bz-ring .sm{fill:#8d93a3;font:600 11px ui-monospace,Menlo,monospace;letter-spacing:.1em;text-transform:uppercase}
.bz-callrow time{font:500 11.5px ui-monospace,Menlo,monospace;color:var(--dim)}
.bz-callrow{display:grid;grid-template-columns:10px 84px 46px minmax(20px,1fr) auto;gap:10px;align-items:center;width:100%;padding:8px 0;border:0;border-top:1px solid var(--line);background:none;color:var(--ink);font-size:13px;text-align:left;cursor:pointer}
@media (max-width:620px){.bz-rec{grid-template-columns:minmax(0,1fr)}.bz-callrow{grid-template-columns:10px minmax(0,1fr) auto;row-gap:1px}.bz-callrow>span{display:none}.bz-callrow time{grid-column:2;grid-row:2}.bz-callrow em{grid-column:3;grid-row:1 / span 2;white-space:normal;text-align:right;max-width:46vw}}
.bz-callrow:first-of-type{border-top:0}.bz-callrow em{font:600 11.5px ui-monospace,Menlo,monospace;color:var(--dim);font-style:normal;white-space:nowrap}.bz-callrow .bz-prog{margin:0}
.bz-bar{display:block;height:6px;border-radius:6px;background:rgba(255,255,255,.07);overflow:hidden}.bz-bar i{display:block;height:100%;border-radius:6px}
.bz-tiles{display:grid;grid-template-columns:repeat(auto-fill,minmax(190px,1fr));gap:10px}
.bz-tile{position:relative;display:flex;flex-direction:column;align-items:flex-start;gap:8px;text-align:left;padding:14px;border-radius:16px;border:1px solid var(--line);background:linear-gradient(160deg,rgba(255,255,255,.05),rgba(255,255,255,.015));color:var(--ink);cursor:pointer;transition:transform .2s,border-color .2s,background .2s;font:inherit}
.bz-tile:hover{transform:translateY(-2px);border-color:color-mix(in srgb,var(--tc) 55%,transparent)}
.bz-tile b{font-size:14px;line-height:1.3;font-weight:650}.bz-tile small{font:600 11px ui-monospace,Menlo,monospace;letter-spacing:.12em;text-transform:uppercase;color:var(--tc)}
.bz-tile.on{grid-column:span 2;border-color:var(--tc);background:linear-gradient(160deg,color-mix(in srgb,var(--tc) 14%,transparent),rgba(255,255,255,.02))}
.bz-tile p{margin:0;font-size:13px;line-height:1.5;color:var(--ink2)}.bz-tile p.why{font-size:12.5px;color:var(--dim);padding-left:10px;border-left:2px solid var(--tc)}
.bz-lead{margin:0 0 12px;font-size:15px;line-height:1.5}.bz-rv p{font-size:13.5px;line-height:1.55;color:var(--ink2);margin:10px 0 0}
.bz-chips{display:flex;flex-wrap:wrap;gap:8px}.bz-chip{font-size:12.5px;padding:6px 11px;border-radius:999px;border:1px solid color-mix(in srgb,var(--cc,#a38cff) 45%,transparent);color:var(--ink);background:color-mix(in srgb,var(--cc,#a38cff) 10%,transparent);cursor:default}
button.bz-chip{cursor:pointer;font:inherit;font-size:12.5px}.bz-chip.pink{--cc:#ff7eb6}.bz-chip.on{background:color-mix(in srgb,var(--cc) 30%,transparent);color:#fff}
.bz-traittext{margin:12px 0 0;font-size:13.5px;line-height:1.5;color:var(--ink2);padding:10px 12px;border-radius:12px;background:rgba(255,126,182,.07);border-left:2px solid #ff7eb6}
.bz-more,.bz-btn{margin-top:8px;font:inherit;font-size:13px;color:#c3b4ff;background:none;border:0;min-height:28px;padding:4px 0;cursor:pointer}.bz-btn{display:block;color:var(--dim)}.bz-more:hover,.bz-btn:hover{color:#fff}
.bz .aib{display:inline-block;font-size:11.5px;font-weight:700;color:#a38cff;background:rgba(163,140,255,.12);border:1px solid rgba(163,140,255,.28);padding:1px 7px;border-radius:999px}
@media (max-width:980px){.bz-row{grid-template-columns:1fr}.bz-labwrap{grid-template-columns:1fr}}
@media (max-width:760px){.bz-tiles{grid-template-columns:repeat(2,minmax(0,1fr))}.bz-tile{padding:12px}.bz-tile b{font-size:13px}.bz-mapwrap{grid-template-columns:1fr;min-height:0}.bz-map{min-height:340px;height:340px}.bz-detail{max-height:none;margin:0 12px 12px}.bz-legend{position:static;padding:0 14px 12px;order:3}.bz-tile.on{grid-column:1/-1}}
.bz.ph .bz-mapwrap{grid-template-columns:1fr;min-height:0}.bz.ph .bz-map{min-height:320px;height:320px}.bz.ph .bz-detail{max-height:none;margin:0 10px 10px}.bz.ph .bz-legend{position:static;padding:0 12px 12px}
.bz.ph .bz-row,.bz.ph .bz-labwrap{grid-template-columns:1fr}.bz.ph .bz-tiles{grid-template-columns:repeat(2,minmax(0,1fr))}.bz.ph .bz-tile{padding:12px}.bz.ph .bz-tile b{font-size:13px}.bz.ph .bz-tile.on{grid-column:1/-1}.bz.ph h2{font-size:20px}
`;
  const el = document.createElement('style'); el.id = 'bz-css'; el.textContent = css; document.head.appendChild(el);
}
function viewBrain() { return brainView(S, { phone }); }

/* ---------------- v5: the Firm (the phone app uses it too: CT.firm) ----------------
   The org chart (click a desk: its beat, style, notebook and record), the live board (memos, challenges, replies, the
   PM's rulings, alerts), the scenario cards and open predictions next to the betting markets' odds, the forward calendar,
   the scorekeeper's record (Brier score, hit rate, calibration) and the firm's day. It brings its own styles, like the
   Brain. On the Mac it refreshes itself every 15 seconds while it's on screen, so a meeting shows live. */
const FZ = { desk: null, filter: 'top', open: {}, pred: null, more: false, mk: false, timer: null, last: '', sel: 'now', openK: new Set() };  // sel: what's open beside the office
const FZK = { memo: 'Memo', challenge: 'Challenge', reply: 'Reply', ruling: 'Ruling', briefing: 'Briefing', alert: 'Alert', score: 'Graded', note: 'Note', order: 'Order', boss: 'To the boss' };
const FZKC = { memo: '#8d93a3', challenge: '#ff8a65', reply: '#56cbff', ruling: '#c3b4ff', briefing: '#3ff2a3', alert: '#ff5f6e', score: '#ffd36e', note: '#8d93a3', order: '#ffd36e', boss: '#ffd36e' };
const FZV = { buy: ['Buy', '#3ff2a3'], add: ['Add', '#3ff2a3'], keep: ['Keep', '#56cbff'], watch: ['Watch', '#ffc65a'], trim: ['Trim', '#ffb454'], sell: ['Sell', '#ff5f6e'], avoid: ['Avoid', '#ff5f6e'] };
const FZM = { good: ['#3ff2a3', 'good news'], bad: ['#ff5f6e', 'bad news'], mixed: ['#ffc65a', 'mixed news'], quiet: ['#8d93a3', 'quiet'], alarm: ['#ff3b52', 'alarm'] };
const FZCK = { fed: 'Fed', data: 'Data', election: 'Vote', opec: 'Oil', court: 'Court', deadline: 'Due', earnings: 'Earn', policy: 'Gov', other: 'Event' };
const FZF = [['top', 'Highlights'], ['memo', 'Memos'], ['debate', 'Debate'], ['pm', 'PM'], ['alert', 'Alerts'], ['all', 'Everything']];
const FZBOSS = { id: 'boss', name: 'You (the boss)', short: '★', color: '#ffd36e', team: 'lead' };  // v6: the owner of this copy, on the board
const fzD = (F, id) => id === 'boss' ? FZBOSS : (F.desks || []).find(d => d.id === id) || { id, name: id || '?', short: '?', color: '#8d93a3' };
const fzAv = (d, s) => `<span class="fz-av${d.running ? ' on' : ''}" aria-hidden="true" style="--c:${d.color}${s ? `;width:${s}px;height:${s}px;font-size:${Math.max(11, Math.round(s * .34))}px` : ''}" title="${esc(d.name)}">${esc(d.short)}</span>`;
const fzT = iso => { const t = new Date(iso); return isNaN(t) ? '' : t.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }); };
function fzAgo(iso) {
  const t = Date.parse(iso); if (!isFinite(t)) return '';
  const m = Math.round((Date.now() - t) / 60000);
  return m < 1 ? 'just now' : m < 60 ? m + ' min ago' : m < 600 ? Math.round(m / 60) + ' h ago' : hm(iso);
}
function fzWhen(iso) {
  const t = new Date(iso); if (isNaN(t)) return '';
  const a = new Date(); a.setHours(0, 0, 0, 0); const b = new Date(t); b.setHours(0, 0, 0, 0);
  const days = Math.round((b - a) / 864e5);
  return (days === 0 ? 'today' : days === 1 ? 'tomorrow' : DOW[t.getDay()]) + ' at ' + fzT(iso);
}
function fzOdds(p, mk, big) {
  if (!isNum(p)) return '';
  const c = p >= 60 ? '#3ff2a3' : p <= 40 ? '#ff8a65' : '#ffc65a';
  return `<span class="fz-odds${big ? ' big' : ''}" role="img" aria-label="${p}% odds${isNum(mk) ? `; the betting markets say ${mk}%` : ''}"><span class="fz-ob" aria-hidden="true"><i style="width:${p}%;background:${c}"></i>${isNum(mk) ? `<b style="left:${mk}%" title="The betting markets say ${mk}%"></b>` : ''}</span><em style="color:${c}">${p}%</em></span>`;
}
function fzTrail(t) {
  if (!t || t.length < 2) return '';
  const w = 90, h = 24, label = 'Odds over time: ' + t.join('%, ') + '%', pts = t.map((v, i) => `${(i / (t.length - 1) * w).toFixed(1)},${(h - 2 - v / 100 * (h - 4)).toFixed(1)}`).join(' ');
  return `<svg class="fz-trail" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" role="img" aria-label="${label}"><line x1="0" x2="${w}" y1="${h / 2}" y2="${h / 2}"/><polyline points="${pts}"/></svg>`;
}
const fzArrow = v => v === 'up' ? '<i class="up" title="up">▲</i>' : v === 'down' ? '<i class="dn" title="down">▼</i>' : '<i class="fl" title="about flat">●</i>';
function fzLink(u, inner, cls) {
  if (!/^https?:\/\//i.test(String(u || ''))) return `<span class="${cls}">${inner}</span>`;
  return api() ? `<button class="${cls}" data-fact="link" data-u="${esc(u)}">${inner}</button>` : `<a class="${cls}" href="${esc(u)}" target="_blank" rel="noopener noreferrer">${inner}</a>`;
}
function fzSrc(x) { let h = ''; try { h = new URL(x.url).hostname.replace(/^www\./, ''); } catch (e) { return ''; } return fzLink(x.url, `<b>${esc((x.title || h).slice(0, 70))}</b><span>${esc(h)}</span>`, 'fz-src'); }

/* v1.2.1: Claude's sign-in on this Mac ran out. Every Claude run fails until the owner signs in again, and from
   Nov 13 to Nov 15, 2026 nothing on screen said so. Today, the Firm and the phone say it until a run works again;
   on the Mac it has the sign-in itself (the setup guide's, A.claude_signin) and a Check again that runs no AI. */
const SGN_KEY = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="8" cy="15" r="4"/><path d="M10.8 12.2 20 3M16 7l3 3M14 9l2 2"/></svg>';
function sgnWhen(iso) {
  const d = new Date(iso); if (isNaN(d)) return '';
  const t = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  return d.toDateString() === new Date().toDateString() ? `today at ${t}` : `on ${d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })} at ${t}`;
}
function sgnStyle() {
  if (document.getElementById('sgn-css')) return;
  const el = document.createElement('style'); el.id = 'sgn-css';
  el.textContent = `.sgn{display:flex;align-items:center;gap:12px 16px;padding:16px 18px;border-radius:18px;border:1px solid rgba(255,198,90,.38);border-left:4px solid var(--warn);background:linear-gradient(100deg,rgba(255,198,90,.13),rgba(255,198,90,.035) 62%,rgba(255,255,255,.02));color:var(--ink)}
.sgn-ic{flex:none;display:grid;place-items:center;width:42px;height:42px;border-radius:13px;background:rgba(255,198,90,.17);color:var(--warn)}.sgn-ic svg{width:22px;height:22px}
.sgn-t{flex:1;min-width:0}.sgn-t b{display:block;font-size:16.5px;font-weight:700;color:#fff;margin:0 0 3px;letter-spacing:-.01em}
.sgn-t p{margin:0;font-size:14px;line-height:1.5;color:var(--ink2)}.sgn-t .sgn-how{margin-top:7px;color:var(--ink)}.sgn-t .sgn-how b{display:inline;font-size:inherit;margin:0}
.sgn-b{flex:none;display:flex;flex-wrap:wrap;gap:8px}.sgn-b .btn{white-space:nowrap}
.sgn-today{margin:0 0 20px}.sgn-firm{margin:12px 0 0}.sgn-ph{margin-top:12px;align-items:flex-start;padding:15px 16px}.sgn-ph .sgn-ic{width:36px;height:36px;border-radius:11px}.sgn-ph .sgn-ic svg{width:19px;height:19px}
@media (max-width:760px){.sgn{flex-wrap:wrap;align-items:flex-start}.sgn-b{width:100%;padding-left:58px}.sgn-b .btn{flex:1 1 auto}}
@media (max-width:480px){.sgn-b{padding-left:0}}`;
  document.head.appendChild(el);
  if (!phone) document.addEventListener('click', e => { const b = e.target.closest && e.target.closest('[data-sgn]'); if (b) sgnClick(b); });
}
function signinWarn(st, opt) {
  const s = (st || {}).signin || {}, o = opt || {}, ph = !!o.phone, A = !ph && api();
  if (!s.out) return '';
  sgnStyle();
  return `<section class="sgn${o.cls ? ' ' + o.cls : ''}" role="alert"><span class="sgn-ic" aria-hidden="true">${SGN_KEY}</span>
    <div class="sgn-t"><b>Claude needs you to sign in again</b><p>Claude’s sign-in on ${ph ? 'your Mac' : 'this Mac'} ran out ${esc(sgnWhen(s.since) || 'a while ago')}, so the Firm has stopped: no briefings, meetings or answers until you sign in. Prices, your account and the stop checks keep working.</p>
    ${ph ? '<p class="sgn-how">On the Mac, open SRM Finance and press <b>Sign in to Claude</b>.</p>' : ''}</div>
    ${A ? '<div class="sgn-b"><button class="btn go" data-sgn="in">Sign in to Claude</button><button class="btn quiet" data-sgn="check">Check again</button></div>' : ''}</section>`;
}
async function sgnClick(b) {
  const A = api(); if (!A || b.disabled) return;
  if (b.dataset.sgn === 'in') {
    const r = await A.claude_signin();
    toast(r && r.ok ? 'A Terminal window opened, and your browser shows Claude’s sign-in page. Sign in there, then come back and press Check again.' : (r && r.error) || 'Couldn’t open Terminal.', 10000);
    return;
  }
  const was = b.textContent; b.style.minWidth = b.offsetWidth + 'px'; b.disabled = true; b.textContent = 'Checking…';  // the row doesn't shift
  let r = null; try { r = await A.claude_recheck(); } catch (e) { /* said below */ }
  b.disabled = false; b.textContent = was; b.style.minWidth = '';
  if (r && r.ok) { regrade('Claude is signed in again. The Firm picks up at its next meeting.'); return; }
  toast(r && r.ok === false ? 'Still not signed in. Press Sign in to Claude and finish in your browser.' : 'Couldn’t tell yet. Try again in a minute.', 8000);
}

function fzLive(F, ph) {
  const m = F.meeting, w = F.watch || {};
  if (F.paused_until) return `<div class="fz-live warn"><span class="fz-pulse warn"></span><div><b>Paused until ${esc(fzWhen(F.paused_until))}</b>
    <span>Your Claude plan reached a usage limit. The firm starts again by itself when it resets; nothing is lost.</span></div></div>`;
  if (m) {
    const ws = (m.writing || []).map(id => fzD(F, id)), dn = (m.done || []).length;
    return `<div class="fz-live on"><span class="fz-pulse"></span><div><b>${esc(m.label)} in progress</b>
      <span>${esc(m.step || 'Starting')}${ws.length ? ': ' + ws.map(d => esc(d.name)).join(', ') + (ws.length === 1 ? ' is' : ' are') + ' writing' : ''} · ${dn} done · started ${esc(fzT(m.started))}${m.reason ? ' · ' + esc(m.reason) : ''}</span></div>
      ${ws.length ? `<div class="fz-ws">${ws.map(d => fzAv(d, 28)).join('')}</div>` : ''}</div>`;
  }
  const nx = (F.next || [])[0];
  const btn = !ph && api() ? `<button class="fz-btn" data-fact="call">Call a meeting now</button>` : '';
  return `<div class="fz-live"><span class="fz-pulse idle"></span><div><b>${nx ? `Next: ${esc(nx.label)}, ${esc(fzWhen(nx.at))}` : 'Between meetings'}</b>
    <span>${w.last_at ? `News watch checked ${esc(fzAgo(w.last_at))}${w.severity ? ': ' + esc(w.headline || 'something new') : ': nothing big'}` : 'The news watch checks every 30 minutes on weekdays'}</span></div>${btn}</div>`;
}
function fzOrg(F) {
  const pm = fzD(F, 'pm'), teams = (F.teams || []).filter(t => t.id !== 'lead');
  const seat = d => `<button class="fz-seat${FZ.desk === d.id ? ' sel' : ''}${d.running ? ' run' : ''}" data-fact="desk" data-id="${esc(d.id)}" style="--c:${d.color}">${fzAv(d)}
    <span class="fz-sn"><b>${esc(d.name.replace(/ desk$/, ''))}</b><small>${d.running ? 'writing now…' : d.last_at ? esc(fzAgo(d.last_at)) : 'no posts yet'}${d.today ? ` · ${d.today} today` : ''}</small></span></button>`;
  return `<div class="fz-org"><div class="fz-pmrow">${seat(pm).replace('fz-seat', 'fz-seat pm')}</div><div class="fz-trunk"><i></i></div>
    <div class="fz-teams">${teams.map(t => `<div class="fz-team t-${esc(t.id)}" style="--c:${t.color}"><h4><i></i>${esc(t.name)}</h4><div class="fz-seats">${(F.desks || []).filter(d => d.team === t.id).map(seat).join('')}</div></div>`).join('')}</div></div>`;
}
function fzDeskPanel(F) {
  const d = FZ.desk && fzD(F, FZ.desk); if (!d || !d.beat) return '';
  const nb = d.notebook || {}, rc = d.record, mine = (F.feed || []).filter(p => p.desk === d.id).slice(0, 3);
  const model = { opus: 'Claude Opus', sonnet: 'Claude Sonnet' }[d.model] || 'Claude Opus and Sonnet';
  return `<div class="fz-dp" style="--c:${d.color}"><div class="fz-dh">${fzAv(d, 42)}<div><b>${esc(d.name)}</b><span>${esc(model)} · ${esc(d.searches)} web searches a turn</span></div><button class="fz-x" data-fact="desk" data-id="" aria-label="Close">✕</button></div>
    <p><b>Beat:</b> ${esc(d.beat)}.</p><p class="fz-dim"><b>Style:</b> ${esc(d.style)}.</p>
    <div class="fz-nums"><div><b>${d.today || 0}</b><span>posts today</span></div><div><b>${rc ? rc.n : 0}</b><span>graded predictions</span></div>
      <div><b>${rc && isNum(rc.brier) ? rc.brier.toFixed(2) : '–'}</b><span>Brier score</span></div><div><b>${rc && isNum(rc.hit) ? Math.round(rc.hit * 100) + '%' : '–'}</b><span>right</span></div></div>
    <div class="fz-dcols">${(nb.lessons || []).length ? `<div><h5>Lessons from the weekly review</h5><ul>${nb.lessons.slice(0, 4).map(x => `<li>${esc(x.text)}</li>`).join('')}</ul></div>` : ''}
    ${(nb.notes || []).length ? `<div><h5>Its notebook</h5><ul>${nb.notes.slice(-4).reverse().map(x => `<li>${esc(x.text)} <em>${esc(hm(x.at))}</em></li>`).join('')}</ul></div>` : ''}
    ${mine.length ? `<div><h5>Latest posts</h5><ul>${mine.map(p => `<li><em>${esc(FZK[p.kind] || p.kind)} · ${esc(hm(p.at))}</em> ${esc(p.headline)}</li>`).join('')}</ul></div>` : ''}</div>
    ${!mine.length && !(nb.notes || []).length && d.id !== 'research' ? '<p class="fz-fine">No posts yet: it speaks at its first meeting.</p>' : ''}</div>`;
}
function fzPost(F, p, ph) {
  const d = fzD(F, p.desk), open = !!FZ.open[p.id], to = (p.to || []).map(id => fzD(F, id).name).join(', ');
  const re = p.re && (F.feed || []).find(x => x.id === p.re);
  const [a, b] = bzSentences(p.body || '', 2);
  const all = [...(F.open || []), ...(F.resolved || [])];
  const stocks = (p.stocks || []).map(s => { const v = FZV[s.view] || [cap(s.view), '#8d93a3'];
    return `<button class="fz-tk" data-act="${ph ? 'w-pos' : 'stock'}" data-t="${esc(s.ticker)}" title="${esc(s.why || '')}" style="--c:${v[1]}"><b>${esc(s.ticker)}</b>${esc(v[0])}</button>`; }).join('');
  const preds = (p.preds || []).map(id => { const x = all.find(y => y.id === id); return x ? `<button class="fz-pc" data-fact="pred" data-id="${esc(id)}" title="${esc(x.question)}">${esc(id)} · ${x.status === 'open' ? x.prob + '%' : x.outcome ? 'came true' : x.outcome === 0 ? 'missed' : 'closed'}</button>` : ''; }).join('');
  const mood = FZM[p.mood];
  return `<article class="fz-post k-${esc(p.kind)}${p.urgent ? ' urgent' : ''}" style="--c:${d.color};--k:${FZKC[p.kind] || '#8d93a3'}">${fzAv(d, 34)}
    <div class="fz-pb"><div class="fz-ph"><b>${esc(d.name)}</b><span class="fz-kind">${esc(p.kind === 'briefing' && p.kind_label ? p.kind_label : FZK[p.kind] || p.kind)}${to && p.kind !== 'memo' ? ' → ' + esc(to) : ''}</span>
      ${p.severity && p.kind === 'challenge' ? `<span class="fz-sev s${p.severity}">${p.severity === 3 ? 'must answer' : p.severity === 2 ? 'important' : 'minor'}</span>` : ''}${p.urgent ? '<span class="fz-sev s3">urgent</span>' : ''}
      ${mood ? `<i class="fz-mood" role="img" aria-label="${esc(mood[1])}" style="background:${mood[0]}" title="${esc(mood[1])}"></i>` : ''}<time>${esc(new Date(p.at).toDateString() === new Date().toDateString() ? fzT(p.at) : hm(p.at) + ', ' + fzT(p.at))}</time></div>
      ${re && re.desk !== p.desk && p.kind !== 'memo' && p.kind !== 'note' ? `<p class="fz-re">↩ ${esc(fzD(F, re.desk).name)}: “${esc(String(re.headline || '').slice(0, 110))}”</p>` : ''}
      <h4>${esc(p.headline)}</h4>${p.body && p.body !== p.headline ? `<p>${esc(open ? p.body : a)}</p>` : ''}
      ${b || (p.sources || []).length ? `<button class="fz-more" data-fact="open" data-id="${esc(p.id)}">${open ? 'Show less' : b ? 'Read it all' : 'Sources'}</button>` : ''}
      ${stocks || preds ? `<div class="fz-tags">${stocks}${preds}</div>` : ''}${open && (p.sources || []).length ? `<div class="fz-srcs">${p.sources.map(fzSrc).join('')}</div>` : ''}</div></article>`;
}
function fzFeed(F, ph) {
  let P = F.feed || [];
  if (FZ.desk) P = P.filter(p => p.desk === FZ.desk || (p.to || []).includes(FZ.desk));
  const f = FZ.filter;
  if (f === 'top') P = P.filter(p => ['memo', 'briefing', 'ruling', 'alert', 'score', 'order', 'boss'].includes(p.kind) || (p.kind === 'challenge' && (p.severity || 1) >= 2) || (p.kind === 'reply' && p.changed));
  else if (f === 'memo') P = P.filter(p => p.kind === 'memo');
  else if (f === 'debate') P = P.filter(p => ['challenge', 'reply', 'note'].includes(p.kind));
  else if (f === 'pm') P = P.filter(p => p.desk === 'pm' || p.desk === 'boss');
  else if (f === 'alert') P = P.filter(p => ['alert', 'score'].includes(p.kind));
  const n = FZ.more ? 90 : ph ? 12 : 18;
  const chips = FZF.map(([k, l]) => `<button class="fz-f${FZ.filter === k ? ' on' : ''}" data-fact="filter" data-v="${k}">${l}</button>`).join('')
    + (FZ.desk ? `<button class="fz-f on desk" data-fact="desk" data-id="">${esc(fzD(F, FZ.desk).name)} ✕</button>` : '');
  return `<div class="fz-filt">${chips}</div><div class="fz-feed">${P.slice(0, n).map(p => fzPost(F, p, ph)).join('') || '<p class="fz-fine" style="padding:8px 2px">Nothing here yet. The desks post at their next meeting.</p>'}</div>
    ${P.length > n ? `<button class="fz-more wide" data-fact="morefeed">Show ${Math.min(P.length, 90) - n} more</button>` : ''}`;
}
function fzCard(F, x) {
  const d = fzD(F, x.desk), mv = (x.moves || []).map(m => `<span class="fz-mv"><b>${esc(m.ticker)}</b>${fzArrow(m.if_yes)}<em>/</em>${fzArrow(m.if_no)}</span>`).join('');
  return `<article class="fz-card" style="--c:${d.color}"><div class="fz-ch"><button class="fz-cid" data-fact="pred" data-id="${esc(x.id)}">${esc(x.id)}</button><time>known by ${esc(fmtD(x.by))}</time>${fzAv(d, 22)}</div>
    <h4>${esc(x.question)}</h4>${fzOdds(x.prob, x.market_odds, true)}<p class="fz-mk">${isNum(x.market_odds) ? `The betting markets say ${x.market_odds}% (the white tick)` : esc(d.name)}</p>
    <div class="fz-yn"><div class="y"><small>If yes</small><p>${esc(x.if_yes)}</p></div><div class="n"><small>If no</small><p>${esc(x.if_no)}</p></div></div>
    ${mv ? `<div class="fz-mvs"><small>Your stocks · yes / no</small>${mv}</div>` : ''}</article>`;
}
function fzPred(F, x) {
  const d = fzD(F, x.desk), on = FZ.pred === x.id, done = x.status !== 'open';
  const res = done ? `<span class="fz-res ${x.outcome ? 'y' : x.outcome === 0 ? 'n' : ''}">${x.outcome ? 'Came true' : x.outcome === 0 ? 'Didn’t happen' : 'Closed'}</span>` : fzOdds(x.prob, x.market_odds);
  return `<div class="fz-pr${on ? ' on' : ''}"><button class="fz-prh" data-fact="pred" data-id="${esc(x.id)}"><span class="fz-cid">${esc(x.id)}</span><span class="q">${esc(x.question)}</span>${res}<time>${esc(bzMD(x.by))}</time></button>
    ${on ? `<div class="fz-prx">${fzTrail(x.trail)}<p><b>${esc(d.name)}${done && isNum(x.prob) ? ` said ${x.prob}%` : ''}:</b> ${esc(x.why || '')}</p>${x.check ? `<p><b>How it’s graded:</b> ${esc(x.check)}</p>` : ''}
      ${isNum(x.market_odds) ? `<p><b>Betting markets:</b> ${x.market_odds}%</p>` : ''}${x.if_yes ? `<p><b>If yes:</b> ${esc(x.if_yes)}</p>` : ''}${x.if_no ? `<p><b>If no:</b> ${esc(x.if_no)}</p>` : ''}
      ${done && x.evidence ? `<p><b>What happened:</b> ${esc(x.evidence)}${x.grade && isNum(x.grade.brier) ? ` · Brier ${x.grade.brier.toFixed(2)}` : ''}</p>` : ''}</div>` : ''}</div>`;
}
function fzCal(F) {
  const C = F.calendar || []; if (!C.length) return '<p class="fz-fine">The forecasting desk fills this in at its next meeting.</p>';
  const by = {}; C.forEach(x => (by[x.date] = by[x.date] || []).push(x));
  const t0 = new Date(); t0.setHours(0, 0, 0, 0);
  return `<ol class="fz-cal">${Object.keys(by).sort().slice(0, FZ.more ? 30 : 12).map(k => { const dd = D(k);
    return `<li class="${dd < t0 ? 'past' : ''}${dd.getTime() === t0.getTime() ? ' today' : ''}"><time><b>${dd.getDate()}</b><span>${MON[dd.getMonth()]} · ${DOW[dd.getDay()]}</span></time><div>${by[k].map(x =>
      `<p class="i${x.importance || 1}"><i class="fz-ck">${esc(FZCK[x.kind] || 'Event')}</i><b>${esc(x.what)}</b>${x.time ? ` <em>${esc(x.time)}</em>` : ''}${x.why && (x.importance || 1) > 1 ? `<span>${esc(x.why)}</span>` : ''}</p>`).join('')}</div></li>`; }).join('')}</ol>`;
}
function fzRecord(F, fold) {
  const R = F.record || {}, f = R.firm || {}, bins = R.calibration || [];
  const W = 250, H = 210, P = 34, X = v => P + v / 100 * (W - P - 12), Y = v => H - P - v / 100 * (H - P - 12);
  let svg = `<svg class="fz-calib" viewBox="0 0 ${W} ${H}" role="img" aria-label="Calibration chart: for each range of odds the firm gave, how often it came true. ${bins.filter(b => b.n).map(b => `Said about ${b.said}%: came true ${b.came_true}% of ${b.n}.`).join(' ') || 'No graded predictions yet.'}">` + [0, 25, 50, 75, 100].map(v => `<line class="g" x1="${X(0)}" x2="${X(100)}" y1="${Y(v)}" y2="${Y(v)}"/>`).join('')
    + `<line class="diag" x1="${X(0)}" y1="${Y(0)}" x2="${X(100)}" y2="${Y(100)}"/>`
    + [0, 50, 100].map(v => `<text x="${X(v)}" y="${H - P + 16}" text-anchor="middle">${v}%</text><text x="${P - 6}" y="${Y(v) + 4}" text-anchor="end">${v}%</text>`).join('');
  bins.filter(b => b.n).forEach(b => { svg += `<circle class="dot" cx="${X(b.said)}" cy="${Y(b.came_true)}" r="${4 + Math.min(10, b.n)}"><title>Said about ${b.said}%: came true ${b.came_true}% of ${b.n} times</title></circle>`; });
  svg += `<text class="ax" x="${X(50)}" y="${H - 2}" text-anchor="middle">what the firm said</text><text class="ax" transform="translate(10 ${Y(50)}) rotate(-90)" text-anchor="middle">what came true</text>`
    + (bins.some(b => b.n) ? '' : `<text class="ax" x="${X(50)}" y="${Y(55)}" text-anchor="middle">dots appear as predictions</text><text class="ax" x="${X(50)}" y="${Y(55) + 16}" text-anchor="middle">get graded</text>`) + '</svg>';
  const by = Object.entries(R.by_desk || {}).sort((a, b) => (a[1].brier ?? 9) - (b[1].brier ?? 9));
  const fmt = v => isNum(v) ? v.toFixed(2) : '–';
  return `<div class="fz-nums five"><div><b>${R.resolved || 0}</b><span>graded</span></div><div><b>${R.open || 0}</b><span>still open</span></div>
      <div><b>${fmt(f.brier)}</b><span>firm’s Brier</span></div><div><b>${fmt(f.market_brier)}</b><span>markets’ Brier</span></div><div><b>${isNum(f.hit) ? Math.round(f.hit * 100) + '%' : '–'}</b><span>right</span></div></div>
    <div class="fz-recw">${svg}<div>${fold ? hqDet('rec-how', '<span class="hq-ph">How the grading works</span>', `<p class="fz-fine">The Brier score grades odds: 0 is perfect, 0.25 is what always saying 50% gets, lower is better. A well-calibrated firm’s dots sit on the dashed line: its 70% calls come true about 70% of the time.</p>
      <p class="fz-honest">Event predictions can only be measured going forward. Testing them on past events would be unfair, because the AI behind the desks already knows how those turned out. This record started on Nov 5, 2026.</p>`) : `<p class="fz-fine">The Brier score grades odds: 0 is perfect, 0.25 is what always saying 50% gets, lower is better. A well-calibrated firm’s dots sit on the dashed line: its 70% calls come true about 70% of the time.</p>
      <p class="fz-honest">Event predictions can only be measured going forward. Testing them on past events would be unfair, because the AI behind the desks already knows how those turned out. This record started on Nov 5, 2026.</p>`}
      ${by.length ? `<div class="fz-bd">${by.map(([id, c]) => { const d = fzD(F, id); return `<button data-fact="desk" data-id="${esc(id)}">${fzAv(d, 22)}<b>${esc(d.name)}</b><span>${c.n} graded</span><em>${fmt(c.brier)}</em></button>`; }).join('')}</div>` : ''}</div></div>`;
}
function fzMarkets(F) {
  const M = F.markets || []; if (!M.length) return '<p class="fz-fine">The odds load at the next meeting.</p>';
  return `<div class="fz-mks">${M.slice(0, FZ.mk ? 30 : 8).map(m => fzLink(m.url, `<span class="t"><b>${esc(m.title)}</b><small>${esc(m.src)}${m.ends ? ' · ends ' + esc(bzMD(m.ends)) : ''}</small></span>
      <span class="o">${(m.odds || []).slice(0, 3).map(o => `<span><em>${esc(o.name)}</em><i style="--p:${o.p}%"></i><b>${o.p}%</b></span>`).join('')}</span>`, 'fz-mkt')).join('')}</div>
    ${M.length > 8 ? `<button class="fz-more" data-fact="mk">${FZ.mk ? 'Show fewer' : `Show all ${M.length}`}</button>` : ''}${F.markets_at ? `<p class="fz-fine">Checked ${esc(fzAgo(F.markets_at))}. The firm only reads these public odds; it never bets.</p>` : ''}`;
}
function fzDay(F) {
  return `<ul class="fz-sch">${(F.schedule || []).map(s => `<li><b>${esc(s.at)}</b><span>${esc(s.label)}</span><em>${esc(s.days)}</em></li>`).join('')}
    <li><b>Every 30 min</b><span>News watch, every 2 hours on weekends; big news calls an emergency meeting</span><em>6 AM to 10:30 PM</em></li>
    <li><b>After 9:45 AM</b><span>Research desk, then the PM writes your briefing from the morning’s minutes</span><em>weekdays</em></li>
    <li><b>Fridays</b><span>Weekly review: grades every call and gives each desk its lessons</span><em>after the close</em></li></ul>
    <h5 class="fz-h5">Recent meetings</h5><ul class="fz-meets">${(F.meetings || []).map(m => `<li><i class="${esc(m.status)}"></i><b>${esc(m.label)}</b><span>${esc(hm(m.started))}${m.posts ? ' · ' + m.posts + ' posts' : ''}${m.status === 'failed' ? ' · failed' : m.status === 'paused' ? ' · stopped at a usage limit' : m.status === 'running' ? ' · now' : ''}</span></li>`).join('') || '<li><span>None yet.</span></li>'}</ul>`;
}
function fzSpark(st, t) {
  const has = v => (v || []).filter(isNum).length > 5;
  const p = (st.positions || []).find(x => x.ticker === t); if (p && has(p.spark)) return p.spark;
  const r = (st.radar || []).find(x => x.ticker === t); if (r && has(r.spark)) return r.spark;
  if (has((st.sparks || {})[t])) return st.sparks[t];
  for (const x of ((st.analyst || {}).strategies || [])) for (const pk of (x.picks || [])) if (pk.ticker === t && has(pk.spark)) return pk.spark;
  return null;
}
function fzAiWord(st, t) {
  const n = (st.radar || []).find(x => x.ticker === t && x.ai) || ((st.notes || {})[t] && { ai: st.notes[t].ai });
  if (!n || !n.ai || !n.ai.verdict) return '';
  const w = aiWord(n.ai.verdict), c = { 'v-buy': '#3ff2a3', 'v-sell': '#ff5f6e', 'v-hold': '#56cbff', 'v-decide': '#ffc65a' }[w[1]] || '#8d93a3';
  return `<span class="fz-vw" style="--c:${c}">Research: ${esc(w[0])}</span>`;
}
function fzIdeas(st, ph) {  // v5.1: what used to be the Ideas tab
  const A = st.analyst || {}, W = A.watchlist || [], act = (A.strategies || []).filter(x => x.status === 'active');
  const seen = new Set(W.map(w => String(w.ticker || '').toUpperCase()));
  const R = (st.radar || []).filter(x => x.ai && !seen.has(x.ticker) && seen.add(x.ticker)).slice(0, 4);
  const go = t => `data-act="${ph ? 'w-pos' : 'stock'}" data-t="${esc(t)}"`;
  const row = (t, body) => {
    const sp = fzSpark(st, t), last = sp ? sp.filter(isNum).slice(-1)[0] : null, up = sp && last >= sp.filter(isNum)[0];
    return `<button class="fz-idea" ${go(t)}><span class="fz-it"><b>${esc(t)}</b>${fzAiWord(st, t)}</span><span class="fz-ib">${body}</span>
      <span class="fz-isp">${sp ? spark(sp, { h: 30, c: up ? '#3ff2a3' : '#ff5f6e' }) : ''}<em>${isNum(last) ? money(last, true) : ''}</em></span></button>`;
  };
  const watch = W.map(w => row(String(w.ticker || '').toUpperCase(), `<p>${esc(w.why)}</p>${w.buy_if ? `<p class="if"><b>Buys if</b> ${esc(w.buy_if)}</p>` : ''}`)).join('');
  const strat = act.map(x => `<div class="fz-strat"><p><b>${esc(x.name)}</b><span>active strategy${isNum(x.avg_vs_spy) ? ` · tested: ${pct(x.avg_vs_spy)} a trade vs the S&amp;P` : ''} · would buy today</span></p>
    <div class="fz-tkcs">${(x.picks || []).map(p => `<button class="fz-tkc" ${go(p.ticker)}><b>${esc(p.ticker)}</b>${isNum(p.price) ? money(p.price, true) : ''}</button>`).join('') || '<span class="fz-fine">No stock passes it today.</span>'}</div></div>`).join('');
  const also = R.length ? `<h5 class="fz-h5">Also researched</h5>${R.map(x => { const ss = splitSentences(x.ai.summary || ''), say = (ss[0] || '').split(/\s+/).length > 3 ? ss[0] : ss.slice(0, 2).join(' '); return row(x.ticker, `<p>${esc(say)}</p>`); }).join('')}` : '';
  return `${watch || '<p class="fz-fine">The watchlist fills in with the PM’s next briefing.</p>'}${strat}${also}`;
}
/* ---------------- v5.4: the Firm's headquarters (an isometric office you explore) ----------------
   Every desk is a person at work in the office (team carpets), the PM sits in a glass office, the meeting room lights up
   during a meeting, the walls hold the firm's screens (the board, the scenario wall, the betting markets, a calendar, the
   ideas whiteboard), a trophy case holds the prediction record and the Brain core glows in the corner. Click anyone or
   anything: its story opens beside the office, folded (one line each, the rest a click away). Drawn in SVG, so it's sharp at
   every size, cheap to draw (no 3D engine, no lag) and works from the keyboard. Mac and phone share it (CT.firm). */
const HQ = { K: 32, FW: 20, FD: 15.6, WH: 4.0, OX: 472, OY: 150, W: 1066, H: 752 };
const HQPS = 1.38;  // people and their bubbles, in pixels per unit of K = 26
HQ.AX = 0.866 * HQ.K; HQ.AY = 0.5 * HQ.K;
const hqP = (x, y, z = 0) => [HQ.OX + (x - y) * HQ.AX, HQ.OY + (x + y) * HQ.AY - z * HQ.K];
const hqS = p => p[0].toFixed(1) + ',' + p[1].toFixed(1);
const hqPoly = (pts, a) => `<polygon points="${pts.map(hqS).join(' ')}"${a ? ' ' + a : ''}/>`;
function hqBox(x, y, z, w, d, h, c) {  // c = [top, front-left face, front-right face, top edge]
  return hqPoly([hqP(x, y + d, z), hqP(x + w, y + d, z), hqP(x + w, y + d, z + h), hqP(x, y + d, z + h)], `fill="${c[1]}"`)
    + hqPoly([hqP(x + w, y, z), hqP(x + w, y + d, z), hqP(x + w, y + d, z + h), hqP(x + w, y, z + h)], `fill="${c[2]}"`)
    + hqPoly([hqP(x, y, z + h), hqP(x + w, y, z + h), hqP(x + w, y + d, z + h), hqP(x, y + d, z + h)], `fill="${c[0]}"${c[3] ? ` stroke="${c[3]}" stroke-width="1"` : ''}`);
}
const hqHull = (x, y, z, w, d, h) => [hqP(x, y, z + h), hqP(x + w, y, z + h), hqP(x + w, y, z), hqP(x + w, y + d, z), hqP(x, y + d, z), hqP(x, y + d, z + h)];
const hqWA = (x1, x2, z1, z2) => [hqP(x1, 0, z1), hqP(x2, 0, z1), hqP(x2, 0, z2), hqP(x1, 0, z2)];  // on the back-right wall (y = 0)
const hqWB = (y1, y2, z1, z2) => [hqP(0, y1, z1), hqP(0, y2, z1), hqP(0, y2, z2), hqP(0, y1, z2)];  // on the back-left wall (x = 0)
// where everyone sits: the top-left corner of each desk on the floor (x runs to the right wall, y to the left wall)
const HQD = { washington: [2.15, 5.3], fed: [3.85, 5.3], forecast: [5.55, 5.3], mideast: [2.15, 10.3], asia: [3.85, 10.3], world: [5.55, 10.3],
  energy: [14.4, 4.8], chips: [17.4, 4.8], software: [14.4, 6.7], health: [17.4, 6.7], finance: [14.4, 8.6], industry: [17.4, 8.6], consumer: [14.4, 10.5],
  earnings: [7.6, 12.3], quant: [9.4, 12.3], research: [11.2, 12.3], risk: [13.8, 13.65], redteam: [15.35, 13.65], score: [16.9, 13.65], watch: [18.45, 13.65], pm: [9.4, 1.55],
  ops: [13.15, 2.05] };  // v7.4: the Operations desk sits at the PM's door
const HQL = { pm: 'Portfolio manager', washington: 'Washington', fed: 'Fed & economy', forecast: 'Forecasting', mideast: 'Middle East', asia: 'China & Asia', world: 'Europe & world',
  energy: 'Energy', chips: 'Chips & AI', software: 'Software', health: 'Healthcare', finance: 'Financials', industry: 'Industrials', consumer: 'Consumer',
  earnings: 'Earnings', quant: 'Quant', research: 'Research', risk: 'Risk', redteam: 'Red team', score: 'Scorekeeper', watch: 'News watch', ops: 'Operations', boss: 'You' };
const HQR = [['macro', 1.7, 4.15, 7.4, 7.05], ['geo', 1.7, 9.15, 7.4, 12.05], ['sector', 13.9, 3.7, 19.75, 12.05, [19.35, 11.9, 'y']], ['special', 7.15, 11.25, 13.0, 14.1], ['check', 13.45, 12.6, 19.9, 14.92]];  // v8: the sector label at the back of its carpet, where nothing covers it
const hqW = d => d.team === 'check' ? 1.3 : d.id === 'pm' ? 2.0 : 1.4;
function hqHeadOf(id) {
  const p = HQD[id]; if (!p) return null;
  const w = id === 'pm' ? 2.0 : ['risk', 'redteam', 'score', 'watch'].includes(id) ? 1.3 : 1.4;
  return hqP(p[0] + w / 2, p[1] - 0.42, id === 'pm' ? 1.95 : 1.75);
}
const HQDEFS = `<defs><linearGradient id="hqFloor" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#141827"/><stop offset="1" stop-color="#0a0c13"/></linearGradient>
  <linearGradient id="hqWA" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#171c2e"/><stop offset="1" stop-color="#0f1320"/></linearGradient>
  <linearGradient id="hqWB" x1="1" y1="0" x2="0" y2="0"><stop offset="0" stop-color="#141a2b"/><stop offset="1" stop-color="#0b0e18"/></linearGradient>
  <linearGradient id="hqCore" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#efeaff"/><stop offset=".45" stop-color="#9a80ff"/><stop offset="1" stop-color="#3a7bff" stop-opacity=".55"/></linearGradient>
  <radialGradient id="hqHalo"><stop offset="0" stop-color="#a38cff" stop-opacity=".5"/><stop offset="1" stop-color="#a38cff" stop-opacity="0"/></radialGradient>
  <radialGradient id="hqLamp"><stop offset="0" stop-color="#56cbff" stop-opacity=".16"/><stop offset="1" stop-color="#56cbff" stop-opacity="0"/></radialGradient></defs>`;
function hqLook(id) {  // v8: each person's own hair, from their name, so the team doesn't look like pins
  let h = 7; for (const ch of String(id || '')) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return { hair: h % 4, hc: ['#1d1726', '#3b2a1c', '#6b4a2b', '#d8c48f'][(h >> 3) % 4] };
}
function hqPerson(x, y, col, s, px = 1, look) {  // px > 1: a closer camera (the boardroom), so the widths grow too
  const b = hqP(x, y, 0), X = b[0], wa = hqP(x, y, 0.62)[1], sh = hqP(x, y, 1.36 * s)[1], hy = hqP(x, y, 1.62 * s)[1], k = HQPS * s * px, w1 = 8.5 * k, w2 = 6 * k, r = 6.4 * k, o = px;
  const f = v => v.toFixed(1);
  const d = `M${f(X - w2)},${f(wa)} L${f(X - w1)},${f(sh + 4 * o)} Q${f(X - w1)},${f(sh - o)} ${f(X - w1 + 5 * o)},${f(sh - o)} L${f(X + w1 - 5 * o)},${f(sh - o)} Q${f(X + w1)},${f(sh - o)} ${f(X + w1)},${f(sh + 4 * o)} L${f(X + w2)},${f(wa)} Z`;
  const L = look || {}, cap = (y0, w) => `<path d="M${f(X - r * w)},${f(hy - r * y0)} A${f(r)},${f(r)} 0 0 1 ${f(X + r * w)},${f(hy - r * y0)} Z" fill="${L.hc}"/>`;
  const hair = L.hair === 0 ? cap(.25, .97) : L.hair === 1 ? cap(.45, .9) : L.hair === 3 ? cap(.25, .97) + `<circle cx="${f(X + r * .55)}" cy="${f(hy - r * 1.05)}" r="${f(r * .36)}" fill="${L.hc}"/>` : '';
  return `<path d="${d}" fill="${col}"/><path d="${d}" fill="#05060a" opacity=".42"/><circle cx="${f(X)}" cy="${f(hy)}" r="${r}" fill="${col}"/><circle cx="${f(X)}" cy="${f(hy)}" r="${r}" fill="#fff" opacity=".5"/>`
    + `<circle cx="${f(X - 2 * o)}" cy="${f(hy - 2 * o)}" r="${(r * .38).toFixed(1)}" fill="#fff" opacity=".35"/>${hair}`;
}
function hqPlant(x, y) {
  const c = hqP(x + 0.25, y + 0.25, 0.75);
  return hqBox(x, y, 0, 0.5, 0.5, 0.4, ['#4a3b30', '#33281f', '#281f18'])
    + `<circle cx="${c[0].toFixed(1)}" cy="${c[1].toFixed(1)}" r="12" fill="#2b8a56"/><circle cx="${(c[0] - 7).toFixed(1)}" cy="${(c[1] - 8).toFixed(1)}" r="8" fill="#37a368"/><circle cx="${(c[0] + 6).toFixed(1)}" cy="${(c[1] - 5).toFixed(1)}" r="6" fill="#43b877"/>`;
}
const hqChair = (px, py) => hqBox(px - 0.32, py - 0.34, 0, 0.64, 0.6, 0.42, ['#2a2f40', '#1b1f2c', '#151822']) + hqBox(px - 0.32, py - 0.44, 0.42, 0.64, 0.1, 0.8, ['#30364a', '#1f2333', '#181b27']);
function hqDeskArt(d, x, y, w, s) {  // chair, person, desk, monitor, nameplate, and the state above the head
  const dd = 0.95, h = 0.72, px = x + w / 2, py = y - 0.42, col = d.color || '#8d93a3';
  let g = hqChair(px, py) + hqPerson(px, py, col, s, 1, hqLook(d.id)) + hqBox(x, y, 0, w, dd, h, ['#323b52', '#1d2333', '#151a27', 'rgba(255,255,255,.12)']);
  const lid = cx => `<ellipse class="hq-glow" cx="${hqP(cx, y + 0.2, h + 0.35)[0].toFixed(1)}" cy="${hqP(cx, y + 0.2, h + 0.35)[1].toFixed(1)}" rx="18" ry="12" fill="${col}"/>`
    + hqBox(cx - 0.13, y + 0.12, h, 0.26, 0.16, 0.06, ['#3a4258', '#242a3a', '#1c2130'])  // v8: a monitor on a stand; it lights up while the desk writes
    + hqPoly([hqP(cx - 0.34, y + 0.24, h + 0.06), hqP(cx + 0.34, y + 0.24, h + 0.06), hqP(cx + 0.34, y + 0.12, h + 0.6), hqP(cx - 0.34, y + 0.12, h + 0.6)], `class="hq-lid" fill="${col}" stroke="rgba(255,255,255,.22)" stroke-width=".8"`);
  g += d.id === 'pm' ? lid(px - 0.45) + lid(px + 0.45) : lid(px);
  const pl = hqP(x + w, y + dd / 2, 0.3), pw = String(d.short || '').length > 2 ? 27 : 24;  // v8: the nameplate on the desk's right side, which the next row never covers
  g += `<g class="hq-plate" transform="matrix(.866 -.5 0 1 ${pl[0].toFixed(1)} ${pl[1].toFixed(1)})"><rect x="${-pw / 2}" y="-12" width="${pw}" height="15" rx="3.5" fill="#0a0c13" fill-opacity=".92" stroke="${col}" stroke-opacity=".75"/><text x="0" y="-1" text-anchor="middle" fill="${col}">${esc(d.short || '')}</text></g>`;
  const hd = hqP(px, py, 1.62 * s), top = hd[1] - 6.4 * HQPS * s;
  if (d.running) g += `<g class="hq-typing" transform="translate(${hd[0].toFixed(1)} ${(top - 13).toFixed(1)})"><rect x="-16" y="-9" width="32" height="18" rx="9" fill="#0b1712" stroke="${col}" stroke-width="1.4"/><circle cx="-7" r="2.6" fill="${col}"/><circle cx="0" r="2.6" fill="${col}"/><circle cx="7" r="2.6" fill="${col}"/></g>`;
  else if (d._recent) g += `<path class="hq-said" transform="translate(${(hd[0] + 10).toFixed(1)} ${(top - 9).toFixed(1)})" d="M-8,-8h16a3,3 0 0 1 3,3v7a3,3 0 0 1-3,3h-8l-6,5v-5h-2a3,3 0 0 1-3,-3v-7a3,3 0 0 1 3,-3z" fill="${col}"/>`;
  return { g, top: top - 24 };
}
const hqObj = (id, sel, aria, tip, inner, hit, sc) => `<g class="hq-o${sel === id ? ' sel' : ''}" data-fact="sel" data-id="${esc(id)}" role="button" tabindex="0" aria-label="${esc(aria)}" data-tip="${esc(tip)}"${sc ? ` style="--sc:${sc}"` : ''}>${inner}${hqPoly(hit, 'class="hq-hit"')}</g>`;
const hqLabel = (x, y, t, on) => `<text class="hq-lb${on ? ' on' : ''}" x="${x.toFixed(1)}" y="${y.toFixed(1)}" text-anchor="middle">${esc(t)}</text>`;
function hqDesk(d, sel) {
  const [x, y] = HQD[d.id], w = hqW(d), dd = 0.95, on = sel === 'desk:' + d.id, shown = on || d.running;
  const ring = on ? `<ellipse class="hq-ring" cx="${hqP(x + w / 2, y + 0.1)[0].toFixed(1)}" cy="${hqP(x + w / 2, y + 0.1)[1].toFixed(1)}" rx="${(1.45 * HQ.AX).toFixed(1)}" ry="${(1.45 * HQ.AY).toFixed(1)}" fill="${d.color}" fill-opacity=".14" stroke="${d.color}" stroke-opacity=".7"/>` : '';
  const art = hqDeskArt(d, x, y, w, 1);
  const state = d.running ? 'writing now' : d.last_at ? 'last post ' + fzAgo(d.last_at) : 'no posts yet';
  const hit = [hqP(x, y - 0.9, 2.2), hqP(x + w, y - 0.9, 2.2), hqP(x + w, y - 0.9, 0), hqP(x + w, y + dd, 0), hqP(x, y + dd, 0), hqP(x, y + dd, 2.2)];
  const lb = hqP(x + w / 2, y + dd / 2), low = hqP(x + w, y + dd)[1];
  return { z: x + y + w / 2, svg: hqObj('desk:' + d.id, sel, `${d.name}, ${state}`, `${d.name} · ${state}`, `<g class="hq-desk${d.running ? ' run' : ''}">${ring}${art.g}</g>`, hit, d.color),
    label: shown ? hqLabel(lb[0], low + 18, HQL[d.id] || d.name, true) : '' };  // a name shows when it's picked or writing; hover shows the rest
}
function hqOffice(F, sel) {  // the PM's glass office against the back-right wall
  const d = (F.desks || []).find(x => x.id === 'pm') || { id: 'pm', color: '#c3b4ff', name: 'Portfolio manager' };
  const x0 = 8.0, y0 = 0.3, x1 = 12.6, y1 = 3.55, H = 2.4, [x, y] = HQD.pm;
  let g = hqPoly([hqP(x0, y0), hqP(x1, y0), hqP(x1, y1), hqP(x0, y1)], 'fill="#c3b4ff" fill-opacity=".07" stroke="#c3b4ff" stroke-opacity=".25"');
  g += hqPlant(11.85, 0.6) + hqBox(8.3, 0.45, 0, 1.4, 0.42, 1.45, ['#262c3e', '#1a1f2c', '#141822']);  // a plant and a shelf
  g += hqDeskArt(d, x, y, 2.0, 1.12).g;
  g += hqPoly([hqP(x0, y1, 0), hqP(x1, y1, 0), hqP(x1, y1, H), hqP(x0, y1, H)], 'fill="#c3b4ff" fill-opacity=".045" stroke="#c3b4ff" stroke-opacity=".5"')
    + hqPoly([hqP(x1, y0, 0), hqP(x1, y1, 0), hqP(x1, y1, H), hqP(x1, y0, H)], 'fill="#c3b4ff" fill-opacity=".03" stroke="#c3b4ff" stroke-opacity=".38"');
  const state = d.running ? 'writing the briefing now' : d.last_at ? 'last post ' + fzAgo(d.last_at) : 'writes your briefing';
  const lb = hqP(10.3, 1.9), low = hqP(x1, y1)[1];
  return { z: 11.0, svg: hqObj('pm', sel, `Portfolio manager's office, ${state}`, `Portfolio manager · ${state}`, g, hqHull(x0, y0, 0, x1 - x0, y1 - y0, H), '#c3b4ff'),
    label: '' };
}
function hqMeeting(F, sel) {
  const m = F.meeting, x = 8.3, y = 6.95, w = 3.4, d = 1.4, x0 = 7.45, y0 = 5.45, x1 = 12.65, y1 = 9.75;
  let g = hqPoly([hqP(x0, y0), hqP(x1, y0), hqP(x1, y1), hqP(x0, y1)], `fill="#3ff2a3" fill-opacity="${m ? .09 : .035}" stroke="#3ff2a3" stroke-opacity=".3" stroke-dasharray="5 6"`);
  [8.95, 10.0, 11.05].forEach(cx => { g += hqChair(cx, y - 0.35); });
  g += hqBox(x, y, 0, w, d, 0.62, [m ? '#1d3a31' : '#242c3f', '#171c29', '#11151e', m ? 'rgba(63,242,163,.7)' : 'rgba(255,255,255,.09)']);
  [8.95, 10.0, 11.05].forEach(cx => { g += hqBox(cx - 0.32, y + d + 0.25, 0, 0.64, 0.6, 0.42, ['#2a2f40', '#1b1f2c', '#151822']) + hqBox(cx - 0.32, y + d + 0.75, 0.42, 0.64, 0.1, 0.8, ['#30364a', '#1f2333', '#181b27']); });
  if (m) { const c = hqP(x + w / 2, y + d / 2, 1.35);
    g += `<g class="hq-holo"><ellipse cx="${c[0].toFixed(1)}" cy="${c[1].toFixed(1)}" rx="44" ry="15" fill="none" stroke="#3ff2a3" stroke-width="1.6"/><ellipse cx="${c[0].toFixed(1)}" cy="${(c[1] - 10).toFixed(1)}" rx="26" ry="9" fill="#3ff2a3" fill-opacity=".18" stroke="#3ff2a3" stroke-opacity=".7"/></g>`; }
  const tip = m ? `${m.label} now` : (F.next || [])[0] ? `Meeting room · next: ${F.next[0].label}, ${fzWhen(F.next[0].at)}` : 'Meeting room';
  const lb = hqP((x0 + x1) / 2, (y0 + y1) / 2), low = hqP(x1, y1)[1];
  return { z: x + y + 2.5, svg: hqObj('meeting', sel, m ? `Meeting room, ${m.label} in progress` : 'Meeting room', tip, g, hqHull(x0, y0, 0, x1 - x0, y1 - y0, 1.9), '#3ff2a3'),
    label: m ? hqLabel(lb[0], low + 4, m.label + ' now', true) : '' };
}
function hqCore(st, sel) {  // the Brain: a glowing core in the back corner
  const A = st.analyst || {}, b = hqP(1.6, 1.6, 0.34), t = hqP(1.6, 1.6, 2.75);
  let g = hqBox(0.85, 0.85, 0, 1.5, 1.5, 0.34, ['#2c2548', '#1d1832', '#161228', 'rgba(195,180,255,.3)']);
  g += `<ellipse cx="${b[0].toFixed(1)}" cy="${((b[1] + t[1]) / 2).toFixed(1)}" rx="46" ry="60" fill="url(#hqHalo)"/>`
    + `<rect x="${(b[0] - 13).toFixed(1)}" y="${t[1].toFixed(1)}" width="26" height="${(b[1] - t[1]).toFixed(1)}" rx="13" fill="url(#hqCore)"/>`
    + `<ellipse class="hq-orbit" cx="${b[0].toFixed(1)}" cy="${((b[1] + t[1]) / 2 + 6).toFixed(1)}" rx="31" ry="10" fill="none" stroke="#c3b4ff" stroke-opacity=".7" stroke-width="1.4"/>`
    + `<circle class="hq-pulse" cx="${b[0].toFixed(1)}" cy="${(t[1] + 13).toFixed(1)}" r="6.5" fill="#fff"/>`;
  const L = (A.lessons || []).length;
  return { z: 3.2, svg: hqObj('brain', sel, `The firm's brain, ${L} lessons`, `The firm’s brain · ${L} lessons, ${(A.strategies || []).length} strategies tested`, g, hqHull(0.85, 0.85, 0, 1.5, 1.5, 2.95), '#a38cff'),
    label: '' };
}
function hqTrophy(F, sel) {  // the prediction record: a glass trophy case by the left wall
  const R = F.record || {}, f = R.firm || {}, won = Math.round((f.hit || 0) * (f.n || 0)), x = 0.2, y = 12.35, w = 0.85, d = 2.45, h = 2.3;
  const graded = R.resolved || 0, first = (F.open || []).map(z => z.by).filter(Boolean).sort()[0];  // v8: nothing graded yet → a plaque, not nine empty trophies
  let g = hqBox(x, y, 0, w, d, 0.3, ['#3a3026', '#2a221b', '#211b15']);
  for (let s = 0; s < 3; s++) {
    const z = 0.3 + s * 0.66;
    g += hqPoly([hqP(x, y, z), hqP(x + w, y, z), hqP(x + w, y + d, z), hqP(x, y + d, z)], 'fill="#3a3026" fill-opacity=".6"');
    for (let k = 0; k < (graded ? 3 : 1); k++) {
      const i = s * 3 + k, p = hqP(x + w / 2, y + (graded ? 0.42 + k * 0.8 : 1.22), z), X = p[0], Y = p[1], gold = i < won;
      g += `<path d="M${(X - 5).toFixed(1)},${(Y - 15).toFixed(1)}h10v4a5,5 0 0 1-10,0zM${(X - 1.5).toFixed(1)},${(Y - 6.5).toFixed(1)}h3v4h3v2h-9v-2h3z" fill="${gold ? '#ffd36e' : 'none'}" stroke="#ffd36e" stroke-opacity="${gold ? 1 : .3}" stroke-width="1"/>`;
    }
  }
  if (!graded) g += hqPoly([hqP(x + 0.08, y + d, 0.98), hqP(x + w - 0.08, y + d, 0.98), hqP(x + w - 0.08, y + d, 1.3), hqP(x + 0.08, y + d, 1.3)], 'fill="#ffd36e" fill-opacity=".55" stroke="#ffe6b0" stroke-opacity=".5"');
  g += hqPoly([hqP(x, y + d, 0), hqP(x + w, y + d, 0), hqP(x + w, y + d, h), hqP(x, y + d, h)], 'fill="#ffe6b0" fill-opacity=".05" stroke="#ffd36e" stroke-opacity=".4"')
    + hqPoly([hqP(x + w, y, 0), hqP(x + w, y + d, 0), hqP(x + w, y + d, h), hqP(x + w, y, h)], 'fill="#ffe6b0" fill-opacity=".07" stroke="#ffd36e" stroke-opacity=".45"')
    + hqPoly([hqP(x, y, h), hqP(x + w, y, h), hqP(x + w, y + d, h), hqP(x, y + d, h)], 'fill="#ffe6b0" fill-opacity=".08" stroke="#ffd36e" stroke-opacity=".4"');
  const lb = hqP(x + w / 2, y + d / 2), low = hqP(x + w, y + d)[1];
  const tip = graded ? `Trophy case · ${graded} graded, ${R.open || 0} still open` : `Trophy case · nothing graded yet${first ? ', first grades ' + bzMD(first) : ''}`;
  return { z: x + y + 1.4, svg: hqObj('record', sel, graded ? `Trophy case: ${graded} predictions graded` : 'Trophy case: nothing graded yet', tip, g, hqHull(x, y, 0, w, d, h), '#ffd36e'),
    label: '' };
}
function hqVerdict(st, t) {
  const n = (st.radar || []).find(x => x.ticker === t && x.ai) || ((st.notes || {})[t] && { ai: st.notes[t].ai });
  return ((n && n.ai && n.ai.verdict) || '').toLowerCase();
}
function hqRoom(F, st, sel) {  // floor, walls, carpets and the screens on the walls (each screen opens its room)
  const { FW, FD, WH } = HQ, TC = {};
  (F.teams || []).forEach(t => { TC[t.id] = t; });
  let s = hqPoly(hqWA(0, FW, 0, WH), 'fill="url(#hqWA)"') + hqPoly(hqWB(0, FD, 0, WH), 'fill="url(#hqWB)"');
  s += `<path d="M${hqS(hqP(0, FD, WH))}L${hqS(hqP(0, 0, WH))}L${hqS(hqP(FW, 0, WH))}" fill="none" stroke="rgba(195,180,255,.28)" stroke-width="1.6"/><path d="M${hqS(hqP(0, 0, 0))}L${hqS(hqP(0, 0, WH))}" stroke="rgba(255,255,255,.07)"/>`;
  [3.5, 8.5, 13.5, 17.5].forEach(x => { const c = hqP(x, 0, WH - 0.25); s += `<ellipse cx="${c[0].toFixed(1)}" cy="${(c[1] + 30).toFixed(1)}" rx="70" ry="44" fill="url(#hqLamp)"/>`; });  // ceiling light washes
  s += hqWindows();  // v8: the city outside, like the boardroom's windows
  s += hqPoly([hqP(0, FD), hqP(FW, FD), hqP(FW, FD, -0.4), hqP(0, FD, -0.4)], 'fill="#07080d"') + hqPoly([hqP(FW, 0), hqP(FW, FD), hqP(FW, FD, -0.4), hqP(FW, 0, -0.4)], 'fill="#05060a"');
  s += hqPoly([hqP(0, 0), hqP(FW, 0), hqP(FW, FD), hqP(0, FD)], 'fill="url(#hqFloor)"');
  let grid = '';
  for (let i = 1; i < FW; i++) grid += `M${hqS(hqP(i, 0))}L${hqS(hqP(i, FD))}`;
  for (let j = 1; j < FD; j++) grid += `M${hqS(hqP(0, j))}L${hqS(hqP(FW, j))}`;
  s += `<path d="${grid}" stroke="rgba(255,255,255,.028)" fill="none"/>`;
  HQR.forEach(([id, x0, y0, x1, y1, at]) => {
    const t = TC[id] || { color: '#8d93a3', name: id }, o = hqP(at ? at[0] : x0 + 0.3, at ? at[1] : y1 + 0.5);  // the team's name, painted on the floor just in front of its carpet
    const m = at && at[2] === 'y' ? '.866 -.5 .866 .5' : '.866 .5 -.866 .5';  // v8: or up its right edge, where no desk stands in front
    s += hqPoly([hqP(x0, y0), hqP(x1, y0), hqP(x1, y1), hqP(x0, y1)], `fill="${t.color}" fill-opacity=".075" stroke="${t.color}" stroke-opacity=".32" stroke-width="1.2"`)
      + `<text class="hq-rugl" aria-hidden="true" transform="matrix(${m} ${o[0].toFixed(1)} ${o[1].toFixed(1)})" fill="${t.color}">${esc(String(t.name).toUpperCase())}</text>`;
  });
  let labels = '';  // v8: names lie on the surfaces: wall screens get theirs on the wall above, rooms get theirs on the floor
  const wl = (p, m, t, id, col) => { labels += `<text class="hq-wl${sel === id ? ' on' : ''}" transform="matrix(${m} ${p[0].toFixed(1)} ${p[1].toFixed(1)})" fill="${col}">${esc(t.toUpperCase())}</text>`; };
  const wlB = (a, b, z2, t, id, col) => wl(hqP(0, b, z2 + 0.22), '.866 -.5 0 1', t, id, col);  // the left wall: reads toward the corner
  const wlA = (a, b, z2, t, id, col) => wl(hqP(a, 0, z2 + 0.22), '.866 .5 0 1', t, id, col);   // the right wall
  const fl = (x, y, t, id, col, up) => { const o = hqP(x, y); labels += `<text class="hq-rugl r${sel === id ? ' on' : ''}" aria-hidden="true" transform="matrix(${up ? '.866 -.5 .866 .5' : '.866 .5 -.866 .5'} ${o[0].toFixed(1)} ${o[1].toFixed(1)})" fill="${col}">${esc(t.toUpperCase())}</text>`; };
  // the board (left wall): the latest posts as lines, a dot in each desk's color
  const posts = (F.feed || []).filter(p => ['memo', 'briefing', 'ruling', 'alert', 'challenge', 'reply'].includes(p.kind)).slice(0, 6);
  let b = hqPoly(hqWB(5.3, 9.0, 0.95, 3.35), 'fill="#0a1121" stroke="#56cbff" stroke-opacity=".38"');
  posts.forEach((p, i) => { const z = 3.06 - i * 0.38, c = fzD(F, p.desk).color || '#8d93a3', len = Math.min(2.75, 0.9 + String(p.headline || '').length / 30);
    b += hqPoly(hqWB(5.6, 5.85, z - 0.1, z + 0.1), `fill="${c}"`) + hqPoly(hqWB(6.05, 6.05 + len, z - 0.055, z + 0.055), 'fill="#c5cad6" fill-opacity=".32"'); });
  const today = (F.feed || []).filter(p => new Date(p.at).toDateString() === new Date().toDateString()).length;
  s += hqObj('board', sel, `The board, ${today} posts today`, `The board · ${today} posts today`, b, hqWB(5.3, 9.0, 0.95, 3.35), '#56cbff');
  wlB(5.3, 9.0, 3.35, 'The board', 'board', '#56cbff');
  // the calendar (left wall): the next 15 days, lit where something's due
  const days = {}; (F.calendar || []).forEach(x => { days[x.date] = Math.max(days[x.date] || 0, +x.importance || 1); });
  let c = hqPoly(hqWB(2.0, 4.75, 1.2, 3.25), 'fill="#0d1222" stroke="#56cbff" stroke-opacity=".3"') + hqPoly(hqWB(2.0, 4.75, 3.0, 3.25), 'fill="#ff5f6e" fill-opacity=".55"');
  const t0 = new Date(); t0.setHours(0, 0, 0, 0);
  const key = dt => `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
  let nextEv = null;
  for (let i = 0; i < 15; i++) {
    const col = i % 5, row = Math.floor(i / 5), dt = new Date(t0.getTime() + i * 864e5), imp = days[key(dt)] || 0, y1 = 2.15 + col * 0.52, z2 = 2.85 - row * 0.52;
    if (imp && !nextEv) nextEv = dt;
    c += hqPoly(hqWB(y1, y1 + 0.42, z2 - 0.4, z2), `fill="${imp >= 3 ? '#ffb454' : imp === 2 ? '#56cbff' : imp ? 'rgba(86,203,255,.4)' : 'rgba(255,255,255,.07)'}"${i === 0 ? ' stroke="#fff" stroke-opacity=".8"' : ''}`);
  }
  s += hqObj('calendar', sel, 'Calendar', nextEv ? `Calendar · next event ${fzWhen(nextEv.toISOString()).replace(/ at .*/, '')}` : 'Calendar', c, hqWB(2.0, 4.75, 1.2, 3.25), '#56cbff');
  wlB(2.0, 4.75, 3.25, 'Calendar', 'calendar', '#56cbff');
  // the ideas whiteboard (left wall): a sticky note per stock The firm is watching
  const W = (st.analyst || {}).watchlist || [];
  let iw = hqPoly(hqWB(9.65, 11.95, 1.0, 3.0), 'fill="#d8dee9" fill-opacity=".1" stroke="#e6ecf5" stroke-opacity=".38"');
  W.slice(0, 8).forEach((w, i) => { const v = hqVerdict(st, String(w.ticker || '').toUpperCase()), y1 = 9.88 + (i % 4) * 0.52, z2 = 2.8 - Math.floor(i / 4) * 0.82;
    iw += hqPoly(hqWB(y1, y1 + 0.42, z2 - 0.6, z2), `fill="${v === 'buy' ? '#3ff2a3' : v === 'wait' || v === 'watch' ? '#ffc65a' : v === 'avoid' || v === 'sell' ? '#ff8a65' : '#56cbff'}" fill-opacity=".85"`); });
  s += hqObj('ideas', sel, `Ideas whiteboard, ${W.length} stocks on it`, `Ideas · ${W.length} stocks the firm is watching`, iw, hqWB(9.65, 11.95, 1.0, 3.0), '#ffc65a');
  wlB(9.65, 11.95, 3.0, 'Ideas', 'ideas', '#ffc65a');
  // the betting markets ticker (right wall)
  const M = (F.markets || []).slice(0, 5);
  let mk = hqPoly(hqWA(2.6, 6.8, 1.0, 3.1), 'fill="#0a1222" stroke="#56cbff" stroke-opacity=".38"');
  M.forEach((m, i) => { const p = ((m.odds || [])[0] || {}).p || 0, z = 2.8 - i * 0.38;
    mk += hqPoly(hqWA(2.9, 6.5, z - 0.08, z + 0.08), 'fill="#fff" fill-opacity=".05"') + hqPoly(hqWA(2.9, 2.9 + 3.6 * p / 100, z - 0.08, z + 0.08), `fill="#56cbff" fill-opacity="${(.35 + .5 * p / 100).toFixed(2)}"`); });
  s += hqObj('markets', sel, 'Betting markets board', `Betting markets · ${(F.markets || []).length} sets of odds`, mk, hqWA(2.6, 6.8, 1.0, 3.1), '#56cbff');
  wlA(2.6, 6.8, 3.1, 'Betting markets', 'markets', '#56cbff');
  // the scenario wall (right wall): a bar per big event, the white tick is the betting markets
  const C = (F.cards || []).slice(0, 4);
  let sw = hqPoly(hqWA(13.3, 19.7, 0.9, 3.35), 'fill="#0b1120" stroke="#3ff2a3" stroke-opacity=".32"');
  C.forEach((x, i) => { const x1 = 13.6 + i * 1.53, p = x.prob || 0, col = p >= 60 ? '#3ff2a3' : p <= 40 ? '#ff8a65' : '#ffc65a', zt = z => 1.3 + 1.7 * z / 100;
    sw += hqPoly(hqWA(x1, x1 + 1.3, 1.2, 3.1), 'fill="#fff" fill-opacity=".04"') + hqPoly(hqWA(x1 + 0.42, x1 + 0.88, 1.3, zt(p)), `fill="${col}" fill-opacity=".88"`)
      + (isNum(x.market_odds) ? hqPoly(hqWA(x1 + 0.27, x1 + 1.03, zt(x.market_odds) - 0.03, zt(x.market_odds) + 0.03), 'fill="#fff"') : ''); });
  s += hqObj('predictions', sel, `Scenario wall, ${(F.open || []).length} open predictions`, `Scenario wall · ${(F.open || []).length} open predictions`, sw, hqWA(13.3, 19.7, 0.9, 3.35), '#3ff2a3');
  wlA(13.3, 19.7, 3.35, 'Scenario wall', 'predictions', '#3ff2a3');
  fl(8.3, 4.05, 'Portfolio manager', 'pm', '#c3b4ff'); fl(12.95, 9.6, 'Meeting room', 'meeting', '#3ff2a3', true); fl(1.05, 2.85, 'Brain', 'brain', '#a38cff'); fl(0.45, 15.25, 'Record', 'record', '#ffd36e');
  s += labels + hqPlant(0.75, 9.15) + hqPlant(12.95, 0.75) + hqPlant(19.3, 0.75);  // the labels under everything, then a few plants
  return { svg: s, labels: '' };
}
function hqWindows() {  // v8: the city outside, on the back walls, as it looks at this time of day (the boardroom's windows)
  const hr = new Date().getHours();
  const sky = hr < 6 || hr >= 20 ? ['#060a1b', '#19214b', 1] : hr < 8 ? ['#2f3d6e', '#e3a06f', .55] : hr < 17 ? ['#33609f', '#8fb4de', .12] : ['#252a58', '#e5875b', .7];
  let g = `<defs><linearGradient id="hqSky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${sky[0]}"/><stop offset="1" stop-color="${sky[1]}"/></linearGradient></defs>`;
  let seed = 7; const rnd = () => (seed = (seed * 9301 + 49297) % 233280) / 233280;
  const win = (P, a, b, z1, z2, splits) => {  // P(u, z): a point on the wall, a..b along it
    g += hqPoly([P(a, z1), P(b, z1), P(b, z2), P(a, z2)], 'fill="url(#hqSky)"');
    for (let u = a; u < b - 0.05;) {
      const w = 0.3 + rnd() * 0.5, u2 = Math.min(b, u + w), top = z1 + 0.25 + rnd() * 1.3;
      g += hqPoly([P(u, z1), P(u2, z1), P(u2, top), P(u, top)], `fill="${sky[2] > .5 ? '#0b0f1f' : '#24304a'}"`);
      if (sky[2] > .3) for (let wz = z1 + 0.1; wz < top - 0.1; wz += 0.18) for (let wu = u + 0.05; wu < u2 - 0.08; wu += 0.14) if (rnd() < 0.3 * sky[2] + 0.04)
        g += hqPoly([P(wu, wz), P(wu + 0.06, wz), P(wu + 0.06, wz + 0.07), P(wu, wz + 0.07)], 'fill="#ffd98a" fill-opacity=".72"');
      u = u2 + 0.03 + rnd() * 0.1;
    }
    splits.forEach(x => { g += hqPoly([P(x - 0.08, z1), P(x + 0.08, z1), P(x + 0.08, z2), P(x - 0.08, z2)], 'fill="#151a2b"'); });
    g += hqPoly([P(a, z1), P(b, z1), P(b, z2), P(a, z2)], 'fill="#9ab8ff" fill-opacity=".04" stroke="#2f3754" stroke-width="2"');
  };
  win((u, z) => hqP(u, 0, z), 7.3, 12.9, 1.0, 3.4, [9.15, 11.05]);  // behind the PM's glass office
  g += hqBox(7.2, 0, 0.93, 5.8, 0.12, 0.07, ['#2a3149', '#1c2133', '#161a28']);
  win((u, z) => hqP(0, u, z), 12.45, 15.3, 1.0, 3.3, [13.85]);     // the far end of the left wall
  g += hqBox(0, 12.35, 0.93, 0.12, 3.05, 0.07, ['#2a3149', '#1c2133', '#161a28']);
  return g;
}
function hqArcs(F) {  // who's talking to whom (the last 8 hours): notes, challenges, answers, rulings
  const now = Date.now(), seen = new Set(), out = [];
  for (const p of F.feed || []) {
    if (!['note', 'challenge', 'reply', 'ruling'].includes(p.kind) || now - Date.parse(p.at) > 4 * 3600e3) continue;
    for (const to of p.to || []) {
      const k = p.desk + '>' + to;
      if (to === p.desk || seen.has(k) || !HQD[p.desk] || !HQD[to]) continue;
      seen.add(k); out.push([p.desk, to, p.kind, now - Date.parse(p.at) > 3600e3]);
    }
    if (out.length >= 10) break;
  }
  return out.map(([a, b, k, old]) => { const A = hqHeadOf(a), B = hqHeadOf(b), mx = (A[0] + B[0]) / 2, my = Math.min(A[1], B[1]) - 40 - Math.abs(A[0] - B[0]) * 0.18;
    return `<path class="hq-arc k-${k}${old ? ' old' : ''}" d="M${hqS(A)}Q${mx.toFixed(1)},${my.toFixed(1)} ${hqS(B)}"/>`; }).join('');
}
function hqScene(st) {
  const F = st.firm || {}, sel = FZ.sel || 'now', now = Date.now(), objs = [];
  (F.desks || []).forEach(d => { d._recent = !d.running && d.last_at && now - Date.parse(d.last_at) < 45 * 60e3; if (d.id !== 'pm' && HQD[d.id]) objs.push(hqDesk(d, sel)); });
  objs.push(hqOffice(F, sel), hqMeeting(F, sel), hqCore(st, sel), hqTrophy(F, sel));
  objs.sort((a, b) => a.z - b.z);
  const room = hqRoom(F, st, sel), n = (F.desks || []).length;
  return `<svg class="hq-scene${F.paused_until || (st.signin || {}).out ? ' paused' : ''}" viewBox="0 0 ${HQ.W} ${HQ.H}" role="group" aria-label="The Firm's office: ${n} desks, the portfolio manager's office, the meeting room, the board, the scenario wall, the betting markets, the calendar, the ideas whiteboard, the trophy case and the firm's brain. Choose any of them to look inside.">${HQDEFS}${room.svg}${objs.map(o => o.svg).join('')}<g class="hq-arcs" aria-hidden="true">${hqArcs(F)}</g><g aria-hidden="true">${room.labels}${objs.map(o => o.label).join('')}</g></svg>`;
}
/* the panel beside the office: one room at a time, every paragraph folded */
const hqDet = (k, sum, body, cls) => `<details class="hq-det${cls ? ' ' + cls : ''}" data-k="${esc(k)}"${FZ.openK.has(k) ? ' open' : ''}><summary>${sum}</summary><div class="hq-dbody">${body}</div></details>`;
const hqIh = (ic, title, sub, col) => `<div class="hq-ih"><span class="hq-ic" aria-hidden="true"${col ? ` style="background:color-mix(in srgb,${col} 18%,transparent)"` : ''}>${ic}</span><div><b>${esc(title)}</b>${sub ? `<span>${sub}</span>` : ''}</div>${FZ.sel !== 'now' ? '<button class="fz-x" data-fact="sel" data-id="now" aria-label="Close">✕</button>' : ''}</div>`;
function hqStatusText(F) {
  if (F.paused_until) return `Paused until ${fzWhen(F.paused_until)}: your Claude plan's usage limit; it starts again by itself`;
  const m = F.meeting;
  if (m) { const ws = (m.writing || []).map(id => HQL[id] || id); return `${m.label} now · ${ws.length ? ws.join(', ') + (ws.length === 1 ? ' is' : ' are') + ' writing' : m.step || ''}`; }
  const nx = (F.next || [])[0];
  return nx ? `Next: ${nx.label}, ${fzWhen(nx.at)}` : 'Between meetings';
}
function hqWatchText(F) {  // v8: the news watch's line lives in the panel header, so the top line isn't said twice
  const w = F.watch || {};
  return w.last_at ? `News watch ${fzAgo(w.last_at)}: ${w.severity ? w.headline || 'something new' : 'nothing big'}` : '';
}
const hqSoon = iso => new Date(iso).toDateString() === new Date().toDateString() ? hm(iso) + ' today' : fzWhen(iso);
function hqPostDet(F, p, ph) {
  const d = fzD(F, p.desk), to = (p.to || []).map(id => HQL[id] || fzD(F, id).name).join(', '), all = [...(F.open || []), ...(F.resolved || [])];
  const stocks = (p.stocks || []).map(s => { const v = FZV[s.view] || [cap(s.view), '#8d93a3'];
    return `<button class="fz-tk" data-act="${ph ? 'w-pos' : 'stock'}" data-t="${esc(s.ticker)}" style="--c:${v[1]}"><b>${esc(s.ticker)}</b>${esc(v[0])}</button>`; }).join('');
  const preds = (p.preds || []).map(id => { const x = all.find(y => y.id === id);
    return x ? `<button class="fz-pc" data-fact="pred" data-id="${esc(id)}">${esc(id)} · ${x.status === 'open' ? x.prob + '%' : x.outcome ? 'came true' : x.outcome === 0 ? 'missed' : 'closed'}</button>` : ''; }).join('');
  const kind = p.kind === 'briefing' && p.kind_label ? p.kind_label : FZK[p.kind] || p.kind;
  const sum = `${fzAv(d, 26)}<span class="hq-ps"><span class="hq-pm"><b>${esc(HQL[p.desk] || d.name)}</b><i class="fz-kind" style="--k:${FZKC[p.kind] || '#8d93a3'}">${esc(kind)}${to && p.kind !== 'memo' ? ' → ' + esc(to) : ''}</i>${p.kind === 'challenge' && p.severity === 3 ? '<i class="fz-sev s3">must answer</i>' : ''}<time>${esc(fzAgo(p.at))}</time></span><span class="hq-ph">${esc(p.headline)}</span></span>`;
  const body = `${p.body && p.body !== p.headline ? `<p>${esc(p.body)}</p>` : ''}${stocks || preds ? `<div class="fz-tags">${stocks}${preds}</div>` : ''}${(p.sources || []).length ? `<div class="fz-srcs">${p.sources.map(fzSrc).join('')}</div>` : ''}`;
  return hqDet('p' + p.id, sum, body || '<p class="hq-small">That’s the whole post.</p>', 'hq-post');
}
function hqPredDet(F, x) {
  const d = fzD(F, x.desk), done = x.status !== 'open';
  const sum = `<span class="hq-ps"><span class="hq-ph">${esc(x.question)}</span><span class="hq-pm">${done ? `<span class="fz-res ${x.outcome ? 'y' : x.outcome === 0 ? 'n' : ''}">${x.outcome ? 'Came true' : x.outcome === 0 ? 'Didn’t happen' : 'Closed'}</span>` : fzOdds(x.prob, x.market_odds)}<time>${esc(bzMD(x.by))}</time></span></span>`;
  const mv = (x.moves || []).map(m => `<span class="fz-mv"><b>${esc(m.ticker)}</b>${fzArrow(m.if_yes)}<em>/</em>${fzArrow(m.if_no)}</span>`).join('');
  const body = (x.if_yes ? `<div class="fz-yn"><div class="y"><small>If yes</small><p>${esc(x.if_yes)}</p></div><div class="n"><small>If no</small><p>${esc(x.if_no || '')}</p></div></div>` : '')
    + (mv ? `<div class="fz-mvs"><small>Your stocks · yes / no</small>${mv}</div>` : '') + fzTrail(x.trail)
    + `<p><b>${esc(d.name)}${done && isNum(x.prob) ? ` said ${x.prob}%` : ''}:</b> ${esc(x.why || '')}</p>`
    + (x.check ? `<p class="hq-small"><b>How it’s graded:</b> ${esc(x.check)}</p>` : '') + (isNum(x.market_odds) ? `<p class="hq-small"><b>Betting markets:</b> ${x.market_odds}%</p>` : '')
    + (done && x.evidence ? `<p class="hq-small"><b>What happened:</b> ${esc(x.evidence)}${x.grade && isNum(x.grade.brier) ? ` · Brier ${x.grade.brier.toFixed(2)}` : ''}</p>` : '');
  return hqDet('r' + x.id, sum, body, 'hq-pred');
}
const hqRow = (F, p, id) => `<button class="hq-row" data-fact="sel" data-id="${esc(id)}">${fzAv(fzD(F, p.desk), 26)}<span class="hq-ps"><span class="hq-pm"><b>${esc(HQL[p.desk] || fzD(F, p.desk).name)}</b><time>${esc(fzAgo(p.at))}</time></span><span class="hq-ph">${esc(p.headline)}</span></span><span class="hq-go" aria-hidden="true">›</span></button>`;
function hqNowInsp(st) {
  const F = st.firm || {}, feed = F.feed || [], td = new Date().toDateString(), tdy = feed.filter(p => new Date(p.at).toDateString() === td);
  const br = feed.find(p => p.desk === 'pm' && p.kind === 'briefing'), hi = feed.filter(p => ['memo', 'alert'].includes(p.kind) && p.desk !== 'pm').slice(0, 3);
  return hqIh('🏢', 'Inside the Firm', esc(hqWatchText(F)))
    + `<div class="fz-nums hq-n4"><div><b>${isNum(F.posts_today) ? F.posts_today : tdy.length}</b><span>posts today</span></div><div><b>${tdy.filter(p => p.kind === 'challenge').length}</b><span>challenges</span></div><div><b>${tdy.filter(p => p.kind === 'reply' && p.changed).length}</b><span>changed minds</span></div><div><b>${(F.open || []).length}</b><span>predictions</span></div></div>`
    + (br ? `<h4 class="hq-sec">The PM’s latest call</h4>${hqRow(F, br, 'pm')}` : '')
    + (hi.length ? `<h4 class="hq-sec">Just said</h4>${hi.map(p => hqRow(F, p, 'desk:' + p.desk)).join('')}` : '')
    + `<p class="hq-hint">Click anyone or anything in the office to zoom in.${api() ? ' <button class="link" data-act="tour">Take the tour ›</button>' : ''}</p>`;
}
function hqDeskInsp(st, id, ph) {
  const F = st.firm || {}, d = fzD(F, id);
  if (!d.beat) return hqNowInsp(st);
  const feed = F.feed || [], memo = feed.find(p => p.desk === id && p.kind === 'memo');
  const talk = feed.filter(p => p.kind !== 'memo' && (p.desk === id ? (p.to || []).length : (p.to || []).includes(id))).slice(0, 6);
  const preds = (F.open || []).filter(x => x.desk === id).slice(0, 6), nb = d.notebook || {}, rc = d.record;
  const model = { opus: 'Claude Opus', sonnet: 'Claude Sonnet' }[d.model] || 'Claude Opus and Sonnet';
  const state = d.running ? 'writing now' : d.last_at ? 'last post ' + fzAgo(d.last_at) : 'no posts yet';
  const nbody = ((nb.lessons || []).length ? `<p class="hq-small"><b>Lessons from the weekly review</b></p><ul>${nb.lessons.slice(0, 4).map(x => `<li>${esc(x.text)}</li>`).join('')}</ul>` : '')
    + ((nb.notes || []).length ? `<ul>${nb.notes.slice(-5).reverse().map(x => `<li>${esc(x.text)}</li>`).join('')}</ul>` : '');
  return `<div class="hq-ih">${fzAv(d, 40)}<div><b>${esc(d.name)}</b><span>${esc(state)} · ${esc(model)}</span></div><button class="fz-x" data-fact="sel" data-id="now" aria-label="Close">✕</button></div>`
    + `<p class="hq-beat"><b>Covers:</b> ${esc(d.beat)}.</p>`
    + (id === 'ops' ? hqOpsInsp(F, memo, ph) : memo ? `<h4 class="hq-sec">Latest memo</h4>${hqPostDet(F, memo, ph)}` : '<p class="fz-fine">No memo yet: it speaks at its next meeting.</p>')
    + (preds.length ? `<h4 class="hq-sec">Its predictions</h4>${preds.map(x => hqPredDet(F, x)).join('')}` : '')
    + (talk.length ? `<h4 class="hq-sec">Talking with the others</h4>${talk.map(p => hqPostDet(F, p, ph)).join('')}` : '')
    + (nbody ? `<h4 class="hq-sec">Its memory</h4>${hqDet('nb' + id, '<span class="hq-ph">Its notebook</span>', nbody)}` : '')
    + (id === 'ops' ? '' : `<div class="fz-nums hq-n4"><div><b>${d.today || 0}</b><span>posts today</span></div><div><b>${rc ? rc.n : 0}</b><span>graded</span></div><div><b>${rc && isNum(rc.brier) ? rc.brier.toFixed(2) : '–'}</b><span>Brier</span></div><div><b>${rc && isNum(rc.hit) ? Math.round(rc.hit * 100) + '%' : '–'}</b><span>right</span></div></div>`);  // v7.4: the Operations desk makes no predictions
}
function hqOpsInsp(F, memo, ph) {  // v7.4: the Operations desk's panel: its passes today and what it changed
  const o = F.ops || {}, ch = o.changes_today || [], last = o.last || {};
  const head = o.last_at ? `Last pass ${esc(fzAgo(o.last_at))} · ${o.today || 0} pass${o.today === 1 ? '' : 'es'} today${o.waiting ? ` · ${o.waiting} thing${o.waiting === 1 ? '' : 's'} waiting` : ''}` : 'No pass yet today';
  return `<p class="hq-small">${head}</p>`
    + (ch.length ? `<h4 class="hq-sec">What it changed today</h4><ul class="hq-ops">${ch.map(c => `<li><i class="k-${esc(c.kind || '')}"></i>${esc(c.text || '')}</li>`).join('')}</ul>`
      : `<p class="fz-fine">Nothing to change ${o.last_at ? 'so far today' : 'yet'}. It goes through the orders after every fill, stop, Schwab sync, standing order or alert, and after the 12:00 and 4:15 checks.</p>`)
    + (last.pm_needed ? '<p class="hq-small">On its last pass it asked the PM for a decision.</p>' : '')
    + (memo ? `<h4 class="hq-sec">Its latest note on the board</h4>${hqPostDet(F, memo, ph)}` : '');
}
function hqPmInsp(st, ph) {
  const F = st.firm || {}, feed = F.feed || [], br = feed.find(p => p.desk === 'pm' && p.kind === 'briefing'), rul = feed.filter(p => p.desk === 'pm' && p.kind === 'ruling').slice(0, 6);
  return hqIh('👔', 'Portfolio manager', `reads every desk and writes your briefing · ${br ? 'last ' + esc(fzAgo(br.at)) : 'after the 9:45 AM scan'}`, '#c3b4ff')
    + (br ? `<h4 class="hq-sec">Latest call</h4>${hqPostDet(F, br, ph)}` : (st.analyst || {}).has && st.analyst.headline  // v6: older than the board shows
      ? `<h4 class="hq-sec">Latest call · ${esc((st.analyst.label || 'briefing').toLowerCase())}, ${esc(fzAgo(st.analyst.at))}</h4>${hqDet('pm-latest', `<span class="hq-ph">${esc(st.analyst.headline)}</span>`, `${st.analyst.summary ? `<p>${esc(st.analyst.summary)}</p>` : ''}${st.analyst.market ? `<p>${esc(st.analyst.market)}</p>` : ''}`)}` : '')
    + (rul.length ? `<h4 class="hq-sec">How it settled the desks’ disagreements</h4>${rul.map(p => hqDet('p' + p.id, `<span class="hq-ph">${esc(p.headline)}</span>`, `<p>${esc(p.body)}</p>`)).join('')}`
      : ((st.analyst || {}).rulings || []).length ? `<h4 class="hq-sec">How it settled the desks’ disagreements</h4>${st.analyst.rulings.slice(0, 6).map((x, i) => hqDet('pmr' + i, `<span class="hq-ph">${esc(x.question || '')}</span>`, `<p><b>${esc(x.decision || '')}</b></p>${x.why ? `<p>${esc(x.why)}</p>` : ''}`)).join('')}` : '')
    + (((F.boss || {}).orders || []).length ? `<h4 class="hq-sec">Your standing orders to the firm</h4>${F.boss.orders.map(o => `<div class="hq-ord"><p>${esc(o.text)}</p><span>${esc(fzAgo(o.at))}${!ph && api() ? ` · <button class="link" data-fact="drop" data-at="${esc(o.at)}">Take back</button>` : ''}</span></div>`).join('')}` : '')
    + `<button class="hq-btn" ${ph ? 'data-act="w-tab" data-t="today"' : 'data-view="bot"'}>Your orders are on Today ›</button>`;
}
function hqMeetInsp(st, ph) {
  const F = st.firm || {}, m = F.meeting, last = (F.meetings || [])[0], feed = F.feed || [], nx = (F.next || [])[0];
  let body = '';
  if (m) {
    const ws = (m.writing || []).map(id => fzD(F, id));
    body = `<div class="fz-live on"><span class="fz-pulse"></span><div><b>${esc(m.label)} in progress</b><span>${esc(m.step || '')} · started ${esc(fzT(m.started))}</span></div></div>`
      + (ws.length ? `<div class="hq-avs">${ws.map(d => fzAv(d, 30)).join('')}<span>${ws.map(d => esc(HQL[d.id] || d.name)).join(', ')} writing</span></div>` : '');
  } else if (last) {
    const ps = feed.filter(p => p.meeting === last.id), n = k => ps.filter(p => p.kind === k).length;
    body = `<p class="hq-small">Last: <b>${esc(last.label)}</b>, ${esc(hm(last.finished || last.started))}</p><div class="fz-nums hq-n4"><div><b>${last.posts || ps.length}</b><span>posts</span></div><div><b>${n('memo')}</b><span>memos</span></div><div><b>${n('challenge')}</b><span>challenges</span></div><div><b>${ps.filter(p => p.kind === 'reply' && p.changed).length}</b><span>changed minds</span></div></div>`;
  }
  return hqIh('🤝', 'Meeting room', nx ? `next: ${esc(nx.label.toLowerCase())}, ${esc(fzWhen(nx.at))}` : '', '#3ff2a3') + body
    + (!ph && api() ? (m ? '<button class="fz-btn hq-call" data-fact="join">Join as the boss</button>' : '<button class="fz-btn hq-call" data-fact="call">Call a meeting now</button>') : '')
    + hqDet('day', '<span class="hq-ph">When the firm meets</span>', fzDay(F));
}
function hqBoardInsp(st, ph) {
  const F = st.firm || {}, f = FZ.filter;
  let P = F.feed || [];
  if (f === 'top') P = P.filter(p => ['memo', 'briefing', 'ruling', 'alert', 'score', 'order', 'boss'].includes(p.kind) || (p.kind === 'challenge' && (p.severity || 1) >= 2) || (p.kind === 'reply' && p.changed));
  else if (f === 'memo') P = P.filter(p => p.kind === 'memo');
  else if (f === 'debate') P = P.filter(p => ['challenge', 'reply', 'note'].includes(p.kind));
  else if (f === 'pm') P = P.filter(p => p.desk === 'pm' || p.desk === 'boss');
  else if (f === 'alert') P = P.filter(p => ['alert', 'score'].includes(p.kind));
  const n = FZ.more ? 60 : 14;
  return hqIh('📋', 'The board', 'memos, challenges, answers and the PM’s rulings · open one to read it', '#56cbff')
    + `<div class="fz-filt">${FZF.map(([k, l]) => `<button class="fz-f${FZ.filter === k ? ' on' : ''}" data-fact="filter" data-v="${k}" aria-pressed="${FZ.filter === k}">${l}</button>`).join('')}</div>`
    + (P.slice(0, n).map(p => hqPostDet(F, p, ph)).join('') || '<p class="fz-fine">Nothing here yet.</p>')
    + (P.length > n ? `<button class="fz-more wide" data-fact="morefeed">Show ${Math.min(P.length, 60) - n} more</button>` : '');
}
function hqPredInsp(st) {
  const F = st.firm || {}, cards = F.cards || [], ids = new Set(cards.map(x => x.id)), rest = (F.open || []).filter(x => !ids.has(x.id));
  return hqIh('🎯', 'Scenario wall', `${(F.open || []).length} open predictions · graded when their date passes`, '#3ff2a3')
    + (cards.length ? `<h4 class="hq-sec">Big events and the plan for each outcome</h4>${cards.map(x => hqPredDet(F, x)).join('')}` : '<p class="fz-fine">The forecasting desk writes these at the pre-market meeting.</p>')
    + (rest.length ? `<h4 class="hq-sec">Other predictions</h4>${rest.slice(0, FZ.more ? 40 : 10).map(x => hqPredDet(F, x)).join('')}${rest.length > 10 && !FZ.more ? `<button class="fz-more" data-fact="morefeed">Show all ${rest.length}</button>` : ''}` : '')
    + ((F.resolved || []).length ? `<h4 class="hq-sec">Graded</h4>${F.resolved.slice(0, 8).map(x => hqPredDet(F, x)).join('')}` : '');
}
function hqIdeasInsp(st, ph) {
  const A = st.analyst || {}, W = A.watchlist || [], act = (A.strategies || []).filter(x => x.status === 'active');
  const seen = new Set(W.map(w => String(w.ticker || '').toUpperCase()));
  const R = (st.radar || []).filter(x => x.ai && !seen.has(x.ticker) && seen.add(x.ticker)).slice(0, 5);
  const go = t => ph ? `data-act="w-pos" data-t="${esc(t)}"` : `data-act="stock" data-t="${esc(t)}"`;
  const row = (t, body) => { const sp = fzSpark(st, t), v = sp ? sp.filter(isNum) : [], last = v.length ? v[v.length - 1] : null;
    return hqDet('i' + t, `<span class="hq-it"><b>${esc(t)}</b>${fzAiWord(st, t)}</span><span class="hq-isp">${sp ? spark(sp, { h: 26, c: last >= v[0] ? '#3ff2a3' : '#ff5f6e' }) : ''}<em>${isNum(last) ? money(last, true) : ''}</em></span>`,
      body + `<button class="hq-btn" ${go(t)}>Open ${esc(t)} ›</button>`, 'hq-idea'); };
  const say = s => { const ss = splitSentences(s || ''); return (ss[0] || '').split(/\s+/).length > 3 ? ss[0] : ss.slice(0, 2).join(' '); };
  return hqIh('💡', 'Ideas whiteboard', 'where the next buys come from · the PM picks, you OK the order on Today', '#ffc65a')
    + (W.length ? `<h4 class="hq-sec">The firm is watching</h4>${W.map(w => row(String(w.ticker || '').toUpperCase(), `<p>${esc(w.why)}</p>${w.buy_if ? `<p class="hq-small"><b class="hq-g">Buys if</b> ${esc(w.buy_if)}</p>` : ''}`)).join('')}` : '<p class="fz-fine">The watchlist fills in with the PM’s next briefing.</p>')
    + act.map(x => `<h4 class="hq-sec">${esc(x.name)} · would buy today</h4><div class="fz-tkcs">${(x.picks || []).map(p => `<button class="fz-tkc" ${go(p.ticker)}><b>${esc(p.ticker)}</b>${isNum(p.price) ? money(p.price, true) : ''}</button>`).join('') || '<span class="fz-fine">No stock passes it today.</span>'}</div>`).join('')
    + (R.length ? `<h4 class="hq-sec">Also researched</h4>${R.map(x => row(x.ticker, `<p>${esc(say(x.ai.summary))}</p>`)).join('')}` : '');
}
function hqCalInsp(st) {
  const F = st.firm || {}, by = {}, t0 = new Date(); t0.setHours(0, 0, 0, 0);
  (F.calendar || []).forEach(x => { (by[x.date] = by[x.date] || []).push(x); });
  const ev = (k, x, i) => { const head = `<span class="hq-ev i${x.importance || 1}"><i class="fz-ck">${esc(FZCK[x.kind] || 'Event')}</i>${esc(x.what)}${x.time ? ` <em>${esc(x.time)}</em>` : ''}</span>`;
    return x.why ? hqDet('c' + k + i, head, `<p>${esc(x.why)}</p>`, 'hq-evd') : `<div class="hq-evp">${head}</div>`; };
  const html = Object.keys(by).sort().filter(k => D(k) >= t0).slice(0, FZ.more ? 30 : 12).map(k => { const dd = D(k);
    return `<div class="hq-day${dd.getTime() === t0.getTime() ? ' today' : ''}"><time><b>${dd.getDate()}</b><span>${MON[dd.getMonth()]} · ${DOW[dd.getDay()]}</span></time><div>${by[k].map((x, i) => ev(k, x, i)).join('')}</div></div>`; }).join('');
  return hqIh('🗓️', 'Calendar', 'what’s coming, from the forecasting desk and the programs', '#56cbff') + (html || '<p class="fz-fine">The forecasting desk fills this in at its next meeting.</p>');
}
function hqBrainInsp(st) {
  const A = st.analyst || {}, L = A.lessons || [], St = A.strategies || [], rv = A.review;
  return hqIh('🧠', 'The firm’s brain', `${L.length} lessons · ${St.filter(x => x.status === 'active').length} strategy in use · ${St.length} tested`, '#a38cff')
    + '<p class="hq-small">Zoom in for its map, its playbook, the Strategy Lab and the weekly review.</p>'
    + (rv ? hqDet('brv', '<span class="hq-ph">This week’s review</span>', `<p>${esc(rv.summary)}</p>`) : '')
    + '<button class="hq-btn" data-fact="jumpbrain">Open the brain ›</button>';
}
function hqInsp(st, opt, id) {
  const F = st.firm || {}, s = id || FZ.sel || 'now', ph = (opt || {}).phone;
  if (s.startsWith('desk:')) return hqDeskInsp(st, s.slice(5), ph);
  return ({ pm: () => hqPmInsp(st, ph), meeting: () => hqMeetInsp(st, ph), board: () => hqBoardInsp(st, ph), predictions: () => hqPredInsp(st),
    ideas: () => hqIdeasInsp(st, ph), calendar: () => hqCalInsp(st), brain: () => hqBrainInsp(st),
    markets: () => hqIh('📈', 'Betting markets', 'Polymarket and Kalshi: the benchmark the firm tries to beat', '#56cbff') + fzMarkets(F),
    record: () => hqIh('🏆', 'Trophy case', 'the scorekeeper’s grades', '#ffd36e') + fzRecord(F, true) }[s] || (() => hqNowInsp(st)))();
}
function hqDock(st) {
  const F = st.firm || {}, A = st.analyst || {}, td = new Date().toDateString(), t0 = new Date(); t0.setHours(0, 0, 0, 0);
  const today = isNum(F.posts_today) ? F.posts_today : (F.feed || []).filter(p => new Date(p.at).toDateString() === td).length, nx = (F.calendar || []).find(x => D(x.date) >= t0 && (x.importance || 1) > 1);
  const T = [['board', '📋', 'Board', `${today} posts today`], ['predictions', '🎯', 'Scenarios', `${(F.open || []).length} open`], ['ideas', '💡', 'Ideas', `${(A.watchlist || []).length} watching`],
    ['meeting', '🤝', 'Meeting', F.meeting ? 'in progress' : (F.next || [])[0] ? hqSoon(F.next[0].at) : ''], ['brain', '🧠', 'Brain', `${(A.lessons || []).length} lessons`],
    ['calendar', '🗓️', 'Calendar', nx ? `${MON[D(nx.date).getMonth()]} ${D(nx.date).getDate()}: ${nx.what}` : ''], ['markets', '📈', 'Markets', `${(F.markets || []).length} odds`], ['record', '🏆', 'Record', `${(F.record || {}).resolved || 0} graded`]];
  return T.map(([k, ic, l, sub]) => `<button class="hq-tile" data-fact="sel" data-id="${k}" aria-label="${esc(l)}: ${esc(sub)}. Zoom in"><span class="hq-tic" aria-hidden="true">${ic}</span><b>${l}</b><small>${esc(sub)}</small></button>`).join('');
}
function hqGist(F, compact) {  // the meeting in a few highlighted lines, for when Sam or his dad don't want to read
  const g = (F || {}).gist; if (!g || !g.summary) return '';
  const li = (a, ic) => (a || []).slice(0, 3).map(x => `<li><span aria-hidden="true">${ic}</span>${esc(x)}</li>`).join('');
  const cols = [['They agree', g.agree, '✓'], ['They argue about', g.argue, '⚡'], ['Watch next', g.watch, '👀']].filter(c => (c[1] || []).length);
  const grid = cols.length ? `<div class="hq-gc">${cols.map(([h, a, ic]) => `<div><h5>${h}</h5><ul>${li(a, ic)}</ul></div>`).join('')}</div>` : '';
  return `<section class="hq-gist" aria-label="The gist of the latest meeting"><div class="hq-gh"><b>The gist</b><span>${esc(g.label || 'latest meeting')} · ${esc(fzAgo(g.at))}</span></div>
    <p class="hq-gs"><mark>${esc(g.summary)}</mark></p>
    ${compact === true ? ((g.watch || []).length ? `<p class="hq-gw"><span aria-hidden="true">👀</span> ${esc(g.watch[0])}</p>` : '')
      : compact === 'fold' && grid ? `<details class="hq-gfold" data-k="gist"${FZ.openK.has('gist') ? ' open' : ''}><summary>What they agree on, argue about and watch next</summary>${grid}</details>`  // v8: the office comes first
      : grid}</section>`;
}
function hqTop(st, opt) {
  const F = st.firm || {}, ph = (opt || {}).phone, out = !!(st.signin || {}).out, live = F.meeting ? 'on' : F.paused_until || out ? 'warn' : '';
  return `<div class="hq-top"><div><h2>The Firm</h2><p class="hq-status"><i class="${live}" aria-hidden="true"></i><span>${esc(out && !F.meeting ? 'Stopped until you sign in to Claude again' : hqStatusText(F))}</span></p></div>`
    + `${!ph && api() && F.on && !out ? (F.meeting ? '<button class="fz-btn" data-fact="join">Join as the boss</button>' : '<button class="fz-btn" data-fact="call">Call a meeting now</button>') : ''}</div>`
    + signinWarn(st, { ...(opt || {}), cls: 'sgn-firm' });
}
function firmView(st, opt) {
  const F = st.firm || {}, ph = (opt || {}).phone;
  if (!F.on) return `<div class="fz hq${ph ? ' ph' : ''}"><div class="fz-c"><p class="fz-fine">${esc(F.error || 'The firm starts with its next meeting.')}</p></div></div>`;
  return `<div class="fz hq${ph ? ' ph' : ''}"><div class="hq-headwrap">${hqTop(st, opt)}</div><div class="hq-gistwrap">${hqGist(F, 'fold')}</div>
    <div class="hq-stage"><div class="hq-left"><div class="hq-scroll"><div class="hq-scenewrap">${hqScene(st)}</div></div>
      <div class="hq-legend">${(F.teams || []).map(t => `<span><i style="background:${t.color}"></i>${esc(t.name)}</span>`).join('')}<span class="hq-sep" aria-hidden="true"></span><span class="hq-key" style="--c:#ff8a65"><i></i>challenge</span><span class="hq-key" style="--c:#56cbff"><i></i>answer</span><span class="hq-key" style="--c:#c3b4ff"><i></i>ruling</span></div>
      <nav class="hq-dock" aria-label="Rooms of the firm">${hqDock(st)}</nav><div class="hq-tip" role="tooltip" hidden></div></div>
      <aside class="hq-insp" aria-label="Inside the Firm">${hqInsp(st, opt, 'now')}</aside></div>
    <p class="fz-fine fz-foot">Every person here is a separate Claude run with its own beat, style and notebook: ${(F.desks || []).length || 22} specialists, not hundreds of copies, because copies of one prompt only add noise. Nobody at the firm trades: every order still needs your OK, and you place it yourself.</p></div>`;
}
function firmMount(root, st, opt) {
  fzStyle(); hqStyle();
  const box = $('.hq', root); if (!box) return;
  const part = (sel, html) => { const el = $(sel, box); if (el) el.innerHTML = html; };
  const live = () => { part('.hq-headwrap', hqTop(st, opt)); part('.hq-gistwrap', hqGist(st.firm, 'fold')); part('.hq-scenewrap', hqScene(st)); part('.hq-dock', hqDock(st)); part('.hq-insp', hqInsp(st, opt, 'now')); };
  box._live = live;  // the boardroom refreshes the office when you leave it
  const pick = (id, el) => { if (id && id !== 'now') roomOpen(st, opt, id, el); };  // v7: the camera flies into the room
  if (!$('#room')) FZ.sel = 'now';
  const sc = $('.hq-scroll', box);
  if (sc && sc.scrollWidth > sc.clientWidth + 4) sc.scrollLeft = (sc.scrollWidth - sc.clientWidth) / 2;
  const np = () => { if (!document.body.contains(box)) return; const sc = $('.hq-scene', box); if (sc) box.classList.toggle('hq-np', sc.getBoundingClientRect().width / HQ.W >= 0.915); };  // v8: nameplates once they'd be 11px or more
  np(); requestAnimationFrame(np); setTimeout(np, 350);  // measured again once the layout has settled
  if (!box._bound) {
    box._bound = true;
    window.addEventListener('resize', np);
    box.addEventListener('focusin', e => {  // v8: the keyboard gets the same tooltip as the mouse
      const o = e.target.closest && e.target.closest('.hq-scene .hq-o'), tip = $('.hq-tip', box), left = $('.hq-left', box); if (!o || !tip || !left) return;
      const r = left.getBoundingClientRect(), b = o.getBoundingClientRect();
      tip.textContent = o.dataset.tip || o.getAttribute('aria-label'); tip.hidden = false;
      tip.style.left = Math.max(4, Math.min(r.width - tip.offsetWidth - 4, b.left - r.left + b.width / 2 - tip.offsetWidth / 2)) + 'px'; tip.style.top = Math.max(4, b.top - r.top - tip.offsetHeight - 6) + 'px';
    });
    box.addEventListener('focusout', e => { if (e.target.closest && e.target.closest('.hq-scene .hq-o')) { const tip = $('.hq-tip', box); if (tip) tip.hidden = true; } });
    box.addEventListener('click', e => {
      const el = e.target.closest('[data-fact]'); if (!el) return;
      const k = el.dataset.fact, id = el.dataset.id;
      if (k === 'sel') pick(id, el);
      else if (k === 'pred') { FZ.openK.add('r' + id); pick('predictions', el); }
      else if (k === 'filter') { FZ.filter = el.dataset.v; part('.hq-insp', hqInsp(st, opt)); }
      else if (k === 'morefeed') { FZ.more = !FZ.more; part('.hq-insp', hqInsp(st, opt)); }
      else if (k === 'mk') { FZ.mk = !FZ.mk; part('.hq-insp', hqInsp(st, opt)); }
      else if (k === 'jumpbrain') pick('brain', el);
      else if (k === 'desk') pick(id ? 'desk:' + id : 'now', el);
      else if (k === 'link' && api()) api().open_link(el.dataset.u);
      else if (k === 'call' && api()) bossChoose(st, opt, el);  // v6: join as the boss, or let them meet without you
      else if (k === 'join' && api()) bossOpen(st, opt, el);
      else if (k === 'drop' && api()) {
        el.disabled = true;
        api().boss_drop(el.dataset.at).then(r => { if (r && r.ok) { st.firm.boss = { ...(st.firm.boss || {}), orders: r.orders || [] }; part('.hq-insp', hqInsp(st, opt)); (opt && opt.toast || toast)('Order taken back. The desks ignore it from now on.'); } else el.disabled = false; });
      }
    });
    box.addEventListener('keydown', e => {
      if ((e.key === 'Enter' || e.key === ' ') && e.target.matches && e.target.matches('.hq-scene [role=button]')) { e.preventDefault(); e.target.dispatchEvent(new MouseEvent('click', { bubbles: true })); }
    });
    box.addEventListener('toggle', e => { const d = e.target; if (d && d.matches && d.matches('details[data-k]')) { if (d.open) FZ.openK.add(d.dataset.k); else FZ.openK.delete(d.dataset.k); } }, true);
    box.addEventListener('mousemove', e => {
      const tip = $('.hq-tip', box), left = $('.hq-left', box); if (!tip || !left) return;
      const o = e.target.closest && e.target.closest('.hq-scene .hq-o');
      if (!o) { tip.hidden = true; return; }
      const r = left.getBoundingClientRect();
      tip.textContent = o.dataset.tip || o.getAttribute('aria-label'); tip.hidden = false;
      tip.style.left = Math.max(4, Math.min(r.width - tip.offsetWidth - 4, e.clientX - r.left + 14)) + 'px'; tip.style.top = (e.clientY - r.top + 18) + 'px';
    });
    box.addEventListener('mouseleave', () => { const tip = $('.hq-tip', box); if (tip) tip.hidden = true; });
    if (window.IntersectionObserver && sc) new IntersectionObserver(es => { box.classList.toggle('hq-off', !es[es.length - 1].isIntersecting); }).observe(sc);  // off screen: animations pause
  }
  clearInterval(FZ.timer);
  if (!(opt || {}).phone && api()) {
    FZ.last = JSON.stringify(st.firm || {});
    FZ.timer = setInterval(async () => {
      if (!document.body.contains(box)) { clearInterval(FZ.timer); return; }
      if (document.hidden || window.getSelection().toString()) return;
      let f; try { f = await api().firm_view(); } catch (e) { return; }
      const j = JSON.stringify(f || {});
      if (f && f.on && j !== FZ.last) { FZ.last = j; st.firm = f; live(); }
    }, 15000);
  }
}
/* ---------------- v6: the boss's meeting ----------------
   Whoever owns this copy is the boss: Sam on his Mac, his dad on his own Mac with his own Claude. "Call a meeting" asks
   whether to join as the boss or let them meet without you. Joining opens the boardroom close up: everyone stands when
   you walk in, the PM greets you and gives you the short version, then each desk walks you through its latest work. You
   can ask any desk (or the whole room) a question, answered live in that desk's own voice, or give the firm a standing
   order that every desk and the PM read before their next work. Mac only: the answers are Claude runs on this Mac. */
const BOSS = { i: 0, cards: [], seats: [], log: [], mode: 'ask', to: 'pm', picked: false, busy: false, pending: null, talk: null, asked: 0, ordered: 0,
  st: null, opt: null, back: null, timer: null, guard: null, busyLabel: '', done: false, joined: 0 };
const BOSSCAM = { K: 58, OX: 326, OY: 206 };  // the close-up camera: the office's own shapes, about twice as close
const BOSSVB = [842, 690], BOSSFW = 10.0, BOSSFD = 6.2, BOSSWH = 3.3;
const BOSSSEAT = [[7.85, 'b'], [7.85, 'f'], [6.8, 'b'], [6.8, 'f'], [5.75, 'b'], [5.75, 'f'], [4.7, 'b'], [4.7, 'f'], [3.65, 'b'], [3.65, 'f'], [2.6, 'b'], [2.6, 'f']];  // nearest the boss first; the PM takes the first
const BOSSROW = { b: 2.2, f: 4.6 };  // the two rows of chairs; the table runs from x 2.0 to 8.4 and y 2.7 to 4.1
const BOSSTEAMS = ['macro', 'geo', 'sector', 'special', 'check'];
const bossHi = () => { const h = new Date().getHours(); return h < 12 ? 'Morning' : h < 17 ? 'Afternoon' : 'Evening'; };
function bossOpener(d, p) {  // what a desk says as it stands up (short: it goes in a speech bubble)
  const id = (d || {}).id;
  if (id === 'score') return 'Your report card, boss.';
  if (id === 'watch') return 'Latest from the news, boss.';
  if (p && p.kind === 'challenge') return 'Boss, a word of warning.';
  return ({ alarm: 'Boss, this one’s urgent.', bad: 'Some bad news, boss.', good: 'Good news, boss.', mixed: 'Mixed picture, boss.', quiet: 'Quiet on my beat, boss.' })[(p || {}).mood] || 'Here’s what I found, boss.';
}
function hqCam(cam, fn) {  // draw with another camera (hqP and everything built on it read HQ)
  const keep = { K: HQ.K, OX: HQ.OX, OY: HQ.OY, AX: HQ.AX, AY: HQ.AY };
  Object.assign(HQ, cam, { AX: 0.866 * cam.K, AY: 0.5 * cam.K });
  try { return fn(); } finally { Object.assign(HQ, keep); }
}
function bossWrap(t, n, max) {  // break a line of text into at most `max` lines of about `n` letters
  const words = String(t || '').split(/\s+/).filter(Boolean), out = [];
  let l = '', used = 0;
  for (const w of words) {
    if (l && (l + ' ' + w).length > n) { out.push(l); l = w; if (out.length === max) break; } else l = l ? l + ' ' + w : w;
    used++;
  }
  if (out.length < max && l) out.push(l);
  if (used < words.length || out.join(' ').length < words.join(' ').length) out[out.length - 1] = out[out.length - 1].replace(/[\s,.;:]*\S*$/, '') + '…';
  return out;
}
function bossLineup(F) {  // who presents (each desk's latest work from the last day and a half, team by team) and who sits where
  const feed = F.feed || [], now = Date.now(), desks = (F.desks || []).filter(d => d.id !== 'pm');
  const ord = d => BOSSTEAMS.indexOf(d.team) * 100 + desks.indexOf(d);
  const pres = desks.map(d => ({ d, p: feed.find(p => p.desk === d.id && ['memo', 'alert', 'reply', 'challenge', 'score'].includes(p.kind) && now - Date.parse(p.at) < 36 * 3600e3) }))
    .filter(x => x.p).sort((a, b) => ord(a.d) - ord(b.d)).slice(0, BOSSSEAT.length - 1);
  const rest = desks.filter(d => !pres.some(x => x.d.id === d.id)).sort((a, b) => ord(a) - ord(b));
  const seated = [fzD(F, 'pm'), ...pres.map(x => x.d), ...rest].slice(0, BOSSSEAT.length);
  return { pres, seats: seated.map((d, n) => ({ d, x: BOSSSEAT[n][0], row: BOSSSEAT[n][1] })) };
}
const bossSeat = id => BOSS.seats.find(s => s.d.id === id);
const bossSpeaker = () => BOSS.pending || (BOSS.talk && BOSS.talk.id) || 'pm';
function bossHead(id) {  // the top of someone's head at the table, in the picture's pixels (inside hqCam)
  const s = bossSeat(id); if (!s) return null;
  const p = hqP(s.x, BOSSROW[s.row], 1.62);
  return [p[0], p[1] - 6.4 * HQPS * HQ.K / 32];
}
function bossChair(x, y, row) {  // a chair; for the near row the back is drawn after the person (we see their backs)
  const seat = hqBox(x - 0.32, y - (row === 'b' ? 0.34 : 0.26), 0, 0.64, 0.6, 0.42, ['#2a2f40', '#1b1f2c', '#151822']);
  const back = row === 'b' ? hqBox(x - 0.32, y - 0.44, 0.42, 0.64, 0.1, 0.8, ['#30364a', '#1f2333', '#181b27']) : hqBox(x - 0.32, y + 0.34, 0.42, 0.64, 0.1, 0.8, ['#30364a', '#1f2333', '#181b27']);
  return row === 'b' ? { under: seat + back, over: '' } : { under: seat, over: back };
}
function bossSeatSvg(s, n) {  // one person at the table: a button (click to hear from them or ask them)
  const { d, x, row } = s, y = BOSSROW[row], col = d.color || '#8d93a3', f = v => v.toFixed(1), c = bossChair(x, y, row), ring = hqP(x, y), nm = HQL[d.id] || d.name;
  return `<g class="bs-p" data-b="seat" data-id="${esc(d.id)}" role="button" tabindex="0" aria-label="${esc(nm)}${d.id === 'pm' ? ', runs the meeting' : ''}" data-tip="${esc(nm)}" style="--i:${n};--c:${col}">`
    + `<ellipse class="bs-ring" cx="${f(ring[0])}" cy="${f(ring[1])}" rx="${f(0.86 * HQ.AX)}" ry="${f(0.86 * HQ.AY)}" fill="${col}" fill-opacity=".16" stroke="${col}" stroke-width="1.6"/>`
    + `${c.under}<g class="bs-body">${hqPerson(x, y, col, 1, HQ.K / 32, hqLook(d.id))}</g>${c.over}${hqPoly(hqHull(x - 0.42, y - 0.5, 0, 0.84, 1.0, 1.95), 'class="bs-hit"')}</g>`;
}
function bossScreen() {  // the big screen at the far end of the table: who's talking and what about (inside hqCam)
  const F = BOSS.st.firm || {}, c = BOSS.cards[BOSS.i] || {}, K = HQ.K, o = hqP(0, 5.45, 2.95), W = 4.1 * K, H = 2 * K, f = v => v.toFixed(1);
  const sp = bossSpeaker(), away = sp && !bossSeat(sp), d = away ? fzD(F, sp) : c.d || fzD(F, 'pm'), col = d.color || '#c3b4ff';
  let title, text;
  if (away) { title = HQL[d.id] || d.name; text = BOSS.pending ? 'Joining from their desk. Thinking it over…' : 'Joined from their desk to answer you.'; }
  else if (BOSS.done) { title = 'Meeting over'; text = 'Thanks, boss. The desks are back at work.'; }
  else if (c.k === 'desk') { title = HQL[d.id] || d.name; text = c.p.headline; }
  else if (c.k === 'hi') { title = `${bossHi()} meeting`; text = splitSentences((F.gist && F.gist.summary) || '')[0] || 'Everyone’s here. Each desk will walk you through what it found.'; }
  else { title = 'Questions?'; text = 'That’s everyone. Ask anyone anything, give the firm an order, or wrap up.'; }
  const lines = bossWrap(text, 24, 3);  // v8: a few big words, not a paragraph at an angle
  return `<g transform="matrix(0.866 -0.5 0 1 ${f(o[0])} ${f(o[1])})"><rect width="${f(W)}" height="${f(H)}" fill="#0b1220"/><rect width="${f(W)}" height="5" fill="${col}"/>`
    + `<text x="14" y="29" class="bs-st" fill="${col}">${esc(String(title).toUpperCase().slice(0, 24))}</text>${lines.map((l, n) => `<text x="14" y="${54 + n * 19}" class="bs-sl">${esc(l)}</text>`).join('')}</g>`;
}
function bossBubbles() {  // speech bubbles and "thinking" dots above heads (inside hqCam)
  const F = BOSS.st.firm || {}, f = v => v.toFixed(1);
  const dots = (h, col, cls) => `<g class="hq-typing${cls ? ' ' + cls : ''}" transform="translate(${f(h[0])} ${f(h[1] - 20)})"><rect x="-21" y="-12" width="42" height="24" rx="12" fill="#0b1712" stroke="${col}" stroke-width="1.6"/><circle cx="-9" r="3.3" fill="${col}"/><circle cx="0" r="3.3" fill="${col}"/><circle cx="9" r="3.3" fill="${col}"/></g>`;
  const bub = (h, t, col) => {
    const w = Math.min(320, t.length * 8.1 + 30), x = Math.max(8, Math.min(BOSSVB[0] - w - 8, h[0] - w / 2)), y = h[1] - 50, tx = Math.max(x + 16, Math.min(x + w - 16, h[0]));
    return `<g class="bs-bb"><path d="M${f(tx - 8)},${f(y + 29)} L${f(tx)},${f(y + 39)} L${f(tx + 8)},${f(y + 29)}" fill="#0d111b" stroke="${col}" stroke-width="1.6" stroke-linejoin="round"/><rect x="${f(x)}" y="${f(y)}" width="${f(w)}" height="31" rx="15.5" fill="#0d111b" stroke="${col}" stroke-width="1.6"/><rect x="${f(tx - 7)}" y="${f(y + 27)}" width="14" height="4" fill="#0d111b"/><text x="${f(x + w / 2)}" y="${f(y + 20.5)}" text-anchor="middle">${esc(t)}</text></g>`;
  };
  let g = '';
  (F.desks || []).forEach(d => { if (d.running && d.id !== BOSS.pending) { const h = bossHead(d.id); if (h) g += dots(h, d.color, 'bs-busy'); } });  // writing in a meeting that's going on
  if (BOSS.pending) { const h = bossHead(BOSS.pending); if (h) g += dots(h, fzD(F, BOSS.pending).color); }
  else if (BOSS.talk) { const h = bossHead(BOSS.talk.id); if (h) g += bub(h, BOSS.talk.text, fzD(F, BOSS.talk.id).color || '#c3b4ff'); }
  return g;
}
function bossName() {  // the speaker's name under them in the room (inside hqCam)
  const s = bossSeat(bossSpeaker()); if (!s) return '';
  const p = hqP(s.x, BOSSROW[s.row] + (s.row === 'f' ? 0.75 : 0), s.row === 'b' ? 0.66 : 0), y = s.row === 'b' ? p[1] + 22 : p[1] + 26;
  return `<text class="bs-nm" x="${p[0].toFixed(1)}" y="${y.toFixed(1)}" text-anchor="middle">${esc(HQL[s.d.id] || s.d.name)}</text>`;
}
function bossScene() {
  const F = BOSS.st.firm || {};
  return hqCam(BOSSCAM, () => {
    const FW = BOSSFW, FD = BOSSFD, WH = BOSSWH, hr = new Date().getHours(), f = v => v.toFixed(1);
    const sky = hr < 6 || hr >= 20 ? ['#060a1b', '#19214b', 1] : hr < 8 ? ['#2f3d6e', '#e3a06f', .55] : hr < 17 ? ['#33609f', '#8fb4de', .12] : ['#252a58', '#e5875b', .7];
    let g = `<defs><linearGradient id="bsSky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${sky[0]}"/><stop offset="1" stop-color="${sky[1]}"/></linearGradient>
      <linearGradient id="bsFloor" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#181c2c"/><stop offset="1" stop-color="#0a0c14"/></linearGradient>
      <linearGradient id="bsWA" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#1a1f33"/><stop offset="1" stop-color="#10141f"/></linearGradient>
      <linearGradient id="bsWB" x1="1" y1="0" x2="0" y2="0"><stop offset="0" stop-color="#171d30"/><stop offset="1" stop-color="#0b0e18"/></linearGradient>
      <radialGradient id="bsLamp"><stop offset="0" stop-color="#ffe2a6" stop-opacity=".2"/><stop offset="1" stop-color="#ffe2a6" stop-opacity="0"/></radialGradient></defs>`;
    g += hqPoly([hqP(0, 0), hqP(FW, 0), hqP(FW, FD), hqP(0, FD)], 'fill="url(#bsFloor)"');
    g += hqPoly([hqP(0, 0, 0), hqP(FW, 0, 0), hqP(FW, 0, WH), hqP(0, 0, WH)], 'fill="url(#bsWA)"');
    g += hqPoly([hqP(0, 0, 0), hqP(0, FD, 0), hqP(0, FD, WH), hqP(0, 0, WH)], 'fill="url(#bsWB)"');
    g += `<path d="M${hqS(hqP(0, FD, 0))}L${hqS(hqP(0, 0, 0))}L${hqS(hqP(FW, 0, 0))}" fill="none" stroke="rgba(255,255,255,.08)" stroke-width="2"/>`;
    // the windows on the right-hand wall: the city outside, as it looks at this time of day
    const z1 = 0.85, z2 = 2.95, panes = [[0.7, 3.4], [3.6, 6.3], [6.5, 9.4]];
    g += hqPoly([hqP(0.7, 0, z1), hqP(9.4, 0, z1), hqP(9.4, 0, z2), hqP(0.7, 0, z2)], 'fill="url(#bsSky)"');
    let seed = 11; const rnd = () => (seed = (seed * 9301 + 49297) % 233280) / 233280;
    for (let x = 0.7; x < 9.35;) {
      const w = 0.32 + rnd() * 0.5, x2 = Math.min(9.4, x + w), top = z1 + 0.3 + rnd() * 1.4;
      g += hqPoly([hqP(x, 0, z1), hqP(x2, 0, z1), hqP(x2, 0, top), hqP(x, 0, top)], `fill="${sky[2] > .5 ? '#0b0f1f' : '#24304a'}"`);
      if (sky[2] > .3) for (let wz = z1 + 0.12; wz < top - 0.12; wz += 0.2) for (let wx = x + 0.06; wx < x2 - 0.09; wx += 0.15) if (rnd() < 0.3 * sky[2] + 0.04)
        g += hqPoly([hqP(wx, 0, wz), hqP(wx + 0.07, 0, wz), hqP(wx + 0.07, 0, wz + 0.08), hqP(wx, 0, wz + 0.08)], 'fill="#ffd98a" fill-opacity=".72"');
      x = x2 + 0.03 + rnd() * 0.12;
    }
    [[3.4, 3.6], [6.3, 6.5]].forEach(([a, b]) => { g += hqPoly([hqP(a, 0, z1), hqP(b, 0, z1), hqP(b, 0, z2), hqP(a, 0, z2)], 'fill="#151a2b"'); });
    panes.forEach(([a, b]) => { g += hqPoly([hqP(a, 0, z1), hqP(b, 0, z1), hqP(b, 0, z2), hqP(a, 0, z2)], 'fill="#9ab8ff" fill-opacity=".04" stroke="#2f3754" stroke-width="2.5"'); });
    g += hqBox(0.6, 0, z1 - 0.07, 8.9, 0.12, 0.07, ['#2a3149', '#1c2133', '#161a28']);  // the sill
    // the big screen at the far end of the table
    g += hqPoly([hqP(0, 1.27, 0.86), hqP(0, 5.53, 0.86), hqP(0, 5.53, 3.04), hqP(0, 1.27, 3.04)], 'fill="#05070c" stroke="#2c3348" stroke-width="2"');
    g += `<g class="bs-screen">${bossScreen()}</g>`;
    // the rug and the lamps' light on the table
    g += hqPoly([hqP(1.3, 1.45), hqP(9.85, 1.45), hqP(9.85, 5.45), hqP(1.3, 5.45)], 'fill="#ffd36e" fill-opacity=".045" stroke="#ffd36e" stroke-opacity=".3" stroke-dasharray="6 7"');
    // the people across the table (they face you), then the table, then the near row (their backs to you)
    const back = BOSS.seats.filter(s => s.row === 'b').sort((a, b) => a.x - b.x), near = BOSS.seats.filter(s => s.row === 'f').sort((a, b) => a.x - b.x);
    back.forEach(s => { g += bossSeatSvg(s, BOSS.seats.indexOf(s)); });
    g += hqBox(2.45, 3.0, 0, 0.5, 0.8, 0.58, ['#1a1f2c', '#141824', '#10131c']) + hqBox(7.45, 3.0, 0, 0.5, 0.8, 0.58, ['#1a1f2c', '#141824', '#10131c']);
    g += hqBox(2.0, 2.7, 0.58, 6.4, 1.4, 0.09, ['#2d3549', '#1d2232', '#171b28', 'rgba(255,211,110,.38)']);
    [3.4, 5.2, 7.0].forEach(x => { const c = hqP(x, 3.4, 0.67); g += `<ellipse cx="${f(c[0])}" cy="${f(c[1])}" rx="${f(1.5 * HQ.AX)}" ry="${f(1.1 * HQ.AY)}" fill="url(#bsLamp)"/>`; });
    let papers = '';
    BOSS.seats.forEach(s => {
      const y1 = s.row === 'b' ? 2.84 : 3.62, y2 = y1 + 0.34;
      papers += hqPoly([hqP(s.x - 0.2, y1, 0.672), hqP(s.x + 0.2, y1, 0.672), hqP(s.x + 0.2, y2, 0.672), hqP(s.x - 0.2, y2, 0.672)], `class="bs-paper" data-id="${esc(s.d.id)}" style="--c:${s.d.color || '#8d93a3'}"`);
    });
    g += `<g aria-hidden="true">${papers}</g>`;
    g += hqPoly([hqP(7.95, 3.18, 0.672), hqP(8.3, 3.18, 0.672), hqP(8.3, 3.62, 0.672), hqP(7.95, 3.62, 0.672)], 'fill="#ffd36e" fill-opacity=".85"');  // the boss's place at the head
    near.forEach(s => { g += bossSeatSvg(s, BOSS.seats.indexOf(s)); });
    // the boss's chair at the head of the table: you're standing behind it
    const bx = 9.05, by = 3.4, star = hqP(bx + 0.43, by, 1.32);
    g += `<g aria-hidden="true">${hqBox(bx - 0.36, by - 0.36, 0, 0.72, 0.72, 0.48, ['#3b3424', '#2a2418', '#221d13'])}`
      + hqBox(bx - 0.34, by - 0.44, 0.48, 0.62, 0.1, 0.3, ['#4a4029', '#2f2919', '#262014'])
      + hqBox(bx + 0.27, by - 0.42, 0.48, 0.15, 0.84, 1.3, ['#5a4c2c', '#3a311d', '#4a3f25', 'rgba(255,211,110,.75)'])
      + hqBox(bx - 0.34, by + 0.34, 0.48, 0.62, 0.1, 0.3, ['#4a4029', '#2f2919', '#262014'])
      + `<path transform="translate(${f(star[0])} ${f(star[1])})" d="M0,-9 L2.6,-2.8 9,-2.8 3.9,1.2 5.8,7.6 0,3.9 -5.8,7.6 -3.9,1.2 -9,-2.8 -2.6,-2.8Z" fill="#ffd36e"/>`;
    const yl = hqP(bx + 0.35, by + 0.6, 0);
    g += `<text class="bs-you" x="${f(yl[0])}" y="${f(yl[1] + 30)}" text-anchor="middle">YOUR SEAT</text></g>`;
    g += `<g class="bs-names" aria-hidden="true">${bossName()}</g><g class="bs-bub" aria-hidden="true">${bossBubbles()}</g>`;
    const n = BOSS.seats.length;
    return `<svg class="bs-scene" viewBox="0 0 ${BOSSVB[0]} ${BOSSVB[1]}" role="group" aria-label="The boardroom: ${n} people at the table and your seat at the head. Choose anyone to hear from them or ask them something.">${g}</svg>`;
  });
}
/* the panel beside the room */
function bossCard() {
  const F = BOSS.st.firm || {}, A = BOSS.st.analyst || {}, c = BOSS.cards[BOSS.i] || { k: 'hi' }, n = BOSS.cards.length, d = c.d || fzD(F, 'pm'), col = d.color || '#c3b4ff';
  let sub = 'runs the meeting', say, head, body = '';
  if (c.k === 'hi') {
    say = `${bossHi()}, boss. Everyone’s here${BOSS.busyLabel ? `, in the middle of the ${BOSS.busyLabel.toLowerCase()}` : ''}.`;
    head = F.gist && F.gist.summary ? F.gist.summary : A.headline || 'Here’s where things stand.';
    body = `<p class="bs-p1">${F.gist && F.gist.summary ? `That’s the short version of the ${esc((F.gist.label || 'last meeting').toLowerCase())}. ` : ''}Next, each desk walks you through what it found. Ask anyone anything, or give the whole firm an order.</p>`;
  } else if (c.k === 'end') {
    say = 'That’s everyone, boss.';
    head = A.headline ? `My call right now: ${A.headline}` : 'Anything else you want to know?';
    body = '<p class="bs-p1">Ask anyone a question, give the firm an order, or leave the meeting when you’re done.</p>';
  } else {
    const p = c.p, team = (F.teams || []).find(t => t.id === d.team), v = s => FZV[s.view] || [cap(s.view || ''), '#8d93a3'];
    sub = `${team ? team.name + ' · ' : ''}${FZK[p.kind] || p.kind} · ${fzAgo(p.at)}`;
    say = bossOpener(d, p); head = p.headline;
    const stocks = (p.stocks || []).map(s => `<span class="fz-tk" style="--c:${v(s)[1]}"><b>${esc(s.ticker)}</b>${esc(v(s)[0])}</span>`).join('');
    const more = `${p.body && p.body !== p.headline ? `<p>${esc(p.body)}</p>` : ''}${stocks ? `<div class="fz-tags">${stocks}</div>` : ''}${(p.sources || []).length ? `<div class="fz-srcs">${p.sources.map(fzSrc).join('')}</div>` : ''}`;
    if (more) body = hqDet('bs' + p.id, '<span class="hq-ph">Hear the whole thing</span>', more, 'bs-more');
  }
  const pos = c.k === 'hi' ? 'Welcome' : c.k === 'end' ? 'Wrap-up' : `${BOSS.i} of ${n - 2}`;
  const next = BOSS.i === 0 ? (n > 2 ? 'Start the rundown' : 'Next') : BOSS.i < n - 2 ? 'Next desk' : 'Wrap up';
  return `<div class="bs-ch">${fzAv(d, 44)}<div><b>${esc(HQL[d.id] || d.name)}</b><span>${esc(sub)}</span></div><span class="bs-n">${pos}</span></div>
    <p class="bs-say">“${esc(say)}”</p><p class="bs-hl" style="--c:${col}">${esc(head)}</p>${body}
    <div class="bs-nav"><button class="hq-btn" data-b="prev"${BOSS.i ? '' : ' disabled'}>‹ Back</button>${BOSS.i < n - 1 ? `<button class="fz-btn" data-b="next">${next} ›</button>` : ''}</div>`;
}
function bossLog() {
  const F = BOSS.st.firm || {};
  if (!BOSS.log.length) return '<p class="bs-empty">Ask anyone a question, or give the firm an order.<br>It shows up here, with their answers.</p>';
  return BOSS.log.map(x => {
    if (x.who === 'boss') return `<div class="bs-m me"><span class="bs-mw">You${x.kind === 'order' ? ', giving an order' : x.kind === 'room' ? ', to the room' : x.to ? ' → ' + esc(HQL[x.to] || fzD(F, x.to).name) : ''}</span><p>${esc(x.text)}</p></div>`;
    const d = fzD(F, x.who);
    return `<div class="bs-m">${fzAv(d, 30)}<div><span class="bs-mw">${esc(HQL[d.id] || d.name)}</span>${x.pending
      ? `<p class="bs-wait"><i></i><i></i><i></i>thinking it over (about a minute${BOSS.busyLabel ? ', longer while the firm is mid-meeting' : ''})</p>`
      : `<p>${esc(x.text)}</p>${x.suggest ? `<p class="bs-next"><b>Next:</b> ${esc(x.suggest)}</p>` : ''}`}</div></div>`;
  }).join('');
}
function bossOrders() {
  const os = ((BOSS.st.firm || {}).boss || {}).orders || [];
  return os.length ? hqDet('bs-orders', `<span class="hq-ph">Your standing orders (${os.length})</span>`, os.map(o => `<div class="bs-o"><p>${esc(o.text)}</p><span>${esc(fzAgo(o.at))}</span><button class="hq-btn" data-b="drop" data-at="${esc(o.at)}">Take back</button></div>`).join('')) : '';
}
function bossForm() {
  const F = BOSS.st.firm || {}, m = BOSS.mode, st = BOSS.st;
  const ids = ['pm', ...(F.desks || []).filter(d => d.id !== 'pm').map(d => d.id)];
  const nm = HQL[BOSS.to] || fzD(F, BOSS.to).name;
  const ph = m === 'order' ? 'Give the firm an order, like “Keep an eye on my stop orders tonight.”' : m === 'room' ? 'Ask the whole room, like “What’s the biggest risk to my account this week?”' : `Ask ${nm} anything, like “What does this mean for my stocks?”`;
  const hint = m === 'order' ? `Every desk and the PM follow it from their next piece of work. It can’t place a trade: every order still needs your OK, and you place it yourself.`
    : m === 'room' ? 'The PM answers for the whole room. Answers take about a minute.' : 'Answers take about a minute.';
  return `<div class="bs-modes" role="group" aria-label="What you want to do">${[['ask', 'Ask a desk'], ['room', 'Ask the room'], ['order', 'Give an order']].map(([k, l]) => `<button type="button" data-b="mode" data-m="${k}" aria-pressed="${m === k}">${l}</button>`).join('')}</div>
    ${m === 'ask' ? `<label class="bs-to"><span>Ask</span><select data-b="to">${ids.map(id => `<option value="${esc(id)}"${id === BOSS.to ? ' selected' : ''}>${esc(HQL[id] || fzD(F, id).name)}</option>`).join('')}</select></label>` : ''}
    <textarea rows="2" maxlength="600" aria-label="${m === 'order' ? 'Your order' : 'Your question'}" placeholder="${esc(ph)}"></textarea>
    <div class="bs-send"><span class="bs-hint">${esc(hint)}</span><button type="submit" class="fz-btn"${BOSS.busy && m !== 'order' ? ' disabled' : ''}>${m === 'order' ? 'Give the order' : m === 'room' ? 'Ask the room' : 'Ask'}</button></div>`;
}
function bossSub() {
  const F = BOSS.st.firm || {}, m = F.meeting;
  return `You’re the boss · ${fzT(new Date().toISOString())} · ${BOSS.seats.length} desks with new work at the table${m ? ` · the ${m.label.toLowerCase()} is going on` : ''}`;
}
function bossBar() {
  const lights = '<div class="lights"><button class="c" data-act="win" data-w="close" aria-label="Hide" title="Hide the window. SRM Finance keeps running."></button><button class="m" data-act="win" data-w="min" aria-label="Minimize"></button><button class="f" data-act="win" data-w="full" aria-label="Full screen"></button></div>';
  return `<div class="bs-l ct-drag">${lights}<span class="bs-live" aria-hidden="true"></span><div class="ct-drag"><b id="bs-t">The boardroom</b><span class="bs-sub">${esc(bossSub())}</span></div></div>
    <button class="hq-btn bs-leave" data-b="leave">Leave the meeting</button>`;
}
function bossPart(k) {
  const el = $('#boss'); if (!el) return;
  if (k === 'card') { const a = document.activeElement, was = a && a.closest && a.closest('.bs-card') ? a.dataset.b || '' : null;
    $('.bs-card', el).innerHTML = bossCard();
    if (was !== null) { const b = $(`.bs-card [data-b="${was || 'next'}"]:not([disabled])`, el) || $('.bs-card [data-b="next"]', el) || $('.bs-card [data-b="prev"]:not([disabled])', el); if (b) b.focus({ preventScroll: true }); } }
  else if (k === 'log') { const L = $('.bs-log', el); L.innerHTML = bossLog(); L.scrollTop = L.scrollHeight; }
  else if (k === 'orders') { const o = $('.bs-ow', el); o.innerHTML = bossOrders(); o.hidden = !o.innerHTML; }
  else if (k === 'sub') { const s = $('.bs-sub', el); if (s) s.textContent = bossSub(); }
  else if (k === 'form') { const t = $('.bs-form textarea', el), v = t ? t.value : '', fa = t && document.activeElement === t;
    $('.bs-form', el).innerHTML = bossForm(); const t2 = $('.bs-form textarea', el); if (t2) { t2.value = v; if (fa) t2.focus(); } }
}
function bossPaint() {  // the room follows the conversation: who's lit up, the screen, the bubbles
  const el = $('#boss'); if (!el) return;
  const sp = bossSpeaker();
  el.querySelectorAll('.bs-p').forEach(g => g.classList.toggle('on', g.dataset.id === sp));
  el.querySelectorAll('.bs-paper').forEach(g => g.classList.toggle('on', g.dataset.id === sp));
  hqCam(BOSSCAM, () => {
    const s = $('.bs-screen', el), b = $('.bs-bub', el), nm = $('.bs-names', el);
    if (s) s.innerHTML = bossScreen(); if (b) b.innerHTML = bossBubbles(); if (nm) nm.innerHTML = bossName();
  });
}
function bossGo(n) {
  n = Math.max(0, Math.min(BOSS.cards.length - 1, n)); if (n === BOSS.i || BOSS.done) return;
  BOSS.i = n; const c = BOSS.cards[n], d = c.d || { id: 'pm' };
  BOSS.talk = { id: d.id, text: c.k === 'hi' ? `${bossHi()}, boss.` : c.k === 'end' ? 'That’s everyone, boss.' : bossOpener(d, c.p) };
  if (!BOSS.picked) BOSS.to = d.id;
  bossPart('card'); bossPart('form'); bossPaint();
}
async function bossSend() {
  const el = $('#boss'), A = api(); if (!el || !A || BOSS.done) return;
  const t = $('.bs-form textarea', el), q = ((t && t.value) || '').trim();
  if (!q) { if (t) t.focus(); return; }
  const F = BOSS.st.firm || (BOSS.st.firm = {});
  if (BOSS.mode === 'order') {
    t.value = ''; BOSS.log.push({ who: 'boss', kind: 'order', text: q }); bossPart('log');
    let r; try { r = await A.boss_order(q); } catch (e) { r = null; }
    if (!$('#boss')) return;
    BOSS.log.push({ who: 'pm', text: (r && r.said) || 'Sorry, boss: I couldn’t write that down. Try again in a moment.' });
    if (r && r.ok) {
      BOSS.ordered++; F.boss = { ...(F.boss || {}), orders: r.orders || [] };
      BOSS.talk = { id: 'pm', text: 'Understood, boss.' }; el.classList.add('nod'); setTimeout(() => el.classList.remove('nod'), 1400);
    }
    bossPart('orders'); bossPart('log'); bossPaint(); return;
  }
  if (BOSS.busy) return;
  const to = BOSS.mode === 'room' ? 'pm' : BOSS.to || 'pm';
  const hist = BOSS.log.filter(x => !x.pending).slice(-8).map(x => ({ who: x.who === 'boss' ? 'the boss' : HQL[x.who] || x.who, text: x.text || '' }));
  t.value = ''; BOSS.busy = true; BOSS.pending = to;
  BOSS.log.push({ who: 'boss', kind: BOSS.mode, text: q, to: BOSS.mode === 'ask' ? to : null });
  const row = { who: to, pending: true }; BOSS.log.push(row);
  bossPart('log'); bossPart('form'); bossPaint();
  let r; try { r = await A.boss_ask(to, q, hist); } catch (e) { r = null; }
  row.pending = false; row.text = (r && r.answer) || 'Sorry, boss: I couldn’t answer just now. Try me again in a minute.'; row.suggest = r && !r.error ? r.suggest : '';
  BOSS.busy = false; BOSS.pending = null; if (r && !r.error) BOSS.asked++;
  BOSS.talk = { id: to, text: r && !r.error ? 'Here’s my answer, boss.' : 'Sorry, boss.' };
  if (!$('#boss') || BOSS.done) return;  // they left while waiting
  bossPart('log'); bossPart('form'); bossPaint();
}
async function bossDrop(at, b) {
  b.disabled = true;
  let r; try { r = await api().boss_drop(at); } catch (e) { r = null; }
  if (!r || !r.ok) { b.disabled = false; return; }
  const F = BOSS.st.firm || {}; F.boss = { ...(F.boss || {}), orders: r.orders || [] };
  BOSS.log.push({ who: 'pm', text: 'Got it, boss: that order is off. Everyone ignores it from now on.' }); BOSS.talk = { id: 'pm', text: 'Got it, boss.' };
  bossPart('orders'); bossPart('log'); bossPaint();
}
function bossCount() {
  const a = BOSS.asked, o = BOSS.ordered, q = n => n === 1 ? 'one question' : n + ' questions', g = n => n === 1 ? 'one order' : n + ' orders';
  return a && o ? `You asked ${q(a)} and gave ${g(o)}.` : a ? `You asked ${q(a)}.` : o ? `You gave ${g(o)}.` : 'You heard the rundown.';
}
function bossLeave() {
  const el = $('#boss'); if (!el || BOSS.done) return;
  BOSS.done = true; BOSS.pending = null; BOSS.talk = { id: 'pm', text: 'Thanks, boss.' };
  try { api().boss_end(BOSS.asked, BOSS.ordered); } catch (e) { /* the meeting log just misses this one */ }
  const F = BOSS.st.firm || {}, nx = (F.next || [])[0], o = BOSS.ordered, meet = o && !F.meeting;
  $('.bs-side', el).innerHTML = `<section class="bs-card bs-end" aria-live="polite"><div class="bs-ch">${fzAv(fzD(F, 'pm'), 44)}<div><b>Meeting over</b><span>${esc(bossCount())}</span></div></div>
    <p class="bs-say">“Thanks, boss. We’re on it.”</p>
    <p class="bs-p1">${o ? `Your ${o === 1 ? 'order is' : 'orders are'} on the board. Every desk and the PM follow ${o === 1 ? 'it' : 'them'} from their next piece of work${nx ? `; the next meeting is the ${esc(nx.label.toLowerCase())}, ${esc(fzWhen(nx.at))}` : ''}.` : 'Everything they told you stays on the board, so you can read it again anytime.'}</p>
    <div class="bs-nav bs-endnav">${meet ? '<button class="fz-btn" data-b="meet">Have the firm meet on it now</button>' : ''}<button class="${meet ? 'hq-btn' : 'fz-btn'}" data-b="out">Back to the office</button></div></section>`;
  el.classList.add('enter');  // they stand up as you leave
  bossPaint();
  setTimeout(() => { const b = $('.bs-endnav button', el); if (b) b.focus({ preventScroll: true }); }, 40);
}
function bossMeet(b) {
  b.disabled = true; b.textContent = 'Calling the meeting…';
  api().call_meeting('The boss just gave the firm new standing orders in a meeting: work them into everything.').then(r => { bossClose(); (BOSS.opt && BOSS.opt.toast || toast)((r && r.said) || 'Started.', 7000); }).catch(() => bossClose());
}
function bossClose() {
  const el = $('#boss'); if (!el) return;
  clearInterval(BOSS.timer); if (BOSS.guard) document.removeEventListener('keydown', BOSS.guard, true);
  const ct = $('#ct'); if (ct) ct.inert = false;
  document.documentElement.classList.remove('bs-lock');
  el.classList.add('out'); setTimeout(() => el.remove(), 240);
  const A = api(), st = BOSS.st;
  if (A && st) A.firm_view().then(f => { if (f && f.on) { st.firm = f; const box = $('.hq'); if (box && box._live) box._live(); } }).catch(() => { /* the next refresh shows it */ });
  if (BOSS.back && BOSS.back.isConnected) BOSS.back.focus({ preventScroll: true });
}
function bossTick() {
  if (!$('#boss')) { clearInterval(BOSS.timer); return; }
  if (!BOSS.done) { bossPart('sub'); bossPaint(); }
  if (!document.hidden && !BOSS.done && Date.now() - BOSS.joined > 4.5 * 60e3) { BOSS.joined = Date.now(); try { api().boss_join(); } catch (e) { /* fine */ } }  // the clock keeps waiting while you're here
}
function bossBind(el) {
  el.addEventListener('click', e => {
    const lk = e.target.closest('[data-fact="link"]'); if (lk && api()) { api().open_link(lk.dataset.u); return; }
    const b = e.target.closest('[data-b]'); if (!b || b.disabled) return;
    const k = b.dataset.b;
    if (k === 'next' || k === 'prev') bossGo(BOSS.i + (k === 'next' ? 1 : -1));
    else if (k === 'seat' && !BOSS.done) {
      const n = BOSS.cards.findIndex(c => c.k === 'desk' && c.d.id === b.dataset.id);
      if (n > 0 && n !== BOSS.i) bossGo(n);
      else { BOSS.to = b.dataset.id; BOSS.picked = true; BOSS.mode = 'ask'; BOSS.talk = { id: b.dataset.id, text: b.dataset.id === 'pm' ? 'Yes, boss?' : 'What can I do, boss?' }; bossPart('form'); bossPaint(); const t = $('.bs-form textarea', el); if (t) t.focus(); }
    }
    else if (k === 'mode') { BOSS.mode = b.dataset.m; bossPart('form'); const t = $('.bs-form textarea', el); if (t) t.focus(); }
    else if (k === 'drop') bossDrop(b.dataset.at, b);
    else if (k === 'leave') bossLeave();
    else if (k === 'meet') bossMeet(b);
    else if (k === 'out') bossClose();
  });
  el.addEventListener('change', e => { if (e.target.matches('select[data-b="to"]')) { BOSS.to = e.target.value; BOSS.picked = true; BOSS.talk = { id: BOSS.to, text: 'Yes, boss?' }; bossPart('form'); bossPaint(); } });
  el.addEventListener('submit', e => { e.preventDefault(); bossSend(); });
  el.addEventListener('toggle', e => { const d = e.target; if (d && d.matches && d.matches('details[data-k]')) { if (d.open) FZ.openK.add(d.dataset.k); else FZ.openK.delete(d.dataset.k); } }, true);  // folds stay open when the panel redraws
  el.addEventListener('keydown', e => {
    if (e.key === 'Escape') { e.preventDefault(); if (BOSS.done) bossClose(); else bossLeave(); }
    else if (e.key === 'Enter' && e.target.matches('textarea') && !e.shiftKey && !e.isComposing) { e.preventDefault(); bossSend(); }
    else if ((e.key === 'Enter' || e.key === ' ') && e.target.matches('.bs-p')) { e.preventDefault(); e.target.dispatchEvent(new MouseEvent('click', { bubbles: true })); }
    else if (e.key === 'Tab') {
      const fs = [...el.querySelectorAll('button:not([disabled]), select, textarea, summary, [tabindex="0"]')].filter(x => x.getClientRects().length);
      if (fs.length && e.shiftKey && document.activeElement === fs[0]) { e.preventDefault(); fs[fs.length - 1].focus(); }
      else if (fs.length && !e.shiftKey && document.activeElement === fs[fs.length - 1]) { e.preventDefault(); fs[0].focus(); }
    }
    e.stopPropagation();  // the app behind doesn't hear keys while you're in the meeting
  });
  const room = $('.bs-room', el), tip = $('.bs-tip', el);
  room.addEventListener('mousemove', e => {
    const o = e.target.closest && e.target.closest('.bs-p'); if (!o) { tip.hidden = true; return; }
    const r = room.getBoundingClientRect(); tip.textContent = o.dataset.tip; tip.hidden = false;
    tip.style.left = Math.max(4, Math.min(r.width - tip.offsetWidth - 4, e.clientX - r.left + 14)) + 'px'; tip.style.top = (e.clientY - r.top + 18) + 'px';
  });
  room.addEventListener('mouseleave', () => { tip.hidden = true; });
  BOSS.guard = e => { const b = $('#boss'); if (!b || b.contains(e.target)) return; e.stopPropagation(); e.preventDefault(); if (e.key === 'Escape') { if (BOSS.done) bossClose(); else bossLeave(); } else { const f = $('.bs-card button:not([disabled])', b) || $('.bs-leave', b); if (f) f.focus(); } };
  document.addEventListener('keydown', BOSS.guard, true);
}
async function bossOpen(st, opt, from) {
  if (!api() || $('#boss')) return;
  bossStyle();
  const F = st.firm || {}, L = bossLineup(F), pm = fzD(F, 'pm');
  Object.assign(BOSS, { st, opt, back: from || document.activeElement, cards: [{ k: 'hi', d: pm }, ...L.pres.map(x => ({ k: 'desk', d: x.d, p: x.p })), { k: 'end', d: pm }],
    seats: L.seats, i: 0, log: [], mode: 'ask', to: 'pm', picked: false, busy: false, pending: null, asked: 0, ordered: 0, done: false,
    busyLabel: F.meeting ? F.meeting.label : '', talk: { id: 'pm', text: `${bossHi()}, boss.` }, joined: Date.now() });
  const el = document.createElement('div');
  el.id = 'boss'; el.className = 'boss enter'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true'); el.setAttribute('aria-labelledby', 'bs-t');
  el.innerHTML = `<header class="bs-bar ct-drag">${bossBar()}</header>
    <div class="bs-main"><div class="bs-room">${bossScene()}<div class="hq-tip bs-tip" role="tooltip" hidden></div></div>
      <aside class="bs-side" aria-label="The meeting"><section class="bs-card" aria-live="polite">${bossCard()}</section><div class="bs-ow"${bossOrders() ? '' : ' hidden'}>${bossOrders()}</div>
        <section class="bs-log" aria-label="What was said" aria-live="polite">${bossLog()}</section><form class="bs-form" autocomplete="off">${bossForm()}</form></aside></div>`;
  document.body.appendChild(el);
  const ct = $('#ct'); if (ct) ct.inert = true;
  document.documentElement.classList.add('bs-lock');
  bossBind(el); bossPaint();
  const rm = $('.bs-room', el); if (rm.scrollWidth > rm.clientWidth + 4) rm.scrollLeft = (rm.scrollWidth - rm.clientWidth) / 2;  // a narrow window: the table in the middle
  setTimeout(() => el.classList.remove('enter'), 4300);
  setTimeout(() => { const b = $('.bs-card [data-b="next"]', el) || $('.bs-leave', el); if (b) b.focus({ preventScroll: true }); }, 60);
  clearInterval(BOSS.timer); BOSS.timer = setInterval(bossTick, 15000);
  try {
    const r = await api().boss_join();
    if (r && r.busy && !BOSS.busyLabel) { BOSS.busyLabel = r.busy; bossPart('card'); }
    if (r && r.ai === false) toast('Claude isn’t signed in on this Mac, so the desks can brief you but can’t answer questions yet.', 8000);
  } catch (e) { /* the room still works */ }
}
function bossChoose(st, opt, btn) {  // "Call a meeting now": join as the boss, or let them meet without you
  const F = st.firm || {};
  bossStyle();
  if (F.meeting) { bossOpen(st, opt, btn); return; }
  openSheet('<div><h3>Call a meeting</h3><p class="d">How do you want to run it?</p></div>', `<div class="bs-pick">
    <button class="bs-opt yes" data-bj="join"><span aria-hidden="true">🪑</span><b>Join as the boss</b><small>Walk into the boardroom. Everyone stands up, the PM gives you the short version, and each desk walks you through what it found. Ask anyone a question, or give the whole firm an order. Answers take about a minute.</small></button>
    <button class="bs-opt" data-bj="run"><span aria-hidden="true">📋</span><b>Let them meet without you</b><small>The whole firm meets on its own for about 20 to 30 minutes, then the PM writes a fresh briefing. You can watch it live on this tab.</small></button></div>`);
  const L = $('#layer'), j = $('[data-bj="join"]', L), r = $('[data-bj="run"]', L);
  if (j) j.onclick = () => { closeSheet(); bossOpen(st, opt, btn); };
  if (r) r.onclick = () => {
    r.disabled = true; $('b', r).textContent = 'Calling the meeting…';
    api().call_meeting('').then(x => { closeSheet(); (opt && opt.toast || toast)((x && x.said) || 'Started.', 7000); }).catch(() => closeSheet());
  };
  setTimeout(() => { if (j) j.focus({ preventScroll: true }); }, 45);
}
function bossStyle() {
  if (document.getElementById('bs-css')) return;
  const css = `
.bs-lock,.bs-lock body{overflow:hidden}
.boss{--g:#3ff2a3;--r:#ff5f6e;--ink:#eef0f6;--ink2:#c5cad6;--dim:#8d93a3;--line:rgba(255,255,255,.08);position:fixed;inset:0;z-index:200;display:flex;flex-direction:column;background:radial-gradient(120% 90% at 36% 26%,#141b2e,#05060a 72%);color:var(--ink);animation:bsIn .6s cubic-bezier(.2,.8,.2,1) both}
.boss.out{animation:bsOut .24s ease both}
@keyframes bsIn{from{opacity:0;transform:scale(1.05)}to{opacity:1;transform:none}}@keyframes bsOut{to{opacity:0;transform:scale(.985)}}
.bs-bar{flex:none;display:flex;align-items:center;justify-content:space-between;gap:14px;min-height:60px;padding:0 18px;border-bottom:1px solid rgba(255,255,255,.08);background:rgba(8,10,15,.62);-webkit-backdrop-filter:blur(12px);backdrop-filter:blur(12px)}
.bs-bar:hover .lights .c{background:#ff5f57}.bs-bar:hover .lights .m{background:#febc2e}.bs-bar:hover .lights .f{background:#28c840}
.bs-l{display:flex;align-items:center;gap:12px;min-width:0}.bs-l>div{display:flex;flex-direction:column;gap:2px;min-width:0}
.bs-l b{font-size:15px;font-weight:700;letter-spacing:-.01em}.bs-sub{font-size:12.5px;color:var(--dim);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.bs-live{flex:none;width:9px;height:9px;border-radius:50%;background:#ffd36e;box-shadow:0 0 12px rgba(255,211,110,.7);animation:fzPing 1.8s infinite}
.bs-leave{flex:none;margin:0}
.bs-main{flex:1;min-height:0;display:grid;grid-template-columns:minmax(0,1fr) 440px}
.bs-room{position:relative;min-width:0;min-height:0;display:flex;align-items:center;justify-content:center;padding:10px 16px}
.bs-scene{display:block;width:100%;height:100%;user-select:none;-webkit-user-select:none}
.bs-side{min-height:0;display:flex;flex-direction:column;border-left:1px solid rgba(255,255,255,.08);background:rgba(9,11,17,.88)}
.bs-card{flex:none;max-height:52%;overflow:auto;padding:18px 20px 16px;border-bottom:1px solid var(--line)}
.bs-ch{display:flex;align-items:center;gap:12px}.bs-ch>div{flex:1;min-width:0;display:flex;flex-direction:column;gap:2px}.bs-ch b{font-size:16px;font-weight:700}.bs-ch span{font-size:12.5px;color:var(--dim)}
.bs-n{flex:none;font:600 11.5px ui-monospace,Menlo,monospace;letter-spacing:.06em;text-transform:uppercase;color:var(--dim)!important}
.bs-say{margin:12px 0 7px;font-size:14px;font-style:italic;color:#ffd36e}
.bs-hl{margin:0;padding-left:12px;border-left:3px solid var(--c);font-size:16px;line-height:1.5;font-weight:600;color:#fff}
.bs-p1{margin:10px 0 0;font-size:13.5px;line-height:1.55;color:var(--ink2)}
.bs-more{margin-top:8px}.bs-more .hq-dbody{padding-left:2px}
.bs-nav{display:flex;justify-content:space-between;align-items:center;gap:10px;margin-top:14px}.bs-nav .hq-btn{margin:0}.bs-nav button{white-space:nowrap}.bs-nav .fz-btn{width:auto}.bs-nav button[disabled]{opacity:.4;cursor:default}
.bs-endnav{justify-content:flex-start;flex-wrap:wrap}
.bs-ow{flex:none;padding:2px 20px;border-bottom:1px solid var(--line)}.bs-ow[hidden]{display:none}
.bs-o{display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:center;gap:4px 10px;padding:8px 0;border-top:1px solid var(--line)}.bs-o:first-child{border-top:0}
.bs-o p{grid-column:1/-1;margin:0;font-size:13.5px;line-height:1.45;color:var(--ink)}.bs-o span{font-size:12px;color:var(--dim)}.bs-o .hq-btn{margin:0;min-height:26px;padding:3px 10px;font-size:12.5px}
.bs-log{flex:1;min-height:90px;overflow:auto;padding:14px 20px;display:flex;flex-direction:column;gap:13px}
.bs-empty{margin:auto 0;font-size:13px;line-height:1.55;color:var(--dim);text-align:center}
.bs-m{display:flex;gap:10px;align-items:flex-start;animation:fzIn .3s ease}.bs-m>div{min-width:0;flex:1}
.bs-mw{display:block;margin-bottom:3px;font-size:12px;font-weight:650;color:var(--ink2)}
.bs-m p{margin:0;font-size:13.5px;line-height:1.55;color:var(--ink)}
.bs-m.me{flex-direction:column;align-items:flex-end}.bs-m.me .bs-mw{color:#ffd36e}
.bs-m.me p{max-width:88%;padding:9px 12px;border-radius:14px 14px 4px 14px;background:rgba(255,211,110,.12);border:1px solid rgba(255,211,110,.32);color:#fff}
.bs-next{margin-top:6px!important;font-size:12.5px!important;color:var(--ink2)!important}
.bs-wait{display:flex;align-items:center;flex-wrap:wrap;gap:5px;color:var(--dim)!important;font-size:13px!important}
.bs-wait i{width:6px;height:6px;border-radius:50%;background:currentColor;animation:hqDot 1.2s infinite}.bs-wait i:nth-child(2){animation-delay:.15s}.bs-wait i:nth-child(3){animation-delay:.3s;margin-right:5px}
.bs-form{flex:none;display:flex;flex-direction:column;gap:9px;padding:14px 20px 18px;border-top:1px solid var(--line);background:rgba(255,255,255,.015)}
.bs-modes{display:flex;flex-wrap:wrap;gap:6px}
.bs-modes button{min-height:30px;padding:5px 12px;border-radius:999px;border:1px solid rgba(255,255,255,.16);background:transparent;color:var(--ink2);font:inherit;font-size:13px;font-weight:600;cursor:pointer}
.bs-modes button:hover{border-color:rgba(255,255,255,.3);color:var(--ink)}.bs-modes button[aria-pressed=true]{border-color:rgba(255,211,110,.65);background:rgba(255,211,110,.13);color:#fff}
.bs-to{display:flex;align-items:center;gap:9px;font-size:13px;color:var(--ink2)}
.bs-to select{flex:1;min-width:0;min-height:34px;padding:5px 32px 5px 11px;border-radius:10px;border:1px solid rgba(255,255,255,.18);-webkit-appearance:none;appearance:none;background:#121620 url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'%3E%3Cpath d='M1 1.5l5 5 5-5' fill='none' stroke='%23c5cad6' stroke-width='1.8' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E") no-repeat right 12px center;color:var(--ink);font:inherit;font-size:13.5px;cursor:pointer}
.bs-form textarea{width:100%;min-height:64px;resize:vertical;padding:10px 12px;border-radius:12px;border:1px solid rgba(255,255,255,.18);background:#0f131c;color:var(--ink);font:inherit;font-size:14px;line-height:1.45}
.bs-form textarea::placeholder{color:#8a91a1}
.bs-send{display:flex;align-items:center;justify-content:space-between;gap:12px}.bs-send .fz-btn{flex:none;width:auto}.bs-hint{font-size:12px;line-height:1.4;color:var(--dim)}
.bs-p{cursor:pointer;outline:none}.bs-hit{fill:transparent;stroke:transparent;stroke-width:2;stroke-linejoin:round}
.bs-p:hover .bs-hit{fill:rgba(255,255,255,.04);stroke:rgba(255,255,255,.2)}.bs-p:focus-visible .bs-hit{stroke:#56cbff;stroke-width:2.5}
.bs-ring{opacity:0;transition:opacity .35s}.bs-p.on .bs-ring{opacity:1}
.bs-paper{fill:#cfd5e2;fill-opacity:.42;transition:fill .3s,fill-opacity .3s}.bs-paper.on{fill:var(--c);fill-opacity:.95}
.boss.enter .bs-body{animation:bsStand 2.6s cubic-bezier(.3,.7,.3,1) both;animation-delay:calc(var(--i) * 70ms + .35s)}
@keyframes bsStand{0%{transform:none}16%,70%{transform:translateY(-18px)}100%{transform:none}}
.boss.nod .bs-body{animation:bsNod .7s ease-in-out both;animation-delay:calc(var(--i) * 30ms)}
@keyframes bsNod{30%{transform:translateY(5px)}65%{transform:translateY(-2px)}}
.boss.enter .bs-bub{animation:bsPop .4s 1.9s both}@keyframes bsPop{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}
.bs-bb text{font:600 15px -apple-system,system-ui,sans-serif;fill:#fff}
.bs-st{font:700 15px ui-monospace,Menlo,monospace;letter-spacing:.1em}.bs-sl{font:600 15.5px -apple-system,system-ui,sans-serif;fill:#e9ecf4}
.bs-nm{font:650 15px -apple-system,system-ui,sans-serif;fill:#fff;paint-order:stroke;stroke:#07080c;stroke-width:5px;stroke-linejoin:round}
.bs-you{font:700 15px -apple-system,system-ui,sans-serif;letter-spacing:.12em;fill:#ffd36e;paint-order:stroke;stroke:#07080c;stroke-width:5px;stroke-linejoin:round}
.bs-busy{opacity:.75}
.bs-pick{--ink:#eef0f6;--ink2:#c5cad6;--dim:#8d93a3;display:flex;flex-direction:column;gap:12px;padding:4px 0}
.bs-opt{display:grid;grid-template-columns:44px minmax(0,1fr);column-gap:14px;row-gap:4px;align-items:start;padding:16px 18px;border-radius:18px;border:1px solid var(--line2);background:rgba(255,255,255,.035);color:var(--ink);font:inherit;text-align:left;cursor:pointer;transition:border-color .2s,background .2s}
.bs-opt span{grid-row:1/3;font-size:28px;line-height:44px;text-align:center}.bs-opt b{font-size:16px;font-weight:700}.bs-opt small{font-size:13.5px;line-height:1.5;color:var(--ink2)}
.bs-opt:hover{border-color:rgba(255,255,255,.26);background:rgba(255,255,255,.06)}.bs-opt[disabled]{opacity:.6;cursor:default}
.bs-opt.yes{border-color:rgba(255,211,110,.48);background:linear-gradient(120deg,rgba(255,211,110,.11),rgba(255,255,255,.02))}.bs-opt.yes:hover{border-color:rgba(255,211,110,.8)}
@media (max-width:1300px){.bs-main{grid-template-columns:minmax(0,1fr) 400px}}
@media (max-width:1100px){.boss{overflow:auto}.bs-main{display:block;flex:none}.bs-room{display:block;height:auto}.bs-scene{height:auto;max-height:640px}.bs-side{display:block;border-left:0;border-top:1px solid rgba(255,255,255,.08)}.bs-card{max-height:none}.bs-log{min-height:0;max-height:none;overflow:visible}}
@media (max-width:760px){.bs-room{overflow-x:auto;-webkit-overflow-scrolling:touch;padding:6px 0}.bs-scene{width:760px;max-width:none;max-height:none}}
@media (max-width:640px){.bs-card,.bs-log,.bs-form{padding-left:16px;padding-right:16px}.bs-ow{padding:2px 16px}.bs-bar{padding:0 12px;gap:10px}.bs-l{gap:9px}}
@media (min-width:1800px){.bs-main{grid-template-columns:minmax(0,1fr) 500px}}
@media (prefers-reduced-motion:reduce){.boss,.boss *{animation:none!important;transition:none!important}}
`;
  const el = document.createElement('style'); el.id = 'bs-css'; el.textContent = css; document.head.appendChild(el);
}

/* ---------------- v7: zoom into a room ----------------
   Sam: "when I click on the wall objects instead of scrolling me down to info it should zoom in to the betting markets
   for example showing all of the info in the model... an assistant or somebody on standby to help you and it knowing
   what you are looking at." Click anything in the office and the camera flies into it: the office fills the window,
   zooms to the object, and the object's screen comes off the wall to face you with everything on it. The desk that runs
   that room stands by beside it and answers questions about what's on the screen (Mac: a live Claude run). "Office"
   (or Esc) flies back out. The same camera gives Dad's guided tour (tourOpen). */
const RM = {  // where each room is in the office, and who stands by there
  markets: { wall: 'A', a: 2.6, b: 6.8, z1: 1.0, z2: 3.1, by: 'forecast', guide: [7.25, 0.95], ic: '📈', name: 'Betting markets', hello: 'Ask me about any of these odds, boss.' },
  predictions: { wall: 'A', a: 13.3, b: 19.7, z1: 0.9, z2: 3.35, by: 'forecast', guide: [12.95, 1.05], ic: '🎯', name: 'Scenario wall', hello: 'Want me to walk you through a scenario?' },
  board: { wall: 'B', a: 5.3, b: 9.0, z1: 0.95, z2: 3.35, by: 'pm', guide: [0.9, 9.35], ic: '📋', name: 'The board', hello: 'Ask me about anything on the board.' },
  calendar: { wall: 'B', a: 2.0, b: 4.75, z1: 1.2, z2: 3.25, by: 'fed', guide: [0.9, 5.1], ic: '🗓️', name: 'Calendar', hello: 'Ask me what any of these dates means for you.' },
  ideas: { wall: 'B', a: 9.65, b: 11.95, z1: 1.0, z2: 3.0, by: 'research', guide: [1.35, 12.0], ic: '💡', name: 'Ideas whiteboard', hello: 'Ask me about any stock up here.' },
  record: { box: [0.2, 12.35, 0.85, 2.45, 2.3], by: 'score', guide: [1.65, 14.85], ic: '🏆', name: 'Trophy case', hello: 'Ask me how the firm’s calls are doing.' },
  brain: { box: [0.85, 0.85, 1.5, 1.5, 2.95], by: 'pm', guide: [3.0, 2.75], ic: '🧠', name: 'The firm’s brain', hello: 'Ask me what the firm has learned.', wide: true },
  pm: { box: [8.0, 0.3, 4.6, 3.25, 2.4], by: 'pm', ic: '👔', name: 'Portfolio manager', hello: 'Yes, boss?' },
  meeting: { box: [7.45, 5.45, 5.2, 4.3, 1.9], by: 'pm', guide: [12.95, 8.1], ic: '🤝', name: 'Meeting room', hello: 'Want to call a meeting, boss?' },
};
const RMS = { id: null, st: null, opt: null, back: null, raf: 0, logs: {}, busy: false, guard: null, closing: false };
function rmCfg(id) {
  if (RM[id]) return RM[id];
  if (String(id).startsWith('desk:')) {
    const k = id.slice(5), p = HQD[k] || [9, 9], w = ['risk', 'redteam', 'score', 'watch'].includes(k) ? 1.3 : 1.4;
    return { box: [p[0] - 0.15, p[1] - 1.05, w + 0.3, 2.1, 2.3], by: k, desk: k, ic: '💼', name: HQL[k] || k, hello: 'What can I do for you, boss?' };
  }
  return RM.board;
}
function rmPts(id) {  // the object's outline in the office's own units (its four screen corners for a wall screen)
  const r = rmCfg(id);
  let tl, tr, bl, pts;
  if (r.wall === 'A') { pts = hqWA(r.a, r.b, r.z1, r.z2); tl = hqP(r.a, 0, r.z2); tr = hqP(r.b, 0, r.z2); bl = hqP(r.a, 0, r.z1); }
  else if (r.wall === 'B') { pts = hqWB(r.a, r.b, r.z1, r.z2); tl = hqP(0, r.b, r.z2); tr = hqP(0, r.a, r.z2); bl = hqP(0, r.b, r.z1); }
  else { const [x, y, w, d, h] = r.box; pts = hqHull(x, y, 0, w, d, h); }
  const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]), box = { x: Math.min(...xs), y: Math.min(...ys), w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys) };
  if (!tl) { tl = [box.x, box.y]; tr = [box.x + box.w, box.y]; bl = [box.x, box.y + box.h]; }
  return { box, tl, tr, bl, wall: !!r.wall };
}
const rmNarrow = () => innerWidth < 900;
function rmPanelW(id) { const W = innerWidth; return rmCfg(id).wide ? Math.min(1100, Math.max(560, W * 0.68)) : Math.min(900, Math.max(480, W * 0.56)); }  // v8: the panel is the screen
const RMTAB = { markets: 'Markets', predictions: 'Scenarios', board: 'Board', calendar: 'Calendar', ideas: 'Ideas', record: 'Record', brain: 'Brain', pm: 'PM', meeting: 'Meeting' };
function rmLive(id) {  // v8: the standby desk opens with something true about this screen, not the box's own prompt
  const F = RMS.st.firm || {}, A = RMS.st.analyst || {}, r = rmCfg(id), td = new Date().toDateString();
  if (r.desk) { const d = fzD(F, r.desk), n = (F.open || []).filter(x => x.desk === r.desk).length;
    return d.running ? 'Writing right now, boss.' : `${d.last_at ? 'My last post was ' + fzAgo(d.last_at) : 'Nothing from me yet today'}${n ? `, and I have ${n} open prediction${n === 1 ? '' : 's'}.` : '.'}`; }
  switch (id) {
    case 'markets': return `${(F.markets || []).length} sets of odds up here, checked ${fzAgo(F.markets_at) || 'today'}.`;
    case 'predictions': { const o = F.open || [], nx = o.slice().sort((a, b) => String(a.by).localeCompare(String(b.by)))[0]; return `${o.length} open call${o.length === 1 ? '' : 's'}.${nx ? ' The next one is decided ' + bzMD(nx.by) + '.' : ''}`; }
    case 'board': { const n = (F.feed || []).filter(p => new Date(p.at).toDateString() === td); return `${isNum(F.posts_today) ? F.posts_today : n.length} posts today, ${n.filter(p => p.kind === 'challenge').length} of them challenges.`; }
    case 'calendar': { const t0 = new Date(); t0.setHours(0, 0, 0, 0); const nx = (F.calendar || []).find(x => D(x.date) >= t0 && (x.importance || 1) > 1); return nx ? `Next up: ${nx.what}, ${MON[D(nx.date).getMonth()]} ${D(nx.date).getDate()}.` : 'Nothing big on the calendar yet.'; }
    case 'ideas': return `${(A.watchlist || []).length} stock${(A.watchlist || []).length === 1 ? '' : 's'} on the board right now.`;
    case 'record': { const R = F.record || {}, f = R.firm || {}; return R.resolved ? `${R.resolved} graded so far; ${Math.round((f.hit || 0) * 100)}% came true.` : `Nothing graded yet; ${R.open || 0} calls are still open.`; }
    case 'brain': return `${(A.lessons || []).length} lessons so far${A.review && A.review.at ? ', the last review ' + fzAgo(A.review.at) : ''}.`;
    case 'pm': { const br = (F.feed || []).find(p => p.desk === 'pm' && p.kind === 'briefing'); return `${br ? 'My last briefing was ' + fzAgo(br.at) : 'No briefing yet today'}; ${A.n_actions || 0} order${A.n_actions === 1 ? '' : 's'} on Today.`; }
    case 'meeting': return F.meeting ? `${F.meeting.label} is on right now.` : (F.next || [])[0] ? `Next: ${F.next[0].label.toLowerCase()}, ${fzWhen(F.next[0].at)}.` : '';
  }
  return '';
}
function rmFit(W, H) { const s = Math.min(W / HQ.W, H / HQ.H), vw = W / s, vh = H / s; return [HQ.W / 2 - vw / 2, HQ.H / 2 - vh / 2, vw, vh]; }
function rmFrame(id, W, H) {  // the camera for a room: the object big, in the part of the window the panel leaves free
  const { box: b } = rmPts(id), base = Math.min(W / HQ.W, H / HQ.H), cx = b.x + b.w / 2, cy = b.y + b.h / 2;
  if (rmNarrow()) { const s = Math.max(base, Math.min(W * 0.62 / b.w, H * 0.62 / b.h, 3.4 * base)); return [cx - W / 2 / s, cy - H / 2 / s, W / s, H / s]; }
  const L = W - rmPanelW(id) - 48, s = Math.max(base, Math.min(L * 0.7 / b.w, H * 0.58 / b.h, 3.3 * base));
  return [cx - (L / 2 + 24) / s, cy - (H / 2) / s, W / s, H / s];
}
function rmCam(svg, to, ms, done) {  // fly the camera: the picture's viewBox, eased
  cancelAnimationFrame(RMS.raf);
  const vb = svg.viewBox.baseVal, from = [vb.x, vb.y, vb.width, vb.height], t0 = performance.now();
  const set = v => svg.setAttribute('viewBox', v.map(n => n.toFixed(2)).join(' '));
  if (!ms || matchMedia('(prefers-reduced-motion: reduce)').matches) { set(to); if (done) done(); return; }
  const ease = k => k < .5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
  const step = now => { const k = Math.min(1, (now - t0) / ms), e = ease(k); set(from.map((v, i) => v + (to[i] - v) * e)); if (k < 1) RMS.raf = requestAnimationFrame(step); else if (done) done(); };
  RMS.raf = requestAnimationFrame(step);
}
function rmToClient(svg, p) {  // a point in office units → where it is in the window
  const vb = svg.viewBox.baseVal, r = svg.getBoundingClientRect(), s = Math.max(r.width / vb.width, r.height / vb.height);  // xMidYMid slice
  const ox = r.left + (r.width - vb.width * s) / 2, oy = r.top + (r.height - vb.height * s) / 2;
  return [ox + (p[0] - vb.x) * s, oy + (p[1] - vb.y) * s];
}
function rmGuideSvg(id) {  // the desk on standby, standing beside the screen (a desk's own person stands by at its desk)
  const r = rmCfg(id), d = fzD(RMS.st.firm || {}, r.by), col = d.color || '#c3b4ff';
  if (!r.guide) return '';
  const [x, y] = r.guide, c = hqP(x, y);
  return `<ellipse class="rm-gring" cx="${c[0].toFixed(1)}" cy="${c[1].toFixed(1)}" rx="${(0.7 * HQ.AX).toFixed(1)}" ry="${(0.7 * HQ.AY).toFixed(1)}" fill="${col}" fill-opacity=".18" stroke="${col}" stroke-width="1.4"/><g class="rm-gp">${hqPerson(x, y, col, 1, 1, hqLook(r.by))}</g>`;
}
function rmHead(id) {  // where the standby person's head is, in office units
  const r = rmCfg(id);
  if (r.guide) { const h = hqP(r.guide[0], r.guide[1], 1.62); return [h[0], h[1] - 6.4 * HQPS]; }
  return hqHeadOf(r.desk || 'pm');
}
function rmBubble() {  // the standby person's speech bubble (in the window, so it stays one size while the camera moves)
  const el = $('#room'); if (!el || !RMS.id || rmNarrow()) { const b = $('#room .rm-bub'); if (b) b.hidden = true; return; }
  const svg = $('.rm-scene', el), b = $('.rm-bub', el), h = rmHead(RMS.id); if (!svg || !b || !h) return;
  const p = rmToClient(svg, h), stage = $('.rm-stage', el).getBoundingClientRect(), pr = $('.rm-panel', el).getBoundingClientRect();
  b.hidden = false;
  const pl = Math.min(pr.left - stage.left, stage.width - rmPanelW(RMS.id) - 16);  // v7.4: the panel's final place, even while it's still flying in
  const half = b.offsetWidth / 2, x = Math.max(half + 8, Math.min(pl - half - 14, p[0] - stage.left));  // never under the panel
  b.style.left = (x - half) + 'px'; b.style.top = (Math.max(b.offsetHeight + 12, p[1] - stage.top - 14) - b.offsetHeight) + 'px';  // v8: placed by its corner (the pop animation owns its transform)
}
function rmHelp(id) {  // the standby desk: it sees what you see (Mac only: the answers are Claude runs on this Mac)
  if (!api()) return '';
  const r = rmCfg(id), F = RMS.st.firm || {}, d = fzD(F, r.by), nm = HQL[d.id] || d.name, log = RMS.logs[id] || [];
  const rows = log.map(x => x.who === 'boss' ? `<div class="bs-m me"><span class="bs-mw">You</span><p>${esc(x.text)}</p></div>`
    : `<div class="bs-m">${fzAv(d, 28)}<div><span class="bs-mw">${esc(nm)}</span>${x.pending ? '<p class="bs-wait"><i></i><i></i><i></i>looking at it with you (about a minute)</p>' : `<p>${esc(x.text)}</p>${x.suggest ? `<p class="bs-next"><b>Next:</b> ${esc(x.suggest)}</p>` : ''}`}</div></div>`).join('');
  return `<div class="rm-hh">${fzAv(d, 34)}<div><b>${esc(nm)} · on standby</b><span>Sees what’s on this screen. Ask about anything here.</span></div></div>
    ${rows ? `<div class="rm-log" aria-live="polite">${rows}</div>` : ''}
    <form class="rm-ask" autocomplete="off"><textarea rows="1" maxlength="600" aria-label="Ask ${esc(nm)} about what’s on this screen" placeholder="${esc(r.hello)}"></textarea><button type="submit" class="fz-btn"${RMS.busy ? ' disabled' : ''}>Ask</button></form>`;
}
function rmBody(id) {  // what's on the screen: the room's own panel, with everything on it
  return id === 'brain' ? `${hqIh('🧠', 'The firm’s brain', 'what the app does, how it decides and how it checks itself', '#a38cff')}${brainView(RMS.st, { ...(RMS.opt || {}), room: true })}` : hqInsp(RMS.st, RMS.opt, id);
}
function rmPaint(fly) {  // fill the panel for the room that's open, and fly its screen out of the wall
  const el = $('#room'); if (!el) return;
  const id = RMS.id, r = rmCfg(id), panel = $('.rm-panel', el), svg = $('.rm-scene', el);
  $('#rm-t', el).textContent = r.name;
  const by = fzD(RMS.st.firm || {}, r.by), team = ((RMS.st.firm || {}).teams || []).find(t => t.id === by.team);
  $('.rm-sub', el).textContent = r.desk ? `a desk at the firm${team ? ' · ' + team.name : ''}` : `run by the ${HQL[by.id] || by.name} desk`;
  el.querySelectorAll('.rm-nav button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.r === id)));
  el.style.setProperty('--pw', rmPanelW(id) + 'px');
  panel.classList.toggle('wide', !!r.wide);
  $('.rm-screen', el).innerHTML = rmBody(id);
  if (id === 'brain') brainMount($('.rm-screen', el), RMS.st, RMS.opt);
  $('.rm-help', el).innerHTML = rmHelp(id);
  $('.rm-help', el).hidden = !api();
  svg.querySelectorAll('.hq-o').forEach(o => o.classList.toggle('sel', o.dataset.id === id));
  const gd = $('.rm-guide', svg); if (gd) gd.innerHTML = rmGuideSvg(id);
  const d = fzD(RMS.st.firm || {}, r.by), b = $('.rm-bub', el);
  if (b) { b.textContent = rmLive(id) || r.hello; b.style.setProperty('--c', d.color || '#c3b4ff'); }
  panel.scrollTop = 0; $('.rm-screen', el).scrollTop = 0;
  if (fly && !rmNarrow() && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
    const o = rmPts(id), tl = rmToClient(svg, o.tl), tr = rmToClient(svg, o.tr), bl = rmToClient(svg, o.bl), pr = panel.getBoundingClientRect(), w = pr.width, hh = pr.height;
    panel.style.transition = 'none';
    panel.style.transform = `matrix(${((tr[0] - tl[0]) / w).toFixed(4)},${((tr[1] - tl[1]) / w).toFixed(4)},${((bl[0] - tl[0]) / hh).toFixed(4)},${((bl[1] - tl[1]) / hh).toFixed(4)},${(tl[0] - pr.left).toFixed(1)},${(tl[1] - pr.top).toFixed(1)})`;
    panel.style.opacity = '.35'; void panel.offsetWidth;
    panel.style.transition = ''; panel.style.transform = ''; panel.style.opacity = '';
  }
  rmBubble();
}
function rmGo(id, fly = true) {  // fly to another room without leaving
  const el = $('#room'); if (!el || RMS.closing) return;
  RMS.id = id; RMS.busy = false; FZ.sel = id;
  const svg = $('.rm-scene', el), st = svg.getBoundingClientRect(), panel = $('.rm-panel', el);
  panel.classList.add('away'); const b = $('.rm-bub', el); if (b) b.hidden = true;
  el.style.setProperty('--pw', rmPanelW(id) + 'px');
  rmCam(svg, rmFrame(id, st.width, st.height), fly ? 820 : 0, () => { panel.classList.remove('away'); rmPaint(fly); setTimeout(rmBubble, 700); });
}
function roomOpen(st, opt, id, from) {
  if (!id || id === 'now') return;
  if ($('#room')) { rmGo(id); return; }
  fzStyle(); hqStyle(); bossStyle(); rmStyle();
  Object.assign(RMS, { id, st, opt, back: from || document.activeElement, busy: false, closing: false });
  const ph = !!(opt || {}).phone, A = api();
  const nav = Object.keys(RM).map(k => `<button type="button" data-r="${k}" aria-pressed="false" title="${esc(RM[k].name)}" aria-label="${esc(RM[k].name)}"><span aria-hidden="true">${RM[k].ic}</span><b>${esc(RMTAB[k] || RM[k].name)}</b></button>`).join('');
  const tip0 = $('.hq-tip'); if (tip0) tip0.hidden = true;  // v8: the office's tooltip never stays on screen inside the room
  const lights = A ? '<div class="lights"><button class="c" data-act="win" data-w="close" aria-label="Hide" title="Hide the window. SRM Finance keeps running."></button><button class="m" data-act="win" data-w="min" aria-label="Minimize"></button><button class="f" data-act="win" data-w="full" aria-label="Full screen"></button></div>' : '';
  const scene = hqScene(st).replace('<svg class="hq-scene', '<svg class="hq-scene rm-scene" preserveAspectRatio="xMidYMid slice"').replace(/<\/svg>$/, '<g class="rm-guide" aria-hidden="true"></g></svg>');
  const el = document.createElement('div');
  el.id = 'room'; el.className = 'rm' + (ph ? ' ph' : ''); el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true'); el.setAttribute('aria-labelledby', 'rm-t');
  el.innerHTML = `<header class="rm-bar ct-drag"><div class="rm-l ct-drag">${lights}<button class="hq-btn rm-out" data-r="out">‹ Office</button><div class="ct-drag"><b id="rm-t"></b><span class="rm-sub"></span></div></div>
      <nav class="rm-nav" aria-label="Other rooms">${nav}</nav></header>
    <div class="rm-stage">${scene}<div class="rm-bub" hidden></div>
      <section class="rm-panel away" aria-labelledby="rm-t"><div class="rm-screen"></div><div class="rm-help" hidden></div></section></div>`;
  document.body.appendChild(el);
  [...document.body.children].forEach(c => { if (c !== el && !c.matches('.toast, .newnum, .wn-coach')) { c.dataset.rmInert = c.inert ? '1' : ''; c.inert = true; } });
  document.documentElement.classList.add('bs-lock');
  const svg = $('.rm-scene', el), s = svg.getBoundingClientRect();
  svg.setAttribute('viewBox', rmFit(s.width, s.height).map(n => n.toFixed(2)).join(' '));
  rmBind(el);
  requestAnimationFrame(() => rmGo(id));
  setTimeout(() => { const b = $('.rm-out', el); if (b) b.focus({ preventScroll: true }); }, 60);
}
function roomClose(now) {
  const el = $('#room'); if (!el || RMS.closing) return;
  RMS.closing = true; cancelAnimationFrame(RMS.raf);
  if (RMS.guard) document.removeEventListener('keydown', RMS.guard, true);
  window.removeEventListener('resize', rmBubble);
  const done = () => {
    [...document.body.children].forEach(c => { if (c !== el && c.dataset.rmInert !== undefined) { c.inert = c.dataset.rmInert === '1'; delete c.dataset.rmInert; } });
    document.documentElement.classList.remove('bs-lock');
    el.remove(); RMS.closing = false; FZ.sel = 'now';
    const box = $('.hq'); if (box && box._live) box._live();
    if (!now && RMS.back && RMS.back.isConnected) RMS.back.focus({ preventScroll: true });
  };
  if (now || matchMedia('(prefers-reduced-motion: reduce)').matches) { done(); return; }
  const svg = $('.rm-scene', el), s = svg.getBoundingClientRect();
  $('.rm-panel', el).classList.add('away'); const b = $('.rm-bub', el); if (b) b.hidden = true;
  rmCam(svg, rmFit(s.width, s.height), 560, () => { el.classList.add('out'); setTimeout(done, 200); });
}
async function rmAsk() {
  const el = $('#room'), A = api(); if (!el || !A || RMS.busy) return;
  const t = $('.rm-ask textarea', el), q = ((t && t.value) || '').trim(); if (!q) { if (t) t.focus(); return; }
  const id = RMS.id, r = rmCfg(id), log = RMS.logs[id] = RMS.logs[id] || [];
  const screen = ($('.rm-screen', el).innerText || '').replace(/\n{3,}/g, '\n\n').slice(0, 3500);
  const hist = log.filter(x => !x.pending).slice(-6).map(x => ({ who: x.who === 'boss' ? 'the boss' : HQL[r.by] || r.by, text: x.text || '' }));
  log.push({ who: 'boss', text: q }); const row = { who: r.by, pending: true }; log.push(row);
  RMS.busy = true; $('.rm-help', el).innerHTML = rmHelp(id); const lg = $('.rm-log', el); if (lg) lg.scrollTop = lg.scrollHeight;
  let a; try { a = await A.boss_ask(r.by, q, hist, { room: r.name, on_screen: screen }); } catch (e) { a = null; }
  row.pending = false; row.text = (a && a.answer) || 'Sorry, boss: I couldn’t answer just now. Try me again in a minute.'; row.suggest = a && !a.error ? a.suggest : '';
  RMS.busy = false;
  if ($('#room') && RMS.id === id) { $('.rm-help', el).innerHTML = rmHelp(id); const l2 = $('.rm-log', el); if (l2) l2.scrollTop = l2.scrollHeight; const t2 = $('.rm-ask textarea', el); if (t2) t2.focus({ preventScroll: true }); }
}
function rmAct(el, e) {  // a click inside the room: the same buttons as the office's panels
  const k = el.dataset.fact, id = el.dataset.id, st = RMS.st, opt = RMS.opt;
  if (k === 'sel') { if (id === 'now' || id === RMS.id) roomClose(); else rmGo(id); }
  else if (k === 'desk') rmGo(id ? 'desk:' + id : 'board');
  else if (k === 'pred') { FZ.openK.add('r' + id); if (RMS.id === 'predictions') rmPaint(false); else rmGo('predictions'); }
  else if (k === 'filter') { FZ.filter = el.dataset.v; rmPaint(false); }
  else if (k === 'morefeed') { FZ.more = !FZ.more; rmPaint(false); }
  else if (k === 'mk') { FZ.mk = !FZ.mk; rmPaint(false); }
  else if (k === 'link' && api()) api().open_link(el.dataset.u);
  else if (k === 'drop' && api()) { el.disabled = true; api().boss_drop(el.dataset.at).then(r => { if (r && r.ok) { st.firm.boss = { ...(st.firm.boss || {}), orders: r.orders || [] }; rmPaint(false); } else el.disabled = false; }); }
  else if ((k === 'call' || k === 'join') && api()) { const b = RMS.back; roomClose(true); if (k === 'call') bossChoose(st, opt, b); else bossOpen(st, opt, b); }
}
function rmBind(el) {
  el.addEventListener('click', e => {
    const act = e.target.closest('[data-act]');
    if (act && act.dataset.act !== 'win') { roomClose(true); return; }  // a stock, a tab...: leave the room so it shows
    const f = e.target.closest('[data-fact]'); if (f && !f.disabled) { e.preventDefault(); rmAct(f, e); return; }
    const r = e.target.closest('[data-r]'); if (r) { if (r.dataset.r === 'out') roomClose(); else if (r.dataset.r !== RMS.id) rmGo(r.dataset.r); }
  });
  el.addEventListener('submit', e => { e.preventDefault(); rmAsk(); });
  el.addEventListener('toggle', e => { const d = e.target; if (d && d.matches && d.matches('details[data-k]')) { if (d.open) FZ.openK.add(d.dataset.k); else FZ.openK.delete(d.dataset.k); } }, true);
  el.addEventListener('keydown', e => {
    if (e.key === 'Escape') { e.preventDefault(); roomClose(); }
    else if (e.key === 'Enter' && e.target.matches('.rm-ask textarea') && !e.shiftKey && !e.isComposing) { e.preventDefault(); rmAsk(); }
    else if ((e.key === 'Enter' || e.key === ' ') && e.target.matches && e.target.matches('.rm-scene [role=button]')) { e.preventDefault(); e.target.dispatchEvent(new MouseEvent('click', { bubbles: true })); }
    else if (e.key === 'Tab') {
      const fs = [...el.querySelectorAll('button:not([disabled]), select, textarea, summary, a[href], [tabindex="0"]')].filter(x => x.getClientRects().length);
      if (fs.length && e.shiftKey && document.activeElement === fs[0]) { e.preventDefault(); fs[fs.length - 1].focus(); }
      else if (fs.length && !e.shiftKey && document.activeElement === fs[fs.length - 1]) { e.preventDefault(); fs[0].focus(); }
    }
    e.stopPropagation();
  });
  const stage = $('.rm-stage', el), tip = document.createElement('div');
  tip.className = 'hq-tip'; tip.setAttribute('role', 'tooltip'); tip.hidden = true; stage.appendChild(tip);
  stage.addEventListener('mousemove', e => {
    const o = e.target.closest && e.target.closest('.rm-scene .hq-o'); if (!o) { tip.hidden = true; return; }
    const r = stage.getBoundingClientRect(); tip.textContent = o.dataset.tip || o.getAttribute('aria-label'); tip.hidden = false;
    tip.style.left = Math.max(4, Math.min(r.width - tip.offsetWidth - 4, e.clientX - r.left + 14)) + 'px'; tip.style.top = (e.clientY - r.top + 18) + 'px';
  });
  stage.addEventListener('mouseleave', () => { tip.hidden = true; });
  window.addEventListener('resize', rmBubble);
  RMS.guard = e => { const b = $('#room'); if (!b || b.contains(e.target) || (e.target.closest && e.target.closest('.wn-coach'))) return; e.stopPropagation(); e.preventDefault(); if (e.key === 'Escape') roomClose(); else { const f = $('.rm-out', b); if (f) f.focus(); } };
  document.addEventListener('keydown', RMS.guard, true);
}
function rmStyle() {
  if (document.getElementById('rm-css')) return;
  const css = `
.rm{--g:#3ff2a3;--r:#ff5f6e;--ink:#eef0f6;--ink2:#c5cad6;--dim:#8d93a3;--line:rgba(255,255,255,.08);position:fixed;inset:0;z-index:190;display:flex;flex-direction:column;background:#05060a;color:var(--ink);animation:bsIn .45s cubic-bezier(.2,.8,.2,1) both}
.rm.out{animation:bsOut .2s ease both}
.rm-bar{flex:none;position:relative;z-index:3;display:flex;align-items:center;justify-content:space-between;gap:14px;min-height:60px;padding:0 18px;border-bottom:1px solid rgba(255,255,255,.08);background:rgba(8,10,15,.72);-webkit-backdrop-filter:blur(12px);backdrop-filter:blur(12px)}
.rm-bar:hover .lights .c{background:#ff5f57}.rm-bar:hover .lights .m{background:#febc2e}.rm-bar:hover .lights .f{background:#28c840}
.rm-l{display:flex;align-items:center;gap:12px;min-width:0}.rm-l>div:not(.lights){display:flex;flex-direction:column;gap:1px;min-width:0}
.rm-l b{font-size:15px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.rm-sub{font-size:12px;color:var(--dim)}
.rm-out{flex:none;margin:0}
.rm-nav{display:flex;gap:4px;flex-wrap:nowrap;overflow-x:auto}
.rm-nav button{flex:none;display:flex;align-items:center;gap:6px;min-width:36px;height:34px;padding:0 8px;border-radius:10px;border:1px solid transparent;background:transparent;color:var(--ink2);font:inherit;font-size:17px;cursor:pointer;transition:background .2s,border-color .2s}
.rm-nav button b{display:none;font-size:12px;font-weight:600;white-space:nowrap}@media (min-width:1240px){.rm-nav button b{display:inline}}.rm-nav button[aria-pressed=true] b{color:#fff}
.rm-nav button:hover{background:rgba(255,255,255,.06)}.rm-nav button[aria-pressed=true]{border-color:rgba(86,203,255,.55);background:rgba(86,203,255,.1)}
.rm-stage{position:relative;flex:1;min-height:0;overflow:hidden;background:radial-gradient(110% 80% at 40% 30%,#141a2c,#05060a 72%)}
.rm-scene{position:absolute;inset:0;width:100%!important;height:100%!important;max-width:none!important}
.rm-gp{animation:rmBob 2.6s ease-in-out infinite}@keyframes rmBob{50%{transform:translateY(-2px)}}
.rm-bub{position:absolute;z-index:2;transform:none!important;max-width:260px;padding:8px 13px;border-radius:15px;border:1.5px solid var(--c);background:#0d111b;color:#fff;font-size:14px;font-weight:600;line-height:1.35;pointer-events:none;box-shadow:0 10px 30px -10px #000;animation:bsPop .35s .2s both}
.rm-bub::after{content:"";position:absolute;left:50%;bottom:-7px;width:12px;height:12px;margin-left:-6px;background:#0d111b;border-right:1.5px solid var(--c);border-bottom:1.5px solid var(--c);transform:rotate(45deg)}
.rm-panel{position:absolute;z-index:2;top:16px;right:16px;max-height:calc(100% - 32px);width:var(--pw,560px);display:flex;flex-direction:column;border-radius:20px;border:1px solid rgba(255,255,255,.12);background:linear-gradient(180deg,rgba(14,18,30,.94),rgba(8,10,16,.96));box-shadow:0 30px 80px -30px #000,0 0 0 1px rgba(86,203,255,.08) inset;transform-origin:0 0;transition:transform .6s cubic-bezier(.2,.8,.2,1),opacity .45s ease;overflow:hidden}
.rm-panel::before{content:"";flex:none;height:4px;background:linear-gradient(90deg,#56cbff,#a38cff,#3ff2a3)}
.rm-panel.away{opacity:0;pointer-events:none;transition:opacity .2s ease}
.rm-screen{flex:1;min-height:0;overflow:auto;padding:16px 20px}
.rm-screen .hq-ih{margin-bottom:14px}.rm-screen .hq-ih b{font-size:18px}
.rm-help{flex:none;display:flex;flex-direction:column;gap:9px;padding:12px 18px 14px;border-top:1px solid var(--line);background:rgba(255,255,255,.02)}
.rm-help[hidden]{display:none}
.rm-hh{display:flex;align-items:center;gap:10px}.rm-hh>div{display:flex;flex-direction:column;gap:1px;min-width:0}.rm-hh b{font-size:13.5px}.rm-hh span{font-size:12px;color:var(--dim)}
.rm-log{max-height:190px;overflow:auto;display:flex;flex-direction:column;gap:10px}
.rm-ask{display:flex;gap:8px;align-items:flex-end}.rm-ask textarea{flex:1;min-height:40px;max-height:120px;resize:vertical;padding:9px 12px;border-radius:12px;border:1px solid rgba(255,255,255,.18);background:#0f131c;color:var(--ink);font:inherit;font-size:14px;line-height:1.4}
.rm-ask textarea::placeholder{color:#8a91a1}.rm-ask .fz-btn{flex:none;width:auto;min-height:40px}
.rm .hq-tip{z-index:4}
.rm-scene .hq-lb,.tr-scene .hq-lb{display:none}  /* the office's name labels would be huge up close */
.rm-screen .bz-labwrap,.rm-screen .fz-recw{grid-template-columns:1fr}.rm-screen .fz-calib{max-width:360px}  /* charts keep their labels at full size in the room's panel */
@media (max-width:899px){.rm-bar{padding:0 12px;gap:8px}.rm-nav{display:none}.rm-stage{display:flex;flex-direction:column;overflow:auto}.rm-scene{position:relative!important;inset:auto;flex:none;height:42vh!important;min-height:220px}
  .rm-panel{position:relative;inset:auto;top:auto;right:auto;bottom:auto;width:auto;max-height:none;flex:none;overflow:visible;margin:0 10px 14px;border-radius:18px;transition:opacity .3s ease}.rm-screen{flex:none;overflow:visible}.rm-bub{display:none}
  .rm-help{position:sticky;bottom:0;z-index:3;background:#0c1019;border-radius:0 0 18px 18px;box-shadow:0 -14px 24px -14px rgba(0,0,0,.7)}}  /* a long screen scrolls under the desk's Ask bar, which stays in reach */
.rm.ph .rm-panel{margin-bottom:calc(14px + env(safe-area-inset-bottom))}.rm.ph .rm-help{padding-bottom:calc(14px + env(safe-area-inset-bottom))}
@media (prefers-reduced-motion:reduce){.rm,.rm *{animation:none!important;transition:none!important}}
`;
  const el = document.createElement('style'); el.id = 'rm-css'; el.textContent = css; document.head.appendChild(el);
}

/* ---------------- v7: the guided tour ----------------
   Sam: "make sure the tutorial is straightforward, easy to understand, but also impresses him by going to things like
   for example here are all of the bots that do this and have their desks". On a copy that isn't set up (his dad's, after
   the update) it opens by itself: his name first, then the camera visits each team at their desks with one short caption,
   then his stocks and his Claude account, then "you're set". Settings → Take the tour replays just the tour. */
const TR = { i: 0, steps: [], st: null, opt: null, mode: 'tour', back: null, guard: null, busy: false };
const TRTEAM = { macro: ['washington', 'fed', 'forecast'], geo: ['mideast', 'asia', 'world'], sector: ['energy', 'chips', 'software', 'health', 'finance', 'industry', 'consumer'],
  special: ['earnings', 'quant', 'research'], check: ['risk', 'redteam', 'score', 'watch'] };
function trCarpet(id) { const c = HQR.find(r => r[0] === id); return { box: [c[1], c[2], c[3] - c[1], c[4] - c[2], 1.9] }; }
function tourSteps(mode) {
  const S = [];
  if (mode === 'setup') S.push({ k: 'name' });
  S.push(
    { k: 'hi', title: n => `Meet your firm${n ? ', ' + n : ''}`, text: 'These are 22 AI specialists, each with its own job, watching the markets and your stocks around the clock. Every person in this office works for you.' },
    { k: 'pm', cam: { box: [8.0, 0.3, 6.6, 3.25, 2.4] }, rooms: ['pm'], desks: ['pm', 'ops'], title: () => 'Your portfolio manager', text: 'Reads everything the desks write, settles their arguments and decides what to do with your money. Every weekday after the 9:45 AM check he writes your briefing with the orders. At his door, the Operations desk keeps that list true between briefings: a stop that sells, a fill, a Schwab sync or an order you give the firm changes it within minutes. Nothing happens until you say OK.' },
    { k: 'macro', cam: trCarpet('macro'), desks: TRTEAM.macro, title: () => 'Macro & politics', text: 'Washington, the Fed and the economy. A forecaster puts dated odds on what comes next, like “Will the Fed cut rates in December?”' },
    { k: 'geo', cam: trCarpet('geo'), desks: TRTEAM.geo, title: () => 'Geopolitics', text: 'Wars and oil, China and Asia, Europe and the rest of the world: the news that moves markets while you sleep.' },
    { k: 'sector', cam: trCarpet('sector'), desks: TRTEAM.sector, title: () => 'Seven sector desks', text: 'Energy, chips & AI, software, healthcare, financials, industrials and consumer. Each one knows its industry and watches the stocks you own in it.' },
    { k: 'special', cam: trCarpet('special'), desks: TRTEAM.special, title: () => 'Specialists', text: 'An earnings desk that tracks every report, a quant who tests strategies on 9 years of prices, and a research desk that digs deep into single stocks.' },
    { k: 'check', cam: trCarpet('check'), desks: TRTEAM.check, title: () => 'Checks and balances', text: 'A risk desk and a red team argue against every big idea before it reaches you. A scorekeeper grades every prediction, and a news watch reads the news every 30 minutes and calls an emergency meeting when something big happens.' },
    { k: 'meeting', cam: RM.meeting, rooms: ['meeting'], title: () => 'Meetings all day', text: 'They meet from 6:30 in the morning to 8:30 at night, and on weekends. Call a meeting anytime and join as the boss: they stand when you walk in, brief you and answer anything you ask.' },
    { k: 'walls', rooms: ['markets', 'predictions', 'record'], title: () => 'They keep score', text: 'Their odds are checked against the betting markets, every prediction is graded in the trophy case, and each desk learns from its own record.' },
    { k: 'zoom', title: () => 'Click anything to zoom in', text: 'Every screen, desk and room opens up, and whoever runs it stands by to answer questions about what you’re looking at.' });
  if (mode === 'setup') S.push({ k: 'stocks', cam: RM.pm, rooms: ['pm'] }, { k: 'claude', cam: RM.brain, rooms: ['brain'] }, { k: 'done' });
  else S.push({ k: 'end', title: () => 'That’s your firm', text: 'It never trades or moves money on its own: every order waits for your OK.' });
  return S;
}
function trFrame(cam, W, H) {  // a step's camera: the team or room big, up and to the right of the caption card
  if (!cam) return rmFit(W, H);
  const r = cam, base = Math.min(W / HQ.W, H / HQ.H);
  const pts = r.wall === 'A' ? hqWA(r.a, r.b, r.z1, r.z2) : r.wall === 'B' ? hqWB(r.a, r.b, r.z1, r.z2) : hqHull(r.box[0], r.box[1], 0, r.box[2], r.box[3], r.box[4]);
  const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]), bx = Math.min(...xs), by = Math.min(...ys), bw = Math.max(...xs) - bx, bh = Math.max(...ys) - by;
  const narrow = rmNarrow(), s = Math.max(base, Math.min(W * (narrow ? 0.8 : 0.58) / bw, H * (narrow ? 0.62 : 0.56) / bh, 2.7 * base));
  const fx = narrow ? 0.5 : 0.6, fy = narrow ? 0.36 : 0.4;
  return [bx + bw / 2 - W * fx / s, by + bh / 2 - H * fy / s, W / s, H / s];
}
function trName() { const n = (TR.st.setup || {}).owner || ''; return n && n !== 'the boss' ? n : ''; }
function trCard() {
  const s = TR.steps[TR.i], F = TR.st.firm || {}, n = TR.steps.length, A = api(), su = SU.s || {};
  const dots = `<div class="tr-dots" aria-hidden="true">${TR.steps.map((_, i) => `<i${i === TR.i ? ' class="on"' : i < TR.i ? ' class="was"' : ''}></i>`).join('')}</div>`;
  const nav = (next, back = true) => `<div class="tr-nav">${back && TR.i ? '<button class="hq-btn" data-t="back">‹ Back</button>' : '<span></span>'}${next}</div>`;
  const avs = (s.desks || []).filter(id => id !== 'pm' || s.k === 'pm').map(id => { const d = fzD(F, id); return `<span class="tr-av">${fzAv(d, 30)}<b>${esc(HQL[id] || d.name)}</b></span>`; }).join('');
  if (s.k === 'name') return `${dots}<p class="eyebrow">Welcome</p><h2 id="tr-h">Welcome to your firm</h2>
    <p class="tr-p">${esc(APP)}, made by ${esc(MAKER)}, is a team of AI specialists that watches the markets and your stocks for you, and tells you exactly what to do. First, what should they call you?</p>
    <div class="su-row"><input id="tr-name" aria-label="Your first name" placeholder="Your first name" maxlength="40" autocomplete="given-name" value="${esc(trName())}"></div>
    ${nav('<button class="btn go" data-t="name">Meet your firm ›</button>', false)}`;
  if (s.k === 'stocks') {
    const st = su.stocks || {};
    const have = st.count ? `Found <b>${st.count} stock${st.count === 1 ? '' : 's'}</b> and <b>${money(st.cash)}</b> cash${st.synced ? ', synced from ' + esc(BN()) : ''}.` : 'No stocks in this copy yet.';
    return `${dots}<p class="eyebrow">Step 1 of 2 · your stocks</p><h2 id="tr-h">Bring in your stocks</h2>
      <p class="tr-p"><b>Where do you trade?</b> Every order comes with step-by-step directions for your broker.</p>${brokerPick('data-t="broker"')}
      <p class="tr-p">${have} Best: link ${BA()} through Yahoo Finance, so your holdings and cash stay up to date by themselves. If Yahoo can’t link yours, type your stocks in instead.</p>
      <ol class="su-ol"><li>In Yahoo Finance on the web, open <b>My Portfolio</b> and link ${BA()}. <button class="link" data-t="yweb">Open Yahoo Finance</button></li>
        <li>Press <b>Connect Yahoo</b> and sign in with your Yahoo email (“Continue with email”). Your password stays on your Mac.</li></ol>
      <div class="su-row">${A ? (st.synced ? '<button class="btn" data-t="ysync">Sync now</button>' : '<button class="btn go" data-t="yon">Connect Yahoo</button>') + '<button class="btn quiet" data-t="hand">Type them in instead</button>' : ''}</div>
      ${nav('<button class="btn' + (st.count || st.synced ? ' go' : '') + '" data-t="next">' + (st.count || st.synced ? 'Next ›' : 'Do it later ›') + '</button>')}`;
  }
  if (s.k === 'claude') {
    const cl = su.claude || {};
    return `${dots}<p class="eyebrow">Step 2 of 2 · your Claude</p><h2 id="tr-h">Link your Claude</h2>
      <p class="tr-p">Every person in this office is Claude, the AI, running on this Mac with your own Claude account. Your Pro plan works.</p>
      <p class="tr-p su-now" aria-live="polite">${setupClaudeLine(cl)}</p>
      ${!cl.found ? '<ol class="su-ol"><li>Get the Claude app for Mac and sign in with your Claude account. <button class="link" data-t="cdl">Get the Claude app</button></li><li>In the Claude app, open the <b>Code</b> tab once.</li><li>Come back and press <b>Check again</b>.</li></ol>'
        : !cl.ok && !SU.busy ? '<ol class="su-ol"><li>Press <b>Sign in to Claude</b>: a Terminal window opens, and your browser shows Claude’s sign-in page.</li><li>Sign in with your own Claude account (the one with your subscription) and allow it.</li><li>When the Terminal window says <b>Signed in</b>, close it and press <b>Check again</b>.</li></ol>' : ''}
      <div class="su-row">${cl.found && !cl.ok ? `<button class="btn go" data-t="csign"${SU.busy ? ' disabled' : ''}>Sign in to Claude</button>` : ''}<button class="btn${cl.ok ? ' quiet' : ''}" data-t="ctest"${SU.busy ? ' disabled' : ''}>Check again</button></div>
      ${nav('<button class="btn' + (cl.ok ? ' go' : '') + '" data-t="next">' + (cl.ok ? 'Next ›' : 'Do it later ›') + '</button>')}`;
  }
  if (s.k === 'done') return `${dots}<p class="eyebrow">All set</p><h2 id="tr-h">You’re set${trName() ? ', ' + esc(trName()) : ''}</h2>
    <p class="tr-p">Your firm takes it from here. Every weekday after the 9:45 AM check, your portfolio manager writes your briefing on the Today tab. Every order waits for your OK and comes with step-by-step directions. You place it at ${esc(BN())} yourself.</p>
    <p class="tr-fine">Anything you skipped is in Settings → Setup guide.</p>${nav('<button class="btn go" data-t="finish">Go to the office ›</button>')}`;
  const last = TR.i === n - 1;
  return `${dots}<p class="eyebrow">${s.k === 'hi' ? 'Your team' : s.k === 'end' || s.k === 'zoom' ? 'The office' : 'Your team · ' + (s.desks ? s.desks.length + (s.desks.length === 1 ? ' person' : ' desks') : 'the room')}</p>
    <h2 id="tr-h">${esc(s.title(trName()))}</h2><p class="tr-p">${esc(s.text)}</p>${avs ? `<div class="tr-avs">${avs}</div>` : ''}
    ${nav(last ? '<button class="btn go" data-t="finish">Close ›</button>' : `<button class="btn go" data-t="next">${TR.i === 0 || (TR.i === 1 && TR.steps[0].k === 'name') ? 'Show me ›' : 'Next ›'}</button>`)}`;
}
function trShow(fly = true) {
  const el = $('#tour'); if (!el) return;
  const s = TR.steps[TR.i], svg = $('.tr-scene', el), r = svg.getBoundingClientRect(), card = $('.tr-card', el);
  const hi = new Set((s.desks || []).map(d => 'desk:' + d).concat(s.rooms || []).concat((s.desks || []).includes('pm') ? ['pm'] : []));
  svg.classList.toggle('dim', hi.size > 0);
  svg.querySelectorAll('.hq-o').forEach(o => o.classList.toggle('tour-on', hi.has(o.dataset.id)));
  card.classList.add('swap');
  setTimeout(() => {
    card.innerHTML = trCard(); card.classList.remove('swap');
    const f = $('#tr-name', card) || $('[data-t=next], [data-t=name], [data-t=finish]', card); if (f) f.focus({ preventScroll: true });
  }, fly ? 180 : 0);
  rmCam(svg, trFrame(s.cam, r.width, r.height), fly ? 1000 : 0);
  try { sessionStorage.setItem('ct-tour-step', String(TR.i)); } catch (e) { /* private mode */ }
}
async function trSetupData() { const A = api(); if (!A) return; try { const s = await A.setup_status(); if (s) { SU.s = s; if (TR.st.setup) TR.st.setup.owner = s.owner || TR.st.setup.owner; } } catch (e) { /* the steps still show */ } }
function tourOpen(st, opt, mode = 'tour', from, at = 0) {
  if ($('#call') || $('#tour') || $('#room') || $('#boss')) return;
  fzStyle(); hqStyle(); bossStyle(); rmStyle(); trStyle();
  Object.assign(TR, { st, opt, mode, steps: tourSteps(mode), i: Math.min(at, 99), back: from || document.activeElement, busy: false });
  TR.i = Math.min(TR.i, TR.steps.length - 1);
  if (mode === 'setup') { try { sessionStorage.setItem('ct-setup-open', '1'); sessionStorage.setItem('ct-setup-seen', '1'); } catch (e) { /* private mode */ } }
  const A = api();
  const lights = A ? '<div class="lights"><button class="c" data-act="win" data-w="close" aria-label="Hide" title="Hide the window. SRM Finance keeps running."></button><button class="m" data-act="win" data-w="min" aria-label="Minimize"></button><button class="f" data-act="win" data-w="full" aria-label="Full screen"></button></div>' : '';
  const scene = hqScene(st).replace('<svg class="hq-scene', '<svg class="hq-scene tr-scene" preserveAspectRatio="xMidYMid slice"');
  const el = document.createElement('div');
  el.id = 'tour'; el.className = 'rm tr'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true'); el.setAttribute('aria-labelledby', 'tr-h');
  el.innerHTML = `<header class="rm-bar ct-drag"><div class="rm-l ct-drag">${lights}<div class="ct-drag"><b>${mode === 'setup' ? 'Set up your copy' : 'Tour of the firm'}</b><span class="rm-sub">${mode === 'setup' ? 'about 5 minutes' : 'about 2 minutes'}</span></div></div>
      <button class="hq-btn" data-t="skip">${mode === 'setup' ? 'Later' : 'Close'}</button></header>
    <div class="rm-stage tr-stage">${scene}<section class="tr-card" aria-live="polite"></section></div>`;
  document.body.appendChild(el);
  [...document.body.children].forEach(c => { if (c !== el && !c.matches('.toast, .newnum, .wn-coach')) { c.dataset.rmInert = c.inert ? '1' : ''; c.inert = true; } });
  document.documentElement.classList.add('bs-lock');
  const svg = $('.tr-scene', el), r = svg.getBoundingClientRect();
  svg.setAttribute('viewBox', rmFit(r.width, r.height).map(n => n.toFixed(2)).join(' '));
  trBind(el);
  if (mode === 'setup') trSetupData().then(() => trShow(false)); else trShow(false);
}
function tourClose() {
  const el = $('#tour'); if (!el) return;
  cancelAnimationFrame(RMS.raf);
  if (TR.guard) document.removeEventListener('keydown', TR.guard, true);
  try { sessionStorage.removeItem('ct-tour-step'); if (TR.mode === 'setup') sessionStorage.removeItem('ct-setup-open'); } catch (e) { /* private mode */ }
  [...document.body.children].forEach(c => { if (c !== el && c.dataset.rmInert !== undefined) { c.inert = c.dataset.rmInert === '1'; delete c.dataset.rmInert; } });
  document.documentElement.classList.remove('bs-lock');
  el.classList.add('out'); setTimeout(() => el.remove(), 200);
  if (TR.back && TR.back.isConnected) TR.back.focus({ preventScroll: true });
}
async function trAct(k, b) {
  const A = api(), s = TR.steps[TR.i];
  if (k === 'next') { if (TR.i < TR.steps.length - 1) { TR.i++; trShow(); } }
  else if (k === 'back') { if (TR.i > 0) { TR.i--; trShow(); } }
  else if (k === 'skip') tourClose();
  else if (k === 'name') {
    const box = $('#tr-name'), v = box ? box.value.trim() : '';
    if (!v) { if (box) box.focus(); return; }
    if (A) { b.disabled = true; try { await A.setup_name(v); } catch (e) { /* kept for this visit */ } }
    TR.st.setup = { ...(TR.st.setup || {}), owner: v }; if (SU.s) SU.s.owner = v;
    TR.i++; trShow();
  }
  else if (k === 'broker') { brokerSet(b.dataset.b); $('.tr-card').innerHTML = trCard(); }
  else if (k === 'yweb' && A) A.open_link('https://finance.yahoo.com/portfolios');
  else if (k === 'yon' && A) { b.disabled = true; const r = await A.yahoo_connect(); if (r && r.error) { toast(r.error); b.disabled = false; } else toast('Sign in to Yahoo in the window that opened. The tour comes back when you’re done.', 7000); }
  else if (k === 'ysync' && A) { b.disabled = true; const r = await A.yahoo_sync_now(); if (r && r.error) { toast(r.error); b.disabled = false; } else regrade(`Synced with ${BN()}.`); }
  else if (k === 'hand') { tourClose(); try { sessionStorage.setItem('ct-setup-open', '1'); sessionStorage.setItem('ct-tour-step', String(TR.i)); } catch (e) { /* private mode */ } openSettings(); setTimeout(() => { const t = $('#htable'); if (t) t.scrollIntoView({ block: 'center' }); }, 80); }
  else if (k === 'cdl' && A) A.open_link('https://claude.ai/download');
  else if (k === 'csign' && A) { const r = await A.claude_signin(); toast(r && r.ok ? 'A Terminal window opened, and your browser shows Claude’s sign-in page. Sign in there, then come back and press Check again.' : (r && r.error) || 'Couldn’t open Terminal.', 9000); }
  else if (k === 'ctest' && A && !SU.busy) {
    SU.busy = true; $('.tr-card').innerHTML = trCard();
    let r; try { r = await A.claude_test(); } catch (e) { r = { found: true, ok: false, why: 'other', error: String(e) }; }
    SU.busy = false; SU.s = SU.s || {}; SU.s.claude = { ...(SU.s.claude || {}), ...(r || {}) };
    if ($('#tour') && TR.steps[TR.i].k === 'claude') $('.tr-card').innerHTML = trCard();
  }
  else if (k === 'finish') {
    if (TR.mode === 'setup' && A) { b.disabled = true; try { await A.setup_finish(); } catch (e) { /* asks again next time */ } if (TR.st.setup) TR.st.setup.needed = false; }
    tourClose(); if (TR.mode === 'setup') { ui.view = 'firm'; draw(); toast(`Welcome to the firm${trName() ? ', ' + trName() : ''}.`, 5000); }
  }
  void s;
}
function trBind(el) {
  el.addEventListener('click', e => { const b = e.target.closest('[data-t]'); if (b && !b.disabled) trAct(b.dataset.t, b); });
  el.addEventListener('keydown', e => {
    if (e.key === 'Escape') { e.preventDefault(); tourClose(); }
    else if (e.key === 'Enter' && e.target.id === 'tr-name') { e.preventDefault(); trAct('name', $('[data-t=name]', el)); }
    else if ((e.key === 'ArrowRight' || e.key === 'ArrowLeft') && !e.target.matches('input, textarea')) { const b = $(e.key === 'ArrowRight' ? '[data-t=next]' : '[data-t=back]', el); if (b) { e.preventDefault(); b.click(); } }
    else if (e.key === 'Tab') {
      const fs = [...el.querySelectorAll('button:not([disabled]), input, a[href]')].filter(x => x.getClientRects().length);
      if (fs.length && e.shiftKey && document.activeElement === fs[0]) { e.preventDefault(); fs[fs.length - 1].focus(); }
      else if (fs.length && !e.shiftKey && document.activeElement === fs[fs.length - 1]) { e.preventDefault(); fs[0].focus(); }
    }
    e.stopPropagation();
  });
  TR.guard = e => { const t = $('#tour'); if (!t || t.contains(e.target)) return; e.stopPropagation(); e.preventDefault(); if (e.key === 'Escape') tourClose(); else { const f = $('.tr-card button', t); if (f) f.focus(); } };
  document.addEventListener('keydown', TR.guard, true);
}
function trStyle() {
  if (document.getElementById('tr-css')) return;
  const css = `
.tr-scene{pointer-events:none}
.tr-scene.dim .hq-o:not(.tour-on){opacity:.42;transition:opacity .5s}
.tr-scene .hq-o.tour-on .hq-hit{stroke:var(--sc,#56cbff);stroke-opacity:.9;stroke-width:2.2;fill:rgba(255,255,255,.05)}
.tr-scene .hq-o.tour-on .hq-desk{animation:trWave 1.6s ease-in-out infinite}
@keyframes trWave{0%,100%{transform:none}25%{transform:translateY(-5px)}50%{transform:none}}
.tr-card{position:absolute;z-index:2;left:22px;bottom:22px;width:min(470px,calc(100% - 44px));max-height:calc(100% - 44px);overflow:auto;padding:20px 22px;border-radius:22px;border:1px solid rgba(255,255,255,.13);background:linear-gradient(180deg,rgba(15,19,31,.95),rgba(8,10,16,.97));box-shadow:0 30px 80px -26px #000;transition:opacity .18s ease,transform .18s ease}
.tr-card.swap{opacity:0;transform:translateY(6px)}
.tr-card h2{margin:4px 0 8px;font-size:23px;line-height:1.2;letter-spacing:-.015em}
.tr-card .eyebrow{margin:10px 0 0}
.tr-p{margin:0 0 10px;font-size:15px;line-height:1.55;color:var(--ink2)}.tr-p b{color:#fff}
.tr-fine{margin:0 0 6px;font-size:12.5px;color:var(--dim)}
.tr-dots{display:flex;gap:5px;flex-wrap:wrap}.tr-dots i{width:16px;height:4px;border-radius:2px;background:rgba(255,255,255,.14)}.tr-dots i.was{background:rgba(86,203,255,.5)}.tr-dots i.on{background:#56cbff;width:26px}
.tr-avs{display:flex;flex-wrap:wrap;gap:8px 12px;margin:4px 0 12px}
.tr-av{display:inline-flex;align-items:center;gap:7px;font-size:12.5px;color:var(--ink2)}.tr-av b{font-weight:600}
.tr-nav{display:flex;justify-content:space-between;align-items:center;gap:10px;margin-top:14px}.tr-nav .hq-btn{margin:0}
.tr-card .su-row input{flex:1;min-width:160px;min-height:42px;padding:8px 13px;border-radius:11px;border:1px solid rgba(255,255,255,.2);background:rgba(255,255,255,.05);color:var(--ink);font:inherit;font-size:16px}
.tr-card .su-ol li{font-size:14px}
@media (max-width:899px){.tr-stage{display:block;overflow:hidden}.tr-scene{position:absolute!important;inset:0;height:100%!important}.tr-card{left:10px;right:10px;bottom:10px;width:auto;max-height:58%}}
`;
  const el = document.createElement('style'); el.id = 'tr-css'; el.textContent = css; document.head.appendChild(el);
}

function hqStyle() {
  if (document.getElementById('hq-css')) return;
  const css = `
.hq-gist{padding:14px 18px;border-radius:18px;border:1px solid rgba(255,211,110,.26);border-left:3px solid #ffd36e;background:linear-gradient(100deg,rgba(255,211,110,.085),rgba(255,255,255,.02))}
.hq-gh{display:flex;align-items:baseline;flex-wrap:wrap;gap:4px 10px;margin-bottom:6px}.hq-gh b{font:700 11.5px ui-monospace,Menlo,monospace;letter-spacing:.12em;text-transform:uppercase;color:#ffd36e}.hq-gh span{font-size:12px;color:var(--dim)}
.hq-gs{margin:0;font-size:15.5px;line-height:1.62;font-weight:550;color:#fff}
.hq-gs mark{color:inherit;padding:1px 3px;border-radius:3px;background:linear-gradient(transparent 6%,rgba(255,211,110,.27) 6%,rgba(255,211,110,.27) 95%,transparent 95%);-webkit-box-decoration-break:clone;box-decoration-break:clone}
.hq-gw{margin:8px 0 0;font-size:13px;line-height:1.45;color:var(--ink2)}
.hq-gc{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px 22px;margin-top:12px}.hq-gc h5{margin:0 0 6px;font:600 11px ui-monospace,Menlo,monospace;letter-spacing:.1em;text-transform:uppercase;color:var(--dim)}
.hq-gc ul{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:6px}.hq-gc li{display:flex;gap:8px;font-size:13px;line-height:1.45;color:var(--ink2)}.hq-gc li span{flex:none;width:18px;text-align:center}
@media (max-width:900px){.hq-gc{grid-template-columns:1fr}}.hq.ph .hq-gc{grid-template-columns:1fr}
.b2-firmmini .hq-gist{padding:12px 14px;margin-top:4px}.b2-firmmini .hq-gs{font-size:14px}
.hq{gap:14px}.hq-top{display:flex;align-items:center;justify-content:space-between;gap:10px 18px;flex-wrap:wrap}.hq-top h2{margin:0}
.hq-status{margin:5px 0 0;display:flex;align-items:center;gap:9px;font-size:13.5px;color:var(--ink2)}
.hq-status i{flex:none;width:9px;height:9px;border-radius:50%;background:#56cbff;box-shadow:0 0 10px rgba(86,203,255,.5)}.hq-status i.on{background:#3ff2a3;animation:fzPing 1.8s infinite}.hq-status i.warn{background:#ffc65a}
.hq-stage{display:grid;grid-template-columns:minmax(0,1fr);gap:14px;align-items:start}
.hq-left{position:relative;display:flex;flex-direction:column;gap:10px;min-width:0}
.hq-scroll{border-radius:22px;border:1px solid rgba(255,255,255,.08);background:radial-gradient(110% 80% at 48% 28%,#141a2c,#07080d 72%);overflow:hidden}
.hq-scene{display:block;width:100%;height:auto;user-select:none;-webkit-user-select:none}
.hq-scene.paused{filter:saturate(.35) brightness(.85)}
.hq-o{cursor:pointer;outline:none}.hq-hit{fill:transparent;stroke:transparent;stroke-width:2;stroke-linejoin:round}
.hq-o:hover .hq-hit{fill:rgba(255,255,255,.035);stroke:rgba(255,255,255,.18)}.hq-o:focus-visible .hq-hit{stroke:#56cbff;stroke-width:2.5}
.hq-o.sel .hq-hit{stroke:var(--sc,#c3b4ff);stroke-opacity:.85;fill:rgba(255,255,255,.04)}
.hq-lb{font:600 17px -apple-system,system-ui,sans-serif;fill:#b4bac8;paint-order:stroke;stroke:#07080c;stroke-width:5px;stroke-linejoin:round;pointer-events:none}.hq-lb.on{fill:#fff}
.hq-rugl{font:700 16px -apple-system,system-ui,sans-serif;letter-spacing:.12em;opacity:.75;pointer-events:none}
.hq-lid{fill-opacity:.5}.hq-desk.run .hq-lid{fill-opacity:1}.hq-glow{opacity:0}.hq-desk.run .hq-glow{opacity:.32;animation:hqGlow 1.6s ease-in-out infinite alternate}
@keyframes hqGlow{to{opacity:.1}}
.hq-typing circle{animation:hqDot 1.2s infinite}.hq-typing circle:nth-of-type(2){animation-delay:.15s}.hq-typing circle:nth-of-type(3){animation-delay:.3s}
@keyframes hqDot{0%,60%,100%{opacity:.3}30%{opacity:1}}
.hq-said{opacity:.9}.hq-pulse{animation:hqGlow 2.2s ease-in-out infinite alternate}.hq-holo{animation:hqGlow 1.3s ease-in-out infinite alternate}.hq-orbit{animation:hqGlow 3s ease-in-out infinite alternate}
.hq-arc{fill:none;stroke-width:1.7;stroke-dasharray:5 7;animation:hqFlow 1.4s linear infinite;opacity:.75;pointer-events:none}
.hq-arc.k-challenge{stroke:#ff8a65}.hq-arc.k-reply{stroke:#56cbff}.hq-arc.k-ruling{stroke:#c3b4ff}.hq-arc.k-note{stroke:#9aa1b2;opacity:.45}
@keyframes hqFlow{to{stroke-dashoffset:-24}}
.hq.hq-off .hq-scene *{animation-play-state:paused!important}
.hq-legend{display:flex;flex-wrap:wrap;gap:6px 16px;padding:0 6px;font-size:12.5px;color:var(--ink2)}.hq-legend span{display:inline-flex;align-items:center;gap:7px}.hq-legend i{width:10px;height:10px;border-radius:3px}
.hq-dock{display:grid;grid-template-columns:repeat(8,minmax(0,1fr));gap:8px}
.hq-tile{display:flex;flex-direction:column;align-items:flex-start;gap:3px;min-width:0;padding:10px 12px;border-radius:14px;border:1px solid var(--line);background:rgba(255,255,255,.03);color:var(--ink);font:inherit;text-align:left;cursor:pointer;transition:border-color .2s,background .2s}
.hq-tile:hover{border-color:rgba(255,255,255,.2);background:rgba(255,255,255,.055)}.hq-tile.on{border-color:rgba(86,203,255,.6);background:rgba(86,203,255,.09)}
.hq-tic{font-size:19px;line-height:1.1}.hq-tile b{font-size:13px;font-weight:650}.hq-tile small{max-width:100%;font-size:11.5px;line-height:1.3;color:var(--dim);display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.hq-tip{position:absolute;z-index:5;max-width:280px;padding:7px 11px;border-radius:10px;background:rgba(12,14,20,.96);border:1px solid rgba(255,255,255,.14);box-shadow:0 10px 26px -8px #000;font-size:12.5px;color:#eef0f6;pointer-events:none;white-space:nowrap}
.hq-insp{min-width:0;padding:16px 18px;border-radius:20px;border:1px solid var(--line);background:rgba(13,15,22,.92);scroll-margin-top:84px}
.hq-ih{display:flex;align-items:center;gap:12px;margin-bottom:12px}.hq-ih>div{flex:1;min-width:0;display:flex;flex-direction:column;gap:2px}.hq-ih b{font-size:16px;font-weight:700;letter-spacing:-.01em}.hq-ih span{font-size:12.5px;color:var(--dim);line-height:1.4}
.hq-ic{flex:none;display:grid;place-items:center;width:40px;height:40px;border-radius:12px;background:rgba(255,255,255,.06);font-size:20px}
.hq-n4{grid-template-columns:repeat(4,minmax(0,1fr))!important;margin:6px 0 4px}
.hq-sec{margin:16px 0 4px;font:600 11px ui-monospace,Menlo,monospace;letter-spacing:.1em;text-transform:uppercase;color:var(--dim)}
.hq-det{border-top:1px solid var(--line)}.hq-sec+.hq-det,.hq-det:first-child{border-top:0}
.hq-det>summary{list-style:none;display:flex;align-items:flex-start;gap:10px;padding:10px 2px;cursor:pointer;min-height:24px;border-radius:10px}
.hq-det>summary::-webkit-details-marker{display:none}.hq-det>summary:hover{background:rgba(255,255,255,.03)}
.hq-det>summary::after{content:"›";flex:none;margin-left:auto;padding-left:6px;color:var(--dim);font-size:17px;line-height:1.1;transition:transform .2s}.hq-det[open]>summary::after{transform:rotate(90deg)}
.hq-dbody{padding:0 2px 12px 36px;animation:fzIn .25s ease}.hq-dbody p{margin:0 0 7px;font-size:13.5px;line-height:1.55;color:var(--ink2)}.hq-dbody ul{margin:0 0 6px;padding-left:18px}.hq-dbody li{font-size:13px;line-height:1.5;color:var(--ink2);margin-bottom:4px}
.hq-pred .hq-dbody,.hq-idea .hq-dbody,.hq-evd .hq-dbody{padding-left:2px}
.hq-ps{display:flex;flex-direction:column;gap:3px;min-width:0;flex:1}.hq-pm{display:flex;flex-wrap:wrap;align-items:center;gap:4px 8px;font-size:12.5px}.hq-pm b{font-weight:650}.hq-pm time{color:var(--dim);font-size:11.5px}
.hq-pm .fz-kind{font-style:normal}.hq-ph{font-size:13.5px;font-weight:600;line-height:1.38;color:var(--ink)}
.hq-small{font-size:12.5px!important;color:var(--dim)!important}.hq-g{color:#3ff2a3}
.hq-row{display:flex;align-items:flex-start;gap:10px;width:100%;padding:10px 2px;border:0;border-top:1px solid var(--line);background:none;color:var(--ink);font:inherit;text-align:left;cursor:pointer;border-radius:10px}
.hq-sec+.hq-row{border-top:0}.hq-row:hover{background:rgba(255,255,255,.035)}.hq-go{flex:none;margin-left:auto;color:var(--dim);font-size:17px}
.hq-hint{margin:14px 0 0;font-size:12.5px;color:var(--dim)}.hq-beat{margin:0 0 6px;font-size:13px;line-height:1.5;color:var(--ink2)}
.hq-btn{display:inline-flex;align-items:center;min-height:30px;margin-top:10px;padding:5px 12px;border-radius:10px;border:1px solid rgba(255,255,255,.14);background:rgba(255,255,255,.04);color:var(--ink);font:inherit;font-size:13px;font-weight:600;cursor:pointer}
.hq-btn:hover{background:rgba(255,255,255,.08)}.hq-call{margin:12px 0 4px}
.hq-ops{list-style:none;margin:0;padding:0}.hq-ops li{display:flex;gap:9px;padding:6px 0;font-size:13px;line-height:1.5;color:var(--ink2);border-top:1px solid var(--line)}.hq-ops li:first-child{border-top:0}
.hq-ops i{flex:none;width:8px;height:8px;margin-top:7px;border-radius:50%;background:#8d93a3}.hq-ops i.k-dropped{background:#ff8a65}.hq-ops i.k-changed{background:#56cbff}.hq-ops i.k-added{background:#3ff2a3}.hq-ops i.k-flag{background:#ffc65a}
.hq-ord{padding:9px 12px;margin:6px 0;border-radius:12px;border:1px solid rgba(255,211,110,.28);background:rgba(255,211,110,.06)}.hq-ord p{margin:0 0 3px;font-size:13.5px;line-height:1.45;color:var(--ink)}.hq-ord span{font-size:12px;color:var(--dim)}.hq-ord .link{font-size:12.5px;min-height:24px}
.hq-avs{display:flex;align-items:center;flex-wrap:wrap;gap:6px;margin:10px 0}.hq-avs span{font-size:12.5px;color:var(--ink2);margin-left:4px}
.hq-it{display:flex;align-items:center;gap:8px;min-width:0;flex:1}.hq-it b{font:700 15px ui-monospace,Menlo,monospace}.hq-isp{display:flex;align-items:center;gap:8px}.hq-isp svg{width:84px;height:26px;display:block}.hq-isp em{font:600 12.5px ui-monospace,Menlo,monospace;font-style:normal}
.hq-day{display:grid;grid-template-columns:54px minmax(0,1fr);gap:10px;padding:8px 0;border-top:1px solid var(--line)}.hq-day:first-of-type{border-top:0}
.hq-day time{display:flex;flex-direction:column}.hq-day time b{font:700 19px ui-monospace,Menlo,monospace;line-height:1}.hq-day time span{font-size:11px;color:var(--dim)}.hq-day.today time b{color:#3ff2a3}
.hq-ev{display:inline;font-size:13px;line-height:1.45}.hq-ev .fz-ck{margin-right:7px}.hq-ev em{font-size:11.5px;color:var(--dim);font-style:normal}.hq-ev.i3{font-weight:650;color:#fff}.hq-ev.i1{color:var(--ink2)}
.hq-evp{padding:6px 2px}.hq-evd>summary{padding:6px 2px}
.hq-insp .fz-recw{grid-template-columns:1fr}.hq-insp .fz-calib{max-width:300px}.hq-insp .fz-nums.five{grid-template-columns:repeat(3,minmax(0,1fr))}.hq-insp .fz-mkt{grid-template-columns:1fr;gap:6px}
.hq-insp .fz-yn{grid-template-columns:1fr}.hq-brainsec{scroll-margin-top:84px}
@media (min-width:1200px){.hq-stage{grid-template-columns:minmax(0,1fr) 400px}.hq-insp{position:sticky;top:76px;max-height:calc(100vh - 96px);overflow:auto}}
@media (min-width:1440px){.hq-stage{grid-template-columns:minmax(0,1fr) 430px}}
@media (min-width:1800px){.hq-stage{grid-template-columns:minmax(0,1fr) 520px}}
@media (max-width:1439px){.hq-dock{grid-template-columns:repeat(4,minmax(0,1fr))}}
@media (max-width:760px){.hq-scroll{overflow-x:auto;-webkit-overflow-scrolling:touch}.hq-scene{width:760px;max-width:none}.hq-n4{grid-template-columns:repeat(2,minmax(0,1fr))!important}}
.hq.ph .hq-stage{grid-template-columns:1fr}.hq.ph .hq-insp{position:static;max-height:none}.hq.ph .hq-scroll{overflow-x:auto;-webkit-overflow-scrolling:touch}
.hq.ph .hq-scene{width:760px;max-width:none}.hq.ph .hq-dock{grid-template-columns:repeat(4,minmax(0,1fr))}.hq.ph .hq-n4{grid-template-columns:repeat(2,minmax(0,1fr))!important}.hq.ph .hq-tile{padding:9px 10px}
/* v8: labels lie on the walls and floors, nameplates on the desks, a key for the lines, the gist folds */
.hq-wl{font:700 14px -apple-system,system-ui,sans-serif;letter-spacing:.1em;opacity:.78;pointer-events:none}.hq-wl.on{opacity:1}
.hq-rugl.r{font-size:14px;letter-spacing:.1em;opacity:.8}.hq-rugl.on{opacity:1}
.hq-plate{display:none}.hq-np .hq-plate,.rm-scene .hq-plate,.tr-scene .hq-plate{display:block}.hq-plate text{font:700 12px ui-monospace,Menlo,monospace;letter-spacing:0;pointer-events:none}
.hq-lid{fill-opacity:.38}.hq-desk.run .hq-lid{fill-opacity:1}
.hq-arc.old{opacity:.3}
.hq-legend .hq-sep{width:1px;height:14px;background:rgba(255,255,255,.14)}.hq-legend .hq-key i{width:18px;height:0;border-top:2px dashed var(--c);border-radius:0;background:none}
.hq-gfold{margin-top:8px}.hq-gfold>summary{list-style:none;display:inline-flex;align-items:center;gap:7px;min-height:24px;cursor:pointer;font-size:12.5px;font-weight:600;color:var(--ink2)}
.hq-gfold>summary::-webkit-details-marker{display:none}.hq-gfold>summary::before{content:"›";display:inline-block;color:var(--dim);font-size:16px;transition:transform .2s}.hq-gfold[open]>summary::before{transform:rotate(90deg)}
.hq-gfold>summary:hover{color:#fff}
.hq.ph .hq-legend{flex-wrap:nowrap;overflow-x:auto;padding-bottom:4px;-webkit-overflow-scrolling:touch}.hq.ph .hq-legend span{flex:none}
`;
  const el = document.createElement('style'); el.id = 'hq-css'; el.textContent = css; document.head.appendChild(el);
}

function fzStyle() {
  if (document.getElementById('fz-css')) return;
  const css = `
.fz{--g:#3ff2a3;--r:#ff5f6e;--ink:#eef0f6;--ink2:#c5cad6;--dim:#8d93a3;--line:rgba(255,255,255,.08);color:var(--ink);display:flex;flex-direction:column;gap:16px}
.fz h2{margin:0;font-size:22px;font-weight:700;letter-spacing:-.03em}.fz-top p{margin:4px 0 0;color:var(--dim);font-size:13.5px;max-width:70ch}
.fz-top{display:flex;flex-wrap:wrap;gap:12px 20px;align-items:flex-end;justify-content:space-between}
.fz-stats{display:flex;flex-wrap:wrap;gap:8px}.fz-stats span{font-size:12.5px;color:var(--ink2);padding:6px 11px;border-radius:999px;background:rgba(255,255,255,.04);border:1px solid var(--line)}
.fz-stats b{font:700 13px ui-monospace,Menlo,monospace;color:#fff;margin-right:3px}
.fz-c{padding:18px 20px;border-radius:20px;background:rgba(255,255,255,.03);border:1px solid var(--line);min-width:0}
.fz-c h3{margin:0 0 12px;font-size:15px;font-weight:650;letter-spacing:-.02em}.fz-c h3 span{margin-left:8px;font-size:12.5px;font-weight:500;color:var(--dim)}
.fz-h5,.fz-dp h5{margin:16px 0 8px;font:600 11.5px ui-monospace,Menlo,monospace;letter-spacing:.12em;text-transform:uppercase;color:var(--dim)}
.fz-fine{font-size:12.5px;color:var(--dim);margin:6px 0 0;line-height:1.5}.fz-dim{color:var(--dim)}
.fz-live{display:flex;align-items:center;gap:14px;padding:14px 18px;border-radius:18px;border:1px solid var(--line);background:linear-gradient(100deg,rgba(86,203,255,.06),rgba(255,255,255,.02))}
.fz-live>div{flex:1;min-width:0;display:flex;flex-direction:column;gap:2px}.fz-live b{font-size:14.5px;font-weight:650}.fz-live span{font-size:13px;color:var(--ink2)}
.fz-live.on{border-color:rgba(63,242,163,.35);background:linear-gradient(100deg,rgba(63,242,163,.1),rgba(255,255,255,.02))}.fz-live.warn{border-color:rgba(255,198,90,.35);background:linear-gradient(100deg,rgba(255,198,90,.09),rgba(255,255,255,.02))}
.fz-pulse{flex:none;width:10px;height:10px;border-radius:50%;background:var(--g);box-shadow:0 0 0 0 rgba(63,242,163,.6);animation:fzPing 1.8s infinite}.fz-pulse.idle{background:#56cbff;animation:none;box-shadow:0 0 10px rgba(86,203,255,.5)}.fz-pulse.warn{background:#ffc65a;animation:none}
@keyframes fzPing{0%{box-shadow:0 0 0 0 rgba(63,242,163,.55)}80%,100%{box-shadow:0 0 0 12px rgba(63,242,163,0)}}
.fz-live>div.fz-ws{flex:none;flex-direction:row;gap:4px;align-items:center}.fz-btn{flex:none;font:inherit;font-size:13px;font-weight:600;color:#03140b;background:var(--g);border:0;border-radius:11px;padding:9px 14px;cursor:pointer}.fz-btn:disabled{opacity:.6;cursor:default}
.fz-av{flex:none;display:inline-grid;place-items:center;width:30px;height:30px;border-radius:50%;font:700 11px ui-monospace,Menlo,monospace;letter-spacing:.02em;color:var(--c);
  background:color-mix(in srgb,var(--c) 14%,#0b0c12);border:1.5px solid color-mix(in srgb,var(--c) 55%,transparent);position:relative}
.fz-av.on::after{content:"";position:absolute;inset:-4px;border-radius:50%;border:2px solid var(--c);opacity:.8;animation:fzRing 1.4s ease-out infinite}
@keyframes fzRing{from{transform:scale(.85);opacity:.9}to{transform:scale(1.25);opacity:0}}
.fz-org{display:flex;flex-direction:column;align-items:stretch}
.fz-pmrow{display:flex;justify-content:center}.fz-trunk{height:18px;display:flex;justify-content:center}.fz-trunk i{width:2px;background:linear-gradient(var(--line),rgba(195,180,255,.4))}
.fz-teams{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:12px 10px;position:relative;padding-top:14px;border-top:2px solid rgba(195,180,255,.18)}
.fz-seats{display:flex;flex-direction:column;gap:6px}.fz-team.t-sector{grid-column:span 2}.fz-team.t-sector .fz-seats{display:grid;grid-template-columns:repeat(2,minmax(0,1fr))}
.fz-team{display:flex;flex-direction:column;gap:6px;min-width:0}.fz-team h4{margin:0 0 2px;display:flex;align-items:center;gap:7px;font:600 11.5px ui-monospace,Menlo,monospace;letter-spacing:.1em;text-transform:uppercase;color:var(--c)}
.fz-team h4 i{width:7px;height:7px;border-radius:50%;background:var(--c)}
.fz-seat{display:flex;align-items:center;gap:9px;width:100%;min-width:0;text-align:left;padding:7px 9px;border-radius:12px;border:1px solid var(--line);background:rgba(255,255,255,.025);color:var(--ink);font:inherit;cursor:pointer;transition:border-color .2s,background .2s,transform .2s}
.fz-seat:hover{border-color:color-mix(in srgb,var(--c) 50%,transparent);transform:translateY(-1px)}.fz-seat.sel{border-color:var(--c);background:color-mix(in srgb,var(--c) 12%,transparent)}
.fz-seat.run{border-color:color-mix(in srgb,var(--c) 60%,transparent);box-shadow:0 0 18px -6px var(--c)}
.fz-sn{display:flex;flex-direction:column;min-width:0}.fz-sn b{font-size:12.5px;font-weight:600;line-height:1.25}.fz-sn small{font-size:11px;color:var(--dim);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.fz-seat.pm{width:auto;min-width:260px;padding:10px 16px;border-radius:16px;background:linear-gradient(140deg,rgba(195,180,255,.14),rgba(255,255,255,.02))}.fz-seat.pm .fz-av{width:40px;height:40px;font-size:12px}.fz-seat.pm b{font-size:14px}
.fz-dp{margin-top:14px;padding:16px 18px;border-radius:16px;border:1px solid color-mix(in srgb,var(--c) 40%,transparent);background:linear-gradient(160deg,color-mix(in srgb,var(--c) 9%,transparent),rgba(255,255,255,.015));animation:fzIn .3s ease}
@keyframes fzIn{from{opacity:0;transform:translateY(6px)}}
.fz-dh{display:flex;align-items:center;gap:12px;margin-bottom:10px}.fz-dh>div{flex:1;display:flex;flex-direction:column}.fz-dh b{font-size:16px}.fz-dh span{font-size:12.5px;color:var(--dim)}
.fz-x{font:inherit;background:none;border:0;color:var(--dim);font-size:15px;cursor:pointer;padding:4px 8px}.fz-x:hover{color:#fff}
.fz-dp p{margin:0 0 6px;font-size:13.5px;line-height:1.5;color:var(--ink2)}.fz-dp ul{margin:0;padding-left:18px}.fz-dp li{font-size:13px;line-height:1.5;color:var(--ink2);margin:0 0 4px}.fz-dp li em{color:var(--dim);font-style:normal;font-size:11.5px}
.fz-dcols{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:4px 22px}
.fz-nums{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px;margin:10px 0}.fz-nums.five{grid-template-columns:repeat(5,minmax(0,1fr))}.fz-nums div{padding:9px 10px;border-radius:12px;background:rgba(255,255,255,.035);border:1px solid var(--line);min-width:0}
.fz-nums b{display:block;font:700 17px ui-monospace,Menlo,monospace;letter-spacing:-.03em}.fz-nums span{font-size:11px;color:var(--dim)}
.fz-main{display:grid;grid-template-columns:minmax(0,1.5fr) minmax(0,1fr);gap:16px;align-items:start}.fz-side{display:flex;flex-direction:column;gap:16px;min-width:0}
.fz-row{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:16px;align-items:start}
.fz-filt{display:flex;flex-wrap:wrap;gap:6px;margin:-2px 0 10px}.fz-f{font:inherit;font-size:12.5px;padding:5px 11px;border-radius:999px;border:1px solid var(--line);background:none;color:var(--dim);cursor:pointer}
.fz-f:hover{color:#fff}.fz-f.on{color:#fff;background:rgba(255,255,255,.08);border-color:rgba(255,255,255,.18)}.fz-f.desk{border-color:rgba(195,180,255,.5);color:#c3b4ff}
.fz-feed{display:flex;flex-direction:column}
.fz-post{display:flex;gap:12px;padding:13px 0;border-top:1px solid var(--line)}.fz-post:first-child{border-top:0;padding-top:4px}
.fz-post.k-challenge,.fz-post.k-reply,.fz-post.k-note{padding-left:22px}.fz-post.k-challenge{background:linear-gradient(90deg,rgba(255,138,101,.06),transparent 60%)}
.fz-post.k-ruling,.fz-post.k-briefing{background:linear-gradient(90deg,rgba(195,180,255,.08),transparent 70%)}.fz-post.k-alert{background:linear-gradient(90deg,rgba(255,95,110,.09),transparent 70%)}
.fz-post.urgent .fz-pb h4{color:#ffd0d4}
.fz-pb{flex:1;min-width:0}.fz-ph{display:flex;align-items:center;gap:8px;flex-wrap:wrap}.fz-ph b{font-size:13px;font-weight:650}.fz-ph time{margin-left:auto;font:500 11.5px ui-monospace,Menlo,monospace;color:var(--dim)}
.fz-kind{font:600 11px ui-monospace,Menlo,monospace;letter-spacing:.08em;text-transform:uppercase;color:var(--k);padding:2px 7px;border-radius:999px;border:1px solid color-mix(in srgb,var(--k) 45%,transparent)}
.fz-sev{font:600 11px ui-monospace,Menlo,monospace;letter-spacing:.06em;text-transform:uppercase;padding:2px 7px;border-radius:999px;color:#ffc65a;background:rgba(255,198,90,.1)}.fz-sev.s3{color:#ff8a93;background:rgba(255,95,110,.14)}.fz-sev.s1{color:var(--dim);background:rgba(255,255,255,.05)}
.fz-mood{width:8px;height:8px;border-radius:50%}
.fz-pb h4{margin:5px 0 3px;font-size:14.5px;font-weight:650;line-height:1.35;letter-spacing:-.01em}.fz-pb p{margin:0;font-size:13.5px;line-height:1.55;color:var(--ink2)}
.fz-re{font-size:12.5px!important;color:var(--dim)!important;margin:4px 0 0!important}
.fz-more{font:inherit;font-size:13px;color:#c3b4ff;background:none;border:0;min-height:28px;padding:4px 0;cursor:pointer;margin-top:2px}.fz-more:hover{color:#fff}.fz-more.wide{display:block;margin:6px auto 0}
.fz-tags{display:flex;flex-wrap:wrap;gap:6px;margin-top:8px}
.fz-tk{display:inline-flex;align-items:center;gap:6px;font:inherit;font-size:11.5px;color:var(--c);padding:3px 9px;border-radius:999px;border:1px solid color-mix(in srgb,var(--c) 40%,transparent);background:color-mix(in srgb,var(--c) 8%,transparent);cursor:pointer}
.fz-tk b{color:#fff;font:700 11.5px ui-monospace,Menlo,monospace}.fz-pc{font:600 11.5px ui-monospace,Menlo,monospace;color:#c3b4ff;min-height:24px;padding:3px 10px;border-radius:999px;border:1px dashed rgba(195,180,255,.45);background:none;cursor:pointer}
.fz-srcs{display:flex;flex-wrap:wrap;gap:6px;margin-top:8px}.fz-src{display:inline-flex;flex-direction:column;gap:1px;max-width:260px;padding:6px 10px;border-radius:10px;border:1px solid var(--line);background:rgba(255,255,255,.03);color:inherit;text-decoration:none;font:inherit;text-align:left;cursor:pointer}
.fz-src b{font-size:12px;font-weight:550;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.fz-src span{font-size:11px;color:var(--dim)}
.fz-odds{display:inline-flex;align-items:center;gap:8px;min-width:0}.fz-ob{position:relative;flex:1;display:block;width:90px;height:6px;border-radius:6px;background:rgba(255,255,255,.08)}
.fz-ob i{position:absolute;left:0;top:0;bottom:0;border-radius:6px}.fz-ob b{position:absolute;top:-4px;bottom:-4px;width:2px;margin-left:-1px;background:#fff;border-radius:2px;box-shadow:0 0 0 1px rgba(0,0,0,.5)}
.fz-odds em{font:700 12.5px ui-monospace,Menlo,monospace;font-style:normal;min-width:34px;text-align:right}.fz-odds.big{display:flex;width:100%;margin:8px 0 2px}.fz-odds.big .fz-ob{height:9px;width:auto}.fz-odds.big em{font-size:20px;min-width:52px}
.fz-card{padding:14px;border-radius:16px;border:1px solid var(--line);background:linear-gradient(160deg,rgba(255,255,255,.045),rgba(255,255,255,.012));margin-top:10px}.fz-card:first-of-type{margin-top:0}
.fz-ch{display:flex;align-items:center;gap:8px}.fz-ch time{flex:1;font-size:11.5px;color:var(--dim)}
.fz-cid{flex:none;font:700 11.5px ui-monospace,Menlo,monospace;color:#c3b4ff;min-height:24px;min-width:32px;padding:4px 8px;border-radius:7px;background:rgba(195,180,255,.1);border:0;cursor:pointer}
.fz-card h4{margin:8px 0 0;font-size:14.5px;line-height:1.35;font-weight:650}.fz-mk{margin:0;font-size:11.5px;color:var(--dim)}
.fz-yn{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:10px}.fz-yn>div{padding:9px 10px;border-radius:12px;background:rgba(255,255,255,.03)}
.fz-yn small{display:block;font:600 11px ui-monospace,Menlo,monospace;letter-spacing:.12em;text-transform:uppercase;margin-bottom:3px}.fz-yn .y small{color:var(--g)}.fz-yn .n small{color:#ff8a65}
.fz-yn p{margin:0;font-size:12.5px;line-height:1.5;color:var(--ink2)}
.fz-mvs{display:flex;flex-wrap:wrap;align-items:center;gap:6px;margin-top:10px}.fz-mvs small{width:100%;font-size:11px;color:var(--dim)}
.fz-mv{display:inline-flex;align-items:center;gap:4px;font-size:11.5px;padding:3px 8px;border-radius:999px;background:rgba(255,255,255,.04);border:1px solid var(--line)}.fz-mv b{font:700 11px ui-monospace,Menlo,monospace;margin-right:2px}
.fz-mv i{font-style:normal;font-size:11px}.fz-mv i.up{color:var(--g)}.fz-mv i.dn{color:var(--r)}.fz-mv i.fl{color:var(--dim)}.fz-mv em{color:var(--dim);font-style:normal}
.fz-prs{display:flex;flex-direction:column}.fz-pr{border-top:1px solid var(--line)}.fz-pr:first-child{border-top:0}
.fz-prh{display:grid;grid-template-columns:auto minmax(0,1fr) auto auto;gap:10px;align-items:center;width:100%;padding:9px 0;border:0;background:none;color:var(--ink);font:inherit;text-align:left;cursor:pointer}
.fz-prh .q{font-size:13px;line-height:1.4}.fz-prh time{font:500 11px ui-monospace,Menlo,monospace;color:var(--dim);white-space:nowrap}.fz-prh .fz-ob{width:56px}
.fz-pr.on .fz-prh .q{color:#fff;font-weight:600}.fz-prx{padding:0 0 12px 44px}.fz-prx p{margin:0 0 5px;font-size:12.5px;line-height:1.5;color:var(--ink2)}
.fz-trail{display:block;margin:0 0 6px}.fz-trail line{stroke:rgba(255,255,255,.12);stroke-dasharray:2 3}.fz-trail polyline{fill:none;stroke:#c3b4ff;stroke-width:1.6}
.fz-res{font:600 11px ui-monospace,Menlo,monospace;padding:2px 8px;border-radius:999px;background:rgba(255,255,255,.06);color:var(--dim)}.fz-res.y{color:var(--g);background:rgba(63,242,163,.1)}.fz-res.n{color:var(--r);background:rgba(255,95,110,.1)}
.fz-cal{list-style:none;margin:0;padding:0}.fz-cal li{display:grid;grid-template-columns:64px minmax(0,1fr);gap:12px;padding:9px 0;border-top:1px solid var(--line)}.fz-cal li:first-child{border-top:0}
.fz-cal li.past{opacity:.85}.fz-cal li.today time b{color:var(--g)}.fz-cal time{display:flex;flex-direction:column}.fz-cal time b{font:700 20px ui-monospace,Menlo,monospace;line-height:1}.fz-cal time span{font-size:11px;color:var(--dim)}
.fz-cal p{margin:0 0 4px;font-size:13px;line-height:1.45;display:flex;flex-wrap:wrap;align-items:baseline;gap:4px 8px}.fz-cal p b{font-weight:550}.fz-cal p.i3 b{color:#fff;font-weight:650}.fz-cal p.i1 b{color:var(--ink2);font-weight:500}
.fz-cal p em{font-size:11.5px;color:var(--dim);font-style:normal}.fz-cal p span{width:100%;font-size:12px;color:var(--dim)}
.fz-ck{font:600 11px ui-monospace,Menlo,monospace;letter-spacing:.08em;text-transform:uppercase;font-style:normal;color:#56cbff;padding:1px 6px;border-radius:6px;background:rgba(86,203,255,.1)}
.fz-recw{display:grid;grid-template-columns:250px minmax(0,1fr);gap:16px;align-items:start}
.fz-calib{width:100%;height:auto;font:11px ui-monospace,Menlo,monospace}.fz-calib text{fill:#8d93a3}.fz-calib .ax{font-family:-apple-system,system-ui,sans-serif;font-size:11px;fill:#a6acbb}
.fz-calib line.g{stroke:rgba(255,255,255,.05)}.fz-calib line.diag{stroke:rgba(255,255,255,.3);stroke-dasharray:4 4}.fz-calib .dot{fill:rgba(195,180,255,.5);stroke:#c3b4ff;stroke-width:1.5}
.fz-honest{margin:10px 0 0;font-size:12.5px;line-height:1.5;color:var(--ink2);padding:9px 11px;border-radius:12px;background:rgba(255,198,90,.06);border-left:2px solid #ffc65a}
.fz-bd{display:flex;flex-direction:column;margin-top:10px}.fz-bd button{display:grid;grid-template-columns:22px minmax(0,1fr) auto 44px;gap:8px;align-items:center;padding:6px 0;border:0;border-top:1px solid var(--line);background:none;color:var(--ink);font:inherit;font-size:12.5px;text-align:left;cursor:pointer}
.fz-bd span{color:var(--dim);font-size:11.5px}.fz-bd em{font:700 12px ui-monospace,Menlo,monospace;font-style:normal;text-align:right}
.fz-mks{display:flex;flex-direction:column}.fz-mkt{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1.1fr);gap:14px;align-items:center;padding:9px 0;border:0;border-top:1px solid var(--line);background:none;color:inherit;text-decoration:none;font:inherit;text-align:left;cursor:pointer}
.fz-mkt:first-child{border-top:0}.fz-mkt .t{display:flex;flex-direction:column;min-width:0}.fz-mkt .t b{font-size:13px;font-weight:550;line-height:1.35}.fz-mkt .t small{font-size:11px;color:var(--dim)}
.fz-mkt .o{display:flex;flex-direction:column;gap:3px;min-width:0}.fz-mkt .o span{display:grid;grid-template-columns:minmax(0,1fr) 54px 36px;gap:8px;align-items:center}
.fz-mkt .o em{font-size:11.5px;color:var(--ink2);font-style:normal;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.fz-mkt .o i{display:block;height:5px;border-radius:5px;background:linear-gradient(90deg,#56cbff var(--p),rgba(255,255,255,.08) var(--p))}
.fz-mkt .o b{font:700 11.5px ui-monospace,Menlo,monospace;text-align:right}
.fz-sch{list-style:none;margin:0;padding:0}.fz-sch li{display:grid;grid-template-columns:96px minmax(0,1fr) auto;gap:10px;padding:7px 0;border-top:1px solid var(--line);font-size:13px;align-items:baseline}.fz-sch li:first-child{border-top:0}
.fz-sch b{font:600 12px ui-monospace,Menlo,monospace;color:#56cbff}.fz-sch em{font-size:11.5px;color:var(--dim);font-style:normal;text-align:right}
.fz-meets{list-style:none;margin:0;padding:0}.fz-meets li{display:flex;align-items:center;gap:8px;padding:5px 0;font-size:13px}.fz-meets span{color:var(--dim);font-size:12px}
.fz-meets i{width:8px;height:8px;border-radius:50%;background:var(--g)}.fz-meets i.failed{background:var(--r)}.fz-meets i.paused{background:#ffc65a}.fz-meets i.running{background:#56cbff}
.fz-foot{text-align:center;max-width:80ch;margin:4px auto 0}
.fz-a,.fz-b{display:flex;flex-direction:column;gap:16px;min-width:0}.fz [id^="fz-s-"]{scroll-margin-top:84px}
.fz-jump{display:flex;flex-wrap:wrap;gap:6px}.fz-jump button{font:inherit;font-size:12.5px;font-weight:550;color:var(--ink2);padding:6px 12px;border-radius:999px;border:1px solid var(--line);background:rgba(255,255,255,.03);cursor:pointer}
.fz-jump button:hover{color:#fff;border-color:rgba(255,255,255,.2);background:rgba(255,255,255,.07)}
.fz-idea{display:grid;grid-template-columns:150px minmax(0,1fr) 130px;gap:14px;align-items:center;width:100%;padding:11px 0;border:0;border-top:1px solid var(--line);background:none;color:var(--ink);font:inherit;text-align:left;cursor:pointer}
.fz-idea:first-of-type{border-top:0;padding-top:2px}.fz-idea:hover .fz-it b{color:#fff;text-decoration:underline}
.fz-it{display:flex;flex-direction:column;align-items:flex-start;gap:5px}.fz-it b{font:700 15px ui-monospace,Menlo,monospace;letter-spacing:-.02em}
.fz-vw{font:600 11px ui-monospace,Menlo,monospace;letter-spacing:.08em;text-transform:uppercase;color:var(--c);padding:2px 7px;border-radius:999px;border:1px solid color-mix(in srgb,var(--c) 45%,transparent)}
.fz-ib p{margin:0;font-size:13px;line-height:1.5;color:var(--ink2)}.fz-ib p.if{margin-top:3px;font-size:12.5px;color:var(--dim)}.fz-ib p.if b{color:#3ff2a3;font-weight:600}
.fz-isp{display:flex;flex-direction:column;align-items:flex-end;gap:2px}.fz-isp svg{width:120px;height:30px;display:block}.fz-isp em{font:600 12.5px ui-monospace,Menlo,monospace;font-style:normal}
.fz-strat{margin-top:12px;padding:12px 14px;border-radius:14px;background:rgba(63,242,163,.04);border:1px solid rgba(63,242,163,.16)}
.fz-strat p{margin:0 0 8px;font-size:13px;display:flex;flex-wrap:wrap;gap:4px 10px;align-items:baseline}.fz-strat p span{font-size:12px;color:var(--dim)}
.fz-tkcs{display:flex;flex-wrap:wrap;gap:6px}.fz-tkc{display:inline-flex;gap:7px;align-items:baseline;font:inherit;font-size:12px;color:var(--ink2);padding:4px 10px;border-radius:999px;border:1px solid var(--line);background:rgba(255,255,255,.03);cursor:pointer}
.fz-tkc b{font:700 12px ui-monospace,Menlo,monospace;color:#fff}.fz-tkc:hover{border-color:rgba(255,255,255,.22)}
.fz-brain{min-width:0}
@media (min-width:641px) and (max-width:1099px){.fz [id^="fz-s-"]{scroll-margin-top:130px}}
@media (max-width:640px){.fz-idea{grid-template-columns:minmax(0,1fr) 96px;gap:4px 12px}.fz-it{flex-direction:row;align-items:center;grid-column:1/-1;order:0}.fz-ib{order:1}.fz-isp{order:2}.fz-isp svg{width:96px}}
.fz.ph .fz-idea{grid-template-columns:minmax(0,1fr) 96px;gap:4px 12px}.fz.ph .fz-it{flex-direction:row;align-items:center;grid-column:1/-1}.fz.ph .fz-isp svg{width:96px}.fz.ph [id^="fz-s-"]{scroll-margin-top:70px}
@media (max-width:1180px){.fz-teams{grid-template-columns:repeat(2,minmax(0,1fr))}}
@media (max-width:980px){.fz-main,.fz-row{grid-template-columns:1fr}.fz-recw{grid-template-columns:220px minmax(0,1fr)}}
@media (max-width:640px){.fz-teams{grid-template-columns:repeat(2,minmax(0,1fr))}.fz-sn b{white-space:normal}.fz-recw{grid-template-columns:1fr}.fz-calib{max-width:280px}.fz-nums,.fz-nums.five{grid-template-columns:repeat(3,minmax(0,1fr))}
  .fz-mkt{grid-template-columns:1fr;gap:6px}.fz-c{padding:15px 14px}.fz-live{flex-wrap:wrap}.fz-live>div.fz-ws{width:100%;padding-left:24px}.fz-btn{width:100%}.fz-seat.pm{min-width:0;width:100%}.fz-yn{grid-template-columns:1fr}.fz-prx{padding-left:0}
  .fz-post.k-challenge,.fz-post.k-reply,.fz-post.k-note{padding-left:10px}.fz-sch li{grid-template-columns:84px minmax(0,1fr)}.fz-sch em{grid-column:2;text-align:left}}
.fz.ph{gap:14px}.fz.ph h2{font-size:20px}.fz.ph .fz-sn b{white-space:normal}.fz.ph .fz-main,.fz.ph .fz-row{grid-template-columns:1fr}.fz.ph .fz-teams{grid-template-columns:repeat(2,minmax(0,1fr))}.fz.ph .fz-recw{grid-template-columns:1fr}
.fz.ph .fz-calib{max-width:280px}.fz.ph .fz-mkt{grid-template-columns:1fr;gap:6px}.fz.ph .fz-c{padding:15px 14px}.fz.ph .fz-yn{grid-template-columns:1fr}.fz.ph .fz-prx{padding-left:0}
.fz.ph .fz-nums,.fz.ph .fz-nums.five{grid-template-columns:repeat(3,minmax(0,1fr))}.fz.ph .fz-seat.pm{min-width:0;width:100%}.fz.ph .fz-post.k-challenge,.fz.ph .fz-post.k-reply,.fz.ph .fz-post.k-note{padding-left:10px}
.fz.ph .fz-live{flex-wrap:wrap}.fz.ph .fz-live>div.fz-ws{width:100%;padding-left:24px}.fz.ph .fz-btn{width:100%}.fz.ph .fz-sch li{grid-template-columns:84px minmax(0,1fr)}.fz.ph .fz-sch em{grid-column:2;text-align:left}.fz.ph .fz-stats span{font-size:12px;padding:5px 9px}
.b2-firmmini .fm-s{margin:0 0 10px;font-size:13.5px;color:var(--ink2,#c5cad6)}.b2-firmmini .fm-c{display:flex;align-items:flex-start;gap:10px;width:100%;margin-top:8px;padding:10px 12px;border-radius:12px;background:rgba(255,255,255,.035);border:1px solid rgba(255,255,255,.08);color:inherit;font:inherit;text-align:left;cursor:pointer}
.b2-firmmini .fm-c:hover{border-color:rgba(255,255,255,.16)}.b2-firmmini .fm-c span{display:flex;flex-direction:column;gap:2px;min-width:0}.b2-firmmini .fm-c small{font-size:11.5px;color:#8d93a3}
.b2-firmmini .fm-c b{font-size:13.5px;font-weight:600;line-height:1.35}.b2-firmmini .fm-f{margin:10px 0 0;font-size:12px}
.b2-firmmini .fm-avs{display:flex;gap:3px;margin:0 0 10px}.b2-firmmini .fm-avs .fz-av{width:22px;height:22px;font-size:8px}
`;
  const el = document.createElement('style'); el.id = 'fz-css'; el.textContent = css; document.head.appendChild(el);
}
function viewFirm() { return firmView(S, { phone }); }
// Today's Firm card uses the gist's look too
function fzTeam(st, t, n = 3) {  // v7: the desks covering a stock, each with its latest view, from the board
  const F = (st || {}).firm || {}, T = String(t || '').toUpperCase(), seen = new Map();
  for (const p of F.feed || []) {
    if (p.desk === 'boss') continue;
    for (const x of p.stocks || []) if (String(x.ticker || '').toUpperCase() === T && !seen.has(p.desk)) seen.set(p.desk, x.view);
    if (seen.size >= n) break;
  }
  if (!seen.size) return '';
  fzStyle();
  return `<span class="pr-team"><small>Your team</small>${[...seen].map(([id, v]) => { const d = fzD(F, id), w = FZV[v] || [cap(v || 'Watch'), '#8d93a3'];
    return `<span class="pt">${fzAv(d, 20)}<i>${esc(HQL[id] || d.name)}</i><b style="color:${w[1]}">${esc(w[0])}</b></span>`; }).join('')}</span>`;
}
function firmMini() {
  const F = S.firm || {}; if (!F.on) return '';
  hqStyle();
  const m = F.meeting, last = (F.meetings || [])[0];
  const ws = m ? (m.writing || []).map(id => fzD(F, id)) : [];
  const memos = (F.feed || []).filter(p => p.kind === 'memo' || p.kind === 'alert').slice(0, 2);  // what the desks said last, in words (the odds live on the Firm tab)
  const office = phone ? '' : `<button class="fm-hq" data-view="firm" aria-label="Open the Firm's office">${hqScene(S).replace(/ role="button" tabindex="0"/g, '').replace(/ data-fact="sel"/g, '').replace(/ role="group" aria-label="[^"]*"/, ' aria-hidden="true" focusable="false"')}</button>`;  // v7: your team at work
  return `<section class="card panel b2-firmmini"><h2>${m ? '<span class="live"><i></i></span>' : ''}The Firm <button class="link" data-view="firm">Open ›</button></h2>
    ${office}${ws.length ? `<div class="fm-avs">${ws.map(d => fzAv(d, 22)).join('')}</div>` : ''}
    <p class="fm-s">${m ? `${esc(m.label)} now: ${esc(m.step || 'starting')}` : last ? `Last: ${esc(last.label)}, ${esc(hm(last.finished || last.started))}${last.posts ? ` · ${last.posts} posts` : ''}` : 'The desks meet every morning before the market opens.'}</p>
    ${F.gist && F.gist.summary ? hqGist(F, true) : memos.map(p => { const d = fzD(F, p.desk); return `<button class="fm-c" data-view="firm">${fzAv(d, 24)}<span><small>${esc(d.name)} · ${esc(fzAgo(p.at))}</small><b>${esc(p.headline)}</b></span></button>`; }).join('')}
    <p class="dim fm-f">${(F.desks || []).length} desks · ${(CL().lessons || []).length} lessons${(F.next || [])[0] ? ` · next: ${esc(F.next[0].label.toLowerCase())} ${esc(fzWhen(F.next[0].at))}` : ''}</p></section>`;
}

/* ---------------- Bot ---------------- */
function viewBot() {
  const b = S.bot, a = S.account, orders = S.orders || [], C = S.claude || {};
  const sizeTxt = b.size >= 1 ? 'full-size buys' : `buys at ${Math.round(b.size * 100)}% size`;
  const vchip = ['', ''];
  const urgent = orders.some(o => o.urgency === 0);
  const nx = String(b.next_scan || '').match(/^(.*?)\s*at\s+(.*)$/);
  const tiles = [['Orders', orders.length ? String(orders.length) : 'None', orders.length ? (urgent ? 'one is due today' : 'waiting for you') : 'nothing to do', orders.length ? (urgent ? 'stop' : 'go') : ''],
    ['Cash', money(a.cash), `of ${money(a.total)} in all`, ''],
    CL().running ? ['The PM', 'Writing', 'a fresh briefing', 'go'] : byClaude() ? ['The PM', hm(CL().at), 'last briefing', ''] :
    ['Research desk', C.running ? 'Working' : `${C.today || 0} stock${C.today === 1 ? '' : 's'}`, C.running ? `researching ${(C.doing || []).join(', ') || '…'}` : `researched today${C.searches ? ` · ${C.searches} searches` : ''}`, C.running ? 'go' : ''],
    ['Next check', nx ? nx[2] : (b.next_scan || '–'), nx ? nx[1] || 'today' : 'the app checks by itself', '']];
  const hero = `<section class="b2-head card"><div class="b2-say">
      <p class="eyebrow live"><i></i>${byClaude() ? `The Firm’s ${esc((CL().label || 'briefing').toLowerCase())} · ${esc(hm(CL().at))}` : 'SRM Finance is running' + (phone ? '' : ' · ' + esc(fresh().replace('Updated', 'checked')))}</p>
      <h1 class="${String(b.headline || '').length > 56 ? 'long' : ''}">${esc(b.headline || 'All set.')}</h1>${byClaude() ? foldText(b.sub, 2, 'Read the PM’s full note', 'sub') : `<p class="sub">${esc(b.sub)}${orders.length ? '' : ` It keeps checking by itself and ${phone ? 'sends a notification' : 'tells you here and on your phone'} the moment an order is needed.`}</p>`}
      ${b.next_line ? `<p class="nx">${esc(b.next_line)}</p>` : ''}
      ${byClaude() && (CL().updates || []).length ? `<div class="b2-upd" aria-label="Changes by the Operations desk">${CL().updates.slice(-2).map(u => `<p><b><span class="fz-av" style="--c:#c3b4ff">OP</span>Operations desk · ${esc(hm(u.at))}</b>${(u.changes || []).map(c => `<span>${esc(c)}</span>`).join('')}${u.pm_needed ? '<em>It asked the PM for a decision.</em>' : ''}</p>`).join('')}</div>` : ''}
      <div class="chips">${stratChip()}${byClaude() ? `<span class="chip go"><i></i>The Firm decides · you OK every order</span>${CL().score_n ? `<span class="chip"><i></i>${esc(CL().score)}</span>` : ''}`
        : `<span class="chip warn"><i></i>No fresh briefing from the Firm: these are the old rules’ suggestions until the PM writes one</span>`}</div></div>
    <div class="b2-tiles">${tiles.map(([k, v, s, c]) => `<div class="tile${c ? ' t-' + c : ''}"><small>${k}</small><b>${esc(v)}</b><span>${esc(s)}</span></div>`).join('')}</div></section>`;
  const paused = (b.paused || []).map(p => `<div class="banner">⏸ <span>${esc(p)}</span></div>`).join('');
  const bundle = S.bundle && !phone ? `<div class="bundle" data-i="all"><span><b>${S.bundle.n} orders to place</b> · copy them all at once, or open each one below for the steps.</span>
    <button class="btn" data-act="plcopy" data-i="all">Copy all ${S.bundle.n} orders</button><button class="btn go" data-act="send" data-i="all">I placed them all</button></div>` : '';
  const tickets = orders.map(ticket).join('');
  const ord = paused || bundle || tickets ? `<section class="b2-orders">${tickets ? `<div class="sec-h" style="margin:0 0 12px"><h2>Orders</h2><span>top to bottom</span></div>` : ''}${paused}${bundle}<div class="tickets">${tickets}</div></section>` : '';
  const mo = (S.motion || []).filter(m => !m.done).slice(0, 6);
  const motion = mo.length ? `<section class="b2-motion"><div class="sec-h" style="margin:0 0 12px"><h2>In motion</h2><span>orders you placed and money on the way</span></div>
    <div class="motion">${mo.map(motionRow).join('')}</div></section>` : '';
  const sched = `<section class="b2-sched card panel"><h2>Coming up</h2><ol class="sched">${(S.schedule || []).slice(0, 6).map(x => `<li><time>${esc(fmtD(x.date))}</time>
    <b>${esc(x.what)}</b><span>${esc(x.then)}</span></li>`).join('') || '<li><span>Nothing dated in the next few weeks.</span></li>'}</ol></section>`;
  const log = `<section class="b2-log card panel"><h2><span class="live"><i></i></span>What the Firm did</h2><ol class="log">${(S.log || []).slice(0, phone ? 10 : 8).map(x => `<li class="k-${esc(x.k || '')}"><time>${esc(hm(x.at))}</time><span>${esc(x.text)}</span></li>`).join('')}</ol></section>`;
  return `${signinWarn(S, { cls: 'sgn-today' })}${awNote()}<div class="bot2">${hero}
    <div class="b2-main">${setupCard()}${ord}${heldCard()}${askCard()}${motion}${briefCard()}${sched}</div>
    <div class="b2-side">${stratCard()}<section class="b2-acct">${acctCard(a)}</section>${firmMini()}${log}</div></div>
  <p class="foot">${byClaude() ? 'The Firm makes every call from the numbers the app gathers and its own research; nothing happens until you OK it.' : 'Every order comes from your own tested rules, checked by the Firm.'} The app never trades or moves money: you place every order at ${esc(BN())} yourself.</p>`;
}
function viewPicks() {
  const all = (S.radar || []).filter(x => x.verdict);
  const buys = all.filter(x => x.verdict === 'Buy'), skips = all.filter(x => x.verdict !== 'Buy').sort((x, y) => (y.confidence || 0) - (x.confidence || 0));
  const size = S.bot && S.bot.size_goal, C = S.claude || {};
  const when = x => x.when === 'now' ? 'In your orders now' : size ? `Buys ~${money(size)} as soon as there's cash` : 'Next, as soon as there is cash';
  if (!buys.length && !skips.length) return '<div class="card empty">Nothing on the bot\'s list right now. It checks again at the next scan.</div>';
  const top = buys[0];
  const hero = top ? `<button class="card pk-top" data-act="stock" data-t="${esc(top.ticker)}">
      <div><div class="lab"><span class="eyebrow live"><i></i>The bot's next buy</span>${vword('Buy')}<span class="tag hz-${top.mode}">${HZ[top.mode]}</span></div>
        <span class="tk">${esc(top.ticker)}</span><div class="nm">${esc(top.name)}</div>
        <p class="call">${esc(top.call || top.headline || '')}</p>${confMeter(top.confidence)}
        ${top.ai && top.ai.summary ? `<div class="nb-ai"><span class="aib">Firm</span><p>${esc(top.ai.summary)}</p></div>` : ''}
        <div class="meta"><span class="chip go"><i></i>${esc(when(top))}</span>${top.earnings ? `<span class="chip"><i></i>Earnings ${esc(fmtD(top.earnings))}</span>` : ''}</div></div>
      <div>${(top.spark || []).length >= 30 ? spark(top.spark, { h: 120 }) : ''}</div></button>`
    : `<div class="card pk-none"><p class="eyebrow">Nothing to buy today</p><h3>No stock clears ${GATE()}% confidence.</h3>
      <p>The bot only says buy when at least ${GATE()}% of the weighted evidence agrees, the research desk's included. The closest is ${esc(skips[0].ticker)} at ${skips[0].confidence}%.</p></div>`;
  const conf = x => isNum(x.confidence) ? `<span class="cf${x.confidence >= GATE() ? ' ok' : ''}">${x.confidence}%</span>` : '';
  const aiTag = x => x.ai ? `<span class="vword ${aiWord(x.ai.verdict)[1]}" title="The research desk's view">Research: ${esc(aiWord(x.ai.verdict)[0])}</span>` : x.ai_waiting ? '<span class="tag t-mut">Research: next</span>' : '';
  const rows = buys.slice(1).map((x, k) => `<button class="pk-row" data-act="stock" data-t="${esc(x.ticker)}"><span class="n">${String(k + 2).padStart(2, '0')}</span>
      <div><div class="t"><b>${esc(x.ticker)}</b>${vword('Buy')}<span class="tag hz-${x.mode}">${HZ[x.mode]}</span>${aiTag(x)}</div><p>${esc(x.call || x.headline || '')}</p></div>
      <div class="px">${conf(x)}${money(x.price, true)}<small>${esc(x.when === 'now' ? 'in your orders' : 'next')}</small></div></button>`).join('');
  const skipRows = skips.map(x => `<button class="pk-row" data-act="stock" data-t="${esc(x.ticker)}"><span class="n">–</span>
      <div><div class="t"><b>${esc(x.ticker)}</b>${vword('Skip')}<span class="tag hz-${x.mode}">${HZ[x.mode]}</span>${aiTag(x)}</div><p>${esc(x.call || x.why_not || '')}</p></div>
      <div class="px">${conf(x)}${money(x.price, true)}</div></button>`).join('');
  return `<div class="pk"><div class="sec-h" style="margin:0"><h2>Picks</h2><span>The bot's buy list, in order</span></div>
    <p class="pk-intro">You don't choose: the bot buys from the top of this list when there's cash. It says buy only when it's ${GATE()}%+ sure, after the research desk has looked at the stock${C.today ? ` (${C.today} researched today)` : ''}.</p>
    ${hero}${rows ? `<div class="card pk-list">${rows}</div>` : ''}
    ${skips.length ? `<div class="sec-h"><h2>Not now</h2><span>${skips.length} the bot looked at, most confident first</span></div><div class="card pk-list">${skipRows}</div>` : ''}</div>`;
}
function bigChart(t, n, p, sp, spd) {
  const C = n.chart || {}, close = C.close || [], dates = C.dates || [], st = n.stats || {};
  const lines = p ? [{ v: p.buy_price, c: 'rgba(255,255,255,.5)', t: 'You paid ' + money(p.buy_price, true) }]
    .concat(p.range ? [{ v: p.range.lo, c: 'var(--stop)', t: p.range.lo_label + ' ' + money(p.range.lo, true) }].concat(p.range.hi_label ? [{ v: p.range.hi, c: 'var(--go)', t: p.range.hi_label + ' ' + money(p.range.hi, true) }] : []) : [])
    : (isNum(st.stop) ? [{ v: st.stop, c: 'var(--stop)', t: 'Stop if bought ' + money(st.stop, true) }] : []);
  if (isNum(st.target)) lines.push({ v: st.target, c: 'var(--cyan)', t: 'Analysts’ target ' + money(st.target, true) });
  if (close.filter(isNum).length < 20) return sp.length > 1 ? stockChart(t, sp, spd, lines, p) : '';
  const dated = dates.length === close.length, day = i => dated ? fmtD(dates[i]) : `${close.length - 1 - i} trading days ago`;
  const s50 = (C.sma50 || []).length === close.length ? C.sma50 : null, s200 = (C.sma200 || []).length === close.length ? C.sma200 : null;
  const series = [{ v: close, c: close[close.length - 1] >= (p ? p.buy_price : close[0]) ? 'var(--go)' : 'var(--stop)' }];
  if (s50) series.push({ v: s50, c: 'var(--amber)' });
  if (s200) series.push({ v: s200, c: 'var(--violet)' });
  const last = close[close.length - 1], back = k => close.length > k && isNum(close[close.length - 1 - k]) ? last / close[close.length - 1 - k] - 1 : null;
  const hi = Math.max(...close.filter(isNum)), lo = Math.min(...close.filter(isNum));
  const chips = [['1 month', back(21)], ['3 months', back(63)], ['6 months', close[0] ? last / close[0] - 1 : null],
    ['vs 50-day avg', s50 && s50[s50.length - 1] ? last / s50[s50.length - 1] - 1 : null], ['vs 200-day avg', s200 && s200[s200.length - 1] ? last / s200[s200.length - 1] - 1 : null],
    ['off its high', hi ? last / hi - 1 : null]].filter(c => isNum(c[1]));
  return `<div class="ch-stats">${chips.map(([k, v]) => `<span><small>${k}</small><b class="${tone(v)}">${pct(v)}</b></span>`).join('')}</div>`
    + chart({ h: phone ? 210 : 260, label: `${t} price, 6 months`, levels: lines, series,
      tip: (i, a) => `<div class="t-d">${esc(day(i))}</div><b class="mono">${money(close[i], true)}</b><div class="t-s">`
        + (p && p.buy_price ? `<span class="${tone(close[i] - p.buy_price)}">${pct(close[i] / p.buy_price - 1)}</span> vs what you paid` : i > a ? `<span class="${tone(close[i] - close[a])}">${pct(close[i] / close[a] - 1)}</span> since ${esc(day(a))}` : 'Start of what’s shown')
        + '</div>' + (s50 && isNum(s50[i]) ? `<div class="t-s"><span style="color:var(--amber)">50-day</span> ${money(s50[i], true)}${s200 && isNum(s200[i]) ? ` · <span style="color:var(--violet)">200-day</span> ${money(s200[i], true)}` : ''}</div>` : ''),
      range: (x, y) => `${esc(dated ? span2(dates[x], dates[y]) : day(x) + ' – ' + day(y))} · <span class="${tone(close[y] - close[x])}">${pct(close[y] / close[x] - 1)}</span>` })
    + `<div class="ch-key"><span><i style="background:${series[0].c}"></i>Price</span>${s50 ? '<span><i class="d" style="border-color:var(--amber)"></i>50-day average</span>' : ''}${s200 ? '<span><i class="d" style="border-color:var(--violet)"></i>200-day average</span>' : ''}
      ${lines.map(l => `<span><i class="d" style="border-color:${l.c}"></i>${esc(l.t)}</span>`).join('')}<span class="dim">6-month range ${money(lo, true)} – ${money(hi, true)}</span></div>${chHint()}`;
}
function confPanel(n) {
  const parts = n.conf_parts || [];
  if (!isNum(n.confidence) || !parts.length) return '';
  const tw = parts.reduce((s, p) => s + p.weight, 0) || 1;
  return `<div class="card sp-box sp-conf"><h3>How sure the bot is</h3>${confMeter(n.confidence, true)}
    <ul class="cp">${parts.slice().sort((a, b) => b.weight - a.weight).map(p => `<li><div class="cp-t"><span>${esc(p.text)}</span><b>${p.score}</b></div>
      <div class="cp-bar"><i style="width:${Math.max(2, p.score)}%"></i></div><small>counts for ${Math.round(100 * p.weight / tw)}%</small></li>`).join('')}
      ${(n.conf_minus || []).map(m => `<li class="minus"><div class="cp-t"><span>${esc(m.text)}</span><b>${m.pts}</b></div></li>`).join('')}</ul>
    <p class="fine">The share of the weighted evidence that says buy, not the chance it goes up. The bot says buy only at ${GATE()}%+, and never before the research desk has looked at it. ${n.ai_waiting ? 'The research desk hasn’t looked at this one yet, so it’s capped below ' + GATE() + '%.' : ''}</p></div>`;
}
function rankPanel(n) {
  const R = n.ranks, P = n.places || {};
  if (!R) return '';
  const of = P.of || '';
  return `<div class="card sp-box sp-rank"><h3>Ranking systems</h3><div class="rk-all"><b>#${P.overall || '–'}</b><span>overall${of ? ` of ${of} stocks the bot is considering` : ''}</span></div>
    <ul class="rk">${SYS.map(([k, label, d]) => isNum(R[k]) ? `<li><span class="rk-n">#${P[k] || '–'}</span><div><div class="rk-t"><b>${label}</b><small>${d}</small></div>
      <div class="cp-bar"><i style="width:${Math.max(2, R[k])}%"></i></div></div></li>`
      : `<li class="na"><span class="rk-n">–</span><div><div class="rk-t"><b>${label}</b><small>${k === 'claude' ? 'not researched yet' : 'no data'}</small></div></div></li>`).join('')}</ul></div>`;
}
function statsPanel(n, price) {
  const st = n.stats || {};
  const P = (v, d = 0) => isNum(v) ? pct(v, d) : null, U = (v, d = 0) => isNum(v) ? pct(v, d, false) : null;
  const X = v => isNum(v) ? v.toFixed(1) : null, M = v => isNum(v) ? bigMoney(v) : null;
  const groups = [
    ['Size and trading', [['Market value', M(st.market_cap)], ['Avg daily volume', isNum(st.avg_volume) ? (st.avg_volume / 1e6).toFixed(1) + 'M shares' : null], ['Beta (vs the market)', isNum(st.beta) ? st.beta.toFixed(2) : null], ['Volatility (a year)', U(st.volatility)]]],
    ['Price vs earnings', [['Next year’s P/E', X(st.forward_pe)], ['Last year’s P/E', X(st.trailing_pe)], ['PEG', isNum(st.peg) ? st.peg.toFixed(2) : null], ['Dividend', isNum(st.dividend_yield) ? (st.dividend_yield > 1 ? st.dividend_yield.toFixed(2) + '%' : pct(st.dividend_yield, 2, false)) : null]]],
    ['The business', [['Sales growth', P(st.revenue_growth)], ['Earnings growth', P(st.earnings_growth)], ['Gross margin', U(st.gross_margin)], ['Profit margin', U(st.profit_margin)],
      ['Return on equity', U(st.roe)], ['Free cash flow', M(st.free_cash_flow)], ['Debt / equity', isNum(st.debt_to_equity) ? (st.debt_to_equity / 100).toFixed(2) + '×' : null], ['Employees', isNum(st.employees) ? Math.round(st.employees).toLocaleString() : null]]],
    ['Who owns it', [['Insiders', U(st.insiders, 1)], ['Institutions', U(st.institutions)], ['Short sellers', U(st.short_float, 1)]]],
    ['How it’s moved', [['1 month', P(st.ret_1m)], ['3 months', P(st.ret_3m)], ['12 months (skip last)', P(st.ret_12_1)], ['Worst drop (a year)', P(st.max_dd_1y)]]]];
  const html = groups.map(([g, rows]) => { const r = rows.filter(x => x[1] != null); return r.length ? `<div class="sg"><h4>${g}</h4>${r.map(([k, v]) => `<div class="sr"><span>${k}</span><b>${esc(v)}</b></div>`).join('')}</div>` : ''; }).join('');
  let an = '';
  if (isNum(st.target)) {
    const lo = Math.min(st.target_low || st.target, price || st.target), hi = Math.max(st.target_high || st.target, price || st.target), x = v => ((v - lo) / (hi - lo || 1) * 100).toFixed(1);
    const key = { strong_buy: 'Strong buy', buy: 'Buy', hold: 'Hold', underperform: 'Underperform', sell: 'Sell', none: '' }[st.rec_key] || '';
    an = `<div class="an"><div class="an-t"><b>Analysts</b><span>${isNum(st.analysts) ? Math.round(st.analysts) + ' analysts' : ''}${key ? ' · rated ' + key : ''}${isNum(st.rec_mean) ? ` (${st.rec_mean.toFixed(1)} on a 1–5 scale, 1 = strong buy)` : ''}</span></div>
      <div class="an-bar">${isNum(st.target_low) && isNum(st.target_high) ? `<span class="rg" style="left:${x(st.target_low)}%;right:${(100 - x(st.target_high)).toFixed(1)}%"></span>` : ''}<span class="avg" style="left:${x(st.target)}%"></span>${isNum(price) ? `<span class="now" style="left:${x(price)}%"></span>` : ''}</div>
      <div class="an-k"><span>Low ${money(st.target_low, true)}</span><span style="color:var(--cyan)">Average ${money(st.target, true)} (${pct(price ? st.target / price - 1 : null)})</span><span>High ${money(st.target_high, true)}</span><span>Now ${money(price, true)}</span></div></div>`;
  }
  if (isNum(st.high_52w) && isNum(st.low_52w) && isNum(price)) {
    const f = Math.max(0, Math.min(100, (price - st.low_52w) / (st.high_52w - st.low_52w || 1) * 100)).toFixed(1);  // a new high pins to the end
    an += `<div class="an"><div class="an-t"><b>52-week range</b><span>${price > st.high_52w ? 'at a new high' : pct(price / st.high_52w - 1) + ' from the high'}</span></div><div class="an-bar"><span class="rg" style="left:0;right:0"></span><span class="now" style="left:${f}%"></span></div>
      <div class="an-k"><span>${money(st.low_52w, true)}</span><span>${money(st.high_52w, true)}</span></div></div>`;
  }
  if (!html && !an) return '';
  return `<div class="card sp-box sp-num"><h3>The numbers${st.industry ? ` · ${esc(st.industry)}` : ''}</h3>${an}<div class="sgs">${html}</div>
    ${st.earnings ? `<p class="fine">${D(st.earnings) < new Date(new Date().setHours(0, 0, 0, 0)) ? 'Last earnings report' : 'Next earnings report'}: <b>${esc(fmtD(st.earnings))}</b></p>` : ''}</div>`;
}
function aiPanel(t, ai, pm) {
  const A = api(), C = S.claude || {}, busy = C.running && (C.doing || []).includes(t);
  const label = busy ? 'The research desk is on it…' : ai && ai.depth === 'deep' ? 'Research it again' : ai ? 'Have the research desk dig deeper' : pm ? 'Get the full written report' : 'Have the research desk look into it';
  const btn = !phone && A ? `<button class="btn${ai || pm ? '' : ' go'}" data-act="deep" data-t="${esc(t)}"${busy ? ' disabled' : ''}>${label}</button>` : '';
  if (!ai && pm) {
    /* The firm already has a call on this stock, so it has been researched: the PM reads the desks' memos and searches
       the web while writing the briefing. Saying "hasn't looked at this one yet" next to a Buy was wrong (Sam, Nov 9).
       What's missing is only the research desk's separate long write-up, which is optional. */
    const B = CL(), team = fzTeam(S, t, 6);
    return `<div class="card sp-ai"><div class="ai-h"><span class="aib">Firm</span><h3>The research behind this call</h3><span class="ai-m">${esc([B.label, B.at ? hm(B.at) : ''].filter(Boolean).join(' · '))}</span></div>
      <p class="ai-pm">The PM researched ${esc(t)} before making this call${B.searches ? `: the briefing used ${B.searches} web search${B.searches === 1 ? '' : 'es'}, on top of the desks’ memos and the app’s own numbers` : ', using the desks’ memos, the web and the app’s own numbers'}. Its reasons and the risk are at the top of this page.</p>
      ${team ? `<div class="ai-team">${team.replace('<small>Your team</small>', '<small>Desks covering it</small>')}</div>` : ''}
      <div class="ai-f">${btn}<span class="fine">${busy ? 'The research desk is writing it now: results, analysts, news, insiders and risks. This page updates by itself.' : 'Optional. A longer write-up from the research desk: results, analysts, insiders, news and risks. It writes one by itself for anything the firm wants to buy, at its next run.'}</span></div></div>`;
  }
  if (!ai) return `<div class="card sp-ai"><h3>The research desk’s report</h3><p class="dim" style="margin:0 0 14px">${busy ? 'The research desk is on it right now: results, analysts, news, insiders and risks. This page updates by itself.' : 'The firm has no call on this one, so there’s no report yet. The research desk writes one for the firm’s picks and for what you own after each scan.'}</p>${btn}</div>`;
  const w = aiWord(ai.verdict), an = ai.analysts || {};
  const li = arr => (arr || []).map(x => `<li>${esc(x)}</li>`).join('');
  const row = (k, v) => v ? `<div class="ai-r"><h4>${k}</h4><p>${esc(v)}</p></div>` : '';
  const anTxt = [an.count ? `${an.count} analysts` : '', (an.buy || an.hold || an.sell) ? `${an.buy || 0} buy · ${an.hold || 0} hold · ${an.sell || 0} sell` : '',
    isNum(an.target_avg) ? `average target ${money(an.target_avg, true)}` : '', isNum(an.target_low) && isNum(an.target_high) ? `range ${money(an.target_low, true)}–${money(an.target_high, true)}` : ''].filter(Boolean).join(' · ');
  return `<div class="card sp-ai"><div class="ai-h"><span class="aib">Firm</span><h3>The research desk’s report</h3><span class="ai-m">${esc(aiMeta(ai))}</span></div>
    <div class="ai-v"><small>The research desk says</small><span class="vword ${w[1]}">${esc(w[0])}</span><p>${esc(ai.summary || '')}</p>${ai.timing ? `<p class="tm"><b>When:</b> ${esc(ai.timing)}</p>` : ''}</div>
    ${(ai.red_flags || []).length ? `<div class="ai-flag"><b>Red flags</b><ul>${li(ai.red_flags)}</ul></div>` : ''}
    <div class="bb">${(ai.bull || []).length ? `<ul class="bull">${li(ai.bull)}</ul>` : ''}${(ai.bear || []).length ? `<ul class="bear">${li(ai.bear)}</ul>` : ''}</div>
    ${row('Latest results', ai.results)}
    ${anTxt || (an.recent || []).length ? `<div class="ai-r"><h4>Analysts</h4>${anTxt ? `<p>${esc(anTxt)}</p>` : ''}${(an.recent || []).length ? `<ul class="plain">${li(an.recent)}</ul>` : ''}</div>` : ''}
    ${row('Insiders', ai.insiders)}${row('Competitors', ai.competitors)}${row('Valuation', ai.valuation)}
    ${(ai.news || []).length ? `<div class="ai-r"><h4>News</h4><ul class="news">${ai.news.map(x => `<li class="${esc(x.tone || '')}"><i></i><span>${esc(x.headline)}</span>${x.date ? `<time>${esc(x.date)}</time>` : ''}</li>`).join('')}</ul></div>` : ''}
    ${(ai.catalysts || []).length ? `<div class="ai-r"><h4>Coming up</h4><ul class="plain">${ai.catalysts.map(x => `<li>${x.date ? `<b>${esc(x.date)}</b> ` : ''}${esc(x.what)}</li>`).join('')}</ul></div>` : ''}
    ${(ai.checked || []).length ? `<div class="ai-r"><h4>What the research desk checked</h4><div class="chk">${ai.checked.map(x => `<span>✓ ${esc(x)}</span>`).join('')}</div></div>` : ''}
    ${(ai.sources || []).length ? `<div class="ai-r"><h4>Sources</h4><div class="srcs">${ai.sources.map(srcLink).join('')}</div></div>` : ''}
    <div class="ai-f">${btn}<span class="fine">The research desk reads the web for this; it feeds the PM’s briefing, where the calls are made.</span></div></div>`;
}
/* how the bot got its one answer on a stock you own: the rules are the guideline, Claude's research makes the call (final.py) */
function howPanel(p) {
  const ru = p.rules || {}, c = p.claude, sell = p.verdict === 'Sell';
  if (p.mode === 'long') return '';
  const cw = !c ? (p.researching ? 'Researching it now…' : 'Not researched yet') : aiWord(c.verdict)[0];
  return `<div class="card sp-box how"><h3>How the bot decided</h3><ol>
    <li><small>1 · Your rules</small><b class="${ru.say === 'sell' ? 'neg' : ''}">${ru.say === 'sell' ? 'Time to sell?' : 'On plan'}</b><span>${esc(ru.say === 'sell' ? cap(ru.why || '') : 'Nothing in them says sell.')}</span></li>
    <li><small>2 · The research desk${c && c.depth === 'deep' ? ' (deep)' : ''}</small><b>${esc(cw)}</b><span>${esc(c ? (c.summary || '') + (c.at ? ' · ' + fmtD(c.at) : '') : ru.say === 'sell' ? 'The research desk digs into it before the firm can say sell.' : 'The research desk checks what you own every 2 days.')}</span></li>
    <li class="ans"><small>3 · The bot’s answer</small>${vword(p.verdict || 'Keep')}<span>${esc(sell ? 'Both point the same way, or a hard rule (the stop) says so.' : ru.say === 'sell' ? 'The rules are only a guideline: the research desk has the final say.' : 'Nothing says sell.')}</span></li></ol></div>`;
}
function viewStock() {
  const t = ui.stock, n = ui.stockNote || S.notes[t] || {};
  const p = (S.positions || []).find(x => x.ticker === t), r = (S.radar || []).find(x => x.ticker === t);
  // v4: Claude's view first: its call on what you own, its watchlist, then its research; the old rules' words only as a last resort
  const wl = ((S.analyst || {}).watchlist || []).find(x => String(x.ticker || '').toUpperCase() === t);
  const ai0 = n.ai || (r && r.ai) || (p && p.ai) || null;
  let verdict = (p && p.verdict) || n.verdict || (r && r.verdict) || '';
  let call = (p && p.call) || n.call || (r && r.call) || n.headline || '';
  const mine = (S.orders || []).filter(o => o.by === 'claude' && String(o.ticker || '').toUpperCase() === t);
  const ord = mine.find(o => ['buy', 'sell', 'trim'].includes(o.kind)) || mine[0] || null;  // the PM's order on it, if one is waiting on Today
  if (!p && ord && ord.kind === 'buy') { verdict = 'Buy'; call = ord.why || call; }
  else if (!p && wl) { verdict = 'Watch'; call = `The firm is watching it: ${wl.why} Buys if: ${wl.buy_if}`; }
  else if (!p && ai0 && ai0.verdict) { verdict = aiWord(ai0.verdict)[0]; call = bzSentences(ai0.summary, 2)[0] || call; }
  else if (!p && /needs \d+%|% sure and needs/.test(call)) { verdict = ''; call = 'The firm has no call on this one yet. Press “Have the research desk look into it” below.'; }
  const price = p ? p.price : (r ? r.price : n.price), day = p ? p.day : (r ? r.day : n.day);
  const mode = (p || r || n).mode, ai = n.ai || (r && r.ai) || (p && p.ai) || null;
  const conf = isNum(n.confidence) ? n.confidence : r && r.confidence;
  const sp = (p && p.spark) || (r && r.spark) || n.spark || [], spd = (p && p.spark_d) || (r && r.spark_d) || n.spark_d || [];
  let good = (n.bull || []).filter(x => !/^#\d/.test(x) && !isOdds(x)).slice(0, 4), bad = (n.bear || []).filter(x => !isOdds(x)).slice(0, 4);
  if (ai && !good.length) good = (ai.bull || []).slice(0, 3);
  if (ai && !bad.length) bad = (ai.red_flags || []).concat(ai.bear || []).slice(0, 3);
  const ifs = p ? (p.ifs || []).slice(0, 4) : [];
  const pmCall = (p && p.by === 'claude') || !!ord || (!p && !!wl);  // the PM has already made a call on this stock
  const list = arr => arr.length ? `<ul>${arr.map(x => `<li>${esc(x)}</li>`).join('')}</ul>` : '<p class="dim" style="margin:0;font-size:13.5px">Nothing stands out.</p>';
  const stats = p ? `<div class="sp-stats"><div class="card kpi"><small>You own</small><b>${esc(String(p.shares))}</b><span>shares at ${money(p.buy_price, true)}</span></div>
      <div class="card kpi"><small>Worth</small><b>${money(p.value)}</b><span>${esc(p.days != null ? 'day ' + p.days : '')}</span></div>
      <div class="card kpi"><small>Profit / loss</small><b class="${tone(p.gain_usd)}">${signed(p.gain_usd)}</b><span>${pct(p.gain)}</span></div>
      <div class="card kpi"><small>Plan</small><b style="font-size:15px;line-height:1.3">${esc(p.plan || p.state || '')}</b></div></div>` : '';
  const hist = (n.history || []).slice(0, 10).map(h => `<li><span class="mono">${esc(fmtD(h.at))}</span><span class="mono">${esc(h.verdict || '')}</span><span>${esc(noOdds(h.change))}</span></li>`).join('');
  const aiv = '';
  const notes = `<div class="card sp-box sp-notes"><h3>Notes</h3>${n.thesis ? `<p>${esc(n.thesis)}</p>` : ''}
    ${!p && (n.plan || []).length ? `<h4>The plan</h4><ul class="plan">${n.plan.map(x => `<li>${esc(x)}</li>`).join('')}</ul>` : ''}
    ${(n.catalysts || []).length ? `<h4>Coming up</h4><ul class="plan">${n.catalysts.map(x => `<li>${esc(x)}</li>`).join('')}</ul>` : ''}
    ${(n.risks || []).length ? `<h4>Risks</h4><ul class="plan">${n.risks.map(x => `<li>${esc(x)}</li>`).join('')}</ul>` : ''}
    ${hist ? `<h4>${pmCall ? 'The screening rules over time' : 'Its call over time'}</h4>${pmCall ? '<p class="dim" style="font-size:12px;margin:-4px 0 8px">Only a hint: the PM’s call at the top is the one that counts.</p>' : ''}<ul class="hist2">${hist}</ul>` : ''}
    ${n.about ? `<h4>The company</h4><p class="dim" style="font-size:13px">${esc(n.about)}</p>` : ''}</div>`;
  return `<div class="sp-page"><button class="sp-back" data-act="backview">‹ Back</button>
    <div class="sp-head"><div><h1>${esc(t)}</h1><div class="nm">${esc(n.name || (p && p.name) || (r && r.name) || '')}${n.sector ? ' · ' + esc(n.sector) : ''}</div>
      <div style="display:flex;gap:6px;margin-top:10px;flex-wrap:wrap">${mode && HZ[mode] ? `<span class="tag hz-${mode}">${HZ[mode]}</span>` : ''}${p ? '<span class="tag t-mut">You own it</span>' : ''}</div></div>
      <div class="px">${money(price, true)}<small class="${tone(day)}">${isNum(day) ? pct(day, 2) + ' today' : ''}</small></div></div>
    <div class="card sp-verdict">${vword(verdict, true)}<div class="sv-r"><p class="call">${esc(call || (ai && ai.summary) || 'The firm has no call on this one yet.')}</p>${pmCall ? `<p class="dim" style="font-size:12.5px;margin:6px 0 0">The PM’s call from the latest briefing${ord && isNum(ord.confidence) ? ` · ${ord.confidence}% sure` : ''}${ord ? ` · <button class="lnk" data-view="bot">${esc(ord.title || 'the order')} is on Today</button>` : ''}</p>` : ''}
      ${ord && ord.risk ? `<p class="sv-risk"><b>⚠ Risk</b> ${esc(ord.risk)}</p>` : ''}</div></div>
    ${stats}
    <div class="sp-grid"><div class="sp-l">
      <div class="card sp-chart">${bigChart(t, n, p, sp, spd)}</div>
      <div class="sp-cols">${p && ifs.length ? `<div class="card sp-box next"><h3>What happens next</h3><ul>${ifs.map(x => `<li><b>${esc(x[0])}</b> → ${esc(x[1])}</li>`).join('')}</ul></div>`
        : `<div class="card sp-box good"><h3>Why</h3>${list(good)}</div>`}
        <div class="card sp-box bad"><h3>Watch out for</h3>${list(bad)}</div></div>
      ${aiPanel(t, ai, pmCall)}
    </div><div class="sp-r">${statsPanel(n, price)}${notes}</div></div></div>`;
}
function acctCard(a) {
  const pts = a.points || [];
  const base = pts.length ? pts[0] : null;
  let dep = 0;
  const me = [], spy = [];
  pts.forEach((p, i) => { if (i) dep += p[3] || 0; me.push(p[1] - (base ? base[1] : 0) - dep); spy.push((p[2] || 0) - (base ? base[2] || base[1] : 0) - dep); });
  return `<div class="card acct"><small>Your account</small><div class="big"><b>${money(a.total, true)}</b>
    <span class="${tone(a.day)}">${isNum(a.day) ? signed(a.day, true) + ' ' + pct(a.day_pct, 2) : ''}</span></div>
    <div class="vs"><span>Since ${esc(a.since ? fmtD(a.since) : '–')}: <b class="${tone(a.ret)}">${pct(a.ret)}</b></span><span>S&amp;P <b class="${tone(a.spy_ret)}">${pct(a.spy_ret)}</b></span>
    <span>Cash <b>${money(a.cash)}</b></span></div>
    ${me.length > 1 ? chart({ h: phone ? 118 : 96, zero: true, label: 'Your account compared with the same money in the S&P 500',
      series: [{ v: me, c: me[me.length - 1] >= 0 ? 'var(--go)' : 'var(--stop)' }, { v: spy, c: 'var(--dim)' }],
      tip: i => `<div class="t-d">${esc(fmtD(pts[i][0]))}</div><b class="mono">${money(pts[i][1], true)}</b>`
        + `<div class="t-s"><span class="${tone(me[i])}">You ${signed(me[i], true)}</span> · S&amp;P ${signed(spy[i], true)}</div>`
        + (i && pts[i][3] ? `<div class="t-s dim">+${money(pts[i][3])} from the bank (not a gain)</div>` : ''),
      range: (x, y) => `${esc(span2(pts[x][0], pts[y][0]))} · <span class="${tone(me[y] - me[x])}">you ${signed(me[y] - me[x], false)}</span>`
        + ` · S&amp;P ${signed(spy[y] - spy[x], false)}` }) : ''}
    <div class="vs" style="margin-top:6px"><span><i style="display:inline-block;width:10px;height:2px;background:var(--go);vertical-align:3px"></i> You</span>
      <span><i style="display:inline-block;width:10px;height:0;border-top:1.5px dashed var(--dim);vertical-align:3px"></i> Same money in the S&amp;P 500</span></div>
    ${me.length > 1 ? chHint() : ''}</div>`;
}
function orderLine(o) {
  if (typeof o === 'string') return o;
  const k = (o.kind || '').toUpperCase(), sh = isNum(+o.shares) && +o.shares ? `${+o.shares} ` : '';
  if (o.kind === 'protect') return `STOP ${o.ticker} · sell at ${money(o.stop, true)}${o.target ? ' or ' + money(o.target, true) : ''} (GTC)`;
  return `${k} ${sh}${o.ticker} · ${o.order === 'limit' ? 'LIMIT ' + money(o.price, true) : 'MARKET'}${o.stop ? ' · STOP ' + money(o.stop, true) : ''}${o.target ? ' · TARGET ' + money(o.target, true) : ''}`;
}
function tkChart(a) {
  const t = String(a.ticker || ''); if (!t || t.includes(',')) return '';
  const sp = sparkOf(t); if (!sp) return '';
  const lines = [], p = (S.positions || []).find(x => x.ticker === t);
  (a.orders || []).forEach(o => {
    if (o && typeof o === 'object') {
      if (o.order === 'limit' && isNum(+o.price) && +o.price) lines.push({ v: +o.price, c: '#56cbff', t: (o.kind === 'cancel' ? 'your limit ' : 'limit ') + money(+o.price, true) });
      if (isNum(+o.stop) && +o.stop) lines.push({ v: +o.stop, c: '#ff5f6e', t: 'stop ' + money(+o.stop, true) });
    }
  });
  if (p && a.kind === 'sell') lines.push({ v: p.buy_price, c: 'rgba(255,255,255,.55)', t: 'paid ' + money(p.buy_price, true) });
  return `<div class="tk-chart">${spark(sp, { h: 76, lines })}<small>${esc(t)} · last ${Math.round(sp.length / 21)} months</small></div>`;
}
/* ---------------- v1.2: placing an order ----------------
   Whoever owns this copy places the orders, at whatever broker they use. Each order card opens a box with the order
   written the way a trading desk would write it (to copy, or to hand to whoever places it) and the same order as steps
   for the owner's own broker. BROKERS holds each broker's own names for the fields; add one by adding an entry.
   The box never places anything: it ends with "I placed it", which files the order under In motion. */
const BROKERS = {
  schwab: { name: 'Schwab', where: 'schwab.com or the Schwab app',
    open: 'Open <b>Trade</b>. On schwab.com it’s Trade → Stocks &amp; ETFs.',
    f: { sym: 'Symbol', act: 'Action', qty: 'Quantity', type: 'Order Type', lim: 'Limit Price', stop: 'Stop Price', tif: 'Timing' },
    t: { market: 'Market', limit: 'Limit', stop: 'Stop' }, d: { day: 'Day', gtc: 'GTC (good till canceled)' },
    send: 'Press <b>Review Order</b>, read it over, then <b>Place Order</b>.',
    status: 'Trade → Order Status' },
  fidelity: { name: 'Fidelity', where: 'fidelity.com or the Fidelity app',
    open: 'Open <b>Trade</b> and pick the account.',
    f: { sym: 'Symbol', act: 'Action', qty: 'Quantity', type: 'Order Type', lim: 'Limit Price', stop: 'Stop Price', tif: 'Time in Force' },
    t: { market: 'Market', limit: 'Limit', stop: 'Stop Loss' }, d: { day: 'Day', gtc: 'Good ’til Canceled' },
    send: 'Press <b>Preview Order</b>, read it over, then <b>Place Order</b>.',
    status: 'Accounts &amp; Trade → Activity &amp; Orders' },
  robinhood: { name: 'Robinhood', where: 'the Robinhood app or robinhood.com',
    open: 'Search for the stock and open its page. Press <b>Trade</b>.',
    f: { sym: '', act: '', qty: 'Shares', type: 'Order type', lim: 'Limit price', stop: 'Stop price', tif: 'Time in force' },
    t: { market: 'Market order', limit: 'Limit order', stop: 'Stop order' }, d: { day: 'Good for day', gtc: 'Good till canceled' },
    stopNote: 'On a sale the app may call it a stop loss order.',
    qtyNote: 'Make sure it’s set to shares, not dollars.',
    send: 'Press <b>Review</b>, read it over, then swipe up (or press <b>Submit</b>) to send it.',
    status: 'the stock’s page, under your pending orders' },
  vanguard: { name: 'Vanguard', where: 'vanguard.com or the Vanguard app',
    open: 'Open <b>Transact</b> → <b>Buy &amp; sell</b> → Trade ETFs or stocks, and pick the account.',
    f: { sym: 'Symbol', act: 'Transaction type', qty: 'Shares', type: 'Order type', lim: 'Limit price', stop: 'Stop price', tif: 'Duration' },
    t: { market: 'Market', limit: 'Limit', stop: 'Stop' }, d: { day: 'Day', gtc: '60-day (GTC)' },
    send: 'Press <b>Preview order</b>, read it over, then <b>Submit order</b>.',
    status: 'Activity → Order status' },
  etrade: { name: 'E*TRADE', where: 'etrade.com or the E*TRADE app',
    open: 'Open <b>Trading</b> → <b>Stocks/ETFs</b>.',
    f: { sym: 'Symbol', act: 'Action', qty: 'Quantity', type: 'Price type', lim: 'Limit price', stop: 'Stop price', tif: 'Duration' },
    t: { market: 'Market', limit: 'Limit', stop: 'Stop on quote' }, d: { day: 'Good for day', gtc: 'Good until canceled (60 days)' },
    send: 'Press <b>Preview order</b>, read it over, then <b>Place order</b>.',
    status: 'Accounts → Orders' },
  webull: { name: 'Webull', where: 'the Webull app',
    open: 'Search for the stock and open its page. Press <b>Trade</b>.',
    f: { sym: '', act: '', qty: 'Quantity', type: 'Order Type', lim: 'Limit Price', stop: 'Stop Price', tif: 'Time-in-Force' },
    t: { market: 'Market', limit: 'Limit', stop: 'Stop' }, d: { day: 'Day', gtc: 'GTC' },
    send: 'Press the <b>Buy</b> or <b>Sell</b> button at the bottom, read it over, then confirm.',
    status: 'your account’s Orders list' },
  other: { name: 'your broker', label: 'Another broker', where: 'your broker’s website or app',
    open: 'Open the screen for trading stocks. It’s usually called <b>Trade</b>.',
    f: { sym: 'Symbol', act: 'Action', qty: 'Quantity', type: 'Order type', lim: 'Limit price', stop: 'Stop price', tif: 'Duration' },
    t: { market: 'Market', limit: 'Limit', stop: 'Stop' }, d: { day: 'Day', gtc: 'Good till canceled (GTC)' },
    send: 'Preview the order, read it over, then place it.',
    status: 'your list of open orders' },
};
const BROKER_KEYS = Object.keys(BROKERS);
function brokerKey() {  // this copy's broker: the one picked in a box (or in the setup guide), else the one the page came with
  let k = ui.broker || '';
  if (!k) { try { k = localStorage.getItem('ct-broker') || ''; } catch (e) { k = ''; } }
  if (!BROKERS[k]) k = BROKERS[S.broker] ? S.broker : '';
  return k;
}
const BK = () => BROKERS[brokerKey()] || BROKERS.other;
const BA = () => brokerKey() && brokerKey() !== 'other' ? `your ${BK().name} account` : 'your brokerage account';
const brokerPick = attr => `<div class="pl-pick" role="radiogroup" aria-label="Your broker">${BROKER_KEYS.map(x => `<button role="radio" aria-checked="${x === brokerKey()}" class="${x === brokerKey() ? 'on' : ''}" ${attr} data-b="${x}">${esc(BROKERS[x].label || BROKERS[x].name)}</button>`).join('')}</div>`;
const BN = () => brokerKey() && brokerKey() !== 'other' ? BK().name : 'your broker';  // "Schwab", or "your broker" until one is picked
function brokerSet(k) {
  if (!BROKERS[k]) return;
  ui.broker = k; S.broker = k;
  try { localStorage.setItem('ct-broker', k); } catch (e) { /* private mode: it lasts until the page reloads */ }
  const A = api(); if (A && A.set_broker) A.set_broker(k);  // the Mac remembers it for every screen (and the phone app)
}
const shWord = n => `${+n} share${+n === 1 ? '' : 's'}`;
function heldShares(t) { const p = (S.positions || []).find(x => x.ticker === t); return p ? +p.shares || 0 : 0; }
/* One order as the legs someone types into a trade ticket. A buy with a stop is two legs: the buy, then the stop. */
function placeLegs(o) {
  if (!o || typeof o === 'string') return [];
  const t = String(o.ticker || '').toUpperCase(), sh = +o.shares || 0, legs = [];
  if (o.kind === 'cancel') return [{ cancel: true, t, sh, lim: o.order === 'limit' && +o.price ? +o.price : 0 }];
  if (o.kind === 'protect') {
    const n = sh || heldShares(t);
    return [{ act: 'Sell', t, sh: n, all: true, type: 'stop', stop: +o.stop || 0, tif: 'gtc', target: +o.target || 0, replace: true }];
  }
  const sell = o.kind === 'sell', whole = sell && sh >= heldShares(t) && heldShares(t) > 0;
  legs.push({ act: sell ? 'Sell' : 'Buy', t, sh, all: whole, type: o.order === 'limit' && +o.price ? 'limit' : 'market', lim: +o.price || 0, tif: 'day', first: sell });
  if (!sell && +o.stop) legs.push({ act: 'Sell', t, sh, type: 'stop', stop: +o.stop, tif: 'gtc', target: +o.target || 0, after: true });
  return legs;
}
const legsOf = a => (a.orders || []).reduce((all, o) => all.concat(placeLegs(o)), []);
/* The order in a trading desk's words: what the Copy button copies, and what the box shows. Plain text. */
function legText(l) {
  if (l.cancel) return `CANCEL the open order to buy ${shWord(l.sh)} of ${l.t}${l.lim ? ` (limit ${money(l.lim, true)})` : ''}`;
  const head = `${l.after ? 'THEN, once it fills: ' : ''}${l.act.toUpperCase()} ${l.all && l.act === 'Sell' && !l.after && l.type !== 'stop' ? 'all ' : ''}${l.sh ? shWord(l.sh) + ' of ' : ''}${l.t}`;
  const type = l.type === 'limit' ? `Limit order at ${money(l.lim, true)} or ${l.act === 'Buy' ? 'lower' : 'higher'}` : l.type === 'stop' ? `Stop order at ${money(l.stop, true)}` : 'Market order';
  const dur = l.tif === 'gtc' ? 'Good till canceled (GTC)' : 'Day order';
  const extra = [];
  if (l.target) extra.push(`If your broker can pair it (a bracket or OCO order): also sell at a limit of ${money(l.target, true)}, whichever comes first`);
  if (l.first) extra.push(`If ${l.t} has a stop order on it, cancel that first`);
  if (l.replace) extra.push(`If ${l.t} already has a stop order, this one replaces it`);
  return [head, `${type} · ${dur}`].concat(extra).join('\n');
}
const placeText = a => legsOf(a).map(legText).join('\n\n');
/* The same legs as steps in one broker's own words. Returns HTML (every value is escaped or a number). */
function legSteps(l, b) {
  const q = s => s ? `<b>${s}</b>` : '', f = b.f, v = s => `<b class="v">${s}</b>`;
  if (l.cancel) return [`Open ${q(b.status)}.`, `Find the open order to buy ${shWord(l.sh)} of <b>${esc(l.t)}</b>${l.lim ? ` (limit ${money(l.lim, true)})` : ''}.`, 'Press <b>Cancel</b> and confirm.'];
  const out = [];
  if (l.first) out.push(`First look at ${q(b.status)}. If ${esc(l.t)} has a stop order on it, cancel that.`);
  if (l.replace) out.push(`First look at ${q(b.status)}. If ${esc(l.t)} already has a stop order, cancel that one.`);
  out.push(b.open);
  if (f.sym) out.push(`${q(f.sym)}: type ${v(esc(l.t))}`);
  out.push(f.act ? `${q(f.act)}: choose ${v(l.act)}` : `Choose ${v(l.act)}`);
  out.push(`${q(f.qty)}: ${l.sh ? v(+l.sh) : 'all your shares'}${l.all && l.sh ? ' (all of them)' : ''}${b.qtyNote ? '. ' + b.qtyNote : ''}`);
  if (l.type === 'limit') out.push(`${q(f.type)}: choose ${v(b.t.limit)} &nbsp;${q(f.lim)}: ${v(money(l.lim, true))}`);
  else if (l.type === 'stop') out.push(`${q(f.type)}: choose ${v(b.t.stop)} &nbsp;${q(f.stop)}: ${v(money(l.stop, true))}${b.stopNote ? '<br>' + b.stopNote : ''}`);
  else out.push(`${q(f.type)}: choose ${v(b.t.market)}`);
  out.push(`${q(f.tif)}: choose ${v(l.tif === 'gtc' ? b.d.gtc : b.d.day)}${l.tif === 'gtc' ? '<br>That keeps it on until it sells or you cancel it.' : ''}`);
  out.push(b.send);
  if (l.target) out.push(`Optional: the plan also takes the gain at ${v(money(l.target, true))}. If ${esc(b.name)} lets you pair the stop with a limit sale (an OCO or bracket order), add it. If not, the stop alone is fine.`);
  return out;
}
function placeBox(a, i) {
  const k = brokerKey(), b = BK(), legs = legsOf(a), open = ui.steps !== false;
  if (!legs.length) return '';
  const pick = brokerPick('data-act="broker"');
  const order = legs.map(l => `<div class="pl-leg${l.after ? ' then' : ''}">${legText(l).split('\n').map((s, n) => `<span class="${n === 0 ? 'h' : n === 1 ? 't' : 'x'}">${esc(s)}</span>`).join('')}</div>`).join('');
  const steps = legs.map((l, n) => `${legs.length > 1 ? `<h5>${l.after ? 'Then, once it fills: the stop' : l.cancel ? 'Cancel the order' : 'The ' + l.act.toLowerCase()}</h5>` : ''}<ol>${legSteps(l, b).map(s => `<li><span>${s}</span></li>`).join('')}</ol>`).join('');
  const done = a.kind === 'cancel' ? 'I canceled it' : a.kind === 'stop' ? 'I set it' : (a.orders || []).length > 1 ? 'I placed them' : 'I placed it';
  const after = a.kind === 'cancel' ? `Press it once the order is canceled at ${esc(BN())}. The app stops counting on it and frees the money.`
    : a.kind === 'stop' ? `Press it once the stop is in at ${esc(BN())}. The app watches it from there.`
      : `Press it once the order is in at ${esc(BN())}. The app follows it from there and tells you when it fills.`;
  return `<div class="place" data-i="${i}">
    <div class="pl-top"><b>Where do you trade?</b>${pick}</div>
    <div class="pl-cols${open ? '' : ' shut'}">
      <div class="pl-order"><small>The order</small>${order}
        <button class="btn" data-act="plcopy" data-i="${i}">Copy the order</button>
        <p class="pl-fine">Paste it anywhere: a note to yourself, or a message to whoever places your trades.</p></div>
      <div class="pl-how"><button class="pl-fold" data-act="plsteps" aria-expanded="${open}"><span>Step by step ${k ? 'in ' + esc(k === 'other' ? 'any broker' : b.name) : ''}</span><i>${open ? 'Hide' : 'Show me how'}</i></button>
        ${open ? `<div class="pl-steps">${k ? '' : '<p class="pl-fine">Pick your broker above and these steps use its own words.</p>'}${steps}<p class="pl-fine">Done on ${b.where}. Brokers rename things now and then: if a name doesn’t match, the order as written here is what counts.</p></div>` : ''}</div>
    </div>
    ${phone ? `<p class="pl-fine pl-end">When it’s done, press “${done}” in the Mac app, so the app follows it from there.</p>`
      : `<div class="pl-end"><button class="btn go" data-act="send" data-i="${i}">${done}</button><span>${after}</span></div>`}
  </div>`;
}
const placeLabel = a => a.kind === 'cancel' ? 'Cancel it' : a.kind === 'stop' ? 'Set it' : a.kind === 'sell' || a.kind === 'decide' ? 'Sell it' : 'Place it';
function placeToggle(i, on) {
  const tk = $(`.ticket[data-i="${i}"]`), a = S.orders[+i]; if (!tk || !a) return;
  const box = $('.placebox', tk); if (!box) return;
  const show = on != null ? on : !box.innerHTML;
  sentMark(a.id, show ? 1 : 0);
  box.innerHTML = show ? placeBox(a, i) : '';
  const btn = $('[data-act="place"]', tk); if (btn) btn.setAttribute('aria-expanded', show);
}
function placeRedraw() { $$('.ticket').forEach(tk => { const box = $('.placebox', tk), a = S.orders[+tk.dataset.i]; if (box && box.innerHTML && a) box.innerHTML = placeBox(a, tk.dataset.i); }); }
function copyOut(text, said) {
  const A = api(), ok = () => toast(said || 'Copied'), no = () => toast('Couldn’t copy here. Select the text and copy it yourself.', 6000);
  if (A && A.copy_text) Promise.resolve(A.copy_text(text)).then(ok, no); else if (navigator.clipboard) navigator.clipboard.writeText(text).then(ok, no); else no();
}
/* v1.2: the phone's shell (mirror/app.js) draws its own order cards and borrows the directions box from here. A card
   there carries its orders' numbers as `place`; `st` is the phone's copy of the state (what is owned, the broker). */
function placeWith(st, fn) { const s0 = S, p0 = phone; S = st || S || {}; phone = true; try { return fn(); } finally { S = s0; phone = p0; } }
const PLACE = {
  label: (a, st) => placeWith(st, () => (legsOf({ orders: a.place || [] }).length ? placeLabel(a) : '')),
  box: (a, i, st) => placeWith(st, () => placeBox(Object.assign({}, a, { orders: a.place || [] }), i)),
  act(el, a, st) {  // a tap inside a box; true when the open boxes need drawing again
    const act = el.dataset.act;
    if (act === 'broker') { placeWith(st, () => brokerSet(el.dataset.b)); return true; }
    if (act === 'plsteps') { ui.steps = ui.steps === false; try { localStorage.setItem('ct-steps', ui.steps ? '1' : '0'); } catch (e) { /* it lasts until the page reloads */ } return true; }
    if (act === 'plcopy' && a) placeWith(st, () => copyOut(placeText({ orders: a.place || [] }), 'The order is copied'));
    return false;
  },
};
function ticket(a, i) {
  const k = a.kind, note = a.ticker && !a.ticker.includes(',') && S.notes[a.ticker];
  const checks = (a.checks || []).map(c => `<li class="${c[0] === true ? 'ok' : c[0] === false ? 'no' : 'na'}"><i>${c[0] === true ? '✓' : c[0] === false ? '✗' : '·'}</i>${esc(c[1])}</li>`).join('');
  const review = a.passed != null && checks ? `<div class="review ${a.passed ? '' : 'no'}"><b>${a.passed ? 'The bot checked the numbers: nothing says sell' : 'The bot checked the numbers: something looks wrong'}</b><ul class="ck">${checks}</ul></div>` : '';
  const learned = a.learned ? `<div class="learned">${a.learned.split('; ').map(x => `<span>${esc(x)}</span>`).join('')}</div>` : '';
  let acts = '';
  const canPlace = !a.motion && legsOf(a).length > 0, placing = canPlace && sentStep(a.id);
  if (phone) {
    acts = canPlace ? `<button class="btn go" data-act="place" data-i="${i}" aria-expanded="${placing}">${placeLabel(a)}</button>` : '';
  } else if (a.motion) {
    acts = motionBtns(a.motion);
  } else {
    acts = (a.buttons || []).map(b => {
      const [label, kind, val, style] = b, cls = style === 'primary' ? (k === 'sell' && kind === 'dad' ? 'btn stop' : 'btn go') : 'btn';
      if (kind === 'dad') return canPlace ? `<button class="${cls}" data-act="place" data-i="${i}" aria-expanded="${placing}">${placeLabel(a)}</button>` : '';
      if (kind === 'keep') return `<button class="${cls}" data-act="keep" data-t="${esc(val)}" data-px="${a.price || 0}">${esc(label)}</button>`;
      if (kind === 'bank') return `<button class="${cls}" data-act="bank" data-amt="${esc(val)}">${esc(label)}</button>`;
      if (kind === 'sync') return `<button class="${cls}" data-act="settings">${esc(label)}</button>`;
      if (kind === 'position') return `<button class="${cls}" data-act="stock" data-t="${esc(val)}">${esc(label)}</button>`;
      return '';
    }).join('');
    if (!['confirm', 'fix'].includes(k)) acts += `<span class="sp"></span><button class="btn quiet" data-act="replyopen" data-i="${i}">Reply to the PM</button>`;
  }
  const details = note ? `<button class="btn quiet" data-act="stock" data-t="${esc(a.ticker)}">Details</button>` : '';
  const L = a.legs || [];
  const legs = L.length > 1 ? `<div class="legs">${L.map(l => `<button class="leg${l.leftover ? ' lo' : ''}" data-act="stock" data-t="${esc(l.ticker)}"><span>${l.leftover ? 'With what’s left' : 'Buy'}</span>`
    + `<b>${esc(String(l.shares))} ${esc(l.ticker)}</b><em>${money(l.cost)}</em></button>`).join('')}</div>` : '';
  const sure = '';  // v5.3: every order is Claude's call, so no tag says so (and no "58% sure": the app decides)
  const risk = a.risk ? `<div class="risk"><b>⚠ Risk</b><span>${esc(a.risk)}</span></div>` : '';
  return `<article class="card ticket${a.urgency >= 2 ? ' quiet' : ''}" data-i="${i}" data-aid="${esc(a.id)}" style="--c:${STRIP[k] || 'var(--go)'}"><span class="strip"></span><div class="body">
    <div class="tk-top"><span class="n">${String(i + 1).padStart(2, '0')}</span><span class="tag ${KIND[k] || 't-go'}">${esc(a.verb || k)}</span><h3>${esc(a.title)}</h3>${sure}
      ${a.mode && HZ[a.mode] ? `<span class="tag hz-${a.mode}">${HZ[a.mode]}</span>` : ''}<span class="when">${esc(a.when || '')}</span></div>
    ${legs}${(a.orders || []).length ? `<div class="tk-mid"><div class="orders">${a.orders.map(o => `<div>${esc(orderLine(o))}</div>`).join('')}</div>${phone ? '' : tkChart(a)}</div>` : ''}
    ${a.reminder ? `<div class="remind">⏰ ${esc(a.reminder)}</div>` : ''}
    ${risk}${a.by === 'claude' ? foldText(a.why, 2, 'Why, in full', 'tk-why') : `<p class="tk-why">${esc(a.why)}</p>`}${a.impact ? `<p class="tk-imp">${esc(a.impact)}</p>` : ''}${a.then ? `<p class="tk-imp">Then the money can go into ${esc(a.then)}.</p>` : ''}
    ${(a.steps || []).length ? `<ol class="tk-steps">${a.steps.map(s => `<li>${esc(s)}</li>`).join('')}</ol>` : ''}
    ${review || (checks && k !== 'buy' ? `<ul class="ck">${checks}</ul>` : '')}${learned}
    <div class="tk-acts">${acts}${details}</div><div class="placebox">${placing ? placeBox(a, i) : ''}</div><div class="replybox"></div></div></article>`;
}
function replyBox(i) {
  const quick = ['Not now', 'Remind me when I have the money', "I don't want it", 'Already done', 'Too risky for me'];
  return `<div class="reply"><div class="quick">${quick.map(q => `<button data-act="quick" data-i="${i}" data-q="${esc(q)}">${esc(q)}</button>`).join('')}</div>
    <textarea placeholder="Tell the PM what you think, like “not now, I'll buy it once I have the money”" data-i="${i}"></textarea>
    <div class="r2"><span>The PM acts on it and learns from it.</span><button class="btn quiet" data-act="replyclose">Cancel</button><button class="btn go" data-act="replysend" data-i="${i}">Send</button></div></div>`;
}
async function sendReply(i, text, el) {
  const A = api(), a = S.orders[+i], box = el.closest('.ticket');
  if (!A || !a || !String(text || '').trim()) return;
  $$('button', box).forEach(b => { b.disabled = true; });
  let r = null;
  try { r = await A.reply(a.id, text); } catch (e) { r = null; }
  if (!r || r.ok === false) {  // not saved: say so and give the buttons back
    $$('button', box).forEach(b => { b.disabled = false; });
    toast((r && r.said) || 'The app couldn’t save that reply. Try it again.', 7000);
    return;
  }
  if (!r.now) {  // an app still running the code from before v1.0.1: the page re-plans by itself, as it did
    $('.replybox', box).innerHTML = `<div class="botsays"><b>The PM:</b> ${esc(r.said || 'Got it.')}</div>`;
    setTimeout(() => regrade(r.said || 'Got it.'), 1800);
    return;
  }
  // v1.0.1: one answer is enough. The order leaves the list and the headline changes right now; the app re-plans behind
  // the page and reloads it once, with the PM's reading of the reply. (Before: two reloads raced, and the old list won.)
  const ta = $('textarea', box); if (ta) ta.value = ta.defaultValue;
  box.classList.add('gone');
  applyPlan(r.now);
  toast(r.thinking ? 'Got it: it’s off your list. The PM is reading your reply…' : 'The PM: ' + (r.said || 'Got it.'), r.thinking ? 9000 : 0);
}
function motionBtns(m) {
  if (phone) return '';
  return (m.actions || []).map(([label, kind, val], j) => `<button class="btn${j ? '' : ' go'}" data-act="mo" data-id="${esc(m.id)}" data-kind="${esc(kind)}" data-val="${esc(val)}">${esc(label)}</button>`).join('');
}
function motionRow(m) {
  const n = (m.stages || []).length, at = m.done ? n : m.at || 0;
  const steps = (m.stages || []).map((s, k) => `<span class="st ${k < at ? 'done' : k === at ? 'now' : ''}"><i></i>${esc(s)}</span>`
    + (k < n - 1 ? `<span class="ln ${k < at - 1 || (k < at && m.done) ? 'done' : k === at - 1 ? 'flow' : ''}"></span>` : '')).join('');
  return `<div class="card mo"><div><b>${esc(m.title)}</b><div class="now">${esc(m.now || '')}${m.eta ? ' · ' + esc(m.eta) : ''}</div></div>
    <div class="acts">${motionBtns(m)}</div><div class="steps">${steps}</div></div>`;
}

/* ---------------- Positions ---------------- */
function viewPositions() {
  const ps = (S.positions || []).filter(p => !p.error);
  const inv = ps.reduce((s, p) => s + (p.value || 0), 0), pl = ps.reduce((s, p) => s + (p.gain_usd || 0), 0);
  const att = (S.orders || []).length;
  const order = { act: 0, watch: 1, ok: 2 };
  const GROUP = { long: ['Core funds', 'held for years, no stop'], medium: ['Stock picks', 'months to a year, re-checked after each report'], short: ['Swing trades', 'about 2 months each, with a stop'] };
  const groups = ['long', 'medium', 'short'].map(md => {
    const g = ps.filter(p => (p.mode || 'short') === md).sort((a, b) => (order[a.tone] - order[b.tone]) || ((b.value || 0) - (a.value || 0)));
    if (!g.length) return '';
    const v = g.reduce((s, p) => s + (p.value || 0), 0), gl = g.reduce((s, p) => s + (p.gain_usd || 0), 0), h = (S.horizons || {})[md] || {};
    return `<section class="pg"><div class="pg-h"><span class="tag hz-${md}">${HZ[md]}</span><h3>${GROUP[md][0]}</h3><span class="dim">${g.length} · ${money(v)}${isNum(h.budget) && h.budget ? ` of its ${money(h.budget)} budget` : ''} · ${GROUP[md][1]}</span>
      <span class="r ${tone(gl)}">${signed(gl)}</span></div><div class="card pg-list">${g.map(posRow).join('')}</div></section>`;
  }).join('');
  return `<div class="sec-h" style="margin-top:0"><h2>Portfolio</h2><span>${byClaude() ? 'The PM’s call on each one, from the latest briefing.' : 'One answer for each: Keep or Sell. Your rules are the guideline; the research desk makes the call.'}</span></div>
  <div class="summary"><div class="card kpi"><small>Invested</small><b>${money(inv)}</b><span>${ps.length} positions</span></div>
    <div class="card kpi"><small>Open profit / loss</small><b class="${tone(pl)}">${signed(pl)}</b><span>since each buy</span></div>
    <div class="card kpi"><small>Needs you</small><b>${att}</b><span>${att ? `order${att === 1 ? '' : 's'} waiting on Today` : 'nothing to do'}</span></div>
    <div class="card kpi"><small>Cash</small><b>${money(S.account.cash)}</b><span>${money(S.account.total)} in all</span></div></div>
  ${freshLine()}
  ${allocCard(ps)}${groups || '<div class="card empty">Nothing owned yet. The firm’s first orders are on Today.</div>'}`;
}
const ALLOC_C = ['#a38cff', '#3ff2a3', '#56cbff', '#ffb454', '#ff7eb6', '#7ee0b0', '#ffd36e', '#c3b4ff', '#6fb8ff'];
function allocCard(ps) {
  const cash = (S.account || {}).cash || 0, tot = ps.reduce((s, p) => s + (p.value || 0), 0) + cash;
  if (!tot || !ps.length) return '';
  const sl = ps.slice().sort((a, b) => (b.value || 0) - (a.value || 0)).map((p, i) => ({ k: p.ticker, v: p.value || 0, c: ALLOC_C[i % ALLOC_C.length], m: p.mode, t: p.ticker }))
    .concat(cash > 0 ? [{ k: 'Cash', v: cash, c: 'rgba(255,255,255,.22)', t: 'Cash' }] : []);
  const R = 52, C = 2 * Math.PI * R; let acc = 0;
  const arcs = sl.map(x => { const f = x.v / tot, d = `<circle cx="70" cy="70" r="${R}" fill="none" stroke="${x.c}" stroke-width="18" stroke-dasharray="${Math.max(0, f * C - 2).toFixed(2)} ${C.toFixed(2)}" stroke-dashoffset="${(-acc * C).toFixed(2)}" transform="rotate(-90 70 70)"><title>${esc(x.t)}: ${money(x.v)} (${Math.round(f * 100)}%)</title></circle>`; acc += f; return d; }).join('');
  const big = sl.filter(x => x.k !== 'Cash' && !['SPY', 'QQQ'].includes(x.k) && x.v / tot > 0.2);
  return `<section class="card alloc"><svg viewBox="0 0 140 140" class="al-d">${arcs}<text x="70" y="66" text-anchor="middle" class="al-t">${money(tot)}</text><text x="70" y="84" text-anchor="middle" class="al-s">in all</text></svg>
    <div class="al-r"><h3>Where your money is</h3><div class="al-l">${sl.map(x => `<button class="al-i" ${x.k !== 'Cash' ? `data-act="stock" data-t="${esc(x.k)}"` : ''}><i style="background:${x.c}"></i><b>${esc(x.t)}</b><span>${Math.round(x.v / tot * 100)}%</span><em>${money(x.v)}</em></button>`).join('')}</div>
    ${big.map(x => `<p class="al-w">⚠ ${esc(x.k)} is ${Math.round(x.v / tot * 100)}% of your account. The firm’s playbook keeps one stock under about 20%.</p>`).join('')}</div></section>`;
}
function pendStop(t) {  // v7.1: a new stop the PM wants that isn't at Schwab yet (its order is still on Today)
  const o = (S.orders || []).find(x => x.kind === 'stop' && x.ticker === t); if (!o) return null;
  const leg = (o.orders || []).find(x => x && isNum(+x.stop) && +x.stop), m = String(o.title || '').match(/at \$([\d,.]+)/);
  return leg ? +leg.stop : m ? +m[1].replace(/,/g, '') : null;
}
function rangeBar(g, ns) {
  if (!g) return '';
  const pend = isNum(ns) && Math.abs(ns - g.lo) > 0.01, at = pend ? Math.max(0, Math.min(1, (ns - g.lo) / (g.hi - g.lo || 1))) : 0;
  return `<div class="rng"><div class="bar3"><span class="b" style="left:${(g.buy * 100).toFixed(1)}%"></span>${pend ? `<span class="n" style="left:${(at * 100).toFixed(1)}%" title="New stop ${money(ns, true)}: not at Schwab yet"></span>` : ''}<span class="p" style="left:${(g.at * 100).toFixed(1)}%"></span></div>
    <div class="ends"><span class="neg">${esc(g.lo_label)} ${money(g.lo)}${pend ? ` <em class="pend">· new ${money(ns)} waiting</em>` : ''}</span><span class="pos">${g.hi_label ? esc(g.hi_label) + ' ' + money(g.hi) : ''}</span></div></div>`;
}
function posRow(p) {
  const nx = (p.ifs || [])[0], ns = pendStop(p.ticker), lo = (p.range || {}).lo;
  const pend = isNum(ns) && isNum(lo) && Math.abs(ns - lo) > 0.01 ? `<span class="pr-pend">⚠ The new ${money(ns, true)} stop isn’t at ${esc(BN())} yet: it’s waiting on Today. Until then, the ${money(lo, true)} stop is the one that works.</span>` : '';
  return `<button class="pr st-${p.tone}" data-act="stock" data-t="${esc(p.ticker)}">
    <div class="pr-id"><b>${esc(p.ticker)}</b><span>${esc(p.name)}</span><small>${p.days != null ? 'day ' + p.days : ''}${p.earnings ? ' · reports ' + esc(fmtD(p.earnings)) : ''}</small></div>
    <div class="pr-sp">${spark(p.spark, { lines: [{ v: p.buy_price, c: 'rgba(255,255,255,.35)' }] })}</div>
    <div class="pr-px"><b>${money(p.price, true)}</b><small class="${tone(p.day)}">${pct(p.day, 2)} today</small></div>
    <div class="pr-pl"><b class="${tone(p.gain_usd)}">${signed(p.gain_usd)}</b><small>${pct(p.gain)} · ${money(p.value)}</small></div>
    <div class="pr-rg">${rangeBar(p.range, ns) || '<span class="dim" style="font-size:12px">No stop: held through drops</span>'}</div>
    <div class="pr-v">${vword(p.verdict || 'Keep')}</div>
    <div class="pr-call">${pend}${p.call ? `<span class="c">${esc(p.call)}</span>` : ''}${p.researching ? '<span class="aic"><i>Research</i>researching it now…</span>' : ''}
      ${nx ? `<span class="nx"><b>Next:</b> ${esc(nx[0])} → ${esc(nx[1])}</span>` : ''}${fzTeam(S, p.ticker)}</div></button>`;
}
/* ---------------- Radar ---------------- */
/* ---------------- Proof ---------------- */
function viewProof() {
  const P = S.proof || {}, t = P.test, lv = P.live || {};
  if (!t) return `<div class="card ans"><p class="eyebrow">Does the bot beat random picks?</p><div class="a no">Testing…</div>
    <p>The bot replays its strategy on 10 years of prices against 2,000 random portfolios. It runs with the next scan.</p></div>`;
  const beatsRandom = t.random.beaten >= 0.95, beatsSpy = t.bot.mean > 0, sure = t.bot.ci[0] > 0;
  const h = t.hist || { counts: [], edges: [] }, mx = Math.max(...h.counts, 1), W = phone ? 360 : 600, H = 150, lo = h.edges[0], hi = h.edges[h.edges.length - 1];
  const xb = v => ((Math.min(Math.max(v, lo), hi) - lo) / (hi - lo || 1)) * W, bw = W / Math.max(1, h.counts.length), botX = Math.min(W - 2, xb(t.bot.mean));
  const bars = h.counts.map((c, k) => `<rect class="bar4" x="${(k * bw + 1).toFixed(1)}" y="${(H - (c / mx) * (H - 22)).toFixed(1)}" width="${(bw - 2).toFixed(1)}" height="${((c / mx) * (H - 22)).toFixed(1)}" rx="2" style="animation-delay:${k * 15}ms"/>`).join('');
  const hist = `<div class="hist"><svg viewBox="0 0 ${W} ${H + 22}">${bars}<line class="bot" x1="${botX}" x2="${botX}" y1="8" y2="${H}"/>
    <circle cx="${botX}" cy="8" r="4" fill="var(--go)"><animate attributeName="r" values="4;7;4" dur="2.4s" repeatCount="indefinite"/></circle>
    <text x="${Math.max(0, botX - 6)}" y="20" text-anchor="end" style="fill:var(--go)">The bot ${pct(t.bot.mean)}</text>
    <text x="${W / 2}" y="${H + 18}" text-anchor="middle">2,000 random portfolios (grey) · average per pick vs the S&amp;P</text></svg></div>`;
  const yrs = t.by_year || [], ym = Math.max(...yrs.map(y => Math.max(Math.abs(y.bot), Math.abs(y.random))), 0.005);
  const YW = phone ? 360 : 600, YH = 160, mid = YH / 2, col = YW / Math.max(1, yrs.length), bw2 = Math.min(18, col * 0.3), sc = (mid - 14) / ym;
  const bar = (x, v, fill, k) => { const hh = Math.max(1, Math.abs(v) * sc); return `<rect class="${v >= 0 ? 'up' : 'dn'}" x="${x.toFixed(1)}" y="${(v >= 0 ? mid - hh : mid).toFixed(1)}" width="${bw2.toFixed(1)}" height="${hh.toFixed(1)}" rx="3" fill="${fill}" style="animation-delay:${k * 60}ms"><title>${pct(v)}</title></rect>`; };
  const years = `<div class="yrs"><svg viewBox="0 0 ${YW} ${YH + 20}"><line x1="0" x2="${YW}" y1="${mid}" y2="${mid}" stroke="rgba(255,255,255,.18)"/>`
    + yrs.map((y, k) => { const cx = col * k + col / 2; return bar(cx - bw2 - 1, y.bot, y.bot >= 0 ? 'var(--go)' : 'var(--stop)', k) + bar(cx + 1, y.random, 'rgba(255,255,255,.28)', k)
      + `<text x="${cx}" y="${YH + 14}" text-anchor="middle">'${String(y.year).slice(2)}</text>`; }).join('') + '</svg></div>';
  const live = lv.status === 'waiting' ? `${lv.closed || 0} of the bot's live picks have finished (${lv.open || 0} still open). The live check starts after 10 finish${lv.need ? `: ${lv.need} to go` : ''}.`
    : `Live picks: ${pct(lv.avg)} per pick vs the S&P over ${lv.closed} finished picks, ${lv.status} with the test.`;
  const L = S.lessons || [], R = S.replies || [];
  const lessons = L.length ? L.map(x => `<div class="card lesson"><span class="ic">✦</span><div><b>${esc(x.title)}</b><p>${esc(x.text)}</p><div class="ap">${esc(x.applied)}</div></div></div>`).join('')
    : '<div class="card empty">The bot learns from what you do and what you tell it. It needs a few examples first.</div>';
  const replies = R.length ? `<section class="sec"><div class="sec-h"><h2>What you told the bot</h2><span>Your replies, newest first</span></div><div class="card panel"><ol class="log">${R.map(x =>
    `<li class="k-you"><time>${esc(hm(x.at))}</time><span>${esc(x.title || '')}: “${esc(x.text)}”</span></li>`).join('')}</ol></div></section>` : '';
  return `<div class="answers">
    <div class="card ans"><p class="eyebrow">Does the bot beat random picks?</p><div class="a${beatsRandom ? '' : ' no'}">${beatsRandom ? 'Yes.' : 'Not yet.'}</div>
      <p>Over ${esc(t.period)}, its ${t.trades.toLocaleString()} picks beat <b>${(t.random.beaten * 100).toFixed(1)}%</b> of ${t.sims.toLocaleString()} random portfolios that bought random stocks on the same days with the same rules.</p>${hist}</div>
    <div class="card ans"><p class="eyebrow">Does it beat just buying the S&amp;P 500?</p><div class="a${beatsSpy ? '' : ' no'}">${beatsSpy ? (sure ? 'Yes.' : 'Yes, so far.') : 'No.'}</div>
      <p>${pct(t.bot.mean)} per pick on average after costs, ahead in ${t.beat_years} of ${yrs.length} years.${sure ? '' : ` Not locked in yet (the range still reaches ${pct(t.bot.ci[0])}), so buys stay at ${Math.round((P.size || 0.75) * 100)}% size until live picks confirm it.`}</p>${years}</div></div>
  <div class="tiles"><div class="card kpi"><small>Bot per pick</small><b class="pos">${pct(t.bot.mean)}</b><span>vs the S&amp;P, after costs</span></div>
    <div class="card kpi"><small>Random per pick</small><b>${pct(t.random.mean)}</b><span>same days, same rules</span></div>
    <div class="card kpi"><small>Wins</small><b>${pct(t.bot.beat_rate, 0, false)}</b><span>of picks beat the S&amp;P; the wins are bigger</span></div>
    <div class="card kpi"><small>Live check</small><b>${lv.status === 'waiting' ? `${lv.closed || 0}/10` : esc(lv.status)}</b><span>${esc(live)}</span></div></div>
  <p class="fine" style="text-align:center;max-width:76ch;margin:14px auto 0">The research desk and the ${GATE()}% confidence bar are new, so they aren’t part of this 10-year test. They can only stop a buy or reorder the list, never add a stock, so every buy still comes from the tested rules.</p>
  <section class="sec"><div class="sec-h"><h2>What the bot learned about you</h2><span>From what you do and what you tell it, re-learned every scan</span></div><div class="lessons">${lessons}</div></section>${replies}`;
}
/* ---------------- stock sheet ---------------- */
function openStock(t, note) {
  if (!t) return;
  const known = (S.positions || []).some(x => x.ticker === t) || (S.radar || []).some(x => x.ticker === t) || S.notes[t];
  if (!known && !note) { lookupStock(t); return; }
  closeSheet();
  if (ui.view !== 'stock') ui.prev = ui.view;
  ui.stock = t; ui.stockNote = note || null; ui.view = 'stock';
  draw();
}
function stockChart(t, sp, spd, lines, p) {
  const dated = spd.length === sp.length, day = i => dated ? fmtD(spd[i]) : `${sp.length - 1 - i} trading days ago`;
  const short = i => dated ? fmtD(spd[i]).replace(/^\w+ /, '') : day(i);
  return chart({ h: phone ? 200 : 180, label: `${t} price`, levels: lines,
    series: [{ v: sp, c: sp[sp.length - 1] >= (p ? p.buy_price : sp[0]) ? 'var(--go)' : 'var(--stop)' }],
    tip: (i, a) => `<div class="t-d">${esc(day(i))}</div><b class="mono">${money(sp[i], true)}</b><div class="t-s">`
      + (p && p.buy_price ? `<span class="${tone(sp[i] - p.buy_price)}">${pct(sp[i] / p.buy_price - 1)}</span> vs what you paid`
        : i > a ? `<span class="${tone(sp[i] - sp[a])}">${pct(sp[i] / sp[a] - 1)}</span> since ${esc(short(a))}` : 'Start of what’s shown') + '</div>',
    range: (x, y) => `${esc(dated ? span2(spd[x], spd[y]) : short(x) + ' – ' + short(y))} · <span class="${tone(sp[y] - sp[x])}">${pct(sp[y] / sp[x] - 1)}</span>` });
}
async function lookupStock(t) {
  const A = api();
  if (!A || !A.research) { toast(`No research on ${t} in this copy yet.`); return; }
  toast(`Researching ${t}…`);
  const r = await A.research(t);
  if (!r || r.error) { toast(r ? r.error : 'Something went wrong'); return; }
  openStock(r.note.ticker, r.note);
}
function openSheet(head, body, foot) {
  ui.focusBack = document.activeElement;
  $('#layer').innerHTML = `<div class="scrim" data-act="close" aria-hidden="true"></div><aside class="sheet" role="dialog" aria-modal="true" aria-label="${esc(String(head).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 80) || 'Details')}"><div class="sheet-h">${head}<button class="x" data-act="close" aria-label="Close">✕</button></div>
    <div class="sheet-b">${body}${foot || ''}</div></aside>`;
  mountCharts($('#layer'));
  setTimeout(() => { const x = $('#layer .sheet .x'); if (x) x.focus({ preventScroll: true }); }, 30);
  if (phone) sheetPull($('#layer .sheet'));
}
function closeSheet() { const had = !!$('#layer').innerHTML; $('#layer').innerHTML = ''; ui.sheet = null; if (had && ui.focusBack && ui.focusBack.isConnected) ui.focusBack.focus({ preventScroll: true }); ui.focusBack = null; }
// on a phone or iPad, pull a sheet down from its top to close it, like an iPhone sheet (charts inside keep their own drag)
function sheetPull(el) {
  if (!el) return;
  let y0 = null, dy = 0, on = false;
  el.addEventListener('touchstart', e => {
    y0 = e.touches.length === 1 && el.scrollTop <= 0 && !e.target.closest('.ich') ? e.touches[0].clientY : null; dy = 0; on = false;
  }, { passive: true });
  el.addEventListener('touchmove', e => {
    if (y0 === null) return;
    dy = e.touches[0].clientY - y0;
    if (!on) { if (dy < 0) { y0 = null; return; } if (dy < 8) return; on = true; }
    e.preventDefault();
    el.style.transition = 'none'; el.style.transform = `translateY(${Math.max(0, dy)}px)`;
  }, { passive: false });
  const end = () => {
    if (!on) { y0 = null; return; }
    el.style.transition = 'transform .22s var(--ease)';
    if (dy > 110) { el.style.transform = 'translateY(105%)'; setTimeout(closeSheet, 180); } else el.style.transform = '';
    y0 = null; on = false;
  };
  el.addEventListener('touchend', end);
  el.addEventListener('touchcancel', end);
}

/* Settings → Updates (redone in v1.1). One sentence says where things stand: update.status().line, written in Python
   so the page and the logs say the same thing. Under it, only the buttons that make sense right now. The box redraws
   itself after every button (before, the old sentence stayed until Settings was closed and opened again), and keeps
   itself current while iCloud is still sending or bringing a file. */
function updBox(u) {
  u = u || {};
  const tone = ['ok', 'go', 'wait', 'warn'].includes(u.tone) ? u.tone : 'ok';
  const line = `<p class="upd-line ${tone}" role="status"><i aria-hidden="true"></i><span>${esc(u.line || 'Press Check for updates.')}</span></p>`;
  const b = (k, label, cls) => `<button class="btn ${cls || ''}" data-act="upd" data-k="${k}">${label}</button>`;
  const dir = b('folder', u.folder ? 'Change the shared folder' : 'Choose the shared folder', u.folder ? 'quiet' : 'go');
  if (u.source) {
    const cps = (u.copies || []).map(c => `<li class="${esc(c.tone || 'ok')}">${esc(c.line)}</li>`).join('');
    return `${line}${cps ? `<ul class="upd-copies" aria-label="The other copies">${cps}</ul>` : (u.shared ? '<p class="fine upd-none">A copy shows up here once it is on v1.1 or newer and has looked in the folder. (In iCloud’s sharing options the folder has to let the other person make changes.)</p>' : '')}
      <div class="upd-btns">${u.folder ? b('share', u.shared && !u.ahead ? `Share ${VER} again` : `Share ${VER}`, u.shared && !u.ahead ? '' : 'go') : ''}${u.shared ? b('reveal', 'Show the update file') : ''}${dir}</div>
      <p class="fine">If iCloud is slow, AirDrop the update file: the other copy takes it with Settings → Updates → Install from a file. A copy that won’t open at all is repaired by unpacking that file and double-clicking install.command inside it. Its own numbers are never touched.</p>`;
  }
  return `${line}<div class="upd-btns">${u.ready ? b('now', 'Restart to update', 'go') : ''}${b('check', 'Check for updates')}${b('file', 'Install from a file…')}${dir}</div>
    <label class="upd-auto"><input type="checkbox" data-act="updauto"${u.auto === false ? '' : ' checked'}><span>Install a new version by itself when nobody is at the Mac</span></label>`;
}
let updTimer = 0;
function updShow(st) {
  if (!st) return;
  if (S.settings) S.settings.update = st;
  const box = $('#upd-box'); if (!box) return;
  const had = document.activeElement && box.contains(document.activeElement) ? document.activeElement.dataset.k || document.activeElement.dataset.act : '';
  box.innerHTML = updBox(st);
  if (had) { const again = $(`[data-k="${had}"]`, box) || $(`[data-act="${had}"]`, box) || $('button', box); if (again) again.focus({ preventScroll: true }); }
  updFollow();
}
function updFollow() {  // a file still on its way: look again by itself while Settings is open
  clearTimeout(updTimer);
  const A = api(), u = (S.settings || {}).update || {};
  if (!A || !$('#upd-box')) return;
  const moving = u.source ? u.uploaded === false : u.state === 'arriving';
  if (!moving) return;
  updTimer = setTimeout(() => {
    if (!$('#upd-box')) return;
    (u.source ? A.update_status().then(st => ({ status: st })) : A.update_check()).then(r => updShow(r && r.status)).catch(() => {});
  }, u.source ? 5000 : 20000);
}
function updAct(el) {
  const A = api(), k = el.dataset.k; if (!A) return;
  if (k === 'now') return updGo();
  const was = el.textContent, busy = { share: 'Sharing…', check: 'Checking…' }[k];
  el.disabled = true; if (busy) el.textContent = busy;
  const call = { share: A.update_share, folder: A.update_folder, check: A.update_check, file: A.update_file, reveal: A.update_reveal }[k];
  if (!call) { el.disabled = false; el.textContent = was; return toast('This button needs the newest app: quit SRM Finance and open it again.', 8000); }
  call().then(r => {
    el.disabled = false; el.textContent = was;
    const st = (r && r.status) || null;
    updShow(st);
    if (r && r.error) return toast(r.error, 9000);
    if (k === 'share') toast(`Shared ${VER}.${st && st.uploaded === false ? ' iCloud is sending it now.' : ''} The other copy picks it up within the hour, or when it next opens.`, 7000);
    else if (k === 'check' || k === 'file') { if (r && r.ok === false) return; toast(r && r.ready ? `${r.ready.label ? 'v' + r.ready.label : 'A new version'} is ready: press Restart to update.` : (st && st.line) || 'Checked.', 7000); if (r && r.ready) window.updateReady(r.ready, st && st.auto, true); }
    else if (k === 'folder') toast(r && r.ok === false ? 'No folder chosen.' : 'Folder saved.');
  }).catch(() => { el.disabled = false; el.textContent = was; toast('That didn’t go through. Try again.'); });
}
function updGo() {  // Restart to update: a screen that says what is happening until the app closes and comes back by itself
  const A = api(); if (!A) return;
  let el = $('#upd-over'), tick = 0;
  if (!el) { el = document.createElement('div'); el.id = 'upd-over'; el.setAttribute('role', 'alertdialog'); el.setAttribute('aria-modal', 'true'); el.setAttribute('aria-label', 'Updating SRM Finance'); document.body.appendChild(el); }
  const show = (text, failed) => {
    el.innerHTML = `<div class="upd-card">${failed ? '' : '<i class="upd-spin" aria-hidden="true"></i>'}<h2>${failed ? 'The update didn’t go in' : 'Updating SRM Finance'}</h2><p aria-live="polite">${esc(text)}</p>${failed ? '<button class="btn go">OK</button>' : '<p class="fine">The app closes and opens again by itself, in about a minute. Nothing of yours is touched.</p>'}</div>`;
    if (failed) { const ok = $('button', el); ok.onclick = () => el.remove(); ok.focus(); }
  };
  show('Getting the new version ready…');
  window.updateFailed = msg => { clearInterval(tick); show(msg || 'Something stopped it. Nothing changed.', true); A.update_status().then(updShow).catch(() => {}); };
  tick = setInterval(() => { if (!$('#upd-over') || $('#upd-over button')) return clearInterval(tick); A.update_status().then(st => { if (st && st.progress && $('#upd-over') && !$('#upd-over button')) show(st.progress + '…'); }).catch(() => {}); }, 1000);
  $$('.card.update').forEach(c => c.remove());
  A.update_now();
}

/* ---------------- 2.0: the Chat ----------------
   Talk with the PM (the main bot) or any desk, the way you'd talk with Claude in its own app: conversations that stay
   (signal_lab/chat.py keeps them in data/chat/), files you attach (the paper clip, or drag them in anywhere), answers
   written out with lists and tables, the Mac's own Dictation on the microphone button, and a call mode that reads each
   answer out loud and sends what you say when you stop talking. Nothing here trades or changes a setting by itself:
   a suggestion under an answer has a button the owner presses (chat.apply). */
const CHT = { list: null, desks: [], cur: null, th: null, files: [], who: 'pm', draft: '', wait: {}, poll: null, call: false, speaking: -1, side: false, hide: null };
try { const c = sessionStorage.getItem('ct-chat'); if (c) Object.assign(CHT, JSON.parse(c)); } catch (e) { /* private mode */ }
CHT.wait = {}; CHT.poll = null; CHT.speaking = -1; CHT.call = false;
function chKeep() { try { sessionStorage.setItem('ct-chat', JSON.stringify({ cur: CHT.cur, who: CHT.who, draft: CHT.draft, files: CHT.files })); } catch (e) { /* private mode */ } }
const CH_ICON = {
  chat: '<svg viewBox="0 0 24 24"><path d="M5 5h14a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H10l-5 4v-4H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z"/></svg>',
  clip: '<svg viewBox="0 0 24 24"><path d="M20 11.5 12.2 19.3a5 5 0 0 1-7.1-7.1l8.5-8.5a3.3 3.3 0 0 1 4.7 4.7l-8.5 8.5a1.7 1.7 0 0 1-2.4-2.4l7.8-7.8"/></svg>',
  mic: '<svg viewBox="0 0 24 24"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/></svg>',
  call: '<svg viewBox="0 0 24 24"><path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2"/></svg>',
  say: '<svg viewBox="0 0 24 24"><path d="M4 9v6h4l5 4V5L8 9z"/><path d="M16 9a4 4 0 0 1 0 6M18.5 6.5a8 8 0 0 1 0 11"/></svg>',
  send: '<svg viewBox="0 0 24 24"><path d="M5 12h13M13 6l6 6-6 6"/></svg>',
  list: '<svg viewBox="0 0 24 24"><path d="M4 6h16M4 12h16M4 18h10"/></svg>',
  plus: '<svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>',
  pm: '<svg viewBox="0 0 24 24"><circle cx="12" cy="8" r="4"/><path d="M4 20a8 8 0 0 1 16 0"/><path d="M18 3l1 2 2 1-2 1-1 2-1-2-2-1 2-1z"/></svg>',
};
ICON.chat = CH_ICON.chat;
const chName = w => !w || w === 'pm' ? (pmName() || 'The PM') : ((CHT.desks.find(d => d.id === w) || {}).name || 'The PM');
const chMid = w => chName(w).replace(/^The /, 'the ');  // inside a sentence
const chShort = w => !w || w === 'pm' ? 'PM' : ((CHT.desks.find(d => d.id === w) || {}).short || '··');
const chSize = n => !isNum(n) ? '' : n < 1024 ? n + ' B' : n < 1048576 ? Math.round(n / 1024) + ' KB' : (n / 1048576).toFixed(1) + ' MB';
const CH_KIND = { PDF: '📄', picture: '🖼\uFE0F', spreadsheet: '📊', document: '📝', text: '📄', Numbers: '📊', Pages: '📝', Keynote: '📽\uFE0F', file: '📎' };  // \uFE0F: drawn as an emoji, not a missing letter

/* Markdown, the small part answers use: paragraphs, **bold**, *italic*, `code`, lists, headings, tables, links. */
function mdInline(s) {
  return s.replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>')
    .replace(/(^|[^*\w])\*([^*\n]+)\*(?![*\w])/g, '$1<i>$2</i>')
    .replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, (m, t, u) => `<button class="link ch-a" data-act="link" data-u="${u}">${t}</button>`)
    .replace(/(^|[\s(]|&quot;)(https?:\/\/[^\s<)]+)/g, (m, p, u) => {
      const t = (u.match(/(?:[.,;:!?]|&quot;|&#39;)+$/) || [''])[0]; if (t) u = u.slice(0, -t.length);  // a full stop after a link isn't part of it
      return `${p}<button class="link ch-a" data-act="link" data-u="${u}">${u.replace(/^https?:\/\/(www\.)?/, '').slice(0, 42)}</button>${t}`;
    });
}
function mdHtml(src) {
  const L = esc(String(src || '')).replace(/\r/g, '').split('\n'), isRow = l => /^\s*\|.*\|\s*$/.test(l);
  const isList = l => /^\s*[-*•]\s+/.test(l), isNumL = l => /^\s*\d+[.)]\s+/.test(l);
  let out = '', i = 0;
  while (i < L.length) {
    const ln = L[i];
    if (/^\s*```/.test(ln)) { const b = []; i++; while (i < L.length && !/^\s*```/.test(L[i])) b.push(L[i++]); i++; out += `<pre>${b.join('\n')}</pre>`; continue; }
    if (isRow(ln) && i + 1 < L.length && /^\s*\|?\s*:?-{2,}/.test(L[i + 1])) {
      const row = l => l.trim().replace(/^\||\|$/g, '').split('|').map(c => c.trim());
      const head = row(ln); i += 2; const body = [];
      while (i < L.length && isRow(L[i])) body.push(row(L[i++]));
      out += `<div class="ch-tw"><table><thead><tr>${head.map(c => `<th>${mdInline(c)}</th>`).join('')}</tr></thead><tbody>${body.map(r => `<tr>${r.map(c => `<td>${mdInline(c)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
      continue;
    }
    const h = ln.match(/^\s*(#{1,4})\s+(.*)$/);
    if (h) { out += `<h5 class="ch-h${h[1].length}">${mdInline(h[2])}</h5>`; i++; continue; }
    if (isList(ln) || isNumL(ln)) {
      const num = isNumL(ln), test = num ? isNumL : isList, items = [];
      while (i < L.length && (test(L[i]) || (/^\s{2,}\S/.test(L[i]) && items.length))) {
        if (test(L[i])) items.push(L[i].replace(num ? /^\s*\d+[.)]\s+/ : /^\s*[-*•]\s+/, '')); else items[items.length - 1] += ' ' + L[i].trim();
        i++;
      }
      out += `<${num ? 'ol' : 'ul'}>${items.map(x => `<li>${mdInline(x)}</li>`).join('')}</${num ? 'ol' : 'ul'}>`; continue;
    }
    if (/^&gt;\s?/.test(ln)) { const b = []; while (i < L.length && /^&gt;\s?/.test(L[i])) b.push(L[i++].replace(/^&gt;\s?/, '')); out += `<blockquote>${mdInline(b.join('<br>'))}</blockquote>`; continue; }
    if (!ln.trim()) { i++; continue; }
    const p = [L[i++]];  // the first line always goes in, so a line nothing else takes can't stop the loop
    while (i < L.length && L[i].trim() && !/^\s*```/.test(L[i]) && !/^\s*#{1,4}\s/.test(L[i]) && !isList(L[i]) && !isNumL(L[i]) && !/^&gt;/.test(L[i]) && !isRow(L[i])) p.push(L[i++]);
    out += `<p>${mdInline(p.join('<br>'))}</p>`;
  }
  return out;
}

function chatLoad(open) {  // one load at a time (the Today card and the Chat tab both ask at start)
  if (!chatLoad.p) chatLoad.p = chLoad(open).finally(() => { chatLoad.p = null; });
  return chatLoad.p;
}
async function chLoad(open) {
  const A = api(); if (!A || !A.chat_list) return;
  let r; try { r = await A.chat_list(); } catch (e) { return; }
  CHT.list = r.threads || []; CHT.desks = r.desks || [];
  if (!PMS.d) await pmLoad();
  CHT.list.filter(t => t.pending).forEach(t => { CHT.wait[t.id] = CHT.wait[t.id] || Date.parse(t.at) || Date.now(); });
  if (Object.keys(CHT.wait).length) chPoll();
  if (CHT.cur && !CHT.list.some(t => t.id === CHT.cur)) CHT.cur = null;
  if (open !== false && CHT.cur) await chOpen(CHT.cur, true);
  if (ui.view === 'chat') chDraw(); else if (ui.view === 'bot') { const c = $('.b2-ask'); if (c) { const v = ($('#askq') || {}).value || ''; c.outerHTML = askCard(); const t = $('#askq'); if (t) t.value = v; } }
}
async function chOpen(id, quiet) {
  const A = api(); if (!A) return;
  let th; try { th = await A.chat_get(id); } catch (e) { th = null; }
  if (!th || th.missing) { CHT.cur = null; CHT.th = null; if (!quiet) toast('That conversation isn’t there any more.'); chKeep(); chDraw(); return; }
  CHT.cur = id; CHT.th = th; CHT.side = false;
  if (th.pending) { CHT.wait[id] = CHT.wait[id] || Date.parse(th.pending.since) || Date.now(); chPoll(); }
  chKeep();
  if (!quiet) chDraw(true);
}
function chNew(who) {
  CHT.cur = null; CHT.th = null; CHT.side = false; if (who) CHT.who = who; chKeep();
  if (ui.view !== 'chat') { ui.view = 'chat'; draw(); } else chDraw(true);
  setTimeout(() => { const t = $('#chq'); if (t) t.focus(); }, 30);
}
function chUpsert(th) {
  if (!th) return;
  const row = { id: th.id, title: th.title || 'New chat', who: th.who, name: th.name || chName(th.who), at: th.at, n: (th.messages || []).length, pending: !!th.pending,
    last: String(((th.messages || []).slice(-1)[0] || {}).text || '').replace(/[*_`#>|]+/g, '').replace(/^\s*(?:[-•]|\d+[.)])\s+/gm, '').replace(/\s+/g, ' ').trim().slice(0, 120) };
  CHT.list = [row, ...(CHT.list || []).filter(t => t.id !== th.id)];
}

function viewChat() {
  const th = CHT.cur ? CHT.th : null, who = th ? th.who || 'pm' : CHT.who, pm = who === 'pm';
  const nm = chName(who), msgs = th ? th.messages || [] : [];
  const list = CHT.list || [];
  const side = `<aside class="ch-side" aria-label="Conversations">
      <button class="btn go ch-new" data-act="chnew">${CH_ICON.plus}New chat</button>
      <div class="ch-threads">${list.length ? list.map(t => `<div class="ch-trow${t.id === CHT.cur ? ' on' : ''}"><button class="ch-t" data-act="chopen" data-id="${esc(t.id)}"${t.id === CHT.cur ? ' aria-current="true"' : ''}>
        <b>${t.pending ? '<i class="ch-dot" aria-label="answering"></i>' : ''}${esc(t.title)}</b><span>${esc(t.name || chName(t.who))} · ${esc(hm(t.at))}</span><em>${esc(t.last || '')}</em></button>
        <button class="ch-x${CHT.hide === t.id ? ' sure' : ''}" data-act="chhide" data-id="${esc(t.id)}" title="Take it off the list (it’s kept in the archive)" aria-label="Take “${esc(t.title)}” off the list">${CHT.hide === t.id ? 'Hide?' : '×'}</button></div>`).join('')
        : `<p class="dim ch-none">${CHT.list ? 'Your conversations show up here.' : 'Loading…'}</p>`}</div></aside>`;
  const opts = `<option value="pm"${who === 'pm' ? ' selected' : ''}>The PM (the main bot)</option>` + [...new Set(CHT.desks.map(d => d.team))].map(g =>
    `<optgroup label="${esc(g)}">${CHT.desks.filter(d => d.team === g).map(d => `<option value="${esc(d.id)}"${who === d.id ? ' selected' : ''}>${esc(d.name)}</option>`).join('')}</optgroup>`).join('');
  const deskBeat = pm ? 'the main bot: knows your whole account, reads your files, searches the web' : esc((CHT.desks.find(d => d.id === who) || {}).beat || '');
  const head = `<header class="ch-head">
      <button class="ch-ib ch-lt" data-act="chside" aria-label="Show the conversations">${CH_ICON.list}</button>
      <span class="ch-av av-${pm ? 'pm' : 'desk'}" aria-hidden="true">${esc(chShort(who))}</span>
      <div class="ch-who"><b>${esc(th ? th.title || nm : nm)}</b><span>${th ? esc(nm) + ' · ' : ''}${deskBeat}</span></div>
      ${th ? '' : `<label class="ch-pick"><span>Talk to</span><select id="chwho" aria-label="Who to talk to">${opts}</select></label>`}
      ${pm ? `<button class="btn quiet ch-pmb" data-act="chpm" title="Name, personality, voice">${CH_ICON.pm}<span>Your PM</span></button>` : ''}
      <button class="btn ${CHT.call ? 'go' : 'quiet'} ch-callb" data-act="chcall" aria-pressed="${CHT.call}">${CH_ICON.call}${CHT.call ? 'End the call' : 'Call'}</button></header>`;
  const callBar = CHT.call ? `<div class="ch-callbar" role="status"><span class="ch-wave" aria-hidden="true"><i></i><i></i><i></i><i></i></span>
      <div><b>On a call with ${esc(chMid(who))}</b><span id="chcallst">${esc(CHT.callSt || 'Talk after the microphone turns on. It sends what you said when you stop talking, and reads the answer out loud.')}</span></div>
      ${CHT.callFix ? `<button class="btn go" data-act="chfix">Open the setting</button>` : ''}<button class="btn quiet${LS.on ? ' on' : ''}" data-act="chmic" aria-pressed="${LS.on}">${CH_ICON.mic}${LS.on ? 'Listening' : 'Talk'}</button><button class="btn quiet" data-act="chhush">Stop reading</button></div>` : '';
  const sugg = pm ? ['How is my account doing this week?', 'Be way more aggressive and spend my cash', 'What would you buy with $1,000 right now?', 'What’s my biggest risk, in plain English?', 'Why are these the orders on Today?']
    : ['What’s the most important thing on your beat right now?', 'What does that mean for my stocks?', 'What should I watch this week?'];
  const hello = `<div class="ch-hello"><span class="ch-av big av-${pm ? 'pm' : 'desk'}" aria-hidden="true">${esc(chShort(who))}</span>
      <h2>${pm ? 'Talk to the PM' : esc(nm)}</h2>
      <p>${pm ? 'The PM runs the firm and knows your whole account: what you own, the cash, every desk’s research, your strategy. Ask anything, tell it how you want your money run, or attach a statement, a screenshot or a spreadsheet for it to read.' : esc(deskBeat)}</p>
      <div class="ch-sugg">${sugg.map(s => `<button class="chip" data-act="chsugg" data-q="${esc(s)}">${esc(s)}</button>`).join('')}</div>
      <p class="dim ch-safe">It never trades. When it suggests a change, you press the button to make it, and you still OK every order.</p></div>`;
  const pend = th && th.pending ? `<div class="ch-m bot ch-typing"><span class="ch-av av-${pm ? 'pm' : 'desk'}" aria-hidden="true">${esc(chShort(who))}</span>
      <div class="ch-b"><span class="ch-dots" aria-hidden="true"><i></i><i></i><i></i></span><span>${pm ? 'The PM is reading your account' + (((msgs.slice(-1)[0] || {}).files || []).length ? ' and your files' : '') : esc(nm) + ' is thinking'}… <em id="chsecs">${chSecs(CHT.cur)}</em></span></div></div>` : '';
  const log = CHT.cur && !th ? '<p class="dim ch-load">Opening the conversation…</p>' : msgs.length ? msgs.map((m, i) => chMsg(m, i, who)).join('') + pend : hello;
  const fl = CHT.files.length ? `<div class="ch-files">${CHT.files.map((f, k) => `<span class="ch-file${f.ok ? '' : ' bad'}" title="${esc(f.error || f.name)}">${CH_KIND[f.kind] || '📎'}<b>${esc(f.name)}</b><small>${f.ok ? esc(chSize(f.size)) : esc(f.error || 'can’t be read')}</small><button data-act="chunfile" data-k="${k}" aria-label="Remove ${esc(f.name)}">×</button></span>`).join('')}</div>` : '';
  const busy = !!(th && th.pending);
  const comp = `<div class="ch-comp">${fl}
      <div class="ch-row">
        <button class="ch-ib" data-act="chattach" title="${pm ? 'Attach files (or drag them here)' : 'Files go to the PM: start a chat with the PM to attach them'}" aria-label="Attach files"${pm ? '' : ' disabled'}>${CH_ICON.clip}</button>
        <textarea id="chq" rows="1" aria-label="Message ${esc(chMid(who))}" placeholder="Message ${esc(chMid(who))}…">${esc(CHT.draft || '')}</textarea>
        <button class="ch-ib${LS.on ? ' on' : ''}" data-act="chmic" title="Talk instead of typing" aria-label="Talk instead of typing" aria-pressed="${LS.on}">${CH_ICON.mic}</button>
        <button class="btn go ch-send" data-act="chsend"${busy ? ' disabled' : ''} aria-label="Send">${CH_ICON.send}<span>Send</span></button>
      </div>
      <p class="ch-hint">Enter sends · Shift+Enter for a new line${pm ? ' · drop in PDFs, pictures, Word, Excel or CSV files' : ''} · you OK every order</p></div>`;
  return `<div class="chat${CHT.call ? ' call' : ''}${CHT.side ? ' side' : ''}" id="chat">${side}${CHT.side ? '<button class="ch-scrim" data-act="chside" aria-label="Close the list of conversations"></button>' : ''}
    <section class="ch-main" id="chmain">${head}${callBar}<div class="ch-log" id="chlog" aria-live="polite">${log}</div>${comp}
      <div class="ch-drop" id="chdrop" hidden><span>${CH_ICON.clip}</span>Drop to attach${pm ? '' : ' (they go to the PM)'}</div></section></div>`;
}
function chSecs(id) {
  const t = CHT.wait[id]; if (!t) return '';
  const s = Math.max(0, Math.round((Date.now() - t) / 1000));
  return s < 60 ? s + ' s' : Math.floor(s / 60) + ' min ' + String(s % 60).padStart(2, '0') + ' s';
}
function chMsg(m, i, who) {
  if (m.role === 'owner') {
    const f = (m.files || []).length ? `<div class="ch-mf">${m.files.map(x => `<span>${CH_KIND[x.kind] || '📎'} ${esc(x.name)}</span>`).join('')}</div>` : '';
    return `<div class="ch-m me"><div class="ch-b">${f}${m.text && m.text !== '(files attached)' ? mdHtml(m.text) : ''}</div><span class="ch-t2">${callTag(m)}${esc(hm(m.at))}</span></div>`;
  }
  const w = m.who || who, pm = w === 'pm';
  const meta = [hm(m.at), isNum(m.seconds) ? (m.seconds < 60 ? m.seconds + ' s' : Math.round(m.seconds / 60) + ' min') : '', m.searches ? m.searches + ' web search' + (m.searches === 1 ? '' : 'es') : ''].filter(Boolean).join(' · ');
  return `<div class="ch-m bot${m.error ? ' err' : ''}"><span class="ch-av av-${pm ? 'pm' : 'desk'}" aria-hidden="true">${esc(chShort(w))}</span>
    <div class="ch-b"><span class="ch-nm">${esc(chName(w))}</span><div class="md">${mdHtml(m.text)}</div>${chProps(m, i)}
      <div class="ch-foot"><span>${callTag(m)}${esc(meta)}</span>${m.error ? '' : `<button class="link" data-act="chsay" data-i="${i}">${CH_ICON.say}${CHT.speaking === i ? 'Stop' : 'Read it to me'}</button><button class="link" data-act="chcopy" data-i="${i}">Copy</button>`}</div></div></div>`;
}
function chProps(m, i) {
  const ap = m.applied || {}, out = [];
  if (m.strategy) {
    const s = m.strategy, v = s.values || {};
    out.push(`<div class="ch-prop ch-pst"><div class="ch-pt"><span aria-hidden="true">${STRAT_ICON[v.approach] || '🎛'}</span>A new strategy: <b>${esc(s.label)}</b></div>
      ${s.why ? `<p>${esc(s.why)}</p>` : ''}<ul class="st-facts">${stratFacts(v).map(f => `<li>${esc(f)}</li>`).join('')}<li>core funds ${esc({ keep: 'kept', flexible: 'can be sold', none: 'not needed' }[v.core] || v.core || '')}</li><li>pace ${esc(v.pace || '')}</li></ul>
      ${ap.strategy ? `<p class="ch-done">✓ You’re using it (since ${esc(hm(ap.strategy))})</p>` : `<div class="ch-pb"><button class="btn go" data-act="chapply" data-w="strategy" data-i="${i}">Use this strategy</button><button class="btn quiet" data-act="strat">Change it myself</button></div>`}</div>`);
  }
  if (m.order) out.push(`<div class="ch-prop ch-por"><div class="ch-pt"><span aria-hidden="true">📌</span>A standing order for the whole firm</div><p class="ch-q">“${esc(m.order)}”</p>
      ${ap.order ? `<p class="ch-done">✓ Saved: every desk and the PM read it (since ${esc(hm(ap.order))})</p>` : `<div class="ch-pb"><button class="btn go" data-act="chapply" data-w="order" data-i="${i}">Save the standing order</button></div>`}</div>`);
  if (m.orders) out.push(`<div class="ch-prop ch-pod"><div class="ch-pt"><span aria-hidden="true">🧾</span>A change to your order list</div><p>${esc(m.orders)}</p>
      ${ap.orders ? `<p class="ch-done">✓ Sent to the Operations desk (${esc(hm(ap.orders))}). Today shows the new list in about a minute.</p>` : `<div class="ch-pb"><button class="btn go" data-act="chapply" data-w="orders" data-i="${i}">Update my order list</button><span class="dim">You still OK each order on Today.</span></div>`}</div>`);
  return out.join('');
}
function chDraw(toEnd) {
  if (ui.view !== 'chat') { if (ui.view === 'bot') { const c = $('.b2-ask'); if (c) { const v = ($('#askq') || {}).value || ''; c.outerHTML = askCard(); const t = $('#askq'); if (t) t.value = v; } } return; }
  const host = $('#view .view'); if (!host) return;
  const log = $('#chlog'), atEnd = !log || log.scrollHeight - log.scrollTop - log.clientHeight < 80;
  const ta = $('#chq'), focus = ta && document.activeElement === ta, pos = ta ? [ta.selectionStart, ta.selectionEnd] : null;
  if (ta) CHT.draft = ta.value;
  const keep = log ? log.scrollTop : 0;
  host.innerHTML = viewChat() + (OPT.extras ? OPT.extras(ui.view) : '');
  chMount();
  const l2 = $('#chlog'); if (l2) l2.scrollTop = toEnd || atEnd ? l2.scrollHeight : keep;
  const t2 = $('#chq'); if (t2 && focus) { t2.focus({ preventScroll: true }); if (pos) try { t2.setSelectionRange(pos[0], pos[1]); } catch (e) { /* fine */ } }
}
function chMount() {
  const ta = $('#chq'); if (!ta) return;
  const fit = () => { ta.style.height = 'auto'; ta.style.height = Math.min(220, ta.scrollHeight) + 'px'; };
  fit(); chFit();
  ta.addEventListener('input', () => { CHT.draft = ta.value; fit(); chKeep(); if (CHT.call && !LS.on) chHeard(); });
  const sel = $('#chwho'); if (sel) sel.addEventListener('change', () => { CHT.who = sel.value || 'pm'; chKeep(); chDraw(); const s2 = $('#chwho'); if (s2) s2.focus(); });
  const l = $('#chlog'); if (l) l.scrollTop = l.scrollHeight;
  if (CHT.list === null || (CHT.cur && !CHT.th)) chatLoad();
}
function chFit() {  // the Chat fills the window under the top bar (and above the tab bar on a narrow window)
  const c = $('#chat'); if (!c) return;
  const tabs = $('.tabs'), tb = tabs && getComputedStyle(tabs).display !== 'none' ? tabs.getBoundingClientRect().height + 22 : 22;
  const top = c.getBoundingClientRect().top + window.scrollY;
  c.style.height = Math.max(460, window.innerHeight - top - tb) + 'px';
}
function chDropBind() {  // files dragged onto the window go to the PM (and never open in the window by themselves)
  const isFiles = e => !!(e.dataTransfer && [...(e.dataTransfer.types || [])].includes('Files'));
  let depth = 0;
  window.addEventListener('dragenter', e => { if (!isFiles(e)) return; e.preventDefault(); depth++; chDropShow(true); });
  window.addEventListener('dragover', e => { if (!isFiles(e)) return; e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; });
  window.addEventListener('dragleave', e => { if (!isFiles(e)) return; depth = Math.max(0, depth - 1); if (!depth) chDropShow(false); });
  window.addEventListener('drop', e => { if (!isFiles(e)) return; e.preventDefault(); depth = 0; chDropShow(false); if (e.dataTransfer.files && e.dataTransfer.files.length) chDropFiles(e.dataTransfer.files); });
  window.addEventListener('resize', () => { if (ui.view === 'chat') chFit(); });
}
function chDropShow(on) {
  let d = $('#chdropall');
  if (!on) { if (d) d.remove(); return; }
  if (d) return;
  d = document.createElement('div'); d.id = 'chdropall'; d.className = 'ch-dropall'; d.setAttribute('aria-hidden', 'true');
  d.innerHTML = `<div><span>${CH_ICON.clip}</span><b>Drop to give ${CHT.cur && CHT.th && CHT.th.who !== 'pm' ? 'them to the PM (a new chat)' : 'them to the PM'}</b><small>PDFs, pictures, Word, Excel, CSV or text · up to 25 MB each</small></div>`;
  document.body.appendChild(d);
}
async function chSend(text) {
  const A = api(), ta = $('#chq');
  const q = String(text != null ? text : ta ? ta.value : CHT.draft || '').trim();
  const toks = CHT.files.filter(f => f.ok).map(f => f.token);
  if (!A || !A.chat_send) { toast('The Chat works in the Mac app.'); return; }
  if (!q && !toks.length) { if (ta) ta.focus(); return; }
  if (LS.on) chListenStop();
  if (CHT.th && CHT.th.pending) { toast(`${chName(CHT.th.who)} is still answering your last message.`); return; }
  const who = CHT.cur && CHT.th ? CHT.th.who : (($('#chwho') || {}).value || CHT.who || 'pm');
  if (who !== 'pm' && toks.length) { toast('Only the PM reads files. Pick the PM in “Talk to”, or take the files off.'); return; }
  const btn = $('.ch-send'); if (btn) btn.disabled = true;
  let r; try { r = await A.chat_send(CHT.cur || '', q, toks, who); } catch (e) { r = { ok: false, error: String(e) }; }
  if (!r || !r.ok) { if (btn) btn.disabled = false; toast((r && r.error) || 'That didn’t send. Try again.'); return; }
  CHT.files = []; CHT.draft = ''; CHT.cur = r.id; CHT.th = r.thread; CHT.who = who; if (ta) ta.value = '';
  CHT.wait[r.id] = Date.now(); chUpsert(r.thread); chKeep();
  if (CHT.call) chCallSt('Thinking about it…');
  chDraw(true); chPoll();
}
function chPoll() {
  if (CHT.poll) return;
  CHT.poll = setInterval(async () => {
    const A = api(), ids = Object.keys(CHT.wait);
    if (!A || !ids.length) { clearInterval(CHT.poll); CHT.poll = null; return; }
    const s = $('#chsecs'); if (s && CHT.cur) s.textContent = chSecs(CHT.cur);
    for (const id of ids) {
      if ((Date.now() - CHT.wait[id]) % 4000 > 2100 && id !== CHT.cur) continue;  // other conversations: every other tick
      let th; try { th = await A.chat_get(id); } catch (e) { continue; }
      if (!th || th.missing) { delete CHT.wait[id]; continue; }
      if (th.pending) continue;
      delete CHT.wait[id];
      chUpsert(th);
      const last = (th.messages || []).slice(-1)[0] || {};
      const looking = ui.view === 'chat' && CHT.cur === id && document.hasFocus();
      if (CHT.cur === id) { CHT.th = th; chDraw(true); } else chDraw();
      if (!looking && A.chat_notice && !last.error) A.chat_notice(chName(th.who), String(last.text || '').replace(/[*_`#>|]+/g, ''));
      if (CHT.call && CHT.cur === id && !last.error) chSpeak((th.messages || []).length - 1, true);
    }
  }, 2000);
}
async function chAttach() {
  const A = api(); if (!A || !A.chat_pick) return;
  const b = $('[data-act="chattach"]'); if (b) b.disabled = true;
  let r; try { r = await A.chat_pick(); } catch (e) { r = { files: [] }; }
  if (b) b.disabled = false;
  chAdd((r && r.files) || []);
}
function chAdd(fs) {
  if (!fs.length) return;
  CHT.files = [...CHT.files, ...fs].slice(-8);
  chKeep(); chDraw(); const t = $('#chq'); if (t) t.focus();
  fs.filter(f => !f.ok).forEach(f => toast(f.error || `${f.name} can’t be read.`, 5000));  // after drawing, so it sits above the file list
}
function chDropFiles(list) {
  const A = api(); if (!A || !A.chat_drop) return;
  const fs = [...list].slice(0, 8);
  if ($('#call') || $('#wn') || $('#tour') || $('#boss')) return;  // not in the middle of What's new, the tour or the boardroom
  closeSheet(); if ($('#room')) roomClose(true);
  if (ui.view !== 'chat') { ui.view = 'chat'; draw(); }
  if (CHT.cur && CHT.th && CHT.th.who !== 'pm') { CHT.cur = null; CHT.th = null; CHT.who = 'pm'; chDraw(); toast('Files go to the PM: this is a new chat with the PM.'); }
  else if (!CHT.cur && CHT.who !== 'pm') { CHT.who = 'pm'; chKeep(); chDraw(); toast('Files go to the PM, so this chat is with the PM now.'); }
  Promise.all(fs.map(f => new Promise(res => {
    if (f.size > 25 * 1048576) { res({ ok: false, name: f.name, error: `${f.name} is too big (the most is 25 MB).` }); return; }
    const rd = new FileReader();
    rd.onload = () => A.chat_drop(f.name, rd.result).then(res, () => res({ ok: false, name: f.name, error: 'That file didn’t come through.' }));
    rd.onerror = () => res({ ok: false, name: f.name, error: 'That file couldn’t be read.' });
    rd.readAsDataURL(f);
  }))).then(chAdd);
}
function chMic() { return chListen(CHT.call); }  // 2.1: the app listens by itself; the Mac's Dictation is the fallback
async function chMic0() {
  const A = api(), ta = $('#chq'); if (!A) return;
  if (ta) ta.focus();
  let r; try { r = await A.chat_dictate(); } catch (e) { r = { ok: false }; }
  if (!r || !r.ok) toast('To talk: press the 🎤 key on the top row of your keyboard (or the Fn key twice), say your message, then press it again.', 7000);
  else if (CHT.call) chCallSt('Listening… it sends when you stop talking.');
}
let chHeardT = null;
function chHeard() {  // call mode: what you said is sent once you stop talking for a moment
  clearTimeout(chHeardT);
  const ta = $('#chq'); if (!ta || !ta.value.trim()) return;
  chCallSt('Got it… sending when you stop talking.');
  const v = ta.value;
  chHeardT = setTimeout(() => { const t = $('#chq'); if (CHT.call && t && t.value === v && !(CHT.th && CHT.th.pending)) chSend(); }, 2600);
}
function chCallSt(t) { CHT.callSt = t; const e = $('#chcallst'); if (e) e.textContent = t; }
async function chSpeak(i, thenListen) {
  const A = api(), m = CHT.th && (CHT.th.messages || [])[i]; if (!A || !m) return;
  if (CHT.speaking === i) { CHT.speaking = -1; A.chat_hush(); chDraw(); return; }
  CHT.speaking = i; chDraw(); if (CHT.call) chCallSt('Reading the answer out loud…');
  try { await A.chat_say(m.text); } catch (e) { /* it stopped */ }
  if (CHT.speaking === i) { CHT.speaking = -1; chDraw(); }
  if (thenListen && CHT.call) { chCallSt('Your turn: talk after the microphone turns on.'); setTimeout(() => { if (CHT.call) chMic(); }, 500); }
}
/* ---------------- 2.1: the Call listens by itself, and the owner makes the PM their own ----------------
   An owner (2026-11-15): the Call "doesn't hear him and he can't hear it" (it leaned on the Mac's Dictation, which is
   often turned off, so nothing was ever sent and nothing read back). Now signal_lab/listen.py hears with the Mac's
   speech recognition, and signal_lab/persona.py holds how the PM talks: name, personality, detail, voice, speed. */
const LS = { on: false, t: null, base: '', send: false };
const PMS = { d: null };
async function pmLoad() { const A = api(); if (!A || !A.pm_get) return null; try { PMS.d = await A.pm_get(); } catch (e) { PMS.d = null; } return PMS.d; }
function pmName() { return String((PMS.d && PMS.d.pm && PMS.d.pm.name) || '').trim(); }
async function chListen(send) {
  const A = api(), ta = $('#chq'); if (!A) return;
  if (!A.call_listen) return chMic0();  // the app's Python is older than this page: the Mac's Dictation
  if (LS.on) { chListenStop(); if (CHT.call) chCallSt('Stopped listening. Press Talk when you’re ready.'); return; }
  CHT.callFix = '';
  if (CHT.call) chCallSt('Turning the microphone on…');
  let r; try { r = await A.call_listen(); } catch (e) { r = { ok: false, why: 'other' }; }
  if (!r || !r.ok) { chListenFail(r || {}); return; }
  LS.on = true; LS.send = !!send; LS.base = ta && ta.value.trim() ? ta.value.trim() + ' ' : '';
  chDraw();
  if (CHT.call) chCallSt('Listening… talk now. It sends when you stop.'); else toast('Listening… talk now. It stops when you do.');
  clearInterval(LS.t); LS.t = setInterval(chListenTick, 250);
}
async function chListenTick() {
  const A = api(); if (!A || !LS.on) return;
  let p; try { p = await A.call_poll(); } catch (e) { return; }
  if (!LS.on || !p) return;
  const ta = $('#chq');
  if (p.text && ta) { ta.value = LS.base + p.text; ta.dispatchEvent(new Event('input')); }
  const w = $('.ch-wave'); if (w) w.classList.toggle('quiet', (p.level || 0) < 0.06);
  if (p.text && CHT.call) chCallSt('“' + (p.text.length > 110 ? '…' + p.text.slice(-110) : p.text) + '”');
  if (p.final || !p.listening) {
    clearInterval(LS.t); LS.on = false; chDraw();
    if (p.error && !p.text) { chListenFail({ error: p.error }); return; }
    const said = ta && ta.value.trim();
    if (LS.send && CHT.call && said && !(CHT.th && CHT.th.pending)) chSend();
    else if (CHT.call && !said) chCallSt('I didn’t catch that. Press Talk and try again.');
  }
}
function chListenStop() { const A = api(); clearInterval(LS.t); if (LS.on && A && A.call_stop) A.call_stop(); if (LS.on) { LS.on = false; chDraw(); } }
function chListenFail(r) {
  const why = r.why || '', msg = r.error || 'The microphone didn’t start. Try again, or type instead.';
  if (why === 'unavailable') { chMic0(); return; }  // no speech recognition on this Mac: the Mac's own Dictation
  CHT.callFix = why === 'mic' || why === 'speech' ? why : '';
  if (CHT.call) { chDraw(); chCallSt(msg); } else toast(msg, 9000);
}

/* ---------------- The Call, for real: a live phone call with the PM ----------------
   An owner (2026-11-16): the old Call "sucks… it's so robotic and it basically just text to speech… make it an actual
   call like how ChatGPT does it". The old one only dictated into the message box and read the long written answer out
   loud. Now the app's call engine keeps the line open (A.call_begin / call_state / call_tap / call_mute / call_end):
   it always listens, the PM answers in about a second in short spoken sentences, and the owner can cut in.
   This is its screen, full window like a phone call: one calm orb that listens, thinks and talks, big captions, and
   four buttons (Mute, Captions, Voice, End). When the call ends, the words are saved in that Chat conversation.
   Nothing here trades: a change the PM suggests on the call waits for the owner's OK in the Chat afterwards. */
const CALL = { on: false, tid: null, s: null, t: 0, raf: 0, lv: 0, want: 0, fails: 0, back: null, guard: null, ending: false,
  cc: true, voices: null, pop: false, picked: '', hold: null, paint: {} };
try { CALL.cc = localStorage.getItem('ct-call-cc') !== '0'; } catch (e) { /* private mode: captions stay on */ }
const CALL_IC = {
  mic: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/></svg>',
  micoff: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 10.5V6a3 3 0 0 0-5.6-1.5M9 9v2a3 3 0 0 0 4.7 2.5M5 11a7 7 0 0 0 11.2 5.6M19 11a7 7 0 0 1-.5 2.6M12 18v3M4 4l16 16"/></svg>',
  cc: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="3"/><path d="M10.5 10.2a2.3 2.3 0 1 0 0 3.6M17 10.2a2.3 2.3 0 1 0 0 3.6"/></svg>',
  voice: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 10v4M8 7v10M12 4v16M16 8v8M20 11v2"/></svg>',
  end: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3.2 13.6c4.9-4.4 12.7-4.4 17.6 0 .6.6.6 1.5 0 2.1l-1.6 1.5c-.5.5-1.3.5-1.9.1l-2-1.4c-.4-.3-.6-.7-.6-1.2v-1.6a12 12 0 0 0-5.4 0v1.6c0 .5-.2.9-.6 1.2l-2 1.4c-.6.4-1.4.4-1.9-.1l-1.6-1.5c-.6-.6-.6-1.5 0-2.1z"/></svg>',
  check: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>',
  wait: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 7v5l3 2"/><circle cx="12" cy="12" r="8.5"/></svg>',
};
const CALL_KIND = { siri: 'Siri', premium: 'Premium', enhanced: 'Enhanced' };

// The Call button (and the Today card's "Call the PM") come here. An app whose Python is older than this page has no
// call engine: then the old call bar in the Chat (chCallOld) still works.
function chCall() {
  const A = api();
  if (A && A.call_begin && !CHT.call) { callOpen(CHT.th && CHT.th.who === 'pm' ? CHT.cur : null, document.activeElement); return; }
  chCallOld();
}
function chCallOld() {  // 2.0/2.1: the call bar in the Chat (dictate, send, read the answer out loud)
  const A = api();
  CHT.call = !CHT.call; CHT.callSt = '';
  if (!CHT.call) { clearTimeout(chHeardT); chListenStop(); CHT.callFix = ''; if (A) A.chat_hush(); CHT.speaking = -1; chDraw(); return; }
  chDraw(); setTimeout(chMic, 300);
}

// A page reload in the middle of a call (CT_canReload waits while one is open, but an update or a crash may not) brings
// the call screen back: the call itself runs in the app's Python and never stopped.
async function callResume() {
  const A = api(); if (phone || !A || !A.call_state || $('#call')) return;
  let s; try { s = await A.call_state(); } catch (e) { return; }
  if (s && ['connecting', 'listening', 'thinking', 'speaking'].includes(s.state)) callOpen(s.tid || null, null);
}
function callOpen(tid, from) {
  const A = api();
  if (!A || !A.call_begin) { chCallOld(); return; }
  if ($('#call')) return;
  if (CHT.call) chCallOld();  // the old call bar was on: switch it off first
  if (LS.on) chListenStop();
  if (CHT.speaking >= 0) { CHT.speaking = -1; if (A.chat_hush) A.chat_hush(); }
  closeSheet();
  Object.assign(CALL, { tid: tid || null, s: null, back: from || document.activeElement, ending: false, pop: false, picked: '', hold: null,
    fails: 0, lv: 0, want: 0, paint: {} });
  const lights = '<div class="lights"><button class="c" data-act="win" data-w="close" aria-label="Hide" title="Hide the window. The call keeps going."></button><button class="m" data-act="win" data-w="min" aria-label="Minimize"></button><button class="f" data-act="win" data-w="full" aria-label="Full screen"></button></div>';
  const el = document.createElement('div');
  el.id = 'call'; el.className = 'cl st-connecting' + (CALL.cc ? '' : ' nocc');
  el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true'); el.setAttribute('aria-labelledby', 'cl-name'); el.setAttribute('aria-describedby', 'cl-safe');
  el.tabIndex = -1;
  el.innerHTML = `<div class="cl-bg" aria-hidden="true"></div>
    <header class="cl-top ct-drag">${lights}
      <div class="cl-id ct-drag"><b class="cl-name" id="cl-name">${esc(pmName() || 'Your PM')}</b><span class="cl-time" aria-label="How long the call has been on"></span></div>
      <p class="cl-safe ct-drag" id="cl-safe">It never trades. You still OK every order.</p></header>
    <div class="cl-stage">
      <button type="button" class="cl-orb" data-c="orb" aria-label="Connecting">
        <span class="cl-amp" aria-hidden="true"><span class="cl-breath"><span class="cl-glow"></span><span class="cl-ring"></span><span class="cl-ring r2"></span><span class="cl-ring r3"></span>
          <span class="cl-core"></span><span class="cl-swirl"></span><span class="cl-sheen"></span></span></span></button>
      <div class="cl-status" role="status" aria-live="polite">Connecting…</div>
      <div class="cl-hint">Turning the microphone on</div>
      <div class="cl-err" role="alert" hidden></div></div>
    <div class="cl-cap" aria-label="Captions"></div>
    <div class="cl-chip" hidden>${CALL_IC.wait}<span></span></div>
    <div class="cl-ctl" role="group" aria-label="Call controls">
      <button type="button" class="cl-b" data-c="mute" aria-pressed="false" aria-label="Mute your microphone" title="Mute (M)"><span class="ic">${CALL_IC.mic}</span><span class="lb">Mute</span></button>
      <button type="button" class="cl-b" data-c="cc" aria-pressed="${CALL.cc}" aria-label="Captions" title="Captions (C)"><span class="ic">${CALL_IC.cc}</span><span class="lb">Captions</span></button>
      <button type="button" class="cl-b" data-c="voice" aria-haspopup="dialog" aria-expanded="false" aria-label="Choose the voice" title="Voice"><span class="ic">${CALL_IC.voice}</span><span class="lb">Voice</span></button>
      <button type="button" class="cl-b cl-end" data-c="end" aria-label="End the call" title="End the call (Esc)"><span class="ic">${CALL_IC.end}</span><span class="lb">End</span></button></div>
    <p class="cl-keys" aria-hidden="true"><kbd>Space</kbd> cut in · <kbd>M</kbd> mute · <kbd>C</kbd> captions · <kbd>Esc</kbd> end</p>
    <div class="cl-pop" role="dialog" aria-label="The PM’s voice" hidden></div>`;
  document.body.appendChild(el);
  [...document.body.children].forEach(c => { if (c !== el && !c.matches('.toast')) { c.dataset.clInert = c.inert ? '1' : ''; c.inert = true; } });
  document.documentElement.classList.add('call-lock');
  callBind(el);
  el.focus({ preventScroll: true });
  cancelAnimationFrame(CALL.raf); CALL.raf = requestAnimationFrame(callLoop);
  callBegin();
}
async function callBegin() {  // also "Try again" after an error
  const A = api(); if (!A || !$('#call') || CALL.ending) return;
  clearTimeout(CALL.t); CALL.on = true; CALL.fails = 0;
  callPaint({ state: 'connecting', seconds: 0, turns: [], cards: [], muted: false });
  let r; try { r = await A.call_begin(CALL.tid); } catch (e) { r = { ok: false, why: 'other' }; }
  if (!$('#call') || CALL.ending) return;
  if (!r || !r.ok) {
    CALL.on = false;
    callPaint({ state: 'error', error: (r && r.error) || 'The call didn’t start. Try again in a moment.', fix: (r && r.fix) || '', turns: [], cards: [] });
    return;
  }
  callPoll();
}
async function callPoll() {  // one question at a time, about every 150 ms, until the call ends
  const A = api(); if (!CALL.on || !A || !A.call_state) return;
  let s; try { s = await A.call_state(); } catch (e) { s = null; }
  if (!CALL.on || CALL.ending || !$('#call')) return;
  if (!s) {
    if (++CALL.fails > 40) { CALL.on = false; callPaint(Object.assign({}, CALL.s, { state: 'error', error: 'The call lost touch with the app. Try again.', fix: '' })); return; }
  } else {
    CALL.fails = 0; callPaint(s);
    if (s.state === 'ended') { callEnd(); return; }
    if (s.state === 'error') { CALL.on = false; return; }
  }
  CALL.t = setTimeout(callPoll, 150);
}

const callClock = n => { n = Math.max(0, Math.floor(+n || 0)); const h = Math.floor(n / 3600), m = Math.floor(n / 60) % 60, s = String(n % 60).padStart(2, '0'); return h ? `${h}:${String(m).padStart(2, '0')}:${s}` : `${m}:${s}`; };
function callStatus(s) {
  const st = s.state;
  if (st === 'error') return 'The call stopped';
  if (st === 'ended') return 'Call ended';
  if (st === 'connecting') return 'Connecting…';
  if (s.searching && (st === 'thinking' || st === 'speaking')) return 'Looking it up…';
  if (st === 'thinking') return 'Thinking…';
  if (st === 'speaking') return 'Tap or press Space to cut in';
  return s.muted ? 'Muted' : 'Listening';
}
function callHint(s) {
  const st = s.state;
  if (st === 'connecting') return 'Turning the microphone on';
  if (s.muted) return st === 'listening' ? 'Press Mute or M to talk again' : 'Your microphone is off';
  if (st === 'listening' && s.note && !s.heard) return s.note;  // 2.2.1: e.g. no sound at all from the microphone
  if (st === 'listening') return s.heard ? 'It answers when you pause. Tap the circle to send now.' : (s.turns || []).length ? '' : 'Just talk. It answers when you pause.';
  return '';
}
function callOrbLabel(s) {
  const st = s.state;
  if (st === 'speaking' || st === 'thinking') return 'Cut in';
  if (st === 'listening') return s.heard ? 'Send what you said now' : 'Listening';
  return st === 'connecting' ? 'Connecting' : 'The call';
}
// Captions: the line being said now (big and bright) under the one before it (dimmer). Never a wall of text: the box
// holds about three lines, the newest at the bottom, and the top fades out.
function callCaps(s) {
  const flat = t => String(t || '').replace(/\s+/g, ' ').trim();
  const tail = (t, n) => { t = flat(t); if (t.length <= n) return t; const c = t.slice(-n); return '…' + c.slice(c.indexOf(' ') + 1); };
  const rows = (s.turns || []).slice(-2).map(t => ({ who: t.who === 'you' ? 'you' : 'pm', text: flat(t.text) + (t.cut ? ' —' : '') }));
  const last = (w) => { for (let i = rows.length - 1; i >= 0; i--) if (rows[i].who === w) return rows[i].text; return ''; };
  const say = flat(s.saying), heard = flat(s.heard);
  if (s.state === 'speaking' && say && !last('pm').startsWith(say)) rows.push({ who: 'pm', text: say });
  if (heard && !last('you').startsWith(heard)) rows.push({ who: 'you', text: heard });
  const two = rows.slice(-2);
  if (!two.length) return s.state === 'listening' && !s.muted ? '<p class="cl-l idle">Say hello, or ask anything about your account.</p>' : '';
  return two.map((r, i) => {
    const now = i === two.length - 1, t = tail(r.text, now ? 260 : 140);
    return `<p class="cl-l ${r.who}${now ? ' now' : ' old'}">${r.who === 'you' ? '“' + esc(t) + '”' : esc(t)}</p>`;
  }).join('');
}
function callPaint(s) {  // draws the state; each piece changes only when its words change (it runs ~7 times a second)
  const el = $('#call'); if (!el) return;
  s = Object.assign({ state: 'connecting', turns: [], cards: [] }, s || {});
  if (CALL.hold && Date.now() < CALL.hold.until) s.muted = CALL.hold.muted; else CALL.hold = null;  // the Mute press wins over an older answer
  CALL.s = s;
  const P = CALL.paint, st = s.state;
  const put = (sel, k, v, html) => { if (P[k] === v) return; P[k] = v; const n = $(sel, el); if (n) n[html ? 'innerHTML' : 'textContent'] = v; };
  const cls = 'cl st-' + st + (s.muted ? ' muted' : '') + (s.searching ? ' searching' : '') + (CALL.cc ? '' : ' nocc') + (CALL.ending ? ' ending' : '');
  if (P.cls !== cls) { el.className = cls; P.cls = cls; }
  put('.cl-name', 'name', String(s.pm || pmName() || 'Your PM'));
  put('.cl-time', 'time', st === 'connecting' || st === 'error' && !s.seconds ? '' : callClock(s.seconds));
  if (!CALL.ending) put('.cl-status', 'status', callStatus(s));
  put('.cl-hint', 'hint', callHint(s));
  put('.cl-cap', 'cap', callCaps(s), true);
  const orb = $('.cl-orb', el), ol = callOrbLabel(s); if (P.orb !== ol) { P.orb = ol; orb.setAttribute('aria-label', ol); orb.title = st === 'speaking' || st === 'thinking' ? 'Cut in (Space)' : ''; }
  const n = (s.cards || []).length, chip = $('.cl-chip', el);
  if (P.chip !== n) { P.chip = n; chip.hidden = !n; $('span', chip).textContent = 'Waiting for your OK in the Chat after the call' + (n > 1 ? ` (${n})` : ''); }
  const mb = $('[data-c="mute"]', el), mu = !!s.muted;
  if (P.mute !== mu) { P.mute = mu; mb.setAttribute('aria-pressed', mu); mb.setAttribute('aria-label', mu ? 'Unmute your microphone' : 'Mute your microphone'); $('.ic', mb).innerHTML = mu ? CALL_IC.micoff : CALL_IC.mic; $('.lb', mb).textContent = mu ? 'Unmute' : 'Mute'; }
  const vb = $('[data-c="voice"]', el), vt = s.voice ? 'Voice: ' + s.voice : 'Voice'; if (P.voice !== vt) { P.voice = vt; vb.title = vt; }
  const err = st === 'error' ? (s.error || 'The call stopped.') + '|' + (s.fix || '') : '';
  if (P.err !== err) {
    P.err = err; const box = $('.cl-err', el);
    box.hidden = !err;
    box.innerHTML = err ? `<p>${esc(s.error || 'The call stopped.')}</p><div class="cl-row">
        ${s.fix ? '<button type="button" class="cl-pill go" data-c="fix">Open the setting</button>' : ''}<button type="button" class="cl-pill${s.fix ? '' : ' go'}" data-c="retry">Try again</button><button type="button" class="cl-pill q" data-c="close">Close</button></div>
        ${s.fix ? `<small>Turn on ${esc(APP)} there, come back, and press Try again.</small>` : ''}` : '';
    if (err) { callVoices(false); const b = $('.cl-err button', el); if (b) b.focus({ preventScroll: true }); }
  }
  const lv = +s.level || 0;
  CALL.want = st === 'listening' && !s.muted && lv > 0.03 ? Math.min(1, Math.pow(lv, 0.6) * 1.1) : 0;
}
function callLoop() {  // the orb swells with your voice: quick to grow, slow to settle, never a jump
  const el = $('#call'); if (!el) { CALL.raf = 0; return; }
  const d = CALL.want - CALL.lv;
  if (Math.abs(d) > 0.002) { CALL.lv += d * (d > 0 ? 0.3 : 0.08); const a = $('.cl-amp', el); if (a) a.style.setProperty('--lv', CALL.lv.toFixed(3)); }
  CALL.raf = requestAnimationFrame(callLoop);
}

async function callTap() {  // the orb (or Space): cut in while the PM talks, or send now while you talk
  const A = api(), s = CALL.s; if (!A || !A.call_tap || !s || !CALL.on || CALL.ending) return;
  if (!['listening', 'thinking', 'speaking'].includes(s.state) || (s.state === 'listening' && (s.muted || !s.heard))) return;
  const o = $('#call .cl-orb'); if (o) { o.classList.remove('tap'); void o.offsetWidth; o.classList.add('tap'); }
  let r; try { r = await A.call_tap(); } catch (e) { r = null; }
  if (r && r.state && CALL.s && CALL.on) callPaint(Object.assign({}, CALL.s, { state: r.state }));
}
async function callMute() {
  const A = api(), s = CALL.s; if (!A || !A.call_mute || !s || !CALL.on || CALL.ending || s.state === 'error') return;
  const on = !s.muted;
  CALL.hold = { muted: on, until: Date.now() + 900 }; callPaint(s);
  let r; try { r = await A.call_mute(on); } catch (e) { r = null; }
  if (r && typeof r.muted === 'boolean' && CALL.s) { CALL.hold = { muted: r.muted, until: Date.now() + 400 }; callPaint(CALL.s); }
}
function callCC() {
  const el = $('#call'); if (!el) return;
  CALL.cc = !CALL.cc;
  try { localStorage.setItem('ct-call-cc', CALL.cc ? '1' : '0'); } catch (e) { /* it lasts until the page reloads */ }
  $('[data-c="cc"]', el).setAttribute('aria-pressed', CALL.cc);
  callPaint(CALL.s);
}

// The voice picker: the most natural voices first (Siri, then Premium and Enhanced), the joke voices last.
async function callVoices(open) {
  const el = $('#call'), A = api(); if (!el) return;
  const pop = $('.cl-pop', el), btn = $('[data-c="voice"]', el);
  const want = open == null ? !CALL.pop : !!open;
  if (!want) {
    if (!CALL.pop) return;
    CALL.pop = false; pop.hidden = true; btn.setAttribute('aria-expanded', 'false');
    if (pop.contains(document.activeElement)) btn.focus({ preventScroll: true });
    return;
  }
  if (!A || !A.call_voices) return;
  CALL.pop = true; btn.setAttribute('aria-expanded', 'true'); pop.hidden = false;
  if (!CALL.voices) {
    pop.innerHTML = '<p class="cl-pl">Finding the voices on this Mac…</p>'; callPopPlace();
    let v; try { v = await A.call_voices(); } catch (e) { v = null; }
    CALL.voices = Array.isArray(v) ? v : [];
    if (!CALL.pop) return;
  }
  callVoiceList(true);
}
function callVoiceList(focus) {
  const el = $('#call'); if (!el || !CALL.pop) return;
  const pop = $('.cl-pop', el), V = CALL.voices || [], cur = CALL.picked || (CALL.s && CALL.s.voice_id) || '';
  const best = V.filter(v => CALL_KIND[v.kind]), other = V.filter(v => v.kind === 'standard' || (!CALL_KIND[v.kind] && v.kind !== 'novelty')), fun = V.filter(v => v.kind === 'novelty');
  const row = v => `<button type="button" class="cl-v${v.id === cur ? ' on' : ''}" data-c="pick" data-id="${esc(v.id)}" aria-pressed="${v.id === cur}">
      <span class="cl-vn">${esc(v.label || v.id)}</span><span class="cl-vl">${esc(String(v.lang || '').replace('_', '-'))}</span>${CALL_KIND[v.kind] ? `<span class="cl-vk k-${esc(v.kind)}">${CALL_KIND[v.kind]}</span>` : ''}<span class="cl-vc">${v.id === cur ? CALL_IC.check : ''}</span></button>`;
  const group = (t, list) => list.length ? `<div class="cl-vg" role="group" aria-label="${esc(t)}"><h4>${esc(t)}</h4>${list.map(row).join('')}</div>` : '';
  pop.innerHTML = `<div class="cl-ph"><b>The PM’s voice</b><span>It says a short line in the voice you pick.</span></div>
    <div class="cl-vs">${V.length ? group('Most natural', best) + group('Other voices', other) + group('Just for fun', fun) : '<p class="cl-pl">No voices came back. The Mac’s own voice is used.</p>'}</div>
    <p class="cl-pn">More natural voices: System Settings → Accessibility → Spoken Content → System voice → Manage Voices</p>`;
  callPopPlace();
  if (focus) { const b = $('.cl-v.on', pop) || $('.cl-v', pop); if (b) { b.focus({ preventScroll: true }); b.scrollIntoView({ block: 'nearest' }); } }
}
function callPopPlace() {  // just above the Voice button, kept inside the window
  const el = $('#call'); if (!el) return;
  const pop = $('.cl-pop', el), r = $('[data-c="voice"]', el).getBoundingClientRect(), W = window.innerWidth;
  const w = Math.min(380, W - 32);
  pop.style.width = w + 'px';
  pop.style.left = Math.round(Math.max(16, Math.min(W - w - 16, r.left + r.width / 2 - w / 2))) + 'px';
  pop.style.bottom = Math.round(window.innerHeight - r.top + 12) + 'px';
  pop.style.maxHeight = Math.max(180, Math.min(480, Math.round(r.top - 24))) + 'px';
}
async function callVoicePick(b) {
  const A = api(), id = b.dataset.id; if (!A || !A.call_voice || b.classList.contains('busy')) return;
  b.classList.add('busy');
  let r; try { r = await A.call_voice(id); } catch (e) { r = null; }
  b.classList.remove('busy');
  if (!r || !r.ok) { const p = $('#call .cl-pn'); if (p) p.textContent = (r && r.error) || 'That voice didn’t work. Try another one.'; return; }
  CALL.picked = id; if (CALL.s) { CALL.s.voice_id = id; if (r.voice) CALL.s.voice = r.voice; }
  callVoiceList(false);
  const nb = $(`#call .cl-v[data-id="${CSS.escape(id)}"]`); if (nb) nb.focus({ preventScroll: true });
}

async function callEnd() {  // End, Escape, Close, or the call ended by itself: save it in the Chat and show it there
  const A = api(), el = $('#call'); if (!el || CALL.ending) return;
  CALL.ending = true; CALL.on = false; clearTimeout(CALL.t); callVoices(false);
  el.classList.add('ending'); const stl = $('.cl-status', el); if (stl) stl.textContent = 'Ending the call…';
  let r = null; try { r = A && A.call_end ? await A.call_end() : null; } catch (e) { r = null; }
  const s = CALL.s || {}, tid = (r && r.tid) || s.tid || CALL.tid, said = (s.turns || []).length > 0;
  callClose();
  if (!tid || !said) return;
  CHT.hide = null; CHT.who = 'pm';
  if (ui.view !== 'chat') { ui.view = 'chat'; draw(); }  // the same steps as opening a conversation from the list (chopen)
  await chOpen(tid);
  if (CHT.th && CHT.cur === tid) { chUpsert(CHT.th); chDraw(true); }
  toast('The call is saved in the Chat.');
  const cb = $('.ch-callb'); if (cb) cb.focus({ preventScroll: true });
}
function callClose() {
  const el = $('#call'); if (!el) return;
  CALL.on = false; clearTimeout(CALL.t); cancelAnimationFrame(CALL.raf); CALL.raf = 0; CALL.pop = false;
  if (CALL.guard) document.removeEventListener('keydown', CALL.guard, true); CALL.guard = null;
  window.removeEventListener('resize', callResize);
  [...document.body.children].forEach(c => { if (c !== el && c.dataset.clInert !== undefined) { c.inert = c.dataset.clInert === '1'; delete c.dataset.clInert; } });
  document.documentElement.classList.remove('call-lock');
  el.removeAttribute('id');  // gone for everyone at once ($('#call'), dragZones), while it fades out
  el.classList.add('out');
  setTimeout(() => el.remove(), matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 280);
  if (CALL.back && CALL.back.isConnected) CALL.back.focus({ preventScroll: true });
}
function callResize() { if (CALL.pop) callPopPlace(); }
function callBind(el) {
  el.addEventListener('click', e => {
    const b = e.target.closest('[data-c]');
    if (CALL.pop && !e.target.closest('.cl-pop') && !(b && b.dataset.c === 'voice')) callVoices(false);  // a click outside closes the picker
    if (!b || b.disabled) return;
    const k = b.dataset.c, A = api();
    if (k === 'orb') callTap();
    else if (k === 'mute') callMute();
    else if (k === 'cc') callCC();
    else if (k === 'voice') callVoices();
    else if (k === 'pick') callVoicePick(b);
    else if (k === 'end' || k === 'close') callEnd();
    else if (k === 'retry') { CALL.paint.err = ''; callBegin(); }
    else if (k === 'fix' && A && A.call_privacy) A.call_privacy((CALL.s && CALL.s.fix) || 'mic');
  });
  window.addEventListener('resize', callResize);
  // The keys, only while the call is open (the app behind hears none of them). ⌘ and Ctrl shortcuts still work.
  CALL.guard = e => {
    const box = $('#call'); if (!box) return;
    if (e.metaKey || e.ctrlKey || e.altKey || e.isComposing) return;
    const k = e.key, onBtn = e.target.closest && e.target.closest('button'), typing = e.target.closest && e.target.closest('input,textarea,select,[contenteditable]');
    if (!box.contains(e.target)) box.focus({ preventScroll: true });  // focus slipped out (to the page): bring it back and carry on
    e.stopPropagation();
    if (k === 'Escape') { e.preventDefault(); if (CALL.pop) callVoices(false); else callEnd(); return; }
    if (k === 'Tab') {  // focus stays inside the call screen
      const fs = [...box.querySelectorAll('button:not([disabled])')].filter(x => x.getClientRects().length);
      if (!fs.length) return;
      const i = fs.indexOf(document.activeElement);
      if (e.shiftKey && i <= 0) { e.preventDefault(); fs[fs.length - 1].focus(); }
      else if (!e.shiftKey && (i === -1 || i === fs.length - 1)) { e.preventDefault(); fs[0].focus(); }
      return;
    }
    if (typing || e.repeat) return;
    if (k === ' ') { if (onBtn) return; e.preventDefault(); callTap(); }  // Space on a focused button presses that button
    else if (k === 'm' || k === 'M') { e.preventDefault(); callMute(); }
    else if (k === 'c' || k === 'C') { e.preventDefault(); callCC(); }
    else if (CALL.pop && (k === 'ArrowDown' || k === 'ArrowUp')) {
      const vs = $$('.cl-v', box), i = vs.indexOf(document.activeElement); if (!vs.length) return;
      e.preventDefault(); vs[Math.max(0, Math.min(vs.length - 1, i + (k === 'ArrowDown' ? 1 : -1)))].focus();
    }
  };
  document.addEventListener('keydown', CALL.guard, true);
}
// A message said on a call gets a small tag in the Chat (chMsg puts it in front of the time).
function callTag(m) { return m && m.call ? '<span class="ch-calltag" title="Said on a call"><span aria-hidden="true">📞</span> On the call</span>' : ''; }

const PM_SPEED = [[0, 'Normal'], [150, 'Slow'], [170, 'Relaxed'], [210, 'Brisk'], [240, 'Fast'], [280, 'Very fast']];
function pmForm(d) {
  const p = d.pm || {}, V = d.voices || [], T = d.tones || [], D = d.details || [];
  const real = V.filter(v => v.kind !== 'novelty'), fun = V.filter(v => v.kind === 'novelty');
  const star = v => v.kind === 'siri' || v.kind === 'premium' || v.kind === 'enhanced' ? ' ★' : '';
  const vo = v => `<option value="${esc(v.name)}"${p.voice === v.name ? ' selected' : ''}>${esc(v.label || v.name)}${v.lang ? ' · ' + esc(v.lang.replace('_', '-')) : ''}${star(v)}</option>`;
  const nm = pmName() || 'The PM';
  return `<div class="pm-f">
    <p class="pm-lead">Make the PM yours. This changes how it talks, never what it’s allowed to do: your strategy still comes first, it never trades, and you OK every order.</p>
    <div class="fs"><h3>Its name</h3>
      <div class="row"><label class="f">Call it<input data-pm="name" type="text" maxlength="30" value="${esc(p.name || '')}" placeholder="The PM" autocomplete="off"></label>
      <label class="f">It calls you<input data-pm="call_me" type="text" maxlength="30" value="${esc(p.call_me || '')}" placeholder="${esc(d.owner || 'Your name')}" autocomplete="off"></label></div></div>
    <div class="fs"><h3>Personality</h3>
      <div class="pm-tones">${T.map(t => `<button type="button" class="pm-t${p.tone === t.id ? ' on' : ''}" data-act="chpmtone" data-k="${esc(t.id)}" aria-pressed="${p.tone === t.id}"><b>${esc(t.label)}</b><span>${esc(t.blurb || '')}</span></button>`).join('')}</div></div>
    <div class="fs"><h3>How much it says</h3>
      <div class="pm-seg" role="group" aria-label="How much it says">${D.map(x => `<button type="button" class="pm-s${p.detail === x.id ? ' on' : ''}" data-act="chpmdet" data-k="${esc(x.id)}" aria-pressed="${p.detail === x.id}"><b>${esc(x.label)}</b>${x.blurb ? `<span>${esc(x.blurb)}</span>` : ''}</button>`).join('')}</div></div>
    <div class="fs"><h3>Its voice on calls</h3>
      <div class="row pm-vrow"><label class="f">Voice<select data-pm="voice"><option value=""${p.voice ? '' : ' selected'}>The most natural one${d.best ? ' (' + esc(d.best) + ')' : ''}</option>
        ${real.length ? `<optgroup label="Voices">${real.map(vo).join('')}</optgroup>` : ''}${fun.length ? `<optgroup label="Just for fun">${fun.map(vo).join('')}</optgroup>` : ''}</select></label>
      <label class="f">Speed<select data-pm="rate">${PM_SPEED.map(([r, l]) => `<option value="${r}"${(+p.rate || 0) === r ? ' selected' : ''}>${l}</option>`).join('')}</select></label>
      <button type="button" class="btn quiet pm-play" data-act="chpmprev">${CH_ICON.say}<span>Hear it</span></button></div>
      <p class="d">★ marks the most natural voices. For more: System Settings → Accessibility → Spoken Content → System voice → Manage Voices, then come back here.</p></div>
    <div class="fs"><h3>Anything else</h3><p class="d">How you like to be talked to. ${esc(nm)} reads it every time.</p>
      <textarea class="st-ta" data-pm="notes" rows="3" maxlength="600" aria-label="Anything else about how it talks to you" placeholder="Like “skip the jargon”, “lead with the bottom line” or “always tell me the worst case”">${esc(p.notes || '')}</textarea></div>
    <input type="hidden" data-pm="tone" value="${esc(p.tone || '')}"><input type="hidden" data-pm="detail" value="${esc(p.detail || '')}">
  </div>`;
}
function pmv(f) { const el = $(`#layer [data-pm="${f}"]`); return el ? el.value : ''; }
async function openPM() {
  const d = await pmLoad();
  if (!d) { toast('This works in the Mac app.'); return; }
  const foot = `<div class="save"><button class="btn go" data-act="chpmsave">Save</button><button class="btn quiet" data-act="close">Cancel</button><button class="link pm-reset" data-act="chpmreset">Back to the original PM</button><span class="err" id="pmerr" role="alert"></span></div>`;
  openSheet('<span class="eyebrow">Your PM</span>', pmForm(d), foot);
  ui.sheet = 'pm';
  const sh = $('#layer .sheet'); if (sh) sh.classList.add('sheet-pm');
}
function pmPick(act, k) {
  const f = act === 'chpmtone' ? 'tone' : 'detail', el = $(`#layer [data-pm="${f}"]`); if (el) el.value = k;
  $$(`#layer [data-act="${act}"]`).forEach(b => { const on = b.dataset.k === k; b.classList.toggle('on', on); b.setAttribute('aria-pressed', on); });
}
function pmVals() { return { name: pmv('name').trim(), call_me: pmv('call_me').trim(), tone: pmv('tone'), detail: pmv('detail'), voice: pmv('voice'), rate: +pmv('rate') || 0, notes: pmv('notes').trim() }; }
async function pmPreview(el) {
  const A = api(); if (!A || !A.pm_preview) return;
  if (el.classList.contains('on')) { A.chat_hush(); return; }
  const v = pmVals(); el.classList.add('on'); const s = el.querySelector('span'); if (s) s.textContent = 'Stop';
  try { await A.pm_preview(v.voice, v.rate); } catch (e) { /* stopped */ }
  el.classList.remove('on'); if (s) s.textContent = 'Hear it';
}
async function pmSave() {
  const A = api(), er = $('#pmerr'); if (!A) return;
  let r; try { r = await A.pm_save(pmVals()); } catch (e) { r = null; }
  if (!r || !r.ok) { if (er) er.textContent = (r && r.error) || 'That didn’t save. Try again.'; return; }
  if (PMS.d) PMS.d.pm = r.pm;
  A.chat_hush(); closeSheet(); if (ui.view === 'chat') chDraw(); else draw();
  toast(`Saved. ${pmName() || 'The PM'} talks your way from the next answer.`);
}
async function pmReset(el) {
  const A = api(); if (!A) return;
  if (!el.classList.contains('sure')) { el.classList.add('sure'); el.textContent = 'Sure? Press again'; setTimeout(() => { if (el.isConnected) { el.classList.remove('sure'); el.textContent = 'Back to the original PM'; } }, 4000); return; }
  try { await A.pm_reset(); } catch (e) { /* nothing to undo */ }
  await pmLoad(); closeSheet(); if (ui.view === 'chat') chDraw(); else draw(); toast('Back to the original PM.');
}
function chAct(act, el) {
  const A = api();
  if (act === 'chgo') { ui.view = 'chat'; draw(); }
  else if (act === 'chnew') chNew('pm');
  else if (act === 'chcallnew') { if (A && A.call_begin) callOpen(null, el); else { chNew('pm'); if (!CHT.call) chCall(); } }
  else if (act === 'chfilesnew') { chNew('pm'); chAttach(); }
  else if (act === 'chopen') { CHT.hide = null; if (ui.view !== 'chat') { ui.view = 'chat'; draw(); } chOpen(el.dataset.id); }
  else if (act === 'chhide') {
    const id = el.dataset.id;
    if (CHT.hide !== id) { CHT.hide = id; chDraw(); setTimeout(() => { if (CHT.hide === id) { CHT.hide = null; chDraw(); } }, 4000); return; }
    CHT.hide = null; if (A) A.chat_archive(id).then(r => { CHT.list = (r && r.threads) || (CHT.list || []).filter(t => t.id !== id); if (CHT.cur === id) { CHT.cur = null; CHT.th = null; } chKeep(); chDraw(); toast('Taken off the list. It’s kept in the archive.'); });
  }
  else if (act === 'chside') { CHT.side = !CHT.side; chDraw(); }
  else if (act === 'chsend') chSend();
  else if (act === 'chsugg') chSend(el.dataset.q);
  else if (act === 'chattach') chAttach();
  else if (act === 'chunfile') { CHT.files.splice(+el.dataset.k, 1); chKeep(); chDraw(); }
  else if (act === 'chmic') chMic();
  else if (act === 'chcall') chCall();
  else if (act === 'chfix') { if (A && A.call_privacy) A.call_privacy(CHT.callFix || 'mic'); chCallSt('Turn on SRM Finance there, come back, and press Talk.'); }
  else if (act === 'chpm') openPM();
  else if (act === 'chpmtone' || act === 'chpmdet') pmPick(act, el.dataset.k);
  else if (act === 'chpmprev') pmPreview(el);
  else if (act === 'chpmsave') pmSave();
  else if (act === 'chpmreset') pmReset(el);
  else if (act === 'chhush') { CHT.speaking = -1; if (A) A.chat_hush(); chDraw(); }
  else if (act === 'chsay') chSpeak(+el.dataset.i);
  else if (act === 'chcopy') { const m = CHT.th && CHT.th.messages[+el.dataset.i]; if (m) copyOut(m.text, 'The answer is copied'); }
  else if (act === 'chapply' && A && CHT.cur) {
    el.disabled = true;
    A.chat_apply(CHT.cur, +el.dataset.i, el.dataset.w).then(r => {
      if (!r || !r.ok) { el.disabled = false; toast((r && r.error) || 'That didn’t work. Try again.'); return; }
      if (r.thread) CHT.th = r.thread;
      if (el.dataset.w === 'strategy') regrade(r.said); else { toast(r.said); chDraw(); }
    });
  }
  else return false;
  return true;
}

/* ---------------- settings (Mac) ---------------- */
/* ---------------- The owner's strategy (SRM Finance 2.0) ----------------
   Sam's dad (2026-11-15): he told the firm to be "way more aggressive and spend the cash", and it was "held back by what
   seemed to be a cement set in stone rule set". Now the owner sets how bold the firm is (signal_lab/strategy.py): an
   approach, every part of it, and their own words. It comes before the firm's own habits everywhere. */
const STRAT_ORDER = ['careful', 'index', 'balanced', 'growth', 'aggressive', 'all_in'];
const STRAT_ICON = { careful: '🛡', index: '🧺', balanced: '⚖️', growth: '🌱', aggressive: '🚀', all_in: '🔥', custom: '🎛', usual: '🎛' };
const ST_TAG = { best: 'Suggested for you', near: 'Also a good fit', safer: 'Safer than your answers', riskier: 'Riskier than your answers' };
const ST_KEYS = ['words', 'approach', 'name', 'mine_id', 'based_on', 'horizon', 'comfort'];  // changing these doesn't make it your own
function stratOf() { return S.strategy || null; }
function stratChip() {
  const st = stratOf(); if (!st || phone) return '';
  return `<button class="chip strat-chip" data-act="strat" aria-label="Your strategy: ${esc(st.label)}. Change it"><i></i>Strategy: ${esc(st.label)} ›</button>`;
}
function stratFacts(p) {
  return [`${p.cash_keep_pct}% kept in cash`, `up to ${p.max_stock_pct}% in one stock`, `${p.max_stocks} stocks at most`, `stops ${p.stops}`];
}
function stratCard() {
  const st = stratOf(); if (!st) return '';
  const P = st.presets || {}, pre = P[st.approach], base = P[st.based_on];
  const words = st.words ? `<p class="st-words">“${esc(st.words)}”</p>` : '';
  const bf = pre ? `<p class="st-bf">Best for: ${esc(pre.best)}</p>` : st.approach === 'custom' ? `<p class="st-bf">Your own${base ? ' version of ' + esc(base.label) : ' strategy'}</p>` : '';
  return `<section class="card panel strat-card"><h2><span class="st-ic" aria-hidden="true">${STRAT_ICON[st.approach] || '🎛'}</span>Your strategy <span>${st.chosen ? 'you set it' + (st.updated_at ? ' ' + esc(fmtD(st.updated_at)) : '') : 'not chosen yet'}</span></h2>
    <p class="st-name">${esc(st.label)}</p>${bf}
    <ul class="st-facts">${stratFacts(st).map(f => `<li>${esc(f)}</li>`).join('')}<li>core funds ${esc({ keep: 'kept', flexible: 'can be sold', none: 'not needed' }[st.core] || st.core)}</li></ul>${words}
    ${phone ? '' : `<button class="btn${st.chosen ? '' : ' go'}" data-act="strat">${st.chosen ? 'Change the strategy' : 'Pick a strategy'}</button>`}
    <p class="dim st-note">The PM and every desk follow it before their own habits. You still OK every order.</p></section>`;
}
function stratRank(st, h, c) {  // the presets by fit to the two answers (strategy.rank does the same in Python)
  const P = st.presets || {}, F = st.fit || {}, H = F.horizons || {}, C = F.comfort || {};
  const keys = (st.order || STRAT_ORDER).filter(k => P[k]);
  if (!H[h]) return keys.map(k => ({ key: k, tag: '' }));
  const t = H[h].v + (C[c] ? C[c].v : 0), risk = k => P[k].risk;
  return keys.slice().sort((a, b) => (Math.abs(risk(a) - t) - Math.abs(risk(b) - t)) || (risk(a) - risk(b)))
    .map((k, i) => { const d = risk(k) - t; return { key: k, tag: i === 0 ? 'best' : Math.abs(d) <= 1 ? 'near' : d < 0 ? 'safer' : 'riskier' }; });
}
function stratForm(st) {
  const F = st.fit || {}, cust = st.approach === 'custom', all = st.budget === 'all';
  const opt = (o, v) => Object.entries(o).map(([k, t]) => `<option value="${esc(k)}"${k === v ? ' selected' : ''}>${esc(t)}</option>`).join('');
  const num = (k, label, v, min, max, help) => `<label class="f">${label}<input data-st="${k}" type="number" min="${min}" max="${max}" step="1" value="${esc(v)}">${help ? `<small>${help}</small>` : ''}</label>`;
  const pills = (o, cur, act, lab) => `<div class="st-opts" role="group" aria-labelledby="${lab}">${Object.entries(o || {}).map(([k, x]) => `<button type="button" class="st-o${k === cur ? ' on' : ''}" data-act="${act}" data-k="${esc(k)}" aria-pressed="${k === cur}">${esc(x.label)}</button>`).join('')}</div>`;
  const hid = (k, v) => `<input type="hidden" data-st="${k}" value="${esc(v || '')}">`;
  return `<div class="form stform">
    <p class="st-lead">You decide how bold the firm is. The PM, every desk and the order list follow this before their own habits. Every order still needs your OK, and you place each one yourself.</p>
    <div class="fs st-qs"><h3>Two quick questions</h3><p class="d">Your answers rank the strategies below. You can still pick any of them.</p>
      <p class="st-ql" id="stq-h">When might you need this money?</p>${pills(F.horizons, st.horizon, 'sth', 'stq-h')}
      <p class="st-short" id="stshort"${st.horizon === 'lt2' ? '' : ' hidden'}>Money you’ll need within 2 years is usually safest in savings, not in stocks. If you invest it anyway, Careful is the gentlest way.</p>
      <p class="st-ql" id="stq-c">If your account fell 30% in a bad year, you’d… <span>optional</span></p>${pills(F.comfort, st.comfort, 'stc', 'stq-c')}</div>
    <div class="fs"><h3>Pick a strategy</h3><p class="d" id="strk-d"></p>
      <div class="st-grid" id="stgrid" role="group" aria-label="Strategies"></div>
      <div id="stmine"></div>
      <div class="st-acts"><button type="button" class="btn" data-act="stedit" id="stedit" hidden></button><button type="button" class="btn" data-act="stown">＋ Make your own</button></div>
      <p class="st-risk" id="strisk" hidden>⚠ Bolder means bigger swings both ways. In a bad month a bold account can fall a lot more than the market. The firm still puts a warning on every risky order.</p></div>
    <details class="fs st-tune" id="sttune"${cust ? ' open' : ''}><summary>Fine-tune it</summary>
      <p class="d">Picking a strategy above fills these in. Change any of them and it becomes your own, saved under its name with your strategies.</p>
      <label class="f st-nm" id="stnm"${cust ? '' : ' hidden'}>Name it<input data-st="name" type="text" maxlength="40" value="${esc(st.name || '')}" placeholder="Like “Spend the cash”" autocomplete="off"></label>
      <div class="row">
      ${num('cash_keep_pct', 'Keep in cash (%)', st.cash_keep_pct, 0, 90, '0 means spend it all')}
      ${num('max_stock_pct', 'Most in one stock (%)', st.max_stock_pct, 2, 100, 'of the account; QQQ and SPY don’t count')}
      ${num('max_stocks', 'Most stocks at once', st.max_stocks, 1, 60, 'the firm spreads money across up to this many')}
      <label class="f">Plan with<select data-st="budget_mode"><option value="all"${all ? ' selected' : ''}>The whole account</option><option value="set"${all ? '' : ' selected'}>Up to a set amount</option></select></label>
      <label class="f" id="stbud"${all ? ' hidden' : ''}>Set amount ($)<input data-st="budget" type="number" min="0" step="100" value="${esc(all ? 10000 : st.budget)}"></label></div>
      <div class="row st-split">${['long', 'medium', 'short'].map(k => num('split.' + k, HZ[k] + ' (%)', st.split[k], 0, 100)).join('')}</div>
      <div class="row st-sel">
      <label class="f">Core funds (QQQ and SPY)<select data-st="core">${opt(st.core_opts || {}, st.core)}</select></label>
      <label class="f">Stop-losses<select data-st="stops">${opt(st.stops_opts || {}, st.stops)}</select></label>
      <label class="f">Pace<select data-st="pace">${opt(st.pace_opts || {}, st.pace)}</select></label></div></details>
    <div class="fs"><h3>In your own words</h3><p class="d">Anything else about how you want to invest. The firm reads it every time it plans.</p>
      <textarea class="st-ta" data-st="words" rows="3" maxlength="600" aria-label="Your strategy in your own words" placeholder="Like “be way more aggressive and spend the cash” or “no more than $2,000 in any one tech stock”">${esc(st.words || '')}</textarea></div>
    ${hid('approach', st.approach)}${hid('mine_id', st.mine_id)}${hid('based_on', st.based_on)}${hid('horizon', st.horizon)}${hid('comfort', st.comfort)}
  </div>`;
}
function stv(f) { const el = $(`#layer [data-st="${f}"]`); return el ? el.value : ''; }
function stset(f, v) { const el = $(`#layer [data-st="${f}"]`); if (el) el.value = v == null ? '' : v; }
function stratDraw() {  // the ranked presets and the owner's own, from what the sheet holds right now
  const st = stratOf(), g = $('#stgrid'); if (!st || !g) return;
  const P = st.presets || {}, ap = stv('approach'), h = stv('horizon'), c = stv('comfort'), mid = stv('mine_id');
  const a = document.activeElement, back = a && a.dataset && a.closest && a.closest('#stgrid, #stmine') ? [a.dataset.act, a.dataset.k || a.dataset.id] : null;
  const R = stratRank(st, h, c), ranked = !!(R[0] && R[0].tag), er = $('#sterr');
  if (er) er.textContent = '';  // "Pick one first" goes away once they do something about it
  g.innerHTML = R.map((r, i) => {
    const k = r.key, p = P[k], on = ap === k;
    return `<button type="button" class="st-p st-${k}${on ? ' on' : ''}${r.tag === 'best' ? ' best' : ''}" data-act="stpick" data-k="${k}" aria-pressed="${on}">
      <span class="st-top">${ranked ? `<span class="st-rk">${i + 1}</span>` : ''}<span class="st-pi" aria-hidden="true">${STRAT_ICON[k] || '🎛'}</span><b>${esc(p.label)}</b>${r.tag ? `<span class="st-tag t-${r.tag}">${esc(ST_TAG[r.tag])}</span>` : ''}${on ? '<span class="st-mk">✓ Your pick</span>' : ''}</span>
      <span class="st-bf">Best for: ${esc(p.best)}</span><span class="st-pl">${esc(p.line)}</span><span class="st-pf">${stratFacts(p).map(esc).join(' · ')}</span></button>`;
  }).join('');
  const M = st.mine || [], mm = $('#stmine');
  if (mm) mm.innerHTML = !M.length ? '' : `<h4 class="st-mh">Your own</h4><div class="st-mine">${M.map(x => {
    const on = ap === 'custom' && mid === x.id, used = st.chosen && st.approach === 'custom' && st.mine_id === x.id, b = P[x.based_on];
    return `<div class="st-m${on ? ' on' : ''}"><span class="st-pi" aria-hidden="true">🎛</span><div class="st-mt"><b>${esc(x.name)}</b><span class="st-pf">${b ? 'Your version of ' + esc(b.label) + ' · ' : ''}${stratFacts(x.values).map(esc).join(' · ')}</span></div>
      <div class="st-ma">${on ? '<span class="st-mk">✓ Your pick</span>' : `<button type="button" class="btn" data-act="stuse" data-id="${esc(x.id)}" aria-label="Use ${esc(x.name)}">Use</button>`}<button type="button" class="btn" data-act="stmedit" data-id="${esc(x.id)}" aria-label="Edit ${esc(x.name)}">Edit</button>${used ? '<span class="st-inuse">In use</span>' : `<button type="button" class="btn st-del" data-act="stdel" data-id="${esc(x.id)}" aria-label="Remove ${esc(x.name)}">Remove</button>`}</div></div>`;
  }).join('')}</div>`;
  const d = $('#strk-d'); if (d) d.textContent = ranked ? 'Ranked by how well each one fits your answers, not by past returns. No strategy is sure to make money.' : 'Safest first. Answer the first question and the best fit for you is marked Suggested.';
  const e = $('#stedit'); if (e) { const p = P[ap]; e.hidden = !p; if (p) e.textContent = `✎ Edit ${p.label}`; }
  const bold = ['aggressive', 'all_in'], rk = $('#strisk');
  if (rk) rk.hidden = !(bold.includes(ap) || (ap === 'custom' && bold.includes(stv('based_on'))));
  const sh = $('#stshort'); if (sh) sh.hidden = h !== 'lt2';
  [['sth', h], ['stc', c]].forEach(([act, v]) => $$(`#layer [data-act="${act}"]`).forEach(b => { const on = b.dataset.k === v; b.classList.toggle('on', on); b.setAttribute('aria-pressed', on); }));
  const nm = $('#stnm'); if (nm) nm.hidden = ap !== 'custom';
  if (back && back[1]) {  // a click redraws the list: keep the keyboard where it was
    const n = $(`#layer [data-act="${back[0]}"][data-k="${back[1]}"]`) || $(`#layer [data-act="${back[0]}"][data-id="${back[1]}"]`) || $(`#stmine [data-id="${back[1]}"]`);
    if (n) n.focus();
  }
}
function openStrategy() {
  const st = stratOf(); if (!st) return;
  const foot = `<div class="save"><button class="btn go" data-act="stsave">Save the strategy</button><button class="btn quiet" data-act="close">Cancel</button><span class="err" id="sterr" role="alert"></span></div>`;
  openSheet('<span class="eyebrow">Your strategy</span>', stratForm(st), foot);
  ui.sheet = 'strategy';
  const sh = $('#layer .sheet'); if (!sh) return;
  sh.classList.add('sheet-strat');
  stratDraw();
  sh.addEventListener('input', e => {
    const k = e.target.dataset && e.target.dataset.st;
    if (!k || ST_KEYS.includes(k)) return;
    if (k === 'budget_mode') { const b = $('#stbud'); if (b) b.hidden = e.target.value === 'all'; }
    const ap = stv('approach'), p = (st.presets || {})[ap];
    if (p) { stset('approach', 'custom'); stset('based_on', ap); stset('mine_id', ''); if (!stv('name')) stset('name', `${p.label}, my way`); stratDraw(); }
    else if (ap !== 'custom') { stset('approach', 'custom'); stratDraw(); }
  });
}
function stratFill(v) {  // a preset's or an own strategy's numbers into the fine-tuner
  ['cash_keep_pct', 'max_stock_pct', 'max_stocks', 'core', 'stops', 'pace'].forEach(f => stset(f, v[f]));
  ['long', 'medium', 'short'].forEach(f => stset('split.' + f, (v.split || {})[f]));
  const all = v.budget === undefined || v.budget === 'all';
  stset('budget_mode', all ? 'all' : 'set'); if (!all) stset('budget', v.budget);
  const b = $('#stbud'); if (b) b.hidden = all;
}
function stratPick(k) {
  const p = ((stratOf() || {}).presets || {})[k]; if (!p) return;
  stratFill(p); stset('approach', k); stset('mine_id', ''); stset('based_on', ''); stset('name', '');
  stratDraw();
}
function stratUse(id, edit) {  // one of the owner's own: Use picks it, Edit picks it and opens it at the name
  const x = ((stratOf() || {}).mine || []).find(m => m.id === id); if (!x) return;
  stratFill(x.values); stset('approach', 'custom'); stset('mine_id', x.id); stset('based_on', x.based_on); stset('name', x.name);
  stratDraw(); if (edit) stratTune();
}
function stratTune() {  // open the fine-tuner at the name, ready to type
  const t = $('#sttune'); if (t) t.open = true;
  const n = $('#layer [data-st="name"]'); if (!n) return;
  n.scrollIntoView({ block: 'center' }); n.focus({ preventScroll: true }); n.select();
}
function stratEdit() {  // "Edit Growth": the owner's own copy of the picked preset; the preset itself stays as it is
  const ap = stv('approach'), p = ((stratOf() || {}).presets || {})[ap]; if (!p) return;
  stset('approach', 'custom'); stset('based_on', ap); stset('mine_id', ''); stset('name', `${p.label}, my way`);
  stratDraw(); stratTune();
}
function stratOwn() {  // "Make your own": from what's filled in now, under a new name
  const ap = stv('approach'), P = (stratOf() || {}).presets || {};
  if (P[ap]) stset('based_on', ap);
  stset('approach', 'custom'); stset('mine_id', ''); stset('name', '');
  stratDraw(); stratTune();
}
function stratAnswer(f, k) {
  stset(f, f === 'comfort' && stv(f) === k ? '' : k);  // the optional one clears with a second click
  stratDraw();
}
async function stratDel(el) {  // two clicks: "Remove" asks "Remove it?" for 4 seconds
  if (!el.classList.contains('sure')) {
    el.classList.add('sure'); el.textContent = 'Remove it?';
    setTimeout(() => { if (el.isConnected) { el.classList.remove('sure'); el.textContent = 'Remove'; } }, 4000);
    return;
  }
  const A = api(); if (!A || !A.strategy_forget) return;
  const id = el.dataset.id, r = await A.strategy_forget(id);
  if (!r || !r.ok) { toast((r && r.error) || 'Couldn’t remove it.'); return; }
  const st = stratOf(); if (st && r.strategy) st.mine = r.strategy.mine || [];
  if (stv('mine_id') === id) stset('mine_id', '');
  stratDraw(); toast('Removed.');
  const o = $('#layer [data-act="stown"]'); if (o) o.focus();
}
async function stratSave(btn) {
  const A = api(); if (!A || !A.strategy_save) return;
  const v = stv, err = $('#sterr');
  if (v('approach') === 'usual') { err.textContent = 'Pick one of the strategies first, or make your own.'; const g = $('#stgrid'); if (g) g.scrollIntoView({ block: 'center' }); return; }
  const split = { long: +v('split.long') || 0, medium: +v('split.medium') || 0, short: +v('split.short') || 0 };
  if (split.long + split.medium + split.short <= 0) { err.textContent = 'The split needs at least one part above 0.'; return; }
  const data = { approach: v('approach'), cash_keep_pct: v('cash_keep_pct'), max_stock_pct: v('max_stock_pct'), max_stocks: v('max_stocks'),
    split, core: v('core'), stops: v('stops'), pace: v('pace'), words: v('words'), budget: v('budget_mode') === 'all' ? 'all' : v('budget'),
    name: v('name'), mine_id: v('mine_id'), based_on: v('based_on'), horizon: v('horizon'), comfort: v('comfort') };
  btn.disabled = true; btn.textContent = 'Saving…';
  try {
    const r = await A.strategy_save(data);
    if (!r || !r.ok) throw new Error((r && r.error) || 'Couldn’t save it.');
    S.strategy = r.strategy || S.strategy;
    closeSheet();
    regrade(`Saved: ${(r.strategy && r.strategy.label) || 'your strategy'}. The PM, every desk and the order list follow it from now on.`);
  } catch (e) { err.textContent = e.message || String(e); btn.disabled = false; btn.textContent = 'Save the strategy'; }
}
/* ---------------- SRM Finance 2.0: the feedback board (signal_lab/feedback.py) ----------------
   Anyone using a copy tells the app's maker what's wrong, what they'd add or what they don't get. It travels through
   the shared updates folder (the Mac app's keeper, about hourly, and whenever the board opens). The maker's copy (the
   git folder) reads every copy's notes, answers them and says where each one stands; "Copy for Claude" writes them out
   for a Claude chat about the app. Not on the phone: it stays on the Mac. */
const FB_ICON = { problem: '⚠️', idea: '💡', question: '❓' };
const FB_ASK = { problem: 'What happened?', idea: 'What would you add or change?', question: 'What would you like to know?' };
const FB_TIP = {
  problem: 'What you pressed, what you expected, and what happened instead.',
  idea: 'What it would do for you. Small ideas are welcome too.',
  question: 'Anything about the app, the firm or how it decides.',
};
const FB = { kind: 'problem', where: '', draft: '', fresh: new Set(), box: {}, mt: {}, at: {}, st: {}, closed: false, note: false };
function fbWhen(iso) {
  const t = new Date(iso); if (isNaN(t)) return '';
  const tm = t.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  return new Date().toDateString() === t.toDateString() ? `today, ${tm}` : `${MON[t.getMonth()]} ${t.getDate()}, ${tm}`;
}
function fbBtn() {  // the top bar's Feedback button, with a dot while something is new
  const fb = S.feedback; if (!fb || phone) return '';
  const n = fb.unread || 0;
  const tip = fb.maker ? 'What the people using the app have told you' : `Tell ${fb.maker_name} what to fix or add`;
  return `<button class="ibtn fb-btn" id="fbbtn" data-act="feedback" aria-label="Feedback${n ? `, ${n} new` : ''}" title="${esc(tip)}">${ICON.fb}<span class="lbl">Feedback</span>${n ? '<i class="fb-dot" aria-hidden="true"></i>' : ''}</button>`;
}
function fbDot() { const b = $('#fbbtn'); if (b) b.outerHTML = fbBtn(); }
function fbStatus(x, fb) {
  if (!fb.maker && x.status === 'new') return fb.shared && (fb.sent || {}).ok !== false ? 'Sent' : 'Saved here';
  return x.status_label || 'New';
}
function fbItem(x, fb) {
  const maker = fb.maker, note = maker && !x.copy, id = esc(x.id);
  const who = maker ? (note ? (x.by || 'Your note') : `${x.by || 'Someone'}${x.mac ? ` on ${x.mac}` : ''}`) : 'You';
  const meta = [who, fbWhen(x.at), x.where_label ? `about ${x.where_label}` : '', x.version ? `v${x.version}` : ''].filter(Boolean).map(esc).join(' · ');
  const reps = (x.replies || []).map(r => {
    const nm = r.maker ? (maker ? 'You' : (r.by || fb.maker_name)) : (maker ? (r.by || 'They') : 'You');
    return `<div class="fb-r${r.maker ? ' mk' : ''}"><p class="fb-rh"><b>${esc(nm)}</b><span>${esc(fbWhen(r.at))}</span></p><p class="fb-rt">${esc(r.text)}</p></div>`;
  }).join('');
  const isNew = FB.fresh.has(x.id), open = !!FB.box[x.id];
  let acts = '', box = '';
  if (maker) {
    const cur = FB.st[x.id] || x.status;
    acts = `<button class="btn fb-sm" data-act="fbbox" data-id="${id}" aria-expanded="${open}" aria-controls="fbx-${id}">${open ? 'Close' : 'Answer'}</button>
      <button class="btn quiet fb-sm" data-act="fbcopy" data-id="${id}">Copy for Claude</button>`;
    box = `<div class="fb-box" id="fbx-${id}"${open ? '' : ' hidden'}>
      <label class="f"><span>Where it stands</span><select data-fbs="${id}">${Object.entries(fb.status || {}).map(([k, l]) => `<option value="${esc(k)}"${k === cur ? ' selected' : ''}>${esc(l)}</option>`).join('')}</select></label>
      <label class="f"><span>Your answer <em>${note ? '(a note for yourself)' : `(${esc(x.by || 'they')} sees it on their copy)`}</em></span>
        <textarea class="st-ta" data-fba="${id}" rows="3" maxlength="1000" placeholder="What changed, or what you need to know">${esc(FB.at[x.id] || '')}</textarea></label>
      <div class="fb-ab"><button class="btn go" data-act="fbans" data-id="${id}">Save</button><span class="err" id="fbe-${id}" role="alert"></span></div></div>`;
  } else {
    acts = `<button class="btn fb-sm" data-act="fbbox" data-id="${id}" aria-expanded="${open}" aria-controls="fbx-${id}">${open ? 'Close' : 'Add more'}</button>
      ${fb.shared ? '' : `<button class="btn quiet fb-sm" data-act="fbcopy" data-id="${id}">Copy</button>`}`;
    box = `<div class="fb-box" id="fbx-${id}"${open ? '' : ' hidden'}>
      <label class="f"><span>What else should ${esc(fb.maker_name)} know?</span>
        <textarea class="st-ta" data-fbm="${id}" rows="3" maxlength="1000" placeholder="It still happens, a detail, a new idea about it">${esc(FB.mt[x.id] || '')}</textarea></label>
      <div class="fb-ab"><button class="btn go" data-act="fbmore" data-id="${id}">Send</button><span class="err" id="fbe-${id}" role="alert"></span></div></div>`;
  }
  return `<article class="fb-i s-${esc(x.status)}${isNew ? ' nw' : ''}" data-id="${id}">
    <div class="fb-top"><span class="fb-k">${FB_ICON[x.kind] || '💡'} ${esc(x.kind_label || '')}</span>
      ${isNew && !(maker && x.status === 'new') ? `<span class="fb-nw">${maker ? 'New reply' : 'New answer'}</span>` : ''}<span class="fb-s s-${esc(x.status)}">${esc(fbStatus(x, fb))}</span></div>
    <p class="fb-t">${esc(x.text)}</p><p class="fb-m">${meta}</p>${reps}
    <div class="fb-acts">${acts}</div>${box}</article>`;
}
function fbList(rows, fb, empty) {
  const shut = x => !(fb.open || []).includes(x.status);
  const open = rows.filter(x => !shut(x)), done = rows.filter(shut);
  if (!rows.length) return empty ? `<p class="fb-empty">${empty}</p>` : '';
  const more = done.length ? (FB.closed ? done.map(x => fbItem(x, fb)).join('') : '')
    + `<button class="btn quiet fb-more" data-act="fbclosed" aria-expanded="${FB.closed}">${FB.closed ? 'Hide' : 'Show'} ${done.length} done or won’t do</button>` : '';
  return (open.length ? open.map(x => fbItem(x, fb)).join('') : `<p class="fb-empty">Nothing open.</p>`) + more;
}
function fbForm(fb) {
  const maker = fb.maker, k = FB.kind;
  const pills = Object.entries(fb.kinds || {}).map(([key, l]) => `<button class="st-o${key === k ? ' on' : ''}" data-act="fbkind" data-k="${esc(key)}" aria-pressed="${key === k}">${FB_ICON[key] || ''} ${esc(l)}</button>`).join('');
  const where = Object.entries(fb.where || {}).map(([key, l]) => `<option value="${esc(key)}"${key === FB.where ? ' selected' : ''}>${esc(key ? l : 'Anywhere, or not sure')}</option>`).join('');
  return `<section class="fb-new" aria-labelledby="fbn-h">
    <h4 class="fb-h" id="fbn-h">${maker ? 'Write down something you were told' : 'Send feedback'}</h4>
    <p class="fb-ql" id="fbk-l">What is it?</p>
    <div class="st-opts" role="group" aria-labelledby="fbk-l">${pills}</div>
    <label class="f"><span>Where in the app? <em>(optional)</em></span><select data-fb="where">${where}</select></label>
    <label class="f"><span>${FB_ASK[k] || 'Tell us about it'} <em>${esc(FB_TIP[k] || '')}</em></span>
      <textarea class="st-ta" data-fb="text" rows="5" maxlength="2000" placeholder="${k === 'problem' ? 'Say it the way you’d tell a friend' : k === 'idea' ? 'It would be great if…' : 'How does…? Why did…?'}">${esc(FB.draft)}</textarea></label>
    <div class="fb-ab"><button class="btn go" data-act="fbsend">${maker ? 'Save the note' : 'Send'}</button><span class="err" id="fberr" role="alert"></span></div>
    ${maker ? '' : `<p class="fb-line">${esc(fb.line || '')}</p>`}</section>`;
}
function fbBody(fb) {
  if (!fb) return '<p class="d">Couldn’t open the feedback board. Try again in a moment.</p>';
  if (fb.maker) {
    const oth = fb.others || [], mine = fb.mine || [], open = [...oth, ...mine].filter(x => (fb.open || []).includes(x.status)).length;
    const empty = fb.shared ? 'Nothing yet. When someone using a copy that gets its updates from your shared folder sends feedback, it shows up here. The app looks about once an hour, and every time you open this.'
      : 'Pick the shared updates folder first (Settings → Updates), and feedback from the other copies shows up here.';
    return `<p class="fb-lead">The people using ${esc(APP)} tell you here what’s wrong, what they’d add and what they don’t get. Answer one and they see it on their copy within the hour. <b>Copy for Claude</b> writes them out for a Claude chat about the app, so Claude can make the change and answer them for you.</p>
      <div class="fb-bar"><span class="fb-n"><b>${open}</b> open</span><span class="fb-n"><b>${(fb.counts || {}).done || 0}</b> done</span>
        ${open ? '<button class="btn fb-sm" data-act="fbcopy">Copy the open ones for Claude</button>' : ''}</div>
      <section class="fb-sec" aria-labelledby="fbo-h"><h4 class="fb-h" id="fbo-h">From the people using the app</h4>${fbList(oth, fb, esc(empty))}</section>
      <section class="fb-sec" aria-labelledby="fbm-h"><h4 class="fb-h" id="fbm-h">Your notes</h4>
        <p class="fb-sub">Things you were told in person or want to remember. They stay on this Mac.</p>${fbList(mine, fb, '')}
        ${FB.note ? fbForm(fb) : '<button class="btn fb-sm" data-act="fbnote">＋ Write down something you were told</button>'}</section>`;
  }
  const mine = fb.mine || [];
  return `<p class="fb-lead">Something not working, an idea, or a question? ${esc(fb.maker_name)} made ${esc(APP)} and reads every note. Answers show up here, and your Mac tells you when one comes.</p>
    ${fbForm(fb)}
    ${mine.length ? `<section class="fb-sec" aria-labelledby="fbs-h"><h4 class="fb-h" id="fbs-h">What you’ve sent</h4>${fbList(mine, fb, '')}</section>` : ''}`;
}
function fbKeep() {  // what's typed survives a redraw
  const b = $('#fbbody'); if (!b) return;
  const t = $('[data-fb="text"]', b); if (t) FB.draft = t.value;
  const w = $('[data-fb="where"]', b); if (w) FB.where = w.value;
  $$('[data-fbm]', b).forEach(e => { FB.mt[e.dataset.fbm] = e.value; });
  $$('[data-fba]', b).forEach(e => { FB.at[e.dataset.fba] = e.value; });
  $$('[data-fbs]', b).forEach(e => { FB.st[e.dataset.fbs] = e.value; });
}
function fbKey(e) {  // a selector that finds the same control after a redraw
  for (const a of ['fb', 'fbm', 'fba', 'fbs']) if (e.dataset[a]) return `[data-${a}="${e.dataset[a]}"]`;
  if (e.dataset.act) return `[data-act="${e.dataset.act}"]` + (e.dataset.id ? `[data-id="${e.dataset.id}"]` : '') + (e.dataset.k ? `[data-k="${e.dataset.k}"]` : '');
  return '';
}
function fbRedraw(focus, keep = true) {  // keep: read what's typed first (false once it has been read and changed)
  const b = $('#fbbody'); if (!b) return;
  if (keep) fbKeep();
  const f = document.activeElement, key = focus || (f && b.contains(f) ? fbKey(f) : '');
  b.innerHTML = fbBody(S.feedback);
  // a box that just opened goes to the middle of the sheet: at its edge it would sit under the sticky Done bar
  if (key) { const e = $(key, b); if (e) { e.focus({ preventScroll: true }); if (focus) e.scrollIntoView({ block: 'center' }); } }
}
async function openFeedback() {
  const A = api(), fb0 = S.feedback;
  if (!fb0 && !(A && A.feedback_open)) return;
  FB.fresh = new Set(fb0 ? [...(fb0.mine || []), ...(fb0.others || [])].filter(x => x.unread).map(x => x.id) : []);
  const head = `<div><span class="eyebrow">Feedback</span><h3 class="su-t">${fb0 && fb0.maker ? 'What people are saying' : `Tell ${esc((fb0 || {}).maker_name || 'the maker')} what to fix or add`}</h3></div>`;
  openSheet(head, `<div class="form fbk" id="fbbody">${fbBody(fb0)}</div>`, '<div class="save"><span class="fb-sync" id="fbsync" aria-live="polite"></span><button class="btn go" data-act="close">Done</button></div>');
  if (!(A && A.feedback_open)) return;
  const sy = $('#fbsync'); if (sy) sy.textContent = 'Looking for anything new…';
  let fb = null; try { fb = await A.feedback_open(); } catch (e) { /* the page's copy will do */ }
  const sy2 = $('#fbsync');
  if (!fb) { if (sy2) sy2.textContent = ''; return; }
  [...(fb.mine || []), ...(fb.others || [])].forEach(x => { if (x.unread) FB.fresh.add(x.id); });
  S.feedback = Object.assign({}, fb, { unread: 0 });
  if (sy2) sy2.textContent = fb.seen_at ? `Checked ${fbWhen(fb.seen_at)}` : '';
  fbRedraw(); fbDot();
}
function fbKind(k) { fbKeep(); FB.kind = k; fbRedraw(`[data-act="fbkind"][data-k="${k}"]`, false); }
function fbErr(id, t) { const e = $(id); if (e) e.textContent = t || ''; }
async function fbCall(btn, fn, busy, done) {
  const A = api(); if (!A) { toast('Open the app on the Mac to send feedback.'); return null; }
  const was = btn.textContent; btn.disabled = true; btn.textContent = busy;
  let r; try { r = await fn(A); } catch (e) { r = { ok: false, error: String(e) }; }
  if (btn.isConnected) { btn.disabled = false; btn.textContent = was; }
  if (!r || !r.ok) return r || { ok: false, error: 'Couldn’t save that. Try again.' };
  if (r.feedback) S.feedback = Object.assign({}, r.feedback, { unread: 0 });
  if (done) toast(done, 5000);
  return r;
}
async function fbSend(btn) {
  fbKeep();
  const t = FB.draft.trim();
  if (t.length < 3) { fbErr('#fberr', 'Write a few words first.'); const e = $('[data-fb="text"]'); if (e) e.focus(); return; }
  fbErr('#fberr', '');
  const fb = S.feedback || {};
  const r = await fbCall(btn, A => A.feedback_add(FB.kind, t, FB.where), fb.maker ? 'Saving…' : 'Sending…', '');
  if (!r || !r.ok) { fbErr('#fberr', (r && r.error) || 'Couldn’t send that. Try again.'); return; }
  FB.draft = ''; FB.where = ''; FB.note = false;
  const n = S.feedback || {};
  toast(n.maker ? 'Saved on this Mac.' : n.shared && (n.sent || {}).ok ? `Sent. ${n.maker_name} sees it within the hour, and the answer shows up here.` : n.line || 'Saved.', 6000);
  fbRedraw(`[data-act="fbbox"][data-id="${r.id}"]`, false);
}
async function fbMore(btn) {
  fbKeep();
  const id = btn.dataset.id, t = (FB.mt[id] || '').trim();
  if (t.length < 2) { fbErr(`#fbe-${id}`, 'Write a few words first.'); return; }
  const r = await fbCall(btn, A => A.feedback_follow(id, t), 'Sending…', 'Sent. It goes along with what you wrote before.');
  if (!r || !r.ok) { fbErr(`#fbe-${id}`, (r && r.error) || 'Couldn’t send that. Try again.'); return; }
  FB.mt[id] = ''; FB.box[id] = false; fbRedraw(`[data-act="fbbox"][data-id="${id}"]`, false);
}
async function fbAnswer(btn) {
  fbKeep();
  const id = btn.dataset.id, t = (FB.at[id] || '').trim();
  const x = [...((S.feedback || {}).others || []), ...((S.feedback || {}).mine || [])].find(y => y.id === id) || {};
  const st = FB.st[id] && FB.st[id] !== x.status ? FB.st[id] : '';
  if (!t && !st) { fbErr(`#fbe-${id}`, 'Write an answer or change where it stands.'); return; }
  const r = await fbCall(btn, A => A.feedback_answer(id, t, st), 'Saving…', x.copy ? `Saved. ${x.by || 'They'} will see it on their copy within the hour.` : 'Saved.');
  if (!r || !r.ok) { fbErr(`#fbe-${id}`, (r && r.error) || 'Couldn’t save that. Try again.'); return; }
  FB.at[id] = ''; delete FB.st[id]; FB.box[id] = false; fbRedraw(`[data-act="fbbox"][data-id="${id}"]`, false);
}
async function fbCopy(btn) {
  const A = api(), id = btn.dataset.id, fb = S.feedback || {};
  if (!A || !A.feedback_copy) { toast('Open the app on the Mac to copy it.'); return; }
  let r; try { r = await A.feedback_copy(id ? [id] : null); } catch (e) { r = { ok: false, error: String(e) }; }
  if (!r || !r.ok) { toast((r && r.error) || 'Couldn’t copy that.'); return; }
  toast(fb.maker ? 'Copied. Paste it into a Claude chat about the app.' : `Copied. Paste it into a message to ${fb.maker_name}.`, 5000);
}
function fbBox(id) { fbKeep(); FB.box[id] = !FB.box[id]; fbRedraw(FB.box[id] ? `[data-${(S.feedback || {}).maker ? 'fba' : 'fbm'}="${id}"]` : `[data-act="fbbox"][data-id="${id}"]`, false); }
function fbNote() { fbKeep(); FB.note = true; fbRedraw('[data-fb="text"]', false); }
function fbClosed() { fbKeep(); FB.closed = !FB.closed; fbRedraw('[data-act="fbclosed"]', false); }

/* ---------------- SRM Finance 2.0: keep this Mac awake (signal_lab/awake.py) ----------------
   Sam's dad: his stocks "are never updated or current since he does not have the amphetamine app". A Mac nobody is
   using naps after a few minutes, and while it naps the app can't check the account, move prices or hold the firm's
   meetings. The owner can have the app keep the Mac awake with the Mac's own caffeinate tool (nothing to install): on
   market days, or whenever the app is open, and only on the charger unless they untick it. Today says when the Mac
   slept through market hours. Every reassurance below is a measured fact (2026-11-15, on the MacBook Neo). */
const AW_MODES = [
  { k: 'off', name: 'Off', d: 'The Mac naps as usual. The numbers catch up when it wakes.' },
  { k: 'market', name: 'Market days', tag: 'Suggested', d: '8:30 AM to 6 PM on days the market is open: every check, the briefing and the after-close meeting.' },
  { k: 'always', name: 'Whenever the app is open', d: 'Day and night while the app is open. For a Mac that stays at a desk.' },
];
const AW_DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const AW_SAFE = [
  'It uses <b>caffeinate</b>, the keep-awake tool that comes with every Mac. Nothing to install, and no settings change.',
  'The screen still dims and turns off as usual. Only the Mac itself stays awake.',
  'Closing the lid still puts the Mac to sleep.',
  'Plugged in, it’s the same as leaving your Mac on with nobody typing.',
  'Keeping it awake takes about 2 MB of memory and no processor time. The firm’s heavy thinking happens on Anthropic’s computers, not on your Mac.',
  'It stops by itself the moment you quit the app.',
];
function awMin(m) {  // 210 → "3 hours 30 minutes"
  m = Math.round(+m || 0);
  if (m >= 780) return `about ${Math.round(m / 390)} market days`;
  const h = Math.floor(m / 60), r = m % 60;
  return [h ? `${h} hour${h === 1 ? '' : 's'}` : '', r ? `${r} minute${r === 1 ? '' : 's'}` : ''].filter(Boolean).join(' ') || 'a few minutes';
}
function awDay(iso, since) {
  const t = new Date(iso); if (isNaN(t)) return '';
  const now = new Date(), y = new Date(now); y.setDate(now.getDate() - 1);
  if (t.toDateString() === now.toDateString()) return since ? 'since this morning' : 'today';
  if (t.toDateString() === y.toDateString()) return since ? 'since yesterday' : 'yesterday';
  return (since ? 'since ' : 'on ') + AW_DAYS[t.getDay()];
}
function awLine(st, opt, tag) {  // under the Portfolio's numbers (and on Today): the Mac napped while the market was open
  const aw = (st || S || {}).awake, x = aw && aw.slept;
  if ((opt && opt.phone) || phone || !x || !api()) return '';
  const one = new Date(x.from).toDateString() === new Date(x.to).toDateString(), t = tag || 'span';
  return `<${t} class="fl-aw${t === 'p' ? ' aw-note' : ''}"${t === 'p' ? ' id="awnote"' : ''}><span>💤 This Mac was asleep for <b>${esc(awMin(x.market_minutes))}</b> while the market was open ${esc(awDay(x.from, !one))}, so prices and holdings waited until it woke.</span><button class="fl-fix" data-act="awake">Keep it awake</button><button class="fl-x" data-act="awhide" aria-label="Hide this note">✕</button></${t}>`;
}
function awNote() { return (S && S.signin && S.signin.out) ? '' : awLine(S, null, 'p'); }  // Today's copy (the sign-in warning comes first)
function awNoteSync() {  // Today's note follows the keeper's news without redrawing the page
  if (ui.view !== 'bot') return;
  const old = $('#awnote'), html = awNote();
  if (old) { if (html) old.outerHTML = html; else old.parentNode.removeChild(old); }
  else if (html) { const b = $('.bot2'); if (b) b.insertAdjacentHTML('beforebegin', html); }
}
function awGB(x) { return x ? `${x.memory_gb} GB` : ''; }
function awMac(aw) {  // this Mac next to the one the app is built on (System Information's model, chip and memory)
  const m = aw.mac || {}, b = aw.built_on || {}, top = Math.max(+m.memory_gb || 0, +b.memory_gb || 0) || 1;
  const row = (k, x) => `<div class="aw-mr"><p class="aw-mk">${k}</p><p class="aw-mv">${[x.name, x.chip].filter(Boolean).map(esc).join(' · ')}</p><p class="aw-gb">${esc(awGB(x))} <span>memory</span></p>
      <span class="aw-bar" aria-hidden="true"><i style="width:${Math.max(4, Math.round(100 * (+x.memory_gb || 0) / top))}%"></i></span></div>`;
  if (aw.here && m.name === b.name && +m.memory_gb === +b.memory_gb)
    return `<div class="aw-mac">${row('This is the Mac it’s built on', b)}<p class="aw-mc">${esc(MAKER)} makes ${esc(APP)} on this Mac, and the whole thing, firm meetings and all, runs here every day.</p></div>`;
  const x = +aw.times_memory || 0, n = x % 1 ? x.toFixed(1) : String(x);
  const cmp = !m.name ? '' : x > 1.05 ? `Your Mac has <b>${n}×</b> the memory of the Mac ${esc(APP)} is built on. ` : x >= .95 ? `Your Mac has as much memory as the Mac ${esc(APP)} is built on. ` : '';
  return `<div class="aw-mac">${m.name ? row('Your Mac', m) : ''}${row('The Mac it’s built on', b)}
    <p class="aw-mc">${cmp}${esc(MAKER)} makes ${esc(APP)} on a MacBook Neo, and the whole thing, firm meetings and all, runs on it every day.</p></div>`;
}
function awAmph(aw) {  // the other way: Amphetamine, for owners who'd rather use it (the steps use its own menu words)
  const a = aw.amph || {};
  if (a.holding) return '<p class="aw-amph-on"><span aria-hidden="true">✓</span> Amphetamine is keeping this Mac awake right now, so you can leave this off.</p>';
  return `<details class="aw-amph"><summary>${a.installed ? 'Use Amphetamine instead' : 'Rather use Amphetamine?'}</summary>
    <p>Amphetamine is a free app that does the same job with more choices. You don’t need it: the choice above is enough.</p>
    <ol class="su-ol">${a.installed ? '' : '<li>Get Amphetamine from the App Store (it’s free).</li>'}
      <li>Open it. A pill icon appears in the menu bar at the top right of the screen.</li>
      <li>Click the pill, then <b>Start New Session:</b> → <b>Indefinitely</b>. The Mac stays awake until you end that session.</li>
      <li>Only on the charger instead: click the pill → <b>Settings…</b> → <b>Triggers</b>, tick <b>Enable Triggers</b> and add a trigger. Give it a <b>Trigger name</b> (like Charger), press <b>Add criterion</b> → <b>Battery &amp; Power Adapter</b> → <b>connected to power adapter</b>, then <b>Save</b>.</li>
      <li>So it starts with the Mac: in <b>Settings…</b>, tick <b>Launch Amphetamine at login</b>.</li></ol>
    <button class="btn" data-act="awamph">${a.installed ? 'Open Amphetamine' : 'Open the App Store'}</button></details>`;
}
function awBody(aw, inSetup) {
  const modes = AW_MODES.map(m => `<button class="aw-m${aw.mode === m.k ? ' on' : ''}" data-act="awset" data-m="${m.k}" aria-pressed="${aw.mode === m.k}">${m.tag ? `<em>${m.tag}</em>` : ''}<b>${m.name}</b><span>${m.d}</span></button>`).join('');
  const pow = aw.battery ? `<label class="aw-pow"><input type="checkbox" data-act="awpow"${aw.power_only ? ' checked' : ''}><span><b>Only while it’s plugged in</b><small>On battery the Mac sleeps as usual, so the battery lasts.${aw.plugged === false ? ' It’s on battery right now.' : ''}</small></span></label>` : '';
  const safe = `<div class="aw-safe"><h4>${inSetup ? 'Yes. Here’s why:' : 'Is it safe for my Mac? Yes:'}</h4><ul>${AW_SAFE.map(t => `<li><span>${t}</span></li>`).join('')}</ul></div>`;
  const more = `${safe}${awMac(aw)}${awAmph(aw)}`;
  return `<p class="aw-now${aw.on || (aw.amph || {}).holding ? ' on' : aw.mode !== 'off' ? ' armed' : ''}" aria-live="polite"><i aria-hidden="true"></i><span>${esc(aw.line || '')}</span></p>
    ${inSetup ? '' : `<p class="aw-lead">A Mac nobody is using naps after a few minutes. While it naps, ${esc(APP)} can’t check your account or prices, and the firm can’t meet, so the numbers wait until it wakes. Keeping it awake fixes that.</p>`}
    <div class="aw-ms" role="group" aria-label="When to keep this Mac awake">${modes}</div>${pow}
    ${inSetup ? `<details class="aw-more"><summary>Is it safe for my Mac?</summary>${more}</details>` : more}`;
}
async function openAwake() {
  const A = api(); if (!A || !A.awake_status) return;
  const head = '<div><span class="eyebrow">Keep this Mac awake</span><h3 class="su-t">So your numbers stay current</h3></div>';
  const show = aw => openSheet(head, `<div class="form aw" id="awbody">${awBody(aw, false)}</div>`, '<div class="save"><button class="btn go" data-act="close">Done</button></div>');
  if (S.awake) show(S.awake);  // open at once with what the page has, then bring it up to the second
  let aw = null; try { aw = await A.awake_status(); } catch (e) { /* the page's copy will do */ }
  if (aw) { if ($('#awbody')) awRedraw(aw); else if (!S.awake) { S.awake = aw; show(aw); } }
  else if (!S.awake) toast('Couldn’t open that. Try again in a moment.');
}
function awRedraw(aw) {
  S.awake = aw;
  const b = $('#awbody'); if (b) b.innerHTML = awBody(aw, false);
  if (SU.s) { SU.s.awake = aw; const sec = $('#su-awake'); if (sec) { const open = !!$('.aw-more[open]', sec); sec.outerHTML = setupAwake(aw); if (open) { const d = $('#su-awake .aw-more'); if (d) d.open = true; } } }
  const fl = $('#freshline'); if (fl) fl.outerHTML = freshLine();
  awNoteSync();
  const sx = $('#aw-set'); if (sx) sx.textContent = aw.line || '';
}
async function awSet(m, pow) {
  const A = api(); if (!A || !A.awake_set) return;
  const aw = S.awake || {};
  m = m || aw.mode || 'off'; if (pow === undefined) pow = aw.power_only !== false;
  let r; try { r = await A.awake_set(m, pow); } catch (e) { r = { error: String(e) }; }
  if (!r || r.error || !r.awake) { toast((r && r.error) || 'Couldn’t change that. Try again.'); if (r && !r.error) awRedraw(aw); return; }
  awRedraw(r.awake);
  const f = $(`#awbody [data-m="${m}"]`) || $(`#su-awake [data-m="${m}"]`); if (f && pow === aw.power_only) f.focus({ preventScroll: true });
  else { const c = $('#awbody [data-act="awpow"]') || $('#su-awake [data-act="awpow"]'); if (c) c.focus({ preventScroll: true }); }
  toast(m === 'off' ? 'Off: this Mac naps as usual.' : `On: ${m === 'market' ? 'market days, 8:30 AM to 6 PM' : 'whenever the app is open'}${r.awake.battery && pow ? ', on the charger' : ''}. The screen still turns off as usual.`, 5000);
}
function setupAwake(aw) {  // 2.0, an optional step in the setup guide: keep the numbers current
  if (!aw) return '';
  const on = aw.mode !== 'off' || !!(aw.amph || {}).holding;
  return `<section class="su-s${on ? ' done' : ''}" id="su-awake"><h4 class="su-h"><span class="${on ? 'su-ok' : 'su-no'}" aria-hidden="true">${on ? '✓' : '+'}</span><span>Keep your numbers current</span><em>${on ? 'on' : 'optional'}</em></h4>
      <p>A Mac nobody is using naps after a few minutes, and while it naps the firm can’t check your account or prices. ${esc(APP)} can keep it awake with a tool that comes with every Mac. It’s gentle: the screen still turns off, closing the lid still puts it to sleep, and it uses about 2 MB of memory.</p>
      <div class="aw">${awBody(aw, true)}</div></section>`;
}

/* ---------------- SRM Finance 2.0: About (Settings → About): the app's story and who makes it ----------------
   Sam: "have my name mentioned and factored into the app as the creator of the app and maybe a story". Anyone may
   get a copy, so it says nothing about the maker beyond the name. It also says plainly that AI does the research and
   that the owner approves and places every order (Anthropic's usage policy asks finance apps for both). */
function openAbout() {
  const head = `<div><span class="eyebrow">About</span><h3 class="su-t">${esc(APP)}</h3></div>`;
  const body = `<div class="form ab">
    <div class="ab-top"><span class="ab-mono" aria-hidden="true">${esc(APP.split(' ')[0])}</span>
      <div><p class="ab-v">${esc(VER)}</p><p class="ab-by"><small>Made by</small><span>${esc(MAKER)}</span></p></div></div>
    <section class="ab-story"><h4>The story</h4>
      <p>SRM are the initials of ${esc(MAKER)}, who makes this app. It began in October 2026 as Claude Trade, a stock scanner that sent alerts to a phone. In November the AI started making the calls, and soon it was a whole firm: AI desks that research, argue, forecast and get graded, with the owner as the boss.</p>
      <p>On November 10 it became Claude Finance. Version 2.0, on November 15, took its maker’s initials and was built from what its first owners asked for: a way to talk with the firm, numbers that stay current, and a strategy the owner controls.</p></section>
    <section class="ab-time"><h4>Along the way</h4><ol>${WC_STORY.map(([d, t, p], i) => `<li${i === WC_STORY.length - 1 ? ' class="now"' : ''}><time>${esc(d)}</time><b>${esc(t)}</b><p>${esc(p)}</p></li>`).join('')}</ol></section>
    <section class="ab-how"><h4>How it’s made</h4>
      <p>${esc(MAKER)} designs the app and decides what it does. Claude, the AI made by Anthropic, helps write the code and does the firm’s research. ${esc(APP)} is powered by Claude and runs on your own Claude account.</p>
      <p>It never trades. The firm suggests, and you approve and place every order yourself, at your own broker.</p></section>
  </div>`;
  const foot = `<div class="save"><button class="btn go" data-act="close">Done</button>${S && S.feedback ? '<button class="btn quiet" data-act="feedback">Send feedback</button>' : ''}${wnRel() ? `<button class="btn quiet" data-act="whatsnew">What’s new in v${esc(wnRel().v)}</button>` : ''}</div>`;
  openSheet(head, body, foot);
}
function openSettings() {
  const st = S.settings; if (!st) return;
  const m = st.money, u = st.update || {}, sy = st.sync || {}, mi = st.mirror || {};
  const num = (sec, k, label, v) => `<label class="f">${label}<input data-sec="${sec}" data-k="${k}" type="number" step="any" value="${esc(v)}"></label>`;
  const rows = st.holdings.map(h => hrow(h)).join('');
  const vName = x => x ? (x.label ? `v${esc(x.label)} (${esc(x.id)})` : esc(x.id || '?')) : '?';
  const body = `<div class="form">
    <div class="fs"><h3>Money</h3><p class="d">Cash is what's in Schwab right now (the Schwab sync keeps it right by itself).</p><div class="row">
      ${num('money', 'cash', 'Cash ($)', m.cash)}${num('money', 'min_position', 'Smallest buy ($)', m.min_position)}${num('money', 'bank_max', 'Most to move from the bank ($)', m.bank_max)}</div></div>
    <div class="fs"><h3>Your strategy</h3><p class="d">${S.strategy ? `${esc(S.strategy.label)}: ${stratFacts(S.strategy).map(esc).join(', ')}. ` : ''}How much to spend, how much in one stock, how the money is split, the core funds and the stops are all set there.</p>
      <div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn" data-act="strat">Open your strategy</button></div></div>
    <div class="fs"><h3>Core funds</h3><p class="d">The long-term funds and their targets (the split itself is in your strategy).</p><div class="row">
      <label class="f">Core funds and targets<input data-sec="modes.long" data-k="core_funds" value="${esc(st.core_funds)}"></label></div></div>
    <div class="fs"><h3>Where you trade</h3><p class="d">Every order comes with step-by-step directions written for this broker.</p><div class="row"><label class="f">Broker<select data-sec="account" data-k="broker">${BROKER_KEYS.map(k => `<option value="${k}"${k === (brokerKey() || 'other') ? ' selected' : ''}>${esc(BROKERS[k].label || BROKERS[k].name)}</option>`).join('')}</select></label></div></div>
    <div class="fs"><h3>What you own</h3><p class="d">The Schwab sync fills this in by itself; edit only to fix something.</p>
      <table class="htable" id="htable"><thead><tr><th>Ticker</th><th>Shares</th><th>Paid</th><th>Bought</th><th>Horizon</th><th></th></tr></thead><tbody>${rows}</tbody></table>
      <button class="link" data-act="hadd" style="margin-top:8px">+ Add a row</button></div>
    <div class="fs"><h3>Schwab sync</h3><p class="d">${sy.connected ? `Connected. Last sync ${esc(sy.last ? hm(sy.last) : 'never')}${sy.error ? ' · ⚠ ' + esc(sy.error) : ''}.` : 'Not connected: holdings and cash come from what you type.'}</p>
      <div style="display:flex;gap:8px;flex-wrap:wrap">${sy.connected ? '<button class="btn" data-act="sync" data-k="now">Sync now</button><button class="btn quiet" data-act="sync" data-k="off">Disconnect</button>' : '<button class="btn go" data-act="sync" data-k="on">Connect (sign in to Yahoo)</button>'}</div></div>
    <div class="fs" id="set-awake"><h3>Keep this Mac awake</h3><p class="d"><span id="aw-set">${esc((S.awake || {}).line || 'Off: this Mac naps when nobody is using it, and the numbers wait until it wakes.')}</span> A Mac that stays awake keeps the numbers current, using the Mac’s own tool: nothing to install.</p>
      <div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn" data-act="awake">Keep this Mac awake…</button></div></div>
    <div class="fs"><h3>Setup guide</h3><p class="d">Your name, your stocks and your own Claude account, step by step, or a two-minute tour of the firm.</p>
      <div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn" data-act="setup">Open the setup guide</button><button class="btn quiet" data-act="tour">Take the tour</button></div></div>
    <div class="fs"><h3>Phone</h3><p class="d">${mi.ready ? `Your phone app shows this copy only, and updates after every scan${mi.last ? ` (last ${esc(hm(mi.last))})` : ''}. Anyone with its address and code can see this whole account: <b>Change the code</b> locks every phone out until it types the new one.` : 'This copy has no phone app yet. Each copy makes its own, with its own code, so a phone only shows its owner’s account.'}${mi.error ? ' ⚠ ' + esc(mi.error) : ''}</p>
      <div style="display:flex;gap:8px;flex-wrap:wrap">${mi.ready ? '<button class="btn" data-act="mcode">Show the code</button><button class="btn quiet" data-act="mnew">Change the code</button>' : '<button class="btn" data-act="setup" data-to="su-phone">Set up the phone app</button>'}${mi.url ? `<button class="btn quiet" data-act="link" data-u="${esc(mi.url)}">Open the phone site</button>` : ''}<button class="btn quiet" data-act="test">Send a test notification</button></div></div>
    ${wnRel() ? `<div class="fs"><h3>What’s new</h3><p class="d">What changed in v${wnRel().v}${wnRel().tour ? ', with a one-minute walk through the new things' : ''}.</p>
      <div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn" data-act="whatsnew">What’s new in v${wnRel().v}</button></div></div>` : ''}
    <div class="fs" id="set-about"><h3>About</h3><p class="d">${esc(APP)} ${esc(VER)}, made by ${esc(MAKER)}: how the app began, what the name means and how it’s made.</p>
      <div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn" data-act="about">About ${esc(APP)}</button></div></div>
    ${S.feedback ? `<div class="fs"><h3>Feedback</h3><p class="d">${S.feedback.maker ? `What the people using the app have told you${S.feedback.unread ? ` (${S.feedback.unread} new)` : ''}. Answer them, or copy them for a Claude chat about the app.` : `Something wrong, an idea, or a question? Tell ${esc(S.feedback.maker_name)}, who made the app. The answers show up on the board.`}</p>
      <div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn" data-act="feedback">Open the feedback board</button></div></div>` : ''}
    <div class="fs"><h3>${u.source ? 'Updates for the other copies' : 'Updates'}</h3><div id="upd-box">${updBox(u)}</div></div>
    ${(st.exempt || []).length ? `<div class="fs"><h3>Left out of SRM Finance</h3><p class="d">${st.exempt.map(t => `${esc(t)} <button class="link" data-act="unexempt" data-t="${esc(t)}">bring back</button>`).join(' · ')}</p></div>` : ''}
    <div class="fs"><h3>The old rules’ exits</h3><p class="d">The backup rules (used only when the Firm has no fresh briefing) hold about ${esc(st.exit.hold_days)} trading days, stop −${esc(st.exit.stop_loss_pct)}%, target +${esc(st.exit.profit_target_pct)}%, and move the stop to the buy price after +${esc(st.exit.breakeven_after_gain_pct)}%, as they were tested. The Firm’s own calls follow your strategy instead.</p></div>
  </div>`;
  const foot = `<div class="save"><button class="btn go" data-act="save">Save</button><button class="btn quiet" data-act="close">Cancel</button><span class="err" id="serr"></span></div>`;
  openSheet('<span class="eyebrow">Settings</span>', body, foot);
  ui.htouched = false;
  const A = api();  // the page was built at the last scan: ask where updates stand right now
  if (A && A.update_status) A.update_status().then(updShow).catch(() => {});
}
function hrow(h) {
  const sel = ['short', 'medium', 'long'].map(k => `<option value="${k}"${h.mode === k ? ' selected' : ''}>${{ short: 'Short', medium: 'Medium', long: 'Long' }[k]}</option>`).join('');
  return `<tr><td><input data-h="ticker" aria-label="Ticker" value="${esc(h.ticker || '')}"></td><td><input data-h="shares" aria-label="Shares" type="number" step="any" value="${esc(h.shares ?? '')}"></td>
    <td><input data-h="buy_price" aria-label="Price paid" type="number" step="any" value="${esc(h.buy_price ?? '')}"></td><td><input data-h="buy_date" aria-label="Date bought" type="date" value="${esc(h.buy_date || '')}"></td>
    <td><select data-h="mode" aria-label="Horizon">${sel}</select></td><td><button class="btn quiet" data-act="hdel" aria-label="Remove this row">✕</button></td></tr>`;
}
async function saveSettings(btn) {
  const A = api(); if (!A) return;
  const payload = {}, err = $('#serr');
  $$('.sheet [data-sec]').forEach(el => { (payload[el.dataset.sec] = payload[el.dataset.sec] || {})[el.dataset.k] = el.value; });
  const cash = payload.money && payload.money.cash; if (payload.money) delete payload.money.cash;
  if (payload.account && payload.account.broker && payload.account.broker !== brokerKey()) brokerSet(payload.account.broker);
  const holdings = ui.htouched ? $$('#htable tbody tr').map(tr => Object.fromEntries($$('[data-h]', tr).map(i => [i.dataset.h, i.value]))).filter(h => h.ticker) : null;
  btn.disabled = true; btn.textContent = 'Saving…';
  try {
    if (cash !== undefined && +cash !== +S.settings.money.cash) { const c = await A.set_cash('set', cash); if (c && c.error) throw new Error(c.error); }
    const r = await A.save_settings(payload, holdings);
    if (r && r.error) throw new Error(r.error);
    regrade('Saved. SRM Finance re-planned everything.');
  } catch (e) { err.textContent = e.message || String(e); btn.disabled = false; btn.textContent = 'Save'; }
}

/* ---------------- v6: the setup guide ----------------
   For a copy that isn't set up yet: Sam's dad's Mac after the v6 update (he places his own orders, with his own Claude
   account), or any new copy. Four steps: your name (the boss of the firm), where you trade, your stocks (the broker through Yahoo, or typed
   in) and linking your own Claude account. It opens by itself until "I'm set up"; Settings → Setup guide brings it back. */
const SU = { s: null, busy: false };
function setupCard() {
  if (phone || !(S.setup && S.setup.needed) || !api()) return '';
  return `<section class="card su-card"><div><p class="eyebrow">Set up your copy</p><h2>Meet your firm, then bring in your stocks and your Claude account</h2><p class="d">About 5 minutes. Everything stays on this Mac and in your own accounts.</p></div><button class="btn go" data-act="tour" data-m="setup">Start</button></section>`;
}
function setupClaudeLine(cl) {
  if (SU.busy) return '<span class="su-wait" aria-hidden="true"><i></i><i></i><i></i></span> Checking your Claude account (a few seconds)…';
  if (!cl.found) return '<span class="su-x" aria-hidden="true">✗</span> Claude isn’t on this Mac yet.';
  if (cl.ok) return '<span class="su-y" aria-hidden="true">✓</span> Linked: the firm runs on your own Claude account.';
  if (cl.why === 'signin') return '<span class="su-x" aria-hidden="true">✗</span> Claude is on this Mac, but it isn’t signed in to your account yet.';
  if (cl.why === 'other') return `<span class="su-x" aria-hidden="true">✗</span> Claude didn’t answer: ${esc(cl.error || 'try again in a minute')}`;
  return '<span class="su-q" aria-hidden="true">?</span> Claude is on this Mac. Press <b>Check again</b> to see whether it’s signed in to your account.';
}
function setupBody(s) {
  const st = s.stocks || {}, cl = s.claude || {}, n1 = !!s.owner, n2 = st.count > 0 || st.synced, n3 = !!cl.ok, nb = !!(s.broker_said || ui.broker || (s.done && brokerKey()));
  const mark = (b, n) => `<span class="${b ? 'su-ok' : 'su-no'}" aria-hidden="true">${b ? '✓' : n}</span>`;
  const head = (b, n, t) => `<h4 class="su-h">${mark(b, n)}<span>${t}</span><em>${b ? 'done' : 'to do'}</em></h4>`;
  const have = st.count ? `This copy has <b>${st.count} stock${st.count === 1 ? '' : 's'}</b> and <b>${money(st.cash)}</b> cash${st.synced ? `, synced from ${esc(BN())}${st.last ? ' ' + esc(hm(st.last)) : ''}` : ', typed in by hand'}.` : 'No stocks in this copy yet.';
  return `<p class="su-lead">This copy is yours: your stocks, your brokerage account and your own Claude account. Nothing is shared with anyone else’s copy.</p>
    <section class="su-s${n1 ? ' done' : ''}">${head(n1, 1, 'Your name')}
      <p>The firm calls you by it, and you’re the boss when you join its meetings.</p>
      <div class="su-row"><input id="su-name" aria-label="Your first name" placeholder="Your first name" value="${esc(s.owner || '')}" maxlength="40" autocomplete="given-name"><button class="btn${n1 ? '' : ' go'}" data-su="name">Save</button></div></section>
    <section class="su-s${nb ? ' done' : ''}">${head(nb, 2, 'Where you trade')}
      <p>Every order comes with step-by-step directions written for your broker. You place the orders there yourself: SRM Finance can’t trade.</p>
      ${brokerPick('data-su="broker"')}</section>
    <section class="su-s${n2 ? ' done' : ''}">${head(n2, 3, 'Your stocks')}
      <p class="su-now">${have}${st.error ? ` ⚠ ${esc(st.error)}` : ''}</p>
      <p><b>Best: link ${BA()} through Yahoo Finance.</b> Then SRM Finance reads your holdings and cash by itself after every check, so they’re never out of date. If Yahoo can’t link yours, type your stocks in instead.</p>
      <ol class="su-ol"><li>In Yahoo Finance on the web, open <b>My Portfolio</b> and link ${BA()} (Yahoo walks you through it). <button class="link" data-su="yweb">Open Yahoo Finance</button></li>
        <li>Press <b>Connect Yahoo</b> and sign in with your Yahoo email and password. Use “Continue with email”: Google sign-in doesn’t work inside apps. Your password stays on your Mac.</li></ol>
      <div class="su-row">${st.synced ? '<button class="btn" data-su="ysync">Sync now</button>' : '<button class="btn go" data-su="yon">Connect Yahoo</button>'}<button class="btn quiet" data-su="hand">Or type them in</button></div></section>
    <section class="su-s${n3 ? ' done' : ''}">${head(n3, 4, 'Link your Claude')}
      <p>The firm’s desks and the portfolio manager are Claude, running on this Mac with your own Claude account and plan.</p>
      <p class="su-now" aria-live="polite">${setupClaudeLine(cl)}</p>
      ${!cl.found ? `<ol class="su-ol"><li>Get the Claude app for Mac and sign in with your Claude account. <button class="link" data-su="cdl">Get the Claude app</button></li><li>In the Claude app, open the <b>Code</b> tab once, so Claude Code is on this Mac.</li><li>Come back here and press <b>Check again</b>.</li></ol>`
        : !cl.ok && !SU.busy ? `<ol class="su-ol"><li>Press <b>Sign in to Claude</b>. A Terminal window opens, and your web browser shows Claude’s sign-in page. If the browser doesn’t open, open the link in the Terminal window.</li><li>Sign in with your own Claude account (the one with your subscription) and allow it.</li><li>When the Terminal window says <b>Signed in</b>, close it and press <b>Check again</b>.</li></ol>` : ''}
      <div class="su-row">${cl.found && !cl.ok ? `<button class="btn go" data-su="csign"${SU.busy ? ' disabled' : ''}>Sign in to Claude</button>` : ''}<button class="btn${cl.ok ? ' quiet' : ''}" data-su="ctest"${SU.busy ? ' disabled' : ''}>Check again</button></div></section>
    ${setupAwake(s.awake)}
    ${setupMail(s.mail || {})}
    ${setupPhone(s.phone || {})}
    <p class="su-fine">Every order still needs your OK, and you place it at ${esc(BN())} yourself. SRM Finance never trades or moves money.</p>`;
}
function setupPhone(p) {  // v8.1: this copy's own phone app (its own website and code), so a phone only shows its owner's account
  const j = p.job || {}, busy = ['starting', 'signin', 'making'].includes(j.state), who = p.account;
  const head = `<h4 class="su-h"><span class="${p.ready ? 'su-ok' : 'su-no'}" aria-hidden="true">${p.ready ? '✓' : '+'}</span><span>Your phone app</span><em>${p.ready ? 'on' : 'optional'}</em></h4>`;
  const onPhone = `<ol class="su-ol"><li>On your iPhone or iPad, open this address in <b>Safari</b>: <span class="su-url">${esc(p.url || '')}</span></li>
        <li>Tap <b>Share</b> → <b>Add to Home Screen</b>, then open SRM Finance from the Home Screen.</li>
        <li>Type your code (<b>Show the code</b> below puts it on this Mac’s screen). Then More → turn on notifications.</li></ol>
      <p>If that phone already has someone else’s SRM Finance on its Home Screen, delete that icon first: it shows their account, not yours.</p>`;
  if (p.ready) return `<section class="su-s done" id="su-phone">${head}
      <p class="su-now">Your phone app is on. It shows this copy only: your account, from this Mac${p.last ? ` (last sent ${esc(hm(p.last))})` : ''}.${p.error ? ` ⚠ ${esc(p.error)}` : ''}</p>${onPhone}
      <div class="su-row"><button class="btn" data-su="pcode">Show the code</button></div></section>`;
  const now = j.state === 'signin' ? `<span class="su-wait" aria-hidden="true"><i></i><i></i><i></i></span> GitHub’s page opened in your browser. Type this one-time code there (it’s already copied, so ⌘V works), then press Authorize: <code class="su-otc">${esc(j.code || '')}</code>`
    : busy ? `<span class="su-wait" aria-hidden="true"><i></i><i></i><i></i></span> ${esc(j.text || 'Working…')}`
    : j.state === 'failed' ? `<span class="su-x" aria-hidden="true">✗</span> ${esc(j.error || 'That didn’t work. Try again.')}`
    : who ? `<span class="su-y" aria-hidden="true">✓</span> This Mac is signed in to GitHub as <b>${esc(who)}</b>.` : 'No phone app for this copy yet.';
  return `<section class="su-s" id="su-phone">${head}
      <p>See your account, the Firm’s briefing and your orders on your iPhone, with notifications. Each copy of SRM Finance makes <b>its own</b> phone app with its own code, so your phone shows your account and nobody else’s. The numbers are locked on this Mac before they go online; without your code the website is scrambled text.</p>
      <p class="su-now" aria-live="polite">${now}</p>
      <ol class="su-ol"><li>The locked copy lives on a free GitHub account of your own. No account yet? <button class="link" data-su="pgh">Make a GitHub account</button> (skip this if you have one).</li>
        <li>Press <b>Sign in to GitHub</b>. Your browser opens GitHub’s own page: type the one-time code shown here and press Authorize. Your GitHub password never goes through SRM Finance.</li>
        <li>Press <b>Make my phone app</b>. A window asks you to choose a code (or leave it empty and one is made for you), then the website goes up. That takes about a minute.</li></ol>
      <div class="su-row">${who ? '' : `<button class="btn go" data-su="psign"${busy ? ' disabled' : ''}>Sign in to GitHub</button>`}<button class="btn${who ? ' go' : ''}" data-su="pmake"${busy || !who ? ' disabled' : ''}>Make my phone app</button></div></section>`;
}
function setupPhoneWatch() {  // while GitHub's sign-in or the first upload runs, keep the step's line current
  clearInterval(SU.pt);
  SU.pt = setInterval(async () => {
    const A = api(); if (!A || !$('#su-phone')) { clearInterval(SU.pt); return; }
    let p; try { p = await A.phone_status(); } catch (e) { return; }
    const was = JSON.stringify(SU.s.phone || {}); SU.s.phone = p;
    if (JSON.stringify(p) !== was) { const box = $('#su-name'), v = box ? box.value : null; setupRedraw(); if (v !== null && $('#su-name')) $('#su-name').value = v; }
    if (!['starting', 'signin', 'making'].includes((p.job || {}).state)) { clearInterval(SU.pt); if (p.ready && S.settings) S.settings.mirror = { ...(S.settings.mirror || {}), ready: true, url: p.url, last: p.last || '' }; }
  }, 2000);
}
function setupMail(m) {  // v7.3: Schwab's fill emails, read by the news watch, so a stop that sells shows up right away
  const ok = !!m.gmail, last = m.last_read ? ` Last read ${esc(hm(m.last_read))}.` : '';
  return `<section class="su-s${ok ? ' done' : ''}"><h4 class="su-h"><span class="${ok ? 'su-ok' : 'su-no'}" aria-hidden="true">${ok ? '✓' : '+'}</span><span>Schwab’s trade emails</span><em>${ok ? 'on' : 'optional'}</em></h4>
      <p>Yahoo copies Schwab only about once a day. With this on, the firm’s news watch reads Schwab’s “order filled” emails, so a stop that sells or an order that fills shows up within the hour, at the real price. It only reads emails from Schwab and can’t send, delete or change any email.</p>
      <p class="su-now" aria-live="polite">${SU.mail ? 'Checking…' : ok ? `Gmail is linked to your Claude.${last}` : 'Gmail isn’t linked to your Claude yet.'}</p>
      ${ok ? '' : `<ol class="su-ol"><li>In <b>thinkorswim</b>: Setup → Application Settings → <b>Notifications</b>. Add your Gmail address and type in the code it emails you (it should say “Confirmed”). Tick <b>email</b> for orders that fill, then press <b>Apply settings</b>.</li>
        <li>Link Gmail to your Claude: in the Claude app, open Settings → <b>Connectors</b>, find <b>Gmail</b> and press Connect, then sign in with the same Google account. <button class="link" data-su="mweb">Open Connectors</button></li>
        <li>Press <b>Check again</b>.</li></ol>`}
      <div class="su-row"><button class="btn${ok ? ' quiet' : ''}" data-su="mtest"${SU.mail ? ' disabled' : ''}>Check again</button></div></section>`;
}
function setupRedraw() { const b = $('#su'); if (b && SU.s) b.innerHTML = setupBody(SU.s); }
async function setupTest() {
  const A = api(); if (!A || SU.busy) return;
  SU.busy = true; setupRedraw();
  let r; try { r = await A.claude_test(); } catch (e) { r = { found: SU.s.claude.found, ok: false, why: 'other', error: String(e) }; }
  SU.busy = false; SU.s.claude = { ...SU.s.claude, ...(r || {}) }; setupRedraw();
}
async function openSetup(to) {
  const A = api(); if (!A) return;
  let s; try { s = await A.setup_status(); } catch (e) { s = null; }
  if (!s) { toast('Couldn’t open the setup guide. Try again in a moment.'); return; }
  SU.s = s; SU.busy = false;
  try { sessionStorage.setItem('ct-setup-open', '1'); sessionStorage.setItem('ct-setup-seen', '1'); } catch (e) { /* private mode */ }
  openSheet('<div><span class="eyebrow">Set up your copy</span><h3 class="su-t">Four steps, about 10 minutes, and three optional</h3></div>', `<div class="su" id="su">${setupBody(s)}</div>`,
    '<div class="save"><button class="btn go" data-su="finish">I’m set up</button><button class="btn quiet" data-su="later">Later</button></div>');
  const sh = $('#layer .sheet'); if (sh) sh.addEventListener('click', setupClick);
  if (s.claude.found && !s.claude.ok) setupTest();  // see right away whether it's signed in
  if (to) setTimeout(() => { const t = $('#' + to); if (t) t.scrollIntoView({ block: 'start' }); }, 120);
  if (['starting', 'signin', 'making'].includes(((s.phone || {}).job || {}).state)) setupPhoneWatch();
}
function setupStop() { try { sessionStorage.removeItem('ct-setup-open'); } catch (e) { /* private mode */ } }
async function setupClick(e) {
  const el = e.target.closest('[data-su], [data-act="close"]'); if (!el) return;
  if (el.dataset.act === 'close') { setupStop(); return; }
  const A = api(); if (!A || el.disabled) return;
  const k = el.dataset.su;
  if (k === 'name') {
    const box = $('#su-name'), v = box ? box.value.trim() : '';
    if (!v) { if (box) box.focus(); return; }
    el.disabled = true; const r = await A.setup_name(v);
    SU.s.owner = (r && r.owner) || v; if (S.setup) S.setup.owner = SU.s.owner;
    toast(`Saved. The firm calls you ${SU.s.owner} now.`); setupRedraw();
  } else if (k === 'broker') { brokerSet(el.dataset.b); SU.s.broker = el.dataset.b; SU.s.broker_said = true; setupRedraw(); }
  else if (k === 'yweb') A.open_link('https://finance.yahoo.com/portfolios');
  else if (k === 'yon') { el.disabled = true; const r = await A.yahoo_connect(); if (r && r.error) { toast(r.error); el.disabled = false; } else toast('Sign in to Yahoo in the window that opened. This guide comes back when you’re done.', 7000); }
  else if (k === 'ysync') { el.disabled = true; const r = await A.yahoo_sync_now(); if (r && r.error) { toast(r.error); el.disabled = false; } else regrade(`Synced with ${BN()}.`); }
  else if (k === 'hand') { closeSheet(); openSettings(); setTimeout(() => { const t = $('#htable'); if (t) t.scrollIntoView({ block: 'center' }); }, 80); }
  else if (k === 'cdl') A.open_link('https://claude.ai/download');
  else if (k === 'csign') { const r = await A.claude_signin(); toast(r && r.ok ? 'A Terminal window opened, and your browser shows Claude’s sign-in page. Sign in there, then come back and press Check again.' : (r && r.error) || 'Couldn’t open Terminal.', 9000); }
  else if (k === 'ctest') setupTest();
  else if (k === 'pgh') A.open_link('https://github.com/signup');
  else if (k === 'psign') { el.disabled = true; SU.s.phone = await A.phone_signin(); setupRedraw(); setupPhoneWatch(); }
  else if (k === 'pmake') { el.disabled = true; const r = await A.phone_make(); if (r && r.error) { toast(r.error); el.disabled = false; } else { SU.s.phone = r; setupRedraw(); setupPhoneWatch(); } }
  else if (k === 'pcode') A.mirror_code();
  else if (k === 'mweb') A.open_link('https://claude.ai/settings/connectors');
  else if (k === 'mtest') { SU.mail = 1; setupRedraw(); let m; try { m = await A.mail_check(); } catch (e) { m = null; } SU.mail = 0; if (m) SU.s.mail = m; setupRedraw(); }
  else if (k === 'finish') {
    el.disabled = true; await A.setup_finish(); setupStop();
    if (S.setup) S.setup.needed = false;
    closeSheet(); draw(); toast(`You’re set${SU.s.owner ? ', ' + SU.s.owner : ''}. The firm takes it from here.`, 6000);
  } else if (k === 'later') { setupStop(); closeSheet(); }
}
function setupAuto() {  // opens by itself once each time the app starts, and again after a reload in the middle of it (Yahoo's sign-in)
  if (phone || !(S.setup && S.setup.needed)) return;
  const go = () => {
    if (!api() || $('#layer').innerHTML || $('#call') || $('#boss') || $('#tour') || $('#room')) return;
    let seen = '', open = '', at = 0; try { seen = sessionStorage.getItem('ct-setup-seen'); open = sessionStorage.getItem('ct-setup-open'); at = +(sessionStorage.getItem('ct-tour-step') || 0); } catch (e) { /* private mode */ }
    if (!seen || open) tourOpen(S, OPT, 'setup', null, at || 0);  // v7: the guided tour, with the setup steps
  };
  setTimeout(go, 900);
  window.addEventListener('pywebviewready', () => setTimeout(go, 300), { once: true });
}

/* ---------------- What's new: each version introduces itself ----------------
   Sam (2026-11-09): "when my dad opens a new version he gets a introducing version # with a cool graphic and then a
   what is new in the version with big ones taking him on a tutorial like showing of the new features".
   RELEASES is the list, newest first: add one entry per version. An entry with `tour` is a big one: its intro offers a
   walk through the real screens (wnTour), one spotlight per new thing. The Mac remembers the last version it showed in
   data/seen_version.json (Api.whats_new / whats_new_seen); a phone keeps it in its own storage and gets the intro
   without the walk. A copy that isn't set up yet gets its setup tour first. Settings → What's new shows it again.
   Words here are for any owner (Sam's copy and his dad's): "you", never a name.
   Sam (2026-11-11): "the update pages should not be Identical with defferent words and numbers but instead major
   changes should change the theme of the update page or the style". So every entry names its own `look` (WN_LOOKS
   below): its own colours, its own picture and its own way of laying out the list, drawn from what the version is
   about. A new entry gets a NEW look; never reuse an older entry's. The bigger the change, the further it goes: a
   feature version (1.1) gets its own theme, a whole number (2.0) a whole new style. Only the frame is shared (the
   top bar, the buttons at the bottom, the keys), so it works the same every time. A fix (1.1.1) has no entry: it
   belongs to the version it fixes, and Settings → What's new keeps showing that one. */
const RELEASES = [
  { v: '2.2', look: 'live', date: 'November 16, 2026', name: 'A real call',
    lead: 'The Call is now a real conversation, not text read out loud. Press Call and just talk: your PM listens the whole time, answers in about a second in a natural voice, and you can cut in whenever you like.',
    items: [
      ['📞', 'A real call', 'Press Call and just talk. A full screen with a glowing circle listens to you and answers out loud in about a second. There are no buttons to press between turns.'],
      ['🗣', 'A voice that sounds like a person', 'It uses the Mac’s natural Siri voice when it has one. Pick a different voice during the call (Voice) or in Your PM. For more natural voices: System Settings → Accessibility → Spoken Content → System voice → Manage Voices.'],
      ['✋', 'Cut in any time', 'Tap the circle or press Space and it stops talking and listens. With headphones on, you can just start talking.'],
      ['💬', 'It talks like a person', 'Short spoken answers, and no lists read out loud. When it needs the news, it says “one sec” and looks it up.'],
      ['📝', 'It’s all in the Chat', 'After the call, what you both said is saved in the Chat, and anything it suggested waits there for your OK. It still never trades.'],
    ] },
  { v: '2.1', look: 'voice', date: 'November 15, 2026', name: 'A PM that talks your way',
    lead: 'Your PM now hears you on a call and talks back in the voice you pick. And you can make it your own: its name, its personality and how much it says.',
    items: [
      ['📞', 'The Call hears you now', 'Press Call in the Chat and just talk. The app listens with the Mac’s own speech recognition, so it no longer needs Dictation turned on. When you stop talking it sends what you said, and the answer is read out loud. The first time, the Mac asks to allow the microphone and speech recognition: press Allow (or OK) on both.'],
      ['🎙', 'Pick its voice', 'Choose any voice on your Mac and how fast it talks, and press Hear it to try one. Voices with a ★ sound the most natural, and more can be downloaded in System Settings.'],
      ['🪪', 'Give it a name', 'Call your PM whatever you like, and tell it what to call you.'],
      ['🎭', 'Pick its personality', 'Straight talker, friendly coach, Wall Street pro, patient teacher or devil’s advocate. Short, normal or thorough answers. And a box for anything else about how you like to be talked to.'],
      ['🛡', 'Only the way it talks changes', 'Your strategy still comes first, it never trades, and you still OK every order. It’s all under Your PM at the top of the Chat, and Back to the original PM undoes it in one press.'],
    ] },
  // 2.0: an item's 4th field is what the first owners asked for (said in plain words, never quoted: the crest look shows it)
  { v: '2.0', look: 'crest', date: 'November 15, 2026', name: 'A new name, built from feedback',
    lead: `Claude Finance is now ${APP}, named for the initials of ${MAKER}, who makes it. This version is built from what its first owners asked for. Your stocks, history and settings all came along.`,
    items: [
      ['💬', 'Talk to the firm', 'A new Chat tab: talk with the PM or any desk the way you’d talk with Claude, in conversations it remembers. Attach PDFs, pictures, spreadsheets or statements, talk instead of typing, or start a call and hear every answer out loud. It can look things up on the web. When the PM suggests a new strategy or a change to your orders, one press passes it on, and you still OK and place every order yourself.',
        'More ways to talk to the bots: send them files, even get on a call with them.'],
      ['⏰', 'Numbers that stay current', 'A Mac nobody is using naps after a few minutes, and while it naps the app can’t check your account or move prices. Settings → Keep this Mac awake keeps it up on market days, or whenever the app is open, with the Mac’s own tool: nothing to install. Today says when the Mac slept through market hours.',
        'Stocks that stay up to date, without a separate keep-awake app.'],
      ['🎯', 'Your strategy, your call', 'Pick one of six ready-made strategies (two quick questions mark the one that suits you), change one, or make your own: how much cash to keep back, the most in one stock, stops, pace, and your own words. The PM and every desk follow it before their old habits.',
        'A way to be more aggressive and spend the cash, without rules set in stone holding the firm back.'],
      ['📣', 'A feedback board', `The Feedback button at the top sends a problem, an idea or a question to ${MAKER}. The answer, and whether it’s planned, being worked on or done, shows up on the copy that sent it.`,
        'A place for complaints and ideas that both sides can read.'],
      ['📖', 'The story behind the app', 'Settings → About tells how the app began as a stock scanner in October, what the name means, and how it’s made.'],
    ],
    tour: [
      { k: 'name', view: 'bot', sel: '.bar .brand', title: 'Same app, new name', text: `Claude Finance is now ${APP}, version 2.0. SRM are the initials of ${MAKER}, who makes it. Your stocks, history and settings all came along.` },
      { k: 'chat', view: 'chat', sel: '#chat .ch-comp', title: 'Talk to the firm', text: 'Type to the PM here, or press the microphone and talk. The paper clip attaches files, and Call at the top turns it into a call where every answer is read out loud.' },
      { k: 'strategy', view: 'bot', sel: '.strat-card', title: 'Your strategy, your call', text: 'This card shows the strategy the firm follows. Its button opens six ready-made strategies (the one that suits you says Suggested for you), or make your own.' },
      { k: 'awake', view: 'bot', sheet: 'settings', sel: '#set-awake', title: 'Numbers that stay current', text: 'Keep this Mac awake on market days, so the account, the prices and the meetings never wait for you to wake it. It uses the Mac’s own tool: nothing to install.' },
      { k: 'feedback', view: 'bot', sel: '#fbbtn', title: () => S.feedback && S.feedback.maker ? 'What people tell you' : `Tell ${MAKER} what to fix`,
        text: () => S.feedback && S.feedback.maker ? 'What the people using the app send you lands here, with a violet dot when something is new. Answer each one and mark it Planned, Working on it or Done.'
          : `Something wrong, an idea, a question: press Feedback and it goes to ${MAKER}, who makes the app. The answer shows up here.` },
      { k: 'about', view: 'bot', sheet: 'about', sel: '#layer .ab-story', title: 'The story', text: 'How the app began, what the name means and how it’s made. It’s here anytime in Settings → About.' },
      { k: 'end', view: 'bot', title: 'That’s version 2.0', text: 'You can see this again anytime in Settings → What’s new. Your firm is already back at work.' },
    ] },
  { v: '1.2', look: 'ticket', date: 'November 12, 2026', name: 'Orders anyone can place',
    lead: 'The app no longer assumes who you are or where you trade. Every order now comes with the exact steps for your own broker.',
    items: [
      ['🧾', 'Every order comes with directions', 'Press Place it on an order. It opens with the order written out the way a trading desk writes it, and the same order as numbered steps with the exact values to type.'],
      ['🏦', 'Pick where you trade', 'Schwab, Fidelity, Robinhood, Vanguard, E*TRADE or Webull: the steps use that broker’s own words. Any other broker gets general steps. The app remembers your pick.'],
      ['📋', 'Copy it or follow it', 'One button copies the order as plain text, for a note to yourself or a message to whoever places your trades. Or follow the steps yourself.'],
      ['✅', 'One press when it’s done', '“I placed it” files the order under In motion, and the app follows it until it fills. The old Send button and its Messages step are gone.'],
      ['🔁', 'The other orders keep up', 'When you place or answer an order, the Operations desk checks the rest of the list against it a minute or two later.'],
      ['🗂', 'One page for everything you missed', 'A copy that skipped a version goes straight to the newest one and shows a single What’s new page, with the skipped versions folded in at the bottom.'],
    ] },
  { v: '1.1', look: 'parcel', date: 'November 11, 2026', name: 'Updates that just work',
    lead: 'Getting a new version used to be hit and miss. That part of the app was rebuilt from the ground up.',
    items: [
      ['📦', 'New versions arrive by themselves', 'The app looks for a newer version when it opens and once an hour. When one is ready it installs itself after the Mac has been left alone for 5 minutes. A checkbox in Settings → Updates turns that off.'],
      ['💬', 'It says what is going on', 'Settings → Updates shows one plain sentence: up to date, on its way, ready to install, or exactly what is wrong and what to do about it.'],
      ['🛟', 'A bad update can’t break the app', 'Every new version is checked before it goes in. If it still doesn’t open, the app puts back the version you had, by itself. Your numbers are never touched.'],
      ['📁', 'A second way in', 'When iCloud is slow, the update file can come by AirDrop instead: Settings → Updates → Install from a file.'],
      ['✅', 'Proof it arrived', 'The Mac that shares the updates now shows which version every other copy is on.'],
    ] },
  { v: '1.0', look: 'launch', date: 'November 10, 2026', name: 'A new name, and numbers that keep up',
    lead: 'Claude Trade is now Claude Finance. Your stocks, your history and your settings are all still here.',
    items: [
      ['✨', 'A new name', 'Claude Trade is now Claude Finance. The version starts over at 1.0 and will climb more slowly from here.'],
      ['⏱', 'A Portfolio that keeps up', 'Your holdings and cash are checked against Schwab about every hour from 7 AM to 11 PM, and whenever you come back to the window. Prices update every 5 minutes while the market is open.'],
      ['🌙', 'No more missed scans', 'If your Mac was asleep at a scan time, the scan runs as soon as it wakes up. A line under your total always says how fresh the numbers are.'],
      ['🔎', 'The research behind every call', 'A stock the firm says to buy now shows the PM’s reasons, how sure it is, the risk, and which desks cover it.'],
      ['🧠', 'A Brain you can show someone', 'The Brain room explains what the app does step by step, who does each step, what keeps it honest and where its limits are. One button copies it all as a one-page summary.'],
      ['⚖️', 'A stricter scorecard', 'Each call is graded once against the S&P 500, from the day it was first made. A tie counts as even, not as a win.'],
    ],
    tour: [
      { k: 'name', view: 'bot', sel: '.bar .brand', title: 'Same app, new name', text: 'Claude Trade is now Claude Finance, version 1.0. Nothing was lost: your stocks, history and settings came along.' },
      { k: 'fresh', view: 'positions', sel: '#freshline', title: 'Numbers that keep up', text: 'This line says where your holdings came from and how old they are. The app now checks Schwab about every hour, and prices move every 5 minutes while the market is open.' },
      { k: 'stock', stock: true, sel: '.sp-verdict', title: 'The research behind a call', text: 'Open any stock the firm has a call on: the PM’s reasons, how sure it is and the risk are at the top, with the desks that cover it below.' },
      { k: 'how', room: 'brain', sel: '#room [data-sec="how"]', title: 'The Brain explains itself', text: 'Six steps, from gathering numbers to checking its own work. Each one says who does it: a program, the AI, or you.' },
      { k: 'safe', room: 'brain', sel: '#room [data-sec="safe"]', title: 'What keeps it honest', text: 'Eight safeguards with today’s real numbers, and a plain list of the app’s limits. Good to show someone who asks “how do you know it works?”' },
      { k: 'record', room: 'brain', sel: '#room [data-sec="record"]', title: 'An honest track record', text: 'Every call is graded against the S&P 500 after 5 days, once, from the day it was first made. Ties count as even.' },
      { k: 'copy', room: 'brain', sel: '#room .bz-copy', title: 'Take it with you', text: 'This button copies the whole explanation as one page of plain text, ready to paste into an email or a message.' },
      { k: 'end', view: 'bot', title: 'That’s version 1.0', text: 'You can see this again anytime in Settings → What’s new. Your firm is already back at work.' },
    ] },
];
// 2.0: the app's story so far (from the code's own history), for the 2.0 page and Settings → About
const WC_STORY = [
  ['October 16, 2026', 'Claude Trade', 'A stock scanner with phone alerts. Programs gathered the numbers, and simple rules made the calls.'],
  ['November 4', 'The AI makes the calls', 'Claude became the trading bot: a morning briefing, the orders and a call on every stock owned, each one waiting for the owner’s OK.'],
  ['November 5', 'The Firm', 'A team of AI desks that research, argue, forecast and get graded, and a boardroom where the owner is the boss.'],
  ['November 10', 'Claude Finance', 'A new name, a Portfolio that keeps up, and an honest track record.'],
  ['November 15', `${APP} 2.0`, 'Named for its maker, and built from what its first owners asked for.'],
];
const WN = { rel: null, back: null, i: 0, steps: [], tok: 0, raf: 0, el: null, target: null, busy: false };
const wnTx = x => typeof x === 'function' ? x() : x;  // a walk step's words: fixed, or worked out for this copy
const wnApp = r => wnNum(r.v)[0] < 2 ? 'Claude Finance' : APP;  // what the app was called in that version
const wnNum = v => String(v || '').split('.').map(n => parseInt(n, 10) || 0);
const wnOlder = (a, b) => { const x = wnNum(a), y = wnNum(b); for (let i = 0; i < 3; i++) if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) < (y[i] || 0); return false; };
function wnRel(v) {  // the entry for a version: its own, or for a fix (1.1.1) the version it fixes (1.1)
  v = v || window.CT_VERSION;
  const b = wnNum(v);
  return RELEASES.find(r => r.v === v) || RELEASES.find(r => { const a = wnNum(r.v); return a[0] === b[0] && (a[1] || 0) === (b[1] || 0) && !wnOlder(v, r.v); }) || null;
}
/* The looks. `back` is what sits behind the page, `page` is everything between the top bar and the buttons (its <h1>
   carries id="wn-h"). A look's colours for the shared frame are the --wn-* variables on [data-look]; its own pieces
   use its own class prefix (launch: wn-, parcel: wp-, ticket: wt-, crest: wc-, voice: wv-), so one look can't disturb another. */
const WN_LOOKS = {
  // 2.2, a real call: the live call screen itself. Near-black and blue-white light, thin type: a liquid glowing orb that
  // breathes (Listening / Speaking), a call timer that counts, live captions that type out a line at a time, and the
  // news as the call's own timeline with timestamps down a lit line. Centred like a call screen: no left/right hero.
  live: {
    back: () => '<div class="wr-back" aria-hidden="true"><i></i></div>',
    page: rel => {
      const dig = (n, c) => `<span class="wr-d ${c}"><i>${Array.from({ length: n }, (_, k) => `<b>${k}</b>`).join('')}</i></span>`;
      const at = i => { const s = i * 4 + i * (i - 1) / 2; return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
      const pm = esc(pmName() || 'Your PM');
      return `<div class="wr">
      <header class="wr-hero">
        <div class="wr-bar" aria-hidden="true"><span class="wr-live"><i></i>Live call</span><span class="wr-t">${dig(10, 'm')}:${dig(6, 't')}${dig(10, 's')}</span></div>
        <figure class="wr-orb" aria-hidden="true"><span class="wr-glow"></span><span class="wr-ball"><i></i><i></i><i></i><i></i></span>
          <figcaption><span class="wr-st a">Listening</span><span class="wr-st b">Speaking</span></figcaption></figure>
        <div class="wr-cap" aria-hidden="true"><p class="a"><small>You</small><span>Anything worth a look today?</span></p><p class="b"><small>${pm}</small><span>One sec, let me check the news.</span></p></div>
        <p class="wr-eye">${esc(APP)} ${esc(rel.v)} · ${esc(rel.date)}</p>
        <h1 id="wn-h">${esc(rel.name)}</h1>
        <p class="wr-lead">${esc(rel.lead)}</p>
      </header>
      <section class="wr-log"><h2>What’s new <span>${rel.items.length} moments from the call</span></h2>
        <ol>${rel.items.map(([ic, t, d], i) => `<li style="animation-delay:${(.35 + i * .14).toFixed(2)}s"><time>${at(i)}</time><span class="wr-node" aria-hidden="true"></span><div class="wr-say"><b><span class="ic" aria-hidden="true">${ic}</span>${esc(t)}</b><p>${esc(d)}</p></div></li>`).join('')}</ol></section></div>`;
    },
  },
  // 2.1, the Call and Your PM: a phone call at dusk. Violet and coral and rounded type: a caller with rings and a live
  // waveform, and the news as a conversation (speech bubbles taking turns), the first page laid out as a call.
  voice: {
    back: () => '<div class="wv-back" aria-hidden="true"><i></i></div>',
    page: rel => `<div class="wv">
      <header class="wv-hero">
        <figure class="wv-caller" aria-hidden="true"><span class="wv-ring"></span><span class="wv-ring b"></span><span class="wv-ring c"></span><span class="wv-av">PM</span>
          <figcaption><small>On a call</small><b>${esc(pmName() || 'Your PM')}</b><span class="wv-eq">${Array.from({ length: 26 }, (_, i) => `<i style="animation-delay:-${((i * 37) % 100 / 100).toFixed(2)}s"></i>`).join('')}</span></figcaption></figure>
        <div class="wv-copy"><p class="wv-eye">${esc(APP)} ${esc(rel.v)} · ${esc(rel.date)}</p><h1 id="wn-h">${esc(rel.name)}</h1><p class="wv-lead">${esc(rel.lead)}</p></div>
      </header>
      <section class="wv-talk"><h2>What’s new <span>${rel.items.length} things</span></h2>
        <ol>${rel.items.map(([ic, t, d], i) => `<li class="${i % 2 ? 'r' : 'l'}" style="animation-delay:${(.3 + i * .12).toFixed(2)}s"><span class="ic" aria-hidden="true">${ic}</span><div class="wv-b"><b>${esc(t)}</b><p>${esc(d)}</p></div></li>`).join('')}</ol></section></div>`,
  },
  // 2.0, SRM Finance: the maker's monogram. Evening green and gold and the first serif page: an SRM crest that draws
  // itself, the maker's name written out, what the first owners asked for next to what was built, and the story so far.
  crest: {
    back: () => '<div class="wc-back" aria-hidden="true"><i></i><i></i></div>',
    page: rel => {
      const [mono, ...rest] = APP.split(' '), word = rest.join(' ').toUpperCase() || 'FINANCE';
      const ticks = Array.from({ length: 60 }, (_, i) => {
        const a = i * 6 * Math.PI / 180, r1 = 102, r2 = i % 5 ? 106 : 110, p = r => `${(120 + r * Math.sin(a)).toFixed(1)} ${(120 - r * Math.cos(a)).toFixed(1)}`;
        return `<path d="M${p(r1)}L${p(r2)}"/>`;
      }).join('');
      return `<div class="wc">
      <header class="wc-hero">
        <figure class="wc-crest" aria-hidden="true"><svg viewBox="0 0 240 240" role="presentation" focusable="false">
          <defs><linearGradient id="wc-gold" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f8e8bb"/><stop offset=".55" stop-color="#d8ae58"/><stop offset="1" stop-color="#a47b33"/></linearGradient>
            <linearGradient id="wc-shine" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset=".5" stop-color="#fff" stop-opacity=".8"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>
            <clipPath id="wc-clip"><text class="wc-mono" x="120" y="141" text-anchor="middle">${esc(mono)}</text></clipPath>
            <path id="wc-arc" d="M46 120a74 74 0 0 1 148 0"/><path id="wc-arc2" d="M36 122a84 84 0 0 0 168 0"/></defs>
          <circle class="wc-glow" cx="120" cy="120" r="92"/>
          <circle class="wc-r1" cx="120" cy="120" r="115"/><g class="wc-ticks">${ticks}</g><circle class="wc-r2" cx="120" cy="120" r="95"/>
          <text class="wc-arc"><textPath href="#wc-arc" xlink:href="#wc-arc" startOffset="50%" text-anchor="middle">${esc(word)}</textPath></text>
          <text class="wc-arc b"><textPath href="#wc-arc2" xlink:href="#wc-arc2" startOffset="50%" text-anchor="middle">EST. 2026 · VERSION ${esc(rel.v)}</textPath></text>
          <text class="wc-mono" x="120" y="141" text-anchor="middle" fill="url(#wc-gold)">${esc(mono)}</text>
          <g clip-path="url(#wc-clip)"><rect class="wc-sheen" x="0" y="84" width="46" height="70" fill="url(#wc-shine)"/></g>
        </svg></figure>
        <div class="wc-copy"><p class="wc-eye">Version ${esc(rel.v)} · ${esc(rel.date)}</p>
          <h1 id="wn-h">Meet <em>${esc(APP)}</em></h1><p class="wc-lead">${esc(rel.lead)}</p>
          <p class="wc-sig"><small>Made by</small><span>${esc(MAKER)}</span></p></div>
      </header>
      <section class="wc-asked"><h2>What the first owners asked for <span>${rel.items.length} things in this version</span></h2>
        <ol>${rel.items.map(([ic, t, d, ask], i) => `<li style="animation-delay:${(.4 + i * .08).toFixed(2)}s"><span class="ic" aria-hidden="true">${ic}</span><div>${ask ? `<p class="wc-ask"><small>Asked for</small>${esc(ask)}</p>` : ''}<b>${esc(t)}</b><p>${esc(d)}</p></div></li>`).join('')}</ol></section>
      <section class="wc-story"><h2>The story so far</h2>
        <ol>${WC_STORY.map(([d, t, p], i) => `<li${i === WC_STORY.length - 1 ? ' class="now"' : ''}><time>${esc(d)}</time><b>${esc(t)}</b><p>${esc(p)}</p></li>`).join('')}</ol></section></div>`;
    },
  },
  // 1.0, the new name: a night sky, the version number in a spinning ring, the news as a grid of cards
  launch: {
    back: () => `<div class="wn-sky" aria-hidden="true">${[[8, 14, 0], [22, 62, 1.2], [38, 8, .5], [61, 20, 2.1], [74, 70, .9], [88, 34, 1.7], [93, 82, .3], [48, 88, 2.6], [15, 86, 1.9]].map(([x, y, d]) => `<i style="left:${x}%;top:${y}%;animation-delay:${d}s"></i>`).join('')}</div>`,
    page: rel => {
      const name = APP.split(' ');
      return `<section class="wn-hero">
        <div class="wn-badge" aria-hidden="true"><span class="wn-glow"></span><span class="wn-halo"></span><span class="wn-halo b"></span><span class="wn-disc"></span><span class="wn-orbit"></span><span class="wn-orbit b"></span>
          <span class="wn-num"><small>version</small><b>${esc(rel.v)}</b></span></div>
        <div><p class="wn-eyebrow">Introducing</p><h1 id="wn-h">${esc(name[0])} <em>${esc(name.slice(1).join(' '))}</em> ${esc(rel.v)}</h1>
          <p class="wn-sub">${esc(rel.name)} · ${esc(rel.date)}</p><p class="wn-lead">${esc(rel.lead)}</p></div>
      </section>
      <div class="wn-h"><h2>What’s new</h2><span>${rel.items.length} things in this version</span></div>
      <ul class="wn-list">${rel.items.map(([ic, t, d], i) => `<li style="animation-delay:${(.25 + i * .07).toFixed(2)}s"><span aria-hidden="true">${ic}</span><div><b>${esc(t)}</b><p>${esc(d)}</p></div></li>`).join('')}</ul>`;
    },
  },
  // 1.1, updates redone: a delivery. A parcel travels from the Mac that shares to the one that installs, the version is
  // a parcel tag, and the news is a route with numbered stops (the last one is the delivery).
  parcel: {
    back: () => '<div class="wp-back" aria-hidden="true"></div>',
    page: rel => `<div class="wp">
      <header class="wp-head"><p class="wp-tag">${esc(APP)} ${esc(rel.v)} · ${esc(rel.date)}</p><h1 id="wn-h">${esc(rel.name)}<i>.</i></h1><p class="wp-lead">${esc(rel.lead)}</p></header>
      <figure class="wp-art" aria-hidden="true">
        <svg viewBox="0 20 380 184" role="presentation" focusable="false">
          <path d="M14 196H366" stroke="rgba(255,255,255,.14)" stroke-width="2" stroke-dasharray="1 9" stroke-linecap="round"/>
          <path d="M74 120Q190 -20 306 120" fill="none" stroke="#ffb45c" stroke-opacity=".7" stroke-width="2.5" stroke-dasharray="1 10" stroke-linecap="round"/>
          <g fill="#121b2e" stroke="rgba(255,255,255,.6)" stroke-width="2"><rect x="34" y="128" width="80" height="54" rx="7"/><rect x="266" y="128" width="80" height="54" rx="7"/></g>
          <g fill="rgba(255,255,255,.6)"><rect x="22" y="185" width="104" height="7" rx="3.5"/><rect x="254" y="185" width="104" height="7" rx="3.5"/></g>
          <text x="74" y="161" text-anchor="middle" font-size="16" font-weight="700" fill="#ffb45c" font-family="ui-monospace,SF Mono,Menlo,monospace">v${esc(rel.v)}</text>
          <g transform="translate(306 156)"><path class="wp-ok" d="M-13 0l9 9 17-19" fill="none" stroke="#5fe0a0" stroke-width="5.5" stroke-linecap="round" stroke-linejoin="round"/></g>
          <g class="wp-box"><rect x="-17" y="-15" width="34" height="30" rx="4" fill="#dcb680"/><rect x="-4.5" y="-15" width="9" height="30" fill="#b98a4f"/><path d="M-17 -4H17" stroke="#b98a4f" stroke-width="1.5" opacity=".55"/></g>
        </svg>
        <span class="wp-stamp">Delivered</span>
        <figcaption class="wp-cap"><span>Shared</span><b>Installed</b></figcaption>
      </figure>
      <section class="wp-list"><h2 class="wp-h">What’s in the box · ${rel.items.length} things</h2>
        <ol class="wp-route">${rel.items.map(([ic, t, d], i) => `<li style="animation-delay:${(.3 + i * .09).toFixed(2)}s"><span class="n" aria-hidden="true">${String(i + 1).padStart(2, '0')}</span><span class="d" aria-hidden="true">${ic}</span><div><b>${esc(t)}</b><p>${esc(d)}</p></div></li>`).join('')}</ol>
      </section></div>`,
  },
  // 1.2, orders for anyone: daylight and paper. An order ticket with a tab for each broker and a PLACED stamp, the news
  // as numbered lines on the ticket. The only light page so far: the change is about the app opening up.
  ticket: {
    back: () => '<div class="wt-desk" aria-hidden="true"></div>',
    page: rel => `<div class="wt">
      <header class="wt-hero">
        <div class="wt-copy"><p class="wt-eye"><span>No. ${esc(rel.v)}</span>${esc(rel.date)}</p>
          <h1 id="wn-h">${esc(rel.name)}</h1><p class="wt-lead">${esc(rel.lead)}</p></div>
        <figure class="wt-slip" aria-hidden="true">
          <div class="wt-tabs">${['Schwab', 'Fidelity', 'Robinhood', 'Vanguard', 'E*TRADE', 'Webull'].map((b, i) => `<span style="animation-delay:${(i * 1.5).toFixed(1)}s">${b}</span>`).join('')}</div>
          <div class="wt-body"><small>Order ticket</small><b>BUY 6 shares of NVDA</b>
            <dl><div><dt>Order type</dt><dd>Limit</dd></div><div><dt>Limit price</dt><dd>$182.40</dd></div><div><dt>Timing</dt><dd>Day</dd></div></dl>
            <span class="wt-stamp">Placed</span></div>
        </figure>
      </header>
      <section class="wt-list"><h2>On this ticket <span>${rel.items.length} lines</span></h2>
        <ol>${rel.items.map(([ic, t, d], i) => `<li style="animation-delay:${(.2 + i * .07).toFixed(2)}s"><span class="n" aria-hidden="true">${String(i + 1).padStart(2, '0')}</span><div><b>${esc(t)}</b><p>${esc(d)}</p></div><span class="ic" aria-hidden="true">${ic}</span></li>`).join('')}</ol>
      </section></div>`,
  },
};
/* v1.2: versions stack into ONE page. An update always goes straight to the newest version (the update file is the
   whole app), so a copy that skipped some sees the newest version's page, with what the skipped ones brought folded in
   underneath: never one page after another. Opened by hand (Settings → What's new), the same spot lists every earlier
   version. These pieces are plain enough to sit inside any look, light or dark. */
function wnMore(rel, seen, byHand) {
  const list = RELEASES.filter(r => r.v !== rel.v && wnOlder(r.v, rel.v) && (byHand || (seen && wnOlder(seen, r.v))));
  if (!list.length) return '';
  const head = byHand ? ['Earlier versions', 'What the versions before this one brought.']
    : ['Also new since your last update', `This copy went from v${esc(seen)} straight to v${esc(window.CT_VERSION)}. Here is what the version${list.length > 1 ? 's' : ''} in between brought.`];
  return `<section class="wn-more"><h2>${head[0]}</h2><p>${head[1]}</p>${list.map(r => `<details${!byHand && list.length === 1 ? ' open' : ''}><summary><b>v${esc(r.v)}</b><span>${esc(r.name)}</span><em>${esc(r.date)}${wnApp(r) !== APP ? ' · as ' + esc(wnApp(r)) : ''} · ${r.items.length} things</em></summary>
    <p>${esc(r.lead)}</p><ul>${r.items.map(([ic, t, d]) => `<li><b>${esc(t)}.</b> ${esc(d)}</li>`).join('')}</ul></details>`).join('')}</section>`;
}
const wnWait = ms => new Promise(r => setTimeout(r, ms));
async function wnSeen() {  // the last version this copy introduced: a string, or null when nobody can say (then nothing opens)
  if (!phone && !WN.phone) {
    const A = api(); if (!A || !A.whats_new) return null;
    try { const r = await A.whats_new(); return r && typeof r.seen === 'string' ? r.seen : null; } catch (e) { return null; }
  }
  try { return localStorage.getItem('ct-seen-version') || ''; } catch (e) { return null; }
}
function wnMark() {
  const A = api();
  if (A && A.whats_new_seen) { try { const p = A.whats_new_seen(window.CT_VERSION); if (p && p.catch) p.catch(() => {}); } catch (e) { /* asks again next time */ } }
  try { localStorage.setItem('ct-seen-version', window.CT_VERSION); } catch (e) { /* private mode */ }
}
function wnStyle() {
  if (document.getElementById('wn-css')) return;
  let wpFly = '0%{opacity:0;transform:translate(74px,120px) scale(.5)}8%{opacity:1;transform:translate(74px,120px) scale(1)}';  // the parcel's flight: along the dotted arc, then into the other Mac
  for (let i = 1; i <= 10; i++) { const e = (i / 10) * (i / 10) * (3 - 2 * i / 10); wpFly += `${8 + 5 * i}%{opacity:1;transform:translate(${(74 + 232 * e).toFixed(1)}px,${(120 - 280 * e * (1 - e)).toFixed(1)}px) scale(1)}`; }
  wpFly += '66%,100%{opacity:0;transform:translate(306px,152px) scale(.35)}';
  const css = `
.wn{--ink:#eef0f6;--ink2:#c5cad6;--dim:#9aa0b0;position:fixed;inset:0;z-index:210;display:flex;flex-direction:column;color:var(--ink);background:var(--wn-bg,#05060a);font-family:inherit;animation:wnIn .5s cubic-bezier(.2,.8,.2,1) both}
.wn.out{animation:wnOut .2s ease both}
@keyframes wnIn{from{opacity:0;transform:scale(1.02)}to{opacity:1;transform:none}}
@keyframes wnOut{to{opacity:0}}
.wn-sky{position:absolute;inset:0;overflow:hidden;pointer-events:none}
.wn-sky::before,.wn-sky::after{content:"";position:absolute;width:70vmax;height:70vmax;border-radius:50%;filter:blur(90px);opacity:.34;animation:wnDrift 22s ease-in-out infinite alternate}
.wn-sky::before{left:-22vmax;top:-30vmax;background:radial-gradient(circle,#3ff2a3,transparent 62%)}
.wn-sky::after{right:-26vmax;bottom:-34vmax;background:radial-gradient(circle,#7a6bff,transparent 62%);animation-delay:-9s}
@keyframes wnDrift{to{transform:translate(6vmax,5vmax) scale(1.12)}}
.wn-sky i{position:absolute;width:3px;height:3px;border-radius:50%;background:#fff;opacity:.5;animation:wnTwinkle 3.4s ease-in-out infinite}
@keyframes wnTwinkle{0%,100%{opacity:.12;transform:scale(.7)}50%{opacity:.85;transform:scale(1.25)}}
.wn-top{flex:none;position:relative;z-index:2;display:flex;align-items:center;justify-content:space-between;gap:12px;min-height:52px;padding:env(safe-area-inset-top) 16px 0}
.wn-top .lights{display:flex;gap:8px}
.wn-x{min-height:36px;padding:0 14px;border-radius:999px;border:1px solid rgba(255,255,255,.16);background:rgba(255,255,255,.06);color:var(--ink);font:inherit;font-size:13.5px;font-weight:600;cursor:pointer}
.wn-x:hover{background:rgba(255,255,255,.12)}
.wn-scroll{position:relative;z-index:1;flex:1;min-height:0;overflow:auto;-webkit-overflow-scrolling:touch}
.wn-in{width:min(940px,100%);margin:0 auto;padding:6px 24px 28px}
.wn-hero{display:grid;grid-template-columns:auto 1fr;align-items:center;gap:36px;padding:10px 0 26px}
.wn-badge{position:relative;width:216px;height:216px;flex:none;display:grid;place-items:center}
.wn-badge .wn-halo{position:absolute;inset:0;border-radius:50%;background:conic-gradient(from 0deg,#3ff2a3,#56cbff,#a38cff,#ff8fd0,#ffd36e,#3ff2a3);animation:wnSpin 9s linear infinite;-webkit-mask:radial-gradient(farthest-side,transparent calc(100% - 7px),#000 calc(100% - 6px));mask:radial-gradient(farthest-side,transparent calc(100% - 7px),#000 calc(100% - 6px))}
.wn-badge .wn-halo.b{inset:20px;opacity:.38;animation-duration:15s;animation-direction:reverse;-webkit-mask:radial-gradient(farthest-side,transparent calc(100% - 3px),#000 calc(100% - 2px));mask:radial-gradient(farthest-side,transparent calc(100% - 3px),#000 calc(100% - 2px))}
.wn-badge .wn-glow{position:absolute;inset:-18px;border-radius:50%;background:radial-gradient(circle,rgba(86,203,255,.34),transparent 64%);animation:wnPulse 3.6s ease-in-out infinite}
.wn-badge .wn-disc{position:absolute;inset:34px;border-radius:50%;background:radial-gradient(circle at 34% 26%,#1b2233,#090b12 70%);box-shadow:inset 0 0 0 1px rgba(255,255,255,.1),0 18px 50px -18px #000}
.wn-badge .wn-orbit{position:absolute;inset:0;animation:wnSpin 6s linear infinite}
.wn-badge .wn-orbit::after{content:"";position:absolute;left:50%;top:-5px;width:11px;height:11px;margin-left:-5px;border-radius:50%;background:#fff;box-shadow:0 0 16px 4px rgba(125,227,255,.9)}
.wn-badge .wn-orbit.b{inset:20px;animation-duration:10s;animation-direction:reverse}.wn-badge .wn-orbit.b::after{width:7px;height:7px;top:-3px;margin-left:-3px;background:#ffd36e;box-shadow:0 0 12px 3px rgba(255,211,110,.8)}
.wn-badge .wn-num{position:relative;display:grid;justify-items:center;line-height:1}
.wn-badge .wn-num small{font-size:12px;font-weight:700;letter-spacing:.2em;text-transform:uppercase;color:var(--dim)}
.wn-badge .wn-num b{margin-top:5px;font:800 60px/1 ui-monospace,"SF Mono",Menlo,monospace;letter-spacing:-.04em;background:linear-gradient(135deg,#fff 10%,#7de3ff 55%,#a38cff);-webkit-background-clip:text;background-clip:text;color:transparent;animation:wnPop .8s cubic-bezier(.2,1.5,.4,1) .15s both}
@keyframes wnSpin{to{transform:rotate(360deg)}}
@keyframes wnPulse{0%,100%{opacity:.55;transform:scale(.96)}50%{opacity:1;transform:scale(1.05)}}
@keyframes wnPop{from{opacity:0;transform:scale(.5)}to{opacity:1;transform:none}}
.wn-eyebrow{margin:0;font-size:13px;font-weight:700;letter-spacing:.24em;text-transform:uppercase;color:var(--wn-a,#7de3ff)}
.wn-hero h1{margin:8px 0 6px;font-size:clamp(34px,6vw,58px);line-height:1.04;letter-spacing:-.03em;font-weight:800}
.wn-hero h1 em{font-style:normal;background:linear-gradient(120deg,#3ff2a3,#56cbff 55%,#a38cff);-webkit-background-clip:text;background-clip:text;color:transparent}
.wn-sub{margin:0 0 12px;font-size:15px;color:var(--dim)}
.wn-lead{margin:0;font-size:17px;line-height:1.5;color:var(--ink2);max-width:46ch}
.wn-h{display:flex;align-items:baseline;gap:10px;margin:8px 0 12px}
.wn-h h2{margin:0;font-size:20px;letter-spacing:-.01em}.wn-h span{font-size:13.5px;color:var(--dim)}
.wn-list{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;margin:0;padding:0;list-style:none}
.wn-list li{display:grid;grid-template-columns:44px 1fr;gap:14px;align-items:start;padding:16px;border-radius:18px;border:1px solid rgba(255,255,255,.1);background:linear-gradient(180deg,rgba(255,255,255,.055),rgba(255,255,255,.02));animation:wnRise .55s cubic-bezier(.2,.8,.2,1) both}
.wn-list li>span{display:grid;place-items:center;width:44px;height:44px;border-radius:13px;font-size:21px;background:rgba(125,227,255,.1);border:1px solid rgba(125,227,255,.22)}
.wn-list b{display:block;margin:1px 0 4px;font-size:15.5px}
.wn-list p{margin:0;font-size:14px;line-height:1.5;color:var(--ink2)}
@keyframes wnRise{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:none}}
.wn-foot{flex:none;position:relative;z-index:2;display:flex;align-items:center;justify-content:center;gap:12px;flex-wrap:wrap;padding:14px 20px calc(16px + env(safe-area-inset-bottom));border-top:1px solid rgba(255,255,255,.08);background:var(--wn-foot,rgba(6,8,12,.82));-webkit-backdrop-filter:blur(14px);backdrop-filter:blur(14px)}
.wn-foot small{flex-basis:100%;text-align:center;font-size:13px;color:var(--dim)}
.wn-btn{min-height:46px;padding:0 24px;border-radius:999px;border:1px solid rgba(255,255,255,.18);background:rgba(255,255,255,.07);color:#fff;font:inherit;font-size:15.5px;font-weight:650;cursor:pointer;transition:transform .15s,background .15s}
.wn-btn:hover{background:rgba(255,255,255,.13)}.wn-btn:active{transform:scale(.97)}
.wn-btn.go{border-color:transparent;background:var(--wn-go,linear-gradient(120deg,#3ff2a3,#56cbff));color:var(--wn-on,#04130d)}
.wn-btn.go:hover{filter:brightness(1.08)}
.wn button:focus-visible,.wn-coach button:focus-visible{outline:2px solid #fff;outline-offset:3px}
.wn-coach{--ink2:#c5cad6;--dim:#9aa0b0;position:fixed;inset:0;z-index:300;color:#eef0f6}
.wn-ring{position:fixed;left:50%;top:50%;width:0;height:0;border-radius:16px;pointer-events:none;box-shadow:0 0 0 2px var(--wn-a,#7de3ff),0 0 0 7px var(--wn-a3,rgba(125,227,255,.22)),0 0 0 200vmax rgba(3,4,7,.7);transition:left .4s cubic-bezier(.2,.8,.2,1),top .4s cubic-bezier(.2,.8,.2,1),width .4s cubic-bezier(.2,.8,.2,1),height .4s cubic-bezier(.2,.8,.2,1)}
.wn-ring.none{box-shadow:0 0 0 200vmax rgba(3,4,7,.7)}
.wn-ring.live{transition:none}
.wn-tip{position:fixed;width:min(390px,calc(100vw - 24px));padding:18px 20px 16px;border-radius:20px;border:1px solid rgba(255,255,255,.16);background:linear-gradient(180deg,rgba(17,22,35,.98),rgba(9,11,18,.99));box-shadow:0 30px 80px -20px #000;transition:opacity .2s ease,transform .2s ease}
.wn-tip.swap{opacity:0;transform:translateY(6px)}
.wn-tip .wn-eyebrow{font-size:12px;letter-spacing:.16em}
.wn-tip h2{margin:6px 0 8px;font-size:21px;line-height:1.2;letter-spacing:-.015em}
.wn-tip p{margin:0 0 14px;font-size:15px;line-height:1.55;color:var(--ink2)}
.wn-dots{display:flex;gap:5px;margin:0 0 12px}.wn-dots i{width:16px;height:4px;border-radius:4px;background:rgba(255,255,255,.16)}.wn-dots i.on{background:var(--wn-a,#7de3ff)}.wn-dots i.was{background:var(--wn-a,#7de3ff);opacity:.45}
.wn-nav{display:flex;align-items:center;justify-content:space-between;gap:10px}
.wn-end{position:absolute;top:10px;right:10px;width:32px;height:32px;border-radius:10px;border:0;background:none;color:var(--dim);font-size:20px;line-height:1;cursor:pointer}.wn-end:hover{background:rgba(255,255,255,.08);color:var(--ink)}
.wn-nav .wn-btn{min-height:42px;padding:0 20px;font-size:14.5px}
.wn-skip{border:0;background:none;color:var(--dim);font:inherit;font-size:13.5px;cursor:pointer;padding:10px 6px;text-decoration:underline;text-underline-offset:3px}
.wn-skip:hover{color:#fff}
@media (max-width:760px){
  .wn-in{padding:0 16px 22px}
  .wn-hero{grid-template-columns:1fr;justify-items:center;text-align:center;gap:18px;padding-top:4px}
  .wn-badge{width:168px;height:168px}.wn-badge .wn-disc{inset:28px}.wn-badge .wn-halo.b,.wn-badge .wn-orbit.b{inset:16px}.wn-badge .wn-num b{font-size:46px}
  .wn-lead{font-size:16px}
  .wn-list{grid-template-columns:1fr}
  .wn-foot .wn-btn{flex:1 1 auto}
}
@media (max-height:700px) and (min-width:761px){.wn-badge{width:168px;height:168px}.wn-badge .wn-disc{inset:28px}.wn-badge .wn-halo.b,.wn-badge .wn-orbit.b{inset:16px}.wn-badge .wn-num b{font-size:46px}.wn-hero{padding-bottom:16px}}
.wn[data-look="parcel"],.wn-coach[data-look="parcel"]{--wn-bg:#0c1322;--wn-a:#ffb45c;--wn-a3:rgba(255,180,92,.24);--wn-go:#ffb45c;--wn-on:#241703;--wn-foot:rgba(10,15,27,.88)}
.wp-back{position:absolute;inset:0;pointer-events:none;background:radial-gradient(60vmax 46vmax at 100% 0,rgba(255,180,92,.13),transparent 62%),radial-gradient(rgba(255,255,255,.075) 1px,transparent 1.6px) 0 0/24px 24px}
.wp{display:grid;grid-template-columns:minmax(0,1fr) minmax(300px,380px);grid-template-areas:"head art" "list art";gap:8px 48px;align-items:start;padding:14px 0 6px}
.wp-head{grid-area:head;animation:wnRise .55s cubic-bezier(.2,.8,.2,1) both}
.wp-tag{display:inline-flex;align-items:center;gap:9px;margin:0;padding:7px 13px 7px 10px;border:1.5px dashed rgba(255,180,92,.6);border-radius:9px;font:700 12.5px/1.35 ui-monospace,"SF Mono",Menlo,monospace;letter-spacing:.09em;text-transform:uppercase;color:#ffb45c}
.wp-tag::before{content:"";flex:none;width:9px;height:9px;border-radius:50%;border:1.5px solid currentColor}
.wp-head h1{margin:18px 0 14px;font-size:clamp(34px,5.4vw,60px);line-height:1.02;letter-spacing:-.035em;font-weight:800;text-wrap:balance}
.wp-head h1 i{font-style:normal;color:#ffb45c}
.wp-lead{margin:0;font-size:17px;line-height:1.55;color:var(--ink2);max-width:44ch}
.wp-art{grid-area:art;position:sticky;top:10px;margin:6px 0 0;padding:22px 18px 16px;border-radius:22px;border:1px solid rgba(255,255,255,.1);background:linear-gradient(180deg,#131c30,#0e1524);box-shadow:0 30px 70px -34px #000;animation:wnRise .6s .15s cubic-bezier(.2,.8,.2,1) both}
.wp-art svg{display:block;width:100%;height:auto;overflow:visible}
.wp-box{transform:translate(190px,50px);animation:wpFly 5s linear infinite}
.wp-ok{animation:wpOk 5s linear infinite}
@keyframes wpFly{${wpFly}}
@keyframes wpOk{0%,60%{opacity:0;transform:scale(.3)}68%{opacity:1;transform:scale(1.18)}74%,94%{opacity:1;transform:scale(1)}100%{opacity:0;transform:scale(1)}}
.wp-cap{display:flex;justify-content:space-between;margin:8px 0 0;padding:0 5%;font-size:13px;color:var(--dim)}
.wp-cap b{font-weight:700;color:#5fe0a0}
.wp-stamp{position:absolute;right:14px;top:14px;padding:5px 9px;border:2px solid #5fe0a0;border-radius:7px;font:800 12px/1 ui-monospace,"SF Mono",Menlo,monospace;letter-spacing:.14em;text-transform:uppercase;color:#5fe0a0;transform:rotate(7deg)}
.wp-list{grid-area:list;margin-top:26px}
.wp-h{margin:0 0 16px;font:700 12.5px/1.35 ui-monospace,"SF Mono",Menlo,monospace;letter-spacing:.14em;text-transform:uppercase;color:var(--dim)}
.wp-route{margin:0;padding:0;list-style:none}
.wp-route li{position:relative;display:grid;grid-template-columns:28px 38px minmax(0,1fr);column-gap:12px;padding:0 0 24px;animation:wnRise .5s cubic-bezier(.2,.8,.2,1) both}
.wp-route li:not(:last-child)::after{content:"";position:absolute;left:58px;top:43px;bottom:3px;border-left:2px dashed rgba(255,180,92,.36)}
.wp-route .n{padding-top:13px;text-align:right;font:700 12.5px/1 ui-monospace,"SF Mono",Menlo,monospace;color:#d3ab76}
.wp-route .d{display:grid;place-items:center;width:38px;height:38px;border-radius:50%;font-size:18px;background:#16203a;border:1.5px solid rgba(255,180,92,.6)}
.wp-route li:last-child .d{border-color:#5fe0a0;background:rgba(95,224,160,.13)}
.wp-route li:last-child{padding-bottom:6px}
.wp-route b{display:block;margin:8px 0 5px;font-size:16.5px;letter-spacing:-.005em}
.wp-route p{margin:0;font-size:14.5px;line-height:1.55;color:var(--ink2);max-width:58ch}
@media (max-width:760px){
  .wp{grid-template-columns:minmax(0,1fr);grid-template-areas:"head" "art" "list";gap:18px;padding-top:6px}
  .wp-head h1{margin:14px 0 10px}.wp-lead{font-size:16px}
  .wp-art{position:relative;top:0;margin:0}
  .wp-list{margin-top:6px}
}
.wn-more{margin:34px 0 0;padding:22px 0 0;border-top:1px solid rgba(128,128,128,.32)}
.wn-more h2{margin:0;font-size:19px;font-weight:700;letter-spacing:-.01em;color:var(--ink)}
.wn-more>p{margin:6px 0 14px;font-size:14.5px;line-height:1.5;color:var(--ink2)}
.wn-more details{border:1px solid rgba(128,128,128,.32);border-radius:14px;background:rgba(128,128,128,.09);margin-top:10px}
.wn-more summary{display:flex;align-items:baseline;gap:6px 12px;flex-wrap:wrap;min-height:48px;padding:12px 16px;cursor:pointer;list-style:none;font-size:15px;color:var(--ink)}
.wn-more summary::-webkit-details-marker{display:none}
.wn-more summary::after{content:"Show";margin-left:auto;font-size:13px;font-weight:600;color:var(--wn-a,#7de3ff)}
.wn-more details[open] summary::after{content:"Hide"}
.wn-more summary b{font:700 13px ui-monospace,"SF Mono",Menlo,monospace;padding:2px 8px;border-radius:999px;border:1px solid rgba(128,128,128,.45)}
.wn-more summary span{font-weight:650}
.wn-more summary em{font-style:normal;font-size:13px;color:var(--dim)}
.wn-more details>p{margin:0;padding:0 16px;font-size:14.5px;line-height:1.5;color:var(--ink2)}
.wn-more ul{margin:10px 0 0;padding:0 16px 16px 34px;display:flex;flex-direction:column;gap:7px;font-size:14px;line-height:1.5;color:var(--ink2)}
.wn-more li b{color:var(--ink);font-weight:650}
.wn-more summary:focus-visible{outline:2px solid var(--wn-a,#7de3ff);outline-offset:2px;border-radius:12px}
.wn[data-look="ticket"],.wn-coach[data-look="ticket"]{--wn-bg:#ece5d6;--wn-a:#a8321f;--wn-a3:rgba(168,50,31,.2);--wn-go:#1d2026;--wn-on:#fff;--wn-foot:rgba(236,229,214,.92)}
.wn[data-look="ticket"]{--ink:#1d2026;--ink2:#3d414c;--dim:#5b606d}
.wn[data-look="ticket"] .wn-x,.wn[data-look="ticket"] .wn-btn{color:#1d2026;border-color:rgba(29,32,38,.28);background:rgba(29,32,38,.05)}
.wn[data-look="ticket"] .wn-x:hover,.wn[data-look="ticket"] .wn-btn:hover{background:rgba(29,32,38,.11)}
.wn[data-look="ticket"] .wn-btn.go{color:#fff;border-color:transparent;background:#1d2026}
.wn[data-look="ticket"] .wn-foot{border-top-color:rgba(29,32,38,.14)}
.wn[data-look="ticket"] button:focus-visible{outline-color:#1d2026}
.wt-desk{position:absolute;inset:0;pointer-events:none;background:linear-gradient(rgba(29,32,38,.045) 1px,transparent 1px) 0 0/100% 32px,radial-gradient(120% 80% at 80% 0,#f7f2e6,transparent 60%)}
.wt{padding:14px 0 6px}
.wt-hero{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,430px);gap:36px;align-items:center}
.wt-eye{display:flex;align-items:center;gap:12px;margin:0;font:600 13px ui-monospace,"SF Mono",Menlo,monospace;letter-spacing:.06em;text-transform:uppercase;color:var(--dim)}
.wt-eye span{padding:4px 10px;border:1.5px solid #a8321f;border-radius:6px;color:#a8321f;font-weight:700}
.wt h1{margin:16px 0 0;font-size:clamp(34px,5vw,56px);line-height:1.02;letter-spacing:-.035em;font-weight:800;color:var(--ink);text-wrap:balance}
.wt-lead{margin:16px 0 0;max-width:46ch;font-size:17.5px;line-height:1.5;color:var(--ink2)}
.wt-slip{position:relative;margin:0;transform:rotate(-2deg);filter:drop-shadow(0 18px 26px rgba(60,45,20,.22));animation:wtIn .7s cubic-bezier(.2,.8,.2,1) .1s both}
@keyframes wtIn{from{opacity:0;transform:translateY(26px) rotate(3deg)}to{opacity:1;transform:rotate(-2deg)}}
.wt-tabs{display:flex;gap:3px;padding:0 8px;overflow:hidden}
.wt-tabs span{flex:1 1 0;min-width:0;padding:6px 2px 5px;border-radius:7px 7px 0 0;background:#d9d0bc;color:#4a4636;font-size:11px;font-weight:650;text-align:center;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;animation:wtTab 9s linear infinite}
@keyframes wtTab{0%,16%{background:#fffdf7;color:#1d2026}17%,100%{background:#d9d0bc;color:#4a4636}}
@keyframes wtTab4{0%,24%{background:#fffdf7;color:#1d2026}25%,100%{background:#d9d0bc;color:#4a4636}}
.wt-body{position:relative;padding:20px 22px 76px;background:#fffdf7;border-radius:10px;font-family:ui-monospace,"SF Mono",Menlo,monospace;color:#1d2026;-webkit-mask:radial-gradient(circle at 8px 100%,transparent 6px,#000 6.5px) -8px 0/16px 100%;mask:radial-gradient(circle at 8px 100%,transparent 6px,#000 6.5px) -8px 0/16px 100%}
.wt-body small{display:block;font-size:11px;font-weight:700;letter-spacing:.16em;text-transform:uppercase;color:#5b606d}
.wt-body>b{display:block;margin:8px 0 14px;font-size:19px;letter-spacing:-.01em}
.wt-body dl{margin:0;display:flex;flex-direction:column;gap:0}
.wt-body dl div{display:flex;justify-content:space-between;gap:12px;padding:8px 0;border-top:1px dashed rgba(29,32,38,.28);font-size:14px}
.wt-body dt{color:#5b606d}.wt-body dd{margin:0;font-weight:700}
.wt-stamp{position:absolute;right:20px;bottom:26px;padding:5px 12px;border:3px solid #17734b;border-radius:8px;color:#17734b;font:800 20px/1 ui-monospace,"SF Mono",Menlo,monospace;letter-spacing:.14em;text-transform:uppercase;transform:rotate(-11deg);opacity:.92;animation:wtStamp .5s cubic-bezier(.3,1.6,.5,1) 1.1s both}
@keyframes wtStamp{from{opacity:0;transform:rotate(-11deg) scale(2.2)}to{opacity:.92;transform:rotate(-11deg) scale(1)}}
.wt-list{margin-top:38px}
.wt-list h2{display:flex;align-items:baseline;gap:12px;margin:0 0 4px;padding-bottom:10px;border-bottom:2px solid #1d2026;font-size:15px;font-weight:800;letter-spacing:.1em;text-transform:uppercase;color:var(--ink)}
.wt-list h2 span{font:600 13px ui-monospace,"SF Mono",Menlo,monospace;letter-spacing:.04em;color:var(--dim)}
.wt-list ol{margin:0;padding:0;list-style:none}
.wt-list li{display:grid;grid-template-columns:44px minmax(0,1fr) 36px;gap:14px;align-items:start;padding:16px 0;border-bottom:1px dashed rgba(29,32,38,.3);animation:wtLine .5s ease both}
@keyframes wtLine{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}
.wt-list .n{font:700 15px/1.5 ui-monospace,"SF Mono",Menlo,monospace;color:#a8321f}
.wt-list li b{display:block;font-size:17px;font-weight:700;letter-spacing:-.01em;color:var(--ink)}
.wt-list li p{margin:4px 0 0;font-size:15px;line-height:1.5;color:var(--ink2);max-width:68ch}
.wt-list .ic{font-size:22px;line-height:1.3;text-align:right}
@media (max-width:760px){
  .wt-hero{grid-template-columns:minmax(0,1fr);gap:26px}.wt-slip{width:100%;max-width:430px;margin:0 auto}
  .wt-lead{font-size:16px}.wt-list li{grid-template-columns:32px minmax(0,1fr);gap:10px}.wt-list .ic{display:none}
}
@media (max-width:470px){.wt-tabs span:nth-child(n+5){display:none}.wt-tabs span{animation-name:wtTab4;animation-duration:6s}}
.wn[data-look="crest"],.wn-coach[data-look="crest"]{--wn-bg:#06140f;--wn-a:#e0b85e;--wn-a3:rgba(224,184,94,.24);--wn-go:linear-gradient(120deg,#f3d991,#cf9f45);--wn-on:#1b1405;--wn-foot:rgba(5,16,12,.9)}
.wn[data-look="crest"]{--ink:#f5f0e3;--ink2:#d9d2c0;--dim:#aaa592}
.wn[data-look="crest"] .wn-x,.wn[data-look="crest"] .wn-btn{border-color:rgba(224,184,94,.38)}
.wn[data-look="crest"] .wn-btn.go{border-color:transparent}
.wn[data-look="crest"] .wn-foot{border-top-color:rgba(224,184,94,.2)}
.wc-back{position:absolute;inset:0;overflow:hidden;pointer-events:none;background:radial-gradient(70vmax 50vmax at 12% -12%,rgba(224,184,94,.16),transparent 60%),radial-gradient(60vmax 60vmax at 108% 112%,rgba(26,98,68,.45),transparent 62%)}
.wc-back i{position:absolute;inset:-20%;background:repeating-linear-gradient(115deg,rgba(224,184,94,.035) 0 1px,transparent 1px 26px)}
.wc-back i+i{inset:0;background:radial-gradient(circle at 50% 45%,transparent 55%,rgba(0,0,0,.38))}
.wc{padding:18px 0 6px}
.wc-hero{display:grid;grid-template-columns:auto minmax(0,1fr);gap:44px;align-items:center}
.wc-crest{margin:0;width:236px;height:236px;filter:drop-shadow(0 22px 40px rgba(0,0,0,.45));animation:wcIn .9s cubic-bezier(.2,.8,.2,1) both}
.wc-crest svg{display:block;width:100%;height:100%;overflow:visible}
@keyframes wcIn{from{opacity:0;transform:scale(.86) rotate(-8deg)}to{opacity:1;transform:none}}
.wc-glow{fill:rgba(224,184,94,.07)}
.wc-r1,.wc-r2{fill:none;stroke:#d8ae58;stroke-width:1.5;transform:rotate(-90deg);transform-origin:120px 120px}
.wc-r1{stroke-dasharray:723;animation:wcDraw1 1.7s cubic-bezier(.6,0,.2,1) .15s both}
.wc-r2{stroke-width:1;stroke-opacity:.75;stroke-dasharray:597;animation:wcDraw2 1.7s cubic-bezier(.6,0,.2,1) .35s both}
@keyframes wcDraw1{from{stroke-dashoffset:723}}
@keyframes wcDraw2{from{stroke-dashoffset:597}}
.wc-ticks{stroke:#d8ae58;stroke-width:1.2;stroke-opacity:.55;transform-origin:120px 120px;animation:wnSpin 90s linear infinite}
.wc-arc{font:700 12px ui-serif,"New York",Georgia,serif;letter-spacing:.42em;fill:#e6c57e}
.wc-arc.b{font-size:9.5px;letter-spacing:.26em;fill:#c4ae7c}
.wc-mono{font-family:"Bodoni 72",Didot,ui-serif,Georgia,serif;font-size:70px;font-weight:400;letter-spacing:-.01em}
.wc-sheen{transform:translateX(-50px) skewX(-18deg);animation:wcSheen 7s ease-in-out 1.6s infinite}
@keyframes wcSheen{0%{transform:translateX(-50px) skewX(-18deg)}28%,100%{transform:translateX(250px) skewX(-18deg)}}
.wc-copy{min-width:0}
.wc-eye{margin:0;font:700 12.5px/1.3 ui-monospace,"SF Mono",Menlo,monospace;letter-spacing:.2em;text-transform:uppercase;color:var(--wn-a)}
.wc-hero h1{margin:14px 0;font:400 clamp(38px,5.6vw,64px)/1.04 ui-serif,"New York","Iowan Old Style",Georgia,serif;letter-spacing:-.02em;color:var(--ink);text-wrap:balance}
.wc-hero h1 em{font-style:italic;padding-right:.06em;background:linear-gradient(180deg,#f8e8bb,#d8ae58 60%,#b08436);-webkit-background-clip:text;background-clip:text;color:transparent}
.wc-lead{margin:0;max-width:48ch;font-size:17px;line-height:1.55;color:var(--ink2)}
.wc-sig{margin:22px 0 0}
.wc-sig small{display:block;font:700 12px/1 ui-monospace,"SF Mono",Menlo,monospace;letter-spacing:.24em;text-transform:uppercase;color:var(--dim)}
.wc-sig span{display:inline-block;padding:4px 22px 8px 2px;font:400 46px/1.15 "Snell Roundhand","Savoye LET","Apple Chancery",cursive;color:#ecd08f;animation:wcSign 1.8s cubic-bezier(.45,0,.2,1) .8s backwards}
@keyframes wcSign{from{clip-path:inset(0 100% 0 0)}to{clip-path:inset(0 0 0 0)}}
.wc-sig::after{content:"";display:block;width:min(300px,80%);height:1.5px;margin-top:2px;background:linear-gradient(90deg,#d8ae58,rgba(216,174,88,0));transform-origin:left;animation:wcLine 1s ease 2.2s backwards}
@keyframes wcLine{from{transform:scaleX(0)}}
.wc-asked{margin-top:44px}
.wc h2{display:flex;align-items:baseline;gap:6px 14px;flex-wrap:wrap;margin:0 0 4px;padding-bottom:12px;border-bottom:1px solid rgba(224,184,94,.32);font:400 26px/1.2 ui-serif,"New York",Georgia,serif;letter-spacing:-.01em;color:var(--ink)}
.wc h2 span{font:600 13px ui-monospace,"SF Mono",Menlo,monospace;letter-spacing:.06em;color:var(--dim)}
.wc-asked ol{margin:0;padding:0;list-style:none;display:grid;grid-template-columns:repeat(2,minmax(0,1fr));column-gap:36px}
.wc-asked li{display:grid;grid-template-columns:46px minmax(0,1fr);gap:16px;align-items:start;padding:22px 0;border-bottom:1px solid rgba(224,184,94,.16);animation:wnRise .55s cubic-bezier(.2,.8,.2,1) both}
.wc-asked .ic{display:grid;place-items:center;width:46px;height:46px;border-radius:50%;font-size:20px;border:1px solid rgba(224,184,94,.5);background:radial-gradient(circle at 35% 30%,rgba(224,184,94,.22),rgba(224,184,94,.04))}
.wc-ask{margin:0 0 9px;font:italic 400 15.5px/1.45 ui-serif,"New York",Georgia,serif;color:#e9dcba}
.wc-ask small{display:block;margin-bottom:3px;font:700 11.5px/1.2 ui-monospace,"SF Mono",Menlo,monospace;font-style:normal;letter-spacing:.16em;text-transform:uppercase;color:var(--wn-a)}
.wc-asked b{display:block;margin:0 0 5px;font:600 20px/1.25 ui-serif,"New York",Georgia,serif;color:var(--ink)}
.wc-asked li p:not(.wc-ask){margin:0;font-size:14.5px;line-height:1.58;color:var(--ink2)}
.wc-story{margin-top:40px}
.wc-story ol{position:relative;margin:20px 0 0;padding:0;list-style:none;display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:18px}
.wc-story ol::before{content:"";position:absolute;left:6px;right:6px;top:5px;height:1px;background:linear-gradient(90deg,rgba(224,184,94,.15),#d8ae58)}
.wc-story li{position:relative;padding-top:26px}
.wc-story li::before{content:"";position:absolute;left:0;top:0;width:11px;height:11px;box-sizing:border-box;border-radius:50%;border:1.5px solid #d8ae58;background:#06140f}
.wc-story li.now::before{background:#e0b85e;box-shadow:0 0 0 5px rgba(224,184,94,.18)}
.wc-story time{display:block;font:700 11.5px/1.3 ui-monospace,"SF Mono",Menlo,monospace;letter-spacing:.08em;text-transform:uppercase;color:var(--wn-a)}
.wc-story b{display:block;margin:6px 0 4px;font:600 17px/1.25 ui-serif,"New York",Georgia,serif;color:var(--ink)}
.wc-story p{margin:0;font-size:13.5px;line-height:1.5;color:var(--ink2)}
@media (max-width:980px){
  .wc-story ol{grid-template-columns:minmax(0,1fr);gap:0}
  .wc-story ol::before{left:5px;right:auto;top:8px;bottom:22px;width:1px;height:auto;background:linear-gradient(180deg,rgba(224,184,94,.15),#d8ae58)}
  .wc-story li{padding:0 0 18px 30px}.wc-story li::before{top:3px}.wc-story b{margin-top:3px}
}
@media (max-width:760px){
  .wc{padding-top:8px}
  .wc-hero{grid-template-columns:minmax(0,1fr);justify-items:center;text-align:center;gap:20px}
  .wc-crest{width:188px;height:188px}
  .wc-lead{font-size:16px;margin:0 auto}
  .wc-sig span{font-size:40px}.wc-sig::after{margin:2px auto 0}
  .wc-asked{margin-top:32px}.wc-asked ol{grid-template-columns:minmax(0,1fr)}
  .wc h2{font-size:23px}
}
@media (max-height:700px) and (min-width:761px){.wc-crest{width:196px;height:196px}}
.wn[data-look="voice"],.wn-coach[data-look="voice"]{--wn-bg:#130c26;--wn-a:#ff9b7a;--wn-a3:rgba(255,155,122,.24);--wn-go:linear-gradient(120deg,#ffb38a,#ff7a8a);--wn-on:#2a0d12;--wn-foot:rgba(17,10,34,.9)}
.wn[data-look="voice"]{--ink:#f4effc;--ink2:#d5cde6;--dim:#a79fbd}
.wn[data-look="voice"] .wn-x,.wn[data-look="voice"] .wn-btn{border-color:rgba(255,155,122,.35)}
.wn[data-look="voice"] .wn-btn.go{border-color:transparent}
.wn[data-look="voice"] .wn-foot{border-top-color:rgba(255,155,122,.18)}
.wv-back{position:absolute;inset:0;overflow:hidden;pointer-events:none;background:radial-gradient(60vmax 50vmax at 85% -10%,rgba(255,122,138,.2),transparent 60%),radial-gradient(70vmax 60vmax at -10% 110%,rgba(124,92,255,.32),transparent 62%)}
.wv-back i{position:absolute;inset:0;background:repeating-radial-gradient(circle at 22% 30%,rgba(255,255,255,.028) 0 1px,transparent 1px 34px)}
.wv{padding:18px 0 6px}
.wv-hero{display:grid;grid-template-columns:auto minmax(0,1fr);gap:48px;align-items:center}
.wv-caller{position:relative;margin:0;width:250px;display:grid;justify-items:center;gap:18px;padding-top:6px}
.wv-av{position:relative;z-index:1;display:grid;place-items:center;width:132px;height:132px;border-radius:50%;font:700 40px/1 ui-rounded,"SF Pro Rounded",system-ui,sans-serif;letter-spacing:.02em;color:#2a0d12;background:linear-gradient(140deg,#ffc29a,#ff7a8a 60%,#c25cff);box-shadow:0 18px 50px -12px rgba(255,122,138,.6);animation:wvIn .8s cubic-bezier(.2,.8,.2,1) both}
.wv-ring{position:absolute;left:50%;top:72px;width:132px;height:132px;margin:-66px 0 0 -66px;box-sizing:border-box;border-radius:50%;border:1.5px solid rgba(255,155,122,.55);animation:wvRing 3s cubic-bezier(.2,.6,.3,1) infinite}
.wv-ring.b{animation-delay:1s}.wv-ring.c{animation-delay:2s}
@keyframes wvRing{from{transform:scale(1);opacity:.9}to{transform:scale(1.9);opacity:0}}
@keyframes wvIn{from{opacity:0;transform:scale(.8)}to{opacity:1;transform:none}}
.wv-caller figcaption{display:grid;justify-items:center;gap:2px;text-align:center}
.wv-caller small{font:700 11.5px/1.3 ui-monospace,"SF Mono",Menlo,monospace;letter-spacing:.2em;text-transform:uppercase;color:var(--wn-a)}
.wv-caller b{font-size:20px;color:var(--ink)}
.wv-eq{display:flex;align-items:center;gap:3px;height:38px;margin-top:10px}
.wv-eq i{width:4px;height:100%;border-radius:2px;background:linear-gradient(180deg,#ffb38a,#c25cff);transform:scaleY(.2);animation:wvEq 1.1s ease-in-out infinite alternate}
@keyframes wvEq{0%{transform:scaleY(.15)}50%{transform:scaleY(.9)}100%{transform:scaleY(.35)}}
.wv-copy{min-width:0}
.wv-eye{margin:0;font:700 12.5px/1.3 ui-monospace,"SF Mono",Menlo,monospace;letter-spacing:.18em;text-transform:uppercase;color:var(--wn-a)}
.wv-hero h1{margin:14px 0;font:800 clamp(36px,5.2vw,58px)/1.05 ui-rounded,"SF Pro Rounded",system-ui,sans-serif;letter-spacing:-.025em;color:var(--ink);text-wrap:balance}
.wv-lead{margin:0;max-width:50ch;font-size:17px;line-height:1.55;color:var(--ink2)}
.wv-talk{margin-top:46px}
.wv h2{display:flex;align-items:baseline;gap:6px 14px;margin:0 0 18px;font:800 24px/1.2 ui-rounded,"SF Pro Rounded",system-ui,sans-serif;color:var(--ink)}
.wv h2 span{font:600 13px ui-monospace,"SF Mono",Menlo,monospace;color:var(--dim)}
.wv-talk ol{margin:0;padding:0;list-style:none;display:grid;gap:14px}
.wv-talk li{display:flex;align-items:flex-end;gap:12px;max-width:min(680px,86%);animation:wvPop .5s cubic-bezier(.2,.9,.3,1.2) both}
.wv-talk li.r{flex-direction:row-reverse;margin-left:auto}
@keyframes wvPop{from{opacity:0;transform:translateY(12px) scale(.96)}to{opacity:1;transform:none}}
.wv-talk .ic{flex:none;display:grid;place-items:center;width:42px;height:42px;border-radius:50%;font-size:19px;background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.12)}
.wv-b{padding:14px 18px;border-radius:22px 22px 22px 6px;background:rgba(124,92,255,.16);border:1px solid rgba(160,130,255,.28)}
.wv-talk li.r .wv-b{border-radius:22px 22px 6px 22px;background:linear-gradient(140deg,rgba(255,155,122,.18),rgba(255,122,138,.12));border-color:rgba(255,155,122,.32)}
.wv-b b{display:block;margin:0 0 4px;font-size:16.5px;color:var(--ink)}
.wv-b p{margin:0;font-size:14.5px;line-height:1.55;color:var(--ink2)}
@media (max-width:760px){
  .wv{padding-top:8px}
  .wv-hero{grid-template-columns:minmax(0,1fr);justify-items:center;text-align:center;gap:22px}
  .wv-caller{width:auto}.wv-av{width:108px;height:108px;font-size:33px}.wv-ring{top:60px;width:108px;height:108px;margin:-54px 0 0 -54px}
  .wv-lead{font-size:16px;margin:0 auto}
  .wv-talk li{max-width:100%}
}
.wn[data-look="live"],.wn-coach[data-look="live"]{--wn-bg:#030407;--wn-a:#9cc4ff;--wn-a3:rgba(120,170,255,.22);--wn-go:#f3f7ff;--wn-on:#05070c;--wn-foot:rgba(3,4,7,.86)}
.wn[data-look="live"]{--ink:#f3f6fb;--ink2:#c4ccd8;--dim:#8b94a4}
.wn[data-look="live"] .wn-x,.wn[data-look="live"] .wn-btn{border-color:rgba(156,196,255,.24)}
.wn[data-look="live"] .wn-btn.go{border-color:transparent;box-shadow:0 0 0 1px rgba(255,255,255,.35),0 12px 40px -12px rgba(90,150,255,.75)}
.wn[data-look="live"] .wn-foot{border-top-color:rgba(156,196,255,.1)}
.wr-back{position:absolute;inset:0;overflow:hidden;pointer-events:none;background:radial-gradient(90vmax 60vmax at 50% 125%,rgba(18,52,150,.2),transparent 70%)}
.wr-back i{position:absolute;left:50%;top:-14vmax;width:64vmax;height:52vmax;margin-left:-32vmax;border-radius:50%;background:radial-gradient(closest-side,rgba(44,112,255,.26),rgba(30,80,220,.08) 60%,transparent);filter:blur(30px);animation:wrHaze 9s ease-in-out infinite}
@keyframes wrHaze{0%,46%,100%{opacity:.7;transform:scale(1)}66%{opacity:1;transform:scale(1.06)}}
.wr{padding:6px 0 4px}
.wr-hero{display:grid;justify-items:center;text-align:center}
.wr-bar{display:inline-flex;align-items:center;gap:14px;padding:7px 15px 7px 12px;border-radius:999px;background:rgba(255,255,255,.045);border:1px solid rgba(255,255,255,.09);-webkit-backdrop-filter:blur(10px);backdrop-filter:blur(10px)}
.wr-live{display:inline-flex;align-items:center;gap:8px;font:650 12px/1 ui-monospace,"SF Mono",Menlo,monospace;letter-spacing:.16em;text-transform:uppercase;color:var(--ink2)}
.wr-live i{position:relative;width:8px;height:8px;border-radius:50%;background:#7fb8ff;box-shadow:0 0 10px #4f97ff}
.wr-live i::after{content:"";position:absolute;inset:-4px;border-radius:50%;border:1px solid rgba(127,184,255,.7);animation:wrPing 2.4s ease-out infinite}
@keyframes wrPing{from{transform:scale(.6);opacity:1}to{transform:scale(1.8);opacity:0}}
.wr-t{display:inline-flex;font:600 14px/1.2 ui-monospace,"SF Mono",Menlo,monospace;font-variant-numeric:tabular-nums;color:var(--ink)}
.wr-d{display:inline-block;height:1.2em;overflow:hidden;vertical-align:top}
.wr-d i{display:block;font-style:normal}
.wr-d b{display:block;height:1.2em;font-weight:inherit}
.wr-d.s i{animation:wrTick 10s steps(10) infinite}
.wr-d.t i{animation:wrTick 60s steps(6) infinite}
.wr-d.m i{animation:wrTick 600s steps(10) infinite}
@keyframes wrTick{to{transform:translateY(-100%)}}
.wr-orb{position:relative;margin:34px 0 0;width:232px;height:232px;display:grid;place-items:center}
.wr-glow{position:absolute;inset:-42%;border-radius:50%;background:radial-gradient(closest-side,rgba(72,140,255,.5),rgba(40,96,255,.14) 48%,transparent);animation:wrGlow 9s ease-in-out infinite}
@keyframes wrGlow{0%,44%,100%{opacity:.62;transform:scale(.96)}50%,88%{opacity:1;transform:scale(1.04)}}
.wr-ball{position:relative;width:100%;height:100%;border-radius:50%;overflow:hidden;isolation:isolate;background:radial-gradient(circle at 50% 58%,#0c2370,#050a1f 74%);box-shadow:inset 0 0 44px rgba(120,190,255,.38),inset 0 -24px 60px rgba(0,0,0,.5),0 0 0 1px rgba(170,205,255,.2),0 30px 90px -30px rgba(40,110,255,.9);animation:wrMorph 9s ease-in-out infinite,wrTalk 9s linear infinite}
.wr-ball::after{content:"";position:absolute;inset:0;border-radius:inherit;box-shadow:inset 0 10px 26px rgba(255,255,255,.1),inset 0 0 0 1px rgba(255,255,255,.1);pointer-events:none}
.wr-ball i{position:absolute;border-radius:50%;mix-blend-mode:screen;filter:blur(16px)}
.wr-ball i:nth-child(1){left:-14%;top:18%;width:84%;height:84%;background:radial-gradient(closest-side,#2f66ff,transparent);transform-origin:72% 40%;animation:wrSwirl 12s linear infinite}
.wr-ball i:nth-child(2){right:-10%;top:-8%;width:72%;height:72%;background:radial-gradient(closest-side,#2fc4ff,transparent);transform-origin:28% 72%;animation:wrSwirl 9s linear infinite reverse}
.wr-ball i:nth-child(3){left:22%;top:40%;width:58%;height:58%;background:radial-gradient(closest-side,rgba(170,235,255,.85),transparent);transform-origin:50% -10%;animation:wrSwirl 15s linear infinite}
.wr-ball i:nth-child(4){left:20%;top:12%;width:38%;height:30%;background:radial-gradient(closest-side,rgba(255,255,255,.85),transparent);filter:blur(10px);animation:wrShine 9s ease-in-out infinite}
@keyframes wrSwirl{to{transform:rotate(360deg)}}
@keyframes wrShine{0%,100%{transform:translate(0,0);opacity:.75}50%{transform:translate(10%,6%);opacity:1}}
@keyframes wrMorph{0%,100%{border-radius:50% 50% 50% 50%/50% 50% 50% 50%}33%{border-radius:47% 53% 45% 55%/54% 46% 54% 46%}66%{border-radius:54% 46% 52% 48%/45% 55% 47% 53%}}
@keyframes wrTalk{0%,22%,44%{transform:scale(1)}33%{transform:scale(1.015)}50%{transform:scale(1.05)}54%{transform:scale(1)}58%{transform:scale(1.06)}62%{transform:scale(1.01)}66%{transform:scale(1.045)}71%{transform:scale(1)}77%{transform:scale(1.035)}83%,100%{transform:scale(1)}}
.wr-orb figcaption{position:absolute;left:0;right:0;bottom:-34px;display:grid;justify-items:center}
.wr-st{grid-area:1/1;font:650 11.5px/1 ui-monospace,"SF Mono",Menlo,monospace;letter-spacing:.24em;text-transform:uppercase;color:var(--wn-a)}
.wr-st.a{animation:wrStA 9s ease infinite}
.wr-st.b{opacity:0;animation:wrStB 9s ease infinite}
@keyframes wrStA{0%,44%,100%{opacity:1}48%,96%{opacity:0}}
@keyframes wrStB{0%,44%,96%,100%{opacity:0}48%,92%{opacity:1}}
.wr-cap{display:grid;gap:8px;width:min(560px,100%);margin-top:62px}
.wr-cap p{margin:0;display:flex;justify-content:center;align-items:baseline;gap:12px;font-size:18px;line-height:1.4;font-weight:450}
.wr-cap small{flex:none;font:650 10.5px/1 ui-monospace,"SF Mono",Menlo,monospace;letter-spacing:.16em;text-transform:uppercase;color:var(--dim)}
.wr-cap .a span{color:var(--ink2)}
.wr-cap .b span{color:#fff;text-shadow:0 0 18px rgba(110,170,255,.45)}
.wr-cap .a{animation:wrLineA 9s linear infinite}
.wr-cap .b{animation:wrLineB 9s linear infinite}
.wr-cap .a span{animation:wrTypeA 9s linear infinite}
.wr-cap .b span{animation:wrTypeB 9s linear infinite}
@keyframes wrLineA{0%,2%{opacity:0}4%,88%{opacity:1}95%,100%{opacity:0}}
@keyframes wrLineB{0%,45%{opacity:0}47%,88%{opacity:1}95%,100%{opacity:0}}
@keyframes wrTypeA{0%,4%{clip-path:inset(0 100% 0 0);animation-timing-function:steps(28,end)}24%,100%{clip-path:inset(0 0 0 0)}}
@keyframes wrTypeB{0%,48%{clip-path:inset(0 100% 0 0);animation-timing-function:steps(31,end)}68%,100%{clip-path:inset(0 0 0 0)}}
.wr-eye{margin:40px 0 0;font:650 12.5px/1.3 ui-monospace,"SF Mono",Menlo,monospace;letter-spacing:.2em;text-transform:uppercase;color:var(--wn-a)}
.wr-hero h1{margin:12px 0 16px;font:300 clamp(46px,6.6vw,78px)/1.02 system-ui,-apple-system,"SF Pro Display","Helvetica Neue",sans-serif;letter-spacing:-.045em;background:linear-gradient(180deg,#fff 35%,#a6c4ff);-webkit-background-clip:text;background-clip:text;color:transparent;text-wrap:balance}
.wr-lead{margin:0 auto;max-width:54ch;font-size:17px;line-height:1.6;color:var(--ink2);text-wrap:pretty}
.wr-log{width:min(720px,100%);margin:58px auto 0}
.wr-log h2{display:flex;justify-content:space-between;align-items:baseline;flex-wrap:wrap;gap:4px 16px;margin:0 0 6px;padding-bottom:12px;border-bottom:1px solid rgba(156,196,255,.12);font:650 12.5px/1.3 ui-monospace,"SF Mono",Menlo,monospace;letter-spacing:.2em;text-transform:uppercase;color:var(--ink)}
.wr-log h2 span{letter-spacing:.08em;text-transform:none;font-weight:500;color:var(--dim)}
.wr-log ol{position:relative;margin:0;padding:0;list-style:none}
.wr-log ol::before{content:"";position:absolute;left:73px;top:24px;bottom:24px;width:2px;border-radius:2px;background:linear-gradient(180deg,#9cc4ff,rgba(60,120,255,.45) 70%,rgba(60,120,255,0));transform-origin:top;animation:wrDraw 1.8s cubic-bezier(.3,.7,.2,1) .2s both}
@keyframes wrDraw{from{transform:scaleY(0)}to{transform:none}}
.wr-log li{position:relative;display:grid;grid-template-columns:52px 44px minmax(0,1fr);align-items:start;padding:17px 0;animation:wrRise .6s cubic-bezier(.2,.8,.2,1) both}
@keyframes wrRise{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}
.wr-log time{padding-top:6px;text-align:right;font:600 13px/1.3 ui-monospace,"SF Mono",Menlo,monospace;font-variant-numeric:tabular-nums;color:var(--wn-a)}
.wr-node{justify-self:center;margin-top:8px;width:11px;height:11px;box-sizing:border-box;border-radius:50%;background:var(--wn-bg);border:2px solid #9cc4ff;box-shadow:0 0 0 4px var(--wn-bg),0 0 16px rgba(110,170,255,.85)}
.wr-say b{display:flex;align-items:center;gap:11px;margin:0 0 6px;font-size:17.5px;font-weight:600;letter-spacing:-.01em;color:var(--ink)}
.wr-say .ic{flex:none;display:grid;place-items:center;width:30px;height:30px;border-radius:9px;font-size:16px;background:rgba(120,170,255,.1);border:1px solid rgba(156,196,255,.18)}
.wr-say p{margin:0;max-width:60ch;font-size:15px;line-height:1.6;color:var(--ink2)}
@media (max-height:860px) and (min-width:761px){
  .wr-orb{margin-top:24px;width:176px;height:176px}
  .wr-cap{margin-top:52px}
  .wr-eye{margin-top:28px}
}
@media (max-width:760px){
  .wr{padding-top:2px}
  .wr-orb{margin-top:26px;width:164px;height:164px}
  .wr-cap{margin-top:52px;gap:10px}
  .wr-cap p{flex-direction:column;align-items:center;gap:5px;font-size:16px}
  .wr-eye{margin-top:30px;font-size:11.5px;letter-spacing:.16em}
  .wr-hero h1{font-size:clamp(40px,11vw,54px)}
  .wr-lead{font-size:16px}
  .wr-log{margin-top:44px}
  .wr-log ol::before{left:54px}
  .wr-log li{grid-template-columns:38px 34px minmax(0,1fr);padding:15px 0}
  .wr-log time{font-size:12px}
  .wr-say b{font-size:16.5px;gap:9px}
}
@media (prefers-reduced-motion:reduce){.wn,.wn *,.wn-coach *{animation:none!important;transition:none!important}}`;
  const s = document.createElement('style'); s.id = 'wn-css'; s.textContent = css; document.head.appendChild(s);
}
function wnOpen(from, v, seen) {  // the intro, in the version's own look (WN_LOOKS): what's new, and the walk for a big version
  const rel = wnRel(v); if (!rel || $('#wn') || $('.wn-coach')) return;
  wnStyle();
  const A = api(), walk = !!(rel.tour && A && !phone && !WN.phone && S);
  const look = WN_LOOKS[rel.look] ? rel.look : 'launch', L = WN_LOOKS[look];
  const lights = A && !phone ? '<div class="lights"><button class="c" data-act="win" data-w="close" aria-label="Hide" title="Hide the window. ' + APP + ' keeps running."></button><button class="m" data-act="win" data-w="min" aria-label="Minimize"></button><button class="f" data-act="win" data-w="full" aria-label="Full screen"></button></div>' : '<span></span>';
  const el = document.createElement('div');
  el.id = 'wn'; el.className = 'wn'; el.dataset.look = look; el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true'); el.setAttribute('aria-labelledby', 'wn-h');
  el.innerHTML = `${L.back()}
    <header class="wn-top ct-drag">${lights}<button class="wn-x" data-w="close">Close</button></header>
    <div class="wn-scroll"><div class="wn-in">${L.page(rel)}${wnMore(rel, seen, !!from)}</div></div>
    <footer class="wn-foot">${walk ? '<button class="wn-btn go" data-w="tour">Show me around ›</button><button class="wn-btn" data-w="close">Got it</button><small>The walk takes about a minute. You can see this again in Settings → What’s new.</small>'
      : '<button class="wn-btn go" data-w="close">Got it</button>' + (phone || WN.phone ? '' : '<small>You can see this again in Settings → What’s new.</small>')}</footer>`;
  document.body.appendChild(el);
  WN.rel = rel; WN.back = from || document.activeElement; WN.held = [];
  [...document.body.children].forEach(c => { if (c !== el && !c.matches('.toast, .newnum') && !c.inert) { c.inert = true; WN.held.push(c); } });
  const done = k => {
    wnMark();
    (WN.held || []).forEach(c => { c.inert = false; }); WN.held = [];
    el.classList.add('out'); setTimeout(() => el.remove(), 200);
    if (k === 'tour') setTimeout(() => wnTour(rel), 220);
    else if (WN.back && WN.back.isConnected) WN.back.focus({ preventScroll: true });
  };
  el.addEventListener('click', e => { const b = e.target.closest('[data-w]'); if (b && !b.closest('.lights')) done(b.dataset.w); });
  el.addEventListener('keydown', e => {
    if (e.key === 'Escape') { e.preventDefault(); done('close'); }
    else if (e.key === 'Tab') {
      const fs = [...el.querySelectorAll('button:not([disabled])')].filter(x => x.getClientRects().length);
      if (fs.length && e.shiftKey && document.activeElement === fs[0]) { e.preventDefault(); fs[fs.length - 1].focus(); }
      else if (fs.length && !e.shiftKey && document.activeElement === fs[fs.length - 1]) { e.preventDefault(); fs[0].focus(); }
    }
  });
  setTimeout(() => { const b = $('.wn-foot .go', el); if (b) b.focus({ preventScroll: true }); }, 80);
}
/* The walk: the real screens, one new thing lit at a time. A step names a tab (view), a stock page (stock) or a room,
   and the thing to light (sel). Nothing underneath can be clicked while it runs; Esc or Skip ends it. */
function wnTourStock() { const o = (S.orders || []).find(x => x.by === 'claude' && x.kind === 'buy' && x.ticker) || (S.orders || []).find(x => x.by === 'claude' && x.ticker); return o ? String(o.ticker).toUpperCase() : ((S.positions || [])[0] || {}).ticker || ''; }
async function wnFind(sel, ms = 4500) {  // the thing to light, once it's on screen and has stopped moving (rooms fly in)
  const t0 = Date.now(); let last = '', el = null;
  while (Date.now() - t0 < ms) {
    el = document.querySelector(sel);
    if (el && el.getClientRects().length) { const r = el.getBoundingClientRect(), k = [r.left, r.top, r.width, r.height].map(Math.round).join(); if (k === last) return el; last = k; }
    await wnWait(150);
  }
  return el && el.getClientRects().length ? el : null;
}
function wnBring(t, th = 0) {  // scroll the thing into view: only its own scrolling panel (or the page), never a room's fixed frame
  const r = t.getBoundingClientRect();
  let p = t.parentElement;
  for (; p && p !== document.body; p = p.parentElement) { const o = getComputedStyle(p).overflowY; if ((o === 'auto' || o === 'scroll') && p.scrollHeight > p.clientHeight + 4) break; }
  if (p && p !== document.body) { const q = p.getBoundingClientRect(); p.scrollTop += r.top - q.top - (r.height > q.height - 40 ? 14 : (q.height - r.height) / 2); }
  else {
    const H = window.innerHeight, g = r.height + 32 + th;  // 2.0: the ring (8 px around it), a 16 px gap and the card (th tall)
    const fits = (H - r.height) / 2 >= th + 36;            // centred, the card has room over or under it; if not, centre both
    window.scrollBy(0, r.top - (th && !fits && g + 24 <= H ? (H - g) / 2 + 8 : r.height > H - 160 ? 84 : (H - r.height) / 2));
  }
}
function wnPlace() {  // the ring around the target and the card beside it, kept in place while things move
  const c = WN.el; if (!c) return;
  const ring = $('.wn-ring', c), tip = $('.wn-tip', c), W = window.innerWidth, H = window.innerHeight, t = WN.target && WN.target.isConnected ? WN.target : null;
  let box = null;
  if (t) {
    const r = t.getBoundingClientRect(), pad = 8;
    let x1 = Math.max(8, r.left - pad), y1 = Math.max(8, r.top - pad), x2 = Math.min(W - 8, r.right + pad), y2 = Math.min(H - 8, r.bottom + pad);
    for (let p = t.parentElement; p && p !== document.body; p = p.parentElement) {  // only the part that shows inside a scrolling panel
      const o = getComputedStyle(p).overflowY; if (o !== 'auto' && o !== 'scroll') continue;
      const q = p.getBoundingClientRect(); x1 = Math.max(x1, q.left + 2); y1 = Math.max(y1, q.top + 2); x2 = Math.min(x2, q.right - 2); y2 = Math.min(y2, q.bottom - 2);
    }
    const bar = $('#room .rm-help');  // on a narrow window the room's Ask bar stays at the bottom, over the screen: the ring stops above it
    if (bar && !bar.hidden && !bar.contains(t) && getComputedStyle(bar).position === 'sticky') { const q = bar.getBoundingClientRect(); if (q.top > y1 + 40) y2 = Math.min(y2, q.top - 4); }
    if (x2 - x1 > 20 && y2 - y1 > 20) box = [x1, y1, x2 - x1, y2 - y1];
  }
  ring.classList.toggle('none', !box);
  const b = box || [W / 2, H / 2, 0, 0];
  ring.style.left = b[0] + 'px'; ring.style.top = b[1] + 'px'; ring.style.width = b[2] + 'px'; ring.style.height = b[3] + 'px';
  const tw = tip.offsetWidth, th = tip.offsetHeight, gap = 16;
  let x, y;
  if (!box) { x = (W - tw) / 2; y = (H - th) / 2; }
  else {
    x = Math.min(Math.max(12, b[0]), W - tw - 12);
    if (b[1] + b[3] + gap + th <= H - 12) y = b[1] + b[3] + gap;            // under it
    else if (b[1] - gap - th >= 12) y = b[1] - gap - th;                   // over it
    else if (b[0] + b[2] + gap + tw <= W - 12) { x = b[0] + b[2] + gap; y = Math.min(Math.max(12, b[1]), H - th - 12); }  // to its right
    else if (b[0] - gap - tw >= 12) { x = b[0] - gap - tw; y = Math.min(Math.max(12, b[1]), H - th - 12); }               // to its left
    else {                                                                 // no side has room: the corner that covers the least of it
      let best = Infinity;
      for (const [cx, cy] of [[W - tw - 18, H - th - 18], [18, H - th - 18], [W - tw - 18, 18], [18, 18]]) {
        const ov = Math.max(0, Math.min(cx + tw, b[0] + b[2]) - Math.max(cx, b[0])) * Math.max(0, Math.min(cy + th, b[1] + b[3]) - Math.max(cy, b[1]));
        if (ov < best - 1) { best = ov; x = cx; y = cy; }
      }
    }
  }
  tip.style.left = Math.round(x) + 'px'; tip.style.top = Math.round(y) + 'px';
}
function wnCard() {
  const s = WN.steps[WN.i], n = WN.steps.length, last = WN.i === n - 1;
  return `<button class="wn-end" data-w="skip" aria-label="End the walk" title="End the walk">×</button><div class="wn-dots" aria-hidden="true">${WN.steps.map((_, i) => `<i${i === WN.i ? ' class="on"' : i < WN.i ? ' class="was"' : ''}></i>`).join('')}</div>
    <p class="wn-eyebrow">New in v${esc(WN.rel ? WN.rel.v : window.CT_VERSION)} · ${WN.i + 1} of ${n}</p><h2 id="wn-th">${esc(wnTx(s.title))}</h2><p>${esc(wnTx(s.text))}</p>
    <div class="wn-nav">${WN.i && !last ? '<button class="wn-btn" data-w="back">‹ Back</button>' : last ? '<span></span>' : '<button class="wn-skip" data-w="skip">Skip the walk</button>'}
      <button class="wn-btn go" data-w="${last ? 'skip' : 'next'}">${last ? 'Done' : 'Next ›'}</button></div>`;
}
async function wnStep() {
  const c = WN.el; if (!c) return;
  const tok = ++WN.tok, s = WN.steps[WN.i], tip = $('.wn-tip', c), ring = $('.wn-ring', c);
  tip.classList.add('swap'); ring.classList.remove('live'); WN.target = null;
  const inRoom = !!$('#room');
  if (s.room) {
    if (!inRoom) { if (ui.view !== 'firm') { closeSheet(); ui.view = 'firm'; draw(); await wnWait(350); } if (tok !== WN.tok) return; roomOpen(S, { phone }, s.room, null); c.inert = false; delete c.dataset.rmInert; await wnWait(900); }
  } else {
    if (inRoom) { roomClose(true); await wnWait(60); }
    closeSheet();
    if (s.stock) { const t = wnTourStock(); if (t) { ui.prev = 'bot'; ui.stock = t; ui.stockNote = null; ui.view = 'stock'; } else ui.view = 'bot'; }
    else if (s.view) ui.view = s.view;
    draw(); window.scrollTo(0, 0); await wnWait(120);
    if (tok !== WN.tok) return;
    if (s.sheet === 'settings') { openSettings(); await wnWait(260); }  // 2.0: a step can light something in a sheet
    else if (s.sheet === 'about') { openAbout(); await wnWait(260); }
  }
  if (tok !== WN.tok) return;
  const t = s.sel ? await wnFind(s.sel, s.room ? 5000 : 2200) : null;
  if (tok !== WN.tok) return;
  tip.innerHTML = wnCard();  // still hidden: measured first, so the page can make room for it (2.0)
  if (t) { wnBring(t, tip.offsetHeight); await wnWait(80); }
  if (tok !== WN.tok) return;
  WN.target = t;
  tip.classList.remove('swap'); wnPlace();
  setTimeout(() => { if (tok === WN.tok) ring.classList.add('live'); }, 450);
  const b = $('.go', tip); if (b) b.focus({ preventScroll: true });
}
function wnTour(rel) {
  if (!rel || !rel.tour || $('.wn-coach') || !S) return;
  wnStyle();
  WN.steps = rel.tour.filter(s => !s.stock || wnTourStock()); WN.i = 0; WN.busy = true;
  const el = document.createElement('div');
  el.className = 'wn-coach'; el.dataset.look = WN_LOOKS[rel.look] ? rel.look : 'launch'; WN.rel = rel; el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true'); el.setAttribute('aria-labelledby', 'wn-th');
  el.innerHTML = '<div class="wn-ring none"></div><section class="wn-tip swap" aria-live="polite"></section>';
  document.body.appendChild(el); WN.el = el;
  const tick = () => { if (WN.el !== el) return; if (WN.target) wnPlace(); WN.raf = requestAnimationFrame(tick); };
  WN.raf = requestAnimationFrame(tick);
  const end = () => {
    WN.tok++; cancelAnimationFrame(WN.raf); WN.el = null; WN.target = null; WN.busy = false;
    window.removeEventListener('resize', wnPlace);
    if ($('#room')) roomClose(true);
    el.remove(); closeSheet(); ui.view = 'bot'; draw(); window.scrollTo(0, 0);
  };
  const act = k => {
    if (k === 'skip') end();
    else if (k === 'next' && WN.i < WN.steps.length - 1) { WN.i++; wnStep(); }
    else if (k === 'back' && WN.i > 0) { WN.i--; wnStep(); }
  };
  el.addEventListener('click', e => { const b = e.target.closest('[data-w]'); if (b) act(b.dataset.w); });
  el.addEventListener('keydown', e => {
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); end(); }
    else if (e.key === 'ArrowRight') { e.preventDefault(); act('next'); }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); act('back'); }
    else if (e.key === 'Tab') {
      const fs = [...el.querySelectorAll('button')].filter(x => x.getClientRects().length);
      if (fs.length && e.shiftKey && document.activeElement === fs[0]) { e.preventDefault(); fs[fs.length - 1].focus(); }
      else if (fs.length && !e.shiftKey && document.activeElement === fs[fs.length - 1]) { e.preventDefault(); fs[0].focus(); }
    }
  });
  window.addEventListener('resize', wnPlace);
  wnStep();
}
function wnAuto(opt) {  // once per version, by itself: at the first quiet moment after the app opens on a new version
  if (opt && opt.phone) WN.phone = true;
  if (!wnRel()) return;
  if (wnAuto.on) { if (wnAuto.go && !wnAuto.done) setTimeout(wnAuto.go, 1400); return; }  // the phone unlocked again: look once more
  wnAuto.on = true;
  let tries = 0, asking = false;
  const go = async () => {
    if (wnAuto.done || asking) return;
    if (!phone && !WN.phone && !api()) return;                                  // the Mac page: wait for the app's bridge
    if (S && S.setup && S.setup.needed) return;                                 // a new copy: its setup tour comes first
    const lock = $('#lock');                                                    // the phone's lock screen: never over it
    if ((lock && !lock.hidden) || $('#call') || $('#wn') || $('#boss') || $('#tour') || $('#room') || ($('#layer') && $('#layer').innerHTML)) { if (tries++ < 40) setTimeout(go, 5000); return; }
    asking = true; const seen = await wnSeen(); asking = false;
    if (seen === null) return;
    wnAuto.done = true;
    if (!seen || wnOlder(seen, wnRel().v)) wnOpen(null, null, seen);
  };
  wnAuto.go = go;
  setTimeout(go, 1400);
  window.addEventListener('pywebviewready', () => setTimeout(go, 700), { once: true });
}
function wnHide() {  // the phone locked itself while the intro was up: put it away unseen, it comes back after the unlock
  const el = $('#wn'); if (!el) return;
  (WN.held || []).forEach(c => { c.inert = false; }); WN.held = [];
  el.remove(); wnAuto.done = false;
}

/* ---------------- actions ---------------- */
function toast(t, ms) {
  ms = ms || Math.min(9000, Math.max(3600, String(t || '').length * 60));  // a two-sentence answer stays long enough to read
  let el = $('.toast'); if (el) el.remove();
  el = document.createElement('div'); el.className = 'toast'; el.setAttribute('role', 'status'); el.setAttribute('aria-live', 'polite'); el.textContent = t; document.body.appendChild(el);
  const cmp = ui.view === 'chat' && $('.ch-comp');  // 2.0: in the Chat it sits just above the message box, never on it
  if (cmp) el.style.bottom = Math.round(window.innerHeight - cmp.getBoundingClientRect().top + 12) + 'px';
  clearTimeout(toast.tm); toast.tm = setTimeout(() => el.remove(), ms);
}
/* v1.0.1: Today's order list and headline the moment an order is answered, filed or snoozed (worked out by the app from
   its saved numbers, in a blink); the full re-plan then runs behind it and the page reloads on it. */
function applyPlan(p) {
  if (!p || !p.ok || !S) return false;
  S.orders = p.orders || []; S.snoozed = p.snoozed || []; S.bundle = p.bundle || null;
  Object.assign(S.bot, p.bot || {});
  const n = S.orders.length;  // the count on the Today tab follows too
  $$('.nav [data-view="bot"], .tabs [data-view="bot"]').forEach(b => {
    let g = $('.badge', b);
    if (!n) { if (g) b.removeChild(g); b.removeAttribute('aria-label'); return; }
    if (!g) { g = document.createElement('span'); g.className = 'badge'; b.appendChild(g); }
    g.textContent = n;
    if (b.closest('.tabs')) { g.setAttribute('aria-hidden', 'true'); b.setAttribute('aria-label', `Today, ${n} order${n === 1 ? '' : 's'} waiting`); }
  });
  movePill();
  if (ui.view !== 'bot') return true;
  if ($('#room') || ($('#layer') && $('#layer').innerHTML) || halfTyped()) {  // something is open or half-typed: only the headline changes now
    const h = $('.b2-head h1'); if (h) h.textContent = S.bot.headline || 'All set.';
    return true;
  }
  draw(true, true);
  return true;
}
async function regrade(msg) {
  const A = api(); if (!A) return;
  if (A.plan_now) { try { applyPlan(await A.plan_now()); } catch (e) { /* the re-plan below still runs */ } }
  toast('Re-planning…', 60000);
  for (let k = 0; k < 90; k++) {
    const r = await A.refresh();
    if (r === 'done') { try { sessionStorage.setItem('ct2-toast', msg || 'Done.'); } catch (e) { /* private mode */ } location.reload(); return; }
    if (r !== 'busy') { toast('Re-planning failed: ' + r); return; }
    await new Promise(res => setTimeout(res, 3000));
  }
}
/* v1.0.1: the two steps of Send (copy it, then "I sent it") belong to the ORDER, not to its place in the list, and they
   survive a redraw or a reload. Before, a reload on new numbers put the button back at step one, and after an answer to
   another order the "copied" mark slid onto the next card. */
const SENT_MS = 30 * 60 * 1000;
function sentLoad() {
  try {
    const o = JSON.parse(sessionStorage.getItem('ct2-sent') || '{}'), now = Date.now(), keep = {};
    Object.keys(o).forEach(k => { if (now - o[k] < SENT_MS) keep[k] = o[k]; });
    return keep;
  } catch (e) { return {}; }
}
function sentMark(id, on) {
  if (on) ui.sent[id] = Date.now(); else if (id === 'all') ui.sent = {}; else ui.sent[id] = 0;
  try { sessionStorage.setItem('ct2-sent', JSON.stringify(ui.sent)); } catch (e) { /* private mode */ }
}
const sentStep = id => !!(ui.sent[id] && Date.now() - ui.sent[id] < SENT_MS);  // v1.2: "this order's box is open"
ui.sent = sentLoad();
try { ui.steps = localStorage.getItem('ct-steps') !== '0'; } catch (e) { ui.steps = true; }
async function send(btn) {  // "I placed it": the order goes under In motion, and the app follows it until it fills
  const A = api(), i = btn.dataset.i, a = i === 'all' ? null : S.orders[+i], id = a ? a.id : 'all';
  const box = btn.closest('.ticket, .bundle');
  const orders = a ? a.orders : S.bundle.orders, label = a ? a.title : S.bundle.label;
  btn.disabled = true; btn.textContent = 'Saving…';
  if (A && orders && orders.length) await (A.orders_placed ? A.orders_placed(orders, label || '') : A.send_to_dad(orders, label || ''));
  sentMark(id, 0);
  if (box && box.classList.contains('ticket')) box.classList.add('gone');
  const cancels = (orders || []).length && (orders || []).every(o => o.kind === 'cancel');
  regrade(cancels ? 'Canceled. The app stops counting on that order and frees the money.' : 'Filed under In motion. The app follows it from here and tells you when it fills.');
}
async function moAct(btn) {
  const A = api(); if (!A) return;
  const m = (S.motion || []).find(x => x.id === btn.dataset.id) || ((S.orders || []).find(a => a.motion && a.motion.id === btn.dataset.id) || {}).motion;
  if (!m) return;
  const o = m.order || {}, kind = btn.dataset.kind, val = btn.dataset.val;
  if (kind === 'bank') { await A.bank_status(m.ref, val); return regrade('Updated.'); }
  if (kind === 'undo') { await A.pending_undo(o.id); return regrade('Undone. It\'s back to waiting.'); }
  if (kind === 'filled') return fillForm(o);
  if (kind === 'went') {
    if (!(await A.market_open())) { await A.pending_status(o.id, 'placed'); return regrade(`${o.ticker}: marked as placed. The app logs it at the opening price.`); }
    return fillForm(o);
  }
  await A.pending_status(o.id, val);
  regrade(val === 'done' ? 'Marked done.' : 'Updated.');
}
function fillForm(o) {
  openSheet('<span class="eyebrow">Log the fill</span>', `<div class="form"><div class="fs"><h3>${esc((o.kind || '').toUpperCase())} ${esc(o.ticker)}</h3>
    <p class="d">What Schwab shows for the fill. The app updates your cash and positions from it.</p><div class="row">
    <label class="f">Shares<input id="fl-sh" type="number" step="any" value="${esc(o.shares)}"></label><label class="f">Price ($)<input id="fl-px" type="number" step="any" value="${esc(o.price)}"></label></div></div></div>`,
  `<div class="save"><button class="btn go" data-act="fill" data-id="${esc(o.id)}" data-k="${esc(o.kind)}" data-t="${esc(o.ticker)}">Save the fill</button><span class="err" id="serr"></span></div>`);
}
async function fill(btn) {
  const A = api(); if (!A) return;
  const d = { ticker: btn.dataset.t, shares: +$('#fl-sh').value, price: +$('#fl-px').value };
  const r = await A.trade(btn.dataset.k === 'sell' ? 'sell' : 'buy', d);
  if (r && r.error) { $('#serr').textContent = r.error; return; }
  await A.pending_status(btn.dataset.id, 'done');
  regrade(`${d.ticker}: logged.`);
}
function search() {
  if (phone) return;
  const seenT = new Set((S.positions || []).map(p => p.ticker));
  const opts = [...(S.positions || []).map(p => [p.ticker, p.name, 'You own it']),
    ...((S.analyst || {}).watchlist || []).filter(w => w.ticker && !seenT.has(w.ticker) && seenT.add(w.ticker)).map(w => [w.ticker, (S.radar || []).concat([]).find(r => r.ticker === w.ticker)?.name || '', 'The firm is watching']),
    ...(S.radar || []).filter(r => !seenT.has(r.ticker) && seenT.add(r.ticker)).map(r => [r.ticker, r.name, 'Idea'])];
  $('#layer').innerHTML = `<div class="scrim" data-act="close" aria-hidden="true"></div><div class="card pal" role="dialog" aria-modal="true" aria-label="Search any stock"><input id="q" aria-label="Search any stock" placeholder="Any ticker: the research desk looks into it" autocomplete="off" spellcheck="false"><ul id="ql"></ul></div>`;
  const q = $('#q'), ql = $('#ql');
  const fill = () => {
    const v = q.value.trim().toUpperCase();
    const hits = opts.filter(o => !v || o[0].startsWith(v) || (o[1] || '').toUpperCase().includes(v)).slice(0, 7);
    ql.innerHTML = hits.map((o, k) => `<li><button class="${k ? '' : 'sel'}" data-act="stock" data-t="${esc(o[0])}"><b>${esc(o[0])}</b><span class="dim">${esc(o[1] || '')}</span><span class="tag t-mut" style="margin-left:auto">${esc(o[2])}</span></button></li>`).join('')
      + (v && !hits.some(o => o[0] === v) ? `<li><button class="${hits.length ? '' : 'sel'}" data-act="stock" data-t="${esc(v)}"><b>${esc(v)}</b><span class="dim">Research it now</span></button></li>` : '');
  };
  q.addEventListener('input', fill);
  q.addEventListener('keydown', e => { if (e.key === 'Enter') { const b = $('#ql button.sel') || $('#ql button'); if (b) b.click(); } });
  fill(); q.focus();
}

/* ---------------- events ---------------- */
function onClick(e) {
  const el = e.target.closest('[data-view],[data-act]');
  if (!el) { if (!e.target.closest('.snz')) $$('.snz-m').forEach(m => m.remove()); return; }
  if (el.dataset.view) { closeSheet(); ui.view = el.dataset.view; draw(); return; }
  const A = api(), act = el.dataset.act;
  if (act && act.startsWith('ch') && chAct(act, el)) return;  // the Chat (chAct says no to anything else)
  if (act === 'close') closeSheet();
  else if (act === 'stock') { closeSheet(); openStock(el.dataset.t); }
  else if (act === 'backview') { ui.view = ui.prev || 'bot'; ui.stock = null; draw(); }
  else if (act === 'replyopen') { const box = $('.replybox', el.closest('.ticket')); box.innerHTML = box.innerHTML ? '' : replyBox(el.dataset.i); const ta = $('textarea', box); if (ta) ta.focus(); }
  else if (act === 'replyclose') { $('.replybox', el.closest('.ticket')).innerHTML = ''; }
  else if (act === 'quick') sendReply(el.dataset.i, el.dataset.q, el);
  else if (act === 'replysend') { const ta = $('textarea', el.closest('.reply')); sendReply(el.dataset.i, ta && ta.value, el); }
  else if (act === 'back' && A) { el.disabled = true; A.bring_back(el.dataset.id).then(() => regrade('Back on your list.')); }
  else if (act === 'send') send(el);
  else if (act === 'place') placeToggle(el.dataset.i);
  else if (act === 'broker') { brokerSet(el.dataset.b); placeRedraw(); }
  else if (act === 'plsteps') { ui.steps = ui.steps === false; try { localStorage.setItem('ct-steps', ui.steps ? '1' : '0'); } catch (e) { /* it lasts until the page reloads */ } placeRedraw(); }
  else if (act === 'plcopy') { const a = el.dataset.i === 'all' ? { orders: S.bundle.orders } : S.orders[+el.dataset.i]; if (a) copyOut(placeText(a), el.dataset.i === 'all' ? 'All the orders are copied' : 'The order is copied'); }
  else if (act === 'copy') { (navigator.clipboard ? navigator.clipboard.writeText(el.dataset.text) : Promise.reject()).then(() => toast('Copied'), () => toast('Couldn’t copy here')); }
  else if (act === 'snzmenu') {
    const box = el.closest('.snz'); if ($('.snz-m', box)) { $('.snz-m', box).remove(); return; }
    box.insertAdjacentHTML('beforeend', '<div class="snz-m"><button data-act="snooze" data-d="1">Ask me tomorrow</button><button data-act="snooze" data-d="5">Ask me next week</button></div>');
  } else if (act === 'snooze' && A) {
    const tk = el.closest('.ticket'), aid = tk.dataset.aid; tk.classList.add('gone');
    A.autopilot_snooze(aid, +el.dataset.d).then(() => regrade(+el.dataset.d > 1 ? 'Snoozed for a week. The firm asks again then if it still makes sense.' : 'Snoozed until tomorrow.'));
  } else if (act === 'unsnooze' && A) A.autopilot_unsnooze(null).then(() => regrade('Snoozed orders are back.'));
  else if (act === 'keep' && A) { el.disabled = true; A.decide(el.dataset.t, 'hold', '', 'Kept from the bot', +el.dataset.px).then(() => regrade(`${el.dataset.t}: kept. The firm asks again in about a month, sooner if it drops.`)); }
  else if (act === 'bank' && A) { el.disabled = true; A.bank_moved(+el.dataset.amt).then(() => regrade('Transfer noted. The app counts it once it lands.')); }
  else if (act === 'mo') moAct(el);
  else if (act === 'deep' && A) { el.disabled = true; el.textContent = 'Starting…'; A.deep_research(el.dataset.t).then(r => { toast((r && r.said) || 'Started.', 6000); el.textContent = r && r.ok ? 'The research desk is on it…' : 'Try again later'; }); }
  else if (act === 'fill') fill(el);
  else if (act === 'review' && A) { el.disabled = true; el.textContent = 'Starting…'; A.run_review().then(r => { toast((r && r.said) || 'Started.', 7000); el.textContent = r && r.ok ? 'The firm is reviewing…' : 'Try again later'; }); }
  else if (act === 'brief' && A) { el.disabled = true; el.textContent = 'Starting…'; A.new_briefing().then(r => { toast((r && r.said) || 'Started.', 7000); el.textContent = r && r.ok ? 'The PM is writing a new one…' : 'Try again later'; }); }
  else if (act === 'ask' && A) askClaude(el);
  else if (act === 'rescan' && A) rescan(el);
  else if (act === 'search') search();
  else if (act === 'settings') openSettings();
  else if (act === 'strat') { closeSheet(); openStrategy(); }
  else if (act === 'stpick') stratPick(el.dataset.k);
  else if (act === 'stsave') stratSave(el);
  else if (act === 'sth') stratAnswer('horizon', el.dataset.k);
  else if (act === 'stc') stratAnswer('comfort', el.dataset.k);
  else if (act === 'stedit') stratEdit();
  else if (act === 'stown') stratOwn();
  else if (act === 'stuse') stratUse(el.dataset.id);
  else if (act === 'stmedit') stratUse(el.dataset.id, true);
  else if (act === 'stdel') stratDel(el);
  else if (act === 'feedback') { closeSheet(); openFeedback(); }  // 2.0: the feedback board
  else if (act === 'fbkind') fbKind(el.dataset.k);
  else if (act === 'fbsend') fbSend(el);
  else if (act === 'fbbox') fbBox(el.dataset.id);
  else if (act === 'fbmore') fbMore(el);
  else if (act === 'fbans') fbAnswer(el);
  else if (act === 'fbcopy') fbCopy(el);
  else if (act === 'fbnote') fbNote();
  else if (act === 'fbclosed') fbClosed();
  else if (act === 'setup') openSetup(el.dataset.to);  // v6: the setup guide
  else if (act === 'awake') { closeSheet(); openAwake(); }  // 2.0: keep this Mac awake
  else if (act === 'awset') awSet(el.dataset.m);
  else if (act === 'awpow') awSet(null, el.checked);
  else if (act === 'awhide' && A) { $$('.fl-aw').forEach(x => x.parentNode.removeChild(x)); if (S.awake) S.awake.slept = null; A.awake_hide(); toast('Hidden. It shows again only after another long nap.'); }
  else if (act === 'awamph' && A) A.awake_amph();
  else if (act === 'mnew' && A) A.phone_new_code().then(r => toast(r && r.error ? r.error : 'Choose the new code in the window that opened. Every phone then asks for it once.', 8000));
  else if (act === 'whatsnew') { closeSheet(); wnOpen(el); }
  else if (act === 'about') { closeSheet(); openAbout(); }  // 2.0: the app's story and its maker
  else if (act === 'tour') { closeSheet(); tourOpen(S, OPT, el.dataset.m || 'tour', el); }  // v7: the guided tour
  else if (act === 'save') saveSettings(el);
  else if (act === 'hadd') { $('#htable tbody').insertAdjacentHTML('beforeend', hrow({ mode: 'short' })); ui.htouched = true; }
  else if (act === 'hdel') { el.closest('tr').remove(); ui.htouched = true; }
  else if (act === 'sync' && A) {
    const k = el.dataset.k; el.disabled = true;
    (k === 'on' ? A.yahoo_connect() : k === 'off' ? A.yahoo_disconnect() : A.yahoo_sync_now()).then(r => {
      if (r && r.error) { toast(r.error); el.disabled = false; return; }
      if (k === 'on') toast('Sign in to Yahoo in the window that opened.'); else regrade(k === 'off' ? `Disconnected from ${BN()}.` : `Synced with ${BN()}.`);
    });
  } else if (act === 'mcode' && A) A.mirror_code();
  else if (act === 'test' && A) A.test_alert().then(() => toast('Sent a test notification.'));
  else if (act === 'link' && A) A.open_link(el.dataset.u);
  else if (act === 'unexempt' && A) A.exempt(el.dataset.t, false).then(() => regrade(`${el.dataset.t} is back in SRM Finance.`));
  else if (act === 'upd' && A) updAct(el);
  else if (act === 'updauto' && A) { if (A.update_auto) A.update_auto(el.checked).then(r => { if (r && r.status && S.settings) S.settings.update = r.status; toast(el.checked ? 'New versions install by themselves when nobody is at the Mac.' : 'New versions wait for you to press Restart to update.'); }); }
  else if (act === 'win' && A) A.win(el.dataset.w);
}
async function askClaude(btn) {  // 2.0: the Today box starts a conversation with the PM on the Chat tab
  const ta = $('#askq'), q = ta && ta.value.trim();
  if (!q) { if (ta) ta.focus(); return; }
  if (btn) btn.disabled = true;
  CHT.cur = null; CHT.th = null; CHT.who = 'pm'; CHT.draft = '';
  ui.view = 'chat'; draw();
  await chSend(q);
}
async function rescan(btn) {
  const A = api(); btn.classList.add('busy'); btn.disabled = true; window.slStatus('scanning');
  const r = await A.rescan();
  if (r === 'busy') toast('A scan is already running. The page updates when it finishes.');
  else if (r === 'done') { try { sessionStorage.setItem('ct2-toast', 'Fresh scan done.'); } catch (e) { /* private mode */ } location.reload(); return; }
  else toast('The scan hit a problem. Try again in a minute.');
  btn.classList.remove('busy'); btn.disabled = false; const sp_ = $('.scanpill'); if (sp_) sp_.hidden = true; const s_ = $('span', btn); if (s_) s_.textContent = freshT();
}
function onKey(e) {
  if ($('#wn') || $('.wn-coach')) return;  // the What's new screen and its walk have their own keys
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); search(); }
  else if (e.key === 'Escape') { if ($('#layer').innerHTML) closeSheet(); else if (ui.view === 'stock') { ui.view = ui.prev || 'bot'; ui.stock = null; draw(); } else if (CHT.call) chCall(); }
  else if (e.key === 'Enter' && !e.shiftKey && !e.isComposing && e.target.id === 'chq') { e.preventDefault(); chSend(); }
  else if (e.key === 'Enter' && !e.shiftKey && !e.isComposing && e.target.id === 'askq') { e.preventDefault(); askClaude($('[data-act="ask"]')); }
  else if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && !e.isComposing && e.target.closest && e.target.closest('#fbbody')) {  // 2.0: ⌘↩ sends feedback
    const d = e.target.dataset, b = d.fb === 'text' ? $('#fbbody [data-act="fbsend"]') : d.fbm ? $(`#fbbody [data-act="fbmore"][data-id="${d.fbm}"]`) : d.fba ? $(`#fbbody [data-act="fbans"][data-id="${d.fba}"]`) : null;
    if (b) { e.preventDefault(); b.click(); }
  }
  else if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && e.target.matches('.reply textarea')) { sendReply(e.target.dataset.i, e.target.value, e.target); }
  else if (!(e.target.closest && e.target.closest('input,select,textarea')) && !e.metaKey && /^[1-9]$/.test(e.key) && views()[+e.key - 1]) { ui.view = views()[+e.key - 1][0]; draw(); }
}

/* ---------------- start ---------------- */
/* v7.2: moving the window. The Mac does it (window.py's _install_drag): this page only tells it where the top bar's empty
   space is and where every button in it is (with room to spare), so a press on a button always reaches the button and a
   press on the empty space moves the window without the page ever seeing it. Nothing to drag while a sheet is open. */
const NODRAG = 'button, a, input, select, textarea, summary, label, [role=button], [data-act], [data-fact], [data-view], [data-r], [data-t], [data-b], [contenteditable], [tabindex]';
let dzLast = '';
function dragZones() {
  const A = api(); if (!A || !A.drag_zones) return;
  const ov = $('#call') || $('#wn') || $('#tour') || $('#room') || $('#boss'), layer = $('#layer');
  const bars = layer && layer.innerHTML ? [] : [...(ov ? ov.querySelectorAll('.ct-drag') : document.querySelectorAll('#ct .ct-drag'))];
  const zones = [], holes = [], n = v => +v.toFixed(1);
  bars.forEach(b => {
    const r = b.getBoundingClientRect(); if (r.width > 0 && r.height > 0) zones.push([n(r.left), n(r.top), n(r.width), n(r.height)]);
    b.querySelectorAll(NODRAG).forEach(x => { const q = x.getBoundingClientRect(); if (q.width > 0 && q.height > 0) holes.push([n(q.left - 6), n(q.top - 6), n(q.width + 12), n(q.height + 12)]); });
  });
  const j = JSON.stringify([zones, holes]); if (j === dzLast) return;
  dzLast = j; A.drag_zones({ zones, holes });
}
function dragWindow() {
  let t = 0; const soon = () => { clearTimeout(t); t = setTimeout(dragZones, 120); };
  new MutationObserver(soon).observe(document.body, { childList: true, subtree: true });
  window.addEventListener('resize', soon); window.addEventListener('pywebviewready', soon);
  setInterval(dragZones, 4000); soon();
}
function mount(el, state, opt) {
  root = el; S = state; OPT = opt || {}; phone = !!OPT.phone;
  S.notes = S.notes || {};
  try { const v = ALIAS[sessionStorage.getItem('ct2-view')] || sessionStorage.getItem('ct2-view'); if (v && views().some(x => x[0] === v)) ui.view = v; } catch (e) { /* private mode */ }
  if (opt && opt.view) ui.view = ALIAS[opt.view] || opt.view;
  render();
  if (!phone) backWhereItWas();
  if (!phone) wnAuto();  // a new version introduces itself (the phone's own page calls CT.whatsNew.auto)
  setupAuto();  // v6: a copy that isn't set up yet (Sam's dad's, after the update) opens its setup guide
  if (!phone) { if (api()) chatLoad(); else window.addEventListener('pywebviewready', () => chatLoad(), { once: true }); }
  if (!phone) { if (api()) setTimeout(callResume, 800); else window.addEventListener('pywebviewready', () => setTimeout(callResume, 800), { once: true }); }  // 2.2  // 2.0: the conversations (the Today card lists the latest)
  if (!mount.bound) {
    if (!phone) { dragWindow(); keepFresh(); chDropBind(); }
    document.addEventListener('click', onClick);
    document.addEventListener('keydown', onKey);
    window.addEventListener('resize', movePill);
    mount.bound = true;
  }
  try { const t = sessionStorage.getItem('ct2-toast'); if (t) { sessionStorage.removeItem('ct2-toast'); setTimeout(() => toast(t), 300); } } catch (e) { /* private mode */ }
  setTimeout(movePill, 60);
}
// hooks the Mac app calls (signal_lab/window.py)
window.slStatus = text => {
  const b = $('#rescan'), t = String(text || '');
  let p = $('.scanpill');
  if (!p) { p = document.createElement('div'); p.className = 'scanpill'; p.hidden = true; p.innerHTML = '<i></i><span></span>'; document.body.appendChild(p); }
  const say = s => { p.hidden = false; $('span', p).textContent = s; };
  if (t === 'scanning') { say('Checking everything…'); if (b) { b.classList.add('busy'); const s = $('span', b); if (s) s.textContent = 'Checking…'; } }
  else if (t.startsWith('step:')) say(t.slice(5));
  else if (t === 'done') { p.hidden = true; if (b) { b.classList.remove('busy'); const s = $('span', b); if (s) s.textContent = freshT(); } }
  else if (t.startsWith('error')) { say('The scan hit a problem: ' + t.slice(6)); if (b) { b.classList.remove('busy'); const s = $('span', b); if (s) s.textContent = freshT(); } setTimeout(() => { p.hidden = true; }, 8000); }
};
/* The app reloads the page when new numbers are saved (signal_lab/window.py), but not in the middle of something.
   Before, an open room, sheet or focused box held the reload back with no time limit: a room left open kept a whole
   morning's scans off the screen. Now: the boardroom, the guided tour, anything half-typed and a question that's being
   answered always wait. An open room or sheet waits only until nobody has touched the page for 3 minutes; then the page
   reloads and comes back to the same room, stock and scroll position. While it waits, a pill offers the refresh. */
let touched = Date.now();
['pointerdown', 'keydown', 'wheel', 'input'].forEach(ev => window.addEventListener(ev, () => { touched = Date.now(); }, { capture: true, passive: true }));
const halfTyped = () => [...document.querySelectorAll('textarea, input, select')].some(el => {
  if (el.disabled || el.type === 'hidden' || el.type === 'button' || el.type === 'submit') return false;
  if (el.type === 'checkbox' || el.type === 'radio') return el.checked !== el.defaultChecked;
  if (el.tagName === 'SELECT') return [...el.options].some(o => o.defaultSelected) && [...el.options].some(o => o.selected !== o.defaultSelected);
  return el.value !== el.defaultValue;
});
window.CT_canReload = () => {
  if ($('#call') || $('#boss') || $('#tour') || $('#wn') || $('.wn-coach') || RMS.busy || $('.ask-a .live') || CHT.call || CHT.speaking >= 0 || $('#chdropall')) return false;
  const open = $('#room') || ($('#layer') && $('#layer').innerHTML), focus = document.querySelector('.reply, input:focus, textarea:focus, select:focus');
  if (!open && !focus) return true;
  if (halfTyped()) return false;
  return Date.now() - touched > 3 * 60 * 1000;
};
window.CT_reload = (msg, quiet) => {
  try {
    sessionStorage.setItem('ct2-toast', msg || (quiet ? '' : 'Updated: the newest numbers are on screen.'));
    const rp = $('#room .rm-panel'), rs = $('#room .rm-screen');
    sessionStorage.setItem('ct2-back', JSON.stringify({ room: $('#room') ? RMS.id : null, stock: ui.view === 'stock' ? ui.stock : null, prev: ui.prev || null,
      y: window.scrollY, ry: Math.max(rp ? rp.scrollTop : 0, rs ? rs.scrollTop : 0) }));
  } catch (e) { /* private mode */ }
  location.reload();
};
window.CT_waiting = () => {
  if ($('.newnum') || $('#boss')) return;
  const el = document.createElement('div'); el.className = 'newnum'; el.setAttribute('role', 'status');
  el.innerHTML = '<span>New numbers are ready</span><button type="button">Refresh</button>';
  $('button', el).onclick = () => window.CT_reload();
  document.body.appendChild(el);
};
// live prices and the Schwab sync's time, pushed by the app's keeper (signal_lab/fresh.py) every 5 minutes in market hours
window.CT_live = d => {
  const moved = applyLive(d), fl = $('#freshline');
  const quiet = !$('#boss') && !$('#room') && !$('#tour') && !$('#wn') && !$('.wn-coach') && !($('#layer') && $('#layer').innerHTML) && !document.querySelector('.reply, input:focus, textarea:focus, select:focus') && !$('.ask-a .live');
  if (moved && quiet && ['bot', 'positions', 'stock'].includes(ui.view) && Date.now() - touched > 4000) draw(true, true);
  else { if (fl) fl.outerHTML = freshLine(); awNoteSync(); }
};
function backWhereItWas() {  // after a reload on new numbers: the same stock page, room and scroll position
  let b = null; try { b = JSON.parse(sessionStorage.getItem('ct2-back') || 'null'); sessionStorage.removeItem('ct2-back'); } catch (e) { /* private mode */ }
  if (!b) return;
  if (b.stock && ((S.positions || []).some(x => x.ticker === b.stock) || (S.radar || []).some(x => x.ticker === b.stock) || S.notes[b.stock])) { ui.prev = b.prev || ui.view; ui.stock = b.stock; ui.view = 'stock'; draw(); }
  if (b.y) setTimeout(() => window.scrollTo(0, b.y), 60);
  if (b.room && RM[b.room]) setTimeout(() => { roomOpen(S, { phone }, b.room, null); if (b.ry) setTimeout(() => { const rp = $('#room .rm-panel'), rs = $('#room .rm-screen'); [rp, rs].forEach(x => { if (x) x.scrollTop = b.ry; }); }, 900); }, 120);
}
function keepFresh() {  // the Mac app only: pick up the live prices it already has, and nudge its Schwab check when the owner comes back
  let asked = 0;
  const ask = () => { const A = api(); if (!A || !A.live) return; A.live().then(d => window.CT_live(d)).catch(() => {}); };
  const back = () => { const A = api(); if (!A || !A.nudge || document.hidden || Date.now() - asked < 60000) return; asked = Date.now(); A.nudge(); };
  if (api()) ask(); else window.addEventListener('pywebviewready', ask, { once: true });
  window.addEventListener('focus', back); document.addEventListener('visibilitychange', back);
}
window.updateReady = (info, auto, quiet) => {  // a new version is unpacked and waiting (signal_lab/update.py)
  if (S && S.settings && S.settings.update && !S.settings.update.source) { S.settings.update.ready = info; }
  $$('.card.update').forEach(c => c.remove());
  if (quiet || $('#upd-over')) return;  // Settings is open on it, or it's going in right now
  const el = document.createElement('div'); el.className = 'card update'; el.setAttribute('role', 'status');
  el.innerHTML = `<span>A new version is ready${info && (info.label || info.id) ? ' (' + esc(info.label ? 'v' + info.label : info.id) + ')' : ''}.${auto ? ' It installs by itself when you’re away.' : ''}</span><button class="btn go">Restart to update</button><button class="btn quiet">Later</button>`;
  $$('button', el)[0].onclick = updGo;
  $$('button', el)[1].onclick = () => el.remove();
  document.body.appendChild(el);
};
function updAsk() {  // the card is part of the page, so a page that reloads on new numbers asks again
  const go = () => { const A = api(); if (!A || !A.update_status || !S || !S.settings || (S.settings.update || {}).source) return; A.update_status().then(st => { if (st && st.ready && !st.source) window.updateReady(st.ready, st.auto); }).catch(() => {}); };
  if (api()) setTimeout(go, 1500); else window.addEventListener('pywebviewready', () => setTimeout(go, 1500), { once: true });
}
window.onerror = (msg, src, line) => { try { const A = api(); if (A) A.log_js(`${msg} @${line}`); } catch (e) { /* nothing to do */ } };
window.CT = { mount, openStock, toast, freshLine, place: PLACE, signin: signinWarn, whatsNew: { auto: wnAuto, open: wnOpen, hide: wnHide, tour: () => wnTour(wnRel()) }, go: v => { closeSheet(); ui.view = ALIAS[v] || v; draw(); },
  brain: { view: brainView, mount: brainMount }, firm: { view: firmView, mount: firmMount, gist: (st, compact) => { fzStyle(); hqStyle(); return hqGist((st || {}).firm, compact); }, team: fzTeam } };
if (window.CT_STATE && document.getElementById('ct')) { mount(document.getElementById('ct'), window.CT_STATE, { phone: false }); updAsk(); }
})();
