"""Read-only inspection of the public Studio template pin; never deploys."""
import re
import requests
from urllib.parse import urljoin

origin = "https://studio.genlayer.com/"
html = requests.get(origin, timeout=30)
html.raise_for_status()
scripts = re.findall(r'<script[^>]+src="([^"]+)"', html.text)
print("Studio script URLs:", scripts)
for script in scripts:
    response = requests.get(urljoin(origin, script), timeout=30)
    response.raise_for_status()
    text = response.text
    for match in re.finditer(r'py-genlayer:[a-z0-9]{20,}', text):
        print(text[max(0, match.start()-100):match.end()+100])
