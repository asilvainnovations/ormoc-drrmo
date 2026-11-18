import { describe, expect, it } from 'vitest';
import { STRINGS } from './i18n';

describe('i18n string table', () => {
  it('has the same keys in English, Ormocanon (Bisaya) and Filipino', () => {
    expect(Object.keys(STRINGS.ceb).sort()).toEqual(Object.keys(STRINGS.en).sort());
    expect(Object.keys(STRINGS.fil).sort()).toEqual(Object.keys(STRINGS.en).sort());
  });
  it('has no empty values in either language', () => {
    for (const lang of ['en', 'ceb', 'fil'] as const)
      for (const [k, v] of Object.entries(STRINGS[lang])) expect(v.trim(), `${lang}.${k}`).not.toBe('');
  });
  it('keeps legal and institution terms untranslated in Ormocanon and Filipino', () => {
    for (const lang of ['ceb', 'fil'] as const) {
      const all = Object.values(STRINGS[lang]).join(' ');
      expect(all).toContain('EOC');
      expect(all).toContain('DRRM');
    }
    expect(Object.values(STRINGS).map((l) => l['lang.ceb'])).toEqual(['Ormocanon (Bisaya)', 'Ormocanon (Bisaya)', 'Ormocanon (Bisaya)']);
  });
});
