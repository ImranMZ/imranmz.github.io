import json
import re
import sys

html = open('dist/index.html', encoding='utf-8').read()
m = re.search(r'<script type="application/ld\+json">(.*?)</script>', html, re.S)
if not m:
    print('FAIL: no JSON-LD block')
    sys.exit(1)

data = json.loads(m.group(1))
print('JSON-LD: valid')
print('top-level keys :', len(data))
print('jobTitle       :', repr(data['jobTitle']))
print('em dash intact :', '—' in data['jobTitle'])
print('@type          :', data['@type'])

# Guard against claims the page does not make.
banned = ['Security Analyst', 'Security Expert', 'threat intelligence', 'expert']
hits = [b for b in banned if b.lower() in m.group(1).lower()]
print('unsupported claims:', hits or 'none')
if hits:
    sys.exit(1)

wa = re.search(r'href="(https://wa\.me/[^"]+)"', html)
print('whatsapp href  :', wa.group(1) if wa else 'MISSING')
if not wa:
    sys.exit(1)