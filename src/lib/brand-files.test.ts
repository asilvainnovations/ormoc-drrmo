import { readFileSync, statSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

// 1.11: on 8 Nov 2026 public/Ormoc_CDRRMO_Logo.png on main was cut off at exactly 2 MiB by a web upload, and
// scripts/brand_assets.py could not rebuild the icons. A PNG that is complete ends with its IEND chunk.
const IEND = Buffer.from([0x49, 0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82]);

describe('brand originals', () => {
  for (const f of ['public/Ormoc_CDRRMO_Logo.png', 'public/Ormoc_City_Logo.png', 'public/App_Banner.png']) {
    it(`${f} is a complete PNG`, () => {
      const b = readFileSync(f);
      expect(b.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a');
      expect(b.subarray(b.length - 8).equals(IEND)).toBe(true);
      expect(statSync(f).size).not.toBe(2 * 1024 * 1024);
    });
  }
});
