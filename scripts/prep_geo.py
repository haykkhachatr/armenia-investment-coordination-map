"""Prepare web-ready administrative boundaries (marzes + districts) from OCHA COD-AB Armenia.

Input : data/raw/cod_ab/arm_admin1.geojson, arm_admin2.geojson  (CC BY 3.0 IGO, OCHA ROCCA / Govt of Armenia)
Output: site/data/marzes.geojson, site/data/districts.geojson, data/geo_index.json
Run   : python -P -X utf8 scripts/prep_geo.py
"""
import json, os
from shapely.geometry import shape, mapping

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
RAW = os.path.join(ROOT, 'data', 'raw', 'cod_ab')
OUT = os.path.join(ROOT, 'site', 'data')
os.makedirs(OUT, exist_ok=True)


def rnd(coords, nd=4):
    if isinstance(coords[0], (int, float)):
        return [round(coords[0], nd), round(coords[1], nd)]
    return [rnd(c, nd) for c in coords]


def prep(name, level, tol):
    d = json.load(open(os.path.join(RAW, name), encoding='utf-8'))
    feats, index = [], {}
    for f in d['features']:
        p = f['properties']
        g = shape(f['geometry']).simplify(tol, preserve_topology=True)
        m = mapping(g)
        m['coordinates'] = rnd(m['coordinates'])
        pre = 'adm%d_' % level
        pid = p[pre + 'pcode']
        props = {
            'id': pid,
            'name_en': p[pre + 'name'],
            'name_hy': p[pre + 'name1'],
            'name_ru': p[pre + 'name2'],
            'area_km2': round(p['area_sqkm'], 1),
        }
        if level == 2:
            props['marz_id'] = p['adm1_pcode']
            props['marz_en'] = p['adm1_name']
        c = g.representative_point()
        props['cx'], props['cy'] = round(c.x, 4), round(c.y, 4)
        feats.append({'type': 'Feature', 'properties': props, 'geometry': m})
        index[pid] = props
    return {'type': 'FeatureCollection', 'features': feats}, index


marz, mi = prep('arm_admin1.geojson', 1, 0.002)
dist, di = prep('arm_admin2.geojson', 2, 0.0015)
json.dump(marz, open(os.path.join(OUT, 'marzes.geojson'), 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
json.dump(dist, open(os.path.join(OUT, 'districts.geojson'), 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
json.dump({'marzes': mi, 'districts': di}, open(os.path.join(ROOT, 'data', 'geo_index.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
for n in ('marzes', 'districts'):
    print(n, os.path.getsize(os.path.join(OUT, n + '.geojson')) // 1024, 'KB')
