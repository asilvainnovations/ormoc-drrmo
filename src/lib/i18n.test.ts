import { describe, expect, it } from 'vitest';
import { STRINGS } from './i18n';

describe('i18n string table', () => {
  it('has the same keys in English and Cebuano', () => {
    expect(Object.keys(STRINGS.ceb).sort()).toEqual(Object.keys(STRINGS.en).sort());
  });
  it('has no empty values in either language', () => {
    for (const lang of ['en', 'ceb'] as const)
      for (const [k, v] of Object.entries(STRINGS[lang])) expect(v.trim(), `${lang}.${k}`).not.toBe('');
  });
  it('keeps legal and institution terms untranslated in Cebuano', () => {
    const all = Object.values(STRINGS.ceb).join(' ');
    expect(all).toContain('EOC');
    expect(all).toContain('DRRM');
  });
});
