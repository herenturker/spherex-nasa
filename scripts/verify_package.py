#!/usr/bin/env python3
"""Validate JSON manifest file checksums after unzipping the SPHEREx export."""
import hashlib
import json
from pathlib import Path

root = Path(__file__).resolve().parent.parent
manifest = json.loads((root / 'MANIFEST.json').read_text(encoding='utf-8'))
entries = manifest.get('files_sha256', {})
fail = []
for name, expected in entries.items():
    path = root / name
    if not path.is_file():
        fail.append((name, 'MISSING'))
        continue
    actual = hashlib.sha256(path.read_bytes()).hexdigest()
    if actual != expected:
        fail.append((name, actual))
print(f'Checked {len(entries)} files; mismatches: {len(fail)}')
for name, actual in fail[:20]:
    print(f'  {name}: {actual}')
if fail:
    raise SystemExit(1)
