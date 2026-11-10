# Ներդրումային ծրագրերի համակարգման քարտեզ (դեմո) · Investment Programme Coordination Map (demo)

Քարտեզային հարթակ, որտեղ երևում են Հայաստանում դոնորների իրականացրած ծրագրերը, դրանց վայրերը և քարտեզագրված տվյալները, որպեսզի պետությունը կարողանա կանխել նույն համայնքում նույն աշխատանքի կրկնությունը։

*A map platform showing donor-funded programmes in Armenia (environment, land, water, climate), where they work, and the mapped datasets that exist — so the same work is not paid for twice in the same community. Real but incomplete data; a demo, not a finished system.*

## Ներկա վիճակ · Status
- 100 իրական ծրագիր (որից 10 պլանավորվող, աղբյուրներով), 60 քարտեզագրված տվյալ, 146 հնարավոր համընկնում (23 «բարձր»), հայերեն և անգլերեն։
- 100 real programmes (10 planned, every record with sources), 60 mapped datasets, 146 possible overlaps (23 "high"), Armenian and English.
- Բացվում է ոլորվող պատմությամբ (մասնիկներից կազմված Հայաստան, 5 քայլ) → «Բացել քարտեզը»։ «Շրջայց» կոճակը։ `?intro=0`՝ առանց պատմության։
- Planned programmes show what is foreseen and "what already exists here" (the check to run before approval).

## Ինչպես բացել · How to open
- Տեղադրված կայքը · live site: տես հղումը պահոցի էջում (GitHub Pages) · see the link on the repository page.
- `site/index.html` — կարելի է բացել անմիջապես ֆայլից (բոլոր տվյալները `site/data/bundle.js`-ում են)։ Հիմնաքարտեզը բեռնվում է ինտերնետից, առանց դրա երևում են միայն սահմանները։
- Կամ · or: `cd site && python -m http.server 8765` → http://127.0.0.1:8765/

## Թղթապանակներ · Folders
| Ուղի · Path | Ինչ է · What |
|---|---|
| `site/` | Կայքը · the website (HTML/CSS/JS, MapLibre local copy) |
| `site/data/` | Գեներացված տվյալներ · generated data (`bundle.js` + separate JSON) |
| `site/js/story.js`, `site/css/story.css` | Ոլորվող մուտքի պատմություն · scroll story (Canvas 2D particle map) |
| `site/js/app.js` | Գործիքը՝ քարտեզ, զտիչներ, համակարգում · the tool: map, filters, coordination |
| `site/js/extras.js` | «Շրջայց» · guided tour |
| `site/js/layers.js` | Քարտեզի «Շերտեր»՝ ներկառուցված կետ/գիծ/պոլիգոն շերտեր, շեյփֆայլի/GeoJSON-ի բեռնում, կցում ծրագրին · map “Layers”: built-in point/line/polygon layers, shapefile/GeoJSON upload, attach to a programme |
| `site/data/layers/` | OSM շերտեր (գետեր, ջրամբարներ, պահպանվող տարածքներ)՝ `scripts/fetch_osm_layers.py` · OSM layers |
| `data/curated/` | Ստուգված ծրագրերի գրառումներ (`a_`,`b_`,`c_`, պլանավորվող `e_`) և տվյալների շերտերի կատալոգ (`d_`) · verified records and dataset catalogue |
| `data/AGENT_BRIEF.md` | Գրառումների ձևաչափը և կանոնները (ոչինչ չհորինել, աղբյուր պարտադիր) · record schema and rules (never invent, a source is mandatory) |
| `data/overrides.json` | Ձեռքով ուղղումներ · manual corrections (`merge`, `drop`, `patch`, …) |
| `data/translations/` | Հայերեն թարգմանություններ (մեքենայական, պետք է ստուգել) · Armenian translations (machine translation, needs review) |
| `scripts/` | Տվյալների պատրաստման սկրիպտներ · data preparation scripts |

## Տվյալների թարմացում · Rebuilding the data
Հում տվյալները (IATI, OCHA, համայնքների բազմանկյուններ) պահոցում չեն։ Raw inputs are not stored in the repository; `site/data/` already contains the generated result.
```
python -P -X utf8 scripts/fetch_iati.py          # IATI activities for Armenia -> data/raw (d-portal)
python -P -X utf8 scripts/prep_geo.py            # OCHA COD-AB boundaries -> data/raw/cod_ab (download from HDX "cod-ab-arm")
python -P -X utf8 scripts/compute_indicators.py  # open-data context indicators (internet, ~2 min)
python -P -X utf8 scripts/prep_communities.py    # 2008 community polygons (download from Open Data Armenia) -> data/communities_lite.geojson
python -P -X utf8 scripts/build_data.py [--geocode]   # merge, overlaps, translations -> site/data
python -P -X utf8 scripts/fetch_osm_layers.py    # OSM layers for the map (Overpass; may need retries)
python -P -X utf8 scripts/build_fonts.py         # inline web fonts (optional)
```

## Կարևոր սահմանափակումներ · Important limitations
- Ներկայիս (միավորված) համայնքների սահմանները բաց չեն։ Օգտագործվում են 2008 թ. 913 համայնքները (հին կառուցվածք, լիցենզիան նշված չէ, լատինատառ անուններ). մնացածը՝ շրջանի (39) / մարզի մակարդակով։
  The boundaries of the current consolidated communities are not open data; the 2008 polygons (913 communities, licence not stated) are used where settlements are known, otherwise district/marz level.
- Ծրագրերի ցանկը ամբողջական չէ · The list is not exhaustive.
- Հայերեն տեքստերը մեքենայական թարգմանություն են · Armenian texts are machine translations.
- «Կարիքի» ցուցիչները (ESA WorldCover, Hansen) ցուցիչային են, ԼԴՉ-ի պաշտոնական ցուցանիշներ չեն · Context indicators are indicative, not official LDN indicators.
- Համընկնումը ուշադրության ազդանշան է, ոչ թե կրկնության ապացույց · An overlap is a prompt for coordination, not proof of duplication.
- Պլանավորվող ծրագրերի տվյալները ամենաթույլն են (շատերը հայտարարություններ են) · Data on planned programmes is the weakest (many are announcements).

## Աղբյուրներ և լիցենզիաներ · Sources and licences
OCHA COD-AB (CC BY 3.0 IGO) · ESA WorldCover 2021 (CC BY 4.0) · Hansen Global Forest Change (CC BY 4.0) · IATI/d-portal · World Bank Projects API · community polygons: AUA Acopian Center via Open Data Armenia (licence not stated) · OpenStreetMap/OpenFreeMap basemap and OSM layers (© OpenStreetMap contributors, ODbL); shapefile reading: shpjs (MIT) · geocoding by OSM Nominatim · MapLibre GL JS (BSD-3) · fonts Inter, JetBrains Mono, Noto Sans Armenian (SIL OFL 1.1). Each programme record links to its own sources.
