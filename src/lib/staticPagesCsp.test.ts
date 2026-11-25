// The site CSP is script-src 'self': static pages in public/ must not carry inline scripts
// or inline event handlers, or they load but do nothing.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const PUBLIC = join(__dirname, '..', '..', 'public');
const PAGES = ['systems-diagnosis.html'];

describe('static pages work under script-src self', () => {
  for (const page of PAGES) {
    const html = readFileSync(join(PUBLIC, page), 'utf8')
      .replace(/srcdoc="[^"]*"/g, ''); // embedded documents are checked on their own
    it(`${page} has no inline executable script`, () => {
      const inline = [...html.matchAll(/<script(?![^>]*\bsrc=)([^>]*)>/g)].filter((m) => !/application\/ld\+json/.test(m[1]!));
      expect(inline).toEqual([]);
    });
    it(`${page} has no inline event handler attributes`, () => {
      expect(html.match(/\son[a-z]+\s*=\s*["']/g) ?? []).toEqual([]);
    });
  }
});
