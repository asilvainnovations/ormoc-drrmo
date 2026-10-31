#!/usr/bin/env python3
"""Turn a drafted manual chapter (.docx) into Library sources.

  python3 scripts/split_manual_docx.py reference/<Chapter>.docx --slug ch2 --prefix MOO_Ch2 --version v0.9

Writes, for the Library loader in scripts/generate_seed.py (LIBRARY_DRAFTS):
  reference/moo/<prefix>_<version>.md        the chapter body (everything before the first "# ANNEX")
  reference/moo/<prefix>_Annex_<id>.md       one file per "# ANNEX <id> ..." heading
  public/library/<slug>/fig-NN.webp          figures, resized to 1400 px wide and compressed

Figures become Markdown images that point at /library/<slug>/fig-NN.webp, with alt text taken from
the nearest heading. They are not precached on phones (vite.config.ts globIgnores 'library/**'),
so the text works offline and the figures load when there is a connection.

Needs pandoc and Pillow.
"""
from __future__ import annotations
import argparse, re, shutil, subprocess, tempfile
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
MAX_W = 1400


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('docx'); ap.add_argument('--slug', required=True); ap.add_argument('--prefix', required=True)
    ap.add_argument('--version', default='v0.9')
    a = ap.parse_args()
    tmp = Path(tempfile.mkdtemp())
    subprocess.run(['pandoc', a.docx, '-t', 'gfm', '--wrap=none', f'--extract-media={tmp}', '-o', str(tmp / 'out.md')], check=True)
    md = (tmp / 'out.md').read_text(encoding='utf-8')

    fig_dir = ROOT / 'public' / 'library' / a.slug
    if fig_dir.exists():
        shutil.rmtree(fig_dir)
    fig_dir.mkdir(parents=True)
    lines, heading, n, out = md.split('\n'), '', 0, []
    img_re = re.compile(r'<img src="([^"]+)"[^>]*/?>')
    for line in lines:
        h = re.match(r'^#{1,3}\s+(.*)$', line) or re.match(r'^\*\*(\d+\.\d+ .+?)\*\*\s*$', line)
        if h and h.group(1).strip(' *'):
            heading = re.sub(r'[*\\]', '', h.group(1)).strip()
        m = img_re.search(line)
        if m:
            n += 1
            src = Path(m.group(1))
            src = src if src.is_absolute() else tmp / src
            im = Image.open(src).convert('RGB')
            if im.width > MAX_W:
                im = im.resize((MAX_W, round(im.height * MAX_W / im.width)), Image.LANCZOS)
            name = f'fig-{n:02d}.webp'
            im.save(fig_dir / name, 'WEBP', quality=80, method=6)
            alt = f'Figure {n}: {heading}' if heading else f'Figure {n}'
            line = f'![{alt}](/library/{a.slug}/{name})'
        out.append(line)
    md = '\n'.join(out)
    # Drop empty headings left by page breaks ("#  ").
    md = re.sub(r'^#+\s*$\n?', '', md, flags=re.M)

    parts = re.split(r'(?=^# ANNEX )', md, flags=re.M)
    body, annexes = parts[0], parts[1:]
    moo = ROOT / 'reference' / 'moo'
    moo.mkdir(parents=True, exist_ok=True)
    for old in moo.glob(f'{a.prefix}_*.md'):
        old.unlink()
    (moo / f'{a.prefix}_{a.version}.md').write_text(body.rstrip() + '\n', encoding='utf-8')
    ids = []
    for part in annexes:
        aid = re.match(r'^# ANNEX ([0-9]+-[A-Z]+)', part).group(1)
        # A "References" section after the last annex belongs to the chapter, not the annex.
        part, _, refs = part.partition('\n# REFERENCES')
        (moo / f'{a.prefix}_Annex_{aid}.md').write_text(part.rstrip() + '\n', encoding='utf-8')
        if refs:
            with open(moo / f'{a.prefix}_{a.version}.md', 'a', encoding='utf-8') as f:
                f.write('\n# REFERENCES' + refs.rstrip() + '\n')
        ids.append(aid)
    total = sum(p.stat().st_size for p in fig_dir.glob('*.webp'))
    print(f'{a.prefix}: body {len(body):,} chars, {len(ids)} annexes ({", ".join(ids)}), {n} figures ({total/1e6:.1f} MB)')


if __name__ == '__main__':
    main()
