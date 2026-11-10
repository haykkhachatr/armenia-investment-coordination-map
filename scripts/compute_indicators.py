"""Compute simple, transparent 'need / context' indicators per district from open global rasters.

NOT official LDN indicators. Indicative context layers for the demo, each with source + method in the output.
  * ESA WorldCover 2021 v200 (10 m, CC BY 4.0): share of cropland, grassland, shrub, tree, bare, built-up, water.
  * Hansen Global Forest Change (30 m, CC BY 4.0): tree cover 2000 (>=30%), cumulative tree-cover loss 2001-last year.
Run: python -P -X utf8 scripts/compute_indicators.py     (needs internet, rasterio, geopandas)
Output: data/indicators.json
"""
import json, os, sys
import numpy as np
import rasterio
from rasterio.features import rasterize
from rasterio.windows import from_bounds
from rasterio.transform import Affine
import geopandas as gpd

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
dist = gpd.read_file(os.path.join(ROOT, 'data', 'raw', 'cod_ab', 'arm_admin2.geojson'))
dist = dist.reset_index(drop=True)
minx, miny, maxx, maxy = dist.total_bounds
print('bounds', minx, miny, maxx, maxy)
env = dict(GDAL_HTTP_MAX_RETRY='3', GDAL_HTTP_RETRY_DELAY='2', GDAL_DISABLE_READDIR_ON_OPEN='EMPTY_DIR',
           CPL_VSIL_CURL_ALLOWED_EXTENSIONS='.tif')

STEP = 0.0009  # ~100 m grid for the sampling raster (lon/lat degrees)
W = int(np.ceil((maxx - minx) / STEP)); H = int(np.ceil((maxy - miny) / STEP))
transform = Affine(STEP, 0, minx, 0, -STEP, maxy)
labels = rasterize(((geom, i + 1) for i, geom in enumerate(dist.geometry)), out_shape=(H, W),
                   transform=transform, fill=0, dtype='int32')
print('grid', W, H, 'cells in districts', int((labels > 0).sum()))
# cell area (km2) varies with latitude
lats = maxy - (np.arange(H) + 0.5) * STEP
cell_km2 = (STEP * 111.32 * np.cos(np.radians(lats)) * STEP * 110.57)[:, None] * np.ones((1, W))


def sample(url, resampling='nearest'):
    """Read a remote COG/GeoTIFF onto our grid with nearest sampling. Returns array or None."""
    from rasterio.enums import Resampling
    with rasterio.Env(**env):
        with rasterio.open(url) as src:
            b = src.bounds
            ix0, iy0 = max(minx, b.left), max(miny, b.bottom)
            ix1, iy1 = min(maxx, b.right), min(maxy, b.top)
            if ix0 >= ix1 or iy0 >= iy1:
                return None
            # target sub-grid
            c0 = int(np.floor((ix0 - minx) / STEP)); c1 = int(np.ceil((ix1 - minx) / STEP))
            r0 = int(np.floor((maxy - iy1) / STEP)); r1 = int(np.ceil((maxy - iy0) / STEP))
            c1 = min(c1, W); r1 = min(r1, H)
            w_, h_ = c1 - c0, r1 - r0
            bounds = (minx + c0 * STEP, maxy - r1 * STEP, minx + c1 * STEP, maxy - r0 * STEP)
            win = from_bounds(*bounds, transform=src.transform)
            arr = src.read(1, window=win, out_shape=(h_, w_), resampling=getattr(Resampling, resampling),
                           boundless=True, fill_value=0)
            out = np.zeros((H, W), dtype=arr.dtype)
            out[r0:r1, c0:c1] = arr
            return out


def mosaic(urls, **kw):
    out = None
    for u in urls:
        try:
            a = sample(u, **kw)
        except Exception as e:
            print('  skip', u.split('/')[-1], '->', type(e).__name__, str(e)[:90]); continue
        if a is None: continue
        print('  ok  ', u.split('/')[-1])
        out = a if out is None else np.where(out == 0, a, out)
    return out


res = {'districts': {}, 'meta': {}}
# ---- ESA WorldCover
wc_base = 'https://esa-worldcover.s3.eu-central-1.amazonaws.com/v200/2021/map/ESA_WorldCover_10m_2021_v200_%s_Map.tif'
wc = mosaic([wc_base % t for t in ('N39E042', 'N39E045', 'N36E042', 'N36E045')], resampling='nearest')
classes = {10: 'tree', 20: 'shrub', 30: 'grass', 40: 'crop', 50: 'built', 60: 'bare', 70: 'snow', 80: 'water', 90: 'wetland'}
if wc is not None:
    for i, row in dist.iterrows():
        m = labels == i + 1
        tot = cell_km2[m].sum()
        d = {}
        for code, nm in classes.items():
            d['lc_%s_pct' % nm] = round(float(cell_km2[m & (wc == code)].sum() / tot * 100), 1)
        res['districts'].setdefault(row['adm2_pcode'], {}).update(d)
    res['meta']['worldcover'] = {'name': 'ESA WorldCover 2021 v200', 'license': 'CC BY 4.0',
        'url': 'https://esa-worldcover.org/', 'method': 'share of district area per land-cover class, sampled on a ~100 m grid from the 10 m map'}

# ---- Hansen GFC
for ver in ('GFC-2024-v1.12', 'GFC-2023-v1.11'):
    hb = 'https://storage.googleapis.com/earthenginepartners-hansen/%s/Hansen_%s_%%s_%%s.tif' % (ver, ver)
    tiles = [('40N_040E'), ('50N_040E')]
    tc = mosaic([hb % ('treecover2000', t) for t in tiles])
    if tc is None:
        continue
    ly = mosaic([hb % ('lossyear', t) for t in tiles])
    last = 2000 + int(ver.split('-')[1])  # 2024 / 2023
    forest = tc >= 30
    for i, row in dist.iterrows():
        m = labels == i + 1
        f2000 = cell_km2[m & forest].sum()
        loss = cell_km2[m & forest & (ly > 0)].sum() if ly is not None else float('nan')
        d = {'treecover2000_km2': round(float(f2000), 1), 'treeloss_km2': round(float(loss), 2),
             'treeloss_pct_of_2000': round(float(loss / f2000 * 100), 1) if f2000 > 0 else None}
        res['districts'].setdefault(row['adm2_pcode'], {}).update(d)
    res['meta']['hansen'] = {'name': 'Hansen/UMD/Google/USGS/NASA Global Forest Change ' + ver, 'license': 'CC BY 4.0',
        'url': 'https://glad.earthengine.app/view/global-forest-change', 'period': '2001-%d' % last,
        'method': 'tree cover >=30% in 2000, cumulative stand-replacement loss, sampled on a ~100 m grid from the 30 m data'}
    break

for pc, v in res['districts'].items():
    pass
out = os.path.join(ROOT, 'data', 'indicators.json')
json.dump(res, open(out, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
print('wrote', out, 'districts', len(res['districts']), 'sources', list(res['meta']))
