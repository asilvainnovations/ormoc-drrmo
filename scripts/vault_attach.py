#!/usr/bin/env python3
"""Attach the 9 Nov 2026 issuance bundle files to their Document Vault entries (1.13.0).

Reads supabase/admin/vault_bundle_manifest.csv (vault_document_id, doc_number, bundle_path), uploads each file
to the private `vault` bucket at `<vault_document_id>/<file name>` and records it on the entry (storage_path,
file_name, mime_type, size_bytes). Entries that already have a file are skipped: an attached file is never
replaced (ADR-013; app.guard_vault_document refuses it). Attachments, the EO 28 s. 2016 page scans and the second
version of Res. 04 s. 2021 are not in the manifest; attach those by hand in the app if the records office wants them.

Run on a City ICT computer that holds the unzipped bundle. Needs Python 3.9+ only (standard library).

    python3 scripts/vault_attach.py /path/to/Ormoc-DRRM_Issuance-Bundle            # dry run: checks only
    SUPABASE_URL=https://<ref>.supabase.co SERVICE_ROLE_KEY=... \\
      python3 scripts/vault_attach.py /path/to/Ormoc-DRRM_Issuance-Bundle --apply

The service_role key bypasses RLS: type it in the shell for this run only. Never save it in a file, in the
repository or in the app's settings. Read-only on the computer: the bundle is not changed.
"""
import csv
import json
import mimetypes
import os
import sys
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
MANIFEST = ROOT / 'supabase/admin/vault_bundle_manifest.csv'
MAX_BYTES = 26_214_400                     # vault_documents.size_bytes check and the bucket limit (25 MB)
ALLOWED = {'.pdf': 'application/pdf', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png'}


def request(method, url, key, body=None, headers=None):
    h = {'apikey': key, 'Authorization': f'Bearer {key}', **(headers or {})}
    req = urllib.request.Request(url, data=body, method=method, headers=h)
    try:
        with urllib.request.urlopen(req, timeout=300) as r:
            return r.status, r.read()
    except urllib.error.HTTPError as e:
        return e.code, e.read()


def main():
    args = [a for a in sys.argv[1:] if not a.startswith('--')]
    apply = '--apply' in sys.argv
    if len(args) != 1:
        sys.exit(__doc__)
    bundle = Path(args[0])
    rows = list(csv.DictReader(MANIFEST.open(encoding='utf-8')))
    problems, plan = [], []
    for r in rows:
        f = bundle / r['bundle_path']
        if not f.is_file():
            problems.append(f"missing file: {r['bundle_path']}")
            continue
        ext = f.suffix.lower()
        if ext not in ALLOWED:
            problems.append(f"type not allowed ({ext}): {r['bundle_path']}")
            continue
        size = f.stat().st_size
        if size > MAX_BYTES:
            problems.append(f"over 25 MB ({size} bytes): {r['bundle_path']}")
            continue
        safe = ''.join(c if c.isalnum() or c in '._-' else '_' for c in f.name)
        plan.append((r['vault_document_id'], r['doc_number'], f, f"{r['vault_document_id']}/{safe}", ALLOWED[ext], size))
    print(f'{len(plan)} files ready, {len(problems)} problems')
    for p in problems:
        print('  problem:', p)
    if not apply:
        print('Dry run. Add --apply (with SUPABASE_URL and SERVICE_ROLE_KEY set) to upload.')
        return 1 if problems else 0

    url = os.environ.get('SUPABASE_URL', '').rstrip('/')
    key = os.environ.get('SERVICE_ROLE_KEY', '')
    if not url.startswith('https://') or not key:
        sys.exit('Set SUPABASE_URL (https://<ref>.supabase.co) and SERVICE_ROLE_KEY for this run.')
    done = skipped = failed = 0
    for doc_id, num, f, path, mime, size in plan:
        q = urllib.parse.urlencode({'id': f'eq.{doc_id}', 'select': 'id,storage_path'})
        st, body = request('GET', f'{url}/rest/v1/vault_documents?{q}', key)
        found = json.loads(body or b'[]') if st == 200 else []
        if not found:
            print(f'  not in the register ({st}): {num}'); failed += 1; continue
        if found[0].get('storage_path'):
            print(f'  already attached, skipped: {num}'); skipped += 1; continue
        st, body = request('POST', f'{url}/storage/v1/object/vault/{urllib.parse.quote(path)}', key, f.read_bytes(),
                           {'Content-Type': mime, 'x-upsert': 'false', 'Cache-Control': 'max-age=3600'})
        if st not in (200, 201):
            print(f'  upload refused ({st}) {num}: {body[:200]!r}'); failed += 1; continue
        patch = json.dumps({'storage_path': path, 'file_name': f.name, 'mime_type': mime, 'size_bytes': size}).encode()
        st, body = request('PATCH', f'{url}/rest/v1/vault_documents?id=eq.{doc_id}', key, patch,
                           {'Content-Type': 'application/json', 'Prefer': 'return=minimal'})
        if st not in (200, 204):
            print(f'  uploaded but not recorded ({st}) {num}: {body[:200]!r}'); failed += 1; continue
        done += 1
        print(f'  attached: {num}  ({size // 1024} KB)')
    print(f'Attached {done}, skipped {skipped} already attached, {failed} failed.')
    return 1 if failed else 0


if __name__ == '__main__':
    sys.exit(main())
