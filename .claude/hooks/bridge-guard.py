import sys
import json
import re

try:
    data = json.load(sys.stdin)
except (json.JSONDecodeError, ValueError):
    sys.exit(0)

file_path = data.get('file_path', '')
if re.search(r'bridge[/\\]config\.json$', file_path):
    print('BLOCKIERT: bridge/config.json ist geschuetzt — nur manuell bearbeiten.')
    print('Enthaelt API-Key und Bridge-Verbindungsdaten.')
    sys.exit(2)
