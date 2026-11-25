#!/usr/bin/env python3
"""Split the Consolidated Manual Markdown into one file per Library document.

Input : reference/moo/MOO_Consolidated_v1.0.md (one file, ten chapters, compiled 12 Nov 2026)
Output: reference/moo/consolidated/
          00_Introduction.md      front matter (document control, abbreviations, glossary, how to use,
                                  executive summary) and the Introduction to the Manual
          01_Chapter_1.md ... 10_Chapter_10.md
          11_Annex_A.md           Master Procedure Register (whole Manual)

The chapter order is fixed (ten chapters, 12 Nov 2026), so the script checks each top-level heading
against the expected chapter title and stops if the source changes shape. generate_seed.py loads these
files as new draft versions of the existing Library documents.

Usage: python3 scripts/split_consolidated_md.py [--source FILE] [--label v1.0]
"""
from __future__ import annotations

import argparse
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CHAPTERS = [  # (number, title as it appears in the source heading, case-insensitive prefix match)
    (1, 'Legal Mandate, DRRM Governance and Institutional Accountability'),
    (2, 'CDRRMO Organi'),  # Organisational / Organizational
    (3, 'Risk Intelligence, Planning and Institutional Preparedness'),
    (4, 'Early Warning, EOC Activation, Incident Management and Emergency Response'),
    (5, 'Recovery, Rehabilitation and Build Back Better'),
    (6, 'DRRM Financing, Resource Management and Accountability'),
    (7, 'Monitoring, Evaluation, Knowledge Management and Continuous Improvement'),
    (8, 'Stakeholder Engagement and Institutional Partnerships'),
    (9, 'Public Awareness, Community Resilience and Capacity Development'),
    (10, 'Institutional Sustainability, Deep Resilience and Recognition'),
]
FRONT = ['Ormoc City CDRRMO', 'Document Control', 'Abbreviations', 'Glossary of Terms', 'How to Use This Manual',
         'Executive Summary', 'Introduction to the Manual']


def split(text: str) -> dict[str, str]:
    lines = text.splitlines(keepends=True)
    heads = [i for i, l in enumerate(lines) if re.match(r'# \S', l)]
    sections = [(lines[i][2:].strip(), ''.join(lines[i:j])) for i, j in zip(heads, heads[1:] + [len(lines)])]
    out, front, ch = {}, [], 0
    for title, body in sections:
        if ch == 0 and any(title.startswith(f) for f in FRONT):
            front.append(body)
            continue
        if title.startswith('Annex A'):
            out['11_Annex_A.md'] = body
            continue
        no, expected = CHAPTERS[ch]
        if not title.lower().startswith(expected.lower()):
            raise SystemExit(f'Expected Chapter {no} "{expected}…", found "{title}"')
        out[f'{no:02d}_Chapter_{no}.md'] = re.sub(r'^# ', f'# Chapter {no}. ', body, count=1)
        ch += 1
    if ch != len(CHAPTERS):
        raise SystemExit(f'Found {ch} chapters, expected {len(CHAPTERS)}')
    out['00_Introduction.md'] = ''.join(front)
    return dict(sorted(out.items()))


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument('--source', default=str(ROOT / 'reference' / 'moo' / 'MOO_Consolidated_v1.0.md'))
    ap.add_argument('--out', default=str(ROOT / 'reference' / 'moo' / 'consolidated'))
    a = ap.parse_args()
    files = split(Path(a.source).read_text(encoding='utf-8'))
    out = Path(a.out)
    out.mkdir(parents=True, exist_ok=True)
    for old in out.glob('*.md'):
        old.unlink()
    for name, body in files.items():
        (out / name).write_text(body.rstrip() + '\n', encoding='utf-8')
        print(f'{name:24s} {len(body.encode()) // 1024:5d} KB')


if __name__ == '__main__':
    main()
