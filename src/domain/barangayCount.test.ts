// Ormoc has 85 barangays (PSA PSGC; City Ord. 052 s.2021). No source file may carry the pre-merger count.
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = join(__dirname, '..', '..');
const PATTERN = /\b110[ -]barangay|110-to-85|85\/110|\b105 barangays/i;
function walk(dir: string, out: string[] = []): string[] {
  for (const n of readdirSync(dir)) {
    const p = join(dir, n);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(ts|tsx|json|sql|md|html|py)$/.test(n) && !n.endsWith('barangayCount.test.ts') && !n.endsWith('tools.test.ts')) out.push(p);
  }
  return out;
}

describe('85 barangays only', () => {
  it('no app, seed or Manual source mentions a 110 or 105 barangay count', () => {
    const hits = ['src', 'supabase/seed', 'reference/moo', 'scripts', 'public']
      .flatMap((d) => walk(join(ROOT, d)))
      .filter((f) => PATTERN.test(readFileSync(f, 'utf8')));
    expect(hits.map((f) => f.slice(ROOT.length))).toEqual([]);
  });
});
