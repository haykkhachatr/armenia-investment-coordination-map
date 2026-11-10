/* Map layers: built-in vector layers (point / line / polygon) + "add your own file" (shapefile .zip, GeoJSON, loose .shp+.dbf+.prj),
   attach a file to a programme, remember uploads in this browser (IndexedDB). Uses window.ICP from app.js. */
(function () {
'use strict';
const X = window.ICP; if (!X) return;
const { state, P, BY, esc } = X;
const $ = (s, el) => (el || document).querySelector(s);
const $$ = (s, el) => Array.from((el || document).querySelectorAll(s));

const TX = {
  hy: {
    layers: 'Շերտեր', builtin: 'Հիմնական շերտեր', mine: 'Քո շերտերը', none: 'Դեռ չկան', close: 'Փակել',
    add: 'Ավելացնել ֆայլ', hint: 'Քարշ տուր քարտեզի վրա՝ .zip շեյփֆայլ, .geojson, կամ ընտրիր միասին .shp + .dbf + .prj։ Կետ, գիծ և պոլիգոն՝ ցանկացած։',
    drop: 'Բաց թող ֆայլը՝ շերտ ավելացնելու համար', attach: 'Կցել ծրագրին', noattach: '— չկցված —', zoom: 'Մոտեցնել', remove: 'Հեռացնել', download: 'GeoJSON', opacity: 'Թափանցիկ',
    feats: 'օբյեկտ', pt: 'կետ', ln: 'գիծ', pg: 'պոլիգոն', saved: 'Պահվում է միայն այս բրաուզերում։', loading: 'Բեռնվում է…', props: 'Հատկանիշներ',
    err: 'Չհաջողվեց կարդալ ֆայլը', err_crs: 'Կոորդինատները WGS84 (երկայնություն/լայնություն) չեն։ Ավելացրու նաև .prj ֆայլը։', err_big: 'Ֆայլը շատ մեծ է (>60 000 օբյեկտ)։', added: 'ավելացվեց',
    l_sites: 'Ծրագրերի վայրերը', l_rivers: 'Գետեր (անվանված)', l_water: 'Ջրամբարներ և լճեր', l_pa: 'Հատուկ պահպանվող տարածքներ',
    s_sites: 'Աղբյուր՝ ծրագրերի փաստաթղթերում նշված բնակավայրեր (geocoding)', s_osm: 'Աղբյուր՝ OpenStreetMap (ODbL)',
    geom_attached: 'Կցված երկրաչափություն', show: 'Ցույց տալ քարտեզի վրա', open_prog: 'Բացել ծրագիրը', place: 'Վայր', progr: 'Ծրագիր', donors: 'Դոնորներ'
  },
  en: {
    layers: 'Layers', builtin: 'Built-in layers', mine: 'Your layers', none: 'None yet', close: 'Close',
    add: 'Add a file', hint: 'Drop on the map: a .zip shapefile, .geojson, or pick .shp + .dbf + .prj together. Points, lines and polygons — any.',
    drop: 'Drop the file to add a layer', attach: 'Attach to programme', noattach: '— not attached —', zoom: 'Zoom to', remove: 'Remove', download: 'GeoJSON', opacity: 'Opacity',
    feats: 'features', pt: 'points', ln: 'lines', pg: 'polygons', saved: 'Stored in this browser only.', loading: 'Loading…', props: 'Attributes',
    err: 'Could not read the file', err_crs: 'Coordinates are not WGS84 (lon/lat). Include the .prj file too.', err_big: 'File is too large (>60,000 features).', added: 'added',
    l_sites: 'Programme sites', l_rivers: 'Rivers (named)', l_water: 'Reservoirs & lakes', l_pa: 'Protected areas',
    s_sites: 'Source: settlements named in programme documents (geocoded)', s_osm: 'Source: OpenStreetMap (ODbL)',
    geom_attached: 'Attached geometry', show: 'Show on map', open_prog: 'Open programme', place: 'Place', progr: 'Programme', donors: 'Donors'
  }
};
const t = k => (TX[state.lang] && TX[state.lang][k]) || TX.en[k] || k;
const POLY = ['match', ['geometry-type'], ['Polygon', 'MultiPolygon'], true, false];
const NOTPT = ['match', ['geometry-type'], ['Point', 'MultiPoint'], false, true];
const PT = ['match', ['geometry-type'], ['Point', 'MultiPoint'], true, false];
const PALETTE = ['#7a3cff', '#00a6a6', '#d98a00', '#ff5a1f', '#171717', '#b0005f'];
const ICON = { point: '●', line: '╱', polygon: '▭' };

// ---------------------------------------------------------------- state
const LY = [];            // {id, name, color, opacity, visible, builtin, geom, fc, slug, counts, loading}
let msg = '', panelOpen = false, colorN = 0, db = null;
const byId = id => LY.find(l => l.id === id);

function counts(fc) {
  const c = { pt: 0, ln: 0, pg: 0 };
  (fc.features || []).forEach(f => { const g = f.geometry && f.geometry.type; if (!g) return; if (/Point/.test(g)) c.pt++; else if (/Line/.test(g)) c.ln++; else if (/Polygon/.test(g)) c.pg++; });
  return c;
}
function bboxOf(fc) {
  const b = [999, 999, -999, -999];
  const walk = c => { if (typeof c[0] === 'number') { b[0] = Math.min(b[0], c[0]); b[1] = Math.min(b[1], c[1]); b[2] = Math.max(b[2], c[0]); b[3] = Math.max(b[3], c[1]); } else c.forEach(walk); };
  (fc.features || []).forEach(f => f.geometry && f.geometry.coordinates && walk(f.geometry.coordinates));
  return b[0] > 900 ? null : [[b[0], b[1]], [b[2], b[3]]];
}
function normalize(j) {
  if (!j) return null;
  if (j.type === 'FeatureCollection') return j;
  if (j.type === 'Feature') return { type: 'FeatureCollection', features: [j] };
  if (j.type && j.coordinates) return { type: 'FeatureCollection', features: [{ type: 'Feature', properties: {}, geometry: j }] };
  return null;
}
function looksWgs84(fc) { const b = bboxOf(fc); return !b || (b[0][0] >= -180 && b[1][0] <= 180 && b[0][1] >= -90 && b[1][1] <= 90); }

// ---------------------------------------------------------------- map plumbing
const mapReady = () => X.mapReady && X.map;
function mapAdd(L) {
  if (!mapReady() || L.onMap || !L.fc) return; const m = X.map, sid = 'ul-' + L.id;
  if (m.getSource(sid)) return;
  m.addSource(sid, { type: 'geojson', data: L.fc });
  const before = m.getLayer('hl-fill') ? 'hl-fill' : undefined, vis = L.visible ? 'visible' : 'none';
  m.addLayer({ id: sid + '-fill', type: 'fill', source: sid, filter: POLY, layout: { visibility: vis }, paint: { 'fill-color': L.color, 'fill-opacity': .24 * L.opacity } }, before);
  m.addLayer({ id: sid + '-line', type: 'line', source: sid, filter: NOTPT, layout: { visibility: vis }, paint: { 'line-color': L.color, 'line-width': ['case', POLY, 1.3, 2.2], 'line-opacity': L.opacity } }, before);
  m.addLayer({ id: sid + '-pt', type: 'circle', source: sid, filter: PT, layout: { visibility: vis }, paint: { 'circle-radius': L.id === 'sites' ? 3.6 : 5, 'circle-color': L.color, 'circle-stroke-color': '#fff', 'circle-stroke-width': 1.4, 'circle-opacity': L.opacity } }, before);
  L.onMap = true;
}
function mapStyle(L) {
  if (!mapReady() || !L.onMap) return; const m = X.map, sid = 'ul-' + L.id, vis = L.visible ? 'visible' : 'none';
  ['-fill', '-line', '-pt'].forEach(s => m.setLayoutProperty(sid + s, 'visibility', vis));
  m.setPaintProperty(sid + '-fill', 'fill-color', L.color); m.setPaintProperty(sid + '-fill', 'fill-opacity', .24 * L.opacity);
  m.setPaintProperty(sid + '-line', 'line-color', L.color); m.setPaintProperty(sid + '-line', 'line-opacity', L.opacity);
  m.setPaintProperty(sid + '-pt', 'circle-color', L.color); m.setPaintProperty(sid + '-pt', 'circle-opacity', L.opacity);
}
function mapRemove(L) {
  if (!mapReady() || !L.onMap) return; const m = X.map, sid = 'ul-' + L.id;
  ['-pt', '-line', '-fill'].forEach(s => { if (m.getLayer(sid + s)) m.removeLayer(sid + s); });
  if (m.getSource(sid)) m.removeSource(sid); L.onMap = false;
}
const visIds = () => LY.filter(l => l.visible && l.onMap).flatMap(l => ['-fill', '-line', '-pt'].map(s => 'ul-' + l.id + s));
function zoomTo(L) { const b = L.fc && bboxOf(L.fc); if (b && mapReady()) X.map.fitBounds(b, { padding: { top: 90, bottom: 60, left: 360, right: 460 }, maxZoom: 13, duration: 700 }); }

// ---------------------------------------------------------------- built-in layers
function sitesFC() {
  const f = [];
  P.forEach(p => { if (p.is_national) return; p.locations.forEach(l => (l.points || []).forEach(pt => f.push({ type: 'Feature', properties: { slug: p.slug, programme: X.L(p.title), donors: p.donors.slice(0, 3).join(', '), place: pt.name || l.community || '', precision: l.precision, status: p.eff }, geometry: { type: 'Point', coordinates: [pt.lon, pt.lat] } }))); });
  return { type: 'FeatureCollection', features: f };
}
const BUILTIN = [
  { id: 'sites', geom: 'point', color: '#171717', label: 'l_sites', src: 's_sites', make: sitesFC },
  { id: 'rivers', geom: 'line', color: '#3d8fd6', label: 'l_rivers', src: 's_osm', file: 'rivers' },
  { id: 'water_bodies', geom: 'polygon', color: '#2a78d6', label: 'l_water', src: 's_osm', file: 'water_bodies' },
  { id: 'protected_areas', geom: 'polygon', color: '#1baf7a', label: 'l_pa', src: 's_osm', file: 'protected_areas' }
];
function loadScript(src) { return new Promise((res, rej) => { const s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = () => rej(new Error('load ' + src)); document.head.appendChild(s); }); }
async function ensureBuiltin(L) {
  if (L.fc || L.loading) return; L.loading = true; render();
  try {
    if (L.make) L.fc = L.make();
    else { await loadScript('data/layers/' + L.file + '.js'); L.fc = (window.LAYER_DATA || {})[L.file]; }
    L.counts = counts(L.fc);
  } catch (e) { msg = t('err') + ': ' + L.id; L.fc = { type: 'FeatureCollection', features: [] }; L.counts = counts(L.fc); }
  L.loading = false; mapAdd(L); mapStyle(L); render();
}

// ---------------------------------------------------------------- persistence (IndexedDB)
const idb = {
  open() { return new Promise((res, rej) => { try { const r = indexedDB.open('icp-layers', 1); r.onupgradeneeded = () => r.result.createObjectStore('layers', { keyPath: 'id' }); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); } catch (e) { rej(e); } }); },
  all() { return new Promise((res, rej) => { const q = db.transaction('layers').objectStore('layers').getAll(); q.onsuccess = () => res(q.result); q.onerror = () => rej(q.error); }); },
  put(o) { if (!db) return; try { db.transaction('layers', 'readwrite').objectStore('layers').put(o); } catch (e) {} },
  del(id) { if (!db) return; try { db.transaction('layers', 'readwrite').objectStore('layers').delete(id); } catch (e) {} }
};
const save = L => idb.put({ id: L.id, name: L.name, color: L.color, opacity: L.opacity, visible: L.visible, slug: L.slug || '', fc: L.fc, added: L.added });

// ---------------------------------------------------------------- reading files
async function readFiles(files) {
  const out = [], list = Array.from(files); const ext = f => (f.name.split('.').pop() || '').toLowerCase(), base = f => f.name.replace(/\.[^.]+$/, '');
  const needShp = list.some(f => ['zip', 'shp'].includes(ext(f)));
  if (needShp && !window.shp) await loadScript('vendor/shp.min.js');
  for (const f of list.filter(f => ext(f) === 'zip')) {
    const res = await window.shp(await f.arrayBuffer());
    (Array.isArray(res) ? res : [res]).forEach(fc => out.push({ name: fc.fileName || base(f), fc: normalize(fc) }));
  }
  for (const f of list.filter(f => ['geojson', 'json'].includes(ext(f)))) out.push({ name: base(f), fc: normalize(JSON.parse(await f.text())) });
  const groups = {};
  list.filter(f => ['shp', 'dbf', 'prj', 'cpg'].includes(ext(f))).forEach(f => { (groups[base(f)] = groups[base(f)] || {})[ext(f)] = f; });
  for (const [name, g] of Object.entries(groups)) {
    if (!g.shp) continue;
    const prj = g.prj ? await g.prj.text() : undefined, cpg = g.cpg ? await g.cpg.text() : undefined;
    const geoms = window.shp.parseShp(await g.shp.arrayBuffer(), prj);
    let fc;
    if (g.dbf) fc = window.shp.combine([geoms, window.shp.parseDbf(await g.dbf.arrayBuffer(), cpg)]);
    else fc = { type: 'FeatureCollection', features: geoms.map(geometry => ({ type: 'Feature', properties: {}, geometry })) };
    out.push({ name, fc });
  }
  return out.filter(o => o.fc);
}
async function ingest(files) {
  if (!files || !files.length) return; msg = t('loading'); render();
  try {
    const items = await readFiles(files); let n = 0;
    if (!items.length) throw new Error('empty');
    for (const it of items) {
      if ((it.fc.features || []).length > 60000) { msg = it.name + ': ' + t('err_big'); continue; }
      if (!looksWgs84(it.fc)) { msg = it.name + ': ' + t('err_crs'); continue; }
      const L = { id: 'u' + Date.now().toString(36) + (n++), name: it.name, color: PALETTE[colorN++ % PALETTE.length], opacity: 1, visible: true, builtin: false, fc: it.fc, counts: counts(it.fc), slug: '', added: Date.now() };
      LY.push(L); mapAdd(L); save(L); zoomTo(L); msg = it.name + ' — ' + t('added') + ' (' + L.counts.pt + ' ' + t('pt') + ', ' + L.counts.ln + ' ' + t('ln') + ', ' + L.counts.pg + ' ' + t('pg') + ')';
    }
  } catch (e) { console.warn('layer read error', e); msg = t('err') + (e && e.message ? ' (' + String(e.message).slice(0, 80) + ')' : ''); }
  render();
}

// ---------------------------------------------------------------- panel UI
function rowBuiltin(L) {
  const c = L.counts; const meta = L.loading ? t('loading') : (c ? (c.pt ? c.pt + ' ' + t('pt') : c.ln ? c.ln + ' ' + t('ln') : c.pg + ' ' + t('pg')) : '');
  return '<div class="lrow"><label class="lmain"><input type="checkbox" data-lyr="vis" data-id="' + L.id + '"' + (L.visible ? ' checked' : '') + '><span class="lsw" style="--c:' + L.color + '">' + ICON[L.geom] + '</span><span class="lname">' + esc(t(L.label)) + '</span><span class="lmeta">' + esc(meta) + '</span></label><div class="lsrc">' + esc(t(L.src)) + '</div></div>';
}
function rowMine(L) {
  const c = L.counts || { pt: 0, ln: 0, pg: 0 };
  const opts = '<option value="">' + esc(t('noattach')) + '</option>' + P.filter(p => !p.is_national).sort((a, b) => X.L(a.title).localeCompare(X.L(b.title))).map(p => '<option value="' + esc(p.slug) + '"' + (L.slug === p.slug ? ' selected' : '') + '>' + esc(X.L(p.title).slice(0, 70)) + '</option>').join('');
  return '<div class="lrow mine"><label class="lmain"><input type="checkbox" data-lyr="vis" data-id="' + L.id + '"' + (L.visible ? ' checked' : '') + '><span class="lsw" style="--c:' + L.color + '">' + (c.pg ? ICON.polygon : c.ln ? ICON.line : ICON.point) + '</span><span class="lname">' + esc(L.name) + '</span><span class="lmeta">' + esc(c.pt + '● ' + c.ln + '╱ ' + c.pg + '▭') + '</span></label>' +
    '<div class="lctl"><input type="color" value="' + L.color + '" data-lyr="color" data-id="' + L.id + '" aria-label="color"><input type="range" min="0.1" max="1" step="0.05" value="' + L.opacity + '" data-lyr="op" data-id="' + L.id + '" title="' + esc(t('opacity')) + '"><button class="lbtn2" data-lyr="zoom" data-id="' + L.id + '" title="' + esc(t('zoom')) + '">⌖</button><button class="lbtn2" data-lyr="dl" data-id="' + L.id + '" title="' + esc(t('download')) + '">⤓</button><button class="lbtn2 rm" data-lyr="rm" data-id="' + L.id + '" title="' + esc(t('remove')) + '">×</button></div>' +
    '<select data-lyr="attach" data-id="' + L.id + '" aria-label="' + esc(t('attach')) + '">' + opts + '</select></div>';
}
function render() {
  const el = $('#lpanel'); const cnt = $('#lcount');
  const nVis = LY.filter(l => l.visible && (l.fc || l.loading)).length; if (cnt) cnt.textContent = nVis ? String(nVis) : '';
  if (!el) return; el.hidden = !panelOpen; if (!panelOpen) return;
  const b = LY.filter(l => l.builtin), m = LY.filter(l => !l.builtin);
  el.innerHTML = '<div class="lp-h"><b>' + esc(t('layers')) + '</b><button class="lp-x" data-lyr="close" aria-label="' + esc(t('close')) + '">×</button></div>' +
    '<div class="lp-b"><h5>' + esc(t('builtin')) + '</h5>' + b.map(rowBuiltin).join('') +
    '<h5>' + esc(t('mine')) + '</h5>' + (m.length ? m.map(rowMine).join('') + '<div class="lsrc">' + esc(t('saved')) + '</div>' : '<div class="lsrc">' + esc(t('none')) + '</div>') +
    '<label class="lp-add"><input type="file" id="lfile" multiple accept=".zip,.geojson,.json,.shp,.dbf,.prj,.cpg"><span>＋ ' + esc(t('add')) + '</span></label><div class="lsrc">' + esc(t('hint')) + '</div>' +
    (msg ? '<div class="lmsg" role="status">' + esc(msg) + '</div>' : '') + '</div>';
}
function btnHtml() { return '<button class="lbtn" data-lyr="toggle" type="button">▤ ' + esc(t('layers')) + ' <span class="lcount" id="lcount"></span></button>'; }

// ---------------------------------------------------------------- popups + hooks used by app.js
let popup = null;
function showFeature(e, f, L) {
  const pr = f.properties || {}; const keys = Object.keys(pr).filter(k => pr[k] !== null && pr[k] !== '' && typeof pr[k] !== 'object').slice(0, 14);
  const title = pr.programme || pr.name_en || pr.name || pr.NAME || pr.Name || pr.title || (L ? L.name : '');
  let h = '<div class="lpop"><b>' + esc(title) + '</b>' + (L ? '<div class="lpl">' + esc(L.builtin ? t(L.label) : L.name) + '</div>' : '');
  if (pr.slug && BY[pr.slug]) h += '<div class="lpl"><button class="linkbtn" data-act="open" data-v="' + esc(pr.slug) + '">' + esc(t('open_prog')) + ' →</button></div>';
  if (keys.length) h += '<table>' + keys.filter(k => k !== 'slug' && k !== 'programme').map(k => '<tr><td>' + esc(k) + '</td><td>' + esc(String(pr[k]).slice(0, 120)) + '</td></tr>').join('') + '</table>';
  if (popup) popup.remove(); popup = new maplibregl.Popup({ closeButton: true, maxWidth: '320px' }).setLngLat(e.lngLat).setHTML(h + '</div>').addTo(X.map);
}
function handleClick(e) {
  if (!mapReady()) return false; const ids = visIds(); if (!ids.length) return false;
  const fs = X.map.queryRenderedFeatures([[e.point.x - 4, e.point.y - 4], [e.point.x + 4, e.point.y + 4]], { layers: ids }); if (!fs.length) return false;
  const f = fs[0], L = LY.find(l => f.layer.id.indexOf('ul-' + l.id + '-') === 0); showFeature(e, f, L); return true;
}
const attached = slug => LY.filter(l => !l.builtin && l.slug === slug && l.fc);
function drawerHtml(p) {
  const a = attached(p.slug); if (!a.length) return '';
  return '<div class="sect"><h3>' + esc(t('geom_attached')) + '</h3>' + a.map(l => '<div class="small" style="margin:5px 0"><span class="lsw" style="--c:' + l.color + '">' + ICON.polygon + '</span> <b>' + esc(l.name) + '</b> <span class="muted">' + l.counts.pt + ' ' + t('pt') + ' · ' + l.counts.ln + ' ' + t('ln') + ' · ' + l.counts.pg + ' ' + t('pg') + '</span> <button class="linkbtn" data-lyr="zoom" data-id="' + l.id + '">' + esc(t('zoom')) + '</button></div>').join('') + '</div>';
}
function onSelect(p) {
  const a = attached(p.slug); if (!a.length) return;
  a.forEach(l => { if (!l.visible) { l.visible = true; mapStyle(l); save(l); } });
  const bb = a.map(l => bboxOf(l.fc)).filter(Boolean); if (bb.length && mapReady()) X.map.fitBounds([[Math.min(...bb.map(b => b[0][0])), Math.min(...bb.map(b => b[0][1]))], [Math.max(...bb.map(b => b[1][0])), Math.max(...bb.map(b => b[1][1]))]], { padding: { top: 90, bottom: 60, left: 360, right: 460 }, maxZoom: 14, duration: 700 });
  render();
}
function addToMiniMap(mm, p) {
  attached(p.slug).forEach(l => {
    const sid = 'att-' + l.id; if (mm.getSource(sid)) return; mm.addSource(sid, { type: 'geojson', data: l.fc });
    mm.addLayer({ id: sid + '-f', type: 'fill', source: sid, filter: POLY, paint: { 'fill-color': l.color, 'fill-opacity': .3 } });
    mm.addLayer({ id: sid + '-l', type: 'line', source: sid, filter: NOTPT, paint: { 'line-color': l.color, 'line-width': 2 } });
    mm.addLayer({ id: sid + '-p', type: 'circle', source: sid, filter: PT, paint: { 'circle-radius': 4.5, 'circle-color': l.color, 'circle-stroke-color': '#fff', 'circle-stroke-width': 1.3 } });
  });
  const bb = attached(p.slug).map(l => bboxOf(l.fc)).filter(Boolean);
  if (bb.length) mm.fitBounds([[Math.min(...bb.map(b => b[0][0])), Math.min(...bb.map(b => b[0][1]))], [Math.max(...bb.map(b => b[1][0])), Math.max(...bb.map(b => b[1][1]))]], { padding: 30, maxZoom: 13, duration: 0 });
}

// ---------------------------------------------------------------- events
document.addEventListener('click', e => {
  const el = e.target.closest('[data-lyr]'); if (!el) return; const a = el.dataset.lyr, L = byId(el.dataset.id);
  if (a === 'toggle') { panelOpen = !panelOpen; render(); if (panelOpen) BUILTIN.forEach(() => 0); }
  else if (a === 'close') { panelOpen = false; render(); }
  else if (a === 'zoom' && L) { if (!L.visible) { L.visible = true; mapStyle(L); save(L); } zoomTo(L); render(); }
  else if (a === 'dl' && L) { const blob = new Blob([JSON.stringify(L.fc)], { type: 'application/geo+json' }), url = URL.createObjectURL(blob), x = document.createElement('a'); x.href = url; x.download = (L.name || 'layer') + '.geojson'; x.click(); setTimeout(() => URL.revokeObjectURL(url), 1500); }
  else if (a === 'rm' && L) { mapRemove(L); LY.splice(LY.indexOf(L), 1); idb.del(L.id); render(); }
});
document.addEventListener('change', e => {
  const el = e.target; if (el.id === 'lfile') { ingest(el.files).then(() => { el.value = ''; }); return; }
  const a = el.dataset && el.dataset.lyr; if (!a) return; const L = byId(el.dataset.id); if (!L) return;
  if (a === 'vis') { L.visible = el.checked; if (L.builtin && !L.fc) ensureBuiltin(L).then(() => { mapStyle(L); }); else { mapAdd(L); mapStyle(L); } if (!L.builtin) save(L); render(); }
  else if (a === 'attach') { L.slug = el.value; save(L); render(); if (L.slug && state.sel === L.slug) X.selectProject(L.slug, { fly: false }); }
});
document.addEventListener('input', e => {
  const el = e.target; const a = el.dataset && el.dataset.lyr; if (!a) return; const L = byId(el.dataset.id); if (!L) return;
  if (a === 'color') { L.color = el.value; mapStyle(L); const sw = el.closest('.lrow').querySelector('.lsw'); if (sw) sw.style.setProperty('--c', L.color); save(L); }
  else if (a === 'op') { L.opacity = +el.value; mapStyle(L); save(L); }
});
// drag and drop onto the map
const wrap = () => $('#mapwrap');
let dz = null;
function dropUi(on) { const w = wrap(); if (!w) return; if (on && !dz) { dz = document.createElement('div'); dz.className = 'dropz'; dz.textContent = t('drop'); w.appendChild(dz); } else if (!on && dz) { dz.remove(); dz = null; } }
document.addEventListener('dragenter', e => { if (e.dataTransfer && Array.from(e.dataTransfer.types || []).includes('Files') && !$('#story').hidden === false) dropUi(true); });
document.addEventListener('dragover', e => { if (e.dataTransfer && Array.from(e.dataTransfer.types || []).includes('Files')) e.preventDefault(); });
document.addEventListener('dragleave', e => { if (e.relatedTarget === null) dropUi(false); });
document.addEventListener('drop', e => { if (!e.dataTransfer || !e.dataTransfer.files.length) return; e.preventDefault(); dropUi(false); if (!$('#story').hidden) return; panelOpen = true; ingest(e.dataTransfer.files); });
document.addEventListener('click', e => { if (e.target.closest('[data-lang]')) setTimeout(() => { render(); }, 0); });

// ---------------------------------------------------------------- init
function init() {
  BUILTIN.forEach(b => LY.push({ id: b.id, builtin: true, geom: b.geom, color: b.color, opacity: 1, visible: false, label: b.label, src: b.src, make: b.make, file: b.file, fc: null, counts: null, onMap: false }));
  const ready = async () => {
    try { db = await idb.open(); const saved = await idb.all(); saved.forEach(s => { LY.push({ id: s.id, name: s.name, color: s.color, opacity: s.opacity, visible: s.visible, slug: s.slug || '', fc: s.fc, counts: counts(s.fc), builtin: false, added: s.added, onMap: false }); colorN++; }); } catch (e) { db = null; }
    LY.forEach(l => { if (!l.builtin) mapAdd(l); });
    render();
  };
  if (mapReady()) ready(); else window.addEventListener('icp-map-ready', ready, { once: true });
}
window.LAYERS = { btnHtml, handleClick, drawerHtml, onSelect, addToMiniMap, render };
function mount() {
  const w = $('#mapwrap'); if (w && !$('#lpanel')) { const d = document.createElement('div'); d.id = 'lpanel'; d.hidden = true; d.setAttribute('role', 'dialog'); d.setAttribute('aria-label', 'Layers'); w.appendChild(d); }
  const lc = $('#layerctl'); if (lc && !$('.lbtn', lc)) { lc.insertAdjacentHTML('beforeend', btnHtml()); render(); }
}
new MutationObserver(mount).observe($('#layerctl') || document.body, { childList: true, subtree: !$('#layerctl') });
mount();
init();
})();
