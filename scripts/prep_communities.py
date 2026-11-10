"""Prepare the open (2008) community polygons for point-in-polygon matching.

Input : data/raw/communities/Community_Polygons.shp  (AUA Acopian Center, via Open Data Armenia; 913 pre-consolidation
        communities; licence not specified; data pre-date the 2015-2017 amalgamations)
Output: data/communities_lite.geojson (all 913, simplified, WGS84) with: code, name_hy, name_en, district_id, marz_id
Run   : python -P -X utf8 scripts/prep_communities.py
"""
import json, os
import geopandas as gpd

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
g = gpd.read_file(os.path.join(ROOT, 'data', 'raw', 'communities', 'Community_Polygons.shp'))
print(g.crs, len(g), list(g.columns))
g = g.to_crs(4326)
from shapely.ops import unary_union


def polys(geom):
    if geom.geom_type == 'GeometryCollection':
        ps = [x for x in geom.geoms if x.geom_type in ('Polygon', 'MultiPolygon')]
        return unary_union(ps) if ps else geom
    return geom


g['geometry'] = g.geometry.make_valid().apply(polys)
dist = gpd.read_file(os.path.join(ROOT, 'data', 'raw', 'cod_ab', 'arm_admin2.geojson'))[['adm2_pcode', 'adm1_pcode', 'geometry']]
pts = g.copy(); pts['geometry'] = g.geometry.representative_point()
j = gpd.sjoin(pts, dist, how='left', predicate='within')
j = j[~j.index.duplicated(keep='first')]
g['district_id'] = j['adm2_pcode']
g['marz_id'] = j['adm1_pcode']
g['name_hy'] = g['Arm_Name']
g['name_en'] = g['Community_']
g['code'] = g['CODE'].astype(str)
g['geometry'] = g.geometry.simplify(0.0006, preserve_topology=True).apply(polys)
out = g[['code', 'name_hy', 'name_en', 'district_id', 'marz_id', 'geometry']]
print('without district:', int(out['district_id'].isna().sum()))
print(out.head(8).drop(columns='geometry').to_string())
out.to_file(os.path.join(ROOT, 'data', 'communities_lite.geojson'), driver='GeoJSON')
print('size KB', os.path.getsize(os.path.join(ROOT, 'data', 'communities_lite.geojson')) // 1024)
