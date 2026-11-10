# Brief: verified project records for the Armenia investment-coordination demo

## What we are building
A map platform for the Government of Armenia so that donor/investment programmes do not duplicate each other
in the same communities. The map needs, for every programme: who funds it, who implements it, when, how much,
what themes, **and above all WHERE it works (marz, district, community/settlements)**.
IATI/World Bank open data gives titles, dates, budgets but almost never the real location. Your job is to find the
locations and a short factual summary from the programme's own documents.

## Hard rules
1. **Never invent.** If a fact (budget, community names, dates) is not found in a source, set it to `null` and say so in `notes`.
   A smaller, correct record is far better than a complete, wrong one. This goes to a government demo.
2. Every record needs at least one `sources` entry with a real URL you actually opened (project page, donor page, GEF/GCF portal,
   FAO/UNDP/WB/ADB/EU page, Armenian ministry page, news release of the project). Quote the evidence for locations in `locations[].evidence`.
3. Locations: use only these marz names (English): Yerevan, Aragatsotn, Ararat, Armavir, Gegharkunik, Kotayk, Lori, Shirak, Syunik,
   Tavush, Vayots Dzor. Districts (optional) are from `data/gazetteer.json`. Communities/settlements are free text exactly as in the source.
   If a programme is nationwide, add ONE location with `"precision":"national"` and `marz:null`.
   `precision` is one of: `national`, `marz`, `district`, `community`, `site`. Add `lat`/`lon` only if a source gives coordinates or a
   named site you can place with certainty (do not guess).
4. Programmes that appear several times in IATI under different IDs (donor record, implementer record, fee record, trust-fund record)
   are ONE programme. Merge them and list all IDs in `ids`.
5. Dates `YYYY-MM` (or `YYYY` if that is all you have). `status`: `completed`, `active`, `pipeline`. Today is 2026-11-04.
6. Budget in USD as a number if the source gives USD; otherwise keep the original in `budget_original` (e.g. "EUR 10.64 million") and set
   `budget_usd` to null. Do not convert yourself.
7. Write summaries in plain English, 2-3 sentences, factual, no marketing language.
8. Spend effort proportionally: ~6-10 web calls per programme is plenty. If a programme yields nothing after that, keep the
   IATI-derived basics, set `confidence:"low"`, and move on.

## Output
Write one JSON file (UTF-8, array of records) to the path your task gives you. Record schema:

```json
{
  "slug": "short-kebab-case-unique",
  "title_en": "",
  "title_hy": null,
  "ids": {"iati": [], "wb": null, "gef": null, "gcf": null, "other": []},
  "donors": ["GCF"],
  "implementers": ["FAO"],
  "national_partners": ["Ministry of Environment"],
  "start": "2021-03", "end": "2029-12", "status": "active",
  "budget_usd": null, "budget_original": null, "cofinancing_note": null,
  "themes": [],
  "summary_en": "",
  "activities_en": ["short bullet", "short bullet"],
  "results_en": ["short bullet (only if reported)"],
  "locations": [
    {"marz": "Syunik", "district": "Goris", "community": "free text or null", "settlements": [], "lat": null, "lon": null,
     "precision": "community", "evidence": "quote or paraphrase + which source"}
  ],
  "data_products": [{"name": "", "kind": "map|dataset|report|tool", "note": ""}],
  "sources": [{"title": "", "url": ""}],
  "confidence": "high|medium|low",
  "notes": ""
}
```

`themes` must use only these codes:
`land-degradation-slm`, `soil-salinity`, `forestry`, `biodiversity-protected-areas`, `water-irrigation`, `water-supply-sanitation`,
`lake-sevan`, `climate-adaptation`, `climate-mitigation-energy`, `disaster-risk`, `agriculture-value-chain`, `rural-community-development`,
`waste-pollution`, `pastures-livestock`, `policy-capacity`.

`data_products` = maps/datasets the programme produced or is producing (e.g. "LDN indicator maps for Lori and Syunik", "national forest
inventory"). Only list what a source says exists. This feeds a catalogue of mapped data.

## Useful local files (read-only)
- `data/raw/iati_acts.json` (all 5112 IATI activities for Armenia: fields aid, title, reporting, day_start/day_end as days since 1970-01-01, commitment, spend, description)
- `data/raw/wb_projects.json` (World Bank projects)
- `data/gazetteer.json` (marzes and districts)
Use `python -I` to read them. Do not edit anything outside your own output file.

## Finish
Your final message must be short: the output path, number of records, how many have community-level or better locations,
and anything you could not resolve. Do not paste the records into the message.
