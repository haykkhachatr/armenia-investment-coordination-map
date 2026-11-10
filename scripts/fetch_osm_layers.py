"""Fetch real OpenStreetMap layers for Armenia (Overpass API) and write them as script-loadable GeoJSON.

  protected_areas  polygons  boundary=protected_area / national_park / leisure=nature_reserve
  water_bodies     polygons  natural=water, water=lake|reservoir  (> 0.25 km2)
  rivers           lines     waterway=river (named)   (OSM has no usable waterway=canal data for Armenia)

Output: site/data/layers/<id>.js  ->  window.LAYER_DATA['<id>'] = {GeoJSON FeatureCollection}
(script tags work from file://, fetch() of local files does not.)  Data (c) OpenStreetMap contributors, ODbL.
Run: python -P -X utf8 scripts/fetch_osm_layers.py
"""
import json, os, urllib.request, urllib.parse, time
from shapely.geometry import LineString, Polygon, MultiPolygon, mapping
from shapely.ops import linemerge, polygonize, unary_union

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
OUT = os.path.join(ROOT, 'site', 'data', 'layers')
os.makedirs(OUT, exist_ok=True)
UA = 'ArmeniaInvestmentCoordinationDemo/0.2 (research prototype)'


ENDPOINTS = ['https://overpass-api.de/api/interpreter', 'https://overpass.kumi.systems/api/interpreter', 'https://overpass.private.coffee/api/interpreter']


def overpass(body):
    q = '[out:json][timeout:240];area["ISO3166-1"="AM"][admin_level=2]->.a;(' + body + ');out geom;'
    data = urllib.parse.urlencode({'data': q}).encode()
    last = None
    for attempt in range(6):
        for ep in ENDPOINTS:
            try:
                req = urllib.request.Request(ep, data=data, headers={'User-Agent': UA, 'Accept': 'application/json'})
                with urllib.request.urlopen(req, timeout=300) as r:
                    return json.load(r)['elements']
            except Exception as e:      # 429/502/504/timeouts: try the next server, then wait
                last = e
                print('  overpass', ep.split('/')[2], 'failed:', e)
        time.sleep(8 * (attempt + 1))
    raise last


def rnd(c, nd=4):
    return [round(c[0], nd), round(c[1], nd)] if isinstance(c[0], (int, float)) else [rnd(x, nd) for x in c]


def feat(geom, props, tol):
    g = geom.simplify(tol, preserve_topology=True)
    if g.is_empty:
        return None
    m = mapping(g)
    m['coordinates'] = rnd(m['coordinates'])
    return {'type': 'Feature', 'properties': props, 'geometry': m}


def names(t):
    return {'name': t.get('name:hy') or t.get('name') or '', 'name_en': t.get('name:en') or '', 'osm': ''}


def ring_lines(el):
    """list of LineStrings for the outer/inner members of a relation, or the way itself"""
    if el['type'] == 'way':
        return [LineString([(p['lon'], p['lat']) for p in el['geometry']])], []
    outer, inner = [], []
    for m in el.get('members', []):
        if m['type'] != 'way' or not m.get('geometry'):
            continue
        ls = LineString([(p['lon'], p['lat']) for p in m['geometry']])
        (inner if m.get('role') == 'inner' else outer).append(ls)
    return outer, inner


def polygon_of(el):
    outer, inner = ring_lines(el)
    if not outer:
        return None
    polys = list(polygonize(linemerge(outer))) if len(outer) > 1 or not outer[0].is_ring else [Polygon(outer[0])]
    if not polys:
        return None
    shape = unary_union(polys)
    if inner:
        holes = list(polygonize(linemerge(inner)))
        if holes:
            shape = shape.difference(unary_union(holes))
    return shape if shape.is_valid else shape.buffer(0)


def write(layer_id, feats):
    fc = {'type': 'FeatureCollection', 'features': [f for f in feats if f]}
    js = 'window.LAYER_DATA = window.LAYER_DATA || {}; window.LAYER_DATA[%s] = %s;' % (json.dumps(layer_id), json.dumps(fc, ensure_ascii=False, separators=(',', ':')))
    p = os.path.join(OUT, layer_id + '.js')
    open(p, 'w', encoding='utf-8').write(js)
    print('%-16s %4d features %5d KB' % (layer_id, len(fc['features']), os.path.getsize(p) // 1024))


# Armenia outline (to drop shapes that belong to neighbouring countries)
from shapely.geometry import shape as _shape
ARM = unary_union([_shape(f['geometry']) for f in json.load(open(os.path.join(OUT, '..', 'marzes.geojson'), encoding='utf-8'))['features']])
ONLY = set(__import__('sys').argv[1:])
want = lambda k: not ONLY or k in ONLY

# ---- protected areas (polygons): national parks, state reserves, sanctuaries
if want('protected_areas'):
    els = overpass('relation["boundary"~"^(protected_area|national_park)$"](area.a);way["boundary"~"^(protected_area|national_park)$"](area.a);'
                   'relation["leisure"="nature_reserve"](area.a);way["leisure"="nature_reserve"](area.a);')
    fs, seen = [], set()
    for el in els:
        t = el.get('tags', {}); poly = polygon_of(el)
        if poly is None or poly.is_empty or not poly.intersects(ARM) or poly.intersection(ARM).area < .5 * poly.area:
            continue
        p = names(t); key = (p['name_en'] or p['name']).lower()
        if key in seen:
            continue
        seen.add(key)
        p['kind'] = t.get('protect_class') or t.get('boundary') or t.get('leisure'); p['designation'] = t.get('designation') or t.get('protection_title') or ''
        p['osm'] = '%s/%d' % (el['type'], el['id']); p['area_km2'] = round(poly.area * 111.32 * 84.9, 1)
        fs.append(feat(poly, p, 0.0012))
    write('protected_areas', fs)
    time.sleep(3)

# ---- lakes and reservoirs (polygons)
els = [] if not want('water_bodies') else overpass('relation["natural"="water"]["water"~"^(lake|reservoir)$"](area.a);way["natural"="water"]["water"~"^(lake|reservoir)$"](area.a);')
fs = []
for el in els:
    t = el.get('tags', {}); poly = polygon_of(el)
    if poly is None or poly.is_empty:
        continue
    km2 = poly.area * 111.32 * 84.9
    if km2 < 0.25:
        continue
    p = names(t); p['kind'] = t.get('water'); p['area_km2'] = round(km2, 2); p['osm'] = '%s/%d' % (el['type'], el['id'])
    fs.append(feat(poly, p, 0.0006))
if want('water_bodies'):
    write('water_bodies', fs)
    time.sleep(3)

# ---- rivers and canals (lines)
for lid, tag, keep_unnamed in (('rivers', 'river', False),):
    if not want(lid):
        continue
    els = overpass('way["waterway"="%s"](area.a);' % tag)
    fs = []
    for el in els:
        t = el.get('tags', {})
        if not keep_unnamed and not (t.get('name') or t.get('name:en') or t.get('name:hy')):
            continue
        ls = LineString([(p['lon'], p['lat']) for p in el.get('geometry', [])])
        if ls.is_empty or len(ls.coords) < 2:
            continue
        p = names(t); p['osm'] = 'way/%d' % el['id']; p['kind'] = tag
        fs.append(feat(ls, p, 0.0005))
    write(lid, fs)
    time.sleep(3)
