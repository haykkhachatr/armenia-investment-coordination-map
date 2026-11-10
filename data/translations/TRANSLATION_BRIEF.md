# Translation brief: English -> Armenian (Eastern Armenian, formal)

Context: a government-facing platform about donor programmes in Armenia (environment, land, water, climate, agriculture).
Readers: Armenian ministry staff and project specialists. Register: formal, clear, plain. No marketing tone.

## Input / output
- Input: `data/translations/in_N.json` — array of `{slug, title, summary, activities[], results[]}` (English).
- Output: `data/translations/t_N.json` — JSON object keyed by slug:
  `{"<slug>": {"title": "...", "summary": "...", "activities": ["..."], "results": ["..."]}}`
- `activities` and `results` MUST have exactly the same number of items, in the same order, as the input (empty list stays empty).
- UTF-8, valid JSON. Write the file with the Write tool (not a shell heredoc).

## Rules
1. **Translate faithfully. Add nothing, remove nothing.** Do not add facts, do not "improve". Numbers, dates, currencies, percentages stay exactly as in the source.
2. **Keep proper names and acronyms in Latin script**: GCF, GEF, FAO, UNDP, UNEP, IFAD, EBRD, EIB, ADB, KfW, GIZ, BMZ, SDC, USAID, MCC, WWF, NABU, IATI, EU, EPIU, WSL, AFD, ILO. Programme names that are official English names (e.g. RESILAND, FORACCA, LILA, EU4Sevan, LEAD, CARMAC) stay in Latin; you may add an Armenian descriptive gloss in the summary but keep the title's Latin name.
3. Armenian place names: use the standard Armenian forms with Armenian script — marzes: Արագածոտն, Արարատ, Արմավիր, Գեղարքունիք, Կոտայք, Լոռի, Շիրակ, Սյունիք, Տավուշ, Վայոց Ձոր, Երևան. Towns/villages: use the usual Armenian spelling (Սիսիան, Գորիս, Կապան, Ջերմուկ, Դիլիջան, Իջևան, Վանաձոր, Գյումրի, Սևան, Գավառ, Մարտունի, Վարդենիս, Թումանյան, ...). If you are not sure of the exact Armenian spelling of a small village, transliterate carefully from the English; do not guess a different place.
4. Do NOT translate institution names where an official Armenian name is not well known to you; in that case give the Armenian descriptive form and keep the English acronym in parentheses at first mention, e.g. «Շրջակա միջավայրի նախարարություն», «Սևանա լճի ազգային պարկ», «Գյուղատնտեսության նախարարություն».
5. Style: sentences like a technical programme description. Prefer active voice; avoid calques that read awkwardly.

## Glossary (use these)
- Land Degradation Neutrality (LDN) = հողի դեգրադացիայի չեզոքություն (ՀԴՉ / LDN)
- land degradation = հողի դեգրադացիա; sustainable land management (SLM) = հողերի կայուն կառավարում
- sustainable forest management = անտառների կայուն կառավարում; forest = անտառ; reforestation/afforestation = անտառվերականգնում / անտառապատում; forest nursery = անտառային տնկարան
- pasture / rangeland = արոտ; livestock = անասնապահություն (anasun - խոշոր եղջերավոր անասուններ for cattle)
- irrigation = ոռոգում; irrigation system = ոռոգման համակարգ; water user association = ջրօգտագործողների ասոցիացիա; reservoir = ջրամբար; dam = պատվար / ամբարտակ; canal = ջրանցք; groundwater = ստորերկրյա ջրեր; drinking water = խմելու ջուր; wastewater = կեղտաջրեր
- Lake Sevan = Սևանա լիճ; river basin = գետավազան; watershed = ջրհավաք ավազան
- climate change = կլիմայի փոփոխություն; climate adaptation = կլիմայի փոփոխությանը հարմարում; climate mitigation = կլիմայի փոփոխության մեղմում; climate resilience = կլիմայակայունություն; climate-smart = կլիմայահարմար (climate-smart agriculture = կլիմայահարմար գյուղատնտեսություն)
- disaster risk reduction = աղետների ռիսկի նվազեցում; early warning = վաղ նախազգուշացում; flood = հեղեղ / ջրհեղեղ; landslide = սողանք; hail = կարկուտ; drought = երաշտ
- biodiversity = կենսաբազմազանություն; protected areas = հատուկ պահպանվող տարածքներ (ՀՊՏ); national park = ազգային պարկ; ecological corridor = էկոլոգիական միջանցք
- agriculture = գյուղատնտեսություն; value chain = արժեշղթա; smallholder farmer = մանր ֆերմեր; cooperative = կոոպերատիվ; orchard = այգի; seed = սերմ
- rural community development = գյուղական համայնքների զարգացում; community = համայնք; local authorities = տեղական ինքնակառավարման մարմիններ; municipality = համայնք / տեղական ինքնակառավարման մարմին
- solid waste = կոշտ թափոններ; landfill = աղբավայր; energy efficiency = էներգաարդյունավետություն; renewable energy = վերականգնվող էներգիա
- capacity building = կարողությունների զարգացում; policy = քաղաքականություն; monitoring = մոնիտորինգ; assessment = գնահատում
- grant = դրամաշնորհ; loan = վարկ; co-financing = համաֆինանսավորում; budget = բյուջե; implementing agency = իրականացնող կազմակերպություն; pilot = փորձնական (pilot community = փորձնական համայնք)
- Ministry of Environment = Շրջակա միջավայրի նախարարություն; Ministry of Territorial Administration and Infrastructure = Տարածքային կառավարման և ենթակառուցվածքների նախարարություն; Ministry of Economy = Տնտեսության նախարարություն; Ministry of Agriculture (past name) = Գյուղատնտեսության նախարարություն; Hayantar = «Հայանտառ»

## Check before you finish
- Same slugs as the input file, none missing. Same list lengths. Valid JSON (you can verify with `python -I -c "import json;json.load(open(...,encoding='utf-8'))"`).
- No English sentences left untranslated (acronyms/proper names excepted).
- Final message: file path, number of records, and any term you were unsure about (max 5 lines).
