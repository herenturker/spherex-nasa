#!/usr/bin/env python3
"""Report quality metadata from archival science_gzip without inventing measurements."""
import base64
import gzip
import json
import math
from pathlib import Path

DB_PATH=Path(__file__).resolve().parent.parent/'database'/'spherex_processed_frames.jsonl'
if not DB_PATH.exists():
    raise SystemExit(f'Missing source backup: {DB_PATH}')
rows=0
frames_science=0
issues=[]
for line_no,line in enumerate(DB_PATH.read_text(encoding='utf-8').splitlines(),1):
    if not line.strip():
        continue
    rows+=1
    row=json.loads(line)
    science=row.get('science_gzip')
    if not science:
        issues.append(f'row {line_no}: no science_gzip')
        continue
    try:
        decoded=json.loads(gzip.decompress(base64.b64decode(science)).decode('utf-8'))
    except Exception as exc:
        issues.append(f'row {line_no}: cannot decode science_gzip ({type(exc).__name__})')
        continue
    frames_science+=1
    psf=decoded.get('psf')
    if not psf:
        continue
    if psf.get('status')=='measured-from-EPSF':
        sigma=psf.get('sigma_native_pix')
        fwhm=psf.get('fwhm_arcsec_approx')
        if isinstance(sigma,(int,float)) and isinstance(fwhm,(int,float)):
            approx=2.35482*sigma*6.15
            if not math.isfinite(approx) or abs(approx-fwhm)>0.004:
                issues.append(f'row {line_no}: inconsistent ePSF width')
print(f'{rows} processed frame rows, {frames_science} decoded scientific grids')
print(f'Warnings: {len(issues)}')
for msg in issues[:30]:
    print(' -',msg)
# Some historic rows can use a different encoding/version; inspect warnings manually.
