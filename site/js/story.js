/* Scroll-driven intro "story": a fixed particle canvas (sphere -> real Armenia -> project dots -> overlap lines -> planned diamonds)
   behind full-screen sections that alternate dark/light. Uses window.ICP from app.js. Canvas 2D only (no WebGL, no libraries). */
(function () {
'use strict';
const X = window.ICP; if (!X) return;
const { state, D, P, OV, esc, DOM_COLOR } = X;
const $ = (s, el) => (el || document).querySelector(s);
const $$ = (s, el) => Array.from((el || document).querySelectorAll(s));
const reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;

// ------------------------------------------------------------------ copy
const S = {
  hy: {
    eyebrow: '[ ՀԱՅԱՍՏԱՆ · ՇՐՋԱԿԱ ՄԻՋԱՎԱՅՐ, ՀՈՂ, ՋՈՒՐ, ԿԼԻՄԱ ]',
    h1a: 'Մեկ քարտեզ', h1b: 'Բոլոր ծրագրերը',
    sub: 'Երևում է՝ ով, ինչ, որտեղ և մինչև երբ է իրականացնում։ Եվ որտեղ երկու ծրագիր հանդիպում են նույն համայնքում՝ նախքան երրորդը սկսելը։',
    st: ['ծրագիր', 'դոնոր', 'համայնք', 'պլանավորվող'], open: 'Բացել քարտեզը', tour: 'Շրջայց՝ 1 րոպե', scroll: 'ոլորեք', demo: 'Դեմո տարբերակ՝ իրական, բայց ոչ ամբողջական տվյալներով',
    pEy: '[ ՀԱՐՑԸ ]', pH: ['Նույն համայնք', 'Նույն աշխատանքը'], pP: 'Երբ երկու դոնոր նույն համայնքում նույն տիպի աշխատանք է իրականացնում, պետությունը դա հաճախ իմանում է արդեն կատարվելուց հետո։ Այսօր մեկ ճշմարիտ ցանկ չկա. նույն ծրագիրը հայտնվում է մինչև 4 տարբեր ID-ով, իսկ վայրը գրեթե երբեք համայնքի մակարդակով հրապարակված չէ։', pL: 'հնարավոր համընկնում այս դեմոյում',
    mEy: '[ ՄԵԹՈԴ ]', mH: ['5 քայլ', ''], mP: 'Բաց տվյալներից և ծրագրերի իրենց փաստաթղթերից՝ մեկ ստուգվող ցանկ, որը ցույց է տալիս համընկնումները նախքան ծրագրի մեկնարկը։ Ոչինչ չի հորինվում. յուրաքանչյուր գրառում ունի աղբյուր։', mSteps: ['Հավաքել', 'Տեղադրել', 'Համեմատել', 'Համակարգել', 'Պլանավորել'],
    steps: [
      { h: 'Հավաքել', p: 'Մեկ ցանկ՝ բոլոր աղբյուրներից', b: ['IATI, Համաշխարհային բանկ, դոնորների էջեր', 'յուրաքանչյուր գրառում՝ աղբյուրի հղումով', 'նույն ծրագիրը՝ մեկ գրառում, ոչ թե չորս'] },
      { h: 'Տեղադրել', p: 'Մարզ · շրջան · համայնք', b: ['վայրը՝ ծրագրի իրական փաստաթղթից', 'չստուգված վայրը քարտեզի վրա չի դրվում', 'համայնքի մակարդակը՝ որտեղ բնակավայրերը հայտնի են'] },
      { h: 'Համեմատել', p: 'Նույն թեմա. նույն տարածք. նույն ժամանակ', b: ['ընդհանուր թեմա և առնվազն 6 ամիս համընկնում', 'համայնք > շրջան > մարզ', 'ազդանշան, ոչ թե եզրակացություն'] },
      { h: 'Համակարգել', p: 'Երկու ծրագիր. մեկ սեղան', b: ['համընկնող զույգերի ցանկ՝ ըստ գնահատականի', 'ժամանակագրություն ամեն տարածքի համար', 'կարիք ընդդեմ ծածկույթի'] },
      { h: 'Պլանավորել', p: 'Նախքան հաստատելը՝ ստուգել', b: ['պլանավորվող ծրագրի քարտ՝ ինչ է նախատեսվում', '«ինչ արդեն կա այս վայրում»', 'ստուգում նոր ծրագրի մեկնարկից առաջ'] }
    ],
    exEy: '[ ՕՐԻՆԱԿ ԻՐԱԿԱՆ ՏՎՅԱԼՆԵՐԻՑ ]', exMo: 'ամիս համընկնում', exIn: 'այստեղ', stm: 'ՆՈՒՅՆ ԱՇԽԱՏԱՆՔԸ ԵՐԿՈՒ ԱՆԳԱՄ ՉՎՃԱՐՎԻ', donors: 'ՄԱՍՆԱԿԻՑ ԴՈՆՈՐՆԵՐ',
    ctaH: ['Բացել', 'քարտեզը'], ctaP: 'Ծրագրեր, վայրեր, համընկնումներ, պլանավորվողներ և 60 քարտեզագրված տվյալ՝ մեկ տեղում։', method: 'Մեթոդ և սահմանափակումներ',
    foot: 'Աղբյուրներ՝ IATI · Համաշխարհային բանկ · դոնորների փաստաթղթեր · OCHA · ESA WorldCover · Hansen', ov: 'Համընկնումները', open2: 'Բացել քարտեզը'
  },
  en: {
    eyebrow: '[ ARMENIA · ENVIRONMENT, LAND, WATER, CLIMATE ]',
    h1a: 'One map.', h1b: 'Every programme.',
    sub: 'See who works where, on what and until when — and where two programmes meet in the same community, before a third one starts.',
    st: ['programmes', 'donors', 'communities', 'planned'], open: 'Open the map', tour: 'Take the 1-min tour', scroll: 'scroll', demo: 'Demo version: real but incomplete data',
    pEy: '[ THE PROBLEM ]', pH: ['Same community.', 'Same work.'], pP: 'When two donors run the same kind of work in the same community, the state often learns about it after the fact. Today there is no single source of truth: one programme shows up under up to 4 IDs, and its place is almost never published at community level.', pL: 'possible overlaps in this demo',
    mEy: '[ THE METHOD ]', mH: ['The 5 steps', ''], mP: 'From open data and the programmes’ own documents: one verifiable list that shows overlaps before a programme starts. Nothing is invented — every record carries its source.', mSteps: ['Collect', 'Locate', 'Compare', 'Coordinate', 'Plan ahead'],
    steps: [
      { h: 'Collect', p: 'One list, from every source', b: ['IATI, World Bank, donor pages', 'every record links to its source', 'one programme = one record, not four'] },
      { h: 'Locate', p: 'Marz · district · community', b: ['places taken from the programmes’ own documents', 'an unverified place is never put on the map', 'community level wherever settlements are known'] },
      { h: 'Compare', p: 'Same theme. Same area. Same time.', b: ['shared theme and at least 6 months overlap', 'community > district > marz', 'a prompt, not a verdict'] },
      { h: 'Coordinate', p: 'Two programmes. One table.', b: ['overlapping pairs ranked by score', 'a timeline for every area', 'need versus coverage'] },
      { h: 'Plan ahead', p: 'Check before you approve', b: ['a planned programme’s card: what is foreseen', '“what already exists here”', 'a check before a new programme starts'] }
    ],
    exEy: '[ A REAL EXAMPLE FROM THE DATA ]', exMo: 'months overlapping', exIn: 'in', stm: 'THE SAME WORK SHOULD NOT BE PAID FOR TWICE', donors: 'DONORS IN THE DATA',
    ctaH: ['Open', 'the map'], ctaP: 'Programmes, places, overlaps, planned programmes and 60 mapped datasets — in one place.', method: 'Method & limits',
    foot: 'Sources: IATI · World Bank · donor documents · OCHA · ESA WorldCover · Hansen', ov: 'See the overlaps', open2: 'Open the map'
  }
};
const tr = () => S[state.lang] || S.en;

// ------------------------------------------------------------------ data helpers
const nonNat = P.filter(p => !p.is_national);
function donorList() { const c = {}; P.forEach(p => p.donors.forEach(d => { if (d !== 'Co-financiers' && d !== 'Local co-funding') c[d] = (c[d] || 0) + 1; })); return Object.entries(c).sort((a, b) => b[1] - a[1]).map(x => x[0]); }
const nDonors = () => donorList().length;
const nComm = () => { const s = new Set(); P.forEach(p => (p.communities_specific || []).forEach(c => s.add(c))); return s.size; };
const nPlanned = () => P.filter(p => p.eff === 'pipeline').length;
function bestPair() {
  const act = o => { const f = +o.from.slice(0, 4), t = +o.to.slice(0, 4); return f <= 2026 && t >= 2026; };
  return OV.filter(o => o.level === 'high' && act(o) && o.communities && o.communities.length).sort((a, b) => b.score - a.score)[0] || OV.filter(o => o.level === 'high')[0] || OV[0];
}

// ------------------------------------------------------------------ particles
const NP = 2300, KX = Math.cos(40.1 * Math.PI / 180);
const nx = lon => (lon - 45.04) * KX / 1.23, ny = lat => -(lat - 40.07) / 1.23;
let seed = 7; const rnd = () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
const gauss = () => (rnd() + rnd() + rnd() + rnd() - 2) / 2;
let T = null, dots = [], pairs = [], rings = [];
function pip(x, y, rings) { let ins = false; for (const r of rings) { for (let i = 0, j = r.length - 1; i < r.length; j = i++) { const xi = r[i][0], yi = r[i][1], xj = r[j][0], yj = r[j][1]; if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) ins = !ins; } } return ins; }
function buildTargets() {
  if (T) return; seed = 7;
  const mk = () => new Float32Array(NP * 3);
  T = { sphere: mk(), cloud: mk(), streak: mk(), ring: mk(), wave: mk(), armenia: mk() };
  for (let i = 0; i < NP; i++) {
    const y = 1 - 2 * (i + .5) / NP, r = Math.sqrt(1 - y * y), th = i * 2.39996, R = .86 + gauss() * .01;
    T.sphere.set([Math.cos(th) * r * R, y * R, Math.sin(th) * r * R], i * 3);
    T.cloud.set([gauss() * 1.7, gauss() * 1.1, gauss() * 0.9], i * 3);
    const u = (rnd() * 2 - 1) * 1.7; T.streak.set([u, -0.42 * u - 0.1 + gauss() * (0.1 + 0.16 * rnd()), gauss() * 0.45], i * 3);
    const a = rnd() * Math.PI * 2, rr = 1.0 + gauss() * 0.07 + (i % 3) * 0.07; T.ring.set([Math.cos(a) * rr * 1.1, Math.sin(a) * rr * .5, Math.sin(a * 2) * .25 + gauss() * .05], i * 3);
    const wx = (rnd() * 2 - 1) * 1.7, wz = (rnd() * 2 - 1) * 1.0; T.wave.set([wx, .28 * Math.sin(wx * 2.4 + wz * 1.7) + wz * .32, wz * .5], i * 3);
  }
  // real Armenia: rejection-sample inside the 11 marz polygons
  const polys = [];
  D.marzes.features.forEach(f => { const g = f.geometry, ps = g.type === 'Polygon' ? [g.coordinates] : g.coordinates; ps.forEach(rings => { let b = [999, 999, -999, -999]; rings[0].forEach(c => { b[0] = Math.min(b[0], c[0]); b[1] = Math.min(b[1], c[1]); b[2] = Math.max(b[2], c[0]); b[3] = Math.max(b[3], c[1]); }); polys.push({ b, rings }); }); });
  let n = 0, guard = 0;
  while (n < NP && guard++ < 200000) {
    const lon = 43.44 + rnd() * 3.2, lat = 38.84 + rnd() * 2.46; let hit = false;
    for (const p of polys) { if (lon < p.b[0] || lon > p.b[2] || lat < p.b[1] || lat > p.b[3]) continue; if (pip(lon, lat, p.rings)) { hit = true; break; } }
    if (hit) { T.armenia.set([nx(lon), ny(lat), gauss() * .05], n * 3); n++; }
  }
  // project dots (non-national): community centroid when known, else marz centroid + golden-angle jitter
  const byName = {}; Object.values(X.MARZ).forEach(m => byName[m.name_en] = m);
  const seen = {};
  dots = nonNat.map((p, k) => {
    let lon, lat;
    const c = (p.communities_specific || [])[0] && X.COM[p.communities_specific[0]];
    if (c) { lon = c.cx; lat = c.cy; }
    else { const m = byName[Array.from(p.marzSet)[0]] || Object.values(X.MARZ)[0]; const i = seen[m.id] = (seen[m.id] || 0) + 1, a = i * 2.39996, r = .045 * Math.sqrt(i); lon = m.cx + Math.cos(a) * r * 1.2; lat = m.cy + Math.sin(a) * r; }
    const d = { slug: p.slug, col: DOM_COLOR[p.domain], planned: p.eff === 'pipeline', p: new Float32Array(3), t: new Float32Array(3), ax: nx(lon), ay: ny(lat), seedIdx: Math.floor(rnd() * NP) };
    d.p.set([gauss() * 1.7, gauss() * 1.1, 0]);
    return d;
  });
  const dm = {}; dots.forEach(d => dm[d.slug] = d);
  pairs = OV.filter(o => o.level === 'high' && dm[o.a] && dm[o.b]).slice(0, 24).map(o => [dm[o.a], dm[o.b]]);
  rings = [];
  OV.filter(o => o.level === 'high').forEach(o => {
    let lon, lat; const c = o.communities && o.communities[0] && X.COM[o.communities[0]];
    if (c) { lon = c.cx; lat = c.cy; } else { const dd = X.DIST[o.districts[0]]; if (!dd) return; lon = dd.cx; lat = dd.cy; }
    const x = nx(lon), y = ny(lat); if (rings.some(r => Math.hypot(r[0] - x, r[1] - y) < .07)) return; rings.push([x, y, rnd() * 6.28]);
  });
  rings = rings.slice(0, 14);
}

let cv, ctx, W = 0, H = 0, dpr = 1, raf = 0, last = 0, running = false;
const pos = new Float32Array(NP * 3);
let cur = 'sphere', want = 'sphere', tone = 1 /* 1 dark, 0 light */, toneT = 1, wPairs = 0, wPlan = 0, spin = 0, mx = 0, my = 0;
const view = { cx: .5, cy: .4, s: .4 }, vt = { cx: .5, cy: .4, s: .4 };
const VIEWS = {   // desktop view per state (cx, cy as fractions of the viewport, s as fraction of min(W,H))
  sphere: { cx: .5, cy: .37, s: .36 }, armenia: { cx: .5, cy: .36, s: .38 }, pairs: { cx: .7, cy: .5, s: .40 }, plan: { cx: .3, cy: .5, s: .40 },
  streak: { cx: .5, cy: .5, s: .62 }, cloud: { cx: .5, cy: .5, s: .55 }, ring: { cx: .72, cy: .5, s: .46 }, wave: { cx: .5, cy: .5, s: .58 }
};
const setCanvas = () => { if (!cv) return; dpr = Math.min(window.devicePixelRatio || 1, 2); W = innerWidth; H = innerHeight; cv.width = W * dpr; cv.height = H * dpr; cv.style.width = W + 'px'; cv.style.height = H + 'px'; ctx.setTransform(dpr, 0, 0, dpr, 0, 0); };
function applyState(name, v) {
  want = name; const tg = name === 'pairs' || name === 'plan' ? 'armenia' : name;
  const src = T[tg] || T.cloud;
  const mobile = W <= 900;
  const vv = Object.assign({}, VIEWS[name] || VIEWS.armenia, v || {});
  if (mobile) { vt.cx = .5; vt.cy = .26; vt.s = Math.min(vv.s, .25) * (name === 'streak' || name === 'wave' || name === 'cloud' ? 1.5 : 1); } else { vt.cx = vv.cx; vt.cy = vv.cy; vt.s = vv.s; }
  dots.forEach(d => {
    if (name === 'sphere') { const a = rnd() * 6.283, b = Math.acos(2 * rnd() - 1); d.t.set([Math.sin(b) * Math.cos(a) * .88, Math.cos(b) * .88, Math.sin(b) * Math.sin(a) * .88]); }
    else if (tg === 'armenia') d.t.set([d.ax, d.ay, 0]);
    else { const i = d.seedIdx * 3; d.t.set([T[tg][i], T[tg][i + 1], T[tg][i + 2]]); }
  });
}
function frame(now) {
  if (!running) return; raf = requestAnimationFrame(frame);
  const dt = Math.min(.05, (now - last) / 1000 || .016); last = now;
  const tgt = want === 'pairs' || want === 'plan' ? T.armenia : (T[want] || T.cloud);
  const k = 1 - Math.exp(-dt * 3.2);
  for (let i = 0; i < NP * 3; i++) pos[i] += (tgt[i] - pos[i]) * k;
  const tt = now / 1000;
  dots.forEach(d => { for (let c = 0; c < 3; c++) d.p[c] += (d.t[c] - d.p[c]) * k * 1.15; });
  toneT += (tone - toneT) * (1 - Math.exp(-dt * 4)); wPairs += ((want === 'pairs' ? 1 : 0) - wPairs) * (1 - Math.exp(-dt * 3)); wPlan += ((want === 'plan' ? 1 : 0) - wPlan) * (1 - Math.exp(-dt * 3));
  for (const q of ['cx', 'cy', 's']) view[q] += (vt[q] - view[q]) * (1 - Math.exp(-dt * 3));
  spin += ((want === 'sphere' ? dt * .35 : 0)); const yawTarget = want === 'sphere' ? spin : mx * .16, pitch = my * .08;
  const yaw = want === 'sphere' ? spin : yawTarget;
  const cyw = Math.cos(yaw), syw = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch);
  ctx.clearRect(0, 0, W, H);
  const S0 = Math.min(W, H) * view.s, ox = view.cx * W, oy = view.cy * H;
  const lr = Math.round(240 * toneT + 30 * (1 - toneT)), lg = Math.round(240 * toneT + 30 * (1 - toneT)), lb = Math.round(246 * toneT + 30 * (1 - toneT));
  const proj = (x, y, z) => { const X1 = x * cyw + z * syw, Z1 = -x * syw + z * cyw, Y1 = y * cp - Z1 * sp, Z2 = y * sp + Z1 * cp, pr = 1 / (1 + Z2 * .32); return [ox + X1 * S0 * pr, oy + Y1 * S0 * pr, pr, Z2]; };
  // particles in 3 depth buckets
  for (let pass = 0; pass < 3; pass++) {
    const alpha = [.95, .62, .34][pass], size = [2.0, 1.6, 1.2][pass] * (W < 700 ? .85 : 1);
    ctx.fillStyle = 'rgba(' + lr + ',' + lg + ',' + lb + ',' + alpha + ')';
    for (let i = 0; i < NP; i++) {
      const x = pos[i * 3] + Math.sin(tt * .6 + i) * .0016, y = pos[i * 3 + 1] + Math.cos(tt * .5 + i * 1.3) * .0016, z = pos[i * 3 + 2];
      const q = proj(x, y, z), b = q[3] < -.2 ? 0 : q[3] < .25 ? 1 : 2; if (b !== pass) continue;
      const s = size * q[2]; ctx.fillRect(q[0] - s / 2, q[1] - s / 2, s, s);
    }
  }
  // pair lines
  if (wPairs > .03) {
    ctx.lineWidth = 1; ctx.strokeStyle = 'rgba(230,0,126,' + (.5 * wPairs) + ')';
    pairs.forEach(pr => { const a = proj(pr[0].p[0], pr[0].p[1], pr[0].p[2]), b = proj(pr[1].p[0], pr[1].p[1], pr[1].p[2]); if (Math.hypot(a[0] - b[0], a[1] - b[1]) > S0 * .55) return; ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke(); });
    rings.forEach(r => {
      const q = proj(r[0], r[1], 0), ph = (tt * .9 + r[2]) % 1, rad = 7 + 20 * ph;
      ctx.strokeStyle = 'rgba(230,0,126,' + (.85 * wPairs * (1 - ph)) + ')'; ctx.lineWidth = 1.8; ctx.beginPath(); ctx.arc(q[0], q[1], rad, 0, 6.283); ctx.stroke();
      ctx.fillStyle = 'rgba(230,0,126,' + (.95 * wPairs) + ')'; ctx.beginPath(); ctx.arc(q[0], q[1], 3.4, 0, 6.283); ctx.fill();
    });
  }
  // project dots (circles; planned = diamonds)
  const ring = toneT > .5 ? '#171717' : '#f3f3f1';
  dots.forEach(d => {
    const q = proj(d.p[0], d.p[1], d.p[2]); const planMode = wPlan > .05;
    const dim = planMode && !d.planned ? 1 - .78 * wPlan : 1; ctx.globalAlpha = Math.max(.05, dim);
    const R = (d.planned ? 5.6 : 4.2) * q[2] * (W < 700 ? .85 : 1) * (planMode && d.planned ? 1 + .22 * Math.sin(tt * 3 + d.ax * 9) : 1);
    ctx.fillStyle = ring; ctx.strokeStyle = d.col;
    if (d.planned) { ctx.beginPath(); ctx.moveTo(q[0], q[1] - R - 1.4); ctx.lineTo(q[0] + R + 1.4, q[1]); ctx.lineTo(q[0], q[1] + R + 1.4); ctx.lineTo(q[0] - R - 1.4, q[1]); ctx.closePath(); ctx.fillStyle = '#fff'; ctx.fill(); ctx.lineWidth = 2.2; ctx.stroke(); }
    else { ctx.beginPath(); ctx.arc(q[0], q[1], R + 1.5, 0, 6.283); ctx.fill(); ctx.fillStyle = d.col; ctx.beginPath(); ctx.arc(q[0], q[1], R, 0, 6.283); ctx.fill(); }
  });
  ctx.globalAlpha = 1;
}
function startLoop() { if (running) return; running = true; last = performance.now(); if (reduce) { frame(last); frame(last + 16); running = false; return; } raf = requestAnimationFrame(frame); }
function stopLoop() { running = false; cancelAnimationFrame(raf); }

// ------------------------------------------------------------------ DOM
let SECS = [], curI = -1, io = null, firstShow = true;
const SDEF = [
  { id: 'hero', tone: 1, st: 'armenia', dot: -1, v: { cx: .5, cy: .35, s: .255 } },
  { id: 'problem', tone: 0, st: 'pairs', dot: -1, v: { cx: .27, cy: .5, s: .40 } },
  { id: 'method', tone: 1, st: 'streak', dot: -1, v: { cx: .5, cy: .5, s: .62 } },
  { id: 's0', tone: 0, st: 'cloud', dot: 0, v: { cx: .3, cy: .5, s: .50 } },
  { id: 's1', tone: 1, st: 'armenia', dot: 1, v: { cx: .72, cy: .5, s: .40 } },
  { id: 's2', tone: 0, st: 'pairs', dot: 2, v: { cx: .27, cy: .5, s: .40 } },
  { id: 's3', tone: 1, st: 'ring', dot: 3, v: { cx: .72, cy: .5, s: .44 } },
  { id: 's4', tone: 0, st: 'plan', dot: 4, v: { cx: .27, cy: .5, s: .40 } },
  { id: 'band', tone: 1, st: 'wave', dot: -1, v: { cx: .5, cy: .5, s: .58 } },
  { id: 'cta', tone: 1, st: 'sphere', dot: -1, v: { cx: .5, cy: .245, s: .21 } }
];
let hold = false;
function exampleCard() {
  const o = bestPair(); if (!o) return ''; const a = X.BY[o.a], b = X.BY[o.b]; if (!a || !b) return '';
  const y0 = Math.floor(Math.min(a.ys, b.ys)) - 1, y1 = Math.ceil(Math.max(a.ye, b.ye)) + 1, sp = y1 - y0, pc = y => ((Math.max(y0, Math.min(y1, y)) - y0) / sp * 100).toFixed(1);
  const ofr = (+o.from.slice(0, 4)) + (+o.from.slice(5, 7) - 1) / 12, oto = (+o.to.slice(0, 4)) + (+o.to.slice(5, 7)) / 12;
  const name = p => esc(X.L(p.title)).slice(0, 78);
  const where = o.communities && o.communities.length ? o.communities.slice(0, 2).map(c => (X.COM[c] || {}).name || c).join(', ') : o.districts.slice(0, 2).map(d => X.nm(X.DIST[d] || { name_en: d })).join(', ');
  const row = p => '<div class="exr"><div class="exl">' + name(p) + '</div><div class="ext"><i style="left:' + pc(p.ys) + '%;width:' + (pc(p.ye) - pc(p.ys)).toFixed(1) + '%;background:' + DOM_COLOR[p.domain] + '"></i><b style="left:' + pc(ofr) + '%;width:' + (pc(oto) - pc(ofr)).toFixed(1) + '%"></b></div></div>';
  return '<div class="exm rv"><div class="exe">' + tr().exEy + '</div>' + row(a) + row(b) + '<div class="exf"><span class="exn">' + o.months + '</span> ' + tr().exMo + ' · ' + esc(where) + '</div></div>';
}
function build() {
  const t = tr(), n = P.length, d = nDonors(), c = nComm(), pl = nPlanned(), nOv = OV.filter(o => o.level !== 'low').length;
  const hy = state.lang === 'hy', ml = hy ? '' : ' mono';
  const donors = donorList().slice(0, 22).join(' · ').toUpperCase();
  const stm = (t.stm + ' — ').repeat(6);
  const step = (i) => { const s = t.steps[i]; return '<section class="sx step ' + (i % 2 ? 'al-l' : 'al-r') + '" data-i="' + (3 + i) + '"><div class="num" aria-hidden="true">0' + (i + 1) + '</div><div class="box"><div class="eb rv">[ 0' + (i + 1) + ' / 05 ]</div><h2 class="rv' + ml + '">' + esc(s.h) + '<i>.</i></h2><p class="lead rv">' + esc(s.p) + '</p><ul class="rv">' + s.b.map(x => '<li>' + esc(x) + '</li>').join('') + '</ul>' + (i === 2 ? exampleCard() : '') + '</div></section>'; };
  return '<canvas id="scv" aria-hidden="true"></canvas><div class="sprog" id="sprog" aria-hidden="true">000%</div><div class="shint" id="shint">↓ ' + t.scroll + '</div>' +
    '<div class="sections" id="ssec">' +
    '<section class="sx hero" data-i="0"><div class="box"><div class="eb rv">' + esc(t.eyebrow) + '</div><h1 class="rv' + ml + '">' + esc(t.h1a) + '<br>' + esc(t.h1b) + '<i>.</i></h1><p class="lead rv">' + esc(t.sub) + '</p>' +
    '<div class="spill rv"><span><b data-count="' + n + '">0</b> ' + esc(t.st[0]) + '</span><span><b data-count="' + d + '">0</b> ' + esc(t.st[1]) + '</span><span><b data-count="' + c + '">0</b> ' + esc(t.st[2]) + '</span><span><b data-count="' + pl + '">0</b> ' + esc(t.st[3]) + '</span></div>' +
    '<div class="cta rv"><button class="sbtn pink" data-hero="map">' + esc(t.open) + ' →</button><button class="sbtn" data-hero="tour">▶ ' + esc(t.tour) + '</button></div><div class="demo rv">' + esc(t.demo) + '</div></div></section>' +
    '<section class="sx prob al-r" data-i="1"><div class="num" aria-hidden="true">' + nOv + '</div><div class="box"><div class="eb rv">' + esc(t.pEy) + '</div><h2 class="rv' + ml + '">' + esc(t.pH[0]) + '<br>' + esc(t.pH[1]) + '<i>.</i></h2><p class="lead rv">' + esc(t.pP) + '</p><div class="bignum rv"><b data-count="' + nOv + '">0</b><span>' + esc(t.pL) + '</span></div></div></section>' +
    '<section class="sx meth ctr" data-i="2"><div class="box"><div class="eb rv">' + esc(t.mEy) + '</div><h2 class="rv' + ml + '">' + esc(t.mH[0]) + '<i>.</i></h2><p class="lead rv">' + esc(t.mP) + '</p><div class="steps5 rv">' + t.mSteps.map((x, i) => '<span class="' + (i === 4 ? 'pk' : '') + '">' + esc(x.toUpperCase()) + '</span>').join(' · ') + '</div></div></section>' +
    [0, 1, 2, 3, 4].map(step).join('') +
    '<section class="sx bandsec" data-i="8"><div class="mq big"><div class="mt">' + esc(stm) + esc(stm) + '</div></div><div class="eb ctr2 rv">' + esc(t.donors) + '</div><div class="mq sm"><div class="mt rev">' + esc(donors + ' · ') .repeat(1) + esc(donors + ' · ') + '</div></div></section>' +
    '<section class="sx cta-s ctr" data-i="9"><div class="box"><h2 class="rv' + ml + '">' + esc(t.ctaH[0]) + '<br>' + esc(t.ctaH[1]) + '<i>.</i></h2><p class="lead rv">' + esc(t.ctaP) + '</p><div class="cta rv"><button class="sbtn pink big" data-hero="map">' + esc(t.open2) + ' →</button><button class="sbtn" data-hero="coord">' + esc(t.ov) + '</button><button class="sbtn" data-hero="tour">▶ ' + esc(t.tour) + '</button></div><div class="foot rv"><button class="lnk" data-hero="about">' + esc(t.method) + '</button><br>' + esc(t.foot) + '</div></div></section>' +
    '</div>';
}
function countUp(root) {
  $$('[data-count]', root).forEach(el => { if (el.dataset.done) return; el.dataset.done = 1; const target = +el.dataset.count, t0 = performance.now(); const tick = now => { const k = Math.min(1, (now - t0) / 1200), e = 1 - Math.pow(1 - k, 3); el.textContent = Math.round(target * e); if (k < 1) requestAnimationFrame(tick); }; requestAnimationFrame(tick); });
}
function render() {
  const el = $('#story'); if (!el) return; buildTargets();
  const keepScroll = el.scrollTop;
  el.innerHTML = build(); cv = $('#scv'); ctx = cv.getContext('2d'); setCanvas();
  SECS = $$('.sx', el);
  if (io) io.disconnect();
  io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in'); if (e.target.querySelector && e.target.querySelector('[data-count]')) countUp(e.target); } }), { root: el, threshold: .18 });
  SECS.forEach(s => io.observe(s));
  $$('.rv', el).forEach((r, i) => { r.style.setProperty('--d', (i % 6) * 70 + 'ms'); });
  applyState(want || 'armenia');
  el.scrollTop = keepScroll; curI = -1; onScroll();
}
function onScroll() {
  const el = $('#story'); if (!el || el.hidden) return;
  const max = el.scrollHeight - el.clientHeight, pct = max > 0 ? el.scrollTop / max : 0;
  const pr = $('#sprog'); if (pr) pr.textContent = String(Math.round(pct * 100)).padStart(3, '0') + '%';
  const sh = $('#shint'); if (sh) sh.style.opacity = el.scrollTop > 60 ? 0 : 1;
  const mid = el.scrollTop + el.clientHeight * .5; let best = 0, bd = 1e9;
  SECS.forEach((s, i) => { const c = s.offsetTop + s.offsetHeight / 2, d = Math.abs(c - mid); if (d < bd) { bd = d; best = i; } });
  if (best === curI) return; curI = best; const def = SDEF[best] || SDEF[0];
  tone = def.tone; el.classList.toggle('tone-dark', !!def.tone); el.classList.toggle('tone-light', !def.tone);
  if (hold && best === 0) { applyState('sphere', { cx: .5, cy: .35, s: .255 }); return; }
  applyState(def.st, def.v);
  $$('#dots5 i').forEach((d, i) => d.classList.toggle('on', i === def.dot));
}
function show() {
  const el = $('#story'); if (!el) return; render(); el.hidden = false; el.classList.remove('out'); el.scrollTop = 0;
  document.body.classList.add('story-on'); curI = -1; tone = 1; toneT = 1; $('#dots5') && $$('#dots5 i').forEach(d => d.classList.remove('on'));
  startLoop();
  if (firstShow && !reduce) { firstShow = false; hold = true; setTimeout(() => { hold = false; if (!el.hidden) { curI = -1; onScroll(); } }, 1700); } else { firstShow = false; }
  curI = -1; onScroll();
}
function hide() {
  const el = $('#story'); if (!el || el.hidden) return; el.classList.add('out');
  setTimeout(() => { el.hidden = true; stopLoop(); document.body.classList.remove('story-on'); $$('#dots5 i').forEach(d => d.classList.remove('on')); }, 380);
}
function init() {
  const el = $('#story'); if (!el) return;
  el.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', () => { if (!el.hidden) { setCanvas(); curI = -1; onScroll(); } });
  window.addEventListener('mousemove', e => { mx = e.clientX / innerWidth * 2 - 1; my = e.clientY / innerHeight * 2 - 1; }, { passive: true });
}
init();
window.STORY = { show, hide, render, isVisible: () => { const e = $('#story'); return !!e && !e.hidden; } };
})();
