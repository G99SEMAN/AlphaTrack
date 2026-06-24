import sys
import json
import subprocess
import re

try:
    data = json.load(sys.stdin)
except (json.JSONDecodeError, ValueError):
    sys.exit(0)

file_path = data.get('file_path', '')
if not re.search(r'\.tsx?$', file_path):
    sys.exit(0)

result = subprocess.run(
    ['npx', 'tsc', '--noEmit', '--pretty', 'false'],
    capture_output=True,
    text=True,
    encoding='utf-8',
    errors='replace',
)

if result.returncode != 0:
    lines = (result.stdout + result.stderr).strip().split('\n')
    print('\n'.join(lines[:30]))
    sys.exit(result.returncode)
