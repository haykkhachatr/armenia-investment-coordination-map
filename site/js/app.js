(function () {
'use strict';
const D = window.DATA, I18N = window.I18N;
const $ = (s, el) => (el || document).querySelector(s);
const $$ = (s, el) => Array.from((el || document).querySelectorAll(s));
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const safeStore = { get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }, set(k, v) { try { localStorage.setItem(k, v); } catch (e) {} } };

const DOMAINS = ['water', 'land', 'climate', 'other'];
const DOM_COLOR = { water: '#2a78d6', land: '#1baf7a', climate: '#eb6834', other: '#898781' };
const RAMP = ['#f4f4f2', '#e3e3df', '#cbcbc6', '#aeaea8', '#8b8b85', '#62625d', '#363632'];
const THEME_ORDER = ['land-degradation-slm', 'soil-salinity', 'pastures-livestock', 'forestry', 'biodiversity-protected-areas',
  'water-irrigation', 'water-supply-sanitation', 'lake-sevan', 'climate-adaptation', 'disaster-risk', 'climate-mitigation-energy',
  'agriculture-value-chain', 'rural-community-development', 'waste-pollution', 'policy-capacity'];
const DONOR_ALIAS = { 'Green Climate Fund': 'GCF', 'Global Environment Facility': 'GEF', 'World Bank Group': 'World Bank', 'The World Bank': 'World Bank',
  'European Union': 'EU', 'European Commission': 'EU', 'Asian Development Bank': 'ADB', 'European Bank for Reconstruction and Development': 'EBRD',
  'United Nations Development Programme': 'UNDP', 'Food and Agriculture Organization': 'FAO', 'Swiss Agency for Development and Cooperation': 'SDC',
  'U.S. Agency for International Development': 'USAID', 'Agence Française de Développement': 'AFD', 'International Fund for Agricultural Development': 'IFAD' };
const normDonor = d => DONOR_ALIAS[String(d).trim()] || String(d).trim();
const CUR_YEAR = 2026;
const NOW = 2026.84; // 2026-11-04 as a decimal year

const state = {
  lang: safeStore.get('icp_lang') || 'hy', tab: 'map', sub: 'overlaps', year: CUR_YEAR, allYears: false,
  status: new Set(), themes: new Set(), donors: new Set(), marz: '', q: '', colorBy: 'count',
  sel: null, area: null, pair: null, minLevel: 'high', ovDomain: '', gapTheme: 'dom:land', gapInd: 'treeloss_km2',
  dataCat: 'all', dataOpen: false, showNational: true
};
const t = k => (I18N[state.lang] && I18N[state.lang][k]) || I18N.en[k] || k;
const themeName = c => t('th_' + c.replace(/-/g, '_'));
const domName = d => t('dom_' + d);

// ------------------------------------------------------------------ data prep
const P = D.projects || [];
const BY = {}; P.forEach(p => BY[p.slug] = p);
const DIST = {}; (D.districts.features || []).forEach(f => DIST[f.properties.id] = f.properties);
const MARZ = {}; (D.marzes.features || []).forEach(f => MARZ[f.properties.id] = f.properties);
const MARZ_BY_EN = {}; Object.values(MARZ).forEach(m => MARZ_BY_EN[m.name_en] = m);
const yf = (s, end) => { if (!s) return null; const m = String(s).match(/^(\d{4})(?:-(\d{1,2}))?/); if (!m) return null; const y = +m[1], mo = m[2] ? +m[2] : (end ? 12 : 1); return end ? y + mo / 12 : y + (mo - 1) / 12; };
P.forEach(p => {
  p.ys = yf(p.start, false); p.ye = yf(p.end, true);
  p.dateUnknown = !p.start;
  if (p.ys == null) p.ys = p.status === 'pipeline' ? 2027 : 1995;
  if (p.ye == null) p.ye = p.status === 'active' ? 2030.99 : p.ys + 1;
  p.donors_full = p.donors || []; p.donors = (p.donors_short && p.donors_short.length) ? p.donors_short : (p.donors || []).map(normDonor); p.donorsN = p.donors;
  p.hay = [p.title.en, p.title.hy, p.summary.en, (p.donors || []).join(' '), (p.implementers || []).join(' '),
    p.locations.map(l => [l.marz, l.community, (l.settlements || []).join(' '), (DIST[(l.district_ids || [])[0]] || {}).name_en].join(' ')).join(' ')].join(' ').toLowerCase();
  p.allDist = Array.from(new Set((p.districts_specific || []).concat(p.districts_broad || [])));
  p.marzSet = new Set(p.locations.map(l => l.marz).filter(Boolean));
});
P.forEach(p => { p.eff = (p.status === 'active' && p.ys > NOW) ? 'pipeline' : p.status; });
const COM = {};
(D.communities && D.communities.features || []).forEach(f => { const b = [999, 999, -999, -999]; ringBboxEarly(f.geometry.coordinates, b); COM[f.properties.code] = { code: f.properties.code, name: f.properties.name_en, district: f.properties.district_id, cx: (b[0] + b[2]) / 2, cy: (b[1] + b[3]) / 2 }; });
function ringBboxEarly(coords, b) { coords.forEach(c => { if (typeof c[0] === 'number') { b[0] = Math.min(b[0], c[0]); b[1] = Math.min(b[1], c[1]); b[2] = Math.max(b[2], c[0]); b[3] = Math.max(b[3], c[1]); } else ringBboxEarly(c, b); }); }
const OV = D.overlaps || [];
const LVL = { high: 3, medium: 2, low: 1 };
const pairsOf = {}; OV.forEach(o => { (pairsOf[o.a] = pairsOf[o.a] || []).push(o); (pairsOf[o.b] = pairsOf[o.b] || []).push(o); });
const IND = (D.indicators && D.indicators.districts) || {};
const IND_META = (D.indicators && D.indicators.meta) || {};

const L = (obj) => { if (!obj) return ''; const v = obj[state.lang]; return v && String(v).length ? v : (obj.en || ''); };
const Lhas = (obj) => !!(obj && obj[state.lang] && String(obj[state.lang]).length);
const Larr = (o) => { const v = o && o[state.lang]; return v && v.length ? v : ((o && o.en) || []); };
const nm = (o) => (state.lang === 'hy' ? o.name_hy : state.lang === 'ru' ? o.name_ru : o.name_en) || o.name_en;
const fmtY = p => { if (!p.start) return '—'; const a = String(p.start || '').slice(0, 4), b = p.end ? String(p.end).slice(0, 4) : '…'; return a + '–' + b; };
const fmtMoney = p => {
  const u = p.budget_usd;
  if (u != null) return u >= 1e6 ? '$' + (u / 1e6).toFixed(u >= 1e8 ? 0 : 1).replace(/\.0$/, '') + 'M' : '$' + Math.round(u / 1e3) + 'K';
  return p.budget_original || '—';
};
const budgetNote = p => (p.budget_usd != null && p.budget_original) ? p.budget_original : (p.cofinancing_note || '');
const fmtDate = s => { const m = String(s || '').match(/^(\d{4})(?:-(\d{2}))?/); return m ? (m[2] ? m[2] + '/' : '') + m[1] : '—'; };
const stageText = p => { const g = p.stage; if (!g) return ''; return (state.lang === 'hy' && g.hy) ? g.hy : (g.en || ''); };
const fmtN = n => (n == null || isNaN(n)) ? '—' : Number(n).toLocaleString(state.lang === 'hy' ? 'hy-AM' : 'en-US', { maximumFractionDigits: Math.abs(n) > 0 && Math.abs(n) < 1 ? 2 : 1 });
const domDot = d => '<span class="dot ' + d + '"></span>';
const stTag = s => '<span class="tag st-' + s + '">' + esc(t('st_' + s)) + '</span>';
const lvlTag = l => '<span class="lvl ' + l + '">' + esc(t('lv_' + l)) + '</span>';
const placeText = p => {
  if (p.is_national) return t(p.loc_unknown ? 'pr_unknown' : 'pr_national');
  const parts = Array.from(new Set(p.locations.map(l => l.marz).filter(Boolean))).map(m => (MARZ_BY_EN[m] ? nm(MARZ_BY_EN[m]) : m));
  return parts.slice(0, 3).join(', ') + (parts.length > 3 ? ' +' + (parts.length - 3) : '');
};
function donorList() {
  const c = {}; P.forEach(p => new Set(p.donorsN).forEach(d => { if (d !== 'Co-financiers' && d !== 'Local co-funding') c[d] = (c[d] || 0) + 1; }));
  return Object.entries(c).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
}

// ------------------------------------------------------------------ filters
function activeIn(p, y) { if (p.eff === 'pipeline') return y >= CUR_YEAR; return p.ys < y + 1 && p.ye >= y; }
function passes(p, opts) {
  opts = opts || {};
  if (state.status.size && !state.status.has(p.eff)) return false;
  if (state.themes.size && !p.themes.some(x => state.themes.has(x))) return false;
  if (state.donors.size && !p.donorsN.some(x => state.donors.has(x))) return false;
  if (state.marz && !p.marzSet.has(state.marz)) return false;
  if (!state.allYears && !opts.ignoreYear && !activeIn(p, state.year)) return false;
  if (state.q) { const q = state.q.toLowerCase(); if (!p.hay.includes(q)) return false; }
  return true;
}
const filtered = () => P.filter(p => passes(p));

// ------------------------------------------------------------------ geometry helpers
function ringBbox(coords, b) { coords.forEach(c => { if (typeof c[0] === 'number') { b[0] = Math.min(b[0], c[0]); b[1] = Math.min(b[1], c[1]); b[2] = Math.max(b[2], c[0]); b[3] = Math.max(b[3], c[1]); } else ringBbox(c, b); }); return b; }
const FEAT = {}; D.districts.features.forEach(f => FEAT[f.properties.id] = f);
function bboxOf(ids) { const b = [999, 999, -999, -999]; ids.forEach(i => FEAT[i] && ringBbox(FEAT[i].geometry.coordinates, b)); return b[0] > 900 ? null : [[b[0], b[1]], [b[2], b[3]]]; }
const ARM_BOUNDS = [[43.35, 38.75], [46.75, 41.35]];

// ------------------------------------------------------------------ map
let map = null, mapReady = false, popup = null, marzMarkers = [], cityMarkers = [];
const CITIES = [
  { en: 'Yerevan', hy: 'Երևան', lat: 40.18, lon: 44.51, big: 1 },
  { en: 'Gyumri', hy: 'Գյումրի', lat: 40.79, lon: 43.85, big: 1, left: 1 },
  { en: 'Vanadzor', hy: 'Վանաձոր', lat: 40.81, lon: 44.49, big: 1 },
  { en: 'Kapan', hy: 'Կապան', lat: 39.21, lon: 46.41 },
  { en: 'Goris', hy: 'Գորիս', lat: 39.51, lon: 46.34 },
  { en: 'Sevan', hy: 'Սևան', lat: 40.55, lon: 44.95 },
  { en: 'Gavar', hy: 'Գավառ', lat: 40.36, lon: 45.13 },
  { minor: 1, en: 'Vagharshapat', hy: 'Վաղարշապատ', lat: 40.16, lon: 44.29 },
  { minor: 1, en: 'Hrazdan', hy: 'Հրազդան', lat: 40.5, lon: 44.77 },
  { minor: 1, en: 'Abovyan', hy: 'Աբովյան', lat: 40.27, lon: 44.63 },
  { minor: 1, en: 'Artashat', hy: 'Արտաշատ', lat: 39.96, lon: 44.55 },
  { en: 'Ijevan', hy: 'Իջևան', lat: 40.88, lon: 45.15 },
  { en: 'Dilijan', hy: 'Դիլիջան', lat: 40.74, lon: 44.86 },
  { en: 'Yeghegnadzor', hy: 'Եղեգնաձոր', lat: 39.76, lon: 45.33 },
  { en: 'Meghri', hy: 'Մեղրի', lat: 38.9, lon: 46.25 },
  { en: 'Sisian', hy: 'Սիսիան', lat: 39.52, lon: 46.03 },
  { minor: 1, en: 'Spitak', hy: 'Սպիտակ', lat: 40.84, lon: 44.27 },
  { minor: 1, en: 'Alaverdi', hy: 'Ալավերդի', lat: 41.1, lon: 44.66 },
  { minor: 1, en: 'Stepanavan', hy: 'Ստեփանավան', lat: 41.01, lon: 44.38 },
  { minor: 1, en: 'Jermuk', hy: 'Ջերմուկ', lat: 39.84, lon: 45.67 },
  { minor: 1, en: 'Vardenis', hy: 'Վարդենիս', lat: 40.18, lon: 45.74 },
  { minor: 1, en: 'Martuni', hy: 'Մարտունի', lat: 40.14, lon: 45.31 },
  { minor: 1, en: 'Ashtarak', hy: 'Աշտարակ', lat: 40.3, lon: 44.36 },
  { minor: 1, en: 'Talin', hy: 'Թալին', lat: 40.39, lon: 43.88 },
  { minor: 1, en: 'Masis', hy: 'Մասիս', lat: 40.07, lon: 44.42 }];
function diamondImage(color) {
  const S = 44, c = document.createElement('canvas'); c.width = c.height = S; const g = c.getContext('2d');
  g.translate(S / 2, S / 2); g.rotate(Math.PI / 4);
  g.fillStyle = '#fff'; g.fillRect(-11.5, -11.5, 23, 23);
  g.lineWidth = 4.2; g.strokeStyle = color; g.strokeRect(-8, -8, 16, 16);
  g.fillStyle = color; g.fillRect(-3.4, -3.4, 6.8, 6.8);
  return g.getImageData(0, 0, S, S);
}
function blankStyle() { return { version: 8, sources: {}, layers: [{ id: 'bg', type: 'background', paint: { 'background-color': '#eceeea' } }] }; }

// OpenFreeMap 'positron' vector basemap, added AFTER the map is up (non-blocking), beneath our own layers, without labels/sprites
async function loadBasemap() {
  try {
    const ctl = new AbortController(); const to = setTimeout(() => ctl.abort(), 9000);
    const r = await fetch('https://tiles.openfreemap.org/styles/positron', { signal: ctl.signal }); clearTimeout(to);
    if (!r.ok) throw new Error('style ' + r.status);
    const st = await r.json();
    Object.entries(st.sources || {}).forEach(([id, def]) => { if (!map.getSource('bm-' + id)) map.addSource('bm-' + id, def); });
    (st.layers || []).forEach(l => {
      if (l.type === 'symbol') return;
      const pt = JSON.stringify(l.paint || {}); if (pt.indexOf('-pattern') >= 0) return;
      try { map.addLayer(Object.assign({}, l, { id: 'bm-' + l.id, source: l.source ? 'bm-' + l.source : undefined }), 'd-fill'); } catch (e) { /* skip layer */ }
    });
    const stt = $('#mapstatus'); if (stt) stt.hidden = true;
  } catch (e) {
    const stt = $('#mapstatus'); if (stt) { stt.hidden = false; stt.textContent = state.lang === 'hy' ? 'Հիմնաքարտեզը անհասանելի է (անցանց) — ցուցադրվում են միայն սահմանները' : 'Basemap unavailable (offline) — boundaries only'; }
  }
}

function initMap() {
  const style = blankStyle();
  map = new maplibregl.Map({ container: 'map', style, bounds: ARM_BOUNDS, fitBoundsOptions: { padding: 24 }, attributionControl: false,
    maxBounds: [[41.2, 37.2], [49, 43]], minZoom: 5.5, dragRotate: false, pitchWithRotate: false });
  map.touchZoomRotate.disableRotation();
  map.addControl(new maplibregl.AttributionControl({ compact: true, customAttribution: 'Boundaries: OCHA COD-AB (CC BY 3.0 IGO) · Communities: AUA Acopian / Open Data Armenia · Context: ESA WorldCover, Hansen GFC' }));
  map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'bottom-right');
  map.on('error', e => { try { if (e && e.sourceId && String(e.sourceId).indexOf('bm-') === 0) return; console.warn('map error:', (e && e.error && e.error.message) || e); } catch (x) {} });
  map.on('load', () => {
    map.addSource('districts', { type: 'geojson', data: D.districts });
    map.addSource('marzes', { type: 'geojson', data: D.marzes });
    map.addSource('communities', { type: 'geojson', data: D.communities || { type: 'FeatureCollection', features: [] } });
    map.addSource('pts', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
    map.addLayer({ id: 'd-fill', type: 'fill', source: 'districts', paint: { 'fill-color': '#ffffff', 'fill-opacity': 0.0 } });
    map.addLayer({ id: 'd-line', type: 'line', source: 'districts', paint: { 'line-color': '#7b8584', 'line-width': 0.7, 'line-opacity': 0.8 } });
    map.addLayer({ id: 'hl-fill', type: 'fill', source: 'districts', filter: ['in', ['get', 'id'], ['literal', []]], paint: { 'fill-color': '#e6007e', 'fill-opacity': 0.16 } });
    map.addLayer({ id: 'hl-line', type: 'line', source: 'districts', filter: ['in', ['get', 'id'], ['literal', []]], paint: { 'line-color': '#e6007e', 'line-width': 2.4 } });
    map.addLayer({ id: 'c-fill', type: 'fill', source: 'communities', filter: ['in', ['get', 'code'], ['literal', []]], paint: { 'fill-color': '#14201f', 'fill-opacity': 0.22 } });
    map.addLayer({ id: 'c-line', type: 'line', source: 'communities', filter: ['in', ['get', 'code'], ['literal', []]], paint: { 'line-color': '#14201f', 'line-width': 1.6 } });
    map.addLayer({ id: 'm-line', type: 'line', source: 'marzes', paint: { 'line-color': '#14201f', 'line-width': 1.7, 'line-opacity': 0.85 } });
    const domColor = ['match', ['get', 'domain'], 'water', DOM_COLOR.water, 'land', DOM_COLOR.land, 'climate', DOM_COLOR.climate, DOM_COLOR.other];
    map.addLayer({ id: 'pts-broad', type: 'circle', source: 'pts', filter: ['==', ['get', 'kind'], 'b'],
      paint: { 'circle-radius': 7.5, 'circle-color': 'rgba(255,255,255,0.75)', 'circle-stroke-color': domColor, 'circle-stroke-width': 2.8 } });
    map.addLayer({ id: 'pts-spec', type: 'circle', source: 'pts', filter: ['==', ['get', 'kind'], 's'],
      paint: { 'circle-radius': 6.5, 'circle-color': domColor, 'circle-stroke-color': '#ffffff', 'circle-stroke-width': 1.8 } });
    ['water', 'land', 'climate', 'other'].forEach(d => map.addImage('plan-' + d, diamondImage(DOM_COLOR[d]), { pixelRatio: 2 }));
    map.addLayer({ id: 'pts-plan', type: 'symbol', source: 'pts', filter: ['==', ['get', 'kind'], 'p'],
      layout: { 'icon-image': ['concat', 'plan-', ['get', 'domain']], 'icon-size': 1, 'icon-allow-overlap': true, 'icon-ignore-placement': true } });
    map.addLayer({ id: 'pts-sel', type: 'circle', source: 'pts', filter: ['==', ['get', 'slug'], ''],
      paint: { 'circle-radius': 11, 'circle-color': 'rgba(0,0,0,0)', 'circle-stroke-color': '#14201f', 'circle-stroke-width': 2.6 } });
    // marz labels (HTML, so Armenian renders with system fonts and no glyph server is needed)
    D.marzes.features.forEach(f => {
      const el = document.createElement('div'); el.className = 'marz-label'; el.dataset.id = f.properties.id; el.textContent = nm(f.properties);
      marzMarkers.push({ el, m: new maplibregl.Marker({ element: el }).setLngLat([f.properties.cx, f.properties.cy]).addTo(map), f });
    });
    CITIES.forEach(c => { const el = document.createElement('div'); el.className = 'city-label' + (c.big ? ' big' : ''); el.textContent = state.lang === 'hy' ? c.hy : c.en; cityMarkers.push({ el, c, m: new maplibregl.Marker({ element: el, anchor: c.left ? 'right' : 'left', offset: [c.left ? -6 : 6, 0] }).setLngLat([c.lon, c.lat]).addTo(map) }); });
    const cityZoom = () => cityMarkers.forEach(o => { o.el.style.display = (!o.c.minor || map.getZoom() >= 8.2) ? '' : 'none'; });
    map.on('zoom', cityZoom); cityZoom();
    popup = new maplibregl.Popup({ closeButton: false, closeOnClick: false, offset: 10 });
    ['pts-spec', 'pts-broad', 'pts-plan'].forEach(l => {
      map.on('mouseenter', l, e => { map.getCanvas().style.cursor = 'pointer'; showPointPopup(e); });
      map.on('mousemove', l, e => showPointPopup(e));
      map.on('mouseleave', l, () => { map.getCanvas().style.cursor = ''; popup.remove(); });
      map.on('click', l, e => { const f = e.features[0]; e.originalEvent.__handled = true; selectProject(f.properties.slug, { fly: false }); });
    });
    map.on('mousemove', 'd-fill', e => { if (map.queryRenderedFeatures(e.point, { layers: ['pts-spec', 'pts-broad', 'pts-plan'] }).length) return; const f = e.features[0]; if (f) { map.getCanvas().style.cursor = 'pointer'; showAreaTip(e.originalEvent, f.properties.id); } });
    map.on('mouseleave', 'd-fill', () => { map.getCanvas().style.cursor = ''; hideTip(); });
    map.on('click', 'd-fill', e => {
      if (e.originalEvent.__handled) return;
      if (map.queryRenderedFeatures(e.point, { layers: ['pts-spec', 'pts-broad', 'pts-plan'] }).length) return;
      const f = e.features[0]; if (f) selectArea(f.properties.id);
    });
    mapReady = true; updateMap(); loadBasemap();
  });
}
function showPointPopup(e) {
  const f = e.features[0]; if (!f) return; const p = BY[f.properties.slug]; if (!p) return;
  popup.setLngLat(e.lngLat).setHTML('<b>' + esc(L(p.title)) + '</b><br><span class="muted">' + esc(p.donors.join(', ')) + ' · ' + esc(fmtY(p)) + '</span>').addTo(map);
}
function showAreaTip(ev, did) {
  const st = distStats()[did]; const d = DIST[did]; if (!d) return;
  const cnt = st ? st.spec.size + st.broad.size : 0;
  tip(ev, '<b>' + esc(nm(d)) + '</b> · ' + esc(nm(MARZ[d.marz_id] || { name_en: d.marz_en })) + '<br>' + cnt + ' ' + esc(t('projects_here')) + (st && st.broad.size ? ' (' + st.spec.size + ' ' + esc(t('specific')) + ', ' + st.broad.size + ' ' + esc(t('possible')) + ')' : ''));
}
const tipEl = () => $('#tip');
function tip(ev, html) { const el = tipEl(); el.hidden = false; el.innerHTML = html; const x = Math.min(ev.clientX + 14, window.innerWidth - el.offsetWidth - 8), y = Math.min(ev.clientY + 14, window.innerHeight - el.offsetHeight - 8); el.style.left = x + 'px'; el.style.top = y + 'px'; }
function hideTip() { tipEl().hidden = true; }

// per-district stats on the currently filtered set
let _statsKey = null, _stats = null;
function distStats() {
  const key = JSON.stringify([state.year, state.allYears, [...state.status], [...state.themes], [...state.donors], state.marz, state.q]);
  if (key === _statsKey) return _stats;
  const out = {};
  filtered().forEach(p => {
    (p.districts_specific || []).forEach(d => { const o = out[d] = out[d] || { spec: new Set(), broad: new Set(), donors: new Set() }; o.spec.add(p.slug); p.donorsN.forEach(x => o.donors.add(x)); });
    (p.districts_broad || []).forEach(d => { const o = out[d] = out[d] || { spec: new Set(), broad: new Set(), donors: new Set() }; if (!o.spec.has(p.slug)) o.broad.add(p.slug); p.donorsN.forEach(x => o.donors.add(x)); });
  });
  _statsKey = key; _stats = out; return out;
}
function quantileBreaks(vals, n) {
  const s = vals.filter(v => v != null && !isNaN(v)).sort((a, b) => a - b); if (!s.length) return [];
  const br = []; for (let i = 1; i < n; i++) br.push(s[Math.min(s.length - 1, Math.floor(i * s.length / n))]);
  return Array.from(new Set(br));
}
const IND_FIELDS = { cb_loss: 'treeloss_km2', cb_losspct: 'treeloss_pct_of_2000', cb_crop: 'lc_crop_pct', cb_tree: 'lc_tree_pct', cb_grass: 'lc_grass_pct' };
function colorSpec() {
  const cb = state.colorBy; const ids = Object.keys(DIST);
  if (cb === 'none') return { expr: 'rgba(0,0,0,0)', op: 0, legend: null };
  const isCount = (cb === 'count' || cb === 'donors'); const NA = '#e5e4de', ZERO = '#f4f3ef';
  let vals = {}, breaks, title;
  if (isCount) {
    const st = distStats();
    ids.forEach(i => vals[i] = st[i] ? (cb === 'count' ? st[i].spec.size + st[i].broad.size : st[i].donors.size) : 0);
    breaks = cb === 'count' ? [1, 3, 6, 10, 15] : [1, 2, 3, 5, 8];
    title = t(cb === 'count' ? 'cb_count' : 'cb_donors');
  } else {
    const f = IND_FIELDS[cb]; ids.forEach(i => vals[i] = IND[i] ? IND[i][f] : null);
    breaks = quantileBreaks(Object.values(vals), 6); title = t(cb);
  }
  const cls = v => { let k = 0; breaks.forEach(b => { if (v >= b) k++; }); return k; };
  const colorFor = v => v == null ? NA : isCount ? (v === 0 ? ZERO : RAMP[Math.min(cls(v), 6)]) : RAMP[Math.min(cls(v) + 1, 6)];
  const expr = ['match', ['get', 'id']]; ids.forEach(i => expr.push(i, colorFor(vals[i]))); expr.push(NA);
  const present = Object.values(vals).filter(v => v != null);
  const ramp = isCount ? [ZERO].concat(RAMP.slice(1, 1 + breaks.length)) : RAMP.slice(1, 2 + breaks.length);
  return { expr, op: 0.8, legend: { title, ramp, min: Math.min.apply(null, present), max: Math.max.apply(null, present), count: isCount } };
}
function ptsData() {
  const seen = {}, feats = [];
  const bump = k => (seen[k] = (seen[k] || 0) + 1) - 1;
  const jit = (cx, cy, k) => { const a = k * 2.39996, r = k === 0 ? 0 : 0.032 * Math.sqrt(k); return [cx + r * Math.cos(a) * 1.25, cy + r * Math.sin(a)]; };
  filtered().forEach(p => {
    const pl = p.eff === 'pipeline';
    p.locations.forEach((l, li) => {
      if (l.precision === 'national') return;
      if (l.precision === 'marz') {
        const m = MARZ_BY_EN[l.marz]; if (!m) return; const k = bump('m' + m.id); const c = jit(m.cx, m.cy - 0.12, k);
        feats.push({ type: 'Feature', geometry: { type: 'Point', coordinates: c }, properties: { slug: p.slug, domain: p.domain, kind: pl ? 'p' : 'b' } });
      } else if ((l.community_ids || []).length && l.lat == null) {
        l.community_ids.forEach(cc => { const o = COM[cc]; if (!o) return; const k = bump('c' + cc); const c = jit(o.cx, o.cy, k);
          feats.push({ type: 'Feature', geometry: { type: 'Point', coordinates: c }, properties: { slug: p.slug, domain: p.domain, kind: pl ? 'p' : 's' } }); });
      } else if (l.lat != null && l.lon != null) {
        feats.push({ type: 'Feature', geometry: { type: 'Point', coordinates: [l.lon, l.lat] }, properties: { slug: p.slug, domain: p.domain, kind: pl ? 'p' : 's' } });
      } else {
        (l.district_ids || []).forEach(d => {
          const dd = DIST[d]; if (!dd) return; const k = bump('d' + d); const c = jit(dd.cx, dd.cy, k);
          feats.push({ type: 'Feature', geometry: { type: 'Point', coordinates: c }, properties: { slug: p.slug, domain: p.domain, kind: pl ? 'p' : 's' } });
        });
      }
    });
  });
  return { type: 'FeatureCollection', features: feats };
}
function updateMap() {
  if (!mapReady) return;
  const cs = colorSpec();
  map.setPaintProperty('d-fill', 'fill-color', cs.expr); map.setPaintProperty('d-fill', 'fill-opacity', cs.op);
  map.getSource('pts').setData(ptsData());
  map.setFilter('pts-sel', ['==', ['get', 'slug'], state.sel || '']);
  const cbs = $('#colorby'); if (cbs && cbs.value !== state.colorBy) cbs.value = state.colorBy;
  renderLegend(cs);
}
let comLabels = [];
function setHighlight(ids, comms) {
  if (!mapReady) return; const f = ['in', ['get', 'id'], ['literal', ids || []]];
  map.setFilter('hl-fill', f); map.setFilter('hl-line', f);
  const cf = ['in', ['get', 'code'], ['literal', comms || []]];
  map.setFilter('c-fill', cf); map.setFilter('c-line', cf);
  comLabels.forEach(m => m.remove()); comLabels = [];
  (comms || []).slice(0, 14).forEach(c => { const o = COM[c]; if (!o) return; const el = document.createElement('div'); el.className = 'com-label'; el.textContent = o.name; comLabels.push(new maplibregl.Marker({ element: el }).setLngLat([o.cx, o.cy]).addTo(map)); });
}
function fitIds(ids) { if (!mapReady) return; const b = ids && ids.length ? bboxOf(ids) : null; map.fitBounds(b || ARM_BOUNDS, { padding: { top: 40, bottom: 40, left: 40, right: state.sel || state.pair ? 460 : 40 }, maxZoom: 9.5, duration: 700 }); }
function renderLayerCtl() {
  const el = $('#layerctl'); if (!el) return;
  const cbOpts = [['count', 'cb_count'], ['donors', 'cb_donors'], ['none', 'cb_none']];
  const ctxOpts = Object.keys(IND_FIELDS).filter(k => Object.values(IND).some(v => v && v[IND_FIELDS[k]] != null));
  el.innerHTML = '<label class="small muted" for="colorby">' + esc(t('color_by')) + '</label><select id="colorby">' + cbOpts.map(([v, k]) => '<option value="' + v + '"' + (state.colorBy === v ? ' selected' : '') + '>' + esc(t(k)) + '</option>').join('') +
    (ctxOpts.length ? '<optgroup label="' + esc(t('context_layers')) + '">' + ctxOpts.map(k => '<option value="' + k + '"' + (state.colorBy === k ? ' selected' : '') + '>' + esc(t(k)) + '</option>').join('') + '</optgroup>' : '') + '</select>';
}
function renderLegend(cs) {
  let h = '<details' + (window.innerWidth > 900 ? ' open' : '') + '><summary>' + esc(t('legend')) + '</summary><h4>' + esc(t('legend_domain')) + '</h4>' + DOMAINS.map(d => '<div class="li">' + domDot(d) + esc(domName(d)) + '</div>').join('');
  h += '<div class="li" style="margin-top:6px"><span class="dot" style="background:#555"></span>' + esc(t('legend_specific')) + '</div>';
  h += '<div class="li"><span class="dot ring"></span>' + esc(t('legend_marz')) + '</div>';
  h += '<div class="li"><span class="dia"></span>' + esc(t('legend_planned')) + '</div>';
  if (cs && cs.legend) {
    const lg = cs.legend;
    h += '<h4 style="margin-top:10px">' + esc(lg.title) + '</h4><div class="ramp">' + lg.ramp.map(c => '<i style="background:' + c + '"></i>').join('') + '</div>';
    h += '<div class="ramplbl"><span>' + esc(fmtN(lg.count ? 0 : lg.min)) + '</span><span>' + esc(fmtN(lg.max)) + (lg.count ? '+' : '') + '</span></div>';
  }
  $('#legend').innerHTML = h + '</details>';
}

// ------------------------------------------------------------------ side: map tab
function themeGroupsHtml() {
  return DOMAINS.map(d => {
    const th = THEME_ORDER.filter(c => D.meta.themes[c] === d); if (!th.length) return '';
    return '<div class="themegroup"><div class="lbl">' + domDot(d) + esc(domName(d)) + '</div><div class="chips">' +
      th.map(c => '<button class="chip" data-act="theme" data-v="' + c + '" aria-pressed="' + state.themes.has(c) + '">' + esc(themeName(c)) + '</button>').join('') + '</div></div>';
  }).join('');
}
function renderSideMap() {
  const side = $('#side');
  const donors = donorList();
  const nTh = state.themes.size, nDo = state.donors.size;
  side.innerHTML =
    '<div class="sect"><input type="search" id="q" placeholder="' + esc(t('search_ph')) + '" value="' + esc(state.q) + '" aria-label="' + esc(t('search_ph')) + '"></div>' +
    '<div class="sect"><div class="row sb"><h3 style="margin:0">' + esc(t('year')) + ': <span id="yearval">' + (state.allYears ? esc(t('all_years')) : state.year) + '</span></h3>' +
    '<label class="chk small"><input type="checkbox" id="allyears"' + (state.allYears ? ' checked' : '') + '> ' + esc(t('all_years')) + '</label></div>' +
    '<input type="range" id="year" min="1995" max="2031" step="1" value="' + state.year + '"' + (state.allYears ? ' disabled' : '') + ' aria-label="' + esc(t('year')) + '"></div>' +
    '<div class="sect"><h3>' + esc(t('status')) + '</h3><div class="chips">' + ['active', 'completed', 'pipeline'].map(s => '<button class="chip" data-act="status" data-v="' + s + '" aria-pressed="' + state.status.has(s) + '">' + esc(t('st_' + s)) + '</button>').join('') + '</div></div>' +
    '<details class="acc"' + (nTh ? ' open' : '') + '><summary><span>' + esc(t('themes')) + (nTh ? ' <span class="count">' + nTh + '</span>' : '') + '</span></summary><div class="accbody">' + themeGroupsHtml() + '</div></details>' +
    '<details class="acc"' + (nDo ? ' open' : '') + '><summary><span>' + esc(t('donors')) + (nDo ? ' <span class="count">' + nDo + '</span>' : '') + '</span></summary><div class="accbody"><div class="chips">' + donors.map(([d, n]) => '<button class="chip" data-act="donor" data-v="' + esc(d) + '" aria-pressed="' + state.donors.has(d) + '">' + esc(d) + ' <span class="muted">' + n + '</span></button>').join('') + '</div></div></details>' +
    '<details class="acc"' + (state.marz ? ' open' : '') + '><summary><span>' + esc(t('marz')) + (state.marz ? ' <span class="count">1</span>' : '') + '</span></summary><div class="accbody"><select id="marz"><option value="">' + esc(t('all_marz')) + '</option>' +
    Object.values(MARZ).sort((a, b) => a.name_en.localeCompare(b.name_en)).map(m => '<option value="' + m.name_en + '"' + (state.marz === m.name_en ? ' selected' : '') + '>' + esc(nm(m)) + '</option>').join('') + '</select></div></details>' +
    '<div class="sect row sb" style="position:sticky;top:0;background:var(--surface);z-index:2"><span id="rescount"></span><button class="linkbtn" data-act="clear">' + esc(t('clear')) + '</button></div>' +
    '<ul class="plist" id="plist"></ul>';
  updateList();
}
function pcard(p) {
  const pl = p.eff === 'pipeline', stg = pl ? stageText(p) : '';
  return '<li class="pcard d-' + p.domain + (pl ? ' planned' : '') + '" tabindex="0" role="button" data-act="open" data-v="' + p.slug + '" aria-selected="' + (state.sel === p.slug) + '">' +
    '<div class="t">' + esc(L(p.title)) + '</div><div class="m">' + esc(p.donors.slice(0, 3).join(' · ')) + ' · ' + esc(fmtY(p)) + ' · ' + esc(placeText(p)) + '</div>' +
    (pl ? '<div class="planline">◆ ' + esc(t('plan_start_short')) + ' ' + esc(fmtDate(p.start)) + (stg ? ' · ' + esc(stg) : '') + '</div>' : '') +
    '<div class="tags">' + stTag(p.eff) + p.themes.slice(0, 2).map(c => '<span class="tag">' + esc(themeName(c)) + '</span>').join('') + '</div></li>';
}
function updateList() {
  const list = $('#plist'); if (!list) return;
  const f = filtered().sort((a, b) => (a.is_national - b.is_national) || (b.ys - a.ys));
  $('#rescount').innerHTML = '<b>' + f.length + '</b> ' + esc(t('results')) + ' <span class="muted">/ ' + P.length + '</span>';
  const planned = f.filter(p => !p.is_national && p.eff === 'pipeline'), loc = f.filter(p => !p.is_national && p.eff !== 'pipeline'), nat = f.filter(p => p.is_national);
  const head = (k, n) => '<li class="listhead"><h3>' + esc(t(k)) + ' · ' + n + '</h3></li>';
  list.innerHTML = (f.length ? '' : '<li class="pad muted">' + esc(t('no_results')) + '</li>') +
    (planned.length ? head('planned_progs', planned.length) + planned.map(pcard).join('') : '') +
    (planned.length && loc.length ? head('other_progs', loc.length) : '') + loc.map(pcard).join('') +
    (nat.length ? head('national_progs', nat.length) + nat.map(pcard).join('') : '');
}
function onFilterChange() { _statsKey = null; updateList(); updateMap(); if (state.tab === 'coord') renderSideCoord(); }

// ------------------------------------------------------------------ drawer
const drawer = () => $('#drawer');
function closeDrawer() { state.sel = null; state.pair = null; state.area = null; drawer().hidden = true; setHighlight([]); updateMap(); $$('.pcard[aria-selected="true"]').forEach(e => e.setAttribute('aria-selected', 'false')); }
function selectProject(slug, opts) {
  const p = BY[slug]; if (!p) return; state.sel = slug; state.pair = null; state.area = null; opts = opts || {};
  setHighlight(p.allDist, p.communities_specific); updateMap();
  if (opts.fly !== false) fitIds(p.allDist);
  renderDrawerProject(p);
  $$('.pcard').forEach(e => e.setAttribute('aria-selected', e.dataset.v === slug ? 'true' : 'false'));
  const sel = $('.pcard[aria-selected="true"]'); if (sel && sel.scrollIntoView) sel.scrollIntoView({ block: 'nearest' });
}
function factsHtml(p) {
  return '<dl class="facts"><dt>' + esc(t('donor')) + '</dt><dd>' + esc(p.donors.join(', ') || '—') + (p.donors_full.join('; ') !== p.donors.join(', ') ? '<div class="small muted">' + esc(p.donors_full.join('; ')) + '</div>' : '') + '</dd>' +
    '<dt>' + esc(t('implementer')) + '</dt><dd>' + esc((p.implementers.slice(0, 4).join('; ') + (p.implementers.length > 4 ? ' +' + (p.implementers.length - 4) : '')) || '—') + '</dd>' +
    (p.partners && p.partners.length ? '<dt>' + esc(t('partner')) + '</dt><dd>' + esc(p.partners.join(', ')) + '</dd>' : '') +
    '<dt>' + esc(t('period')) + '</dt><dd>' + esc(fmtPeriodFull(p)) + '</dd>' +
    '<dt>' + esc(t('budget')) + '</dt><dd>' + esc(fmtMoney(p)) + (budgetNote(p) ? '<div class="small muted">' + esc(budgetNote(p)) + '</div>' : '') + '</dd></dl>';
}
const fmtPeriodFull = p => { const f = s => { const m = String(s || '').match(/^(\d{4})(?:-(\d{2}))?/); return m ? (m[2] ? m[2] + '/' : '') + m[1] : '…'; }; return f(p.start) + ' – ' + f(p.end); };
function themeTags(p) { return p.themes.map(c => '<span class="tag">' + domDot(D.meta.themes[c]) + ' ' + esc(themeName(c)) + '</span>').join(' '); }
function trNotice(p) { return state.lang === 'hy' && !Lhas(p.summary) ? '<div class="notice" style="margin-top:8px">' + esc(t('not_translated')) + '</div>' : ''; }
const ICON_CAL = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="16" rx="3"/><path d="M8 3v4M16 3v4M3 10h18"/></svg>';
function planBlock(p) {
  const act = Larr(p.activities), res = Larr(p.results), stg = stageText(p);
  return '<div class="planbox"><div class="ph">' + ICON_CAL + '<span>' + esc(t('plan_title')) + '</span></div><div class="pb">' +
    '<div class="planstats"><div><b>' + esc(fmtDate(p.start)) + '</b><span>' + esc(t('plan_start')) + '</span></div><div><b>' + esc(fmtMoney(p)) + '</b><span>' + esc(t('plan_budget')) + '</span></div></div>' +
    (stg ? '<div class="planstage"><span>' + esc(t('plan_stage')) + '</span>' + esc(stg) + '</div>' : '') +
    (act.length ? '<h4>' + esc(t('plan_what')) + '</h4><ul>' + act.map(x => '<li>' + esc(x) + '</li>').join('') + '</ul>' : '<p class="small muted">' + esc(t('plan_none')) + '</p>') +
    (res.length ? '<h4>' + esc(t('plan_expect')) + '</h4><ul>' + res.map(x => '<li>' + esc(x) + '</li>').join('') + '</ul>' : '') +
    '</div></div>';
}
// what already exists where this planned programme will work (same non-generic theme, shared community/district/marz)
const GENERIC = new Set(['policy-capacity', 'rural-community-development']);
function alreadyHere(p) {
  if (p.is_national) return [];
  const cs = new Set(p.communities_specific || []), ds = new Set(p.districts_specific || []), db = new Set(p.allDist || []);
  const th = p.themes.filter(x => !GENERIC.has(x));
  return P.filter(q => q.slug !== p.slug && q.eff !== 'cancelled' && !q.is_national && q.themes.some(x => th.includes(x))).map(q => {
    const qc = q.communities_specific || [], qd = q.districts_specific || [], qa = q.allDist || [];
    let strength = 0, where = [];
    const sc = qc.filter(c => cs.has(c)); const sd = qd.filter(d => ds.has(d)); const sa = qa.filter(d => db.has(d));
    if (sc.length) { strength = 3; where = sc.map(c => (COM[c] || {}).name || c); }
    else if (sd.length) { strength = 2; where = sd.map(d => nm(DIST[d] || { name_en: d })); }
    else if (sa.length) { strength = 1; where = sa.slice(0, 3).map(d => nm(DIST[d] || { name_en: d })); }
    return { q, strength, where, shared: q.themes.filter(x => th.includes(x)) };
  }).filter(r => r.strength > 0).sort((a, b) => b.strength - a.strength || (a.q.eff === 'active' ? -1 : 0) - (b.q.eff === 'active' ? -1 : 0) || b.q.ys - a.q.ys);
}
function hereBlock(p) {
  const rows = alreadyHere(p);
  if (p.is_national) return '';
  const lbl = { 3: t('here_community'), 2: t('here_district'), 1: t('here_marz') };
  return '<h3 style="margin-top:0">' + esc(t('here_title')) + ' · ' + rows.length + '</h3><p class="small muted" style="margin:0 0 8px">' + esc(t('here_sub')) + '</p>' +
    (rows.length ? '<div class="herebox">' + rows.slice(0, 10).map(r => '<div class="hr" tabindex="0" role="button" data-act="open" data-v="' + r.q.slug + '"><div><div class="t">' + esc(L(r.q.title)) + '</div><div class="small muted">' + esc(r.q.donors.slice(0, 2).join(' · ')) + ' · ' + esc(fmtY(r.q)) + ' · ' + esc(r.shared.map(themeName).slice(0, 2).join(', ')) + '</div><div class="small" style="margin-top:3px"><span class="prec">' + esc(lbl[r.strength]) + '</span> ' + esc(r.where.slice(0, 3).join(', ')) + '</div></div><div>' + stTag(r.q.eff) + '</div></div>').join('') + '</div>' + (rows.length > 10 ? '<div class="small muted" style="margin-top:6px">+' + (rows.length - 10) + '</div>' : '')
      : '<div class="notice">' + esc(t('here_none')) + '</div>');
}
function renderDrawerProject(p) {
  const rel = (pairsOf[p.slug] || []).filter(o => LVL[o.level] >= 2);
  const dr = drawer(); dr.hidden = false;
  dr.innerHTML = '<button class="xbtn" data-act="close" aria-label="' + esc(t('close')) + '">×</button>' +
    '<div class="drawer-head d-' + p.domain + (p.eff === 'pipeline' ? ' planned' : '') + '"><h2>' + esc(L(p.title)) + '</h2><div>' + stTag(p.eff) + themeTags(p) + '</div></div>' +
    (p.eff === 'pipeline' ? '<div class="sect">' + planBlock(p) + '</div>' : '') +
    '<div class="sect">' + factsHtml(p) + '</div>' +
    '<div class="sect"><h3>' + esc(t('summary')) + '</h3><p>' + esc(L(p.summary) || '—') + '</p>' + trNotice(p) + '</div>' +
    '<div class="sect"><h3>' + esc(t('where')) + '</h3>' + locList(p, true) + '</div>' +
    (p.eff === 'pipeline' && !p.is_national ? '<div class="sect">' + hereBlock(p) + '</div>' : '') +
    (rel.length ? '<div class="sect"><h3>' + esc(t('related')) + ' · ' + rel.length + '</h3>' + rel.slice(0, 3).map(o => { const q = BY[o.a === p.slug ? o.b : o.a]; return '<div class="small" style="margin:4px 0">' + lvlTag(o.level) + ' <button class="linkbtn" data-act="pair" data-a="' + o.a + '" data-b="' + o.b + '">' + esc(L(q.title)) + '</button></div>'; }).join('') + '</div>' : '') +
    '<div class="sect row sb"><button class="btn primary" data-act="page" data-v="' + p.slug + '">' + esc(t('more')) + '</button><span class="small muted">' + esc(t('confidence')) + ': ' + esc(t('conf_' + p.confidence)) + '</span></div>';
  dr.scrollTop = 0;
}
function locList(p, brief) {
  if (p.is_national) return '<p>' + esc(t(p.loc_unknown ? 'pr_unknown' : 'pr_national')) + '</p>' + (p.locations[0] && p.locations[0].evidence ? '<p class="small muted">' + esc(p.locations[0].evidence) + '</p>' : '');
  return '<ul class="bul">' + p.locations.filter(l => l.precision !== 'national').slice(0, brief ? 6 : 99).map(l => {
    const mz = l.marz && MARZ_BY_EN[l.marz] ? nm(MARZ_BY_EN[l.marz]) : (l.marz || '');
    const dn = (l.district_ids || []).length === 1 && l.precision !== 'marz' ? nm(DIST[l.district_ids[0]] || {}) : '';
    const cn = (l.community_names || []).join(', ');
    const detail = [dn, cn ? (state.lang === 'hy' ? 'համայնք՝ ' : 'community: ') + cn : '', (l.settlements || []).slice(0, brief ? 4 : 30).join(', ')].filter(Boolean).join(' · ');
    return '<li><b>' + esc(mz) + '</b>' + (detail ? ' — ' + esc(detail) : '') + ' <span class="prec">' + esc(t('pr_' + l.precision)) + '</span></li>';
  }).join('') + '</ul>' + (brief && p.locations.length > 6 ? '<div class="small muted">+' + (p.locations.length - 6) + '</div>' : '');
}
function selectArea(did) {
  state.area = did; state.sel = null; state.pair = null; setHighlight([did], []);
  const d = DIST[did]; const st = distStats()[did] || { spec: new Set(), broad: new Set(), donors: new Set() };
  const list = P.filter(p => passes(p) && (p.districts_specific.includes(did) || p.districts_broad.includes(did)));
  const ind = IND[did];
  const dr = drawer(); dr.hidden = false;
  dr.innerHTML = '<button class="xbtn" data-act="close" aria-label="' + esc(t('close')) + '">×</button>' +
    '<div class="drawer-head"><h2>' + esc(nm(d)) + '</h2><div class="muted">' + esc(nm(MARZ[d.marz_id] || { name_en: d.marz_en })) + ' · ' + fmtN(d.area_km2) + ' ' + esc(t('km2')) + '</div></div>' +
    '<div class="sect"><div class="kpis" style="grid-template-columns:1fr 1fr 1fr;margin:0"><div class="kpi"><b>' + list.length + '</b><span>' + esc(t('projects_here')) + '</span></div><div class="kpi"><b>' + st.donors.size + '</b><span>' + esc(t('donors_here')) + '</span></div><div class="kpi"><b>' + st.broad.size + '</b><span>' + esc(t('possible')) + '</span></div></div></div>' +
    '<div class="sect"><h3>' + esc(t('area_projects')) + '</h3>' + (list.length ? '<ul class="plist">' + list.map(p => '<li class="pcard" style="padding:8px 0" tabindex="0" role="button" data-act="open" data-v="' + p.slug + '">' + domDot(p.domain) + '<div><div class="t">' + esc(L(p.title)) + '</div><div class="m">' + esc(p.donors.slice(0, 2).join(' · ')) + ' · ' + esc(fmtY(p)) + (p.districts_specific.includes(did) ? '' : ' · ' + esc(t('area_marzlevel'))) + '</div></div></li>').join('') + '</ul>' : '<p class="muted">' + esc(t('area_none')) + '</p>') + '</div>' +
    (ind ? '<div class="sect"><h3>' + esc(t('context')) + '</h3><dl class="facts"><dt>' + esc(t('crop')) + '</dt><dd>' + fmtN(ind.lc_crop_pct) + '%</dd><dt>' + esc(t('grass')) + '</dt><dd>' + fmtN(ind.lc_grass_pct) + '%</dd><dt>' + esc(t('tree')) + '</dt><dd>' + fmtN(ind.lc_tree_pct) + '%</dd><dt>' + esc(t('bare')) + '</dt><dd>' + fmtN(ind.lc_bare_pct) + '%</dd><dt>' + esc(t('cb_loss')) + '</dt><dd>' + fmtN(ind.treeloss_km2) + '</dd></dl></div>' : '');
  dr.scrollTop = 0;
  if (state.tab === 'coord' && state.sub === 'area') renderSideCoord();
}

// ------------------------------------------------------------------ gantt
function ganttHtml(rows, opt) {
  opt = opt || {};
  const all = rows.flatMap(r => [r.ys, r.ye]); const y0 = Math.floor(Math.min.apply(null, all.concat([opt.minY || 9999]))) - 0, y1 = Math.ceil(Math.max.apply(null, all.concat([opt.maxY || 0])));
  const a = Math.min(y0, CUR_YEAR - 1), b = Math.max(y1, CUR_YEAR + 1), span = b - a;
  const pct = y => ((Math.max(a, Math.min(b, y)) - a) / span * 100);
  const step = span > 22 ? 5 : span > 10 ? 2 : 1;
  let ticks = ''; for (let y = Math.ceil(a / step) * step; y <= b; y += step) ticks += '<span style="left:' + pct(y) + '%">' + y + '</span>';
  let grid = ''; for (let y = Math.ceil(a / step) * step; y <= b; y += step) grid += '<div class="grid" style="left:' + pct(y) + '%"></div>';
  const body = rows.map(r => '<div class="gr"><div class="gl" ' + (r.slug ? 'data-act="open" data-v="' + r.slug + '" tabindex="0" role="button"' : '') + ' title="' + esc(r.label) + '">' + esc(r.label) + '</div><div class="gt">' +
    '<div class="bar ' + r.domain + (r.broad ? ' broad' : '') + (r.dateUnknown ? ' unk' : '') + '" style="left:' + pct(r.ys) + '%;width:' + Math.max(0.6, pct(r.ye) - pct(r.ys)) + '%" data-tip="' + esc(r.label + ' · ' + r.period) + '">' +
      (r.ye > NOW ? '<div class="fut" style="width:' + Math.min(100, (r.ye - Math.max(NOW, r.ys)) / Math.max(0.01, r.ye - r.ys) * 100) + '%"></div>' : '') + '</div>' +
    (opt.overlap ? '<div class="ov" style="left:' + pct(opt.overlap[0]) + '%;width:' + Math.max(0.6, pct(opt.overlap[1]) - pct(opt.overlap[0])) + '%"></div>' : '') + '</div></div>').join('');
  return '<div class="gantt"><div class="axis"><div></div><div class="ticks">' + ticks + '</div></div><div style="position:relative">' + body +
    '<div style="position:absolute;left:158px;right:0;top:0;bottom:0;pointer-events:none">' + grid + '<div class="now" style="left:' + pct(CUR_YEAR + 0.85) + '%" title="' + esc(t('tl_now')) + '"></div></div></div></div><div class="ganttnote"><i></i>' + esc(t('gantt_planned')) + '</div>';
}
const rowOf = (p, did) => ({ slug: p.slug, label: L(p.title), ys: p.ys, ye: p.ye, domain: p.domain, broad: did ? !p.districts_specific.includes(did) : false, period: p.dateUnknown ? t('date_unknown') : fmtPeriodFull(p), dateUnknown: p.dateUnknown });

// ------------------------------------------------------------------ coordination
function renderSideCoord() {
  const side = $('#side');
  const subs = [['overlaps', 'sub_overlaps'], ['area', 'sub_area'], ['gaps', 'sub_gaps']];
  let h = '<div class="subtabs" role="tablist">' + subs.map(([k, l]) => '<button role="tab" data-act="sub" data-v="' + k + '" aria-current="' + (state.sub === k) + '">' + esc(t(l)) + '</button>').join('') + '</div>';
  if (state.sub === 'overlaps') h += overlapsSide();
  else if (state.sub === 'area') h += areaSide();
  else h += gapsSide();
  side.innerHTML = h;
  if (state.sub === 'gaps') bindGaps();
}
function ovFiltered() {
  const m = state.minLevel;
  return OV.filter(o => LVL[o.level] >= LVL[m]).filter(o => {
    const a = BY[o.a], b = BY[o.b]; if (!a || !b) return false;
    if (state.ovDomain && !(a.domain === state.ovDomain || b.domain === state.ovDomain)) return false;
    if (state.marz && !(a.marzSet.has(state.marz) && b.marzSet.has(state.marz))) return false;
    if (state.themes.size && !o.themes.some(x => state.themes.has(x))) return false;
    if (!state.allYears) { const [fy] = o.from.split('-').map(Number), [ty] = o.to.split('-').map(Number); if (!(fy <= state.year && ty >= state.year)) return false; }
    return true;
  });
}
function overlapsSide() {
  const list = ovFiltered();
  const h = '<div class="sect"><p class="small" style="margin:0 0 10px">' + esc(t('ov_intro')) + '</p>' +
    '<div class="grid2" style="gap:8px"><div><div class="small muted">' + esc(t('ov_min')) + '</div><select id="minlvl">' + ['high', 'medium', 'low'].map(l => '<option value="' + l + '"' + (state.minLevel === l ? ' selected' : '') + '>' + esc(t('lv_' + l)) + '</option>').join('') + '</select></div>' +
    '<div><div class="small muted">' + esc(t('legend_domain')) + '</div><select id="ovdom"><option value="">' + esc(t('all_themes')) + '</option>' + DOMAINS.map(d => '<option value="' + d + '"' + (state.ovDomain === d ? ' selected' : '') + '>' + esc(domName(d)) + '</option>').join('') + '</select></div></div>' +
    '<div class="row sb" style="margin-top:10px"><div class="small"><b>' + list.length + '</b> ' + esc(t('ov_count')) + '</div><label class="chk small"><input type="checkbox" id="allyears2"' + (state.allYears ? ' checked' : '') + '> ' + esc(t('all_years')) + '</label></div>' +
    (!state.allYears ? '<input type="range" id="year2" min="1995" max="2031" value="' + state.year + '" aria-label="' + esc(t('year')) + '"><div class="small muted">' + esc(t('active_in')) + ': <b id="yearval2">' + state.year + '</b></div>' : '') + '</div>';
  return h + '<div id="ovlist">' + ovListHtml(list) + '</div>';
}
function ovListHtml(list) {
  return list.slice(0, 120).map(o => {
    const a = BY[o.a], b = BY[o.b]; const key = o.a + '|' + o.b;
    const dn = (o.communities && o.communities.length ? o.communities.slice(0, 3).map(c => (COM[c] || {}).name || c).join(', ') + ' (' + (state.lang === 'hy' ? 'համայնք' : 'community') + ')' : o.districts.slice(0, 3).map(d => nm(DIST[d] || { name_en: d })).join(', ') + (o.districts.length > 3 ? ' +' + (o.districts.length - 3) : ''));
    return '<div class="ovcard" tabindex="0" role="button" data-act="pair" data-a="' + o.a + '" data-b="' + o.b + '" aria-selected="' + (state.pair === key) + '">' +
      '<div class="row sb">' + lvlTag(o.level) + '<span class="small muted">' + o.months + ' ' + esc(t('ov_months')) + '</span></div>' +
      '<div class="pair"><span>' + domDot(a.domain) + ' ' + esc(L(a.title)) + '</span><span class="vs">↔</span><span>' + domDot(b.domain) + ' ' + esc(L(b.title)) + '</span></div>' +
      '<div class="small muted">' + o.themes.map(c => esc(themeName(c))).join(', ') + ' · ' + esc(dn) + '</div></div>';
  }).join('') || '<div class="pad muted">' + esc(t('no_results')) + '</div>';
}
function selectPair(a, b) {
  const o = OV.find(x => (x.a === a && x.b === b) || (x.a === b && x.b === a)); if (!o) return;
  const A = BY[o.a], B = BY[o.b]; state.pair = o.a + '|' + o.b; state.sel = null; state.area = null;
  setHighlight(o.districts, o.communities); updateMap(); fitIds(o.districts);
  const basis = o.basis === 'community' ? 'ov_basis_community' : o.basis === 'specific' ? 'ov_basis_specific' : o.basis === 'mixed' ? 'ov_basis_mixed' : 'ov_basis_marz';
  const [fy, fm] = o.from.split('-').map(Number), [ty, tm] = o.to.split('-').map(Number);
  const ovr = [fy + (fm - 1) / 12, ty + tm / 12];
  const card = p => '<div class="panel" style="margin:8px 0;padding:10px 12px"><div style="font-weight:650"><button class="linkbtn" style="font-size:14px;font-weight:650;text-align:left" data-act="open" data-v="' + p.slug + '">' + domDot(p.domain) + ' ' + esc(L(p.title)) + '</button></div>' +
    '<div class="small muted">' + esc(p.donors.join(', ')) + ' → ' + esc((p.implementers.slice(0, 2).join(', ') + (p.implementers.length > 2 ? ' +' + (p.implementers.length - 2) : '')) || '—') + '</div><div class="small">' + esc(fmtPeriodFull(p)) + ' · ' + esc(fmtMoney(p)) + '</div><div class="small muted">' + esc(placeText(p)) + '</div></div>';
  const dr = drawer(); dr.hidden = false;
  dr.innerHTML = '<button class="xbtn" data-act="close" aria-label="' + esc(t('close')) + '">×</button>' +
    '<div class="drawer-head"><h2 style="font-size:16px">' + lvlTag(o.level) + ' ' + esc(t('ov_why')) + '</h2></div>' +
    '<div class="sect">' + card(A) + card(B) + '</div>' +
    '<div class="sect"><h3>' + esc(t('ov_time')) + '</h3>' + ganttHtml([rowOf(A), rowOf(B)], { overlap: ovr, minY: ovr[0] - 1, maxY: ovr[1] + 1 }) +
    '<div class="small muted" style="margin-top:6px">' + esc(o.from) + ' → ' + esc(o.to) + ' · ' + o.months + ' ' + esc(t('ov_months')) + '</div></div>' +
    '<div class="sect"><dl class="facts"><dt>' + esc(t('ov_same_themes')) + '</dt><dd>' + o.themes.map(c => esc(themeName(c))).join(', ') + '</dd>' +
    '<dt>' + esc(t('ov_space')) + '</dt><dd>' + (o.communities && o.communities.length ? '<b>' + o.communities.map(c => esc((COM[c] || {}).name || c)).join(', ') + '</b><br>' : '') + o.districts.map(d => esc(nm(DIST[d] || { name_en: d }))).join(', ') + '<div class="small muted">' + esc(t(basis)) + '</div></dd>' +
    '<dt>' + esc(t('donor')) + '</dt><dd>' + esc(t(o.same_donor ? 'ov_same_donor' : 'ov_diff_donor')) + '</dd>' +
    (o.known_complementary ? '<dt></dt><dd><span class="tag">' + esc(t('ov_compl')) + '</span></dd>' : '') + '</dl></div>' +
    '<div class="sect"><h3>' + esc(t('ov_how')) + '</h3><p class="small muted">' + esc(t('ov_how_txt')) + '</p></div>';
  dr.scrollTop = 0;
  $$('.ovcard').forEach(e => e.setAttribute('aria-selected', (e.dataset.a === o.a && e.dataset.b === o.b) ? 'true' : 'false'));
}
function areaSide() {
  const opts = Object.values(MARZ).sort((a, b) => a.name_en.localeCompare(b.name_en)).map(m => '<optgroup label="' + esc(nm(m)) + '">' +
    Object.values(DIST).filter(d => d.marz_id === m.id).sort((a, b) => a.name_en.localeCompare(b.name_en)).map(d => '<option value="' + d.id + '"' + (state.area === d.id ? ' selected' : '') + '>' + esc(nm(d)) + '</option>').join('') + '</optgroup>').join('');
  let h = '<div class="sect"><select id="areasel"><option value="">' + esc(t('pick_area')) + '</option>' + opts + '</select>' +
    '<div class="row sb" style="margin-top:8px"><label class="chk small"><input type="checkbox" id="allyears2"' + (state.allYears ? ' checked' : '') + '> ' + esc(t('all_years')) + '</label></div></div>';
  if (!state.area) return h + '<div class="pad muted">' + esc(t('pick_area')) + '</div>';
  const did = state.area; const list = P.filter(p => passes(p, { ignoreYear: true }) && (p.districts_specific.includes(did) || p.districts_broad.includes(did))).sort((a, b) => a.ys - b.ys);
  const ovs = OV.filter(o => LVL[o.level] >= 2 && o.districts.includes(did));
  h += '<div class="sect"><h3>' + esc(nm(DIST[did])) + ' — ' + esc(t('area_projects')) + ' · ' + list.length + '</h3>' + (list.length ? ganttHtml(list.map(p => rowOf(p, did))) + '<div class="small muted" style="margin-top:6px">' + esc(t('gantt_hint')) + '. ' + esc(t('area_marzlevel')) + ': ' + esc(state.lang === 'hy' ? 'թափանցիկ գծեր' : 'faded bars') + '</div>' : '<p class="muted">' + esc(t('area_none')) + '</p>') + '</div>';
  if (ovs.length) h += '<div class="sect"><h3>' + esc(t('area_overlaps')) + ' · ' + ovs.length + '</h3></div>' + ovListHtml(ovs);
  return h;
}
function gapsSide() {
  const themeOpts = [['dom:land', domName('land')], ['dom:water', domName('water')], ['dom:climate', domName('climate')], ['dom:other', domName('other')]].concat(THEME_ORDER.map(c => ['th:' + c, themeName(c)]));
  const indOpts = Object.keys(IND_FIELDS).filter(k => Object.values(IND).some(v => v && v[IND_FIELDS[k]] != null));
  return '<div class="sect"><p class="small" style="margin:0 0 10px">' + esc(t('gap_intro')) + '</p>' +
    '<div class="small muted">' + esc(t('gap_theme')) + '</div><select id="gaptheme">' + themeOpts.map(([v, l]) => '<option value="' + v + '"' + (state.gapTheme === v ? ' selected' : '') + '>' + esc(l) + '</option>').join('') + '</select>' +
    '<div class="small muted" style="margin-top:8px">' + esc(t('gap_ind')) + '</div><select id="gapind">' + indOpts.map(k => '<option value="' + IND_FIELDS[k] + '"' + (state.gapInd === IND_FIELDS[k] ? ' selected' : '') + '>' + esc(t(k)) + '</option>').join('') + '</select>' +
    '<label class="chk small" style="margin-top:8px"><input type="checkbox" id="allyears2"' + (state.allYears ? ' checked' : '') + '> ' + esc(t('all_years')) + '</label>' +
    (!state.allYears ? '<input type="range" id="year2" min="1995" max="2031" value="' + state.year + '" aria-label="' + esc(t('year')) + '"><div class="small muted">' + esc(t('active_in')) + ': <b id="yearval2">' + state.year + '</b></div>' : '') + '</div>' +
    '<div id="gapbody"></div>';
}
function gapData() {
  const g = state.gapTheme; const match = p => g.startsWith('dom:') ? p.themes.some(c => D.meta.themes[c] === g.slice(4)) : p.themes.includes(g.slice(3));
  const cnt = {}; Object.keys(DIST).forEach(i => cnt[i] = { spec: 0, broad: 0 });
  P.filter(p => match(p) && (state.allYears || activeIn(p, state.year)) && (!state.status.size || state.status.has(p.eff))).forEach(p => {
    p.districts_specific.forEach(d => cnt[d] && cnt[d].spec++);
    p.districts_broad.forEach(d => cnt[d] && !p.districts_specific.includes(d) && cnt[d].broad++);
  });
  return Object.keys(DIST).map(i => ({ id: i, need: IND[i] ? IND[i][state.gapInd] : null, spec: cnt[i].spec, broad: cnt[i].broad, n: cnt[i].spec })).filter(r => r.need != null);
}
function bindGaps() { renderGapBody(); }
function renderGapBody() {
  const el = $('#gapbody'); if (!el) return; const rows = gapData(); if (!rows.length) { el.innerHTML = '<div class="pad muted">—</div>'; return; }
  const W = 360, H = 300, m = { l: 36, r: 10, t: 12, b: 34 };
  const mx = Math.max.apply(null, rows.map(r => r.need)) * 1.05 || 1, my = Math.max(3, Math.max.apply(null, rows.map(r => r.n))) + 1;
  const X = v => m.l + Math.sqrt(Math.max(0, v) / mx) * (W - m.l - m.r), Y = v => H - m.b - v / my * (H - m.t - m.b);
  const sortedNeed = rows.map(r => r.need).sort((a, b) => a - b), hi = sortedNeed[Math.floor(sortedNeed.length * 0.66)];
  let svg = '<svg class="scatter" viewBox="0 0 ' + W + ' ' + H + '" width="100%" role="img" aria-label="' + esc(t('sub_gaps')) + '">';
  svg += '<rect class="quad" x="' + X(hi) + '" y="' + Y(0.5) + '" width="' + (W - m.r - X(hi)) + '" height="' + (H - m.b - Y(0.5)) + '"/>';
  for (let k = 0; k <= my; k += Math.max(1, Math.ceil(my / 5))) svg += '<line class="gridl" x1="' + m.l + '" x2="' + (W - m.r) + '" y1="' + Y(k) + '" y2="' + Y(k) + '"/><text x="' + (m.l - 6) + '" y="' + (Y(k) + 3) + '" text-anchor="end">' + k + '</text>';
  for (let k = 0; k <= 4; k++) { const v = mx * Math.pow(k / 4, 2); svg += '<text x="' + X(v) + '" y="' + (H - m.b + 14) + '" text-anchor="middle">' + esc(fmtN(v)) + '</text>'; }
  svg += '<line class="axisl" x1="' + m.l + '" x2="' + (W - m.r) + '" y1="' + Y(0) + '" y2="' + Y(0) + '"/><line class="axisl" x1="' + m.l + '" x2="' + m.l + '" y1="' + m.t + '" y2="' + Y(0) + '"/>';
  svg += '<text x="' + (W / 2) + '" y="' + (H - 4) + '" text-anchor="middle">' + esc(t('gap_x')) + (state.lang === 'hy' ? ' (քառակուսի արմատով սանդղակ)' : ' (square-root scale)') + '</text><text transform="translate(10 ' + (H / 2) + ') rotate(-90)" text-anchor="middle">' + esc(t('gap_y')) + '</text>';
  rows.forEach(r => { svg += '<circle class="pt' + (state.area === r.id ? ' sel' : '') + '" cx="' + X(r.need) + '" cy="' + (Y(r.n) - (r.id.charCodeAt(r.id.length - 1) % 3) * 0) + '" r="5" data-act="area" data-v="' + r.id + '" data-tip="' + esc(nm(DIST[r.id]) + ' · ' + fmtN(r.need) + ' · ' + r.spec + '+' + r.broad) + '"/>'; });
  const lab = rows.filter(r => r.n === 0).sort((a, b) => b.need - a.need).slice(0, 5);
  lab.forEach(r => { svg += '<text x="' + (X(r.need) + 8) + '" y="' + (Y(0) - 8 - (lab.indexOf(r) % 2) * 11) + '">' + esc(nm(DIST[r.id])) + '</text>'; });
  svg += '</svg>';
  const gaps = rows.filter(r => r.n === 0).sort((a, b) => b.need - a.need).slice(0, 8);
  el.innerHTML = '<div class="sect">' + svg + '</div><div class="sect"><h3>' + esc(t('gap_nopro')) + '</h3>' + (gaps.length ? '<table class="t"><tbody>' + gaps.map(r => '<tr data-act="area" data-v="' + r.id + '" style="cursor:pointer"><td>' + esc(nm(DIST[r.id])) + ' <span class="muted small">' + esc(nm(MARZ[DIST[r.id].marz_id] || { name_en: DIST[r.id].marz_en })) + '</span>' + (r.broad ? '<div class="small muted">+' + r.broad + ' ' + esc(t('possible')) + '</div>' : '') + '</td><td style="text-align:right">' + esc(fmtN(r.need)) + '</td></tr>').join('') + '</tbody></table>' : '<p class="muted small">—</p>') +
    '<p class="small muted" style="margin-top:10px">' + esc(t('gap_caveat')) + '</p></div>';
  // map: colour by the chosen indicator and mark gap districts
  const k = Object.keys(IND_FIELDS).find(x => IND_FIELDS[x] === state.gapInd); if (k && state.colorBy !== k) { state.colorBy = k; updateMap(); }
  setHighlight(gaps.map(r => r.id));
}

// ------------------------------------------------------------------ pages
function openPage(html, cls) { const pg = $('#page'); pg.hidden = false; pg.innerHTML = html; pg.scrollTop = 0; document.body.dataset.page = cls || ''; }
function closePage() { const pg = $('#page'); pg.hidden = true; pg.innerHTML = ''; if (miniMap) { miniMap.remove(); miniMap = null; } document.body.dataset.page = ''; }
let miniMap = null;
function projectPage(slug) {
  const p = BY[slug]; if (!p) return;
  const rel = (pairsOf[slug] || []).slice().sort((a, b) => b.score - a.score);
  const act = Larr(p.activities), res = Larr(p.results);
  const ids = []; const I = p.ids || {};
  ['wb', 'gef', 'gcf'].forEach(k => I[k] && ids.push(k.toUpperCase() + ': ' + I[k])); (I.iati || []).slice(0, 6).forEach(x => ids.push('IATI: ' + x)); (I.other || []).forEach(x => ids.push(x));
  const html = '<div class="pagewrap"><div class="pagetop"><button class="btn" data-act="closepage">' + esc(t('back')) + '</button><button class="btn" onclick="window.print()">' + esc(t('print')) + '</button></div>' +
    '<div class="eb">' + esc(p.donors.slice(0, 3).join(' · ')) + '</div><h2 class="pt">' + esc(L(p.title)) + '</h2><div style="margin:6px 0 14px">' + stTag(p.eff) + themeTags(p) + '</div>' + trNotice(p) +
    '<div class="grid2"><div>' + (p.eff === 'pipeline' ? '<div style="margin:14px 0">' + planBlock(p) + '</div>' : '') + '<div class="panel">' + factsHtml(p) + '</div>' +
    '<div class="panel"><h3 style="margin-top:0">' + esc(t('summary')) + '</h3><p>' + esc(L(p.summary) || '—') + '</p></div>' +
    (act.length && p.eff !== 'pipeline' ? '<div class="panel"><h3 style="margin-top:0">' + esc(t('activities')) + '</h3><ul class="bul">' + act.map(x => '<li>' + esc(x) + '</li>').join('') + '</ul></div>' : '') +
    (res.length && p.eff !== 'pipeline' ? '<div class="panel"><h3 style="margin-top:0">' + esc(t('results_h')) + '</h3><ul class="bul">' + res.map(x => '<li>' + esc(x) + '</li>').join('') + '</ul></div>' : '') +
    (p.data_products && p.data_products.length ? '<div class="panel"><h3 style="margin-top:0">' + esc(t('data_products')) + '</h3><ul class="bul">' + p.data_products.map(x => '<li><b>' + esc(x.name) + '</b> <span class="tag">' + esc(x.kind || '') + '</span>' + (x.note ? '<div class="small muted">' + esc(x.note) + '</div>' : '') + '</li>').join('') + '</ul></div>' : '') +
    '</div><div>' +
    '<div class="panel"><h3 style="margin-top:0">' + esc(t('where')) + '</h3>' + (p.is_national ? '<p>' + esc(t(p.loc_unknown ? 'pr_unknown' : 'pr_national')) + '</p>' : '<div id="miniMap" class="miniMap"></div>') +
    '<table class="t" style="margin-top:10px"><thead><tr><th>' + esc(t('where')) + '</th><th>' + esc(t('precision')) + '</th></tr></thead><tbody>' +
    p.locations.map(l => { const mz = l.marz && MARZ_BY_EN[l.marz] ? nm(MARZ_BY_EN[l.marz]) : (l.marz || ''); const dn = (l.district_ids || []).length === 1 && l.precision !== 'marz' ? nm(DIST[l.district_ids[0]] || {}) : '';
      return '<tr><td><b>' + esc(l.precision === 'national' ? t('pr_national') : mz) + '</b>' + (dn || l.community || (l.settlements || []).length || (l.community_names || []).length ? '<div>' + esc([dn, (l.community_names || []).length ? (state.lang === 'hy' ? 'համայնք՝ ' : 'community: ') + l.community_names.join(', ') : '', l.community, (l.settlements || []).join(', ')].filter(Boolean).join(' · ')) + '</div>' : '') + (l.evidence ? '<div class="small muted">' + esc(l.evidence) + '</div>' : '') + '</td><td><span class="prec">' + esc(t('pr_' + l.precision)) + '</span></td></tr>'; }).join('') + '</tbody></table></div>' +
    (rel.length ? '<div class="panel"><h3 style="margin-top:0">' + esc(t('related')) + ' · ' + rel.length + '</h3><table class="t"><tbody>' + rel.slice(0, 12).map(o => { const q = BY[o.a === slug ? o.b : o.a]; return '<tr><td>' + lvlTag(o.level) + '</td><td><button class="linkbtn" data-act="page" data-v="' + q.slug + '">' + esc(L(q.title)) + '</button><div class="small muted">' + esc(o.themes.map(themeName).join(', ')) + ' · ' + o.months + ' ' + esc(t('ov_months')) + '</div></td><td><button class="linkbtn" data-act="pair" data-a="' + o.a + '" data-b="' + o.b + '">→</button></td></tr>'; }).join('') + '</tbody></table></div>' : '') +
    (p.eff === 'pipeline' && !p.is_national ? '<div class="panel">' + hereBlock(p) + '</div>' : '') +
    '<div class="panel"><h3 style="margin-top:0">' + esc(t('sources')) + '</h3>' + ((p.sources || []).length ? '<ul class="bul">' + p.sources.map(s => '<li><a href="' + esc(s.url) + '" target="_blank" rel="noopener">' + esc(s.title || s.url) + '</a></li>').join('') + '</ul>' : '<p class="muted">—</p>') +
    '<div class="small muted" style="margin-top:8px">' + esc(t('confidence')) + ': <b>' + esc(t('conf_' + p.confidence)) + '</b>' + (ids.length ? '<br>' + esc(t('ids')) + ': ' + esc(ids.join(' · ')) : '') + '</div>' +
    (p.notes ? '<div class="notice" style="margin-top:8px"><b>' + esc(t('notes')) + ':</b> ' + esc(p.notes) + '</div>' : '') + '</div>' +
    '</div></div></div>';
  openPage(html, 'project');
  if (!p.is_national) {
    const ids2 = p.allDist; const el = $('#miniMap');
    if (el) {
      miniMap = new maplibregl.Map({ container: el, style: blankStyle(), bounds: bboxOf(ids2) || ARM_BOUNDS, fitBoundsOptions: { padding: 24, maxZoom: 9 }, interactive: false, attributionControl: false });
      miniMap.on('load', () => {
        miniMap.addSource('d', { type: 'geojson', data: D.districts }); miniMap.addSource('m', { type: 'geojson', data: D.marzes });
        miniMap.addLayer({ id: 'all', type: 'fill', source: 'd', paint: { 'fill-color': '#f9f8f4', 'fill-opacity': 1 } });
        miniMap.addLayer({ id: 'broad', type: 'fill', source: 'd', filter: ['in', ['get', 'id'], ['literal', p.districts_broad]], paint: { 'fill-color': DOM_COLOR[p.domain], 'fill-opacity': 0.18 } });
        miniMap.addLayer({ id: 'spec', type: 'fill', source: 'd', filter: ['in', ['get', 'id'], ['literal', p.districts_specific]], paint: { 'fill-color': DOM_COLOR[p.domain], 'fill-opacity': 0.55 } });
        miniMap.addLayer({ id: 'dl', type: 'line', source: 'd', paint: { 'line-color': '#9aa3a2', 'line-width': 0.6 } });
        miniMap.addLayer({ id: 'ml', type: 'line', source: 'm', paint: { 'line-color': '#14201f', 'line-width': 1.4 } });
        const pts = []; p.locations.forEach(l => { if (l.lat != null && l.lon != null) pts.push({ type: 'Feature', geometry: { type: 'Point', coordinates: [l.lon, l.lat] }, properties: {} }); });
        if (pts.length) { miniMap.addSource('p', { type: 'geojson', data: { type: 'FeatureCollection', features: pts } }); miniMap.addLayer({ id: 'pp', type: 'circle', source: 'p', paint: { 'circle-radius': 5, 'circle-color': '#14201f', 'circle-stroke-color': '#fff', 'circle-stroke-width': 1.5 } }); }
      });
    }
  }
}
const catName = c => (I18N[state.lang] && I18N[state.lang]['cat_' + String(c).replace(/-/g, '_')]) || c;
function dataPage() {
  const layers = D.layers || [];
  const cats = ['all'].concat(Array.from(new Set(layers.map(l => l.category).filter(Boolean))).sort());
  const shown = layers.filter(l => (state.dataCat === 'all' || l.category === state.dataCat) && (!state.dataOpen || l.open_access === true));
  const accTxt = l => l.open_access === true ? '<span class="acc-ok">✓ ' + esc(t('d_open')) + '</span>' : l.open_access === false ? '<span class="acc-no">● ' + esc(t('d_closed')) + '</span>' : '<span class="muted">? ' + esc(t('d_unknown')) + '</span>';
  const comp = Object.keys(IND_META).length ? '<div class="panel"><h3 style="margin-top:0">' + esc(t('d_computed')) + '</h3><p class="small">' + esc(t('d_computed_txt')) + '</p><ul class="bul small">' +
    Object.values(IND_META).map(m => '<li><a href="' + esc(m.url) + '" target="_blank" rel="noopener">' + esc(m.name) + '</a> · ' + esc(m.license) + (m.period ? ' · ' + esc(m.period) : '') + '<div class="muted">' + esc(m.method) + '</div></li>').join('') + '</ul></div>' : '';
  const html = '<div class="pagewrap"><div class="eb">' + esc(t('tab_data')) + '</div><h2>' + esc(t('data_title')) + '</h2><p class="muted">' + esc(t('data_intro')) + '</p>' + (state.lang === 'hy' ? '<p class="small muted">Նկարագրությունները անգլերեն են՝ աղբյուրների տերմինները չխեղաթյուրելու համար։</p>' : '') + comp +
    '<div class="row" style="gap:12px;margin:14px 0;flex-wrap:wrap"><label class="small muted">' + esc(t('d_cat')) + ' <select id="datacat" style="width:auto;margin-left:6px">' + cats.map(c => '<option value="' + c + '"' + (state.dataCat === c ? ' selected' : '') + '>' + esc(c === 'all' ? t('d_all') : catName(c)) + '</option>').join('') + '</select></label>' +
    '<label class="chk small"><input type="checkbox" id="dataopen"' + (state.dataOpen ? ' checked' : '') + '> ' + esc(t('d_open')) + '</label><span class="small muted">' + shown.length + ' / ' + layers.length + '</span></div>' +
    (layers.length ? '<div class="grid2">' + shown.map(l => '<div class="layercard"><div class="small muted">' + esc(catName(l.category || '')) + '</div><h4>' + esc(l.name_en) + '</h4><div class="small" style="margin-bottom:6px">' + accTxt(l) + '</div><p class="small">' + esc(l.description_en || '') + '</p>' +
      '<dl class="facts small" style="grid-template-columns:136px 1fr"><dt>' + esc(t('d_producer')) + '</dt><dd>' + esc(l.producer || '—') + '</dd><dt>' + esc(t('d_period')) + '</dt><dd>' + esc(l.year_or_period || '—') + '</dd><dt>' + esc(t('d_cov')) + '</dt><dd>' + esc(l.coverage || '—') + '</dd><dt>' + esc(t('d_res')) + '</dt><dd>' + esc(l.resolution || '—') + '</dd><dt>' + esc(t('d_lic')) + '</dt><dd>' + esc(l.license || '—') + '</dd>' +
      (l.gap_or_issue ? '<dt>' + esc(t('d_gap')) + '</dt><dd>' + esc(l.gap_or_issue) + '</dd>' : '') + (l.usable_for ? '<dt>' + esc(t('d_use')) + '</dt><dd>' + esc(l.usable_for) + '</dd>' : '') + '</dl>' +
      '<div class="small" style="margin-top:8px">' + (l.access_url ? '<a href="' + esc(l.access_url) + '" target="_blank" rel="noopener">' + esc(t('d_access')) + ' ↗</a>' : '') + (l.direct_download_or_service ? ' · <a href="' + esc(/^https?:/.test(l.direct_download_or_service) ? l.direct_download_or_service : (l.access_url || '#')) + '" target="_blank" rel="noopener">' + esc(t('d_direct')) + '</a>' : '') + '</div></div>').join('') + '</div>' : '<div class="panel muted">—</div>') + '</div>';
  openPage(html, 'data');
}
function aboutPage() {
  const nProj = P.length, nLoc = P.filter(p => !p.is_national).length, nHi = P.filter(p => p.confidence === 'high').length;
  const donors = new Set(); P.forEach(p => p.donorsN.forEach(d => { if (d !== 'Co-financiers' && d !== 'Local co-funding') donors.add(d); }));
  const hy = state.lang === 'hy';
  const kp = '<div class="kpis"><div class="kpi"><b>' + nProj + '</b><span>' + (hy ? 'ծրագիր բազայում' : 'programmes in the database') + '</span></div><div class="kpi"><b>' + donors.size + '</b><span>' + (hy ? 'դոնոր / ֆինանսավորող' : 'donors / funders') + '</span></div><div class="kpi"><b>' + nLoc + '</b><span>' + (hy ? 'տեղային (ոչ ազգային)' : 'with a place (not nationwide)') + '</span></div><div class="kpi"><b>' + OV.filter(o => o.level !== 'low').length + '</b><span>' + (hy ? 'հնարավոր համընկնում' : 'possible overlaps flagged') + '</span></div></div>';
  const body = hy ? `
    <h3>Ինչի համար է սա</h3><p>Երբ նույն համայնքում տարբեր դոնորներ իրականացնում են նույն տիպի աշխատանք, պետությունը դա հաճախ իմանում է արդեն կատարվելուց հետո։ Այս հարթակը մեկ քարտեզի վրա հավաքում է ծրագրերը, դրանց վայրերը և քարտեզագրված տվյալները, որպեսզի <b>համընկնումները երևան նախքան ծրագիրը սկսելը</b>։</p>
    <h3>Սա դեմո է, ոչ թե վերջնական համակարգ</h3><p>Այստեղ ցուցադրված ծրագրերը իրական են (աղբյուրները նշված են յուրաքանչյուր ծրագրի էջում), բայց ցանկը <b>ամբողջական չէ</b>, և դեմոյի նպատակն է ցույց տալ գաղափարը իրական տվյալների վրա։</p>
    <h3>Տվյալների աղբյուրներ</h3><ul class="bul"><li>IATI բաց տվյալներ (d-portal) — ծրագրերի անուններ, ժամկետներ, գումարներ դոնորների կողմից հրապարակված</li><li>Համաշխարհային բանկի ծրագրերի բաց API</li><li>Ծրագրերի իրենց փաստաթղթերը և դոնորների էջերը (GEF, GCF, FAO, UNDP, ԵՄ, KfW/GIZ և այլն) — <b>տեղերը վերցված են հենց այստեղից</b></li><li>Վարչական սահմաններ՝ OCHA COD-AB (11 մարզ, 39 շրջան), համայնքներ՝ 2008 թ. բաց բազմանկյուններ (AUA Acopian կենտրոն, Open Data Armenia)</li><li>Համատեքստային ցուցիչներ՝ ESA WorldCover 2021, Hansen Global Forest Change</li></ul>
    <h3>Ինչպես են նշվում համընկնումները</h3><p>Երկու ծրագիր նշվում են, եթե ունեն ընդհանուր թեմա (ընդհանուր «գյուղական զարգացում» պիտակը հաշվի չի առնվում), ժամկետները համընկնում են առնվազն 6 ամիս և ունեն ընդհանուր տարածք՝ համայնք, շրջան կամ մարզ։ Գնահատականը ավելանում է ընդհանուր թեմաներով, համընկնման երկարությամբ և տեղի ճշգրտությամբ, իսկ նույն դոնորի ծրագրերի համար՝ նվազում։ <b>Սա ազդանշան է համակարգման համար, ոչ թե կրկնության ապացույց</b>. շատ դեպքերում ծրագրերը լրացնում են իրար։</p>
    <h3>Հայտնի սահմանափակումներ</h3><ul class="bul"><li><b>Համայնքային մակարդակը մասնակի է։</b> Ներկայիս (միավորված) համայնքների պաշտոնական սահմանները բաց տվյալներում չկան։ Օգտագործվել են 2008 թ. 913 համայնքների բաց բազմանկյունները (հին կառուցվածք, լիցենզիան նշված չէ). այն ծրագրերի համար, որոնց բնակավայրերը հայտնի են, վայրը համընկնում է այդ համայնքի հետ։ Մնացածը հաշվվում է շրջանի կամ մարզի մակարդակով։ Համայնքների անունները ցուցադրվում են լատինատառ։ Իրական համակարգը պետք է օգտագործի Կադաստրի կոմիտեի ընթացիկ սահմանները։</li><li><b>Տեղերի ճշգրտությունը տարբեր է։</b> Շատ ծրագրեր հրապարակում են միայն մարզը կամ ոչինչ։ Նրանք նշված են քարտեզի վրա օղակով (մոտավոր)։</li><li><b>Գումարները համադրելի չեն։</b> Տարբեր արժույթներ, վարկ/դրամաշնորհ, համաֆինանսավորում։ Դրանք չպետք է գումարվեն։</li><li><b>Հայերեն տեքստերը մեքենայական թարգմանություն են</b> և կարիք ունեն ստուգման։</li><li><b>Ցուցիչները ցուցիչային են</b>, դրանք ԼԴՉ-ի պաշտոնական ցուցանիշներ չեն։</li></ul>
    <h3>Իրական համակարգի համար անհրաժեշտ է</h3><ul class="bul"><li>Նախարարությունների և դոնորների կողմից ծրագրերի պարտադիր/կանոնավոր գրանցում (մուտքագրման պորտալ)</li><li>Համայնքների պաշտոնական սահմաններ և կոդեր</li><li>Ծրագրերի իրական վայրեր (կոորդինատներ կամ համայնք/բնակավայր)</li><li>Ստուգման և թարմացման կարգ (ով, ինչ հաճախականությամբ)</li><li>Նոր ծրագրի ձևակերպման ժամանակ ավտոմատ «այս համայնքում արդեն կա» ստուգում</li></ul>` : `
    <h3>What this is for</h3><p>When several donors run the same type of work in the same community, government usually learns about it after the fact. This platform puts programmes, their places and mapped data on one map so that <b>overlaps become visible before a programme starts</b>.</p>
    <h3>This is a demo, not the final system</h3><p>The programmes shown are real (sources are on each programme page), but the list is <b>not exhaustive</b>. The demo’s purpose is to show the idea on real data.</p>
    <h3>Data sources</h3><ul class="bul"><li>IATI open data (d-portal) — programme names, dates, amounts published by donors</li><li>World Bank open projects API</li><li>The programmes’ own documents and donor pages (GEF, GCF, FAO, UNDP, EU, KfW/GIZ…) — <b>locations come from here</b></li><li>Administrative boundaries: OCHA COD-AB (11 marzes, 39 districts); communities: open 2008 polygons (AUA Acopian Center, Open Data Armenia)</li><li>Context indicators: ESA WorldCover 2021, Hansen Global Forest Change</li></ul>
    <h3>How overlaps are flagged</h3><p>Two programmes are flagged when they share a theme (the generic “rural development” tag does not count), their dates overlap by at least 6 months, and they share an area: a community, a district or a marz. The score rises with shared themes, length of overlap and location precision, and is reduced for the same donor. <b>This is a prompt for coordination, not proof of duplication</b> — many programmes are complementary.</p>
    <h3>Known limitations</h3><ul class="bul"><li><b>Community level is partial.</b> Official boundaries of the current (consolidated) communities are not in open data. The open 2008 polygons of 913 communities (old structure, licence not specified) are used: where a programme’s settlements are known, its location is matched to that community. Everything else is computed at district or marz level. Community names are shown in Latin script. A live system should use the Cadastre Committee’s current boundaries.</li><li><b>Location precision varies.</b> Many programmes publish only the marz, or nothing. They appear as rings on the map (approximate).</li><li><b>Amounts are not comparable.</b> Different currencies, loans vs grants, co-financing. Do not add them up.</li><li><b>Armenian texts are machine translations</b> and need review.</li><li><b>Indicators are indicative</b>, not official LDN indicators.</li></ul>
    <h3>What a live system needs</h3><ul class="bul"><li>Mandatory / regular programme registration by ministries and donors (an entry portal)</li><li>Official community boundaries and codes</li><li>Real programme locations (coordinates or community / settlement)</li><li>A verification and update routine (who, how often)</li><li>An automatic “already in this community” check when a new programme is designed</li></ul>`;
  openPage('<div class="pagewrap"><div class="eb">' + esc(t('tab_about')) + '</div><h2>' + esc(t('about_title')) + '</h2>' + kp + '<div class="panel">' + body + '</div><div class="small muted">Data build: ' + esc(D.meta.built) + ' · ' + nProj + ' programmes · ' + OV.length + ' pairs · ' + (D.layers || []).length + ' datasets</div></div>', 'about');
}

// ------------------------------------------------------------------ routing + events
function setTab(tab) {
  state.tab = tab; closePageSoft(); if (!drawer().hidden) closeDrawer();
  $$('#tabs button').forEach(b => b.setAttribute('aria-current', b.dataset.tab === tab ? 'page' : 'false'));
  if (tab === 'map') { state.pair = null; renderSideMap(); $('#side').hidden = false; setHighlight(state.sel ? BY[state.sel].allDist : [], state.sel ? BY[state.sel].communities_specific : []); updateMap(); }
  else if (tab === 'coord') { $('#side').hidden = false; renderSideCoord(); setHighlight([]); updateMap(); }
  else if (tab === 'data') dataPage();
  else if (tab === 'about') aboutPage();
}
function closePageSoft() { const pg = $('#page'); if (!pg.hidden) closePage(); }
function renderChrome() {
  document.documentElement.lang = state.lang;
  $('#t-title').innerHTML = esc(t('brand_a')) + '<b>' + esc(t('brand_b')) + '</b>';
  $('#t-badge').textContent = t('demo_badge');
  document.title = t('app_title');
  $('#tabs').innerHTML = [['map', 'tab_map'], ['coord', 'tab_coord'], ['data', 'tab_data'], ['about', 'tab_about']].map(([k, l]) => '<button data-tab="' + k + '" aria-current="' + (state.tab === k ? 'page' : 'false') + '">' + esc(t(l)) + '</button>').join('');
  $$('.langs button').forEach(b => b.setAttribute('aria-pressed', b.dataset.lang === state.lang));
  marzMarkers.forEach(o => o.el.textContent = nm(o.f.properties));
  cityMarkers.forEach(o => o.el.textContent = state.lang === 'hy' ? o.c.hy : o.c.en);
  renderLayerCtl();
}
function rerenderAll() {
  renderChrome(); const open = !$('#page').hidden ? document.body.dataset.page : null; const sel = state.sel, pair = state.pair, area = state.area;
  if (state.tab === 'map') renderSideMap(); else if (state.tab === 'coord') renderSideCoord();
  if (open === 'data') dataPage(); else if (open === 'about') aboutPage(); else if (open === 'project' && location.hash.startsWith('#/project/')) projectPage(decodeURIComponent(location.hash.slice(10)));
  if (sel) renderDrawerProject(BY[sel]); else if (pair) { const [a, b] = pair.split('|'); selectPair(a, b); } else if (area) selectArea(area);
  updateMap();
}
function route() {
  const h = location.hash || '#/map'; const m = h.match(/^#\/project\/(.+)$/);
  if (m) { projectPage(decodeURIComponent(m[1])); return; }
  const tab = { '#/map': 'map', '#/coord': 'coord', '#/data': 'data', '#/about': 'about' }[h] || 'map';
  const wasProject = !$('#page').hidden && document.body.dataset.page === 'project';
  if (wasProject) closePage();
  if (tab !== state.tab || !$('#side').innerHTML || (wasProject && (tab === 'data' || tab === 'about'))) setTab(tab);
}
document.addEventListener('click', e => {
  const el = e.target.closest('[data-act],[data-tab],[data-lang]'); if (!el) return;
  if (el.dataset.lang) { state.lang = el.dataset.lang; safeStore.set('icp_lang', state.lang); rerenderAll(); return; }
  if (el.dataset.tab) { location.hash = '#/' + el.dataset.tab; return; }
  const act = el.dataset.act, v = el.dataset.v;
  if (act === 'theme' || act === 'status' || act === 'donor') {
    const set = act === 'theme' ? state.themes : act === 'status' ? state.status : state.donors;
    set.has(v) ? set.delete(v) : set.add(v); el.setAttribute('aria-pressed', set.has(v)); onFilterChange();
  } else if (act === 'clear') { state.themes.clear(); state.status.clear(); state.donors.clear(); state.marz = ''; state.q = ''; state.allYears = false; state.year = CUR_YEAR; onFilterChange(); renderSideMap(); }
  else if (act === 'open') { if ($('#page').hidden === false && document.body.dataset.page !== 'project') closePage(); if (!$('#page').hidden) { location.hash = '#/project/' + encodeURIComponent(v); } else { selectProject(v); } }
  else if (act === 'page') { location.hash = '#/project/' + encodeURIComponent(v); }
  else if (act === 'closepage') { location.hash = '#/' + state.tab; }
  else if (act === 'close') closeDrawer();
  else if (act === 'sub') { state.sub = v; closeDrawer(); renderSideCoord(); if (v !== 'gaps') { setHighlight([]); } else fitIds([]); }
  else if (act === 'pair') { if (!$('#page').hidden) { closePage(); location.hash = '#/coord'; } if (state.tab !== 'coord') { state.tab = 'coord'; state.sub = 'overlaps'; $$('#tabs button').forEach(b => b.setAttribute('aria-current', b.dataset.tab === 'coord' ? 'page' : 'false')); renderSideCoord(); location.hash = '#/coord'; } selectPair(el.dataset.a, el.dataset.b); }
  else if (act === 'area') { selectArea(v); if (state.tab === 'coord' && state.sub === 'gaps') { renderGapBody(); } }
});
document.addEventListener('keydown', e => { if ((e.key === 'Enter' || e.key === ' ') && e.target.matches('[role=button][data-act]')) { e.preventDefault(); e.target.click(); } if (e.key === 'Escape') { if (!$('#page').hidden && document.body.dataset.page === 'project') $('[data-act=closepage]').click(); else if (!drawer().hidden) closeDrawer(); } });
document.addEventListener('input', e => {
  const id = e.target.id;
  if (id === 'q') { state.q = e.target.value.trim(); onFilterChange(); }
  else if (id === 'year' || id === 'year2') { state.year = +e.target.value; const a = $('#yearval'), b = $('#yearval2'); if (a) a.textContent = state.year; if (b) b.textContent = state.year; _statsKey = null; if (id === 'year') { updateList(); updateMap(); } else { if (state.sub === 'overlaps') $('#ovlist').innerHTML = ovListHtml(ovFiltered()); else if (state.sub === 'gaps') renderGapBody(); updateMap(); } }
});
document.addEventListener('change', e => {
  const id = e.target.id, v = e.target.value;
  if (id === 'marz') { state.marz = v; onFilterChange(); const m = MARZ_BY_EN[v]; if (mapReady) { const ids = v ? Object.values(DIST).filter(d => d.marz_en === v).map(d => d.id) : []; fitIds(ids); } }
  else if (id === 'colorby') { state.colorBy = v; updateMap(); }
  else if (id === 'allyears') { state.allYears = e.target.checked; renderSideMap(); _statsKey = null; updateMap(); }
  else if (id === 'allyears2') { state.allYears = e.target.checked; _statsKey = null; renderSideCoord(); updateMap(); }
  else if (id === 'minlvl') { state.minLevel = v; renderSideCoord(); }
  else if (id === 'ovdom') { state.ovDomain = v; renderSideCoord(); }
  else if (id === 'areasel') { if (v) { selectArea(v); fitIds([v]); } }
  else if (id === 'gaptheme') { state.gapTheme = v; renderGapBody(); }
  else if (id === 'gapind') { state.gapInd = v; renderGapBody(); }
  else if (id === 'datacat') { state.dataCat = v; dataPage(); }
  else if (id === 'dataopen') { state.dataOpen = e.target.checked; dataPage(); }
});
document.addEventListener('mousemove', e => { const el = e.target.closest && e.target.closest('[data-tip]'); if (el) tip(e, esc(el.dataset.tip)); else if (!e.target.closest('#map')) hideTip(); });
window.addEventListener('hashchange', route);

// ------------------------------------------------------------------ boot
renderChrome();
route();
initMap();
window.ICP = { state, D, P, BY, OV, t, L, nm, esc, DOM_COLOR, DOMAINS, MARZ, DIST, COM, LVL, setTab, selectProject, selectPair, selectArea, closeDrawer, closePage, fitIds,
  onFilterChange, renderSideMap, renderSideCoord, normDonor, domName, themeName, route, get map() { return map; }, get mapReady() { return mapReady; }, rerender: () => rerenderAll() };
window.__icp = window.ICP;
})();
