"""Merge curated project records into the web data files.

Inputs : data/curated/*.json (a_*, b_*, c_* = projects; d_* = data layers), data/overrides.json (optional),
         data/translations_hy.json (optional), data/geo_index.json, data/indicators.json,
         site/data/districts.geojson (for point-in-polygon)
Outputs: site/data/projects.json, overlaps.json, layers.json, indicators.json, meta.json
Run    : python -P -X utf8 scripts/build_data.py [--geocode]
"""
import json, os, sys, glob, re, time, datetime, itertools, urllib.request, urllib.parse
from shapely.geometry import shape, Point
from shapely.strtree import STRtree

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
D = lambda *p: os.path.join(ROOT, *p)
SITE = D('site', 'data')
TODAY = datetime.date(2026, 11, 4)
THEMES = {
    # 4 colour domains only (palette validated for <=3 hues side by side on a map + one neutral)
    'land-degradation-slm': 'land', 'soil-salinity': 'land', 'pastures-livestock': 'land',
    'forestry': 'land', 'biodiversity-protected-areas': 'land',
    'water-irrigation': 'water', 'water-supply-sanitation': 'water', 'lake-sevan': 'water',
    'climate-adaptation': 'climate', 'disaster-risk': 'climate', 'climate-mitigation-energy': 'climate',
    'agriculture-value-chain': 'other', 'rural-community-development': 'other',
    'waste-pollution': 'other', 'policy-capacity': 'other',
}
# umbrella tags that do not mean 'same type of work' -> never used to flag an overlap
# co-financing sources are not 'a donor running its own parallel programme'
NON_DONORS = {'Government of Armenia', 'Local co-funding', 'Co-financiers'}
GENERIC_THEMES = {'policy-capacity', 'rural-community-development'}
MARZ_ALIASES = {'vayotsdzor': 'Vayots Dzor', 'vayots-dzor': 'Vayots Dzor', 'vayots dzor': 'Vayots Dzor', 'syunik': 'Syunik',
                'siunik': 'Syunik', 'gegharkunik': 'Gegharkunik', 'gegharqunik': 'Gegharkunik', 'aragatsotn': 'Aragatsotn',
                'ararat': 'Ararat', 'armavir': 'Armavir', 'kotayk': 'Kotayk', 'lori': 'Lori', 'shirak': 'Shirak',
                'tavush': 'Tavush', 'yerevan': 'Yerevan'}
DIST_ALIASES = {'ijevan': 'Idjevan', 'idjevan': 'Idjevan', 'dilijan': 'Dilidjan', 'dilidjan': 'Dilidjan',
                'tumanyan': 'Tumanian', 'tumanian': 'Tumanian', 'vanadzor': 'Gugark', 'gugark': 'Gugark',
                'yeghegnadzor': 'Yeghegnadzor', 'eghegnadzor': 'Yeghegnadzor', 'noyemberyan': 'Noyemberyan',
                'echmiadzin': 'Vagharshapat', 'vagharshapat': 'Vagharshapat', 'sevan': 'Sevan', 'hrazdan': 'Hrazdan',
                'charentsavan': 'Nairi', 'abovyan': 'Kotayk', 'gyumri': 'Ani', 'artik': 'Artik', 'maralik': 'Akhuryan',
                'goris': 'Goris', 'kapan': 'Kapan', 'meghri': 'Meghri', 'sisian': 'Sisian', 'vayk': 'Vayk',
                'jermuk': 'Vayk', 'talin': 'Talin', 'aparan': 'Aparan', 'ashtarak': 'Ashtarak', 'artashat': 'Artashat',
                'masis': 'Masis', 'armavir': 'Armavir', 'metsamor': 'Armavir', 'baghramyan': 'Baghramyan', 'ararat': 'Ararat',
                'gavar': 'Gavar', 'martuni': 'Martuni', 'vardenis': 'Vardenis', 'spitak': 'Spitak', 'stepanavan': 'Stepanavan',
                'tashir': 'Tashir', 'amasia': 'Amasia', 'ani': 'Ani', 'akhuryan': 'Akhuryan', 'ashotsk': 'Ashotck', 'ashotck': 'Ashotck',
                'karmir': 'Karmir', 'nairi': 'Nairi', 'kotayk': 'Kotayk', 'aragats': 'Aragats', 'tavush': 'Tavush'}

DONOR_RULES = [
    (r'green climate fund|\bGCF\b', 'GCF'), (r'global environment facility|\bGEF\b', 'GEF'), (r'adaptation fund', 'Adaptation Fund'),
    (r'world bank|\bIDA\b|\bIBRD\b', 'World Bank'), (r'european union|\bEU\b|european commission|neighbourhood investment', 'EU'),
    (r'european investment bank|\bEIB\b', 'EIB'), (r'\bEBRD\b|european bank for reconstruction', 'EBRD'),
    (r'asian development bank|\bADB\b', 'ADB'), (r'\bIFAD\b|international fund for agricultural', 'IFAD'), (r'opec fund', 'OPEC Fund'),
    (r'swiss|\bSDC\b|switzerland', 'Switzerland (SDC)'), (r'germany|german|\bBMZ\b|\bKfW\b|\bGIZ\b', 'Germany (BMZ/KfW)'),
    (r'\bUSAID\b|united states agency|u\.s\. agency', 'USAID'), (r'sweden|\bsida\b', 'Sweden (Sida)'),
    (r'austria', 'Austria (ADC)'), (r'\bAFD\b|agence fran', 'France (AFD)'), (r'millennium challenge|\bMCC\b', 'MCC'),
    (r'\bUNDP\b|united nations development', 'UNDP'), (r'\bUNEP\b', 'UNEP'), (r'joint sdg fund', 'UN Joint SDG Fund'),
    (r'\bFAO\b|food and agriculture', 'FAO'), (r'\bNABU\b', 'NABU'), (r'government of armenia|republic of armenia', 'Government of Armenia'),
    (r'forest alliance|co-?fund', 'Local co-funding'),
]


def short_donors(lst):
    out = []
    for d in lst or []:
        lab = None
        for rx, name in DONOR_RULES:
            if re.search(rx, str(d), re.I):
                lab = name; break
        lab = lab or re.sub(r'\s*\(.*$', '', str(d)).strip()[:36]
        if lab and lab not in out:
            out.append(lab)
    return out


gi = json.load(open(D('data', 'geo_index.json'), encoding='utf-8'))
districts = gi['districts']
by_marz = {}
for pid, p in districts.items():
    by_marz.setdefault(p['marz_en'], []).append(pid)
name2id = {(p['marz_en'], p['name_en'].lower()): pid for pid, p in districts.items()}
marz_ids = {p['name_en']: pid for pid, p in gi['marzes'].items()}

gj = json.load(open(os.path.join(SITE, 'districts.geojson'), encoding='utf-8'))
geoms = [shape(f['geometry']) for f in gj['features']]
gids = [f['properties']['id'] for f in gj['features']]
tree = STRtree(geoms)
com_gj = json.load(open(D('data', 'communities_lite.geojson'), encoding='utf-8'))
com_geoms = [shape(f['geometry']) for f in com_gj['features']]
com_props = [f['properties'] for f in com_gj['features']]
com_tree = STRtree(com_geoms)


def pip_comm(lon, lat):
    pt = Point(lon, lat)
    for i in com_tree.query(pt):
        if com_geoms[i].contains(pt):
            return i
    return None


def pip(lon, lat):
    pt = Point(lon, lat)
    for i in tree.query(pt):
        if geoms[i].contains(pt):
            return gids[i]
    # tolerate simplified-edge misses
    best = min(range(len(geoms)), key=lambda i: geoms[i].distance(pt))
    return gids[best] if geoms[best].distance(pt) < 0.01 else None


# ---------------- geocoding cache (OSM Nominatim, only with --geocode) ----------------
GC_PATH = D('data', 'geocode_cache.json')
gcache = json.load(open(GC_PATH, encoding='utf-8')) if os.path.exists(GC_PATH) else {}
DO_GEOCODE = '--geocode' in sys.argv


def geocode(q):
    if q in gcache:
        return gcache[q]
    if not DO_GEOCODE:
        return None
    url = 'https://nominatim.openstreetmap.org/search?' + urllib.parse.urlencode({'q': q + ', Armenia', 'format': 'json', 'limit': 1, 'countrycodes': 'am'})
    req = urllib.request.Request(url, headers={'User-Agent': 'ArmeniaInvestmentCoordinationDemo/0.1 (research prototype)'})
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            js = json.load(r)
        gcache[q] = {'lat': float(js[0]['lat']), 'lon': float(js[0]['lon'])} if js else {}
    except Exception as e:
        print('  geocode fail', q, e)
        return None
    time.sleep(1.1)
    json.dump(gcache, open(GC_PATH, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    return gcache[q]



# ---------------- wording that is fine in working notes but must not be published
_CLEAN = [
    (r"User works on this project\.\s*", ""),
    (r"\(local file [A-Za-z]:[^)]*\)", "(project document)"),
    (r"[A-Za-z]:\\Users\\[^\s)\"']*", "(local file)"),
    (r"Extra programme added by the research agent[^.]*\.", "Added during compilation."),
    (r"added by the research agent", "added during compilation"),
    (r"the research agent", "the compilers"),
    (r"\b(climate or land|forestry|land|climate|water) agents?\b", "other categories"),
    (r"author'?s geographic knowledge", "geographic inference, not stated in the source"),
    (r"(?i)(?:an? )?(?:first|earlier|second) research pass", "an earlier compilation step"),
    (r"(?i)\bresearch pass\b", "compilation step"),
    (r"\s*before presenting", ""),
    (r"\bTEST\b", "test"),
    (r"I could not open the (\w+) page", r"the \1 page could not be opened"),
    (r"\bany page I could open\b", "any page that could be opened"),
    (r"\bI could not verify it\b", "this could not be verified"),
    (r"\bI could not\b", "it was not possible to"),
    (r"\bsources? I (opened|read|used)\b", "consulted sources"),
    (r"\bI (opened|read|used)\b", "consulted"),
]


def clean_text(s):
    if not isinstance(s, str):
        return s
    for rx, rep in _CLEAN:
        s = re.sub(rx, rep, s)
    return s.strip()


def norm_marz(m):
    if not m:
        return None
    k = re.sub(r'\s*(marz|province|region|oblast)\s*$', '', str(m).strip(), flags=re.I).lower()
    return MARZ_ALIASES.get(k) or MARZ_ALIASES.get(k.replace(' ', ''))


def month_index(s, end=False):
    if not s:
        return None
    s = str(s)
    m = re.match(r'^(\d{4})(?:-(\d{1,2}))?', s)
    if not m:
        return None
    y = int(m.group(1)); mo = int(m.group(2)) if m.group(2) else (12 if end else 1)
    return y * 12 + (mo - 1)


warnings = []


def clean_place(x):
    x = re.sub(r'\(.*?\)', '', str(x))
    x = re.sub(r'\b(consolidated|community|communities|village|villages|settlement|town|city)\b', '', x, flags=re.I)
    x = re.sub(r'\s+', ' ', x).strip(' ,;-')
    if not x or len(x) > 40 or re.search(r'\b(and|marz|region|province|north|south|east|west|national)\b', x, re.I):
        return None
    return x


def resolve_location(slug, loc):
    """Resolve one curated location to marz / district(s) / community polygon(s).
    Order of evidence: coordinates > geocoded settlement names (verified to fall inside the stated marz) > district name > marz."""
    prec = (loc.get('precision') or '').lower()
    marz = norm_marz(loc.get('marz'))
    out = {'marz': marz, 'marz_id': marz_ids.get(marz), 'district_ids': [], 'community_ids': [], 'community_names': [], 'precision': prec,
           'community': loc.get('community'), 'settlements': loc.get('settlements') or [],
           'lat': loc.get('lat'), 'lon': loc.get('lon'), 'evidence': clean_text(loc.get('evidence')), 'resolved_by': None}
    if prec == 'national' or (not marz and loc.get('lat') is None):
        out['precision'] = 'national'
        return out
    pts = []
    if loc.get('lat') is not None and loc.get('lon') is not None:
        pts.append((float(loc['lon']), float(loc['lat']), 'coordinates', loc.get('community') or ''))
    names = [x for x in (clean_place(y) for y in ([loc.get('community')] + (loc.get('settlements') or [])) if y) if x]
    if marz:
        for n in names[:12]:
            g = geocode('%s, %s' % (n, marz))
            if g:
                pts.append((g['lon'], g['lat'], 'geocoded-name', n))
    named = []
    dn = loc.get('district')
    if dn and marz:
        key = DIST_ALIASES.get(str(dn).strip().lower(), str(dn).strip())
        did = name2id.get((marz, key.lower()))
        if did:
            named = [did]
        else:
            warnings.append('%s: district "%s" not in %s' % (slug, dn, marz))
    dset, cset, how = set(named), set(), ('district-name' if named else None)
    accepted = []
    for lon, lat, src, pname in pts:
        did = pip(lon, lat)
        if not did:
            continue
        if marz and src != 'coordinates' and districts[did]['marz_en'] != marz:
            continue            # geocoder returned a same-named place in another marz: ignore
        if named and did not in named and src != 'coordinates':
            continue
        dset.add(did)
        accepted.append({'name': pname, 'lon': round(lon, 5), 'lat': round(lat, 5), 'src': src})
        ci = pip_comm(lon, lat)
        if ci is not None and com_props[ci]['district_id'] == did:
            cset.add(ci)
        how = 'coordinates' if src == 'coordinates' else (how if how == 'district-name' else 'geocoded-name')
    if dset:
        d0 = sorted(dset)[0]
        out['district_ids'] = sorted(dset); out['resolved_by'] = how
        out['marz'] = districts[d0]['marz_en']; out['marz_id'] = districts[d0]['marz_id']
        out['community_ids'] = sorted(com_props[i]['code'] for i in cset)
        out['community_names'] = sorted(com_props[i]['name_en'] for i in cset)
        out['points'] = accepted
        if any(s == 'coordinates' for _, _, s, _n in pts):
            out['precision'] = 'site'
        elif cset:
            out['precision'] = 'community'
        elif prec in ('marz', ''):
            out['precision'] = 'district'
        return out
    if marz:
        out['district_ids'] = list(by_marz[marz]); out['precision'] = 'marz'; out['resolved_by'] = 'marz-all-districts'
    return out


# ---------------- load curated projects ----------------
raw = []
for fp in sorted(glob.glob(D('data', 'curated', '[abce]_*.json'))):
    arr = json.load(open(fp, encoding='utf-8'))
    for r in arr:
        r['_file'] = os.path.basename(fp)
    raw.append(arr)
    print('loaded', os.path.basename(fp), len(arr))
records = [r for arr in raw for r in arr]
ov = json.load(open(D('data', 'overrides.json'), encoding='utf-8')) if os.path.exists(D('data', 'overrides.json')) else {}
tr = {}
for _fp in sorted(glob.glob(D('data', 'translations', 't_*.json'))) + [D('data', 'translations_hy.json')]:
    if os.path.exists(_fp):
        for _k, _v in json.load(open(_fp, encoding='utf-8')).items():
            tr.setdefault(_k, {}).update(_v)
by_slug = {}
for r in records:
    by_slug.setdefault(r['slug'], r)
for keep, absorb in ov.get('merge', []):
    k, a = by_slug.get(keep), by_slug.get(absorb)
    if not k or not a:
        warnings.append('merge: missing %s or %s' % (keep, absorb)); continue
    have = {(l.get('marz'), (l.get('community') or '').lower(), l.get('district')) for l in k['locations']}
    for l in a['locations']:
        if (l.get('marz'), (l.get('community') or '').lower(), l.get('district')) not in have and l.get('precision') != 'national':
            k['locations'].append(l)
    seen_u = {s['url'] for s in k['sources']}
    k['sources'] += [s for s in a['sources'] if s['url'] not in seen_u]
    k['notes'] = ((k.get('notes') or '') + ' [Merged with duplicate record ' + absorb + ' from a second research pass: locations and sources combined.]').strip()
    ov.setdefault('drop', []).append(absorb)
seen, projects = set(), []
for r in records:
    slug = r['slug']
    if slug in seen:
        warnings.append('duplicate slug ' + slug); continue
    seen.add(slug)
    if slug in ov.get('drop', []):
        continue
    r.update(ov.get('patch', {}).get(slug, {}))
    if slug in ov.get('notes_append', {}):
        r['notes'] = ((r.get('notes') or '') + ' | ' + ov['notes_append'][slug]).strip(' |')
    themes = [t for t in (r.get('themes') or []) if t in THEMES]
    bad = [t for t in (r.get('themes') or []) if t not in THEMES]
    if bad:
        warnings.append('%s: unknown themes %s' % (slug, bad))
    if not themes:
        warnings.append('%s: no valid theme' % slug); continue
    s, e = month_index(r.get('start')), month_index(r.get('end'), True)
    status = r.get('status') or 'completed'
    if e is None and status == 'active':
        e = month_index('2030-12', True)
    if slug in ov.get('marz_only', []):
        for l in r.get('locations') or []:
            if l.get('precision') in ('site', 'community', 'district'):
                l['precision'] = 'marz'; l['district'] = None; l['lat'] = l['lon'] = None; l['settlements'] = []; l['community'] = None
    locs = [resolve_location(slug, l) for l in (r.get('locations') or [])]
    if not locs:
        locs = [{'marz': None, 'marz_id': None, 'district_ids': [], 'precision': 'national', 'community': None, 'settlements': [], 'lat': None, 'lon': None, 'evidence': None, 'resolved_by': None}]
    spec = [l for l in locs if l['precision'] in ('district', 'community', 'site')]
    broad = [l for l in locs if l['precision'] == 'marz']
    p = {
        'slug': slug, 'title': {'en': r.get('title_en'), 'hy': (tr.get(slug) or {}).get('title') or r.get('title_hy')},
        'summary': {'en': r.get('summary_en'), 'hy': (tr.get(slug) or {}).get('summary')},
        'activities': {'en': r.get('activities_en') or [], 'hy': (tr.get(slug) or {}).get('activities') or []},
        'results': {'en': r.get('results_en') or [], 'hy': (tr.get(slug) or {}).get('results') or []},
        'ids': r.get('ids') or {}, 'donors': r.get('donors') or [], 'implementers': r.get('implementers') or [],
        'partners': r.get('national_partners') or [], 'start': r.get('start'), 'end': r.get('end'), 'status': status,
        'budget_usd': r.get('budget_usd'), 'budget_original': r.get('budget_original'), 'cofinancing_note': r.get('cofinancing_note'),
        'themes': themes, 'primary_theme': themes[0], 'domain': THEMES[themes[0]],
        'stage': {'en': r.get('stage'), 'hy': (tr.get(slug) or {}).get('stage')},
        'donors_short': short_donors(r.get('donors')), 'loc_unknown': slug in ov.get('location_unknown', []),
        'locations': locs, 'is_national': all(l['precision'] == 'national' for l in locs),
        'districts_specific': sorted({d for l in spec for d in l['district_ids']}),
        'communities_specific': sorted({c for l in spec for c in l['community_ids']}),
        'districts_broad': sorted({d for l in broad for d in l['district_ids']}),
        'data_products': r.get('data_products') or [], 'sources': [s_ for s_ in (r.get('sources') or []) if not str(s_.get('url', '')).startswith('file:')],
        'confidence': r.get('confidence') or 'low', 'notes': clean_text(r.get('notes')), 'group': r['_file'][0],
        '_s': s, '_e': e,
    }
    projects.append(p)

# ---------------- overlaps ----------------
ov_known = {frozenset(x) for x in ov.get('complementary', [])}


def months_overlap(a, b):
    if None in (a['_s'], a['_e'], b['_s'], b['_e']):
        return 0, None, None
    s, e = max(a['_s'], b['_s']), min(a['_e'], b['_e'])
    return max(0, e - s + 1), s, e


BASIS_W = {'community': 1.0, 'specific': 0.7, 'mixed': 0.45, 'marz-level': 0.3}
com_by_code = {p['code']: p for p in com_props}
pairs = []
for a, b in itertools.combinations(projects, 2):
    if a['is_national'] or b['is_national'] or a['status'] == 'cancelled' or b['status'] == 'cancelled':
        continue
    th = [t for t in a['themes'] if t in b['themes'] and t not in GENERIC_THEMES]
    if not th:
        continue
    mo, s, e = months_overlap(a, b)
    if mo < 6:
        continue
    cs = sorted(set(a['communities_specific']) & set(b['communities_specific']))
    sp = sorted(set(a['districts_specific']) & set(b['districts_specific']))
    mixed = sorted((set(a['districts_specific']) & set(b['districts_broad'])) | (set(b['districts_specific']) & set(a['districts_broad'])))
    broad = sorted(set(a['districts_broad']) & set(b['districts_broad']))
    if cs:
        basis = 'community'; space = sorted({com_by_code[c]['district_id'] for c in cs})
    elif sp:
        basis, space = 'specific', sp
    elif mixed:
        basis, space = 'mixed', mixed
    elif broad:
        basis, space = 'marz-level', broad
    else:
        continue
    same_donor = bool((set(a['donors_short']) & set(b['donors_short'])) - NON_DONORS)
    score = (1.0 if len(th) == 1 else 1.25) * min(mo, 36) / 36 * BASIS_W[basis] * (0.6 if same_donor else 1.0)
    score = round(min(score, 1.0), 3)
    level = 'high' if score >= 0.6 else 'medium' if score >= 0.3 else 'low'
    pairs.append({'a': a['slug'], 'b': b['slug'], 'themes': th, 'months': mo,
                  'from': '%d-%02d' % (s // 12, s % 12 + 1), 'to': '%d-%02d' % (e // 12, e % 12 + 1),
                  'districts': space, 'communities': cs, 'basis': basis,
                  'same_donor': same_donor, 'score': score, 'level': level,
                  'known_complementary': frozenset((a['slug'], b['slug'])) in ov_known})
pairs.sort(key=lambda x: -x['score'])

for p in projects:
    p.pop('_s'); p.pop('_e')

# ---------------- referenced communities (small file for the map) ----------------
used = {c for p in projects for c in p['communities_specific']}
def _r(c, nd=4):
    return [round(c[0], nd), round(c[1], nd)] if isinstance(c[0], (int, float)) else [_r(x, nd) for x in c]
com_out = []
for f in com_gj['features']:
    if f['properties']['code'] in used:
        g = dict(f['geometry']); g['coordinates'] = _r(g['coordinates'])
        com_out.append({'type': 'Feature', 'geometry': g, 'properties': {'code': f['properties']['code'], 'name_en': f['properties']['name_en'], 'district_id': f['properties']['district_id']}})
communities = {'type': 'FeatureCollection', 'features': com_out}

# ---------------- layers ----------------
layers = []
for fp in sorted(glob.glob(D('data', 'curated', 'd_*.json'))):
    layers += json.load(open(fp, encoding='utf-8'))
for _l in layers:
    for _k, _v in list(_l.items()):
        if isinstance(_v, str):
            _l[_k] = clean_text(_v)
    _l['sources'] = [s_ for s_ in (_l.get('sources') or []) if not str(s_.get('url', '')).startswith('file:')]
    if str(_l.get('direct_download_or_service') or '').startswith('file:'):
        _l['direct_download_or_service'] = None

# ---------------- write ----------------
os.makedirs(SITE, exist_ok=True)
w = lambda n, o: json.dump(o, open(os.path.join(SITE, n), 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
w('projects.json', projects)
w('overlaps.json', pairs)
w('layers.json', layers)
w('communities.geojson', communities)
ind = json.load(open(D('data', 'indicators.json'), encoding='utf-8')) if os.path.exists(D('data', 'indicators.json')) else {}
w('indicators.json', ind)
meta = {'built': TODAY.isoformat(), 'projects': len(projects), 'overlaps': len(pairs), 'layers': len(layers),
        'themes': THEMES, 'warnings': warnings}
w('meta.json', meta)
# one JS bundle so the site also works when index.html is opened from disk (no fetch needed)
bundle = {'communities': communities, 'projects': projects, 'overlaps': pairs, 'layers': layers, 'indicators': ind, 'meta': meta,
          'marzes': json.load(open(os.path.join(SITE, 'marzes.geojson'), encoding='utf-8')),
          'districts': json.load(open(os.path.join(SITE, 'districts.geojson'), encoding='utf-8'))}
open(os.path.join(SITE, 'bundle.js'), 'w', encoding='utf-8').write('window.DATA=' + json.dumps(bundle, ensure_ascii=False, separators=(',', ':')) + ';')
print('projects', len(projects), '| overlaps', len(pairs), '(high %d, medium %d)' % (sum(x['level'] == 'high' for x in pairs), sum(x['level'] == 'medium' for x in pairs)), '| layers', len(layers))
from collections import Counter
print('precision of locations:', Counter(l['precision'] for p in projects for l in p['locations']))
print('communities referenced:', len(used), '| projects with community-level:', sum(1 for p in projects if p['communities_specific']))
print('resolved_by:', Counter(l['resolved_by'] for p in projects for l in p['locations']))
for x in warnings:
    print('WARN', x)
