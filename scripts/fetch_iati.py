import json, urllib.request, urllib.parse, os, sys
OUT = os.path.join(os.path.dirname(__file__), '..', 'data', 'raw')
def q(params):
    url = 'https://d-portal.org/q.json?' + urllib.parse.urlencode(params)
    with urllib.request.urlopen(url, timeout=180) as r:
        return json.load(r)['rows']
acts = q(dict(**{'from':'act,country'}, limit=-1, country_code='AM',
    select='aid,title,reporting,reporting_ref,day_start,day_end,commitment,spend,status_code,description,funder_ref,day_length'))
print('acts', len(acts))
secs = q(dict(**{'from':'act,country,sector'}, limit=-1, country_code='AM', select='aid,sector_code,sector_group,sector_percent'))
print('secs', len(secs))
locs = q(dict(**{'from':'act,country,location'}, limit=-1, country_code='AM', select='aid,location_name,location_longitude,location_latitude,location_precision'))
print('locs', len(locs))
for n, d in (('iati_acts', acts), ('iati_secs', secs), ('iati_locs', locs)):
    json.dump(d, open(os.path.join(OUT, n + '.json'), 'w', encoding='utf-8'), ensure_ascii=False)
